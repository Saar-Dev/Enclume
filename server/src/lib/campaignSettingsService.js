// Source unique de vérité pour les options de campagne stockées en JSONB (campaigns.settings).
// Réutilisé par la route PUT /campaigns/:id (validation) et par tout consommateur combat (lecture).

export const SETTINGS_SCHEMA = {
  ambiance:              { type: 'string',  default: 'INTERMEDIAIRE', enum: ['REALISTE', 'INTERMEDIAIRE', 'HEROIQUE'] },
  feminin_bonus:         { type: 'boolean', default: false },
  random_mutations:      { type: 'boolean', default: true },
  polaris_latent:        { type: 'boolean', default: false },
  random_pro_advantages: { type: 'boolean', default: true },
  revers:                { type: 'boolean', default: false },
  skill_prerequisites:   { type: 'boolean', default: false },
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
}

const DEFAULT_SETTINGS = Object.fromEntries(
  Object.entries(SETTINGS_SCHEMA).map(([key, def]) => [key, def.default])
)

/**
 * Lit campaigns.settings et retourne l'objet mergé avec les defaults du schéma —
 * garantit que toute clé absente du JSONB (campagne créée avant l'ajout d'une option) a sa valeur par défaut.
 */
export async function getCampaignSettings(db, campaignId) {
  const row = await db('campaigns').where({ id: campaignId }).select('settings').first()
  return { ...DEFAULT_SETTINGS, ...(row?.settings ?? {}) }
}
