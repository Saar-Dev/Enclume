// server/src/scripts/fix_decal_assets_catalog_20261015.js — correctif du catalogue de décalques
// (docs/PLANS/PLAN_DECALS.md) trouvé par Saar au test réel du Lot 3 : la grande majorité des images
// du pack avaient un fond NOIR OPAQUE (pas un vrai canal alpha transparent, vérifié pixel par pixel,
// pas seulement le type PNG) — rendues comme un carré noir plein en 3D. Deux défauts distincts,
// vérifiés séparément avant de corriger :
//
// 1. « military_navy » (JRO_Military_Alphas) et « military_white » (JRO_Military_Decals, 100 images
//    chacun) sont les MÊMES dessins sous deux défauts complémentaires, pas un bon pack + un doublon
//    comme supposé une première fois : navy avait un fond noir opaque (corrigé ici, encre déjà
//    blanche — vérifié max RGB 255) ; white avait bien un fond transparent MAIS une encre trop sombre
//    pour être visible ou teintable (vérifié : canaux RGB plafonnés à ~16% de luminosité partout,
//    jamais blanc malgré son nom) — la teinte (`material.color` en multiplicatif, cf. §D du plan) ne
//    peut jamais éclaircir une encre déjà presque noire. Retenu : navy (corrigé en place, fond
//    retiré par remplissage depuis les bords) remplace white comme version affichée ; white déprécié.
// 2. « signage » (121 images, dont 119 avec le même fond noir) : pas de doublon à côté, vraie
//    réparation d'image, déjà appliquée en place.
//
// Les deux corrections d'image utilisent un remplissage du fond depuis les 4 coins (jamais un retrait
// de couleur global) : plusieurs icônes ont du texte/des plaques NOIRS qui font partie du dessin, pas
// du fond — un retrait global les aurait effacées aussi. Vérifié visuellement sur une vingtaine
// d'échantillons variés avant d'appliquer aux lots entiers (échange avec Saar, 2026-10-15). Originaux
// sauvegardés dans assets_source/decals/{signage,military_navy}_originals_backup_20261015/.
//
// Ce script ré-uploade l'image corrigée vers le MÊME `image_path` déjà en base (pas une nouvelle
// ligne, pas un nouvel id) — l'import initial (import_decal_assets_20261014_initial.js) reste intact
// comme compte rendu historique de ce qui a été importé à l'origine, jamais réécrit. Idempotent :
// relancer ce script ne fait rien de plus la deuxième fois (ré-upload des mêmes octets, dépréciation
// déjà appliquée ignorée).
//
// Écrit en base + MinIO hors du périmètre des scripts auto-exécutés (AGENTS.md) — lancé par Saar :
// node --env-file=.env server/src/scripts/fix_decal_assets_catalog_20261015.js

import fs from 'fs'
import path from 'path'
import db from '../db/knex.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const SOURCE_ROOT = path.resolve(process.cwd(), 'assets_source/decals')

// { dossier corrigé en place, source_pack correspondant en base }
const FIXED_IMAGE_FOLDERS = [
  { dir: 'signage', sourcePack: 'Sign_Decals/Alphas' },
  { dir: 'military_navy', sourcePack: 'JRO_Military_Alphas' },
]
const DEPRECATE_SOURCE_PACK = 'JRO_Military_Decals' // military_white — encre trop sombre, remplacé par military_navy corrigé
const UNDEPRECATE_SOURCE_PACK = 'JRO_Military_Alphas' // military_navy — au cas où une version précédente de ce script l'aurait déprécié à tort

function labelFromFilename(filename) {
  return filename.replace(/\.png$/i, '').replace(/^JRO_D_/, '').replace(/_/g, ' ').trim()
}

async function run() {
  const minio = getMinioClient()
  const bucket = BUCKET()

  const undeprecatedCount = await db('decal_assets')
    .where({ source_pack: UNDEPRECATE_SOURCE_PACK, deprecated: true })
    .update({ deprecated: false })
  if (undeprecatedCount > 0) {
    console.log(`Dépréciation précédente annulée (${UNDEPRECATE_SOURCE_PACK}) : ${undeprecatedCount}`)
  }

  const deprecatedCount = await db('decal_assets')
    .where({ source_pack: DEPRECATE_SOURCE_PACK, deprecated: false })
    .update({ deprecated: true })
  console.log(`Pack remplacé, déprécié (${DEPRECATE_SOURCE_PACK}) : ${deprecatedCount}`)

  for (const { dir, sourcePack } of FIXED_IMAGE_FOLDERS) {
    const folderPath = path.join(SOURCE_ROOT, dir)
    const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.png'))

    let updated = 0
    let notFound = 0

    for (const filename of files) {
      const label = labelFromFilename(filename)
      const row = await db('decal_assets').where({ source_pack: sourcePack, label }).first()
      if (!row) {
        notFound++
        console.warn(`Aucune ligne en base pour ${sourcePack} / "${label}" (${filename}) — ignoré.`)
        continue
      }
      const buffer = fs.readFileSync(path.join(folderPath, filename))
      await minio.putObject(bucket, row.image_path, buffer, buffer.length, { 'Content-Type': 'image/png' })
      updated++
    }

    console.log(`${dir} : images ré-uploadées (corrigées) = ${updated}, non trouvées en base = ${notFound}`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
