# ASBUILT — Ce qui est codé et stable
> Dernière mise à jour : 2026-04-06 Session 14
> Ce document est un snapshot de référence rapide.
> Pour les flux détaillés, ownership, pièges : voir SYSTEME.md.
> Pour l'historique des décisions : voir JOURNAL.md.

---

## Structure du projet
```
Enclume/
├── client/
│   ├── public/
│   │   └── fonts/
│   │       └── inter.woff              # Police locale pour labels 3D (drei Text)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas3D.jsx            # Modifié session 13 — format voxel "x:y:z": mat
│   │   │   └── Sidebar.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── SessionPage.jsx         # Modifié session 14 — tokenStore + loadMap/handleMapSwitch
│   │   ├── stores/
│   │   │   ├── authStore.js
│   │   │   └── tokenStore.js              # Nouveau session 14 — tokens (setTokens, addToken, removeToken, updateToken)
│   │   ├── locales/
│   │   │   └── fr.json                 # Source de vérité i18n — seule langue
│   │   ├── lib/
│   │   │   └── api.js
│   │   ├── i18n.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/             # 19 migrations appliquées
│   │   │   └── knex.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js            # Modifié session 12 — updated_at PUT
│   │   │   ├── battlemaps.js           # Modifié session 12+13 — updated_at + validation voxel objet
│   │   │   ├── tokens.js               # Modifié session 11+12 — broadcasts WS + updated_at
│   │   │   ├── characters.js           # Modifié session 11+12 — broadcast WS + updated_at
│   │   │   ├── textures.js
│   │   │   ├── assets.js
│   │   │   └── users.js                # Modifié session 12 — updated_at PUT
│   │   ├── middleware/
│   │   │   ├── auth.js                 # requireAuth — attache req.user = JWT payload
│   │   │   ├── role.js
│   │   │   ├── upload.js
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   ├── auth.js                 # Middleware JWT WebSocket
│   │   │   └── index.js                # Modifié session 11+12+13 — VOXEL_ADD/REMOVE dictionnaire
│   │   ├── lib/
│   │   │   ├── AppError.js
│   │   │   └── minio.js
│   │   └── index.js                    # Modifié session 11 — app.set('io', io)
│   ├── knexfile.cjs
│   └── package.json
├── shared/
│   └── events.js                       # Constantes WS — source de vérité événements socket
├── docs/
│   ├── JOURNAL.md
│   ├── ASBUILT.md
│   ├── SYSTEME.md
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── EN_COURS.md
│   └── ROADMAP.md
├── MISSION_chantier (fichier unique contenant chantiers 1→8 + addendum session 12)
├── docker-compose.yml
├── start.ps1
├── .env
└── .env.example
```

---

## Infrastructure

### Docker
PostgreSQL 16, Redis 7, MinIO — volumes persistants.
Ports : 5432 / 6379 / 9000 / 9001.

### MinIO
Bucket `enclume-assets` — mode PRIVATE. Le serveur Express proxifie tout.
Sous-dossiers :
- `tokens/` — dont `default.glb` (modèle Blender propre, 1×2 unités, origine aux pieds)
- `textures/` — packs de textures voxel (ex: `textures/hard-sf/`)
- `campaigns/`, `battlemaps/`, `documents/`, `audio/`
Console : http://localhost:9001

### start.ps1
Script PowerShell racine. Vérifie et relance Docker, conteneurs, serveur (3001), client (5173).

---

## Variables d'environnement

`.env` unique à la racine — jamais de `client/.env`.
- `VITE_API_URL=http://localhost:3001`
- Variables serveur : DATABASE_URL, REDIS_URL, MINIO_*, JWT_SECRET, NODE_ENV, CLIENT_URL

---

## Serveur

### Architecture WS — règle Chantier 1
**Le serveur est le seul émetteur d'événements WS suite à une action REST.**
Pattern : `const io = req.app.get('io')` dans les routes qui broadcastent.
Le client n'émet plus jamais de socket.emit après un appel REST.
Exceptions conservées côté client (commandes, pas broadcasts) :
- `MAP_SWITCH` — commande GM volontaire
- `VOXEL_ADD` / `VOXEL_REMOVE` — édition temps réel socket
- `CHAT_MESSAGE` — pas un post-REST

