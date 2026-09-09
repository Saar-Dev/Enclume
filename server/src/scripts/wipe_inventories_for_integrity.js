// wipe_inventories_for_integrity.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L0 §2.3 (décision D1 / M1)
//
// Script ONE-SHOT, lancé manuellement par Saar UNE SEULE FOIS, après les migrations 329-331
// (schéma ITG). PAS une migration : un `DELETE` dans une migration rejouerait sur tout déploiement
// neuf (Kiwi) et son `down()` ne restaurerait rien.
//
// But : repartir d'inventaires vides pour que les personnages de test se rééquipent et reçoivent
// leur ITG par le flux normal (L3). Aucune donnée de production à préserver (on est en dev, D1).
//
// Sûreté (re-vérifié 2026-09-09) :
//   - FK vers char_inventory : char_inventory_mods / char_inventory_slots → ON DELETE CASCADE ;
//     combat_actions.weapon_inv_id / .offhand_weapon_inv_id → ON DELETE SET NULL. Aucune autre.
//   - `combat_state` ne sérialise AUCUNE donnée d'inventaire (colonnes phase/turn/timer only).
//   - Le seul risque réel — une arme mise à NULL dans une action de combat EN COURS — est écarté
//     par la garde ci-dessous : le script REFUSE de tourner si une table combat_* est non vide.
//     Il ne purge donc jamais lui-même un état de combat (invariant #4 : pas de nettoyage
//     destructif implicite).
//
// Un dump JSON de char_inventory est écrit dans `temp/` avant suppression — filet, même si D1 dit
// « rien à préserver ».
//
// Lancement : node --env-file=.env server/src/scripts/wipe_inventories_for_integrity.js

import fs from 'node:fs'
import path from 'node:path'
import db from '../db/knex.js'

const COMBAT_TABLES = [
  'combat_state', 'combat_actions', 'combat_action_targets',
  'combat_pending', 'combat_roster', 'combat_timeline_entries',
]

async function run() {
  // 1. Garde : aucune session de combat active.
  const busy = []
  for (const t of COMBAT_TABLES) {
    const { rows: [{ n }] } = await db.raw(`SELECT count(*)::int AS n FROM ${t}`)
    if (n > 0) busy.push(`${t} (${n})`)
  }
  if (busy.length > 0) {
    console.error(
      '\n⛔ Abandon : des tables de combat sont non vides —\n   ' + busy.join(', ') +
      '\n   Termine / clôture le combat en cours, puis relance ce script.\n' +
      '   (Le script ne purge JAMAIS un état de combat lui-même.)\n',
    )
    await db.destroy()
    process.exit(1)
  }

  // 2. Dump de sûreté.
  const rows = await db('char_inventory').select('*')
  const dumpDir = path.resolve(process.cwd(), 'temp')
  fs.mkdirSync(dumpDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dumpPath = path.join(dumpDir, `char_inventory_avant_wipe_${stamp}.json`)
  fs.writeFileSync(dumpPath, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`📦 Dump : ${rows.length} ligne(s) → ${dumpPath}`)

  // 3. Suppression (CASCADE : char_inventory_mods / _slots ; SET NULL : combat_actions — vide).
  const deleted = await db('char_inventory').del()
  console.log(`🗑️  char_inventory : ${deleted} ligne(s) supprimée(s).`)

  // 4. Contrôle.
  const { rows: [{ n: reste }] } = await db.raw('SELECT count(*)::int AS n FROM char_inventory')
  console.log(reste === 0
    ? '✅ Inventaires vides. Les personnages de test peuvent se rééquiper (ITG par L3).'
    : `⚠️  Il reste ${reste} ligne(s) — vérifier.`)
}

run()
  .then(() => db.destroy())
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); db.destroy().finally(() => process.exit(1)) })
