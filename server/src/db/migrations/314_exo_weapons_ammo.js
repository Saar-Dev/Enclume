// 314_exo_weapons_ammo.js — PLAN_EXOARMURE.md §16.2.3
//
// L'armement exo suit des munitions (REGLEARMURE.md:1410-1424, table ARMEMENT, colonne « Mun.
// (Coût) »). Le catalogue porte déjà cette donnée (ref_equipment.ammo_count, déjà jointe via
// exo_weapons.ref_equipment_id) mais exo_weapons n'a aucune colonne d'état runtime — contrairement à
// char_inventory.ammo_remaining (15_char_inventory.js). Colonne additive, mirroir exact de cette
// dernière : nullable, NULL = jamais chargée (même convention que weaponAmmoStatus/hasEnoughAmmo,
// shared/ammoRules.js, réutilisées telles quelles pour l'exo plutôt que réimplémentées).
//
// Rechargement (mapActions.reload) pour une arme exo : hors périmètre de cette migration, prévu en
// Étape B (§16.4) — ce fichier ne fait qu'ajouter la colonne, sans changer aucun code consommateur.

export const up = async (knex) => {
  await knex.schema.alterTable('exo_weapons', (t) => {
    t.integer('ammo_remaining')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('exo_weapons', (t) => {
    t.dropColumn('ammo_remaining')
  })
}
