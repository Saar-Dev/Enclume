// Script à usage unique — note de suivi sur ENCYCLOPEDIE-ITALIC-QUOTES-UNREADABLE. Idempotent.
// Lancement manuel, local (Saar — écriture en base, hors autorisation d'auto-lancement de l'agent) :
//   node --env-file=.env server/src/scripts/note_tickets_20261014_encyclopedie_italic_quotes.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-14 : correctif codé ---'

const NOTE = `

${MARKER}
Cause : .encyclo-callout-quote .encyclo-callout-body .encyclo-paragraph (encyclopedia.css)
combinait font-family: var(--font-hand) (Caveat, manuscrite, déjà inclinée) avec font-style:
italic. Seuls les poids 400/600 de Caveat sont chargés (index.css, @fontsource/caveat), aucune
variante italique — le navigateur appliquait un oblique synthétique par-dessus une police déjà
cursive, d'où l'illisibilité (pas un problème de contraste de couleur). Seule occurrence de
--font-hand dans tout le client.
Fix : retrait de font-style: italic sur cette seule règle.
Testé : npm run build client propre. git diff --check propre. Détail : docs/JOURNAL8.md.
Non testé : rendu visuel réel (ouvrir une citation d'ouverture de chapitre).`

async function run() {
  const code = 'ENCYCLOPEDIE-ITALIC-QUOTES-UNREADABLE'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    status: 'in_progress',
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
