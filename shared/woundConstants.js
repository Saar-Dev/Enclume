export const WOUND_LOCATIONS = [
  'tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche',
]

export const WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']

export const WOUND_MAX_COUNTS = {
  tete:          { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  corps:         { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
  bras_droit:    { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  bras_gauche:   { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_droite:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_gauche:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
}

export const WOUND_PENALTIES = {
  legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: -20,
}
