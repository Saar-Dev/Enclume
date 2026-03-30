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
## Organisation MinIO (buckets)
**Décision :** un seul bucket `enclume-assets` avec sous-dossiers :
- `campaigns/` — illustrations de campagne
- `battlemaps/` — images de fond des cartes
- `tokens/` — images des tokens
- `documents/` — PDF et fichiers partagés (Phase 3)
- `audio/` — sons critiques, ambiance (Phase 3)

## Tokens — définition élargie
Un token = tout élément placé sur la carte : PJ, PNJ, monstre,
élément de décor (baril, ordinateur, etc). Pas de distinction de type
en base — c'est le GM qui organise via label et calque.
Image par défaut générique unique — fournie par le GM du projet.

## Calques (layers)
Trois calques par battlemap, dans l'ordre d'affichage :
1. `background` — image de fond + éléments de décor fixes
2. `gm` — invisible pour les joueurs, dessins libres, notes visuelles
3. `token` — PJ, PNJ, éléments interactifs (toujours au dessus)
Z-index gérable au sein de chaque calque.

## Zones de niveau
Trois niveaux de zone dessinables par le GM :
- `advantage` — niveau supérieur / étage +1
- `neutral` — niveau du sol (défaut)
- `disadvantage` — niveau inférieur / étage -1
Implémentation : polygones Konva.js avec opacité, sur le calque GM.
Basé sur le système Polaris (avantage/désavantage).

## Murs et couvertures
- Murs : segments tracés par le GM, bloquent les lignes de vue (V2 raycast)
- Couverture : champ `cover_percent` sur les tokens (0-100%)
- Dessins libres sur le calque GM (murets, poteaux, etc)

## Battlemaps — organisation
- Organisation en dossiers par campagne (ex: Ville/, Donjon/)
- Chaque battlemap a ses propres paramètres de grille
- Une battlemap vide créée automatiquement à la création de campagne
  (point de départ — le GM la renomme et décore comme il veut)
- Le GM peut basculer chaque joueur vers n'importe quelle battlemap,
  individuellement ou en groupe (cases à cocher + "Envoyer vers...")

## Viewport — comportement
- Par défaut : chaque joueur navigue librement
- "Snap GM" : le viewport du joueur suit celui du GM (persistant jusqu'à annulation)
- "Verrouiller vue" : le GM bloque tous les joueurs sur sa position

## Dés — système
- Tous les dés disponibles : D4, D6, D8, D10, D12, D20, D100
- Calcul toujours côté serveur (non négociable)
- Critiques configurables par campagne, par dé, optionnel :
  - Seuil haut = réussite critique (animation + son court)
  - Seuil bas = échec critique (animation + son court)

## Toolbar GM (session active)
Outils disponibles en V1 :
1. Sélection / déplacement
2. Dessin de mur
3. Dessin de zone (Avantage/Neutre/Désavantage)
4. Règle / mesure (en cases × échelle de la carte)
5. Paramètres de la carte

## Échelle par carte
Chaque battlemap a un champ `scale_label` (ex: "1,5m" ou "5ft").
Utilisé par l'outil règle pour convertir cases → unité réelle.
Taille de case par défaut : 64px.
Le GM peut modifier la grille à la volée en cours de session.

## Schéma DB — modifications Phase 2
Par rapport aux migrations Phase 0, les ajouts suivants sont nécessaires :

**`campaigns`** — nouveaux champs :
- `cover_image_url TEXT` — illustration de la campagne
- `critical_success JSONB` — seuils par dé (optionnel)
- `critical_fail JSONB` — seuils par dé (optionnel)

**`battlemaps`** — nouveaux champs :
- `folder TEXT` — organisation en dossiers
- `scale_label TEXT` — ex: "1,5m" (défaut null)
- `grid_opacity FLOAT` — opacité de la grille (0-1, défaut 0.5)
- `grid_size INT` — déjà présent, défaut passe à 64px

**`tokens`** — nouveaux champs :
- `layer TEXT` — 'background' | 'gm' | 'token' (défaut 'token')
- `cover_percent INT` — 0 à 100 (défaut 0)
- `notes TEXT` — notes visibles par le propriétaire
- `gm_notes TEXT` — notes visibles GM uniquement

**Nouvelles tables :**
- `walls` — segments de murs (battlemap_id, x1, y1, x2, y2)
- `zones` — zones de niveau (battlemap_id, level, points JSONB)
- `player_locations` — quelle battlemap chaque joueur voit
  (campaign_id, user_id, battlemap_id)