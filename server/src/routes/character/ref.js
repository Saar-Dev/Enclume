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
 *   GET /api/char-ref/advantages — catalogue complet avantages/désavantages
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
//   { type: 'SKILL_MIN'|'MUTATION'|'GENOTYPE'|'ADVANTAGE', value: string, threshold: int, or_group: string|null }
//
// or_group : les requirements qui partagent le même or_group (non-null) sont liés en OU (une seule
// suffit) — sinon (or_group null) ET, comme aujourd'hui. Voir docs/PLAN_MUTATION2.md Lot 5 (bug HYBRIDE).
//
// Tri : par famille puis par label — ordre d'affichage stable côté client.
// Double SELECT + regroupement JS : simple, lisible, adapté au volume (234 skills).
router.get('/skills', requireAuth, async (req, res, next) => {
  try {
    const [skills, reqs] = await Promise.all([
      db('ref_skills').select('*').orderBy('family').orderBy('label'),
      db('ref_skill_requirements').select('skill_id', 'type', 'value', 'threshold', 'or_group'),
    ])

    // Regrouper les prérequis par skill_id
    const reqsBySkill = reqs.reduce((acc, r) => {
      if (!acc[r.skill_id]) acc[r.skill_id] = []
      acc[r.skill_id].push({ type: r.type, value: r.value, threshold: r.threshold, or_group: r.or_group })
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
//
// Chaque mutation inclut un tableau `subtable` (peut être vide) — sous-types via
// ref_mutation_subtypes (ex. "Caractère génétique animal" → félin/canin/reptilien/simiesque).
// Même pattern de nesting que getStep3RefData (creationService.js, Wizard Step3) — nécessaire
// ici pour que le MJ puisse choisir un sous-type en octroyant une mutation en jeu (Lot D,
// docs/PLAN_MUTATION2.md).
router.get('/mutations', requireAuth, async (req, res, next) => {
  try {
    const [mutations, subtypes] = await Promise.all([
      db('ref_mutations').select('*').orderBy('mutation_id'),
      db('ref_mutation_subtypes').select('*').orderBy(['mutation_id', 'd4_roll']),
    ])

    const mutMap = new Map(mutations.map(m => [m.mutation_id, { ...m, subtable: [] }]))
    for (const sub of subtypes) mutMap.get(sub.mutation_id)?.subtable.push(sub)

    res.json({ mutations: Array.from(mutMap.values()) })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/char-ref/advantages ────────────────────────────────────────────
// Retourne le catalogue complet ref_advantages (76 lignes) — utilisé par l'octroi narratif MJ
// (AdvantagesPanel.jsx). Non filtré par option de campagne (polaris_latent) : un MJ peut octroyer
// n'importe quel avantage narrativement, même hors des choix normalement offerts au Wizard —
// même philosophie que /mutations (catalogue complet, aucune restriction pour un octroi MJ).
router.get('/advantages', requireAuth, async (req, res, next) => {
  try {
    const advantages = await db('ref_advantages').select('*').orderBy(['type', 'name'])
    res.json({ advantages })
  } catch (err) {
    next(err)
  }
})

export default router
