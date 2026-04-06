# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-04-06 Session 14

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
| Migrations Knex (19 au total) | ✅ |
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
| Dashboard — liste campagnes, créer, rejoindre | ✅ |

---

## Phase 2 — Battlemap 3D + session de jeu 🔲

### Serveur — infrastructure ✅
| Tâche | État |
|---|---|
| MinIO configuré (bucket + middleware upload) | ✅ |
| Routes battlemaps (CRUD + voxel_data) | ✅ |
| Routes tokens (CRUD JSON pur) | ✅ |
| Routes characters (CRUD + description + gm_notes) | ✅ |
| Route /api/textures (proxy packs MinIO) | ✅ |
| Route /api/assets/:folder/*filePath (proxy général MinIO) | ✅ |
| Route /api/characters standalone (PUT/:id, DELETE/:id) | ✅ |
| errorHandler amélioré (route + méthode + stack) | ✅ |
| Script start.ps1 | ✅ |
| Route PUT /api/users/me (username, email, color, password) | ✅ |

### Serveur — temps réel
| Tâche | État |
|---|---|
| Socket.io — authentification WebSocket (JWT) | ✅ |
| Socket.io — session:join / session:joined | ✅ |
| Socket.io — token:move / token:moved | ✅ |
| Socket.io — token:created / token:deleted | ✅ |
| Socket.io — character:updated | ✅ |
| Socket.io — voxel:add / voxel:remove | ✅ |
| Socket.io — map:switch | ✅ |
| Socket.io — map:viewport (Snap GM, verrouillage) | ✅ |
| Socket.io — chat:message | ✅ |
| Socket.io — dice:roll / dice:result | 🔲 |
| Routes dés (calcul serveur + seed) | 🔲 |

### Serveur — battlemaps étendues
| Tâche | État |
|---|---|
| Route POST /battlemaps/:id/duplicate — dupliquer une carte | ✅ |
| Route PUT /campaigns/:id — accepter default_battlemap_id | ✅ |
| Migration — bg_color VARCHAR sur battlemaps | ⚠️ à clarifier |
| Upload screenshot sortie éditeur → MinIO (cover_image_url) | 🔲 |

### Client — Canvas 3D
| Tâche | État |
|---|---|
| Intégration Three.js / R3F | ✅ |
| Système de packs de textures voxel | ✅ |
| Éditeur voxel 3D (mode édition GM) | ✅ |
| Sauvegarde voxel auto + à la fermeture | ✅ |
| Alignement voxel/grille (+0.5 visuel, bug corrigé session 8) | ✅ |
| Tokens 3D — chargement .glb + label + halo sélection | ✅ |
| Tokens — placement par drag depuis Sidebar | ✅ |
| Tokens — drag & drop déplacement sur la carte | ✅ |
| Tokens — snap à la grille | ✅ |
| Tokens — suppression touche Suppr (GM) | ✅ |
| Tokens — menu contextuel double clic | ✅ |
| Tokens — synchronisation Socket.io (MOVED / CREATED / DELETED) | ✅ |
| Tokens — ownership drag (joueur bloqué sur tokens d'autrui) | ✅ |
| Tokens — validation drop joueur (voxel obligatoire, Y=0 corrigé session 9) | ✅ |
| Calque GM — tokens invisibles pour les joueurs | 🔲 |
| X-Ray — transparence voxels devant tokens | 🔲 |
| Viewport — Snap GM + Verrouiller vue joueurs | 🔲 |
| Outil règle/mesure 3D (distance euclidienne) | 🔲 |
| Screenshot canvas à la sortie de l'éditeur → upload MinIO | 🔲 |
| Canvas — couleur de fond depuis battlemap.bg_color | 🔲 |
| Canvas — opacité grille depuis battlemap.grid_opacity | 🔲 |
| Murs invisibles — à réévaluer (sans fog of war, utilité limitée) | ⚠️ |

### Client — Sidebar
| Tâche | État |
|---|---|
| Layout sidebar (redimensionnable, fermeture) | ✅ |
| Mode jeu / mode édition (GM) | ✅ |
| Toggle calque token/GM (GM) | ✅ |
| Palette de matières (mode édition) | ✅ |
| **Onglet Chat** | |
| Chat branché Socket.io — fil messages | ✅ |
| Log jets de dés fusionné avec chat | 🔲 |
| **Onglet Persos** | |
| Liste characters + drag vers canvas | ✅ |
| Formulaire création character (GM) | ✅ |
| Modale fiche character (3 onglets) | ✅ |
| Toggle visible/invisible (GM) | ✅ |
| Assignation character → joueur (GM) | ✅ |
| **Onglet Joueurs** | |
| Liste membres de la campagne | ✅ |
| Indicateur en ligne / hors ligne (Socket.io présence) | ✅ |
| Badge GM / Joueur | ✅ |
| Nom du personnage associé au joueur | ✅ |
| **Onglet Dés** | |
| Grille nombre × type (1-4 dés, D4/D6/D8/D10/D12/D20/D100) | 🔲 |
| Lien "Jet avancé" (formule libre ex: 2d6+3) | 🔲 |
| Animation client (seed partagé) | 🔲 |
| Critiques (seuil haut/bas configurables par campagne) | 🔲 |
| Log partagé des jets (fusionné avec chat) | 🔲 |
| **Onglet Bibliothèque** | |
| Upload documents vers MinIO | 🔲 |
| Liste documents avec visibilité GM/joueurs | 🔲 |
| **Onglet Config** | |
| Changement couleur utilisateur | ✅ |
| Changement nom d'affichage | ✅ |

### Client — Barre GM supérieure
| Tâche | État |
|---|---|
| Liste des battlemaps de la campagne | ✅ |
| Clic simple — GM prévisualise la carte (sans déplacer les joueurs) | ✅ corrigé session 14 |
| Écoute MAP_SWITCH côté client (joueurs + GM chargent la nouvelle carte) | ✅ |
| Menu clic droit sur bouton carte | ✅ |
| → Renommer la carte (modale + PUT /battlemaps/:id) | ✅ |
| → Définir comme page d'accueil (PUT /campaigns/:id default_battlemap_id) | ✅ |
| → Déplacer le groupe — MAP_SWITCH tous joueurs + GM | ✅ |
| → Dupliquer la carte (POST /battlemaps/:id/duplicate) | ✅ |
| → Supprimer la carte (DELETE + confirmation) | ✅ |
| → Détails de la carte (modale) | 🔲 |
| Détails carte — nom modifiable | 🔲 |
| Détails carte — taille grille (affichée, grisée — non modifiable V1) | 🔲 |
| Détails carte — couleur de fond (color picker → bg_color) | 🔲 |
| Détails carte — échelle (scale_label, déjà en base) | 🔲 |
| Détails carte — opacité grille (slider → grid_opacity, déjà en base) | 🔲 |
| Arborescence / dossiers battlemaps (champ folder déjà en base) | 🔲 |
| Affecter un joueur spécifique vers une battlemap | 🔲 |

### Client — Dashboard
| Tâche | État |
|---|---|
| i18n — remplacer toutes les chaînes en dur | ✅ |
| Menu profil utilisateur (modal dans header) | ✅ |

---

## Phase 3 — Polish + assets 🔲

| Tâche | État |
|---|---|
| Scènes 2D ambiance — battlemap type 'scene' avec image plein écran | 🔲 |
| Tokens 2D sur scènes ambiance — illustration dans cercle, cliquable | 🔲 |
| Upload illustration 2D par propriétaire du character | 🔲 |
| Upload token .glb par propriétaire du character | 🔲 |
| Cascade fallback tokens (glb → portrait → default.glb) | 🔲 |
| Avatars utilisateur (upload MinIO) | 🔲 |
| Vue joueur pour le GM (toggle interface) | 🔲 |
| Upload/gestion packs de textures via interface | 🔲 |
| Optimisation voxel (> 3000 cubes — face culling) | 🔲 |
| Matière eau (shader animé) | 🔲 |
| Persistance viewport (position caméra sauvegardée) | 🔲 |
| Reconnexion WebSocket — tester comportement natif socket.io-client | 🔲 |
| Table zones — effets de sorts, zones de danger (Polaris) | 🔲 |
| Point intégration fiches perso externes (API REST) | 🔲 |
| Preview carte — screenshot automatique (Option B, Phase 3) | 🔲 |

---

## Hors scope V1

- Fog of war / champ de vision des tokens
- Webcam / audio / vidéo
- Fiches de personnage intégrées (module externe — hors scope définitif)
- Destruction de décor par action joueur
- Formes voxel non-cubiques (slope, escalier)
- Sources lumineuses placées par le GM (dépend changement MeshStandardMaterial)
- Portes ouverte/fermée (bloquant/non bloquant) — reporté V2
- Conditions/effets sur tokens (empoisonné, étourdi, etc.) — reporté V2
- Musique d'ambiance
- Macros / automation
- Initiative / ordre de combat automatisé
- Taille de case en px/case — non pertinent en contexte 3D voxel