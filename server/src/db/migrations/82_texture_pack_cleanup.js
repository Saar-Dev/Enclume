import getMinioClient, { BUCKET } from '../../lib/minio.js'

const KEEP_PACK_NAMES = ['sol-station-use', 'sol-station-2']

function listObjects(client, bucket, prefix) {
  return new Promise((resolve, reject) => {
    const objects = []
    const stream = client.listObjectsV2(bucket, prefix, true)
    stream.on('data', obj => objects.push(obj.name))
    stream.on('error', reject)
    stream.on('end', () => resolve(objects))
  })
}

async function removePackObjects(pack) {
  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT) return

  const client = getMinioClient()
  const bucket = BUCKET()
  const prefixes = [
    `textures/${pack.id}/`,
    `textures/${pack.name}/`,
  ]

  for (const prefix of prefixes) {
    const objects = await listObjects(client, bucket, prefix)
    for (const objectName of objects) {
      await client.removeObject(bucket, objectName)
    }
  }
}

function parseFaces(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

async function removeUnreferencedKeepObjects(knex, keepPacks) {
  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT) return

  const client = getMinioClient()
  const bucket = BUCKET()
  const keepPackIds = keepPacks.map(pack => pack.id)
  const textures = await knex('voxel_textures')
    .whereIn('pack_id', keepPackIds)
    .select('pack_id', 'faces')
  const usedObjectsByPack = new Map(keepPacks.map(pack => [pack.id, new Set()]))

  for (const texture of textures) {
    const faces = parseFaces(texture.faces)
    const usedObjects = usedObjectsByPack.get(texture.pack_id)
    if (!usedObjects) continue
    for (const relativePath of Object.values(faces).filter(Boolean)) {
      usedObjects.add(`textures/${texture.pack_id}/${relativePath}`)
    }
  }

  for (const pack of keepPacks) {
    const usedObjects = usedObjectsByPack.get(pack.id) || new Set()
    const objects = await listObjects(client, bucket, `textures/${pack.id}/`)
    for (const objectName of objects) {
      if (!objectName.endsWith('.png')) continue
      if (usedObjects.has(objectName)) continue
      await client.removeObject(bucket, objectName)
    }
  }
}

export const up = async (knex) => {
  const keepPacks = await knex('texture_packs')
    .whereIn('name', KEEP_PACK_NAMES)
    .select('id', 'name')
  const keepPackIds = keepPacks.map(pack => pack.id)

  if (keepPackIds.length === 0) {
    console.warn('[Migration 82] Aucun pack station conserve trouve, nettoyage ignore.')
    return
  }

  const dropPacks = await knex('texture_packs')
    .whereNotIn('id', keepPackIds)
    .select('id', 'name')

  if (dropPacks.length === 0) return

  const dropPackIds = dropPacks.map(pack => pack.id)

  await knex.transaction(async (trx) => {
    const dropTextureIds = await trx('voxel_textures')
      .whereIn('pack_id', dropPackIds)
      .pluck('id')

    if (dropTextureIds.length > 0) {
      await trx('battlemap_texture_usage')
        .whereIn('voxel_texture_id', dropTextureIds)
        .delete()
    }

    await trx('entity_blueprints')
      .whereIn('pack_id', dropPackIds)
      .update({
        pack_id: null,
        deprecated: true,
        updated_at: trx.fn.now(),
      })

    await trx('voxel_textures')
      .whereIn('pack_id', dropPackIds)
      .delete()

    await trx('texture_pack_categories')
      .whereIn('pack_id', dropPackIds)
      .delete()

    await trx('texture_packs')
      .whereIn('id', dropPackIds)
      .delete()

    await trx('voxel_textures')
      .whereIn('pack_id', keepPackIds)
      .update({
        deprecated: false,
        updated_at: trx.fn.now(),
      })
  })

  for (const pack of dropPacks) {
    try {
      await removePackObjects(pack)
    } catch (err) {
      console.warn(`[Migration 82] Nettoyage MinIO ignore pour ${pack.name}: ${err.message}`)
    }
  }

  try {
    await removeUnreferencedKeepObjects(knex, keepPacks)
  } catch (err) {
    console.warn(`[Migration 82] Nettoyage MinIO des packs conserves ignore: ${err.message}`)
  }
}

export const down = async () => {
  console.log('[Migration 82] down() irreversible, no-op documented')
}
