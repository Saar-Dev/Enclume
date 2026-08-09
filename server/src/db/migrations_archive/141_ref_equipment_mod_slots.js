// 141_ref_equipment_mod_slots.js
// Numéro 140 déjà pris entre-temps par une session parallèle (140_ref_skill_requirements_or_group.js,
// batch 105) — collision P53, fichier renommé 140→141 après coup, bookkeeping knex_migrations corrigé
// en conséquence (déjà appliquée, batch 106, aucune ré-exécution).
// docs/PLAN_MODING_PHASEB.md — Architecture des slots exclusifs (prérequis Groupe 1/2/4).
// Un seul item actif par slot sur une arme donnée — l'exclusivité se règle à l'installation
// (modingService.installMod), jamais au calcul de combat (voir plan §"Architecture des slots").
//
// Noms vérifiés un par un contre la base réelle (16/16, codes Unicode inspectés — 4 noms portent
// une apostrophe typographique ’ U+2019, pas une apostrophe droite) : aucune collision hors
// périmètre (16/16 matches, 0 doublon global sur ref_equipment.name).

const MOD_SLOTS = {
  'Système de tir assisté : Cyclope PVI':          { slot: 'optique',  requiresAim: false },
  'Système de tir assisté : Implant palmaire':     { slot: 'optique',  requiresAim: false },
  'Système de tir assisté : Visière Onarck P':     { slot: 'optique',  requiresAim: false },
  'Système de tir assisté : Visière Vanguard':     { slot: 'optique',  requiresAim: false },
  'Systèmes d’aide à la visée : Visée laser':       { slot: 'optique',  requiresAim: false },
  'Systèmes d’aide à la visée : Calculateur laser': { slot: 'optique',  requiresAim: false },
  'Systèmes d’aide à la visée : Lunette de visée':  { slot: 'optique',  requiresAim: true },
  'Mémoire de cibles Mémo':                         { slot: 'logiciel', requiresAim: false },
  'Projecteur de mouvement':                        { slot: 'logiciel', requiresAim: false },
  'Système réactif autonome : R.N.T. Jaguar 400':   { slot: 'logiciel', requiresAim: false },
  'Analyseur tactique individuel : A.T.I Alpha':    { slot: 'logiciel', requiresAim: false },
  'Silencieux':                                      { slot: 'canon',    requiresAim: false },
  'Poignée d’identification':                       { slot: 'poignee',  requiresAim: false },
  // Pas de slot (jamais exclusif) : Mémoire de cibles : Bloc afficheur de données (compagnon du
  // Mémo), Trépied, Harnais mécanisé (Groupe 3 retiré de Phase B → docs/ROADMAP.md) — mod_slot
  // reste NULL par défaut, aucune ligne à toucher pour ces 3 items.
}

export const up = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.text('mod_slot').nullable()
    table.boolean('mod_requires_aim').notNullable().defaultTo(false)
  })

  for (const [name, { slot, requiresAim }] of Object.entries(MOD_SLOTS)) {
    await knex('ref_equipment').where({ name })
      .update({ mod_slot: slot, mod_requires_aim: requiresAim })
  }

  await knex.schema.alterTable('char_inventory_mods', (table) => {
    table.text('mod_slot').nullable()
  })

  // Backfill des mods déjà installés (Phase A en prod, 2 lignes réelles vérifiées) — sans ça le
  // garde-fou d'exclusivité ne verrait pas un mod existant lors d'un swap futur (mod_slot resterait
  // NULL indéfiniment, jamais réécrit ailleurs).
  await knex.raw(`
    UPDATE char_inventory_mods
    SET mod_slot = ref_equipment.mod_slot
    FROM ref_equipment
    WHERE char_inventory_mods.equipment_id = ref_equipment.id
  `)

  await knex.raw(`
    CREATE UNIQUE INDEX uq_char_inv_mods_slot
      ON char_inventory_mods (weapon_inv_id, mod_slot)
      WHERE mod_slot IS NOT NULL
  `)
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS uq_char_inv_mods_slot')
  await knex.schema.alterTable('char_inventory_mods', (table) => {
    table.dropColumn('mod_slot')
  })
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.dropColumn('mod_slot')
    table.dropColumn('mod_requires_aim')
  })
}
