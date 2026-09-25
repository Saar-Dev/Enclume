// client/src/lib/pnjHandEquipment.js — les armes EN MAIN d'un PNJ, dérivées de son inventaire (PLAN_PRISE_EN_MAIN.md, Lot C).
//
// La fenêtre de déclaration du MJ lisait ces armes dans `GET /battlemaps/:id/combat-equipment` : un instantané chargé UNE fois par
// carte, donc périmé dès qu'un PNJ change d'arme en cours de combat (une permutation résolue, une grenade lancée). Pour appliquer une
// permutation déclarée (`declaredSwap.applyDeclaredSwap`) il faut de toute façon l'inventaire complet du PNJ actif (Sac et Ceinture
// inclus) — déjà rechargé à chaque nouveau Tour. Les armes en main s'en DÉRIVENT donc : une seule source, toujours fraîche.
//
// Même forme que la route (`equipment[tokenId]`) pour que la fenêtre ne change pas ses lectures : `inv_id` (identifiant d'inventaire),
// `name` (nom du catalogue), `slot`. Même autorité de résolution que la route et que la fenêtre du joueur : `shared/weaponSlots.js`
// (`resolveHandWeapons` : un objet en main n'est une arme que s'il tire, blesse ou choque — un bouclier n'en est pas une).

import { flattenItemsBySlot, resolveHandWeapons } from '../../../shared/weaponSlots.js'

/**
 * @param {ReadonlyArray<object>} items  inventaire du PNJ (`GET /char-sheet/:id/inventory` → `items`), éventuellement projeté par
 *        `applyDeclaredSwap`
 * @returns {{ weapon: object|null, weaponMg: object|null, weaponMd: object|null, weapon2M: object|null, weaponTr: object|null }}
 *   `weapon` = l'arme principale (2M > Tr > MD > MG)
 */
export function pnjHandEquipment(items) {
  const rows = flattenItemsBySlot(items).map(row => ({ ...row, inv_id: row.id, name: row.ref_name }))
  const { weaponMg, weaponMd, weapon2M, weaponTr, primaryWeapon } = resolveHandWeapons(rows)
  return { weapon: primaryWeapon, weaponMg, weaponMd, weapon2M, weaponTr }
}
