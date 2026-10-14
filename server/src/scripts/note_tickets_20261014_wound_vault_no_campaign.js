// Script à usage unique — note de suivi sur WOUND-VAULT-NO-CAMPAIGN. Idempotent.
// Lancement manuel, local (Saar — écriture en base, hors autorisation d'auto-lancement de l'agent) :
//   node --env-file=.env server/src/scripts/note_tickets_20261014_wound_vault_no_campaign.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-14 : correctif codé ---'

const NOTE = `

${MARKER}
Décision Saar, version 2 préférée : aucune blessure sauvegardée au transfert vers le Coffre, sauf
mortelle/mort_subite (ne guérissent jamais seules). Correctif en deux volets :
1. vaultService.js (cloneCharacterDeep/cloneToVault) : character_wounds sort du clonage générique
   vers le Coffre (nouvelle fonction cloneWoundsToVault, même patron que cloneInventoryWithSlots/
   cloneExoSheet) — seules mortelle/mort_subite (TEST_BLOCKING_SEVERITIES, shared/woundConstants.js)
   survivent. Coffre→campagne non touché.
2. Garde défensive dans initializeWoundHealingEcheance (woundHealingSchedule.js) : campaignId absent
   -> aucune échéance, jamais un crash. Ferme directement le symptôme d'origine (POST .../wounds sur
   un personnage du Coffre répondait à tort « Ligne pleine », en réalité un NOT NULL violé sur
   game_echeances.campaign_id).

Testé : node --check (5 fichiers). vaultCloneRegistry.test.mjs 5/5, woundEvolutionService.test.mjs
55/55, woundService.test.mjs 55/55 (nouveau test de bout en bout : applyWound sur un personnage du
Coffre réussit, où il plantait avant), woundUtils.test.mjs 57/57, woundReviewBatchService.test.mjs
16/16, woundReviewService.test.mjs 14/14 — lancés individuellement par l'agent contre la base locale
(autorisation du 2026-09-25). shared/**/*.test.mjs 949/949. Résidu de fixtures vérifié par lecture
directe en base : aucun. Détail complet : docs/JOURNAL8.md.
Non testé : rendu visuel réel (transfert Coffre, ajout de blessure à un personnage du Coffre).`

async function run() {
  const code = 'WOUND-VAULT-NO-CAMPAIGN'
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
