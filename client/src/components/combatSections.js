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
  if (Array.isArray(mapActions.melee) && mapActions.melee.length > 0) {
    delta += -3
    if (mapActions.melee.length > 1) delta += -5
  }
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
  { k: 'move',     l: 'Déplacement',       tooltip: 'Déplacement court -3 / Se jeter à terre -5 / Se relever -10 / Se précipiter +3',              hint: 'cliquer destination',          isZoneSelect: true, span2: true },
  { k: 'attack',   l: 'Assaut (tir)',       tooltip: 'Attaque à distance. Tirer depuis une couverture -3 à -5.',                                    hint: 'cliquer cible',                requireWeapon: true },
  { k: 'melee',    l: 'Corps à corps',      tooltip: 'Venir au corps à corps pour saisir son adversaire -3.',                                       hint: 'cliquer adversaire', ini: -3                      },
  { k: 'reload',   l: 'Rechargement',       tooltip: 'Recharger son arme — aucun tir ni corps à corps possible ce tour. Coût INI : 0.',                                                                      span2: true          },
  { k: 'multi',    l: 'Attaque multiple',   tooltip: 'Attaque sur plusieurs cibles -5.',                                                            hint: '',                   ini: -5,  active: false       },
  { k: 'interact', l: 'Interagir',          tooltip: 'Utiliser un mécanisme simple (actionner un interrupteur, ouvrir une porte, saisir un objet) -3 à -5.', hint: 'sprint suivant',    active: false       },
]

// Actions rapides -- cumulables
export const QUICK_ACTIONS = [
  { k: 'observer', l: 'Observer le combat',              tooltip: 'Observer le combat — 1 information par tranche de 5 pts d\'Init.',                                                    kind: 'incremental', stepIni: -5, max: 6 },
  { k: 'reperer',  l: 'Repérer (obj., personne, lieu…)', tooltip: 'Tenter de repérer un objet, une arme, une personne, un endroit, etc. — 1 Test d\'Observation par tranche de 5 pts d\'Init.', kind: 'incremental', stepIni: -5, max: 6 },
  { k: 'phrase',   l: 'Prononcer une phrase',            tooltip: 'Prononcer une phrase courte, donner des ordres brefs -3.',                                                             kind: 'fixed',       ini: -3             },
]

// Zones de deplacement -- inchange
export const MOVE_ZONE_DEFS = [
  { allureKey: 'lente',   action_key: 'move_lente',   ini_mod: -3, color: '#3b82f6', label: 'Lente'   },
  { allureKey: 'moyenne', action_key: 'move_moyenne',  ini_mod: -5, color: '#22c55e', label: 'Moyenne' },
  { allureKey: 'rapide',  action_key: 'move_rapide',   ini_mod: -7, color: '#f97316', label: 'Rapide'  },
  { allureKey: 'max',     action_key: 'move_max',      ini_mod:  0, color: '#ef4444', label: 'Max'     },
]

// Variants mode de tir — source unique partagée (LdB p.227-228)
export const FIRE_MODE_VARIANTS = {
  CC: [
    { id: 'cc_1',   bulletCount: 1,  bonusComp: 0, bonusDmg: 0 },
    { id: 'cc_2',   bulletCount: 2,  bonusComp: 1, bonusDmg: 0 },
    { id: 'cc_3',   bulletCount: 3,  bonusComp: 2, bonusDmg: 0 },
    { id: 'cc_4',   bulletCount: 4,  bonusComp: 3, bonusDmg: 0 },
    { id: 'cc_7a',  bulletCount: 7,  bonusComp: 4, bonusDmg: 0 },
    { id: 'cc_7b',  bulletCount: 7,  bonusComp: 3, bonusDmg: 3 },
    { id: 'cc_10a', bulletCount: 10, bonusComp: 5, bonusDmg: 0 },
    { id: 'cc_10b', bulletCount: 10, bonusComp: 4, bonusDmg: 3 },
  ],
  RC: [{ id: 'rc_3', bulletCount: 3, bonusComp: 3, bonusDmg: 5 }],
  RL: [
    { id: 'rl_5',   bulletCount: 5,  bonusComp: 2, bonusDmg: 2 },
    { id: 'rl_10',  bulletCount: 10, bonusComp: 4, bonusDmg: 4 },
    { id: 'rl_15',  bulletCount: 15, bonusComp: 6, bonusDmg: 6 },
    { id: 'rl_20',  bulletCount: 20, bonusComp: 8, bonusDmg: 8 },
    { id: 'rl_mc',  bulletCount: 5,  bonusComp: 0, bonusDmg: 0 },
  ],
}

