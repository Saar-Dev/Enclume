# ASBUILT — Ce qui est codé et stable
> Dernière mise à jour : 2026-04-28 Session 39
> Ce document est un snapshot de référence rapide.
> Pour les flux détaillés, ownership, pièges : voir SYSTEME.md.
> Pour l'historique des décisions : voir JOURNAL2.md.

---

## Structure du projet
```
Enclume/
├── client/
│   ├── public/
│   │   ├── fonts/
│   │   │   └── inter.woff              # Police locale pour labels 3D (drei Text)
│   │   └── favicon.svg                 # ⚠ présent mais non référencé — à brancher
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas3D.jsx            # Modifié 39 — rotation.y token r, onTokenRotate
│   │   │   ├── Editor3D.jsx            # Modifié 9C — EntityEditorScene, activeEditorTab
│   │   │   ├── EntityMesh.jsx          # Modifié 34 — timer 400ms, hitbox ×1.4, pointerEvents HoverIcon
│   │   │   ├── EntityBuilderTab.jsx    # Modifié 36 — label difficulté, valeur défaut 0
│   │   │   ├── VoxelBuilderTab.jsx     # Stable 33
│   │   │   ├── RadialMenu.jsx          # Nouveau 34 — menu radial SVG entités
│   │   │   ├── EntityInstancePanel.jsx # Modifié 36 — sélecteur état actuel
│   │   │   ├── Voxel.jsx               # Stable 9A-5
│   │   │   ├── Sidebar.jsx             # Modifié 36 — rendu entity_action structuré, panel GM nettoyé
│   │   │   ├── GeometryIcon.jsx        # Stable 9A-3
│   │   │   └── DicePanel.jsx           # Stable session 18
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx       # Modifié 33 — lien Atelier du GM → /workshop
│   │   │   ├── SessionPage.jsx         # Modifié 39 — TOKEN_UPDATED handler, handleTokenRotate
│   │   │   ├── CampaignSettingsPage.jsx
│   │   │   ├── WorkshopPage.jsx        # Stable 33
│   │   │   └── TexturePacksPage.jsx    # CONSERVÉ mais remplacé par WorkshopPage
│   │   ├── stores/
│   │   │   ├── authStore.js
│   │   │   ├── tokenStore.js
│   │   │   ├── characterStore.js
│   │   │   ├── mapStore.js
│   │   │   ├── sessionStore.js
│   │   │   └── entityStore.js          # Modifié 34 — fetchBlueprints() ajouté
│   │   ├── locales/
│   │   │   └── fr.json                 # Modifié 36 — 3 clés entity_action
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   └── voxelTextures.js
│   │   ├── i18n.js
│   │   ├── App.jsx                     # Modifié 33 — route /workshop + redirect /texture-packs
│   │   └── main.jsx
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/             # 45 migrations appliquées (batch 17)
│   │   │   └── knex.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js
│   │   │   ├── battlemaps.js
│   │   │   ├── tokens.js               # Modifié 39 — maintenance Redis collision map
│   │   │   ├── characters.js
│   │   │   ├── textures.js
│   │   │   ├── assets.js
│   │   │   ├── users.js
│   │   │   ├── dice.js
│   │   │   ├── voxel-textures.js       # Modifié 33 — usage_hint exposé GET+PUT
│   │   │   ├── texture-packs.js
│   │   │   ├── entity-blueprints.js    # Modifié 33 — POST /:id/upload-glb
│   │   │   └── entities.js             # Modifié 39 — maintenance Redis collision map
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── role.js
│   │   │   ├── upload.js
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   ├── auth.js
│   │   │   └── index.js                # Modifié 39 — TOKEN_ROTATE, buildCollisionMap, maintenance Redis
│   │   ├── lib/
│   │   │   ├── AppError.js
│   │   │   ├── minio.js
│   │   │   ├── diceParser.js
│   │   │   ├── charStats.js            # NOUVEAU 36 — calculs Polaris purs
│   │   │   └── redis.js                # NOUVEAU 39 — client ioredis + helpers collision map
│   │   └── index.js
├── shared/
│   └── events.js                       # Modifié 39 — TOKEN_ROTATE ajouté
└── docs/
```

---

## Infrastructure

