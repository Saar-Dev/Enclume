import { useTranslation } from 'react-i18next'

// Texte flottant TEMPORAIRE (LOS/distance/portée) au clic direct sur un token — Saar 2026-07-31,
// répété explicitement : texte PUR, aucune fenêtre (pas de fond, pas de bordure, pas de cadre), 2s,
// à l'endroit du clic. text-shadow seul pour la lisibilité sur la scène 3D (pas un cadre). Cycle de
// vie porté par useCombatUIState.showTargetRecap (timer 2000ms) — ce composant est purement passif,
// aucune interaction, ne bloque aucun clic (pointerEvents: none).
//
// Bande de portée (shared/combatRange.js, codes bruts) -> clé i18n combat.json §modifiers.portees.
const RANGE_BAND_I18N_KEYS = {
  bout_portant: 'boutPortant', courte: 'courte', moyenne: 'moyenne', longue: 'longue', extreme: 'extreme',
}

export default function CombatTargetRecapToast({ recap }) {
  const { t } = useTranslation('combat')
  if (!recap) return null

  // +150px vers la droite du point de clic (retour Saar 2026-08-01 : +100 puis +50 supplémentaires).
  const style = recap.screenPos
    ? { ...styles.toast, left: `clamp(4px, ${recap.screenPos.x + 70}px, calc(100vw - 164px))`, top: `clamp(4px, ${recap.screenPos.y + 14}px, calc(100vh - 60px))` }
    : styles.toast

  return (
    <div style={style}>
      <div>{recap.losClear ? t('overlay.targetRecap.losClear') : t('overlay.targetRecap.losBlocked')}</div>
      <div>{t('modifiers.distanceLabel')} : {recap.distanceM.toFixed(1)}m{recap.band && ` (${t(`modifiers.portees.${RANGE_BAND_I18N_KEYS[recap.band] ?? recap.band}`)})`}</div>
    </div>
  )
}

const styles = {
  toast: {
    position: 'fixed',
    width: 160,
    fontSize: 13,
    fontWeight: 600,
    color: '#f0f0f8',
    textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)',
    lineHeight: 1.4,
    pointerEvents: 'none',
    zIndex: 1001,
  },
}
