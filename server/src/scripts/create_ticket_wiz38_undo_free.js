// Script à usage unique — nouveau ticket, trouvaille secondaire pendant WIZ38 (hors scope de ce
// ticket-la, note ou fix immediat par regle projet).
// Lancement manuel : node --env-file=.env server/src/scripts/create_ticket_wiz38_undo_free.js

import db from '../db/knex.js'

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: 'WIZ38-UNDOFREE1' }).first()
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
      title: 'CareersAllocator : redescendre a -3 sur une competence (X) annule le cout au lieu de facturer le deblocage',
      description:
        "Trouve en corrigeant WIZ38 (base=-3 au lieu de 0). Reducer ALLOC_SKILL supprime " +
        "l'allocation quand nextTarget <= base : correct pour une competence normale (retour a 0 = " +
        "jamais touchee, cout 0), mais pour une competence (X) le palier -3 EST une depense reelle " +
        "(calcSkillCost facture +1 pour target=-3 explicite, shared/polarisUtils.js ~L295-303) - la " +
        "supprimer au lieu de la stocker a -3 fait revenir le cout a 0, un remboursement implicite " +
        "non prevu par calcSkillCost. Effet pratique : un joueur qui ouvre une (X) par erreur (clic +) " +
        "peut annuler gratuitement en reclickant -, ce qui est probablement le comportement souhaite " +
        "cote UX (pas de cout a se raviser) mais contredit la note de shared/polarisUtils.js qui traite " +
        "-3 comme un palier paye. Decision a prendre : le -3 doit-il rester gratuit tant que la fiche " +
        "n'est pas finalisee (annulation = gratuite), ou faut-il le facturer des le premier clic ?",
      linked_bug_code: 'WIZ38-UNDOFREE1',
      status: 'new',
      priority: 'low',
      cluster_label: 'Marqueur compétence (X)/(-3)',
      admin_notes: 'Trouve en corrigeant WIZ38 - decision produit necessaire avant tout code.',
    })
    .returning(['id'])

  console.log(`Ticket cree : ${ticket.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
