// characterStateService.js
// docs/PLANS/PLAN_CHARACTER_STATES.md §2.2 — point de résolution unique de character_states (miroir de
// woundService.js : db/trx reçu en paramètre explicite, jamais importé en singleton, pour que le
// Lot 1 puisse appeler setCharacterState dans la même transaction que l'UPDATE combat_roster qu'il
// double-écrit). Aucun autre fichier ne doit lire/écrire character_states directement.

const AXIS_DEFAULTS = { position: 'standing', weapon: 'holstered' }

// getCharacterStates — { position, weapon } avec défauts appliqués (absence de ligne = valeur par
// défaut de l'axe, §2.1 — une seule forme canonique, jamais deux représentations du même état).
export async function getCharacterStates(db, tokenId) {
  const rows = await db('character_states').where({ token_id: tokenId }).select('axis', 'value_code')
  const result = { ...AXIS_DEFAULTS }
  for (const { axis, value_code } of rows) result[axis] = value_code
  return result
}

// setCharacterState — upsert, ou DELETE si valueCode égale le défaut de l'axe (§2.1). La contrainte
// FK (axis, value_code) → ref_character_state_values porte la validation des valeurs : jamais de
// re-validation JS dupliquée ici.
export async function setCharacterState(db, tokenId, axis, valueCode) {
  if (valueCode === AXIS_DEFAULTS[axis]) {
    await db('character_states').where({ token_id: tokenId, axis }).del()
    return
  }
  await db('character_states')
    .insert({ token_id: tokenId, axis, value_code: valueCode, updated_at: db.fn.now() })
    .onConflict(['token_id', 'axis'])
    .merge(['value_code', 'updated_at'])
}
