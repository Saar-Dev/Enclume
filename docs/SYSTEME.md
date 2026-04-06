# SYSTEME.md — Flux, règles et pièges du projet Enclume
> Dernière mise à jour : 2026-04-06 Session 13
> Ce document est la référence vivante pour travailler sur le code.
> Il répond à "qui fait quoi, qui parle à qui, pourquoi" — pas à "qu'est-ce qui existe".
> Pour la liste des fichiers : voir ASBUILT.md. Pour l'historique : voir JOURNAL.md.

---

## 1. Authentification — ce que contient `user`

### Côté serveur
Le JWT est signé avec `{ id, email, username }` — **pas `color`**.
`req.user` (injecté par `middleware/auth.js`) contient : `{ id, email, username, iat, exp }`.
`color` n'est jamais dans le JWT. Pour l'avoir côté serveur, il faut relire la DB.

### Côté client
Au montage de l'app (`App.jsx`), `GET /auth/me` est appelé.
La réponse retourne `{ id, email, username, color }` — depuis la DB, pas le JWT.
`authStore.user` contient donc toujours : `{ id, email, username, color }`.
C'est la seule source de vérité pour l'identité de l'utilisateur côté client.

**Piège :** ne jamais supposer que `user.color` vient du JWT — il vient de GET /auth/me.
**Piège :** `isLoading: true` par défaut dans authStore — les routes protégées attendent ce flag avant de rendre.

---

## 2. Ownership des tokens — règle fondamentale

### La colonne `owner_id` est morte
La table `tokens` a une colonne `owner_id` — elle n'est jamais renseignée en pratique.
**Ne jamais utiliser `token.owner_id` pour vérifier l'ownership. Sans exception.**

### L'ownership réel passe par `character_id`
```
token.character_id → characters.user_id === utilisateur courant
```

### Implémentation côté serveur REST (tokens.js)
```javascript
let isOwner = false
if (token.character_id) {
  const character = await db('characters').where({ id: token.character_id }).first()
  isOwner = character?.user_id === req.user.id
}
```
Utilisé dans : PUT /tokens/:id, DELETE /tokens/:id.

### Implémentation côté socket (socket/index.js — TOKEN_MOVE)
```javascript
let isOwner = false
if (token.character_id) {
  const character = await db('characters').where({ id: token.character_id }).first()
  isOwner = character?.user_id === socket.user.id
}
```

### Implémentation côté client (Canvas3D.jsx — handleDragStart)
```javascript
const character = characters.find(c => c.id === token.character_id)
isOwner = character?.user_id === user?.id
```
`characters` et `user` sont des props descendues de SessionPage → Canvas3D → Scene.

---

## 3. Flux Socket.io — événements complets

### Architecture générale
- `socket.campaignId` : assigné lors du SESSION_JOIN, après vérification membership en DB
- `socket.role` : `'gm'` ou `'player'`, assigné lors du SESSION_JOIN
- `socket.user` : `{ id, email, username }` — injecté par socket/auth.js depuis le JWT
- **PIÈGE** : `socket.role` et `socket.user` sont des propriétés custom locales.
  `fetchSockets()` retourne des remote adapters qui n'exposent PAS ces propriétés.
  Pour broadcaster différemment selon le rôle, utiliser `io.to()` avec filtrage du contenu.

### SESSION_JOIN
**Émetteur :** SessionPage.jsx au montage du socket
**Payload émis :** `{ campaignId }`
**Serveur :** vérifie membership en DB → `socket.join(campaignId)` → assigne `socket.campaignId` et `socket.role`
**Broadcast :** `SESSION_JOINED` à l'émetteur + `SESSION_USER_JOINED` aux autres membres
**Client écoute :** non implémenté côté client (pas de handler SESSION_JOINED dans SessionPage)

### TOKEN_MOVE → TOKEN_MOVED
**Émetteur :** Canvas3D.jsx (handlePointerUp) après PUT REST réussi
**Payload émis :** `{ tokenId, pos_x, pos_y, pos_z }`
**Serveur :** vérifie ownership (character_id → user_id) → UPDATE en DB → broadcast TOKEN_MOVED
**Broadcast :** `io.to(campaignId).emit(TOKEN_MOVED, { tokenId, pos_x, pos_y, pos_z })`
**Client écoute :** SessionPage.jsx → `setTokens(prev => prev.map(...))`
**Note :** le GM/joueur voit son propre déplacement mis à jour deux fois (REST + socket) — bénin, même valeur.

### TOKEN_CREATED
**Déclencheur :** drag character depuis Sidebar → POST /battlemaps/:id/tokens → succès
**Émetteur :** SessionPage.jsx (handleCharacterDrop) après POST REST réussi
**Payload émis :** `{ tokenId }`
**Serveur :** relit le token complet en DB → broadcast
**Broadcast :** `io.to(campaignId).emit(TOKEN_CREATED, { token })` — token complet
**Client écoute :** SessionPage.jsx → `setTokens(prev => exists ? prev : [...prev, token])`
**Guard doublon :** vérifie si token.id existe déjà avant d'ajouter (l'émetteur reçoit aussi le broadcast)

### TOKEN_DELETED
**Déclencheurs (2) :**
1. Touche Suppr/Backspace sur token sélectionné — Canvas3D.jsx (handleKeyDown), GM uniquement
2. Menu contextuel "Retirer du plateau" — SessionPage.jsx (handleContextMenuDelete), GM ou owner
**Séquence :** DELETE REST → succès → `handleTokenDelete(tokenId)` (état local) → `socket.emit(TOKEN_DELETED)`
**Payload émis :** `{ tokenId }`
**Serveur :** broadcast sans logique supplémentaire
**Broadcast :** `io.to(campaignId).emit(TOKEN_DELETED, { tokenId })`
**Client écoute :** SessionPage.jsx → `setTokens(prev => prev.filter(t => t.id !== tokenId))`

### VOXEL_ADD → VOXEL_ADDED
**Émetteur :** Canvas3D.jsx (handleClick, mode édition, GM uniquement)
**Payload émis :** `{ battlemapId, x, y, z, mat }`
**Serveur :** vérifie role gm → UPDATE voxel_data en DB → broadcast
**Broadcast :** `io.to(campaignId).emit(VOXEL_ADDED, { battlemapId, x, y, z, mat })`
**Client écoute :** Scene dans Canvas3D.jsx (useEffect sur socket)
→ `setVoxels(prev => ({ ...prev, [key]: { x, y, z, mat } }))`

### VOXEL_REMOVE → VOXEL_REMOVED
**Émetteur :** Canvas3D.jsx (handleClick clic droit, mode édition, GM uniquement)
**Payload émis :** `{ battlemapId, x, y, z }`
**Serveur :** vérifie role gm → UPDATE voxel_data en DB → broadcast
**Broadcast :** `io.to(campaignId).emit(VOXEL_REMOVED, { battlemapId, x, y, z })`
**Client écoute :** Scene dans Canvas3D.jsx (useEffect sur socket)
→ `setVoxels(prev => { delete next[key]; return next })`

### CHAT_MESSAGE
**Émetteur :** Sidebar.jsx (sendMessage)
**Payload émis :** `{ text }` — le serveur enrichit avec userId, username, timestamp
**Serveur :** ajoute `userId`, `username`, `timestamp: new Date().toISOString()` → broadcast à tous (y compris émetteur)
**Broadcast :** `io.to(campaignId).emit(CHAT_MESSAGE, { userId, username, text, timestamp })`
**Client écoute :** SessionPage.jsx
**Mapping payload → state messages :**
```
userId + timestamp → id: `${userId}-${timestamp}`
username          → user
text              → text
timestamp         → time: toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
```
`messages` est un état de SessionPage, passé en prop à Sidebar.
**Sidebar ne gère plus son propre état messages.**
**Piège :** ne pas faire de setMessages local dans sendMessage — le broadcast revient à tous y compris l'émetteur, ce qui remplirait l'état. Émettre uniquement, laisser le handler faire le setState.

### CHARACTER_UPDATED
**Déclencheurs (2) dans Sidebar.jsx (CharacterModal) :**
1. `handleToggleVisible` — GM bascule visible/invisible
2. `onChange` du select d'assignation — GM assigne un joueur au character
**Séquence :** PUT REST → succès → `socket.emit(CHARACTER_UPDATED, { characterId })`
**Payload émis :** `{ characterId }`
**Serveur :** vérifie role gm → relit character en DB avec LEFT JOIN users → destructure `gm_notes` → broadcast
**Broadcast :** `io.to(campaignId).emit(CHARACTER_UPDATED, characterPublic)` — character complet sans gm_notes
**Client écoute :** SessionPage.jsx
```javascript
s.on(WS.CHARACTER_UPDATED, (updatedCharacter) => {
  setCharacters(prev => {
    const exists = prev.find(c => c.id === updatedCharacter.id)
    if (!exists) return [...prev, updatedCharacter]  // nouvellement visible pour un joueur
    return prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c)
  })
})
```
**Pourquoi pas fetchSockets() :** `socket.role` inaccessible sur les remote adapters.
Le GM reçoit `characterPublic` (sans gm_notes) par socket, mais il a déjà la version complète
via la réponse REST du PUT — pas de perte d'information.

---

## 4. Flux REST — droits d'accès et ownership

### Tokens

| Route | Accès | Règle ownership |
|---|---|---|
| POST /battlemaps/:id/tokens | GM ou joueur propriétaire | Joueur : `character.user_id === req.user.id` + pas de doublon sur cette battlemap |
| PUT /tokens/:id | GM ou joueur propriétaire | `token.character_id → character.user_id === req.user.id` |
| DELETE /tokens/:id | GM ou joueur propriétaire | idem PUT |

**Contrainte doublon (joueur uniquement) :** un seul token par `character_id` par battlemap.
Le GM peut créer autant de tokens qu'il veut pour le même character.

### Characters

| Route | Accès | Notes |
|---|---|---|
| GET /campaigns/:id/characters | Tous membres | Joueurs : visible=true seulement, jamais gm_notes |
| POST /campaigns/:id/characters | GM | visible=false par défaut |
| PUT /characters/:id | GM ou owner | GM : tous champs. Owner : name, visible, description |
| DELETE /characters/:id | GM | — |

**Retour PUT :** fait un SELECT avec LEFT JOIN users après UPDATE → retourne `owner_username`.
Ne pas utiliser `.returning()` brut — il ne retourne pas les colonnes jointurées.

### Battlemaps

| Route | Accès | Notes |
|---|---|---|
| GET /campaigns/:id/battlemaps | Tous membres | — |
| GET /battlemaps/:id | Tous membres | Tokens filtrés : joueurs voient uniquement visible_to_players=true ET layer != 'gm' |
| POST /campaigns/:id/battlemaps | GM | Avec multer (image optionnelle) |
| PUT /battlemaps/:id | GM | Avec multer (image optionnelle) |
| PUT /battlemaps/:id/voxels | GM | JSON pur, sans multer — routes séparées obligatoires |
| DELETE /battlemaps/:id | GM | Fallback default_battlemap_id si carte d'accueil |

### Campaigns

| Route | Accès | Notes |
|---|---|---|
| GET /campaigns/:id | Tous membres | Retourne campaign + members + battlemaps |

**Membres retournés :** `{ id, username, role, character_name }`.
Utilisé par SessionPage pour calculer `isGm` et peupler `members` (liste déroulante assignation characters).

---

## 5. État React — qui contrôle quoi

### SessionPage.jsx — chef d'orchestre
Tous les états globaux de la session vivent ici.

| État | Type | Source initiale | Mis à jour par |
|---|---|---|---|
| `campaign` | object | GET /campaigns/:id | — |
| `battlemap` | object | GET /battlemaps/:id | onVoxelDataChange |
| `tokens` | array | GET /battlemaps/:id | socket TOKEN_*, handleTokenMove, handleTokenDelete |
| `characters` | array | GET /campaigns/:id/characters | socket CHARACTER_UPDATED, onCharactersChange |
| `members` | array | GET /campaigns/:id | — |
| `isGm` | bool | members.find(m.id === user.id).role | — |
| `socket` | Socket.io instance | io() au montage useEffect | setSocket(s) |
| `messages` | array | socket CHAT_MESSAGE | — |
| `contextMenu` | object/null | handleTokenDoubleClick | setContextMenu(null) |

