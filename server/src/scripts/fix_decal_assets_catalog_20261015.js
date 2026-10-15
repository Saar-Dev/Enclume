// server/src/scripts/fix_decal_assets_catalog_20261015.js — correctif du catalogue de décalques
// (docs/PLANS/PLAN_DECALS.md) trouvé par Saar au test réel du Lot 3 : la grande majorité des images
// du pack avaient un fond NOIR OPAQUE (pas un vrai canal alpha transparent, vérifié pixel par pixel,
// pas seulement le type PNG) — rendues comme un carré noir plein en 3D. Deux correctifs distincts :
//
// 1. Pack « military_navy » (source_pack JRO_Military_Alphas, 100 images) : vérifié être un DOUBLON
//    EXACT du pack « military_white » (JRO_Military_Decals, 100 images) — mêmes dessins, mais navy a
//    toujours un fond noir opaque là où white est déjà correctement transparent. Pas de réparation
//    d'image : on déprécie les 100 lignes navy (champ `deprecated`, déjà prévu au Lot 0 — aucune
//    suppression, aucun fichier MinIO touché, réversible en remettant `deprecated = false`).
//
// 2. Pack « signage » (121 images, dont 119 avaient le même défaut) : pas de doublon à côté, donc
//    vraie réparation d'image — correction déjà appliquée EN PLACE dans assets_source/decals/signage/
//    (fond noir rendu transparent par remplissage depuis les 4 coins, jamais un simple remplacement
//    de couleur global : certaines icônes ont du texte/des détails NOIRS qui font partie du dessin,
//    pas du fond — un retrait de couleur global les aurait effacés aussi ; vérifié visuellement sur
//    plusieurs échantillons avant d'appliquer au lot entier, voir l'échange avec Saar du 2026-10-15).
//    Originaux sauvegardés dans assets_source/decals/signage_originals_backup_20261015/. Ce script
//    ré-uploade l'image corrigée vers le MÊME `image_path` déjà en base (pas une nouvelle ligne, pas
//    un nouvel id) — l'import initial (import_decal_assets_20261014_initial.js) reste intact comme
//    compte rendu historique de ce qui a été importé à l'origine, jamais réécrit.
//
// Écrit en base + MinIO hors du périmètre des scripts auto-exécutés (AGENTS.md) — lancé par Saar :
// node --env-file=.env server/src/scripts/fix_decal_assets_catalog_20261015.js

import fs from 'fs'
import path from 'path'
import db from '../db/knex.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const SOURCE_ROOT = path.resolve(process.cwd(), 'assets_source/decals')
const SIGNAGE_SOURCE_PACK = 'Sign_Decals/Alphas'
const DUPLICATE_SOURCE_PACK = 'JRO_Military_Alphas'

function labelFromFilename(filename) {
  return filename.replace(/\.png$/i, '').replace(/^JRO_D_/, '').replace(/_/g, ' ').trim()
}

async function run() {
  const minio = getMinioClient()
  const bucket = BUCKET()

  // 1. Dépréciation du pack doublon (military_navy / JRO_Military_Alphas).
  const deprecatedCount = await db('decal_assets')
    .where({ source_pack: DUPLICATE_SOURCE_PACK, deprecated: false })
    .update({ deprecated: true })
  console.log(`Doublons dépréciés (${DUPLICATE_SOURCE_PACK}) : ${deprecatedCount}`)

  // 2. Ré-upload des images signage corrigées, sur le même image_path déjà en base.
  const signageDir = path.join(SOURCE_ROOT, 'signage')
  const files = fs.readdirSync(signageDir).filter(f => f.toLowerCase().endsWith('.png'))

  let updated = 0
  let notFound = 0

  for (const filename of files) {
    const label = labelFromFilename(filename)
    const row = await db('decal_assets').where({ source_pack: SIGNAGE_SOURCE_PACK, label }).first()
    if (!row) {
      notFound++
      console.warn(`Aucune ligne en base pour ${SIGNAGE_SOURCE_PACK} / "${label}" (${filename}) — ignoré.`)
      continue
    }
    const buffer = fs.readFileSync(path.join(signageDir, filename))
    await minio.putObject(bucket, row.image_path, buffer, buffer.length, { 'Content-Type': 'image/png' })
    updated++
  }

  console.log(`Images signage ré-uploadées (fond corrigé) : ${updated}, non trouvées en base : ${notFound}`)
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
