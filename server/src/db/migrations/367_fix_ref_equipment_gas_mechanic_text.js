// 367_fix_ref_equipment_gas_mechanic_text.js — docs/PLANS/PLAN_ZONES_DANGER.md §5.4/§14.5 (Z1.4)
//
// 6 lignes ref_equipment (Grenade/Capsule à gaz — décomposants/vésicants/assommants) portaient de la
// prose mécanique RAW copiée dans une colonne de FICHE (nation/damage_h), jamais lue par aucun
// consommateur mécanique — cette donnée vit désormais dans shared/world/dangerCatalog.js (catalogue
// danger, Z0). Les valeurs sont VIDÉES, pas migrées vers une nouvelle colonne : aucun pont
// catalogue↔équipement n'existe encore (`aoe_profile.dangerKey` = Z3, hors périmètre ici).
//
// Vérifié directement sur enclumeBD (2026-09-27) avant d'écrire cette migration, pas recopié du plan
// tel quel (AGENTS.md invariant 1 — le plan disait "6 lignes" sans toutes les nommer, la requête
// directe a confirmé l'exhaustivité : exactement ces 6, Grenade+Capsule pour chacun des 3 gaz cités).
// Les 6 autres lignes gaz (irritant/neurotoxique/suffocant, Grenade+Capsule) sont déjà `null` dans ces
// colonnes — hors périmètre, rien à corriger. La ligne Acide (`damage_h:'1D10'`) est propre : une
// formule de dés est la valeur normale de cette colonne pour ce type de ligne, pas une corruption.
//
// Matché par `name` (clé métier), jamais par `id` — .claude/rules/core.md. Patron migration 344
// (`{name, column, oldValue}` + vérification stricte de la valeur avant update, jamais un UPDATE à
// l'aveugle sur un LIKE).

const FIXES = [
  { name: 'Grenade à gaz — Gaz décomposants', column: 'nation',
    oldValue: '1D6/Tour (+2/Tour en zone; -1/Tour hors zone)' },
  { name: 'Capsule gaz — Gaz décomposants', column: 'nation',
    oldValue: '1D6/Tour (+2/Tour en zone; -1/Tour hors zone)' },
  { name: 'Grenade à gaz — Gaz vésicants', column: 'nation',
    oldValue: '1D6/Tour ×1D3 Loc (+1/Tour en zone)' },
  { name: 'Capsule gaz — Gaz vésicants', column: 'nation',
    oldValue: '1D6/Tour ×1D3 Loc (+1/Tour en zone)' },
  { name: 'Grenade à gaz — Gaz assommants', column: 'damage_h',
    oldValue: 'Test Résistance au Choc' },
  { name: 'Capsule gaz — Gaz assommants', column: 'damage_h',
    oldValue: 'Test Résistance au Choc' },
]

export const up = async (knex) => {
  for (const { name, column, oldValue } of FIXES) {
    const row = await knex('ref_equipment').where({ name }).select('id', column).first()
    if (!row) throw new Error(`ref_equipment introuvable : ${name}`)
    if (row[column] !== oldValue) {
      throw new Error(`${column} inattendu pour "${name}" (déjà nettoyé ?) : ${JSON.stringify(row[column])}`)
    }
    await knex('ref_equipment').where({ id: row.id }).update({ [column]: null })
  }
  console.log(`[367_fix_ref_equipment_gas_mechanic_text] ${FIXES.length} ligne(s) nettoyée(s)`)
}

export const down = async (knex) => {
  for (const { name, column, oldValue } of FIXES) {
    const row = await knex('ref_equipment').where({ name }).select('id', column).first()
    if (row && row[column] === null) {
      await knex('ref_equipment').where({ id: row.id }).update({ [column]: oldValue })
    }
  }
}
