import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clearMaterialSlotOverride,
  connectorModelMaterialSlots,
  materialSlotDisplayValue,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'
import { useDraggablePanelPosition } from '../lib/floatingPanel.js'
import Object3DPreview from './Object3DPreview.jsx'
import { stairGeometry } from '../../../shared/world/stairGeometry.js'
import { rotateHatchOrientation, rotateLadderOrientation } from '../lib/surfaceData.js'
import { elevatorCabinIsAtStop } from '../lib/elevatorInteraction.js'
import {
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_PRESETS,
} from '../lib/proceduralMaterials.js'

const PANEL_W = 310
const PANEL_H_EST = 620

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
}

function connectorBlockingForState(type, state) {
  if (type === 'elevator' || type === 'ladder') {
    return {
      blocksSight: false,
      blocksMovement: false,
      blocksWater: type === 'elevator',
      barrierType: 'connector',
    }
  }
  const open = state === 'open'
  return {
    blocksSight: !open,
    blocksMovement: !open,
    blocksWater: !open,
    barrierType: open ? 'open-door' : 'door',
  }
}

function connectorTypeLabel(type) {
  if (type === 'door') return 'Porte'
  if (type === 'window') return 'Fenêtre'
  if (type === 'screen-window') return 'Fenêtre écran'
  if (type === 'skylight') return 'Dalle en verre'
  if (type === 'elevator') return 'Ascenseur'
  if (type === 'ladder') return 'Échelle'
  if (type === 'hatch') return 'Trappe'
  if (type === 'stairs') return 'Escalier'
  return type
}

function stairQuarterTurns(stair) {
  if (stair?.kind === 'spiral') return ((Number(stair?.rotationQuarterTurns) || 0) % 4 + 4) % 4
  if (stair?.axis === 'z') return Number(stair?.dir) < 0 ? 3 : 1
  return Number(stair?.dir) < 0 ? 2 : 0
}

function rotatedStairPatch(stair, delta) {
  const quarterTurns = (stairQuarterTurns(stair) + delta + 4) % 4
  if (stair?.kind === 'spiral') return { rotationQuarterTurns: quarterTurns }
  return {
    axis: quarterTurns % 2 === 0 ? 'x' : 'z',
    dir: quarterTurns < 2 ? 1 : -1,
  }
}

const ELEVATOR_PHASE_LABELS = {
  idle: 'À l’arrêt',
  open: 'Portes ouvertes',
  closing: 'Fermeture',
  moving: 'En déplacement',
  opening: 'Ouverture',
  blocked: 'Porte bloquée',
}

