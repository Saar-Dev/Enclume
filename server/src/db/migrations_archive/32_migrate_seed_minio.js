import * as Minio from 'minio'
import getMinioClient, { BUCKET } from '../../lib/minio.js'

// UUID fixe du pack structure-station — défini en migration 24, inchangé
const PACK_UUID = 'b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e'
const OLD_PREFIX = 'textures/structure-station/'
const NEW_PREFIX = `textures/${PACK_UUID}/`

// Collecte tous les objets sous un préfixe via listObjectsV2 (stream événementiel)
function listObjects(client, bucket, prefix) {
  return new Promise((resolve, reject) => {
    const objects = []
    const stream = client.listObjectsV2(bucket, prefix, true)
    stream.on('data', obj => objects.push(obj.name))
    stream.on('error', reject)
    stream.on('end', () => resolve(objects))
  })
}

export const up = async () => {
  const client = getMinioClient()
  const bucket = BUCKET()

  // 1. Lister tous les fichiers sous l'ancien préfixe
  const objects = await listObjects(client, bucket, OLD_PREFIX)

  if (objects.length === 0) {
    console.log('[Migration 32] Aucun fichier trouvé sous', OLD_PREFIX, '— migration ignorée')
    return
  }

  console.log(`[Migration 32] ${objects.length} fichiers à déplacer vers ${NEW_PREFIX}`)

  // 2. Copier chaque fichier vers le nouveau préfixe
  // Le suffixe (chemin relatif au pack) reste identique — seul le dossier racine change
  // Exemple : textures/structure-station/sol/metal_plate_top.png
  //        → textures/b4e8f2a1-.../sol/metal_plate_top.png
  const conditions = new Minio.CopyConditions()

  for (const oldPath of objects) {
    const suffix = oldPath.slice(OLD_PREFIX.length) // ex: "sol/metal_plate_top.png"
    const newPath = `${NEW_PREFIX}${suffix}`

    await client.copyObject(bucket, newPath, `/${bucket}/${oldPath}`, conditions)
    console.log(`[Migration 32] Copié : ${oldPath} → ${newPath}`)
  }

  // 3. Supprimer les anciens fichiers après copie complète
  // On supprime APRES avoir tout copié — si une copie échoue, les anciens fichiers restent intacts
  for (const oldPath of objects) {
    await client.removeObject(bucket, oldPath)
  }

  console.log(`[Migration 32] Migration terminée — ${objects.length} fichiers déplacés`)
}

// Irréversible — les anciens chemins sont supprimés dans up()
// Un rollback nécessiterait de savoir quels fichiers existaient avant — non stocké
export const down = async () => {
  console.log('[Migration 32] down() — irréversible, no-op documenté')
}
