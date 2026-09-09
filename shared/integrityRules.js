// shared/integrityRules.js — Interprétation pure de l'Intégrité (ITG) du matériel : le palier
// d'état d'une pièce d'équipement, le modificateur d'utilisation associé, la table de qualité, et
// la math des pertes temporaires / définitives.
//
// Responsabilité unique : produire une lecture d'un couple (ITG courante / ITG max). AUCUN I/O,
// AUCUN jet de dé. Le jet du Test de panne vit dans `server/src/lib/polarisTestService.js`
// (`resolvePolarisTest`) ; le tirage d'une formule d'occasion (`QUALITY_TABLE.occasionFormula`)
// dans `server/src/lib/diceParser.js` (`parseDice`) — ce module ne fournit que la chaîne.
//
// Autorité de logique de jeu : `docs/MANUELS/MANUEL_USURE.md` (§3.1 qualité, §3.3 paliers/modif,
// §3.4 pertes, §4.1 issue du Test de panne).
// Autorité RAW : `docs/REGLES/REGLE_USURE&INTEGRITE.md`.
// Plan technique : `docs/PLANS/PLAN_USURE&INTEGRITE.md` §4 (L2).
//
// Patron : `shared/sizeCategory.js` — table `const` exportée, lookup `.find()`, entrée invalide
// → `null` (jamais un crash). Module client-importable (utilisé par le récap de déclaration de
// combat, PLAN §7.1.b/G1).

// ── Paliers d'état (MANUEL §3.3 / RAW « Niveau d'Intégrité et état du matériel ») ─────────────
// Ordre : du meilleur au pire — l'index sert à compter les franchissements de palier
// (`applyTemporaryLoss`). `min: null` / `max: null` = borne ouverte (RAW : « 0 et − » pour hors
// d'usage). `modifier` : bonus/malus RAW aux Tests du personnage qui utilise l'objet ; `null` pour
// hors d'usage (l'objet ne fonctionne plus — il n'y a aucun jet à modifier ; l'utilisabilité est
// une question binaire distincte, cf. `isIntegrityUsable`).
// `key` : consommé comme clé i18n côté client (comme `getMrDegreeKey`) — NE PAS renommer sans
// migrer les traductions.
export const INTEGRITY_TIERS = [
  { key: 'excellent',  min: 21,   max: null, modifier: 2 },
  { key: 'bon',        min: 16,   max: 20,   modifier: 0 },
  { key: 'moyen',      min: 11,   max: 15,   modifier: 0 },
  { key: 'usage',      min: 6,    max: 10,   modifier: -3 },
  { key: 'endommage',  min: 1,    max: 5,    modifier: -5 },
  { key: 'horsdusage', min: null, max: 0,    modifier: null },
]

function tierIndexOf(current) {
  return INTEGRITY_TIERS.findIndex(
    (t) => (t.min === null || current >= t.min) && (t.max === null || current <= t.max),
  )
}

// getIntegrityTier(current) — le palier d'état, ou `null` si `current` n'est pas un entier
// (item sans ITG : `integrity_current` NULL — l'appelant teste `has_integrity` en amont).
export function getIntegrityTier(current) {
  if (!Number.isInteger(current)) return null
  return INTEGRITY_TIERS[tierIndexOf(current)] ?? null
}

// getIntegrityModifier(current) — `+2 / 0 / -3 / -5` selon le palier, `null` pour hors d'usage
// (MANUEL §3.3, PLAN §4). Un appelant qui somme des modificateurs DOIT exclure le cas hors d'usage
// en amont (garde `isIntegrityUsable` / `integrity_current === 0`, PLAN §7.1.a) — ne jamais faire
// `total += getIntegrityModifier(x)` sans cette garde (`total + null` coerce en `total`, silencieux).
export function getIntegrityModifier(current) {
  const tier = getIntegrityTier(current)
  return tier ? tier.modifier : null
}

// isIntegrityUsable(current) — un objet suivi n'est utilisable que si son ITG courante est ≥ 1
// (RAW : « 0 et − : le matériel ne fonctionne plus »). Un objet NON suivi (`current` NULL) est
// toujours utilisable — l'appelant vérifie `has_integrity` en amont ; ce helper ne porte que la
// règle du 0. Seul un entier ≤ 0 renvoie `false`.
export function isIntegrityUsable(current) {
  if (!Number.isInteger(current)) return true
  return current >= 1
}

