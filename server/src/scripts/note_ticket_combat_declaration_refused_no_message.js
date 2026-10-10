// Script à usage unique — note de progression COMBAT-DECLARATION-REFUSED-NO-MESSAGE : deux
// correctifs codés et testés (DB-backed), scénario réel en session restant à valider par Saar avant
// clôture.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_combat_declaration_refused_no_message.js

import db from '../db/knex.js'

const CODE = 'COMBAT-DECLARATION-REFUSED-NO-MESSAGE'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : deux correctifs codés ---\n' +
    "1) Cause la plus probable du signalement : Tir visé humain (aimTranches > 0, option réelle du " +
    "panneau de Tir) plantait à CHAQUE déclaration (ReferenceError `weapon is not defined`, " +
    "socketCombatAnnouncement.js, variable hors de portée), rattrapé par le catch global du handler " +
    "sans aucun message au joueur. Corrigé en réutilisant assaultWeaponFireModeRaw, déjà hoistée pour " +
    "ce même problème de portée et déjà utilisée correctement 30 lignes plus haut. Reproduit puis " +
    "corrigé via un test qui déclare un vrai Tir visé (vraie base) — annulé le correctif pour " +
    "confirmer le même message d'erreur exact, remis pour confirmer le test vert.\n" +
    "2) Audit complet du handler COMBAT_ACTION_DECLARE : 12 refus de déclaration ne renvoyaient rien " +
    "au joueur (garde FSM, payload invalide, ownership PNJ/drone/exo/personnage, déjà déclaré ce " +
    "Tour — le cas le plus probable en usage réel, double-clic/réessai réseau —, phase plus en " +
    "Annonce). Chacun a désormais un message explicite. Ajouté aussi un message dans les deux catch " +
    "globaux jusque-là muets (COMBAT_ACTION_DECLARE et COMBAT_SKIP_PLAYER), et uniformisé un site qui " +
    "émettait l'événement générique 'error' au lieu de WS.COMBAT_DECLARE_ERROR. Aucune logique de " +
    "refus modifiée.\n\n" +
    'Testé : node --check, 107/107 tests DB-backed (dont 3 nouveaux ciblés sur ces deux correctifs), ' +
    'shared/**/*.test.mjs (947/947), aucune régression. Non testé : scénario réel en session — ' +
    'nécessite de cliquer "Tir visé" en combat et de provoquer un double-clic/refus pour confirmer ' +
    "l'affichage côté navigateur."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'in_progress', // codé et testé, scénario réel en session non testé
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
