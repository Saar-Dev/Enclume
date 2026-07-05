// client/src/components/campaignSettings/SectionTokens.jsx
import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { sharedStyles as styles } from './sharedStyles'

export default function SectionTokens({ initialData, campaignId, onChange }) {
  const { t } = useTranslation()
  const [defaultTokenGlbUrl, setDefaultTokenGlbUrl] = useState(initialData.default_token_glb_url ?? null)
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
      const res = await api.post(`/campaigns/${campaignId}/default-token`, formData)
      const glbUrl = res.data.campaign.default_token_glb_url
      setDefaultTokenGlbUrl(glbUrl)
      onChange({ default_token_glb_url: glbUrl })
      setStatus('saved')
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      console.error('Erreur upload token par défaut :', err)
      setStatus('error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [campaignId, onChange])

  const handleClear = useCallback(async () => {
    setUploading(true)
    setStatus(null)
    try {
      await api.put(`/campaigns/${campaignId}`, { default_token_glb_url: null })
      setDefaultTokenGlbUrl(null)
      onChange({ default_token_glb_url: null })
      setStatus('saved')
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      console.error('Erreur réinitialisation token par défaut :', err)
      setStatus('error')
    } finally {
      setUploading(false)
    }
  }, [campaignId, onChange])

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{t('settings.sectionTokens')}</h2>
      <p style={styles.toggleLabel}>{t('settings.defaultTokenLabel')}</p>
      <p style={{ ...styles.toggleHint, marginBottom: '12px' }}>{t('settings.defaultTokenHint')}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={defaultTokenGlbUrl ? styles.tokenStatusSet : styles.tokenStatusNone}>
          {defaultTokenGlbUrl ? t('settings.defaultTokenSet') : t('settings.defaultTokenNone')}
        </span>
        <input ref={fileInputRef} type="file" accept=".glb" style={{ display: 'none' }} onChange={handleUpload} />
        <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? t('settings.defaultTokenUploading') : t('settings.defaultTokenUpload')}
        </button>
        {defaultTokenGlbUrl && (
          <button style={styles.btnDanger} onClick={handleClear} disabled={uploading}>
            {t('settings.defaultTokenClear')}
          </button>
        )}
        {status === 'saved' && <span style={styles.saveSuccess}>{t('settings.saved')}</span>}
        {status === 'error' && <span style={styles.saveError}>{t('settings.errorSave')}</span>}
      </div>
    </section>
  )
}