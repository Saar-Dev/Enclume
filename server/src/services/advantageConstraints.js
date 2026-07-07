// advantageConstraints.js
// Registre des contraintes R1-R6 pour l'ajout d'un avantage/désavantage (char_advantages V2).
// Source : docs/Character/Creation/PLAN_CREATION_E5.md — corrigé (AppError, JOIN currentAdvantages).

export const CONSTRAINTS = {
  exists: {
    validate: (advantageId, currentAdvantages, refAdv, allRefAdvantages) =>
      allRefAdvantages.some(a => a.advantage_id === advantageId),
    message: () => 'Avantage inconnu.',
  },
  not_already_owned: {
    validate: (advantageId, currentAdvantages) =>
      !currentAdvantages.some(a => a.advantage_id === advantageId),
    message: (refAdv) => `Vous possédez déjà "${refAdv.name}".`,
  },
  unique_absolute: {
    applies: (refAdv) => refAdv.is_unique,
    validate: (advantageId, currentAdvantages) =>
      !currentAdvantages.some(a => a.advantage_id === advantageId),
    message: (refAdv) => `"${refAdv.name}" est unique — vous le possédez déjà.`,
  },
  family_limit: {
    applies: (refAdv) => refAdv.family !== null,
    validate: (advantageId, currentAdvantages, refAdv, allRefAdvantages) => {
      const sameFamily = currentAdvantages.filter(a => a.family === refAdv.family)
      return sameFamily.length < (refAdv.family_limit ?? 1)
    },
    message: (refAdv) => `Limite de la famille "${refAdv.family}" atteinte (max ${refAdv.family_limit ?? 1}).`,
  },
  max_desavantage_pc: {
    applies: (refAdv) => refAdv.type === 'disadvantage',
    validate: (advantageId, currentAdvantages, refAdv) => {
      const currentPC = currentAdvantages
        .filter(a => a.type === 'disadvantage')
        .reduce((sum, a) => sum + Math.abs(a.cost_pc), 0)
      return currentPC + Math.abs(refAdv.cost_pc) <= 10
    },
    message: () => 'Limite de 10 PC de Désavantages atteinte.',
  },
  sufficient_pc: {
    applies: (refAdv) => refAdv.type === 'advantage',
    validate: (advantageId, currentAdvantages, refAdv, allRefAdvantages, ledger) => {
      const spent = ledger.pc_spent_step1 + ledger.pc_spent_step2 + ledger.pc_spent_step3
        + ledger.pc_spent_step4 + ledger.pc_spent_step5
      const available = ledger.pc_total - spent + ledger.pc_gained_desavantages + ledger.pc_postcreation
      return available >= refAdv.cost_pc
    },
    message: (refAdv) => `PC insuffisants : ${refAdv.cost_pc} requis.`,
  },
  not_if_sterile: {
    applies: (refAdv) => refAdv.advantage_id === 'adv_076',
    validate: (advantageId, currentAdvantages, refAdv, allRefAdvantages, ledger, isSterile) => !isSterile,
    message: () => `"Fécondité" incompatible avec une mutation stérilisante (Asexué) déjà acquise.`,
  },
}

/**
 * Valide l'ajout d'un avantage/désavantage contre toutes les contraintes applicables.
 * currentAdvantages doit déjà contenir type/cost_pc/family/family_limit/is_unique/name
 * (JOIN ref_advantages côté appelant).
 */
export function validateAdvantage(advantageId, currentAdvantages, ledger, allRefAdvantages, isSterile = false) {
  if (!CONSTRAINTS.exists.validate(advantageId, currentAdvantages, null, allRefAdvantages)) {
    return { valid: false, message: CONSTRAINTS.exists.message() }
  }

  const refAdv = allRefAdvantages.find(a => a.advantage_id === advantageId)

  for (const [key, constraint] of Object.entries(CONSTRAINTS)) {
    if (key === 'exists') continue
    if (constraint.applies && !constraint.applies(refAdv)) continue
    if (!constraint.validate(advantageId, currentAdvantages, refAdv, allRefAdvantages, ledger, isSterile)) {
      return { valid: false, message: constraint.message(refAdv) }
    }
  }

  return { valid: true, message: null }
}
