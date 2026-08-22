// Migration 70 — Initialise ammo_remaining pour les armes à feu déjà équipées en slot main
// Corrige le gap structurel de Sprint 7.5 (migration 60) : la colonne ammo_remaining
// était créée NULL par défaut et n'était initialisée qu'au premier rechargement manuel.
// Toute arme équipée sans rechargement préalable restait à NULL → bouton assaut bloqué.
// Ce backfill s'applique uniquement aux armes à feu (caliber IS NOT NULL) avec ammo_count parseable.
export const up = async (knex) => {
  await knex.raw(`
    UPDATE char_inventory ci
    SET    ammo_remaining = CAST(SUBSTRING(re.ammo_count FROM '[0-9]+') AS INTEGER)
    FROM   ref_equipment re
    WHERE  ci.equipment_id  = re.id
      AND  ci.slot          IN ('MG', 'MD', '2M', 'Tr')
      AND  ci.ammo_remaining IS NULL
      AND  re.caliber       IS NOT NULL
      AND  re.ammo_count    IS NOT NULL
      AND  re.ammo_count    ~ '[0-9]+'
  `)
}

// Migration data-only : impossible de distinguer les valeurs initialisées ici
// des valeurs issues de rechargements légitimes — rollback non réversible sans perte.
export const down = async (_knex) => {}
