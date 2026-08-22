// 118_fix_ref_mutations_organe_sensoriel_manquant.js — Correction cost_pc vs LdB (REGLE_CREATION.txt:834-850)
// Seed 95 mal transcrit : smell/touch à 0 (au lieu de 1), hearing à 1 (au lieu de 2), sight à 2 (au lieu de 3).
// taste reste à 0 (correct, "Neutre" dans la rulebook) — non touché.

const FIXES = [
  { subtype: 'smell', to: 1, from: 0 },
  { subtype: 'touch', to: 1, from: 0 },
  { subtype: 'hearing', to: 2, from: 1 },
  { subtype: 'sight', to: 3, from: 2 },
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
