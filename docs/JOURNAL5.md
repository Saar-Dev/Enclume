# JOURNAL5.md — Historique sessions Enclume
> Créé Session 109 — 2026-06-19
> Suite de JOURNAL4.md (archivé dans docs/Old/)

---

## Session 109 — 2026-06-19 — Triage docs + housekeeping

### Travail effectué

**Triage BUGIDENTIFIE.md :**
- Vérification liste bugs contre état connu — DR1 confirmé clos Session 95 (non réapparu)
- Ajout FEAT1 (Map2D style Roll20) — fonctionnalité non enregistrée
- Ajout FEAT2 (LOS raycast vérification cible) — fonctionnalité non enregistrée
- Date header mise à jour : Session 109

**Housekeeping docs/ :**
- Nettoyage manuel par Saar : REWORK-03.md, REWORK-05.md, JREWORKCAC.md, REWORK_CONTACT.md, PLAN_ARCHICOMBAT_SLOTS.md, PLAN_CHATDETAILS.md, PLAN_REWORK10_COMBATDECLARELOG.md, ANALYSETEMP.md, JOURNALTEMP.md supprimés ou archivés
- JOURNAL4.md → docs/Old/
- JOURNAL5.md créé (ce fichier)
- CLAUDE.md : référence JOURNAL4 → JOURNAL5

### Testé
- Aucun code modifié — session documentation uniquement

### Non testé
- N/A

---

### Session 109 — suite (reprise après compaction)

**Relecture CLAUDE.md (protocole post-compaction) :**
- Header `Session 108 → Session 109`
- `JOURNAL4.md → JOURNAL5.md` ×2 dans PROTOCOLE (§Pendant le développement + §Après chaque tâche)
- ÉTAT COURANT : ajout Session 108 (REWORK-08 Étapes 6 & 7) + Session 109 (housekeeping) — Session 108 n'avait jamais été écrite dans le fichier
- Référence `PLAN_REWORK10_COMBATDECLARELOG.md` (fichier supprimé) → remplacée ×2

**ASBUILT.md — mise à jour Sessions 102–108 :**
- Header : Session 101 → Session 109
- Ajout 3 hooks REWORK-09 : `useTokenSocket.js` + `useEntitySocket.js` + `useCombatSocket.js` (client/src/lib/)
- Ajout 5 modules REWORK-08 : `socketToken/Voxel/Dice/Entity/Combat.js` (server/src/socket/)
- Ajout `socketUtils.js` + `mrTable.js` (server/src/lib/)
- SessionPage.jsx + Sidebar.jsx + socket/index.js : notes Sessions 103/106c/108

**CHANGELOG.md :**
- v109 ajouté : REWORK-08 Étapes 6 & 7 (socketCombat.js + index.js 143L)
- v110 ajouté : Session 109 housekeeping

---

### Session 109 — suite 2

**Confirmations tests reçues de Saar :**
- REWORK-10 scénarios 1–8 ✅ validés précédemment → UI1 clos complet
- REWORK-03 tests ✅ validés précédemment → REWORK-03 clos complet

**TOK1 — Rotation token :**
- Comportement camera-dépendant confirmé en jeu — certaines orientations correctes selon la caméra
- Pas une simple inversion — investigation dédiée requise avant tout code
- BUGIDENTIFIE.md mis à jour

**WS1 ✅ clos Session 109 :**
- `client/src/pages/WorkshopPage.jsx` — 5 catch handlers (L96, L120, L133, L146, L156)
- `err.response?.data?.error` → `err.response?.data?.error || err.response?.data?.message || err.message`
- Testé : build client ok
- Non testé : provoquer une erreur réelle dans l'Atelier en session

### Testé
- Build client (npm run build ou Vite dev) — aucune erreur de compilation

### Non testé
- Provoquer une erreur dans WorkshopPage (import invalide, réseau coupé) → vérifier message plus précis

---

## Session 110 — 2026-06-20 — REWORK-04 : FSM Combat + DB persistence

### Travail effectué

**A1 — `server/src/lib/combatFSM.js` créé :**
- Table TRANSITIONS : 6 états (`null|null`, `ROSTER|null`, `ANNOUNCEMENT|null`, `RESOLUTION|SLOT_ACTIVE`, `RESOLUTION|AWAITING_DEFENSE`, `RESOLUTION|AWAITING_DAMAGE`)
- Exports : `canTransition(phase, subPhase, event)`, `nextState()`, `setFSMSubPhase(db, campaignId, subPhase)`, `allowedEvents()`

**B1 — Migration 80 : table `combat_pending` :**
- PK composite `(campaign_id, token_id, type)` — stun coexiste avec melee_defense pour un même token
- CHECK constraint : `type IN ('melee_defense', 'damage', 'stun')`
- FK CASCADE : `campaign_id → campaigns`, `token_id → tokens`

**B2 — Migration 81 : colonne `sub_phase` dans `combat_state` :**
- TEXT nullable + CHECK `('SLOT_ACTIVE','AWAITING_DEFENSE','AWAITING_DAMAGE')`
- Migrations 80 et 81 appliquées (`migrate:list` confirmé)

**A2 — Guards `canTransition` dans `socketCombat.js` (10 handlers) :**
- Pattern : lecture `phase + sub_phase` depuis `combat_state`, `canTransition()`, `console.warn + return` si bloqué
- Handlers 1–7 : guard dans le try block
- Handlers 8–10 (COMBAT_DAMAGE/DEFENSE/STUN_CONFIRM) : guard avant le try (cohérent avec pending check existant)

**B3 — `pendingMeleeDefense` Map → DB :**
- `COMBAT_MELEE_DEFENSE_CONFIRM` : `Map.get/delete` → `db('combat_pending').where().first()/.delete()` + `setFSMSubPhase(SLOT_ACTIVE)`
- `resolveMeleeAction` : `Map.set()` → `db('combat_pending').insert()` + `setFSMSubPhase(AWAITING_DEFENSE)`

**B4 — `pendingDamageActions` Map → DB (4 sites) :**
- `COMBAT_DAMAGE_CONFIRM` : Map → DB + `setFSMSubPhase(SLOT_ACTIVE)`
- COMBAT_MELEE_DEFENSE_CONFIRM (damage after hit) : `Map.set(attackerTokenId)` → DB avec `meleeCampaignId` + `setFSMSubPhase(AWAITING_DAMAGE)`
- `resolveDroneAssaultAction` : DB insert + `targetUserId` dans payload ([R4-2])
- `resolveAssaultAction` PJ : Map → DB + `setFSMSubPhase(AWAITING_DAMAGE)`

**B5 — `pendingStunActions` Map → DB :**
- `statusService.applyStun` : signature sans `pendingStunActions` + 2 `Map.set()` → `db('combat_pending').insert()` (pas de `setFSMSubPhase` — stun non-bloquant)
- `COMBAT_STUN_CONFIRM` : Map → DB (pas de `setFSMSubPhase`)
- 5 call sites `applyStun` dans `socketCombat.js` : argument `pendingMaps.pendingStunActions` supprimé

**B6 — `index.js` : 3 Maps supprimées :**
- `pendingDamageActions`, `pendingMeleeDefense`, `pendingStunActions` supprimées
- `registerCombatHandlers(io, socket, context, { combatTimers, combatPreviews })` — signature allégée

**C1 — `combatStore.js` :**
- Ajout champ `subPhase: null`, action `setCombatSubPhase(subPhase)`, `subPhase: null` dans `resetCombat`
- `setCombatState` accepte `subPhase`

**C2 — `useCombatSocket.js` :**
- Handler `COMBAT_STATE_SYNC` : `subPhase: combatState.sub_phase ?? null` ajouté dans l'appel `setCombatState`

**C3 — `index.js` SESSION_JOIN — restauration `combat_pending` :**
- Si `activeCombat.phase === 'RESOLUTION'` : lookup token du joueur reconnectant, re-emit ciblé MELEE_DEFENSE/DAMAGE/STUN_PROMPT
- [R4-2] drone assault : `payload->>? = ?` avec binding knex pour `targetUserId`

**C4 — `COMBAT_STATE_SYNC` no-op :** 1 seul site, `SELECT *` inclut `sub_phase` automatiquement.

### Testé
- `node --check` : `combatFSM.js`, `socketCombat.js`, `statusService.js`, `index.js` ✅
- `npm run build` client ✅
- `migrate:list` : migrations 80 et 81 dans la liste "Completed" ✅

### Non testé
- Cycle de combat complet en session réelle (V1–V12 scénarios ARCHI_REWORK.md)
- Reconnexion pendant RESOLUTION (C3 — restauration prompts)
- Guard FSM en conditions réelles (handlers bloqués hors-phase)
- Drone assault + reconnexion cible (R4-2)

---

## Session 111 — suite — 2026-06-20 — Validation REWORK-04 + nouveaux bugs

### Validation REWORK-04 en session réelle
- Cycle de combat complet testé — rien à signaler ✅
- V1–V12 considérés validés (aucune régression observée)
- REWORK-04 ✅ clos complet

### Nouveaux bugs identifiés (ajoutés BUGIDENTIFIE.md)
- **COM12** [INCONNU] : Mode de tir — chips CC/RC/RF affichés sans vérifier les modes disponibles de l'arme (`fire_mode_cc/rc/rl` dans `ref_equipment`)
- **COM13** [HYPOTHÈSE] : Assaut tir joueur — "Tir simple" affiché coché par défaut mais `selectedFireMode` init à null → "Déclarer" bloqué jusqu'au re-clic

---

## Session 112 — 2026-06-20 — FEAT2-A : LOS outil menu radial (en cours)

### Architecture retenue (après analyse itérative)

**Problème rencontré :** `<Line>` (drei) ne rendait pas en 3D — échec silencieux WebGL sans exception JS. Diagnostic impossible sans console. Deux tentatives de fix timing (`justSetLosRef`) insuffisantes.

**Décision architecturale finale :** séparation des préoccupations stricte :
- `checkLOS()` dans `losUtils.js` — fonction pure, testable sans React
- Ray 3D dans Scene — `<line>` natif (même pattern que `targetLinePoints` L.1003, prouvé)
- Résultat texte dans SessionPage — overlay DOM (même pattern que bannière mode LOS, prouvé)
- Callback `onLosResult` — interface minimale Scene → SessionPage (même pattern que `onTokenDoubleClick`)
- Suppression P-LOS6 (guard "clic backdrop efface ligne") — la ligne 3D persiste jusqu'au prochain check (bon UX VTT, référence spatiale)

### Fichiers modifiés

**`client/src/lib/losUtils.js`** ✅ créé (sessions précédentes)
- `checkLOS(voxels, fromToken, toToken)` — pur, PE14, eye height +0.75

**`client/src/locales/fr.json`** ✅
- Clés : `los.selectTarget`, `los.clear`, `los.blocked`
- `tokenRadial.viser` : "Viser" → "Vue"

**`client/src/components/TokenRadialMenu.jsx`** ✅
- Secteur "viser" enabled : false → true ; `onViser` prop + handler

**`client/src/components/Canvas3D.jsx`**
- Import drei : `Line` retiré (remplacé par `<line>` natif)
- Scene : prop `onLosResult` ajoutée
- `losLine` state conservé (coordonnées 3D du ray)
- `losLineRef`, `justSetLosRef` supprimés (P-LOS6 supprimé — plus nécessaires)
- `handleLosTarget` : appelle `onLosResult({ clear })` + `setLosLine` + `onLosCancel` ; deps `[onLosCancel, onLosResult]`
- `handlePointerUp` : P-LOS6 supprimé — P-LOS13 conservé (annulation mode sur clic backdrop)
- JSX : `<Line>` + `<Billboard>` → `<line>` natif bufferGeometry

**`client/src/pages/SessionPage.jsx`**
- `losResult` state `{ clear } | null`
- `handleLosResult` callback (stable, deps [])
- `handleViser` : `setLosResult(null)` avant setLosMode (reset check précédent)
- Overlay DOM résultat : vert/rouge, cliquable pour fermer

### Testé
- `npm run build` client ✅

### Non testé
- SR + validation fonctionnelle complète (V1–V10)

---

### Session 112 — suite — COM12 : Reset fire_mode si mode indisponible pour l'arme

**Cause racine [VÉRIFIÉ] :**
- `CombatGmDeclareWindow.jsx` : `InlineChip` fire_mode pouvait afficher/soumettre un mode invalide si `localStates.fire_mode` (chargé depuis `activePnjEntry.state_fire_mode`) n'était pas dans `availableFireModes` de l'arme équipée. Pas de reset automatique au chargement arme.
- `CombatActionWindow.jsx` : même problème — `states.fire_mode` chargé depuis `rosterEntry.state_fire_mode`, pas resetté quand `assaultWeapons` change. `currentFireMode` dérivé du state invalide → `computeFireVariant` retournait un variant → `assaultValid = true` → payload soumis avec mauvais mode.

