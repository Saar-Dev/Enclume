// shared/combatSituationMods.js — Modificateurs situationnels de combat (LdB p.217-218 et p.226-227) :
// situation Tir, situation CaC, taille de cible, portée.
// Autorité unique client (CombatModifiersWindow.jsx, CombatCacModifiersWindow.jsx — affichage/
// désactivation bouton) + serveur (socketCombatHelpers.js, calcul du Seuil réel + garde d'autorité,
// TIRIMP docs/BUGIDENTIFIE.md) — jamais deux tables recopiées à la main. Tables CaC/taille/portée
// rapatriées ici depuis socketCombatHelpers.js + copies client (PLAN_RW_SYSCOMBAT.md Lot 0, 2026-07-25,
// même geste que TIRIMP Session 166 pour le Tir). `impossible: true` remplace le sentinel numérique
// `-99` historique (bricolage : mélangeait un signal booléen "action interdite" avec une vraie somme de
// modificateurs, non consulté côté serveur — trouvé/corrigé Session 166). Pattern "predicate séparé
// du modificateur numérique" — même principe que les Rule Elements RollOption de PF2e/Foundry (déjà
// cité dans ce projet, `shared/weaponAmmoDsl.js`) : une condition qui autorise ou non l'action, jamais
// encodée comme une valeur numérique extrême. `limitative: true` (CaC terrain instable) suit le même
// principe : la valeur réelle est calculée par le serveur (compétence limitative Acrobatie/Équilibre,
// Math.min), jamais une constante — mod: 0 ici pour qu'une somme naïve reste inoffensive.
import { SIZE_CATEGORIES } from './sizeCategory.js'

export const RANGED_SITUATION_MODS = {
  cible_immobile:        { mod: 3 },
  cible_allure_moyenne:  { mod: -3 },
  cible_allure_rapide:   { mod: -5 },
  cible_allure_maximale: { mod: -7 },
  tireur_allure_lente:    { mod: -3 },
  tireur_allure_moyenne:  { mod: -5 },
  tireur_allure_rapide:   { mod: -7 },
  // REGLESYSCOMBAT.md:1444-1448 — Tireur à Allure maximale : Tir impossible, aucune exception RAW.
  tireur_allure_maximale: { mod: 0, impossible: true },
  couverture_partielle:  { mod: -3 },
  couverture_importante: { mod: -5 },
  obscurite_legere:      { mod: -3 },
  obscurite_importante:  { mod: -5 },
  // REGLESYSCOMBAT.md:1452-1457 — Obscurité totale : Tir impossible, sauf tir en aveugle (mécanisme
  // optionnel non implémenté — chantier séparé, voir docs/ROADMAP.md).
  obscurite_totale:      { mod: 0, impossible: true },
}

// Somme des modificateurs numériques pour une liste de clés — ignore `impossible` (géré séparément
// par isImpossibleSituation, jamais mélangé à la somme).
export function sumRangedSituationMods(situationKeys = []) {
  return situationKeys.reduce((sum, k) => sum + (RANGED_SITUATION_MODS[k]?.mod ?? 0), 0)
}

// Garde d'autorité — au moindre doute, l'appelant (client pour désactiver le bouton, serveur pour
// rejeter la déclaration) doit consulter cette fonction plutôt que comparer une valeur numérique.
export function isImpossibleRangedSituation(situationKeys = []) {
  return situationKeys.some(k => RANGED_SITUATION_MODS[k]?.impossible === true)
}

// ─── Allure tireur / cible dérivée du mouvement réel (LdB p.226-227 + Écran du MJ) ──
// L'allure n'est PAS une confirmation libre (comme couverture/obscurité) : c'est la
// conséquence mécanique du `movement_gait` déclaré. Le serveur la dérive de
// `combat_actions.movement_gait` (server/src/lib/combatAllureService.js) et réécrit
// `confirmedModifiers.situation` pour un joueur (socketCombatResolution.js) — un joueur
// ne choisit jamais sa propre allure ; le MJ garde la main via la fenêtre de modificateurs.
// gait ∈ 'lente' | 'moyenne' | 'rapide' | 'max' | null  (null = aucun déplacement ce Tour).
// Les 4 valeurs sont l'énumération de shared/combatMovement.js#COMBAT_MOVEMENT_GAITS, non
// importée ici pour ne pas tirer shared/world/ dans le bundle client — la divergence est
// couverte par combatSituationMods.test.mjs.
const SHOOTER_ALLURE_KEY_BY_GAIT = {
  lente:   'tireur_allure_lente',
  moyenne: 'tireur_allure_moyenne',
  rapide:  'tireur_allure_rapide',
  max:     'tireur_allure_maximale',
}

// Cible : la table RAW ne la pénalise qu'à partir de l'Allure moyenne ('lente' → aucune clé).
// gait null (aucun déplacement) → `cible_immobile` (+3, cible fixe, Écran du MJ) — jamais
// l'inverse : sur ce chemin il y a toujours une cible unique (l'AOE est exclue en amont).
const TARGET_ALLURE_KEY_BY_GAIT = {
  lente:   null,
  moyenne: 'cible_allure_moyenne',
  rapide:  'cible_allure_rapide',
  max:     'cible_allure_maximale',
}

