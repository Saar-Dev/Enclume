// Script à usage unique — note de progression SESSION-CAMERA-KEYBOARD-SLOW-START : correctif codé,
// scénario réel restant à valider par Saar avant clôture. Détail complet : JOURNAL8.md, session du
// 2026-10-13.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/note_ticket_session_camera_keyboard_slow_start.js

import db from '../db/knex.js'

const CODE = 'SESSION-CAMERA-KEYBOARD-SLOW-START'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Le pan caméra au clavier (flèches, caméra libre) dépendait de MapControls.listenToKeyEvents : un " +
    "pan par événement keydown, donc au rythme de la répétition de touche du système (saut initial, " +
    "temps mort, puis rafale) — ressenti ni précis ni rapide au démarrage. Remplacé par un suivi " +
    'touche-maintenue maison (keydown/keyup/blur) consommé dans un useFrame qui fait avancer la caméra ' +
    "à chaque image tant qu'une flèche est maintenue (vitesse constante x delta-temps), démarrage " +
    "immédiat. Testé : npm run build client propre, ESLint ciblé (0 nouveau problème). Non testé : " +
    "scénario réel en jeu — maintenir chaque flèche en caméra libre, vérifier le démarrage immédiat et " +
    "l'absence d'interférence avec les champs de saisie (chat, etc.)."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé (build + lint), scénario réel en jeu non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket ${CODE} (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
