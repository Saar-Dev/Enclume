// inventoryService.js
// Extrait de char-sheet.js (docs/PLAN_MODING.md Étape 0) — couche DB pure pour char_inventory,
// consommée par les routes /:characterId/inventory* (minces : parse req → service → socket → res)
// et par modingService.js (réutilise removeItem pour la consommation d'un mod, voir piège P7).
// Convention confirmée par advantageService.js/mutationService.js : pas de req/res, pas de socket.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { calcEncumbrancePenalty, calcAttributeNA } from '../lib/charStats.js'
import { getMutationEffects } from './mutationService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { isEquippableLocation } from '../lib/inventoryRules.js'
import { SYMMETRIC_SLOT_PAIRS, HAND_TO_ARM_SLOT } from '../../../shared/armorConstants.js'

export const VALID_CONTAINERS = ['Coffre', 'Sac', 'Ceinture']
export const VALID_SLOTS      = ['T', 'C', 'BG', 'BD', 'JG', 'JD', 'D', 'Ce', 'MG', 'MD', '2M', 'Tr']
export const ARMOR_SLOTS      = new Set(['T', 'C', 'BG', 'BD', 'JG', 'JD'])
export const WEAPON_SLOTS     = new Set(['MG', 'MD', '2M', 'Tr'])

// Filtre moding (docs/PLAN_MODING.md) — centralisé ici puisque modingService.js en a besoin aussi.
export const WEAPON_FAMILY = 'Armes'
export const MOD_CATEGORY  = 'Accessoires pour armes'

