// Definitions d'etats -- matrices de transition INI
// stateTransitionCost(def, from, to) -> delta INI (0 si from === to)

export const STATE_DEFS = {
  position: {
    label: 'POSTURE',
    states: [
      { k: 'standing',  l: 'Debout'    },
      { k: 'crouching', l: 'Accroupi'  },
      { k: 'prone',     l: 'Couché'    },
    ],
    cost: {
      standing:  { crouching: -3, prone:     -5  },
      crouching: { standing:  -3, prone:     -5  },
      prone:     { standing: -10, crouching: -10 },
    },
  },
  weapon: {
    label: 'ARME',
    states: [
      { k: 'holstered', l: 'Rangée'           },
      { k: 'ready',     l: "Main sur l'arme"  },
      { k: 'drawn',     l: 'Au clair'         },
    ],
    cost: {
      holstered: { ready: -3, drawn:    -5  },
      ready:     { holstered: -5, drawn: -3  },
      drawn:     { holstered: -10, ready: -3 },
    },
  },
  fire_mode: {
    label: 'MODE DE TIR',
    states: [
      { k: 'cc', l: 'Coup par coup'  },
      { k: 'rc', l: 'Rafale courte'  },
      { k: 'rl', l: 'Rafale longue'  },
    ],
    // Tout changement: -3
    cost: {
      cc: { rc: -3, rl: -3 },
      rc: { cc: -3, rl: -3 },
      rl: { cc: -3, rc: -3 },
    },
  },
  cover: {
    label: 'COUVERTURE',
    states: [
      { k: 'exposed',   l: 'Découvert'          },
      { k: 'partial',   l: 'Partielle (50%)'    },
      { k: 'important', l: 'Importante (75%)'   },
    ],
    // Aucun cout INI -- flag defensif pur (affecte les tireurs adverses en Phase 2)
    cost: {},
  },
  vitesse: {
    label: 'VITESSE',
    states: [
      { k: 'delayed',  l: 'Retardée',    special: 'Spécial' },
      { k: 'normal',   l: 'Normale'    },
      { k: 'rushed',   l: 'Précipitée' },
    ],
    cost: {
      delayed:  { normal: 0, rushed: +3  },
      normal:   { delayed: 0, rushed: +3 },
      rushed:   { delayed: 0, normal:  0 },
    },
  },
}

// Retourne le delta INI pour passer de fromKey a toKey dans une STATE_DEF.
export function stateTransitionCost(def, fromKey, toKey) {
  if (fromKey === toKey) return 0
  return def.cost?.[fromKey]?.[toKey] ?? 0
}

// Calcul INI total client (indicatif -- recalcule serveur)
export function calcIniDelta(prevStates, nextStates, mapActions, quick) {
  let delta = 0

  for (const key of ['position', 'weapon', 'fire_mode', 'cover', 'vitesse']) {
    const def = STATE_DEFS[key]
    const from = prevStates[key]
    const to   = nextStates[key]
    if (from && to) delta += stateTransitionCost(def, from, to)
  }

  if (mapActions.move)   delta += mapActions.move.ini_mod ?? 0
  if (mapActions.melee)  delta += -3
  if (mapActions.multi)  delta += -5
  if (mapActions.attack?.cover_shot) {
    delta += nextStates.cover === 'important' ? -5 : -3
  }

  delta += (quick.observer ?? 0) * -5
  delta += (quick.reperer  ?? 0) * -5
  if (quick.phrase) delta += -3

  return delta
}

// Actions sur la carte -- multi-selection
export const MAP_ACTIONS = [
  { k: 'move',     l: 'Déplacement',       hint: 'cliquer destination',          isZoneSelect: true  },
  { k: 'attack',   l: 'Assaut (tir)',       hint: 'cliquer cible',                requireWeapon: true },
  { k: 'melee',    l: 'Corps à corps',      hint: 'cliquer adversaire', ini: -3                      },
  { k: 'multi',    l: 'Attaque multiple',   hint: '',                   ini: -5,  active: false       },
  { k: 'interact', l: 'Interagir',          hint: 'sprint suivant',               active: false       },
]

// Actions rapides -- cumulables
export const QUICK_ACTIONS = [
  { k: 'observer', l: 'Observer le combat',       kind: 'incremental', stepIni: -5, max: 6 },
  { k: 'reperer',  l: 'Repérer / scanner',        kind: 'incremental', stepIni: -5, max: 6 },
  { k: 'phrase',   l: 'Prononcer une phrase',     kind: 'fixed',       ini: -3             },
]

// Zones de deplacement -- inchange
export const MOVE_ZONE_DEFS = [
  { allureKey: 'lente',   action_key: 'move_lente',   ini_mod: -3, color: '#3b82f6', label: 'Lente'   },
  { allureKey: 'moyenne', action_key: 'move_moyenne',  ini_mod: -5, color: '#22c55e', label: 'Moyenne' },
  { allureKey: 'rapide',  action_key: 'move_rapide',   ini_mod: -7, color: '#f97316', label: 'Rapide'  },
  { allureKey: 'max',     action_key: 'move_max',      ini_mod:  0, color: '#ef4444', label: 'Max'     },
]
