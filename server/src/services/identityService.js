// identityService.js
// Résolveur sex/is_fertile/hand_pref — source commune pour mutations (char_mutations.mod_sex/
// mod_fertility) et avantages (ref_advantages.mod_identity JSONB). Voir docs/PLAN_MUTATION2.md Lot 6.
//
// Ces 3 champs restent des données brutes librement éditables à la main sur la fiche (PUT /identity,
// PUT /archetype) — contrairement aux Lots 1-5 (attributs/résistances, toujours recalculés à la
// lecture), l'ajout d'une mutation/d'un avantage ÉCRIT directement la valeur (applyIdentityGrant/
// applyMutationIdentityGrant), jamais un champ non déclaré. recomputeIdentity() ne sert qu'au
// RETRAIT (mutation/avantage) ou à une réinsertion complète (Wizard STEP3/STEP5 "retravail") : elle
// recalcule uniquement les champs passés en paramètre à partir des mutations actives + avantages
// actifs restants (mutations d'abord, avantages ensuite — l'avantage l'emporte en cas de conflit sur
// le même champ, seul cas réel aujourd'hui : is_fertile via mutation vs adv_076, déjà couvert par la
// contrainte not_if_sterile côté avantage), défaut fixe si aucune source ne couvre le champ (décision
// Saar) : hand_pref 'R' (80% population droitière), is_fertile false, sex 'homme'. Ne restaure jamais
// une "valeur d'avant" — aucun snapshot stocké, tradeoff assumé identique des 2 côtés (mutations et
// avantages).
//
// Appelant impératif : ne JAMAIS appeler recomputeIdentity sans garder les `fields` strictement
// limités aux champs réellement concernés par la source retirée/resoumise (cf. STEP3/STEP5) — un
// recompute inconditionnel sur les 3 champs écraserait un `sex`/`hand_pref` choisi au Step1 dès qu'
// aucune mutation/avantage ne le concerne.

const IDENTITY_FIELD_TABLE = { sex: 'char_archetype', is_fertile: 'char_archetype', hand_pref: 'char_identity' }
const IDENTITY_FIELD_DEFAULT = { sex: 'homme', is_fertile: false, hand_pref: 'R' }

export function normalizeModIdentity(raw) {
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// Écrit directement les champs fournis (dispatch char_archetype/char_identity) — jamais de champ non
// fourni touché.
async function writeIdentityFields(trx, sheetId, fields) {
  const archetypeUpdate = {}
  const identityUpdate = {}
  for (const [field, value] of Object.entries(fields)) {
    if (IDENTITY_FIELD_TABLE[field] === 'char_archetype') archetypeUpdate[field] = value
    else identityUpdate[field] = value
  }
  if (Object.keys(archetypeUpdate).length) {
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update(archetypeUpdate)
  }
  if (Object.keys(identityUpdate).length) {
    await trx('char_identity').where({ char_sheet_id: sheetId }).update(identityUpdate)
  }
}

// AJOUT avantage — écriture directe des seules clés déclarées par mod_identity.
export async function applyIdentityGrant(trx, sheetId, modIdentityRaw) {
  const modIdentity = normalizeModIdentity(modIdentityRaw)
  if (!modIdentity) return
  await writeIdentityFields(trx, sheetId, modIdentity)
}

// AJOUT mutation — écriture directe des seules clés déclarées par mod_sex/mod_fertility.
export async function applyMutationIdentityGrant(trx, sheetId, mutRef) {
  const fields = {}
  if (mutRef.mod_sex) fields.sex = mutRef.mod_sex
  if (mutRef.mod_fertility) fields.is_fertile = mutRef.mod_fertility === 'self_fertile'
  if (Object.keys(fields).length) await writeIdentityFields(trx, sheetId, fields)
}

// RETRAIT (mutation ou avantage) ou RÉINSERTION COMPLÈTE (Wizard STEP3/STEP5 "retravail") — recalcule
// uniquement les champs listés, jamais les autres.
export async function recomputeIdentity(trx, sheetId, fields) {
  if (!fields || !fields.length) return

  const [mutations, advantages] = await Promise.all([
    trx('char_mutations as cm')
      .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
      .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active' })
      .select('rm.mod_sex', 'rm.mod_fertility')
      .orderBy('cm.created_at', 'asc'),
    trx('char_advantages as ca')
      .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
      .whereNull('ca.removed_at')
      .where('ca.char_sheet_id', sheetId)
      .whereNotNull('ra.mod_identity')
      .select('ra.mod_identity')
      .orderBy('ca.acquired_at', 'asc'),
  ])

  const resolved = {}
  for (const field of fields) resolved[field] = IDENTITY_FIELD_DEFAULT[field]

  for (const { mod_sex, mod_fertility } of mutations) {
    if (fields.includes('sex') && mod_sex) resolved.sex = mod_sex
    if (fields.includes('is_fertile') && mod_fertility) resolved.is_fertile = mod_fertility === 'self_fertile'
  }
  for (const row of advantages) {
    const modIdentity = normalizeModIdentity(row.mod_identity)
    if (!modIdentity) continue
    if (fields.includes('sex') && modIdentity.sex !== undefined) resolved.sex = modIdentity.sex
    if (fields.includes('is_fertile') && modIdentity.is_fertile !== undefined) resolved.is_fertile = modIdentity.is_fertile
    if (fields.includes('hand_pref') && modIdentity.hand_pref !== undefined) resolved.hand_pref = modIdentity.hand_pref
  }

  await writeIdentityFields(trx, sheetId, resolved)
}
