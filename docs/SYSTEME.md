# SYSTEME.md — Flux, règles et pièges du projet Enclume
> Dernière mise à jour : 2026-04-21 Session 33
> Ce document répond à "qui fait quoi, qui parle à qui, pourquoi" — pas à "qu'est-ce qui existe".
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

## 2. Ownership des tokens — règle fondamentale

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

## 3. Stores Zustand — qui possède quoi

| Store | Données | Qui lit | Qui écrit |
|---|---|---|---|
| `authStore` | user, isLoading | partout | App.jsx (GET /me), users.js route |
| `tokenStore` | tokens[] | Canvas3D (Scene), Sidebar | SessionPage (WS handlers) |
| `characterStore` | characters[], members[], isGm | Canvas3D, Sidebar, SessionPage | SessionPage (loadSession, WS) |
| `mapStore` | battlemap, battlemaps | Canvas3D, Editor3D, SessionPage | SessionPage (loadSession, MAP_SWITCH) |
| `sessionStore` | messages[], onlineUsers | Sidebar | SessionPage (WS handlers) |
| `entityStore` | entities[], blueprints{} | Canvas3D, Editor3D, SessionPage | SessionPage (loadSession, MAP_SWITCH, WS) |

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
upsertBlueprint(blueprint)           // futur
```

**⚠ Bug connu session 33** : blueprints créés depuis WorkshopPage n'apparaissent pas dans entityStore
car le store est chargé au SESSION_JOIN depuis la session active — pas depuis l'Atelier.
Fix : recharger entityStore ou rafraîchir la session après création blueprint.

---

## 4. WebSocket — événements et ownership

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
| TOKEN_MOVE | client | serveur | Déplacer un token |
| TOKEN_MOVED | serveur | room | Position mise à jour |
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
| ENTITY_ACTION_REQUEST | client (joueur) | serveur | Demande interaction entité |
| ENTITY_ACTION_PENDING | serveur | GM socket | Notification arbitrage |
| ENTITY_ACTION_RESOLVE | client (GM) | serveur | Décision GM |
| ENTITY_ACTION_RESULT | serveur | joueur socket | Résultat (refus/timeout/jet) |
| ENTITY_CREATED | client (GM) | serveur → room | Entité posée |
| ENTITY_DELETED | client (GM) | serveur → room | Entité supprimée |
| ENTITY_UPDATED | serveur | room | État entité changé |
| ENTITY_MOVED | client (GM) | serveur → room | Entité déplacée |

---

## 5. Flux Atelier du GM — WorkshopPage (session 33)

### Route
`/workshop` remplace `/texture-packs`. Redirect en place pour les bookmarks.

### Onglets
```
Textures    → PNG bruts uploadés dans le pack
Matériaux   → VoxelBuilderTab — voxel_textures (géométrie + faces PNG)
Éléments interactifs → EntityBuilderTab — entity_blueprints (apparence + comportement)
```

### Workflow GM
```
1. Uploader PNG (onglet Textures)
2A. Créer un Matériau → voxel_textures.faces = { all: "uuid.png" }
    Utilisé sur la carte : voxel_data[key].tex = voxel_textures.id
2B. Créer un Élément interactif → blueprint.geometry.faces = { east: "uuid.png", ... }
    Les deux partent du même PNG brut — aucune dépendance entre eux.
```

### Ownership packs
`pack.created_by === req.user.id` — `requireRole` inutilisable (hors session).

### Upload GLB blueprint
```
POST /api/entity-blueprints/:id/upload-glb
  multerGlb.single('glb')
  → MinIO: glb/<blueprint_id>.glb
  → blueprint.glb_url = "glb/<id>.glb?v=<timestamp>"  (P19)
```

---

## 6. Format faces entités — chemins PNG (session 33)

### Format geometry.faces — NOUVEAU depuis session 33
```json
{
  "width": 1, "height": 2, "depth": 1,
  "faces": {
    "east":   "uuid1.png",
    "west":   "uuid1.png",
    "top":    "uuid2.png",
    "bottom": null,
    "south":  "uuid1.png",
    "north":  "uuid1.png"
  }
}
```
- Chemins PNG relatifs au pack — `pack_id` obligatoire sur le blueprint (PEF1)
- `null` = face invisible (PE4)
- **PAS d'integers voxel_texture_id** — format cassé avant session 33

### Format states.visual_override.face_overrides — NOUVEAU
```json
{ "north": "uuid3.png", "top": null }
```
Même format chemins PNG. `null` = invisible dans cet état.

### Chargement Canvas3D — entityTextureMaterials
```javascript
// Pour chaque blueprint présent sur la carte :
fakeTexObjs.push({
  id: `${bp.id}__base`,
  pack_id: bp.pack_id,
  faces: bp.geometry.faces,
})
// + un fakeTexObj par état avec face_overrides (fusionnés avec base)

