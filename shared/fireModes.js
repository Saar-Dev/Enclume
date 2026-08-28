// shared/fireModes.js
//
// Format du champ catalogue `ref_equipment.fire_mode` : liste de modes séparés par `/`, insensible à
// la casse (ex. `"CC"`, `"CC/RC"`, `"cc/rc/rl"`). Autorité unique du parsing de ce format, réutilisée
// côté serveur (validation de déclaration de combat) et côté client (affichage du mode d'une arme) —
// `.claude/rules/core.md`, pas de logique métier dupliquée client/serveur.
//
// `CombatActionWindow.jsx` (PJ humain) fait encore ce parsing en inline (`.split('/').map(...)`) —
// pré-existant, non migré ici pour ne pas toucher au code de déclaration humain le plus joué ; à
// dédupliquer séparément si l'occasion se présente.

const FIRE_MODE_ORDER = ['CC', 'RC', 'RL']

/**
 * Découpe la liste de modes d'une arme en codes normalisés majuscules, dans l'ordre canonique
 * CC → RC → RL (le catalogue n'ordonne rien).
 * @param {string|null|undefined} refFireMode
 * @returns {string[]} ex. `['CC', 'RC']` — vide si l'arme n'a aucun mode (arme de contact).
 */
export function parseFireModes(refFireMode) {
  if (!refFireMode) return []
  const found = new Set(
    String(refFireMode)
      .split('/')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean),
  )
  return FIRE_MODE_ORDER.filter(m => found.has(m))
}

/**
 * Mode de tir par défaut d'une arme = le premier de sa liste dans l'ordre canonique. Une exo-armure
 * ne bascule jamais de mode (chaque hardpoint tire dans le mode fixe de son arme, PLAN_EXOARMURE.md
 * §16.4) : c'est donc CE mode qui s'applique toujours pour elle.
 * @param {string|null|undefined} refFireMode
 * @returns {string|null} `'CC'` | `'RC'` | `'RL'`, ou `null` si l'arme n'a aucun mode.
 */
export function firstFireMode(refFireMode) {
  return parseFireModes(refFireMode)[0] ?? null
}
