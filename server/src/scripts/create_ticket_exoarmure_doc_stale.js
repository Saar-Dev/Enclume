// Script à usage unique — crée un ticket pour docs/SYSTEME/EXOARMURE.md périmé, trouvé en clôturant
// c9915238 (2026-08-22) et laissé sans trace lors de cette clôture — faute corrigée ici (« soit tu
// corriges soit tu notes », Saar). Lancement manuel :
// node --env-file=.env server/src/scripts/create_ticket_exoarmure_doc_stale.js

import db from '../db/knex.js'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: 'EXOARMURE-DOC-STALE1' }).first()
  if (existing) {
    console.log('Ticket déjà présent, rien à faire.')
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')
  const origin = 'admin'

  const [ticket] = await db('bug_tickets')
    .insert({
      reporter_id: admin.id,
      origin,
      category: 'other',
      domain: 'personnage',
      title: 'docs/SYSTEME/EXOARMURE.md décrit un schéma exo-armures périmé',
      description:
        'Le doc décrit encore un design "catalogue dual" (table ref_exo_equipment, ' +
        'ref_exo_template_equipment.equipment_id -> ref_exo_equipment EN PLUS de ref_equipment_id -> ' +
        'ref_equipment). Vérifié en base 2026-08-22 : ref_exo_equipment n\'existe plus, ' +
        'ref_exo_template_equipment n\'a plus qu\'une seule colonne source (ref_equipment_id). Le ' +
        'design dual a été éliminé (probablement à la refonte migrations Phase 2 du même jour, ces ' +
        'migrations vivant maintenant dans migrations_archive/), le doc jamais mis à jour en ' +
        'conséquence. À corriger : §"Deux niveaux de données" (tableau catalogue/instance), ' +
        'description de ref_exo_template_equipment (§ ~59-62), règle "clone vs lien" (§ ~146+) qui ' +
        'présuppose l\'existence de ref_exo_equipment.',
      linked_bug_code: 'EXOARMURE-DOC-STALE1',
      status: 'new',
      priority: 'low',
      admin_notes: 'Trouvé en clôturant c9915238 — doc jamais mis à jour après la simplification du schéma.',
    })
    .returning(['id'])

  console.log(`Ticket créé : ${ticket.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
