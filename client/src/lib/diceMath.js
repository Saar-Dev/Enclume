// ─── diceMath.js ─────────────────────────────────────────────────────────────
// Fonctions pures pour l'animation des dés — zéro import React, zéro accès DB.
// Utilisé par DiceMesh.jsx et DiceRoller.jsx.
//
// Principe backtracking (spec Dice_rework.md §1) :
// Le résultat est connu à l'avance (fourni par le serveur).
// L'animation est une mise en scène du résultat — pas un calcul aléatoire.
// Le PRNG est initialisé avec le seed serveur → déterministe et reproductible.

// ─── PRNG — Linear Congruential Generator ────────────────────────────────────
// Paramètres Numerical Recipes — period 2^32, distribution uniforme.
// seed → [0, 1[ à chaque appel de next().
export function createLCG(seed) {
  let state = (seed || Date.now()) >>> 0
  return {
    next() {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0
      return state / 0xFFFFFFFF
    },
  }
}

// ─── Géométries supportées ────────────────────────────────────────────────────
// Mapping dieType → type de géométrie.
// 'pentagonal_bipyramid' = géométrie custom dans DiceMesh.jsx (vrai D10).
// V2 : ajouter rotationForFace (quaternion exact par valeur de face).
export const DIE_GEOMETRY = {
  d4:        { type: 'tetrahedron',          label: 'D4'      },
  d6:        { type: 'box',                  label: 'D6'      },
  d8:        { type: 'octahedron',           label: 'D8'      },
  d10:       { type: 'pentagonal_bipyramid', label: 'D10'     },
  d12:       { type: 'dodecahedron',         label: 'D12'     },
  d20:       { type: 'icosahedron',          label: 'D20'     },
  d10_tens:  { type: 'pentagonal_bipyramid', label: 'D10 ×10' },
  d10_units: { type: 'pentagonal_bipyramid', label: 'D10'     },
}
// ─── Normales par face — vérifiées par inspection Three.js (Node.js) ─────────
// Retourne le vecteur normal [nx, ny, nz] de la face à orienter vers la caméra.
// Source : BoxGeometry groups inspectés via geo.attributes.normal.
// Convention dé physique D6 : faces opposées = 7.
const D6_FACE_NORMALS = {
  1: [ 0,  1,  0],  // group 2 — top +Y
  2: [-1,  0,  0],  // group 1 — west -X
  3: [ 0,  0,  1],  // group 4 — south +Z
  4: [ 0,  0, -1],  // group 5 — north -Z
  5: [ 1,  0,  0],  // group 0 — east +X
  6: [ 0, -1,  0],  // group 3 — bottom -Y
}

// Registre des normales — étendu au fur et à mesure des dés implémentés.
// Retourne null si le dé n'est pas encore mappé → fallback getFinalRotation.
// D4 — TetrahedronGeometry, 4 faces non-indexées
// Normales vérifiées par inspection Node.js.
// Tri ny desc puis nx desc pour départager les faces au même ny.
// Convention D4 : face orientée DOS à la caméra → face opposée visible (valeur basse en bas).
// faces triées : f0(ny=+0.577,nx=-0.577)→4, f1(ny=+0.577,nx=+0.577)→3,
//                f2(ny=-0.577,nx=+0.577)→2, f3(ny=-0.577,nx=-0.577)→1
// Tableau [f0,f1,f2,f3] = valeur par face
const D4_FACE_VALUES = [4, 3, 2, 1]
// Normales par index de face (vérifiées stables entre instances)
const D4_FACE_NORMALS_LIST = [
  [-0.5774, 0.5774, 0.5774],  // face 0 → valeur 4
  [ 0.5774, 0.5774,-0.5774],  // face 1 → valeur 3
  [ 0.5774,-0.5774, 0.5774],  // face 2 → valeur 2
  [-0.5774,-0.5774,-0.5774],  // face 3 → valeur 1
]

const FACE_NORMALS = {
  d6: D6_FACE_NORMALS,
  // d20, d8, d12, d10 — à ajouter session par session
}