**Fix :**
- `CombatGmDeclareWindow.jsx` : `useEffect([activeTokenId, equipment])` — lit `equipment[activeTokenId]?.weapon`, reset `localStates.fire_mode` au premier mode disponible si invalide.
- `CombatActionWindow.jsx` : `useEffect([assaultWeapons])` — recalcule modes depuis `assaultWeapons`, reset `states.fire_mode` si invalide.
- Piège TDZ corrigé : première version utilisait `weapon?.inv_id` et `assaultWeaponId`/`forceCC` dans les dep arrays — variables déclarées après le `useEffect` call → `ReferenceError` écran noir → remplacé par `equipment`/`assaultWeapons` (useState disponibles dès le début).

**Testé :** SR ✅, fonctionnel confirmé Saar.
**Non testé :** Scénario exact avec `state_fire_mode` DB incompatible arme (ex : PNJ avec Gem 400 RL-only et state_fire_mode='cc' sauvegardé) — nécessite session combat réelle.

---

### Session 112 — suite 2 — COM13 : "Tir simple" joueur débloqué sans re-clic

**Cause racine [VÉRIFIÉ] :** `computeFireVariant(currentFireMode, assaultBulletCount, assaultVariantAB)` appelé sans 4e argument dans `CombatActionWindow.jsx` → `defaultCcCount = null` → `effectiveBulletCount = null` quand `assaultBulletCount = null` → `currentVariant = null` → `assaultValid = false` → "Déclarer" grisé. Le GM utilise `{ defaultCcCount: 1 }` — le joueur ne le passait pas.

**Fix :** ajout `{ defaultCcCount: 1 }` à l'appel `computeFireVariant` dans `CombatActionWindow.jsx`. Commentaire `combatSections.js` L187 mis à jour (les deux contextes utilisent maintenant `defaultCcCount: 1`).

**Testé :** SR ✅, fonctionnel confirmé Saar.
**Non testé :** Transition répétition → retour CC (comportement attendu correct selon logique).

---

### Session 112 — suite 4 — FEAT2-C : Caméra LOS v2 ✅ clos complet

**Fix implémenté — architecture feature-as-service (ARCHI_REWORK.md) :**

`client/src/lib/useCameraLOS.js` réécrit intégralement :
- Nouvelle signature : `(losMode, orbitRef, voxelsRef, tokensRef, onLosResult, onLosCancel)`
- Nouveaux exports : `{ losLine, onTokenClick, onPointerUp, clearLine }`
- Refs miroirs P40 : `losModeRef`, `onLosResultRef`, `onLosCancelRef` — stale closures évitées dans les useCallbacks (deps: [])
- `onTokenClick(tgt)` : `checkLOS` + `setLosLine` + `onLosResultRef` + guard P-LOS13 + `moveCameraToShoulder`
- `justHandledTargetRef.current = true` posé AVANT `onLosCancelRef.current?.()` — sinon le guard est inutile (mode null avant pointerUp)
- `onPointerUp(isDragging)` : consomme le guard (return true = géré), annule sur backdrop, efface sur clic fond
- `clearLine()` : `setLosLine(null) + restoreCamera()` — chemin non-LOS uniquement

`Canvas3D.jsx` — 6 edits (zéro logique LOS dans le composant) :
- Import `checkLOS` retiré
- `justHandledLosTargetRef` + `[losLine, setLosLine]` + `useEffect` + destructuring remplacés par 1 appel `useCameraLOS(...)`
- `handleLosTarget` useCallback supprimé (14 lignes)
- `handleDragStart` : branche LOS → `onTokenClick(token)` ; chemin non-LOS → `clearLine()`
- `handlePointerUp` : 3 blocs LOS (18 lignes) → `if (onPointerUp(dragRef.current.active)) return`
- Deps `handlePointerUp` : `-onLosCancel +onPointerUp`
- Bug TDZ corrigé : `useCameraLOS` déplacé après `voxelsRef` (const déclaration non hoistée)

**Testé :** SR ✅, fonctionnel confirmé (Saar).
**Non testé :** scénarios V1–V6 non confirmés individuellement.

---

### Session 112 — suite 3 — FEAT2-A : LOS outil menu radial ✅ clos complet

**Bug corrigé : eye height `pos_z + 0.75` → `pos_z + 2.5`**

Cause racine : `pos_z + 0.75` plaçait le départ du rayon à world Y=0.75, DANS le voxel sol (Y=[0,1] pour pos_z=0). `fast-voxel-raycast` détecte immédiatement le voxel de départ → `clear: false` systématique. La ligne 3D à la même hauteur était occultée par la géométrie du sol → invisible.

Correction : `pos_z + 2.5` = pieds (pos_z+1.0, surface voxel) + 1.5 (mi-torse token 2-cases humanoïde). Confirmé par la chaîne de positionnement : `TokenMesh group = pos_z+0.5`, `Y_OFFSET = +0.5` → pieds world = `pos_z+1.0`. Convention `pos_z+1.5` des lignes existantes (targetLinePoints, announcement) calibrée pour token 1-case — incorrecte pour token 2-cases.

Fichiers modifiés : `losUtils.js` (fy, ty ×2) + `Canvas3D.jsx` `handleLosTarget` (from[1], to[1] ×2).

**Testé :** SR ✅, V1–V6 validés (bannière, ray vert, ray rouge, overlay cliquable, reset sur nouvelle "Vue", annulation clic fond).

---

## Session 113 — 2026-06-21 — REWORK-06 : planification declarationReducer

### Travail effectué

Planification complète de REWORK-06 dans `docs/PLAN_REWORK06.md` :
- Recherche documentée (tkdodo.eu, pmndrs/zustand issues, React docs, Foundry VTT) → décision `useReducer` partagé (PAS Zustand global)
- Lecture intégrale `CombatGmDeclareWindow.jsx` (975L) + `CombatActionWindow.jsx` (1474L) + `combatStore.js`
- 6 actions définies : `SET_FIELD`, `SET_COMBAT_MODE`, `SET_QUICK`, `SELECT_ATTACK`, `RESET`, `RESET_NEW_TURN`
- 14 pièges identifiés (P-R06-1 à P-R06-14) — stateChanged Object.keys, RESET_NEW_TURN vs RESET, SELECT_ATTACK auto-draw, payload handleDeclare sans spread, etc.
- 3 étapes planifiées + inventaire exhaustif par étape

**Testé :** — (session planification — aucun code)
**Non testé :** —

---

## Session 114 — 2026-06-21 — REWORK-06 : declarationReducer ✅ clos complet

### Travail effectué

**Étape 1 — `client/src/lib/declarationReducer.js` créé**
- Reducer pur, zéro import React, zéro effet de bord
- `DECLARATION_INITIAL` + 6 actions (`SET_FIELD`, `SET_COMBAT_MODE`, `SET_QUICK`, `SELECT_ATTACK`, `RESET`, `RESET_NEW_TURN`)
- `npm run build` ✅

**Étape 2 — `CombatGmDeclareWindow.jsx` migré**
- 3 useState (`localStates`, `localQuick`, `combatMode`) → `useReducer(declarationReducer, DECLARATION_INITIAL)`
- Reset → `dispatch({ type: 'RESET', payload: { ...initialStates } })`
- Auto-draw → `dispatch({ type: 'SELECT_ATTACK' })` (P-R06-11 ✅, P-R06-12 ✅)
- Zéro résidu grep vérifié — `npm run build` ✅

**Étape 3 — `CombatActionWindow.jsx` migré**
- 3 useState (`states`, `quick`, `combatMode`) → `useReducer(declarationReducer, DECLARATION_INITIAL)`
- Effet L.96–105 redondant supprimé (P-R06-9 ✅)
- Reset 2 → `RESET_NEW_TURN` (P-R06-4 ✅ — préserve position/weapon)
- Auto-sélection arme CaC supprimée → null = mains nues (P-R06-6 ✅) — COM4 ✅ résolu
- Blocage assaut weapon !== drawn supprimé → `SELECT_ATTACK` auto-draw dans handleMapToggle
- `decl.combatMode` dans COMBAT_ANNOUNCE_PREVIEW payload + deps (P-R06-10 ✅)
- `Object.keys(initialStates.current)` pour stateChanged (P-R06-11 ✅)
- `onModeChange` lit `decl.combatMode` avant dispatch = intentionnel (P-R06-14 ✅)
- Zéro résidu grep vérifié — `npm run build` ✅ 1.43s

**Bugs corrigés pendant validation V1–V15 :**
- Bug 1 : "Assaut (tir)" grisé non cliquable → onClick ajouté sur div `isAmmoEmpty` + `cursor: 'pointer'`
- Bug 2 : PC23 Tir Automatique → typo `'TIR_AUTOMATIQUE'` → `'TIR_AUTOMATIQUES'` dans `socketCombat.js`
- Bug 3 : Curseur interdit GM Assaut weaponNotDrawn → `disabled` seul déclenche `actionBtnDisabled`, `weaponNotDrawn` → opacity uniquement

**Testé :** SR ✅, V1–V15 validés (confirmation Saar). COM4 ✅ mains nues. PC23 ✅ Tir Automatique RC/RL.
**Non testé :** Transition mains nues → résolution serveur (arme null dans payload assaut CaC)

---

## Session 115 — 2026-06-21 — REWORK-15 SocketProvider ✅ clos complet

### Travail effectué

**REWORK-15 Étape 5 — `client/src/pages/SessionPage.jsx` migré (dernière étape)**

Refactoring en 6 édits :
1. Import `io` → `import { SocketProvider, useSocket } from '../lib/SocketContext'`
2. Split : `SessionPage` (wrapper, export default) + `SessionContent({ campaignId })` — même fichier
3. `useState(null)` socket + `reconnectTrigger` supprimés → `const socket = useSocket()`
4. `tokenSocket = useTokenSocket()` → `useTokenSocket()` (sans capture) ; idem `entitySocket`
5. Grand useEffect (L.387–529, 143 lignes) → 2 useEffects : `[campaignId]` (setActiveCampaign) + `[socket]` (18 handlers nommés + cleanup symétrique)
6. `onReconnectSocket={() => setReconnectTrigger(n => n+1)}` → `() => {}` (reconnexion native socket.io)

**P-R15-1 levé** — `listen` n'est plus requis dans les hooks ; `useSocket()` suffit.
**build** : `✓ built in 1.47s` — zéro erreur.

**V1–V7 validés** (confirmation Saar) — SR ✅

**Investigation bug Drone CaC régression (partielle — stoppée pour compact)**

Contexte : "la fenêtre de résolution (phase 2) reste bloquée lorsque la cible est hors de portée ou non visible".

Findings :
- Handlers `COMBAT_DECLARE_ERROR` intacts côté client (CombatOverlay L.37-46, CombatGmDeclareWindow L.135-144, CombatActionWindow L.190-199) — REWORK-15 n'est PAS la cause
- `resolveMeleeAction` (humanoid CaC) : range check present L.1682 + `socket.emit(WS.COMBAT_DECLARE_ERROR, ...)` L.1684 ✅
- `resolveDroneAssaultAction` (drone CaC) : **pas de range check** — attaque procède sans vérification de portée
- `checkCombatLOS` : quand LOS bloquée → émet `DICE_RESULT` "Tir en aveugle" + `return { result: 'blocked' }` → back in `resolveDroneAssaultAction` : `return` silencieux → pas de `COMBAT_DECLARE_ERROR`
- `advanceSlot` appelé après `resolveDroneAssaultAction` (indépendant de `needsDefenseWait`) → slot avance dans tous les cas
- Trigger exact de fermeture fenêtre [INCONNU] — `CombatModifiersWindow` non lu

Fix probable (non validé) :
- Ajouter range check drone CaC dans `resolveDroneAssaultAction` après `isCaCWeapon` → `socket.emit(WS.COMBAT_DECLARE_ERROR, ...)`
- Ajouter `socket.emit(WS.COMBAT_DECLARE_ERROR, ...)` avant le `return` sur `los.result === 'blocked'`
- Prochaine étape : lire `CombatModifiersWindow` + `CombatOverlay` pour confirmer trigger fermeture avant de coder

### Testé
SR ✅, V1–V7 (REWORK-15) validés.

### Non testé
Drone CaC régression — investigation incomplète (CombatModifiersWindow non lu)
**Non testé :** tokens sur voxels en altitude (pos_z > 0) — attendu correct par la formule.

---

## Session 115 — suite 2 — 2026-06-22 — REWORK-13 Étapes 1+2 : campaignStore

### Travail effectué

**Étape 1 — `client/src/stores/campaignStore.js` créé**
- Store Zustand séparé (domaine campagne orthogonal à mapStore + sessionStore)
- `campaign: null` + `setCampaign` (full replace) + `updateCampaign` (merge partiel, null guard)
- `npm run build` ✅

**Étape 2 — Migration `campaign` dans SessionContent**
- Import `useCampaignStore` ajouté (après `useLibraryStore`)
- `const [campaign, setCampaign] = useState(null)` supprimé → `const { campaign, setCampaign, updateCampaign } = useCampaignStore()` groupé avec les stores
- `loadSession` : `setCampaign(campaignData)` inchangé (signature compatible)
- `onCampaignUpdated` : `setCampaign(prev => ({...prev, ...updated}))` → `updateCampaign(updated)`
- `handleSetDefault` : `setCampaign(prev => ({...prev, default_battlemap_id: bm.id}))` → `updateCampaign({ default_battlemap_id: bm.id })`
- `npm run build` ✅ — zéro erreur, zéro warning nouveau

