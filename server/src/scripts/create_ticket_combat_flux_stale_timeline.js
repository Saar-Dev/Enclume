// Script à usage unique — trouvé en explorant COMBAT-MULTI-ATTACK-ROUND-BROKEN (2026-10-03).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_combat_flux_stale_timeline.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'COMBAT-FLUX-DOC-STALE-TIMELINE'

const DESCRIPTION = `
Contexte : en explorant COMBAT-MULTI-ATTACK-ROUND-BROKEN, j'ai vérifié la signature actuelle de
\`resolveMeleeAction\` (server/src/socket/socketCombatHelpers.js:1368) pour comprendre comment
plusieurs attaques dans un même round sont enchaînées. Elle n'a **plus** de paramètres
\`remainingMeleeActions\`/\`totalMeleeCount\` — cette récursion a été retirée lors du passage à la
résolution par échelle (docs/Old/PLAN_COMBAT_TIMELINE.md, confirmé par docs/Old/JOURNAL7.md).

[VÉRIFIÉ par lecture] docs/SYSTEME/COMBAT_FLUX.md §7 (« Pipeline CaC Humanoïde : resolveMeleeAction »)
décrit encore l'ancienne architecture dans son intégralité : \`multiAttackMalus\` comme variable
calculée inline (ligne 438, alors qu'il vient maintenant de \`computeMultiAttackMalus\`,
combatTurnEngine.js, qui recompte les entrées sœurs \`declaration_group_id\` non lost/skipped à
l'instant de la résolution) et surtout la ligne 485 : « CaC 4b : remainingMeleeActions.length > 0 →
resolveMeleeAction récursif » — mécanisme qui n'existe plus. Une série d'attaques déclarées ensemble
devient désormais plusieurs entrées d'échelle séparées (combatTurnEngine.js::buildTimelineEntries),
chacune résolue par son propre appel à resolveMeleeAction/resolveAssaultAction au moment où
advanceTimeline l'atteint — pas par récursion immédiate.

Impact : documentation de référence (SYSTEME, autorité au-dessus des PLANS par
docs/RegleDocumentaire.md Règle 12) qui induirait en erreur quiconque s'y fie pour diagnostiquer le
flux combat actuel — ce que j'ai moi-même fait une première fois avant de vérifier le code (corrigé
dans mes propres commentaires/JOURNAL8.md le même jour).

Pas un correctif de quelques lignes : au moins §7 (CaC) entier à réécrire selon le modèle échelle, et
probablement §6/§8 (Tir Multi, Résolution) à vérifier pour la même dérive avant de clore. Hors
périmètre du chantier en cours (un plan = un seul problème) — à traiter comme son propre lot
documentaire.
`.trim()

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (existing) {
    console.log(`Ticket ${CODE} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
    return
  }

  const [row] = await db('bug_tickets')
    .insert({
      origin: 'admin',
      category: 'other',
      domain: 'combat',
      title: "docs/SYSTEME/COMBAT_FLUX.md §7 decrit une recursion resolveMeleeAction/remainingMeleeActions qui n'existe plus (passage a la resolution par echelle)",
      description: DESCRIPTION,
      context: JSON.stringify({
        fichiers: ['docs/SYSTEME/COMBAT_FLUX.md (§7, et probablement §6/§8)', 'server/src/socket/socketCombatHelpers.js (resolveMeleeAction)', 'server/src/socket/combatTurnEngine.js (computeMultiAttackMalus, buildTimelineEntries)'],
        plan_historique: 'docs/Old/PLAN_COMBAT_TIMELINE.md',
      }),
      status: 'new',
      priority: 'low',
      linked_bug_code: CODE,
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
