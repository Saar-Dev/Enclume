# JOURNALTEMP — Session 113 (2026-06-20) — Audit merge-readiness
> Scratch pad analytique — périssable. Consolider vers JOURNAL5.md en fin de session.

---

## ⚠️ INSTRUCTIONS DE RÉCUPÉRATION POST-COMPACT

Si tu reprends depuis un résumé ou un compact :
1. Lire `CLAUDE.md` en premier (instructions + méthode de travail)
2. Lire ce fichier en entier
3. Lire `client/src/lib/useCameraLOS.js` (état actuel)
4. Lire `client/src/components/Canvas3D.jsx` L.1-15 (imports) + L.380-395 + L.562-616 + L.766-830
5. Aller à la section **"REPRENDRE ICI"** en bas → implémenter FEAT2-C
NE PAS re-planifier. NE PAS poser de questions. Le plan est validé — coder directement.

---

## CONTEXTE

Un autre développeur va refondre intégralement le frontend (playground = SessionPage + éditeur = Editor3D).
L'objectif est d'évaluer la **merge-readiness** du codebase frontend actuel :
quelles features sont proprement segmentées (hook dédié, store dédié, composant autonome)
vs. encore couplées à SessionPage.jsx (monolithique).

Stack frontend confirmée : React 19 + Vite / Zustand / Three.js R3F.
La stack du confrère n'est pas encore connue (MVP en cours de téléchargement).

---

## GRILLE D'AUDIT — Questions par feature

| # | Question |
|---|---|
| Q1 | Logique métier dans SessionPage ou dans un hook/composant dédié ? |
| Q2 | Store dédié (Zustand) ou useState local dans SessionPage ? |
| Q3 | WS : extrait dans un useXxxSocket ou inline dans SessionPage ? |
| Q4 | Importable dans un nouveau frontend sans emporter SessionPage ? |
| V  | Verdict : ✅ Prêt / ⚠️ Partiel / ❌ Monolithique |

---

## RÉSULTATS D'AUDIT — SessionPage.jsx lu en entier (L.1–1296)

### RÉSUMÉ GLOBAL

SessionPage.jsx reste un **hub central** malgré REWORK-09.
- **28 variables `useState` locales**
- **~25 callbacks/handlers inline**
- **~12 WS listeners non extraits**
- Le nouveau développeur doit tout recréer pour remplacer SessionPage.

---

### ÉTAT LOCAL (28 useState dans SessionPage)

**Données session :**
- `campaign` — objet campagne complet (pas dans un store !) ← critique pour la fusion
- `loading`, `error`

**Mode/UI éditeur :**
- `mode` ('play'/'edit'/'combat') ← pivot central, toute la UI en dépend
- `layer`, `activeEditorTab`, `canvasVisible`
- `sidebarVisible`, `sidebarWidth`
- `activeMaterial`, `activeBlueprint`, `availableBlocks` ← éditeur 3D

**Fenêtres flottantes :**
- `selectedCharacterId`, `selectedDroneId` ← fiches personnages
- `statusPanel` ← panneau statuts token
- `instancePanel` ← config instance entité

**Menus contextuels :**
- `contextMenu` ← menu radial token
- `radialMenu` ← menu radial entité
- `mapContextMenu`, `showRenameModal`, `renameTarget`, `renameValue`
- `showCreateModal`, `createMapName`

**Combat UI :**
- `combatCameraCenter` ← centrage caméra
- `combatMoveMode`, `pendingMoveSelection` ← mode déplacement
- `combatTargetMode` ← mode sélection cible

**Autres :**
- `socket`, `reconnectTrigger`
- `losMode`, `losResult`
- `moveTarget` ← mode visée entité
- `lastDiceRoll` ← animation dés
- `woundVersions` ← Map{ charId → counter } hack reload CharacterWindow
- `gmSocketError`

---

### WS LISTENERS ENCORE INLINE (non extraits en hook)

| Event | Destination | Extrait ? |
|---|---|---|
| SESSION_JOINED | sessionStore.setOnlineUsers | ❌ inline |
| SESSION_USER_JOINED/LEFT | sessionStore + addMessage | ❌ inline |
| CAMPAIGN_SETTINGS_UPDATED | setCampaign (état local !) | ❌ inline |
| CHAT_MESSAGE | sessionStore.addMessage | ❌ inline |
| CHARACTER_UPDATED | characterStore.upsertCharacter | ❌ inline |
| DICE_RESULT | addMessage + setLastDiceRoll | ❌ inline (handler long) |
| WOUND_ADDED/UPDATED/REMOVED | setWoundVersions + updateCharacter | ❌ inline |
| INVENTORY_ADDED/UPDATED/REMOVED | setWoundVersions | ❌ inline |
| MACRO_ROLL_RESULT | addMessage | ❌ inline |
| DOC_CREATED/UPDATED/DELETED | libraryStore (1-liners) | ❌ inline mais trivial |
| reconnect | setReconnectTrigger | ❌ inline |
| TOKEN_* | useTokenSocket | ✅ extrait |
| ENTITY_* | useEntitySocket | ✅ extrait |
| COMBAT_* | useCombatSocket | ✅ extrait |