**Règle d'ordre critique :** `const [socket, setSocket] = useState(null)` doit être déclaré
AVANT tout `useCallback` qui utilise `socket` dans son dependency array.
Violation = `ReferenceError: can't access lexical declaration before initialization`.

### Canvas3D.jsx — props reçues de SessionPage
```
battlemap, tokens, mode, activeMaterial,
onVoxelDataChange, onPackLoaded,
onTokenMove, onTokenDelete, onTokenDoubleClick,
isGm, socket, user, characters
```
`user` et `characters` sont nécessaires pour la vérification d'ownership dans `handleDragStart`.
`socket` est nécessaire pour émettre TOKEN_MOVE, TOKEN_DELETED, VOXEL_ADD, VOXEL_REMOVE.

### Scene (composant interne Canvas3D) — props reçues de Canvas3D
```
voxels, setVoxels, mode, activeMaterial, materials, onDirty,
socket, battlemapId,
tokens, selectedTokenId, onTokenSelect,
gltfScene, onTokenMove, onTokenDelete, onTokenDoubleClick,
isGm, justSelectedRef, user, characters
```

### Sidebar.jsx — props reçues de SessionPage
```
isGm, mode, onModeChange, layer, onLayerChange,
width, onWidthChange, onClose,
activeMaterial, onMaterialChange, availableMaterials,
characters, onCharactersChange, campaignId,
messages, socket, campaignMembers
```
`messages` est contrôlé par SessionPage — Sidebar n'a plus d'état local messages.
`socket` est nécessaire pour émettre CHAT_MESSAGE et CHARACTER_UPDATED.
`campaignMembers` utilisé dans CharacterModal (filtre role === 'player' pour la liste déroulante).

---

## 6. Alignement voxel/grille — décision session 8

### Le problème
Three.js BoxGeometry a son origine au centre du cube.
Un cube à `position=[0,0,0]` occupe visuellement [-0.5, +0.5] sur chaque axe.
La grille drei/Grid a ses lignes aux coordonnées entières 0, 1, 2...
Sans correction : les centres des cubes tombent sur les intersections → les cubes débordent sur 4 cellules.

### La correction (uniquement visuelle — données inchangées)

| Élément | Position rendu | Données en base |
|---|---|---|
| Voxel | `[x+0.5, y+0.5, z+0.5]` | `{x, y, z}` inchangés |
| Grid | `[0, 0, 0]` | lignes aux entiers = bords des cubes |
| TokenMesh (repos) | `baseX+0.5, baseY, baseZ+0.5` | `pos_x, pos_y, pos_z` inchangés |
| TokenMesh (drag) | `dragState.x+0.5, dragState.y, dragState.z+0.5` | — |

**Pourquoi Y non décalé sur les tokens :** `Y_OFFSET = 0.5` dans TokenMesh positionne déjà
le modèle 3D à +0.5 au-dessus de la base du group. Le group est à `baseY` (altitude brute).
L'ensemble s'aligne correctement sur le dessus du voxel sans décalage Y supplémentaire.

**userData conservé brut :** `userData={{ isVoxel: true, position }}` — le raycasting et la
suppression de voxels utilisent les coordonnées brutes, pas les coordonnées visuelles décalées.

### BUG CONNU — validation Y joueur cassée (priorité session 9)
`getColumnTopY` retourne la coordonnée Y brute du voxel le plus haut (entier).
La règle joueur `snappedY >= 1` compare cette valeur brute.
Un voxel au sol (Y=0 en base) donne `getColumnTopY = 0` → `0 >= 1` → drop bloqué.
**Conséquence :** le joueur ne peut pas poser son token sur une carte avec un seul niveau de voxels (Y=0).

**Analyse de getColumnTopY actuel :**
```javascript
const getColumnTopY = (x, z) => {
  let maxY = -1
  for (const v of Object.values(voxels)) {
    if (v.x === x && v.z === z) maxY = Math.max(maxY, v.y)
  }
  return maxY === -1 ? 0 : maxY  // retourne 0 si vide ET si voxel à Y=0 — ambiguïté
}
```
`maxY === -1` signifie "colonne vide". La fonction retourne 0 dans ce cas — même valeur qu'un voxel à Y=0.
**Correction appliquée en session 9 :**
- `getColumnTopY` retourne désormais `maxY` brut : `-1` si colonne vide, `≥0` si voxel trouvé.
- Pendant le drag (altitude visuelle) : `Math.max(0, columnY) + DRAG_HOVER` — évite altitude négative sur case vide.
- Validation drop : `minY = isGm ? -1 : 0` / `maxY = isGm ? 8 : 7`.
  - GM : peut poser dans le vide (`-1`) jusqu'au plafond (`8`).
  - Joueur : voxel obligatoire sous les pieds (`≥0`), pas de mur (`≤7`).
- **Bug résolu** — joueur peut désormais poser sur voxels Y=0.

---

## 7. Règles dependency arrays useCallback/useEffect

Ces erreurs ont causé des bugs silencieux en session 8.

**Règle :** toute valeur extérieure utilisée dans le corps d'un `useCallback` ou `useEffect`
doit être dans son dependency array. Sinon la closure capture la valeur au moment de la création.

**Cas critiques identifiés et corrigés :**

| Callback | Variable manquante | Symptôme |
|---|---|---|
| `handleContextMenuDelete` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleKeyDown` useEffect (Canvas3D) | `socket` | socket?.emit() silencieux |
| `handleCharacterDrop` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleDragStart` (Canvas3D) | `isGm`, `user`, `characters` | ownership check stale |

---

## 8. Conventions non-négociables — rappel rapide

- **UUID partout** en base — jamais `increments()`, jamais `integer()` pour les FK
- **threeToDb(tx, ty, tz)** → `{ pos_x: tx, pos_y: tz, pos_z: ty }` — mapping Three.js ↔ DB, jamais inline
- **WS.CONSTANTE** toujours — jamais de chaîne en dur dans socket.emit/on
- **Multer et JSON pur incompatibles** — routes séparées obligatoires (PUT /battlemaps/:id vs PUT /battlemaps/:id/voxels)
- **knexfile.cjs** en CommonJS — la CLI Knex ne supporte pas ES Modules
- **Commande migrations Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`
- **socket.role inaccessible via fetchSockets()** — broadcaster à tous et filtrer le contenu
- **owner_id sur tokens = mort** — ownership toujours via character_id → characters.user_id
- **returning() brut ne joint pas** — après UPDATE sur characters, faire un SELECT avec LEFT JOIN users

---

## 11. Flux internes Canvas3D — détail session 9

### Chaîne de données : placement token (drop depuis Sidebar)
```
SessionPage : handleCharacterDrop
  → POST /battlemaps/:id/tokens
  → socket.emit(WS.TOKEN_CREATED, { tokenId })
  → serveur relit token → broadcast TOKEN_CREATED { token }
  → SessionPage : setTokens (guard doublon)
  → Canvas3D reçoit tokens[] mis à jour via props
```

### Chaîne de données : déplacement token (drag dans Canvas3D)
```
TokenMesh : onPointerDown → handleDragStart (vérif ownership)
  → dragRef.current.active = true, orbitControls.enabled = false
  → pointermove : raycastGround(Y=0) → getColumnTopY → setDragState { x, y, z, tiltX, tiltZ }
  → TokenMesh lit dragState → position visuelle mise à jour en temps réel
  → pointerup : raycastGround → getColumnTopY → validation minY/maxY
  → PUT /tokens/:id (threeToDb)
  → socket.emit(WS.TOKEN_MOVE, { tokenId, pos_x, pos_y, pos_z })
  → onTokenMove(res.data.token) → SessionPage : setTokens
```

### Chaîne de données : suppression token (touche Suppr)
```
Canvas3D : document keydown (GM + selectedTokenId)
  → DELETE /tokens/:id
  → onTokenDelete(tokenId) → SessionPage : setTokens filter
  → socket.emit(WS.TOKEN_DELETED, { tokenId })
  → serveur broadcast → autres clients : setTokens filter
```

### Chaîne de données : édition voxel (mode edit, GM)
```
Canvas3D : mousedown sur canvas
  → clic gauche : raycasting voxels → pose sur face ou sol → setVoxels + socket.emit(WS.VOXEL_ADD)
  → clic droit : raycasting voxels → suppression → setVoxels + socket.emit(WS.VOXEL_REMOVE)
  → serveur : UPDATE voxel_data en DB → broadcast VOXEL_ADDED/REMOVED
  → Scene : useEffect socket → setVoxels (temps réel joueurs)
  → sauvegarde auto 60s si dirty, ou à la sortie du mode edit
```

### getColumnTopY — contrat post session 9
```javascript
// Retourne -1 si colonne vide, Y brut (≥0) si voxel trouvé
// Usage drag    : Math.max(0, columnY) + DRAG_HOVER  → altitude visuelle ≥ 0
// Usage drop    : snappedY >= minY (isGm ? -1 : 0) && snappedY <= maxY (isGm ? 8 : 7)
```

### Props Canvas3D — flux descendant
```
SessionPage
  → Canvas3D : battlemap, tokens, mode, activeMaterial, isGm, socket, user, characters,
               onVoxelDataChange, onPackLoaded, onTokenMove, onTokenDelete, onTokenDoubleClick
  → Scene    : + voxels, setVoxels, materials, onDirty, battlemapId,
               selectedTokenId, onTokenSelect, gltfScene, justSelectedRef
  → TokenMesh: token, gltfScene, isSelected, onDragStart, onTokenDoubleClick, dragState
```

---

## 12. Flux authentification — détail auth.js

### JWT — contenu et limites
```
Signé avec : { id, email, username }  — color ABSENTE du JWT
Durée : 7 jours
Cookie : httpOnly, sameSite=lax, secure en production
```
- `req.user` (injecté par requireAuth) : `{ id, email, username, iat, exp }`
- `color` jamais dans le JWT — toujours relire la DB pour l'avoir
- Si username/email change via PUT /users/me : JWT devient inexact mais fonctionnel
  car GET /auth/me relit toujours la DB. Rafraîchi à la prochaine connexion.

### Flux register
```
POST /auth/register { email, password, username }
  → validation présence + longueur password (≥8)
  → vérif email unique
  → bcrypt.hash(password, 12)
  → randomColor() — palette 12 teintes
  → INSERT users { email, password_hash, username, color }
  → jwt.sign { id, email, username }
  → res.cookie('token', ...) + res.json({ user })
```

### Flux login
```
POST /auth/login { email, password }
  → db('users').where({ email }).first()
  → bcrypt.compare(password, user.password_hash)
  → jwt.sign { id, email, username }
  → res.cookie('token', ...) + res.json({ user: { id, email, username, color } })
```

### Flux me
```
GET /auth/me  [requireAuth]
  → db('users').where({ id: req.user.id }).select([id, email, username, color])
  → res.json({ user })
