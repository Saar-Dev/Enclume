# ASBUILT — Ce qui est codé et stable
> Dernière mise à jour : 2026-03-31 Session 3

---

## Structure du projet
```
Enclume/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas3D.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── SessionPage.jsx
│   │   ├── stores/
│   │   │   └── authStore.js
│   │   ├── locales/
│   │   │   └── fr.json
│   │   ├── lib/
│   │   │   └── api.js
│   │   ├── i18n.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/          # 13 migrations appliquées
│   │   │   └── knex.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js
│   │   │   ├── battlemaps.js
│   │   │   ├── tokens.js
│   │   │   └── textures.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── role.js
│   │   │   ├── upload.js
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   ├── auth.js
│   │   │   └── index.js
│   │   └── lib/
│   │       ├── AppError.js
│   │       └── minio.js
│   │   └── index.js
│   ├── knexfile.cjs
│   └── package.json
├── shared/
│   └── events.js
├── docs/
├── docker-compose.yml
├── start.ps1
├── .env                             # À la racine, jamais commité
└── .env.example
```

---

## Infrastructure

### Docker
PostgreSQL 16, Redis 7, MinIO — volumes persistants.
Ports : 5432 / 6379 / 9000 / 9001.

### MinIO
Bucket `enclume-assets` créé. Sous-dossiers : campaigns/ battlemaps/ tokens/ documents/ audio/
Console : http://localhost:9001 (login: vttuser / vttpass123)

**Textures :** stockées dans `textures/<pack-name>/` avec sous-dossiers par catégorie.
Structure : `textures/hard-sf/manifest.json` + PNGs dans `floor/`, `wall/`, `hazard/`, etc.
Le bucket reste en mode PRIVATE — le serveur Express proxifie tout, le client ne touche jamais MinIO directement.

### start.ps1
Script PowerShell racine. Vérifie et relance Docker, conteneurs, serveur (3001), client (5173).
Commande : `.\start.ps1`

---

## Variables d'environnement

### `.env` racine (serveur + Vite)
- `VITE_API_URL=http://localhost:3001` — URL du serveur, lue par le client via `import.meta.env.VITE_API_URL`
- Toutes les autres variables serveur habituelles (DB, MinIO, JWT, etc.)

### `client/vite.config.js`
Configuré avec `envDir` pointant vers la racine du monorepo — Vite lit le `.env` racine.
Pas de `client/.env` séparé — source de vérité unique.

---

## Serveur

### Dépendances installées
express, socket.io, jsonwebtoken, bcrypt, knex, pg, dotenv, cors,
cookie-parser, minio, multer, cookie

### index.js
- Vérification PostgreSQL + MinIO au démarrage
- Routes : /api/auth, /api/campaigns, /api/campaigns/:id/battlemaps,
  /api/battlemaps, /api/battlemaps/:id/tokens, /api/tokens, /api/textures
- Socket.io initialisé via initSocket(io)

### lib/minio.js
Client MinIO lazy (initialisation après dotenv).
`getMinioClient()` (export défaut) / `BUCKET()` (export nommé) / `getFileUrl(objectName)`

### middleware/upload.js
multer mémoire + validation MIME (images + PDF) + taille max 20Mo.
`multerUpload.single('image')` + `uploadToMinio(folder)` → ajoute req.file.url

### socket/auth.js
Middleware JWT pour WebSocket. Lit le cookie via package `cookie`.
Attache socket.user. Refuse la connexion si JWT absent ou invalide.

### socket/index.js
Événements implémentés :
- session:join / session:joined / session:user_joined / session:user_left
- token:move / token:moved
- voxel:add / voxel:added / voxel:remove / voxel:removed
- map:switch (mise à jour player_locations en base)
- map:viewport (Snap GM / verrouillage)
- chat:message
- dice:roll (placeholder — TODO)

---

## Routes

### Auth (/api/auth)
POST register / POST login / POST logout / GET me
Cookie httpOnly, 7 jours, secure en production.

### Campagnes (/api/campaigns)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | /campaigns | auth | Liste des campagnes |
| POST | /campaigns | auth | Créer campagne + battlemap "Carte d'accueil" (transaction) |
| GET | /campaigns/:id | GM | Détail + membres + battlemaps |
| PUT | /campaigns/:id | GM | Modifier nom/statut |
| POST | /campaigns/join | auth | Rejoindre via invite_code |
| GET | /campaigns/:id/members | GM | Liste membres |

### Battlemaps (/api/battlemaps)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | /campaigns/:id/battlemaps | member | Liste des cartes |
| POST | /campaigns/:id/battlemaps | GM | Créer carte |
| GET | /battlemaps/:id | member | Carte + tokens (filtrés par rôle) |
| PUT | /battlemaps/:id | GM | Modifier métadonnées carte + image optionnelle |
| PUT | /battlemaps/:id/voxels | GM | Mettre à jour voxel_data (JSON pur, sans multer) |
| DELETE | /battlemaps/:id | GM | Supprimer + fallback default_battlemap_id |

