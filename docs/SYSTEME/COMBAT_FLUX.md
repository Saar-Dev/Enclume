# STRUCTURE_SYSCOMBAT.md — Logique complète d'un tour de combat
> Session 120 — 2026-06-24 ; flux spatial mis à jour le 2026-07-22 pour le moteur monde v13.
> Reconstruction depuis le code. Source : socketCombatState.js, socketCombatAnnouncement.js,
> socketCombatHelpers.js, socketCombatResolution.js, statusService.js, combatFSM.js
# SYSTEME/COMBAT_FLUX.md — Déroulement complet d'un tour de combat

> Dernière mise à jour : 2026-06-24 (vérifié code : 2026-07-19)
> Sources : `socketCombatState.js`, `socketCombatAnnouncement.js`, `socketCombatResolution.js`, `socketCombatHelpers.js`, `statusService.js`, `combatFSM.js`
> Lire pour : comprendre le déroulement complet d'un tour de combat, de la phase ROSTER jusqu'à endTurn.
> Voir aussi : @SERVICES_COMBAT pour les signatures des services (dégâts, choc, FSM), @BLESSURES pour les blessures et armures, @PERSONNAGE_CALCULS pour la chaîne de calcul des attributs et compétences.

---

## 1. Vue d'ensemble FSM

```
null|null
  └─(COMBAT_START)──────────────── ROSTER|null
                                       └─(COMBAT_ANNOUNCE_START)── ANNOUNCEMENT|null
                                                                        └─(START_RESOLUTION)── RESOLUTION|SLOT_ACTIVE
                                                                                                 ├─(COMBAT_ACTION_CONFIRM)─► SLOT_ACTIVE
                                                                                                 ├─(NEEDS_DEFENSE)──────────► AWAITING_DEFENSE
                                                                                                 │                                └─(MELEE_DEFENSE_CONFIRM)─► SLOT_ACTIVE
                                                                                                 ├─(NEEDS_DAMAGE)────────────► AWAITING_DAMAGE
                                                                                                 │                                └─(DAMAGE_CONFIRM)────────► SLOT_ACTIVE
                                                                                                 └─(END_TURN)───────────────► ANNOUNCEMENT|null
```

`COMBAT_INIT_STATE`, `COMBAT_ANNOUNCE_PREVIEW`, `COMBAT_APPLY_STUN` : hors FSM (pas de guard).
`COMBAT_ACTION_CONFIRM` : guard uniquement. L'état suivant (SLOT_ACTIVE / AWAITING_DEFENSE / AWAITING_DAMAGE) est écrit directement par les helpers via `setFSMSubPhase()`.

---

## 2. PHASE ROSTER

### `COMBAT_START` — `socketCombatState.js`

| Étape | Check / Logique |
|---|---|
| Guard rôle | GM uniquement |
| Guard FSM | `canTransition(null\|null, 'COMBAT_START')` |
| Guard doublon | `existing` déjà présent → erreur explicite |
| Tokens | Tous tokens du battlemap hors `excludedTokenIds` |
| Entité décor | `!token.character_id` → ignoré (PC27) |
| **Drone** | `character.type === 'drone'` → `base_ini = 12` fixe (LdB p.320), `is_surprised = false` forcé |
| **Humanoïde** | `base_ini = calcREA(ada_na, per_na)` depuis char_sheet |
| Surprise PNJ | `surprise_roll = Random 1–20`, `initiative = base_ini + surprise_roll` ⚠️ (voir §7 écarts) |
| Surprise PJ | `COMBAT_SURPRISE_ROLL` → socket ciblé via fetchSockets |
| Tri roster | DESC initiative, égalités par `Math.random()` |
| Broadcast | `COMBAT_STARTED` — sans `surprise_roll` (PC25) |

### `COMBAT_SURPRISE_RESULT` — `socketCombatState.js`

| Étape | Check / Logique |
|---|---|
| Guard FSM | `canTransition(ANNOUNCEMENT\|null, ...)` |
| Ownership | `character.user_id === user.id` |
| Guard | `entry.is_surprised === true` |
| Jet | D20 côté serveur — non manipulable |
| **Test Réaction** | `isSuccess = roll <= entry.base_ini` (LdB p.213) |
| Succès | `initiative = roll` |
| Échec | `initiative = 0`, `has_announced = true`, insert `type:'skip', sequence:99` |
| PC13 | Si échec et tous annoncés → `startResolutionPhase()` |