```
Source de vérité côté client — appelé au montage de App.jsx.
authStore.user = { id, email, username, color } après cet appel.

### COOKIE_OPTIONS (référence)
```javascript
{ httpOnly: true, secure: NODE_ENV==='production', sameSite: 'lax', maxAge: 7j }
```

---

## 13. Flux profil utilisateur — PUT /api/users/me (session 9)

### Route
```
PUT /api/users/me  [requireAuth]
Body (tous optionnels) : { username, email, color, password, current_password }
```

### Règles de validation
- Au moins un champ à modifier requis
- Si `email` fourni : vérifier unicité (pas déjà pris par un autre user)
- Si `password` fourni : `current_password` obligatoire + bcrypt.compare contre hash actuel
- Si `color` fourni : format hex #RRGGBB (7 caractères)
- `username` : pas de contrainte de format (cohérent avec register)

### Retour
```javascript
res.json({ user: { id, email, username, color } })
```

### Impact authStore côté client
Après PUT /users/me réussi : appeler GET /auth/me ou mettre à jour authStore directement.
Le JWT reste valide (pas régénéré) — GET /auth/me relit la DB donc cohérent.

### Montage index.js
```javascript
import usersRouter from './routes/users.js'
app.use('/api/users', usersRouter)
```

---

## 14. Structure index.js — routes montées (référence session 9)

```
/api/health             GET  — santé serveur
/api/auth               → authRouter
/api/campaigns          → campaignsRouter
/api/campaigns/:id/characters → charactersRouter (mergeParams)
/api/characters         → charactersActionsRouter (PUT/:id, DELETE/:id)
/api/campaigns/:id/battlemaps → battlemapsRouter
/api/battlemaps         → battlemapsRouter
/api/battlemaps/:id/tokens → tokensRouter
/api/tokens             → tokensRouter
/api/textures           → texturesRouter  (monté AVANT express.json)
/api/assets             → assetsRouter    (monté AVANT express.json)
/api/users              → usersRouter     (à ajouter session 9)
```

Ordre middleware obligatoire :
1. dotenv (tout premier import)
2. cors + express.json + cookieParser
3. /api/textures + /api/assets (avant les autres)
4. Routes
5. errorHandler (dernier)

---

## 15. Flux profil utilisateur — DashboardPage (session 9)

### Déclencheur
Clic sur le bouton `usernameBtn` (header DashboardPage) → `handleOpenProfile`
→ pré-remplit `profileForm` depuis `authStore.user`
→ `setShowProfile(true)`

### Modale profil — comportement
- Fermeture : clic overlay (`onMouseDown` sur l'overlay) ou bouton Annuler
- `onMouseDown` sur la modale elle-même stoppe la propagation (empêche fermeture)
- Sauvegarde au submit uniquement (pas au blur)

### handleProfileSave — logique diff
```
body = {} — seulement les champs qui ont changé vs user actuel
username : inclus si différent de user.username
email    : inclus si différent de user.email
color    : inclus si différent de user.color
password : inclus si non vide (+ current_password obligatoire)
Si body vide → fermeture sans appel serveur
```

### Flux PUT /users/me → authStore
```
api.put('/users/me', body)
  → res.data.user { id, email, username, color }
  → setUser(res.data.user)  ← authStore mis à jour immédiatement
  → username/color reflétés dans le header sans rechargement
```

### authStore — exports confirmés (session 9)
```javascript
{ user, isLoading, setUser, clearUser }
// setUser(user) → set({ user, isLoading: false })
// clearUser()   → set({ user: null, isLoading: false })
```

---

## 16. Flux MAP_SWITCH — barre GM (session 9)

### Payload émis par le client GM
```javascript
socket.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
// userIds vide = tous les joueurs de la campagne
// userIds rempli = joueurs spécifiques (affectation individuelle)
```

### Traitement serveur (socket/index.js)
```
Reçoit : { battlemapId, userIds }
  → vérifie socket.role === 'gm'
  → relit battlemap en DB
  → si userIds vide : charge tous les members role='player' de la campagne
  → UPDATE player_locations (upsert campaign_id + user_id → battlemap_id)
  → broadcast io.to(campaignId).emit(MAP_SWITCH, { battlemapId, userIds: targets })
```

### Écoute côté client (SessionPage)
```javascript
s.on(WS.MAP_SWITCH, ({ battlemapId, userIds }) => {
  // Si userIds inclut user.id (ou vide = tous) → charger la nouvelle carte
  const concerned = userIds.length === 0 || userIds.includes(user.id)
  if (!concerned) return
  // GET /battlemaps/:battlemapId → setBattlemap + setTokens
})
```
**Note :** le GM émet MAP_SWITCH mais reçoit aussi le broadcast.
Il doit charger la carte localement lui aussi (ou filtrer userIds).
Décision retenue : le GM charge toujours la carte qu'il switche —
c'est lui qui la choisit, il doit la voir.

### Barre GM — comportement UI
- Visible GM uniquement (isGm)
- Position : barre horizontale fixe en haut du canvas
- Contenu : liste des battlemaps de la campagne (chargée au montage)
- Clic sur une carte → charge localement + émet MAP_SWITCH { battlemapId, userIds: [] }
- Carte active mise en évidence visuellement

### États ajoutés dans SessionPage
```javascript
const [battlemaps, setBattlemaps] = useState([])
// Chargé via GET /campaigns/:id/battlemaps au montage
// Utilisé par la barre GM pour afficher la liste
```

---

## 17. Référence complète events.js (shared/events.js)

```javascript
SESSION_JOIN / SESSION_JOINED / SESSION_USER_JOINED / SESSION_USER_LEFT
TOKEN_MOVE / TOKEN_MOVED / TOKEN_CREATED / TOKEN_DELETED / TOKEN_UPDATED
VOXEL_ADD / VOXEL_ADDED / VOXEL_REMOVE / VOXEL_REMOVED
DICE_ROLL / DICE_RESULT
MAP_SWITCH / MAP_VIEWPORT
DOC_SHARED
CHARACTER_UPDATED
CHAT_MESSAGE
```

---

## 18. Référence socket/index.js — handlers complets (session 9)

| Événement reçu | Vérif rôle | Action DB | Broadcast |
|---|---|---|---|
| SESSION_JOIN | membre | — | SESSION_JOINED (émetteur) + SESSION_USER_JOINED (autres) |
| TOKEN_MOVE | GM ou owner (character_id→user_id) | UPDATE tokens pos | TOKEN_MOVED à toute la room |
| TOKEN_CREATED | — | relit token | TOKEN_CREATED { token } à toute la room |
| TOKEN_DELETED | — | — | TOKEN_DELETED { tokenId } à toute la room |
| VOXEL_ADD | GM | UPDATE voxel_data | VOXEL_ADDED à toute la room |
| VOXEL_REMOVE | GM | UPDATE voxel_data | VOXEL_REMOVED à toute la room |
| MAP_SWITCH | GM | UPSERT player_locations | MAP_SWITCH { battlemapId, userIds } à toute la room |
| MAP_VIEWPORT | GM | — | MAP_VIEWPORT aux autres (pas émetteur) |
| DICE_ROLL | — | — (TODO) | — |
| CHAT_MESSAGE | — | — | CHAT_MESSAGE { userId, username, text, timestamp } à toute la room |
| CHARACTER_UPDATED | GM | relit character + JOIN users | CHARACTER_UPDATED (sans gm_notes) à toute la room |
| disconnect | — | — | SESSION_USER_LEFT aux autres |

---

## 19. Flux menu contextuel barre GM (session 9)

### Déclencheur
`onContextMenu` sur bouton carte dans la barre GM
→ `setMapContextMenu({ bm, x, y })`
→ menu HTML en `position: fixed`, même pattern que contextMenu token

### Fermeture
`useEffect` sur `mapContextMenu` → `mousedown` sur document
→ ferme si clic hors `mapContextMenuRef`

### Actions et flux

**Renommer**
```
setRenameTarget(bm) + setRenameValue(bm.name) + setShowRenameModal(true)
→ modale → PUT /battlemaps/:id { name }
→ setBattlemaps (map) + setBattlemap si carte active
```

**Définir comme page d'accueil**
```
PUT /campaigns/:campaignId { default_battlemap_id: bm.id }
→ setCampaign (local)
```
Note : PUT /campaigns/:id accepte désormais `default_battlemap_id` (ajouté session 9).

**Déplacer le groupe**
```
handleMapSwitch(bm.id)
→ GET /battlemaps/:id → setBattlemap + setTokens
→ socket.emit(MAP_SWITCH, { battlemapId, userIds: [] })
```

**Dupliquer**
```
POST /battlemaps/:id/duplicate
→ setBattlemaps([...prev, res.data.battlemap])
```
Correction session 9 : `voxel_data` doit être `JSON.stringify()` avant INSERT
— Knex/pg ne sérialise pas automatiquement si la valeur est déjà un objet JS lu depuis JSONB.

**Supprimer**
```
window.confirm → DELETE /battlemaps/:id
→ setBattlemaps (filter)
→ si carte active : handleMapSwitch(remaining[0].id) ou setBattlemap(null)
```

**Nouvelle carte**
```
setShowCreateModal(true)
→ modale → POST /campaigns/:id/battlemaps { name }
→ setBattlemaps([...prev, res.data.battlemap])
```

### Nouveaux états SessionPage (session 9)
```javascript
mapContextMenu     // { bm, x, y } | null
mapContextMenuRef  // ref pour fermeture clic ailleurs
showRenameModal    // bool
renameTarget       // bm | null
renameValue        // string
showCreateModal    // bool
createMapName      // string
```

### Correction campaigns.js — PUT /:id (session 9)
Avant : acceptait uniquement `name` et `status`.
Après : accepte aussi `default_battlemap_id`.
Pattern updates object — seulement les champs définis dans le body.

---

## 20. Flux présence en ligne — Onglet Joueurs (session 9)

### Problème résolu
`SESSION_USER_JOINED` n'est émis qu'aux membres déjà connectés.
Un joueur qui arrive après le GM ne reçoit jamais le join du GM.
Solution : le serveur inclut la liste des connectés dans le payload `SESSION_JOINED`.

### Piège fetchSockets() — rappel §1
`socket.user` est une propriété custom locale — **inaccessible** via `fetchSockets()`.
Solution : stocker `socket.user.id` dans `socket.data.userId` (accessible sur les remote adapters).
```javascript
socket.data.userId = socket.user.id  // au moment du SESSION_JOIN
// puis via fetchSockets :
const ids = sockets.map(s => s.data.userId).filter(Boolean)
```

### Flux SESSION_JOIN modifié (socket/index.js)
```
socket.join(campaignId)
socket.data.userId = socket.user.id   ← NEW
fetchSockets() → onlineUserIds (filtre userId courant)
socket.emit(SESSION_JOINED, { ..., onlineUserIds })  ← NEW
socket.to(campaignId).emit(SESSION_USER_JOINED, { userId, ... })
```

### Flux présence côté client (SessionPage)
```javascript
// État
const [onlineUsers, setOnlineUsers] = useState(new Set())

