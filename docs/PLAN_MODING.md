# PLAN_MODING.md — Système de Moding (installation de modules sur armes)
> Session 120 — 2026-06-24

---

## Objectif

Permettre à un joueur d'**installer un module d'arme** (accessoire) sur une arme qu'il possède déjà dans son inventaire.

- La source du module = inventaire du personnage (famille "Armes", catégorie "Accessoires pour armes")
- La cible = une arme dans l'inventaire (famille "Armes", catégorie ≠ "Accessoires pour armes")
- Après installation : le module **disparaît de l'inventaire** et est **enregistré sur l'arme**

---

## Référence Kiwi

| Fichier Kiwi | Ce qu'il apporte |
|---|---|
| `40_Crafting_WebApp.gs` | Moteur complet : `crafting_getState(fid)` — liste armes + mods installables ; `crafting_installMod(fid, weaponKey, modKey)` — écriture atomique + suppression ligne inventaire |
| `Crafting.html` | UI : liste armes (gauche), panneau arme sélectionnée (droite) avec mods installés + mods installables + bouton "Installer" |

### Logique Kiwi (à transposer)
- Arme = `family="Armes"` ET `category ≠ "Accessoires pour armes"`
- Mod installable = `category = "Accessoires pour armes"`
- Clé unique item = `id♦name` (dans Kiwi via Google Sheets) → dans Enclume = `char_inventory.id` (UUID)
- Les mods installés sur une arme sont stockés dans une colonne dédiée de l'inventaire (Kiwi : `InventaireModInstalles` named range)
- Un mod déjà installé est **retiré de l'inventaire** (suppression physique de la ligne)
- Un mod ne peut pas être installé deux fois sur la même arme

---

## Architecture cible (Enclume)

### Stack
- **Backend** : Express REST + éventuellement Socket.IO pour notifier le GM
- **Frontend** : React composant `ModingWindow.jsx` (ou onglet dans `CharacterSheet`)
- **BDD** : une colonne supplémentaire sur `char_inventory` (migration 86)

### Données existantes réutilisables
- `char_inventory` — inventaire perso (equipment_id → ref_equipment)
- `ref_equipment` — catalogue (family, category, name)
- `ref_equipment.family = 'Armes'` + `ref_equipment.category = 'Accessoires pour armes'` — identifie les mods

---

## Migration 86 — `char_inventory.installed_mods`

Ajout d'une colonne sur `char_inventory` pour stocker les IDs de mods installés sur une arme.

```sql
ALTER TABLE char_inventory
  ADD COLUMN installed_mods UUID[] DEFAULT '{}'
```

- Chaque UUID = `char_inventory.id` du mod **au moment de l'installation** (snapshot de référence)
- Après installation, le mod est supprimé de `char_inventory` (ligne entière DELETE) → l'UUID reste dans le tableau comme trace
- Optionnel : stocker aussi le nom du mod au moment de l'installation (pour affichage si le référentiel change)

**Alternative** : table séparée `char_inventory_mods` (plus normalisée, plus flexible) :

```sql
char_inventory_mods
  id            UUID PK
  weapon_inv_id UUID FK char_inventory ON DELETE CASCADE
  equipment_id  UUID FK ref_equipment ON DELETE SET NULL  -- ref au type de mod
  mod_name      TEXT NOT NULL                              -- snapshot nom à l'installation
  installed_at  TIMESTAMPTZ DEFAULT now()
```

**Choix recommandé** : **table séparée** `char_inventory_mods` — plus propre, permet d'afficher le nom même si le mod est custom, et de lister l'historique d'installation.

---

## Composant React `ModingWindow.jsx`

Fenêtre flottante ou panneau dans la fiche personnage.

### Layout (inspiré de `Crafting.html` Kiwi)
```
┌─────────────────────────────────────────────────────┐
│ Crafting / Modification d'armes                     │
│ [N armes] [M mods installables]                     │
├──────────────────┬──────────────────────────────────┤
│ Armes (liste)    │ [Arme sélectionnée]               │
│                  │ Mods installés : [list]            │
│ > Pistolet M9   │ Mods disponibles : [list + btn]   │
│   Fusil R-7     │                                    │
│   ...           │                                    │
└──────────────────┴──────────────────────────────────┘
```

### États UI
- `loading` — appel initial
- `idle` — arme sélectionnée, mods affichés
- `installing` — bouton "Installer" désactivé, spinner
- `success` — message "Mod installé", refresh automatique
- `error` — message d'erreur inline (mod déjà installé, arme invalide, etc.)

---

## API REST