---

### HANDLERS INLINE PAR DOMAINE

**Cartes (8 handlers) :**
`loadMap`, `handleMapSwitch`, `handleMapRename`, `handleSetDefault`,
`handleGroupMove`, `handleMapDuplicate`, `handleMapDelete`, `handleMapCreate`
→ aucun hook dédié — tout inline

**Tokens (5 handlers) :**
`handleCharacterDrop` (créer), `handleTokenRotate` (émettre TOKEN_ROTATE),
`handleTokenDoubleClick` (ouvrir radial), `handleRemoveContextToken` (supprimer),
`handleSetContextTokenRotation` (orienter)

**Entités (4 handlers) :**
`handleEntityAction`, `handleEntityMove`, `handleEntityClick`, `handleEntityActionResolve`

**LOS (3 handlers — légers) :**
`handleLosCancel`, `handleLosResult`, `handleViser` (logique déléguée à losUtils)

**Combat UI (8 handlers) :**
`handleCombatToggle`, `handleSurpriseRolled`,
`handleEnterMoveMode`, `handleValidateMove`, `handleCancelPendingMove`,
`handleEnterTargetMode`, `handleValidateTarget`, `handleMoveCancel`

---

### TABLEAU DE VERDICT PAR FEATURE

| Feature | Q1 Dédié | Q2 Store | Q3 WS extrait | Q4 Importable | Verdict |
|---|---|---|---|---|---|
| LOS | ✅ useCameraLOS + losUtils | — (2 vars) | — (pas WS) | ✅ | ✅ Prêt |
| WS hooks (REWORK-09) | ✅ 3 hooks | ✅ stores | ✅ | ✅ | ✅ Prêts |
| Stores Zustand | ✅ 8 stores | ✅ | ✅ | ✅ | ✅ Prêts |
| Combat serveur | ✅ 5 modules + FSM + services | ✅ | ✅ | ✅ | ✅ Prêt |
| Bibliothèque | ⚠️ listeners inline (trivial) | ✅ libraryStore | ❌ | ⚠️ | ⚠️ Partiel |
| Entités | ⚠️ useEntitySocket ✅ mais CRUD inline | ✅ entityStore | ⚠️ | ⚠️ | ⚠️ Partiel |
| Tokens | ⚠️ useTokenSocket ✅ mais CRUD inline | ✅ tokenStore | ⚠️ | ⚠️ | ⚠️ Partiel |
| Fiches perso | ❌ WOUND_*/CHARACTER_UPDATED inline | ✅ characterStore | ❌ | ⚠️ | ⚠️ Partiel |
| Dés | ❌ DICE_RESULT inline (handler long) | — | ❌ | ⚠️ | ⚠️ Partiel |
| Chat | ❌ CHAT_MESSAGE inline | ✅ sessionStore | ❌ | ❌ | ❌ Monolithique |
| Cartes CRUD | ❌ 8 handlers inline, campaign hors store | ⚠️ mapStore partiel | — | ❌ | ❌ Monolithique |
| Éditeur 3D | ❌ états éditeur locaux (material, blueprint) | ❌ | — | ❌ | ❌ Monolithique |
| Combat UI | ❌ moveMode/targetMode locaux | ⚠️ combatStore limité | ⚠️ | ❌ | ❌ Monolithique |
| Mode/navigation | ❌ `mode` local | ❌ | — | ❌ | ❌ Monolithique |

---

### CE QUI MANQUERAIT POUR LA FUSION — Hooks à créer

| Hook | Contenu |
|---|---|
| `useSessionSocket` | SESSION_JOINED/LEFT, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, CHARACTER_UPDATED, DOC_* |
| `useCharacterSocket` | WOUND_ADDED/UPDATED/REMOVED, INVENTORY_* → remplace woundVersions hack |
| `useBattlemapManager` | loadMap, handleMapSwitch + 6 CRUD, campaign state → store |
| `useCombatUIState` | combatMoveMode, combatTargetMode, pendingMoveSelection, combatCameraCenter |

OU : fournir SessionPage comme **référence d'implémentation** que le confrère peut forker.

---

### PROPS DES COMPOSANTS CLÉS

