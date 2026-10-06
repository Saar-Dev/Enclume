// Script à usage unique — note le correctif codé pour GRENADE-STACK-BY-TYPE (session de correction
// de bugs du 2026-10-06, périmètre étendu aux Armes de jet par la même logique que
// GRENADE-ACCEPTS-WEAPON-MODS). Statut reste 'in_progress' (pas 'resolved'), la validation en jeu
// par Saar reste à faire (AGENTS.md § Clôture).
// Idempotent (skip si déjà noté). Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/note_tickets_20261006_grenade_stack_by_type.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-06 : correctif codé (périmètre étendu aux Armes de jet) ---'

const NOTE = `

${MARKER}
Cause racine vérifiée en base : canStack (inventoryRules.js) refuse tout item à location équipable,
quel que soit has_integrity. Grenade et Armes de jet portent location='M' comme n'importe quelle
arme — la migration 333 (2026-09-09) leur avait déjà retiré has_integrity (consommables sans état
suivi) sans jamais toucher à ce second verrou.

Corrigé (server/src/lib/inventoryRules.js) : canStack porte une exception déclarative,
STACKABLE_DESPITE_EQUIPPED_CATEGORIES = Set(['Grenade', 'Armes de jet']) — réutilise exactement le
regroupement de catégories déjà décidé par la migration 333. Les sites appelants reçoivent category
dans leur SELECT. Vérifié par lecture : consumeThrownGrenade (socketCombatAoe.js) et
countStowedByContainer gèrent déjà correctement une ligne à quantity > 1 — écrits en anticipant ce
correctif, jamais exécutés jusqu'ici faute de stack possible. Aucun changement côté combat.

Testé : inventoryRules.test.mjs (12/12) ; inventoryService.test.mjs étendu de 4 tests réels contre
la base locale (empilement à l'ajout, fusion sur ajout ultérieur, grenade en main jamais fusionnée
avec la réserve) — 30/30 ; modingService.test.mjs 5/5 (non-régression croisée). Non testé : scénario
réel en navigateur (ramasser/acheter plusieurs grenades identiques, lancer depuis une réserve de 2+).
Détail complet : docs/JOURNAL8.md, docs/PLANS/PLAN_USURE&INTEGRITE.md §3 (2026-10-06).`

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'GRENADE-STACK-BY-TYPE' }).first()
  if (!ticket) { console.log('[SKIP] GRENADE-STACK-BY-TYPE — ticket introuvable'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] GRENADE-STACK-BY-TYPE — déjà noté'); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'in_progress',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] GRENADE-STACK-BY-TYPE — note ajoutée, statut -> in_progress')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
