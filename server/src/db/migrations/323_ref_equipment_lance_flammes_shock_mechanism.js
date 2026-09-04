// 323_ref_equipment_lance_flammes_shock_mechanism.js — PLAN_ARMES_SPECIALES.md §1.4 segment 1 (1b)
//
// Câble le Choc 2D6 intrinsèque du lance-flammes (CHOC1 Palier 1, docs/PLAN_CHOC1.md §4).
//
// `_weaponShockDsl` (server/src/lib/damageService.js) REFUSE de dériver le Choc de la seule colonne
// `ref_equipment.shock` : il exige `shock_mechanism` non-null (la colonne `shock` reste peuplée pour
// des armes hors scope de ce palier — armes à énergie, mécaniques narratives). La ligne Lance-flammes
// a `shock: '2D6'` mais `shock_mechanism: null` → Choc non câblé aujourd'hui.
//
// Deux valeurs existent dans le seed : `'tete_gated'` (armes contondantes — Choc si Localisation =
// tête) et `'pure'` (Choc quelle que soit la Localisation). Le RAW du lance-flammes — « ces dommages
// reflètent la douleur insupportable liée à l'intensité de la brûlure » — ne conditionne le Choc à
// aucune Localisation : c'est du `'pure'`.
//
// Une fois câblé : `getEffectiveWeaponDamage().choc` renvoie
//   { action:'SET', value:'2D6', gateLocation:null, reducedByArmor:true }
// passé tel quel comme `chocDsl` à resolveTargetHit par le tronc AOE (segment 1e) — exactement le
// chemin qu'emprunterait le fusil à pompe s'il portait un Choc d'arme. `shock_reduced_by_armor`
// vaut déjà `true` sur la ligne (la norme) : le Choc est amorti par `prt` (protection_shock),
// indépendamment du ÷2 « protections simples » qui ne touche que `etq` (décision E, JOURNAL8).
//
// Matché par `name` (clé métier), jamais par `id` (.claude/rules/core.md). Fait distinct de la
// migration 322 (AOE-ness) : CHOC1 est un sous-système orthogonal — un fichier par fait logique.

export const up = async (knex) => {
  const row = await knex('ref_equipment')
    .where({ name: 'Lance-flammes' })
    .select('id', 'shock', 'shock_mechanism')
    .first()
  if (!row) throw new Error('ref_equipment introuvable : Lance-flammes')
  if (row.shock !== '2D6') {
    throw new Error(`Lance-flammes : shock inattendu "${row.shock}" — vérifier le catalogue avant de câbler le Choc`)
  }
  if (row.shock_mechanism == null) {
    await knex('ref_equipment').where({ id: row.id }).update({ shock_mechanism: 'pure' })
  }
}

export const down = async (knex) => {
  const row = await knex('ref_equipment').where({ name: 'Lance-flammes' }).select('id').first()
  if (row) {
    await knex('ref_equipment').where({ id: row.id }).update({ shock_mechanism: null })
  }
}
