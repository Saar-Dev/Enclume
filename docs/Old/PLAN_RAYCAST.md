# PLAN_RAYCAST.md — LOS Raycast : Ligne de vue
> Session 110 — 2026-06-20
> Statut : **Planifié — prêt à coder** (post-audit + recherche documentaire)

---

## Contexte

FEAT2 (`BUGIDENTIFIE.md`) — Vérification ligne de vue (LOS) lors d'un tir ballistique.
Ce plan couvre **FEAT2-A : menu radial "Viser"** (MVP).
FEAT2-B (vérif automatique à la déclaration combat) = sprint futur, infrastructure partagée.

---

## Périmètre MVP (FEAT2-A)

**Objectif :** l'utilisateur peut vérifier manuellement si son token voit une cible via le menu radial.

**Hors périmètre MVP :**
- Animation caméra (v2 dans la foulée)
- Intégration au pipeline de déclaration combat (FEAT2-B)
- LOS partielle / demi-couverture
- LOS multi-cibles

---

## Architecture retenue

### Principe

Infrastructure LOS 100 % client. Le serveur n'a pas de géométrie 3D — le raycast
se fait dans le moteur Three.js / R3F déjà présent.

`fast-voxel-raycast` est déjà importé dans `Canvas3D.jsx` (ligne 10) et utilisé
pour `raycastVoxelColumn`. On réutilise le même module.

### Couches

```
lib/losUtils.js           — fonction pure, zéro React, zéro Three.js
                            checkLOS(voxels, fromToken, toToken) → { clear, dist }

Scene (Canvas3D.jsx)      — interception clic (pattern losModeRef comme combatTargetModeRef)
                            calcul checkLOS, state losLine, rendu <Line> + <Billboard>
                            dismiss losLine dans handlePointerUp (backdrop click)

Canvas3D (outer)          — forwarding props losMode + onLosCancel
                            ESC handler (pattern identique à combatTargetMode L.1102-1110)

SessionPage.jsx           — state losMode, handleViser, plumbing props

TokenRadialMenu.jsx       — enable secteur "viser" + prop onViser

fr.json                   — 3 nouvelles clés : los.clear / los.blocked / los.selectTarget
```

---

## Flux utilisateur détaillé

```
1. Double-clic token A (source)
   → setContextMenu({ token: A, x, y })
   → <TokenRadialMenu> s'ouvre

2. Clic secteur "Viser"
   → doClose() + onViser()
   → SessionPage : setLosMode({ active: true, sourceTokenId: A.id })
   → setContextMenu(null)
   → Canvas3D reçoit losMode

3. Canvas3D en "LOS selection mode"
   → losModeRef.current = losMode (ref miroir, pattern P40)
   → Banner "Sélectionnez une cible" (Billboard centré, prop losMode?.active)
   → Clic backdrop : handlePointerUp → losModeRef.current?.active → onLosCancel()

4. Clic token B (cible) — intercepté dans handleDragStart
   → handleLosTarget(B.id)
   → checkLOS(voxelsRef.current, tokenA, tokenB)
   → setLosLine({ from: [fx,fy,fz], to: [tx,ty,tz], clear: bool })
   → onLosCancel()   ← mode quitte (losMode → null), losLine RESTE affiché

5. Résultat visuel
   → <Line> drei (lineWidth réel) couleur verte ou rouge
   → <Billboard> au milieu du segment : t('los.clear') ou t('los.blocked')

6. Dismiss
   → clic backdrop (handlePointerUp, losLineRef.current truthy) → setLosLine(null)
   → ESC : annule le mode si actif uniquement (V6)
     - Si résultat affiché (mode déjà null) : ESC ne fait rien
```

---

## Implémentation prévue

### `client/src/lib/losUtils.js` — NOUVEAU (~20 lignes)

