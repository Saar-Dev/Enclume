// 344_fix_ammo_effects_iem.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 1, item 3
//
// RAW vérifié mot à mot (docs/REGLES/REGLESMUNITIONS.md p.26-29, « Balles IEM ») : « Ces balles
// infligent moitié moins de dégâts [...] imposant un Test de panne avec un malus de -3 pour les
// équipements électroniques ». Le mécanisme « moitié moins de dégâts » (DMG=MUL(0.5)) était déjà
// correct : c'est le DSL existant (shared/weaponAmmoDsl.js, resolveDmgEffect/DMG_ACTIONS.MUL),
// aucune primitive nouvelle nécessaire.
//
// **Format du tag corrigé (analyse à charge Lot 2, 2026-09-15)** : le seed portait
// `FX=IEM(TEST_PANNE:-1/2D10_ARME)` — une syntaxe à paramètres jamais alignée sur la grammaire des
// 6 autres mécaniques FX du DSL (APHC/SAP/SLAP/HP/EXPLOSIVE/SHRAPNEL sont de simples valeurs sans
// parenthèses, résolues par `resolveAmmoMechanic` via une correspondance de dictionnaire directe).
// Cette syntaxe à paramètres n'a jamais eu de consommateur (orpheline depuis sa création) et aurait
// obligé le futur déclencheur IEM (Lot 2) à écrire un mini-parseur regex dédié rien que pour cette
// ligne, tout en dupliquant le malus RAW (-3, une valeur FIXE, RAW, jamais variable par calibre)
// dans les 17 lignes de catalogue au lieu d'une seule fois dans le code — contraire à l'invariant
// « une propriété métier = une autorité unique » (AGENTS.md #3). Corrigé en `FX=IEM` (valeur
// simple, même grammaire que les 6 autres). Le malus -3 vivra comme une constante unique dans le
// futur module Lot 2 (pas encore écrit) — jamais dans le catalogue, jamais dans
// `shared/weaponAmmoDsl.js` (qui ne doit pas connaître le malus IEM : ce fichier ne fait que
// signaler le tag, le Lot 2 reste seul propriétaire de sa valeur — cf. PLAN §4 Lot 2, « Frontière
// avec damageService.js/weaponAmmoDsl.js »).
//
// Requête directe sur enclumeBD (2026-09-15) : 17 lignes IEM au catalogue, pas une seule comme la
// citation reprise dans le PLAN le laissait entendre. 16 portent le bon squelette
// `DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)` (malus -1 à corriger en -3 ET tag à
// simplifier, RANGE/DEPTH préservés tels quels sur les 2 variantes Darts qui en portent). 1 ligne
// ("Carreau - Projectile IEM") est structurellement cassée : `DMG=BASE;TXT=PEN=BASE`, sans DMG=MUL
// ni FX=IEM du tout — réalignée sur le patron des 16 autres, en conservant son PEN=BASE existant.
// "Champ IEM anti-torpille (champ sphère)" (ammo_effects NULL) n'est volontairement pas touché :
// dispositif défensif, mécanique distincte (Blindage électronique, MANUEL_INFORMATIQUE.md §4.5),
// hors périmètre de cette correction.
//
// `TXT=FX=IEM` reste un tag inerte pour l'instant : aucun consommateur ne le lit encore
// (`resolveAmmoMechanic` ne reconnaît que APHC/SAP/SLAP/HP/EXPLOSIVE/SHRAPNEL, IEM retourne `null`
// — comportement Lot A/B inchangé, cf. shared/weaponAmmoDsl.js). Ce sera le déclencheur du Lot 2
// qui le lira directement (`parsed.tags.FX === 'IEM'`), jamais via `resolveAmmoMechanic`.
//
// Matché par `name` (clé métier), jamais par `id` codé en dur — `.claude/rules/core.md`. Patron
// identique à la migration 312 (liste {name, oldAmmoEffects, newAmmoEffects} + vérification stricte
// avant update, jamais un UPDATE ... WHERE ammo_effects LIKE '%...%' à l'aveugle).

const FIXES = [
  { name: 'Flèche - Projectile IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '9 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '10.92 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '11.43 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '12.7 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '15.2 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '15.3 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '17 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '20 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: 'Calibre 12 - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '5.45 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '5.56 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: '7.62 mm - Munition IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: 'Darts 7.62 mm ST - Projectile IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM' },
  { name: 'Darts 5.56 mm ST - Projectile IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);RANGE=AIR_X2;TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
    newAmmoEffects: 'DMG=MUL(0.5);RANGE=AIR_X2;TXT=FX=IEM|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE' },
  { name: 'Darts 4.5 mm ST - Projectile IEM',
    oldAmmoEffects: 'DMG=MUL(0.5);RANGE=AIR_X2;TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE',
    newAmmoEffects: 'DMG=MUL(0.5);RANGE=AIR_X2;TXT=FX=IEM|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE' },
  { name: 'Carreau - Projectile IEM',
    oldAmmoEffects: 'DMG=BASE;TXT=PEN=BASE',
    newAmmoEffects: 'DMG=MUL(0.5);TXT=FX=IEM|PEN=BASE' },
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
  console.log(`[344_fix_ammo_effects_iem] ${FIXES.length} ligne(s) corrigée(s) (tag simplifié en FX=IEM, Carreau réaligné)`)
}

export const down = async (knex) => {
  for (const { name, oldAmmoEffects, newAmmoEffects } of FIXES) {
    const row = await knex('ref_equipment').where({ name }).select('id', 'ammo_effects').first()
    if (row?.ammo_effects === newAmmoEffects) {
      await knex('ref_equipment').where({ id: row.id }).update({ ammo_effects: oldAmmoEffects })
    }
  }
}
