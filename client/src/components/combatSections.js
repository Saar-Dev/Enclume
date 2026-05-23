export const KEY_MOD = {
  // Précipitation
  rushed:              3,
  // Préparation — fixes
  micro_draw_ready:   -3,
  micro_draw:         -5,
  micro_phrase:       -3,
  micro_fire_mode:    -3,
  // Préparation — variantes (clé = base_valeurAbsolue)
  micro_observe_5:    -5,
  micro_observe_10:  -10,
  micro_observe_15:  -15,
  micro_observe_20:  -20,
  micro_locate_5:     -5,
  micro_locate_10:   -10,
  micro_locate_15:   -15,
  micro_locate_20:   -20,
  micro_mechanism_3:  -3,
  micro_mechanism_5:  -5,
  // Déplacement
  crouch:             -3,
  dive:               -5,
  stand_up:          -10,
  take_cover:         -3,
  // Combat
  assault:             0,
  close_combat:       -3,
  // Déplacement-couverture variantes
  cover_shot_3:       -3,
  cover_shot_5:       -5,
}

export const MOVE_ZONE_DEFS = [
  { allureKey: 'lente',   action_key: 'move_lente',   ini_mod: -3, color: '#3b82f6', label: 'Lente'   },
  { allureKey: 'moyenne', action_key: 'move_moyenne',  ini_mod: -5, color: '#22c55e', label: 'Moyenne' },
  { allureKey: 'rapide',  action_key: 'move_rapide',   ini_mod: -7, color: '#f97316', label: 'Rapide'  },
  { allureKey: 'max',     action_key: 'move_max',      ini_mod:  0, color: '#ef4444', label: 'Max'     },
]

export const SECTIONS = [
  {
    key: 'precip',
    label: 'PRÉCIPITATION',
    items: [
      { key: 'rushed', label: 'Se précipiter', mod: 3, active: true },
    ],
  },
  {
    key: 'prep',
    label: 'PRÉPARATION',
    items: [
      { key: 'micro_draw_ready',  label: 'Dégainer une arme (prêt à dégainer)', mod: -3,  active: true  },
      { key: 'micro_draw',        label: 'Dégainer une arme',                   mod: -5,  active: true  },
      { key: 'micro_grab',        label: 'Saisir un objet',                      active: true,
        isZoneSelect: true,
        staticZones: [
          { radius: 3,  action_key: 'grab_close', ini_mod: -3,  color: '#3b82f6', label: '≤ 3 m'  },
          { radius: 5,  action_key: 'grab_far',   ini_mod: -5,  color: '#22c55e', label: '≤ 5 m'  },
          { radius: 10, action_key: 'grab_far',   ini_mod: -10, color: '#f97316', label: '≤ 10 m' },
        ] },
      { key: 'micro_observe',     label: 'Observer le combat',                  range: { min: -20, max: -5, step: 5 }, active: true },
      { key: 'micro_locate',      label: 'Repérer un objet / une personne',     range: { min: -20, max: -5, step: 5 }, active: true },
      { key: 'micro_mechanism',   label: 'Utiliser un mécanisme simple',        range: { min: -5,  max: -3, step: 2 }, active: true },
      { key: 'micro_fire_mode',   label: 'Changer le mode de tir',              mod: -3,  active: true  },
      { key: 'micro_phrase',      label: 'Prononcer une phrase courte',         mod: -3,  active: true  },
      { key: 'micro_delay',       label: 'Retarder son action',                 modLabel: 'Spécial', active: false },
    ],
  },
  {
    key: 'depl',
    label: 'DÉPLACEMENT',
    items: [
      { key: 'crouch',     label: "S'accroupir / Se redresser",          mod: -3,  active: true  },
      { key: 'move',       label: 'Déplacement',                         active: true, isZoneSelect: true, staticZones: null },
      { key: 'dive',       label: 'Se jeter à terre / Plonger',          mod: -5,  active: true  },
      { key: 'stand_up',   label: 'Se relever',                          mod: -10, active: true  },
      { key: 'take_cover', label: 'Se découvrir / Se mettre à couvert',  mod: -3,  active: true  },
    ],
  },
  {
    key: 'combat',
    label: 'COMBAT',
    items: [
      { key: 'assault',          label: 'Assaut',                      mod: 0,   active: true  },
      { key: 'multi_attack',     label: 'Attaque multiple',            mod: -5,  active: false },
      { key: 'close_combat',     label: 'Venir au corps à corps',      mod: -3,  active: true  },
      { key: 'change_fire_mode', label: 'Changer le mode de tir',      mod: -3,  active: false },
      { key: 'cover_shot',       label: 'Tirer depuis une couverture', range: { min: -5, max: -3, step: 2 }, active: true },
    ],
  },
]

export function formatMod(item) {
  if (item.modLabel) return item.modLabel
  if (item.mod === undefined || item.mod === null) return ''
  return item.mod > 0 ? `+${item.mod}` : item.mod === 0 ? '—' : `${item.mod}`
}
