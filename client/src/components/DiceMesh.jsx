import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  DIE_GEOMETRY,
  GLB_PATHS,
  getFinalRotation,
  getFaceNormal,
  D4_FACE_VALUES,
  D4_FACE_NORMALS_LIST,
  D8_FACE_VALUES,
  D8_FACE_NORMALS_LIST,
  D20_FACE_VALUES,
  D12_FACE_VALUES,
  D12_FACE_NORMALS_LIST,
  D10_KITE_NORMALS,
  D10_KITE_VALUES,
  D10_FACE_VALUES,
  D10_UNITS_FACE_VALUES,
  D10_TENS_FACE_VALUES,
  makeNoiseFunc,
  getAnimDuration,
  PHASES,
  easeOut,
  easeInOut,
} from '../lib/diceMath.js'

// ─── makeDigitTexture ────────────────────────────────────────────────────────
// Crée une CanvasTexture 128×128 avec le chiffre centré.
// Fond bleu foncé (#1e3a5f), chiffre blanc, police bold sans-serif.
// Utilisé par le D6 (une texture par face).
function makeDigitTexture(value, color = '#1e3a5f', fontSize = 0.45) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Fond — couleur du lanceur
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  // Bordure subtile
  ctx.strokeStyle = 'rgba(100,160,255,0.3)'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, size - 4, size - 4)

  // Chiffre
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(value), size / 2, size / 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

// Mapping D6 — materialIndex → valeur de face
// Vérifié par inspection Node.js : BoxGeometry groups materialIndex = 0-5 séquentiels.
// Normales vérifiées : group0=(+X)=5, group1=(-X)=2, group2=(+Y)=1, group3=(-Y)=6, group4=(+Z)=3, group5=(-Z)=4
// Convention dé physique : faces opposées = 7.
const D6_MATERIAL_VALUES = [5, 2, 1, 6, 3, 4]

// ─── D10 — Pentagonal Trapezohedron ──────────────────────────────────────────
// Forme correcte d'un vrai D10 (kites, pas triangles).
// Source : Anton Natarov (domaine public) / Andrew Aquino.
// 12 vertices : 2 pôles + 10 équatoriaux alternés haut/bas.
// 20 triangles (2 par kite) via PolyhedronGeometry.
// Normales et ordre des faces vérifiés via Node.js (0 normales inverses).
function createD10Geometry(radius = 0.85) {
  const PI2 = Math.PI * 2
  const PI5 = Math.PI / 5
  const h_eq = 0.105  // hauteur équatoriale (normalisée sur rayon=1)

  // 12 vertices normalisés (PolyhedronGeometry applique le radius)
  const verts = [
    0, 1, 0,   // v0 — pôle nord
    0, -1, 0,  // v1 — pôle sud
  ]
  for (let k = 0; k < 5; k++) {
    // Couche haute (v2,v4,v6,v8,v10)
    verts.push(Math.cos((PI2/5)*k), h_eq, Math.sin((PI2/5)*k))
    // Couche basse (v3,v5,v7,v9,v11) — décalée de π/5
    verts.push(Math.cos((PI2/5)*k + PI5), -h_eq, Math.sin((PI2/5)*k + PI5))
  }

  // 20 triangles — 10 kites × 2 triangles
  // Ordre Test B (vérifié : 0 normales inverses)
  // Kite i (nord) : [0,b,h] + [0,hn,b]
  // Kite i (sud)  : [1,b,hn] + [1,hn,bn]
  // Ordre entrelacé : kite_nord[0], kite_sud[0], kite_nord[1], kite_sud[1]...
  const faces = []
  for (let i = 0; i < 5; i++) {
    const h  = 2 + i * 2
    const b  = 3 + i * 2
    const hn = 2 + ((i + 1) % 5) * 2
    const bn = 3 + ((i + 1) % 5) * 2
    faces.push(0, b, h,  0, hn, b)   // kite nord i
    faces.push(1, b, hn, 1, hn, bn)  // kite sud  i
  }

  const geo = new THREE.PolyhedronGeometry(verts, faces, radius, 0)
  return geo
}

