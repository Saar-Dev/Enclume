// server/src/lib/combatantContextService.js — Résout le contexte de Test combat (Seuil, malus,
// ModDom) d'un combattant humanoïde (pj/pnj), quel que soit le site appelant. Extraction Strangler
// Fig depuis resolveMeleeAction (socketCombatHelpers.js, site attaquant) — chaîne déjà écrite 7 fois
// avec des variations mineures, jamais un point d'écriture unique jusqu'ici.
// docs/PLANS/PLAN_COMBATANT_CONTEXT.md §3.3 — Lot A : ce fichier existe et est testé, mais n'est pas
// encore branché en remplacement du fetch inline (comparaison Scientist seulement, §2.3
// PLAN_RW_SYSCOMBAT.md). resolveExoTestContext (§3.4) et le dispatcher resolveCombatantTestContext
// (§3.2) arrivent au Lot G, pas ici.
import { calcSkillTotal, calcAttributeNA, getModDom } from './charStats.js'
import { calcActiveMalus } from './activeMalusRegistry.js'
import { getCampaignSettings } from './campaignSettingsService.js'
import { getMutationEffects } from '../services/mutationService.js'

// skillId=null → palier NA seul (cibles Tir/Drone, PLAN_COMBATANT_CONTEXT.md §2 palier 2) : pas de
// fetch ref_skills/char_skills, { for_na, con_na, vol_na, sheetId } seulement.
// skillId fourni → palier complet (attaquant CaC, tireur, §2 palier 1) : { skillTotal,
// effectiveMalus, modDom, for_na, con_na, vol_na, sheetId, mastery }.
// null si le personnage n'a pas de char_sheet (jamais d'exception — comportement gracieux repris
// des 6 sites qui l'implémentaient déjà chacun séparément).
export async function resolveHumanoidTestContext(db, character, skillId) {
  const sheet = await db('char_sheet').where({ character_id: character.id }).first()
  if (!sheet) return null

  const [attrs, archetype, mutationEffects] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    getMutationEffects(sheet.id),
  ])
  const geno = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  const for_na = calcAttributeNA(attrs, 'FOR', geno, mutationEffects)
  const con_na = calcAttributeNA(attrs, 'CON', geno, mutationEffects)
  const vol_na = calcAttributeNA(attrs, 'VOL', geno, mutationEffects)

  if (skillId == null) {
    return { sheetId: sheet.id, for_na, con_na, vol_na }
  }

  const [charSkill, refSkill, wounds, inventory, settings] = await Promise.all([
    db('char_skills').where({ char_sheet_id: sheet.id, skill_id: skillId }).first(),
    db('ref_skills').where({ id: skillId }).first(),
    db('character_wounds').where({ char_sheet_id: sheet.id }),
    db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': character.id })
      .select('char_inventory.container', 'char_inventory.quantity', 'ref_equipment.weight as ref_weight'),
    getCampaignSettings(db, character.campaign_id),
  ])

  const skillTotal = refSkill ? calcSkillTotal(attrs, charSkill, refSkill, geno, mutationEffects) : 0
  const mastery = charSkill?.mastery ?? 0

  const totalWeight = inventory.reduce((sum, i) =>
    (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
  )
  const effectiveMalus = calcActiveMalus({
    wounds, fatiguePoints: sheet.fatigue_points, totalWeight, forNA: for_na, settings,
  })
  const modDom = getModDom(for_na)

  return { skillTotal, effectiveMalus, modDom, for_na, con_na, vol_na, sheetId: sheet.id, mastery }
}
