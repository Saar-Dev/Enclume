// Script à usage unique — note de suivi sur COMBAT-RANGE-PLAYER-EDITABLE : extension du
// correctif Portée à Taille, le même jour (2026-10-04), proposée par Saar après avoir vu le
// correctif Portée. Idempotent (skip si déjà noté). Lancement manuel, local :
//   node --env-file=.env server/src/scripts/note_tickets_20261004_combat_range_player_editable_taille.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-04 (suite) : extension à Taille ---'

const NOTE = `

${MARKER}
Saar a proposé d'étendre le correctif Portée à Taille. En vérifiant, le correctif Portée avait
lui-même introduit un trou neuf sur Taille : élargir la fenêtre MJ à l'assaut d'un PJ rendait son
select Taille éditable (modifiersEditable = isGm || !autoMode, déjà vrai dès que isGm), mais
setTailleOverride n'écrivait qu'un state local jamais envoyé (le MJ ne clique plus "Lancer" sur un
PJ) — même illusion que Portée avant son propre correctif.

Corrigé en étendant le même mécanisme (pas un second) : COMBAT_RESOLUTION_OVERRIDE et
combatResolutionOverrides portent maintenant { tokenId, portee, taille } avec fusion PARTIELLE
côté serveur (changer l'un n'efface pas l'autre). Taille validée contre SIZE_CATEGORIES
(shared/sizeCategory.js), injectée dans confirmedModifiers.taille avant resolveAttackTargetSize
qui la lit déjà en priorité (mécanisme GM_ONLY_CONFIRMED_MODIFIER_KEYS existant, jusqu'ici
inatteignable pour un PJ). Le cas MJ-résout-lui-même-un-PNJ/drone/exo garde son comportement exact
d'avant (state local, inchangé).

Scope qui reste resserré : CombatCacModifiersWindow.jsx (CaC) garde son exclusion type !== 'pj',
pas touché. Testé : mêmes suites que le correctif Portée relancées après l'extension (105/105 +
941/941, aucune régression), build et lint ok. Non testé : scénario à deux clients (ajouté à
docs/BETATEST.md, maintenant mis à jour pour couvrir Portée ET Taille). Détail complet :
docs/JOURNAL8.md.`

async function run() {
  const code = 'COMBAT-RANGE-PLAYER-EDITABLE'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note de suivi ajoutée`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
