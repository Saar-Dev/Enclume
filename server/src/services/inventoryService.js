// inventoryService.js
// Extrait de char-sheet.js (docs/PLAN_MODING.md Étape 0) — couche DB pure pour char_inventory,
// consommée par les routes /:characterId/inventory* (minces : parse req → service → socket → res)
// et par modingService.js (réutilise removeItem pour la consommation d'un mod, voir piège P7).
// Convention confirmée par advantageService.js/mutationService.js : pas de req/res, pas de socket.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { localizeRefAliased, resolveRefField } from '../lib/refI18n.js'
import { calcEncumbrancePenalty, calcAttributeNA } from '../lib/charStats.js'
import { getMutationEffects } from './mutationService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { isEquippableLocation } from '../lib/inventoryRules.js'
import { SYMMETRIC_SLOT_PAIRS, HAND_TO_ARM_SLOT } from '../../../shared/armorConstants.js'
import { computeTotalWeight } from '../../../shared/inventoryMath.js'

// INV2 (docs/EN_COURS.md) — débit des Sols, jusqu'ici jamais appliqué par le bouton Ajouter. Verrou
// `forUpdate` + vérif AVANT décrément, même patron que tradeService.js#executeBuy (seul autre point
// du projet qui débite déjà des Sols) — jamais de décrément optimiste suivi d'un rollback, toujours
// lire le solde sous verrou d'abord.
async function _chargeSols(trx, characterId, amount) {
  if (amount <= 0) return
  const sheet = await trx('char_sheet').where({ character_id: characterId }).forUpdate().first('sols')
  if (!sheet || sheet.sols < amount) {
    throw new AppError(400, `Sols insuffisants (requis : ${amount}, disponible : ${sheet?.sols ?? 0})`)
  }
  await trx('char_sheet').where({ character_id: characterId }).decrement('sols', amount)
}

export const VALID_CONTAINERS = ['Coffre', 'Sac', 'Ceinture']
export const VALID_SLOTS      = ['T', 'C', 'BG', 'BD', 'JG', 'JD', 'D', 'Ce', 'MG', 'MD', '2M', 'Tr']
export const ARMOR_SLOTS      = new Set(['T', 'C', 'BG', 'BD', 'JG', 'JD'])
export const WEAPON_SLOTS     = new Set(['MG', 'MD', '2M', 'Tr'])

// Filtre moding (docs/PLAN_MODING.md) — centralisé ici puisque modingService.js en a besoin aussi.
export const WEAPON_FAMILY = 'Armes'
export const MOD_CATEGORY  = 'Accessoires pour armes'

// Sac/Ceinture disponibles seulement si le contenant lui-même est réellement équipé (slot 'D'/'Ce'
// dans char_inventory_slots) — pas simplement possédé quelque part, y compris au Coffre (INV1, Saar
// 2026-08-22). Le seul geste qui ouvre ce bac est d'équiper le Sac à dos/la Ceinture (ContainerPanel).
export async function isContainerAvailable(characterId, container) {
  if (container === 'Coffre') return true
  const slotNeeded = container === 'Sac' ? 'D' : container === 'Ceinture' ? 'Ce' : null
  if (!slotNeeded) return false
  const row = await db('char_inventory_slots')
    .where({ character_id: characterId, slot_code: slotNeeded })
    .first()
  return !!row
}