// D10 — pentagonal trapezohedron (forme correcte d'un vrai D10)
// Géométrie : PolyhedronGeometry, 12 vertices, 20 triangles (10 kites × 2 triangles)
// Normales moyennes par kite calculées via Node.js après construction géométrie.
// Paires opposées dot=-1.000 ✅ — convention D10 : opposées = 9 (valeurs 0-9)
//
// 3 types avec plages différentes :
//   d10       : faceValue ∈ {1..10}
//   d10_units : faceValue ∈ {0..9}
//   d10_tens  : faceValue ∈ {0,10,20..90}
//
// Normales partagées — mapping faceValue→kiteIndex diffère selon le type.
const D10_KITE_NORMALS = [
  [ 0.6012,  0.6692,  0.4368],  // kite 0 → valeur 0 (d10_units) / 1 (d10) / 0 (d10_tens)
  [ 0.2296, -0.6692,  0.7067],  // kite 1 → valeur 3
  [-0.2296,  0.6692,  0.7067],  // kite 2 → valeur 2
  [-0.6012, -0.6692,  0.4368],  // kite 3 → valeur 1
  [-0.7431,  0.6692,  0.0000],  // kite 4 → valeur 4
  [-0.6012, -0.6692, -0.4368],  // kite 5 → valeur 9
  [-0.2296,  0.6692, -0.7067],  // kite 6 → valeur 6
  [ 0.2296, -0.6692, -0.7067],  // kite 7 → valeur 7
  [ 0.6012,  0.6692, -0.4368],  // kite 8 → valeur 8
  [ 0.7431, -0.6692,  0.0000],  // kite 9 → valeur 5
]
// D10_KITE_VALUES[kiteIdx] = valeur 0-9 affichée (d10_units / d10_tens ×10 / d10 +1)
// Opposées : 0↔5(=9), 1↔6(=9)... — convention physique respectée
const D10_KITE_VALUES = [0, 3, 2, 1, 4, 9, 6, 7, 8, 5]

// Mappings complets par type (index = kiteIdx, valeur = faceValue du payload)
const D10_FACE_VALUES       = D10_KITE_VALUES.map(v => v === 0 ? 10 : v)  // d10 : 0→10
const D10_UNITS_FACE_VALUES = D10_KITE_VALUES                              // d10_units : 0-9
const D10_TENS_FACE_VALUES  = D10_KITE_VALUES.map(v => v * 10)            // d10_tens : 0,10..90

export { D10_KITE_NORMALS, D10_KITE_VALUES, D10_FACE_VALUES, D10_UNITS_FACE_VALUES, D10_TENS_FACE_VALUES }

// Export des données D4 pour DiceMesh
export { D4_FACE_VALUES, D4_FACE_NORMALS_LIST }

// D20 — IcosahedronGeometry, 20 faces non-indexées
// Mapping vérifié mathématiquement (opposées=21). Normales vérifiées Node.js.
const D20_FACE_VALUES = [18,20,19,17,14,16,12,8,11,15,4,2,1,3,7,10,6,5,9,13]
const D20_FACE_NORMALS_LIST = [
  [-0.5774, 0.5774, 0.5774],  // face 0  → 18
  [ 0.0000, 0.9342, 0.3568],  // face 1  → 20
  [ 0.0000, 0.9342,-0.3568],  // face 2  → 19
  [-0.5774, 0.5774,-0.5774],  // face 3  → 17
  [-0.9342, 0.3568, 0.0000],  // face 4  → 14
  [ 0.5774, 0.5774, 0.5774],  // face 5  → 16
  [-0.3568, 0.0000, 0.9342],  // face 6  → 12
  [-0.9342,-0.3568, 0.0000],  // face 7  →  8
  [-0.3568, 0.0000,-0.9342],  // face 8  → 11
  [ 0.5774, 0.5774,-0.5774],  // face 9  → 15
  [ 0.5774,-0.5774, 0.5774],  // face 10 →  4
  [ 0.0000,-0.9342, 0.3568],  // face 11 →  2
  [ 0.0000,-0.9342,-0.3568],  // face 12 →  1
  [ 0.5774,-0.5774,-0.5774],  // face 13 →  3
  [ 0.9342,-0.3568, 0.0000],  // face 14 →  7
  [ 0.3568, 0.0000, 0.9342],  // face 15 → 10
  [-0.5774,-0.5774, 0.5774],  // face 16 →  6
  [-0.5774,-0.5774,-0.5774],  // face 17 →  5
  [ 0.3568, 0.0000,-0.9342],  // face 18 →  9
  [ 0.9342, 0.3568, 0.0000],  // face 19 → 13
]
export { D20_FACE_VALUES, D20_FACE_NORMALS_LIST }

// D12 — DodecahedronGeometry + rotateX(PI/5), 12 pentagones non-indexés (3 tris chacun)
// Mapping post-rotation vérifié mathématiquement (opposées=13).
// D12_FACE_VALUES[i] = valeur du pentagone i (addGroup p*9,9,p)
const D12_FACE_VALUES = [7,9,11,10,4,12,8,2,6,3,5,1]
const D12_FACE_NORMALS_LIST = [
  [ 0.0000, 0.3792, 0.9253],  // penta 0  → 7
  [ 0.8507, 0.4253, 0.3090],  // penta 1  → 9
  [ 0.5257, 0.5000,-0.6882],  // penta 2  → 11
  [-0.5257, 0.5000,-0.6882],  // penta 3  → 10
  [-0.8507,-0.4253,-0.3090],  // penta 4  → 4
  [ 0.0000, 0.9972, 0.0747],  // penta 5  → 12
  [-0.8507, 0.4253, 0.3090],  // penta 6  → 8
  [-0.5257,-0.5000, 0.6882],  // penta 7  → 2
  [ 0.0000,-0.3792,-0.9253],  // penta 8  → 6
  [ 0.5257,-0.5000, 0.6882],  // penta 9  → 3
  [ 0.8507,-0.4253,-0.3090],  // penta 10 → 5
  [ 0.0000,-0.9972,-0.0747],  // penta 11 → 1
]
export { D12_FACE_VALUES, D12_FACE_NORMALS_LIST }

