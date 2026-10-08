// Script à usage unique — WOUND-DEATH-NO-TOKEN, session du 2026-10-08. Décision Saar du même jour
// (en session) : un correctif commité passe en 'resolved' sans attendre une validation en jeu réel.
// Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261008_wound_death_no_token.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-08 : correctif codé (moitié "token créé après la mort") ---'

const NOTE = `

${MARKER}
Cause racine confirmée : le statut dead est porté par les TOKENS (décision du chantier « Statut
Mort », 2026-09-24). reconcileWoundDeath (statusService.js) ne pose ce statut que sur les tokens
EXISTANTS d'un personnage, au moment où une blessure s'écrit ou qu'une réaction de Chance se ferme
— un personnage sans token à cet instant restait mécaniquement vivant jusqu'à un hasard.

Corrigé : réconciliation immédiate à la création d'un token lié à un personnage (POST
/api/battlemaps/:id/tokens, seul point d'insertion dans la table tokens) — réutilise
settleFatalWound (déjà écrit pour la fermeture d'une réaction de Chance, woundService.js,
désormais exporté), appelée APRÈS les émissions TOKEN_CREATED/WORLD_RUNTIME_UPDATED. Décision Saar
confirmée en session : un token créé pour un personnage déjà mort doit apparaître mort tout de
suite.

Limite résiduelle, documentée (docs/SYSTEME/STATUTS_TOKEN.md §8), PAS corrigée : un personnage qui
ne reçoit JAMAIS aucun token reste hors de portée (isCharacterDead lit les tokens, sans token nulle
part où écrire dead) — cas résiduel rare, pas traité pour éviter une seconde autorité qui
dupliquerait « la mort vit sur le token ».

Testé : node --check, woundService.test.mjs (54/54, 1 nouveau test), deathStateService.test.mjs +
chanceCatastropheChoiceService.test.mjs (22/22), aucune régression. Non testé : scénario réel
navigateur. Détail complet : docs/JOURNAL8.md, docs/SYSTEME/STATUTS_TOKEN.md.`

async function run() {
  const code = 'WOUND-DEATH-NO-TOKEN'
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
