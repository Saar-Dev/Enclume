/**
 * ExoAttributesPanel.jsx — Section "Attributs de l'Armure" de ExoSheetWindow
 *
 * Base éditable copiée depuis le modèle choisi (PLAN_EXOARMURE.md §13.3, Lot B) — mirroir du bloc
 * "ATTRIBUTS DE L'ARMURE" de la fiche RAW (docs/REGLES/FDEA.webp) : RD/Blindage/Exo-Force/Malus
 * d'initiative. Vitesse et Modificateur de dommage (MD) restent hors périmètre de ce Lot (décision
 * Saar 2026-08-20 : Vitesse dépend d'un appel async à movementBudgetService, MD n'existe qu'en
 * server/src/lib/charStats.js — aucun des deux n'est dupliqué côté client pour un simple affichage).
 * RD/Blindage/Exo-Force effectifs viennent de computeExoStats(exo), même autorité que l'onglet
 * Identité, jamais un second calcul.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { computeExoStats } from '../../../shared/exoStats.js'

const LABEL_STYLE = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }
const INPUT_STYLE = { background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }

export default function ExoAttributesPanel({ characterId, exo, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const stats = computeExoStats(exo)

  const save = async (field, value) => {
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { [field]: value })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur mise à jour Attributs exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setSaving(false) }
  }

  const handleNumberBlur = (field) => {
    setEditingField(null)
    if (draft === '') { if (exo[field] != null) save(field, null); return }
    const val = parseInt(draft, 10)
    if (isNaN(val) || val === exo[field]) return
    save(field, val)
  }

  const handleTextBlur = (field) => {
    setEditingField(null)
    const val = draft.trim() || null
    if (val === (exo[field] ?? null)) return
    save(field, val)
  }

  const startEdit = (field) => { setDraft(exo[field] != null ? String(exo[field]) : ''); setEditingField(field) }

  const numberField = (field, labelKey, { width = '64px' } = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      {canEdit ? (
        <input
          type="number"
          value={editingField === field ? draft : (exo[field] ?? '')}
          onFocus={() => startEdit(field)}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => handleNumberBlur(field)}
          style={{ ...INPUT_STYLE, width }}
        />
      ) : (
        <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo[field] ?? '—'}</span>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={LABEL_STYLE}>{t('exo.fieldRd')}</label>
        <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{stats ? stats.rd : t('exo.statsUnavailable')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
        {numberField('base_blindage', 'exo.fieldBaseBlindage')}
        {stats && (
          <span style={{ fontSize: '12px', color: '#4a4a60' }}>
            {t('exo.effectiveArrow', { value: stats.bld })}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
        {numberField('base_exoforce', 'exo.fieldBaseExoforce')}
        {stats && (
          <span style={{ fontSize: '12px', color: '#4a4a60' }}>
            {t('exo.effectiveArrow', { value: stats.exf })}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={LABEL_STYLE}>{t('exo.fieldTypeCoque')}</label>
        {canEdit ? (
          <input
            type="text"
            value={editingField === 'type_coque' ? draft : (exo.type_coque ?? '')}
            onFocus={() => startEdit('type_coque')}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => handleTextBlur('type_coque')}
            style={{ ...INPUT_STYLE, width: '100%' }}
          />
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo.type_coque || '—'}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {numberField('malus_init_underwater', 'exo.fieldMalusIniUnderwater')}
        {numberField('malus_init_surface', 'exo.fieldMalusIniSurface')}
      </div>

      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
