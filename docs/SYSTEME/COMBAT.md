# SYSTEME/COMBAT.md — Données personnage serveur, calculs combat, state_character
> Source : SYSTEME.md §17
> Lire pour : COMBAT_ACTION_CONFIRM, resolveAssaultAction, charStats.js, state_character
> Règles LdB complètes (actions, déplacements, CaC, tir) : voir `docs/SYSTEME/REGLES_LdB.md`

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

## Compétences réservées (X) — accessibilité (P55)

`calcSkillCost` (`shared/polarisUtils.js`) bloque (`cost: Infinity`) toute compétence marquée `(X)` si
`!isLearned && target > 0`. `isLearned` doit couvrir **trois** cas, tous confirmés par la règle LdB
(`docs/REGLES/REGLECOMPETENCE.md` — « on ne peut apprendre une telle Compétence que par le biais d'une
Profession... ou d'une Formation ») :
1. `openedSkills.includes(skillId)` — déblocage explicite (Avantage Formation).
2. `(baseMastery[skillId] ?? 0) > 0` — un bonus d'origine positif prouve que le personnage la pratique déjà.
3. `isPro` — listée par une carrière retenue.

Oublier le cas (3) reproduit le bug Session 139 (Lot 2) : une `(X)` professionnelle sans bonus d'origine
plante en `-Infinity`. Le malus « base -3 » du premier point investi s'applique quand même dans les
trois cas — ce n'est pas un blocage, juste un coût de départ plus élevé (1pt pour atteindre -3, avant de
grimper normalement).

**Piège wiring associé** : `computeSkillAllocation` (`shared/careerSkills.js`) ne doit recevoir QUE les
`skill_id` réellement modifiés par le joueur — jamais un remplissage de toutes les compétences affichées
avec leur valeur de base, sinon le calcul est déclenché inutilement pour des compétences jamais touchées.
Le plafond d'une ligne non touchée se calcule séparément via `getSkillCap(skillId, ctx)`.

---

## Données nécessaires par rôle en combat

**Tireur :**
- `char_attributes` + `char_archetype → ref_genotypes` → pour `calcSkillTotal`
- Compétence arme :
  `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id → skill_id`
  → `char_skills WHERE { char_sheet_id, skill_id }` + `ref_skills WHERE id = skill_id`
  **ATTENTION : `ref_equipment_skill_assoc.item_id` est FK vers `ref_equipment.id`, pas `char_inventory.id`**
- `char_inventory` :
  - arme snapshot (`ref_damage_h`, `ref_range`)
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

## Colonnes état combat_roster — Persistance

Cinq colonnes TEXT enum sur `combat_roster`, toutes NOT NULL avec DEFAULT.

| Colonne | Migration | CHECK values | Default | Persistance | Reset endTurn |
|---|---|---|---|---|---|
| `state_position` | 56 | `'standing'\|'crouching'\|'prone'` | `'standing'` | **par tour** | → `'standing'` |
| `state_weapon` | 56 | `'holstered'\|'ready'\|'drawn'` | `'holstered'` | **combat** | inchangé |
| `state_fire_mode` | 58 | `'cc'\|'rc'\|'rl'` | `'cc'` | **combat** | inchangé |
| `state_cover` | 58 | `'exposed'\|'partial'\|'important'` | `'exposed'` | **par tour** | → `'exposed'` |
| `state_vitesse` | 58 | `'normal'\|'delayed'\|'rushed'` | `'normal'` | **par tour** | → `'normal'` |

