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

// ─── Portée (LdB p.226) — modificateur au Test selon le palier de portée ─────
export const PORTEE_MOD_COMP = {
  bout_portant: { mod: 5 },
  courte:       { mod: 0 },
  moyenne:      { mod: -5 },
  longue:       { mod: -10 },
  extreme:      { mod: -15 },
}
