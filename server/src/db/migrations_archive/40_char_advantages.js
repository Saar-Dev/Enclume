/**
 * Migration 40 — char : table char_advantages + linked_skill_id sur ref_mutations
 *
 * 1. Crée la table char_advantages — stocke mutations ET texte libre par personnage.
 *    type = 'MUTATION' : référence ref_mutations via muta_numero.
 *    type = 'OTHER'    : texte libre, champ label uniquement.
 *
 * 2. Ajoute la colonne linked_skill_id sur ref_mutations.
 *    Lien entre une mutation et la compétence spéciale qu'elle débloque.
 *    Nullable — 24 mutations n'ont pas de compétence liée.
 *
 * 3. Peuple linked_skill_id pour les 9 mutations qui ont une compétence associée.
 *    Source de vérité : journalChantier_FichePerso.md session courante.
 *
 * down : supprime linked_skill_id de ref_mutations, supprime char_advantages.
 */

// Liens mutation → skill — 9 entrées confirmées
const MUTATION_SKILL_LINKS = [
  { muta_numero: 'muta_026', linked_skill_id: 'MUTATION_AGILITE_CAUDALE'      },
  { muta_numero: 'muta_011', linked_skill_id: 'MUTATION_CONTAGION'            },
  { muta_numero: 'muta_019', linked_skill_id: 'MUTATION_CONTROLE_MOLECULAIRE' },
  { muta_numero: 'muta_016', linked_skill_id: 'MUTATION_EMPATHIE'             },
  { muta_numero: 'muta_020', linked_skill_id: 'MUTATION_METAMORPHOSE'         },
  { muta_numero: 'muta_025', linked_skill_id: 'MUTATION_PURULENCE'            },
  { muta_numero: 'muta_033', linked_skill_id: 'MUTATION_RADIATIONS'           },
  { muta_numero: 'muta_031', linked_skill_id: 'MUTATION_SONAR'                },
  // muta_029 débloque deux compétences — MAITRISE_DE_LA_FORCE_POLARIS est le lien principal.
  // MAITRISE_DE_LECHO_POLARIS est géré côté client (règle métier documentée PC13).
  { muta_numero: 'muta_029', linked_skill_id: 'MAITRISE_DE_LA_FORCE_POLARIS'  },
]

export const up = async (knex) => {
  // 1. Créer char_advantages
  await knex.schema.createTable('char_advantages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id')
      .notNullable()
      .references('id')
      .inTable('char_sheet')
      .onDelete('CASCADE')
    table.text('type').notNullable()
      // 'MUTATION' | 'OTHER'
    table.text('muta_numero')
      .nullable()
      .references('muta_numero')
      .inTable('ref_mutations')
      .onDelete('CASCADE')
    table.text('label').nullable()
    table.integer('level').defaultTo(1)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Contrainte : muta_numero obligatoire si MUTATION, label obligatoire si OTHER
    // Gérée côté application — le schéma reste flexible pour simplifier les migrations futures.
  })

  // 2. Ajouter linked_skill_id sur ref_mutations
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.text('linked_skill_id').nullable()
    // Pas de FK vers ref_skills — ref_mutations est une table de référence statique
    // et ref_skills peut évoluer indépendamment. Lien documenté, pas enforced.
  })

  // 3. Peupler linked_skill_id
  for (const link of MUTATION_SKILL_LINKS) {
    await knex('ref_mutations')
      .where({ muta_numero: link.muta_numero })
      .update({ linked_skill_id: link.linked_skill_id })
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_advantages')
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.dropColumn('linked_skill_id')
  })
}
