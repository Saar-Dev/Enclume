# Chantier 11 — Système de Combat Polaris
> Document de planification — Session 51
> Statut : Planification — aucun code produit
> Dépendances : Chantier 10 sprint 4 (char_weapon) — non encore implanté

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
| Calculs serveur | `parseDice`, `calcREA`, `calcWoundPenalty`, `calcEncumbrancePenalty`, `calcResistanceDommages` — tous disponibles dans `charStats.js` |
| **Architecture réseau** | **WS pur — pas de REST pour le combat. Pattern identique aux entités interactables** |
| **Actions déclarées** | **Table `combat_actions` séparée — pas de JSONB dans `combat_roster`. Permet ORDER BY initiative_score et extensibilité V2** |
| **Exclusivité actions** | **Aucune validation en phase Annonce — le GM arbitre en Résolution. Cohérent avec règle LdB p.218** |

---

## 3. Schéma SQL (migration 52)

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
  surprise_roll    INT    NULLABLE  -- résultat dé surprise, visible GM uniquement
  base_ini         INT        -- REA calculé au COMBAT_START, figé
  initiative       INT        -- base_ini ± modificateurs déclarés
  status           TEXT  CHECK IN ('active','done')  -- 'delayed' reporté V2
  has_announced    BOOLEAN DEFAULT false  -- dérivé : true si ≥1 action dans combat_actions
  has_resolved     BOOLEAN DEFAULT false
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

-- Actions déclarées — une ligne par action (principale ou micro)
-- Remplace declared_action JSONB — permet ORDER BY initiative_score et extensibilité V2
combat_actions
  id               UUID  PK DEFAULT gen_random_uuid()
  campaign_id      UUID  FK → campaigns.id ON DELETE CASCADE
  token_id         UUID  FK → tokens.id ON DELETE CASCADE
  type             TEXT  CHECK IN ('assault','move_short','move_long','micro','skip')
  is_micro         BOOLEAN DEFAULT false
  initiative_score INT        -- base_ini + Modificateurs d'Initiative, calculé à la déclaration
  target_token_id  UUID  NULLABLE
  target_pos       JSONB NULLABLE  -- { x, y, z }
  weapon_inv_id    UUID  NULLABLE  -- null en V1 (sprint 4 non livré)
  modifiers        JSONB  -- { is_rushed, fire_mode, bullet_count, ini_mod }
  status           TEXT  CHECK IN ('pending','resolved','skipped') DEFAULT 'pending'
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ
```

---

## 4. Schéma des actions déclarées (`combat_actions`)

Les actions sont stockées dans la table `combat_actions` — une ligne par action, principale ou micro. La phase Résolution lit cette table avec `ORDER BY initiative_score DESC`.

**Types d'actions :**
| Type | Description | Exclusif | Modificateur d'Initiative |
|---|---|---|---|
| `assault` | Attaque sur une cible | Non | 0 (ou +3 si `is_rushed`) |
| `move_short` | Déplacement ≤3m | Non | -3 |
| `move_long` | Déplacement >3m | Oui (GM arbitre) | 0 |
| `micro` | Action secondaire (Dégainer, Saisir, Parler) | Non | -3 (typique) |
| `skip` | Tour passé par GM | — | — |

**Champ `modifiers` JSONB :**
```json
{
  "is_rushed": false,
  "fire_mode": "RC | RL | null",
  "bullet_count": null,
  "ini_mod": -3
}
```

**Règles :**
- `weapon_inv_id` : null en V1 tant que sprint 4 non livré — guard explicite côté serveur
- `is_rushed` : Modificateur d'Initiative +3, Modificateur de Compétence -5 — les deux lus depuis `modifiers`, jamais recalculés
- Modificateurs GM (portée, taille, obscurité, couverture) : arrivent en phase Résolution via `COMBAT_ACTION_CONFIRM`, jamais dans `combat_actions`
- Aucune validation portée/ligne de vue en Annonce — affichage uniquement, GM arbitre en Résolution
- Exclusivité `move_long` : pas de validation technique — le GM invalide en Résolution si irréaliste (LdB p.218)

**Micro-actions documentées (aide à la décision joueur, pas contrainte technique) :**
| Action | Modificateur d'Initiative |
|---|---|
| Dégainer une arme | -3 |
| Saisir un objet à portée | -3 |
| Prononcer une phrase courte | -3 |
| Saisir un objet à quelques pas | -5 à -10 |

---

## 5. Events WS — famille COMBAT_* (shared/events.js)

Pour chaque event : mode d'émission documenté.

```js
// Démarrage / arrêt
COMBAT_START:         'combat:start'          // joueur → serveur (GM only)
COMBAT_STARTED:       'combat:started'        // io.to(room) — roster complet + phase
COMBAT_END:           'combat:end'            // joueur → serveur (GM only)
COMBAT_ENDED:         'combat:ended'          // io.to(room) — reset client

