// Script à usage unique — crée les tickets des constats trouvés en corrigeant WOUND-HEAL-CHAIN-STOPS (2026-09-25 : chaque case de blessure
// naît avec son échéance de guérison, docs/SYSTEME/BLESSURES.md « Guérison et Infection »). Le niveau de preuve est indiqué dans chaque
// description ([VÉRIFIÉ par exécution] / [VÉRIFIÉ par lecture] / [HYPOTHÈSE] / [INCONNU]).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260925_guerison_chaine_constats.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'WOUND-ECHEANCE-GHOSTS',
    category: 'bug',
    domain: 'combat',
    title: 'Échéances de guérison fantômes : supprimer une blessure ne retire pas son échéance',
    description: `
Trouvé en corrigeant WOUND-HEAL-CHAIN-STOPS (2026-09-25). [VÉRIFIÉ en base locale] : 89 des 99 échéances \`wound_healing_check\` actives pointent une
blessure qui n'existe plus (10 seulement ont leur blessure). [VÉRIFIÉ par lecture] : aucune suppression de blessure ne retire son échéance —
\`removeWound\` et \`clearCharacterWoundsAndStatuses\` (woundService.js), la cascade de promotion (\`resolveWoundInsertion\`), et la réduction par la
Chance (\`resolveWoundImprovement\` hors du handler de guérison, qui, lui, termine l'échéance par le moteur). Les handlers traitent une blessure
absente en no-op (« se terminent d'elles-mêmes »), mais l'échéance reste \`active\` : \`getPendingReviewForGm\` (woundReviewService.js) inclut les
échéances actives et dues, avec \`wound: null\` — le MJ verra des lignes de revue vides quand l'horloge avancera. [INCONNU] : le rendu exact côté
client (BlessuresReviewPanel.jsx) d'une ligne sans blessure.

Piste [HYPOTHÈSE] : la vie de l'échéance suit celle de sa case — la retirer (annulation) dans le même écrivain unique (woundUtils.js, qui la crée déjà
depuis WOUND-HEAL-CHAIN-STOPS) et dans les suppressions ; ou une colonne \`wound_id\` avec clé étrangère \`ON DELETE CASCADE\` sur \`game_echeances\` (le
moteur générique garde aujourd'hui un \`payload\` opaque : à décider). Prévoir le nettoyage des 89 lignes existantes.
`.trim(),
    context: { fichiers: ['server/src/lib/woundService.js', 'server/src/lib/woundUtils.js', 'server/src/lib/woundReviewService.js', 'server/src/lib/echeanceService.js'] },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'WOUND-LEGERE-NEVER-HEALS',
    category: 'bug',
    domain: 'combat',
    title: 'Blessure Légère : rien ne la fait jamais disparaître (le RAW : 1 jour, guérison naturelle)',
    description: `
Trouvé en corrigeant WOUND-HEAL-CHAIN-STOPS (2026-09-25). Le RAW (REGLEBLESSURES.md:413-420) : Blessure légère, durée de guérison 1 jour, guérison
naturelle, aucun soin. [VÉRIFIÉ par lecture] : \`getWoundHealing('legere')\` vaut null (« Légère guérit seule, sans échéance ») mais AUCUN code ne retire
ensuite la case (recherche dans server/src : ni échéance, ni purge à l'avance du temps). [NON OBSERVÉ en jeu] : les 5 Légères de la base locale sont
toutes récentes (l'horloge de campagne n'a pas avancé). Conséquence : la chaîne de guérison (désormais complète : Critique → Grave → Moyenne → Légère)
s'arrête sur une Légère qui reste indéfiniment, et les lignes de Légères pleines finissent par promouvoir vers la Moyenne.

Piste [HYPOTHÈSE] : une échéance NON interactive (patron automatique, sans revue du MJ : le RAW n'exige aucun Test) qui retire la case 1 jour après
son écriture, programmée par le même écrivain unique (woundUtils.js). Décision de règle à confirmer : retrait à 1 jour exact.
`.trim(),
    context: { fichiers: ['shared/woundConstants.js (getWoundHealing)', 'server/src/lib/woundHealingSchedule.js', 'server/src/lib/echeanceService.js'], regle: 'docs/REGLES/REGLEBLESSURES.md:413-420' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'ECHEANCE-SPAWN-UNDO',
    category: 'bug',
    domain: 'combat',
    title: 'Échéances créées par un handler (spawn) absentes du journal d\'annulation d\'une avance de temps',
    description: `
Trouvé en corrigeant WOUND-HEAL-CHAIN-STOPS (2026-09-25). [VÉRIFIÉ par lecture] : \`resolveEcheanceHandler\` (echeanceService.js) crée les échéances de \`spawn\`
(ex. l'Infection d'un Échec/Catastrophe de guérison) sans aucune entrée d'annulation, alors que \`cancelPendingAdvance\` (gameTimeService.js) ne rejoue que
le journal \`pending_advance_undo_log\`. Annuler l'avance après un Échec/Catastrophe restaure l'échéance de guérison mais laisse l'échéance d'infection créée
[HYPOTHÈSE : elle reste \`active\`, déjà due, et sera proposée au MJ pour une guérison qu'il a annulée]. Non reproduit en jeu ni par un test.

Piste [HYPOTHÈSE] : le moteur ajoute lui-même, pour chaque échéance qu'il crée, \`{ table: 'game_echeances', rowId, previousValues: null }\` au journal (comme il le
fait déjà pour la ligne résolue), sans que les handlers aient à s'en soucier.
`.trim(),
    context: { fichiers: ['server/src/lib/echeanceService.js', 'server/src/lib/gameTimeService.js'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'WOUND-VAULT-NO-CAMPAIGN',
    category: 'bug',
    domain: 'personnage',
    title: 'Personnage du Coffre (sans campagne) : une blessure Moyenne ou plus est refusée avec le message trompeur « Ligne pleine »',
    description: `
Trouvé en corrigeant WOUND-HEAL-CHAIN-STOPS (2026-09-25). [VÉRIFIÉ par lecture] : \`POST /api/char-sheet/:characterId/wounds\` accepte le propriétaire d'un personnage
du Coffre (\`req.isVaultOwner\`, campaign_id NULL) ; \`applyWound\` programme alors l'échéance de guérison avec \`campaignId = null\`, mais
\`game_echeances.campaign_id\` est NOT NULL : la transaction échoue, \`applyWound\` retourne null et la route répond 400 « Ligne pleine — gravité maximale
atteinte » (faux). Une Légère (sans échéance) passe. Comportement PRÉEXISTANT et inchangé par WOUND-HEAL-CHAIN-STOPS (l'identité de programmation est
toujours celle de l'appelant). [NON REPRODUIT en jeu] ; 3 personnages sans campagne en base locale, aucune blessure.

Décision produit à prendre : un personnage du Coffre reçoit-il des blessures ? Si oui, sans échéance (pas d'horloge où la programmer) ; sinon refus clair
(4xx et message dédié), pas « ligne pleine ».
`.trim(),
    context: { fichiers: ['server/src/routes/character/char-sheet.js (POST /:characterId/wounds)', 'server/src/lib/woundService.js (applyWound)', 'server/src/lib/echeanceService.js (createEcheance)'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'WOUND-HEAL-ONESHOT-STUCK',
    category: 'bug',
    domain: 'combat',
    title: 'Moyenne/Grave : après un Échec (sans « soins continus ») ou une Catastrophe, la blessure reste bloquée sans aucune échéance de guérison',
    description: `
Trouvé en cadrant l'écran de revue des guérisons (2026-09-25, docs/PLANS/PLAN_REVUE_GUERISON.md §2). [VÉRIFIÉ par lecture] woundEvolutionService.js:woundHealingCheckHandler :
pour une échéance UNIQUE (Moyenne/Grave), « echec » sans \`soinsContinues\` donne \`reschedule: null\`, et « catastrophe » passe par \`buildRecurringReschedule\`, qui vaut null pour une échéance
unique : dans les deux cas l'échéance se termine (\`completed\`) et la blessure reste à sa gravité, sans plus aucune échéance de guérison — même famille de défaut que
WOUND-HEAL-CHAIN-STOPS (une case guérissable sans échéance vivante). Le RAW donne « guérison naturelle : oui » aux Moyennes et Graves (REGLEBLESSURES.md:421-425) : elles ne devraient pas rester
bloquées. Cette absence de reprise vient d'une décision de Saar du 2026-07-30 (case « le personnage continue-t-il d'être soigné ? »), que Saar juge aujourd'hui à retirer (double emploi avec « Soin »).
Non observé en jeu.

Piste [HYPOTHÈSE], à décider avec Saar (PLAN_REVUE_GUERISON.md §6 Q2) : toujours reprogrammer une nouvelle tentative (à la durée de la gravité) après un Échec ou une Catastrophe, et retirer la case.
`.trim(),
    context: { fichiers: ['server/src/lib/woundEvolutionService.js (woundHealingCheckHandler)', 'client/src/components/BlessuresReviewPanel.jsx'], plan: 'docs/PLANS/PLAN_REVUE_GUERISON.md', regle: 'docs/REGLES/REGLEBLESSURES.md:421-425' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'WOUND-PNJ-ECHEANCES-FLOOD',
    category: 'suggestion',
    domain: 'combat',
    title: 'Chaque PNJ blessé reçoit une échéance de guérison à chaque case : le RAW réserve ce système aux PJ et aux adversaires marquants',
    description: `
Constaté en analysant l'écran de revue des guérisons (2026-09-25, docs/PLANS/PLAN_REVUE_GUERISON.md §9 A5). [VÉRIFIÉ en base locale] : 77 des 99 échéances \`wound_healing_check\` appartiennent à des personnages de type
« pnj », 22 à des « pj ». [VÉRIFIÉ par lecture] : \`applyWound\` programme une échéance de guérison pour toute blessure Moyenne+ de n'importe quel personnage. Le RAW (REGLEBLESSURES.md:207-224, « simplifier la gestion des blessures
des PNJ (optionnel) ») dit que le système de blessures détaillé est réservé aux personnages des joueurs et à leurs adversaires les plus marquants ; pour les autres PNJ, ne tenir compte que de la gravité la plus importante.
Effet en jeu : la revue de guérison (confirmation d'une avance de temps refusée tant qu'une échéance n'a pas de réponse) est encombrée par des PNJ mineurs que le MJ ne suit pas.

Piste [HYPOTHÈSE], à décider avec Saar : option de campagne « PNJ : guérison détaillée » (défaut : seulement les PNJ marqués), ou marquage d'un PNJ « marquant ». Le plan de l'écran de revue les affiche repliés en attendant.
`.trim(),
    context: { fichiers: ['server/src/lib/woundService.js (applyWound)', 'server/src/lib/woundUtils.js'], regle: 'docs/REGLES/REGLEBLESSURES.md:207-224', plan: 'docs/PLANS/PLAN_REVUE_GUERISON.md' },
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