// Paliers répétition CC (index → bulletCount)
export const CC_REPS_STEPS = [2, 3, 4, 7, 10]

// Boutons RL
export const RL_BUTTONS = [
  { value: 5,       label: '5b'    },
  { value: 10,      label: '10b'   },
  { value: 15,      label: '15b'   },
  { value: 20,      label: '20b'   },
  { value: 'multi', label: 'Multi' },
]

// Labels d'action pour le log de déclarations — source unique (REWORK-05)
export const ACTION_LABELS = {
  assault:    'Assaut (tir)',
  melee:      'Assaut (CaC)',
  reload:     'Rechargement',
  micro:      'Action',
  move_short: 'Déplacement',
  move_long:  'Déplacement (long)',
  sprint:     'Sprint',
  rush:       'Rush',
  move:       'Déplacement',
}

export const PURE_MOVE_TYPES = new Set(['move_short', 'move_long', 'sprint', 'rush', 'move'])

// Modes de combat CaC — tooltips canoniques (version Joueur, plus complets)
export const COMBAT_MODE_DEFS = [
  { k: 'normal',   l: 'Normal',   tooltip: 'Mode par défaut — aucun modificateur.' },
  { k: 'offensif', l: 'Offensif', tooltip: '+3 à l\'attaque / −5 à la défense si attaqué jusqu\'à la prochaine action.' },
  { k: 'charge',   l: 'Charge',   tooltip: '+3 attaque +3 dégâts / −7 défense / distance ≥ 3m requise + déplacement court gratuit.' },
  { k: 'defensif', l: 'Défensif', tooltip: 'Aucune attaque. +3 en défense si attaqué. Retarde l\'action. (LdB p.223)' },
  { k: 'retraite', l: 'Retraite', tooltip: 'Aucune attaque. +5 en défense si attaqué. Recul possible. (LdB p.223)' },
]

// Calcul variant de tir — source unique partagée entre GM et Joueur
// defaultCcCount = 1 pour GM (PNJ default tir simple), null pour Joueur (forçage de sélection)
export function computeFireVariant(fireMode, rawBulletCount, variantAB, { defaultCcCount = null } = {}) {
  const effectiveBulletCount = rawBulletCount ?? (
    fireMode === 'RC' ? 3 : fireMode === 'CC' ? defaultCcCount : null
  )
  let variant = null
  if (fireMode === 'RC') {
    variant = FIRE_MODE_VARIANTS.RC[0]
  } else if (fireMode === 'CC' && effectiveBulletCount !== null) {
    if (effectiveBulletCount === 7)
      variant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (variantAB === 'B' ? 'cc_7b' : 'cc_7a'))
    else if (effectiveBulletCount === 10)
      variant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (variantAB === 'B' ? 'cc_10b' : 'cc_10a'))
    else
      variant = FIRE_MODE_VARIANTS.CC.find(v => v.bulletCount === effectiveBulletCount)
  } else if (fireMode === 'RL' && rawBulletCount) {
    variant = rawBulletCount === 'multi'
      ? FIRE_MODE_VARIANTS.RL.find(v => v.id === 'rl_mc')
      : FIRE_MODE_VARIANTS.RL.find(v => v.bulletCount === rawBulletCount)
  }
  return { variant, effectiveBulletCount }
}
