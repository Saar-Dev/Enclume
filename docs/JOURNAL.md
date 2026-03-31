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

## Session 2 — 2026-03-30

### Contexte de reprise
- Phase 0 ✅ et Phase 1 ✅ confirmées stables après relecture du code
- Démarrage Phase 2 — Battlemap + dés
- Code existant vérifié : propre, cohérent avec la doc, aucune correction nécessaire

### Décisions prises

**player_locations — sémantique clarifiée**
Ce n'est pas "où était le joueur" mais "où le GM a placé le joueur".
Le GM est la source de vérité. Si le GM change la carte d'un joueur,
c'est cette valeur qui est persistante. Le joueur retrouve toujours
la carte que le GM lui a assignée, pas sa dernière position libre.
`battlemap_id` nullable — NULL signifie "pas encore assigné par le GM".

**player_locations — stockage**
Persistance en base PostgreSQL (pas Redis).
Redis reste réservé aux connexions actives (qui est en ligne en ce moment).
PostgreSQL stocke l'état durable (quelle carte pour quel joueur).

**Nullabilité des champs Phase 2 — décisions validées**
- `cover_image_url` (campaigns) : nullable — une campagne peut exister sans illustration
- `critical_success` / `critical_fail` (campaigns) : nullable — optionnel par campagne
- `folder` (battlemaps) : nullable — NULL signifie racine (pas de dossier)
- `scale_label` (battlemaps) : NOT NULL, défaut '1,5m' — toujours définie
- `grid_opacity` (battlemaps) : NOT NULL, défaut 0.5
- `layer` (tokens) : NOT NULL, défaut 'token'
- `cover_percent` (tokens) : NOT NULL, défaut 0
- `notes` / `gm_notes` (tokens) : nullable
- `battlemap_id` (player_locations) : nullable — NULL = pas encore assigné

**grid_size**
Défaut maintenu à 64px (déjà dans la migration 04). Pas de modification.