| Composant | Tech | Notes |
|---|---|---|
| Frontend | React 19 + Vite | Port 5173 dev |
| Backend | Node.js + Express + Socket.io | Port 3001 |
| Base de données | PostgreSQL | Knex migrations |
| Cache/collisions | Redis + ioredis | Collision map par battlemap — branché session 39 |
| Stockage fichiers | MinIO | Bucket unique |
| Auth | JWT httpOnly cookie | 7 jours |

---

## Serveur

### Routes montées (index.js)
```
/api/health
/api/auth
/api/campaigns
/api/campaigns/:campaignId/characters    ← mergeParams
/api/characters                          ← actionsRouter (PUT/DELETE/upload)
/api/campaigns/:id/battlemaps
/api/battlemaps
/api/battlemaps/:id/tokens
/api/battlemaps/:id/entities
/api/tokens
/api/textures                            ← proxy MinIO textures pack
/api/assets                              ← proxy MinIO général
/api/users
/api/dice
/api/voxel-textures
/api/texture-packs
/api/entity-blueprints
/api/entities
/api/char-sheet
/api/char-ref
```

### Routes REST — Entities (/api/battlemaps/:id/entities + /api/entities)
| Méthode | Route | Description |
|---|---|---|
| GET | /battlemaps/:id/entities | Instances carte — JOIN blueprint avec pack_id (P47) |
| POST | /battlemaps/:id/entities | Poser une instance — GM uniquement + collisionAddEntity |
| PUT | /entities/:entityId | Modifier position/rotation/state/overrides — GM uniquement + maintenance Redis |
| DELETE | /entities/:entityId | Supprimer instance — GM uniquement + collisionRemoveEntity AVANT delete |

---

## Base de données — Migrations

| Migration | Contenu |
|---|---|
| 01→39 | voir JOURNAL archive |
| 41_entity_blueprints | entity_blueprints (id UUID, geometry/states/interactions JSONB, glb_url, deprecated, created_by) |
| 42_entities | entities (id UUID, battlemap_id CASCADE, blueprint_id, pos_x/y/z, r, current_state_id, gm_only, label_override, interaction_overrides JSONB, state JSONB, notes_gm) |
| 43_entity_pack_hint | entity_blueprints.pack_id UUID nullable FK → texture_packs.id + voxel_textures.usage_hint TEXT nullable |
| 44_tokens_rotation | tokens.r INTEGER NOT NULL DEFAULT 0 — 8 orientations 45° (PE21) |
| 45_polaris_mr_table | polaris_mr (mr_min PK, mr_max nullable, dmax) + seed 6 lignes |

---

## Collision map Redis — session 39

### Architecture
```
Redis Hash : "collision:{battlemap_id}"
  champ : "x:y:z"   (séparateur ":" — P17, coordonnées base)
  valeur : JSON { type: 'token'|'entity'|'voxel', id: string }
TTL : 24h — reconstruite à chaque SESSION_JOIN (PE23)
```

### Filtres
- Tokens `layer = 'gm'` : exclus (invisibles aux joueurs)
- Entités : incluses uniquement si `is_blocking = true` dans l'état courant
- Voxels : tous inclus

### Reconstruction
`buildCollisionMap(battlemapId)` — pipeline Redis, appelée au SESSION_JOIN depuis `player_locations`.
Non bloquante si joueur sans `player_location` (première connexion).

### Maintenance temps réel
| Événement | Handler | Action Redis |
|---|---|---|
| Token créé | `POST /tokens` (REST) | `collisionAddToken` |
| Token déplacé | `PUT /tokens/:id` (REST) + `TOKEN_MOVE` (WS) | `collisionMoveToken` |
| Token supprimé | `DELETE /tokens/:id` (REST) | `collisionRemoveToken` AVANT delete |
| Token rotate | `TOKEN_ROTATE` (WS) | aucune — position inchangée |
| Entité créée | `POST /entities` (REST) | `collisionAddEntity` |
| Entité déplacée/état changé | `PUT /entities/:id` (REST) | `collisionMoveEntity` ou `collisionUpdateEntityState` |
| Entité supprimée | `DELETE /entities/:id` (REST) | `collisionRemoveEntity` AVANT delete |
| Entité état changé (interaction) | `resolveEntityState` (WS) | `collisionUpdateEntityState` |
| Voxel ajouté | `VOXEL_ADD` (WS) | `collisionAddVoxel` |
| Voxel supprimé | `VOXEL_REMOVE` (WS) | `collisionRemoveVoxel` |
| Voxel tourné | `VOXEL_UPDATE` (WS) | aucune — position inchangée |

