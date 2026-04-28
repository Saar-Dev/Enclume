/**
 * Migration 44 — Correction encodage ref_skills
 *
 * Corrige les labels et familles corrompus (encodage UTF-8 cassé au seed).
 * 12 lignes concernées dans ref_skills.
 *
 * Problèmes corrigés :
 *   - Labels avec '??' : caractères accentués mal encodés
 *   - Famille 'Comp??tences Sp??ciales' → 'Compétences Spéciales' (3 lignes)
 *   - Famille 'Survie / Ext??rieur' → 'Survie / Extérieur' (1 ligne)
 *
 * down : restaure les valeurs corrompues (pour rollback propre).
 */

export const up = async (knex) => {
  // ── Labels corrompus ────────────────────────────────────────────────────────

  await knex('ref_skills')
    .where('id', 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION')
    .update({ label: 'Arme spéciale de contact (FOR/COO)' })

  await knex('ref_skills')
    .where('id', 'ARME_SPECIALE_CONTACT')
    .update({ label: 'Armes Spéciales (contact)' })

  await knex('ref_skills')
    .where('id', 'ARME_SPECIALE_DISTANCE')
    .update({ label: 'Armes Spéciales (distance)' })

  await knex('ref_skills')
    .where('id', 'CONTROLE_DES_MUTATIONS')
    .update({ family: 'Compétences Spéciales', label: 'Contrôle des mutations' })

  await knex('ref_skills')
    .where('id', 'MUTATION')
    .update({ family: 'Compétences Spéciales' })

  await knex('ref_skills')
    .where('id', 'POUVOIRS_POLARIS')
    .update({ family: 'Compétences Spéciales' })

  await knex('ref_skills')
    .where('id', 'SCIENCES_CONNAISANCES_SPECIALISEES')
    .update({ label: 'Sciences/Connaissances spécialisées' })

  await knex('ref_skills')
    .where('id', 'LANGAGES_SPECIFIQUES')
    .update({ label: 'Langages Spécifiques' })

  await knex('ref_skills')
    .where('id', 'LANGUE_ETRANGERE')
    .update({ label: 'Langue étrangère' })

  await knex('ref_skills')
    .where('id', 'MANOEUVRE_DARMURE')
    .update({ label: "Manœuvre d'armure" })

  await knex('ref_skills')
    .where('id', 'CONNAISSANCE_MILIEU_NATUREL')
    .update({ family: 'Survie / Extérieur', label: 'Connaissance milieu naturel' })

  await knex('ref_skills')
    .where('id', 'GENIE_TECHNIQUE')
    .update({ label: 'Génie technique' })
}

export const down = async (knex) => {
  await knex('ref_skills')
    .where('id', 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION')
    .update({ label: 'Arme sp??ciale de contact (FOR/COO)' })

  await knex('ref_skills')
    .where('id', 'ARME_SPECIALE_CONTACT')
    .update({ label: 'Armes Sp??ciales (contact)' })

  await knex('ref_skills')
    .where('id', 'ARME_SPECIALE_DISTANCE')
    .update({ label: 'Armes Sp??ciales (distance)' })

  await knex('ref_skills')
    .where('id', 'CONTROLE_DES_MUTATIONS')
    .update({ family: 'Comp??tences Sp??ciales', label: 'Contr??le des mutations' })

  await knex('ref_skills')
    .where('id', 'MUTATION')
    .update({ family: 'Comp??tences Sp??ciales' })

  await knex('ref_skills')
    .where('id', 'POUVOIRS_POLARIS')
    .update({ family: 'Comp??tences Sp??ciales' })

  await knex('ref_skills')
    .where('id', 'SCIENCES_CONNAISANCES_SPECIALISEES')
    .update({ label: 'Sciences/Connaissances sp??cialis??es' })

  await knex('ref_skills')
    .where('id', 'LANGAGES_SPECIFIQUES')
    .update({ label: 'Langages Sp??cifiques' })

  await knex('ref_skills')
    .where('id', 'LANGUE_ETRANGERE')
    .update({ label: 'Langue ??trang??re' })

  await knex('ref_skills')
    .where('id', 'MANOEUVRE_DARMURE')
    .update({ label: "Man??uvre d'armure" })

  await knex('ref_skills')
    .where('id', 'CONNAISSANCE_MILIEU_NATUREL')
    .update({ family: 'Survie / Ext??rieur', label: 'Connaissance milieu naturel' })

  await knex('ref_skills')
    .where('id', 'GENIE_TECHNIQUE')
    .update({ label: 'G??nie technique' })
}