**Canvas3D : 17 props depuis SessionPage**
Seule prop venant d'un hook : `announcementMarker={combatSocket.announcementMarker}`
Les 16 autres viennent d'état local SessionPage.

**CombatOverlay : ~28 props depuis SessionPage**
Mélange état local (combatMoveMode, combatTargetMode...) + combatSocket.xxx
Le confrère devra brancher les 28 props pour utiliser CombatOverlay tel quel.

---

## AUDIT COMPLET ✅

---

## FEAT2-B — LOS combat (résolution) — Spec technique
> Session 113 — spec validée. Coder sur accord Saar.
> Suite à compact : relire CLAUDE.md + docs/ARCHI_REWORK.md + ce fichier (section FEAT2-B) avant toute proposition.

### Réponses aux questions de règles (REGLESYSCOMBAT.md lu intégralement)

- **LOS en combat** : pas de règle explicite "ligne de vue" dans les règles. La mécanique proposée est une **règle maison** s'appuyant sur "couverture totale" (tir en aveugle, p.227) et "BALLES PERDUES" (optionnel, p.230).
- **Moment du check** : à la résolution. Pas à la déclaration.
- **LOS bloquée → échec automatique + munition gaspillée**.
- **Cible interposée → nouveau jet attaque/défense/dégâts contre elle** (cible la plus proche sur le rayon).
- **Options campagne** : A = annulation auto (défaut) | B = GM propose annulation au joueur (option)

### `losUtils.js` → portable serveur ?

`client/src/lib/losUtils.js` — imports : `fast-voxel-raycast` uniquement. Zéro React/Three.js/browser.
→ **100% portable**. Recommandation : déplacer vers `shared/losUtils.js`.

### Recommandation architecture FEAT2-B

**Option recommandée : `shared/losUtils.js`** (déplacer depuis client)
- 2 exports : `checkLOS` (existant) + `findInterceptingTokens` (nouveau)
- Zéro duplication de la logique PE14 + eye height

**`findInterceptingTokens(voxels, allTokens, srcToken, tgtToken)`**
→ retourne tokens sur le rayon src→tgt triés par distance (excl. src et tgt)
→ utilisé serveur uniquement (résolution combat)

**Injection dans socketCombat.js :**
- `resolveAssaultAction` (tir distance PJ/PNJ) → check LOS avant résolution
- `resolveDroneAssaultAction` → idem
- CaC = pas de LOS check (contact déjà établi)

**Question ouverte : format voxels serveur**
Client : `voxelsRef.current` = `{ "x:y:z": voxelObj }` (Redis → WS → store)
Serveur : Redis HGETALL `collision_map:{campaignId}:{battlemapId}` → format à vérifier avant implémentation

### Mathématiques `findInterceptingTokens` (connues, pas besoin de recherche)

```js
export function findInterceptingTokens(voxels, allTokens, srcToken, tgtToken) {
  const fx = srcToken.pos_x+0.5, fy = srcToken.pos_z+2.5, fz = srcToken.pos_y+0.5
  const tx = tgtToken.pos_x+0.5, ty = tgtToken.pos_z+2.5, tz = tgtToken.pos_y+0.5
  const dx = tx-fx, dy = ty-fy, dz = tz-fz
  const dist = Math.sqrt(dx*dx+dy*dy+dz*dz)
  if (dist < 0.001) return []
  const dir = [dx/dist, dy/dist, dz/dist]
  const result = []
  for (const t of allTokens) {
    if (t.id === srcToken.id || t.id === tgtToken.id) continue
    const vx = t.pos_x+0.5-fx, vy = t.pos_z+2.5-fy, vz = t.pos_y+0.5-fz
    const proj = vx*dir[0] + vy*dir[1] + vz*dir[2]
    if (proj < 0.5 || proj > dist-0.5) continue
    const perpSq = (vx-proj*dir[0])**2 + (vy-proj*dir[1])**2 + (vz-proj*dir[2])**2
    if (perpSq < 0.75**2) result.push({ token: t, dist: proj })
  }
  return result.sort((a,b) => a.dist - b.dist)
}
```

### Décision architecture (Session 113 — confirmée par Saar)

- **Pas de rework** — `socketCombat.js` propre (REWORK-08 + REWORK-04). Feature addition uniquement.
- **Module indépendant** : `server/src/lib/losService.js` — principe ARCHI_REWORK.md.
- **`socketCombat.js`** : appel minimal `checkCombatLOS(io, db, campaignId, action, character)` — zéro logique LOS dans l'appelant.
- **`shared/losUtils.js`** : `checkLOS` + `findInterceptingTokens` — partagé client/serveur.
- **CaC** : pas de LOS check — contact établi à la déclaration.
- **Option campagne** : `allow_los_cancel` boolean, défaut false (migration 82).
  - OFF (défaut) : LOS bloquée → échec auto + munition gaspillée. Interposé → redirect auto.
  - ON : LOS bloquée ou interposée → prompt joueur pour annuler (Bloc B — sprint séparé).