**Règle :** `state_weapon` et `state_fire_mode` survivent entre les tours (posture d'arme réelle). `state_position`, `state_cover`, `state_vitesse` se réinitialisent à chaque nouveau tour.

**Labels UI (français) :**
- `state_position` : `'standing'`→ Debout, `'crouching'`→ Accroupi, `'prone'`→ Couché
- `state_weapon` : `'holstered'`→ Rangée, `'ready'`→ Main sur l'arme, `'drawn'`→ Au clair
- `state_fire_mode` : `'cc'`→ Coup par coup, `'rc'`→ Rafale courte, `'rl'`→ Rafale longue
- `state_cover` : `'exposed'`→ Découvert, `'partial'`→ Partielle (50%), `'important'`→ Importante (75%)
- `state_vitesse` : `'normal'`→ Normale, `'delayed'`→ Retardée, `'rushed'`→ Précipitée

**Matrices de transition INI :**
```
POSITION:
  standing  → { crouching: -3, prone: -5 }
  crouching → { standing:  -3, prone: -5 }
  prone     → { standing: -10, crouching: -10 }

WEAPON:
  holstered → { ready: -3, drawn: -5 }
  ready     → { holstered: -5, drawn: -3 }
  drawn     → { holstered: -10, ready: -3 }

FIRE_MODE: tout changement → -3

COVER: aucun coût INI (flag défensif pur, affecte les tireurs adverses en Phase 2)

VITESSE:
  delayed  → 0 (ordre spécial : résolution en fin de round)
  normal   → 0
  rushed   → +3 INI / −5 Modificateur de Compétence en Phase 2
```

**Effets Phase 2 :**
- `state_vitesse = 'rushed'` : +3 CDR à la déclaration, −5 à tous les tests d'action en résolution
- `state_vitesse = 'delayed'` : pas de modification INI, mais l'acteur est repoussé en fin d'ordre de résolution (logique custom endTurn V2)
- `state_cover != 'exposed'` : modificateur défensif appliqué aux jets des tireurs adverses (table COUVERTURES dans CombatModifiersWindow)

---

## state_character JSONB — combat_roster (migration 57)

Colonne `JSONB NOT NULL DEFAULT '{}'` sur `combat_roster`. Flags booléens combinables pour statuts volatils.

**Flags définis :**
| Flag | Per-turn | Effet | Settable | Enforced |
|---|---|---|---|---|
| `is_stunned` | non (persistant) | −5 actions, allure moyenne max, ne peut pas attaquer | ✅ session 66 | ❌ sprint futur |
| `is_rooted` | non | déplacement impossible | ❌ | ❌ |

⚠️ **`is_rushed` supprimé** — migré vers `state_vitesse = 'rushed'` (migration 58). Toute lecture `state_character?.is_rushed` → remplacer par `rosterEntry.state_vitesse === 'rushed'`.

**PC39 — Règles obligatoires :**
- Clé absente = `false`. **Ne jamais stocker `false` explicitement.**
- Merge : `db.raw('state_character || ?::jsonb', [JSON.stringify({ is_stunned: true })])`
- Suppression flag : `db.raw("state_character - 'is_stunned'")`
- **Jamais** `UPDATE SET state_character = '{"is_stunned":true}'` — écrase tous les autres flags.

**PC42 — `is_stunned` : enforced ✅ (PC42 réglé)**

`is_stunned` est posé automatiquement dans `state_character` après un Test de Choc (outcome `etourdi` ou `inconscient`) via `applyStunWithDuration` (helper dédié, `stunned_until_turn` stocké en JSONB).

**Enforcement dans `COMBAT_ACTION_DECLARE` (lignes 1928-1943) ✅ :**
- interdit `mapActions.attack` (assaut distance)
- interdit `mapActions.melee` (CaC)
- interdit `move_rapide` et `move_max`

**Purge / cycle de vie `is_stunned` :**
- `checkStunExpiry` (appelé dans `advanceSlot`) : purge automatique quand `stunned_until_turn <= current_turn` → efface `is_stunned` + `stunned_until_turn` du JSONB + retire badge `token_statuses`.
- `COMBAT_APPLY_STUN` : handler GM pour application manuelle avec durée.

**`is_surprised` — lifecycle absent ⚠️**
- Colonne directe sur `combat_roster` (PAS dans `state_character` JSONB).
- Posée à COMBAT_START. **Jamais effacée** (`endTurn` ne la reset pas).
- Conséquence : si utilisée comme condition gameplay (ex. bypass défense), elle s'appliquerait tous les tours — incorrect pour une surprise premier tour uniquement.
- Fix requis : purge dans `endTurn` OU migration vers `token_statuses` avec `expires_at_turn`. Voir **PLAN 14** dans ROADMAP.md.

**Mots-clés :** `is_stunned`, `stunned`, `étourdi`, `inconscient`, `Test de Choc`, `shockResult`, `purge`, `clear`, `lifecycle`, `COMBAT_END`, `enforcement`, `COMBAT_ACTION_DECLARE`.

**endTurn :** reset colonnes per-turn + nettoyage JSONB :
```js
await db('combat_roster').where({ campaign_id, status: 'active' }).update({
  state_position: 'standing',
  state_cover:    'exposed',
  state_vitesse:  'normal',
  // state_weapon et state_fire_mode : inchangés (persistent)
  // state_character : pas de flags per-turn définis en V1 — is_stunned persiste intentionnellement
})
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
  has_announced:     false,
  has_resolved:      false,
  state_position:    'standing',   // per-turn
  state_cover:       'exposed',    // per-turn
  state_vitesse:     'normal',     // per-turn (remplace l'ancien flag is_rushed dans state_character — migration 58)
  state_combat_mode: 'normal',     // per-turn
  // state_weapon, state_fire_mode : inchangés (persistent combat)
  // state_character : is_stunned persiste intentionnellement (non per-turn)
})
// 2. Vider toutes les actions du tour :
await db('combat_actions').where({ campaign_id }).delete()
// 3. Incrémenter current_turn, reset active_slot_idx=0, phase='ANNOUNCEMENT'
// 4. Broadcast COMBAT_PHASE_CHANGED { phase: 'ANNOUNCEMENT', roster }
// 5. Émettre COMBAT_SLOT_ADVANCED { activeSlotIdx:0, tokenId: firstAnnounceSlot }
// 6. Relancer les timers auto-skip (startAnnouncementTimers)
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

**Type enum :** `move_lente` → `'move_short'`, toute autre `move_*` → `'move_long'`, autres → `'micro'`. **Melee** → `'melee'` (migration 63).
**PC32 :** sequence attribuée serveur — jamais calculée côté client.
**PC22 :** arme assault doit être en slot `'MG'` ou `'MD'` — rejeté sinon.
**PC23 :** `'RC'` / `'RL'` nécessitent `is_learned=true` pour `TIR_AUTOMATIQUE`.
**PC33 :** coordonnées `moveAction` doivent être des entiers valides (coords DB PE14).

---

## Corps à Corps — Sprint CaC 1 (session 67)

### Flux complet

```
ANNOUNCEMENT : joueur déclare melee { targetTokenId, weaponInvId }
  → serveur valide distance ≤ 3 + allonge (PE14 — dist2D)
  → si hors portée : COMBAT_DECLARE_ERROR (message distance) → return (pas announced)
  → si OK : action melee stockée (type='melee', weapon_inv_id, target_token_id, modifiers:{ini_mod:-3})

RESOLUTION (COMBAT_ACTION_CONFIRM) :
  → resolveMeleeAction()
  → calcul skillTotal attaquant (weapon → ref_equipment_skill_assoc → skill_id, ou COMBAT_A_MAINS_NUES si mains nues)
  → roll D20 attaquant côté serveur
  → fetch skillTotal défenseur (toujours COMBAT_A_MAINS_NUES en V1)
  → défenseur PNJ → roll D20 auto → résolution → COMBAT_MELEE_RESULT → advanceSlot (slot non bloqué)
  → défenseur PJ → stocke pendingMeleeDefense → COMBAT_MELEE_DEFENSE_PROMPT → return true (slot BLOQUÉ)

COMBAT_MELEE_DEFENSE_CONFIRM (défenseur PJ clique "Défendre") :
  → roll D20 défenseur côté serveur
  → hit = (rollAtk ≤ CDRatk) AND NOT (rollDef ≤ CDRdef)
  → COMBAT_MELEE_RESULT → room
  → si hit + PJ attaquant → COMBAT_DAMAGE_PROMPT → PJ roule dégâts (CombatDamageWindow existant)
  → si hit + PNJ attaquant → auto dégâts → COMBAT_ATTACK_RESULT
  → advanceSlot (slot débloqué)
```

### Formules

```js
// Skill attaquant (ou défenseur)
skillTotal = calcAN(for_na) + calcAN(coo_na) + mastery  // COMBAT_A_MAINS_NUES / COMBAT_ARME : attr FOR+COO

// Chances de réussite attaque
chancesAttaque = skillTotal + effectiveMalus + isRushedMod

// Chances de réussite défense
chanceDefense = defenderSkillTotal + defenderEffectiveMalus

// Résolution opposition (Polaris LdB)
hit = (rollAttaque <= chancesAttaque) AND NOT (rollDefense <= chanceDefense)

// Dégâts bruts melee (dans COMBAT_DAMAGE_CONFIRM, type='melee')
degautsBruts = rawDice + getModDom(for_na_attaquant)   // pas de MR table, pas de fire_mode_bonus
```

### Filtrage armes de contact (client)

```js
// CORRECT : filtrer par category, pas par location + range IS NULL
item.ref_category === 'Arme de contact'
  && (item.slot === 'MG' || item.slot === 'MD' || item.slot === '2M')

// allonge : ref_equipment.range pour 'Arme de contact' = allonge en mètres (1/2/3), PAS portée de tir
// distance max = 3 + parseInt(weapon.ref_range || '0')
```

### Modes de combat — Sprint CaC 2 (session 68)

Implémentés : Normal, Offensif, Charge. En DB (prêts pour CaC3) : Défensif, Retraite.

| Mode | Effet attaque | Effet défense (si attaqué) | Contrainte |
|---|---|---|---|
| `normal` | ±0 | ±0 | — |
| `offensif` | +3 | −5 | — |
| `charge` | +3 + **+3 dégâts** | −7 | Doit être à > 3m, dépl. court gratuit |
| `defensif` | pas d'attaque | +3 | Retarde l'action (CaC3) |
| `retraite` | pas d'attaque | +5 | Retarde + recule (CaC3) |

**Stockage :** `combat_roster.state_combat_mode` — reset à 'normal' à chaque `endTurn`.

**Flux client (PJ) :**
```
Panneau melee → chips Normal/Offensif/Charge
Charge : handleChargeFlow() → onEnterMoveMode(chargeAllures=lente×4) → onMoveSelected
  → auto-enchaîne onEnterTargetMode → meleePendingTokenId
Payload : state.combat_mode + move.ini_mod=0 + melee.targetTokenId
```

**Flux client (GM) :**
```
Clic CaC → meleePendingMode=true → panneau droit 720px visible avec 3 chips
Normal/Offensif → handleStartMeleeQueue()
Charge → handleStartChargeQueue() : pour chaque PNJ → onEnterMoveMode → onEnterTargetMode
chargeSelections[tokenId] = { move: {...,ini_mod:0}, targetTokenId }
```

**Flux serveur :**
```
COMBAT_ACTION_DECLARE : state.combat_mode → UPDATE combat_roster.state_combat_mode
  move Charge : chargeMove = (combat_mode==='charge' && mapActions.move) → iniDelta += 0
  melee Phase 1 : aucune validation distance — intention libre

COMBAT_ACTION_CONFIRM (Phase 2) :
  move_short fires first → token moves in DB
  resolveMeleeAction fires → fetch token positions (post-move) → check dist ≤ 3+allonge
    read rosterAttaquant.state_combat_mode → attackModeBonus (+3 offensif/charge)
    read rosterDefendeur.state_combat_mode → chanceDefense ajustée
    combatModeBonus = charge ? 3 : 0 → stocké dans commonPending → pendingDamageActions

COMBAT_DAMAGE_CONFIRM : degautsBruts = rawDice + modDom + combatModeBonus
```

**Batch GM — règle :** `toggleSelect` et `selectAll` = libres (tous PNJs ensemble). Filtre `isRanged` uniquement dans `handleStartAttackQueue().filter(isRanged)`. Ne jamais réintroduire le guard à la sélection.

---

### Pièges CaC

**PC-CaC1 — `COMBAT_CONTACT` n'existe pas dans `ref_skills`.**
Skill mains nues = `COMBAT_A_MAINS_NUES` (FOR/COO). Skill armes de contact = `COMBAT_ARME` (FOR/COO).
→ Si `refSkill = null`, `skillTotal = 0`, jamais de touche. Toujours vérifier l'existence du skill en DB.

**PC-CaC2 — `range` pour 'Arme de contact' = allonge, pas portée de tir.**
Lance (range=3) → peut attaquer à 3+3=6m. Couteau (range=null) → portée de base 3m.
Les armes à distance ont range en format `"10/50/100/200 (300)"` — le filtre `category='Arme de contact'` suffit.

**PC-CaC3 — Slot bloqué jusqu'à COMBAT_MELEE_DEFENSE_CONFIRM (défenseur PJ).**
`needsDefenseWait = true` → `advanceSlot` non appelé dans COMBAT_ACTION_CONFIRM.
`advanceSlot` appelé depuis COMBAT_MELEE_DEFENSE_CONFIRM uniquement.
Perte du pending (restart serveur) → slot bloqué indéfiniment — à gérer en V2.

**PC-CaC4 — `pendingMeleeDefense` keyed par `defenderTokenId` (pas attaquant).**
COMBAT_MELEE_DEFENSE_CONFIRM payload = `{ tokenId: defenderTokenId }`.

**PC-CaC5 — COMBAT_DECLARE_ERROR + `return` si hors portée (Phase 2).**
Émis depuis `resolveMeleeAction` si dist2d > 3+allonge à la résolution. Ne pas bloquer en Phase 1.

**PC-CaC6 — Distance melee validée Phase 2 uniquement (post-déplacement).**
`resolveMeleeAction` fetch les positions DB APRÈS que le `move_short` de la même boucle `COMBAT_ACTION_CONFIRM` a mis à jour les coordonnées. Phase 1 = intention libre, aucune validation.

**PC-CaC7 — Seuil Charge = 3m fixe (pas 3+allonge).**
"Engagé au contact" = ≤ 3m (LdB). L'allonge étend la portée d'attaque mais pas le seuil d'engagement. Guard Charge en Phase 2 : `dist2d > 3` (pas `> 3+allonge`).

**PC-CaC8 — Batch GM : type guard à la sélection = supprimé.**
`toggleSelect` et `selectAll` = libres. `handleStartAttackQueue` filtre `targetIds.filter(isRanged)`. Ne jamais réintroduire le guard dans toggleSelect/selectAll.

---

### Multi-adversaires — Sprint CaC 4a (session 72)

**Règle LdB p.224 :** un personnage confronté à plusieurs adversaires simultanés en CaC subit un malus à ses Tests d'opposition (attaque ET défense).

| Adversaires distincts | Malus |
|---|---|
| 2 | −5 |
| 3 | −7 |
| 4+ | −10 |

**Critère "confronté" :** tout token ennemi actif dans le roster dont la distance PE14 (positions post-déplacement) est ≤ `3 + allonge_max_de_l_adversaire`. L'allonge est celle de l'arme de contact équipée (slot MG/MD/2M, category='Arme de contact'). Si l'adversaire n'a pas d'arme de contact équipée, allonge = 0 → portée de base 3m.

**Implémentation :**
- Helper module-level `countAdversaires(tokenPos, rosterTokens, excludeId, enemyType)` — filtrage JS sur les données pré-fetchées.
- `rosterTokens` : requête unique dans le `Promise.all` de `resolveMeleeAction` (jointure `tokens → combat_roster → characters → char_inventory → ref_equipment`), groupée par token, avec `MAX(range::INTEGER)` comme allonge.
- `multiMalusAttaquant` appliqué à `chancesAttaque`.
- `multiMalusDefenseur` appliqué à `chanceDefense` dans les deux paths (PNJ auto-résolu + PJ via `commonPending → COMBAT_MELEE_DEFENSE_CONFIRM`).

**Choix V1 documenté :**
- `PNJ = ennemi du PJ`, `PJ = ennemi du PNJ` — proxy sur `character.type`.
- **Limitation** : un PNJ allié du groupe n'est pas distingué des PNJ ennemis → comptabilisé à tort comme adversaire du PJ. Cas rare en pratique (parties privées 4–8 joueurs sans PNJ alliés en roster). Résolution future : colonne `combat_roster.side` (non implémentée).

**Ne pas confondre avec PC-CaC7 :** le seuil d'engagement Charge reste 3m fixe. Le `3 + allonge` ici concerne uniquement le comptage des adversaires pour le malus, pas la validation de la Charge.

### Nouveaux events WS (session 67)

| Event | Direction | Description |
|---|---|---|
| `COMBAT_MELEE_DEFENSE_PROMPT` | serveur → socket défenseur PJ | Invite à lancer la défense |
| `COMBAT_MELEE_DEFENSE_CONFIRM` | défenseur PJ → serveur | Déclenche roll D20 serveur + résolution |
| `COMBAT_MELEE_RESULT` | serveur → room | Jets opposition + outcome (hit/esquive) |
| `COMBAT_DECLARE_ERROR` | serveur → socket | Validation déclaration échouée (hors portée, etc.) |

---

## COMBAT_ACTION_DECLARE — payload v2

⚠️ **Payload v2 (sprint Panel Joueur).** Payload v1 (`selectedKeys`) supprimé — pas de rétrocompat.

```javascript
socket.emit(WS.COMBAT_ACTION_DECLARE, {
  tokenId,        // token déclarant
  state: {
    position:  'standing'|'crouching'|'prone',
    weapon:    'holstered'|'ready'|'drawn',
    fire_mode: 'cc'|'rc'|'rl',
    cover:     'exposed'|'partial'|'important',
    vitesse:   'normal'|'delayed'|'rushed',
  },
  mapActions: {
    move:     { targetPosX, targetPosY, targetPosZ, ini_mod, action_key } | null,  // coords PE14
    attack:   {
      weaponInvId,         // char_inventory.id de l'arme (slot MG ou MD)
      targetTokenId,       // token cible
      bulletCount,         // nombre de balles (CC/RC/RL)
      fireModeBonusComp,   // bonus Compétence (calculé client — recalculé serveur)
      fireModeBonusDmg,    // bonus Dommages (calculé client — recalculé serveur)
      isDualWield,         // bool
      dualWieldBonusComp,  // bonus Comp dual wield (calculé client)
      cover_shot,          // bool — tirer depuis sa couverture (conditionnel : cover != 'exposed')
    } | null,
    melee:    bool,  // corps à corps (-3 INI serveur)
    multi:    bool,  // attaque multiple (-5 INI serveur) — V2
    interact: bool,  // interagir (pas de target_entity_id ce sprint — implémenté sprint suivant)
  },
  quick: {
    observer: number,  // tranches 0–6 (0 = non sélectionné)
    reperer:  number,  // tranches 0–6
    phrase:   bool,
  }
})
```

**Calcul INI serveur (recalcul strict) :**
```
iniDelta = transitionCost(state_position) + transitionCost(state_weapon)
         + transitionCost(state_fire_mode)
         + (state_vitesse === 'rushed' ? +3 : 0)
         + (mapActions.move ? ini_mod : 0)
         + (mapActions.melee ? -3 : 0)
         + (mapActions.multi ? -5 : 0)
         + (mapActions.attack?.cover_shot ? (cover==='partial' ? -3 : -5) : 0)
         + quick.observer * -5
         + quick.reperer * -5
         + (quick.phrase ? -3 : 0)
```
Le client affiche un breakdown INI indicatif — le serveur recalcule strictement, jamais trusted.

**PC28 :** les valeurs `state.*` du payload = nouvelles valeurs demandées (état cible). Le serveur UPDATE `combat_roster` avec ces valeurs + calcule l'iniDelta depuis les valeurs précédentes en DB.

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

Les couleurs et coûts d'initiative proviennent du registre partagé `shared/combatMovement.js`.
L'aperçu demande au serveur le chemin correspondant au budget calculé depuis la fiche ; un rayon
client ou une distance à vol d'oiseau n'est plus une autorité de déplacement.

## Autorité spatiale du combat — Moteur Monde Phase 7

- à la déclaration, le client choisit une destination, pas une position finale garantie ni une
  allure faisant foi ;
- le serveur planifie avec le coût réel des supports, escaliers, échelles et effets, puis choisit
  l'allure minimale suffisante autorisée pour le personnage ;
- `combat_actions` conserve `destination_world`, `world_plan`, `movement_gait`, les révisions monde
  et runtime planifiées et le budget en mètres ;
- à la résolution, le serveur réconcilie l'ascenseur, recompile/replanifie sous verrou et persiste le
  dernier point réellement atteignable. Un token peut donc finir son tour au milieu d'un parcours
  vertical ;
- contact, charge, adversaires proches, interactions et portées utilisent les mêmes positions
  canoniques et une distance 3D en mètres ;
- LOS et couverture sont fournies par `worldVisibilityService`, après le déplacement effectivement
  résolu ;
- `shared/combatRange.js` lit la portée de l'arme et en déduit la bande de portée. Une cible hors de
  la dernière bande est refusée ;
- les régions du monde portant un hook `traverse/test/balance` appliquent automatiquement la règle
  de terrain instable. L'option manuelle reste un override MJ ou un filet pour les effets
  personnalisés.

Les migrations 156 et 157 assument volontairement le nouveau contrat. Les anciens déplacements en
attente sont invalidés et les anciennes portées d'interaction sont converties en mètres ; aucune
rétrocompatibilité de carte n'est promise.

### Actions inactives (SECTIONS — non implémentées)
`active: false` → grayed out, non cliquable dans CombatActionWindow :
- `micro_delay` — Retarder son action (V2)
- `multi_attack` — Placeholder initial, désormais **dead** pour melee (remplacé par le count selector dans le panel melee, Sprint CaC 4b). À réutiliser pour le Sprint Tir Multi (attaques multiples de tir contre cibles différentes, LdB p.218).
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

`confirmedModifiers.portee` est conservé dans le payload d'interface historique, mais est ignoré
par la résolution serveur. La bande appliquée aux chances et aux dégâts est recalculée depuis la
distance 3D réelle et `ref_equipment.range`. Les sélections situationnelles et de taille restent
des confirmations métier distinctes.

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
degatsNets = max(0, degautsBruts - etq + rd)
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
