import { parseDice }                        from './diceParser.js'
import { calcResistanceArmure }             from './charStats.js'
import { calcResistanceDommages }           from '../../../shared/polarisUtils.js'
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

  // 2. Armures de la cible (filtrées sur le slot touché)
  let etq = null
  if (char_sheet_id_cible && characterIdCible) {
    const armuresCible = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterIdCible })
      .whereNotNull('char_inventory.slot')
      .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
    const armuresSlot = armuresCible.filter(a =>
      a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')  // PI8
    )
    etq = calcResistanceArmure(armuresSlot).etq
  }

  // 3. RD + dégâts nets
  const rd        = calcResistanceDommages(for_na_cible, con_na_cible)
  const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)

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
