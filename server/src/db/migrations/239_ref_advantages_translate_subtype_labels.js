// 239_ref_advantages_translate_subtype_labels.js
// Bug #16 (docs/BUG WIZARD.md) — ref_advantages.name contient des termes anglais non traduits entre
// parenthèses (ex. "Sens diminué (hearing)", "Faiblesse naturelle (drug)"). Step5Advantages.jsx et
// AdvantagesPanel.jsx affichent tous deux adv.name directement (aucune indirection i18n) — correction
// à la source, seule autorité, cohérente avec tous les consommateurs (Wizard + fiche personnage).
//
// Seules les lignes réellement anglaises sont corrigées : "poison" et "radiation" s'écrivent à
// l'identique en français (REGLE_AVANTAGES.md:154 "poisons, maladies, radiations ou drogues"), non
// touchées. Vue/toucher/goût/odorat/ouïe : REGLE_AVANTAGES.md:96-97 et :204.
//
// Note vérifiée et écartée : BUG WIZARD.md prétend que ce correctif "entraîne la validation de
// PLAN_LOCALISATION" — faux, PLAN_LOCALISATION.md (chantier "texte JSX en dur sans useTranslation")
// ne couvre pas les données ref_advantages, sujet disjoint. Aucune action sur ce plan ici.

const FIXES = [
  { advantage_id: 'adv_035', to: 'Sens développé (vue)', from: 'Sens développé (sight)' },
  { advantage_id: 'adv_036', to: 'Sens développé (ouïe)', from: 'Sens développé (hearing)' },
  { advantage_id: 'adv_037', to: 'Sens développé (odorat)', from: 'Sens développé (smell)' },
  { advantage_id: 'adv_038', to: 'Sens développé (toucher)', from: 'Sens développé (touch)' },
  { advantage_id: 'adv_039', to: 'Sens développé (goût)', from: 'Sens développé (taste)' },
  { advantage_id: 'adv_071', to: 'Sens diminué (vue)', from: 'Sens diminué (sight)' },
  { advantage_id: 'adv_072', to: 'Sens diminué (ouïe)', from: 'Sens diminué (hearing)' },
  { advantage_id: 'adv_073', to: 'Sens diminué (odorat)', from: 'Sens diminué (smell)' },
  { advantage_id: 'adv_074', to: 'Sens diminué (toucher)', from: 'Sens diminué (touch)' },
  { advantage_id: 'adv_075', to: 'Sens diminué (goût)', from: 'Sens diminué (taste)' },
  { advantage_id: 'adv_052', to: 'Faiblesse naturelle (maladie)', from: 'Faiblesse naturelle (disease)' },
  { advantage_id: 'adv_054', to: 'Faiblesse naturelle (drogue)', from: 'Faiblesse naturelle (drug)' },
  { advantage_id: 'adv_032', to: 'Résistance naturelle augmentée (maladie)', from: 'Résistance naturelle augmentée (disease)' },
  { advantage_id: 'adv_034', to: 'Résistance naturelle augmentée (drogue)', from: 'Résistance naturelle augmentée (drug)' },
]

export const up = async (knex) => {
  for (const { advantage_id, to } of FIXES) {
    await knex('ref_advantages').where({ advantage_id }).update({ name: to })
  }
}

export const down = async (knex) => {
  for (const { advantage_id, from } of FIXES) {
    await knex('ref_advantages').where({ advantage_id }).update({ name: from })
  }
}
