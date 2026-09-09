// Script à usage unique — crée le ticket « consommer une grenade libère la main du personnage »
// (constat Saar 2026-09-09, en marge de la validation du chantier Mode modificateurs de combat).
// Domaine grenades (docs/PLANS/PLAN_GRENADES.md) — pas le périmètre du chantier en cours.
// Lancement manuel : node --env-file=.env server/src/scripts/note_ticket_grenade_hand_release.js

import db from '../db/knex.js'

async function run() {
  const title = 'Grenades — lancer une grenade libère la main alors que d\'autres grenades restent en réserve'
  const existing = await db('bug_tickets').where({ title }).first()
  if (existing) {
    console.log(`Ticket déjà présent (${existing.id}) — rien à faire.`)
    return
  }

  const [row] = await db('bug_tickets')
    .insert({
      origin: 'gm',
      category: 'bug',
      domain: 'combat',
      title,
      description:
        'Constaté par Saar en jeu réel le 2026-09-09.\n\n' +
        'Quand un personnage lance une grenade, sa main est marquée comme libre (arme en main retirée) ' +
        'même s\'il lui reste d\'autres grenades du même type dans son inventaire. Attendu : tant qu\'il ' +
        'reste des grenades disponibles, la « main » du personnage devrait rester occupée par la grenade ' +
        '(ou le comportement d\'équipement doit être clarifié RAW).\n\n' +
        'Piste : logique de consommation du lancer (resolveGrenadeThrow / mise à jour inventaire + ' +
        'getOwnedHandWeapon) — le retrait de l\'arme en main ne devrait être conditionné qu\'à ' +
        '« plus aucune grenade de ce type ». Voir docs/PLANS/PLAN_GRENADES.md.',
      status: 'new',
      priority: 'medium',
      context: JSON.stringify({ chantier: 'PLAN_GRENADES.md', repere: 'lancer grenade — consommation / main en main' }),
    })
    .returning(['id'])

  console.log(`Ticket créé : ${row.id}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
