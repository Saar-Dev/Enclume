// modingService.js
// docs/PLAN_MODING.md Phase A — installation d'un module d'arme (accessoire) depuis l'inventaire
// sur une arme. Rangement pur : aucun effet mécanique de jeu (Phase B, hors scope).
// Convention advantageService.js/mutationService.js/inventoryService.js : fonctions pures DB,
// pas de req/res/socket — les routes char-sheet.js restent minces.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { WEAPON_FAMILY, MOD_CATEGORY, removeItem } from './inventoryService.js'

// GET .../moding/state — armes du personnage (avec mods installés) + mods installables.
export async function getModingState(characterId, trxOrDb = db) {
  const q = trxOrDb

  const weaponsRaw = await q.raw(`
    SELECT ci.id, ci.equipment_id, re.name, re.family, re.category,
           COALESCE(
             json_agg(cim ORDER BY cim.installed_at) FILTER (WHERE cim.id IS NOT NULL),
             '[]'
           ) AS installed_mods
    FROM char_inventory ci
    JOIN ref_equipment re ON re.id = ci.equipment_id
    LEFT JOIN char_inventory_mods cim ON cim.weapon_inv_id = ci.id
    WHERE ci.character_id = ?
      AND re.family = ?
      AND re.category != ?
    GROUP BY ci.id, ci.equipment_id, re.name, re.family, re.category
  `, [characterId, WEAPON_FAMILY, MOD_CATEGORY])

  const installableMods = await q('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.character_id': characterId })
    .where({ 'ref_equipment.family': WEAPON_FAMILY, 'ref_equipment.category': MOD_CATEGORY })
    .select('char_inventory.id', 'char_inventory.equipment_id', 'ref_equipment.name', 'ref_equipment.category')

  return { weapons: weaponsRaw.rows, installableMods }
}

// Retourne un mod swappé (remplacé par un nouveau du même slot) en inventaire — même logique de
// stacking que addItem (P57 : aucun de ces accessoires n'est équipable, ref_equipment.location
// toujours NULL pour cette catégorie, vérifié en base réelle 2026-07-12). Container Coffre :
// toujours disponible (isContainerAvailable), pas de dépendance à un Sac déjà équipé.
async function returnModToInventory(characterId, equipmentId, trx) {
  // Lot C (docs/PLAN_INVENTORY_SLOTS.md) : char_inventory.slot retiré — ces accessoires ne sont
  // jamais équipables (aucune ligne char_inventory_slots possible pour eux), whereNotExists remplace
  // whereNull('slot').
  const existing = await trx('char_inventory')
    .where({ character_id: characterId, equipment_id: equipmentId, container: 'Coffre' })
    .whereNotExists(function () {
      this.select(1).from('char_inventory_slots').whereRaw('char_inventory_id = char_inventory.id')
    })
    .first()
  if (existing) {
    await trx('char_inventory').where({ id: existing.id })
      .update({ quantity: existing.quantity + 1, updated_at: trx.fn.now() })
  } else {
    await trx('char_inventory').insert({
      character_id: characterId, equipment_id: equipmentId, container: 'Coffre', quantity: 1,
    })
  }
}

// Groupe 1 (docs/PLAN_MODING_PHASEB.md) — bonus fixe au Test de tir. L'exclusivité de slot étant
// garantie à l'installation (au plus un item mod_slot='optique' actif par arme), pas de "grouper
// puis prendre le max" : il n'y a jamais qu'un seul candidat à examiner. `installedMods` = lignes
// char_inventory_mods jointes à ref_equipment (name, bonus, mod_slot, mod_requires_aim) pour une
// arme donnée — voir resolveAssaultAction.
export function calcWeaponModBonus(installedMods) {
  const optic = installedMods.find(m => m.mod_slot === 'optique')
  if (!optic || optic.mod_requires_aim || optic.bonus == null) return { total: 0, breakdown: [] }
  const value = Number(optic.bonus)
  if (!Number.isInteger(value)) return { total: 0, breakdown: [] } // ex. "niv" (Lunette générique)
  return { total: value, breakdown: [{ name: optic.name, value }] }
}

