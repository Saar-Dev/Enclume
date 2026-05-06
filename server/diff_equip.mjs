import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import db from './src/db/knex.js'

// === Parsers — copie exacte du seed 2_seed_equipment.js ===

const NT_MAP  = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 }
const ATTRS   = new Set(['FOR','CON','COO','ADA','PER','INT','VOL','PRE'])
const WP_TRUE = new Set(['oui','yes','true','1','on','étanche','pression'])
const WP_NULL = new Set(['aucune','non','no','false','0','-'])

function parsePrice(raw) {
  if (!raw) return { price: null, price_modifier: null }
  const cleaned = raw.trim().replace(/\s/g, '')
  const n = parseInt(cleaned, 10)
  if (!isNaN(n) && String(n) === cleaned) return { price: n, price_modifier: null }
  const match = raw.match(/(\d+)/)
  if (match) {
    const price = parseInt(match[1], 10)
    const modifier = raw.slice(raw.indexOf(match[0]) + match[0].length).trim() || null
    return { price, price_modifier: modifier }
  }
  return { price: null, price_modifier: null }
}

function parseProtection(raw) {
  if (!raw) return { protection: null, protection_modifier: null }
  const n = parseInt(raw, 10)
  if (!isNaN(n)) return { protection: n, protection_modifier: null }
  if (/niv/i.test(raw)) return { protection: null, protection_modifier: raw.trim() }
  return { protection: null, protection_modifier: null }
}

function parseCapacity(raw) {
  if (!raw) return null
  const match = String(raw).replace(',', '.').match(/(\d+\.?\d*)/)
  return match ? parseFloat(match[1]) : null
}