---

## Rotation tokens — session 39

- `tokens.r` : INTEGER 0-7 — `rotation.y = r * Math.PI / 4` (PE21)
- `TOKEN_ROTATE` WS : clic court sur token propriétaire → serveur incrémente `r = (r+1) % 8` → broadcast `TOKEN_UPDATED`
- Canvas3D : rotation appliquée sur `<group>` parent — tilt drag conservé sur `<primitive>` enfant
- V1 : clic = +45°. V2 (9F-C) : UI radio 8 directions

---

## Composants entités — session 34

### EntityMesh.jsx
- Branche voxel (`EntityMeshVoxel`) + branche GLB (`EntityMeshGlb`)
- Timer 400ms sur `onPointerLeave` via `leaveTimerRef`
- Hitbox invisible ×1.4 en X et Z
- `HoverIcon` : `<Html>` pointerEvents none, div interne auto
- PE14, PE11, PE4, P32 respectés

### RadialMenu.jsx
- Menu SVG fixed centré sur le clic
- Tranche GM "Modifier" en violet
- Fermeture : clic extérieur, Échap, centre ✕, après action

### EntityInstancePanel.jsx
- Panneau flottant GM — modifie l'instance uniquement
- Champs : `label_override`, `gm_only`, `disabled_interactions`, `notes_gm`
- Header draggable, sauvegarde via PUT /entities/:id

---

## Flux interactions entités

### Flux joueur ✅
```
Joueur clique ⚙ → handleEntityClick → filter interactions par current_state_id
  → si 1 seule interaction : action directe sans radial
  → si 2+ interactions : RadialMenu
Joueur choisit → handleEntityAction → socket.emit(WS.ENTITY_ACTION_REQUEST)
Serveur → ENTITY_ACTION_PENDING → GM reçoit notification dans chat
GM arbitre → socket.emit(WS.ENTITY_ACTION_RESOLVE)
Serveur → resolveEntityState → update current_state_id → collisionUpdateEntityState → ENTITY_UPDATED broadcast
```

### Flux GM ✅
Action directe via ENTITY_ACTION_GM_DIRECT — sans arbitrage ni traçage.

### Flux sans compétence ✅
skill_id et attribute_id null → resolveEntityState direct, sans notifier le GM, sans jet.

### Règles mécaniques Polaris (LdB p.404)
```
chancesDeReussite = skillTotal + difficulty_dc + gmModifier
isSuccess = diceRoll <= chancesDeReussite
difficulty_dc = modificateur signé (-20 à +10)
```

---

## Pièges actifs — tous domaines

| Code | Description |
|---|---|
| P13 | updated_at après guard Object.keys |
| P14 | updated_at jamais dans JWT |
| P19 | glb_url avec ?v=timestamp |
| P20 | mat.clone() avant mutation Three.js |
| P22 | voxel_textures.id = integer |
| P26 | blocksReady = true même si 0 textures |
| P32 | Ordre faces BoxGeometry : east(0)…north(5) |
| P43 | MinIO textures par pack_uuid |
| P44 | name pack immuable |
| P46 | Route spécifique avant paramétrique |
| P47 | pack_id doit être dans le SELECT JOIN entities GET + ENTITY_CREATED socket |
| P48 | handleEntityAction déclaré avant handleEntityClick |
| PE1 | SUPPRIMÉ — serveur calcule via charStats.js |
| PE2 | socket.data.role pour fetchSockets() |
| PE4 | face null = invisible |
| PE11 | fallback states[0] |
| PE12 | clearTimeout pendingEntityActions |
| PE14 | pos_y/pos_z inversés Three.js ↔ base |
| PE16 | e.code pour Alt |
| PE17 | usage_hint hint de tri, jamais exclusif |
| PE18 | blueprint.pack_id nullable — guard |
| PE21 | r tokens = 0-7 — rotation.y = r * Math.PI / 4 |
| PE22 | tunnel de swap excludeIds dans isCaseOccupied |
| PE23 | buildCollisionMap au SESSION_JOIN — pas au démarrage serveur |
| PE24 | collisionMoveToken : hdel systématique ancienne case, hset conditionnel layer |
| PE25 | maintenance Redis dans REST, pas dans handlers WS reliques |
| PE26 | resolveEntityState : returning doit inclure battlemap_id |
| PEF1-PEF6 | voir SYSTEME.md section 6 |
