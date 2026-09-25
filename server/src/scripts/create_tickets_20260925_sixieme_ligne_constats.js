// Script à usage unique — crée les tickets des constats laissés ouverts par la clôture du Lot 2 du chantier « 6ᵉ ligne du
// compteur de blessures » (2026-09-25, docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md, docs/SYSTEME/BLESSURES.md). Le niveau de preuve
// est indiqué dans chaque description ([VÉRIFIÉ par exécution] / [VÉRIFIÉ par lecture] / [HYPOTHÈSE]).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20260925_sixieme_ligne_constats.js
// Écrit dans la base locale (bug_tickets) — à lancer par Saar.
// Idempotent : ne recrée pas un ticket dont le linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'WOUND-HEAL-CHAIN-STOPS',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Guérison des blessures : après une amélioration, la blessure obtenue n\'a plus aucune échéance de guérison',
    description: `
Trouvé à la clôture du Lot 2b (2026-09-25) [VÉRIFIÉ par exécution — sonde en transaction annulée : une Critique dont la dernière
occurrence de guérison réussit devient une Grave ; la table game_echeances ne contient ensuite plus AUCUNE échéance de guérison pour
la Grave]. Une blessure ne perd donc qu'UN cran de gravité tout seul : Critique → Grave, puis plus rien. Idem pour un Membre détruit
→ Critique (nouveau depuis le Lot 2b) et une Mortelle → Critique. Le RAW dit que les blessures « voient leur gravité décroître peu à peu,
jusqu'à disparaître totalement » (REGLEBLESSURES.md:366-367).

Cause [VÉRIFIÉ par lecture] : seul woundService.js:applyWound appelle initializeWoundHealingEcheance ; resolveWoundImprovement
(woundUtils.js) insère la blessure améliorée (« sa propre durée de guérison recommence à zéro », dit son commentaire) sans créer son
échéance, et le handler woundHealingCheckHandler ne la « spawn » pas (il ne spawn que l'infection). Préexistant à la 6ᵉ ligne, mais
plus visible avec elle.

Piste [HYPOTHÈSE] : créer l'échéance de la blessure obtenue dans la même transaction que l'amélioration (le handler reçoit déjà \`trx\`,
la campagne et le personnage), en réutilisant initializeWoundHealingEcheance (une seule autorité). Attention : la Chance
(finishWoundSeverityChoice) appelle aussi resolveWoundImprovement — décider si une blessure réduite par la Chance doit avoir son échéance.
`.trim(),
    context: { fichiers: ['server/src/lib/woundUtils.js (resolveWoundImprovement)', 'server/src/lib/woundEvolutionService.js (woundHealingCheckHandler)', 'server/src/lib/woundService.js'], doc: 'docs/SYSTEME/BLESSURES.md « Guérison et Infection »' },
    status: 'new',
    priority: 'high',
  },
  {
    code: 'WOUND-HEAL-LINE-CAPACITY',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Guérison : la capacité de la ligne cible n\'est pas vérifiée quand une blessure s\'améliore',
    description: `
Trouvé à la clôture du Lot 2b (2026-09-25) [VÉRIFIÉ par lecture] : resolveWoundImprovement (woundUtils.js) supprime la blessure puis
insère une case à la gravité inférieure sans regarder si cette ligne est déjà pleine. Une Mortelle (ou un Membre détruit) qui guérit vers
une Critique alors que la ligne Critique de la localisation est déjà pleine (2 cases) écrit une 3ᵉ case : le compteur dépasse la capacité
de la fiche papier sans se convertir (et sans être refusé). Préexistant ; toutes les guérisons sont concernées. Le chemin de la Chance,
lui, vérifie la place (computeAvailableSeverityReductions/hasSeverityRoom) avant de proposer une réduction.

À trancher [INCONNU] : que veut le RAW quand la ligne cible est pleine à la guérison — refuser l'amélioration, ou promouvoir (absurde pour
une guérison) ? Ne pas corriger sans décision de règle.
`.trim(),
    context: { fichier: 'server/src/lib/woundUtils.js (resolveWoundImprovement)' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'WOUND-DEATH-NO-TOKEN',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    title: 'Blessure « Mort » : un personnage sans token n\'est pas mort mécaniquement, et un token créé après la mort n\'a pas le statut',
    description: `
Limite connue du Lot 2b (2026-09-25) [VÉRIFIÉ par lecture + test en base] : la Mort (6ᵉ ligne en Tête/Corps) pose le statut \`dead\` sur les
TOKENS du personnage (reconcileWoundDeath, statusService.js) et la mort se lit sur les tokens (deathStateService.js:isCharacterDead). Un
personnage qui n'a jamais été posé sur une carte reçoit la blessure mais aucun statut : il n'est pas un cadavre pour la Chance ni le Choc
(un test en base fige ce comportement). Même chose si le token est créé APRÈS la mort : il n'a pas \`dead\`.

Piste [HYPOTHÈSE] : appliquer le statut à la création d'un token de personnage (réconciliation à partir des blessures) plutôt que de
stocker la mort sur la fiche — à décider avec le MJ (un mort qu'on place sur la carte doit-il apparaître mort ?).
`.trim(),
    context: { fichiers: ['server/src/lib/statusService.js (reconcileWoundDeath)', 'server/src/lib/deathStateService.js'], doc: 'docs/SYSTEME/STATUTS_TOKEN.md §8' },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'WOUND-STABILIZATION-UNMODELED',
    origin: 'gm',
    category: 'suggestion',
    domain: 'combat',
    title: 'Stabilisation des blessures graves : aucune règle ne lit l\'état « stabilisé » (Critique, Mortelle, Membre détruit)',
    description: `
Constaté à la clôture du Lot 2 (2026-09-25) [VÉRIFIÉ par lecture — recherche de is_stabilized dans server/src] : la colonne
character_wounds.is_stabilized existe (bouton « stabiliser » de la fiche, route PUT .../stabilize) mais AUCUNE règle ne la lit ; elle est
seulement recopiée par resolveWoundImprovement. Le RAW (REGLEBLESSURES.md:192-206 et 247-253) impose une stabilisation immédiate pour les
Critiques à risque d'hémorragie, les Mortelles et les Membres détruits : sans elle, une Critique se transforme en Mortelle après un Test
de Constitution raté, et un blessé mortel ne survit que Constitution minutes. Rien de tout cela n'est modélisé (VOCABULARY : « hors
périmètre de l'échéancier »). Le RAW exo (REGLEARMURE.md:1082-1086) prévoit aussi un Membre détruit « considéré comme stabilisé ».

Chantier de règles à cadrer (échelle minute par minute, distincte de la Guérison/Infection) — pas un correctif rapide.
`.trim(),
    context: { fichiers: ['server/src/routes/character/char-sheet.js (PUT stabilize)', 'server/src/lib/woundUtils.js'], regles: ['docs/REGLES/REGLEBLESSURES.md:192-206', 'docs/REGLES/REGLEBLESSURES.md:247-253'] },
    status: 'new',
    priority: 'medium',
  },
  {
    code: 'WOUND-SURVIVAL-MINUTES-HOURS',
    origin: 'gm',
    category: 'suggestion',
    domain: 'combat',
    title: 'RAW contradictoire : survie d\'un blessé mortel en « minutes » (p.237) ou en « heures » (p.240) — le code affiche des heures',
    description: `
Trouvé au cadrage du Lot 2b (2026-09-25) [VÉRIFIÉ à la lecture du RAW] : « Blessure mortelle/Membre détruit : le personnage peut survivre
pendant un nombre de minutes égal à son niveau de Constitution avant de mourir » (REGLEBLESSURES.md:247-248, non stabilisé) alors que
l'Infection donne « un nombre d'heures égal à sa Constitution » (REGLEBLESSURES.md:473-479, mortelle infectée). Ce sont deux situations
(sans stabilisation / après infection), donc peut-être deux valeurs voulues, mais le texte n'est pas explicite. Le code garde des HEURES
(décision du 2026-07-30 : délai de survie affiché au MJ, jamais appliqué) pour l'infection ; le cas « minutes » n'est pas modélisé
(voir WOUND-STABILIZATION-UNMODELED).

À trancher par Saar avec le livre : deux situations distinctes ? Puis journaliser la décision dans docs/JOURNAL8.md.
`.trim(),
    context: { regles: ['docs/REGLES/REGLEBLESSURES.md:247-248', 'docs/REGLES/REGLEBLESSURES.md:473-485'], code: 'server/src/lib/woundEvolutionService.js (survivalHoursInfo)' },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'ENCYCLO-COMPTEUR-HEADERS',
    origin: 'gm',
    category: 'bug',
    domain: 'encyclopedie',
    title: 'Encyclopédie : le tableau « Compteur de blessures » a ses en-têtes sur le mauvais axe',
    description: `
Trouvé à la clôture du Lot 2a (2026-09-25) [VÉRIFIÉ par lecture, non vérifié visuellement] : le tableau COMPTEUR_BLESSURES_TABLE
(transformCompteurBlessures, client/src/components/encyclopedia/dataSources.js) produit une ligne par GRAVITÉ avec une cellule par
LOCALISATION, mais l'en-tête déclaré dans blessures-seuils.json est « Localisation, Légère, Moyenne, Grave, Critique, Mortelle » (5
gravités, plus aucune colonne pour la 6ᵉ ligne) : les colonnes portent les noms de gravités alors qu'elles contiennent des localisations.
Préexistant à la 6ᵉ ligne (qui a seulement ajouté une ligne « Mort subite / Membre détruit » au tableau).

Correctif probable [HYPOTHÈSE] : en-têtes « Gravité, Tête, Corps, Bras droit, Bras gauche, Jambe droite, Jambe gauche ».
`.trim(),
    context: { fichiers: ['client/src/components/encyclopedia/fr/livre-4/etats-de-sante/blessures-seuils.json', 'client/src/components/encyclopedia/dataSources.js'] },
    status: 'new',
    priority: 'low',
  },
  {
    code: 'LINT-TOKENRADIALMENU-DOCLOSE',
    origin: 'gm',
    category: 'bug',
    domain: 'interface',
    title: 'TokenRadialMenu.jsx : erreur ESLint « doClose utilisée avant sa déclaration » (react-hooks/immutability)',
    description: `
Constaté pendant le Lot 2a (2026-09-25) [VÉRIFIÉ par exécution : \`cd client && npx eslint src/components/TokenRadialMenu.jsx\` → 1 erreur
+ 1 avertissement] : \`doClose\` est utilisée (ligne ~106) avant sa déclaration (ligne ~121) dans un useEffect dont le tableau de dépendances
l'omet (avertissement exhaustive-deps, ligne 115). Préexistant, non touché par le chantier. Sans effet observé en jeu à ce jour.
`.trim(),
    context: { fichier: 'client/src/components/TokenRadialMenu.jsx' },
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