function parseWaterproof(raw) {
  if (!raw) return null
  const lower = String(raw).toLowerCase().trim()
  if (WP_TRUE.has(lower)) return true
  if (WP_NULL.has(lower)) return null
  return null
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

function parseNT(row) {
  let ntRaw = row.base_nt
  if (!ntRaw || ntRaw === 'null') ntRaw = null
  else if (ntRaw.includes(' à ')) ntRaw = ntRaw.split(' à ')[0].trim()
  const nt = ntRaw ? NT_MAP[ntRaw] : null
  return nt ?? 1
}

function toExpected(row) {
  const { price, price_modifier } = parsePrice(row.base_price)
  const { protection, protection_modifier } = parseProtection(row.def_protection)
  const capacity  = parseCapacity(row.stat_capacity)
  const waterproof = parseWaterproof(row.stat_waterproof)
  const { ammo_count, ammo_cost } = parseAmmoRaw(row.off_ammo_raw)
  const protShock = row.def_shock_mod != null ? parseInt(row.def_shock_mod, 10) : null
  const maxLevel  = row.req_max_level != null ? parseInt(row.req_max_level, 10) : null
  const weight    = row.base_weight   != null ? parseFloat(String(row.base_weight).replace(',', '.')) : null
  const minStr    = row.req_min_str   != null ? parseInt(row.req_min_str, 10) : null
  const initMod   = row.stat_init_mod != null ? parseInt(row.stat_init_mod, 10) : null

  return {
    family:              row.base_family,
    category:            row.base_category,
    description:         row.base_description  || null,
    price,
    price_modifier,
    weight:              isNaN(weight)    ? null : weight,
    tech_level:          parseNT(row),
    manufacturer:        row.base_manufacturer || null,
    bonus:               row.stat_bonus_val    || null,
    max_level:           isNaN(maxLevel)  ? null : maxLevel,
    nation:              row.req_origin_nation || null,
    damage_h:            row.off_damage_h      || null,
    damage_v_low:        row.off_damage_v_low  || null,
    damage_v_high:       row.off_damage_v_high || null,
    shock:               row.off_shock         || null,
    range:               row.off_range         || null,
    min_str:             isNaN(minStr)    ? null : minStr,
    init_mod:            isNaN(initMod)   ? null : initMod,
    fire_mode:           row.off_fire_mode     || null,
    ammo_count,
    ammo_cost,
    caliber:             row.off_ammo_cal      || null,
    rarity:              row.base_rarity       || '20(20)',
    linked_attr:         parseLinkedAttr(row.req_skill_req),
    protection,
    protection_modifier,
    protection_shock:    isNaN(protShock) ? null : protShock,
    location:            row.def_locations     || null,
    malus_cat:           row.def_malus_type    || null,
    capacity:            isNaN(capacity)  ? null : capacity,
    waterproof,
    ammo_effects:        row.mod_ammo_eff      || null,
  }
}

// Normalisation pour comparaison
function norm(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v
  return String(v).trim()
}

function eq(field, exp, actual) {
  if (field === 'weight' || field === 'capacity') {
    if (exp === null && actual === null) return true
    if (exp === null || actual === null) return false
    return Math.abs(Number(exp) - Number(actual)) < 0.001
  }
  return norm(exp) === norm(actual)
}

const FIELDS = [
  'family','category','description','price','price_modifier','weight',
  'tech_level','manufacturer','bonus','max_level','nation',
  'damage_h','damage_v_low','damage_v_high','shock','range',
  'min_str','init_mod','fire_mode','ammo_count','ammo_cost','caliber',
  'rarity','linked_attr','protection','protection_modifier','protection_shock',
  'location','malus_cat','capacity','waterproof','ammo_effects',
]

async function main() {
  const STEP1_PATH = resolve(__dirname, '../docs/Character/script Extraction Excel/equipement/STEP1_cleaned_data.js')
  const raw = fs.readFileSync(STEP1_PATH, 'utf8')
  const json = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1)
  const source = JSON.parse(json)

  // Premier exemplaire de chaque nom (ignore les doublons STEP1)
  const step1ByName = new Map()
  source.forEach(r => { if (!step1ByName.has(r.base_name)) step1ByName.set(r.base_name, r) })

  const dbItems = await db('ref_equipment').select('*').orderBy('family').orderBy('category').orderBy('name')

  const byCategory = {}
  let exactMatch = 0
  let diffCount  = 0
  const noStep1  = []

  for (const dbItem of dbItems) {
    const step1Row = step1ByName.get(dbItem.name)
    if (!step1Row) { noStep1.push(dbItem.name); continue }

    const expected = toExpected(step1Row)
    const diffs = FIELDS.filter(f => !eq(f, expected[f], dbItem[f]))
      .map(f => ({ field: f, exp: expected[f], db: dbItem[f] }))

    if (diffs.length === 0) {
      exactMatch++
    } else {
      diffCount++
      const key = dbItem.family + ' / ' + dbItem.category
      if (!byCategory[key]) byCategory[key] = []
      byCategory[key].push({ name: dbItem.name, diffs })
    }
  }

  // ── Résumé ────────────────────────────────────────────────────────────────────
  console.log('=== RÉSUMÉ ===')
  console.log('  Total BDD     : ' + dbItems.length)
  console.log('  Match exact   : ' + exactMatch)
  console.log('  Divergences   : ' + diffCount)
  console.log('  Hors STEP1    : ' + noStep1.length)
  if (noStep1.length) console.log('    → ' + noStep1.join(', '))
  console.log()

  // ── Rapport par catégorie ─────────────────────────────────────────────────────
  for (const cat of Object.keys(byCategory).sort()) {
    const items = byCategory[cat]
    console.log('=== ' + cat + ' (' + items.length + ' item' + (items.length > 1 ? 's' : '') + ') ===')
    for (const { name, diffs } of items) {
      console.log('  [' + name + ']')
      for (const d of diffs) {
        console.log('    ' + d.field.padEnd(22) + 'attendu=' + JSON.stringify(d.exp) + '  →  BDD=' + JSON.stringify(d.db))
      }
    }
    console.log()
  }

  await db.destroy()
}

main().catch(e => { console.error(e); process.exit(1) })
