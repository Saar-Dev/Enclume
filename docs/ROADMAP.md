# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-04-30 Session 41

---

## Méthodologie de travail
- Une étape stable et certaine avant de passer à la suivante
- Pas de rustines : la bonne architecture dès le début
- Toute décision non documentée est considérée comme nulle
- Runs à vide réguliers pour vérifier l'alignement
- Priorité : CODE (mémoire externe) > conversation en cours

---

## Phase 0 — Socle technique ✅
## Phase 1 — Auth + campagnes ✅

---

## Phase 2 — Battlemap 3D + session de jeu 🔲

### Chantier 9A — Refonte voxel ✅
### Chantier 9B — Interface CRUD texture packs ✅
### Chantier 9C — Système entités interactables ✅
### Chantier 9D — Atelier du GM ✅
### Chantier 9E — Entités en session ✅

| Tâche 9E | État |
|---|---|
| Bug 9D — blueprints visibles dans palette éditeur | ✅ session 34 |
| Textures entités — pack_id dans JOIN serveur | ✅ session 34 |
| RadialMenu — menu interactions joueur | ✅ session 34 |
| EntityInstancePanel — config instance GM | ✅ session 34 |
| Flux interaction joueur → arbitrage GM → changement état | ✅ session 36 |
| S34-1 — Changement d'état visible sans F5 | ✅ session 36 |
| S34-2 — Jet sans compétence → guard skill_id | ✅ session 36 |
| S34-3 — Formule 1d20 au lieu de 2d10 | ✅ session 36 |
| S34-4 — GM auto-approve | ✅ session 36 |
| S34-5 — Notifications dans chat + couleur onglet | ✅ session 36 |
| S34-6 — Détection ⚙ robuste | ✅ session 36 |
| Géométries entités : door + trapdoor dans l'Atelier | 🔲 |
| Favicon client/public/favicon.svg | 🔲 |

### Chantier 9F-0 — Module `charStats.js` — Calcul serveur ✅ (session 36)

| Tâche | État |
|---|---|
| `server/src/lib/charStats.js` — table AN + calcNA + calcSkillTotal + calcAttributeAN | ✅ |
| `socket/index.js` — calcul serveur dans ENTITY_ACTION_RESOLVE | ✅ |
| `SessionPage.jsx` — retirer skillTotal du payload | ✅ |

### Chantier 9F-A — Fondations mouvement ✅ (session 39)

| Tâche | État |
|---|---|
| Migration 44 — colonne `r` sur `tokens` | ✅ |
| Migration 45 — table `polaris_mr` + seed | ✅ |
| `server/src/lib/redis.js` — client ioredis + helpers collision map | ✅ |
| Collision map Redis — buildCollisionMap + maintenance complète | ✅ |
| `TOKEN_ROTATE` — event + handler serveur + clic client | ✅ |
| Affichage rotation token — `rotation.y = r * Math.PI / 4` | ✅ |

### Chantiers 9F-B/C — Mouvement entités

| Chantier | Contenu | État |
|---|---|---|
| 9F-B1 | events.js + handler serveur ENTITY_MOVE_REQUEST + EntityBuilderTab refonte | ✅ session 40 |
| 9F-B2 | RadialMenu tranche Déplacer + SessionPage handleEntityMove + Canvas3D mode visée ghost | ✅ session 41 |
| 9F-C | Diagonal 45° + animation Lerp 300ms + Tchebychev | 🔲 |

Voir `docs/PLAN_ENTITY.md` pour la spécification complète.

### Chantier reporté — Paramètre campagne GM entity move mode 🔲
3 options : réaliste / à la carte / divine. Voir EN_COURS.md.

### Serveur — Routes
| Tâche | État |
|---|---|
| Routes battlemaps CRUD + voxels | ✅ |
| Routes tokens | ✅ |
| Routes characters | ✅ |
| Lock éditeur + heartbeat | ✅ |
| Upload screenshot sortie éditeur → MinIO | 🔲 |

### Client — Canvas 3D
| Tâche | État |
|---|---|
| Voxels { tex, geo, r } | ✅ |
| Tokens 3D + rotation 8 orientations | ✅ session 39 |
| Éditeur voxel (Editor3D) | ✅ |
| Entités interactables (EntityMesh + EntityEditorScene) | ✅ |
| Palette blueprints dans éditeur | ✅ session 34 |
| EntityBuilderTab — formulaire interactions SkillCheck/Déplacement | ✅ session 40 |
| Mode visée déplacement entités — ghost wireframe + snap + dot(AE,AD) | ✅ session 41 |
| X-Ray voxels devant tokens | 🔲 |
| Outil règle/mesure 3D | 🔲 |

### Client — Sidebar
| Tâche | État |
|---|---|
| Chat + dés + persos + joueurs | ✅ |
| Palette textures voxel | ✅ |
| Onglets Voxels/Entités en mode édition | ✅ |
| Toggle visible character temps réel (Bug A) | 🔲 |
| Bibliothèque documents | 🔲 |

### Corrections en attente
| Bug | Description | État |
|---|---|---|
| Bug A | Toggle visible character non répercuté en temps réel | 🔲 |
| Bug B | Modification faces voxel existant non exposée dans UI | 🔲 |
| Bug WebGL | Context Lost au switch play/edit — non bloquant | documenté |

---

## Phase 3 — Polish + assets 🔲

| Tâche | État |
|---|---|
| Scènes 2D ambiance | 🔲 |
| Avatars utilisateur | 🔲 |
| Optimisation voxel face culling | 🔲 |
| Persistance viewport caméra | 🔲 |
| Reconnexion WebSocket | 🔲 |
| Favicon application | 🔲 |

---

## Idées documentées — à planifier

### Paramètre campagne GM entity move mode
Voir EN_COURS.md — chantier reporté.

### Mode spectateur
Rôle `spectator` dans `campaign_members.role`.
Accès lecture identique à `player` — aucune émission WS.
Complexité estimée : faible à moyenne.

### Géométrie slope et wedge custom
BufferGeometry custom Three.js — aucun changement modèle de données.
Complexité estimée : faible.

### Export ZIP pack complet
À ajouter : blueprints JSON dans `entites/`, GLB dans `glb/`.

### Chat MP
Messagerie privée entre joueurs/GM.

### Animation dé 3D
Rendu Three.js du lancer.

### Sauvegarde/export carte 3D
Export battlemap complète (voxels + entités + tokens).

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques
- Chat MP (V2)
- Animation dé 3D (V2)
- Sauvegarde/export carte 3D (V2)
