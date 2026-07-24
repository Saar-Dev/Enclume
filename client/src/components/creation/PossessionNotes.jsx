// PossessionNotes.jsx — Wizard Step6 "Matériel & Biens" (docs/PLAN_WIZARD_MATERIEL.md §5).
//
// Extrait fin du bloc "Autres" d'AdvantagesPanel.jsx (char_advantage_notes, texte libre) — pas la
// modale entière (mutations/avantages/Force Polaris n'ont rien à faire ici). Même table, filtrée par
// la colonne discriminante category='possession' (migration 205) — jamais mélangée avec les notes
// narratives génériques de la fiche permanente (category='narrative', comportement inchangé là-bas).
//
// Lecture/écriture libre joueur ET MJ (décision Saar §0 du plan) — canEdit vient du parent, jamais
// recalculé ici. Suppression sans restriction (décision Saar explicite : "le jeu de rôle se joue sur
// la confiance") — même comportement que le bloc "Autres" d'origine, aucune garde isGm ajoutée.

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api.js'

export default function PossessionNotes({ characterId, canEdit }) {
  const { t } = useTranslation('creation')
  const [notes, setNotes] = useState([])
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get(`/char-sheet/${characterId}/advantage-notes`, { params: { category: 'possession' } })
      .then(res => { if (!cancelled) setNotes(res.data.notes || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [characterId])

  const handleAdd = useCallback(async () => {
    const trimmed = label.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const res = await api.post(`/char-sheet/${characterId}/advantage-notes`, {
        label: trimmed, category: 'possession',
      })
      setNotes(prev => [...prev, res.data.note])
      setLabel('')
    } catch {
      setError(t('materiel.notesError'))
    } finally {
      setSaving(false)
    }
  }, [characterId, label, t])

  const handleRemove = useCallback(async (note) => {
    setSaving(true)
    try {
      await api.delete(`/char-sheet/${characterId}/advantage-notes/${note.id}`)
      setNotes(prev => prev.filter(n => n.id !== note.id))
    } catch {
      setError(t('materiel.notesError'))
    } finally {
      setSaving(false)
    }
  }, [characterId, t])

  return (
    <div style={s.container}>
      <h3 style={s.title}>{t('materiel.notesTitle')}</h3>
      <p style={s.desc}>{t('materiel.notesDesc')}</p>

      <div style={s.list}>
        {notes.length === 0 && <div style={s.empty}>{t('materiel.notesEmpty')}</div>}
        {notes.map(note => (
          <div key={note.id} style={s.row}>
            <span style={s.label}>{note.label}</span>
            {canEdit && (
              <button style={s.removeBtn} onClick={() => handleRemove(note)} disabled={saving}>×</button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div style={s.addRow}>
          <textarea
            style={s.textarea}
            placeholder={t('materiel.notesPlaceholder')}
            maxLength={255}
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <button style={s.addBtn} onClick={handleAdd} disabled={!label.trim() || saving}>
            {t('materiel.notesAdd')}
          </button>
        </div>
      )}

      {error && <p style={s.error}>{error}</p>}
    </div>
  )
}

const s = {
  container: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: { color: '#9090c8', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },
  desc: { color: '#6a6a8a', fontSize: 11, margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  empty: { color: '#4a4a60', fontSize: 12, fontStyle: 'italic' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #1e1e2e', borderRadius: 4, backgroundColor: 'rgba(6,6,14,0.6)' },
  label: { color: '#c0c0d0', fontSize: 12, flex: 1 },
  removeBtn: { background: 'none', border: 'none', color: '#e05c5c', cursor: 'pointer', fontSize: 16, padding: '0 4px' },
  addRow: { display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 },
  textarea: { flex: 1, minHeight: 50, backgroundColor: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: 4, color: '#c0c0d0', fontSize: 12, padding: 8, resize: 'vertical' },
  addBtn: { padding: '8px 16px', border: 'none', borderRadius: 4, backgroundColor: '#5b8dee', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  error: { color: '#e05c5c', fontSize: 11, margin: 0 },
}
