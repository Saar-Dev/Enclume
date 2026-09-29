/**
 * ExoIdentityPanel.jsx — Onglet Identité de ExoSheetWindow
 *
 * Pilote (exo_sheet.pilot_character_id, doit référencer un pj/pnj — invariant serveur §6.5 du
 * plan) + Modèle (exo_sheet.template_id, catalogue ref_exo_templates). 2 colonnes côte à côte
 * (retour Saar 2026-08-20, layout resserré à l'inspiration de la fiche RAW). Les caractéristiques
 * dérivées (EXF/BLD/RD) vivent désormais dans l'onglet Attributs de l'Armure (ExoAttributesPanel,
 * même retour) — jamais dupliquées ici.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

const LABEL_STYLE = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }
const SELECT_STYLE = { background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '6px 10px', color: '#c0c0d0', fontSize: '12px', outline: 'none', cursor: 'pointer', width: '100%' }

// Regroupe par source (PLAN_SUPPLEMENTS.md §2, décision Saar 2026-09-29 : tag/optgroup seulement
// sur le contenu NON core, et seulement si au moins un supplément est actif — jamais de bruit
// visuel pour le cas courant "uniquement Livre de Base"). Le libellé de groupe vient de la donnée
// (`source_name`), jamais un "Livre de Base" codé en dur ici.
function groupBySource(list) {
  const groups = new Map()
  for (const tpl of list) {
    if (!groups.has(tpl.source_name)) groups.set(tpl.source_name, [])
    groups.get(tpl.source_name).push(tpl)
  }
  return [...groups.entries()]
}

export default function ExoIdentityPanel({ characterId, exo, templates, pilotCandidates, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const template = templates.find(tpl => tpl.id === exo.template_id) || null
  const hasSupplement = templates.some(tpl => !tpl.source_is_core)

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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

      {/* Pilote */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <label style={LABEL_STYLE}>{t('exo.pilotLabel')}</label>
        {canEdit ? (
          <select value={exo.pilot_character_id || ''} onChange={handlePilotChange} disabled={saving} style={SELECT_STYLE}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <label style={LABEL_STYLE}>{t('exo.templateLabel')}</label>
        {canEdit ? (
          <select value={exo.template_id || ''} onChange={handleTemplateChange} disabled={saving} style={SELECT_STYLE}>
            <option value="">{t('exo.templateSelectPlaceholder')}</option>
            {templates.length === 0 && (
              <option value="" disabled>{t('exo.templateNoneAvailable')}</option>
            )}
            {hasSupplement
              ? groupBySource(templates).map(([sourceName, tpls]) => (
                  <optgroup key={sourceName} label={sourceName}>
                    {tpls.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                    ))}
                  </optgroup>
                ))
              : templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))
            }
          </select>
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {template?.name || t('exo.templateNone')}
            {template && !template.source_is_core && (
              <span className="badge badge-source badge-compact">{template.source_name}</span>
            )}
          </span>
        )}
      </div>

      {saving && <span style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
