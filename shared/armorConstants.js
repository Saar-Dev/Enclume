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

// Slots symétriques gauche/droite partageant le même ref_location générique (SLOT_TO_REF_LOCATION).
// Un item à ref_location simple (ex. 'B' — brassard) ne couvre qu'un seul côté à la fois : un
// second exemplaire est nécessaire pour l'autre côté. Un item à ref_location composée (ex.
// 'T/C/B/J' — combinaison intégrale) peut légitimement accumuler les deux côtés sous un même
// exemplaire (une seule combinaison protège les deux bras).
export const SYMMETRIC_SLOT_PAIRS = { BG: 'BD', BD: 'BG', JG: 'JD', JD: 'JG' }

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

export const LOC_TABLE = [
  { max: 2,  slot: 'T'  },
  { max: 8,  slot: 'C'  },
  { max: 11, slot: 'BD' },
  { max: 14, slot: 'BG' },
  { max: 17, slot: 'JD' },
  { max: 20, slot: 'JG' },
]

// Viser une Localisation précise (LdB p.229-230, docs/BUGIDENTIFIE.md COM9) — malus au Test pour
// choisir la zone touchée au lieu du 1D20 aléatoire. Clés = mêmes que SLOT_TO_WOUND_LOCATION/
// LOCATION_TO_SLOT/LOCATION_LABELS (réutilisés tels quels, pas de nouvelle table de zones).
export const AIMED_LOCATION_MALUS = {
  tete: -7, corps: -3,
  bras_droit: -7, bras_gauche: -7,
  jambe_droite: -5, jambe_gauche: -5,
}
