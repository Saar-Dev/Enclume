// Ajoute une note d'avancement aux tickets BETA-37 et BETA-39 : instrumentation posée (pas un fix),
// code non committé (attend une nouvelle occurrence en jeu avant d'être validé puis committé). But :
// que la prochaine lecture du ticket retrouve où chercher les logs [DBG] BETA-37/BETA-39 sans
// redemander à Claude. Idempotent (skip si déjà noté).
//
// Lancer depuis la racine : node --env-file=.env server/src/scripts/note_beta37_beta39_instrumentation_20260915.js

import db from '../db/knex.js'

const NOTES = {
  'BETA-37': `

--- 2026-09-15 : instrumentation posée (pas un fix) ---
console.log('[DBG] BETA-37 — characterId introuvable', ...) ajouté dans
server/src/routes/character/char-sheet.js, router.param('characterId'), juste avant le throw 404.
Capture characterId reçu + userId + route. Code NON committé (reste dans le worktree en attente
de la prochaine occurrence pour confirmer l'hypothèse avant de committer). Prochaine étape :
attendre le log en conditions réelles, identifier la nature exacte de l'ID reçu (UUID malformé /
ID d'une autre campagne / personnage supprimé).`,
  'BETA-39': `

--- 2026-09-15 : instrumentation posée (pas un fix) ---
console.log('[DBG] BETA-39 PJ/PNJ/EXO — arme sélectionnée', ...) ajouté dans les 3 fenêtres de
déclaration (client/src/components/CombatActionWindow.jsx, CombatGmDeclareWindow.jsx,
CombatExoActionWindow.jsx), juste après le calcul d'isAoeEligible. Capture weaponId/weaponName/
ref_aoe_profile/isAoeEligible côté navigateur (DevTools), pas côté serveur (décision purement
client). Code NON committé (reste dans le worktree en attente de la prochaine occurrence).
Prochaine étape : demander au joueur concerné, au moment du bug, d'ouvrir la console et relever
la ligne [DBG] BETA-39 correspondante.`,
}

async function main() {
  for (const [code, note] of Object.entries(NOTES)) {
    const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!ticket) {
      console.log(`[SKIP] ${code} — ticket introuvable`)
      continue
    }
    if ((ticket.admin_notes || '').includes('instrumentation posée (pas un fix)')) {
      console.log(`[SKIP] ${code} — déjà noté`)
      continue
    }
    await db('bug_tickets')
      .where({ id: ticket.id })
      .update({ admin_notes: (ticket.admin_notes || '') + note, updated_at: db.fn.now() })
    console.log(`[OK] ${code} — note ajoutée`)
  }
  await db.destroy()
}

main().catch(err => {
  console.error('ERREUR', err)
  process.exit(1)
})