### Routes montées (index.js)
```
/api/health
/api/auth
/api/campaigns
/api/campaigns/:campaignId/characters    ← mergeParams
/api/characters                          ← actionsRouter standalone
/api/campaigns/:id/battlemaps
/api/battlemaps
/api/battlemaps/:id/tokens
/api/tokens
/api/textures
/api/assets
/api/users
```

### middleware/auth.js
`requireAuth` : cookie `token` → `jwt.verify()` → `req.user = { id, email, username, iat, exp }`
`color` absente du JWT — toujours relire la DB.

### Routes REST

**Auth (/api/auth)**
| Méthode | Route | Description |
|---|---|---|
| POST | /register | Crée user + couleur aléatoire + JWT cookie |
| POST | /login | Vérifie credentials + JWT cookie |
| POST | /logout | Efface le cookie |
| GET | /me | Retourne `{ id, email, username, color }` |

**Users (/api/users)**
| Méthode | Route | Description |
|---|---|---|
| PUT | /me | Modifie username/email/color/password. Régénère JWT si username/email change. Retourne updated_at. |

**Campagnes (/api/campaigns)**
| Méthode | Route | Description |
|---|---|---|
| GET | / | Liste campagnes de l'utilisateur |
| POST | / | Créer campagne + battlemap d'accueil (transaction) |
| GET | /:id | Détail + membres + battlemaps (tous membres) |
| PUT | /:id | Modifier nom/statut/default_battlemap_id (GM). Retourne updated_at. |
| POST | /join | Rejoindre via invite_code |
| GET | /:id/members | Liste membres (GM) |

**Characters**
| Méthode | Route | Description |
|---|---|---|
| GET | /campaigns/:id/characters | GM : tout + gm_notes + updated_at. Joueur : visible=true, sans gm_notes |
| POST | /campaigns/:id/characters | Créer (GM) — visible=false par défaut |
| PUT | /characters/:id | GM ou owner. updated_at mis à jour. Broadcast CHARACTER_UPDATED (sans gm_notes, avec updated_at). |
| DELETE | /characters/:id | Supprimer (GM) |

**Battlemaps**
| Méthode | Route | Description |
|---|---|---|
| GET | /campaigns/:id/battlemaps | Liste des cartes |
| POST | /campaigns/:id/battlemaps | Créer carte (GM) |
| GET | /battlemaps/:id | Carte + tokens filtrés par rôle |
| PUT | /battlemaps/:id | Modifier métadonnées + image (multer, GM). updated_at mis à jour. |
| PUT | /battlemaps/:id/voxels | Mettre à jour voxel_data (objet `{"x:y:z": mat}`, GM). updated_at mis à jour. |
| DELETE | /battlemaps/:id | Supprimer + fallback default_battlemap_id |
| POST | /battlemaps/:id/duplicate | Dupliquer une carte (GM) |

**Tokens**
| Méthode | Route | Description |
|---|---|---|
| POST | /battlemaps/:id/tokens | GM libre / Joueur propriétaire sans doublon. Broadcast TOKEN_CREATED (avec updated_at). |
| PUT | /tokens/:id | GM ou propriétaire via character_id. updated_at mis à jour. Broadcast TOKEN_MOVED (avec updated_at). |
| DELETE | /tokens/:id | GM ou propriétaire via character_id. Broadcast TOKEN_DELETED. |

### Socket.io — handlers

