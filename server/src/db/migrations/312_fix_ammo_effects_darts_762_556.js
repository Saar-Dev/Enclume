// 312_fix_ammo_effects_darts_762_556.js — AMMO-STD-MISMATCH1
//
// shared/weaponAmmoDsl.js (Lot C1, câblé dans server/src/lib/damageService.js) : dès que tags.FX
// correspond à une des 6 familles mécaniques (APHC/SAP/SLAP/HP/EXPLOSIVE/SHRAPNEL), ce registre
// devient la SEULE autorité de dégâts/armure/Choc — les clauses DMG=/CHOC= du catalogue pour cette
// ligne deviennent cosmétiques, jamais lues. RANGE=AIR_X.../TXT=DEPTH=... ne sont reconnus par aucune
// clé du parseur (parseAmmoEffects ne traite que DMG/CHOC/TXT) : décoratifs, aucun impact en jeu —
// dette séparée déjà documentée (migration_archive/209), pas reprise ici.
//
// 5 lignes du catalogue portaient donc un FX= manquant ou emprunté à une autre munition, avec un
// impact réel en combat (pas seulement cosmétique) :
//   - Darts 5.56mm ST standard  : FX=EXPLOSIVE emprunté  -> une balle "standard" explosait
//   - Darts 7.62mm ST APHC      : FX= absent             -> une balle "perforante" ne perçait rien
//   - Darts 7.62mm ST assommant : FX=EXPLOSIVE emprunté  -> une balle "non-létale" explosait
//   - Darts 7.62mm ST explosif  : FX= absent             -> une balle "explosive" ne faisait rien
//   - Darts 7.62mm ST standard  : FX=IEM emprunté        -> une balle "standard" faisait -50% dégâts
//     + panne électronique
// Valeurs corrigées alignées sur l'homologue 5.56mm ST / "Balles" du même type (déjà correct,
// vérifié : FX cohérent avec le nom et la description de la ligne). Darts 7.62mm ST SAP/IEM déjà
// muni du bon FX (migration_archive/209 pour SAP) — non touchées ici, DMG=/absence de RANGE-DEPTH
// n'y est que cosmétique.
//
// Matché par `name` (clé métier), jamais par `id` codé en dur (seed non déterministe entre instances
// — .claude/rules/core.md, vécu migration 209).

const FIXES = [
  {
    name: 'Darts 5.56 mm ST - Projectile standard',
    oldAmmoEffects: 'DMG=ADD(1D10,+1/5D10_ARME);CHOC=ADD(1D10,+1/5D10_ARME);RANGE=AIR_X2;TXT=ARMOR=CHOC_IGNORE_SIMPLE|FX=EXPLOSIVE|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
    newAmmoEffects: 'DMG=BASE;RANGE=AIR_X2;TXT=DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
  },
  {
    name: 'Darts 7.62 mm ST - Projectile APHC',
    oldAmmoEffects: 'DMG=BASE;RANGE=AIR_X2;TXT=DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
    newAmmoEffects: 'DMG=SET(3D10+5);RANGE=AIR_X2;TXT=PEN=SET(18)|FX=APHC|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
  },
  {
    name: 'Darts 7.62 mm ST - Projectile assommant',
    oldAmmoEffects: 'DMG=ADD(1D10,+1/5D10_ARME);CHOC=ADD(1D10,+1/5D10_ARME);TXT=ARMOR=CHOC_IGNORE_SIMPLE|FX=EXPLOSIVE',
    newAmmoEffects: 'DMG=SET(1D6+2);CHOC=SET(1D10+2);RANGE=AIR_X2;TXT=FX=ASSOMMANTE|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
  },
  {
    name: 'Darts 7.62 mm ST - Projectile explosif',
    oldAmmoEffects: 'DMG=BASE',
    newAmmoEffects: 'DMG=ADD(1D10,+1/5D10_ARME);CHOC=ADD(1D10,+1/5D10_ARME);RANGE=AIR_X2;TXT=ARMOR=CHOC_IGNORE_SIMPLE|FX=EXPLOSIVE|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
  },
  {
    name: 'Darts 7.62 mm ST - Projectile standard',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=BASE;RANGE=AIR_X2;TXT=DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
  },
]

export const up = async (knex) => {
  for (const { name, oldAmmoEffects, newAmmoEffects } of FIXES) {
    const row = await knex('ref_equipment').where({ name }).select('id', 'ammo_effects').first()
    if (!row) throw new Error(`ref_equipment introuvable : ${name}`)
    if (row.ammo_effects !== oldAmmoEffects) {
      throw new Error(`ammo_effects inattendu pour ${name} (déjà modifié ?) : ${row.ammo_effects}`)
    }
    await knex('ref_equipment').where({ id: row.id }).update({ ammo_effects: newAmmoEffects })
  }
}

export const down = async (knex) => {
  for (const { name, oldAmmoEffects, newAmmoEffects } of FIXES) {
    const row = await knex('ref_equipment').where({ name }).select('id', 'ammo_effects').first()
    if (row?.ammo_effects === newAmmoEffects) {
      await knex('ref_equipment').where({ id: row.id }).update({ ammo_effects: oldAmmoEffects })
    }
  }
}