// SESSION_JOINED — initialise avec soi-même + tous les connectés
s.on(WS.SESSION_JOINED, ({ userId, onlineUserIds = [] }) => {
  setOnlineUsers(new Set([userId, ...onlineUserIds]))
})
// SESSION_USER_JOINED — quelqu'un arrive
s.on(WS.SESSION_USER_JOINED, ({ userId }) => {
  setOnlineUsers(prev => new Set([...prev, userId]))
})
// SESSION_USER_LEFT — quelqu'un part
s.on(WS.SESSION_USER_LEFT, ({ userId }) => {
  setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next })
})
```

### Onglet Joueurs Sidebar
- `onlineUsers` passé comme prop `Set<userId>` de SessionPage → Sidebar
- `onlineUsers.has(member.id)` → point vert/gris
- Nom du personnage : `characters.find(c => c.user_id === member.id)?.name` — calculé côté client, pas de JOIN serveur
- Badges MJ/Joueur depuis `member.role`

---

## 21. Flux chat amélioré — session 9

### Structure d'un message dans `messages` state (SessionPage)
```javascript
// Message normal
{ id, user, color, text, time }
// Message système (connexion/déconnexion)
{ id, system: true, text, time }
```

### color dans CHAT_MESSAGE
Le serveur lit `users.color` depuis la DB dans le handler CHAT_MESSAGE.
La couleur n'est pas dans le JWT — elle doit être relue à chaque message.
```javascript
// socket/index.js — handler CHAT_MESSAGE
const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
io.to(campaignId).emit(WS.CHAT_MESSAGE, { userId, username, color, text, timestamp })
```

### Messages système connexion/déconnexion
Générés côté client dans SessionPage, injectés dans `messages` :
```javascript
s.on(WS.SESSION_USER_JOINED, ({ userId, username }) => {
  setOnlineUsers(...)
  setMessages(prev => [...prev, { id, system: true, text: `${username} a rejoint...`, time }])
})
```

### Reconnexion socket après changement username
**Problème :** `socket.user.username` vient du JWT lu à la connexion.
Après PUT /users/me, le JWT est régénéré dans le cookie mais le socket existant garde l'ancien username.

**Solution : pattern reconnectTrigger**
```javascript
// SessionPage
const [reconnectTrigger, setReconnectTrigger] = useState(0)
useEffect(() => {
  const s = io(...)
  // ... tous les handlers ...
  return () => s.disconnect()
}, [campaignId, reconnectTrigger])  // ← re-run si trigger change
```
Sidebar reçoit `onReconnectSocket` prop → appelle `setReconnectTrigger(n => n + 1)`.
Le cleanup du useEffect déconnecte proprement l'ancien socket.
Le nouveau socket recrée une connexion avec le nouveau cookie JWT.

**Piège évité :** ne jamais appeler `socket.disconnect/connect` directement depuis Sidebar.
Sidebar ne possède pas le socket — SessionPage le possède et gère son cycle de vie.

### JWT régénéré dans PUT /users/me (users.js)
Si `username` ou `email` change → nouveau cookie JWT émis dans la réponse.
Sans ça, le nouveau username n'apparaîtrait dans le chat qu'après déconnexion complète.

## 22. Chantier 1 — Serveur seul émetteur WS (session 11)

### Règle fondamentale instaurée
Le serveur est désormais le seul émetteur d'événements WS suite à une action REST.
Le client ne broadcast jamais après un appel REST.
Pattern d'accès à io depuis une route : `const io = req.app.get('io')`
Rendu possible par `app.set('io', io)` dans server/src/index.js (après création de io).

### Flux TOKEN_CREATED — nouveau (remplace l'ancien)
**Déclencheur :** drag character depuis Sidebar → POST /battlemaps/:id/tokens → succès
**Ancien émetteur :** SessionPage.jsx (handleCharacterDrop) après POST REST
**Nouvel émetteur :** route REST POST /battlemaps/:id/tokens
**Séquence :**
```
POST /battlemaps/:id/tokens → INSERT → io.to(campaign_id).emit(TOKEN_CREATED, { token })
```
**campaign_id :** lu depuis `battlemap.campaign_id` (battlemap chargé en haut de la route).
**Client écoute :** SessionPage.jsx — guard doublon toujours actif (l'émetteur reçoit aussi le broadcast).
**État local :** `setTokens(prev => [...prev, res.data.token])` dans handleCharacterDrop conservé —
double ajout bénin grâce au guard doublon dans le handler socket.

### Flux TOKEN_MOVED — nouveau (remplace l'ancien)
**Déclencheur :** drag token → drop → PUT /tokens/:id → succès
**Ancien émetteur :** Canvas3D.jsx (handlePointerUp) après PUT REST
**Nouvel émetteur :** route REST PUT /tokens/:id
**Séquence :**
```
PUT /tokens/:id → UPDATE → io.to(campaign_id).emit(TOKEN_MOVED, { tokenId, pos_x, pos_y, pos_z })
```
**campaign_id :** lu depuis `battlemap.campaign_id` (battlemap chargé dans la route).
**Payload :** `{ tokenId, pos_x, pos_y, pos_z }` — identique au handler socket TOKEN_MOVE existant.
**Note :** double broadcast bénin pendant la période de transition (route REST + handler socket TOKEN_MOVE).
Le handler socket TOKEN_MOVE conservé temporairement — à supprimer dans un chantier dédié.

### Flux TOKEN_DELETED — nouveau (remplace l'ancien)
**Déclencheurs (2) :**
1. Touche Suppr/Backspace sur token sélectionné — Canvas3D.jsx (handleKeyDown), GM uniquement
2. Menu contextuel "Retirer du plateau" — SessionPage.jsx (handleContextMenuDelete), GM ou owner
**Ancien émetteur :** le client après DELETE REST
**Nouvel émetteur :** route REST DELETE /tokens/:id
**Séquence :**
```
DELETE /tokens/:id → DELETE DB → io.to(campaign_id).emit(TOKEN_DELETED, { tokenId })
```
**État local :** `handleTokenDelete(tokenId)` conservé dans les handlers client — double suppression
bénine (filter idempotent sur id déjà absent).

### Flux CHARACTER_UPDATED — nouveau (remplace l'ancien)
**Déclencheurs (2) dans Sidebar.jsx (CharacterModal) :**
1. `handleToggleVisible` — GM bascule visible/invisible
2. `onChange` du select d'assignation — GM assigne un joueur au character
**Ancien émetteur :** Sidebar.jsx après PUT REST (`socket.emit(CHARACTER_UPDATED, { characterId })`)
**Nouvel émetteur :** route REST PUT /characters/:id (actionsRouter)
**Séquence :**
```
PUT /characters/:id → UPDATE → SELECT + JOIN → destructure gm_notes
→ io.to(campaign_id).emit(CHARACTER_UPDATED, characterPublic)
```
**campaign_id :** lu depuis `updatedCharacter.campaign_id` (présent dans le SELECT).
**gm_notes :** toujours filtré avant broadcast — `const { gm_notes: _gm_notes, ...characterPublic } = updatedCharacter`
**Note :** double broadcast bénin pendant la période de transition (route REST + handler socket CHARACTER_UPDATED).

### Emit conservés côté client — ne pas supprimer
- `MAP_SWITCH` dans SessionPage.handleMapSwitch — commande GM volontaire, pas un broadcast post-écriture
- `VOXEL_ADD` / `VOXEL_REMOVE` dans Canvas3D.handleClick — édition temps réel socket, pas post-REST
- `CHAT_MESSAGE` dans Sidebar.sendMessage — pas un post-REST

### Piège P12 — VOXEL_ADD undefined battlemapId
`[WS] voxel:add error: Undefined binding(s) detected. Undefined column(s): [id]`
Cause : `battlemapId` est `undefined` dans le payload si `battlemap` est null au moment du clic
(entre deux chargements de carte).
Le handler socket tente `db('battlemaps').where({ id: undefined })` → Knex rejette.
Correction : ajouter `if (!battlemapId) return` en début des handlers VOXEL_ADD et VOXEL_REMOVE
dans socket/index.js.
À faire dans la prochaine session qui touche socket/index.js.

## 23. Chantier 2 — Timestamps + updated_at dans les payloads (session 12)

### Règle updated_at dans les routes PUT
Tout PUT en base doit inclure `updated_at: db.fn.now()` dans l'objet updates.
Pattern obligatoire :
```javascript
const updates = {}
// ... construire updates ...
if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')
// updated_at APRÈS le guard — jamais avant
updates.updated_at = db.fn.now()
await db('table').where({ id }).update(updates).returning('*')
```

Fichiers concernés : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js.
Exception : users.js — updated_at dans returning mais JAMAIS dans le payload JWT.

### updated_at dans les payloads WS
TOKEN_MOVED broadcast : `{ tokenId, pos_x, pos_y, pos_z, updated_at }`
CHARACTER_UPDATED broadcast : inclut updated_at via re-SELECT étendu.
TOKEN_CREATED : automatique via returning('*').

### Handler TOKEN_MOVED côté client — guard obsolescence
```javascript
s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) => {
  setTokens(prev => prev.map(t => {
    if (t.id !== tokenId) return t
    // Double null-check — updated_at peut être absent sur anciens tokens
    if (updated_at && t.updated_at && updated_at < t.updated_at) return t
    return { ...t, pos_x, pos_y, pos_z, updated_at }
  }))
})
```

### Piège P13 — updated_at après le guard Object.keys
Ne jamais ajouter `updated_at` dans `updates` avant le guard `Object.keys(updates).length === 0`.
Si `updates` ne contient que `updated_at`, le guard ne lève pas d'erreur et un update inutile
est exécuté. Toujours placer `updates.updated_at = db.fn.now()` après le guard.

### Piège P14 — updated_at jamais dans le JWT
users.js régénère le JWT si username ou email change.
`updated_at` ne doit jamais être dans le payload JWT — il n'a pas de valeur d'identité.
Le JWT contient uniquement : `{ id, email, username }`.

### Bug B corrigé — VOXEL_ADD guard battlemapId
socket/index.js handler VOXEL_ADD :
```javascript
if (!battlemapId) return  // guard — battlemapId undefined entre deux chargements de carte
```
Placé après le check role gm, avant toute requête DB.

---

## 24. Chantier 4 partiel + Bug C — Reconnexion (session 12)

### loadSession — pattern extrait
`load()` dans SessionPage extraite en `useCallback loadSession`.
Déclarée AVANT `useState socket` et AVANT le useEffect socket — ordre React obligatoire.
Dependency array : `[campaignId, user?.id]`.

```javascript
const loadSession = useCallback(async () => {
  // GET /campaigns/:id + GET /battlemaps/:id + GET /characters + GET /battlemaps
}, [campaignId, user?.id])

