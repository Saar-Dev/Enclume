// shared/itemSuggestions.js — suggestions d'objets à ajouter à l'inventaire d'un personnage.
//
// Fonction pure, sans accès base ni texte affiché : elle lit l'inventaire déjà chargé et le catalogue
// (`GET /equipment`) et rend des BESOINS ordonnés, chacun avec sa raison (clé de traduction + paramètres,
// jamais de texte français ici — rules/i18n.md) et quelques objets candidats du catalogue. Ce sont des
// propositions de confort : rien n'est ajouté sans le geste du joueur, et l'ajout passe par la route
// d'inventaire habituelle (le serveur reste l'autorité de tout ce qui est réellement possible).
//
// Règles (priorité décroissante ; 1 = le plus urgent) :
//  1. Arme en main dont le chargeur est vide, sans aucune munition utilisable en réserve       → munitions
//  2. Arme possédée sans aucune munition de son calibre nulle part                              → munitions
//  3. Munitions du calibre seulement au Coffre (non rechargeables en combat)                    → information
//     Sac équipé dont le contenu dépasse la capacité (kg)                                       → sacs plus grands
//  4. Aucun sac                                                                                 → sacs
//  5. Aucune ceinture                                                                           → ceintures
// « Arme » = objet de la famille Armes avec un calibre : couvre aussi les armes de contact à charges
// (matraque, gant choc…). Sans calibre (chalumeau…) ou sans aucune munition au catalogue (calibre
// « Spécial »), aucune suggestion : il n'existe rien à proposer.

import { ammoMatchesWeapon, weaponAmmoStatus } from './ammoRules.js'
import { computeTotalWeight } from './inventoryMath.js'

export const SUGGESTION_KIND = Object.freeze({ AMMO: 'ammo', AMMO_IN_STASH: 'ammoInStash', CONTAINER: 'container' })
export const SUGGESTION_LIMIT = 6
export const CANDIDATES_PER_SUGGESTION = 3

const AMMO_FAMILY = 'Munitions'
const WEAPON_FAMILY = 'Armes'
const CONTAINER_CATEGORY = 'Contenants portables'
const BAG_LOCATION = 'D'
const BELT_LOCATION = 'Ce'
const STASH = 'Coffre'
const BAG = 'Sac'

const nameOf = (item) => item.custom_name || item.ref_name || item.name || ''
const isStandardAmmo = (ref) => (ref.name || '').toLowerCase().includes('standard')

// Munition standard d'abord, puis prix croissant, puis nom (même préférence que WeaponPanel).
function compareAmmoCandidates(a, b) {
  const aStd = isStandardAmmo(a)
  const bStd = isStandardAmmo(b)
  if (aStd !== bStd) return aStd ? -1 : 1
  const byPrice = (a.price ?? Infinity) - (b.price ?? Infinity)
  return byPrice || (a.name || '').localeCompare(b.name || '', 'fr')
}

const byPriceThenName = (a, b) => ((a.price ?? Infinity) - (b.price ?? Infinity)) || (a.name || '').localeCompare(b.name || '', 'fr')

const isBagRef = (ref) => ref.category === CONTAINER_CATEGORY && ref.location === BAG_LOCATION && ref.capacity != null
const isBeltRef = (ref) => ref.category === CONTAINER_CATEGORY && ref.location === BELT_LOCATION

function ownedWeapons(inventory) {
  return inventory.filter(i => i.ref_family === WEAPON_FAMILY && i.ref_caliber)
}

// Munitions possédées pour un calibre : utilisables = hors Coffre et non équipées (même condition que
// le rechargement, CombatActionWindow / inventoryService#reloadWeapon).
function ammoOwnedFor(inventory, caliber) {
  const owned = inventory.filter(i => i.ref_family === AMMO_FAMILY && ammoMatchesWeapon(caliber, i.ref_caliber) && (i.quantity ?? 1) > 0)
  return {
    usable: owned.filter(i => i.container !== STASH && i.slots == null),
    stashed: owned.filter(i => i.container === STASH),
  }
}

