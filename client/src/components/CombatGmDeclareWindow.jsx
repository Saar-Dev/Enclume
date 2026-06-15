import { useState, useEffect, useRef } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api'
import {
  STATE_DEFS, QUICK_ACTIONS, MAP_ACTIONS,
  calcIniDelta,
  FIRE_MODE_VARIANTS, CC_REPS_STEPS, RL_BUTTONS,
} from './combatSections.js'
import { DEFAULT_PNJ_ALLURES } from '../../../shared/polarisUtils.js'
import { useDraggable } from '../lib/useDraggable.js'

// ---------------------------------------------------------------------------
// Etat par défaut (= DEFAULT colonne DB)
// ---------------------------------------------------------------------------
const STATE_DEFAULTS = {
  position:  'standing',
  weapon:    'holstered',
  fire_mode: 'cc',
  cover:     'exposed',
  vitesse:   'normal',
}

function nextKey(stateKey, currentKey, availableKeys) {
  const allStates = STATE_DEFS[stateKey].states
  const states    = availableKeys ? allStates.filter(s => availableKeys.includes(s.k)) : allStates
  if (states.length === 0) return currentKey
  const idx = states.findIndex(s => s.k === currentKey)
  if (idx === -1) return states[0].k
  return states[(idx + 1) % states.length].k
}

