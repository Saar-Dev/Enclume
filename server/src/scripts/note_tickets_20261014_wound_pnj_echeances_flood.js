// Script à usage unique — note de suivi sur WOUND-PNJ-ECHEANCES-FLOOD. Idempotent.
// Lancement manuel, local (Saar — écriture en base, hors autorisation d'auto-lancement de l'agent) :
//   node --env-file=.env server/src/scripts/note_tickets_20261014_wound_pnj_echeances_flood.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-14 : correctif codé ---'

const NOTE = `

${MARKER}
Décision Saar : deux modes de campagne, défaut « PNJ guérison simple ». Correctif : nouvelle option
\`pnj_healing_mode\` (campaignSettingsService.js, enum simple/detaille, défaut simple) + gate dans
initializeWoundHealingEcheance (woundHealingSchedule.js, SEUL créateur d'échéance de guérison) — un
PNJ en mode simple n'a plus d'échéance programmée (la case reste posée, gérée à la main par le MJ) ;
pj/drone/exo non concernés (ne passent jamais par character_wounds).

Trouvaille en analyse à charge avant tout code : characters.type a 'pnj' comme défaut réel en base —
plusieurs fixtures de test en dépendaient implicitement sans le savoir. 4 fichiers de test corrigés
pour préserver leur intention d'origine (woundEvolutionService.test.mjs/woundUtils.test.mjs : type
'pj' explicite ajouté ; woundReviewBatchService.test.mjs/woundReviewService.test.mjs : leur PNJ
explicite passé en mode 'detaille' explicite). 3 nouveaux tests ajoutés pour le gate lui-même et pour
la disparition du PNJ de l'écran de revue en mode par défaut. Détail complet : docs/JOURNAL8.md.

Testé : node --check (6 fichiers). 201/201 sur les 6 fichiers de test du pipeline blessures (lancés
individuellement par l'agent contre la base locale, autorisation du 2026-09-25). shared/**/*.test.mjs
949/949, aucune régression. Résidu de fixtures vérifié par lecture directe en base : aucun.
Non testé : rendu visuel réel (écran de revue des guérisons, campagne avec plusieurs PNJ blessés).`

async function run() {
  const code = 'WOUND-PNJ-ECHEANCES-FLOOD'
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