export async function isContainerAvailable(characterId, container) {
  if (container === 'Coffre') return true
  const locationNeeded = container === 'Sac' ? 'D' : container === 'Ceinture' ? 'Ce' : null
  if (!locationNeeded) return false
  const row = await db('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .where('ref_equipment.location', locationNeeded)
    .first()
  return !!row
}

export async function getDefaultContainer(characterId) {
  const hasSac = await db('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .where('ref_equipment.location', 'D')
    .first()
  return hasSac ? 'Sac' : 'Coffre'
}

// Écrit l'état réel dans char_inventory_slots, seule autorité depuis la clôture du chantier
// (docs/PLAN_INVENTORY_SLOTS.md, char_inventory.slot retiré migration 166). Supprime puis
// réinsère (jamais un diff) : plus simple qu'un calcul d'ajout/retrait, coût négligible (au plus
// quelques lignes par item). slotValue null (déséquipement) ne fait que vider.
async function _writeSlots(trx, charInventoryId, characterId, slotValue) {
  await trx('char_inventory_slots').where({ char_inventory_id: charInventoryId }).del()
  if (!slotValue) return
  const codes = slotValue.split('/')
  await trx('char_inventory_slots').insert(
    codes.map(slot_code => ({ char_inventory_id: charInventoryId, character_id: characterId, slot_code }))
  )
}

// Lot B (docs/PLAN_INVENTORY_SLOTS.md) — lit char_inventory_slots au lieu de char_inventory.slot en
// égalité stricte : un item à slot composite (ex. futur bouclier "MG/BG/C") occupe bien MG pour ce
// contrôle, alors que l'ancienne comparaison exacte sur la colonne texte le manquait (trouvé au run
// à vide du chantier Bouclier). Utilisé pour tout slot à occupant unique (main/contenant), et pour
// le contrôle simple d'un slot armure côté quickEquip (qui ne gère pas le layering).
async function _handSlotConflict(characterId, slotCodes, excludeItemId = null) {
  let q = db('char_inventory_slots')
    .where({ character_id: characterId })
    .whereIn('slot_code', slotCodes)
  if (excludeItemId) q = q.whereNot({ char_inventory_id: excludeItemId })
  return q.first()
}

// Occupants actuels d'un slot armure (règle 1+S+S) — même correction que ci-dessus, remplace le
// `LIKE '/'+slot+'/'` sur la colonne texte par une lecture directe de char_inventory_slots.
async function _armorSlotOccupants(characterId, slotCode, excludeItemId = null) {
  let q = db('char_inventory_slots')
    .join('char_inventory', 'char_inventory.id', 'char_inventory_slots.char_inventory_id')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where('char_inventory_slots.character_id', characterId)
    .where('char_inventory_slots.slot_code', slotCode)
  if (excludeItemId) q = q.whereNot('char_inventory_slots.char_inventory_id', excludeItemId)
  return q.select('char_inventory.id as id', 'ref_equipment.malus_cat as malus_cat')
}

export async function getItemWithRef(itemId) {
  return db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.id': itemId })
    .select(
      'char_inventory.id',
      'char_inventory.equipment_id',
      'char_inventory.container',
      // Lot C (docs/PLAN_INVENTORY_SLOTS.md) : `slots` (tableau) remplace `slot` (texte, colonne
      // retirée) — seule source d'affichage désormais.
      db.raw(`(SELECT array_agg(slot_code ORDER BY slot_code) FROM char_inventory_slots WHERE char_inventory_id = char_inventory.id) as slots`),
      'char_inventory.quantity',
      'char_inventory.custom_name',
      'char_inventory.custom_desc',
      'char_inventory.notes',
      'char_inventory.custom_props',
      'ref_equipment.name as ref_name',
      'ref_equipment.family as ref_family',
      'ref_equipment.category as ref_category',
      'ref_equipment.weight as ref_weight',
      'ref_equipment.location as ref_location',
      'ref_equipment.protection as ref_protection',
      'ref_equipment.protection_shock as ref_protection_shock',
      'ref_equipment.malus_cat as ref_malus_cat',
      // Bouclier (docs/PLAN_BOUCLIER.md Lot C) — affichage fiche perso (malus CaC, localisations
      // couvertes en plus du bras). null pour tout item non-Bouclier.
      'ref_equipment.shield_atk_malus as ref_shield_atk_malus',
      'ref_equipment.shield_extra_locations as ref_shield_extra_locations',
      'ref_equipment.min_str as ref_min_str',
      'ref_equipment.capacity as ref_capacity',
      'ref_equipment.waterproof as ref_waterproof',
      'char_inventory.current_ammo',
      'char_inventory.ammo_remaining',
      'ref_equipment.caliber as ref_caliber',
      'ref_equipment.damage_h as ref_damage_h',
      'ref_equipment.shock as ref_shock',
      'ref_equipment.range as ref_range',
      'ref_equipment.fire_mode as ref_fire_mode',
      'ref_equipment.ammo_count as ref_ammo_count',
    )
    .first()
}

// Retourne le nombre de coups à charger lors de l'équipement initial d'une arme à feu.
// Conditions : slot ∈ WEAPON_SLOTS, caliber non null, ammo_count parseable > 0.
// Retourne null si l'item n'est pas une arme à feu ou si ammo_count est absent/invalide.
export async function resolveAmmoInit(equipmentId, slot) {
  if (!equipmentId || !WEAPON_SLOTS.has(slot)) return null
  const ref = await db('ref_equipment')
    .where({ id: equipmentId })
    .select('caliber', 'ammo_count')
    .first()
  if (!ref?.caliber || !ref?.ammo_count) return null
  const m = String(ref.ammo_count).match(/\d+/)
  const n = m ? parseInt(m[0], 10) : 0
  return n > 0 ? n : null
}

// GET /:characterId/inventory
export async function getInventory(characterId, campaignId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) return { items: [], sols: 0, total_weight: 0, ini_penalty: 0, threshold: 0 }

  // FOR nette = calcAttributeNA (base + pc_modifier + génotype + mutations), pas la valeur brute
  // — corrige PI4 (docs/PLAN_MUTATION2.md Lot 1). encumbrance_enabled/multiplier : options de
  // campagne, la mécanique existait déjà sans gate (défauts true/3 = comportement préservé).
  const [attrs, archetype, identity, mutationEffects, settings] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }).select('*'),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    db('char_identity').where({ char_sheet_id: sheet.id }).first(),
    getMutationEffects(sheet.id),
    getCampaignSettings(db, campaignId),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null
  const forValue = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)
  const multiplier = settings.encumbrance_multiplier

  const items = await db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .select(
      'char_inventory.id',
      'char_inventory.equipment_id',
      'char_inventory.container',
      // Lot C (docs/PLAN_INVENTORY_SLOTS.md) — voir getItemWithRef.
      db.raw(`(SELECT array_agg(slot_code ORDER BY slot_code) FROM char_inventory_slots WHERE char_inventory_id = char_inventory.id) as slots`),
      'char_inventory.quantity',
      'char_inventory.custom_name',
      'char_inventory.custom_desc',
      'char_inventory.notes',
      'char_inventory.custom_props',
      'ref_equipment.name as ref_name',
      'ref_equipment.family as ref_family',
      'ref_equipment.category as ref_category',
      'ref_equipment.weight as ref_weight',
      'ref_equipment.location as ref_location',
      'ref_equipment.protection as ref_protection',
      'ref_equipment.protection_shock as ref_protection_shock',
      'ref_equipment.malus_cat as ref_malus_cat',
      // Bouclier (docs/PLAN_BOUCLIER.md Lot C) — affichage fiche perso (malus CaC, localisations
      // couvertes en plus du bras). null pour tout item non-Bouclier.
      'ref_equipment.shield_atk_malus as ref_shield_atk_malus',
      'ref_equipment.shield_extra_locations as ref_shield_extra_locations',
      'ref_equipment.min_str as ref_min_str',
      'ref_equipment.capacity as ref_capacity',
      'ref_equipment.waterproof as ref_waterproof',
      'char_inventory.current_ammo',
      'char_inventory.ammo_remaining',
      'ref_equipment.caliber as ref_caliber',
      'ref_equipment.damage_h as ref_damage_h',
      'ref_equipment.shock as ref_shock',
      'ref_equipment.range as ref_range',
      'ref_equipment.fire_mode as ref_fire_mode',
      'ref_equipment.ammo_count as ref_ammo_count',
      'ref_equipment.description as ref_description',
      'ref_equipment.price as ref_price',
      // Lunette de visée (docs/PLAN_MODING_PHASEB.md Groupe 2) — niveau de la Lunette installée sur
      // cette arme (NULL si aucune) : sous-requête scalaire, réutilise le fetch /inventory déjà
      // effectué par CombatActionWindow.jsx plutôt qu'un nouvel appel réseau dédié.
      db.raw(`(
        SELECT re2.bonus::int FROM char_inventory_mods cim2
        JOIN ref_equipment re2 ON re2.id = cim2.equipment_id
        WHERE cim2.weapon_inv_id = char_inventory.id
          AND re2.mod_slot = 'optique' AND re2.mod_requires_aim = true
        LIMIT 1
      ) as lunette_niveau`),
      // Compétence liée à l'arme (COM20, docs/BUGIDENTIFIE.md) — même table que
      // socketCombatHelpers.js (résolution), affichage uniquement ici (tooltip fenêtre déclaration).
      db.raw(`(
        SELECT rs.label FROM ref_equipment_skill_assoc rea
        JOIN ref_skills rs ON rs.id = rea.skill_id
        WHERE rea.item_id = char_inventory.equipment_id
        LIMIT 1
      ) as skill_label`),
    )
    .orderBy('char_inventory.created_at', 'asc')

  const totalWeight = items.reduce((sum, item) => {
    if (item.container === 'Coffre') return sum
    if (item.ref_weight == null) return sum
    return sum + item.ref_weight * item.quantity
  }, 0)

  const threshold  = forValue * multiplier
  const iniPenalty = settings.encumbrance_enabled
    ? calcEncumbrancePenalty(totalWeight, forValue, multiplier)
    : 0

  return {
    items,
    sols:         sheet.sols,
    total_weight: totalWeight,
    ini_penalty:  iniPenalty,
    threshold,
    hand_pref:    identity?.hand_pref || 'R',
  }
}

