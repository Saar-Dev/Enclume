// Script à usage unique — COMBAT-MULTI-ATTACK-ROUND-BROKEN : passage en suspended (Saar, 2026-10-15).
// Deuxième relecture indépendante du code réel (session du 2026-10-15, après celle du 2026-10-04) :
// confirmation que la construction des entrées melee[] (PJ ET MJ, unifiées par buildMeleeEntries),
// le recalcul dynamique du malus « Attaque multiple » (computeMultiAttackMalus) et le réducteur
// meleeDeclaration.js sont structurellement sains — aucun défaut concret trouvé. Le chaînage de
// résolution (resolveMeleeAction, socketCombatHelpers.js) et la bascule d'affichage entre fenêtres
// n'ont pas été relus intégralement (fonction très dense, ~1700 lignes) faute de symptôme précis à
// vérifier ciblé. Saar confirme ne pas avoir de souvenir précis du symptôme exact — suspendu plutôt
// que de continuer une lecture spéculative sans repro (AGENTS.md : documenter avant d'analyser, ne
// pas deviner une cause non confirmée).
//   node --env-file=.env server/src/scripts/suspend_ticket_combat_multi_attack_round_broken.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : suspendu (Saar) — pas de repro precise disponible ---'

async function run() {
  const t = await db('bug_tickets').where({ linked_bug_code: 'COMBAT-MULTI-ATTACK-ROUND-BROKEN' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }
  const note = `${MARKER}\nDeuxième relecture indépendante (après celle du 2026-10-04) : construction des entrées melee[] (PJ+MJ, buildMeleeEntries), recalcul dynamique du malus Attaque multiple (computeMultiAttackMalus) et réducteur meleeDeclaration.js confirmés structurellement sains. resolveMeleeAction (socketCombatHelpers.js, ~1700 lignes) et la bascule d'affichage entre fenêtres pour une série d'attaques n'ont pas été relus intégralement — relecture spéculative jugée peu productive sans symptôme précis (deux sessions arrivent déjà à "architecture cohérente, rien trouvé"). Saar confirme ne pas avoir de souvenir précis du symptôme exact (sélection/affichage/malus/cible ?). Suspendu en attendant une occurrence concrète en jeu — scénario de validation déjà détaillé dans docs/BETATEST.md, priorité conservée (critical) pour la prochaine fois que le symptôme réapparaît.`
  await db('bug_tickets').where({ id: t.id }).update({
    status: 'suspended',
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] COMBAT-MULTI-ATTACK-ROUND-BROKEN -> suspended')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
