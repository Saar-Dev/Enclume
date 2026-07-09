# PLAN_MODING.md — Système de Moding (installation de modules sur armes)
> Rédaction initiale : Session 120 — 2026-06-24
> **Révisé — 2026-07-09** : plan scindé en deux phases après analyse critique (voir "Historique des
> révisions" en bas de fichier). **Ce document ne couvre désormais que la Phase A.** La Phase B
> (effet mécanique des mods en combat) est explicitement hors scope — à planifier ensemble dans un
> second temps, jamais dans le même plan (règle "un sujet à la fois").

---

## Objectif — Phase A (ce plan)

Permettre à un joueur d'**installer un module d'arme** (accessoire) sur une arme qu'il possède déjà
dans son inventaire : rangement uniquement — retrait de l'inventaire, enregistrement sur l'arme,
affichage. **Aucun effet mécanique de jeu** (bonus de Test de tir, exclusivité entre systèmes, etc.)
n'est appliqué par cette phase — voir "Hors scope — Phase B" plus bas.

- La source du module = inventaire du personnage (`ref_equipment.family='Armes'`,
  `category='Accessoires pour armes'`)
- La cible = une arme dans l'inventaire (`family='Armes'`, `category≠'Accessoires pour armes'`)
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
- Les mods installés sur une arme sont stockés dans une colonne dédiée de l'inventaire (Kiwi :
  `InventaireModInstalles` named range)
- Un mod déjà installé est **retiré de l'inventaire** (suppression physique de la ligne)
- Un mod ne peut pas être installé deux fois sur la même arme (Phase A : dédoublonnage strict par
  `equipment_id` — voir limite connue dans "Hors scope — Phase B")

**Vérifié 2026-07-09 contre les données réelles** : `family='Armes'` + `category='Accessoires pour
armes'` correspond exactement à **16 lignes** en base (`ref_equipment`). Le filtre Kiwi transposé
tel quel reste valide aujourd'hui.

---

## Architecture cible (Enclume)

### Stack
- **Backend** : routes ajoutées dans `server/src/routes/character/char-sheet.js` (**pas** un nouveau
  router séparé — voir correction ci-dessous), logique métier dans `server/src/services/
  modingService.js` (nouveau), qui dialogue avec `server/src/services/inventoryService.js`
  (nouveau — voir **Étape 0** ci-dessous, prérequis à ce plan)
- **Frontend** : composant `ModingWindow.jsx`, ouvert depuis un bouton **"Customisation"** dans la
  fenêtre Inventaire existante (décidé avec Saar 2026-07-09)
- **BDD** : nouvelle table `char_inventory_mods` (migration **124** — voir correction numérotation)

### Correction — routes dans `char-sheet.js`, pas un router `/api/characters/:charId/*`
Le plan initial esquissait `/api/characters/:charId/moding/*`. **Vérifié 2026-07-09** :
`char-sheet.js` centralise déjà l'auth + l'ownership pour tout ce qui touche une fiche personnage :

```js
// char-sheet.js:52-76 (existant)
router.use(requireAuth)
router.param('characterId', async (req, res, next, characterId) => {
  // 404 si character introuvable
  // 403 si pas membre de la campagne
  // req.character, req.isGm, isOwner check → 403 si ni owner ni GM ni drone
  next()
})
```

