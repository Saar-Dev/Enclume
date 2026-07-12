# PLAN_MODING.md — Système de Moding (installation de modules sur armes)
> Rédaction initiale : Session 120 — 2026-06-24
> **✅ PHASE A TERMINÉE — Session 141 (suite 21), 2026-07-12.** Pause levée (Tir visé clos Session
> 141 suite 17, dette `TIRVISE` close) → 8/8 étapes codées et testées (service : 10 scénarios réels
> + contrainte UNIQUE anti-doublon vérifiée directement en base ; HTTP réel ; navigateur réel via
> Playwright, capture d'écran avant/après confirmant l'installation + le rafraîchissement temps réel
> de l'inventaire). Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 21)".
> **Révisé — 2026-07-09** : plan scindé en deux phases après analyse critique (voir "Historique des
> révisions" en bas de fichier). **Ce document ne couvre désormais que la Phase A.** La Phase B
> (effet mécanique des mods en combat) est explicitement hors scope — à planifier ensemble dans un
> second temps, jamais dans le même plan (règle "un sujet à la fois").
>
> **Numéro de migration à revérifier avant tout codage** : ce plan proposait 124 (2026-07-09,
> matin) — **déjà consommée entretemps** par `124_char_advantage_notes.js`, `125_...`, et
> `126_ref_setbacks_revers_table.js` (travail en cours sur l'option `revers`, trouvé en fin de
> session, pas documenté dans `EN_COURS.md` au moment de la vérification — ne pas y toucher).
> Confirme le piège **P53** en conditions réelles. Prochaine migration à reconfirmer par
> `ls server/src/db/migrations/` le jour où ce plan est repris — ne pas se fier au numéro déjà écrit
> plus bas dans ce document.

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

  UNIQUE (weapon_inv_id, equipment_id)   -- ajouté 2026-07-12, voir analyse critique
```

- `mod_name` snapshotté à l'installation (affichage stable même si le référentiel change plus tard)
- `weapon_inv_id` en CASCADE : si l'arme est supprimée de l'inventaire, ses mods installés le sont
  aussi (cohérent avec Kiwi, pas de mod orphelin affiché)
- `equipment_id` en SET NULL : si la ligne `ref_equipment` du mod est supprimée du catalogue, on
  garde la trace via `mod_name` (pas de perte d'historique)
- **`UNIQUE(weapon_inv_id, equipment_id)`** (ajouté suite à analyse critique 2026-07-12) : le check
  anti-doublon applicatif (P6) seul laisse une fenêtre de course (deux requêtes concurrentes passent
  toutes deux le `SELECT` avant que la première n'ait commité — cas plausible avec un mod en stack
  ×2+, pas juste un double-clic accidentel). Pas besoin d'index **partiel** comme `uq_char_mut_no_sub`
  (migration 109) : ici un nouvel `install` exige toujours un `equipment_id` non nul (P1), seules les
  lignes historiques dont le catalogue a été supprimé après coup portent `equipment_id = NULL`, et
  Postgres ne fait jamais collisionner deux NULL sur une contrainte UNIQUE — donc sans risque de faux
  rejet.

---

## Composant React `ModingWindow.jsx`

**Déclenchement tranché 2026-07-09, vérifié dans le code client.** `InventoryPanel.jsx` n'est jamais
rendu seul — toujours à l'intérieur de `CharacterWindow.jsx` (`activeTab === 'materiel'`,
`CharacterWindow.jsx:388`). Toutes les fenêtres autonomes du projet (`TradeWindow.jsx`,
`ExchangeWindow.jsx`, `CharacterWindow.jsx` lui-même) portent le suffixe `Window` et flottent en
`position:fixed` (`CharacterWindow.jsx:546-547`, `zIndex: 9000`). **`ModingWindow` suit le même
pattern** — fenêtre flottante indépendante, pas un panneau inline dans `InventoryPanel` :

- État d'ouverture (`modingOpen`) géré dans `CharacterWindow.jsx`, aux côtés de `activeTab`
  (`CharacterWindow.jsx:182`) — nouveau `const [modingOpen, setModingOpen] = useState(false)`
- `InventoryPanel.jsx` reçoit une nouvelle prop `onOpenModing` (callback), affiche le bouton
  "Customisation" (à côté du bouton "Ajouter" existant, `InventoryPanel.jsx:259`), appelle
  `onOpenModing()` au clic
- `CharacterWindow.jsx` rend conditionnellement `<ModingWindow characterId={character.id}
  onClose={() => setModingOpen(false)} />` en sibling. Convention CSS du projet (jamais de `zIndex`
  visuel inline, `.claude/rules/react.md`) : nouvelle classe `.moding-window` dans `index.css`
  (Section 10/11), `z-index: 9100` (au-dessus des 9000 de `CharacterWindow.jsx:547`, seule valeur
  supérieure existante trouvée dans le code client — voir vérification ci-dessous).

**Rafraîchissement temps réel — mécanisme exact identifié.** `client/src/lib/useCharacterSocket.js:
36-44` écoute déjà `WS.INVENTORY_ADDED/UPDATED/REMOVED` et incrémente un compteur par personnage
(`woundVersions`, nom trompeur — sert aussi à l'inventaire) qui remonte jusqu'à
`CharacterWindow.jsx:170-180` (`bumpInventoryVersion`) et force `InventoryPanel`/`WeaponPanel`/
`ArmorWoundPanel` à se recharger. **`WS.MOD_INSTALLED` doit être ajouté à ce même hook** (nouveau
`onModInstalled` suivant exactement le pattern des 3 handlers `onInventory*` existants,
lignes 36-44 + `socket.on`/`socket.off` lignes 49-59) — sinon l'event est émis côté serveur mais
personne ne l'écoute côté client, et l'UI ne se rafraîchit jamais après une installation.

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

// 2. Anti-doublon — check applicatif en pré-vol (évite un aller-retour DB raté dans le cas
//    normal), PAS la vraie garde — voir contrainte UNIQUE (3) qui protège la vraie course
const alreadyInstalled = await db('char_inventory_mods')
  .where({ weapon_inv_id: weaponInvId, equipment_id: mod.equipment_id }).first()
if (alreadyInstalled) throw new AppError(409, 'Ce mod est déjà installé sur cette arme')

// 3. Transaction atomique — consommer 1 unité du mod, PAS un DELETE inconditionnel
//    (correction 2026-07-09 : mod.quantity peut être > 1 si stack — voir P7)
//    La vraie garde anti-doublon est ici : UNIQUE(weapon_inv_id, equipment_id) sur
//    char_inventory_mods (ajouté 2026-07-12) — le check (2) seul laisse une fenêtre de course
//    entre deux requêtes concurrentes (ex. mod en stack ×2+, les deux passent le SELECT avant
//    que la première ne commite). L'INSERT ci-dessous peut donc lever une violation de
//    contrainte même après un check (2) positif — attrapée et traduite en 409 identique.
let removeResult, state
try {
  ;({ removeResult, state } = await db.transaction(async (trx) => {
    await trx('char_inventory_mods').insert({
      weapon_inv_id: weaponInvId,
      equipment_id: mod.equipment_id,
      mod_name: modRef.name,
    })
    // Réutilise inventoryService.removeItem(characterId, modInvId, 1) — même sémantique que
    // DELETE /:characterId/inventory/:itemId (char-sheet.js:1301-1318, décrément si quantity>1,
    // suppression de la ligne seulement si le stock retombe à 0). Fonctionne identiquement que
    // mod.quantity soit 1 ou plus, un seul code path.
    const removeResult = await inventoryService.removeItem(characterId, modInvId, 1, trx)
    const state = await getModingState(trx, characterId)
    return { removeResult, state }
  }))
} catch (err) {
  if (err.code === '23505') // unique_violation Postgres — course gagnée par une autre requête
    throw new AppError(409, 'Ce mod est déjà installé sur cette arme')
  throw err
}

// 4. Notifier la room — event conditionnel selon que le mod a été totalement retiré ou
//    juste décrémenté (pattern existant char-sheet.js — WOUND_*/INVENTORY_*/SOLS_*)
if (removeResult.deleted) {
  req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_REMOVED, {
    characterId, itemId: modInvId,
  })
} else {
  req.app.get('io').to(req.character.campaign_id).emit(WS.INVENTORY_UPDATED, {
    characterId, item: removeResult.item,
  })
}
req.app.get('io').to(req.character.campaign_id).emit(WS.MOD_INSTALLED, {
  characterId, weaponInvId, mods: state.weapons.find(w => w.id === weaponInvId)?.installed_mods,
})

return state
```

**`inventoryService.removeItem` — signature retenue** (Étape 0) : `removeItem(characterId, itemId,
qtyToRemove, trxOrDb)` → `{ deleted: boolean, item: object|null, itemId }`. Unifie les deux branches
de la route DELETE actuelle (qui retournent aujourd'hui des formes différentes,
`{item: updated}` vs `{deleted:true, itemId}`) sous une forme unique exploitable par les deux
appelants (route DELETE elle-même après refactor, et `modingService.installMod`).

**Vérifié 2026-07-12 (analyse critique)** : cette unification interne ne casse aucun contrat HTTP
externe — `InventoryPanel.jsx:87` (seul appelant de la route DELETE) ignore complètement la réponse
(`await api.delete(...)`, pas de lecture du body), le rafraîchissement passe uniquement par l'event
socket (`INVENTORY_REMOVED`/`UPDATED`). Aucun client ne dépend de la forme exacte du JSON retourné —
"Aucun changement d'API" (ligne 137-138 plus haut) confirmé, pas juste supposé.

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
| 0 | Extraction `inventoryService.js` depuis `char-sheet.js` (voir portée détaillée ci-dessus, y compris `removeItem` unifié — voir P7) + non-régression | — |
| 1 | Migration 124 — `char_inventory_mods` | — |
| 2 | `modingService.js` (`getModingState`/`installMod`), consomme `inventoryService.removeItem` (P7) | Étapes 0+1 |
| 3 | Ajout `WS.MOD_INSTALLED` dans `shared/events.js` | — |
| 4 | Routes `GET .../moding/state` + `POST .../moding/install` dans `char-sheet.js` (minces, émettent `INVENTORY_REMOVED`/`INVENTORY_UPDATED` selon P7 + `MOD_INSTALLED`) | Étapes 2+3 |
| 5 | `client/src/lib/useCharacterSocket.js` — handler `onModInstalled` (pattern lignes 36-44) | Étape 3 |
| 6 | Composant `ModingWindow.jsx` — liste armes + mods, fenêtre flottante (pattern `TradeWindow.jsx`) | Étape 4 |
| 7 | `CharacterWindow.jsx` (état `modingOpen`) + `InventoryPanel.jsx` (bouton "Customisation", prop `onOpenModing`) | Étape 6 |

---

## Pièges à anticiper

- **P1** : `char_inventory.equipment_id` peut être NULL (item custom) → exclure de la liste armes et
  mods installables (JOIN inner sur `ref_equipment`), rejet explicite dans `install` (voir logique
  serveur ci-dessus)
- **P2** : Un perso peut avoir plusieurs lignes `char_inventory` pour la même arme (`quantity` > 1) →
  identifier l'arme par `char_inventory.id`, pas `equipment_id`
- **P3** : Le retrait du mod de l'inventaire (via `inventoryService.removeItem`, voir P7 — décrément
  ou suppression selon le stock) doit être dans la même transaction que l'INSERT
  `char_inventory_mods` — sinon état incohérent (mod dupliqué en cas d'échec partiel)
- **P4** : ~~Vérifier les droits~~ **Résolu** — `router.param('characterId', ...)` de `char-sheet.js`
  couvre déjà owner/GM/membre de campagne pour toute route montée dans ce fichier. Aucune logique de
  garde supplémentaire à écrire.
- **P5** : `ref_equipment.family`/`.category` sont des `TEXT` sans contrainte CHECK (vérifié dans la
  migration 48) — comparaison exacte `=` suffit tant que les valeurs saisies restent cohérentes
  (vérifié 16/16 lignes actuelles conformes à `'Armes'`/`'Accessoires pour armes'` exact), mais rester
  vigilant si de nouvelles lignes sont saisies avec une casse différente
- **P6** : Anti-doublon Phase A = un même `equipment_id` ne peut pas être installé deux fois sur la
  même arme. **Ce n'est pas la règle complète du livre** (voir Hors scope — Phase B) — c'est une
  garde-fou minimal, pas une simulation des règles de jeu. **Garde-fou renforcé 2026-07-12** : la
  contrainte `UNIQUE(weapon_inv_id, equipment_id)` sur `char_inventory_mods` est la vraie protection
  (le SELECT applicatif seul laissait une fenêtre de course entre deux requêtes concurrentes,
  plausible avec un mod en stack ×2+, pas juste un double-clic) — voir logique serveur `install`
  corrigée ci-dessus.
- **P7** (trouvé 2026-07-09, en planification) : un mod peut être en stack (`char_inventory.quantity
  > 1` — ex. 2× "Visée laser" achetées, stackées par la route POST inventory existante). `install`
  ne doit **jamais** faire un `DELETE` inconditionnel sur `modInvId` — sinon toute la pile disparaît
  pour une seule installation. Doit passer par `inventoryService.removeItem(characterId, modInvId,
  1, trx)` (décrément d'une unité, suppression de la ligne seulement si le stock atteint 0) et
  émettre `INVENTORY_UPDATED` (pas `INVENTORY_REMOVED`) si la pile n'est pas épuisée — voir logique
  serveur corrigée ci-dessus.

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
- **2026-07-09 (suite 2)** — Saar : "on ne laisse rien au codage". Trois points encore ouverts
  fermés par lecture directe du code client (toujours aucun code écrit) : **(1) bug trouvé** — la
  logique `install` d'origine faisait un `DELETE` inconditionnel sur la ligne `char_inventory` du
  mod, incorrect si `quantity > 1` (stack) ; corrigé en réutilisant `inventoryService.removeItem`
  (décrément d'1 unité, même sémantique que la route DELETE existante) — nouveau piège **P7**.
  **(2) mécanisme d'ouverture `ModingWindow`** tranché en lisant `CharacterWindow.jsx`/
  `InventoryPanel.jsx` : fenêtre flottante (pattern `TradeWindow.jsx`, suffixe "Window" = flottant
  dans ce projet), état `modingOpen` dans `CharacterWindow.jsx`, bouton dans `InventoryPanel.jsx`
  via nouvelle prop `onOpenModing`. **(3) rafraîchissement temps réel** tracé jusqu'au mécanisme
  exact : `client/src/lib/useCharacterSocket.js:36-44` (déjà existant pour `INVENTORY_*`) doit
  gagner un handler `onModInstalled` suivant le même pattern, sans quoi `WS.MOD_INSTALLED` serait
  émis dans le vide côté client.
- **2026-07-12** — évaluation de reprise + analyse critique demandée par Saar (chantier toujours
  listé "en pause" dans `EN_COURS.md` malgré la clôture de Tir visé, Session 141 suite 17 — dette
  `TIRVISE` pas encore mise à jour, à faire au moment de lever la pause). **Dérive P53 reconfirmée** :
  migration 124 déjà consommée (124-135 tous pris depuis, prochain numéro libre 136 au 2026-07-12,
  à reconfirmer une fois de plus au codage) ; `char-sheet.js` passé de 1928 à 2133 lignes — les 6
  routes + 4 helpers ciblés par l'Étape 0 existent toujours, contigus, juste décalés (non
  re-numérotés dans ce document, à refaire au moment de coder). **Vérifié sans impact** : la
  migration parallèle `131_split_equippable_stacks` (dual-wield) ne touche aucun des 16 accessoires
  (`ref_equipment.location = NULL` pour tous, exclus du filtre de cette migration) — le piège P7
  (mods empilés) reste valide tel quel. **Analyse critique — 1 vrai gap trouvé et corrigé** : aucune
  contrainte DB sur l'anti-doublon `char_inventory_mods`, seulement un `SELECT` applicatif hors
  transaction (P6) — fenêtre de course réelle avec un mod en stack ×2+ (pas qu'un double-clic).
  Corrigé : `UNIQUE(weapon_inv_id, equipment_id)` ajoutée au schéma + logique `install` catch la
  violation de contrainte (`23505`) en 409, même précédent que `uq_char_mut_no_sub` (migration 109).
  **1 point vérifié et écarté** : contradiction apparente entre "Aucun changement d'API" et
  l'unification des deux formes de retour de la route DELETE — vérifié que `InventoryPanel.jsx:87`
  ignore la réponse HTTP (rafraîchissement 100% socket), aucun risque réel, note ajoutée au plan pour
  ne pas relaisser planer le doute. Aucun code écrit — session d'analyse pure.
- **2026-07-12 (suite, même session) — Phase A codée intégralement, 8/8 étapes.** Étape 0
  (extraction `inventoryService.js`) confirmée fonctionnelle par Saar avant de poursuivre (règle "un
  seul bug/étape à la fois", confirmation obligatoire). Étapes 1-7 enchaînées ensuite sur "go" Saar :
  migration `137` (136 pris entretemps par une session parallèle), `modingService.js`, event
  `WS.MOD_INSTALLED`, routes serveur, handler socket client, `ModingWindow.jsx`, wiring
  "Customisation". Écart trouvé en codant (corrigé, pas dans le plan initial) : le bouton
  "Customisation" est gaté par `canEdit` (owner OU GM), **pas** `isGm` seul comme le bloc "Ajouter"
  d'à côté — un joueur doit pouvoir installer un mod sur sa propre arme. Testé à 3 niveaux (service,
  HTTP réel, navigateur réel via Playwright avec capture d'écran) — voir `docs/JOURNAL6.md`
  "Session 141 (suite 21)" pour le détail complet des scénarios. Chantier Phase A clos.
