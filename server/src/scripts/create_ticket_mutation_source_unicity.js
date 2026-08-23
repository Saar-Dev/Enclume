// Script à usage unique — nouveau ticket, trouvaille secondaire pendant la correction du wipe
// char_mutations non filtré en STEP3 (hors scope de ce correctif-là, note ou fix immédiat par
// règle projet).
// Lancement manuel : node --env-file=.env server/src/scripts/create_ticket_mutation_source_unicity.js

import db from '../db/knex.js'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: 'MUT-SRC-UNIQ1' }).first()
  if (existing) {
    console.log('Ticket deja present, rien a faire.')
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
      title: 'char_mutations : contraintes uniques non partitionnees par source (chosen/random/revers/campaign)',
      description:
        "Trouve en corrigeant le wipe non filtre de char_mutations en STEP3 (reconcileCreation, " +
        "creationService.js). Les index uq_char_mut_no_sub (char_sheet_id, mutation_id) WHERE " +
        "subtype_id IS NULL et uq_char_mut_with_sub (char_sheet_id, mutation_id, subtype_id) WHERE " +
        "subtype_id IS NOT NULL (migration 115_char_mutations_constraints.js) ne tiennent pas compte " +
        "de la colonne source. Une mutation 'revers' (octroyee Etape 4) et une mutation 'chosen'/" +
        "'random' (choisie Etape 3) partageant le meme mutation_id sont donc la MEME ligne aux yeux " +
        "de Postgres. Scenario : le personnage a une mutation revers active (mutation_id=X, sans " +
        "sous-type). Le joueur choisit ensuite librement cette meme mutation X en Etape 3. " +
        "L'upsert (INSERT ... ON CONFLICT (char_sheet_id, mutation_id) WHERE subtype_id IS NULL DO " +
        "UPDATE SET count = count + 1, creationService.js ~L831) retombe sur la ligne revers " +
        "existante et incremente SON compteur -- la ligne reste source='revers', sans jamais " +
        "refleter que le joueur a paye des PC pour un exemplaire supplementaire. Pour une mutation a " +
        "sous-type, c'est pire : l'insertion (INSERT nu, creationService.js ~L838, pas de onConflict) " +
        "leve une violation de contrainte Postgres brute, remontee comme erreur 500 non geree. Meme " +
        "mecanisme cote inverse (chosen deja present, revers accorde ensuite) via " +
        "mutationService.js#addMutation, appele par STEP4 (creationService.js ~L1384) avec le meme " +
        "ON CONFLICT non filtre par source -- ce chemin existe donc deja aujourd'hui, independamment " +
        "de tout correctif recent. Decision a prendre avant tout code : la semantique de `count` " +
        "doit-elle rester un total toutes sources confondues (auquel cas il faut au moins distinguer " +
        "explicitement quelle source 'possede' la ligne en cas de fusion), ou devenir un compteur " +
        "par source (ce qui change les index uniques et potentiellement l'affichage /le calcul PC) ? " +
        "Non instrumente en conditions reelles -- [VERIFIE] par lecture statique du schema et du code " +
        "(migration 115_char_mutations_constraints.js, creationService.js, mutationService.js).",
      linked_bug_code: 'MUT-SRC-UNIQ1',
      status: 'new',
      priority: 'low',
      cluster_label: 'char_mutations — unicité inter-source',
      admin_notes: 'Trouve en corrigeant le wipe STEP3 non filtre (char_mutations) - arbitrage produit necessaire sur la semantique de count avant tout code.',
    })
    .returning(['id'])

  console.log(`Ticket cree : ${ticket.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
