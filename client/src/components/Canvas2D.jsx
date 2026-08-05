import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapControls, Grid, useTexture, Html } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import api from '../lib/api.js'
import { useTokenStore } from '../stores/tokenStore'
import { useCharacterStore } from '../stores/characterStore'
import { useAuthStore } from '../stores/authStore'
import { TokenLabel, TokenGmBadge, TokenStatusBadges, TokenPortrait, ImageErrorBoundary } from './TokenPresentation.jsx'

// docs/PLAN_BATTLEMAP2D.md §6 (Lot 1) — clé de la salle triviale synthétisée par le serveur à la
// création d'une carte 2D (server/src/routes/battlemaps.js, POST /).
const TRIVIAL_ROOM_ID = 'main'
const CAMERA_DISTANCE = 50

// [VÉRIFIÉ] 2026-07-29 par compilation réelle de la salle triviale (compileSurfaceWorld) : le support
// de sol produit support.y = roomBaseY(0, salle sans level/y) + floorThickness/2 (défaut 0.25 dans
// roomFloorEntries, shared/world/worldCompiler.js) = 0.125. Constante fixe : rien n'expose
// floorThickness pour la salle triviale, jamais configurable côté UI (docs/PLAN_BATTLEMAP2D.md §8).
const TRIVIAL_ROOM_FLOOR_Y = 0.125

// Seuil en pixels pour distinguer clic court (sélection/menu radial) de drag — même valeur que Canvas3D.
const DRAG_THRESHOLD = 4

// Recherche (voir docs/PLAN_BATTLEMAP2D.md §4.3, sources GitHub) : contrairement à Canvas3D (caméra
// orbitale au-dessus d'un sol XZ, Y-up), une carte 2D plate est posée dans le plan que la caméra
// regarde par défaut (X/Y, caméra le long de Z, comme coldi/r3f-game-demo) — aucune rotation de
// caméra. Ça évite le point singulier d'OrbitControls/MapControls (calcul sphérique autour de l'axe
// `up`) qu'une caméra plongeante orienterait droit dans cet axe ; Canvas3D lui-même limite déjà sa
// propre caméra orbitale à `maxPolarAngle={Math.PI/2}` pour ne jamais atteindre ce cas.
// « coordonnées serveur inchangées » (confirmé avec Saar) : world_x → local x, world_z → local y,
// mêmes valeurs numériques, aucune conversion — seul l'axe d'affichage (écran) change de nom.
function trivialRoomBounds(battlemap) {
  const room = battlemap?.surface_data?.rooms?.[TRIVIAL_ROOM_ID]
  const minX = Number(room?.minX ?? 0)
  const maxX = Number(room?.maxX ?? 9)
  const minZ = Number(room?.minZ ?? 0)
  const maxZ = Number(room?.maxZ ?? 9)
  return {
    widthCells: maxX - minX + 1,
    depthCells: maxZ - minZ + 1,
    centerX: minX + (maxX - minX + 1) / 2,
    centerY: minZ + (maxZ - minZ + 1) / 2, // world z, réutilisé tel quel comme axe vertical écran
  }
}

