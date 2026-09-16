// 349_ref_equipment_electronic_has_integrity.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 2, trouvaille
// en jeu réel (test Saar 2026-09-16, Jumelles/Baboulinet)
//
// Trou de conception entre deux chantiers : `is_electronic` (Lot 1, ce chantier, migration 346) et
// `has_integrity` (chantier Usure, migration 329) sont deux flags indépendants sur `ref_equipment`,
// avec des critères de curation distincts et jamais réconciliés. Or le Test de panne déclenché par
// IEM (Lot 2) est « même mécanique que tout Test de panne » (MANUEL_INFORMATIQUE.md §4.5) — il lui
// faut une Intégrité à faire baisser. Un objet `is_electronic=true` sans `has_integrity=true` ne peut
// jamais être testé : sur les 89 lignes `is_electronic=true`, seules 36 avaient aussi
// `has_integrity=true` avant cette migration (vérifié par requête directe 2026-09-16, ex. Jumelles :
// tech_level 3, sous le seuil ≥4 du backfill générique de 329, jamais couvert).
//
// **Décision Saar 2026-09-16 : Option 1, on suit le RAW** — tout objet électronique doit pouvoir
// être suivi en Intégrité, sans exception de tech_level. `has_integrity = true` pour les 53 lignes
// `is_electronic = true` qui ne l'avaient pas encore ; `quality = 'bonne_qualite'` pour les lignes
// nouvellement basculées sans qualité déjà posée (même valeur par défaut, même justification RAW —
// « les valeurs d'ITG de référence correspondent à de la bonne qualité » — que la migration 329,
// qu'on étend ici plutôt que dupliquer).
//
// Effet de bord RAW-cohérent et volontaire, à assumer : ces 53 objets deviennent aussi soumis à
// l'Usure NORMALE (pas seulement l'IEM) — ils n'étaient pas suivis du tout auparavant. C'est la
// conséquence directe de « on suit le RAW » : un objet réellement électronique n'a aucune raison
// d'être plus increvable qu'une arme ou une protection NT≥II déjà suivie.
//
// **Aucun backfill `char_inventory`** — même décision D1 que la migration 330 (chantier Usure) :
// les instances déjà en jeu (ex. les Jumelles de Baboulinet) gardent `integrity_current = NULL`
// jusqu'à un geste MJ explicite (« Lancer ITG occasion », ou édition manuelle). Cette migration ne
// touche que le catalogue (`ref_equipment`), jamais les lignes `char_inventory` existantes.
//
// Idempotent : les deux UPDATE sont gardés (`WHERE has_integrity = false` / `WHERE quality IS
// NULL`), un second `up()` ne réécrit rien. `down()` : non réversible proprement au niveau des
// données (impossible de distinguer après coup les 36 lignes déjà `true` avant cette migration des
// 53 nouvellement basculées, sans un instantané externe) — même limite déjà acceptée par 329, qui ne
// revient pas non plus sur son propre backfill. `down()` ne fait rien de plus que documenter cette
// limite (pas de colonne ajoutée ici à `DROP`).

export const up = async (knex) => {
  const { rowCount: nHasIntegrity } = await knex.raw(`
    UPDATE ref_equipment SET has_integrity = true
    WHERE has_integrity = false AND is_electronic = true
  `)
  const { rowCount: nQuality } = await knex.raw(`
    UPDATE ref_equipment SET quality = 'bonne_qualite' WHERE has_integrity = true AND quality IS NULL
  `)
  console.log(`[349_ref_equipment_electronic_has_integrity] has_integrity +${nHasIntegrity} ligne(s) (is_electronic) ; quality='bonne_qualite' +${nQuality} ligne(s)`)
}

export const down = async (knex) => {
  // Non réversible proprement au niveau des données (cf. commentaire ci-dessus) — no-op documenté,
  // même limite que 329.
}
