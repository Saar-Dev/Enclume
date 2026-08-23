// Script à usage unique — ticket WIZ46, créé et marqué in_progress dans le même script (bug trouvé
// et corrigé dans la même session, pas de délai entre découverte et correctif comme WIZ45/WIZ38).
// Pas 'resolved' : scénario réel navigateur (MJ + joueur) non testé.
// Lancement manuel : node --env-file=.env server/src/scripts/create_ticket_wiz46_step3_wipes_revers.js

import db from '../db/knex.js'

const CODE = 'WIZ46'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (existing) {
    console.log(`Ticket ${CODE} deja present, rien a faire.`)
    return
  }

  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouve.')

  const [ticket] = await db('bug_tickets')
    .insert({
      reporter_id: admin.id,
      origin: 'admin',
      category: 'bug',
      domain: 'wizard',
      title: "reconcileCreation STEP3 : wipe non filtre de char_mutations efface les mutations Revers de l'Etape 4",
      description:
        "Trouve par audit de granularite (session 2026-08-23, suite a une question Saar sur la " +
        "collaboration MJ/joueur en temps reel dans le Wizard). reconcileCreation §STEP3 " +
        "(creationService.js ~L821) faisait trx('char_mutations').where({char_sheet_id}).del() sans " +
        "filtrer par `source` -- efface TOUTES les mutations du personnage, y compris celles de " +
        "source='revers' (octroyees par STEP4 -- Revers/tirage de carriere), que la boucle de " +
        "reinsertion de STEP3 ne recree jamais (elle ne reinsere que chosen/random). Perte de " +
        "donnees : un joueur avec une mutation Revers active qui revient a l'Etape 3 (\"Changer de " +
        "methode\" -> Suivant, sans repasser par l'Etape 4 dans le meme appel reconcile) perd " +
        "silencieusement cette mutation. STEP4 fait deja l'operation symetrique correctement filtree " +
        "(char_mutations.where({source:'revers'}).del(), ligne ~1024, avec commentaire explicite " +
        "\"source='chosen'/'random' (STEP3) reste intact\") -- STEP3 n'appliquait pas la reciproque.",
      linked_bug_code: CODE,
      status: 'in_progress',
      priority: 'medium',
      cluster_label: 'Wizard — char_mutations',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes:
        "Corrige 2026-08-23 : .del() filtre desormais .whereIn('source', ['chosen', 'random']) " +
        "(creationService.js), symetrique au filtre deja en place cote STEP4. Test ajoute " +
        "creationRoundTrip.test.mjs (\"resubmit Step3 seul ne doit pas effacer une mutation Revers\"), " +
        "3/3 verts. Analyse a charge faite avant codage : un trou distinct et preexistant a ete " +
        "trouve au passage (contraintes uniques char_mutations non partitionnees par source, " +
        "collision possible chosen/revers sur le meme mutation_id) -- volontairement laisse hors " +
        "perimetre de ce correctif, trace separement (ticket MUT-SRC-UNIQ1). Non teste : scenario " +
        "reel navigateur (MJ + joueur).",
    })
    .returning(['id'])

  console.log(`Ticket ${CODE} cree et marque in_progress : ${ticket.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
