# ARCHI_REWORK.md — Reworks architecturaux
> Créé Session 96 — 2026-06-16 | Mis à jour Session 109 — 2026-06-18
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
| **REWORK-08** | Modularisation `socket/index.js` | 4 266 lignes — fichier dieu. Découper en `socketToken.js`, `socketVoxel.js`, `socketEntity.js`, `socketCombat.js`, `socketDice.js` + `lib/mrTable.js`. `initSocket()` devient coordinateur. **Prérequis de REWORK-04.** | **⚠️ Clos partiel Session 108 — Scénarios 1–17 non testés** |
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
> ⚠️ **L'ordre Étapes 1→7 est une contrainte dure.** `context` est déclaré en Étape 2 — les Étapes 3–6 en dépendent. Exécuter l'Étape 3 sans l'Étape 2 → `ReferenceError: context is not defined` au SR.

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
    console.log(`[WS] Déconnecté : ${user.username} (${socket.id})`)
    socket.to(campaignId).emit(WS.SESSION_USER_LEFT, {
      userId: user.id,
      username: user.username,
    })
  })
})
```

**Changement comportemental mineur :** les handlers sont désormais enregistrés **après** SESSION_JOIN (et non à la connexion brute). En pratique identique — aucun client n'émet un TOKEN_MOVE avant d'avoir rejoint la session. Tous les handlers guarded existants (`if (!campaignId)`) deviennent inutiles mais sont conservés tels quels (hors périmètre).

**Alternatives écartées :**
- Closure lazy (variables `let campaignId` + handlers à la connexion) → conserve le couplage, rend les modules impossibles à tester en isolation
- Contexte mutable `const ctx = {}` passé par référence → complexité accidentelle, source de bugs de timing
- Un module unique `socketHandlers.js` (tout regroupé) → ne résout pas le problème de taille

### Interface cible

> ⚠️ **Spec préliminaire** — rédigée avant l'analyse détaillée des Étapes. Les Étapes 2–6 et leurs pièges [R8-xx] font autorité en cas de contradiction (imports, signatures). En particulier : `registerCombatHandlers` → voir signature définitive Étape 6 ; `socketDice.js` imports → [R8-12] ; `socketCombat.js` imports → [R8-23]. La variable `user` n'est **pas** une variable locale dans SESSION_JOIN — toujours `user: socket.user` (confirmé lecture L.146–227).

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
export function registerCombatHandlers(io, socket, context, pendingMaps)
// context destructuré en tête de fonction : { campaignId, user, isGm }
// pendingMaps = { pendingDamageActions, pendingMeleeDefense, pendingStunActions, combatTimers, combatPreviews }
// ⚠️ Signature définitive : voir Étape 6 — NE PAS utiliser la destructuration inline ici
// Handlers : COMBAT_START · COMBAT_END · COMBAT_ANNOUNCE_START · COMBAT_INIT_STATE
//           COMBAT_SURPRISE_RESULT · COMBAT_ACTION_DECLARE · COMBAT_SKIP_PLAYER
//           COMBAT_ANNOUNCE_PREVIEW · COMBAT_ACTION_CONFIRM · COMBAT_DAMAGE_CONFIRM
//           COMBAT_MELEE_DEFENSE_CONFIRM · COMBAT_STUN_CONFIRM · COMBAT_APPLY_STUN
// Helpers internes (non exportés) : startAnnouncementTimers · skipPlayer
//   startResolutionPhase · advanceSlot · endTurn · multiAdversaryMalus · countAdversaires
//   resolveMeleeAction · resolveReloadAction · resolveDroneAssaultAction · resolveAssaultAction
//   calcDroneRD · resolveDroneIntegrityLoss
// Imports requis : voir Étape 6 [R8-23] — checkTokenOwnership EXCLU [R8-20] (0 usage)
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
// ⚠️ Limitation connue (A13) : si la première requête DB échoue, mrTablePromise cache une Promise
// rejetée → tous les appels suivants reçoivent la même rejection. Comportement identique à
// l'original — pas de régression. Reset possible : mrTablePromise = null (hors périmètre REWORK-08).
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
- `server/src/socket/index.js` → coordinateur uniquement (≤ 200 lignes) :
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
- Dans `index.js` — ajouter **à l'intérieur** de SESSION_JOIN, après le bloc try/catch COMBAT_STATE_SYNC (localiser par `console.warn('[WS] session:join — combat state sync` — **jamais par numéro de ligne** [R8-8] — lignes décalent après Étape 1) :
  ```js
  const context = { campaignId, user: socket.user, isGm: socket.role === 'gm' }
  registerTokenHandlers(io, socket, context)
  ```
  `context` est déclaré une seule fois — les Étapes 3–6 ajoutent uniquement `registerXxxHandlers(io, socket, context)` sans re-déclarer.
- Supprimer les 4 handlers TOKEN par event name : `WS.TOKEN_MOVE`, `WS.TOKEN_ROTATE`, `WS.TOKEN_SET_ROTATION`, `WS.TOKEN_STATUS_TOGGLE` (**jamais par numéro de ligne** [R8-8] — décalent de ~17L après Étape 1)
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
- Créer `server/src/socket/socketEntity.js` avec `registerEntityHandlers` (7 handlers : ENTITY_ACTION_REQUEST, ENTITY_ACTION_RESOLVE, ENTITY_ACTION_GM_DIRECT, ENTITY_CREATED, ENTITY_DELETED, ENTITY_MOVED, ENTITY_MOVE_REQUEST → source L.753–1457 + `resolveEntityState` helper → L.2750–2781 → ~760 lignes)
- **`resolveEntityState`** — helper interne non exporté. Dans la source : déclarée après `export default initSocket` (L.2750), hors closure. Dans `socketEntity.js` : module-level function, déclarée **avant** `registerEntityHandlers`. Signature inchangée : `async function resolveEntityState(entityId, interactionId, campaignId, io)`. `io` est un **paramètre explicite** — choix délibéré pour testabilité du module en isolation (pas une closure sur `io` de `registerEntityHandlers`). `db` et `collisionUpdateEntityState` depuis les imports du module.
- **5 call sites de `resolveEntityState`** — deux origines distinctes pour `campaignId` :
  - ×2 → **substituer** `socket.campaignId` par `campaignId` : ENTITY_ACTION_REQUEST + ENTITY_ACTION_GM_DIRECT
  - ×3 → **ne pas substituer** `pending.campaignId` : ENTITY_ACTION_RESOLVE (autoSuccess, !skillId, isSuccess) — voir [R8-15]
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
- ⚠️ **[R8-15] — ENTITY_ACTION_RESOLVE : toutes les références à `campaignId` viennent de `pending`, jamais de `socket`.**
  Dans ce handler, le GM résout une demande du joueur stockée dans la Map. Occurrences `pending.campaignId` à ne pas substituer :
  - `io.in(pending.campaignId).fetchSockets()` — retrouver le socket joueur
  - `io.to(pending.campaignId).emit(WS.DICE_RESULT, ...)` — broadcast résultat dé
  - `resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)` × 3
  Aucune n'est dans la table ×14. Confondre → broadcasts dans la room du GM (pas la campaign), silencieux.
- ⚠️ `socket.id` (`playerSocketId: socket.id`) — identifiant de connexion socket.io, **distinct** de `socket.user.id`. Ne pas substituer. Utilisé pour retrouver le socket joueur via `roomSockets.find(s => s.id === pending.playerSocketId)`.
- ⚠️ `ENTITY_CREATED` — ne pas "uniformiser" avec `io.to(campaignId).emit()`. Ce handler utilise `io.in(campaignId).fetchSockets()` + boucle + `s.emit()` pour filtrer `gm_only`. Un broadcast global casse ce filtre silencieusement.
- ⚠️ `socket.emit(WS.ENTITY_MOVE_RESULT, ...)` dans ENTITY_MOVE_REQUEST — 3 occurrences (cas dmax=0, stepsCompleted=0, succès). Envoi au joueur demandeur uniquement. Ne pas substituer par `io.to(campaignId).emit()`.
- ⚠️ `socket.emit('error', { message: '...' })` dans ENTITY_ACTION_REQUEST — événement natif socket.io, pas un WS event. N'apparaît pas dans la table de substitution (aucun `socket.campaignId` ni `socket.user.*` dans ces lignes). Ne pas traiter comme candidat à substitution.
- ⚠️ `pendingEntityActions` transmise par référence depuis `index.js` — Map **globale**, scope inter-campaigns. Correct pour Enclume (mono-campaign par serveur). Migration per-campaign = REWORK-04+.
- **Modifications de `index.js` — ordre obligatoire :**
  1. `node --check server/src/socket/socketEntity.js` → 0 erreur **avant** de toucher `index.js`
  2. Ajouter en tête des imports : `import { registerEntityHandlers } from './socketEntity.js'`
  3. Dans SESSION_JOIN, après `registerDiceHandlers(io, socket, context)` : ajouter `registerEntityHandlers(io, socket, context, pendingEntityActions)`
  4. Localiser et supprimer les 7 `socket.on(WS.ENTITY_*` par event name ([R8-8])
  5. Localiser et supprimer `resolveEntityState` par `async function resolveEntityState` — déclarée après `export default initSocket`, pas par numéro de ligne ([R8-8])
  6. `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — scénarios :
  1. Jet entité avec jet D20 (ENTITY_ACTION_REQUEST → GM approuve → ENTITY_ACTION_RESOLVE → DICE_RESULT room + ENTITY_UPDATED room)
  2. Jet entité autoSuccess (GM coche "Succès automatique" → ENTITY_ACTION_RESOLVE branche autoSuccess → ENTITY_UPDATED sans jet) — valide [R8-15] branche L.893
  3. GM direct (ENTITY_ACTION_GM_DIRECT → ENTITY_UPDATED room)
  4. Push/pull (ENTITY_MOVE_REQUEST → ENTITY_MOVED + TOKEN_MOVED room + ENTITY_MOVE_RESULT joueur uniquement)
  5. Création entité `gm_only=true` (ENTITY_CREATED → visible GM uniquement, invisible joueurs) — valide que le filtre `s.data.role !== 'gm'` n'a pas été remplacé par broadcast global
  6. ENTITY_DELETED + ENTITY_MOVED (GM)
  7. Interaction sans mécanique (ENTITY_ACTION_REQUEST, interaction sans `skill_id` ni `attribute_id`) → résolution directe sans passer par le GM, ENTITY_UPDATED émis — valide le guard L.791

**Étape 6 — `socketCombat.js`**
- Créer `server/src/socket/socketCombat.js` avec `registerCombatHandlers` (13 handlers L.1464–2730 + 13 helpers L.2783–4266 + 7 constantes L.85–134 → ~2 800 lignes)
- Imports exacts (grep exhaustif L.1464–4266 — [R8-23]) :
  ```js
  import { WS } from '../../../shared/events.js'
  import db from '../db/knex.js'
  import { parseDice } from '../lib/diceParser.js'
  import { getMrTable, getModifier } from '../lib/mrTable.js'
  import { getUserColor } from '../lib/socketUtils.js'
  import * as woundService from '../lib/woundService.js'
  import * as statusService from '../lib/statusService.js'
  import * as damageService from '../lib/damageService.js'
  import {
    calcSkillTotal, calcAttributeNA, calcREA,
    calcWoundPenalty, calcEncumbrancePenalty,
    calcResistanceDommages, calcResistanceArmure, calcCarenceArmure,
    getModDom, RD_TABLE, lookupTable,
  } from '../lib/charStats.js'
  import { isCaseOccupied, collisionMoveToken } from '../lib/redis.js'
  import { SLOT_TO_WOUND_LOCATION, LOCATION_LABELS, LOC_TABLE } from '../../../shared/armorConstants.js'
  import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
  ```
- **Imports — usages confirmés (lecture L.1464–4266)** :
  - `parseDice` → `resolveMeleeAction` (~L.3168, 3322, 3388, 3405, 3469) + `resolveDroneAssaultAction` + `resolveAssaultAction` ✅
  - `getUserColor` → `COMBAT_ACTION_DECLARE` (~L.1742) ✅
  - `isCaseOccupied` + `collisionMoveToken` → `COMBAT_ACTION_CONFIRM` (~L.2261, L.2267) — déplacement token cible ✅
  - `checkTokenOwnership` → **0 usage** [R8-20] — **NE PAS importer**
  - `PORTEE_MOD_COMP`/`SITUATION_MODS`/`TAILLE_MODS`/LABELS → 0 usage dans socketDice [R8-6] ; usage dans socketToken/Voxel/Entity non grep-confirmé mais exclus par sémantique (domaine combat exclusif)
  - `COMBAT_APPLY_STUN` — handler simple GM-only : appelle `statusService.applyStunWithDuration` (pas `applyStun`), **aucun pendingMaps utilisé** dans ce handler
- **Constantes à déplacer depuis `index.js` (L.85–134)** — copier telles quelles en tête de module :
  `PORTEE_MOD_COMP`, `SITUATION_MODS`, `TAILLE_MODS`, `SITUATION_LABELS`, `PORTEE_LABELS`, `TAILLE_LABELS`, `COMBAT_MODE_LABELS`
- **Signature de la fonction exportée** :
  ```js
  export function registerCombatHandlers(io, socket, context, pendingMaps) {
    const { campaignId, user, isGm } = context
    // 13 × socket.on(WS.COMBAT_*, ...)
  }
  ```
  ⚠️ Export nommé (pas `export default`) — l'import dans `index.js` est `import { registerCombatHandlers }`.
- **Architecture helpers — module-level avec `pendingMaps` passé explicitement [R8-24]** :
  Les 13 helpers restent des fonctions de niveau module (non exportées). Les helpers qui accèdent aux Maps partagées reçoivent `pendingMaps` comme dernier paramètre :
  ```js
  // Helpers SANS pendingMaps (io + db + params suffisent) :
  function multiAdversaryMalus(n)
  function countAdversaires(tokenPos, rosterTokens, excludeId, enemyType)
  function calcDroneRD(integrite)
  async function resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)
  async function resolveReloadAction(io, socket, campaignId, character, action)

  // Helpers AVEC pendingMaps — destructurent ce dont ils ont besoin :
  async function startAnnouncementTimers(io, campaignId, timerSec, gmUserId, pendingMaps)
    // { combatTimers } = pendingMaps
  async function skipPlayer(io, campaignId, tokenId, pendingMaps)
    // { combatTimers } = pendingMaps ; appelle startResolutionPhase(..., pendingMaps)
  async function startResolutionPhase(io, campaignId, pendingMaps)
    // { combatPreviews } = pendingMaps
  async function advanceSlot(io, campaignId, slots, nextIdx, pendingMaps)
    // passe pendingMaps à endTurn
  async function endTurn(io, campaignId, pendingMaps)
    // { combatTimers, combatPreviews } = pendingMaps ; appelle startAnnouncementTimers(..., pendingMaps)
  async function resolveMeleeAction(io, socket, campaignId, action, character, remaining, total, mods, pendingMaps)
    // { pendingMeleeDefense, pendingStunActions } = pendingMaps  [R8-26 CONFIRMÉ : pendingDamageActions ABSENT]
    // statusService.applyStun(io, db, ...) SET pendingStunActions en interne — ne pas confondre avec une fn locale
    // Les appels récursifs passent pendingMaps
    // ⚠️ Dans le code source, `remaining`, `total`, `mods` ont des valeurs par défaut (= [], 1, null).
    //    `pendingMaps` vient APRÈS ces params avec defaults — un call qui omet `pendingMaps` passe `undefined`
    //    silencieusement (pas d'erreur syntax, pas de `node --check`). Vérifier les 4 call sites exhaustivement.
  async function resolveDroneAssaultAction(io, socket, campaignId, action, mods, character, pendingMaps)
    // { pendingDamageActions, pendingStunActions } = pendingMaps
  async function resolveAssaultAction(io, socket, campaignId, action, mods, character, pendingMaps)
    // { pendingDamageActions, pendingStunActions } = pendingMaps
    // appelle resolveDroneAssaultAction(..., pendingMaps)
  ```
- **Substitutions dans les 13 handlers** [R8-25] :
  | index.js (source) | socketCombat.js (cible) | Occurrences |
  |---|---|---|
  | `const campaignId = socket.campaignId` | Supprimer — `campaignId` déjà en scope depuis le contexte | ×10 (COMBAT_START/END/ANNOUNCE_START/INIT_STATE/SURPRISE_RESULT/ACTION_DECLARE/SKIP_PLAYER/ANNOUNCE_PREVIEW/ACTION_CONFIRM/APPLY_STUN) |
  | `socket.role !== 'gm'` | `!isGm` | ×10 (guards directs) |
  | `socket.role === 'gm'` | `isGm` | ×1 (COMBAT_INIT_STATE guard inversé) |
  | `socket.data?.role === 'gm'` | `isGm` | ×1 (COMBAT_STUN_CONFIRM L.2688) |
  | `socket.user.id` | `user.id` | ×13 (handlers — ne pas substituer dans les helpers, paramètre `socket` différent) |
  | `socket.user.username` | `user.username` | ×6 (logs + payloads) |
  | `socket.user?.id` | `user.id` | ×1 (COMBAT_MELEE_DEFENSE_CONFIRM L.2554) |
  | `socket.user?.username ?? 'Défenseur'` | `user.username` | ×1 (même ligne) |
  | appels helpers sans pendingMaps | appels helpers + `, pendingMaps` | **19 call sites** (7 internes helper→helper + 12 externes handler→helper) — `node --check` aveugle sur ces oublis, SR seul détecte |
- ⚠️ **Handlers SANS substitution `campaignId`** — `campaignId` vient de `pending`, jamais de `context` [R8-16] :
  - `COMBAT_DAMAGE_CONFIRM` → `pending.campaignId` (L.2329)
  - `COMBAT_MELEE_DEFENSE_CONFIRM` → `meleeCampaignId = pending.campaignId` (L.2487)
  - `COMBAT_STUN_CONFIRM` → `pending.campaignId` (L.2696)
  Ne pas substituer `pending.campaignId` par `campaignId` dans ces 3 handlers — le broadcast partirait dans la mauvaise room silencieusement.
- **Appels helpers modifiés dans l'Étape 6** (call sites internes) :
  - `startAnnouncementTimers(io, campaignId, ..., socket.user.id)` → `startAnnouncementTimers(io, campaignId, ..., user.id, pendingMaps)` [COMBAT_ANNOUNCE_START]
  - `startAnnouncementTimers(io, campaignId, ..., gmMember?.user_id)` → `startAnnouncementTimers(io, campaignId, ..., gmMember?.user_id, pendingMaps)` [endTurn]
  - `skipPlayer(io, campaignId, entry.token_id)` → `skipPlayer(io, campaignId, entry.token_id, pendingMaps)` [startAnnouncementTimers]
  - `skipPlayer(io, campaignId, tokenId)` → `skipPlayer(io, campaignId, tokenId, pendingMaps)` [COMBAT_SKIP_PLAYER]
  - `startResolutionPhase(io, campaignId)` → `startResolutionPhase(io, campaignId, pendingMaps)` [**3 call sites — vérifier chacun** : (1) handler `COMBAT_SURPRISE_RESULT`, (2) handler `COMBAT_ACTION_DECLARE`, (3) dans le corps de la fonction `skipPlayer`]
  - `advanceSlot(io, campaignId, slots, idx)` → `advanceSlot(io, campaignId, slots, idx, pendingMaps)` [COMBAT_ACTION_CONFIRM ×1, COMBAT_MELEE_DEFENSE_CONFIRM ×2 (branches if/else L.2668 + L.2676)]
  - `endTurn(io, campaignId)` → `endTurn(io, campaignId, pendingMaps)` [advanceSlot]
  - `resolveAssaultAction(io, socket, campaignId, action, mods, character)` → `resolveAssaultAction(io, socket, campaignId, action, mods, character, pendingMaps)` [COMBAT_ACTION_CONFIRM]
  - `resolveReloadAction(io, socket, campaignId, character, action)` → inchangé
  - `resolveMeleeAction(io, socket, campaignId, action, character, ...)` → `resolveMeleeAction(io, socket, campaignId, action, character, ..., pendingMaps)` [COMBAT_ACTION_CONFIRM ×1, COMBAT_MELEE_DEFENSE_CONFIRM ×1 (L.2657 — attaque suivante), récursion ×2 (PNJ branch L.3451, drone branch L.3484)]
  - `resolveDroneAssaultAction(io, socket, campaignId, action, mods, character)` → `resolveDroneAssaultAction(io, socket, campaignId, action, mods, character, pendingMaps)` [resolveAssaultAction ×1, COMBAT_ACTION_CONFIRM ×1]
  - `resolveDroneIntegrityLoss(io, campaignId, ...)` → inchangé (pas de pendingMaps)
- **Modifications de `index.js`** — ordre obligatoire [R8-8] :
  1. `node --check server/src/socket/socketCombat.js` → 0 erreur **avant** de toucher `index.js`
  2. Ajouter `import { registerCombatHandlers } from './socketCombat.js'` en tête des imports
  3. Dans SESSION_JOIN, après `registerEntityHandlers(io, socket, context, pendingEntityActions)` :
     a. Ajouter `registerCombatHandlers(io, socket, context, { pendingDamageActions, pendingMeleeDefense, pendingStunActions, combatTimers, combatPreviews })`
     b. Ajouter immédiatement après le `socket.on('disconnect')` avec le contenu de [R8-3] (utiliser `user` et `campaignId` du contexte, SANS `if (socket.campaignId)` guard) :
        ```js
        socket.on('disconnect', () => {
          console.log(`[WS] Déconnecté : ${user.username} (${socket.id})`)
          socket.to(campaignId).emit(WS.SESSION_USER_LEFT, {
            userId: user.id,
            username: user.username,
          })
        })
        ```
        ⚠️ **Ce handler n'a PAS été ajouté à SESSION_JOIN lors de l'Étape 2 (contrairement à ce que supposait la spec) — l'ajouter ici est obligatoire.**
  4. Localiser et supprimer les 13 `socket.on(WS.COMBAT_*` par event name
     ⚠️ `socket.on('disconnect')` se trouve actuellement à ~L.1495 (entre COMBAT_APPLY_STUN et les helpers). **Le supprimer** — SESSION_JOIN en possède maintenant un (ajouté au step 3b ci-dessus).
  5. Localiser et supprimer les 13 helpers par `async function` / `function` name
  6. Supprimer les 7 constantes L.85–134 (`const PORTEE_MOD_COMP`, etc.)
  7. `node --check server/src/socket/index.js` → 0 erreur
- SR sans erreur — scénarios combat (voir §Validation scénarios 8–9)

**Étape 7 — Finalisation `index.js` coordinateur**
- Vérifier que `index.js` ne contient plus que : imports, 6 Maps singletons, `initSocket`, SESSION_JOIN inline, 5 appels `register*`, disconnect inline
- **Nettoyage imports morts** — après Étape 6, les imports suivants de `index.js` sont inutilisés et doivent être supprimés (sauf exception) :
  - `getMrTable`, `getModifier` → migrés dans socketCombat.js (usages dans resolveMeleeAction/resolveDroneAssaultAction/resolveAssaultAction — 0 usage dans SESSION_JOIN)
  - `parseDice` → migré dans `socketDice.js`
  - `charStats.js` exports (calcSkillTotal, calcAttributeAN/NA, calcREA, calcWoundPenalty...) → migrés dans socketDice/socketEntity/socketCombat
  - `woundService` → migré dans socketCombat.js
  - `statusService` → migré dans socketCombat.js
  - `damageService` → migré dans socketCombat.js
  - `SLOT_TO_WOUND_LOCATION`, `LOCATION_LABELS`, `LOC_TABLE` (armorConstants) → migré dans socketCombat.js
  - `SEVERITY_COLORS` (woundConstants) → migré dans socketCombat.js
  - `collisionAddToken`, `collisionRemoveToken` (dead imports en L.1) → jamais utilisés
  - `checkTokenOwnership` → 0 usage SESSION_JOIN (confirmé L.146–227), usages dans socketToken.js [A06]
  - `getUserColor` → 0 usage SESSION_JOIN (confirmé L.146–227), usages dans socketDice/socketEntity/socketCombat [A06-bis]
  - ⚠️ **À CONSERVER** : `buildCollisionMap` (SESSION_JOIN L.198 — seul import redis restant), imports WS/jwt/db si encore référencés dans SESSION_JOIN — vérifier ligne par ligne
  - ⚠️ **`checkTokenOwnership` : NE PAS CONSERVER dans index.js** [A06] — SESSION_JOIN ne l'utilise PAS (confirmé lecture L.146–227 : accès membres via `db('campaign_members').where(...)` uniquement). Après Étape 2, tous ses usages sont dans socketToken.js. Supprimer l'import de index.js.
  - ⚠️ **`getUserColor` : NE PAS CONSERVER dans index.js** [A06-bis] — SESSION_JOIN ne l'utilise PAS (confirmé lecture L.146–227 : COMBAT_STATE_SYNC fait uniquement `socket.emit(...)`, zéro appel getUserColor). Après Étapes 2-6, toutes les occurrences (L.525, 595, 707, 972, 1252, 1742) seront dans socketDice/socketEntity/socketCombat. Supprimer l'import de index.js.
- Vérifier `node --check server/src/socket/index.js` → 0 erreur **après** le nettoyage
- `npm run build` → 0 erreur Vite (côté client — vérifie que rien n'a changé côté imports partagés)
- Compter les lignes : `wc -l server/src/socket/index.js` → doit être ≤ 200 lignes (SESSION_JOIN inline peut être ~100L avec COMBAT_STATE_SYNC)
- SR final sans erreur — scénarios complets

### Pièges documentés

- **[R8-2]** SESSION_JOIN (L.146–229) contient la logique `COMBAT_STATE_SYNC` reconnexion (L.205–229) — reste inline dans `index.js`, non migré.
- **[R8-3]** `socket.on('disconnect')` — dans la source (L.2732–2740) : déclaré à l'intérieur de `io.on('connection')`, **pas** dans SESSION_JOIN. Dans le rework : déplacé à la fin de SESSION_JOIN, après les 5 appels `register*`. Contenu complet à préserver (source L.2733–2739) :
  ```js
  socket.on('disconnect', () => {
    console.log(`[WS] Déconnecté : ${user.username} (${socket.id})`)
    socket.to(campaignId).emit(WS.SESSION_USER_LEFT, {
      userId: user.id,
      username: user.username,
    })
  })
  ```
  **[A32 — INCONNU] pendingEntityActions timeout 60s :** emplacement exact non confirmé (SESSION_JOIN inline vs handler ENTITY_ACTION_REQUEST). À vérifier lors de l'Étape 5 en lisant ENTITY_ACTION_REQUEST. Si dans le handler → migre vers socketEntity.js. Si dans SESSION_JOIN → reste dans index.js.
  ⚠️ `SESSION_USER_LEFT` doit être conservé — sans lui, les clients ne reçoivent pas la notification de départ → indicateur "en ligne" cassé silencieusement. **Changement comportemental mineur (A05) :** un socket qui se connecte sans émettre SESSION_JOIN ne déclenchera plus `SESSION_USER_LEFT` — comportement amélioré (aucun utilisateur à notifier). **Double-inscription (A23) :** si SESSION_JOIN fire deux fois, ce handler est aussi enregistré deux fois → deux `SESSION_USER_LEFT` au départ. La mitigation [R8-11] (client détruit le socket à chaque reconnect) couvre ce cas. **Risque connu hors périmètre REWORK-08 :** les 6 Maps globales ne sont pas nettoyées au disconnect. Les Maps avec timeout auto-nettoyant (pendingEntityActions — 60s) sont tolérables. Les Maps combat sans timeout (pendingDamageActions, pendingMeleeDefense, pendingStunActions) fuient si un socket se déconnecte en milieu de résolution — bug Socket.IO documenté (#407, #3477). À adresser dans un sprint dédié post-REWORK-08 (ajouter cleanup ciblé par tokenId/campaignId dans ce handler).
- **[R8-4]** Les guards `if (!campaignId)` dans les handlers deviennent théoriquement inutiles (handlers enregistrés après SESSION_JOIN). Ne pas les supprimer dans ce rework — hors périmètre.
- **[R8-6]** `socketDice.js` — MACRO_ROLL (L.581–702) utilise une dizaine d'exports de `charStats.js`. Grep exhaustif obligatoire avant d'écrire les imports du module — oublier un export provoque une erreur runtime silencieuse (pas de `node --check` pour les imports manquants).
- **[R8-7]** `socketToken.js` — `checkTokenOwnership(db, token, userId, role)` attend une string `role`. Confirmé (socketUtils.js L.15 : `const isGm = role === 'gm'`). Passer `isGm ? 'gm' : 'player'` depuis le contexte. `socket.data.userId` et `socket.user.id` sont identiques (assignés L.163 de SESSION_JOIN) — `user.id` du contexte est correct pour les deux usages.
- **[R8-8]** Décalage numéros de ligne après chaque étape — les lignes L.364, L.518, L.753, L.1464 dans ce spec sont des guides basés sur le fichier source original (4 266 lignes). Après Étape 1 (-17L) et Étape 2 (-132L), ces numéros ne correspondent plus. Localiser les handlers par event name (`socket.on(WS.VOXEL_ADD,` etc.), jamais par numéro de ligne.
- **[R8-9]** `socketVoxel.js` — MAP_VIEWPORT (L.507–511) est **synchrone** (pas d'`async`/`try-catch`). Utilise `socket.to(campaignId)` (pas `io.to(campaignId)`) — intentionnel : le GM n'est pas destinataire de son propre viewport. Ne pas "uniformiser" avec les autres handlers.
- **[R8-10]** `socketVoxel.js` — `buildCollisionMap` listé dans l'Interface cible originale : **0 usage** dans les handlers voxel. Reste dans SESSION_JOIN (L.198 de index.js, non migré). Ne pas importer dans socketVoxel.js.
- **[R8-11]** Double enregistrement si SESSION_JOIN fire deux fois sur le même socket — chaque `registerXxxHandlers` appelé une deuxième fois enregistre les listeners en double → double DB write + double broadcast. Mitigation : le client React détruit le socket à chaque reconnect (`s.disconnect()` dans le cleanup useEffect de SessionPage) — un socket donné ne reçoit SESSION_JOIN qu'une seule fois. **Choix délibéré : pas de `socket.off()` pré-registration côté serveur (hors périmètre REWORK-08).** La mitigation repose sur un invariant client — si SessionPage change son pattern de reconnect, ajouter `socket.off(WS.ENTITY_ACTION_REQUEST)` (et analogues pour chaque domaine) avant chaque `registerXxxHandlers`.
- **[R8-12]** `socketDice.js` — Imports charStats : seuls 6 exports réellement utilisés dans L.518–748 (grep confirmé). `calcAttributeAN` **absent** malgré la mention "calcAttributeAN/NA" dans l'Interface cible — MACRO_ROLL n'utilise que `calcAttributeNA` (via `na(attrId)`). Les autres exports (`calcWoundPenalty`, `calcEncumbrancePenalty`, `ATTR_LABELS`, `lookupTable`, etc.) vont dans `socketCombat.js` uniquement. Importer uniquement les 6 listés en Étape 4.
- **[R8-13]** `socketDice.js` — `CHARACTER_UPDATED` est marqué "relique Chantier 1" (commentaire L.718 index.js). Migrer tel quel sans modifier ni supprimer — le nettoyage est hors périmètre de REWORK-08. Copier le commentaire avec le handler dans socketDice.js pour faciliter son identification lors d'un sprint futur.
- **[R8-14]** `socketEntity.js` — 6 écarts vs. Interface cible originale (corrigés en Étape 5) :
  1. `getModifier` manquait — utilisé L.1243 (ENTITY_MOVE_REQUEST) en tandem avec `getMrTable`.
  2. `collisionAddEntity` / `collisionRemoveEntity` / `woundService` listés à tort — 0 usage dans L.753–1457 (routes REST uniquement). Ne pas importer.
  3. `collisionMoveToken` manquait — ENTITY_MOVE_REQUEST déplace acteur ET entité ensemble (L.1411).
  4. `isCaseOccupied` manquait — ×4 dans la boucle step-by-step de ENTITY_MOVE_REQUEST (L.1324, L.1335, L.1346, L.1351).
  5. `calcAttributeAN` (L.935, ENTITY_ACTION_RESOLVE) ET `calcAttributeNA` (L.1228, ENTITY_MOVE_REQUEST) — les deux variantes nécessaires. L'Interface cible ne détaillait pas les exports charStats.
  6. `ATTR_LABELS` — importé depuis `charStats.js`, ×6 usages dans les handlers ENTITY (libellés attributs breakdown). À ne pas confondre avec `SITUATION_LABELS`/`PORTEE_LABELS` (domaine combat → socketCombat.js).
- **[R8-15]** `resolveEntityState` — double origine de `campaignId` dans les 5 call sites. Les 2 call sites directs (ENTITY_ACTION_REQUEST L.792, ENTITY_ACTION_GM_DIRECT L.1028) passent `socket.campaignId` → à substituer par `campaignId`. Les 3 call sites dans ENTITY_ACTION_RESOLVE (L.893 autoSuccess, L.899 !skillId, L.1010 isSuccess) passent `pending.campaignId` — valeur stockée dans `pendingEntityActions` lors de la demande initiale (L.831), potentiellement depuis la connexion du joueur (différente de celle du GM qui résout). Ne **jamais** substituer `pending.campaignId` par `campaignId` — le broadcast ENTITY_UPDATED partirait dans la room du GM, pas celle de la campaign, en cas de divergence.
- **[R8-16]** `socketCombat.js` — 3 handlers SANS `const campaignId = socket.campaignId` : `COMBAT_DAMAGE_CONFIRM` (`pending.campaignId` L.2329), `COMBAT_MELEE_DEFENSE_CONFIRM` (`meleeCampaignId = pending.campaignId` L.2487), `COMBAT_STUN_CONFIRM` (`pending.campaignId` L.2696). Dans ces 3 handlers, toutes les émissions io/socket utilisent la variable locale (`meleeCampaignId` ou déstructurée depuis `pending`) — jamais la `campaignId` du contexte. Confondre → broadcast dans la room du GM, pas la campaign.
- **[R8-17]** `socketCombat.js` — `resolveMeleeAction` est appelée avec `meleeCampaignId` (pas `campaignId`) dans `COMBAT_MELEE_DEFENSE_CONFIRM` (L.2657 — attaque suivante CaC 4b) et `advanceSlot(io, meleeCampaignId, ...)` (L.2668, L.2676). Le paramètre `campaignId` des helpers doit donc rester explicite et ne pas être tiré du contexte par défaut. Même en Enclume mono-campaign, conserver le paramètre pour la lisibilité et la cohérence.
- **[R8-18]** `socketCombat.js` — `io.fetchSockets()` SANS filtre room dans `resolveMeleeAction` (L.3494), `resolveReloadAction` (L.3541), `COMBAT_MELEE_DEFENSE_CONFIRM` (L.2601, L.2653). Ces appels filtrent manuellement par `s.campaignId` (propriété custom set à L.160 de SESSION_JOIN, reste inchangée post-rework). Ne pas "corriger" en `io.in(campaignId).fetchSockets()` — comportement existant intentionnel, hors périmètre REWORK-08.
- **[R8-19]** `socketCombat.js` — `resolveMeleeAction` est récursive (CaC multi-attack). **2 appels récursifs dans la fonction elle-même** : branche PNJ défenseur (≈ L.3451) + branche drone défenseur (≈ L.3484). Le 3e call depuis `COMBAT_MELEE_DEFENSE_CONFIRM` (≈ L.2657) est un appel externe pour l'attaque suivante après défense PJ — documenté séparément dans la table call sites. Les 3 calls doivent recevoir `pendingMaps`. Oublier `pendingMaps` sur un appel récursif → crash silencieux ("Cannot read properties of undefined") uniquement lors d'une attaque multiple, scénario difficile à détecter en test.
- **[R8-20]** `socketCombat.js` — `checkTokenOwnership` : **0 usage** dans L.1464–4266 (grep confirmé). L'Interface cible originale l'avait listé par erreur. Ne pas importer.
- **[R8-21]** `socketCombat.js` — `calcAttributeAN` : **0 usage** dans L.1464–4266. Uniquement dans les handlers ENTITY (L.935 ENTITY_ACTION_RESOLVE). Ne pas importer dans socketCombat.js.
- **[R8-22]** `socketCombat.js` — `SEVERITY_COLORS` depuis `shared/woundConstants.js` : utilisé dans `COMBAT_DAMAGE_CONFIRM` (L.2396) et `resolveDroneAssaultAction` (L.3844). Obligatoire malgré l'absence dans l'Interface cible originale.
- **[R8-23]** `socketCombat.js` — Imports `charStats.js` : 11 exports réellement utilisés dans L.1464–4266 (grep exhaustif). Dead imports du fichier source (`getShockMalus`, `getGenotypeModForAttr` — utilisés uniquement en interne par charStats/statusService) : **ne pas importer**. `calcSeuils`, `calcSouffle`, `calcResistanceDroguesInput`, `ATTR_LABELS` → domaine DICE/ENTITY exclusivement, **ne pas importer** dans socketCombat.js.
- **[R8-24]** `socketCombat.js` — **Architecture helpers : module-level + `pendingMaps` objet passé en dernier paramètre.** Rationale : évite les closures imbriquées (lisibilité), garde les helpers testables en isolation, reste explicite sur les dépendances. Coût : **19 call sites** (7 internes helper→helper + 12 externes handler→helper) ajoutent `, pendingMaps` — documentés exhaustivement en Étape 6 pour éviter tout oubli. Alternative closure écartée : appels récursifs de `resolveMeleeAction` avec `meleeCampaignId` cassent l'invariant "campaignId du contexte = campaignId en usage" — l'explicit parameter reste obligatoire dans tous les cas.
- **[R8-25]** `socketCombat.js` — Substitutions : 10 `const campaignId = socket.campaignId` à supprimer (pas à remplacer — `campaignId` vient directement du context destructuré dans la signature de `registerCombatHandlers`). ×12 `socket.role*` → `isGm`. ×13 `socket.user.id` → `user.id` (handlers uniquement — ne pas substituer dans les helpers où `socket` est un paramètre différent, ex. `attackerSocket`). ×6 `socket.user.username` → `user.username`. Deux cas avec `?.` (L.2554 : `socket.user?.id` / `socket.user?.username ?? 'Défenseur'`) — supprimer le `?.` : `user` du contexte est toujours défini. **Sémantique attackerSocket (A20) :** dans les helpers à paramètre `socket` explicite, `socket.user` = utilisateur propriétaire de CE socket (ex. attaquant dans `resolveMeleeAction` appelée depuis MELEE_DEFENSE_CONFIRM) ≠ `user` du contexte (défenseur). Ces deux valeurs sont différentes — voir [R8-28].
- **[R8-26]** `socketCombat.js` — `pendingDamageActions` dans `resolveMeleeAction` : **CONFIRMÉ ABSENT** (lecture L.3033–3517). `resolveMeleeAction` n'accède pas à `pendingDamageActions`. Destructuring correct dans la fonction :
  ```js
  const { pendingMeleeDefense, pendingStunActions } = pendingMaps
  ```
  Usages réels : `pendingMeleeDefense.set(targetTokenId, commonPending)` (L.3491) + `statusService.applyStun(..., pendingStunActions, ...)` (L.3442). `pendingDamageActions` appartient à `resolveDroneAssaultAction` et `resolveAssaultAction` — pas à `resolveMeleeAction`.
- **[R8-27]** `socketCombat.js` — **propriétés custom socket à préserver dans SESSION_JOIN** : `socket.campaignId = campaignId` (L.160), `socket.role = member.role` (L.161), `socket.user` (auth middleware). Ces 3 propriétés sont indispensables post-rework. Les helpers qui opèrent sur des sockets TIERS via `io.fetchSockets()` y accèdent — ex. `resolveMeleeAction` L.3494 : `sockets.find(s => s.campaignId === campaignId && s.user?.id === defenderCharacter.user_id)`. `context` remplace ces propriétés pour le socket courant — les sockets distants n'ont que leurs propriétés custom. Supprimer ces assignations casse `resolveMeleeAction` et `resolveReloadAction` silencieusement. Voir [R8-18] (io.fetchSockets sans filtre room).
- **[R8-28]** `socketCombat.js` — **`attackerSocket` ≠ socket courant dans `resolveMeleeAction`** : quand appelée depuis `COMBAT_MELEE_DEFENSE_CONFIRM`, le paramètre `socket` est l'`attackerSocket` (attaquant PJ, récupéré via `io.fetchSockets()`). `attackerSocket.user` = attaquant ≠ `user` du contexte (défenseur). Tout global-replace `socket.user → user.id` dans les helpers confond les deux rôles. [R8-25] documente la règle ; ce piège explique pourquoi.
- **[R8-29]** `socketCombat.js` — **`registerCombatHandlers` doit destructurer `context` ET `pendingMaps` en tête de fonction**, avant les 13 `socket.on(...)`. Les handlers y accèdent par closure. Pattern obligatoire :
  ```js
  export function registerCombatHandlers(io, socket, context, pendingMaps) {
    const { campaignId, user, isGm } = context
    const { pendingDamageActions, pendingMeleeDefense, pendingStunActions, combatTimers, combatPreviews } = pendingMaps
    socket.on(WS.COMBAT_START, ...)  // accède à campaignId, isGm, pendingDamageActions... par closure
    // ...
  }
  ```
  Si le destructuring `pendingMaps` est omis ou déplacé à l'intérieur d'un seul handler, les autres handlers lèvent `ReferenceError` au premier appel. `node --check` ne détecte pas les variables non définies dans les closures.
- **[R8-30]** `socketCombat.js` — **`resolveReloadAction` contient une fonction inner `emitResult`** qui utilise `socket.user?.id` (paramètre de la fonction parente, pas `user` du contexte) : `if (socket.user?.id === character.user_id)`. Ce `socket` est le socket de l'appelant — peut être le GM agissant pour un slot joueur. Une passe de substitution `socket.user?.id → user.id` ici confondrait le GM et le joueur cible, cassant silencieusement le ciblage `COMBAT_RELOAD_RESULT`. La règle "resolveReloadAction → inchangé" couvre ce cas — vérifier que la fonction inner n'est pas touchée.

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
| 9 | Assaut tir PJ → PNJ résolu | COMBAT_ACTION_CONFIRM (assault) → COMBAT_ATTACK_PLAYER_RESULT → COMBAT_DAMAGE_CONFIRM → COMBAT_DAMAGE_RESULT → blessure appliquée + WOUND_ADDED |
| 10 | Non-régression : session sans combat | Ouvrir session, chat, drag token, interaction entité, changement carte → 0 erreur console + 0 erreur serveur |
| 11 | COMBAT_SKIP_PLAYER — auto-skip timer | GM démarre annonce avec timer > 0 → joueur ne déclare pas → COMBAT_TURN_SKIPPED émis → slot suivant avancé |
| 12 | CaC PJ vs PNJ — PNJ auto-résolu | COMBAT_ACTION_CONFIRM (melee) → `resolveMeleeAction` → PNJ défenseur → `statusService.resolveShockTest` → COMBAT_ATTACK_RESULT room |
| 13 | CaC PJ vs PJ — défense interactive | COMBAT_ACTION_CONFIRM (melee) → `pendingMeleeDefense.set` → COMBAT_MELEE_DEFENSE_PROMPT joueur ciblé → COMBAT_MELEE_DEFENSE_CONFIRM → résolution opposition + slot avancé |
| 14 | Rechargement | COMBAT_ACTION_CONFIRM (reload) → `resolveReloadAction` → INVENTORY_UPDATED room + COMBAT_RELOAD_RESULT joueur |
| 15 | Fin de tour complet | Dernier slot annoncé → `startResolutionPhase` → `advanceSlot` jusqu'à `endTurn` → reset roster + COMBAT_PHASE_CHANGED ANNOUNCEMENT → nouveau tour |
| 16 | CaC PJ vs drone — branche récursive drone | COMBAT_ACTION_CONFIRM (melee, cible = drone) → `resolveMeleeAction` branche drone → hit + intégrité → récursion si multi-attack → 0 crash "Cannot read pendingMaps" |
| 17 | COMBAT_APPLY_STUN — GM applique étourdissement manuel | GM → `COMBAT_APPLY_STUN { tokenId, outcome, duration }` → guard `!isGm` → `statusService.applyStunWithDuration` → ROSTER_UPDATED room (aucun pendingMaps utilisé dans ce handler) |

### Definition of done

- [x] `node --check server/src/lib/mrTable.js` → 0 erreur ✓ (Session 107)
- [x] `node --check server/src/socket/socketToken.js` → 0 erreur ✓ (Session 106)
- [x] `node --check server/src/socket/socketVoxel.js` → 0 erreur ✓ (Session 106)
- [x] `node --check server/src/socket/socketDice.js` → 0 erreur ✓ (Session 107)
- [x] `node --check server/src/socket/socketEntity.js` → 0 erreur ✓ (Session 107)
- [x] `node --check server/src/socket/socketCombat.js` → 0 erreur ✓ (Session 108)
- [x] `node --check server/src/socket/index.js` → 0 erreur ✓ (Session 108)
- [x] `npm run build` → 0 erreur Vite ✓ (Session 108)
- [x] `wc -l server/src/socket/index.js` → 143 lignes ✓ (Session 108)
- [x] SR sans erreur à chaque étape ✓ (Session 108)
- [ ] Scénarios 1–17 validés (dont scénario 10 non-régression en priorité) — à valider en session combat
- [x] JOURNAL4.md appendé ✓ (Session 108)
- [ ] `ARCHI_REWORK_DONE.md` mis à jour — copier l'intégralité de la section REWORK-08 depuis ce fichier

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
