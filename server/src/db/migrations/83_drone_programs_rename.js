// Migration 83 — Renommage programmes armement drone
//
// "Attaque" → "Contact" (category: armement_distance → armement_contact)
// "Tir"     → "Balistique" (category inchangée)
// "Contrôle armement" → supprimé (générique sans usage mécanique distinct)
//
// Nettoyage des instances drone_programs avant suppression (FK ON DELETE RESTRICT).

export const up = async (knex) => {
  await knex('ref_equipment')
    .where({ family: 'Logiciels', name: 'Attaque' })
    .update({ name: 'Contact', category: 'armement_contact' })

  await knex('ref_equipment')
    .where({ family: 'Logiciels', name: 'Tir' })
    .update({ name: 'Balistique' })

  const controle = await knex('ref_equipment')
    .where({ family: 'Logiciels', name: 'Contrôle armement' })
    .select('id')
    .first()

  if (controle) {
    await knex('drone_programs').where({ equipment_id: controle.id }).delete()
    await knex('ref_equipment').where({ id: controle.id }).delete()
  }
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .where({ family: 'Logiciels', name: 'Contact' })
    .update({ name: 'Attaque', category: 'armement_distance' })

  await knex('ref_equipment')
    .where({ family: 'Logiciels', name: 'Balistique' })
    .update({ name: 'Tir' })

  await knex('ref_equipment').insert({
    family: 'Logiciels', category: 'armement_distance', name: 'Contrôle armement',
    description: "Programme de contrôle armement. Sert de Compétence d'attaque pour l'arme automatisée. Un programme par arme. Niveau = niveau d'attaque.",
    tech_level: 1, price_modifier: '1600 × cumul', rarity: '20(20)',
  })
}
