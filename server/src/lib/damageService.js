import { parseDice }                        from './diceParser.js'
import { calcResistanceArmure }             from './charStats.js'
import {
  calcResistanceDommages, getMutationModForResistance, getAdvantageModForResistance, getNaturalArmorMod,
  polarisRound,
} from '../../../shared/polarisUtils.js'
import { getMutationEffects }               from '../services/mutationService.js'
import { getAdvantages }                    from '../services/advantageService.js'
import * as woundService                    from './woundService.js'
import * as statusService                   from './statusService.js'
import { LOC_TABLE, SLOT_TO_WOUND_LOCATION } from '../../../shared/armorConstants.js'
import {
  parseAmmoEffects, resolveDmgEffect, resolveChocFormula,
  resolveAmmoMechanic, resolveMechanicDamageFormula,
} from '../../../shared/weaponAmmoDsl.js'

// ─── _fetchWeaponAndAmmo (interne) ─────────────────────────────────────────────
// Fetch commun arme + munition chargée (current_ammo) en une passe — partagé par
// getEffectiveWeaponDamage et getEffectiveWeaponFormulaPreview, jamais dupliqué.
async function _fetchWeaponAndAmmo(db, weaponInvId) {
  return db('char_inventory')
    .leftJoin('ref_equipment as weapon_ref', 'char_inventory.equipment_id', 'weapon_ref.id')
    .leftJoin('ref_equipment as ammo_ref', 'char_inventory.current_ammo', 'ammo_ref.id')
    .where({ 'char_inventory.id': weaponInvId })
    // weapon_ref_id (CHOC1) : seul signal fiable de "l'arme a été trouvée" — weapon_formula peut être
    // légitimement vide pour une arme Choc pur, ne jamais l'utiliser comme test de présence de l'arme.
    .select('weapon_ref.id as weapon_ref_id', 'weapon_ref.damage_h as weapon_formula', 'ammo_ref.ammo_effects as ammo_effects')
    .first()
}