### `COMBAT_INIT_STATE` — `socketCombatState.js`

Joueur uniquement, phase ROSTER, guard ownership. Met à jour `state_position`, `state_weapon`, `state_fire_mode` + JSONB merge `init_state_confirmed: true`.

### `COMBAT_ANNOUNCE_START` — `socketCombatState.js`

GM uniquement. Guard FSM + guard phase=ROSTER. Update phase → ANNOUNCEMENT. Lance les timers auto-skip (`action_timer_sec > 0`). Émet `COMBAT_SLOT_ADVANCED` → premier slot (ASC `base_ini` : les lents déclarent en premier, LdB p.212).

---

## 3. PHASE ANNOUNCEMENT

### `COMBAT_ACTION_DECLARE` — `socketCombatAnnouncement.js`

#### Guards (dans l'ordre)
1. **FSM** : `canTransition(ANNOUNCEMENT|null, 'COMBAT_ACTION_DECLARE')`
2. **Payload** : tokenId + state requis
3. **Whitelist états** : position / weapon / fire_mode / cover / vitesse / combat_mode
4. **Coordonnées** : si `mapActions.move` → parseInt(x/y/z) + isNaN (PC33)
5. **Entité décor** : `!token.character_id` → return (PC27)
6. **Ownership** : PJ → `user_id === user.id` / PNJ → `isGm` / Drone → `isGm || isOwner`
7. **has_announced** : `entry.has_announced === false`
8. **Ordre d'annonce** (LdB p.212) : `firstNonAnnounced(ASC base_ini).token_id === tokenId` → sinon `COMBAT_DECLARE_ERROR`

#### Guard is_stunned
Source : `token_statuses WHERE token_id = X AND status_code = 'stunned'`

| Condition | Réponse |
|---|---|
| Stunné + `mapActions.attack` | `COMBAT_DECLARE_ERROR` "Assommé — ne peut pas attaquer" |
| Stunné + `mapActions.melee.length > 0` | `COMBAT_DECLARE_ERROR` "Assommé — ne peut pas attaquer au CaC" |
| Stunné + `action_key ∈ {move_rapide, move_max}` | `COMBAT_DECLARE_ERROR` "Allure maximale : Moyenne" |

#### Validation arme (PC22)
**Drone** : `drone_weapons WHERE id = droneWeaponInvId AND character_id = character.id`

**Humanoïde** :
- `char_inventory + ref_equipment WHERE id = weaponInvId AND character_id`
- Slot arme : `['MG', 'MD', '2M', 'Tr']` requis
- `state.fire_mode` doit être dans `ref_fire_mode` (insensible à la casse)
- `RC` ou `RL` → `TIR_AUTOMATIQUES` requis dans `char_skills` (PC23)
- `ammo_remaining < bulletCount` → `COMBAT_DECLARE_ERROR` (sauf PNJ + `pnj_unlimited_ammo`)

#### Calcul delta initiative (humanoïdes — drones ignorés)
```
STATE_COSTS (matrice complète) :
  position  : standing↔crouching(-3), ↔prone(-5), crouching↔prone(-5), prone→*(-10)
  weapon    : holstered→ready(-3), →drawn(-5) ; ready→drawn(-3), →holstered(-5) ; drawn→ready(-3), →holstered(-10)
  fire_mode : tout changement(-3)
  cover     : aucun coût INI
  vitesse   : normal→rushed(+3) / tout→delayed(0)

Exceptions :
  Charge/Retraite + move → déplacement gratuit (ini_mod ignoré)
  1er CaC déclaré    → -3
  2ème CaC déclaré   → -5 supplémentaire
  cover_shot         → -5 (couverture importante) / -3 (partielle)
  Observer par unité → -5
  Repérer par unité  → -5
  Phrase             → -3
```

#### Séquences combat_actions (PC32 — attribuées serveur)
| Type | sequence |
|---|---|
| move (lente / rapide / max) | 1 |
| interact / observer / reperer / phrase | 2 |
| assault / melee / reload | 3 |
| skip (timeout / surprise ratée) | 99 |

#### Terminaison
```
UPDATE combat_roster SET
  state_* = nouvelles valeurs,
  initiative = initiative + iniDelta,
  has_announced = true

INSERT combat_actions (lignes construites)
EMIT COMBAT_ACTION_DECLARED { tokenId, actionType, initiative_score, moveTarget, attackTargetId }
Clear timer auto-skip

PC13 :
  Si COUNT(has_announced=false) === 0 → startResolutionPhase()
  Sinon → COMBAT_SLOT_ADVANCED (prochain ASC base_ini)
```

