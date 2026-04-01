# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-03-31 Session 3

---

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

## Phase 0 — Socle technique ✅

| Tâche | État |
|---|---|
| Structure monorepo (client, server, shared, docs) | ✅ |
| Git + remote GitHub | ✅ |
| Docker : PostgreSQL + Redis + MinIO | ✅ |
| Serveur Express + Socket.io minimal | ✅ |
| Route /api/health | ✅ |
| Migrations Knex (6 tables de base) | ✅ |
| Connexion DB vérifiée au démarrage | ✅ |
| shared/events.js | ✅ |
| Client React initialisé (Vite) | ✅ |

---

## Phase 1 — Auth + campagnes ✅

| Tâche | État |
|---|---|
| Middleware requireAuth (JWT) | ✅ |
| Middleware requireRole | ✅ |
| Gestion d'erreurs centralisée (AppError + errorHandler) | ✅ |
| POST /auth/register | ✅ |
| POST /auth/login | ✅ |
| POST /auth/logout | ✅ |
| GET /auth/me | ✅ |
| CRUD campagnes + invite_code | ✅ |
| Rejoindre via invite_code | ✅ |
| Dashboard GM (pages React) | ✅ |

---

## Phase 2 — Battlemap 3D + dés 🔲

### Serveur — infrastructure ✅
| Tâche | État |
|---|---|
| Migrations Phase 2 (13 au total) | ✅ |
| MinIO configuré (bucket + middleware upload) | ✅ |
| Routes battlemaps (CRUD + upload image) | ✅ |
| Route PUT /battlemaps/:id/voxels (sauvegarde voxel_data) | ✅ |
| Routes tokens (CRUD + upload .glb) | ✅ |
| Route /api/textures (proxy packs depuis MinIO) | ✅ |
| Script start.ps1 | ✅ |

### Serveur — temps réel ✅
| Tâche | État |
|---|---|
| Socket.io — authentification WebSocket (JWT) | ✅ |
| Socket.io — session:join / session:joined | ✅ |
| Socket.io — token:move / token:moved | ✅ |
| Socket.io — voxel:add / voxel:remove | ✅ |
| Socket.io — map:switch | ✅ |
| Socket.io — map:viewport (Snap GM, verrouillage) | ✅ |
| Socket.io — chat:message | ✅ |
| Socket.io — dice:roll / dice:result | 🔲 TODO |
| Routes dés (calcul serveur + seed) | 🔲 |

### Client — Page Session 🔲
| Tâche | État |
|---|---|
| Layout page Session (canvas + sidebar) | ✅ |
| Intégration Three.js / R3F dans React | ✅ |
| Système de packs de textures voxel | ✅ |
| Éditeur voxel 3D (mode édition GM) | ✅ |
| Palette de matières dans Sidebar | ✅ |
| Sauvegarde voxel auto + à la fermeture | ✅ |
| Tokens 3D — fallback sphère + label | 🔲 |
| Tokens 3D — chargement .glb | 🔲 |
| Tokens — placement par le GM | 🔲 |
| Tokens — drag & drop 3D | 🔲 |
| Tokens — synchronisation Socket.io | 🔲 |
| Calque GM — visibilité (visible/caché) | 🔲 |
| X-Ray — transparence blocs devant tokens | 🔲 |
| Viewport — Snap GM + Verrouiller | 🔲 |
| Déplacement joueurs entre battlemaps | 🔲 |
| Barre GM supérieure (battlemaps + affectation joueurs) | 🔲 |
| Menu contextuel clic droit canvas | 🔲 |
| Outil règle/mesure 3D (distance euclidienne) | 🔲 |
| Murs invisibles (tracé + stockage) | 🔲 |
| Matière eau (shader animé) | 🔲 Phase 3 |

### Client — Sidebar 🔲
| Tâche | État |
|---|---|
| Chat branché sur Socket.io | 🔲 |
| Onglet Joueurs — liste + statut en ligne | 🔲 |
| Onglet Dés — grille NdX + jet avancé | 🔲 |
| Dés — animation client (seed partagé) | 🔲 |
| Dés — critiques (animation + son) | 🔲 |
| Log partagé des jets | 🔲 |

---

## Phase 3 — Bibliothèque + polish 🔲

| Tâche | État |
|---|---|
| Upload documents vers MinIO | 🔲 |
| Bibliothèque avec gestion visibilité | 🔲 |
| Point intégration fiches perso (API REST) | 🔲 |
| Reconnexion WebSocket automatique | 🔲 |
| Persistance viewport | 🔲 |
| Avatars utilisateur (upload MinIO) | 🔲 |
| Vue joueur pour le GM (toggle) | 🔲 |
| Table zones — usage à définir (effets, Polaris) | 🔲 |
| Optimisation voxel (> 3000 cubes) | 🔲 |
| Matière eau (shader animé) | 🔲 |
| Upload/gestion packs de textures via interface | 🔲 |

---

## Hors scope V1 (prévu V2+)

- Fog of war / raycast
- Webcam / audio / vidéo
- Fiches de personnage intégrées (module externe)
- Destruction de décor par action joueur
- Formes voxel non-cubiques (slope, escalier) — pertinence à réévaluer

# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-03-31 Session 4

---

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

## Phase 0 — Socle technique ✅

| Tâche | État |
|---|---|
| Structure monorepo (client, server, shared, docs) | ✅ |
| Git + remote GitHub | ✅ |
| Docker : PostgreSQL + Redis + MinIO | ✅ |
| Serveur Express + Socket.io minimal | ✅ |
| Route /api/health | ✅ |
| Migrations Knex (6 tables de base) | ✅ |
| Connexion DB vérifiée au démarrage | ✅ |
| shared/events.js | ✅ |
| Client React initialisé (Vite) | ✅ |

