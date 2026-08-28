import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition } from '../lib/combatFSM.js'
import { skipPlayer, startResolutionPhase, forceAdvanceResolution } from './socketCombatHelpers.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { getAimBonusComp, getAimIneligibilityReasons, getLunetteNiveau, getExoStandUpIneligibilityReasons, isExclusiveDeclaration, getAoeExclusiveIneligibilityReasons } from '../../../shared/combatExclusiveActions.js'
import { AIMED_LOCATION_MALUS } from '../../../shared/armorConstants.js'
import { combatDestinationFromPayload, selectCombatMovementForCost } from '../../../shared/combatMovement.js'
import { worldPointToDbPosition } from '../../../shared/world/worldMetrics.js'
import { getCharacterMovementBudget } from '../services/movementBudgetService.js'
import { planBattlemapTokenMovement } from '../services/worldMovementService.js'
import { hasEnoughAmmo, parseAmmoCapacity } from '../../../shared/ammoRules.js'
import { resolveDualWieldFire } from '../../../shared/dualWieldRules.js'
import { isTestBlockingWound, isMortalWoundImmobilized } from '../../../shared/woundConstants.js'
import { setCharacterState } from '../lib/characterStateService.js'
import { shadowCheckCharacterState } from '../lib/characterStateShadowCheck.js'
import { computeIniDelta } from '../../../shared/combatIniCost.js'
import { getOwnedHandWeapon, WEAPON_SLOTS } from '../services/inventoryService.js'
import { isExoActorAuthorized, resolveCombatantIdentity } from '../lib/combatantContextService.js'
import { firstFireMode } from '../../../shared/fireModes.js'