### `COMBAT_SKIP_PLAYER` — `socketCombatAnnouncement.js`

GM uniquement (ou timer auto-skip). Guard FSM. Race condition guard (re-vérifie `has_announced`). Insert action `type:'skip', sequence:99`. Emit `COMBAT_TURN_SKIPPED`. PC13 check.

---

## 4. TRANSITION → RÉSOLUTION

### `startResolutionPhase()` — `socketCombatHelpers.js`
```
UPDATE combat_state SET phase='RESOLUTION', active_slot_idx=0
setFSMSubPhase('SLOT_ACTIVE')
EMIT COMBAT_PHASE_CHANGED { phase:'RESOLUTION', roster(DESC initiative), actions(pending ASC sequence) }
EMIT COMBAT_SLOT_ADVANCED { activeSlotIdx:0, tokenId: roster[0] }  // INI la plus haute
```

---

## 5. PHASE RÉSOLUTION

### Pre-gate ACK : `COMBAT_ACTION_PRECHECK` — `socketCombatResolution.js`

Émis par le client AVANT d'ouvrir la fenêtre modificateurs. Retourne `{ ok: boolean }` via ACK Socket.IO.

| Étape | Check |
|---|---|
| Guard FSM | `canTransition(phase, sub_phase, 'COMBAT_ACTION_CONFIRM')` |
| Si `actionKey==='melee'` | Range check : dist > 3 + allonge → `{ ok: false }` |
| Si `actionKey==='assault'` | `checkLOSForPrecheck()` : LOS bloquée → `{ ok: false }` |
| Default | `{ ok: true }` |

### `COMBAT_ACTION_CONFIRM` — `socketCombatResolution.js`

| Étape | Check / Logique |
|---|---|
| Guard FSM | `canTransition(phase, sub_phase, 'COMBAT_ACTION_CONFIRM')` |
| Guard phase | `state.phase === 'RESOLUTION'` |
| Guard slot actif | `slots[active_slot_idx].token_id === tokenId` (slots = roster DESC initiative) |
| Guard ownership | `isGm` ou `character.user_id === user.id` |
| ⚠️ is_stunned | **ABSENT** — pas de re-check (bug STUN2 actif) |

#### Séquence d'exécution des actions (ASC sequence)

**Actions non-melee** :
```
type='move_short' / 'move_long' :
  → exige destination_world + movement_gait enregistrés à l'annonce
  → recalcule le budget en mètres depuis la fiche
  → executeBattlemapTokenMovement() replannifie sous verrou avec snapshot + runtime courants
  → persiste le dernier support stable atteint, incrémente runtime_revision et EMIT TOKEN_MOVED
  → si bloqué/partiel : COMBAT_RESOLVE_MOVE_BLOCKED avec position atteinte et dérive du monde

type='assault' :
  → resolveAssaultAction() → flushEmissions()

type='reload' :
  → resolveReloadAction()

type='micro' / 'skip' :
  → Marqué 'resolved' immédiatement, pas d'effet gameplay V1
```

