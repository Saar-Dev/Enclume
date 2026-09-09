// Script à usage unique — crée 2 tickets satellites du chantier grenades (Segment 3f), pour
// traitement par un agent dédié (la session grenades reste sur le cœur : 3-bis, 3d-4).
//   - GRENADE-COORD-MODS       : le Test de Coordination du lancer ignore confirmedModifiers
//   - GRENADE-THROW-ALLURE-GATE : isImpossibleRangedSituation bloque tout lancer (à trancher)
//
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_grenade_satellites.js
// Idempotent : ne recrée pas un ticket déjà présent (clé = linked_bug_code).

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'GRENADE-COORD-MODS',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    priority: 'medium',
    status: 'new',
    title: 'Grenade — le Test de Coordination du lancer ignore la difficulté (taille / situation)',
    description: `
Contexte : signalé par Saar (MJ) en combat réel (2026-09-09). La carte de jet « Grenade à
fragmentation — Lancer (Test de Coordination) » affiche « Dif. : — » alors que l'action portait
confirmedModifiers = {"situation":["cible_immobile"],"taille":"moyenne"}. Ces modificateurs ne
sont PAS appliqués au jet.

RAW [VÉRIFIÉ] (REGLES_ARMES_SPECIALES.md § « Grenades et mines ») : « Tout cela prend un Tour de
combat et nécessite un Test de Coordination, avec une Difficulté dépendant de la zone visée par le
personnage (utilisez les modificateurs des Tests de tir, liés à la taille des cibles). »

Cause racine [VÉRIFIÉ lecture code] : server/src/socket/socketCombatAoe.js#resolveGrenadeThrow
appelle resolveAoeAttackRoll avec pour seule contribution le « Malus santé / encombrement » —
la fonction ne reçoit même pas confirmedModifiers en paramètre. À comparer avec runAoePhaseA
(même fichier, fusil à pompe / lance-flammes) qui, lui, injecte bien TAILLE_MODS[taille] et
RANGED_SITUATION_MODS[situation] dans les contributions du jet (lignes ~103-114). Le chemin
grenade est donc incohérent avec les autres armes de zone.

Statut : écart DÉJÀ documenté comme simplification v1 assumée (PLAN_GRENADES.md §6 « pas de
modificateur de taille zone visée en v1 » + JOURNAL8). Ce ticket = décider quand le lever, et
comment.

Question de conception à trancher avant de coder : une grenade se vise sur un POINT au sol, pas
sur une cible — quelle « taille » a ce point ? Le chantier Taille met déjà les actions de zone à
'moyenne' (D7). Les modificateurs de situation (cible_immobile...) ont-ils un sens pour un point
statique ? Le RAW parle des « modificateurs des Tests de tir liés à la taille des cibles » — à
interpréter (difficulté de placer la grenade précisément à un endroit donné, selon l'exiguïté /
l'encombrement de la zone visée ?).

Correctif esquissé (NON codé) : passer confirmedModifiers à resolveGrenadeThrow, ajouter les
contributions taille + situation au jet de Coordination, sur le patron de runAoePhaseA. Aucun
risque données. Fichier : server/src/socket/socketCombatAoe.js.
`.trim(),
    context: {
      file: 'server/src/socket/socketCombatAoe.js#resolveGrenadeThrow',
      raw: 'REGLES_ARMES_SPECIALES.md § « Grenades et mines »',
      observed: 'Carte de jet « Grenade — Lancer (Test de Coordination) » : Dif. : —, jet 16 vs Seuil 12',
      inconsistency: 'runAoePhaseA (même fichier) applique taille+situation ; resolveGrenadeThrow non',
      documented_as: "simplification v1 assumée — PLAN_GRENADES.md §6, JOURNAL8",
      design_question: "quelle « taille » pour un point au sol visé ? sens des modificateurs de situation ?",
    },
  },
  {
    code: 'GRENADE-THROW-ALLURE-GATE',
    origin: 'gm',
    category: 'bug',
    domain: 'combat',
    priority: 'low',
    status: 'new',
    title: 'Grenade — le lancer est bloqué par « Allure maximale / obscurité totale » (à trancher)',
    description: `
Contexte : relevé pendant le chantier grenades 3f (2026-09-09), pas encore reproduit en jeu.

Comportement [VÉRIFIÉ lecture code] : server/src/socket/socketCombatAoe.js#resolveAoeAssaultAction,
juste après les gardes d'ouverture (ligne ~477) :

  if (isImpossibleRangedSituation(confirmedModifiers?.situation ?? [])) { ... COMBAT_DECLARE_ERROR ; return }

Ce garde s'exécute AVANT le bloc de lancer de grenade (aoe.intendedOrigin && !aoe.resolvedOrigin).
isImpossibleRangedSituation (shared/combatSituationMods.js) est vrai quand le tireur est à l'Allure
maximale ou dans l'obscurité totale. Conséquence : tout lancer de grenade (minuterie ET percussion)
est refusé dans ces deux cas, avec le message « Tir impossible — Allure maximale du tireur ou
obscurité totale ».

Pré-existant : s'applique à la minuterie depuis 3d (livrée et validée). Pas introduit par 3f.

[INCONNU] — à trancher :
- Allure maximale : le RAW dit que lancer une grenade « prend un Tour de combat » (une Action
  pleine) → si le personnage a sprinté, il n'a pas eu l'Action pour lancer → bloquer est
  défendable. MAIS la mécanique ne modélise pas « tu as dépensé ton Action en déplacement », elle
  hard-bloque via un garde pensé pour la précision d'un tir à distance. Un lob de grenade vers un
  point n'a pas la même exigence.
- Obscurité totale : on peut lancer une grenade approximativement vers un point même sans y voir
  (dispersion accrue, pas impossibilité).

Options (à évaluer, pas décider ici) :
  (a) garder le garde tel quel pour les grenades (Action pleine = cohérent) ;
  (b) exempter le lancer de grenade de ce garde ;
  (c) le remplacer par un modificateur plus doux (dispersion supplémentaire en obscurité, malus au
      Test de Coordination à l'Allure max).

Aucun risque données. Fichier : server/src/socket/socketCombatAoe.js.
`.trim(),
    context: {
      file: 'server/src/socket/socketCombatAoe.js#resolveAoeAssaultAction (~ligne 477)',
      gate: 'isImpossibleRangedSituation (shared/combatSituationMods.js) — Allure max / obscurité totale',
      scope: 'bloque minuterie ET percussion ; pré-existant depuis 3d',
      raw_hint: 'RAW : lancer une grenade « prend un Tour de combat » (Action pleine)',
      options: ['garder', 'exempter la grenade', 'remplacer par un modificateur doux'],
    },
  },
]

async function run() {
  for (const t of TICKETS) {
    const existing = await db('bug_tickets').where({ linked_bug_code: t.code }).first()
    if (existing) {
      console.log(`Ticket ${t.code} existe déjà (id=${existing.id}, statut=${existing.status}) — ignoré.`)
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
