# ASBUILT — Ce qui est codé et stable

## Structure du projet
```
Enclume/
├── client/                    # Vide — pas encore initialisé
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   ├── 20260329_01_users.js
│   │   │   │   ├── 20260329_02_campaigns.js
│   │   │   │   ├── 20260329_03_campaign_members.js
│   │   │   │   ├── 20260329_04_battlemaps.js
│   │   │   │   ├── 20260329_05_tokens.js
│   │   │   │   └── 20260329_06_documents_and_dice.js
│   │   │   └── knex.js
│   │   ├── routes/            # Vide
│   │   ├── middleware/        # Vide
│   │   ├── socket/            # Vide
│   │   └── lib/               # Vide
│   │   └── index.js
│   ├── knexfile.cjs
│   └── package.json
├── shared/                    # Vide — pas encore initialisé
├── docs/
│   ├── JOURNAL.md
│   ├── ROADMAP.md
│   ├── ASBUILT.md
│   ├── EN_COURS.md
│   ├── ARCHITECTURE.md
│   └── CONVENTIONS.md
├── docker-compose.yml
├── .env                       # À la racine, jamais commité
└── .env.example
```

---

## Fichiers stables

### `docker-compose.yml`
Lance PostgreSQL 16, Redis 7, MinIO.
Volumes persistants : `pgdata`, `miniodata`.
Ports : 5432 / 6379 / 9000 / 9001.

### `server/package.json`
- Type : ES Module (`"type": "module"`)
- Scripts : `npm start` (prod) / `npm run dev` (nodemon)
- Dépendances : express, socket.io, jsonwebtoken, bcrypt, knex, pg, dotenv, cors
- DevDependances : nodemon

### `server/knexfile.cjs`
- Format CommonJS (requis par Knex CLI)
- Lit `.env` via `{ path: '../.env' }`
- Migrations : `./src/db/migrations`

### `server/src/db/knex.js`
- Instance Knex connectée à PostgreSQL via `DATABASE_URL`
- Connexion en fonction `() => process.env.DATABASE_URL` — garantit que
  dotenv a tourné avant la tentative de connexion
- Exportée comme module ES

### `server/src/index.js`
- Serveur Express + Socket.io
- Lit `.env` via `dotenv.config({ path: '../.env' })`
- Route GET `/api/health` → `{ status: 'ok', project: 'Enclume' }`
- Log connexion/déconnexion Socket.io
- Écoute sur port 3001

### Migrations (toutes appliquées — Batch 1)
| Fichier | Table créée |
|---|---|
| 20260329_01_users.js | `users` |
| 20260329_02_campaigns.js | `campaigns` |
| 20260329_03_campaign_members.js | `campaign_members` |
| 20260329_04_battlemaps.js | `battlemaps` |
| 20260329_05_tokens.js | `tokens` |
| 20260329_06_documents_and_dice.js | `documents` + `dice_rolls` |

---

## Base de données
- Moteur : PostgreSQL 16 (Docker)
- Credentials : user `vtt` / password `vttpass` / db `vtt`
- Toutes les tables créées et vérifiées

### Gestion d'erreurs
- `server/src/lib/AppError.js` — classe d'erreur personnalisée
  - Prend un `statusCode` et un `message`
  - Usage : `throw new AppError(404, 'Campaign not found')`
- `server/src/middleware/errorHandler.js` — gestionnaire central
  - Dernier middleware dans `index.js`
  - Retourne `{ error: { status, message } }` en JSON
  - Log l'erreur en console si `NODE_ENV === 'development'`

  ### Routes auth (`server/src/routes/auth.js`)
- POST `/api/auth/register` — création compte, pose cookie JWT
- POST `/api/auth/login` — connexion, pose cookie JWT
- POST `/api/auth/logout` — efface le cookie
- GET `/api/auth/me` — profil utilisateur connecté (protégé)
- Toutes testées et stables via Bruno
- Cookie httpOnly, durée 7 jours, secure en production

### Middleware auth (`server/src/middleware/auth.js`)
- `requireAuth` — vérifie le cookie JWT
- Ajoute `req.user` à la requête si valide
- Retourne 401 si absent ou invalide

### Middleware roles (`server/src/middleware/role.js`)
- `requireRole(role)` — vérifie le rôle dans la campagne concernée
- Usage : `requireRole('gm')` ou `requireRole('player')`
- Toujours utilisé après `requireAuth`
- Ajoute `req.member` à la requête si valide
- Retourne 403 si pas membre ou mauvais rôle

### Routes campagnes (`server/src/routes/campaigns.js`)
- GET `/api/campaigns` — liste des campagnes de l'utilisateur
- POST `/api/campaigns` — créer une campagne (devient GM automatiquement)
- GET `/api/campaigns/:id` — détail + membres (GM uniquement)
- PUT `/api/campaigns/:id` — modifier nom/statut (GM uniquement)
- POST `/api/campaigns/join` — rejoindre via invite_code
- GET `/api/campaigns/:id/members` — liste des membres (GM uniquement)
- Toutes testées et stables via Bruno

### Pages React (`client/src/pages/`)
- `LoginPage.jsx` — formulaire login, gestion erreurs, redirection
- `RegisterPage.jsx` — formulaire register, validation mot de passe
- `DashboardPage.jsx` — liste campagnes, créer, rejoindre, logout
- Toutes testées et stables

### Store auth (`client/src/stores/authStore.js`)
- Zustand — état global utilisateur connecté
- `user`, `isLoading`, `setUser`, `clearUser`

### Client HTTP (`client/src/lib/api.js`)
- Axios configuré sur `http://localhost:3001/api`
- `withCredentials: true` — envoie les cookies automatiquement

### Routage (`client/src/App.jsx`)
- `ProtectedRoute` — redirige vers /login si non connecté
- `PublicRoute` — redirige vers /dashboard si déjà connecté
- Vérifie `/auth/me` au démarrage pour restaurer la session