# SYSTEME.md — Flux, règles et pièges du projet Enclume
> Dernière mise à jour : 2026-05-23 Session 61
> Ce document répond à "qui fait quoi, qui parle à qui, pourquoi" — pas à "qu'est-ce qui existe".
> Pour la liste des fichiers : voir ASBUILT.md. Pour l'historique : voir JOURNAL2.md.

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

### tokenStore — updateToken
```javascript
// Merge partiel avec guard obsolescence
updateToken(partial)  // partial = { id, ...champs modifiés }
// Guard : si partial.updated_at < t.updated_at → ignoré silencieusement
// Utilisé par : TOKEN_MOVED (tokenId→id), TOKEN_UPDATED (token complet avec id)
```

### characterStore — upsertCharacter (session 44)
```javascript
// Handler WS CHARACTER_UPDATED
// Si visible:false et !state.isGm → retire le character du store (joueur ne doit plus le voir)
// Si visible:true → comportement normal (upsert)
// Raison : le GET /characters filtre visible=true pour les joueurs,
//          mais le broadcast CHARACTER_UPDATED envoie l'objet complet.
//          Le store doit reproduire ce filtre côté client.
upsertCharacter: (character) => set((state) => {
  if (!character.visible && !state.isGm) {
    return { characters: state.characters.filter(c => c.id !== character.id) }
  }
  // ... upsert normal
})
```

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
| ENTITY_ACTION_REQUEST | client (joueur) | serveur | Demande interaction entité |
| ENTITY_ACTION_PENDING | serveur | GM socket | Notification arbitrage |
| ENTITY_ACTION_RESOLVE | client (GM) | serveur | Décision GM |
| ENTITY_ACTION_RESULT | serveur | joueur socket | Résultat (refus/timeout/jet) |
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

### Format geometry.faces
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

### Format states.visual_override.face_overrides
```json
{ "north": "uuid3.png", "top": null }
```

### Chargement Canvas3D — entityTextureMaterials
```javascript
fakeTexObjs.push({ id: `${bp.id}__base`, pack_id: bp.pack_id, faces: bp.geometry.faces })
// + un fakeTexObj par état avec face_overrides fusionnés

// Restructuration :
entityTextureMaterials = {
  [bp.id]: {
    base: { faceMaterials: [...6 mats...] },
    states: { [stateId]: { faceMaterials: [...6 mats...] } }
  }
}
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
// Clé "x:y:z" = convention Three.js brute (y=altitude, z=profondeur)

// Mémoire React :
{ "x:y:z": { x, y, z, tex, geo, r } }

// save() payload — jamais l'objet mémoire entier (P16) :
payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
```

### Convention clés collision map Redis — voxels (session 43)
```
voxel_data stocke : "x:y_altitude:z_profondeur" (Three.js brut)
Redis collision map : "x:z_profondeur:y_altitude" (PE14 base)
Conversion dans buildCollisionMap/collisionAddVoxel/collisionRemoveVoxel :
  const [vx, vy, vz] = voxelKey.split(':').map(Number)
  const pe14Key = `${vx}:${vz}:${vy}`
```
**Convention Redis = PE14 partout (tokens, entités, voxels). Three.js = rendu uniquement.**

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

### PE34 — Altitude pieds token en Three.js (session 61)

```javascript
// Token group (lerpPos) centré à : Y = token.pos_z + 0.5 (centre du voxel)
// Y_OFFSET = 0.5 (primitive au-dessus du centre) → pieds à : Y = token.pos_z + 1.0

// Formule pieds token (Three.js Y) :
const feetY = token.pos_z + 1.0

// Pour un overlay au sol (anneau, cercle) — +0.05 évite le z-fighting :
const overlayY = token.pos_z + 1.0 + 0.05

// Cohérent avec §12 (step-by-step collision à pos_z+1 = espace de marche)
```
**Piège :** `token.pos_z + 0.5` = centre du voxel (intérieur) — les overlays sols sont cachés.
`token.pos_z + 1.0` = surface du sol = pieds du token.

---

## 9. Flux assets MinIO

