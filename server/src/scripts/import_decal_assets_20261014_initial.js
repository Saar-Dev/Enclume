// server/src/scripts/import_decal_assets_20261014_initial.js — import initial du catalogue de
// décalques (docs/PLANS/PLAN_DECALS.md Lot 0). Lecture SEULE de assets_source/decals/ (trié, hors
// dépôt Git — voir son README.md) ; écrit dans MinIO + decal_assets. Script écrit par l'agent,
// lancé par Saar (écrit en base hors du périmètre des scripts auto-exécutés, AGENTS.md).
// Lancement manuel, local, depuis la racine : node --env-file=.env server/src/scripts/import_decal_assets_20261014_initial.js
//
// Idempotent par clé naturelle (source_pack, label), jamais l'id (.claude/rules/core.md,
// SEED-ID-DETERM) — rejouer le script après ajout de nouvelles images ne duplique pas les
// existantes, ne les touche pas non plus (une image déjà importée n'est jamais ré-uploadée).
// MinIO AVANT base (P25, patron texture-packs.js) : un import interrompu en cours de route ne
// laisse jamais une ligne en base sans fichier MinIO derrière — au pire un fichier MinIO orphelin
// sans ligne, sans risque de 404 au rendu, à nettoyer manuellement si jamais ça arrive.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { imageSize } from 'image-size'
import db from '../db/knex.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const SOURCE_ROOT = path.resolve(process.cwd(), 'assets_source/decals')

const FOLDERS = [
  { dir: 'signage', category: 'signage', sourcePack: 'Sign_Decals/Alphas' },
  { dir: 'military_navy', category: 'military', sourcePack: 'JRO_Military_Alphas' },
  { dir: 'military_white', category: 'military', sourcePack: 'JRO_Military_Decals' },
]

function labelFromFilename(filename) {
  return filename.replace(/\.png$/i, '').replace(/^JRO_D_/, '').replace(/_/g, ' ').trim()
}

async function run() {
  const minio = getMinioClient()
  const bucket = BUCKET()
  let created = 0
  let skipped = 0

  for (const { dir, category, sourcePack } of FOLDERS) {
    const folderPath = path.join(SOURCE_ROOT, dir)
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Dossier source introuvable : ${folderPath} — assets_source/decals/ a-t-il été déplacé ou déjà nettoyé ?`)
    }
    const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.png'))

    for (const filename of files) {
      const label = labelFromFilename(filename)

      const existing = await db('decal_assets').where({ source_pack: sourcePack, label }).first()
      if (existing) {
        skipped++
        continue
      }

      const filePath = path.join(folderPath, filename)
      const buffer = fs.readFileSync(filePath)
      const { width, height } = imageSize(buffer)

      const id = crypto.randomUUID()
      const imagePath = `decals/${id}.png`

      await minio.putObject(bucket, imagePath, buffer, buffer.length, { 'Content-Type': 'image/png' })

      await db('decal_assets').insert({
        id,
        category,
        label,
        image_path: imagePath,
        width_px: width,
        height_px: height,
        source_pack: sourcePack,
      })
      created++
    }
  }

  console.log(`Import terminé : ${created} créés, ${skipped} déjà présents (idempotent).`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