**`docs/PLAN_REWORK11.md` mis à jour :**
- Interface cible `useSessionSocket` : `{ setCampaign }` param supprimé → `useCampaignStore()` interne
- `onCampaignUpdated` → `updateCampaign(updated)` ; deps `[socket]` au lieu de `[socket, setCampaign]`

### Testé
SR ✅, `npm run build` ✅ — REWORK-13 Étapes 1+2 (campaignStore) validés.

### Non testé
Étapes 3+4 (useBattlemapManager) — sprint suivant.

---

## Session 116 — 2026-06-22 — REWORK-12 + REWORK-14

### Travail effectué

**REWORK-12 — `useCharacterSocket.js` créé**
- Hook dédié blessures + inventaire : `useSocket()` interne + `useEffect([socket])` + 6 handlers nommés + cleanup
- `SessionContent` nettoyé : `woundVersions` useState supprimé + `updateCharacter` destructuring supprimé + `useEffect([socket])` WOUND/INVENTORY supprimés
- `npm run build` ✅

**REWORK-14 — `useCombatUIState.js` créé**
- Hook UI pur : 4 `useState` (combatMoveMode, combatTargetMode, pendingMoveSelection, combatCameraCenter) + 6 `useCallback`
- `SessionContent` nettoyé : 4 `useState` + `handleModeReset` + 5 handlers supprimés (~60 lignes)
- Ordre P-R14-1 respecté : `useEntitySocket` → `useCombatUIState` → `useCombatSocket`
- `npm run build` ✅

### Testé
V1–V8 (REWORK-12) validés — V1–V13 (REWORK-14) validés (confirmation Saar).

### Non testé
Rien.

---

## Session 116 suite (cont.) — 2026-06-23 — Bugs combat : fire_mode stale closure + actions store Tour 2

### Travail effectué

**Bug 1 — `CombatGmDeclareWindow.jsx` L.186 : stale closure fire_mode**
- Cause : effet `[activeTokenId, equipment]` lisait `decl.fire_mode` (closure du render précédent) au lieu de `initialStates.fire_mode` (valeur du render courant)
- Séquence de plantage : render N-1 `decl.fire_mode='rl'`, nouveau slot, effet reset dispatche `'cc'`, effet fire_mode lit closure `'rl'` → `modes.includes('rl')` true → pas de dispatch → état bloqué `'cc'`, serveur rejette
- Fix : `!modes.includes(decl.fire_mode)` → `!modes.includes(initialStates.fire_mode)`
- `initialStates.fire_mode = activePnjEntry.state_fire_mode ?? 'cc'` — recalculé à chaque render déclencheur, jamais périmé

**Bug 2 — `useCombatSocket.js` L.89 : store `actions` non vidé au changement de tour**
- Cause : `onPhaseChanged` pour ANNOUNCEMENT (Tour 2+) ne vidait pas le store `actions` — `COMBAT_PHASE_CHANGED` n'inclut pas `actions` dans son payload
- Séquence : Tour 2 ANNOUNCEMENT → `COMBAT_SLOT_ADVANCED` (drone) → `activeAssaultAction` trouvé dans actions stales Tour 1 → `assaultPrecheckId` non-null → precheck envoyé → serveur : `phase=ANNOUNCEMENT` → `canTransition` false → "Action non autorisée dans cet état de combat"
- Fix : `setActions([])` ajouté dans le bloc `if (phase === 'ANNOUNCEMENT')` de `onPhaseChanged`
- `onCombatStarted` vidait déjà le store au Tour 1 — ce fix rend les tours suivants cohérents

### Testé
SR ✅, fonctionnel confirmé (Saar). Bug 1 et Bug 2 résolus.

### Non testé
Rien.

---

## Session 116 suite — 2026-06-22 — REWORK-16 : Combat Pre-validation Gate

### Travail effectué

**Étape 0 — Fix atomique `resolveMeleeAction` L.1699**
- `socket.emit(WS.COMBAT_DECLARE_ERROR, ...)` → `io.to(campaignId).emit(WS.COMBAT_DECLARE_ERROR, ...)`
- Bug : erreur de portée CaC humanoïde n'était visible que de l'attaquant, pas broadcastée à la room

**Étape 1 — `shared/events.js` + handler ACK + cleanup logs**
- `COMBAT_ACTION_PRECHECK: 'combat:action_precheck'` ajouté dans `shared/events.js`
- Handler `socket.on(WS.COMBAT_ACTION_PRECHECK, async ({ tokenId, actionKey }, callback))` inséré dans `socketCombat.js` (entre `COMBAT_ANNOUNCE_PREVIEW` et `COMBAT_ACTION_CONFIRM`)
  - FSM guard : `canTransition` → `socket.emit` individuel si hors état (pas broadcast)
  - Range check CaC : colonne `type='melee'`, allonge XOR `weapon_inv_id` (humanoïde) / `drone_weapon_inv_id` (drone)
  - `io.to(campaignId).emit(COMBAT_DECLARE_ERROR)` si hors portée
  - `socket.timeout(5000)` côté client — fail-closed
- 8 logs `[DBG-CAC]` supprimés (grep = 0)

**Étape 2 — `CombatOverlay.jsx` gate precheckOk**
- `meleePrecheckId` dérivé de `activeMeleeAction?.id ?? playerActiveMeleeAction?.id`
- `precheckOk` useState (null / true / false) + `useEffect([meleePrecheckId, socket])` avec flag `cancelled`
- `&& precheckOk === true` ajouté sur les deux conditions `CombatCacModifiersWindow` (GM L.162 + PJ L.171)

**Étape 3 — Message d'erreur rouge**
- `useCombatSocket.js` `onDeclareError` : ajout `error: true`
- `Sidebar.jsx` : `msg.error ? styles.msgSystemErrorText : styles.msgSystemText` + style `{ color: '#e05252', fontWeight: 600 }`

**Vérifications :** `node --check socketCombat.js` ✅ — `npm run build` ✅ — SR ✅

### Testé
V1 (drone CaC hors portée — fenêtre bloquée + message rouge) ✅
V2 (drone CaC en portée — fenêtre ouvre) ✅
V3 (PNJ humanoïde CaC hors portée) ✅
V4 (PJ CaC hors portée) ✅
V5 (allonge respectée) ✅
V6 (slot non-CaC inchangé) ✅
V7 (nouveau slot melee — precheck relancé) ✅
V8 (slot non-melee suivant — fenêtre fermée) ✅
V9 (reconnexion — precheck relancé) ✅
V10 (message système normal gris inchangé) ✅
V12 (slot avance correctement après CaC valide) ✅
Log confirmé : `[WS] resolveMeleeAction — hors portée: 8.0m max:3m` broadcasté.

### Non testé
V11 — race condition post-ACK (cible se déplace entre precheck et confirm) — non reproductible en dev.

### Testé
- `npm run build` ✅ — zéro erreur après Étapes 1 et 2

### Non testé
- Validation fonctionnelle runtime (V1–V14 prévus après Étape 4)

---

## Session 115 — suite 2 (cont.) — 2026-06-22 — REWORK-11 : useSessionSocket ✅ clos complet

### Travail effectué

**Étape 1 — `client/src/lib/useSessionSocket.js` créé**
- 12 handlers WS nommés : `onSessionJoined`, `onUserJoined`, `onUserLeft`, `onCampaignUpdated`, `onChatMessage`, `onCharacterUpdated`, `onDiceResult`, `onMacroRollResult`, `onError`, `onDocCreated`, `onDocUpdated`, `onDocDeleted`
- `useSocket()` interne (REWORK-15), `useEffect([socket])`, cleanup symétrique (P-R11-4 ✅)
- `updateCampaign` lu depuis `useCampaignStore()` directement — pas de param `{ setCampaign }` (écart plan corrigé — REWORK-13 Étapes 1+2 déjà faits)
- Asymétrie DICE_RESULT préservée : `setLastDiceRoll` uniquement si `skillLabel === undefined`
- `'error'` string brut — pas de constante WS (P-R11-5 ✅)
- Retour : `{ lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError }`
- `npm run build` ✅

**Étape 2 — `SessionPage.jsx` (SessionContent) intégré**
- Import `useSessionSocket` ajouté
- `lastDiceRoll` useState + `handleDiceDone` useCallback supprimés de SessionContent (P-R11-1 ✅)
- `gmSocketError` useState supprimé de SessionContent
- `useSessionStore()` : réduit à `{ setActiveCampaign, setPendingEntityId }` (P-R11-3 ✅ — grep confirme usage exclusif dans les 12 handlers)
- `useCharacterStore()` : `upsertCharacter` retiré
- `useLibraryStore()` : réduit à `{ setDocuments }` (P-R11-2 ✅ — grep confirme usage exclusif dans DOC_* handlers)
- `updateCampaign` conservé dans `useCampaignStore()` de SessionContent — encore utilisé dans `handleSetDefault`
- `useSessionSocket()` déclaré après `combatSocket` + `handleDiceDone` recréé avec `[setLastDiceRoll]` en dep
- `useEffect([socket])` de SessionContent : 12 handlers supprimés, 6 WOUND_*/INVENTORY_* conservés (périmètre REWORK-12)
- `npm run build` ✅

### Testé
- SR ✅
- V1–V12 validés : connexion/présence (V1–V3), campagne/chat (V4–V5), personnage (V6), dés animation (V7), jet entité sans animation (V8), macro (V9), erreur GM (V10–V11), bibliothèque (V12)

### Non testé
- Reconnexion socket en cours de session active (cas couvert par REWORK-15 — non re-testé spécifiquement)

---

## Session 115 — suite 2 (cont.) — 2026-06-22 — REWORK-13 Étapes 3+4 : useBattlemapManager ✅ clos complet

### Travail effectué

**Étape 3 — `client/src/lib/useBattlemapManager.js` créé**
- Params `{ campaignId, isGm }` — `socket` via `useSocket()` interne (P-R13)
- 7 useState + 1 useRef : `mapContextMenu`, `mapContextMenuRef`, `showRenameModal`, `renameTarget`, `renameValue`, `showCreateModal`, `createMapName`
- `useEffect` outside-click dans le hook (pas dans SessionContent)
- Helpers modaux : `openRenameModal(bm)` (séquence 4 setters) + `openCreateModal()` (séquence 3 setters)
- `loadMap` exposé (gmBar), `handleMapSwitch` INTERNE (appelé uniquement par `handleGroupMove`)
- 6 callbacks CRUD : `handleMapRename`, `handleSetDefault`, `handleGroupMove`, `handleMapDuplicate`, `handleMapDelete`, `handleMapCreate`
- `handleMapDelete` : lit `battlemaps` + `battlemap?.id` depuis `useMapStore()` interne (P-R13-3 ✅)
- `npm run build` ✅ (39.97s)

**Étape 4 — `SessionContent` intégré**
- `useRef` retiré de l'import React
- `import { useBattlemapManager }` ajouté
- `useMapStore()` : `renameBattlemap`, `addBattlemap`, `removeBattlemap` retirés → internes au hook
- `useCampaignStore()` : `updateCampaign` retiré → géré dans `useSessionSocket` (REWORK-11 déjà fait)
- 7 useState + 1 useRef supprimés de SessionContent (L.134-140)
- 8 callbacks supprimés : `loadMap`, `handleMapSwitch`, `handleMapRename`, `handleSetDefault`, `handleGroupMove`, `handleMapDuplicate`, `handleMapDelete`, `handleMapCreate`
- `useEffect` outside-click supprimé
- `useBattlemapManager({ campaignId, isGm })` déclaré après `useSessionSocket()` (règle TDZ)
- JSX menu contextuel : 2 séquences multi-setters → `openRenameModal(mapContextMenu.bm)` + `openCreateModal()`
- `npm run build` ✅ (1.60s — zéro erreur, zéro warning)

### Testé
SR ✅, fonctionnel confirmé (Saar). V1–V14 validés.

### Non testé
— (aucun cas identifié hors périmètre)

---

## Session 116 — 2026-06-22 — REWORK-12 : useCharacterSocket

### Travail effectué

**Étape 1 — Créer `client/src/lib/useCharacterSocket.js`**
- `useSocket()` + `useCharacterStore()` + `useState(woundVersions)`
- `useEffect([socket])` — 6 handlers nommés + cleanup symétrique
- Asymétries préservées : `WOUND_ADDED` sans guard / `WOUND_UPDATED`+`WOUND_REMOVED`+`INVENTORY_*` avec guard
- `WOUND_*` appellent `updateCharacter` — `INVENTORY_*` n'appellent pas `updateCharacter`
- `updateCharacter` dans `WOUND_UPDATED` et `WOUND_REMOVED` appelé sans guard (même si `setWoundVersions` a le guard)
- `return { woundVersions }`
- `npm run build` ✅

