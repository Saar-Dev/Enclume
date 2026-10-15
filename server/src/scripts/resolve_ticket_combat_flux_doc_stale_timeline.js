// Script à usage unique — COMBAT-FLUX-DOC-STALE-TIMELINE : clôture (2026-10-15). Correctif
// documentation pure (zéro code touché, zéro risque comportemental) : docs/SYSTEME/COMBAT_FLUX.md
// §7 (« CaC 4b ») et §8 point [12] citaient encore remainingMeleeActions/resolveMeleeAction
// récursif — corrigés pour décrire le mécanisme réel (combat_timeline_entries/advanceTimeline/
// pickNextTimelineStep), vérifié par lecture de socketCombatResolution.js (COMBAT_ACTION_CONFIRM)
// et socketCombatHelpers.js (confirmMeleeDefense). Note d'audit datée ajoutée en tête de document,
// même convention que les corrections précédentes du même fichier.
//   node --env-file=.env server/src/scripts/resolve_ticket_combat_flux_doc_stale_timeline.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : clôturé — correctif documentation pure ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const t = await db('bug_tickets').where({ linked_bug_code: 'COMBAT-FLUX-DOC-STALE-TIMELINE' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\ndocs/SYSTEME/COMBAT_FLUX.md §7 (« CaC 4b ») et §8 point [12] corrigés : ne citent plus remainingMeleeActions/resolveMeleeAction récursif (retiré au passage à la résolution par échelle) — décrivent désormais que resolveMeleeAction/confirmMeleeDefense retournent après UNE entrée, et que c'est l'appelant (COMBAT_ACTION_CONFIRM/confirmMeleeDefense elle-même) qui appelle advanceTimeline() ensuite, laquelle enchaîne naturellement sur l'attaque suivante de la série (declaration_group_id) via pickNextTimelineStep. Vérifié par lecture directe de socketCombatResolution.js:680-683 et socketCombatHelpers.js (confirmMeleeDefense, ligne ~361). Note d'audit datée ajoutée en tête de document. Aucun code touché — pure documentation, pas de validation automatisable applicable au-delà de la relecture.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] COMBAT-FLUX-DOC-STALE-TIMELINE -> resolved')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