// loadVoxelTextures(fakeTexObjs) → flat { ["uuid__base"]: { faceMaterials } }

// Restructuration :
entityTextureMaterials = {
  [bp.id]: {
    base: { faceMaterials: [...6 mats...] },
    states: { [stateId]: { faceMaterials: [...6 mats...] } }
  }
}
```

### Accès dans EntityMeshVoxel
```javascript
const buckets = entityTextureMaterials?.[blueprint.id]
const mats = currentState
  ? (buckets?.states?.[currentState.id] ?? buckets?.base)
  : buckets?.base
const mat = mats?.faceMaterials?.[i]
```

### Pièges format faces
| Code | Description |
|---|---|
| PEF1 | pack_id obligatoire sur blueprint — guard si null avant chargement |
| PEF2 | fakeTexObj conforme : `{ id, pack_id, faces }` — faces = chemins PNG |
| PEF3 | entityTextureMaterials indexé par `blueprint.id` UUID — jamais par faceId |
| PEF4 | face_overrides états = même format chemin PNG |
| PEF5 | Blueprints sans pack_id → skip + rendu magenta (debug) |
| PEF6 | Canvas3D : deux zones séparées — voxels via `/voxel-textures?ids=`, entités via fakeTexObjs |

---

## 7. Flux voxels — coordonnées et format

### Coordonnées voxel
```javascript
// Base = entiers bruts
// Rendu Three.js = brut + 0.5 (centrage dans la case)
// Ne jamais mélanger (P5)
```

### Format voxel_data
```javascript
// Base (migration 30) :
{ "x:y:z": { "tex": N, "geo": "cube", "r": 0 } }

// Mémoire React :
{ "x:y:z": { x, y, z, tex, geo, r } }

// save() payload — jamais l'objet mémoire entier (P16) :
payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
```

### Chargement textureMaterials (voxels uniquement)
```javascript
// Canvas3D
const voxelTexIds = [...new Set(Object.values(battlemap.voxel_data).map(v => v.tex))]
const { data } = await api.get(`/voxel-textures?ids=${voxelTexIds.join(',')}`)
const loaded = await loadVoxelTextures(data.textures)
setTextureMaterials(loaded)
// textureMaterials = { [voxel_textures.id integer]: { faceMaterials } }
```

---

## 8. Coordonnées entités — PE14

```javascript
// Base de données → Three.js (rendu dans EntityMesh)
posX = entity.pos_x + width/2
posY = entity.pos_z + height/2   // pos_z base = altitude Y Three.js
posZ = entity.pos_y + depth/2    // pos_y base = profondeur Z Three.js

