// shared/reversEffectsData.js — Lot 6 (PLAN_WIZARD_AVANTAGES_IMPLANTATION.md §5bis) : traduction des
// 27 Revers (docs/REGLES/REVERS PROFESSIONNELS.md, table 1D100) en effects[] JSONB (vocabulaire
// shared/setbackEffects.js §8.1 du plan). Source unique — importée par la migration qui peuple
// ref_setbacks.effects ET par shared/reversEffectsData.test.mjs qui vérifie chaque ligne contre
// resolveSetbackEffects (aucune duplication entre migration et tests).
//
// Convention de traduction des pertes non chiffrées (vérifiée ligne par ligne contre le texte RAW,
// pas seulement le résumé "effet en clair" du plan) :
//   - un NOMBRE explicite ("perd 5 points de compétence") -> delta simple { type:'skill_points',
//     value:-5 } (perte partielle, le budget restant n'est pas remis à zéro).
//   - "TOUS ses points de compétence" (aucun nombre) -> perte totale de l'année, via
//     { type:'points_cap', scope:'skill_points', value:0 } — réutilise exactement le mécanisme déjà
//     décidé pour Renvoi (value:5, plafond partiel) ; value:0 = plafond nul = perte totale, sans
//     inventer de nouveau type (§8.1 : points_cap "plafonne le gain de l'année en cours").
//   - "toutes ses économies"/"tout l'argent" (aucun nombre) -> { type:'income_multiplier', value:0 },
//     rattaché au bloc de 5 ans précis via mapSetbackToCareerBlock (déjà le mécanisme existant pour
//     Renvoi, value:0.5) — value:0 = perte totale de ce bloc.
//   - Un Revers qui n'apporte AUCUN chiffre nouveau par rapport à un autre Revers déjà nommé (ex.
//     "Mise à pied temporaire" dans Complot/Faute lourde, formulation identique à Bannissement) suit
//     la même règle de traduction, jamais une magnitude inventée.
//
// Nouveaux mécanismes ajoutés pendant ce lot (documentés aussi dans shared/traitAggregation.js et
// shared/setbackEffects.js) :
//   - `trait` op:'gauge_fraction_delta' et `celebrity_fraction` (Diffamation/Trahison — fractions
//     du gain BRUT déjà accumulé, jamais un total connu du résolveur lui-même).
//   - `irradiation_reward` (Irradiation — jet 2D10 transmis tel quel en trait gauge_delta).
//   - `subroll.condition` (Polaris tier 2, "Culte du Trident" — pas un Revers nommé, donc pas
//     représentable via chained_setback+target ; un subroll direct avec choice() convient mieux).
//
// Candidats manual_grant_choice (advantage_id réels, ref_advantages migration 92, vérifiés en base
// 2026-07-22) :
//   phobia            -> adv_062 (créatures marines), adv_063 (maladies), adv_064 (mutants/hybrides),
//                         adv_065 (claustrophobie), adv_066 (milieu sous-marin)
//   mental_imbalance   -> adv_044 (cleptomanie), adv_045 (mégalomanie), adv_046 (paranoïa),
//                         adv_047 (hallucination), adv_048 (pulsion psychopathe),
//                         adv_049 (double personnalité)
//   wanted             -> adv_067 (recherché, petite communauté), adv_068 (recherché, nation/faction)
//   infirmity          -> adv_056 (5 PC), adv_057 (7 PC)
// grant_advantage automatiques (Mutilation, aucun choix — la sous-table RAW désigne le sens exact) :
//   adv_071 (vue), adv_072 (ouïe), adv_073 (odorat), adv_074 (toucher), adv_042 (allergie sévère)
//
// `[CORRIGÉ 2026-07-22, peuplement Lot 6]` PLAN_WIZARD_AVANTAGES.md §Lot C (l.533, décision du
// 2026-07-21) mentionnait "Ennemi/Ennemi important/Vendetta/Contrat via adv_050" — contredit par la
// correction du lendemain (l.513-516, même document) qui écarte explicitement adv_050/001/017 pour
// tout ce qui doit être COMPTÉ (contrainte unique partielle char_advantages, une seule ligne active
// par advantage_id). "Ennemi"/"Ennemi important" utilisent donc char_traits (trait_type:'enemy',
// gauge_delta +1), "important" porté par le champ `note` (texte, jamais consommé mécaniquement à ce
// stade — même principe que les jauges Allié/Contact, §Lot C : "à ce stade ce ne sont que des
// chiffres"). Seul "Recherché" (Vendetta) reste un vrai advantage_id (adv_067/068), jamais compté.

