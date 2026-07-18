// shared/weaponAmmoDsl.js — DSL effets munitions (ref_equipment.ammo_effects). Chantier 11 Étape 2
// Lot A, voir docs/PLAN_ARMES_DSL.md. Parseur pur — aucune query DB, aucun lancer de dé (parseDice
// utilise crypto.randomInt côté serveur, appelé par l'appelant, jamais ici).

const STATEMENT_RE = /^([A-Z]+)\(([^)]*)\)$/

// DMG_ACTIONS — registre par action, dispatch par clé plutôt qu'un if/else (pattern inspiré des
// Rule Elements de PF2e/Foundry — voir docs/PLAN_ARMES_DSL.md §1bis — exprimé ici en fonctions pures,
// pas en classes, cohérent avec le reste du projet). Ajouter une action = ajouter une entrée, jamais
// toucher au dispatcher ni aux appelants.
const DMG_ACTIONS = {
  BASE: ()      => ({ overrideFormula: null,  extraFormula: null, mulFactor: 1 }),
  SET:  (value) => ({ overrideFormula: value, extraFormula: null, mulFactor: 1 }),
  ADD:  (value) => ({ overrideFormula: null,  extraFormula: value, mulFactor: 1 }),
  MUL:  (value) => {
    const n = Number(value)
    return { overrideFormula: null, extraFormula: null, mulFactor: Number.isFinite(n) ? n : 1 }
  },
}

function parseStatement(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed === 'BASE') return { action: 'BASE', value: null }
  const match = trimmed.match(STATEMENT_RE)
  if (!match) return null
  return { action: match[1], value: match[2] }
}

// parseAmmoEffects — DSL brut (ref_equipment.ammo_effects) → structure normalisée.
// Fail-safe permanent : clé ou action non reconnue → poussée dans `unknown`, jamais un throw.
// L'appelant serveur décide du repli (toujours : stats de base de l'arme).
//
// `choc` reste un statement brut non résolu ici (action + value tel quel, ex. value = "1D10+2") —
// résolu par `resolveChocFormula` (correctif Lot B, docs/PLAN_ARMES_DSL.md).
export function parseAmmoEffects(raw) {
  const result = { dmg: null, choc: null, tags: {}, unknown: [] }
  if (!raw || typeof raw !== 'string') return result

  for (const clause of raw.split(';')) {
    const eq = clause.indexOf('=')
    if (eq < 0) { if (clause.trim()) result.unknown.push(clause.trim()); continue }
    const key  = clause.slice(0, eq).trim()
    const rest = clause.slice(eq + 1).trim()

    if (key === 'DMG') {
      const stmt = parseStatement(rest)
      if (!stmt || !DMG_ACTIONS[stmt.action]) { result.unknown.push(clause.trim()); continue }
      result.dmg = stmt
    } else if (key === 'CHOC') {
      const stmt = parseStatement(rest)
      if (!stmt) { result.unknown.push(clause.trim()); continue }
      result.choc = stmt
    } else if (key === 'TXT') {
      for (const tag of rest.split('|')) {
        const tEq = tag.indexOf('=')
        if (tEq < 0) { if (tag.trim()) result.unknown.push(`TXT:${tag.trim()}`); continue }
        result.tags[tag.slice(0, tEq).trim()] = tag.slice(tEq + 1).trim()
      }
    } else {
      result.unknown.push(clause.trim())
    }
  }
  return result
}

// resolveDmgEffect — statement `dmg` parsé + formule de base de l'arme → formules à lancer.
// Pure, ne lance aucun dé. `ADD` avec scaling (ex. "+1/5D10_ARME", détecté par la virgule dans la
// valeur — voir docs/PLAN_ARMES_DSL.md §2 Lot A) est explicitement hors scope Lot A : repli sur la
// formule de base, jamais un blocage.
export function resolveDmgEffect(weaponFormula, dmg) {
  if (!dmg || !DMG_ACTIONS[dmg.action]) {
    return { baseFormula: weaponFormula, extraFormula: null, mulFactor: 1 }
  }
  if (dmg.action === 'ADD' && dmg.value.includes(',')) {
    return { baseFormula: weaponFormula, extraFormula: null, mulFactor: 1 }
  }
  const resolved = DMG_ACTIONS[dmg.action](dmg.value)
  return {
    baseFormula:  resolved.overrideFormula ?? weaponFormula,
    extraFormula: resolved.extraFormula,
    mulFactor:    resolved.mulFactor,
  }
}

// resolveChocFormula — statement `choc` parsé → formule de dégât de Choc à lancer (ou null si aucune
// ne s'applique). Pure, ne lance aucun dé (docs/PLAN_ARMES_DSL.md, correctif Lot B 2026-07-16).
//
// N'implémente QUE CHOC=SET(FORMULE) — valeur fixe (LdB `docs/REGLES/REGLESMUNITIONS.md` : "Balles
// assommantes"/"Balles explosives" donnent un bonus de Choc fixe, jamais une table par bande de
// portée — la table BP/C/M/L/E d'une version précédente de ce fichier n'existait dans aucune règle,
// c'était une donnée catalogue inventée). CHOC=ADD(...) (munitions Explosive, toujours avec scaling
// type "+1/5D10_ARME") reste hors scope : `null`, jamais une résolution partielle.
export function resolveChocFormula(chocDsl) {
  if (!chocDsl || chocDsl.action !== 'SET') return null
  return chocDsl.value || null
}
