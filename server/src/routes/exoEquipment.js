/**
 * exoEquipment.js — API lecture du catalogue ref_exo_equipment
 *
 * Monté sous /api/exo-equipment dans index.js. Patron repris de exoTemplates.js (lui-même repris de
 * equipment.js) : table de référence, lecture gameplay simple, requireAuth suffit — aucune route de
 * mutation (catalogue peuplé par migration/seed, PLAN_EXOARMURE.md §12.4).
 *
 * Nécessaire pour les panneaux client Systèmes/Armement (Lot C, §13.4.3) — sans cette route, aucun
 * moyen de peupler le sélecteur catalogue de ExoSystemsPanel.jsx/ExoWeaponsPanel.jsx (les routes
 * d'écriture char-sheet.js valident déjà un `equipment_id` fourni, mais rien ne permettait de le
 * découvrir côté client).
 *
 * Routes :
 *   GET /api/exo-equipment            — liste, filtrable par ?family=arme|systeme (mirror ?family sur
 *                                        GET /api/equipment, equipment.js:69)
 */

import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await db('ref_exo_equipment')
      .select(
        'id', 'family', 'category', 'name', 'description',
        'price', 'price_modifier', 'tech_level', 'rarity', 'max_level', 'duration',
        'damage', 'shock', 'range', 'init_mod', 'fire_mode', 'ammo_cost',
      )
      .modify(q => { if (req.query.family) q.where('family', req.query.family) })
      .orderBy('family')
      .orderBy('category')
      .orderBy('name')
    res.json({ items })
  } catch (err) { next(err) }
})

export default router