// POST /:characterId/quick-equip (GM uniquement — vérifié par la route)
export async function quickEquip(characterId, equipment_id, slot) {
  if (!equipment_id) throw new AppError(400, 'equipment_id requis')
  if (!VALID_SLOTS.includes(slot)) throw new AppError(400, `slot invalide : ${slot}`)

  const conflict = await _handSlotConflict(characterId, [slot])
  if (conflict) throw new AppError(409, `Slot ${slot} déjà occupé`)

  const quickInsertData = { character_id: characterId, equipment_id, container: 'Sac', quantity: 1 }
  const autoAmmo = await resolveAmmoInit(equipment_id, slot)
  if (autoAmmo !== null) quickInsertData.ammo_remaining = autoAmmo

  const inserted = await db.transaction(async (trx) => {
    const [row] = await trx('char_inventory').insert(quickInsertData).returning('*')
    await _writeSlots(trx, row.id, characterId, slot)
    return row
  })

  return getItemWithRef(inserted.id)
}

// POST /:characterId/inventory
// Retourne { type: 'stack'|'single'|'multi', item, items } — la route choisit l'event socket et
// la forme de réponse HTTP à partir de `type`, sans dupliquer la logique métier.
export async function addItem(characterId, payload) {
  const {
    equipment_id,
    container: containerIn,
    slot,
    quantity = 1,
    custom_name, custom_desc, notes,
  } = payload

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(400, 'quantity doit être un entier positif')
  }

  const equipRef = equipment_id
    ? await db('ref_equipment').where({ id: equipment_id }).select('location', 'malus_cat').first()
    : null
  const equippable = isEquippableLocation(equipRef?.location ?? null)

  let container
  if (containerIn !== undefined) {
    if (!VALID_CONTAINERS.includes(containerIn)) {
      throw new AppError(400, `container invalide : ${containerIn}`)
    }
    if (!(await isContainerAvailable(characterId, containerIn))) {
      throw new AppError(400, `Container "${containerIn}" non disponible`)
    }
    container = containerIn
  } else {
    container = await getDefaultContainer(characterId)
  }

  let resolvedSlot = slot ?? null
  if (resolvedSlot !== null) {
    if (!VALID_SLOTS.includes(resolvedSlot)) {
      throw new AppError(400, `slot invalide : ${resolvedSlot}`)
    }
    const isContainerSlotPost = resolvedSlot === 'D' || resolvedSlot === 'Ce'
    if (isContainerSlotPost) {
      const conflict = await _handSlotConflict(characterId, [resolvedSlot])
      if (conflict) throw new AppError(409, 'Slot déjà occupé')
    } else if (WEAPON_SLOTS.has(resolvedSlot)) {
      if (!(await isContainerAvailable(characterId, 'Sac'))) {
        throw new AppError(400, 'Sac non disponible — impossible d\'équiper une arme')
      }
      const isTwoHand = resolvedSlot === '2M' || resolvedSlot === 'Tr'
      if (isTwoHand) {
        const conflict = await _handSlotConflict(characterId, ['MG', 'MD', '2M', 'Tr'])
        if (conflict) throw new AppError(409, 'Mains déjà occupées — impossible d\'équiper une arme à 2 mains')
      } else {
        const conflictTwoHand = await _handSlotConflict(characterId, ['2M', 'Tr'])
        if (conflictTwoHand) throw new AppError(409, 'Arme à 2 mains déjà équipée — choisissez une seule main')
        const conflict = await _handSlotConflict(characterId, [resolvedSlot])
        if (conflict) throw new AppError(409, `Slot ${resolvedSlot} déjà occupé`)
      }
      container = 'Sac'
    } else {
      if (!(await isContainerAvailable(characterId, 'Sac'))) {
        throw new AppError(400, 'Sac non disponible — impossible d\'équiper un item')
      }
      const existingAtSlot = await _armorSlotOccupants(characterId, resolvedSlot)
      if (existingAtSlot.length >= 3) throw new AppError(409, 'Slot complet — maximum 3 couches')
      const newItemCat = equipRef?.malus_cat ?? null
      const existingNonS = existingAtSlot.filter(i => i.malus_cat && i.malus_cat !== 'S')
      if (newItemCat && newItemCat !== 'S' && existingNonS.length >= 1) {
        throw new AppError(409, 'Slot déjà occupé par une armure principale (règle 1+S+S)')
      }
      container = 'Sac'
    }
  }

  // Stacking : même equipment_id + même container + non équipé (aucune ligne char_inventory_slots).
  // Jamais pour un item équipable (P57) — chaque exemplaire reste une ligne indépendante.
  if (equipment_id && resolvedSlot === null && !equippable) {
    const existing = await db('char_inventory')
      .where({ character_id: characterId, equipment_id, container })
      .whereNotExists(function () {
        this.select(1).from('char_inventory_slots').whereRaw('char_inventory_id = char_inventory.id')
      })
      .first()
    if (existing) {
      const [updated] = await db('char_inventory')
        .where({ id: existing.id })
        .update({ quantity: existing.quantity + quantity, updated_at: db.fn.now() })
        .returning('*')
      const item = await getItemWithRef(updated.id)
      return { type: 'stack', item }
    }
  }

  const insertData = {
    character_id: characterId,
    equipment_id: equipment_id ?? null,
    container,
    quantity,
  }
  if (custom_name !== undefined) insertData.custom_name = custom_name
  if (custom_desc !== undefined) insertData.custom_desc = custom_desc
  if (notes      !== undefined) insertData.notes       = notes

  // Auto-init ammo_remaining si le nouvel item est équipé directement en slot main
  if (resolvedSlot && equipment_id) {
    const autoAmmo = await resolveAmmoInit(equipment_id, resolvedSlot)
    if (autoAmmo !== null) insertData.ammo_remaining = autoAmmo
  }

  // P57 : un item équipable n'a jamais quantity > 1 — chaque exemplaire devient sa
  // propre ligne (seul le 1er reçoit le slot demandé, les suivants restent non équipés). Lot C
  // (docs/PLAN_INVENTORY_SLOTS.md) : le slot voulu par ligne n'existe plus en colonne — porté à
  // part (`intendedSlots`, même ordre que `rows`) puis appliqué via `_writeSlots` après l'insert.
  if (equippable && quantity > 1) {
    const rows = Array.from({ length: quantity }, () => ({ ...insertData, quantity: 1 }))
    const intendedSlots = Array.from({ length: quantity }, (_, i) => i === 0 ? resolvedSlot : null)
    const inserted = await db.transaction(async (trx) => {
      const insertedRows = await trx('char_inventory').insert(rows).returning('*')
      await Promise.all(insertedRows.map((r, i) => _writeSlots(trx, r.id, characterId, intendedSlots[i])))
      return insertedRows
    })
    const items = await Promise.all(inserted.map(r => getItemWithRef(r.id)))
    return { type: 'multi', items }
  }

  const inserted = await db.transaction(async (trx) => {
    const [row] = await trx('char_inventory').insert(insertData).returning('*')
    await _writeSlots(trx, row.id, characterId, resolvedSlot)
    return row
  })
  const item = await getItemWithRef(inserted.id)
  return { type: 'single', item }
}

