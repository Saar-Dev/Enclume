import { STATE_TRANSITION_COST, iniDeltaBreakdown, computeIniDelta } from '../../../shared/combatIniCost.js'

// Definitions d'etats -- l'aperçu du coût de transition INI par option (segmented controls / chips).
// Les matrices de coût elles-mêmes ne vivent PAS ici : autorité unique shared/combatIniCost.js
// (STATE_TRANSITION_COST), partagée avec le serveur — STATE_DEFS ne fait que les référencer pour
// l'affichage. Le coût d'une transition = shared/combatIniCost.js#stateTransitionCost(stateKey, from, to).

// label/l/short = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le
// composant consommateur via t(), jamais affichee brute ici. special (vitesse.delayed) inutilise
// (aucun rendu trouve) -- laisse en texte, pas un texte visible.
export const STATE_DEFS = {
  position: {
    label: 'states.position.label',
    states: [
      { k: 'standing',  l: 'states.position.standing.label',  short: 'states.position.standing.short'  },
      { k: 'crouching', l: 'states.position.crouching.label', short: 'states.position.crouching.short' },
      { k: 'kneeling',  l: 'states.position.kneeling.label',  short: 'states.position.kneeling.short'  },
      { k: 'prone',     l: 'states.position.prone.label',     short: 'states.position.prone.short'     },
    ],
    cost: STATE_TRANSITION_COST.position,
  },
  weapon: {
    label: 'states.weapon.label',
    states: [
      { k: 'holstered', l: 'states.weapon.holstered.label', short: 'states.weapon.holstered.short' },
      { k: 'ready',     l: 'states.weapon.ready.label',     short: 'states.weapon.ready.short'      },
      { k: 'drawn',     l: 'states.weapon.drawn.label',     short: 'states.weapon.drawn.short'      },
    ],
    cost: STATE_TRANSITION_COST.weapon,
  },
  fire_mode: {
    label: 'states.fireMode.label',
    states: [
      { k: 'cc', l: 'states.fireMode.cc.label', short: 'states.fireMode.cc.short' },
      { k: 'rc', l: 'states.fireMode.rc.label', short: 'states.fireMode.rc.short' },
      { k: 'rl', l: 'states.fireMode.rl.label', short: 'states.fireMode.rl.short' },
    ],
    cost: STATE_TRANSITION_COST.fire_mode,
  },
  cover: {
    label: 'states.cover.label',
    states: [
      { k: 'exposed',   l: 'states.cover.exposed.label'   },
      { k: 'partial',   l: 'states.cover.partial.label'   },
      { k: 'important', l: 'states.cover.important.label' },
    ],
    // Aucun cout INI -- flag defensif pur (affecte les tireurs adverses en Phase 2)
    cost: STATE_TRANSITION_COST.cover,
  },
  vitesse: {
    label: 'states.vitesse.label',
    states: [
      { k: 'delayed',  l: 'states.vitesse.delayed.label', special: 'Spécial' },
      { k: 'normal',   l: 'states.vitesse.normal.label'    },
      { k: 'rushed',   l: 'states.vitesse.rushed.label'   },
    ],
    cost: STATE_TRANSITION_COST.vitesse,
  },
}

// Etat suivant dans le cycle des options d'un champ (posture, arme, mode de tir...) — utilise par
// CombatDeclareStateChip (puce click-to-cycle, ex-InlineChip de CombatGmDeclareWindow). `availableKeys`
// restreint le cycle (ex. modes de tir reellement supportes par l'arme equipee) ; si `currentKey`
// n'est pas dans l'ensemble filtre, on repart de la premiere option valide.
export function nextKey(stateKey, currentKey, availableKeys) {
  const allStates = STATE_DEFS[stateKey].states
  const states    = availableKeys ? allStates.filter(s => availableKeys.includes(s.k)) : allStates
  if (states.length === 0) return currentKey
  const idx = states.findIndex(s => s.k === currentKey)
  if (idx === -1) return states[0].k
  return states[(idx + 1) % states.length].k
}

