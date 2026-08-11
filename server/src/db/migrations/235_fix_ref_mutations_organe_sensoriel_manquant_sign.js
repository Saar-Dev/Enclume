// 235_fix_ref_mutations_organe_sensoriel_manquant_sign.js
// Bug #2 (docs/BUG WIZARD.md) — la migration 118 avait corrigé les montants (1/1/2/3) d'après la
// table RAW (docs/REGLES/REGLE_CREATION.md:834-850, colonne "Désavantage" = PC RAPPORTÉS au joueur
// qui choisit délibérément cette mutation désavantageuse), mais avait gardé le signe positif :
// la mutation coûtait encore des PC au lieu d'en rapporter. cost_pc négatif = la mutation rapporte
// des PC (convention déjà utilisée par Purulence, cost_pc: -2, seed 95_seed_ref_mutations.js:176).
// taste (Papilles gustatives) reste à 0 : "Neutre" dans les deux colonnes RAW, non touché.

const FIXES = [
  { subtype: 'smell', to: -1, from: 1 },
  { subtype: 'touch', to: -1, from: 1 },
  { subtype: 'hearing', to: -2, from: 2 },
  { subtype: 'sight', to: -3, from: 3 },
]

export const up = async (knex) => {
  for (const { subtype, to } of FIXES) {
    await knex('ref_mutations')
      .where({ name: 'Organe sensoriel manquant', subtype })
      .update({ cost_pc: to })
  }
}

export const down = async (knex) => {
  for (const { subtype, from } of FIXES) {
    await knex('ref_mutations')
      .where({ name: 'Organe sensoriel manquant', subtype })
      .update({ cost_pc: from })
  }
}
