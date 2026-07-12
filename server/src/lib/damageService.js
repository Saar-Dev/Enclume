import { parseDice }                        from './diceParser.js'
import { calcResistanceArmure }             from './charStats.js'
import {
  calcResistanceDommages, getMutationModForResistance, getAdvantageModForResistance,
} from '../../../shared/polarisUtils.js'
import { getMutationEffects }               from '../services/mutationService.js'
import { getAdvantages }                    from '../services/advantageService.js'
import * as woundService                    from './woundService.js'
import * as statusService                   from './statusService.js'
import { LOC_TABLE, SLOT_TO_WOUND_LOCATION } from '../../../shared/armorConstants.js'

// Résolution complète côté cible : localisation D20 → armure → dégâts nets → sévérité → blessure → shock.
// degautsBruts calculé AVANT l'appel par le caller (contexte MR/modDom varie selon le handler).
// Retourne null si cibleType === 'drone' — le caller gère resolveDroneIntegrityLoss lui-même.
// Émet WOUND_ADDED via woundService (effet DB + WS inclus).
export async function resolveTargetHit(io, db, campaignId, {
  degautsBruts,
  characterIdCible,
  cibleType,
  char_sheet_id_cible,
  for_na_cible,
  con_na_cible,
  vol_na_cible,
}) {
  if (cibleType === 'drone') return null

  // 1. Localisation D20
  const { total: rollLoc, rolls: locRolls, seed: locSeed } = await parseDice('1d20')
  const slotCode    = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
  const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

  // 2. Armures + résistances (mutations/avantages) de la cible — seul point d'insertion pour toute
  // la résolution de combat (docs/PLAN_MUTATION2.md Lot 3) : les 4 appelants de resolveTargetHit
  // n'ont plus besoin de fetcher mutations/avantages eux-mêmes.
  let etq = null
  let mutationEffectsCible = null, advantagesCible = []
  if (char_sheet_id_cible && characterIdCible) {
    const [armuresCible, mutEff, adv] = await Promise.all([
      db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.character_id': characterIdCible })
        .whereNotNull('char_inventory.slot')
        .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock'),
      getMutationEffects(char_sheet_id_cible),
      getAdvantages(char_sheet_id_cible),
    ])
    const armuresSlot = armuresCible.filter(a =>
      a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')  // PI8
    )
    etq = calcResistanceArmure(armuresSlot).etq
    mutationEffectsCible = mutEff
    advantagesCible = adv
  }

  // 3. RD + dégâts nets — RD_TABLE encode le modificateur tel qu'imprimé au LdB p.114 (positif pour
  // un personnage faible, négatif pour un personnage fort) ; la règle dit de l'AJOUTER aux dégâts
  // (REGLESYSCOMBAT.md ~1612 : "il faut ensuite ajouter le modificateur de Résistance aux Dommages").
  const rd        = calcResistanceDommages(
    for_na_cible, con_na_cible,
    getMutationModForResistance(mutationEffectsCible, 'damage'),
    getAdvantageModForResistance(advantagesCible, 'damage'),
  )
  const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) + rd)

  // 4. Sévérité
  let severity = null, is_lethal = false
  if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
  else if (degatsNets >= 25) { severity = 'mortelle' }
  else if (degatsNets >= 20) { severity = 'critique' }
  else if (degatsNets >= 15) { severity = 'grave'    }
  else if (degatsNets >= 10) { severity = 'moyenne'  }
  else if (degatsNets >=  5) { severity = 'legere'   }

  // 5. Blessure + shock test
  let finalSeverity = severity
  let shockResult   = null
  const woundResult = await woundService.applyWound(io, db, campaignId, {
    charSheetId: char_sheet_id_cible, characterId: characterIdCible,
    localisation, severity,
  })
  if (woundResult) {
    finalSeverity = woundResult.finalSeverity
    shockResult   = await statusService.resolveShockTest({
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
    severity, is_lethal,
    finalSeverity,
    shockResult,
  }
}