function ammoSuggestions(inventory, catalog) {
  const byCaliber = new Map()
  for (const weapon of ownedWeapons(inventory)) {
    if (!byCaliber.has(weapon.ref_caliber)) byCaliber.set(weapon.ref_caliber, [])
    byCaliber.get(weapon.ref_caliber).push(weapon)
  }
  const suggestions = []
  for (const [caliber, weapons] of byCaliber) {
    const { usable, stashed } = ammoOwnedFor(inventory, caliber)
    if (usable.length > 0) continue
    const names = weapons.map(nameOf).join(', ')
    if (stashed.length > 0) {
      suggestions.push({
        id: `ammoInStash:${caliber}`, kind: SUGGESTION_KIND.AMMO_IN_STASH, priority: 3,
        reasonKey: 'inventoryPanel.suggestions.ammoInStash', reasonParams: { weapon: names, caliber }, candidates: [],
      })
      continue
    }
    const candidates = catalog
      .filter(ref => ref.family === AMMO_FAMILY && ammoMatchesWeapon(caliber, ref.caliber))
      .sort(compareAmmoCandidates)
      .slice(0, CANDIDATES_PER_SUGGESTION)
    if (candidates.length === 0) continue
    // « Vide » = même autorité que l'affichage de la fiche et du combat (weaponAmmoStatus, COM28).
    const emptyInHand = weapons.some(w => w.slots != null && weaponAmmoStatus(w.ammo_remaining, w.ref_ammo_count, w.ref_caliber) === 'empty')
    suggestions.push({
      id: `ammo:${caliber}`, kind: SUGGESTION_KIND.AMMO, priority: emptyInHand ? 1 : 2,
      reasonKey: emptyInHand ? 'inventoryPanel.suggestions.ammoEmptyInHand' : 'inventoryPanel.suggestions.ammoNone',
      reasonParams: { weapon: names, caliber }, candidates,
    })
  }
  return suggestions
}

function containerSuggestions(inventory, catalog) {
  const suggestions = []
  const bags = inventory.filter(i => i.ref_location === BAG_LOCATION && i.ref_capacity != null)
  const hasBelt = inventory.some(i => i.ref_location === BELT_LOCATION && i.ref_category === CONTAINER_CATEGORY)
  const bagRefs = catalog.filter(isBagRef)

  if (bags.length === 0) {
    const candidates = [...bagRefs].sort(byPriceThenName).slice(0, CANDIDATES_PER_SUGGESTION)
    if (candidates.length > 0) {
      suggestions.push({
        id: 'container:noBag', kind: SUGGESTION_KIND.CONTAINER, priority: 4,
        reasonKey: 'inventoryPanel.suggestions.noBag', reasonParams: {}, candidates,
      })
    }
  } else {
    const equipped = bags.find(b => b.slots?.includes(BAG_LOCATION))
    if (equipped) {
      const loadKg = computeTotalWeight(inventory.filter(i => i.container === BAG && i.slots == null))
      if (loadKg > equipped.ref_capacity) {
        const candidates = bagRefs
          .filter(ref => ref.capacity > equipped.ref_capacity)
          .sort((a, b) => (a.capacity - b.capacity) || byPriceThenName(a, b))
          .slice(0, CANDIDATES_PER_SUGGESTION)
        if (candidates.length > 0) {
          suggestions.push({
            id: 'container:bagFull', kind: SUGGESTION_KIND.CONTAINER, priority: 3,
            reasonKey: 'inventoryPanel.suggestions.bagFull',
            reasonParams: { load: Math.round(loadKg * 10) / 10, capacity: equipped.ref_capacity }, candidates,
          })
        }
      }
    }
  }

  if (!hasBelt) {
    const candidates = catalog.filter(isBeltRef).sort(byPriceThenName).slice(0, CANDIDATES_PER_SUGGESTION)
    if (candidates.length > 0) {
      suggestions.push({
        id: 'container:noBelt', kind: SUGGESTION_KIND.CONTAINER, priority: 5,
        reasonKey: 'inventoryPanel.suggestions.noBelt', reasonParams: {}, candidates,
      })
    }
  }
  return suggestions
}

/**
 * @param inventory lignes d'inventaire du personnage (forme de `useInventoryData` : ref_*, container, slots, quantity, ammo_remaining)
 * @param catalog   lignes du catalogue (`GET /equipment` : family, category, name, caliber, location, capacity, price)
 * @returns suggestions triées par priorité (au plus `SUGGESTION_LIMIT`) :
 *          `{ id, kind, priority, reasonKey, reasonParams, candidates: catalogRow[] }`
 */
export function buildInventorySuggestions({ inventory = [], catalog = [], limit = SUGGESTION_LIMIT } = {}) {
  if (catalog.length === 0) return []
  return [...ammoSuggestions(inventory, catalog), ...containerSuggestions(inventory, catalog)]
    .sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id))
    .slice(0, limit)
}
