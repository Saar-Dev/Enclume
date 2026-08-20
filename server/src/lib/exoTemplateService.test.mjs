import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { applyExoTemplate } from './exoTemplateService.js'

const skip = !process.env.DATABASE_URL

const COPIED_COLUMNS = [
  'category', 'environment', 'depth_operational', 'depth_limit', 'depth_crush',
  'base_exoforce', 'base_blindage', 'base_speed_underwater', 'base_speed_surface',
  'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
  'malus_init_underwater', 'malus_init_surface',
  'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
]

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `exo-tpl-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'exo-tpl-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test exoTemplateService', invite_code: `EXOTPL-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test template', type: 'exo' })
    .returning('*')
  const [exoSheet] = await db('exo_sheet').insert({ character_id: exoCharacter.id }).returning('*')
  return {
    gm, campaign, exoCharacter, exoSheet,
    async insertTemplate(overrides = {}) {
      const [template] = await db('ref_exo_templates')
        .insert({
          name: 'Modèle test exoTemplateService', category: 'exo-3', environment: 'hybrid',
          depth_operational: 100, depth_limit: 150, depth_crush: 200,
          base_exoforce: 55, base_blindage: 28,
          base_speed_underwater: 12, base_speed_surface: 8,
          underwater_movement_mode: 'vit', surface_movement_mode: 'pilot',
          speeds_extra: JSON.stringify([{ label: 'propulseur', value: 20 }]),
          malus_init_underwater: -2, malus_init_surface: -1,
          manufacturer: 'Test Manufacture', price: 12000, rarity: 'Rare',
          tech_level: 'III-IV', autonomy: '48h',
          ...overrides,
        })
        .returning('*')
      return template
    },
    async cleanup() {
      await db('campaigns').where({ id: campaign.id }).del()
      await db('users').where({ id: gm.id }).del()
    },
  }
}

test('applyExoTemplate — copie les 19 champs de base + assigne template_id', { skip }, async () => {
  const fx = await createFixture()
  try {
    const template = await fx.insertTemplate()
    const updated = await applyExoTemplate(db, fx.exoCharacter.id, template.id)
    assert.equal(updated.template_id, template.id)
    for (const col of COPIED_COLUMNS) {
      assert.deepEqual(updated[col], template[col], `${col} n'a pas été copié depuis le template`)
    }
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — écrasement complet (pas de fusion) : reselect d\'un second modèle écrase une valeur personnalisée', { skip }, async () => {
  const fx = await createFixture()
  try {
    const templateA = await fx.insertTemplate({ name: 'A', base_exoforce: 55 })
    await applyExoTemplate(db, fx.exoCharacter.id, templateA.id)
    // Personnalisation manuelle après première sélection (édition directe du champ, whitelist Lot B).
    await db('exo_sheet').where({ character_id: fx.exoCharacter.id }).update({ base_exoforce: 999 })

    const templateB = await fx.insertTemplate({ name: 'B', base_exoforce: 40, category: 'exo-2' })
    const updated = await applyExoTemplate(db, fx.exoCharacter.id, templateB.id)

    assert.equal(updated.template_id, templateB.id)
    assert.equal(updated.base_exoforce, 40, 'la personnalisation manuelle doit être écrasée par le nouveau modèle')
    assert.equal(updated.category, 'exo-2')
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — ne touche jamais avaries_*/itg_*_current', { skip }, async () => {
  const fx = await createFixture()
  try {
    await db('exo_sheet').where({ character_id: fx.exoCharacter.id })
      .update({ avaries_legeres: 3, itg_structure_current: 7 })
    const template = await fx.insertTemplate()
    const updated = await applyExoTemplate(db, fx.exoCharacter.id, template.id)
    assert.equal(updated.avaries_legeres, 3)
    assert.equal(updated.itg_structure_current, 7)
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — templateId introuvable dans ref_exo_templates : null, exo_sheet inchangée', { skip }, async () => {
  const fx = await createFixture()
  try {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const result = await applyExoTemplate(db, fx.exoCharacter.id, fakeId)
    assert.equal(result, null)
    const reread = await db('exo_sheet').where({ character_id: fx.exoCharacter.id }).first()
    assert.equal(reread.category, null)
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — characterId sans exo_sheet : null', { skip }, async () => {
  const fx = await createFixture()
  try {
    const template = await fx.insertTemplate()
    const result = await applyExoTemplate(db, '00000000-0000-0000-0000-000000000000', template.id)
    assert.equal(result, null)
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — templateId mal formé : AppError 400, jamais une erreur Postgres brute', { skip }, async () => {
  const fx = await createFixture()
  try {
    await assert.rejects(
      () => applyExoTemplate(db, fx.exoCharacter.id, 'not-a-uuid'),
      (err) => {
        assert.equal(err.statusCode, 400)
        return true
      },
    )
  } finally {
    await fx.cleanup()
  }
})

test.after(async () => { await db.destroy() })
