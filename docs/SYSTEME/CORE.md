# SYSTEME/CORE.md — Auth, Ownership, Stores, WebSocket
> Source : SYSTEME.md §1–§4
> Lire pour : toute fonctionnalité touchant auth, tokens, stores Zustand, événements WS

---

## Auth — ce que contient `user`

### Côté serveur
Le JWT est signé avec `{ id, email, username }` — **pas `color`**.
`req.user` (injecté par `middleware/auth.js`) contient : `{ id, email, username, iat, exp }`.
`color` n'est jamais dans le JWT. Pour l'avoir côté serveur, il faut relire la DB.

### Côté client
Au montage de l'app (`App.jsx`), `GET /auth/me` est appelé.
La réponse retourne `{ id, email, username, color }` — depuis la DB, pas le JWT.
`authStore.user` contient donc toujours : `{ id, email, username, color }`.

**Piège :** ne jamais supposer que `user.color` vient du JWT — il vient de GET /auth/me.
**Piège :** `isLoading: true` par défaut dans authStore — les routes protégées attendent ce flag avant de rendre.

### Flux register / login / me
```
POST /auth/register { email, password, username }
  → bcrypt.hash(password, 12) → randomColor() → INSERT users
  → jwt.sign { id, email, username } → res.cookie('token', ...)

POST /auth/login { email, password }
  → bcrypt.compare → jwt.sign → res.cookie('token', ...)

GET /auth/me  [requireAuth]
  → db('users').select([id, email, username, color]) → res.json({ user })
  Source de vérité côté client — appelé au montage de App.jsx.
```

### JWT — règles immuables
- Contient uniquement : `{ id, email, username }` — `updated_at` jamais dans le JWT (P14)
- Durée : 7 jours. Cookie : `httpOnly, sameSite=lax, secure en production`
- Si username/email change via PUT /users/me → nouveau cookie JWT émis dans la réponse

---

## Ownership des tokens — règle fondamentale (P1)

### La colonne `owner_id` est morte
**Ne jamais utiliser `token.owner_id`. Sans exception.**

### L'ownership réel passe par character_id
```javascript
// Serveur (socket/index.js, TOKEN_MOVE) :
const character = await db('characters').where({ id: token.character_id }).first()
const isOwner = character?.user_id === socket.user.id

// Client (Canvas3D, handleDragStart) :
const character = characters.find(c => c.id === token.character_id)
if (!character || character.user_id !== user?.id) return
```
**Si `token.character_id` est null → seul le GM peut déplacer ce token.**

---

## Stores Zustand — qui possède quoi

| Store | Données | Qui lit | Qui écrit |
|---|---|---|---|
| `authStore` | user, isLoading | partout | App.jsx (GET /me), users.js route |
| `tokenStore` | tokens[] | Canvas3D (Scene), Sidebar | SessionPage (WS handlers) |
| `characterStore` | characters[], members[], isGm | Canvas3D, Sidebar, SessionPage | SessionPage (loadSession, WS) |
| `mapStore` | battlemap, battlemaps | Canvas3D, Editor3D, SessionPage | SessionPage (loadSession, MAP_SWITCH) |
| `sessionStore` | messages[], onlineUsers | Sidebar | SessionPage (WS handlers) |
| `entityStore` | entities[], blueprints{} | Canvas3D, Editor3D, SessionPage | SessionPage (loadSession, MAP_SWITCH, WS) |
| `combatStore` | phase, roster, activeSlotIdx, actions, currentTurn | CombatOverlay, CombatTimeline, CombatActionWindow | SessionPage (WS handlers) — voir COMBAT.md pour `state_character` JSONB |

### combatStore — détail shapes

```javascript
// Phase : 'ROSTER' | 'ANNOUNCEMENT' | 'RESOLUTION' | null
// currentTurn : numéro de tour (commence à 1)

// roster[] — entrée :
{ id, token_id, base_ini, initiative, status, has_announced, has_resolved, is_surprised,
  state_character /* JSONB — voir COMBAT.md */ }

// actions[] — entrée :
{ id, token_id, type, initiative_score, status,
  action_key,        // 'assault' | 'move' | ...
  weapon_inv_id,     // char_inventory.id — arme déclarée
  target_token_id,   // token cible
  fire_mode,         // 'CC' | 'RC' | 'RL'
  ...                // autres champs selon type
}

// Actions store :
setCombatState({ phase, roster, actions, currentTurn, activeSlotIdx })
updateRoster(updatedRoster)
addAction(action)
setActions(actions)
advanceSlot(activeSlotIdx)
setPhase(phase)
markTokenAnnounced(tokenId, initiative)
resetCombat()
```