// ── Qualité (MANUEL §3.1 / RAW « INTÉGRITÉ ET QUALITÉ ») ──────────────────────────────────────
// `itgMax` : ITG max absolue de la qualité (= ITG courante d'un achat NEUF / marché noir).
// `occasionFormula` : formule du jet d'ITG courante pour un achat d'OCCASION (marché légal),
// résolue par `parseDice` côté serveur (G4), plafonnée à `itgMax`.
// Les clés sont EXACTEMENT celles du CHECK `chk_ref_equipment_quality` (migration 329).
// `bonne_qualite: '2D6+6'` est [INFÉRÉ] (le RAW écrit « pas de modif » ; 2D6+6 est le jet
// d'occasion par défaut de la règle générale d'achat) — MANUEL §3.1.
export const QUALITY_TABLE = {
  bas_cout:      { itgMax: 5,  occasionFormula: '1D4+1' },
  bon_marche:    { itgMax: 10, occasionFormula: '1D6+4' },
  standard:      { itgMax: 15, occasionFormula: '2D6+3' },
  bonne_qualite: { itgMax: 20, occasionFormula: '2D6+6' },
  excellente:    { itgMax: 25, occasionFormula: '3D6+5' },
}

// ── Pertes ───────────────────────────────────────────────────────────────────────────────────
// applyTemporaryLoss(current, max, loss) — applique une perte temporaire d'ITG courante et calcule
// la perte DÉFINITIVE d'ITG max qu'elle déclenche (MANUEL §3.4).
//   RAW « Perte définitive » : −1 ITG max par palier d'état franchi ; −1 ITG max si perte ≥ 5
//   points en une seule fois.
//   MANUEL §3.4 (décision Saar 2026-09-09) : quand un même coup déclenche les deux, on retient la
//   PLUS GRANDE des deux pénalités, jamais leur somme.
// `loss` est un entier déjà tiré (jamais une formule — G4). Une perte négative est ignorée
// (ce n'est pas une réparation : cf. `applyRepair`).
// Entrée supposée cohérente (CHECK L0 : `0 ≤ current ≤ max`, `1 ≤ max ≤ 25`).
export function applyTemporaryLoss(current, max, loss) {
  const appliedLoss = Math.max(0, loss)
  const newCurrentRaw = Math.max(0, current - appliedLoss)

  // Franchissements de palier vers le bas — « hors d'usage » (0) est un état de la même liste RAW,
  // y entrer compte comme un franchissement.
  const tiersCrossed = tierIndexOf(newCurrentRaw) - tierIndexOf(current)
  const lossPenalty = appliedLoss >= 5 ? 1 : 0
  const definitiveLoss = Math.max(tiersCrossed, lossPenalty)

  const newMax = Math.max(1, max - definitiveLoss) // plancher = CHECK L0 (integrity_max BETWEEN 1 AND 25)
  const newCurrent = Math.min(newCurrentRaw, newMax) // §3.4 : la courante ne dépasse jamais le max

  return { newCurrent, newMax, definitiveLoss, tiersCrossed }
}

// applyRepair(current, max, points) — ajoute `points` d'ITG courante, plafonné à `max` (RAW :
// « impossible de dépasser le niveau d'Intégrité maximum »). Ne touche JAMAIS `max` : une réussite
// de réparation ne récupère pas les pertes définitives (RAW). La Catastrophe de réparation
// (`max -= 1`) est gérée par `integrityService`, pas ici (elle n'ajoute pas de points).
// Renvoie la nouvelle ITG courante (un nombre).
export function applyRepair(current, max, points) {
  return Math.min(current + Math.max(0, points), max)
}

// interpretPanneOutcome(outcome) — traduit l'issue d'un `resolvePolarisTest(integrity_current)` en
// gravité de panne. Lit UNIQUEMENT `isSuccess` et `catastropheRisk` (MANUEL §4.1 : `isCriticalSuccess`
// et `mr` n'ont pas de sens pour un jet de fiabilité pure — ne jamais les lire).
//   réussite            → 'ok'      (rien ne se passe)
//   échec simple        → 'simple'  (−1 ITG, panne réparable normalement)
//   Catastrophe         → 'critical' (−1D6 ITG, réparation en atelier)
export function interpretPanneOutcome(outcome) {
  if (outcome?.isSuccess) return 'ok'
  return outcome?.catastropheRisk ? 'critical' : 'simple'
}
