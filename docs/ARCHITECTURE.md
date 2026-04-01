# ARCHITECTURE — Décisions techniques et justifications
> Dernière mise à jour : 2026-03-31 Session 3

## Principes généraux
- Une décision prise = documentée ici
- Toute décision non documentée est considérée comme nulle
- Stabilité > vitesse d'itération

---

## Structure : Monorepo
**Décision :** un seul dépôt Git contenant `client/`, `server/`, `shared/`.
**Pourquoi :** simplifie le partage de code (events.js), cohérence des versions,
déploiement unique sur Raspberry Pi.
**Alternative écartée :** trois dépôts séparés — trop de complexité pour un projet privé 4-8 joueurs.

---

## `.env` unique à la racine
**Décision :** un seul fichier `.env` à la racine du monorepo.
**Pourquoi :** évite la duplication de configuration entre client et serveur. Source de vérité unique.
**Impact serveur :** `dotenv.config({ path: '../.env' })`.
**Impact client :** `vite.config.js` configuré avec `envDir` pointant vers la racine.
Variables Vite préfixées `VITE_` (ex: `VITE_API_URL`), accessibles via `import.meta.env`.
**Non négociable :** pas de `client/.env` séparé.

---

## ES Modules dans server/
**Décision :** `"type": "module"` dans `server/package.json`. Syntaxe `import/export` partout.
**Exception :** `knexfile.cjs` reste en CommonJS — la CLI Knex ne supporte pas les ES Modules.
**Commande Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`

---

## Base de données : PostgreSQL 16
**Décision :** PostgreSQL via Docker, géré par Knex.
**Pourquoi :** robuste, supporte JSONB (voxel_data, viewport_state, résultats dés),
compatible ARM64 pour Raspberry Pi.

---

## Ports
| Service | Port |
|---|---|
| Client React (Vite) | 5173 |
| Serveur Express | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

---

## Auth : JWT en cookie httpOnly
**Décision :** JWT stocké dans un cookie httpOnly, pas dans localStorage.
**Pourquoi :** protège contre les attaques XSS.
**Non négociable.**

---

## Calcul des dés : serveur uniquement
**Décision :** les résultats des dés sont toujours calculés côté serveur.
Le client reçoit un `seed` pour reproduire la même animation.
**Non négociable.**

---

## Sécurité des mots de passe
**Décision :** bcrypt, saltRounds = 12, minimum 8 caractères.
Pas de contraintes de complexité — contre-productif en pratique.

---

## Avatars
Générés automatiquement basés sur le nom d'utilisateur. Pas d'upload en Phase 1.
**Prévu Phase 3 :** option upload image via MinIO.

---

## Rôles dans une campagne
Un seul rôle par utilisateur par campagne (GM ou player).
Plusieurs GMs possibles sur une même campagne.
**Vue joueur pour le GM :** toggle côté interface en Phase 3 —
le GM reste GM en base, l'interface simule la vue joueur.

---

## Statuts d'une campagne
`draft` / `active` (défaut) / `completed` / `archived`
Validés côté serveur dans les routes PUT /campaigns/:id.

---

## Organisation MinIO
Un seul bucket `enclume-assets` avec sous-dossiers :
- `campaigns/` — illustrations de campagne
- `battlemaps/` — images de fond des cartes (optionnel en 3D)
- `tokens/` — fichiers .glb des tokens
- `textures/` — packs de textures voxel (voir section dédiée)
- `documents/` — PDF et fichiers partagés (Phase 3)
- `audio/` — sons critiques, ambiance (Phase 3)

Le bucket reste en mode **PRIVATE**. Le serveur Express proxifie tous les accès
— le client ne touche jamais MinIO directement.

---

## Système de textures voxel — packs
**Décision :** textures organisées en packs thématiques dans MinIO.
**Structure :** `textures/<pack-name>/manifest.json` + PNGs dans sous-dossiers libres.
**Format manifest.json :**
```json
{
  "name": "hard-sf",
  "label": "Hard SF",
  "tileSize": 128,
  "materials": [
    { "id": 1, "name": "...", "label": "...", "top": "floor/xxx.png", "side": "floor/xxx.png" }
  ]
}
```
- `id` : entier stocké dans `voxel_data` en base — compact et stable
- `top` / `side` : chemins relatifs dans le pack
- `tileSize` : résolution des textures (128×128px actuellement)
- Le code charge le premier pack disponible par défaut
- Route proxy : `GET /api/textures/:pack/*filePath` — pas de CORS possible

---

## Moteur de rendu : Three.js / R3F
**Décision :** Three.js via @react-three/fiber (R3F) v9 + @react-three/drei v10.
Konva.js abandonné définitivement — jamais installé dans le projet.
**Pourquoi :** démo technique voxel 3D validée — le projet est orienté SF,
la 3D résout nativement altitude, portée et ligne de vue.
**Non négociable.**

---

## Système de carte : Voxel 3D
**Décision :** les cartes sont des données voxel stockées en JSONB.
**Format :** tableau d'objets `{ x, y, z, mat }` — mat = id matière du pack actif.
**Stockage :** champ `voxel_data` JSONB sur la table `battlemaps`.
**Taille max :** grille 50×50, hauteur max 8 niveaux.
Au-delà de ~3000 cubes visibles, optimisation nécessaire (faces visibles uniquement).

---

## Séparation routes battlemaps
`PUT /battlemaps/:id` — métadonnées + image optionnelle (avec multer).
`PUT /battlemaps/:id/voxels` — voxel_data JSON pur (sans multer).
**Pourquoi :** une route = une responsabilité. Multer et JSON pur sont incompatibles.

---

## Coordonnées des tokens
Les tokens ont des coordonnées `(x, y, z)` dans l'espace 3D.
Champ `pos_z FLOAT` sur la table `tokens` (migration 12).

---

## Calques — flag de visibilité
Le calque n'est pas un calque de rendu — c'est un flag :
- `token` : visible par tous
- `gm` : invisible aux joueurs (embuscades, PNJ non révélés)
- `background` : éléments de décor non interactifs
Le GM bascule les tokens entre calques à tout moment.

---

## Tokens — définition élargie
Un token = tout élément placé sur la carte : PJ, PNJ, monstre, décor interactif.
Pas de distinction de type en base — le GM organise via label et calque.

## Tokens 3D — spécifications
**Format :** `.glb` uniquement (tout-en-un).
**Boîte englobante :** 1×1×2 unités (1 case largeur, 2 cases hauteur).
**Origine :** centre de la base (les pieds).
**Polygones :** maximum 2 000 triangles.
**Matériaux :** PBR standard Metallic/Roughness.
**Texture :** atlas unique, 512×512px ou 1024×1024px max.
**Animations (optionnelles) :** `idle` / `move` / `attack`.
**Fallback :** sphère colorée avec label si pas de .glb assigné.

---

## Modes GM pendant la session
Pas de séparation éditeur/session — une toolbar qui switche entre modes :
- **Mode jeu** : déplacement tokens, dés, chat
- **Mode édition** : pose/suppression voxels, déplacement décor
Les modifications voxel sont broadcastées via Socket.io en temps réel.

---

## Éditeur voxel
Clic gauche : pose un voxel de la matière active.
Clic droit : efface le voxel ciblé.
Raycasting sur le plan de sol Y=0 et sur les voxels existants.
Pose sur face d'un voxel : position = voxel + normale de la face.
Sauvegarde automatique toutes les 60s si dirty + à la fermeture de l'éditeur.

---

## Murs invisibles
Table `walls` conservée — murs logiques invisibles (vitres, fenêtres, cloisons).
Bloquent la ligne de vue sans être des voxels visibles.

---

## Zones
Table `zones` conservée pour Phase 3 (effets de sorts, zones de danger, Polaris).
L'altitude Z gère nativement avantage/désavantage — pas de zones dédiées à ça.

---

## Matière eau
Faisable avec Three.js : plan animé, shader de distorsion, transparence.
Pertinent pour Polaris (JDR sous-marin).
Un voxel de type "eau" affiche ce matériau animé au lieu d'un cube solide.
**Prévu Phase 3.**

---

## X-Ray (occlusion)
Quand un voxel se trouve entre la caméra et un token,
il est rendu transparent automatiquement.
Implémentation : raycasting caméra → token, transparence sur les hits.

---

## Viewport — comportement
- Par défaut : chaque joueur navigue librement
- "Snap GM" : le viewport du joueur suit celui du GM (persistant)
- "Verrouiller vue" : le GM bloque tous les joueurs sur sa position

---

## Outil règle/mesure
Distance euclidienne 3D entre deux points.
Affichage en cases × `scale_label` de la carte.

---

## Dés — système
Tous les dés : D4, D6, D8, D10, D12, D20, D100.
Calcul toujours côté serveur (non négociable).
Critiques configurables par campagne, par dé (seuil haut / seuil bas).

---

## Battlemaps — organisation
- Organisation en dossiers par campagne (ex: Ville/, Donjon/)
- Chaque battlemap a ses propres paramètres de grille
- Une battlemap créée automatiquement à la création de campagne
- Le GM peut basculer chaque joueur vers n'importe quelle battlemap

---

## Dessin libre — abandonné
Hors scope définitivement.

# ARCHITECTURE — Décisions techniques et justifications
> Dernière mise à jour : 2026-03-31 Session 4

## Principes généraux
- Une décision prise = documentée ici
- Toute décision non documentée est considérée comme nulle
- Stabilité > vitesse d'itération

---

## Structure : Monorepo
**Décision :** un seul dépôt Git contenant `client/`, `server/`, `shared/`.
**Pourquoi :** simplifie le partage de code (events.js), cohérence des versions,
déploiement unique sur Raspberry Pi.
**Alternative écartée :** trois dépôts séparés — trop de complexité pour un projet privé 4-8 joueurs.

---

## `.env` unique à la racine
**Décision :** un seul fichier `.env` à la racine du monorepo.
**Pourquoi :** évite la duplication de configuration entre client et serveur. Source de vérité unique.
**Impact serveur :** `dotenv.config({ path: '../.env' })`.
**Impact client :** `vite.config.js` configuré avec `envDir` pointant vers la racine.
Variables Vite préfixées `VITE_` (ex: `VITE_API_URL`), accessibles via `import.meta.env`.
**Non négociable :** pas de `client/.env` séparé.

---

## ES Modules dans server/
**Décision :** `"type": "module"` dans `server/package.json`. Syntaxe `import/export` partout.
**Exception :** `knexfile.cjs` reste en CommonJS — la CLI Knex ne supporte pas les ES Modules.
**Commande Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`

---

## Base de données : PostgreSQL 16
**Décision :** PostgreSQL via Docker, géré par Knex.
**Pourquoi :** robuste, supporte JSONB (voxel_data, viewport_state, résultats dés),
compatible ARM64 pour Raspberry Pi.

---

## Clés primaires et étrangères : UUID
**Décision :** toutes les PK et FK utilisent `uuid`. Jamais `increments()`.
**Pourquoi :** cohérence avec les tables existantes. PostgreSQL refuse les FK si les types
ne correspondent pas. `increments()` produit un `bigint`, incompatible avec `uuid`.
**Pattern PK :** `table.uuid('id').primary().defaultTo(knex.fn.uuid())`
**Pattern FK :** `table.uuid('xxx_id').references('id').inTable('yyy')`
**Non négociable.**

---

## Ports
| Service | Port |
|---|---|
| Client React (Vite) | 5173 |
| Serveur Express | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

---

## Auth : JWT en cookie httpOnly
**Décision :** JWT stocké dans un cookie httpOnly, pas dans localStorage.
**Pourquoi :** protège contre les attaques XSS.
**Non négociable.**

---

## Calcul des dés : serveur uniquement
**Décision :** les résultats des dés sont toujours calculés côté serveur.
Le client reçoit un `seed` pour reproduire la même animation.
**Non négociable.**

---

## Sécurité des mots de passe
**Décision :** bcrypt, saltRounds = 12, minimum 8 caractères.
Pas de contraintes de complexité — contre-productif en pratique.

---

## Avatars
Générés automatiquement basés sur le nom d'utilisateur. Pas d'upload en Phase 1.
**Prévu Phase 3 :** option upload image via MinIO.

---

## Couleur utilisateur
**Décision :** chaque utilisateur a une couleur hex assignée aléatoirement à l'inscription
(parmi une palette de 12 teintes distinctes et lisibles sur fond sombre).
Stockée dans `users.color`. Modifiable par l'utilisateur dans ses paramètres (Phase 3).
**Usage :** halo de sélection et label des tokens PJ. Les tokens GM sont visuellement neutres
(pas de couleur spécifique), mais le champ est présent pour tous les profils par cohérence.

---

## Rôles dans une campagne
Un seul rôle par utilisateur par campagne (GM ou player).
Plusieurs GMs possibles sur une même campagne.
**Vue joueur pour le GM :** toggle côté interface en Phase 3 —
le GM reste GM en base, l'interface simule la vue joueur.

---

## Statuts d'une campagne
`draft` / `active` (défaut) / `completed` / `archived`
Validés côté serveur dans les routes PUT /campaigns/:id.

---

## Organisation MinIO
Un seul bucket `enclume-assets` avec sous-dossiers :
- `campaigns/` — illustrations de campagne
- `battlemaps/` — images de fond des cartes (optionnel en 3D)
- `tokens/` — fichiers .glb des tokens (dont `default.glb` — modèle générique)
- `textures/` — packs de textures voxel (voir section dédiée)
- `documents/` — PDF et fichiers partagés (Phase 3)
- `audio/` — sons critiques, ambiance (Phase 3)

Le bucket reste en mode **PRIVATE**. Le serveur Express proxifie tous les accès
— le client ne touche jamais MinIO directement.
**Pourquoi PRIVATE :** MinIO ne connaît pas les utilisateurs d'Enclume. Passer par Express
permet de vérifier les JWT et les droits selon le contexte (ex: tokens calque GM invisibles
aux joueurs). Performant sur réseau local, pas de surcoût significatif pour 4-8 joueurs.

---

## Route proxy assets — générale
**Décision :** `GET /api/assets/:folder/*filePath` — route générale qui proxyfie
n'importe quel sous-dossier de MinIO vers le client.
**Pourquoi générale et non ciblée :** extensible sans nouvelle route à chaque nouveau
type d'asset. Remplace avantageusement une multiplication de routes `/api/tokens/`,
`/api/campaigns/images/`, etc.
**Auth requise :** oui — vérification JWT. Les assets MinIO ne sont pas publics.
**Cache-Control :** `public, max-age=3600` sur les fichiers statiques (PNG, GLB).
**Note :** la route `/api/textures` existante reste en place pour compatibilité —
elle sera dépréciée en faveur de `/api/assets/textures/` quand Canvas3D sera mis à jour.

---

## Uploads par les joueurs
**Décision :** les joueurs uploaderront leurs assets (portrait 2D, token .glb) via Express,
pas directement vers MinIO.
**Pattern :** `POST /api/characters/:id/upload` — Express valide, uploade dans MinIO,
met à jour `portrait_url` ou `glb_url` en base.
**Limites de taille :** à définir par type de fichier (plus restrictif que les 20Mo actuels
pour les .glb low-poly). À implémenter lors du développement de l'upload joueur.

---

## Système de textures voxel — packs
**Décision :** textures organisées en packs thématiques dans MinIO.
**Structure :** `textures/<pack-name>/manifest.json` + PNGs dans sous-dossiers libres.
**Format manifest.json :**
```json
{
  "name": "hard-sf",
  "label": "Hard SF",
  "tileSize": 128,
  "materials": [
    { "id": 1, "name": "...", "label": "...", "top": "floor/xxx.png", "side": "floor/xxx.png" }
  ]
}
```
- `id` : entier stocké dans `voxel_data` en base — compact et stable
- `top` / `side` : chemins relatifs dans le pack
- `tileSize` : résolution des textures (128×128px actuellement)
- Le code charge le premier pack disponible par défaut
- Route proxy : `GET /api/textures/:pack/*filePath` — pas de CORS possible

---

## Moteur de rendu : Three.js / R3F
**Décision :** Three.js via @react-three/fiber (R3F) v9 + @react-three/drei v10.
Konva.js abandonné définitivement — jamais installé dans le projet.
**Pourquoi :** démo technique voxel 3D validée — le projet est orienté SF,
la 3D résout nativement altitude, portée et ligne de vue.
**Non négociable.**

---

## Système de carte : Voxel 3D
**Décision :** les cartes sont des données voxel stockées en JSONB.
**Format :** tableau d'objets `{ x, y, z, mat }` — mat = id matière du pack actif.
**Stockage :** champ `voxel_data` JSONB sur la table `battlemaps`.
**Taille max :** grille 50×50, hauteur max 8 niveaux.
Au-delà de ~3000 cubes visibles, optimisation nécessaire (faces visibles uniquement).

---

## Séparation routes battlemaps
`PUT /battlemaps/:id` — métadonnées + image optionnelle (avec multer).
`PUT /battlemaps/:id/voxels` — voxel_data JSON pur (sans multer).
**Pourquoi :** une route = une responsabilité. Multer et JSON pur sont incompatibles.

---

## Coordonnées des tokens
Les tokens ont des coordonnées `(x, y, z)` dans l'espace 3D.
Champ `pos_z FLOAT` sur la table `tokens` (migration 12).

---

## Calques — flag de visibilité
Le calque n'est pas un calque de rendu — c'est un flag :
- `token` : visible par tous
- `gm` : invisible aux joueurs (embuscades, PNJ non révélés)
- `background` : éléments de décor non interactifs
Le GM bascule les tokens entre calques à tout moment.

---

## Tokens — définition élargie
Un token = tout élément placé sur la carte : PJ, PNJ, monstre, décor interactif.
Pas de distinction de type en base — le GM organise via label et calque.

---

## Tokens 3D — spécifications
**Format :** `.glb` uniquement (tout-en-un, textures embarquées).
**Boîte englobante :** 1×1×2 unités (1 case largeur, 2 cases hauteur).
**Origine :** centre de la base (les pieds).
**Polygones :** maximum 2 000 triangles.
**Matériaux :** PBR standard Metallic/Roughness.
**Texture :** atlas unique, 512×512px ou 1024×1024px max.
**Animations :** aucune — décision définitive. Pas d'idle/move/attack.
**Fallback :** cascade dégressive —
  1. `.glb` spécifique du character (`glb_url`)
  2. Illustration 2D du character (`portrait_url`) — billboard sprite
  3. Modèle générique Enclume (`tokens/default.glb` dans MinIO)

---

## Tokens 3D — instances multiples
**Décision :** utiliser le composant `<Clone>` de drei pour afficher plusieurs tokens
avec le même modèle `.glb`.
**Pourquoi :** `useGLTF` charge le modèle une seule fois en mémoire GPU.
`Clone` crée des références légères au même objet 3D — pas de rechargement,
pas de duplication mémoire. Suffisant pour 4-8 joueurs, pas besoin d'instancing.
**Pattern :**
```jsx
const { scene } = useGLTF(url)
// Pour chaque token :
<Clone object={scene} position={[x, y, z]} />
```

---

## Police 3D pour les labels de tokens
**Décision :** police Inter locale dans `client/public/fonts/inter.woff`.
Copiée depuis `node_modules/@fontsource/inter/files/` — déjà installé dans le projet.
**Pourquoi locale :** `Text` de drei charge Roboto depuis Google Fonts CDN par défaut.
Une police locale garantit le fonctionnement hors ligne et évite toute latence réseau.
**Usage :** `<Text font="/fonts/inter.woff" ... />`

---

## Modes GM pendant la session
Pas de séparation éditeur/session — une toolbar qui switche entre modes :
- **Mode jeu** : déplacement tokens, dés, chat
- **Mode édition** : pose/suppression voxels, déplacement décor
Les modifications voxel sont broadcastées via Socket.io en temps réel.

---

## Éditeur voxel
Clic gauche : pose un voxel de la matière active.
Clic droit : efface le voxel ciblé.
Raycasting sur le plan de sol Y=0 et sur les voxels existants.
Pose sur face d'un voxel : position = voxel + normale de la face.
Sauvegarde automatique toutes les 60s si dirty + à la fermeture de l'éditeur.

---

## Murs invisibles
Table `walls` conservée — murs logiques invisibles (vitres, fenêtres, cloisons).
Bloquent la ligne de vue sans être des voxels visibles.

---

## Zones
Table `zones` conservée pour Phase 3 (effets de sorts, zones de danger, Polaris).
L'altitude Z gère nativement avantage/désavantage — pas de zones dédiées à ça.

---

## Matière eau
Faisable avec Three.js : plan animé, shader de distorsion, transparence.
Pertinent pour Polaris (JDR sous-marin).
Un voxel de type "eau" affiche ce matériau animé au lieu d'un cube solide.
**Prévu Phase 3.**

---

## X-Ray (occlusion)
Quand un voxel se trouve entre la caméra et un token,
il est rendu transparent automatiquement.
Implémentation : raycasting caméra → token, transparence sur les hits.

---

## Viewport — comportement
- Par défaut : chaque joueur navigue librement
- "Snap GM" : le viewport du joueur suit celui du GM (persistant)
- "Verrouiller vue" : le GM bloque tous les joueurs sur sa position

---

## Outil règle/mesure
Distance euclidienne 3D entre deux points.
Affichage en cases × `scale_label` de la carte.

---

## Dés — système
Tous les dés : D4, D6, D8, D10, D12, D20, D100.
Calcul toujours côté serveur (non négociable).
Critiques configurables par campagne, par dé (seuil haut / seuil bas).

---

## Battlemaps — organisation
- Organisation en dossiers par campagne (ex: Ville/, Donjon/)
- Chaque battlemap a ses propres paramètres de grille
- Une battlemap créée automatiquement à la création de campagne
- Le GM peut basculer chaque joueur vers n'importe quelle battlemap

---

## Dessin libre — abandonné
Hors scope définitivement.