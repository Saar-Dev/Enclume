import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import getMinioClient, { BUCKET } from '../../lib/minio.js'

const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_2_PACK_ID = 'a979c5be-6ebf-4d47-998d-b53c58676727'
const STATION_2_PACK_NAME = 'sol-station-2'
const STATION_2_CATEGORY_ID = '288030fb-2e36-4696-80da-0dfce33dd2b3'

const STATION_USED_WEIGHTS = [
  { label: 'Station usee - trame', variant_weight: 33 },
  { label: 'Station usee - sas', variant_weight: 1 },
  { label: 'Station usee - trappe', variant_weight: 1 },
  { label: 'Station usee - grille', variant_weight: 1 },
]

const VARIANTS = [
  { label: 'Station 2 - trame', file: 'station-floor-2-01.png', sort_order: 0, variant_weight: 33 },
  { label: 'Station 2 - plaque carree', file: 'station-floor-2-02.png', sort_order: 1, variant_weight: 1 },
  { label: 'Station 2 - grille ronde', file: 'station-floor-2-03.png', sort_order: 2, variant_weight: 1 },
  { label: 'Station 2 - sas octogonal', file: 'station-floor-2-04.png', sort_order: 3, variant_weight: 1 },
]

function parseFaces(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

async function ensureVariantWeightColumn(knex) {
  const hasColumn = await knex.schema.hasColumn('voxel_textures', 'variant_weight')
  if (hasColumn) return

  await knex.schema.alterTable('voxel_textures', (table) => {
    table.integer('variant_weight').notNullable().defaultTo(1)
  })
}

async function ensurePack(knex) {
  const existing = await knex('texture_packs')
    .where({ id: STATION_2_PACK_ID })
    .orWhere({ name: STATION_2_PACK_NAME })
    .first()

  if (existing) {
    await knex('texture_packs')
      .where({ id: existing.id })
      .update({
        name: STATION_2_PACK_NAME,
        label: 'Sol station 2',
        description: 'Sol de station bleute avec trame principale et variantes rares.',
        tile_size: 1024,
        updated_at: knex.fn.now(),
      })
    return { ...existing, name: STATION_2_PACK_NAME, label: 'Sol station 2' }
  }

  const [pack] = await knex('texture_packs').insert({
    id: STATION_2_PACK_ID,
    name: STATION_2_PACK_NAME,
    label: 'Sol station 2',
    description: 'Sol de station bleute avec trame principale et variantes rares.',
    tile_size: 1024,
    created_by: null,
  }).returning('*')
  return pack
}

async function ensureCategory(knex, packId) {
  const existing = await knex('texture_pack_categories')
    .where({ id: STATION_2_CATEGORY_ID })
    .orWhere({ pack_id: packId, label: 'Sol' })
    .first()
  if (existing) return existing

  const [category] = await knex('texture_pack_categories').insert({
    id: STATION_2_CATEGORY_ID,
    pack_id: packId,
    label: 'Sol',
    sort_order: 0,
  }).returning('*')
  return category
}

async function updateStationUsedRatio(knex) {
  const hasColumn = await knex.schema.hasColumn('voxel_textures', 'variant_weight')
  if (!hasColumn) return

  for (const texture of STATION_USED_WEIGHTS) {
    await knex('voxel_textures')
      .where({ pack_id: STATION_USED_PACK_ID, label: texture.label })
      .update({
        variant_weight: texture.variant_weight,
        updated_at: knex.fn.now(),
      })
  }
}

export const up = async (knex) => {
  await ensureVariantWeightColumn(knex)
  await updateStationUsedRatio(knex)

  const pack = await ensurePack(knex)
  const category = await ensureCategory(knex, pack.id)
  const client = getMinioClient()
  const bucket = BUCKET()
  const migrationDir = path.dirname(fileURLToPath(import.meta.url))
  const assetDir = path.join(migrationDir, '..', 'seed-assets', 'sol-station-2')
  const keepPaths = new Set()
  const existingTextures = await knex('voxel_textures').where({ pack_id: pack.id })

  for (const variant of VARIANTS) {
    const relativePath = `sol/${variant.file}`
    keepPaths.add(relativePath)
    const buffer = await fs.readFile(path.join(assetDir, variant.file))
    await client.putObject(
      bucket,
      `textures/${pack.id}/${relativePath}`,
      buffer,
      buffer.length,
      { 'Content-Type': 'image/png' },
    )

    const existing = existingTextures.find((texture) => {
      const faces = parseFaces(texture.faces)
      return Object.values(faces).some(value => value === relativePath)
    }) || existingTextures.find(texture => texture.label === variant.label)

    const payload = {
      category_id: category.id,
      label: variant.label,
      faces: JSON.stringify({ all: relativePath }),
      allowed_geometries: null,
      deprecated: false,
      sort_order: variant.sort_order,
      variant_weight: variant.variant_weight,
      updated_at: knex.fn.now(),
    }

    if (existing) {
      await knex('voxel_textures').where({ id: existing.id }).update(payload)
    } else {
      await knex('voxel_textures').insert({
        pack_id: pack.id,
        ...payload,
      })
    }
  }

  const stationTextures = await knex('voxel_textures').where({ pack_id: pack.id })
  for (const texture of stationTextures) {
    const faces = parseFaces(texture.faces)
    const paths = Object.values(faces || {})
    if (paths.some(value => keepPaths.has(value))) continue
    await knex('voxel_textures').where({ id: texture.id }).update({
      deprecated: true,
      variant_weight: 1,
      updated_at: knex.fn.now(),
    })
  }
}

export const down = async () => {
  console.log('[Migration 80] down() irreversible, no-op documented')
}