**Étape 2 — Intégrer dans `SessionContent` (SessionPage.jsx)**
- Import `useCharacterSocket` ajouté (après `useSessionSocket`)
- `woundVersions` useState + commentaires supprimés (L.101–104)
- `updateCharacter` retiré du destructuring `useCharacterStore()`
- `const { woundVersions } = useCharacterSocket()` déclaré après tous les useState (règle TDZ)
- `useEffect([socket])` WOUND_*/INVENTORY_* entier supprimé (6 listeners + cleanup)
- `woundReloadKey={woundVersions[selectedCharacter?.id] ?? 0}` — inchangé
- `npm run build` ✅ (1.57s — zéro erreur)

### Testé
SR ✅, V1–V8 validés (confirmation Saar) — blessures ajout/modif/suppression + inventaire + isolation par characterId + crash-free fenêtre fermée + reconnexion.

### Non testé
— (aucun cas identifié hors périmètre)

---

## Session 116 suite — 2026-06-22 — REWORK-14 : useCombatUIState

### Travail effectué

**Analyse contrainte "Après fusion" :**
- Branche unique (`master`), zéro merge commit dans les 20 derniers commits, zéro branche confrère en local ni remote
- REWORK-14 ne chevauche pas l'éditeur/playground — sections L.200–209 + L.246–248 + L.414–470 de SessionPage.jsx, vs. `<Editor3D />` + `activeMaterial`/`activeBlueprint` (non touchés)
- Contrainte levée : prudentielle, pas technique

**Étape 1 — Créer `client/src/lib/useCombatUIState.js`**
- 4 `useState` : `combatMoveMode`, `pendingMoveSelection`, `combatTargetMode`, `combatCameraCenter`
- 6 `useCallback` : `handleModeReset` (deps []), `handleEnterMoveMode` (deps []), `handleValidateMove` (deps [combatMoveMode, pendingMoveSelection]), `handleCancelPendingMove` (deps []), `handleEnterTargetMode` (deps []), `handleValidateTarget` (deps [combatTargetMode])
- Pièges respectés : P-R14-1 (ordre TDZ), P-R14-3 (guard self-targeting + `onPendingTarget(null)`), P-R14-4 (`screenX != null` conditionnel), P-R14-5 (`?.pendingTargetId`), P-R14-6 (setState(fn) trap — objets avec callbacks)
- `combatCameraCenter` NON reset dans `handleModeReset` — caméra reste sur la dernière position (comportement source préservé)
- Zéro import socket, zéro import store, zéro effet de bord WS — hook UI pur
- `npm run build` ✅ (1.48s)

**Étape 2 — Intégrer dans `SessionContent` (SessionPage.jsx)**
- Import `useCombatUIState` ajouté après `useBattlemapManager`
- 4 `useState` supprimés avec leurs commentaires : `combatCameraCenter`, `combatMoveMode`, `pendingMoveSelection`, `combatTargetMode`
- `handleModeReset` useCallback supprimé — remplacé par la destructuration du hook
- `const { combatMoveMode, pendingMoveSelection, combatTargetMode, combatCameraCenter, handleModeReset, handleEnterMoveMode, handleValidateMove, handleCancelPendingMove, handleEnterTargetMode, handleValidateTarget } = useCombatUIState()` déclaré APRÈS `useEntitySocket`, AVANT `useCombatSocket` (P-R14-1)
- `useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })` — inchangé
- 5 handlers supprimés (~60 lignes) : `handleEnterMoveMode`, `handleValidateMove`, `handleCancelPendingMove`, `handleEnterTargetMode`, `handleValidateTarget`
- JSX CombatOverlay (8 props) + Canvas3D (4 props) — noms identiques, aucune modification
- `npm run build` ✅ (1.36s)

### Testé
SR ✅, V1–V13 validés (confirmation Saar) — hors combat ✅, activation mode combat ✅, déplacement (entrée/sélection/validation/annulation) ✅, cible (survol ennemi/self-guard/validation) ✅, reset COMBAT_END via `handleModeReset` ✅, combatCameraCenter ✅, bouton "Changer" (`onPendingTarget(null)`) ✅.

### Non testé
— (aucun cas identifié hors périmètre)

---

## Session 117 — 2026-06-23 — REWORK-17 : socketCombat.js modularisation

### Travail effectué

**Audit pre-migration (JOURNALTEMP.md) :**
- Grep exact lignes handlers (post-REWORK-16, décalage +58L vs plan) : COMBAT_START(80), COMBAT_END(214), COMBAT_ANNOUNCE_START(271), COMBAT_INIT_STATE(311), COMBAT_SURPRISE_RESULT(349), COMBAT_ACTION_DECLARE(436), COMBAT_SKIP_PLAYER(815), COMBAT_ANNOUNCE_PREVIEW(838), COMBAT_ACTION_PRECHECK(856), COMBAT_ACTION_CONFIRM(920), COMBAT_DAMAGE_CONFIRM(1035), COMBAT_MELEE_DEFENSE_CONFIRM(1200), COMBAT_STUN_CONFIRM(1420), COMBAT_APPLY_STUN(1455)
- Corrections imports vs plan : A4 — `checkLOSForPrecheck` → Resolution (absent du plan original) ; A5 — `getUserColor` retiré des Helpers (usage unique L.374 → State)
- `fetchCibleNA` confirmé local dans `resolveDroneAssaultAction` L.2503 — inclus automatiquement dans l'extraction Helpers

**Étape 1 — `socketCombatHelpers.js` créé (~1600L)**
- Tous les imports originaux moins `getUserColor` et `checkLOSForPrecheck`
- 7 constantes — seul `COMBAT_MODE_LABELS` exporté ; 6 autres intra-Helpers
- 13 fonctions toutes exportées — 14 exports total
- `node --check` ✅

**Étape 2 — `socketCombatState.js` créé (~360L)**
- 5 handlers : COMBAT_START, COMBAT_END, COMBAT_ANNOUNCE_START, COMBAT_INIT_STATE, COMBAT_SURPRISE_RESULT
- `const { campaignId, user, isGm } = context` — L.73 original inclus
- `node --check` ✅

**Étape 3 — `socketCombatAnnouncement.js` créé (~420L)**
- 3 handlers : COMBAT_ACTION_DECLARE, COMBAT_SKIP_PLAYER, COMBAT_ANNOUNCE_PREVIEW
- `const { campaignId, user, isGm } = context` ajouté manuellement
- `node --check` ✅

**Étape 4 — `socketCombatResolution.js` créé (~620L)**
- 6 handlers : COMBAT_ACTION_PRECHECK, COMBAT_ACTION_CONFIRM, COMBAT_DAMAGE_CONFIRM, COMBAT_MELEE_DEFENSE_CONFIRM, COMBAT_STUN_CONFIRM, COMBAT_APPLY_STUN
- `const { campaignId, user, isGm } = context` ajouté manuellement
- `node --check` ✅

**Étape 5 — `socketCombat.js` réécrit (9L)**
- Orchestrateur pur : 3 imports + `registerCombatHandlers` délègue aux 3 modules
- `grep -c "socket.on(WS" socketCombat.js` = 0 ✅ — test runtime imports ✅
- `node --check` × 5 ✅ — `index.js` inchangé ✅

### Testé
SR ✅, V1–V13 validés (confirmation Saar) — SR sans erreur ✅, health 200 ✅, COMBAT_START ✅, COMBAT_ANNOUNCE_START ✅, COMBAT_ACTION_DECLARE ✅, COMBAT_SKIP_PLAYER ✅, COMBAT_ACTION_CONFIRM déplacement ✅, COMBAT_ACTION_CONFIRM CaC + precheck ✅, COMBAT_ACTION_CONFIRM assaut distance ✅, COMBAT_MELEE_DEFENSE_CONFIRM ✅, COMBAT_DAMAGE_CONFIRM ✅, COMBAT_END ✅, reconnexion RESOLUTION ✅.

### Non testé
— (déménagement pur, zéro logique modifiée)

---

## Session 118 — 2026-06-23 — Ergonomie combat UI (COM15 + Timeline)

### Travail effectué

**COM15 ✅ — Identité personnage dans les en-têtes fenêtres combat :**
- `CombatGmDeclareWindow.jsx` — header : nom du token actif en or entre le titre et le compteur. Grisé italique si slot PJ (attente). `flex:1` déplacé du titre vers le span nom.
- `CombatModifiersWindow.jsx` et `CombatCacModifiersWindow.jsx` : déjà conformes (noms intégrés depuis précédentes sessions).

**Poignée de déplacement basse — 3 fenêtres :**
- `CombatGmDeclareWindow.jsx`, `CombatModifiersWindow.jsx`, `CombatCacModifiersWindow.jsx` : `<div onMouseDown={onHeaderMouseDown} style={styles.bottomHandle} />` ajouté entre le body et le footer. Même `onHeaderMouseDown` que le header — drag depuis le bas fonctionne identiquement.

