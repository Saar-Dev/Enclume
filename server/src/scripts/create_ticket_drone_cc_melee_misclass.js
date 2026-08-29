// Script à usage unique — crée le ticket DRONE-CC-MELEE-MISCLASS.
// Le code drone confondait le mode de tir « CC » (Coup par Coup) avec le corps à corps → une arme
// drone à distance en mode CC était classée CaC, le serveur exigeait alors le programme
// armement_contact au lieu d'armement_distance. Diagnostic établi sur données réelles (Drone AX /
// Fusil Gauss). CORRECTIF CODÉ le 2026-08-30 (périmètre A — discriminant ref_category, miroir exo),
// ticket créé en 'in_progress', validation navigateur Saar en attente avant 'resolved'.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_drone_cc_melee_misclass.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'DRONE-CC-MELEE-MISCLASS'

const DESCRIPTION = `
Contexte : signalé par Saar (MJ) en combat réel. « Armement drone — programme armement_contact
manquant même en cas de tir à distance. » Repro : Drone AX, arme « Fusil Gauss », déclarer une
attaque → à la Résolution, jet remplacé par « Armement Drone — programme "armement_contact"
manquant / Configurer le programme dans la fiche drone », aucun dé lancé.

Diagnostic [VÉRIFIÉ sur données réelles + lecture code] :

État en base (2026-08-29) :
- Drone AX (characters 68dd27af-…) a UNE arme : Fusil Gauss (drone_weapons 7e60f6fc-…,
  equipment_id e7efbb54-…). ref_equipment « Fusil Gauss » : category = « Arme lourde »,
  fire_mode = « CC », range = « 70/350/700/1400 (2 100) » — arme à DISTANCE, donnée correcte.
- drone_weapons.fire_mode = « cc » (posé à l'insert depuis ref_equipment.fire_mode.toLowerCase(),
  char-sheet.js POST /drone/weapons).
- Programmes du drone : armement_distance « Balistique » niv. 8, detection niv. 6. PAS de
  armement_contact.

Cause racine : le code drone lit « fire_mode === 'cc' » comme « corps à corps ». Faux — « CC » =
Coup par Coup, un MODE DE TIR (shared/fireModes.js : FIRE_MODE_ORDER = ['CC','RC','RL'] ; une arme
de contact n'a AUCUN fire_mode). En base, les 39 « Arme de contact » ont toutes fire_mode NULL, et
« CC » est le mode de tir le plus répandu des armes à distance. Le Fusil Gauss (mode CC) est donc
classé CaC à tort → resolveDroneAssaultAction choisit category = 'armement_contact' (au lieu de
'armement_distance') → programme absent → attaque non résolue.

Sites du bug (heuristique fire_mode → CaC) :
- server/src/socket/socketCombatHelpers.js:2527  (isCaCWeapon dans resolveDroneAssaultAction)
- client/src/lib/buildDeclarePayload.js:155       (buildDroneMapActions — route melee vs attack)
- client/src/lib/useDroneDeclare.js:68 et :97     (resolveDroneClickAttackMode, handleChooseTarget)

Le repli « !ref_fire_mode → contact » de ces sites est en plus MORT côté drone :
drone_weapons.fire_mode est NOT NULL DEFAULT 'rc' (migration 39).

Correctif attendu (NON codé — calqué sur l'exo, qui a déjà abandonné cette heuristique,
PLAN_EXOARMURE.md §16.4) : discriminant = ref_equipment.category === 'Arme de contact' (autorité,
équivaut à fire_mode NULL), aux 4 sites, + ajouter « ref_equipment.category as ref_category » au
SELECT de GET /:characterId/drone/weapons (la route exo le fait déjà, char-sheet.js:2187). Arme
drone « maison » sans equipment_id (category NULL) → à distance, même choix assumé que l'exo.

Question ouverte séparée (autre ticket si besoin) : le RAW (REGLEDRONE.md p.281) décrit UN seul
« programme de contrôle armement » par arme, pas un couple contact/distance ; le seed décrit d'ailleurs
« Contact » comme « Programme d'attaque générique (contact ou distance) ». Le split strict
armement_contact / armement_distance sans repli de l'un sur l'autre est peut-être lui-même une
divergence RAW.

Impact : bloque TOUTE attaque drone dont l'arme est en mode CC (le cas courant). Client + serveur.
Aucun risque données (le fix touche du code de classification + un SELECT).

Correctif (2026-08-30, périmètre A validé avec Saar) : discriminant = ref_equipment.category ===
'Arme de contact' aux 4 sites + ajout de ref_category au SELECT de GET /drone/weapons (POST/PUT
aussi). Repli mort '!ref_fire_mode' supprimé. Tests golden master buildDeclarePayload.test.mjs
réécrits (3 cas encodaient la mauvaise règle + 1 régression ajoutée). node --test shared (335) /
client lib (183) / serveur (79) verts, vite build propre, eslint iso-baseline. Détail
docs/JOURNAL8.md. Reste : validation navigateur Saar (attaque drone à distance résolue).
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
      title: 'Armement drone : le mode de tir « CC » (Coup par Coup) confondu avec le corps à corps',
      description: DESCRIPTION,
      context: JSON.stringify({
        drone: 'Drone AX (68dd27af-2d0c-4bd2-813b-ebb830b60037)',
        weapon: 'Fusil Gauss — ref_equipment category "Arme lourde", fire_mode "CC", range 70/350/700/1400',
        sites: [
          'server/src/socket/socketCombatHelpers.js:2527',
          'client/src/lib/buildDeclarePayload.js:155',
          'client/src/lib/useDroneDeclare.js:68',
          'client/src/lib/useDroneDeclare.js:97',
        ],
        fix_pattern: "ref_equipment.category === 'Arme de contact' (miroir exo, PLAN_EXOARMURE.md §16.4)",
      }),
      status: 'in_progress',
      priority: 'high',
      linked_bug_code: CODE,
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
