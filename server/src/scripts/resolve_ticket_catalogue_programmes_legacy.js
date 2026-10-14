// Script à usage unique — clôture du ticket catalogue "19 lignes Programmes legacy" : déjà fait
// par un autre chantier, jamais reflété sur le ticket. Détail : JOURNAL8.md, session du 2026-10-14.
// Lancement manuel, local : node --env-file=.env server/src/scripts/resolve_ticket_catalogue_programmes_legacy.js

import db from '../db/knex.js'

// Ticket sans linked_bug_code — identifié par titre exact.
const TITLE = 'Catalogue — 19 lignes "Programmes" legacy jamais référencées, doublons de la famille Logiciels'

async function run() {
  const ticket = await db('bug_tickets').where({ title: TITLE }).first()
  if (!ticket) throw new Error('Ticket introuvable (titre exact).')
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-14 : fausse alerte, déjà fait ailleurs ---\n' +
    "Vérifié par requête directe : aucune des 19 lignes nommées par le ticket n'existe plus dans " +
    "ref_equipment (0/19 trouvées par nom exact), et plus aucune ligne family contenant " +
    "'informatique' + category='Programmes' n'existe du tout. Le nettoyage décrit par ce ticket a " +
    "déjà eu lieu (vraisemblablement via le chantier Informatique, couches 1-2, postérieur à ce " +
    "ticket) — jamais reflété ici. Aucune des 12 FK réelles vers ref_equipment vérifiée (char_inventory, " +
    "char_inventory_mods, drone_programs, drone_weapons, exo_programs, exo_systems, exo_weapons, " +
    "ref_equipment_ammo_compat ×2, ref_equipment_skill_assoc, ref_equipment_skills, " +
    "ref_exo_template_equipment) — sans objet puisque les lignes elles-mêmes n'existent plus. Rien à coder."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket "${TITLE}" (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
