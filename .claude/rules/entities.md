---
paths:
  - "server/src/routes/entities.js"
  - "server/src/routes/tokens.js"
  - "server/src/lib/redis.js"
  - "client/src/components/EntityMesh.jsx"
  - "client/src/components/EntityInstancePanel.jsx"
  - "client/src/components/TokenRadialMenu.jsx"
  - "client/src/components/TokenStatusPanel.jsx"
  - "client/src/components/RadialMenu.jsx"
  - "client/src/stores/entityStore.js"
  - "client/src/stores/tokenStore.js"
  - "client/src/lib/useTokenSocket.js"
  - "client/src/lib/useEntitySocket.js"
---
# Domaine : Tokens, Entités & Redis

**Spec technique → `docs/SYSTEME/ENTITES.md`**

## Pièges critiques

**P1 — token.owner_id mort**
Toujours : `token.character_id → characters.user_id`. Ne jamais utiliser `token.owner_id`.

**PE14 — pos_y/pos_z inversés Three.js ↔ DB**
`pos_y` DB = profondeur (Z Three.js). `pos_z` DB = altitude (Y Three.js).
```js
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }  // Three.js → DB
```

**PE24 — collisionMoveToken : double opération**
`hdel` systématique sur l'ancienne case. `hset` conditionnel sur `layer` (tokens GM exclus).

**PE25 — maintenance Redis dans REST, jamais dans les handlers WS reliques**
POST/DELETE token/entité → maintenance Redis dans le handler REST.
Les anciens handlers WS ne maintiennent pas la collision map.

**PE23 — buildCollisionMap au SESSION_JOIN uniquement**
Jamais au démarrage serveur. Non bloquante si joueur sans `player_location`.

**PC27 — Entité ≠ PNJ**
`!token.character_id` = entité de décor (porte, console). PNJ = `character.type === 'pnj'`.

**PE7 — current_state_id**
Index entier dans `states[]` — jamais UUID. `fallback states[0]` (PE11).

**TTL Redis : 24h**
Reconstruite à chaque SESSION_JOIN depuis `player_locations`.
Collision map : `"collision:{battlemap_id}"` — champ `"x:y:z"` (séparateur `:`).

**PE47 — pack_id dans SELECT JOIN entities**
`pack_id` doit figurer dans le SELECT du GET entities + payload `ENTITY_CREATED`.
