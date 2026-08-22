// Script à usage unique — clôture COM-MOVEUI1, requalifié : ce n'était pas une simple redite de
// décisions produit passées (survol auto-armé, panneau fixe) mais un bug de code réel, confirmé
// 2026-08-22 sur instruction explicite de Saar (ne pas se réfugier derrière l'ancienne décision).
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_com_moveui1.js

import db from '../db/knex.js'

const ID = '5d890fc7-bed9-4911-91a1-d3a41a30db00'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    'Requalifié et corrigé 2026-08-22 : le vrai bug n\'était pas le survol auto-armé (décision ' +
    '2026-07-31 conservée) ni le panneau en coin fixe (décision 2026-08-01 conservée), mais le ' +
    'bouton "Annuler" du panneau lui-même — totalement inopérant. useAutoMoveMode.js réarmait ' +
    'inconditionnellement dès que combatMoveMode redevenait faux tant que `enabled` restait vrai, ' +
    'sans distinguer une validation de déplacement (réarmement voulu) d\'une annulation explicite ' +
    '(devrait rester fermé) — le clic sur "Annuler" produisait donc un flash fermé/rouvert au rendu ' +
    'suivant, perçu comme "toujours visible, réapparaît sans cesse". Correctif dans le hook partagé ' +
    'unique (dismissedRef + clé token/allures) : une annulation explicite reste respectée jusqu\'à un ' +
    'changement réel de contexte (nouveau tour/token/allures) ; la validation d\'un déplacement continue ' +
    'de réarmer comme avant. Un seul fichier touché (client/src/lib/useAutoMoveMode.js), consommé sans ' +
    'changement par les 3 appelants (CombatActionWindow PJ, CombatGmDeclareWindow PNJ, useDroneDeclare).'

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      priority: 'high',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
