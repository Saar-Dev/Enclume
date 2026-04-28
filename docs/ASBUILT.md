# ASBUILT — Ce qui est codé et stable
> Dernière mise à jour : 2026-04-22 Session 34
> Ce document est un snapshot de référence rapide.
> Pour les flux détaillés, ownership, pièges : voir SYSTEME.md.
> Pour l'historique des décisions : voir JOURNAL.md.

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
│   │   │   ├── Canvas3D.jsx            # Modifié 34 — blueprintIds dans deps useEffect textures
│   │   │   ├── Editor3D.jsx            # Modifié 9C — EntityEditorScene, activeEditorTab
│   │   │   ├── EntityMesh.jsx          # Modifié 34 — timer 400ms, hitbox ×1.4, pointerEvents HoverIcon
│   │   │   ├── EntityBuilderTab.jsx    # Stable 33
│   │   │   ├── VoxelBuilderTab.jsx     # Stable 33
│   │   │   ├── RadialMenu.jsx          # Nouveau 34 — menu radial SVG entités
│   │   │   ├── EntityInstancePanel.jsx # Nouveau 34 — panneau config instance GM, header draggable
│   │   │   ├── Voxel.jsx               # Stable 9A-5
│   │   │   ├── Sidebar.jsx             # Modifié 9C — onglets éditeur + Actions GM
│   │   │   ├── GeometryIcon.jsx        # Stable 9A-3
│   │   │   └── DicePanel.jsx           # Stable session 18
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx       # Modifié 33 — lien Atelier du GM → /workshop
│   │   │   ├── SessionPage.jsx         # Modifié 34 — handleEntityAction avant handleEntityClick, deps, fallback character
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
│   │   │   └── fr.json
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
│   │   │   ├── migrations/             # 43 migrations appliquées (batch 16)
│   │   │   └── knex.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js
│   │   │   ├── battlemaps.js
│   │   │   ├── tokens.js
│   │   │   ├── characters.js
│   │   │   ├── textures.js
│   │   │   ├── assets.js
│   │   │   ├── users.js
│   │   │   ├── dice.js
│   │   │   ├── voxel-textures.js       # Modifié 33 — usage_hint exposé GET+PUT
│   │   │   ├── texture-packs.js
│   │   │   ├── entity-blueprints.js    # Modifié 33 — POST /:id/upload-glb
│   │   │   └── entities.js             # Modifié 34 — pack_id dans SELECT JOIN et objet blueprint
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── role.js
│   │   │   ├── upload.js
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   ├── auth.js
│   │   │   └── index.js                # Modifié 34 — pack_id dans SELECT JOIN ENTITY_CREATED
│   │   ├── lib/
│   │   │   ├── AppError.js
│   │   │   ├── minio.js
│   │   │   └── diceParser.js
│   │   └── index.js
├── shared/
│   └── events.js                       # Constantes WS — 8 ENTITY_* ajoutées session 9C
└── docs/
```

---

## Infrastructure

| Composant | Tech | Notes |
|---|---|---|
| Frontend | React 19 + Vite | Port 5173 dev |
| Backend | Node.js + Express + Socket.io | Port 3001 |
| Base de données | PostgreSQL | Knex migrations |
| Cache/sessions | Redis | |
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
| POST | /battlemaps/:id/entities | Poser une instance — GM uniquement |
| PUT | /entities/:entityId | Modifier position/rotation/state/overrides — GM uniquement |
| DELETE | /entities/:entityId | Supprimer instance — GM uniquement |

Note P47 : le blueprint embarqué dans la réponse GET inclut désormais `pack_id` — obligatoire pour que Canvas3D puisse charger les textures.

---

## Base de données — Migrations

| Migration | Contenu |
|---|---|
| 01→39 | voir JOURNAL archive |
| 41_entity_blueprints | entity_blueprints (id UUID, geometry/states/interactions JSONB, glb_url, deprecated, created_by) |
| 42_entities | entities (id UUID, battlemap_id CASCADE, blueprint_id, pos_x/y/z, r, current_state_id, gm_only, label_override, interaction_overrides JSONB, state JSONB, notes_gm) |
| 43_entity_pack_hint | entity_blueprints.pack_id UUID nullable FK → texture_packs.id + voxel_textures.usage_hint TEXT nullable |

---

## Composants entités — session 34

### EntityMesh.jsx
- Branche voxel (`EntityMeshVoxel`) + branche GLB (`EntityMeshGlb`)
- Timer 400ms sur `onPointerLeave` via `leaveTimerRef` — évite disparition ⚙ à angle rasant
- Hitbox invisible ×1.4 en X et Z — améliore ciblage angle rasant
- `HoverIcon` : `<Html>` avec `pointerEvents: 'none'`, div interne avec `pointerEvents: 'auto'` — cliquable sans déclencher boucle pointer events
- PE14, PE11, PE4, P32 respectés

### RadialMenu.jsx (nouveau)
- Menu SVG fixed centré sur le clic
- Tranches égales calculées par arc SVG
- Tranche GM "Modifier" en violet — appelle `onGmConfig`
- Fermeture : clic extérieur, Échap, centre ✕, après action
- Animation open/close CSS

### EntityInstancePanel.jsx (nouveau)
- Panneau flottant GM — modifie uniquement l'instance (pas le blueprint)
- Champs : `label_override`, `gm_only` (toggle), `disabled_interactions` (liste cliquable), `notes_gm`
- Header draggable : `dragRef` pattern, mousemove/mouseup sur `window`
- Sauvegarde via `PUT /entities/:id` + `updateEntity` store
- Fermeture : clic extérieur, Échap

---

## Flux interactions entités — état session 34

### Flux joueur (fonctionnel ✅)
```
Joueur clique ⚙ → handleEntityClick → filter interactions par current_state_id
  → si 1 seule interaction : action directe sans radial
  → si 2+ interactions : RadialMenu
Joueur choisit une tranche → handleEntityAction → socket.emit(WS.ENTITY_ACTION_REQUEST)
Serveur → ENTITY_ACTION_PENDING → GM reçoit notification dans chat
GM arbitre (Sidebar onglet Actions) → socket.emit(WS.ENTITY_ACTION_RESOLVE)
Serveur → resolveEntityState → PUT entities current_state_id → ENTITY_UPDATED broadcast
Client Canvas3D → updateEntity store → EntityMesh recalcule currentState → rendu
```

### Flux GM (non implémenté ❌ — Bug S34-4)
Décision prise : action directe, pas d'arbitrage, pas de traçage.
Architecture à définir en session 35.

### Bugs actifs sur ce flux
- S34-1 : changement d'état non visible sans F5 (intermittent)
- S34-2 : jet lancé sans compétence
- S34-3 : formule 2d10 au lieu de 1d20
- S34-5 : notifications dans onglet Actions au lieu du chat

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
| P48 | handleEntityAction déclaré avant handleEntityClick — P4 appliqué aux callbacks entités |
| PE1 | skillTotal calculé client |
| PE2 | socket.data.role pour fetchSockets() |
| PE4 | face null = invisible |
| PE11 | fallback states[0] |
| PE12 | clearTimeout pendingEntityActions |
| PE14 | pos_y/pos_z inversés Three.js ↔ base |
| PE16 | e.code pour Alt |
| PE17 | usage_hint hint de tri, jamais exclusif |
| PE18 | blueprint.pack_id nullable — guard |
| PEF1-PEF6 | voir SYSTEME.md section 6 |
