// shared/mods/ati.js — Analyseur Tactique Individuel (docs/PLAN_MODDING_REFONTE.md Phase 4.1).
// RAW : docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js EQ_00001. Test "avec le
// niveau de l'appareil" (context.modLevel = ref_equipment.bonus), jamais une compétence de
// personnage — vérifié en 3ᵉ passage d'analyse à charge, contrairement à l'hypothèse initiale.
//
// [HYPOTHÈSE non tranchée par le RAW, à confirmer par Saar en jeu] : le texte dit "une fois cumulé
// un total de 20 points de marge de réussite, il peut commencer à guider... à partir de cet instant,
// à chaque nouveau Test réussi, le bonus/malus augmente d'1 point". Ambigu sur le Test qui franchit
// exactement le seuil de 20 : ce code le compte comme le moment d'activation (currentEffect reste à
// 0), seul le PROCHAIN Test réussi après franchissement donne le premier +1.
//
// [HORS PÉRIMÈTRE Phase 4] Aucune interface ne permet encore au joueur de choisir mode/cible (item
// 4.1.4 du plan, décision produit distincte requise). Tant que modState.ati.targetCharacterId est
// absent, ce handler est un pur no-op — jamais un faux positif.

const ATI_ACTIVATION_THRESHOLD = 20
const ATI_MAX_EFFECT = 4

export async function atiOnTurnStart(modState, context) {
  const ati = modState?.ati
  if (!ati?.targetCharacterId) {
    return { updatedState: modState ?? null, tokenEffects: [] }
  }

  // Cible changée : mécanique explicitement mono-cible (RAW), l'analyse repart de zéro.
  const targetChanged = context.targetCharacterId != null && context.targetCharacterId !== ati.targetCharacterId
  const targetCharacterId = context.targetCharacterId ?? ati.targetCharacterId
  const cumulativeMR   = targetChanged ? 0 : (ati.cumulativeMR ?? 0)
  const active         = targetChanged ? false : (ati.active ?? false)
  const currentEffect  = targetChanged ? 0 : (ati.currentEffect ?? 0)

  const roll = await context.rollDice('1d20')
  const succeeded = roll.total <= context.modLevel
  const margin = context.modLevel - roll.total

  let nextCumulativeMR = cumulativeMR
  let nextActive = active
  let nextCurrentEffect = currentEffect

  if (!active) {
    if (succeeded) nextCumulativeMR = cumulativeMR + margin
    if (nextCumulativeMR >= ATI_ACTIVATION_THRESHOLD) nextActive = true
  } else if (succeeded) {
    nextCurrentEffect = Math.min(currentEffect + 1, ATI_MAX_EFFECT)
  }

  const updatedState = {
    ...modState,
    ati: {
      mode: ati.mode,
      targetCharacterId,
      cumulativeMR: nextCumulativeMR,
      active: nextActive,
      currentEffect: nextCurrentEffect,
    },
  }
  const tokenEffects = nextActive
    ? [{ statusCode: ati.mode === 'defensive' ? 'ati_defensive' : 'ati_offensive' }]
    : []
  return { updatedState, tokenEffects }
}

export async function atiOnCalculateModifiers(modState, context) {
  const ati = modState?.ati
  // "Cet appareil n'est efficace que contre une cible à la fois" — le bonus/malus ne s'applique
  // jamais en dehors de l'engagement avec la cible verrouillée.
  if (!ati?.active || !ati.targetCharacterId || ati.targetCharacterId !== context.targetCharacterId) {
    return { bonusAttaque: 0, bonusDefense: 0, breakdowns: [] }
  }
  const value = ati.currentEffect ?? 0
  if (value <= 0) return { bonusAttaque: 0, bonusDefense: 0, breakdowns: [] }

  const breakdown = { name: 'Analyseur tactique individuel', value }
  return ati.mode === 'defensive'
    ? { bonusAttaque: 0, bonusDefense: value, breakdowns: [breakdown] }
    : { bonusAttaque: value, bonusDefense: 0, breakdowns: [breakdown] }
}
