// ─── diceMath.js ─────────────────────────────────────────────────────────────
// Fonctions pures pour l'animation des dés — zéro import React, zéro accès DB.
// Utilisé par DiceMesh.jsx et DiceRoller.jsx.
//
// Principe cinématique déterministe :
// Le résultat est dicté par le serveur. L'animation joue une interpolation (slerp)
// vers un Quaternion fixe pré-calculé correspondant à la face cible.
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

// ─── DICTIONNAIRE DES ROTATIONS (À REMPLIR DEPUIS BLENDER) ───────────────────
// Insère ici les coordonnées de Quaternion {x, y, z, w} pour chaque face.
// Chaque quaternion doit correspondre à la rotation locale nécessaire pour que
// la face en question soit orientée vers le HAUT (Axe +Y) par défaut.
export const FACE_ROTATIONS = {
  d4: {
    1: { x: 0, y: 0, z: 0, w: 1 },
    2: { x: 0, y: 0, z: 0, w: 1 },
    3: { x: 0, y: 0, z: 0, w: 1 },
    4: { x: 0, y: 0, z: 0, w: 1 },
  },
  d6: {
    1: { x: 0, y: 0, z: 0, w: 1 },
    2: { x: 0, y: 0, z: 0, w: 1 },
    3: { x: 0, y: 0, z: 0, w: 1 },
    4: { x: 0, y: 0, z: 0, w: 1 },
    5: { x: 0, y: 0, z: 0, w: 1 },
    6: { x: 0, y: 0, z: 0, w: 1 },
  },
  d8: {
    1: { x: 0, y: 0, z: 0, w: 1 },
    2: { x: 0, y: 0, z: 0, w: 1 },
    3: { x: 0, y: 0, z: 0, w: 1 },
    4: { x: 0, y: 0, z: 0, w: 1 },
    5: { x: 0, y: 0, z: 0, w: 1 },
    6: { x: 0, y: 0, z: 0, w: 1 },
    7: { x: 0, y: 0, z: 0, w: 1 },
    8: { x: 0, y: 0, z: 0, w: 1 },
  },
  d10: { // d10 classique (valeurs de 1 à 10)
    1: { x: 0, y: 0, z: 0, w: 1 }, 2: { x: 0, y: 0, z: 0, w: 1 },
    3: { x: 0, y: 0, z: 0, w: 1 }, 4: { x: 0, y: 0, z: 0, w: 1 },
    5: { x: 0, y: 0, z: 0, w: 1 }, 6: { x: 0, y: 0, z: 0, w: 1 },
    7: { x: 0, y: 0, z: 0, w: 1 }, 8: { x: 0, y: 0, z: 0, w: 1 },
    9: { x: 0, y: 0, z: 0, w: 1 }, 10: { x: 0, y: 0, z: 0, w: 1 },
  },
  d10_units: { // d10 des unités pour le D100 (valeurs de 0 à 9)
    0: { x: 0, y: 0, z: 0, w: 1 }, 1: { x: 0, y: 0, z: 0, w: 1 },
    2: { x: 0, y: 0, z: 0, w: 1 }, 3: { x: 0, y: 0, z: 0, w: 1 },
    4: { x: 0, y: 0, z: 0, w: 1 }, 5: { x: 0, y: 0, z: 0, w: 1 },
    6: { x: 0, y: 0, z: 0, w: 1 }, 7: { x: 0, y: 0, z: 0, w: 1 },
    8: { x: 0, y: 0, z: 0, w: 1 }, 9: { x: 0, y: 0, z: 0, w: 1 },
  },
  d10_tens: { // d10 des dizaines pour le D100 (valeurs 0, 10, 20... 90)
    0: { x: 0, y: 0, z: 0, w: 1 }, 10: { x: 0, y: 0, z: 0, w: 1 },
    20: { x: 0, y: 0, z: 0, w: 1 }, 30: { x: 0, y: 0, z: 0, w: 1 },
    40: { x: 0, y: 0, z: 0, w: 1 }, 50: { x: 0, y: 0, z: 0, w: 1 },
    60: { x: 0, y: 0, z: 0, w: 1 }, 70: { x: 0, y: 0, z: 0, w: 1 },
    80: { x: 0, y: 0, z: 0, w: 1 }, 90: { x: 0, y: 0, z: 0, w: 1 },
  },
  d12: {
    1: { x: 0, y: 0, z: 0, w: 1 }, 2: { x: 0, y: 0, z: 0, w: 1 },
    3: { x: 0, y: 0, z: 0, w: 1 }, 4: { x: 0, y: 0, z: 0, w: 1 },
    5: { x: 0, y: 0, z: 0, w: 1 }, 6: { x: 0, y: 0, z: 0, w: 1 },
    7: { x: 0, y: 0, z: 0, w: 1 }, 8: { x: 0, y: 0, z: 0, w: 1 },
    9: { x: 0, y: 0, z: 0, w: 1 }, 10: { x: 0, y: 0, z: 0, w: 1 },
    11: { x: 0, y: 0, z: 0, w: 1 }, 12: { x: 0, y: 0, z: 0, w: 1 },
  },
  d20: {
    1: { x: 0, y: 0, z: 0, w: 1 }, 2: { x: 0, y: 0, z: 0, w: 1 },
    3: { x: 0, y: 0, z: 0, w: 1 }, 4: { x: 0, y: 0, z: 0, w: 1 },
    5: { x: 0, y: 0, z: 0, w: 1 }, 6: { x: 0, y: 0, z: 0, w: 1 },
    7: { x: 0, y: 0, z: 0, w: 1 }, 8: { x: 0, y: 0, z: 0, w: 1 },
    9: { x: 0, y: 0, z: 0, w: 1 }, 10: { x: 0, y: 0, z: 0, w: 1 },
    11: { x: 0, y: 0, z: 0, w: 1 }, 12: { x: 0, y: 0, z: 0, w: 1 },
    13: { x: 0, y: 0, z: 0, w: 1 }, 14: { x: 0, y: 0, z: 0, w: 1 },
    15: { x: 0, y: 0, z: 0, w: 1 }, 16: { x: 0, y: 0, z: 0, w: 1 },
    17: { x: 0, y: 0, z: 0, w: 1 }, 18: { x: 0, y: 0, z: 0, w: 1 },
    19: { x: 0, y: 0, z: 0, w: 1 }, 20: { x: 0, y: 0, z: 0, w: 1 },
  }
}

