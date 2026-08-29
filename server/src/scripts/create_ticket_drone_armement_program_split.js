// Script à usage unique — crée le ticket DRONE-ARMEMENT-PROGRAM-SPLIT (question de règle, pas un
// bug bloquant). Trouvé en corrigeant DRONE-CC-MELEE-MISCLASS. Décision produit à trancher par Saar.
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_drone_armement_program_split.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'DRONE-ARMEMENT-PROGRAM-SPLIT'

const DESCRIPTION = `
Question de règle (pas un bug bloquant) — relevée en corrigeant DRONE-CC-MELEE-MISCLASS.

resolveDroneAssaultAction (socketCombatHelpers.js) exige le programme d'armement STRICTEMENT
correspondant au type d'arme : armement_contact pour une arme de contact, armement_distance pour une
arme à distance. Aucun repli de l'un sur l'autre : un drone avec seulement « Balistique »
(armement_distance) ne peut pas attaquer au contact, et inversement.

Le RAW (REGLEDRONE.md / Livre de Base p.281) ne décrit qu'UN seul « programme de contrôle armement »
par arme : « L'arme automatique effectue alors ses attaques en utilisant le programme de contrôle
armement comme une Compétence. » Les noms « Tir 15 » / « Attaque 15 » des exemples de drones sont du
flavor, pas deux mécaniques distinctes. Le seed le reconnaît à demi : le programme « Contact »
(armement_contact) est décrit « Programme d'attaque générique (contact ou distance) », alors que
« Balistique » est « attaques à distance » seulement — asymétrie non justifiée.

Options à trancher (Saar) :
  a) Garder le split strict (un programme par type) — assumer l'écart RAW, le documenter dans
     docs/REGLES/REGLEDRONE.md + docs/SYSTEME/COMBAT.md (§1.9 CLAUDE.md).
  b) Repli : si le programme du type demandé manque, accepter l'autre programme d'armement du drone.
  c) Modèle RAW complet : un seul concept « contrôle armement », éventuellement lié par FK à l'arme
     (drone_weapons.program_id) — « il faut un programme par arme ».

Impact actuel : faible tant que les drones sont montés avec le bon programme pour leur arme (cas de
Drone AX après le fix DRONE-CC-MELEE-MISCLASS). Devient gênant dès qu'un drone a plusieurs armes de
types différents, ou un seul programme « générique ».
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
      category: 'suggestion',
      domain: 'combat',
      title: 'Armement drone : split strict armement_contact / armement_distance vs RAW (un seul programme par arme)',
      description: DESCRIPTION,
      context: JSON.stringify({
        site: 'server/src/socket/socketCombatHelpers.js — resolveDroneAssaultAction',
        raw: 'REGLEDRONE.md / Livre de Base p.281 — « programme de contrôle armement » unique',
        found_while: 'fix DRONE-CC-MELEE-MISCLASS',
      }),
      status: 'new',
      priority: 'low',
      linked_bug_code: CODE,
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