**CombatTimeline.jsx — 4 améliorations :**
- Fond 20% opaque : `--bg-session-scrim` → `rgba(10,10,20,0.20)` dans `index.css` (usage unique — pas d'impact collatéral).
- Phase + flèche déplacées du panneau droit vers le `leftPanel`, sous "TOUR N".
- Bouton collapse `▲`/`▼` ajouté dans `leftPanel` — masque/révèle le bloc `cardList`.
- Portraits centrés : `justifyContent: 'center'` sur `cardList`.

### Testé
SR ✅ — timeline transparente ✅, phase à gauche ✅, collapse ✅, portraits centrés ✅, nom actif dans header CombatGmDeclareWindow ✅, poignées basses déplaçables curseur ↕ ✅.

### Non testé
Cycle holstered→drawn pendant une session combat réelle (nom dans header CombatGmDeclareWindow — cas PJ actif non reproductible hors session).

---

## Session 119 — 2026-06-23 — Bug D3 : programme armement_contact drone

### Travail effectué

**Bug D3 ✅ — Drone CaC : programme "armement_contact" absent du catalogue :**
- Cause racine : migration 76d avait basculé tous les programmes `armement` → `armement_distance`. Aucun programme `armement_contact` n'existait dans `ref_equipment`.
- Migration 83 (`83_drone_programs_rename.js`) :
  - "Attaque" → name="Contact", category=`armement_contact`
  - "Tir" → name="Balistique" (category `armement_distance` inchangée)
  - "Contrôle armement" supprimé (générique sans usage mécanique distinct dans le code)
- `DroneSheet.jsx` L.141 : group key `armement_distance` → `armement` (label "Armement" — clé `fr.json` déjà présente)

### Testé
SR ✅ — migration appliquée ✅ — fonctionnel confirmé (Saar).

### Non testé
Session combat réelle avec drone CaC assigné programme "Contact" → résolution complète (sans log `programme armement_contact introuvable`).

## Session 119 suite — 2026-06-24 — REWORK-18 : Effect Queue (socketCombatHelpers)

### Travail effectué

**REWORK-18 — Bloc 1 ✅ (session précédente) : `resolveDroneAssaultAction` + `flushEmissions`**
- `resolveDroneAssaultAction` : `socket` supprimé de la signature — 12 émissions → descripteurs — `io.fetchSockets()` supprimé — L.1009 récursion LOS args mis à jour (A6 drone) — tous les `return` → `{ suspend: false, emissions }`
- `socketCombatResolution.js` : `flushEmissions(io, socket, campaignId, emissions, preloadedSockets?)` créé — call site L.187 mis à jour
- `node --check` ×2 ✅ — dead code `severityColor` supprimé (bug pré-existant REWORK-08)

**REWORK-18 — Bloc 2 ✅ (session précédente) : `resolveMeleeAction` + call sites L.189 + L.564**
- `resolveMeleeAction` : `socket` supprimé — 10 émissions → descripteurs (11e supprimée, fusionnée `fallback:'room'`) — `io.fetchSockets()` supprimé — 2 récursions (L.742 + L.774) accumulent `[...emissions, ...nextResult.emissions]` — tous les `return` → `{ suspend: bool, emissions }`
- `socketCombatResolution.js` : call sites L.189 (COMBAT_ACTION_CONFIRM) + L.564 (COMBAT_MELEE_DEFENSE_CONFIRM) mis à jour — `allSockets` passé en `preloadedSockets` (A7 — évite double `fetchSockets`)
- `node --check` ×2 ✅ — V1 (CaC PJ vs PNJ), V4 (multi-attaque), V5 (hors portée → room) validés

**REWORK-18 — Bloc 3 ✅ : `resolveAssaultAction` + call site L.191**
- `resolveAssaultAction` : `socket` supprimé — 7 émissions → descripteurs — L.1253 `resolveDroneAssaultAction(io, campaignId, ...)` ✅ (déjà Bloc 1) — L.1263 LOS intercepté : `resolveAssaultAction(io, campaignId, ...)` (A6 — corrigé manuellement, non détectable `node --check`) — tous les `return` → `{ suspend: false, emissions }`
- `socketCombatResolution.js` L.191 (décalage vs plan L.170) : call site mis à jour — `const assaultResult = await resolveAssaultAction(...); if (assaultResult) await flushEmissions(...)`
- `node --check` ×2 ✅

**REWORK-18 — Bloc 4 ⚠️ : Validation partielle**
- `node --check` ×2 ✅ — V5 ✅, V5b ✅ (hors portée → DECLARE_ERROR socket), V8 ✅ (assaut raté → endTurn)
- V6 partiel ✅ (assaut PJ touché → DICE_RESULT + DAMAGE_PROMPT émis), V7 partiel ✅ (ATTACK_RESULT broadcast)
- Bloqué sur COMBAT_DAMAGE_CONFIRM : Bug RW17-1 — `calcDroneRD` non importée dans `socketCombatResolution.js` (régression silencieuse REWORK-17 — non testée en session combat réelle)
- V1–V4, V9/V10 non testés (session combat réelle requise)

**Bugs identifiés et enregistrés dans BUGIDENTIFIE.md :**
- Bug RW17-1 [VÉRIFIÉ] : `calcDroneRD` exportée `socketCombatHelpers.js` L.1568, appelée `socketCombatResolution.js` L.275, absente de l'import. Fix = 1 ligne.
- Bug STUN2 [INCONNU] : PJ étourdi (stun reçu pendant résolution adverse) peut confirmer son action — `COMBAT_ACTION_CONFIRM` pas de guard `is_stunned`.
- Bug RW18-1 [VÉRIFIÉ] : services (`woundService`, `damageService`) émettent directement pendant l'exécution, avant `flushEmissions` — ordering inversé (wound avant DICE_RESULT).
- FAUX BUG : "Action non autorisée" pendant AWAITING_DAMAGE = comportement FSM normal.

**Documentation mise à jour :**
- `ARCHI_REWORK.md` — REWORK-18 ajouté aux reworks achevés (⚠️ clos partiel)
- `EN_COURS.md` — REWORK-18 ⚠️ + item 21 sprint résolution (RW17-1 + STUN2)
- `PLAN_REWORK18.md` — Blocs 3+4 statut mis à jour
- `BUGIDENTIFIE.md` — RW17-1 + STUN2 + FAUX BUG ajoutés (Session 119 suite)
- `client/public/CHANGELOG.md` — v122 ajouté

### Testé
`node --check` ×2 ✅ — V5 ✅, V5b ✅, V8 ✅ — V6/V7 partiels ✅

### Non testé
V1–V4 (CaC en session réelle), V9/V10 (drone), COMBAT_DAMAGE_CONFIRM complet (bloqué RW17-1)

---

## Session 120 — 2026-06-24 — STUN2 + RW17-1 vérification

### Travail effectué

**RW17-1 ✅ CLOS COMPLET (vérification) :**
- `calcDroneRD` + `calcDroneDegatsNets` exportées `charStats.js` L.106-118 par agent précédent (REWORK-DRONE-CALC)
- `socketCombatHelpers.js` L.14 : import corrigé — local export supprimé
- `socketCombatResolution.js` L.9 : import `calcDroneDegatsNets` depuis `charStats.js` — 3 call sites L.764/L.1119/L.1478 ✅

**STUN2 — implémentation session 120 :**

*Guards serveur (`socketCombatResolution.js`) :*
- PRECHECK guard L.57-81 : double-check `token_statuses` + `combat_pending type='stun'` avant LOS/range — auto-skip + `{ ok: false, stunned: true }`
- CONFIRM guard L.177-198 : même double-check — filet si PRECHECK non émis
- Bugs fix : `campaign_id` absent de `token_statuses` ; signature `advanceSlot(io, campaignId, slots, nextIdx, pendingMaps)` (pas de `db`)

*Message i18n :*
- `fr.json` : `session.stun_blocked` = `"Action impossible, vous êtes {{statut}}"`
- `socketCombatResolution.js` : `socket.emit(WS.COMBAT_DECLARE_ERROR, { stunned: true, statusCode })` dans les deux guards
- `useCombatSocket.js` `onDeclareError` : `{ stunned, statusCode }` → `t('session.stun_blocked', { statut })`

*Fix overlay "Ligne de vue bouchée" (Phase 3 — à coder) :*
- `CombatOverlay.jsx` L.86 : callback PRECHECK ne destructure que `{ ok }` — `stunned: true` → `ok: false` → overlay LOS affiché à tort
- Fix : `{ ok, stunned }` → si `stunned` → `setAssaultPrecheckOk(null)`

**Bugs hors scope STUN2 :**
- "Action non autorisée" au tir drone : race condition late-declaration GM (pré-existant)
- Timer sur AGIR : feature séparée non implantée

### Testé
STUN2 CONFIRM : stun détecté ✅, auto-skip ✅, `endTurn` ✅

### Non testé
Overlay fix Phase 3 (fix à coder), message Sidebar non confirmé visuellement

---

## Session 120 (suite) — 2026-06-24 — STUN2 Phase 3 overlay fix

### Travail effectué

**Cause racine identifiée — "Ligne de vue bouchée" incorrecte :**
- Ce n'est pas un bug stun : c'est le guard FSM `AWAITING_DAMAGE` qui bloque le PRECHECK du slot suivant
- Séquence : drone tire PJ → `sub_phase = AWAITING_DAMAGE` → slot avance quand même → PRECHECK du combattant suivant frappe `canTransition(RESOLUTION, AWAITING_DAMAGE, COMBAT_ACTION_CONFIRM)` → false → `{ ok: false }` + "Action non autorisée dans cet état de combat" → `setAssaultPrecheckOk(false)` → overlay "Ligne de vue bouchée" (raison incorrecte)

**Fix serveur — `socketCombatResolution.js` PRECHECK L.53-58 :**
```js
if (!canTransition(...)) {
  if (state?.sub_phase === 'AWAITING_DAMAGE') {
    return callback({ awaiting: true })  // pas d'erreur, client retentera après COMBAT_ATTACK_RESULT
  }
  socket.emit(WS.COMBAT_DECLARE_ERROR, ...)
  return callback({ ok: false })
}
```

**Fix client — `CombatOverlay.jsx` :**
- `precheckRetryKey` state + listener `COMBAT_ATTACK_RESULT` (broadcast room après DAMAGE_CONFIRM)
- Assault PRECHECK callback : `{ ok, stunned, awaiting }` — si `awaiting` → `setAssaultPrecheckOk(null)` (aucun overlay)
- Melee PRECHECK callback : `{ ok, awaiting }` — si `awaiting` → `setPrecheckOk(null)`
- Deps assault + melee PRECHECK : `[..., precheckRetryKey]` → re-fire après COMBAT_ATTACK_RESULT

**Séquence corrigée :**
1. Drone tire PJ → AWAITING_DAMAGE → slot avance
2. Combattant suivant : PRECHECK → `{ awaiting: true }` → `assaultPrecheckOk = null` → aucun overlay, AGIR masqué (correct)
3. PJ confirme dégâts → stun appliqué → `COMBAT_ATTACK_RESULT` broadcasté
4. Tous clients : `precheckRetryKey++` → PRECHECK re-fire → stun en DB → STUN2 PRECHECK guard → auto-skip ✅

**Double-fire PRECHECK (GM + PJ clients) :** idempotent — les deux calculent `nextIdx = N+1` depuis même `state.active_slot_idx`, `advanceSlot` écrit `N+1` deux fois, `COMBAT_SLOT_ADVANCED` idempotent côté client.

### Testé
SR ✅, all OK (confirmation Saar)

### Non testé
Scénario complet en session combat réelle avec drone → PJ étourdi (nécessite session multijoueur)

---

## Session 121 — 2026-06-24 — AA-1 : blessures combat non affichées (ArmorWoundPanel)

### Contexte

Analyse croisée RW18-1 (ordering serveur) + bug d'affichage signalé par Saar (blessures combat non visibles si CharacterWindow fermée ou sur un autre onglet pendant le combat). Deux causes racines distinctes, fix combiné car même architecture.

### Cause racine AA-1 [VÉRIFIÉ]

Chaîne de propagation `WOUND_ADDED → woundVersions++ → woundReloadKey → useEffect → bumpInventoryVersion → ArmorWoundPanel.reloadKey → load()` : ne fonctionne que si `ArmorWoundPanel` est monté. Si la fenêtre est fermée ou sur l'onglet "Feuille", WOUND_ADDED est perdu. Blessures manuelles (REST direct → `onWoundsReload()`) non affectées.

Deuxième bug identifié en cours de correction : pattern `cancelled` dans l'effet `[load, reloadKey]` d'ArmorWoundPanel. En React 18 StrictMode, l'effet se monte deux fois — la première exécution termine, son cleanup pose `cancelled = true`, puis `.then(if cancelled) { setWounds([]) }` efface les blessures (flash 250ms visible à chaque ouverture d'onglet).

### Fix — 5 fichiers

**`characterStore.js`** : `woundsByCharId: {}` + `setWounds(charId, wounds)` — store Zustand global.

**`useCharacterSocket.js`** : handlers `WOUND_*` — suppression bump `woundVersions`, ajout fetch REST + `setWounds(charId, wounds)` dans le store. Fonctionne même si ArmorWoundPanel n'est pas monté. `INVENTORY_*` handlers : inchangés (continuent de bumper `woundVersions`).

**`ArmorWoundPanel.jsx`** :
- `useEffect([storeWounds])` → `setWounds(storeWounds)` — mise à jour locale depuis le store dès que le composant monte ou que le store change
- `load()` + `handleWoundsReload()` : synchronisation store après fetch REST (`setStoreWounds(charId, wounds)`)
- Pattern `cancelled` supprimé — `useEffect(() => { load() }, [load, reloadKey])` — React 18 ignore les state updates sur composants démontés

**`CharacterWindow.jsx`** : renommage `prevWoundKeyRef` → `prevInventoryKeyRef`, `woundReloadKey` → `inventoryReloadKey` (sémantique : la clé ne pilote plus que les reloads INVENTORY_*).

**`SessionPage.jsx`** : prop renommée `woundReloadKey` → `inventoryReloadKey`.

### Testé
Build ✅, blessure visible immédiatement à l'ouverture onglet Matériel même si CharacterWindow était fermée pendant le combat (confirmation Saar).

### Non testé
Session combat réelle complète avec plusieurs joueurs simultanés. Résilience INVENTORY_* reload non vérifiée en session.

### RW18-1 (serveur)
Non traité cette session. Impact utilisateur atténué par AA-1 (store Zustand résilient à WOUND_ADDED hors-séquence). Bloc B planifié : `skipEmit` sur `woundService.applyWound` + `statusService.emitShockDiceResult` → descripteurs dans la queue `emissions` avant `COMBAT_ATTACK_RESULT`.

---

## Session 121 (suite) — 2026-06-24 — COM22 : aucune action combat sur Kiwi

### Contexte

COM22 signalé en session combat réelle sur Kiwi : aucune action d'attaque (distance) ne passe en Phase 2 Résolution. Déplacement fonctionnel. Log Kiwi : `COMBAT_ACTION_CONFIRM — assault sans confirmedModifiers` pour tous les slots assault → guard serveur skippe l'assault sans résolution.

### Cause racine [VÉRIFIÉ]

