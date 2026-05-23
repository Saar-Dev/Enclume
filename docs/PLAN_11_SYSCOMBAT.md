# Chantier 11 — Système de Combat Polaris
> Document de planification — Session 51 / Mis à jour Session 56
> Statut : Prêt à coder — Sprint 1
> Dépendances : Chantier 10 sprints 1–5 ✅ (WeaponPanel, char_inventory slots MG/MD, calcResistanceArmure)

---

## 1. Périmètre V1

**Inclus :**
- Combat à distance (table localisation distance)
- Actions : Assaut, Déplacement court (≤3m), Déplacement long (>3m), Micro-actions
- 1 action principale par tour par combattant (+ micro-actions cumulables)
- PNJ identifiés par `token.character_id → characters.user_id = GM`
- Aucune validation portée/ligne de vue en phase Annonce — tout reporté en Résolution

**Reporté V2/V3 :**
- Retarder son action → affiché grisé en V1
- Combat au contact (table localisation contact distincte)
- Attaques multiples (slots Init / Init-5 / Init-10)
- Tir de suppression
- Timeline animée complète

---

## 2. Décisions d'architecture validées

| Sujet | Décision |
|---|---|
| Mode combat | Troisième valeur de `mode` dans `SessionPage` — `'play'` / `'edit'` / `'combat'` |
| Canvas | Inchangé en mode combat — pas de démontage (bypass `setCanvasVisible`) |
| UI combat | Composant `CombatOverlay.jsx` en `position:fixed`, z-index dédié au-dessus de tout |
| Fenêtres combat | Pattern fenêtres flottantes existant — dans `CombatOverlay`, jamais dans Three.js |
| Timeline | Composant `CombatTimeline.jsx` séparé, monté au-dessus du Canvas, pas à la place de la gmBar |
| gmBar | Inchangée en mode combat — boutons carte toujours accessibles |
| GM dans le roster | Non — le GM incarne chaque PNJ, il n'est pas un participant |
| PNJ UI | Tableau GM : une ligne par PNJ, colonnes = actions (cases à cocher). Pas de fenêtre fancy |
| Un seul combat actif | `campaign_id` PK sur `combat_state` — contrainte SQL forte |
| Égalité initiative | `Math.random()` au tri — invisible, conforme à la règle de simultanéité LdB |
| GM valide en dernier | Sur tous les modificateurs de jet — sans exception |
| Collision déplacement | Réutilise `isCaseOccupied` Redis — pas de nouvelle infrastructure |
| Slot delayed | Grisé en V1 — reporté V2/V3 |
| surprise_roll | Stocké dans `combat_roster` — visible GM uniquement |
| Reset combat | `COMBAT_END` = seul mécanisme. Crash serveur → GM relance, INSERT écrase l'orphelin |
| State combat client | `combatStore` Zustand dédié — pas de props drilling depuis `SessionPage` |
| Calculs serveur | `parseDice`, `calcREA`, `calcWoundPenalty`, `calcEncumbrancePenalty`, `calcResistanceDommages`, `calcResistanceArmure` ✅, `calcCarenceArmure` ✅ — tous dans `charStats.js` |
| **Architecture réseau** | **WS pur — pas de REST pour le combat. Pattern identique aux entités interactables** |
| **Actions déclarées** | **Table `combat_actions` séparée — une ligne par `action_key` sélectionnée** |
| **Exclusivité actions** | **Aucune validation en phase Annonce — cibles et positions mémorisées, GM arbitre en Résolution (LdB p.218)** |
| **États personnage** | **`state_position` + `state_weapon` dans `combat_roster` — persistants entre les tours. action_key = déclencheur, pas stockage.** |
| **target_pos** | **Colonnes INT séparées (target_pos_x/y/z) — type-safe, coords DB PE14. Client convertit avant envoi.** |
| **sequence intra-slot** | **SMALLINT dans combat_actions — ordre garanti : move_* → micro → assault** |
| **weapon_inv_id** | **ID char_inventory réel — arme équipée slot MG ou MD. Guard serveur : slot doit être MG ou MD** |

---

## 3. Schéma SQL (migration 54)

```sql
-- État global du combat — 1 ligne max par campagne
combat_state
  campaign_id       UUID  PK FK → campaigns.id ON DELETE CASCADE
  battlemap_id      UUID  FK → battlemaps.id
  phase             TEXT  CHECK IN ('ROSTER','ANNOUNCEMENT','RESOLUTION')
  current_turn      INT   DEFAULT 1
  active_slot_idx   INT   DEFAULT 0
  action_timer_sec  INT   DEFAULT 0   -- 0 = infini
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ

-- Participants au combat
combat_roster
  id               UUID  PK DEFAULT gen_random_uuid()
  campaign_id      UUID  FK → campaigns.id ON DELETE CASCADE
  token_id         UUID  FK → tokens.id ON DELETE CASCADE
  is_surprised     BOOLEAN DEFAULT false
  surprise_roll    INT    NULLABLE  -- résultat dé, visible GM uniquement (PC25)
  base_ini         INT              -- REA calculé au COMBAT_START, figé
  initiative       INT              -- base_ini ± modificateurs déclarés
  status           TEXT  CHECK IN ('active','done')  -- 'delayed' reporté V2
  has_announced    BOOLEAN DEFAULT false
  has_resolved     BOOLEAN DEFAULT false
  state_position   TEXT    NOT NULL DEFAULT 'standing'
                     CHECK (state_position IN ('standing','crouching','prone'))
  state_weapon     TEXT    NOT NULL DEFAULT 'holstered'
                     CHECK (state_weapon IN ('holstered','ready','drawn'))
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

-- Actions déclarées — une ligne par action_key sélectionnée
combat_actions
  id               UUID      PK DEFAULT gen_random_uuid()
  campaign_id      UUID      FK → campaigns.id ON DELETE CASCADE
  token_id         UUID      FK → tokens.id ON DELETE CASCADE
  type             TEXT      CHECK IN ('assault','move_short','move_long','micro','skip')  -- catégorie pour branchement handler
  action_key       TEXT      NOT NULL  -- clé exacte : 'rushed', 'micro_draw', 'move_short', 'assault', etc.
  sequence         SMALLINT  NOT NULL  -- ordre d'exécution intra-slot (1, 2, 3…)
  target_token_id  UUID      NULLABLE  -- assault uniquement
  target_pos_x     INT       NULLABLE  -- move_short/move_long — coords DB (PE14)
  target_pos_y     INT       NULLABLE  -- coords DB (PE14) : profondeur (= Z Three.js)
  target_pos_z     INT       NULLABLE  -- coords DB (PE14) : altitude  (= Y Three.js)
  weapon_inv_id    UUID      NULLABLE  -- FK → char_inventory.id SET NULL (assault)
  modifiers        JSONB     NOT NULL DEFAULT '{}'  -- { ini_mod: int } V1 — fire_mode/bullet_count Sprint 4
  status           TEXT      CHECK IN ('pending','resolved','skipped') DEFAULT 'pending'
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ
```

