import { getAimIniCost } from '../../../shared/combatExclusiveActions.js'

// Definitions d'etats -- matrices de transition INI
// stateTransitionCost(def, from, to) -> delta INI (0 si from === to)

// label/l/short = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le
// composant consommateur via t(), jamais affichee brute ici. special (vitesse.delayed) inutilise
// (aucun rendu trouve) -- laisse en texte, pas un texte visible.
export const STATE_DEFS = {
  position: {
    label: 'states.position.label',
    states: [
      { k: 'standing',  l: 'states.position.standing.label',  short: 'states.position.standing.short'  },
      { k: 'crouching', l: 'states.position.crouching.label', short: 'states.position.crouching.short' },
      { k: 'prone',     l: 'states.position.prone.label',     short: 'states.position.prone.short'     },
    ],
    cost: {
      standing:  { crouching: -3, prone:     -5  },
      crouching: { standing:  -3, prone:     -5  },
      prone:     { standing: -10, crouching: -10 },
    },
  },
  weapon: {
    label: 'states.weapon.label',
    states: [
      { k: 'holstered', l: 'states.weapon.holstered.label', short: 'states.weapon.holstered.short' },
      { k: 'ready',     l: 'states.weapon.ready.label',     short: 'states.weapon.ready.short'      },
      { k: 'drawn',     l: 'states.weapon.drawn.label',     short: 'states.weapon.drawn.short'      },
    ],
    cost: {
      holstered: { ready: -3, drawn:    -5  },
      ready:     { holstered: -5, drawn: -3  },
      drawn:     { holstered: -10, ready: -3 },
    },
  },
  fire_mode: {
    label: 'states.fireMode.label',
    states: [
      { k: 'cc', l: 'states.fireMode.cc.label', short: 'states.fireMode.cc.short' },
      { k: 'rc', l: 'states.fireMode.rc.label', short: 'states.fireMode.rc.short' },
      { k: 'rl', l: 'states.fireMode.rl.label', short: 'states.fireMode.rl.short' },
    ],
    // Tout changement: -3
    cost: {
      cc: { rc: -3, rl: -3 },
      rc: { cc: -3, rl: -3 },
      rl: { cc: -3, rc: -3 },
    },
  },
  cover: {
    label: 'states.cover.label',
    states: [
      { k: 'exposed',   l: 'states.cover.exposed.label'   },
      { k: 'partial',   l: 'states.cover.partial.label'   },
      { k: 'important', l: 'states.cover.important.label' },
    ],
    // Aucun cout INI -- flag defensif pur (affecte les tireurs adverses en Phase 2)
    cost: {},
  },
  vitesse: {
    label: 'states.vitesse.label',
    states: [
      { k: 'delayed',  l: 'states.vitesse.delayed.label', special: 'Spécial' },
      { k: 'normal',   l: 'states.vitesse.normal.label'    },
      { k: 'rushed',   l: 'states.vitesse.rushed.label'   },
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

// Détail INI client — retourne { label, value }[] (indicatif -- recalcule serveur).
// Fonction pure : ne peut pas appeler useTranslation() elle-meme (hors corps de composant, regle des
// hooks) -- `t` est fourni explicitement par l'appelant (docs/SYSTEME/LOCALISATION.md §3.1), meme
// convention que charStats.js (docs/SYSTEME/CONVENTIONS.md §18 : fonctions pures, le caller fournit
// les donnees) etendue ici a `t` comme toute autre dependance externe.
export function calcIniBreakdown(prevStates, nextStates, mapActions, quick, t) {
  const lines = []

  for (const key of ['position', 'weapon', 'fire_mode', 'cover', 'vitesse']) {
    const def  = STATE_DEFS[key]
    const from = prevStates[key]
    const to   = nextStates[key]
    if (!from || !to || from === to) continue
    const cost = stateTransitionCost(def, from, to)
    if (cost === 0) continue
    const fromLabelKey = def.states.find(s => s.k === from)?.l
    const toLabelKey   = def.states.find(s => s.k === to)?.l
    const fromLabel = fromLabelKey ? t(fromLabelKey) : from
    const toLabel   = toLabelKey   ? t(toLabelKey)   : to
    lines.push({ label: t('iniBreakdown.stateTransition', { label: t(def.label), from: fromLabel, to: toLabel }), value: cost })
  }

  if (mapActions.move?.ini_mod) {
    const zone = MOVE_ZONE_DEFS.find(z => z.ini_mod === mapActions.move.ini_mod)
    lines.push({
      label: zone ? t('iniBreakdown.moveZone', { zone: t(zone.label).toLowerCase() }) : t('actionLabels.move'),
      value: mapActions.move.ini_mod,
    })
  }
  if (Array.isArray(mapActions.melee) && mapActions.melee.length > 0) {
    lines.push({ label: t('iniBreakdown.melee'), value: -3 })
    if (mapActions.melee.length > 1) lines.push({ label: t('iniBreakdown.meleeExtraTargets'), value: -5 })
  }
  // mapActions.attack est un array (docs/PLAN_TIRMULTI.md D1) — Tir visé/cover_shot sont mutuellement
  // exclusifs avec Tir Multi (D10), donc jamais présents que sur le seul élément possible quand actifs.
  const singleAttack = Array.isArray(mapActions.attack) ? mapActions.attack[0] : mapActions.attack
  if (singleAttack?.cover_shot) {
    lines.push({ label: t('iniBreakdown.coverShot'), value: nextStates.cover === 'important' ? -5 : -3 })
  }
  const aimTranches = singleAttack?.aimTranches ?? 0
  if (aimTranches > 0) {
    const lunetteNiveau = singleAttack?.lunetteNiveau ?? 0
    lines.push({ label: t('iniBreakdown.aimedShot', { count: aimTranches }), value: getAimIniCost(aimTranches, { lunetteNiveau }) })
  }
  // Tir Multi (docs/PLAN_TIRMULTI.md D3) : RAW ne décrit qu'un seul coût chiffré pour les Attaques
  // multiples — le décalage de phase (-5/-10), déjà porté par l'échelle de phases côté serveur
  // (computeSeriesPositions). Aucun forfait Initiative de déclaration supplémentaire ici.

  const obs = quick?.observer ?? 0
  if (obs > 0) lines.push({ label: t('iniBreakdown.observe', { count: obs }), value: obs * -5 })
  const rep = quick?.reperer ?? 0
  if (rep > 0) lines.push({ label: t('iniBreakdown.spot', { count: rep }), value: rep * -5 })
  if (quick?.phrase) lines.push({ label: t('iniBreakdown.shortPhrase'), value: -3 })

  return lines
}

// Calcul INI total client (indicatif -- recalcule serveur). Fonction pure, `t` fourni par l'appelant
// (meme convention que calcIniBreakdown ci-dessus) -- ne consomme que .value mais doit relayer `t`
// pour que calcIniBreakdown puisse resoudre les labels qu'elle construit et jette ensuite.
export function calcIniDelta(prevStates, nextStates, mapActions, quick, t) {
  return calcIniBreakdown(prevStates, nextStates, mapActions, quick, t)
    .reduce((sum, l) => sum + l.value, 0)
}

// Actions sur la carte -- multi-selection
// l/tooltip = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le composant
// consommateur via t(), jamais affichee brute ici. hint inutilise (aucun rendu trouve) -- laisse en
// texte, pas un texte visible.
export const MAP_ACTIONS = [
  { k: 'move',     l: 'mapActions.move.label',     tooltip: 'mapActions.move.tooltip',     hint: 'cliquer destination',          isZoneSelect: true, span2: true },
  { k: 'attack',   l: 'mapActions.attack.label',   tooltip: 'mapActions.attack.tooltip',   hint: 'cliquer cible',                requireWeapon: true },
  { k: 'melee',    l: 'mapActions.melee.label',    tooltip: 'mapActions.melee.tooltip',    hint: 'cliquer adversaire', ini: -3                      },
  { k: 'reload',   l: 'mapActions.reload.label',   tooltip: 'mapActions.reload.tooltip',                                                             span2: true          },
  { k: 'interact', l: 'mapActions.interact.label', tooltip: 'mapActions.interact.tooltip', hint: 'sprint suivant',    active: false       },
]

// Actions rapides -- cumulables. l/tooltip = cle i18n namespace combat, meme convention que ci-dessus.
export const QUICK_ACTIONS = [
  { k: 'observer', l: 'quickActions.observer.label', tooltip: 'quickActions.observer.tooltip', kind: 'incremental', stepIni: -5, max: 6 },
  { k: 'reperer',  l: 'quickActions.reperer.label',  tooltip: 'quickActions.reperer.tooltip',  kind: 'incremental', stepIni: -5, max: 6 },
  { k: 'phrase',   l: 'quickActions.phrase.label',   tooltip: 'quickActions.phrase.tooltip',   kind: 'fixed',       ini: -3             },
]

// Zones de deplacement -- label = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1),
// resolue par le composant consommateur via t(), jamais affichee brute ici.
export const MOVE_ZONE_DEFS = [
  { allureKey: 'lente',   action_key: 'move_lente',   ini_mod: -3, color: '#3b82f6', label: 'moveZones.lente'   },
  { allureKey: 'moyenne', action_key: 'move_moyenne',  ini_mod: -5, color: '#22c55e', label: 'moveZones.moyenne' },
  { allureKey: 'rapide',  action_key: 'move_rapide',   ini_mod: -7, color: '#f97316', label: 'moveZones.rapide'  },
  { allureKey: 'max',     action_key: 'move_max',      ini_mod:  0, color: '#ef4444', label: 'moveZones.max'     },
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

// Boutons RL — label = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le
// composant consommateur via t(), jamais affichee brute ici.
export const RL_BUTTONS = [
  { value: 5,       label: 'rlButtons.b5'    },
  { value: 10,      label: 'rlButtons.b10'   },
  { value: 15,      label: 'rlButtons.b15'   },
  { value: 20,      label: 'rlButtons.b20'   },
  { value: 'multi', label: 'rlButtons.multi' },
]

// Labels d'action pour le log de déclarations — source unique (REWORK-05)
// Valeurs = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le composant
// consommateur via t(), jamais affichee brute ici.
export const ACTION_LABELS = {
  assault:    'actionLabels.assault',
  melee:      'actionLabels.melee',
  reload:     'actionLabels.reload',
  micro:      'actionLabels.micro',
  move_short: 'actionLabels.moveShort',
  move_long:  'actionLabels.moveLong',
  sprint:     'actionLabels.sprint',
  rush:       'actionLabels.rush',
  move:       'actionLabels.move',
}

export const PURE_MOVE_TYPES = new Set(['move_short', 'move_long', 'sprint', 'rush', 'move'])

// Modes de combat CaC — tooltips canoniques (version Joueur, plus complets)
// l/tooltip = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le composant
// consommateur via t(), jamais affichee brute ici.
export const COMBAT_MODE_DEFS = [
  { k: 'normal',   l: 'modes.normal.label',   tooltip: 'modes.normal.tooltip' },
  { k: 'offensif', l: 'modes.offensif.label', tooltip: 'modes.offensif.tooltip' },
  { k: 'charge',   l: 'modes.charge.label',   tooltip: 'modes.charge.tooltip' },
  { k: 'defensif', l: 'modes.defensif.label', tooltip: 'modes.defensif.tooltip' },
  { k: 'retraite', l: 'modes.retraite.label', tooltip: 'modes.retraite.tooltip' },
]

// Calcul variant de tir — source unique partagée entre GM et Joueur
// defaultCcCount = 1 : tir simple sélectionné par défaut si aucun count explicite (GM + Joueur)
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
