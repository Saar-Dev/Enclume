/**
 * ExoAttributesPanel.jsx — Section "Attributs de l'Armure" de ExoSheetWindow
 *
 * Base éditable copiée depuis le modèle choisi (PLAN_EXOARMURE.md §13.3, Lot B) — mirroir du bloc
 * "ATTRIBUTS DE L'ARMURE" de la fiche RAW (docs/REGLES/FDEA.webp) : RD/Blindage/Exo-Force/Malus
 * d'initiative, disposés en grille 2 colonnes compacte (retour Saar 2026-08-20 — layout d'origine
 * en pile verticale illisible). Vitesse et Modificateur de dommage (MD) restent hors périmètre de ce
 * Lot (décision Saar 2026-08-20 : Vitesse dépend d'un appel async à movementBudgetService, MD
 * n'existe qu'en server/src/lib/charStats.js — aucun des deux n'est dupliqué côté client pour un
 * simple affichage). RD/Blindage/Exo-Force effectifs viennent de computeExoStats(exo), même autorité
 * que le serveur, jamais un second calcul.
 *
 * Édition — retour Saar (2026-08-20, seconde passe) : le premier jet gatait l'état "en édition" sur
 * `onFocus`, avec un `value` qui bascule entre `draft` et `exo[field]` selon ce flag. Deux défauts
 * réels trouvés : (1) les flèches natives +/- d'un `<input type="number">` déclenchent `onChange`
 * sans toujours déclencher `onFocus` en premier selon le navigateur — le flag "en édition" ne
 * s'activait jamais, donc `value` restait lié à `exo[field]` et React écrasait l'incrément à chaque
 * rendu (flèches inertes). (2) `onBlur` effaçait ce flag de façon SYNCHRONE avant que la sauvegarde
 * async ait fini — la valeur affichée retombait donc sur l'ancienne `exo[field]` pendant tout
 * l'aller-retour réseau, perçu comme "la valeur d'origine est remise immédiatement". Remplacé par un
 * miroir local unique par champ, toujours la source du `value` affiché (jamais de bascule
 * focus-dépendante), resynchronisé uniquement quand `exo` change réellement (nouvelle valeur serveur
 * ou mise à jour WS) via `useEffect` — jamais réinitialisé par un simple blur.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { computeExoStats } from '../../../shared/exoStats.js'

const NUMBER_FIELDS = ['base_blindage', 'base_exoforce', 'malus_init_underwater', 'malus_init_surface']
const TEXT_FIELDS = ['type_coque']

const LABEL_STYLE = { fontSize: '12px', color: '#8a8aa0', whiteSpace: 'nowrap' }
const INPUT_STYLE = { background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '3px 6px', outline: 'none', width: '56px', flexShrink: 0 }
const ROW_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }

function extractFields(exo) {
  const out = {}
  for (const f of [...NUMBER_FIELDS, ...TEXT_FIELDS]) out[f] = exo[f] ?? ''
  return out
}

export default function ExoAttributesPanel({ characterId, exo, canEdit, onExoUpdate }) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(() => extractFields(exo))
  const [saving, setSaving] = useState(false)

  // Resynchronise le miroir local uniquement quand exo change réellement (réponse serveur après
  // save, ou mise à jour WS externe) — jamais sur un simple blur/focus local.
  useEffect(() => { setLocal(extractFields(exo)) }, [exo])

  const stats = computeExoStats(exo)

  const save = async (field, value) => {
    setSaving(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo`, { [field]: value })
      onExoUpdate(res.data.exo)
    } catch (err) {
      console.error('Erreur mise à jour Attributs exo :', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
      setLocal(extractFields(exo))  // échec — revient à la dernière valeur serveur connue
    } finally { setSaving(false) }
  }

  const handleNumberBlur = (field) => {
    const raw = local[field]
    if (raw === '') { if (exo[field] != null) save(field, null); return }
    const val = parseInt(raw, 10)
    if (isNaN(val) || val === exo[field]) { setLocal(l => ({ ...l, [field]: exo[field] ?? '' })); return }
    save(field, val)
  }

  const handleTextBlur = (field) => {
    const val = String(local[field]).trim() || null
    if (val === (exo[field] ?? null)) { setLocal(l => ({ ...l, [field]: exo[field] ?? '' })); return }
    save(field, val)
  }

  const numberRow = (field, labelKey, { effective } = {}) => (
    <div style={ROW_STYLE}>
      <label style={LABEL_STYLE}>{t(labelKey)}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {canEdit ? (
          <input
            type="number"
            value={local[field]}
            onChange={e => setLocal(l => ({ ...l, [field]: e.target.value }))}
            onBlur={() => handleNumberBlur(field)}
            style={INPUT_STYLE}
          />
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo[field] ?? '—'}</span>
        )}
        {effective != null && (
          <span style={{ fontSize: '11px', color: '#4a4a60' }} title={t('exo.effectiveTooltip')}>→ {effective}</span>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        <div style={ROW_STYLE}>
          <label style={LABEL_STYLE}>{t('exo.fieldRd')}</label>
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{stats ? stats.rd : '—'}</span>
        </div>
        {numberRow('base_blindage', 'exo.fieldBaseBlindage', { effective: stats?.bld })}
        {numberRow('base_exoforce', 'exo.fieldBaseExoforce', { effective: stats?.exf })}
        {numberRow('malus_init_underwater', 'exo.fieldMalusIniUnderwater')}
        {numberRow('malus_init_surface', 'exo.fieldMalusIniSurface')}
      </div>

      <div style={ROW_STYLE}>
        <label style={LABEL_STYLE}>{t('exo.fieldTypeCoque')}</label>
        {canEdit ? (
          <input
            type="text"
            value={local.type_coque}
            onChange={e => setLocal(l => ({ ...l, type_coque: e.target.value }))}
            onBlur={() => handleTextBlur('type_coque')}
            style={{ ...INPUT_STYLE, width: '160px', flexShrink: 1 }}
          />
        ) : (
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>{exo.type_coque || '—'}</span>
        )}
      </div>

      {!stats && <span style={{ fontSize: '11px', color: '#4a4a60', fontStyle: 'italic' }}>{t('exo.statsUnavailable')}</span>}
      {saving && <span style={{ fontSize: '11px', color: '#4a4a60' }}>{t('exo.saving')}</span>}
    </div>
  )
}
