# PLAN_REWORK14.md — useCombatUIState (combat UI state hook)
> Session 113 — 2026-06-21 | Rédigé après lecture source

---

## ⚠️ INSTRUCTIONS DE RÉCUPÉRATION POST-COMPACT

Si tu reprends depuis un résumé ou un compact :
1. Lire `CLAUDE.md` (instructions + méthode de travail)
2. Lire `docs/ARCHI_REWORK.md` §REWORK-14 (entrée table Prochains reworks)
3. Lire ce fichier en entier
4. Aller à la section **REPRENDRE ICI** en bas → étape courante + fichiers à lire
5. NE PAS re-planifier. NE PAS poser de questions. Coder directement après "Je code ?".

---

## CONTEXTE

### Problème

`combatMoveMode`, `combatTargetMode`, `pendingMoveSelection`, `combatCameraCenter` sont 4 `useState`
déclarés dans `SessionPage.jsx` (L.219/223/225/228). Six handlers qui opèrent sur ces états
(`handleModeReset`, `handleEnterMoveMode`, `handleValidateMove`, `handleCancelPendingMove`,
`handleEnterTargetMode`, `handleValidateTarget`) sont eux aussi inline dans `SessionPage.jsx`.

`CombatOverlay` reçoit actuellement 37 props dont 8 directement issues de ces états/handlers.
`Canvas3D` en reçoit 4 supplémentaires. Cette logique UI de combat n'appartient pas à
`SessionPage` — elle n'interagit pas avec le REST, les stores de session, ni la logique de
chargement.

Conséquences directes lues dans le code :
- `SessionPage.jsx` contient ~60 lignes de logique sélection déplacement/cible sans rapport
  avec la gestion de session.
- `handleModeReset` est le seul handler qui existe uniquement pour être passé à `useCombatSocket`
  — il appartient au domaine combat UI.
- Après REWORK-15 (`SocketProvider`), `SessionContent` contiendra encore ce bloc hors-thème.

Preuves (code lu Session 113) :
- `const [combatCameraCenter, setCombatCameraCenter] = useState(null)` — `SessionPage.jsx` L.219
- `const [combatMoveMode, setCombatMoveMode] = useState(null)` — `SessionPage.jsx` L.223
- `const [pendingMoveSelection, setPendingMoveSelection] = useState(null)` — `SessionPage.jsx` L.225
- `const [combatTargetMode, setCombatTargetMode] = useState(null)` — `SessionPage.jsx` L.228
- `handleModeReset` — `SessionPage.jsx` L.382–384
- `handleEnterMoveMode` — `SessionPage.jsx` L.679–697
- `handleValidateMove` — `SessionPage.jsx` L.699–702
- `handleCancelPendingMove` — `SessionPage.jsx` L.704–706
- `handleEnterTargetMode` — `SessionPage.jsx` L.709–730
- `handleValidateTarget` — `SessionPage.jsx` L.732–735

### Décision architecturale

**Hook custom `useCombatUIState`** — pattern identique aux hooks REWORK-09 et REWORK-15.

Ce hook ne touche pas au socket (aucun `socket.emit`, aucun `socket.on`). Il encapsule uniquement
du UI state local et les handlers associés. Pas de `useSocket()` interne.

Alternatives écartées :
- **Store Zustand `combatUIStore`** — UI state éphémère (null hors combat), reset à chaque fin
  de slot. Zustand est pour du domain state persistant, pas du staging éphémère per-session.
- **Laisser inline dans `SessionContent` (post-REWORK-15)** — réduit le bruit mais ne déplace
  pas la responsabilité. `SessionContent` resterait une God component pour le combat.
