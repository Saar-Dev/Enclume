// client/src/lib/grabList.js — les candidats de « Permuter » (extension ⇄ des fenêtres de déclaration de combat).
//
// Fonction PURE (testée) : à partir de l'inventaire complet du personnage, construit les lignes des objets qu'il peut
// PRENDRE EN MAIN — rangés dans le Sac ou la Ceinture, sans emplacement, tenables à la main. Mêmes règles que le serveur
// (shared/combatGrabItem.js : `isGrabbableRef`, `getGrabCost`) ; le serveur les re-vérifie à l'annonce
// (inventoryService.describeGrabCandidate), l'aperçu client n'est jamais l'autorité.
// Plan : docs/Old/PLAN_PRISE_EN_MAIN.md.
//
// Les objets équipables ne s'empilent jamais (chaque grenade est une ligne d'inventaire), donc on REGROUPE les
// exemplaires IDENTIQUES d'un même conteneur en une seule ligne « Grenade à fragmentation · Ceinture ×2 » ; choisir la
// ligne prend le premier exemplaire (`itemId`) — les exemplaires d'un groupe sont interchangeables PARCE QU'ILS SONT IDENTIQUES :
// même équipement, même conteneur, même ÉTAT (empreinte ci-dessous). Prendre « le premier » d'un groupe dont les exemplaires
// diffèrent (chargeur, type de munition chargé, usure, nom, mods) serait faux : le joueur croirait choisir SON arme. Toute arme à
// chargeur (calibre) reste donc UNE LIGNE PAR EXEMPLAIRE — le client ne voit pas tous les mods installés, dans le doute on
// ne regroupe pas.

import { GRAB_SOURCE_CONTAINERS, getGrabCost, isGrabbableRef } from '../../../shared/combatGrabItem.js'

// Empreinte d'état d'un exemplaire : tout ce que le client reçoit qui distingue deux exemplaires d'un même équipement. Une arme à
// calibre n'a pas d'empreinte partagée (identifiant propre).
function stateFingerprint(item) {
  if (item.ref_caliber) return `#${item.id}`
  return JSON.stringify([
    item.custom_name ?? null, item.custom_props ?? null, item.integrity_current ?? null, item.malfunction_severity ?? null,
    item.lunette_niveau ?? null, item.current_ammo ?? null, item.ammo_remaining ?? null,
  ])
}

/**
 * @typedef {object} GrabRow
 * @property {string} key           identifiant stable de la ligne (équipement + conteneur + état de l'exemplaire)
 * @property {string} name          nom affiché (personnalisé prioritaire sur le nom catalogue)
 * @property {'Ceinture'|'Sac'} container
 * @property {number} count         exemplaires rangés dans ce conteneur
 * @property {string} itemId        première ligne d'inventaire du groupe (`char_inventory.id`)
 * @property {number} iniCost       coût d'Initiative (Ceinture −3, Sac 0)
 * @property {boolean} occupiesAction  vrai = Action simple (Sac), exclusive avec tir / corps à corps / rechargement
 */

/**
 * @param {Array<object>} items  inventaire complet (`GET /char-sheet/:id/inventory` → `items`)
 * @returns {ReadonlyArray<GrabRow>}  Ceinture avant Sac, puis ordre alphabétique ; vide si rien à prendre
 */
export function buildGrabList(items) {
  const groups = new Map()
  for (const item of items ?? []) {
    if (!GRAB_SOURCE_CONTAINERS.includes(item.container)) continue
    if ((item.slots ?? []).length > 0) continue // équipé (en main, armure, contenant) : pas « rangé »
    if (!isGrabbableRef({ location: item.ref_location, category: item.ref_category })) continue
    const name = item.custom_name || item.ref_name || ''
    const key = `${item.equipment_id ?? name}|${item.container}|${stateFingerprint(item)}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += item.quantity ?? 1
      continue
    }
    const cost = getGrabCost(item.container)
    groups.set(key, {
      key, name, container: item.container, count: item.quantity ?? 1, itemId: item.id,
      iniCost: cost.iniCost, occupiesAction: cost.occupiesAction,
    })
  }
  const containerOrder = (row) => GRAB_SOURCE_CONTAINERS.indexOf(row.container)
  return Object.freeze(
    [...groups.values()]
      .sort((a, b) => containerOrder(a) - containerOrder(b) || a.name.localeCompare(b.name, 'fr'))
      .map(row => Object.freeze(row)),
  )
}

/**
 * Ligne actuellement choisie pour la déclaration, ou null (objet parti depuis : liste rechargée sans lui).
 * @param {ReadonlyArray<GrabRow>} rows
 * @param {string|null} grabItemId  identifiant d'objet choisi par le joueur
 */
export function findSelectedGrabRow(rows, grabItemId) {
  if (!grabItemId) return null
  return rows.find(row => row.itemId === grabItemId) ?? null
}