export async function getDefaultContainer(characterId) {
  const hasSac = await db('char_inventory_slots')
    .where({ character_id: characterId, slot_code: 'D' })
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
  const row = await db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.id': itemId })
    .select(
      'char_inventory.id',
      'char_inventory.character_id',
      'char_inventory.equipment_id',
      'char_inventory.container',
      'char_inventory.validated_by_gm',
      // Lot C (docs/PLAN_INVENTORY_SLOTS.md) : `slots` (tableau) remplace `slot` (texte, colonne
      // retirée) — seule source d'affichage désormais.
      db.raw(`(SELECT array_agg(slot_code ORDER BY slot_code) FROM char_inventory_slots WHERE char_inventory_id = char_inventory.id) as slots`),
      'char_inventory.quantity',
      'char_inventory.custom_name',
      'char_inventory.custom_desc',
      'char_inventory.notes',
      'char_inventory.custom_props',
      'ref_equipment.name as ref_name',
      'ref_equipment.name_i18n as ref_name_i18n',
      'ref_equipment.family as ref_family',
      'ref_equipment.family_i18n as ref_family_i18n',
      'ref_equipment.category as ref_category',
      'ref_equipment.category_i18n as ref_category_i18n',
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
  return row == null
    ? row
    : localizeRefAliased('ref_equipment', row, { ref_name: 'name', ref_family: 'family', ref_category: 'category' })
}

// Résolution canonique d'une arme "possédée et en main" — autorité unique pour le combat (Tir et
// CaC, arme principale et secondaire, Déclaration et Résolution). Avant cette fonction, chaque
// site d'appel réimplémentait ce contrôle en SQL brut (fetchHandWeaponForAssault, le contrôle
// arme secondaire CaC de COM24, et l'arme principale CaC qui n'en avait aucun) avec des listes de
// slots divergentes selon le fichier — cause racine de MELEE-INHAND et ASSAULT-INHAND-RESOLUTION
// (docs/BUGIDENTIFIE.md, session 2026-08-05). `slotCodes` est un paramètre obligatoire (pas de
// défaut implicite) : force chaque appelant à énoncer explicitement quels emplacements sont
// légitimes pour son cas (ex. arme à deux mains valide en principale, jamais en secondaire).
//
// Contrat de retour :
// - `null` si l'objet n'existe pas ou n'appartient pas à `characterId` — les deux cas sont
//   indiscernables pour l'appelant (même patron que l'ancien fetchHandWeaponForAssault, dont la
//   requête combinait déjà id + character_id) : un objet qui n'est pas le vôtre est, du point de vue
//   du combat, aussi inaccessible qu'un objet qui n'existe pas.
// - Sinon l'item complet (mêmes champs que getItemWithRef) enrichi de `inHand`/`categoryOk`
//   (booléens) — trouvé et possédé, mais l'appelant décide s'il distingue "pas en main" de
//   "mauvaise catégorie" dans son message (ex. `fetchHandWeaponForAssault` : "introuvable" vs
//   "pas en main" restent deux messages différents pour le joueur).
export async function getOwnedHandWeapon(characterId, itemId, { slotCodes, category = null } = {}) {
  if (!itemId || !characterId) return null
  const item = await getItemWithRef(itemId)
  if (!item || item.character_id !== characterId) return null
  const allowedSlots = slotCodes instanceof Set ? slotCodes : new Set(slotCodes)
  const inHand = (item.slots ?? []).some(slot => allowedSlots.has(slot))
  const categoryOk = !category || item.ref_category === category
  return { ...item, inHand, categoryOk }
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

  const rawItems = await db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .select(
      'char_inventory.id',
      'char_inventory.equipment_id',
      'char_inventory.container',
      'char_inventory.validated_by_gm',
      // Lot C (docs/PLAN_INVENTORY_SLOTS.md) — voir getItemWithRef.
      db.raw(`(SELECT array_agg(slot_code ORDER BY slot_code) FROM char_inventory_slots WHERE char_inventory_id = char_inventory.id) as slots`),
      'char_inventory.quantity',
      'char_inventory.custom_name',
      'char_inventory.custom_desc',
      'char_inventory.notes',
      'char_inventory.custom_props',
      'ref_equipment.name as ref_name',
      'ref_equipment.name_i18n as ref_name_i18n',
      'ref_equipment.family as ref_family',
      'ref_equipment.family_i18n as ref_family_i18n',
      'ref_equipment.category as ref_category',
      'ref_equipment.category_i18n as ref_category_i18n',
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
      'ref_equipment.description_i18n as ref_description_i18n',
      'ref_equipment.price as ref_price',
      // Export Excel (docs/PLANS/PLAN_EXPORTEXCEL.md, Lot 2 fichier 4/5) — champs `ref_equipment`
      // pas encore sélectionnés jusqu'ici, nécessaires pour les plages `InventaireObjNT`/
      // `InventaireObjFabricant`/`InventaireObjNation`/`InventaireObjInit`. Ajout pur (aucun champ
      // retiré) : sans effet sur les appelants existants de `getInventory()`. `damage_v_low`/
      // `damage_v_high` volontairement exclus : jamais lus par le moteur de combat réel
      // (`damageService.js` n'utilise que `damage_h`), résidus non exploités sur 13/717 lignes.
      'ref_equipment.tech_level as ref_tech_level',
      'ref_equipment.manufacturer as ref_manufacturer',
      'ref_equipment.nation as ref_nation',
      'ref_equipment.init_mod as ref_init_mod',
      'ref_equipment.rarity as ref_rarity',
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
      // Export Excel (Lot 2 fichier 4/5) — liste des mods installés sur cette arme
      // (`InventaireModInstalles`), `mod_name` déjà dénormalisé sur `char_inventory_mods` au moment
      // de l'installation (pas besoin de rejoindre `ref_equipment`).
      db.raw(`(
        SELECT string_agg(mod_name, ', ' ORDER BY installed_at)
        FROM char_inventory_mods
        WHERE weapon_inv_id = char_inventory.id
      ) as mods_installed`),
      // Export Excel (Lot 2 fichier 4/5) — `current_ammo` est un UUID (`ref_equipment.id`, migration
      // 52), jamais résolu en nom lisible par cette fonction jusqu'ici (les appelants existants
      // traitent l'UUID eux-mêmes) : champ dédié, ne change pas `current_ammo` pour ne rien casser
      // côté client.
      db.raw(`(
        SELECT name FROM ref_equipment WHERE id = char_inventory.current_ammo
      ) as current_ammo_name`),
      db.raw(`(
        SELECT name_i18n FROM ref_equipment WHERE id = char_inventory.current_ammo
      ) as current_ammo_name_i18n`),
      // Compétence liée à l'arme (COM20, docs/BUGIDENTIFIE.md) — même table que
      // socketCombatHelpers.js (résolution), affichage uniquement ici (tooltip fenêtre déclaration).
      db.raw(`(
        SELECT rs.label FROM ref_equipment_skill_assoc rea
        JOIN ref_skills rs ON rs.id = rea.skill_id
        WHERE rea.item_id = char_inventory.equipment_id
        LIMIT 1
      ) as skill_label`),
      db.raw(`(
        SELECT rs.label_i18n FROM ref_equipment_skill_assoc rea
        JOIN ref_skills rs ON rs.id = rea.skill_id
        WHERE rea.item_id = char_inventory.equipment_id
        LIMIT 1
      ) as skill_label_i18n`),
    )
    .orderBy('char_inventory.created_at', 'asc')

  // i18n (PLAN_LOCALISATION.md §7.15 B1.2) : résout les libellés ref_* aliasés, retire les *_i18n.
  const items = rawItems.map((it) => {
    const loc = localizeRefAliased('ref_equipment', it, {
      ref_name: 'name', ref_description: 'description', ref_family: 'family', ref_category: 'category',
      current_ammo_name: 'name',
    })
    loc.skill_label = resolveRefField('ref_skills', { label: it.skill_label, label_i18n: it.skill_label_i18n }, 'label')
    return loc
  })

  const totalWeight = computeTotalWeight(items)

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

  // Route déjà MJ only (char-sheet.js) — validated_by_gm: true directement, même raison que addItem.
  const quickInsertData = { character_id: characterId, equipment_id, container: 'Sac', quantity: 1, validated_by_gm: true }
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
// autoValidate : dérive validated_by_gm (PLAN_WIZARD_MATERIEL_GAUGES.md §3) — jamais lu du payload
// client. Vrai si le MJ ajoute l'item, ou s'il n'y a pas de MJ à attendre (personnage Coffre-native,
// sans campagne — aucun MJ ne peut jamais rejoindre pour valider, char-sheet.js calcule ce cas au
// call site). Un item ajouté par le MJ (ou fusionné sur un stack par le MJ) part directement validé ;
// un ajout joueur, même sur un stack déjà validé, remet la ligne fusionnée en attente (le statut
// reflète toujours le rôle du dernier auteur, jamais un statut hérité d'un ajout précédent).
// isGm : distinct d'autoValidate (INV2, docs/EN_COURS.md) — autoValidate peut être vrai pour une
// raison qui n'a rien à voir avec un privilège MJ (Coffre-native). Sert uniquement à décider si le
// débit de Sols a lieu ici (voir chargeAtAdd ci-dessous) ; ne change rien à validated_by_gm.
export async function addItem(characterId, payload, autoValidate = false, isGm = false) {
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
    ? await db('ref_equipment').where({ id: equipment_id }).select('location', 'malus_cat', 'price').first()
    : null

  // INV2 — un MJ qui ajoute (ou fusionne sur un stack) ne débite jamais : geste privilégié, comme
  // aujourd'hui. `autoValidate` peut être vrai pour une AUTRE raison (personnage Coffre-native, sans
  // MJ possible) — dans ce cas précis, il n'y aura jamais de validation ultérieure à laquelle
  // rattacher un débit différé, donc il faut débiter ici, immédiatement. Un ajout joueur en campagne
  // (autoValidate faux) n'est jamais débité ici : le débit a lieu à la validation MJ (updateItem).
  const chargeAtAdd = autoValidate && !isGm
  const totalPrice = (equipRef?.price ?? 0) * quantity
  const equippable = isEquippableLocation(equipRef?.location ?? null)

  const resolvedSlot = slot ?? null
  // Équiper le Sac à dos/la Ceinture (slot D/Ce) est justement l'action qui rend ce container
  // disponible (isContainerAvailable) — un appelant qui fournirait déjà container:'Sac'/'Ceinture'
  // en même temps que slot:'D'/'Ce' ne doit pas se heurter à une disponibilité que cette action même
  // est en train de créer.
  const containerSelfGranted = (resolvedSlot === 'D' && containerIn === 'Sac')
    || (resolvedSlot === 'Ce' && containerIn === 'Ceinture')

  let container
  if (containerIn !== undefined) {
    if (!VALID_CONTAINERS.includes(containerIn)) {
      throw new AppError(400, `container invalide : ${containerIn}`)
    }
    if (!containerSelfGranted && !(await isContainerAvailable(characterId, containerIn))) {
      throw new AppError(400, `Container "${containerIn}" non disponible`)
    }
    container = containerIn
  } else {
    container = await getDefaultContainer(characterId)
  }

  if (resolvedSlot !== null) {
    if (!VALID_SLOTS.includes(resolvedSlot)) {
      throw new AppError(400, `slot invalide : ${resolvedSlot}`)
    }
    const isContainerSlotPost = resolvedSlot === 'D' || resolvedSlot === 'Ce'
    if (isContainerSlotPost) {
      const conflict = await _handSlotConflict(characterId, [resolvedSlot])
      if (conflict) throw new AppError(409, 'Slot déjà occupé')
      // Équiper le Sac à dos/la Ceinture porte son propre poids (INV1) — même geste que l'armure/arme
      // ci-dessous, mais ici le contenant devient son propre bac (il ne va pas "dans" lui-même).
      container = resolvedSlot === 'D' ? 'Sac' : 'Ceinture'
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
      const [updated] = await db.transaction(async (trx) => {
        if (chargeAtAdd) await _chargeSols(trx, characterId, totalPrice)
        return trx('char_inventory')
          .where({ id: existing.id })
          .update({ quantity: existing.quantity + quantity, validated_by_gm: autoValidate, updated_at: db.fn.now() })
          .returning('*')
      })
      const item = await getItemWithRef(updated.id)
      return { type: 'stack', item }
    }
  }

  const insertData = {
    character_id: characterId,
    equipment_id: equipment_id ?? null,
    container,
    quantity,
    validated_by_gm: autoValidate,
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
      if (chargeAtAdd) await _chargeSols(trx, characterId, totalPrice)
      const insertedRows = await trx('char_inventory').insert(rows).returning('*')
      await Promise.all(insertedRows.map((r, i) => _writeSlots(trx, r.id, characterId, intendedSlots[i])))
      return insertedRows
    })
    const items = await Promise.all(inserted.map(r => getItemWithRef(r.id)))
    return { type: 'multi', items }
  }

  const inserted = await db.transaction(async (trx) => {
    if (chargeAtAdd) await _chargeSols(trx, characterId, totalPrice)
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

  const { container, slot, quantity, custom_name, custom_desc, notes, custom_props, current_ammo, validated_by_gm, confirmEmptyContainer } = payload
  const updates = {}
  // Déséquipement d'un Sac à dos/Ceinture dont le bac contient encore des objets (INV1) — renseigné
  // plus bas, appliqué dans la même transaction que l'update principal.
  let cascadeToCoffre = null
  // Équiper le Sac à dos/la Ceinture est justement l'action qui rend 'Sac'/'Ceinture' disponible
  // (isContainerAvailable) — la validation générale ci-dessous ne doit pas re-tester une disponibilité
  // que cette action précise est en train de créer (sinon le tout premier équipement se bloque lui-même).
  let skipContainerAvailabilityCheck = false

  if (container       !== undefined) updates.container       = container
  if (slot            !== undefined) updates.slot             = slot
  if (quantity        !== undefined) updates.quantity         = quantity
  if (custom_name     !== undefined) updates.custom_name      = custom_name
  if (custom_desc     !== undefined) updates.custom_desc      = custom_desc
  if (notes           !== undefined) updates.notes            = notes
  if (custom_props    !== undefined) updates.custom_props     = custom_props
  if (current_ammo    !== undefined) updates.current_ammo     = current_ammo
  // Autorisation (MJ only) déjà appliquée par la route (PLAN_WIZARD_MATERIEL_GAUGES.md §3) —
  // updateItem reste la même fonction owner+MJ pour tous les autres champs, pas de check ici.
  if (validated_by_gm !== undefined) updates.validated_by_gm  = validated_by_gm

  // INV2 (docs/EN_COURS.md) — un item ne peut porter validated_by_gm=false que s'il a été ajouté par
  // un joueur en campagne (addItem#chargeAtAdd exclut ce cas précisément parce qu'une validation MJ
  // suivra) : cette transition false→true est donc TOUJOURS la première fois qu'il est facturé,
  // jamais un double débit d'un item déjà payé à l'ajout (Coffre-native, GM) — ceux-là démarrent déjà
  // à true et ne retraversent jamais cette branche.
  let chargeOnValidate = 0
  if (validated_by_gm === true && existing.validated_by_gm === false) {
    const equipRefForPrice = existing.equipment_id
      ? await db('ref_equipment').where({ id: existing.equipment_id }).select('price').first()
      : null
    chargeOnValidate = (equipRefForPrice?.price ?? 0) * existing.quantity
  }

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
      // Équiper le Sac à dos/la Ceinture porte son propre poids (INV1) — même geste que l'armure/arme
      // ci-dessous, mais ici le contenant devient son propre bac (il ne va pas "dans" lui-même).
      updates.container = updates.slot === 'D' ? 'Sac' : 'Ceinture'
      skipContainerAvailabilityCheck = true
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
  } else if (updates.slot === null) {
    // Déséquipement — si l'item quittait un slot conteneur (D/Ce), le bac Sac/Ceinture qu'il
    // définissait se ferme (INV1) : tout ce qu'il contenait doit repartir au Coffre, jamais
    // silencieusement (même invariant que INV7 — le portage reste un geste explicite). Sans
    // confirmation, refus explicite plutôt qu'une relocalisation surprise.
    const existingSlotRows = await db('char_inventory_slots').where({ char_inventory_id: itemId }).select('slot_code')
    const existingSlotCodes = existingSlotRows.map(r => r.slot_code)
    const bucket = existingSlotCodes.includes('D') ? 'Sac' : existingSlotCodes.includes('Ce') ? 'Ceinture' : null
    if (bucket) {
      const itemsInBucket = await db('char_inventory')
        .where({ character_id: characterId, container: bucket })
        .whereNot('id', itemId)
      if (itemsInBucket.length > 0) {
        if (!confirmEmptyContainer) {
          throw new AppError(409, `${bucket} contient encore ${itemsInBucket.length} objet(s) — les renvoyer au Coffre pour déséquiper ?`)
        }
        cascadeToCoffre = { bucket, itemIds: itemsInBucket.map(i => i.id) }
      }
    }
  }

  // Validation container (si fourni explicitement et pas déjà forcé à 'Sac' par slot)
  if (updates.container !== undefined) {
    if (!VALID_CONTAINERS.includes(updates.container)) {
      throw new AppError(400, `container invalide : ${updates.container}`)
    }
    if (!skipContainerAvailabilityCheck && !(await isContainerAvailable(characterId, updates.container))) {
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
    if (chargeOnValidate > 0) await _chargeSols(trx, characterId, chargeOnValidate)
    await trx('char_inventory').where({ id: itemId }).update(updates)
    if (slotProvided) {
      await _writeSlots(trx, itemId, characterId, slotToWrite)
    }
    if (cascadeToCoffre) {
      await trx('char_inventory')
        .where({ character_id: characterId, container: cascadeToCoffre.bucket })
        .whereNot('id', itemId)
        .update({ container: 'Coffre', updated_at: db.fn.now() })
    }
  })
  const item = await getItemWithRef(itemId)
  // Diffusion des items déplacés en cascade : la route les broadcast individuellement (même event
  // INVENTORY_UPDATED, io.to inclut l'émetteur) — aucun changement de contrat pour les autres
  // appelants de updateItem, `item` reste la clé principale.
  const cascadedItems = cascadeToCoffre
    ? await Promise.all(cascadeToCoffre.itemIds.map(id => getItemWithRef(id)))
    : []
  return { item, cascadedItems }
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
