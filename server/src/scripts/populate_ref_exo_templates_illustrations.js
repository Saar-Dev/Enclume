// Script à usage unique — peuple ref_exo_templates.illustration_url à partir des PNG déjà présents
// dans docs/Illustration/exo-armure/ (PLAN_SUPPLEMENTS.md §7.2, "tâche de contenu, pas de code").
// Sans ce script, la colonne existe et applyExoTemplate la copie, mais elle est NULL sur les 16
// lignes du catalogue : le Lot C est câblé mais ne transporte aucune image (constat Saar 2026-09-29).
//
// Lancement manuel, local : node --env-file=.env server/src/scripts/populate_ref_exo_templates_illustrations.js
// Idempotent : ne touche que les lignes où illustration_url EST NULL (ne réécrase jamais un upload déjà fait).
//
// Correspondance vérifiée par nom exact contre `ls docs/Illustration/exo-armure/` (2026-09-29,
// re-vérifiée après génération de Série A et suppression du doublon Nymph 1-A) — 15 des 16 modèles
// du catalogue ont désormais un fichier identifiable sans ambiguïté. Un seul cas exclu, PAS traité
// par ce script :
//   - Cougar : aucun fichier présent dans le dossier (génération en cours par Saar,
//     GUIDE_TECHNIQUE_ARMURES.md §4) — rejouer ce script une fois le fichier ajouté (idempotent :
//     ne retouchera aucune des 15 lignes déjà illustrées).
//
// Nom d'objet MinIO et format d'URL identiques à POST /api/exo-templates/:id/illustration
// (exoTemplates.js) : `exo_templates/<id>/illustration`, cache-bust `?v=<timestamp>`.

import fs from 'fs/promises'
import path from 'path'
import db from '../db/knex.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'

const ILLUSTRATION_DIR = path.resolve(process.cwd(), 'docs/Illustration/exo-armure')

const NAME_TO_FILE = {
  'Condor': 'exo_condor.png',
  'Explora': 'exo_explora.png',
  'Heimdall-Pyrelia': 'exo_heimdall-pyrelia.png',
  'Mentor': 'exo_mentor.png',
  'Moloch': 'exo_moloch.png',
  'Nymph 1-A': 'exo_nymph1A(2).png', // seul fichier restant après suppression du doublon (2026-09-29)
  'Odin': 'exo_odin.png',
  'Orka': 'exo_orka.png',
  'Ouraken': 'exo_ouraken.png',
  'Série A': 'exo_serie_A.png',
  'Sylph 56': 'exo_sylph56.png',
  'Typhon': 'exo_typhon.png',
  'Vanguard': 'exo_vanguard.png',
  'Vauban': 'exo_vauban.png',
  'Vulcain': 'exo_vulkain.png', // orthographe du fichier ("vulkain"), pas du nom catalogue
}

async function run() {
  const minio = getMinioClient()
  let updated = 0
  let skippedExisting = 0
  let skippedNotFound = 0

  for (const [name, filename] of Object.entries(NAME_TO_FILE)) {
    const template = await db('ref_exo_templates').where({ name }).first()
    if (!template) {
      console.log(`[skip] "${name}" introuvable dans ref_exo_templates`)
      continue
    }
    if (template.illustration_url) {
      console.log(`[skip] "${name}" a déjà une illustration_url — ne jamais écraser un upload existant`)
      skippedExisting++
      continue
    }

    const filePath = path.join(ILLUSTRATION_DIR, filename)
    let fileBuffer
    try {
      fileBuffer = await fs.readFile(filePath)
    } catch {
      console.log(`[skip] "${name}" — fichier introuvable : ${filePath}`)
      skippedNotFound++
      continue
    }

    const objectName = `exo_templates/${template.id}/illustration`
    await minio.putObject(BUCKET(), objectName, fileBuffer, fileBuffer.length, { 'Content-Type': 'image/png' })

    const illustrationUrl = `${objectName}?v=${Date.now()}`
    await db('ref_exo_templates').where({ id: template.id }).update({ illustration_url: illustrationUrl, updated_at: db.fn.now() })
    console.log(`[ok] "${name}" ← ${filename}`)
    updated++
  }

  console.log(`\nTerminé : ${updated} mise(s) à jour, ${skippedExisting} déjà illustrée(s), ${skippedNotFound} fichier(s) introuvable(s).`)
  console.log('Cougar, Série A (aucun fichier) et Nymph 1-A (fichier ambigu) volontairement exclus — voir en-tête du script.')
}

run()
  .then(() => db.destroy())
  .catch(async (err) => { console.error(err); await db.destroy(); process.exit(1) })