// ─── getEffectiveWeaponDamage — Chantier 11 Étape 2 Lot A+C1 (docs/PLAN_ARMES_DSL.md) ─────────────
// Point de résolution unique du dégât effectif d'une arme à munitions : fetch arme + munition
// chargée (current_ammo) en une passe, parse le DSL de la munition, lance les dés réels. Réutilisé
// par tous les appelants (PNJ immédiat et PJ différé via combat_pending) — jamais une 2ᵉ copie.
// Fail-safe : munition sans DSL/DSL malformé/formule invalide → repli sur damage_h brut de l'arme
// (comportement historique), jamais un throw qui bloque un tour de combat.
// Retourne null si l'arme elle-même est introuvable (arme désequipée/transférée entre la Déclaration
// et la Confirmation côté PJ différé — fenêtre réelle, pas seulement théorique) — TOUS les appelants
// doivent vérifier ce cas avant d'utiliser le retour. CHOC1 (docs/PLAN_CHOC1.md) : une arme trouvée
// mais sans damage_h (catégorie Choc pur, ex. Flex) retourne un résultat valide à 0, jamais null —
// null signifie uniquement "arme introuvable", plus jamais "pas de dégât physique".
// `rangeBand` (Lot C1, optionnel) : uniquement consommé par la dégression Shrapnel — sans lien avec
// le Choc (retiré du pipeline Choc au correctif Lot B, réintroduit ici pour un usage différent).
export async function getEffectiveWeaponDamage(db, weaponInvId, { rangeBand = null } = {}) {
  const row = await _fetchWeaponAndAmmo(db, weaponInvId)
  if (!row?.weapon_ref_id) return null

  const parsed = parseAmmoEffects(row.ammo_effects)
  if (!row.weapon_formula) {
    // Arme Choc pur (CHOC1) : aucun dégât physique à lancer, mais le Choc catalogue/munition doit
    // continuer à circuler normalement vers resolveTargetHit.
    return { total: 0, rolls: [], formula: '', tags: parsed.tags, choc: parsed.choc }
  }
  if (parsed.unknown.length) {
    console.warn(`[damageService] getEffectiveWeaponDamage — DSL non reconnu ignoré : ${parsed.unknown.join(' | ')} (weaponInvId:${weaponInvId})`)
  }
  // Lot C1 : dès que tags.FX correspond à une des 6 familles mécaniques, le registre devient la seule
  // autorité de dégât/armure/Choc — les clauses DMG=/CHOC= catalogue de CETTE ligne sont ignorées
  // (voir shared/weaponAmmoDsl.js, tête du registre AMMO_MECHANIC_ACTIONS, pour la justification).
  const mechanic = resolveAmmoMechanic(parsed.tags.FX)

  try {
    let baseFormula, bonusFormula, flatBonus, dropoffFormula, mulFactor, choc
    if (mechanic) {
      const resolved = resolveMechanicDamageFormula(row.weapon_formula, mechanic, rangeBand)
      baseFormula    = resolved.baseFormula
      bonusFormula   = resolved.bonusFormula
      flatBonus      = resolved.flatBonus
      dropoffFormula = resolved.dropoffFormula
      mulFactor      = 1
      choc           = mechanic.chocFixed ? { action: 'SET', value: mechanic.chocFixed } : parsed.choc
    } else {
      const resolved = resolveDmgEffect(row.weapon_formula, parsed.dmg)
      baseFormula    = resolved.baseFormula
      bonusFormula   = resolved.extraFormula
      flatBonus      = 0
      dropoffFormula = null
      mulFactor      = resolved.mulFactor
      choc           = parsed.choc
    }

    const base    = await parseDice(baseFormula.replace(/\s/g, ''))
    const bonus   = bonusFormula   ? await parseDice(bonusFormula.replace(/\s/g, ''))   : null
    const dropoff = dropoffFormula ? await parseDice(dropoffFormula.replace(/\s/g, '')) : null
    const total   = Math.round((base.total + (bonus?.total ?? 0) + flatBonus - (dropoff?.total ?? 0)) * mulFactor)
    const rolls   = [...base.rolls, ...(bonus?.rolls ?? []), ...(dropoff?.rolls ?? [])]
    const formulaParts = [
      base.formula,
      bonus ? `+${bonus.formula}` : '',
      dropoff ? `-${dropoff.formula}` : '',
      flatBonus ? `${flatBonus > 0 ? '+' : ''}${flatBonus}` : '',
    ]
    return {
      total, rolls,
      formula: formulaParts.join(''),
      tags:    parsed.tags,
      choc,
    }
  } catch (err) {
    console.warn(`[damageService] getEffectiveWeaponDamage — formule DSL invalide (${err.message}), repli sur damage_h brut. weaponInvId:${weaponInvId}`)
    const base = await parseDice(row.weapon_formula.replace(/\s/g, ''))
    return { total: base.total, rolls: base.rolls, formula: base.formula, tags: {}, choc: parsed.choc }
  }
}

// ─── getEffectiveWeaponFormulaPreview — Chantier 11 Étape 2 Lot A (correctif affichage) ────────────
// Aperçu Phase 1 (COMBAT_DAMAGE_PROMPT) : formule effective affichée au joueur AVANT le jet réel, sans
// jamais lancer de dé (parseDice serait non déterministe et gaspillerait un jet juste pour l'affichage
// — aperçu non engageant, `.claude/rules/combat.md`). Retourne une chaîne lisible ("3d10+5",
// "4d10+1d6", "4d10 ×0.5"), "—" si l'arme est trouvée mais sans damage_h (Choc pur, CHOC1), ou null
// si l'arme elle-même est introuvable.
export async function getEffectiveWeaponFormulaPreview(db, weaponInvId, { rangeBand = null } = {}) {
  const row = await _fetchWeaponAndAmmo(db, weaponInvId)
  if (!row?.weapon_ref_id) return null
  if (!row.weapon_formula) return '—'

  const parsed   = parseAmmoEffects(row.ammo_effects)
  const mechanic = resolveAmmoMechanic(parsed.tags.FX)

  let baseFormula, bonusFormula, flatBonus, dropoffFormula, mulFactor
  if (mechanic) {
    const resolved = resolveMechanicDamageFormula(row.weapon_formula, mechanic, rangeBand)
    baseFormula    = resolved.baseFormula
    bonusFormula   = resolved.bonusFormula
    flatBonus      = resolved.flatBonus
    dropoffFormula = resolved.dropoffFormula
    mulFactor      = 1
  } else {
    const resolved = resolveDmgEffect(row.weapon_formula, parsed.dmg)
    baseFormula    = resolved.baseFormula
    bonusFormula   = resolved.extraFormula
    flatBonus      = 0
    dropoffFormula = null
    mulFactor      = resolved.mulFactor
  }

  const withExtra = [
    baseFormula,
    bonusFormula   ? `+${bonusFormula}` : '',
    dropoffFormula ? `-${dropoffFormula}` : '',
    flatBonus      ? `${flatBonus > 0 ? '+' : ''}${flatBonus}` : '',
  ].join('')
  return mulFactor !== 1 ? `${withExtra} ×${mulFactor}` : withExtra
}

