/**
 * Migration 260 — troisième branche `ref_equipment_id` sur exo_systems/exo_weapons/
 * ref_exo_template_equipment (PLAN_EXOARMURE.md §13.4.4, révision 2026-08-21 suite)
 *
 * Préparatoire à la transcription des loadouts RAW des 16 armures — trouvé en la préparant, pas un
 * sous-produit du reste du Lot C. Constat : la moitié des lignes "Systèmes auxiliaires"/"Armement" des
 * fiches RAW (`docs/REGLES/SEEDEXO.md`) ne sont pas des systèmes propres aux armures (déjà couverts par
 * `ref_exo_equipment`, migration 253) mais des armes/senseurs génériques du chapitre "Équipement"
 * général (dagues, pistolets, mitrailleuses, sonscans, radars...). Le schéma de la migration 257 ne
 * permettait de lier `equipment_id` qu'à `ref_exo_equipment` — aucune FK possible vers `ref_equipment`
 * pour ces lignes, seul `label_override` (texte libre) restait disponible, sans plafond structurel
 * pour un futur cas où une correspondance précise serait identifiée.
 *
 * Pattern retenu — **exclusive arc** (une FK nullable par catalogue cible possible + CHECK garantissant
 * qu'une seule est renseignée), recherché et sourcé avant d'écrire ce fichier plutôt qu'inventé sur
 * place : https://github.com/binkley/exclusive-arc-sql-example,
 * https://waymondo.com/posts/are-exclusive-arcs-evil/. Alternative rejetée : association polymorphique
 * façon Rails (colonne `type` + `id` unique, sans vraie FK) — casserait l'intégrité référentielle que
 * PostgreSQL vérifie déjà partout ailleurs dans ce projet (`exo_systems.equipment_id`,
 * `drone_weapons.equipment_id`, `exo_programs.equipment_id` sont tous de vraies FK).
 *
 * Cohérent avec un précédent déjà présent dans ce même schéma : `exo_programs.equipment_id` référence
 * déjà `ref_equipment` (catalogue Logiciels) depuis la migration 257 — seuls `exo_systems`/
 * `exo_weapons`/`ref_exo_template_equipment` en étaient restés à une seule branche possible. Cette
 * migration aligne les trois tables sur le même principe que `exo_programs` porte déjà, au lieu de
 * laisser l'incohérence.
 *
 * Le CHECK `equipment_id IS NOT NULL OR label_override IS NOT NULL` de la migration 257 était en outre
 * une faille latente indépendante de ce Lot : un `OR` n'empêche pas les deux d'être renseignés à la
 * fois. Resserré ici en une vraie exclusivité (somme des trois branches non-NULL = 1) à l'occasion de
 * l'ajout de la troisième branche, plutôt que de l'ajouter par-dessus une contrainte déjà lâche.
 *
 * Ne touche pas `exo_programs` (déjà correctement câblé sur `ref_equipment` seul, rien à changer) ni
 * `exo_computers`/`ref_exo_template_computers` (gen/nt scalaires, aucune notion d'equipment_id).
 */

const ALTERED_TABLES = ['exo_systems', 'exo_weapons', 'ref_exo_template_equipment']

const OLD_CHECK_NAMES = {
  exo_systems: 'chk_exo_systems_source',
  exo_weapons: 'chk_exo_weapons_source',
  ref_exo_template_equipment: 'chk_exo_template_equipment_source',
}

export const up = async (knex) => {
  for (const table of ALTERED_TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.uuid('ref_equipment_id').references('id').inTable('ref_equipment').onDelete('RESTRICT')
    })
  }

  for (const table of ALTERED_TABLES) {
    const oldCheck = OLD_CHECK_NAMES[table]
    await knex.raw(`
      ALTER TABLE ${table}
        DROP CONSTRAINT ${oldCheck},
        ADD CONSTRAINT ${oldCheck} CHECK (
          (equipment_id IS NOT NULL)::int
          + (ref_equipment_id IS NOT NULL)::int
          + (label_override IS NOT NULL)::int
          = 1
        );
    `)
  }
}

export const down = async (knex) => {
  for (const table of ALTERED_TABLES) {
    const oldCheck = OLD_CHECK_NAMES[table]
    await knex.raw(`
      ALTER TABLE ${table}
        DROP CONSTRAINT ${oldCheck},
        ADD CONSTRAINT ${oldCheck} CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL);
    `)
  }

  for (const table of ALTERED_TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('ref_equipment_id')
    })
  }
}