useEffect(() => { loadSession() }, [loadSession])
```

useEffect socket dependency array : `[campaignId, reconnectTrigger, loadSession]`.

### Bug C — Reconnexion post-redémarrage serveur
**Symptôme :** après redémarrage serveur, socket se reconnecte (transport OK)
mais SESSION_JOIN n'est pas ré-émis → socket hors room → broadcasts perdus.
F5 résout le problème.

**Cause :** SESSION_JOIN n'est émis qu'au montage du useEffect socket.
Lors d'une reconnexion automatique socket.io, le useEffect ne se ré-exécute pas.

**Tentative échouée session 12 :** handler `s.on('reconnect', ...)` — non fonctionnel.
Cause probable : socket.io-client v4 a changé le nom de l'événement (reconnect → connect).
Décision : pas de bricolage — solution robuste uniquement.

**Solution cible — Chantier 5 :**
- Côté serveur : émettre WS.SESSION_STATE dans SESSION_JOINED
  (tokens filtrés par rôle, characters sans gm_notes pour les joueurs, battlemap, onlineUsers)
- Côté client : handler `connect` dans sessionStore Zustand
  → ré-émet SESSION_JOIN → SESSION_STATE arrive en réponse et hydrate le store
- `connect` se déclenche à la connexion initiale ET à chaque reconnexion automatique (v4)
- Plus de dépendance à un nom d'événement versionsensible

**Piège P15 — ne pas bricoler la reconnexion socket**
Le handler `reconnect` de socket.io-client v3 ne fonctionne pas en v4.
Le bon événement en v4 est `connect` — mais il se déclenche aussi à la connexion initiale.
Sans store Zustand pour gérer le cycle de vie, implémenter ça proprement est impossible
sans introduire un flag `isFirstConnect` qui est lui-même un pansement.
Attendre le Chantier 5 — solution complète dans MISSION_chantier5 addendum session 12.

# SYSTEME.md — Flux, règles et pièges du projet Enclume
> Dernière mise à jour : 2026-04-03 Session 8
> Ce document est la référence vivante pour travailler sur le code.
> Il répond à "qui fait quoi, qui parle à qui, pourquoi" — pas à "qu'est-ce qui existe".
> Pour la liste des fichiers : voir ASBUILT.md. Pour l'historique : voir JOURNAL.md.

---

## 1. Authentification — ce que contient `user`

### Côté serveur
Le JWT est signé avec `{ id, email, username }` — **pas `color`**.
`req.user` (injecté par `middleware/auth.js`) contient : `{ id, email, username, iat, exp }`.
`color` n'est jamais dans le JWT. Pour l'avoir côté serveur, il faut relire la DB.

### Côté client
Au montage de l'app (`App.jsx`), `GET /auth/me` est appelé.
La réponse retourne `{ id, email, username, color }` — depuis la DB, pas le JWT.
`authStore.user` contient donc toujours : `{ id, email, username, color }`.
C'est la seule source de vérité pour l'identité de l'utilisateur côté client.

**Piège :** ne jamais supposer que `user.color` vient du JWT — il vient de GET /auth/me.
**Piège :** `isLoading: true` par défaut dans authStore — les routes protégées attendent ce flag avant de rendre.

---

## 2. Ownership des tokens — règle fondamentale

### La colonne `owner_id` est morte
La table `tokens` a une colonne `owner_id` — elle n'est jamais renseignée en pratique.
**Ne jamais utiliser `token.owner_id` pour vérifier l'ownership. Sans exception.**

### L'ownership réel passe par `character_id`
```
token.character_id → characters.user_id === utilisateur courant
```

### Implémentation côté serveur REST (tokens.js)
```javascript
let isOwner = false
if (token.character_id) {
  const character = await db('characters').where({ id: token.character_id }).first()
  isOwner = character?.user_id === req.user.id
}
```
Utilisé dans : PUT /tokens/:id, DELETE /tokens/:id.

### Implémentation côté socket (socket/index.js — TOKEN_MOVE)
```javascript
let isOwner = false
if (token.character_id) {
  const character = await db('characters').where({ id: token.character_id }).first()
  isOwner = character?.user_id === socket.user.id
}
```

### Implémentation côté client (Canvas3D.jsx — handleDragStart)
```javascript
const character = characters.find(c => c.id === token.character_id)
isOwner = character?.user_id === user?.id
```
`characters` et `user` sont des props descendues de SessionPage → Canvas3D → Scene.

---

## 3. Flux Socket.io — événements complets

### Architecture générale
- `socket.campaignId` : assigné lors du SESSION_JOIN, après vérification membership en DB
- `socket.role` : `'gm'` ou `'player'`, assigné lors du SESSION_JOIN
- `socket.user` : `{ id, email, username }` — injecté par socket/auth.js depuis le JWT
- **PIÈGE** : `socket.role` et `socket.user` sont des propriétés custom locales.
  `fetchSockets()` retourne des remote adapters qui n'exposent PAS ces propriétés.
  Pour broadcaster différemment selon le rôle, utiliser `io.to()` avec filtrage du contenu.

### SESSION_JOIN
**Émetteur :** SessionPage.jsx au montage du socket
**Payload émis :** `{ campaignId }`
**Serveur :** vérifie membership en DB → `socket.join(campaignId)` → assigne `socket.campaignId` et `socket.role`
**Broadcast :** `SESSION_JOINED` à l'émetteur + `SESSION_USER_JOINED` aux autres membres
**Client écoute :** non implémenté côté client (pas de handler SESSION_JOINED dans SessionPage)

### TOKEN_MOVE → TOKEN_MOVED
**Émetteur :** Canvas3D.jsx (handlePointerUp) après PUT REST réussi
**Payload émis :** `{ tokenId, pos_x, pos_y, pos_z }`
**Serveur :** vérifie ownership (character_id → user_id) → UPDATE en DB → broadcast TOKEN_MOVED
**Broadcast :** `io.to(campaignId).emit(TOKEN_MOVED, { tokenId, pos_x, pos_y, pos_z })`
**Client écoute :** SessionPage.jsx → `setTokens(prev => prev.map(...))`
**Note :** le GM/joueur voit son propre déplacement mis à jour deux fois (REST + socket) — bénin, même valeur.

### TOKEN_CREATED
**Déclencheur :** drag character depuis Sidebar → POST /battlemaps/:id/tokens → succès
**Émetteur :** SessionPage.jsx (handleCharacterDrop) après POST REST réussi
**Payload émis :** `{ tokenId }`
**Serveur :** relit le token complet en DB → broadcast
**Broadcast :** `io.to(campaignId).emit(TOKEN_CREATED, { token })` — token complet
**Client écoute :** SessionPage.jsx → `setTokens(prev => exists ? prev : [...prev, token])`
**Guard doublon :** vérifie si token.id existe déjà avant d'ajouter (l'émetteur reçoit aussi le broadcast)

### TOKEN_DELETED
**Déclencheurs (2) :**
1. Touche Suppr/Backspace sur token sélectionné — Canvas3D.jsx (handleKeyDown), GM uniquement
2. Menu contextuel "Retirer du plateau" — SessionPage.jsx (handleContextMenuDelete), GM ou owner
**Séquence :** DELETE REST → succès → `handleTokenDelete(tokenId)` (état local) → `socket.emit(TOKEN_DELETED)`
**Payload émis :** `{ tokenId }`
**Serveur :** broadcast sans logique supplémentaire
**Broadcast :** `io.to(campaignId).emit(TOKEN_DELETED, { tokenId })`
**Client écoute :** SessionPage.jsx → `setTokens(prev => prev.filter(t => t.id !== tokenId))`

### VOXEL_ADD → VOXEL_ADDED
**Émetteur :** Canvas3D.jsx (handleClick, mode édition, GM uniquement)
**Payload émis :** `{ battlemapId, x, y, z, mat }`
**Serveur :** vérifie role gm → UPDATE voxel_data en DB → broadcast
**Broadcast :** `io.to(campaignId).emit(VOXEL_ADDED, { battlemapId, x, y, z, mat })`
**Client écoute :** Scene dans Canvas3D.jsx (useEffect sur socket)
→ `setVoxels(prev => ({ ...prev, [key]: { x, y, z, mat } }))`

### VOXEL_REMOVE → VOXEL_REMOVED
**Émetteur :** Canvas3D.jsx (handleClick clic droit, mode édition, GM uniquement)
**Payload émis :** `{ battlemapId, x, y, z }`
**Serveur :** vérifie role gm → UPDATE voxel_data en DB → broadcast
**Broadcast :** `io.to(campaignId).emit(VOXEL_REMOVED, { battlemapId, x, y, z })`
**Client écoute :** Scene dans Canvas3D.jsx (useEffect sur socket)
→ `setVoxels(prev => { delete next[key]; return next })`

### CHAT_MESSAGE
**Émetteur :** Sidebar.jsx (sendMessage)
**Payload émis :** `{ text }` — le serveur enrichit avec userId, username, timestamp
**Serveur :** ajoute `userId`, `username`, `timestamp: new Date().toISOString()` → broadcast à tous (y compris émetteur)
**Broadcast :** `io.to(campaignId).emit(CHAT_MESSAGE, { userId, username, text, timestamp })`
**Client écoute :** SessionPage.jsx
**Mapping payload → state messages :**
```
userId + timestamp → id: `${userId}-${timestamp}`
username          → user
text              → text
timestamp         → time: toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
```
`messages` est un état de SessionPage, passé en prop à Sidebar.
**Sidebar ne gère plus son propre état messages.**
**Piège :** ne pas faire de setMessages local dans sendMessage — le broadcast revient à tous y compris l'émetteur, ce qui remplirait l'état. Émettre uniquement, laisser le handler faire le setState.

### CHARACTER_UPDATED
**Déclencheurs (2) dans Sidebar.jsx (CharacterModal) :**
1. `handleToggleVisible` — GM bascule visible/invisible
2. `onChange` du select d'assignation — GM assigne un joueur au character
**Séquence :** PUT REST → succès → `socket.emit(CHARACTER_UPDATED, { characterId })`
**Payload émis :** `{ characterId }`
**Serveur :** vérifie role gm → relit character en DB avec LEFT JOIN users → destructure `gm_notes` → broadcast
**Broadcast :** `io.to(campaignId).emit(CHARACTER_UPDATED, characterPublic)` — character complet sans gm_notes
**Client écoute :** SessionPage.jsx
```javascript
s.on(WS.CHARACTER_UPDATED, (updatedCharacter) => {
  setCharacters(prev => {
    const exists = prev.find(c => c.id === updatedCharacter.id)
    if (!exists) return [...prev, updatedCharacter]  // nouvellement visible pour un joueur
    return prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c)
  })
})
```
**Pourquoi pas fetchSockets() :** `socket.role` inaccessible sur les remote adapters.
Le GM reçoit `characterPublic` (sans gm_notes) par socket, mais il a déjà la version complète
via la réponse REST du PUT — pas de perte d'information.

---

## 4. Flux REST — droits d'accès et ownership

### Tokens

| Route | Accès | Règle ownership |
|---|---|---|
| POST /battlemaps/:id/tokens | GM ou joueur propriétaire | Joueur : `character.user_id === req.user.id` + pas de doublon sur cette battlemap |
| PUT /tokens/:id | GM ou joueur propriétaire | `token.character_id → character.user_id === req.user.id` |
| DELETE /tokens/:id | GM ou joueur propriétaire | idem PUT |

**Contrainte doublon (joueur uniquement) :** un seul token par `character_id` par battlemap.
Le GM peut créer autant de tokens qu'il veut pour le même character.

### Characters

| Route | Accès | Notes |
|---|---|---|
| GET /campaigns/:id/characters | Tous membres | Joueurs : visible=true seulement, jamais gm_notes |
| POST /campaigns/:id/characters | GM | visible=false par défaut |
| PUT /characters/:id | GM ou owner | GM : tous champs. Owner : name, visible, description |
| DELETE /characters/:id | GM | — |

**Retour PUT :** fait un SELECT avec LEFT JOIN users après UPDATE → retourne `owner_username`.
Ne pas utiliser `.returning()` brut — il ne retourne pas les colonnes jointurées.

### Battlemaps

| Route | Accès | Notes |
|---|---|---|
| GET /campaigns/:id/battlemaps | Tous membres | — |
| GET /battlemaps/:id | Tous membres | Tokens filtrés : joueurs voient uniquement visible_to_players=true ET layer != 'gm' |
| POST /campaigns/:id/battlemaps | GM | Avec multer (image optionnelle) |
| PUT /battlemaps/:id | GM | Avec multer (image optionnelle) |
| PUT /battlemaps/:id/voxels | GM | JSON pur, sans multer — routes séparées obligatoires |
| DELETE /battlemaps/:id | GM | Fallback default_battlemap_id si carte d'accueil |

### Campaigns

| Route | Accès | Notes |
|---|---|---|
| GET /campaigns/:id | Tous membres | Retourne campaign + members + battlemaps |

**Membres retournés :** `{ id, username, role, character_name }`.
Utilisé par SessionPage pour calculer `isGm` et peupler `members` (liste déroulante assignation characters).

---

## 5. État React — qui contrôle quoi

### SessionPage.jsx — chef d'orchestre
Tous les états globaux de la session vivent ici.

| État | Type | Source initiale | Mis à jour par |
|---|---|---|---|
| `campaign` | object | GET /campaigns/:id | — |
| `battlemap` | object | GET /battlemaps/:id | onVoxelDataChange |
| `tokens` | array | GET /battlemaps/:id | socket TOKEN_*, handleTokenMove, handleTokenDelete |
| `characters` | array | GET /campaigns/:id/characters | socket CHARACTER_UPDATED, onCharactersChange |
| `members` | array | GET /campaigns/:id | — |
| `isGm` | bool | members.find(m.id === user.id).role | — |
| `socket` | Socket.io instance | io() au montage useEffect | setSocket(s) |
| `messages` | array | socket CHAT_MESSAGE | — |
| `contextMenu` | object/null | handleTokenDoubleClick | setContextMenu(null) |

**Règle d'ordre critique :** `const [socket, setSocket] = useState(null)` doit être déclaré
AVANT tout `useCallback` qui utilise `socket` dans son dependency array.
Violation = `ReferenceError: can't access lexical declaration before initialization`.

### Canvas3D.jsx — props reçues de SessionPage
```
battlemap, tokens, mode, activeMaterial,
onVoxelDataChange, onPackLoaded,
onTokenMove, onTokenDelete, onTokenDoubleClick,
isGm, socket, user, characters
```
`user` et `characters` sont nécessaires pour la vérification d'ownership dans `handleDragStart`.
`socket` est nécessaire pour émettre TOKEN_MOVE, TOKEN_DELETED, VOXEL_ADD, VOXEL_REMOVE.

### Scene (composant interne Canvas3D) — props reçues de Canvas3D
```
voxels, setVoxels, mode, activeMaterial, materials, onDirty,
socket, battlemapId,
tokens, selectedTokenId, onTokenSelect,
gltfScene, onTokenMove, onTokenDelete, onTokenDoubleClick,
isGm, justSelectedRef, user, characters
```

### Sidebar.jsx — props reçues de SessionPage
```
isGm, mode, onModeChange, layer, onLayerChange,
width, onWidthChange, onClose,
activeMaterial, onMaterialChange, availableMaterials,
characters, onCharactersChange, campaignId,
messages, socket, campaignMembers
```
`messages` est contrôlé par SessionPage — Sidebar n'a plus d'état local messages.
`socket` est nécessaire pour émettre CHAT_MESSAGE et CHARACTER_UPDATED.
`campaignMembers` utilisé dans CharacterModal (filtre role === 'player' pour la liste déroulante).

---

