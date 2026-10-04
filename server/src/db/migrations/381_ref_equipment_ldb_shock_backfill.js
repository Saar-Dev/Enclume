// 381_ref_equipment_ldb_shock_backfill.js — ARMOR-STATS-DISPLAY-INCOMPLETE
//
// 7 armures du Livre de Base ont une valeur de Résistance au choc (`protection_shock`) définie dans
// le livre (table « Armures simples & boucliers », p.314 — colonne « Choc* : Protection contre les
// Dommages additionnels de Choc ») mais jamais saisie à l'import initial — colonne restée à NULL
// depuis toujours, donc l'affichage client (LocationPanel.jsx) ne l'a jamais montrée (pas un bug
// d'affichage : une vraie absence de donnée RAW, vérifiée page par page contre le texte du livre,
// triple clé Protection + Catégorie de malus + Localisation pour chaque ligne avant d'écrire ce
// fichier). Les autres armures du Livre de Base ont bien 0 au choc dans le livre (Vêtements épais,
// Protection en cuir, Armure hydratante, boucliers…) — rien à corriger sur elles.
//
// Matché par `name` (clé métier), jamais par `id` (rules/core.md SEED-ID-DETERM).

const SHOCK_VALUES = {
  'Armure de sécurité Alpha': 6,
  'Armure de sécurité Bêta': 8,
  'Armure de sécurité Oméga': 10,
  'Protection en kevlar': 4,
  'Protection en fibres polytitane': 5,
  'Protection matelassée': 7,
  'Robe des Ordonnateurs': 2,
}

export const up = async (knex) => {
  for (const [name, protectionShock] of Object.entries(SHOCK_VALUES)) {
    await knex('ref_equipment')
      .where({ name, protection_shock: null })
      .update({ protection_shock: protectionShock })
  }
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .whereIn('name', Object.keys(SHOCK_VALUES))
    .update({ protection_shock: null })
}
