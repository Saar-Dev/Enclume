export const ARMOR_CATEGORY_MALUS = { S: 0, A: -2, B: -3, C: -4, D: -6 }

export const LOCATION_TO_SLOT = {
  tete: 'T', corps: 'C',
  bras_gauche: 'BG', bras_droit: 'BD',
  jambe_gauche: 'JG', jambe_droite: 'JD',
  main_gauche: 'MG', main_droite: 'MD',
  deux_mains: '2M', tripode: 'Tr',
}

export const SLOT_TO_REF_LOCATION = {
  T: 'T', C: 'C',
  BG: 'B', BD: 'B',
  JG: 'J', JD: 'J',
  MG: 'M', MD: 'M',
  '2M': 'M', Tr: 'M',
}

export const SLOT_TO_WOUND_LOCATION = {
  T: 'tete', C: 'corps',
  BD: 'bras_droit', BG: 'bras_gauche',
  JD: 'jambe_droite', JG: 'jambe_gauche',
}

export const LOCATION_TO_SVG = {
  tete: 'head', corps: 'body',
  bras_gauche: 'left-arm', bras_droit: 'right-arm',
  jambe_gauche: 'left-leg', jambe_droite: 'right-leg',
}

export const LOCATION_LABELS = {
  tete: 'Tête', corps: 'Corps',
  bras_gauche: 'Bras G', bras_droit: 'Bras D',
  jambe_gauche: 'Jambe G', jambe_droite: 'Jambe D',
}