## 6. Alignement voxel/grille — décision session 8

### Le problème
Three.js BoxGeometry a son origine au centre du cube.
Un cube à `position=[0,0,0]` occupe visuellement [-0.5, +0.5] sur chaque axe.
La grille drei/Grid a ses lignes aux coordonnées entières 0, 1, 2...
Sans correction : les centres des cubes tombent sur les intersections → les cubes débordent sur 4 cellules.

### La correction (uniquement visuelle — données inchangées)

| Élément | Position rendu | Données en base |
|---|---|---|
| Voxel | `[x+0.5, y+0.5, z+0.5]` | `{x, y, z}` inchangés |
| Grid | `[0, 0, 0]` | lignes aux entiers = bords des cubes |
| TokenMesh (repos) | `baseX+0.5, baseY, baseZ+0.5` | `pos_x, pos_y, pos_z` inchangés |
| TokenMesh (drag) | `dragState.x+0.5, dragState.y, dragState.z+0.5` | — |

**Pourquoi Y non décalé sur les tokens :** `Y_OFFSET = 0.5` dans TokenMesh positionne déjà
le modèle 3D à +0.5 au-dessus de la base du group. Le group est à `baseY` (altitude brute).
L'ensemble s'aligne correctement sur le dessus du voxel sans décalage Y supplémentaire.

**userData conservé brut :** `userData={{ isVoxel: true, position }}` — le raycasting et la
suppression de voxels utilisent les coordonnées brutes, pas les coordonnées visuelles décalées.

### BUG CONNU — validation Y joueur cassée (priorité session 9)
`getColumnTopY` retourne la coordonnée Y brute du voxel le plus haut (entier).
La règle joueur `snappedY >= 1` compare cette valeur brute.
Un voxel au sol (Y=0 en base) donne `getColumnTopY = 0` → `0 >= 1` → drop bloqué.
**Conséquence :** le joueur ne peut pas poser son token sur une carte avec un seul niveau de voxels (Y=0).

**Analyse de getColumnTopY actuel :**
```javascript
const getColumnTopY = (x, z) => {
  let maxY = -1
  for (const v of Object.values(voxels)) {
    if (v.x === x && v.z === z) maxY = Math.max(maxY, v.y)
  }
  return maxY === -1 ? 0 : maxY  // retourne 0 si vide ET si voxel à Y=0 — ambiguïté
}
```
`maxY === -1` signifie "colonne vide". La fonction retourne 0 dans ce cas — même valeur qu'un voxel à Y=0.
**Correction appliquée en session 9 :**
- `getColumnTopY` retourne désormais `maxY` brut : `-1` si colonne vide, `≥0` si voxel trouvé.
- Pendant le drag (altitude visuelle) : `Math.max(0, columnY) + DRAG_HOVER` — évite altitude négative sur case vide.
- Validation drop : `minY = isGm ? -1 : 0` / `maxY = isGm ? 8 : 7`.
  - GM : peut poser dans le vide (`-1`) jusqu'au plafond (`8`).
  - Joueur : voxel obligatoire sous les pieds (`≥0`), pas de mur (`≤7`).
- **Bug résolu** — joueur peut désormais poser sur voxels Y=0.

---

## 7. Règles dependency arrays useCallback/useEffect

Ces erreurs ont causé des bugs silencieux en session 8.

**Règle :** toute valeur extérieure utilisée dans le corps d'un `useCallback` ou `useEffect`
doit être dans son dependency array. Sinon la closure capture la valeur au moment de la création.

**Cas critiques identifiés et corrigés :**

| Callback | Variable manquante | Symptôme |
|---|---|---|
| `handleContextMenuDelete` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleKeyDown` useEffect (Canvas3D) | `socket` | socket?.emit() silencieux |
| `handleCharacterDrop` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleDragStart` (Canvas3D) | `isGm`, `user`, `characters` | ownership check stale |

---

## 8. Conventions non-négociables — rappel rapide

- **UUID partout** en base — jamais `increments()`, jamais `integer()` pour les FK
- **threeToDb(tx, ty, tz)** → `{ pos_x: tx, pos_y: tz, pos_z: ty }` — mapping Three.js ↔ DB, jamais inline
- **WS.CONSTANTE** toujours — jamais de chaîne en dur dans socket.emit/on
- **Multer et JSON pur incompatibles** — routes séparées obligatoires (PUT /battlemaps/:id vs PUT /battlemaps/:id/voxels)
- **knexfile.cjs** en CommonJS — la CLI Knex ne supporte pas ES Modules
- **Commande migrations Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`
- **socket.role inaccessible via fetchSockets()** — broadcaster à tous et filtrer le contenu
- **owner_id sur tokens = mort** — ownership toujours via character_id → characters.user_id
- **returning() brut ne joint pas** — après UPDATE sur characters, faire un SELECT avec LEFT JOIN users

---

## 11. Flux internes Canvas3D — détail session 9

### Chaîne de données : placement token (drop depuis Sidebar)
```
SessionPage : handleCharacterDrop
  → POST /battlemaps/:id/tokens
  → socket.emit(WS.TOKEN_CREATED, { tokenId })
  → serveur relit token → broadcast TOKEN_CREATED { token }
  → SessionPage : setTokens (guard doublon)
  → Canvas3D reçoit tokens[] mis à jour via props
```

### Chaîne de données : déplacement token (drag dans Canvas3D)
```
TokenMesh : onPointerDown → handleDragStart (vérif ownership)
  → dragRef.current.active = true, orbitControls.enabled = false
  → pointermove : raycastGround(Y=0) → getColumnTopY → setDragState { x, y, z, tiltX, tiltZ }
  → TokenMesh lit dragState → position visuelle mise à jour en temps réel
  → pointerup : raycastGround → getColumnTopY → validation minY/maxY
  → PUT /tokens/:id (threeToDb)
  → socket.emit(WS.TOKEN_MOVE, { tokenId, pos_x, pos_y, pos_z })
  → onTokenMove(res.data.token) → SessionPage : setTokens
```

### Chaîne de données : suppression token (touche Suppr)
```
Canvas3D : document keydown (GM + selectedTokenId)
  → DELETE /tokens/:id
  → onTokenDelete(tokenId) → SessionPage : setTokens filter
  → socket.emit(WS.TOKEN_DELETED, { tokenId })
  → serveur broadcast → autres clients : setTokens filter
```

### Chaîne de données : édition voxel (mode edit, GM)
```
Canvas3D : mousedown sur canvas
  → clic gauche : raycasting voxels → pose sur face ou sol → setVoxels + socket.emit(WS.VOXEL_ADD)
  → clic droit : raycasting voxels → suppression → setVoxels + socket.emit(WS.VOXEL_REMOVE)
  → serveur : UPDATE voxel_data en DB → broadcast VOXEL_ADDED/REMOVED
  → Scene : useEffect socket → setVoxels (temps réel joueurs)
  → sauvegarde auto 60s si dirty, ou à la sortie du mode edit
```

### getColumnTopY — contrat post session 9
```javascript
// Retourne -1 si colonne vide, Y brut (≥0) si voxel trouvé
// Usage drag    : Math.max(0, columnY) + DRAG_HOVER  → altitude visuelle ≥ 0
// Usage drop    : snappedY >= minY (isGm ? -1 : 0) && snappedY <= maxY (isGm ? 8 : 7)
```

### Props Canvas3D — flux descendant
```
SessionPage
  → Canvas3D : battlemap, tokens, mode, activeMaterial, isGm, socket, user, characters,
               onVoxelDataChange, onPackLoaded, onTokenMove, onTokenDelete, onTokenDoubleClick
  → Scene    : + voxels, setVoxels, materials, onDirty, battlemapId,
               selectedTokenId, onTokenSelect, gltfScene, justSelectedRef
  → TokenMesh: token, gltfScene, isSelected, onDragStart, onTokenDoubleClick, dragState
```

---

## 12. Flux authentification — détail auth.js

### JWT — contenu et limites
```
Signé avec : { id, email, username }  — color ABSENTE du JWT
Durée : 7 jours
Cookie : httpOnly, sameSite=lax, secure en production
```
- `req.user` (injecté par requireAuth) : `{ id, email, username, iat, exp }`
- `color` jamais dans le JWT — toujours relire la DB pour l'avoir
- Si username/email change via PUT /users/me : JWT devient inexact mais fonctionnel
  car GET /auth/me relit toujours la DB. Rafraîchi à la prochaine connexion.

### Flux register
```
POST /auth/register { email, password, username }
  → validation présence + longueur password (≥8)
  → vérif email unique
  → bcrypt.hash(password, 12)
  → randomColor() — palette 12 teintes
  → INSERT users { email, password_hash, username, color }
  → jwt.sign { id, email, username }
  → res.cookie('token', ...) + res.json({ user })
```

### Flux login
```
POST /auth/login { email, password }
  → db('users').where({ email }).first()
  → bcrypt.compare(password, user.password_hash)
  → jwt.sign { id, email, username }
  → res.cookie('token', ...) + res.json({ user: { id, email, username, color } })
```

### Flux me
```
GET /auth/me  [requireAuth]
  → db('users').where({ id: req.user.id }).select([id, email, username, color])
  → res.json({ user })
```
Source de vérité côté client — appelé au montage de App.jsx.
authStore.user = { id, email, username, color } après cet appel.

### COOKIE_OPTIONS (référence)
```javascript
{ httpOnly: true, secure: NODE_ENV==='production', sameSite: 'lax', maxAge: 7j }
```

---

## 13. Flux profil utilisateur — PUT /api/users/me (session 9)

### Route
```
PUT /api/users/me  [requireAuth]
Body (tous optionnels) : { username, email, color, password, current_password }
```

### Règles de validation
- Au moins un champ à modifier requis
- Si `email` fourni : vérifier unicité (pas déjà pris par un autre user)
- Si `password` fourni : `current_password` obligatoire + bcrypt.compare contre hash actuel
- Si `color` fourni : format hex #RRGGBB (7 caractères)
- `username` : pas de contrainte de format (cohérent avec register)

### Retour
```javascript
res.json({ user: { id, email, username, color } })
```

### Impact authStore côté client
Après PUT /users/me réussi : appeler GET /auth/me ou mettre à jour authStore directement.
Le JWT reste valide (pas régénéré) — GET /auth/me relit la DB donc cohérent.

### Montage index.js
```javascript
import usersRouter from './routes/users.js'
app.use('/api/users', usersRouter)
```

---

## 14. Structure index.js — routes montées (référence session 9)

```
/api/health             GET  — santé serveur
/api/auth               → authRouter
/api/campaigns          → campaignsRouter
/api/campaigns/:id/characters → charactersRouter (mergeParams)
/api/characters         → charactersActionsRouter (PUT/:id, DELETE/:id)
/api/campaigns/:id/battlemaps → battlemapsRouter
/api/battlemaps         → battlemapsRouter
/api/battlemaps/:id/tokens → tokensRouter
/api/tokens             → tokensRouter
/api/textures           → texturesRouter  (monté AVANT express.json)
/api/assets             → assetsRouter    (monté AVANT express.json)
/api/users              → usersRouter     (à ajouter session 9)
```

Ordre middleware obligatoire :
1. dotenv (tout premier import)
2. cors + express.json + cookieParser
3. /api/textures + /api/assets (avant les autres)
4. Routes
5. errorHandler (dernier)

---

## 15. Flux profil utilisateur — DashboardPage (session 9)

### Déclencheur
Clic sur le bouton `usernameBtn` (header DashboardPage) → `handleOpenProfile`
→ pré-remplit `profileForm` depuis `authStore.user`
→ `setShowProfile(true)`

### Modale profil — comportement
- Fermeture : clic overlay (`onMouseDown` sur l'overlay) ou bouton Annuler
- `onMouseDown` sur la modale elle-même stoppe la propagation (empêche fermeture)
- Sauvegarde au submit uniquement (pas au blur)

### handleProfileSave — logique diff
```
body = {} — seulement les champs qui ont changé vs user actuel
username : inclus si différent de user.username
email    : inclus si différent de user.email
color    : inclus si différent de user.color
password : inclus si non vide (+ current_password obligatoire)
Si body vide → fermeture sans appel serveur
```

### Flux PUT /users/me → authStore
```
api.put('/users/me', body)
  → res.data.user { id, email, username, color }
  → setUser(res.data.user)  ← authStore mis à jour immédiatement
  → username/color reflétés dans le header sans rechargement