---

### Spec FEAT2-B — `losService.js`

#### Problème
`resolveAssaultAction` (L.2539) et `resolveDroneAssaultAction` (L.2278) ne vérifient aucune LOS. Un PJ peut toucher une cible derrière un mur ou via un token interposé sans conséquence. Règle maison : "tir en aveugle" (p.227) + "BALLES PERDUES" optionnel (p.230).

#### État actuel
- `socketCombat.js` L.2539 — aucun LOS check avant la résolution
- `socketCombat.js` L.2278 — idem
- `client/src/lib/losUtils.js` — `checkLOS` portable (zéro React/browser) — actuellement client uniquement
- Pas de `findInterceptingTokens` côté serveur
- `campaigns` — pas de colonne `allow_los_cancel` (migration 82 requise)
- Voxels serveur : `battlemaps.voxel_data` JSONB, clé `"x:y:z"` Three.js — même format que client ✅

#### Interface cible — `server/src/lib/losService.js`

```js
import { WS } from '../../../shared/events.js'
import { checkLOS, findInterceptingTokens } from '../../../shared/losUtils.js'

/**
 * Vérifie LOS et intercepteurs pour une action de tir distance.
 * Gère les notifications chat et décompte munition si nécessaire.
 *
 * @param {Object} io          — Socket.io server instance (broadcasts)
 * @param {Object} db          — Knex instance
 * @param {string} campaignId  — UUID
 * @param {Object} action      — { token_id, target_token_id, weapon_inv_id, bullet_count }
 * @param {Object} character   — { user_id, name, type } — garantis par COMBAT_ACTION_CONFIRM L.879
 * @returns {Promise<LosResult>}
 *   { result: 'clear' }                        — LOS dégagée, résolution normale
 *   { result: 'blocked' }                      — LOS bloquée, action terminée (caller doit return)
 *   { result: 'intercepted', newTargetTokenId } — redirect, caller relance avec nouvelle cible
 */
export async function checkCombatLOS(io, db, campaignId, action, character) {
  const [srcToken, tgtToken, campaign] = await Promise.all([
    db('tokens').where({ id: action.token_id }).select('pos_x','pos_y','pos_z','battlemap_id').first(),
    db('tokens').where({ id: action.target_token_id }).select('id','pos_x','pos_y','pos_z','label').first(),
    // pnj_unlimited_ammo récupéré ici pour éviter une 2e query dans _spendAmmo
    db('campaigns').where({ id: campaignId }).select('allow_los_cancel','pnj_unlimited_ammo').first(),
  ])
  if (!srcToken || !tgtToken) return { result: 'clear' }  // tokens introuvables → laisser passer
  // P-LOS7 — cross-battlemap : pas de LOS check entre deux cartes différentes
  if (srcToken.battlemap_id !== tgtToken.battlemap_id) return { result: 'clear' }

  const bmap = await db('battlemaps').where({ id: srcToken.battlemap_id }).select('voxel_data').first()
  const voxels = bmap?.voxel_data ?? {}

  const { clear } = checkLOS(voxels, srcToken, tgtToken)
  if (!clear) {
    // LOS bloquée — notification + munition gaspillée
    // Bloc B (allow_los_cancel=true) → prompt joueur — sprint séparé
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId: character.user_id, username: character.name ?? 'Inconnu', color: '#c86030',
      formula: '—', rolls: [], total: 0, isCriticalSuccess: false, isCriticalFail: false, seed: null,
      timestamp: new Date().toISOString(),
      skillLabel: 'Tir en aveugle — cible hors de vue',
      mechanicalTotal: 0, diffLabel: 'LOS bloquée', chancesDeReussite: 0, isSuccess: false, mr: 0, breakdown: [],
    })
    await _spendAmmo(db, action, character, campaign)
    return { result: 'blocked' }
  }

  // tokens — WHERE battlemap_id uniquement (tokens n'a pas de campaign_id)
  const allTokens = await db('tokens')
    .where({ battlemap_id: srcToken.battlemap_id })
    .select('id','pos_x','pos_y','pos_z','label')
  const interceptors = findInterceptingTokens(voxels, allTokens, srcToken, tgtToken)
  if (interceptors.length > 0) {
    const first = interceptors[0].token
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId: character.user_id, username: character.name ?? 'Inconnu', color: '#c86030',
      formula: '—', rolls: [], total: 0, isCriticalSuccess: false, isCriticalFail: false, seed: null,
      timestamp: new Date().toISOString(),
      skillLabel: `Cible interposée — tir redirigé vers ${first.label ?? 'token inconnu'}`,
      mechanicalTotal: 0, diffLabel: '', chancesDeReussite: 0, isSuccess: false, mr: 0, breakdown: [],
    })
    return { result: 'intercepted', newTargetTokenId: first.id }
  }

  return { result: 'clear' }
}

// Miroir exact de la logique L.2671-2683 de resolveAssaultAction (pnj_unlimited_ammo inclus)
async function _spendAmmo(db, action, character, campaign) {
  if (!action.weapon_inv_id) return  // drones n'ont pas weapon_inv_id → safe
  const isPnj = character.type === 'pnj'
  if (isPnj && (campaign?.pnj_unlimited_ammo ?? true)) return  // même défaut que L.2676
  const wAmmo = await db('char_inventory').where({ id: action.weapon_inv_id }).select('ammo_remaining').first()
  if (wAmmo?.ammo_remaining == null) return
  await db('char_inventory').where({ id: action.weapon_inv_id })
    .update({ ammo_remaining: Math.max(0, wAmmo.ammo_remaining - (action.bullet_count ?? 1)) })
}
```

