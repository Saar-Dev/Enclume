import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanelSection from './FloatingPanelSection.jsx'
import { useDraggablePanelPosition } from '../lib/floatingPanel.js'

const PANEL_W = 300
const PANEL_H_EST = 360

// Inspecteur d'une zone dangereuse déjà posée (PLAN_ZONES_DANGER.md §6.2 points 4/5) — patron exact
// de SurfaceRoomPanel.jsx/SurfaceWallPanel.jsx (FloatingPanelSection + useDraggablePanelPosition,
// position mémorisée en localStorage), confirmé disponible et à rejoindre par META EDITEUR avant de
// coder ce fichier. Remplace le tandem « supprimer puis redessiner » de la liste « Effets actifs » :
// intensité et puissance se corrigent ici sans toucher au volume déjà tracé. Redessiner le volume
// (déplacer/agrandir la zone) reste hors périmètre de cet incrément — limite assumée, pas oubliée.
// Namespace par défaut (fr.json), pas 'builder' : ce panneau rejoint SurfaceEditorPanel.jsx (les
// clés surfaceEditor.*/common.* de cet écran vivent déjà là), pas SurfaceRoomPanel.jsx/
// SurfaceWallPanel.jsx (qui utilisent le namespace 'builder' séparé, historique, jamais fusionné).
export default function SurfaceEffectPanel({ instance, definition, x, y, onPatch, onDelete, onClose }) {
  const { t } = useTranslation()
  const { position, beginDrag, panelRef } = useDraggablePanelPosition({
    x, y, width: PANEL_W, height: PANEL_H_EST,
    storageKey: 'enclume.surfaceEffectPanel.position',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!instance) return null

  const label = definition?.label || instance.definitionKey
  const isCustom = definition && definition.builtin === false

  return (
    <div
      ref={panelRef}
      style={{ ...S.panel, left: position.left, top: position.top }}
      onPointerDown={event => event.stopPropagation()}
      data-testid="surface-effect-panel"
    >
      <div style={S.header} onPointerDown={beginDrag} data-testid="surface-effect-panel-handle">
        <div>
          <p style={S.kicker}>{t('surfaceEditor.effectZone')}</p>
          <p style={S.title}>{label}{isCustom ? ` (${t('surfaceEditor.customEffectSuffix')})` : ''}</p>
        </div>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <FloatingPanelSection title={t('surfaceEditor.effectZone')} defaultOpen storageKey="enclume.surfaceEffectPanel.section.values">
          <div style={S.grid}>
            <label style={S.field}>
              <span style={S.label}>{t('surfaceEditor.effectIntensityLabel')}</span>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.25"
                value={instance.intensity}
                onChange={event => onPatch?.({ intensity: Math.max(0.01, Number(event.target.value) || 1) })}
                onPointerDown={event => event.stopPropagation()}
                style={S.input}
              />
            </label>
            <label style={S.field}>
              <span style={S.label}>{t('surfaceEditor.effectPuissanceLabel')}</span>
              <input
                type="number"
                min="-1000"
                max="1000"
                step="1"
                value={instance.puissance ?? 0}
                onChange={event => onPatch?.({ puissance: Math.round(Number(event.target.value) || 0) })}
                onPointerDown={event => event.stopPropagation()}
                style={S.input}
              />
            </label>
          </div>
          <div style={S.infoGrid}>
            <span>{t('surfaceEditor.effectDurationLabel')}</span>
            <strong>
              {instance.durationRounds == null
                ? t('surfaceEditor.effectPermanent')
                : t('surfaceEditor.effectRoundsLeft', { count: instance.durationRounds })}
            </strong>
          </div>
        </FloatingPanelSection>

        {onDelete && (!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...S.action, ...S.danger }}>
            {t('common.delete')}
          </button>
        ) : (
          <div style={S.deleteActions}>
            <button type="button" onClick={onDelete} style={{ ...S.action, ...S.danger }}>
              {t('common.confirm')}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={S.action}>
              {t('common.cancel')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  panel: {
    position: 'fixed',
    width: PANEL_W,
    maxHeight: 'calc(100vh - 16px)',
    zIndex: 10002,
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.72)',
    overflow: 'hidden',
    userSelect: 'none',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '10px 14px', borderBottom: '1px solid #1e1e2e', background: '#0a0a14',
    cursor: 'grab', touchAction: 'none',
  },
  kicker: { margin: 0, fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: '2px 0 0', fontSize: '12px', color: '#dbeafe', fontWeight: 600, maxWidth: '225px', overflow: 'hidden', textOverflow: 'ellipsis' },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' },
  body: { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  infoGrid: { display: 'grid', gridTemplateColumns: '100px minmax(0, 1fr)', gap: '5px 8px', color: '#64748b', fontSize: '11px' },
  action: { minHeight: '30px', border: '1px solid #3f3f5e', borderRadius: '5px', background: '#17172a', color: '#cbd5e1', fontSize: '10px', cursor: 'pointer' },
  deleteActions: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: '6px' },
  danger: { borderColor: 'rgba(251, 113, 133, 0.55)', background: 'rgba(127, 29, 29, 0.18)', color: '#fda4af' },
}
