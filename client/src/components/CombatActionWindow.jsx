import { useState, useEffect, useRef } from 'react'
import { WS } from '../../../shared/events.js'
import { calcAN, calcAllures } from '../../../shared/polarisUtils.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'
import {
  STATE_DEFS, MAP_ACTIONS, QUICK_ACTIONS, MOVE_ZONE_DEFS,
  stateTransitionCost, calcIniDelta,
} from './combatSections.js'

// ---------------------------------------------------------------------------
// Variants mode de tir (inchanges depuis Sprint 7.1)
// ---------------------------------------------------------------------------
const FIRE_MODE_VARIANTS = {
  CC: [
    { id: 'cc_1',   bulletCount: 1,  bonusComp: 0, bonusDmg: 0 },
    { id: 'cc_2',   bulletCount: 2,  bonusComp: 1, bonusDmg: 0 },
    { id: 'cc_3',   bulletCount: 3,  bonusComp: 2, bonusDmg: 0 },
    { id: 'cc_4',   bulletCount: 4,  bonusComp: 3, bonusDmg: 0 },
    { id: 'cc_7a',  bulletCount: 7,  bonusComp: 4, bonusDmg: 0 },
    { id: 'cc_7b',  bulletCount: 7,  bonusComp: 3, bonusDmg: 3 },
    { id: 'cc_10a', bulletCount: 10, bonusComp: 5, bonusDmg: 0 },
    { id: 'cc_10b', bulletCount: 10, bonusComp: 4, bonusDmg: 3 },
  ],
  RC: [{ id: 'rc_3', bulletCount: 3, bonusComp: 3, bonusDmg: 5 }],
  RL: [
    { id: 'rl_5',   bulletCount: 5,  bonusComp: 2, bonusDmg: 2 },
    { id: 'rl_10',  bulletCount: 10, bonusComp: 4, bonusDmg: 4 },
    { id: 'rl_15',  bulletCount: 15, bonusComp: 6, bonusDmg: 6 },
    { id: 'rl_20',  bulletCount: 20, bonusComp: 8, bonusDmg: 8 },
    { id: 'rl_mc',  bulletCount: 5,  bonusComp: 0, bonusDmg: 0 },
  ],
}
const CC_REPS_STEPS = [2, 3, 4, 7, 10]
const RL_BUTTONS = [
  { value: 5, label: '5b' }, { value: 10, label: '10b' },
  { value: 15, label: '15b' }, { value: 20, label: '20b' },
  { value: 'multi', label: 'Multi' },
]

