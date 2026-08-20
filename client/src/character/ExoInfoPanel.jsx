/**
 * ExoInfoPanel.jsx — Section "Informations sur l'Armure" de ExoSheetWindow
 *
 * Base éditable copiée depuis le modèle choisi (PLAN_EXOARMURE.md §13.3, Lot B) — mirroir du bloc
 * "INFORMATIONS SUR L'ARMURE" de la fiche RAW (docs/REGLES/FDEA.webp). Malus de Saisie/Armure à terre
 * sont des valeurs dérivées (EXO_GRAPPLE_MALUS_TABLE/EXO_PRONE_RECOVERY_TABLE, shared/exoConstants.js
 * — même source que le serveur, jamais un second tableau), pas des colonnes exo_sheet : "—" pour les
 * catégories sous le seuil RAW (exo-2+/exo-1+ respectivement).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { EXO_CATEGORY_ORDER, EXO_GRAPPLE_MALUS_TABLE, EXO_PRONE_RECOVERY_TABLE } from '../../../shared/exoConstants.js'

const LABEL_STYLE = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }
const INPUT_STYLE = { background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }

export default function ExoInfoPanel({ characterId, exo, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (field, value) => {
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { [field]: value })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur mise à jour Informations exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setSaving(false) }
  }

  const startEdit = (field) => { setDraft(exo[field] != null ? String(exo[field]) : ''); setEditingField(field) }

  const handleTextBlur = (field) => {
    setEditingField(null)
    const val = draft.trim() || null
    if (val === (exo[field] ?? null)) return
    save(field, val)
  }

  const handleNumberBlur = (field) => {
    setEditingField(null)
    if (draft === '') { if (exo[field] != null) save(field, null); return }
    const val = parseInt(draft, 10)
    if (isNaN(val) || val === exo[field]) return
    save(field, val)
  }

  const handleCategoryChange = (e) => save('category', e.target.value || null)

  const textField = (field, labelKey) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      {canEdit ? (
        <input
          type="text"
          value={editingField === field ? draft : (exo[field] ?? '')}
          onFocus={() => startEdit(field)}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => handleTextBlur(field)}
          style={{ ...INPUT_STYLE, width: '100%' }}
        />
      ) : (
        <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo[field] || '—'}</span>
      )}
    </div>
  )

  const numberField = (field, labelKey) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      {canEdit ? (
        <input
          type="number"
          value={editingField === field ? draft : (exo[field] ?? '')}
          onFocus={() => startEdit(field)}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => handleNumberBlur(field)}
          style={{ ...INPUT_STYLE, width: '80px' }}
        />
      ) : (
        <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo[field] ?? '—'}</span>
      )}
    </div>
  )

  const grappleMalus = exo.category ? (EXO_GRAPPLE_MALUS_TABLE[exo.category] ?? null) : null
  const proneRecovery = exo.category ? (EXO_PRONE_RECOVERY_TABLE[exo.category] ?? null) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={LABEL_STYLE}>{t('exo.fieldCategory')}</label>
        {canEdit ? (
          <select
            value={exo.category || ''}
            onChange={handleCategoryChange}
            disabled={saving}
            style={{ ...INPUT_STYLE, cursor: 'pointer' }}
          >
            <option value="">{t('exo.categorySelectPlaceholder')}</option>
            {EXO_CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo.category || '—'}</span>
        )}
      </div>

      {textField('tech_level', 'exo.fieldTechLevel')}
      {textField('taille', 'exo.fieldTaille')}
      {textField('type_batterie', 'exo.fieldTypeBatterie')}

      <div style={{ display: 'flex', gap: '16px' }}>
        {numberField('depth_operational', 'exo.fieldDepthOperational')}
        {numberField('depth_limit', 'exo.fieldDepthLimit')}
        {numberField('depth_crush', 'exo.fieldDepthCrush')}
      </div>

      {textField('autonomy', 'exo.fieldAutonomy')}

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={LABEL_STYLE}>{t('exo.fieldGrappleMalus')}</label>
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{grappleMalus ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={LABEL_STYLE}>{t('exo.fieldProneRecovery')}</label>
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{proneRecovery ?? '—'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={LABEL_STYLE}>{t('exo.fieldNotes')}</label>
        {canEdit ? (
          <textarea
            rows={3}
            value={editingField === 'notes' ? draft : (exo.notes ?? '')}
            onFocus={() => startEdit('notes')}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => handleTextBlur('notes')}
            style={{ ...INPUT_STYLE, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0', whiteSpace: 'pre-wrap' }}>{exo.notes || '—'}</span>
        )}
      </div>

      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
