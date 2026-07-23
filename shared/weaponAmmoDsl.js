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

// ─── Lot C1 — Effets mécaniques réels (docs/PLAN_ARMES_DSL.md §Lot C1) ─────────────────────────────
// Traduction fixe de `docs/REGLES/REGLESMUNITIONS.md`, jamais dérivée du catalogue. Vérifié en
// relisant les vraies chaînes DSL du seed (`STEP1_cleaned_data.js`) : HP (`ARMOR=TARGET_PLUS(1+1/D10_ARME)`),
// Explosive (`DMG=ADD(1D10,+1/5D10_ARME)`) et Shrapnel (`PEN=SET(5)`, `DMG_DROP=-1D10/RANGE` jamais
// parsé) portent des valeurs de mise à l'échelle `_ARME`/flat incompatibles avec le texte LdB traduit
// (même famille de défaut que les 5 cas déjà confirmés fautifs pendant ce chantier, dont Assommante/
// Choc, corrigé migration 160). Décision : dès que `tags.FX` correspond à une des 6 familles
// mécaniques ci-dessous, ce registre devient la SEULE autorité (dégât bonus, armure, Choc) — les
// clauses `DMG=`/`CHOC=`/`TXT=PEN=`/`ARMOR=`/`PASS=`/`DMG_DROP=` du catalogue pour ces lignes
// deviennent cosmétiques, jamais lues pour le calcul. Évite une migration de correction par munition
// (qui devrait être repétée à chaque nouvel item mal saisi) — une nouvelle munition SAP/HP/etc.
// ajoutée au catalogue fonctionne automatiquement dès que `FX=` est posé, sans dépendre d'une valeur
// numérique saisie à la main. Pattern "override object calculé" inspiré du rule element `DamageDice`
// de PF2e/Foundry (déjà cité §1bis) — `diceNumber`/`downgrade` modifient un jet par transformation,
// jamais par une chaîne pré-écrite par objet.
//
// dmgDiceDelta      : nombre de dés à retirer de la formule de l'arme (SAP/SLAP, "-1 dé").
// dmgFlatBonus      : bonus fixe ajouté au total, jamais lancé (HP, "+5").
// dmgDiceBonus      : formule de dé ajoutée au total, lancée séparément (Explosive, "+1D10").
// dmgDropoffByRange : formule de dé retirée du total selon la bande de portée (Shrapnel).
// chocFixed         : remplace intégralement le Choc catalogue par cette formule fixe (Explosive).
// armorMulFactor / armorRound : fraction appliquée à l'armure de la cible (les 6 familles).
const AMMO_MECHANIC_ACTIONS = {
  APHC:      { armorMulFactor: 2 / 3, armorRound: 'floor' },
  SAP:       { dmgDiceDelta: 1,       armorMulFactor: 0.5, armorRound: 'floor' },
  SLAP:      { dmgDiceDelta: 1,       armorMulFactor: 0.5, armorRound: 'floor' },
  HP:        { dmgFlatBonus: 5,       armorMulFactor: 1.5, armorRound: 'floor' },
  EXPLOSIVE: { dmgDiceBonus: '1D10', chocFixed: '1D10', armorMulFactor: 2, armorRound: 'floor' },
  SHRAPNEL:  {
    dmgDropoffByRange: { bout_portant: null, courte: '1D10', moyenne: '1D10', longue: '2D10', extreme: '3D10' },
    armorMulFactor: 1.5, armorRound: 'polaris',
  },
}

const FORMULA_RE = /^(\d+)?[dD](\d+)([+-]\d+)?$/

// reduceDiceCount — transformation pure de formule (pas une opération sur un nombre déjà lancé) :
// `NdX+M` → `(N-n)dX+M`, jamais sous 1 dé. Formule non reconnue (mixte, invalide) → inchangée,
// jamais un throw (même fail-safe que le reste du module).
export function reduceDiceCount(formula, n) {
  const match = String(formula || '').trim().match(FORMULA_RE)
  if (!match) return formula
  const count    = match[1] ? parseInt(match[1], 10) : 1
  const faces    = match[2]
  const modifier = match[3] || ''
  return `${Math.max(1, count - n)}D${faces}${modifier}`
}

// resolveAmmoMechanic — FX (tags.FX déjà extrait par parseAmmoEffects) → config du registre, ou
// `null` si non reconnu (munition sans mécanique C1 : Assommante/IEM/inconnu — comportement Lot A/B
// strictement inchangé pour elles).
export function resolveAmmoMechanic(fx) {
  return AMMO_MECHANIC_ACTIONS[fx] ?? null
}

// resolveMechanicDamageFormula — mechanic (résolu ci-dessus) + formule arme + bande de portée
// courante → formules à lancer. Pure, ne lance aucun dé (même convention que resolveDmgEffect).
export function resolveMechanicDamageFormula(weaponFormula, mechanic, rangeBand) {
  if (!mechanic) return null
  const baseFormula = mechanic.dmgDiceDelta
    ? reduceDiceCount(weaponFormula, mechanic.dmgDiceDelta)
    : weaponFormula
  const dropoffFormula = mechanic.dmgDropoffByRange
    ? (mechanic.dmgDropoffByRange[rangeBand] ?? null)
    : null
  return {
    baseFormula,
    bonusFormula: mechanic.dmgDiceBonus ?? null,
    flatBonus:    mechanic.dmgFlatBonus ?? 0,
    dropoffFormula,
  }
}
