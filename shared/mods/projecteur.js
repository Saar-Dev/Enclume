// shared/mods/projecteur.js — Projecteur de mouvement (docs/PLAN_MODDING_REFONTE.md Phase 4.3).
// RAW : docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js EQ_00005 — Test avec le
// niveau de l'appareil quand la cible est en mouvement (Tir visé obligatoire) ; échec = tir
// automatiquement raté ; réussite = la marge de réussite réduit le malus de mouvement de la cible
// (et seulement celui-ci), jamais au-delà (pas de bonus résiduel) ; cible en zigzag/imprévisible =
// niveau de l'appareil réduit de moitié avant le Test.
//
// [HORS PÉRIMÈTRE Phase 4 — intégration non câblée] context.targetIsMoving,
// context.targetMovementIsErratic et context.targetMovementMalus (magnitude du malus de mouvement
// actuellement appliqué, ex. -5 pour "cible allure rapide", shared/combatSituationMods.js) ne sont
// pas encore fournis par resolveAssaultAction — nécessite de savoir dériver l'allure déclarée de la
// cible ce tour, hors périmètre de ce handler pur. Tant que ces champs sont absents du contexte, ce
// handler est un no-op (targetIsMoving falsy par défaut).

export async function projecteurOnBeforeAttack(modState, context) {
  if (!context.isAimedShot || !context.targetIsMoving) return { blocked: false }
  const malusMagnitude = Math.abs(context.targetMovementMalus ?? 0)
  if (malusMagnitude === 0) return { blocked: false } // rien à réduire

  const effectiveModLevel = context.targetMovementIsErratic
    ? Math.floor(context.modLevel / 2)
    : context.modLevel

  const roll = await context.rollDice('1d20')
  const succeeded = roll.total <= effectiveModLevel
  if (!succeeded) {
    return { blocked: true, reason: 'Projecteur de mouvement — Test raté, tir automatiquement raté' }
  }

  const margin = effectiveModLevel - roll.total
  const reduction = Math.min(margin, malusMagnitude) // jamais de bonus résiduel au-delà du malus
  return { blocked: false, adjustedModifiers: { targetMovementMalusReduction: reduction } }
}
