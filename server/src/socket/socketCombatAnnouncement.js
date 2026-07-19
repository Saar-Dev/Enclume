import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition } from '../lib/combatFSM.js'
import { skipPlayer, startResolutionPhase, forceAdvanceResolution } from './socketCombatHelpers.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { getAimBonusComp, getAimIniCost, isAimEligible, getLunetteNiveau } from '../../../shared/combatExclusiveActions.js'
import { AIMED_LOCATION_MALUS } from '../../../shared/armorConstants.js'
import { combatDestinationFromPayload, selectCombatMovementForCost } from '../../../shared/combatMovement.js'
import { worldPointToDbPosition } from '../../../shared/world/worldMetrics.js'
import { getCharacterMovementBudget } from '../services/movementBudgetService.js'
import { planBattlemapTokenMovement } from '../services/worldMovementService.js'
import { hasEnoughAmmo, parseAmmoCapacity } from '../../../shared/ammoRules.js'
import { resolveDualWieldFire } from '../../../shared/dualWieldRules.js'

// Fetch arme équipée en main pour un Assaut — factorisé (COM29 : main directrice ET non-directrice
// appellent ce même fetch, jamais deux copies divergentes du même bloc DB). Aucune règle métier ici :
// la main directrice bloque le tour sur échec (messages dédiés dans l'appelant), la main non-directrice
// dégrade silencieusement en tir simple (shared/ammoRules.js::resolveDualWieldFire).
async function fetchHandWeaponForAssault(weaponInvId, characterId) {
  const weapon = await db('char_inventory')
    .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
    .where({ 'char_inventory.id': weaponInvId, 'char_inventory.character_id': characterId })
    .select('char_inventory.ammo_remaining', 'ref_equipment.range as ref_range', 'ref_equipment.fire_mode as ref_fire_mode', 'ref_equipment.ammo_count as ref_ammo_count')
    .first()
  if (!weapon) return { weapon: null, inHand: false }
  const inHandRow = await db('char_inventory_slots')
    .where({ char_inventory_id: weaponInvId })
    .whereIn('slot_code', ['MG', 'MD', '2M', 'Tr'])
    .first()
  return { weapon, inHand: !!inHandRow }
}

async function planCombatWorldMovement(token, character, move) {
  if (token.position_space !== 'world-feet') throw new RangeError('Le token utilise encore une position legacy')
  const battlemap = await db('battlemaps').where({ id: token.battlemap_id }).first()
  if (!battlemap) throw new RangeError('Battlemap introuvable')
  const destination = combatDestinationFromPayload(move)
  const maximum = await getCharacterMovementBudget(character.id, 'max')
  const preview = await planBattlemapTokenMovement({
    battlemap,
    token,
    destination,
    authorizedBudgetM: maximum.budgetM,
  })
  if (!preview.plan || preview.status === 'unreachable') throw new RangeError('Destination inaccessible')
  const movement = selectCombatMovementForCost(preview.routeCostM, maximum.allures)
  if (!movement) throw new RangeError('Destination hors de portée maximale pour ce tour')
  return Object.freeze({
    ...movement,
    destination: preview.snappedTo,
    dbDestination: worldPointToDbPosition(preview.snappedTo),
    worldPlan: Object.freeze({ ...preview.plan, budgetM: movement.budgetM }),
    worldRevision: preview.worldRevision,
    runtimeRevision: preview.runtimeRevision,
  })
}

