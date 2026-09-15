/**
 * ExoNotesPanel.jsx — Champ Notes de la fiche exo-armure
 *
 * Extrait de ExoInfoPanel.jsx (retour Saar 2026-09-15 : "Notes à côté d'Intégrité", pas le panneau
 * Informations entier) — pairé avec ExoIntegrityPanel.jsx dans ExoSheetWindow.jsx, seul et unique
 * appairage 2 colonnes de la fiche. Même mécanisme de sauvegarde (miroir local + save au blur) que
 * les autres champs texte de la fiche exo (ExoInfoPanel.jsx/ExoAttributesPanel.jsx), réduit au seul
 * champ `notes`.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

const LABEL_STYLE = { fontSize: '12px', color: '#8a8aa0', whiteSpace: 'nowrap' }
const INPUT_STYLE = { background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '3px 6px', outline: 'none', minWidth: 0 }

export default function ExoNotesPanel({ characterId, exo, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(exo.notes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(exo.notes ?? '') }, [exo.notes])

  const handleBlur = async () => {
    const val = String(local).trim() || null
    if (val === (exo.notes ?? null)) { setLocal(exo.notes ?? ''); return }
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { notes: val })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur mise à jour Notes exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
      setLocal(exo.notes ?? '')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={LABEL_STYLE}>{t('exo.fieldNotes')}</label>
      {canEdit ? (
        <textarea
          rows={3}
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={handleBlur}
          style={{ ...INPUT_STYLE, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
      ) : (
        <span style={{ fontSize: '13px', color: '#c0c0d0', whiteSpace: 'pre-wrap' }}>{exo.notes || '—'}</span>
      )}
      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
