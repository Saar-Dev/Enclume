// client/src/lib/weaponList.js
//
// Liste d'armes groupée Distance / Contact des fenêtres de déclaration de combat
// (PLAN_RW_DECLARE_DESIGN module 4a — D5 « l'arme EST l'action », D6 deux colonnes).
//
// Fonction pure, testable `node --test`, SANS dépendance i18n : elle renvoie des données
// structurées (mode de tir brut, allonge, raison de grisage sous forme de clé) ; le JSX compose
// les libellés affichés avec `t()`. L'autorité des slots reste `shared/weaponSlots.js` — l'appelant
// fournit des tableaux déjà filtrés, `buildWeaponList` ne fait que grouper / normaliser / trier.
//
// « Mains nues » est une ligne permanente du groupe Contact (jamais un item d'inventaire). Une arme
// mixte (tir + contact) apparaît dans les DEUX groupes (RAW — tableau de localisation, colonnes
// Distance ET Contact). Le grisage transverse (blessure mortelle, assommé) grise toute la liste ;
// une arme à feu vide est grisée dans le seul groupe Distance.

import { parseAmmoCapacity, weaponAmmoStatus } from '../../../shared/ammoRules.js'

const HAND_SLOTS = ['MG', 'MD', '2M', 'Tr']

/**
 * @typedef {Object} WeaponRow
 * @property {string}  id               id d'inventaire, `nat:<id>` (arme naturelle) ou `'bare'`
 * @property {'ranged'|'melee'|'natural'|'bare'} kind
 * @property {'distance'|'contact'} group
 * @property {string|null} name         `custom_name || ref_name` ; null pour mains nues (libellé i18n côté JSX)
 * @property {string|null} slotLabel    'MG' | 'MD' | '2M' | 'Tr' | null
 * @property {string|null} fireMode     ref_fire_mode brut, ex. "CC/RC" (groupe Distance)
 * @property {number|null} reachM       allonge en mètres (groupe Contact, arme d'inventaire)
 * @property {string|null} damage       ref_damage_h (arme de contact)
 * @property {string|null} formula      natural_weapon_formula (arme naturelle)
 * @property {boolean} requiresGrapple  arme naturelle nécessitant la cible agrippée
 * @property {string|null} ammoLabel    "24 / 24" | null (arme non trackée)
 * @property {'ok'|'low'|'empty'|null} ammoStatus
 * @property {boolean} mixed            arme présente dans les deux groupes
 * @property {boolean} permanent        ligne toujours présente (mains nues)
 * @property {boolean} disabled
 * @property {'mortallyWounded'|'stunned'|'ammoEmpty'|null} disabledReason
 */

// PJ (inventaire /char-sheet) porte `custom_name`/`ref_name` ; MJ (batch /combat-equipment) porte
// un `name` déjà résolu. Les deux formes alimentent buildWeaponList.
function displayName(item) {
  return item.custom_name || item.ref_name || item.name || null
}

function slotOf(item) {
  if (item.slot && HAND_SLOTS.includes(item.slot)) return item.slot
  return (item.slots ?? []).find(s => HAND_SLOTS.includes(s)) ?? null
}

function ammoLabel(item) {
  if (!weaponAmmoStatus(item.ammo_remaining, item.ref_ammo_count, item.ref_caliber)) return null
  const capacity = parseAmmoCapacity(item.ref_ammo_count)
  return `${item.ammo_remaining ?? 0} / ${capacity}`
}

/**
 * @param {Object}   p
 * @param {object[]} [p.rangedWeapons=[]]   slotRows d'armes à feu (ref_fire_mode truthy)
 * @param {object[]} [p.meleeWeapons=[]]    items d'armes de contact (ref_category === 'Arme de contact')
 * @param {object[]} [p.naturalWeapons=[]]  mutations { id, name, natural_weapon_formula, natural_weapon_requires_grapple }
 * @param {boolean}  [p.includeBareHands=true]
 * @param {'mortallyWounded'|'stunned'|null} [p.blanketDisable=null]
 * @returns {{ distance: WeaponRow[], contact: WeaponRow[] }}
 */
export function buildWeaponList({
  rangedWeapons = [],
  meleeWeapons = [],
  naturalWeapons = [],
  includeBareHands = true,
  blanketDisable = null,
} = {}) {
  const rangedIds = new Set(rangedWeapons.map(w => w.id))
  const meleeIds = new Set(meleeWeapons.map(w => w.id))

  // ── Distance ──────────────────────────────────────────────────────────────
  const distance = []
  const seenDistance = new Set()
  for (const w of rangedWeapons) {
    if (seenDistance.has(w.id)) continue
    seenDistance.add(w.id)
    const status = weaponAmmoStatus(w.ammo_remaining, w.ref_ammo_count, w.ref_caliber)
    distance.push({
      id: w.id,
      kind: 'ranged',
      group: 'distance',
      name: displayName(w),
      slotLabel: slotOf(w),
      fireMode: w.ref_fire_mode ?? null,
      reachM: null,
      damage: w.ref_damage_h ?? null,
      formula: null,
      requiresGrapple: false,
      ammoLabel: ammoLabel(w),
      ammoStatus: status,
      mixed: meleeIds.has(w.id),
      permanent: false,
      disabled: blanketDisable != null || status === 'empty',
      disabledReason: blanketDisable ?? (status === 'empty' ? 'ammoEmpty' : null),
    })
  }

  // ── Contact ───────────────────────────────────────────────────────────────
  const contact = []
  const seenContact = new Set()
  for (const w of meleeWeapons) {
    if (seenContact.has(w.id)) continue
    seenContact.add(w.id)
    const reach = parseInt(w.ref_range, 10)
    contact.push({
      id: w.id,
      kind: 'melee',
      group: 'contact',
      name: displayName(w),
      slotLabel: slotOf(w),
      fireMode: null,
      reachM: Number.isFinite(reach) ? reach : 0,
      damage: w.ref_damage_h ?? null,
      formula: null,
      requiresGrapple: false,
      ammoLabel: null,
      ammoStatus: null,
      mixed: rangedIds.has(w.id),
      permanent: false,
      disabled: blanketDisable != null,
      disabledReason: blanketDisable,
    })
  }

  if (includeBareHands) {
    contact.push({
      id: 'bare',
      kind: 'bare',
      group: 'contact',
      name: null,
      slotLabel: null,
      fireMode: null,
      reachM: 0,
      damage: null,
      formula: null,
      requiresGrapple: false,
      ammoLabel: null,
      ammoStatus: null,
      mixed: false,
      permanent: true,
      disabled: blanketDisable != null,
      disabledReason: blanketDisable,
    })
  }

  for (const m of naturalWeapons) {
    contact.push({
      id: `nat:${m.id}`,
      kind: 'natural',
      group: 'contact',
      name: m.name || null,
      slotLabel: null,
      fireMode: null,
      reachM: 0,
      damage: null,
      formula: m.natural_weapon_formula ?? null,
      requiresGrapple: Boolean(m.natural_weapon_requires_grapple),
      ammoLabel: null,
      ammoStatus: null,
      mixed: false,
      permanent: false,
      disabled: blanketDisable != null,
      disabledReason: blanketDisable,
    })
  }

  return { distance, contact }
}
