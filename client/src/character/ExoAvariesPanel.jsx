/**
 * ExoAvariesPanel.jsx — Onglet Avaries de ExoSheetWindow
 *
 * Grille de cases par palier (mirror LocationPanel.jsx — les Avaries sont un système à seuils/cascade
 * comme les Blessures humaines, pas une paire max/courant comme l'Intégrité, PLAN_EXOARMURE.md §13.2).
 * Contrairement aux Blessures (rangées par localisation, chaque case a une identité propre), une
 * Avarie est un simple compteur par palier — n'importe quelle case vide déclenche la même pose,
 * n'importe quelle case pleine le même retrait, jamais de distinction par index.
 *
 * Pose : GM/propriétaire/pilote (comme le reste de la fiche, `canEdit`). Retrait : GM uniquement
 * (`isGm`) — outil de correction MJ, aucune contrepartie RAW côté joueur (§13.2, analyse à charge
 * 2026-08-20 : retirer une Avarie sans Test n'a pas d'équivalent légitime, contrairement à la
 * Guérison d'une Blessure).
 *
 * Anti-double-appel à la granularité de la ligne, pas de la case (§13.2, 2e tour d'analyse à charge) :
 * toutes les cases vides d'une même ligne posent la même Avarie, désactiver seulement la case cliquée
 * permettrait d'en poser deux via deux cases différentes pendant qu'une requête est en vol.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import {
  EXO_AVARIE_TABLE, EXO_AVARIE_SEVERITY_ORDER, EXO_AVARIE_COLUMN_BY_SEVERITY,
} from '../../../shared/exoConstants.js'

const SEVERITIES = EXO_AVARIE_SEVERITY_ORDER.filter(s => s !== 'destruction')

const GRID_COLUMNS = '90px 1fr 130px 150px'

function fmtModifier(n) {
  if (n === 0) return '-'
  return n > 0 ? `+${n}` : String(n)
}

export default function ExoAvariesPanel({ characterId, exo, canEdit, isGm, onExoUpdate }) {
  const { t } = useTranslation()
  const [pendingRow, setPendingRow] = useState(null) // severity en cours de requête, ou null

  const handleBoxClick = async (severity, filled) => {
    if (pendingRow === severity) return
    setPendingRow(severity)
    try {
      const res = filled
        ? await api.delete(`/char-sheet/${characterId}/exo/avaries/${severity}`)
        : await api.post(`/char-sheet/${characterId}/exo/avaries/${severity}`)
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur Avarie exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally {
      setPendingRow(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: '8px',
        fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        <span />
        <span>{t('exo.avarieColDommages')}</span>
        <span>{t('exo.avarieColIncidentModifier')}</span>
        <span>{t('exo.avarieColItgLoss')}</span>
      </div>

      {SEVERITIES.map(severity => {
        const table  = EXO_AVARIE_TABLE[severity]
        const column = EXO_AVARIE_COLUMN_BY_SEVERITY[severity]
        const count  = exo[column] ?? 0
        const rowPending = pendingRow === severity

        return (
          <div key={severity} style={{
            display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: '8px', alignItems: 'center',
            fontSize: '13px', color: '#c0c0d0',
          }}>
            <span>{t(`exo.avarie${severity.charAt(0).toUpperCase()}${severity.slice(1)}`)}</span>

            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: table.maxCount }).map((_, i) => {
                const filled    = i < count
                const permitted = filled ? isGm : canEdit
                const clickable = permitted && !rowPending
                return (
                  <div
                    key={i}
                    onClick={() => clickable && handleBoxClick(severity, filled)}
                    title={filled && isGm ? t('exo.avarieRemoveTooltip') : ''}
                    style={{
                      width: 14, height: 14,
                      border: `1px solid ${filled ? '#5a5a7a' : '#2a2a3e'}`,
                      background: filled ? '#c0505a' : 'transparent',
                      borderRadius: 2,
                      cursor: clickable ? 'pointer' : 'default',
                      opacity: rowPending ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>

            <span style={{ color: '#8888a0' }}>{fmtModifier(table.incidentModifier)}</span>
            <span style={{ color: '#8888a0' }}>{table.itgLossStructure === 0 ? '-' : table.itgLossStructure}</span>
          </div>
        )
      })}

      {/* Destruction — RAW : "pas de case" pour ce palier (§11.2), lecture seule */}
      <div style={{
        display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: '8px', alignItems: 'center',
        fontSize: '13px', color: '#8888a0',
      }}>
        <span>{t('exo.avarieDestruction')}</span>
        <span style={{ fontStyle: 'italic' }}>{t('exo.avarieDestruction')}</span>
        <span>-</span>
        <span>{EXO_AVARIE_TABLE.destruction.itgLossStructure}</span>
      </div>
    </div>
  )
}