// ─── getEffectiveMeleeDamage — CHOC1 prérequis (docs/PLAN_CHOC1.md, docs/JOURNALTEMP.md Étape 6) ────
// Point de résolution unique du dégât effectif d'une attaque de corps-à-corps — miroir de
// getEffectiveWeaponDamage (tir) : fetch au moment du jet réel, jamais précalculé. Remplace 5 appels
// directs à parseDice(damageFormula) trouvés dans resolveMeleeAction (3 branches défenseur PNJ/sans-
// défense/drone) + confirmMeleeDefense (PNJ attaquant) + confirmDamage (PJ attaquant) — même bug
// latent partout (formule vide non gérée pour une arme Choc pur), même correctif, un seul endroit.
// Trois producteurs : arme naturelle (mutation) > arme équipée > mains nues ('1D4') par défaut.
// `naturalWeaponCharMutationId`/`charSheetId` : uniquement fournis par resolveMeleeAction (même tick
// que la Déclaration, aucun risque de péremption) — les appels différés (confirmMeleeDefense/
// confirmDamage, après le round-trip défense) ne les passent jamais, ils s'appuient sur
// `fallbackFormula` pour ce cas (formule mutation déjà résolue à la Déclaration — statique, contenu
// catalogue, pas de fenêtre de péremption comme pour une arme équipable/désequipable).
// `fallbackFormula` (formule résolue à la Déclaration) : utilisée si l'arme équipée n'est plus
// trouvable au moment du jet (désequipée/transférée entre Déclaration et Confirmation — fenêtre
// réelle côté PJ différé, même risque déjà géré côté tir) — jamais un tour de combat silencieux.
export async function getEffectiveMeleeDamage(db, { weaponInvId = null, naturalWeaponCharMutationId = null, charSheetId = null, fallbackFormula = null } = {}) {
  let formula, producer, weaponName = null

  if (naturalWeaponCharMutationId && charSheetId) {
    const naturalWeaponMutation = await db('char_mutations as cm')
      .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
      .where({ 'cm.id': naturalWeaponCharMutationId, 'cm.char_sheet_id': charSheetId, 'cm.status': 'active' })
      .select('rm.natural_weapon_formula', 'rm.name as mutation_name')
      .first()
    formula = naturalWeaponMutation?.natural_weapon_formula ?? fallbackFormula ?? '1D4'
    producer = naturalWeaponMutation?.natural_weapon_formula ? 'arme naturelle' : 'fallback'
    weaponName = naturalWeaponMutation?.mutation_name ?? null
  } else if (weaponInvId) {
    const weapon = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.id': weaponInvId })
      .select('ref_equipment.id as weapon_ref_id', 'ref_equipment.damage_h as ref_damage_h', 'ref_equipment.name as weapon_name')
      .first()
    // weapon_ref_id absent = arme introuvable → repli sur la formule stockée à la Déclaration.
    formula = weapon?.weapon_ref_id ? (weapon.ref_damage_h ?? null) : (fallbackFormula ?? '1D4')
    producer = weapon?.weapon_ref_id ? 'arme équipée' : 'fallback (arme introuvable)'
    weaponName = weapon?.weapon_name ?? null
  } else {
    formula = fallbackFormula ?? '1D4'
    producer = 'mains nues'
  }

  if (!formula) {
    console.log(`[DBG] getEffectiveMeleeDamage — producteur:${producer} arme:${weaponName ?? '—'} weaponInvId:${weaponInvId ?? '—'} formule:(vide, Choc pur) → total:0`)
    return { total: 0, rolls: [], formula: '', seed: 0 }
  }
  const rolled = await parseDice(formula.replace(/\s/g, ''))
  console.log(`[DBG] getEffectiveMeleeDamage — producteur:${producer} arme:${weaponName ?? '—'} weaponInvId:${weaponInvId ?? '—'} formule:${formula} → total:${rolled.total}`)
  return { total: rolled.total, rolls: rolled.rolls, formula, seed: rolled.seed }
}