// Plan texturé recevant image_url — useTexture suspend le composant le temps du chargement (géré
// nativement par Canvas R3F), même patron que TokenGlbBody (Canvas3D.jsx) avec useGLTF. Géométrie non
// tournée : le plan par défaut est déjà dans XY, face à une caméra placée le long de Z.
function BattlemapImagePlane({ imageUrl, bounds }) {
  // Configuration au chargement (pas après coup) — react-hooks/immutability interdit de muter une
  // valeur retournée par un hook ; useTexture(url, onLoad) est le point de construction prévu pour ça.
  const texture = useTexture(imageUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.needsUpdate = true
  })

  return (
    <mesh position={[bounds.centerX, bounds.centerY, 0]}>
      <planeGeometry args={[bounds.widthCells, bounds.depthCells]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

// Cadrage caméra + persistance pan/zoom (docs/PLAN_BATTLEMAP2D.md §7 points 3 et 5) — un seul
// composant qui possède la référence MapControls, pour que le cadrage initial et la restauration de
// viewport_state règlent `camera.position` ET `controls.target` ensemble (sinon MapControls
// recalcule l'orientation vers son target par défaut (0,0,0) au premier update() et contredit le
// cadrage). useLayoutEffect (pas useEffect) pour éviter un flash de la caméra par défaut avant peinture.
function MapCameraRig({ battlemapId, bounds, initialViewport, controlsRef }) {
  const { camera, size } = useThree()
  const fitted = useRef(false)
  const saveTimeoutRef = useRef(null)
  const prevBoundsKeyRef = useRef(null)

  // "Paramètres" (docs/PLAN_BATTLEMAP2D.md §8) peut réuploader l'image sans démonter Canvas2D (même
  // battlemap.id → même clé React) : si la salle triviale change de taille, refaire le cadrage initial
  // plutôt que garder une vue obsolète. Déclaré avant l'effet de cadrage — même commit, ordre de
  // déclaration respecté par useLayoutEffect.
  useLayoutEffect(() => {
    const key = `${bounds.widthCells}:${bounds.depthCells}`
    if (prevBoundsKeyRef.current !== null && prevBoundsKeyRef.current !== key) {
      fitted.current = false
    }
    prevBoundsKeyRef.current = key
  }, [bounds.widthCells, bounds.depthCells])

  useLayoutEffect(() => {
    if (fitted.current || !controlsRef.current) return
    fitted.current = true

    const hasSavedViewport = Number.isFinite(Number(initialViewport?.zoom))
      && Number.isFinite(Number(initialViewport?.target?.x))
      && Number.isFinite(Number(initialViewport?.target?.y))

    const zoom = hasSavedViewport
      ? Number(initialViewport.zoom)
      : Math.min(size.width / bounds.widthCells, size.height / bounds.depthCells)
    const targetX = hasSavedViewport ? Number(initialViewport.target.x) : bounds.centerX
    const targetY = hasSavedViewport ? Number(initialViewport.target.y) : bounds.centerY

    // Contrôle caméra impératif — patron r3f standard (Canvas3D.jsx:488 fait de même sur une caméra
    // issue de useThree). react-hooks/immutability flague l'assignation directe, pas les méthodes
    // .set()/.update() juste en dessous — pas de forme non mutante possible pour `camera.zoom`.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = zoom
    camera.position.set(targetX, targetY, CAMERA_DISTANCE)
    camera.updateProjectionMatrix()
    controlsRef.current.target.set(targetX, targetY, 0)
    controlsRef.current.update()
  })

  useLayoutEffect(() => () => clearTimeout(saveTimeoutRef.current), [])

  const handleControlsEnd = useCallback(() => {
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      api.put(`/battlemaps/${battlemapId}`, {
        viewport_state: {
          zoom: camera.zoom,
          target: { x: camera.position.x, y: camera.position.y },
        },
      }).catch(err => console.error('Erreur sauvegarde vue carte 2D :', err))
    }, 800)
  }, [battlemapId, camera])

  return (
    <MapControls
      ref={controlsRef}
      enableRotate={false}
      // MapControls.screenSpacePanning vaut false par défaut (three.js) : le pan est projeté sur un
      // plan de normale camera.up (world Y), pensé pour une caméra élevée au-dessus d'un sol XZ. Notre
      // caméra regarde le long de Z, exactement dans ce plan — cas dégénéré. true = pan classique
      // selon les axes propres de la caméra, indépendant de toute hypothèse de plan de sol.
      screenSpacePanning
      onEnd={handleControlsEnd}
    />
  )
}

