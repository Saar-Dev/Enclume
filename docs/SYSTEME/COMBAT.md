# SYSTEME/COMBAT.md — Données personnage serveur, calculs combat, state_character
> Source : SYSTEME.md §17
> Lire pour : COMBAT_ACTION_CONFIRM, resolveAssaultAction, charStats.js, state_character

---

## Tables impliquées

| Table | Contenu clé | Lien |
|---|---|---|
| `char_sheet` | `id` UUID, `chc`, `xp_total`, `xp_available` | `character_id → characters.id` |
| `char_attributes` | 8 lignes : `attr_id`, `base_level`, `pc_modifier` | `char_sheet_id` |
| `char_archetype` | `genotype_id` TEXT | `char_sheet_id` |
| `ref_genotypes` | `mod_for`, `mod_con`, `mod_coo`, `mod_ada`, `mod_per`, `mod_int`, `mod_vol`, `mod_pre` | `id` TEXT (ex. `'HUMAIN'`) |
| `char_skills` | `skill_id`, `mastery` INT, `is_learned` BOOL | `char_sheet_id` |
| `ref_skills` | `attr_1`, `attr_2` — attributs liés | `id` TEXT (ex. `'ARMES_POING'`) |

`GET /api/char-sheet/:characterId` retourne `{ sheet, archetype, attributes, skills }` en une requête parallèle (`char-sheet.js` ~ligne 79). **Aucune valeur pré-calculée en DB.** Les totaux sont toujours dérivés à la volée.

---

## Chaîne de calcul — skill total

```
na = calcNA(base_level, pc_modifier, mod_genotype)
   = max(3, base_level + pc_modifier + mod_genotype - TOTAL_MALUS)
   TOTAL_MALUS = 0 (historique XP non implémenté V1)
   Défaut base_level = 7 si null

an = calcAN(na)  ← table AN_TABLE ci-dessous

skillTotal = calcAN(na_attr1) + calcAN(na_attr2) + mastery
           = calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)
```

### Table Aptitude Naturelle — AN_TABLE (LdB p.114)

| NA | AN |
|---|---|
| ≤ 3 | -4 |
| 4 | -3 |
| 5 | -2 |
| 6–7 | -1 |
| 8–9 | 0 |
| 10–12 | +1 |
| 13–15 | +2 |
| 16–18 | +3 |
| 19–21 | +4 |
| 22–24 | +5 |
| ≥ 25 | +6 |

## Pattern de fetch — réutiliser sans réinventer

Handler `DICE_ROLL` (`socket/index.js` ~lignes 680-695) implémente la chaîne complète. Tout nouveau handler nécessitant un skill total serveur doit **copier ce pattern** :

```js
const charSkillRow = await db('char_skills')
  .where({ char_sheet_id: sheet.id, skill_id: skillId }).first()
const refSkill     = await db('ref_skills').where({ id: skillId }).first()
const archetype    = await db('char_archetype').where({ char_sheet_id: sheet.id }).first()
const genotypeRow  = archetype?.genotype_id
  ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
  : null
const skillTotal   = calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)
// attrs = résultat de db('char_attributes').where({ char_sheet_id: sheet.id })
```

---

## Fonctions charStats.js — référence complète

**Règle immuable :** fonctions pures — aucun accès DB. Le caller fournit toutes les données.

### Attributs

| Fonction | Paramètres | Retour | Notes |
|---|---|---|---|
| `calcNA(base_level, pc_modifier, mod_genotype)` | valeurs brutes | NA (entier ≥ 3) | Défaut base_level=7 si null |
| `calcAN(na)` | NA (entier) | AN (entier) | Table AN_TABLE (LdB p.114) |
| `calcAttributeNA(attrs, attrId, genotypeRow)` | données brutes | NA de l'attribut | Plancher 3 |
| `calcAttributeAN(attrs, attrId, genotypeRow)` | données brutes | AN de l'attribut | ≠ calcAttributeNA |
| `getGenotypeModForAttr(genotypeRow, attrId)` | ligne genotype + attrId | modificateur génotype (entier) | 0 si genotype null |

### Compétences

| Fonction | Paramètres | Retour |
|---|---|---|
| `calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)` | données brutes | skill total (entier) |