// _severityForDamage — table de sévérité (LdB p.114, 5/10/15/20/25/30) extraite en fonction interne
// (Lot B, docs/PLAN_ARMES_DSL.md) pour être appelée à la fois sur le dégât physique seul et sur le
// total combiné physique+Choc, sans dupliquer les seuils.
function _severityForDamage(net) {
  if      (net >= 30) return { severity: 'mortelle', is_lethal: true }
  else if (net >= 25) return { severity: 'mortelle', is_lethal: false }
  else if (net >= 20) return { severity: 'critique',  is_lethal: false }
  else if (net >= 15) return { severity: 'grave',     is_lethal: false }
  else if (net >= 10) return { severity: 'moyenne',   is_lethal: false }
  else if (net >=  5) return { severity: 'legere',    is_lethal: false }
  return { severity: null, is_lethal: false }
}

// Résolution complète côté cible : localisation D20 → armure → dégâts nets → sévérité → blessure → shock.
// degautsBruts calculé AVANT l'appel par le caller (contexte MR/modDom varie selon le handler).
// Retourne null si cibleType === 'drone' — le caller gère resolveDroneIntegrityLoss lui-même.
// Émet WOUND_ADDED via woundService (effet DB + WS inclus).
// chocDsl (Lot B, docs/PLAN_ARMES_DSL.md) : optionnel, null par défaut — resolveMeleeAction et les
// branches drone ne le passent jamais, comportement strictement inchangé pour elles.
// treatAsContact (docs/PLAN_BOUCLIER.md Lot B) : true pour tout coup au contact OU arme de jet/trait
// (RAW : "traité comme au contact") — exclut la protection localisée d'un Bouclier (Bras et Test de
// Chance) de la résolution armure, qui ne vaut RAW que face aux armes à feu à distance. Le malus au
// Test d'attaque de l'adversaire (effet symétrique, contact/jet-trait) est un mécanisme séparé,
// appliqué en amont par l'appelant (resolveMeleeAction/resolveAssaultAction) sur chancesAttaque,
// jamais ici — resolveTargetHit ne connaît que la résolution côté cible.
export async function resolveTargetHit(io, db, campaignId, {
  degautsBruts,
  characterIdCible,
  cibleType,
  char_sheet_id_cible,
  for_na_cible,
  con_na_cible,
  vol_na_cible,
  chocDsl = null,
  ammoFx = null,
  forcedSlotCode = null,
  treatAsContact = false,
}) {
  if (cibleType === 'drone') return null

  // 1. Localisation — visée (COM9, docs/PLAN_TIRVISE v2.md) ou 1D20 aléatoire (comportement
  // historique inchangé). rollLoc/locRolls/locSeed restent null quand visée — jamais un jet
  // gaspillé pour l'affichage (même convention que getEffectiveWeaponFormulaPreview).
  let rollLoc = null, locRolls = null, locSeed = null, slotCode
  if (forcedSlotCode) {
    slotCode = forcedSlotCode
  } else {
    const rolled = await parseDice('1d20')
    rollLoc = rolled.total; locRolls = rolled.rolls; locSeed = rolled.seed
    slotCode = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
  }
  const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

  // 2. Armures + résistances (mutations/avantages) de la cible — seul point d'insertion pour toute
  // la résolution de combat (docs/PLAN_MUTATION2.md Lot 3) : les 4 appelants de resolveTargetHit
  // n'ont plus besoin de fetcher mutations/avantages eux-mêmes.
  // `prt` (protection_shock) n'est pas consommé ici : le Choc de munition (Lot B) n'est pas réduit par
  // l'armure (LdB p.243 littéral + `docs/REGLES/REGLESMUNITIONS.md`) — `prt` reste réservé au futur
  // mécanisme arme (`ref_equipment.shock`, catégories 1/2, `docs/VOCABULARY.md` "Dommages de Choc").
  let etq = null
  let mutationEffectsCible = null, advantagesCible = []
  let rollChance = null, chanceRolls = null, chanceSeed = null, chanceSuccess = null, chanceThreshold = null
  if (char_sheet_id_cible && characterIdCible) {
    // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : lecture directe de char_inventory_slots — remplace le
    // filtre substring PI8 (`'/' + slot + '/' includes`) par une égalité exacte sur slot_code, plus
    // besoin de post-filtrer en JS.
    // Bouclier (docs/PLAN_BOUCLIER.md Lot B) : exclu de la protection normale au contact/jet-trait
    // (treatAsContact) — RAW ne lui accorde une valeur de Protection que face aux armes à feu.
    const armorQuery = db('char_inventory_slots as cis')
      .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where('char_inventory.character_id', characterIdCible)
      .where('cis.slot_code', slotCode)
      .select('ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
    if (treatAsContact) armorQuery.where((q) => q.whereNot('ref_equipment.category', 'Bouclier').orWhereNull('ref_equipment.category'))

    const [armuresSlot, mutEff, adv, shieldPetit] = await Promise.all([
      armorQuery,
      getMutationEffects(char_sheet_id_cible),
      getAdvantages(char_sheet_id_cible),
      // Bouclier Petit (docs/PLAN_BOUCLIER.md Lot B, RAW REGLEBOUCLIER.md) — protection localisée à
      // distance uniquement, jamais couverte par le slot composite (shield_extra_locations NULL pour
      // le Petit) : Corps/Tête ne sont protégés que si le Test de Chance réussit sur CE coup précis.
      (!treatAsContact && (localisation === 'corps' || localisation === 'tete'))
        ? db('char_inventory_slots as cis')
            .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
            .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where('char_inventory.character_id', characterIdCible)
            .whereIn('cis.slot_code', ['MG', 'MD'])
            .where('ref_equipment.category', 'Bouclier')
            .whereNull('ref_equipment.shield_extra_locations')
            .select('ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
            .first()
        : null,
    ])
    if (shieldPetit) {
      const sheetCible = await db('char_sheet').where({ id: char_sheet_id_cible }).select('chc').first()
      const rolled = await parseDice('1d20')
      rollChance = rolled.total; chanceRolls = rolled.rolls; chanceSeed = rolled.seed
      chanceThreshold = sheetCible?.chc ?? 11
      chanceSuccess = rollChance <= chanceThreshold
      if (chanceSuccess) armuresSlot.push(shieldPetit)
    }
    etq = calcResistanceArmure(armuresSlot).etq
    mutationEffectsCible = mutEff
    advantagesCible = adv

    // Lot C1 (docs/PLAN_ARMES_DSL.md) — armure de la cible modifiée par la munition (fraction fixe,
    // jamais un PEN= flat catalogue — voir shared/weaponAmmoDsl.js). Même registre que le dégât côté
    // getEffectiveWeaponDamage, jamais une 2ᵉ table dupliquée. Ne s'applique que si une armure réelle
    // a pu être calculée (etq non nul) — multiplier une absence d'armure n'a pas de sens.
    if (etq != null) {
      const mechanic = ammoFx ? resolveAmmoMechanic(ammoFx) : null
      if (mechanic?.armorMulFactor != null) {
        const scaled = etq * mechanic.armorMulFactor
        etq = mechanic.armorRound === 'polaris' ? polarisRound(scaled) : Math.floor(scaled)
      }
    }
  }

  // 3. RD + dégâts nets — RD_TABLE encode le modificateur tel qu'imprimé au LdB p.114 (positif pour
  // un personnage faible, négatif pour un personnage fort) ; la règle dit de l'AJOUTER aux dégâts
  // (REGLESYSCOMBAT.md ~1612 : "il faut ensuite ajouter le modificateur de Résistance aux Dommages").
  const rd        = calcResistanceDommages(
    for_na_cible, con_na_cible,
    getMutationModForResistance(mutationEffectsCible, 'damage') + getNaturalArmorMod(mutationEffectsCible),
    getAdvantageModForResistance(advantagesCible, 'damage'),
  )
  const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) + rd)

  // 3bis. Dommages de Choc (Lot B, LdB p.243 + `docs/REGLES/REGLESMUNITIONS.md`) — munition avec CHOC
  // applicable, quelle que soit la localisation touchée (catégorie 3, `docs/VOCABULARY.md`, aucune
  // restriction dans les munitions spéciales). Brut, jamais réduit (ni armure, ni RD) — confirmé Saar.
  // Dommages virtuels : jamais de character_wounds créée, seulement une comparaison de sévérité (étape 5).
  let chocTotal = null
  if (chocDsl) {
    const chocFormula = resolveChocFormula(chocDsl)
    if (chocFormula) {
      try {
        chocTotal = (await parseDice(chocFormula.replace(/\s/g, ''))).total
      } catch (err) {
        console.warn(`[damageService] resolveTargetHit — formule Choc invalide (${err.message}), Choc ignoré`)
      }
    }
  }

  // 4. Sévérité (physique seul — pilote toujours la blessure, étape 5)
  const { severity, is_lethal } = _severityForDamage(degatsNets)

  // 5. Blessure + shock test — la blessure reste basée uniquement sur le dégât physique (jamais gonflée
  // par du Choc virtuel). Le Test de Choc, lui, utilise le total combiné physique+Choc brut s'il y a
  // lieu (LdB p.243 : "Ajoutez ces Dommages additionnels au total de Dommages physiques obtenu
  // précédemment"), en remplacement exclusif du test natif (jamais les deux — un seul test par coup).
  let finalSeverity = severity
  let shockResult   = null
  const woundResult = await woundService.applyWound(io, db, campaignId, {
    charSheetId: char_sheet_id_cible, characterId: characterIdCible,
    localisation, severity,
  })
  if (woundResult) finalSeverity = woundResult.finalSeverity

  if (chocTotal !== null) {
    const { severity: combinedSeverity, is_lethal: combinedIsLethal } = _severityForDamage(degatsNets + chocTotal)
    shockResult = await statusService.resolveShockTest({
      finalSeverity: combinedSeverity, localisation, is_lethal: combinedIsLethal,
      for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
      mod_mutation_shock:  getMutationModForResistance(mutationEffectsCible, 'shock'),
      mod_advantage_shock: getAdvantageModForResistance(advantagesCible, 'shock'),
    })
  } else if (woundResult) {
    shockResult = await statusService.resolveShockTest({
      finalSeverity, localisation, is_lethal,
      for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
      mod_mutation_shock:  getMutationModForResistance(mutationEffectsCible, 'shock'),
      mod_advantage_shock: getAdvantageModForResistance(advantagesCible, 'shock'),
    })
  }

  return {
    rollLoc, locRolls, locSeed,
    slotCode, localisation,
    etq, rd,
    degatsNets,
    chocTotal,
    severity, is_lethal,
    finalSeverity,
    shockResult,
    // Test de Chance du Petit bouclier (docs/PLAN_BOUCLIER.md Lot B/C) — null quand non applicable
    // (pas de Petit bouclier en jeu sur ce coup).
    rollChance, chanceRolls, chanceSeed, chanceSuccess, chanceThreshold,
  }
}