```js
import raycastVoxels from 'fast-voxel-raycast'

// checkLOS — vérifie si la ligne de vue est dégagée entre deux tokens.
// voxels    : { "x:y:z": voxelObj } — voxelsRef.current de Scene
// fromToken, toToken : objets token DB (pos_x / pos_y=Zthree / pos_z=Ythree)
// Retourne  : { clear: boolean, dist: number }
export function checkLOS(voxels, fromToken, toToken) {
  // PE14 — pos_x=X, pos_y=Z Three.js (profondeur), pos_z=Y Three.js (altitude)
  // Eye height = +0.75 (75% hauteur token — standard pro noa-engine, évite hit immédiat)
  const fx = fromToken.pos_x + 0.5,  fy = fromToken.pos_z + 0.75,  fz = fromToken.pos_y + 0.5
  const tx = toToken.pos_x  + 0.5,  ty = toToken.pos_z  + 0.75,  tz = toToken.pos_y  + 0.5
  const dx = tx - fx, dy = ty - fy, dz = tz - fz
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dist < 0.001) return { clear: true, dist: 0 }
  const dir = [dx / dist, dy / dist, dz / dist]
  const hit = raycastVoxels((x, y, z) => !!voxels[`${x}:${y}:${z}`], [fx, fy, fz], dir, dist - 0.3)
  return { clear: !hit, dist }
}
```

> `dist - 0.3` : marge avant la cible — évite de détecter le voxel "pied de la cible".

### `client/src/locales/fr.json` — +3 clés

Insérer après la section `"tokenRadial"` (avant `"status"`) :

```json
"los": {
  "clear":        "Ligne de vue dégagée",
  "blocked":      "Ligne de vue bloquée",
  "selectTarget": "Sélectionnez une cible"
},
```

### `client/src/components/TokenRadialMenu.jsx` — ~3 lignes

- `actions` : `viser` → `enabled: true`
- `handleSliceClick` : `if (a.id === 'viser') { doClose(); onViser?.() }`
- Prop `onViser` ajoutée à la signature

### `client/src/components/Canvas3D.jsx` — Scene (~50 lignes)

**Ajouts au début de Scene :**

```js
// ─── Mode LOS — P40 : ref miroir + state visuel ────────────────────────────
const losModeRef = useRef(null)
losModeRef.current = losMode                        // sync chaque render
const [losLine, setLosLine] = useState(null)        // null | { from, to, clear }
const losLineRef = useRef(null)
losLineRef.current = losLine                        // ref miroir pour handlePointerUp

// Nouveau check LOS → efface le résultat précédent
useEffect(() => {
  if (losMode?.active) setLosLine(null)
}, [losMode])
```

**Dans `handleDragStart` — insérer APRÈS les guards combatMoveMode et combatTargetMode :**

```js
if (losModeRef.current?.active) {
  handleLosTarget(token.id)
  return
}
```

**`handleLosTarget` — nouvelle fonction (avant `handleDragStart`) :**

```js
const handleLosTarget = useCallback((targetTokenId) => {
  const src = tokensRef.current.find(t => t.id === losModeRef.current?.sourceTokenId)
  const tgt = tokensRef.current.find(t => t.id === targetTokenId)
  if (!src || !tgt) { onLosCancel?.(); return }
  if (targetTokenId === losModeRef.current?.sourceTokenId) return   // P-LOS5
  const { clear } = checkLOS(voxelsRef.current, src, tgt)
  // Stocker les positions Three.js (PE14) — eye height identique à checkLOS
  const from = [src.pos_x + 0.5, src.pos_z + 0.75, src.pos_y + 0.5]
  const to   = [tgt.pos_x + 0.5, tgt.pos_z + 0.75, tgt.pos_y + 0.5]
  setLosLine({ from, to, clear })
  onLosCancel?.()   // mode → null ; losLine reste affiché
}, [onLosCancel])
```

**Dans `handlePointerUp` — insérer AVANT `if (!dragRef.current.active) return` (L.721) :**

```js
// LOS mode actif + clic backdrop → annuler le mode
if (losModeRef.current?.active && !dragRef.current.active) {
  onLosCancel?.()
  return
}
// Résultat LOS affiché + clic backdrop → effacer
if (losLineRef.current && !dragRef.current.active) {
  setLosLine(null)
  return
}
```
Ajouter `onLosCancel` aux deps de `handlePointerUp`.

**Ajouts JSX (dans le return de Scene) :**

