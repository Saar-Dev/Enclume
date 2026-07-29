// docs/PLAN_FATIGUE_DOMMAGES.md §7 (Lot 1) — Horloge de campagne.
// floorDiv/floorMod : JS `%` est un opérateur de reste (garde le signe du dividende), pas un
// modulo — MDN documente explicitement ((n % d) + d) % d pour un résultat toujours positif.
// Sans ça, un compteur négatif (MJ qui recule avant le départ de campagne) donnerait des
// jours/mois/heures négatifs ou incohérents.
export function floorDiv(n, d) {
  return Math.floor(n / d)
}

export function floorMod(n, d) {
  return ((n % d) + d) % d
}

export const MINUTES_PER_HOUR = 60
export const HOURS_PER_DAY = 24
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY

// 12 mois fixes de 31 jours, pas de bissextile, pas de nom de mois — aucune matière trouvée dans
// le Livre de Base Polaris (§7 du plan, révision 2026-07-29), donc pas de longueur variable à gérer.
export const DAYS_PER_MONTH = 31
export const MONTHS_PER_YEAR = 12
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR

// Convertit campaigns.game_time_minutes (compteur affiché, signé) + calendar_start_year/month/day
// en date lisible. Fonction pure, jamais de valeur stockée en parallèle du compteur.
export function projectGameTime(gameTimeMinutes, { calendar_start_year, calendar_start_month, calendar_start_day }) {
  const minuteOfDay = floorMod(gameTimeMinutes, MINUTES_PER_DAY)
  const daysElapsed = floorDiv(gameTimeMinutes, MINUTES_PER_DAY)

  const startDayIndex =
    (calendar_start_year - 1) * DAYS_PER_YEAR +
    (calendar_start_month - 1) * DAYS_PER_MONTH +
    (calendar_start_day - 1)
  const absoluteDayIndex = startDayIndex + daysElapsed

  const yearIndex = floorDiv(absoluteDayIndex, DAYS_PER_YEAR)
  const dayOfYear = floorMod(absoluteDayIndex, DAYS_PER_YEAR)
  const monthIndex = Math.floor(dayOfYear / DAYS_PER_MONTH)
  const dayOfMonth = dayOfYear % DAYS_PER_MONTH

  return {
    year: yearIndex + 1,
    month: monthIndex + 1,
    day: dayOfMonth + 1,
    hour: Math.floor(minuteOfDay / MINUTES_PER_HOUR),
    minute: minuteOfDay % MINUTES_PER_HOUR,
  }
}
