import { isSuddenDeathLocation } from '../../../../shared/woundConstants.js'
import { LOCATION_I18N_KEYS } from '../../lib/locationI18nKeys.js'

// Libellés des blessures de l'écran de revue : AUCUN texte nouveau, uniquement les clés existantes (une information = un seul endroit).
//   - localisations : charSheet `locations.*` (LOCATION_I18N_KEYS) ;
//   - gravités : `locationPanel.severityShort.*` (courtes, pastilles) et `combat:resultPanels.severity.*` (« Blessure critique ») ;
//   - la 6ᵉ ligne (`mort_subite`) se lit « Mort » en Tête/Corps et « Membre détruit » sur un membre (`locationPanel.deathWord.*`, comme LocationPanel.jsx).
// `t` = namespace `combat`, `tChar` = namespace `charSheet`.

export function locationLabel(tChar, location) {
  return tChar(LOCATION_I18N_KEYS[location] ?? location, { defaultValue: location })
}

const deathKey = (location) => (isSuddenDeathLocation(location) ? 'locationPanel.deathWord.mort' : 'locationPanel.deathWord.membreDetruit')

export function severityShortLabel(tChar, severity, location) {
  return severity === 'mort_subite' ? tChar(deathKey(location)) : tChar(`locationPanel.severityShort.${severity}`, { defaultValue: severity })
}

export function severityLongLabel(t, tChar, severity, location) {
  return severity === 'mort_subite' ? tChar(deathKey(location)) : t(`resultPanels.severity.${severity}`, { defaultValue: severity })
}
