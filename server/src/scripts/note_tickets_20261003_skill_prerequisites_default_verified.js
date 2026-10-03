// Script à usage unique — note sur WIZ9 et CHARSHEET-ADVANTAGE-SKILL-GATE après vérification du
// 2026-10-03 (session de correction de bugs). Idempotent (skip si déjà noté).
// Lancement manuel, local : node --env-file=.env server/src/scripts/note_tickets_20261003_skill_prerequisites_default_verified.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-03 : défaut vérifié ---'

const NOTES = {
  'WIZ9': `

${MARKER}
Vérifié (pas supposé) : SETTINGS_SCHEMA.skill_prerequisites.default === true dans
server/src/lib/campaignSettingsService.js:15, confirmé par le test déjà existant
campaignSettingsService.test.mjs ('settings undefined/null → tous les défauts du schéma', 6/6).
Toute campagne qui n'a jamais explicitement enregistré ce réglage l'a donc coché par défaut —
le code est correct. Ne couvre pas une campagne ayant déjà enregistré false explicitement AVANT
ce correctif (valeur persistée, pas rétroactive). Reste "in_progress" : l'achat réel d'une
compétence gated en navigateur n'a toujours pas été testé.`,
  'CHARSHEET-ADVANTAGE-SKILL-GATE': `

${MARKER}
Cause probable confirmée : POUVOIRS_POLARIS n'a qu'un prérequis SKILL_MIN (vers
MAITRISE_DE_LA_FORCE_POLARIS, elle-même gatée par l'Avantage adv_079) — si skill_prerequisites
est désactivé sur la campagne concernée, cette chaîne n'est jamais vérifiée (même mécanisme que
WIZ9). Code du défaut vérifié correct (voir note WIZ9) ; reste à vérifier la valeur réelle de ce
réglage sur la campagne du beta-test (hors base locale, accès Kiwi requis) avant de clore.`,
}

async function run() {
  for (const [code, note] of Object.entries(NOTES)) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); continue }
    if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); continue }
    await db('bug_tickets').where({ id: ticket.id }).update({
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} — note ajoutée`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