**Kiwi spécifique** : `voxel_data` battlemap Kiwi contient des voxels décalés (map jamais sauvegardée proprement depuis l'éditeur — MinIO textures 500 en mode éditeur). `checkLOSForPrecheck` → raycast voxels incorrects → `clear = false` → PRECHECK assault `{ ok: false }` → `assaultPrecheckOk = false` → `CombatModifiersWindow` ne s'ouvre pas → bouton "Agir" → `COMBAT_ACTION_CONFIRM` sans `confirmedModifiers` → guard L.240 `!confirmedModifiers && character.type !== 'drone'` → assault skipé silencieusement.

En local : voxels corrects → LOS claire → PRECHECK `{ ok: true }` → modifiers collectés → résolution complète.

**CaC** : n'était pas bloqué. `resolveMeleeAction` appelé sans guard null confirmedModifiers — résolution correcte avec ou sans modifiers (confirmé par logs Kiwi : melee roll + défense PNJ + endTurn propre).

### Fix — `socketCombatResolution.js`

Suppression du PRECHECK LOS assault (redondant — LOS re-vérifiée à la résolution dans `resolveAssaultAction → checkCombatLOS`) :
- Import `checkLOSForPrecheck` supprimé (L.4)
- Bloc `if (actionKey === 'assault') { ... losOk ... }` supprimé (L.122-130)
- Log `[DBG] PRECHECK ${actionKey} token:${tokenId} → ok:true` ajouté (diagnostic Kiwi)

PRECHECK assault réduit à : FSM guard + stun guard + `callback({ ok: true })`.

### Infrastructure Kiwi — fast-voxel-raycast manquant root

Kiwi crashait au restart post-git-pull : `ERR_MODULE_NOT_FOUND: fast-voxel-raycast imported from shared/losUtils.js`. Package déclaré dans `Enclume/package.json` (racine) — résolution Node.js ESM depuis `shared/losUtils.js` via `Enclume/node_modules/`. `npm install` avait été lancé dans `server/` uniquement (mauvais répertoire). Fix : `npm install` à la racine `Enclume/`.

### Sécurité — npm audit fix server

7 vulnérabilités corrigées (`npm audit fix` dans `server/`) — 0 restantes :
- `ws` 8.18.3 → 8.21.0 (uninitialized memory + DoS)
- `multer` 2.1.1 → 2.2.0 (DoS nested fields)
- `qs` 6.15.0 → 6.15.2 (DoS null entries)
- `fast-xml-builder` 1.1.5 → 1.2.0, `engine.io` 6.6.6 → 6.6.9, `socket.io-adapter` 2.5.6 → 2.5.8, `brace-expansion` 5.0.5 → 5.0.6

Root `npm audit fix` : `ws` patchée via `socket.io-client`. `xlsx *` : pas de fix disponible (SheetJS communauté) — utilisé seeds uniquement, dette active.

### Testé
- Local ✅ : assault distance résolution complète (PRECHECK → ok → modifiers → roll → résolution)
- Kiwi ✅ : combat 3 participants, 2 assaults distance résolus (TOUCHE MR:10 + MR:5), STUN2 auto-skip validé, melee fonctionnel, endTurn propre

### Non testé
Session combat réelle Kiwi avec plusieurs joueurs simultanés (test solo GM uniquement)

---

## Session 123 (2026-06-24) — WeaponPanel v2 : CS1 + CS2 + CS3 ✅

### Vérifications préliminaires (avant code)

- `char_sheet_identity` → **n'existe pas**. `hand_pref` est colonne directe de `char_sheet` (migration 36, L.49). Plan corrigé : pas de query séparée, `sheet.hand_pref` suffit.
- PUT inventory `char-sheet.js` L.1126 : `WEAPON_SLOTS.has()` valide MG/MD/2M/Tr. Pas de guard bloquant.
- `getSlotInfo` : type `'Tr'` géré L.18. `available2M` incluant `'Tr'` correct.

---

### CS3 ✅ — WeaponPanel v2 : colonnes DIR/SEC + section DEUX MAINS

**Cause racine** : UI MG/MD symétrique sans notion de main directrice. Arme 2H pouvait être équipée dans chaque main séparément.

#### `server/src/routes/character/char-sheet.js`
- GET inventory réponse : `hand_pref: sheet?.hand_pref || 'R'` ajouté (+1 ligne)

#### `client/src/character/WeaponPanel.jsx` — refonte complète
- **Supprimé** : `equipSlot`, `equipItemId`, `handleEquip()`, `handleSelectWeapon()`
- **Ajouté** : states `handPref`, `equipDir`, `equipSec`, `equip2MId`, `equip2MSlot`
- **Ajouté** : dérivées `isAmbi`, `dirSlot`, `secSlot`, `weaponDir`, `weaponSec`, `weapon2M`, `hasTrepied`, `available1H`, `available2M`
- **Ajouté** : `handleEquipItem(itemId, slot)` — conflict resolution auto, `handleSelect2M(itemId)`
- **Extrait** : sous-composant `WeaponCard` — JSX ammo/reload inchangé
- **Layout** : `weapon2M` présent → section DEUX MAINS plein-largeur ; absent → grille 2 colonnes DIR/SEC + section DEUX MAINS en bas
- **Inchangé** : `WEAPON_SLOTS`, `SLOT_LABELS`, `getSlotInfo`, `handleUnequip`, `handleReload`, `availableAmmoFor`, `ammoNameForRef`, `equippedWeapons`, `availableWeapons`

**Testé** : V1–V7 ✅, V9 (reload régression) ✅, V10 (dropdown visible) ✅
**Non testé** : V8 ambi — slot MD affiché sous label "MAIN GAUCHE" (comportement plan — à confirmer session combat)

---

### CS2 ✅ — inclus dans WeaponPanel v2

Dropdown équipement intégré directement dans chaque colonne vide (DIR / SEC / 2M). Résolu par la refonte CS3.

---

### CS1 ✅ — Description arme : tooltip ⓘ

**Cause racine** : `ref_equipment.description` absent du SELECT GET inventory.

#### `server/src/routes/character/char-sheet.js`
- SELECT GET inventory : `'ref_equipment.description as ref_description'` ajouté

#### `client/src/index.css`
- `.has-tooltip` / `.has-tooltip::after` / `.has-tooltip:hover::after` ajoutés en fin de Section 10 — CSS pur, `data-tooltip` attribute

#### `client/src/character/WeaponPanel.jsx`
- `WeaponCard` header : `{weapon.ref_description && <span className="has-tooltip" data-tooltip={...} style={s.infoIcon}>ⓘ</span>}`
- Style `infoIcon` ajouté

**Testé** : Hover ⓘ → tooltip ✅. Arme sans description → ⓘ absent ✅.
**Non testé** : Armes avec `custom_desc` distinct de `ref_description`.

---

## Session 122 (2026-06-24) — COM19 FAUX BUG + INI Breakdown Popover

### COM19 — Assaut (tir) : -5 INI — FAUX BUG

**Investigation complète** : LdB `REGLESYSCOMBAT.md` (1784 lignes) relu en intégralité — p.213-214 (Initiative), p.216-217 (Préparations), p.226-229 (Combat à distance, Modes de tir automatique).

**Conclusion** : Aucune règle "-5 INI pour assaut (tir)" dans le LdB. `MANUELSYSCOMBAT.md` §3 confirme : la table des modificateurs INI ne contient pas ce coût. Le code `socketCombatAnnouncement.js` (`STATE_COSTS` matrix + `iniDelta` L.183-203) est conforme au LdB.

**Clos : FAUX BUG** — Leçon Session 94 / COM3 appliquée.

---

### INI Breakdown Popover — Nouveau

**Objectif** : Permettre aux joueurs de comprendre pourquoi leur INI total varie. Clic sur le total INI → popover flottant avec le détail ligne par ligne.

**Pattern choisi (recherche GitHub / Foundry VTT / D&D Beyond)** : Popover au clic. Impact layout = zéro (flottant absolu). Fonctionne sur tactile (Raspberry Pi). Fermeture par clic extérieur via backdrop `position: fixed`.

#### `client/src/components/combatSections.js`
- `calcIniBreakdown(prevStates, nextStates, mapActions, quick)` — export, retourne `{ label, value }[]`
- `calcIniDelta` refactorisée : appelle `calcIniBreakdown().reduce(sum)` — source de vérité unique, plus de risque de divergence

Lignes générées : transitions d'états (POSTURE, ARME, MODE DE TIR, VITESSE), déplacement (via `MOVE_ZONE_DEFS`), CaC (1ère cible -3 / supp. -5), Tirer depuis couverture (-3/-5), Observer ×N, Repérer ×N, Phrase courte.

#### `client/src/components/CombatGmDeclareWindow.jsx`
- Import `calcIniBreakdown`
- `useState(false)` → `iniPopoverOpen` — remis à `false` dans l'effet reset `[activeTokenId]`
- `iniBreakdown` calculé (mêmes args que `iniDelta`, `attack: null`)
- Footer : total INI cliquable → backdrop `position:fixed` zIndex 1998 + `.ini-popover` zIndex 1999

#### `client/src/components/CombatActionWindow.jsx`
- Même pattern — `iniBreakdown` depuis `mapActionsObj` (inclut `cover_shot`)
- `setIniPopoverOpen(false)` dans l'effet reset `[rosterEntry?.token_id]`

#### `client/src/index.css`
- `.ini-popover` / `.ini-popover-line` / `.ini-popover-label` / `.ini-bd-pos` / `.ini-bd-neg`

### Testé
Build ✅ — SR ✅ — Clic sur total INI → popover ligne par ligne ✅ — Clic extérieur ferme ✅

### Non testé
Session combat réelle multi-joueurs simultanés.

---

## Session 124 — 2026-06-25 — PLAN_TRADE étapes 1–7 ✅

### Objectif
Implanter le système Trade complet (marchands + échanges PJ↔PJ + livre de compte) selon `docs/PLAN_TRADE.md`.

### Étape 1 — Migrations 84–87
- `84_merchants.js` : table `merchants` (id, campaign_id, name, status CHECK OPEN/CLOSED, mod_global, nt_max, niv_max, gen_max, dispo_min, rules JSONB, allowed_char_ids TEXT[])
- `85_trade_log.js` : table `trade_log` (type CHECK merchant_buy/player_transfer/gm_grant, from_char_id nullable, to_char_id nullable, merchant_id nullable, sols_delta, items_json JSONB)
- `86_trade_offers.js` : table `trade_offers` (from_char_id, to_char_id, status CHECK PENDING/ACCEPTED/DECLINED/CANCELLED, items_json, sols_offer, expires_at)
- `87_ref_equipment_generation.js` : `ALTER TABLE ref_equipment ADD COLUMN generation INTEGER` — colonne absente confirmée (P8)

### Étape 2 — `shared/events.js`
+12 constantes : 4 client→serveur (`TRADE_TRANSFER_OFFER/ACCEPTED/DECLINED/CANCELLED`) + 8 serveur→client (`TRADE_MERCHANT_UPDATED`, `TRADE_OFFER_RECEIVED/ACCEPTED/DECLINED/CANCELLED/EXPIRED`, `TRADE_LOG_UPDATED`, `TRADE_ERROR`)

### Étape 3 — `tradeRoutes.js` + `tradeService.js` (structure)
- `merchantsRouter` : GET/POST/PUT/DELETE marchands + GET catalog + POST buy
- `tradeLogRouter` : GET (GM only, paginé PAGE_SIZE=50)
- `tradeService` : `getMerchants` (filtre allowed_char_ids via `cardinality()` + `ANY()`), `upsertMerchant`, `deleteMerchant`, `getTradeLog`

### Étape 4 — `socketTrade.js`
- `RateLimiterMemory({ points: 3, duration: 60 })` module-level
- `findSocketByCharId(io, campaignId, charId)` via `io.in(campaignId).fetchSockets()` + `characters.user_id`
- `findGmSocket(io, campaignId)` via `socket.data.role === 'gm'`
- 4 handlers : `TRADE_TRANSFER_OFFER` (rate limit + INSERT trade_offers + emit RECEIVED), `TRADE_TRANSFER_ACCEPTED` (→ `acceptTransfer` + emit ACCEPTED ×2 + LOG_UPDATED GM), `TRADE_TRANSFER_DECLINED` (UPDATE DECLINED + emit), `TRADE_TRANSFER_CANCELLED` (guard from_char_id + UPDATE CANCELLED + emit)
- `server/src/socket/index.js` : `registerTradeHandlers(io, socket, context)` après `registerCombatHandlers`

### Étape 5 — `tradeService.getCatalog`
- `passesGlobalThresholds(item, merchant)` : tech_level / max_level / generation / rarity (P5 : `isNaN(parseInt) → visible`)
- `passesLocalThresholds(item, rule)` : même logique pour règles PARAM
- `evaluateItem(item, merchant, rules)` → cascade `find()` FAM→CAT→ITEM — INCLUDE force visible, EXCLUDE force false, PARAM modifie seuils + mod_pct
- Prix : `Math.round(price * (1 + (mod_global + modPct) / 100))`

### Étape 6 — `tradeService.buyFromMerchant`
Transaction `knex.transaction` :
1. `forUpdate` marchand → vérif OPEN
2. Fetch équipements + calcul prix via `evaluateItem`
3. `forUpdate` char_sheet → vérif `sols >= total`
4. `decrement('sols', total)`
5. INSERT `char_inventory` par ligne (container='Coffre', slot=null — P9)
6. INSERT `trade_log` (type='merchant_buy', sols_delta=-total, items_json snapshot)

### Étape 7 — `MerchantsPage.jsx` + liens navigation
- Route `/campaigns/:campaignId/merchants` dans `App.jsx`
- Structure : colonne gauche marchands (CRUD) + détail 3 onglets
  - **Paramètres** : status toggle OPEN/CLOSED, mod_global, nt_max, niv_max, gen_max, dispo_min
  - **Catalogue** : arbre FAM→CAT→ITEM groupé depuis `GET /api/equipment` (lazy), tri-state badge cyclé au clic + héritage visuel `INCL↑`/`EXCL↑` (pointillé muted)
  - **Joueurs** : checkboxes par character (allowed_char_ids, vide = tous)
- `DashboardPage.jsx` : bouton "Marchands" sur carte campagne GM (GM only)

**Bugs résolus en cours de route :**
- Écran noir onglet Joueurs : `res.data` → `res.data.characters ?? []` (API retourne `{ characters: [...] }`)
- `rate-limiter-flexible` installé manuellement (`npm install` dans server/)
- Migration auto via `db.migrate.latest()` au démarrage — vérification via `knexfile.cjs`

### Testé
SR ✅ — Marchands CRUD ✅ — Catalogue tri-state + héritage ✅ — Onglet Joueurs ✅ — Bouton Dashboard GM ✅

### Non testé
Handlers WS PJ↔PJ (pas de session combat réelle) — `buyFromMerchant` (pas de UI joueur encore) — filtres catalogue avec données réelles

### Prochaine étape
PLAN_TRADE étapes 8–11 : `TradeWindow.jsx` (vue GM lite + vue Joueur + vue Échange PJ↔PJ) + menu radial

---

## Session 124 (suite) — D1 ✅ + D2 ✅ (Drone : fiche + GLB upload)

### D1 ✅ CLOS — Menu radial "fiche" drone
- Clos hors session (fix mismatch type `character_id` string/number dans SessionPage IIFE)
- Docs mises à jour : BUGIDENTIFIE.md + EN_COURS.md

### D2 ✅ CLOS — Token drone : changement GLB + notification upload
**Fichiers modifiés :** `DroneWindow.jsx` (SettingsTab) + `fr.json`

#### Token 3D (déjà en place, débloqué par D1)
- `Canvas3D.jsx` L.248 : `key={glbUrl}` sur `TokenGlbErrorBoundary` — remontage forcé au changement d'URL
- `DroneWindow.SettingsTab.handleGlbUpload` : `updateCharacter(res.data.character)` → store mis à jour → `glbUrl` recalculé → token rechargé

#### Notification upload
- `glbUploading: boolean` → `glbStatus: null | 'uploading' | 'success' | 'error'`
- `glbTimerRef` (useRef) : stocke le timeout de reset + cleanup `useEffect(() => () => clearTimeout(...), [])`
- `handleGlbUpload` : `clearTimeout` en début → `'uploading'` → try `'success'` / catch `'error'` → finally `e.target.value=''` + `setTimeout(null, 3000)`
- Label coloré : null=bleu / uploading=bleu+opacity0.5 / success=vert `#4caf77` / error=rouge `#e05c5c` — transition 0.2s
- i18n : `character.glbSuccess` "Modèle mis à jour ✓" + `character.glbError` "Échec de l'envoi"

### Testé
SR ✅ — notification "En cours..." ✅ — "Modèle mis à jour ✓" vert ✅ — retour bleu après 3s ✅ — rechargement token 3D ✅

### Non testé
Cas d'échec réseau (couleur rouge non testée en conditions réelles)

### Prochaine étape
PLAN_TRADE étapes 8–11 ou cluster suivant selon priorité

---

## Session 124 (suite) — PLAN_TRADE étape 8 ✅ — TradeWindow vue GM lite

### Objectif
Créer `TradeWindow.jsx` — fenêtre flottante draggable in-session pour le GM — vue lite : ajustements à chaud des marchands + livre de compte.

### Fichiers créés / modifiés
- `client/src/components/TradeWindow.jsx` — créé (~200L)
- `client/src/pages/SessionPage.jsx` — import + `tradeWindowOpen` state + bouton "Commerce" gmBar + rendu conditionnel
- `client/src/locales/fr.json` — +`session.trade` + section `trade.window.*` (13 clés)

### Détails techniques
**TradeWindow.jsx**
- Shell `className="combat-win"` + `useDraggable('trade-window-pos', ...)` — panel 480px, position persistée localStorage
- 2 tabs : `marchands` | `journal`

**Tab Marchands**
- `GET /api/campaigns/:id/merchants` au mount
- State `drafts = { [id]: { status, mod_global } }` pour éditions locales non encore sauvegardées
- Par marchand : nom + badge OUVERT/FERMÉ (toggle click) + input `mod_global` + bouton "Sauv." grisé si propre
- `PUT /api/campaigns/:id/merchants/:mid` → met à jour `merchants` + supprime le draft

**Tab Journal**
- `GET /api/campaigns/:id/trade-log?page=N&type=...` chargé à l'ouverture du tab + sur changement filtre/page
- Filtres : Tous | Achat | Échange PJ | Don GM
- Pagination (PAGE_SIZE = 50 — aligné service)
- Listener WS `TRADE_LOG_UPDATED` → prepend entry (pour transfers PJ↔PJ temps réel)

**Intégration SessionPage.jsx**
- Bouton "Commerce" dans la gmBar (GM only) — toggle — remplacé par menu radial en étape 11
- `{isGm && tradeWindowOpen && <TradeWindow ... />}` après CombatOverlay

### Testé
SR ✅ — bouton Commerce visible GM ✅ — fenêtre draggable ✅ — toggle statut OUVERT/FERMÉ ✅ — mod_global éditable + sauvegardé ✅ — tab Journal avec filtres ✅

### Non testé
Livre de compte avec vraies transactions (aucune en base lors du test) — affichage "Aucune transaction" confirmé ✅

### Prochaine étape
PLAN_TRADE étape 9 : `TradeWindow.jsx` vue Joueur — sélecteur marchand + catalogue + panier + checkout

---

## Session 124 (suite) — PLAN_TRADE étape 9 ✅ — TradeWindow vue Joueur

### Objectif
Ajouter la vue Joueur dans `TradeWindow.jsx` : sélecteur marchand (filtré serveur), catalogue navigable (FAM→items), panneau détail inline, panier + checkout atomique.

### Fichiers modifiés
- `client/src/components/TradeWindow.jsx` — réécriture complète (+150L vue joueur)
- `client/src/pages/SessionPage.jsx` — `myCharId` derivé + condition `{tradeWindowOpen &&` (sans `isGm &&`) + props `isGm` + `myCharId`
- `client/src/locales/fr.json` — +13 clés `trade.window.*` (vue joueur)

### Détails techniques

**Nouveaux props TradeWindow**
- `isGm = true` : détermine la branche de rendu (GM view ou Player view)
- `myCharId = null` : transmis au catalogue (`?charId=`) et au checkout (`charId` body)

**Vue Joueur — architecture**
- `merchants` chargé par le même `useEffect([campaignId])` — serveur filtre OPEN + autorisé pour les non-GM
- `<select>` marchand → `loadCatalog(id)` → `GET /catalog?charId=myCharId` → `catalog` array avec `catalog_price`
- Filtres famille : extrait depuis `catalog.map(i => i.family)`, tri alpha, boutons toggle
- Liste items scrollable (maxHeight 260px) : clic → détail inline (poids / NT / gén / rareté) + contrôles qté [−][+]
- Panier : `cart = [{ item, qty }]` — `addToCart` / `removeFromCart` avec `setCart(prev => ...)` (pas de stale closure)
- Checkout : `POST /:mid/buy { charId, items: [{equipmentId, qty}] }` → `checkoutMsg { ok, text }` (vert/rouge)

**SessionPage.jsx**
- `myCharId = characters.find(c => c.user_id === user?.id)?.id ?? null` — derivé sans useState
- Condition changée : `{isGm && tradeWindowOpen &&` → `{tradeWindowOpen &&` (prépare étape 11 menu radial sans autre touche)

### Testé
SR ✅ — vue GM inchangée (tabs Marchands + Journal) ✅

### Non testé
Vue Joueur (catalogue + panier + checkout) — accessible après étape 11 (menu radial) ou en passant `isGm={false}` temporairement

### Prochaine étape
PLAN_TRADE étape 10 : `TradeWindow.jsx` vue Échange PJ↔PJ — propose + accept/decline/cancel + timer expiration

---

## Session 125 — 2026-06-25 — CL3 ✅ + refonte méthode debug

### CL3 ✅ — Ghosts déplacement + lignes attaque disparus en ANNOUNCEMENT

**Cause racine [VÉRIFIÉ par instrumentation]** : `announcementMarker` dans `useCombatSocket.js` était un singleton écrasé à chaque `COMBAT_ACTION_DECLARED`. Données vérifiées côté serveur et client via logs `[DBG-CL3]` : payload correct, bug dans le rendu uniquement.

**Fichiers modifiés**
- `client/src/components/Canvas3D.jsx` — `Scene` : `announcedActions` ajouté au destructure `useCombatStore`. Deux blocs IIFE singleton remplacés par `.map()` sur `announcedActions` filtré, gardé par `phase === 'ANNOUNCEMENT'` :
  - Ghosts déplacement : `filter(e => e.moveTarget)` → `<group key={tokenId}>` avec mesh + ligne + Billboard
  - Lignes attaque : `filter(e => e.attackTargetId)` → `<line key={tokenId}>`

**Testé** : SR ✅ — 3 déclarations déplacement simultanées visibles ✅ (Saar)

**Non testé** : plusieurs lignes d'attaque simultanées — même mécanique

---

### Méthode debug — refonte BUGIDENTIFIE.md + CLAUDE.md

Dérive identifiée : diagnostic labellisé [VÉRIFIÉ] sur lecture seule, fix proposé sur [HYPOTHÈSE] non instrumentée. Refonte des deux documents :
- `docs/BUGIDENTIFIE.md` : pipeline renommé (ajout étape "Reproduire" obligatoire, "Instrumenter" toujours obligatoire), label [VÉRIFIÉ] corrigé (exige instrumentation + observation en exécution)
- `CLAUDE.md` DÉTECTEUR DE DÉRIVE : +3 lignes ([VÉRIFIÉ] après lecture seule → STOP, fix sur [HYPOTHÈSE] → STOP, bug non reproductible → STOP)

---

## Session 125 (suite) — 2026-06-25 — PLAN_TRADE étapes 10–11 ✅ + bugfixes Trade

### Étape 10 — TradeWindow vue Échange PJ↔PJ ✅

**Fichiers modifiés**
- `client/src/components/TradeWindow.jsx` — tab Échange joueur : sélecteur cible PJ, chargement inventaire, liste items proposés, saisie sols, `handleProposeOffer` (ACK → `outboundOffer`), `handleCancelOffer/AcceptOffer/DeclineOffer`. Timer countdown 1s sur `expiresAt`. Listeners WS : `TRADE_OFFER_RECEIVED` (switch tab auto) + ACCEPTED/DECLINED/CANCELLED. Prop `initialContext` pour pré-remplissage depuis menu radial.
- `server/src/socket/socketTrade.js` — TRANSFER_OFFER : param `callback` optionnel + ACK `{ ok, offerId, expiresAt }`
- `client/src/locales/fr.json` — +17 clés `trade.window.tab_catalogue/exchange`, `ex_*`
- `client/src/pages/SessionPage.jsx` — prop `characters` transmis à TradeWindow

### Étape 11 — Menu radial Échange + Sidebar Outils Marchands ✅

**Fichiers modifiés**
- `client/src/components/TokenRadialMenu.jsx` — slot 5 `portee` (disabled) → `echange` (`enabled: !isGm`) + prop `onOpenExchange` + handler case
- `client/src/components/Sidebar.jsx` — `IconCoins` supprimé, bouton "Commerce" standalone supprimé, item "Marchands" dans dropdown "Outils" (`toolsDropdownItemEnabled`), prop `onOpenTrade`
- `client/src/pages/SessionPage.jsx` — `tradeInitialContext` state + câblage `onOpenTrade` Sidebar + `onOpenExchange` TokenRadialMenu + `initialContext` TradeWindow
- `client/src/locales/fr.json` — +`tokenRadial.echange`, `tokenRadial.detailEchange`, `session.commerce`

**Testé** : SR ✅ — Outils → Marchands ✅ — liste marchands peuplée joueur ✅
**Non testé** : Échange PJ↔PJ en session réelle

---

### Bugfixes Trade ✅

**Bug T1 — liste marchands vide côté joueur**
- Cause : `getMerchants` PJ cherchait les characters via join `tokens` — sans token placé → `charIds = []` → retour `[]`
- Fix : `server/src/services/tradeService.js` — `WHERE campaign_id + user_id` direct, sans join tokens

**Bug T2 — `TRANSFER_OFFER error: column tokens.campaign_id does not exist`**
- Cause : 3 handlers `socketTrade.js` (L.34, L.80, L.137) utilisaient `JOIN tokens ON tokens.campaign_id` — colonne inexistante
- Fix : `server/src/socket/socketTrade.js` — `WHERE campaign_id + id + user_id` dans les 3 handlers

**Bug T3 — écran noir sur INSUFFICIENT_FUNDS**
- Cause : `errorHandler` retourne `{ error: { status, message } }`. Client lisait `err.response?.data?.error` → objet → `text = objet` → React crash
- Fix : `TradeWindow.jsx` L.178 → `err.response?.data?.error?.message || err.message`
- Testé : SR ✅ — INSUFFICIENT_FUNDS → message d'erreur panier, pas d'écran noir ✅

---

## Session 125 (suite) — 2026-06-25 — VENTE PJ→GM + achat ×10 munitions

### Contexte

Implémentation VENTE PJ→GM conforme à la spec :
- Flux : PJ propose → GM reçoit notification chat → récap avec prix boutique → Accepter / Contre-offre / Refuser
- Contre-offre persistée en DB (pas en mémoire) — un aller-retour, PJ accepte ou refuse
- Onglet ÉCHANGE retiré de TradeWindow (implémentation future via RadialMenu uniquement)

### Travail effectué

**Migration 90 — `trade_offers` counter-offer :**
- `counter_sols INTEGER` + `merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL`
- Contrainte `chk_trade_offer_status` étendue : `COUNTER_OFFERED` ajouté

**`shared/events.js` — +4 constantes :**
- `TRADE_SELL_COUNTER` (GM→serveur), `TRADE_SELL_COUNTER_RECEIVED` (serveur→PJ), `TRADE_SELL_COUNTER_ACCEPTED` (PJ→serveur), `TRADE_SELL_COUNTER_DECLINED` (PJ→serveur)

**`server/src/services/tradeService.js` :**
- `getMyActiveSellOffer(campaignId, charId)` — restauration état PJ au montage (PENDING ou COUNTER_OFFERED)
- `executeSell` : `whereIn('status', ['PENDING', 'COUNTER_OFFERED'])` pour couvrir les deux états

**`server/src/routes/tradeRoutes.js` :**
- GET `/my-sell-offer?charId=` — restauration PJ après rechargement
- GET `/sell-offers` enrichi : LEFT JOIN `merchants`, retourne `merchantName`, `status`, `counterSols`

**`server/src/socket/socketTrade.js` :**
- Constante `SELL_OFFER_TTL_SEC = 120` (remplace requête `SELECT tour_duration` inexistante)
- `computeCatalogPrice(refPrice, modGlobal)` helper
- Handler `TRADE_SELL_PROPOSED` : enrichissement items (ref_price + catalog_price via JOIN ref_equipment), `merchant_id` en DB, emit `TRADE_SELL_REQUEST` vers socket GM
- Handler `TRADE_SELL_COUNTER` (GM, ACK) : UPDATE status='COUNTER_OFFERED' + counter_sols, emit `TRADE_SELL_COUNTER_RECEIVED` vers PJ
- Handler `TRADE_SELL_COUNTER_ACCEPTED` (PJ) : lit `counter_sols` depuis DB (pas payload client), appelle `executeSell`
- Handler `TRADE_SELL_COUNTER_DECLINED` (PJ) : UPDATE status='DECLINED', emit `TRADE_SELL_RESULT(accepted:false)`

**`client/src/lib/useEntitySocket.js` :**
- Listener `TRADE_SELL_REQUEST` toujours monté → `addMessage({ type: 'sell_request', gmOnly: true, ... })` dans Zustand sessionStore

**`client/src/components/Sidebar.jsx` :**
- Rendu bloc `msg.type === 'sell_request'` : icône + fromCharName + merchantName + "Voir l'offre" (appelle `onOpenTrade({ mode: 'reventes' })`)
- Badge : compte sell_request + entity_action

**`client/src/pages/SessionPage.jsx` :**
- `onOpenTrade={(ctx) => { setTradeInitialContext(ctx ?? null); setTradeWindowOpen(true) }}`

**`client/src/components/TradeWindow.jsx` — réécriture complète :**
- Onglet ÉCHANGE supprimé (state/callbacks échange conservés pour implémentation future via RadialMenu)
- Onglet VENTE (PJ) : sélecteur marchand + inventaire avec ref_price/catalog_price inline + prix demandé + `handleProposeSell` (ACK → sellOfferId + expiresAt)
- Onglet REVENTES (GM) : récap par offre — vendeur, marchand, items avec prix ref/boutique, prix demandé, 3 boutons (Accepter/Contre-offre/Refuser), input contre-offre avec ACK
- Cas UI PJ : en attente (Cas C) / contre-offre reçue avec Accept/Decline (Cas A) / résultat final (Cas B)
- Restauration état depuis GET /my-sell-offer au montage (PJ uniquement)
- `initialContext.mode === 'reventes'` → switch tab GM automatique

**`client/src/locales/fr.json` :**
- `trade.window` : `sell_counter_btn`, `sell_counter_send`, `sell_counter_received`, `sell_counter_accept`, `sell_counter_decline`, `sell_catalog_price`, `sell_merchant_label`
- `sidebar` : `sellRequest`, `sellRequestView`

**Feat — achat ×10 munitions :**
- `TradeWindow.jsx` : `addToCart(item, qty=1)` + bouton `+10` conditionnel sur `item.family === 'Munitions'`

**Bugfix VENTE KO — `tour_duration` inexistante :**
- `socketTrade.js` L.47 + L.180 : `SELECT tour_duration FROM campaigns` → colonne inexistante → handler crashait silencieusement → "Vente refusée" direct
- Fix : constante `SELL_OFFER_TTL_SEC = 120`, requête DB supprimée

### Testé
- Achat marchand : ✅
- Vente PJ→GM : proposition → notification chat GM → récap avec prix boutique → Accepter ✅
- Achat ×10 munitions : ✅

### Non testé
- Contre-offre GM → PJ accepte / refuse (flux complet)
- Restauration état PENDING/COUNTER_OFFERED après rechargement PJ
- Expiration timer 120s

---

## Session 125 (suite 2) — 2026-06-25 — ExchangeWindow + notification GM échange

### Contexte

Fenêtre d'échange PJ↔PJ/PNJ manquante (TradeWindow ne couvrait que l'échange marchand). Sujet 1 = composant standalone. Sujet 2 = notification chat GM quand un PJ propose un échange vers un PNJ GM.