### Attributs secondaires

| Fonction | Paramètres | Retour | Formule |
|---|---|---|---|
| `calcResistanceDommages(for_na, con_na)` | FOR_na + CON_na | RD (entier, peut être positif ou négatif) | Table RD_TABLE (LdB p.114) |
| `calcSeuils(for_na, con_na, vol_na)` | FOR + CON + VOL na | `{ etourdissement, inconscience }` | étourd. = round((F+C+V)/3), inconsc. = étourd.+10 |
| `calcREA(ada_na, per_na)` | ADA_na + PER_na | REA (entier) | round((ada+per)/2) |
| `getModDom(for_na)` | FOR_na | modificateur dommages CaC (entier) | Table MOD_DOM_TABLE (LdB p.113) |
| `calcResistanceNaturelle(result_na)` | NA d'un attribut | résistance naturelle | Table RES_NAT_TABLE (LdB p.114) |
| `calcResistanceDroguesInput(con_na, vol_na)` | CON + VOL na | résistance drogues | round((con+vol)/2) |
| `calcSouffle(con_na, vol_na)` | CON + VOL na | souffle | round((con+vol)/2) |
| `calcAllures(coo_na, athletisme_total)` | COO_na + total compétence Athlétisme | `{ lente, moyenne, rapide, max }` | moy = table COO, max = table Athlétisme ×4 |

### Armures

