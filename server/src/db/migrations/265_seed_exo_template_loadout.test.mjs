import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './265_seed_exo_template_loadout.js'

// Total exact par armure — somme des totaux documentés PLAN_EXOARMURE.md §13.4.4/§14 (equipement +
// ordinateurs). 431 au total.
const EXPECTED_TOTALS = {
  'Explora': 23, 'Typhon': 31, 'Nymph 1-A': 18, 'Série A': 15, 'Vanguard': 21, 'Sylph 56': 19,
  'Vauban': 23, 'Condor': 34, 'Cougar': 27, 'Mentor': 22, 'Heimdall-Pyrelia': 26, 'Ouraken': 29,
  'Odin': 26, 'Vulcain': 37, 'Moloch': 47, 'Orka': 33,
}

async function totalRowsFor(knex, templateName) {
  const tpl = await knex('ref_exo_templates').where('name', templateName).first('id')
  assert.ok(tpl, `ref_exo_templates introuvable pour "${templateName}"`)
  const eq = await knex('ref_exo_template_equipment').where('template_id', tpl.id).count('id as c').first()
  const cp = await knex('ref_exo_template_computers').where('template_id', tpl.id).count('id as c').first()
  return Number(eq.c) + Number(cp.c)
}

test('données réelles — les 16 armures ont exactement le nombre de lignes documenté', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  for (const [name, total] of Object.entries(EXPECTED_TOTALS)) {
    const got = await totalRowsFor(db, name)
    assert.equal(got, total, `${name} : ${total} lignes attendues, ${got} trouvées`)
  }
})

test('données réelles — exclusive arc respecté sur toutes les lignes equipment (jamais 2 sources, jamais 0)', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const templateIds = await db('ref_exo_templates').whereIn('name', Object.keys(EXPECTED_TOTALS)).pluck('id')
  const rows = await db('ref_exo_template_equipment').whereIn('template_id', templateIds)
    .select('id', 'equipment_id', 'ref_equipment_id', 'label_override')
  assert.ok(rows.length > 0)
  for (const r of rows) {
    const sourceCount = (r.equipment_id ? 1 : 0) + (r.ref_equipment_id ? 1 : 0)
    assert.ok(sourceCount <= 1, `ligne ${r.id} a 2 sources catalogue à la fois`)
    assert.ok(sourceCount === 1 || r.label_override, `ligne ${r.id} n'a ni source ni label`)
  }
})

test('données réelles — Moloch (cas le plus dense) a le bon contenu ligne à ligne', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const tpl = await db('ref_exo_templates').where('name', 'Moloch').first('id')
  const rows = await db('ref_exo_template_equipment')
    .where('template_id', tpl.id)
    .leftJoin('ref_exo_equipment', 'ref_exo_template_equipment.equipment_id', 'ref_exo_equipment.id')
    .leftJoin('ref_equipment', 'ref_exo_template_equipment.ref_equipment_id', 'ref_equipment.id')
    .select(
      'ref_exo_template_equipment.family', 'ref_exo_template_equipment.level',
      db.raw('COALESCE(ref_exo_equipment.name, ref_equipment.name) as resolved_name')
    )

  const moduleAnnexeCount = rows.filter((r) => r.resolved_name === 'Dispositif d\'auto-réparation • Module annexe').length
  assert.equal(moduleAnnexeCount, 10, 'Modules annexes pour 10 systèmes')

  const torpilleTaille2Count = rows.filter((r) => r.resolved_name === 'Lance-torpilles Taille 2').length
  assert.equal(torpilleTaille2Count, 2, 'les deux lance-torpilles alignés dans le dos')

  const leurre = rows.find((r) => r.resolved_name === 'Lance-leurre Taille 3')
  assert.ok(leurre, 'Lance-leurre Taille 3 résolu (migration 264)')
  assert.equal(leurre.family, 'arme')

  const oxygene = rows.find((r) => r.resolved_name === 'Système respiratoire • Réserve d’oxygène')
  assert.equal(oxygene.level, 3, '72h = level 3 (convention §14)')

  const memoire = rows.find((r) => r.resolved_name === 'Mémoire de cibles Mémo')
  assert.equal(memoire.family, 'systeme', 'classée systeme malgré son catalogue source family=Armes')
})

test('migration 265 (down puis up) reproduit exactement les totaux attendus', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    await down(trx)
    for (const name of Object.keys(EXPECTED_TOTALS)) {
      const got = await totalRowsFor(trx, name)
      assert.equal(got, 0, `${name} devrait être vide après down()`)
    }

    await up(trx)
    for (const [name, total] of Object.entries(EXPECTED_TOTALS)) {
      const got = await totalRowsFor(trx, name)
      assert.equal(got, total, `${name} après up() : ${total} attendues, ${got} trouvées`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
