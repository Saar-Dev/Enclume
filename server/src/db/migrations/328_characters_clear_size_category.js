// 328_characters_clear_size_category.js — docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md M2
//
// Le champ « Taille (combat) » de la fiche de personnage (PLAN_TAILLE.md S5) est retiré :
// l'automatisation des modificateurs de combat se règle désormais au niveau de la campagne
// (settings.combat_modifiers_mode LIBRE / AUTO). Plus aucune UI n'écrit characters.size_category.
//
// Cette migration remet à NULL les valeurs éventuellement posées pendant la brève vie de ce
// champ, pour que la taille repasse partout en dérivation automatique (resolveSizeCategoryFrom :
// char_identity.height / drone_sheet.taille / exo_sheet.category). Sur la base de dev locale au
// moment de l'écriture : 0 ligne concernée — la migration est un filet pour les autres bases.
//
// La colonne `characters.size_category` et sa CHECK (migration 327) RESTENT : c'est le 1er cran
// de la cascade `explicit ?? derived ?? default` (patron canonique Foundry/PF2e), réutilisable
// si un pilotage explicite de la taille revient un jour par une autre UI.
//
// down : no-op — les valeurs effacées ne sont pas restaurables, et n'ont plus de consommateur.

export const up = async (knex) => {
  await knex('characters').whereNotNull('size_category').update({ size_category: null })
}

export const down = async () => {
  // no-op : valeurs effacées non restaurables
}
