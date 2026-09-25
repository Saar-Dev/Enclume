// Script à usage unique — crée les tickets des constats laissés ouverts par la clôture du chantier « Permuter l'arme en combat »
// (2026-09-25, docs/Old/PLAN_PRISE_EN_MAIN.md, docs/SYSTEME/COMBAT.md « Permuter l'arme en combat »). Le niveau de preuve est indiqué
// dans chaque description ([VÉRIFIÉ par lecture] / [HYPOTHÈSE]).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260925_permuter_constats.js
// Écrit dans la base locale (bug_tickets) uniquement.
// Idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'PERMUTER-DUALWIELD-OFFHAND-E2E',
    origin: 'gm',
    category: 'other',
    domain: 'combat',
    title: 'Tir / corps à corps à deux armes dont seule la seconde arme manque : jamais testé de bout en bout',
    description: `
Trouvé à la clôture de « Permuter l'arme en combat » (2026-09-25). Quand la seconde arme d'un tir ou d'un corps à corps à deux armes n'est
plus en main à la résolution (rangée par une permutation, ou depuis la fiche), l'attaque continue avec l'arme principale et une notice
dédiée (\`session.dualWieldOffhandNotInHand\`) remplace l'ancien message « main non directrice à sec », qui était faux.

[VÉRIFIÉ par lecture] La décision de la notice (\`offhandNotInHandEmission\`, server/src/lib/combatHandWeaponNotice.js) est testée SEULE
(server/src/socket/socketCombatHandWeaponAbsence.test.mjs). Le branchement dans \`resolveAssaultAction\` (variable \`offhandAbsent\`) et dans
\`resolveMeleeAction\` (branche \`else\` du bonus « deux armes ») n'est couvert par aucun test de résolution : ces deux fonctions ne
s'exécutent jusqu'à ce point qu'avec un monde complet (ligne de vue, portée, positions).

À faire : un test de résolution avec une carte de test minimale (deux tokens, une pièce), ou un scénario en jeu : deux pistolets en main,
en ranger un par une permutation, déclarer le tir à deux armes, vérifier la notice et un seul coup tiré.
`.trim(),
    context: { fichiers: ['server/src/socket/socketCombatHelpers.js (resolveAssaultAction, resolveMeleeAction)', 'server/src/lib/combatHandWeaponNotice.js'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Fenêtre MJ et roster : l\'instantané /combat-equipment n\'est chargé qu\'une fois par carte, il devient périmé en combat',
    description: `
Trouvé pendant le Lot C de « Permuter l'arme en combat » (2026-09-25). [VÉRIFIÉ par lecture] \`setEquipment\` (client/src/components/
CombatGmDeclareWindow.jsx) n'est appelé qu'à l'ouverture d'une carte (\`useEffect\` sur \`battlemapId\`) : les armes en main de chaque token
restent celles du chargement, même après une permutation résolue, une grenade lancée ou un changement d'équipement par le MJ.

Corrigé pour le PNJ ACTIF de la fenêtre MJ : ses armes en main sont maintenant dérivées de son inventaire (\`client/src/lib/pnjHandEquipment.js\`),
rechargé à chaque Tour. Reste périmé : (1) les pastilles Distance / Contact / « ··· » du roster de la fenêtre MJ pour les AUTRES tokens
(\`isRanged(tid)\`, \`equipment[tid]?.weapon\`) ; (2) CombatRosterWindow (compteur « PNJ sans arme », choix d'arme rapide).

Piste [HYPOTHÈSE] : rafraîchir l'instantané à chaque nouveau Tour (ou sur les événements INVENTORY_*), ou dériver les pastilles de l'inventaire
de chaque PNJ comme pour le PNJ actif.
`.trim(),
    context: { fichiers: ['client/src/components/CombatGmDeclareWindow.jsx (equipment, isRanged)', 'client/src/components/CombatRosterWindow.jsx', 'server/src/routes/battlemaps.js (GET /:id/combat-equipment)'] },
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
        origin: t.origin,
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