// ─── DiceMeshGlb — rendu via modèle .glb (géométrie + matériau baked) ────────
// Même logique d'animation que DiceMesh procédural.
// Scale 104 : le D6.glb mesure ~0.0106 unités glTF, BoxGeometry actuel = 1.1 unités.
function DiceMeshGlb({ glbPath, dieType, faceValue, seed, laneX }) {
  const { camera } = useThree()
  const groupRef = useRef()
  const meshRef  = useRef()
  const elapsed  = useRef(0)
  const done     = useRef(false)

  const { nodes } = useGLTF(glbPath)

  const { geometry, material } = useMemo(() => {
    const meshNode = Object.values(nodes).find(n => n.isMesh)
    return {
      geometry: meshNode?.geometry ?? new THREE.BoxGeometry(1, 1, 1),
      material: meshNode?.material ?? new THREE.MeshStandardMaterial(),
    }
  }, [nodes])

  const faceNormal = useMemo(() => getFaceNormal(dieType, faceValue), [dieType, faceValue])
  const startQ     = useMemo(() => {
    const r = getFinalRotation(seed ^ 0xDEAD)
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rx, r.ry, r.rz))
  }, [seed])
  const noise    = useMemo(() => makeNoiseFunc(seed),   [seed])
  const duration = useMemo(() => getAnimDuration(seed), [seed])

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current || done.current) return
    elapsed.current += delta
    const t = Math.min(elapsed.current / duration, 1)

    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const camPos = camera.position.clone()
    const up    = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(camDir, up).normalize()

    const basePos = camPos.clone()
      .add(camDir.clone().multiplyScalar(6))
      .add(right.clone().multiplyScalar(laneX))
      .add(up.clone().multiplyScalar(0.5))

    let posY = basePos.y
    if (t < PHASES.BOUNCE_END) {
      posY += Math.sin((t / PHASES.BOUNCE_END) * Math.PI) * 2.0
    } else if (t < PHASES.ALIGN_END) {
      const tp = (t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END)
      posY += Math.sin(tp * Math.PI) * 0.4
    } else {
      const tp = (t - PHASES.ALIGN_END) / (1 - PHASES.ALIGN_END)
      posY += Math.sin(tp * Math.PI * 4) * 0.06 * (1 - tp)
    }
    groupRef.current.position.set(basePos.x, posY, basePos.z)

    let targetQ
    if (faceNormal) {
      const fn = new THREE.Vector3(...faceNormal)
      targetQ = new THREE.Quaternion().setFromUnitVectors(fn, camDir.clone().negate())
    } else {
      const r = getFinalRotation(seed)
      targetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rx, r.ry, r.rz))
    }

    const noiseInfluence = t < PHASES.BOUNCE_END
      ? 1.0
      : t < PHASES.ALIGN_END
        ? 1.0 - easeOut((t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END))
        : 0.0

    const alignT = t < PHASES.BOUNCE_END ? 0 : easeInOut(
      Math.min((t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END), 1)
    )

    const q = new THREE.Quaternion()
    q.slerpQuaternions(startQ, targetQ, alignT)

    const n = noise(elapsed.current * 6)
    const noiseQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(n.dx * noiseInfluence, n.dy * noiseInfluence, n.dz * noiseInfluence)
    )
    meshRef.current.quaternion.copy(q.multiply(noiseQ))

    if (t >= 1) {
      groupRef.current.position.set(basePos.x, basePos.y, basePos.z)
      meshRef.current.quaternion.copy(targetQ)
      done.current = true
    }
  })

  return (
    <group ref={groupRef} scale={104}>
      <mesh ref={meshRef} geometry={geometry} material={material} castShadow />
    </group>
  )
}

useGLTF.preload('/models/D4.glb')
useGLTF.preload('/models/D6.glb')
useGLTF.preload('/models/D8.glb')
useGLTF.preload('/models/D10.glb')
useGLTF.preload('/models/D100.glb')
useGLTF.preload('/models/D12.glb')
useGLTF.preload('/models/D20.glb')

