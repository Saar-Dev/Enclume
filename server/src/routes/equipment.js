/**
 * equipment.js — API CRUD pour le catalogue ref_equipment
 *
 * Monté sous /api/equipment dans index.js.
 * Utilisé par la page d'administration standalone (server/public/equipment-admin.html).
 *
 * Routes :
 *   GET  /api/equipment           — liste toutes les lignes (colonnes résumé)
 *   GET  /api/equipment/ref/skills — liste ref_skills pour dropdowns
 *   GET  /api/equipment/:id        — item complet + junction data
 *   POST /api/equipment            — crée un item + lignes junction
 *   PUT  /api/equipment/:id        — remplace un item + junction tables (remplacement total)
 *   DELETE /api/equipment/:id      — supprime (cascade FK sur junction tables)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Champs numériques à convertir avant INSERT
const INT_FIELDS   = ['price', 'tech_level', 'max_level', 'min_str', 'init_mod', 'protection', 'protection_shock']
const FLOAT_FIELDS = ['weight', 'capacity']
const BOOL_FIELDS  = ['waterproof']

function sanitize(body) {
  const clean = {}
  for (const [k, v] of Object.entries(body)) {
    if (v === '' || v === null || v === undefined) {
      clean[k] = null
    } else if (INT_FIELDS.includes(k)) {
      const n = parseInt(v, 10)
      clean[k] = isNaN(n) ? null : n
    } else if (FLOAT_FIELDS.includes(k)) {
      const n = parseFloat(v)
      clean[k] = isNaN(n) ? null : n
    } else if (BOOL_FIELDS.includes(k)) {
      clean[k] = v === true || v === 'true' || v === '1' || v === 'on'
    } else {
      clean[k] = v
    }
  }
  return clean
}

// ─── GET /api/equipment/ref/skills — AVANT /:id pour ne pas être capturé ──────
router.get('/ref/skills', requireAuth, async (req, res, next) => {
  try {
    const skills = await db('ref_skills')
      .select('id', 'label', 'family')
      .orderBy('family')
      .orderBy('label')
    res.json({ skills })
  } catch (err) { next(err) }
})

// ─── GET /api/equipment ───────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await db('ref_equipment')
      .select('id', 'family', 'category', 'name', 'tech_level', 'rarity', 'location')
      .modify(q => { if (req.query.family) q.where('family', req.query.family) })
      .orderBy('family')
      .orderBy('category')
      .orderBy('name')
    res.json({ items })
  } catch (err) { next(err) }
})

// ─── GET /api/equipment/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const item = await db('ref_equipment').where({ id: req.params.id }).first()
    if (!item) return res.status(404).json({ error: { message: 'Item introuvable' } })

    const [skills, skill_assoc, ammo_compat] = await Promise.all([
      db('ref_equipment_skills').where({ item_id: req.params.id }).pluck('skill_id'),
      db('ref_equipment_skill_assoc').where({ item_id: req.params.id }).pluck('skill_id'),
      db('ref_equipment_ammo_compat').where({ ammo_id: req.params.id }).pluck('weapon_id'),
    ])

    res.json({ item: { ...item, skills, skill_assoc, ammo_compat } })
  } catch (err) { next(err) }
})

// ─── POST /api/equipment ──────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { skills = [], skill_assoc = [], ammo_compat = [], ...rawFields } = req.body
    const fields = sanitize(rawFields)

    if (!fields.family || !fields.category || !fields.name) {
      return res.status(400).json({ error: { message: 'family, category et name sont requis' } })
    }
    if (fields.tech_level === null) {
      return res.status(400).json({ error: { message: 'tech_level est requis (1–7)' } })
    }

    const item = await db.transaction(async trx => {
      const [row] = await trx('ref_equipment').insert(fields).returning('*')

      if (skills.length) {
        await trx('ref_equipment_skills').insert(
          skills.map(sid => ({ item_id: row.id, skill_id: sid }))
        )
      }
      if (skill_assoc.length) {
        await trx('ref_equipment_skill_assoc').insert(
          skill_assoc.map(sid => ({ item_id: row.id, skill_id: sid }))
        )
      }
      if (ammo_compat.length) {
        await trx('ref_equipment_ammo_compat').insert(
          ammo_compat.map(wid => ({ ammo_id: row.id, weapon_id: wid }))
        )
      }

      return row
    })

    res.status(201).json({ item })
  } catch (err) { next(err) }
})

// ─── PUT /api/equipment/:id ───────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { skills = [], skill_assoc = [], ammo_compat = [], ...rawFields } = req.body
    const fields = sanitize(rawFields)

    if (!fields.family || !fields.category || !fields.name) {
      return res.status(400).json({ error: { message: 'family, category et name sont requis' } })
    }
    if (fields.tech_level === null) {
      return res.status(400).json({ error: { message: 'tech_level est requis (1–7)' } })
    }

    const existing = await db('ref_equipment').where({ id }).first()
    if (!existing) return res.status(404).json({ error: { message: 'Item introuvable' } })

    fields.updated_at = db.fn.now()

    const [row] = await db.transaction(async trx => {
      const updated = await trx('ref_equipment').where({ id }).update(fields).returning('*')

      await trx('ref_equipment_skills').where({ item_id: id }).delete()
      await trx('ref_equipment_skill_assoc').where({ item_id: id }).delete()
      await trx('ref_equipment_ammo_compat').where({ ammo_id: id }).delete()

      if (skills.length) {
        await trx('ref_equipment_skills').insert(
          skills.map(sid => ({ item_id: id, skill_id: sid }))
        )
      }
      if (skill_assoc.length) {
        await trx('ref_equipment_skill_assoc').insert(
          skill_assoc.map(sid => ({ item_id: id, skill_id: sid }))
        )
      }
      if (ammo_compat.length) {
        await trx('ref_equipment_ammo_compat').insert(
          ammo_compat.map(wid => ({ ammo_id: id, weapon_id: wid }))
        )
      }

      return updated
    })

    const [skillIds, skillAssocIds, ammoCompatIds] = await Promise.all([
      db('ref_equipment_skills').where({ item_id: id }).pluck('skill_id'),
      db('ref_equipment_skill_assoc').where({ item_id: id }).pluck('skill_id'),
      db('ref_equipment_ammo_compat').where({ ammo_id: id }).pluck('weapon_id'),
    ])

    res.json({ item: { ...row, skills: skillIds, skill_assoc: skillAssocIds, ammo_compat: ammoCompatIds } })
  } catch (err) { next(err) }
})

// ─── DELETE /api/equipment/:id ────────────────────────────────────────────────
// Les junction tables cascadent via FK ON DELETE CASCADE
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await db('ref_equipment').where({ id: req.params.id }).delete()
    if (!deleted) return res.status(404).json({ error: { message: 'Item introuvable' } })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
