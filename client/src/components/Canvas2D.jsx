import { Suspense, useLayoutEffect, useMemo, useRef, useCallback, Component } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapControls, Grid, useTexture, Html } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import api from '../lib/api.js'

// docs/PLAN_BATTLEMAP2D.md §6 (Lot 1) — clé de la salle triviale synthétisée par le serveur à la
// création d'une carte 2D (server/src/routes/battlemaps.js, POST /).
const TRIVIAL_ROOM_ID = 'main'
const CAMERA_DISTANCE = 50

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

class Canvas2DImageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
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
function MapCameraRig({ battlemapId, bounds, initialViewport }) {
  const { camera, size } = useThree()
  const controlsRef = useRef(null)
  const fitted = useRef(false)
  const saveTimeoutRef = useRef(null)

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

export default function Canvas2D({ battlemap }) {
  const { t } = useTranslation()
  const bounds = useMemo(() => trivialRoomBounds(battlemap), [battlemap])

  // Lot 3 branche l'upload d'image — rien à afficher tant qu'aucune image n'existe sur la carte.
  if (!battlemap?.image_url) return null

  // battlemap.image_url est un chemin MinIO relatif (server/src/routes/battlemaps.js POST/PUT) — pas
  // une URL directement joignable depuis le navigateur (MINIO_ENDPOINT vaut souvent `localhost`, celui
  // du serveur, pas celui du joueur). Même reconstruction que defaultTokenGlbUrl (SessionPage.jsx).
  const imageUrl = `${import.meta.env.VITE_API_URL}/api/assets/${battlemap.image_url}`

  return (
    <Canvas
      orthographic
      camera={{ position: [bounds.centerX, bounds.centerY, CAMERA_DISTANCE], near: 0.1, far: 1000 }}
      style={{ background: '#0f172a' }}
    >
      <MapCameraRig battlemapId={battlemap.id} bounds={bounds} initialViewport={battlemap.viewport_state} />

      {battlemap.grid_enabled && (
        <Grid
          args={[bounds.widthCells, bounds.depthCells]}
          position={[bounds.centerX, bounds.centerY, 0.01]}
          rotation={[-Math.PI / 2, 0, 0]}
          cellColor="#334155"
          sectionColor="#475569"
          fadeDistance={200}
        />
      )}

      <Canvas2DImageErrorBoundary fallback={
        <Html center position={[bounds.centerX, bounds.centerY, 0]}>{t('battlemap.imageLoadError')}</Html>
      }>
        <Suspense fallback={null}>
          <BattlemapImagePlane imageUrl={imageUrl} bounds={bounds} />
        </Suspense>
      </Canvas2DImageErrorBoundary>
    </Canvas>
  )
}
