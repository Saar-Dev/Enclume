import { useState, useEffect, useRef, useReducer } from 'react'
import { declarationReducer, DECLARATION_INITIAL } from '../lib/declarationReducer'
import { useDraggable } from '../lib/useDraggable.js'
import { WS } from '../../../shared/events.js'
import {
  calcAN, calcAllures, calcNA, getGenotypeModForAttr, getMutationModForAttr,
} from '../../../shared/polarisUtils.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'
import {
  STATE_DEFS, MAP_ACTIONS, QUICK_ACTIONS,
  stateTransitionCost, calcIniDelta, calcIniBreakdown,
  CC_REPS_STEPS, RL_BUTTONS, computeFireVariant,
  ACTION_LABELS, PURE_MOVE_TYPES,
} from './combatSections.js'
import { getAimIneligibilityReasons } from '../../../shared/combatExclusiveActions.js'
import DroneWeaponPanel from './DroneWeaponPanel.jsx'
import { useDroneDeclare } from '../lib/useDroneDeclare.js'
import DroneDeclareSection from './DroneDeclareSection.jsx'
import AssaultRangedPanel from './AssaultRangedPanel.jsx'
import MeleeCombatPanel from './MeleeCombatPanel.jsx'

// ---------------------------------------------------------------------------
// Composant StateSelector
// Affiche un segmented control pour un etat avec cout de transition visible.
// ---------------------------------------------------------------------------
function StateSelector({ stateKey, def, current, initial, onChange, disabled, availableKeys, highlightKey }) {
  return (
    <div style={ss.row}>
      <span style={ss.label}>{def.label}</span>
      <div style={ss.seg}>
        {def.states.map(opt => {
          const isActive      = opt.k === current
          const isDisabled    = disabled || (availableKeys && !availableKeys.includes(opt.k))
          const isHighlighted = !isActive && !isDisabled && opt.k === highlightKey
          const cost          = stateTransitionCost(def, initial, opt.k)
          const costStr       = cost === 0 ? null : cost > 0 ? `+${cost}` : `${cost}`
          return (
            <div
              key={opt.k}
              onClick={() => !isDisabled && !isActive && onChange(opt.k)}
              style={{
                ...ss.segOpt,
                ...(isActive      ? ss.segOptActive   : {}),
                ...(isDisabled    ? ss.segOptDisabled  : {}),
                ...(isHighlighted ? { borderColor: '#5b8dee', color: '#5b8dee' } : {}),
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
  const { roster, phase, activeSlotIdx, actions, activeTokenId, currentTurn } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  // Multi-personnage : tous les persos contrôlés par ce joueur
  const playerChars          = characters.filter(c => c.user_id === user?.id)
  const playerTokens         = tokens.filter(t => playerChars.some(c => c.id === t.character_id))
  // Seuls les tokens effectivement dans le roster de combat
  const playerTokensInRoster = playerTokens.filter(t => roster.some(r => r.token_id === t.id))

  // Token actif = le personnage du joueur qui occupe le slot courant (annonce ou résolution)
  const activeStoreToken = playerTokensInRoster.find(t => t.id === activeTokenId) ?? null
  // playerToken = actif si disponible, sinon premier dans le roster (pour les effets entre les tours)
  const playerToken = activeStoreToken ?? playerTokensInRoster[0] ?? null
  const playerChar  = playerToken ? playerChars.find(c => c.id === playerToken.character_id) ?? null : null
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null
  const isStunned   = playerToken?.statuses?.includes('stunned') ?? false
  const isDrone     = playerChar?.type === 'drone'

  // --- etats tactiques partagés (useReducer) --------------------------------
  const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
  const prevHasAnnouncedRef    = useRef(false)  // détection nouveau tour
  const [declareError, setDeclareError] = useState(null)

  // --- actions sur la carte (multi-select) ----------------------------------
  const [mapSelected, setMapSelected] = useState(new Set())

  // --- etat assaut (panneau droit) ------------------------------------------
  const [allures, setAllures]                     = useState(null)
  const [assaultWeapons, setAssaultWeapons]       = useState([])
  const [allInventoryItems, setAllInventoryItems] = useState([])
  const [selectedAmmoId, setSelectedAmmoId]       = useState(null)
  const [assaultPendingTokenId, setAssaultPendingTokenId] = useState(null)
  const [assaultBulletCount, setAssaultBulletCount]       = useState(null)
  const [assaultVariantAB, setAssaultVariantAB]           = useState('A')
  const [isDualWield, setIsDualWield]             = useState(false)
  const [aimTranches, setAimTranches]             = useState(0)
  const [inMoveMode, setInMoveMode]               = useState(false)
  // --- etat assaut drone -------------------------------------------------------
  const [inTargetMode, setInTargetMode]           = useState(false)
  const [moveSelection, setMoveSelection]         = useState(null)

  // --- etat melee (panneau droit) -------------------------------------------
  const [meleePendingTokenIds, setMeleePendingTokenIds]     = useState([])   // [id1, id2?, id3?]
  const [meleeCount, setMeleeCount]                         = useState(1)    // 1|2|3
  const [selectedMeleeWeaponId, setSelectedMeleeWeaponId]   = useState(undefined) // undefined=auto, null=mains nues, id=choix
  // Arme naturelle (mutation) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Exclusif avec
  // selectedMeleeWeaponId (un seul choix radio) : sélectionner l'un remet l'autre à null.
  const [naturalWeapons, setNaturalWeapons]                 = useState([])
  const [selectedMeleeNaturalWeaponId, setSelectedMeleeNaturalWeaponId] = useState(null)
  const [inMeleeTargetMode, setInMeleeTargetMode]           = useState(false)
  const [iniPopoverOpen, setIniPopoverOpen]                 = useState(false)

  // --- roster PJ collapsible ------------------------------------------------
  const [rosterOpen, setRosterOpen] = useState(
    () => localStorage.getItem('pj-roster-open') !== 'false'
  )

  // --- draggable (déplacé ici pour respecter l'ordre des hooks) -------------
  const { pos, onHeaderMouseDown } = useDraggable(
    'combat-action-pos',
    { top: Math.max(80, window.innerHeight - 760), left: window.innerWidth / 2 - 360 },
    720,
  )

  const droneDeclare = useDroneDeclare({
    charId:           playerToken?.character_id ?? null,
    tokenId:          playerToken?.id ?? null,
    allures,
    onEnterMoveMode,
    onEnterTargetMode,
  })

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
    dispatch({ type: 'RESET', payload: { ...snap } })
    setMapSelected(new Set())
    setAssaultPendingTokenId(null)
    setAssaultBulletCount(null)
    setAssaultVariantAB('A')
    setIsDualWield(false)
    setMoveSelection(null)
    setSelectedAmmoId(null)
    setMeleePendingTokenIds([])
    setSelectedMeleeWeaponId(undefined)
    setInMeleeTargetMode(false)
    setIniPopoverOpen(false)
  }, [rosterEntry?.token_id])

  // --- fetch allures — suit le token actif du joueur -----------------------
  useEffect(() => {
    const charId = playerToken?.character_id
    if (!charId) return
    let cancelled = false
    const load = async () => {
      try {
        const [sheetRes, genoRes] = await Promise.all([
          api.get(`/char-sheet/${charId}`),
          api.get('/char-ref/genotypes'),
        ])
        if (cancelled) return
        const { archetype, attributes, skills, mutationEffects } = sheetRes.data
        const genotype = genoRes.data.genotypes?.find(g => g.id === archetype?.genotype_id) || null
        const findAttr = (id) => attributes?.find(a => a.attr_id === id)
        const attrNA = (id) => calcNA(
          findAttr(id)?.base_level,
          findAttr(id)?.pc_modifier,
          getGenotypeModForAttr(genotype, id),
          getMutationModForAttr(mutationEffects, id)
        )
        const coo_na = attrNA('COO')
        const for_na = attrNA('FOR')
        const mastery = skills?.find(s => s.skill_id === 'ATHLETISME')?.mastery ?? 0
        const athletisme_total = calcAN(for_na) + calcAN(coo_na) + mastery
        if (!cancelled) setAllures(calcAllures(coo_na, athletisme_total))
      } catch (e) {
        console.error('[CombatActionWindow] erreur fetch allures :', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [playerToken?.id])

  // --- écoute COMBAT_DECLARE_ERROR — message temporaire (3s) ---------------
  useEffect(() => {
    if (!socket) return
    const handler = ({ message }) => {
      setDeclareError(message)
      setTimeout(() => setDeclareError(null), 4000)
    }
    socket.on(WS.COMBAT_DECLARE_ERROR, handler)
    return () => socket.off(WS.COMBAT_DECLARE_ERROR, handler)
  }, [socket])

  // --- reset sélections au nouveau tour (has_announced true → false) --------
  useEffect(() => {
    if (!rosterEntry) return
    const wasAnnounced = prevHasAnnouncedRef.current
    const isAnnounced  = rosterEntry.has_announced ?? false
    prevHasAnnouncedRef.current = isAnnounced
    if (wasAnnounced && !isAnnounced) {
      dispatch({ type: 'RESET_NEW_TURN' })
      setMapSelected(new Set())
      setAssaultPendingTokenId(null)
      setAssaultBulletCount(null)
      setAssaultVariantAB('A')
      setIsDualWield(false)
      setMoveSelection(null)
      setSelectedAmmoId(null)
      setMeleePendingTokenIds([])
      setSelectedMeleeWeaponId(undefined)
      setInMeleeTargetMode(false)
    }
  }, [rosterEntry?.has_announced])

  // --- fetch armes equipees + inventaire complet (humanoïdes uniquement) ----
  useEffect(() => {
    const charId = playerToken?.character_id
    if (!charId || isDrone) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/inventory`).then(res => {
      if (cancelled) return
      const items = res.data.items || []
      setAssaultWeapons(items.filter(
        item => (item.slot === 'MG' || item.slot === 'MD') && item.ref_fire_mode
      ))
      setAllInventoryItems(items)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isDrone, playerToken?.id, phase])

  // --- fetch mutations (armes naturelles) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B ------------
  useEffect(() => {
    const charId = playerToken?.character_id
    if (!charId || isDrone) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/mutations`).then(res => {
      if (cancelled) return
      const mutations = res.data.mutations || []
      setNaturalWeapons(mutations.filter(m => m.natural_weapon_formula != null))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isDrone, playerToken?.id, phase])

  // Reset fire_mode au premier mode disponible si l'arme chargée ne le supporte pas
  useEffect(() => {
    const wMg = assaultWeapons.find(w => w.slot === 'MG') || null
    const wMd = assaultWeapons.find(w => w.slot === 'MD') || null
    const selected = wMg || wMd
    if (!selected) return
    const forceCCNow = !!(wMg && wMd) && wMg.ref_fire_mode !== wMd.ref_fire_mode
    const modes = forceCCNow
      ? ['cc']
      : (selected.ref_fire_mode || 'cc').split('/').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (!modes.includes(decl.fire_mode))
      dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })
  }, [assaultWeapons])


  // --- preview GM en temps réel (debounce 150ms) ---------------------------
  // Émet COMBAT_ANNOUNCE_PREVIEW à la room quand le joueur modifie ses sélections.
  // Dépendances : toutes les sélections qui constituent une déclaration.
  useEffect(() => {
    if (!socket || phase !== 'ANNOUNCEMENT') return
    if (!playerTokensInRoster.some(t => t.id === activeTokenId)) return
    const tokenId = activeTokenId
    const timer = setTimeout(() => {
      socket.emit(WS.COMBAT_ANNOUNCE_PREVIEW, {
        tokenId,
        actions:         [...mapSelected],
        assaultTargetId: assaultPendingTokenId ?? null,
        meleeTargetIds:  [...meleePendingTokenIds],
        moveDestination: moveSelection
          ? { x: moveSelection.targetPosX, y: moveSelection.targetPosY }
          : null,
        combatMode: decl.combatMode,
      })
    }, 150)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, phase, activeTokenId, mapSelected, assaultPendingTokenId, meleePendingTokenIds, moveSelection, decl.combatMode])

  if (playerTokensInRoster.length === 0) return null

  // --- derives resolution --------------------------------------------------
  const sorted = [...roster].sort((a, b) => b.initiative - a.initiative)
  const resolveSlotTid = phase === 'RESOLUTION' ? sorted[activeSlotIdx]?.token_id : null
  const isMyTurnInResolution = resolveSlotTid != null
    && playerTokensInRoster.some(t => t.id === resolveSlotTid)

  // --- derive announce : mon tour si activeTokenId correspond à l'un de mes tokens ---
  // Fallback : calcul depuis le roster si activeTokenId pas encore reçu (race condition COMBAT_SLOT_ADVANCED)
  const computedAnnounceTokenId = activeTokenId ?? (
    phase === 'ANNOUNCEMENT'
      ? [...roster]
          .filter(r => !r.has_announced && r.status === 'active')
          .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
      : null
  )
  const isMyTurnInAnnouncement = phase === 'ANNOUNCEMENT'
    && computedAnnounceTokenId != null
    && playerTokensInRoster.some(t => t.id === computedAnnounceTokenId)
    && !rosterEntry?.has_announced
  const myActions = actions.filter(a => playerTokensInRoster.some(t => t.id === a.token_id)
    && (resolveSlotTid ? a.token_id === resolveSlotTid : a.token_id === playerToken?.id)
  )

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

  const fireModeUpper = decl.fire_mode.toUpperCase()
  const currentFireMode = forceCC ? 'CC' : fireModeUpper

  // Variant assaut selectionne
  const { variant: currentVariant, effectiveBulletCount } = computeFireVariant(
    currentFireMode, assaultBulletCount, assaultVariantAB, { defaultCcCount: 1 }
  )

  // Munitions disponibles pour le rechargement — filtrées par calibre de l'arme sélectionnée
  const reloadAmmoItems = (selectedWeapon?.ref_caliber && allInventoryItems.length)
    ? allInventoryItems.filter(item =>
        item.ref_caliber === selectedWeapon.ref_caliber &&
        !item.slot &&
        item.container !== 'Coffre'
      )
    : []

  // Ammo state — ammo_remaining null = jamais chargée (traité comme vide)
  const ammoRemaining = selectedWeapon?.ammo_remaining ?? null
  const ammoCount     = selectedWeapon?.ref_ammo_count ?? null
  const isAmmoEmpty   = !selectedWeapon || (ammoRemaining !== null && ammoRemaining <= 0)
  const isAmmoFull    = !!selectedWeapon && ammoCount !== null && ammoRemaining !== null && ammoRemaining >= ammoCount

  const dualWieldBonusComp = (isDualWield && hasTwoWeapons && sameFirMode)
    ? (currentFireMode === 'RL' ? 5 : 3)
    : 0

  const pendingTargetToken = assaultPendingTokenId
    ? tokens.find(t => t.id === assaultPendingTokenId)
    : null

  const attackSelected = mapSelected.has('attack')
  const meleeSelected  = mapSelected.has('melee')
  const meleeDefensif  = decl.combatMode === 'defensif' || decl.combatMode === 'retraite'
  const weaponLocked   = attackSelected || meleeSelected

  // Armes de contact équipées (slots MG/MD/2M, catégorie 'Arme de contact')
  const meleeWeapons = allInventoryItems.filter(item =>
    (item.slot === 'MG' || item.slot === 'MD' || item.slot === '2M') &&
    item.ref_category === 'Arme de contact'
  )
  // undefined=auto, null=mains nues explicite, id=choix explicite
  const effectiveMeleeWeaponId = decl.weapon !== 'drawn'
    ? null
    : selectedMeleeWeaponId === undefined
      ? (meleeWeapons[0]?.id ?? null)
      : selectedMeleeWeaponId
  // Arme naturelle — jamais auto-sélectionnée (contrairement à l'arme d'inventaire ci-dessus),
  // choix explicite uniquement, mutuellement exclusive avec effectiveMeleeWeaponId (géré dans
  // onWeaponChange du MeleeCombatPanel, docs/PLAN_MUTATION2.md Lot 4 sous-lot B).
  const effectiveMeleeNaturalWeaponId = selectedMeleeNaturalWeaponId
  // Armes de contact en inventaire (tous slots/containers) — pour message d'état
  const hasMeleeInInventory = allInventoryItems.some(item => item.ref_category === 'Arme de contact')

  const handleMapToggle = (k) => {
    setMapSelected(prev => {
      const next = new Set(prev)

      if (next.has(k)) {
        // Désélection
        next.delete(k)
        if (k === 'attack') {
          setAssaultPendingTokenId(null)
          setAssaultBulletCount(null)
          setAssaultVariantAB('A')
          setIsDualWield(false)
          setAimTranches(0)
          setInTargetMode(false)
        }
        if (k === 'melee') {
          setMeleePendingTokenIds([])
          setMeleeCount(1)
          setSelectedMeleeWeaponId(undefined)
          setInMeleeTargetMode(false)
          if (decl.combatMode === 'retraite' || decl.combatMode === 'charge') setMoveSelection(null)
          dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
        }
        if (k === 'move') setMoveSelection(null)
        if (k === 'reload') setSelectedAmmoId(null)
      } else {
        next.add(k)
        if (k === 'attack') dispatch({ type: 'SELECT_ATTACK' })
      }

      return next
    })
  }

  // --- deplacement zone select ---------------------------------------------
  const handleZoneSelectClick = () => {
    if (moveSelection) { setMoveSelection(null); return }
    if (!allures) return
    setInMoveMode(true)
    setMoveSelection(null)
    const effectiveAllures = isStunned ? { lente: allures.lente, moyenne: allures.moyenne } : allures
    onEnterMoveMode(
      effectiveAllures, playerToken.id,
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
  const reloadSelected = mapSelected.has('reload')
  const mapActionsObj = {
    move:   moveSelection ? { ini_mod: (decl.combatMode === 'charge' || decl.combatMode === 'retraite') ? 0 : moveSelection.ini_mod } : null,
    attack: attackSelected ? { cover_shot: !!(attackSelected && decl.cover !== 'exposed'), aimTranches } : null,
    // Défensif/Retraite : pas d'action d'attaque → pas de coût INI melee
    // Charge : toujours 1 attaque (exclusive multi-attack LdB)
    melee:  (meleeSelected && !meleeDefensif)
      ? Array(decl.combatMode === 'charge' ? 1 : meleeCount).fill({ targetTokenId: null, weaponInvId: null })
      : null,
    reload: reloadSelected ? {} : null,
  }
  const iniDelta = calcIniDelta(initialStates.current, decl, mapActionsObj, decl.quick)
  const iniBreakdown = calcIniBreakdown(initialStates.current, decl, mapActionsObj, decl.quick)
  const iniTotal = (rosterEntry.initiative ?? 0) - iniDelta // initiative decremente par les couts

  // Tir visé — éligibilité recalculée à chaque rendu, source unique shared/combatExclusiveActions.js
  // (même évaluateur que le serveur — retour visuel immédiat, jamais d'aller-retour pour ce feedback)
  const aimIneligibilityReasons = getAimIneligibilityReasons({
    mapActions: mapActionsObj, state: decl, quick: decl.quick, entry: rosterEntry,
    isDualWield, bulletCount: effectiveBulletCount ?? null,
  })

  // --- validite declaration ------------------------------------------------
  const assaultValid = !attackSelected || (
    assaultWeaponId != null &&
    assaultPendingTokenId != null &&
    currentVariant != null &&
    (aimTranches === 0 || aimIneligibilityReasons.length === 0)
  )
  const reloadValid    = !reloadSelected || attackSelected || (selectedWeapon !== null && selectedAmmoId !== null)
  const effectiveMeleeCount = decl.combatMode === 'charge' ? 1 : meleeCount
  const meleeValid     = !meleeSelected  || (
    meleeDefensif ||
    (meleePendingTokenIds.length >= effectiveMeleeCount && (decl.combatMode !== 'charge' || moveSelection != null))
  )
  const hasAnyAction = mapSelected.size > 0 || moveSelection !== null
    || decl.quick.observer > 0 || decl.quick.reperer > 0 || decl.quick.phrase
    || Object.keys(initialStates.current).some(k => decl[k] !== initialStates.current[k])

  // Comparer états tactiques vs initial (P-R06-11 : Object.keys(initialStates.current) — 5 clés, pas 7)
  const stateChanged = Object.keys(initialStates.current).some(k => decl[k] !== initialStates.current[k])
  const canDeclare = isDrone
    ? droneDeclare.canDeclare
    : ((hasAnyAction || stateChanged) && assaultValid && reloadValid && meleeValid)

  // --- emit declaration ----------------------------------------------------
  const handleDeclare = () => {
    if (!socket || !playerToken || !canDeclare) return

    // Drone : payload complet via hook
    if (isDrone) {
      const { stateFireMode, mapActions } = droneDeclare.buildMapActions()
      socket.emit(WS.COMBAT_ACTION_DECLARE, {
        tokenId: playerToken.id,
        state: { position: 'standing', weapon: 'holstered', fire_mode: stateFireMode, cover: 'exposed', vitesse: 'normal' },
        mapActions,
      })
      return
    }

    socket.emit(WS.COMBAT_ACTION_DECLARE, {
      tokenId: playerToken.id,
      state: {
        position:    decl.position,
        weapon:      decl.weapon,
        fire_mode:   decl.fire_mode,
        cover:       decl.cover,
        vitesse:     decl.vitesse,
        combat_mode: decl.combatMode,
      },
      mapActions: {
        move:   moveSelection
          ? { targetPosX: moveSelection.targetPosX, targetPosY: moveSelection.targetPosY,
              targetPosZ: moveSelection.targetPosZ ?? 0,
              // Charge/Retraite : déplacement gratuit → ini_mod forcé à 0 côté client (confirmé serveur)
              ini_mod: (decl.combatMode === 'charge' || decl.combatMode === 'retraite') ? 0 : moveSelection.ini_mod,
              action_key: moveSelection.action_key }
          : null,
        attack: attackSelected ? {
          weaponInvId:        assaultWeaponId,
          targetTokenId:      assaultPendingTokenId,
          bulletCount:        currentVariant?.bulletCount ?? null,
          fireModeBonusComp:  currentVariant ? (currentVariant.bonusComp + dualWieldBonusComp) : null,
          fireModeBonusDmg:   currentVariant?.bonusDmg ?? null,
          isDualWield:        isDualWield && hasTwoWeapons && sameFirMode,
          dualWieldBonusComp: dualWieldBonusComp,
          cover_shot:         decl.cover !== 'exposed',
          aimTranches:        aimTranches,
        } : null,
        // Défensif/Retraite : pas de cible — mode passif, bonus appliqué via state_combat_mode
        melee:    (meleeSelected && !meleeDefensif)
          ? meleePendingTokenIds.slice(0, effectiveMeleeCount).map(id => ({
              targetTokenId: id,
              weaponInvId:   effectiveMeleeWeaponId,
              naturalWeaponCharMutationId: effectiveMeleeNaturalWeaponId,
            }))
          : null,
        reload:   reloadSelected ? { weapon_inv_id: selectedWeapon?.id ?? null, ammo_item_id: selectedAmmoId } : false,
        multi:    false,
        interact: mapSelected.has('interact'),
      },
      quick: {
        observer: decl.quick.observer,
        reperer:  decl.quick.reperer,
        phrase:   decl.quick.phrase,
      },
    })
  }

  // =========================================================================
  // RENDU — Surprise
  // =========================================================================
  if (pendingSurpriseRoll?.tokenId && playerTokensInRoster.some(t => t.id === pendingSurpriseRoll.tokenId)) {
    return (
      <div className="combat-float-win" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Surprise !</div>
        <p style={W.surpriseText}>Vous etes surpris. Lancez 1d20 pour determiner votre initiative.</p>
        <button style={W.btnRoll} onClick={onSurpriseRolled}>Lancer le de d&apos;initiative</button>
      </div>
    )
  }
  if (rosterEntry.is_surprised && rosterEntry.has_announced && rosterEntry.initiative === 0) {
    return (
      <div className="combat-float-win" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Surprise !</div>
        <p style={W.surpriseText}>Vous etes surpris — vous ne pouvez pas agir ce tour.</p>
      </div>
    )
  }

  // =========================================================================
  // RENDU — Phase Résolution (mon tour)
  // =========================================================================
  if (isMyTurnInResolution) {
    const myAssaultAction = myActions.find(a => a.action_key === 'assault')
    const myReloadAction  = myActions.find(a => a.action_key === 'reload')
    const myMeleeActions  = myActions.filter(a => a.action_key === 'melee')
    const myMeleeAction   = myMeleeActions[0] ?? null
    const cibleToken = myAssaultAction ? tokens.find(t => t.id === myAssaultAction.target_token_id) : null
    const meleeCibleTokens = myMeleeActions.map(a => tokens.find(t => t.id === a.target_token_id) ?? null)
    const isRushed = rosterEntry.state_vitesse === 'rushed'
    return (
      <div className="combat-float-win" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Phase 2 - Resolution</div>
        <div className="combat-win-body">
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
        <div className="combat-float-footer">
          {myAssaultAction ? (
            <div style={{ color: '#7070a0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>
              En attente de validation GM…
            </div>
          ) : myReloadAction ? (
            <div style={{ color: '#7070a0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>
              Rechargement — en attente du MJ…
            </div>
          ) : (
            <button className="btn-tac" onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: playerToken.id })}>
              Agir
            </button>
          )}
        </div>
      </div>
    )
  }

  // Section roster PJ — collapsible, présente dans tous les états
  const rosterSection = (
    <div style={{ borderBottom: '1px solid #2a2a3e' }}>
      <div
        style={{ ...W.rosterHeader }}
        onClick={() => {
          const next = !rosterOpen
          setRosterOpen(next)
          localStorage.setItem('pj-roster-open', next ? 'true' : 'false')
        }}
      >
        <span style={W.rosterTitle}>Mes personnages ({playerTokensInRoster.length})</span>
        <span style={{ fontSize: 10, color: '#5b5b7a', cursor: 'pointer' }}>{rosterOpen ? '▲' : '▼'}</span>
      </div>
      {rosterOpen && (
        <div>
          {playerTokensInRoster.map(tok => {
            const entry    = roster.find(r => r.token_id === tok.id)
            const isActive = tok.id === (resolveSlotTid ?? computedAnnounceTokenId)
            const isDone   = entry?.has_announced ?? false
            return (
              <div key={tok.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px',
                borderBottom: '1px solid #1e1e2e',
                opacity: isDone ? 0.5 : 1,
                background: isActive ? 'rgba(91,141,238,0.07)' : 'transparent',
              }}>
                <span style={{ fontSize: 9, color: isActive ? '#5b8dee' : '#456575', minWidth: 10 }}>
                  {isDone ? '✓' : (isActive ? '▶' : '○')}
                </span>
                <span style={{ fontSize: 10, color: '#c0c0d0', flex: 1 }}>{tok.label}</span>
                <span style={{ fontSize: 9, color: '#456575', fontFamily: 'monospace' }}>
                  INI {entry?.initiative ?? '?'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // Pas encore mon tour d'annoncer — attente du slot actuel
  if (phase === 'ANNOUNCEMENT' && !(rosterEntry?.has_announced) && !isMyTurnInAnnouncement) {
    const currentDeclarer = tokens.find(t => t.id === computedAnnounceTokenId)
    return (
      <div className="combat-float-win" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Phase 1 — Déclaration d&apos;intention</div>
        <p style={W.waitText}>
          En attente de {currentDeclarer?.label ?? '…'}…
        </p>
      </div>
    )
  }

  // Phase 2 — résolution en cours, pas encore mon slot actif
  if (phase === 'RESOLUTION' && !isMyTurnInResolution) {
    const activeResolveToken = tokens.find(t => t.id === resolveSlotTid)
    return (
      <div className="combat-float-win" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Phase 2 — Résolution</div>
        <p style={W.waitText}>
          {activeResolveToken ? `${activeResolveToken.label} agit…` : 'Résolution en cours…'}
        </p>
      </div>
    )
  }

  // Déjà déclaré (ANNOUNCEMENT)
  if (rosterEntry?.has_announced) {
    return (
      <div className="combat-float-win" style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Phase 1 - Declaration d&apos;intention</div>
        <p style={W.waitText}>Action declaree. En attente des autres participants…</p>
      </div>
    )
  }

  // --- choix cible melee ---------------------------------------------------
  const handleChooseMeleeTarget = (targetIndex) => {
    setInMeleeTargetMode(true)
    onEnterTargetMode(
      playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (tokenId) => {
        setMeleePendingTokenIds(prev => {
          const next = [...prev]
          next[targetIndex] = tokenId
          return next
        })
        setInMeleeTargetMode(false)
      },
      () => { setInMeleeTargetMode(false) },
      'melee'
    )
  }

  // --- Retraite : déplacement gratuit optionnel (toggle) ----------------------
  const handleRetraiteMove = () => {
    if (moveSelection) { setMoveSelection(null); return }
    if (!allures) return
    setInMoveMode(true)
    const retraiteAllures = { lente: allures.lente, moyenne: allures.lente, rapide: allures.lente, max: allures.lente }
    onEnterMoveMode(
      retraiteAllures, playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (sel) => { setMoveSelection({ ...sel, ini_mod: 0 }); setInMoveMode(false) },
      () => { setInMoveMode(false) }
    )
  }

  // --- Charge : move_short gratuit → chaîne automatiquement la sélection cible CaC ---
  const handleChargeFlow = () => {
    dispatch({ type: 'SET_COMBAT_MODE', mode: 'charge' })
    // Bug B : nettoyer tout déplacement normal pré-existant
    setMoveSelection(null)
    setMapSelected(prev => { const n = new Set(prev); n.delete('move'); return n })
    if (!allures) return
    setInMoveMode(true)
    // Charge : limiter visuellement à la zone lente (déplacement court) uniquement
    const chargeAllures = { lente: allures.lente, moyenne: allures.lente, rapide: allures.lente, max: allures.lente }
    onEnterMoveMode(
      chargeAllures, playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (sel) => {
        // Move sélectionné : ini_mod = 0 (gratuit pour Charge)
        setMoveSelection({ ...sel, ini_mod: 0 })
        setInMoveMode(false)
        // Chaîner automatiquement la sélection de cible CaC (Charge = 1 cible toujours)
        setInMeleeTargetMode(true)
        setMeleePendingTokenIds([])
        onEnterTargetMode(
          playerToken.id,
          { x: playerToken.pos_x, z: playerToken.pos_y },
          (tid) => { setMeleePendingTokenIds([tid]); setInMeleeTargetMode(false) },
          () => { setInMeleeTargetMode(false) },
          'melee'
        )
      },
      () => { setInMoveMode(false); dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' }) }
    )
  }

  const isHidden    = inMoveMode || inTargetMode || inMeleeTargetMode || droneDeclare.isSelectingOnMap
  const showAssault = attackSelected
  const showReload  = reloadSelected && !showAssault
  const showMelee   = meleeSelected  && !showAssault && !showReload

  // CC slider index
  const ccSliderIdx = assaultBulletCount && assaultBulletCount !== 1
    ? CC_REPS_STEPS.indexOf(assaultBulletCount)
    : 0
  const ccSliderDisplayIdx = ccSliderIdx === -1 ? 0 : ccSliderIdx

  // =========================================================================
  // RENDU — Phase Annonce
  // =========================================================================
  return (
    <div className="combat-float-win" style={{
      position: 'fixed',
      width: (showAssault || showReload || showMelee) ? 720 : 360,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden ? 'none' : 'auto',
      left: pos.left,
      top: pos.top,
      maxHeight: 'calc(100vh - 80px)',
    }}>
      <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>Phase 1 — Déclaration d&apos;intention</div>

      <div className="combat-win-body">
        {/* ---- Panneau gauche ---- */}
        <div style={W.leftPanel}>

          {/* TACTIQUE */}
          <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
            <div style={W.sectionTitle}>TACTIQUE</div>
            {!isDrone && (
              <StateSelector
                stateKey="position" def={STATE_DEFS.position}
                current={decl.position} initial={initialStates.current.position}
                onChange={v => dispatch({ type: 'SET_FIELD', key: 'position', value: v })}
              />
            )}
            <StateSelector
              stateKey="cover" def={STATE_DEFS.cover}
              current={decl.cover} initial={initialStates.current.cover}
              onChange={v => dispatch({ type: 'SET_FIELD', key: 'cover', value: v })}
            />
            {!isDrone && (
              <StateSelector
                stateKey="vitesse" def={STATE_DEFS.vitesse}
                current={decl.vitesse} initial={initialStates.current.vitesse}
                onChange={v => dispatch({ type: 'SET_FIELD', key: 'vitesse', value: v })}
              />
            )}
          </div>

          {/* ARMEMENT */}
          {!isDrone && (
            <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
              <div style={W.sectionTitle}>ARMEMENT</div>
              <StateSelector
                stateKey="weapon" def={STATE_DEFS.weapon}
                current={decl.weapon} initial={initialStates.current.weapon}
                onChange={v => dispatch({ type: 'SET_FIELD', key: 'weapon', value: v })}
                disabled={weaponLocked}
                highlightKey={decl.weapon !== 'drawn' ? 'drawn' : undefined}
              />
              <StateSelector
                stateKey="fire_mode" def={STATE_DEFS.fire_mode}
                current={decl.fire_mode} initial={initialStates.current.fire_mode}
                onChange={v => dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: v })}
                availableKeys={availableFireModes}
              />
            </div>
          )}

          {/* ACTION */}
          <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
            <div style={W.sectionTitle}>ACTION</div>
            {isDrone
              ? <DroneDeclareSection
                  pendingMove={droneDeclare.pendingMove}
                  onMoveToggle={() => droneDeclare.pendingMove ? droneDeclare.clearPendingMove() : droneDeclare.handleStartMove(playerToken)}
                  hasPassed={droneDeclare.hasPassed}
                  onPassToggle={() => droneDeclare.setHasPassed(p => !p)}
                  droneWeapons={droneDeclare.droneWeapons}
                  selectedWeaponId={droneDeclare.selectedDroneWeaponId}
                  onWeaponSelect={droneDeclare.setSelectedDroneWeaponId}
                  assaultTargetId={droneDeclare.assaultTargetId}
                  onChooseTarget={() => droneDeclare.handleChooseTarget(playerToken)}
                  getLabel={(id) => tokens.find(t => t.id === id)?.label ?? '?'}
                />
              : <div style={W.itemsGrid}>
              {MAP_ACTIONS.map(a => {
                const isActive = mapSelected.has(a.k)
                const span2    = a.span2 ? { gridColumn: 'span 2' } : {}

                // Assaut/CaC grisé si assommé
                if ((a.k === 'attack' || a.k === 'melee') && isStunned) {
                  return (
                    <div key={a.k} title="Assommé — −5 à toutes les actions, allure max = Moyenne, ne peut pas attaquer" style={W.itemGreyed}>
                      <span style={W.itemLabel}>{a.l} ☠</span>
                    </div>
                  )
                }

                // Assaut grisé dynamiquement si arme vide
                if (a.k === 'attack' && isAmmoEmpty) {
                  return (
                    <div key={a.k} title="Arme vide — rechargez d'abord" style={{ ...W.itemGreyed, cursor: 'pointer' }} onClick={() => handleMapToggle(a.k)}>
                      <span style={W.itemLabel}>{a.l}</span>
                    </div>
                  )
                }

                // Rechargement — label dynamique, grisé si plein ou sans arme
                if (a.k === 'reload') {
                  const reloadLabel = selectedWeapon && ammoCount !== null
                    ? `Rechargement ${ammoRemaining ?? 0}/${ammoCount}`
                    : 'Recharger'
                  if (isAmmoFull || !selectedWeapon) {
                    return (
                      <div key={a.k} title={a.tooltip} style={{ ...W.itemGreyed, ...span2 }}>
                        <span style={W.itemLabel}>{reloadLabel}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={a.k} title={a.tooltip}
                      style={{ ...W.item, ...(isActive ? W.itemSelected : {}), ...span2 }}
                      onClick={() => handleMapToggle(a.k)}
                    >
                      <span style={W.itemLabel}>{reloadLabel}</span>
                    </div>
                  )
                }

                // Statiquement désactivé (multi, interact)
                if (a.active === false) {
                  return (
                    <div key={a.k} title={a.tooltip} style={{ ...W.itemGreyed, ...span2 }}>
                      <span style={W.itemLabel}>{a.l}</span>
                      {a.ini && <span style={W.itemMod}>{a.ini}</span>}
                    </div>
                  )
                }

                // Déplacement (zone select)
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
                        ...span2,
                        ...(!canActivate ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                      }}
                      onClick={() => {
                        if (!canActivate) return
                        // Bug A : Charge/Retraite gèrent le déplacement internalement — chip 'move' inerte
                        if (decl.combatMode === 'charge' || decl.combatMode === 'retraite') return
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

                // Défaut
                return (
                  <div
                    key={a.k}
                    title={a.tooltip}
                    style={{ ...W.item, ...(isActive ? W.itemSelected : {}), ...span2 }}
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
            }

            {/* Toggle cover_shot conditionnel (assault + cover != exposed) */}
            {!isDrone && attackSelected && decl.cover !== 'exposed' && (
              <div
                style={{
                  ...W.item,
                  gridColumn: 'span 2',
                  marginTop: 4,
                  background: 'rgba(180,80,80,0.08)',
                  borderColor: '#c05050',
                }}
                onClick={() => {/* toggle gere via decl.cover dans le payload */}}
              >
                <span style={{ ...W.itemLabel, color: '#e07070' }}>Tirer depuis ma couverture</span>
                <span style={{ ...W.itemMod, color: '#e07070' }}>
                  {decl.cover === 'important' ? '-5' : '-3'}
                </span>
              </div>
            )}
          </div>

          {/* ACTIONS RAPIDES */}
          {!isDrone && (
          <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
            <div style={W.sectionTitle}>ACTIONS RAPIDES</div>
            {QUICK_ACTIONS.map(a => {
              const isFixed = a.kind === 'fixed'
              const val     = isFixed ? decl.quick.phrase : (decl.quick[a.k] ?? 0)
              const isActive = isFixed ? !!val : val > 0
              const cost    = isFixed ? a.ini : (val * a.stepIni)
              return (
                <div key={a.k} title={a.tooltip} style={{ borderBottom: '1px solid #1a1a2a' }}>
                  <div
                    style={{ ...W.item, gridColumn: 'span 2' }}
                    onClick={() => {
                      if (isFixed) {
                        dispatch({ type: 'SET_QUICK', key: 'phrase', value: !decl.quick.phrase })
                      } else {
                        dispatch({ type: 'SET_QUICK', key: a.k, value: decl.quick[a.k] > 0 ? 0 : 1 })
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
                        onChange={e => dispatch({ type: 'SET_QUICK', key: a.k, value: parseInt(e.target.value) })}
                      />
                      <span style={{ fontSize: 9, color: '#456575' }}>{a.max}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#3a8aaa', minWidth: 22 }}>{val}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}

          {/* ---- Roster PJ (bas du panneau gauche) ---- */}
          {playerTokensInRoster.length > 1 && rosterSection}

        </div>

        {/* ---- Panneau droit — rechargement : sélection munitions ---- */}
        {showReload && (
          <div style={W.assaultPanel}>
            <div style={W.assaultSection}>
              <div style={W.assaultSectionTitle}>Arme</div>
              {selectedWeapon ? (
                <div style={W.assaultInfoText}>
                  {selectedWeapon.custom_name || selectedWeapon.ref_name || 'Arme'}
                  <span style={W.assaultInfoSub}> ({selectedWeapon.slot}) — {selectedWeapon.ref_caliber}</span>
                </div>
              ) : (
                <div style={W.assaultNoWeapon}>Aucune arme équipée (MG/MD)</div>
              )}
            </div>

            <div style={W.assaultSection}>
              <div style={W.assaultSectionTitle}>
                Munitions disponibles {selectedWeapon?.ref_caliber ? `— ${selectedWeapon.ref_caliber}` : ''}
              </div>
              {reloadAmmoItems.length === 0 ? (
                <div style={{ ...W.assaultNoWeapon, color: '#c83030' }}>
                  Aucune munition compatible dans le sac
                </div>
              ) : (
                reloadAmmoItems.map(item => {
                  const isSelected = item.id === selectedAmmoId
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAmmoId(isSelected ? null : item.id)}
                      style={{
                        ...W.assaultOption,
                        padding: '6px 0',
                        borderBottom: '1px solid #1e1e2e',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={W.assaultOptionLabel}>{item.custom_name || item.ref_name || 'Munition'}</div>
                        <div style={W.assaultOptionSub}>Qté : {item.quantity}</div>
                      </div>
                      <div style={{ ...W.assaultRadio, ...(isSelected ? W.assaultRadioActive : {}) }} />
                    </div>
                  )
                })
              )}
            </div>

            {selectedAmmoId && (
              <div style={{ padding: '8px 14px' }}>
                <div style={{ ...W.assaultSummaryText, color: '#3aaa6a' }}>
                  ✓ Munition sélectionnée
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- Panneau droit — corps à corps ---- */}
        {showMelee && (
          <div style={{ ...W.assaultPanel, background: 'rgba(80,180,80,0.04)' }}>
            <MeleeCombatPanel
              availableWeapons={meleeWeapons.map(item => ({
                id: item.id,
                label: item.custom_name || item.ref_name || 'Arme',
                slot: item.slot,
                damage: item.ref_damage_h || '—',
                allonge: parseInt(item.ref_range) || 0,
              }))}
              selectedWeaponId={effectiveMeleeWeaponId}
              isWeaponDrawn={decl.weapon === 'drawn'}
              hasMeleeInInventory={hasMeleeInInventory}
              onWeaponChange={(id) => { setSelectedMeleeWeaponId(id); setSelectedMeleeNaturalWeaponId(null) }}
              naturalWeapons={naturalWeapons.map(m => ({
                id: m.id, label: m.name,
                formula: m.natural_weapon_formula, requiresGrapple: m.natural_weapon_requires_grapple,
              }))}
              selectedNaturalWeaponId={effectiveMeleeNaturalWeaponId}
              onNaturalWeaponChange={(id) => { setSelectedMeleeNaturalWeaponId(id); setSelectedMeleeWeaponId(null) }}
              targetIsGrappled={
                tokens.find(t => t.id === meleePendingTokenIds[0])?.statuses?.includes('grappled') ?? false
              }
              combatMode={decl.combatMode}
              onModeChange={(mode) => {
                if (mode === 'defensif' || mode === 'retraite') {
                  dispatch({ type: 'SET_COMBAT_MODE', mode })
                  setMeleePendingTokenIds([])
                  if (decl.combatMode === 'charge') setMoveSelection(null)
                } else {
                  dispatch({ type: 'SET_COMBAT_MODE', mode })
                  if (decl.combatMode === 'charge') { setMoveSelection(null); setMeleePendingTokenIds([]) }
                }
              }}
              onStartCharge={handleChargeFlow}
              onStartRetraite={handleRetraiteMove}
              chargeMoveDest={moveSelection ?? null}
              chargeTargetLabel={null}
              meleeCount={meleeCount}
              effectiveMeleeCount={effectiveMeleeCount}
              onMeleeCountChange={(n) => { setMeleeCount(n); setMeleePendingTokenIds(prev => prev.slice(0, n)) }}
              perSlotTargeting={true}
              targetIds={meleePendingTokenIds}
              isInTargetMode={false}
              tokens={tokens}
              onChooseTarget={(i) => handleChooseMeleeTarget(i)}
              showReadyBadge={meleeValid && !meleeDefensif}
            />
          </div>
        )}

        {/* ---- Panneau droit — assaut humanoïde ---- */}
        {showAssault && !isDrone && (
          <div style={W.assaultPanel}>
            <AssaultRangedPanel
              weaponDisplay={selectedWeapon ? `${selectedWeapon.custom_name || selectedWeapon.ref_name || 'Arme'} (${selectedWeapon.slot})` : null}
              weaponMdDisplay={(hasTwoWeapons && weaponMd) ? `${weaponMd.custom_name || weaponMd.ref_name || 'Arme'} (${weaponMd.slot})` : null}
              assaultTargetId={assaultPendingTokenId}
              getLabel={(id) => tokens.find(t => t.id === id)?.label ?? '?'}
              onChooseTarget={handleChooseTarget}
              showDualWieldSection={hasTwoWeapons && sameFirMode}
              isDualWield={isDualWield}
              currentFireMode={currentFireMode}
              onDualWieldChange={(val) => setIsDualWield(val)}
              assaultBulletCount={assaultBulletCount}
              effectiveBulletCount={effectiveBulletCount ?? 1}
              assaultVariantAB={assaultVariantAB}
              ccSliderDisplayIdx={ccSliderDisplayIdx}
              currentVariant={currentVariant}
              dualWieldBonusComp={dualWieldBonusComp}
              onBulletCountChange={(count) => setAssaultBulletCount(count)}
              onVariantABChange={(ab) => setAssaultVariantAB(ab)}
              aimTranches={aimTranches}
              onAimTranchesChange={(n) => setAimTranches(n)}
              aimIneligibilityReasons={aimIneligibilityReasons}
            />
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="combat-float-footer">
        {declareError && (
          <div style={{ fontSize: 10, color: '#c83030', background: 'rgba(200,48,48,0.08)', border: '1px solid #c8303044', borderRadius: 3, padding: '4px 8px', marginBottom: 4 }}>
            ⚠ {declareError}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={W.footerLeft}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  ...W.totalMod,
                  color: iniDelta >= 0 ? '#3aaa6a' : (iniDelta < -10 ? '#c83030' : '#c86030'),
                  cursor: iniDelta !== 0 ? 'pointer' : 'default',
                }}
                onClick={() => iniDelta !== 0 && setIniPopoverOpen(o => !o)}
              >
                INI : {iniDelta >= 0 ? `+${iniDelta}` : iniDelta}
              </span>
              {iniPopoverOpen && iniDelta !== 0 && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 1998 }} onClick={() => setIniPopoverOpen(false)} />
                  <div className="ini-popover">
                    {iniBreakdown.map((l, i) => (
                      <div key={i} className="ini-popover-line">
                        <span className="ini-popover-label">{l.label}</span>
                        <span className={l.value >= 0 ? 'ini-bd-pos' : 'ini-bd-neg'}>
                          {l.value > 0 ? `+${l.value}` : l.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {moveSelection && (
              <span style={W.destination}>
                [{moveSelection.targetPosX}, {moveSelection.targetPosY}]
              </span>
            )}
          </div>
          <button
            className="btn-tac"
            style={{ opacity: canDeclare ? 1 : 0.4, cursor: canDeclare ? 'pointer' : 'not-allowed' }}
            onClick={handleDeclare}
            disabled={!canDeclare}
          >
            Declarer l&apos;action
          </button>
        </div>
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
    background: 'var(--combat-seg-bg)',
    border: '1px solid var(--combat-seg-border)',
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
    background: 'var(--combat-seg-active)',
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
    color: 'var(--combat-title)',
    display: 'block',
    marginTop: 1,
  },
}

// ===========================================================================
// Styles fenetre principale
// ===========================================================================
const W = {
  leftPanel: {
    flex: '0 0 360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    padding: '7px 10px 3px',
    fontSize: 8,
    fontWeight: 700,
    color: 'var(--combat-section)',
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
  surpriseText: {
    padding: '14px 14px 0',
    fontSize: 12,
    color: '#c0c0d0',
    lineHeight: '1.5',
    margin: 0,
  },
  rosterHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 12px', cursor: 'pointer', userSelect: 'none',
    background: '#0e0e1a',
  },
  rosterTitle: {
    fontSize: 8, letterSpacing: '0.1em', fontWeight: 700,
    color: '#456575', textTransform: 'uppercase',
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
  assaultSummaryText: {
    fontSize: 11,
    color: '#e07070',
    fontWeight: 600,
    fontStyle: 'italic',
  },
}
