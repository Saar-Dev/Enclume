export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE campaigns
      ADD COLUMN default_token_glb_url TEXT
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE campaigns
      DROP COLUMN default_token_glb_url
  `)
}