```
GET /api/assets/:folder/*filePath
  → client.statObject(bucket, filePath)
  → Content-Type = stat.metaData['content-type'] || getContentType(filePath)
  → stream.pipe(res)

cover_url campaign = "campaigns/<campaign_id>/cover"
portrait_url char  = "characters/<id>/illustration"
glb_url char       = "characters/<id>/model3D?v=<timestamp>"
glb_url blueprint  = "glb/<blueprint_id>.glb?v=<timestamp>"
textures pack      = "textures/<pack_uuid>/<fichier>.png"
URL client         : ${VITE_API_URL}/api/assets/${cover_url}
URL client         : ${VITE_API_URL}/api/assets/${glb_url}
URL textures       : ${VITE_API_URL}/api/textures/${pack_id}/${path}
```

### Convention arborescence campagne (actée session 45)
Tous les assets d'une campagne ont `campaigns/<campaign_id>/` comme racine MinIO :
- `campaigns/<campaign_id>/cover` — illustration de la campagne (Dashboard)
- `campaigns/<campaign_id>/characters/<character_id>/illustration` — **(cible future migration)**
- `campaigns/<campaign_id>/maps/`, `campaigns/<campaign_id>/tokens/` — (réservé)

**Migration future (non codée) :** `characters/<id>/illustration` → `campaigns/<campaign_id>/characters/<id>`
Raison : les characters existants ont été créés hors campagne. Migration complexe, chantier dédié.

### Règle P18 — chemins MinIO en base
`cover_url`, `portrait_url`, `glb_url` stockent le chemin MinIO relatif (pas une URL complète).
Le client reconstruit : `${VITE_API_URL}/api/assets/${url}`

---

## 10. Flux dés

```
DicePanel ou Sidebar (/r) → socket.emit(DICE_ROLL, { formula })
Serveur : parseDice(formula) → lookup dice_config → isCriticalSuccess/Fail
  → io.to(campaignId).emit(DICE_RESULT, { userId, username, color, formula, rolls, total, seed, ... })
SessionPage handler DICE_RESULT → double consommation (session 44) :
  1. addMessage({ type: 'dice', ... })         → chat Sidebar (tous les jets)
  2. if (!skillLabel) setLastDiceRoll(payload) → animation 3D (jets normaux uniquement)
```

### Dice Rework — Animation 3D (session 44)
```
lastDiceRoll state (SessionPage) → prop dicePayload → Canvas3D → DiceRoller (R3F)
DiceRoller : decomposeDice(rolls, dieType, seed) → N DiceMesh dans N lanes
DiceMesh : animation SLERP quaternion 1.8-2.5s → face résultat vers caméra → figé
Clic n'importe où → onDiceDone() → lastDiceRoll = null → DiceRoller démonté

Filtrage : jets d'entité (skillLabel défini) → pas d'animation
Couleur : color du payload DICE_RESULT → matériau/texture du dé

Dés V1 avec face texturée : D6, D4, D8, D20, D12 (atlas)
Dés V1 Html overlay : D10, D10_tens, D10_units (UV kite = V2 Blender)
```

### Payload DICE_RESULT
```javascript
{
  userId, username, color,
  formula, rolls, total,
  isCriticalSuccess, isCriticalFail,
  seed,          // XOR rolls — initialisé PRNG animation
  timestamp,
  skillLabel,    // défini pour jets entité uniquement
  effectiveMalus, // malus effectif appliqué (woundPenalty − encumbrancePenalty) — session 52
  // + champs entity action si applicable
}
```

---

## 11. Lock éditeur

```
POST /battlemaps/:id/editor-lock      → 200 { ok, lockedUntil } | 423 { lockedBy }
POST /battlemaps/:id/editor-heartbeat → renouvelle (toutes les 30s)
DELETE /battlemaps/:id/editor-lock    → libère au démontage
```

---

## 12. Collision map Redis — sessions 39 + 43

### Architecture (cache-aside)
```
DB PostgreSQL = source de vérité
Redis Hash    = cache O(1) par case — reconstruit depuis DB au SESSION_JOIN

Clé Redis  : "collision:{battlemap_id}"
Champ Hash : "x:pos_y:pos_z"  (convention PE14 base — NON Three.js)
Valeur     : JSON { type: 'token'|'entity'|'voxel', id: string }
TTL        : 24h — reconstruite au prochain SESSION_JOIN (PE23)
```

### Convention PE14 dans Redis — NON NÉGOCIABLE (session 43)
Tous les champs Hash utilisent `"pos_x:pos_y:pos_z"` en convention base (PE14) :
- `pos_x` = axe X (identique Three.js)
- `pos_y` = profondeur (axe Z Three.js)
- `pos_z` = altitude (axe Y Three.js)