// POST .../moding/install — body { weaponInvId, modInvId }
// Retourne { removeResult, state, swappedOut } — la route dérive le payload MOD_INSTALLED de
// `state` et émet INVENTORY_REMOVED/UPDATED selon `removeResult.deleted` (même pattern que le
// DELETE inventaire). `swappedOut` (docs/PLAN_MODING_PHASEB.md — architecture des slots) : mod
// remplacé automatiquement s'il occupait déjà le même slot exclusif sur cette arme, sinon null —
// déjà reflété dans `state.installableMods` (retourné en inventaire dans la même transaction),
// aucun event socket dédié nécessaire (MOD_INSTALLED déclenche déjà un refetch complet côté client).
export async function installMod(characterId, weaponInvId, modInvId) {
  const weapon = await db('char_inventory').where({ id: weaponInvId, character_id: characterId }).first()
  const mod    = await db('char_inventory').where({ id: modInvId,    character_id: characterId }).first()

  if (!weapon || !mod) throw new AppError(404, 'Item introuvable')
  // P1 : item custom (sans equipment_id) — non modable, ni comme cible ni comme mod
  if (!weapon.equipment_id || !mod.equipment_id) {
    throw new AppError(400, 'Item custom sans référentiel — non modable')
  }

  const weaponRef = await db('ref_equipment').where({ id: weapon.equipment_id }).first()
  const modRef    = await db('ref_equipment').where({ id: mod.equipment_id }).first()

  if (weaponRef.family !== WEAPON_FAMILY || weaponRef.category === MOD_CATEGORY) {
    throw new AppError(400, 'La cible n\'est pas une arme valide')
  }
  if (modRef.family !== WEAPON_FAMILY || modRef.category !== MOD_CATEGORY) {
    throw new AppError(400, 'L\'objet n\'est pas un accessoire d\'arme')
  }

  // Anti-doublon — check applicatif en pré-vol (évite un aller-retour DB raté dans le cas
  // normal), PAS la vraie garde : voir contrainte UNIQUE(weapon_inv_id, equipment_id) sur
  // char_inventory_mods (migration 137) qui protège la vraie fenêtre de course (P6, analyse
  // critique 2026-07-12 — un mod en stack ×2+ peut faire passer deux requêtes concurrentes par
  // ce SELECT avant que la première n'ait commité).
  const alreadyInstalled = await db('char_inventory_mods')
    .where({ weapon_inv_id: weaponInvId, equipment_id: mod.equipment_id }).first()
  if (alreadyInstalled) throw new AppError(409, 'Ce mod est déjà installé sur cette arme')

  try {
    return await db.transaction(async (trx) => {
      // Exclusivité de slot (docs/PLAN_MODING_PHASEB.md) — au plus un item actif par mod_slot sur
      // une arme donnée. Installer un 2ᵉ item du même slot remplace automatiquement l'ancien (retour
      // en inventaire), même transaction. La contrainte UNIQUE(weapon_inv_id, mod_slot) reste la
      // vraie garde contre la course (catch 23505 ci-dessous) ; ce check est l'optimisation du cas
      // normal, pas la protection elle-même.
      let swappedOut = null
      if (modRef.mod_slot) {
        const occupant = await trx('char_inventory_mods')
          .where({ weapon_inv_id: weaponInvId, mod_slot: modRef.mod_slot })
          .first()
        if (occupant) {
          if (occupant.equipment_id) {
            await returnModToInventory(characterId, occupant.equipment_id, trx)
          } else {
            console.warn(`[moding] swap — occupant ${occupant.id} sans equipment_id (catalogue supprimé), perte propre sans retour inventaire`)
          }
          await trx('char_inventory_mods').where({ id: occupant.id }).del()
          swappedOut = occupant
        }
      }

      await trx('char_inventory_mods').insert({
        weapon_inv_id: weaponInvId,
        equipment_id:  mod.equipment_id,
        mod_name:      modRef.name,
        mod_slot:      modRef.mod_slot ?? null,
      })
      // Consomme 1 unité du mod — jamais un DELETE inconditionnel (P7 : mod.quantity peut être
      // > 1 si stack). removeItem décrémente, ne supprime la ligne que si le stock atteint 0.
      const removeResult = await removeItem(characterId, modInvId, 1, trx)
      const state = await getModingState(characterId, trx)
      return { removeResult, state, swappedOut }
    })
  } catch (err) {
    if (err.code === '23505') { // unique_violation — course gagnée par une autre requête
      throw new AppError(409, 'Ce mod est déjà installé sur cette arme')
    }
    throw err
  }
}
