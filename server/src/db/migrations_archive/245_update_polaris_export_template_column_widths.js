// Migration 245 — largeur des colonnes Armure/Choc/Malus du modèle Excel d'export
// (docs/PLANS/PLAN_EXPORTEXCEL.md, bug trouvé par Saar sur l'export réel).
//
// La migration 244 est idempotente (`objectExists` -> skip) et ne peut donc pas pousser une mise à
// jour du même objet MinIO déjà seedé — celle-ci le remplace explicitement.
//
// Changement dans `server/src/db/seed-assets/polaris-export/fiche-polaris-vierge.xlsx` (feuille
// `Personnage`) : largeur des colonnes `AK,AL,AM,AN,AO` (bloc Tête/Bras droit/Jambe droite) et
// `AZ,BA,BB,BC,BD` (bloc Corps/Bras gauche/Jambe gauche), de 3,5 à 8 — la valeur d'origine, héritée
// de l'export Google Sheets -> Excel, est trop étroite pour afficher "Armure"/"Choc"/"Malus" avec
// bordures (le texte déborde normalement dans Excel vers une cellule vide, mais les bordures de la
// grille de Protections bloquent ce débordement). Named ranges, formules et 73 commentaires Excel du
// classeur inchangés (vérifié par recalcul LibreOffice réel : jeu de cellules en erreur strictement
// identique avant/après ce changement).
//
// Rétrocompatible : remplacement d'un objet MinIO existant, aucune table ni colonne DB touchée.

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import getMinioClient, { BUCKET } from '../../lib/minio.js'
import { POLARIS_EXPORT_TEMPLATE_OBJECT } from './244_seed_polaris_export_template.js'

export const up = async () => {
  const client = getMinioClient()
  const bucket = BUCKET()

  const migrationDir = path.dirname(fileURLToPath(import.meta.url))
  const assetPath = path.join(migrationDir, '..', 'seed-assets', 'polaris-export', 'fiche-polaris-vierge.xlsx')
  const buffer = await fs.readFile(assetPath)

  await client.putObject(bucket, POLARIS_EXPORT_TEMPLATE_OBJECT, buffer, buffer.length, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// Pas de rollback significatif : l'ancienne largeur de colonne était un défaut visuel, pas une
// version fonctionnelle à restaurer. `down` est un no-op volontaire (même motif que les migrations
// de contenu pur sans `down` réversible ailleurs dans le projet).
export const down = async () => {}
