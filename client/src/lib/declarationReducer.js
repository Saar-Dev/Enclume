// Reducer pur — zéro import React, zéro effet de bord.
// Partagé par CombatGmDeclareWindow et CombatActionWindow.

export const DECLARATION_INITIAL = {
  position:   'standing',
  weapon:     'holstered',
  fire_mode:  'cc',
  cover:      'exposed',
  vitesse:    'normal',
  combatMode: 'normal',
  quick: { observer: 0, reperer: 0, phrase: false },
}

/**
 * @param {object} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {object}
 */
export function declarationReducer(state, action) {
  switch (action.type) {
    // Modification d'un seul champ tactique (position/weapon/fire_mode/cover/vitesse)
    case 'SET_FIELD':
      return { ...state, [action.key]: action.value }

    // Mode de combat (normal/offensif/charge/defensif/retraite)
    case 'SET_COMBAT_MODE':
      return { ...state, combatMode: action.mode }

    // Action rapide (observer/reperer/phrase)
    case 'SET_QUICK':
      return { ...state, quick: { ...state.quick, [action.key]: action.value } }

    // Auto-draw : sélectionner assaut force weapon → 'drawn' atomiquement
    // Remplace le code ad-hoc dans GM (L.519) et lève le blocage Player (L.879)
    case 'SELECT_ATTACK':
      return { ...state, weapon: 'drawn' }

    // Reset complet sur changement de slot.
    // action.payload = { position, weapon, fire_mode, cover, vitesse } depuis rosterEntry.
    // Fusionne avec DECLARATION_INITIAL pour remettre combatMode et quick à zéro.
    case 'RESET':
      return { ...DECLARATION_INITIAL, ...action.payload }

    // Reset partiel nouveau tour (has_announced → false sans changement de token_id).
    // Remet uniquement quick + combatMode à zéro — NE touche PAS position/weapon/etc.
    case 'RESET_NEW_TURN':
      return { ...state, combatMode: 'normal', quick: { observer: 0, reperer: 0, phrase: false } }

    default:
      return state
  }
}