// Récupère l'objet rotation {x, y, z, w} pur ou null si manquant
export function getFaceQuaternion(dieType, faceValue) {
  const dieMap = FACE_ROTATIONS[dieType]
  if (!dieMap) return null
  return dieMap[faceValue] ?? null
}

// ─── Décomposition du payload serveur en dés individuels ─────────────────────
export function decomposeDice(rolls, dieType, seed) {
  const effectiveSeed = seed || Date.now()
  const result = []

  // Gestion du cas D100 : Séparation en deux dés distincts (dizaines et unités)
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

  return result.slice(0, 6) // Limitation de sécurité à 6 dés max à l'écran
}

// ─── Calcul des positions de couloirs (Lanes) ─────────────────────────────────
export function calcLanePositions(nDice, totalWidth = 8) {
  if (nDice === 1) return [0]
  const step = totalWidth / nDice
  const positions = []
  for (let i = 0; i < nDice; i++) {
    positions.push(-totalWidth / 2 + step * i + step / 2)
  }
  return positions
}

// ─── Rotation initiale chaotique pseudo-aléatoire ──────────────────────────────
export function getFinalRotation(seed) {
  const prng = createLCG(seed)
  return {
    rx: prng.next() * Math.PI * 2,
    ry: prng.next() * Math.PI * 2,
    rz: prng.next() * Math.PI * 2,
  }
}

// ─── Génération du bruit de tremblement (Wobble / Launch) ──────────────────────
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

// ─── Durée de base de l'animation ─────────────────────────────────────────────
export function getAnimDuration(seed) {
  const prng = createLCG(seed + 42)
  return 1.8 + prng.next() * 0.7 // Retourne une durée de base en secondes (1.8s - 2.5s)
}

// ─── Phases temporelles (normalisées de 0 à 1) ────────────────────────────────
export const PHASES = {
  BOUNCE_END: 0.40, // Fin de la phase de cloche parabolique chaotique
  ALIGN_END:  0.80, // Fin de la phase d'alignement/Slerp vers la face cible
  WOBBLE_END: 1.00, // Fin de la phase de micro-stabilisation finale
}

// ─── Fonctions d'Easing ───────────────────────────────────────────────────────
export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}