export function registerAnnouncementHandlers(io, socket, context, pendingMaps) {
  const { campaignId, user, isGm } = context

  // ─── COMBAT:ACTION_DECLARE v2 ─────────────────────────────────────────
  // Joueur (ou GM pour un PNJ) déclare son action pendant la phase ANNOUNCEMENT.
  // Payload v2 : { tokenId, state:{position,weapon,fire_mode,cover,vitesse}, mapActions:{move?,attack?,melee?,multi?,interact?}, quick:{observer,reperer,phrase} }
  socket.on(WS.COMBAT_ACTION_DECLARE, async ({ tokenId, state, mapActions, quick }) => {
    try {
      const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_ACTION_DECLARE')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_ACTION_DECLARE`)
        return
      }
      if (!tokenId || !state) return

      // Valeurs autorisées par état
      const VALID_STATES = {
        position:     ['standing', 'crouching', 'prone'],
        weapon:       ['holstered', 'ready', 'drawn'],
        fire_mode:    ['cc', 'rc', 'rl'],
        cover:        ['exposed', 'partial', 'important'],
        vitesse:      ['normal', 'delayed', 'rushed'],
        combat_mode:  ['normal', 'offensif', 'charge', 'defensif', 'retraite'],
      }
      for (const [k, vals] of Object.entries(VALID_STATES)) {
        if (state[k] && !vals.includes(state[k])) return
      }

      // CaC et Tir mutuellement exclusifs à la déclaration — une seule « Action de combat » par Tour
      // (LdB « Types d'Actions », docs/PLAN_COMBAT_TIMELINE.md §6sexies point 5). Le client empêche déjà
      // la double sélection, mais le serveur reste l'autorité — jamais confiance à une validation
      // client seule (`core.md`). Sans ce guard, un token avec les deux types d'action génère deux
      // familles d'entrées d'échelle simultanées côté Lot B, ce qui a fait planter le client à la
      // résolution de la première (trouvé par Saar en testant le Lot B/C, Session 158).
      // mapActions.attack est un array (docs/PLAN_TIRMULTI.md D1, 1 à 3 tirs) — même contrat que melee.
      const hasAttackDeclared = Array.isArray(mapActions?.attack) && mapActions.attack.length > 0
      const hasMeleeDeclared  = Array.isArray(mapActions?.melee)  && mapActions.melee.length  > 0
      if (hasAttackDeclared && hasMeleeDeclared) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, {
          message: 'Corps à corps et Assaut (tir) sont mutuellement exclusifs — une seule Action de combat par Tour',
        })
        return
      }
      // PC32bis (docs/PLAN_TIRMULTI.md) — plafond RAW à 3 Attaques par Tour (p.218, « c'est le maximum
      // autorisé »), jamais fait confiance au seul plafond UI (3 CountChip côté client). Le CaC n'a
      // jamais eu ce garde serveur (dette pré-existante, hors scope) — ne pas reproduire ce gap ici.
      if (hasAttackDeclared && mapActions.attack.length > 3) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Tir Multi : maximum 3 tirs par Tour (LdB p.218)' })
        return
      }

      // La forme PE14 du payload n'est qu'un adaptateur client ; les décimales monde sont valides.
      if (mapActions?.move) {
        const px = Number(mapActions.move.targetPosX)
        const py = Number(mapActions.move.targetPosY)
        const pz = Number(mapActions.move.targetPosZ)
        if (![px, py, pz].every(Number.isFinite)) {
          socket.emit('error', { message: 'Coordonnées de déplacement invalides (PC33)' })
          return
        }
      }

      // Validation ownership (joueur pour PJ, GM pour PNJ)
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return
      // PC27 — entité de décor : ne déclare pas d'action en combat
      if (!token.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character) return
      if (character.type === 'pnj') {
        if (!isGm) return
      } else if (character.type === 'drone') {
        const isOwner = character.user_id && character.user_id === user.id
        if (!isGm && !isOwner) return
      } else {
        if (character.user_id !== user.id) return
      }

      const entry = await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .first()
      if (!entry || entry.has_announced) return

      // LdB p.212 — guard ordre d'annonce : seul le slot actuel (base_ini ASC) peut déclarer
      const announceState = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!announceState || announceState.phase !== 'ANNOUNCEMENT') return
      const firstNonAnnounced = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
        .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
        .first()
      if (!firstNonAnnounced || firstNonAnnounced.token_id !== tokenId) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Ce n'est pas encore votre tour de déclarer" })
        return
      }

      let movementDeclaration = null
      if (mapActions?.move) {
        try {
          movementDeclaration = await planCombatWorldMovement(token, character, mapActions.move)
        } catch (error) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: error.message })
          return
        }
      }

      // Stun guard — is_stunned lit depuis token_statuses (source unique post-Sprint 14-0)
      // Gaté par status_effects_mode (PLAN 14 Sprint 14-3) — 'enforced' uniquement
      const { status_effects_mode: statusEffectsMode } = await getCampaignSettings(db, campaignId)
      const stunRow = statusEffectsMode === 'enforced'
        ? await db('token_statuses').where({ token_id: tokenId, status_code: 'stunned' }).first()
        : null
      if (stunRow) {
        if (hasAttackDeclared) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — ne peut pas attaquer" })
          return
        }
        if (mapActions?.melee?.length > 0) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — ne peut pas attaquer au corps à corps" })
          return
        }
        if (movementDeclaration && ['rapide', 'max'].includes(movementDeclaration.gait)) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — allure maximale : Moyenne" })
          return
        }
      }

      const isDrone = character.type === 'drone'

      // PC22 — arme requise pour assaut + PC23 (TIR_AUTOMATIQUE pour RC/RL)
      let assaultWeaponRefRange = null
      if (hasAttackDeclared) {
        const firstAttack = mapActions.attack[0]
        // Tir Multi (docs/PLAN_TIRMULTI.md D6) — RAW « Attaques multiples » (p.218-219) ne couvre que
        // Tir simple/Tir à répétition (CC) pour un tireur humanoïde ; Rafale (RC/RL) et tireurs-drones
        // en sont exclus par défaut (RAW muet sur ces cas). Jamais fait confiance au seul masquage UI.
        if (mapActions.attack.length > 1 && (isDrone || (state.fire_mode ?? 'cc').toUpperCase() !== 'CC')) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Tir Multi : Tir simple/Tir à répétition (CC) uniquement, personnage non-drone' })
          return
        }
        // D9 (tranché Saar) — une seule arme pour toute la série : rejette toute divergence entre les
        // éléments plutôt que d'en tolérer une silencieusement (le serveur reste l'autorité, jamais
        // confiance au payload client — `core.md`).
        const sameWeaponAcrossSeries = mapActions.attack.every(a => (
          a.weaponInvId === firstAttack.weaponInvId &&
          a.offhandWeaponInvId === firstAttack.offhandWeaponInvId &&
          a.droneWeaponInvId === firstAttack.droneWeaponInvId &&
          !!a.isDualWield === !!firstAttack.isDualWield &&
          (a.bulletCount ?? 1) === (firstAttack.bulletCount ?? 1)
        ))
        if (!sameWeaponAcrossSeries) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Tir Multi : une seule arme pour toute la série' })
          return
        }
        if (isDrone) {
          // Drone : validation droneWeaponInvId contre drone_weapons
          const { droneWeaponInvId } = firstAttack
          if (!droneWeaponInvId) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: 'Assaut drone impossible — aucune arme drone sélectionnée' })
            return
          }
          const droneWeapon = await db('drone_weapons')
            .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
            .where({ 'drone_weapons.id': droneWeaponInvId, 'drone_weapons.character_id': character.id })
            .select('drone_weapons.*', 'ref_equipment.range as ref_range')
            .first()
          if (!droneWeapon) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Assaut drone impossible — l'arme drone sélectionnée est introuvable (désinstallée entre-temps ?)" })
            return
          }
          assaultWeaponRefRange = droneWeapon.ref_range ?? null
        } else {
          // Humanoïde : validation char_inventory + PC23
          const { weaponInvId, offhandWeaponInvId, isDualWield } = firstAttack
          if (!weaponInvId) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: 'Assaut impossible — aucune arme sélectionnée' })
            return
          }
          const { weapon, inHand } = await fetchHandWeaponForAssault(weaponInvId, character.id)
          if (!weapon) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Assaut impossible — l'arme sélectionnée est introuvable dans l'inventaire (transférée entre-temps ?)" })
            return
          }
          // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : lit char_inventory_slots au lieu d'une égalité
          // stricte sur char_inventory.slot — composite-safe.
          if (!inHand) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Assaut impossible — l'arme doit être équipée en main (MG/MD/2M/Trépied) avant de tirer" })
            return
          }
          // fire_mode vient de state.fire_mode (v2) — comparaison insensible à la casse
          const fireMode = (state.fire_mode ?? 'cc').toUpperCase()
          if (weapon.ref_fire_mode && !weapon.ref_fire_mode.toUpperCase().includes(fireMode)) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: `Mode de tir ${fireMode} non disponible pour cette arme (modes compatibles : ${weapon.ref_fire_mode})` })
            return
          }
          assaultWeaponRefRange = weapon.ref_range ?? null
          // PC23 — TIR_AUTOMATIQUE requis pour RC/RL (contrôle unique, indépendant de la main —
          // c'est une compétence du personnage, pas de l'arme)
          if (fireMode === 'RC' || fireMode === 'RL') {
            const sheet = await db('char_sheet').where({ character_id: character.id }).first()
            const autoSkill = sheet
              ? await db('char_skills').where({ char_sheet_id: sheet.id, skill_id: 'TIR_AUTOMATIQUES' }).first()
              : null
            if (!autoSkill) {
              socket.emit(WS.COMBAT_DECLARE_ERROR, {
                username: character.name,
                message: `Rafale (${fireMode}) impossible — la compétence Tir Automatique n'est pas acquise sur cette fiche. Repassez en Coup par coup (CC), ou ajoutez la compétence sur la fiche du personnage.`,
              })
              return
            }
          }
          // Vérification munitions ANNOUNCEMENT (MANUELSYSCOMBAT §4) — fail-fast déclaratif.
          // Autorité de la règle : shared/ammoRules.js (revérifiée à la Résolution, COM25). Tir Multi :
          // le total de munitions couvre TOUS les tirs de la série (bulletCount × nombre de tirs), pas
          // seulement le premier — vérifié avant toute insertion (docs/PLAN_TIRMULTI.md Lot A).
          const bulletCount = firstAttack.bulletCount ?? 1
          const totalBulletsNeeded = bulletCount * mapActions.attack.length
          let pnjUnlimited = false
          if (character.type === 'pnj') {
            const settings = await getCampaignSettings(db, campaignId)
            pnjUnlimited = settings.pnj_unlimited_ammo
          }
          const primaryAmmoOk = hasEnoughAmmo(weapon.ammo_remaining, totalBulletsNeeded, { isPnj: character.type === 'pnj', pnjUnlimitedAmmo: pnjUnlimited })

          // Tir à deux armes (COM29, LdB p.226) — la main non-directrice ne bloque jamais la
          // déclaration à elle seule : toute anomalie (arme introuvable, pas en main, mode de tir
          // incompatible, munitions insuffisantes) dégrade silencieusement en tir simple, décidé et
          // annoncé au joueur à la Résolution (shared/ammoRules.js::resolveDualWieldFire, autorité
          // unique — même décision recalculée côté Résolution avec l'état munitions le plus frais).
          // Dual-wield exclusif avec Tir Multi (D10) — offhandWeaponInvId n'est de toute façon jamais
          // renseigné par le client dès que la série dépasse 1 tir, mais on ne fait pas confiance à ça.
          let offhandAmmoOk = false
          if (isDualWield && offhandWeaponInvId && mapActions.attack.length === 1) {
            const { weapon: offhandWeapon, inHand: offhandInHand } = await fetchHandWeaponForAssault(offhandWeaponInvId, character.id)
            const offhandFireModeOk = offhandWeapon?.ref_fire_mode ? offhandWeapon.ref_fire_mode.toUpperCase().includes(fireMode) : true
            if (offhandWeapon && offhandInHand && offhandFireModeOk) {
              offhandAmmoOk = hasEnoughAmmo(offhandWeapon.ammo_remaining, totalBulletsNeeded, { isPnj: character.type === 'pnj', pnjUnlimitedAmmo: pnjUnlimited })
            }
          }

          const { fires } = resolveDualWieldFire({
            primaryAmmoOk, offhandAmmoOk,
            isDualWield: !!isDualWield && !!offhandWeaponInvId && mapActions.attack.length === 1,
          })
          if (fires === null) {
            // Deux messages distincts (retour Saar, 2026-07-19), pas un seul générique affiné :
            // - le total demandé dépasse la capacité MAX du chargeur (ex. 3 tirs à 10 balles sur un
            //   pistolet 7 coups) → recharger ne résoudrait rien, l'action elle-même est impossible ;
            // - le total demandé tient dans la capacité, mais le chargeur actuel est trop bas → seul
            //   ce cas invite à recharger.
            const capacity = parseAmmoCapacity(weapon.ref_ammo_count)
            const message = (capacity && totalBulletsNeeded > capacity)
              ? 'Action impossible — la capacité du chargeur ne permet pas ce tir'
              : "Munitions insuffisantes, recharger d'abord"
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message })
            return
          }
        }
      }

      // Matrices de coût de transition INI (miroir de STATE_DEFS dans combatSections.js)
      const STATE_COSTS = {
        position:  { standing: { crouching: -3, prone: -5 }, crouching: { standing: -3, prone: -5 }, prone: { standing: -10, crouching: -10 } },
        weapon:    { holstered: { ready: -3, drawn: -5 }, ready: { holstered: -5, drawn: -3 }, drawn: { holstered: -10, ready: -3 } },
        fire_mode: { cc: { rc: -3, rl: -3 }, rc: { cc: -3, rl: -3 }, rl: { cc: -3, rc: -3 } },
        cover:     {},
        vitesse:   { delayed: { normal: 0, rushed: 3 }, normal: { delayed: 0, rushed: 3 }, rushed: { delayed: 0, normal: 0 } },
      }
      const transitionCost = (costs, from, to) => from === to ? 0 : (costs?.[from]?.[to] ?? 0)

      // Tir visé (LdB p.227-228, docs/PLAN_TIRVISE.md) — calculé une fois, réutilisé pour
      // iniDelta ci-dessous ET pour la ligne combat_actions (aim_bonus_comp) plus bas. Exclusif avec
      // Tir Multi (docs/PLAN_TIRMULTI.md D10, tranché Saar) — forcé à 0 dès que la série dépasse 1 tir,
      // jamais confiance au seul masquage UI côté client.
      const aimTranches = (hasAttackDeclared && mapActions.attack.length === 1)
        ? (mapActions.attack[0]?.aimTranches ?? 0)
        : 0
      // Viser une Localisation précise (LdB p.229-230, COM9, docs/PLAN_TIRVISE v2.md) — annoncée ici
      // (même patron que Tir visé), aucun coût d'Initiative (contrairement à aimTranches). Validée
      // contre les clés réelles de AIMED_LOCATION_MALUS — jamais un slot forcé depuis une valeur
      // arbitraire envoyée par le client ; invalide → ignorée silencieusement (null), jamais un tour
      // de combat cassé. Exclusive avec Tir Multi (D10), même garde que Tir visé ci-dessus.
      const declaredAimedLocation = (hasAttackDeclared && mapActions.attack.length === 1)
        ? (mapActions.attack[0]?.aimedLocation ?? null)
        : null
      const aimedLocationKey = declaredAimedLocation && AIMED_LOCATION_MALUS[declaredAimedLocation] !== undefined
        ? declaredAimedLocation
        : null
      // Lunette de visée (docs/PLAN_MODING_PHASEB.md Groupe 2) — re-dérivée serveur depuis l'arme
      // déclarée, jamais transmise par le client. Fetch conditionnel (aimTranches>0) : la Lunette
      // n'affecte que le Tir visé, pas la peine d'interroger char_inventory_mods sinon.
      let lunetteNiveau = 0

      let iniDelta = 0
      if (!isDrone) {
        for (const key of ['position', 'weapon', 'fire_mode', 'cover', 'vitesse']) {
          const from = entry['state_' + key]
          const to   = state[key] ?? from
          iniDelta += transitionCost(STATE_COSTS[key], from, to)
        }
        // Charge/Retraite : déplacement gratuit — override ini_mod serveur (non trusté client)
        const freeMove = (state.combat_mode === 'charge' || state.combat_mode === 'retraite') && !!mapActions?.move
        if (movementDeclaration) iniDelta += freeMove ? 0 : movementDeclaration.initiativeModifier
        if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) {
          iniDelta += -3
          if (mapActions.melee.length > 1) iniDelta += -5
        }
        // Tir visé — validé/recalculé serveur, jamais confiance au client. isAimEligible bloque
        // déjà toute combinaison avec le CaC ou une transition d'état (règle "aucune autre action
        // ce tour", isExclusiveDeclaration/shared/combatExclusiveActions.js reste disponible pour
        // Charge/Rafale longue le jour où leur éligibilité, plus permissive, en aura besoin).
        if (aimTranches > 0) {
          const aimOk = isAimEligible({
            mapActions, state, quick, entry,
            isDualWield: !!mapActions.attack[0]?.isDualWield,
            bulletCount: mapActions.attack[0]?.bulletCount ?? null,
          })
          if (!aimOk) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Tir visé : aucune autre action ni transition d'état ce tour, arme déjà au clair, tir simple, une seule arme requise" })
            return
          }
          const aimWeaponInvId = mapActions.attack[0]?.weaponInvId
          if (aimWeaponInvId) {
            const installedMods = await db('char_inventory_mods as cim')
              .join('ref_equipment as re', 'cim.equipment_id', 're.id')
              .where({ 'cim.weapon_inv_id': aimWeaponInvId })
              .select('re.bonus', 're.mod_slot', 're.mod_requires_aim')
            lunetteNiveau = getLunetteNiveau(installedMods)
          }
          iniDelta += getAimIniCost(aimTranches, { lunetteNiveau })
        }
        iniDelta += (quick?.observer ?? 0) * -5
        iniDelta += (quick?.reperer  ?? 0) * -5
        if (quick?.phrase) iniDelta += -3
      }

      // Construction des lignes combat_actions (PC32 — sequence attribué serveur)
      const actionRows = []

      if (mapActions?.move) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: movementDeclaration.actionKey,
          type: movementDeclaration.actionType,
          sequence: 1,
          target_pos_x: movementDeclaration.dbDestination.pos_x,
          target_pos_y: movementDeclaration.dbDestination.pos_y,
          target_pos_z: movementDeclaration.dbDestination.pos_z,
          movement_gait: movementDeclaration.gait,
          destination_world: movementDeclaration.destination,
          world_plan: movementDeclaration.worldPlan,
          planned_world_revision: movementDeclaration.worldRevision,
          planned_runtime_revision: movementDeclaration.runtimeRevision,
          planned_budget_m: movementDeclaration.budgetM,
          modifiers: JSON.stringify({ ini_mod: movementDeclaration.initiativeModifier }),
          status: 'pending',
        })
      }

      // Tir Multi (docs/PLAN_TIRMULTI.md) : mapActions.attack est un array d'1 à 3 tirs, même arme
      // pour toute la série (D9, validé plus haut) — une ligne combat_actions par tir, seule la cible
      // varie. aimTranches/aimedLocationKey sont déjà forcés à 0/null dès que length > 1 (D10).
      if (hasAttackDeclared) {
        for (const {
          weaponInvId, offhandWeaponInvId, droneWeaponInvId, targetTokenId,
          bulletCount, fireModeBonusComp, fireModeBonusDmg, isDualWield, dualWieldBonusComp,
        } of mapActions.attack) {
          if (!targetTokenId) continue
          actionRows.push({
            campaign_id:          campaignId, token_id: tokenId,
            action_key:           'assault', type: 'assault', sequence: 3,
            weapon_inv_id:        isDrone ? null : (weaponInvId ?? null),
            offhand_weapon_inv_id: (isDrone || !isDualWield) ? null : (offhandWeaponInvId ?? null),
            drone_weapon_inv_id:  isDrone ? (droneWeaponInvId ?? null) : null,
            target_token_id:      targetTokenId,
            fire_mode:            state.fire_mode ?? null,
            bullet_count:         bulletCount ?? null,
            fire_mode_bonus_comp: fireModeBonusComp ?? null,
            fire_mode_bonus_dmg:  fireModeBonusDmg ?? null,
            aim_bonus_comp:       isDrone ? null : (getAimBonusComp(aimTranches, { lunetteNiveau }) || null),
            aimed_location:       isDrone ? null : aimedLocationKey,
            modifiers:            JSON.stringify({ ini_mod: 0, ref_range: assaultWeaponRefRange, dual_wield: isDualWield ?? false, dual_wield_bonus_comp: dualWieldBonusComp ?? 0 }),
            status:               'pending',
          })
        }
      }

      // Phase 1 : intention enregistrée sans validation distance (vérifiée en Phase 2)
      // mapActions.melee est un array : [{ targetTokenId, weaponInvId?, droneWeaponInvId? }, ...]
      if (Array.isArray(mapActions?.melee)) {
        for (const {
          targetTokenId: meleeTargetId, weaponInvId: meleeWeaponId, droneWeaponInvId: meleeDroneWeaponId,
          naturalWeaponCharMutationId: meleeNaturalWeaponId,
        } of mapActions.melee) {
          if (meleeTargetId) {
            actionRows.push({
              campaign_id: campaignId, token_id: tokenId,
              action_key: 'melee', type: 'melee', sequence: 3,
              weapon_inv_id:       meleeDroneWeaponId ? null : (meleeWeaponId ?? null),
              drone_weapon_inv_id: meleeDroneWeaponId ?? null,
              // Arme naturelle (mutation) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Un drone n'a
              // pas de mutations, toujours null dans cette branche (même garde que weapon_inv_id).
              natural_weapon_char_mutation_id: meleeDroneWeaponId ? null : (meleeNaturalWeaponId ?? null),
              target_token_id: meleeTargetId,
              modifiers: JSON.stringify({ ini_mod: -3 }),
              status: 'pending',
            })
          }
        }
      }

      if (mapActions?.interact) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'interact', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: 0 }), status: 'pending',
        })
      }

      if (mapActions?.reload) {
        const reloadData = typeof mapActions.reload === 'object' ? mapActions.reload : {}
        actionRows.push({
          campaign_id:  campaignId, token_id: tokenId,
          action_key:   'reload', type: 'reload', sequence: 3,
          weapon_inv_id: reloadData.weapon_inv_id ?? null,
          modifiers:    JSON.stringify({ ini_mod: 0, ammo_item_id: reloadData.ammo_item_id ?? null }),
          status:       'pending',
        })
      }

      if ((quick?.observer ?? 0) > 0) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'observer', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: quick.observer * -5 }), status: 'pending',
        })
      }

      if ((quick?.reperer ?? 0) > 0) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'reperer', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: quick.reperer * -5 }), status: 'pending',
        })
      }

      if (quick?.phrase) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'phrase', type: 'micro', sequence: 2,
          modifiers: JSON.stringify({ ini_mod: -3 }), status: 'pending',
        })
      }

      // Guard : CaC déclaré sans aucune cible → has_announced non settée, erreur explicite
      if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0
          && !mapActions.melee.some(m => m.targetTokenId)) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Corps à corps : sélectionner une cible avant de valider.' })
        return
      }
      // Idem Tir Multi (docs/PLAN_TIRMULTI.md) — au moins une cible sur la série de tirs.
      if (hasAttackDeclared && !mapActions.attack.some(a => a.targetTokenId)) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Assaut (tir) : sélectionner une cible avant de valider.' })
        return
      }

      // UPDATE combat_roster — états + initiative + has_announced
      const [updated] = await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .update({
          state_position:    state.position     ?? entry.state_position,
          state_weapon:      state.weapon       ?? entry.state_weapon,
          state_fire_mode:   state.fire_mode ?? entry.state_fire_mode,
          state_cover:       state.cover        ?? entry.state_cover,
          state_vitesse:     state.vitesse      ?? entry.state_vitesse,
          state_combat_mode: state.combat_mode  ?? entry.state_combat_mode,
          initiative:        db.raw('initiative + ?', [iniDelta]),
          has_announced:     true,
          updated_at:        db.fn.now(),
        })
        .returning(['initiative'])

      const updatedInitiative = updated.initiative

      // turn_number (docs/PLAN_COMBAT_TIMELINE.md §6bis point 5) — porté par chaque ligne pour que la
      // file "en cours" se filtre sur le Tour plutôt que sur le contenu total de la table, maintenant
      // que endTurn() ne vide plus combat_actions.
      if (actionRows.length > 0) {
        await db('combat_actions').insert(actionRows.map(row => ({ ...row, turn_number: announceState.current_turn })))
      }

      // Dériver actionType pour le broadcast
      let actionType = 'micro'
      if (hasAttackDeclared)        actionType = 'assault'
      else if (movementDeclaration) actionType = movementDeclaration.actionType
      else if (mapActions?.melee)  actionType = 'melee'
      else if (mapActions?.reload) actionType = 'reload'

      io.to(campaignId).emit(WS.COMBAT_ACTION_DECLARED, {
        tokenId,
        actionType,
        initiative_score: updatedInitiative,
        initiative:       updatedInitiative,
        // Coords PE14 destination déplacement (pour ghost spectateurs)
        moveTarget: movementDeclaration
          ? {
            x: movementDeclaration.dbDestination.pos_x,
            y: movementDeclaration.dbDestination.pos_y,
            z: movementDeclaration.dbDestination.pos_z,
          }
          : null,
        // Token cible (tir ou CaC, pour ligne d'annonce spectateurs) — premier tir de la série pour
        // Tir Multi (docs/PLAN_TIRMULTI.md), même patron que melee[0] déjà en place.
        attackTargetId: mapActions?.attack?.[0]?.targetTokenId
          ?? mapActions?.melee?.[0]?.targetTokenId
          ?? null,
      })

      // Nettoyer le timer auto-skip si actif
      const campaignTimersMap = pendingMaps.combatTimers.get(campaignId)
      if (campaignTimersMap?.has(tokenId)) {
        clearTimeout(campaignTimersMap.get(tokenId))
        campaignTimersMap.delete(tokenId)
      }

      // Purger le preview éphémère — le joueur a confirmé sa déclaration
      pendingMaps.combatPreviews.delete(campaignId)

      // PC13 — tous annoncés → phase Résolution, sinon émettre le slot suivant (LdB p.212)
      const [{ count }] = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false })
        .count('* as count')
      if (parseInt(count) === 0) {
        await startResolutionPhase(io, campaignId, pendingMaps)
      } else {
        const nextAnnounceSlot = await db('combat_roster')
          .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
          .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
          .first()
        if (nextAnnounceSlot) {
          io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: nextAnnounceSlot.token_id })
        }
      }

      console.log(`[WS] combat:action_declare v2 — ${user.username} state:${JSON.stringify(state)} iniDelta:${iniDelta} -> ${updatedInitiative}`)
    } catch (err) {
      console.error('[WS] combat:action_declare error:', err.message)
    }
  })

  // ─── COMBAT:SKIP_PLAYER ───────────────────────────────────────────────
  // GM passe le tour d'un joueur pendant la phase ANNOUNCEMENT, ou force la suite de l'étape en cours
  // pendant la RÉSOLUTION (docs/PLAN_COMBAT_TIMELINE.md Lot D — même bouton, même événement, comportement
  // qui dépend du sous-état bloqué : voir forceAdvanceResolution). Payload : { tokenId } — tokenId n'est
  // utile qu'en ANNONCE, ignoré en Résolution (le serveur dérive lui-même ce qui bloque).
  socket.on(WS.COMBAT_SKIP_PLAYER, async ({ tokenId }) => {
    if (!isGm) return
    try {
      const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_SKIP_PLAYER')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_SKIP_PLAYER`)
        return
      }
      if (_gPhase === 'RESOLUTION') {
        await forceAdvanceResolution(io, campaignId, pendingMaps)
        return
      }
      // Nettoyer le timer auto-skip si actif
      const campaignTimersMap = pendingMaps.combatTimers.get(campaignId)
      if (campaignTimersMap?.has(tokenId)) {
        clearTimeout(campaignTimersMap.get(tokenId))
        campaignTimersMap.delete(tokenId)
      }
      await skipPlayer(io, campaignId, tokenId, pendingMaps)
    } catch (err) {
      console.error('[WS] combat:skip_player error:', err.message)
    }
  })

  // ─── COMBAT:ANNOUNCE_PREVIEW — Preview éphémère en cours de déclaration ─
  // PJ émet ses sélections en cours (debounce client). Relay sans DB write.
  // Payload : { tokenId, actions[], assaultTargetId, meleeTargetIds[], moveDestination, combatMode }
  socket.on(WS.COMBAT_ANNOUNCE_PREVIEW, async (payload) => {
    if (!payload?.tokenId) return
    try {
      const token = await db('tokens').where({ id: payload.tokenId }).first()
      if (!token?.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character || character.user_id !== user.id) return
      pendingMaps.combatPreviews.set(campaignId, payload)
      io.to(campaignId).emit(WS.COMBAT_ANNOUNCE_PREVIEW, payload)
    } catch (err) {
      console.error('[WS] COMBAT_ANNOUNCE_PREVIEW error:', err.message)
    }
  })
}
