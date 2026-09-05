// Script à usage unique — crée le ticket suggestion WEAPON-STATE-CHANGE-VISIBILITY.
// Proposé par Saar (2026-09-05) en testant PLAN_CHOC_TEST_ATTRIBUTION.md : une déclaration de tir en
// zone (lance-flammes) a été refusée par le serveur avec « Action exclusive : ... (changement
// d'arme) » — vérifié : la règle s'applique correctement (l'arme est passée de rangée à au clair
// dans la même déclaration, un vrai changement d'état, pas un faux positif comme le bug déjà corrigé
// le 2026-09-04 sur le mode de tir). Le problème n'est PAS mécanique — c'est que rien à l'écran
// n'indique au joueur que ce changement d'état a eu lieu avant qu'il ne reçoive le refus.
//
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_ticket_weapon_state_change_visibility.js
// Idempotent : ne recrée pas le ticket s'il existe déjà (clé = linked_bug_code).

import db from '../db/knex.js'

const CODE = 'WEAPON-STATE-CHANGE-VISIBILITY'

const DESCRIPTION = `
Contexte : Saar a tenté de déclarer un tir en zone (lance-flammes) alors que l'arme du personnage
n'était pas encore « au clair » (state_weapon). Le serveur a refusé avec « Action exclusive : aucune
autre action ni transition d'état ce Tour (changement d'arme) » — comportement RAW correct (une
action exclusive interdit toute transition d'état la même Déclaration, dégainer son arme en est une),
vérifié en lisant shared/combatExclusiveActions.js#getStateTransitionReasons. Ce n'est PAS un bug de
règle — c'est un manque de clarté côté interface.

Proposition de Saar (pas cadrée, pas codée) : quand l'état d'une arme change automatiquement (sans
clic explicite du joueur sur le sélecteur d'état concerné — ex. le simple fait de sélectionner une
action de tir force implicitement l'arme à "au clair"), surligner visuellement le bouton d'état
correspondant (posture/arme/mode de tir/couverture/vitesse, satellite CombatDeclareStatePanel) pour
que le joueur VOIE que ce changement a eu lieu avant de recevoir un refus d'action exclusive.

Portée à cadrer : quels états peuvent changer "sans clic" (arme au clair semble le cas le plus
évident — sélectionner une action de tir l'implique) ; combien de fenêtres de déclaration
(CombatActionWindow/CombatGmDeclareWindow/CombatExoActionWindow/DroneWeaponPanel) partagent ce
satellite d'état et seraient concernées ; est-ce un simple style CSS temporaire (ex. glow/pulse) ou
un vrai indicateur persistant tant que la transition n'est pas "acceptée" par une action confirmée.

Catégorie 'suggestion' — aucun bug de mécanique, une amélioration d'ergonomie. Non prioritaire, non
cadré, à reprendre si Saar le souhaite.
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
      title: 'Surligner le bouton d\'état quand il change automatiquement (sans clic du joueur)',
      description: DESCRIPTION,
      context: JSON.stringify({
        found_during: 'Validation de PLAN_CHOC_TEST_ATTRIBUTION.md (2026-09-05)',
        confirmed_not_a_bug: 'Règle d\'exclusivité correctement appliquée (shared/combatExclusiveActions.js#getStateTransitionReasons) — c\'est un manque de visibilité UI, pas un défaut mécanique',
        related_component: 'CombatDeclareStatePanel (satellite d\'état posture/arme/mode de tir/couverture/vitesse)',
      }),
      status: 'new',
      priority: 'low',
      linked_bug_code: CODE,
    })
    .returning(['id', 'status', 'priority'])

  console.log(`Ticket ${CODE} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
