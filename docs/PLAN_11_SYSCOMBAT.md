# Chantier 11 — Système de Combat Polaris
> Document de planification — Session 51 / Mis à jour Session 62
> Statut : Sprints 1–6 ✅ — Prochain : Sprint 7 (Jets d'attaque + Dégâts + Blessures + Carence FOR)
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
| **Actions déclarées** | **Table `combat_actions` — command queue. 1 ligne par `action_key` déclarée. Ex : move_short + micro_draw + assault = 3 lignes. Pattern professionnel tour-par-tour.** |
| **Exclusivité actions** | **Aucune validation en phase Annonce — cibles et positions mémorisées, GM arbitre en Résolution (LdB p.218)** |
| **États personnage** | **`state_position` + `state_weapon` dans `combat_roster` — persistants entre les tours. action_key = déclencheur, pas stockage.** |
| **target_pos** | **Colonnes INT séparées (target_pos_x/y/z) — type-safe, coords DB PE14. Client convertit avant envoi.** |
| **sequence intra-slot** | **SMALLINT NOT NULL dans combat_actions — ordre garanti : move_* (1) → micro (2) → assault (3). Attribué serveur à l'INSERT. ORDER BY sequence ASC en résolution.** |
| **weapon_inv_id** | **ID char_inventory réel — arme équipée slot MG ou MD. Guard serveur : slot doit être MG ou MD** |
| **UI déplacement** | **1 item "Déplacement" dans SECTIONS (isMove:true). Canvas3D : 4 anneaux RingGeometry + cursor wireframe. Zone anneau → action_key (lente=move_short, autres=move_long) + ini_mod dans modifiers.** |
| **Centrage caméra** | **Sprint 2.5 dédié. Prop combatCameraCenter:{x,z}|null dans Canvas3D. orbitRef.current.target.set() + update() dans useEffect.** |
| **voxel_scale** | **Hardcodé 1.0 en Sprint 3. scale_label (TEXT) = cosmétique uniquement. Sprint ScaleMap dédié post-Sprint 4.** |

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
  state_character  JSONB   NOT NULL DEFAULT '{}'
                     -- flags booléens combinables : { is_rushed, is_stunned, is_rooted, is_delayed, ... }
                     -- Règle : clé absente = false. Ne jamais stocker false explicitement.
                     -- Merge JSONB (PC39) : db.raw('state_character || ?::jsonb', [JSON.stringify({is_rushed:true})])
                     -- endTurn : db.raw("state_character - 'is_rushed'") pour flags per-turn uniquement
                     -- Distinct de state_position / state_weapon (enums exclusifs, migration 56)
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

-- Actions déclarées — command queue : 1 ligne par action_key déclarée
combat_actions
  id               UUID      PK DEFAULT gen_random_uuid()
  campaign_id      UUID      FK → campaigns.id ON DELETE CASCADE
  token_id         UUID      FK → tokens.id ON DELETE CASCADE
  action_key       TEXT      NOT NULL  -- clé exacte : 'rushed','micro_draw','move_short','assault', etc.
  sequence         SMALLINT  NOT NULL  -- ordre exécution : move_*(1) → micro(2) → assault(3). Attribué serveur.
  target_token_id  UUID      NULLABLE  -- assault uniquement
  target_pos_x     INT       NULLABLE  -- move_short/move_long — coords DB (PE14)
  target_pos_y     INT       NULLABLE  -- coords DB (PE14) : profondeur (= Z Three.js)
  target_pos_z     INT       NULLABLE  -- coords DB (PE14) : altitude  (= Y Three.js)
  weapon_inv_id    UUID      NULLABLE  -- FK → char_inventory.id SET NULL (assault)
  modifiers        JSONB     NOT NULL DEFAULT '{}'  -- { ini_mod: int } — variable selon l'action
  status           TEXT      CHECK IN ('pending','resolved','skipped') DEFAULT 'pending'
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ
  -- INDEX: (campaign_id, token_id) pour résolution slot
  -- INDEX: (campaign_id, action_key) pour requêtes filtrées par action
```

⚠️ `weapon_inv_id` : `ON DELETE SET NULL` — si item supprimé en cours de combat, action reste sans arme. Guard serveur obligatoire avant calcul dégâts.

---

## 4. Schéma des actions déclarées (`combat_actions`)

**Types d'actions :**
| Type | Description | Exclusif | Modificateur d'Initiative |
|---|---|---|---|
| `assault` | Attaque sur une cible (`target_token_id` + `weapon_inv_id`) | Non | 0 |
| `move_short` | Déplacement allure lente — zone 1 (`target_pos_x/y/z`) | Non | -3 (modifiers.ini_mod) |
| `move_long` | Déplacement allures moyenne/rapide/max — zones 2-4 (`target_pos_x/y/z`) | Oui (GM arbitre) | -5 / -7 / 0 (modifiers.ini_mod) |
| `micro` | Toute action sans effet résolution V1 — inclut `rushed` | Non | variable (KEY_MOD) |
| `skip` | Tour passé par GM | — | — |

**Champ `modifiers` JSONB (V1) :**
```json
{ "ini_mod": -3 }
```
Une ligne par action → `modifiers` ne contient que l'ini_mod de cette action spécifique.
Sprint 7 → migration 57 : `target_token_id` déjà en DB (migration 54) mais jamais peuplé — le handler COMBAT_ACTION_DECLARE doit le stocker. Colonnes nouvelles à ajouter : `fire_mode` (TEXT), `bullet_count` (SMALLINT), `fire_mode_bonus_comp` (SMALLINT) sur la ligne assault uniquement.

**Règles :**
- `is_rushed` : action micro (`action_key='rushed'`, `type='micro'`) — +3 INI à l'annonce.
  ⚠️ **Implémentation en deux temps :**
  1. **Annonce (COMBAT_ACTION_DECLARE)** : INSERT combat_actions (pour le +3 INI) ET UPDATE `combat_roster SET state_character = state_character || '{"is_rushed":true}'::jsonb WHERE token_id=X` (PC39).
  2. **Résolution (Sprint 7.3)** : lire `combat_roster.state_character->>'is_rushed'` → appliquer −5 Mod Compétence. **Jamais** `SELECT FROM combat_actions WHERE action_key='rushed'` — combat_actions est vidé en fin de tour (PC28).
  3. **endTurn** : `db.raw("state_character - 'is_rushed'")` — flag per-turn uniquement.
- `move_short` / `move_long` : UI = 1 seul item "Déplacement" dans SECTIONS (`isMove: true`). La zone anneau (lente/moyenne/rapide/max) détermine l'`action_key` et l'`ini_mod` stocké dans `modifiers`. Zone 1 → move_short / -3. Zones 2-4 → move_long / -5, -7 ou 0 respectivement.
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

### Sprint 2.5 — Centrage caméra automatique (combat)

**Objectif :** Quand un joueur entre en mode sélection de destination (mouvement combat), la caméra se centre automatiquement sur son token.

**Fichiers à lire AVANT :**
- `client/src/components/Canvas3D.jsx` — `orbitRef`, `MapControls`, pattern `moveTarget`

**Fichiers modifiés :**
- `client/src/components/Canvas3D.jsx` — nouveau prop `combatCameraCenter: { x, z } | null` ; dans `Scene` : `useEffect` qui appelle `orbitRef.current.target.set(x+0.5, 0, z+0.5); orbitRef.current.update()` quand `combatCameraCenter` change et n'est pas null
- `client/src/pages/SessionPage.jsx` — état `combatCameraCenter` (null par défaut) ; mis à null à l'annulation du mode mouvement

**Validation Sprint 2.5 :**
- ✅ Joueur clique "Déplacement" → caméra glisse vers son token (damping MapControls)
- ✅ Annulation mode mouvement → caméra ne revient pas (reste là où elle est)
- ✅ orbitRef.current null-checked avant appel

---

### Sprint 3 — Migration 56 (DB seul)

**Objectif :** Aligner le schéma `combat_actions` / `combat_roster` / `battlemaps` sur le plan validé. Aucune logique serveur ni UI — juste la migration.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — état après Sprint 2 (confirmer colonnes utilisées avant ALTER)
- `server/src/db/migrations/54_combat.js` — schéma actuel exact

**Fichiers créés :**
- `server/src/db/migrations/56_combat_v2.js`

**Contenu migration 56 :**
```js
// combat_actions — passage au command queue
await knex.schema.alterTable('combat_actions', table => {
  table.text('action_key')           // remplie par backfill avant NOT NULL
  table.smallint('sequence').defaultTo(0)
  table.integer('target_pos_x')
  table.integer('target_pos_y')
  table.integer('target_pos_z')
})
await knex.raw("UPDATE combat_actions SET action_key = type")
await knex.raw("ALTER TABLE combat_actions ALTER COLUMN action_key SET NOT NULL")
await knex.raw("ALTER TABLE combat_actions DROP COLUMN is_micro")
await knex.raw("ALTER TABLE combat_actions DROP COLUMN initiative_score")
await knex.raw("ALTER TABLE combat_actions DROP COLUMN target_pos")
await knex.raw("CREATE INDEX idx_actions_token ON combat_actions(campaign_id, token_id)")
await knex.raw("CREATE INDEX idx_actions_key   ON combat_actions(campaign_id, action_key)")

// combat_roster — états personnage persistants
await knex.schema.alterTable('combat_roster', table => {
  table.text('state_position').notNullable().defaultTo('standing')
  table.text('state_weapon').notNullable().defaultTo('holstered')
})
await knex.raw(`ALTER TABLE combat_roster
  ADD CONSTRAINT chk_state_position CHECK (state_position IN ('standing','crouching','prone')),
  ADD CONSTRAINT chk_state_weapon   CHECK (state_weapon IN ('holstered','ready','drawn'))`)

// battlemaps — échelle numérique (voxel_scale_ui = sprint ScaleMap)
await knex.schema.alterTable('battlemaps', table => {
  table.float('voxel_scale').notNullable().defaultTo(1.0)
})
```

**Validation Sprint 3 :**
- ✅ Migration appliquée sans erreur (`migrate:latest`)
- ✅ `\d combat_actions` : action_key NOT NULL, sequence SMALLINT, target_pos_x/y/z INT, indexes créés
- ✅ `\d combat_roster` : state_position + state_weapon avec CHECK
- ✅ `\d battlemaps` : voxel_scale FLOAT DEFAULT 1.0
- ✅ SR sans erreur (aucun code serveur/client changé)

---

### Sprint 4 — UI déclaration déplacement (client)

**Objectif :** Le joueur voit "Déplacement" dans CombatActionWindow, clique dessus, la fenêtre disparaît (opacity 0), la carte affiche 4 anneaux concentriques, il clique une destination, la fenêtre réapparaît avec la destination affichée.

**Fichiers à lire AVANT :**
- `client/src/components/Canvas3D.jsx` — orbitRef, moveTarget pattern, ghost rendering (déjà lu)
- `client/src/components/CombatActionWindow.jsx` — état actuel post-Sprint 2
- `client/src/components/combatSections.js` — état actuel
- `server/src/lib/charStats.js` — signature `calcAllures(coo_na, athletisme_total)`

**Fichiers modifiés :**
- `client/src/components/combatSections.js` — remplacer les 2 items `move_short`/`move_long` par 1 item `{ key: 'move', label: 'Déplacement', active: true, isMove: true }` ; supprimer `move_short`/`move_long` de `KEY_MOD`
- `client/src/components/CombatActionWindow.jsx` — état `moveSelection: { action_key, ini_mod, targetPosX, targetPosY, targetPosZ } | null` ; clic sur item `isMove` → `onEnterMoveMode(allures)` callback + `opacity: 0` ; réception `onMoveSelected` → `setMoveSelection` + `opacity: 1` ; `totalMod` = KEY_MOD réduction + `moveSelection?.ini_mod ?? 0` ; afficher destination sélectionnée dans le footer
- `client/src/pages/SessionPage.jsx` — état `combatMoveMode: { tokenId, allures, onMoveSelected, onCancel } | null` ; callbacks `handleEnterMoveMode` + `handleMoveSelected` + `handleMoveCancel`
- `client/src/components/Canvas3D.jsx` — prop `combatMoveMode` + passage à `Scene` ; dans Scene : 4 anneaux `RingGeometry` centrés sur le token actif (rayon = allure en voxels × voxel_scale) ; cursor wireframe 1×1 suit la souris ; clic → `combatMoveMode.onMoveSelected({ action_key, ini_mod, targetPosX, targetPosY, targetPosZ })` ; Échap → `combatMoveMode.onCancel()`

**Mapping allure → action_key + ini_mod :**
| Zone | Allure | action_key | ini_mod |
|---|---|---|---|
| 1 | Lente (≤ lente m) | move_short | -3 |
| 2 | Moyenne (≤ moyenne m) | move_long | -5 |
| 3 | Rapide (≤ rapide m) | move_long | -7 |
| 4 | Max (≤ max m) | move_long | 0 |

**Couleurs anneaux :** Lente=bleu, Moyenne=vert, Rapide=orange, Max=rouge (opacité 0.25)

**Validation Sprint 4 :**
- ✅ CombatActionWindow : item "Déplacement" visible, `move_short`/`move_long` disparus
- ✅ Clic "Déplacement" → fenêtre disparaît (opacity 0) → 4 anneaux visibles sur la carte
- ✅ Survol carte → cursor wireframe 1×1 sur la case
- ✅ Clic dans zone 1 → fenêtre réapparaît, footer affiche "→ [X,Y]" + "INI -3"
- ✅ Clic dans zone 3 → INI -7
- ✅ Échap → mode annulé, fenêtre réapparaît sans sélection
- ✅ SR sans erreur

---

### Sprint 5 — Serveur : COMBAT_ACTION_DECLARE (target_pos)

**Objectif :** Le serveur reçoit `target_pos_x/y/z` et `ini_mod` dans le payload de déclaration et les stocke correctement dans `combat_actions`.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — handler COMBAT_ACTION_DECLARE actuel (post-Sprint 2)

**Fichiers modifiés :**
- `server/src/socket/index.js` — handler `COMBAT_ACTION_DECLARE` :
  - Nouveau payload : `{ tokenId, actions: [{ action_key, ini_mod, targetPosX, targetPosY, targetPosZ, weaponInvId }] }`
  - Guard target_pos (PC33) : pour chaque action IN ('move_short','move_long') → parseInt(targetPos*) NOT NULL
  - `sequence` attribué serveur selon catégorie de l'action_key : move_*=1, micro variants=2, assault=3
  - INSERT bulk (transaction) : 1 row par action dans `actions[]`
  - `ini_mod_total = actions.reduce((sum, a) => sum + a.ini_mod, 0)`
  - UPDATE `combat_roster SET initiative = base_ini + ini_mod_total`
  - Reste inchangé : ownership guard, has_announced, PC13

**Validation Sprint 5 :**
- ✅ SR sans erreur
- ✅ Joueur déclare move_short + micro_draw + assault → DB : 3 lignes avec sequence 1/2/3
- ✅ move_short : target_pos_x/y/z non-null
- ✅ micro_draw : target_pos null, modifiers.ini_mod=-5
- ✅ PC33 : target_pos null pour move_* → erreur explicite
- ✅ initiative recalculée correctement dans combat_roster

---

### Sprint 6 — Phase Résolution

**Objectif :** Actions exécutées dans l'ordre d'initiative. Déplacement résolu via Redis. Tour boucle.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — état après Sprint 5
- `server/src/lib/redis.js` — isCaseOccupied, collisionMoveToken
- `client/src/stores/combatStore.js` — état après Sprint 2

**Fichiers modifiés :**
- `server/src/socket/index.js` — `startResolutionPhase()` complet, `COMBAT_ACTION_CONFIRM` (déplacement + micro), `advanceSlot()`, `endTurn()`
- `client/src/pages/SessionPage.jsx` — handler COMBAT_SLOT_ADVANCED
- `client/src/components/CombatActionWindow.jsx` — mode Résolution (récapitulatif + bouton "Agir", assaut grisé)
- `client/src/components/CombatTimeline.jsx` — curseur activeSlotIdx

**`startResolutionPhase()` :**
```js
// Tri par combat_roster.initiative — jamais initiative_score (PC27)
const slots = await db('combat_roster')
  .where({ campaign_id, status: 'active', has_announced: true })
  .orderBy('initiative', 'desc')
  .select('token_id', 'initiative')
```

**Handler `COMBAT_ACTION_CONFIRM` (déplacement + micro) :**
- Lire `combat_actions WHERE token_id=X ORDER BY sequence ASC` — N lignes (command queue)
- Pour chaque action dans l'ordre :
  - `action_key IN ('move_short','move_long')` → step-by-step Redis (PE22, PE29)
  - `action_key LIKE 'micro_%'` → cosmétique V1, resolved direct
  - `action_key = 'assault'` → log "Sprint 7 requis", resolved sans effet
- UPDATE status='resolved' pour chaque action traitée

**`endTurn()` :**
- (PC18) `UPDATE combat_roster SET has_announced=false, has_resolved=false WHERE campaign_id AND status='active'`
- (PC28) `DELETE FROM combat_actions WHERE campaign_id`
- `UPDATE combat_state SET current_turn+1, phase='ANNOUNCEMENT'`
- Broadcast COMBAT_PHASE_CHANGED ANNOUNCEMENT

**Validation Sprint 6 :**
- ✅ Phase RESOLUTION : slots défilent ORDER BY combat_roster.initiative DESC
- ✅ Curseur timeline suit activeSlotIdx
- ✅ Déplacement résolu → token se déplace + collision Redis
- ✅ Fin de tour → turn+1 → retour ANNOUNCEMENT
- ✅ PC18 : 1 requête (vérifier)
- ✅ PC28 : combat_actions vide après endTurn

---

### Sprint 7 — Jets d'attaque + Dégâts + Blessures + Carence FOR

**Objectif :** Attaques complètes. Blessures enregistrées. Carence FOR appliquée.

**Fichiers à lire AVANT :**
- `server/src/socket/index.js` — état après Sprint 6
- `server/src/lib/charStats.js` — calcResistanceArmure, calcCarenceArmure, calcResistanceDommages, calcWoundPenalty
- `shared/woundConstants.js` — ✅ PO1 résolu : `{ legere:-1, moyenne:-3, grave:-5, critique:-10, mortelle:-20 }`
- `shared/armorConstants.js` — LOCATION_TO_SLOT (mapping localisation touchée → slotCode)
- `server/src/routes/character/char-sheet.js` — `resolveWoundInsertion` + `isShockTestRequired` (locales à exporter avant Sprint 7.3)
- ✅ PO2 résolu : colonne `range TEXT`, format `"X/Y/Z/W (V)"` ex. `"10/50/100/200 (300)"`, contact : `"1"` (PC37/PC38)
- ✅ PO3 résolu LdB p.239 — table Tests de Choc ci-dessous

**Fichiers à créer :**
- `client/src/components/CombatModifiersWindow.jsx`

**Fichiers à modifier :**
- `server/src/socket/index.js` — `COMBAT_ACTION_CONFIRM` branche assault, calcul dégâts complet
- `client/src/components/CombatActionWindow.jsx` — bouton Assaut actif + CombatModifiersWindow

**⚠️ Prérequis Sprint 7 — Déclaration Assaut (ST1 non implémentée en Sprint 6)**

La déclaration d'un Assaut en phase Annonce nécessite :
- Sélection cible (`target_token_id`) — liste des tokens actifs du roster. Colonne déjà en DB (migration 54) mais jamais peuplée par le handler.
- Sélection arme (`weapon_inv_id`) — MG ou MD équipée (guard PC22). Côté serveur stocké, côté client envoyé `null`.
- Sélection mode de tir RC/RL — déclarée à l'**ANNONCE** (phase ST1), jamais en Résolution. Fetch arme → `ref_equipment.fire_mode` → flags `allowCC` / `allowAuto` (pattern Kiwi `getCombatContext`).
- Snapshot arme : `ref_damage_h` (formule dés — alias de `ref_equipment.damage_h` dans GET /inventory, PC40), `ref_range` (alias de `ref_equipment.range`), `ref_fire_mode` — chargés au moment de la sélection de l'arme dans CombatActionWindow.

⚠️ RC/RL appartient à la phase ANNONCE (ST1). Les modificateurs GM (portée, situation, taille) appartiennent à la phase RÉSOLUTION (ST2). Ces deux choses ne doivent pas être mélangées.

**Sprint 7 = 3 sprints séquentiels :**
1. Sprint 7.1 — Déclaration Assaut (UI Annonce) → cible + arme + mode de tir RC/RL
2. Sprint 7.2 — CombatModifiersWindow (UI Résolution) → modificateurs GM uniquement
3. Sprint 7.3 — Résolution Assaut (serveur) → jet + dégâts + blessures + Test de Choc

---

**Table Tests de Choc — LdB p.235-236 et p.239**

Test = 1D20 vs `calcSeuils()` (déjà dans `charStats.js`) :
- ≤ Seuil Étourdissement → réussi (pas d'effet)
- > Seuil Étour. ET ≤ Seuil Inconscience → Étourdi (−5 actions, allure moyenne max, ne peut pas attaquer)
- > Seuil Inconscience → Inconscient (aucune action possible)

| Gravité | Localisation | Test de Choc ? | Malus au test |
|---|---|---|---|
| Grave | Corps | oui | 0 |
| Grave | Tête | oui | −5 |
| Critique | Bras | oui | 0 |
| Critique | Jambes | oui | 0 |
| Critique | Corps | oui | −5 |
| Critique | Tête | oui | −10 |
| Mortelle | Bras | oui | −5 |
| Mortelle | Jambes | oui | −5 |
| Mortelle | Corps | oui | −10 |
| Mortelle | Tête | oui | −15 |
| Membre détruit | Bras | oui | −10 |
| Membre détruit | Jambes | oui | −10 |
| Légère / Moyenne | toutes | non | — |

Le malus s'applique au jet 1D20 (ajouté côté défavorable — le personnage doit faire plus bas que son seuil).

---

**Handler `COMBAT_ACTION_CONFIRM` — Sprint 7 (assault) :**
- Guard : action.weapon_inv_id non null (PC22) — si null → skip avec log
- Guard : slot de l'arme = 'MG' ou 'MD'
- **Vérification pré-jet — portée + LOS (avant le jet de dés) :**
  - **(a) Portée extrême** : calculer distance tireur→cible `Math.sqrt(dx²+dy²+dz²) × voxel_scale`. ⚠️ Sprint 7 : `voxel_scale = 1.0` hardcodé (PC35 — Sprint ScaleMap non implémenté). Parser `ref_equipment.range` (PC37, PC38) → seuil extrême. Si `distance > extreme` → `{ label: 'hors_portee', value: -99 }` dans situation.
  - **(b) LOS** : raycast 3D DDA via la collision map Redis (même map que `isCaseOccupied` déplacement), origine `pos_z+1` tireur, cible `pos_z+1` cible (PE29 — niveau des yeux). Si LOS bloquée → `{ label: 'los_bloquee', value: -99 }` dans situation. ⚠️ `isCaseOccupied` vérifie 1 voxel seulement — la traversée DDA multi-voxels est **un algorithme à écrire** (pas de fonction existante dans le projet).
  - Si situation contient un modificateur −99 : jet automatique côté serveur (pas d'attente clic joueur), munitions consommées (Sprint 7.5), résultat diffusé dans le chat. Le processus normal s'exécute — rate garanti mathématiquement.
  - ⚠️ V1 = LOS binaire (dégagée / bloquée). Détection couverture partielle (−3) / importante (−5) depuis les voxels adjacents = V2 sprint dédié futur.
- Fetch tireur : pattern existant (`socket/index.js` ~lignes 680-695, cf. SYSTEME.md §17) :
  - `attrs + archetype → genotypeRow`
  - `charSkillRow` : `weapon_inv_id → char_inventory.item_id → ref_equipment_skill_assoc WHERE item_id = X → skill_id` → `char_skills WHERE skill_id` + `ref_skills WHERE id` (BUG C — chaîne obligatoire, jamais d'hypothèse sur skill_id)
  - `char_inventory` : arme snapshot (pour `ref_damage_h`, `ref_range`) + armures équipées slot MG/MD
  - `char_inventory` : **TOUS les items `container != 'Coffre'`** pour le calcul poids encombrement (`calcEncumbrancePenalty`) — L9 : ne pas oublier ce fetch séparé
  - `character_wounds`
- Fetch cible (`target_token_id`) : token roster → `character_id` → `char_sheet WHERE character_id = X` → **`char_sheet_id_cible`** (nécessaire pour `resolveWoundInsertion`) + `char_attributes + char_archetype → genotypeRow` (pour `calcResistanceDommages` + `calcSeuils` : for_na, con_na, vol_na) + `char_inventory` (armures équipées filtrées slot = localisation)
- Calcul compétence tireur : `calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)`
- Carence : `calcCarenceArmure(tireurEquippedArmor, forNA_tireur)` — appliquée sur le jet du tireur
- Malus état : `calcWoundPenalty(wounds_tireur)` + `calcEncumbrancePenalty(totalWeight, forNA_tireur)` → effectiveMalus
  (`totalWeight` = somme `ref_weight` des items `container != 'Coffre'` — fetch séparé ci-dessus)
- Modificateurs totaux Compétence : portée + sum(situation[]) + taille + is_rushed(−5 si `state_character.is_rushed`) + `combat_action.fire_mode_bonus_comp` − carence (PC26)
  Note : `fire_mode_bonus_comp` vient de `combat_actions` (déclaré en Annonce), pas de `confirmedModifiers`. Pas de tir_instinctif pour un Assaut classique.
- (PC24) chaque modificateur nommé explicitement dans les logs/résultats
- Jet 1d20 via `parseDice('1d20')` côté serveur
- `chancesDeReussite = skillTotal + totalModComp + effectiveMalus`
- `isSuccess = roll <= chancesDeReussite`
- Si succès :
  - Localisation : jet 1d20 serveur → table distance V1 (section ci-dessous)
  - `calcResistanceArmure(cibleEquippedArmor.filter(item => item.slot === slotCode))` → ETQ / PRT (PC29 : déjà dispo)
  - `mr = chancesDeReussite - roll` (positif sur succès) → `getModifier(mrTable, mr)` → `modDomAttaque` (LdB p.209)
    ⚠️ `getMrTable()` + `getModifier()` **existent déjà** dans `socket/index.js` lignes 41-55 — réutiliser directement, ne pas recréer.
  - `isShortRange` = (`confirmedModifiers.portee` ∈ `['bout_portant','courte']`)
  - `modDegatsMode` = `isShortRange ? combat_action.fire_mode_bonus_dmg : 0`
  - Dégâts bruts = `parseDice(weapon.ref_damage_h) + modDomAttaque + modDegatsMode`
    ⚠️ PC40 : la colonne est `ref_equipment.damage_h`, aliasée `ref_damage_h` dans GET /inventory — jamais `ref_degats` ni `ref_degats_total`.
  - `calcResistanceDommages(for_na_cible, con_na_cible)` → RD
  - Dégâts nets = `max(0, dégâts bruts − ETQ − RD)`
  - **1 seule blessure par touche — gravité par comparaison aux seuils :**
    - nets ≥ 30 → `'mortelle'` + flag `is_lethal: true` (Mort / Membre détruit — signalé en broadcast, GM gère)
    - nets ≥ 25 → `'mortelle'`
    - nets ≥ 20 → `'critique'`
    - nets ≥ 15 → `'grave'`
    - nets ≥ 10 → `'moyenne'`
    - nets ≥  5 → `'legere'`
    - nets <  5 → aucune blessure
  - Si severity non null : `resolveWoundInsertion(trx, char_sheet_id_cible, location, severity)` — (P49 : check promoted)
    ⚠️ `resolveWoundInsertion` et `isShockTestRequired` sont locales dans `char-sheet.js` → **à exporter** avant ce sprint
  - Test de Choc si `isShockTestRequired(severity, location)` :
    - `calcSeuils(for_na_cible, con_na_cible, vol_na_cible)` → `{ etourdissement, inconscience }`
    - Malus : `getShockMalus(severity, location, is_lethal)` — **fonction à écrire** dans `charStats.js` (Sprint 7.3). Règle : si `is_lethal=true` ET `location ∈ ['bras_droit','bras_gauche','jambe_droite','jambe_gauche']` → retourner `−10` (Membre détruit, pas −5 Mortelle Bras/Jambes). Sinon : lire table Tests de Choc ci-dessus.
    - `if (roll1D20 <= etourdissement + shockMalus)` → aucun effet (succès)
    - `else if (roll1D20 <= inconscience + shockMalus)` → Étourdi
    - `else` → Inconscient
    - Inclure `shockResult: { triggered, roll, outcome }` dans broadcast `COMBAT_ATTACK_RESULT`
  - (P49) promoted check sur chaque blessure créée
- Broadcast `WS.COMBAT_ATTACK_RESULT { tireurId, cibleId, localisation, degautsBruts, degatsNets, severity, is_lethal, isSuccess, roll, chancesDeReussite, shockResult }`
  Note : `shockResult = null` si pas de Test de Choc ; `severity = null` si pas de blessure ; pas de `nbrBlessures` (toujours 1).
- (PC23) RC/RL : vérification compétence "Tir Automatique" côté serveur à la déclaration (COMBAT_ACTION_DECLARE) uniquement

**Localisation V1 — distance (LdB p.228) :**
| Jet | Localisation | slotCode | wound_location (WOUND_LOCATIONS) |
|---|---|---|---|
| 1-2 | Tête | T | `tete` |
| 3-8 | Corps | C | `corps` |
| 9-11 | Bras Droit | BD | `bras_droit` |
| 12-14 | Bras Gauche | BG | `bras_gauche` |
| 15-17 | Jambe Droite | JD | `jambe_droite` |
| 18-20 | Jambe Gauche | JG | `jambe_gauche` |

⚠️ `calcResistanceArmure` utilise **slotCode** (T/C/BD/etc.) pour filtrer les armures.
⚠️ `resolveWoundInsertion` + `isShockTestRequired` attendent **wound_location** (`'tete'`, `'corps'`, etc.) — **jamais le slotCode**.
Mapping inverse à exporter dans `shared/armorConstants.js` (Sprint 7.3) :
```js
export const SLOT_TO_WOUND_LOCATION = {
  T: 'tete', C: 'corps',
  BD: 'bras_droit', BG: 'bras_gauche',
  JD: 'jambe_droite', JG: 'jambe_gauche',
}
```

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

**Constante portée → numérique (L10) — à définir dans le handler `COMBAT_ACTION_CONFIRM` serveur :**
```js
const PORTEE_MOD_COMP = {
  bout_portant: 5, courte: 0, moyenne: -5, longue: -10, extreme: -15,
}
// confirmedModifiers.portee est la clé — ex. : PORTEE_MOD_COMP[confirmedModifiers.portee] ?? 0
```

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

**Portée — calcul automatique (pré-remplissage CombatModifiersWindow) :**
- Source : `ref_equipment.range` au format `"bout_portant/courte/moyenne/longue (extreme)"` — exemples réels en DB : `"10/50/100/200 (300)"`, `"8/40/80/160 (240)"`, `"50/250/500/1 000 (1 500)"`. Arme de contact : valeur unique ex. `"1"` (pas de slash, pas de valeur extrême).
- Parsing (côté client ET côté serveur — même logique) :
  1. Extraire la valeur entre parenthèses → extrême (absent si arme contact)
  2. Splitter sur `"/"` → [bp, courte, moyenne, longue]
  3. ⚠️ PC37 : `parseInt(s.replace(/\s/g, ''), 10)` pour chaque valeur (espace millier possible)
  4. PC38 : si valeur unique (arme contact) → seuil unique `bout_portant`
- Calcul distance (coords DB PE14 → Three.js avant calcul) :
  - `tireurPos` : `{ x: token.pos_x, y: token.pos_z, z: token.pos_y }` (PE14)
  - `ciblePos` : idem depuis `combat_actions.target_token_id` → token roster
  - `distance = Math.sqrt(dx² + dy² + dz²) × voxel_scale`
- Sélection palier pré-rempli :
  - `≤ bp` → `bout_portant` · `≤ courte` → `courte` · `≤ moyenne` → `moyenne` · `≤ longue` → `longue` · `≤ extreme` → `extreme` · `> extreme` → hors portée (cas serveur : −99)
- Afficher la distance calculée (valeur numérique) à titre indicatif dans CombatModifiersWindow
- GM peut toujours sélectionner un palier différent (radio non-locked)

**CombatModifiersWindow.jsx :**
- Affiché simultanément joueur actif + GM en phase RÉSOLUTION dès que assault ∈ myActions du slot actif
- Section joueur (lecture seule) : arme sélectionnée, mode de tir déclaré (RC/RL), cible, is_rushed
  ⚠️ Pas de checkbox "Tir instinctif" — non applicable à un Assaut classique. RC/RL déjà déclaré en Annonce, pas resélectionné ici.
- Section GM : Portée (radio 5 paliers — **pré-sélectionné** depuis calcul auto décrit ci-dessus ; GM peut changer), Situation (checkboxes multi-select), Taille cible (radio)
- Header sticky : bonus test total + bonus dégâts total (style Kiwi `ModificateursCombat.html` : pills colorés fond sombre)
- Bouton "Valider" côté GM (disabled si portée non choisie) → émet `COMBAT_ACTION_CONFIRM { tokenId, confirmedModifiers: { portee, situation[], taille } }`
  ⚠️ Pas de `tirInstinctif` ni `fireMode` dans `confirmedModifiers` — le fire_mode est dans `combat_actions` (déclaré en Annonce)

**Affichage carence FOR :**
- Dans `CombatModifiersWindow` : afficher carence tireur si > 0 (rouge)
- forNA disponible dans ce contexte (char_attributes chargés pour le jet)
- Distinct de l'affichage dans ArmorWoundPanel (reporté Chantier 11 sprint 3 = ce sprint 4)

**Validation Sprint 7 :**
- ✅ Jet d'attaque résolu (succès/échec, roll affiché)
- ✅ Localisation tirée au sort côté serveur
- ✅ Dégâts nets calculés (mille-feuille + RD)
- ✅ Blessure enregistrée en DB si dégâts nets ≥ 5
- ✅ COMBAT_ATTACK_RESULT broadcast → résumé visible dans CombatOverlay
- ✅ Carence FOR > 0 → malus appliqué sur jet
- ✅ RC/RL modificateurs appliqués + Tir Automatique vérifié serveur (PC23)
- ✅ Tête : jet de Choc si seuil dépassé (PO3 confirmé LdB)

---

### Sprint ScaleMap — Échelle battlemap (reporté post-Sprint 4)

**Objectif :** Le GM peut définir l'échelle d'une carte (ex. 1 voxel = 1,5 m) — impacte les calculs de portée de déplacement combat.

**Prérequis :** `battlemaps.voxel_scale FLOAT NOT NULL DEFAULT 1.0` déjà ajouté en migration 56. Ce sprint ajoute l'UI GM et la propagation dans les calculs.

**Fichiers modifiés :**
- Interface paramètres battlemap — champ numérique `voxel_scale`
- `Canvas3D.jsx` — passer `battlemap.voxel_scale` à Scene → rayon des anneaux allures = `allure_m * voxel_scale`
- Serveur `COMBAT_ACTION_DECLARE` — vérifier distance avec `voxel_scale` de la battlemap active

**Validation :**
- ✅ GM change scale 1.0 → 1.5 → anneaux allures se redimensionnent
- ✅ Déclaration déplacement → distance voxels correcte avec scale

---

## 7. Points ouverts — à résoudre avant le sprint concerné

| # | Question | Sprint | Statut |
|---|---|---|---|
| PO1 | `WOUND_PENALTIES` — valeurs exactes dans `woundConstants.js` ? | 7 | ✅ Résolu : `{ legere:-1, moyenne:-3, grave:-5, critique:-10, mortelle:-20 }` |
| PO2 | Colonnes portées exactes dans `ref_equipment` | 7 | ✅ Résolu : colonne `range TEXT`, format `"X/Y/Z/W (V)"` ex. `"10/50/100/200 (300)"`, contact: `"1"` |
| PO3 | Seuil jet de Choc + malus par gravité/localisation | 7 | ✅ Résolu LdB p.239 — voir table ci-dessous |
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
| PC32 | sequence SMALLINT dans combat_actions — ORDER BY sequence ASC pour exécution intra-slot. Jamais supposer l'ordre d'insertion SQL. Attribué serveur : move_*(1) → micro(2) → assault(3). |
| PC33 | target_pos_x/y/z : colonnes INT séparées (coords DB PE14). Client convertit Three.js → DB avant envoi. parseInt obligatoire côté serveur au guard. |
| PC34 | Sprint 3 = migration 56 seule. Ne pas toucher socket/index.js ni les composants avant que la migration soit appliquée et vérifiée en psql. |
| PC35 | voxel_scale = 1.0 hardcodé en Sprint 3. L'UI ScaleMap est reportée (sprint dédié). Ne pas brancher voxel_scale sur battlemap.scale_label (TEXT cosmétique). |
| PC36 | combatMoveMode prop distinct de moveTarget dans Canvas3D. moveTarget = entity push/pull (9F-B2). Ne pas réutiliser pour le combat mouvement. |
| PC37 | `ref_equipment.range` parsing : `parseInt("1 000")` = NaN. Toujours `parseInt(s.replace(/\s/g, ''), 10)` pour chaque valeur de portée (les armes longue portée utilisent l'espace comme séparateur millier). |
| PC38 | Portée arme de contact : `range` = valeur unique (ex. `"1"`) — pas de slash. Pas de portée extrême. Parser → palier `bout_portant` uniquement, distance max = valeur. |
| PC39 | JSONB `state_character` — merge obligatoire, jamais remplacement : `db.raw('state_character \|\| ?::jsonb', [JSON.stringify({is_rushed:true})])`. Un `UPDATE SET state_character = '{"is_rushed":true}'` écrase tous les autres flags (is_stunned, etc.). Suppression d'un flag : `db.raw("state_character - 'is_rushed'")`. |
| PC40 | Colonne dégâts arme : `ref_equipment.damage_h` (migration 48). Aliasée `ref_damage_h` dans GET /inventory (`char-sheet.js`). Jamais `ref_degats` ni `ref_degats_total` — ces colonnes n'existent pas. Toujours `parseDice(weapon.ref_damage_h)` côté serveur. |

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
  ⚠️ `endTurn()` doit aussi effacer les flags **per-turn** de `state_character` (PC39) :
  ```js
  await db('combat_roster').where({ campaign_id })
    .update({ state_character: db.raw("state_character - 'is_rushed'") })
  ```
  Ne pas effacer les flags persistants (is_stunned, is_rooted, etc.).

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
- [ ] state_character.is_rushed effacé après endTurn

---

### Sprint 7 — Jets d'attaque + Dégâts + Blessures + Carence FOR

**Avant de coder (lire en entier) :**
- [ ] `server/src/socket/index.js` — état après Sprint 6
- [ ] `server/src/lib/charStats.js` — calcResistanceArmure, calcCarenceArmure, calcResistanceDommages, calcWoundPenalty, calcSeuils
- [x] PO1 résolu : `shared/woundConstants.js` — `WOUND_PENALTIES = { legere:-1, moyenne:-3, grave:-5, critique:-10, mortelle:-20 }`
- [ ] `shared/armorConstants.js` — LOCATION_TO_SLOT (+ exporter SLOT_TO_WOUND_LOCATION — Sprint 7.3)
- [ ] `server/src/routes/character/char-sheet.js` — `resolveWoundInsertion` + `isShockTestRequired` (fonctions locales à **exporter** avant Sprint 7.3)
- [x] PO2 résolu : colonne `range TEXT`, format `"X/Y/Z/W (V)"` (PC37/PC38 documentés)
- [x] PO3 résolu : seuil jet de Choc LdB p.239 — table Tests de Choc documentée en section 6

**Sprint 7.1 — Déclaration Assaut (UI Annonce)**
- [ ] Migration 57 : deux blocs distincts :
  1. Sur `combat_actions` : ajouter `fire_mode TEXT`, `bullet_count SMALLINT`, `fire_mode_bonus_comp SMALLINT`, `fire_mode_bonus_dmg SMALLINT`
  2. Sur `combat_roster` : ajouter `state_character JSONB NOT NULL DEFAULT '{}'` (PC39 — flags combinables is_rushed, is_stunned, is_rooted, is_delayed, …)
- [ ] `CombatActionWindow.jsx` — sélection cible (liste tokens roster) + sélection arme (MG/MD fetch char_inventory)
- [ ] `CombatActionWindow.jsx` — mode de tir : `allowCC`/`allowAuto` depuis `ref_equipment.fire_mode` ; CPC (simple / répétition + slider / sous-choix 7+10 balles courte portée) ou AUTO (rafale courte / longue + slider / multi-cibles) ; stocker `fire_mode`, `bullet_count`, `fire_mode_bonus_comp`, `fire_mode_bonus_dmg`
- [ ] `server/src/socket/index.js` — COMBAT_ACTION_DECLARE : guard PC22 (weapon_inv_id slot MG ou MD) + guard target_token_id non-null si assault + guard PC23 (compétence "Tir Automatique") si AUTO
- [ ] COMBAT_ACTION_DECLARE `action_key='rushed'` : en plus du INSERT combat_actions, UPDATE combat_roster :
  ```js
  await db('combat_roster').where({ campaign_id, token_id })
    .update({ state_character: db.raw('state_character || ?::jsonb', [JSON.stringify({ is_rushed: true })]) })
  ```
  ⚠️ PC39 : merge JSONB, jamais remplacement direct.
- [ ] Stocker `target_token_id`, `fire_mode`, `bullet_count`, `fire_mode_bonus_comp`, `fire_mode_bonus_dmg` dans `combat_actions`
- [ ] Vérifier DB : `target_token_id` + `weapon_inv_id` + `fire_mode` non-null pour assault déclaré ; `state_character = {"is_rushed":true}` si rushed déclaré

**Sprint 7.2 — CombatModifiersWindow.jsx (NOUVEAU)**
- [ ] Créer `client/src/components/CombatModifiersWindow.jsx`
- [ ] Section joueur (lecture seule) : `is_rushed` lu depuis `combat_roster.state_character.is_rushed` (**jamais** depuis combat_actions — PC28), récap mode de tir (`fire_mode` + `bullet_count` + `fire_mode_bonus_comp` depuis `combat_actions`)
- [ ] Section GM : Portée (select 5 paliers), Situation (multi-select), Taille cible (select)
- [ ] Monter dans CombatOverlay quand phase=RÉSOLUTION + assault déclaré dans myActions
- [ ] GM émet `COMBAT_ACTION_CONFIRM { tokenId, confirmedModifiers: { portee, situation[], taille } }`

**Sprint 7.3 — Résolution Assaut (serveur)**
- [ ] `COMBAT_ACTION_CONFIRM` branche assault — guard weapon_inv_id (PC22)
- [ ] Exporter `resolveWoundInsertion` + `isShockTestRequired` depuis `char-sheet.js` (actuellement fonctions locales)
- [ ] Exporter `SLOT_TO_WOUND_LOCATION` depuis `shared/armorConstants.js` (cf. mapping table V1 section 6)
- [ ] Fetch tireur (BUG C — chaîne skill_id complète) :
  - `attrs + archetype → genotypeRow`
  - `weapon_inv_id → char_inventory.item_id → ref_equipment_skill_assoc WHERE item_id = X → skill_id → char_skills + ref_skills` → `charSkillRow + refSkill`
  - `char_inventory` : snapshot arme (pour `ref_damage_h`, `ref_range`) + armures équipées slot MG/MD
  - `char_inventory` tous items `container != 'Coffre'` → `totalWeight` pour `calcEncumbrancePenalty` (L9 — fetch séparé, ne pas oublier)
  - `character_wounds`
- [ ] Fetch cible : `target_token_id` → token roster → `character_id` → `char_sheet WHERE character_id = X` → **`char_sheet_id_cible`** + `char_attributes + char_archetype → genotypeRow` + `char_inventory` (armures équipées) — garder `for_na_cible`, `con_na_cible`, `vol_na_cible` (pour `calcResistanceDommages` + `calcSeuils`)
- [ ] `calcSkillTotal` tireur + `calcCarenceArmure` + `calcWoundPenalty` + `calcEncumbrancePenalty(totalWeight, forNA_tireur)` → effectiveMalus
- [ ] Définir `PORTEE_MOD_COMP = { bout_portant:5, courte:0, moyenne:-5, longue:-10, extreme:-15 }` (L10)
- [ ] Modificateurs de Compétence : `PORTEE_MOD_COMP[confirmedModifiers.portee]` + sum(situation[]) + taille + `(rosterTireur.state_character?.is_rushed ? -5 : 0)` (BUG B — lire state_character, jamais combat_actions) + `fire_mode_bonus_comp` − carence (PC26)
- [ ] Jet 1D20 attaque via `parseDice('1d20')` côté serveur
- [ ] `chancesDeReussite = skillTotal + totalModComp + effectiveMalus`
- [ ] Si succès : jet 1D20 localisation → table distance V1 → `slotCode` (T/C/BD/BG/JD/JG) → `location = SLOT_TO_WOUND_LOCATION[slotCode]`
- [ ] `calcResistanceArmure(armures cible filtrées slot === slotCode)` → ETQ + PRT (PC29)
- [ ] `mr = chancesDeReussite − roll` (positif sur succès — cf. `socket/index.js` ligne 999). `getMrTable()` + `getModifier()` **déjà définis** dans `socket/index.js` lignes 41-55, réutiliser directement.
- [ ] `isShortRange = confirmedModifiers.portee ∈ ['bout_portant', 'courte']`
- [ ] `modDegatsMode = isShortRange ? fire_mode_bonus_dmg : 0`
- [ ] Dégâts bruts = `parseDice(weapon.ref_damage_h) + modDomAttaque + modDegatsMode` (BUG A — PC40 : jamais `ref_degats`)
- [ ] `calcResistanceDommages(for_na_cible, con_na_cible)` → RD
- [ ] Dégâts nets = `max(0, bruts − ETQ − RD)`
- [ ] Gravité : `nets ≥ 30 → mortelle (is_lethal=true) | ≥ 25 → mortelle | ≥ 20 → critique | ≥ 15 → grave | ≥ 10 → moyenne | ≥ 5 → légère | sinon → aucune`
- [ ] Si gravité ≠ aucune : `resolveWoundInsertion(trx, char_sheet_id_cible, location, severity)` (P49 : réponse promoted → GET /wounds complet)
- [ ] Test de Choc si `isShockTestRequired(severity, location)` :
  - [ ] Écrire `getShockMalus(severity, location, is_lethal)` dans `charStats.js` — is_lethal + bras/jambes → −10 (Membre détruit), sinon table p.235
  - [ ] `calcSeuils(for_na_cible, con_na_cible, vol_na_cible)` → seuils
  - [ ] Comparer `roll1D20` à `etourdissement + shockMalus` et `inconscience + shockMalus`
  - [ ] Inclure `shockResult: { triggered, roll, outcome }` dans broadcast
- [ ] Broadcast `WS.COMBAT_ATTACK_RESULT { tireurId, cibleId, localisation, degautsBruts, degatsNets, severity, is_lethal, isSuccess, roll, chancesDeReussite, shockResult }`

**Client :**
- [ ] Affichage `COMBAT_ATTACK_RESULT` dans `CombatOverlay` (résumé texte : qui a touché qui, localisation, dégâts nets)

**Checkpoints :**
- [ ] SR sans erreur
- [ ] Joueur déclare Assaut : cible + arme sélectionnables, DB target_token_id + weapon_inv_id non-null
- [ ] Résolution : jet attack affiché, localisation tirée, dégâts nets calculés
- [ ] 1 blessure avec gravité correcte enregistrée en DB si dégâts nets ≥ 5
- [ ] COMBAT_ATTACK_RESULT visible toute la room
- [ ] Carence FOR > 0 → malus appliqué sur jet
- [ ] Test de Choc déclenché si Grave Corps/Tête ou Critique/Mortelle

---

### Sprint 7.5 — Décompte munitions

**Objectif :** Décrémenter le stock de munitions/chargeur dans `char_inventory` après chaque tir.

**Avant de coder :**
- [ ] Lire `char_inventory` schema — colonnes quantity, item_id → ref_equipment
- [ ] Identifier comment les munitions sont liées à l'arme (chargeur séparé ou item arme ?)
- [ ] Confirmer la règle : si `quantity < bullet_count` → refus ou tir partiel ? (arbitrage GM)

**Serveur :**
- [ ] Au moment du `COMBAT_ACTION_CONFIRM` assault (après résolution, qu'il y ait succès ou non) : décrémenter `char_inventory.quantity` de `bullet_count` pour l'item munitions associé à l'arme
- [ ] Guard : `quantity IS NULL` ou flag `is_infinite` → skip décompte (munitions illimitées)
- [ ] Guard : `quantity < bullet_count` → comportement à définir (PO à ouvrir avant ce sprint)
- [ ] Broadcast `INVENTORY_UPDATED` pour la room si stock modifié

**Checkpoints :**
- [ ] Tir de 3 balles (rafale courte) → stock chargeur −3 visible dans la fiche
- [ ] Stock = 0 → arme indisponible pour prochain Assaut (guard COMBAT_ACTION_DECLARE)
