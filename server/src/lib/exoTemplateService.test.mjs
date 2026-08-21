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
  // ref_exo_templates est un catalogue global, jamais scopé par campaign_id/character_id — supprimer
  // la campagne/l'utilisateur ne le nettoie pas par cascade (trouvé après coup : des lignes "A"/"B"/
  // "Modèle test exoTemplateService" polluaient le vrai catalogue en dev, visibles dans le sélecteur
  // de modèle de l'UI réelle). Chaque template inséré par ce fixture est tracé ici et supprimé
  // explicitement au cleanup — un des tests en insère 2 (écrasement complet), pas seulement 1.
  const createdTemplateIds = []
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
      createdTemplateIds.push(template.id)
      return template
    },
    async cleanup() {
      if (createdTemplateIds.length > 0) {
        await db('ref_exo_templates').whereIn('id', createdTemplateIds).del()
      }
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

// ─── Lot C (§13.4.4) — loadout Systèmes/Armement/Ordinateur ──────────────────────────────────────

test('applyExoTemplate — copie le loadout exo_systems/exo_weapons avec Intégrité neuve fixe (20)', { skip }, async () => {
  const fx = await createFixture()
  try {
    const template = await fx.insertTemplate()
    await db('ref_exo_template_equipment').insert([
      { template_id: template.id, family: 'systeme', label_override: 'Sonscan actif', sort_order: 0 },
      { template_id: template.id, family: 'systeme', label_override: 'Communicateur Lénid', level: 3, sort_order: 1 },
      { template_id: template.id, family: 'arme', label_override: 'Dague thermique', sort_order: 0 },
    ])

    await applyExoTemplate(db, fx.exoCharacter.id, template.id)

    const systems = await db('exo_systems').where({ character_id: fx.exoCharacter.id }).orderBy('sort_order', 'asc')
    const weapons = await db('exo_weapons').where({ character_id: fx.exoCharacter.id })
    assert.equal(systems.length, 2)
    assert.equal(weapons.length, 1)
    assert.equal(systems[0].label_override, 'Sonscan actif')
    assert.equal(systems[1].level, 3)
    for (const row of [...systems, ...weapons]) {
      assert.equal(row.integrite_max, 20, 'matériel neuf, jamais un jet (décision Saar 2026-08-21)')
      assert.equal(row.integrite_current, 20)
    }
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — copie exo_computers avec un jet d\'Intégrité PAR LIGNE, formule selon SA PROPRE génération', { skip }, async () => {
  const fx = await createFixture()
  try {
    const template = await fx.insertTemplate()
    // Nymph 1-A réel (SEEDEXO.md:1029-1030) : principal Gén. V (palier 2d6+8, 10-20), secours Gén. II
    // (palier 2d6+3, 5-15) — générations différentes, formules différentes, jamais le même jet réutilisé.
    await db('ref_exo_template_computers').insert([
      { template_id: template.id, role: 'principal', gen: 5, nt: 3, sort_order: 0 },
      { template_id: template.id, role: 'secours', gen: 2, nt: 2, sort_order: 1 },
    ])

    await applyExoTemplate(db, fx.exoCharacter.id, template.id)

    const computers = await db('exo_computers').where({ character_id: fx.exoCharacter.id }).orderBy('sort_order', 'asc')
    assert.equal(computers.length, 2)
    const [principal, secours] = computers
    assert.equal(principal.role, 'principal')
    assert.equal(principal.gen, 5)
    assert.equal(principal.integrite_max, principal.integrite_current)
    assert.ok(principal.integrite_max >= 10 && principal.integrite_max <= 20, `2d6+8 hors bornes : ${principal.integrite_max}`)
    assert.equal(secours.role, 'secours')
    assert.equal(secours.gen, 2)
    assert.equal(secours.integrite_max, secours.integrite_current)
    assert.ok(secours.integrite_max >= 5 && secours.integrite_max <= 15, `2d6+3 hors bornes : ${secours.integrite_max}`)
  } finally {
    await fx.cleanup()
  }
})

test('applyExoTemplate — reselect d\'un second modèle remplace tout le loadout (aucune fusion)', { skip }, async () => {
  const fx = await createFixture()
  try {
    const templateA = await fx.insertTemplate({ name: 'A' })
    await db('ref_exo_template_equipment').insert({ template_id: templateA.id, family: 'systeme', label_override: 'Système A' })
    await db('ref_exo_template_computers').insert({ template_id: templateA.id, role: 'principal', gen: 1, nt: 1 })
    await applyExoTemplate(db, fx.exoCharacter.id, templateA.id)

    const templateB = await fx.insertTemplate({ name: 'B' })
    await db('ref_exo_template_equipment').insert({ template_id: templateB.id, family: 'arme', label_override: 'Arme B' })
    // Modèle B n'a aucun ref_exo_template_computers — l'ordinateur du modèle A ne doit pas survivre.
    await applyExoTemplate(db, fx.exoCharacter.id, templateB.id)

    const systems = await db('exo_systems').where({ character_id: fx.exoCharacter.id })
    const weapons = await db('exo_weapons').where({ character_id: fx.exoCharacter.id })
    const computers = await db('exo_computers').where({ character_id: fx.exoCharacter.id })
    assert.equal(systems.length, 0, 'le système du modèle A doit avoir disparu')
    assert.equal(weapons.length, 1)
    assert.equal(weapons[0].label_override, 'Arme B')
    assert.equal(computers.length, 0, 'l\'ordinateur du modèle A doit avoir disparu, modèle B n\'en a aucun')
  } finally {
    await fx.cleanup()
  }
})

test.after(async () => { await db.destroy() })
