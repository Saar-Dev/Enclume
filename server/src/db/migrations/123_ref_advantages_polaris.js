// Migration 123 — Force Polaris (OPT-04, Lot A PLAN_ADVANTAGESPANEL.md)
// 3 lignes ref_advantages liées à la Force Polaris. House-rule assumé par Saar, pas une
// mécanique automatisée retrouvée telle quelle dans REGLE_CREATION.txt (narratif/MJ, comme
// adv_050 "Ennemi héréditaire") — aucun mod_* renseigné.
// family_limit: 1 répété identique sur les 3 lignes (family partagée "Polaris") : la contrainte
// family_limit lit ce champ sur la ligne achetée, pas une config globale — l'oublier sur une des
// trois casserait l'exclusion mutuelle selon l'ordre d'achat.

const ADVANTAGES = [
  {
    advantage_id: 'adv_077',
    name: 'Polaris latent',
    type: 'advantage',
    description: "La Force Polaris sommeille chez le personnage, qui en est totalement inconscient. Le MJ décide seul du réveil, jamais libérable volontairement.",
    cost_pc: 3,
    is_unique: false,
    family: 'Polaris', family_limit: 1, subtype: null,
    mod_attribute: null, mod_value: null,
    mod_resistance: null, mod_res_value: null,
    mod_conditions: null,
    mod_gauges: null,
    mod_identity: null,
    mod_savings: null,
    mod_monthly_income: null,
    mod_monthly_income_formula: null,
    mod_skill_points: null,
    mod_age: null,
    special_rule: "Réveil décidé exclusivement par le MJ. Une libération accidentelle reste toujours possible.",
  },
  {
    advantage_id: 'adv_078',
    name: 'Polaris non maîtrisé',
    type: 'advantage',
    description: "Le personnage manifeste des pouvoirs du Polaris sans jamais avoir réussi à les maîtriser. 2 pouvoirs tirés aléatoirement, pas d'accès à Maîtrise de la Force Polaris — activation incontrôlée uniquement.",
    cost_pc: 3,
    is_unique: false,
    family: 'Polaris', family_limit: 1, subtype: null,
    mod_attribute: null, mod_value: null,
    mod_resistance: null, mod_res_value: null,
    mod_conditions: null,
    mod_gauges: null,
    mod_identity: null,
    mod_savings: null,
    mod_monthly_income: null,
    mod_monthly_income_formula: null,
    mod_skill_points: null,
    mod_age: null,
    special_rule: "2 pouvoirs tirés aléatoirement. Pas d'accès à Maîtrise de la Force Polaris. Activation incontrôlée uniquement.",
  },
  {
    advantage_id: 'adv_079',
    name: 'Force Polaris',
    type: 'advantage',
    description: "Le personnage a pleinement accès à la Force Polaris.",
    cost_pc: 5,
    is_unique: false,
    family: 'Polaris', family_limit: 1, subtype: null,
    mod_attribute: null, mod_value: null,
    mod_resistance: null, mod_res_value: null,
    mod_conditions: null,
    mod_gauges: null,
    mod_identity: null,
    mod_savings: null,
    mod_monthly_income: null,
    mod_monthly_income_formula: null,
    mod_skill_points: null,
    mod_age: null,
    special_rule: "Débloque l'accès aux compétences Force Polaris sur la fiche personnage.",
  },
]

export const up = async (knex) => {
  await knex('ref_advantages').insert(ADVANTAGES)
}

export const down = async (knex) => {
  await knex('ref_advantages').whereIn('advantage_id', ['adv_077', 'adv_078', 'adv_079']).del()
}
