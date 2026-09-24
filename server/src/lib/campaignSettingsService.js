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
  // Défaut passé `true` → `false` (demande Saar 2026-08-28) : les PNJ suivent leurs munitions comme
  // un PJ par défaut. Départ assumé de la convention « garder le défaut aligné sur le comportement
  // existant » (cf. status_effects_mode / encumbrance_enabled) : une campagne sans réglage explicite
  // passe donc au suivi. Impact réel limité — `hasEnoughAmmo` (shared/ammoRules.js) rend `true` dès
  // que `ammo_remaining` est NULL (arme PNJ non initialisée), seuls les PNJ à munitions explicitement
  // renseignées sont désormais limités.
  pnj_unlimited_ammo:    { type: 'boolean', default: false },
  reload_mode:           { type: 'string',  default: 'magazine', enum: ['magazine', 'topup'] },
  action_timer_sec:      { type: 'number',  default: 0 },
  shock_auto_stun:       { type: 'boolean', default: true },
  allow_los_cancel:      { type: 'boolean', default: false },
  // PLAN 14 Sprint 14-3 — défaut 'enforced' : le guard stunned/unconscious tournait déjà sans
  // condition sur toutes les campagnes existantes, un défaut différent changerait silencieusement
  // leur comportement (même raisonnement que encumbrance_enabled ci-dessus).
  status_effects_mode:   { type: 'string',  default: 'enforced', enum: ['off', 'icon_only', 'enforced'] },
  // Qui pose/retire les statuts d'un token (TOKEN_STATUS_TOGGLE). Défaut `true` : le propriétaire du
  // token pouvait déjà basculer ses statuts avant cette option (socketToken.js), un défaut différent
  // changerait silencieusement le comportement des campagnes existantes. `false` : MJ seul.
  // Indépendant de status_effects_mode (affichage/application des effets, pas les droits).
  players_edit_statuses: { type: 'boolean', default: true },
  // Modificateurs de combat (taille de la cible + allure tireur/cible). Défaut `auto` : Enclume
  // automatise (taille dérivée de la fiche cible, allure du mouvement déclaré ; joueur en lecture
  // seule, MJ garde la main). `libre` : joueur ET MJ choisissent tout à la main, fallback neutre
  // (0), aucune dérivation, aucun blocage automatique. La portée n'est PAS concernée (toujours
  // autoritaire serveur depuis la distance des tokens). docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md.
  combat_modifiers_mode: { type: 'string',  default: 'auto', enum: ['libre', 'auto'] },
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
  // Drones — Sprint 2d (docs/PLANS/PLAN_DRONE.md §4). `classique` : un drone occupe son propre slot
  // d'ANNONCE, déclaration manuelle par son propriétaire/le MJ, comportement Sprint 2c inchangé.
  // `ordres_permanents` : le drone ne déclare jamais, exécute automatiquement la dernière cible/arme
  // mémorisée dès le début de l'ANNONCE. **Deux réglages distincts** (retour Saar en testant,
  // 2026-09-17 — remplace un unique `drone_turn_model` initial) : `_gm` s'applique à un drone sans
  // propriétaire joueur (`characters.user_id IS NULL`, style PNJ) ; `_player` à un drone assigné à un
  // joueur — un MJ peut ainsi garder ses propres drones en `classique` pendant que les joueurs jouent
  // les leurs en `ordres_permanents` (ou l'inverse). Lus à COMBAT_START puis figés sur
  // `combat_state.drone_turn_model_gm`/`_player` pour toute la durée du combat — même patron que
  // `action_timer_sec`, jamais de bascule à chaud. Défaut `classique` sur les deux : mécanique neuve,
  // aucun combat existant ne doit changer de comportement silencieusement. `drone_targeting_mode` ne
  // s'applique qu'en `ordres_permanents` (`assigne` : cible choisie par un humain via
  // COMBAT_DRONE_SET_ORDERS ; `spatial` : recherche automatique — design posé, non codé, cf.
  // PLAN_DRONE.md « Mode spatial ») — reste un réglage unique, la distinction MJ/joueur ne concerne
  // que QUI décide du tour, pas COMMENT la cible est choisie une fois en ordres permanents.
  drone_turn_model_gm:     { type: 'string', default: 'classique', enum: ['classique', 'ordres_permanents'] },
  drone_turn_model_player: { type: 'string', default: 'classique', enum: ['classique', 'ordres_permanents'] },
  drone_targeting_mode:    { type: 'string', default: 'assigne',   enum: ['assigne', 'spatial'] },
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