---

## Phase 1 — Auth + campagnes ✅

| Tâche | État |
|---|---|
| Middleware requireAuth (JWT) | ✅ |
| Middleware requireRole | ✅ |
| Gestion d'erreurs centralisée (AppError + errorHandler) | ✅ |
| POST /auth/register | ✅ |
| POST /auth/login | ✅ |
| POST /auth/logout | ✅ |
| GET /auth/me | ✅ |
| CRUD campagnes + invite_code | ✅ |
| Rejoindre via invite_code | ✅ |
| Dashboard GM (pages React) | ✅ |

---

## Phase 2 — Battlemap 3D + dés 🔲

### Serveur — infrastructure ✅
| Tâche | État |
|---|---|
| Migrations Phase 2 (13 au total) | ✅ |
| Migrations Phase 4 (14 couleur users, 15 characters, 16 character_id tokens) | ✅ |
| MinIO configuré (bucket + middleware upload) | ✅ |
| Routes battlemaps (CRUD + upload image) | ✅ |
| Route PUT /battlemaps/:id/voxels (sauvegarde voxel_data) | ✅ |
| Routes tokens (CRUD — JSON pur, upload Phase suivante) | ✅ |
| Routes characters (CRUD) | ✅ |
| Route /api/textures (proxy packs depuis MinIO) | ✅ |
| Route /api/assets/:folder/*filePath (proxy général MinIO) | ✅ |
| Script start.ps1 | ✅ |

### Serveur — temps réel ✅
| Tâche | État |
|---|---|
| Socket.io — authentification WebSocket (JWT) | ✅ |
| Socket.io — session:join / session:joined | ✅ |
| Socket.io — token:move / token:moved | ✅ |
| Socket.io — voxel:add / voxel:remove | ✅ |
| Socket.io — map:switch | ✅ |
| Socket.io — map:viewport (Snap GM, verrouillage) | ✅ |
| Socket.io — chat:message | ✅ |
| Socket.io — dice:roll / dice:result | 🔲 TODO |
| Routes dés (calcul serveur + seed) | 🔲 |

### Client — Page Session 🔲
| Tâche | État |
|---|---|
| Layout page Session (canvas + sidebar) | ✅ |
| Intégration Three.js / R3F dans React | ✅ |
| Système de packs de textures voxel | ✅ |
| Éditeur voxel 3D (mode édition GM) | ✅ |
| Palette de matières dans Sidebar | ✅ |
| Sauvegarde voxel auto + à la fermeture | ✅ |
| isGm calculé depuis les membres (SessionPage) | ✅ |
| Tokens — chargement depuis battlemap (SessionPage) | ✅ |
| Characters — chargement depuis campagne (SessionPage) | ✅ |
| Tokens 3D — rendu .glb + label + halo sélection | 🔲 |
| Tokens — placement par drag depuis Sidebar | 🔲 |
| Tokens — drag & drop sur la carte | 🔲 |
| Tokens — snap à la grille | 🔲 |
| Tokens — synchronisation Socket.io | 🔲 |
| Calque GM — visibilité (visible/caché) | 🔲 |
| X-Ray — transparence blocs devant tokens | 🔲 |
| Viewport — Snap GM + Verrouiller | 🔲 |
| Déplacement joueurs entre battlemaps | 🔲 |
| Barre GM supérieure (battlemaps + affectation joueurs) | 🔲 |
| Menu contextuel clic droit canvas | 🔲 |
| Outil règle/mesure 3D (distance euclidienne) | 🔲 |
| Murs invisibles (tracé + stockage) | 🔲 |
| Matière eau (shader animé) | 🔲 Phase 3 |

### Client — Sidebar 🔲
| Tâche | État |
|---|---|
| isGm branché (remplace hardcodé) | 🔲 |
| Onglet Persos — liste characters | 🔲 |
| Onglet Persos — créer personnage | 🔲 |
| Onglet Persos — drag vers canvas | 🔲 |
| Chat branché sur Socket.io | 🔲 |
| Onglet Joueurs — liste + statut en ligne | 🔲 |
| Onglet Dés — grille NdX + jet avancé | 🔲 |
| Dés — animation client (seed partagé) | 🔲 |
| Dés — critiques (animation + son) | 🔲 |
| Log partagé des jets | 🔲 |

---

## Phase 3 — Bibliothèque + polish 🔲

| Tâche | État |
|---|---|
| Scènes 2D ambiance — battlemap type 'scene' avec image plein écran | 🔲 |
| Tokens 2D sur scènes ambiance — illustration dans cercle, cliquable | 🔲 |
| Upload illustration 2D par propriétaire du character | 🔲 |
| Upload token .glb par propriétaire du character | 🔲 |
| Cascade fallback tokens (glb → portrait → default.glb) | 🔲 |
| Couleur utilisateur modifiable dans les paramètres | 🔲 |
| Upload documents vers MinIO | 🔲 |
| Bibliothèque avec gestion visibilité | 🔲 |
| Point intégration fiches perso (API REST) | 🔲 |
| Reconnexion WebSocket automatique | 🔲 |
| Persistance viewport | 🔲 |
| Avatars utilisateur (upload MinIO) | 🔲 |
| Vue joueur pour le GM (toggle) | 🔲 |
| Table zones — usage à définir (effets, Polaris) | 🔲 |
| Optimisation voxel (> 3000 cubes) | 🔲 |
| Matière eau (shader animé) | 🔲 |
| Upload/gestion packs de textures via interface | 🔲 |

---

## Hors scope V1 (prévu V2+)

- Fog of war / raycast
- Webcam / audio / vidéo
- Fiches de personnage intégrées (module externe)
- Destruction de décor par action joueur
- Formes voxel non-cubiques (slope, escalier) — pertinence à réévaluer