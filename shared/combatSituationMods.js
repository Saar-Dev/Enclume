// shared/combatSituationMods.js — Modificateurs de situation, Combat à Distance (LdB p.226-227).
// Autorité unique client (CombatModifiersWindow.jsx, affichage/désactivation bouton) + serveur
// (socketCombatHelpers.js, calcul du Seuil réel + garde d'autorité, TIRIMP docs/BUGIDENTIFIE.md) —
// jamais deux tables recopiées à la main. `impossible: true` remplace le sentinel numérique `-99`
// historique (bricolage : mélangeait un signal booléen "action interdite" avec une vraie somme de
// modificateurs, non consulté côté serveur — trouvé/corrigé Session 166). Pattern "predicate séparé
// du modificateur numérique" — même principe que les Rule Elements RollOption de PF2e/Foundry (déjà
// cité dans ce projet, `shared/weaponAmmoDsl.js`) : une condition qui autorise ou non l'action, jamais
// encodée comme une valeur numérique extrême.
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