| Fonction | Paramètres | Retour | Notes |
|---|---|---|---|
| `calcResistanceArmure(equippedItems)` | items filtrés par slot | `{ etq, prt }` (minuscules, null si pas d'armure) | Mille-feuille : max + rest/2 |
| `calcCarenceArmure(equippedItems, forNA)` | tous items équipés + FOR_na | déficit armure (entier **≥ 0**) | `max(0, worstMinStr - forNA)` — à soustraire du skill total |

⚠️ **`calcCarenceArmure` retourne ≥ 0 (déficit positif), pas un malus signé.** Utilisation : `skillTotal - calcCarenceArmure(...)`.

### Blessures & encombrement

| Fonction | Paramètres | Retour |
|---|---|---|
| `calcWoundPenalty(wounds)` | tableau `character_wounds` | malus santé (≤ 0, pire seul) |
| `calcEncumbrancePenalty(totalWeight, forValue)` | poids total + FOR nette | malus encombrement (≥ 0) — seuil = FOR×3 |
| `getShockMalus(severity, location, is_lethal)` | gravité + wound_location + flag léthal | malus Test de Choc (≤ 0) |

### XP (Skills)

| Fonction | Paramètres | Retour |
|---|---|---|
| `getCoutAugmentation(currentMastery)` | maîtrise actuelle | coût en PE pour +1 niveau |
| `getCoutDeblocageX()` | — | 3 PE (coût fixe déblocage X) |
| `getCoutTotal(from, to)` | maîtrise départ + cible | coût total PE |

**Table coûts XP :**
```
Maîtrise cible 1–5 : 1 PE/niveau
Maîtrise cible 6–10 : 2 PE/niveau
Maîtrise cible 11 : 3 PE
Maîtrise cible 12 : 5 PE
Maîtrise cible 13 : 7 PE
Maîtrise cible 14 : 9 PE
Maîtrise cible 15 : 11 PE
```

---

## Données nécessaires par rôle en combat

**Tireur :**
- `char_attributes` + `char_archetype → ref_genotypes` → pour `calcSkillTotal` + `calcCarenceArmure`
- Compétence arme :
  `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id → skill_id`
  → `char_skills WHERE { char_sheet_id, skill_id }` + `ref_skills WHERE id = skill_id`
  **ATTENTION : `ref_equipment_skill_assoc.item_id` est FK vers `ref_equipment.id`, pas `char_inventory.id`**
- `char_inventory` :
  - arme snapshot (`ref_damage_h`, `ref_range`) + armures équipées slot MG/MD → `calcCarenceArmure`
  - **TOUS les items `container != 'Coffre'`** → `totalWeight` pour `calcEncumbrancePenalty` (fetch séparé)
- `character_wounds` → pour `calcWoundPenalty`
- `combat_roster.state_character` → `is_rushed` pour le malus −5 Compétence
  **PC28 :** lire `state_character` depuis `combat_roster`, jamais depuis `combat_actions` — les actions ne portent pas l'état courant du slot

**Cible :**
- `char_sheet WHERE character_id = X` → `char_sheet_id` (pour `resolveWoundInsertion`)
- `char_attributes` + `char_archetype → ref_genotypes` → FOR_na, CON_na, **VOL_na** → `calcResistanceDommages` + `calcSeuils`
- `char_inventory` (armures équipées, filtrées slot = localisation touchée) → pour `calcResistanceArmure`

---

## Mapping slotCode → wound_location (armorConstants.js)

`LOCATION_TO_SLOT` (existant) : `'tete' → 'T'`, `'bras_droit' → 'BD'`, etc.
`SLOT_TO_WOUND_LOCATION` (**déjà exporté** dans `armorConstants.js`) : sens inverse — `'T' → 'tete'`, `'BD' → 'bras_droit'`, etc.
Utilisé dans `COMBAT_ACTION_CONFIRM` pour convertir le slotCode issu du jet de localisation vers le format attendu par `resolveWoundInsertion` + `isShockTestRequired`.

---

## state_character JSONB — combat_roster (migration 57)

Colonne `JSONB NOT NULL DEFAULT '{}'` sur `combat_roster`. Flags booléens combinables.

**Flags définis :**
| Flag | Per-turn | Effet |
|---|---|---|
| `is_rushed` | oui (effacé à endTurn) | −5 Modificateur de Compétence au jet d'attaque |
| `is_stunned` | non (persistant) | −5 actions, allure moyenne max, ne peut pas attaquer |
| `is_rooted` | non | déplacement impossible |
| `is_delayed` | oui | action retardée (V2) |

**PC39 — Règles obligatoires :**
- Clé absente = `false`. **Ne jamais stocker `false` explicitement.**
- Merge : `db.raw('state_character || ?::jsonb', [JSON.stringify({ is_rushed: true })])`
- Suppression flag : `db.raw("state_character - 'is_rushed'")`
- **Jamais** `UPDATE SET state_character = '{"is_rushed":true}'` — écrase tous les autres flags.

**Distinct de :** `state_position` (TEXT enum `standing/crouching/prone`) et `state_weapon` (TEXT enum `holstered/ready/drawn`) — ces deux colonnes sont exclusives, migration 56.

**endTurn :** effacer uniquement les flags per-turn :
```js
await db('combat_roster').where({ campaign_id })
  .update({ state_character: db.raw("state_character - 'is_rushed'") })
```

---

## Transitions de phase — payloads WS

### COMBAT_PHASE_CHANGED — payloads selon la transition
```javascript
// ROSTER → ANNOUNCEMENT (COMBAT_ANNOUNCE_START)
{ phase: 'ANNOUNCEMENT' }  // pas de roster

// ANNOUNCEMENT → RESOLUTION (startResolutionPhase, auto quand tous déclarés)
{ phase: 'RESOLUTION', roster: RosterEntry[], actions: CombatAction[] }
// suivi immédiatement de COMBAT_SLOT_ADVANCED { activeSlotIdx: 0, tokenId }

// RESOLUTION → ANNOUNCEMENT (endTurn, fin de tous les slots)
{ phase: 'ANNOUNCEMENT', roster: RosterEntry[] }  // actions déjà nettoyées
```

### COMBAT_SLOT_ADVANCED payload
```javascript
{ activeSlotIdx: number, tokenId: string }
// Émis par : startResolutionPhase (idx=0), advanceSlot (idx+1), endTurn (→ annonce)
```

### endTurn — comportement serveur
```javascript
// 1. Reset roster (toutes les entrées status='active') :
await db('combat_roster').where({ campaign_id, status: 'active' }).update({
  has_announced: false,
  has_resolved:  false,
  state_character: db.raw("state_character - 'is_rushed'"),  // flags per-turn
})
// 2. Vider toutes les actions du tour :
await db('combat_actions').where({ campaign_id }).delete()
// 3. Incrémenter current_turn, reset active_slot_idx=0, phase='ANNOUNCEMENT'
// 4. Broadcast COMBAT_PHASE_CHANGED { phase: 'ANNOUNCEMENT', roster }
```

---

## COMBAT_START / COMBAT_ANNOUNCE_START

```javascript
// COMBAT_START (GM → serveur)
socket.emit(WS.COMBAT_START, {
  battlemap_id: battlemapId,
  surprisedTokenIds: string[],   // tokenIds marqués surpris dans le roster
  excludedTokenIds: string[],    // tokenIds exclus du combat
})

// COMBAT_ANNOUNCE_START (GM → serveur, no payload)
socket.emit(WS.COMBAT_ANNOUNCE_START)

// Endpoint INI preview (avant COMBAT_START) :
GET /battlemaps/:battlemapId/combat-ini → { iniPreview: [{ token_id, base_ini }] }
```

### Logique COMBAT_START (serveur)

- **base_ini** = `calcREA(ada_na, per_na)` = `round((ADA + PER) / 2)`
- **Égalité d'initiative** → `Math.random()` (LdB : simultanéité)
- **PNJ surpris** → jet auto serveur `Math.ceil(Math.random() * 20)` ; initiative = `base_ini + roll`
- **PJ surpris** → `COMBAT_SURPRISE_ROLL` émis au socket joueur ; le joueur lance lui-même puis émet `COMBAT_SURPRISE_RESULT`
- **PC25** : `surprise_roll` n'est **jamais** dans le broadcast `COMBAT_STARTED` (roster sans ce champ)
- **Entités** (token sans `character_id`) → ignorées, jamais insérées en `combat_roster`
- **combat_state** insérée : `{ campaign_id, battlemap_id, phase: 'ROSTER', current_turn: 1, active_slot_idx: 0, action_timer_sec: 0 }`

---

## combat_actions — shape complète (DB)

```javascript
{
  campaign_id,
  token_id,
  action_key,           // 'assault' | 'move_lente' | 'move_moyenne' | 'rushed' | etc.
  type,                 // 'assault' | 'move_short' | 'move_long' | 'micro' | 'skip'
  sequence,             // 1=moves, 2=micro, 3=assault — ordre d'exécution par slot
  weapon_inv_id,        // char_inventory.id (assault uniquement)
  target_token_id,      // token cible (assault uniquement)
  fire_mode,            // 'CC' | 'RC' | 'RL'
  bullet_count,         // nombre de balles
  fire_mode_bonus_comp, // bonus Compétence mode de tir
  fire_mode_bonus_dmg,  // bonus Dommages mode de tir
  modifiers: {          // JSON parsé : ini_mod, ref_range (assault), dual_wield, dual_wield_bonus_comp
    ini_mod: 0,
    ref_range: string,  // ref_equipment.range de l'arme déclarée — utilisé par CombatModifiersWindow
    dual_wield: bool,
    dual_wield_bonus_comp: number,
  },
  status,               // 'pending' | 'resolved'
}
```

**Type enum :** `move_lente` → `'move_short'`, toute autre `move_*` → `'move_long'`, autres → `'micro'`.
**PC32 :** sequence attribuée serveur — jamais calculée côté client.
**PC22 :** arme assault doit être en slot `'MG'` ou `'MD'` — rejeté sinon.
**PC23 :** `'RC'` / `'RL'` nécessitent `is_learned=true` pour `TIR_AUTOMATIQUE`.
**PC33 :** coordonnées `moveAction` doivent être des entiers valides (coords DB PE14).

---

## COMBAT_ACTION_DECLARE — payload complet

```javascript
socket.emit(WS.COMBAT_ACTION_DECLARE, {
  tokenId,           // token déclarant
  selectedKeys,      // string[] — clés d'actions (voir KEY_MOD ci-dessous)
  moveAction,        // { targetPosX, targetPosY, targetPosZ } | null — déplacement déclaré (coords PE14)
  weaponInvId,       // char_inventory.id de l'arme (obligatoire si 'assault' dans selectedKeys)
  targetTokenId,     // token cible (obligatoire pour assaut)
  fireMode,          // 'CC' | 'RC' | 'RL' — cadence de tir
  bulletCount,       // nombre de balles consommées (RC/RL)
  fireModeBonusComp, // bonus Compétence du mode de tir (calculé côté client)
  fireModeBonusDmg,  // bonus Dommages du mode de tir (calculé côté client)
  isDualWield,       // bool — tir dual wield
  dualWieldBonusComp // bonus Compétence dual wield (calculé côté client)
})
```

### KEY_MOD — table complète des clés d'actions (socket/index.js)

Modifie `totalDiffMod` dans la résolution de compétence :

```javascript
const KEY_MOD = {
  rushed:              +3,
  micro_draw_ready:    -3,  micro_draw:         -5,
  micro_phrase:        -3,  micro_fire_mode:    -3,
  micro_observe_5:     -5,  micro_observe_10:  -10,  micro_observe_15: -15,  micro_observe_20: -20,
  micro_locate_5:      -5,  micro_locate_10:  -10,  micro_locate_15:  -15,  micro_locate_20:  -20,
  micro_mechanism_3:   -3,  micro_mechanism_5:  -5,
  crouch:              -3,  dive:               -5,  stand_up:         -10,  take_cover:        -3,
  assault:              0,  close_combat:       -3,
  cover_shot_3:        -3,  cover_shot_5:       -5,
}
```

⚠️ `rushed` ici = action déclarée "en hâte" (+3 CDR, bonus). Distinct de `state_character.is_rushed` (flag état, −5 Compétence, appliqué séparément).

### FIRE_MODE_VARIANTS — table complète (LdB p.227-228)

**CC (Coup par coup) :**
| id | bulletCount | bonusComp | bonusDmg |
|---|---|---|---|
| cc_1 | 1 | 0 | 0 |
| cc_2 | 2 | +1 | 0 |
| cc_3 | 3 | +2 | 0 |
| cc_4 | 4 | +3 | 0 |
| cc_7a | 7 | +4 | 0 |
| cc_7b | 7 | +3 | +3 |
| cc_10a | 10 | +5 | 0 |
| cc_10b | 10 | +4 | +3 |

**RC (Rafale courte) :** rc_3 — 3b, +3 comp, +5 dmg (unique option, auto-sélectionné)

**RL (Rafale longue) :**
| id | bulletCount | bonusComp | bonusDmg |
|---|---|---|---|
| rl_5 | 5 | +2 | +2 |
| rl_10 | 10 | +4 | +4 |
| rl_15 | 15 | +6 | +6 |
| rl_20 | 20 | +8 | +8 |
| rl_mc | 5 | 0 | 0 |

**Dual wield** — bonus Comp si 2 armes même mode : +3 (CC/RC), +5 (RL). Si modes différents → force CC.

### MOVE_ZONE_DEFS — allures de déplacement combat (combatSections.js)

| allureKey | action_key | ini_mod | couleur |
|---|---|---|---|
| `lente` | `move_lente` | -3 | bleu #3b82f6 |
| `moyenne` | `move_moyenne` | -5 | vert #22c55e |
| `rapide` | `move_rapide` | -7 | orange #f97316 |
| `max` | `move_max` | 0 | rouge #ef4444 |

Le radius de chaque zone = `allures[allureKey]` — calculé depuis COO_na + athletisme_total via `calcAllures`.

### Actions inactives (SECTIONS — non implémentées)
`active: false` → grayed out, non cliquable dans CombatActionWindow :
- `micro_delay` — Retarder son action (V2)
- `multi_attack` — Attaque multiple (sprint futur)
- `change_fire_mode` — Changer le mode de tir (sprint futur)

## COMBAT_ACTION_CONFIRM — payload confirmedModifiers

```javascript
socket.emit(WS.COMBAT_ACTION_CONFIRM, {
  tokenId: activeRosterEntry.token_id,
  confirmedModifiers: {
    portee,     // 'bout_portant' | 'courte' | 'moyenne' | 'longue' | 'extreme'
    situation,  // string[] — sitKeys sélectionnés (voir tables ci-dessous)
    taille,     // 'minuscule' | 'tres_petite' | 'petite' | 'moyenne' | 'grande' | 'tres_grande' | 'enorme' | 'gigantesque'
  },
})
```

### Tables de modificateurs situationnels (CombatModifiersWindow)

**Portée :**
| Key | Mod Comp |
|---|---|
| `bout_portant` | +5 |
| `courte` | 0 |
| `moyenne` | -5 |
| `longue` | -10 |
| `extreme` | -15 |

**Allure tireur (sitKey / mod) :**
| val | sitKey | Mod |
|---|---|---|
| `immobile` | null | 0 |
| `tireur_allure_lente` | `tireur_allure_lente` | -3 |
| `tireur_allure_moyenne` | `tireur_allure_moyenne` | -5 |
| `tireur_allure_rapide` | `tireur_allure_rapide` | -7 |
| `tireur_allure_maximale` | `tireur_allure_maximale` | **-99 (impossible)** |

**Allure cible :**
| val | sitKey | Mod |
|---|---|---|
| `cible_immobile` | `cible_immobile` | +3 |
| `cible_lente` | null | 0 |
| `cible_allure_moyenne` | `cible_allure_moyenne` | -3 |
| `cible_allure_rapide` | `cible_allure_rapide` | -5 |
| `cible_allure_maximale` | `cible_allure_maximale` | -7 |

**Couverture :**
| key | Mod |
|---|---|
| `couverture_partielle` (50%) | -3 |
| `couverture_importante` (75%) | -5 |

**Obscurité :**
| key | Mod |
|---|---|
| `obscurite_legere` | -3 |
| `obscurite_importante` | -5 |
| `obscurite_totale` | **-99 (impossible)** |

**Taille cible :**
| key | Mod |
|---|---|
| `minuscule` (~30 cm) | -10 |
| `tres_petite` (~50 cm) | -5 |
| `petite` (~1 m) | -3 |
| `moyenne` (humaine) | 0 |
| `grande` (~3 m) | +3 |
| `tres_grande` (~5 m) | +5 |
| `enorme` (~7 m) | +10 |
| `gigantesque` (10 m+) | +15 |

**Détection allure auto :** si tireur/cible a une action `move_lente/move_moyenne/move_rapide/move_max` dans le store actions → allure pré-remplie. Les valeurs sont overridables manuellement.

**hasTirImpossible :** `tireurAllureMod === -99 || obscurites.includes('obscurite_totale')` — désactive le bouton "Lancer les dés".

### attackResult shape (COMBAT_ATTACK_PLAYER_RESULT → SessionPage → CombatModifiersWindow)
```javascript
{ hit: bool, roll: number, cdr: number, tireurTokenId: string, cibleTokenId: string }
```

### Endpoint weapon-skill
```
GET /char-sheet/:characterId/weapon-skill/:weaponInvId
→ { skillLabel, skillTotal }  // compétence liée à l'arme, total calculé serveur
```

---

## Vérification compétence limitative (PC23 — Tir Automatique)

```js
const tirAutoRow = await db('char_skills')
  .where({ char_sheet_id: sheet.id, skill_id: 'TIR_AUTOMATIQUE' }).first()
const hasTirAuto = tirAutoRow?.is_learned === true
// Guard COMBAT_ACTION_DECLARE : si AUTO sélectionné ET !hasTirAuto → reject
```

---

## Résolution dégâts — tables serveur (resolveAssaultAction / COMBAT_DAMAGE_CONFIRM)

### LOC_TABLE — Localisation D20 (socket/index.js)
| D20 | SlotCode | Localisation |
|---|---|---|
| 1–2 | T | tete |
| 3–8 | C | corps |
| 9–11 | BD | bras_droit |
| 12–14 | BG | bras_gauche |
| 15–17 | JD | jambe_droite |
| 18–20 | JG | jambe_gauche |

### Seuils sévérité (dégâts nets)
| Dégâts nets | Sévérité | is_lethal |
|---|---|---|
| ≥ 30 | mortelle | true |
| 25–29 | mortelle | false |
| 20–24 | critique | false |
| 15–19 | grave | false |
| 10–14 | moyenne | false |
| 5–9 | légère | false |
| < 5 | null (pas de blessure) | false |

### Formule dégâts nets
```
degautsBruts = rawDice + modDomAttaque(mr) + modDegatsMode
modDegatsMode = fire_mode_bonus_dmg si portée ∈ {bout_portant, courte}, sinon 0
degatsNets = max(0, degautsBruts - etq - rd)
rd = calcResistanceDommages(for_na_cible, con_na_cible)
```
⚠️ **`fire_mode_bonus_dmg` n'est appliqué qu'en portée courte/bout portant.**

### COMBAT_ATTACK_RESULT payload (broadcast → room)
```javascript
{
  tireurId, cibleId,
  localisation,     // slug 'tete' | 'corps' | ...
  degautsBruts, degatsNets,
  severity,         // finalSeverity (après promotion P49)
  is_lethal,
  isSuccess,
  shockResult: null | {
    triggered: true,
    roll: number,
    outcome: 'ok' | 'etourdi' | 'inconscient',
    shockMalus: number,
  }
}
```

### pendingDamageActions
Map in-memory (`new Map()`) — stocke les paramètres bruts entre COMBAT_ATTACK_PLAYER_RESULT et COMBAT_DAMAGE_CONFIRM. **Perd son contenu si le serveur redémarre entre les deux événements.**

---

## PC27 — Entité ≠ PNJ

`!token.character_id` = Entité de décor (porte, console) — **jamais un PNJ**.
PNJ = `character.type === 'pnj'`.
Entité exclue du combat (`continue` dans COMBAT_START).
`characters.type` enum `'pj'|'pnj'` — extensible (`'vehicle'`, `'drone'`). Source de vérité unique.

---

## Flux combat côté client — shapes SessionPage

### combatMoveMode
```javascript
// null | {
//   tokenId,         // token qui se déplace
//   zones,           // [{ radius, action_key, ini_mod, color, label }] — calculé dans CombatActionWindow
//   onMoveSelected,  // closure CombatActionWindow — appelée avec sel (pendingMoveSelection)
//   onCancel,        // closure CombatActionWindow
//   onPendingMove,   // (sel) => setPendingMoveSelection(sel) — survol zone
// }
```

### combatTargetMode
```javascript
// null | {
//   tokenId,           // token qui attaque
//   pendingTargetId,   // token survolé (null = aucun)
//   onTargetSelected,  // closure CombatActionWindow — appelée avec targetTokenId
//   onCancel,          // closure CombatActionWindow
//   onPendingTarget,   // (id) => setCombatTargetMode(prev => { ...prev, pendingTargetId: id })
// }
```

### damagePayload / damageResults
```javascript
// damagePayload — issu de COMBAT_DAMAGE_PROMPT :
{ tokenId, formula, targetName }

// damageResults — issu de COMBAT_DAMAGE_RESULT :
{
  rollLoc,       // résultat D20 localisation
  locLabel,      // label lisible (ex. 'Corps')
  degautsBruts,  // total dégâts bruts
  dmgRolls,      // number[] — résultats individuels des dés
  degatsNets,    // dégâts après armure
  severity,      // 'legere' | 'moyenne' | 'grave' | 'critique' | 'mortelle' | null
  severityColor, // hex string — couleur SEVERITY_COLORS[severity]
}
// Les deux sont clearés ensemble par onDamageConfirmed()

// COMBAT_DAMAGE_CONFIRM payload (PJ → serveur) :
socket.emit(WS.COMBAT_DAMAGE_CONFIRM, { tokenId: payload.tokenId })
```

### Props CombatOverlay (depuis SessionPage)
```javascript
<CombatOverlay
  socket={socket}
  battlemap={battlemap}
  isGm={isGm}
  user={user}
  characters={characters}
  // tokens={tokens}  ← passé mais IGNORÉ — CombatOverlay lit tokenStore directement
  pendingSurpriseRoll={pendingSurpriseRoll}     // null | { tokenId }
  onSurpriseRolled={handleSurpriseRolled}
  onEnterMoveMode={handleEnterMoveMode}
  combatMoveMode={combatMoveMode}
  pendingMoveSelection={pendingMoveSelection}
  onValidateMove={handleValidateMove}
  onCancelPendingMove={handleCancelPendingMove}
  combatTargetMode={combatTargetMode}
  onEnterTargetMode={handleEnterTargetMode}
  onValidateTarget={handleValidateTarget}
  damagePayload={damagePayload}
  damageResults={damageResults}
  onDamageConfirmed={() => { setDamagePayload(null); setDamageResults(null); setAttackResult(null) }}
  attackResult={attackResult}
  onAttackConfirmed={() => setAttackResult(null)}
/>
```

### sortedRoster — PC29
```javascript
// Dans CombatOverlay (et tout composant qui calcule le "slot actif") :
const sortedRoster = [...roster].sort((a, b) => b.initiative - a.initiative)
const activeEntry = sortedRoster[activeSlotIdx]
```
**`activeSlotIdx` indexe le roster TRIÉ par initiative décroissante, pas le roster brut.**
Toute dérivation du slot actif doit trier le roster avant d'appliquer l'index.

### Conditions de visibilité des sous-composants (CombatOverlay)

| Composant | Condition |
|---|---|
| `CombatTimeline` | `phase !== null` — tous |
| `CombatRosterWindow` | GM + `phase === null \|\| 'ROSTER'` |
| `CombatPnjPanel` | GM + `phase === 'ANNOUNCEMENT'` — toggle portrait |
| `CombatGmDeclareWindow` | GM + `phase === 'ANNOUNCEMENT'` |
| `CombatActionWindow` | PJ + `phase === 'ANNOUNCEMENT'` OU `phase === 'RESOLUTION' && !playerActiveAssaultAction && !attackResult` |
| Bouton "Agir" GM inline | GM + `phase === 'RESOLUTION' && !activeAssaultAction` |
| `CombatModifiersWindow` PJ | PJ + `phase === 'RESOLUTION' && (playerActiveAssaultAction \|\| attackResult)` |
| `CombatModifiersWindow` GM | GM + `phase === 'RESOLUTION' && activeAssaultAction && character.type === 'pnj'` |
| `CombatDamageWindow` | `damagePayload !== null` |
| Overlay visée cible | `combatTargetMode !== null` |
| Overlay déplacement | `combatMoveMode !== null` |

### Props sous-composants combat
```javascript
// CombatModifiersWindow
{ socket, assaultAction, activeRosterEntry, attackResult, onAttackConfirmed }

// CombatDamageWindow
{ payload: damagePayload, results: damageResults, socket, onConfirmed: onDamageConfirmed }

// CombatRosterWindow
{ socket, battlemapId: battlemap?.id }

// CombatActionWindow
{ socket, user, characters, pendingSurpriseRoll, onSurpriseRolled, onEnterMoveMode, onEnterTargetMode }
```

### PC36 — combatCameraCenter : centrage caméra sur token actif
```javascript
// Shape : { x, z } coords DB (PE14) | null
// Canvas3D useEffect([combatCameraCenter]) :
//   orbitRef.current.target.set(x + 0.5, 0, z + 0.5); orbitRef.update()
// Guard : null → return (caméra reste, annulation ne la déplace pas)
// Calculé dans SessionPage → CombatActionWindow → combatTokenPos
```

### Rendu 3D combat — Canvas3D

#### Anneaux déplacement combat
- Centré sur `myToken` : `cx = pos_x+0.5`, `cz = pos_y+0.5` (PE14)
- Y : `pos_z + 1.0 + 0.05` (PE34 — pieds du token)
- Group rotation `[-Math.PI/2, 0, 0]` (couché au sol)
- `zones[0]` → `circleGeometry args=[radius, 64]`
- `zones[i>0]` → `ringGeometry args=[prev.radius, radius, 64]`
- Material : `transparent, opacity=0.25, depthWrite=false`

#### Cursor wireframe case survolée (combatMoveMode)
- Mis à jour dans `handlePointerMove` : `{ x: Math.floor(worldPos.x), z: Math.floor(worldPos.z) }`
- Y : `curToken.pos_z + 1.0 + 0.05` ou `0.1` si token non trouvé
- `planeGeometry args=[1,1]` + wireframe blanc

#### Ligne de visée assaut (targetLinePoints)
- `useMemo([combatTargetMode?.pendingTargetId])`
- Guard : requiert `pendingTargetId` + `tokenId` + les deux tokens trouvés dans tokenStore
- Points : `Float32Array[6]` → `[myToken.pos_x+0.5, myToken.pos_z+1.5, myToken.pos_y+0.5, tgt.pos_x+0.5, tgt.pos_z+1.5, tgt.pos_y+0.5]`
- (PE14 + PE34 : altitude = pos_z+1.5, profondeur = pos_y)
- Rendu : `<line>` + `lineBasicMaterial color="#e07070"`
