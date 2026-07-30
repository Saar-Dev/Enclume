import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useCampaignStore } from '../stores/campaignStore'
import { useCharacterStore } from '../stores/characterStore'
import { projectGameTime, floorDiv, MINUTES_PER_DAY, DAYS_PER_MONTH, DAYS_PER_YEAR } from '../../../shared/gameTime.js'

// docs/PLAN_FATIGUE_DOMMAGES.md §7 (Lot 1) — horloge de campagne, onglet Règle du jeu = config du
// départ, ce widget = avance/recul en session. Lecture depuis les stores (P57, SYSTEME/REACT.md) —
// campaign.game_time_minutes est déjà tenu à jour en direct par useSessionSocket.js, aucun socket.on
// local ici.
//
// UX 2026-07-29 (retours Saar) — un bouton par unité de calendrier (Année/Mois/Jour/Heure/Minute) :
// simple clic ouvre un menu de durées relatives dimensionné à l'unité (patron du dropdown "Outils"
// déjà existant dans Sidebar.jsx) ; double-clic bascule le bouton en édition inline, valeur absolue
// (le bouton affiche déjà la valeur courante, taper la nouvelle est plus direct qu'un delta à
// calculer). Le 6e bouton "Autre" a été retiré (retour Saar : plus simple sans, et supprime le risque
// de dropdown en butée d'écran qui causait le bug de zIndex initial).
const MENUS = {
  year:   { labelKey: 'gameTimeYear',   options: [1, -1].map(y => ({ minutes: y * DAYS_PER_YEAR * MINUTES_PER_DAY, presetKey: '1an' })) },
  month:  { labelKey: 'gameTimeMonth',  options: [1, -1].map(m => ({ minutes: m * DAYS_PER_MONTH * MINUTES_PER_DAY, presetKey: '1mois' })) },
  day:    { labelKey: 'gameTimeDay',    options: [1, -1, 7, -7].map(d => ({ minutes: d * MINUTES_PER_DAY, presetKey: Math.abs(d) === 7 ? '1sem' : '1j' })) },
  hour:   { labelKey: 'gameTimeHour',   options: [1, -1, 6, -6].map(h => ({ minutes: h * 60, presetKey: Math.abs(h) === 6 ? '6h' : '1h' })) },
  minute: { labelKey: 'gameTimeMinute', options: [15, -15, 30, -30].map(m => ({ minutes: m, presetKey: Math.abs(m) === 30 ? '30min' : '15min' })) },
}
const UNIT_ORDER = ['year', 'month', 'day', 'hour', 'minute']
const EDIT_BOUNDS = { year: [1, 9999], month: [1, 12], day: [1, 31], hour: [0, 23], minute: [0, 59] }

