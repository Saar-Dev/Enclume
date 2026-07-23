// Migration 198 — correctif d'une donnée déjà en production (Lot 6, PLAN_WIZARD_AVANTAGES_IMPLANTATION.md
// §5quater). La migration 188 appliquait le résultat 4 de chasseur_primes ("Grande société", Limier)
// de façon INCONDITIONNELLE (+20% revenus, +4 Célébrité, +4 pts de compétence). Le plan a depuis
// tranché (2026-07-22) que ce résultat est un choix accepte/refuse — comme Médecin/4, Mercenaire/4 —
// jamais appliqué automatiquement. Trouvé en relisant le RAW ligne par ligne pendant le peuplement
// des 36 autres métiers (le résumé "effet en clair" avait déjà la bonne version, la migration 188,
// écrite avant cette correction, ne l'avait jamais reçue).
//
// Isolé dans sa propre migration (jamais mélangé au peuplement neuf, migration 196) : c'est un
// correctif sur une carrière déjà mécanisée en production, pas une nouvelle donnée.

const OLD_EFFECTS = [{ type: 'income_percent', value: 20 }, { type: 'celebrity', value: 4 }, { type: 'skill_points', value: 4 }]
const NEW_EFFECTS = [{
  type: 'choice',
  key: 'chasseur_primes_grande_societe',
  options: [
    { label: 'Accepter', effects: [{ type: 'income_percent', value: 20 }, { type: 'celebrity', value: 4 }, { type: 'skill_points', value: 4 }] },
    { label: 'Refuser', effects: [{ type: 'narrative', key: 'chasseur_primes.grande_societe_refuse' }] },
  ],
}]

export async function up(knex) {
  const career = await knex('ref_careers').where({ code: 'chasseur_primes' }).first('id')
  if (!career) throw new Error('Carrière inconnue : chasseur_primes')
  const updated = await knex('ref_career_random_benefits')
    .where({ career_id: career.id, roll: 4 })
    .update({ effects: JSON.stringify(NEW_EFFECTS) })
  if (updated !== 1) throw new Error(`chasseur_primes roll=4 introuvable ou dupliqué (${updated} ligne(s))`)
}

export async function down(knex) {
  const career = await knex('ref_careers').where({ code: 'chasseur_primes' }).first('id')
  if (career) {
    await knex('ref_career_random_benefits')
      .where({ career_id: career.id, roll: 4 })
      .update({ effects: JSON.stringify(OLD_EFFECTS) })
  }
}
