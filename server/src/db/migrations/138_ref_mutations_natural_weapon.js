// 138_ref_mutations_natural_weapon.js
// Arme naturelle (Griffes/Crocs/Corne/Excroissance osseuse) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B.
// ref_mutations : colonnes structurées (pas de texte libre special_effect parsé à la volée).
// combat_actions : miroir exact de weapon_inv_id (54_combat.js) / aim_bonus_comp (migration 134) —
// nécessaire pour que resolveMeleeAction relise le choix fait en Phase 1 (déclaration).

const NATURAL_WEAPONS = [
  { name: 'Griffes',                          formula: '1D10+3', requiresGrapple: false },
  { name: 'Excroissance osseuse rétractable', formula: '2D10',   requiresGrapple: false },
  { name: 'Crocs',                            formula: '1D10+3', requiresGrapple: true },
  { name: 'Corne',                            formula: '1D10',   requiresGrapple: true },
]

export const up = async (knex) => {
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.string('natural_weapon_formula', 20).nullable()
    table.boolean('natural_weapon_requires_grapple').notNullable().defaultTo(false)
  })

  for (const { name, formula, requiresGrapple } of NATURAL_WEAPONS) {
    await knex('ref_mutations')
      .where({ name })
      .update({ natural_weapon_formula: formula, natural_weapon_requires_grapple: requiresGrapple })
  }

  await knex.schema.alterTable('combat_actions', (table) => {
    table.uuid('natural_weapon_char_mutation_id').nullable()
      .references('id').inTable('char_mutations').onDelete('SET NULL')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('natural_weapon_char_mutation_id')
  })
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.dropColumn('natural_weapon_formula')
    table.dropColumn('natural_weapon_requires_grapple')
  })
}
