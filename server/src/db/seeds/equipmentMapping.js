/**
 * equipmentMapping.js — Transformation STEP1_cleaned_data.js → ligne ref_equipment
 *
 * Extrait de 2_seed_equipment.js (2026-08-08) pour être réutilisé par
 * generate-catalog-migration.js sans dupliquer la logique de mapping (core.md —
 * pas de logique métier dupliquée). Seule source de vérité sur "ce que le seed
 * produirait" pour une ligne du catalogue.
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const STEP1_PATH = resolve(
  __dirname,
  '../../../../docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js'
)

// ─── Constantes de validation ─────────────────────────────────────────────────

const NT_MAP     = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 }
const RARITY_RE  = /^-?\d+\s*\(-?\d+\)$/
const FIRE_MODES = new Set(['CC','RC','RL','CC/RC','CC/RL','RC/RL','CC/RC/RL','-'])
const MALUS_CATS = new Set(['S','A','B','C','D'])
const ATTRS      = new Set(['FOR','CON','COO','ADA','PER','INT','VOL','PRE'])
const WP_TRUE    = new Set(['oui','yes','true','1','on','étanche','pression'])
const WP_NULL    = new Set(['aucune','non','no','false','0','-'])

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parsePrice(raw) {
  if (!raw) return { price: null, price_modifier: null, err: null }
  const cleaned = raw.trim().replace(/\s/g, '')
  const n = parseInt(cleaned, 10)
  if (!isNaN(n) && String(n) === cleaned) return { price: n, price_modifier: null, err: null }
  const match = raw.match(/(\d+)/)
  if (match) {
    const price = parseInt(match[1], 10)
    const modifier = raw.slice(raw.indexOf(match[0]) + match[0].length).trim() || null
    return { price, price_modifier: modifier, err: null }
  }
  return { price: null, price_modifier: null, err: `prix sans valeur numérique : "${raw}"` }
}

function parseProtection(raw) {
  if (!raw) return { protection: null, protection_modifier: null, err: null }
  const n = parseInt(raw, 10)
  if (!isNaN(n)) return { protection: n, protection_modifier: null, err: null }
  if (/niv/i.test(raw)) return { protection: null, protection_modifier: raw.trim(), err: null }
  return { protection: null, protection_modifier: null, err: `protection non parseable : "${raw}"` }
}

function parseCapacity(raw) {
  if (!raw) return { capacity: null, err: null }
  const match = String(raw).replace(',', '.').match(/(\d+\.?\d*)/)
  if (match) return { capacity: parseFloat(match[1]), err: null }
  return { capacity: null, err: `contenance non parseable : "${raw}"` }
}

function parseWaterproof(raw) {
  if (!raw) return { waterproof: null, err: null }
  const lower = String(raw).toLowerCase().trim()
  if (WP_TRUE.has(lower)) return { waterproof: true, err: null }
  if (WP_NULL.has(lower)) return { waterproof: null, err: null }
  return { waterproof: null, err: `étanchéité inconnue : "${raw}"` }
}

function parseAmmoRaw(raw) {
  if (!raw) return { ammo_count: null, ammo_cost: null }
  const match = String(raw).match(/^(.+?)\s*\((.+?)\)$/)
  if (match) return { ammo_count: match[1].trim(), ammo_cost: match[2].trim() }
  return { ammo_count: String(raw).trim(), ammo_cost: null }
}

function parseLinkedAttr(raw) {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  return ATTRS.has(upper) ? upper : null
}

// ─── Validation + mapping ─────────────────────────────────────────────────────

export function validateAndMap(row) {
  const errors = []
  const name = row.base_name || '(sans nom)'

  if (!row.base_family)   errors.push({ field: 'base_family',   raw: null,          reason: 'NOT NULL requis' })
  if (!row.base_category) errors.push({ field: 'base_category', raw: null,          reason: 'NOT NULL requis' })
  if (!row.base_name)     errors.push({ field: 'base_name',     raw: null,          reason: 'NOT NULL requis' })

  let ntRaw = row.base_nt
  if (!ntRaw || ntRaw === 'null') ntRaw = null
  else if (ntRaw.includes(' à ')) ntRaw = ntRaw.split(' à ')[0].trim()
  const nt = ntRaw ? NT_MAP[ntRaw] : null
  const ntDefault = (nt === null)
  if (ntRaw && !nt) errors.push({ field: 'base_nt', raw: row.base_nt, reason: 'hors {I..VII}' })

  const rarity = row.base_rarity
  if (rarity && rarity !== 'Introuvable' && !RARITY_RE.test(rarity)) {
    errors.push({ field: 'base_rarity', raw: rarity, reason: 'format attendu XX(YY) ou "Introuvable"' })
  }

  if (row.off_fire_mode && !FIRE_MODES.has(row.off_fire_mode)) {
    errors.push({ field: 'off_fire_mode', raw: row.off_fire_mode, reason: 'hors liste 8 valeurs' })
  }
  if (row.def_malus_type && !MALUS_CATS.has(row.def_malus_type)) {
    errors.push({ field: 'def_malus_type', raw: row.def_malus_type, reason: 'hors {S,A,B,C,D}' })
  }

  const minStr = row.req_min_str != null ? parseInt(row.req_min_str, 10) : null
  if (row.req_min_str != null && (isNaN(minStr) || minStr < 3 || minStr > 20)) {
    errors.push({ field: 'req_min_str', raw: row.req_min_str, reason: 'entier hors [3–20]' })
  }

  const initMod = row.stat_init_mod != null ? parseInt(row.stat_init_mod, 10) : null
  if (row.stat_init_mod != null && (isNaN(initMod) || initMod >= 0)) {
    errors.push({ field: 'stat_init_mod', raw: row.stat_init_mod, reason: 'doit être < 0' })
  }

  const { price, price_modifier, err: priceErr } = parsePrice(row.base_price)
  if (priceErr) errors.push({ field: 'base_price', raw: row.base_price, reason: priceErr })

  const { protection, protection_modifier, err: protErr } = parseProtection(row.def_protection)
  if (protErr) errors.push({ field: 'def_protection', raw: row.def_protection, reason: protErr })

  const { capacity, err: capErr } = parseCapacity(row.stat_capacity)
  if (capErr) errors.push({ field: 'stat_capacity', raw: row.stat_capacity, reason: capErr })

  const { waterproof, err: wpErr } = parseWaterproof(row.stat_waterproof)
  if (wpErr) errors.push({ field: 'stat_waterproof', raw: row.stat_waterproof, reason: wpErr })

  const protShock = row.def_shock_mod != null ? parseInt(row.def_shock_mod, 10) : null
  if (row.def_shock_mod != null && isNaN(protShock)) {
    errors.push({ field: 'def_shock_mod', raw: row.def_shock_mod, reason: 'non parseable en entier' })
  }

  const maxLevel = row.req_max_level != null ? parseInt(row.req_max_level, 10) : null
  if (row.req_max_level != null && isNaN(maxLevel)) {
    errors.push({ field: 'req_max_level', raw: row.req_max_level, reason: 'non parseable en entier' })
  }

  const weight = row.base_weight != null ? parseFloat(String(row.base_weight).replace(',', '.')) : null
  if (row.base_weight != null && isNaN(weight)) {
    errors.push({ field: 'base_weight', raw: row.base_weight, reason: 'non parseable en float' })
  }

  if (errors.length > 0) return { name, errors, dbRow: null, ntDefault: false }

  const { ammo_count, ammo_cost } = parseAmmoRaw(row.off_ammo_raw)

  const dbRow = {
    family:               row.base_family,
    category:             row.base_category,
    name:                 row.base_name,
    description:          row.base_description     || null,
    price,
    price_modifier,
    weight,
    tech_level:           nt ?? 1,
    manufacturer:         row.base_manufacturer    || null,
    bonus:                row.stat_bonus_val        || null,
    max_level:            maxLevel,
    nation:               row.req_origin_nation    || null,
    damage_h:             row.off_damage_h         || null,
    damage_v_low:         row.off_damage_v_low     || null,
    damage_v_high:        row.off_damage_v_high    || null,
    shock:                row.off_shock            || null,
    range:                row.off_range            || null,
    min_str:              minStr,
    init_mod:             initMod,
    fire_mode:            row.off_fire_mode        || null,
    ammo_count,
    ammo_cost,
    caliber:              row.off_ammo_cal         || null,
    rarity:               rarity                   || '20(20)',
    linked_attr:          parseLinkedAttr(row.req_skill_req),
    protection,
    protection_modifier,
    protection_shock:     protShock,
    location:             row.def_locations        || null,
    malus_cat:            row.def_malus_type       || null,
    capacity,
    waterproof,
    ammo_effects:         row.mod_ammo_eff         || null,
  }

  return { name, errors: [], dbRow, ntDefault }
}

export function loadSourceRows() {
  const raw = fs.readFileSync(STEP1_PATH, 'utf8')
  const json = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1)
  return JSON.parse(json)
}