// role ∈ 'shooter' | 'target' → clé de RANGED_SITUATION_MODS, ou null (aucun modificateur).
export function rangedAllureKeyForGait(gait, role) {
  if (role === 'shooter') return gait ? (SHOOTER_ALLURE_KEY_BY_GAIT[gait] ?? null) : null
  if (role === 'target')  return gait ? (TARGET_ALLURE_KEY_BY_GAIT[gait] ?? null) : 'cible_immobile'
  throw new Error(`rangedAllureKeyForGait : rôle inconnu "${role}"`)
}

// Toutes les clés de situation dérivées du mouvement (jamais une confirmation libre). Le gate
// joueur (socketCombatResolution.js) les retire du tableau client avant de réinjecter celles
// calculées par le serveur.
export const MOVEMENT_DERIVED_SITUATION_KEYS = [
  'tireur_allure_lente', 'tireur_allure_moyenne', 'tireur_allure_rapide', 'tireur_allure_maximale',
  'cible_immobile', 'cible_allure_moyenne', 'cible_allure_rapide', 'cible_allure_maximale',
]

// Garde de chargement — miroir de la garde TAILLE_MODS : casse si une clé d'allure (liste ou
// mapping) n'existe pas dans la table de valeurs (typo, palier retiré d'un seul côté).
for (const k of [
  ...MOVEMENT_DERIVED_SITUATION_KEYS,
  ...Object.values(SHOOTER_ALLURE_KEY_BY_GAIT),
  ...Object.values(TARGET_ALLURE_KEY_BY_GAIT),
].filter(Boolean)) {
  if (!(k in RANGED_SITUATION_MODS)) {
    throw new Error(`combatSituationMods : clé d'allure "${k}" absente de RANGED_SITUATION_MODS`)
  }
}

// Applique l'allure dérivée serveur à un tableau `confirmedModifiers.situation` : retire toute
// clé d'allure fournie par le client, réinjecte celles du serveur (filtre les null). Pure.
export function applyDerivedAllureToSituation(situation = [], { shooterAllureKey = null, targetAllureKey = null } = {}) {
  const kept = (situation ?? []).filter(k => !MOVEMENT_DERIVED_SITUATION_KEYS.includes(k))
  return [...kept, shooterAllureKey, targetAllureKey].filter(Boolean)
}

// ─── CaC §6.2 — modificateurs de situation attaquant (LdB p.217-218) ─────────
// cac_terrain_instable : compétence limitative (Acrobatie/Équilibre, Math.min côté serveur) — voir
// `limitative` dans l'en-tête. Le client l'affiche sans valeur fixe, le serveur le retire de la somme
// avant d'appliquer le calcul limitatif.
export const CAC_SITUATION_MODS = {
  cac_attaquant_cote:        { mod: -3 },
  cac_attaquant_au_sol:      { mod: -5 },
  cac_espace_confine:        { mod: -3 },
  cac_espace_tres_confine:   { mod: -5 },
  cac_position_avantageuse:  { mod: 3 },
  cac_main_non_directrice:   { mod: -5 },
  cac_terrain_instable:      { mod: 0, limitative: true },
}

// ─── Taille de la cible (LdB p.218) — commun CaC, Tir et drone ───────────────
// Modificateur au Test d'attaque par palier. L'énumération des 8 paliers est l'autorité de
// `shared/sizeCategory.js` (SIZE_CATEGORIES) ; ici on ne porte que la valeur du modificateur.
// La garde ci-dessous casse au chargement du module si les deux listes divergent (errata LdB
// appliqué d'un seul côté, ajout d'un palier oublié ici).
export const TAILLE_MODS = {
  minuscule:   { mod: -10 },
  tres_petite: { mod: -5 },
  petite:      { mod: -3 },
  moyenne:     { mod: 0 },
  grande:      { mod: 3 },
  tres_grande: { mod: 5 },
  enorme:      { mod: 10 },
  gigantesque: { mod: 15 },
}

if (
  Object.keys(TAILLE_MODS).length !== SIZE_CATEGORIES.length
  || SIZE_CATEGORIES.some(c => !(c in TAILLE_MODS))
) {
  throw new Error('combatSituationMods : TAILLE_MODS et SIZE_CATEGORIES (shared/sizeCategory.js) divergent')
}

// ─── Clés de `confirmedModifiers` réservées au MJ ───────────────────────────
// Un joueur qui résout sa propre attaque ne peut pas surcharger ces valeurs : elles sont alors
// dérivées de l'autorité serveur. `taille` : la taille de la cible est une propriété de la cible
// (dérivée de sa fiche, docs/PLANS/PLAN_TAILLE.md), pas un choix du tireur — contrairement à la
// couverture / l'obscurité / la situation, qui restent des confirmations métier libres.
// Filtrage centralisé à la réception du payload (socketCombatResolution.js), jamais dans chaque
// résolveur. Le client (fenêtres de modificateurs) consulte cette liste pour verrouiller le
// contrôle correspondant hors MJ.
export const GM_ONLY_CONFIRMED_MODIFIER_KEYS = ['taille']

export function stripGmOnlyModifiers(confirmedModifiers) {
  if (!confirmedModifiers) return confirmedModifiers
  const out = { ...confirmedModifiers }
  for (const key of GM_ONLY_CONFIRMED_MODIFIER_KEYS) delete out[key]
  return out
}

// ─── Portée (LdB p.226) — modificateur au Test selon le palier de portée ─────
export const PORTEE_MOD_COMP = {
  bout_portant: { mod: 5 },
  courte:       { mod: 0 },
  moyenne:      { mod: -5 },
  longue:       { mod: -10 },
  extreme:      { mod: -15 },
}
