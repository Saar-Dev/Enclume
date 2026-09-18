// Script à usage unique — clôture INI2 : « Initiative non recalculée après blessure en combat ».
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_ini2.js

import db from '../db/knex.js'

const CODE = 'INI2'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    "Corrigé 2026-09-18 : calcREA n'incluait jamais le malus de blessure (RAW REGLESYSCOMBAT.md:111 " +
    "- 'affectent le niveau de Reaction ... et donc son Initiative de base'), base_ini ne bougeait " +
    "donc jamais. Nouveau module server/src/lib/reactionService.js (computeCharacterBaseIni), feuille " +
    "deliberement separee de combatantContextService.js pour ne pas fermer le cycle d'import deja " +
    "documente (combatantContextService.js -> damageService.js -> woundService.js). Hook dans " +
    "woundService.js#applyWound : recalcule base_ini (jamais initiative en direct, pour ne pas " +
    "desynchroniser une echelle de phases deja construite ce Tour - effectif au Tour suivant via " +
    "endTurn()) pour tout token actif du personnage blesse, diffuse COMBAT_ROSTER_UPDATED. Au passage : " +
    "consolidation du fetch attrs/archetype/avantages duplique a COMBAT_START (branche humanoide) et " +
    "GET /battlemaps/:id/combat-ini (les 3 autres sites identifies au depart reutilisaient deja un " +
    "contexte partage, non touches). Detail complet : docs/SYSTEME/COMBAT.md § 'Surprise - Test de " +
    "Reaction' sous-section 'Initiative apres blessure (INI2)', docs/JOURNAL8.md session du " +
    "2026-09-18. Teste : combatTurnEngine.test.mjs 27/27, woundService.test.mjs 8/8 (2 nouveaux cas " +
    "deterministes). Confirme en jeu reel par Saar."

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