### Tokens (/api/tokens)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | /battlemaps/:id/tokens | GM | Créer token |
| PUT | /tokens/:id | owner ou GM | Modifier (droits séparés) |
| DELETE | /tokens/:id | GM | Supprimer |

### Textures (/api/textures)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | /textures | public | Liste tous les packs + manifests depuis MinIO |
| GET | /textures/:pack/*filePath | public | Proxyfie un fichier PNG ou manifest depuis MinIO |

Pas d'auth requise — les textures ne sont pas des données sensibles.
Cache-Control: public, max-age=3600 sur les fichiers PNG.

---

## Base de données — 13 migrations

| Batch | Fichier | Contenu |
|---|---|---|
| 1 | 20260329_01_users.js | users |
| 1 | 20260329_02_campaigns.js | campaigns |
| 1 | 20260329_03_campaign_members.js | campaign_members |
| 1 | 20260329_04_battlemaps.js | battlemaps |
| 1 | 20260329_05_tokens.js | tokens |
| 1 | 20260329_06_documents_and_dice.js | documents + dice_rolls |
| 2 | 20260330_07_campaigns_phase2.js | cover_image_url, critical_success, critical_fail |
| 2 | 20260330_08_battlemaps_phase2.js | folder, scale_label, grid_opacity |
| 2 | 20260330_09_tokens_phase2.js | layer, cover_percent, notes, gm_notes |
| 2 | 20260330_10_walls_zones_player_locations.js | walls, zones, player_locations |
| 3 | 20260330_11_campaigns_default_battlemap.js | default_battlemap_id |
| 4 | 20260330_12_tokens_pos_z.js | pos_z |
| 4 | 20260330_13_battlemaps_voxel_data.js | voxel_data JSONB |

---

## Client React

### Dépendances installées
react 19, react-dom, react-router-dom, zustand, axios,
@react-three/fiber v9, @react-three/drei v10, three,
i18next, react-i18next, @fontsource/inter

### Localisation
i18n.js + locales/fr.json — configuré, importé dans main.jsx.
Toutes les chaînes UI en français via t('clé').

### vite.config.js
`envDir` configuré pour lire le `.env` à la racine du monorepo.
`__dirname` reconstruit via `fileURLToPath` (ES Modules).

### Routing (App.jsx)
/ → /dashboard
/login (PublicRoute)
/register (PublicRoute)
/dashboard (ProtectedRoute)
/session/:campaignId (ProtectedRoute)

### Pages
- LoginPage.jsx — formulaire login
- RegisterPage.jsx — formulaire register
- DashboardPage.jsx — liste campagnes, créer, rejoindre, bouton Launch branché
- SessionPage.jsx — page session complète

### SessionPage.jsx
Chef d'orchestre du layout session.
État géré : sidebarVisible, sidebarWidth, mode, layer, activeMaterial, availableMaterials.
Passe onPackLoaded à Canvas3D → reçoit les matières → les passe à Sidebar.
Rendu : Canvas3D (flex:1) + Sidebar (largeur contrôlée) + bouton réouverture.

### Canvas3D.jsx
Scène R3F complète :
- Chargement manifest + textures via GET /api/textures au montage
- Textures Three.js chargées via TextureLoader, cachées en mémoire (textureCache)
- Voxels depuis battlemap.voxel_data avec textures par face (top/side)
- Éditeur voxel en mode 'edit' : clic gauche pose, clic droit efface
- Raycasting sur plan de sol + voxels existants
- OrbitControls : clic molette orbite, clic droit pan, molette zoom
- Sauvegarde automatique toutes les 60s si dirty via PUT /battlemaps/:id/voxels
- Sauvegarde à la fermeture de l'éditeur (mode edit → play)
- Callback onPackLoaded appelé après chargement — remonte les matières à SessionPage

### Sidebar.jsx
Composant purement contrôlé.
Props : width, onWidthChange, onClose, mode, layer, activeMaterial, onMaterialChange, availableMaterials.
- Redimensionnable par drag (220px min, 500px max, fermeture sous 160px)
- Toggle mode jeu/édition (GM uniquement)
- Toggle layer token/GM (GM uniquement)
- Palette de matières visible en mode édition (grille 4 colonnes, textures depuis /api/textures)
- Menu mesure (dropdown 3 outils — non branchés)
- Onglets : Chat (local fonctionnel) / Biblio (Phase 3) / Params (à venir)
- isGM hardcodé à true — à brancher sur le vrai rôle

### Système de textures — format pack
- Stockage : MinIO `textures/<pack-name>/`
- manifest.json : name, label, tileSize, materials[]
- Chaque matière : id (int), name, label, top (chemin PNG), side (chemin PNG)
- Sous-dossiers libres dans le pack (floor/, wall/, hazard/, etc.)
- Le code charge le premier pack disponible par défaut
- tileSize actuel : 128x128px

### shared/events.js
Événements WS : SESSION_*, TOKEN_*, VOXEL_*, DICE_*, MAP_*, DOC_*, CHAT_*