// ---------------------------------------------------------------------------
// Composant StateSelector
// Affiche un segmented control pour un etat avec cout de transition visible.
// ---------------------------------------------------------------------------
function StateSelector({ stateKey, def, current, initial, onChange, disabled, availableKeys }) {
  return (
    <div style={ss.row}>
      <span style={ss.label}>{def.label}</span>
      <div style={ss.seg}>
        {def.states.map(opt => {
          const isActive   = opt.k === current
          const isDisabled = disabled || (availableKeys && !availableKeys.includes(opt.k))
          const cost       = stateTransitionCost(def, initial, opt.k)
          const costStr    = cost === 0 ? null : cost > 0 ? `+${cost}` : `${cost}`
          return (
            <div
              key={opt.k}
              onClick={() => !isDisabled && !isActive && onChange(opt.k)}
              style={{
                ...ss.segOpt,
                ...(isActive    ? ss.segOptActive    : {}),
                ...(isDisabled  ? ss.segOptDisabled  : {}),
              }}
            >
              <span style={ss.segOptLabel}>{opt.l}</span>
              {costStr && !isActive && (
                <span style={{ ...ss.segCost, color: cost > 0 ? '#3aaa6a' : '#c86030' }}>
                  {costStr}
                </span>
              )}
              {isActive && opt.k === initial && (
                <span style={ss.segCostCurrent}>actuel</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export default function CombatActionWindow({
  socket, user, characters, pendingSurpriseRoll, onSurpriseRolled,
  onEnterMoveMode, onEnterTargetMode,
}) {
  const { roster, phase, activeSlotIdx, actions } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  const playerChar  = characters.find(c => c.user_id === user?.id)
  const playerToken = tokens.find(t => t.character_id === playerChar?.id)
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null

  // --- etats tactiques (initialises depuis rosterEntry quand dispo) ----------
  const [states, setStates] = useState({
    position:  'standing',
    weapon:    'holstered',
    fire_mode: 'cc',
    cover:     'exposed',
    vitesse:   'normal',
  })
  const prevWeaponRef = useRef(null) // pour revert QB

  // Sync depuis rosterEntry a l'entree en phase ANNOUNCEMENT
  useEffect(() => {
    if (!rosterEntry) return
    setStates({
      position:  rosterEntry.state_position  || 'standing',
      weapon:    rosterEntry.state_weapon    || 'holstered',
      fire_mode: rosterEntry.state_fire_mode || 'cc',
      cover:     rosterEntry.state_cover     || 'exposed',
      vitesse:   rosterEntry.state_vitesse   || 'normal',
    })
  }, [rosterEntry?.token_id]) // reset a chaque nouveau tour (token_id stable)

  // --- actions sur la carte (multi-select) ----------------------------------
  const [mapSelected, setMapSelected] = useState(new Set())

  // --- actions rapides ------------------------------------------------------
  const [quick, setQuick] = useState({ observer: 0, reperer: 0, phrase: false })

  // --- etat assaut (panneau droit) ------------------------------------------
  const [allures, setAllures]                     = useState(null)
  const [assaultWeapons, setAssaultWeapons]       = useState([])
  const [assaultPendingTokenId, setAssaultPendingTokenId] = useState(null)
  const [assaultBulletCount, setAssaultBulletCount]       = useState(null)
  const [assaultVariantAB, setAssaultVariantAB]           = useState('A')
  const [isDualWield, setIsDualWield]             = useState(false)
  const [inMoveMode, setInMoveMode]               = useState(false)
  const [inTargetMode, setInTargetMode]           = useState(false)
  const [moveSelection, setMoveSelection]         = useState(null)

  // --- etats initiaux (reference debut de tour pour calcul delta) -----------
  const initialStates = useRef({
    position:  'standing',
    weapon:    'holstered',
    fire_mode: 'cc',
    cover:     'exposed',
    vitesse:   'normal',
  })
  useEffect(() => {
    if (!rosterEntry) return
    const snap = {
      position:  rosterEntry.state_position  || 'standing',
      weapon:    rosterEntry.state_weapon    || 'holstered',
      fire_mode: rosterEntry.state_fire_mode || 'cc',
      cover:     rosterEntry.state_cover     || 'exposed',
      vitesse:   rosterEntry.state_vitesse   || 'normal',
    }
    initialStates.current = snap
    setStates({ ...snap })
    setMapSelected(new Set())
    setQuick({ observer: 0, reperer: 0, phrase: false })
    setAssaultPendingTokenId(null)
    setAssaultBulletCount(null)
    setAssaultVariantAB('A')
    setIsDualWield(false)
    setMoveSelection(null)
    prevWeaponRef.current = null
  }, [rosterEntry?.token_id])

  // --- fetch allures --------------------------------------------------------
  useEffect(() => {
    if (!playerChar?.id) return
    let cancelled = false
    const load = async () => {
      try {
        const [sheetRes, genoRes] = await Promise.all([
          api.get(`/char-sheet/${playerChar.id}`),
          api.get('/char-ref/genotypes'),
        ])
        if (cancelled) return
        const { archetype, attributes, skills } = sheetRes.data
        const genotype = genoRes.data.genotypes?.find(g => g.id === archetype?.genotype_id) || {}
        const findAttr = (id) => attributes?.find(a => a.attr_id === id) || {}
        const calcNA = (id, modField) => Math.max(3,
          (findAttr(id).base_level ?? 7) + (findAttr(id).pc_modifier ?? 0) + (genotype[modField] || 0)
        )
        const coo_na = calcNA('COO', 'mod_coo')
        const for_na = calcNA('FOR', 'mod_for')
        const mastery = skills?.find(s => s.skill_id === 'ATHLETISME')?.mastery ?? 0
        const athletisme_total = calcAN(for_na) + calcAN(coo_na) + mastery
        if (!cancelled) setAllures(calcAllures(coo_na, athletisme_total))
      } catch (e) {
        console.error('[CombatActionWindow] erreur fetch allures :', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [playerChar?.id])

  // --- fetch armes equipees -------------------------------------------------
  useEffect(() => {
    if (!playerChar?.id) return
    let cancelled = false
    api.get(`/char-sheet/${playerChar.id}/inventory`).then(res => {
      if (cancelled) return
      const weapons = (res.data.items || []).filter(
        item => (item.slot === 'MG' || item.slot === 'MD') && item.ref_fire_mode
      )
      setAssaultWeapons(weapons)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [playerChar?.id])

  if (!playerToken || !rosterEntry) return null

  // --- derives resolution --------------------------------------------------
  const sorted = [...roster].sort((a, b) => b.initiative - a.initiative)
  const isMyTurnInResolution = phase === 'RESOLUTION' && sorted[activeSlotIdx]?.token_id === playerToken.id
  const myActions = actions.filter(a => a.token_id === playerToken.id)

  // --- derives assaut -------------------------------------------------------
  const weaponMg = assaultWeapons.find(w => w.slot === 'MG') || null
  const weaponMd = assaultWeapons.find(w => w.slot === 'MD') || null
  const hasTwoWeapons = !!(weaponMg && weaponMd)
  const sameFirMode   = hasTwoWeapons && weaponMg.ref_fire_mode === weaponMd.ref_fire_mode
  const forceCC       = hasTwoWeapons && !sameFirMode
  const selectedWeapon = weaponMg || weaponMd || null
  const assaultWeaponId = selectedWeapon?.id ?? null

  // Modes disponibles pour le StateSelector fire_mode
  const availableFireModes = forceCC
    ? ['cc']
    : selectedWeapon
      ? (selectedWeapon.ref_fire_mode || 'cc').split('/').map(s => s.trim().toLowerCase()).filter(Boolean)
      : ['cc', 'rc', 'rl']

  const fireModeUpper = states.fire_mode.toUpperCase()
  const currentFireMode = forceCC ? 'CC' : fireModeUpper

  // Variant assaut selectionne
  let currentVariant = null
  if (currentFireMode === 'RC') {
    currentVariant = FIRE_MODE_VARIANTS.RC[0]
  } else if (currentFireMode === 'CC' && assaultBulletCount) {
    if (assaultBulletCount === 7) {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (assaultVariantAB === 'B' ? 'cc_7b' : 'cc_7a'))
    } else if (assaultBulletCount === 10) {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.id === (assaultVariantAB === 'B' ? 'cc_10b' : 'cc_10a'))
    } else {
      currentVariant = FIRE_MODE_VARIANTS.CC.find(v => v.bulletCount === assaultBulletCount)
    }
  } else if (currentFireMode === 'RL' && assaultBulletCount) {
    currentVariant = assaultBulletCount === 'multi'
      ? FIRE_MODE_VARIANTS.RL.find(v => v.id === 'rl_mc')
      : FIRE_MODE_VARIANTS.RL.find(v => v.bulletCount === assaultBulletCount)
  }

  const dualWieldBonusComp = (isDualWield && hasTwoWeapons && sameFirMode)
    ? (currentFireMode === 'RL' ? 5 : 3)
    : 0

  const pendingTargetToken = assaultPendingTokenId
    ? tokens.find(t => t.id === assaultPendingTokenId)
    : null

  const attackSelected = mapSelected.has('attack')
  const meleeSelected  = mapSelected.has('melee')
  const weaponLocked   = attackSelected || meleeSelected

  // --- QB : weapon auto-drawn quand attack/melee selectionne ---------------
  const handleMapToggle = (k) => {
    setMapSelected(prev => {
      const next = new Set(prev)
      const wasAttackOrMelee = prev.has('attack') || prev.has('melee')
      if (next.has(k)) {
        next.delete(k)
        if (k === 'attack') {
          setAssaultPendingTokenId(null)
          setAssaultBulletCount(null)
          setAssaultVariantAB('A')
          setIsDualWield(false)
          setInTargetMode(false)
        }
        if (k === 'move') setMoveSelection(null)
      } else {
        next.add(k)
      }
      const willAttackOrMelee = next.has('attack') || next.has('melee')
      if (!wasAttackOrMelee && willAttackOrMelee) {
        // Entrer en mode combat => weapon passe a 'drawn'
        prevWeaponRef.current = states.weapon
        setStates(s => ({ ...s, weapon: 'drawn' }))
      } else if (wasAttackOrMelee && !willAttackOrMelee) {
        // Quitter le mode combat => revert weapon
        const prev = prevWeaponRef.current ?? initialStates.current.weapon
        setStates(s => ({ ...s, weapon: prev }))
        prevWeaponRef.current = null
      }
      return next
    })
  }

  // --- deplacement zone select ---------------------------------------------
  const handleZoneSelectClick = () => {
    if (moveSelection) { setMoveSelection(null); return }
    if (!allures) return
    const zones = MOVE_ZONE_DEFS.map(def => ({
      radius:     allures[def.allureKey],
      action_key: def.action_key,
      ini_mod:    def.ini_mod,
      color:      def.color,
      label:      def.label,
    }))
    setInMoveMode(true)
    setMoveSelection(null)
    onEnterMoveMode(
      zones, playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (sel) => { setMoveSelection(sel); setInMoveMode(false) },
      () => { setInMoveMode(false) }
    )
  }

  // --- choix cible assaut --------------------------------------------------
  const handleChooseTarget = () => {
    setInTargetMode(true)
    setAssaultPendingTokenId(null)
    onEnterTargetMode(
      playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (tokenId) => { setAssaultPendingTokenId(tokenId); setInTargetMode(false) },
      () => { setInTargetMode(false) }
    )
  }

  // --- calcul INI total client (indicatif) ---------------------------------
  const mapActionsObj = {
    move:   moveSelection ? { ini_mod: moveSelection.ini_mod } : null,
    attack: attackSelected ? { cover_shot: !!(attackSelected && states.cover !== 'exposed') } : null,
    melee:  meleeSelected,
    multi:  mapSelected.has('multi'),
  }
  const iniDelta = calcIniDelta(initialStates.current, states, mapActionsObj, quick)
  const iniTotal = (rosterEntry.initiative ?? 0) - iniDelta // initiative decremente par les couts

  // --- validite declaration ------------------------------------------------
  const assaultValid = !attackSelected || (
    assaultWeaponId != null &&
    assaultPendingTokenId != null &&
    currentVariant != null
  )
  const hasAnyAction = mapSelected.size > 0 || moveSelection !== null
    || quick.observer > 0 || quick.reperer > 0 || quick.phrase
    || Object.values(states).some((v, i) => v !== Object.values(initialStates.current)[i])

  // Comparer states vs initial proprement
  const stateChanged = Object.keys(states).some(k => states[k] !== initialStates.current[k])
  const canDeclare = (hasAnyAction || stateChanged) && assaultValid

  // --- emit declaration ----------------------------------------------------
  const handleDeclare = () => {
    if (!socket || !playerToken || !canDeclare) return
    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      state: {
        position:  states.position,
        weapon:    states.weapon,
        fire_mode: states.fire_mode,
        cover:     states.cover,
        vitesse:   states.vitesse,
      },
      mapActions: {
        move:   moveSelection
          ? { targetPosX: moveSelection.targetPosX, targetPosY: moveSelection.targetPosY,
              targetPosZ: moveSelection.targetPosZ ?? 0,
              ini_mod: moveSelection.ini_mod, action_key: moveSelection.action_key }
          : null,
        attack: attackSelected ? {
          weaponInvId:        assaultWeaponId,
          targetTokenId:      assaultPendingTokenId,
          bulletCount:        currentVariant?.bulletCount ?? null,
          fireModeBonusComp:  currentVariant ? (currentVariant.bonusComp + dualWieldBonusComp) : null,
          fireModeBonusDmg:   currentVariant?.bonusDmg ?? null,
          isDualWield:        isDualWield && hasTwoWeapons && sameFirMode,
          dualWieldBonusComp: dualWieldBonusComp,
          cover_shot:         states.cover !== 'exposed',
        } : null,
        melee:    meleeSelected,
        multi:    mapSelected.has('multi'),
        interact: mapSelected.has('interact'),
      },
      quick: {
        observer: quick.observer,
        reperer:  quick.reperer,
        phrase:   quick.phrase,
      },
    })
  }

  // =========================================================================
  // RENDU — Surprise
  // =========================================================================
  if (pendingSurpriseRoll?.tokenId === playerToken.id) {
    return (
      <div style={W.window}>
        <div style={W.header}>Surprise !</div>
        <p style={W.surpriseText}>Vous etes surpris. Lancez 1d20 pour determiner votre initiative.</p>
        <button style={W.btnRoll} onClick={onSurpriseRolled}>Lancer le de d&apos;initiative</button>
      </div>
    )
  }
  if (rosterEntry.is_surprised && rosterEntry.has_announced && rosterEntry.initiative === 0) {
    return (
      <div style={W.window}>
        <div style={W.header}>Surprise !</div>
        <p style={W.surpriseText}>Vous etes surpris — vous ne pouvez pas agir ce tour.</p>
      </div>
    )
  }

  // =========================================================================
  // RENDU — Phase Résolution (mon tour)
  // =========================================================================
  if (isMyTurnInResolution) {
    const myAssaultAction = myActions.find(a => a.action_key === 'assault')
    const cibleToken = myAssaultAction ? tokens.find(t => t.id === myAssaultAction.target_token_id) : null
    const isRushed = rosterEntry.state_vitesse === 'rushed'
    return (
      <div style={W.window}>
        <div style={W.header}>Phase 2 - Resolution</div>
        <div style={W.body}>
          <div style={W.leftPanel}>
            {myActions.map(a => (
              <div key={a.id} style={{ padding: '6px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e1e2e' }}>
                <span style={W.itemLabel}>{a.action_key}</span>
                <span style={W.itemMod}>{a.modifiers?.ini_mod ?? ''}</span>
              </div>
            ))}
            {myAssaultAction && (
              <div style={{ padding: '6px 14px', fontSize: 11, color: '#7070a0', borderTop: '1px solid #2a2a3e' }}>
                <div>Cible : <span style={{ color: '#c0c0d0' }}>{cibleToken?.label ?? '—'}</span></div>
                {isRushed && <div style={{ color: '#e55' }}>Precipite (-5)</div>}
              </div>
            )}
          </div>
        </div>
        <div style={W.footer}>
          {myAssaultAction ? (
            <div style={{ color: '#7070a0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>
              En attente de validation GM…
            </div>
          ) : (
            <button style={W.btnDeclare} onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: playerToken.id })}>
              Agir
            </button>
          )}
        </div>
      </div>
    )
  }

  // Deja declare
  if (rosterEntry.has_announced) {
    return (
      <div style={W.window}>
        <div style={W.header}>Phase 1 - Declaration d&apos;intention</div>
        <p style={W.waitText}>Action declaree. En attente des autres participants…</p>
      </div>
    )
  }

  const isHidden   = inMoveMode || inTargetMode
  const showAssault = attackSelected

  // CC slider index
  const ccSliderIdx = assaultBulletCount && assaultBulletCount !== 1
    ? CC_REPS_STEPS.indexOf(assaultBulletCount)
    : 0
  const ccSliderDisplayIdx = ccSliderIdx === -1 ? 0 : ccSliderIdx

  // =========================================================================
  // RENDU — Phase Annonce
  // =========================================================================
  return (
    <div style={{
      ...W.window,
      width: showAssault ? 720 : 360,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden ? 'none' : 'auto',
    }}>
      <div style={W.header}>Phase 1 — Declaration d&apos;intention</div>

      <div style={W.body}>
        {/* ---- Panneau gauche ---- */}
        <div style={W.leftPanel}>

          {/* TACTIQUE */}
          <div style={W.section}>
            <div style={W.sectionTitle}>TACTIQUE</div>
            <StateSelector
              stateKey="position" def={STATE_DEFS.position}
              current={states.position} initial={initialStates.current.position}
              onChange={v => setStates(s => ({ ...s, position: v }))}
            />
            <StateSelector
              stateKey="cover" def={STATE_DEFS.cover}
              current={states.cover} initial={initialStates.current.cover}
              onChange={v => setStates(s => ({ ...s, cover: v }))}
            />
            <StateSelector
              stateKey="vitesse" def={STATE_DEFS.vitesse}
              current={states.vitesse} initial={initialStates.current.vitesse}
              onChange={v => setStates(s => ({ ...s, vitesse: v }))}
            />
          </div>

          {/* ARMEMENT */}
          <div style={W.section}>
            <div style={W.sectionTitle}>ARMEMENT</div>
            <StateSelector
              stateKey="weapon" def={STATE_DEFS.weapon}
              current={states.weapon} initial={initialStates.current.weapon}
              onChange={v => setStates(s => ({ ...s, weapon: v }))}
              disabled={weaponLocked}
            />
            <StateSelector
              stateKey="fire_mode" def={STATE_DEFS.fire_mode}
              current={states.fire_mode} initial={initialStates.current.fire_mode}
              onChange={v => setStates(s => ({ ...s, fire_mode: v }))}
              availableKeys={availableFireModes}
            />
          </div>

          {/* ACTION */}
          <div style={W.section}>
            <div style={W.sectionTitle}>ACTION</div>
            <div style={W.itemsGrid}>
              {MAP_ACTIONS.map(a => {
                const isActive   = mapSelected.has(a.k)
                const isDisabled = a.active === false
                if (isDisabled) {
                  return (
                    <div key={a.k} title={a.tooltip} style={W.itemGreyed}>
                      <span style={W.itemLabel}>{a.l}</span>
                      {a.ini && <span style={W.itemMod}>{a.ini}</span>}
                    </div>
                  )
                }
                if (a.isZoneSelect) {
                  const canActivate = allures !== null
                  return (
                    <div
                      key={a.k}
                      title={a.tooltip}
                      style={{
                        ...W.item,
                        ...(isActive ? W.itemSelected : {}),
                        ...(moveSelection ? W.itemSelected : {}),
                        gridColumn: 'span 2',
                        ...(!canActivate ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                      }}
                      onClick={() => {
                        if (!canActivate) return
                        handleMapToggle(a.k)
                        if (!mapSelected.has(a.k)) handleZoneSelectClick()
                      }}
                    >
                      <span style={W.itemLabel}>{a.l}</span>
                      <span style={{ ...W.itemMod, ...(moveSelection ? { color: '#5b8dee' } : {}) }}>
                        {moveSelection ? `${moveSelection.ini_mod}` : 'choix zone'}
                      </span>
                    </div>
                  )
                }
                return (
                  <div
                    key={a.k}
                    title={a.tooltip}
                    style={{ ...W.item, ...(isActive ? W.itemSelected : {}) }}
                    onClick={() => handleMapToggle(a.k)}
                  >
                    <span style={W.itemLabel}>{a.l}</span>
                    {a.ini && (
                      <span style={{ ...W.itemMod, ...(isActive ? { color: '#5b8dee' } : {}) }}>
                        {a.ini}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Toggle cover_shot conditionnel (assault + cover != exposed) */}
            {attackSelected && states.cover !== 'exposed' && (
              <div
                style={{
                  ...W.item,
                  gridColumn: 'span 2',
                  marginTop: 4,
                  background: 'rgba(180,80,80,0.08)',
                  borderColor: '#c05050',
                }}
                onClick={() => {/* toggle gere via states.cover dans le payload */}}
              >
                <span style={{ ...W.itemLabel, color: '#e07070' }}>Tirer depuis ma couverture</span>
                <span style={{ ...W.itemMod, color: '#e07070' }}>
                  {states.cover === 'important' ? '-5' : '-3'}
                </span>
              </div>
            )}
          </div>

          {/* ACTIONS RAPIDES */}
          <div style={W.section}>
            <div style={W.sectionTitle}>ACTIONS RAPIDES</div>
            {QUICK_ACTIONS.map(a => {
              const isFixed = a.kind === 'fixed'
              const val     = isFixed ? quick.phrase : (quick[a.k] ?? 0)
              const isActive = isFixed ? !!val : val > 0
              const cost    = isFixed ? a.ini : (val * a.stepIni)
              return (
                <div key={a.k} title={a.tooltip} style={{ borderBottom: '1px solid #1a1a2a' }}>
                  <div
                    style={{ ...W.item, gridColumn: 'span 2' }}
                    onClick={() => {
                      if (isFixed) {
                        setQuick(q => ({ ...q, phrase: !q.phrase }))
                      } else {
                        setQuick(q => ({ ...q, [a.k]: q[a.k] > 0 ? 0 : 1 }))
                      }
                    }}
                  >
                    <span style={W.itemLabel}>{a.l}</span>
                    {isActive && cost !== 0 && (
                      <span style={{ ...W.itemMod, color: '#c86030' }}>{cost}</span>
                    )}
                    {!isActive && !isFixed && (
                      <span style={W.itemMod}>-5/tr.</span>
                    )}
                  </div>
                  {!isFixed && isActive && (
                    <div style={{ padding: '2px 10px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: '#456575' }}>1</span>
                      <input
                        type="range" min={1} max={a.max} step={1}
                        value={val}
                        style={{ flex: 1, accentColor: '#3a8aaa' }}
                        onChange={e => setQuick(q => ({ ...q, [a.k]: parseInt(e.target.value) }))}
                      />
                      <span style={{ fontSize: 9, color: '#456575' }}>{a.max}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#3a8aaa', minWidth: 22 }}>{val}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- Panneau droit — assaut (inchange fonctionnellement) ---- */}
        {showAssault && (
          <div style={W.assaultPanel}>

            <div style={W.assaultSection}>
              <div style={W.assaultSectionTitle}>Arme</div>
              {selectedWeapon ? (
                <div style={W.assaultInfoText}>
                  {selectedWeapon.custom_name || selectedWeapon.ref_name || 'Arme'}
                  <span style={W.assaultInfoSub}> ({selectedWeapon.slot})</span>
                  {hasTwoWeapons && weaponMd && (
                    <span style={W.assaultInfoSub}>
                      {' + '}{weaponMd.custom_name || weaponMd.ref_name || 'Arme'} ({weaponMd.slot})
                    </span>
                  )}
                </div>
              ) : (
                <div style={W.assaultNoWeapon}>Aucune arme equipee (MG/MD)</div>
              )}
            </div>

            <div style={W.assaultSection}>
              <div style={W.assaultSectionTitle}>Cible</div>
              {pendingTargetToken ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={W.assaultTargetName}>{pendingTargetToken.label ?? '?'}</span>
                  <button style={W.changeTargetBtn} onClick={handleChooseTarget}>Changer</button>
                </div>
              ) : (
                <button style={W.chooseTargetBtn} onClick={handleChooseTarget}>Choisir une cible</button>
              )}
            </div>

            {hasTwoWeapons && sameFirMode && (
              <div style={W.assaultSection}>
                <div style={W.assaultSectionTitle}>Type de tir</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{ ...W.assaultToggleBtn, ...(!isDualWield ? W.assaultToggleBtnActive : {}) }}
                    onClick={() => setIsDualWield(false)}
                  >Simple</button>
                  <button
                    style={{ ...W.assaultToggleBtn, ...(isDualWield ? W.assaultToggleBtnActive : {}) }}
                    onClick={() => setIsDualWield(true)}
                  >Double +{currentFireMode === 'RL' ? 5 : 3}</button>
                </div>
              </div>
            )}

            {selectedWeapon && currentFireMode && (
              <div style={W.assaultSection}>
                <div style={W.assaultSectionTitle}>
                  {{ CC: 'Coup par coup', RC: 'Rafale courte', RL: 'Rafale longue' }[currentFireMode] ?? currentFireMode}
                </div>

                {currentFireMode === 'CC' && (
                  <>
                    <div style={W.assaultOption} onClick={() => { setAssaultBulletCount(1); setAssaultVariantAB('A') }}>
                      <div>
                        <div style={W.assaultOptionLabel}>Tir simple</div>
                        <div style={W.assaultOptionSub}>1 balle : +0</div>
                      </div>
                      <div style={{ ...W.assaultRadio, ...(assaultBulletCount === 1 ? W.assaultRadioActive : {}) }} />
                    </div>
                    <div style={W.assaultOption} onClick={() => {
                      if (!assaultBulletCount || assaultBulletCount === 1) setAssaultBulletCount(2)
                    }}>
                      <div style={W.assaultOptionLabel}>Tir a repetition</div>
                      <div style={{ ...W.assaultRadio, ...(assaultBulletCount && assaultBulletCount !== 1 ? W.assaultRadioActive : {}) }} />
                    </div>
                    {assaultBulletCount && assaultBulletCount !== 1 && (
                      <>
                        <input
                          type="range" min={0} max={CC_REPS_STEPS.length - 1} step={1}
                          value={ccSliderDisplayIdx}
                          style={W.assaultSlider}
                          onChange={e => {
                            const count = CC_REPS_STEPS[Number(e.target.value)]
                            setAssaultBulletCount(count)
                            if (count !== 7 && count !== 10) setAssaultVariantAB('A')
                          }}
                        />
                        {(assaultBulletCount === 7 || assaultBulletCount === 10) && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              style={{ ...W.assaultVariantBtn, ...(assaultVariantAB === 'A' ? W.assaultVariantBtnActive : {}) }}
                              onClick={() => setAssaultVariantAB('A')}
                            >+{assaultBulletCount === 7 ? 4 : 5} comp</button>
                            <button
                              style={{ ...W.assaultVariantBtn, ...(assaultVariantAB === 'B' ? W.assaultVariantBtnActive : {}) }}
                              onClick={() => setAssaultVariantAB('B')}
                            >+{assaultBulletCount === 7 ? 3 : 4} comp / +3 deg</button>
                          </div>
                        )}
                      </>
                    )}
                    {assaultBulletCount && currentVariant && (
                      <div style={W.assaultSummaryText}>
                        {assaultBulletCount} balle{assaultBulletCount > 1 ? 's' : ''} : +{currentVariant.bonusComp + dualWieldBonusComp} test
                        {currentVariant.bonusDmg > 0 ? ` / +${currentVariant.bonusDmg} deg` : ''}
                      </div>
                    )}
                  </>
                )}

                {currentFireMode === 'RC' && (
                  <>
                    <div style={W.assaultOption}>
                      <div>
                        <div style={W.assaultOptionLabel}>Rafale courte</div>
                        <div style={W.assaultOptionSub}>3 balles : +3 test OU +5 deg (courte portee)</div>
                      </div>
                      <div style={{ ...W.assaultRadio, ...W.assaultRadioActive }} />
                    </div>
                    <div style={W.assaultSummaryText}>
                      3 balles : +{3 + dualWieldBonusComp} test (ou +5 deg a courte portee)
                    </div>
                  </>
                )}

                {currentFireMode === 'RL' && (
                  <>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {RL_BUTTONS.map(btn => (
                        <button
                          key={btn.value}
                          style={{ ...W.assaultVariantBtn, ...(assaultBulletCount === btn.value ? W.assaultVariantBtnActive : {}) }}
                          onClick={() => setAssaultBulletCount(btn.value)}
                        >{btn.label}</button>
                      ))}
                    </div>
                    {currentVariant && (
                      <div style={W.assaultSummaryText}>
                        {assaultBulletCount === 'multi'
                          ? 'Multi-cibles : +0 test / zone 3m'
                          : `${assaultBulletCount} balles : +${currentVariant.bonusComp + dualWieldBonusComp} test / +${currentVariant.bonusDmg} deg`
                        }
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div style={W.footer}>
        <div style={W.footerLeft}>
          <span style={{
            ...W.totalMod,
            color: iniDelta >= 0 ? '#3aaa6a' : (iniDelta < -10 ? '#c83030' : '#c86030'),
          }}>
            INI : {iniDelta >= 0 ? `+${iniDelta}` : iniDelta}
          </span>
          {moveSelection && (
            <span style={W.destination}>
              [{moveSelection.targetPosX}, {moveSelection.targetPosY}]
            </span>
          )}
        </div>
        <button
          style={{ ...W.btnDeclare, ...(!canDeclare ? W.btnDeclareDisabled : {}) }}
          onClick={handleDeclare}
          disabled={!canDeclare}
        >
          Declarer l&apos;action
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// Styles StateSelector
// ===========================================================================
const ss = {
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 10px',
    gap: 6,
  },
  label: {
    fontSize: 8,
    color: '#456575',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    flexShrink: 0,
    width: 76,
  },
  seg: {
    display: 'flex',
    flex: 1,
    background: '#0a1018',
    border: '1px solid #15212e',
  },
  segOpt: {
    flex: 1,
    padding: '4px 6px',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.1s',
  },
  segOptActive: {
    background: '#162028',
    borderColor: '#3a8aaa66',
  },
  segOptDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  segOptLabel: {
    fontSize: 9,
    color: '#dde7ee',
    display: 'block',
    fontWeight: 500,
  },
  segCost: {
    fontSize: 7,
    display: 'block',
    marginTop: 1,
  },
  segCostCurrent: {
    fontSize: 7,
    color: '#3a8aaa',
    display: 'block',
    marginTop: 1,
  },
}

// ===========================================================================
// Styles fenetre principale
// ===========================================================================
const W = {
  window: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    maxHeight: 'calc(100vh - 80px)',
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'opacity 0.15s ease, width 0.2s ease',
  },
  header: {
    padding: '8px 14px',
    borderBottom: '1px solid #2a2a3e',
    background: '#0e0e1a',
    fontSize: 11,
    color: '#c0c0d0',
    fontWeight: 600,
    flexShrink: 0,
    letterSpacing: '0.05em',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '0 0 360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    borderBottom: '1px solid #1e1e2e',
    paddingBottom: 4,
  },
  sectionTitle: {
    padding: '7px 10px 3px',
    fontSize: 8,
    fontWeight: 700,
    color: '#5a8aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: '0 4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 8px',
    margin: '1px 2px',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid transparent',
  },
  itemSelected: {
    background: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
  },
  itemGreyed: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 8px',
    margin: '1px 2px',
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  itemLabel: {
    fontSize: 11,
    color: '#c0c0d0',
    flex: 1,
    marginRight: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMod: {
    fontSize: 10,
    color: '#5b5b7a',
    flexShrink: 0,
    minWidth: 28,
    textAlign: 'right',
  },
  footer: {
    padding: '9px 14px',
    borderTop: '1px solid #2a2a3e',
    background: '#0e0e1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    gap: 8,
  },
  footerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  totalMod: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  destination: {
    fontSize: 10,
    color: '#5b8dee',
    fontWeight: 600,
  },
  btnDeclare: {
    padding: '7px 14px',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: 4,
    color: '#5b8dee',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  btnDeclareDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  surpriseText: {
    padding: '14px 14px 0',
    fontSize: 12,
    color: '#c0c0d0',
    lineHeight: '1.5',
    margin: 0,
  },
  waitText: {
    padding: '14px',
    fontSize: 12,
    color: '#5a5a7a',
    margin: 0,
    fontStyle: 'italic',
  },
  btnRoll: {
    margin: '14px',
    padding: '10px 20px',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: 4,
    color: '#5b8dee',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    width: 'calc(100% - 28px)',
  },
  assaultPanel: {
    flex: '0 0 360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid #2a2a3e',
    background: 'rgba(180,80,80,0.04)',
  },
  assaultSection: {
    padding: '8px 14px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  assaultSectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#e07070',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  assaultInfoText:  { fontSize: 12, color: '#c0c0d0' },
  assaultInfoSub:   { fontSize: 10, color: '#5b5b7a' },
  assaultNoWeapon:  { fontSize: 11, color: '#5b5b7a', fontStyle: 'italic' },
  assaultTargetName:{ fontSize: 12, color: '#e07070', fontWeight: 600, flex: 1 },
  chooseTargetBtn: {
    padding: '6px 10px',
    background: 'rgba(180,80,80,0.1)',
    border: '1px solid #c05050',
    borderRadius: 4,
    color: '#e07070',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  changeTargetBtn: {
    padding: '3px 8px',
    background: 'none',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
  },
  assaultToggleBtn: {
    flex: 1, padding: '5px 0',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#8888a8',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: 600,
  },
  assaultToggleBtnActive: {
    background: 'rgba(180,80,80,0.2)',
    borderColor: '#c05050',
    color: '#e07070',
  },
  assaultOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    cursor: 'pointer',
    userSelect: 'none',
  },
  assaultOptionLabel: { fontSize: 12, color: '#c0c0d0', fontWeight: 500 },
  assaultOptionSub:   { fontSize: 10, color: '#5b5b7a', marginTop: 2 },
  assaultRadio: {
    width: 14, height: 14,
    borderRadius: '50%',
    border: '2px solid #3a3a5a',
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  assaultRadioActive: { borderColor: '#e07070', background: '#e07070' },
  assaultSlider:      { width: '100%', accentColor: '#e07070', cursor: 'pointer' },
  assaultVariantBtn: {
    flex: 1, padding: '4px 6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#8888a8',
    fontSize: 10,
    cursor: 'pointer',
    textAlign: 'center',
  },
  assaultVariantBtnActive: {
    background: 'rgba(180,80,80,0.2)',
    borderColor: '#c05050',
    color: '#e07070',
  },
  assaultSummaryText: {
    fontSize: 11,
    color: '#e07070',
    fontWeight: 600,
    fontStyle: 'italic',
  },
}