const PHOBIA_CANDIDATES = ['adv_062', 'adv_063', 'adv_064', 'adv_065', 'adv_066']
const MENTAL_IMBALANCE_CANDIDATES = ['adv_044', 'adv_045', 'adv_046', 'adv_047', 'adv_048', 'adv_049']
const WANTED_CANDIDATES = ['adv_067', 'adv_068']
const INFIRMITY_CANDIDATES = ['adv_056', 'adv_057']

// Perte totale (année en cours) — réutilisée telle quelle par Bannissement, Enlèvement, Fugitif,
// et les "Mise à pied temporaire" de Complot/Faute lourde (formulation RAW identique, §8.1).
const TOTAL_LOSS_THIS_YEAR = [
  { type: 'points_cap', scope: 'skill_points', value: 0 },
  { type: 'income_multiplier', value: 0 },
]

export const REVERS_ROLL_RANGES = [
  { name: 'Incident mineur sans conséquence', roll_min: 1, roll_max: 20 },
  { name: 'Accident', roll_min: 21, roll_max: 25 },
  { name: 'Attentat', roll_min: 26, roll_max: 28 },
  { name: 'Bannissement', roll_min: 29, roll_max: 31 },
  { name: 'Blessure', roll_min: 32, roll_max: 36 },
  { name: 'Catastrophe', roll_min: 37, roll_max: 39 },
  { name: 'Choc psychologique', roll_min: 40, roll_max: 48 },
  { name: 'Complot', roll_min: 49, roll_max: 51 },
  { name: 'Contamination/Maladie', roll_min: 52, roll_max: 54 },
  { name: 'Contrat', roll_min: 55, roll_max: 57 },
  { name: 'Deuil', roll_min: 58, roll_max: 60 },
  { name: 'Diffamation', roll_min: 61, roll_max: 62 },
  { name: 'Enlèvement', roll_min: 63, roll_max: 64 },
  { name: 'Emprisonnement', roll_min: 65, roll_max: 69 },
  { name: 'Ennemi', roll_min: 70, roll_max: 74 },
  { name: 'Ennemi important', roll_min: 75, roll_max: 79 },
  { name: 'Faute lourde', roll_min: 80, roll_max: 82 },
  { name: 'Fugitif', roll_min: 83, roll_max: 86 },
  { name: 'Mauvaise passe', roll_min: 87, roll_max: 92 },
  { name: 'Mutilation', roll_min: 93, roll_max: 93 },
  { name: 'Pillage', roll_min: 94, roll_max: 94 },
  { name: 'Polaris', roll_min: 95, roll_max: 95 },
  { name: 'Renvoi', roll_min: 96, roll_max: 96 },
  { name: 'Vendetta', roll_min: 97, roll_max: 97 },
  { name: 'Trahison', roll_min: 98, roll_max: 98 },
  { name: 'Irradiation', roll_min: 99, roll_max: 99 },
  { name: 'Relancer ou autre Revers au choix du MJ', roll_min: 100, roll_max: 100 },
]