⚠️ `weapon_inv_id` : `ON DELETE SET NULL` — si item supprimé en cours de combat, action reste sans arme. Guard serveur obligatoire avant calcul dégâts.

---

## 4. Schéma des actions déclarées (`combat_actions`)

**Types d'actions :**
| Type | Description | Exclusif | Modificateur d'Initiative |
|---|---|---|---|
| `assault` | Attaque sur une cible (`target_token_id` + `weapon_inv_id`) | Non | 0 |
| `move_short` | Déplacement ≤3m (`target_pos_x/y/z`) | Non | -3 |
| `move_long` | Déplacement >3m (`target_pos_x/y/z`) | Oui (GM arbitre) | 0 |
| `micro` | Toute action sans effet résolution V1 — inclut `rushed` | Non | variable (KEY_MOD) |
| `skip` | Tour passé par GM | — | — |

**Champ `modifiers` JSONB (V1) :**
```json
{ "ini_mod": -3 }
```
Sprint 4 : `fire_mode` et `bullet_count` ajoutés sur la ligne assault uniquement.

**Règles :**
- `is_rushed` : ligne distincte (`action_key='rushed'`, `type='micro'`) — +3 INI à l'annonce, -5 Mod Compétence à la résolution assault. Détection : `SELECT 1 FROM combat_actions WHERE token_id=X AND action_key='rushed'`
- `sequence` : détermine l'ordre d'exécution intra-slot. Attribué côté serveur à l'INSERT : move_* en premier, micro ensuite, assault en dernier
- Modificateurs GM (portée, taille, obscurité, couverture) : arrivent en phase Résolution via `COMBAT_ACTION_CONFIRM`
- Aucune validation en Annonce — cibles et positions mémorisées, GM arbitre en Résolution

**Micro-actions (aide décision joueur, pas contrainte technique) :**
| Action | Modificateur d'Initiative |
|---|---|
| Dégainer une arme | -3 |
| Saisir un objet à portée | -3 |
| Prononcer une phrase courte | -3 |
| Saisir un objet à quelques pas | -5 à -10 |

---

## 5. Events WS — famille COMBAT_* (shared/events.js)

```js
// Démarrage / arrêt
COMBAT_START:          'combat:start'           // joueur → serveur (GM only)
COMBAT_STARTED:        'combat:started'         // io.to(room) — roster complet + phase
COMBAT_END:            'combat:end'             // joueur → serveur (GM only)
COMBAT_ENDED:          'combat:ended'           // io.to(room) — reset client

// Sync reconnexion
COMBAT_STATE_SYNC:     'combat:state_sync'      // socket.emit — joueur qui rejoint en cours

// Roster
COMBAT_ROSTER_UPDATED: 'combat:roster_updated'  // io.to(room)

// Phases
COMBAT_PHASE_CHANGED:  'combat:phase_changed'   // io.to(room) — nouvelle phase + données
COMBAT_SLOT_ADVANCED:  'combat:slot_advanced'   // io.to(room) — index slot courant + tokenId actif

// Surprise
COMBAT_SURPRISE_ROLL:  'combat:surprise_roll'   // socket.emit → joueur surpris uniquement
COMBAT_SURPRISE_RESULT:'combat:surprise_result' // joueur → serveur

// Annonce
COMBAT_ACTION_DECLARE: 'combat:action_declare'  // joueur → serveur
COMBAT_ACTION_DECLARED:'combat:action_declared' // io.to(room)
COMBAT_SKIP_PLAYER:    'combat:skip_player'     // GM → serveur
COMBAT_TURN_SKIPPED:   'combat:turn_skipped'    // io.to(room) — chat "tour de X passé"

// Résolution
COMBAT_ACTION_WINDOW:  'combat:action_window'   // socket.emit → joueur actif uniquement
COMBAT_ACTION_CONFIRM: 'combat:action_confirm'  // joueur + GM → serveur
COMBAT_ATTACK_RESULT:  'combat:attack_result'   // io.to(room) — résumé dégâts

// V2/V3 réservés :
// COMBAT_ACTION_DELAY, COMBAT_ACTION_ACTIVATE
```

---

## 6. Découpage en sprints

---

### Sprint 1 — Fondations + COMBAT_START/END

**Objectif :** GM peut démarrer un combat, roster constitué en DB, GM peut terminer le combat. CombatOverlay visible mais vide. Aucune phase jouable.

**Fichiers à lire AVANT de toucher quoi que ce soit :**
- `server/src/socket/index.js` — structure complète, pendingEntityActions pattern, imports
- `shared/events.js` — état actuel (aucun COMBAT_* existant)
- `server/src/lib/charStats.js` — calcREA, calcAttributeNA
- `client/src/pages/SessionPage.jsx` — handleModeChange, canvasVisible, mode state
- Un store Zustand existant (`client/src/stores/tokenStore.js`) — pattern

**Fichiers créés :**
- `server/src/db/migrations/54_combat.js` — tables combat_state + combat_roster + combat_actions
- `shared/events.js` additions — 19 constantes COMBAT_*
- `client/src/stores/combatStore.js`
- `client/src/components/CombatOverlay.jsx` — shell position:fixed
- `client/src/components/CombatRosterWindow.jsx` — liste tokens GM

