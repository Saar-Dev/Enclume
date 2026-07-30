import { parseDice }               from './diceParser.js'
import { calcAttributeNA, calcSkillTotal } from './charStats.js'
import { resolvePolarisTest }       from './polarisTestService.js'
import { getMutationEffects }       from '../services/mutationService.js'
import { resolveTargetHit }         from './damageService.js'
import { AppError }                 from './AppError.js'
import { WS }                       from '../../../shared/events.js'
import {
  FALL_DAMAGE_GROUND_LEVEL, FALL_DAMAGE_TABLE, fallDamageBeyondFourMeters,
  FALL_DAMAGE_TERRAIN_ACCIDENTE_BONUS, FALL_DAMAGE_TEST_MALUS_PER_METER,
  FALL_DAMAGE_TEST_MAX_HEIGHT_METERS, FALL_DAMAGE_TEST_REDUCTION_FORMULA,
} from '../../../shared/fallDamageConstants.js'

// resolveFall — Chute (docs/PLAN_FATIGUE_DOMMAGES.md §9 Lot 3, increment E). groundTrigger et
// heightMeters sont mutuellement exclusifs (garantis par l'appelant, increment G) : groundTrigger =
// cas RAW "Niveau du sol" (Allure maximale ou Catastrophe à un Test antérieur — décision MJ
// rétroactive, jamais détectée ici, voir shared/fallDamageConstants.js). heightMeters effectif pour le
// malus du Test d'Acrobatie/Équilibre (hauteur × 2) est 0 quand groundTrigger est vrai — RAW ne
// précise pas ce cas explicitement (silence RAW, comme l'intensité de l'Acide/Localisation du Brasier
// déjà notées), interprétation la plus conservative retenue : aucun malus pour une chute de hauteur
// nulle.
export async function resolveFall(io, db, campaignId, {
  characterId, charSheetId, tokenId = null, heightMeters = null, groundTrigger = false, terrainAccidente = false,
  attemptTest = false,
}) {
  // Le serveur reste autoritaire (CLAUDE.md §7) — le commentaire ci-dessus documente ce
  // qu'attend la fonction, cette garde vérifie que l'appelant l'a effectivement respecté avant
  // toute lecture de table, plutôt que de planter avec une TypeError brute sur un lookup absent.
  if (groundTrigger && heightMeters != null) {
    throw new AppError(400, 'resolveFall : groundTrigger et heightMeters sont mutuellement exclusifs')
  }
  if (!groundTrigger && (!Number.isInteger(heightMeters) || heightMeters < 1)) {
    throw new AppError(400, `resolveFall : heightMeters doit être un entier >= 1 (reçu ${heightMeters})`)
  }

  const base = groundTrigger
    ? FALL_DAMAGE_GROUND_LEVEL
    : (heightMeters <= 4 ? FALL_DAMAGE_TABLE[heightMeters] : fallDamageBeyondFourMeters(heightMeters))
  const effectiveHeight = groundTrigger ? 0 : heightMeters

  const baseRoll = await parseDice(base.formula)
  let degatsBruts = baseRoll.total
  let terrainRoll = null
  if (terrainAccidente) {
    terrainRoll = await parseDice(FALL_DAMAGE_TERRAIN_ACCIDENTE_BONUS)
    degatsBruts += terrainRoll.total
  }

  // Un seul fetch combiné (pas fetchCibleNA ici — le Test d'Acrobatie/Équilibre a besoin des mêmes
  // lignes brutes attrs/archetype/mutationEffects/genotypeRow que calcSkillTotal ; un appel à
  // fetchCibleNA PUIS un re-fetch séparé de ces mêmes lignes dupliquerait 3 requêtes pour rien).
  const [character, attrs, archetype, mutationEffects] = await Promise.all([
    db('characters').where({ id: characterId }).select('type').first(),
    db('char_attributes').where({ char_sheet_id: charSheetId }),
    db('char_archetype').where({ char_sheet_id: charSheetId }).first(),
    getMutationEffects(charSheetId),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null
  const for_na_cible = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)
  const con_na_cible = calcAttributeNA(attrs, 'CON', genotypeRow, mutationEffects)
  const vol_na_cible = calcAttributeNA(attrs, 'VOL', genotypeRow, mutationEffects)

  let testResult = null
  if (attemptTest && effectiveHeight <= FALL_DAMAGE_TEST_MAX_HEIGHT_METERS) {
    const [refSkill, charSkill] = await Promise.all([
      db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
      db('char_skills').where({ char_sheet_id: charSheetId, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
    ])
    const skillTotal = refSkill ? calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects) : 0
    const seuil = skillTotal - effectiveHeight * FALL_DAMAGE_TEST_MALUS_PER_METER
    const outcome = await resolvePolarisTest(seuil)
    let reduction = 0
    if (outcome.isSuccess) {
      const reductionRoll = await parseDice(FALL_DAMAGE_TEST_REDUCTION_FORMULA)
      reduction = reductionRoll.total + outcome.mr
      degatsBruts = Math.max(0, degatsBruts - reduction)
    }
    testResult = { ...outcome, seuil, skillTotal, reduction }
  }

  const locationsCount = typeof base.locations === 'number'
    ? base.locations
    : (await parseDice(base.locations)).total

  const hits = []
  for (let i = 0; i < locationsCount; i += 1) {
    const hit = await resolveTargetHit(io, db, campaignId, {
      degautsBruts: degatsBruts,
      characterIdCible: characterId,
      cibleType: character?.type ?? 'pnj',
      char_sheet_id_cible: charSheetId,
      for_na_cible, con_na_cible, vol_na_cible,
      armorReductionFactor: 0.5,
    })
    if (hit) {
      hits.push(hit)
      // Visible dans CombatResultGM/Player (Saar, test navigateur : dégâts pas visibles dans le
      // chat) — même patron que environmentalHazardService.js, sourceCode:'fall' résolu côté client
      // en libellé via combat.json:fallPanel.title (i18n, jamais de texte FR figé serveur).
      if (tokenId) {
        io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
          tireurId: null,
          sourceCode: 'fall',
          cibleId: tokenId,
          localisation: hit.localisation,
          degautsBruts: degatsBruts,
          degatsNets: hit.degatsNets,
          severity: hit.finalSeverity,
          is_lethal: hit.is_lethal,
          isSuccess: true,
          isPnj: true,
          shockResult: hit.shockResult,
        })
      }
    }
  }

  return {
    formula: base.formula, degatsBruts, locationsCount,
    baseRoll, terrainRoll, testResult, hits,
  }
}
