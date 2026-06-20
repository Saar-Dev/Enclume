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
**Non testé :** tokens sur voxels en altitude (pos_z > 0) — attendu correct par la formule.
