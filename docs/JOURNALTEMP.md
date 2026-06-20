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

## REPRENDRE ICI — POST-COMPACT

**FEAT2-C plan validé. Coder directement.**
Protocole : lire CLAUDE.md → lire ce fichier → lire les 2 fichiers sources → implémenter le plan ci-dessous.
NE PAS re-planifier. NE PAS poser de questions. Implémenter.

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
