// Script à usage unique — crée le ticket de l'écart trouvé en corrigeant WOUND-HEAL-LINE-CAPACITY (2026-09-26) : deux notions de « ligne pleine » coexistent.
// Le niveau de preuve est indiqué dans la description.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260926_ligne_pleine_conventions.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'WOUND-FULL-LINE-TWO-CONVENTIONS',
    category: 'other',
    domain: 'combat',
    title: 'Deux notions de « ligne pleine » : à l\'aggravation (la dernière case convertit) et à la guérison / Chance (toutes les cases cochées)',
    description: `
Trouvé en corrigeant WOUND-HEAL-LINE-CAPACITY (2026-09-26). [VÉRIFIÉ par exécution, transaction annulée] À l'aggravation, la 3ᵉ Légère sur la tête (3 cases) devient aussitôt une Moyenne :
\`isWoundLinePromoted\` convertit quand la blessure REMPLIRAIT la dernière case (\`currentCount >= maxCount - 1\`), donc une ligne ne contient jamais toutes ses cases (interprétation confirmée par
Saar, commentaire de shared/woundConstants.js). [VÉRIFIÉ par lecture] La Chance (\`hasSeverityRoom\`, \`currentCount < maxCount\`) et, depuis le correctif du 2026-09-26 (option B de Saar), la
guérison considèrent une ligne « pleine » quand TOUTES ses cases sont cochées. Conséquence : une guérison ou une Chance peut produire une ligne à 3/3 que l'aggravation ne produit jamais ;
la 3ᵉ blessure reçue ensuite la convertit. Le RAW (REGLEBLESSURES.md:47-53) parle de « toutes les cases cochées » PUIS d'une « nouvelle blessure » : lecture littérale = la notion de la guérison.

À trancher [INCONNU] par Saar (règle de jeu) : garder les deux (état actuel, documenté dans BLESSURES.md), ou unifier — soit l'aggravation passe à la lecture littérale (la 4ᵉ Légère convertit),
soit la Chance et la guérison passent à « la case qui remplirait la dernière convertit ». Ne pas corriger sans décision.
`.trim(),
    context: { fichiers: ['shared/woundConstants.js (isWoundLinePromoted)', 'server/src/lib/woundUtils.js (resolveWoundInsertion, hasSeverityRoom, resolveWoundImprovement)'], regle: 'docs/REGLES/REGLEBLESSURES.md:47-53' },
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
