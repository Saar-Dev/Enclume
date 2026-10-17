// 000_baseline.js — Migration de référence unique (squash du 2026-10-17).
// L'état complet (schéma + données de référence) vit dans 000_baseline.sql,
// généré mécaniquement par tools/squash/run-squash.mjs. NE JAMAIS éditer le .sql
// à la main : les évolutions vont dans de NOUVELLES migrations (001_, 002_...).
// Les migrations historiques sont archivées dans ../migrations-archive/.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sqlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '000_baseline.sql')

export const up = async (knex) => {
  if (!fs.existsSync(sqlPath)) {
    throw new Error('000_baseline.sql introuvable — le générer avec : node tools/squash/run-squash.mjs')
  }
  const raw = fs.readFileSync(sqlPath, 'utf8')
  // pg_dump >= 16 émet des méta-commandes psql (\restrict, \unrestrict...) : on les retire.
  const sql = raw.split('\n').filter((line) => !/^\s*\\/.test(line)).join('\n')
  await knex.raw(sql)
}

export const down = async () => {
  throw new Error('Le down de la baseline n\'est pas fourni — retour arrière via Git (branche d\'avant le squash).')
}