**Fichiers modifiés :**
- `server/src/socket/index.js` — combatTimers Map + handlers COMBAT_START, COMBAT_END + SESSION_JOIN update
- `client/src/pages/SessionPage.jsx` — mode 'combat', bypass canvasVisible, COMBAT_STARTED/ENDED

**Handler `COMBAT_START` (GM only) :**
- Guard : `socket.data.role !== 'gm'` → ignore silencieux
- Guard : SELECT tokens WHERE battlemap_id → si 0 → `socket.emit('error', { message: 'Aucun personnage sur la carte' })`
- Guard : SELECT combat_state WHERE campaign_id → si existant → message "Combat déjà en cours"
- Pour chaque token : SELECT char_attributes + char_archetype (via char_sheet) → `calcAttributeNA(attrs, 'ADA', geno)` + `calcAttributeNA(attrs, 'PER', geno)` → `calcREA(ada_na, per_na)`
- Fallback `base_ini = 0` si char_sheet introuvable — log warning (PC21)
- Tri JS : `roster.sort((a,b) => b.base_ini - a.base_ini || Math.random() - 0.5)`
- Tokens surpris depuis payload `surprisedTokenIds[]` — GM les coche dans CombatRosterWindow avant démarrage
- INSERT `combat_state` (phase:'ROSTER', current_turn:1, active_slot_idx:0, action_timer_sec:0)
- INSERT bulk `combat_roster`
- PNJ surpris → jet auto 1d20, `surprise_roll` enregistré, initiative calculée directement
- Joueurs surpris → `socket.emit(WS.COMBAT_SURPRISE_ROLL)` via fetchSockets (PC12)
- `io.to(room).emit(WS.COMBAT_STARTED, { roster, phase: 'ROSTER' })`
- ⚠️ (PC25) : `surprise_roll` ABSENT du payload COMBAT_STARTED

**Handler `COMBAT_END` (GM only) :**
- Guard : `socket.data.role !== 'gm'`
- (PC19) `clearTimeout` tous timers `combatTimers.get(campaignId)` AVANT delete
- DELETE `combat_actions WHERE campaign_id`
- DELETE `combat_roster WHERE campaign_id`
- DELETE `combat_state WHERE campaign_id`
- `io.to(room).emit(WS.COMBAT_ENDED)`

**SESSION_JOIN (ajout) :**
- Après join existant : SELECT combat_state WHERE campaign_id
- Si actif : SELECT combat_roster + combat_actions → `socket.emit(WS.COMBAT_STATE_SYNC, { combatState, roster, actions })`
- (PC14) : si combat_state null → ne pas émettre

**`combatTimers` Map :**
- Déclarée hors `initSocket` — singleton (PC16)
- `const combatTimers = new Map()` // clé = campaignId, valeur = Map(tokenId → timeoutId)
- Sprint 1 : déclarée uniquement, logique timer en Sprint 2

**combatStore.js :**
```js
{
  phase: null,         // 'ROSTER'|'ANNOUNCEMENT'|'RESOLUTION'|null
  roster: [],          // [{ tokenId, baseIni, initiative, status, hasAnnounced, hasResolved, isSurprised }]
  actions: [],         // [{ id, tokenId, type, initiativeScore, status, ... }]
  currentTurn: 1,
  activeSlotIdx: 0,
  setCombatState,      // depuis COMBAT_STARTED ou COMBAT_STATE_SYNC
  updateRoster,        // depuis COMBAT_ROSTER_UPDATED
  addAction,           // depuis COMBAT_ACTION_DECLARED
  advanceSlot,         // depuis COMBAT_SLOT_ADVANCED
  resetCombat,         // depuis COMBAT_ENDED
}
```

**CombatOverlay.jsx :**
- `position:fixed, inset:0, pointerEvents:'none'` sauf enfants avec `pointerEvents:'auto'`
- z-index > Canvas3D (ex: 1000), < modales erreur
- Visible uniquement si `combatStore.phase !== null`

**CombatRosterWindow.jsx :**
- Fenêtre flottante GM (pattern existant)
- Affiche : nom token, base_ini, is_surprised checkbox
- Bouton "Démarrer le combat" → `socket.emit(WS.COMBAT_START, { battlemap_id, surprisedTokenIds })`
- Sprint 1 : pas encore de bouton "Phase Annonce" (Sprint 2)

**SessionPage.jsx — modifications :**
- `handleModeChange` : si `newMode === 'combat'` ou `mode === 'combat'` → skip `setCanvasVisible(false)` (PC15)
- Handler `COMBAT_STARTED` → `setMode('combat')` + `combatStore.setCombatState(payload)`
- Handler `COMBAT_ENDED` → `setMode('play')` + `combatStore.resetCombat()`

**Validation Sprint 1 :**
- ✅ Migration 54 appliquée sans erreur
- ✅ `shared/events.js` compile client + serveur
- ✅ GM clique "⚔ Combat" → mode combat → CombatOverlay visible
- ✅ DB : `combat_state` + `combat_roster` insérés, base_ini correct
- ✅ GM "Terminer" → tables nettoyées → mode play
- ✅ Joueur rejoint mid-combat → COMBAT_STATE_SYNC → store initialisé

---

### Sprint 2 — Surprise + Phase Annonce

**Objectif :** Joueurs déclarent leurs actions. Surprise gérée. CombatTimeline visible. Auto-transition vers Résolution.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — état après Sprint 1
- `client/src/stores/combatStore.js` — état après Sprint 1
- `client/src/pages/SessionPage.jsx` — état après Sprint 1

**Fichiers créés :**
- `client/src/components/CombatTimeline.jsx`
- `client/src/components/CombatActionWindow.jsx` — mode Annonce
- `client/src/components/CombatPnjPanel.jsx`