| Événement reçu | Vérif | Action | Broadcast |
|---|---|---|---|
| SESSION_JOIN | membre | join room, socket.data.userId, onlineUserIds | SESSION_JOINED (émetteur) + SESSION_USER_JOINED (autres) |
| TOKEN_MOVE | GM ou owner | UPDATE DB + updated_at | TOKEN_MOVED { tokenId, pos_x, pos_y, pos_z, updated_at } à toute la room |
| TOKEN_CREATED | — | relit token | TOKEN_CREATED { token } à toute la room |
| TOKEN_DELETED | — | — | TOKEN_DELETED { tokenId } à toute la room |
| VOXEL_ADD | GM | guard battlemapId + dict spread + UPDATE | VOXEL_ADDED à toute la room |
| VOXEL_REMOVE | GM | dict spread + delete + UPDATE | VOXEL_REMOVED à toute la room |
| MAP_SWITCH | GM | UPSERT player_locations | MAP_SWITCH { battlemapId, userIds } à toute la room |
| MAP_VIEWPORT | GM | — | MAP_VIEWPORT aux autres |
| CHAT_MESSAGE | — | lit color depuis DB | CHAT_MESSAGE { userId, username, color, text, timestamp } |
| CHARACTER_UPDATED | GM | relit character + JOIN | CHARACTER_UPDATED sans gm_notes, avec updated_at, à toute la room |
| disconnect | — | — | SESSION_USER_LEFT aux autres |

Note : TOKEN_MOVE, TOKEN_CREATED, TOKEN_DELETED, CHARACTER_UPDATED sont redondants avec
les broadcasts REST (Chantier 1). Conservés temporairement — à nettoyer dans un chantier dédié.

---

## Base de données — 19 migrations stables

| Migration | Contenu |
|---|---|
| 01_users | users (id uuid, email, username, password_hash, color, created_at, updated_at) |
| 02_campaigns | campaigns (+ critical_success, critical_fail, default_battlemap_id, created_at, updated_at) |
| 03_campaign_members | campaign_members (created_at, updated_at) |
| 04_battlemaps | battlemaps (+ folder, scale_label, grid_opacity, voxel_data, created_at, updated_at) |
| 05_tokens | tokens (sans timestamps — ajoutés migration 19) |
| 06_documents_and_dice | documents + dice_rolls (created_at, updated_at) |
| 07_campaigns_phase2 | cover_image_url, critical_success, critical_fail |
| 08_battlemaps_phase2 | folder, scale_label, grid_opacity |
| 09_tokens_phase2 | layer, cover_percent, notes, gm_notes |
| 10_walls_zones_player_locations | walls (created_at), zones (created_at), player_locations (updated_at) |
| 11_campaigns_default_battlemap | default_battlemap_id |
| 12_tokens_pos_z | pos_z FLOAT |
| 13_battlemaps_voxel_data | voxel_data JSONB |
| 14_users_color | color VARCHAR(7) sur users |
| 15_characters | table characters complète (created_at) |
| 16_tokens_character_id | character_id UUID nullable sur tokens |
| 17_tokens_color | color VARCHAR(7) nullable sur tokens |
| 18_characters_text_fields | description + gm_notes TEXT nullable sur characters |
| 19_timestamps | tokens (created_at+updated_at), characters (updated_at), walls (updated_at), zones (updated_at), player_locations (created_at) |

---

## Client React

### Dépendances clés
react 19, react-router-dom, zustand, axios,
@react-three/fiber v9, @react-three/drei v10, three, three-stdlib,
i18next, react-i18next, socket.io-client

### tokenStore.js — session 14
```javascript
{ tokens, setTokens, addToken, removeToken, updateToken }
// setTokens(tokens)       — remplacement complet (chargement, changement carte)
// addToken(token)         — ajout avec guard doublon intégré
// removeToken(tokenId)    — suppression par id
// updateToken(partial)    — mise à jour partielle + guard obsolescence updated_at
```

### authStore.js
```javascript
{ user, isLoading, setUser, clearUser }
// user = { id, email, username, color } — depuis GET /auth/me
```

### fr.json — namespaces actifs
`common` / `auth` / `dashboard` / `session` / `dice` / `chat` / `token` /
`battlemap` / `errors` / `sidebar` / `character` / `profile`

### SessionPage.jsx — états principaux
```
socket            useState(null)   — déclaré AVANT les callbacks qui l'utilisent
reconnectTrigger  useState(0)      — increment → useEffect socket se ré-exécute
tokens            tokenStore       — migré session 14 (était useState)
characters        array
members           array
battlemaps        array            — liste cartes pour barre GM
messages          array            — { id, user?, color?, text, time, system? }
isGm              bool
battlemap         object
onlineUsers       Set<userId>
contextMenu       object|null      — menu token
mapContextMenu    object|null      — menu carte barre GM
```