```
GET  /api/characters/:charId/moding/state
  → { weapons: [...], installableMods: [...] }

POST /api/characters/:charId/moding/install
  body: { weaponInvId: UUID, modInvId: UUID }
  → { ok: true, weapons: [...], installableMods: [...] }
  ou { ok: false, error: "..." }
```

### Logique serveur `install`

```js
// 1. Validation
const weapon = await db('char_inventory').where({ id: weaponInvId, character_id: charId }).first()
const mod = await db('char_inventory').where({ id: modInvId, character_id: charId }).first()

if (!weapon || !mod) throw Error('item introuvable')

const weaponRef = await db('ref_equipment').where({ id: weapon.equipment_id }).first()
const modRef    = await db('ref_equipment').where({ id: mod.equipment_id }).first()

if (weaponRef.family !== 'Armes' || weaponRef.category === 'Accessoires pour armes')
  throw Error('La cible n\'est pas une arme valide')

if (modRef.category !== 'Accessoires pour armes')
  throw Error('L\'objet n\'est pas un accessoire d\'arme')

// 2. Vérifier que le mod n'est pas déjà installé
const alreadyInstalled = await db('char_inventory_mods')
  .where({ weapon_inv_id: weaponInvId, equipment_id: mod.equipment_id }).first()

if (alreadyInstalled) throw Error('Ce mod est déjà installé sur cette arme')

// 3. Transaction atomique
await db.transaction(async trx => {
  // Enregistrer le mod installé
  await trx('char_inventory_mods').insert({
    weapon_inv_id: weaponInvId,
    equipment_id: mod.equipment_id,
    mod_name: modRef.name
  })
  // Supprimer le mod de l'inventaire
  await trx('char_inventory').where({ id: modInvId }).delete()
})

// 4. Retourner le nouvel état
return buildModingState(charId)
```

---

## Requête `getState`

```sql
-- Armes du personnage
SELECT ci.id, ci.equipment_id, re.name, re.family, re.category,
       COALESCE(
         json_agg(cim ORDER BY cim.installed_at) FILTER (WHERE cim.id IS NOT NULL),
         '[]'
       ) AS installed_mods
FROM char_inventory ci
JOIN ref_equipment re ON re.id = ci.equipment_id
LEFT JOIN char_inventory_mods cim ON cim.weapon_inv_id = ci.id
WHERE ci.character_id = :charId
  AND re.family = 'Armes'
  AND re.category != 'Accessoires pour armes'
GROUP BY ci.id, ci.equipment_id, re.name, re.family, re.category

-- Mods installables (dans l'inventaire, pas encore sur une arme)
SELECT ci.id, ci.equipment_id, re.name, re.category
FROM char_inventory ci
JOIN ref_equipment re ON re.id = ci.equipment_id
WHERE ci.character_id = :charId
  AND re.category = 'Accessoires pour armes'
```

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 1 | Migration 86 — `char_inventory_mods` | — |
| 2 | Service `modingService.js` — `getState` + `installMod` | M86 |
| 3 | Route REST GET `/moding/state` + POST `/moding/install` | Étape 2 |
| 4 | Composant `ModingWindow.jsx` — liste armes + mods | Étape 3 |
| 5 | Intégration dans la fiche perso ou menu session | Étape 4 |

---

## Pièges à anticiper

- **P1** : `char_inventory.equipment_id` peut être NULL (item custom) → exclure de la liste armes et mods installables (JOIN inner sur ref_equipment)
- **P2** : Un perso peut avoir plusieurs lignes `char_inventory` pour la même arme (quantity > 1) → identifier l'arme par `char_inventory.id` pas `equipment_id`
- **P3** : La suppression du mod (DELETE char_inventory) doit être dans la même transaction que l'INSERT char_inventory_mods — sinon état incohérent
- **P4** : Vérifier les droits : seul le propriétaire du personnage (ou le GM) peut installer un mod — même guard que pour les routes character
- **P5** : `ref_equipment.family` et `.category` sont des `TEXT` sans contrainte de casse — normaliser avec `UPPER()` ou `ILIKE` dans les filtres
- **P6** : Un mod déjà utilisé (clé `equipment_id` déjà dans `char_inventory_mods` pour cette arme) = refus — pas de doublon par type de mod par arme

---

## Non dans le scope de ce plan

- Désinstallation de mod (retour en inventaire) — sprint futur
- Limite de slots de mods par arme — sprint futur (règle Polaris à vérifier dans REGLEARMURE.md)
- Mod custom (sans `equipment_id`) — sprint futur
- Notification temps réel au GM (Socket.IO) — optionnel, peut attendre
