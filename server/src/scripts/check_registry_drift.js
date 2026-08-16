// Script diagnostic ponctuel, lecture seule — vérifie si wizard_locks (FK réelle vers char_sheet,
// migration 201_wizard_locks.js) est bien couverte par le garde-fou anti-dérive de vaultService.js
// (assertRegistryUpToDate) avant de toucher cloneCharacterDeep (chantier Coffre, docs/EN_COURS.md).
// Ne modifie rien. Lancement manuel : node --env-file=.env server/src/scripts/check_registry_drift.js

import db from '../db/knex.js'

async function run() {
  const { rows } = await db.raw(`
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name IN ('characters', 'char_sheet')
  `)
  console.log('Tables avec FK réelle vers characters/char_sheet :')
  console.log(rows.map(r => r.table_name).sort())
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