// Token 2D — portrait stylé (forme/bordure, docs/PLAN_BATTLEMAP2D.md §10, Lot 5) si le personnage a
// un `token_style`, sinon disque de couleur inchangé (comportement v1 précédent, zéro régression) +
// label/badges partagés (§8, extraction obligatoire depuis Canvas3D.jsx : présentation pure).
function Token2D({ token, isDragging, dragPos, onDragStart, statusEffectsMode }) {
  const { characters } = useCharacterStore()
  const character = characters.find(c => c.id === token.character_id)
  const color = token.user_color || token.color || '#4A90D9'
  const label = token.label || '?'
  const isGmLayer = token.layer === 'gm'
  const x = isDragging ? dragPos.x : Number(token.pos_x) || 0
  const y = isDragging ? dragPos.y : Number(token.pos_y) || 0
  const tokenStyle = character?.token_style
  const portraitUrl = character?.portrait_url
    ? `${import.meta.env.VITE_API_URL}/api/assets/${character.portrait_url}`
    : null

  return (
    <group
      position={[x, y, 0.05]}
      userData={{ isToken: true, tokenId: token.id }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onDragStart(e, token)
      }}
    >
      {tokenStyle ? (
        <TokenPortrait tokenStyle={tokenStyle} portraitUrl={portraitUrl} fallbackColor={color} radius={0.45} />
      ) : (
        <mesh>
          <circleGeometry args={[0.45, 32]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[0.45, 0.52, 32]} />
        <meshBasicMaterial color={isDragging ? '#ffffff' : '#000000'} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* offsetY réduits — le disque a un rayon de 0.45, pas la hauteur d'un modèle 3D (docs/PLAN_BATTLEMAP2D.md
          §8, correctif Saar : le label apparaissait à des cases de distance avec l'offset par défaut Canvas3D) */}
      <TokenLabel label={label} color={color} isGmLayer={isGmLayer} offsetY={0.72} />
      {isGmLayer && <TokenGmBadge offsetY={0.92} />}
      <TokenStatusBadges statuses={token.statuses} statusEffectsMode={statusEffectsMode} offsetY={0.55} />
    </group>
  )
}

// Rendu + mouvement des tokens (docs/PLAN_BATTLEMAP2D.md §8, Lot 3). Consomme directement les mêmes
// routes serveur que Canvas3D (teleport MJ / world-move joueur) — pas de hook partagé (décision
// inversée le 2026-07-28, cf. plan), pas de prévisualisation combat (hors périmètre v1). Lit
// tokens/characters/user directement depuis les stores, pas via des props relais (Canvas3D.jsx:527-528).
function TokenLayer({ battlemapId, statusEffectsMode, onTokenDoubleClick, controlsRef, onCharacterDrop }) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  // Plan de la carte — normale +Z, à l'origine locale (le plan texturé est toujours posé à z=0).
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  const { tokens, updateToken } = useTokenStore()
  const { characters, isGm } = useCharacterStore()
  const { user } = useAuthStore()

  const [dragState, setDragState] = useState(null) // { tokenId, x, y } | null
  const dragRef = useRef({
    active: false, tokenId: null, token: null, startX: 0, startY: 0, hasMoved: false, destination: null,
  })

  const raycastPlane = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    const hit = raycaster.ray.intersectPlane(dragPlane, target)
    return hit ? target : null
  }, [camera, gl, raycaster, dragPlane])

  // Garde de propriété — même contrat que Canvas3D.jsx:766-769 : un non-MJ ne peut démarrer un drag
  // que sur un token dont il possède le personnage, sinon aucune requête serveur n'est envoyée.
  const handleDragStart = useCallback((e, token) => {
    if (e.nativeEvent.button !== 0) return
    if (!isGm) {
      const character = characters.find(c => c.id === token.character_id)
      if (!character || character.user_id !== user?.id) return
    }
    dragRef.current = {
      active: true, tokenId: token.id, token,
      startX: e.clientX, startY: e.clientY, hasMoved: false, destination: null,
    }
    // MapControls écoute le canvas nativement (hors du système d'événements r3f) — stopPropagation()
    // seul ne l'empêche pas de paniquer sur le même pointerdown (même patron que Canvas3D.jsx:781).
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [isGm, characters, user, controlsRef])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerMove = (e) => {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (!dragRef.current.hasMoved) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
        dragRef.current.hasMoved = true
      }
      const hit = raycastPlane(e.clientX, e.clientY)
      if (!hit) return
      // world_x → local x, world_z → local y (convention Canvas2D, cf. en-tête de fichier).
      dragRef.current.destination = { x: hit.x, y: TRIVIAL_ROOM_FLOOR_Y, z: hit.y }
      setDragState({ tokenId: dragRef.current.tokenId, x: hit.x, y: hit.y })
    }

    const handlePointerUp = async (e) => {
      if (!dragRef.current.active) return
      const wasMoving = dragRef.current.hasMoved
      const token = dragRef.current.token

      if (controlsRef.current) controlsRef.current.enabled = true
      dragRef.current.active = false
      dragRef.current.hasMoved = false
      setDragState(null)

      if (!wasMoving) {
        onTokenDoubleClick?.(token, e.clientX, e.clientY)
        return
      }

      const destination = dragRef.current.destination
      if (!destination) return
      try {
        const res = isGm
          ? await api.post(`/tokens/${token.id}/teleport`, { destination })
          : await api.post(`/battlemaps/${battlemapId}/world-move`, {
              token_id: token.id,
              destination,
              gait: 'moyenne',
            })
        const updated = res.data?.token || res.data?.outcome?.token
        if (updated) updateToken(updated)
      } catch (err) {
        console.error('Erreur déplacement token (carte 2D) :', err)
      }
    }

    // Drop d'une carte personnage depuis la Sidebar — même conversion plan que le déplacement de
    // token ci-dessus (world_x → local x, world_z → local y, cf. en-tête de fichier).
    const handleDragOver = (e) => e.preventDefault()
    const handleDrop = (e) => {
      e.preventDefault()
      const characterId = e.dataTransfer.getData('characterId')
      if (!characterId) return
      const hit = raycastPlane(e.clientX, e.clientY)
      onCharacterDrop?.(characterId, hit ? { x: hit.x, y: TRIVIAL_ROOM_FLOOR_Y, z: hit.y } : null)
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)
    canvas.addEventListener('dragover', handleDragOver)
    canvas.addEventListener('drop', handleDrop)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
      canvas.removeEventListener('dragover', handleDragOver)
      canvas.removeEventListener('drop', handleDrop)
    }
  }, [gl, raycastPlane, isGm, battlemapId, onTokenDoubleClick, updateToken, controlsRef, onCharacterDrop])

  return (
    <>
      {tokens.map(token => (
        <Token2D
          key={token.id}
          token={token}
          isDragging={dragState?.tokenId === token.id}
          dragPos={dragState?.tokenId === token.id ? dragState : null}
          onDragStart={handleDragStart}
          statusEffectsMode={statusEffectsMode}
        />
      ))}
    </>
  )
}

