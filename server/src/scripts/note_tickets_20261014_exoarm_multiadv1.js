// Script à usage unique — note de suivi sur EXOARM-MULTIADV1. Idempotent.
// Lancement manuel, local (Saar — écriture en base, hors autorisation d'auto-lancement de l'agent) :
//   node --env-file=.env server/src/scripts/note_tickets_20261014_exoarm_multiadv1.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-14 : rework codé (pas un patch) ---'

const NOTE = `

${MARKER}
Le ticket décrivait un symptôme sur une seule des deux occurrences du ternaire
(character.type === 'pj' ? 'pnj' : 'pj'). Analyse à charge demandée par Saar avant code : côté
attaquant (resolveMeleeAction) c'est du code mort pour 'exo' (dispatcher qui détourne tout attaquant
exo ailleurs) ; côté défenseur (finalizeMeleeAttack) c'est vivant mais corriger seulement cette ligne
n'aurait rien changé — countAdversaires compare via characters.type brut sur CHAQUE token du roster,
jamais résolu via le pilote. Une exo était invisible au décompte multi-adversaires des deux côtés.
En creusant : la requête roster + le ternaire étaient dupliqués intégralement deux fois dans le même
fichier (aucune autorité unique). Décision Saar : rework, pas un patch.

Fix : nouvelle fonction unique resolveMultiAdversaryMalus (socketCombatHelpers.js) — type effectif du
combattant courant via resolveCombatantIdentity (autorité déjà établie, réutilisée) ; type effectif
de CHAQUE token du roster résolu en SQL (LEFT JOIN exo_sheet + pilote, même sémantique). Les deux
blocs dupliqués supprimés, remplacés par un seul appel.

Testé : node --check. Nouveau fichier socketCombatHelpers.multiAdversary.test.mjs (aucune couverture
n'existait avant) : 2 tests contre la base locale couvrant exo pilotée par un PNJ/PJ/sans pilote, des
deux côtés (attaquant et défenseur). socketCombatHandWeaponAbsence.test.mjs + combatantContextService
+ socketCombatHelpers.droneIntegrity : 55/55, aucune régression sur resolveMeleeAction.
shared/**/*.test.mjs 949/949. Résidu de fixtures vérifié en base : aucun. Détail complet :
docs/JOURNAL8.md.
Non testé : scénario réel navigateur (aucune exo-armure réellement en jeu à ce jour).`

async function run() {
  const code = 'EXOARM-MULTIADV1'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    status: 'in_progress',
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
