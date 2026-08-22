// Migration 200 — correctif d'une donnée déjà en production (Lot 6, PLAN_WIZARD_AVANTAGES_IMPLANTATION.md
// §5quater). La migration 196 avait peuplé le résultat 3 de pirate ("Butin") avec seulement le
// money_reward (100 x 1D10 sols), en oubliant Célébrité +2 et Matériel +2 pourtant explicites dans le
// RAW ("100 x 1D10 sols supplémentaires, Célébrité +2, Matériel +2") — trouvé lors d'une 2e passe
// critique dédiée qui a revérifié chaque ligne à mécanisme spécial (money_reward/celebrity_reward/
// grant_mutation/add_skill) contre le texte RAW plutôt que contre le résumé "effet en clair".
//
// Isolé dans sa propre migration (jamais mélangé au peuplement neuf, migration 196) : c'est un
// correctif sur une carrière déjà mécanisée en production, pas une nouvelle donnée — même principe
// que la migration 198 (chasseur_primes).

const OLD_EFFECTS = [{ type: 'money_reward', die: '1d10', multiplier: 100 }]
const NEW_EFFECTS = [
  { type: 'money_reward', die: '1d10', multiplier: 100 },
  { type: 'celebrity', value: 2 },
  { type: 'category', target: 'Matériel', value: 2 },
]

export async function up(knex) {
  const career = await knex('ref_careers').where({ code: 'pirate' }).first('id')
  if (!career) throw new Error('Carrière inconnue : pirate')
  const updated = await knex('ref_career_random_benefits')
    .where({ career_id: career.id, roll: 3 })
    .update({ effects: JSON.stringify(NEW_EFFECTS) })
  if (updated !== 1) throw new Error(`pirate roll=3 introuvable ou dupliqué (${updated} ligne(s))`)
}

export async function down(knex) {
  const career = await knex('ref_careers').where({ code: 'pirate' }).first('id')
  if (career) {
    await knex('ref_career_random_benefits')
      .where({ career_id: career.id, roll: 3 })
      .update({ effects: JSON.stringify(OLD_EFFECTS) })
  }
}
