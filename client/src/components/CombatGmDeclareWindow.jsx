import { useState, useEffect, useRef } from 'react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api'
import {
  STATE_DEFS, QUICK_ACTIONS, MAP_ACTIONS,
  calcIniDelta,
} from './combatSections.js'
import { DEFAULT_PNJ_ALLURES } from '../../../shared/polarisUtils.js'
import { useDraggable } from '../lib/useDraggable.js'

// ---------------------------------------------------------------------------
// Etat par defaut par cle (= DEFAULT colonne DB)
// ---------------------------------------------------------------------------
const STATE_DEFAULTS = {
  position:  'standing',
  weapon:    'holstered',
  fire_mode: 'cc',
  cover:     'exposed',
  vitesse:   'normal',
}

// Cycle au prochain etat (circulaire). Si cle inconnue -> retourne le defaut.
function nextKey(stateKey, currentKey) {
  const states = STATE_DEFS[stateKey].states
  const idx    = states.findIndex(s => s.k === currentKey)
  if (idx === -1) return STATE_DEFAULTS[stateKey]
  return states[(idx + 1) % states.length].k
}

// ---------------------------------------------------------------------------
// InlineChip — puce click-to-cycle compacte
// ---------------------------------------------------------------------------
function InlineChip({ stateKey, initial, current, onChange }) {
  const def     = STATE_DEFS[stateKey]
  const isMixed = current === '__mixed__'
  const cur     = isMixed ? null : def.states.find(s => s.k === current)
  const cost    = isMixed ? null : (current === initial
    ? 0
    : (def.cost?.[initial]?.[current] ?? 0))

  const handleClick = () => {
    if (isMixed) {
      onChange(STATE_DEFAULTS[stateKey])
    } else {
      onChange(nextKey(stateKey, current))
    }
  }

  return (
    <div onClick={handleClick} style={S.chip}>
      <span style={S.chipLabel}>{def.label}</span>
      <span style={{ ...S.chipValue, ...(isMixed ? S.chipMixed : {}) }}>
        {isMixed ? '— mixte —' : (cur?.l ?? current)}
      </span>
      {!isMixed && cost !== 0 && cost !== null && (
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
export default function CombatGmDeclareWindow({ socket, characters, onEnterMoveMode, battlemapId, onEnterTargetMode, combatTargetMode }) {
  const { roster, activeTokenId: storeActiveTokenId } = useCombatStore()
  const tokens     = useTokenStore(s => s.tokens)

  // Slot actif courant — fallback calculé si COMBAT_SLOT_ADVANCED pas encore reçu
  const activeTokenId = storeActiveTokenId ?? (
    [...roster]
      .filter(r => !r.has_announced && r.status === 'active')
      .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
  )

  const [focusedId,         setFocusedId]         = useState(null)
  const [selectedIds,       setSelectedIds]       = useState(new Set())
  const [selections,        setSelections]        = useState({})   // tokenId -> { states, mapAction, quick }
  const [pendingGmMoves,    setPendingGmMoves]    = useState({})   // tokenId -> { action_key, ini_mod, targetPosX, targetPosY, targetPosZ }
  const [moveTick,          setMoveTick]          = useState(0)
  const [assaultSelections, setAssaultSelections] = useState({})   // tokenId -> { targetTokenId }
  const [declareError,      setDeclareError]      = useState(null)
  const [meleeSelections,   setMeleeSelections]   = useState({})   // tokenId -> { targetTokenId }
  const [equipment,         setEquipment]         = useState({})   // tokenId -> { characterId, weapon, armorPieces }
  const [attackTick,        setAttackTick]        = useState(0)
  const [meleeTick,         setMeleeTick]         = useState(0)
  const [chargeSelections,  setChargeSelections]  = useState({})   // tokenId -> { move, targetTokenId }
  const [chargeTick,        setChargeTick]        = useState(0)
  const [meleePendingMode,  setMeleePendingMode]  = useState(false) // true = chips visibles avant queue

  const moveQueueRef    = useRef([])
  const moveQueueIdxRef = useRef(0)
  const moveCancelRef   = useRef(null)
  const tokensRef       = useRef(tokens)
  const attackQueueRef    = useRef([])
  const attackQueueIdxRef = useRef(0)
  const attackCancelRef   = useRef(null)
  const meleeQueueRef     = useRef([])
  const meleeQueueIdxRef  = useRef(0)
  const meleeCancelRef    = useRef(null)
  const chargeQueueRef    = useRef([])
  const chargeQueueIdxRef = useRef(0)
  const chargePhaseRef    = useRef('move')  // 'move' | 'target'
  const chargeCancelRef   = useRef(null)

  useEffect(() => { tokensRef.current = tokens }, [tokens])

  // ── Écoute COMBAT_DECLARE_ERROR ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handler = ({ message }) => {
      setDeclareError(message)
      setTimeout(() => setDeclareError(null), 4000)
    }
    socket.on(WS.COMBAT_DECLARE_ERROR, handler)
    return () => socket.off(WS.COMBAT_DECLARE_ERROR, handler)
  }, [socket])

  // ── Reset focus manuel quand le slot d'annonce avance ──────────────────
  // Permet à activeFocusId de suivre automatiquement le nouveau slot actuel
  useEffect(() => {
    setFocusedId(null)
    setSelectedIds(new Set())
  }, [activeTokenId])

  // ── Fetch équipement combat ─────────────────────────────────────────────
  useEffect(() => {
    if (!battlemapId) return
    api.get(`/battlemaps/${battlemapId}/combat-equipment`)
      .then(r => setEquipment(r.data.equipment ?? {}))
      .catch(() => {})
  }, [battlemapId])

  // ── Queue de déplacement PNJ séquentiel ────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const queue = moveQueueRef.current
    const idx   = moveQueueIdxRef.current
    if (!onEnterMoveMode || queue.length === 0 || idx >= queue.length) return

    const tokenId = queue[idx]
    const token   = tokensRef.current.find(t => t.id === tokenId)
    if (!token) {
      moveQueueIdxRef.current = idx + 1
      setMoveTick(t => t + 1)
      return
    }

    const tokenPos = { x: token.pos_x, z: token.pos_y }

    const onMoveSelected = (sel) => {
      setPendingGmMoves(prev => ({ ...prev, [tokenId]: sel }))
      moveQueueIdxRef.current = moveQueueIdxRef.current + 1
      setMoveTick(t => t + 1)
    }
    const onCancel = () => {
      moveQueueIdxRef.current = moveQueueIdxRef.current + 1
      setMoveTick(t => t + 1)
    }
    moveCancelRef.current = onCancel
    onEnterMoveMode(DEFAULT_PNJ_ALLURES, tokenId, tokenPos, onMoveSelected, onCancel)
  }, [moveTick])

  // ── Queue d'assaut PNJ séquentiel ──────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const queue = attackQueueRef.current
    const idx   = attackQueueIdxRef.current
    if (!onEnterTargetMode || queue.length === 0 || idx >= queue.length) return

    const tokenId = queue[idx]
    const token   = tokensRef.current.find(t => t.id === tokenId)
    if (!token) {
      attackQueueIdxRef.current = idx + 1
      setAttackTick(t => t + 1)
      return
    }

    const onTargetSelected = (targetTokenId) => {
      setAssaultSelections(prev => ({ ...prev, [tokenId]: { targetTokenId } }))
      attackQueueIdxRef.current = attackQueueIdxRef.current + 1
      setAttackTick(t => t + 1)
    }
    const onCancel = () => {
      attackQueueIdxRef.current = attackQueueIdxRef.current + 1
      setAttackTick(t => t + 1)
    }
    attackCancelRef.current = onCancel
    onEnterTargetMode(tokenId, { x: token.pos_x, z: token.pos_y }, onTargetSelected, onCancel)
  }, [attackTick])

  // ── Queue melee PNJ séquentiel ─────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const queue = meleeQueueRef.current
    const idx   = meleeQueueIdxRef.current
    if (!onEnterTargetMode || queue.length === 0 || idx >= queue.length) return

    const tokenId = queue[idx]
    const token   = tokensRef.current.find(t => t.id === tokenId)
    if (!token) {
      meleeQueueIdxRef.current = idx + 1
      setMeleeTick(t => t + 1)
      return
    }

    const onTargetSelected = (targetTokenId) => {
      setMeleeSelections(prev => ({ ...prev, [tokenId]: { targetTokenId } }))
      meleeQueueIdxRef.current = meleeQueueIdxRef.current + 1
      setMeleeTick(t => t + 1)
    }
    const onCancel = () => {
      meleeQueueIdxRef.current = meleeQueueIdxRef.current + 1
      setMeleeTick(t => t + 1)
    }
    meleeCancelRef.current = onCancel
    onEnterTargetMode(tokenId, { x: token.pos_x, z: token.pos_y }, onTargetSelected, onCancel)
  }, [meleeTick])

  // ── Queue Charge PNJ séquentielle (move_short gratuit → cible CaC) ───────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const queue = chargeQueueRef.current
    const idx   = chargeQueueIdxRef.current
    if (queue.length === 0 || idx >= queue.length) return

    const tokenId = queue[idx]
    const token   = tokensRef.current.find(t => t.id === tokenId)
    if (!token) {
      chargeQueueIdxRef.current = idx + 1
      chargePhaseRef.current = 'move'
      setChargeTick(t => t + 1)
      return
    }

    // Zones limitées à allure lente (déplacement court)
    const chargeAllures = {
      lente: DEFAULT_PNJ_ALLURES.lente, moyenne: DEFAULT_PNJ_ALLURES.lente,
      rapide: DEFAULT_PNJ_ALLURES.lente, max: DEFAULT_PNJ_ALLURES.lente,
    }

    if (chargePhaseRef.current === 'move') {
      if (!onEnterMoveMode) { chargeQueueIdxRef.current = idx + 1; setChargeTick(t => t + 1); return }
      const onMoveSelected = (sel) => {
        setChargeSelections(prev => ({ ...prev, [tokenId]: { ...(prev[tokenId] ?? {}), move: { ...sel, ini_mod: 0 } } }))
        chargePhaseRef.current = 'target'
        setChargeTick(t => t + 1)
      }
      const onCancel = () => { chargeQueueIdxRef.current = idx + 1; chargePhaseRef.current = 'move'; setChargeTick(t => t + 1) }
      chargeCancelRef.current = onCancel
      onEnterMoveMode(chargeAllures, tokenId, { x: token.pos_x, z: token.pos_y }, onMoveSelected, onCancel)
    } else {
      if (!onEnterTargetMode) { chargeQueueIdxRef.current = idx + 1; chargePhaseRef.current = 'move'; setChargeTick(t => t + 1); return }
      const onTargetSelected = (targetTokenId) => {
        setChargeSelections(prev => ({ ...prev, [tokenId]: { ...(prev[tokenId] ?? {}), targetTokenId } }))
        chargePhaseRef.current = 'move'
        chargeQueueIdxRef.current = idx + 1
        setChargeTick(t => t + 1)
      }
      const onCancel = () => { chargePhaseRef.current = 'move'; chargeQueueIdxRef.current = idx + 1; setChargeTick(t => t + 1) }
      chargeCancelRef.current = onCancel
      onEnterTargetMode(tokenId, { x: token.pos_x, z: token.pos_y }, onTargetSelected, onCancel)
    }
  }, [chargeTick])

  // ── Helpers identification PNJ ──────────────────────────────────────────
  const isPnj = (entry) => {
    const token = tokens.find(t => t.id === entry.token_id)
    if (!token?.character_id) return false
    return characters.find(c => c.id === token.character_id)?.type === 'pnj'
  }
  const getLabel  = (tokenId) => tokens.find(t => t.id === tokenId)?.label ?? tokenId
  const isRanged  = (tokenId) => !!equipment[tokenId]?.weapon?.ref_fire_mode

  const allPnjs        = roster.filter(r => r.status === 'active').filter(isPnj)
  // LdB p.212 — annonce dans l'ordre croissant (lents en premier)
  const sortedPnjs     = [...allPnjs].sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))
  const unannouncedCnt = allPnjs.filter(r => !r.has_announced).length

  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-gm-declare-pos',
    { top: window.innerHeight - 660, left: window.innerWidth - 456 },
    440,
  )

  if (allPnjs.length === 0) return null

  // ── Selection locale par PNJ ────────────────────────────────────────────
  const getInitialStates = (entry) => ({
    position:  entry.state_position  ?? 'standing',
    weapon:    entry.state_weapon    ?? 'holstered',
    fire_mode: entry.state_fire_mode ?? 'cc',
    cover:     entry.state_cover     ?? 'exposed',
    vitesse:   entry.state_vitesse   ?? 'normal',
  })

  const getSel = (tokenId) => {
    if (selections[tokenId]) return selections[tokenId]
    const entry = roster.find(r => r.token_id === tokenId)
    if (!entry) return { states: { ...STATE_DEFAULTS }, mapAction: null, quick: { observer: 0, reperer: 0, phrase: false }, combatMode: 'normal' }
    return { states: getInitialStates(entry), mapAction: null, quick: { observer: 0, reperer: 0, phrase: false }, combatMode: 'normal' }
  }

  // ── Batch mode ──────────────────────────────────────────────────────────
  const batchMode = selectedIds.size >= 2
  // Slot PNJ actuel selon l'ordre d'annonce LdB (base_ini ASC)
  const currentSlotPnjId = (() => {
    const entry = roster.find(r => r.token_id === activeTokenId)
    if (!entry || entry.has_announced) return null
    return isPnj(entry) ? activeTokenId : null
  })()
  const activeFocusId = focusedId ?? currentSlotPnjId ?? sortedPnjs.find(r => !r.has_announced)?.token_id ?? null
  const targetIds = batchMode
    ? [...selectedIds]
    : (activeFocusId ? [activeFocusId] : [])

  // Agregat d'un etat sur les cibles (valeur unique ou '__mixed__')
  const aggregate = (stateKey) => {
    if (!targetIds.length) return null
    const vals = new Set(targetIds.map(id => getSel(id).states[stateKey]))
    return vals.size === 1 ? [...vals][0] : '__mixed__'
  }
  const aggregateInitial = (stateKey) => {
    if (!targetIds.length) return null
    const vals = new Set(targetIds.map(id => {
      const entry = roster.find(r => r.token_id === id)
      return entry ? getInitialStates(entry)[stateKey] : STATE_DEFAULTS[stateKey]
    }))
    return vals.size === 1 ? [...vals][0] : '__mixed__'
  }

  // ── Mutations selection ─────────────────────────────────────────────────
  const updateState = (stateKey, value) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id]  = { ...cur, states: { ...cur.states, [stateKey]: value } }
      })
      return next
    })
  }

  const setMapAction = (key) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id]  = { ...cur, mapAction: cur.mapAction === key ? null : key }
      })
      return next
    })
  }

  const setMeleeCombatMode = (mode) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id] = { ...cur, combatMode: mode }
      })
      return next
    })
  }

  const setQuick = (k, v) => {
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id]  = { ...cur, quick: { ...cur.quick, [k]: v } }
      })
      return next
    })
  }

  // ── INI delta ───────────────────────────────────────────────────────────
  const calcDelta = (tokenId) => {
    const entry = roster.find(r => r.token_id === tokenId)
    if (!entry) return 0
    const sel = getSel(tokenId)
    return calcIniDelta(
      getInitialStates(entry),
      sel.states,
      { move: pendingGmMoves[tokenId] ?? null, attack: null, melee: meleeSelections[tokenId] ? true : null, multi: sel.mapAction === 'multi' },
      sel.quick,
    )
  }

  // Pour l'affichage footer (1 cible uniquement)
  const singleDelta = targetIds.length === 1 ? calcDelta(targetIds[0]) : null

  // ── Etat courant agrege pour les chips ─────────────────────────────────
  const curAction = (() => {
    if (!targetIds.length) return null
    const acts = new Set(targetIds.map(id => getSel(id).mapAction))
    return acts.size === 1 ? [...acts][0] : '__mixed__'
  })()

  const curQuick = (k) => {
    if (!targetIds.length) return 0
    if (k === 'phrase') {
      const vals = new Set(targetIds.map(id => getSel(id).quick.phrase))
      return vals.size === 1 ? [...vals][0] : false
    }
    const vals = new Set(targetIds.map(id => getSel(id).quick[k]))
    return vals.size === 1 ? [...vals][0] : 0
  }

  // ── Attack : état visuel — actif uniquement si la queue assault tourne (pas melee)
  const isAttackActive = targetIds.some(id => !!assaultSelections[id])
    || (combatTargetMode?.tokenId != null && targetIds.includes(combatTargetMode.tokenId)
        && attackQueueRef.current.includes(combatTargetMode.tokenId))

  // ── isMeleeSetup : chips de mode visibles dès que CaC est en cours
  const isMeleeSetup = !batchMode && !!activeFocusId && (
    meleePendingMode ||
    !!meleeSelections[activeFocusId] ||
    !!chargeSelections[activeFocusId] ||
    (meleeQueueRef.current.includes(activeFocusId) && meleeQueueIdxRef.current < meleeQueueRef.current.length) ||
    (chargeQueueRef.current.includes(activeFocusId) && chargeQueueIdxRef.current < chargeQueueRef.current.length)
  )

  // canDeclare : le slot actuel doit être dans les cibles + au moins un changement OU une action
  const canDeclare = targetIds.length > 0
    && targetIds.includes(activeTokenId ?? '')
    && targetIds.some(id => {
      const sel   = getSel(id)
      const entry = roster.find(r => r.token_id === id)
      if (!entry || entry.has_announced) return false
      const init  = getInitialStates(entry)
      const stateChanged = Object.keys(sel.states).some(k => sel.states[k] !== init[k])
      const hasAction    = !!sel.mapAction || !!pendingGmMoves[id] || !!assaultSelections[id] || !!meleeSelections[id] || !!chargeSelections[id]?.targetTokenId || (sel.combatMode ?? 'normal') !== 'normal' || sel.quick.observer > 0 || sel.quick.reperer > 0 || sel.quick.phrase
      return stateChanged || hasAction
    })

  // ── Declare ─────────────────────────────────────────────────────────────
  // LdB p.212 — n'émet que pour le slot actuel (activeTokenId), pas toute la sélection
  const handleDeclare = () => {
    if (!socket || !canDeclare || !activeTokenId) return
    const currentSlotEntry = roster.find(r => r.token_id === activeTokenId)
    if (!currentSlotEntry || currentSlotEntry.has_announced) return
    const toEmit = [activeTokenId]
    toEmit.forEach(tokenId => {
      const sel        = getSel(tokenId)
      const assault    = assaultSelections[tokenId]
      const weapon     = equipment[tokenId]?.weapon
      const chargeInfo = chargeSelections[tokenId]
      const meleeTgt   = chargeInfo?.targetTokenId
        ? chargeInfo.targetTokenId
        : meleeSelections[tokenId]?.targetTokenId ?? null
      const meleeCaC = meleeTgt
        ? {
            targetTokenId: meleeTgt,
            weaponInvId: (weapon && !weapon.ref_fire_mode) ? weapon.inv_id : null,
          }
        : null
      // Charge : move inclus et gratuit (ini_mod=0)
      const movePayload = chargeInfo?.move ?? (pendingGmMoves[tokenId] ?? null)
      socket.emit(WS.COMBAT_ACTION_DECLARE, {
        tokenId,
        state: { ...sel.states, combat_mode: sel.combatMode ?? 'normal' },
        mapActions: {
          move:     movePayload,
          attack:   weapon && assault?.targetTokenId ? {
            weaponInvId:        weapon.inv_id,
            targetTokenId:      assault.targetTokenId,
            bulletCount:        1,
            fireModeBonusComp:  0,
            fireModeBonusDmg:   0,
            isDualWield:        false,
            dualWieldBonusComp: 0,
          } : null,
          melee:    meleeCaC,
          reload:   sel.mapAction === 'reload',
          multi:    sel.mapAction === 'multi',
          interact: sel.mapAction === 'interact',
        },
        quick: { ...sel.quick },
      })
    })
    // Auto-focus prochain todo
    const nextTodo = sortedPnjs.find(r => !r.has_announced && !toEmit.includes(r.token_id))
    setFocusedId(nextTodo?.token_id ?? null)
    setSelectedIds(new Set())
  }

  // ── Batch helpers ────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  const selectAll = () => {
    // Batch libre — filtre par type arme uniquement au démarrage des queues, pas à la sélection
    setSelectedIds(new Set(sortedPnjs.filter(r => !r.has_announced).map(r => r.token_id)))
  }
  const selectNone = () => setSelectedIds(new Set())

  // ── Déplacement PNJ séquentiel ──────────────────────────────────────────
  const handleStartMoveQueue = () => {
    if (!onEnterMoveMode || targetIds.length === 0) return
    moveQueueRef.current    = [...targetIds]
    moveQueueIdxRef.current = 0
    setMoveTick(t => t + 1)
  }

  // ── Assaut PNJ séquentiel ───────────────────────────────────────────────
  const handleStartAttackQueue = () => {
    if (!onEnterTargetMode || targetIds.length === 0) return
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        if (cur.mapAction !== null) next[id] = { ...cur, mapAction: null }
      })
      return next
    })
    meleeQueueRef.current = []; meleeQueueIdxRef.current = 0
    chargeQueueRef.current = []; chargeQueueIdxRef.current = 0; chargePhaseRef.current = 'move'
    setMeleePendingMode(false)
    setMeleeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
    setChargeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
    // Filtre : seuls les PNJs avec arme à distance pour la queue assault
    attackQueueRef.current    = [...targetIds.filter(isRanged)]
    attackQueueIdxRef.current = 0
    setAttackTick(t => t + 1)
  }

  // ── Melee PNJ séquentiel (Normal/Offensif) ─────────────────────────────
  const handleStartMeleeQueue = () => {
    if (!onEnterTargetMode || targetIds.length === 0) return
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        if (cur.mapAction !== null) next[id] = { ...cur, mapAction: null }
      })
      return next
    })
    attackQueueRef.current = []; attackQueueIdxRef.current = 0
    chargeQueueRef.current = []; chargeQueueIdxRef.current = 0; chargePhaseRef.current = 'move'
    setMeleePendingMode(false)
    setAssaultSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
    setChargeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
    meleeQueueRef.current    = [...targetIds]
    meleeQueueIdxRef.current = 0
    setMeleeTick(t => t + 1)
  }

  // ── Charge PNJ séquentielle (move gratuit + cible CaC) ──────────────────
  const handleStartChargeQueue = () => {
    if (targetIds.length === 0) return
    // Combat mode 'charge' pour tous les PNJ ciblés
    setSelections(prev => {
      const next = { ...prev }
      targetIds.forEach(id => {
        const cur = getSel(id)
        next[id] = { ...cur, mapAction: null, combatMode: 'charge' }
      })
      return next
    })
    attackQueueRef.current = []; attackQueueIdxRef.current = 0
    meleeQueueRef.current = []; meleeQueueIdxRef.current = 0
    setMeleePendingMode(false)
    setAssaultSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
    setMeleeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
    chargeQueueRef.current    = [...targetIds]
    chargeQueueIdxRef.current = 0
    chargePhaseRef.current    = 'move'
    setChargeTick(t => t + 1)
  }

  // ── MAP_ACTIONS : toutes disponibles pour le GM ─────────────────────────
  const GM_DISABLED  = new Set([])
  const hasAnyRanged = targetIds.some(isRanged)

  // ── Render ───────────────────────────────────────────────────────────────
  const hasTargets = targetIds.length > 0

  return (
    <div style={{ ...S.window, width: isMeleeSetup ? 720 : 440, left: pos.left, top: pos.top }}>

      {/* HEADER */}
      <div style={{ ...S.header, ...(batchMode ? S.headerBatch : {}) }} onMouseDown={onHeaderMouseDown}>
        <span style={{ ...S.headerLabel, ...(batchMode ? S.headerLabelBatch : {}) }}>
          {batchMode ? `BATCH — ${targetIds.length} PNJs` : 'PHASE 1 — DÉCLARATION'}
        </span>
        <span style={S.headerProgress}>{allPnjs.length - unannouncedCnt}/{allPnjs.length} déclarés</span>
      </div>

      {/* BODY : flex-row — colonne gauche + panneau droit melee */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* COLONNE GAUCHE */}
        <div style={{ flex: '0 0 440px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* CONTROLS — visibles si au moins 1 cible */}
          {hasTargets && (
            <div style={S.controls}>

              {/* TACTIQUE */}
              <div style={S.section}>
                <span style={S.sectionTitle}>TACTIQUE</span>
                <div style={S.chips}>
                  {['position', 'cover', 'vitesse'].map(k => (
                    <InlineChip key={k} stateKey={k}
                      initial={aggregateInitial(k)}
                      current={aggregate(k)}
                      onChange={v => updateState(k, v)} />
                  ))}
                </div>
              </div>

              {/* ARMEMENT */}
              <div style={S.section}>
                <span style={{ ...S.sectionTitle, color: '#aa6a30' }}>ARMEMENT</span>
                <div style={S.chips}>
                  {['weapon', 'fire_mode'].map(k => (
                    <InlineChip key={k} stateKey={k}
                      initial={aggregateInitial(k)}
                      current={aggregate(k)}
                      onChange={v => updateState(k, v)} />
                  ))}
                </div>
              </div>

              {/* ACTION */}
              <div style={S.section}>
                <span style={{ ...S.sectionTitle, color: '#aa8a30' }}>ACTION</span>
                <div style={S.actionGrid}>
                  {MAP_ACTIONS.map(a => {
                    const isMeleeActive = meleePendingMode
                      || targetIds.some(id => !!meleeSelections[id])
                      || targetIds.some(id => !!chargeSelections[id]?.targetTokenId)
                      || (combatTargetMode?.tokenId != null && targetIds.includes(combatTargetMode.tokenId) && meleeQueueRef.current.includes(combatTargetMode.tokenId))
                      || (chargeQueueRef.current.length > 0 && chargeQueueIdxRef.current < chargeQueueRef.current.length && targetIds.includes(chargeQueueRef.current[chargeQueueIdxRef.current]))
                    const disabled = GM_DISABLED.has(a.k) || (a.k === 'attack' && !hasAnyRanged)
                    const active   = !disabled && (a.k === 'attack' ? isAttackActive : a.k === 'melee' ? isMeleeActive : curAction === a.k)
                    const span2    = a.span2 ? { gridColumn: 'span 2' } : {}
                    return (
                      <div key={a.k}
                        title={a.tooltip}
                        onClick={() => {
                          if (disabled) return
                          if (a.k === 'move') {
                            handleStartMoveQueue()
                          } else if (a.k === 'attack') {
                            handleStartAttackQueue()
                            setMeleeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
                          } else if (a.k === 'melee') {
                            if (isMeleeActive) {
                              setMeleePendingMode(false)
                              meleeQueueRef.current = []; meleeQueueIdxRef.current = 0
                              chargeQueueRef.current = []; chargeQueueIdxRef.current = 0; chargePhaseRef.current = 'move'
                              setMeleeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
                              setChargeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
                            } else {
                              setMeleePendingMode(true)
                            }
                          } else {
                            setMapAction(a.k)
                            setAssaultSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
                            setMeleeSelections(prev => { const n={...prev}; targetIds.forEach(id=>delete n[id]); return n })
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
                          <span style={S.actionDisabledTag}>
                            {a.k === 'attack' && !hasAnyRanged ? 'sans arme dist.' : 'sprint dédié'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Cible assaut — reste dans le panneau gauche */}
                {!batchMode && activeFocusId && assaultSelections[activeFocusId] && (() => {
                  const tgtTok = tokens.find(t => t.id === assaultSelections[activeFocusId].targetTokenId)
                  return (
                    <div style={S.attackTargetRow}>
                      <span style={S.attackTargetLabel}>→</span>
                      <span style={S.attackTargetName}>{tgtTok?.label ?? '?'}</span>
                      {!equipment[activeFocusId]?.weapon && (
                        <span style={S.attackNoWeapon}>sans arme</span>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* RAPIDES */}
              <div style={{ ...S.section, borderBottom: 'none' }}>
                <span style={{ ...S.sectionTitle, color: '#5a8a5a' }}>ACTIONS RAPIDES</span>
                <div style={S.quickList}>
                  {QUICK_ACTIONS.map(qa => {
                    if (qa.kind === 'incremental') {
                      const val = curQuick(qa.k)
                      return (
                        <div key={qa.k}
                          title={qa.tooltip}
                          style={{ ...S.quickRow, ...(val > 0 ? S.quickRowActive : {}) }}
                          onClick={() => val === 0 && setQuick(qa.k, 1)}
                        >
                          <span style={S.quickLabel}>{qa.l}</span>
                          <div style={S.sliderWrap} onClick={val > 0 ? e => e.stopPropagation() : undefined}>
                            <input type="range" min={0} max={qa.max} step={1} value={val}
                              disabled={val === 0}
                              style={{ ...S.slider, opacity: val > 0 ? 1 : 0.3 }}
                              onChange={e => setQuick(qa.k, Number(e.target.value))} />
                            <span style={{ ...S.sliderVal, color: val > 0 ? '#5b8dee' : '#456575' }}>
                              {val > 0 ? `${val * qa.stepIni}` : '–'}
                            </span>
                          </div>
                        </div>
                      )
                    }
                    const isOn = !!curQuick(qa.k)
                    return (
                      <div key={qa.k}
                        title={qa.tooltip}
                        style={{ ...S.quickRow, ...(isOn ? S.quickRowActive : {}) }}
                        onClick={() => setQuick(qa.k, !isOn)}
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

          {/* ROSTER */}
          <div style={S.roster}>
        <div style={S.rosterHeader}>
          <span style={S.rosterTitle}>ROSTER — {allPnjs.length} PNJs</span>
          {selectedIds.size > 0 && (
            <span onClick={selectNone} style={S.rosterLink}>✕ déselect. ({selectedIds.size})</span>
          )}
          {unannouncedCnt > 0 && selectedIds.size < unannouncedCnt && (
            <span onClick={selectAll} style={{ ...S.rosterLink, color: '#456575' }}>tout</span>
          )}
        </div>
        <div style={S.rosterList}>
          {sortedPnjs.map(entry => {
            const tid      = entry.token_id
            const isActive = !batchMode && tid === activeFocusId
            const isSel    = selectedIds.has(tid)
            const isDone   = entry.has_announced
            const delta    = isDone ? null : calcDelta(tid)

            return (
              <div key={tid}
                onClick={() => { if (!isDone) setFocusedId(tid) }}
                style={{
                  ...S.rosterRow,
                  ...(isActive ? S.rosterRowActive : {}),
                  ...(isSel    ? S.rosterRowSel    : {}),
                  opacity: isDone ? 0.35 : 1,
                  cursor: isDone ? 'default' : 'pointer',
                }}
              >
                <input type="checkbox"
                  checked={isSel}
                  disabled={isDone}
                  onClick={e => e.stopPropagation()}
                  onChange={() => !isDone && toggleSelect(tid)}
                  style={{ accentColor: '#aa6030', cursor: isDone ? 'default' : 'pointer', flexShrink: 0 }} />

                <span style={{ ...S.rosterGlyph, color: isDone ? '#5a7080' : (isSel ? '#aa8a30' : '#456575') }}>
                  {isDone ? '✓' : (isSel ? '◉' : '○')}
                </span>

                <span style={{ ...S.rosterName, fontWeight: isActive ? 600 : 400 }}>
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
        </div>
      </div>{/* fin roster */}
      </div>{/* fin colonne gauche */}

        {/* PANNEAU DROIT — Mode CaC (apparaît quand melee actif) */}
        {isMeleeSetup && activeFocusId && (() => {
          const curMode = getSel(activeFocusId).combatMode ?? 'normal'
          const meleeSel  = meleeSelections[activeFocusId]
          const chargeSel = chargeSelections[activeFocusId]
          const meleeTgt  = meleeSel ? tokens.find(t => t.id === meleeSel.targetTokenId) : null
          const chargeTgt = chargeSel?.targetTokenId ? tokens.find(t => t.id === chargeSel.targetTokenId) : null
          const meleeWeapon = equipment[activeFocusId]?.weapon && !equipment[activeFocusId].weapon.ref_fire_mode
            ? equipment[activeFocusId].weapon : null
          const isQueueMove   = chargeQueueRef.current.includes(activeFocusId) && chargePhaseRef.current === 'move' && chargeQueueIdxRef.current < chargeQueueRef.current.length
          const isQueueTarget = (meleeQueueRef.current.includes(activeFocusId) && meleeQueueIdxRef.current < meleeQueueRef.current.length)
                             || (chargeQueueRef.current.includes(activeFocusId) && chargePhaseRef.current === 'target' && chargeQueueIdxRef.current < chargeQueueRef.current.length)
          return (
            <div style={S.meleePanelGm}>
              <div style={S.meleePanelTitle}>MODE DE COMBAT</div>

              {/* Chips Normal / Offensif / Charge / Défensif / Retraite */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {[
                  { k: 'normal',   l: 'Normal',   tooltip: 'Mode par défaut — aucun modificateur.' },
                  { k: 'offensif', l: 'Offensif',  tooltip: '+3 attaque / −5 défense si attaqué.' },
                  { k: 'charge',   l: 'Charge',    tooltip: '+3 attaque, +3 dégâts / −7 défense / ≥ 3m + dépl. court gratuit.' },
                  { k: 'defensif', l: 'Défensif',  tooltip: 'Aucune attaque. +3 défense si attaqué. (LdB p.223)' },
                  { k: 'retraite', l: 'Retraite',  tooltip: 'Aucune attaque. +5 défense si attaqué. Recul possible. (LdB p.223)' },
                ].map(m => {
                  const isDefensif = m.k === 'defensif' || m.k === 'retraite'
                  return (
                    <div key={m.k} title={m.tooltip}
                      onClick={() => {
                        if (m.k === 'charge') { handleStartChargeQueue() }
                        else if (isDefensif) { setMeleeCombatMode(m.k) /* pas de queue */ }
                        else { setMeleeCombatMode(m.k); handleStartMeleeQueue() }
                      }}
                      style={{
                        ...S.modeChip,
                        ...(curMode === m.k ? (isDefensif ? S.modeChipDefensif : S.modeChipActive) : {}),
                      }}
                    >{m.l}</div>
                  )
                })}
              </div>

              {/* Statut / feedback */}
              {(curMode === 'defensif') && (
                <div style={{ fontSize: 9, color: '#8ab4f0', fontStyle: 'italic' }}>
                  Aucune attaque — +3 en défense si attaqué
                </div>
              )}
              {(curMode === 'retraite') && (
                <div style={{ fontSize: 9, color: '#8ab4f0', fontStyle: 'italic' }}>
                  Aucune attaque — +5 en défense, recul possible
                </div>
              )}
              {meleePendingMode && !meleeSel && !chargeSel && curMode !== 'defensif' && curMode !== 'retraite' && (
                <div style={{ fontSize: 9, color: '#5a7a5a', fontStyle: 'italic' }}>
                  Choisissez un mode puis cliquez pour sélectionner la cible
                </div>
              )}
              {isQueueMove && (
                <div style={{ fontSize: 9, color: '#c8a030' }}>⚡ Sélectionnez la destination</div>
              )}
              {isQueueTarget && (
                <div style={{ fontSize: 9, color: '#70c070' }}>⚔ Cliquez sur la cible CaC</div>
              )}
              {meleeSel && meleeTgt && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: '#3a6a3a', marginBottom: 3 }}>CIBLE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 11, color: '#70c870', fontWeight: 600 }}>{meleeTgt.label}</span>
                    <span style={{ fontSize: 8, color: '#507050', fontFamily: 'monospace' }}>
                      {meleeWeapon ? (meleeWeapon.ref_name ?? 'arme') : 'mains nues'}
                    </span>
                  </div>
                </div>
              )}
              {chargeSel && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: '#6a3a7a', marginBottom: 3 }}>CHARGE</div>
                  <div style={{ fontSize: 10, color: '#c890e8' }}>
                    {chargeSel.move ? '✓ destination' : '… destination'}
                  </div>
                  {chargeTgt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#c890e8', fontWeight: 600 }}>→ {chargeTgt.label}</span>
                      <span style={{ fontSize: 8, color: '#705070', fontFamily: 'monospace' }}>
                        {meleeWeapon ? (meleeWeapon.ref_name ?? 'arme') : 'mains nues'}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: '#705070', marginTop: 2 }}>… cible CaC</div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

      </div>{/* fin body flex-row */}

      {/* FOOTER */}
      <div style={S.footer}>
        {singleDelta !== null && singleDelta !== 0 && (
          <div style={S.iniRow}>
            <span style={S.iniLabel}>INI TOTAL</span>
            <span style={{ ...S.iniValue, color: singleDelta < -10 ? '#c83030' : (singleDelta < 0 ? '#c86030' : '#3aaa6a') }}>
              {singleDelta > 0 ? `+${singleDelta}` : singleDelta}
            </span>
          </div>
        )}
        {declareError && (
          <div style={{ fontSize: 9, color: '#c83030', background: 'rgba(200,48,48,0.08)', border: '1px solid #c8303044', borderRadius: 2, padding: '4px 8px', fontFamily: 'monospace' }}>
            ⚠ {declareError}
          </div>
        )}
        {batchMode && (
          <div style={S.batchWarn}>⚠ coûts INI calculés individuellement</div>
        )}
        {moveQueueRef.current.length > 0 && moveQueueIdxRef.current < moveQueueRef.current.length && (
          <button style={S.btnPasser} onClick={() => moveCancelRef.current?.()}>
            Passer ({getLabel(moveQueueRef.current[moveQueueIdxRef.current])})
          </button>
        )}
        {attackQueueRef.current.length > 0 && attackQueueIdxRef.current < attackQueueRef.current.length && (
          <button style={S.btnPasser} onClick={() => attackCancelRef.current?.()}>
            Passer ({getLabel(attackQueueRef.current[attackQueueIdxRef.current])})
          </button>
        )}
        {meleeQueueRef.current.length > 0 && meleeQueueIdxRef.current < meleeQueueRef.current.length && (
          <button style={S.btnPasser} onClick={() => meleeCancelRef.current?.()}>
            Passer CaC ({getLabel(meleeQueueRef.current[meleeQueueIdxRef.current])})
          </button>
        )}
        {chargeQueueRef.current.length > 0 && chargeQueueIdxRef.current < chargeQueueRef.current.length && (
          <button style={S.btnPasser} onClick={() => chargeCancelRef.current?.()}>
            Passer Charge — {chargePhaseRef.current === 'move' ? 'dest.' : 'cible'} ({getLabel(chargeQueueRef.current[chargeQueueIdxRef.current])})
          </button>
        )}
        <button
          style={{ ...S.btnDeclare, ...(!canDeclare ? S.btnDeclareDisabled : {}) }}
          onClick={handleDeclare}
          disabled={!canDeclare}
        >
          {batchMode ? `DÉCLARER ×${targetIds.length}` : 'DÉCLARER'}
        </button>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  window: {
    position: 'absolute',
    width: 440, maxHeight: 'calc(100vh - 100px)',
    background: 'rgba(8,12,20,0.97)',
    border: '1.5px solid #15212e',
    borderRadius: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    pointerEvents: 'auto',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui',
  },

  // Header
  header: { padding: '8px 12px', background: '#06080e', borderBottom: '1px solid #15212e', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'grab', userSelect: 'none' },
  headerBatch: { background: '#2a1810' },
  headerLabel: { fontSize: 9, letterSpacing: '0.15em', fontWeight: 700, color: '#3a8aaa', flex: 1 },
  headerLabelBatch: { color: '#e8c870' },
  headerProgress: { fontSize: 9, color: '#5a6575', fontFamily: 'monospace' },

  // Controls
  controls: { flexShrink: 0, borderBottom: '1px solid #15212e' },
  section: { padding: '6px 12px 8px', borderBottom: '1px solid #0e1520' },
  sectionTitle: { display: 'block', fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: '#3a8aaa', marginBottom: 5 },

  // InlineChip
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#0a1018', border: '1px solid #1a2a38', borderRadius: 2, cursor: 'pointer', userSelect: 'none' },
  chipLabel: { fontSize: 7, color: '#456575', letterSpacing: '0.1em', fontFamily: 'monospace' },
  chipValue: { fontSize: 10, color: '#dde7ee', fontWeight: 600 },
  chipMixed: { color: '#aa8a30', fontStyle: 'italic', fontWeight: 400 },
  chipCost: { fontSize: 8, fontFamily: 'monospace', fontWeight: 700 },

  // Action grid
  actionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  actionBtn: { padding: '5px 8px', background: '#0a1018', border: '1px solid #15212e', borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  actionBtnActive: { background: '#2a1e10', border: '1px solid #aa8a30' },
  actionBtnDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  actionLabel: { fontSize: 10, flex: 1 },
  actionIni: { fontSize: 8, fontFamily: 'monospace', flexShrink: 0 },
  actionDisabledTag: { fontSize: 7, color: '#2a3848', fontFamily: 'monospace', flexShrink: 0 },

  // Attack target feedback
  attackTargetRow: { marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 },
  attackTargetLabel: { fontSize: 9, color: '#c86030', fontFamily: 'monospace' },
  attackTargetName: { fontSize: 10, color: '#e8a060', fontWeight: 600 },
  attackNoWeapon: { fontSize: 8, color: '#6a3030', fontFamily: 'monospace', marginLeft: 4 },

  // Quick actions
  quickList: { display: 'flex', flexDirection: 'column', gap: 3 },
  quickRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.01)', border: '1px solid transparent', cursor: 'pointer' },
  quickRowActive: { background: 'rgba(91,141,238,0.1)', border: '1px solid #2a3a5e' },
  quickLabel: { fontSize: 10, color: '#aaccdd', flex: 1 },
  sliderWrap: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  slider: { width: 64, accentColor: '#5b8dee', cursor: 'pointer' },
  sliderVal: { fontSize: 10, fontFamily: 'monospace', minWidth: 14, textAlign: 'right' },

  // Roster
  roster: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#070a10' },
  rosterHeader: { padding: '5px 12px', background: '#060810', borderBottom: '1px solid #15212e', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  rosterTitle: { fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: '#aa6030', flex: 1, fontFamily: 'monospace' },
  rosterLink: { fontSize: 8, color: '#aa8a30', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.06em' },
  rosterList: { flex: 1, overflowY: 'auto' },
  rosterRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 8px', borderBottom: '1px solid #0e1520', borderLeft: '3px solid transparent', transition: 'opacity 0.15s' },
  rosterRowActive: { background: '#0a1828', borderLeft: '3px solid #3a8aaa' },
  rosterRowSel:    { background: '#181410', borderLeft: '3px solid #aa8a30' },
  rosterGlyph: { fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0, fontFamily: 'monospace' },
  rosterName: { fontSize: 10, color: '#aaccdd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rosterBadge:    { fontSize: 7, fontFamily: 'monospace', fontWeight: 700, padding: '1px 4px', borderRadius: 2, letterSpacing: '0.08em', flexShrink: 0 },
  rosterBadgeDst: { background: '#0a1e2e', color: '#3a8aaa', border: '1px solid #1a4a5a' },
  rosterBadgeCct: { background: '#1e1a0a', color: '#aa8a30', border: '1px solid #5a4a1a' },
  rosterBadgeNone:{ background: '#0a0e14', color: '#3a4a5a', border: '1px solid #1a2030' },
  rosterIni: { fontSize: 9, color: '#456575', flexShrink: 0, fontFamily: 'monospace' },
  rosterDelta: { fontSize: 9, flexShrink: 0, fontFamily: 'monospace', fontWeight: 700 },

  // Footer
  footer: { padding: '8px 12px', background: '#06080e', borderTop: '1.5px solid #15212e', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  iniRow: { display: 'flex', alignItems: 'center', gap: 8 },
  iniLabel: { fontSize: 9, color: '#456575', letterSpacing: '0.12em', fontFamily: 'monospace', flex: 1 },
  iniValue: { fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' },
  batchWarn: { fontSize: 8, color: '#aa8a30', fontFamily: 'monospace', padding: '4px 6px', background: '#1a1410', border: '1px solid #aa8a3044', borderRadius: 2 },
  btnDeclare: { padding: '7px 12px', background: 'rgba(80,200,120,0.12)', border: '1px solid #50c878', borderRadius: 3, color: '#50c878', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', fontFamily: 'monospace' },
  btnDeclareDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  btnPasser: { padding: '5px 12px', background: 'none', border: '1px solid #3a4a5a', borderRadius: 3, color: '#7090a8', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace' },
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
  meleePanelTitle: {
    fontSize: 8, fontWeight: 700, color: '#3a6a4a',
    letterSpacing: '0.12em', marginBottom: 4,
    textTransform: 'uppercase',
  },
}
