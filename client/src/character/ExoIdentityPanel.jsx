/**
 * ExoIdentityPanel.jsx — Onglet Identité de ExoSheetWindow
 *
 * Pilote (exo_sheet.pilot_character_id, doit référencer un pj/pnj — invariant serveur §6.5 du
 * plan) + Modèle (exo_sheet.template_id, catalogue ref_exo_templates) + Caractéristiques dérivées
 * (EXF/BLD/RD), jamais stockées, recalculées via computeExoStats (shared/exoStats.js) à chaque
 * rendu à partir de l'Intégrité courante — aucune duplication de cette autorité ici.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { computeExoStats } from '../../../shared/exoStats.js'

export default function ExoIdentityPanel({ characterId, exo, templates, pilotCandidates, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  // Lot B (PLAN_EXOARMURE.md §13.3, 2026-08-20) — exo porte désormais sa propre base éditable
  // (category/base_exoforce/base_blindage copiés par applyExoTemplate), plus de reconstruction
  // manuelle depuis `templates` : même autorité que le serveur (shared/exoStats.js), un seul calcul.
  const template = templates.find(tpl => tpl.id === exo.template_id) || null
  const stats = computeExoStats(exo)

  const handlePilotChange = async (e) => {
    const pilot_character_id = e.target.value || null
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { pilot_character_id })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur assignation pilote exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setSaving(false) }
  }

  const handleTemplateChange = async (e) => {
    const template_id = e.target.value || null
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { template_id })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur assignation modèle exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Pilote */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('exo.pilotLabel')}
        </label>
        {canEdit ? (
          <select
            value={exo.pilot_character_id || ''}
            onChange={handlePilotChange}
            disabled={saving}
            style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '6px 10px', color: '#c0c0d0', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">{t('exo.pilotSelectPlaceholder')}</option>
            {pilotCandidates.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>
            {pilotCandidates.find(c => c.id === exo.pilot_character_id)?.name || t('exo.pilotNone')}
          </span>
        )}
      </div>

      {/* Modèle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('exo.templateLabel')}
        </label>
        {canEdit ? (
          <select
            value={exo.template_id || ''}
            onChange={handleTemplateChange}
            disabled={saving}
            style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '6px 10px', color: '#c0c0d0', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">{t('exo.templateSelectPlaceholder')}</option>
            {templates.length === 0 && (
              <option value="" disabled>{t('exo.templateNoneAvailable')}</option>
            )}
            {templates.map(tpl => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>
            {template?.name || t('exo.templateNone')}
          </span>
        )}
      </div>

      {/* Caractéristiques dérivées */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('exo.statsTitle')}
        </label>
        {stats ? (
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#c0c0d0' }}>
            <span>{t('exo.fieldExf')} : <strong>{stats.exf}</strong></span>
            <span>{t('exo.fieldBld')} : <strong>{stats.bld}</strong></span>
            <span>{t('exo.fieldRd')} : <strong>{stats.rd}</strong></span>
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: '#4a4a60', fontStyle: 'italic' }}>
            {t('exo.statsUnavailable')}
          </span>
        )}
      </div>

      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
