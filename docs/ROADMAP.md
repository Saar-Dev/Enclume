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
| Middleware requireAuth (JWT) | 🔲 À faire |
| Middleware requireGM | 🔲 À faire |
| POST /auth/register | 🔲 À faire |
| POST /auth/login | 🔲 À faire |
| POST /auth/logout | 🔲 À faire |
| GET /auth/me | 🔲 À faire |
| CRUD campagnes | 🔲 À faire |
| Rejoindre via invite_code | 🔲 À faire |
| Dashboard GM | 🔲 À faire |

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