function ElevatorRuntimeControls({
  connector,
  runtimeState,
  onCommand,
  canAdmin,
  interactionStopId = null,
  actorToken = null,
  passengerTokenIds = new Set(),
  t,
}) {
  const [pending, setPending] = useState(false)
  const stops = Array.isArray(connector.stops) ? connector.stops : []
  const interactionStop = stops.find(stop => String(stop.id) === String(interactionStopId)) || null
  const currentStop = stops.find(stop => stop.id === runtimeState?.currentStopId) || stops[0] || null
  const cabinHere = elevatorCabinIsAtStop(runtimeState, interactionStop, stops[0])
  const passengerIds = passengerTokenIds instanceof Set ? passengerTokenIds : new Set(passengerTokenIds || [])
  const actorOnBoard = actorToken && passengerIds.has(String(actorToken.id))
  const run = async command => {
    if (!onCommand || pending) return
    setPending(true)
    try { await onCommand(connector.worldId || connector.id, command) } finally { setPending(false) }
  }
  return (
    <div style={S.elevatorRuntime}>
      <div style={S.infoGrid}>
        <span>Cabine</span>
        <strong>{ELEVATOR_PHASE_LABELS[runtimeState?.phase] || 'État initial'}</strong>
        <span>Palier</span>
        <strong>{stops.find(stop => stop.id === runtimeState?.currentStopId)?.label || stops[0]?.label || '—'}</strong>
        <span>File</span>
        <strong>{runtimeState?.queue?.length || 0} appel(s)</strong>
      </div>
      {interactionStop ? (
        <div style={S.stopGrid}>
          {actorOnBoard ? (
            <>
              <span style={S.hint}>{t('elevator.onBoard', { token: actorToken.label || actorToken.id })}</span>
              {runtimeState?.phase === 'moving' ? (
                <strong>{t('elevator.travelling')}</strong>
              ) : stops.filter(stop => stop.id !== currentStop?.id).map(stop => (
                <button
                  key={stop.id}
                  type="button"
                  disabled={pending || !onCommand}
                  onClick={() => run({ type: 'request', stopId: stop.id })}
                  style={S.runtimeBtn}
                >
                  {t('elevator.goTo', { stop: stop.label || `Étage ${stop.level}` })}
                </button>
              ))}
            </>
          ) : !cabinHere ? (
            <button
              type="button"
              disabled={pending || !onCommand}
              onClick={() => run({ type: 'request', stopId: interactionStop.id })}
              style={S.runtimeBtn}
            >
              {t('elevator.call')}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={pending || !onCommand || !actorToken}
                onClick={() => run({ type: 'use', stopId: interactionStop.id, tokenId: actorToken?.id })}
                style={S.runtimeBtn}
              >
                {t('elevator.use')}
              </button>
              {!actorToken && <span style={S.hint}>{t('elevator.selectToken')}</span>}
            </>
          )}
        </div>
      ) : (
        <div style={S.stopGrid}>
          {stops.map(stop => (
            <button
              key={stop.id}
              type="button"
              disabled={pending || !onCommand}
              onClick={() => run({ type: 'request', stopId: stop.id })}
              style={{
                ...S.runtimeBtn,
                ...(runtimeState?.currentStopId === stop.id ? S.runtimeBtnCurrent : {}),
              }}
            >
              {stop.label || `Étage ${stop.level}`}
            </button>
          ))}
        </div>
      )}
      {canAdmin && (
        <div style={S.runtimeActions}>
          {runtimeState?.phase === 'blocked' ? (
            <button type="button" disabled={pending} onClick={() => run({ type: 'unblock' })} style={S.adminBtn}>Débloquer</button>
          ) : (
            <button type="button" disabled={pending} onClick={() => run({ type: 'block', reason: 'gm-door-obstruction' })} style={S.adminBtn}>Bloquer la porte</button>
          )}
          <button
            type="button"
            disabled={pending || ['moving', 'open', 'opening', 'blocked'].includes(runtimeState?.phase)}
            onClick={() => run({ type: 'open' })}
            style={S.adminBtn}
          >Ouvrir</button>
          <button type="button" disabled={pending || runtimeState?.phase !== 'open'} onClick={() => run({ type: 'close' })} style={S.adminBtn}>Fermer</button>
        </div>
      )}
      {runtimeState?.blockedReason && <p style={S.hint}>Blocage : {runtimeState.blockedReason}</p>}
    </div>
  )
}

