// shared/sizeCategory.js — L'échelle de taille d'un combattant : les 8 paliers RAW
// (« Taille de la cible », LdB p.218), la conversion d'une dimension en cm vers un palier,
// et la cascade qui résout la taille d'un personnage (explicite > dérivée > défaut).
//
// Responsabilité unique : produire un palier de taille. Le *modificateur de combat* associé
// à ce palier (−10 … +15) vit dans `shared/combatSituationMods.js` (TAILLE_MODS), qui
// importe SIZE_CATEGORIES d'ici pour garantir la couverture des 8 clés.
//
// Autorité RAW : docs/REGLES/REGLESYSCOMBAT.md:1382-1390 (table), docs/REGLES/REGLEDRONE.md
// (taille des drones donnée en clair comme catégorie), docs/REGLES/REGLEARMURE.md:18-42
// (hauteur des exo-armures par catégorie). Décisions house rule (breakpoints, clamp
// humanoïde, AOE sans taille) : docs/PLANS/PLAN_TAILLE.md + docs/JOURNAL8.md.

// Les 8 paliers, du plus petit au plus grand. Source unique de l'énumération : les clés de
// TAILLE_MODS, les CHECK SQL (characters.size_category) et les <select> client s'y réfèrent.
export const SIZE_CATEGORIES = [
  'minuscule', 'tres_petite', 'petite', 'moyenne',
  'grande', 'tres_grande', 'enorme', 'gigantesque',
]

// Frontières cm entre paliers. RAW ne donne que des repères représentatifs
// (30 · 50 · 100 · 170 humain · 300 · 500 · 700 · 1000 cm) en précisant « un guide, pas une
// loi gravée dans le marbre ». Les modificateurs Polaris (−10…+15) sont compressés près de
// l'humain et dilatés aux extrêmes — comme le Size Modifier logarithmique de GURPS : une
// frontière = moyenne GÉOMÉTRIQUE √(a·b) de deux repères adjacents, arrondie à l'entier.
//   √(30·50)=39  √(50·100)=71  √(100·170)=130  √(170·300)=226
//   √(300·500)=387  √(500·700)=592  √(700·1000)=837
// Un palier s'applique quand cm ≤ maxCm (et > le maxCm du palier précédent).
export const TAILLE_CM_BREAKPOINTS = [
  { maxCm: 39,       category: 'minuscule' },
  { maxCm: 71,       category: 'tres_petite' },
  { maxCm: 130,      category: 'petite' },
  { maxCm: 226,      category: 'moyenne' },
  { maxCm: 387,      category: 'grande' },
  { maxCm: 592,      category: 'tres_grande' },
  { maxCm: 837,      category: 'enorme' },
  { maxCm: Infinity, category: 'gigantesque' },
]

// Bornes de dérivation AUTO pour un humanoïde (pj/pnj) : `char_identity.height` est un champ
// narratif libre — le clamp protège d'une saisie absurde (18 au lieu de 1,8). Il ne borne
// JAMAIS une size_category explicite (un PNJ colossal reçoit 'enorme' posé à la main).
export const HUMANOID_SIZE_CLAMP_CM = { min: 120, max: 300 }

// Hauteur représentative par catégorie d'exo-armure (REGLEARMURE.md:18-42). La taille d'une
// exo-armure vient de son gabarit, pas d'une mesure saisie — `exo_sheet.taille` reste du
// texte narratif. Clés = valeurs de `exo_sheet.category` (migration 254).
export const EXO_CATEGORY_HEIGHT_CM = {
  'exo-alpha': 180,
  'exo-0': 190,
  'exo-1': 220,
  'exo-2': 250,
  'exo-3': 280,
  'exo-4': 330,
  'exo-5': 390,
  'exo-6': 450,
  'exo-omega': 460,
}

// Convertit une dimension (cm) en palier de taille, avec clamp optionnel.
// Retourne { category, cm, clamped } — `cm` est la valeur APRÈS clamp (celle réellement
// utilisée), `clamped` dit si le clamp a mordu. Entrée non finie → category null.
export function sizeCategoryFromCm(cm, { min, max } = {}) {
  if (typeof cm !== 'number' || !Number.isFinite(cm)) {
    return { category: null, cm: null, clamped: false }
  }
  const lo = typeof min === 'number' ? min : -Infinity
  const hi = typeof max === 'number' ? max : Infinity
  const clampedCm = Math.min(hi, Math.max(lo, cm))
  const entry = TAILLE_CM_BREAKPOINTS.find(b => clampedCm <= b.maxCm)
  return { category: entry.category, cm: clampedCm, clamped: clampedCm !== cm }
}

// Cascade pure de résolution de la taille d'un personnage. Aucune I/O : l'appelant fournit
// les champs déjà lus. Retourne { cm, category, source } où source ∈
//   'explicit'         — characters.size_category posé à la main (autoritaire, tout type)
//   'derived'          — calculé depuis les dimensions de la fiche
//   'derived-clamped'  — idem, mais le clamp humanoïde a mordu (UI : alerter)
//   'default'          — aucune donnée exploitable → 'moyenne'
// `cm` : la dimension résolue (utile à la future mise à l'échelle des tokens) ; null pour
// 'explicit' (choix d'un palier, pas d'une mesure) et 'default'.
export function resolveSizeCategoryFrom({
  type, sizeCategory, heightM, droneTailleCm, exoCategory,
} = {}) {
  if (sizeCategory != null && SIZE_CATEGORIES.includes(sizeCategory)) {
    return { cm: null, category: sizeCategory, source: 'explicit' }
  }

  if (type === 'pj' || type === 'pnj') {
    if (typeof heightM === 'number' && Number.isFinite(heightM)) {
      const r = sizeCategoryFromCm(Math.round(heightM * 100), HUMANOID_SIZE_CLAMP_CM)
      return { cm: r.cm, category: r.category, source: r.clamped ? 'derived-clamped' : 'derived' }
    }
  } else if (type === 'drone') {
    if (typeof droneTailleCm === 'number' && Number.isFinite(droneTailleCm)) {
      const r = sizeCategoryFromCm(droneTailleCm)
      return { cm: r.cm, category: r.category, source: 'derived' }
    }
  } else if (type === 'exo') {
    const exoCm = EXO_CATEGORY_HEIGHT_CM[exoCategory]
    if (typeof exoCm === 'number') {
      const r = sizeCategoryFromCm(exoCm)
      return { cm: r.cm, category: r.category, source: 'derived' }
    }
  }

  return { cm: null, category: 'moyenne', source: 'default' }
}
