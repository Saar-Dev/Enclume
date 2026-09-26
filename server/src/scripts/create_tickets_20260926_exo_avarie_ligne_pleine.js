// Script à usage unique — crée le ticket de l'écart trouvé à l'analyse à charge du Lot A de PLAN_GUERISON_RAW (2026-09-26) : le compteur d'Avaries des exo-armures
// recopie la lecture « la case qui complèterait la ligne convertit », que le Lot A retire des Blessures des personnages. Le niveau de preuve est indiqué dans la description.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260926_exo_avarie_ligne_pleine.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'EXO-AVARIE-LINE-CONVENTION',
    category: 'other',
    domain: 'combat',
    title: 'Compteur d\'Avaries des exo-armures : la case qui complèterait la ligne convertit (le livre dit : ligne complète PUIS nouvelle Avarie)',
    description: `
Trouvé à l'analyse à charge du Lot A de PLAN_GUERISON_RAW (2026-09-26). [VÉRIFIÉ par lecture] \`server/src/lib/exoAvarieService.js:70\` convertit quand \`currentCount >= table.maxCount - 1\`
(commentaire \`shared/exoConstants.js:80-82\` : « même interprétation que resolveWoundInsertion »). Le livre (\`docs/REGLES/REGLEARMURE.md:333-337\`) écrit : « quand une ligne est complète alors qu'on doit noter
une Avarie de cette gravité, on coche une case dans le niveau supérieur et on efface toutes les cases cochées de la ligne complète » — lecture littérale : la ligne se remplit entièrement, la
Avarie SUIVANTE convertit. Le compteur des Blessures des personnages passe à la lecture littérale (Lot A, décision de Saar : le livre fait autorité) ; celui des exo-armures est resté sur l'ancienne lecture.
Effet actuel : une Catastrophique (2 cases) ne se remplit jamais, la 2ᵉ convertit en Destruction ; en lecture littérale, 2 tiennent et la 3ᵉ détruit.

À faire [INCONNU] : décision de Saar (règle de jeu), puis réutiliser la fonction partagée du Lot A (\`isWoundLineFull\`, \`shared/woundConstants.js\`) plutôt qu'une seconde copie de la règle, et réécrire
\`exoAvarieService.test.mjs\` (test « 2e Avarie catastrophique »). Les cases du compteur d'exo ont été confirmées séparément (PLAN_EXOARMURE §11.2).
`.trim(),
    context: { fichiers: ['server/src/lib/exoAvarieService.js (resolveAvarieIncrement)', 'shared/exoConstants.js (EXO_AVARIE_TABLE)'], regle: 'docs/REGLES/REGLEARMURE.md:333-337' },
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