// PUT /:characterId/inventory/:itemId
export async function updateItem(characterId, itemId, payload) {
  const existing = await db('char_inventory')
    .where({ id: itemId, character_id: characterId }).first()
  if (!existing) throw new AppError(404, 'Item not found')

  const { container, slot, quantity, custom_name, custom_desc, notes, custom_props, current_ammo } = payload
  const updates = {}

  if (container    !== undefined) updates.container    = container
  if (slot         !== undefined) updates.slot         = slot
  if (quantity     !== undefined) updates.quantity     = quantity
  if (custom_name  !== undefined) updates.custom_name  = custom_name
  if (custom_desc  !== undefined) updates.custom_desc  = custom_desc
  if (notes        !== undefined) updates.notes        = notes
  if (custom_props !== undefined) updates.custom_props = custom_props
  if (current_ammo !== undefined) updates.current_ammo = current_ammo

  // P13 — guard avant updated_at
  if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')

  // Validation slot
  if (updates.slot !== undefined && updates.slot !== null) {
    // Bouclier (docs/PLAN_BOUCLIER.md §3.10, décision verrouillée) : le client envoie uniquement la
    // main choisie (MG/MD) — le serveur complète ici la chaîne composite (main + bras +
    // shield_extra_locations catalogue) avant toute validation. Composition faite une seule fois,
    // ici, jamais côté client ni dans addItem/quickEquip (qui ne gèrent qu'un slot atomique).
    const equipRefForSlot = existing.equipment_id
      ? await db('ref_equipment').where({ id: existing.equipment_id })
          .select('category', 'malus_cat', 'shield_extra_locations').first()
      : null
    const isShield = equipRefForSlot?.category === 'Bouclier'
    if (isShield) {
      if (!['MG', 'MD'].includes(updates.slot)) {
        throw new AppError(400, `Bouclier : choisir la main (MG ou MD), reçu : ${updates.slot}`)
      }
      const extraCodes = (equipRefForSlot.shield_extra_locations ?? '').split('/').filter(Boolean)
      updates.slot = [updates.slot, HAND_TO_ARM_SLOT[updates.slot], ...extraCodes].join('/')
    }

    const isContainerSlotPut = updates.slot === 'D' || updates.slot === 'Ce'
    if (isContainerSlotPut) {
      const conflict = await _handSlotConflict(characterId, [updates.slot], itemId)
      if (conflict) throw new AppError(409, 'Slot déjà occupé')
    } else if (isShield) {
      // Main + localisations armure composées en un seul contrôle — pas de P58 (un bouclier ne
      // couvre jamais BG et BD à la fois, cf. addItem : structurellement inapplicable) ni de
      // branche WEAPON_SLOTS/armure générique (le slot n'est déjà plus un code atomique).
      if (!(await isContainerAvailable(characterId, 'Sac'))) {
        throw new AppError(400, 'Sac non disponible — impossible d\'équiper un bouclier')
      }
      const [hand, ...armorParts] = updates.slot.split('/')
      const handConflict = await _handSlotConflict(characterId, [hand], itemId)
      if (handConflict) throw new AppError(409, `Slot ${hand} déjà occupé`)
      for (const code of armorParts) {
        const existingAtSlot = await _armorSlotOccupants(characterId, code, itemId)
        if (existingAtSlot.length >= 3) {
          throw new AppError(409, `Slot ${code} complet — maximum 3 couches`)
        }
        const existingNonS = existingAtSlot.filter(i => i.malus_cat && i.malus_cat !== 'S')
        if (equipRefForSlot.malus_cat && equipRefForSlot.malus_cat !== 'S' && existingNonS.length >= 1) {
          throw new AppError(409, `Slot ${code} déjà occupé par une armure principale (règle 1+S+S)`)
        }
      }
      updates.container = 'Sac'
    } else if (WEAPON_SLOTS.has(updates.slot)) {
      if (!(await isContainerAvailable(characterId, 'Sac'))) {
        throw new AppError(400, 'Sac non disponible — impossible d\'équiper une arme')
      }
      const isTwoHand = updates.slot === '2M' || updates.slot === 'Tr'
      if (isTwoHand) {
        const conflict = await _handSlotConflict(characterId, ['MG', 'MD', '2M', 'Tr'], itemId)
        if (conflict) throw new AppError(409, 'Mains déjà occupées — impossible d\'équiper une arme à 2 mains')
      } else {
        const conflictTwoHand = await _handSlotConflict(characterId, ['2M', 'Tr'], itemId)
        if (conflictTwoHand) throw new AppError(409, 'Arme à 2 mains déjà équipée — choisissez une seule main')
        const conflict = await _handSlotConflict(characterId, [updates.slot], itemId)
        if (conflict) throw new AppError(409, `Slot ${updates.slot} déjà occupé`)
      }
      updates.container = 'Sac'
    } else {
      // Valider que chaque partie est un code armor valide
      const newParts = updates.slot.split('/')
      if (!newParts.every(p => ARMOR_SLOTS.has(p))) {
        throw new AppError(400, `slot invalide : ${updates.slot}`)
      }
      // Codes nouvellement ajoutés (absents du slot actuel de l'item) — Lot C
      // (docs/PLAN_INVENTORY_SLOTS.md) : lit char_inventory_slots, plus char_inventory.slot (retiré).
      const existingRows  = await db('char_inventory_slots').where({ char_inventory_id: itemId }).select('slot_code')
      const existingParts = new Set(existingRows.map(r => r.slot_code))
      const addedCodes = newParts.filter(c => !existingParts.has(c))
      // malus_cat + location de l'item (malus_cat commun à tous les slots, location pour P58)
      const newItemRef = existing.equipment_id
        ? await db('ref_equipment').where({ id: existing.equipment_id }).select('malus_cat', 'location').first()
        : null
      const newItemCat = newItemRef?.malus_cat ?? null
      // P58 : un item à ref_location simple (ex. 'B') ne peut couvrir qu'un seul côté d'une paire
      // symétrique (BG/BD, JG/JD) — seul un item à ref_location composée (armure intégrale) peut
      // légitimement accumuler les deux côtés sous un même exemplaire.
      const isCompoundLocation = (newItemRef?.location ?? '').includes('/')
      if (!isCompoundLocation) {
        for (const code of addedCodes) {
          const pairCode = SYMMETRIC_SLOT_PAIRS[code]
          if (pairCode && newParts.includes(pairCode)) {
            throw new AppError(409, `Cet exemplaire ne peut couvrir qu'un seul côté (${code}/${pairCode}) — équipez un second exemplaire de l'autre côté`)
          }
        }
      }
      // 1+S+S : vérifier chaque code nouvellement ajouté
      for (const code of addedCodes) {
        const existingAtSlot = await _armorSlotOccupants(characterId, code, itemId)
        if (existingAtSlot.length >= 3) {
          throw new AppError(409, `Slot ${code} complet — maximum 3 couches`)
        }
        const existingNonS = existingAtSlot.filter(i => i.malus_cat && i.malus_cat !== 'S')
        if (newItemCat && newItemCat !== 'S' && existingNonS.length >= 1) {
          throw new AppError(409, `Slot ${code} déjà occupé par une armure principale (règle 1+S+S)`)
        }
      }
      // PI2 : Sac obligatoire pour équiper
      if (addedCodes.length > 0 && !(await isContainerAvailable(characterId, 'Sac'))) {
        throw new AppError(400, 'Sac non disponible — impossible d\'équiper un item')
      }
      updates.container = 'Sac'
    }
  }

  // Validation container (si fourni explicitement et pas déjà forcé à 'Sac' par slot)
  if (updates.container !== undefined) {
    if (!VALID_CONTAINERS.includes(updates.container)) {
      throw new AppError(400, `container invalide : ${updates.container}`)
    }
    if (!(await isContainerAvailable(characterId, updates.container))) {
      throw new AppError(400, `Container "${updates.container}" non disponible`)
    }
  }

  if (updates.quantity !== undefined) {
    if (!Number.isInteger(updates.quantity) || updates.quantity < 1) {
      throw new AppError(400, 'quantity doit être un entier positif')
    }
    // P57 : un item équipable ne stacke jamais — quantity reste toujours 1.
    const ref = existing.equipment_id
      ? await db('ref_equipment').where({ id: existing.equipment_id }).select('location').first()
      : null
    if (isEquippableLocation(ref?.location ?? null) && updates.quantity !== 1) {
      throw new AppError(400, 'Un item équipable ne peut pas avoir une quantité différente de 1')
    }
  }

  if (updates.current_ammo != null) {
    const ammo = await db('ref_equipment').where({ id: updates.current_ammo }).first()
    if (!ammo) throw new AppError(404, 'Munition introuvable')
    const weaponRef = existing.equipment_id
      ? await db('ref_equipment').where({ id: existing.equipment_id }).select('caliber', 'family').first()
      : null
    if (!weaponRef || weaponRef.family !== 'Armes')
      throw new AppError(400, 'current_ammo ne peut être défini que sur une arme')
    if (weaponRef.caliber !== ammo.caliber)
      throw new AppError(400, `Munition incompatible — caliber attendu : ${weaponRef.caliber}`)
  }

  // Auto-init ammo_remaining si l'arme passe en main pour la première fois
  if (WEAPON_SLOTS.has(updates.slot) && existing.ammo_remaining === null) {
    const autoAmmo = await resolveAmmoInit(existing.equipment_id, updates.slot)
    if (autoAmmo !== null) updates.ammo_remaining = autoAmmo
  }

  // P13 — updated_at APRÈS le guard
  updates.updated_at = db.fn.now()

  // Lot C (docs/PLAN_INVENTORY_SLOTS.md) : `slot` n'est plus une colonne — utilisé ci-dessus pour
  // toute la validation, retiré juste avant l'update, appliqué à part via _writeSlots.
  const slotToWrite  = updates.slot
  const slotProvided = updates.slot !== undefined
  delete updates.slot

  await db.transaction(async (trx) => {
    await trx('char_inventory').where({ id: itemId }).update(updates)
    if (slotProvided) {
      await _writeSlots(trx, itemId, characterId, slotToWrite)
    }
  })
  return getItemWithRef(itemId)
}