**Actions melee** (toutes marquées 'resolved' d'abord, traitées séquentiellement) :
```
Si character.type === 'drone' :
  → resolveDroneAssaultAction() [armement_contact]

Sinon (humanoïde) :
  → resolveMeleeAction(actions[0], character, actions.slice(1), totalCount, confirmedModifiers)
  → needsDefenseWait = meleeResult.suspend
```

```
Si !needsDefenseWait → advanceSlot(slots, active_slot_idx + 1)
```

---

## 6. Pipeline Assaut Distance : `resolveAssaultAction`

### Branche humanoïde
```
[0] Drone → resolveDroneAssaultAction()

[1] Guards
    weapon_inv_id + target_token_id requis

[2] LOS check (sauf skipLos)
    → blocked    : return (rien, COMBAT_DECLARE_ERROR interne)
    → intercepted: recurse avec los.newTargetTokenId
    → ok         : options.coverageModifier

[3] Fetch arme + roster tireur

[4] Guard : weapon.ref_damage_h requis

[5] Calcul seuil (si sheetTireur)
    skillId via ref_equipment_skill_assoc.item_id = equipment_id  [BUG C]
    skillTotal     = calcSkillTotal(attrs, charSkill, refSkill, genotype)
    effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)

[6] Modificateurs
    porteeModComp    = PORTEE_MOD_COMP[portee]
                       bout_portant(+5) / courte(0) / moyenne(-5) / longue(-10) / extreme(-15)
    situationModComp = Σ SITUATION_MODS[k]
                       cible_immobile(+3) / cible_allure_moyenne(-3) / _rapide(-5) / _maximale(-7)
                       tireur_allure_lente(-3) / _moyenne(-5) / _rapide(-7) / _maximale(bloqué)
                       couverture_partielle(-3) / _importante(-5)
                       obscurite_legere(-3) / _importante(-5) / _totale(bloqué)
    tailleModComp    = TAILLE_MODS[taille]
                       minuscule(-10) / tres_petite(-5) / petite(-3) / moyenne(0)
                       grande(+3) / tres_grande(+5) / enorme(+10) / gigantesque(+15)
    isRushedMod      = state_vitesse='rushed' ? -5 : 0
    fireModeComp     = action.fire_mode_bonus_comp  [bonus CC/RC/RL]
    coverageModifier = depuis LOS check

    chancesDeReussite = skillTotal + porteeModComp + situationModComp + tailleModComp
                      + isRushedMod + fireModeComp + effectiveMalus + coverageModifier

[7] Jet 1D20
    isSuccess = roll ≤ chancesDeReussite
    mr        = seuil - roll

[8] Décompte munitions (raté OU touché)
    Si ammo_remaining !== null ET !pnjUnlimited :
      ammo_remaining -= bullet_count (min 0)
    UPDATE char_inventory (pas d'EMIT INVENTORY_UPDATED ici)

[9] Résolution
    Si !isSuccess :
      PJ  → COMBAT_ATTACK_PLAYER_RESULT { hit:false }
      PNJ → COMBAT_ATTACK_RESULT { isSuccess:false }

    Si isSuccess + PJ :
      → COMBAT_ATTACK_PLAYER_RESULT { hit:true }
      → INSERT combat_pending 'damage' { mr, portee, formula, for/con/vol_na_cible, … }
      → setFSMSubPhase('AWAITING_DAMAGE')
      → COMBAT_DAMAGE_PROMPT → socket PJ

    Si isSuccess + PNJ :
      modDomAttaque = MR table (mr)
      modDegatsMode = fire_mode_bonus_dmg si portée ∈ {bout_portant, courte} sinon 0
      degautsBruts  = rawDice + modDomAttaque + modDegatsMode

      Si cible drone :
        blindage = droneSheet.blindage
        rdDrone  = calcDroneRD(integrite_actuelle)
        degatsNets = max(0, degautsBruts - blindage - rdDrone)
        resolveDroneIntegrityLoss()
        EMIT COMBAT_ATTACK_RESULT

      Sinon (PJ/PNJ cible) :
        damageService.resolveTargetHit() → { localisation, etq, rd, degatsNets, is_lethal, finalSeverity, shockResult }
        Si shockResult → emitShockDiceResult + applyStun
        EMIT COMBAT_ATTACK_RESULT
```

### Branche drone : `resolveDroneAssaultAction`
```
[1] Fetch arme drone (drone_weapons + ref_equipment)
    effective_formula requis

[2] isCaCWeapon = explicit_fire_mode==='cc' || !ref_fire_mode

[3] CaC : range check (dist > 3 + allonge → erreur)

[4] Distance : LOS check (blocked/intercepted/coverageModifier)

[5] Fetch programme (category: armement_contact ou armement_distance)
    programme requis

[6] chancesDeReussite = programme.level
      + PORTEE_MOD_COMP[portee]    (null si CaC → 0)
      + TAILLE_MODS[taille]
      + Σ SITUATION_MODS[k]
      + coverageModifier
    Pas de malus blessures/encombrement (§7.3)

[7] Jet 1D20 → isSuccess, mr

[8] Si !isSuccess → COMBAT_ATTACK_RESULT { isSuccess:false }

[9] Si isSuccess :
    Cible drone  → blindage + calcDroneRD → resolveDroneIntegrityLoss
    Cible PNJ    → MR table + damageService.resolveTargetHit + applyStun si choc
    Cible PJ     → INSERT combat_pending 'damage' + setFSMSubPhase('AWAITING_DAMAGE') + COMBAT_DAMAGE_PROMPT
```

---

## 7. Pipeline CaC Humanoïde : `resolveMeleeAction`

```
[1] Guard : targetTokenId requis

[2] Arme attaquant
    char_inventory + ref_equipment si weaponInvId
    damageFormula = weapon.ref_damage_h ?? '1D4'  [mains nues]
    allonge = parseInt(weapon.ref_range) || 0

[3] Range check Phase 2 (positions post-déplacement)
    pos_x / pos_y (PE14 : pos_y DB = Z Three.js)
    dist = √(dx²+dz²) ; dist > 3 + allonge → COMBAT_DECLARE_ERROR

[4] Skill ID
    ref_equipment_skill_assoc WHERE item_id = equipment_id → skill_id  [BUG C]
    Défaut mains nues : 'COMBAT_A_MAINS_NUES'

[5] Données attaquant (requêtes parallèles)
    attrs, archetype, charSkill, refSkill, wounds, inventory, rosterTokens

[6] Guard Charge
    state_combat_mode='charge' && dist ≤ 3 → COMBAT_DECLARE_ERROR (élan insuffisant)

[7] Calcul seuil attaque
    attackerSkillTotal   = calcSkillTotal(...)
    effectiveMalus       = woundPenalty - encumbrancePenalty(weight, FOR)
    modDom               = getModDom(for_na_attaquant)   [table ModDom → bonus dégâts FOR]
    isRushedMod          = -5 si state_vitesse='rushed'
    attackModeBonus      = +3 si offensif ou charge
    combatModeBonus      = +3 dommages si charge
    multiMalusAttaquant  = multiAdversaryMalus(countAdversaires(...))
                           0 / -5(×2) / -7(×3) / -10(×4+)
    multiAttackMalus     = -5 si 2 attaques / -7 si 3+
    deuxArmesBonus       = +3 si 2 armes de contact en main (slots MD+MG)
    situationModComp     = Σ SITUATION_MODS[cac_*]
    tailleMod            = TAILLE_MODS[taille]
    terrainInstableMod   = min(0, acrobatieTotal - attackerSkillTotal)  [compétence limitative]

    chancesAttaque = attackerSkillTotal + effectiveMalus
                   + isRushedMod + attackModeBonus + multiMalusAttaquant + multiAttackMalus
                   + situationModComp + tailleMod + terrainInstableMod + deuxArmesBonus

[8] Roll attaque 1D20

[9] Résolution selon type cible
```

#### Cible = entité décor
`!character_id` → `COMBAT_MELEE_RESULT { hit:false }`, return.

#### Cible PNJ (auto-résolution)
```
Roll défense 1D20

chanceDefense = defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur
Mod mode combat défenseur :
  offensif(-5) / charge(-7) / defensif(+3) / retraite(+5)
Terrain instable défenseur (compétence limitative Acrobatie)

mrAttaque  = chancesAttaque - rollAttaque
mrDefense  = chanceDefense  - rollDefense
hit = (rollAttaque ≤ chancesAttaque) && (!(rollDefense ≤ chanceDefense) || mrAttaque > mrDefense)
// Égalité MR → défenseur l'emporte (rien ne se passe) — LdB §6.2

EMIT DICE_RESULT défense
EMIT COMBAT_MELEE_RESULT

Si hit :
  rollLoc 1D20 → LOC_TABLE → slotCode → localisation
  calcResistanceArmure(armures WHERE slot ∋ slotCode) → etq
  rawDice = parseDice(damageFormula)
  degautsBruts = rawDice + modDom + combatModeBonus
  rd = calcResistanceDommages(for_na, con_na)
  degatsNets = max(0, degautsBruts - etq + rd)
  severity (tranches de 5 : legere/moyenne/grave/critique/mortelle/mortelle+)
  woundService.applyWound()
  resolveShockTest() → shockResult
  Si shockResult.outcome ≠ 'ok' → applyStun()

CaC 4b : remainingMeleeActions.length > 0 → resolveMeleeAction récursif
```

#### Cible Drone
```
Sans programme esquive → test simple §7.4
hit = rollAttaque ≤ chancesAttaque

Si hit :
  rawDice = parseDice(damageFormula)
  degautsBruts = rawDice + modDom + combatModeBonus
  etqDrone = droneSheet.blindage
  rdDrone  = calcDroneRD(integrite_actuelle)
  degatsNets = max(0, degautsBruts - etqDrone - rdDrone)
  resolveDroneIntegrityLoss()
  Pas de Test de Choc
```

#### Cible PJ (suspend slot)
```
INSERT combat_pending 'melee_defense' { tous les paramètres du pending }
setFSMSubPhase('AWAITING_DEFENSE')
EMIT COMBAT_MELEE_DEFENSE_PROMPT → socket PJ (fallback: room)
return { suspend: true }
```

---

## 8. `COMBAT_MELEE_DEFENSE_CONFIRM`

```
[1] Guard FSM : AWAITING_DEFENSE + MELEE_DEFENSE_CONFIRM
[2] Fetch pending 'melee_defense'
[3] Guard : defenderUserId === user.id || isGm
[4] Delete pending, setFSMSubPhase('SLOT_ACTIVE')
[5] Roll défense 1D20 serveur
[6] Mode combat PJ défenseur : offensif(-5) / charge(-7) / defensif(+3) / retraite(+5)
[7] Terrain instable (compétence limitative Acrobatie)
[8] hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)
[9] EMIT DICE_RESULT (jet défense → room)
[10] EMIT COMBAT_MELEE_RESULT
[11] Si hit :
     Attaquant PJ  → INSERT pending 'damage' + AWAITING_DAMAGE + COMBAT_DAMAGE_PROMPT
     Attaquant PNJ → damageService.resolveTargetHit() auto + applyStun si choc
[12] Attaque suivante (remainingMeleeActions) ou advanceSlot
```

---

## 9. `COMBAT_DAMAGE_CONFIRM`

```
[1] Guard FSM : AWAITING_DAMAGE + DAMAGE_CONFIRM
[2] Fetch pending 'damage'
[3] Guard : userId || targetUserId || isGm
[4] Delete pending, setFSMSubPhase('SLOT_ACTIVE')
[5] Calcul dégâts bruts :
    Si pendingType='melee' : rawDice + modDom + combatModeBonus
    Si assault :
      modDomAttaque = MR table (mr stocké en pending)
      modDegatsMode = fire_mode_bonus_dmg si portée ∈ {bout_portant, courte} sinon 0
      degautsBruts = rawDice + modDomAttaque + modDegatsMode
[6] Si cible drone : blindage + calcDroneRD → resolveDroneIntegrityLoss
[7] Sinon : damageService.resolveTargetHit()
[8] EMIT COMBAT_DAMAGE_RESULT (→ socket tireur uniquement)
[9] Si shockResult.outcome ≠ 'ok' → applyStun
[10] Broadcast DICE_RESULT (localisation + dégâts + narratif)
[11] EMIT COMBAT_ATTACK_RESULT (→ room)
```

---

## 10. Pipeline Test de Choc / Stun

### `resolveShockTest` — `statusService.js`
```
isShockTestRequired(finalSeverity, localisation) → null si non requis
seuils = calcSeuils(for_na, con_na, vol_na) → { etourdissement, inconscience }
shockMalus = getShockMalus(finalSeverity, localisation, is_lethal)
D20 roll serveur
  roll ≤ seuils.etourdissement + shockMalus → outcome = 'ok'
  roll ≤ seuils.inconscience   + shockMalus → outcome = 'etourdi'
  sinon                                       → outcome = 'inconscient'
```

### `applyStun` — `statusService.js`
```
Fetch char_type + user_id du token

Si PJ :
  shock_auto_stun (config campagne) :
    true  → COMBAT_STUN_PROMPT → socket PJ (joueur lance son D6)
    false → COMBAT_STUN_PROMPT → socket GM
  PJ offline → fallback auto D6 serveur

Si PNJ :
  shock_auto_stun true  → D6 auto serveur immédiat
  shock_auto_stun false → COMBAT_STUN_PROMPT → socket GM
```

### `COMBAT_STUN_CONFIRM` — `socketCombatResolution.js`
```
Guard FSM : SLOT_ACTIVE + COMBAT_STUN_CONFIRM
Fetch pending 'stun'
Guard : targetUserId === user.id || isGm
D6 roll serveur
stunDuration = outcome='inconscient' ? d6×10 tours : d6 tours
applyStunWithDuration() :
  INSERT token_statuses { status_code:'stunned'/'unconscious', expires_at_turn: currentTurn + duration }
  onConflict merge (re-stun → étend la durée)
  EMIT TOKEN_STATUS_UPDATED → room
```

---

## 11. `advanceSlot` / `endTurn`

### `advanceSlot`
```
Si nextIdx >= slots.length → endTurn()
Sinon :
  UPDATE combat_state SET active_slot_idx = nextIdx
  EMIT COMBAT_SLOT_ADVANCED { activeSlotIdx: nextIdx, tokenId: slots[nextIdx] }
```

### `endTurn`
```
UPDATE combat_roster SET
  has_announced  = false,
  has_resolved   = false,
  state_position    = 'standing',   [reset posture]
  state_cover       = 'exposed',
  state_vitesse     = 'normal',
  state_combat_mode = 'normal'      [reset mode — LdB §6.2]
  // ⚠️ initiative NON remise à base_ini (§6.7 LdB — dette active)

DELETE combat_actions WHERE campaign_id

UPDATE combat_state SET
  phase         = 'ANNOUNCEMENT',
  current_turn  = current_turn + 1,
  active_slot_idx = 0

Purge statuts expirés :
  DELETE token_statuses WHERE expires_at_turn ≤ newTurn
  EMIT TOKEN_STATUS_UPDATED + COMBAT_STUN_EXPIRED pour tokens affectés

setFSMSubPhase(null)
EMIT COMBAT_PHASE_CHANGED { phase:'ANNOUNCEMENT', roster }
EMIT COMBAT_SLOT_ADVANCED (premier slot ASC base_ini)
startAnnouncementTimers() (redémarre les timers pour le nouveau tour)
```

---

## 12. RD / Intégrité Drone

### `calcDroneRD(integrite)` — `socketCombatHelpers.js`
```
rdInput = integrite × 2 → lookupTable(RD_TABLE, rdInput, 'rd')
Drone sain  (integrite élevée) → rdInput élevé → rd NÉGATIF (plus vulnérable)
Drone abîmé (integrite faible) → rdInput faible → rd POSITIF (noyau durci)
```

### `resolveDroneIntegrityLoss`
```
severity : detruit(≥30) / mortelle(≥25) / critique(≥20) / grave(≥15) / moyenne(≥10) / legere(≥5)
damages[severity][premier false] = true  (JSONB case cochée)
newIntegrite = detruit ? 0 : max(0, integrite - 1)
Si detruit → DELETE combat_roster (retrait du roster immédiat)
UPDATE drone_sheet { damages, integrite_actuelle }
EMIT DRONE_INTEGRITY_UPDATED
```

---

## 13. Matrice d'adéquation Polaris

### ✅ Conforme

| Règle | Référence | Implémentation |
|---|---|---|
| INI drone = 12 (immuable) | LdB p.320 | `base_ini=12` forcé, drones exclus de STATE_COSTS |
| Ordre annonce croissant | LdB p.212 | `ORDER BY base_ini ASC` + guard `firstNonAnnounced` |
| Ordre résolution décroissant | LdB p.213 | `ORDER BY initiative DESC` |
| Modificateurs INI (dégainer, posture…) | LdB p.212 | STATE_COSTS matrix complète |
| Test Réaction surprise PJ | LdB p.213 | `roll ≤ base_ini` → succès : `ini=roll`, échec : `ini=0` |
| Test d'opposition CaC | §6.2 | `hit = A✓ && (!D✓ \|\| mrA > mrD)`, égalité → rien |
| Multi-adversaires | §6.2 | `multiAdversaryMalus(2→-5, 3→-7, 4+→-10)` |
| Multi-attaque malus | §6.3 | `2 attaques→-5, 3+→-7` (attaque ET défense) |
| Modes de combat (5 modes) | §6.2 | Atk/Def modifiés en résolution pour les deux combattants |
| Charge : élan requis | §6.2 | Guard `dist ≤ 3m → erreur` |
| Charge : +3 atk, +3 dmg, -7 def | §6.2 | `attackModeBonus=3`, `combatModeBonus=3`, `chanceDefense-=7` |
| Deux armes CaC : +3 | §6.2 | `deuxArmesBonus=3` si MD+MG équipées arme contact |
| Terrain instable : compétence limitative | §6.2 | `min(0, acrobatie - skillTotal)` |
| Drone sans esquive = test simple | §7.4 | Branche drone : `hit = roll ≤ chancesAttaque` |
| Cible drone : blindage + intégrité×2→RD | §7.6 | `calcDroneRD(integrite)` + `droneSheet.blindage` |
| Programmes drone D20 ≤ niveau | §7.3 | `chancesDeReussite = programme.level + mods` |
| Mods situationnels identiques drone/humanoïde | §7.3 | Tables partagées PORTEE/TAILLE/SITUATION |
| Pas de malus blessure/encomb. drone | §7.3 | Absents de `resolveDroneAssaultAction` |
| Test de Choc | §4 | `resolveShockTest` : seuils FOR+CON+VOL, malus par sévérité |
| Durée stun : D6 tours / D6×10 min | LdB | `d6 * (inconscient ? 10 : 1)` |
| Munitions consommées sur raté | §4 | Décompte AVANT `if (isSuccess)` |
| Reset modes/vitesse/posture fin de tour | §6.2 | `endTurn` UPDATE roster |
| Purge statuts expirés fin de tour | — | `endTurn` DELETE `expires_at_turn ≤ newTurn` |
| Guard ownership complet | — | PJ/PNJ/Drone/GM : tous les handlers |
| Entité décor exclue du combat | PC27 | `!token.character_id` → ignoré partout |

### ⚠️ Écarts / Dettes

| ID | Règle LdB | État | Gravité |
|---|---|---|---|
| **STUN2** | Stunné ne peut pas attaquer | Guard en ANNOUNCEMENT seulement. Si stun reçu après déclaration → token peut encore exécuter son assaut en RESOLUTION. | Haute |
| **§6.7** | `current_initiative = base_initiative` début de tour | `endTurn` ne remet **pas** `initiative = base_ini` — les deltas INI du tour persistaient | Moyenne (documentée) |
| **RW17-1** | `calcDroneRD` disponible en résolution | Non importée dans `socketCombatResolution.js` → `COMBAT_DAMAGE_CONFIRM` drone bloqué | Haute (bug actif) |
| **RW18-1** | Ordering émissions | `woundService`/`damageService` émettent avant `flushEmissions` dans certains paths | Moyenne |
| Surprise PNJ | Test Réaction (`roll ≤ base_ini`) | PNJ : `initiative = base_ini + roll` (toujours, sans test) — divergence volontaire ? [INCONNU] | À valider |
| §3 | INI ≤ 0 → action reportée | Non implémenté | Basse (documentée) |
| §6.5 | Action retardée (priorité) | `state_vitesse='delayed'` enregistré mais pas de mécanique de priorité en RESOLUTION | Sprint futur |
| §6.3 | Multi-attaque décalage INI (-5/-10) | Toutes les attaques au même slot INI | Sprint futur |
| §6.6 | Saisie/Lutte -3 INI | Non implémenté | Sprint futur |
| §7.1 | INI télépiloté = INI pilote | Drone toujours INI 12 | Sprint télépilotage |
| §7.2 | Séquence Détection→Ami/Ennemi→Armement | Non implémenté | Sprint Drones 2d |
| §7.4 | Programme esquive : test d'opposition | Test simple forcé (sans esquive) | Sprint futur |
| §7.4 | Programme interception | Non implémenté | Sprint futur |
| §6.9 | Arts Martiaux | Non implémenté V1 | Hors scope |

---

## 14. Pièges code spécifiques

| Piège | Détail |
|---|---|
| **BUG C** | `skillAssoc` via `ref_equipment_skill_assoc.item_id = equipment_id` (pas `char_inventory.id`) — erreur → skillTotal=0 |
| **P51** | `effectiveMalus = woundPenalty - encumbrancePenalty` ≤ 0 (formule exacte) |
| **PE14** | `pos_y` DB = Z Three.js, `pos_z` DB = Y Three.js. Range checks utilisent `pos_x/pos_y` (correct) |
| **PC25** | `surprise_roll` jamais broadcasté (filtré avant COMBAT_STARTED) |
| **PC27** | `!token.character_id` = entité décor, pas un PNJ |
| **PC29** | `active_slot_idx` indexe le roster TRIÉ DESC initiative, pas le roster brut |
| **PC32** | sequences 1/2/3 attribuées serveur — jamais trustées depuis le client |
| fire_mode_bonus_dmg | Appliqué uniquement si portée ∈ `{bout_portant, courte}` sinon 0 |
| RD drone | Drone sain → `rd` négatif (plus vulnérable aux premiers coups) — contre-intuitif |
| Initiative endTurn | `initiative` garde la valeur fin de tour (delta INI accumulé) — LdB dit l'inverse (§6.7) |
| stun source | Toujours `token_statuses WHERE status_code='stunned'`, jamais `state_character.is_stunned` |
| `COMBAT_ACTION_CONFIRM` | Charge des actions ordonnées `sequence ASC` — move (1) avant assault (3) — positions à jour pour range check |
