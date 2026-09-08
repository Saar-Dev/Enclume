import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { SIZE_CATEGORIES } from '../../../shared/sizeCategory.js'

// Champ « Taille » partagé par les fiches perso / drone / exo (PLAN_TAILLE.md S5).
// Lit / écrit characters.size_category via GET|PUT /char-sheet/:id/size. Le MJ choisit un des
// 8 paliers ou « Auto » (null → la taille est dérivée des dimensions de la fiche côté serveur).
// Hors MJ : lecture seule de la taille résolue.
// Les libellés des 8 paliers viennent du namespace `combat` (cacModifiers.tailles.*) — autorité
// unique, jamais recopiés ici (Règle 2).
const labelKey = (cat) => cat.replace(/_(.)/g, (_, c) => c.toUpperCase())

export default function SizeCategoryField({ characterId, canEdit = false }) {
  const { t } = useTranslation()
  const { t: tc } = useTranslation('combat')
  const [info, setInfo] = useState(null) // { explicit, resolved, derived, derivedCm, source }
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!characterId) return
    let cancelled = false
    api.get(`/char-sheet/${characterId}/size`)
      .then(res => { if (!cancelled) setInfo(res.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [characterId])

  if (!info) return null

  const palier = (cat) => tc(`cacModifiers.tailles.${labelKey(cat)}`)

  const handleChange = async (e) => {
    const value = e.target.value || null
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/size`, { size_category: value })
      setInfo(res.data)
    } catch { /* garde l'affichage courant */ }
    setSaving(false)
  }

  return (
    <div style={styles.wrap}>
      <span style={styles.label}>{t('charSheet.sizeField.label')}</span>
      {canEdit ? (
        <>
          <select value={info.explicit ?? ''} onChange={handleChange} disabled={saving} style={styles.select}>
            <option value="">{t('charSheet.sizeField.auto')}</option>
            {SIZE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{palier(cat)}</option>
            ))}
          </select>
          {!info.explicit && (
            <span style={styles.hint}>{t('charSheet.sizeField.autoResolved', { value: palier(info.derived) })}</span>
          )}
        </>
      ) : (
        <span style={styles.readonly}>
          {palier(info.resolved)}
          {info.source !== 'explicit' && <span style={styles.hint}> · {t('charSheet.sizeField.autoTag')}</span>}
        </span>
      )}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '2px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  select: { background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  readonly: { fontSize: '12px', color: '#c0c0d0', padding: '4px 0' },
  hint: { fontSize: '10px', color: '#64748b' },
}
