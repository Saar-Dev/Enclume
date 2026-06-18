# ARCHI_REWORK.md — Reworks architecturaux
> Créé Session 96 — 2026-06-16 | Mis à jour Session 108 — 2026-06-18
> Rédigé par Claude Sonnet 4.6 à destination des agents Claude futurs.
> Objectif : remplacer le bricolage incrémental par des reworks structurés, complets, et non régressifs.
> Spécifications complètes des reworks achevés → [ARCHI_REWORK_DONE.md](ARCHI_REWORK_DONE.md)

---

## Philosophie

Un **rework** n'est pas un correctif. C'est le remplacement complet d'un bloc fonctionnel par une implémentation propre, indépendante, et testable en isolation. Le reste du codebase n'apprend pas comment le bloc fonctionne — il l'appelle avec une interface minimale.

**Règle absolue pendant un rework :** le périmètre est figé dès la phase de planification. Aucune amélioration opportuniste. Aucun bug adjacent corrigé en passant. Un rework = un bloc = une PR.

**Déclencheurs légitimes d'un rework :**
- Le même bloc de code est dupliqué N ≥ 3 fois
- Un bug dans un flux bloque un flux logiquement indépendant (couplage accidentel)
- L'implémentation actuelle empêche d'ajouter une fonctionnalité sans risque de régression
- Le bloc est impossible à tester sans déclencher des effets de bord dans d'autres systèmes

---

## Conventions des modules de service

Toutes les fonctions exportées par un service respectent ces conventions sans exception.

**Signature standard :**
```js
async function verbNoun(io, db, campaignId, pendingMap, params)
// io          — instance Socket.io server (pour les broadcasts)
// db          — instance Knex (pour les queries)
// campaignId  — UUID string (scope de la room)
// pendingMap  — Map globale du handler concerné (passée par référence depuis index.js)
//               null si la fonction n'a pas besoin de pending state
// params      — objet destructuré, jamais de paramètres positionnels au-delà de 4
```

**Règles de retour :**
- Fonctions pures (calcul) → retournent un objet de résultat ou `null`
- Fonctions à effets (DB + WS) → retournent `void`, tous les effets passent par `io` et `db`
- Jamais de `throw` non catchée — les erreurs sont loggées et absorbées dans les fonctions à effets

**Règle protocole (interopérabilité multi-client) :**
Chaque `io.emit` ou `socket.emit` produit un payload documenté dans ce fichier. Aucun event n'est émis sans documentation de son payload. `shared/events.js` est le registre de tous les events — tout event non listé là n'existe pas.

