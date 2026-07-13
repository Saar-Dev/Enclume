import { useMemo } from 'react'
import { roomWallElevationProfileForEdges } from '../../../shared/world/roomGeometry.js'

const PANEL_W = 310
const PANEL_H_EST = 680

function clampPanelPosition(x, y) {
  const left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, Number(x) || 8))
  const top = Math.max(8, Math.min(window.innerHeight - PANEL_H_EST - 8, Number(y) || 8))
  return { left, top }
}

export default function SurfaceWallPanel({ room, tool, x, y, onPatch, onClose }) {
  const position = useMemo(() => clampPanelPosition(x, y), [x, y])
  if (!room || !tool?.selectedRoomWallCount) return null

  const count = Number(tool.selectedRoomWallCount) || 0
  const selectedKeys = tool.selectedRoomWallKeys || []
  const elevationProfile = roomWallElevationProfileForEdges(room, selectedKeys)
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

  return (
    <div
      style={{ ...S.panel, left: position.left, top: position.top }}
      onPointerDown={event => event.stopPropagation()}
    >
      <div style={S.header}>
        <div>
          <p style={S.kicker}>Mur</p>
          <p style={S.title}>{count} mur{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</p>
        </div>
        <button type="button" onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <p style={S.hint}>
          Clique d’autres murs pour composer la sélection. Deux murs contigus peuvent devenir un seul arc canonique.
        </p>

        <div style={S.section}>
          <span style={S.label}>Profil vertical vu de côté</span>
          <div style={S.profileButtons}>
            {[
              ['vertical', '|', 'Vertical'],
              ['curved', '(', 'Courbe'],
              ['faceted', '<', 'Cassé'],
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
                <span style={S.label}>Profondeur : {depth.toFixed(2)} m</span>
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
                <span style={S.label}>Angle : {angle.toFixed(0)}°</span>
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
              <button
                type="button"
                onClick={event => patchElevationProfile({ direction: Number(elevationProfile.direction) < 0 ? 1 : -1 }, event.timeStamp)}
                style={S.button}
              >
                Inverser le profil
              </button>
              <p style={S.hint}>
                Façade extérieure : les deux faces suivent le profil. Mur mitoyen : seule la face de cette salle varie, l’autre limite reste fixe.
              </p>
            </>
          )}
        </div>

        {count >= 2 && (
          <label style={S.field}>
            <span style={S.label}>Angle : {Number(tool.roomArcAngle || 90).toFixed(0)}°</span>
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
            Inverser dans le plan
          </button>
          <button
            type="button"
            disabled={count < 2}
            onClick={() => triggerAction('apply')}
            style={{ ...S.button, ...S.primary, ...(count < 2 ? S.disabled : {}) }}
          >
            Appliquer l’arrondi
          </button>
          <button
            type="button"
            disabled={selectedKeys.length === 0}
            onClick={() => triggerAction('remove')}
            style={{ ...S.button, ...(selectedKeys.length === 0 ? S.disabled : {}) }}
          >
            Remettre droit
          </button>
          <button
            type="button"
            disabled={count < 1}
            onClick={() => triggerAction('delete')}
            style={{ ...S.button, ...S.danger, ...(count < 1 ? S.disabled : {}) }}
          >
            {count > 1 ? 'Supprimer les murs' : 'Supprimer le mur'}
          </button>
        </div>

        <p style={S.hint}>
          Un mur extérieur supprimé ouvre la salle. Un mur commun supprimé fusionne les volumes, y compris lorsqu’ils ont des hauteurs différentes.
        </p>
        {tool.roomArcError && <p style={S.error}>{tool.roomArcError}</p>}
      </div>
    </div>
  )
}

const S = {
  panel: { position: 'fixed', width: PANEL_W, maxHeight: 'calc(100vh - 16px)', zIndex: 10003, background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.72)', overflow: 'hidden', userSelect: 'none' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #1e1e2e', background: '#0a0a14' },
  kicker: { margin: 0, fontSize: '11px', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: '2px 0 0', fontSize: '12px', color: '#dbeafe', fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' },
  body: { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '9px', border: '1px solid #27273a', borderRadius: '7px', background: 'rgba(15, 23, 42, 0.45)' },
  hint: { margin: 0, color: '#7f8eaa', fontSize: '11px', lineHeight: 1.4 },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' },
  profileButtons: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '5px' },
  profileButton: { minHeight: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', border: '1px solid #35354e', borderRadius: '5px', background: '#151525', color: '#7f8eaa', fontSize: '9px', cursor: 'pointer' },
  profileButtonActive: { borderColor: '#ea580c', background: 'rgba(234, 88, 12, 0.2)', color: '#fed7aa' },
  button: { minHeight: '34px', padding: '6px 8px', border: '1px solid #35354e', borderRadius: '5px', background: '#151525', color: '#cbd5e1', fontSize: '10px', cursor: 'pointer' },
  primary: { borderColor: '#ea580c', background: 'rgba(234, 88, 12, 0.2)', color: '#fed7aa' },
  danger: { borderColor: 'rgba(251, 113, 133, 0.55)', background: 'rgba(127, 29, 29, 0.18)', color: '#fda4af' },
  disabled: { opacity: 0.38, cursor: 'not-allowed' },
  error: { margin: 0, padding: '7px 8px', borderRadius: '5px', background: 'rgba(127, 29, 29, 0.24)', color: '#fda4af', fontSize: '11px' },
}
