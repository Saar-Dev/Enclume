import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { AppError } from '../lib/AppError.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const router = Router()
const execFileAsync = promisify(execFile)

// Miroir health.js (systemctl is-active/ps aux/df, même gate requireAuth+requireAdmin) : journald
// est déjà l'autorité des logs en prod (rotation/persistance gérées par systemd), donc on l'interroge
// directement plutôt que de dupliquer un stockage de logs côté Node. Différence volontaire avec
// health.js : `service`/`lines` viennent de req.query, donc execFile (tableau d'arguments, aucun
// shell invoqué) au lieu de exec(chaîne) — une whitelist ne suffit pas seule à écarter l'injection.
const ALLOWED_SERVICES = ['enclume-server', 'enclume-client']
const MIN_LINES = 20
const MAX_LINES = 2000
const DEFAULT_LINES = 200

function parseEntry(raw) {
  let entry
  try {
    entry = JSON.parse(raw)
  } catch {
    return null
  }
  // journalctl -o json rend MESSAGE en tableau d'octets si le contenu n'est pas UTF-8 valide.
  let message = entry.MESSAGE
  if (Array.isArray(message)) {
    message = Buffer.from(message).toString('utf8')
  }
  const realtimeUs = Number(entry.__REALTIME_TIMESTAMP)
  return {
    timestamp: Number.isFinite(realtimeUs) ? new Date(Math.floor(realtimeUs / 1000)).toISOString() : null,
    priority: entry.PRIORITY != null ? parseInt(entry.PRIORITY, 10) : null,
    message: message ?? '',
  }
}

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (os.platform() !== 'linux') {
      return res.json({ available: false, reason: 'not_linux', service: null, entries: [] })
    }

    const service = req.query.service || ALLOWED_SERVICES[0]
    if (!ALLOWED_SERVICES.includes(service)) {
      throw new AppError(400, `Service inconnu : ${service}`)
    }

    const linesRaw = parseInt(req.query.lines, 10)
    const lines = Number.isFinite(linesRaw)
      ? Math.min(MAX_LINES, Math.max(MIN_LINES, linesRaw))
      : DEFAULT_LINES

    let stdout
    try {
      ;({ stdout } = await execFileAsync('journalctl', [
        '-u', service,
        '-n', String(lines),
        '--no-pager',
        '-o', 'json',
      ]))
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ available: false, reason: 'journalctl_missing', service, entries: [] })
      }
      throw err
    }

    const entries = stdout.split('\n').filter(Boolean).map(parseEntry).filter(Boolean)
    res.json({ available: true, service, entries })
  } catch (err) { next(err) }
})

export default router
