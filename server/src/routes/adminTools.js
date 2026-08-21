import { Router } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = Router()

// Anciennement server/public/equipment-admin.html, servi sans aucune garde par express.static —
// n'importe qui pouvait charger la page (formulaire complet visible) sans être connecté, seuls ses
// appels PUT/POST/DELETE exigeaient un compte. Déplacé hors de public/ : la page elle-même exige
// maintenant d'être admin pour être ne serait-ce que chargée, pas seulement pour la soumettre.
router.get('/tools/equipment', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'ref-equipment-tool.html'))
})

// Illustration des 16 modèles ref_exo_templates (migration 263, PLAN_EXOARMURE.md §15) — même garde
// que /tools/equipment, même raison (page servie sous requireAdmin, pas seulement ses appels POST).
router.get('/tools/exo-templates', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'exo-templates-tool.html'))
})

export default router
