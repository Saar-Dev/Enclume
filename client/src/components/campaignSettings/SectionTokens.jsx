// client/src/components/campaignSettings/SectionTokens.jsx
import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { sharedStyles as styles } from './sharedStyles'

// Une ligne de repli par type de personnage (migration 256, demande Saar 2026-08-20 — drone/exo
// doivent avoir leur propre repli, comme l'humanoïde). Extrait en composant réutilisable dès la 2e
// répétition plutôt que copié-collé 3 fois (humanoïde/drone/exo) : même logique upload/clear, seuls
// le chemin de route et le nom de champ changent.
function DefaultTokenRow({ label, hint, campaignId, uploadPath, fieldName, value, onChange }) {
  const { t } = useTranslation()
  const [glbUrl, setGlbUrl] = useState(value ?? null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState(null)
  const fileInputRef = useRef(null)

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setStatus(null)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      const res = await api.post(`/campaigns/${campaignId}/${uploadPath}`, formData)
      const url = res.data.campaign[fieldName]
      setGlbUrl(url)
      onChange({ [fieldName]: url })
      setStatus('saved')
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      console.error(`Erreur upload token par défaut (${fieldName}) :`, err)
      setStatus('error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [campaignId, uploadPath, fieldName, onChange])

  const handleClear = useCallback(async () => {
    setUploading(true)
    setStatus(null)
    try {
      await api.put(`/campaigns/${campaignId}`, { [fieldName]: null })
      setGlbUrl(null)
      onChange({ [fieldName]: null })
      setStatus('saved')
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      console.error(`Erreur réinitialisation token par défaut (${fieldName}) :`, err)
      setStatus('error')
    } finally {
      setUploading(false)
    }
  }, [campaignId, fieldName, onChange])

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={styles.toggleLabel}>{label}</p>
      <p style={{ ...styles.toggleHint, marginBottom: '12px' }}>{hint}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={glbUrl ? styles.tokenStatusSet : styles.tokenStatusNone}>
          {glbUrl ? t('settings.defaultTokenSet') : t('settings.defaultTokenNone')}
        </span>
        <input ref={fileInputRef} type="file" accept=".glb" style={{ display: 'none' }} onChange={handleUpload} />
        <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? t('settings.defaultTokenUploading') : t('settings.defaultTokenUpload')}
        </button>
        {glbUrl && (
          <button className="btn btn-danger" onClick={handleClear} disabled={uploading}>
            {t('settings.defaultTokenClear')}
          </button>
        )}
        {status === 'saved' && <span style={styles.saveSuccess}>{t('settings.saved')}</span>}
        {status === 'error' && <span style={styles.saveError}>{t('settings.errorSave')}</span>}
      </div>
    </div>
  )
}

export default function SectionTokens({ initialData, campaignId, onChange }) {
  const { t } = useTranslation()

  return (
    <section className="card">
      <h2 style={styles.sectionTitle}>{t('settings.sectionTokens')}</h2>
      <DefaultTokenRow
        label={t('settings.defaultTokenLabelHumanoid')}
        hint={t('settings.defaultTokenHint')}
        campaignId={campaignId}
        uploadPath="default-token"
        fieldName="default_token_glb_url"
        value={initialData.default_token_glb_url}
        onChange={onChange}
      />
      <DefaultTokenRow
        label={t('settings.defaultTokenLabelDrone')}
        hint={t('settings.defaultTokenHintDrone')}
        campaignId={campaignId}
        uploadPath="default-token-drone"
        fieldName="default_token_glb_url_drone"
        value={initialData.default_token_glb_url_drone}
        onChange={onChange}
      />
      <DefaultTokenRow
        label={t('settings.defaultTokenLabelExo')}
        hint={t('settings.defaultTokenHintExo')}
        campaignId={campaignId}
        uploadPath="default-token-exo"
        fieldName="default_token_glb_url_exo"
        value={initialData.default_token_glb_url_exo}
        onChange={onChange}
      />
    </section>
  )
}
