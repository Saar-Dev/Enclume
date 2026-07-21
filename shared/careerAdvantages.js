// shared/careerAdvantages.js — Wizard Step4 Lot 4 — allocation des Avantages professionnels
// (REGLE_CREATION.txt:1151-1159 : 5 points/an par métier, à répartir librement dans les
// catégories listées par ce métier — pas de plafond par catégorie contrairement aux compétences).
// Fonction pure, réutilisée client (board) + serveur (validation reconcileCreation).

/**
 * @param {Record<string, number>} allocations — { category: pts } pour UN métier
 * @param {{ categories: string[], years: number, randomBudgetDelta?: number }} ctx — catégories
 *   valides de ce métier + années + delta du tirage 1D10 (Lot 6, défaut 0)
 * @returns {{ budget: number, totalSpent: number, remaining: number, perCategory: {category:string,pts:number}[], errors: object[] }}
 */
export function computeProAdvantageAllocation(allocations, ctx) {
  const { categories, years, randomBudgetDelta = 0 } = ctx
  // Un métier sans catégorie listée (ex. Chasseur de primes, LdB p.156) n'accorde aucun avantage
  // professionnel automatique — budget nul, pas 5×années invendables. randomBudgetDelta ignoré dans
  // ce cas : sans budget de base, il n'y a rien à échanger contre un jet (le jet reste possible pour
  // ce métier, mais uniquement narratif — cf. computeRandomBudgetDelta).
  const budget = categories.length === 0 ? 0 : 5 * years + randomBudgetDelta
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

// shared/careerAdvantages.js — Lot 6 — Tirage 1D10 (REGLE_PROFESSION.md, table « Avantages
// professionnels aléatoires » de chaque métier). Choisir de lancer 1D10 pour une tranche de 5 ans
// retire 5 pts du budget automatique de cette tranche ; si le résultat tiré a points_alt non nul
// (roll=10 : « ...ou 7 points à répartir ») et que le joueur choisit explicitement cette option
// plutôt que le bénéfice narratif, la tranche rend points_alt pts au lieu de 5 (net +2 sur roll=10).
// Fonction pure sans accès DB, réutilisée client (UI live) + serveur (validation reconcileCreation).

/**
 * @param {{blockIndex:number, roll:number, useAsPoints?:boolean}[]} picks — tirages d'UN métier
 * @param {{roll:number, points_alt:number|null}[]} benefitRows — ref_career_random_benefits de ce métier
 * @returns {number} delta à additionner au budget 5×années (négatif ou nul)
 */
export function computeRandomBudgetDelta(picks, benefitRows) {
  const rowByRoll = new Map((benefitRows ?? []).map(r => [r.roll, r]))
  let delta = 0
  for (const pick of picks ?? []) {
    delta -= 5
    if (pick.useAsPoints) {
      const row = rowByRoll.get(pick.roll)
      if (row?.points_alt != null) delta += row.points_alt
    }
  }
  return delta
}

// Mécanisation des tirages 1D10 (effets réels, pas seulement narratifs) — fonction pure, appelée
// à chaque reconcileCreation (rejouable) : le total renvoyé est recalculé intégralement à partir
// des picks courants, jamais accumulé entre deux appels. Un pick avec useAsPoints=true est exclu :
// le joueur a choisi les points du budget plutôt que l'effet de cette ligne (jamais les deux).
//
// Types d'effets supportés (ref_career_random_benefits.effects, JSONB) :
//   attribute      { target: 'FOR'|'CON'|'COO'|'ADA'|'PER'|'INT'|'VOL'|'PRE', value }
//   celebrity      { value }
//   skill_points   { value }
//   category       { target: string (catégorie d'avantage pro, ex. 'Matériel'), value }
//   income_percent { value }   — pourcentage additif, appliqué sur l'ensemble des économies du métier
//   income_multiplier { value } — multiplicateur (ex. 2 pour "doublé"), composé par multiplication
// Types non couverts par cette étape (disadvantage, narrative, relation Allié/Contact) : ignorés
// ici, le texte narratif reste affiché tel quel côté client.
export function resolveCareerRandomEffects(picks, benefitRows) {
  const rowByRoll = new Map((benefitRows ?? []).map(r => [r.roll, r]))
  const totals = {
    attributes: {},
    celebrity: 0,
    skillPoints: 0,
    categories: {},
    incomePercent: 0,
    incomeMultiplier: 1,
  }
  for (const pick of picks ?? []) {
    if (pick.useAsPoints) continue
    const row = rowByRoll.get(pick.roll)
    for (const effect of row?.effects ?? []) {
      switch (effect.type) {
        case 'attribute':
          totals.attributes[effect.target] = (totals.attributes[effect.target] ?? 0) + effect.value
          break
        case 'celebrity':
          totals.celebrity += effect.value
          break
        case 'skill_points':
          totals.skillPoints += effect.value
          break
        case 'category':
          totals.categories[effect.target] = (totals.categories[effect.target] ?? 0) + effect.value
          break
        case 'income_percent':
          totals.incomePercent += effect.value
          break
        case 'income_multiplier':
          totals.incomeMultiplier *= effect.value
          break
        default:
          break
      }
    }
  }
  return totals
}