### Travail effectué

**`client/src/components/ExchangeWindow.jsx` — nouveau composant :**
- Fenêtre standalone ouverte depuis RadialMenu "Échange" — aucun onglet
- Props : `campaignId, socket, onClose, myCharId, characters, initialContext`
- 4 cas UI : A (offre envoyée + timer), B (offre reçue + Accept/Decline + timer), C (résultat), D (formulaire)
- Listeners WS : `TRADE_OFFER_RECEIVED / ACCEPTED / DECLINED / CANCELLED / TRADE_ERROR`
- `initialContext.incomingOffer` → pré-chargement Cas B (flux notification chat GM)
- `handleAcceptOffer` : `incomingOffer.toCharId ?? myCharId` — GM accepte au nom du PNJ
- Autocomplete : label "Destinataire" + trigger ≥ 3 lettres + max 3 suggestions + pas de pré-remplissage
- Guard auto-échange : `exTargetId === myCharId` dans guard callback + bouton disabled

**`client/src/pages/SessionPage.jsx` :**
- Import `ExchangeWindow`
- États `exchangeWindowOpen` + `exchangeContext`
- `onOpenExchange` RadialMenu → `setExchangeContext + setExchangeWindowOpen` (TradeWindow inchangé)
- `onOpenExchange` prop → Sidebar (flux notification chat)
- Mount block `{exchangeWindowOpen && <ExchangeWindow ... />}`

