// Script à usage unique, ALIMENTÉ PROGRESSIVEMENT — audit du 2026-10-15 (lecture du code réel,
// demande explicite de Saar) : tickets vérifiés et trouvés PAS corrigés malgré une note existante
// qui le laissait croire. Statut laissé tel quel (ne jamais passer en 'resolved' pour un bug réel) —
// seule une note factuelle "Non corrigé à <date>" est ajoutée, pour que le prochain agent ne
// reparte pas de zéro sur le diagnostic (déjà fait ici).
// Idempotent (skip par entrée déjà notée). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261015_audit_not_fixed.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : vérifié par lecture du code réel — NON CORRIGÉ ---'

// { code, note } — preuve factuelle (fichier/ligne/requête), jamais une supposition.
const NOT_FIXED = [
  {
    code: 'MUT-SRC-UNIQ1',
    note: "Vérifié en base réelle (pg_indexes) : uq_char_mut_no_sub = (char_sheet_id, mutation_id) WHERE subtype_id IS NULL — `source` n'est PAS dans la contrainte (migration 115_char_mutations_constraints.js, aucune migration ultérieure ne la touche). Un personnage ne peut toujours pas avoir la même mutation depuis deux sources différentes (ex. chosen + revers) : le second insert serait rejeté. Bug réel, pas un oubli de clôture.",
  },
]

async function run() {
  for (const { code, note } of NOT_FIXED) {
    const t = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!t) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      admin_notes: `${t.admin_notes || ''}\n\n${MARKER}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note "non corrigé" ajoutée, statut inchangé (${t.status})`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
