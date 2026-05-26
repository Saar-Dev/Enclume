# JOURNALTEMP — Canvas3D.jsx audit

## Fragment 1 — lignes 0-200 (imports, constantes, TokenRing, TokenMesh début)

### Constantes
- `GRID_SIZE = 50`
- `DEFAULT_TOKEN_URL = ${VITE_API_URL}/api/assets/tokens/default.glb`
- `FONT_URL = '/fonts/inter.woff'`
- `DRAG_THRESHOLD = 4` px — distingue clic court vs drag
- `DRAG_HOVER = 0.5` — offset visuel token pendant drag
- `DRAG_TILT_MAX = 0.3` rad — inclinaison max pendant drag

### threeToDb — confirmé (déjà dans CONVENTIONS.md §18)
`function threeToDb(tx, ty, tz) { return { pos_x: tx, pos_y: tz, pos_z: ty } }`

### TokenRing
- Anneau animé sous le token : `ringGeometry args=[0.5, 0.58, 48]`
- Sélectionné : pulse sin(time*3)*0.05 Y, scale sin(time*2.5)*0.08, opacity fluctue
- Non sélectionné : baseY=0.6 (0.1 si drag), opacité fixe

### TokenMesh — coordonnées
- `baseX = token.pos_x`, `baseY = token.pos_z` (altitude), `baseZ = token.pos_y` (profondeur) — PE14 CONFIRMÉ
- Position affichée : `x+0.5, y+0.5, z+0.5` (centrage sur voxel)
- Drag : `y = dragState.y` (sans +0.5, car DRAG_HOVER gère l'offset)

### TokenMesh — Lerp (P40 confirmé)
- `lerpPos.current` + `targetRef.current` dans useFrame — jamais via state
- Lerp exponentiel : `alpha = 1 - exp(-delta / 0.1)` → 95% convergence ~300ms
- Drag : snap immédiat (pas de lerp)

### TokenMesh — matériaux (P20 confirmé)
- `SkeletonUtils.clone(gltfScene)` + traversal
- Chaque mesh : `mat.clone()` avant mutation — évite corruption matériaux partagés entre tokens
- isGmLayer : `transparent=true, opacity=0.5`
- `mat.map.colorSpace = THREE.SRGBColorSpace` après clone

### TokenMesh — rotation PE21 confirmé
- `rotationY = (token.r ?? 0) * Math.PI / 4` — sur le `<group>` parent
- Tilt drag sur le `<primitive>` — indépendant du rotationY

### TokenMesh — events
- `onPointerDown` → `onDragStart(e, token)` (stopPropagation)
- `onDoubleClick` → `onTokenDoubleClick?.(token, e.clientX, e.clientY)`
- `userData = { isToken: true, tokenId: token.id }`

### useGLTF
- Suspend le composant le temps du chargement (géré par Canvas R3F)
- Cache par URL — plusieurs tokens avec même URL → 1 seul téléchargement

---

## Fragment 2 — lignes 200-400 (Scene props, states, handlers début)

### Scene — props complètes
```jsx
function Scene({
  voxels, setVoxels, textureMaterials, entityTextureMaterials, socket, battlemapId,
  selectedTokenId, onTokenSelect,
  onTokenDoubleClick, justSelectedRef,
  altPressed, onEntityClick, onTokenRotate,
  moveTarget, onMoveCancel, moveLabels,
  dicePayload, onDiceDone,
  combatCameraCenter,
  combatMoveMode,
  combatTargetMode,
})
```

### Scene — stores lus directement (pas de props)
- `useTokenStore()` → `tokens, updateToken, removeToken`
- `useCharacterStore()` → `characters, isGm`
- `useAuthStore()` → `user`
- `useEntityStore()` → `entities, blueprints, addEntity, removeEntity, updateEntity`

### Scene — states
- `dragState` — null | `{ x, y, z, tiltX, tiltZ }`
- `ghostPos` — null | `{ x, z }` — coords base PE14 — mode visée entité
- `dotResult` — number : >0 push, <0 pull, =0 impossible
- `combatCursorPos` — null | `{ x, z }` — curseur snappé mode combat move

### Scene — refs miroir (P40)
- `ghostRef = { ghostPos, dotResult }` — lecture stable dans handlePointerUp
- `tokensRef` — miroir `tokens` — lecture stable dans handlePointerMove
- `combatMoveModeRef` — miroir `combatMoveMode`
- `combatTargetModeRef` — miroir `combatTargetMode`
- `dragRef` — `{ active, tokenId, token, startX, startY, hasMoved, prevWorldX, prevWorldZ }`

### Nettoyage combatCursorPos
- `useEffect([combatMoveMode])` : si `!combatMoveMode` → `setCombatCursorPos(null)`

### WS listeners Scene
- VOXEL_ADDED : `({ x, y, z, tex, geo, r })` → setVoxels
- VOXEL_REMOVED : `({ x, y, z })` → setVoxels delete
- VOXEL_UPDATED : `({ battlemapId, x, y, z, r })` → guard `battlemapId`, setVoxels update
- ENTITY_CREATED : `({ entity })` → addEntity
- ENTITY_DELETED : `({ entityId })` → removeEntity
- ENTITY_UPDATED : `({ entityId, current_state_id, state, updated_at })` → updateEntity
- ENTITY_MOVED : `({ entityId, pos_x, pos_y, pos_z, r, updated_at })` → updateEntity
- Nettoyage : socket.off sur tous au cleanup useEffect([socket, battlemapId])

### handleDragStart — guards
1. `e.nativeEvent.button !== 0` → return
2. `combatMoveModeRef.current` → return (pas de drag en mode déplacement combat)
3. `combatTargetModeRef.current` → `onPendingTarget(token.id)` + return (sélection cible)
4. `!isGm` → vérif ownership : `character.user_id !== user?.id` → return

### handlePointerMove — modes prioritaires
1. `combatMoveModeRef.current` → raycastGround → `setCombatCursorPos({ x: Math.floor(worldPos.x), z: Math.floor(worldPos.z) })` + return
2. `moveTarget` → snap 8 axes depuis entité (suite ci-dessous)
3. drag token normal

### moveTarget — snap 8 axes (handlePointerMove)
- `dPosX = worldPos.x - entity.pos_x` ; `dPosZ = worldPos.z - entity.pos_y` (PE14)
- Si `|dPosX| > 2*|dPosZ|` → axe X pur
- Si `|dPosZ| > 2*|dPosX|` → axe Z pur
- Sinon → diagonal 45° : `dist = round((|dPosX|+|dPosZ|)/2)`
- dot(AE, AD) : A=acteur token, E=entité, D=destination snap
  - `dot > 0` → push, `dot < 0` → pull, `dot = 0` → impossible
- ghostRef miroir mis à jour immédiatement après setGhostPos/setDotResult

### handlePointerMove — drag token normal
- Vérifie `dragRef.current.active` + DRAG_THRESHOLD (4px)
- dragState : `{ tokenId, x: worldPos.x, y: colTopY+0.5+DRAG_HOVER, z: worldPos.z, tiltX, tiltZ }`
- tiltX/Z calculé depuis delta vs prevWorldX/Z, clampé `[-DRAG_TILT_MAX, DRAG_TILT_MAX]`

### raycastGround
- Recast sur `groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0)`
- Retourne `THREE.Vector3 | null`

### getColumnTopY
- Parcourt `voxels` pour `v.x===x && v.z===z` → `Math.max(v.y)`
- Retourne `-1` si colonne vide

---

## Fragment 3 — lignes 400-600 (handlePointerUp, keydown, orbit)

### handlePointerUp — modes prioritaires
1. **combatMoveMode** — prioritaire :
   - `vx = Math.floor(worldPos.x)`, `vz = Math.floor(worldPos.z)`
   - Distance : `dx = vx - token.pos_x`, `dz = vz - token.pos_y` (PE14 : pos_y = profondeur Z Three.js)
   - `matchedZone = zones.find(z => dist <= z.radius)` — ignorer si hors portée max
   - `mode.onPendingMove({ action_key, ini_mod, targetPosX: vx, targetPosY: vz, targetPosZ: 0 })`
   - Note : targetPosY = vz (profondeur PE14), targetPosZ = 0 (altitude)

2. **moveTarget** (entité) :
   - Lit ghostRef.current `{ ghostPos, dotResult }` — jamais le state
   - `if (dr !== 0 && gp)` → `socket.emit(WS.ENTITY_MOVE_REQUEST, { entityId, tokenId, interactionId, moveType: dr>0?'push':'pull', destX: gp.x, destZ: gp.z })`
   - Note : `destZ` = pos_y base malgré le nom (PE14 — commenté dans le code)
   - Toujours `onMoveCancel?.()` + reset ghost

3. **Clic court** (hasMoved=false) :
   - Owner check : `character.user_id === user.id || isGm` → `onTokenRotate?.(token.id)`
   - `justSelectedRef.current = true` puis `onTokenSelect(token.id)`

4. **Drag normal** → `threeToDb(snappedX, snappedY, snappedZ)` + `PUT /tokens/:id`
   - Altitude : `getColumnTopY(snappedX, snappedZ)` (snapped = Math.round)
   - Garde altitude : `minY = isGm ? -1 : 0`, `maxY = isGm ? 8 : 7`
   - Garde grille : `Math.abs(snappedX) > GRID_SIZE/2` OU Z → return
   - `api.put('/tokens/:id', dbPos)` → `updateToken(res.data.token)`

### handleKeyDown — suppression token
- Touche `Delete` ou `Backspace`, GM uniquement, selectedTokenId requis
- `api.delete('/tokens/:id')` → `removeToken(selectedTokenId)`

### MapControls (orbitRef)
- `LEFT: null` (désactivé — utilisé pour drag tokens)
- `MIDDLE: THREE.MOUSE.PAN`
- `RIGHT: THREE.MOUSE.ROTATE`
- `enableDamping + dampingFactor=0.05`, `maxPolarAngle=Math.PI/2`
- `keyPanSpeed=20`

---

## Fragment 4 — lignes 600-800 (caméra, rendu JSX, Canvas3D props)

### combatCameraCenter (PC36)
- `useEffect([combatCameraCenter])` : `orbitRef.current.target.set(cx+0.5, 0, cz+0.5)` + `.update()`
- Shape : `{ x, z }` coords DB (PE14) | null
- Guard : si null → return (caméra reste où elle est)

### Ligne de visée assaut (targetLinePoints)
- `useMemo([combatTargetMode?.pendingTargetId])`
- Guard : requiert `pendingTargetId` + `tokenId` + les deux tokens trouvés
- Points : `Float32Array` de 6 valeurs `[x+0.5, pos_z+1.5, pos_y+0.5, ...]` (PE14+PE34)
- Rendu : `<line>` avec `lineBasicMaterial color="#e07070"`

### Ghost mode visée entité (JSX)
- Condition : `moveTarget && ghostPos`
- Couleur : `dotResult>0 → '#2563eb'` (bleu push), `<0 → '#f97316'` (orange pull), `=0 → '#ef4444'` (rouge impossible)
- Y : `getColumnTopY(ghostPos.x, ghostPos.z) + 1 + 0.05`
- Rendu : `<planeGeometry args=[1,1]>` + wireframe

### Anneaux déplacement combat (combatMoveMode JSX)
- Centré sur `myToken` : `cx = pos_x+0.5`, `cz = pos_y+0.5` (PE14)
- Y : `pos_z + 1.0 + 0.05` (PE34 — pieds du token)
- Rotation group : `[-Math.PI/2, 0, 0]` (couché au sol)
- zones[0] : `circleGeometry args=[zone.radius, 64]`
- zones[i>0] : `ringGeometry args=[zones[i-1].radius, zone.radius, 64]`
- Material : `transparent, opacity=0.25, depthWrite=false`

### Cursor wireframe case survolée (combatMoveMode + combatCursorPos)
- Y : `curToken.pos_z + 1.0 + 0.05` (PE34) ou `0.1` fallback
- `<planeGeometry args=[1,1]>` + wireframe blanc

### Tokens — filtre GM layer
- `tokens.filter(token => isGm || token.layer !== 'gm')` — joueurs ne voient pas la layer GM
- `glbUrl = VITE_API_URL + '/api/assets/' + character.glb_url` ou `DEFAULT_TOKEN_URL`

### Ordre de rendu (z-order)
1. Voxels
2. EntityMesh
3. Ghost entité
4. Tokens
5. Anneaux combat + cursor
6. Ligne de visée
7. DiceRoller

### DiceRoller
- `{dicePayload && <DiceRoller payload={dicePayload} onDone={onDiceDone} />}`
- Monté dans Canvas3D (contexte WebGL unique — règle Dice Rework)

### Canvas3D — props de l'export
```jsx
Canvas3D({ 
  onTokenDoubleClick, socket, onEntityClick, onTokenRotate,
  moveTarget, onMoveCancel,
  dicePayload, onDiceDone,
  combatCameraCenter,
  combatMoveMode,
  combatTargetMode,
})
```
- `onTokenRotate` → callback → SessionPage émet WS.TOKEN_ROTATE
- `moveTarget` : `{ entity, interaction, tokenId }` | null — mode visée déplacement (9F-B2)
- `onMoveCancel` : callback stable (useCallback deps [])
- `combatMoveMode` : `{ tokenId, zones, onMoveSelected, onCancel, onPendingMove }` | null

### Canvas3D — stores lus (composant wrapper)
- `useMapStore()` → `battlemap`
- `useEntityStore()` → `entities`

### moveLabels (i18n)
- Calculés dans Canvas3D (où t() est accessible), passés en prop à Scene
- `{ push: t('entity.movePush'), pull: t('entity.movePull'), impossible: t('entity.moveImpossible') }`

### altPressed (PE16)
- `e.code` obligatoire — invariant AZERTY/QWERTY

---

## Fragment 5 — lignes 800-974 (Échap handlers, init voxels/textures, Canvas)

### Handlers Échap (3 useEffects)
- `moveTarget` → Escape → `onMoveCancel?.()` — annulation mode visée entité
- `combatMoveMode` → Escape → `combatMoveMode.onCancel()` — annulation déplacement combat
- `combatTargetMode` → Escape → `combatTargetMode.onCancel()` — annulation sélection cible

### justSelectedRef
- `useRef(false)` — flag pour éviter dé-sélection immédiate après clic token
- `handleCanvasClick` : si `justSelectedRef.current` → reset + return (pas de deselect)
- Sinon : `setSelectedTokenId(null)`

### Init voxels depuis battlemap.voxel_data
- `useEffect([battlemap?.id, battlemap?.voxel_data])`
- Itère `Object.entries(voxel_data)` : key = `"x:y:z"`, val = `{ tex, geo, r }`
- `setVoxels(map)` — objet indexé par clé voxel

### Chargement textures (useEffect)
- `useEffect([battlemap?.id, battlemap?.voxel_data, blueprintIds])`
- `blueprintIds = [...new Set(entities.map(e => e.blueprint_id))].sort().join(',')`

#### Voxel textures
- Déduplique tex IDs depuis `battlemap.voxel_data`
- `GET /voxel-textures?ids=...` → `{ data: { textures } }` → `loadVoxelTextures(data.textures)`
- `setTextureMaterials({})` si 0 textures

#### Entity textures — fakeTexObjs (PEF2)
- Filtre : `!bp?.pack_id` → skip, `!bp.geometry?.faces` → skip (PEF5 appliqué)
- Base : `{ id: '{bp.id}__base', pack_id, faces: bp.geometry.faces }`
- États avec overrides : `{ id: '{bp.id}__state_{state.id}', pack_id, faces: {...bp.geometry.faces, ...overrides} }`
- `loadVoxelTextures(fakeTexObjs)` → `flat` indexé par key pseudo
- `structured[bp.id] = { base: flat['{bp.id}__base'], states: { [stateId]: flat[key] } }`
- `setEntityTextureMaterials(structured)` — indexé par `bp.id` (PEF3)

#### P26 confirmé
- `setBlocksReady(true)` toujours en fin de `loadBlocks()`, même si 0 textures

### Canvas principal
- `<Canvas camera={{ position: [15,15,15], fov: 60 }} style={{ background: '#0f172a' }}>`
- `onCreated: gl.shadowMap.enabled = true`
- `onClick: handleCanvasClick`
- `{blocksReady && <Scene .../>}` — guard P26

### Lumières Scene
- `<ambientLight intensity={0.8} />`
- `<hemisphereLight args={['#ffffff', '#334155', 0.6]} />`
- `<directionalLight position={[10,20,10]} intensity={1.5} castShadow />`
- `<directionalLight position={[-10,10,-10]} intensity={0.6} />`

---

## ✅ Canvas3D.jsx — AUDIT TERMINÉ

### Mises à jour doc réalisées :
- ENTITES.md : ENTITY_MOVE_REQUEST payload complet (destZ = pos_y base malgré le nom)
- COMBAT.md : PC36 (combatCameraCenter), anneaux combat JSX, cursor wireframe, targetLinePoints
- REACT.md : justSelectedRef pattern, handlers Échap 3 useEffects
