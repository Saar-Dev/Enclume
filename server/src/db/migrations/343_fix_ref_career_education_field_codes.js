// 343_fix_ref_career_education_field_codes.js
//
// Bug réel remonté par Saar : Érudit/Archéologue (et 7 autres métiers) inaccessibles quel que
// soit le choix du joueur, malgré des études supérieures correctement sélectionnées.
//
// Cause racine : `ref_career_education.field` stockait le NOM affiché de la formation
// ("Sciences/Sciences humaines", seed 293_ref_career_education_seed.js), alors que le choix du
// joueur est comparé partout ailleurs (char_archetype.higher_ed, resolveBackground dans
// creationService.js) par son CODE ("sciences"). shared/careerEligibility.js comparait
// directement `field === ctx.higherEd` (nom vs code) — toujours faux, aucun métier à études
// supérieures n'a jamais été sélectionnable. Corrigé ici en alignant `field` sur
// ref_backgrounds.code (type='higher_ed') ; l'affichage du libellé humain est désormais résolu
// séparément par l'appelant (creationService.js), pas stocké en dur dans cette table.
//
// Matché par `id` (pas par le texte de `field`, devenu ambigu une fois corrigé — deux textes
// différents, "Sciences/Sciences humaines" et "Sciences", visent le même code 'sciences') :
// ids fixes codés en dur dans la migration seed d'origine (293), donc identiques sur tout
// environnement ayant appliqué cette migration — pas un id généré par un seed indépendant
// (cf. SEED-ID-DETERM, .claude/rules/core.md).

const FIXES = [
  { id: '8d34a870-0cdc-4c72-bd1b-3bdb48b35ba8', from: 'Droit', to: 'droit' },
  { id: '8a021cec-4d2d-407a-b2ec-eccdf518f830', from: 'Sciences politiques', to: 'sciences_politiques' },
  { id: 'bedd2b2a-5426-431a-81b1-1de29d97a1fb', from: 'Sciences/Sciences humaines', to: 'sciences' },
  { id: 'd765177e-b40b-4d05-bf99-3532056240c8', from: 'Médecine', to: 'medecine' },
  { id: 'd77c84d7-4e2f-4c8e-8919-37cd3f642e58', from: 'École navale', to: 'ecole_navale' },
  { id: '02f55d0a-d252-418a-9781-30d155c0c3bd', from: 'École navale', to: 'ecole_navale' },
  { id: 'ba568ced-efdc-40e5-b99a-104d47c0ce4b', from: 'École militaire', to: 'ecole_militaire' },
  { id: 'ba618a18-b7f5-4d5a-8a36-2791865cbbe2', from: 'École militaire', to: 'ecole_militaire' },
  { id: '8e1226df-23b5-4d69-ac18-645907666c25', from: 'Sciences', to: 'sciences' },
  { id: '8b8c1a78-4ab5-4724-ab11-24c3cefbaf52', from: 'Sciences', to: 'sciences' },
  { id: 'fc32bcf1-0fe4-4ce3-ae17-10a5aeccc4a3', from: 'Sciences/Sciences humaines', to: 'sciences' },
  { id: 'ad205632-9d39-49d0-adf6-4c804acad527', from: "École d'ingénieur", to: 'ecole_ingenieurs' },
]

export async function up(knex) {
  for (const f of FIXES) {
    await knex('ref_career_education').where({ id: f.id, field: f.from }).update({ field: f.to })
  }
}

export async function down(knex) {
  for (const f of FIXES) {
    await knex('ref_career_education').where({ id: f.id, field: f.to }).update({ field: f.from })
  }
}
