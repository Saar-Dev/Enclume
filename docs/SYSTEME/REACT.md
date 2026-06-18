# SYSTEME/REACT.md — Règles React, dependency arrays, pièges hooks
> Source : SYSTEME.md §11–§14
> Lire pour : tout useCallback/useEffect/useRef, lock éditeur, ordre déclaration React

---

## Lock éditeur

```
POST /battlemaps/:id/editor-lock      → 200 { ok, lockedUntil } | 423 { lockedBy }
POST /battlemaps/:id/editor-heartbeat → renouvelle (toutes les 30s)
DELETE /battlemaps/:id/editor-lock    → libère au démontage
```

---

## Règles dependency arrays useCallback/useEffect (P3)

| Callback | Variable à inclure | Symptôme si absente |
|---|---|---|
| `handleContextMenuDelete` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleKeyDown` useEffect (Canvas3D) | `socket` | socket?.emit() silencieux |
| `handleCharacterDrop` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleDragStart` (Canvas3D) | `isGm`, `user`, `characters` | ownership check stale |
| raccourcis Digit1-5 (Editor3D) | `activeMaterial` | guard allowed_geometries stale |
| `handleEntityActionResolve` (SessionPage) | `socket` | ENTITY_ACTION_RESOLVE silencieux |
| `handleTokenRotate` (SessionPage) | `socket` | TOKEN_ROTATE silencieux |
| `handlePointerUp` (Canvas3D) | `onTokenRotate`, `characters`, `user` | rotation impossible |

**Exception — actions Zustand :** stables par construction, pas besoin dans les deps.

---

## P3 — socket dans les dependency arrays
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

## P4 — Ordre de déclaration React
Si callback A appelle callback B → A déclaré APRÈS B.
Violation → ReferenceError silencieux (hoisting pas disponible pour les const arrow functions).

## P50 — TDZ : hooks WS après tous les useState (SessionPage)
Tout appel de hook qui passe un setter `useState` directement en argument (ex. `useEntitySocket({ setRadialMenu, setMoveTarget })`) doit être déclaré APRÈS la déclaration `useState` correspondante.
Contrairement aux closures (corps de `useCallback`), les arguments sont évalués **immédiatement** → `ReferenceError: can't access lexical declaration before initialization` → écran noir.
**Règle SessionPage :** placer `useTokenSocket()`, `useEntitySocket(...)`, `useCombatSocket(...)` après l'ensemble des `useState` du composant.

## P40 — battlemapRef pattern
Ref miroir d'un state/prop pour lecture stable dans `useCallback`/`useFrame` sans l'inclure dans les deps.
```javascript
const battlemapRef = useRef(battlemap)
useEffect(() => { battlemapRef.current = battlemap }, [battlemap])
// Utilisé pour : tokensRef, ghostRef, targetRef, combatMoveModeRef, combatTargetModeRef
```

## PI11 — polarisRound : source unique
**Jamais redéfinir `polarisRound` localement. Import obligatoire : `'../../../shared/polarisUtils.js'`.**
Toute copie locale est une erreur de code.

```javascript
// Formule exacte (convention Polaris — LdB) :
export function polarisRound(x) {
  return Math.floor(x + 0.4)
}
// 0.5 arrondit vers le bas (≠ Math.round qui arrondit vers le haut)
// Exemples : polarisRound(2.5) = 2, polarisRound(2.6) = 3
// Utilisé dans : calcSeuils, calcREA, calcSouffle, calcResistanceDroguesInput, calcResistanceArmure
```

## P38 — Raccourcis clavier : `e.code` obligatoire
```javascript
// Correct : e.code = identifiant physique ('Digit1', 'KeyA', 'Space')
if (e.code === 'Digit1') { ... }

// Faux : e.key dépend du layout clavier (AZERTY/QWERTY)
if (e.key === '1') { ... }  // ✗ — 'Digit1' vs '&' selon layout
```
S'applique aussi aux raccourcis multi-modificateurs (Ctrl, Shift).

## PE16 — `e.code` pour la touche Alt
```javascript
// Correct :
if (e.code === 'AltLeft' || e.code === 'AltRight') { ... }
// ou tester e.altKey pour "Alt maintenu"

// Faux : e.key === 'Alt' a des variations selon OS/layout
```

---

## Interfaces composants majeurs

### Canvas3D — props (depuis SessionPage)
```javascript
<Canvas3D
  socket={socket}
  onTokenDoubleClick={handleTokenDoubleClick}
  onEntityClick={handleEntityClick}         // (entity, clientX, clientY)
  onTokenRotate={handleTokenRotate}         // (tokenId)
  moveTarget={moveTarget}                   // null | { entity, interaction, tokenId }
  onMoveCancel={handleMoveCancel}
  dicePayload={lastDiceRoll}                // résultat DICE_RESULT pour animation
  onDiceDone={handleDiceDone}
  combatCameraCenter={combatCameraCenter}   // null | { x, z } coords DB (PE14)
  combatMoveMode={combatMoveMode}           // voir COMBAT.md shapes
  combatTargetMode={combatTargetMode}       // voir COMBAT.md shapes
/>
```

### Guard Q4 — moveTarget actif
Si `moveTarget` est non-null dans SessionPage, `handleEntityClick` annule le mode visée et retourne sans ouvrir de radial menu. Comportement intentionnel — clic pendant mode visée = annulation.

### justSelectedRef — anti-deselect immédiat
```javascript
// Canvas3D — evite dé-sélection immédiate après clic token (onClick Canvas bubbles up)
const justSelectedRef = useRef(false)
// Dans handlePointerUp (clic court) : justSelectedRef.current = true AVANT onTokenSelect
// Dans handleCanvasClick : if (justSelectedRef.current) { reset; return }
// Passé en prop à Scene (stable par useRef)
```

### Handlers Échap — 3 useEffects distincts (Canvas3D)
| Mode actif | Handler | Action |
|---|---|---|
| `moveTarget` (entité) | `e.key === 'Escape'` | `onMoveCancel?.()` |
| `combatMoveMode` | `e.key === 'Escape'` | `combatMoveMode.onCancel()` |
| `combatTargetMode` | `e.key === 'Escape'` | `combatTargetMode.onCancel()` |
Chaque useEffect guard `if (!mode) return` — n'enregistre le listener que quand le mode est actif.
