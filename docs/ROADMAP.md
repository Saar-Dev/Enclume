# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-05-07 Session 49

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

### Chantiers 9F-B/C — Mouvement entités ✅

| Chantier | Contenu | État |
|---|---|---|
| 9F-B1 | events.js + handler serveur ENTITY_MOVE_REQUEST + EntityBuilderTab refonte | ✅ session 40 |
| 9F-B2 | RadialMenu tranche Déplacer + SessionPage handleEntityMove + Canvas3D mode visée ghost | ✅ session 41 |
| 9F-C | Diagonal 45° + animation Lerp 300ms + corrections collision + polaris_mr LdB | ✅ session 43 |

### Corrections post-9F-C ✅ (session 43)

| Tâche | État |
|---|---|
| Migration 46 — polaris_mr refonte LdB officiel p.209 | ✅ |
| redis.js — convention PE14 pour voxels (buildCollisionMap + add/remove) | ✅ |
| index.js — actorBlocked à pos_z+1 (espace de marche) | ✅ |
| index.js — stepsMax = min(dmax, stepsTarget) — destination joueur respectée | ✅ |

### Chantier Dice Rework ✅ (session 44)

Architecture retenue : DiceRoller monté dans Canvas3D (un seul contexte WebGL).
Pas de DiceOverlay HTML séparé — décision session 44.

| Tâche | État |
|---|---|
| `client/src/lib/diceMath.js` — PRNG, mappings, normales D4/D6/D8/D12/D20/D10 | ✅ |
| `client/src/components/DiceMesh.jsx` — géométries, matériaux, animation | ✅ |
| `client/src/components/DiceRoller.jsx` — orchestrateur R3F, plan cliquable | ✅ |
| `client/src/components/Canvas3D.jsx` — props dicePayload/onDiceDone | ✅ |
| `client/src/pages/SessionPage.jsx` — state lastDiceRoll, filtrage skillLabel | ✅ |
| D6 — BoxGeometry, texture par face, couleur lanceur | ✅ |
| D4 — TetrahedronGeometry, texture par face | ✅ |
| D8 — OctahedronGeometry, texture par face | ✅ |
| D20 — IcosahedronGeometry, texture par face | ✅ |
| D12 — DodecahedronGeometry, atlas 12 cases | ✅ |
| D10/D100 — Trapezohedron custom, Html overlay V1 | ✅ V1 |
| D10 UV texturing — modèle Blender (.glb) avec UVs kite pré-calculés | 🔲 V2 |
| Audio — `useDiceAudio.js` — sons d'impact au rebond | 🔲 |

### Chantier 10 — Module Équipement (Inventaire + Catalogue)

| Sprint | Contenu | État |
|---|---|---|
| Sprint 1 | Schéma DB + migration 48 + page admin saisie manuelle | ✅ session 46-47 |
| Sprint 2 | `char_inventory` (table instance) + UI inventaire joueur | ✅ session 51 |
| Sprint 3 | Calcul armures mille-feuille + malus encombrement | 🔲 |

**Sprint 1 livré :**
- Migration 48 : `ref_equipment` (35 colonnes, 6 CHECK) + 3 junction tables
- Route `/api/equipment` CRUD + transaction
- Page admin `localhost:3001/equipment-admin.html` (YAML rapide + presets + multi-select compétences)

**Sprint 2 livré (session 51) :**
- Migration 50 : `char_inventory` + `char_sheet.sols`
- 5 routes REST inventaire + route sols dans `char-sheet.js`
- `InventoryPanel.jsx` — affichage par container, encombrement, édition GM (catalogue 636 items), équipement slots
- Reporté sprint 2 → chantiers futurs : transfert entre persos, WS listeners client, restriction sols→GM, split pile, UI armure

### Chantier 11 — Module Blessures (Fiche personnage)

**Architecture actée (session 49) :**
- Migration 49 : `character_wounds` — cases par localisation/gravité, stabilisation
- Calculs malus : serveur via `charStats.js` (fonctions pures)
- WS : room `campaignId` existante — client filtre par `char_sheet_id`
- Étapes 2/3 (armes, armures) bloquées par Chantier 10 sprint 2 (`char_inventory`)

**Dépendance architecturale :**
```
ref_equipment (catalogue) ← ✅ 636 items
    ↓
char_inventory (possessions joueur) ← 🔲 Chantier 10 sprint 2
    ↓
Module Armes / Module Armures (équipé depuis inventaire)
```

| Étape | Contenu | Prérequis | État |
|---|---|---|---|
| Étape 1 | `character_wounds` DB + routes + `WoundManager` UI + intégration `charStats.js` | — | ✅ session 49 |
| Étape 2 | Module Armes — liste armes équipées depuis `char_inventory` → `ref_equipment` | Chantier 10 sprint 2 | 🔲 |
| Étape 3 | Module Armures — même architecture + calcul protection par localisation | Chantier 10 sprint 2 | 🔲 |
| Étape 4 | Polish — animations Tests de Choc, états santé (Étourdi/Inconscient/Coma) | Étapes 1-3 | 🔲 |

**Mécanique Polaris (rappel LdB) :**

| Localisation | Légères | Moyennes | Graves | Critiques | Mortelles |
|---|---|---|---|---|---|
| Tête | 3 | 3 | 2 | 2 | 1 |
| Corps | 4 | 3 | 3 | 2 | 2 |
| Bras D/G | 3 | 3 | 2 | 2 | 1 |
| Jambe D/G | 3 | 3 | 2 | 2 | 1 |

Promotion : ligne pleine → ligne vidée + 1 case gravité supérieure cochée.
Malus par gravité : Légère −1 / Moyenne −3 / Grave −5 / Critique −10 / Mortelle −20.
Tests de Choc : Grave (tête/corps) + Critique + Mortelle (toutes localisations).

### PC22 — Fix 403 toggle is_learned MUTATION/POLARIS ✅ (session 50)

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
| Mode visée déplacement entités — ghost wireframe + snap 8 axes + couleurs + Lerp | ✅ session 43 |
| Animation dés 3D (DiceRoller dans Canvas3D) | ✅ session 44 |
| X-Ray voxels devant tokens | 🔲 |
| Outil règle/mesure 3D | 🔲 |

### Client — Sidebar
| Tâche | État |
|---|---|
| Chat + dés + persos + joueurs | ✅ |
| Palette textures voxel | ✅ |
| Onglets Voxels/Entités en mode édition | ✅ |
| Badge MR displacement dans chat | ✅ session 43 |
| Toggle visible character temps réel (Bug A) | ✅ session 44 |
| Bibliothèque documents | 🔲 |

### Corrections en attente
| Bug | Description | État |
|---|---|---|
| Bug A | Toggle visible character non répercuté en temps réel | ✅ session 44 |
| Bug B | Modification faces voxel existant non exposée dans UI | 🔲 |
| Bug WebGL | Context Lost au switch play/edit — non bloquant | documenté |
| Dette | EntityEditorOLD.jsx commité par erreur — à supprimer | ✅ session 44 |
| Dette | .gitattributes:3 attribut invalide — à corriger | 🔲 |

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

### Sauvegarde/export carte 3D
Export battlemap complète (voxels + entités + tokens).

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques
- Chat MP (V2)
- Sauvegarde/export carte 3D (V2)