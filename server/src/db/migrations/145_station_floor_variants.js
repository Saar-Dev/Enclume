import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import getMinioClient, { BUCKET } from '../../lib/minio.js'

const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_USED_PACK_NAME = 'sol-station-use'
const STATION_USED_CATEGORY_ID = '60f5e138-7d2b-4370-91e0-a8edc5ddf39c'

const VARIANTS = [
  { label: 'Station usee - trame', file: 'station-used-floor-01.png', sort_order: 0, variant_weight: 6 },
  { label: 'Station usee - sas', file: 'station-used-floor-02.png', sort_order: 1, variant_weight: 1 },
  { label: 'Station usee - trappe', file: 'station-used-floor-03.png', sort_order: 2, variant_weight: 1 },
  { label: 'Station usee - grille', file: 'station-used-floor-04.png', sort_order: 3, variant_weight: 1 },
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
  const existing = await knex('texture_packs').where({ id: STATION_USED_PACK_ID }).first()
  if (existing) {
    await knex('texture_packs')
      .where({ id: STATION_USED_PACK_ID })
      .update({
        name: STATION_USED_PACK_NAME,
        label: 'Sol station use',
        description: 'Sol de station use avec trame principale et variantes rares.',
        tile_size: 1024,
        updated_at: knex.fn.now(),
      })
    return { ...existing, name: STATION_USED_PACK_NAME }
  }

  const [pack] = await knex('texture_packs').insert({
    id: STATION_USED_PACK_ID,
    name: STATION_USED_PACK_NAME,
    label: 'Sol station use',
    description: 'Sol de station use avec trame principale et variantes rares.',
    tile_size: 1024,
    created_by: null,
  }).returning('*')
  return pack
}

async function ensureCategory(knex) {
  const existing = await knex('texture_pack_categories').where({ id: STATION_USED_CATEGORY_ID }).first()
  if (existing) return existing

  const byLabel = await knex('texture_pack_categories')
    .where({ pack_id: STATION_USED_PACK_ID, label: 'Sol' })
    .first()
  if (byLabel) return byLabel

  const [category] = await knex('texture_pack_categories').insert({
    id: STATION_USED_CATEGORY_ID,
    pack_id: STATION_USED_PACK_ID,
    label: 'Sol',
    sort_order: 0,
  }).returning('*')
  return category
}

export const up = async (knex) => {
  await ensureVariantWeightColumn(knex)
  await ensurePack(knex)
  const category = await ensureCategory(knex)

  const client = getMinioClient()
  const bucket = BUCKET()
  const migrationDir = path.dirname(fileURLToPath(import.meta.url))
  const assetDir = path.join(migrationDir, '..', 'seed-assets', 'sol-station-use-v2')

  const keepPaths = new Set()
  const existingTextures = await knex('voxel_textures').where({ pack_id: STATION_USED_PACK_ID })
  for (const variant of VARIANTS) {
    const relativePath = `sol/${variant.file}`
    keepPaths.add(relativePath)
    const buffer = await fs.readFile(path.join(assetDir, variant.file))
    await client.putObject(
      bucket,
      `textures/${STATION_USED_PACK_ID}/${relativePath}`,
      buffer,
      buffer.length,
      { 'Content-Type': 'image/png' },
    )

    const existing = existingTextures.find(texture => {
      const faces = parseFaces(texture.faces)
      return Object.values(faces).some(value => value === relativePath)
    }) || existingTextures.find(texture => texture.label === variant.label)

    const payload = {
      label: variant.label,
      category_id: category.id,
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
        pack_id: STATION_USED_PACK_ID,
        label: variant.label,
        ...payload,
      })
    }
  }

  const stationTextures = await knex('voxel_textures').where({ pack_id: STATION_USED_PACK_ID })
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
  console.log('[Migration 145] down() irreversible, no-op documented')
}
