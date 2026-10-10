// Script à usage unique — note de progression DEF5 : trou "tir de drone non couvert" (signalé par
// le ticket lui-même) corrigé, scénario réel en session restant à valider par Saar avant clôture.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_def5_drone_fix.js

import db from '../db/knex.js'

const CODE = 'DEF5'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : trou "tir de drone non couvert" corrigé ---\n' +
    "Tir et CaC humains + pilote d'exo avaient déjà le bonus +5 cible sans défense (isTargetDefenseless). " +
    "resolveDroneAssaultAction (socketCombatHelpers.js) ne l'avait jamais reçu : écrit avant le correctif " +
    "général DEF5 (commit 2026-07-19, n'a pas touché ce fichier-ci de drone), trou documenté par ce ticket " +
    "lui-même plutôt que corrigé en silence. Aucune raison RAW de l'exclure (REGLESYSCOMBAT.md:1052-1058 " +
    '« l\'Attaquant », sans distinction humain/drone ; commentaire d\'autorité isTargetDefenseless : ' +
    '« jamais dupliquée par type d\'attaque »). Corrigé : même pattern que le site Tir humanoïde ' +
    '(totalModComp += sansDefenseBonus, entrée de breakdown cibleSansDefense) — pas besoin de restructurer ' +
    "une branche défenseur, resolveDroneAssaultAction n'en a jamais eu (ni Tir ni CaC drone).\n\n" +
    'Testé : node --check, les 4 suites DB-backed qui touchent socketCombatHelpers.js (86/86, aucune ' +
    'régression), shared/**/*.test.mjs (947/947). Non testé : aucun test automatisé n\'exerce ' +
    'resolveDroneAssaultAction de bout en bout (aucun, pas seulement sur ce point) — il faudrait un monde ' +
    'compilé en fixture, hors de proportion avec ce correctif. Scénario réel en session requis pour ' +
    'clôturer : un drone qui tire sur une cible étourdie/inconsciente/surprise doit afficher le +5.'

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
