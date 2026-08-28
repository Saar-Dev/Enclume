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

// Instantané de l'état tactique persisté sur `combat_roster`, utilisé comme `payload` de `RESET`
// au changement de token ET au nouveau tour. Le serveur (`endTurn`) remet
// `state_position/cover/vitesse/combat_mode` aux défauts entre les tours — le client doit suivre,
// sinon une transition d'état fantôme fait rejeter le Tir visé et gonfle le coût d'Initiative.
// `weapon`/`fire_mode` ne sont PAS reset par `endTurn` : la valeur persistée est la bonne.
export function snapFromRosterEntry(entry) {
  return {
    position:  entry?.state_position  || 'standing',
    weapon:    entry?.state_weapon    || 'holstered',
    fire_mode: entry?.state_fire_mode || 'cc',
    cover:     entry?.state_cover     || 'exposed',
    vitesse:   entry?.state_vitesse   || 'normal',
  }
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

    // Reset complet — au changement de slot ET au nouveau tour (même sémantique : re-seeder
    // l'état tactique depuis le roster serveur). `action.payload` = `snapFromRosterEntry(entry)`.
    // Fusionne avec DECLARATION_INITIAL pour remettre combatMode + quick à zéro.
    // (Anciennement deux actions : `RESET_NEW_TURN` ne remettait que combatMode+quick, ce qui
    // laissait posture/couverture/vitesse périmées après un tour — bug Tir visé, corrigé 2026-08-28.)
    case 'RESET':
      return { ...DECLARATION_INITIAL, ...action.payload }

    default:
      return state
  }
}
