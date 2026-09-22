// validate-encyclopedia.mjs — Vérificateur de cohérence de l'Encyclopédie (contenu RAW Polaris).
//
// Contrairement aux scripts jetables `_test_*.mjs` utilisés en cours de session, celui-ci est
// pérenne : à relancer après tout renommage/fusion/déplacement d'article (segmentation), avant et
// après, pour comparer. Trouvé nécessaire le 2026-09-22 après un script de vérification jamais
// pérennisé malgré la décision de le faire — voir project_encyclopedia_chantier (mémoire).
//
// Usage : node tools/validate-encyclopedia.mjs
//
// Vérifie :
//   1. Chaque entrée de _index.json a un fichier disque correspondant, avec id/slug/title/page
//      identiques (désync index/contenu — la classe de bug à l'origine de ce script, cf.
//      blessures-description / force-polaris.maitrise-force-polaris, 2026-09-22).
//   2. Fichiers présents sur disque mais absents de l'index (orphelins).
//   3. Chaque lien wiki [[Label|cible|page]] pointe vers une cible qui existe réellement : un id
//      d'article, un slug de chapitre (lien vers un chapitre entier, vu dans le corpus), ou un id
//      d'ancre (heading/callout) dans N'IMPORTE QUEL article — la résolution cross-article est
//      cassée au runtime (ticket ENCYCLOPEDIA-WIKI-LINKS-CROSS-ARTICLE) mais la cible doit malgré
//      tout exister structurellement, pour le jour où ce sera corrigé.
//
// Sortie : liste d'erreurs (une par ligne) puis un résumé. Code de sortie 1 si des erreurs, 0 sinon.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FR_ROOT = path.join(__dirname, '..', 'client', 'src', 'components', 'encyclopedia', 'fr')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// Extrait récursivement les id ciblables (headings avec id, callouts avec id, articles eux-mêmes)
// — même logique que contentLoader.js:extractSections, mais collecte TOUS les id (pas seulement
// ceux avec un titre), pour la validation de liens.
function collectIds(blocks, out) {
  for (const block of blocks) {
    if ((block.type === 'heading' || block.type === 'callout') && block.id) {
      out.add(block.id)
    }
    if (block.type === 'callout' && Array.isArray(block.blocks)) {
      collectIds(block.blocks, out)
    } else if (block.type === 'list' && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (Array.isArray(item.blocks)) collectIds(item.blocks, out)
      }
    }
  }
}

// Extrait le texte de tous les blocs paragraph (récursif) pour y chercher des liens [[...]].
function collectText(blocks, out) {
  for (const block of blocks) {
    if (block.type === 'paragraph' && typeof block.text === 'string') out.push(block.text)
    if (Array.isArray(block.blocks)) collectText(block.blocks, out)
    if (block.type === 'list' && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (typeof item.label === 'string') out.push(item.label)
        if (Array.isArray(item.blocks)) collectText(item.blocks, out)
      }
    }
  }
}

function main() {
  const errors = []
  const index = readJson(path.join(FR_ROOT, '_index.json'))

  const knownArticleIds = new Set()
  const knownChapterSlugs = new Set()
  const knownAnchorIds = new Set()
  const allArticleTexts = [] // { file, texts }

  for (const book of index.books) {
    for (const chapter of book.chapters) {
      knownChapterSlugs.add(chapter.slug)
      const dir = path.join(FR_ROOT, book.slug, chapter.slug)

      for (const art of chapter.articles) {
        const file = path.join(dir, art.slug + '.json')
        const relFile = path.relative(FR_ROOT, file)

        if (!fs.existsSync(file)) {
          errors.push(`MANQUANT: ${relFile} (index: ${art.id})`)
          continue
        }

        const data = readJson(file)
        knownArticleIds.add(data.id)

        const mism = []
        if (data.id !== art.id) mism.push(`id: index=${art.id} fichier=${data.id}`)
        if (data.slug !== art.slug) mism.push(`slug: index=${art.slug} fichier=${data.slug}`)
        if (data.title !== art.title) mism.push(`title: index="${art.title}" fichier="${data.title}"`)
        if (data.page !== art.page) mism.push(`page: index=${art.page} fichier=${data.page}`)
        if (mism.length) errors.push(`DESYNC ${relFile} -> ${mism.join(' | ')}`)

        const ids = new Set()
        collectIds(data.blocks, ids)
        for (const id of ids) knownAnchorIds.add(id)

        const texts = []
        collectText(data.blocks, texts)
        allArticleTexts.push({ file: relFile, texts })
      }

      // Orphelins : fichiers .json sur disque, absents de l'index.
      if (fs.existsSync(dir)) {
        const onDisk = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_chapter.json')
        const knownFiles = new Set(chapter.articles.map(a => a.slug + '.json'))
        for (const f of onDisk) {
          if (!knownFiles.has(f)) errors.push(`ORPHELIN: ${path.relative(FR_ROOT, path.join(dir, f))}`)
        }
      } else if (chapter.articles.length) {
        errors.push(`DOSSIER ABSENT: ${path.relative(FR_ROOT, dir)}`)
      }
    }
  }

  // Liens wiki : [[Label|cible]] ou [[Label|cible|page]]. Cible valide si c'est un id d'article,
  // un slug de chapitre, ou un id d'ancre connu (dans n'importe quel article).
  const linkRe = /\[\[[^|\]]+\|([a-z0-9_.-]+)(?:\|\d+)?\]\]/gi
  for (const { file, texts } of allArticleTexts) {
    for (const text of texts) {
      let m
      linkRe.lastIndex = 0
      while ((m = linkRe.exec(text))) {
        const target = m[1]
        if (knownArticleIds.has(target) || knownChapterSlugs.has(target) || knownAnchorIds.has(target)) continue
        errors.push(`LIEN CASSE dans ${file} -> cible inconnue: ${target}`)
      }
    }
  }

  if (errors.length) {
    console.log(errors.join('\n'))
    console.log(`\n--- ${errors.length} erreur(s), ${knownArticleIds.size} articles, ${knownAnchorIds.size} ancres connues ---`)
    process.exit(1)
  }

  console.log(`AUCUNE ERREUR — ${knownArticleIds.size} articles, ${knownAnchorIds.size} ancres connues.`)
  process.exit(0)
}

main()
