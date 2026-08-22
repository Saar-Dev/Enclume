import assert from 'node:assert/strict'

// Les tests de migration de ce dossier tournent normalement dans une transaction annulée (up()/down()
// rejoués), guardés par `alreadyApplied` : si la migration a déjà tourné en dev (nodemon l'applique
// dès l'écriture du fichier, cf. docs/SYSTEME/CORE.md P53), le test s'arrête sans rien vérifier — un
// faux vert. Ces trois fonctions font l'inverse : elles lisent l'état réel de la base, sans passer
// par up()/down(), et tournent donc TOUJOURS (seul `!process.env.DATABASE_URL` peut les sauter).
// Elles ne remplacent pas le test transactionnel (qui vérifie aussi le comportement — défauts,
// cascades, rollback) : elles vérifient qu'aucune dérive n'est apparue entre le fichier de migration
// et le schéma réellement déployé (cf. SCHEMADRIFT-EXOTEMPLATES1, docs/JOURNAL8.md 2026-08-12).
//
// Vit dans un sous-dossier (pas directement dans migrations/) : NaturalMigrationSource
// (../naturalMigrationSource.cjs) traite tout fichier .js/.mjs/.cjs du dossier migrations/ comme une
// migration candidate (seul `*.test.mjs` est exclu) — un helper posé directement à la racine casse
// `knex migrate:latest` ("must have both an up and down function"). readdir() n'étant pas récursif,
// un sous-dossier n'est jamais listé comme fichier de migration.

export async function assertTableExists(db, table) {
  assert.equal(
    await db.schema.hasTable(table),
    true,
    `table ${table} absente en base — dérive entre le fichier de migration et le schéma réel`,
  )
}

export async function assertColumnsExist(db, table, columns) {
  for (const column of columns) {
    assert.equal(
      await db.schema.hasColumn(table, column),
      true,
      `${table}.${column} absente en base — dérive entre le fichier de migration et le schéma réel`,
    )
  }
}

export async function assertConstraintExists(db, table, constraint) {
  const { rows } = await db.raw(
    'SELECT 1 FROM pg_constraint WHERE conrelid = ?::regclass AND conname = ?',
    [table, constraint],
  )
  assert.equal(
    rows.length,
    1,
    `contrainte ${constraint} absente sur ${table} — dérive entre le fichier de migration et le schéma réel`,
  )
}

// expectedDefault : null pour "aucun défaut", sinon l'expression SQL exacte telle que Postgres la
// renvoie (ex. "'[]'::jsonb", vérifiée via information_schema.columns.column_default) — jamais une
// valeur JS convertie, la représentation Postgres est la seule source fiable (cf. SCHEMADRIFT-
// BATTLEMAPSVOXEL1, docs/JOURNAL8.md 2026-08-19).
export async function assertColumnDefault(db, table, column, expectedDefault) {
  const { rows } = await db.raw(
    `SELECT column_default FROM information_schema.columns WHERE table_name = ? AND column_name = ?`,
    [table, column],
  )
  assert.equal(
    rows[0]?.column_default ?? null,
    expectedDefault,
    `défaut de ${table}.${column} ne correspond pas — dérive entre le fichier de migration et le schéma réel`,
  )
}