// ---------------------------------------------------------------------------
// InlineChip — puce click-to-cycle compacte
// availableKeys : restreint les états cyclables (ex: modes de tir de l'arme)
// ---------------------------------------------------------------------------
function InlineChip({ stateKey, initial, current, onChange, availableKeys }) {
  const def  = STATE_DEFS[stateKey]
  const cur  = def.states.find(s => s.k === current)
  const cost = current === initial ? 0 : (def.cost?.[initial]?.[current] ?? 0)

  return (
    <div onClick={() => onChange(nextKey(stateKey, current, availableKeys))} style={S.chip}>
      <span style={S.chipLabel}>{def.label}</span>
      <span style={S.chipValue}>{cur?.l ?? current}</span>
      {cost !== 0 && (
        <span style={{ ...S.chipCost, color: cost > 0 ? '#3aaa6a' : '#c86030' }}>
          {cost > 0 ? `+${cost}` : cost}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
export default function CombatGmDeclareWindow({ socket, characters, onEnterMoveMode, battlemapId, onEnterTargetMode, combatTargetMode, pjPreview }) {
  const { roster, activeTokenId: storeActiveTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  // Slot actif courant — fallback calculé si COMBAT_SLOT_ADVANCED pas encore reçu
  const activeTokenId = storeActiveTokenId ?? (
    [...roster]
      .filter(r => !r.has_announced && r.status === 'active')
      .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
  )

  const [declareError, setDeclareError] = useState(null)
  const [equipment,    setEquipment]    = useState({})   // tokenId -> { characterId, weapon, armorPieces }
  const [rosterOpen,   setRosterOpen]   = useState(
    () => localStorage.getItem('gm-roster-open') !== 'false'
  )

  // ── États de déclaration pour le PNJ actif ───────────────────────────────
  const [localStates,     setLocalStates]     = useState({ ...STATE_DEFAULTS })
  const [localQuick,      setLocalQuick]      = useState({ observer: 0, reperer: 0, phrase: false })
  const [mapAction,       setMapAction]       = useState(null)     // 'reload' | 'interact' | null
  const [combatMode,      setCombatMode]      = useState('normal')
  const [meleeAttackCount,setMeleeAttackCount]= useState(1)
  const [meleePendingMode,setMeleePendingMode]= useState(false)
  const [pendingMove,     setPendingMove]     = useState(null)     // sel ou null
  const [assaultTarget,   setAssaultTarget]   = useState(null)     // { targetTokenId } | null
  const [meleeTargets,    setMeleeTargets]    = useState([])       // [tokenId, ...]
  const [chargeSelection, setChargeSelection] = useState(null)     // { move, targetTokenId } | null
  // Tir GM — variant mode de tir (miroir PJ)
  const [assaultBulletCount,  setAssaultBulletCount]  = useState(null)   // number | 'multi' | null
  const [assaultVariantAB,    setAssaultVariantAB]    = useState('A')
  // CaC GM — sélection arme (null = mains nues)
  const [selectedGmMeleeWeaponId, setSelectedGmMeleeWeaponId] = useState(null)
  // Drone GM — arme sélectionnée + catalogue récupéré
  const [selectedDroneWeaponId, setSelectedDroneWeaponId] = useState(null)
  const [droneWeapons, setDroneWeapons] = useState([])

  const tokensRef = useRef(tokens)
  useEffect(() => { tokensRef.current = tokens }, [tokens])

  // ── Reset complet quand le slot actif change ─────────────────────────────
  useEffect(() => {
    setLocalStates({ ...initialStates })
    setLocalQuick({ observer: 0, reperer: 0, phrase: false })
    setMapAction(null)
    setCombatMode('normal')
    setMeleeAttackCount(1)
    setMeleePendingMode(false)
    setPendingMove(null)
    setAssaultTarget(null)
    setMeleeTargets([])
    setChargeSelection(null)
    setAssaultBulletCount(null)
    setAssaultVariantAB('A')
    setSelectedGmMeleeWeaponId(null)
    setSelectedDroneWeaponId(null)
    setDroneWeapons([])
  }, [activeTokenId])

  // Sync states initiaux depuis rosterEntry
  const activePnjEntry = activeTokenId ? roster.find(r => r.token_id === activeTokenId) : null
  const initialStates = activePnjEntry
    ? {
        position:  activePnjEntry.state_position  ?? 'standing',
        weapon:    activePnjEntry.state_weapon    ?? 'holstered',
        fire_mode: activePnjEntry.state_fire_mode ?? 'cc',
        cover:     activePnjEntry.state_cover     ?? 'exposed',
        vitesse:   activePnjEntry.state_vitesse   ?? 'normal',
      }
    : { ...STATE_DEFAULTS }

  // ── Écoute COMBAT_DECLARE_ERROR ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handler = ({ message }) => {
      setDeclareError(message)
      setTimeout(() => setDeclareError(null), 4000)
    }
    socket.on(WS.COMBAT_DECLARE_ERROR, handler)
    return () => socket.off(WS.COMBAT_DECLARE_ERROR, handler)
  }, [socket])

  // ── Fetch équipement combat ──────────────────────────────────────────────
  useEffect(() => {
    if (!battlemapId) return
    api.get(`/battlemaps/${battlemapId}/combat-equipment`)
      .then(r => setEquipment(r.data.equipment ?? {}))
      .catch(() => {})
  }, [battlemapId])

  // ── Fetch armes drone quand le slot actif est un drone ───────────────────
  const activeDroneCharId = (() => {
    if (!activeTokenId) return null
    const tok = tokens.find(t => t.id === activeTokenId)
    if (!tok?.character_id) return null
    const char = characters.find(c => c.id === tok.character_id)
    return char?.type === 'drone' ? char.id : null
  })()

  useEffect(() => {
    if (!activeDroneCharId) return
    api.get(`/char-sheet/${activeDroneCharId}/drone/weapons`)
      .then(r => {
        const weapons = r.data.weapons ?? []
        setDroneWeapons(weapons)
        if (weapons.length > 0) setSelectedDroneWeaponId(weapons[0].id)
      })
      .catch(() => setDroneWeapons([]))
  }, [activeDroneCharId])

  // Auto-sélection arme CaC GM — première arme de contact disponible pour le slot actif
  useEffect(() => {
    if (!activeTokenId) return
    const w = equipment[activeTokenId]?.weapon ?? null
    if (w && !w.ref_fire_mode) setSelectedGmMeleeWeaponId(w.inv_id)
  }, [activeTokenId, equipment])

  // ── Helpers ─────────────────────────────────────────────────────────────
  const isPnj = (entry) => {
    const token = tokens.find(t => t.id === entry.token_id)
    if (!token?.character_id) return false
    return characters.find(c => c.id === token.character_id)?.type === 'pnj'
  }
  const isDroneGmManaged = (entry) => {
    const token = tokens.find(t => t.id === entry.token_id)
    if (!token?.character_id) return false
    const char = characters.find(c => c.id === token.character_id)
    return char?.type === 'drone'
  }
  const isGmManaged = (entry) => isPnj(entry) || isDroneGmManaged(entry)

  const getLabel = (tokenId) => tokens.find(t => t.id === tokenId)?.label ?? tokenId
  const isRanged = (tokenId) => !!equipment[tokenId]?.weapon?.ref_fire_mode

  const allGmManaged   = roster.filter(r => r.status === 'active').filter(isGmManaged)
  const sortedGmManaged= [...allGmManaged].sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))
  const unannouncedCnt = allGmManaged.filter(r => !r.has_announced).length

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-gm-declare-pos',
    { top: window.innerHeight - 660, left: window.innerWidth - 456 },
    440,
  )

  if (allGmManaged.length === 0) return null

  // ── Dériver l'entité active (PNJ ou drone) ────────────────────────────────
  const isActivePnj   = activePnjEntry && isPnj(activePnjEntry)        && !activePnjEntry.has_announced
  const isActiveDrone = activePnjEntry && isDroneGmManaged(activePnjEntry) && !activePnjEntry.has_announced
  const activeToken = activeTokenId ? tokens.find(t => t.id === activeTokenId) : null
  const isStunnedActivePnj = activeToken?.statuses?.includes('stunned') ?? false

  // Quand le slot actif est un PJ (ni PNJ ni drone) — identifier le bloquant
  const blockerEntry = (!isActivePnj && !isActiveDrone && activePnjEntry && !activePnjEntry.has_announced) ? activePnjEntry : null
  const blockerIsPj  = blockerEntry ? !isPnj(blockerEntry) && !isDroneGmManaged(blockerEntry) : false

  const weapon       = isActivePnj ? (equipment[activeTokenId]?.weapon ?? null) : null
  const rangedActive = isActivePnj && isRanged(activeTokenId)

  // ── INI delta ────────────────────────────────────────────────────────────
  const iniDelta = isActivePnj ? calcIniDelta(
    initialStates,
    localStates,
    {
      move:  pendingMove ?? null,
      attack: null,
      melee: meleeTargets.length > 0 ? meleeTargets : null,
    },
    localQuick,
  ) : 0

  const meleeDefensif    = combatMode === 'defensif' || combatMode === 'retraite'
  const effectiveMeleeCount = combatMode === 'charge' ? 1 : meleeAttackCount
  // CaC — arme sélectionnée (null = mains nues, sinon inv_id)
  // Si le GM a une arme de contact disponible et l'a sélectionnée, on l'utilise
  const meleeWeaponAvailable = weapon && !weapon.ref_fire_mode ? weapon : null
  const weaponInvIdForMelee  = selectedGmMeleeWeaponId  // null = mains nues

  // Tir GM — mode de tir et variant (miroir logique CombatActionWindow)
  const availableFireModes = weapon?.ref_fire_mode
    ? weapon.ref_fire_mode.split('/').map(s => s.trim().toLowerCase())
    : ['cc']
  const currentFireMode = localStates.fire_mode.toUpperCase()
  // bulletCount effectif : CC défaut = 1 (tir simple), RC = 3 auto, RL = choix explicite
  const effectiveBulletCount = assaultBulletCount ?? (
    currentFireMode === 'RC' ? 3 :
    currentFireMode === 'CC' ? 1 :
    null
  )
  let currentVariant = null
  if (currentFireMode === 'RC') {
    currentVariant = FIRE_MODE_VARIANTS.RC[0]
  } else if (currentFireMode === 'CC' && effectiveBulletCount) {
    if (effectiveBulletCount === 7) {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (assaultVariantAB === 'B' ? 'cc_7b' : 'cc_7a'))
    } else if (effectiveBulletCount === 10) {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (assaultVariantAB === 'B' ? 'cc_10b' : 'cc_10a'))
    } else {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.bulletCount === effectiveBulletCount)
    }
  } else if (currentFireMode === 'RL' && assaultBulletCount) {
    currentVariant = assaultBulletCount === 'multi'
      ? FIRE_MODE_VARIANTS.RL.find(v => v.id === 'rl_mc')
      : FIRE_MODE_VARIANTS.RL.find(v => v.bulletCount === assaultBulletCount)
  }
  // Slider CC répétition
  const ccSliderIdx = assaultBulletCount && assaultBulletCount !== 1
    ? CC_REPS_STEPS.indexOf(assaultBulletCount)
    : 0
  const ccSliderDisplayIdx = ccSliderIdx === -1 ? 0 : ccSliderIdx

  // ── canDeclare ───────────────────────────────────────────────────────────
  const stateChanged = isActivePnj && Object.keys(localStates).some(k => localStates[k] !== initialStates[k])
  const hasAction    = isActivePnj && (
    !!assaultTarget?.targetTokenId ||
    (meleeTargets.length >= effectiveMeleeCount && !meleeDefensif) ||
    meleeDefensif ||
    !!pendingMove ||
    !!chargeSelection?.targetTokenId ||
    !!mapAction ||
    combatMode !== 'normal' ||
    localQuick.observer > 0 || localQuick.reperer > 0 || localQuick.phrase
  )
  // Si cible d'assaut sélectionnée, un variant doit être configuré
  const assaultValid = !assaultTarget?.targetTokenId || currentVariant !== null
  const canDeclareDrone = isActiveDrone && !!selectedDroneWeaponId && !!assaultTarget?.targetTokenId
  const canDeclare = (isActivePnj && (stateChanged || hasAction) && assaultValid) || canDeclareDrone

  // ── Déplacement direct ───────────────────────────────────────────────────
  const handleStartMove = () => {
    if (!onEnterMoveMode || !activeTokenId || !activeToken) return
    onEnterMoveMode(
      DEFAULT_PNJ_ALLURES, activeTokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (sel) => setPendingMove(sel),
      () => setPendingMove(null),
    )
  }

  // ── Assaut direct ────────────────────────────────────────────────────────
  const handleStartAttack = () => {
    if (!onEnterTargetMode || !activeTokenId || !activeToken) return
    setAssaultTarget(null)
    onEnterTargetMode(
      activeTokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => setAssaultTarget({ targetTokenId: targetId }),
      () => {},
      'ranged'
    )
  }

  // ── Melee direct ────────────────────────────────────────────────────────
  const handleStartMelee = () => {
    if (!onEnterTargetMode || !activeTokenId || !activeToken) return
    setMeleeTargets([])
    // Pour N attaques, on enchaîne N sélections
    const selectNext = (idx) => {
      onEnterTargetMode(
        activeTokenId,
        { x: activeToken.pos_x, z: activeToken.pos_y },
        (targetId) => {
          setMeleeTargets(prev => {
            const next = [...prev]
            next[idx] = targetId
            return next
          })
          if (idx + 1 < effectiveMeleeCount) selectNext(idx + 1)
        },
        () => {},
        'melee'
      )
    }
    selectNext(0)
  }

  // ── Charge (move court gratuit → cible CaC) ─────────────────────────────
  const handleStartCharge = () => {
    if (!activeToken) return
    setCombatMode('charge')
    setChargeSelection(null)
    const chargeAllures = {
      lente: DEFAULT_PNJ_ALLURES.lente, moyenne: DEFAULT_PNJ_ALLURES.lente,
      rapide: DEFAULT_PNJ_ALLURES.lente, max:    DEFAULT_PNJ_ALLURES.lente,
    }
    onEnterMoveMode?.(
      chargeAllures, activeTokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (sel) => {
        const move = { ...sel, ini_mod: 0 }
        onEnterTargetMode?.(
          activeTokenId,
          { x: activeToken.pos_x, z: activeToken.pos_y },
          (targetId) => setChargeSelection({ move, targetTokenId: targetId }),
          () => setCombatMode('normal'),
          'melee'
        )
      },
      () => setCombatMode('normal'),
    )
  }

  // ── Declare ─────────────────────────────────────────────────────────────
  const handleDeclare = () => {
    if (!socket || !canDeclare || !activeTokenId) return

    // Drone : payload simplifié — droneWeaponInvId + cible
    // fire_mode : lu depuis drone_weapons (configuré dans la fiche drone, onglet Armes)
    if (isActiveDrone) {
      const selectedDroneWeapon = droneWeapons.find(w => w.id === selectedDroneWeaponId)
      socket.emit(WS.COMBAT_ACTION_DECLARE, {
        tokenId: activeTokenId,
        state: { position: 'standing', weapon: 'holstered', fire_mode: selectedDroneWeapon?.fire_mode ?? 'rc', cover: 'exposed', vitesse: 'normal' },
        mapActions: {
          attack: {
            droneWeaponInvId: selectedDroneWeaponId,
            targetTokenId:    assaultTarget?.targetTokenId ?? null,
          },
        },
      })
      return
    }

    const meleeCaC = chargeSelection?.targetTokenId
      ? [{ targetTokenId: chargeSelection.targetTokenId, weaponInvId: weaponInvIdForMelee }]
      : meleeTargets.slice(0, effectiveMeleeCount).map(id => ({ targetTokenId: id, weaponInvId: weaponInvIdForMelee }))
    const movePayload = chargeSelection?.move ?? pendingMove ?? null
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: activeTokenId,
      state: { ...localStates, combat_mode: combatMode },
      mapActions: {
        move:     movePayload,
        attack:   weapon && assaultTarget?.targetTokenId ? {
          weaponInvId:        weapon.inv_id,
          targetTokenId:      assaultTarget.targetTokenId,
          bulletCount:        currentVariant?.bulletCount ?? null,
          fireModeBonusComp:  currentVariant?.bonusComp   ?? 0,
          fireModeBonusDmg:   currentVariant?.bonusDmg    ?? 0,
          isDualWield:        false,
          dualWieldBonusComp: 0,
        } : null,
        melee:    meleeCaC.length > 0 ? meleeCaC : null,
        reload:   mapAction === 'reload',
        multi:    false,
        interact: mapAction === 'interact',
      },
      quick: { ...localQuick },
    })
  }

  // ── Etat CaC actif (pour affichage panneau droit) ─────────────────────────
  const isMeleeSetup = isActivePnj && (
    meleePendingMode ||
    meleeTargets.length > 0 ||
    !!chargeSelection
  )

  // ── Attack actif (visuellement) ───────────────────────────────────────────
  const isAttackActive = !!assaultTarget || (combatTargetMode?.tokenId === activeTokenId && !isMeleeSetup)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="combat-win" style={{ width: (isMeleeSetup || isAttackActive) ? 720 : 440, left: pos.left, top: pos.top }}>

      {/* HEADER */}
      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <span className="combat-win-title" style={{ flex: 1 }}>PHASE 1 — DÉCLARATION</span>
        <span style={S.headerProgress}>{allGmManaged.length - unannouncedCnt}/{allGmManaged.length} déclarés</span>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* COLONNE GAUCHE */}
        <div style={{ flex: '0 0 440px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* CONTROLS — seulement si c'est le tour d'un PNJ */}
          {isActivePnj && (
            <div style={S.controls}>

              {/* TACTIQUE */}
              <div className="combat-win-section">
                <span className="combat-win-section-title">TACTIQUE</span>
                <div style={S.chips}>
                  {['position', 'cover', 'vitesse'].map(k => (
                    <InlineChip key={k} stateKey={k}
                      initial={initialStates[k]}
                      current={localStates[k]}
                      onChange={v => setLocalStates(s => ({ ...s, [k]: v }))} />
                  ))}
                </div>
              </div>

              {/* ARMEMENT */}
              <div className="combat-win-section">
                <span className="combat-win-section-title" style={{ color: '#aa6a30' }}>ARMEMENT</span>
                <div style={S.chips}>
                  {['weapon', 'fire_mode'].map(k => (
                    <InlineChip key={k} stateKey={k}
                      initial={initialStates[k]}
                      current={localStates[k]}
                      availableKeys={k === 'fire_mode' && rangedActive ? availableFireModes : undefined}
                      onChange={v => {
                        setLocalStates(s => ({ ...s, [k]: v }))
                        if (k === 'fire_mode') { setAssaultBulletCount(null); setAssaultVariantAB('A') }
                      }} />
                  ))}
                </div>
              </div>

              {/* ACTION */}
              <div className="combat-win-section">
                <span className="combat-win-section-title" style={{ color: '#aa8a30' }}>ACTION</span>
                <div style={S.actionGrid}>
                  {MAP_ACTIONS.map(a => {
                    const disabled = (a.k === 'attack' && !rangedActive) || (isStunnedActivePnj && (a.k === 'attack' || a.k === 'melee'))
                    const active   = !disabled && (
                      a.k === 'attack' ? isAttackActive :
                      a.k === 'melee'  ? isMeleeSetup   :
                      a.k === 'move'   ? !!pendingMove   :
                      mapAction === a.k
                    )
                    const span2 = a.span2 ? { gridColumn: 'span 2' } : {}
                    const stunTitle = isStunnedActivePnj && (a.k === 'attack' || a.k === 'melee')
                      ? 'Assommé — −5 à toutes les actions, allure max = Moyenne, ne peut pas attaquer'
                      : null
                    return (
                      <div key={a.k}
                        title={stunTitle ?? a.tooltip}
                        onClick={() => {
                          if (disabled) return
                          if (a.k === 'move') {
                            if (pendingMove) { setPendingMove(null); return }
                            handleStartMove()
                          } else if (a.k === 'attack') {
                            if (isAttackActive) {
                              setAssaultTarget(null)
                              setAssaultBulletCount(null)
                              setAssaultVariantAB('A')
                              return
                            }
                            handleStartAttack()
                          } else if (a.k === 'melee') {
                            if (isMeleeSetup) {
                              setMeleePendingMode(false)
                              setMeleeTargets([])
                              setChargeSelection(null)
                              setCombatMode('normal')
                            } else {
                              setMeleePendingMode(true)
                            }
                          } else {
                            setMapAction(prev => prev === a.k ? null : a.k)
                          }
                        }}
                        style={{
                          ...S.actionBtn,
                          ...(active   ? S.actionBtnActive   : {}),
                          ...(disabled ? S.actionBtnDisabled : {}),
                          ...span2,
                        }}
                      >
                        <span style={{ ...S.actionLabel, color: active ? '#e8c870' : (disabled ? '#2a3040' : '#aaccdd') }}>
                          {a.l}
                        </span>
                        {a.ini && !disabled && (
                          <span style={{ ...S.actionIni, color: active ? '#e8c870' : '#5a6070' }}>{a.ini}</span>
                        )}
                        {disabled && (
                          <span style={S.actionDisabledTag}>sans arme dist.</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Déplacement sélectionné */}
                {pendingMove && !chargeSelection && (
                  <div style={S.attackTargetRow}>
                    <span style={S.attackTargetLabel}>⇒</span>
                    <span style={{ ...S.attackTargetName, color: '#5b8dee' }}>
                      [{pendingMove.targetPosX}, {pendingMove.targetPosY}]
                    </span>
                  </div>
                )}
              </div>

              {/* ACTIONS RAPIDES */}
              <div className="combat-win-section" style={{ borderBottom: 'none' }}>
                <span className="combat-win-section-title" style={{ color: '#5a8a5a' }}>ACTIONS RAPIDES</span>
                <div style={S.quickList}>
                  {QUICK_ACTIONS.map(qa => {
                    if (qa.kind === 'incremental') {
                      const val = localQuick[qa.k] ?? 0
                      return (
                        <div key={qa.k}
                          title={qa.tooltip}
                          style={{ ...S.quickRow, ...(val > 0 ? S.quickRowActive : {}) }}
                          onClick={() => val === 0 && setLocalQuick(q => ({ ...q, [qa.k]: 1 }))}
                        >
                          <span style={S.quickLabel}>{qa.l}</span>
                          <div style={S.sliderWrap} onClick={val > 0 ? e => e.stopPropagation() : undefined}>
                            <input type="range" min={0} max={qa.max} step={1} value={val}
                              disabled={val === 0}
                              style={{ ...S.slider, opacity: val > 0 ? 1 : 0.3 }}
                              onChange={e => setLocalQuick(q => ({ ...q, [qa.k]: Number(e.target.value) }))} />
                            <span style={{ ...S.sliderVal, color: val > 0 ? '#5b8dee' : '#456575' }}>
                              {val > 0 ? `${val * qa.stepIni}` : '–'}
                            </span>
                          </div>
                        </div>
                      )
                    }
                    const isOn = !!localQuick[qa.k]
                    return (
                      <div key={qa.k}
                        title={qa.tooltip}
                        style={{ ...S.quickRow, ...(isOn ? S.quickRowActive : {}) }}
                        onClick={() => setLocalQuick(q => ({ ...q, [qa.k]: !q[qa.k] }))}
                      >
                        <span style={S.quickLabel}>{qa.l}</span>
                        {qa.ini && <span style={{ color: isOn ? '#5b8dee' : '#456575', fontSize: 10 }}>{qa.ini}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* DRONE — Sélection arme + cible */}
          {isActiveDrone && (
            <div style={S.controls}>
              <div className="combat-win-section">
                <span className="combat-win-section-title" style={{ color: '#30aaaa' }}>ARMEMENT DRONE</span>
                {droneWeapons.length === 0 ? (
                  <span style={{ color: '#607070', fontSize: 11, padding: '4px 0' }}>Aucune arme configurée</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {droneWeapons.map(w => (
                      <div key={w.id}
                        onClick={() => setSelectedDroneWeaponId(w.id)}
                        style={{
                          ...S.weaponOption,
                          ...(selectedDroneWeaponId === w.id ? S.weaponOptionActive : {}),
                        }}
                      >
                        <span style={S.weaponOptionLabel}>{w.display_name ?? w.ref_name ?? 'Arme drone'}</span>
                        <span style={{ fontSize: 9, color: '#507070', fontFamily: 'monospace' }}>
                          {w.fire_mode?.toUpperCase() ?? '?'} {w.damage_formula ?? w.ref_damage_h ?? ''}
                        </span>
                        <span style={{ ...S.weaponRadio, ...(selectedDroneWeaponId === w.id ? S.weaponRadioActive : {}) }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="combat-win-section">
                <span className="combat-win-section-title" style={{ color: '#aa8a30' }}>CIBLE</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="btn"
                    onClick={() => {
                      if (!onEnterTargetMode || !activeTokenId || !activeToken) return
                      setAssaultTarget(null)
                      onEnterTargetMode(
                        activeTokenId,
                        { x: activeToken.pos_x, z: activeToken.pos_y },
                        (targetId) => setAssaultTarget({ targetTokenId: targetId }),
                        () => {},
                        'ranged',
                      )
                    }}
                    style={{ minWidth: 70 }}
                  >
                    Cibler
                  </button>
                  {assaultTarget?.targetTokenId && (
                    <span style={{ color: '#e07070', fontSize: 11 }}>
                      → {getLabel(assaultTarget.targetTokenId)}
                    </span>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Message d'attente / monitoring — slot actif = PJ (ni PNJ ni drone) */}
          {!isActivePnj && !isActiveDrone && activeTokenId && (
            <div style={S.waitBlock}>
              <span style={S.waitText}>
                En attente de <strong style={{ color: '#c0c0d0' }}>{getLabel(activeTokenId)}</strong>
              </span>

              {/* Panneau monitoring live — preview en cours du PJ actif */}
              {pjPreview?.tokenId === activeTokenId && (
                <div style={S.monitorPanel}>
                  <div style={S.monitorTitle}>En cours de déclaration…</div>

                  {/* Actions sélectionnées */}
                  {pjPreview.actions?.length > 0 && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>⚡</span>
                      <span style={S.monitorText}>
                        {pjPreview.actions.join(' + ')}
                      </span>
                    </div>
                  )}

                  {/* Cible assaut */}
                  {pjPreview.assaultTargetId && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>→</span>
                      <span style={{ ...S.monitorText, color: '#e07070' }}>
                        {getLabel(pjPreview.assaultTargetId)}
                      </span>
                    </div>
                  )}

                  {/* Cibles melee */}
                  {pjPreview.meleeTargetIds?.length > 0 && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>⚔</span>
                      <span style={{ ...S.monitorText, color: '#70c070' }}>
                        {pjPreview.meleeTargetIds.map(id => getLabel(id)).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Déplacement */}
                  {pjPreview.moveDestination && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>⇒</span>
                      <span style={{ ...S.monitorText, color: '#5b8dee' }}>
                        [{pjPreview.moveDestination.x}, {pjPreview.moveDestination.y}]
                      </span>
                    </div>
                  )}

                  {/* Mode combat si différent de normal */}
                  {pjPreview.combatMode && pjPreview.combatMode !== 'normal' && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>◈</span>
                      <span style={S.monitorText}>{pjPreview.combatMode}</span>
                    </div>
                  )}
                </div>
              )}

              {blockerIsPj && (
                <button
                  style={S.btnSkip}
                  onClick={() => socket?.emit(WS.COMBAT_SKIP_PLAYER, { tokenId: activeTokenId })}
                >
                  Passer
                </button>
              )}
            </div>
          )}

          {/* ROSTER */}
          <div style={S.roster}>
            <div style={S.rosterHeader}>
              <span style={S.rosterTitle}>ROSTER — {allGmManaged.length} PNJs/Drones</span>
              <button
                onClick={() => {
                  const next = !rosterOpen
                  setRosterOpen(next)
                  localStorage.setItem('gm-roster-open', next ? 'true' : 'false')
                }}
                style={S.rosterToggle}
              >
                {rosterOpen ? '▲' : '▼'}
              </button>
            </div>
            {rosterOpen && <div style={S.rosterList}>
              {sortedGmManaged.map(entry => {
                const tid     = entry.token_id
                const isAct   = tid === activeTokenId && (isActivePnj || isActiveDrone)
                const isDone  = entry.has_announced
                const delta   = isDone ? null : (tid === activeTokenId ? iniDelta : null)

                return (
                  <div key={tid}
                    style={{
                      ...S.rosterRow,
                      ...(isAct  ? S.rosterRowActive : {}),
                      opacity: isDone ? 0.35 : 1,
                    }}
                  >
                    <span style={{ ...S.rosterGlyph, color: isDone ? '#5a7080' : (isAct ? '#3a8aaa' : '#456575') }}>
                      {isDone ? '✓' : (isAct ? '▶' : '○')}
                    </span>
                    <span style={{ ...S.rosterName, fontWeight: isAct ? 600 : 400 }}>
                      {getLabel(tid)}
                    </span>
                    <span style={{
                      ...S.rosterBadge,
                      ...(isRanged(tid) ? S.rosterBadgeDst : (equipment[tid]?.weapon ? S.rosterBadgeCct : S.rosterBadgeNone))
                    }}>
                      {isRanged(tid) ? 'DST' : (equipment[tid]?.weapon ? 'CTC' : '···')}
                    </span>
                    <span style={S.rosterIni}>INI {entry.initiative}</span>
                    {delta !== null && delta !== 0 && (
                      <span style={{ ...S.rosterDelta, color: delta < 0 ? '#c86030' : '#3aaa6a' }}>
                        →{entry.initiative + delta}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>}
          </div>
        </div>

        {/* PANNEAU DROIT — Mode CaC */}
        {isMeleeSetup && isActivePnj && (() => {
          const curMode   = combatMode
          const chargeTgt = chargeSelection?.targetTokenId ? tokens.find(t => t.id === chargeSelection.targetTokenId) : null
          const isQueueTarget = combatTargetMode?.tokenId === activeTokenId && !chargeSelection?.targetTokenId
          return (
            <div style={S.meleePanelGm}>

              {/* Sélection arme CaC */}
              <div style={S.meleePanelTitle}>ARME</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                {/* Mains nues */}
                <div
                  onClick={() => setSelectedGmMeleeWeaponId(null)}
                  style={{ ...S.weaponOption, ...(selectedGmMeleeWeaponId === null ? S.weaponOptionActive : {}) }}
                >
                  <span style={S.weaponOptionLabel}>Mains nues</span>
                  <span style={{ ...S.weaponRadio, ...(selectedGmMeleeWeaponId === null ? S.weaponRadioActive : {}) }} />
                </div>
                {/* Arme de contact (si équipée et non-ranged) */}
                {meleeWeaponAvailable && (
                  <div
                    onClick={() => setSelectedGmMeleeWeaponId(meleeWeaponAvailable.inv_id)}
                    style={{ ...S.weaponOption, ...(selectedGmMeleeWeaponId === meleeWeaponAvailable.inv_id ? S.weaponOptionActive : {}) }}
                  >
                    <span style={S.weaponOptionLabel}>{meleeWeaponAvailable.name ?? 'Arme'}</span>
                    <span style={{ fontSize: 8, color: '#507050', fontFamily: 'monospace' }}>{meleeWeaponAvailable.slot}</span>
                    <span style={{ ...S.weaponRadio, ...(selectedGmMeleeWeaponId === meleeWeaponAvailable.inv_id ? { ...S.weaponRadioActive, borderColor: '#70c070', background: '#70c070' } : {}) }} />
                  </div>
                )}
              </div>

              <div style={S.meleePanelTitle}>MODE DE COMBAT</div>

              {/* Chips Normal / Offensif / Charge / Défensif / Retraite */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {[
                  { k: 'normal',   l: 'Normal',   tooltip: 'Mode par défaut — aucun modificateur.' },
                  { k: 'offensif', l: 'Offensif',  tooltip: '+3 attaque / −5 défense si attaqué.' },
                  { k: 'charge',   l: 'Charge',    tooltip: '+3 attaque, +3 dégâts / −7 défense / ≥ 3m + dépl. court gratuit.' },
                  { k: 'defensif', l: 'Défensif',  tooltip: 'Aucune attaque. +3 défense si attaqué. (LdB p.223)' },
                  { k: 'retraite', l: 'Retraite',  tooltip: 'Aucune attaque. +5 défense si attaqué. (LdB p.223)' },
                ].map(m => {
                  const isDefensif = m.k === 'defensif' || m.k === 'retraite'
                  return (
                    <div key={m.k} title={m.tooltip}
                      onClick={() => {
                        if (m.k === 'charge') { handleStartCharge() }
                        else {
                          setCombatMode(m.k)
                          if (m.k !== 'charge') { setChargeSelection(null) }
                          if (!isDefensif) handleStartMelee()
                        }
                      }}
                      style={{
                        ...S.modeChip,
                        ...(curMode === m.k ? (isDefensif ? S.modeChipDefensif : S.modeChipActive) : {}),
                      }}
                    >{m.l}</div>
                  )
                })}
              </div>

              {/* Nombre d'attaques — masqué en Défensif/Retraite/Charge */}
              {curMode !== 'defensif' && curMode !== 'retraite' && curMode !== 'charge' && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {[{ n: 1, label: '1' }, { n: 2, label: '2 (−5)' }, { n: 3, label: '3 (−7)' }].map(({ n, label }) => (
                    <div key={n}
                      onClick={() => { setMeleeAttackCount(n); setMeleeTargets(prev => prev.slice(0, n)) }}
                      style={{
                        padding: '3px 7px', borderRadius: 3, cursor: 'pointer', fontSize: 9,
                        border: `1px solid ${meleeAttackCount === n ? '#70c070' : '#2a3a2a'}`,
                        background: meleeAttackCount === n ? 'rgba(112,192,112,0.12)' : 'rgba(255,255,255,0.02)',
                        color: meleeAttackCount === n ? '#70c070' : '#7a9a7a',
                        fontWeight: meleeAttackCount === n ? 600 : 400,
                      }}
                    >{label}</div>
                  ))}
                  <span style={{ fontSize: 9, color: '#506050', alignSelf: 'center' }}>attaque(s)</span>
                </div>
              )}

              {/* Feedback */}
              {curMode === 'defensif' && (
                <div style={{ fontSize: 9, color: '#8ab4f0', fontStyle: 'italic' }}>
                  Aucune attaque — +3 en défense si attaqué
                </div>
              )}
              {curMode === 'retraite' && (
                <div style={{ fontSize: 9, color: '#8ab4f0', fontStyle: 'italic' }}>
                  Aucune attaque — +5 en défense, recul possible
                </div>
              )}
              {isQueueTarget && (
                <div style={{ fontSize: 9, color: '#70c070' }}>⚔ Cliquez sur la cible CaC</div>
              )}

              {/* Cibles melee */}
              {meleeTargets.length > 0 && !chargeSelection && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: '#3a6a3a', marginBottom: 3 }}>
                    {meleeTargets.length > 1 ? `CIBLES (${meleeTargets.length})` : 'CIBLE'}
                  </div>
                  {meleeTargets.map((tgtId, i) => {
                    const t = tokens.find(tk => tk.id === tgtId)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        {meleeTargets.length > 1 && (
                          <span style={{ fontSize: 8, color: '#3a6a3a', minWidth: 10 }}>{i + 1}.</span>
                        )}
                        <span style={{ fontSize: 11, color: '#70c870', fontWeight: 600 }}>{t?.label ?? '?'}</span>
                        <span style={{ fontSize: 8, color: '#507050', fontFamily: 'monospace' }}>
                          {selectedGmMeleeWeaponId && meleeWeaponAvailable ? (meleeWeaponAvailable.name ?? 'arme') : 'mains nues'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Charge */}
              {chargeSelection && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: '#6a3a7a', marginBottom: 3 }}>CHARGE</div>
                  <div style={{ fontSize: 10, color: '#c890e8' }}>
                    {chargeSelection.move ? '✓ destination' : '… destination'}
                  </div>
                  {chargeTgt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#c890e8', fontWeight: 600 }}>→ {chargeTgt.label}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: '#705070', marginTop: 2 }}>… cible CaC</div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* PANNEAU DROIT — Tir */}
        {isAttackActive && isActivePnj && (
          <div style={S.assaultPanelGm}>

            {/* Arme — affichage seul (auto-sélectionnée pour les PNJs) */}
            <div style={S.assaultSection}>
              <div style={S.assaultSectionTitle}>Arme</div>
              {weapon ? (
                <div style={S.assaultInfoText}>
                  {weapon.name ?? 'Arme'}
                  <span style={S.assaultInfoSub}> ({weapon.slot})</span>
                </div>
              ) : (
                <div style={S.assaultNoWeapon}>Aucune arme équipée</div>
              )}
            </div>

            {/* Cible */}
            <div style={S.assaultSection}>
              <div style={S.assaultSectionTitle}>Cible</div>
              {assaultTarget?.targetTokenId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={S.assaultTargetName}>{getLabel(assaultTarget.targetTokenId)}</span>
                  <button style={S.changeTargetBtn} onClick={handleStartAttack}>Changer</button>
                </div>
              ) : (
                <button style={S.chooseTargetBtn} onClick={handleStartAttack}>Choisir une cible</button>
              )}
            </div>

            {/* Mode de tir — CC / RC / RL */}
            {weapon && currentFireMode && (
              <div style={S.assaultSection}>
                <div style={S.assaultSectionTitle}>
                  {{ CC: 'Coup par coup', RC: 'Rafale courte', RL: 'Rafale longue' }[currentFireMode] ?? currentFireMode}
                </div>

                {currentFireMode === 'CC' && (
                  <>
                    <div style={S.assaultOption} onClick={() => { setAssaultBulletCount(1); setAssaultVariantAB('A') }}>
                      <div>
                        <div style={S.assaultOptionLabel}>Tir simple</div>
                        <div style={S.assaultOptionSub}>1 balle : +0</div>
                      </div>
                      <span style={{ ...S.assaultRadio, ...(effectiveBulletCount === 1 ? S.assaultRadioActive : {}) }} />
                    </div>
                    <div style={S.assaultOption} onClick={() => {
                      if (!assaultBulletCount || assaultBulletCount === 1) setAssaultBulletCount(2)
                    }}>
                      <div style={S.assaultOptionLabel}>Tir à répétition</div>
                      <span style={{ ...S.assaultRadio, ...(assaultBulletCount && assaultBulletCount !== 1 ? S.assaultRadioActive : {}) }} />
                    </div>
                    {assaultBulletCount && assaultBulletCount !== 1 && (
                      <>
                        <input
                          type="range" min={0} max={CC_REPS_STEPS.length - 1} step={1}
                          value={ccSliderDisplayIdx}
                          style={S.assaultSlider}
                          onChange={e => {
                            const count = CC_REPS_STEPS[Number(e.target.value)]
                            setAssaultBulletCount(count)
                            if (count !== 7 && count !== 10) setAssaultVariantAB('A')
                          }}
                        />
                        {(assaultBulletCount === 7 || assaultBulletCount === 10) && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {['A', 'B'].map(ab => (
                              <div
                                key={ab}
                                onClick={() => setAssaultVariantAB(ab)}
                                style={{
                                  flex: 1, padding: '3px 6px', borderRadius: 3, cursor: 'pointer',
                                  fontSize: 9, fontFamily: 'monospace', textAlign: 'center',
                                  border: `1px solid ${assaultVariantAB === ab ? '#e07070' : '#2a3040'}`,
                                  background: assaultVariantAB === ab ? 'rgba(224,112,112,0.12)' : 'rgba(255,255,255,0.02)',
                                  color: assaultVariantAB === ab ? '#e07070' : '#7a8a9a',
                                }}
                              >
                                {ab === 'A'
                                  ? `+${assaultBulletCount === 7 ? 4 : 5} comp`
                                  : `+${assaultBulletCount === 7 ? 3 : 4} comp / +3 dég`
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {currentVariant && (
                      <div style={S.assaultSummaryText}>
                        {effectiveBulletCount} balle{effectiveBulletCount > 1 ? 's' : ''} : +{currentVariant.bonusComp} test
                        {currentVariant.bonusDmg > 0 ? ` / +${currentVariant.bonusDmg} dég` : ''}
                      </div>
                    )}
                  </>
                )}

                {currentFireMode === 'RC' && (
                  <>
                    <div style={S.assaultOption}>
                      <div>
                        <div style={S.assaultOptionLabel}>Rafale courte</div>
                        <div style={S.assaultOptionSub}>3 balles : +3 test / +5 dég (courte portée)</div>
                      </div>
                      <span style={{ ...S.assaultRadio, ...S.assaultRadioActive }} />
                    </div>
                    <div style={S.assaultSummaryText}>3 balles : +3 test (ou +5 dég à courte portée)</div>
                  </>
                )}

                {currentFireMode === 'RL' && (
                  <>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {RL_BUTTONS.map(btn => (
                        <div
                          key={btn.value}
                          onClick={() => setAssaultBulletCount(btn.value)}
                          style={{
                            flex: 1, padding: '3px 6px', borderRadius: 3, cursor: 'pointer',
                            fontSize: 9, fontFamily: 'monospace', textAlign: 'center',
                            border: `1px solid ${assaultBulletCount === btn.value ? '#e07070' : '#2a3040'}`,
                            background: assaultBulletCount === btn.value ? 'rgba(224,112,112,0.12)' : 'rgba(255,255,255,0.02)',
                            color: assaultBulletCount === btn.value ? '#e07070' : '#7a8a9a',
                          }}
                        >{btn.label}</div>
                      ))}
                    </div>
                    {currentVariant && (
                      <div style={S.assaultSummaryText}>
                        {assaultBulletCount === 'multi'
                          ? 'Multi-cibles : +0 test / zone 3m'
                          : `${assaultBulletCount} balles : +${currentVariant.bonusComp} test / +${currentVariant.bonusDmg} dég`
                        }
                      </div>
                    )}
                    {!assaultBulletCount && (
                      <div style={{ fontSize: 9, color: '#706050', fontStyle: 'italic' }}>Sélectionnez un volume de tir</div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        )}

      </div>{/* fin body flex-row */}

      {/* FOOTER */}
      <div className="combat-win-footer">
        {iniDelta !== 0 && isActivePnj && (
          <div style={S.iniRow}>
            <span style={S.iniLabel}>INI TOTAL</span>
            <span style={{ ...S.iniValue, color: iniDelta < -10 ? '#c83030' : (iniDelta < 0 ? '#c86030' : '#3aaa6a') }}>
              {iniDelta > 0 ? `+${iniDelta}` : iniDelta}
            </span>
          </div>
        )}
        {declareError && (
          <div style={{ fontSize: 9, color: '#c83030', background: 'rgba(200,48,48,0.08)', border: '1px solid #c8303044', borderRadius: 2, padding: '4px 8px', fontFamily: 'monospace' }}>
            ⚠ {declareError}
          </div>
        )}
        <button
          className="btn-tac-confirm"
          onClick={handleDeclare}
          disabled={!canDeclare}
        >
          DÉCLARER
        </button>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  headerProgress: { fontSize: 9, color: '#5a6575', fontFamily: 'monospace' },

  controls: { flexShrink: 0, borderBottom: '1px solid #15212e' },

  chips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#0a1018', border: '1px solid #1a2a38', borderRadius: 2, cursor: 'pointer', userSelect: 'none' },
  chipLabel: { fontSize: 7, color: '#456575', letterSpacing: '0.1em', fontFamily: 'monospace' },
  chipValue: { fontSize: 10, color: '#dde7ee', fontWeight: 600 },
  chipCost: { fontSize: 8, fontFamily: 'monospace', fontWeight: 700 },

  actionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  actionBtn: { padding: '5px 8px', background: '#0a1018', border: '1px solid #15212e', borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  actionBtnActive: { background: '#2a1e10', border: '1px solid #aa8a30' },
  actionBtnDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  actionLabel: { fontSize: 10, flex: 1 },
  actionIni: { fontSize: 8, fontFamily: 'monospace', flexShrink: 0 },
  actionDisabledTag: { fontSize: 7, color: '#2a3848', fontFamily: 'monospace', flexShrink: 0 },

  attackTargetRow: { marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 },
  attackTargetLabel: { fontSize: 9, color: '#c86030', fontFamily: 'monospace' },
  attackTargetName: { fontSize: 10, color: '#e8a060', fontWeight: 600 },

  quickList: { display: 'flex', flexDirection: 'column', gap: 3 },
  quickRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.01)', border: '1px solid transparent', cursor: 'pointer' },
  quickRowActive: { background: 'rgba(91,141,238,0.1)', border: '1px solid #2a3a5e' },
  quickLabel: { fontSize: 10, color: '#aaccdd', flex: 1 },
  sliderWrap: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  slider: { width: 64, accentColor: '#5b8dee', cursor: 'pointer' },
  sliderVal: { fontSize: 10, fontFamily: 'monospace', minWidth: 14, textAlign: 'right' },

  waitBlock: { padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid #15212e' },
  waitText: { fontSize: 12, color: '#5a6575', fontStyle: 'italic' },
  btnSkip: { padding: '5px 12px', background: 'none', border: '1px solid #3a4a5a', borderRadius: 3, color: '#7090a8', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', alignSelf: 'flex-start' },
  monitorPanel: {
    background: 'rgba(91,141,238,0.06)', border: '1px solid #2a3a5a', borderRadius: 4,
    padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  monitorTitle: { fontSize: 8, color: '#5b8dee', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 },
  monitorRow:   { display: 'flex', alignItems: 'center', gap: 6 },
  monitorIcon:  { fontSize: 10, color: '#5b5b7a', flexShrink: 0 },
  monitorText:  { fontSize: 10, color: '#8888b8' },

  roster: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#070a10' },
  rosterHeader: { padding: '5px 12px', background: '#060810', borderBottom: '1px solid #15212e', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  rosterToggle: { background: 'none', border: 'none', color: '#456575', fontSize: 9, cursor: 'pointer', padding: '0 2px', flexShrink: 0 },
  rosterTitle: { fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: '#aa6030', flex: 1, fontFamily: 'monospace' },
  rosterList: { flex: 1, overflowY: 'auto' },
  rosterRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 8px', borderBottom: '1px solid #0e1520', borderLeft: '3px solid transparent' },
  rosterRowActive: { background: '#0a1828', borderLeft: '3px solid #3a8aaa' },
  rosterGlyph: { fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0, fontFamily: 'monospace' },
  rosterName: { fontSize: 10, color: '#aaccdd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rosterBadge:    { fontSize: 7, fontFamily: 'monospace', fontWeight: 700, padding: '1px 4px', borderRadius: 2, letterSpacing: '0.08em', flexShrink: 0 },
  rosterBadgeDst: { background: '#0a1e2e', color: '#3a8aaa', border: '1px solid #1a4a5a' },
  rosterBadgeCct: { background: '#1e1a0a', color: '#aa8a30', border: '1px solid #5a4a1a' },
  rosterBadgeNone:{ background: '#0a0e14', color: '#3a4a5a', border: '1px solid #1a2030' },
  rosterIni: { fontSize: 9, color: '#456575', flexShrink: 0, fontFamily: 'monospace' },
  rosterDelta: { fontSize: 9, flexShrink: 0, fontFamily: 'monospace', fontWeight: 700 },

  iniRow: { display: 'flex', alignItems: 'center', gap: 8 },
  iniLabel: { fontSize: 9, color: '#456575', letterSpacing: '0.12em', fontFamily: 'monospace', flex: 1 },
  iniValue: { fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' },
  modeChip: { padding: '2px 7px', borderRadius: 2, cursor: 'pointer', border: '1px solid #1a3a2a', background: 'rgba(255,255,255,0.02)', fontSize: 9, color: '#5a7a5a', fontFamily: 'monospace' },
  modeChipActive: { border: '1px solid #50a870', background: 'rgba(80,168,112,0.15)', color: '#70c870', fontWeight: 700 },
  modeChipDefensif: { border: '1px solid #5b8dee', background: 'rgba(91,141,238,0.15)', color: '#8ab4f0', fontWeight: 700 },
  meleePanelGm: {
    flex: '0 0 280px',
    borderLeft: '1px solid #1a2a1a',
    background: 'rgba(80,168,112,0.04)',
    display: 'flex', flexDirection: 'column',
    padding: '10px 12px',
    gap: 4,
    overflowY: 'auto',
  },
  meleePanelTitle: { fontSize: 8, fontWeight: 700, color: '#3a6a4a', letterSpacing: '0.12em', marginBottom: 4, textTransform: 'uppercase' },

  // Panneau droit — tir
  assaultPanelGm: {
    flex: '0 0 280px',
    borderLeft: '1px solid #1a2030',
    background: 'rgba(180,80,80,0.04)',
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto',
  },
  assaultSection: { padding: '8px 12px', borderBottom: '1px solid #0e1520', display: 'flex', flexDirection: 'column', gap: 5 },
  assaultSectionTitle: { fontSize: 9, fontWeight: 700, color: '#e07070', textTransform: 'uppercase', letterSpacing: '0.05em' },
  assaultInfoText:  { fontSize: 11, color: '#c0c0d0' },
  assaultInfoSub:   { fontSize: 9, color: '#5b5b7a' },
  assaultNoWeapon:  { fontSize: 10, color: '#5b5b7a', fontStyle: 'italic' },
  assaultTargetName:{ fontSize: 11, color: '#e07070', fontWeight: 600, flex: 1 },
  chooseTargetBtn: {
    padding: '5px 8px',
    background: 'rgba(180,80,80,0.1)', border: '1px solid #c05050', borderRadius: 3,
    color: '#e07070', fontSize: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  changeTargetBtn: {
    padding: '2px 7px', background: 'none', border: '1px solid #3a3a5a', borderRadius: 3,
    color: '#7070a0', fontSize: 9, cursor: 'pointer', flexShrink: 0,
  },
  assaultOption: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', cursor: 'pointer', userSelect: 'none' },
  assaultOptionLabel: { fontSize: 11, color: '#c0c0d0', fontWeight: 500 },
  assaultOptionSub:   { fontSize: 9, color: '#5b5b7a', marginTop: 1 },
  assaultRadio: { width: 12, height: 12, borderRadius: '50%', border: '2px solid #3a3a5a', flexShrink: 0, boxSizing: 'border-box' },
  assaultRadioActive: { borderColor: '#e07070', background: '#e07070' },
  assaultSlider: { width: '100%', accentColor: '#e07070', cursor: 'pointer' },
  assaultSummaryText: { fontSize: 10, color: '#e07070', fontWeight: 600, fontStyle: 'italic' },

  // Sélection arme CaC
  weaponOption: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 3,
    cursor: 'pointer', border: '1px solid transparent', background: 'rgba(255,255,255,0.01)',
  },
  weaponOptionActive: { background: 'rgba(80,168,112,0.12)', border: '1px solid #3a6a4a' },
  weaponOptionLabel: { fontSize: 10, color: '#aaccdd', flex: 1 },
  weaponRadio: { width: 11, height: 11, borderRadius: '50%', border: '2px solid #3a4a5a', flexShrink: 0, boxSizing: 'border-box' },
  weaponRadioActive: { borderColor: '#50c878', background: '#50c878' },
}