**Token sans image**
Affichage par défaut : silhouette générique SVG intégrée (pas d'upload requis).

**Bouton "Launch" du Dashboard**
Emmène vers la dernière battlemap active de la campagne (côté GM).
Côté joueur : la battlemap assignée par le GM dans player_locations.

### Migrations Phase 2 planifiées
- 20260330_07_campaigns_phase2.js — nouveaux champs campaigns
- 20260330_08_battlemaps_phase2.js — nouveaux champs battlemaps
- 20260330_09_tokens_phase2.js — nouveaux champs tokens
- 20260330_10_walls_zones_player_locations.js — 3 nouvelles tables

### État en fin de session
- Migrations Phase 2 : en cours d'écriture
- MinIO : pas encore commencé
- Routes battlemaps/tokens : pas encore commencées
- Socket.io auth : pas encore commencée

### Points de vigilance
- `alterTable` Knex pour modifier des tables existantes — ne touche que les nouvelles lignes
- `player_locations` UNIQUE(campaign_id, user_id) — un joueur = une carte par campagne
- Ordre des migrations critique : 10 dépend de battlemaps (04) et users (01) et campaigns (02)

Session 2 — 2026-03-30
Contexte de reprise

Phase 0 ✅ et Phase 1 ✅ confirmées stables après relecture du code
Démarrage Phase 2 — Battlemap + dés
Code existant vérifié : propre, cohérent avec la doc, aucune correction nécessaire

Décisions prises
player_locations — sémantique clarifiée
Ce n'est pas "où était le joueur" mais "où le GM a placé le joueur".
Le GM est la source de vérité. Si le GM change la carte d'un joueur,
c'est cette valeur qui est persistante. Le joueur retrouve toujours
la carte que le GM lui a assignée, pas sa dernière position libre.
battlemap_id nullable — NULL signifie "pas encore assigné par le GM".
player_locations — stockage
Persistance en base PostgreSQL (pas Redis).
Redis reste réservé aux connexions actives (qui est en ligne en ce moment).
PostgreSQL stocke l'état durable (quelle carte pour quel joueur).
Nullabilité des champs Phase 2 — décisions validées

cover_image_url (campaigns) : nullable — une campagne peut exister sans illustration
critical_success / critical_fail (campaigns) : nullable — optionnel par campagne
folder (battlemaps) : nullable — NULL signifie racine (pas de dossier)
scale_label (battlemaps) : NOT NULL, défaut '1,5m' — toujours définie
grid_opacity (battlemaps) : NOT NULL, défaut 0.5
layer (tokens) : NOT NULL, défaut 'token'
cover_percent (tokens) : NOT NULL, défaut 0
notes / gm_notes (tokens) : nullable
battlemap_id (player_locations) : nullable — NULL = pas encore assigné

grid_size
Défaut maintenu à 64px (déjà dans la migration 04). Pas de modification.
Token sans image
Affichage par défaut : silhouette générique SVG intégrée (pas d'upload requis).
Bouton "Launch" du Dashboard
Emmène vers la dernière battlemap active de la campagne (côté GM).
Côté joueur : la battlemap assignée par le GM dans player_locations.
Migrations Phase 2 planifiées

20260330_07_campaigns_phase2.js — nouveaux champs campaigns
20260330_08_battlemaps_phase2.js — nouveaux champs battlemaps
20260330_09_tokens_phase2.js — nouveaux champs tokens
20260330_10_walls_zones_player_locations.js — 3 nouvelles tables

État en fin de session

Migrations Phase 2 : en cours d'écriture
MinIO : pas encore commencé
Routes battlemaps/tokens : pas encore commencées
Socket.io auth : pas encore commencée

Points de vigilance

alterTable Knex pour modifier des tables existantes — ne touche que les nouvelles lignes
player_locations UNIQUE(campaign_id, user_id) — un joueur = une carte par campagne
Ordre des migrations critique : 10 dépend de battlemaps (04) et users (01) et campaigns (02)


Mise à jour — migrations terminées
Batch 2 (4 migrations) + Batch 3 (1 migration) — tous appliqués avec succes
FichierContenu20260330_07_campaigns_phase2.jscover_image_url, critical_success, critical_fail20260330_08_battlemaps_phase2.jsfolder, scale_label, grid_opacity20260330_09_tokens_phase2.jslayer, cover_percent, notes, gm_notes20260330_10_walls_zones_player_locations.jstables walls, zones, player_locations20260330_11_campaigns_default_battlemap.jsdefault_battlemap_id sur campaigns
Décision — suppression carte d'accueil
SET NULL en base. Fallback "carte suivante" géré côté serveur
dans DELETE /battlemaps/:id. A implémenter lors de l'écriture de cette route.
Script start.ps1
Place a la racine Enclume/. Vérifie et relance Docker, conteneurs,
serveur (3001), client (5173). Commande : .\start.ps1
Prochaine étape : configuration MinIO

MinIO — configuration terminée
Problème rencontré et résolu
ES Modules : les imports s'exécutent avant dotenv.config().
Le client MinIO s'initialisait avant que les variables d'env soient chargées.
Solution : initialisation lazy via getMinioClient() — même pattern que knex.js.
Ce n'est pas un bricolage — c'est la bonne pratique pour ES Modules.
Fichiers créés/modifiés

server/src/lib/minio.js — client MinIO lazy + BUCKET() + getFileUrl()
server/src/middleware/upload.js — multer mémoire + validation MIME + upload MinIO
server/src/index.js — vérification MinIO au démarrage après PostgreSQL
.env — ajout MINIO_BUCKET=enclume-assets

État vérifié au démarrage
Base de données connectée
MinIO connecté — bucket "enclume-assets" accessible
Serveur Enclume démarré sur le port 3001
Prochaine étape : routes battlemaps + tokens

## Session 2 — 2026-03-30 (append)

### Décisions prises

**player_locations — sémantique**
Source de vérité = le GM. Le joueur retrouve toujours la carte assignée par le GM.
battlemap_id nullable — NULL = pas encore assigné.

**Carte d'accueil par défaut**
default_battlemap_id sur campaigns (migration 11).
SET NULL en base si la carte est supprimée.
Fallback "carte la plus ancienne" géré dans DELETE /battlemaps/:id côté serveur.

**Nullabilité validée**
cover_image_url : nullable
critical_success / critical_fail : nullable
folder : nullable (NULL = racine)
scale_label : NOT NULL, défaut '1,5m'
grid_opacity : NOT NULL, défaut 0.5
layer : NOT NULL, défaut 'token'
cover_percent : NOT NULL, défaut 0
notes / gm_notes : nullable
battlemap_id (player_locations) : nullable

### Migrations appliquées
Batch 1 (session 1) : 6 migrations — tables de base
Batch 2 : 4 migrations — champs Phase 2
Batch 3 : 1 migration — default_battlemap_id
Total : 11 migrations, toutes stables

### MinIO
Bucket enclume-assets créé manuellement via console http://localhost:9001
Sous-dossiers : campaigns/ battlemaps/ tokens/ documents/ audio/
Connexion vérifiée au démarrage serveur
Problème ES Modules résolu : initialisation lazy via getMinioClient()

### Script start.ps1
Racine Enclume/. Vérifie Docker + conteneurs + serveur 3001 + client 5173.
Ouvre fenêtres PowerShell séparées si service mort.

### Routes implémentées et testées
campaigns.js — POST crée campagne + battlemap "Carte d'accueil" en transaction
battlemaps.js — GET liste, POST créer, GET détail+tokens, PUT modifier, DELETE+fallback
tokens.js — POST créer (GM), PUT modifier (owner ou GM avec droits séparés), DELETE (GM)

### Bugs corrigés
upload.js : import { AppError } au lieu de import AppError (named vs default export)
battlemaps GET / : requireRole('player') remplacé par vérification manuelle membership
campaigns.js : __AppError__ corrigé en AppError (formatage extension VS Code)

### Prochaine étape
Socket.io — authentification WebSocket + événements tokens/viewport/map:switch

Session 2 — 2026-03-30 (pivot majeur)
DÉCISION ARCHITECTURALE MAJEURE — Passage en 3D
Contexte
Une démo technique 3D voxel (Three.js, fichier HTML standalone) a été construite
et testée. Le résultat a convaincu : le projet passe intégralement en 3D.
Décision validée
Konva.js abandonné — jamais installé, jamais utilisé.
Three.js est le moteur de rendu officiel du projet.
Pas de retour en arrière possible sur cette décision.
Ce que ça change

Page Session : Three.js au lieu de Konva.js
Coordonnées tokens : (x, y) → (x, y, z) — migration nécessaire
Carte : données voxel JSONB sur battlemaps au lieu d'image de fond
image_url sur battlemaps devient optionnelle (texture de fond de scène)
Tout le reste (serveur, Socket.io, auth, dés, sidebar) : inchangé

Migrations supplémentaires à planifier

Ajouter voxel_data JSONB sur battlemaps
Ajouter pos_z FLOAT sur tokens

Fonctionnalités 3D identifiées

Tunnels / surplombs / ponts (déjà supportés par le moteur voxel)
X-Ray : blocs entre caméra et tokens rendus transparents automatiquement
Altitude, portée, ligne de vue : visuels et calculables en 3D
Tokens 3D low-poly (.glb / .gltf)
Contexte : SF principalement

Démo technique
Fichier : enclume_3d_demo.html
12 matières, grille 30x30, hauteur max 8, caméra orbitale
Modes : poser / effacer / peindre
Export JSON de la carte
Prochaine étape

Migrations pos_z (tokens) + voxel_data (battlemaps)
Planifier la page Session Three.js
Continuer Socket.io

## Session 2 — 2026-03-30 (run à vide post-pivot)

### Clarifications architecturales validées

**Calque GM**
Pas un calque de notes — un flag de visibilité.
Token sur calque gm = invisible aux joueurs.
Le GM bascule les tokens entre calques pendant la session.

**Zones avantage/désavantage**
Abandonnées. L'altitude Z gère tout nativement.
Table zones conservée pour usage futur (effets, zones de danger, Polaris).

**Murs**
Table walls conservée — sémantique : murs logiques invisibles.
Vitres, fenêtres, cloisons. Bloquent LDV sans être des voxels visuels.

**Dessin libre**
Abandonné définitivement.

**Éditeur de carte**
Pas de séparation éditeur/session.
Toolbar GM qui switche entre mode jeu et mode édition pendant la partie.
Modifications voxel broadcastées via Socket.io en temps réel.

**Eau**
Faisable avec Three.js — shader animé, transparence, profondeur.
Pertinent pour Polaris (JDR sous-marin).
Voxel type eau = matériau animé au lieu de cube solide.

**Tokens 3D — specs validées**
Format .glb, boîte 1×1×2 unités, origine aux pieds,
max 2000 triangles, PBR Metallic/Roughness,
texture atlas 512 ou 1024px, animations idle/move/attack optionnelles.
Fallback : sphère colorée + label.

### État doc
ARCHITECTURE.md — section Three.js + toutes clarifications ajoutées
PROJET.md — Konva.js à remplacer par Three.js (à faire)
ROADMAP.md — tâches Konva.js à remplacer par équivalents Three.js (à faire)

### Migrations finales — 13 au total, base stable
Batch 1 : 6 — tables de base
Batch 2 : 4 — champs Phase 2
Batch 3 : 1 — default_battlemap_id
Batch 4 : 2 — pos_z + voxel_data

### Prochaine étape
Socket.io — authentification WebSocket + événements

## Session 2 — 2026-03-30 (Socket.io)

### Socket.io — authentification + événements terminés

**Fichiers créés**
- server/src/socket/auth.js — middleware JWT pour WebSocket
- server/src/socket/index.js — tous les événements temps réel
- shared/events.js — ajout VOXEL_ADD/ADDED/REMOVE/REMOVED

**Correction chemin relatif**
shared/events.js importé depuis server/src/socket/ nécessite '../../../shared/events.js'
(3 niveaux pour remonter jusqu'à la racine Enclume/)

**Événements implémentés**
- session:join / session:joined / session:user_joined / session:user_left
- token:move / token:moved
- voxel:add / voxel:added / voxel:remove / voxel:removed
- map:switch (avec mise à jour player_locations en base)
- map:viewport (Snap GM / verrouillage)
- chat:message
- dice:roll — placeholder, TODO Phase 2 dés

**Décision localisation**
i18next intégré dès le premier composant React client.
Serveur : messages en anglais. Client : messages en français.

**État serveur vérifié**
Base de données connectée
MinIO connecté — bucket "enclume-assets" accessible
Serveur Enclume démarré sur le port 3001

**Prochaine étape : Page Session React + Three.js**

## Session 2 — 2026-03-30 (client React — fondations)

### Décisions prises

**Moteur de rendu client**
React Three Fiber (R3F) — @react-three/fiber + @react-three/drei
Choix validé après recherche : intégration native React, pas d'overhead,
tout Three.js natif reste accessible. Installé dans client/.

**Localisation**
i18next + react-i18next installés et configurés.
Fichier : client/src/i18n.js
Traductions : client/src/locales/fr.json
Importé dans main.jsx avant createRoot.
Serveur : messages en anglais. Client : messages en français via t().

**Layout page Session — validé**
Toolbar gauche (GM uniquement — mode édition, layer GM).
Canvas centre (R3F, prend tout l'espace).
Sidebar droite (chat, dés, joueurs) — potentiellement fusionnée avec toolbar.
Barre GM supérieure — masquée par défaut, toggle à la demande.
Menu contextuel clic droit sur canvas — centrer vue, verrouiller, options token.

**Outils GM uniquement**
- Bouton mode édition (bascule voxels / tokens)
- Layer GM (tokens cachés)
- Clic droit canvas → menu : centrer vue joueurs, verrouiller vue
- Barre supérieure : sélection battlemap, affectation joueurs

**Outils communs GM + joueurs**
- Lancer de dés
- Déplacer tokens autorisés (layer token)
- Chat
- Visée / portée (aura) / mesure

**Joueurs uniquement** : rien de spécifique

### Fichiers créés
- client/src/i18n.js
- client/src/locales/fr.json
- client/src/pages/SessionPage.jsx (coquille fonctionnelle)
- App.jsx — route /session/:campaignId ajoutée
- DashboardPage.jsx — bouton Launch branché sur navigate(/session/:id)

### État vérifié
- Navigation Dashboard → Session : fonctionnelle
- Chargement campagne + battlemap par défaut : fonctionnel
- "La Forêt Maudite" : aucune carte (créée avant la transaction auto)
- "Test Phase 2" : Carte d'accueil chargée correctement

### Prochaine étape
Canvas3D.jsx — intégration R3F dans SessionPage
Grille voxel vide, caméra orbitale, fond sombre.
Tokens, éditeur voxel et toolbar viendront ensuite.

## Session 2 — 2026-03-30 (Canvas3D fonctionnel)

### Canvas3D.jsx — R3F opérationnel

**Problème rencontré et résolu**
R3F v8 installé par défaut, incompatible avec React 19.
Solution : npm install @react-three/fiber@latest @react-three/drei@latest (v9/v10)
Cache Vite à vider : npx vite --force

**Fichier créé**
client/src/components/Canvas3D.jsx
- Scène R3F complète : lumières, grille, caméra orbitale libre
- Voxels chargés depuis battlemap.voxel_data
- Placeholder enclume en voxels si carte vide (45 voxels, roc noir + marbre)
- OrbitControls : clic molette = orbite, clic droit = pan, molette = zoom

**Warnings non bloquants**
- THREE.Clock deprecated — interne à R3F, pas corrigeable côté projet
- PCFSoftShadowMap deprecated — à corriger plus tard
- JSON.parse sourceMap — Firefox cosmétique, sans impact

**État vérifié**
Canvas 3D plein écran, enclume visible, caméra orbitale fonctionnelle.
Navigation Dashboard → Session → canvas : OK.

### Prochaine étape : Toolbar GM

## Session 2 — 2026-03-30 (Sidebar + layout)

### Problèmes rencontrés et résolus

**node_modules parasite à la racine Enclume/**
npm avait été lancé depuis la racine par erreur en début de session.
Résidu : Enclume/package.json + Enclume/node_modules/ + warning nodemon.
Solution : suppression de ces trois éléments. R3F est correctement installé dans client/.

**Sidebar — bouton réouverture invisible**
Cause : bouton rendu dans Sidebar avec position:fixed, écrasé par overflow:hidden du parent.
Solution : état visible/width remonté dans SessionPage.
Le bouton de réouverture est rendu directement dans SessionPage — hors de tout overflow.

**Sidebar — resize dysfonctionnel**
Cause : état width dans Sidebar, SessionPage ne contrôlait pas le layout.
Solution : width et visible gérés dans SessionPage, passés en props à Sidebar.
Le canvas utilise flex:1 + minWidth:0 — se réduit proprement quand la sidebar s'élargit.

### Architecture layout validée
SessionPage contrôle : sidebarVisible, sidebarWidth, mode, layer
Sidebar reçoit tout en props — composant purement contrôlé
Canvas3D prend flex:1 + minWidth:0 — s'adapte automatiquement

### État fonctionnel vérifié
- Sidebar redimensionnable (220px min, 500px max)
- Fermeture : sidebar disparaît, bouton ‹ apparaît sur bord droit
- Réouverture : clic bouton ‹ → sidebar réapparaît à la largeur précédente
- Toggles mode jeu/édition et layer token/GM : visuellement fonctionnels
- Menu mesure : dropdown avec 3 outils (non branchés)
- Chat local fonctionnel (Socket.io à brancher)
- Onglets Biblio et Params : placeholders Phase 3

### Prochaine étape
Run à vide — état global Phase 2, planification suite

## Session 3 — 2026-03-31

### Contexte de reprise
Session 2 stable confirmée. Démarrage session 3 — éditeur voxel + textures.

### Décisions prises

**Système de packs de textures**
Format manifest.json validé :
- `name`, `label`, `tileSize`, `materials[]`
- Chaque matière : `id` (int stocké dans voxel_data), `name`, `label`, `top`, `side`
- Chemins relatifs dans le pack — sous-dossiers libres (floor/, wall/, hazard/...)
- tileSize 128x128px pour les premiers tests — à optimiser si besoin sur Raspberry Pi
- Textures Minecraft modpack pour usage privé — acceptable, à remplacer si projet public

**Architecture proxy textures**
Le client ne touche jamais MinIO directement.
Route /api/textures proxyfie tout via Express — règle le problème CORS définitivement.
Bucket MinIO reste en mode PRIVATE — correct et voulu.
Cache-Control: max-age=3600 sur les PNGs — important pour les performances.

**Séparation PUT battlemaps**
PUT /battlemaps/:id — métadonnées + image (avec multer)
PUT /battlemaps/:id/voxels — voxel_data JSON pur (sans multer)
Décision propre : une route = une responsabilité.

**VITE_API_URL**
Variable d'environnement Vite dans le .env racine.
Vite configuré via envDir dans vite.config.js pour lire la racine.
Pas de client/.env — source de vérité unique maintenue.
Sur Raspberry Pi : changer VITE_API_URL dans .env racine uniquement.

**activeMaterial / availableMaterials**
SessionPage est le chef d'orchestre — possède ces deux états.
Canvas3D remonte les matières via onPackLoaded callback.
Sidebar les reçoit en props — composant purement contrôlé.

**Éditeur voxel**
Mode edit uniquement. Clic gauche pose, clic droit efface.
Raycasting sur plan de sol Y=0 et sur les voxels existants.
Pose sur la face d'un voxel existant : position = voxel + normale de la face.
Sauvegarde auto toutes les 60s si dirty.
Sauvegarde à la fermeture de l'éditeur (mode edit → play).
Socket.io voxel:add/remove broadcastés (socket branché plus tard).

### Problèmes rencontrés et résolus

**path-to-regexp wildcard**
Express récent n'accepte plus `/:pack/*` — remplacé par `/:pack/*filePath`.
req.params.filePath est un tableau (pas une string) — joint avec '/'.

**VITE_API_URL undefined**
Vite cherche .env dans client/ par défaut, pas à la racine.
Solution propre : envDir dans vite.config.js — pas de client/.env créé.

**onPackLoaded manquant dans les props Canvas3D**
Déclaré dans SessionPage, passé en prop, mais absent de la signature de Canvas3D.
Une seule ligne manquante — ajoutée dans la destructuration des props.

**Import minio.js**
getMinioClient est export défaut, BUCKET est export nommé.
Import correct : `import getMinioClient, { BUCKET } from '../lib/minio.js'`

### État en fin de session
- Éditeur voxel fonctionnel avec textures
- Palette de matières fonctionnelle dans la Sidebar
- Sauvegarde voxels opérationnelle
- Premier pack hard-sf uploadé (9 matières, quelques fichiers manquants à compléter)
- console.log debug à nettoyer avant prod

### Prochaine étape
Tokens 3D — fallback sphère colorée + label, placement par le GM, drag & drop.