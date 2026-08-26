// 315_ref_equipment_exo_skill_seed.js — PLAN_EXOARMURE.md §16.2.4
//
// resolveCombatantTestContext(db, exoCharacter, skillAssoc.skill_id) (Étape B, §16.4) suppose que
// chaque arme exo à distance a une Compétence associée dans ref_equipment_skill_assoc, comme les
// armes humaines — le seed du Lot C (2026-08-22, périmètre "fiche uniquement") ne l'a jamais rempli
// pour la famille 'Exo-arme'. Idem pour resolveExoMeleeAction côté CaC : les 9 "Armes de contact" exo
// ont toutes skill_id: null, même trou (analyse à charge du plan, 2026-08-23) — elles testent
// COMBAT_ARME comme leurs équivalents humains, jamais un skill_id codé en dur ailleurs.
//
// Matché par `name` (+ family='Exo-arme' pour lever toute ambiguïté), jamais par id en dur — deux
// instances seedées indépendamment (ex. Kiwi) ont des id différents pour la même ligne (core.md,
// précédent vécu migration 209).
//
// Lance-leurre (10 lignes family='Exo-arme') exclu : REGLEARMURE.md:1298-1301 les place dans le
// chapitre "Combat sous-marin" (p.364), jamais transcrit dans docs/REGLES/*.md — mécanisme à concevoir
// séparément une fois l'extrait RAW fourni par Saar (Saar, 2026-08-23).

// 4 armes à distance — skill_id + ammo_count dérivé de ammo_cost ("N (prix)" → N), colonne texte
// (ref_equipment.ammo_count, character varying(50), même format que l'armement humanoïde : "10", "30"...).
const RANGED = [
  { name: 'Canon à neutrons',          skillId: 'ARMES_LOURDES',      ammoCount: '10' },
  { name: 'Lance-harpons AV',          skillId: 'ARMES_SOUS_MARINES', ammoCount: '1'  },
  { name: 'Lance-harpons AV double',   skillId: 'ARMES_SOUS_MARINES', ammoCount: '1'  },
  { name: 'Lance-harpons AV multiple', skillId: 'ARMES_SOUS_MARINES', ammoCount: '1'  },
]

// 9 armes de contact — skill_id seul (mirroir des ~25 armes de contact humaines, toutes COMBAT_ARME),
// aucune munition (cohérent avec leurs équivalents humains).
const MELEE_SKILL_ID = 'COMBAT_ARME'
const MELEE_NAMES = [
  'Électro-pince', 'Excavateur mécanique', 'Griffe mécanique', 'Hydro-foreuse',
  'Marteau-piqueur', 'Perceuse industrielle', 'Pince/Griffe', 'Scie industrielle',
  'Torche de forage Hydra',
]

const ALL_NAMES = [...RANGED.map(r => r.name), ...MELEE_NAMES]

async function idsByName(knex) {
  const rows = await knex('ref_equipment')
    .whereIn('name', ALL_NAMES)
    .andWhere({ family: 'Exo-arme' })
    .select('id', 'name')
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))
  const missing = ALL_NAMES.filter(n => !byName[n])
  if (missing.length > 0) throw new Error(`ref_equipment introuvable (family=Exo-arme) : ${missing.join(', ')}`)
  return byName
}

export const up = async (knex) => {
  const idByName = await idsByName(knex)

  for (const { name, skillId, ammoCount } of RANGED) {
    const id = idByName[name]
    await knex('ref_equipment_skill_assoc').insert({ item_id: id, skill_id: skillId })
    await knex('ref_equipment').where({ id }).update({ ammo_count: ammoCount })
  }
  for (const name of MELEE_NAMES) {
    await knex('ref_equipment_skill_assoc').insert({ item_id: idByName[name], skill_id: MELEE_SKILL_ID })
  }
}

export const down = async (knex) => {
  const idByName = await idsByName(knex)

  for (const { name, skillId } of RANGED) {
    await knex('ref_equipment_skill_assoc').where({ item_id: idByName[name], skill_id: skillId }).del()
    await knex('ref_equipment').where({ id: idByName[name] }).update({ ammo_count: null })
  }
  for (const name of MELEE_NAMES) {
    await knex('ref_equipment_skill_assoc').where({ item_id: idByName[name], skill_id: MELEE_SKILL_ID }).del()
  }
}
