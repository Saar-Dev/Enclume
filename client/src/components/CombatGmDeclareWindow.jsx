import { useState, useEffect, useRef, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api'
import {
  QUICK_ACTIONS,
  calcIniDelta, calcIniBreakdown,
  CC_REPS_STEPS, computeFireVariant,
} from './combatSections.js'
import { getAimIneligibilityReasons, getMultiShotIneligibilityReasons } from '../../../shared/combatExclusiveActions.js'
import { resolveMeleeReachM, resolveWeaponRangeBand } from '../../../shared/combatRange.js'
import { isAoeWeapon } from '../../../shared/combatAoe.js'
import { DEFAULT_PNJ_ALLURES } from '../../../shared/polarisUtils.js'
import { useDraggable } from '../lib/useDraggable.js'
import DroneWeaponPanel from './DroneWeaponPanel.jsx'
import AssaultRangedPanel from './AssaultRangedPanel.jsx'
import MeleeCombatPanel from './MeleeCombatPanel.jsx'
import { declarationReducer, DECLARATION_INITIAL, snapFromRosterEntry } from '../lib/declarationReducer'
import { useDroneDeclare } from '../lib/useDroneDeclare.js'
import { useDroneMovementBudget } from '../lib/useDroneMovementBudget.js'
import { useAutoMoveMode } from '../lib/useAutoMoveMode.js'
import { useCombatClickAttack } from '../lib/useCombatClickAttack.js'
import DroneDeclareSection from './DroneDeclareSection.jsx'
import CombatDeclareStatePanel from './CombatDeclareStatePanel.jsx'
import CombatDeclareHeader from './CombatDeclareHeader.jsx'
import CombatDeclareErrorBanner from './CombatDeclareErrorBanner.jsx'
import CombatDeclareFooter from './CombatDeclareFooter.jsx'
import { buildGmDeclarePayload } from '../lib/buildDeclarePayload.js'
import { useAssaultDeclaration } from '../lib/useAssaultDeclaration.js'
import { useMeleeDeclaration } from '../lib/useMeleeDeclaration.js'
import { buildWeaponList } from '../lib/weaponList.js'
import CombatDeclareActionList from './CombatDeclareActionList.jsx'
import { assaultCheck, meleeCheck, buildBlockReason, hasSomethingToDeclare } from '../lib/declareChecks.js'
import { hasDeliberateStateChange } from '../lib/hasDeliberateStateChange.js'

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
export default function CombatGmDeclareWindow({ socket, characters, onEnterMoveMode, combatMoveMode, pendingMoveSelection, battlemapId, onEnterTargetMode, combatTargetMode, combatAoeTargetMode, onEnterAoeTargetMode, pjPreview, registerAmbientAttackHandler, showTargetRecap }) {
  const { t } = useTranslation('combat')
  const { roster, activeTokenId: storeActiveTokenId } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  // Slot actif courant — fallback calculé si COMBAT_SLOT_ADVANCED pas encore reçu
  const activeTokenId = storeActiveTokenId ?? (
    [...roster]
      .filter(r => !r.has_announced && r.status === 'active')
      .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
  )

  const [equipment,    setEquipment]    = useState({})   // tokenId -> { characterId, weapon, weaponMg, weaponMd, armorPieces }
  const [rosterOpen,   setRosterOpen]   = useState(
    () => localStorage.getItem('gm-roster-open') !== 'false'
  )

  // ── États de déclaration pour le PNJ actif ───────────────────────────────
  const [decl, dispatch] = useReducer(declarationReducer, DECLARATION_INITIAL)
  const [mapAction,       setMapAction]       = useState(null)     // 'reload' | null
  const [meleePendingMode,setMeleePendingMode]= useState(false)
  const [pendingMove,     setPendingMove]     = useState(null)     // sel ou null

  // ── Sous-état de sélection Tir (M0.4) — reducer partagé PJ / MJ ───────────
  // { weaponId, targets, count, bulletCount, variantAB, isDualWield, aimTranches, aimedLocation }.
  // Alias en lecture pour ne pas toucher les sites de lecture existants. `assaultDecl.clear()` dans
  // l'effet de reset (le hook ne se reset pas seul).
  const assaultDecl = useAssaultDeclaration()
  const {
    targets:      assaultTargets,
    count:        assaultCount,
    bulletCount:  assaultBulletCount,
    variantAB:    assaultVariantAB,
    isDualWield,
    aimTranches,
    aimedLocation,
  } = assaultDecl.state

  // ── Sous-état de sélection CaC (M0.4) — même reducer partagé que le PJ ────
  // { weaponId (undefined=auto / null=mains nues / id), naturalWeaponId, targets, count, isDualWield,
  //   charge: {move, targetTokenId}|null }. `meleePendingMode` (flag « config CaC en cours ») reste
  //   un état MJ propre — le PJ le dérive de mapSelected.
  const meleeDecl = useMeleeDeclaration()
  const {
    weaponId:        selectedGmMeleeWeaponId,
    naturalWeaponId: selectedGmMeleeNaturalWeaponId,
    targets:         meleeTargets,
    count:           meleeAttackCount,
    isDualWield:     isDualWieldMelee,
    charge:          chargeSelection,
  } = meleeDecl.state
  const [isSelectingOnMap, setIsSelectingOnMap] = useState(false)

  const tokensRef = useRef(tokens)
  useEffect(() => { tokensRef.current = tokens }, [tokens])

  // I18N-LINT1 (docs/BUGIDENTIFIE.md) — hooks déclarés ici même si le composant retourne null plus
  // bas (allGmManaged.length === 0) : useRef doit toujours s'exécuter au même ordre à chaque rendu.
  // REFS-RENDER : la synchro .current passe par useEffect (pas une écriture pendant le rendu, voir
  // react.dev/reference/react/useRef "Pitfall" — seule l'initialisation paresseuse y échappe, pas ce
  // cas) — donc currentFireMode/effectiveMeleeCount/effectiveAssaultCount doivent aussi être calculés
  // ici, avant le retour conditionnel (leurs seules dépendances, decl/meleeAttackCount/assaultCount,
  // sont déjà disponibles à ce point — jamais recalculés plus bas, réutilisés tels quels).
  const currentFireMode = decl.fire_mode.toUpperCase()
  const effectiveMeleeCount = decl.combatMode === 'charge' ? 1 : meleeAttackCount
  const effectiveAssaultCount = currentFireMode === 'CC' ? assaultCount : 1
  // effectiveAssaultCountRef / effectiveMeleeCountRef : supprimés — assaultDecl.setTarget /
  // meleeDecl.setTarget calculent la complétude de série en interne (M0.4-c/e).

  // StrictMode (main.jsx) double-invoque les effets de montage en dev (mount → cleanup → mount) —
  // sans ce réarmement dans le corps de l'effet, isMountedRef.current reste bloqué à false après ce
  // cycle synthétique (seul le cleanup le mettait à false, rien ne le repassait à true), et la chaîne
  // de sélection multi-cibles (selectNext ci-dessous) s'arrêtait alors systématiquement après la
  // première cible — COM7.
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const prevHasAnnouncedRef = useRef(false)  // détection nouveau tour (has_announced true→false)
  const prevTokenRef        = useRef(null)   // détection changement de slot actif

  // (reset consolidé : déclaré plus bas, après `activePnjEntry`/`initialStates`)

  // Sync states initiaux depuis rosterEntry
  const activePnjEntry = activeTokenId ? roster.find(r => r.token_id === activeTokenId) : null

  // ── Helpers déclarant actif — remontés ici (avant les hooks ambiants plus bas, Rules of Hooks) pour
  // ALLURE-TURNGATE1 (docs/BUGIDENTIFIE.md) : le survol déplacement PNJ ne doit s'armer que si le slot
  // actif est réellement un PNJ pas encore déclaré, jamais tout le temps. Anciens emplacements (isPnj/
  // isDroneGmManaged/isGmManaged après le early-return, isActivePnj/isActiveDrone juste avant) retirés,
  // même contenu, pas dupliqué. Aucun ne dépend de rien calculé entre l'ancien et le nouvel emplacement.
  const isPnj = (entry) => {
    const token = tokens.find(tk => tk.id === entry.token_id)
    if (!token?.character_id) return false
    return characters.find(c => c.id === token.character_id)?.type === 'pnj'
  }
  const isDroneGmManaged = (entry) => {
    const token = tokens.find(tk => tk.id === entry.token_id)
    if (!token?.character_id) return false
    const char = characters.find(c => c.id === token.character_id)
    return char?.type === 'drone' && !char.user_id
  }
  const isGmManaged = (entry) => isPnj(entry) || isDroneGmManaged(entry)
  const isActivePnj   = activePnjEntry && isPnj(activePnjEntry)           && !activePnjEntry.has_announced
  const isActiveDrone = activePnjEntry && isDroneGmManaged(activePnjEntry) && !activePnjEntry.has_announced

  const initialStates = snapFromRosterEntry(activePnjEntry)

  // ── Reset complet de la déclaration — au changement de slot actif OU au nouveau tour
  // (`has_announced` true→false : `endTurn` a remis state_position/cover/vitesse/combat_mode aux
  // défauts côté serveur, le client doit suivre — sinon transition d'état fantôme, bug Tir visé
  // corrigé 2026-08-28). Avant : un seul effet sur `[activeTokenId]` qui ne re-firait pas quand le
  // 1er PNJ non déclaré du nouveau tour était le même token.
  useEffect(() => {
    const isAnnounced = activePnjEntry?.has_announced ?? false
    const wasAnnounced = prevHasAnnouncedRef.current
    prevHasAnnouncedRef.current = isAnnounced
    const tokenChanged = prevTokenRef.current !== (activeTokenId ?? null)
    prevTokenRef.current = activeTokenId ?? null

    if (!tokenChanged && !(wasAnnounced && !isAnnounced)) return

    dispatch({ type: 'RESET', payload: initialStates })
    setMapAction(null)
    setMeleePendingMode(false)
    setPendingMove(null)
    assaultDecl.clear()
    meleeDecl.clear()
    setIsSelectingOnMap(false)
    // Bug confirmé Saar (2026-09-02) : un mode de visée armé pour l'ancien PNJ actif (Cibler/Viser une
    // zone) restait vivant après le changement de slot — un clic sur la carte pour le NOUVEAU PNJ
    // committait alors une direction/cible calculée depuis la position de l'ANCIEN tireur. Ce mode ne
    // peut, par construction, avoir été armé que par CE PNJ (le bouton qui l'arme n'existe que pour le
    // PNJ actuellement affiché) — donc tout ce qui reste armé ici appartient forcément à l'ancien slot,
    // jamais au nouveau : annulation sans condition, sans risque de couper quelque chose de légitime.
    combatTargetMode?.onCancel()
    combatAoeTargetMode?.onCancel()
  }, [activeTokenId, activePnjEntry?.has_announced])  // eslint-disable-line react-hooks/exhaustive-deps

  // COMBAT_DECLARE_ERROR : écouté par useCombatSocket (hook central) → sessionStore →
  // <CombatDeclareErrorBanner>. Plus de socket.on local (REACT.md P57, module 3).

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
    const tok = tokens.find(tk => tk.id === activeTokenId)
    if (!tok?.character_id) return null
    const char = characters.find(c => c.id === tok.character_id)
    return char?.type === 'drone' ? char.id : null
  })()

  // Token courant nécessaire ici (avant le retour anticipé plus bas, règle des hooks) — recalcul
  // léger, `activeToken` (dérivé plus tard) ne peut pas être réutilisé à ce point.
  const activeTokenForHover = activeTokenId ? tokens.find(tk => tk.id === activeTokenId) : null

  // Drone : allures = sa Vitesse (m/Tour) servie par le serveur, jamais DEFAULT_PNJ_ALLURES en dur
  // (fausses valeurs 4/8/16/24). Vitesse non renseignée sur la fiche → bannière explicite.
  const { allures: droneAllures, error: droneAlluresError } = useDroneMovementBudget(
    activeDroneCharId, isActiveDrone,
  )

  const droneDeclare = useDroneDeclare({
    charId:           activeDroneCharId,
    tokenId:          activeTokenId,
    tokenPos:         activeTokenForHover ? { x: activeTokenForHover.pos_x, z: activeTokenForHover.pos_y } : null,
    allures:          activeDroneCharId ? droneAllures : DEFAULT_PNJ_ALLURES,
    onEnterMoveMode,
    onEnterTargetMode,
    // CLICKATTACK-TURNGATE1 (docs/BUGIDENTIFIE.md) — `isActiveDrone` (déjà la source unique "drone
    // géré par le MJ, pas encore déclaré", cf. ligne 191) remplace `!!activeDroneCharId` : fermait le
    // survol/clic-attaque au bon moment (has_announced) et exclut aussi un drone appartenant à un
    // joueur (isDroneGmManaged exige `!char.user_id`) — trouvé en corrigeant ce bug : sans ce filtre,
    // ce flag armait déjà pour un drone de joueur simplement parce qu'il était le slot actif, alors que
    // `canDeclare` plus bas ignore ce cas (pas l'affaire du MJ). Ferme les deux hooks ambiants d'un coup
    // (flag partagé, useDroneDeclare.js).
    moveHoverEnabled: isActiveDrone,
    combatMoveMode,
    pendingMoveSelection,
    battlemapId,
    registerAmbientAttackHandler,
    showTargetRecap,
  })
  // Déplacement PNJ (non-drone) : survol/preview ambiant par défaut, même patron que le drone
  // ci-dessus et que CombatActionWindow (COMBAT-DEPLACEMENT-HOVER) — suspendu pendant Charge (géré
  // en interne par handleStartCharge) et pendant toute autre sélection en cours (isSelectingOnMap).
  // ALLURE-TURNGATE1 (docs/BUGIDENTIFIE.md) — `isActivePnj` exclut aussi bien le drone que le cas où
  // le slot actif est un PJ ou un PNJ déjà déclaré : le survol ne s'arme que si le slot actif est
  // réellement un PNJ pas encore déclaré. `moveHoverEnabled` (drone, ci-dessus) reçoit désormais le
  // même traitement via `isActiveDrone` (CLICKATTACK-TURNGATE1).
  const { rearm: rearmMove } = useAutoMoveMode({
    enabled: isActivePnj && !isSelectingOnMap && decl.combatMode !== 'charge',
    allures: DEFAULT_PNJ_ALLURES,
    tokenId: activeTokenId,
    tokenPos: activeTokenForHover ? { x: activeTokenForHover.pos_x, z: activeTokenForHover.pos_y } : null,
    combatMoveMode,
    onEnterMoveMode,
    onMoveSelected: (sel) => setPendingMove(sel),
    onCancel: () => {},
  })

  // ── Clic direct sur un token adverse (sans tuile Attaque/CaC préalable) ──────────────────────
  // Même hook que CombatActionWindow (PJ)/useDroneDeclare, cf. useCombatClickAttack.js. `isActivePnj`
  // (calculé plus haut, ligne 190, avant les hooks ambiants — Rules of Hooks) est déjà disponible ici :
  // CLICKATTACK-TURNGATE1 a retiré `clickIsActivePnj`, doublon exact de `isActivePnj` sans raison
  // technique (aucune contrainte d'ordre des hooks ne les distinguait, seuls des `const` de rendu).
  // `equipment` est déjà disponible à ce point (state, ligne 85), donc pas de duplication de dérivation
  // nécessaire ici contrairement à CombatActionWindow (allInventoryItems y était aussi déjà dispo,
  // dérivation dupliquée là-bas uniquement par cohérence de patron entre les 2 fichiers).
  const clickAllWeapons = isActivePnj
    ? [equipment[activeTokenId]?.weaponMg, equipment[activeTokenId]?.weaponMd,
       equipment[activeTokenId]?.weapon2M, equipment[activeTokenId]?.weaponTr].filter(Boolean)
    : []
  const clickMeleeWeapon  = clickAllWeapons.find(w => w.ref_category === 'Arme de contact') ?? null
  const clickRangedWeapon = clickAllWeapons.find(w => w.ref_fire_mode) ?? null
  const resolveGmClickAttackMode = (distanceM) => {
    if (!clickRangedWeapon) return { mode: 'melee', band: null }
    if (!clickMeleeWeapon) return { mode: 'ranged', band: resolveWeaponRangeBand(distanceM, clickRangedWeapon.ref_range).band }
    if (distanceM <= resolveMeleeReachM(clickMeleeWeapon.ref_range)) return { mode: 'melee', band: null }
    return { mode: 'ranged', band: resolveWeaponRangeBand(distanceM, clickRangedWeapon.ref_range).band }
  }
  useCombatClickAttack({
    enabled: isActivePnj && !isSelectingOnMap && decl.combatMode !== 'charge',
    battlemapId,
    tokenId: activeTokenId,
    tokenPos: activeTokenForHover ? { x: activeTokenForHover.pos_x, z: activeTokenForHover.pos_y } : null,
    moveDestination: pendingMove
      ? { pos_x: pendingMove.targetPosX, pos_y: pendingMove.targetPosY, pos_z: pendingMove.targetPosZ ?? 0 }
      : null,
    resolveMode: resolveGmClickAttackMode,
    showTargetRecap,
    registerAmbientAttackHandler,
    onMeleeTarget:   (tid) => meleeDecl.setSoleTarget(tid),
    onAssaultTarget: (tid) => assaultDecl.setSoleTarget(tid),
  })

  // Reset fire_mode au premier mode disponible si l'arme chargée ne le supporte pas
  useEffect(() => {
    const w = equipment[activeTokenId]?.weapon
    if (!w?.ref_fire_mode) return
    const modes = w.ref_fire_mode.split('/').map(s => s.trim().toLowerCase())
    if (!modes.includes(initialStates.fire_mode))
      dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: modes[0] })
  }, [activeTokenId, equipment])

  const getLabel = (tokenId) => tokens.find(tk => tk.id === tokenId)?.label ?? tokenId
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

  // isActivePnj/isActiveDrone remontés avant les hooks ambiants (cf. juste après activePnjEntry plus
  // haut) — pas dupliqués ici.
  const activeToken = activeTokenId ? tokens.find(tk => tk.id === activeTokenId) : null
  const isStunnedActivePnj = activeToken?.statuses?.includes('stunned') ?? false

  // Quand le slot actif est un PJ (ni PNJ ni drone) — identifier le bloquant
  const blockerEntry = (!isActivePnj && !isActiveDrone && activePnjEntry && !activePnjEntry.has_announced) ? activePnjEntry : null
  const blockerIsPj  = blockerEntry ? !isPnj(blockerEntry) && !isDroneGmManaged(blockerEntry) : false

  const gmEq          = isActivePnj ? (equipment[activeTokenId] ?? null) : null
  const weaponMg      = gmEq?.weaponMg ?? null
  const weaponMd      = gmEq?.weaponMd ?? null
  const weapon2M      = gmEq?.weapon2M ?? null
  const weaponTr      = gmEq?.weaponTr ?? null
  // Armes en main normalisées pour buildWeaponList (module 4) : les items MJ portent `inv_id`/`name`.
  const gmHandWeapons = [
    weaponMg && { ...weaponMg, id: weaponMg.inv_id, slot: 'MG' },
    weaponMd && { ...weaponMd, id: weaponMd.inv_id, slot: 'MD' },
    weapon2M && { ...weapon2M, id: weapon2M.inv_id, slot: '2M' },
    weaponTr && { ...weaponTr, id: weaponTr.inv_id, slot: 'Tr' },
  ].filter(Boolean)
  const resolvedGmPrimary = gmEq?.weapon ?? null
  // D5 : la liste d'armes peut fixer explicitement l'arme de tir (assaultDecl.weaponId) ; sinon primaire.
  const pickedGmRanged = assaultDecl.state.weaponId
    ? gmHandWeapons.find(w => w.id === assaultDecl.state.weaponId && w.ref_fire_mode)
    : null
  const weapon       = isActivePnj ? (pickedGmRanged ?? resolvedGmPrimary) : null
  // Zone d'effet (PLAN_ARMES_SPECIALES.md §1.6 segment 0b) — l'AOE-ness est une donnée catalogue
  // (ref_equipment.aoe_profile), même autorité (`shared/combatAoe.js`) que la résolution serveur.
  const isAoeEligible = isAoeWeapon(weapon?.ref_aoe_profile)
  const hasTwoWeapons = !!(weaponMg && weaponMd)
  const sameFirMode   = hasTwoWeapons && weaponMg.ref_fire_mode === weaponMd.ref_fire_mode
  // Combat à deux armes CaC (COM24, docs/BUGIDENTIFIE.md) — même source `equipment[tokenId]` que le
  // Tir ci-dessus, filtrée à la catégorie Arme de contact (ref_category, route /combat-equipment).
  const hasTwoMeleeWeapons = !!(weaponMg && weaponMd
    && weaponMg.ref_category === 'Arme de contact' && weaponMd.ref_category === 'Arme de contact')

  // ── INI delta ────────────────────────────────────────────────────────────
  const iniDelta = isActivePnj ? calcIniDelta(
    initialStates,
    decl,
    {
      move:  pendingMove ?? null,
      attack: null,
      melee: meleeTargets.length > 0 ? meleeTargets : null,
    },
    decl.quick,
  ) : 0
  const iniBreakdown = isActivePnj ? calcIniBreakdown(
    initialStates, decl,
    { move: pendingMove ?? null, attack: null, melee: meleeTargets.length > 0 ? meleeTargets : null },
    decl.quick,
    t,
  ) : []

  const meleeDefensif    = decl.combatMode === 'defensif' || decl.combatMode === 'retraite'
  const meleeWeaponAvailable = weapon && !weapon.ref_fire_mode ? weapon : null
  // undefined = pas de choix → dériver; null = mains nues explicite; id = arme choisie
  const effectiveGmMeleeWeaponId = decl.weapon !== 'drawn'
    ? null
    : selectedGmMeleeWeaponId === undefined
      ? (meleeWeaponAvailable?.inv_id ?? null)
      : selectedGmMeleeWeaponId
  const weaponInvIdForMelee = effectiveGmMeleeWeaponId
  // Arme secondaire (COM24) — quand les deux mains portent une arme de contact, meleeWeaponAvailable
  // (dérivé de primaryWeapon, priorité 2M > Tr > MD > MG) correspond à weaponMd ; l'arme secondaire
  // est donc weaponMg, jamais l'inverse tant qu'aucun 2M/Tr n'est actif — même logique que le Tir.
  const meleeOffhandWeapon = (hasTwoMeleeWeapons && effectiveGmMeleeWeaponId) ? weaponMg : null
  const showDualWieldMeleeSection = hasTwoMeleeWeapons && !!meleeOffhandWeapon
  // Miroir CombatActionWindow.jsx : jamais actif hors du contexte où le toggle est visible.
  const effectiveDualWieldMelee = isDualWieldMelee && showDualWieldMeleeSection
    && !meleeDefensif && decl.combatMode !== 'charge'
  // Armes naturelles (mutations) du PNJ actif — batché par /combat-equipment (docs/PLAN_MUTATION2.md
  // Lot 4 sous-lot B), jamais un fetch par PNJ (évite le N+1 que ce batch existant évite déjà).
  const naturalWeaponsAvailable = isActivePnj ? (equipment[activeTokenId]?.naturalWeapons ?? []) : []
  const naturalWeaponIdForMelee = selectedGmMeleeNaturalWeaponId

  // ── Liste d'armes groupée (module 4, D5) — CombatDeclareActionList ────────
  const weaponGroups = buildWeaponList({
    rangedWeapons: gmHandWeapons.filter(w => w.ref_fire_mode),
    meleeWeapons:  gmHandWeapons.filter(w => w.ref_category === 'Arme de contact'),
    naturalWeapons: naturalWeaponsAvailable.map(m => ({
      id: m.id, name: m.name,
      natural_weapon_formula: m.natural_weapon_formula,
      natural_weapon_requires_grapple: m.natural_weapon_requires_grapple,
    })),
    blanketDisable: isStunnedActivePnj ? 'stunned' : null,
  })

  // Tir GM — mode de tir et variant (miroir logique CombatActionWindow)
  const availableFireModes = weapon?.ref_fire_mode
    ? weapon.ref_fire_mode.split('/').map(s => s.trim().toLowerCase())
    : ['cc']
  const { variant: currentVariant, effectiveBulletCount } = computeFireVariant(
    currentFireMode, assaultBulletCount, assaultVariantAB, { defaultCcCount: 1 }
  )
  const dualWieldBonusComp = (isDualWield && hasTwoWeapons && sameFirMode)
    ? (currentFireMode === 'RL' ? 5 : 3)
    : 0
  // Slider CC répétition
  const ccSliderIdx = assaultBulletCount && assaultBulletCount !== 1
    ? CC_REPS_STEPS.indexOf(assaultBulletCount)
    : 0
  const ccSliderDisplayIdx = ccSliderIdx === -1 ? 0 : ccSliderIdx

  // D10 — Tir visé / deux armes / Viser une localisation sont chacun exclusifs avec Tir Multi
  const multiShotIneligibilityReasons = getMultiShotIneligibilityReasons({
    currentFireMode, aimTranches, isDualWield, aimedLocation,
  })

  // Tir visé — éligibilité recalculée à chaque rendu, source unique shared/combatExclusiveActions.js
  // (même évaluateur que le serveur et que CombatActionWindow.jsx PJ — retour visuel immédiat)
  const aimIneligibilityReasons = getAimIneligibilityReasons({
    mapActions: {
      move:     pendingMove ?? chargeSelection?.move ?? null,
      // Tir Multi (D1) : array, comme CombatActionWindow.jsx — signale l'exclusivité dès que plus
      // d'un tir est configuré. assaultTargets.length > 0 (pas isAttackActive, défini plus bas dans
      // ce composant) suffit ici, même patron que meleeTargets juste au-dessus.
      attack:   assaultTargets.length > 0 ? Array(effectiveAssaultCount).fill({ aimTranches, lunetteNiveau: weapon?.lunette_niveau ?? 0 }) : null,
      melee:    meleeTargets.length > 0 ? meleeTargets : null,
      reload:   mapAction === 'reload'   ? {} : null,
    },
    state: decl, quick: decl.quick, entry: activePnjEntry,
    isDualWield, bulletCount: effectiveBulletCount ?? null,
  })

  // ── canDeclare / hasCompleteAction / blockReason — source unique client/src/lib/declareChecks.js ──
  // `meleeStarted` / `attackStarted` : flags « config en cours » du MJ, réutilisés l.535/542 pour
  // `isMeleeSetup` / `isAttackActive` (byte-équivalent à l'ancien inline).
  const meleeStarted  = meleePendingMode || meleeTargets.length > 0 || !!chargeSelection
  const attackStarted = assaultDecl.state.weaponId != null   // D5 : arme de tir choisie = Tir en cours
    || assaultTargets.length > 0
    || (combatTargetMode?.tokenId === activeTokenId && !(isActivePnj && meleeStarted))
  // Zone d'effet (PLAN_AOE.md §8 étape 9) : une direction posée compte comme un ciblage complet, sans
  // cible unique — même règle que assaultDeclaration.js#assaultTargetsComplete, relue ici plutôt que
  // recalculée séparément (assaultDecl.isAoeMode est la même valeur dérivée).
  const assault = assaultCheck({
    started:       attackStarted,
    hasWeapon:     !!weapon,
    targetsFilled: assaultDecl.isAoeMode ? 1 : assaultTargets.slice(0, effectiveAssaultCount).filter(Boolean).length,
    targetsNeeded: assaultDecl.isAoeMode ? 1 : effectiveAssaultCount,
    hasVariant:    currentVariant !== null,
    aimActive:     aimTranches > 0,
    aimReasons:    aimIneligibilityReasons,
  })
  const melee = meleeCheck({
    started:         meleeStarted,
    defensif:        meleeDefensif,
    isCharge:        !!chargeSelection,
    chargeHasMove:   chargeSelection?.move != null,
    chargeHasTarget: chargeSelection?.targetTokenId != null,
    targetsFilled:   meleeTargets.length,
    targetsNeeded:   effectiveMeleeCount,
  })
  // B5 (§5.2) : un PNJ peut déclarer un tour vide. Module 5 (§5.10, D12) : Déclarer actif ⟺ il y a
  // quelque chose à déclarer ET c'est valide. Le MJ ne configure pas le rechargement (pas de reloadCheck).
  const hasCompleteAction = isActiveDrone
    ? droneDeclare.canDeclare
    : hasSomethingToDeclare({
        attackStarted,
        meleeStarted,
        reloadStarted:  mapAction === 'reload',
        hasMove:        pendingMove != null,
        hasStateChange: hasDeliberateStateChange(decl, initialStates),
        hasQuick:       decl.quick.observer > 0 || decl.quick.reperer > 0 || decl.quick.phrase,
      })
  const canDeclare = (isActivePnj && assault.valid && melee.valid) || (isActiveDrone && droneDeclare.canDeclare)
  const blockReason = isActiveDrone ? null : buildBlockReason({ assault, melee })

  // ── Sélection dans la liste d'armes (module 4, D5) ───────────────────────
  const gmMeleeRowId = !meleeStarted
    ? null
    : selectedGmMeleeNaturalWeaponId
      ? `nat:${selectedGmMeleeNaturalWeaponId}`
      : selectedGmMeleeWeaponId === null
        ? 'bare'
        : (effectiveGmMeleeWeaponId ?? (weaponInvIdForMelee ?? 'bare'))
  const gmSelectedRowId = attackStarted
    ? (assaultDecl.state.weaponId ?? weapon?.inv_id ?? null)
    : gmMeleeRowId

  // Choisir une arme = déclarer cette attaque (auto-dégaine). Re-cliquer = annuler. Tir ⊕ CaC exclusif.
  // Le MJ ouvre la colonne 2 (panneau détail) sans sauter au ciblage — la cible se choisit dans la col. 2.
  const handleGmWeaponPick = (row) => {
    if (row.disabled) return
    const clearMeleeSetup = () => {
      setMeleePendingMode(false); meleeDecl.clear()
      dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' })
    }
    if (row.group === 'distance') {
      if (attackStarted && gmSelectedRowId === row.id) { assaultDecl.clear(); setMapAction(p => p === 'reload' ? null : p); return }
      if (meleeStarted) clearMeleeSetup()
      setMapAction(p => p === 'reload' ? null : p)   // changer d'arme sort du mode Recharger
      assaultDecl.selectWeapon(row.id)
      if (decl.weapon !== 'drawn') dispatch({ type: 'SELECT_ATTACK' })
    } else {
      if (meleeStarted && gmMeleeRowId === row.id) { setMeleePendingMode(false); meleeDecl.clear(); return }
      if (attackStarted) { assaultDecl.clear(); setMapAction(p => p === 'reload' ? null : p) }
      if (row.kind === 'natural') meleeDecl.selectNatural(row.id.slice(4))
      else if (row.kind === 'bare') meleeDecl.selectWeapon(null)
      else meleeDecl.selectWeapon(row.id)
      setMeleePendingMode(true)
      if (decl.weapon !== 'drawn') dispatch({ type: 'SELECT_ATTACK' })
    }
  }

  // ── Déplacement direct ───────────────────────────────────────────────────
  // ── Assaut direct (Tir Multi, docs/PLAN_TIRMULTI.md) ──────────────────────
  // UX (retour Saar) : un seul clic suffit pour le cas courant — tant qu'aucune cible n'est encore
  // posée, le premier choix remplit toute la série (comportement par défaut, pas de N clics sur la
  // même cible). startIdx>0 (bouton "Changer" d'un slot précis, une fois au moins une cible posée) ne
  // touche que ce slot — plus de chaînage récursif nécessaire, contrairement à handleStartMelee (dont
  // le cas d'usage courant reste des cibles distinctes).
  const handleStartAttack = (startIdx = 0) => {
    if (!onEnterTargetMode || !activeTokenId || !activeToken) return
    setIsSelectingOnMap(true)
    onEnterTargetMode(
      activeTokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => {
        assaultDecl.setTarget(startIdx, targetId, currentFireMode)
        setIsSelectingOnMap(false)
      },
      () => { setIsSelectingOnMap(false) },
      'ranged'
    )
  }

  // ── Zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9) — mirroir de handleStartAttack : survol
  // continu sur la carte, un clic fige un candidat, Valider/Changer décident ensuite (combatAoeTargetMode
  // — pas un clic-glisser-relâcher, essayé puis abandonné, retour Saar 2026-09-02). `weapon.ref_range`
  // traverse jusqu'à Canvas3D pour l'aperçu (aoePreviewShape.js).
  const handleStartAoeDirection = () => {
    if (!onEnterAoeTargetMode || !activeTokenId || !activeToken) return
    setIsSelectingOnMap(true)
    onEnterAoeTargetMode(
      activeTokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      weapon?.ref_range ?? null,
      (directionDeg) => {
        assaultDecl.setAoeDirection(directionDeg)
        setIsSelectingOnMap(false)
      },
      () => { setIsSelectingOnMap(false) },
    )
  }

  // ── Melee direct ────────────────────────────────────────────────────────
  // startIdx : emplacement à (re)cibler. Ne ré-enchaîne les N sélections que si on redémarre depuis 0
  // (premier réglage) — reciblage d'un seul emplacement (startIdx>0, bouton "Changer" par slot) ne
  // touche plus les autres. Correctif rapide de test (Saar, Session 158) : le MJ devait auparavant tout
  // resélectionner à chaque changement, un seul bouton « Cibler » repartant toujours de zéro.
  const handleStartMelee = (startIdx = 0) => {
    if (!onEnterTargetMode || !activeTokenId || !activeToken) return
    if (startIdx === 0) meleeDecl.resetTargets()
    setIsSelectingOnMap(true)
    const selectNext = (idx) => {
      onEnterTargetMode(
        activeTokenId,
        { x: activeToken.pos_x, z: activeToken.pos_y },
        (targetId) => {
          // setTarget self-terminant : retourne « série complète ? » — plus besoin d'un ref sur N.
          const complete = meleeDecl.setTarget(idx, targetId, effectiveMeleeCount)
          if (startIdx === 0 && !complete) {
            setTimeout(() => { if (isMountedRef.current) selectNext(idx + 1) }, 0)
          } else {
            setIsSelectingOnMap(false)
          }
        },
        () => { setIsSelectingOnMap(false) },
        'melee'
      )
    }
    selectNext(startIdx)
  }

  // ── Charge (move court gratuit → cible CaC) ─────────────────────────────
  const handleStartCharge = () => {
    if (!activeToken) return
    dispatch({ type: 'SET_COMBAT_MODE', mode: 'charge' })
    meleeDecl.setCharge(null)
    setIsSelectingOnMap(true)
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
          (targetId) => { meleeDecl.setCharge({ move, targetTokenId: targetId }); setIsSelectingOnMap(false) },
          () => { dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' }); setIsSelectingOnMap(false) },
          'melee'
        )
      },
      () => { dispatch({ type: 'SET_COMBAT_MODE', mode: 'normal' }); setIsSelectingOnMap(false) },
    )
  }

  // ── Declare ─────────────────────────────────────────────────────────────
  const handleDeclare = () => {
    if (!socket || !canDeclare || !activeTokenId) return

    // Drone : payload via hook (move optionnel + attaque optionnelle)
    if (isActiveDrone) {
      const { stateFireMode, mapActions } = droneDeclare.buildMapActions()
      socket.emit(WS.COMBAT_ACTION_DECLARE, {
        tokenId: activeTokenId,
        state: { position: 'standing', weapon: 'holstered', fire_mode: stateFireMode, cover: 'exposed', vitesse: 'normal' },
        mapActions,
      })
      return
    }

    // Assemblage du payload : fonction pure testée (module 0, docs/PLANS/PLAN_RW_DECLARE_DESIGN.md
    // §5.4 M0.2). Golden master : client/src/lib/buildDeclarePayload.test.mjs.
    socket.emit(WS.COMBAT_ACTION_DECLARE, buildGmDeclarePayload({
      activeTokenId,
      decl,
      pendingMove, chargeSelection,
      weapon, assaultTargets, effectiveAssaultCount,
      isDualWield, hasTwoWeapons, sameFirMode, weaponMg, currentVariant, dualWieldBonusComp,
      aimTranches, aimedLocation, aoeDirection: assaultDecl.state.aoeDirection,
      meleeTargets, effectiveMeleeCount, weaponInvIdForMelee, naturalWeaponIdForMelee,
      effectiveDualWieldMelee, meleeOffhandWeapon,
      mapAction,
    }))
  }

  // ── Etat CaC / Tir actif (pour l'affichage) — dérivés de `meleeStarted` / `attackStarted`
  //    calculés plus haut (source unique avec `declareChecks`).
  const isReloading   = mapAction === 'reload'
  const isMeleeSetup  = isActivePnj && meleeStarted
  const isAttackActive = attackStarted && !isReloading   // D7 : Recharger remplace le Tir

  // Survol ambiant (COMBAT-DEPLACEMENT-HOVER) : ne masque la fenêtre que si une destination PNJ a
  // été posée et attend validation — pas pendant le simple survol (option 1, décision Saar).
  const hasPendingPlainMove = combatMoveMode?.tokenId === activeTokenId && !!pendingMoveSelection && decl.combatMode !== 'charge'
  // Ajouté (pas remplacé isSelectingOnMap, qui conflate move-Charge et ciblage tuile pour le MJ,
  // contrairement au PJ qui a 2 flags séparés) — le clic direct (useCombatClickAttack.js) arme
  // combatTargetMode sans jamais positionner isSelectingOnMap, la fenêtre restait donc visible
  // pendant ce flux (retour Saar 2026-07-31).
  const isTargetingViaClick = combatTargetMode?.tokenId === activeTokenId

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {isActivePnj && (
        <CombatDeclareStatePanel
          pos={pos}
          windowWidth={(isMeleeSetup || isAttackActive) ? 720 : 440}
          family="gm-pnj"
          positionMode="absolute"
          decl={decl}
          initial={initialStates}
          onChange={(axis, value) => dispatch({ type: 'SET_FIELD', key: axis, value })}
          hidden={isSelectingOnMap || droneDeclare.isSelectingOnMap || hasPendingPlainMove || isTargetingViaClick}
        />
      )}
    <div className="combat-win" data-decl data-family={isActiveDrone ? 'drone' : 'gm-pnj'} style={{ width: (isMeleeSetup || isAttackActive) ? 720 : 440, left: pos.left, top: pos.top, opacity: (isSelectingOnMap || droneDeclare.isSelectingOnMap || hasPendingPlainMove || isTargetingViaClick) ? 0 : 1, pointerEvents: (isSelectingOnMap || droneDeclare.isSelectingOnMap || hasPendingPlainMove || isTargetingViaClick) ? 'none' : 'auto' }}>

      {/* HEADER */}
      <CombatDeclareHeader
        baseClass="combat-win-header"
        name={activeTokenId ? getLabel(activeTokenId) : t('gmDeclareWindow.title')}
        declared={allGmManaged.length - unannouncedCnt}
        total={allGmManaged.length}
        onMouseDown={onHeaderMouseDown}
      />

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* COLONNE GAUCHE */}
        <div style={{ flex: '0 0 440px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* CONTROLS — seulement si c'est le tour d'un PNJ */}
          {isActivePnj && (
            <div style={S.controls}>

              {/* Posture / Vitesse / Arme → satellite d'état (CombatDeclareStatePanel, module 3).
                  La Vitesse repasse en puce à cycle comme le PJ (D1 « fenêtre MJ = PJ », Session 158
                  caduque). */}

              {/* ── Corps : move-line + liste d'armes groupée (CombatDeclareActionList, module 4). ── */}
              <CombatDeclareActionList
                move={{
                  on: !!pendingMove,
                  disabled: false,
                  valueLabel: pendingMove
                    ? `[${pendingMove.targetPosX}, ${pendingMove.targetPosY}]`
                    : t('declareList.moveDefine'),
                  tooltip: t('mapActions.move.tooltip'),
                  onToggle: () => { if (pendingMove) setPendingMove(null); rearmMove() },
                }}
                groups={weaponGroups}
                selectedRowId={gmSelectedRowId}
                onPick={handleGmWeaponPick}
                reload={{ active: isReloading, onToggle: () => setMapAction(prev => prev === 'reload' ? null : 'reload') }}
              />

              {/* ACTIONS RAPIDES */}
              <div className="combat-win-section" style={{ borderBottom: 'none' }}>
                <span className="combat-win-section-title" style={{ color: '#5a8a5a' }}>{t('gmDeclareWindow.quickActionsSection')}</span>
                <div style={S.quickList}>
                  {QUICK_ACTIONS.map(qa => {
                    if (qa.kind === 'incremental') {
                      const val = decl.quick[qa.k] ?? 0
                      return (
                        <div key={qa.k}
                          title={t(qa.tooltip)}
                          style={{ ...S.quickRow, ...(val > 0 ? S.quickRowActive : {}) }}
                          onClick={() => val === 0 && dispatch({ type: 'SET_QUICK', key: qa.k, value: 1 })}
                        >
                          <span style={S.quickLabel}>{t(qa.l)}</span>
                          <div style={S.sliderWrap} onClick={val > 0 ? e => e.stopPropagation() : undefined}>
                            <input type="range" min={0} max={qa.max} step={1} value={val}
                              disabled={val === 0}
                              style={{ ...S.slider, opacity: val > 0 ? 1 : 0.3 }}
                              onChange={e => dispatch({ type: 'SET_QUICK', key: qa.k, value: Number(e.target.value) })} />
                            <span style={{ ...S.sliderVal, color: val > 0 ? '#5b8dee' : '#456575' }}>
                              {val > 0 ? `${val * qa.stepIni}` : '–'}
                            </span>
                          </div>
                        </div>
                      )
                    }
                    const isOn = !!decl.quick[qa.k]
                    return (
                      <div key={qa.k}
                        title={t(qa.tooltip)}
                        style={{ ...S.quickRow, ...(isOn ? S.quickRowActive : {}) }}
                        onClick={() => dispatch({ type: 'SET_QUICK', key: qa.k, value: !decl.quick[qa.k] })}
                      >
                        <span style={S.quickLabel}>{t(qa.l)}</span>
                        {qa.ini && <span style={{ color: isOn ? '#5b8dee' : '#456575', fontSize: 10 }}>{qa.ini}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* DRONE — Déplacement + sélection arme + cible */}
          {isActiveDrone && (
            <DroneDeclareSection
              pendingMove={droneDeclare.pendingMove}
              onMoveToggle={droneDeclare.rearmDroneMove}
              hasPassed={droneDeclare.hasPassed}
              onPassToggle={() => droneDeclare.setHasPassed(p => !p)}
              droneWeapons={droneDeclare.droneWeapons}
              selectedWeaponId={droneDeclare.selectedDroneWeaponId}
              onWeaponSelect={droneDeclare.setSelectedDroneWeaponId}
              assaultTargetId={droneDeclare.assaultTargetId}
              onChooseTarget={() => droneDeclare.handleChooseTarget(activeToken)}
              getLabel={getLabel}
              style={S.controls}
            />
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
                  <div style={S.monitorTitle}>{t('gmDeclareWindow.monitorTitle')}</div>

                  {/* Actions sélectionnées */}
                  {pjPreview.actions?.length > 0 && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>⚡</span>
                      <span style={S.monitorText}>
                        {pjPreview.actions.join(' + ')}
                      </span>
                    </div>
                  )}

                  {/* Cible(s) assaut — Tir Multi (docs/PLAN_TIRMULTI.md) */}
                  {pjPreview.assaultTargetIds?.length > 0 && (
                    <div style={S.monitorRow}>
                      <span style={S.monitorIcon}>→</span>
                      <span style={{ ...S.monitorText, color: '#e07070' }}>
                        {pjPreview.assaultTargetIds.filter(Boolean).map(id => getLabel(id)).join(', ')}
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
                      {isRanged(tid) ? t('gmDeclareWindow.rangedTag') : (equipment[tid]?.weapon ? t('gmDeclareWindow.meleeTag') : '···')}
                    </span>
                    <span style={S.rosterIni}>{t('ini')} {entry.initiative}</span>
                  </div>
                )
              })}
            </div>}
          </div>
        </div>

        {(isMeleeSetup || isAttackActive) && (
        <div className="decl-col2">
        {/* Recharger : ↻ sur la ligne d'arme (col. 1, option B). Le MJ n'a pas de sélecteur de
            munition — le mode Recharger est un booléen, la col. 2 ne s'ouvre pas pour lui. */}

        {/* PANNEAU DROIT — Mode CaC */}
        {isMeleeSetup && isActivePnj && (
          <div style={{ ...S.meleePanelGm, flex: 1, minHeight: 0 }}>
            <MeleeCombatPanel
              availableWeapons={meleeWeaponAvailable ? [{ id: meleeWeaponAvailable.inv_id, label: meleeWeaponAvailable.name ?? 'Arme', slot: meleeWeaponAvailable.slot ?? '', damage: '', allonge: 0 }] : []}
              selectedWeaponId={effectiveGmMeleeWeaponId}
              isWeaponDrawn={true}
              hasMeleeInInventory={false}
              onWeaponChange={(id) => {
                meleeDecl.selectWeapon(id)
                if (id !== null && decl.weapon !== 'drawn') {
                  dispatch({ type: 'SET_FIELD', key: 'weapon', value: 'drawn' })
                } else if (id === null && decl.weapon !== 'holstered') {
                  dispatch({ type: 'SET_FIELD', key: 'weapon', value: 'holstered' })
                }
              }}
              naturalWeapons={naturalWeaponsAvailable.map(m => ({
                id: m.id, label: m.name,
                formula: m.natural_weapon_formula, requiresGrapple: m.natural_weapon_requires_grapple,
              }))}
              selectedNaturalWeaponId={naturalWeaponIdForMelee}
              onNaturalWeaponChange={meleeDecl.selectNatural}
              targetIsGrappled={
                tokens.find(tk => tk.id === meleeTargets[0])?.statuses?.includes('grappled') ?? false
              }
              combatMode={decl.combatMode}
              onModeChange={(mode) => {
                dispatch({ type: 'SET_COMBAT_MODE', mode })
                if (mode !== 'charge') meleeDecl.setCharge(null)
              }}
              onStartCharge={handleStartCharge}
              onStartRetraite={null}
              chargeMoveDest={chargeSelection?.move ?? null}
              chargeTargetLabel={chargeSelection?.targetTokenId ? (tokens.find(tk => tk.id === chargeSelection.targetTokenId)?.label ?? null) : null}
              meleeCount={meleeAttackCount}
              effectiveMeleeCount={effectiveMeleeCount}
              onMeleeCountChange={meleeDecl.setCount}
              perSlotTargeting={true}
              targetIds={chargeSelection?.targetTokenId ? [chargeSelection.targetTokenId] : meleeTargets}
              isInTargetMode={combatTargetMode?.tokenId === activeTokenId && !chargeSelection?.targetTokenId}
              tokens={tokens}
              onChooseTarget={(i) => handleStartMelee(i)}
              showReadyBadge={false}
              showDualWieldSection={showDualWieldMeleeSection}
              isDualWield={isDualWieldMelee}
              onDualWieldChange={meleeDecl.setDualWield}
              offhandWeaponDisplay={meleeOffhandWeapon ? (meleeOffhandWeapon.name ?? t('meleeCombatPanel.weaponFallback')) : null}
            />
          </div>
        )}

        {/* PANNEAU DROIT — Tir */}
        {isAttackActive && isActivePnj && (
          <div style={{ ...S.assaultPanelGm, flex: 1, minHeight: 0 }}>
            <AssaultRangedPanel
              weaponDisplay={weapon ? `${weapon.name ?? 'Arme'} (${weapon.slot ?? '?'})` : null}
              weaponMdDisplay={(hasTwoWeapons && weaponMd) ? `${weaponMd.name ?? 'Arme'} (${weaponMd.slot ?? '?'})` : null}
              targetIds={assaultTargets}
              getLabel={getLabel}
              onChooseTarget={(i) => handleStartAttack(i)}
              showDualWieldSection={hasTwoWeapons && sameFirMode}
              isDualWield={isDualWield}
              currentFireMode={currentFireMode}
              availableFireModes={availableFireModes}
              onFireModeChange={v => {
                dispatch({ type: 'SET_FIELD', key: 'fire_mode', value: v })
                assaultDecl.setBulletCount(null); assaultDecl.setVariantAB('A'); assaultDecl.setAimTranches(0)
              }}
              onDualWieldChange={assaultDecl.setDualWield}
              assaultBulletCount={assaultBulletCount}
              effectiveBulletCount={effectiveBulletCount}
              assaultVariantAB={assaultVariantAB}
              ccSliderDisplayIdx={ccSliderDisplayIdx}
              currentVariant={currentVariant}
              dualWieldBonusComp={dualWieldBonusComp}
              onBulletCountChange={assaultDecl.setBulletCount}
              onVariantABChange={assaultDecl.setVariantAB}
              aimTranches={aimTranches}
              onAimTranchesChange={assaultDecl.setAimTranches}
              aimIneligibilityReasons={aimIneligibilityReasons}
              lunetteNiveau={weapon?.lunette_niveau ?? 0}
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

      </div>{/* fin body flex-row */}

      {/* POIGNÉE BAS */}
      <div onMouseDown={onHeaderMouseDown} style={S.bottomHandle} />

      {/* FOOTER */}
      <div className="combat-win-footer">
        {isActiveDrone && droneAlluresError && (
          <div style={{ fontSize: 9, color: '#c83030', background: 'rgba(200,48,48,0.08)', border: '1px solid #c8303044', borderRadius: 2, padding: '4px 8px', fontFamily: 'monospace' }}>
            ⚠ {t('droneDeclare.movementUnavailable', { reason: droneAlluresError })}
          </div>
        )}
        <CombatDeclareErrorBanner />
        <CombatDeclareFooter
          currentInitiative={activePnjEntry?.initiative ?? 0}
          iniDelta={iniDelta}
          iniBreakdown={iniBreakdown}
          hasCompleteAction={hasCompleteAction}
          canDeclare={canDeclare}
          blockReason={blockReason}
          hasActiveSlot={isActivePnj || isActiveDrone}
          onDeclare={handleDeclare}
          onPassTurn={() => socket?.emit(WS.COMBAT_ACTION_DECLARE, { tokenId: activeTokenId, state: {}, mapActions: {} })}
        />
      </div>

    </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  headerProgress: { fontSize: 9, color: '#5a6575', fontFamily: 'monospace' },
  headerActiveToken: {
    fontSize: 10, fontWeight: 700, color: '#e8c870',
    flex: 1, textAlign: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    padding: '0 6px',
  },
  headerActiveTokenWait: { color: '#5a7080', fontStyle: 'italic', fontWeight: 400 },
  bottomHandle: {
    height: 6, flexShrink: 0,
    background: 'rgba(90,100,120,0.12)',
    borderTop: '1px solid rgba(90,100,120,0.18)',
    cursor: 'ns-resize',
  },

  controls: { flexShrink: 0, borderBottom: '1px solid #15212e' },

  weaponInfo: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 },
  weaponInfoLine: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  weaponInfoAmmo: { fontWeight: 700 },
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap' },

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