**Fichiers modifiés :**
- `server/src/socket/index.js` — COMBAT_SURPRISE_RESULT, COMBAT_ACTION_DECLARE, COMBAT_SKIP_PLAYER, timer, `startResolutionPhase()` stub
- `client/src/pages/SessionPage.jsx` — COMBAT_PHASE_CHANGED, COMBAT_ROSTER_UPDATED, COMBAT_SURPRISE_ROLL, COMBAT_ACTION_DECLARED, COMBAT_TURN_SKIPPED

**Handler `COMBAT_SURPRISE_RESULT` :**
- Payload : `{ tokenId, roll }` (1d20 lancé côté client)
- Guard : rosterEntry.is_surprised = true
- `initiative = roll + base_ini`
- UPDATE combat_roster SET initiative, surprise_roll
- (PC25) Broadcast `COMBAT_ROSTER_UPDATED` → roster SANS champ `surprise_roll` pour non-GM
  - Pattern : SELECT roster → mapper, retirer `surprise_roll` du payload broadcast sauf si socket.data.role === 'gm'

**Handler `COMBAT_ACTION_DECLARE` :**
- Payload : `{ tokenId, actions: [{ type, action_key, sequence, modifiers: { ini_mod }, targetTokenId, targetPosX, targetPosY, targetPosZ, weaponInvId }] }`
- Guard ownership : `token.character_id → characters.user_id === socket.user.id`
- Guard : phase === 'ANNOUNCEMENT'
- Guard weapon_inv_id : si type === 'assault' et weaponInvId → vérifier slot = 'MG' ou 'MD' (PC22)
- Guard target_pos : si type IN ('move_short','move_long') → target_pos_x/y/z NOT NULL, parseInt obligatoire (PC33)
- Si `actions.some(a => a.action_key === 'rushed')` : UPDATE `combat_roster SET initiative = initiative + 3` → re-tri → `COMBAT_ROSTER_UPDATED`
- INSERT bulk `combat_actions`
- UPDATE `combat_roster SET has_announced = true`
- (PC13) Détection "tous announced" : `COUNT(*) FROM combat_roster WHERE campaign_id AND has_announced = false AND status = 'active'` — si 0 → `startResolutionPhase()`
- Sinon : `io.to(room).emit(WS.COMBAT_ACTION_DECLARED, { tokenId, actions })`
- Timer : si action_timer_sec > 0 → clearTimeout du joueur suivant dans la liste + nouveau setTimeout

**Handler `COMBAT_SKIP_PLAYER` (GM) :**
- Guard : `socket.data.role !== 'gm'`
- INSERT `combat_actions { type: 'skip', initiative_score: rosterEntry.initiative }`
- UPDATE `combat_roster SET has_announced = true`
- Même check "tous announced"
- `io.to(room).emit(WS.COMBAT_TURN_SKIPPED, { tokenId })` → message chat

**Timer auto-skip :**
- (PC17) Guard : `if (action_timer_sec === 0) return` — jamais setTimeout(fn, 0)
- Map : `combatTimers.get(campaignId)?.set(tokenId, setTimeout(autoSkip, ms))`
- `clearTimeout` sur `COMBAT_ACTION_DECLARE` reçu pour ce joueur

**`startResolutionPhase()` (helper, appelé quand tous announced) :**
- SELECT `combat_actions WHERE campaign_id AND status = 'pending' ORDER BY initiative_score DESC`
- UPDATE `combat_state SET phase = 'RESOLUTION', active_slot_idx = 0`
- `io.to(room).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'RESOLUTION', orderedSlots: [...tokenIds] })`
- emit `WS.COMBAT_ACTION_WINDOW` → socket du joueur au slot 0 (via fetchSockets, PC12)
- Sprint 2 : stub seulement — logique complète en Sprint 3

**CombatTimeline.jsx :**
- Lecture depuis combatStore.roster (trié par initiative DESC)
- Portrait : `portrait_url` → fallback initiales `name[0]` (PC20)
- Token delayed : grisé (V1 = grisé uniquement)
- Tooltip survol : Nom / Initiative / hasAnnounced
- Curseur `activeSlotIdx` : Sprint 3

**CombatActionWindow.jsx — mode Annonce :**
- Affiché si c'est le tour d'annonce du joueur (myTurn = roster[currentIdx].tokenId === myTokenId)
- Actions disponibles :
  - "Assaut" — actif si arme MG ou MD équipée dans char_inventory
  - "Déplacement court ≤3m" — Modificateur d'Initiative -3
  - "Déplacement long >3m" — Modificateur d'Initiative 0
  - Checkbox "Action précipitée" — +3 Modificateur d'Initiative, -5 Modificateur de Compétence en Résolution
  - Micro-actions : Dégainer (-3), Saisir (-3), Parler (-3)
  - "Retarder" — grisé, tooltip "V2"
- Émet `WS.COMBAT_ACTION_DECLARE` à validation

**CombatPnjPanel.jsx :**
- Tableau PNJ (tokens dont characters.user_id = GM)
- Colonnes : Nom | Initiative | Action (select) | Micro-actions | "Déclarer"
- GM pas de contrainte de temps

**Validation Sprint 2 :**
- ✅ Joueur surpris reçoit prompt, lance dé, initiative calculée
- ✅ Joueur déclare → COMBAT_ACTION_DECLARED → roster mis à jour
- ✅ is_rushed → +3 initiative → roster re-trié
- ✅ GM skip → message chat
- ✅ Tous announced → auto-transition RESOLUTION (stub OK pour Sprint 2)
- ✅ CombatPnjPanel : GM déclare PNJ
- ✅ Timer auto-skip si action_timer_sec > 0

---

### Sprint 3 — Phase Résolution + Déplacement

**Objectif :** Actions exécutées dans l'ordre d'initiative. Déplacement résolu via Redis. Tour boucle.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — état après Sprint 2
- `server/src/lib/redis.js` — isCaseOccupied, collisionMoveToken
- `client/src/stores/combatStore.js` — état après Sprint 2

**Fichiers créés :** aucun