**Les voxels sont stockés dans voxel_data en Three.js brut (`"x:y_altitude:z_profondeur"`)
mais convertis en PE14 avant stockage Redis. Voir §7 pour la conversion.**

### Filtres
- Tokens `layer = 'gm'` : **exclus** — invisibles aux joueurs, pas bloquants
- Entités : incluses **uniquement** si `is_blocking = true` dans l'état courant (JOIN blueprint)
- Voxels : tous inclus

### buildCollisionMap
```javascript
// server/src/lib/redis.js
// Appelée au SESSION_JOIN depuis player_locations
// Non bloquante si joueur sans player_location (première connexion)
// Pipeline Redis — O(1) réseau
await buildCollisionMap(playerLocation.battlemap_id)
```

### isCaseOccupied
```javascript
// O(1) — utilisé dans step-by-step 9F-B/C
// excludeIds = [tokenId, entityId] — tunnel de swap (PE22)
await isCaseOccupied(battlemapId, x, y, z, excludeIds)
// x, y, z = coordonnées PE14 (pos_x, pos_y, pos_z)
```

### Altitude token acteur dans step-by-step (session 43)
```javascript
// Token pos_z = altitude des pieds (même niveau que voxels sol pos_z=0)
// Vérifier pos_z+1 = espace de marche — évite faux blocage sur sol
await isCaseOccupied(battlemapId, nextActorPosX, nextActorPosY, token.pos_z + 1, excludeIds)
// Standard industrie VTT — Foundry VTT approach
```

### Maintenance — règle fondamentale (PE25)
**La maintenance Redis est dans les routes REST, pas dans les handlers WS reliques.**
`TOKEN_CREATED` / `TOKEN_DELETED` WS sont des reliques — ne pas y toucher Redis.
`ENTITY_CREATED` / `ENTITY_DELETED` / `ENTITY_MOVED` WS : idem.

| Mutation | Où | Helper |
|---|---|---|
| Token créé | `POST /tokens` | `collisionAddToken` |
| Token déplacé (REST) | `PUT /tokens/:id` | `collisionMoveToken` |
| Token déplacé (WS drag) | `TOKEN_MOVE` handler | `collisionMoveToken` |
| Token supprimé | `DELETE /tokens/:id` AVANT delete | `collisionRemoveToken` |
| Token rotate | `TOKEN_ROTATE` handler | aucune (position inchangée) |
| Entité créée | `POST /entities` | `collisionAddEntity` |
| Entité pos/état changé | `PUT /entities/:id` | `collisionMoveEntity` ou `collisionUpdateEntityState` |
| Entité supprimée | `DELETE /entities/:id` AVANT delete | `collisionRemoveEntity` |
| Entité état (interaction) | `resolveEntityState` | `collisionUpdateEntityState` |
| Voxel ajouté | `VOXEL_ADD` | `collisionAddVoxel` (converti PE14) |
| Voxel supprimé | `VOXEL_REMOVE` | `collisionRemoveVoxel` (converti PE14) |
| Voxel tourné | `VOXEL_UPDATE` | aucune (position inchangée) |

---

## 13. Rotation tokens — session 39 (PE21)

```javascript
// tokens.r = 0-7 — 8 orientations, incréments 45°
// rotation.y = r * Math.PI / 4 (côté client, sur le <group> parent)

// Flux TOKEN_ROTATE :
// 1. Clic court sur token propriétaire → Canvas3D → onTokenRotate(tokenId)
// 2. SessionPage → socket.emit(WS.TOKEN_ROTATE, { tokenId })
// 3. Serveur : ownership check → r = (r+1) % 8 → update DB → broadcast TOKEN_UPDATED
// 4. SessionPage handler TOKEN_UPDATED → updateToken(token) → store merge
// 5. Canvas3D TokenMesh → rotation.y recalculé

// Ownership TOKEN_ROTATE : character.user_id === socket.data.userId OU role === 'gm'
// token.character_id null → seul le GM peut rotate
```

---

## 14. Règles dependency arrays useCallback/useEffect

