import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

// ─── Marchands ────────────────────────────────────────────────────────────────

export async function getMerchants(campaignId, { isGm, userId }) {
  if (isGm) {
    return db('merchants').where({ campaign_id: campaignId }).orderBy('name')
  }

  // PJ : trouver tous ses character_id dans la campagne (via tokens)
  const chars = await db('characters')
    .join('tokens', 'tokens.character_id', 'characters.id')
    .where({ 'tokens.campaign_id': campaignId, 'characters.user_id': userId })
    .select('characters.id')
  const charIds = chars.map(c => c.id)

  if (charIds.length === 0) return []

  // OPEN + (liste vide = tous autorisés OU charId dans la liste)
  return db('merchants')
    .where({ campaign_id: campaignId, status: 'OPEN' })
    .where(function () {
      this.whereRaw('cardinality(allowed_char_ids) = 0')
      for (const id of charIds) {
        this.orWhereRaw('? = ANY(allowed_char_ids)', [id])
      }
    })
    .orderBy('name')
}

export async function upsertMerchant(campaignId, merchant) {
  const {
    id, name, status, mod_global, nt_max, niv_max, gen_max,
    dispo_min, rules, allowed_char_ids,
  } = merchant

  const data = {
    campaign_id: campaignId,
    name,
    status:      status      ?? 'CLOSED',
    mod_global:  mod_global  ?? 0,
    nt_max:      nt_max      ?? 6,
    niv_max:     niv_max     ?? 5,
    gen_max:     gen_max     ?? 5,
    dispo_min:   dispo_min   ?? null,
    rules:       JSON.stringify(rules || []),
    allowed_char_ids: allowed_char_ids || [],
    updated_at:  new Date(),
  }

  if (id) {
    await db('merchants')
      .where({ id, campaign_id: campaignId })
      .update(data)
    return db('merchants').where({ id }).first()
  }

  const [row] = await db('merchants')
    .insert({ ...data, created_at: new Date() })
    .returning('*')
  return row
}

