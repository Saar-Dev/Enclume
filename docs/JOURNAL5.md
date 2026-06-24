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