| Callback | Variable à inclure | Symptôme si absente |
|---|---|---|
| `handleContextMenuDelete` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleKeyDown` useEffect (Canvas3D) | `socket` | socket?.emit() silencieux |
| `handleCharacterDrop` (SessionPage) | `socket` | socket?.emit() silencieux |
| `handleDragStart` (Canvas3D) | `isGm`, `user`, `characters` | ownership check stale |
| raccourcis Digit1-5 (Editor3D) | `activeMaterial` | guard allowed_geometries stale |
| `handleEntityActionResolve` (SessionPage) | `socket` | ENTITY_ACTION_RESOLVE silencieux |
| `handleTokenRotate` (SessionPage) | `socket` | TOKEN_ROTATE silencieux |
| `handlePointerUp` (Canvas3D) | `onTokenRotate`, `characters`, `user` | rotation impossible |

**Exception — actions Zustand :** stables par construction, pas besoin dans les deps.

**Pattern ref pour callbacks stables (P40) :**
```javascript
const battlemapRef = useRef(battlemap)
useEffect(() => { battlemapRef.current = battlemap }, [battlemap])
```

---

## 15. Déplacement entités — flux complet (sessions 40-43)

### Flux
```
Joueur clique ⚙ → RadialMenu → handleEntityMove → setMoveTarget → mode visée Canvas3D
Canvas3D : ghost wireframe snapé 8 axes depuis entité, couleur bleu=push/orange=pull/rouge=impossible
Joueur clique destination (dot≠0) → ENTITY_MOVE_REQUEST émis
Serveur → jet attribut via charStats.js → calcul MR → getModifier(mrTable,mr) → dmax=modifier+1
  → step-by-step : min(dmax, stepsTarget) pas max — destination joueur respectée
  → collision entité à pos_z, acteur à pos_z+1 (espace de marche)
  → ENTITY_MOVED + TOKEN_MOVED broadcast → ENTITY_MOVE_RESULT → joueur
SessionPage → setMoveTarget(null) + badge MR dans chat
Canvas3D/EntityMesh → Lerp 300ms vers position finale
```

### Polaris MR — table officielle (migration 46)
```
modifier = getModifier(mrTable, mr)   // LdB p.209 — 20 paliers réussite + échec
dmax = isSuccess ? modifier + 1 : 0   // toute réussite = au moins 1 case
stepsMax = Math.min(dmax, stepsTarget) // destination joueur respectée
```

### Table polaris_mr (migration 46)
```
mr_min | mr_max | modifier
0      | 2      | 0    De justesse
3      | 4      | 1    Correct
5      | 6      | 2    Assez bon
7      | 9      | 3    Bon
10     | 12     | 4    Très bon
13     | 14     | 5    Excellent
15     | 19     | 6    Parfait
20     | 24     | 7    Extraordinaire
25     | 34     | 8    Héroïque
35     | null   | 9    Légendaire
-2     | -1     | 0    De justesse (échec)
-4     | -3     | -1   Médiocre
...
-999   | -35    | -9   Légendaire (échec)
```

### Ghost mode visée
```
Snap : 8 axes depuis entité (ratio 2:1)
  if dx > 2*dz → axe X pur : entity.pos_x + round(dPosX)
  if dz > 2*dx → axe Z pur : entity.pos_y + round(dPosZ)
  else → diagonal : dist = round((|dPosX|+|dPosZ|)/2)
Couleurs : dot>0→bleu(#2563eb) dot<0→orange(#f97316) dot=0→rouge(#ef4444)
```

### Lerp 300ms — pattern R3F (session 43)
```javascript
// Dans EntityMeshVoxel, EntityMeshGlb, TokenMesh
const groupRef = useRef()
const lerpPos  = useRef({ x: posX, y: posY, z: posZ })
const targetRef = useRef({ x: posX, y: posY, z: posZ })
targetRef.current = { x: posX, y: posY, z: posZ }  // mis à jour à chaque render

useFrame((_, delta) => {
  if (!groupRef.current) return
  const alpha = 1 - Math.exp(-delta / 0.1)  // tau=0.1 → 95% en ~300ms
  lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha
  lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha
  lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha
  groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z)
})
// <group ref={groupRef}> — position retirée du JSX (P40)
```

---

## 16. Système blessures + armures — sessions 49–54

### Architecture générale
```
shared/woundConstants.js  — WOUND_LOCATIONS / SEVERITIES / MAX_COUNTS / PENALTIES / SEVERITY_COLORS
shared/armorConstants.js  — ARMOR_CATEGORY_MALUS / LOCATION_TO_SLOT / SLOT_TO_REF_LOCATION / LOCATION_TO_SVG / LOCATION_LABELS
server/lib/charStats.js   — calcWoundPenalty(wounds) / calcEncumbrancePenalty(totalWeight, forValue)
```

### Composants client — onglet Matériel (CharacterWindow)
```
CharacterWindow
└── ArmorWoundPanel          — orchestrateur : charge wounds + inventory, layout 3 colonnes
    ├── LocationPanel × 6    — une localisation (Tête/Corps/Bras G/D/Jambe G/D)
    │   ├── armures équipées (multi-couches, mille-feuille ETQ/PRT/malus_cat)
    │   ├── select ajout couche (filtré par refCode + container='Sac')
    │   └── grille blessures (WOUND_SEVERITIES × MAX_COUNTS — clic POST/PUT/DELETE)
    ├── ContainerPanel (D)   — Sac à dos : équipement conteneur
    ├── ContainerPanel (Ce)  — Ceinture : équipement conteneur
    └── SilhouettePanel      — SVG silhouette 50%, colorée par pire blessure par localisation
