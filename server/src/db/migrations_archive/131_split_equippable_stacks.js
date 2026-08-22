// Migration 131 — Scinde les stacks d'items équipables (quantity > 1) en lignes indépendantes.
//
// P57 : un item équipable (arme ou protection — location non nulle et ≠ 'D'/'Ce') ne doit
// jamais partager une ligne char_inventory à quantity > 1 — chaque exemplaire a son propre
// slot et son propre état de munition (current_ammo/ammo_remaining). Avant cette migration,
// le stacking (POST /inventory) et l'achat marchand (tradeService.js) pouvaient agréger deux
// armes identiques en une seule ligne quantity=2, rendant impossible d'équiper un exemplaire
// dans chaque main (bug dual-wield confirmé en base réelle — ex. "Scorpion" quantity=2 slot='MG').
//
// Vérifié en base avant migration : 3 lignes concernées (2 armes M, 1 protection T/C/B/J).
export const up = async (knex) => {
  const rows = await knex('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .whereNotNull('ref_equipment.location')
    .whereNotIn('ref_equipment.location', ['D', 'Ce'])
    .where('char_inventory.quantity', '>', 1)
    .select('char_inventory.*')

  for (const row of rows) {
    const extra = row.quantity - 1

    await knex('char_inventory')
      .where({ id: row.id })
      .update({ quantity: 1, updated_at: knex.fn.now() })

    const clones = Array.from({ length: extra }, () => ({
      character_id:   row.character_id,
      equipment_id:   row.equipment_id,
      container:      row.container,
      slot:           null, // seule la ligne d'origine garde le slot éventuel
      quantity:       1,
      custom_name:    row.custom_name,
      custom_desc:    row.custom_desc,
      notes:          row.notes,
      custom_props:   row.custom_props,
      current_ammo:   null,   // exemplaire scindé : pas de munition chargée par défaut
      ammo_remaining: null,
      created_at:     knex.fn.now(),
      updated_at:     knex.fn.now(),
    }))

    if (clones.length > 0) {
      await knex('char_inventory').insert(clones)
    }
  }
}

// Best-effort : refusionne les lignes scindées (même character_id+equipment_id+container+slot)
// en sommant quantity. Non byte-identique si des mutations sont survenues entre up/down
// (même convention que les migrations 108/109 — round-trip testé juste après écriture, P52-P54).
export const down = async (knex) => {
  const rows = await knex('char_inventory')
    .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .whereNotNull('ref_equipment.location')
    .whereNotIn('ref_equipment.location', ['D', 'Ce'])
    .select('char_inventory.*')

  const groups = new Map()
  for (const row of rows) {
    const key = [row.character_id, row.equipment_id, row.container, row.slot ?? ''].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue
    const [keep, ...rest] = group
    const total = group.reduce((sum, r) => sum + r.quantity, 0)
    await knex('char_inventory')
      .where({ id: keep.id })
      .update({ quantity: total, updated_at: knex.fn.now() })
    await knex('char_inventory').whereIn('id', rest.map(r => r.id)).del()
  }
}
