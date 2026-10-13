// Script à usage unique — note de progression COMBAT-DODGE-NOTIFICATION-WORDING : correctif codé,
// scénario réel navigateur restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md,
// session du 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_combat_dodge_notification_wording.js

import db from '../db/knex.js'

const CODE = 'COMBAT-DODGE-NOTIFICATION-WORDING'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Vérifié au RAW (REGLECACARTMARTIAUX.md:292, REGLEDRONE.md:99/238) : « Esquive » n'existe que " +
    "comme Technique martiale CaC (Retraite) ou programme de drone « au contact », jamais comme " +
    "action active contre un Tir à distance. « Vous esquivez le tir » (CombatResultPanels.jsx, " +
    'affiché au joueur visé par un Tir raté) laissait donc croire à tort que le joueur avait agi. ' +
    'Corrigé : texte remplacé par « Le tir vous manque » (passif, même voix que les clés sœurs ' +
    "player.hit/player.lethallyHit) ; clé renommée resultPanels.player.dodged → " +
    'resultPanels.player.missed (alignée sur resultPanels.gm.missed déjà existant pour la vue MJ). ' +
    "melee.dodged (CaC, vrai jet d'opposition Esquive/Parade) non touché, hors périmètre. Testé : " +
    'JSON valide, ESLint (0 problème), build client propre. Non testé : scénario réel navigateur — ' +
    "texte + nom de clé seulement, pas de test automatisé pertinent."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel navigateur non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
