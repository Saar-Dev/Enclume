// Script à usage unique — note de progression COMBAT-WEAPON-STATUS-GHOST-NO-WEAPON : migration
// codée et testée (lint + build), confirmation visuelle restant à faire par Saar avant clôture.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_combat_weapon_status_ghost.js

import db from '../db/knex.js'

const CODE = 'COMBAT-WEAPON-STATUS-GHOST-NO-WEAPON'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-13 : correctif codé ---\n' +
    "Décision de Saar : plutôt que cacher le badge d'état d'arme (Rangée/Main sur l'arme/Au clair) " +
    "quand aucune arme n'est en main, les libellés changent pour Au repos/Sur le qui-vive/En garde " +
    "-- même mécanique, même coût d'Initiative, ça n'équipe jamais d'arme. Câblé aux 5 fenêtres qui " +
    "affichent ce statut (initial, roster MJ, déclaration PJ/MJ/Exo) en réutilisant l'autorité déjà " +
    "existante shared/weaponSlots.js#resolveHandWeapons, sans dupliquer de calcul.\n\n" +
    'Testé : eslint (0 nouvelle erreur), build client propre, JSON de locale valide, ' +
    'shared/**/*.test.mjs (947/947). Non testé : scénario réel en navigateur (mains nues vs arme ' +
    'en main) dans chacune des 5 fenêtres.'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé statiquement, confirmation visuelle non faite
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
