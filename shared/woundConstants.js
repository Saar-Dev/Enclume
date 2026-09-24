import { MINUTES_PER_DAY } from './gameTime.js'

export const WOUND_LOCATIONS = [
  'tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche',
]

export const WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']

export const WOUND_MAX_COUNTS = {
  tete:          { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  corps:         { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
  bras_droit:    { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  bras_gauche:   { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_droite:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_gauche:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
}

// WNDMORT (docs/BUGIDENTIFIE.md) — REGLEBLESSURES.md, Blessures mortelles : « Malus aux Tests : non
// applicable, le blessé ne peut entreprendre aucune action demandant un Test. » `mortelle` n'a donc
// jamais de vraie valeur numérique (le -20 précédent était une extrapolation jamais confirmée par le
// LdB) — 0 ici uniquement en défense en profondeur (si un appelant futur oublie le garde
// `isTestBlockingWound`, il n'ajoute aucun malus fantôme, il n'en ajoute simplement aucun).
export const WOUND_PENALTIES = {
  legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: 0,
}

export const SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000',
}

// Sévérités qui interdisent tout Test (predicate séparé du malus numérique — même principe que
// `shared/combatSituationMods.js` RANGED_SITUATION_MODS.impossible, TIRIMP docs/BUGIDENTIFIE.md).
export const TEST_BLOCKING_SEVERITIES = ['mortelle']

export function isTestBlockingWound(wounds) {
  return (wounds ?? []).some(w => TEST_BLOCKING_SEVERITIES.includes(w.severity))
}

// Localisations où même le Déplacement (Allure lente) reste impossible pour une Blessure mortelle —
// LdB « Effets » : Jambes = déplacement impossible ; Bras/Corps/Tête = déplacement Allure lente
// maximum autorisé. Décision Saar (2026-07-19) : seules Déplacement (Allure lente) et Passer le tour
// restent des actions valides pour un personnage mortellement blessé (aucune des deux ne demande de
// Test) — tout le reste (attaque, corps à corps, interaction, rechargement) reste interdit.
export const MORTAL_WOUND_IMMOBILE_LOCATIONS = ['jambe_droite', 'jambe_gauche']

export function isMortalWoundImmobilized(wounds) {
  return (wounds ?? []).some(w => w.severity === 'mortelle' && MORTAL_WOUND_IMMOBILE_LOCATIONS.includes(w.wound_location))
}

// Table RAW « Durée de guérison et soins nécessaires » (REGLEBLESSURES.md:413-433, vérifiée
// 2026-07-30 contre Polaris 3ème édition p.238 — voir docs/PLAN_BLESSURES_GUERISON.md §3.2).
// `legere` volontairement absente : guérit seule, sans Test, jamais d'échéance `wound_healing_check`.
// soinsConstants=true -> échéance récurrente hebdomadaire (Test de Médecine chaque semaine) ;
// false -> échéance unique, ponctuelle, à la fin de la durée.
// "Membre détruit" non modélisé (Option de campagne différée, docs/ROADMAP.md) — une Mortelle sur
// Bras/Jambe suit la ligne `mortelle` ci-dessous, pas une ligne séparée.
export const WOUND_HEALING = {
  moyenne:  { durationMinutes: 3 * MINUTES_PER_DAY,  soinsConstants: false },
  grave:    { durationMinutes: 7 * MINUTES_PER_DAY,  soinsConstants: false },
  critique: { durationMinutes: 21 * MINUTES_PER_DAY, soinsConstants: true },
  mortelle: { durationMinutes: 35 * MINUTES_PER_DAY, soinsConstants: true },
}

// Table RAW « Infection » (REGLEBLESSURES.md:436-472, vérifiée 2026-07-30 contre Polaris 3ème
// édition p.239-240, docs/PLAN_BLESSURES_GUERISON.md §3.3). `legere` absente : jamais concernée.
// caseMalus : -2 au Test par case déjà cochée sur la ligne (localisation/gravité), en plus de la
// première — RAW explicite sur Grave/Critique/Mortelle, absent du texte pour Moyenne (relecture
// attentive : la ligne Moyenne ne mentionne aucun malus de ce type, contrairement aux trois autres).
// periodMalus : -2 cumulatif par période de 2 jours passée sans soins corrects — RAW explicite
// seulement pour Grave (réussite) et Critique (échec) ; ni Moyenne ni Mortelle ne le mentionnent
// (Mortelle : la conséquence est un compte à rebours en heures, aucune "période suivante" réaliste).
export const WOUND_INFECTION = {
  moyenne:  { baseModifier: 5,   caseMalus: false, periodMalus: false, infectsOnSuccess: false },
  grave:    { baseModifier: 0,   caseMalus: true,  periodMalus: true,  infectsOnSuccess: false },
  critique: { baseModifier: -5,  caseMalus: true,  periodMalus: true,  infectsOnSuccess: true },
  mortelle: { baseModifier: -10, caseMalus: true,  periodMalus: false, infectsOnSuccess: true },
}
// Table RAW « Seuils de blessures » (LdB p.234) — seuil de Dommages à partir duquel
// une blessure d'une gravité donnée est infligée. La gravité retenue est la plus
// haute dont le seuil est atteint ou dépassé.
//
// `key` reprend l'énumération WOUND_SEVERITIES (legere / moyenne / grave / critique /
// mortelle) — les libellés français vivent dans terms.json (domaine graviteBlessure).
//
// Le RAW porte une 6ᵉ ligne (seuil 30, « Mort subite / Membre détruit ») — règle
// optionnelle non implémentée côté moteur (même renvoi docs/ROADMAP.md que WOUND_HEALING
// ci-dessous). Elle n'est pas reproduite ici : l'Encyclopédie la documente en texte
// éditorial dans l'article, hors table.
//
// Ajouté pour l'Encyclopédie (Phase 3) ; consommée par le moteur via `woundSeverityForDamage` (gravité
// d'un coup porté à un drone, resolveDroneIntegrityLoss). Les humains passent par damageService.
export const BLESSURE_SEUILS_TABLE = [
  { key: 'legere',   seuil: 5  },
  { key: 'moyenne',  seuil: 10 },
  { key: 'grave',    seuil: 15 },
  { key: 'critique', seuil: 20 },
  { key: 'mortelle', seuil: 25 },
]

// Gravité correspondant à des Dommages nets : la plus haute ligne de BLESSURE_SEUILS_TABLE dont le seuil est
// atteint, ou null sous le premier seuil (aucune blessure). Sans la 6ᵉ ligne « Mort subite » (seuil 30) : un
// drone détruit à 30 et plus est une règle propre au drone, portée par resolveDroneIntegrityLoss.
export function woundSeverityForDamage(degatsNets) {
  let severity = null
  for (const { key, seuil } of BLESSURE_SEUILS_TABLE) {
    if (degatsNets >= seuil) severity = key
  }
  return severity
}

// Table RAW « Effets » (LdB p.235-236, article Description et effets des blessures) — pour les
// blessures Graves et plus sévères : Allure de déplacement maximum autorisée, et malus au Test de
// résistance au Choc (donnée distincte de WOUND_PENALTIES, qui porte le malus aux Tests général).
//
// Absente pour Légères/Moyennes (le RAW ne liste aucun Effet à ces degrés) et pour Mort subite (mort
// instantanée, aucun Test n'a lieu). `membreDetruit` ne porte que bras/jambes (par définition, un
// Membre détruit ne peut toucher que ces Localisations).
//
// Localisations RAW génériques (tete/corps/bras/jambes) — le RAW ne distingue pas gauche/droite ici,
// contrairement à WOUND_LOCATIONS (moteur, 6 localisations). `allure` : palier RAW ('lente' /
// 'moyenne' / 'impossible'). `malusChoc` : `0` = Test de Choc requis, RAW indique explicitement
// « aucun malus » (donnée réelle, pas une absence) ; `null` = aucun Test de Choc mentionné par le
// RAW à cette Localisation pour cette gravité (ex. Jambes/Grave : Allure réduite mais pas de Test).
//
// Bras absent en Grave — le RAW ne liste aucun Effet Bras à ce palier (Jambes/Corps/Tête seulement).
//
// Ajouté pour l'Encyclopédie : aucune consommation moteur à ce jour — même statut que
// DEPLACEMENT_ACTION_MALUS.
export const BLESSURE_EFFETS_TABLE = {
  grave: {
    jambes: { allure: 'moyenne', malusChoc: null },
    corps:  { allure: 'moyenne', malusChoc: 0 },
    tete:   { allure: 'moyenne', malusChoc: -5 },
  },
  critique: {
    bras:   { allure: 'moyenne', malusChoc: 0 },
    jambes: { allure: 'impossible', malusChoc: 0 },
    corps:  { allure: 'lente', malusChoc: -5 },
    tete:   { allure: 'lente', malusChoc: -10 },
  },
  mortelle: {
    bras:   { allure: 'lente', malusChoc: -5 },
    jambes: { allure: 'impossible', malusChoc: -5 },
    corps:  { allure: 'lente', malusChoc: -10 },
    tete:   { allure: 'lente', malusChoc: -15 },
  },
  membreDetruit: {
    bras:   { allure: 'lente', malusChoc: -10 },
    jambes: { allure: 'impossible', malusChoc: -10 },
  },
}

// Table RAW « Étourdissement, inconscience et catastrophes » (LdB p.237, article Choc) — durée des
// effets d'un Test de Choc raté, selon la gravité de la blessure qui l'a déclenché et sa Localisation.
//
// Trois colonnes RAW : `etourdissement` (durée avant de reprendre ses esprits si simplement Étourdi),
// `inconscience` (durée du coma si Inconscient), `catastrophe` (conséquence si le Test de Choc est
// raté sur une Catastrophe — parfois une durée aggravée, parfois un cas spécial).
//
// Valeurs en notation de dés ou « N TC » (Tour de combat) — texte RAW reproduit tel quel, pas de
// valeur numérique isolée à calculer (aucune consommation moteur, comme BLESSURE_EFFETS_TABLE).
// « Coma léger », « Coma profond » et « Stabilisation nécessaire » sont des cas spéciaux, pas des
// durées : ils renvoient aux paragraphes déjà présents dans l'article Choc (« Durée du Choc »), pas
// besoin de les redéfinir ici.
//
// Localisations génériques (tete/corps/brasJambes) — le RAW regroupe Bras et Jambes en une seule
// ligne dans cette table (contrairement à BLESSURE_EFFETS_TABLE, qui les distingue). `membreDetruit`
// ne porte que brasJambes (par définition).
export const CHOC_DUREE_TABLE = {
  grave: {
    tete:  { etourdissement: '2 TC',    inconscience: '2 minutes',   catastrophe: '1D6 minutes' },
    corps: { etourdissement: '1 TC',    inconscience: '1 minute',    catastrophe: '1 minute' },
  },
  critique: {
    tete:       { etourdissement: '3D6 TC', inconscience: '3D6 minutes', catastrophe: 'Coma léger' },
    corps:      { etourdissement: '2D6 TC', inconscience: '2D6 minutes', catastrophe: '3D6 minutes' },
    brasJambes: { etourdissement: '1D6 TC', inconscience: '1D6 minutes', catastrophe: '2D6 minutes' },
  },
  mortelle: {
    tete:       { etourdissement: '3D6 minutes', inconscience: 'Coma léger',           catastrophe: 'Coma profond' },
    corps:      { etourdissement: '2D6 minutes', inconscience: '3D6 minutes',          catastrophe: 'Stabilisation nécessaire' },
    brasJambes: { etourdissement: '1D6 minutes', inconscience: '2D6 minutes',          catastrophe: 'Stabilisation nécessaire' },
  },
  membreDetruit: {
    brasJambes: { etourdissement: '2D6 minutes', inconscience: '3D6 minutes', catastrophe: 'Stabilisation nécessaire' },
  },
}

// Table RAW « Durée de guérison et soins nécessaires » (LdB p.238, article Durée de guérison et
// soins) — vue complète pour l'Encyclopédie. Recoupe partiellement `WOUND_HEALING` (durée +
// soins constants, moyenne→mortelle) mais porte 2 colonnes que `WOUND_HEALING` n'a pas (soins
// nécessaires, Difficulté) et 2 lignes qu'il n'a pas non plus (`legere`, `membreDetruit` — absentes
// de `WOUND_HEALING` par choix moteur documenté sur sa propre déclaration, pas un oubli ici).
//
// Représentation parallèle assumée, pas une duplication silencieuse : `duree` est le texte RAW
// d'affichage (« 3 jours »), quand `WOUND_HEALING` porte la même durée en minutes pour le calcul
// moteur — même relation que DISTANCES_DEPLACEMENT_SOL/EAU vis-à-vis de calcAllureMoy/calcAllures
// (dataSources.js). Si `WOUND_HEALING` change un jour, vérifier ici aussi (même RAW p.238).
//
// `difficulte` : nombre, ou objet { brasJambe, corps, tete } pour `mortelle` (seule ligne où le RAW
// distingue la Localisation). `null` = pas de Test (Légères, guérison sans soins).
//
// Ajouté pour l'Encyclopédie : aucune consommation moteur à ce jour pour les champs propres à cette
// table (soinsNecessaires, difficulte) — même statut que BLESSURE_EFFETS_TABLE.
export const DUREE_GUERISON_SOINS_TABLE = {
  legere: {
    duree: '1 jour', guerisonNaturelle: true,
    soinsNecessaires: 'Aucune', difficulte: null, soinsConstants: false,
  },
  moyenne: {
    duree: '3 jours', guerisonNaturelle: true,
    soinsNecessaires: 'Médecine ou Premiers soins', difficulte: 5, soinsConstants: false,
  },
  grave: {
    duree: '1 semaine', guerisonNaturelle: true,
    soinsNecessaires: 'Médecine ou Premiers soins', difficulte: 3, soinsConstants: false,
  },
  critique: {
    duree: '3 semaines', guerisonNaturelle: false,
    soinsNecessaires: 'Médecine', difficulte: 0, soinsConstants: true,
  },
  mortelle: {
    duree: '5 semaines', guerisonNaturelle: false,
    soinsNecessaires: 'Chirurgie + Médecine',
    difficulte: { brasJambe: -3, corps: -5, tete: -7 },
    soinsConstants: true,
  },
  membreDetruit: {
    duree: '3 semaines', guerisonNaturelle: false,
    soinsNecessaires: 'Chirurgie + Médecine', difficulte: -3, soinsConstants: true,
  },
}
