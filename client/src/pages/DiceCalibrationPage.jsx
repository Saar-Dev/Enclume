import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import DiceCalibrationProbe from '../components/dev/DiceCalibrationProbe.jsx'
import { computeFaceClusters } from '../lib/devFaceClusters.js'
import { getClosestFaceValue } from '../lib/diceMath.js'

// ─── DiceCalibrationPage ──────────────────────────────────────────────────────
// Outil dev — vérification/calibration des normales de face, tous les dés.
// Les clusters de normales sont recalculés à la volée (k-means, même méthode que
// tools/inspect-glb.js) depuis la géométrie réellement chargée — aucun vecteur
// transcrit à la main, donc valable pour n'importe quel dé sans risque de coquille.
// `dieType` = clé réelle dans diceMath.js (FACE_NORMALS) — sert uniquement à afficher
// "le code actuel prévoit : X" à titre de comparaison, jamais utilisé pour la pose.
const DICE_CONFIGS = {
  d4:   { file: '/models/D4.glb',   k: 4,  dieType: 'd4'       },
  d6:   { file: '/models/D6.glb',   k: 6,  dieType: 'd6'       },
  d8:   { file: '/models/D8.glb',   k: 8,  dieType: 'd8'       },
  d10:  { file: '/models/D10.glb',  k: 10, dieType: 'd10'      },
  d100: { file: '/models/D100.glb', k: 10, dieType: 'd10_tens' },
  d12:  { file: '/models/D12.glb',  k: 12, dieType: 'd12'      },
  d20:  { file: '/models/D20.glb',  k: 20, dieType: 'd20'      },
}

Object.values(DICE_CONFIGS).forEach(({ file }) => useGLTF.preload(file))

function useDiceClusters(glbPath, k) {
  const { nodes } = useGLTF(glbPath)
  return useMemo(() => {
    const meshNode = Object.values(nodes).find(n => n.isMesh)
    return meshNode ? computeFaceClusters(meshNode.geometry, k) : []
  }, [nodes, k])
}

function CameraLookAtOrigin() {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(0, 0, 0) }, [camera])
  return null
}

const CLOCK_STEP = 15

function DiceCalibrationInner() {
  const [dieKey, setDieKey] = useState('d10')
  const [index, setIndex] = useState(0)
  const [clockDeg, setClockDeg] = useState(0)

  const { file, k, dieType } = DICE_CONFIGS[dieKey]
  const clusters = useDiceClusters(file, k)
  const current = clusters[index]
  const expected = current ? getClosestFaceValue(dieType, current.normal) : null

  const selectDie = (key) => { setDieKey(key); setIndex(0); setClockDeg(0) }
  const prev = () => setIndex(i => (i - 1 + clusters.length) % clusters.length)
  const next = () => setIndex(i => (i + 1) % clusters.length)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0d14', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        fontFamily: 'monospace', color: '#dde7ee', display: 'flex',
        flexDirection: 'column', gap: 8,
      }}>
        <div>Calibration / vérification dés (outil dev)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.keys(DICE_CONFIGS).map(key => (
            <button key={key} onClick={() => selectDie(key)} disabled={dieKey === key}>
              {key.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={prev} disabled={!clusters.length}>◀</button>
          <strong style={{ fontSize: 20 }}>N{index + 1}/{clusters.length || '?'}</strong>
          <button onClick={next} disabled={!clusters.length}>▶</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>Rotation (même face) :</span>
          <button onClick={() => setClockDeg(a => a - CLOCK_STEP)}>↺ -{CLOCK_STEP}°</button>
          <strong>{clockDeg}°</strong>
          <button onClick={() => setClockDeg(a => a + CLOCK_STEP)}>↻ +{CLOCK_STEP}°</button>
          <button onClick={() => setClockDeg(0)}>reset</button>
        </div>
        <div>Fichier : {file}{current ? ` — ${current.triCount} triangles sur ce cluster` : ''}</div>
        {expected !== null && (
          <div style={{ color: '#e8c870' }}>Le code actuel prévoit : <strong>{expected}</strong></div>
        )}
      </div>

      <Canvas camera={{ position: [15, 15, 15], fov: 60 }}>
        <CameraLookAtOrigin />
        <ambientLight intensity={0.8} />
        <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        <directionalLight position={[-10, 10, -10]} intensity={0.6} />
        {current && <DiceCalibrationProbe glbPath={file} normal={current.normal} clockDeg={clockDeg} />}
      </Canvas>
    </div>
  )
}

export default function DiceCalibrationPage() {
  return (
    <Suspense fallback={<div style={{ color: '#dde7ee', padding: 20, fontFamily: 'monospace' }}>Chargement…</div>}>
      <DiceCalibrationInner />
    </Suspense>
  )
}
