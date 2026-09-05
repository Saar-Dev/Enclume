// Script à usage unique — crée le ticket NATWEAPON-CHOC-DEFENSE-GAP.
// Trouvé en analyse à charge de PLAN_CHOC_EXO_DRONE.md (2026-09-05) en traçant le chemin de champs
// nécessaire au Palier D de ce plan (weaponRefId) — même trou structurel repéré par ricochet pour
// naturalWeaponCharMutationId, indépendant de l'exo/du drone. Pas corrigé dans ce plan (périmètre =
// Choc exo/drone), ticketé séparément à la demande de Saar.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_natweapon_choc_defense_gap.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'NATWEAPON-CHOC-DEFENSE-GAP'

const DESCRIPTION = `
Contexte : trouvé par audit de code (pas par un signalement joueur/MJ), en traçant pour
PLAN_CHOC_EXO_DRONE.md le chemin de champs nécessaire pour faire circuler weaponRefId (Choc arme
exo/drone) à travers le round-trip « défenseur PJ actif ». Le même trou existe déjà pour
naturalWeaponCharMutationId, sans rapport avec l'exo/le drone.

Diagnostic [VÉRIFIÉ par lecture de code, PAS ENCORE reproduit en session réelle] :

getEffectiveMeleeDamage (server/src/lib/damageService.js:195-244) donne priorité au Choc de mutation
à arme naturelle (branche naturalWeaponCharMutationId && charSheetId, ex. Corne "+1D6 si tête") sur
le Choc d'arme équipée. Ce champ est bien transporté dans commonPending par resolveMeleeAction
(socketCombatHelpers.js:1818) et correctement consommé par les 3 branches défenseur à résolution
IMMÉDIATE : resolveDefenselessTarget (:1863,1877), resolveMeleeDefensePnj (:1942,2025),
resolveMeleeDefenseDrone (:2084,2099).

Mais la 4e branche défenseur — resolveMeleeDefensePj (:2120-2143, défenseur PJ qui a droit à une
VRAIE défense active, round-trip via combat_pending type 'melee_defense') — passe par un chemin
différent : confirmMeleeDefense (:586-730) redéstructure 'pending' à la main deux fois (ligne
603-615, puis reconstruit un ctx plus petit ligne 703-710) avant d'appeler
resolveMeleeDefenseHitAttackerPj (:736-784, attaquant PJ) ou resolveMeleeDefenseHitAttackerPnj
(:792-, attaquant PNJ/exo/drone). AUCUNE de ces 4 listes de champs (les 2 de confirmMeleeDefense +
les déstructurations des 2 fonctions Hit*) n'inclut naturalWeaponCharMutationId — vérifié par grep
exhaustif sur le fichier (server/src/socket/socketCombatHelpers.js).

Conséquence : un attaquant humanoïde porteur d'une mutation à arme naturelle avec bonus de Choc
(ex. Corne, LdB p.243, "+1D6 si tête"), qui touche un défenseur PJ ayant activement tenté de se
défendre (et échoué/perdu l'opposition), perd le bonus de Choc de sa mutation — getEffectiveMeleeDamage
retombe sur la branche weaponInvId (arme équipée, si présente) ou "mains nues", jamais la branche
mutation. Aucune erreur, résultat de jeu simplement incomplet (Choc réduit ou absent).

Portée : uniquement le sous-cas "attaquant avec arme naturelle à Choc" ET "défenseur PJ qui se
défend activement" (les 3 autres types de défenseur — sans défense, PNJ, drone — sont sains). Cas
de figure a priori rare (mutation à arme naturelle + Choc + adversaire PJ actif), pas de portée
connue plus large.

Sites concernés (server/src/socket/socketCombatHelpers.js) :
- 603-615 (confirmMeleeDefense, 1re déstructuration de pending)
- 703-710 (confirmMeleeDefense, ctx reconstruit pour les fonctions Hit*)
- 736-742 (resolveMeleeDefenseHitAttackerPj, déstructuration de ctx)
- 792-798 (resolveMeleeDefenseHitAttackerPnj, déstructuration de ctx)

Recommandation (NON codée) : ajouter naturalWeaponCharMutationId aux 4 listes ci-dessus, même
patron que le champ existant weaponInvId qui, lui, est déjà correctement transporté sur ce chemin.
Correctif isolé et mécanique, mais à traiter comme son propre cluster (cause distincte du Choc
exo/drone) — voir aussi la note générale sur le pattern de relais par listes de champs recopiées à
la main, PLAN_CHOC_EXO_DRONE.md §3 (dette structurelle plus large, ROADMAP.md §5, pas traitée ici
non plus).

Prochaine étape avant tout code : reproduire en session réelle (PJ/PNJ avec mutation à arme
naturelle à Choc attaque un défenseur PJ qui se défend activement et se fait toucher malgré tout ;
observer l'absence du bonus de Choc/Test de Choc dans le résultat).
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
      title: 'CaC : Choc de mutation à arme naturelle perdu quand le défenseur PJ se défend activement',
      description: DESCRIPTION,
      context: JSON.stringify({
        sites: [
          'server/src/socket/socketCombatHelpers.js:603-615 (confirmMeleeDefense, 1re déstructuration)',
          'server/src/socket/socketCombatHelpers.js:703-710 (confirmMeleeDefense, ctx reconstruit)',
          'server/src/socket/socketCombatHelpers.js:736-742 (resolveMeleeDefenseHitAttackerPj)',
          'server/src/socket/socketCombatHelpers.js:792-798 (resolveMeleeDefenseHitAttackerPnj)',
        ],
        healthy_paths: ['resolveDefenselessTarget', 'resolveMeleeDefensePnj', 'resolveMeleeDefenseDrone (résolution immédiate, naturalWeaponCharMutationId déjà transporté)'],
        broken_path: 'resolveMeleeDefensePj (défenseur PJ, défense active, round-trip confirmMeleeDefense)',
        found_during: 'Analyse à charge de docs/PLANS/PLAN_CHOC_EXO_DRONE.md (2026-09-05), en traçant le champ weaponRefId (exo/drone) sur le même chemin',
        reproduction_status: 'PAS ENCORE reproduit en session réelle — diagnostic par lecture de code uniquement',
      }),
      status: 'triaged',
      priority: 'low',
      linked_bug_code: CODE,
      admin_notes: 'Cluster distinct de EXODRONE-CONFIRMDAMAGE-CRASH et de PLAN_CHOC_EXO_DRONE.md — ne pas corriger dans le même commit (cause racine différente, même pattern structurel). Reproduction en session réelle requise avant correctif.',
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
