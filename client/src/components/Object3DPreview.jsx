import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Center, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { applyMaterialSlotOverrides, normalizeModelMaterialSlots } from '../lib/modelMaterialSlots.js'

function PreviewModel({ url, materialSlots, materialOverrides }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => {
    const nextScene = SkeletonUtils.clone(scene)
    nextScene.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const cloneMaterial = (material) => applyMaterialSlotOverrides(material.clone(), materialSlots, materialOverrides)
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneMaterial)
        : cloneMaterial(child.material)
    })
    return nextScene
  }, [scene, materialSlots, materialOverrides])
  return <primitive object={clone} />
}

export default function Object3DPreview({ blueprint, materialOverrides }) {
  const geometry = blueprint?.geometry
  const materialSlots = useMemo(() => normalizeModelMaterialSlots(geometry), [geometry])
  if (!blueprint?.glb_url) return null
  const url = `${import.meta.env.VITE_API_URL}/api/assets/${blueprint.glb_url}`

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 12, margin: '8px 0 10px', border: '1px solid #3a4c70', borderRadius: '6px', overflow: 'hidden', background: '#090c12', boxShadow: '0 8px 20px rgba(0,0,0,0.55)' }}>
      <div style={{ height: '190px', position: 'relative' }}>
        <Canvas
          frameloop="demand"
          dpr={1}
          camera={{ position: [3, 2.2, 3], fov: 42, near: 0.01, far: 200 }}
          gl={{ antialias: false, powerPreference: 'low-power' }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#090c12']} />
          <ambientLight intensity={1.35} />
          <directionalLight position={[4, 7, 5]} intensity={2.2} />
          <directionalLight position={[-4, 2, -3]} intensity={0.8} />
          <Suspense fallback={<Html center style={{ color: '#7f8eaa', fontSize: '11px', whiteSpace: 'nowrap' }}>Chargement du modèle…</Html>}>
            <Bounds fit clip margin={1.2} observe>
              <Center bottom>
                <PreviewModel url={url} materialSlots={materialSlots} materialOverrides={materialOverrides} />
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.12} />
        </Canvas>
      </div>
      <div style={{ padding: '7px 9px', borderTop: '1px solid #202036' }}>
        <div style={{ color: '#d7d7e5', fontSize: '12px', fontWeight: 600 }}>{blueprint.label}</div>
        <div style={{ color: '#69758b', fontSize: '10px', marginTop: '2px' }}>
          {geometry.width ?? 1} × {geometry.depth ?? 1} × {geometry.height ?? 1} m
        </div>
      </div>
    </div>
  )
}
