// Script à usage unique — WOUND-LEGERE-NEVER-HEALS, session du 2026-10-08. Décision Saar du même
// jour (en session) : un correctif commité passe en 'resolved' sans attendre une validation en jeu
// réel. Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261008_wound_legere_never_heals.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-08 : correctif codé ---'

const NOTE = `

${MARKER}
Cause racine trouvée : initializeWoundHealingEcheance (woundHealingSchedule.js) retourne null pour
une Légère (getWoundHealing('legere') vaut null par construction) — correct pour dire « aucun
Test », mais rien n'appelait ensuite jamais resolveWoundImprovement (déjà testé : fait disparaître
une Légère sans nouvelle case) pour la retirer après son jour de guérison RAW
(REGLEBLESSURES.md:420). La chaîne de guérison (Critique -> Grave -> Moyenne -> Légère) s'arrêtait
donc sur une Légère qui restait indéfiniment.

Corrigé : nouveau condition_type non interactif wound_legere_heal (même patron que
cold_fatigue_check/cold_damage_tick), créé par initializeWoundHealingEcheance pour une Légère
(couvre automatiquement coup reçu ET chaîne de guérison, insertWoundRow étant le seul écrivain),
résolu par woundLegereHealHandler (woundEvolutionService.js) qui appelle directement
resolveWoundImprovement, sans Test. processGameTimeEffects (campaigns.js) émet WOUND_REMOVED après
coup (sinon la fiche ouverte ne se serait jamais rafraîchie). cancelWoundEcheances élargie aux deux
types de guérison (sinon échéance fantôme, même classe que WOUND-ECHEANCE-GHOSTS).

Testé : node --check, woundEvolutionService.test.mjs (52/52), woundUtils.test.mjs (57/57), suite
transverse blessures/échéances (231/231), shared/**/*.test.mjs (290/290), aucune régression. Non
testé : scénario réel navigateur. Détail complet : docs/JOURNAL8.md, docs/SYSTEME/BLESSURES.md.`

async function run() {
  const code = 'WOUND-LEGERE-NEVER-HEALS'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'resolved',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — statut -> resolved`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
