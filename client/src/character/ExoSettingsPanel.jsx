/**
 * ExoSettingsPanel.jsx — Onglet Bio/Réglages de ExoSheetWindow
 *
 * Regroupe Bio (portrait, description, notes MJ) et Réglages (propriétaire, GLB, Coffre,
 * suppression) en un seul onglet — volume réduit pour un exo comparé à un humain, pas de raison de
 * les séparer en deux (CharacterWindow.jsx les sépare parce que PossessionNotes/print/GLB y
 * occupent bien plus de place). Champs `characters.*` type-agnostiques déjà génériques
 * (portrait_url/description/gm_notes/user_id/glb_url) — aucune nouvelle route serveur, patron
 * repris de CharacterWindow.jsx (Bio+Paramètres) et DroneWindow.jsx (SettingsTab).
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import api from '../lib/api.js'

export default function ExoSettingsPanel({ character, isGm, isOwner, onClose, templateIllustrationUrl }) {
  const { t } = useTranslation()
  const { members, updateCharacter, removeCharacter } = useCharacterStore()
  const canEdit = isGm || isOwner

  const [description, setDescription] = useState(character.description || '')
  const [gmNotes,     setGmNotes]     = useState(character.gm_notes    || '')
  useEffect(() => { setDescription(character.description || '') }, [character.description])
  useEffect(() => { setGmNotes(character.gm_notes || '') },       [character.gm_notes])

  const [portraitUploading, setPortraitUploading] = useState(false)
  const [glbUploading,      setGlbUploading]      = useState(false)
  const [sendingToVault,    setSendingToVault]    = useState(false)

  const handlePortraitUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPortraitUploading(true)
    try {
      const formData = new FormData()
      formData.append('portrait', file)
      const res = await api.post(`/characters/${character.id}/portrait`, formData)
      updateCharacter(res.data.character)
    } catch (err) { console.error('Erreur upload portrait :', err) }
    finally { setPortraitUploading(false); e.target.value = '' }
  }, [character.id, updateCharacter])

  const handleDescriptionBlur = useCallback(async () => {
    if (description === (character.description || '')) return
    try {
      const res = await api.put(`/characters/${character.id}`, { description })
      updateCharacter({ id: character.id, description: res.data.character.description })
    } catch (err) { console.error('Erreur sauvegarde description :', err) }
  }, [description, character.id, character.description, updateCharacter])

  const handleGmNotesBlur = useCallback(async () => {
    if (gmNotes === (character.gm_notes || '')) return
    try {
      const res = await api.put(`/characters/${character.id}`, { gm_notes: gmNotes })
      updateCharacter({ id: character.id, gm_notes: res.data.character.gm_notes })
    } catch (err) { console.error('Erreur sauvegarde notes MJ :', err) }
  }, [gmNotes, character.id, character.gm_notes, updateCharacter])

  const handleOwnerChange = async (e) => {
    const user_id = e.target.value || null
    try {
      const res = await api.put(`/characters/${character.id}`, { user_id })
      updateCharacter(res.data.character)
    } catch (err) { console.error('Erreur assignation propriétaire :', err) }
  }

  const handleGlbUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGlbUploading(true)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      const res = await api.post(`/characters/${character.id}/glb`, formData)
      updateCharacter(res.data.character)
    } catch (err) { console.error('Erreur upload GLB :', err) }
    finally { setGlbUploading(false); e.target.value = '' }
  }, [character.id, updateCharacter])

  const handleSendToVault = useCallback(async () => {
    if (!window.confirm(t('character.sendToVaultConfirm'))) return
    setSendingToVault(true)
    try {
      await api.post(`/char-sheet/${character.id}/clone-to-vault`)
      window.alert(t('character.sendToVaultSuccess'))
    } catch (err) {
      window.alert(err.response?.data?.error?.message || t('character.sendToVaultError'))
    } finally { setSendingToVault(false) }
  }, [character.id, t])

  const handleDelete = useCallback(async () => {
    if (!window.confirm(t('character.deleteConfirm'))) return
    try {
      await api.delete(`/characters/${character.id}`)
      removeCharacter(character.id)
      onClose()
    } catch (err) { console.error('Erreur suppression character :', err) }
  }, [character.id, removeCharacter, onClose, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Portrait — priorité au portrait custom de cette exo (characters.portrait_url), sinon repli sur
          l'illustration du modèle RAW d'origine (ref_exo_templates.illustration_url, migration 263) :
          trouvé manquant par Saar (RT-4/Vanguard sans illustration) — le repli n'existait pas encore. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {(character.portrait_url || templateIllustrationUrl) ? (
          <img
            src={`${import.meta.env.VITE_API_URL}/api/assets/${character.portrait_url || templateIllustrationUrl}`}
            alt={t('character.portraitAlt')}
            style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #2a2a3e' }}
          />
        ) : (
          <div style={{ width: '96px', height: '96px', borderRadius: '6px', border: '1px dashed #2a2a3e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', color: '#4a4a60', textAlign: 'center' }}>{t('character.illustrationPlaceholder')}</span>
          </div>
        )}
        {canEdit && (
          <label className="btn-ghost" style={{ alignSelf: 'flex-start', opacity: portraitUploading ? 0.5 : 1, pointerEvents: portraitUploading ? 'none' : 'auto' }}>
            {portraitUploading ? t('character.portraitUploading') : t('character.portraitUpload')}
            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePortraitUpload} />
          </label>
        )}
      </div>

      {/* Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('character.descriptionLabel')}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder={t('character.descriptionPlaceholder')}
          readOnly={!canEdit}
          style={{ width: '100%', minHeight: '70px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '8px', color: '#c0c0d0', fontSize: '12px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {/* Notes MJ */}
      {isGm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('character.gmNotesLabel')}
          </label>
          <textarea
            value={gmNotes}
            onChange={e => setGmNotes(e.target.value)}
            onBlur={handleGmNotesBlur}
            placeholder={t('character.gmNotesPlaceholder')}
            style={{ width: '100%', minHeight: '70px', background: '#16162a', border: '1px solid rgba(91,141,238,0.3)', borderRadius: '6px', padding: '8px', color: '#c0c0d0', fontSize: '12px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {/* Propriétaire */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('character.ownerLabel')}
        </label>
        {isGm ? (
          <select
            defaultValue={character.user_id || ''}
            onChange={handleOwnerChange}
            style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '6px 10px', color: '#c0c0d0', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">{t('character.noOwner')}</option>
            {members.filter(m => m.role === 'player').map(m => (
              <option key={m.id} value={m.id}>{m.username}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>
            {character.owner_username || t('character.noOwner')}
          </span>
        )}
      </div>

      {/* Upload GLB */}
      {isGm && (
        <label className="btn-ghost" style={{ alignSelf: 'flex-start', opacity: glbUploading ? 0.5 : 1, pointerEvents: glbUploading ? 'none' : 'auto' }}>
          {glbUploading ? t('character.glbUploading') : t('character.glbUpload')}
          <input type="file" accept=".glb" style={{ display: 'none' }} onChange={handleGlbUpload} />
        </label>
      )}

      {/* Envoi vers le Coffre */}
      {isOwner && (
        <button className="btn-ghost" onClick={handleSendToVault} disabled={sendingToVault} style={{ alignSelf: 'flex-start', opacity: sendingToVault ? 0.5 : 1 }}>
          {sendingToVault ? t('common.loading') : t('character.sendToVault')}
        </button>
      )}

      {/* Suppression */}
      {isGm && (
        <button className="btn-danger" onClick={handleDelete} style={{ alignSelf: 'flex-start' }}>
          {t('character.deleteCharacter')}
        </button>
      )}
    </div>
  )
}
