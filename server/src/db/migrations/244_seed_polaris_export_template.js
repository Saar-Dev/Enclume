// Migration 244 — seed du modèle Excel d'export fiche personnage
// (docs/PLANS/PLAN_EXPORTEXCEL.md, Lot 2 fichier 5/5)
//
// Upload idempotent dans MinIO du classeur "Vierge" fourni par Saar — même motif que les migrations
// 144/145/146/148 (assets fixes lus depuis server/src/db/seed-assets/, jamais committés comme
// binaire "nu" à la racine du dépôt ni lus depuis le disque local du serveur en prod).
// Rétrocompatible : ajout pur (nouvel objet MinIO), aucune table ni colonne touchée.

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import getMinioClient, { BUCKET } from '../../lib/minio.js'

export const POLARIS_EXPORT_TEMPLATE_OBJECT = 'templates/polaris-fiche-vierge.xlsx'

async function objectExists(client, bucket, objectName) {
  try {
    await client.statObject(bucket, objectName)
    return true
  } catch (err) {
    if (err.code === 'NoSuchKey' || err.code === 'NotFound') return false
    throw err
  }
}

export const up = async () => {
  const client = getMinioClient()
  const bucket = BUCKET()

  if (await objectExists(client, bucket, POLARIS_EXPORT_TEMPLATE_OBJECT)) return

  const migrationDir = path.dirname(fileURLToPath(import.meta.url))
  const assetPath = path.join(migrationDir, '..', 'seed-assets', 'polaris-export', 'fiche-polaris-vierge.xlsx')
  const buffer = await fs.readFile(assetPath)

  await client.putObject(bucket, POLARIS_EXPORT_TEMPLATE_OBJECT, buffer, buffer.length, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export const down = async () => {
  const client = getMinioClient()
  const bucket = BUCKET()
  if (await objectExists(client, bucket, POLARIS_EXPORT_TEMPLATE_OBJECT)) {
    await client.removeObject(bucket, POLARIS_EXPORT_TEMPLATE_OBJECT)
  }
}
