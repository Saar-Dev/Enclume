// Wizard collaboratif GM/Joueur — docs/PLAN_WIZARDCOLLAB.md §3bis/§4.5.
//
// Fonctions pures partagées client/serveur : une seule définition du format de clé (`CLAUDE.md`
// §7 — jamais réimplémentée séparément de chaque côté). Le client les appelle avec les données
// qu'il a déjà en mémoire pour griser une option ; le serveur (creationService.js#enforceWizardLocks)
// résout d'abord l'identifiant réel par une lecture DB puis appelle la même fonction de formatage.
//
// Deux familles de verrou, unifiées par la même règle de comparaison (soumis vs persisté) :
//   - Choix unique (attribut, génotype, main directrice) : un verrou gèle CETTE clé en place —
//     rejette un changement vers/depuis elle, accepte toujours la resoumission de l'état acquis.
//   - Ensemble (mutations, carrières, avantages) : un verrou gèle l'appartenance de CETTE clé à
//     l'ensemble — ajout ou retrait tous deux rejetés, inchangé toujours accepté.

export function attrOptionKey(attrId) {
  return `attr_${attrId}`
}

// L'Ambidextre ('A') n'est jamais verrouillable individuellement — seuls les deux choix discrets
// Droite/Gauche le sont (docs/PLAN_WIZARDCOLLAB.md §3bis, 7e passe).
export function handOptionKey(pref) {
  if (pref === 'L') return 'hand_L'
  if (pref === 'R') return 'hand_R'
  return null
}

export function genotypeOptionKey(genotypeId) {
  return `genotype_${genotypeId}`
}

export function mutationOptionKey(mutationId) {
  return `mutation_${mutationId}`
}

export function careerOptionKey(code) {
  return `career_${code}`
}

export function advantageOptionKey(advantageId) {
  return `advantage_${advantageId}`
}

export function originGeoOptionKey(code) {
  return `origin_geo_${code}`
}

export function originSocOptionKey(code) {
  return `origin_soc_${code}`
}

export function trainingOptionKey(code) {
  return `training_${code}`
}

// Distinct du verrou career_<code> (qui bloque le choix) — celui-ci lève les prérequis
// d'éligibilité pour CETTE carrière précise, pour ce joueur, indépendamment de isGm (Lot B, bypass
// global). Les deux sont indépendants en base (wizard_locks n'attribue aucun sens aux clés) ; si les
// deux sont actifs en même temps, career_<code> bloque avant même que l'éligibilité soit évaluée —
// aucune exclusion mutuelle à coder, l'ordre d'enforcement le garantit déjà.
export function careerWaiveOptionKey(code) {
  return `career_waive_${code}`
}

// Choix unique : violation si la clé change réellement (soumis ≠ persisté) ET que l'une des deux
// clés (celle quittée ou celle visée) est verrouillée. Une clé null (ex. handOptionKey('A')) ne
// peut jamais être elle-même verrouillée.
export function isSingleChoiceLockViolation({ lockedKeys, submittedKey, persistedKey }) {
  if (submittedKey === persistedKey) return false
  const submittedLocked = submittedKey != null && lockedKeys.has(submittedKey)
  const persistedLocked = persistedKey != null && lockedKeys.has(persistedKey)
  return submittedLocked || persistedLocked
}

// Ensemble : renvoie les clés verrouillées dont l'appartenance (présent/absent) diffère entre
// l'ensemble soumis et l'ensemble persisté — ajout et retrait sont tous deux des violations.
export function findSetLockViolations({ lockedKeys, submittedKeys, persistedKeys }) {
  const violations = []
  for (const key of lockedKeys) {
    if (submittedKeys.has(key) !== persistedKeys.has(key)) violations.push(key)
  }
  return violations
}
