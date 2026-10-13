// Script à usage unique — note de progression EXO-AVARIE-LINE-CONVENTION : correctif codé, scénario
// réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_exo_avarie_line_convention.js

import db from '../db/knex.js'

const CODE = 'EXO-AVARIE-LINE-CONVENTION'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "exoAvarieService.js convertissait une Avarie dès que currentCount >= maxCount - 1 : la dernière " +
    "case d'une ligne n'était jamais réellement cochée. Le compteur de Blessures des personnages " +
    'avait déjà basculé sur la lecture littérale du livre (Lot A, décision de Saar : le livre fait ' +
    "autorité) ; celui des exo-armures était resté sur l'ancienne lecture. Corrigé : " +
    'resolveAvarieIncrement utilise désormais isWoundLineFull (shared/woundConstants.js, même ' +
    'fonction partagée que resolveWoundInsertion, aucune seconde copie de la règle) au lieu de ' +
    'currentCount >= maxCount - 1 — une ligne se remplit maintenant réellement jusqu\'à maxCount ' +
    "cases avant que l'Avarie suivante ne convertisse. Touche tous les paliers, pas seulement " +
    "l'exemple catastrophique cité par le ticket. Rien à changer côté affichage " +
    '(ExoAvariesPanel.jsx rendait déjà maxCount cases). Testé : node --env-file=.env --test ' +
    'server/src/lib/exoAvarieService.test.mjs (22/22, 2 tests réécrits pour la nouvelle frontière ' +
    'réelle), shared/**/*.test.mjs (947/947), ESLint (0 problème), build client propre, node ' +
    '--check. Non testé : scénario réel navigateur — infliger 2 Avaries catastrophiques à une ' +
    'exo-armure, confirmer que les 2 cases se cochent avant la conversion en Destruction.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (DB-backed), scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