**`server/src/socket/socketTrade.js` :**
- `findSocketByCharId` : si `char.user_id === null` (PNJ) → fallback `findGmSocket`
- `TRADE_TRANSFER_OFFER` payload : `toCharId` ajouté à `TRADE_OFFER_RECEIVED`
- `TRADE_TRANSFER_ACCEPTED` : guard étendu — GM peut accepter pour PNJ (`user_id=null && role=gm`)
- Logs `[DBG-ACCEPT]` conservés (entrée + acceptingChar + ownerOk)

**`client/src/lib/useEntitySocket.js` :**
- Listener `TRADE_OFFER_RECEIVED` → `addMessage({ type: 'exchange_offer', ... })` — pattern identique à `onSellRequest`

**`client/src/components/Sidebar.jsx` :**
- Prop `onOpenExchange`
- Ref `prevExchangeOfferCountRef`
- Badge : compte `exchange_offer` (delta)
- Rendu `msg.type === 'exchange_offer'` : fromCharName + itemCount + solsOffer + "Voir l'offre" → `onOpenExchange({ incomingOffer })`

**`client/src/locales/fr.json` :**
- `trade.window` : `ex_target_label`
- `sidebar` : `exchangeOffer`, `exchangeOfferView`

### Bugs résolus

- **`findSocketByCharId` PNJ** : `user_id=null` → match impossible → offre jamais livrée → fallback GM socket
- **TRANSFER_ACCEPTED GM** : `WHERE user_id=GM_id` ne matchait pas PNJ (`user_id=null`) → guard étendu avec `isGm && user_id=null`
- **Auto-échange** : `initialContext.toCharId === myCharId` → bouton restait actif → guard `exTargetId === myCharId`

### Testé
- ExchangeWindow depuis RadialMenu → ouverture ✅
- PJ propose échange vers PNJ GM → notification chat GM ✅
- GM clique "Voir l'offre" → ExchangeWindow avec offre pré-chargée ✅
- GM accepte offre PNJ → transaction ✅ (DBG-ACCEPT `ownerOk=true`)
- Guard auto-échange (bouton disabled) ✅
- Autocomplete : 3 lettres min + max 3 résultats ✅

### Non testé
- PJ↔PJ exchange (deux PJs connectés simultanément)
- Expiration offre (timer 120s)
- Decline / Cancel flow complet

---

## Session 126 — 2026-06-25 — Rechargement drone + cargo visible + ammo type

### Contexte

Continuation du système Trade : permettre au propriétaire d'un drone de lui transférer des munitions/charges depuis son propre inventaire. Visibilité du cargo sur la fiche drone. Améliorations DroneSheet.

### Travail effectué

**Migration 91 — `drone_sheet.charge_utile` + contrainte trade_log :**
- `drone_sheet.charge_utile INTEGER NOT NULL DEFAULT 0` — capacité de charge en kg (0 = non configuré)
- Contrainte `chk_trade_log_type` étendue : `'player_sell'` (existant non déclaré) + `'drone_reload'` (nouveau type)
- Bug découvert : `tradeService.executeSell` utilisait `type='player_sell'` non listé dans la contrainte de migration 85 — corrigé dans la même migration 91

**`shared/events.js` :**
- `TRADE_DRONE_TRANSFER` + `TRADE_DRONE_TRANSFERRED` (v1 : ACK suffisant, broadcast non utilisé)

**`server/src/socket/socketTrade.js` — handler `TRADE_DRONE_TRANSFER` :**
- Guards : G1 (fromChar owner) → G2 (drone exists in campaign) → G3 (`drone.user_id === user.id`) → G4 (items non vide)
- Transaction atomique : `UPDATE char_inventory SET character_id=droneId, container='Coffre', slot=null WHERE id=invId AND character_id=fromChar.id` — guard anti-spoofing implicite
- `INSERT trade_log` type `'drone_reload'`
- ACK callback, pas d'emit broadcast

**`client/src/components/ExchangeWindow.jsx` :**
- Filtre autocomplete : `c.type !== 'drone' || c.user_id === myUserId` — drones visibles uniquement par leur propriétaire
- Flow drone : pas de sols, pas de timer, direct `TRADE_DRONE_TRANSFER` ACK
- Bouton : `t('trade.window.drone_transfer')` si cible drone
- Label reset Cas C : `sell_new` → `ex_new` ("Nouvel échange")

**`client/src/character/DroneSheet.jsx` :**
- StatField `charge_utile` dans grille FICHE (après échelle)
- Section "Chargement" : liste items cargo + poids unitaire + total poids vs charge_utile — visible si `isGm || cargo.length > 0`
- Bouton "Larguer" par item : `POST /char-sheet/:droneId/drone/cargo/:invId/drop` → retire du cargo + update state local
- Props ajoutés : `cargo=[]`, `isOwner=false`, `onCargoUpdate`

**`server/src/routes/character/char-sheet.js` :**
- `GET /:characterId/drone/cargo` : `char_inventory LEFT JOIN ref_equipment WHERE character_id=droneId` → `{ items, total_weight }`
- `POST /:characterId/drone/cargo/:invId/drop` : auth GM ou propriétaire → trouve PJ owner (`type='pj'`) → `getDefaultContainer` → `UPDATE char_inventory`
- `PUT /:characterId/drone` : whitelist `charge_utile`

**`client/src/character/DroneWindow.jsx` :**
- State `cargo` + `api.get('/drone/cargo')` dans `Promise.all`
- Props `cargo`, `isOwner`, `onCargoUpdate={setCargo}` passés à DroneSheet
- WeaponsTab : colonne Ammo → `ammo_restant/contenance_chargeur · ref_caliber` (données déjà dans API)

**`client/src/locales/fr.json` :**
- Drone : `fieldChargeUtile`, `sectionCargo`, `cargoEmpty`, `cargoWeight`, `cargoCapacity`, `cargoDrop`, `cargoDropTitle`
- Trade : `ex_new`, `drone_transfer`, `drone_transferred`

### Testé
- Transfert PJ → drone : item disparaît inventaire PJ, apparaît section Chargement ✅
- Filtre autocomplete : drone non propriétaire invisible ✅
- Flow drone : pas de champ sols, bouton "Transférer au drone" ✅
- ACK ok → message "Transfert effectué" + rechargement inventaire ✅
- Larguer → item revient dans sac PJ propriétaire ✅
- Calibre + contenance visible onglet Armes ✅
- StatField charge_utile éditable GM ✅
- Label "Nouvel échange" dans ExchangeWindow ✅

### Non testé
- Drone sans propriétaire : guard `POST /drop` (400 côté serveur — non simulé)
- charge_utile > 0 : dépassement de capacité non bloqué (v1 — affichage visuel seulement)

---
