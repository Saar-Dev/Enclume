// sequellesConstants.js — Tables RAW « Séquelles » (LdB p.240-241, article Séquelles, OPTIONNEL).
//
// Une table par couple (Localisation × gravité) présentant un risque de séquelle — jet d'1D10.
// Fichier dédié plutôt qu'ajout à woundConstants.js (déjà 176 lignes) : 11 tables prévues, texte
// narratif volumineux, même logique que les autres familles RAW isolées dans leur propre fichier
// (exoConstants.js, fallDamageConstants.js, fatigueConstants.js).
//
// Forme commune : tableau de { min, max, effet }, `min === max` pour un résultat isolé — même
// convention que MOD_DOM_TABLE (server/src/lib/charStats.js). `effet` reproduit le texte RAW,
// restructuré en une phrase quand le RAW imbrique un sous-jet (ex. Tête/Mortelles/10 : sous-jet 1D6
// replié en une seule cellule, pas de table imbriquée — DataTableBlock ne le supporte pas et c'est
// le seul cas du corpus).
//
// Ajouté pour l'Encyclopédie : aucune consommation moteur à ce jour — même statut que
// BLESSURE_EFFETS_TABLE / CHOC_DUREE_TABLE.

// ─── Tête (LdB p.240) ─────────────────────────────────────────────────────
// Note RAW : les Blessures graves touchant d'autres Localisations ne laissent que des cicatrices
// (texte éditorial de l'article, pas une donnée — pas reproduit ici).
export const SEQUELLES_TETE_GRAVES_TABLE = [
  { min: 1,  max: 5,  effet: 'Pas de séquelle.' },
  { min: 6,  max: 7,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 8,  max: 9,  effet: 'Quelques dents cassées. Quel sourire ravageur !' },
  { min: 10, max: 10, effet: 'Nez cassé. La blessure est sans gravité, mais très douloureuse : toute nouvelle blessure à la tête entraîne un Test de résistance au Choc avec un malus de -5.' },
]

export const SEQUELLES_TETE_CRITIQUES_TABLE = [
  { min: 1, max: 4,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 5, max: 6,  effet: 'Mauvaise cicatrice, malus de -3 aux Tests visant à inspirer confiance, à séduire, etc.' },
  { min: 7, max: 7,  effet: "Mâchoire cassée, le personnage ne peut pas s’alimenter normalement tant que la blessure n’est pas guérie." },
  { min: 8, max: 8,  effet: "Nez cassé. La blessure est sans gravité, mais très douloureuse : toute nouvelle blessure à la tête entraîne un Test de résistance au Choc avec un malus de -5. Si la blessure s’est infectée, le personnage gagne le Désavantage Sens diminué (Odorat)." },
  { min: 9, max: 9,  effet: 'Oreille arrachée, le personnage gagne le Désavantage Sens diminué (Ouïe).' },
  { min: 10, max: 10, effet: "Œil touché. Si la blessure s’est infectée, le personnage gagne le Désavantage Sens diminué (Vue)." },
]

export const SEQUELLES_TETE_MORTELLES_TABLE = [
  { min: 1, max: 2, effet: 'Cicatrice légère, aucun effet.' },
  { min: 3, max: 3, effet: 'Mauvaise cicatrice, malus de -3 aux Tests visant à inspirer confiance, à séduire, etc.' },
  { min: 4, max: 4, effet: 'Cicatrice horrible, malus de -5 aux Tests visant à inspirer confiance, à séduire, etc.' },
  { min: 5, max: 5, effet: "Mâchoire arrachée, le personnage ne peut pas s’alimenter normalement tant que la blessure n’est pas guérie. Présence -2, malus de -7 aux Tests visant à inspirer confiance, à séduire, etc. Après la guérison, il ne pourra plus parler tant qu’il n’aura pas subi une opération de chirurgie esthétique susceptible de lui reconstituer une mâchoire." },
  { min: 6, max: 6, effet: 'Cordes vocales endommagées, le personnage ne peut plus parler qu’à travers un murmure rauque.' },
  { min: 7, max: 7, effet: 'Nez arraché, le personnage gagne le Désavantage Sens diminué (Odorat), Présence -2, malus de -7 aux Tests visant à inspirer confiance, à séduire, etc.' },
  { min: 8, max: 8, effet: 'Tympan détruit, le personnage gagne le Désavantage Sens diminué (Ouïe), et ne peut plus plonger à plus de 2 mètres de profondeur sans combinaison ou armure pressurisée.' },
  { min: 9, max: 9, effet: 'Œil crevé, le personnage gagne le Désavantage Sens diminué (Vue), malus de -5 aux Tests visant à inspirer confiance, à séduire, etc.' },
  { min: 10, max: 10, effet: "Cerveau endommagé, relancez 1D6 (l’un des rares cas où une opération chirurgicale ne sert à rien) : 1-3 pertes de mémoire (difficulté à se souvenir de choses banales, noms, dates…) ; 4 Présence -1 ; 5 Adaptation -1 ; 6 Intelligence -1." },
]

// ─── Corps (LdB p.240) ────────────────────────────────────────────────────
// Pas de table Graves (Corps) : le RAW ne prévoit de séquelle Corps qu'à partir des Critiques.
export const SEQUELLES_CORPS_CRITIQUES_TABLE = [
  { min: 1, max: 6,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 7, max: 8,  effet: 'Muscle touché / côtes brisées, même après guérison, le personnage subit un malus de -3 à toutes ses actions physiques pendant 1D6 semaines.' },
  { min: 9, max: 10, effet: 'Organe interne touché, même après guérison, le personnage subit un malus de -5 à toutes ses actions physiques pendant 2D6 semaines.' },
]

