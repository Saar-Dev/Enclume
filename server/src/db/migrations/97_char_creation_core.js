// 97_char_creation_core.js
// PrÃ©requis wizard crÃ©ation : ambiance campagne, rÃ¨gles, ledger PC, enrichissement gÃ©notypes.
// Source : PLAN_E1+2.md Â§5 "MIGRATION 096" â€” converti ESM â†’ CJS, renommÃ© 097.

export const up = async (knex) => {
  // === campaigns : ambiance ===
  await knex.schema.alterTable('campaigns', (table) => {
    table.text('ambiance').defaultTo('INTERMEDIAIRE')
  })

  // === campaign_rules : options de rÃ¨gles par campagne ===
  await knex.schema.createTable('campaign_rules', (table) => {
    table.uuid('campaign_id')
      .primary()
      .references('id').inTable('campaigns')
      .onDelete('CASCADE')
    table.boolean('option_feminin_bonus').defaultTo(false)
    table.boolean('option_mutations_aleatoires').defaultTo(false)
    table.boolean('option_polaris_latent').defaultTo(false)
    table.boolean('option_niveau_max_competences').defaultTo(false)
    table.boolean('option_personnages_experimentes').defaultTo(false)
    table.boolean('option_personnages_jeunes').defaultTo(false)
    table.boolean('option_avantages_pro_aleatoires').defaultTo(false)
  })

  // === char_sheet : state machine wizard ===
  await knex.schema.alterTable('char_sheet', (table) => {
    table.text('creation_state').defaultTo(null)
  })

  // === char_pc_ledger : singleton par personnage ===
  await knex.schema.dropTableIfExists('char_pc_ledger')
  await knex.schema.createTable('char_pc_ledger', (table) => {
    table.uuid('char_sheet_id')
      .primary()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE')
    table.integer('pc_total').notNullable().defaultTo(20)
    table.integer('pc_spent_step1').defaultTo(0)
    table.integer('pc_spent_step2').defaultTo(0)
    table.integer('pc_spent_step3').defaultTo(0)
    table.integer('pc_spent_step4').defaultTo(0)
    table.integer('pc_spent_step5').defaultTo(0)
    table.integer('pc_gained_desavantages').defaultTo(0)
  })

  // === ref_genotypes : colonnes informatives wizard Ã©tape 2 ===
  await knex.schema.alterTable('ref_genotypes', (table) => {
    table.text('description')
    table.text('illustration_url')
    table.jsonb('prereq_professions').defaultTo(null)
    table.integer('pc_cost').defaultTo(0)
    table.boolean('has_deserter_option').defaultTo(false)
  })

  // Seeds : description + coÃ»t PC + option dÃ©serteur des 4 gÃ©notypes
  await knex('ref_genotypes').where('id', 'HUMAIN').update({
    description: 'Humain normal. Aucune modification des Attributs. Aucun Avantage ni DÃ©savantage spÃ©cifique.',
    pc_cost: 0,
    has_deserter_option: false,
  })
  await knex('ref_genotypes').where('id', 'HYB_NAT').update({
    description: "Hybride naturel. NÃ© avec les mutations nÃ©cessaires Ã  la survie sous-marine. Le plus avantagÃ© sous l'eau, le plus dÃ©savantagÃ© au sec.",
    pc_cost: 5,
    has_deserter_option: false,
  })
  await knex('ref_genotypes').where('id', 'GEN_HYB').update({
    description: "GÃ©no-hybride. Humain transformÃ© par la technologie du Culte du Trident. Apparence prÃ©servÃ©e, adaptation aquatique sans mutation visible.",
    pc_cost: 5,
    prereq_professions: JSON.stringify([{ profession_id: 'culte_trident_gsi', years: 1 }]),
    has_deserter_option: false,
  })
  await knex('ref_genotypes').where('id', 'TEC_HYB').update({
    description: "Techno-hybride. Individu modifiÃ© par l'HÃ©gÃ©monie, souvent contre son grÃ©. Attributs physiques grandement augmentÃ©s mais atrocement dÃ©figurÃ©.",
    pc_cost: 5,
    prereq_professions: JSON.stringify([
      { profession_id: 'soldat_milicien', years: 2 },
      { profession_id: 'techno_hybride', years: 1 },
    ]),
    has_deserter_option: true,
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('ambiance')
  })
  await knex.schema.dropTableIfExists('campaign_rules')
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('creation_state')
  })
  await knex.schema.dropTableIfExists('char_pc_ledger')
  await knex.schema.alterTable('ref_genotypes', (table) => {
    table.dropColumn('description')
    table.dropColumn('illustration_url')
    table.dropColumn('prereq_professions')
    table.dropColumn('pc_cost')
    table.dropColumn('has_deserter_option')
  })
}
