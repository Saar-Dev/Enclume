import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SurfaceMaterialEditor from './SurfaceMaterialEditor.jsx'
import FloatingPanelSection from './FloatingPanelSection.jsx'
import { IconEdit } from './SidebarIcons.jsx'
import { normalizedSurfaceMaterial } from '../lib/materialDecision.js'
import { getRoomBaseY, yToLevel } from '../lib/surfaceData.js'

const PANEL_W = 330
// Le plafond n'a pas d'onglet ici (§13, Saar en test 2026-09-30) : en édition (un seul étage
// affiché), le plafond de la salle éditée ne remplit quasiment jamais les conditions de rendu
// de `SurfaceDungeonScene.jsx` (`ceilingIsVisible`) — peindre un plafond qu'on ne voit jamais
// n'a pas sa place dans ce panneau. `materialProfiles.ceiling` reste lisible/écrivable par le
// reste du pipeline, seule cette UI ne l'expose plus.
const MATERIAL_FACE = 'floor'

// Position fixe, colonne de droite — plus de fenêtre déplaçable (§12.9/§12.10,
// PLAN_WORLD_BUILDER_REWORK.md : Saar navigue par la caméra, pas en déplaçant les panneaux ;
// un seul emplacement referme aussi la question d'où le panneau apparaît selon le chemin de
// sélection, §10b/§11.6.2). Salle/Mur sont ici les deux panneaux à usage unique éditeur — les
// deux repris tels quels n'apparaissent jamais en même temps (mutuellement exclusifs,
// `Editor3D.jsx`), donc une seule position statique suffit pour les deux.
// `dockRight` (§13, trouvé en testant) : la sidebar occupe déjà le bord droit de l'écran et sa
// largeur varie (redimensionnable) — un `right` fixe recouvrait la sidebar selon sa largeur du
// moment. `dockRight` = largeur réelle de la sidebar + marge, même patron que `DicePanel`/
// `EncyclopediaWindow` (`sidebarWidth`), pas une nouvelle mécanique.
export default function SurfaceRoomPanel({ room, tool, onPatch, onDelete, entitiesInRoomCount = 0, onClose, dockRight = 16 }) {
  const { t } = useTranslation('builder')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  if (!room) return null

  const canonicalSlices = Array.isArray(room.verticalProfile?.slices)
    ? room.verticalProfile.slices
    : []
  const hasCanonicalProfile = canonicalSlices.length > 0
  const heightLevels = Math.max(1, Number(room.heightLevels) || Number(tool?.roomHeightLevels) || 1)
  const material = normalizedSurfaceMaterial(
    tool?.materialProfiles?.[MATERIAL_FACE],
  )
  const patchMaterial = nextMaterial => onPatch?.({
    materialFace: MATERIAL_FACE,
    materialProfiles: {
      ...(tool?.materialProfiles || {}),
      [MATERIAL_FACE]: nextMaterial,
    },
  })
  return (
    <div
      style={{ ...S.panel, right: dockRight }}
      onPointerDown={event => event.stopPropagation()}
      data-testid="surface-room-panel"
    >
      <div style={S.header} data-testid="surface-room-panel-handle">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={S.kicker}>{t('surfaceRoomPanel.kicker')}</p>
          {editingName ? (
            <input
              type="text"
              autoFocus
              value={tool?.roomName ?? room.label ?? room.name ?? room.id}
              onChange={event => onPatch?.({ roomName: event.target.value })}
              onPointerDown={event => event.stopPropagation()}
              onBlur={() => setEditingName(false)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === 'Escape') setEditingName(false) }}
              style={{ ...S.input, ...S.titleInput }}
              maxLength={96}
            />
          ) : (
            <button
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={() => setEditingName(true)}
              style={S.titleEditBtn}
              title={t('surfaceRoomPanel.roomNameLabel')}
            >
              <span style={S.title}>{room.label || room.name || room.id}</span>
              <IconEdit />
            </button>
          )}
        </div>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <FloatingPanelSection title={t('surfaceRoomPanel.geometrySection')} defaultOpen storageKey="enclume.surfaceRoomPanel.section.geometry">
        <div style={S.infoLine}>
          <span>{t('surfaceRoomPanel.baseFloorLabel')} <strong>{yToLevel(getRoomBaseY(room))}</strong></span>
          <span>{t('surfaceRoomPanel.volumeLabel')} <strong>{hasCanonicalProfile ? t('surfaceRoomPanel.verticalProfileVolume', { count: heightLevels }) : t('surfaceRoomPanel.levelsCount', { count: heightLevels })}</strong></span>
        </div>

        <div style={S.grid}>
          {!hasCanonicalProfile ? (
            <label style={S.field}>
              <span style={S.label}>{t('surfaceRoomPanel.heightLabel')}</span>
              <select
                value={Number(tool?.roomHeightLevels) || heightLevels}
                onChange={event => onPatch?.({
                  roomHeightLevels: Number(event.target.value),
                  wallHeightLevels: Number(event.target.value),
                })}
                style={S.input}
              >
                {[1, 2, 3, 4, 5, 6].map(levels => (
                  <option key={levels} value={levels}>{t('surfaceRoomPanel.levelsCount', { count: levels })}</option>
                ))}
              </select>
            </label>
          ) : (
            <div style={S.profileNote}>
              {t('surfaceRoomPanel.profileNote')}
            </div>
          )}
          <label style={S.field}>
            <span style={S.label}>{t('surfaceRoomPanel.slabLabel')}</span>
            <input
              type="number"
              min="0.05"
              max="4"
              step="0.05"
              value={Number(tool?.floorThickness) || 0.25}
              onChange={event => onPatch?.({ floorThickness: Number(event.target.value) })}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>{t('surfaceRoomPanel.faceCeiling')}</span>
            <input
              type="number"
              min="0.05"
              max="4"
              step="0.05"
              value={Number(tool?.ceilingThickness) || 0.25}
              onChange={event => onPatch?.({ ceilingThickness: Number(event.target.value) })}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>{t('surfaceRoomPanel.wallThicknessLabel')}</span>
            <input
              type="number"
              min="1"
              max="8"
              step="1"
              value={Number(tool?.wallThickness) || 1}
              onChange={event => onPatch?.({ wallThickness: Number(event.target.value) })}
              style={S.input}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => onPatch?.({ mode: tool?.mode === 'reshape-room' ? 'select' : 'reshape-room', roomArcError: null })}
          style={{ ...S.action, ...(tool?.mode === 'reshape-room' ? S.actionActive : {}) }}
        >
          {t('surfaceRoomPanel.reshapeButton')}
        </button>
        {tool?.mode === 'reshape-room' && (
          <p style={S.hint}>{t('surfaceRoomPanel.reshapeHint')}</p>
        )}
        {tool?.roomArcError && (
          <p style={S.error}>{tool.roomArcError}</p>
        )}
        </FloatingPanelSection>

        <FloatingPanelSection title={t('common.appearanceSection')} storageKey="enclume.surfaceRoomPanel.section.appearance">
          <SurfaceMaterialEditor profile={material} onChange={patchMaterial} />
        </FloatingPanelSection>

        <FloatingPanelSection title={t('surfaceRoomPanel.movementSection')} storageKey="enclume.surfaceRoomPanel.section.movement">
        <div style={S.grid}>
          <label style={S.field}>
            <span style={S.label}>{t('surfaceRoomPanel.movementCostLabel')}</span>
            <input
              type="number"
              min="0.05"
              max="100"
              step="0.25"
              value={Math.max(0.05, Number(tool?.movementMultiplier) || 1)}
              onChange={event => onPatch?.({
                movementMultiplier: Math.max(0.05, Math.min(100, Number(event.target.value) || 1)),
              })}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>{t('surfaceRoomPanel.collisionLabel')}</span>
            <select
              value={tool?.surfaceBlocking || 'solid'}
              onChange={event => onPatch?.({ surfaceBlocking: event.target.value })}
              style={S.input}
            >
              <option value="solid">{t('surfaceRoomPanel.collisionSolid')}</option>
              <option value="glass">{t('surfaceRoomPanel.collisionGlass')}</option>
              <option value="grate">{t('surfaceRoomPanel.collisionGrate')}</option>
            </select>
          </label>
        </div>
        </FloatingPanelSection>

        {onDelete && (!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...S.action, ...S.danger }}>
            {t('surfaceRoomPanel.deleteRoomButton')}
          </button>
        ) : (
          <div style={S.deleteActions}>
            {entitiesInRoomCount > 0 && (
              <p style={S.error}>{t('surfaceRoomPanel.deleteWithEntitiesWarning', { count: entitiesInRoomCount })}</p>
            )}
            <button type="button" onClick={() => onDelete(room.id)} style={{ ...S.action, ...S.danger }}>
              {t('surfaceRoomPanel.confirmDeleteButton')}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={S.action}>
              {t('common.cancelButton')}
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
    top: 16,
    right: 16,
    width: PANEL_W,
    maxHeight: 'calc(100vh - 32px)',
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
  },
  kicker: { margin: 0, fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: 0, fontSize: '12px', color: '#dbeafe', fontWeight: 600, maxWidth: '215px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  titleEditBtn: { display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0 0', padding: 0, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', maxWidth: '100%' },
  titleInput: { margin: '2px 0 0', fontSize: '12px', fontWeight: 600, padding: '3px 6px' },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' },
  body: { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' },
  infoLine: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: '#64748b', fontSize: '11px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  colorField: { display: 'grid', gridTemplateColumns: '1fr 36px 105px', alignItems: 'center', gap: '7px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  colorInput: { width: '34px', height: '30px', padding: '2px', background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '4px' },
  profileNote: { gridColumn: '1 / -1', padding: '8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.28)', background: 'rgba(120, 53, 15, 0.16)', color: '#d6b56f', fontSize: '11px', lineHeight: 1.4 },
  section: { display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '2px' },
  action: { minHeight: '30px', border: '1px solid #3f3f5e', borderRadius: '5px', background: '#17172a', color: '#cbd5e1', fontSize: '10px', cursor: 'pointer' },
  actionActive: { borderColor: '#d97706', background: 'rgba(217, 119, 6, 0.18)', color: '#fde68a' },
  hint: { margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 },
  error: { margin: 0, fontSize: '11px', color: '#f87171', lineHeight: 1.4 },
  deleteActions: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: '6px' },
  danger: { borderColor: 'rgba(251, 113, 133, 0.55)', background: 'rgba(127, 29, 29, 0.18)', color: '#fda4af' },
}
