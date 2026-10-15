// Script à usage unique — note le correctif codé pour COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE (session
// du 2026-10-15). Statut reste 'in_progress' (pas 'resolved') : scénario réel à deux clients non
// testé, la validation en jeu par Saar reste à faire (AGENTS.md § Clôture).
// Idempotent (skip si déjà noté). Lancement manuel, local, depuis la racine :
//   node --env-file=.env server/src/scripts/note_ticket_combat_gm_equipment_snapshot_stale.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : correctif codé ---'

const NOTE = `

${MARKER}
Cause confirmée par lecture : CombatGmDeclareWindow.jsx et CombatRosterWindow.jsx maintenaient
chacune leur propre copie locale de GET /battlemaps/:id/combat-equipment, chargée une fois et
jamais rafraîchie. isRanged(tokenId) et le badge Distance/Contact du roster restaient figés pour
tout token hors du PNJ actif ; CombatRosterWindow ne rechargeait son équipement que pré-combat
(garde if (!battlemapId || inCombat) return), jamais pendant le combat lui-même. Trouvaille annexe :
même le PNJ actif restait périmé pour ses armes naturelles (mutations), qui lisaient encore
l'instantané au lieu de la dérivation déjà vivante utilisée pour ses armes de catalogue.

Corrigé (rework, pas un patch par site de lecture) : nouveau hook unique
client/src/lib/useCombatEquipmentSnapshot.js, calqué sur useModingRefreshSync.js — fetch initial
sans garde 'inCombat', puis rafraîchissement automatique sur INVENTORY_ADDED/UPDATED/REMOVED (déjà
émis par la permutation résolue, le lancer de grenade et le quick-equip — aucun nouvel événement),
filtré par les character_id du roster courant pour ignorer le reste de la campagne. Les deux
fenêtres appellent ce même hook ; aucune ligne de lecture (isRanged, naturalWeaponsAvailable, badge
roster) n'a eu besoin d'être modifiée, elles lisaient déjà la même variable désormais vivante. Le
refetch manuel après quick-equip a été retiré (redondant avec l'événement déjà émis).

Testé : eslint ciblé (0 erreur), build client complet (succès). Non testé : scénario réel à deux
clients (MJ + joueur) confirmant la mise à jour en direct des deux fenêtres — à faire par Saar avant
de clore. Détail complet : docs/JOURNAL8.md (2026-10-15).`

async function run() {
  const code = 'COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'in_progress',
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note ajoutée, statut -> in_progress`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