```

### authStore — exports confirmés (session 9)
```javascript
{ user, isLoading, setUser, clearUser }
// setUser(user) → set({ user, isLoading: false })
// clearUser()   → set({ user: null, isLoading: false })
```

---

## 16. Flux MAP_SWITCH — barre GM (session 9)

### Payload émis par le client GM
```javascript
socket.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
// userIds vide = tous les joueurs de la campagne
// userIds rempli = joueurs spécifiques (affectation individuelle)
```

### Traitement serveur (socket/index.js)
```
Reçoit : { battlemapId, userIds }
  → vérifie socket.role === 'gm'
  → relit battlemap en DB
  → si userIds vide : charge tous les members role='player' de la campagne
  → UPDATE player_locations (upsert campaign_id + user_id → battlemap_id)
  → broadcast io.to(campaignId).emit(MAP_SWITCH, { battlemapId, userIds: targets })
```

### Écoute côté client (SessionPage)
```javascript
s.on(WS.MAP_SWITCH, ({ battlemapId, userIds }) => {
  // Si userIds inclut user.id (ou vide = tous) → charger la nouvelle carte
  const concerned = userIds.length === 0 || userIds.includes(user.id)
  if (!concerned) return
  // GET /battlemaps/:battlemapId → setBattlemap + setTokens
})
```
**Note :** le GM émet MAP_SWITCH mais reçoit aussi le broadcast.
Il doit charger la carte localement lui aussi (ou filtrer userIds).
Décision retenue : le GM charge toujours la carte qu'il switche —
c'est lui qui la choisit, il doit la voir.

### Barre GM — comportement UI
- Visible GM uniquement (isGm)
- Position : barre horizontale fixe en haut du canvas
- Contenu : liste des battlemaps de la campagne (chargée au montage)
- Clic sur une carte → charge localement + émet MAP_SWITCH { battlemapId, userIds: [] }
- Carte active mise en évidence visuellement

### États ajoutés dans SessionPage
```javascript
const [battlemaps, setBattlemaps] = useState([])
// Chargé via GET /campaigns/:id/battlemaps au montage
// Utilisé par la barre GM pour afficher la liste
```

---

## 17. Référence complète events.js (shared/events.js)

```javascript
SESSION_JOIN / SESSION_JOINED / SESSION_USER_JOINED / SESSION_USER_LEFT
TOKEN_MOVE / TOKEN_MOVED / TOKEN_CREATED / TOKEN_DELETED / TOKEN_UPDATED
VOXEL_ADD / VOXEL_ADDED / VOXEL_REMOVE / VOXEL_REMOVED
DICE_ROLL / DICE_RESULT
MAP_SWITCH / MAP_VIEWPORT
DOC_SHARED
CHARACTER_UPDATED
CHAT_MESSAGE
```

---

## 18. Référence socket/index.js — handlers complets (session 9)

| Événement reçu | Vérif rôle | Action DB | Broadcast |
|---|---|---|---|
| SESSION_JOIN | membre | — | SESSION_JOINED (émetteur) + SESSION_USER_JOINED (autres) |
| TOKEN_MOVE | GM ou owner (character_id→user_id) | UPDATE tokens pos | TOKEN_MOVED à toute la room |
| TOKEN_CREATED | — | relit token | TOKEN_CREATED { token } à toute la room |
| TOKEN_DELETED | — | — | TOKEN_DELETED { tokenId } à toute la room |
| VOXEL_ADD | GM | UPDATE voxel_data | VOXEL_ADDED à toute la room |
| VOXEL_REMOVE | GM | UPDATE voxel_data | VOXEL_REMOVED à toute la room |
| MAP_SWITCH | GM | UPSERT player_locations | MAP_SWITCH { battlemapId, userIds } à toute la room |
| MAP_VIEWPORT | GM | — | MAP_VIEWPORT aux autres (pas émetteur) |
| DICE_ROLL | — | — (TODO) | — |
| CHAT_MESSAGE | — | — | CHAT_MESSAGE { userId, username, text, timestamp } à toute la room |
| CHARACTER_UPDATED | GM | relit character + JOIN users | CHARACTER_UPDATED (sans gm_notes) à toute la room |
| disconnect | — | — | SESSION_USER_LEFT aux autres |

---

## 19. Flux menu contextuel barre GM (session 9)

### Déclencheur
`onContextMenu` sur bouton carte dans la barre GM
→ `setMapContextMenu({ bm, x, y })`
→ menu HTML en `position: fixed`, même pattern que contextMenu token

### Fermeture
`useEffect` sur `mapContextMenu` → `mousedown` sur document
→ ferme si clic hors `mapContextMenuRef`

### Actions et flux

**Renommer**
```
setRenameTarget(bm) + setRenameValue(bm.name) + setShowRenameModal(true)
→ modale → PUT /battlemaps/:id { name }
→ setBattlemaps (map) + setBattlemap si carte active
```

**Définir comme page d'accueil**
```
PUT /campaigns/:campaignId { default_battlemap_id: bm.id }
→ setCampaign (local)
```
Note : PUT /campaigns/:id accepte désormais `default_battlemap_id` (ajouté session 9).

**Déplacer le groupe**
```
handleMapSwitch(bm.id)
→ GET /battlemaps/:id → setBattlemap + setTokens
→ socket.emit(MAP_SWITCH, { battlemapId, userIds: [] })
```

**Dupliquer**
```
POST /battlemaps/:id/duplicate
→ setBattlemaps([...prev, res.data.battlemap])
```
Correction session 9 : `voxel_data` doit être `JSON.stringify()` avant INSERT
— Knex/pg ne sérialise pas automatiquement si la valeur est déjà un objet JS lu depuis JSONB.

**Supprimer**
```
window.confirm → DELETE /battlemaps/:id
→ setBattlemaps (filter)
→ si carte active : handleMapSwitch(remaining[0].id) ou setBattlemap(null)
```

**Nouvelle carte**
```
setShowCreateModal(true)
→ modale → POST /campaigns/:id/battlemaps { name }
→ setBattlemaps([...prev, res.data.battlemap])
```

### Nouveaux états SessionPage (session 9)
```javascript
mapContextMenu     // { bm, x, y } | null
mapContextMenuRef  // ref pour fermeture clic ailleurs
showRenameModal    // bool
renameTarget       // bm | null
renameValue        // string
showCreateModal    // bool
createMapName      // string
```

### Correction campaigns.js — PUT /:id (session 9)
Avant : acceptait uniquement `name` et `status`.
Après : accepte aussi `default_battlemap_id`.
Pattern updates object — seulement les champs définis dans le body.

---

## 20. Flux présence en ligne — Onglet Joueurs (session 9)

### Problème résolu
`SESSION_USER_JOINED` n'est émis qu'aux membres déjà connectés.
Un joueur qui arrive après le GM ne reçoit jamais le join du GM.
Solution : le serveur inclut la liste des connectés dans le payload `SESSION_JOINED`.

### Piège fetchSockets() — rappel §1
`socket.user` est une propriété custom locale — **inaccessible** via `fetchSockets()`.
Solution : stocker `socket.user.id` dans `socket.data.userId` (accessible sur les remote adapters).
```javascript
socket.data.userId = socket.user.id  // au moment du SESSION_JOIN
// puis via fetchSockets :
const ids = sockets.map(s => s.data.userId).filter(Boolean)
```

### Flux SESSION_JOIN modifié (socket/index.js)
```
socket.join(campaignId)
socket.data.userId = socket.user.id   ← NEW
fetchSockets() → onlineUserIds (filtre userId courant)
socket.emit(SESSION_JOINED, { ..., onlineUserIds })  ← NEW
socket.to(campaignId).emit(SESSION_USER_JOINED, { userId, ... })
```

### Flux présence côté client (SessionPage)
```javascript
// État
const [onlineUsers, setOnlineUsers] = useState(new Set())

