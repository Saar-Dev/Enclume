# ARCHITECTURE — Décisions techniques et justifications

## Principes généraux
- Une décision prise = documentée ici
- Toute décision non documentée est considérée comme nulle
- Stabilité > vitesse d'itération

---

## Structure : Monorepo
**Décision :** un seul dépôt Git contenant `client/`, `server/`, `shared/`.
**Pourquoi :** simplifie le partage de code (events.js), cohérence des
versions, déploiement unique sur Raspberry Pi.
**Alternative écartée :** trois dépôts séparés — trop de complexité
pour un projet privé 4-8 joueurs.

---

## `.env` unique à la racine
**Décision :** un seul fichier `.env` à la racine du monorepo.
**Pourquoi :** évite la duplication de configuration entre client et
serveur. Source de vérité unique.
**Impact :** tous les fichiers qui lisent le `.env` doivent spécifier
le chemin explicitement : `dotenv.config({ path: '../.env' })`.

---

## ES Modules dans server/
**Décision :** `"type": "module"` dans `server/package.json`.
Syntaxe `import/export` partout dans `server/src/`.
**Pourquoi :** syntaxe moderne, cohérence avec le client React qui
utilise aussi les ES Modules.
**Exception :** `knexfile.cjs` reste en CommonJS — la CLI Knex ne
supporte pas les ES Modules nativement.

---

## Knexfile en CommonJS
**Décision :** `knexfile.cjs` (extension `.cjs`, syntaxe `require/module.exports`).
**Pourquoi :** la CLI Knex (`knex migrate:latest`) ne supporte pas
les ES Modules. Le reste du serveur reste en ES Modules.
**Commande Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`

---

## Base de données : PostgreSQL 16
**Décision :** PostgreSQL via Docker, géré par Knex.
**Pourquoi :** robuste, supporte JSONB (utile pour viewport_state,
results des dés, sheet_data), compatible ARM64 pour Raspberry Pi.

---

## Ports
| Service | Port | Raison |
|---|---|---|
| Client React | 3000 | Convention Vite |
| Serveur Express | 3001 | Convention, évite conflit avec client |
| PostgreSQL | 5432 | Port officiel |
| Redis | 6379 | Port officiel |
| MinIO API | 9000 | Port officiel |
| MinIO Console | 9001 | Port officiel |

---

## Auth : JWT en cookie httpOnly
**Décision :** JWT stocké dans un cookie httpOnly, pas dans localStorage.
**Pourquoi :** sécurité — un cookie httpOnly n'est pas accessible
depuis JavaScript, ce qui protège contre les attaques XSS.
**Non négociable** (défini dans PROJET.md section 8).

---

## Calcul des dés : serveur uniquement
**Décision :** les résultats des dés sont toujours calculés côté serveur.
**Pourquoi :** empêche la triche. Le client reçoit un `seed` pour
reproduire la même animation, mais ne calcule jamais le résultat.
**Non négociable** (défini dans PROJET.md section 8).

## Sécurité des mots de passe
**Décision :** bcrypt, saltRounds = 12, minimum 8 caractères.
**Pourquoi :** robuste sans être trop lent. Pas de contraintes
de complexité — contre-productif en pratique.

## Avatars
**Décision :** avatars générés automatiquement basés sur le
nom d'utilisateur. Pas d'upload en Phase 1.
**Prévu Phase 3 :** option upload image via MinIO.

## Rôles dans une campagne
**Décision :** un seul rôle par utilisateur par campagne (GM ou player).
**Plusieurs GMs** possibles sur une même campagne.
**Vue joueur pour le GM :** toggle côté interface en Phase 3 —
le GM reste GM en base, l'interface simule la vue joueur.

## Statuts d'une campagne
- `draft` — brouillon
- `active` — en cours (défaut à la création)
- `completed` — terminée
- `archived` — archivée
Validés côté serveur dans les routes PUT /campaigns/:id.