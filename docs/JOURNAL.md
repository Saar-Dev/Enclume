# JOURNAL — Projet Enclume

## Session 1 — 2026-03-29

### État du projet en fin de session
- Structure monorepo créée : `client/`, `server/`, `shared/`, `docs/`
- Git initialisé (pas de remote, pas de GitHub)
- Docker opérationnel : PostgreSQL 16, Redis 7, MinIO
- Serveur Express + Socket.io minimal opérationnel sur port 3001
- Route de santé `/api/health` répond correctement
- 6 migrations Knex exécutées, toutes les tables créées en base
- `.env` à la racine, lu via `{ path: '../.env' }` dans server/

### Décisions prises
- Nom du projet : **Enclume**
- `.env` unique à la racine du monorepo (pas dans server/)
- `knexfile.cjs` en CommonJS (compatibilité CLI Knex)
- `server/src/index.js` en ES Modules (`import/export`)
- Port serveur : 3001 / Port client (futur) : 3000

### Points de vigilance
- Docker doit être lancé avant toute commande knex ou serveur
- Commandes Knex sur Windows : `node_modules\.bin\knex.cmd` et non `knex`
- Nodemon tourne dans le terminal 1 — toujours ouvrir un terminal 2 pour les autres commandes

### Questions ouvertes
- Pas de GitHub pour l'instant — risque de perte si problème machine
- Pas de Raspberry Pi pour l'instant

### Prochaines étapes (Phase 0 — reste à faire)
- Connecter `db` au serveur Express avec vérification au démarrage
- Initialiser le client React avec Vite

### Décisions prises (ajout)
- Remote GitHub configuré : https://github.com/Saar-Dev/Enclume.git
- Branche principale : master
- Commande push : `git push origin master`