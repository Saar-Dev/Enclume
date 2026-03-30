# ROADMAP — Projet Enclume

## Méthodologie de travail
- Une étape stable et certaine avant de passer à la suivante
- Pas de rustines : la bonne architecture dès le début
- Toute décision non documentée est considérée comme nulle
- Runs à vide réguliers pour vérifier l'alignement
- Priorité : CODE (mémoire externe) > conversation en cours

## Structure des sessions
1. Lire JOURNAL.md + ASBUILT.md + EN_COURS.md
2. Identifier où on en est
3. Travailler par étapes stables
4. Mettre à jour la doc avant de terminer la session

---

## Phase 0 — Socle technique
**Objectif :** tout ce dont on a besoin pour commencer à coder le vrai projet.

| Tâche | État |
|---|---|
| Structure monorepo (client, server, shared, docs) | ✅ Stable |
| Git initialisé | ✅ Stable |
| Docker : PostgreSQL + Redis + MinIO | ✅ Stable |
| Serveur Express + Socket.io minimal | ✅ Stable |
| Route /api/health | ✅ Stable |
| Migrations Knex (6 tables) | ✅ Stable |
| Connexion DB vérifiée au démarrage serveur | ✅ Stable |
| shared/events.js | ✅ Stable |
| Client React initialisé (Vite) | ✅ Stable |

## Phase 1 — Auth + campagnes
**Objectif :** register, login, logout, CRUD campagnes, invite code.

| Tâche | État |
|---|---|
| Middleware requireAuth (JWT) | ✅ Stable |
| Middleware requireGM | ✅ Stable |
| POST /auth/register | ✅ Stable |
| POST /auth/login | ✅ Stable |
| POST /auth/logout | ✅ Stable |
| GET /auth/me | ✅ Stable |
| CRUD campagnes | ✅ Stable |
| Rejoindre via invite_code | ✅ Stable |
| Dashboard GM | ✅ Stable |

## Phase 2 — Battlemap + dés
**Objectif :** canvas Konva.js, tokens, Socket.io, lanceur de dés.

| Tâche | État |
|---|---|
| Upload image de fond | 🔲 À faire |
| Affichage Konva.js | 🔲 À faire |
| Création / placement / drag & drop tokens | 🔲 À faire |
| Synchronisation tokens via Socket.io | 🔲 À faire |
| Grille optionnelle | 🔲 À faire |
| Lanceur de dés (grille NdX + parser formule) | 🔲 À faire |
| Animation dés (seed partagé) | 🔲 À faire |
| Log partagé des jets | 🔲 À faire |

## Phase 3 — Bibliothèque + polish
**Objectif :** documents, chat, intégration fiches perso, optimisations.

| Tâche | État |
|---|---|
| Upload documents vers MinIO | 🔲 À faire |
| Bibliothèque avec gestion visibilité | 🔲 À faire |
| Chat textuel sidebar | 🔲 À faire |
| Point intégration fiches perso (API REST) | 🔲 À faire |
| Reconnexion WebSocket automatique | 🔲 À faire |
| Persistance viewport | 🔲 À faire |

## Phase 2 — Battlemap + dés
**Objectif :** canvas Konva.js, tokens, Socket.io, lanceur de dés.

| Tâche | État |
|---|---|
| Configuration MinIO (bucket + credentials) | 🔲 À faire |
| Migrations Phase 2 (nouveaux champs + tables) | 🔲 À faire |
| Routes serveur : battlemaps | 🔲 À faire |
| Routes serveur : tokens | 🔲 À faire |
| Routes serveur : walls + zones | 🔲 À faire |
| Routes serveur : player_locations | 🔲 À faire |
| Socket.io — authentification WS | 🔲 À faire |
| Socket.io — events tokens, viewport, map:switch | 🔲 À faire |
| Page Session — layout (toolbar + canvas + sidebar) | 🔲 À faire |
| Konva.js — affichage carte + grille + navigation | 🔲 À faire |
| Konva.js — calques (background / gm / token) | 🔲 À faire |
| Tokens — affichage + drag & drop | 🔲 À faire |
| Tokens — synchronisation Socket.io | 🔲 À faire |
| Zones Avantage/Neutre/Désavantage | 🔲 À faire |
| Murs — tracé + stockage | 🔲 À faire |
| Outil règle / mesure | 🔲 À faire |
| Viewport — libre + Snap GM + Verrouiller | 🔲 À faire |
| Déplacement joueurs entre battlemaps | 🔲 À faire |
| Dés — grille NdX + parser formule | 🔲 À faire |
| Dés — animation client (seed partagé) | 🔲 À faire |
| Dés — critiques (animation + son) | 🔲 À faire |
| Log partagé des jets | 🔲 À faire |