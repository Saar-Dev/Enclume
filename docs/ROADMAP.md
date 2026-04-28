# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-04-22 Session 34

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
### Chantier 9E — Entités en session 🔲

| Tâche 9E | État |
|---|---|
| Bug 9D — blueprints visibles dans palette éditeur | ✅ session 34 |
| Textures entités — pack_id dans JOIN serveur | ✅ session 34 |
| RadialMenu — menu interactions joueur | ✅ session 34 |
| EntityInstancePanel — config instance GM | ✅ session 34 |
| Flux interaction joueur → arbitrage GM → changement état | ✅ partiel (S34-1) |
| Bug S34-1 — Changement d'état visible sans F5 | 🔲 priorité 1 |
| Bug S34-2 — Jet sans compétence → guard skill_id | 🔲 priorité 2 |
| Bug S34-3 — Formule 1d20 au lieu de 2d10 | 🔲 priorité 2 |
| Bug S34-4 — GM auto-approve | 🔲 priorité 3 |
| Bug S34-5 — Notifications dans chat + couleur onglet | 🔲 priorité 4 |
| Bug S34-6 — Détection ⚙ robuste | 🔲 priorité 5 |
| Géométries entités : door + trapdoor dans l'Atelier | 🔲 |
| Interactions — déplacement/rotation entité | 🔲 |
| SkillCheck WS — jet côté serveur, résolution | 🔲 |
| Favicon client/public/favicon.svg | 🔲 |

### Chantier 9F-0 — Module `polaris.js` — Calcul serveur (PRÉREQUIS 9F-B) 🔲

**Contexte :** PE1 ("skillTotal calculé client") était une rustine documentée. Le serveur ne doit pas
dépendre du client pour les valeurs mécaniques. Un joueur peut envoyer `skillTotal: 999` sans détection.

**Périmètre :** aucune migration SQL. Uniquement :
- `server/src/lib/polaris.js` — table AN, `calcNA()`, `calcSkillTotal()`, `calcAttributeTotal()`
- `socket/index.js` — `ENTITY_ACTION_RESOLVE` reçoit `skillId` (pas `skillTotal`) → serveur recalcule
- `SessionPage.jsx` — payload `ENTITY_ACTION_REQUEST` n'envoie plus `skillTotal`
- PE1 supprimé comme convention

| Tâche | État |
|---|---|
| `server/src/lib/polaris.js` — table AN + calcNA + calcSkillTotal + calcAttributeTotal | 🔲 |
| `socket/index.js` — calcul serveur dans ENTITY_ACTION_RESOLVE | 🔲 |
| `SessionPage.jsx` — retirer skillTotal du payload | 🔲 |
| Tests console F12 | 🔲 |

### Chantiers 9F-A/B/C — Mouvement entités 🔲

**Prérequis : 9F-0 terminé et validé.**

| Chantier | Contenu | État |
|---|---|---|
| 9F-A | Rotation tokens + migration `r` + table `polaris_mr` + collision map Redis | 🔲 |
| 9F-B | Interaction déplacement entité (orthogonal 4 axes) + UX ghost client | 🔲 |
| 9F-C | Diagonal 45° + animation Lerp 300ms + Tchebychev | 🔲 |

Voir `docs/PLAN_ENTITY.md` pour la spécification complète.
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
| Tokens 3D | ✅ |
| Éditeur voxel (Editor3D) | ✅ |
| Entités interactables (EntityMesh + EntityEditorScene) | ✅ |
| Palette blueprints dans éditeur | ✅ session 34 |
| X-Ray voxels devant tokens | 🔲 |
| Outil règle/mesure 3D | 🔲 |

### Client — Sidebar
| Tâche | État |
|---|---|
| Chat + dés + persos + joueurs | ✅ |
| Palette textures voxel | ✅ |
| Onglets Voxels/Entités en mode édition | ✅ |
| Onglet Actions GM (arbitrage entités) | ✅ — à remplacer par notifications chat (S34-5) |
| Toggle visible character temps réel (Bug A) | 🔲 |
| Bibliothèque documents | 🔲 |

### Corrections en attente
| Bug | Description | État |
|---|---|---|
| S34-1 | Changement d'état entité non visible sans F5 | 🔲 priorité 1 |
| S34-2 | Jet de dés lancé sans compétence | 🔲 priorité 2 |
| S34-3 | Formule de jet 2d10 → 1d20 | 🔲 priorité 2 |
| S34-4 | GM auto-approve interactions | 🔲 priorité 3 |
| S34-5 | Notifications interactions → chat + couleur onglet | 🔲 priorité 4 |
| S34-6 | Détection ⚙ difficile à angle rasant + intermittente | 🔲 priorité 5 |
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

### Mode spectateur
Rôle `spectator` dans `campaign_members.role`.
Accès lecture identique à `player` — aucune émission WS.
Complexité estimée : faible à moyenne.

### Fiche personnage auto-calculatrice
Débutée en parallèle (format HTML + SQL + CSS).
À valider en session dédiée.

### Géométrie slope et wedge custom
BufferGeometry custom Three.js — aucun changement modèle de données.
Complexité estimée : faible.

### Export ZIP pack complet
Actuellement : textures + voxels.
À ajouter : blueprints JSON dans `entites/`, GLB dans `glb/`.
Structure cible :
```
PACK/
  textures/   — PNG
  glb/        — modèles 3D
  entites/    — JSON comportement blueprints
  manifest.json
```

### Chat MP
Messagerie privée entre joueurs/GM.

### Animation dé 3D
Rendu Three.js du lancer.

### Sauvegarde/export carte 3D
Export battlemap complète (voxels + entités + tokens).

### Interactions entités — déplacement/rotation
Action → déplacement pos ou rotation r de l'entité.
Permet : ouverture porte coulissante, déplacement décor par joueur.
Dépendances : nouvelle mécanique WS, animation côté client.

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques
- Chat MP (V2)
- Animation dé 3D (V2)
- Sauvegarde/export carte 3D (V2)