#### Injection dans `socketCombat.js`

> `options = {}` — paramètre serveur interne, jamais dans le payload WS `action`. Propagé en cascade.

**`resolveAssaultAction` L.2539 — ajout paramètre `options = {}` + branchement drone propagé :**
```js
async function resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  try {
    if (character.type === 'drone') {
      // options propagé pour que _skipLos survive la cascade
      return resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps, options)
    }
    if (!action.weapon_inv_id || !action.target_token_id) return

    // ── LOS check — losService.js ────────────────────────────────────────────
    if (!options.skipLos) {
      const los = await checkCombatLOS(io, db, campaignId, action, character)
      if (los.result === 'blocked') return
      if (los.result === 'intercepted') {
        return resolveAssaultAction(io, socket, campaignId,
          { ...action, target_token_id: los.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
    }
    // ... suite inchangée
```

**`resolveDroneAssaultAction` L.2278 — ajout paramètre `options = {}` + injection après L.2306 :**
```js
async function resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  try {
    // ... weapon + isCaCWeapon (L.2280-2306) inchangés ...

    // ── LOS check (distance uniquement) ─────────────────────────────────────
    if (!isCaCWeapon && !options.skipLos) {
      const los = await checkCombatLOS(io, db, campaignId, action, character)
      if (los.result === 'blocked') return
      if (los.result === 'intercepted') {
        return resolveDroneAssaultAction(io, socket, campaignId,
          { ...action, target_token_id: los.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
    }
    // ... suite inchangée
```

**Import à ajouter en tête de `socketCombat.js` :**
```js
import { checkCombatLOS } from '../lib/losService.js'
```

#### Périmètre

**Fichiers touchés :**
| Fichier | Opération |
|---|---|
| `server/src/db/migrations/82_campaigns_los.js` | créé |
| `shared/losUtils.js` | créé (= losUtils.js client + findInterceptingTokens) |
| `client/src/lib/losUtils.js` | supprimé |
| `client/src/lib/useCameraLOS.js` | L.4 : import mis à jour |
| `server/src/lib/losService.js` | créé |
| `server/src/socket/socketCombat.js` | import + 2 injections |

**Fichiers NON touchés :**
- `resolveMeleeAction` — pas de LOS (CaC)
- `combatFSM.js`, `combat_pending`, `shared/events.js` — Bloc B uniquement
- Tous les autres handlers `socketCombat.js`
- Client stores, hooks, composants — Bloc B uniquement

#### Plan d'implémentation (ordre strict)

0. `cd server && npm install fast-voxel-raycast` — dépendance absente de `server/package.json` (P-LOS1)
1. Migration 82 : `allow_los_cancel` → `knex migrate:latest` ✅
2. Créer `shared/losUtils.js` (copie + `findInterceptingTokens` + guard cross-battlemap P-LOS7)
3. Update import `useCameraLOS.js` L.4 → build client ✅ (valide que `shared/` accessible depuis Vite)
4. Supprimer `client/src/lib/losUtils.js` → build client ✅ (valide que l'original n'est plus référencé)
5. Créer `server/src/lib/losService.js` → SR (node --check ne teste pas les imports — SR obligatoire)
6. Injection `resolveAssaultAction` + import `checkCombatLOS` → SR
7. Injection `resolveDroneAssaultAction` → SR
8. Tests V1–V5