Monté sur `/api/char-sheet` (`server/src/index.js:76`). Réimplémenter ce guard dans un router séparé
serait une régression (double logique d'ownership, risque de divergence). **Les routes moding vivent
dans `char-sheet.js`, avec le même préfixe que le reste** :

```
GET  /api/char-sheet/:characterId/moding/state
POST /api/char-sheet/:characterId/moding/install
```

(paramètre `characterId`, pas `charId`, pour matcher `router.param` existant.)

### Données existantes réutilisables
- `char_inventory` — inventaire perso (`equipment_id → ref_equipment`)
- `ref_equipment` — catalogue (`family`, `category`, `name`, `bonus`, `description`)
- Helper existant `getItemWithRef(itemId)` (`char-sheet.js:724`) — pattern de JOIN
  `char_inventory ⋈ ref_equipment` déjà utilisé par toutes les routes inventaire, réutilisable pour
  construire la réponse `state`.

---

## Étape 0 — Prérequis : extraction `inventoryService.js`

**Demandé par Saar 2026-07-09** : `char-sheet.js` fait déjà 1928 lignes. Avant d'y ajouter le
moding, extraire la logique inventaire dans un service dédié, dont `modingService.js` deviendra
consommateur (accès direct à `char_inventory`/`ref_equipment`, pas de duplication de requêtes).

### Portée exacte (vérifiée en lisant `char-sheet.js` en entier le 2026-07-09)

**Déplacé vers `server/src/services/inventoryService.js` :**
- Constantes (lignes 698-701) : `VALID_CONTAINERS`, `VALID_SLOTS`, `ARMOR_SLOTS`, `WEAPON_SLOTS`
  — + nouvelles constantes `WEAPON_FAMILY = 'Armes'` / `MOD_CATEGORY = 'Accessoires pour armes'`
  (aujourd'hui des chaînes littérales répétées dans le fichier — autant les centraliser puisque
  `modingService.js` en a besoin aussi)
- Helpers (lignes 703-774) : `isContainerAvailable`, `getDefaultContainer`, `getItemWithRef`,
  `resolveAmmoInit`
- Logique métier des 6 routes suivantes (lignes 776-1328), extraite en fonctions pures DB
  (`getInventory`, `addItem`, `updateItem`, `reloadWeapon`, `removeItem`, `quickEquip`) :
  - GET `/:characterId/inventory`
  - POST `/:characterId/quick-equip`
  - POST `/:characterId/inventory`
  - PUT `/:characterId/inventory/:itemId`
  - POST `/:characterId/inventory/:itemId/reload`
  - DELETE `/:characterId/inventory/:itemId`

**Convention confirmée par `advantageService.js`** (aucun `io`/socket dans ce fichier) : le service
reste une couche DB pure — pas de `req`/`res`, pas d'émission socket. Les routes `char-sheet.js`
deviennent minces : parse `req` → appelle la fonction service → émet l'event socket existant → répond.
**Aucun changement d'API** côté client (mêmes routes, mêmes payloads, mêmes events) — refactor interne
pur, zéro régression attendue si le comportement est identique avant/après.

**Explicitement NON déplacé (vérifié, pas oublié) :**
- `weapon-skill` (ligne 849) — calcule un total de compétence via `calcSkillTotal` (`charStats.js`),
  touche `char_attributes`/`char_skills`/`char_archetype` — c'est un calcul de combat, pas de la
  gestion d'inventaire. Reste dans `char-sheet.js`.
- `sols` (ligne 888) — domaine monnaie (`SOLS_UPDATED`), pas de l'inventaire au sens `char_inventory`
  d'objets. Reste.
- Routes drone `cargo`/`weapons` (lignes 1597+) — tables `char_drone_*` distinctes. Hors scope.
- **Trouvé en marge, non traité ici** : `server/src/services/tradeService.js` manipule déjà
  `char_inventory` en direct (insert/update/delete dupliqués, lignes 196-307) et **n'émet aucun
  event socket** sur ces mutations (dette pré-existante repérée, pas dans ce plan). Il n'est **pas**
  migré vers `inventoryService.js` dans cette étape — feature déjà en prod, migration optionnelle à
  part si souhaitée un jour.

### Vérification de non-régression (à faire avant de considérer l'Étape 0 close)
Comportement identique avant/après refactor sur : ajout item, équipement (slot armure 1+S+S, slot
arme 1/2 mains), stacking quantité, recharge arme, suppression partielle/totale, quick-equip GM.
Pas de nouveau comportement — uniquement un déplacement de code.

---

## Migration 124 — `char_inventory_mods`

> Renumérotée : le plan initial proposait 86, **déjà pris** par `86_trade_offers.js`. Prochaine
> migration disponible au 2026-07-09 : **124** (123 = `ref_advantages_polaris`, Session 141 suite 6).
> À reconfirmer avec `ls server/src/db/migrations/` au moment de coder (P53 — dérive possible).

Table séparée (confirmé comme le bon choix — plus normalisée que l'alternative `installed_mods
UUID[]` évoquée en premier jet) :

```js
// 124_char_inventory_mods.js
char_inventory_mods
  id            UUID PK, default gen_random_uuid()
  weapon_inv_id UUID NOT NULL, FK char_inventory(id) ON DELETE CASCADE
  equipment_id  UUID, FK ref_equipment(id) ON DELETE SET NULL   -- réf au type de mod
  mod_name      TEXT NOT NULL                                    -- snapshot nom à l'installation
  installed_at  TIMESTAMPTZ DEFAULT now()
```

- `mod_name` snapshotté à l'installation (affichage stable même si le référentiel change plus tard)
- `weapon_inv_id` en CASCADE : si l'arme est supprimée de l'inventaire, ses mods installés le sont
  aussi (cohérent avec Kiwi, pas de mod orphelin affiché)
- `equipment_id` en SET NULL : si la ligne `ref_equipment` du mod est supprimée du catalogue, on
  garde la trace via `mod_name` (pas de perte d'historique)

---

## Composant React `ModingWindow.jsx`

**Déclenchement tranché 2026-07-09** : bouton **"Customisation"** dans la fenêtre Inventaire
existante (pas une entrée de menu session séparée). Ouvre `ModingWindow.jsx` par-dessus ou à côté de
l'inventaire — mécanisme d'ouverture exact (modal/panneau) à déterminer au codage selon ce
qu'utilise déjà la fenêtre Inventaire pour ses propres sous-vues.

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
GET  /api/char-sheet/:characterId/moding/state
  → { weapons: [...], installableMods: [...] }

POST /api/char-sheet/:characterId/moding/install
  body: { weaponInvId: UUID, modInvId: UUID }
  → { ok: true, weapons: [...], installableMods: [...] }
  ou 4xx { error: "..." } (AppError, pattern existant du fichier)
```

### Logique serveur `install`

```js
// 1. Validation — items appartiennent bien à ce personnage
const weapon = await db('char_inventory').where({ id: weaponInvId, character_id: characterId }).first()
const mod    = await db('char_inventory').where({ id: modInvId,    character_id: characterId }).first()

if (!weapon || !mod) throw new AppError(404, 'Item introuvable')
if (!weapon.equipment_id || !mod.equipment_id)
  throw new AppError(400, 'Item custom sans référentiel — non modable') // P1

const weaponRef = await db('ref_equipment').where({ id: weapon.equipment_id }).first()
const modRef    = await db('ref_equipment').where({ id: mod.equipment_id }).first()

if (weaponRef.family !== 'Armes' || weaponRef.category === 'Accessoires pour armes')
  throw new AppError(400, 'La cible n\'est pas une arme valide')

if (modRef.family !== 'Armes' || modRef.category !== 'Accessoires pour armes')
  throw new AppError(400, 'L\'objet n\'est pas un accessoire d\'arme')

// 2. Anti-doublon strict (Phase A — dédoublonnage par equipment_id uniquement,
//    PAS l'exclusivité de sous-famille rulebook — voir Hors scope Phase B)
const alreadyInstalled = await db('char_inventory_mods')
  .where({ weapon_inv_id: weaponInvId, equipment_id: mod.equipment_id }).first()
if (alreadyInstalled) throw new AppError(409, 'Ce mod est déjà installé sur cette arme')

// 3. Transaction atomique
const result = await db.transaction(async (trx) => {
  await trx('char_inventory_mods').insert({
    weapon_inv_id: weaponInvId,
    equipment_id: mod.equipment_id,
    mod_name: modRef.name,
  })
  await trx('char_inventory').where({ id: modInvId }).delete()
  return getModingState(trx, characterId)
})

// 4. Notifier la room (pattern existant char-sheet.js — WOUND_*/INVENTORY_*/SOLS_*)
req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_REMOVED, {
  characterId, itemId: modInvId,
})

return result
```

**Correction — événement socket, pas optionnel.** Le plan initial classait la notification
temps réel comme "optionnel, peut attendre". **Vérifié 2026-07-09** : dans `char-sheet.js`, *toutes*
les routes qui modifient `char_inventory` (add/update/remove/reload) émettent déjà
`WS.INVENTORY_ADDED/UPDATED/REMOVED` (`shared/events.js:66-68`), scopées `campaign_id`. La ligne
`char_inventory` du mod étant physiquement supprimée, `WS.INVENTORY_REMOVED` (event existant,
aucun nouvel event à créer) doit être émis — sinon la fiche perso reste désynchronisée pour le GM ou
tout autre onglet ouvert, comme le serait n'importe quelle autre suppression d'item.

**Tranché 2026-07-09 (Saar : aligner sur les exigences existantes)** : `shared/events.js` a un event
dédié par domaine (`WOUND_ADDED/UPDATED/REMOVED`, `INVENTORY_ADDED/UPDATED/REMOVED`, `SOLS_UPDATED`).
Le moding introduit un nouveau domaine (nouvelle table `char_inventory_mods`) — par cohérence avec
cette convention, **nouvel event dédié `WS.MOD_INSTALLED`** (`{ characterId, weaponInvId, mods }`)
plutôt que détourner `INVENTORY_UPDATED` sur une ligne d'arme qui, elle, ne change pas réellement
(le modèle de données Phase A stocke les mods dans une table séparée). Émis en plus de
`INVENTORY_REMOVED` (celui-ci reste nécessaire pour que la ligne du mod disparaisse bien des autres
vues inventaire ouvertes). Ajout à faire dans `shared/events.js` au moment du codage — pas de
`MOD_REMOVED` symétrique pour l'instant (désinstallation = Phase B, hors scope).

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
WHERE ci.character_id = :characterId
  AND re.family = 'Armes'
  AND re.category != 'Accessoires pour armes'
GROUP BY ci.id, ci.equipment_id, re.name, re.family, re.category

-- Mods installables (dans l'inventaire, pas encore sur une arme)
SELECT ci.id, ci.equipment_id, re.name, re.category
FROM char_inventory ci
JOIN ref_equipment re ON re.id = ci.equipment_id
WHERE ci.character_id = :characterId
  AND re.family = 'Armes'
  AND re.category = 'Accessoires pour armes'
```

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 0 | Extraction `inventoryService.js` depuis `char-sheet.js` (voir portée détaillée ci-dessus) + non-régression | — |
| 1 | Migration 124 — `char_inventory_mods` | — |
| 2 | `modingService.js` (`getModingState`/`installMod`), consomme `inventoryService.js` | Étapes 0+1 |
| 3 | Routes `GET .../moding/state` + `POST .../moding/install` dans `char-sheet.js` (minces, émettent `INVENTORY_REMOVED` + `MOD_INSTALLED`) | Étape 2 |
| 4 | Ajout `WS.MOD_INSTALLED` dans `shared/events.js` | Étape 3 |
| 5 | Composant `ModingWindow.jsx` — liste armes + mods | Étape 3 |
| 6 | Bouton "Customisation" dans la fenêtre Inventaire → ouvre `ModingWindow.jsx` | Étape 5 |

---

## Pièges à anticiper

- **P1** : `char_inventory.equipment_id` peut être NULL (item custom) → exclure de la liste armes et
  mods installables (JOIN inner sur `ref_equipment`), rejet explicite dans `install` (voir logique
  serveur ci-dessus)
- **P2** : Un perso peut avoir plusieurs lignes `char_inventory` pour la même arme (`quantity` > 1) →
  identifier l'arme par `char_inventory.id`, pas `equipment_id`
- **P3** : La suppression du mod (DELETE `char_inventory`) doit être dans la même transaction que
  l'INSERT `char_inventory_mods` — sinon état incohérent
- **P4** : ~~Vérifier les droits~~ **Résolu** — `router.param('characterId', ...)` de `char-sheet.js`
  couvre déjà owner/GM/membre de campagne pour toute route montée dans ce fichier. Aucune logique de
  garde supplémentaire à écrire.
- **P5** : `ref_equipment.family`/`.category` sont des `TEXT` sans contrainte CHECK (vérifié dans la
  migration 48) — comparaison exacte `=` suffit tant que les valeurs saisies restent cohérentes
  (vérifié 16/16 lignes actuelles conformes à `'Armes'`/`'Accessoires pour armes'` exact), mais rester
  vigilant si de nouvelles lignes sont saisies avec une casse différente
- **P6** : Anti-doublon Phase A = un même `equipment_id` ne peut pas être installé deux fois sur la
  même arme. **Ce n'est pas la règle complète du livre** (voir Hors scope — Phase B) — c'est une
  garde-fou minimal, pas une simulation des règles de jeu.

---

## Hors scope — Phase B (à planifier ensemble, séparément)

**Ne pas coder dans ce plan.** Trouvé en analyse critique du 2026-07-09, documenté ici pour ne pas
le perdre, mais traité comme un chantier à part entière avec son propre plan quand on s'y attaque :

- **Effet mécanique des mods sur le Test de tir** — la majorité des 16 accessoires réels a un
  `bonus` chiffré avec un vrai effet de règle (ex. Visée laser +2, Lunette de visée +1/niv jusqu'à
  +10 avec coût en Initiative sur Tir visé). Tant que la Phase B n'est pas faite, "installer" un mod
  est cosmétique — aucun impact sur `calcSkillTotal`/P51.
- **Exclusivité par sous-famille** — "Système de tir assisté" (Cyclope PVI / Onarck P / Implant
  palmaire / Vanguard) : 4 objets différents, non cumulables entre eux, "on prend le plus
  performant". Le modèle de données Phase A ne distingue pas cette sous-famille (seul indice
  aujourd'hui : un préfixe dans `ref_equipment.name`, pas structurel) — à concevoir en Phase B.
- **Compatibilité arme↔mod** — Silencieux limité à certains types d'armes à feu ; Lunette "prévue
  pour un type d'arme bien précis" ; Trépied lié aux armes lourdes nécessitant un support. Phase A
  ne vérifie que `family`/`category` génériques, pas la compatibilité fine par type d'arme.
- **Désinstallation** (retour en inventaire)
- **Limite de slots par arme** — **correction 2026-07-09** : `REGLEARMURE.md` référencé par le plan
  initial est **la mauvaise source** (ce fichier couvre les exo-armures/mécas, pas les armes
  portatives). Aucune règle de quota trouvée dans les 16 descriptions réelles d'accessoires — la
  vraie contrainte semble être l'exclusivité par sous-famille ci-dessus, pas un nombre de slots. À
  reconfirmer en Phase B, pas de fichier `REGLE_*.md` dédié aux armes portatives (les règles vivent
  directement dans `ref_equipment.description`, déjà en base).
- Mod custom (sans `equipment_id`) — sprint futur

---

## Historique des révisions

- **2026-06-24 (Session 120)** — rédaction initiale, transposition Kiwi.
- **2026-07-09** — analyse critique demandée par Saar. Corrections apportées : migration
  86→124 (collision `trade_offers`), routes déplacées dans `char-sheet.js` (réutilisation du guard
  ownership existant plutôt que réimplémentation), socket `INVENTORY_REMOVED` requalifié
  obligatoire (pattern déjà systématique sur toutes les routes inventaire), référence
  `REGLEARMURE.md` retirée (mauvaise source — mécas, pas armes portatives), scope explicitement
  réduit à la Phase A (rangement pur) — la Phase B (effet mécanique combat + exclusivité sous-famille)
  extraite en section "Hors scope" dédiée, à planifier comme chantier séparé.
- **2026-07-09 (suite)** — trois décisions de Saar intégrées : **Étape 0 ajoutée**
  (extraction `server/src/services/inventoryService.js` depuis `char-sheet.js`, portée exacte
  vérifiée ligne par ligne — 6 routes + 4 helpers + constantes déplacés, `weapon-skill`/`sols`/drone
  explicitement exclus, dette `tradeService.js` repérée mais non traitée) ; **déclenchement UI**
  tranché (bouton "Customisation" dans la fenêtre Inventaire, pas un menu séparé) ; **event socket**
  tranché par cohérence avec la convention existante (`WS.MOD_INSTALLED` dédié, en plus
  d'`INVENTORY_REMOVED`, plutôt que détourner `INVENTORY_UPDATED`). Aucun code écrit — session de
  planification pure.
