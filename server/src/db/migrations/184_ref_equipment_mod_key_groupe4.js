// 184_ref_equipment_mod_key_groupe4.js
// docs/PLAN_MODDING_REFONTE.md Phase 4 (4.1.1/4.2.1/4.3.1) — peuple ref_equipment.mod_key (colonne
// ajoutée nue par la migration 182) pour les 3 mécaniques Groupe 4 codées cette session : ATI,
// Mémoire de cibles, Projecteur de mouvement. Noms exacts repris de la migration 141
// (MOD_SLOTS, déjà vérifiés un par un contre la base réelle, apostrophe typographique ’ U+2019).
//
// "Système réactif autonome : R.N.T. Jaguar 400" n'est volontairement PAS ici — hors périmètre du
// système de hooks (docs/PLAN_MODDING_REFONTE.md, correctif Phase 4 : IA de tir autonome, chantier
// combat séparé, pas un "mod" au sens de ce document). "Mémoire de cibles : Bloc afficheur de
// données" non plus — compagnon non-exclusif du Mémo, jamais dans le registre (PHASEB).

const MOD_KEYS = {
  'Analyseur tactique individuel : A.T.I Alpha': 'ati',
  'Mémoire de cibles Mémo':                      'memoire',
  'Projecteur de mouvement':                     'projecteur',
}

export const up = async (knex) => {
  for (const [name, modKey] of Object.entries(MOD_KEYS)) {
    await knex('ref_equipment').where({ name }).update({ mod_key: modKey })
  }
}

export const down = async (knex) => {
  await knex('ref_equipment').whereIn('mod_key', Object.values(MOD_KEYS)).update({ mod_key: null })
}
