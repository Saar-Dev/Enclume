// characterTestContext.js — docs/PLANS/PLAN_CHAT_COMMANDES.md §6.
//
// Charge le contexte de stats vivant d'un personnage nécessaire à tout calcul de seuil de Test
// (compétence, attribut, ou dérivée secondaire) — extrait de MACRO_ROLL (socketDice.js), mêmes
// requêtes, même ordre, comportement strictement inchangé pour MACRO_ROLL. Second consommateur :
// resolveSkillTestCommand (skillTestService.js, commande /t), qui n'a besoin que d'une seule compétence
// (pas de sources composites ni de dérivées secondaires) mais du même contexte de base — éviter de
// dupliquer ce chargement plutôt que d'écrire un second moteur de calcul de seuil.
//
// Retourne null si le personnage n'a pas de fiche (char_sheet introuvable) — l'appelant décide de
// l'effet (return silencieux pour MACRO_ROLL, réponse i18n pour /t).
import { calcAttributeNA, calcAttributeAN } from './charStats.js'
import { calcActiveMalus } from './activeMalusRegistry.js'
import { getCampaignSettings } from './campaignSettingsService.js'
import { getMutationEffects } from '../services/mutationService.js'
import { getAdvantages } from '../services/advantageService.js'

export async function loadCharacterTestContext(db, campaignId, characterId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) return null

  const [attrs, archetype, mutationEffects, advantages, wounds, invItems, settings] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    getMutationEffects(sheet.id),
    getAdvantages(sheet.id),
    db('character_wounds').where({ char_sheet_id: sheet.id }),
    db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterId })
      .select('char_inventory.container', 'ref_equipment.weight as ref_weight', 'char_inventory.quantity'),
    getCampaignSettings(db, campaignId),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  // na() : niveau brut de l'Attribut — formules dérivées (REA, Seuils, Résistances...), RAW les définit
  // explicitement sur le niveau brut (ex. ATTRIBUTS.md:101 "Résistance aux poisons... : niveau de CON").
  const na = (attrId) => calcAttributeNA(attrs, attrId, genotypeRow, mutationEffects)
  // an() : Aptitude naturelle — seule conversion RAW confirmée d'un Attribut en score de Test
  // (docs/REGLES/ATTRIBUTS.md:131-148, docs/PLAN_TEST_CRITIQUE.md Lot 2).
  const an = (attrId) => calcAttributeAN(attrs, attrId, genotypeRow, mutationEffects)
  const totalWeight = invItems.reduce((sum, item) =>
    (item.container === 'Coffre' || item.ref_weight == null) ? sum : sum + item.ref_weight * item.quantity, 0
  )
  const activeMalus = calcActiveMalus({
    wounds, fatiguePoints: sheet.fatigue_points, totalWeight, forNA: na('FOR'), settings,
  })

  return { sheet, attrs, genotypeRow, mutationEffects, advantages, activeMalus, na, an }
}
