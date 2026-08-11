// 238_ref_mutations_parasite_subtable.js
// Bug #12 (docs/BUG WIZARD.md) — « Le personnage abrite 1D4 parasites » (REGLE_MUTATION.md:179) :
// aucun jet n'existait pour déterminer ce nombre, ni côté aléatoire ni côté achat délibéré.
//
// Plutôt qu'un champ ad hoc + un cas spécial mutation_id dans Step3Mutations.jsx (solution proposée
// par le doc), on réutilise le mécanisme sous-type déjà en place pour "Caractère génétique animal"
// (mutation_id 6, même construction RAW "Lancez 1D4" — REGLE_MUTATION.md:32) : rollOneMutation
// (Step3Mutations.jsx) pioche déjà uniformément dans mut.subtable quand has_subtable=true, et
// getStep3State/le rendu Récap (WizardReview.jsx) affichent déjà rms.name sans aucun code
// spécifique à une mutation. Aucune modification de code client ou serveur n'est donc nécessaire —
// seule la donnée de référence manquait.
//
// mod_* laissés à 0 (comme le parent ref_mutations.28, cf. audit) : les effets mécaniques du nombre
// de parasites (résistance dommages -1/2, attaque hebdo, CON -1/2 au retrait, mutation bonus par
// parasite) restent non câblés — dette déjà trackée EN_COURS.md MUT3 Lot 7, hors périmètre ici.

const SUBTYPES = [
  { d4_roll: 1, name: '1 parasite', description: 'Le personnage abrite 1 parasite.' },
  { d4_roll: 2, name: '2 parasites', description: 'Le personnage abrite 2 parasites.' },
  { d4_roll: 3, name: '3 parasites', description: 'Le personnage abrite 3 parasites.' },
  { d4_roll: 4, name: '4 parasites', description: 'Le personnage abrite 4 parasites.' },
]

export const up = async (knex) => {
  const parasite = await knex('ref_mutations').where({ name: 'Parasite' }).first()
  if (!parasite) throw new Error('Migration 238 : ref_mutations "Parasite" introuvable')

  await knex('ref_mutations').where({ mutation_id: parasite.mutation_id }).update({ has_subtable: true })
  await knex('ref_mutation_subtypes').insert(
    SUBTYPES.map(s => ({ mutation_id: parasite.mutation_id, ...s }))
  )
}

export const down = async (knex) => {
  const parasite = await knex('ref_mutations').where({ name: 'Parasite' }).first()
  if (!parasite) return

  await knex('ref_mutation_subtypes')
    .where({ mutation_id: parasite.mutation_id })
    .whereIn('d4_roll', SUBTYPES.map(s => s.d4_roll))
    .del()
  await knex('ref_mutations').where({ mutation_id: parasite.mutation_id }).update({ has_subtable: false })
}
