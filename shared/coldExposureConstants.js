// shared/coldExposureConstants.js — Cadence du Froid (docs/REGLES/FATIGUE&DOMMAGES.md:127-189,
// docs/PLAN_FATIGUE_DOMMAGES.md §11 Lot 5). Fonction pure, partagée client/serveur (même patron que
// shared/fatigueConstants.js/shared/gameTime.js) — la seule source de calcul de cadence, jamais
// dupliquée entre coldExposureService.js (serveur) et le sous-formulaire de prévisualisation (client).
//
// Froid extrême (RAW p.244) n'est pas une 4e tranche indépendante : c'est Glacial répété avec un
// diviseur qui double par tranche supplémentaire de -5°C sous 0°C — `extremeSteps` n'a de sens
// qu'avec tier==='glacial' (analyse à charge §11, passe 3 point 2).

export const COLD_TIERS = ['froid', 'tres_froid', 'glacial']

// Minutes de base entre deux Tests de résistance à la Fatigue, par tranche (RAW p.243).
const BASE_TEST_MINUTES = { froid: 120, tres_froid: 60, glacial: 30 }

// Dégâts physiques (Glacial+ uniquement) : toujours horaire à la base, quel que soit le nombre de
// paliers de Froid extrême déjà appliqués sur le dessus (RAW : "au bout d'une heure... pour chaque
// heure supplémentaire").
const BASE_DAMAGE_MINUTES = 60

export function isColdTier(tier) {
  return COLD_TIERS.includes(tier)
}

// Validation pure (pas d'AppError ici, shared/ reste sans dépendance serveur — à l'appelant de
// décider comment réagir à `false`, voir coldExposureService.js).
export function isValidColdExposureInput({ tier, extremeSteps = 0, wet = false }) {
  if (!isColdTier(tier)) return false
  if (!Number.isInteger(extremeSteps) || extremeSteps < 0) return false
  if (extremeSteps > 0 && tier !== 'glacial') return false
  if (typeof wet !== 'boolean') return false
  return true
}

// RAW : "tous les temps... divisés par deux" par tranche de Froid extrême, et séparément pour
// l'humidité (dans l'eau ou vêtements mouillés) — les deux diviseurs se cumulent multiplicativement.
function effectiveDivisor(extremeSteps, wet) {
  return 2 ** extremeSteps * (wet ? 2 : 1)
}

// computeColdIntervalMinutes — cadence effective en minutes, jamais fractionnaire ni nulle (passe 3
// point 1 : Glacial + extremeSteps + humide peut descendre sous 1 minute en arithmétique brute —
// `game_echeances.interval_minutes` est `integer` et le garde-fou anti-boucle infinie de
// echeanceService.js rejette tout intervalle non entier ou ≤ 0).
// `kind` : 'test' (cold_fatigue_check, base dépend de la tranche) ou 'damage' (cold_damage_tick,
// base toujours horaire, seulement pertinent si tier==='glacial').
export function computeColdIntervalMinutes({ tier, extremeSteps = 0, wet = false }, kind) {
  const base = kind === 'damage' ? BASE_DAMAGE_MINUTES : BASE_TEST_MINUTES[tier]
  return Math.max(1, Math.floor(base / effectiveDivisor(extremeSteps, wet)))
}
