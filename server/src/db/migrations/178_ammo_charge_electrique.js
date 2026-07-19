// COM28/PLAN_CAC_BATTERIE.md — munition générique "Charge électrique" pour les armes à batterie sans
// calibre réel (armes de contact à charge + armes étourdissantes/soniques). `caliber` est le seul
// champ de liaison arme/munition dans ce projet (docs/Old/JARMES.md §2.5, "Aucune exception : Toujours
// utiliser caliber") — aucune colonne/FK nouvelle nécessaire, migration de données pure.
//
// Lot A uniquement (19 armes à charge numérique propre) — hors scope volontaire (voir
// docs/PLAN_CAC_BATTERIE.md §2) : armes à durée ("1 heure"/"1h de gaz"), armes de trait (déjà liées à
// Flèche/Carreau), lanceurs (Capsule/disque/filet dédiés), armes à énergie + Poing Kryss (déjà câblés
// via caliber='GP-*', ne pas toucher — domaine distinct, docs/REGLES/REGLEDRONE.md).
const AMMO_NAME  = 'Charge électrique'
const LOT_A_WEAPONS = [
  'Bâton Ordonnateurs', 'Dague moléc. Pulsar', 'Dague neurale Brain', 'Gant choc',
  'Matraque Mao', 'Poing choc', 'Électro-fouet', 'Flex',
  'Canon sonique', 'Canon à infrasons', 'Disrupteur neural', 'Fusil choc Stun',
  'Fusil sonique d’attaque', 'Fusil sonique incap. sirène', 'Gén. d’onde de choc',
  'Modulateur sonique', 'Pistolet choc Stun II', 'Sonar d’attaque', 'Sonar d’attaque directionnel',
]

export const up = async (knex) => {
  // Idempotent : re-jouable sans dupliquer la munition si déjà insérée (patron migration 75).
  const existingAmmo = await knex('ref_equipment').where({ family: 'Munitions', name: AMMO_NAME }).first()
  if (!existingAmmo) {
    await knex('ref_equipment').insert({
      family:     'Munitions',
      category:   'Charges électriques',
      name:       AMMO_NAME,
      caliber:    AMMO_NAME,
      price:      10,
      // tech_level NOT NULL sans défaut — 2 (NT II), aligné sur Matraque Mao et les munitions
      // standard existantes (ex. "9 mm - Munition standard"), valeur la plus représentative parmi
      // les armes du Lot A plutôt qu'une moyenne inventée.
      tech_level: 2,
    })
  }

  const updated = await knex('ref_equipment')
    .where({ family: 'Armes' })
    .whereIn('name', LOT_A_WEAPONS)
    .update({ caliber: AMMO_NAME })

  // Échec net plutôt qu'un état partiel silencieux — noms vérifiés par requête live avant écriture
  // de cette migration (pas de saisie manuelle), un écart signale un catalogue différent de celui
  // audité. Transaction knex par défaut (Postgres) : rollback automatique de l'insert ci-dessus.
  if (updated !== LOT_A_WEAPONS.length) {
    throw new Error(`[migration 178] attendu ${LOT_A_WEAPONS.length} armes mises à jour (Lot A PLAN_CAC_BATTERIE.md), obtenu ${updated} — catalogue ref_equipment différent de celui audité, ne pas ignorer`)
  }
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .where({ family: 'Armes', caliber: AMMO_NAME })
    .whereIn('name', LOT_A_WEAPONS)
    .update({ caliber: null })
  await knex('ref_equipment').where({ family: 'Munitions', name: AMMO_NAME }).delete()
}