export default function GameTimeWidget({ campaignId }) {
  const { t } = useTranslation()
  const { campaign } = useCampaignStore()
  const { isGm } = useCharacterStore()
  const rootRef = useRef(null)
  const editInputRef = useRef(null)

  const [submitting, setSubmitting] = useState(false)
  const [openMenu, setOpenMenu] = useState(null) // null | 'year'|'month'|'day'|'hour'|'minute'
  const [editingUnit, setEditingUnit] = useState(null) // idem, édition inline exclusive du menu
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (!openMenu) return
    const onMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [openMenu])

  useEffect(() => {
    if (editingUnit) editInputRef.current?.select()
  }, [editingUnit])

  const gameTimeMinutes = campaign?.game_time_minutes ?? 0
  const calendarStart = {
    calendar_start_year:  campaign?.settings?.calendar_start_year ?? 1,
    calendar_start_month: campaign?.settings?.calendar_start_month ?? 1,
    calendar_start_day:   campaign?.settings?.calendar_start_day ?? 1,
  }
  const projected = projectGameTime(gameTimeMinutes, calendarStart)

  // docs/PLAN_BLESSURES_GUERISON.md §6.1 — request-advance remplace adjust : si des échéances de
  // Guérison/Infection sont dues, le serveur pose l'avance en attente au lieu de l'appliquer tout de
  // suite. Ce composant n'a rien à faire du résultat `pending` lui-même — BlessuresReviewPanel.jsx,
  // toujours monté, réagit à l'événement CAMPAIGN_ADVANCE_PENDING que le serveur diffuse dans ce cas
  // (analyse à charge du plan : pas besoin d'un état partagé pour "ouvrir" le panneau depuis ici).
  const adjust = async (deltaMinutes) => {
    if (!deltaMinutes || submitting) return
    setSubmitting(true)
    try {
      await api.post(`/campaigns/${campaignId}/game-time/request-advance`, { minutes: deltaMinutes })
    } catch (err) {
      console.error('[GameTimeWidget] adjust:', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (unit) => {
    setOpenMenu(null)
    setEditingUnit(unit)
    setEditValue(String(projected[unit]))
  }

  const commitEdit = () => {
    const [min, max] = EDIT_BOUNDS[editingUnit]
    const raw = parseInt(editValue, 10)
    const unit = editingUnit
    setEditingUnit(null)
    if (isNaN(raw)) return
    const target = Math.min(max, Math.max(min, raw))

    if (unit === 'hour')   return adjust((target - projected.hour) * 60)
    if (unit === 'minute') return adjust(target - projected.minute)

    // year/month/day : recalcule l'index de jour absolu cible (les 2 autres champs date restent
    // à leur valeur actuelle), diffère de l'index courant — même formule que projectGameTime, inversée.
    const startDayIndex =
      (calendarStart.calendar_start_year - 1) * DAYS_PER_YEAR +
      (calendarStart.calendar_start_month - 1) * DAYS_PER_MONTH +
      (calendarStart.calendar_start_day - 1)
    const currentAbsoluteDay = startDayIndex + floorDiv(gameTimeMinutes, MINUTES_PER_DAY)
    const targetY = unit === 'year' ? target : projected.year
    const targetM = unit === 'month' ? target : projected.month
    const targetD = unit === 'day' ? target : projected.day
    const targetAbsoluteDay = (targetY - 1) * DAYS_PER_YEAR + (targetM - 1) * DAYS_PER_MONTH + (targetD - 1)
    adjust((targetAbsoluteDay - currentAbsoluteDay) * MINUTES_PER_DAY)
  }

  return (
    <div ref={rootRef} style={styles.container}>
      <div className="sidebar-glass gametime-pill">
        {UNIT_ORDER.map((unit, i) => (
          <div key={unit} style={{ position: 'relative', display: 'flex', alignItems: 'baseline' }}>
            {i > 0 && (
              <span className="gametime-sep">{unit === 'hour' ? '—' : unit === 'minute' ? ':' : '/'}</span>
            )}
            {editingUnit === unit ? (
              <input
                ref={editInputRef}
                type="number"
                className="gametime-edit-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingUnit(null)
                }}
                onBlur={() => setEditingUnit(null)}
              />
            ) : (
              <button
                type="button"
                className="gametime-value"
                disabled={!isGm}
                data-active={openMenu === unit}
                onClick={() => isGm && setOpenMenu(openMenu === unit ? null : unit)}
                onDoubleClick={() => isGm && startEdit(unit)}
                title={t(`session.${MENUS[unit].labelKey}`)}
              >
                {unit === 'hour' || unit === 'minute' ? String(projected[unit]).padStart(2, '0') : projected[unit]}
              </button>
            )}
            {openMenu === unit && (
              <div className="sidebar-tools-dropdown">
                {MENUS[unit].options.map(({ minutes, presetKey }, optionIndex) => (
                  <button key={optionIndex} type="button" className="sidebar-tools-dropdown-item enabled" disabled={submitting}
                    onClick={() => { setOpenMenu(null); adjust(minutes) }}>
                    {minutes > 0 ? '+' : '−'}{t(`session.gameTimePreset${presetKey}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: { padding: '8px 12px 8px 16px', borderBottom: '1px solid var(--wiz-glass-border)', flexShrink: 0 },
}
