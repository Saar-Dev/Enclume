// 353_exo_computers_sequelle_malus.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 3b
//
// Survie I.E.M. (MANUEL_INFORMATIQUE.md §4.7) étape 3 : un redémarrage réussi peut repartir avec
// une séquelle — « malus cumulatif de −1, porté à −2 si [...] échec critique ». RAW ne donne
// aucune condition d'effacement : c'est une propriété de l'ordinateur (comme `blindage_iem`,
// `survie_iem_current`), pas un état de combat temporaire — vit sur `exo_computers`, jamais sur
// `token_statuses` (qui porte l'immobilisation, elle bien temporaire, cf. Lot 3b).
//
// NOT NULL DEFAULT 0 (jamais NULL — un ordinateur neuf n'a simplement subi aucune séquelle encore,
// contrairement à `integrite_current`/`survie_iem_current` qui restent nullables — pas la même
// sémantique : ceux-là encodent "dispositif non réglé/absent", `sequelle_malus` encode "aucun
// dommage cumulé", 0 est une vraie valeur par défaut, pas une absence de donnée).

export const up = async (knex) => {
  await knex.raw('ALTER TABLE exo_computers ADD COLUMN IF NOT EXISTS sequelle_malus integer NOT NULL DEFAULT 0')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE exo_computers DROP COLUMN IF EXISTS sequelle_malus')
}
