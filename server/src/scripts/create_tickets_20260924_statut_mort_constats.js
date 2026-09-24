// Script à usage unique — crée les tickets des constats laissés ouverts par la clôture du chantier « Statut Mort »
// (2026-09-24, docs/Old/PLAN_STATUT_MORT.md §8, docs/SYSTEME/STATUTS_TOKEN.md §8). Aucun n'est bloquant ; chacun a été
// vérifié par lecture de code pendant le chantier (le niveau de preuve est indiqué dans chaque description).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260924_statut_mort_constats.js
// Écrit dans la base locale (bug_tickets) — à lancer par Saar.
// Idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'STATUT-BADGES-LIMITE-3',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Badges de statut : un token « Mort » peut ne pas se voir quand il porte plus de 4 statuts',
    description: `
Constaté pendant le chantier « Statut Mort » (2026-09-24) [VÉRIFIÉ par lecture] : TokenStatusBadges
(client/src/components/TokenPresentation.jsx) n'affiche que 3 badges au-delà de 4 statuts. Un statut « Mort » posé après
plusieurs autres peut donc ne pas apparaître sur le token, alors que c'est le statut le plus important à lire d'un coup d'œil.

Piste [HYPOTHÈSE] : trier l'affichage par importance (catégorie « mort » d'abord, puis les statuts qui bloquent) avant de tronquer.
`.trim(),
    context: { fichier: 'client/src/components/TokenPresentation.jsx', doc: 'docs/SYSTEME/STATUTS_TOKEN.md §8' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'STATUT-EVANOUI-I18N-PANEL',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Statut « Évanoui » : pas de texte (clé i18n) ni d\'entrée dans le panneau des statuts',
    description: `
Constaté au chantier « Statut Mort » (2026-09-24) [VÉRIFIÉ] : le code \`evanoui\` (posé par la Fatigue, palier « À bout de
force ») figure au registre shared/tokenStatusRegistry.js mais n'a ni clé \`status.evanoui\` dans client/src/locales/fr.json ni
entrée de panneau (inPanel: false) — le badge s'affiche sans libellé. Le test tokenStatusRegistry.test.mjs n'exige icône +
clé i18n que pour les statuts affichés au panneau ou bloquants, ce qui l'exclut. Depuis 2026-09-24 \`evanoui\` est aussi interdit
sur un cadavre.

Correctif simple : ajouter la clé \`status.evanoui\` (et l'icône SVG si absente), puis décider s'il doit apparaître au panneau.
`.trim(),
    context: { fichier: 'shared/tokenStatusRegistry.js', locale: 'client/src/locales/fr.json' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'STATUT-REFUS-MESSAGE-PNJ',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Message de refus « vous êtes mort/étourdi/inconscient » affiché même quand le MJ déclare pour un PNJ',
    description: `
Constaté au chantier « Statut Mort » (2026-09-24) [VÉRIFIÉ par lecture] : client/src/lib/useCombatSocket.js compose le message
de refus à partir de status.<code> (« vous êtes … ») sans savoir si l'acteur est le joueur lui-même ou un PNJ que le MJ fait
agir. Rare depuis le blocage proactif (le moteur passe le token bloqué sans fenêtre) : ne reste visible que par le filet des
gardes STUN2 (statut posé entre le choix du pas et le clic).
`.trim(),
    context: { fichier: 'client/src/lib/useCombatSocket.js', filet: 'server/src/socket/socketCombatResolution.js (gardes STUN2)' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'STATUT-STUN-PROMPT-ORPHELIN-MORT',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Fenêtre de durée d\'étourdissement encore affichée chez un joueur quand son personnage meurt',
    description: `
Limite connue du chantier « Statut Mort » (2026-09-24) [VÉRIFIÉ par lecture, non reproduit en jeu] : si un joueur a déjà
une fenêtre « durée d'étourdissement » (COMBAT_STUN_PROMPT) ouverte quand son personnage est marqué « Mort », applyDeathConsequences
supprime la ligne combat_pending 'stun' et diffuse la mise à jour des statuts, mais aucun événement ne ferme la fenêtre
côté client ; sa confirmation (COMBAT_STUN_CONFIRM) est ignorée faute de ligne. Sans conséquence sur la partie, mais la fenêtre
reste affichée.

Piste [HYPOTHÈSE] : réutiliser l'événement de mise à jour de statut (TOKEN_STATUS_UPDATED) pour fermer une fenêtre de stun dont
le token est devenu un cadavre, ou émettre un événement dédié depuis applyDeathConsequences.
`.trim(),
    context: { fichier: 'server/src/lib/statusService.js (applyDeathConsequences)', client: 'CombatStunWindow' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'COMBAT-WOUNDS-403-PNJ',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Bruit 403 « pas la permission » : la fenêtre d\'un joueur demande les blessures d\'un PNJ qui agit',
    description: `
Constaté au test en jeu du chantier « Statut Mort » (2026-09-24) [VÉRIFIÉ par lecture + logs] : quand un PNJ agit, la fenêtre
d'action d'un joueur demande GET /api/char-sheet/<id du PNJ>/wounds (client/src/components/CombatActionWindow.jsx, ~ligne 384-392,
via playerToken.character_id) et le serveur répond 403 (fiche non possédée) ; le .catch masque l'erreur (setMortallyWounded(false)).
Inoffensif mais bruyant dans les logs à chaque action de PNJ.
`.trim(),
    context: { fichier: 'client/src/components/CombatActionWindow.jsx' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'COMBAT-DRONES-ONLY-LOOP',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Combat composé uniquement de drones en « ordres permanents » : les Tours défilent sans fin',
    description: `
Noté à l'analyse du lot « blocage proactif » (2026-09-24) [HYPOTHÈSE — lu, non reproduit] : si tous les combattants actifs sont
des drones en ordres permanents, le Tour est entièrement pré-annoncé (prefillAutonomousDroneOrders) et endTurn → annonce →
résolution → endTurn s'enchaîne sans personne pour l'arrêter. Préexistant ; non aggravé par le blocage proactif (les drones
drone_auto ne comptent pas comme acteurs dans son garde-fou anti-boucle, donc « mort + drones seuls » garde l'ancien
comportement : la fenêtre du mort s'ouvre).

À reproduire avant de cadrer un correctif.
`.trim(),
    context: { fichiers: ['server/src/socket/combatTurnEngine.js (prefillAutonomousDroneOrders, endTurn)'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'STATUT-EXO-PILOTE-PARITE',
    origin: 'gm',
    category: 'suggestion',
    domain: 'combat',
    title: 'Exo-armure pilotée : les statuts bloquants sont lus sur le token de l\'exo, pas sur celui du pilote',
    description: `
Limite connue du chantier « Statut Mort » (2026-09-24) [VÉRIFIÉ par lecture] : getDeclarationBlockedTokens lit les statuts du
token qui agit (l'exo), comme les gardes STUN2 qu'elle remplace (parité conservée volontairement). Un pilote étourdi ou mort dont le
token n'est pas celui de l'exo n'est donc pas vu comme bloquant. Seule la Chance tient compte du pilote (resolveChanceRecipientCharacterId :
exo morte OU pilote mort). À trancher avec le comportement voulu en jeu (un pilote inconscient fait-il agir son exo ?).
`.trim(),
    context: { fichiers: ['server/src/socket/combatTurnEngine.js', 'server/src/lib/exoPilotService.js'] },
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