// MELEE-INHAND / ASSAULT-INHAND-RESOLUTION (docs/BUGIDENTIFIE.md, 2026-08-05) — la résolution
// "arme possédée et en main" passe désormais entièrement par getOwnedHandWeapon
// (inventoryService.js), autorité unique pour le combat (Tir et CaC, principale et secondaire,
// Déclaration et Résolution). L'ancien fetchHandWeaponForAssault (SQL brut local à ce fichier) est
// supprimé — c'était l'une des réimplémentations divergentes qui a permis à l'arme principale CaC
// et à la résolution du Tir de ne jamais recevoir ce contrôle.

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
  // Payload v2 : { tokenId, state:{position,weapon,fire_mode,cover,vitesse}, mapActions:{move?,attack?,melee?,multi?}, quick:{observer,reperer,phrase} }
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
        position:     ['standing', 'crouching', 'kneeling', 'prone'],
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
      } else if (character.type === 'exo') {
        // PLAN_EXOARMURE.md Lot 2bis §9.3 (trouvé en câblant le côté MJ) — sans cette branche, 'exo'
        // tombait dans le else générique ci-dessous (propriétaire brut seul), rendant la déclaration
        // impossible pour un pilote ≠ propriétaire. Même autorité que l'édition de fiche (Lot 1 §6.3,
        // combatantContextService.js:isExoActorAuthorized, une seule source pour "GM/propriétaire/pilote").
        if (!(await isExoActorAuthorized(db, character, { isGm, userId: user.id }))) return
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

      // WNDMORT (docs/BUGIDENTIFIE.md) — Blessure mortelle : REGLEBLESSURES.md « Malus aux Tests : non
      // applicable, le blessé ne peut entreprendre aucune action demandant un Test. » Décision Saar
      // (2026-07-19) : seules Déplacement (Allure lente, sauf Jambes) et Passer le tour restent
      // possibles — même patron que le stun guard ci-dessus. Pas de garde `status_effects_mode` ici :
      // c'est une blessure physique réelle (`character_wounds`), pas un statut cosmétique togglable.
      //
      // Bug trouvé en analyse à charge PLAN_EXOARMURE.md §16.4 (2026-08-26) : `character.id` n'a
      // jamais de `char_sheet` pour une exo-armure (elle a une `exo_sheet`, MANUEL_EXOARMURE.md §3.1)
      // — cette garde no-opait donc silencieusement pour toute exo depuis l'Étape A (déjà shippée) :
      // un pilote mortellement blessé pouvait faire bouger son exo sans restriction d'allure. Une
      // exo-armure ne teste jamais rien avec ses propres stats (elle n'en a pas) : c'est le pilote qui
      // doit être mortellement blessé ou non — `resolveCombatantIdentity` (combatantContextService.js,
      // déjà l'autorité unique pour "quelle fiche représente ce combattant") résout au bon `sheetId`
      // dans les deux cas, jamais une seconde résolution ad hoc ici.
      if (character.type !== 'drone') {
        const { sheetId: mortalSheetId } = await resolveCombatantIdentity(db, character)
        const woundsMortal = mortalSheetId
          ? await db('character_wounds').where({ char_sheet_id: mortalSheetId })
          : []
        if (isTestBlockingWound(woundsMortal)) {
          if (hasAttackDeclared) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Blessure mortelle — aucune action de Test possible' })
            return
          }
          if (mapActions?.melee?.length > 0) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Blessure mortelle — aucune action de Test possible' })
            return
          }
          if (mapActions?.reload) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Blessure mortelle — aucune action de Test possible' })
            return
          }
          if (movementDeclaration) {
            if (isMortalWoundImmobilized(woundsMortal)) {
              socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Blessure mortelle (jambe) — déplacement impossible' })
              return
            }
            if (movementDeclaration.gait !== 'lente') {
              socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Blessure mortelle — déplacement Allure lente maximum' })
              return
            }
          }
        }
      }

      const isDrone = character.type === 'drone'
      const isExo   = character.type === 'exo'

      // PC22 — arme requise pour assaut + PC23 (TIR_AUTOMATIQUE pour RC/RL)
      let assaultWeaponRefRange = null
      if (hasAttackDeclared) {
        const firstAttack = mapActions.attack[0]
        // Tir Multi (docs/PLAN_TIRMULTI.md D6) — RAW « Attaques multiples » (p.218-219) ne couvre que
        // Tir simple/Tir à répétition (CC) pour un tireur humanoïde ; Rafale (RC/RL) et tireurs-drones
        // en sont exclus par défaut (RAW muet sur ces cas). Jamais fait confiance au seul masquage UI.
        // Exo-armure (PLAN_EXOARMURE.md §16.4) — REGLEARMURE.md:206-207/MANUEL §4.5 : « une armure
        // mécanisée ne peut effectuer qu'une seule Attaque par Tour », y compris en Tir simple/CC —
        // exclusion totale, pas seulement RC/RL.
        if (mapActions.attack.length > 1 && (isDrone || isExo || (state.fire_mode ?? 'cc').toUpperCase() !== 'CC')) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Tir Multi : Tir simple/Tir à répétition (CC) uniquement, personnage non-drone et non-exo' })
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
        } else if (isExo) {
          // Exo-armure (PLAN_EXOARMURE.md §16.4) : validation exoWeaponInvId contre exo_weapons —
          // jamais char_inventory (arme dans le mauvais inventaire, §16.1) ni drone_weapons (Seuil à
          // plat, non RAW pour une exo). Pas de notion "en main"/dual-wield (armes hardpoint) ni de
          // mods (aucun système de mod exo à ce jour) — mirroir du bloc drone ci-dessus, pas du
          // bloc humanoïde.
          const { exoWeaponInvId } = firstAttack
          if (!exoWeaponInvId) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: 'Assaut exo impossible — aucune arme exo sélectionnée' })
            return
          }
          const exoWeapon = await db('exo_weapons')
            .leftJoin('ref_equipment', 'exo_weapons.ref_equipment_id', 'ref_equipment.id')
            .where({ 'exo_weapons.id': exoWeaponInvId, 'exo_weapons.character_id': character.id })
            .select('exo_weapons.*', 'ref_equipment.name as ref_name', 'ref_equipment.range as ref_range', 'ref_equipment.fire_mode as ref_fire_mode', 'ref_equipment.ammo_count as ref_ammo_count')
            .first()
          if (!exoWeapon) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Assaut exo impossible — l'arme exo sélectionnée est introuvable (désinstallée entre-temps ?)" })
            return
          }
          // fire_mode — bug trouvé en jeu réel (Saar, 2026-08-26) : comparer contre state.fire_mode
          // était la mauvaise autorité. state.fire_mode modélise le sélecteur d'un PJ humain (une
          // arme en main, un mode qu'on bascule — StateSelector/CombatActionWindow.jsx, coûte de
          // l'Initiative en changeant, combatIniCost.js STATE_TRANSITION_COST.fire_mode) ; une exo n'a
          // pas cette notion, chaque
          // hardpoint tire dans le(s) mode(s) fixe(s) de son arme (§16.4). Le client n'envoie jamais
          // state.fire_mode pour une exo (CombatExoActionWindow.jsx) donc `state.fire_mode ?? 'cc'`
          // retombait toujours sur 'CC' — bloquant toute arme RC/RL-only montée sur un hardpoint (ex.
          // F67, Lance-flammes, catalogue "Armes" général attachable via `/exo/weapons` sans
          // restriction de family, cf. char-sheet.js validateExoEquipmentSource). Mode dérivé
          // directement de l'arme (premier mode listé si plusieurs, mirroir CombatActionWindow.jsx
          // #availableFireModes/modes[0]) — jamais un état à faire correspondre.
          assaultWeaponRefRange = exoWeapon.ref_range ?? null
          // PC23 — TIR_AUTOMATIQUE requis pour RC/RL (décision Saar 2026-08-27 : règle identique à
          // l'humanoïde, cf. bloc `else` ci-dessous). Une exo ne bascule jamais de mode : le mode
          // appliqué est celui par défaut de l'arme (firstFireMode, shared/fireModes.js — jamais
          // state.fire_mode, concept PJ humain, cf. commentaire fire_mode ci-dessus). La Compétence
          // est celle du PILOTE (resolveCombatantIdentity → sheetId = char_sheet du pilote, autorité
          // unique « retrouver le pilote d'un exo », combatantContextService.js) — jamais une
          // char_sheet propre à l'exo, qui n'existe pas.
          const exoFireMode = firstFireMode(exoWeapon.ref_fire_mode)
          if (exoFireMode === 'RC' || exoFireMode === 'RL') {
            const { sheetId } = await resolveCombatantIdentity(db, character)
            const autoSkill = sheetId
              ? await db('char_skills').where({ char_sheet_id: sheetId, skill_id: 'TIR_AUTOMATIQUES' }).first()
              : null
            if (!autoSkill) {
              const weaponLabel = exoWeapon.label_override || exoWeapon.ref_name || 'sélectionnée'
              socket.emit(WS.COMBAT_DECLARE_ERROR, {
                username: character.name,
                message: `L'arme « ${weaponLabel} » de l'exo-armure tire en rafale (${exoFireMode}) : le pilote doit posséder la compétence Tir Automatique pour l'utiliser. Installez une arme en Coup par coup sur ce hardpoint, ou ajoutez la compétence sur la fiche du pilote.`,
              })
              return
            }
          }
          // Munitions (§16.2.3) — fail-fast déclaratif, même autorité que l'arme humanoïde
          // (shared/ammoRules.js, revérifiée à la Résolution). ammo_remaining NULL = tracking désactivé
          // (aucun mécanisme de rechargement/init exo construit à ce jour, §16.2.3 — hasEnoughAmmo
          // traite donc toute arme exo comme illimitée tant que ce chantier séparé n'est pas fait,
          // jamais une supposition différente ici).
          const exoBulletCount = firstAttack.bulletCount ?? 1
          if (!hasEnoughAmmo(exoWeapon.ammo_remaining, exoBulletCount)) {
            const capacity = parseAmmoCapacity(exoWeapon.ref_ammo_count)
            const message = (capacity && exoBulletCount > capacity)
              ? 'Action impossible — la capacité du chargeur ne permet pas ce tir'
              : "Munitions insuffisantes, recharger d'abord"
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message })
            return
          }
        } else {
          // Humanoïde : validation char_inventory + PC23
          const { weaponInvId, offhandWeaponInvId, isDualWield } = firstAttack
          if (!weaponInvId) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: 'Assaut impossible — aucune arme sélectionnée' })
            return
          }
          const weapon = await getOwnedHandWeapon(character.id, weaponInvId, { slotCodes: WEAPON_SLOTS })
          if (!weapon) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Assaut impossible — l'arme sélectionnée est introuvable dans l'inventaire (transférée entre-temps ?)" })
            return
          }
          // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : lit char_inventory_slots au lieu d'une égalité
          // stricte sur char_inventory.slot — composite-safe.
          if (!weapon.inHand) {
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
            const offhandWeapon = await getOwnedHandWeapon(character.id, offhandWeaponInvId, { slotCodes: WEAPON_SLOTS })
            const offhandFireModeOk = offhandWeapon?.ref_fire_mode ? offhandWeapon.ref_fire_mode.toUpperCase().includes(fireMode) : true
            if (offhandWeapon?.inHand && offhandFireModeOk) {
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

          // Action exclusive AOE (Tir de suppression, Lance-flammes — PLAN_AOE.md §8 étape 7).
          // Humanoïde uniquement pour l'instant (weapon.ref_category dispo ici) — drone/exo non
          // couverts, pas de cas RAW identifié qui le nécessite à ce jour.
          const exclusiveCheck = isExclusiveDeclaration({
            mapActions, weaponCategory: weapon.ref_category, weaponName: weapon.ref_name,
          })
          if (exclusiveCheck.exclusive && exclusiveCheck.reason !== 'tir_vise') {
            const reasons = getAoeExclusiveIneligibilityReasons({ mapActions, state, quick, entry })
            if (reasons.length > 0) {
              socket.emit(WS.COMBAT_DECLARE_ERROR, {
                username: character.name,
                message: `Action exclusive : aucune autre action ni transition d'état ce Tour (${reasons.join(', ')})`,
              })
              return
            }
          }
        }
      }

      // Tir visé (LdB p.227-228, docs/PLAN_TIRVISE.md) — calculé une fois, réutilisé pour
      // iniDelta ci-dessous ET pour la ligne combat_actions (aim_bonus_comp) plus bas. Exclusif avec
      // Tir Multi (docs/PLAN_TIRMULTI.md D10, tranché Saar) — forcé à 0 dès que la série dépasse 1 tir,
      // jamais confiance au seul masquage UI côté client. Exclu aussi pour une exo (PLAN_EXOARMURE.md
      // §16.5, « Viser un endroit particulier en Tir » hors périmètre — étendu par le même principe au
      // Tir visé/aimTranches, RAW non tranché pour une exo, aucune UI ne le propose côté client) —
      // sans cette garde, `!isDrone` plus bas (ligne 446, englobe l'exo) laisserait passer un
      // aimTranches falsifié par un client forgé (`core.md`, jamais confiance au client).
      const aimTranches = (hasAttackDeclared && mapActions.attack.length === 1 && !isExo)
        ? (mapActions.attack[0]?.aimTranches ?? 0)
        : 0
      // Viser une Localisation précise (LdB p.229-230, COM9, docs/PLAN_TIRVISE v2.md) — annoncée ici
      // (même patron que Tir visé), aucun coût d'Initiative (contrairement à aimTranches). Validée
      // contre les clés réelles de AIMED_LOCATION_MALUS — jamais un slot forcé depuis une valeur
      // arbitraire envoyée par le client ; invalide → ignorée silencieusement (null), jamais un tour
      // de combat cassé. Exclusive avec Tir Multi (D10), même garde que Tir visé ci-dessus — même
      // exclusion exo, RAW explicitement hors périmètre (§16.5).
      const declaredAimedLocation = (hasAttackDeclared && mapActions.attack.length === 1 && !isExo)
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
        // Tir visé — éligibilité + niveau de Lunette re-dérivés serveur (peut REFUSER la déclaration,
        // jamais confiance au client). getAimIneligibilityReasons bloque déjà toute combinaison avec
        // le CaC ou une transition d'état (« aucune autre action ce Tour »). DBG log + message = les
        // raisons réelles (2026-08-28, remplace une chaîne fourre-tout).
        // NOTE : `state.cover` n'est PAS envoyé par les handleDeclare humanoïdes → `state.cover`
        // undefined ≠ `entry.state_cover` → "changement de couverture" fantôme (bug à corriger par
        // le module "action exclusive" unifié, cf. PLAN_RW_DECLARE_WINDOWS / discussion Saar).
        if (aimTranches > 0) {
          const aimReasons = getAimIneligibilityReasons({
            mapActions, state, quick, entry,
            isDualWield: !!mapActions.attack[0]?.isDualWield,
            bulletCount: mapActions.attack[0]?.bulletCount ?? null,
          })
          if (aimReasons.length > 0) {
            console.log(`[DBG] Tir visé refusé — reasons: ${JSON.stringify(aimReasons)} state:${JSON.stringify(state)} entry.state_*:${JSON.stringify({ position: entry.state_position, weapon: entry.state_weapon, fire_mode: entry.state_fire_mode, cover: entry.state_cover, vitesse: entry.state_vitesse })}`)
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: `Tir visé impossible : ${aimReasons.join(', ')}` })
            return
          }
          const aimWeaponInvId = mapActions.attack[0]?.weaponInvId
          if (aimWeaponInvId) {
            // mod_key/state (docs/PLAN_MODDING_REFONTE.md Phase 1) : routage vers
            // weaponModService.resolveModHooks, inutilisés tant que Phase 2 (différée) ne câble pas
            // le hook onDeclare.
            const installedMods = await db('char_inventory_mods as cim')
              .join('ref_equipment as re', 'cim.equipment_id', 're.id')
              .where({ 'cim.weapon_inv_id': aimWeaponInvId })
              .select('re.bonus', 're.mod_slot', 're.mod_requires_aim', 're.mod_key', 'cim.state')
            lunetteNiveau = getLunetteNiveau(installedMods)
          }
        }

        // Coût d'Initiative de la déclaration — autorité unique partagée client + serveur
        // (shared/combatIniCost.js#computeIniDelta, PLAN_RW_DECLARE_WINDOWS module 2) : transitions
        // d'état (position → combatStatePositionCost.js ; arme / mode de tir / vitesse ; couverture
        // = 0, flag défensif pur), déplacement (gratuit en Charge/Retraite — override serveur, jamais
        // l'ini_mod du client), Tir visé (getAimIniCost, écrêtage Lunette), actions rapides. Le pied
        // des fenêtres de déclaration affiche l'aperçu de ce même calcul (CombatDeclareIniWidget) —
        // plus aucune matrice de coût recopiée à la main entre les deux côtés.
        //
        // Exo « se relever » (isExoStandUpAttempt, défini plus bas) : la transition prone→* (-10) est
        // comptée ICI volontairement, même si `resolvedPosition` (~l.800) garde `prone` jusqu'à la
        // Résolution du Test — le -10 modélise le temps physique de la *tentative*, indépendant de son
        // issue (RAW LdB p.221, PLAN_EXOARMURE.md §9.2). Seule l'écriture de state_position est
        // différée, pas le coût — resolveExoStandUpAction ne retouche jamais `initiative`, donc le -10
        // n'est compté qu'une fois.
        iniDelta = computeIniDelta({
          prevStates: {
            position:  entry.state_position,
            weapon:    entry.state_weapon,
            fire_mode: entry.state_fire_mode,
            cover:     entry.state_cover,
            vitesse:   entry.state_vitesse,
          },
          nextStates: state,
          move: movementDeclaration ? { ini_mod: movementDeclaration.initiativeModifier } : null,
          combatMode: state?.combat_mode ?? null,
          aim: aimTranches > 0 ? { aimTranches, lunetteNiveau } : null,
          quick,
        })
      }

      // PLAN_EXOARMURE.md Lot 2bis §9.2 — tentative de se relever (exo-armure, prone → autre
      // position). Le coût d'Initiative ci-dessus s'applique déjà normalement (transition de position
      // dans computeIniDelta, bloc !isDrone) : ce qui change, c'est que la position ne sera PAS écrite
      // immédiatement dans combat_roster (§ résolvedPosition plus bas) — elle attend un Test résolu en
      // Résolution, exactement comme une attaque. `entry.state_position` = position AVANT cette
      // déclaration, jamais reconstruite depuis le payload client (même garde que partout ailleurs
      // dans ce fichier).
      const isExoStandUpAttempt = isExo
        && entry.state_position === 'prone'
        && !!state.position && state.position !== 'prone'
      if (isExoStandUpAttempt) {
        // Exclusivité tranchée par Saar (2026-08-18, analyse à charge PLAN_EXOARMURE.md §9.2) : le
        // personnage ne fait que ça ce Tour, réussite ou échec. Ne couvre que les mapActions/quick
        // actions ("Action" au sens RAW) — pas les transitions d'état annexes (arme/couverture/vitesse),
        // catégorie distincte dans le vocabulaire du combat (transitions d'état / combatIniCost.js vs
        // MAP_ACTIONS/QUICK_ACTIONS / combatSections.js) : RAW ne dit rien qui interdise de dégainer
        // une arme en même temps que la
        // tentative, choix documenté plutôt qu'un silence.
        const ineligible = getExoStandUpIneligibilityReasons({ mapActions, quick })
        if (ineligible.length > 0) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, {
            message: `Tenter de se relever : aucune autre action ce Tour (${ineligible.join(', ')})`,
          })
          return
        }
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
          weaponInvId, offhandWeaponInvId, droneWeaponInvId, exoWeaponInvId, targetTokenId, aoe,
          bulletCount, fireModeBonusComp, fireModeBonusDmg, isDualWield, dualWieldBonusComp,
        } of mapActions.attack) {
          // AOE (docs/PLANS/PLAN_AOE.md §6/§8 étape 6b, fusil à pompe/tir de suppression uniquement —
          // grenades en attente du catalogue §6.2bis) : un tir en zone n'a pas de targetTokenId, il a
          // une direction visée à la place. `origin`/`amplitude` ne sont volontairement PAS envoyés
          // par le client — l'origine est toujours la position réelle du tireur à la RÉSOLUTION,
          // l'amplitude du fusil à pompe découle de bulletCount (déjà déclaré), celle du tir de
          // suppression aussi (RAW, mètres additionnels par groupe de 5 balles) — jamais une valeur
          // client à valider ici (`.claude/rules/combat.md` : seule la RÉSOLUTION recalcule depuis la
          // position réellement atteinte, l'ANNONCE ne fait qu'enregistrer l'intention).
          if (!targetTokenId && !aoe) continue
          if (aoe && (typeof aoe.direction !== 'number' || !Number.isFinite(aoe.direction))) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Zone d'effet : direction invalide" })
            return
          }
          actionRows.push({
            campaign_id:          campaignId, token_id: tokenId,
            action_key:           'assault', type: 'assault', sequence: 3,
            weapon_inv_id:        (isDrone || isExo) ? null : (weaponInvId ?? null),
            offhand_weapon_inv_id: (isDrone || isExo || !isDualWield) ? null : (offhandWeaponInvId ?? null),
            drone_weapon_inv_id:  isDrone ? (droneWeaponInvId ?? null) : null,
            exo_weapon_inv_id:    isExo ? (exoWeaponInvId ?? null) : null,
            target_token_id:      targetTokenId ?? null,
            fire_mode:            state.fire_mode ?? null,
            bullet_count:         bulletCount ?? null,
            fire_mode_bonus_comp: fireModeBonusComp ?? null,
            fire_mode_bonus_dmg:  fireModeBonusDmg ?? null,
            aim_bonus_comp:       (isDrone || isExo) ? null : (getAimBonusComp(aimTranches, { lunetteNiveau }) || null),
            aimed_location:       (isDrone || isExo) ? null : aimedLocationKey,
            modifiers:            JSON.stringify({ ini_mod: 0, ref_range: assaultWeaponRefRange, dual_wield: isDualWield ?? false, dual_wield_bonus_comp: dualWieldBonusComp ?? 0, aoe: aoe ?? null }),
            status:               'pending',
          })
        }
      }

      // Phase 1 : intention enregistrée sans validation distance (vérifiée en Phase 2)
      // mapActions.melee est un array : [{ targetTokenId, weaponInvId?, droneWeaponInvId?,
      // offhandWeaponInvId?, isDualWield? }, ...]
      if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) {
        const firstMelee = mapActions.melee[0]
        // Exo-armure (PLAN_EXOARMURE.md §16.4) — même RAW que le garde Tir Multi ci-dessus
        // (REGLEARMURE.md:206-207/MANUEL §4.5, « une seule Attaque par Tour ») : exclut aussi une
        // série de CaC multiple, jamais seulement le Tir.
        if (mapActions.melee.length > 1 && isExo) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'CaC multiple impossible pour une exo-armure — une seule Attaque par Tour' })
          return
        }
        // D-CAC1 (miroir D9 Tir Multi) — même arme(s)/mode deux-armes pour toute la série : le
        // personnage ne change pas d'arme en main entre ses attaques du même Tour.
        const sameLoadoutAcrossSeries = mapActions.melee.every(m => (
          m.weaponInvId === firstMelee.weaponInvId &&
          m.droneWeaponInvId === firstMelee.droneWeaponInvId &&
          m.exoWeaponInvId === firstMelee.exoWeaponInvId &&
          (m.offhandWeaponInvId ?? null) === (firstMelee.offhandWeaponInvId ?? null) &&
          !!m.isDualWield === !!firstMelee.isDualWield
        ))
        if (mapActions.melee.length > 1 && !sameLoadoutAcrossSeries) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'CaC multiple : même arme(s) pour toute la série' })
          return
        }

        // MELEE-INHAND (docs/BUGIDENTIFIE.md) — l'arme principale n'était jamais revalidée (ni
        // ownership, ni en-main), contrairement à l'arme secondaire ci-dessous et à l'arme principale
        // Tir. Un blocage clair est ici le bon comportement (même traitement que l'arme principale
        // Tir) — le client ne propose jamais un choix en dehors des armes de contact en main
        // (`CombatActionWindow.jsx` meleeWeapons), donc aucune déclaration légitime existante ne peut
        // être rejetée par ce garde.
        if (!isDrone && !isExo && firstMelee.weaponInvId) {
          const primaryWeapon = await getOwnedHandWeapon(character.id, firstMelee.weaponInvId, { slotCodes: ['MG', 'MD', '2M'], category: 'Arme de contact' })
          if (!primaryWeapon?.inHand || !primaryWeapon.categoryOk) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Corps à corps impossible — l'arme sélectionnée n'est pas en main (transférée entre-temps ?)" })
            return
          }
        }

        // Exo-armure — validation exoWeaponInvId contre exo_weapons (§16.4, même patron que le Tir
        // exo ci-dessus) : ownership seulement, pas de notion "en main" (armes hardpoint, toujours
        // disponibles dès qu'installées) — mirroir de la branche drone, pas de la branche humanoïde.
        // Contrôle UNCONDITIONNEL (contrairement à l'humain ci-dessus, dont le `if (weaponInvId)`
        // est correct : le CaC à mains nues est RAW-légal pour un humain, COMBAT_A_MAINS_NUES) — une
        // exo-armure n'a aucun repli "à mains nues" (§16.1, diagnostic corrigé : pas de Compétence CaC
        // générique de l'armure, toute Attaque de contact exo passe par une Arme de contact équipée,
        // résolue via skillAssoc comme le Tir). Sans ce rejet explicite, une déclaration sans
        // exoWeaponInvId glissait silencieusement à travers vers la construction de ligne plus bas et
        // y aurait pris weapon_inv_id/exo_weapon_inv_id tous les deux null — une ligne combat_actions
        // orpheline, jamais rejetée à la Déclaration (trouvé en relecture à charge avant d'écrire le
        // résolveur, jamais exercé en jeu réel).
        if (isExo) {
          if (!firstMelee.exoWeaponInvId) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: 'Corps à corps exo impossible — aucune arme exo sélectionnée' })
            return
          }
          const exoMeleeWeapon = await db('exo_weapons')
            .leftJoin('ref_equipment', 'exo_weapons.ref_equipment_id', 'ref_equipment.id')
            .where({ 'exo_weapons.id': firstMelee.exoWeaponInvId, 'exo_weapons.character_id': character.id })
            .select('ref_equipment.category')
            .first()
          if (!exoMeleeWeapon || exoMeleeWeapon.category !== 'Arme de contact') {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { username: character.name, message: "Corps à corps exo impossible — l'arme exo sélectionnée est introuvable ou n'est pas une arme de contact" })
            return
          }
        }

        // Combat à deux armes (COM24, docs/BUGIDENTIFIE.md) — revalidé serveur, jamais fait confiance
        // au payload client (`core.md`). Dégradation silencieuse si invalide (arme secondaire
        // introuvable, pas en main, mauvaise catégorie, identique à la principale) — jamais de
        // blocage de l'attaque principale pour ça, même philosophie que le dual-wield Tir
        // (shared/dualWieldRules.js, COM29). Exo exclue (RAW une seule Attaque/Tour, pas de dual-wield).
        let validatedOffhandWeaponInvId = null
        if (!isDrone && !isExo && firstMelee.isDualWield && firstMelee.weaponInvId && firstMelee.offhandWeaponInvId
            && firstMelee.offhandWeaponInvId !== firstMelee.weaponInvId) {
          const offhandWeapon = await getOwnedHandWeapon(character.id, firstMelee.offhandWeaponInvId, { slotCodes: ['MG', 'MD'], category: 'Arme de contact' })
          if (offhandWeapon?.inHand && offhandWeapon.categoryOk) {
            validatedOffhandWeaponInvId = firstMelee.offhandWeaponInvId
          }
        }

        for (const {
          targetTokenId: meleeTargetId, droneWeaponInvId: meleeDroneWeaponId, exoWeaponInvId: meleeExoWeaponId,
          naturalWeaponCharMutationId: meleeNaturalWeaponId,
        } of mapActions.melee) {
          if (meleeTargetId) {
            const meleeIsSpecialized = !!(meleeDroneWeaponId || meleeExoWeaponId)
            actionRows.push({
              campaign_id: campaignId, token_id: tokenId,
              action_key: 'melee', type: 'melee', sequence: 3,
              weapon_inv_id:       meleeIsSpecialized ? null : (firstMelee.weaponInvId ?? null),
              offhand_weapon_inv_id: meleeIsSpecialized ? null : validatedOffhandWeaponInvId,
              drone_weapon_inv_id: meleeDroneWeaponId ?? null,
              exo_weapon_inv_id:   meleeExoWeaponId ?? null,
              // Arme naturelle (mutation) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Un drone/une exo
              // n'a pas de mutations, toujours null dans cette branche (même garde que weapon_inv_id).
              natural_weapon_char_mutation_id: meleeIsSpecialized ? null : (meleeNaturalWeaponId ?? null),
              target_token_id: meleeTargetId,
              modifiers: JSON.stringify({ ini_mod: -3 }),
              status: 'pending',
            })
          }
        }
      }

      // PLAN_EXOARMURE.md Lot 2bis §9.3 — miroir du patron melee/assault ci-dessus (sequence 3, une
      // entrée d'échelle Test-gated). `targetPosition` = la position déclarée par le joueur (state.position,
      // déjà validée contre VALID_STATES.position en tête de handler) : resolveExoStandUpAction
      // (socketCombatHelpers.js) l'applique à combat_roster.state_position UNIQUEMENT si le Test réussit.
      if (isExoStandUpAttempt) {
        actionRows.push({
          campaign_id: campaignId, token_id: tokenId,
          action_key: 'exo_stand_up', type: 'exo_stand_up', sequence: 3,
          modifiers: JSON.stringify({ targetPosition: state.position }),
          status: 'pending',
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
      // Idem Tir Multi (docs/PLAN_TIRMULTI.md) — au moins une cible OU une zone d'effet (AOE,
      // PLAN_AOE.md §8 étape 6b) sur la série de tirs.
      if (hasAttackDeclared && !mapActions.attack.some(a => a.targetTokenId || a.aoe)) {
        socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Assaut (tir) : sélectionner une cible ou viser une direction avant de valider.' })
        return
      }

      // UPDATE combat_roster — états + initiative + has_announced
      // PLAN_EXOARMURE.md Lot 2bis §9.2/9.3 — une tentative de se relever ne modifie PAS
      // state_position ici : elle reste 'prone' (valeur inchangée d'entry) jusqu'à la Résolution du
      // Test (resolveExoStandUpAction, socketCombatHelpers.js). La position visée par le joueur voyage
      // dans la ligne combat_actions ci-dessus (modifiers.targetPosition), pas ici.
      // NB : `iniDelta` a en revanche DÉJÀ compté le -10 de la transition prone→* (computeIniDelta,
      // bloc !isDrone) — voulu, cf. commentaire là-bas : le coût suit la tentative, pas son issue.
      const resolvedPosition = isExoStandUpAttempt ? entry.state_position : (state.position ?? entry.state_position)
      const resolvedWeapon   = state.weapon   ?? entry.state_weapon
      const [updated] = await db.transaction(async (trx) => {
        const rows = await trx('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .update({
            state_position:    resolvedPosition,
            state_weapon:      resolvedWeapon,
            state_fire_mode:   state.fire_mode ?? entry.state_fire_mode,
            state_cover:       state.cover        ?? entry.state_cover,
            state_vitesse:     state.vitesse      ?? entry.state_vitesse,
            state_combat_mode: state.combat_mode  ?? entry.state_combat_mode,
            initiative:        trx.raw('initiative + ?', [iniDelta]),
            has_announced:     true,
            updated_at:        trx.fn.now(),
          })
          .returning(['initiative'])
        // Lot 1 (shadow, docs/PLANS/PLAN_CHARACTER_STATES.md §3)
        await setCharacterState(trx, tokenId, 'position', resolvedPosition)
        await setCharacterState(trx, tokenId, 'weapon', resolvedWeapon)
        await shadowCheckCharacterState(trx, tokenId, { position: resolvedPosition, weapon: resolvedWeapon })
        return rows
      })

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
      else if (isExoStandUpAttempt) actionType = 'exo_stand_up'

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