export const REVERS_EFFECTS_BY_NAME = {
  'Incident mineur sans conséquence': [],

  Accident: [
    { type: 'skill_points', value: -5 },
    { type: 'chained_setback', target: 'Blessure', chance: { die: 'd10', hit: [1, 2] }, key: 'accident_blessure' },
  ],

  Attentat: [
    { type: 'skill_points', value: -5 },
    { type: 'chained_setback', target: 'Mutilation', chance: { die: 'd10', hit: [1, 2] }, key: 'attentat_mutilation' },
    { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5] }, key: 'attentat_deuil' },
  ],

  // RAW : "perd TOUS ses points de compétence et toutes ses économies cette année" — perte totale,
  // pas -5 (correction par rapport au stub de test shared/setbackEffects.test.mjs, jamais le
  // peuplement final, cf. son propre commentaire d'en-tête).
  Bannissement: [...TOTAL_LOSS_THIS_YEAR],

  Blessure: [
    { type: 'subroll', key: 'blessure_detail', die: 'd10', outcomes: [
      { range: [1, 1], effects: [{ type: 'attribute', target: 'FOR', value: -1 }] },
      { range: [2, 2], effects: [{ type: 'attribute', target: 'CON', value: -1 }] },
      { range: [3, 3], effects: [{ type: 'attribute', target: 'COO', value: -1 }] },
      { range: [4, 4], effects: [{ type: 'attribute', target: 'ADA', value: -1 }] },
      { range: [5, 5], effects: [{ type: 'attribute', target: 'PER', value: -1 }] },
      { range: [6, 6], effects: [{ type: 'attribute', target: 'INT', value: -1 }] },
      { range: [7, 7], effects: [{ type: 'attribute', target: 'VOL', value: -1 }] },
      { range: [8, 8], effects: [{ type: 'attribute', target: 'PRE', value: -1 }] },
      // 9/10 : handicap permanent chiffré, aucune règle du jeu ne sait le représenter aujourd'hui
      // (roadmap, §8.1 du plan) — narratif uniquement, jamais un silence non testé.
      { range: [9, 9], effects: [{ type: 'narrative', key: 'blessure.jambe_handicapee' }] },
      { range: [10, 10], effects: [{ type: 'narrative', key: 'blessure.bras_handicape' }] },
    ] },
  ],

  Catastrophe: [
    { type: 'skill_points', value: -5 },
    { type: 'income_multiplier', value: 0 },
    { type: 'chained_setback', target: 'Blessure', chance: { die: 'd10', hit: [1, 2, 3, 4] }, key: 'catastrophe_blessure' },
    { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6, 7, 8] }, key: 'catastrophe_deuil' },
    { type: 'chained_setback', target: 'Mutilation', chance: { die: 'd10', hit: [1, 2] }, key: 'catastrophe_mutilation' },
    // "S'exile si petite communauté" : narratif, hors mécanisation (dépend d'une donnée de
    // communauté non modélisée dans le Wizard).
    { type: 'narrative', key: 'catastrophe.exil_petite_communaute' },
  ],

  'Choc psychologique': [
    { type: 'subroll', key: 'choc_psy_detail', die: 'd10', outcomes: [
      { range: [1, 6], effects: [{ type: 'manual_grant_choice', trait_type: 'phobia', candidates: PHOBIA_CANDIDATES }] },
      { range: [7, 10], effects: [{ type: 'manual_grant_choice', trait_type: 'mental_imbalance', candidates: MENTAL_IMBALANCE_CANDIDATES }] },
    ] },
  ],

  Complot: [
    { type: 'subroll', key: 'complot_detail', die: 'd10', outcomes: [
      { range: [1, 1], effects: [{ type: 'apply_setback', target: 'Contrat' }] },
      { range: [2, 2], effects: [{ type: 'apply_setback', target: 'Bannissement' }] },
      { range: [3, 4], effects: [{ type: 'apply_setback', target: 'Emprisonnement' }] },
      { range: [5, 5], effects: [{ type: 'apply_setback', target: 'Fugitif' }] },
      { range: [6, 8], effects: [...TOTAL_LOSS_THIS_YEAR] },
      { range: [9, 9], effects: [{ type: 'apply_setback', target: 'Renvoi' }] },
      { range: [10, 10], effects: [{ type: 'reroll_table', count: 2 }] },
    ] },
  ],

  'Contamination/Maladie': [
    { type: 'subroll', key: 'contamination_detail', die: 'd10', outcomes: [
      { range: [1, 3], effects: [{ type: 'skill_points', value: -5 }] },
      { range: [4, 5], effects: [{ type: 'apply_setback', target: 'Blessure' }] },
      { range: [6, 7], effects: [{ type: 'narrative', key: 'contamination.virus_latent' }] },
      { range: [8, 9], effects: [{ type: 'narrative', key: 'contamination.maladie_incurable_non_contagieuse' }] },
      { range: [10, 10], effects: [{ type: 'narrative', key: 'contamination.maladie_incurable_contagieuse' }] },
    ] },
  ],

  // Ne prend effet qu'au début de la campagne — non mécanisé à la création, confirmé par Saar
  // (PLAN_WIZARD_AVANTAGES.md l.741).
  Contrat: [{ type: 'narrative', key: 'contrat.differe_campagne' }],

  Deuil: [{ type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 }],

  Diffamation: [
    { type: 'celebrity_fraction', value: -0.25 },
    { type: 'trait', trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
    { type: 'trait', trait_type: 'contact', op: 'gauge_fraction_delta', value: -0.5 },
  ],

  // RAW : "perd TOUS ses points de compétence ainsi que ses économies pour l'année" — perte totale.
  Enlèvement: [
    ...TOTAL_LOSS_THIS_YEAR,
    { type: 'chained_setback', target: 'Mutilation', chance: { die: 'd10', hit: [1, 2, 3, 4] }, key: 'enlevement_mutilation' },
  ],

  Emprisonnement: [
    {
      type: 'choice',
      key: 'emprisonnement_choix',
      options: [
        // "vieillit d'un an de plus, sans gagner d'année de carrière" : le Wizard ne simule pas
        // l'avancement d'âge automatique (années choisies directement par le joueur) — signalé au
        // joueur/MJ narrativement, à répercuter manuellement (même simplification déjà actée).
        { label: 'Purger sa peine', effects: [{ type: 'narrative', key: 'emprisonnement.accepte' }] },
        // "devient Recherché (sans compensation) et subit les effets du Revers Fugitif" —
        // apply_setback évite de dupliquer les effets réels de Fugitif (perte totale + Recherché).
        { label: "S'évader", effects: [{ type: 'apply_setback', target: 'Fugitif' }] },
      ],
    },
  ],

  Ennemi: [{ type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1 }],

  'Ennemi important': [{ type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1, note: 'important' }],

  // 2D10 (portée 2-20) — voir docs/REGLES/REVERS PROFESSIONNELS.md:154-169.
  'Faute lourde': [
    { type: 'subroll', key: 'faute_lourde_detail', die: '2d10', outcomes: [
      { range: [2, 4], effects: [{ type: 'income_multiplier', value: 0 }] },
      { range: [5, 5], effects: [{ type: 'apply_setback', target: 'Bannissement' }] },
      { range: [6, 7], effects: [{ type: 'apply_setback', target: 'Emprisonnement' }] },
      { range: [8, 9], effects: [{ type: 'apply_setback', target: 'Ennemi' }] },
      { range: [10, 11], effects: [{ type: 'apply_setback', target: 'Ennemi important' }] },
      { range: [12, 15], effects: [...TOTAL_LOSS_THIS_YEAR] },
      { range: [16, 18], effects: [{ type: 'apply_setback', target: 'Renvoi' }] },
      { range: [19, 19], effects: [{ type: 'apply_setback', target: 'Vendetta' }] },
      { range: [20, 20], effects: [{ type: 'reroll_table', count: 2 }] },
    ] },
  ],

  // RAW : "perd tout son argent et ses points de compétence cette année" — perte totale (même
  // formulation sans nombre que Bannissement/Enlèvement), corrigé par rapport au stub de test
  // (skill_points -5 seul, jamais le peuplement final).
  Fugitif: [
    ...TOTAL_LOSS_THIS_YEAR,
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: WANTED_CANDIDATES },
  ],

  'Mauvaise passe': [
    { type: 'income_multiplier', value: 0.5 },
    { type: 'skill_points', value: -5 },
  ],

  // 1D100 — docs/REGLES/REVERS PROFESSIONNELS.md:205-221. Plages fusionnées quand l'effet est
  // identique (01-08 -> Infirmité, variante à choisir à table quel que soit le membre précis perdu).
  Mutilation: [
    { type: 'subroll', key: 'mutilation_detail', die: 'd100', outcomes: [
      { range: [1, 8], effects: [{ type: 'manual_grant_choice', trait_type: 'infirmity', candidates: INFIRMITY_CANDIDATES }] },
      // "Jambe raide, vitesse réduite de moitié" : impossible à appliquer aujourd'hui (même souci
      // que Blessure 9/10) — narratif, roadmap.
      { range: [9, 10], effects: [{ type: 'narrative', key: 'mutilation.jambe_raide' }] },
      { range: [11, 18], effects: [{ type: 'grant_advantage', advantage_id: 'adv_071' }] },
      { range: [19, 30], effects: [{ type: 'grant_advantage', advantage_id: 'adv_072' }] },
      { range: [31, 42], effects: [{ type: 'grant_advantage', advantage_id: 'adv_073' }] },
      { range: [43, 54], effects: [{ type: 'grant_advantage', advantage_id: 'adv_074' }] },
      { range: [55, 66], effects: [{ type: 'grant_advantage', advantage_id: 'adv_042' }] },
      { range: [67, 78], effects: [{ type: 'attribute', target: 'PRE', value: -1 }] },
      { range: [79, 90], effects: [{ type: 'attribute', target: 'ADA', value: -1 }] },
      { range: [91, 100], effects: [{ type: 'attribute', target: 'COO', value: -1 }] },
    ] },
  ],

  Pillage: [
    { type: 'income_multiplier', value: 0 },
    { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6] }, key: 'pillage_deuil' },
    { type: 'chained_setback', target: 'Blessure', chance: { die: 'd10', hit: [1, 2, 3] }, key: 'pillage_blessure' },
    { type: 'chained_setback', target: 'Catastrophe', chance: { die: 'd10', hit: [1] }, key: 'pillage_catastrophe' },
  ],

  Polaris: [
    // Tier 1 (toujours) — docs/REGLES/REVERS PROFESSIONNELS.md:227-230.
    { type: 'chained_setback', target: 'Blessure', chance: { die: 'd10', hit: [1, 2, 3] }, key: 'polaris_blessure' },
    { type: 'chained_setback', target: 'Mutilation', chance: { die: 'd10', hit: [1] }, key: 'polaris_mutilation' },
    { type: 'chained_setback', target: 'Catastrophe', chance: { die: 'd10', hit: [1, 2, 3] }, key: 'polaris_catastrophe' },
    { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6] }, key: 'polaris_deuil' },
    // Tier 2 (uniquement si le personnage possède réellement le Polaris, §8.2 du plan) —
    // docs/REGLES/REVERS PROFESSIONNELS.md:230-236.
    { type: 'chained_setback', target: 'Fugitif', chance: { die: 'd10', hit: [1, 2] }, key: 'polaris_fugitif', condition: 'force_polaris' },
    { type: 'chained_setback', target: 'Ennemi important', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6] }, key: 'polaris_ennemi_important', condition: 'force_polaris' },
    { type: 'chained_setback', target: 'Bannissement', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6, 7, 8] }, key: 'polaris_bannissement', condition: 'force_polaris' },
    { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6, 7] }, key: 'polaris_deuil_tier2', condition: 'force_polaris' },
    // "Culte du Trident" n'est pas un Revers nommé (pas de target possible) — subroll direct avec un
    // choice(), gaté par la même condition que le reste du tier 2.
    { type: 'subroll', key: 'polaris_culte_detail', die: 'd10', condition: 'force_polaris', outcomes: [
      { range: [1, 7], effects: [{
        type: 'choice', key: 'polaris_culte_choix',
        options: [
          // Accepter = embrasser la profession de prêtre — changement de métier géré hors de la
          // création (§Lot D du plan), narratif ici.
          { label: 'Accepter (rejoindre le Culte du Trident)', effects: [{ type: 'narrative', key: 'polaris.culte_accepte' }] },
          { label: 'Refuser', effects: [{ type: 'apply_setback', target: 'Fugitif' }] },
        ],
      }] },
      { range: [8, 10], effects: [] },
    ] },
  ],

  Renvoi: [
    { type: 'points_cap', scope: 'skill_points', value: 5 },
    { type: 'income_multiplier', value: 0.5 },
  ],

  Vendetta: [
    { type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1, note: 'vendetta' },
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: WANTED_CANDIDATES },
  ],

  Trahison: [
    { type: 'trait', trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
    { type: 'trait', trait_type: 'contact', op: 'gauge_fraction_delta', value: -0.5 },
  ],

  Irradiation: [{ type: 'irradiation_reward', key: 'irradiation_score', die: '2d10' }],

  // Flux applicatif (relance du grand jet 1D100, ou choix MJ direct), jamais un effet JSON —
  // décision explicite, PLAN_WIZARD_AVANTAGES.md §8.1 note reroll_table.
  'Relancer ou autre Revers au choix du MJ': [],
}