- **`useReducer` à la place des 4 `useState`** — techniquement justifié : `combatMoveMode` et
  `combatCameraCenter` changent ensemble dans `handleEnterMoveMode`/`handleEnterTargetMode` ;
  `handleModeReset` change 3 states simultanément. tkdodo.eu ("Should I useState or useReducer?")
  et Kent C. Dodds recommandent `useReducer` quand plusieurs états évoluent ensemble via des
  "actions" nommées. Écarté ici : l'extraction est un refactoring 1:1 (comportement à préserver
  à l'identique). Ajouter un reducer + action types augmente la surface de code sans gain
  fonctionnel. React 18 batchie les mises à jour — aucune différence de performance.
  À considérer si ce hook évolue vers plus d'états ou d'actions complexes.

**⚠️ Ce hook ne résout PAS le prop drilling.**
CombatOverlay reçoit toujours 37 props dont 8 issues de ce hook. Canvas3D reçoit toujours 4 props.
Le hook déplace la logique hors de SessionPage — pas la distribution des props. Prop drilling :
périmètre REWORK-15 (SocketProvider context) ou sprint dédié futur.

### Prérequis

**REWORK-06 (`declarationReducer`) — ordre pratique (pas contrainte technique).**

REWORK-06 refactorise la gestion déclaration dans `CombatGmDeclareWindow` et `CombatActionWindow`
— les closures `onMoveSelected`/`onCancel` passées à `handleEnterMoveMode` /
`handleEnterTargetMode` sont définies côté appelant. Extraire REWORK-14 après REWORK-06 évite
de valider la compatibilité de ces callbacks deux fois (avant et après REWORK-06).

