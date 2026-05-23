// Arrondi Polaris : 0.5 arrondit vers le bas (LdB convention, ≠ Math.round)
export function polarisRound(x) {
  return Math.floor(x + 0.4)
}

// Table na → Aptitude Naturelle (LdB)
export const AN_TABLE = [
  { min: 3,  max: 3,  an: -4 },
  { min: 4,  max: 4,  an: -3 },
  { min: 5,  max: 5,  an: -2 },
  { min: 6,  max: 7,  an: -1 },
  { min: 8,  max: 9,  an:  0 },
  { min: 10, max: 12, an:  1 },
  { min: 13, max: 15, an:  2 },
  { min: 16, max: 18, an:  3 },
  { min: 19, max: 21, an:  4 },
  { min: 22, max: 24, an:  5 },
  { min: 25, max: Infinity, an: 6 },
]

export function calcAN(na) {
  const entry = AN_TABLE.find(e => na >= e.min && na <= e.max)
  return entry ? entry.an : -4
}

// Allures de déplacement (LdB p.221)
export function calcAllureMoy(val) {
  if (val <= 5)  return 6
  if (val <= 10) return 8
  if (val <= 15) return 10
  if (val <= 20) return 12
  if (val <= 25) return 14
  return 16 + 2 * Math.floor((val - 26) / 5)
}

export function calcAllures(coo_na, athletisme_total) {
  const moy    = calcAllureMoy(coo_na)
  const maxMoy = calcAllureMoy(athletisme_total ?? 2)
  return { lente: moy / 2, moyenne: moy, rapide: moy * 2, max: maxMoy * 4 }
}
