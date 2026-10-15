// Script à usage unique — ticket SEED-ID-DETERM.
// Le fichier visé par le ticket (server/src/db/seeds/2_seed_equipment.js, id laissé à
// PostgreSQL) n'existe plus : remplacé le 2026-08-22, 26 minutes après la création du ticket,
// par la migration 303_ref_equipment_seed.js (commit 01a0dc1e, "Refonte complète des
// migrations"), qui insère chaque ligne ref_equipment avec un UUID LITTÉRAL codé en dur dans
// le fichier (ex. "id": "575c7244-0e41-4ab2-8bd0-129f3bd91a4b") — donc identique sur toute
// instance qui rejoue cette migration. [VÉRIFIÉ] seeds/equipmentMapping.js (seul fichier restant
// du dossier seeds/ touchant l'équipement) ne fait aucun insert ni ne lit/écrit d'id. Idempotence
// garantie à la fois par name (comme avant) ET par id désormais. Idempotent (MARKER en note).
//   node --env-file=.env server/src/scripts/resolve_ticket_seed_id_determ.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : vérifié par lecture du code réel — déjà résolu par un changement d\'architecture ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const t = await db('bug_tickets').where({ linked_bug_code: 'SEED-ID-DETERM' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }

  const note = `${MARKER}\nserver/src/db/seeds/2_seed_equipment.js (visé par ce ticket) n'existe plus. Remplacé le 2026-08-22, 26 minutes après la création de ce ticket, par la migration server/src/db/migrations/303_ref_equipment_seed.js (commit 01a0dc1e, "Refonte complète des migrations : une table = une création + un seed"), qui insère chaque ligne ref_equipment avec un UUID littéral codé en dur dans le fichier — identique sur toute instance qui rejoue cette migration. seeds/equipmentMapping.js (seul fichier restant touchant l'équipement) ne fait aucun insert et ne touche aucun id. Non pas corrigé par la solution proposée (UUID v5 dérivé), mais rendu obsolète par un changement d'architecture plus simple et tout aussi déterministe.`

  await db('bug_tickets').where({ id: t.id }).update({
    status: 'resolved',
    reviewed_by: admin.id,
    reviewed_at: db.fn.now(),
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] SEED-ID-DETERM -> resolved')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
