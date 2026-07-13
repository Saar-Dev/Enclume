import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import * as Minio from 'minio'
import getMinioClient, { BUCKET } from '../../lib/minio.js'

const SOURCE_PACK_NAME = 'structure-station'
const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_USED_PACK_NAME = 'sol-station-use'
const STATION_USED_CATEGORY_ID = '60f5e138-7d2b-4370-91e0-a8edc5ddf39c'

const STATION_USED_TEXTURES = [
  { label: 'Station usee 1', file: 'station-used-floor-01.png', sort_order: 0 },
  { label: 'Station usee 2', file: 'station-used-floor-02.png', sort_order: 1 },
  { label: 'Station usee 3', file: 'station-used-floor-03.png', sort_order: 2 },
]

function parseJson(value, fallback) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function slugify(value) {
  return String(value || 'texture')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'texture'
}

function uniqueFacePaths(faces) {
  return [...new Set(Object.values(faces || {}).filter(Boolean))]
}

async function objectExists(client, bucket, objectName) {
  try {
    await client.statObject(bucket, objectName)
    return true
  } catch (err) {
    if (err.code === 'NoSuchKey' || err.code === 'NotFound') return false
    throw err
  }
}

async function copyObjectIfNeeded(client, bucket, sources, destination, conditions) {
  if (await objectExists(client, bucket, destination)) return true

  for (const source of sources) {
    if (!(await objectExists(client, bucket, source))) continue
    await client.copyObject(bucket, destination, `/${bucket}/${source}`, conditions)
    return true
  }

  console.warn(`[Migration 144] Texture source introuvable pour ${destination}`)
  return false
}

async function ensurePack(knex, data) {
  const existing = await knex('texture_packs').where({ name: data.name }).first()
  if (existing) return existing

  const [pack] = await knex('texture_packs').insert(data).returning('*')
  return pack
}

async function ensureCategory(knex, packId, label, sortOrder = 0, forcedId = null) {
  let query = knex('texture_pack_categories').where({ pack_id: packId, label })
  if (forcedId) query = knex('texture_pack_categories').where({ id: forcedId }).orWhere({ pack_id: packId, label })
  const existing = await query.first()
  if (existing) return existing

  const payload = { pack_id: packId, label, sort_order: sortOrder }
  if (forcedId) payload.id = forcedId
  const [category] = await knex('texture_pack_categories').insert(payload).returning('*')
  return category
}

async function splitStructureStationTextures(knex, client, bucket, conditions) {
  const sourcePack = await knex('texture_packs').where({ name: SOURCE_PACK_NAME }).first()
  if (!sourcePack) return

  const textures = await knex('voxel_textures')
    .leftJoin('texture_pack_categories', 'voxel_textures.category_id', 'texture_pack_categories.id')
    .where('voxel_textures.pack_id', sourcePack.id)
    .select(
      'voxel_textures.*',
      'texture_pack_categories.label as category_label',
      'texture_pack_categories.sort_order as category_sort_order',
    )
    .orderBy('voxel_textures.id')

  for (const texture of textures) {
    const categoryLabel = texture.category_label || 'Divers'
    const categorySortOrder = Number(texture.category_sort_order) || 0
    const packName = `texture-${texture.id}-${slugify(texture.label)}`
    const pack = await ensurePack(knex, {
      name: packName,
      label: `${categoryLabel} - ${texture.label}`,
      description: `Pack unitaire genere depuis ${sourcePack.label}.`,
      tile_size: sourcePack.tile_size || 128,
      created_by: sourcePack.created_by || null,
    })
    const category = await ensureCategory(knex, pack.id, categoryLabel, categorySortOrder)
    const faces = parseJson(texture.faces, {})

    for (const relativePath of uniqueFacePaths(faces)) {
      await copyObjectIfNeeded(
        client,
        bucket,
        [
          `textures/${sourcePack.id}/${relativePath}`,
          `textures/${sourcePack.name}/${relativePath}`,
        ],
        `textures/${pack.id}/${relativePath}`,
        conditions,
      )
    }

    await knex('voxel_textures')
      .where({ id: texture.id })
      .update({
        pack_id: pack.id,
        category_id: category.id,
        updated_at: knex.fn.now(),
      })
  }
}

async function seedStationUsedFloor(knex, client, bucket) {
  const pack = await ensurePack(knex, {
    id: STATION_USED_PACK_ID,
    name: STATION_USED_PACK_NAME,
    label: 'Sol station usé',
    description: 'Variantes de sol de station use, rouille et lumieres cyan.',
    tile_size: 1024,
    created_by: null,
  })
  const category = await ensureCategory(knex, pack.id, 'Sol', 0, STATION_USED_CATEGORY_ID)

  const migrationDir = path.dirname(fileURLToPath(import.meta.url))
  const assetDir = path.join(migrationDir, '..', 'seed-assets', 'sol-station-use')

  for (const texture of STATION_USED_TEXTURES) {
    const relativePath = `sol/${texture.file}`
    const objectName = `textures/${pack.id}/${relativePath}`
    if (!(await objectExists(client, bucket, objectName))) {
      const buffer = await fs.readFile(path.join(assetDir, texture.file))
      await client.putObject(bucket, objectName, buffer, buffer.length, {
        'Content-Type': 'image/png',
      })
    }

    const existingTexture = await knex('voxel_textures')
      .where({ pack_id: pack.id, label: texture.label })
      .first()
    if (existingTexture) continue

    await knex('voxel_textures').insert({
      pack_id: pack.id,
      category_id: category.id,
      label: texture.label,
      faces: JSON.stringify({ all: relativePath }),
      allowed_geometries: null,
      deprecated: false,
      sort_order: texture.sort_order,
    })
  }
}

export const up = async (knex) => {
  const client = getMinioClient()
  const bucket = BUCKET()
  const conditions = new Minio.CopyConditions()

  await splitStructureStationTextures(knex, client, bucket, conditions)
  await seedStationUsedFloor(knex, client, bucket)
}

export const down = async () => {
  console.log('[Migration 144] down() irreversible, no-op documented')
}
