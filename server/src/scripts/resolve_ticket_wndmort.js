// Script à usage unique — clôture le ticket WNDMORT « Malus blessure "mortelle" codé -20 fixe au
// lieu de bloquer les Tests ».
// Vérifié en code (pas supposé) : shared/woundConstants.js — WOUND_PENALTIES.mortelle/mort_subite = 0
// (plus de -20 extrapolé), remplacé par TEST_BLOCKING_SEVERITIES = ['mortelle', 'mort_subite'] et
// isTestBlockingWound(), RAW « le blessé ne peut entreprendre aucune action demandant un Test »
// (REGLEBLESSURES.md:154,175). Garde câblée sur tous les chemins combat : socketEntity.js,
// socketCombatAoe.js, socketCombatAnnouncement.js, socketConnector.js, socketCombatHelpers.js,
// socketCombatExo.js, char-sheet.js (wound_test_blocked exposé au client). Edge case pilote d'exo-
// armure corrigé séparément (commit e31f6d67, resolveCombatantIdentity). Tests unitaires existants
// et verts : shared/woundConstants.test.mjs (isTestBlockingWound, TEST_BLOCKING_SEVERITIES).
// Sous-tickets UI/hors-combat déjà clos séparément (WNDMORT-UI, WNDMORT-HORSCOMBAT).
// Décision de Saar (2026-10-10) : clôturer sans nouveau scénario réel dédié, déjà couvert par
// l'ampleur du câblage et les tests existants.
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/resolve_ticket_wndmort.js

import db from '../db/knex.js'

const CODE = 'WNDMORT'

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: CODE }).first()
  if (!ticket) throw new Error(`Ticket ${CODE} introuvable.`)
  if (ticket.status === 'resolved') { console.log('Déjà résolu.'); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const note =
    '--- 2026-10-10 : clôturé, correctif déjà en place ---\n' +
    "Relecture confirme shared/woundConstants.js : WOUND_PENALTIES.mortelle/mort_subite = 0 " +
    "(plus de -20 extrapolé), remplacé par isTestBlockingWound()/TEST_BLOCKING_SEVERITIES (RAW " +
    "« aucune action demandant un Test »). Garde câblée sur tous les chemins combat (Tir, CaC, AoE, " +
    "portes, exo, char-sheet). Edge case pilote d'exo-armure corrigé séparément (e31f6d67). Tests " +
    "unitaires existants et verts (woundConstants.test.mjs). Sous-tickets UI/hors-combat déjà clos. " +
    "Décision de Saar : clôturer sans nouveau test ni nouveau scénario réel dédié."

  const [updated] = await db('bug_tickets')
    .where({ id: ticket.id })
    .update({
      status: 'resolved',
      reviewed_by: admin.id,
      reviewed_at: db.fn.now(),
      admin_notes: `${ticket.admin_notes || ''}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    .returning(['id', 'status'])

  console.log(`Ticket (id=${updated.id}) -> ${updated.status}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
