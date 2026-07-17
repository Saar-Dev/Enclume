import { parseDice }                        from './diceParser.js'
import { calcResistanceArmure }             from './charStats.js'
import {
  calcResistanceDommages, getMutationModForResistance, getAdvantageModForResistance, getNaturalArmorMod,
} from '../../../shared/polarisUtils.js'
import { getMutationEffects }               from '../services/mutationService.js'
import { getAdvantages }                    from '../services/advantageService.js'
import * as woundService                    from './woundService.js'
import * as statusService                   from './statusService.js'
import { LOC_TABLE, SLOT_TO_WOUND_LOCATION } from '../../../shared/armorConstants.js'
import { parseAmmoEffects, resolveDmgEffect, resolveChocFormula } from '../../../shared/weaponAmmoDsl.js'

// ─── _fetchWeaponAndAmmo (interne) ─────────────────────────────────────────────
// Fetch commun arme + munition chargée (current_ammo) en une passe — partagé par
// getEffectiveWeaponDamage et getEffectiveWeaponFormulaPreview, jamais dupliqué.
async function _fetchWeaponAndAmmo(db, weaponInvId) {
  return db('char_inventory')
    .leftJoin('ref_equipment as weapon_ref', 'char_inventory.equipment_id', 'weapon_ref.id')
    .leftJoin('ref_equipment as ammo_ref', 'char_inventory.current_ammo', 'ammo_ref.id')
    .where({ 'char_inventory.id': weaponInvId })
    .select('weapon_ref.damage_h as weapon_formula', 'ammo_ref.ammo_effects as ammo_effects')
    .first()
}

// ─── getEffectiveWeaponDamage — Chantier 11 Étape 2 Lot A (docs/PLAN_ARMES_DSL.md) ────────────────
// Point de résolution unique du dégât effectif d'une arme à munitions : fetch arme + munition
// chargée (current_ammo) en une passe, parse le DSL de la munition, lance les dés réels. Réutilisé
// par tous les appelants (PNJ immédiat et PJ différé via combat_pending) — jamais une 2ᵉ copie.
// Fail-safe : munition sans DSL/DSL malformé/formule invalide → repli sur damage_h brut de l'arme
// (comportement historique), jamais un throw qui bloque un tour de combat.
// Retourne null si l'arme elle-même n'a pas de damage_h (même garde que le code historique) — TOUS
// les appelants doivent vérifier ce cas avant d'utiliser le retour (arme désequipée/transférée entre
// la Déclaration et la Confirmation côté PJ différé — fenêtre réelle, pas seulement théorique).
export async function getEffectiveWeaponDamage(db, weaponInvId) {
  const row = await _fetchWeaponAndAmmo(db, weaponInvId)
  if (!row?.weapon_formula) return null

  const parsed = parseAmmoEffects(row.ammo_effects)
  if (parsed.unknown.length) {
    console.warn(`[damageService] getEffectiveWeaponDamage — DSL non reconnu ignoré : ${parsed.unknown.join(' | ')} (weaponInvId:${weaponInvId})`)
  }
  const { baseFormula, extraFormula, mulFactor } = resolveDmgEffect(row.weapon_formula, parsed.dmg)

  try {
    const base  = await parseDice(baseFormula.replace(/\s/g, ''))
    const extra = extraFormula ? await parseDice(extraFormula.replace(/\s/g, '')) : null
    return {
      total:   Math.round((base.total + (extra?.total ?? 0)) * mulFactor),
      rolls:   extra ? [...base.rolls, ...extra.rolls] : base.rolls,
      formula: extra ? `${base.formula}+${extra.formula}` : base.formula,
      tags:    parsed.tags,
      choc:    parsed.choc,
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
// "4d10+1d6", "4d10 ×0.5") ou null si l'arme n'a pas de damage_h.
export async function getEffectiveWeaponFormulaPreview(db, weaponInvId) {
  const row = await _fetchWeaponAndAmmo(db, weaponInvId)
  if (!row?.weapon_formula) return null

  const parsed = parseAmmoEffects(row.ammo_effects)
  const { baseFormula, extraFormula, mulFactor } = resolveDmgEffect(row.weapon_formula, parsed.dmg)
  const withExtra = extraFormula ? `${baseFormula}+${extraFormula}` : baseFormula
  return mulFactor !== 1 ? `${withExtra} ×${mulFactor}` : withExtra
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
export async function resolveTargetHit(io, db, campaignId, {
  degautsBruts,
  characterIdCible,
  cibleType,
  char_sheet_id_cible,
  for_na_cible,
  con_na_cible,
  vol_na_cible,
  chocDsl = null,
}) {
  if (cibleType === 'drone') return null

  // 1. Localisation D20
  const { total: rollLoc, rolls: locRolls, seed: locSeed } = await parseDice('1d20')
  const slotCode    = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
  const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

  // 2. Armures + résistances (mutations/avantages) de la cible — seul point d'insertion pour toute
  // la résolution de combat (docs/PLAN_MUTATION2.md Lot 3) : les 4 appelants de resolveTargetHit
  // n'ont plus besoin de fetcher mutations/avantages eux-mêmes.
  // `prt` (protection_shock) n'est pas consommé ici : le Choc de munition (Lot B) n'est pas réduit par
  // l'armure (LdB p.243 littéral + `docs/REGLES/REGLESMUNITIONS.md`) — `prt` reste réservé au futur
  // mécanisme arme (`ref_equipment.shock`, catégories 1/2, `docs/VOCABULARY.md` "Dommages de Choc").
  let etq = null
  let mutationEffectsCible = null, advantagesCible = []
  if (char_sheet_id_cible && characterIdCible) {
    // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : lecture directe de char_inventory_slots — remplace le
    // filtre substring PI8 (`'/' + slot + '/' includes`) par une égalité exacte sur slot_code, plus
    // besoin de post-filtrer en JS.
    const [armuresSlot, mutEff, adv] = await Promise.all([
      db('char_inventory_slots as cis')
        .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where('char_inventory.character_id', characterIdCible)
        .where('cis.slot_code', slotCode)
        .select('ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock'),
      getMutationEffects(char_sheet_id_cible),
      getAdvantages(char_sheet_id_cible),
    ])
    etq = calcResistanceArmure(armuresSlot).etq
    mutationEffectsCible = mutEff
    advantagesCible = adv
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
  }
}
