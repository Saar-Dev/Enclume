import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './254_exo_sheet_base_stats.js'
import { assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const COPIED_COLUMNS = [
  'category', 'environment', 'depth_operational', 'depth_limit', 'depth_crush',
  'base_exoforce', 'base_blindage', 'base_speed_underwater', 'base_speed_surface',
  'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
  'malus_init_underwater', 'malus_init_surface',
  'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
]
const NEW_NARRATIVE_COLUMNS = ['taille', 'type_batterie', 'type_coque']
const ALL_COLUMNS = [...COPIED_COLUMNS, ...NEW_NARRATIVE_COLUMNS]

const CONSTRAINTS = [
  'chk_exo_sheet_category', 'chk_exo_sheet_environment',
  'chk_exo_sheet_underwater_mode', 'chk_exo_sheet_surface_mode',
]

// Fixture minimale — juste assez pour satisfaire la FK exo_sheet.character_id (patron
// exoAvarieService.test.mjs#createExoFixture, réduit à ce dont ce fichier a besoin).
async function createCharacter() {
  const [gm] = await db('users')
    .insert({ email: `mig254-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'mig254-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test migration 254', invite_code: `MIG254-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test migration 254', type: 'exo' })
    .returning('*')
  return {
    gm, campaign, character,
    async cleanup() {
      await db('campaigns').where({ id: campaign.id }).del()
      await db('users').where({ id: gm.id }).del()
    },
  }
}

// Tourne toujours (patron SCHEMADRIFT-EXOTEMPLATES1, testHelpers/schemaAssertions.mjs).
test('schéma réel — exo_sheet porte les 22 colonnes/4 contraintes de la migration 254', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'exo_sheet', ALL_COLUMNS)
  for (const constraint of CONSTRAINTS) {
    await assertConstraintExists(db, 'exo_sheet', constraint)
  }
})

test('migration 254 ajoute les colonnes de base éditable sur exo_sheet et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_sheet', 'category')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    for (const col of ALL_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('exo_sheet', col), true, `colonne ${col} absente`)
    }

    await down(trx)
    for (const col of ALL_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('exo_sheet', col), false, `colonne ${col} toujours présente après down`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Cas dédié au backfill (PLAN_EXOARMURE.md §13.3, "pas seulement un test sur une base vierge, qui ne
// l'aurait jamais exercé") : une ligne exo_sheet avec template_id déjà assigné AVANT up() doit
// ressortir avec les 19 champs copiés correctement après.
test('migration 254 — backfill : une exo_sheet avec template_id déjà assigné hérite des 19 champs du modèle', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_sheet', 'category')
  if (alreadyApplied) return

  const fx = await createCharacter()
  try {
    await assert.rejects(db.transaction(async (trx) => {
      const [template] = await trx('ref_exo_templates')
        .insert({
          name: 'Modèle test backfill 254', category: 'exo-3', environment: 'hybrid',
          depth_operational: 100, depth_limit: 150, depth_crush: 200,
          base_exoforce: 55, base_blindage: 28,
          base_speed_underwater: 12, base_speed_surface: 8,
          underwater_movement_mode: 'vit', surface_movement_mode: 'pilot',
          speeds_extra: JSON.stringify([{ label: 'propulseur', value: 20 }]),
          malus_init_underwater: -2, malus_init_surface: -1,
          manufacturer: 'Test Manufacture', price: 12000, rarity: 'Rare',
          tech_level: 'III-IV', autonomy: '48h',
        })
        .returning('*')
      await trx('exo_sheet').insert({ character_id: fx.character.id, template_id: template.id })

      await up(trx)

      const backfilled = await trx('exo_sheet').where({ character_id: fx.character.id }).first()
      for (const col of COPIED_COLUMNS) {
        assert.deepEqual(
          backfilled[col], template[col],
          `${col} n'a pas été correctement backfillé depuis le template (attendu ${JSON.stringify(template[col])}, obtenu ${JSON.stringify(backfilled[col])})`,
        )
      }
      for (const col of NEW_NARRATIVE_COLUMNS) {
        assert.equal(backfilled[col], null, `${col} doit rester NULL — aucune source sur ref_exo_templates`)
      }

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  } finally {
    await fx.cleanup()
  }
})

// Une violation de contrainte CHECK avorte la transaction Postgres en cours — testée séparément par
// contrainte (même caution que 243_ref_exo_templates_movement_and_commerce.test.mjs).
const checks = [
  { column: 'category', constraint: 'chk_exo_sheet_category', badValue: 'exo-inconnue' },
  { column: 'environment', constraint: 'chk_exo_sheet_environment', badValue: 'lunaire' },
  { column: 'underwater_movement_mode', constraint: 'chk_exo_sheet_underwater_mode', badValue: 'fly' },
  { column: 'surface_movement_mode', constraint: 'chk_exo_sheet_surface_mode', badValue: 'fly' },
]

for (const { column, constraint, badValue } of checks) {
  test(`la contrainte ${constraint} refuse une valeur hors énumération (NULL reste accepté)`, {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const alreadyApplied = await db.schema.hasColumn('exo_sheet', 'category')
    if (alreadyApplied) return

    const fx = await createCharacter()
    try {
      await assert.rejects(db.transaction(async (trx) => {
        await up(trx)

        await assert.rejects(
          trx('exo_sheet').insert({ character_id: fx.character.id, [column]: badValue }),
          new RegExp(constraint),
          `la contrainte ${constraint} doit refuser une valeur hors énumération`,
        )

        throw new Error('ROLLBACK_MIGRATION_TEST')
      }), /ROLLBACK_MIGRATION_TEST/)
    } finally {
      await fx.cleanup()
    }
  })
}

test('migration 254 — colonnes nullables sans défaut : une exo_sheet neuve reste "non configurée" (category NULL)', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_sheet', 'category')
  if (alreadyApplied) return

  const fx = await createCharacter()
  try {
    await assert.rejects(db.transaction(async (trx) => {
      await up(trx)

      const [row] = await trx('exo_sheet').insert({ character_id: fx.character.id }).returning('*')
      assert.equal(row.category, null)
      for (const col of ALL_COLUMNS) {
        assert.equal(row[col], null, `${col} doit rester NULL par défaut (pas de DEFAULT non-nul)`)
      }

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  } finally {
    await fx.cleanup()
  }
})

test.after(async () => { await db.destroy() })