// Three.js → base de données (pose depuis Editor3D)
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }
// Identique à threeToDb() — jamais inline
```

---

## 9. Flux assets MinIO

```
GET /api/assets/:folder/*filePath
  → client.statObject(bucket, filePath)
  → Content-Type = stat.metaData['content-type'] || getContentType(filePath)
  → stream.pipe(res)

portrait_url    = "characters/<id>/illustration"
glb_url char    = "characters/<id>/model3D?v=<timestamp>"
glb_url blueprint = "glb/<blueprint_id>.glb?v=<timestamp>"
textures pack   = "textures/<pack_uuid>/<fichier>.png"
URL client      : ${VITE_API_URL}/api/assets/${glb_url}
URL textures    : ${VITE_API_URL}/api/textures/${pack_id}/${path}
```

---

## 10. Flux dés

```
DicePanel ou Sidebar (/r) → socket.emit(DICE_ROLL, { formula })
Serveur : parseDice(formula) → lookup dice_config → isCriticalSuccess/Fail
  → io.to(campaignId).emit(DICE_RESULT, { userId, username, color, formula, rolls, total, ... })
SessionPage handler → addMessage({ type: 'dice', ... })
```

---

## 11. Lock éditeur

```
POST /battlemaps/:id/editor-lock      → 200 { ok, lockedUntil } | 423 { lockedBy }
POST /battlemaps/:id/editor-heartbeat → renouvelle (toutes les 30s)
DELETE /battlemaps/:id/editor-lock    → libère au démontage
```

---

## 12. Règles dependency arrays useCallback/useEffect

| Callback | Variable à inclure | Symptôme si absente |
|---|---|---|
| `handleContextMenuDelete` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleKeyDown` useEffect (Canvas3D) | `socket` | socket?.emit() silencieux |
| `handleCharacterDrop` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleDragStart` (Canvas3D) | `isGm`, `user`, `characters` | ownership check stale |
| raccourcis Digit1-5 (Editor3D) | `activeMaterial` | guard allowed_geometries stale |
| `handleEntityActionResolve` (SessionPage) | `socket` | ENTITY_ACTION_RESOLVE silencieux |

**Exception — actions Zustand :** stables par construction, pas besoin dans les deps.

**Pattern ref pour callbacks stables (P40) :**
```javascript
const battlemapRef = useRef(battlemap)
useEffect(() => { battlemapRef.current = battlemap }, [battlemap])
```

---

## 13. Conventions non-négociables

- **UUID partout** — jamais `increments()` (sauf voxel_textures.id — P22)
- **threeToDb(tx, ty, tz)** → `{ pos_x: tx, pos_y: tz, pos_z: ty }` — jamais inline
- **WS.CONSTANTE** toujours — jamais de chaîne en dur dans socket.emit/on
- **knexfile.cjs** en CommonJS — CLI Knex ne supporte pas ES Modules
- **Commande migrations Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`
- **Migrations format .js** — ES module avec `export const up/down`
- **socket.data.role** — stocker au SESSION_JOIN, pas socket.role (PE2)
- **owner_id tokens = mort** — ownership via character_id → characters.user_id
- **updated_at = db.fn.now() APRÈS le guard Object.keys** (P13)
- **updated_at jamais dans le JWT** (P14)
- **glb_url avec ?v=timestamp** (P19)
- **mat.clone() avant mutation Three.js** (P20)
- **fetch() console F12 : URL absolue + credentials**
- **skillTotal calculé client** — serveur ne recalcule jamais (PE1)
- **pendingEntityActions Map hors initSocket** — une seule instance

---

## 14. Pièges actifs — référence rapide

| Code | Description |
|---|---|
| P12 | VOXEL_ADD guard `if (!battlemapId) return` |
| P13 | `updated_at = db.fn.now()` après guard Object.keys |
| P14 | `updated_at` jamais dans le JWT |
| P17 | Séparateur voxel = `":"` NON NÉGOCIABLE |
| P19 | glb_url avec `?v=timestamp` obligatoire |
| P20 | mat.clone() avant mutation matériau Three.js |
| P22 | voxel_textures.id = integer (exception UUID) |
| P26 | blocksReady = true même si 0 textures |
| P32 | Ordre faces BoxGeometry : east(0), west(1), top(2), bottom(3), south(4), north(5) |
| P33 | `side` = alias lecture seule — jamais écrire |
| P38 | Raccourcis : `e.code` obligatoire |
| P43 | MinIO : `textures/<pack_uuid>/` jamais par pack_name |
| P44 | name du pack immuable |
| P46 | Route spécifique avant paramétrique |
| PE1 | skillTotal calculé client |
| PE2 | socket.data.role pour fetchSockets() |
| PE4 | face null = invisible |
| PE11 | fallback states[0] si current_state_id invalide |
| PE12 | clearTimeout pendingEntityActions à la résolution |
| PE13 | touche R = ghost OU entité sous curseur |
| PE14 | pos_y base = Z Three.js, pos_z base = Y Three.js |
| PE16 | e.code pour Alt |
| PE17 | usage_hint = hint de tri, jamais exclusif |
| PE18 | blueprint.pack_id nullable — guard obligatoire |
| PEF1 | pack_id obligatoire sur blueprint |
| PEF2 | fakeTexObj : { id, pack_id, faces } |
| PEF3 | entityTextureMaterials indexé par blueprint.id UUID |
| PEF4 | face_overrides = chemins PNG |
| PEF5 | blueprint sans pack_id → skip + magenta |
| PEF6 | Canvas3D : chargements voxels et entités séparés |