// POST /:characterId/inventory/:itemId/reload
// Retourne { weapon, ammoRemoved, ammoItem, ammoItemId } — la route choisit les events socket
// (ammo supprimée vs décrémentée, + arme mise à jour) à partir de ce résultat.
export async function reloadWeapon(characterId, itemId, ammoItemId) {
  if (!ammoItemId) throw new AppError(400, 'ammo_item_id requis')

  const weapon = await db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.id': itemId, 'char_inventory.character_id': characterId })
    .select(
      'char_inventory.id',
      'char_inventory.equipment_id',
      'ref_equipment.family as ref_family',
      'ref_equipment.caliber as ref_caliber',
      'ref_equipment.ammo_count as ref_ammo_count',
    )
    .first()
  if (!weapon) throw new AppError(404, 'Arme introuvable')
  if (weapon.ref_family !== 'Armes') throw new AppError(400, 'Cet item n\'est pas une arme')
  if (!weapon.ref_caliber) throw new AppError(400, 'Cette arme n\'utilise pas de munitions')

  const ammoItem = await db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.id': ammoItemId, 'char_inventory.character_id': characterId })
    .select(
      'char_inventory.id',
      'char_inventory.equipment_id',
      'char_inventory.quantity',
      'char_inventory.container',
      'ref_equipment.caliber as ref_caliber',
      'ref_equipment.ammo_count as ref_ammo_count',
    )
    .first()
  if (!ammoItem) throw new AppError(404, 'Munition introuvable')
  if (ammoItem.container === 'Coffre') throw new AppError(400, 'Munition dans le Coffre — non disponible')
  if (ammoItem.ref_caliber !== weapon.ref_caliber) {
    throw new AppError(400, `Calibre incompatible — attendu : ${weapon.ref_caliber}`)
  }

  const parseCount = (s) => { if (!s) return 0; const m = String(s).match(/\d+/); return m ? parseInt(m[0], 10) : 0 }
  const clipSize   = parseCount(weapon.ref_ammo_count)
  const loadAmount = clipSize > 0 ? Math.min(clipSize, ammoItem.quantity) : ammoItem.quantity

  let ammoRemoved = false
  let ammoUpdated = null

  await db.transaction(async (trx) => {
    await trx('char_inventory').where({ id: itemId }).update({
      current_ammo:   ammoItem.equipment_id,
      ammo_remaining: loadAmount,
      updated_at:     db.fn.now(),
    })

    if (ammoItem.quantity - loadAmount <= 0) {
      await trx('char_inventory').where({ id: ammoItemId }).delete()
      ammoRemoved = true
    } else {
      await trx('char_inventory').where({ id: ammoItemId }).update({
        quantity:   ammoItem.quantity - loadAmount,
        updated_at: db.fn.now(),
      })
      ammoUpdated = await getItemWithRef(ammoItemId)
    }
  })

  const weaponUpdated = await getItemWithRef(itemId)
  return { weapon: weaponUpdated, ammoRemoved, ammoItem: ammoUpdated, ammoItemId }
}