### entityStore — détail
```javascript
{ entities: [], blueprints: {} }
// blueprints = { [blueprintId]: blueprint } — accumulé, jamais vidé entre cartes
// entities = instances de la battlemap courante — remplacé à chaque MAP_SWITCH

// Actions
setEntities(entitiesWithBlueprints)  // charge une carte — extrait et stocke les blueprints
addEntity(entity)                    // WS ENTITY_CREATED — guard doublon
removeEntity(entityId)               // WS ENTITY_DELETED
updateEntity(partial)                // WS ENTITY_UPDATED / ENTITY_MOVED — guard updated_at
fetchBlueprints()                    // GET /api/entity-blueprints — merge, ne vide pas
upsertBlueprint(blueprint)           // WorkshopPage — mise à jour blueprint dans la map
```

### tokenStore — updateToken
```javascript
// Merge partiel avec guard obsolescence
updateToken(partial)  // partial = { id, ...champs modifiés }
// Guard : si partial.updated_at < t.updated_at → ignoré silencieusement
// Utilisé par : TOKEN_MOVED (tokenId→id), TOKEN_UPDATED (token complet avec id)
```

### characterStore — upsertCharacter (PE31)
```javascript
// Handler WS CHARACTER_UPDATED
// Si visible:false et !state.isGm → retire le character du store (joueur ne doit plus le voir)
// Si visible:true → comportement normal (upsert)
// Raison : broadcast CHARACTER_UPDATED envoie l'objet complet.
//          Le store doit reproduire le filtre GET /characters (visible=true pour joueurs).
upsertCharacter: (character) => set((state) => {
  if (!character.visible && !state.isGm) {
    return { characters: state.characters.filter(c => c.id !== character.id) }
  }
  // ... upsert normal
})
```

---

## WebSocket — événements et ownership

### Règle d'émission
**Le serveur est le seul émetteur de broadcasts.**
Pattern : client → `socket.emit(EVENT, payload)` → serveur → `io.to(room).emit(EVENT, data)`.

### socket.data — accès via fetchSockets()
```javascript
// SESSION_JOIN :
socket.data.userId = socket.user.id   // fetchSockets → onlineUserIds
socket.data.role   = member.role      // fetchSockets → ciblage GM (PE2)
```

