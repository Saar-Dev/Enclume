// 209_fix_ref_equipment_ammo_sap_iem.js
// Corrige le DSL ammo_effects de 2 munitions (COM26, docs/BUGIDENTIFIE.md) — explicitement exclues
// de la migration 160 (même DSL Assommante fautif, mais description totalement différente).
//
// "Darts 7.62 mm ST - Projectile SAP" : DMG=BASE — une fois FX=SAP posé, shared/weaponAmmoDsl.js
// (Lot C1, câblé dans damageService.js) fait de ce tag la seule autorité mécanique (retire 1 dé de
// la formule de l'ARME, pas de la munition ; armure ×0.5), le DMG=/PEN= catalogue devient cosmétique
// — donc pas de valeur inventée nécessaire. DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE reproduit mot pour
// mot la règle RAW (armes sous-marines à projectiles, LdB) déjà utilisée sur les munitions sœurs
// (Darts 5.56mm SAP, Darts 7.62mm APHC). RANGE=AIR_X2 des munitions sœurs semble lui-même faux
// (LdB : Fusil d'assaut à dards = 1 astérisque = portées TRIPLÉES à l'air libre, pas doublées) mais
// n'est lu par aucun code (parseAmmoEffects ne reconnaît que DMG/CHOC/TXT, RANGE= tombe en `unknown`,
// jamais consommé) — pas repris ici, dette séparée à documenter, hors scope de ce correctif.
//
// "Flèche - Projectile IEM" : valeur ground-truth retrouvée telle quelle dans le fichier d'extraction
// Excel original (docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js, EQ_00461),
// identique à ses 6+ munitions IEM sœurs du catalogue — aucune reconstruction, juste la bonne valeur.

const OLD_AMMO_EFFECTS = 'DMG=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10);TXT=FX=ASSOMMANTE'

const FIXES = [
  {
    id: '30985a34-876d-4c0e-89d0-5f49cab10809', // Darts 7.62 mm ST - Projectile SAP
    newAmmoEffects: 'DMG=BASE;TXT=FX=SAP|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
  },
  {
    id: '4795d390-04ee-4697-8d9c-d8eb77480ccd', // Flèche - Projectile IEM
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
  },
]

export const up = async (knex) => {
  for (const { id, newAmmoEffects } of FIXES) {
    const row = await knex('ref_equipment').where({ id }).select('ammo_effects').first()
    if (!row) throw new Error(`ref_equipment introuvable : ${id}`)
    if (row.ammo_effects !== OLD_AMMO_EFFECTS) {
      throw new Error(`ammo_effects inattendu pour ${id} (déjà modifié ?) : ${row.ammo_effects}`)
    }
    await knex('ref_equipment').where({ id }).update({ ammo_effects: newAmmoEffects })
  }
}

export const down = async (knex) => {
  for (const { id, newAmmoEffects } of FIXES) {
    const row = await knex('ref_equipment').where({ id }).select('ammo_effects').first()
    if (row?.ammo_effects === newAmmoEffects) {
      await knex('ref_equipment').where({ id }).update({ ammo_effects: OLD_AMMO_EFFECTS })
    }
  }
}
