import { randomInt } from 'crypto'

// ─── Regex ────────────────────────────────────────────────────────────────────
// Supporte : dX  NdX  NdX+M  NdX-M
// Capture  : [1]=count (optionnel)  [2]=faces  [3]=modificateur (optionnel, ex: "+3" ou "-2")
const DICE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i

// ─── parseDice ────────────────────────────────────────────────────────────────
// Retourne : { rolls, total, formula, dieType, seed }
// Lève une Error si la formule est invalide.
//
// dieType : 'dX' si un seul type de dé (avec ou sans modificateur).
//   Le modificateur est ignoré pour le lookup dice_config — seul le nombre de faces
//   détermine si un critique peut s'appliquer. La règle métier est :
//   "les critiques ne sont valables que sur un jet d'un seul dé" (décision session 18).
//   Null uniquement si la formule est invalide ou mixte (hors scope).
//
// seed : XOR de tous les rolls — entier simple, préparé pour animation 3D future.
//
// Async car crypto.randomInt peut être async selon la version Node.js.

export async function parseDice(formula) {
  if (!formula || typeof formula !== 'string') {
    throw new Error(`Formule invalide : ${formula}`)
  }

  const trimmed = formula.trim().toLowerCase()
  const match = trimmed.match(DICE_REGEX)

  if (!match) {
    throw new Error(`Formule non reconnue : ${formula}`)
  }

  const count = match[1] ? parseInt(match[1], 10) : 1
  const faces = parseInt(match[2], 10)
  const modStr = match[3] || null               // ex: "+3", "-2", null
  const modifier = modStr ? parseInt(modStr, 10) : 0

  // Gardes — valeurs absurdes rejetées
  if (count < 1 || count > 100) {
    throw new Error(`Nombre de dés invalide : ${count}`)
  }
  if (faces < 2 || faces > 1000) {
    throw new Error(`Nombre de faces invalide : ${faces}`)
  }

  // Lancer les dés
  const rolls = []
  for (let i = 0; i < count; i++) {
    // randomInt(min, max) — max exclusif → (1, faces+1) donne [1, faces]
    rolls.push(randomInt(1, faces + 1))
  }

  const rollSum = rolls.reduce((a, b) => a + b, 0)
  const total = rollSum + modifier

  // dieType : toujours non-null pour une formule valide à un seul type de dé.
  // Le modificateur n'affecte pas le dieType — décision session 18.
  const dieType = `d${faces}`

  // Formule normalisée (pour affichage)
  const normalizedFormula = buildNormalizedFormula(count, faces, modifier)

  // Seed : XOR de tous les rolls — entier, reproductible, préparé pour animation 3D
  const seed = rolls.reduce((a, b) => a ^ b, 0)

  return {
    rolls,
    total,
    formula: normalizedFormula,
    dieType,
    seed,
  }
}

// ─── buildNormalizedFormula ───────────────────────────────────────────────────
// Produit une formule lisible : "d20", "3d6", "2d6+3", "1d8-2"
function buildNormalizedFormula(count, faces, modifier) {
  const base = count === 1 ? `d${faces}` : `${count}d${faces}`
  if (modifier === 0) return base
  if (modifier > 0) return `${base}+${modifier}`
  return `${base}${modifier}` // modifier est déjà négatif, ex: -2
}
