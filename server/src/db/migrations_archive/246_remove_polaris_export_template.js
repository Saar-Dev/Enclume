// Migration 246 — retrait du modèle Excel d'export fiche personnage
// (docs/PLANS/PLAN_FICHE_HORSLIGNE.md §3 — piste Excel abandonnée, remplacée par une fiche
// consultable/imprimable hors-ligne via PWA, cf. le plan).
//
// Nettoyage symétrique de la migration 244 (`putObject`) : retire l'objet MinIO devenu inutile
// maintenant que `excelExportWriter.js`/`excelExportAssembler.js`/`tools/audit-excel-named-ranges.js`
// et la route/le bouton associés sont supprimés (aucun code ne référence plus
// `POLARIS_EXPORT_TEMPLATE_OBJECT`). Les migrations 244/245 elles-mêmes restent en place
// (convention du projet : ne jamais supprimer une migration déjà appliquée).
//
// Rétrocompatible : suppression d'un objet MinIO, aucune table ni colonne touchée.

import getMinioClient, { BUCKET } from '../../lib/minio.js'
import { POLARIS_EXPORT_TEMPLATE_OBJECT } from './244_seed_polaris_export_template.js'

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
  if (await objectExists(client, bucket, POLARIS_EXPORT_TEMPLATE_OBJECT)) {
    await client.removeObject(bucket, POLARIS_EXPORT_TEMPLATE_OBJECT)
  }
}

// Pas de rollback : l'objet supprimé était un gabarit statique, pas une donnée utilisateur — rien à
// restaurer (même motif que `down` de la migration 245).
export const down = async () => {}
