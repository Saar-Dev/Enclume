// Script à usage unique — WOUND-STABILIZATION-UNMODELED : passage en suspended (Saar, 2026-10-15).
// Exploration du sujet a montré que ce n'est pas un oubli de câblage : docs/Old/PLAN_BLESSURES_GUERISON.md
// §3.1/§7/§8 documente une décision déjà prise (2026-07-29/30) classant la Stabilisation minute-scale
// « hors périmètre » de l'échéancier de campagne (jours/semaines), au même titre que la survie en heures
// (Mortelle non soignée) et la Noyade — toutes trois volontairement laissées narratives/manuelles, un
// minuteur dédié (probablement adossé aux Tours de combat) restant à concevoir séparément. Suspendu en
// attendant que Saar cadre cette conception, pas un correctif ponctuel.
//   node --env-file=.env server/src/scripts/suspend_ticket_wound_stabilization_unmodeled.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : suspendu (Saar) — chantier distinct, pas un correctif ponctuel ---'

async function run() {
  const t = await db('bug_tickets').where({ linked_bug_code: 'WOUND-STABILIZATION-UNMODELED' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\nExploration (avant tout code) : docs/Old/PLAN_BLESSURES_GUERISON.md §3.1 ("Stabilisation minute-scale — hors périmètre de ce lot, voir §7"), §7 ("cadence trop rapide pour l'échéancier de campagne... mécanisme séparé à concevoir plus tard, probablement adossé aux Tours de combat ou à un minuteur de scène dédié") et §8 point 1 (même traitement déjà confirmé pour la survie en heures Mortelle/Membre détruit et la Noyade, Lot 6 PLAN_FATIGUE_DOMMAGES.md — toutes trois narratives/manuelles par décision explicite de Saar, 2026-07-29/30). Coder un correctif dans le pipeline de guérison existant (jours/semaines) irait à l'encontre de cette décision. Reste suspendu tant que Saar n'a pas cadré l'échelle de temps du futur minuteur dédié.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'suspended',
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] WOUND-STABILIZATION-UNMODELED -> suspended')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
