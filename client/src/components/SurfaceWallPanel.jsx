import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  roomSelectableWallRuns,
  roomWallAppearanceForEdges,
  roomWallElevationProfileForEdges,
} from '../../../shared/world/roomGeometry.js'
import SurfaceMaterialEditor from './SurfaceMaterialEditor.jsx'
import FloatingPanelSection from './FloatingPanelSection.jsx'
import { normalizedSurfaceMaterial } from '../lib/materialDecision.js'
import { DEFAULT_DECAL_HEIGHT_M } from '../lib/surfaceTools/computeDecalPlacement.js'

const PANEL_W = 310
const DEFAULT_DECAL_COLOR = '#ffffff'
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

// Position fixe, colonne de droite — voir le commentaire équivalent dans SurfaceRoomPanel.jsx
// (§12.9/§12.10, PLAN_WORLD_BUILDER_REWORK.md). `dockRight` : idem, largeur de sidebar + marge (§13).
export default function SurfaceWallPanel({
  room, tool, onPatch, onAppearanceChange, decalAssets = [], onDecalRemove, onDecalMove, onClose, dockRight = 16,
}) {
  const { t } = useTranslation('builder')
  const [confirmDeleteWalls, setConfirmDeleteWalls] = useState(false)
  if (!room || !tool?.selectedRoomWallCount) return null

  const count = Number(tool.selectedRoomWallCount) || 0
  const selectedKeys = tool.selectedRoomWallKeys || []
  const selectableRuns = roomSelectableWallRuns(room)
  const allWallKeys = [...new Set(selectableRuns.flatMap(run => run.edgeKeys))]
  const selectedKeySet = new Set(selectedKeys.map(String))
  const allWallsSelected = allWallKeys.length > 0 && allWallKeys.every(key => selectedKeySet.has(String(key)))
  const selectedRuns = selectableRuns.filter(run => run.edgeKeys.every(key => selectedKeySet.has(String(key))))
  const elevationProfile = roomWallElevationProfileForEdges(room, selectedKeys)
  const storedAppearance = roomWallAppearanceForEdges(room, selectedKeys)
  const appearanceMaterial = normalizedSurfaceMaterial(
    storedAppearance?.interiorMaterial ?? room.wallInteriorMaterial,
  )
  // Jamais de interiorTex ici : applyRoomWallAppearance() force toujours null (Option 2, voir son commentaire
  // dans surfaceRooms.js) — plus la peine de le lire/transmettre depuis ce panneau.
  const patchAppearance = interiorMaterial => onAppearanceChange?.({ interiorMaterial })
  const depth = Math.max(0, Number(elevationProfile.depth) || 0)
  const profileFactor = elevationProfile.type === 'curved' ? Math.PI : 2
  const angle = Math.atan(profileFactor * depth / 2.5) * 180 / Math.PI
  const triggerAction = action => onPatch?.({
    roomArcAction: action,
    roomArcActionId: Date.now(),
    roomArcError: null,
  })
  const patchElevationProfile = (patch, actionToken) => {
    const next = { ...elevationProfile, ...patch }
    onPatch?.({
      wallElevationProfile: next,
      wallElevationProfileActionId: `wall-profile:${actionToken}:${JSON.stringify(next)}`,
      roomArcError: null,
    })
  }
  const startDoorPlacement = () => onPatch?.({
    mode: 'connector',
    connectorType: 'door',
    connectorWallEdgeKeys: [...selectedKeys],
  })

  // Décors déjà posés sur le(s) mur(s) actuellement sélectionné(s) — pas de sélection par clic sur
  // l'image elle-même (Lot 2 désactive volontairement son raycast) : un décor se gère depuis le
  // panneau du mur qui le porte, même esprit que les sections Apparence/Profil vertical ci-dessus.
  const existingDecals = (room.wallDecorations || [])
    .filter(decoration => (decoration.sourceEdgeKeys || []).some(key => selectedKeySet.has(String(key))))
  const decalGroups = {}
  for (const asset of decalAssets) {
    if (asset.deprecated) continue
    const key = asset.category || '__divers__'
    if (!decalGroups[key]) decalGroups[key] = { label: asset.category || t('surfaceWallPanel.decorationCategoryFallback'), assets: [] }
    decalGroups[key].assets.push(asset)
  }
  // Outil tampon (patron Tiled/Godot GoPlacer, confirmé par recherche, PLAN_DECALS.md « Révision
  // 2026-10-15 » §A) : choisir une vignette active directement le mode de pose, pas une action
  // séparée derrière un second bouton. Désactivé si la sélection de mur n'est pas exactement un seul
  // tronçon (ambigu pour poser) — les vignettes sont alors visuellement désactivées plus bas, jamais
  // un clic silencieux sans effet.
  const canPlaceDecal = selectedRuns.length === 1
  const selectDecalAsset = asset => onPatch?.({
    decalAssetId: asset.id,
    decalWidthM: DEFAULT_DECAL_HEIGHT_M * (Number(asset.ratio) || 1),
    decalHeightM: DEFAULT_DECAL_HEIGHT_M,
    roomArcError: null,
    ...(canPlaceDecal ? { mode: 'decal', connectorWallEdgeKeys: [...selectedKeys] } : {}),
  })
  const decalColor = HEX_COLOR_RE.test(String(tool.decalColor || '')) ? tool.decalColor : DEFAULT_DECAL_COLOR

  return (
    <div
      style={{ ...S.panel, right: dockRight }}
      onPointerDown={event => event.stopPropagation()}
      data-testid="surface-wall-panel"
    >
      <div style={S.header} data-testid="surface-wall-panel-handle">
        <div>
          <p style={S.kicker}>{t('surfaceWallPanel.kicker')}</p>
          <p style={S.title}>{t('surfaceWallPanel.wallsSelectedCount', { count })}</p>
        </div>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <p style={S.hint}>
          {t('surfaceWallPanel.selectionHint')}
        </p>

        <button
          type="button"
          disabled={allWallKeys.length === 0 || allWallsSelected}
          onClick={() => onPatch?.({
            selectedRoomWallKeys: allWallKeys,
            selectedRoomWallCount: selectableRuns.length,
            roomArcError: null,
          })}
          style={{ ...S.button, ...S.selectAll, ...(allWallKeys.length === 0 || allWallsSelected ? S.disabled : {}) }}
        >
          {allWallsSelected ? t('surfaceWallPanel.allWallsSelected') : t('surfaceWallPanel.selectAllWalls')}
        </button>

        <FloatingPanelSection title={t('common.appearanceSection')} storageKey="enclume.surfaceWallPanel.section.appearance">
          <span style={S.label}>{t('surfaceWallPanel.wallSideAppearance')}</span>
          <SurfaceMaterialEditor profile={appearanceMaterial} onChange={patchAppearance} />
        </FloatingPanelSection>

        <FloatingPanelSection title={t('surfaceWallPanel.elevationProfileSection')} defaultOpen storageKey="enclume.surfaceWallPanel.section.elevationProfile">
          <span style={S.label}>{t('surfaceWallPanel.elevationProfileSideView')}</span>
          <div style={S.profileButtons}>
            {[
              ['vertical', '|', t('surfaceWallPanel.profileVertical')],
              ['curved', '(', t('surfaceWallPanel.profileCurved')],
              ['faceted', '<', t('surfaceWallPanel.profileFaceted')],
            ].map(([type, glyph, label]) => (
              <button
                key={type}
                type="button"
                onClick={event => patchElevationProfile({ type, depth: type === 'vertical' ? 0 : Math.max(0.25, depth) }, event.timeStamp)}
                style={{ ...S.profileButton, ...(elevationProfile.type === type ? S.profileButtonActive : {}) }}
                title={label}
              >
                <strong>{glyph}</strong><span>{label}</span>
              </button>
            ))}
          </div>
          {elevationProfile.type !== 'vertical' && (
            <>
              <label style={S.field}>
                <span style={S.label}>{t('surfaceWallPanel.depthValue', { value: depth.toFixed(2) })}</span>
                <input
                  type="range"
                  min="0.05"
                  max="2.5"
                  step="0.05"
                  value={Math.max(0.05, depth)}
                  onChange={event => patchElevationProfile({ depth: Number(event.target.value) }, event.timeStamp)}
                  style={{ width: '100%' }}
                />
              </label>
              <label style={S.field}>
                <span style={S.label}>{t('common.angleValue', { value: angle.toFixed(0) })}</span>
                <input
                  type="range"
                  min="2"
                  max="70"
                  step="1"
                  value={Math.max(2, Math.min(70, angle))}
                  onChange={event => patchElevationProfile({
                    depth: Math.tan(Number(event.target.value) * Math.PI / 180) * 2.5 / profileFactor,
                  }, event.timeStamp)}
                  style={{ width: '100%' }}
                />
              </label>
              <div style={S.field}>
                <span style={S.label}>{t('surfaceWallPanel.directionLabel')}</span>
                <div style={S.directionButtons}>
                  <button
                    type="button"
                    onClick={event => patchElevationProfile({ direction: 1 }, event.timeStamp)}
                    style={{ ...S.button, ...(Number(elevationProfile.direction) >= 0 ? S.profileButtonActive : {}) }}
                  >
                    {t('surfaceWallPanel.directionInward')}
                  </button>
                  <button
                    type="button"
                    onClick={event => patchElevationProfile({ direction: -1 }, event.timeStamp)}
                    style={{ ...S.button, ...(Number(elevationProfile.direction) < 0 ? S.profileButtonActive : {}) }}
                  >
                    {t('surfaceWallPanel.directionOutward')}
                  </button>
                </div>
              </div>
              <p style={S.hint}>
                {t('surfaceWallPanel.profileHint')}
              </p>
            </>
          )}
        </FloatingPanelSection>

        <FloatingPanelSection title={t('surfaceWallPanel.openingsSection')} defaultOpen storageKey="enclume.surfaceWallPanel.section.openings">
          <button
            type="button"
            disabled={selectedRuns.length !== 1}
            onClick={startDoorPlacement}
            style={{ ...S.button, ...S.primary, ...(selectedRuns.length !== 1 ? S.disabled : {}) }}
          >
            {t('surfaceWallPanel.addDoorButton')}
          </button>
          {selectedRuns.length !== 1 && <p style={S.hint}>{t('surfaceWallPanel.addDoorHint')}</p>}
        </FloatingPanelSection>

        <FloatingPanelSection title={t('surfaceWallPanel.decorationSection')} storageKey="enclume.surfaceWallPanel.section.decoration">
          {existingDecals.length > 0 && (
            <div style={S.field}>
              <span style={S.label}>{t('surfaceWallPanel.existingDecalsLabel')}</span>
              {existingDecals.map(decoration => {
                const asset = decalAssets.find(entry => entry.id === decoration.assetId)
                return (
                  <div key={decoration.id} style={S.existingDecalRow}>
                    <span style={S.existingDecalLabel}>{asset?.label || decoration.assetId}</span>
                    <div style={S.existingDecalActions}>
                      <button
                        type="button"
                        onClick={() => onDecalMove?.(decoration)}
                        style={{ ...S.button, ...S.existingDecalDeleteBtn }}
                      >
                        {t('surfaceWallPanel.moveDecalButton')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecalRemove?.(decoration.id)}
                        style={{ ...S.button, ...S.danger, ...S.existingDecalDeleteBtn }}
                      >
                        {t('surfaceWallPanel.deleteDecalButton')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <label style={S.colorField}>
            <span style={S.label}>{t('surfaceWallPanel.decalColorLabel')}</span>
            <input
              type="color"
              value={decalColor}
              onChange={event => onPatch?.({ decalColor: event.target.value })}
              style={S.colorInput}
            />
            <input
              type="text"
              value={tool.decalColor || decalColor}
              onChange={event => onPatch?.({ decalColor: event.target.value })}
              style={S.input}
            />
          </label>

          <label style={S.checkboxField}>
            <input
              type="checkbox"
              checked={!!tool.decalMirror}
              onChange={event => onPatch?.({ decalMirror: event.target.checked })}
            />
            <span style={S.label}>{t('surfaceWallPanel.decalMirrorLabel')}</span>
          </label>

          {Object.entries(decalGroups).map(([catKey, group]) => (
            <div key={catKey} style={S.field}>
              <span style={S.label}>{group.label}</span>
              <div style={S.decalGrid}>
                {group.assets.map(asset => (
                  <button
                    key={asset.id}
                    type="button"
                    title={asset.label}
                    disabled={!canPlaceDecal}
                    onClick={() => selectDecalAsset(asset)}
                    style={{
                      ...S.decalThumb,
                      backgroundImage: asset.image_url
                        ? `url(${import.meta.env.VITE_API_URL}/api/assets/${asset.image_url})`
                        : 'none',
                      ...(tool.decalAssetId === asset.id ? S.decalThumbActive : {}),
                      ...(!canPlaceDecal ? S.decalThumbDisabled : {}),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {!canPlaceDecal && <p style={S.hint}>{t('surfaceWallPanel.addDecalHint')}</p>}
        </FloatingPanelSection>

        <FloatingPanelSection title={t('surfaceWallPanel.shapeSection')} defaultOpen storageKey="enclume.surfaceWallPanel.section.shape">
          {count >= 2 && (
            <label style={S.field}>
              <span style={S.label}>{t('common.angleValue', { value: Number(tool.roomArcAngle || 90).toFixed(0) })}</span>
              <input
                type="range"
                min="5"
                max="175"
                step="5"
                value={tool.roomArcAngle || 90}
                onChange={event => onPatch?.({ roomArcAngle: Number(event.target.value), roomArcError: null })}
                style={{ width: '100%' }}
              />
            </label>
          )}

          <div style={S.actions}>
            <button
              type="button"
              disabled={count < 2}
              onClick={() => onPatch?.({ roomArcSide: Number(tool.roomArcSide) < 0 ? 1 : -1, roomArcError: null })}
              style={{ ...S.button, ...(count < 2 ? S.disabled : {}) }}
            >
              {t('surfaceWallPanel.invertInPlane')}
            </button>
            <button
              type="button"
              disabled={count < 2}
              onClick={() => triggerAction('apply')}
              style={{ ...S.button, ...S.primary, ...(count < 2 ? S.disabled : {}) }}
            >
              {t('surfaceWallPanel.applyArc')}
            </button>
            <button
              type="button"
              disabled={selectedKeys.length === 0}
              onClick={() => triggerAction('remove')}
              style={{ ...S.button, ...(selectedKeys.length === 0 ? S.disabled : {}) }}
            >
              {t('surfaceWallPanel.straightenButton')}
            </button>
          </div>

          <p style={S.hint}>
            {t('surfaceWallPanel.mergeHint')}
          </p>
          {tool.roomArcError && <p style={S.error}>{tool.roomArcError}</p>}
        </FloatingPanelSection>

        {!confirmDeleteWalls ? (
          <button
            type="button"
            onClick={() => setConfirmDeleteWalls(true)}
            style={{ ...S.button, ...S.danger }}
          >
            {count > 1 ? t('surfaceWallPanel.deleteWallsButton') : t('surfaceWallPanel.deleteWallButton')}
          </button>
        ) : (
          <div style={S.deleteActions}>
            <button
              type="button"
              onClick={() => { setConfirmDeleteWalls(false); triggerAction('delete') }}
              style={{ ...S.button, ...S.danger }}
            >
              {t('surfaceRoomPanel.confirmDeleteButton')}
            </button>
            <button type="button" onClick={() => setConfirmDeleteWalls(false)} style={S.button}>
              {t('common.cancelButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  panel: { position: 'fixed', top: 16, right: 16, width: PANEL_W, maxHeight: 'calc(100vh - 32px)', zIndex: 10003, background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.72)', overflow: 'hidden', userSelect: 'none' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #1e1e2e', background: '#0a0a14' },
  kicker: { margin: 0, fontSize: '11px', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: '2px 0 0', fontSize: '12px', color: '#dbeafe', fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' },
  body: { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '9px', border: '1px solid #27273a', borderRadius: '7px', background: 'rgba(15, 23, 42, 0.45)' },
  hint: { margin: 0, color: '#7f8eaa', fontSize: '11px', lineHeight: 1.4 },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' },
  deleteActions: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: '6px' },
  profileButtons: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '5px' },
  directionButtons: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '5px' },
  profileButton: { minHeight: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', border: '1px solid #35354e', borderRadius: '5px', background: '#151525', color: '#7f8eaa', fontSize: '9px', cursor: 'pointer' },
  profileButtonActive: { borderColor: '#ea580c', background: 'rgba(234, 88, 12, 0.2)', color: '#fed7aa' },
  button: { minHeight: '34px', padding: '6px 8px', border: '1px solid #35354e', borderRadius: '5px', background: '#151525', color: '#cbd5e1', fontSize: '10px', cursor: 'pointer' },
  primary: { borderColor: '#ea580c', background: 'rgba(234, 88, 12, 0.2)', color: '#fed7aa' },
  selectAll: { borderColor: '#2563eb', background: 'rgba(37, 99, 235, 0.16)', color: '#bfdbfe' },
  danger: { borderColor: 'rgba(251, 113, 133, 0.55)', background: 'rgba(127, 29, 29, 0.18)', color: '#fda4af' },
  disabled: { opacity: 0.38, cursor: 'not-allowed' },
  error: { margin: 0, padding: '7px 8px', borderRadius: '5px', background: 'rgba(127, 29, 29, 0.24)', color: '#fda4af', fontSize: '11px' },
  decalGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '5px' },
  decalThumb: { aspectRatio: '1', border: '2px solid transparent', borderRadius: '5px', background: '#151525 center/cover no-repeat', cursor: 'pointer' },
  decalThumbActive: { borderColor: '#ea580c' },
  decalThumbDisabled: { opacity: 0.38, cursor: 'not-allowed' },
  checkboxField: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  colorField: { display: 'grid', gridTemplateColumns: '1fr 34px 90px', alignItems: 'center', gap: '6px' },
  colorInput: { width: '34px', height: '30px', padding: '2px', background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '4px' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  existingDecalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' },
  existingDecalActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  existingDecalLabel: { fontSize: '10px', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  existingDecalDeleteBtn: { minHeight: '26px', padding: '2px 8px', flexShrink: 0 },
}
