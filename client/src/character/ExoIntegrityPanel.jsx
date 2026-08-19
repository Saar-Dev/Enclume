/**
 * ExoIntegrityPanel.jsx — Onglet Intégrité de ExoSheetWindow
 *
 * Structure/Exosquelette/Générateur (max + actuelle), `exo_sheet` (migration 233). Patron repris de
 * DroneSheet.jsx (IntegritySection) : input numérique, sauvegarde au blur, GM/propriétaire/pilote
 * seuls éditeurs. `computeExoStats` (Identité) dépend de ces valeurs *_current — toute modification
 * ici change donc aussi EXF/BLD affichés sur l'onglet Identité (même source, jamais dupliquée).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

const COMPONENTS = [
  { key: 'structure',    labelKey: 'exo.integrityStructure' },
  { key: 'exosquelette', labelKey: 'exo.integrityExosquelette' },
  { key: 'generator',    labelKey: 'exo.integrityGenerator' },
]

export default function ExoIntegrityPanel({ characterId, exo, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [editingField, setEditingField] = useState(null) // ex. 'structure_current'
  const [draft,        setDraft]        = useState('')
  const [saving,        setSaving]       = useState(false)

  const handleBlur = async (field) => {
    setEditingField(null)
    const val = parseInt(draft, 10)
    if (isNaN(val) || val === exo[field]) return
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo/integrity`, { [field]: val })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur mise à jour Intégrité exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {COMPONENTS.map(({ key, labelKey }) => {
        const currentField = `itg_${key}_current`
        const maxField      = `itg_${key}_max`
        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t(labelKey)}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#c0c0d0' }}>
              {canEdit ? (
                <input
                  type="number"
                  min={0}
                  value={editingField === currentField ? draft : (exo[currentField] ?? '')}
                  onFocus={() => { setDraft(String(exo[currentField] ?? '')); setEditingField(currentField) }}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => handleBlur(currentField)}
                  style={{ width: '48px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '2px 4px', textAlign: 'center', outline: 'none' }}
                />
              ) : (
                <strong>{exo[currentField] ?? '—'}</strong>
              )}
              <span>/</span>
              {canEdit ? (
                <input
                  type="number"
                  min={0}
                  value={editingField === maxField ? draft : (exo[maxField] ?? '')}
                  onFocus={() => { setDraft(String(exo[maxField] ?? '')); setEditingField(maxField) }}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => handleBlur(maxField)}
                  style={{ width: '48px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '2px 4px', textAlign: 'center', outline: 'none' }}
                />
              ) : (
                <span>{exo[maxField] ?? '—'}</span>
              )}
            </div>
          </div>
        )
      })}

      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
