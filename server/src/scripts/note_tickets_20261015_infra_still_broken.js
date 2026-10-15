// Script à usage unique — audit 2026-10-15, domaine infrastructure : tickets vérifiés et
// confirmés toujours non corrigés. Statut inchangé, note horodatée.
//   node --env-file=.env server/src/scripts/note_tickets_20261015_infra_still_broken.js

import db from '../db/knex.js'

const MARKER = 'À corriger, vérifié 2026-10-15'

const STILL_BROKEN = [
  { code: 'P-SRV-5', note: `${MARKER} : docker-compose.yml expose toujours postgres/redis/minio sans restriction d'interface ("5432:5432", "6379:6379", "9000:9000" — pas "127.0.0.1:...").` },
  { code: 'SECU-EMAIL1', note: `${MARKER} : aucun mécanisme d'envoi d'email côté serveur (grep nodemailer/sendMail/smtp exhaustif sur server/src, rien trouvé).` },
  { code: 'TIME-ADJUST-ROUTE-LEGACY', note: `${MARKER} : POST /api/campaigns/:id/game-time/adjust (server/src/routes/campaigns.js:325) toujours en place, toujours aucun appelant côté client (grep vide) — le commentaire au-dessus confirme qu'elle est laissée volontairement pendant la migration vers request-advance.` },
]

async function run() {
  for (const { code, note } of STILL_BROKEN) {
    const t = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!t) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      admin_notes: `${t.admin_notes || ''}\n\n--- 2026-10-15 ---\n${note}`.trim(), updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note ajoutée, statut inchangé (${t.status})`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
