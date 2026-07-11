/**
 * Migration 132 — char_sheet.character_id : dédoublonnage + contrainte UNIQUE
 *
 * char_sheet n'a jamais eu de contrainte d'unicité sur character_id (migration 36). Un bug de
 * double-insertion aujourd'hui disparu du code (startCreation est atomique : 1 transaction, 1 seul
 * insert, character_id toujours neuf) a laissé 9 personnages de "Camp LOCALE" avec 2 lignes
 * char_sheet chacun — cause racine du "token sans fiche de statistiques" en jeu (lecture .first()
 * remontant arbitrairement l'une ou l'autre ligne selon les requêtes).
 *
 * up() : pour chaque character_id en double, garde la ligne char_sheet avec le plus de données
 * réelles (compétences + carrières + mutations + avantages + blessures), tie-break déterministe
 * (updated_at le plus récent, puis created_at le plus ancien, puis id) — règle uniforme, pas un
 * choix au cas par cas (décision Saar 2026-07-11 : données de développement, seule l'architecture
 * compte). Testé en transaction annulée contre les 9 personnages réels avant écriture de cette
 * migration — résultat vérifié ligne par ligne.
 * Les lignes perdantes sont supprimées ; tout leur sous-arbre (char_attributes, char_skills, ...)
 * part avec elles via CASCADE — vérifié par requête information_schema réelle : les 13 tables
 * ayant une FK vers char_sheet.id ont toutes delete_rule='CASCADE', aucune exception.
 * char_inventory/character_macros ne sont PAS affectées (keyées character_id, pas char_sheet_id —
 * partagées entre les anciens doublons, aucune duplication à résoudre pour elles).
 *
 * down() : retire la contrainte UNIQUE uniquement. Ne restaure PAS les lignes dédoublonnées
 * supprimées — irréversible par nature (suppression de données), pas un défaut de cette migration.
 */

export const up = async (knex) => {
  const dupes = await knex('char_sheet')
    .select('character_id')
    .count('id as n')
    .groupBy('character_id')
    .havingRaw('count(id) > 1')

  for (const { character_id } of dupes) {
    const sheets = await knex('char_sheet').where({ character_id })

    const scored = []
    for (const sheet of sheets) {
      const [skills, careers, mutations, advantages, wounds] = await Promise.all([
        knex('char_skills').where({ char_sheet_id: sheet.id }).count('* as n').first(),
        knex('char_careers').where({ char_sheet_id: sheet.id }).count('* as n').first(),
        knex('char_mutations').where({ char_sheet_id: sheet.id }).count('* as n').first(),
        knex('char_advantages').where({ char_sheet_id: sheet.id }).count('* as n').first(),
        knex('character_wounds').where({ char_sheet_id: sheet.id }).count('* as n').first(),
      ])
      const score = Number(skills.n) + Number(careers.n) + Number(mutations.n)
        + Number(advantages.n) + Number(wounds.n)
      scored.push({ sheet, score })
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const byUpdated = new Date(b.sheet.updated_at) - new Date(a.sheet.updated_at)
      if (byUpdated !== 0) return byUpdated
      const byCreated = new Date(a.sheet.created_at) - new Date(b.sheet.created_at)
      if (byCreated !== 0) return byCreated
      return a.sheet.id < b.sheet.id ? -1 : 1
    })

    const [, ...losers] = scored
    for (const loser of losers) {
      await knex('char_sheet').where({ id: loser.sheet.id }).delete()
    }
  }

  await knex.raw('ALTER TABLE char_sheet ADD CONSTRAINT uq_char_sheet_character_id UNIQUE (character_id)')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE char_sheet DROP CONSTRAINT uq_char_sheet_character_id')
}