#### Validation

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Tir distance, LOS dégagée, pas de token interposé | Résolution normale — aucune notification LOS |
| V2 | Tir distance, mur entre tireur et cible | Chat "Tir en aveugle", munition gaspillée, pas de jet |
| V3 | Tir distance, token T2 entre tireur et cible T1 | Notification redirect vers T2, résolution contre T2 |
| V4 | CaC (resolveMeleeAction) | Aucun LOS check — résolution normale |
| V5 | Drone distance, LOS bloquée | Même comportement que V2 |

#### Definition of done — Bloc A

- [ ] `fast-voxel-raycast` installé dans `server/package.json`
- [ ] Migration 82 appliquée — `allow_los_cancel` dans `campaigns`
- [ ] `shared/losUtils.js` créé — `checkLOS` + `findInterceptingTokens` — `node --check` OK
- [ ] `client/src/lib/losUtils.js` supprimé — build client ✅
- [ ] `client/src/lib/useCameraLOS.js` import mis à jour
- [ ] `server/src/lib/losService.js` créé — `node --check` OK
- [ ] `resolveAssaultAction` : injection après L.2545 + import `checkCombatLOS`
- [ ] `resolveDroneAssaultAction` : injection après L.2306 (si `!isCaCWeapon`)
- [ ] SR sans erreur
- [ ] V1–V5 validés

#### Bloc B — Option ON (sprint séparé)

Quand `allow_los_cancel = true` : LOS bloquée ou interposée → prompt WS au joueur.
Nécessite : `WS.COMBAT_LOS_BLOCKED` + `WS.COMBAT_LOS_DECISION` dans `shared/events.js`, nouveau handler `socketCombat.js`, `useCombatSocket.js` dialog, FSM sub_phase si nécessaire.
→ **Non implémenté dans ce sprint. Branche dans `checkCombatLOS` marquée `// Bloc B`.**

---

## REPRENDRE ICI — POST-COMPACT

> Contexte session 113 : FEAT2-C ✅ clos. FEAT2-B spec validée + analysée (autocritique + run à vide). Plan corrigé. Saar a donné l'accord "Je code ?" — **CODER DIRECTEMENT**, pas re-planifier.

### Lectures obligatoires avant de toucher un fichier
1. `CLAUDE.md` — méthode de travail
2. Ce fichier section **FEAT2-B** en entier (spec + plan corrigé ci-dessus)
3. `client/src/lib/losUtils.js` — contenu exact à copier dans `shared/`
4. `client/src/lib/useCameraLOS.js` L.4 — import à modifier
5. `server/src/socket/socketCombat.js` L.2539-2545 + L.2278-2310 — points d'injection exacts

### Plan validé — exécuter dans cet ordre strict

**Étape 0** — `cd server && npm install fast-voxel-raycast`
→ Confirmer dans `server/package.json` que la dép est ajoutée

**Étape 1** — Migration `server/src/db/migrations/82_campaigns_los.js`
```js
export const up = (knex) => knex.schema.table('campaigns', t => t.boolean('allow_los_cancel').defaultTo(false))
export const down = (knex) => knex.schema.table('campaigns', t => t.dropColumn('allow_los_cancel'))
```
→ `knex migrate:latest` ✅

**Étape 2** — Créer `shared/losUtils.js`
= contenu exact de `client/src/lib/losUtils.js` + `findInterceptingTokens` ajouté en bas
(code complet de `findInterceptingTokens` dans section ci-dessus "Mathématiques")
+ guard cross-battlemap intégrée dans `checkCombatLOS` (dans le service, pas dans losUtils)

**Étape 3** — Update import `client/src/lib/useCameraLOS.js` L.4
`'./losUtils.js'` → `'../../../shared/losUtils.js'`
→ `npm run build` (client) ✅

