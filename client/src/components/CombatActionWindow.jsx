import { useState, useEffect, useMemo, useRef, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { declarationReducer, DECLARATION_INITIAL, snapFromRosterEntry } from '../lib/declarationReducer'
import { useDraggable } from '../lib/useDraggable.js'
import { WS } from '../../../shared/events.js'
import {
  calcAN, calcAllures, calcNA, getGenotypeModForAttr, getMutationModForAttr,
} from '../../../shared/polarisUtils.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api.js'
import {
  QUICK_ACTIONS,
  calcIniDelta, calcIniBreakdown,
  CC_REPS_STEPS, RL_BUTTONS, computeFireVariant,
} from './combatSections.js'
import { getAimIneligibilityReasons, getMultiShotIneligibilityReasons } from '../../../shared/combatExclusiveActions.js'
import { flattenItemsBySlot, resolveHandWeapons } from '../../../shared/weaponSlots.js'
import { resolveMeleeReachM, resolveWeaponRangeBand, isShotgunSpreadWeapon } from '../../../shared/combatRange.js'
import { isTestBlockingWound, SEVERITY_COLORS } from '../../../shared/woundConstants.js'
import DroneWeaponPanel from './DroneWeaponPanel.jsx'
import { useDroneDeclare } from '../lib/useDroneDeclare.js'
import { useDroneMovementBudget } from '../lib/useDroneMovementBudget.js'
import { useAutoMoveMode } from '../lib/useAutoMoveMode.js'
import { useCombatClickAttack } from '../lib/useCombatClickAttack.js'
import DroneDeclareSection from './DroneDeclareSection.jsx'
import AssaultRangedPanel from './AssaultRangedPanel.jsx'
import MeleeCombatPanel from './MeleeCombatPanel.jsx'
import CombatDeclareActionList from './CombatDeclareActionList.jsx'
import CombatDeclareStatePanel from './CombatDeclareStatePanel.jsx'
import CombatDeclareHeader from './CombatDeclareHeader.jsx'
import CombatDeclareErrorBanner from './CombatDeclareErrorBanner.jsx'
import CombatDeclareFooter from './CombatDeclareFooter.jsx'
import { buildHumanDeclarePayload } from '../lib/buildDeclarePayload.js'
import { buildWeaponList } from '../lib/weaponList.js'
import { useAssaultDeclaration } from '../lib/useAssaultDeclaration.js'
import { useMeleeDeclaration } from '../lib/useMeleeDeclaration.js'
import { assaultCheck, meleeCheck, reloadCheck, buildBlockReason, hasSomethingToDeclare } from '../lib/declareChecks.js'
import { hasDeliberateStateChange } from '../lib/hasDeliberateStateChange.js'

// ---------------------------------------------------------------------------
export default function CombatActionWindow({
  socket, user, characters, pendingSurpriseRoll, onSurpriseRolled,
  onEnterMoveMode, combatMoveMode, pendingMoveSelection, combatTargetMode, onEnterTargetMode,
  combatAoeTargetMode, onEnterAoeTargetMode,
  battlemapId, registerAmbientAttackHandler, showTargetRecap,
}) {
  const { t } = useTranslation('combat')
  const { roster, phase, actions, activeTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  // Multi-personnage : tous les persos contrôlés par ce joueur
  const playerChars          = characters.filter(c => c.user_id === user?.id)
  const playerTokens         = tokens.filter(t => playerChars.some(c => c.id === t.character_id))
  // Seuls les tokens effectivement dans le roster de combat
  const playerTokensInRoster = playerTokens.filter(t => roster.some(r => r.token_id === t.id))

  // Token actif = le personnage du joueur qui occupe le slot courant (annonce ou résolution)
  const activeStoreToken = playerTokensInRoster.find(tk => tk.id === activeTokenId) ?? null
  // playerToken = actif si disponible, sinon premier dans le roster (pour les effets entre les tours)
  const playerToken = activeStoreToken ?? playerTokensInRoster[0] ?? null
  const playerChar  = playerToken ? playerChars.find(c => c.id === playerToken.character_id) ?? null : null
  const rosterEntry = playerToken ? roster.find(r => r.token_id === playerToken.id) : null
  const isStunned   = playerToken?.statuses?.includes('stunned') ?? false
  const isDrone     = playerChar?.type === 'drone'

  // Déclarant légitime — remonté ici (avant les hooks ambiants plus bas, même contrainte d'ordre des
  // hooks que useCombatClickAttack) pour ALLURE-TURNGATE1 (docs/BUGIDENTIFIE.md) : le survol
  // déplacement ne doit s'armer que si c'est réellement mon tour, jamais tout le temps. Ancien
  // emplacement de ce bloc retiré plus bas (§ derives resolution / derive announce), même contenu,
  // pas dupliqué.
  // docs/PLAN_COMBAT_TIMELINE.md Lot B — activeTokenId dérive de currentStep.tokenId.
  const resolveSlotTid = phase === 'RESOLUTION' ? activeTokenId : null
  const isMyTurnInResolution = resolveSlotTid != null
    && playerTokensInRoster.some(tk => tk.id === resolveSlotTid)
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
    && playerTokensInRoster.some(tk => tk.id === computedAnnounceTokenId)
    && !rosterEntry?.has_announced

  // CLICKATTACK-TURNGATE1 (docs/BUGIDENTIFIE.md) — source unique du "c'est mon tour", réutilisée par
  // les 3 hooks ambiants ci-dessous (useAutoMoveMode, useCombatClickAttack, moveHoverEnabled drone).
  // Avant ce correctif, ce ternaire n'était écrit qu'une fois (useAutoMoveMode, ALLURE-TURNGATE1) et
  // absent des deux autres — un seul calcul nommé élimine le risque de divergence future entre les 3.
  const isMyTurnToAct = phase === 'ANNOUNCEMENT' ? isMyTurnInAnnouncement : phase === 'RESOLUTION' && isMyTurnInResolution

  // --- etats tactiques partagés (useReducer) --------------------------------
  const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
  const prevHasAnnouncedRef    = useRef(false)  // détection nouveau tour (has_announced true→false)
  const prevTokenRef           = useRef(null)   // détection changement de slot actif
  const [mortallyWounded, setMortallyWounded] = useState(false)

  // --- actions sur la carte (multi-select) ----------------------------------
  const [mapSelected, setMapSelected] = useState(new Set())

  // --- sous-état de sélection Tir (M0.4) — reducer partagé PJ / MJ ----------
  // { weaponId, targets, count, bulletCount, variantAB, isDualWield, aimTranches, aimedLocation }
  // + mutations nommées + setTarget self-terminant. Alias en lecture ci-dessous pour ne pas toucher
  // les ~40 sites de lecture. Le hook ne se reset pas seul : `assaultDecl.clear()` dans l'effet de reset.
  const assaultDecl = useAssaultDeclaration()
  const {
    weaponId:     selectedRangedWeaponId,
    targets:      assaultPendingTokenIds,
    count:        assaultCount,
    bulletCount:  assaultBulletCount,
    variantAB:    assaultVariantAB,
    isDualWield,
    aimTranches,
    aimedLocation,
  } = assaultDecl.state

  // --- etat assaut (panneau droit) ------------------------------------------
  const [allures, setAllures]                     = useState(null)
  const [assaultWeapons, setAssaultWeapons]       = useState([])
  const [allInventoryItems, setAllInventoryItems] = useState([])
  const [selectedAmmoId, setSelectedAmmoId]       = useState(null)
  const [inMoveMode, setInMoveMode]               = useState(false)
  // --- etat assaut drone -------------------------------------------------------
  const [inTargetMode, setInTargetMode]           = useState(false)
  const [moveSelection, setMoveSelection]         = useState(null)

  // --- sous-état de sélection CaC (M0.4) — reducer partagé PJ / MJ ----------
  // { weaponId (undefined=auto / null=mains nues / id), naturalWeaponId, targets, count, isDualWield }
  // Alias en lecture ci-dessous. `meleeDecl.clear()` dans l'effet de reset. Le mode de combat
  // (decl.combatMode), la Charge et le flag ciblage carte restent à la fenêtre (M0.4-g).
  const [naturalWeapons, setNaturalWeapons]                 = useState([])
  const meleeDecl = useMeleeDeclaration()
  const {
    weaponId:        selectedMeleeWeaponId,
    naturalWeaponId: selectedMeleeNaturalWeaponId,
    targets:         meleePendingTokenIds,
    count:           meleeCount,
    isDualWield:     isDualWieldMelee,
    charge:          chargeSelection,   // { move, targetTokenId } | null — Charge (M0.4-g, forme MJ adoptée)
  } = meleeDecl.state
  const [inMeleeTargetMode, setInMeleeTargetMode]           = useState(false)

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

  // Drone : allures = sa Vitesse (m/Tour) servie par le serveur, jamais le calcAllures humanoïde
  // ci-dessous (qui reçoit des NaN pour un drone : pas de char_sheet). Vitesse absente → bannière.
  const { allures: droneAllures, error: droneAlluresError } = useDroneMovementBudget(
    playerToken?.character_id ?? null, isDrone,
  )

  const droneDeclare = useDroneDeclare({
    charId:           playerToken?.character_id ?? null,
    tokenId:          playerToken?.id ?? null,
    tokenPos:         playerToken ? { x: playerToken.pos_x, z: playerToken.pos_y } : null,
    allures:          isDrone ? droneAllures : allures,
    onEnterMoveMode,
    onEnterTargetMode,
    // CLICKATTACK-TURNGATE1 — flag partagé par le survol et le clic-attaque du drone (useDroneDeclare) :
    // corriger ici ferme les deux gaps en un seul endroit, pas besoin de séparer en deux flags distincts.
    moveHoverEnabled: isDrone && isMyTurnToAct,
    combatMoveMode,
    pendingMoveSelection,
    battlemapId,
    registerAmbientAttackHandler,
    showTargetRecap,
  })

  // Déplacement : survol/preview toujours actif par défaut, sans clic préalable sur la tuile
  // (décision Saar, COMBAT-DEPLACEMENT-HOVER) — suspendu pendant ciblage Attaque/CaC et pendant
  // Charge/Retraite (ces deux derniers gèrent leur propre entrée avec des allures restreintes).
  const effectiveAllures = useMemo(
    () => (isStunned && allures ? { lente: allures.lente, moyenne: allures.moyenne } : allures),
    [isStunned, allures],
  )
  const { rearm: rearmMove } = useAutoMoveMode({
    // ALLURE-TURNGATE1 (docs/BUGIDENTIFIE.md) — le survol ne s'arme que si c'est réellement mon tour
    // de déclarer/résoudre, jamais tout le temps (isMyTurnToAct, source unique ci-dessus).
    enabled: !isDrone && allures !== null && !inTargetMode && !inMeleeTargetMode &&
      decl.combatMode !== 'charge' && decl.combatMode !== 'retraite' && isMyTurnToAct,
    allures: effectiveAllures,
    tokenId: playerToken?.id ?? null,
    tokenPos: playerToken ? { x: playerToken.pos_x, z: playerToken.pos_y } : null,
    combatMoveMode,
    onEnterMoveMode,
    onMoveSelected: (sel) => setMoveSelection(sel),
    onCancel: () => {},
  })

  // --- clic direct sur un token adverse (sans tuile Attaque/CaC préalable) --
  // useCombatClickAttack.js — même patron/contrainte que useAutoMoveMode ci-dessus : appelé ici (avant
  // le early-return `playerTokensInRoster.length === 0` plus bas, Rules of Hooks) donc ne peut pas
  // référencer meleeWeapons/selectedWeapon/clearAttackState/clearMeleeState (calculés après ce point).
  // Dérivations dupliquées volontairement (meleeWeapons/selectedWeapon recalculés) plutôt que remonter
  // tout le bloc plus bas — patch ciblé, ne pas réordonner un fichier de 1500 lignes pour ça.
  const clickMeleeWeapons = allInventoryItems.filter(item =>
    (item.slots?.includes('MG') || item.slots?.includes('MD') || item.slots?.includes('2M')) &&
    item.ref_category === 'Arme de contact'
  )
  const { primaryWeapon: clickRangedWeapon } = resolveHandWeapons(assaultWeapons)
  const resolveClickAttackMode = (distanceM) => {
    const hasMelee = clickMeleeWeapons.length > 0
    if (!clickRangedWeapon) return { mode: 'melee', band: null }
    if (!hasMelee) return { mode: 'ranged', band: resolveWeaponRangeBand(distanceM, clickRangedWeapon.ref_range).band }
    if (distanceM <= resolveMeleeReachM(clickMeleeWeapons[0]?.ref_range)) return { mode: 'melee', band: null }
    return { mode: 'ranged', band: resolveWeaponRangeBand(distanceM, clickRangedWeapon.ref_range).band }
  }
  useCombatClickAttack({
    // CLICKATTACK-TURNGATE1 (docs/BUGIDENTIFIE.md) — même garde de tour que useAutoMoveMode
    // ci-dessus (isMyTurnToAct) : ce hook jumeau n'avait jamais reçu la contrainte de tour.
    enabled: !isDrone && allures !== null && !inTargetMode && !inMeleeTargetMode &&
      decl.combatMode !== 'charge' && decl.combatMode !== 'retraite' && isMyTurnToAct,
    battlemapId,
    tokenId: playerToken?.id ?? null,
    tokenPos: playerToken ? { x: playerToken.pos_x, z: playerToken.pos_y } : null,
    moveDestination: moveSelection
      ? { pos_x: moveSelection.targetPosX, pos_y: moveSelection.targetPosY, pos_z: moveSelection.targetPosZ ?? 0 }
      : null,
    resolveMode: resolveClickAttackMode,
    showTargetRecap,
    registerAmbientAttackHandler,
    // Réinitialisations manuelles (miroir clearAttackState/clearMeleeState, définies plus bas et
    // inaccessibles ici pour la même raison Rules of Hooks) — même liste de setters, ne pas diverger
    // si l'une des deux évolue.
    onMeleeTarget: (tid) => {
      dispatch({ type: 'SELECT_ATTACK' })
      setMapSelected(prev => { const n = new Set(prev); n.delete('attack'); n.add('melee'); return n })
      assaultDecl.clear(); setInTargetMode(false)
      meleeDecl.setSoleTarget(tid)
    },
    onAssaultTarget: (tid) => {
      dispatch({ type: 'SELECT_ATTACK' })
      setMapSelected(prev => { const n = new Set(prev); n.delete('melee'); n.add('attack'); return n })
      meleeDecl.clear(); setInMeleeTargetMode(false)
      if (decl.combatMode === 'retraite' || decl.combatMode === 'charge') setMoveSelection(null)
      dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
      assaultDecl.setSoleTarget(tid)
    },
  })

  // --- etats initiaux (reference debut de tour pour calcul delta) -----------
  const initialStates = useRef({
    position:  'standing',
    weapon:    'holstered',
    fire_mode: 'cc',
    cover:     'exposed',
    vitesse:   'normal',
  })
  // Reset complet de la déclaration — au changement de slot actif (`token_id`) OU au nouveau tour
  // (`has_announced` true→false, `endTurn` a remis state_position/cover/vitesse/combat_mode aux
  // défauts côté serveur). Un seul effet consolidé : avant le 2026-08-28 il y en avait deux
  // divergents (l'un sur token_id re-seedait tout, l'autre sur has_announced ne remettait que
  // combatMode+quick et ne touchait pas `initialStates`), d'où le bug Tir visé (transition d'état
  // fantôme au tour suivant). La liste de reset ci-dessous est désormais complète — des carry-overs
  // latents entre tours (aimTranches, aimedLocation, meleeCount…) disparaissent aussi.
  useEffect(() => {
    const isAnnounced = rosterEntry?.has_announced ?? false
    const wasAnnounced = prevHasAnnouncedRef.current
    prevHasAnnouncedRef.current = isAnnounced
    const tokenChanged = prevTokenRef.current !== (rosterEntry?.token_id ?? null)
    prevTokenRef.current = rosterEntry?.token_id ?? null

    if (!rosterEntry) return
    if (!tokenChanged && !(wasAnnounced && !isAnnounced)) return

    const snap = snapFromRosterEntry(rosterEntry)
    initialStates.current = snap
    dispatch({ type: 'RESET', payload: snap })
    setMapSelected(new Set())
    assaultDecl.clear()
    setMoveSelection(null)
    setInMoveMode(false)
    setInTargetMode(false)
    setSelectedAmmoId(null)
    meleeDecl.clear()
    setInMeleeTargetMode(false)
    // Même correctif que CombatGmDeclareWindow.jsx (bug confirmé Saar 2026-09-02) : un mode de visée
    // armé pour l'ancien token de ce slot ne peut plus être pertinent une fois qu'on bascule sur un
    // autre — annulation sans condition, sans risque (le bouton qui l'arme n'existe que pour le token
    // actuellement affiché par cette fenêtre).
    combatTargetMode?.onCancel()
    combatAoeTargetMode?.onCancel()
  }, [rosterEntry?.token_id, rosterEntry?.has_announced])  // eslint-disable-line react-hooks/exhaustive-deps

  // --- fetch allures — suit le token actif du joueur (humanoïdes uniquement) ---
  // Drone : allures servies par useDroneMovementBudget ci-dessus (Vitesse serveur), jamais ce calcul
  // COO/Athlétisme qui recevait des NaN pour un drone (GET /char-sheet/:id renvoie sheet:null).
  useEffect(() => {
    const charId = playerToken?.character_id
    if (!charId || isDrone) return
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
  }, [playerToken?.id, isDrone])

  // --- fetch blessures — Blessure mortelle bloque Attaque/CaC/Rechargement -
  // (WNDMORT-UI, docs/BUGIDENTIFIE.md) — même garde que le serveur (isTestBlockingWound), Déplacement
  // et Passer le tour restent actifs ici (le serveur affine encore la restriction sur l'allure).
  useEffect(() => {
    const charId = playerToken?.character_id
    if (!charId) { setMortallyWounded(false); return }
    let cancelled = false
    api.get(`/char-sheet/${charId}/wounds`)
      .then(res => { if (!cancelled) setMortallyWounded(isTestBlockingWound(res.data.wounds)) })
      .catch(() => { if (!cancelled) setMortallyWounded(false) })
    return () => { cancelled = true }
  }, [playerToken?.character_id])

  // COMBAT_DECLARE_ERROR : écouté par useCombatSocket (hook central), poussé dans sessionStore,
  // affiché par <CombatDeclareErrorBanner> — plus de socket.on local (REACT.md P57, module 3).
  // (reset au nouveau tour : fusionné dans l'effet de reset consolidé plus haut, 2026-08-28)

  // --- fetch armes equipees + inventaire complet (humanoïdes uniquement) ----
  useEffect(() => {
    const charId = playerToken?.character_id
    if (!charId || isDrone) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/inventory`).then(res => {
      if (cancelled) return
      const items = res.data.items || []
      // shared/weaponSlots.js — inclut le deux-mains (2M), pas seulement MG/MD (Session 158, Loulou/
      // Breather non détecté). assaultWeapons reste volontairement filtré aux armes à FEU (ref_fire_mode)
      // uniquement — le panneau CaC a son propre filtre pour les armes de contact.
      setAssaultWeapons(flattenItemsBySlot(items).filter(item => item.ref_fire_mode))
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
    const { weaponMg: wMg, weaponMd: wMd, primaryWeapon: selected } = resolveHandWeapons(assaultWeapons)
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
    if (!playerTokensInRoster.some(tk => tk.id === activeTokenId)) return
    const tokenId = activeTokenId
    const timer = setTimeout(() => {
      socket.emit(WS.COMBAT_ANNOUNCE_PREVIEW, {
        tokenId,
        // 'move' n'entre plus jamais dans mapSelected (survol ambiant, COMBAT-DEPLACEMENT-HOVER) —
        // ajouté ici explicitement pour que l'aperçu GM reste fidèle dès qu'une destination est posée.
        actions:          moveSelection ? [...mapSelected, 'move'] : [...mapSelected],
        assaultTargetIds: [...assaultPendingTokenIds],
        meleeTargetIds:   [...meleePendingTokenIds],
        moveDestination: moveSelection
          ? { x: moveSelection.targetPosX, y: moveSelection.targetPosY }
          : null,
        combatMode: decl.combatMode,
      })
    }, 150)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, phase, activeTokenId, mapSelected, assaultPendingTokenIds, meleePendingTokenIds, moveSelection, decl.combatMode])

  if (playerTokensInRoster.length === 0) return null

  // --- derives resolution --------------------------------------------------
  // resolveSlotTid/isMyTurnInResolution/computedAnnounceTokenId/isMyTurnInAnnouncement remontés avant
  // les hooks ambiants (cf. juste après rosterEntry plus haut) — pas dupliqués ici.
  const myActions = actions.filter(a => playerTokensInRoster.some(tk => tk.id === a.token_id)
    && (resolveSlotTid ? a.token_id === resolveSlotTid : a.token_id === playerToken?.id)
  )

  // --- derives assaut -------------------------------------------------------
  // shared/weaponSlots.js — inclut le deux-mains (2M) dans la priorité de sélection (Session 158).
  const { weaponMg, weaponMd, hasTwoWeapons, primaryWeapon: resolvedRangedPrimary } = resolveHandWeapons(assaultWeapons)
  // D5 : la liste d'armes (module 4) peut fixer explicitement l'arme de tir ; sinon primaire résolue
  // par les slots. Le dual-wield (weaponMg/weaponMd/hasTwoWeapons) reste piloté par l'équipement.
  const selectedWeapon = (selectedRangedWeaponId && assaultWeapons.find(w => w.id === selectedRangedWeaponId)) || resolvedRangedPrimary
  const sameFirMode   = hasTwoWeapons && weaponMg.ref_fire_mode === weaponMd.ref_fire_mode
  const forceCC       = hasTwoWeapons && !sameFirMode
  const assaultWeaponId = selectedWeapon?.id ?? null
  // Lunette de visée (docs/PLAN_MODING_PHASEB.md Groupe 2) — preview client uniquement, le serveur
  // re-dérive sa propre valeur depuis weaponInvId à la déclaration (jamais confiance au client).
  const lunetteNiveau = selectedWeapon?.lunette_niveau ?? 0
  // Zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9) — même autorité que la résolution serveur et
  // la fenêtre MJ (shared/combatRange.js#isShotgunSpreadWeapon), sur l'item brut (ref_name), pas un nom
  // d'affichage. Rejet PJ déjà géré côté serveur (message clair, résolution pas encore implémentée) —
  // aucun garde-fou d'éligibilité supplémentaire à dupliquer ici.
  const isAoeEligible = isShotgunSpreadWeapon(selectedWeapon?.ref_name)

  // Modes disponibles pour le CombatDeclareStateSelector fire_mode
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
        item.slots == null &&
        item.container !== 'Coffre'
      )
    : []

  // Grisage « arme vide » / « chargeur plein » : porté par buildWeaponList (weaponAmmoStatus) pour la
  // liste, et par AssaultRangedPanel pour le détail. Le déclencheur de Rechargement revient en col. 2
  // (D7, sous-commit 3/4) — plus de calcul isAmmoFull ici.

  const dualWieldBonusComp = (isDualWield && hasTwoWeapons && sameFirMode)
    ? (currentFireMode === 'RL' ? 5 : 3)
    : 0

  const attackSelected = mapSelected.has('attack')
  const meleeSelected  = mapSelected.has('melee')
  const meleeDefensif  = decl.combatMode === 'defensif' || decl.combatMode === 'retraite'
  const weaponLocked   = attackSelected || meleeSelected

  // Tir Multi (docs/PLAN_TIRMULTI.md D6) — CC uniquement, jamais RC/RL
  const effectiveAssaultCount = currentFireMode === 'CC' ? assaultCount : 1
  // D10 — Tir visé / deux armes / Viser une localisation sont chacun exclusifs avec Tir Multi
  const multiShotIneligibilityReasons = getMultiShotIneligibilityReasons({
    currentFireMode, aimTranches, isDualWield, aimedLocation,
  })

  // Armes de contact équipées (slots MG/MD/2M, catégorie 'Arme de contact')
  const meleeWeapons = allInventoryItems.filter(item =>
    (item.slots?.includes('MG') || item.slots?.includes('MD') || item.slots?.includes('2M')) &&
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

  // Combat à deux armes (COM24, docs/BUGIDENTIFIE.md) — même utilitaire partagé que le dual-wield
  // Tir (shared/weaponSlots.js), filtré aux armes de contact plutôt qu'aux armes à feu. hasTwoWeapons
  // exclut déjà un 2M actif (resolveHandWeapons). L'arme secondaire est celle des deux mains qui ne
  // correspond pas à l'arme principale sélectionnée — jamais mains nues/arme naturelle (pas de
  // weaponInvId dans ce cas, condition ci-dessous déjà fausse).
  const meleeHandWeapons = flattenItemsBySlot(allInventoryItems, ['MG', 'MD', '2M']).filter(item => item.ref_category === 'Arme de contact')
  const { weaponMg: meleeWeaponMg, weaponMd: meleeWeaponMd, hasTwoWeapons: hasTwoMeleeWeapons } = resolveHandWeapons(meleeHandWeapons)
  const meleeOffhandWeapon = (hasTwoMeleeWeapons && effectiveMeleeWeaponId)
    ? (effectiveMeleeWeaponId === meleeWeaponMd?.id ? meleeWeaponMg
      : effectiveMeleeWeaponId === meleeWeaponMg?.id ? meleeWeaponMd
      : null)
    : null
  const showDualWieldMeleeSection = hasTwoMeleeWeapons && !!meleeOffhandWeapon
  // Jamais actif hors du contexte où le toggle est visible (Défensif/Retraite/Charge le masquent,
  // §MeleeCombatPanel.jsx) — sinon une valeur restée true en mémoire s'appliquerait silencieusement
  // après un changement de mode sans que le joueur ait pu la revoir/désactiver.
  const effectiveDualWieldMelee = isDualWieldMelee && showDualWieldMeleeSection
    && !meleeDefensif && decl.combatMode !== 'charge'

  // CaC et Tir sont mutuellement exclusifs à la déclaration — une seule « Action de combat » par Tour
  // (LdB « Types d'Actions », docs/PLAN_COMBAT_TIMELINE.md §6sexies point 5 : décidé pendant la
  // conception du Lot B mais jamais câblé — gap qui laissait déclarer les deux, provoquant un plantage
  // à la résolution, trouvé par Saar en testant le Lot B/C). Sélectionner l'un efface l'autre.
  const clearAttackState = () => {
    assaultDecl.clear()
    setInTargetMode(false)
  }
  const clearMeleeState = () => {
    meleeDecl.clear()   // reset aussi selectedMeleeNaturalWeaponId (l'ancien code ne le faisait pas)
    setInMeleeTargetMode(false)
    if (decl.combatMode === 'retraite' || decl.combatMode === 'charge') setMoveSelection(null)
    dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
  }

  const handleMapToggle = (k) => {
    setMapSelected(prev => {
      const next = new Set(prev)

      if (next.has(k)) {
        // Désélection
        next.delete(k)
        if (k === 'attack') clearAttackState()
        if (k === 'melee') clearMeleeState()
        if (k === 'move') setMoveSelection(null)
        if (k === 'reload') setSelectedAmmoId(null)
      } else {
        next.add(k)
        if (k === 'attack') {
          if (next.has('melee')) { next.delete('melee'); clearMeleeState() }
          dispatch({ type: 'SELECT_ATTACK' })
        }
        if (k === 'melee' && next.has('attack')) {
          next.delete('attack')
          clearAttackState()
        }
      }

      return next
    })
  }

  // --- liste d'armes groupée (module 4, D5 « l'arme EST l'action ») --------------------------------
  // buildWeaponList est pur (client/src/lib/weaponList.js, testé) : il ne fait que grouper /
  // normaliser / trier. L'autorité des slots reste shared/weaponSlots.js (arrays déjà filtrés).
  const weaponBlanketDisable = mortallyWounded ? 'mortallyWounded' : (isStunned ? 'stunned' : null)
  const weaponGroups = buildWeaponList({
    rangedWeapons: assaultWeapons,
    meleeWeapons,
    naturalWeapons: naturalWeapons.map(m => ({
      id: m.id, name: m.name,
      natural_weapon_formula: m.natural_weapon_formula,
      natural_weapon_requires_grapple: m.natural_weapon_requires_grapple,
    })),
    blanketDisable: weaponBlanketDisable,
  })

  // id de la ligne actuellement sélectionnée (surbrillance col. 1)
  const meleeSelectedRowId = !meleeSelected
    ? null
    : effectiveMeleeNaturalWeaponId
      ? `nat:${effectiveMeleeNaturalWeaponId}`
      : selectedMeleeWeaponId === null
        ? 'bare'
        : (effectiveMeleeWeaponId ?? (meleeWeapons[0]?.id ?? 'bare'))
  const selectedWeaponRowId = attackSelected
    ? (selectedRangedWeaponId ?? resolvedRangedPrimary?.id ?? null)
    : meleeSelectedRowId

  // Choisir une arme = déclarer cette attaque (auto-dégaine). Re-cliquer la ligne sélectionnée
  // annule l'action. CaC ⊕ Tir reste exclusif (handleMapToggle s'en charge).
  const handleWeaponPick = (row) => {
    if (row.disabled) return
    if (row.group === 'distance') {
      if (attackSelected && selectedWeaponRowId === row.id) { handleMapToggle('attack'); return }
      assaultDecl.selectWeapon(row.id)   // change d'arme = reset config col. 2 (P8 / PO-M4-e)
      if (reloadSelected) handleMapToggle('reload')   // changer d'arme sort du mode Recharger
      if (!attackSelected) handleMapToggle('attack')
      else dispatch({ type: 'SELECT_ATTACK' })
    } else {
      if (meleeSelected && meleeSelectedRowId === row.id) { handleMapToggle('melee'); return }
      if (row.kind === 'natural') meleeDecl.selectNatural(row.id.slice(4))
      else if (row.kind === 'bare') meleeDecl.selectWeapon(null)
      else meleeDecl.selectWeapon(row.id)
      if (!meleeSelected) handleMapToggle('melee')
      dispatch({ type: 'SELECT_ATTACK' })   // auto-dégaine (D5) — SELECT_ATTACK ne fait que weapon→drawn
    }
  }

  // --- deplacement zone select ---------------------------------------------
  // Le survol/preview est permanent par défaut (useAutoMoveMode ci-dessus) — ce clic efface une
  // sélection déjà posée, ET réarme le survol s'il a été désactivé par un "Annuler" explicite
  // (COM-MOVEUI1) : seul moyen de sortir de ce désarmement avant la fin de l'activation en cours.
  const handleZoneSelectClick = () => {
    if (moveSelection) setMoveSelection(null)
    rearmMove()
  }

  // --- choix cible assaut (index = slot dans la série Tir Multi) -----------
  // UX (retour Saar) : tant qu'aucune cible n'a encore été choisie pour cette déclaration, le premier
  // choix remplit toute la série (comportement par défaut — pas de clic répété sur la même cible pour
  // le cas courant) ; une fois au moins une cible posée, un choix ultérieur ne touche que son slot.
  const handleChooseTarget = (index) => {
    setInTargetMode(true)
    onEnterTargetMode(
      playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (tokenId) => {
        assaultDecl.setTarget(index, tokenId, currentFireMode)
        setInTargetMode(false)
      },
      () => { setInTargetMode(false) }
    )
  }

  // --- zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9) — mirroir handleChooseTarget -----------
  // inTargetMode reste posé (désarme les hooks ambiants move/clic-attaque pendant la visée, mêmes
  // gardes que ci-dessus) mais ne pilote PAS le masquage de la fenêtre — isHidden plus bas dérive ça
  // de combatAoeTargetMode (état partagé), pas d'un flag local (COMBAT-DEPLACEMENT-HOVER, cf. commentaire
  // sur isTargeting : un flag local n'est pas toujours positionné par tous les points d'entrée).
  const handleStartAoeDirection = () => {
    setInTargetMode(true)
    onEnterAoeTargetMode(
      playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      selectedWeapon?.ref_range ?? null,
      (directionDeg) => {
        assaultDecl.setAoeDirection(directionDeg)
        setInTargetMode(false)
      },
      () => { setInTargetMode(false) },
    )
  }

  // --- calcul INI total client (indicatif) ---------------------------------
  const reloadSelected = mapSelected.has('reload')
  // D7 : « Recharger » est un mode de l'arme sélectionnée, exclusif du Tir — quand il est actif,
  // l'arme se recharge, elle ne tire pas (le segment Tir │ Recharger de la col. 2 bascule).
  const attackActive = attackSelected && !reloadSelected
  // Charge : le déplacement gratuit (ini_mod 0) et la cible vivent dans `chargeSelection` (M0.4-g) ;
  // sinon `moveSelection` (déplacement normal / Retraite). Miroir de `buildGmDeclarePayload`.
  const iniMoveSel = chargeSelection?.move ?? moveSelection
  const mapActionsObj = {
    move:   iniMoveSel ? { ini_mod: (chargeSelection?.move || decl.combatMode === 'retraite') ? 0 : iniMoveSel.ini_mod } : null,
    // Tir Multi (docs/PLAN_TIRMULTI.md D1) : array systématique, comme melee ci-dessous. aimTranches
    // n'est jamais non-nul que sur un seul élément (D10 — Tir visé exclusif avec Tir Multi).
    attack: attackActive ? Array(effectiveAssaultCount).fill({ aimTranches, lunetteNiveau }) : null,
    // Défensif/Retraite : pas d'action d'attaque → pas de coût INI melee.
    // Charge : le coût INI est celui du `combat_mode` (state), pas d'entrée melee ici (comme le MJ).
    melee:  (meleeSelected && !meleeDefensif && !chargeSelection)
      ? Array(meleeCount).fill({ targetTokenId: null, weaponInvId: null })
      : null,
    reload: reloadSelected ? {} : null,
  }
  const iniDelta = calcIniDelta(initialStates.current, decl, mapActionsObj, decl.quick)
  const iniBreakdown = calcIniBreakdown(initialStates.current, decl, mapActionsObj, decl.quick, t)

  // Tir visé — éligibilité recalculée à chaque rendu, source unique shared/combatExclusiveActions.js
  // (même évaluateur que le serveur — retour visuel immédiat, jamais d'aller-retour pour ce feedback)
  const aimIneligibilityReasons = getAimIneligibilityReasons({
    mapActions: mapActionsObj, state: decl, quick: decl.quick, entry: rosterEntry,
    isDualWield, bulletCount: effectiveBulletCount ?? null,
  })

  // --- validité déclaration — source unique client/src/lib/declareChecks.js -----------------------
  // Le booléen (`.valid`) et le message (`.reason`) sortent de la même évaluation ; M0.4 enveloppera
  // ces fonctions dans les hooks (PLAN_RW_DECLARE_DESIGN §5.10). Chaque entrée = l'expression exacte
  // de l'ancien `assaultValid`/`reloadValid`/`meleeValid` (iso-comportement).
  const effectiveMeleeCount = decl.combatMode === 'charge' ? 1 : meleeCount
  // Zone d'effet (PLAN_AOE.md §8 étape 9) : une direction posée compte comme un ciblage complet, sans
  // cible unique — même règle que assaultDeclaration.js#assaultTargetsComplete (mirroir du correctif
  // CombatGmDeclareWindow.jsx).
  const assault = assaultCheck({
    started:       attackActive,
    hasWeapon:     assaultWeaponId != null,
    targetsFilled: assaultDecl.isAoeMode ? 1 : assaultPendingTokenIds.slice(0, effectiveAssaultCount).filter(Boolean).length,
    targetsNeeded: assaultDecl.isAoeMode ? 1 : effectiveAssaultCount,
    hasVariant:    currentVariant != null,
    aimActive:     aimTranches > 0,
    aimReasons:    aimIneligibilityReasons,
  })
  const melee = meleeCheck({
    started:         meleeSelected || !!chargeSelection,
    defensif:        meleeDefensif,
    isCharge:        !!chargeSelection,
    chargeHasMove:   chargeSelection?.move != null,
    chargeHasTarget: chargeSelection?.targetTokenId != null,
    targetsFilled:   meleePendingTokenIds.length,
    targetsNeeded:   effectiveMeleeCount,
  })
  const reload = reloadCheck({
    started:         reloadSelected,
    coveredByAttack: false,   // D7 : Recharger remplace le Tir (n'est plus « couvert » par lui)
    hasWeapon:       selectedWeapon !== null,
    hasAmmo:         selectedAmmoId !== null,
  })
  // B5 (§5.2) : un humain peut déclarer un tour vide (comme drone/exo). Module 5 (§5.10, D12) ré-ajoute
  // un gate `hasCompleteAction` : Déclarer actif ⟺ il y a quelque chose à déclarer ET c'est valide.
  const hasCompleteAction = hasSomethingToDeclare({
    attackStarted:  attackSelected,
    meleeStarted:   meleeSelected || !!chargeSelection,
    reloadStarted:  reloadSelected,
    hasMove:        moveSelection != null || chargeSelection?.move != null,
    hasStateChange: hasDeliberateStateChange(decl, initialStates.current),
    hasQuick:       decl.quick.observer > 0 || decl.quick.reperer > 0 || decl.quick.phrase,
  })
  const canDeclare = isDrone
    ? droneDeclare.canDeclare
    : (assault.valid && melee.valid && reload.valid)
  const blockReason = isDrone ? null : buildBlockReason({ assault, melee, reload })

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

    // Assemblage du payload : fonction pure testée (module 0, docs/PLANS/PLAN_RW_DECLARE_DESIGN.md
    // §5.4). La fenêtre rassemble ses sélections dans un bag plat ; buildHumanDeclarePayload le
    // transforme en payload COMBAT_ACTION_DECLARE. Golden master : client/src/lib/buildDeclarePayload.test.mjs.
    socket.emit(WS.COMBAT_ACTION_DECLARE, buildHumanDeclarePayload({
      tokenId: playerToken.id,
      decl,
      moveSelection,
      attackSelected: attackActive,   // D7 : Recharger exclut le Tir dans le payload
      assaultPendingTokenIds, effectiveAssaultCount, assaultWeaponId,
      isDualWield, hasTwoWeapons, sameFirMode, weaponMg, currentVariant, dualWieldBonusComp,
      aimTranches, aimedLocation, aoeDirection: assaultDecl.state.aoeDirection,
      meleeSelected, meleeDefensif, meleePendingTokenIds, effectiveMeleeCount, chargeSelection,
      effectiveMeleeWeaponId, effectiveMeleeNaturalWeaponId, effectiveDualWieldMelee, meleeOffhandWeapon,
      reloadSelected, selectedWeapon, selectedAmmoId,
    }))
  }

  // =========================================================================
  // RENDU — Surprise
  // =========================================================================
  if (pendingSurpriseRoll?.tokenId && playerTokensInRoster.some(tk => tk.id === pendingSurpriseRoll.tokenId)) {
    return (
      <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'} style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>{t('actionWindow.surpriseTitle')}</div>
        <p style={W.surpriseText}>{t('actionWindow.surpriseMessage')}</p>
        <button style={W.btnRoll} onClick={onSurpriseRolled}>{t('actionWindow.rollInitiativeButton')}</button>
      </div>
    )
  }
  if (rosterEntry.is_surprised && rosterEntry.has_announced && rosterEntry.initiative === 0) {
    return (
      <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'} style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>{t('actionWindow.surpriseTitle')}</div>
        <p style={W.surpriseText}>{t('actionWindow.surprisedCannotAct')}</p>
      </div>
    )
  }

  // =========================================================================
  // RENDU — Phase Résolution (mon tour)
  // =========================================================================
  if (isMyTurnInResolution) {
    const myAssaultAction = myActions.find(a => a.action_key === 'assault')
    const myReloadAction  = myActions.find(a => a.action_key === 'reload')
    const cibleToken = myAssaultAction ? tokens.find(tk => tk.id === myAssaultAction.target_token_id) : null
    const isRushed = rosterEntry.state_vitesse === 'rushed'
    return (
      <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'} style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>{t('actionWindow.resolutionPhaseShort')}</div>
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
                <div>{t('actionWindow.targetPrefix')}<span style={{ color: '#c0c0d0' }}>{cibleToken?.label ?? '—'}</span></div>
                {isRushed && <div style={{ color: '#e55' }}>{t('actionWindow.rushedTag')}</div>}
              </div>
            )}
          </div>
        </div>
        <div className="combat-float-footer">
          {myAssaultAction ? (
            <div style={{ color: '#7070a0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>
              {t('actionWindow.awaitingGmValidation')}
            </div>
          ) : myReloadAction ? (
            <div style={{ color: '#7070a0', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>
              {t('actionWindow.reloadAwaitingGm')}
            </div>
          ) : (
            <button className="btn-tac" onClick={() => socket?.emit(WS.COMBAT_ACTION_CONFIRM, { tokenId: playerToken.id })}>
              {t('actionWindow.actButton')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Section roster PJ — collapsible, présente dans tous les états
  const rosterSection = (
    <div className="decl-roster">
      <div
        className="decl-roster__head"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          const next = !rosterOpen
          setRosterOpen(next)
          localStorage.setItem('pj-roster-open', next ? 'true' : 'false')
        }}
      >
        {t('declareList.rosterHeader')}
        <span className="count">{playerTokensInRoster.length} · {rosterOpen ? '▲' : '▼'}</span>
      </div>
      {rosterOpen && playerTokensInRoster.map(tok => {
        const entry    = roster.find(r => r.token_id === tok.id)
        const isActive = tok.id === (resolveSlotTid ?? computedAnnounceTokenId)
        const isDone   = entry?.has_announced ?? false
        return (
          <div key={tok.id} className="decl-roster__row" data-active={isActive} style={{ opacity: isDone ? 0.5 : undefined }}>
            <span className="mk">{isDone ? '✓' : (isActive ? '▶' : '○')}</span>
            <span className="n">{tok.label}</span>
            <span className="i">INI {entry?.initiative ?? '?'}</span>
          </div>
        )
      })}
    </div>
  )

  // Pas encore mon tour d'annoncer — attente du slot actuel
  if (phase === 'ANNOUNCEMENT' && !(rosterEntry?.has_announced) && !isMyTurnInAnnouncement) {
    const currentDeclarer = tokens.find(tk => tk.id === computedAnnounceTokenId)
    return (
      <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'} style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>{t('actionWindow.declarationPhaseTitle')}</div>
        <p style={W.waitText}>
          {t('actionWindow.awaitingPlayer', { name: currentDeclarer?.label ?? '…' })}
        </p>
      </div>
    )
  }

  // Phase 2 — résolution en cours, pas encore mon slot actif
  if (phase === 'RESOLUTION' && !isMyTurnInResolution) {
    const activeResolveToken = tokens.find(tk => tk.id === resolveSlotTid)
    return (
      <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'} style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>{t('actionWindow.resolutionPhaseTitle')}</div>
        <p style={W.waitText}>
          {activeResolveToken ? t('actionWindow.tokenActing', { name: activeResolveToken.label }) : t('actionWindow.resolutionInProgress')}
        </p>
      </div>
    )
  }

  // Déjà déclaré (ANNOUNCEMENT)
  if (rosterEntry?.has_announced) {
    return (
      <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'} style={{ position: 'fixed', left: pos.left, top: pos.top, maxHeight: 'calc(100vh - 80px)' }}>
        <div className="combat-float-header" onMouseDown={onHeaderMouseDown}>{t('actionWindow.declarationPhaseTitleAlt')}</div>
        <p style={W.waitText}>{t('actionWindow.actionDeclaredWaiting')}</p>
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
        meleeDecl.setTarget(targetIndex, tokenId, effectiveMeleeCount)
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
  // M0.4-g : le résultat (déplacement + cible) est stocké atomiquement dans `meleeDecl.state.charge`
  // ({ move, targetTokenId }), même forme que le MJ — plus de `moveSelection` détourné.
  const handleChargeFlow = () => {
    dispatch({ type: 'SET_COMBAT_MODE', mode: 'charge' })
    setMoveSelection(null)   // nettoyer tout déplacement normal pré-existant (Bug B)
    setMapSelected(prev => { const n = new Set(prev); n.delete('move'); return n })
    meleeDecl.setCharge(null)
    if (!allures) return
    setInMoveMode(true)
    // Charge : limiter visuellement à la zone lente (déplacement court) uniquement
    const chargeAllures = { lente: allures.lente, moyenne: allures.lente, rapide: allures.lente, max: allures.lente }
    onEnterMoveMode(
      chargeAllures, playerToken.id,
      { x: playerToken.pos_x, z: playerToken.pos_y },
      (sel) => {
        const move = { ...sel, ini_mod: 0 }   // déplacement gratuit pour la Charge
        setInMoveMode(false)
        // Chaîner automatiquement la sélection de cible CaC (Charge = 1 cible toujours)
        setInMeleeTargetMode(true)
        onEnterTargetMode(
          playerToken.id,
          { x: playerToken.pos_x, z: playerToken.pos_y },
          (tid) => { meleeDecl.setCharge({ move, targetTokenId: tid }); setInMeleeTargetMode(false) },
          () => { setInMeleeTargetMode(false); dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' }) },
          'melee'
        )
      },
      () => { setInMoveMode(false); dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' }) }
    )
  }

  // Survol ambiant (COMBAT-DEPLACEMENT-HOVER) : ne masque la fenêtre que si une destination a été
  // posée et attend "Valider" — pas pendant le simple survol, sinon la fenêtre resterait masquée en
  // continu pendant tout le tour (option 1, décision Saar).
  const hasPendingOwnMove = combatMoveMode?.tokenId === playerToken?.id && !!pendingMoveSelection
  // Masquage du ciblage dérivé de combatTargetMode (état partagé, useCombatUIState) plutôt que des
  // flags locaux inTargetMode/inMeleeTargetMode — ces derniers ne sont positionnés que par le flux tuile
  // Attaque/CaC classique ; le clic direct (useCombatClickAttack.js) arme combatTargetMode sans jamais
  // toucher ces flags, donc la fenêtre restait visible pendant ce flux (retour Saar 2026-07-31). Les deux
  // flags restent utilisés ailleurs (gate de useCombatClickAttack/useAutoMoveMode), juste plus ici.
  const isTargeting = combatTargetMode?.tokenId === playerToken?.id
  // Même raisonnement que isTargeting ci-dessus (état partagé, pas un flag local) — PLAN_AOE.md §8
  // étape 9.
  const isAoeTargeting = combatAoeTargetMode?.tokenId === playerToken?.id
  const isHidden    = inMoveMode || isTargeting || isAoeTargeting || droneDeclare.isSelectingOnMap || hasPendingOwnMove
  const showAssault = attackActive
  const showReload  = attackSelected && reloadSelected && !!selectedWeapon
  const showMelee   = meleeSelected  && !attackSelected

  // CC slider index
  const ccSliderIdx = assaultBulletCount && assaultBulletCount !== 1
    ? CC_REPS_STEPS.indexOf(assaultBulletCount)
    : 0
  const ccSliderDisplayIdx = ccSliderIdx === -1 ? 0 : ccSliderIdx

  // =========================================================================
  // RENDU — Phase Annonce
  // =========================================================================
  return (
    <>
      {!isDrone && (
        <CombatDeclareStatePanel
          pos={pos}
          windowWidth={(showAssault || showReload || showMelee) ? 720 : 360}
          family="pj"
          decl={decl}
          initial={initialStates.current}
          onChange={(axis, value) => dispatch({ type: 'SET_FIELD', key: axis, value })}
          weaponDisabled={weaponLocked}
          hidden={isHidden}
        />
      )}
    <div className="combat-float-win" data-decl data-family={isDrone ? 'drone' : 'pj'}
      data-narrow={!(showAssault || showReload || showMelee) || undefined}
      style={{
      position: 'fixed',
      width: (showAssault || showReload || showMelee) ? 720 : 360,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden ? 'none' : 'auto',
      left: pos.left,
      top: pos.top,
      maxHeight: 'calc(100vh - 80px)',
    }}>
      <CombatDeclareHeader
        name={playerToken.label ?? '?'}
        declared={roster.filter(r => r.has_announced).length}
        total={roster.length}
        onMouseDown={onHeaderMouseDown}
      />

      {mortallyWounded && (
        <div style={W.mortalWoundBanner}>{t('actionWindow.mortallyWoundedBanner')}</div>
      )}

      <div className="combat-win-body">
        {/* ---- Panneau gauche ---- */}
        <div className="decl-col1">

          {/* Posture / Vitesse / Arme → satellite d'état (CombatDeclareStatePanel, module 3). */}

          {/* ── Corps humain : move-line + liste d'armes groupée (CombatDeclareActionList, module 4). */}
          {!isDrone && (
            <CombatDeclareActionList
              move={{
                on: !!moveSelection,
                disabled: allures === null || decl.combatMode === 'charge' || decl.combatMode === 'retraite',
                valueLabel: moveSelection ? `${moveSelection.ini_mod}` : t('declareList.moveDefine'),
                tooltip: t('mapActions.move.tooltip'),
                onToggle: handleZoneSelectClick,
              }}
              groups={weaponGroups}
              selectedRowId={selectedWeaponRowId}
              onPick={handleWeaponPick}
              reload={{ active: reloadSelected, onToggle: () => handleMapToggle('reload') }}
            />
          )}

          {/* ACTION — drone : DroneDeclareSection. Le PJ humain rend la move-line + la liste d'armes
             groupée ci-dessus (module 4, D5 « l'arme EST l'action » — plus de grille de tuiles). */}
          {isDrone && (
            <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
              <div style={W.sectionTitle}>{t('sectionTitles.action')}</div>
              <DroneDeclareSection
                pendingMove={droneDeclare.pendingMove}
                onMoveToggle={droneDeclare.rearmDroneMove}
                hasPassed={droneDeclare.hasPassed}
                onPassToggle={() => droneDeclare.setHasPassed(p => !p)}
                droneWeapons={droneDeclare.droneWeapons}
                selectedWeaponId={droneDeclare.selectedDroneWeaponId}
                onWeaponSelect={droneDeclare.setSelectedDroneWeaponId}
                assaultTargetId={droneDeclare.assaultTargetId}
                onChooseTarget={() => droneDeclare.handleChooseTarget(playerToken)}
                getLabel={(id) => tokens.find(tk => tk.id === id)?.label ?? '?'}
              />
            </div>
          )}

          {/* ACTIONS RAPIDES */}
          {!isDrone && (
          <div className="combat-win-section" style={{ padding: '0 0 4px 0' }}>
            <div style={W.sectionTitle}>{t('gmDeclareWindow.quickActionsSection')}</div>
            {QUICK_ACTIONS.map(a => {
              const isFixed = a.kind === 'fixed'
              const val     = isFixed ? decl.quick.phrase : (decl.quick[a.k] ?? 0)
              const isActive = isFixed ? !!val : val > 0
              const cost    = isFixed ? a.ini : (val * a.stepIni)
              return (
                <div key={a.k} title={t(a.tooltip)} style={{ borderBottom: '1px solid #1a1a2a' }}>
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
                    <span style={W.itemLabel}>{t(a.l)}</span>
                    {isActive && cost !== 0 && (
                      <span style={{ ...W.itemMod, color: '#c86030' }}>{cost}</span>
                    )}
                    {!isActive && !isFixed && (
                      <span style={W.itemMod}>{t('actionWindow.quickActionCostPerTurn')}</span>
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

        {(showAssault || showReload || showMelee) && (
        <div className="decl-col2">
        {/* Recharger : ↻ sur la ligne d'arme (col. 1, option B — Saar 2026-08-29). Ici, quand il est
            actif, la col. 2 passe sur le sélecteur de munition. */}

        {/* ---- Panneau droit — rechargement : sélection munitions ---- */}
        {showReload && (
          <div style={{ ...W.assaultPanel, flex: 1, minHeight: 0 }}>
            <div style={W.assaultSection}>
              <div style={W.assaultSectionTitle}>{t('meleeCombatPanel.weaponSection')}</div>
              {selectedWeapon ? (
                <div style={W.assaultInfoText}>
                  {selectedWeapon.custom_name || selectedWeapon.ref_name || t('actionWindow.weaponNameFallback')}
                  <span style={W.assaultInfoSub}> ({selectedWeapon.slots?.[0]}) — {selectedWeapon.ref_caliber}</span>
                </div>
              ) : (
                <div style={W.assaultNoWeapon}>{t('assaultPanel.noWeapon')}</div>
              )}
            </div>

            <div style={W.assaultSection}>
              <div style={W.assaultSectionTitle}>
                {t('actionWindow.ammoSection')} {selectedWeapon?.ref_caliber ? `— ${selectedWeapon.ref_caliber}` : ''}
              </div>
              {reloadAmmoItems.length === 0 ? (
                <div style={{ ...W.assaultNoWeapon, color: '#c83030' }}>
                  {t('actionWindow.noCompatibleAmmo')}
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
                        <div style={W.assaultOptionLabel}>{item.custom_name || item.ref_name || t('actionWindow.ammoNameFallback')}</div>
                        <div style={W.assaultOptionSub}>{t('actionWindow.qtyLabel', { qty: item.quantity })}</div>
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
                  {t('actionWindow.ammoSelected')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- Panneau droit — corps à corps ---- */}
        {showMelee && (
          <div style={{ ...W.assaultPanel, flex: 1, minHeight: 0, background: 'rgba(80,180,80,0.04)' }}>
            <MeleeCombatPanel
              availableWeapons={meleeWeapons.map(item => ({
                id: item.id,
                label: item.custom_name || item.ref_name || t('actionWindow.weaponNameFallback'),
                slot: item.slots?.[0],
                damage: item.ref_damage_h || '—',
                allonge: parseInt(item.ref_range) || 0,
              }))}
              selectedWeaponId={effectiveMeleeWeaponId}
              isWeaponDrawn={decl.weapon === 'drawn'}
              hasMeleeInInventory={hasMeleeInInventory}
              onWeaponChange={meleeDecl.selectWeapon}
              naturalWeapons={naturalWeapons.map(m => ({
                id: m.id, label: m.name,
                formula: m.natural_weapon_formula, requiresGrapple: m.natural_weapon_requires_grapple,
              }))}
              selectedNaturalWeaponId={effectiveMeleeNaturalWeaponId}
              onNaturalWeaponChange={meleeDecl.selectNatural}
              targetIsGrappled={
                tokens.find(tk => tk.id === meleePendingTokenIds[0])?.statuses?.includes('grappled') ?? false
              }
              combatMode={decl.combatMode}
              onModeChange={(mode) => {
                dispatch({ type: 'SET_COMBAT_MODE', mode })
                meleeDecl.resetTargets()
                if (decl.combatMode === 'charge') { setMoveSelection(null); meleeDecl.setCharge(null) }
              }}
              onStartCharge={handleChargeFlow}
              onStartRetraite={handleRetraiteMove}
              chargeMoveDest={chargeSelection?.move ?? null}
              chargeTargetLabel={chargeSelection?.targetTokenId ? (tokens.find(tk => tk.id === chargeSelection.targetTokenId)?.label ?? null) : null}
              meleeCount={meleeCount}
              effectiveMeleeCount={effectiveMeleeCount}
              onMeleeCountChange={meleeDecl.setCount}
              perSlotTargeting={true}
              targetIds={chargeSelection?.targetTokenId ? [chargeSelection.targetTokenId] : meleePendingTokenIds}
              isInTargetMode={false}
              tokens={tokens}
              onChooseTarget={(i) => handleChooseMeleeTarget(i)}
              showReadyBadge={melee.valid && !meleeDefensif}
              showDualWieldSection={showDualWieldMeleeSection}
              isDualWield={isDualWieldMelee}
              onDualWieldChange={meleeDecl.setDualWield}
              offhandWeaponDisplay={meleeOffhandWeapon ? (meleeOffhandWeapon.custom_name || meleeOffhandWeapon.ref_name || t('actionWindow.weaponNameFallback')) : null}
            />
          </div>
        )}

        {/* ---- Panneau droit — assaut humanoïde ---- */}
        {showAssault && !isDrone && (
          <div style={{ ...W.assaultPanel, flex: 1, minHeight: 0 }}>
            <AssaultRangedPanel
              weaponDisplay={selectedWeapon ? `${selectedWeapon.custom_name || selectedWeapon.ref_name || t('actionWindow.weaponNameFallback')} (${selectedWeapon.slots?.[0]})` : null}
              weaponMdDisplay={(hasTwoWeapons && weaponMd) ? `${weaponMd.custom_name || weaponMd.ref_name || t('actionWindow.weaponNameFallback')} (${weaponMd.slots?.[0]})` : null}
              targetIds={assaultPendingTokenIds}
              getLabel={(id) => tokens.find(tk => tk.id === id)?.label ?? '?'}
              onChooseTarget={handleChooseTarget}
              showDualWieldSection={hasTwoWeapons && sameFirMode}
              isDualWield={isDualWield}
              currentFireMode={currentFireMode}
              availableFireModes={availableFireModes}
              onFireModeChange={v => dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: v })}
              onDualWieldChange={assaultDecl.setDualWield}
              assaultBulletCount={assaultBulletCount}
              effectiveBulletCount={effectiveBulletCount ?? 1}
              assaultVariantAB={assaultVariantAB}
              ccSliderDisplayIdx={ccSliderDisplayIdx}
              currentVariant={currentVariant}
              dualWieldBonusComp={dualWieldBonusComp}
              onBulletCountChange={assaultDecl.setBulletCount}
              onVariantABChange={assaultDecl.setVariantAB}
              aimTranches={aimTranches}
              onAimTranchesChange={assaultDecl.setAimTranches}
              aimIneligibilityReasons={aimIneligibilityReasons}
              lunetteNiveau={lunetteNiveau}
              aimedLocation={aimedLocation}
              onAimedLocationChange={assaultDecl.setAimedLocation}
              assaultCount={assaultCount}
              effectiveAssaultCount={effectiveAssaultCount}
              onAssaultCountChange={assaultDecl.setCount}
              multiShotIneligibilityReasons={multiShotIneligibilityReasons}
              isAoeEligible={isAoeEligible}
              isAoeMode={assaultDecl.isAoeMode}
              aoeDirection={assaultDecl.state.aoeDirection}
              onStartAoeDirection={handleStartAoeDirection}
            />
          </div>
        )}
        </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="combat-float-footer">
        {isDrone && droneAlluresError && (
          <div style={{ fontSize: 10, color: '#c83030', background: 'rgba(200,48,48,0.08)', border: '1px solid #c8303044', borderRadius: 3, padding: '4px 8px', marginBottom: 4 }}>
            ⚠ {t('droneDeclare.movementUnavailable', { reason: droneAlluresError })}
          </div>
        )}
        <CombatDeclareErrorBanner />
        <CombatDeclareFooter
          currentInitiative={rosterEntry.initiative}
          iniDelta={isDrone ? 0 : iniDelta}
          iniBreakdown={isDrone ? [] : iniBreakdown}
          hasCompleteAction={isDrone ? droneDeclare.canDeclare : hasCompleteAction}
          canDeclare={canDeclare}
          blockReason={blockReason}
          moveDestination={moveSelection ? { x: moveSelection.targetPosX, y: moveSelection.targetPosY } : null}
          onDeclare={handleDeclare}
          onPassTurn={() => socket?.emit(WS.COMBAT_ACTION_DECLARE, { tokenId: playerToken.id, state: {}, mapActions: {} })}
        />
      </div>
    </div>
    </>
  )
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
  weaponInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 10px 4px',
  },
  weaponInfoLine: {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  weaponInfoAmmo: {
    fontWeight: 700,
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
  destination: {
    fontSize: 10,
    color: '#5b8dee',
    fontWeight: 600,
  },
  mortalWoundBanner: {
    margin: '6px 10px 0',
    padding: '6px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color: '#e0a0a0',
    background: `${SEVERITY_COLORS.mortelle}33`,
    border: `1px solid ${SEVERITY_COLORS.mortelle}`,
    textAlign: 'center',
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