**loadSession — Chantier 4 (session 12) :**
```javascript
// load() extraite en useCallback loadSession — déclarée AVANT useEffect socket
const loadSession = useCallback(async () => {
  // GET /campaigns/:id + GET /battlemaps/:id + GET /characters + GET /battlemaps
}, [campaignId, user?.id])

useEffect(() => { loadSession() }, [loadSession])
```

**loadMap / handleMapSwitch — distinction NON NÉGOCIABLE (session 14) :**
```javascript
// loadMap — chargement local uniquement, sans emit
// Utilisé : clic barre GM, suppression carte active
const loadMap = useCallback(async (battlemapId) => { ... }, [isGm])

// handleMapSwitch — charge localement + émet MAP_SWITCH à tous les joueurs
// Utilisé : bouton "Déplacer le groupe ici" uniquement
const handleMapSwitch = useCallback(async (battlemapId) => {
  await loadMap(battlemapId)
  socket?.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
}, [loadMap, socket])
```

**Pattern reconnectTrigger :**
```javascript
useEffect(() => {
  const s = io(...)
  // handlers...
  setSocket(s)
  return () => s.disconnect()
}, [campaignId, reconnectTrigger, loadSession])
// Sidebar appelle onReconnectSocket → setReconnectTrigger(n => n + 1)
```

**Handler TOKEN_MOVED — guard obsolescence (session 12) :**
```javascript
s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) => {
  setTokens(prev => prev.map(t => {
    if (t.id !== tokenId) return t
    if (updated_at && t.updated_at && updated_at < t.updated_at) return t
    return { ...t, pos_x, pos_y, pos_z, updated_at }
  }))
})
```

### Canvas3D.jsx — constantes critiques
```javascript
Y_OFFSET = 0.5      // Décalage modèle dans le group (pieds à 0 du group)
DRAG_HOVER = 0.5    // Élévation visuelle pendant drag
DRAG_TILT_MAX = 0.3
DRAG_THRESHOLD = 4
```

**Position token au repos :**
```javascript
y = baseY + 0.5     // baseY = token.pos_z (altitude brute)
                    // +0.5 = dessus du voxel Y=0 (voxel rendu à y+0.5)
```

**getColumnTopY — contrat session 9 :**
```javascript
// Retourne -1 si colonne vide, Y brut (≥0) si voxel trouvé
// Drag : Math.max(0, columnY) + 0.5 + DRAG_HOVER
// Drop GM : snappedY >= -1
// Drop joueur : snappedY >= 0 && snappedY <= 7
```

**threeToDb — NON NÉGOCIABLE :**
```javascript
threeToDb(tx, ty, tz) → { pos_x: tx, pos_y: tz, pos_z: ty }
```

**Format voxel — Chantier 3 (session 13) :**
```javascript
// Base de données : { "x:y:z": mat }  ← entier seul
// Mémoire React   : { "x:y:z": { x, y, z, mat } }  ← objet complet pour le rendu
// getVoxelKey(x, y, z) → `${x}:${y}:${z}`
// Initialisation : Object.entries(battlemap.voxel_data) + key.split(':').map(Number)
// save() : projection payload[key] = v.mat avant envoi REST — NON NÉGOCIABLE
```

### Sidebar.jsx — onglets
`chat` / `persos` / `joueurs` / `biblio` / `config`

**Props Sidebar :**
```
isGm, mode, onModeChange, layer, onLayerChange,
width, onWidthChange, onClose,
activeMaterial, onMaterialChange, availableMaterials,
characters, onCharactersChange, campaignId,
messages, socket, campaignMembers, onlineUsers, onReconnectSocket
```

### shared/events.js — constantes WS
```
SESSION_JOIN/JOINED/USER_JOINED/USER_LEFT
TOKEN_MOVE/MOVED/CREATED/DELETED/UPDATED
VOXEL_ADD/ADDED/REMOVE/REMOVED
DICE_ROLL/RESULT
MAP_SWITCH/VIEWPORT
DOC_SHARED
CHARACTER_UPDATED
CHAT_MESSAGE
```