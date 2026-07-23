// shared/mods/memoire.js — Mémoire de cibles Mémo (docs/PLAN_MODDING_REFONTE.md Phase 4.2).
// RAW : docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js EQ_00002 — "En cas de
// détection, on effectue un Test de fonctionnement. Si le Test échoue, le système tombe en panne et
// l'arme ne reconnaît pas la cible." Test réussi = reconnaissance = blocage du tir (évite le tir
// ami) ; Test raté = tir normal, pas de blocage.
//
// [HORS PÉRIMÈTRE Phase 4] Aucune interface ne permet encore au joueur d'enregistrer des cibles
// (RAW : "peut enregistrer 24 cibles différentes"). Tant que modState.memoire.registeredTargetIds
// est vide/absent, ce handler est un pur no-op (cible jamais "détectée" = jamais de Test).

export async function memoireOnBeforeAttack(modState, context) {
  const registeredTargetIds = modState?.memoire?.registeredTargetIds ?? []
  if (!context.targetCharacterId || !registeredTargetIds.includes(context.targetCharacterId)) {
    return { blocked: false }
  }

  const roll = await context.rollDice('1d20')
  const succeeded = roll.total <= context.modLevel
  if (!succeeded) return { blocked: false } // système en panne, ne reconnaît pas la cible

  return { blocked: true, reason: 'Mémoire de cibles — cible préenregistrée reconnue, tir bloqué' }
}
