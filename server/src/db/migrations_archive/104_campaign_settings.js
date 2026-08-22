// Consolide les colonnes plates de campagne (ambiance, pnj_unlimited_ammo, reload_mode,
// action_timer_sec, shock_auto_stun, allow_los_cancel) + les 11 nouvelles options
// dans une unique colonne JSONB `settings`. Supprime la table morte campaign_rules (migration 97,
// jamais référencée ailleurs — vérifié par grep global).
// dice_config et default_token_glb_url restent des colonnes dédiées (hors scope de cette migration).

export const up = async (knex) => {
  await knex.schema.dropTableIfExists('campaign_rules')

  await knex.schema.alterTable('campaigns', (table) => {
    table.jsonb('settings').notNullable().defaultTo('{}')
  })

  const campaigns = await knex('campaigns').select('id', 'ambiance', 'pnj_unlimited_ammo', 'reload_mode', 'action_timer_sec', 'shock_auto_stun', 'allow_los_cancel')
  for (const c of campaigns) {
    await knex('campaigns').where('id', c.id).update({
      settings: JSON.stringify({
        ambiance: c.ambiance ?? 'INTERMEDIAIRE',
        feminin_bonus: false,
        random_mutations: true,
        polaris_latent: false,
        random_pro_advantages: true,
        revers: false,
        skill_prerequisites: false,
        skill_max_level: false,
        skill_natural_prog: false,
        young_penalty: false,
        celebrity: false,
        pnj_unlimited_ammo: c.pnj_unlimited_ammo ?? true,
        reload_mode: c.reload_mode ?? 'magazine',
        action_timer_sec: c.action_timer_sec ?? 0,
        shock_auto_stun: c.shock_auto_stun ?? true,
        allow_los_cancel: c.allow_los_cancel ?? false,
      }),
    })
  }

  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('ambiance')
    table.dropColumn('pnj_unlimited_ammo')
    table.dropColumn('reload_mode')
    table.dropColumn('action_timer_sec')
    table.dropColumn('shock_auto_stun')
    table.dropColumn('allow_los_cancel')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.text('ambiance').defaultTo('INTERMEDIAIRE')
    table.boolean('pnj_unlimited_ammo').defaultTo(true)
    table.text('reload_mode').defaultTo('magazine')
    table.integer('action_timer_sec').defaultTo(0)
    table.boolean('shock_auto_stun').defaultTo(true)
    table.boolean('allow_los_cancel').defaultTo(false)
  })

  const campaigns = await knex('campaigns').select('id', 'settings')
  for (const c of campaigns) {
    const s = c.settings ?? {}
    await knex('campaigns').where('id', c.id).update({
      ambiance: s.ambiance ?? 'INTERMEDIAIRE',
      pnj_unlimited_ammo: s.pnj_unlimited_ammo ?? true,
      reload_mode: s.reload_mode ?? 'magazine',
      action_timer_sec: s.action_timer_sec ?? 0,
      shock_auto_stun: s.shock_auto_stun ?? true,
      allow_los_cancel: s.allow_los_cancel ?? false,
    })
  }

  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('settings')
  })

  await knex.schema.createTable('campaign_rules', (table) => {
    table.uuid('campaign_id').primary().references('id').inTable('campaigns').onDelete('CASCADE')
    table.boolean('option_feminin_bonus').defaultTo(false)
    table.boolean('option_mutations_aleatoires').defaultTo(false)
    table.boolean('option_polaris_latent').defaultTo(false)
    table.boolean('option_niveau_max_competences').defaultTo(false)
    table.boolean('option_personnages_experimentes').defaultTo(false)
    table.boolean('option_personnages_jeunes').defaultTo(false)
    table.boolean('option_avantages_pro_aleatoires').defaultTo(false)
  })
}
