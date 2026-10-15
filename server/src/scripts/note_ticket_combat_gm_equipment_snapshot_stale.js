// Script à usage unique — clôture COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE (session du 2026-10-15).
// Saar a validé le scénario réel à deux fenêtres (MJ déclaration + Roster ouvertes ensemble,
// permutation/grenade/quick-equip reflété en direct dans l'autre fenêtre) le jour même — clôturé en
// 'resolved' directement, pas de statut intermédiaire.
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

Testé : eslint ciblé (0 erreur), build client complet (succès). Validé en jeu réel par Saar le
2026-10-15 (fenêtre MJ déclaration + fenêtre Roster ouvertes ensemble, permutation/grenade/
quick-equip reflété en direct dans l'autre fenêtre, sans recharger la carte). Détail complet :
docs/JOURNAL8.md (2026-10-15).`

async function run() {
  const code = 'COMBAT-GM-EQUIPMENT-SNAPSHOT-STALE'
  const ticket = await db('bug_tickets').where({ linked_bug_code: code }).first()
  if (!ticket) { console.log(`[SKIP] ${code} — ticket introuvable`); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà noté`); return }
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')
  await db('bug_tickets').where({ id: ticket.id }).update({
    status: 'resolved',
    reviewed_by: admin.id,
    reviewed_at: db.fn.now(),
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log(`[OK] ${code} — note ajoutée, statut -> resolved`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
