// shared/careerAdvantages.js — Wizard Step4 Lot 4 — allocation des Avantages professionnels
// (REGLE_CREATION.txt:1151-1159 : 5 points/an par métier, à répartir librement dans les
// catégories listées par ce métier — pas de plafond par catégorie contrairement aux compétences).
// Fonction pure, réutilisée client (board) + serveur (validation reconcileCreation).

/**
 * @param {Record<string, number>} allocations — { category: pts } pour UN métier
 * @param {{ categories: string[], years: number }} ctx — catégories valides de ce métier + années
 * @returns {{ budget: number, totalSpent: number, remaining: number, perCategory: {category:string,pts:number}[], errors: object[] }}
 */
export function computeProAdvantageAllocation(allocations, ctx) {
  const { categories, years } = ctx
  // Un métier sans catégorie listée (ex. Chasseur de primes, LdB p.156) n'accorde aucun avantage
  // professionnel automatique — budget nul, pas 5×années invendables.
  const budget = categories.length === 0 ? 0 : 5 * years
  const validCategories = new Set(categories)
  const perCategory = []
  const errors = []
  let totalSpent = 0

  for (const [category, pts] of Object.entries(allocations || {})) {
    if (!validCategories.has(category)) {
      errors.push({ code: 'invalid_category', category })
      continue
    }
    if (!Number.isInteger(pts) || pts < 0) {
      errors.push({ code: 'invalid_points', category, pts })
      continue
    }
    if (pts === 0) continue
    totalSpent += pts
    perCategory.push({ category, pts })
  }

  if (totalSpent > budget) errors.push({ code: 'over_budget', budget, totalSpent })

  return { budget, totalSpent, remaining: budget - totalSpent, perCategory, errors }
}