export default function Canvas2D({ battlemap, onTokenDoubleClick, statusEffectsMode = 'enforced', onCharacterDrop }) {
  const { t } = useTranslation()
  const bounds = useMemo(() => trivialRoomBounds(battlemap), [battlemap])
  const controlsRef = useRef(null)

  // Lot 3 branche l'upload d'image — rien à afficher tant qu'aucune image n'existe sur la carte.
  if (!battlemap?.image_url) return null

  // battlemap.image_url est un chemin MinIO relatif (server/src/routes/battlemaps.js POST/PUT) — pas
  // une URL directement joignable depuis le navigateur (MINIO_ENDPOINT vaut souvent `localhost`, celui
  // du serveur, pas celui du joueur). Même reconstruction que defaultTokenGlbUrl (SessionPage.jsx).
  const imageUrl = `${import.meta.env.VITE_API_URL}/api/assets/${battlemap.image_url}`

  // Réglage d'offset (docs/PLAN_BATTLEMAP2D.md §8) — px → cases, même unité que bounds. Décale la
  // grille pour l'aligner sur l'image (quasi jamais pile au premier essai) ; l'image reste la
  // référence fixe, c'est la grille qui bouge — patron d'alignement standard (Roll20).
  const gridSize = battlemap.grid_size || 64
  const offsetXCells = (Number(battlemap.grid_offset_x) || 0) / gridSize
  const offsetYCells = (Number(battlemap.grid_offset_y) || 0) / gridSize

  return (
    <Canvas
      orthographic
      camera={{ position: [bounds.centerX, bounds.centerY, CAMERA_DISTANCE], near: 0.1, far: 1000 }}
      style={{ background: '#0f172a' }}
    >
      <MapCameraRig
        battlemapId={battlemap.id}
        bounds={bounds}
        initialViewport={battlemap.viewport_state}
        controlsRef={controlsRef}
      />

      {battlemap.grid_enabled && (
        <Grid
          args={[bounds.widthCells, bounds.depthCells]}
          position={[bounds.centerX + offsetXCells, bounds.centerY + offsetYCells, 0.01]}
          rotation={[-Math.PI / 2, 0, 0]}
          cellColor="#334155"
          sectionColor="#475569"
          fadeDistance={200}
        />
      )}

      <ImageErrorBoundary fallback={
        <Html center position={[bounds.centerX, bounds.centerY, 0]}>{t('battlemap.imageLoadError')}</Html>
      }>
        <Suspense fallback={null}>
          <BattlemapImagePlane imageUrl={imageUrl} bounds={bounds} />
        </Suspense>
      </ImageErrorBoundary>

      <TokenLayer
        battlemapId={battlemap.id}
        statusEffectsMode={statusEffectsMode}
        onTokenDoubleClick={onTokenDoubleClick}
        controlsRef={controlsRef}
        onCharacterDrop={onCharacterDrop}
      />
    </Canvas>
  )
}