// Sync reconnexion
COMBAT_STATE_SYNC:    'combat:state_sync'     // socket.emit — joueur qui rejoint en cours de combat

// Roster
COMBAT_ROSTER_UPDATED:'combat:roster_updated' // io.to(room)

// Phases
COMBAT_PHASE_CHANGED: 'combat:phase_changed'  // io.to(room) — nouvelle phase + données
COMBAT_SLOT_ADVANCED: 'combat:slot_advanced'  // io.to(room) — index slot courant + tokenId actif

// Surprise
COMBAT_SURPRISE_ROLL: 'combat:surprise_roll'  // socket.emit → joueur surpris uniquement
COMBAT_SURPRISE_RESULT:'combat:surprise_result'// joueur → serveur

// Annonce
COMBAT_ACTION_DECLARE:'combat:action_declare' // joueur → serveur
COMBAT_ACTION_DECLARED:'combat:action_declared'// io.to(room) — mise à jour roster
COMBAT_SKIP_PLAYER:   'combat:skip_player'    // GM → serveur — force has_announced=true
COMBAT_TURN_SKIPPED:  'combat:turn_skipped'   // io.to(room) — notification chat "tour de X passé"

// Résolution
COMBAT_ACTION_WINDOW: 'combat:action_window'  // socket.emit → joueur actif uniquement
COMBAT_ACTION_CONFIRM:'combat:action_confirm' // joueur + GM → serveur — modificateurs finaux
COMBAT_ATTACK_RESULT: 'combat:attack_result'  // io.to(room) — résumé localisation + dégâts