```

### Mille-feuille (calcMillefeuille — client uniquement)
```javascript
// Couches sur une localisation → max + reste/2
const max  = Math.max(...vals)
const rest = vals.reduce((s, v) => s + v, 0) - max
return max + rest / 2
// Affiché ETQ/PRT dans LocationPanel — non encore intégré côté serveur (résolution dommages future)
```

### Codes slots — règle PI6/PI7
```javascript
// LOCATION_TO_SLOT : localisation → slotCode individuel
{ tete:'T', corps:'C', bras_gauche:'BG', bras_droit:'BD', jambe_gauche:'JG', jambe_droite:'JD' }

// SLOT_TO_REF_LOCATION : slotCode → ref_location compat (pour lookup catalogue)
{ T:'T', C:'C', BG:'B', BD:'B', JG:'J', JD:'J' }

// Dans LocationPanel :
const slotCode = LOCATION_TO_SLOT[location]           // 'BG'
const refCode  = SLOT_TO_REF_LOCATION[slotCode]       // 'B'
equippedItems  = items.filter(i => i.slot?.split('/').includes(slotCode))  // utilise 'BG'
availableItems = items.filter(i => i.ref_location?.split('/').includes(refCode))  // utilise 'B'
```

### Routes REST armures/blessures
```
GET    /char-sheet/:id/wounds                      → { wounds, wound_penalty }
POST   /char-sheet/:id/wounds                      → ajoute (+ promotion auto)
PUT    /char-sheet/:id/wounds/:wid/stabilize       → stabilise
DELETE /char-sheet/:id/wounds/:wid                 → guérison

