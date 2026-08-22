// Script a usage unique - cloture AMMO-STD-MISMATCH1 : ampleur reelle plus large que le ticket
// initial (5 lignes, pas 2), verifiee via shared/weaponAmmoDsl.js + damageService.js (FX= est la
// seule autorite mecanique reelle une fois posee ; RANGE=/DEPTH= sont decoratifs, aucun consommateur).
// Corrige par la migration 312_fix_ammo_effects_darts_762_556.js, appliquee.
// Lancement manuel : node --env-file=.env server/src/scripts/resolve_ticket_ammo_std_mismatch1.js

import db from '../db/knex.js'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'AMMO-STD-MISMATCH1' }).first()
  if (!ticket) throw new Error('Ticket AMMO-STD-MISMATCH1 introuvable.')
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouve.')

  const note =
    "Corrige 2026-08-22 (Saar confirme apres verification). Ampleur reelle plus large que le " +
    "ticket initial : 5 lignes fausses, pas 2. Verifie via shared/weaponAmmoDsl.js + damageService.js : " +
    "des que tags.FX correspond a une des 6 familles mecaniques (APHC/SAP/SLAP/HP/EXPLOSIVE/SHRAPNEL), " +
    "ce FX devient la SEULE autorite de degats/armure/Choc - les clauses DMG=/CHOC= catalogue " +
    "deviennent cosmetiques. RANGE=AIR_X.../TXT=DEPTH=... ne sont reconnus par aucune cle du parseur : " +
    "purement decoratifs aujourd'hui, aucun impact en jeu. 5 lignes avaient donc un FX= manquant ou " +
    "emprunte a une autre munition, avec un vrai impact combat : Darts 5.56mm ST standard (FX=EXPLOSIVE " +
    "emprunte), Darts 7.62mm ST APHC (FX absent, ne percait rien), Darts 7.62mm ST assommant " +
    "(FX=EXPLOSIVE emprunte), Darts 7.62mm ST explosif (FX absent, aucun effet), Darts 7.62mm ST " +
    "standard (FX=IEM emprunte, -50% degats + panne electronique). Darts 7.62mm ST SAP/IEM deja " +
    "corrects (FX en place, migration_archive/209 pour SAP) - non touches. Migration " +
    "312_fix_ammo_effects_darts_762_556.js appliquee et verifiee (requete DB + parseAmmoEffects/" +
    "resolveAmmoMechanic en isolation)."

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