⚠️ **Correction par rapport à la rédaction initiale du plan :**
La justification "stale closures → `setCombatMode` instable" était FAUSSE. Les setters `useState`
sont STABLES entre chaque render, garantie React (react.dev, "I call my state updater … the same
reference"). Il n'y a aucun risque stale closure pour un setter `useState`, identique en cela à
`dispatch`. L'ordre REWORK-06 → REWORK-14 est **pratique**, pas **technique** : les deux reworks
sont indépendants et pourraient être inversés sans casse.

**REWORK-15 (`SocketProvider`) — indépendant techniquement.**
`useCombatUIState` n'utilise pas le socket. Mais la table ARCHI_REWORK.md positionne REWORK-14
"Après fusion" — après la fusion avec le confrère refondant le playground/éditeur.

---

## ÉTAT ACTUEL (lu Session 113 — fichiers source)

### 4 useState ciblés — `SessionPage.jsx`

```js
// L.219 — coords DB (PE14) du token à centrer, null = inactif
const [combatCameraCenter, setCombatCameraCenter] = useState(null)

// L.223 — null = inactif, sinon { tokenId, allures, onMoveSelected, onCancel, onPendingMove }
const [combatMoveMode, setCombatMoveMode] = useState(null)

// L.225 — null = inactif. Sinon shape complet (Canvas3D L.709–717) :
//   { action_key, ini_mod, targetPosX, targetPosY (PE14 = Z Three.js), targetPosZ (altitude DB),
//     screenX (clientX pour CombatOverlay L.362), screenY (clientY pour CombatOverlay L.363) }
const [pendingMoveSelection, setPendingMoveSelection] = useState(null)

// L.228 — null = inactif. Sinon shape complet :
//   { tokenId, mode ('ranged'|'melee'), pendingTargetId, onTargetSelected, onCancel, onPendingTarget }
//   + pendingTargetScreenPos: { x, y } | null — ajouté dynamiquement via onPendingTarget
//   mode est lu par CombatOverlay L.198 : "Corps à corps" vs "Assaut"
const [combatTargetMode, setCombatTargetMode] = useState(null)
```

### 6 handlers ciblés — `SessionPage.jsx`

```js
// L.382–384 — passé à useCombatSocket comme onModeReset
const handleModeReset = useCallback(() => {
  setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
}, [])

// L.679–697 — deps []
const handleEnterMoveMode = useCallback((allures, tokenId, tokenPos, onMoveSelected, onCancel) => {
  const wrappedSelected = (sel) => {
    onMoveSelected(sel)
    setPendingMoveSelection(null)
    setCombatMoveMode(null)
  }
  const wrappedCancel = () => {
    onCancel()
    setPendingMoveSelection(null)
    setCombatMoveMode(null)
  }
  setCombatMoveMode({
    tokenId, allures,
    onMoveSelected: wrappedSelected,
    onCancel: wrappedCancel,
    onPendingMove: (sel) => setPendingMoveSelection(sel),
  })
  setCombatCameraCenter(tokenPos)
}, [])

// L.699–702 — deps [combatMoveMode, pendingMoveSelection]
const handleValidateMove = useCallback(() => {
  if (!combatMoveMode || !pendingMoveSelection) return
  combatMoveMode.onMoveSelected(pendingMoveSelection)
}, [combatMoveMode, pendingMoveSelection])

// L.704–706 — deps []
const handleCancelPendingMove = useCallback(() => {
  setPendingMoveSelection(null)
}, [])

// L.709–730 — deps []
const handleEnterTargetMode = useCallback((tokenId, tokenPos, onTargetSelected, onCancel, mode = 'ranged') => {
  const wrappedSelected = (targetTokenId) => {
    onTargetSelected(targetTokenId)
    setCombatTargetMode(null)
  }
  const wrappedCancel = () => {
    onCancel()
    setCombatTargetMode(null)
  }
  setCombatTargetMode({
    tokenId, mode, pendingTargetId: null,
    onTargetSelected: wrappedSelected,
    onCancel: wrappedCancel,
    onPendingTarget: (id, screenX, screenY) => {
      if (id === tokenId) return  // guard self-targeting
      setCombatTargetMode(prev => prev
        ? { ...prev, pendingTargetId: id,
            pendingTargetScreenPos: screenX != null ? { x: screenX, y: screenY } : null }
        : null)
    },
  })
  setCombatCameraCenter(tokenPos)
}, [])

// L.732–735 — deps [combatTargetMode]
const handleValidateTarget = useCallback(() => {
  if (!combatTargetMode || !combatTargetMode.pendingTargetId) return
  combatTargetMode.onTargetSelected(combatTargetMode.pendingTargetId)
}, [combatTargetMode])
```

### Ordre déclaration actuel — L.379–385

```js
const tokenSocket = useTokenSocket()
const entitySocket = useEntitySocket({ setRadialMenu, setMoveTarget })
// handleModeReset AVANT useCombatSocket — ordre P4 obligatoire
const handleModeReset = useCallback(() => { ... }, [])
const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })
```

### Props CombatOverlay concernées (sur 37 total) — L.1146–1153

```jsx
onEnterMoveMode={handleEnterMoveMode}       // L.1146
combatMoveMode={combatMoveMode}             // L.1147
pendingMoveSelection={pendingMoveSelection}  // L.1148
onValidateMove={handleValidateMove}         // L.1149
onCancelPendingMove={handleCancelPendingMove} // L.1150
combatTargetMode={combatTargetMode}         // L.1151
onEnterTargetMode={handleEnterTargetMode}   // L.1152
onValidateTarget={handleValidateTarget}     // L.1153
```

### Props Canvas3D concernées — L.820–823

```jsx
combatCameraCenter={combatCameraCenter}     // L.820
combatMoveMode={combatMoveMode}             // L.821
pendingMoveSelection={pendingMoveSelection}  // L.822
combatTargetMode={combatTargetMode}         // L.823
```

### Interactions Canvas3D ↔ hook (lu Session 113 — grep Canvas3D.jsx)

Canvas3D est **bidirectionnel** : il **lit** les 4 props et **écrit** via les callbacks embarqués.

**Pattern P40 — ref miroir (Canvas3D L.368–373) :**
```js
const combatMoveModeRef = useRef(null)
combatMoveModeRef.current = combatMoveMode        // mis à jour chaque render
const combatTargetModeRef = useRef(null)
combatTargetModeRef.current = combatTargetMode    // mis à jour chaque render
```
`handleDragStart`, `handlePointerMove`, `handlePointerUp` sont des `useCallback(deps=[])` stables
qui lisent les refs (pas les props directement) pour accéder à l'état courant sans être invalidés
à chaque changement de mode. Ce pattern est interne à Canvas3D — `useCombatUIState` n'y touche pas.

**Write-back depuis Canvas3D :**

| Call site Canvas3D | Callback | Résultat |
|---|---|---|
| `handleDragStart` L.557 | `combatTargetModeRef.current.onPendingTarget(token.id, e.clientX, e.clientY)` | peuple `pendingTargetId` + `pendingTargetScreenPos` |
| `handlePointerUp` L.709–717 | `mode.onPendingMove({ action_key, ini_mod, targetPosX, targetPosY, targetPosZ, screenX, screenY })` | peuple `pendingMoveSelection` |
| Escape key L.1127 / L.1131 | `combatMoveMode.onCancel()` / `combatTargetMode.onCancel()` | reset mode + pendingMoveSelection via wrappedCancel |

**Write-back depuis CombatOverlay (L.210) :**

`combatTargetMode.onPendingTarget(null)` — bouton "Changer" — vide `pendingTargetId` et
`pendingTargetScreenPos`. Guard `if (id === tokenId) return` ne fire **pas** pour `null`
(`null !== tokenId` — tokenId est un entier). Résultat : `{ ...prev, pendingTargetId: null, pendingTargetScreenPos: null }`.

**`pendingTargetScreenPos` — code actif (CombatOverlay L.194–196) :**
Positionne le panneau de sélection cible (`style={{ top: screenPos.y, left: screenPos.x }}`).
NON dead code. Provient de `e.clientX`/`e.clientY` au moment du drag sur un token ennemi.

---

## INTERFACE CIBLE

```js
// client/src/lib/useCombatUIState.js

import { useState, useCallback } from 'react'

export function useCombatUIState() {
  const [combatMoveMode,       setCombatMoveMode]       = useState(null)
  const [pendingMoveSelection, setPendingMoveSelection] = useState(null)
  const [combatTargetMode,     setCombatTargetMode]     = useState(null)
  const [combatCameraCenter,   setCombatCameraCenter]   = useState(null)

  const handleModeReset = useCallback(() => {
    setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
  }, [])

  const handleEnterMoveMode = useCallback((allures, tokenId, tokenPos, onMoveSelected, onCancel) => {
    const wrappedSelected = (sel) => {
      onMoveSelected(sel)
      setPendingMoveSelection(null)
      setCombatMoveMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setPendingMoveSelection(null)
      setCombatMoveMode(null)
    }
    setCombatMoveMode({
      tokenId, allures,
      onMoveSelected: wrappedSelected,
      onCancel: wrappedCancel,
      onPendingMove: (sel) => setPendingMoveSelection(sel),
    })
    setCombatCameraCenter(tokenPos)
  }, [])
  // deps [] — setters stables, onMoveSelected/onCancel capturés à l'appel dans les closures wrappées

  const handleValidateMove = useCallback(() => {
    if (!combatMoveMode || !pendingMoveSelection) return
    combatMoveMode.onMoveSelected(pendingMoveSelection)
  }, [combatMoveMode, pendingMoveSelection])

  const handleCancelPendingMove = useCallback(() => setPendingMoveSelection(null), [])

  const handleEnterTargetMode = useCallback((tokenId, tokenPos, onTargetSelected, onCancel, mode = 'ranged') => {
    const wrappedSelected = (targetTokenId) => {
      onTargetSelected(targetTokenId)
      setCombatTargetMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setCombatTargetMode(null)
    }
    setCombatTargetMode({
      tokenId, mode, pendingTargetId: null,
      onTargetSelected: wrappedSelected,
      onCancel: wrappedCancel,
      onPendingTarget: (id, screenX, screenY) => {
        if (id === tokenId) return  // guard self-targeting — reproduit SessionPage L.726
        setCombatTargetMode(prev => prev
          ? { ...prev, pendingTargetId: id,
              pendingTargetScreenPos: screenX != null ? { x: screenX, y: screenY } : null }
          : null)
      },
    })
    setCombatCameraCenter(tokenPos)
  }, [])
  // deps [] — même raison que handleEnterMoveMode

  const handleValidateTarget = useCallback(() => {
    if (!combatTargetMode?.pendingTargetId) return
    combatTargetMode.onTargetSelected(combatTargetMode.pendingTargetId)
  }, [combatTargetMode])

  return {
    combatMoveMode,
    pendingMoveSelection,
    combatTargetMode,
    combatCameraCenter,
    handleModeReset,         // → useCombatSocket({ onModeReset })
    handleEnterMoveMode,     // → CombatOverlay({ onEnterMoveMode })
    handleValidateMove,      // → CombatOverlay({ onValidateMove })
    handleCancelPendingMove, // → CombatOverlay({ onCancelPendingMove })
    handleEnterTargetMode,   // → CombatOverlay({ onEnterTargetMode })
    handleValidateTarget,    // → CombatOverlay({ onValidateTarget })
  }
}
```

### Usage dans `SessionPage.jsx` (futur `SessionContent` post-REWORK-15) — après migration

```js
// Import ajouté :
import { useCombatUIState } from '../lib/useCombatUIState'

// Ordre hooks (P4) — remplace handleModeReset + 5 handlers + 4 useState :
const tokenSocket = useTokenSocket()
const entitySocket = useEntitySocket({ setRadialMenu, setMoveTarget })
const {
  combatMoveMode, pendingMoveSelection, combatTargetMode, combatCameraCenter,
  handleModeReset, handleEnterMoveMode, handleValidateMove,
  handleCancelPendingMove, handleEnterTargetMode, handleValidateTarget,
} = useCombatUIState()
const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })
// onModeReset: handleModeReset — inchangé. handleModeReset vient maintenant du hook.
```

---

## PIÈGES IDENTIFIÉS (run à vide)

**P-R14-1 — Ordre TDZ (P4)**
`useCombatUIState()` doit être déclaré APRÈS `useEntitySocket` et AVANT `useCombatSocket`.
`handleModeReset` retourné par le hook est passé à `useCombatSocket` comme `onModeReset`.
Si le hook est déclaré APRÈS `useCombatSocket` → `handleModeReset` est `undefined` au moment
de l'appel → `useCombatSocket` ne peut pas reset les modes en fin de slot.

**P-R14-2 — `handleEnterMoveMode` et `handleEnterTargetMode` : deps `[]` corrects**
Les state setters (`setCombatMoveMode`, `setPendingMoveSelection`, `setCombatCameraCenter`,
`setCombatTargetMode`) sont stables (garantie React). Les callbacks `onMoveSelected`/`onCancel`/
`onTargetSelected` sont capturés à chaque appel dans les closures `wrappedSelected`/`wrappedCancel`
— pas dans les deps du `useCallback`. Les wrappers se recréent à chaque appel du handler, pas
à chaque render. Comportement identique à l'actuel `SessionPage.jsx`.

**P-R14-3 — Guard self-targeting dans `onPendingTarget` — double rôle**
`if (id === tokenId) return` — L.726 de `SessionPage.jsx`. `tokenId` est capturé dans la
closure de `handleEnterTargetMode` (paramètre de fonction). Reproduire fidèlement.

Ce guard a deux call sites avec des comportements différents :
- `Canvas3D handleDragStart` → appelle `onPendingTarget(token.id, clientX, clientY)` — le guard
  filtre les tokens ennemis vs le token actif.
- `CombatOverlay "Changer" L.210` → appelle `onPendingTarget(null)` — `null !== tokenId` (tokenId
  est un entier), donc le guard **ne fire pas**. Résultat : `pendingTargetId: null`,
  `pendingTargetScreenPos: null`. C'est le mécanisme de reset du target sélectionné.

**P-R14-4 — `pendingTargetScreenPos` conditionnel**
`screenX != null ? { x: screenX, y: screenY } : null` — L.726–727 actuel.
Ne pas omettre ce champ conditionnel. Le `?? null` doit être `!= null` (pas `!== null`) pour
couvrir à la fois `null` et `undefined` comme dans l'original.

**P-R14-5 — `handleValidateTarget` guard**
Version actuelle (L.733) : `if (!combatTargetMode || !combatTargetMode.pendingTargetId) return`.
Dans le hook, `combatTargetMode?.pendingTargetId` est équivalent et plus concis — les deux
couvrent le cas `null` ET le cas `pendingTargetId` falsy.

**P-R14-6 — Piège setState(fn) : fonctions stockées dans un objet d'état**
`combatMoveMode`, `combatTargetMode` sont des **objets** contenant des callbacks (`onMoveSelected`,
`onCancel`, `onPendingMove`, `onTargetSelected`, `onPendingTarget`).

React traite tout argument fonctionnel de `setState` comme un **updater** :
`setCombatMoveMode(fn)` → React appelle `fn(prevState)` au lieu de stocker `fn`.

Conséquences :
- `setCombatMoveMode({ tokenId, onMoveSelected: wrappedFn })` → **correct** (on passe un objet)
- `setCombatMoveMode(wrappedFn)` → **incorrect** (React appelle `wrappedFn(prev)`)

Dans le hook, toutes les mutations de ces states passent un objet literal (jamais la fonction
directement). Vérifier tout futur ajout de callback en state : toujours envelopper dans `{}`.

Référence : react.dev — "Updating state with the next value... If you pass a function, it will be
treated as an updater function."

---

## PÉRIMÈTRE

**Fichiers touchés :**
- `client/src/lib/useCombatUIState.js` — **créé**
- `client/src/pages/SessionPage.jsx` (futur `SessionContent` post-REWORK-15) :
  - 4 `useState` supprimés : L.219 (`combatCameraCenter`), L.223 (`combatMoveMode`),
    L.225 (`pendingMoveSelection`), L.228 (`combatTargetMode`)
  - `handleModeReset` useCallback L.382–384 supprimé
  - `handleEnterMoveMode` L.679–697 supprimé
  - `handleValidateMove` L.699–702 supprimé
  - `handleCancelPendingMove` L.704–706 supprimé
  - `handleEnterTargetMode` L.709–730 supprimé
  - `handleValidateTarget` L.732–735 supprimé
  - Import `useCombatUIState` ajouté
  - `const { ... } = useCombatUIState()` ajouté entre `useEntitySocket` et `useCombatSocket`

**Fichiers NON touchés :**
- `client/src/components/CombatOverlay.jsx` — interface props inchangée (mêmes noms)
- `client/src/components/Canvas3D.jsx` — props inchangées (mêmes noms)
- `client/src/lib/useCombatSocket.js` — signature `{ isGm, setMode, onModeReset }` inchangée
- `client/src/lib/useTokenSocket.js` / `useEntitySocket.js` — non touchés
- `shared/events.js` — aucun event nouveau
- Tout le code serveur — non touché
- Les stores Zustand — non touchés

---

## PLAN D'IMPLÉMENTATION

> ⚠️ Numéros de ligne = code pré-REWORK-15. Après REWORK-15, `SessionPage` est restructuré
> en `SessionPage + SessionContent` et les lignes se décalent. Identifier les blocs par leur
> contenu, pas par leur numéro.

### Étape 1 — Créer `client/src/lib/useCombatUIState.js`

Contenu exactement conforme à l'interface cible §INTERFACE CIBLE.
Aucun fichier existant modifié à cette étape.
Run à vide : `npm run build` client — zéro erreur.

---

### Étape 2 — Modifier `SessionPage.jsx` (ou `SessionContent` post-REWORK-15)

**Lire `SessionPage.jsx` avant de coder — vérifier les lignes exactes.**

**2a — Import** (après les imports hooks existants) :
```js
import { useCombatUIState } from '../lib/useCombatUIState'
```

**2b — Supprimer les 4 useState** (identifier par contenu) :
```js
// SUPPRIMER intégralement :
const [combatCameraCenter,   setCombatCameraCenter]   = useState(null)
const [combatMoveMode,       setCombatMoveMode]       = useState(null)
const [pendingMoveSelection, setPendingMoveSelection] = useState(null)
const [combatTargetMode,     setCombatTargetMode]     = useState(null)
// + les commentaires qui les précèdent (L.217–228)
```

**2c — Supprimer `handleModeReset`** (identifier par contenu) :
```js
// SUPPRIMER :
const handleModeReset = useCallback(() => {
  setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
}, [])
```

**2d — Ajouter `useCombatUIState()`** à la place de `handleModeReset`, AVANT `useCombatSocket` :
```js
const {
  combatMoveMode, pendingMoveSelection, combatTargetMode, combatCameraCenter,
  handleModeReset, handleEnterMoveMode, handleValidateMove,
  handleCancelPendingMove, handleEnterTargetMode, handleValidateTarget,
} = useCombatUIState()
```
⚠️ P-R14-1 : ordre final obligatoire :
`useTokenSocket` → `useEntitySocket` → `useCombatUIState` → `useCombatSocket`

**2e — Supprimer les 5 handlers** (identifier par leur nom et contenu) :
- `handleEnterMoveMode` — bloc useCallback L.679–697 (y compris commentaire section)
- `handleValidateMove` — bloc useCallback L.699–702
- `handleCancelPendingMove` — bloc useCallback L.704–706
- `handleEnterTargetMode` — bloc useCallback L.709–730 (y compris commentaire section)
- `handleValidateTarget` — bloc useCallback L.732–735

**2f — Vérifier `useCombatSocket`**
`onModeReset: handleModeReset` — inchangé. `handleModeReset` vient maintenant du hook.
Aucune modification sur cette ligne.

**2g — Vérifier le render JSX**
`combatMoveMode`, `pendingMoveSelection`, `combatTargetMode`, `combatCameraCenter` sont dans
le scope de `SessionContent` via la destructuration 2d. Aucune modification JSX nécessaire.

Run à vide : SR + `npm run build` client — zéro erreur.

---

## VALIDATION

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Session ouverte hors combat | Aucune régression, tokens visibles, chat fonctionnel |
| V2 | Mode combat activé (⚔) | CombatOverlay s'affiche, timeline visible |
| V3 | Phase RÉSOLUTION — PJ sélectionne "Déplacer" | Zones colorées Canvas3D, `combatMoveMode` peuplé |
| V4 | PJ clique une zone de déplacement | `pendingMoveSelection` peuplé, bouton "Valider" actif |
| V5 | PJ valide le déplacement | Callback déclenché, `combatMoveMode = null`, `pendingMoveSelection = null` |
| V6 | PJ annule le déplacement en cours | `pendingMoveSelection = null`, mode déplacement toujours actif |
| V7 | Mode cible — PJ survole un token ennemi | `combatTargetMode.pendingTargetId` peuplé |
| V8 | PJ survole son propre token | Ignoré — guard self-targeting |
| V9 | PJ valide la cible | Callback déclenché, `combatTargetMode = null` |
| V10 | `COMBAT_END` ou avancement de slot | `handleModeReset` via `useCombatSocket` — `combatMoveMode`, `combatTargetMode`, `pendingMoveSelection` tous null |
| V11 | Démarrage mode déplacement | `combatCameraCenter` peuplé avec `tokenPos`, Canvas3D centre la vue |
| V12 | Démarrage mode cible | `combatCameraCenter` peuplé avec `tokenPos` |
| V13 | PJ survole cible puis clique "Changer" | `pendingTargetId = null`, `pendingTargetScreenPos = null`, mode cible toujours actif |

---

## DEFINITION OF DONE

### useCombatUIState.js

- [ ] `client/src/lib/useCombatUIState.js` créé — 4 `useState` + 6 `useCallback`
- [ ] `handleModeReset` : reset `combatMoveMode`, `combatTargetMode`, `pendingMoveSelection` — deps `[]`
  - ⚠️ `combatCameraCenter` intentionnellement NON reset (caméra reste sur la dernière position — comportement source SessionPage.jsx préservé)
- [ ] `handleEnterMoveMode` : deps `[]` — closures wrappées créées à l'appel, setters stables
- [ ] `handleValidateMove` : deps `[combatMoveMode, pendingMoveSelection]`
- [ ] `handleCancelPendingMove` : deps `[]`
- [ ] `handleEnterTargetMode` : deps `[]` — guard self-targeting `if (id === tokenId) return` — `pendingTargetScreenPos` conditionnel (`!= null`)
- [ ] `handleValidateTarget` : deps `[combatTargetMode]` — guard `?.pendingTargetId`
- [ ] Aucun import socket, aucun import store, aucun effet de bord WS — hook UI pur

### SessionPage.jsx (futur SessionContent post-REWORK-15)

- [ ] 4 `useState` supprimés (`combatCameraCenter`, `combatMoveMode`, `pendingMoveSelection`, `combatTargetMode`)
- [ ] `handleModeReset` useCallback supprimé
- [ ] 5 handlers supprimés (`handleEnterMoveMode`, `handleValidateMove`, `handleCancelPendingMove`, `handleEnterTargetMode`, `handleValidateTarget`)
- [ ] `const { ... } = useCombatUIState()` déclaré APRÈS `useEntitySocket`, AVANT `useCombatSocket` (P-R14-1)
- [ ] `useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })` inchangé
- [ ] Render JSX CombatOverlay — 8 props inchangées (noms identiques, sources via hook)
- [ ] Render JSX Canvas3D — 4 props inchangées

### Documentation

- [ ] `npm run build` — zéro erreur
- [ ] SR — zéro erreur
- [ ] Scénarios V1–V12 validés
- [ ] `docs/ARCHI_REWORK.md` — REWORK-14 déplacé dans "Reworks achevés" (après clos)
- [ ] `docs/JOURNAL5.md` appended

---

## REPRENDRE ICI — POST-COMPACT

**État courant : Session 113 — plan rédigé + analyse critique appliquée. En attente de "Je code ?".**

Fichiers lus en session 113 :
- `client/src/pages/SessionPage.jsx` — 1184L — lu intégralement
- `client/src/components/CombatOverlay.jsx` — L.1–380 lu (signature + panels mode déplacement/cible)
- `client/src/components/Canvas3D.jsx` — grep complet (P40 pattern + write-back callbacks)
- `docs/PLAN_REWORK06.md` — lu intégralement (dépendance REWORK-06 confirmée)
- `docs/ARCHI_REWORK.md` — lu intégralement (ordre reworks + prérequis confirmés)

Décision architecturale : hook custom `useCombatUIState` (PAS un store Zustand, PAS useReducer).
Justification : UI state éphémère, pas partagé entre composants distincts, pas de socket.
Extraction 1:1 — comportement identique à l'actuel SessionPage.jsx.

Prérequis pratique (pas technique) : **REWORK-06 (`declarationReducer`) livré et validé avant de
coder REWORK-14.** Raison : REWORK-06 touche les call sites de `handleEnterMoveMode` /
`handleEnterTargetMode`. Ordre pour éviter double-validation de la compatibilité callbacks.

Pièges documentés : P-R14-1 (TDZ ordre hooks), P-R14-2 (deps [] valides), P-R14-3 (guard null +
onPendingTarget(null) Changer), P-R14-4 (screenX conditionnel), P-R14-5 (?.pendingTargetId),
P-R14-6 (setState(fn) trap pour callbacks-en-state).

Prochaine étape : **"Je code ?" → Étape 1 (créer useCombatUIState.js)**
→ ⚠️ Blocker ordre : REWORK-06 validé + fusion confrère (playground/éditeur) avant de coder.
→ Lire `SessionPage.jsx` (ou `SessionContent` post-REWORK-15) avant Étape 2.
→ Vérifier P-R14-1 à P-R14-6 avant chaque étape.