// D8 — OctahedronGeometry, 8 faces non-indexées
// Normales vérifiées par inspection Node.js. Mapping vérifié mathématiquement (opposées=9).
// D8_FACE_VALUES[i] = valeur de la face i (index Three.js)
// Assignation par paires ny desc : f0=8,f5=1 | f3=7,f1=2 | f4=6,f2=3 | f7=5,f6=4... 
const D8_FACE_VALUES = [8, 3, 4, 7, 6, 1, 2, 5]
const D8_FACE_NORMALS_LIST = [
  [ 0.5774,  0.5774,  0.5774],  // face 0 → valeur 8
  [ 0.5774, -0.5774,  0.5774],  // face 1 → valeur 3
  [ 0.5774, -0.5774, -0.5774],  // face 2 → valeur 4
  [ 0.5774,  0.5774, -0.5774],  // face 3 → valeur 7
  [-0.5774,  0.5774, -0.5774],  // face 4 → valeur 6
  [-0.5774, -0.5774, -0.5774],  // face 5 → valeur 1
  [-0.5774, -0.5774,  0.5774],  // face 6 → valeur 2
  [-0.5774,  0.5774,  0.5774],  // face 7 → valeur 5
]
export { D8_FACE_VALUES, D8_FACE_NORMALS_LIST }

// Retourne [nx, ny, nz] ou null si non mappé.
// Lib pure — pas d'import THREE. Le quaternion est calculé dans DiceMesh.
export function getFaceNormal(dieType, faceValue) {
  const map = FACE_NORMALS[dieType]
  if (!map) return null
  return map[faceValue] ?? null
}



// ─── Décomposition du payload serveur en dés individuels ─────────────────────
export function decomposeDice(rolls, dieType, seed) {
  const effectiveSeed = seed || Date.now()
  const result = []

  if (dieType === 'd100') {
    const value = rolls[0] ?? 100
    const tens  = Math.floor((value === 100 ? 0 : value) / 10) * 10
    const units = value % 10
    result.push({ dieType: 'd10_tens',  faceValue: tens,  seed: effectiveSeed })
    result.push({ dieType: 'd10_units', faceValue: units, seed: effectiveSeed ^ 1 })
  } else {
    for (let i = 0; i < rolls.length; i++) {
      result.push({ dieType, faceValue: rolls[i], seed: effectiveSeed ^ i })
    }
  }

  return result.slice(0, 6)
}

// ─── Calcul des positions de lanes ───────────────────────────────────────────
export function calcLanePositions(nDice, totalWidth = 8) {
  if (nDice === 1) return [0]
  const step = totalWidth / nDice
  const positions = []
  for (let i = 0; i < nDice; i++) {
    positions.push(-totalWidth / 2 + step * i + step / 2)
  }
  return positions
}

// ─── Rotation finale pseudo-aléatoire (V1) ───────────────────────────────────
// V2 : remplacer par getRotationForFace(dieType, faceValue) — quaternion exact.
export function getFinalRotation(seed) {
  const prng = createLCG(seed)
  return {
    rx: prng.next() * Math.PI * 2,
    ry: prng.next() * Math.PI * 2,
    rz: prng.next() * Math.PI * 2,
  }
}

// ─── Génération trajectoire ───────────────────────────────────────────────────
export function makeNoiseFunc(seed) {
  const prng = createLCG(seed + 999)
  const ox = prng.next() * Math.PI * 2
  const oy = prng.next() * Math.PI * 2
  const oz = prng.next() * Math.PI * 2
  const fx = 2 + prng.next() * 3
  const fy = 2 + prng.next() * 3
  const fz = 2 + prng.next() * 3

  return function noise(t) {
    return {
      dx: Math.sin(t * fx + ox) * 0.8,
      dy: Math.sin(t * fy + oy) * 0.6,
      dz: Math.sin(t * fz + oz) * 0.7,
    }
  }
}

// ─── Durée animation ──────────────────────────────────────────────────────────
// 1.8-2.5 secondes — immersif, visible, pas précipité.
export function getAnimDuration(seed) {
  const prng = createLCG(seed + 42)
  return 1.8 + prng.next() * 0.7   // secondes
}

// ─── Phases temporelles (normalisées 0→1) ────────────────────────────────────
// Recalibrées pour 2.5s max :
// Bounce : 0 → 0.4  (≈ 1s sur 2.5s)
// Align  : 0.4 → 0.8 (≈ 1s)
// Wobble : 0.8 → 1.0 (≈ 0.5s)
export const PHASES = {
  BOUNCE_END: 0.40,
  ALIGN_END:  0.80,
  WOBBLE_END: 1.0,
}

// ─── Easing ──────────────────────────────────────────────────────────────────
export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
