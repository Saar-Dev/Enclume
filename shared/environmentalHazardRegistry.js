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
// DÉRIVÉ du catalogue danger (docs/PLANS/PLAN_ZONES_DANGER.md §14.4, Z1.3, 2026-09-27) : ce fichier
// n'est plus la source des chiffres — `shared/world/dangerCatalog.js` l'est. Une seule autorité par
// donnée (invariant 2) : `forcedLocation` vient de `definition.forcedLocation` (même champ que celui
// lu par `resolveDamageLine` en Z1), `lingersOnClear` vient de `remanence === 'fixed'` sur la ligne
// `damage` de la définition (trouvaille du run à vide du 2026-09-27, §14.8 pt7 — pas un 2ᵉ champ à
// maintenir à la main). Plusieurs définitions peuvent partager un `hazardCode` (les 4 `feu:*` →
// `burning`) : la première rencontrée (ordre du catalogue) fixe l'entrée, dédupliquée.
//
// Forme d'une entrée : { code, forcedLocation, lingersOnClear? }
// - code : `status_code` de la ligne `token_statuses`.
// - forcedLocation : clé de `shared/armorConstants.js` (LOCATION_TO_SLOT) forcée pour CE danger, quelle
//   que soit l'instance — Décompression uniquement (RAW : "pour simplifier, nous localiserons... dans
//   le Corps"). `null` = pas de valeur fixe au niveau du registre ; Acide/Feu portent alors leur
//   localisation par instance dans `token_statuses.data.forcedLocation` (choisie par le MJ à
//   l'exposition), ou restent aléatoires (1D20 natif) si le MJ ne l'a pas renseignée — voir
//   environmentalHazardService.js pour la précédence registre > instance > aléatoire.
// - lingersOnClear : le retrait peut laisser le danger persister quelques Tours (RAW Acide : « l'effet de
//   l'acide peut alors persister pendant 1D6 Tour(s) » en sortie de zone). Seul l'Acide. Autorité unique :
//   le serveur (clearHazard) refuse `linger` sans ce drapeau ; le panneau MJ n'ouvre un formulaire de retrait
//   que pour ces dangers (un retrait sans choix est direct, sans fenêtre de confirmation).
import { listDangerDefinitions } from './world/dangerCatalog.js'

// Ordre figé (historique, avant dérivation) — les tests deepEqual y sont sensibles, jamais l'ordre
// naturel du catalogue (qui listerait 'burning' en premier, feu:petit étant la 1ʳᵉ entrée).
const HAZARD_CODE_ORDER = ['acid', 'decompression', 'burning']

function deriveEnvironmentalHazardRegistry() {
  const byCode = new Map()
  for (const definition of listDangerDefinitions()) {
    if (!definition.hazardCode || byCode.has(definition.hazardCode)) continue
    const damageLine = definition.effects.find(effect => effect.type === 'damage')
    byCode.set(definition.hazardCode, {
      code: definition.hazardCode,
      forcedLocation: definition.forcedLocation,
      ...(damageLine?.remanence === 'fixed' ? { lingersOnClear: true } : {}),
    })
  }
  return HAZARD_CODE_ORDER.map(code => byCode.get(code)).filter(Boolean)
}

export const ENVIRONMENTAL_HAZARD_REGISTRY = deriveEnvironmentalHazardRegistry()

// status_code inconnu → undefined, jamais une erreur — resolveActiveEffects (effectLineResolverService.js)
// doit rester neutre sur une ligne qui ne correspond à aucune entrée (même patron que
// findEcheanceRegistryEntry) ; exposeToHazard, lui, lève une erreur métier explicite si le code
// demandé n'existe pas (F.2).
export function findHazardRegistryEntry(code) {
  return ENVIRONMENTAL_HAZARD_REGISTRY.find(entry => entry.code === code)
}