// Adapte les arguments des fenêtres de déclaration (prevStates/nextStates = `decl`, mapActions,
// quick) vers la forme attendue par shared/combatIniCost.js. `nextStates.combatMode` porte le mode
// de combat (Charge/Retraite = déplacement gratuit) — le calcul du coût de déplacement est délégué,
// jamais neutralisé ici par l'appelant (corrige au passage l'aperçu d'une Charge côté MJ).
function toIniParams(prevStates, nextStates, mapActions, quick) {
  const singleAttack = Array.isArray(mapActions?.attack) ? mapActions.attack[0] : mapActions?.attack
  const aimTranches  = singleAttack?.aimTranches ?? 0
  return {
    prevStates,
    nextStates,
    move: mapActions?.move ?? null,
    combatMode: nextStates?.combatMode ?? null,
    aim: aimTranches > 0 ? { aimTranches, lunetteNiveau: singleAttack?.lunetteNiveau ?? 0 } : null,
    quick,
  }
}

// Libellé i18n d'un poste du détail (shared iniDeltaBreakdown). Fonction pure : `t` fourni par
// l'appelant (docs/SYSTEME/LOCALISATION.md §3.1, hors corps de composant — règle des hooks). Les
// zones de déplacement (MOVE_ZONE_DEFS) et libellés d'état (STATE_DEFS) restent côté client : ce
// sont des chaînes d'affichage, pas de la règle métier.
function iniBreakdownLabel(line, t) {
  switch (line.kind) {
    case 'state': {
      const def = STATE_DEFS[line.key]
      const fromKey = def?.states.find(s => s.k === line.from)?.l
      const toKey   = def?.states.find(s => s.k === line.to)?.l
      return t('iniBreakdown.stateTransition', {
        label: t(def.label),
        from: fromKey ? t(fromKey) : line.from,
        to:   toKey   ? t(toKey)   : line.to,
      })
    }
    case 'move': {
      const zone = MOVE_ZONE_DEFS.find(z => z.ini_mod === line.value)
      return zone ? t('iniBreakdown.moveZone', { zone: t(zone.label).toLowerCase() }) : t('actionLabels.move')
    }
    case 'aim':      return t('iniBreakdown.aimedShot', { count: line.count })
    case 'observer': return t('iniBreakdown.observe', { count: line.count })
    case 'reperer':  return t('iniBreakdown.spot', { count: line.count })
    case 'phrase':   return t('iniBreakdown.shortPhrase')
    default:         return ''
  }
}

// Détail INI client — retourne { label, value }[] (indicatif -- recalculé serveur). Le calcul des
// valeurs est délégué à l'autorité partagée (shared/combatIniCost.js) ; ici on ne fait que traduire
// chaque poste. Total et détail viennent donc du même calcul — pas de dérive possible.
export function calcIniBreakdown(prevStates, nextStates, mapActions, quick, t) {
  return iniDeltaBreakdown(toIniParams(prevStates, nextStates, mapActions, quick))
    .map(line => ({ label: iniBreakdownLabel(line, t), value: line.value }))
}

// Delta INI total client (indicatif -- recalculé serveur) = somme du détail partagé.
export function calcIniDelta(prevStates, nextStates, mapActions, quick) {
  return computeIniDelta(toIniParams(prevStates, nextStates, mapActions, quick))
}

// Actions sur la carte -- multi-selection
// l/tooltip = cle i18n namespace combat (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le composant
// consommateur via t(), jamais affichee brute ici. hint inutilise (aucun rendu trouve) -- laisse en
// texte, pas un texte visible.
export const MAP_ACTIONS = [
  { k: 'move',     l: 'mapActions.move.label',     tooltip: 'mapActions.move.tooltip',     hint: 'cliquer destination',          isZoneSelect: true, span2: true },
  { k: 'attack',   l: 'mapActions.attack.label',   tooltip: 'mapActions.attack.tooltip',   hint: 'cliquer cible',                requireWeapon: true },
  { k: 'melee',    l: 'mapActions.melee.label',    tooltip: 'mapActions.melee.tooltip',    hint: 'cliquer adversaire'                                },
  { k: 'reload',   l: 'mapActions.reload.label',   tooltip: 'mapActions.reload.tooltip',                                                             span2: true          },
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