export default function SurfaceConnectorPanel({
  connector,
  linkedHatch = null,
  hatchChoices = [],
  onVerticalAccessHatchChange = null,
  onVerticalAccessRotate = null,
  x,
  y,
  onPatch,
  onDelete,
  onClose,
  runtimeState = null,
  onElevatorCommand = null,
  elevatorInteractionStopId = null,
  elevatorActorToken = null,
  elevatorPassengerTokenIds = new Set(),
  onContinueElevatorRoute = null,
  onWindowStateChange = null,
  onHatchStateChange = null,
  canEdit = true,
  canAdminElevator = canEdit,
  canAdminFeature = canEdit,
}) {
  const { t } = useTranslation()
  const { position, beginDrag, panelRef } = useDraggablePanelPosition({
    x,
    y,
    width: PANEL_W,
    height: PANEL_H_EST,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const materialSlots = connectorModelMaterialSlots(connector)
  const materialOverrides = connector?.modelMaterialOverrides || {}
  const previewBlueprint = useMemo(() => ({
    glb_url: connector?.modelGlbUrl || null,
    geometry: connector?.modelGeometry || {},
    label: connector?.modelLabel || connectorTypeLabel(connector?.type),
  }), [connector?.modelGlbUrl, connector?.modelGeometry, connector?.modelLabel, connector?.type])
  const linkedHatchBlueprint = useMemo(() => hatchChoices.find(choice => (
    String(choice.id) === String(linkedHatch?.modelBlueprintId)
  )) || hatchChoices[0] || null, [hatchChoices, linkedHatch?.modelBlueprintId])
  if (!connector) return null

  const patchMaterialSlot = (slot, patch) => {
    onPatch?.(connector.id, {
      modelMaterialOverrides: setMaterialSlotOverride(materialOverrides, slot, patch),
    })
  }

  const clearMaterialSlot = (slot) => {
    onPatch?.(connector.id, {
      modelMaterialOverrides: clearMaterialSlotOverride(materialOverrides, slot),
    })
  }

  const isWindow = ['window', 'screen-window'].includes(connector.type)
  const allowedWindowStates = Array.isArray(connector.allowedStates)
    ? connector.allowedStates
    : ['transparent', ...(connector.type === 'screen-window' ? ['opaque', 'mirror'] : [])]
  const currentWindowState = runtimeState?.state || connector.state || 'transparent'
  const currentHatchState = runtimeState?.state || connector.state || 'closed'
  const stairShape = connector.type === 'stairs'
    ? stairGeometry(connector)
    : null
  const connectorTitle = connector.modelLabel
    || (connector.type === 'stairs'
      ? connector.kind === 'spiral' ? 'Escalier en colimaçon paramétrique' : 'Escalier droit paramétrique'
      : connectorTypeLabel(connector.type))
  const connectorLevelLabel = stairShape
    ? `${Math.round(Number(connector.y || 0) / 2.5)} → ${Math.round(Number(connector.topY || 2.5) / 2.5)}`
    : connector.fromLevel !== undefined && connector.toLevel !== undefined
      ? `${connector.fromLevel} → ${connector.toLevel}`
      : connector.level ?? 0
  const toggleAllowedState = state => {
    if (state === 'transparent') return
    const next = allowedWindowStates.includes(state)
      ? allowedWindowStates.filter(item => item !== state)
      : [...allowedWindowStates, state]
    onPatch?.(connector.id, { allowedStates: ['transparent', ...next.filter(item => item !== 'transparent')] })
  }

  const patchState = (state) => {
    if (connector.type === 'hatch') {
      onPatch?.(connector.id, { state })
      return
    }
    onPatch?.(connector.id, {
      state,
      ...connectorBlockingForState(connector.type, state),
    })
  }

  const patchProceduralAppearance = (patch) => {
    const material = { ...(connector.material || {}), ...patch }
    const switchesPattern = patch.pattern !== undefined
    const physical = patch.pattern === 'industrial_grate'
      ? { barrierType: 'grate', blocksSight: false, blocksMovement: true, blocksWater: false }
      : switchesPattern && connector.material?.pattern === 'industrial_grate' && connector.barrierType === 'grate'
        ? { barrierType: 'solid', blocksSight: true, blocksMovement: true, blocksWater: true }
        : {}
    onPatch?.(connector.id, { material, ...physical })
  }

  return (
    <div
      ref={panelRef}
      style={{ ...S.panel, left: position.left, top: position.top }}
      onPointerDown={event => event.stopPropagation()}
      data-testid="surface-connector-panel"
    >
      <div style={S.header} onPointerDown={beginDrag} data-testid="surface-connector-panel-handle">
        <div>
          <p style={S.kicker}>Objet 3D</p>
          <p style={S.title}>{connectorTitle}</p>
        </div>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <div style={S.infoGrid}>
          <span>Type</span>
          <strong>{connectorTypeLabel(connector.type)}</strong>
          <span>Étage</span>
          <strong>{connectorLevelLabel}</strong>
          <span>Dimensions</span>
          <strong>{stairShape
            ? stairShape.type === 'spiral'
              ? `Ø ${(stairShape.diameter * 1.5).toFixed(2)} × ${(stairShape.rise * 1.5).toFixed(2)} m`
              : `${(stairShape.width * 1.5).toFixed(2)} × ${(stairShape.run * 1.5).toFixed(2)} × ${(stairShape.rise * 1.5).toFixed(2)} m`
            : `${connector.width ?? connector.modelGeometry?.width ?? 1} × ${connector.depth ?? connector.modelGeometry?.depth ?? 1} × ${connector.height ?? connector.modelGeometry?.height ?? 1} m`}</strong>
        </div>

        {canEdit && connector.type === 'stairs' && stairShape && (
          <div style={S.field}>
            <span style={S.label}>Orientation</span>
            <div style={S.rotationActions}>
              <button type="button" onClick={() => onPatch?.(connector.id, rotatedStairPatch(connector, -1))} style={S.button}>
                ↶ Rotation gauche
              </button>
              <button type="button" onClick={() => onPatch?.(connector.id, rotatedStairPatch(connector, 1))} style={S.button}>
                Rotation droite ↷
              </button>
            </div>
            {connector.kind === 'spiral' && (
              <label style={S.stateRow}>
                <input
                  type="checkbox"
                  checked={connector.clockwise === true}
                  onChange={event => onPatch?.(connector.id, { clockwise: event.target.checked })}
                />
                <span>Montée dans le sens horaire</span>
              </label>
            )}
            <span style={S.hint}>
              {stairShape.stepCount} marches de {(stairShape.riserHeight * 1.5 * 100).toFixed(1)} cm,
              giron {(stairShape.treadDepth * 1.5 * 100).toFixed(0)} cm.
            </span>
          </div>
        )}

        {canEdit && connector.type === 'ladder' && (
          <div style={S.field}>
            <span style={S.label}>Orientation</span>
            <div style={S.rotationActions}>
              <button
                type="button"
                onClick={() => {
                  const rotated = rotateLadderOrientation(connector, -1)
                  if (onVerticalAccessRotate) {
                    onVerticalAccessRotate(connector.id, -1)
                    return
                  }
                  onPatch?.(connector.id, {
                    axis: rotated.axis,
                    side: rotated.side,
                    rotationQuarterTurns: rotated.rotationQuarterTurns,
                  })
                }}
                style={S.button}
              >
                ↶ Rotation gauche
              </button>
              <button
                type="button"
                onClick={() => {
                  const rotated = rotateLadderOrientation(connector, 1)
                  if (onVerticalAccessRotate) {
                    onVerticalAccessRotate(connector.id, 1)
                    return
                  }
                  onPatch?.(connector.id, {
                    axis: rotated.axis,
                    side: rotated.side,
                    rotationQuarterTurns: rotated.rotationQuarterTurns,
                  })
                }}
                style={S.button}
              >
                Rotation droite ↷
              </button>
            </div>
            <label style={S.field}>
              <span style={S.label}>{t('surfaceEditor.verticalAccessComposition')}</span>
              <select
                value={linkedHatch ? 'ladder-hatch' : 'ladder-only'}
                onChange={event => {
                  const value = event.target.value
                  if (value === 'ladder-only') {
                    onVerticalAccessHatchChange?.(connector.id, null)
                    return
                  }
                  if (linkedHatchBlueprint) onVerticalAccessHatchChange?.(connector.id, linkedHatchBlueprint)
                }}
                style={S.input}
              >
                <option value="ladder-only">{t('surfaceEditor.ladderOnly')}</option>
                <option value="ladder-hatch" disabled={hatchChoices.length === 0}>
                  {t('surfaceEditor.ladderAndHatch')}
                </option>
              </select>
            </label>
            <span style={S.hint}>
              {linkedHatch
                ? t('surfaceEditor.hatchCatalogInSidebar')
                : t('surfaceEditor.openOpening')}
            </span>
          </div>
        )}

        {canEdit && connector.type === 'hatch' && (
          <div style={S.field}>
            <span style={S.label}>Orientation de la trappe</span>
            <div style={S.runtimeActions}>
              <button
                type="button"
                onClick={() => {
                  const rotated = rotateHatchOrientation(connector, -1)
                  onPatch?.(connector.id, {
                    axis: rotated.axis,
                    hingeSide: rotated.hingeSide,
                    rotationQuarterTurns: rotated.rotationQuarterTurns,
                  })
                }}
                style={S.button}
              >
                ↶ Rotation gauche
              </button>
              <button
                type="button"
                onClick={() => {
                  const rotated = rotateHatchOrientation(connector, 1)
                  onPatch?.(connector.id, {
                    axis: rotated.axis,
                    hingeSide: rotated.hingeSide,
                    rotationQuarterTurns: rotated.rotationQuarterTurns,
                  })
                }}
                style={S.button}
              >
                Rotation droite ↷
              </button>
            </div>
          </div>
        )}

        {canEdit && connector.type === 'stairs' && (
          <div style={S.field}>
            <span style={S.label}>Garde-corps</span>
            {(connector.kind === 'spiral'
              ? [['outer', 'Côté extérieur']]
              : [['left', 'Côté gauche'], ['right', 'Côté droit']]
            ).map(([side, label]) => (
              <label key={side} style={S.stateRow}>
                <input
                  type="checkbox"
                  checked={connector.railings?.[side] !== false}
                  onChange={event => onPatch?.(connector.id, {
                    railings: {
                      ...(connector.railings || {}),
                      [side]: event.target.checked,
                    },
                  })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}

        {canEdit && connector.type === 'door' && (
          <label style={S.field}>
            <span style={S.label}>État</span>
            <select value={connector.state || 'closed'} onChange={e => patchState(e.target.value)} style={S.input}>
              <option value="closed">Fermée</option>
              <option value="open">Ouverte</option>
              <option value="locked">Verrouillée</option>
            </select>
          </label>
        )}

        {canEdit && connector.type === 'hatch' && (
          <label style={S.field}>
            <span style={S.label}>État initial</span>
            <select value={connector.state || 'closed'} onChange={e => patchState(e.target.value)} style={S.input}>
              <option value="closed">Fermée</option>
              <option value="open">Ouverte</option>
              <option value="locked">Verrouillée</option>
            </select>
          </label>
        )}

        {!canEdit && connector.type === 'hatch' && (
          <div style={S.field}>
            <span style={S.label}>Trappe</span>
            <div style={S.runtimeActions}>
              {[
                ['closed', 'Fermer'],
                ['open', 'Ouvrir'],
                ['locked', 'Verrouiller'],
              ].map(([state, label]) => (
                <button
                  key={state}
                  type="button"
                  disabled={!canAdminFeature || !onHatchStateChange || currentHatchState === state}
                  onClick={() => onHatchStateChange(connector.worldId || connector.id, state)}
                  style={{ ...S.runtimeBtn, ...(currentHatchState === state ? S.runtimeBtnCurrent : {}) }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isWindow && (
          <div style={S.field}>
            <span style={S.label}>États disponibles</span>
            {[
              ['transparent', 'Transparent'],
              ['opaque', 'Opaque'],
              ['mirror', 'Miroir'],
            ].map(([state, label]) => {
              const locked = state === 'transparent' || connector.type === 'window'
              const enabled = state === 'transparent' || (connector.type === 'screen-window' && allowedWindowStates.includes(state))
              if (connector.type === 'window' && state !== 'transparent') return null
              return (
                <label key={state} style={{ ...S.stateRow, ...(locked ? S.stateRowLocked : {}) }}>
                  <input type="checkbox" checked={enabled} disabled={!canEdit || locked} onChange={() => toggleAllowedState(state)} />
                  <span>{label}</span>
                </label>
              )
            })}
            {!canEdit && connector.type === 'screen-window' && (
              <div style={S.runtimeActions}>
                {allowedWindowStates.map(state => (
                  <button
                    key={state}
                    type="button"
                    disabled={!onWindowStateChange || currentWindowState === state}
                    onClick={() => onWindowStateChange(connector.worldId || connector.id, state)}
                    style={{ ...S.runtimeBtn, ...(currentWindowState === state ? S.runtimeBtnCurrent : {}) }}
                  >
                    {state === 'transparent' ? 'Transparent' : state === 'opaque' ? 'Opaque' : 'Miroir'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canEdit && connector.type === 'screen-window' && (
          <div style={S.field}>
            <span style={S.label}>Côté du boîtier</span>
            <button
              type="button"
              onClick={() => onPatch?.(connector.id, {
                modelFacing: connector.modelFacing === 'back' ? 'front' : 'back',
              })}
              style={S.button}
            >
              ↻ Retourner la fenêtre
            </button>
            <span style={S.hint}>
              Le boîtier est actuellement sur la face {connector.modelFacing === 'back' ? 'B' : 'A'}.
            </span>
          </div>
        )}

        {connector.type === 'elevator' && (
          <>
            {canEdit && (
              <div style={S.field}>
                <span style={S.label}>Arrêts et portes palières</span>
                {(connector.stops || []).map((stop, index) => (
                  <label key={stop.id} style={S.appearanceRow}>
                    <span>{stop.label || `Arrêt ${index + 1}`}</span>
                    <select
                      value={`${stop.doorAxis === 'x' ? 'x' : 'z'}:${Number(stop.doorSide) < 0 ? -1 : 1}`}
                      onChange={event => {
                        const [doorAxis, doorSide] = event.target.value.split(':')
                        onPatch?.(connector.id, {
                          stops: connector.stops.map(candidate => candidate.id === stop.id
                            ? { ...candidate, doorAxis, doorSide: Number(doorSide) }
                            : candidate),
                        })
                      }}
                      style={S.input}
                    >
                      <option value="z:-1">Nord</option>
                      <option value="x:1">Est</option>
                      <option value="z:1">Sud</option>
                      <option value="x:-1">Ouest</option>
                    </select>
                  </label>
                ))}
                {onContinueElevatorRoute && (
                  <button type="button" onClick={() => onContinueElevatorRoute(connector)} style={S.button}>
                    Continuer le trajet
                  </button>
                )}
                <span style={S.hint}>La direction ne peut changer qu’à un arrêt. Chaque porte est orientée indépendamment.</span>
              </div>
            )}
            <ElevatorRuntimeControls
              connector={connector}
              runtimeState={runtimeState}
              onCommand={onElevatorCommand}
              canAdmin={canAdminElevator}
              interactionStopId={elevatorInteractionStopId}
              actorToken={elevatorActorToken}
              passengerTokenIds={elevatorPassengerTokenIds}
              t={t}
            />
          </>
        )}

        {canEdit && <label style={S.field}>
          <span style={S.label}>Coût de déplacement</span>
          <input
            type="number"
            min="0.05"
            max="100"
            step="0.25"
            value={Math.max(0.05, Number(connector.movementMultiplier) || 1)}
            onChange={e => onPatch?.(connector.id, {
              movementMultiplier: Math.max(0.05, Math.min(100, Number(e.target.value) || 1)),
            })}
            style={S.input}
          />
          <span style={S.hint}>×1 normal, ×2 deux fois plus coûteux, jusqu’à ×100.</span>
        </label>}

        {canEdit && ['stairs', 'ladder'].includes(connector.type) && connector.material && !connector.modelGlbUrl && (
          <div style={S.field}>
            <span style={S.label}>Apparence procédurale</span>
            <label style={S.appearanceRow}>
              <span>Matière</span>
              <select
                value={connector.material.material || 'steel'}
                onChange={event => patchProceduralAppearance({ material: event.target.value })}
                style={S.input}
              >
                {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label style={S.appearanceRow}>
              <span>Motif</span>
              <select
                value={connector.material.pattern || 'none'}
                onChange={event => patchProceduralAppearance({ pattern: event.target.value })}
                style={S.input}
              >
                {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
                  <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
                ))}
              </select>
            </label>
            <label style={S.appearanceRow}>
              <span>Couleur</span>
              <input
                type="color"
                value={connector.material.paint || '#6f7f8e'}
                onChange={event => patchProceduralAppearance({ paint: event.target.value })}
                style={S.colorInput}
              />
            </label>
            {[
              ['wear', 'Usure'],
              ['dirt', 'Saleté'],
              ['relief', 'Relief'],
            ].map(([field, label]) => (
              <label key={field} style={S.appearanceRow}>
                <span>{label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Number(connector.material[field]) || 0}
                  onChange={event => patchProceduralAppearance({ [field]: Number(event.target.value) })}
                />
                <strong>{Number(connector.material[field]) || 0}</strong>
              </label>
            ))}
          </div>
        )}

        {canEdit && (materialSlots.length > 0 ? (
          <div style={S.field}>
            <span style={S.label}>Apparence</span>
            {previewBlueprint.glb_url && (
              <Object3DPreview blueprint={previewBlueprint} materialOverrides={materialOverrides} compact />
            )}
            <div style={S.slotList}>
              {materialSlots.map(slot => {
                const slotValue = materialSlotDisplayValue(materialOverrides, slot)
                return (
                  <label key={slot.code} style={S.slotRow}>
                    <span style={S.slotLabel}>
                      {slot.label || MODEL_SLOT_LABELS[slot.code]}
                      <small>{slot.code}</small>
                    </span>
                    <input
                      type="color"
                      value={slotValue.color}
                      onChange={e => patchMaterialSlot(slot, { color: e.target.value })}
                      style={S.colorInput}
                    />
                    <button type="button" onClick={() => clearMaterialSlot(slot)} style={S.resetBtn}>
                      Reset
                    </button>
                  </label>
                )
              })}
            </div>
          </div>
        ) : (
          <p style={S.hint}>Ce modèle n’expose pas de slots couleur.</p>
        ))}

        {canEdit && onDelete && (!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...S.button, ...S.danger }}>
            Supprimer l’objet 3D
          </button>
        ) : (
          <div style={S.deleteActions}>
            <button type="button" onClick={() => onDelete(connector.id)} style={{ ...S.button, ...S.danger }}>
              Confirmer la suppression
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={S.button}>
              Annuler
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 14px',
    borderBottom: '1px solid #1e1e2e',
    background: '#0a0a14',
    cursor: 'grab',
    touchAction: 'none',
  },
  kicker: {
    margin: 0,
    fontSize: '11px',
    color: '#f97316',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#dbeafe',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '4px',
  },
  body: {
    padding: '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 65px)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr)',
    gap: '5px 8px',
    color: '#64748b',
    fontSize: '11px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  stateRow: { display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '12px' },
  stateRowLocked: { opacity: 0.55 },
  rotationActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  appearanceRow: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) 28px',
    gap: '7px',
    alignItems: 'center',
    color: '#cbd5e1',
    fontSize: '11px',
  },
  label: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: '#0a0a14',
    border: '1px solid #1e1e2e',
    borderRadius: '5px',
    padding: '7px 10px',
    color: '#cbd5e1',
    fontSize: '12px',
    outline: 'none',
  },
  slotList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '7px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(91, 141, 238, 0.25)',
    background: 'rgba(15, 23, 42, 0.55)',
  },
  slotRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 34px 44px',
    gap: '6px',
    alignItems: 'center',
  },
  slotLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    color: '#cbd5e1',
    fontSize: '11px',
    minWidth: 0,
  },
  colorInput: {
    width: '34px',
    height: '29px',
    padding: '2px',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  resetBtn: {
    height: '28px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    background: '#0f0f1a',
    color: '#7f8eaa',
    fontSize: '10px',
    cursor: 'pointer',
  },
  button: {
    minHeight: '32px',
    border: '1px solid #35354e',
    borderRadius: '5px',
    background: '#151525',
    color: '#cbd5e1',
    fontSize: '10px',
    cursor: 'pointer',
  },
  deleteActions: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 72px',
    gap: '6px',
  },
  danger: {
    borderColor: 'rgba(251, 113, 133, 0.55)',
    background: 'rgba(127, 29, 29, 0.18)',
    color: '#fda4af',
  },
  hint: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    lineHeight: 1.35,
  },
  elevatorRuntime: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '9px',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    borderRadius: '7px',
    background: 'rgba(76, 29, 149, 0.12)',
  },
  stopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  runtimeBtn: {
    minHeight: '30px',
    border: '1px solid #3f3f5e',
    borderRadius: '5px',
    background: '#17172a',
    color: '#c4b5fd',
    fontSize: '11px',
    cursor: 'pointer',
  },
  runtimeBtnCurrent: {
    borderColor: '#a78bfa',
    background: 'rgba(124, 58, 237, 0.28)',
    color: '#f5f3ff',
  },
  runtimeActions: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
  },
  adminBtn: {
    minHeight: '27px',
    padding: '0 8px',
    border: '1px solid #4c1d95',
    borderRadius: '4px',
    background: '#211238',
    color: '#ddd6fe',
    fontSize: '10px',
    cursor: 'pointer',
  },
}
