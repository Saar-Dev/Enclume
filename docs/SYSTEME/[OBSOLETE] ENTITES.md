# SYSTEME/ENTITES.md — Collision Redis, Rotation tokens, Déplacement entités
> Source : SYSTEME.md §12–§13–§15
> Lire pour : collision map Redis, déplacement entités/tokens, rotation tokens, Lerp 300ms

---

## Collision map Redis — architecture (sessions 39 + 43)

```
DB PostgreSQL = source de vérité
Redis Hash    = cache O(1) par case — reconstruit depuis DB au SESSION_JOIN

Clé Redis  : "collision:{battlemap_id}"
Champ Hash : "x:pos_y:pos_z"  (convention PE14 base — NON Three.js)
Valeur     : JSON { type: 'token'|'entity'|'voxel', id: string }
TTL        : 24h — reconstruite au prochain SESSION_JOIN (PE23)
```

### Convention PE14 dans Redis — NON NÉGOCIABLE
Tous les champs Hash utilisent `"pos_x:pos_y:pos_z"` en convention base (PE14) :
- `pos_x` = axe X (identique Three.js)
- `pos_y` = profondeur (axe Z Three.js)
- `pos_z` = altitude (axe Y Three.js)

Les voxels sont stockés dans `voxel_data` en Three.js brut (`"x:y_altitude:z_profondeur"`)
mais convertis en PE14 avant stockage Redis. Voir VOXELS.md pour la conversion.

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

### Altitude acteur dans step-by-step (PE29)
```javascript
// Token pos_z = altitude des pieds (même niveau que voxels sol pos_z=0)
// Vérifier pos_z+1 = espace de marche — évite faux blocage sur sol
await isCaseOccupied(battlemapId, nextActorPosX, nextActorPosY, token.pos_z + 1, excludeIds)
```

### Maintenance Redis — PE25 (règle fondamentale)
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

## Rotation tokens — PE21 (session 39)

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

## Déplacement entités — flux complet (sessions 40-43)

### Flux
```
Joueur clique ⚙ → RadialMenu → handleEntityMove → setMoveTarget → mode visée Canvas3D
Canvas3D : ghost wireframe snapé 8 axes depuis entité, couleur bleu=push/orange=pull/rouge=impossible
Joueur clique destination (dot≠0) → ENTITY_MOVE_REQUEST émis :
  socket.emit(WS.ENTITY_MOVE_REQUEST, { entityId, tokenId, interactionId, moveType:'push'|'pull', destX, destZ })
  // destZ = pos_y base (PE14) malgré le nom — profondeur Z Three.js
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
mr_min | mr_max | modifier | Qualité
0      | 2      | 0        De justesse
3      | 4      | 1        Correct
5      | 6      | 2        Assez bon
7      | 9      | 3        Bon
10     | 12     | 4        Très bon
13     | 14     | 5        Excellent
15     | 19     | 6        Parfait
20     | 24     | 7        Extraordinaire
25     | 34     | 8        Héroïque
35     | null   | 9        Légendaire
-2     | -1     | 0        De justesse (échec)
-4     | -3     | -1       Médiocre
...
-999   | -35    | -9       Légendaire (échec)
```

### Ghost mode visée
```
Snap : 8 axes depuis entité (ratio 2:1)
  if dx > 2*dz → axe X pur : entity.pos_x + round(dPosX)
  if dz > 2*dx → axe Z pur : entity.pos_y + round(dPosZ)
  else → diagonal : dist = round((|dPosX|+|dPosZ|)/2)
Couleurs : dot>0→bleu(#2563eb) dot<0→orange(#f97316) dot=0→rouge(#ef4444)
```

### PE24 — collisionMoveToken : règle hdel/hset
```javascript
// TOUJOURS hdel l'ancienne case, même si layer === 'gm'
await redisClient.hdel(`collision:${battlemapId}`, oldKey)

// hset la nouvelle case SEULEMENT si layer !== 'gm'
if (token.layer !== 'gm') {
  await redisClient.hset(`collision:${battlemapId}`, newKey, JSON.stringify({ type: 'token', id: tokenId }))
}
// Raison : les tokens GM sont exclus de la collision, mais leur ancienne case doit quand même être libérée
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

## Pièges entités — référence rapide

| Code | Description |
|---|---|
| PE11 | Fallback `states[0]` si `current_state_id` invalide ou null — état courant toujours défini |
| PE12 | `clearTimeout(pendingEntityActions.get(key))` obligatoire à la résolution — évite double-déclenchement timeout + résolution manuelle |
| PE13 | Touche R en mode Editor3D = toggle ghost SI entité sous le curseur, SINON rien — ne pas intercepter R globalement |
