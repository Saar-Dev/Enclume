/**
 * ExoInfoPanel.jsx — Section "Informations sur l'Armure" de ExoSheetWindow
 *
 * Base éditable copiée depuis le modèle choisi (PLAN_EXOARMURE.md §13.3, Lot B) — mirroir du bloc
 * "INFORMATIONS SUR L'ARMURE" de la fiche RAW (docs/REGLES/FDEA.webp), grille 2 colonnes compacte
 * (retour Saar 2026-08-20 — layout d'origine en pile verticale illisible). Malus de Saisie/Armure à
 * terre sont des valeurs dérivées (EXO_GRAPPLE_MALUS_TABLE/EXO_PRONE_RECOVERY_TABLE,
 * shared/exoConstants.js — même source que le serveur, jamais un second tableau), pas des colonnes
 * exo_sheet : "—" pour les catégories sous le seuil RAW (exo-2+/exo-1+ respectivement).
 *
 * Édition — même correctif que ExoAttributesPanel.jsx (retour Saar, seconde passe) : un miroir local
 * unique par champ (jamais de bascule focus-dépendante) évite les flèches +/- inertes sur les champs
 * numériques et la valeur qui "revient" avant la fin de la sauvegarde async.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { EXO_CATEGORY_ORDER, EXO_GRAPPLE_MALUS_TABLE, EXO_PRONE_RECOVERY_TABLE } from '../../../shared/exoConstants.js'

const NUMBER_FIELDS = ['depth_operational', 'depth_limit', 'depth_crush']
const TEXT_FIELDS = ['tech_level', 'taille', 'type_batterie', 'autonomy', 'notes']

const LABEL_STYLE = { fontSize: '12px', color: '#8a8aa0', whiteSpace: 'nowrap' }
const INPUT_STYLE = { background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '3px 6px', outline: 'none', minWidth: 0, flex: 1 }
const ROW_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }

function extractFields(exo) {
  const out = {}
  for (const f of [...NUMBER_FIELDS, ...TEXT_FIELDS]) out[f] = exo[f] ?? ''
  return out
}

export default function ExoInfoPanel({ characterId, exo, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(() => extractFields(exo))
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(extractFields(exo)) }, [exo])

  const save = async (field, value) => {
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { [field]: value })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur mise à jour Informations exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
      setLocal(extractFields(exo))
    } finally { setSaving(false) }
  }

  const handleTextBlur = (field) => {
    const val = String(local[field]).trim() || null
    if (val === (exo[field] ?? null)) { setLocal(l => ({ ...l, [field]: exo[field] ?? '' })); return }
    save(field, val)
  }

  const handleNumberBlur = (field) => {
    const raw = local[field]
    if (raw === '') { if (exo[field] != null) save(field, null); return }
    const val = parseInt(raw, 10)
    if (isNaN(val) || val === exo[field]) { setLocal(l => ({ ...l, [field]: exo[field] ?? '' })); return }
    save(field, val)
  }

  const handleCategoryChange = (e) => save('category', e.target.value || null)

  const textRow = (field, labelKey, { width = '100px' } = {}) => (
    <div style={ROW_STYLE}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      {canEdit ? (
        <input
          type="text"
          value={local[field]}
          onChange={e => setLocal(l => ({ ...l, [field]: e.target.value }))}
          onBlur={() => handleTextBlur(field)}
          style={{ ...INPUT_STYLE, width, flex: 'none' }}
        />
      ) : (
        <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo[field] || '—'}</span>
      )}
    </div>
  )

  const numberRow = (field, labelKey) => (
    <div style={ROW_STYLE}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      {canEdit ? (
        <input
          type="number"
          value={local[field]}
          onChange={e => setLocal(l => ({ ...l, [field]: e.target.value }))}
          onBlur={() => handleNumberBlur(field)}
          style={{ ...INPUT_STYLE, width: '56px', flex: 'none' }}
        />
      ) : (
        <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo[field] ?? '—'}</span>
      )}
    </div>
  )

  const derivedRow = (labelKey, value) => (
    <div style={ROW_STYLE}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{value ?? '—'}</span>
    </div>
  )

  const grappleMalus = exo.category ? (EXO_GRAPPLE_MALUS_TABLE[exo.category] ?? null) : null
  const proneRecovery = exo.category ? (EXO_PRONE_RECOVERY_TABLE[exo.category] ?? null) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        <div style={ROW_STYLE}>
          <label style={LABEL_STYLE}>{t('exo.fieldCategory')}</label>
          {canEdit ? (
            <select
              value={exo.category || ''}
              onChange={handleCategoryChange}
              disabled={saving}
              style={{ ...INPUT_STYLE, width: '110px', flex: 'none', cursor: 'pointer' }}
            >
              <option value="">{t('exo.categorySelectPlaceholder')}</option>
              {EXO_CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo.category || '—'}</span>
          )}
        </div>
        {textRow('tech_level', 'exo.fieldTechLevel', { width: '80px' })}
        {textRow('taille', 'exo.fieldTaille')}
        {textRow('type_batterie', 'exo.fieldTypeBatterie')}
        {numberRow('depth_operational', 'exo.fieldDepthOperational')}
        {numberRow('depth_limit', 'exo.fieldDepthLimit')}
        {numberRow('depth_crush', 'exo.fieldDepthCrush')}
        {textRow('autonomy', 'exo.fieldAutonomy')}
        {derivedRow('exo.fieldGrappleMalus', grappleMalus)}
        {derivedRow('exo.fieldProneRecovery', proneRecovery)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={LABEL_STYLE}>{t('exo.fieldNotes')}</label>
        {canEdit ? (
          <textarea
            rows={3}
            value={local.notes}
            onChange={e => setLocal(l => ({ ...l, notes: e.target.value }))}
            onBlur={() => handleTextBlur('notes')}
            style={{ ...INPUT_STYLE, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0', whiteSpace: 'pre-wrap' }}>{exo.notes || '—'}</span>
        )}
      </div>

      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