export const SEQUELLES_CORPS_MORTELLES_TABLE = [
  { min: 1, max: 3,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 4, max: 6,  effet: 'Organe interne touché, même après guérison, le personnage subit un malus de -5 à toutes ses actions physiques pendant 2D6 semaines.' },
  { min: 7, max: 7,  effet: 'Cage thoracique enfoncée, Constitution -1. Sans une intervention chirurgicale, le personnage subit un malus de -5 à toutes ses actions physiques.' },
  { min: 8, max: 8,  effet: 'Poumon perforé, Constitution -1. Sans une intervention chirurgicale, le personnage subit un malus de -7 à toutes ses actions physiques.' },
  { min: 9, max: 9,  effet: "Colonne vertébrale touchée. Sans une intervention chirurgicale, le personnage ne peut plus se déplacer qu’à l’Allure lente, et subit un malus de -7 à toutes ses actions physiques." },
  { min: 10, max: 10, effet: 'Organe interne détruit, Constitution -2. Le personnage est alité et doit absolument subir une opération pour remplacer l’organe détruit.' },
]

// ─── Bras (LdB p.241) ─────────────────────────────────────────────────────
// Pas de table Graves (Bras) : le RAW ne prévoit de séquelle Bras qu'à partir des Critiques.
export const SEQUELLES_BRAS_CRITIQUES_TABLE = [
  { min: 1, max: 6,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 7, max: 7,  effet: 'Doigts cassés, même après guérison, le personnage subit un malus de -5 à toutes les actions demandant de la précision, et nécessitant l’utilisation de cette main, pendant 1D6 semaines.' },
  { min: 8, max: 8,  effet: "Main/poignet abîmé(e), même après guérison, le personnage subit un malus de -5 à toutes les actions demandant de la précision ou de la force, et nécessitant l’utilisation de cette main, pendant 2D6 semaines." },
  { min: 9, max: 9,  effet: "Muscle touché / articulation abîmée / fracture grave du bras ou de l’épaule, même après guérison, le personnage subit un malus de -5 à toutes les actions physiques nécessitant l’usage de ce bras, pendant 2D6 semaines." },
  { min: 10, max: 10, effet: 'Doigts arrachés, le personnage subit un malus de -3 aux actions demandant de la précision et de -5 aux actions nécessitant de la force, lorsqu’il utilise cette main.' },
]

export const SEQUELLES_BRAS_MORTELLES_TABLE = [
  { min: 1, max: 3,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 4, max: 7,  effet: 'Main/poignet abîmé(e) : le personnage subit un malus de -5 à toutes les actions demandant de la précision ou de la force, et nécessitant l’utilisation de cette main.' },
  { min: 8, max: 10, effet: 'Muscle/articulation détruit(e), Force -1, le personnage subit un malus de -5 à toutes les actions physiques nécessitant l’usage de ce bras.' },
]

export const SEQUELLES_BRAS_MEMBRE_DETRUIT_TABLE = [
  { min: 1, max: 4,  effet: 'Main tranchée / détruite.' },
  { min: 5, max: 7,  effet: 'Avant-bras tranché / détruit.' },
  { min: 8, max: 10, effet: 'Bras tranché / détruit.' },
]

// ─── Jambes (LdB p.241) ───────────────────────────────────────────────────
// Pas de table Graves (Jambes) : le RAW ne prévoit de séquelle Jambes qu'à partir des Critiques.
export const SEQUELLES_JAMBES_CRITIQUES_TABLE = [
  { min: 1, max: 6,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 7, max: 8,  effet: "Pied/cheville/genou cassé(e), même après guérison, le personnage ne peut plus courir et subit un malus de -5 à toutes les actions nécessitant l’utilisation de cette jambe, pendant 1D6 semaines." },
  { min: 9, max: 10, effet: "Muscle touché / articulation abîmée / fracture grave, même après guérison, le personnage ne peut plus courir et subit un malus de -5 à toutes les actions nécessitant l’utilisation de cette jambe, pendant 2D6 semaines." },
]

export const SEQUELLES_JAMBES_MORTELLES_TABLE = [
  { min: 1, max: 3,  effet: 'Cicatrice légère, aucun effet.' },
  { min: 4, max: 7,  effet: 'Muscle/articulation abîmé(e) : le personnage ne peut plus courir (Allure rapide maximum), et subit un malus de -5 à toutes les actions nécessitant l’utilisation de cette jambe.' },
  { min: 8, max: 10, effet: 'Muscle/articulation détruit(e), Coordination -1, le personnage ne peut plus courir (Allure moyenne maximum), et subit un malus de -5 à toutes les actions nécessitant l’utilisation de cette jambe.' },
]

export const SEQUELLES_JAMBES_MEMBRE_DETRUIT_TABLE = [
  { min: 1, max: 4,  effet: 'Pied tranché / détruit.' },
  { min: 5, max: 7,  effet: 'Jambe tranchée / détruite, au niveau du genou.' },
  { min: 8, max: 10, effet: 'Jambe tranchée / détruite, au niveau de la cuisse ou de l’aine.' },
]
