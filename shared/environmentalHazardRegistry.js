// shared/environmentalHazardRegistry.js — Registre unique des dangers environnementaux de combat
// (Acide/Décompression/Feu, Lot 3, docs/PLAN_FATIGUE_DOMMAGES.md §9). Patron registre/lookup repris de
// shared/echeanceTypeRegistry.js (Lot 2) — pas celui de shared/weaponModRegistry.js/resolveModHooks :
// aucune agrégation ni priorité entre entrées, un token peut porter plusieurs dangers simultanément
// (feu + acide en même temps, RAW ne l'interdit pas) mais chaque ligne `token_statuses` se résout
// indépendamment via un seul lookup (environmentalHazardService.js, F.4).
//
// Codes alignés (increment G, auto-relecture) sur `burning`/`acid`/`decompression` déjà présents dans
// `TokenStatusPanel.jsx`/`socketToken.js` (catégorie `dot` = "damage over time", icônes `/assets/
// status/*.svg` et clés i18n `status.*` déjà existantes) plutôt qu'un 2ᵉ vocabulaire (`on_fire`/
// `acid_exposure`) qui aurait dupliqué assets/i18n pour le même concept. Ces 3 codes étaient un simple
// toggle cosmétique sans effet mécanique avant ce Lot — migrés vers le vrai mécanisme ici, retirés du
// toggle nu (`socketToken.js:VALID_STATUS_CODES`).
//
// Forme d'une entrée : { code, forcedLocation }
// - code : `status_code` de la ligne `token_statuses`.
// - forcedLocation : clé de `shared/armorConstants.js` (LOCATION_TO_SLOT) forcée pour CE danger, quelle
//   que soit l'instance — Décompression uniquement (RAW : "pour simplifier, nous localiserons... dans
//   le Corps"). `null` = pas de valeur fixe au niveau du registre ; Acide/Feu portent alors leur
//   localisation par instance dans `token_statuses.data.forcedLocation` (choisie par le MJ à
//   l'exposition, RAW : "la Localisation exposée" — variable selon quelle partie du corps a touché la
//   flamme/l'acide), ou restent aléatoires (1D20 natif) si le MJ ne l'a pas renseignée — voir
//   environmentalHazardService.js pour la précédence registre > instance > aléatoire.
export const ENVIRONMENTAL_HAZARD_REGISTRY = [
  { code: 'acid',          forcedLocation: null },
  { code: 'decompression', forcedLocation: 'corps' },
  { code: 'burning',       forcedLocation: null },
]

// status_code inconnu → undefined, jamais une erreur — resolveEnvironmentalHazardTicks doit rester
// neutre sur une ligne qui ne correspond à aucune entrée (même patron que findEcheanceRegistryEntry) ;
// exposeToHazard, lui, lève une erreur métier explicite si le code demandé n'existe pas (F.2).
export function findHazardRegistryEntry(code) {
  return ENVIRONMENTAL_HAZARD_REGISTRY.find(entry => entry.code === code)
}
