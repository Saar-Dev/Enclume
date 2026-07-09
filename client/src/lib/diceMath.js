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

// GLB paths — dés avec modèle .glb embarqué (texture baked, geometry artistique)
// Clé absente → fallback géométrie procédurale dans DiceMesh.jsx
// d10 et d10_units partagent D10.glb — d10_tens utilise D100.glb (labels 00-90)
export const GLB_PATHS = {
  d4:        '/models/D4.glb',
  d6:        '/models/D6.glb',
  d8:        '/models/D8.glb',
  d10:       '/models/D10.glb',
  d10_units: '/models/D10.glb',
  d10_tens:  '/models/D100.glb',
  d12:       '/models/D12.glb',
  d20:       '/models/D20.glb',
}
// ─── Normales par face — vérifiées par inspection Three.js (Node.js) ─────────
// Retourne le vecteur normal [nx, ny, nz] de la face à orienter vers la caméra.
// Source : BoxGeometry groups inspectés via geo.attributes.normal.
// Convention dé physique D6 : faces opposées = 7.
const D6_FACE_NORMALS = {
  1: [ 0,  0,  1],  // Blender front (vue -Y → normale -Y en Blender) → Three.js +Z
  2: [ 0, -1,  0],  // Blender bottom (-Z) → Three.js -Y
  3: [-1,  0,  0],  // Blender left (-X)   → Three.js -X
  4: [ 1,  0,  0],  // Blender right (+X)  → Three.js +X
  5: [ 0,  1,  0],  // Blender top (+Z)    → Three.js +Y
  6: [ 0,  0, -1],  // Blender back (+Y)   → Three.js -Z
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

// Normales par face — extraites du .glb par K-means (inspect-glb.js), confirmées visuellement.
// ✓ = confirmé par test | ? = placeholder (cluster non encore mappé à sa valeur)
const D4_GLB_NORMALS = {
  1: [ 0.0000,  0.3380,  0.9412],  // C1 ✓
  2: [-0.8151,  0.3380, -0.4705],  // C3 ✓
  3: [ 0.0000, -1.0000,  0.0000],  // C4 ✓
  4: [ 0.8151,  0.3379, -0.4706],  // C2 ✓
}
const D8_GLB_NORMALS = {
  1: [-0.5981,  0.5335,  0.5981],  // C5 ✓
  2: [ 0.5982, -0.5334, -0.5980],  // C6 ✓
  3: [ 0.5979, -0.5335,  0.5982],  // C4 ✓
  4: [-0.5981,  0.5333, -0.5982],  // C3 ✓
  5: [ 0.5980,  0.5337, -0.5979],  // C2 ✓
  6: [-0.5981, -0.5335,  0.5980],  // C1 ✓
  7: [-0.5980, -0.5335, -0.5981],  // C8 ✓
  8: [ 0.5981,  0.5335,  0.5981],  // C7 ✓
}
// D10, D100 partagent la même géométrie — normals identiques (confirmé via inspect-glb.js).
// Calibré Session 141 (PLAN_DICEREWORK3 Lot 3) — harnais /dev/dice-calibration, lecture en direct
// sur D10.glb/D100.glb réels par Saar (10/10 valeurs, bijection 0-9 vérifiée des deux côtés).
// Table canonique unique pour D10.glb (Lot 1) — d10_units dérive de celle-ci (0 → face "10"),
// au lieu de dupliquer une deuxième table à la main.
const D10_GLB_NORMALS = {
   1: [ 0.0000,  0.5381,  0.8429],
   2: [-0.8016, -0.5381, -0.2605],
   3: [ 0.4955,  0.5381, -0.6819],
   4: [ 0.4954, -0.5381,  0.6819],
   5: [-0.4954,  0.5381, -0.6819],
   6: [-0.4955, -0.5381,  0.6819],
   7: [ 0.8016,  0.5381,  0.2605],
   8: [ 0.0000, -0.5381, -0.8429],
   9: [-0.8017,  0.5381,  0.2604],
  10: [ 0.8017, -0.5381, -0.2604],
}
// Dérivée de D10_GLB_NORMALS — jamais maintenue à la main (relabeling 10→0, même géométrie).
const D10_UNITS_DERIVED = Object.fromEntries(
  Object.entries(D10_GLB_NORMALS).map(([k, v]) => [k === '10' ? '0' : k, v])
)
// D100.glb — même géométrie que D10.glb, sérigraphie indépendante (calibrée séparément, pas
// dérivée par hypothèse — confirmé nécessaire, l'ordre face→valeur diffère bien des unités).
const D10T_FACE_GLB = {
   0: [ 0.0000,  0.5381,  0.8429],
  10: [-0.4955, -0.5381,  0.6819],
  20: [ 0.8016,  0.5381,  0.2605],
  30: [ 0.8017, -0.5381, -0.2604],
  40: [-0.4954,  0.5381, -0.6819],
  50: [ 0.4954, -0.5381,  0.6819],
  60: [-0.8017,  0.5381,  0.2604],
  70: [-0.8016, -0.5381, -0.2605],
  80: [ 0.4955,  0.5381, -0.6819],
  90: [ 0.0000, -0.5381, -0.8429],
}
const D12_GLB_NORMALS = {
   1: [-0.0539,  0.9980, -0.0340],  // C4 ✓
   2: [ 0.4044,  0.3860, -0.8291],  // C2 ?
   3: [-0.6197,  0.2847, -0.7314],  // C1 ✓
   4: [ 0.8355,  0.5397,  0.1037],  // C5 ?
   5: [-0.8575,  0.4381,  0.2697],  // C6 ?
   6: [-0.0158,  0.4513,  0.8922],  // C9 ?
   7: [ 0.0133, -0.5923, -0.8056],  // C10 ✓
   8: [ 0.8523, -0.4438, -0.2767],  // C8 ✓
   9: [-0.7821, -0.5963, -0.1812],  // C7 ✓
  10: [ 0.6154, -0.2660,  0.7420],  // C3 ✓
  11: [-0.5350, -0.4026,  0.7428],  // C12 ?
  12: [ 0.1213, -0.9671,  0.2235],  // C11 ✓
}
// D20 — normales exactes Blender, remappées par test visuel (session 65)
// clé = numéro réel sur le dé, valeur = normale géométrique correspondante
// Validation : toutes les paires antipodales (somme=21) ont dot=-1.000 ✓
const D20_GLB_NORMALS = {
   1: [-0.7949, -0.1880,  0.5769],
   2: [ 0.3040, -0.1880, -0.9339],
   3: [-0.1880,  0.7949,  0.5769],
   4: [ 0.6069, -0.7948,  0.0000],
   5: [-0.4909, -0.7948, -0.3569],
   6: [ 0.7949,  0.1880,  0.5769],
   7: [-0.9822,  0.1880,  0.0000],
   8: [ 0.4909,  0.7948, -0.3569],
   9: [ 0.3040, -0.1880,  0.9339],
  10: [-0.1880,  0.7949, -0.5769],
  11: [ 0.1880, -0.7949,  0.5769],
  12: [-0.3040,  0.1880, -0.9339],
  13: [-0.4909, -0.7948,  0.3569],
  14: [ 0.9822, -0.1880,  0.0000],
  15: [-0.7949, -0.1880, -0.5769],
  16: [ 0.4909,  0.7948,  0.3569],
  17: [-0.6069,  0.7948,  0.0000],
  18: [ 0.1880, -0.7949, -0.5769],
  19: [-0.3040,  0.1880,  0.9339],
  20: [ 0.7949,  0.1880, -0.5769],
}

const FACE_NORMALS = {
  d4:        D4_GLB_NORMALS,
  d6:        D6_FACE_NORMALS,
  d8:        D8_GLB_NORMALS,
  d10:       D10_GLB_NORMALS,
  d10_units: D10_UNITS_DERIVED,
  d10_tens:  D10T_FACE_GLB,
  d12:       D12_GLB_NORMALS,
  d20:       D20_GLB_NORMALS,
}

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

// Corrections de roulis pour les faces où `setFromUnitVectors` seul ne suffit pas à afficher un
// résultat lisible — cette fonction n'a aucun contrôle sur la rotation autour de l'axe aligné,
// donc certaines faces peuvent tomber sur une orientation où le bon chiffre n'apparaît pas
// clairement (D4 : chaque face porte les 3 AUTRES chiffres, jamais le sien — trouvé via
// `/dev/dice-calibration`, confirmé en jeu par Saar sur la face "4"). `tiltDeg` : incline la face
// hors de l'alignement exact face→caméra (nécessaire ici, pas juste un roulis) — calé sur l'angle
// de caméra par défaut de `Canvas3D.jsx`, imparfait si le joueur a beaucoup tourné la caméra.
export const FACE_ROLL_CORRECTIONS = {
  d4: { 4: { tiltDeg: -240 } },
}
export function getFaceRollCorrection(dieType, faceValue) {
  return FACE_ROLL_CORRECTIONS[dieType]?.[faceValue] ?? null
}

// Lookup inverse — utilisé par l'outil dev de calibration (DiceCalibrationPage) pour afficher
// "le code actuel prévoit : X" à côté d'une normale mesurée, sans dupliquer les tables.
// Retourne la clé (valeur de face) dont la normale enregistrée est la plus proche de `normal`.
export function getClosestFaceValue(dieType, normal) {
  const map = FACE_NORMALS[dieType]
  if (!map) return null
  const [nx, ny, nz] = normal
  let best = null, bestDot = -Infinity
  for (const [value, vec] of Object.entries(map)) {
    const dot = vec[0] * nx + vec[1] * ny + vec[2] * nz
    if (dot > bestDot) { bestDot = dot; best = value }
  }
  return best
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