**Étape 4** — Supprimer `client/src/lib/losUtils.js`
→ `npm run build` (client) ✅ (confirme qu'aucun autre import ne référence ce fichier)

**Étape 5** — Créer `server/src/lib/losService.js`
Interface exacte dans section "Interface cible" ci-dessus.
Imports : `import { WS } from '../../../shared/events.js'` + `import { checkLOS, findInterceptingTokens } from '../../../shared/losUtils.js'`
→ SR ✅

**Étape 6** — `server/src/socket/socketCombat.js`
- Ajouter en tête : `import { checkCombatLOS } from '../lib/losService.js'`
- Modifier signature `resolveAssaultAction` → ajouter `options = {}` (8e param)
- Propager `options` dans le branchement drone L.2542-2543
- Injection LOS après L.2545
→ SR ✅

**Étape 7** — `server/src/socket/socketCombat.js`
- Modifier signature `resolveDroneAssaultAction` → ajouter `options = {}` (8e param)
- Injection LOS après L.2306 (`isCaCWeapon`), conditionnelle à `!isCaCWeapon`
→ SR ✅

**Étape 8** — Tests V1–V5 (voir tableau Validation ci-dessus)

### Ce qui NE change PAS
- `resolveMeleeAction` — aucune modification
- FSM / combat_pending / shared/events.js — Bloc B uniquement
- Tous les autres handlers socketCombat.js
- Client stores, hooks, composants (Bloc B uniquement)
- `COMBAT_ACTION_CONFIRM` call sites — `options` = `{}` par défaut, aucun changement requis

---

## FEAT2-C — Plan d'implémentation validé

> Contexte : FEAT2-A (LOS MVP) ✅ validé. FEAT2-C (caméra épaule droite) KO après bricolage.
> Principe ARCHI_REWORK.md : Canvas3D.jsx = appels uniquement. Logique LOS dans le service.

### État actuel des fichiers (après bricolage Session 112 — à corriger)

**`client/src/lib/useCameraLOS.js` :**
- L.25 : `justHandledTargetRef` ajouté mais non exposé — demi-mesure
- Signature actuelle : `(losMode, orbitRef)` — trop limitée
- Return actuel : `{ moveCameraToShoulder, restoreCamera }` — à remplacer

**`client/src/components/Canvas3D.jsx` :**
- L.13 : import `checkLOS` → doit migrer vers le hook
- L.383 : `const justHandledLosTargetRef = useRef(false)` → supprimer (logique du service)
- L.384 : `const [losLine, setLosLine] = useState(null)` → supprimer (state du service)
- L.387-389 : `useEffect losMode?.active → setLosLine(null)` → supprimer (effect du service)
- L.392 : destructuring `useCameraLOS` → mettre à jour
- L.562-576 : `handleLosTarget` useCallback → supprimer entier (logique du service)
- L.578-614 : `handleDragStart` → branche LOS et chemin non-LOS à corriger
- L.766-783 : `handlePointerUp` blocs LOS → remplacer par 2 lignes
- L.825 : deps `handlePointerUp` → `-onLosCancel +onPointerUp`

---

### `client/src/lib/useCameraLOS.js` — réécriture complète

**Imports finaux :**
```js
import { useRef, useState, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { checkLOS } from './losUtils.js'
```

**Signature :**
```js
export function useCameraLOS(losMode, orbitRef, voxelsRef, tokensRef, onLosResult, onLosCancel)
```

**Corps — ordre strict (P4) :**

```
1. const { camera } = useThree()

2. Refs internes :
   const savedCameraRef = useRef(null)
   const losModeRef = useRef(losMode)         ← miroir prop
   losModeRef.current = losMode               ← mis à jour chaque render
   const onLosResultRef = useRef(onLosResult)
   onLosResultRef.current = onLosResult
   const onLosCancelRef = useRef(onLosCancel)
   onLosCancelRef.current = onLosCancel
   const justHandledTargetRef = useRef(false)

3. const [losLine, setLosLine] = useState(null)

4. useEffect → clear losLine à l'activation
   if (losMode?.active) setLosLine(null)
   deps: [losMode]

5. useEffect → sauvegarder caméra (existant, inchangé)
   if (losMode?.active && orbitRef.current && !savedCameraRef.current)
     savedCameraRef.current = { position: camera.position.clone(), target: orbitRef.current.target.clone() }
   deps: [losMode?.active, camera, orbitRef]

6. moveCameraToShoulder (existant, inchangé, devient interne)
   deps: [camera, orbitRef]

7. restoreCamera (existant, inchangé, devient interne)
   deps: [camera, orbitRef]

8. onTokenClick(tgt) — DÉCLARÉ APRÈS moveCameraToShoulder (P4)
   deps: []   ← tous les accès via refs stables
   Corps :
     src = tokensRef.current.find(t => t.id === losModeRef.current?.sourceTokenId)
     if (!src || !tgt) { onLosCancelRef.current?.(); return }
     if (tgt.id === src.id) return   ← P-LOS5 : clic sur soi-même
     { clear } = checkLOS(voxelsRef.current, src, tgt)
     from = [src.pos_x+.5, src.pos_z+2.5, src.pos_y+.5]   ← PE14 + eye height
     to   = [tgt.pos_x+.5, tgt.pos_z+2.5, tgt.pos_y+.5]
     setLosLine({ from, to, clear })
     onLosResultRef.current?.({ clear })
     justHandledTargetRef.current = true   ← AVANT onLosCancel (sinon guard inutile)
     onLosCancelRef.current?.()
     moveCameraToShoulder(src, tgt)

9. clearLine() — DÉCLARÉ APRÈS restoreCamera (P4)
   deps: [restoreCamera]
   Corps : setLosLine(null) ; restoreCamera()

10. onPointerUp(isDragging) — DÉCLARÉ APRÈS restoreCamera (P4)
    deps: [restoreCamera]
    Corps :
      if (justHandledTargetRef.current) { justHandledTargetRef.current = false; return true }
      if (losModeRef.current?.active && !isDragging) { onLosCancelRef.current?.(); setLosLine(null); restoreCamera(); return true }
      if (!isDragging) { setLosLine(null); restoreCamera(); return false }
      return false

11. return { losLine, onTokenClick, onPointerUp, clearLine }
```

---

### `client/src/components/Canvas3D.jsx` — changements minimaux

**Edit 1 — supprimer import checkLOS (L.13) :**
`import { checkLOS } from '../lib/losUtils.js'` → supprimer cette ligne

**Edit 2 — zone LOS refs/state (L.383-392) :**
Remplacer :
```js
  const justHandledLosTargetRef = useRef(false)
  const [losLine, setLosLine] = useState(null)

  // Nouveau check LOS → efface le résultat précédent...
  useEffect(() => {
    if (losMode?.active) setLosLine(null)
  }, [losMode])

  // ─── Caméra LOS v2 — hook dédié ─────────
  const { moveCameraToShoulder, restoreCamera } = useCameraLOS(losMode, orbitRef)
```
Par :
```js
  // ─── LOS v2 — service complet (client/src/lib/useCameraLOS.js) ──────────
  const { losLine, onTokenClick, onPointerUp, clearLine } = useCameraLOS(
    losMode, orbitRef, voxelsRef, tokensRef, onLosResult, onLosCancel
  )
```

**Edit 3 — supprimer handleLosTarget (L.562-576) entier :**
Supprimer le bloc complet `// ─── LOS : calcul...` → `}, [onLosCancel, onLosResult, moveCameraToShoulder])`

**Edit 4 — handleDragStart (L.578-614) :**
Remplacer le corps actuel par :
```js
  const handleDragStart = useCallback((e, token) => {
    e.stopPropagation()
    if (e.nativeEvent.button !== 0) return
    if (combatMoveModeRef.current) return
    if (combatTargetModeRef.current) {
      combatTargetModeRef.current.onPendingTarget(token.id, e.clientX, e.clientY)
      return
    }
    if (losModeRef.current?.active) {
      onTokenClick(token)
      return
    }
    clearLine()

    if (!isGm) {
      const character = characters.find(c => c.id === token.character_id)
      if (!character || character.user_id !== user?.id) return
    }
    dragRef.current = {
      active: true, tokenId: token.id, token,
      startX: e.clientX, startY: e.clientY,
      hasMoved: false, prevWorldX: null, prevWorldZ: null,
      snappedX: null, snappedZ: null, surfaceY: null,
    }
    if (orbitRef.current) orbitRef.current.enabled = false
  }, [isGm, user, characters, onTokenClick, clearLine])
```

**Edit 5 — handlePointerUp blocs LOS (L.766-783) :**
Remplacer le bloc actuel (Guard P-LOS13 + LOS backdrop + non-drag) :
```js
    // Guard P-LOS13 : pointerUp du clic cible LOS...
    if (justHandledLosTargetRef.current) { ... }
    // LOS mode actif + clic backdrop...
    if (losModeRef.current?.active && !dragRef.current.active) { ... }
    if (!dragRef.current.active) { ... }
```
Par :
```js
    if (onPointerUp(dragRef.current.active)) return
    if (!dragRef.current.active) return
```

**Edit 6 — deps handlePointerUp (L.825) :**
`onLosCancel` → supprimer ; `onPointerUp` → ajouter

---

### Scénarios de validation (à faire après SR)

| # | Action | Résultat attendu |
|---|---|---|
| V1 | Clic "Vue" sur token source | Mode LOS actif, caméra sauvegardée |
| V2 | Clic sur token cible (LOS dégagée) | Ligne verte, overlay "dégagée", caméra épaule droite |
| V3 | Clic sur token cible (LOS bloquée) | Ligne rouge, overlay "bloquée", caméra épaule droite |
| V4 | Clic sur fond (backdrop) | Ligne disparaît, caméra restaurée, mode annulé |
| V5 | Drag d'un token (non-LOS) | Ligne précédente disparaît, caméra restaurée |
| V6 | Token en altitude | LOS + caméra corrects (eye height pos_z+2.5) |
