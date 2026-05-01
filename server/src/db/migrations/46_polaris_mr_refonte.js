/**
 * Migration 46 — Refonte table polaris_mr selon LdB Polaris p.209
 *
 * Renomme la colonne `dmax` en `modifier` (modificateur officiel LdB).
 * Reseed complet avec les 20 paliers officiels (réussite + échec).
 *
 * Formule de calcul dans le code :
 *   modifier = getModifier(mrTable, mr)   // lecture table
 *   dmax = isSuccess ? modifier + 1 : 0   // cases de déplacement max
 *
 * MR 1-2 "De justesse" → modifier=0 → dmax=1 (toute réussite = au moins 1 case)
 * MR négative → isSuccess=false → dmax=0 (modifier stocké pour info uniquement)
 *
 * ⚠ SR obligatoire après migration — vide le cache MR_TABLE en mémoire.
 */

export const up = async (knex) => {
  // Renommer la colonne
  await knex.schema.alterTable('polaris_mr', (table) => {
    table.renameColumn('dmax', 'modifier')
  })

  // Reseed complet — table LdB officielle p.209
  await knex('polaris_mr').truncate()

  await knex('polaris_mr').insert([
    // ── Réussites (mr >= 0) ─────────────────────────────────────────────────
    { mr_min:   0, mr_max:   2, modifier:  0 },  // De justesse
    { mr_min:   3, mr_max:   4, modifier:  1 },  // Correct
    { mr_min:   5, mr_max:   6, modifier:  2 },  // Assez bon
    { mr_min:   7, mr_max:   9, modifier:  3 },  // Bon
    { mr_min:  10, mr_max:  12, modifier:  4 },  // Très bon
    { mr_min:  13, mr_max:  14, modifier:  5 },  // Excellent
    { mr_min:  15, mr_max:  19, modifier:  6 },  // Parfait
    { mr_min:  20, mr_max:  24, modifier:  7 },  // Extraordinaire
    { mr_min:  25, mr_max:  34, modifier:  8 },  // Héroïque
    { mr_min:  35, mr_max: null, modifier: 9 },  // Légendaire

    // ── Échecs (mr < 0) — modifier informatif, dmax=0 dans le code ─────────
    { mr_min:  -2, mr_max:  -1, modifier:  0 },  // De justesse (échec)
    { mr_min:  -4, mr_max:  -3, modifier: -1 },  // Médiocre
    { mr_min:  -6, mr_max:  -5, modifier: -2 },  // Assez mauvais
    { mr_min:  -9, mr_max:  -7, modifier: -3 },  // Mauvais
    { mr_min: -12, mr_max: -10, modifier: -4 },  // Très mauvais
    { mr_min: -14, mr_max: -13, modifier: -5 },  // Exécrable
    { mr_min: -19, mr_max: -15, modifier: -6 },  // Catastrophique
    { mr_min: -24, mr_max: -20, modifier: -7 },
    { mr_min: -34, mr_max: -25, modifier: -8 },
    { mr_min: -999, mr_max: -35, modifier: -9 }, // Légendaire (échec) — sentinelle
  ])
}

export const down = async (knex) => {
  // Restaurer les 6 lignes originales (migration 45)
  await knex('polaris_mr').truncate()

  await knex('polaris_mr').insert([
    { mr_min: -999, mr_max:   -1, modifier: 0 },
    { mr_min:    0, mr_max:    4, modifier: 1 },
    { mr_min:    5, mr_max:    9, modifier: 2 },
    { mr_min:   10, mr_max:   14, modifier: 3 },
    { mr_min:   15, mr_max:   24, modifier: 4 },
    { mr_min:   25, mr_max: null, modifier: 5 },
  ])

  // Renommer la colonne
  await knex.schema.alterTable('polaris_mr', (table) => {
    table.renameColumn('modifier', 'dmax')
  })
}