### Événements WS actifs
| Événement | Émetteur | Récepteur | Description |
|---|---|---|---|
| SESSION_JOIN | client | serveur | Rejoindre une room campagne |
| SESSION_JOINED | serveur | client | Confirmation + liste onlineUserIds |
| SESSION_USER_JOINED/LEFT | serveur | room | Présence |
| TOKEN_MOVE | client | serveur | Déplacer un token (drag canvas) |
| TOKEN_MOVED | serveur | room | Position mise à jour |
| TOKEN_ROTATE | client | serveur | Rotation +45° (clic court token propriétaire) |
| TOKEN_UPDATED | serveur | room | Token mis à jour (r, ou autres champs) |
| TOKEN_CREATED | serveur | room | Token apparu |
| TOKEN_DELETED | serveur | room | Token supprimé |
| VOXEL_ADD/REMOVE/UPDATE | client (GM) | serveur | Édition voxel |
| VOXEL_ADDED/REMOVED/UPDATED | serveur | room | Voxel mis à jour |
| MAP_SWITCH | client (GM) | serveur | Basculer les joueurs |
| MAP_VIEWPORT | client (GM) | serveur | Partager la caméra |
| DICE_ROLL | client | serveur | Demander un jet |
| DICE_RESULT | serveur | room | Résultat jet |
| CHAT_MESSAGE | client/serveur | room | Message chat |
| CHARACTER_UPDATED | serveur | room | Character modifié |
| DOC_SHARED | serveur | room | Document partagé en session |
| ENTITY_ACTION_REQUEST | client (joueur) | serveur | Demande interaction entité |
| ENTITY_ACTION_PENDING | serveur | GM socket | Notification arbitrage |
| ENTITY_ACTION_RESOLVE | client (GM) | serveur | Décision GM |
| ENTITY_ACTION_RESULT | serveur | joueur socket | Résultat (refus/timeout/jet) |
| ENTITY_ACTION_GM_DIRECT | client (GM) | serveur | Action directe GM sans arbitrage |
| ENTITY_CREATED | client (GM) | serveur → room | Entité posée |
| ENTITY_DELETED | client (GM) | serveur → room | Entité supprimée |
| ENTITY_UPDATED | serveur | room | État entité changé |
| ENTITY_MOVED | client (GM) | serveur → room | Entité déplacée |
| ENTITY_MOVE_REQUEST | client (joueur/GM) | serveur | Demande déplacement entité push/pull |
| ENTITY_MOVE_RESULT | serveur | joueur socket | Résultat jet + positions finales |
| WOUND_ADDED | serveur | room | Blessure ajoutée (+ promoted, shock_test_required) |
| WOUND_UPDATED | serveur | room | Blessure stabilisée |
| WOUND_REMOVED | serveur | room | Blessure supprimée (guérison) |
| INVENTORY_ADDED | serveur | room | Item ajouté à l'inventaire |
| INVENTORY_UPDATED | serveur | room | Item modifié (slot, container, quantité) |
| INVENTORY_REMOVED | serveur | room | Item supprimé de l'inventaire |
| SOLS_UPDATED | serveur | room | Solde sols modifié |
| COMBAT_START | client (GM) | serveur | Lancer le combat |
| COMBAT_STARTED | serveur | room | Roster + phase initialisés |
| COMBAT_END | client (GM) | serveur | Terminer le combat |
| COMBAT_ENDED | serveur | room | Reset client |
| COMBAT_STATE_SYNC | serveur | socket joueur | Reconnexion en cours de combat |
| COMBAT_ROSTER_UPDATED | serveur | room | Roster modifié (initiative, ordre) |
| COMBAT_PHASE_CHANGED | serveur | room | Nouvelle phase + données |
| COMBAT_SLOT_ADVANCED | serveur | room | Index slot courant |
| COMBAT_SURPRISE_ROLL | serveur | socket joueur surpris | Invite jet initiative |
| COMBAT_SURPRISE_RESULT | client (joueur) | serveur | Résultat jet initiative surprise |
| COMBAT_ANNOUNCE_START | client (GM) | serveur | Transition ROSTER → ANNOUNCEMENT |
| COMBAT_ACTION_DECLARE | client | serveur | Déclarer action en ANNOUNCEMENT |
| COMBAT_ACTION_DECLARED | serveur | room | Confirmation déclaration broadcastée |
| COMBAT_SKIP_PLAYER | client (GM) | serveur | Passer le tour d'un joueur |
| COMBAT_TURN_SKIPPED | serveur | room | Tour sauté notifié |
| COMBAT_ACTION_WINDOW | serveur | socket joueur actif | Fenêtre d'action slot courant |
| COMBAT_ACTION_CONFIRM | client/GM | serveur | Confirmer exécution slot RESOLUTION |
| COMBAT_ATTACK_PLAYER_RESULT | serveur | socket tireur PJ | Résultat jet de toucher |
| COMBAT_DAMAGE_PROMPT | serveur | socket tireur PJ | Invite à lancer dés dégâts |
| COMBAT_DAMAGE_CONFIRM | client PJ | serveur | Déclenche calcul dégâts serveur |
| COMBAT_DAMAGE_RESULT | serveur | socket tireur PJ | Résultats pour affichage fenêtre |
| COMBAT_ATTACK_RESULT | serveur | room | Résumé dégâts broadcast |

---

## Migrations — pièges (P52-P54)

### P52 — CLI knex trie les fichiers par ordre lexical, pas par `knex_migrations`
Des numéros à largeur inégale (`99_...` vs `100_...`-`106_...`) trient mal en lexical (`'9' > '1'`) :
`knex migrate:down`/`migrate:latest` sans argument peut cibler la mauvaise migration silencieusement
(vécu Session 134 : `99_char_advantages_v2.js` droppé au lieu de `106_...`).
**Pour tester un round-trip `up`/`down` d'une migration précise** : importer le module et appeler
`await mig.up(knex)` / `await mig.down(knex)` directement — jamais la CLI knex brute sur ce projet.

### P53 — `nodemon` réapplique les migrations à chaque écriture de fichier sous `server/`
`server/src/index.js` appelle `db.migrate.latest()` au démarrage. `nodemon` watch tout `server/` par
défaut (aucun `nodemonConfig` dans `package.json`) → écrire n'importe quel fichier de test dans
`server/` déclenche un restart qui auto-applique les migrations en attente avant tout test contrôlé.
**Procédure sûre** : écrire les scripts de vérification en `node -e` inline (Bash), jamais de fichier
sous `server/`. Avant de choisir un numéro de migration libre, toujours `ls server/src/db/migrations/`
(ne pas se fier uniquement à `EN_COURS.md`, qui peut être en retard sur un travail parallèle).

### P54 — ne jamais rappeler `mig.up(knex)` sans vérifier `knex_migrations` au préalable
Conséquence directe de P53 : si nodemon a déjà auto-appliqué la migration entre son écriture et un test
manuel, un second appel direct à `up()` traite des données déjà correctes comme si elles étaient
corrompues (vécu Session 135 : `decodeMojibake()` rappelée sur du texte déjà décodé → corruption
silencieuse, aucune erreur levée). **Procédure sûre** : `SELECT` la table `knex_migrations`
(`WHERE name = '...'`) avant tout appel manuel à `up()`/`down()` ; pour un round-trip, ne jamais
enchaîner deux `up()` sans `down()` entre les deux.
