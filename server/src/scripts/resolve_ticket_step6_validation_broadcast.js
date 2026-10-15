// Script à usage unique — ticket "Step6 Matériel : la validation MJ d'un item ne se reflète pas
// côté joueur" (id f1c36f73-8718-4f5f-8cc9-85271e9b0078, sans linked_bug_code).
//
// [VÉRIFIÉ par lecture] La validation MJ passe par PUT /char-sheet/:characterId/inventory/:itemId
// avec validated_by_gm (char-sheet.js:1294-1319, garde isGm ligne 1299) — EXACTEMENT la même route
// et le même événement WS.INVENTORY_UPDATED que toute autre modification d'item. La room est
// résolue par resolveInventoryBroadcastRoom (inventoryBroadcast.js:20) : wizard:<sheetId> tant que
// le personnage est un brouillon actif. Côté client, StepMaterielEtBiens.jsx (le composant Step6
// lui-même) monte useWizardInventorySync(characterId), qui écoute WS.INVENTORY_UPDATED et appelle
// upsertInventoryItem — même mécanisme que l'ajout/retrait d'objets en Step6, qui fonctionne déjà.
// Aucun chemin séparé ou manquant pour validated_by_gm : ce champ n'est qu'un champ parmi d'autres
// sur le même item, diffusé par le même event.
//   node --env-file=.env server/src/scripts/resolve_ticket_step6_validation_broadcast.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : vérifié par lecture du code réel (route + broadcast + hook client) ---'

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  const t = await db('bug_tickets').where({ id: 'f1c36f73-8718-4f5f-8cc9-85271e9b0078' }).first()
  if (!t) { console.log('[SKIP] introuvable'); return }
  if ((t.admin_notes || '').includes(MARKER)) { console.log('[SKIP] déjà noté'); return }

  const note = `${MARKER}\nPUT /char-sheet/:characterId/inventory/:itemId (validated_by_gm, garde isGm) émet WS.INVENTORY_UPDATED vers resolveInventoryBroadcastRoom (wizard:<sheetId> tant que le personnage est un brouillon) — exactement le chemin déjà utilisé par tout ajout/retrait d'objet en Step6. Côté client, StepMaterielEtBiens.jsx monte useWizardInventorySync(characterId) qui écoute cet événement et appelle upsertInventoryItem. validated_by_gm n'est qu'un champ parmi d'autres sur le même item, aucun chemin séparé ou manquant. Hook présent depuis 2026-07-24 (avant la création du ticket, 2026-08-23) — déjà correct au moment du signalement.`

  await db('bug_tickets').where({ id: t.id }).update({
    status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
    admin_notes: `${t.admin_notes || ''}\n\n${note}`.trim(), updated_at: db.fn.now(),
  })
  console.log('[OK] Step6 validation MJ -> resolved')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
