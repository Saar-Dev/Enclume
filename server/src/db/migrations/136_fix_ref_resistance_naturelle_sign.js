// 136_fix_ref_resistance_naturelle_sign.js
// Corrige un bug de signe dans les données sources ref_advantages/ref_mutations pour la famille
// Résistance naturelle (poison/maladie/radiation/drogue) — docs/PLAN_RESNAT.md.
//
// Règle confirmée par Saar : Seuil = Intensité − Modificateur (Test différé, non implémenté ici).
// calcResistanceNaturelle(result_na) (LdB p.114) donne un Modificateur d'autant plus GRAND que
// l'attribut est FAIBLE (ex. CON basse → +6). Donc un Modificateur plus grand DÉGRADE le Seuil.
// Toute donnée censée AMÉLIORER la résistance doit porter un delta NÉGATIF, pas positif.
//
// 6 lignes trouvées en contradiction avec leur propre texte LdB (docs/Character/Creation/
// REGLE_MUTATION.md), vérifiées en base réelle avant cette migration — toutes stockées avec un
// delta positif alors que leur effet narratif est une amélioration :
//   - ref_advantages adv_031-034 "Résistance naturelle augmentée" : "améliorée de 2 points"
//   - ref_mutations 36-39 "Résistance naturelle" (poison/maladie/radiation/drogue) : "augmentée de
//     3 points", stack "+1 par stack"
//   - ref_mutations 30 "Purulence" : "Résistance aux maladies... augmentée de 3 points", stack "+2"
//   - ref_mutations 8 "Contagion" : "totalement immunisé" (sentinelle 9999) — cas le plus parlant,
//     avec le bug un personnage "immunisé" aurait Seuil = Intensité − 9999 (toujours négatif) et
//     échouerait donc SYSTÉMATIQUEMENT, l'exact opposé de la règle.
// Lignes déjà correctes (non touchées) : adv_051-054 "Faiblesse naturelle" (+2, déjà littéral et
// cohérent avec leur texte) ; domaine Dommages/Choc (adv_018/adv_030/adv_060, "Squelette renforcé")
// — application directe sans la soustraction Intensité−Modificateur, pas concerné par cette inversion.
//
// Divergence de nommage corrigée dans la foulée : ref_advantages utilise la clé "drug" (singulier,
// adv_034/adv_054) alors que ref_mutations/char_mutation_effects_view utilisent mod_res_drugs
// (pluriel) pour le même sous-type — normalisé vers "drugs" partout (mod_resistance + subtype,
// colonne subtype vérifiée non consommée ailleurs dans le code, aucun risque).
//
// Impact réel : [VÉRIFIÉ] en base — 0 ligne char_advantages/char_mutations n'a jamais référencé
// ces 8 advantage_id ni ces mutation_id 8/30/36-39 avec un sous-type concerné. Aucun code
// applicatif ne lit encore ces colonnes (grep exhaustif, session précédente). Zéro régression
// possible — c'est le moment de corriger la donnée, avant tout premier consommateur (docs/PLAN_RESNAT.md).

const ADVANTAGE_SIGN_FIX = ['adv_031', 'adv_032', 'adv_033', 'adv_034']
const ADVANTAGE_KEY_NORMALIZE = ['adv_034', 'adv_054']

const MUTATION_RESNAT_FIX = [
  { subtype: 'drugs',     col: 'mod_res_drugs' },
  { subtype: 'disease',   col: 'mod_res_disease' },
  { subtype: 'poison',    col: 'mod_res_poison' },
  { subtype: 'radiation', col: 'mod_res_radiation' },
]

export const up = async (knex) => {
  await knex('ref_advantages').whereIn('advantage_id', ADVANTAGE_SIGN_FIX)
    .update({ mod_res_value: -2 })
  await knex('ref_advantages').whereIn('advantage_id', ADVANTAGE_KEY_NORMALIZE)
    .update({ mod_resistance: 'drugs', subtype: 'drugs' })

  await knex('ref_mutations').where({ mutation_id: 30 }) // Purulence
    .update({ mod_res_disease: -3, stack_deltas: JSON.stringify({ mod_PRE: -1, mod_res_disease: -2 }) })
  await knex('ref_mutations').where({ mutation_id: 8 })  // Contagion
    .update({ mod_res_disease: -9999 })

  for (const { subtype, col } of MUTATION_RESNAT_FIX) {
    await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype })
      .update({ [col]: -3, stack_deltas: JSON.stringify({ [col]: -1 }) })
  }
}

export const down = async (knex) => {
  await knex('ref_advantages').whereIn('advantage_id', ADVANTAGE_SIGN_FIX)
    .update({ mod_res_value: 2 })
  await knex('ref_advantages').whereIn('advantage_id', ADVANTAGE_KEY_NORMALIZE)
    .update({ mod_resistance: 'drug', subtype: 'drug' })

  await knex('ref_mutations').where({ mutation_id: 30 })
    .update({ mod_res_disease: 3, stack_deltas: JSON.stringify({ mod_PRE: -1, mod_res_disease: 2 }) })
  await knex('ref_mutations').where({ mutation_id: 8 })
    .update({ mod_res_disease: 9999 })

  for (const { subtype, col } of MUTATION_RESNAT_FIX) {
    await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype })
      .update({ [col]: 3, stack_deltas: JSON.stringify({ [col]: 1 }) })
  }
}