GET    /char-sheet/:id/inventory                   → { items, sols, total_weight, threshold }
POST   /char-sheet/:id/inventory                   → ajoute item
PUT    /char-sheet/:id/inventory/:itemId           → modifie (slot, container, quantité)
DELETE /char-sheet/:id/inventory/:itemId           → supprime
PUT    /char-sheet/:id/sols                        → modifie solde sols (GM ou owner)
```

### Règle P51 — effectiveMalus dans les jets
```javascript
// socket/index.js — chancesDeReussite
const woundPenalty       = calcWoundPenalty(wounds)         // ≤ 0, pire blessure seule
const encumbrancePenalty = calcEncumbrancePenalty(weight, FOR)  // ≥ 0, règle maison
effectiveMalus = woundPenalty - encumbrancePenalty           // ≤ 0
chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
```

---

## 17. Conventions non-négociables

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
- **Calculs Polaris** — serveur calcule via `charStats.js`
- **difficulty_dc** — modificateur signé (-20 à +10, LdB p.404) — jamais une valeur absolue
- **isSuccess Polaris** — `diceRoll <= chancesDeReussite` — jamais >=
- **charStats.js** — fonctions pures, aucun accès DB — le caller fournit les données
- **effectiveMalus** — `calcWoundPenalty(wounds) − calcEncumbrancePenalty(weight, FOR)` — toujours ≤ 0. Appliqué sur le total du jet, jamais sur un attribut (P51)
- **LOCATION_TO_SLOT vs SLOT_TO_REF_LOCATION** — slotCode (BG/BD/JG/JD) pour les slots individuels, refCode (B/J) pour le lookup ref_location compat (PI7)
- **pendingEntityActions Map hors initSocket** — une seule instance
- **Collision map Redis** — convention PE14 partout (tokens, entités, voxels convertis)
- **Voxels Redis** — convertis Three.js→PE14 dans buildCollisionMap/add/remove
- **Acteur step-by-step** — collision à pos_z+1 (espace de marche, pas sol)
- **stepsMax** — Math.min(dmax, stepsTarget) — destination joueur respectée
- **resolveEntityState returning** — doit inclure `battlemap_id` (PE26)
- **Lerp EntityMesh** — useFrame dans sous-composants (règle des hooks)
- **Logs debug index.js** — conservés volontairement, à retirer avant production
- **Dice Rework** — DiceRoller monté dans Canvas3D (pas en overlay HTML séparé) — un seul contexte WebGL
- **DiceMesh material useMemo** — deps `[geoDef.type, color, dieType]` — dieType requis pour D10 (3 types)
- **DICE_RESULT double consommation** — chat + animation parallèles, animation filtrée sur `!skillLabel`

---

## 18. Pièges actifs — référence rapide

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
| P40 | battlemapRef pattern — ref miroir pour callbacks stables dans useFrame |
| P43 | MinIO : `textures/<pack_uuid>/` jamais par pack_name |
| P44 | name du pack immuable |
| P46 | Route spécifique avant paramétrique |
| PE2 | socket.data.role pour fetchSockets() |
| PE4 | face null = invisible |
| PE11 | fallback states[0] si current_state_id invalide |
| PE12 | clearTimeout pendingEntityActions à la résolution |
| PE13 | touche R = ghost OU entité sous curseur |
| PE14 | pos_y base = Z Three.js, pos_z base = Y Three.js |
| PE16 | e.code pour Alt |
| PE17 | usage_hint = hint de tri, jamais exclusif |
| PE18 | blueprint.pack_id nullable — guard obligatoire |
| PE21 | r tokens = 0-7 — `rotation.y = r * Math.PI / 4` |
| PE22 | tunnel de swap `excludeIds = [tokenId, entityId]` dans `isCaseOccupied` |
| PE23 | `buildCollisionMap` au SESSION_JOIN — pas au démarrage serveur |
| PE24 | `collisionMoveToken` : hdel systématique ancienne case, hset conditionnel si layer != 'gm' |
| PE25 | maintenance Redis dans REST — jamais dans handlers WS reliques |
| PE26 | `resolveEntityState` : `.returning()` doit inclure `battlemap_id` |
| PE27 | moveType calculé client (feedback) ET recalculé serveur (validation) |
| PEF1 | pack_id obligatoire sur blueprint |
| PEF2 | fakeTexObj : { id, pack_id, faces } |
| PEF3 | entityTextureMaterials indexé par blueprint.id UUID |
| PEF4 | face_overrides = chemins PNG |
| PEF5 | blueprint sans pack_id → skip + magenta |
| PEF6 | Canvas3D : chargements voxels et entités séparés |
| P49 | Promotion blessures : si promoted===true → GET /wounds complet — ne jamais ajouter localement |
| P50 | toggle Polaris : ne jamais dupliquer charSkills — lift state up obligatoire |
| P51 | Malus santé non-cumulatif (pire seul, LdB p.236), encombrement cumulatif (règle maison). effectiveMalus = woundPenalty − encumbrancePenalty |
| PI1 | Container 'Sac' : dispo seulement si ≥1 item ref_location='D' dans inventaire — isContainerAvailable() avant POST/PUT |
| PI2 | Équipement slot≠null → container 'Sac' obligatoire — 400 si indispo, jamais Coffre silencieux |
| PI3 | Items équipés (slot IS NOT NULL) comptés dans poids — seul container='Coffre' exclut |
| PI4 | calcEncumbrancePenalty requiert FOR nette = base_level + pc_modifier, pas seulement base_level |
| PI5 | Items manuels (equipment_id null) → ref_weight null → exclus du calcul poids |
| PI6 | LOCATION_TO_SLOT : BG/BD/JG/JD indépendants — availableItems filtre via refCode (SLOT_TO_REF_LOCATION) |
| PI7 | refCode (B/J) pour lookup ref_location — slotCode (BG/BD) pour equip/unequip — ne pas confondre |
| PI8 | POST /inventory : LIKE query pour multi-slot — WHERE slot = code casse les multi-couches |
| PE34 | Pieds token Three.js : `pos_z + 1.0` (top voxel) — pas `pos_z + 0.5` (centre voxel) |