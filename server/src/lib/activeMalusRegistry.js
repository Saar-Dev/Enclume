// server/src/lib/activeMalusRegistry.js — Registre unique des malus actifs d'un personnage
// (docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4, trou structurel 1 + révision registre). Avant ce
// registre, chaque site de résolution de Test recalculait indépendamment
// `woundPenalty - encumbrancePenalty` (5 sites combat/fiche + les macros n'appliquaient rien du
// tout, trou structurel 3) — patron registre déclaratif + dispatcher générique repris de
// shared/echeanceTypeRegistry.js / shared/environmentalHazardRegistry.js (jamais un switch central
// qui grossit à chaque nouveau lot). Chaque lot futur (Froid Lot 5, Maladies/Poisons Lot 7, Drogues
// Lot 8, Irradiations Lot 9) ajoute une entrée à ACTIVE_MALUS_SOURCES — jamais besoin de retoucher
// calcActiveMalus ni les sites consommateurs.
//
// Forme d'une entrée : { key, compute(ctx) } — compute retourne un nombre (malus, ≤ 0 par
// convention), jamais une mutation. ctx est un objet simple assemblé par l'appelant à partir de ce
// qu'il a déjà en main (aucun fetch propre à ce registre).
import { calcWoundPenalty, calcEncumbrancePenalty } from './charStats.js'
import { getFatigueLevelMalus } from '../../../shared/fatigueConstants.js'

export const ACTIVE_MALUS_SOURCES = [
  {
    key: 'wound',
    compute: (ctx) => calcWoundPenalty(ctx.wounds),
  },
  {
    key: 'encumbrance',
    compute: (ctx) => ctx.settings?.encumbrance_enabled
      ? -calcEncumbrancePenalty(ctx.totalWeight, ctx.forNA, ctx.settings.encumbrance_multiplier)
      : 0,
  },
  {
    key: 'fatigue',
    compute: (ctx) => ctx.settings?.fatigue_enabled
      ? getFatigueLevelMalus(ctx.fatiguePoints ?? 0)
      : 0,
  },
]

// exclude : clés à ignorer — utilisé par le Test de Fatigue lui-même pour s'auto-exempter du malus
// de palier de Fatigue (RAW ligne 976-979 : « les Tests de Fatigue ne sont pas affectés par le malus
// que les différents états de Fatigue imposent aux autres Tests ») tout en gardant blessure/
// encombrement, que rien n'exempte. Tableau vide (défaut) partout ailleurs.
export function calcActiveMalus(ctx, { exclude = [] } = {}) {
  return ACTIVE_MALUS_SOURCES
    .filter(src => !exclude.includes(src.key))
    .reduce((sum, src) => sum + src.compute(ctx), 0)
}