// Retard — V2/V3
// COMBAT_ACTION_DELAY et COMBAT_ACTION_ACTIVATE réservés V2
```

---

## 6. Découpage en sprints

---

### Sprint 1 — Infrastructure & Roster

**Objectif :** le GM peut démarrer un combat, constituer le roster, gérer la surprise. Fondations uniquement — rien de jouable encore.

**Fichiers créés :**
- Migration `52_combat.js` — tables `combat_state` + `combat_roster` + `combat_actions`
- `shared/events.js` — ajout famille `COMBAT_*`
- `client/src/stores/combatStore.js` — state Zustand dédié
- `client/src/components/CombatOverlay.jsx` — conteneur fixed z-index
- `client/src/components/CombatRosterWindow.jsx` — fenêtre roster GM

**Fichiers modifiés :**
- `server/src/socket/index.js` — handlers `COMBAT_START`, `COMBAT_END`, `COMBAT_SKIP_PLAYER`, `COMBAT_SURPRISE_RESULT` + `SESSION_JOIN` (emit `COMBAT_STATE_SYNC` si combat actif)
- `client/src/pages/SessionPage.jsx` — `mode = 'combat'`, bypass démontage Canvas, handlers WS `COMBAT_*`

**Handlers serveur — détail :**

`COMBAT_START` (GM only) :
- Guard : `socket.role !== 'gm'`
- Guard : tokens présents sur battlemap → si 0, `socket.emit('error', { message: 'Aucun personnage sur la carte' })`
- Guard : `combat_state` existant → message explicite
- Calcul `base_ini` pour chaque token : chaîne `token.character_id → char_sheet → char_attributes → calcREA(ada_na, per_na)`
- Fallback `base_ini = 0` si `char_sheet` introuvable (PNJ sans fiche)
- Tri roster : `initiative DESC`, égalité → `Math.random()`
- INSERT `combat_state` + INSERT `combat_roster` (bulk)
- `io.to(room).emit(COMBAT_STARTED, { roster, phase: 'ROSTER' })`

`COMBAT_END` (GM only) :
- DELETE `combat_roster WHERE campaign_id`
- DELETE `combat_state WHERE campaign_id`
- Cleanup timers actifs (Map `combatTimers`)
- `io.to(room).emit(COMBAT_ENDED)`

`SESSION_JOIN` (ajout) :
- Après join existant : `SELECT combat_state WHERE campaign_id`
- Si combat actif : `socket.emit(COMBAT_STATE_SYNC, { combatState, roster })`

Surprise :
- Tokens `is_surprised = true` → `socket.emit(COMBAT_SURPRISE_ROLL)` vers chaque joueur concerné
- PNJ surpris → jet automatique calculé serveur directement
- `COMBAT_SURPRISE_RESULT` reçu → calcul `initiative` → UPDATE `combat_roster` → `io.to(room).emit(COMBAT_ROSTER_UPDATED)`
- `COMBAT_SKIP_PLAYER` (GM) → force `has_announced = true` sur le joueur ciblé

**Timer d'action :**
- Map `combatTimers` déclarée hors `initSocket` — pattern identique à `pendingEntityActions`
- Si `action_timer_sec > 0` : `setTimeout` par joueur en attente, stocké dans la Map
- Expiration → `has_announced = true`, `declared_action = { type: 'delayed' }`, avance au joueur suivant
- `COMBAT_END` → `clearTimeout` sur tous les timers actifs de la campagne

**Client — SessionPage :**
- `handleModeChange` : si `newMode === 'combat'` ou `mode === 'combat'` → skip `setCanvasVisible(false)`
- Handlers : `COMBAT_STARTED` → `setMode('combat')` + store, `COMBAT_ENDED` → `setMode('play')` + reset store + fermeture overlay

**Client — combatStore :**
```js
{
  phase: null,            // 'ROSTER'|'ANNOUNCEMENT'|'RESOLUTION'|null
  roster: [],             // [{tokenId, initiative, status, has_announced, ...}]
  currentTurn: 1,
  activeSlotIdx: 0,
  // Actions
  setCombatState, updateRoster, resetCombat
}
```

---

### Sprint 2 — Tour de jeu & Timeline

**Objectif :** un tour complet fonctionne de bout en bout — annonce puis résolution — sans jets d'attaque.

**Fichiers créés :**
- `client/src/components/CombatTimeline.jsx`
- `client/src/components/CombatActionWindow.jsx` — fenêtre joueur phase Annonce
- `client/src/components/CombatPnjPanel.jsx` — tableau GM PNJ

**Fichiers modifiés :**
- `server/src/socket/index.js` — handlers phase Annonce + Résolution
- `client/src/pages/SessionPage.jsx` — handlers `COMBAT_PHASE_CHANGED`, `COMBAT_SLOT_ADVANCED`

**Phase Annonce — ordre initiative croissante :**
- `COMBAT_PHASE_CHANGED { phase: 'ANNOUNCEMENT' }` → io.to(room)
- Serveur envoie `COMBAT_ACTION_WINDOW` → socket du joueur le plus lent
- `CombatActionWindow` — actions disponibles :
  - "Assaut" (guard : sprint 4 requis, sinon grisé avec message)
  - "Déplacement court ≤3m" (Modificateur d'Initiative -3, non exclusif)
  - "Déplacement long >3m" (aucun Modificateur d'Initiative, exclusif selon LdB — GM arbitre en Résolution)
  - "Action précipitée" — cochable en complément (+3 Modificateur d'Initiative, -5 Modificateur de Compétence en Résolution)
  - Micro-actions : Dégainer (-3 INI), Saisir à portée (-3 INI), Parler (-3 INI) — toujours disponibles
  - "Retarder son action" → grisé, tooltip "Disponible V2"
- Aucune validation exclusivité côté client ni serveur — le GM arbitre en Résolution (LdB p.218)
- Aucune validation portée/ligne de vue en Annonce — affichage aura seulement
- Sélection déplacement → coloration cases portée Canvas3D (réutilise logique ghost existante)
- `COMBAT_ACTION_DECLARE` → serveur : INSERT dans `combat_actions` + UPDATE `has_announced = true` sur `combat_roster`
- Si `is_rushed` : UPDATE `initiative = initiative + 3` sur `combat_roster`, re-tri, `COMBAT_ROSTER_UPDATED`
- Miroir GM : élément visible par joueur en attente + bouton "Passer le tour" (`COMBAT_SKIP_PLAYER`)
- `COMBAT_SKIP_PLAYER` → INSERT `combat_actions { type: 'skip' }`, UPDATE `has_announced = true`, broadcast `COMBAT_TURN_SKIPPED` → message chat
- PNJ : `CombatPnjPanel` — tableau, une ligne par PNJ, colonnes = actions, GM déclare librement sans contrainte de temps
- Détection "tous announced" : serveur vérifie `has_announced` de tous les participants après chaque `COMBAT_ACTION_DECLARE` / `COMBAT_SKIP_PLAYER` → auto-transition RESOLUTION

**Phase Résolution — ordre initiative décroissante :**
- `COMBAT_PHASE_CHANGED { phase: 'RESOLUTION' }` → io.to(room)
- Défilement slots : `COMBAT_SLOT_ADVANCED { activeSlotIdx, tokenId }` → io.to(room)
- `CombatActionWindow` récapitulatif : action déclarée + bouton "Agir"
- Déplacement : `isCaseOccupied` Redis + premier arrivé bloque
- Slot `delayed` : bouton "Activer" visible pendant toute la phase → insertion au slot courant
- Fin de tour : UPDATE bulk `has_announced = false`, `has_resolved = false`, `current_turn + 1` → retour ANNOUNCEMENT
- UPDATE en une seule requête — pas de boucle (risque race condition)

**CombatTimeline :**
- Composant séparé, monté au-dessus du Canvas (dans `CombatOverlay`)
- Tokens dans l'ordre d'initiative, illustration 2D (`portrait_url` → fallback initiales)
- Curseur sur slot actif (`activeSlotIdx`)
- Token `delayed` : grisé
- Tooltip au survol : Nom / Initiative / Modificateurs

---

### Sprint 3 — Résolution & Dégâts

**Objectif :** jets d'attaque, dégâts et blessures résolus.

**Fichiers créés :**
- `client/src/components/CombatModifiersWindow.jsx` — fenêtre bonus/malus GM+joueur

**Fichiers modifiés :**
- `server/src/socket/index.js` — handlers `COMBAT_ACTION_CONFIRM`, calcul dégâts
- `shared/events.js` — aucun ajout (déjà prévu)

**Skillcheck attaque :**
- Pattern identique à `ENTITY_ACTION_RESOLVE` dans `socket/index.js`
- `COMBAT_ACTION_WINDOW` → joueur actif : récapitulatif declared_action
- `CombatModifiersWindow` affiché joueur + GM simultanément :

  **Modificateurs de Portée** (sous-catégorie Modificateur de Compétence — LdB p.228) :
  | Palier | Modificateur Compétence |
  |---|---|
  | Bout portant | +5 |
  | Courte portée | +0 |
  | Moyenne portée | -5 |
  | Longue portée | -10 |
  | Portée extrême | -15 |

  **Modificateurs de Situation** (GM uniquement — LdB p.228) :
  | Situation | Modificateur Compétence |
  |---|---|
  | Cible immobile | +3 |
  | Cible à l'allure moyenne | -3 |
  | Cible à l'allure rapide | -5 |
  | Cible à l'allure maximale | -7 |
  | Tireur à l'allure lente | -3 |
  | Tireur à l'allure moyenne | -5 |
  | Tireur à l'allure rapide | -7 |
  | Tireur à l'allure maximale | Tir impossible |
  | Couverture partielle (50%) | -3 |
  | Couverture importante (75%) | -5 |
  | Obscurité légère | -3 |
  | Obscurité importante | -5 |
  | Obscurité totale | Tir impossible |

  **Modificateurs de Taille** (GM uniquement — LdB p.228) :
  | Taille cible | Modificateur Compétence |
  |---|---|
  | Minuscule (~30 cm) | -10 |
  | Très petite (~50 cm) | -5 |
  | Petite (~1 m) | -3 |
  | Moyenne (humaine) | +0 |
  | Grande (~3 m) | +3 |
  | Très grande (~5 m) | +5 |
  | Énorme (~7 m) | +10 |
  | Gigantesque (10 m+) | +15 |

  **Modificateurs d'Action** (joueur, modifiables GM) :
  - Action précipitée : -5 Modificateur de Compétence (déclaré en Annonce via `is_rushed`)
  - Tir instinctif : -5 Modificateur de Compétence
  - Mode RC : +3 Modificateur de Compétence OU +5 Modificateur de Dégâts (portée courte/bout portant)
  - Mode RL : +2 Modificateur de Compétence ET +2 Modificateur de Dégâts par groupe de 5 balles (portée courte uniquement)
  - Guard rafale : RC/RL limités par compétence "Tir Automatique" (vérification côté serveur)

- GM valide en dernier → `COMBAT_ACTION_CONFIRM { modifiers }`
- Jet 1d20 côté serveur via `parseDice`

**Terminologie stricte — règle absolue :**
| Terme | Définition |
|---|---|
| **Modificateur d'Initiative** | Affecte l'ordre des actions dans la timeline (ex: +3 Se précipiter, -3 Déplacement court) |
| **Modificateur de Compétence** | Affecte le jet de réussite (ex: -5 Action précipitée, -5 Moyenne portée) |
| **Modificateur de Portée** | Sous-catégorie de Modificateur de Compétence liée à la distance |
| **Modificateur de Dégâts** | Affecte les dégâts infligés (ex: +5 RC portée courte, +2/5 balles RL) |
> ⚠️ Ne jamais utiliser "Modificateur" seul — toujours préciser le type.

**Calcul dégâts :**
```
Dégâts nets = (dégâts arme + modificateur MR) - (armure localisation + ResDom cible)
```
- Modificateur MR : `getModifier(mrTable, mr)` — table `polaris_mr` déjà en base (migration 46)
- Armure localisation : `char_inventory` JOIN `ref_equipment` sur slot équipé + localisation touchée
- `ResDom` : `calcResistanceDommages(for_na, con_na)` — exporté dans `charStats.js` ✅

**Localisation V1 — distance uniquement (LdB p.228) :**
```
Jet 1D20 :
1-2   → Tête
3-8   → Corps
9-11  → Bras Droit
12-14 → Bras Gauche
15-17 → Jambe Droite
18-20 → Jambe Gauche
```

**Localisation V2 — contact (LdB p.228, table séparée) :**
```
Jet 1D20 :
1-4   → Tête
5-10  → Corps
11-13 → Bras Droit
14-16 → Bras Gauche
17-18 → Jambe Droite
19-20 → Jambe Gauche
```

- Visée précise (optionnelle) : malus Modificateur de Compétence (Tête -7, Corps -3, Bras -7, Jambes -5)

**Blessures :**
- 1 blessure par tranche de 5 dégâts nets
- Réutilise `character_wounds` (migration 49) + `WOUND_ADDED` (déjà dans `shared/events.js`)
- `calcWoundPenalty` depuis `charStats.js` — impacte immédiatement l'initiative du blessé
- Jet de Choc si dégâts tête : seuil = `seuilEtourdissement` du personnage touché (⚠ valeur à confirmer LdB)

**Broadcast résultats :**
- `COMBAT_ATTACK_RESULT` → io.to(room) : résumé localisation + dégâts bruts + dégâts nets + blessure
- Cible : fenêtre "Dégâts subis" dans `CombatOverlay`

---

## 7. Points ouverts — à résoudre avant le sprint concerné

| # | Question | Sprint | Impact |
|---|---|---|---|
| PO1 | `shared/woundConstants.js` — valeurs exactes `WOUND_PENALTIES` ? | 1 | `calcWoundPenalty` dans handler |
| PO2 | `char_weapon` / portées — schéma exact ? | 2 | Phase Annonce assaut + Modificateurs de Portée |
| PO3 | Seuil jet de Choc tête — valeur LdB exacte ? | 3 | Blessures tête |
| PO4 | `is_rushed` et initiative : retri roster et rebroadcast après chaque déclaration ? | 2 | Timeline phase Annonce |
| PO5 | `weaponInventoryId` en V1 : slot `HAND_MAIN` implicite ou ID obligatoire ? | 2 | `combat_actions.weapon_inv_id` |
| PO6 | `combatStore` : où est-il initialisé si le joueur rejoint en cours de combat ? | 1 | `COMBAT_STATE_SYNC` handler |
| ~~PO7~~ | ~~REST vs WS~~ | — | ✅ Clôturé : WS pur |
| ~~PO8~~ | ~~JSONB vs table~~ | — | ✅ Clôturé : table `combat_actions` |
| ~~PO9~~ | ~~Exclusivité micro-actions~~ | — | ✅ Clôturé : arbitrage GM en Résolution |

---

## 8. Pièges anticipés

| Code | Description |
|---|---|
| PC11 | `campaign_id` PK sur `combat_state` — un seul INSERT possible, doublon → erreur SQL explicite |
| PC12 | `socket.data.role` pour cibler GM via `fetchSockets()` — pattern PE2 |
| PC13 | `has_announced` détection "tous announced" : inclure les joueurs skippés (type `skip` dans `combat_actions`) |
| PC14 | Reconnexion en cours de combat : `COMBAT_STATE_SYNC` émis dans `SESSION_JOIN` si `combat_state` existe |
| PC15 | `handleModeChange` : bypass `setCanvasVisible(false)` si `newMode === 'combat'` ou `mode === 'combat'` |
| PC16 | `combatTimers` Map déclarée hors `initSocket` — même pattern que `pendingEntityActions` |
| PC17 | Timer 0 = infini : guard `if (action_timer_sec === 0) return` — ne jamais appeler `setTimeout(fn, 0)` |
| PC18 | Fin de tour reset bulk : une seule requête UPDATE sur `combat_roster`, pas de boucle — risque race condition |
| PC19 | `COMBAT_END` : `clearTimeout` sur tous les timers actifs de la campagne avant DELETE |
| PC20 | `portrait_url` nullable : fallback initiales côté client dans `CombatTimeline` |
| PC21 | `calcREA` nécessite `ada_na` + `per_na` — toujours via `calcAttributeNA(attrs, 'ADA', genotypeRow)` et idem PER |
| PC22 | Guard `weapon_inv_id` null : action Assaut grisée en V1 si sprint 4 absent — message explicite |
| PC23 | Modificateurs de Compétence rafale (RC/RL) : vérification compétence "Tir Automatique" côté serveur uniquement |
| PC24 | Terminologie : ne jamais écrire "Modificateur" seul — toujours préciser Initiative / Compétence / Portée / Dégâts |
| PC25 | `surprise_roll` : visible GM uniquement — ne jamais broadcaster à toute la room |
| PC26 | Modificateurs de Portée appliqués uniquement au Modificateur de Compétence — jamais aux dégâts (sauf règle RC/RL explicite) |
| PC27 | Phase Résolution : tri `combat_actions ORDER BY initiative_score DESC` — jamais en mémoire client |
| PC28 | `combat_actions` nettoyées en fin de tour (DELETE ou status reset) — sinon accumulation entre tours |

---

## 9. Composants React — liste complète chantier 11

| Composant | Rôle | Sprint |
|---|---|---|
| `CombatOverlay.jsx` | Conteneur fixed z-index, parent de toutes les fenêtres combat | 1 |
| `CombatRosterWindow.jsx` | Fenêtre roster GM : liste tokens, cases Participe/Surpris | 1 |
| `CombatTimeline.jsx` | Barre tokens ordonnés par initiative, curseur slot actif | 2 |
| `CombatActionWindow.jsx` | Fenêtre joueur : Annonce + Résolution | 2 |
| `CombatPnjPanel.jsx` | Tableau GM PNJ : une ligne/PNJ, colonnes actions | 2 |
| `CombatModifiersWindow.jsx` | Fenêtre bonus/malus GM+joueur avant jet d'attaque | 3 |

**`combatStore` — shape complète :**
```js
{
  phase: null,         // 'ROSTER'|'ANNOUNCEMENT'|'RESOLUTION'|null
  roster: [],          // [{ tokenId, baseIni, initiative, status, hasAnnounced, hasResolved, isSurprised }]
  actions: [],         // [{ id, tokenId, type, initiativeScore, status, ... }] — depuis combat_actions
  currentTurn: 1,
  activeSlotIdx: 0,
  // Actions Zustand
  setCombatState,      // init depuis COMBAT_STARTED ou COMBAT_STATE_SYNC
  updateRoster,        // depuis COMBAT_ROSTER_UPDATED
  addAction,           // depuis COMBAT_ACTION_DECLARED
  advanceSlot,         // depuis COMBAT_SLOT_ADVANCED
  resetCombat,         // depuis COMBAT_ENDED
}
```

---

## 10. Références

| Source | Contenu utilisé |
|---|---|
| LdB Polaris p.213-214 | Séquence tour de combat, initiative, surprise |
| LdB Polaris p.209 | Table MR → modificateur (migration 46) |
| LdB Polaris p.218-220 | Actions simples, actions complexes, combinaison d'actions, micro-actions |
| LdB Polaris p.228 | Modificateurs de Portée, Situation, Taille, tables localisation distance et contact |
| LdB Polaris p.404 | Formule jet, difficulty_dc |
| `charStats.js` | `calcREA`, `calcResistanceDommages`, `calcWoundPenalty`, `calcEncumbrancePenalty` |
| Migration 46 | Table `polaris_mr` en base |
| Migration 49 | Table `character_wounds` |
| `shared/events.js` session 51 | Events existants — base pour la famille COMBAT_* |
| `socket/index.js` session 51 | Pattern handlers, pendingEntityActions, parseDice |
