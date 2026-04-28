import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { parseDice } from '../lib/diceParser.js'

const router = Router()

// POST /api/dice/roll
// Route standalone — hors session socket, destinée aux tests et aux usages futurs.
// Protégée par requireAuth — un utilisateur connecté est requis.
// Retourne le résultat du jet sans broadcast WS ni lecture dice_config.
router.post('/roll', requireAuth, async (req, res, next) => {
  try {
    const { formula } = req.body

    if (!formula || typeof formula !== 'string' || !formula.trim()) {
      return res.status(400).json({ error: 'Formule manquante ou invalide' })
    }

    const result = await parseDice(formula.trim())

    return res.json({
      rolls: result.rolls,
      total: result.total,
      formula: result.formula,
      dieType: result.dieType,
      seed: result.seed,
    })
  } catch (err) {
    // parseDice lève une Error pour formule invalide — retourner 400 pas 500
    if (err.message.includes('invalide') || err.message.includes('reconnue')) {
      return res.status(400).json({ error: err.message })
    }
    next(err)
  }
})

export default router