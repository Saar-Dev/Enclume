// shared/tokenStatusRegistry.js — Registre unique du vocabulaire des statuts de token
// (`token_statuses.status_code`, texte libre en base : aucune table catalogue, voir
// docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md §4 « Révision du Lot 1 »).
//
// Avant ce registre, la même liste de codes était recopiée dans `socketToken.js` (bascule autorisée),
// `TokenStatusPanel.jsx` (panneau) et `TokenPresentation.jsx` (catégorie/couleur des badges), et chaque
// règle « quels statuts bloquent / rendent sans défense / sont nettoyés » était un tableau littéral
// dispersé dans le moteur de combat. Ajouter un statut = ajouter UNE entrée ici.
//
// Patron : table de configuration dont les structures utiles sont DÉRIVÉES (jamais recopiées) — même
// forme que shared/environmentalHazardRegistry.js / shared/echeanceTypeRegistry.js, et que
// CONFIG.DND5E.conditionTypes (FoundryVTT dnd5e). Un rôle sémantique se lit ici, jamais par une chaîne
// en dur comparée dans le code (foundryvtt/foundryvtt#9245).
//
// Forme d'une entrée : { code, category, ...drapeaux } — un drapeau absent vaut `false`.
// - code     : `status_code` de la ligne `token_statuses`.
// - category : clé de TOKEN_STATUS_CATEGORY_COLORS (couleur du badge et du panneau).
// - manualToggle : accepté par TOKEN_STATUS_TOGGLE (socketToken.js). Les dangers environnementaux
//   (burning/acid/decompression) passent par exposeToHazard/clearHazard, jamais par la bascule nue
//   (elle écraserait la `data` posée) ; `evanoui` n'est posé que par la Fatigue.
// - inPanel  : affiché dans la grille de TokenStatusPanel (l'ordre du registre = l'ordre du panneau).
// - blocksDeclaration : le token ne peut plus déclarer d'action — la garde de RÉSOLUTION passe son tour
//   (socketCombatResolution.js, STUN2).
// - defenseless : la cible ne peut pas se défendre activement — DEF5 (socketCombatHelpers.js).
// - clearedAtCombatEnd : retiré du token à la fin du combat (socketCombatState.js).
//
// Hors registre (posés par leur propriétaire, sans entrée ici — chantier ultérieur) : `iem_survival`
// (iemSurvivalService.js) et les `statusCodes` de shared/weaponModRegistry.js (ati_offensive/
// ati_defensive). Toute recherche est donc TOLÉRANTE : un code inconnu renvoie `undefined`, jamais une
// erreur.

export const TOKEN_STATUS_CATEGORY_COLORS = {
  entrave:   '#d8a838',
  dot:       '#d84838',
  sens:      '#9858c8',
  chronique: '#38a8c8',
}

export const TOKEN_STATUS_REGISTRY = [
  { code: 'grappled',      category: 'entrave',   manualToggle: true,  inPanel: true },
  { code: 'restrained',    category: 'entrave',   manualToggle: true,  inPanel: true },
  { code: 'off_balance',   category: 'entrave',   manualToggle: true,  inPanel: true },
  { code: 'burning',       category: 'dot',                             inPanel: true },
  { code: 'acid',          category: 'dot',                             inPanel: true },
  { code: 'asphyxia',      category: 'dot',       manualToggle: true,  inPanel: true },
  { code: 'decompression', category: 'dot',                             inPanel: true },
  { code: 'electrocuted',  category: 'dot',       manualToggle: true,  inPanel: true },
  { code: 'stunned',       category: 'sens',      manualToggle: true,  inPanel: true,
    blocksDeclaration: true, defenseless: true, clearedAtCombatEnd: true },
  { code: 'unconscious',   category: 'sens',      manualToggle: true,  inPanel: true,
    blocksDeclaration: true, defenseless: true, clearedAtCombatEnd: true },
  { code: 'blinded',       category: 'sens',      manualToggle: true,  inPanel: true,
    defenseless: true },
  { code: 'evanoui',       category: 'sens' },
  { code: 'hypothermia',   category: 'chronique', manualToggle: true,  inPanel: true },
  { code: 'infected',      category: 'chronique', manualToggle: true,  inPanel: true },
  { code: 'poisoned',      category: 'chronique', manualToggle: true,  inPanel: true },
  { code: 'irradiated',    category: 'chronique', manualToggle: true,  inPanel: true },
]

// Code inconnu → undefined (voir « Hors registre » ci-dessus).
export function findTokenStatus(code) {
  return TOKEN_STATUS_REGISTRY.find(entry => entry.code === code)
}

function codesWhere(flag) {
  return TOKEN_STATUS_REGISTRY.filter(entry => entry[flag]).map(entry => entry.code)
}

// Structures dérivées — tableaux (et non Set) pour servir directement `whereIn('status_code', …)`.
export const MANUAL_TOGGLE_STATUS_CODES = codesWhere('manualToggle')
export const PANEL_STATUSES = TOKEN_STATUS_REGISTRY.filter(entry => entry.inPanel)
export const DECLARATION_BLOCKING_STATUS_CODES = codesWhere('blocksDeclaration')
export const DEFENSELESS_STATUS_CODES = codesWhere('defenseless')
export const COMBAT_END_CLEARED_STATUS_CODES = codesWhere('clearedAtCombatEnd')
