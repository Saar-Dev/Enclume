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
import ExoSilhouettePanel from './ExoSilhouettePanel.jsx'

const SEVERITIES = EXO_AVARIE_SEVERITY_ORDER.filter(s => s !== 'destruction')

// Colonnes texte ('Mod. incident'/'Perte ITG') resserrées à leur contenu réel — libellés complets
// conservés en `title` (tooltip natif, même idiome que ExoAttributesPanel.jsx#effectiveTooltip et
// ExoSystemsPanel.jsx#ref_description). Dommages (cases à cocher) en largeur fixe plutôt qu'en `1fr`
// (retour Saar 2026-09-15, 2e passe) : en `1fr` cette colonne s'étirait pour remplir tout l'espace
// restant, poussant Mod. incident loin à droite des cases — la largeur fixe cale la colonne suivante
// juste après les cases, et le tableau se resserre sur sa largeur utile réelle plutôt que de
// s'étaler jusqu'au bord de la fenêtre.
const GRID_COLUMNS = '90px 96px 80px 64px'

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
    // Tableau en largeur de contenu (`auto`, dictée par GRID_COLUMNS ci-dessus, fixe) + silhouette
    // flexible (`minmax(.., 1fr)`, occupe l'espace restant) — inversion du rapport initial (retour
    // Saar 2026-09-15, 2e passe : "agrandir la silhouette"). Même mécanisme qu'ArmorWoundPanel.jsx
    // côté humanoïde pour la colonne flexible (alignSelf:'stretch' + contain:'size' sur
    // ExoSilhouettePanel.jsx, borne sa hauteur à celle du tableau — jamais plus haut que lui).
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) auto', gap: '14px', alignItems: 'start' }}>
      <ExoSilhouettePanel exo={exo} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: '8px',
          fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span />
          <span>{t('exo.avarieColDommages')}</span>
          <span style={{ textAlign: 'center' }} title={t('exo.avarieColIncidentModifier')}>
            {t('exo.avarieColIncidentModifierShort')}
          </span>
          <span style={{ textAlign: 'center' }} title={t('exo.avarieColItgLoss')}>
            {t('exo.avarieColItgLossShort')}
          </span>
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

              <span style={{ color: '#8888a0', textAlign: 'center' }}>{fmtModifier(table.incidentModifier)}</span>
              <span style={{ color: '#8888a0', textAlign: 'center' }}>{table.itgLossStructure === 0 ? '-' : table.itgLossStructure}</span>
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
          <span style={{ textAlign: 'center' }}>-</span>
          <span style={{ textAlign: 'center' }}>{EXO_AVARIE_TABLE.destruction.itgLossStructure}</span>
        </div>
      </div>
    </div>
  )
}
