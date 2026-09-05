// Script à usage unique — crée le ticket EXODRONE-CONFIRMDAMAGE-CRASH.
// Trouvé en traçant le chemin de données pour PLAN_CHOC_EXO_DRONE.md (analyse à charge du plan,
// 2026-09-05) — bug indépendant du Choc, découvert en vérifiant si `chocDsl` pourrait réellement
// circuler jusqu'à confirmDamage pour un tireur exo/drone. Pas encore reproduit en session réelle
// (serveur non lancé pendant l'audit, cf. AGENTS.md) — diagnostic établi par lecture de code +
// test empirique isolé du comportement Knex (voir CONTEXT). Statut 'triaged', pas 'in_progress' :
// reproduction en session réelle requise avant correctif (docs/SYSTEME/TICKETS.md §4, étape 2).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_exodrone_confirmdamage_crash.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'EXODRONE-CONFIRMDAMAGE-CRASH'

const DESCRIPTION = `
Contexte : trouvé par audit de code (pas par un signalement joueur/MJ), en analysant à charge
PLAN_CHOC_EXO_DRONE.md — en vérifiant si un chocDsl pré-calculé pourrait vraiment atteindre
confirmDamage pour un tireur exo/drone, découverte que le chemin plante avant même d'y arriver.

Diagnostic [VÉRIFIÉ par lecture de code + test isolé Knex, PAS ENCORE reproduit en session réelle] :

confirmDamage (server/src/socket/socketCombatHelpers.js:868-981), branche 'assault' (pendingType
!== 'melee'), appelle SANS AUCUNE GARDE :
  const effectiveDamage = await damageService.getEffectiveWeaponDamage(db, weaponInvId, { rangeBand: portee })
getEffectiveWeaponDamage → _fetchWeaponAndAmmo (damageService.js:20-35) fait
.where({ 'char_inventory.id': weaponInvId }) sans jamais vérifier que weaponInvId est défini.

Test isolé (Knex 3.2.10, version du projet, query builder seul — aucune connexion DB requise) :
  knex('char_inventory').where({ 'char_inventory.id': undefined }).select('*').toSQL()
  → THROWS: "Undefined binding(s) detected when compiling SELECT. Undefined column(s): [char_inventory.id]"

Or resolveAttackHitPj (socketCombatHelpers.js:2776-2811) — utilisée par TOUT tireur exo ou drone visant
un PJ (Tir exo, Tir drone, ET CaC drone : resolveDroneAssaultAction route les deux vers le même
dispatch final, socketCombatHelpers.js:2631-2640) — arme son combat_pending avec 'type: assault'
(littéral, ligne 2800) SANS JAMAIS INCLURE weaponInvId dans le payload (contrairement à
resolveAssaultHitPj, le chemin humanoïde, qui le fournit toujours — ligne 3282).

Conséquence : quand un PJ est touché par un Tir exo, un Tir drone, ou un CaC drone (pas CaC exo —
voir plus bas), et clique pour confirmer ses dégâts, confirmDamage plante DANS son propre
try/catch (ligne 911-980) → console.error avalé, AUCUNE émission. Le combat_pending est déjà
supprimé et advanceTimeline() déjà appelé (lignes 882-899, AVANT le try) → la partie continue
comme si de rien n'était. Le PJ ne prend AUCUN dégât, aucune trace côté client.

Portée exacte (les 4 combinaisons tireur non-humanoïde × cible PJ) :
- Tir exo → PJ        : CRASH (resolveAttackHitPj, comme ci-dessus)
- Tir drone → PJ       : CRASH (même resolveAttackHitPj, resolveDroneAssaultAction)
- CaC drone → PJ       : CRASH (CaC drone réutilise le dispatch Tir, pas de branche CaC dédiée —
                          dette déjà documentée docs/ROADMAP.md §5)
- CaC exo → PJ         : SAIN — passe par resolveMeleeDefensePj/confirmDamage branche 'melee', qui
                          appelle getEffectiveMeleeDamage (damageService.js:195), laquelle GARDE
                          bien 'if (weaponInvId)' avant de fetcher (pas de crash, mais Choc
                          manquant séparément — voir PLAN_CHOC_EXO_DRONE.md)

Hypothèse sur la non-détection à ce jour : le premier combat exo réel validé (docs/ROADMAP.md
ligne 66, 2026-08-27, "échange normal dans les deux sens") oppose très probablement un PJ pilotant
une exo à un PNJ (cible PNJ → auto-résolution immédiate, ne touche jamais confirmDamage). Le combat
drone n'a lui-même "jamais été retesté en jeu réel depuis le refactor DRY" (docs/ROADMAP.md §1,
ligne "combat drone jamais retesté..."). Un exo/drone tirant sur un PJ (pas son propre pilote) est
un cas de figure plus rare en campagne (PvP, PNJ pilotant une exo/un drone hostile) — cohérent avec
le fait que ce chemin n'ait jamais été exercé.

Sites concernés :
- server/src/socket/socketCombatHelpers.js:868-981 (confirmDamage, branche assault non gardée)
- server/src/socket/socketCombatHelpers.js:2776-2811 (resolveAttackHitPj, payload sans weaponInvId)
- server/src/lib/damageService.js:20-35,67-69 (_fetchWeaponAndAmmo/getEffectiveWeaponDamage, aucune
  garde sur weaponInvId)

Impact : silencieux, aucune erreur visible joueur/MJ, la Résolution "réussit" en apparence (jet
d'attaque affiché, "touché") mais la confirmation de dégâts ne se termine jamais. Combat non
bloqué (advanceTimeline tourne quand même) mais résultat de jeu faux : le PJ visé ne subit jamais
les dégâts d'un tir exo/drone.

Recommandation (NON codée) — deux options possibles, à trancher au triage :
1. Garder confirmDamage/resolveAttackHitPj séparés : garder 'weaponInvId ?' avant l'appel à
   getEffectiveWeaponDamage (comme getEffectiveMeleeDamage le fait déjà) + replier sur
   pending.chocDsl si un chocDsl pré-calculé est présent (nécessaire de toute façon pour
   PLAN_CHOC_EXO_DRONE.md, qui ajoute ce champ).
2. Lié à docs/ROADMAP.md §5 (dispatch de résolution combat, dette déjà connue) — un rework plus
   large du dispatch pourrait absorber ce correctif, mais Saar a déjà tranché (2026-08-26) de ne
   pas mélanger ce chantier avec un correctif ponctuel.

Prochaine étape avant tout code : reproduire en session réelle (exo ou drone tire sur un PJ,
PJ confirme ses dégâts, observer l'absence de résultat + le log serveur "confirmDamage error").
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
      category: 'bug',
      domain: 'combat',
      title: 'Tir exo/drone sur un PJ (et CaC drone) : confirmDamage plante silencieusement, aucun dégât appliqué',
      description: DESCRIPTION,
      context: JSON.stringify({
        sites: [
          'server/src/socket/socketCombatHelpers.js:868-981 (confirmDamage, branche assault non gardée)',
          'server/src/socket/socketCombatHelpers.js:2776-2811 (resolveAttackHitPj, payload sans weaponInvId)',
          'server/src/lib/damageService.js:20-35,67-69 (_fetchWeaponAndAmmo/getEffectiveWeaponDamage)',
        ],
        reachable_combos: ['Tir exo → PJ', 'Tir drone → PJ', 'CaC drone → PJ'],
        safe_combo: 'CaC exo → PJ (passe par getEffectiveMeleeDamage, déjà gardée)',
        empirical_test: "knex('char_inventory').where({ 'char_inventory.id': undefined }) → throw 'Undefined binding(s) detected'",
        found_during: 'Analyse à charge de docs/PLANS/PLAN_CHOC_EXO_DRONE.md (2026-09-05)',
        reproduction_status: 'PAS ENCORE reproduit en session réelle — diagnostic statique + test Knex isolé uniquement',
      }),
      status: 'triaged',
      priority: 'high',
      linked_bug_code: CODE,
      admin_notes: 'Reproduction en session réelle requise avant correctif (docs/SYSTEME/TICKETS.md §4 étape 2). Corrigible à moindre coût en même temps que PLAN_CHOC_EXO_DRONE.md Palier 0, qui touche exactement confirmDamage/resolveAttackHitPj pour une autre raison.',
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
