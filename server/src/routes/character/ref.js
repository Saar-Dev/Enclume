/**
 * ref.js — Routes de référence du domaine character
 *
 * Monté sous /api/char-ref dans index.js.
 * Expose les tables de référence statiques nécessaires au client.
 *
 * Routes :
 *   GET /api/char-ref/genotypes — liste des génotypes avec leurs modificateurs
 *   GET /api/char-ref/skills    — catalogue compétences + prérequis imbriqués
 *   GET /api/char-ref/mutations — catalogue mutations + linked_skill_id
 */

import { Router } from 'express'
import db from '../../db/knex.js'
import { requireAuth } from '../../middleware/auth.js'

const router = Router()

// ─── GET /api/char-ref/genotypes ─────────────────────────────────────────────
// Retourne tous les génotypes disponibles avec leurs modificateurs d'attributs.
// Utilisé par CharacterSheet pour le dropdown génotype et le calcul du na.
router.get('/genotypes', requireAuth, async (req, res, next) => {
  try {
    const genotypes = await db('ref_genotypes').select('*').orderBy('id')
    res.json({ genotypes })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-ref/skills ─────────────────────────────────────────────────
// Retourne le catalogue complet des compétences avec leurs prérequis imbriqués.
//
// Chaque compétence inclut un tableau `requirements` (peut être vide) :
//   { type: 'SKILL_MIN'|'MUTATION'|'GENOTYPE', value: string, threshold: int }
//
// Tri : par famille puis par label — ordre d'affichage stable côté client.
// Double SELECT + regroupement JS : simple, lisible, adapté au volume (234 skills).
router.get('/skills', requireAuth, async (req, res, next) => {
  try {
    const [skills, reqs] = await Promise.all([
      db('ref_skills').select('*').orderBy('family').orderBy('label'),
      db('ref_skill_requirements').select('skill_id', 'type', 'value', 'threshold'),
    ])

    // Regrouper les prérequis par skill_id
    const reqsBySkill = reqs.reduce((acc, r) => {
      if (!acc[r.skill_id]) acc[r.skill_id] = []
      acc[r.skill_id].push({ type: r.type, value: r.value, threshold: r.threshold })
      return acc
    }, {})

    // Imbriquer les prérequis dans chaque compétence
    const result = skills.map(s => ({
      ...s,
      requirements: reqsBySkill[s.id] || [],
    }))

    res.json({ skills: result })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-ref/mutations ─────────────────────────────────────────────
// Retourne le catalogue complet des mutations (bug MUT2 corrigé — docs/BUGIDENTIFIE.md :
// muta_numero/linked_skill_id n'ont jamais existé sur le schéma réel post-migration 95).
// Trié par mutation_id pour un ordre d'affichage stable et prévisible.
router.get('/mutations', requireAuth, async (req, res, next) => {
  try {
    const mutations = await db('ref_mutations')
      .select('*')
      .orderBy('mutation_id')
    res.json({ mutations })
  } catch (err) {
    next(err)
  }
})

export default router
