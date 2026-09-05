// Script à usage unique — crée le ticket CHOC-TEST-WRONG-ATTRIBUTION.
// Trouvé par Saar en testant le lance-flammes exo en zone (session réelle, 2026-09-05) : le Test de
// Choc affiché dans le chat porte le nom/couleur du TIREUR ("Armure Alpha", l'exo qui a tiré) alors
// que RAW c'est la CIBLE qui résiste au Choc. Vérifié : la résolution mécanique elle-même est
// correcte (statusService.resolveShockTest reçoit bien for_na/con_na/vol_na de la CIBLE) — seule
// l'étiquette DICE_RESULT (username/color affichés dans le chat) est fausse. Confirmé présent à 7
// endroits distincts, y compris le Tir/CaC humain classique (pas lié à l'exo/au drone, pas introduit
// par PLAN_CHOC_EXO_DRONE.md) — défaut ancien et généralisé.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_choc_test_wrong_attribution.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'CHOC-TEST-WRONG-ATTRIBUTION'

const DESCRIPTION = `
Contexte : signalé par Saar (MJ) en session réelle, en validant PLAN_CHOC_EXO_DRONE.md (lance-flammes
tiré en zone par une exo, "Armure Alpha") — le chat affichait "Armure Alpha" (le tireur) faisant un
Test de Choc, alors que RAW c'est la cible touchée qui résiste au Choc (LdB p.243), pas l'attaquant.

Diagnostic [VÉRIFIÉ par lecture de code] :

statusService.emitShockDiceResult (server/src/lib/statusService.js:214-231) émet un DICE_RESULT
purement d'affichage — { userId, username, color, skillLabel: 'Test de Choc', ... } — vers le chat de
tous les clients. Le résultat mécanique lui-même (shockResult, calculé par
statusService.resolveShockTest, appelé depuis damageService.js#resolveTargetHit) utilise déjà
correctement for_na_cible/con_na_cible/vol_na_cible — LES STATS DE LA CIBLE, jamais celles du tireur.
Seule l'étiquette (qui apparaît en tête du jet dans le chat) est fausse : chacun des 7 appels à
emitShockDiceResult lui passe le userId/username/color du TIREUR, jamais de la cible.

Portée réelle — 7 sites, TOUS antérieurs à PLAN_CHOC_EXO_DRONE.md, aucun n'est spécifique à
l'exo/au drone :
- server/src/socket/socketCombatAoe.js:289 (resolveAoeTargetDamage — tronc AOE, tout tireur)
- server/src/socket/socketCombatHelpers.js:838 (resolveMeleeDefenseHitAttackerPnj)
- server/src/socket/socketCombatHelpers.js:1094 (resolveDamageConfirmNormalTarget)
- server/src/socket/socketCombatHelpers.js:1931 (resolveDefenselessTarget)
- server/src/socket/socketCombatHelpers.js:2074 (resolveMeleeDefensePnj)
- server/src/socket/socketCombatHelpers.js:2773 (resolveAttackHitPnj)
- server/src/socket/socketCombatHelpers.js:3405 (resolveAssaultHitPnjNormal)

Impact : purement d'affichage/attribution dans le chat — aucun effet sur le résultat mécanique (le
Choc/l'étourdissement s'appliquent correctement à la bonne cible avec les bonnes stats). Mais trompeur
pour le MJ/les joueurs : laisse penser que c'est le tireur qui teste sa résistance au Choc, jamais la
cible touchée — contraire au RAW affiché.

Recommandation (NON codée) : à chacun des 7 sites, remplacer le userId/username/color du tireur par
ceux de la cible dans l'appel à emitShockDiceResult. Nécessite de vérifier, site par site, quelle
identité de cible est déjà disponible dans le scope (ex. cibleCharacter.user_id pour un PJ ; PNJ/exo/
drone n'ont pas de compte utilisateur propre — comportement à définir : username générique type nom du
personnage, userId null, cf. patron déjà utilisé ailleurs pour les jets PNJ). Un seul cluster (même
cause racine, même correctif type) mais 7 endroits à modifier — pas un correctif d'une ligne.

Hors périmètre de PLAN_CHOC_EXO_DRONE.md (Choc exo/drone) — cause et portée totalement différentes,
touche le Tir/CaC humain classique en premier lieu. Ticketé séparément à la demande de Saar.
`.trim()

async function run() {
  const existing = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (existing) {
    console.log(`Ticket ${CODE} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
    return
  }

  const [row] = await db('bug_tickets')
    .insert({
      origin: 'gm',
      category: 'bug',
      domain: 'combat',
      title: 'Test de Choc affiché dans le chat sous le nom du tireur au lieu de la cible',
      description: DESCRIPTION,
      context: JSON.stringify({
        sites: [
          'server/src/socket/socketCombatAoe.js:289 (resolveAoeTargetDamage)',
          'server/src/socket/socketCombatHelpers.js:838 (resolveMeleeDefenseHitAttackerPnj)',
          'server/src/socket/socketCombatHelpers.js:1094 (resolveDamageConfirmNormalTarget)',
          'server/src/socket/socketCombatHelpers.js:1931 (resolveDefenselessTarget)',
          'server/src/socket/socketCombatHelpers.js:2074 (resolveMeleeDefensePnj)',
          'server/src/socket/socketCombatHelpers.js:2773 (resolveAttackHitPnj)',
          'server/src/socket/socketCombatHelpers.js:3405 (resolveAssaultHitPnjNormal)',
        ],
        mechanically_correct: true,
        display_only: true,
        found_during: 'Validation session réelle de PLAN_CHOC_EXO_DRONE.md (2026-09-05), lance-flammes exo en zone — "Armure Alpha" (tireur) affiché faisant le Test de Choc',
        reproduction_status: 'Observé directement en session réelle par Saar — reproduit',
      }),
      status: 'triaged',
      priority: 'medium',
      linked_bug_code: CODE,
      admin_notes: 'Cluster distinct de PLAN_CHOC_EXO_DRONE.md — ne pas corriger dans le même commit (cause et portée différentes, touche aussi le Tir/CaC humain). 7 sites à corriger ensemble (même correctif type), pas un fix d\'une ligne.',
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
