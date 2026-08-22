// Script à usage unique — clôture définitive du ticket "Catalogue marchand ignore ref_exo_equipment"
// (id c9915238). Ma clarification précédente (juste renommer la table citée en
// ref_exo_template_equipment) était insuffisante — Saar a raison : le ticket n'a plus aucune raison
// d'exister. Vérifié en base : ref_exo_template_equipment (schéma live) n'a plus de colonne
// equipment_id ni de catalogue dual — seulement ref_equipment_id (source unique, FK vers
// ref_equipment). Le design "catalogue exo séparé" décrit dans docs/SYSTEME/EXOARMURE.md (table
// ref_exo_equipment, dual-catalog) a été éliminé — probablement lors de la refonte migrations Phase 2
// du jour, ces migrations vivant maintenant dans migrations_archive/. tradeService.js#getCatalog lit
// déjà `SELECT * FROM ref_equipment` sans filtre : tout ref_equipment_id référencé par un template exo
// est déjà un ref_equipment normal, donc déjà dans le catalogue marchand. Rien à corriger.
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_marchand_exo.js

import db from '../db/knex.js'

const ID = 'c9915238-ff6c-4073-8d13-75488f250d9b'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Clos 2026-08-22 (Saar) : le ticket n\'a plus de raison d\'être, pas seulement un nom de table à ' +
    'corriger comme noté précédemment. ref_exo_template_equipment (schéma live) n\'a plus qu\'une ' +
    'seule source (ref_equipment_id -> ref_equipment), le catalogue exo séparé décrit dans ' +
    'docs/SYSTEME/EXOARMURE.md a été éliminé (probablement lors de la refonte migrations Phase 2 du ' +
    'même jour). tradeService.js#getCatalog lit déjà tout ref_equipment sans filtre — tout ' +
    'équipement exo y est donc déjà. docs/SYSTEME/EXOARMURE.md reste à corriger séparément (décrit ' +
    'encore l\'ancien design dual-catalog), hors périmètre de ce ticket.'

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

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
