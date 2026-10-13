// Script à usage unique — note de progression DRONE-INTEGRITY-LOSS-PER-HIT-RAW : correctif codé,
// scénario réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_drone_integrity_loss_per_hit_raw.js

import db from '../db/knex.js'

const CODE = 'DRONE-INTEGRITY-LOSS-PER-HIT-RAW'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "resolveDroneIntegrityLoss décrémentait l'intégrité du drone de 1 à CHAQUE touche, même sous 5 " +
    'de dégâts nets. Décision de Saar : alignement sur l\'exo-armure (REGLEARMURE.md:341-353, ' +
    'reprise par les drones REGLEDRONE.md:48-50) — perte d\'Intégrité uniquement sur la 1ère Avarie ' +
    "du palier le plus grave (mortelle) ou sur destruction, jamais sur un coup léger/moyen/grave/" +
    'critique ni sur une 2ᵉ Avarie du même palier. La case de blessure continue de se cocher ' +
    "normalement à chaque touche (inchangé) ; seule la baisse d'Intégrité est désormais conditionnée. " +
    "Conséquence vérifiée : l'Intégrité alimente calcDroneRD (Résistance aux dommages) — elle reste " +
    'plus haute plus longtemps, cohérent avec la décision. Testé : nouveau fichier ' +
    'socketCombatHelpers.droneIntegrity.test.mjs (4/4, DB réelle), shared/**/*.test.mjs (947/947), ' +
    'node --check. Non testé : scénario réel en jeu — infliger plusieurs touches légères puis un ' +
    "coup très grave à un drone, confirmer que l'intégrité affichée ne baisse qu'au coup grave."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (DB-backed), scénario réel en jeu non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