export async function deleteMerchant(campaignId, merchantId) {
  const deleted = await db('merchants')
    .where({ id: merchantId, campaign_id: campaignId })
    .delete()
  if (!deleted) throw new AppError(404, 'Marchand introuvable')
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

function passesGlobalThresholds(item, merchant) {
  if (merchant.nt_max != null && item.tech_level > merchant.nt_max) return false
  if (merchant.niv_max != null && item.max_level != null && item.max_level > merchant.niv_max) return false
  if (merchant.gen_max != null && item.generation != null && item.generation > merchant.gen_max) return false
  const rarityVal = parseInt(item.rarity, 10)
  if (!isNaN(rarityVal) && merchant.dispo_min != null && rarityVal < merchant.dispo_min) return false
  return true
}

function passesLocalThresholds(item, rule) {
  if (rule.nt_max != null && item.tech_level > rule.nt_max) return false
  if (rule.gen_max != null && item.generation != null && item.generation > rule.gen_max) return false
  const rarityVal = parseInt(item.rarity, 10)
  if (!isNaN(rarityVal) && rule.dispo_min != null && rarityVal < rule.dispo_min) return false
  return true
}

function evaluateItem(item, merchant, rules) {
  let visible = passesGlobalThresholds(item, merchant)
  let modPct = 0

  // Cascade FAM → CAT → ITEM — le plus spécifique l'emporte
  const famRule  = rules.find(r => r.level === 'FAM'  && r.fam === item.family)
  const catRule  = rules.find(r => r.level === 'CAT'  && r.fam === item.family && r.cat === item.category)
  const itemRule = rules.find(r => r.level === 'ITEM' && r.name === item.name)

  for (const rule of [famRule, catRule, itemRule]) {
    if (!rule) continue
    if (rule.mode === 'INCLUDE') {
      visible = true
    } else if (rule.mode === 'EXCLUDE') {
      visible = false
    } else if (rule.mode === 'PARAM') {
      if (rule.mod_pct != null) modPct = rule.mod_pct
      if (!passesLocalThresholds(item, rule)) visible = false
    }
  }

  return { visible, modPct }
}

export async function getCatalog(campaignId, merchantId, { isGm, charId } = {}) {
  const merchant = await db('merchants').where({ id: merchantId, campaign_id: campaignId }).first()
  if (!merchant) throw new AppError(404, 'Marchand introuvable')

  if (!isGm) {
    if (merchant.status !== 'OPEN') throw new AppError(403, 'Marchand fermé')
    // Vérifier que le PJ est autorisé (cardinality=0 = tous autorisés)
    if (charId && merchant.allowed_char_ids && merchant.allowed_char_ids.length > 0) {
      if (!merchant.allowed_char_ids.includes(charId)) throw new AppError(403, 'Accès refusé à ce marchand')
    }
  }

  const items = await db('ref_equipment').select('*')
  const rules = Array.isArray(merchant.rules) ? merchant.rules : JSON.parse(merchant.rules || '[]')
  const modGlobal = merchant.mod_global ?? 0

  const catalog = []
  for (const item of items) {
    const { visible, modPct } = evaluateItem(item, merchant, rules)
    if (!visible) continue
    const basePrice = item.price ?? 0
    const totalMod = modGlobal + modPct
    catalog.push({
      ...item,
      catalog_price: Math.round(basePrice * (1 + totalMod / 100)),
    })
  }

  return catalog
}

// ─── Achat marchand — transaction atomique ───────────────────────────────────

export async function buyFromMerchant(campaignId, { merchantId, charId, items = [] }) {
  if (!items.length) throw new AppError(400, 'Aucun article sélectionné')

  let soldItems, totalPrice, logEntry

  await db.transaction(async (trx) => {
    // 1. Lock marchand — vérif OPEN
    const merchant = await trx('merchants')
      .where({ id: merchantId, campaign_id: campaignId })
      .forUpdate()
      .first()
    if (!merchant) throw new Error('MERCHANT_NOT_FOUND')
    if (merchant.status !== 'OPEN') throw new Error('MERCHANT_CLOSED')

    // 2. Fetch équipements demandés + calcul prix (même logique que getCatalog)
    const equipmentIds = [...new Set(items.map(i => i.equipmentId))]
    const equipmentRows = await trx('ref_equipment')
      .whereIn('id', equipmentIds)
      .select('id', 'price', 'name', 'family', 'category', 'tech_level', 'max_level', 'generation', 'rarity')

    const rules = Array.isArray(merchant.rules) ? merchant.rules : JSON.parse(merchant.rules || '[]')
    const modGlobal = merchant.mod_global ?? 0

    const priceMap = {}
    for (const eq of equipmentRows) {
      const { visible, modPct } = evaluateItem(eq, merchant, rules)
      if (!visible) throw new Error('ITEM_UNAVAILABLE')
      priceMap[eq.id] = Math.round((eq.price ?? 0) * (1 + (modGlobal + modPct) / 100))
    }

    // 3. Total + snapshot pour trade_log
    let total = 0
    const itemDetails = []
    for (const { equipmentId, qty = 1 } of items) {
      const eq = equipmentRows.find(e => e.id === equipmentId)
      if (!eq) throw new Error('ITEM_UNAVAILABLE')
      const unitPrice = priceMap[equipmentId]
      total += unitPrice * qty
      itemDetails.push({ equipment_id: equipmentId, name: eq.name, qty, unit_price: unitPrice })
    }

    // 4. Lock char_sheet — vérif sols
    const charSheet = await trx('char_sheet').where({ character_id: charId }).forUpdate().first()
    if (!charSheet) throw new Error('CHAR_NOT_FOUND')
    if (charSheet.sols < total) throw new Error('INSUFFICIENT_FUNDS')

    // 5. Débit sols
    await trx('char_sheet').where({ character_id: charId }).decrement('sols', total)

    // 6. INSERT char_inventory — un INSERT par ligne de panier
    for (const { equipmentId, qty = 1 } of items) {
      await trx('char_inventory').insert({
        character_id: charId,
        equipment_id: equipmentId,
        quantity:     qty,
        container:    'Coffre',
        slot:         null,
        created_at:   new Date(),
        updated_at:   new Date(),
      })
    }

    // 7. INSERT trade_log
    const [entry] = await trx('trade_log').insert({
      campaign_id:  campaignId,
      type:         'merchant_buy',
      to_char_id:   charId,
      merchant_id:  merchantId,
      sols_delta:   -total,
      items_json:   JSON.stringify(itemDetails),
      created_at:   new Date(),
    }).returning('*')

    logEntry  = entry
    soldItems = itemDetails
    totalPrice = total
  })

  return { soldItems, totalPrice, logEntry }
}

// ─── Échange PJ↔PJ — transaction atomique ────────────────────────────────────

export async function acceptTransfer(campaignId, { offerId, acceptingCharId }) {
  let logEntry
  await db.transaction(async (trx) => {
    const offer = await trx('trade_offers')
      .where({ id: offerId, campaign_id: campaignId, to_char_id: acceptingCharId, status: 'PENDING' })
      .forUpdate()
      .first()
    if (!offer) throw new Error('OFFER_NOT_FOUND')
    if (new Date(offer.expires_at) < new Date()) throw new Error('OFFER_EXPIRED')

    const fromSheet = await trx('char_sheet')
      .where({ character_id: offer.from_char_id })
      .forUpdate()
      .first()
    if (fromSheet.sols < offer.sols_offer) throw new Error('INSUFFICIENT_FUNDS')

    for (const item of offer.items_json) {
      const inv = await trx('char_inventory')
        .where({ id: item.char_inventory_id, character_id: offer.from_char_id })
        .forUpdate()
        .first()
      if (!inv) throw new Error('ITEM_UNAVAILABLE')
    }

    if (offer.sols_offer > 0) {
      await trx('char_sheet').where({ character_id: offer.from_char_id }).decrement('sols', offer.sols_offer)
      await trx('char_sheet').where({ character_id: offer.to_char_id }).increment('sols', offer.sols_offer)
    }

    for (const item of offer.items_json) {
      await trx('char_inventory').where({ id: item.char_inventory_id }).update({
        character_id: offer.to_char_id,
        container:    'Coffre',
        slot:         null,
      })
    }

    await trx('trade_offers').where({ id: offerId }).update({ status: 'ACCEPTED', updated_at: trx.fn.now() })
    const [entry] = await trx('trade_log').insert({
      campaign_id:  campaignId,
      type:         'player_transfer',
      from_char_id: offer.from_char_id,
      to_char_id:   offer.to_char_id,
      sols_delta:   offer.sols_offer,
      items_json:   JSON.stringify(offer.items_json),
      created_at:   new Date(),
    }).returning('*')
    logEntry = entry
  })
  return logEntry
}

// ─── Livre de compte ─────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export async function getTradeLog(campaignId, { page = 1, type } = {}) {
  const offset = (page - 1) * PAGE_SIZE
  let q = db('trade_log')
    .where({ campaign_id: campaignId })
    .orderBy('created_at', 'desc')
    .limit(PAGE_SIZE)
    .offset(offset)

  if (type) q = q.where({ type })

  const rows = await q
  const [{ count }] = await db('trade_log')
    .where({ campaign_id: campaignId })
    .modify(qb => { if (type) qb.where({ type }) })
    .count('id as count')

  return { rows, total: Number(count), page, pageSize: PAGE_SIZE }
}