```jsx
{/* ── Ligne de vue (LOS) ─────────────────────────────────────────────────── */}
{losLine && (
  <>
    <Line
      points={[losLine.from, losLine.to]}
      color={losLine.clear ? '#70e07a' : '#e07070'}
      lineWidth={3}
    />
    <Billboard position={[
      (losLine.from[0] + losLine.to[0]) / 2,
      (losLine.from[1] + losLine.to[1]) / 2,
      (losLine.from[2] + losLine.to[2]) / 2,
    ]}>
      <Text fontSize={0.35} color="white">
        {losLine.clear ? t('los.clear') : t('los.blocked')}
      </Text>
    </Billboard>
  </>
)}
{losMode?.active && (
  <Billboard position={[0, 4, 0]}>
    <Text fontSize={0.4} color="#ffe066">{t('los.selectTarget')}</Text>
  </Billboard>
)}
```

**Ajouter `Line` à l'import drei (ligne 3) :**

```js
import { ..., Line } from '@react-three/drei'
```

**Ajouts dans `Canvas3D` (outer) :**

- Signature (L.1046) : ajouter `losMode, onLosCancel` après `defaultTokenGlbUrl`
- ESC handler (après L.1110) — même pattern que les 3 existants :

```js
// ─── Annulation mode LOS sur Échap ───────────────────────────────────────
useEffect(() => {
  if (!losMode) return
  const onKeyDown = (e) => { if (e.key === 'Escape') onLosCancel?.() }
  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}, [losMode, onLosCancel])
```

- Forwarder `losMode` et `onLosCancel` à `<Scene losMode={losMode} onLosCancel={onLosCancel} ...>`

### `client/src/pages/SessionPage.jsx` — ~10 lignes

```jsx
const [losMode, setLosMode] = useState(null)

const handleViser = useCallback(() => {
  if (!contextMenu) return
  setLosMode({ active: true, sourceTokenId: contextMenu.token.id })
  setContextMenu(null)
}, [contextMenu])

// Dans <TokenRadialMenu ...> (L.886-896) : + onViser={handleViser}
// Dans <Canvas3D ...> : + losMode={losMode} onLosCancel={() => setLosMode(null)}
```

---

## Fichiers NON touchés

- `server/` — zéro modification serveur
- `shared/events.js` — zéro nouvel event WS
- `socketCombat.js`, `socketToken.js`, etc.
- `CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx` (FEAT2-B = sprint futur)

---

## Pièges identifiés (run à vide)

| # | Piège | Mitigation |
|---|---|---|
| P-LOS1 | `handleDragStart` : ordre de priorité des guards | LOS s'insère APRÈS combatMoveModeRef et combatTargetModeRef |
| P-LOS2 | Source token non trouvée dans tokensRef | Guard : `if (!src \|\| !tgt) { onLosCancel(); return }` |
| P-LOS3 | Ray démarre DANS un voxel (token sous dalle) | Eye height +0.75 réduit le risque. Guard optionnel : `!voxels[\`${floor(fx)}:${floor(fy)}:${floor(fz)}\`]` |
| P-LOS4 | `linewidth` ignoré par WebGL standard | **`<Line>` drei** (THREE.Line2 + shader quads) — lineWidth réel |
| P-LOS5 | Token cible = token source | Guard : `if (targetTokenId === losModeRef.current?.sourceTokenId) return` |
| P-LOS6 | Clic backdrop sans dismiss | `handlePointerUp` : `losLineRef.current && !dragRef.current.active → setLosLine(null)` |
| P-LOS7 | Corner-peeking (rayon par coin exact) | Non déterministe dans la lib. Acceptable MVP. |
| P-LOS8 | Direction vecteur nul (source == cible) | `dist < 0.001 → { clear: true }` dans `checkLOS` |
| P-LOS9 | `<Line>` drei v10.7.7 — format points | `points` attend `Array<[x,y,z]>` ou `Array<Vector3>` — **pas `Float32Array`**. Confirmé docs officiels. |
| P-LOS10 | `losLine` et `losMode` indépendants | `losLine` (visuel) survit à `losMode=null` (mode fermé). `useEffect([losMode])` ne clear `losLine` que si `losMode?.active` (nouveau check démarré), jamais à la fermeture du mode. |
| P-LOS11 | `losLine` stale dans `handlePointerUp` | `handlePointerUp` est `useCallback` — lire `losLine` via `losLineRef.current` (ref miroir P40), pas le state directement. |
| P-LOS12 | ESC dismiss résultat affiché | ESC est câblé dans Canvas3D outer uniquement quand `losMode` est actif (sélection en cours). Quand `losMode=null` (résultat affiché), ESC ne fait rien — dismiss = clic backdrop uniquement (MVP). |
| P-LOS13 | Clic backdrop en LOS mode actif | `handleDragStart` NOT called (pas de mesh). `handlePointerUp` → `losModeRef.current?.active && !dragRef.current.active → onLosCancel()`. |

