// 329_ref_equipment_integrity.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L0 §2.1
//
// Le catalogue de référence porte désormais l'éligibilité d'un MODÈLE d'équipement aux règles
// d'Intégrité (`has_integrity`) et son niveau de qualité (`quality` → ITG max, formule d'occasion).
// Autorité de logique de jeu : docs/MANUELS/MANUEL_USURE.md v1.5 — §2.3 (`has_integrity` défaut OFF,
// activation ciblée), §3.1 (qualité ↔ ITG max). Aucune règle ici : la migration pose la donnée et
// un backfill de curation par défaut (validé Saar 2026-09-09).
//
// Backfill — matché par clé métier (`family` / `category` / `tech_level`), jamais par `id`
// (SEED-ID-DETERM, rules/core.md ; P55). Passe `has_integrity = true` pour :
//   - armes NT ≥ II  (exclut les ~35 armes NT I : silex, gourdins, arcs primitifs…) ;
//   - protections NT ≥ II  (exclut cuir / vêtements épais primitifs) ;
//   - ORDINATEURS : family « Équipement informatique et logiciels » ET `category = 'Ordinateur'`.
//     Le `tech_level` de cette famille vaut uniformément 1 dans le seed — il n'encode PAS le NT :
//     on cible donc la catégorie « matériel », jamais les « Programmes » (du logiciel, pas d'ITG
//     physique). [écart assumé vs. la formule NT du plan §2.1, tranché avec Saar 2026-09-09]
//   - tout objet NT ≥ IV hors consommables / logiciels / quotidien / exo (matériel rare).
// `quality = 'bonne_qualite'` pour toute ligne passée à `has_integrity` : le RAW indique que les
// valeurs d'ITG de référence correspondent à de la « bonne qualité » (MANUEL_USURE.md §3.1). Le MJ
// / le catalogue Marchand affinent ensuite.
//
// Idempotent : `ADD COLUMN IF NOT EXISTS` + CHECK gardée par `IF NOT EXISTS` + les `UPDATE` gardés
// (`WHERE has_integrity = false` / `WHERE quality IS NULL`). Un second `up()` (P53 : nodemon
// réapplique à l'écriture ; P54) ne réécrit rien et NE CASSE PAS une bascule MJ ultérieure. `down()`
// = `DROP` — rétro-compatible : aucun code ne lit encore ces colonnes (vérifié 2026-09-09).

const QUALITY_VALUES = ['bas_cout', 'bon_marche', 'standard', 'bonne_qualite', 'excellente']

// Familles dont l'absence signalerait un seed divergent — on préfère un throw explicite à un
// backfill silencieusement faux (P55 : auditer par clé naturelle).
const EXPECTED_FAMILIES = [
  'Armes', 'Protections', 'Équipement informatique et logiciels',
  'Munitions', 'Logiciels', 'Vie quotidienne', 'Exo-systeme', 'Exo-arme',
]

export const up = async (knex) => {
  await knex.raw('ALTER TABLE ref_equipment ADD COLUMN IF NOT EXISTS has_integrity boolean NOT NULL DEFAULT false')
  await knex.raw('ALTER TABLE ref_equipment ADD COLUMN IF NOT EXISTS quality text')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ref_equipment_quality') THEN
        ALTER TABLE ref_equipment ADD CONSTRAINT chk_ref_equipment_quality
          CHECK (quality IS NULL OR quality IN (${QUALITY_VALUES.map((v) => `'${v}'`).join(', ')}));
      END IF;
    END $$;
  `)

  // Garde de structure : le seed a-t-il bougé sous nos pieds ?
  const families = await knex('ref_equipment').distinct('family').pluck('family')
  for (const f of EXPECTED_FAMILIES) {
    if (!families.includes(f)) {
      throw new Error(`329 backfill : family attendue absente du catalogue : "${f}" — seed divergent, vérifier le WHERE avant de figer`)
    }
  }
  const { rows: [{ n: nbOrdinateur }] } = await knex.raw(
    `SELECT count(*)::int AS n FROM ref_equipment WHERE family = 'Équipement informatique et logiciels' AND category = 'Ordinateur'`,
  )
  if (nbOrdinateur === 0) {
    throw new Error("329 backfill : aucune ligne category = 'Ordinateur' dans « Équipement informatique et logiciels » — catégorie renommée ?")
  }

  const { rowCount: nbIntegrity } = await knex.raw(`
    UPDATE ref_equipment SET has_integrity = true
    WHERE has_integrity = false AND (
      (family IN ('Armes', 'Protections') AND (tech_level IS NULL OR tech_level >= 2))
      OR (family = 'Équipement informatique et logiciels' AND category = 'Ordinateur')
      OR (tech_level >= 4 AND family NOT IN
          ('Munitions', 'Logiciels', 'Vie quotidienne', 'Exo-systeme', 'Exo-arme', 'Équipement informatique et logiciels'))
    )
  `)
  const { rowCount: nbQuality } = await knex.raw(
    `UPDATE ref_equipment SET quality = 'bonne_qualite' WHERE has_integrity = true AND quality IS NULL`,
  )

  // feedback_logging : serveur bavard, on trace le résultat d'un backfill de contenu.
  console.log(`[329_ref_equipment_integrity] has_integrity +${nbIntegrity} ligne(s) ; quality='bonne_qualite' +${nbQuality} ligne(s)`)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE ref_equipment DROP CONSTRAINT IF EXISTS chk_ref_equipment_quality')
  await knex.raw('ALTER TABLE ref_equipment DROP COLUMN IF EXISTS quality')
  await knex.raw('ALTER TABLE ref_equipment DROP COLUMN IF EXISTS has_integrity')
}
