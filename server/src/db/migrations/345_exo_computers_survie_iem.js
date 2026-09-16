// 345_exo_computers_survie_iem.js — docs/PLANS/PLAN_INFORMATIQUE.md Lot 3, MANUEL_INFORMATIQUE.md §4.7
//
// Survie I.E.M. : dispositif optionnel qui équipe surtout robots/androïdes/exo-armures (rare sur les
// drones). Après un ÉCHEC au Test de panne contre une IEM, un second jet d'1 dé : pair, la panne est
// finalement évitée ; impair, malus cumulatif de -1 aux actions (-2 si le Test de panne du défenseur
// lui-même a été un échec critique). Chaque activation réduit son niveau de 1 — ressource qui s'use,
// jamais un bonus permanent (contrairement à Blindage IEM, §4.6). D'où deux colonnes distinctes
// (max/current), pas une seule valeur statique — même besoin que integrite_max/integrite_current sur
// cette même table.
//
// Décision de propriétaire (Saar, 2026-09-15, à journaliser docs/JOURNAL8.md) : `exo_computers` reste
// structurellement piloté par le chantier Exo-armures, qui y a déjà ajouté `blindage_iem` (migration
// 42, dans la création de table d'origine) sans jamais le propager à `ref_exo_template_computers` ni
// à `applyExoTemplate` (server/src/lib/exoTemplateService.js:130-148 — vérifié : un ordinateur généré
// depuis un modèle reçoit gen/nt/intégrité, jamais blindage_iem, laissé null, réglable ensuite à la
// main via PUT /:characterId/exo/computers/:computerId). Survie I.E.M. suit exactement le même
// chemin : colonnes nullables sur exo_computers, absentes du template, réglables à la main — le
// chantier Informatique ajoute la donnée, le chantier Exo-armures reste propriétaire du schéma de la
// table, aucun des deux ne duplique l'autre.
//
// Additive pure, patron identique à 329_ref_equipment_integrity.js (ADD COLUMN IF NOT EXISTS,
// idempotent, down() = DROP). Aucune contrainte CHECK current<=max : la table ne le fait déjà pas
// pour integrite_max/integrite_current (139_exo_computers_constraints.js), cohérence délibérée avec
// l'existant plutôt qu'un durcissement isolé sur la seule colonne neuve.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE exo_computers ADD COLUMN IF NOT EXISTS survie_iem_max integer')
  await knex.raw('ALTER TABLE exo_computers ADD COLUMN IF NOT EXISTS survie_iem_current integer')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE exo_computers DROP COLUMN IF EXISTS survie_iem_current')
  await knex.raw('ALTER TABLE exo_computers DROP COLUMN IF EXISTS survie_iem_max')
}