---

## Affichage ligne — choix technique (post-recherche)

**Problème :** `lineBasicMaterial.linewidth` ignoré par WebGL sur tous GPU modernes. Les lignes natives dans Canvas3D sont en 1px fixe.

**Solution : `<Line>` de `@react-three/drei` v10.7.7**
- Wrapper officiel de `THREE.Line2` + `THREE.LineMaterial`
- Rendu par shader (quads) → épaisseur réelle
- `points` : `Array<[number, number, number]>` — tableau de tuples (PAS Float32Array — P-LOS9)
- Déjà dans les deps, ajouter `Line` à l'import drei

---

## Sources

- [fast-voxel-raycast — GitHub (fenomas)](https://github.com/fenomas/fast-voxel-raycast)
- [Amanatides & Woo 1987 — algorithme DDA](http://www.cse.yorku.ca/~amana/research/grid.pdf)
- [noa-engine — usage de fast-voxel-raycast en contexte voxel](https://github.com/fenomas/noa)
- [drei Line component — docs officielles](https://drei.docs.pmnd.rs/shapes/line)
- [pmndrs/drei — GitHub](https://github.com/pmndrs/drei)

---

## Run à vide prévu entre étapes

1. `losUtils.js` créé → `node --check` (syntaxe) + import test
2. `fr.json` + `TokenRadialMenu` → `npm run build` client
3. `Canvas3D` — Scene modifiée → `npm run build` + SR + test ouverture radial menu
4. `Canvas3D` — outer + ESC → SR + test dismiss + ESC
5. `SessionPage` plumbing → SR + test flux complet

---

## Scénarios de validation

| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Double-clic token A → clic "Viser" | Radial se ferme, banner "Sélectionnez une cible" visible |
| V2 | (V1) Clic token B (vue dégagée) | Ligne verte A→B + "Ligne de vue dégagée". Banner disparaît. |
| V3 | (V1) Clic token B (mur entre A et B) | Ligne rouge A→B + "Ligne de vue bloquée". Banner disparaît. |
| V4 | (V1) Clic token B = token A (même token) | Guard — rien ne se passe, mode reste actif |
| V5 | (V1) Clic sur fond (backdrop) | Mode annulé, banner disparaît, aucun crash |
| V6 | (V1) ESC | Mode annulé, banner disparaît |
| V7 | (V2 ou V3) Clic fond | Ligne disparaît |
| V8 | (V2 ou V3) ESC | Rien (mode déjà null — ESC non câblé pour dismiss résultat) |
| V9 | Ouverture radial menu normal (hors LOS) | Aucune régression |
| V10 | Combat actif + LOS mode | Aucune interférence avec combatTargetModeRef |

---

## Definition of done

- [ ] `losUtils.js` créé — fonction pure, import `fast-voxel-raycast` OK
- [ ] `fr.json` — 3 clés ajoutées
- [ ] `TokenRadialMenu` — secteur "Viser" actif, `onViser` câblé
- [ ] `Canvas3D` Scene — `losModeRef` + `losLineRef` + `handleLosTarget` + `losLine` state + JSX ligne/Billboard/banner
- [ ] `Canvas3D` outer — `losMode/onLosCancel` props + forwarding `<Scene>` + ESC handler
- [ ] `SessionPage` — `losMode` state + `handleViser` + props passées
- [ ] Scénarios V1–V10 validés
- [ ] Aucune régression scénarios combat existants
- [ ] `docs/JOURNAL5.md` appended
- [ ] `BUGIDENTIFIE.md` FEAT2 mis à jour (statut en cours)
- [ ] `ASBUILT.md` mis à jour

---

## v2 — Animation caméra (sprint suivant)

Objectif : après calcul LOS, caméra se déplace derrière le token source dans l'axe de visée.
Infrastructure : `orbitRef.current.target` + `camera.position` — pattern déjà utilisé
par `combatCameraCenter` (useEffect L.806-810).
Animation : lerp frame-by-frame via `useFrame` (déjà utilisé pour token lerp).
Sprint dédié — ne pas intégrer au MVP.
