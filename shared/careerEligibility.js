// careerEligibility.js — Évaluateur pur d'éligibilité d'une carrière (Wizard Step 4).
// Source de vérité UNIQUE, partagée serveur (validation reconcile) / client (filtre
// « Accessibles » + bouton « Ajouter » grisé + raisons, Lot 1).
//
// FONCTION PURE : aucun accès base. L'appelant fournit `career` (avec noms prérésolus :
// prerequisiteCareerName, requiredGenotypeLabel) et `context` (état du personnage).
// Renvoie des raisons STRUCTURÉES (codes + params) — jamais de texte : le serveur les formate
// vers ses messages historiques, le client les traduit via i18n.
//
// Ordre d'évaluation FIGÉ [prereq, genotype, attributes, education] = ordre d'appel historique
// dans reconcileCreation → reasons[0] correspond au message que l'utilisateur voyait déjà.
// Dettes préservées à l'identique (parité) : `prerequisite_logic` et `min_attributes_logic`
// (AND/OR) sont ignorés — tout est traité en AND, comme le code d'origine.

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

/**
 * @param {object} career - ligne ref_careers + { prerequisites[], education[],
 *   requiredGenotypeLabel }. Chaque prerequisite porte { prerequisite_career_id, min_years,
 *   prerequisiteCareerName }. Chaque education porte { field }.
 * @param {object} context - { careers:[{career_id, years}], genotypeId, higherEd,
 *   attributes:{FOR..PRE} }
 * @returns {{ eligible: boolean, reasons: Array }}
 *   Reason = { code:'prereq'|'genotype'|'attributes'|'education', ...params }
 */
export function evaluateCareerEligibility(career, context) {
  const ctx = context || {}
  const ctxCareers = ctx.careers || []
  const ctxAttrs = ctx.attributes || {}
  const reasons = []

  // 1. Prérequis carrières (AND implicite — prerequisite_logic ignoré, parité).
  //    S'arrête au 1er prérequis manquant (comme le code d'origine).
  for (const prereq of career.prerequisites || []) {
    const match = ctxCareers.find(c => c.career_id === prereq.prerequisite_career_id)
    if (!match || match.years < prereq.min_years) {
      reasons.push({
        code: 'prereq',
        careerId: prereq.prerequisite_career_id,
        careerName: prereq.prerequisiteCareerName,
        minYears: prereq.min_years,
      })
      break
    }
  }

  // 2. Génotype requis.
  if (career.required_genotype && ctx.genotypeId !== career.required_genotype) {
    reasons.push({
      code: 'genotype',
      genotypeId: career.required_genotype,
      genotypeLabel: career.requiredGenotypeLabel ?? career.required_genotype,
    })
  }

  // 3. Attributs minimaux (AND — min_attributes_logic ignoré, parité).
  const failed = []
  for (const attr of ATTR_IDS) {
    const min = career[`min_${attr.toLowerCase()}`]
    if (min !== null && min !== undefined && (ctxAttrs[attr] ?? 0) < min) {
      failed.push({ attr, have: ctxAttrs[attr], min })
    }
  }
  if (failed.length > 0) reasons.push({ code: 'attributes', failed })

  // 4. Études supérieures.
  const eduReqs = career.education || []
  if (eduReqs.length > 0) {
    const fields = eduReqs.map(e => e.field)
    if (!ctx.higherEd) {
      reasons.push({ code: 'education', present: false, fields })
    } else if (!eduReqs.some(e => e.field === ctx.higherEd)) {
      reasons.push({ code: 'education', present: true, fields })
    }
  }

  return { eligible: reasons.length === 0, reasons }
}
