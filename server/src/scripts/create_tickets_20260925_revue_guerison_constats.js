// Script à usage unique — crée les tickets des constats trouvés en refaisant l'écran de revue des guérisons (Lot 2a, 2026-09-25,
// docs/PLANS/PLAN_REVUE_GUERISON.md §13). Le niveau de preuve est indiqué dans chaque description.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260925_revue_guerison_constats.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'GAMETIME-WIDGET-SWALLOWS-ERRORS',
    category: 'bug',
    domain: 'interface',
    title: "Widget d'horloge : les refus du serveur (ex. « avance déjà en attente ») sont avalés en console",
    description: `
Trouvé en refaisant l'écran de revue des guérisons (2026-09-25). [VÉRIFIÉ par lecture] \`GameTimeWidget.jsx\` (\`adjust\`) n'écrit une erreur de
\`POST game-time/request-advance\` que dans la console (\`console.error\`). Un MJ qui demande d'avancer le temps alors qu'une avance est déjà en attente reçoit un
409 (« Une avance de temps est déjà en attente de revue ») et ne voit RIEN : le clic paraît sans effet. Le Lot 2a rend l'avance en attente visible (l'écran de
revue reste affiché), ce qui supprime la cause pratique la plus fréquente, mais tout autre refus (durée hors bornes, réseau, droits) reste muet.

Piste [HYPOTHÈSE] : afficher l'erreur dans le widget (message du serveur ou clé i18n), même patron que le pied de l'écran de revue (\`notice\`).
`.trim(),
    context: { fichiers: ['client/src/components/GameTimeWidget.jsx'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'TIME-ADJUST-ROUTE-LEGACY',
    category: 'other',
    domain: 'infrastructure',
    title: "Route POST game-time/adjust : plus appelée par le client, peut laisser des échéances interactives dues sans revue",
    description: `
Trouvé en analysant le Lot 2a de l'écran de revue (2026-09-25). [VÉRIFIÉ par lecture] \`POST /campaigns/:id/game-time/adjust\` (campaigns.js) « laissée en place »
depuis le passage à \`request-advance\` ; aucun appelant dans \`client/src\`. [HYPOTHÈSE] elle avance l'horloge sans passer par la revue du MJ : des échéances
interactives (guérison, infection) déjà dues resteraient \`active\` sans jamais être ouvertes (l'écran de revue les compte alors en « prochaine ronde »).
[INCONNU] si un script, un test ou un outil externe l'appelle encore.

Piste : vérifier les appelants (scripts, tests, docs), puis la supprimer (un seul chemin d'avance du temps : \`request-advance\` → revue → \`confirm-advance\`).
`.trim(),
    context: { fichiers: ['server/src/routes/campaigns.js (game-time/adjust)', 'server/src/lib/gameTimeService.js (adjustGameTime)'] },
    status: 'new',
    priority: 'low',
  },
]

async function run() {
  for (const t of TICKETS) {
    const existing = await db('bug_tickets').where({ linked_bug_code: t.code }).first()
    if (existing) {
      console.log(`Ticket ${t.code} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
      continue
    }

    const [row] = await db('bug_tickets')
      .insert({
        origin: 'admin',
        category: t.category,
        domain: t.domain,
        title: t.title,
        description: t.description,
        context: JSON.stringify(t.context),
        status: t.status,
        priority: t.priority,
        linked_bug_code: t.code,
      })
      .returning(['id', 'status', 'priority'])

    console.log(`Ticket ${t.code} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