// DELETE /:characterId/inventory/:itemId — et consommateur `modingService.installMod` (P7).
// qtyToRemove undefined/null = retrait total (comportement historique de la route DELETE sans
// body). Sinon décrément ; suppression de la ligne seulement si le stock atteint 0.
// trxOrDb optionnel — modingService l'appelle avec un `trx` pour rester dans la même transaction
// que l'INSERT char_inventory_mods (voir P3 du plan).
export async function removeItem(characterId, itemId, qtyToRemove, trxOrDb = db) {
  const q = trxOrDb
  const existing = await q('char_inventory')
    .where({ id: itemId, character_id: characterId }).first()
  if (!existing) throw new AppError(404, 'Item not found')

  if (qtyToRemove !== undefined && qtyToRemove !== null) {
    if (!Number.isInteger(qtyToRemove) || qtyToRemove < 1) {
      throw new AppError(400, 'quantity doit être un entier positif')
    }
    const newQty = existing.quantity - qtyToRemove
    if (newQty > 0) {
      const [updated] = await q('char_inventory')
        .where({ id: itemId })
        .update({ quantity: newQty, updated_at: q.fn.now() })
        .returning('*')
      return { deleted: false, item: updated, itemId }
    }
  }

  await q('char_inventory').where({ id: itemId }).del()
  return { deleted: true, item: null, itemId }
}
