// client/src/components/campaignSettings/SectionSources.jsx
// Onglet « Sources de contenu » — bascule par campagne des suppléments (PLAN_SUPPLEMENTS.md §2.3).
// Section autonome (comme SectionPlayers) : pas de batching dans le formulaire général de
// CampaignSettingsPage (pas de bouton "Enregistrer" à attendre) — une activation/désactivation
// écrit immédiatement via GET/POST/DELETE /campaigns/:id/sources, jamais fondu dans
// campaigns.settings (jsonb, réservé aux réglages scalaires — PLAN_SUPPLEMENTS.md §1.4).
// Le Livre de Base (is_core) est toujours actif, affiché sans case à cocher (rien à basculer).
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

export default function SectionSources({ campaignId }) {
  const { t } = useTranslation()

  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // busyId : source en cours de bascule — verrouille sa propre case sans bloquer les autres lignes.
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get(`/campaigns/${campaignId}/sources`)
      setSources(res.data.sources)
      setError(null)
    } catch {
      setError(t('settings.sourcesErrorLoad'))
    } finally {
      setLoading(false)
    }
  }, [campaignId, t])

  useEffect(() => { load() }, [load])

  const toggleSource = async (source) => {
    setBusyId(source.id)
    setError(null)
    const nextEnabled = !source.enabled
    // Optimiste : la case reflète tout de suite le geste, revert si l'appel échoue.
    setSources(prev => prev.map(s => s.id === source.id ? { ...s, enabled: nextEnabled } : s))
    try {
      if (nextEnabled) {
        await api.post(`/campaigns/${campaignId}/sources/${source.id}`)
      } else {
        await api.delete(`/campaigns/${campaignId}/sources/${source.id}`)
      }
    } catch {
      setSources(prev => prev.map(s => s.id === source.id ? { ...s, enabled: source.enabled } : s))
      setError(nextEnabled ? t('settings.sourcesEnableError') : t('settings.sourcesDisableError'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <section className="card"><p className="cs-placeholder-text">{t('common.loading')}</p></section>

  return (
    <section className="card">
      <h2 className="cs-section-title">{t('settings.sectionSources')}</h2>
      <p className="cs-toggle-hint" style={{ marginBottom: 16 }}>{t('settings.sourcesHint')}</p>

      {error && <p className="cs-save-error" style={{ marginBottom: 12 }}>{error}</p>}

      {sources.map(source => (
        <label key={source.id} className="cs-toggle-row" style={{ marginTop: 12, opacity: source.is_core ? 0.8 : 1 }}>
          <input
            type="checkbox"
            checked={source.enabled}
            disabled={source.is_core || busyId === source.id}
            onChange={() => toggleSource(source)}
            className="cs-checkbox"
          />
          <span className="cs-toggle-label">{source.name}</span>
          {source.is_core && <span className="cs-toggle-hint">({t('settings.sourcesCoreBadge')})</span>}
          {source.description && <span className="cs-toggle-hint">{source.description}</span>}
        </label>
      ))}
    </section>
  )
}