**Règle types d'entité :**
Chaque module documente quels types d'entité il supporte : `humanoïde` / `drone` / `exo-armure (futur)`. Si un type n'est pas supporté, le module retourne `null` silencieusement (jamais d'erreur).
Source règle drone : MANUELSYSCOMBAT.md §7.6 — "Pas de Test de Choc. Pas de blessures résiduelles." → `statusService.applyStun` n'est jamais appelé pour un drone.

---

## Template obligatoire

Chaque rework ajouté à ce fichier respecte cette structure. Pas de section manquante.

```
### REWORK-XX — Titre court

**Problème** : description factuelle + preuves (fichier:ligne)
**État actuel** : localisation exacte du code existant
**Décision** : quelle architecture, pourquoi, alternatives écartées
**Interface cible** : signatures exactes des fonctions publiques
**Périmètre** : fichiers touchés / fichiers NON touchés (les deux)
**Plan** : étapes ordonnées, une par une, avec run à vide entre chaque
**Validation** : scénarios de test avec résultat attendu précis
**Definition of done** : checklist explicite — case à cocher
```

---

## Reworks achevés

> Specs complètes → [ARCHI_REWORK_DONE.md](ARCHI_REWORK_DONE.md)

**REWORK-01 ✅ Clos Session 96 — statusService (étourdissement)**
`server/src/lib/statusService.js` : `resolveShockTest` (pur D20, zéro DB) + `applyStun` (PJ → prompt interactif, PNJ → D6 auto). Découple le stun du flux dégâts — `COMBAT_DAMAGE_RESULT` n'est plus bloqué.

**REWORK-02 ✅ Clos Session 101 — damageService (résolution hit)**
`server/src/lib/damageService.js` : `resolveTargetHit` — loc+armure+résistance+sévérité+blessure+shock. 4 sites patché. `LOC_TABLE` déplacée dans `shared/armorConstants.js`. `resolveMeleeAction` (site 3) exclu définitivement.

**REWORK-03 ✅ Clos partiel Session 97 — woundService**
`server/src/lib/woundService.js` : `applyWound` centralisée — 5 call sites WS + fix `worst_wound_severity` dans WOUND_ADDED. Non testé : CaC PNJ auto / promotion cascade / ligne pleine / REST GM. Spec dans JOURNAL4.md Session 97.

**REWORK-05 ✅ Clos complet Session 99 — Panneaux d'action partagés**
`AssaultRangedPanel.jsx` + `MeleeCombatPanel.jsx` + `DroneWeaponPanel.jsx` + `DeclareLogContent`. `computeFireVariant` dans `combatSections.js`. Fix COM5 + CL2. P7 (tooltip `state_weapon`) → REWORK-06.

**REWORK-07 ✅ Clos complet Session 100 — socketUtils**
`server/src/lib/socketUtils.js` : `getUserColor` (6 sites) + `checkTokenOwnership` (4 sites) + suppression `LOC_TABLE_CONTACT`.

---

## Prochains reworks

| ID | Bloc | Problème | Ordre |
|---|---|---|---|
| **REWORK-09** | `SessionPage.jsx` → hooks WS dédiés | 1 509 lignes. 47 listeners WS dans un `useEffect` unique (340 lignes). 39 props vers CombatOverlay (2 mortes). | **✅ Clos Session 103** |
| **REWORK-08** | Modularisation `socket/index.js` | 4 266 lignes — fichier dieu. Découper en `socketToken.js`, `socketVoxel.js`, `socketEntity.js`, `socketCombat.js`, `socketDice.js` + `lib/mrTable.js`. `initSocket()` devient coordinateur. **Prérequis de REWORK-04.** | **En cours — Session 105** |
| **REWORK-06** | `combatDeclarationStore` | Staging state déclaration fragmenté en local React state (GM+Joueur). Auto-draw, default mains nues non implémentables sans débat archi. Voir REWORK-05.md §REWORK-06 | Sprint futur |
| **REWORK-04** | Système de combat complet | Migration vers State Machine (FSM) — sprint long terme. **Prérequis : REWORK-08** | Long terme |

---

## REWORK-08 — Modularisation socket/index.js

> **Agent futur — lire en entier avant de toucher le moindre fichier.**
> Protocole d'exécution par étape :
> 1. Lire le spec de l'étape (ci-dessous) + les lignes source indiquées dans `server/src/socket/index.js`
> 2. Créer le nouveau fichier
> 3. `node --check <nouveau_fichier>` → 0 erreur
> 4. Modifier `index.js` (suppression + import + appel dans SESSION_JOIN)
> 5. `node --check server/src/socket/index.js` → 0 erreur
> 6. SR sans erreur → tester le scénario de l'étape
> 7. Confirmation fonctionnelle → étape suivante
>
> Jamais deux étapes dans le même commit. Un SR après chaque étape sans exception.

### Problème

`server/src/socket/index.js` : **4 266 lignes**. Fichier dieu.

Un seul fichier contient : la logique de connexion/authentification, 4 groupes de handlers indépendants (TOKEN / VOXEL+MAP / DICE+CHAT / ENTITY), 13 handlers COMBAT, 6 helpers de phase combat, et 4 fonctions de résolution longues (~1 600 lignes cumulées). Toute modification — même un handler TOKEN de 30 lignes — expose 4 200 lignes de contexte à la régression.

**Preuves (socket/index.js) :**
- L.1–134 : preamble — imports, 6 Maps globaux singletons, constantes de modificateurs, tables de labels
- L.146–229 : SESSION_JOIN — établit `campaignId`, `user`, `isGm` via closure lazy
- L.232–360 : 4 handlers TOKEN_*
- L.364–513 : 5 handlers VOXEL_* + MAP_SWITCH + MAP_VIEWPORT
- L.518–749 : DICE_ROLL + MACRO_ROLL + CHAT_MESSAGE + CHARACTER_UPDATED
- L.753–1458 : 7 handlers ENTITY_*
- L.1464–2731 : 13 handlers COMBAT_* + disconnect
- L.2746–3029 : `resolveEntityState` + 5 helpers de phase (`startAnnouncementTimers`, `skipPlayer`, `startResolutionPhase`, `advanceSlot`, `endTurn`)
- L.3033–4266 : `resolveMeleeAction` (~490L) + `resolveReloadAction` (~130L) + `resolveDroneAssaultAction` (~255L) + `resolveAssaultAction` (~300L) + `calcDroneRD` + `resolveDroneIntegrityLoss`

**Prérequis de REWORK-04** (FSM combat) : impossible de refactorer la FSM dans un fichier de 4 200 lignes.

### État actuel

```
server/src/socket/
  index.js          — 4 266 lignes (tout)
  auth.js           — middleware auth WS (non touché)
```

6 Maps singletons déclarées hors `initSocket` (partagées inter-connexions) :
- `pendingEntityActions` — exclusif ENTITY handlers
- `pendingDamageActions`, `pendingMeleeDefense`, `pendingStunActions` — exclusifs COMBAT handlers
- `combatTimers`, `combatPreviews` — exclusifs COMBAT handlers

Cache MR_TABLE (`getMrTable`) utilisé dans **5 call sites** répartis sur deux modules futurs :
- `socketEntity.js` : ENTITY_MOVE_REQUEST (L.1242) — 1 appel
- `socketCombat.js` : COMBAT_DAMAGE_CONFIRM (L.2343) + resolveDroneAssaultAction (L.3792, L.3826) + resolveAssaultAction (L.4124) — 4 appels

→ Extraction obligatoire dans `lib/mrTable.js` avant les Étapes 5 et 6.

### Décision architecturale

**Pattern `registerXxxHandlers(io, socket, context[, pendingMaps])`**

Chaque module exporte une fonction `register*` qui enregistre ses listeners sur `socket`. Ces fonctions sont appelées **à l'intérieur de SESSION_JOIN**, après que `campaignId`, `user`, `isGm` sont établis.

```js
// index.js après rework — schéma SESSION_JOIN
socket.on(WS.SESSION_JOIN, async ({ campaignId: cId }) => {
  // ... validation + join room + broadcast SESSION_JOINED + combat sync
  // (reste inline — logique non déplaçable)

  const context = { campaignId, user, isGm }

  registerTokenHandlers(io, socket, context)
  registerVoxelHandlers(io, socket, context)
  registerDiceHandlers(io, socket, context)
  registerEntityHandlers(io, socket, context, pendingEntityActions)
  registerCombatHandlers(io, socket, context, {
    pendingDamageActions, pendingMeleeDefense, pendingStunActions,
    combatTimers, combatPreviews,
  })

  socket.on('disconnect', () => {
    console.log(`[WS] disconnect — user ${user.id} campaign ${campaignId}`)
  })
})
```

**Changement comportemental mineur :** les handlers sont désormais enregistrés **après** SESSION_JOIN (et non à la connexion brute). En pratique identique — aucun client n'émet un TOKEN_MOVE avant d'avoir rejoint la session. Tous les handlers guarded existants (`if (!campaignId)`) deviennent inutiles mais sont conservés tels quels (hors périmètre).

**Alternatives écartées :**
- Closure lazy (variables `let campaignId` + handlers à la connexion) → conserve le couplage, rend les modules impossibles à tester en isolation
- Contexte mutable `const ctx = {}` passé par référence → complexité accidentelle, source de bugs de timing
- Un module unique `socketHandlers.js` (tout regroupé) → ne résout pas le problème de taille

### Interface cible

```js
// ── server/src/socket/socketToken.js ────────────────────────────────────────
export function registerTokenHandlers(io, socket, { campaignId, user, isGm })
// Handlers : TOKEN_MOVE · TOKEN_ROTATE · TOKEN_SET_ROTATION · TOKEN_STATUS_TOGGLE
// Imports requis : WS, db, checkTokenOwnership, collisionMoveToken (redis), statusService

// ── server/src/socket/socketVoxel.js ────────────────────────────────────────
export function registerVoxelHandlers(io, socket, { campaignId, user, isGm })
// Handlers : VOXEL_ADD · VOXEL_REMOVE · VOXEL_UPDATE · MAP_SWITCH · MAP_VIEWPORT
// Imports requis : WS, db, collisionAddVoxel, collisionRemoveVoxel (redis)
// NOTE : buildCollisionMap reste dans index.js SESSION_JOIN (L.198) — ne pas importer ici

// ── server/src/socket/socketDice.js ─────────────────────────────────────────
export function registerDiceHandlers(io, socket, { campaignId, user, isGm })
// Handlers : DICE_ROLL · MACRO_ROLL · CHAT_MESSAGE · CHARACTER_UPDATED
// Imports requis : WS, db, parseDice, getUserColor,
//   charStats (calcSkillTotal, calcAttributeAN/NA, calcSeuils, calcWoundPenalty,
//   calcEncumbrancePenalty, calcResistanceDroguesInput, ATTR_LABELS, lookupTable…)
// NOTE : PORTEE_MOD_COMP · SITUATION_MODS · TAILLE_MODS · *_LABELS · COMBAT_MODE_LABELS
//   → NON utilisées dans ce module (grep confirmé) → vont dans socketCombat.js

// ── server/src/socket/socketEntity.js ───────────────────────────────────────
export function registerEntityHandlers(io, socket, { campaignId, user, isGm }, pendingEntityActions)
// Handlers : ENTITY_ACTION_REQUEST · ENTITY_ACTION_RESOLVE · ENTITY_ACTION_GM_DIRECT
//           ENTITY_CREATED · ENTITY_DELETED · ENTITY_MOVED · ENTITY_MOVE_REQUEST
// Helper interne : resolveEntityState (non exporté) — 5 call sites dans les handlers
// Imports requis : WS, db, parseDice, getUserColor, getMrTable, getModifier (lib/mrTable.js),
//   charStats (calcSkillTotal, calcAttributeAN, calcAttributeNA, calcWoundPenalty,
//   calcEncumbrancePenalty, ATTR_LABELS),
//   redis (isCaseOccupied, collisionMoveToken, collisionMoveEntity, collisionUpdateEntityState)
// NON importés (0 usage dans L.753–1458) : collisionAddEntity, collisionRemoveEntity, woundService

// ── server/src/socket/socketCombat.js ───────────────────────────────────────
export function registerCombatHandlers(io, socket, { campaignId, user, isGm },
  { pendingDamageActions, pendingMeleeDefense, pendingStunActions, combatTimers, combatPreviews })
// Handlers : COMBAT_START · COMBAT_END · COMBAT_ANNOUNCE_START · COMBAT_INIT_STATE
//           COMBAT_SURPRISE_RESULT · COMBAT_ACTION_DECLARE · COMBAT_SKIP_PLAYER
//           COMBAT_ANNOUNCE_PREVIEW · COMBAT_ACTION_CONFIRM · COMBAT_DAMAGE_CONFIRM
//           COMBAT_MELEE_DEFENSE_CONFIRM · COMBAT_STUN_CONFIRM · COMBAT_APPLY_STUN
// Helpers internes (non exportés) : startAnnouncementTimers · skipPlayer
//   startResolutionPhase · advanceSlot · endTurn · multiAdversaryMalus · countAdversaires
//   resolveMeleeAction · resolveReloadAction · resolveDroneAssaultAction · resolveAssaultAction
//   calcDroneRD · resolveDroneIntegrityLoss
// Imports requis : WS, db, getMrTable (lib/mrTable.js), charStats, getUserColor,
//   checkTokenOwnership, woundService, statusService, damageService,
//   armorConstants, woundConstants
// Constantes déplacées depuis index.js (8 usages confirmés, 0 dans socketDice) :
//   PORTEE_MOD_COMP · SITUATION_MODS · TAILLE_MODS · SITUATION_LABELS
//   PORTEE_LABELS · TAILLE_LABELS · COMBAT_MODE_LABELS

// ── server/src/lib/mrTable.js ────────────────────────────────────────────────
// Implémentation complète (18 lignes) — copier telle quelle :
import db from '../db/knex.js'

// Singleton-promise pattern : cache la promesse, pas le résultat.
// Garantit un seul appel DB même sous concurrence (deux handlers simultanés
// voient la même promesse en cours de résolution).
// ⚠️ .then(r => r) obligatoire — convertit le QueryBuilder Knex en Promise native.
// Sans ce call, chaque await re-exécute une requête SQL (QueryBuilder Knex non réentrant).
let mrTablePromise = null
export function getMrTable() {
  if (!mrTablePromise)
    mrTablePromise = db('polaris_mr').orderBy('mr_min').then(r => r)
  return mrTablePromise
}

// Source de vérité : LdB Polaris p.209 — migration 46.
// Format DB : [{ mr_min, mr_max, modifier }]  ← "modifier", pas "dmax"
// dmax = isSuccess ? modifier + 1 : 0  — calculé dans le handler appelant.
export function getModifier(mrTable, mr) {
  const row = mrTable.find(r =>
    mr >= r.mr_min && (r.mr_max === null || mr <= r.mr_max)
  )
  return row?.modifier ?? 0
}
```

### Périmètre

**Nouveaux fichiers :**
- `server/src/socket/socketToken.js`
- `server/src/socket/socketVoxel.js`
- `server/src/socket/socketDice.js`
- `server/src/socket/socketEntity.js`
- `server/src/socket/socketCombat.js`
- `server/src/lib/mrTable.js`

**Fichiers modifiés :**
- `server/src/socket/index.js` → coordinateur uniquement (~120 lignes) :
  - Conserver : imports globaux, 6 Maps singletons, `initSocket`, SESSION_JOIN inline
  - Supprimer : tout le reste (handlers + helpers + resolve*)
  - Ajouter : imports des 5 `register*` + leurs appels dans SESSION_JOIN

**NON touchés :**
- `server/src/socket/auth.js`
- `server/src/lib/charStats.js`
- `server/src/lib/woundService.js`
- `server/src/lib/statusService.js`
- `server/src/lib/damageService.js`
- `server/src/lib/socketUtils.js`
- `server/src/lib/redis.js`
- `shared/` (events.js, armorConstants.js, woundConstants.js)
- `client/` (aucune modification)
- DB / migrations

### Plan

**Étape 1 — `lib/mrTable.js`**
- Créer `server/src/lib/mrTable.js` avec le contenu exact de l'**Interface cible** ci-dessus (singleton-promise, 2 exports)
- Différences vs. code source (L.65–82 index.js) :
  - `let MR_TABLE` → `let mrTablePromise`
  - `MR_TABLE = await db('polaris_mr').orderBy('mr_min')` → `mrTablePromise = db('polaris_mr').orderBy('mr_min').then(r => r)` — `.then(r => r)` convertit le QueryBuilder Knex en Promise native cachée. Sans ce call, chaque `await` re-exécute la requête (QueryBuilder Knex non réentrant).
  - Commentaire `"Format : [{ mr_min, mr_max, dmax }]"` → corrigé en `modifier` (bug commentaire)
  - `async function getMrTable()` → `export function getMrTable()` (sans `async` — retourne la Promise directement, plus d'`await` interne)
  - `function getModifier` → `export function getModifier`
- `node --check server/src/lib/mrTable.js` → 0 erreur
- Dans `index.js` :
  - Supprimer L.65–82 (`let MR_TABLE`, `getMrTable`, `getModifier`)
  - Ajouter en tête des imports : `import { getMrTable, getModifier } from '../lib/mrTable.js'`
- `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — tester : déplacer une entité (ENTITY_MOVE_REQUEST) + lancer un assaut CaC (les 5 call sites de getMrTable doivent fonctionner)

**Étape 2 — `socketToken.js`**
- Créer `server/src/socket/socketToken.js` avec `registerTokenHandlers` (L.232–360 → ~130 lignes)
- Imports exacts (vérifiés L.232–360) : `WS`, `db`, `checkTokenOwnership`, `collisionMoveToken` (redis), `statusService`
- Substitutions obligatoires dans les handlers migrés [R8-7] :
  | index.js (source) | socketToken.js (cible) |
  |---|---|
  | `socket.campaignId` | `campaignId` |
  | `socket.user.id` | `user.id` |
  | `socket.data.userId` | `user.id` |
  | `socket.role` (pour checkTokenOwnership) | `isGm ? 'gm' : 'player'` |
  | `io.to(socket.campaignId)` | `io.to(campaignId)` |
- Dans `index.js` — ajouter **à l'intérieur** de SESSION_JOIN, après le `catch` combat sync (L.220), avant le `console.log` (L.222) :
  ```js
  const context = { campaignId, user: socket.user, isGm: socket.role === 'gm' }
  registerTokenHandlers(io, socket, context)
  ```
  `context` est déclaré une seule fois — les Étapes 3–6 ajoutent uniquement `registerXxxHandlers(io, socket, context)` sans re-déclarer.
- Supprimer L.229–360 (4 handlers + commentaire dead code L.357–360)
- `node --check server/src/socket/socketToken.js` + `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — scénario : drag token, rotation token, toggle statut

**Étape 3 — `socketVoxel.js`**
- Créer `server/src/socket/socketVoxel.js` avec `registerVoxelHandlers` (L.364–513 → ~150 lignes)
- Imports exacts (vérifiés L.364–511) : `WS`, `db`, `collisionAddVoxel`, `collisionRemoveVoxel` (redis)
- Substitutions obligatoires [R8-9] :
  | index.js (source) | socketVoxel.js (cible) |
  |---|---|
  | `socket.role !== 'gm'` | `!isGm` (×5 guards — VOXEL_ADD/REMOVE/UPDATE/MAP_SWITCH/MAP_VIEWPORT) |
  | `io.to(socket.campaignId)` | `io.to(campaignId)` (×4 : VOXEL_ADD, VOXEL_REMOVE, VOXEL_UPDATE, MAP_SWITCH broadcast) |
  | `socket.to(socket.campaignId)` | `socket.to(campaignId)` ← MAP_VIEWPORT uniquement [R8-9] |
  - ⚠️ MAP_SWITCH contient **3 occurrences** de `socket.campaignId` — dont 2 dans des requêtes DB (pas de `io.to`) :
    - L.480 : `.where({ campaign_id: socket.campaignId, role: 'player' })` → `campaign_id: campaignId`
    - L.489 : `campaign_id: socket.campaignId,` (insert player_locations) → `campaign_id: campaignId`
    - L.498 : `io.to(socket.campaignId).emit(...)` → `io.to(campaignId)`
    Manquer L.480 ou L.489 → `campaign_id: undefined` → liste joueurs vide, MAP_SWITCH silencieusement inopérant
- Dans `index.js` — ajouter après `registerTokenHandlers(io, socket, context)` (context déjà déclaré) :
  ```js
  registerVoxelHandlers(io, socket, context)
  ```
- Supprimer L.361–511 (5 handlers : VOXEL_ADD, VOXEL_REMOVE, VOXEL_UPDATE, MAP_SWITCH, MAP_VIEWPORT)
- `node --check server/src/socket/socketVoxel.js` + `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — scénario : ajouter voxel (GM), supprimer voxel (GM), rotation voxel (VOXEL_UPDATE), MAP_SWITCH, MAP_VIEWPORT (pan caméra GM → joueurs suivent)

**Étape 4 — `socketDice.js`**
- Créer `server/src/socket/socketDice.js` avec `registerDiceHandlers` (4 handlers : DICE_ROLL, MACRO_ROLL, CHAT_MESSAGE, CHARACTER_UPDATED → ~232 lignes)
- Imports exacts (grep confirmé L.518–748 — [R8-6] résolu) :
  ```js
  import { WS } from '../../../shared/events.js'
  import db from '../db/knex.js'
  import { parseDice } from '../lib/diceParser.js'
  import { getUserColor } from '../lib/socketUtils.js'
  import {
    calcSkillTotal, calcAttributeNA, calcREA,
    calcSeuils, calcSouffle, calcResistanceDroguesInput,
  } from '../lib/charStats.js'
  ```
- Substitutions obligatoires [R8-12] :
  | index.js (source) | socketDice.js (cible) | Occurrences |
  |---|---|---|
  | `socket.campaignId` | `campaignId` | ×10 (DICE ×4, MACRO ×3, CHAT ×2, CHAR ×1) |
  | `socket.user.id` | `user.id` | ×6 (DICE ×2, MACRO ×2, CHAT ×2) |
  | `socket.user.username` | `user.username` | ×5 (DICE ×3, MACRO ×1, CHAT ×1) |
  | `socket.role !== 'gm'` | `!isGm` | ×4 (DICE ×1, MACRO ×2, CHAR ×1) |
  | `io.to(socket.campaignId)` | `io.to(campaignId)` | ×4 (DICE, MACRO, CHAT, CHAR) |
  | `io.in(socket.campaignId)` | `io.in(campaignId)` | ×2 (DICE secret, MACRO secret) |
- Les constantes `PORTEE_MOD_COMP` / `SITUATION_MODS` / `TAILLE_MODS` / LABELS / `COMBAT_MODE_LABELS` restent dans `index.js` — elles migrent à l'Étape 6 (0 usage dans DICE/MACRO/CHAT/CHARACTER_UPDATED) [R8-6]
- Dans `index.js` : ajouter `import { registerDiceHandlers } from './socketDice.js'` en tête + `registerDiceHandlers(io, socket, context)` après `registerVoxelHandlers` dans SESSION_JOIN + localiser par event name et supprimer les 4 `socket.on(WS.DICE_ROLL`, `WS.MACRO_ROLL`, `WS.CHAT_MESSAGE`, `WS.CHARACTER_UPDATED` ([R8-8])
- `node --check server/src/socket/socketDice.js` + `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — scénario : jet de dé simple, macro, message chat

**Étape 5 — `socketEntity.js`**
- Créer `server/src/socket/socketEntity.js` avec `registerEntityHandlers` (7 handlers : ENTITY_ACTION_REQUEST, ENTITY_ACTION_RESOLVE, ENTITY_ACTION_GM_DIRECT, ENTITY_CREATED, ENTITY_DELETED, ENTITY_MOVED, ENTITY_MOVE_REQUEST → L.753–1457 source + `resolveEntityState` helper → L.2750–2781 → ~760 lignes)
- Inclure `resolveEntityState` comme helper interne (non exporté) — dans la source, déclarée après `export default initSocket` (L.2750), hors closure. Dans `socketEntity.js` : module-level function, déclarée **avant** `registerEntityHandlers`. Signature inchangée : `async function resolveEntityState(entityId, interactionId, campaignId, io)` — `io` reste un paramètre explicite, utilise `db` et `collisionUpdateEntityState` depuis les imports du module.
- 5 call sites de `resolveEntityState` — répartition :
  - `socket.campaignId` → `campaignId` (×2) : ENTITY_ACTION_REQUEST L.792 + ENTITY_ACTION_GM_DIRECT L.1028
  - `pending.campaignId` inchangé (×3) : ENTITY_ACTION_RESOLVE L.893 (autoSuccess) + L.899 (!skillId) + L.1010 (isSuccess) — **[R8-15]**
- Imports exacts (grep confirmé L.753–1457 + L.2750–2781 — [R8-14]) :
  ```js
  import { WS } from '../../../shared/events.js'
  import db from '../db/knex.js'
  import { parseDice } from '../lib/diceParser.js'
  import { getUserColor } from '../lib/socketUtils.js'
  import { getMrTable, getModifier } from '../lib/mrTable.js'
  import {
    calcSkillTotal, calcAttributeAN, calcAttributeNA,
    calcWoundPenalty, calcEncumbrancePenalty,
    ATTR_LABELS,
  } from '../lib/charStats.js'
  import {
    isCaseOccupied,
    collisionMoveToken,
    collisionMoveEntity,
    collisionUpdateEntityState,
  } from '../lib/redis.js'
  ```
- Substitutions obligatoires [R8-14] :
  | index.js (source) | socketEntity.js (cible) | Occurrences |
  |---|---|---|
  | `socket.campaignId` | `campaignId` | ×14 (guards ×4, resolveEntityState args ×2, pendingSet ×1, io.in ×2, io.to ×5) |
  | `socket.user.id` | `user.id` | ×5 (ownership ×2, getUserColor ×1, payload ×1, pendingSet ×1) |
  | `socket.user.username` | `user.username` | ×5 (console ×3, payload ×1, pendingSet ×1) |
  | `socket.role !== 'gm'` | `!isGm` | ×5 (ACTION_RESOLVE, GM_DIRECT, CREATED, DELETED, MOVED) |
  | `io.to(socket.campaignId)` | `io.to(campaignId)` | ×5 (DELETED, MOVED, MOVE_REQUEST ×3) |
  | `io.in(socket.campaignId)` | `io.in(campaignId)` | ×2 (ACTION_REQUEST fetchSockets, CREATED fetchSockets) |
- ⚠️ **[R8-15]** `resolveEntityState` dans ENTITY_ACTION_RESOLVE — 3 call sites (L.893, L.899, L.1010) passent `pending.campaignId`, **pas** `socket.campaignId`. Ces 3 appels ne figurent **pas** dans la table ×14 ci-dessus. Ne pas substituer : `pending.campaignId` est stocké dans la Map lors de la demande initiale (L.831), potentiellement depuis une connexion différente du GM qui résout. Confondre → ENTITY_UPDATED broadcast dans la mauvaise room, silencieux.
- ⚠️ `io.to(pending.campaignId)` (L.881, L.988) et `io.in(pending.campaignId)` (L.865) dans ENTITY_ACTION_RESOLVE — même raison que [R8-15]. Ne pas substituer.
- ⚠️ `socket.id` (L.819, `playerSocketId: socket.id`) — identifiant de connexion socket.io, **distinct** de `socket.user.id`. Ne **pas** substituer par `user.id`. Reste `socket.id` tel quel — utilisé à L.866 pour retrouver le socket client par son ID de connexion.
- ⚠️ `ENTITY_CREATED` — ne pas "uniformiser" avec `io.to(campaignId).emit()`. Ce handler utilise `io.in(campaignId).fetchSockets()` + boucle individuelle + `s.emit()` pour filtrer les entités `gm_only`. Remplacer par un broadcast global casse silencieusement ce filtre — les entités GM-only apparaissent chez tous les joueurs sans erreur console.
- ⚠️ `socket.emit(WS.ENTITY_MOVE_RESULT, ...)` dans ENTITY_MOVE_REQUEST — 3 occurrences (L.1288, L.1365, L.1435). Bare `socket.emit()` sans campaignId — envoi au joueur demandeur uniquement. Ne pas substituer, ne pas "uniformiser" avec `io.to()`.
- Dans `index.js` : ajouter `import { registerEntityHandlers } from './socketEntity.js'` en tête + `registerEntityHandlers(io, socket, context, pendingEntityActions)` après `registerDiceHandlers` dans SESSION_JOIN + localiser par event name et supprimer les 7 `socket.on(WS.ENTITY_*` ([R8-8]) + supprimer `resolveEntityState` (L.2750–2781)
- `node --check server/src/socket/socketEntity.js` + `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — scénarios : interaction entité avec jet (ENTITY_ACTION_REQUEST → ENTITY_ACTION_RESOLVE), GM direct (ENTITY_ACTION_GM_DIRECT), déplacement entité push/pull (ENTITY_MOVE_REQUEST step-by-step), ENTITY_CREATED/DELETED/MOVED

**Étape 6 — `socketCombat.js`**
- Créer `server/src/socket/socketCombat.js` avec `registerCombatHandlers` (L.1464–4266 → ~2 750 lignes)
- Inclure comme helpers internes (non exportés) : `startAnnouncementTimers`, `skipPlayer`, `startResolutionPhase`, `advanceSlot`, `endTurn`, `multiAdversaryMalus`, `countAdversaires`, `resolveMeleeAction`, `resolveReloadAction`, `resolveDroneAssaultAction`, `resolveAssaultAction`, `calcDroneRD`, `resolveDroneIntegrityLoss`
- Déplacer depuis `index.js` les constantes restantes (L.85–134) : `PORTEE_MOD_COMP`, `SITUATION_MODS`, `TAILLE_MODS`, `SITUATION_LABELS`, `PORTEE_LABELS`, `TAILLE_LABELS`, `COMBAT_MODE_LABELS` — 8 usages tous dans ce module (grep confirmé, 0 dans socketDice)
- Dans `index.js` : import + appel + suppression de tout ce qui reste (handlers + helpers + constantes L.85–134)
- `node --check` sur les 2 fichiers → 0 erreur
- SR sans erreur

**Étape 7 — Finalisation `index.js` coordinateur**
- Vérifier que `index.js` ne contient plus que : imports, 6 Maps singletons, `initSocket`, SESSION_JOIN inline, 5 appels `register*`, disconnect inline
- `npm run build` → 0 erreur Vite (côté client — vérifie que rien n'a changé)
- Compter les lignes : `wc -l server/src/socket/index.js` → doit être ≤ 150 lignes
- SR final sans erreur — scénarios complets

### Pièges documentés

- **[R8-2]** SESSION_JOIN (L.146–229) contient la logique `COMBAT_STATE_SYNC` reconnexion (L.205–229) — reste inline dans `index.js`, non migré.
- **[R8-3]** `socket.on('disconnect')` (L.2732–2744) — reste inline dans `index.js` à l'intérieur de SESSION_JOIN après les 5 appels `register*`. Contenu : `console.log` uniquement — déplacement sans risque. **Risque connu hors périmètre REWORK-08 :** les 6 Maps globales ne sont pas nettoyées au disconnect. Les Maps avec timeout auto-nettoyant (pendingEntityActions — 60s) sont tolérables. Les Maps combat sans timeout (pendingDamageActions, pendingMeleeDefense, pendingStunActions) fuient si un socket se déconnecte en milieu de résolution — bug Socket.IO documenté (#407, #3477). À adresser dans un sprint dédié post-REWORK-08 (ajouter cleanup ciblé par tokenId/campaignId dans ce handler).
- **[R8-4]** Les guards `if (!campaignId)` dans les handlers deviennent théoriquement inutiles (handlers enregistrés après SESSION_JOIN). Ne pas les supprimer dans ce rework — hors périmètre.
- **[R8-6]** `socketDice.js` — MACRO_ROLL (L.581–702) utilise une dizaine d'exports de `charStats.js`. Grep exhaustif obligatoire avant d'écrire les imports du module — oublier un export provoque une erreur runtime silencieuse (pas de `node --check` pour les imports manquants).
- **[R8-7]** `socketToken.js` — `checkTokenOwnership(db, token, userId, role)` attend une string `role`. Confirmé (socketUtils.js L.15 : `const isGm = role === 'gm'`). Passer `isGm ? 'gm' : 'player'` depuis le contexte. `socket.data.userId` et `socket.user.id` sont identiques (assignés L.163 de SESSION_JOIN) — `user.id` du contexte est correct pour les deux usages.
- **[R8-8]** Décalage numéros de ligne après chaque étape — les lignes L.364, L.518, L.753, L.1464 dans ce spec sont des guides basés sur le fichier source original (4 266 lignes). Après Étape 1 (-17L) et Étape 2 (-132L), ces numéros ne correspondent plus. Localiser les handlers par event name (`socket.on(WS.VOXEL_ADD,` etc.), jamais par numéro de ligne.
- **[R8-9]** `socketVoxel.js` — MAP_VIEWPORT (L.507–511) est **synchrone** (pas d'`async`/`try-catch`). Utilise `socket.to(campaignId)` (pas `io.to(campaignId)`) — intentionnel : le GM n'est pas destinataire de son propre viewport. Ne pas "uniformiser" avec les autres handlers.
- **[R8-10]** `socketVoxel.js` — `buildCollisionMap` listé dans l'Interface cible originale : **0 usage** dans les handlers voxel. Reste dans SESSION_JOIN (L.198 de index.js, non migré). Ne pas importer dans socketVoxel.js.
- **[R8-11]** Double enregistrement si SESSION_JOIN fire deux fois sur le même socket — chaque `registerXxxHandlers` appelé une deuxième fois enregistre les listeners en double → double DB write + double broadcast. En pratique impossible : le client React crée un nouveau socket à chaque reconnect (`s.disconnect()` dans le cleanup useEffect de SessionPage), donc chaque socket ne reçoit qu'un seul SESSION_JOIN. **Mitigation garantie côté client — ne pas ajouter de guard `socket.off()` dans ce rework (hors périmètre).** Documenter si un jour SessionPage change son pattern de reconnect.
- **[R8-12]** `socketDice.js` — Imports charStats : seuls 6 exports réellement utilisés dans L.518–748 (grep confirmé). `calcAttributeAN` **absent** malgré la mention "calcAttributeAN/NA" dans l'Interface cible — MACRO_ROLL n'utilise que `calcAttributeNA` (via `na(attrId)`). Les autres exports (`calcWoundPenalty`, `calcEncumbrancePenalty`, `ATTR_LABELS`, `lookupTable`, etc.) vont dans `socketCombat.js` uniquement. Importer uniquement les 6 listés en Étape 4.
- **[R8-13]** `socketDice.js` — `CHARACTER_UPDATED` est marqué "relique Chantier 1" (commentaire L.718 index.js). Migrer tel quel sans modifier ni supprimer — le nettoyage est hors périmètre de REWORK-08.
- **[R8-14]** `socketEntity.js` — 6 écarts vs. Interface cible originale (corrigés en Étape 5) :
  1. `getModifier` manquait — utilisé L.1243 (ENTITY_MOVE_REQUEST) en tandem avec `getMrTable`.
  2. `collisionAddEntity` / `collisionRemoveEntity` / `woundService` listés à tort — 0 usage dans L.753–1457 (routes REST uniquement). Ne pas importer.
  3. `collisionMoveToken` manquait — ENTITY_MOVE_REQUEST déplace acteur ET entité ensemble (L.1411).
  4. `isCaseOccupied` manquait — ×4 dans la boucle step-by-step de ENTITY_MOVE_REQUEST (L.1324, L.1335, L.1346, L.1351).
  5. `calcAttributeAN` (L.935, ENTITY_ACTION_RESOLVE) ET `calcAttributeNA` (L.1228, ENTITY_MOVE_REQUEST) — les deux variantes nécessaires. L'Interface cible ne détaillait pas les exports charStats.
  6. `ATTR_LABELS` — importé depuis `charStats.js`, ×6 usages dans les handlers ENTITY (libellés attributs breakdown). À ne pas confondre avec `SITUATION_LABELS`/`PORTEE_LABELS` (domaine combat → socketCombat.js).
- **[R8-15]** `resolveEntityState` — double origine de `campaignId` dans les 5 call sites. Les 2 call sites directs (ENTITY_ACTION_REQUEST L.792, ENTITY_ACTION_GM_DIRECT L.1028) passent `socket.campaignId` → à substituer par `campaignId`. Les 3 call sites dans ENTITY_ACTION_RESOLVE (L.893 autoSuccess, L.899 !skillId, L.1010 isSuccess) passent `pending.campaignId` — valeur stockée dans `pendingEntityActions` lors de la demande initiale (L.831), potentiellement depuis la connexion du joueur (différente de celle du GM qui résout). Ne **jamais** substituer `pending.campaignId` par `campaignId` — le broadcast ENTITY_UPDATED partirait dans la room du GM, pas celle de la campaign, en cas de divergence.

### Validation

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Drag token sur la carte | TOKEN_MOVED reçu → token se déplace en temps réel sur tous les clients |
| 2 | Ajouter un voxel (GM) | VOXEL_ADD → voxel visible sur tous les clients + collision map Redis mise à jour |
| 3 | GM change de carte | MAP_SWITCH → tous les joueurs voient la nouvelle carte |
| 4 | Jet de dé standard | DICE_ROLL → DICE_RESULT visible en chat sur tous les clients |
| 5 | Jet de macro | MACRO_ROLL → DICE_RESULT avec breakdown modificateurs correct |
| 6 | Interaction entité | ENTITY_ACTION_REQUEST → ENTITY_ACTION_RESULT → message chat + radial fermé |
| 7 | Déplacement entité (ENTITY_MOVE_REQUEST) | Jet 1d20 + calcul MR → ENTITY_MOVE_RESULT + animation step-by-step |
| 8 | GM démarre le combat | COMBAT_START → COMBAT_STARTED → mode combat activé GM + joueurs |
| 9 | Assaut tir résolu | COMBAT_DAMAGE_CONFIRM → COMBAT_DAMAGE_RESULT → blessure appliquée + WOUND_ADDED |
| 10 | Non-régression : session sans combat | Ouvrir session, chat, drag token, interaction entité, changement carte → 0 erreur console + 0 erreur serveur |

### Definition of done

- [ ] `node --check server/src/lib/mrTable.js` → 0 erreur
- [ ] `node --check server/src/socket/socketToken.js` → 0 erreur
- [ ] `node --check server/src/socket/socketVoxel.js` → 0 erreur
- [ ] `node --check server/src/socket/socketDice.js` → 0 erreur
- [ ] `node --check server/src/socket/socketEntity.js` → 0 erreur
- [ ] `node --check server/src/socket/socketCombat.js` → 0 erreur
- [ ] `node --check server/src/socket/index.js` → 0 erreur
- [ ] `npm run build` → 0 erreur Vite
- [ ] `wc -l server/src/socket/index.js` → ≤ 150 lignes
- [ ] SR sans erreur à chaque étape
- [ ] Scénarios 1–10 validés
- [ ] JOURNAL4.md appendé
- [ ] `ARCHI_REWORK_DONE.md` mis à jour avec la spec complète

---

## REWORK-09 — SessionPage hooks WS dédiés

### Problème

`client/src/pages/SessionPage.jsx` : **1 509 lignes**.

Le `useEffect` socket (L.402–741, **340 lignes**, deps `[campaignId, reconnectTrigger, loadSession]`) contient **47 listeners WS** répartis en 10 groupes sémantiques sans séparation. Le résultat : 12 `useState` déclarations pour l'état combat cohabitent avec le code UI/canvas/modal dans le même fichier.

**Preuves (SessionPage.jsx) :**
- L.402 `useEffect` socket — unique, couvre SESSION + TOKEN + CHAT + DICE + WOUND + INVENTORY + ENTITY + MAP + COMBAT + DOC
- L.639–723 : 10 listeners `COMBAT_*` complexes (STARTED, ENDED, STATE_SYNC, PHASE_CHANGED, ROSTER_UPDATED, SURPRISE_ROLL, ANNOUNCE_PREVIEW, ACTION_DECLARED, SLOT_ADVANCED, TURN_SKIPPED)
- L.1300–1344 : **39 props** passées à `CombatOverlay` (2 mortes : `tokens` non destructuré L.22 CombatOverlay, `announcementMarker` destructuré mais jamais consommé)

**Couplage accidentel :** ajouter un listener combat nécessite de lire 340 lignes de useEffect pour trouver le bon endroit, et risque d'affecter les 46 autres listeners.

### État actuel

**`client/src/pages/SessionPage.jsx` :**
- Listeners TOKEN (5) : L.431–447
- Listeners ENTITY + MAP_SWITCH (4) : L.571–636
- Listeners COMBAT (18) : L.517–546 + L.639–723
- Listeners SESSION/CHAT/DICE/WOUND/INVENTORY/DOC/ERROR/RECONNECT (20) : reste du useEffect
- Cleanup : `return () => s.disconnect()` — pas de `s.off()` granulaires

**Convention hooks existante :** `client/src/lib/` (cf. `useDraggable.js` — pas de dossier `hooks/` dédié).

### Décision architecturale

**Option retenue : pattern `listen(s)` impératif**

Chaque hook expose une méthode `listen(socket)` appelée de manière **impérative** dans le `useEffect` de SessionPage, sur l'instance `s` avant `setSocket(s)`. Le hook gère son propre état (useState) et lit les actions de store directement depuis les stores Zustand.

```js
// Après rework — SessionPage useEffect
useEffect(() => {
  const s = io(...)
  s.emit(WS.SESSION_JOIN, { campaignId })

  tokenSocket.listen(s)    // enregistre TOKEN_*
  entitySocket.listen(s)   // enregistre ENTITY_* + MAP_SWITCH
  combatSocket.listen(s)   // enregistre COMBAT_*

  // ~20 listeners simples restants inline
  // SESSION_JOINED, SESSION_USER_JOINED, SESSION_USER_LEFT,
  // CAMPAIGN_SETTINGS_UPDATED, CHAT_MESSAGE, CHARACTER_UPDATED,
  // DICE_RESULT, MACRO_ROLL_RESULT, WOUND_ADDED/UPDATED/REMOVED,
  // INVENTORY_ADDED/UPDATED/REMOVED, DOC_CREATED/UPDATED/DELETED,
  // 'error', s.io.on('reconnect')

  setSocket(s)
  return () => s.disconnect()   // nettoie TOUS les listeners
}, [campaignId, reconnectTrigger, loadSession])
```

**Pourquoi `listen` n'est pas dans les deps du useEffect ?**
`listen` est une fonction ordinaire (pas useCallback) recréée à chaque render. Elle est appelée impérativement dans l'effet, jamais utilisée comme dep. Les setters qu'elle capture (useState + Zustand) sont stables — garanti par React et Zustand.

**Pourquoi pas `useCallback` pour `listen` ?**
Pas nécessaire. La fonction n'est jamais passée comme prop ni mise en dep. `useCallback` sans raison est du bruit.

**Pourquoi pas `s.off()` granulaires dans le cleanup ?**
`s.disconnect()` nettoie tous les listeners côté socket.io. Identique au comportement actuel. Pas de régression.

**Options écartées :**
- Passer `socket` depuis le state (`useState`) aux hooks → décalage 1-render (socket null au 1er render des hooks)
- React Context pour le socket → sur-ingénierie, 1 seul consumer par hook
- Hooks avec leur propre `useEffect([socket])` → re-inscription asynchrone, casse la garantie de réception des events au reconnect
- Déplacer l'état combat dans `combatStore` → hors scope, requiert modifier CombatOverlay

### Interface cible

```js
// ── client/src/lib/useTokenSocket.js ────────────────────────────────────────
// Params : aucun — lit directement depuis tokenStore
// State propre : aucun
export function useTokenSocket() {
  const { addToken, removeToken, updateToken } = useTokenStore()
  function listen(s) {
    s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) =>
      updateToken({ id: tokenId, pos_x, pos_y, pos_z, updated_at }))
    s.on(WS.TOKEN_CREATED, ({ token }) => addToken(token))
    s.on(WS.TOKEN_DELETED, ({ tokenId }) => removeToken(tokenId))
    s.on(WS.TOKEN_UPDATED, ({ token }) => updateToken(token))
    s.on(WS.TOKEN_STATUS_UPDATED, ({ tokenId, statuses, statusExpiries }) =>
      updateToken({ id: tokenId, statuses, statusExpiries: statusExpiries ?? {} }))
  }
  return { listen }
}

// ── client/src/lib/useEntitySocket.js ───────────────────────────────────────
// Params : setRadialMenu, setMoveTarget (SessionPage local state)
// State propre : aucun — tout va aux stores ou SessionPage via callbacks
export function useEntitySocket({ setRadialMenu, setMoveTarget }) {
  const { user } = useAuthStore()
  const { clearPendingEntityId, addMessage } = useSessionStore()
  const { setBattlemap } = useMapStore()
  const { setTokens } = useTokenStore()
  const { setEntities } = useEntityStore()
  const { t } = useTranslation()
  function listen(s) {
    s.on(WS.MAP_SWITCH, ...) // api.get() inline + setBattlemap + setTokens + setEntities
    s.on(WS.ENTITY_ACTION_PENDING, ...) // addMessage (gmOnly)
    s.on(WS.ENTITY_ACTION_RESULT, ...) // clearPendingEntityId + addMessage + setRadialMenu(null)
    s.on(WS.ENTITY_MOVE_RESULT, ...) // setMoveTarget(null) + addMessage
  }
  return { listen }
}

// ── client/src/lib/useCombatSocket.js ───────────────────────────────────────
// Params : isGm (bool), setMode (setState stable), onModeReset (callback)
// State propre : 12 états résultat combat
export function useCombatSocket({ isGm, setMode, onModeReset }) {
  // Stores
  const { setCombatState, resetCombat, setPhase, markTokenAnnounced, updateRoster,
          advanceSlot, setActions, addAnnouncedAction, resetAnnouncedActions } = useCombatStore()
  const { addMessage } = useSessionStore()
  const { t } = useTranslation()
  // État propre
  const [reloadResult,        setReloadResult]        = useState(null)
  const [damagePayload,       setDamagePayload]        = useState(null)
  const [damageResults,       setDamageResults]        = useState(null)
  const [attackResult,        setAttackResult]         = useState(null)
  const [gmAttackResult,      setGmAttackResult]       = useState(null)
  const [pnjAttackResult,     setPnjAttackResult]      = useState(null)
  const [meleeDefensePrompt,  setMeleeDefensePrompt]   = useState(null)
  const [meleeResult,         setMeleeResult]          = useState(null)
  const [stunPayload,         setStunPayload]          = useState(null)
  const [pendingSurpriseRoll, setPendingSurpriseRoll]  = useState(null)
  const [announcementMarker,  setAnnouncementMarker]   = useState(null)
  const [pjPreview,           setPjPreview]            = useState(null)

  function listen(s) { /* 18 listeners COMBAT_* */ }

  return {
    listen,
    reloadResult,        setReloadResult,
    damagePayload,       setDamagePayload,
    damageResults,       setDamageResults,
    attackResult,        setAttackResult,
    gmAttackResult,      setGmAttackResult,
    pnjAttackResult,     setPnjAttackResult,
    meleeDefensePrompt,  setMeleeDefensePrompt,
    meleeResult,         setMeleeResult,
    stunPayload,         setStunPayload,
    pendingSurpriseRoll, setPendingSurpriseRoll,
    announcementMarker,  setAnnouncementMarker,
    pjPreview,           setPjPreview,
  }
}
```

**Utilisation dans SessionPage — ordre de déclaration obligatoire (P4/P48) :**
```js
// 1. useState SessionPage qui restent (non migrés)
const [combatMoveMode,        setCombatMoveMode]        = useState(null)
const [pendingMoveSelection,  setPendingMoveSelection]  = useState(null)
const [combatTargetMode,      setCombatTargetMode]      = useState(null)

// 2. handleModeReset AVANT useCombatSocket (passé en param)
const handleModeReset = useCallback(() => {
  setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
}, [])  // deps vides — setCombat* sont des setters stables

// 3. Hooks socket
const tokenSocket  = useTokenSocket()
const entitySocket = useEntitySocket({ setRadialMenu, setMoveTarget })
const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })

// 4. Callbacks utilisant combatSocket APRÈS useCombatSocket (P4)
// handleSurpriseRolled — deps P3 : socket + pendingSurpriseRoll depuis combatSocket
const handleSurpriseRolled = useCallback(() => {
  if (!socket || !combatSocket.pendingSurpriseRoll) return
  socket.emit(WS.COMBAT_SURPRISE_RESULT, { tokenId: combatSocket.pendingSurpriseRoll.tokenId })
  combatSocket.setPendingSurpriseRoll(null)
}, [socket, combatSocket.pendingSurpriseRoll, combatSocket.setPendingSurpriseRoll])
```

### Pièges documentés

- **[F-R9-1]** `onMeleeDefenseConfirm` (SessionPage L.1332) — inline `socket.emit` dans le JSX. À conserver tel quel (pas dans useCombatSocket). Non bloquant.
- **[F-R9-2]** `tokens` prop (SessionPage L.1307 → CombatOverlay) — morte. CombatOverlay lit `tokens` depuis `useTokenStore()` (CombatOverlay L.22). Supprimer dans REWORK-09.
- **[F-R9-3]** `announcementMarker` prop → CombatOverlay — destructuré mais jamais consommé dans le corps du composant. Supprimer dans REWORK-09.
- **[F-R9-4]** `isGm` dans `useCombatSocket` : capturé à la création du socket (comme dans le code actuel). `isGm` n'est pas dans les deps du useEffect → valeur figée au montage. Comportement identique — pas de régression.
- **[F-R9-5]** `loadSession` dans les deps du useEffect socket : présent dans le code actuel mais non utilisé dans le corps du useEffect. Conservé tel quel dans REWORK-09 (hors scope de modifier les deps).
- **[F-R9-6]** `COMBAT_STATE_SYNC` appelle aussi `setMode('combat')` (SessionPage L.671) — troisième callsite de `setMode` dans `listen`, après COMBAT_STARTED et COMBAT_ENDED. À ne pas oublier lors de la migration.
- **[F-R9-7]** `handleSurpriseRolled` — ses deps useCallback changent après migration : `pendingSurpriseRoll` et `setPendingSurpriseRoll` viennent désormais de `combatSocket`. Violer P3 (oublier `socket` dans les deps) OU omettre `combatSocket.pendingSurpriseRoll` bloquera silencieusement le jet de surprise.

### Périmètre

**Fichiers nouveaux :**
- `client/src/lib/useTokenSocket.js`
- `client/src/lib/useEntitySocket.js`
- `client/src/lib/useCombatSocket.js`

**Fichiers modifiés :**
- `client/src/pages/SessionPage.jsx`
  - Supprimer : 12 `useState` combat (migré vers useCombatSocket)
  - Supprimer : ~198 lignes de listeners du useEffect (TOKEN 17L + ENTITY+MAP 66L + COMBAT 115L) → fichier ~1 340 lignes
  - Supprimer : `tokens={tokens}` de l'appel CombatOverlay (dead prop, [F-R9-2])
  - Supprimer : `announcementMarker={announcementMarker}` de l'appel CombatOverlay (dead, [F-R9-3]) — reste passé à Canvas3D
- `client/src/components/CombatOverlay.jsx` — **1 ligne uniquement**
  - Supprimer `announcementMarker` du destructuring des props (L.20) — param dead confirmé, jamais consommé dans le corps

**NON touchés :**
- `client/src/stores/combatStore.js` — aucune modification
- Tous les autres stores — aucune modification
- `server/` — aucune modification

### Plan

**Étape 1 — useTokenSocket.js**
- Créer `client/src/lib/useTokenSocket.js` avec les 5 listeners TOKEN_*
- Intégrer dans SessionPage.jsx : import + `tokenSocket.listen(s)` + supprimer les 5 `s.on TOKEN_*`
- `node --check client/src/lib/useTokenSocket.js` + `node --check client/src/pages/SessionPage.jsx` → 0 erreur
- SR sans erreur → test scénario 1 (drag token)

**Étape 2 — useEntitySocket.js**
- Créer `client/src/lib/useEntitySocket.js` avec 4 listeners : MAP_SWITCH, ENTITY_ACTION_PENDING, ENTITY_ACTION_RESULT, ENTITY_MOVE_RESULT
- Intégrer dans SessionPage.jsx
- `node --check` sur les 2 fichiers → 0 erreur
- SR sans erreur → test scénarios 3 + 4 (entité + changement carte)

**Étape 3 — useCombatSocket.js**
- Créer `client/src/lib/useCombatSocket.js` avec 18 listeners COMBAT_*
- Intégrer dans SessionPage.jsx dans l'ordre suivant :
  - Supprimer les 12 `useState` combat (L.108–252)
  - Ajouter `handleModeReset = useCallback(...)` avant les hooks socket
  - Ajouter `combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })`
  - Réécrire `handleSurpriseRolled` avec les nouvelles deps (voir [F-R9-7])
  - Brancher `combatSocket.*` dans les props CombatOverlay (remplacer les 12 state locaux)
  - Supprimer dead props `tokens={tokens}` et `announcementMarker={announcementMarker}` de l'appel CombatOverlay
  - Conserver `announcementMarker={combatSocket.announcementMarker}` sur Canvas3D
- Modifier `client/src/components/CombatOverlay.jsx` L.20 : retirer `announcementMarker` du destructuring (ligne de 38 props — édition chirurgicale, vérifier que `pjPreview` adjacent reste intact)
- `node --check` sur les 4 fichiers + `npm run build` → 0 erreur
- SR sans erreur

**Étape 4 — Validation fonctionnelle**
- Scénarios 5 à 8 (COMBAT) + non-régression scénarios 1–4

### Validation

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Drag token sur la carte | TOKEN_MOVED reçu → token se déplace en temps réel sur tous les clients |
| 2 | GM crée un token (drop depuis sidebar) | TOKEN_CREATED → token visible immédiatement sur tous les clients |
| 3 | Joueur clique une entité interactible | ENTITY_ACTION_RESULT reçu → message chat apparaît / radial fermé |
| 4 | GM change de carte (bouton "Déplacer le groupe") | MAP_SWITCH reçu → tous les joueurs voient la nouvelle carte |
| 5 | GM démarre le combat | COMBAT_STARTED → mode combat activé GM + joueurs |
| 6 | Joueur déclare action | COMBAT_ACTION_DECLARED → marqueur ghost + log déclarations mis à jour |
| 7 | Assaut PNJ résolu | COMBAT_ATTACK_RESULT → panneau résultat GM + panneau joueur ciblé |
| 8 | Non-régression : session sans combat | Ouvrir une session, envoyer un message chat, déplacer un token, interagir avec une entité, changer de carte → 0 erreur console F12, 0 erreur serveur |

### Definition of done

- [x] `node --check client/src/lib/useTokenSocket.js` → 0 erreur
- [x] `node --check client/src/lib/useEntitySocket.js` → 0 erreur
- [x] `node --check client/src/lib/useCombatSocket.js` → 0 erreur
- [x] `npm run build` → 0 erreur Vite
- [x] SR sans erreur
- [x] `grep -c "s\.on(" client/src/pages/SessionPage.jsx` → 18 (≤ 20)
- [x] `grep -c "tokens={tokens}" client/src/pages/SessionPage.jsx` → 0 (dead prop retirée)
- [x] `grep -c "announcementMarker" client/src/components/CombatOverlay.jsx` → 0 (dead param retiré du destructuring)
- [x] Scénarios 1–8 validés
- [x] JOURNAL4.md appendé