// SESSION_JOINED — initialise avec soi-même + tous les connectés
s.on(WS.SESSION_JOINED, ({ userId, onlineUserIds = [] }) => {
  setOnlineUsers(new Set([userId, ...onlineUserIds]))
})
// SESSION_USER_JOINED — quelqu'un arrive
s.on(WS.SESSION_USER_JOINED, ({ userId }) => {
  setOnlineUsers(prev => new Set([...prev, userId]))
})
// SESSION_USER_LEFT — quelqu'un part
s.on(WS.SESSION_USER_LEFT, ({ userId }) => {
  setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next })
})
```

### Onglet Joueurs Sidebar
- `onlineUsers` passé comme prop `Set<userId>` de SessionPage → Sidebar
- `onlineUsers.has(member.id)` → point vert/gris
- Nom du personnage : `characters.find(c => c.user_id === member.id)?.name` — calculé côté client, pas de JOIN serveur
- Badges MJ/Joueur depuis `member.role`

---

## 21. Flux chat amélioré — session 9

### Structure d'un message dans `messages` state (SessionPage)
```javascript
// Message normal
{ id, user, color, text, time }
// Message système (connexion/déconnexion)
{ id, system: true, text, time }
```

### color dans CHAT_MESSAGE
Le serveur lit `users.color` depuis la DB dans le handler CHAT_MESSAGE.
La couleur n'est pas dans le JWT — elle doit être relue à chaque message.
```javascript
// socket/index.js — handler CHAT_MESSAGE
const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
io.to(campaignId).emit(WS.CHAT_MESSAGE, { userId, username, color, text, timestamp })
```

### Messages système connexion/déconnexion
Générés côté client dans SessionPage, injectés dans `messages` :
```javascript
s.on(WS.SESSION_USER_JOINED, ({ userId, username }) => {
  setOnlineUsers(...)
  setMessages(prev => [...prev, { id, system: true, text: `${username} a rejoint...`, time }])
})
```

### Reconnexion socket après changement username
**Problème :** `socket.user.username` vient du JWT lu à la connexion.
Après PUT /users/me, le JWT est régénéré dans le cookie mais le socket existant garde l'ancien username.

**Solution : pattern reconnectTrigger**
```javascript
// SessionPage
const [reconnectTrigger, setReconnectTrigger] = useState(0)
useEffect(() => {
  const s = io(...)
  // ... tous les handlers ...
  return () => s.disconnect()
}, [campaignId, reconnectTrigger])  // ← re-run si trigger change
```
Sidebar reçoit `onReconnectSocket` prop → appelle `setReconnectTrigger(n => n + 1)`.
Le cleanup du useEffect déconnecte proprement l'ancien socket.
Le nouveau socket recrée une connexion avec le nouveau cookie JWT.

**Piège évité :** ne jamais appeler `socket.disconnect/connect` directement depuis Sidebar.
Sidebar ne possède pas le socket — SessionPage le possède et gère son cycle de vie.

### JWT régénéré dans PUT /users/me (users.js)
Si `username` ou `email` change → nouveau cookie JWT émis dans la réponse.
Sans ça, le nouveau username n'apparaîtrait dans le chat qu'après déconnexion complète.

## 22. Chantier 1 — Serveur seul émetteur WS (session 11)

### Règle fondamentale instaurée
Le serveur est désormais le seul émetteur d'événements WS suite à une action REST.
Le client ne broadcast jamais après un appel REST.
Pattern d'accès à io depuis une route : `const io = req.app.get('io')`
Rendu possible par `app.set('io', io)` dans server/src/index.js (après création de io).

### Flux TOKEN_CREATED — nouveau (remplace l'ancien)
**Déclencheur :** drag character depuis Sidebar → POST /battlemaps/:id/tokens → succès
**Ancien émetteur :** SessionPage.jsx (handleCharacterDrop) après POST REST
**Nouvel émetteur :** route REST POST /battlemaps/:id/tokens
**Séquence :**
```
POST /battlemaps/:id/tokens → INSERT → io.to(campaign_id).emit(TOKEN_CREATED, { token })
```
**campaign_id :** lu depuis `battlemap.campaign_id` (battlemap chargé en haut de la route).
**Client écoute :** SessionPage.jsx — guard doublon toujours actif (l'émetteur reçoit aussi le broadcast).
**État local :** `setTokens(prev => [...prev, res.data.token])` dans handleCharacterDrop conservé —
double ajout bénin grâce au guard doublon dans le handler socket.

### Flux TOKEN_MOVED — nouveau (remplace l'ancien)
**Déclencheur :** drag token → drop → PUT /tokens/:id → succès
**Ancien émetteur :** Canvas3D.jsx (handlePointerUp) après PUT REST
**Nouvel émetteur :** route REST PUT /tokens/:id
**Séquence :**
```
PUT /tokens/:id → UPDATE → io.to(campaign_id).emit(TOKEN_MOVED, { tokenId, pos_x, pos_y, pos_z })
```
**campaign_id :** lu depuis `battlemap.campaign_id` (battlemap chargé dans la route).
**Payload :** `{ tokenId, pos_x, pos_y, pos_z }` — identique au handler socket TOKEN_MOVE existant.
**Note :** double broadcast bénin pendant la période de transition (route REST + handler socket TOKEN_MOVE).
Le handler socket TOKEN_MOVE conservé temporairement — à supprimer dans un chantier dédié.

### Flux TOKEN_DELETED — nouveau (remplace l'ancien)
**Déclencheurs (2) :**
1. Touche Suppr/Backspace sur token sélectionné — Canvas3D.jsx (handleKeyDown), GM uniquement
2. Menu contextuel "Retirer du plateau" — SessionPage.jsx (handleContextMenuDelete), GM ou owner
**Ancien émetteur :** le client après DELETE REST
**Nouvel émetteur :** route REST DELETE /tokens/:id
**Séquence :**
```
DELETE /tokens/:id → DELETE DB → io.to(campaign_id).emit(TOKEN_DELETED, { tokenId })
```
**État local :** `handleTokenDelete(tokenId)` conservé dans les handlers client — double suppression
bénine (filter idempotent sur id déjà absent).

### Flux CHARACTER_UPDATED — nouveau (remplace l'ancien)
**Déclencheurs (2) dans Sidebar.jsx (CharacterModal) :**
1. `handleToggleVisible` — GM bascule visible/invisible
2. `onChange` du select d'assignation — GM assigne un joueur au character
**Ancien émetteur :** Sidebar.jsx après PUT REST (`socket.emit(CHARACTER_UPDATED, { characterId })`)
**Nouvel émetteur :** route REST PUT /characters/:id (actionsRouter)
**Séquence :**
```
PUT /characters/:id → UPDATE → SELECT + JOIN → destructure gm_notes
→ io.to(campaign_id).emit(CHARACTER_UPDATED, characterPublic)
```
**campaign_id :** lu depuis `updatedCharacter.campaign_id` (présent dans le SELECT).
**gm_notes :** toujours filtré avant broadcast — `const { gm_notes: _gm_notes, ...characterPublic } = updatedCharacter`
**Note :** double broadcast bénin pendant la période de transition (route REST + handler socket CHARACTER_UPDATED).

### Emit conservés côté client — ne pas supprimer
- `MAP_SWITCH` dans SessionPage.handleMapSwitch — commande GM volontaire, pas un broadcast post-écriture
- `VOXEL_ADD` / `VOXEL_REMOVE` dans Canvas3D.handleClick — édition temps réel socket, pas post-REST
- `CHAT_MESSAGE` dans Sidebar.sendMessage — pas un post-REST

### Piège P12 — VOXEL_ADD undefined battlemapId
`[WS] voxel:add error: Undefined binding(s) detected. Undefined column(s): [id]`
Cause : `battlemapId` est `undefined` dans le payload si `battlemap` est null au moment du clic
(entre deux chargements de carte).
Le handler socket tente `db('battlemaps').where({ id: undefined })` → Knex rejette.
Correction : ajouter `if (!battlemapId) return` en début des handlers VOXEL_ADD et VOXEL_REMOVE
dans socket/index.js.
À faire dans la prochaine session qui touche socket/index.js.

## 23. Chantier 2 — Timestamps + updated_at dans les payloads (session 12)

### Règle updated_at dans les routes PUT
Tout PUT en base doit inclure `updated_at: db.fn.now()` dans l'objet updates.
Pattern obligatoire :
```javascript
const updates = {}
// ... construire updates ...
if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')
// updated_at APRÈS le guard — jamais avant
updates.updated_at = db.fn.now()
await db('table').where({ id }).update(updates).returning('*')
```

Fichiers concernés : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js.
Exception : users.js — updated_at dans returning mais JAMAIS dans le payload JWT.

### updated_at dans les payloads WS
TOKEN_MOVED broadcast : `{ tokenId, pos_x, pos_y, pos_z, updated_at }`
CHARACTER_UPDATED broadcast : inclut updated_at via re-SELECT étendu.
TOKEN_CREATED : automatique via returning('*').

### Handler TOKEN_MOVED côté client — guard obsolescence
```javascript
s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) => {
  setTokens(prev => prev.map(t => {
    if (t.id !== tokenId) return t
    // Double null-check — updated_at peut être absent sur anciens tokens
    if (updated_at && t.updated_at && updated_at < t.updated_at) return t
    return { ...t, pos_x, pos_y, pos_z, updated_at }
  }))
})
```

### Piège P13 — updated_at après le guard Object.keys
Ne jamais ajouter `updated_at` dans `updates` avant le guard `Object.keys(updates).length === 0`.
Si `updates` ne contient que `updated_at`, le guard ne lève pas d'erreur et un update inutile
est exécuté. Toujours placer `updates.updated_at = db.fn.now()` après le guard.

### Piège P14 — updated_at jamais dans le JWT
users.js régénère le JWT si username ou email change.
`updated_at` ne doit jamais être dans le payload JWT — il n'a pas de valeur d'identité.
Le JWT contient uniquement : `{ id, email, username }`.

### Bug B corrigé — VOXEL_ADD guard battlemapId
socket/index.js handler VOXEL_ADD :
```javascript
if (!battlemapId) return  // guard — battlemapId undefined entre deux chargements de carte
```
Placé après le check role gm, avant toute requête DB.

---

## 24. Chantier 4 partiel + Bug C — Reconnexion (session 12)

### loadSession — pattern extrait
`load()` dans SessionPage extraite en `useCallback loadSession`.
Déclarée AVANT `useState socket` et AVANT le useEffect socket — ordre React obligatoire.
Dependency array : `[campaignId, user?.id]`.

```javascript
const loadSession = useCallback(async () => {
  // GET /campaigns/:id + GET /battlemaps/:id + GET /characters + GET /battlemaps
}, [campaignId, user?.id])

useEffect(() => { loadSession() }, [loadSession])
```

useEffect socket dependency array : `[campaignId, reconnectTrigger, loadSession]`.

### Bug C — Reconnexion post-redémarrage serveur
**Symptôme :** après redémarrage serveur, socket se reconnecte (transport OK)
mais SESSION_JOIN n'est pas ré-émis → socket hors room → broadcasts perdus.
F5 résout le problème.

**Cause :** SESSION_JOIN n'est émis qu'au montage du useEffect socket.
Lors d'une reconnexion automatique socket.io, le useEffect ne se ré-exécute pas.

**Tentative échouée session 12 :** handler `s.on('reconnect', ...)` — non fonctionnel.
Cause probable : socket.io-client v4 a changé le nom de l'événement (reconnect → connect).
Décision : pas de bricolage — solution robuste uniquement.

**Solution cible — Chantier 5 :**
- Côté serveur : émettre WS.SESSION_STATE dans SESSION_JOINED
  (tokens filtrés par rôle, characters sans gm_notes pour les joueurs, battlemap, onlineUsers)
- Côté client : handler `connect` dans sessionStore Zustand
  → ré-émet SESSION_JOIN → SESSION_STATE arrive en réponse et hydrate le store
- `connect` se déclenche à la connexion initiale ET à chaque reconnexion automatique (v4)
- Plus de dépendance à un nom d'événement versionsensible

**Piège P15 — ne pas bricoler la reconnexion socket**
Le handler `reconnect` de socket.io-client v3 ne fonctionne pas en v4.
Le bon événement en v4 est `connect` — mais il se déclenche aussi à la connexion initiale.
Sans store Zustand pour gérer le cycle de vie, implémenter ça proprement est impossible
sans introduire un flag `isFirstConnect` qui est lui-même un pansement.
Attendre le Chantier 5 — solution complète dans MISSION_chantier5 addendum session 12.
---

## 25. Chantier 3 — Format voxel optimisé `"x:y:z": mat` (session 13)

### Deux représentations — règle NON NÉGOCIABLE

**Base de données (JSONB) :**
```json
{ "1:2:3": 1, "4:0:2": 2 }
```
Clé = `"x:y:z"` (deux-points). Valeur = entier `mat` seul.

**Mémoire React (état local Canvas3D) :**
```javascript
{ "1:2:3": { x: 1, y: 2, z: 3, mat: 1 }, "4:0:2": { x: 4, y: 0, z: 2, mat: 2 } }
```
Même clé, valeur enrichie pour le rendu.

### Flux VOXEL_ADD (socket)
```
Client Canvas3D → socket.emit(VOXEL_ADD, { battlemapId, x, y, z, mat })
Serveur socket/index.js :
  voxels = battlemap.voxel_data || {}
  key = `${x}:${y}:${z}`
  next = { ...voxels, [key]: mat }
  UPDATE battlemaps SET voxel_data = JSON.stringify(next)
  io.to(campaignId).emit(VOXEL_ADDED, { battlemapId, x, y, z, mat })
Client Canvas3D (handler VOXEL_ADDED) :
  key = getVoxelKey(x, y, z)  // "x:y:z"
  setVoxels(prev => ({ ...prev, [key]: { x, y, z, mat } }))
```

### Flux VOXEL_REMOVE (socket)
```
Client Canvas3D → socket.emit(VOXEL_REMOVE, { battlemapId, x, y, z })
Serveur socket/index.js :
  voxels = battlemap.voxel_data || {}
  key = `${x}:${y}:${z}`
  next = { ...voxels }; delete next[key]
  UPDATE battlemaps SET voxel_data = JSON.stringify(next)
  io.to(campaignId).emit(VOXEL_REMOVED, { battlemapId, x, y, z })
Client Canvas3D (handler VOXEL_REMOVED) :
  key = getVoxelKey(x, y, z)
  setVoxels(prev => { const next = { ...prev }; delete next[key]; return next })
```

### Flux sauvegarde REST (PUT /battlemaps/:id/voxels)
```
Canvas3D save(currentVoxels) :
  payload = {}
  for ([key, v] of Object.entries(currentVoxels)) payload[key] = v.mat  // projection mémoire → base
  api.put('/battlemaps/:id/voxels', { voxel_data: payload })
Serveur battlemaps.js PUT /:id/voxels :
  validation : typeof === 'object' && !Array.isArray
  UPDATE battlemaps SET voxel_data = JSON.stringify(voxel_data)
```

### Flux initialisation (chargement battlemap)
```
GET /battlemaps/:id → battlemap.voxel_data = { "x:y:z": mat, ... }  (Knex parse le JSONB)
Canvas3D useEffect :
  for ([key, mat] of Object.entries(battlemap.voxel_data)) {
    [x, y, z] = key.split(':').map(Number)
    map[key] = { x, y, z, mat }
  }
  setVoxels(map)
```

### Piège P16 — projection obligatoire dans save()
`save()` reçoit la mémoire React `{ "x:y:z": { x, y, z, mat } }`.
Envoyer cette structure telle quelle en base stockerait des objets imbriqués.
Au rechargement, `materialId` recevrait un objet → `<Voxel>` ne rendrait rien (bug silencieux).
**Toujours projeter `payload[key] = v.mat` avant l'appel REST.**

### Piège P17 — séparateur ":" non négociable
La clé utilise `":"` comme séparateur (convention voxel engines, non ambigu, lisible en psql).
`getVoxelKey(x, y, z) = \`\${x}:\${y}:\${z}\``
Ne jamais utiliser `","` — crée une divergence entre spec, code et base.