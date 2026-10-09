// Script à usage unique — note de progression GRENADE-COORD-MODS : correctif codé et testé
// statiquement, scénario réel en session restant à valider par Saar avant clôture.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_grenade_coord_mods_fix.js

import db from '../db/knex.js'

const ID = '1fe37dd3-e505-4268-8263-68123e3e315d'

async function run() {
  const ticket = await db('bug_tickets').where({ id: ID }).first()
  if (!ticket) throw new Error(`Ticket ${ID} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-09 : correctif codé ---\n' +
    "Décision Saar : le RAW (\"modificateurs liés à la taille des cibles\") est inapplicable à la " +
    "grenade (vise toujours un point, jamais une créature) — remplacé par la distance réelle du " +
    "lancer. Portée reprise du Javelot (2/5/10/20 (40) m, shared/combatRange.js#GRENADE_THROW_RANGE, " +
    'migration 385). resolveGrenadeThrow (socketCombatAoe.js) calcule la distance réelle, résout le ' +
    'palier (resolveWeaponRangeBand, même autorité que toute arme à distance), rejette le lancer ' +
    'hors de portée (> 40 m), ajoute la contribution de portée + les modificateurs de situation ' +
    "propres au lanceur uniquement (jamais cible_*, aucune cible unique sur ce jet). Détail complet : " +
    'docs/JOURNAL8.md (2026-10-09). Trouvaille connexe ticketée séparément (69b70aed-833a-4ed7-8485-' +
    'aee72e0db860) : fusil à pompe/lance-flammes appliquent un bonus "cible immobile" systématique, ' +
    'pas corrigé ici.\n\n' +
    'Testé : node --check, shared/**/*.test.mjs 947/947 (nouveau test de garde ' +
    'GRENADE_THROW_RANGE), test ciblé base locale de la migration 385 (round-trip + idempotence), ' +
    'socketCombatHandWeaponAbsence.test.mjs + socketCombatAoe.test.mjs (aucune régression). Non ' +
    'testé : scénario réel en session (lancer à courte distance, à longue distance, et au-delà de ' +
    '40 m pour confirmer le refus) — aucun monde de test compilé ne couvre encore ce branchement ' +
    "précis, choix délibéré (la logique nouvelle est déjà couverte par les tests purs)."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé, scénario réel en session non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
