// Source unique de vérité pour les options de campagne stockées en JSONB (campaigns.settings).
// Réutilisé par la route PUT /campaigns/:id (validation) et par tout consommateur combat (lecture).

export const SETTINGS_SCHEMA = {
  ambiance:              { type: 'string',  default: 'INTERMEDIAIRE', enum: ['REALISTE', 'INTERMEDIAIRE', 'HEROIQUE'] },
  feminin_bonus:         { type: 'boolean', default: false },
  random_mutations:      { type: 'boolean', default: true },
  polaris_latent:        { type: 'boolean', default: false },
  random_pro_advantages: { type: 'boolean', default: true },
  revers:                { type: 'boolean', default: false },
  // OPT-07 — LdB p.190 la présente comme une règle "NÉCESSAIRE (OPTIONNEL)" : le défaut RAW du jeu
  // est donc actif, contrairement aux options qui simplifient une règle non marquée optionnelle
  // dans le livre. docs/BUG WIZARD.md #7 : le mécanisme (serveur + client, calcSkillTotal partagé)
  // était déjà correct, seul ce défaut était en désaccord avec le RAW.
  skill_prerequisites:   { type: 'boolean', default: true },
  skill_max_level:       { type: 'boolean', default: false },
  skill_natural_prog:    { type: 'boolean', default: false },
  young_penalty:         { type: 'boolean', default: false },
  celebrity:             { type: 'boolean', default: false },
  pnj_unlimited_ammo:    { type: 'boolean', default: true },
  reload_mode:           { type: 'string',  default: 'magazine', enum: ['magazine', 'topup'] },
  action_timer_sec:      { type: 'number',  default: 0 },
  shock_auto_stun:       { type: 'boolean', default: true },
  allow_los_cancel:      { type: 'boolean', default: false },
  // PLAN 14 Sprint 14-3 — défaut 'enforced' : le guard stunned/unconscious tournait déjà sans
  // condition sur toutes les campagnes existantes, un défaut différent changerait silencieusement
  // leur comportement (même raisonnement que encumbrance_enabled ci-dessus).
  status_effects_mode:   { type: 'string',  default: 'enforced', enum: ['off', 'icon_only', 'enforced'] },
  // Encombrement (règle maison, docs/PLAN_MUTATION2.md Lot 1) — défauts à true/3 : la mécanique
  // est déjà active sans aucun gate aujourd'hui, un défaut différent changerait silencieusement
  // le comportement de toutes les campagnes existantes.
  encumbrance_enabled:    { type: 'boolean', default: true },
  encumbrance_multiplier: { type: 'number',  default: 3 },
  // Horloge de campagne (docs/PLAN_FATIGUE_DOMMAGES.md §7, Lot 1) — point de départ du calendrier
  // de jeu (Jour/Mois/Année, 31j/mois fixes, pas de bissextile). Défaut 1/1/1 : origine neutre,
  // sans effet tant que le MJ ne configure/n'avance jamais l'horloge (game_time_minutes reste à 0).
  calendar_start_year:  { type: 'number', default: 1 },
  calendar_start_month: { type: 'number', default: 1 },
  calendar_start_day:   { type: 'number', default: 1 },
  // Fatigue (règle avancée optionnelle, docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4) — défaut `false`
  // (mécanique neuve, contrairement à encumbrance_enabled qui tournait déjà sans gate) : aucun malus
  // appliqué, aucune entrée UI visible tant que le MJ ne l'active pas explicitement.
  fatigue_enabled: { type: 'boolean', default: false },
}

/**
 * Projette un objet settings (partiel, brut depuis campaigns.settings JSONB) sur exactement les
 * clés de SETTINGS_SCHEMA : clé absente → défaut, clé parasite (schéma passé, JSONB jamais purgé)
 * → filtrée. Ne jamais remplacer par un simple spread `{...defaults, ...settings}` : une clé
 * parasite round-tripperait jusqu'au client puis reviendrait sur PUT /campaigns/:id, que la
 * validation par clé (`campaigns.js`) rejette explicitement (AppError "Clé settings inconnue").
 */
export function mergeWithDefaults(settings) {
  return Object.fromEntries(
    Object.keys(SETTINGS_SCHEMA).map(key => [key, settings?.[key] ?? SETTINGS_SCHEMA[key].default])
  )
}

/**
 * Lit campaigns.settings et retourne l'objet mergé avec les defaults du schéma —
 * garantit que toute clé absente du JSONB (campagne créée avant l'ajout d'une option) a sa valeur par défaut.
 */
export async function getCampaignSettings(db, campaignId) {
  const row = await db('campaigns').where({ id: campaignId }).select('settings').first()
  return mergeWithDefaults(row?.settings)
}