// ─── DiceMeshProcedural — géométrie procédurale + CanvasTexture ──────────────
function DiceMeshProcedural({ dieType, faceValue, seed, laneX, color = '#1e3a5f' }) {
  const { camera } = useThree()
  const groupRef = useRef()
  const meshRef  = useRef()
  const elapsed  = useRef(0)
  const done     = useRef(false)

  const geoDef = DIE_GEOMETRY[dieType] ?? DIE_GEOMETRY['d6']

  const geometry = useMemo(() => {
    let geo
    switch (geoDef.type) {
      case 'tetrahedron':
        geo = new THREE.TetrahedronGeometry(0.75, 0)
        // Ajouter 4 groupes — un par face (3 vertices chacune, géométrie non-indexée)
        // Permet d'appliquer un material array avec texture par face.
        for (let i = 0; i < 4; i++) geo.addGroup(i * 3, 3, i)
        // Remplacer les UVs par défaut (projection sphérique, centroïde décalé)
        // par un triangle équilatéral centré sur (0.5, 0.5) dans la texture.
        // UV0=sommet haut, UV1=bas gauche, UV2=bas droit — centroïde ≈ (0.5, 0.49)
        {
          const uvs = new Float32Array(4 * 3 * 2) // 4 faces × 3 vertices × 2 composantes
          for (let f = 0; f < 4; f++) {
            const base = f * 6
            uvs[base + 0] = 0.5;  uvs[base + 1] = 0.90  // vertex 0 — sommet haut
            uvs[base + 2] = 0.10; uvs[base + 3] = 0.27  // vertex 1 — bas gauche
            uvs[base + 4] = 0.90; uvs[base + 5] = 0.27  // vertex 2 — bas droit
          }
          geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        }
        break
      case 'box':
        geo = new THREE.BoxGeometry(1.1, 1.1, 1.1)
        break
      case 'octahedron':
        geo = new THREE.OctahedronGeometry(0.82, 0)
        for (let i = 0; i < 8; i++) geo.addGroup(i * 3, 3, i)
        {
          const uvs = new Float32Array(8 * 3 * 2)
          for (let f = 0; f < 8; f++) {
            const base = f * 6
            uvs[base + 0] = 0.5;  uvs[base + 1] = 0.90
            uvs[base + 2] = 0.10; uvs[base + 3] = 0.27
            uvs[base + 4] = 0.90; uvs[base + 5] = 0.27
          }
          geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        }
        break
      case 'pentagonal_bipyramid':
        // D10 V1 — géométrie correcte (pentagonal trapezohedron).
        // Texturing UV reporté en V2 (nécessite Blender ou outil 3D).
        // Chiffre affiché via overlay Html.
        geo = createD10Geometry(0.85)
        break
      case 'dodecahedron':
        geo = new THREE.DodecahedronGeometry(0.78, 0)
        geo.rotateX(Math.PI / 5)
        // UVs pentagonaux corrects pré-calculés avec décalage atlas.
        // 5 sommets pentagonaux à 72°×i, rayon 0.5, centré en (0,0) → décalé dans atlas.
        // Pour pentagone p : uv.x_final = (baseUV.x + p) / 12
        // Ordre vertices vérifié Node.js : pivot→[0], u0→[1], u1→[2], u3→[3], u4→[4]
        // Triangle 0 : [1,2,0] | Triangle 1 : [2,3,0] | Triangle 2 : [3,4,0]
        // Pas de shader custom, pas d'attribut sides — UVs finaux dès la construction.
        {
          const baseV = new THREE.Vector2(0, 0.5)
          const center2 = new THREE.Vector2()
          const stepAngle = THREE.MathUtils.degToRad(72)
          const nFaces = 12
          // 5 UVs de base dans [0,1]² (sans décalage atlas)
          const bUV = [0,1,2,3,4].map(i =>
            baseV.clone().rotateAround(center2, stepAngle * i).addScalar(0.5)
          )
          const uvData = []
          for (let p = 0; p < nFaces; p++) {
            // Décalage atlas : (x + p) / nFaces
            const shift = v => ({ x: (v.x + p) / nFaces, y: v.y })
            const s = [0,1,2,3,4].map(i => shift(bUV[i]))
            // Triangle 0 : [1,2,0]
            uvData.push(s[1].x, s[1].y, s[2].x, s[2].y, s[0].x, s[0].y)
            // Triangle 1 : [2,3,0]
            uvData.push(s[2].x, s[2].y, s[3].x, s[3].y, s[0].x, s[0].y)
            // Triangle 2 : [3,4,0]
            uvData.push(s[3].x, s[3].y, s[4].x, s[4].y, s[0].x, s[0].y)
          }
          geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvData), 2))
        }
        break
      case 'icosahedron':
        geo = new THREE.IcosahedronGeometry(0.82, 0)
        for (let i = 0; i < 20; i++) geo.addGroup(i * 3, 3, i)
        {
          const uvs = new Float32Array(20 * 3 * 2)
          for (let f = 0; f < 20; f++) {
            const base = f * 6
            uvs[base + 0] = 0.5;  uvs[base + 1] = 0.90
            uvs[base + 2] = 0.10; uvs[base + 3] = 0.27
            uvs[base + 4] = 0.90; uvs[base + 5] = 0.27
          }
          geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        }
        break
      default:
        geo = new THREE.BoxGeometry(1.1, 1.1, 1.1)
    }
    return geo
  }, [geoDef.type])

  // Matériau — D6 : array de 6 MeshStandardMaterial avec CanvasTexture par face.
  // Autres dés : matériau unique (chiffre en overlay Html — jusqu'à implémentation V2).
  // flatShading: true — obligatoire pour des arêtes visibles.
  const material = useMemo(() => {
    const base = {
      roughness: 0.85,
      metalness: 0.0,
      emissive: '#1a3a6a',
      emissiveIntensity: 0.45,
      flatShading: true,
    }
    if (geoDef.type === 'box') {
      // D6 — 6 matériaux, un par face, avec chiffre gravé
      return D6_MATERIAL_VALUES.map(v => new THREE.MeshStandardMaterial({
        ...base,
        map: makeDigitTexture(v, color, 0.5),
      }))
    }
    if (geoDef.type === 'tetrahedron') {
      // D4 — 4 matériaux, un par face, avec chiffre gravé
      return D4_FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
        ...base,
        map: makeDigitTexture(v, color, 0.4),
      }))
    }
    if (geoDef.type === 'octahedron') {
      // D8 — 8 matériaux, un par face, avec chiffre gravé
      return D8_FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
        ...base,
        map: makeDigitTexture(v, color, 0.4),
      }))
    }
    if (geoDef.type === 'icosahedron') {
      // D20 — 20 matériaux, un par face, avec chiffre gravé
      return D20_FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
        ...base,
        map: makeDigitTexture(v, color, 0.3),
      }))
    }
    if (geoDef.type === 'pentagonal_bipyramid') {
      // D10 V1 — matériau couleur unie. Chiffre via overlay Html.
      // V2 : texturing UV par face via modèle Blender (.glb avec UVs pré-calculés).
      return new THREE.MeshStandardMaterial({ ...base, color })
    }
    if (geoDef.type === 'dodecahedron') {
      // D12 — atlas horizontal 128×12 cases. UVs pré-décalés dans la géométrie.
      // Pas de shader custom — décalage (x+p)/12 calculé au build-time.
      const atlasSize = 128
      const nFaces = 12
      const canvas = document.createElement('canvas')
      canvas.width  = atlasSize * nFaces
      canvas.height = atlasSize
      const ctx = canvas.getContext('2d')
      D12_FACE_VALUES.forEach((v, i) => {
        // Fond couleur lanceur
        ctx.fillStyle = color
        ctx.fillRect(i * atlasSize, 0, atlasSize, atlasSize)
        // Bordure subtile
        ctx.strokeStyle = 'rgba(150,200,255,0.6)'
        ctx.lineWidth = 8
        ctx.strokeRect(i * atlasSize + 4, 4, atlasSize - 8, atlasSize - 8)
        // Chiffre
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${atlasSize * 0.4}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(v), i * atlasSize + atlasSize / 2, atlasSize / 2)
      })
      const atlas = new THREE.CanvasTexture(canvas)
      // Pas de onBeforeCompile — le décalage atlas est pré-calculé dans les UVs de la géométrie.
      return new THREE.MeshStandardMaterial({
        ...base,
        map: atlas,
      })
    }
    // Autres dés — matériau unique, chiffre en overlay Html
    return new THREE.MeshStandardMaterial({
      ...base,
      color,
    })
  }, [geoDef.type, color, dieType])

  // Quaternion cible — face faceValue orientée vers la caméra.
  // getFaceNormal retourne null si le dé n'est pas encore mappé → fallback Euler.
  const faceNormal = useMemo(() => getFaceNormal(dieType, faceValue), [dieType, faceValue])

  // Quaternion de départ pseudo-aléatoire (seed XOR constant → différent de la cible)
  const startQ = useMemo(() => {
    const r = getFinalRotation(seed ^ 0xDEAD)
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rx, r.ry, r.rz))
  }, [seed])

  const noise    = useMemo(() => makeNoiseFunc(seed),   [seed])
  const duration = useMemo(() => getAnimDuration(seed), [seed])

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return
    if (done.current) return

    elapsed.current += delta
    const t = Math.min(elapsed.current / duration, 1)

    // ── Position devant la caméra ────────────────────────────────────────────
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const camPos = camera.position.clone()
    const up    = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(camDir, up).normalize()

    const basePos = camPos.clone()
      .add(camDir.clone().multiplyScalar(6))
      .add(right.clone().multiplyScalar(laneX))
      .add(up.clone().multiplyScalar(0.5))

    // ── Trajectoire Y — bounce (0→BOUNCE_END) ────────────────────────────────
    let posY = basePos.y
    if (t < PHASES.BOUNCE_END) {
      const tp = t / PHASES.BOUNCE_END
      // Arc parabolique principal
      posY += Math.sin(tp * Math.PI) * 2.0
    } else if (t < PHASES.ALIGN_END) {
      const tp = (t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END)
      // Petit rebond secondaire décroissant
      posY += Math.sin(tp * Math.PI) * 0.4
    } else {
      // Micro-wobble final avant immobilisation
      const tp = (t - PHASES.ALIGN_END) / (1 - PHASES.ALIGN_END)
      posY += Math.sin(tp * Math.PI * 4) * 0.06 * (1 - tp)
    }

    groupRef.current.position.set(basePos.x, posY, basePos.z)

    // ── Rotation ─────────────────────────────────────────────────────────────
    // Calcul du quaternion cible : face faceValue orientée vers la caméra.
    // Si faceNormal est null (dé non encore mappé) → fallback Euler pseudo-aléatoire.
    // camDir déjà calculé ci-dessus pour la position — réutilisé ici.
    let targetQ
    if (dieType === 'd4') {
      // D4 — orienter la face portant faceValue VERS la caméra.
      const faceIdx = D4_FACE_VALUES.indexOf(faceValue)
      const fn = faceIdx >= 0
        ? new THREE.Vector3(...D4_FACE_NORMALS_LIST[faceIdx])
        : new THREE.Vector3(0, 1, 0)
      targetQ = new THREE.Quaternion().setFromUnitVectors(fn, camDir.clone().negate())
    } else if (dieType === 'd8') {
      // D8 — même pattern que D4
      const faceIdx = D8_FACE_VALUES.indexOf(faceValue)
      const fn = faceIdx >= 0
        ? new THREE.Vector3(...D8_FACE_NORMALS_LIST[faceIdx])
        : new THREE.Vector3(0, 1, 0)
      targetQ = new THREE.Quaternion().setFromUnitVectors(fn, camDir.clone().negate())
    } else if (dieType === 'd12') {
      // D12 — même pattern
      const faceIdx = D12_FACE_VALUES.indexOf(faceValue)
      const fn = faceIdx >= 0
        ? new THREE.Vector3(...D12_FACE_NORMALS_LIST[faceIdx])
        : new THREE.Vector3(0, 1, 0)
      targetQ = new THREE.Quaternion().setFromUnitVectors(fn, camDir.clone().negate())
    } else if (dieType === 'd10' || dieType === 'd10_units' || dieType === 'd10_tens') {
      // D10 — trouver le kite portant faceValue et orienter sa normale vers la caméra
      const faceValues = dieType === 'd10_tens'  ? D10_TENS_FACE_VALUES
                       : dieType === 'd10_units' ? D10_UNITS_FACE_VALUES
                       : D10_FACE_VALUES
      const kiteIdx = faceValues.indexOf(faceValue)
      const fn = kiteIdx >= 0
        ? new THREE.Vector3(...D10_KITE_NORMALS[kiteIdx])
        : new THREE.Vector3(0, 1, 0)
      targetQ = new THREE.Quaternion().setFromUnitVectors(fn, camDir.clone().negate())
    } else if (faceNormal) {
      const fn = new THREE.Vector3(...faceNormal)
      targetQ = new THREE.Quaternion().setFromUnitVectors(fn, camDir.clone().negate())
    } else {
      // Fallback — dé non mappé
      const r = getFinalRotation(seed)
      targetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rx, r.ry, r.rz))
    }

    const noiseInfluence = t < PHASES.BOUNCE_END
      ? 1.0
      : t < PHASES.ALIGN_END
        ? 1.0 - easeOut((t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END))
        : 0.0

    const alignT = t < PHASES.BOUNCE_END ? 0 : easeInOut(
      Math.min((t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END), 1)
    )

    // SLERP quaternion — interpolation sphérique, sans gimbal lock
    const q = new THREE.Quaternion()
    q.slerpQuaternions(startQ, targetQ, alignT)

    // Bruit chaotique — perturbations angulaires s'estompant avec le temps
    const n = noise(elapsed.current * 6)
    const noiseQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        n.dx * noiseInfluence,
        n.dy * noiseInfluence,
        n.dz * noiseInfluence,
      )
    )
    meshRef.current.quaternion.copy(q.multiply(noiseQ))

    if (t >= 1) {
      groupRef.current.position.set(basePos.x, basePos.y, basePos.z)
      meshRef.current.quaternion.copy(targetQ)
      done.current = true
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} material={material} castShadow />

      {/* Overlay Html — uniquement pour les dés sans texture sur face (non-D6 pour l'instant) */}
      {geoDef.type !== 'box' && geoDef.type !== 'tetrahedron' && geoDef.type !== 'octahedron' && geoDef.type !== 'icosahedron' && geoDef.type !== 'dodecahedron' && (
        <Html
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          position={[0, 0, 0]}
        >
          <div style={{
            fontFamily: 'monospace',
            fontSize: '30px',
            fontWeight: '700',
            color: '#ffffff',
            textShadow: '0 0 10px #000, 0 2px 6px rgba(0,0,0,0.95)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            minWidth: '44px',
            textAlign: 'center',
          }}>
            {faceValue}
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: 'rgba(180,200,255,0.85)',
            textAlign: 'center',
            marginTop: '3px',
            textShadow: '0 1px 4px rgba(0,0,0,0.95)',
          }}>
            {geoDef.label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── DiceMesh — routeur : GLB si dispo, procédural sinon ─────────────────────
export default function DiceMesh(props) {
  const glbPath = GLB_PATHS[props.dieType]
  return glbPath
    ? <DiceMeshGlb {...props} glbPath={glbPath} />
    : <DiceMeshProcedural {...props} />
}