**Fichiers modifiés :**
- `server/src/socket/index.js` — `startResolutionPhase()` complet, `COMBAT_ACTION_CONFIRM` (déplacement), `endTurn()`
- `client/src/pages/SessionPage.jsx` — COMBAT_SLOT_ADVANCED handler
- `client/src/components/CombatActionWindow.jsx` — mode Résolution
- `client/src/components/CombatTimeline.jsx` — curseur activeSlotIdx

**`startResolutionPhase()` — version complète :**
- SELECT `combat_actions ORDER BY initiative_score DESC` → orderedSlots
- UPDATE `combat_state SET phase = 'RESOLUTION', active_slot_idx = 0`
- Broadcast `COMBAT_PHASE_CHANGED { phase: 'RESOLUTION', orderedSlots }`
- Emit `COMBAT_ACTION_WINDOW { action }` → socket du joueur au slot 0

**Handler `COMBAT_ACTION_CONFIRM` — Sprint 3 (déplacement + micro) :**
- Payload : `{ actionId, confirmedModifiers: {} }`
- Guard : action.type === 'assault' → traitement Sprint 4 (skip silencieux en Sprint 3 — répondre avec skip ou log)
- Type `move_short` / `move_long` : step-by-step Redis
  - Lire `target_pos_x/y/z INT` depuis `combat_actions` (coords DB PE14, déjà convertis à l'annonce)
  - (PE22) excludeIds = [tokenId]
  - (PE29) isCaseOccupied à pos_z + 1 (espace de marche)
  - UPDATE tokens pos + collisionMoveToken
  - Broadcast TOKEN_MOVED
- Type `micro` : résolution directe (action cosmétique en V1)
- UPDATE `combat_actions SET status = 'resolved'`
- UPDATE `combat_roster SET has_resolved = true`
- `advanceSlot()` : active_slot_idx + 1
  - Si slot suivant existe → `COMBAT_SLOT_ADVANCED { activeSlotIdx, tokenId }` + `COMBAT_ACTION_WINDOW` → joueur suivant
  - Si plus de slots → `endTurn()`

**`endTurn()` :**
- (PC18) **UNE SEULE requête** : `UPDATE combat_roster SET has_announced=false, has_resolved=false WHERE campaign_id AND status='active'`
- (PC28) `DELETE FROM combat_actions WHERE campaign_id`
- UPDATE `combat_state SET current_turn = current_turn + 1, active_slot_idx = 0, phase = 'ANNOUNCEMENT'`
- `io.to(room).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'ANNOUNCEMENT', turn: newTurn })`
- Envoyer `COMBAT_ACTION_WINDOW` au premier joueur (ordre initiative croissante = dernier à agir)

**CombatActionWindow.jsx — mode Résolution :**
- Affiche récapitulatif de l'action déclarée
- Bouton "Agir" → émet `WS.COMBAT_ACTION_CONFIRM { actionId, confirmedModifiers: {} }`
- Assaut en Sprint 3 : bouton grisé "Sprint 4 requis" (comportement explicite)

**CombatTimeline.jsx — Sprint 3 :**
- Ajout curseur sur `combatStore.activeSlotIdx`
- Slot résolu : token grisé

**Validation Sprint 3 :**
- ✅ Phase RESOLUTION : slots défilent ORDER BY initiative_score DESC
- ✅ Curseur timeline suit activeSlotIdx
- ✅ Déplacement résolu via Redis (collision testée)
- ✅ Fin de tour → turn + 1 → retour ANNOUNCEMENT
- ✅ PC18 : bulk UPDATE en 1 requête (vérifier avec EXPLAIN si besoin)
- ✅ PC28 : combat_actions DELETE fin de tour (vérifier count avant/après)

---

### Sprint 4 — Jets d'attaque + Dégâts + Blessures + Carence FOR

**Objectif :** Attaques complètes. Blessures enregistrées. Carence FOR appliquée.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — état après Sprint 3
- `server/src/lib/charStats.js` — calcResistanceArmure, calcCarenceArmure, calcResistanceDommages, calcWoundPenalty
- `shared/woundConstants.js` — WOUND_PENALTIES exact (PO1)
- `shared/armorConstants.js` — LOCATION_TO_SLOT (mapping localisation touchée → slotCode)
- `server/src/routes/character/char-sheet.js` — route POST /wounds (pour injection blessure)
- Confirmer LdB seuil jet de Choc tête (PO3) avant de coder cette branche
- Vérifier colonnes portées dans ref_equipment (PO2)

**Fichiers créés :**
- `client/src/components/CombatModifiersWindow.jsx`

**Fichiers modifiés :**
- `server/src/socket/index.js` — `COMBAT_ACTION_CONFIRM` branche assault, calcul dégâts complet
- `client/src/components/CombatActionWindow.jsx` — bouton Assaut actif + CombatModifiersWindow

**Handler `COMBAT_ACTION_CONFIRM` — Sprint 4 (assault) :**
- Guard : action.weapon_inv_id non null (PC22) — si null → skip avec log
- Guard : slot de l'arme = 'MG' ou 'MD'
- Fetch tireur : char_sheet → char_attributes → char_inventory (arme + armures équipées) + char_archetype → genotype
- Fetch cible (target_token_id) : char_sheet → char_attributes → char_inventory (armures équipées)
- Calcul compétence tireur : `calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)`
- Carence : `calcCarenceArmure(tireurEquippedArmor, forNA_tireur)` — appliquée sur le jet du tireur
- Malus état : `calcWoundPenalty(wounds_tireur)` + `calcEncumbrancePenalty(weight, FOR)` → effectiveMalus
- Modificateurs totaux Compétence : portée + situation + taille + is_rushed(-5) + tir_instinctif(-5) + RC/RL − carence
- (PC24) chaque modificateur nommé explicitement dans les logs/résultats
- Jet 1d20 via `parseDice('1d20')` côté serveur
- `chancesDeReussite = skillTotal + totalModComp + effectiveMalus`
- `isSuccess = roll <= chancesDeReussite`
- Si succès :
  - Localisation : jet 1d20 serveur → table distance V1 (section ci-dessous)
  - `calcResistanceArmure(cibleEquippedArmor.filter(slot === locationSlot))` → ETQ / PRT (PC29 : déjà dispo)
  - MR = `roll - chancesDeReussite` → `getModifier(mrTable, mr)` → modDomAttaque (LdB p.209)
  - Dégâts bruts = `ref_degats + modDomAttaque + modDegatsRC_RL`
  - `calcResistanceDommages(for_na_cible, con_na_cible)` → RD
  - Dégâts nets = max(0, dégâts bruts - ETQ - RD)
  - Blessures = `Math.floor(dégâts_nets / 5)`
  - Si blessures > 0 : INSERT dans `character_wounds` via db direct (pattern char-sheet.js)
  - Si localisation tête et dégâts nets > 0 : jet de Choc (seuil PO3 — à confirmer LdB)
  - (P49) promoted check sur chaque blessure créée
- Broadcast `WS.COMBAT_ATTACK_RESULT { tireurId, cibleId, localisation, degautsBruts, degatsNets, blessures, isSuccess, roll, chancesDeReussite }`
- (PC23) RC/RL : vérification compétence "Tir Automatique" côté serveur uniquement

**Localisation V1 — distance (LdB p.228) :**
| Jet | Localisation | slotCode (LOCATION_TO_SLOT) |
|---|---|---|
| 1-2 | Tête | T |
| 3-8 | Corps | C |
| 9-11 | Bras Droit | BD |
| 12-14 | Bras Gauche | BG |
| 15-17 | Jambe Droite | JD |
| 18-20 | Jambe Gauche | JG |

**Terminologie stricte — règle absolue (PC24) :**
| Terme | Définition |
|---|---|
| Modificateur d'Initiative | Affecte l'ordre dans la timeline |
| Modificateur de Compétence | Affecte le jet de réussite |
| Modificateur de Portée | Sous-catégorie de Modificateur de Compétence |
| Modificateur de Dégâts | Affecte les dégâts infligés |

**Modificateurs de Portée (LdB p.228) :**
| Palier | Modificateur de Compétence |
|---|---|
| Bout portant | +5 |
| Courte portée | +0 |
| Moyenne portée | -5 |
| Longue portée | -10 |
| Portée extrême | -15 |

**Modificateurs de Situation GM (LdB p.228) :**
| Situation | Mod. Compétence |
|---|---|
| Cible immobile | +3 |
| Cible allure moyenne | -3 |
| Cible allure rapide | -5 |
| Cible allure maximale | -7 |
| Tireur allure lente | -3 |
| Tireur allure moyenne | -5 |
| Tireur allure rapide | -7 |
| Tireur allure maximale | Tir impossible |
| Couverture partielle (50%) | -3 |
| Couverture importante (75%) | -5 |
| Obscurité légère | -3 |
| Obscurité importante | -5 |
| Obscurité totale | Tir impossible |

**Modificateurs de Taille GM (LdB p.228) :**
| Taille | Mod. Compétence |
|---|---|
| Minuscule (~30 cm) | -10 |
| Très petite (~50 cm) | -5 |
| Petite (~1 m) | -3 |
| Moyenne (humaine) | +0 |
| Grande (~3 m) | +3 |
| Très grande (~5 m) | +5 |
| Énorme (~7 m) | +10 |
| Gigantesque (10 m+) | +15 |

**CombatModifiersWindow.jsx :**
- Affiché simultanément joueur actif + GM
- Section joueur : récapitulatif is_rushed (lecture), checkbox Tir instinctif, Mode RC/RL (si arme compatible)
- Section GM : Modificateur de Portée (select paliers), Situation (multi-select), Taille cible (select)
- Bouton "Valider" côté GM → émet `WS.COMBAT_ACTION_CONFIRM { actionId, confirmedModifiers: { portee, situation, taille, tirInstinctif, fireMode } }`

**Affichage carence FOR :**
- Dans `CombatModifiersWindow` : afficher carence tireur si > 0 (rouge)
- forNA disponible dans ce contexte (char_attributes chargés pour le jet)
- Distinct de l'affichage dans ArmorWoundPanel (reporté Chantier 11 sprint 3 = ce sprint 4)

**Validation Sprint 4 :**
- ✅ Jet d'attaque résolu (succès/échec, roll affiché)
- ✅ Localisation tirée au sort côté serveur
- ✅ Dégâts nets calculés (mille-feuille + RD)
- ✅ Blessure enregistrée en DB si dégâts nets ≥ 5
- ✅ COMBAT_ATTACK_RESULT broadcast → résumé visible dans CombatOverlay
- ✅ Carence FOR > 0 → malus appliqué sur jet
- ✅ RC/RL modificateurs appliqués + Tir Automatique vérifié serveur (PC23)
- ✅ Tête : jet de Choc si seuil dépassé (PO3 confirmé LdB)

---

## 7. Points ouverts — à résoudre avant le sprint concerné

| # | Question | Sprint | Statut |
|---|---|---|---|
| PO1 | `WOUND_PENALTIES` — valeurs exactes dans `woundConstants.js` ? | 4 | À vérifier avant Sprint 4 |
| PO2 | Colonnes portées exactes dans `ref_equipment` | 4 | À confirmer BDD avant Sprint 4 |
| PO3 | Seuil jet de Choc tête — valeur LdB exacte ? | 4 | À confirmer LdB avant Sprint 4 |
| PO4 | Re-tri roster si `is_rushed` ? | 2 | ✅ Résolu : oui, re-tri + COMBAT_ROSTER_UPDATED |
| ~~PO5~~ | ~~weapon_inv_id V1~~ | — | ✅ Clôturé : Option B — ID char_inventory réel (MG ou MD) |
| PO6 | combatStore init reconnect mid-combat | 1 | ✅ Résolu : SESSION_JOIN → COMBAT_STATE_SYNC |
| ~~PO7~~ | ~~REST vs WS~~ | — | ✅ Clôturé : WS pur |
| ~~PO8~~ | ~~JSONB vs table~~ | — | ✅ Clôturé : table `combat_actions` |
| ~~PO9~~ | ~~Exclusivité micro-actions~~ | — | ✅ Clôturé : arbitrage GM Résolution |

---

## 8. Pièges anticipés

| Code | Description |
|---|---|
| PC11 | `campaign_id` PK sur `combat_state` — doublon → erreur SQL explicite |
| PC12 | `socket.data.role` pour cibler GM via `fetchSockets()` — pattern PE2 |
| PC13 | "Tous announced" : COUNT WHERE has_announced=false AND status='active' — inclure skippés |
| PC14 | Reconnexion mid-combat : COMBAT_STATE_SYNC dans SESSION_JOIN si combat_state existe |
| PC15 | `handleModeChange` : bypass `setCanvasVisible(false)` si mode combat |
| PC16 | `combatTimers` Map déclarée hors `initSocket` — singleton pattern pendingEntityActions |
| PC17 | Timer 0 = infini : guard `if (action_timer_sec === 0) return` — jamais setTimeout(fn, 0) |
| PC18 | Fin de tour : UNE SEULE requête UPDATE combat_roster — pas de boucle (race condition) |
| PC19 | COMBAT_END : clearTimeout AVANT DELETE |
| PC20 | `portrait_url` nullable : fallback initiales dans CombatTimeline |
| PC21 | calcREA : always via calcAttributeNA(attrs, 'ADA', geno) + idem PER |
| PC22 | weapon_inv_id assault : slot doit être 'MG' ou 'MD' — bouton grisé si aucune arme en main |
| PC23 | RC/RL : check compétence "Tir Automatique" côté serveur uniquement |
| PC24 | Terminologie : jamais "Modificateur" seul — toujours préciser Initiative / Compétence / Portée / Dégâts |
| PC25 | `surprise_roll` : jamais dans un broadcast room — GM uniquement |
| PC26 | Modificateurs de Portée → Modificateur de Compétence uniquement (pas dégâts, sauf RC/RL explicite) |
| PC27 | Phase Résolution : ORDER BY combat_roster.initiative DESC — jamais tri client, jamais initiative_score dénormalisé dans combat_actions |
| PC28 | combat_actions : DELETE WHERE campaign_id en fin de tour — jamais accumulation |
| PC29 | calcResistanceArmure + calcCarenceArmure : déjà dans charStats.js (session 56) — ne pas recréer |
| PC30 | Armure localisation : LOCATION_TO_SLOT depuis armorConstants.js — mapping localisation → slotCode (BG/BD/etc.) |
| PC31 | États personnage (state_position, state_weapon) dans combat_roster — jamais dérivés de combat_actions (table vidée fin de tour). action_key = déclencheur du changement d'état, pas l'état lui-même. |
| PC32 | sequence SMALLINT dans combat_actions — ORDER BY sequence ASC pour exécution intra-slot. Jamais supposer l'ordre d'insertion SQL. Ordre attribué serveur : move_* → micro → assault. |
| PC33 | target_pos_x/y/z : colonnes INT séparées (coords DB PE14). Client convertit Three.js → DB avant envoi. parseInt obligatoire côté serveur au guard. |

---

## 9. Composants React — liste complète

| Composant | Rôle | Sprint |
|---|---|---|
| `CombatOverlay.jsx` | Conteneur fixed z-index, parent de tout | 1 |
| `CombatRosterWindow.jsx` | Fenêtre roster GM, gestion surpris, bouton start | 1 |
| `CombatTimeline.jsx` | Barre tokens par initiative, curseur slot actif | 2 (update Sprint 3) |
| `CombatActionWindow.jsx` | Fenêtre joueur : Annonce + Résolution | 2 (update Sprint 4) |
| `CombatPnjPanel.jsx` | Tableau GM PNJ | 2 |
| `CombatModifiersWindow.jsx` | Bonus/malus GM+joueur avant jet | 4 |

**combatStore — shape complète :**
```js
{
  phase: null,         // 'ROSTER'|'ANNOUNCEMENT'|'RESOLUTION'|null
  roster: [],          // [{ tokenId, baseIni, initiative, status, hasAnnounced, hasResolved, isSurprised }]
  actions: [],         // [{ id, tokenId, type, initiativeScore, status, modifiers, weaponInvId }]
  currentTurn: 1,
  activeSlotIdx: 0,
  setCombatState,
  updateRoster,
  addAction,
  advanceSlot,
  resetCombat,
}
```

---

## 10. Références

| Source | Contenu |
|---|---|
| LdB Polaris p.213-214 | Séquence tour de combat, initiative, surprise |
| LdB Polaris p.209 | Table MR → modificateur (migration 46) |
| LdB Polaris p.218-220 | Actions simples, complexes, micro-actions |
| LdB Polaris p.228 | Modificateurs Portée/Situation/Taille, tables localisation |
| LdB Polaris p.404 | Formule jet, difficulty_dc |
| `charStats.js` | calcREA, calcResistanceDommages, calcWoundPenalty, calcEncumbrancePenalty, calcResistanceArmure ✅, calcCarenceArmure ✅ |
| Migration 46 | `polaris_mr` en base |
| Migration 49 | `character_wounds` |
| `shared/events.js` | Events existants — base pour COMBAT_* |
| `socket/index.js` | Pattern handlers, pendingEntityActions, parseDice |
| `shared/armorConstants.js` | LOCATION_TO_SLOT (session 54) |

---

## 11. Todo liste — par sprint

### Sprint 1 — Fondations + COMBAT_START/END

**Avant de coder (lire en entier) :**
- [ ] `server/src/socket/index.js` — structure, patterns, imports existants
- [ ] `shared/events.js` — état actuel
- [ ] `server/src/lib/charStats.js` — calcREA, calcAttributeNA
- [ ] `client/src/pages/SessionPage.jsx` — handleModeChange, canvasVisible
- [ ] `client/src/stores/tokenStore.js` — pattern Zustand de référence

**Serveur :**
- [ ] Créer `server/src/db/migrations/54_combat.js` — 3 tables (vérifier FK + CHECK)
- [ ] Appliquer migration : `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`
- [ ] Ajouter 19 constantes COMBAT_* dans `shared/events.js`
- [ ] Déclarer `const combatTimers = new Map()` hors `initSocket` (PC16)
- [ ] Implémenter COMBAT_START (tous guards + calcREA + INSERT + COMBAT_STARTED)
- [ ] Implémenter COMBAT_END (PC19 clearTimeout + DELETE + COMBAT_ENDED)
- [ ] Modifier SESSION_JOIN — COMBAT_STATE_SYNC si combat actif (PC14)

**Client :**
- [ ] Créer `client/src/stores/combatStore.js` (shape section 9)
- [ ] Créer `client/src/components/CombatOverlay.jsx` — shell position:fixed
- [ ] Créer `client/src/components/CombatRosterWindow.jsx` — liste + bouton start
- [ ] Modifier `SessionPage.jsx` : mode 'combat' + bypass PC15
- [ ] Handler COMBAT_STARTED → setMode + store
- [ ] Handler COMBAT_ENDED → setMode + reset

**Checkpoints :**
- [ ] SR sans erreur — nodemon clean
- [ ] Migration vérifiée (`\dt` en psql)
- [ ] GM ⚔ → CombatOverlay visible
- [ ] DB combat_state + combat_roster insérés, base_ini correct
- [ ] COMBAT_END → tables vides → mode play
- [ ] Joueur rejoint mid-combat → store initialisé via COMBAT_STATE_SYNC

---

### Sprint 2 — Surprise + Phase Annonce

**Avant de coder :**
- [ ] Lire `socket/index.js` + `combatStore.js` + `SessionPage.jsx` — état après Sprint 1

**Serveur :**
- [ ] COMBAT_SURPRISE_RESULT (PC25 : surprise_roll hors broadcast room)
- [ ] COMBAT_ACTION_DECLARE (ownership + PC13 + PC22 weapon guard + PC33 target_pos parseInt)
- [ ] COMBAT_SKIP_PLAYER (GM guard + INSERT skip + PC13)
- [ ] Timer auto-skip (PC16/PC17)
- [ ] `startResolutionPhase()` stub → COMBAT_PHASE_CHANGED + COMBAT_ACTION_WINDOW slot 0

**Client :**
- [ ] CombatTimeline.jsx (PC20 fallback portrait)
- [ ] CombatActionWindow.jsx mode Annonce (actions + weaponInvId check)
- [ ] CombatPnjPanel.jsx
- [ ] Handlers SessionPage : COMBAT_SURPRISE_ROLL, COMBAT_PHASE_CHANGED, COMBAT_ROSTER_UPDATED, COMBAT_ACTION_DECLARED, COMBAT_TURN_SKIPPED

**Checkpoints :**
- [ ] Surprise : prompt joueur → initiative calculée
- [ ] Déclaration action → timeline update
- [ ] is_rushed → re-tri roster
- [ ] GM skip → chat
- [ ] Tous announced → COMBAT_PHASE_CHANGED RESOLUTION émis

---

### Sprint 3 — Phase Résolution + Déplacement

**Avant de coder :**
- [ ] Lire `socket/index.js` (post-S2) + `redis.js` — isCaseOccupied, collisionMoveToken

**Serveur :**
- [ ] `startResolutionPhase()` complet (SELECT ORDER BY initiative_score DESC)
- [ ] COMBAT_ACTION_CONFIRM déplacement (PE22/PE29 Redis)
- [ ] `advanceSlot()` → COMBAT_SLOT_ADVANCED + COMBAT_ACTION_WINDOW suivant
- [ ] `endTurn()` (PC18 bulk, PC28 DELETE, retour ANNOUNCEMENT)

**Client :**
- [ ] CombatActionWindow mode Résolution (bouton "Agir", assaut grisé)
- [ ] CombatTimeline curseur activeSlotIdx
- [ ] Handler COMBAT_SLOT_ADVANCED

**Checkpoints :**
- [ ] Slots défilent ORDER BY initiative_score DESC
- [ ] Déplacement résolu + collision Redis
- [ ] Fin de tour → turn + 1 → ANNOUNCEMENT
- [ ] PC18 vérifié (1 requête)
- [ ] PC28 vérifié (actions DELETE)

---

### Sprint 4 — Jets d'attaque + Dégâts + Blessures

**Avant de coder :**
- [ ] Lire `charStats.js` entier (calcResistanceArmure, calcCarenceArmure, etc.)
- [ ] Lire `woundConstants.js` — WOUND_PENALTIES exact
- [ ] Lire `armorConstants.js` — LOCATION_TO_SLOT
- [ ] Confirmer LdB seuil jet de Choc (PO3)
- [ ] Vérifier colonnes portées ref_equipment en BDD (PO2)
- [ ] Lire `socket/index.js` post-Sprint 3

**Serveur :**
- [ ] COMBAT_ACTION_CONFIRM branche assault (PC22 guard weapon_inv_id)
- [ ] Fetch complet tireur + cible (attrs, armor, wounds)
- [ ] Calcul chancesDeReussite (compétence + mods + carence + effectiveMalus)
- [ ] Jet 1d20 attaque (parseDice)
- [ ] Localisation 1d20 → table V1 → slotCode via LOCATION_TO_SLOT
- [ ] calcResistanceArmure slot localisation (PC29 : déjà dispo)
- [ ] Dégâts nets (bruts - ETQ - RD)
- [ ] Blessures : Math.floor(nets / 5) → INSERT character_wounds
- [ ] Jet de Choc si tête (PO3)
- [ ] COMBAT_ATTACK_RESULT broadcast
- [ ] RC/RL check Tir Automatique (PC23)

**Client :**
- [ ] CombatModifiersWindow.jsx (Portée + Situation + Taille + RC/RL)
- [ ] CombatActionWindow bouton Assaut actif → ouvre CombatModifiersWindow
- [ ] Affichage COMBAT_ATTACK_RESULT dans CombatOverlay

**Checkpoints :**
- [ ] Attaque bout-en-bout (jet → localisation → dégâts → blessure)
- [ ] COMBAT_ATTACK_RESULT visible room
- [ ] Carence FOR > 0 → malus appliqué
- [ ] Blessure en DB + WOUND_ADDED broadcast
