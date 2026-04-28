Note : Il s'agit du journal des sessions à partir de 30. La partie 1 est dispo sur simple demande.

### Contexte de reprise
Session 9A-5 stable confirmée. Chantier 9A complet. Démarrage session 9B.

### Travail effectué

**Migration 32 — déplacement fichiers MinIO seed structure-station**
- Tous les fichiers du pack structure-station déplacés de `textures/structure-station/` vers `textures/b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e/`
- 98 fichiers migrés (97 PNG + manifest.json)
- `faces` en base inchangées — chemins relatifs au pack identiques
- Irréversible — down = no-op documenté

**Convention chemins MinIO — définitive**
- Chemin MinIO : `textures/<pack_uuid>/<fichier>.png`
- `faces` en base stocke des chemins relatifs à l'UUID du pack
- Client construit : `VITE_API_URL/api/textures/<pack_id>/<path>`
- Le `name`/`label` du pack n'apparaît jamais dans les chemins MinIO
- Renommage pack = uniquement `label` en base, zéro impact fichiers

**`server/src/routes/textures.js` — nettoyage**
- `GET /` supprimé — scannait MinIO + JSON.parse → crashait sur fichiers non-JSON (P28)
- `GET /:pack/*filePath` inchangé — générique, fonctionne avec UUID ou name
- Ajout Content-Type `.zip` pour servir les archives

**`server/src/routes/voxel-textures.js` — extension**
- `POST /` — créer texture avec upload PNG (principal obligatoire + 6 faces optionnelles)
- `POST /from-paths` — créer voxel depuis PNG déjà dans MinIO (constructeur UI)
- `PUT /:id` — modifier label, deprecated, allowed_geometries, sort_order, category_id
- `DELETE /:id` — 409 si utilisée dans battlemap_texture_usage

**`server/src/routes/texture-packs.js` — refonte complète**
- GET / corrigé : JOIN `voxel_textures` au lieu de `block_types` (P42)
- GET /:id corrigé : query `voxel_textures` au lieu de `block_types` (P42)
- `POST /` — créer pack + ZIP initial
- `PUT /:id` — modifier label/description/tile_size (`name` immuable)
- `DELETE /:id` — 409 via battlemap_texture_usage JOIN voxel_textures + nettoyage MinIO
- `GET /:id/export` — servir ZIP pré-calculé depuis MinIO
- `POST /import` — importer ZIP : MinIO AVANT base, remapping localId, guard path traversal
- `GET /:id/files` — lister PNG bruts MinIO avec flag `inUse`
- `POST /:id/files` — uploader un PNG dans le pack
- `DELETE /:id/files/*path` — supprimer PNG, 409 si utilisé dans faces d'un voxel

**`client/src/lib/voxelTextures.js` — correction URL**
- `packName` → `packId` dans la construction d'URL
- URL construite : `VITE_API_URL/api/textures/<pack_id>/<path>`

**`client/src/pages/TexturePacksPage.jsx` — nouvelle page complète**
- Layout : colonne packs (200px) + zone détail
- Onglets dans le détail : **Voxels** / **Textures PNG**
- Onglet Voxels : liste voxels gauche + constructeur droite
  - Constructeur : nom + 7 cases faces cliquables (popup sélecteur PNG) + checklist géométries
  - Aperçu 3D temps réel : mini Canvas R3F avec `Voxel` rotatif (useFrame)
  - Création via `POST /api/voxel-textures/from-paths`
  - Modification via `PUT /api/voxel-textures/:id`
  - Dépréciation / réactivation inline
- Onglet Textures PNG : grille PNG + flag rouge si utilisé + upload + suppression
- Import/Export ZIP
- Création pack (modal)
- Suppression pack (modal + 409)
- Ownership : boutons d'édition visibles uniquement si `created_by === user.id`

**`client/src/App.jsx`** — route `/texture-packs` ajoutée

**`client/src/pages/DashboardPage.jsx`** — lien conditionnel GM (`campaigns.some(c => c.role === 'gm')`)

**`client/src/locales/fr.json`** — namespace `texturePacks` ajouté (24 clés)

### Décisions prises

**`name` du pack — immuable après création**
Identifiant technique dans le manifest ZIP. `PUT /:id` modifie uniquement `label`, `description`, `tile_size`.

**ZIP pré-calculé**
Créé/mis à jour après chaque modification (création pack, ajout/suppression texture, PUT pack).
Export = servir le ZIP existant depuis MinIO directement, sans reconstruction à la demande.

**Ownership packs**
`requireRole` inutilisable (pas de campaignId dans l'URL).
Pattern retenu : `pack.created_by === req.user.id`.
Tout utilisateur authentifié peut créer un pack.

**`created_by` seed structure-station**
Mis à jour manuellement via SQL pour permettre les modifications depuis l'UI :
`UPDATE texture_packs SET created_by = '<user_id>' WHERE id = 'b4e8f2a1-...'`

**Terminologie clarifiée**
- texture = fichier PNG de surface
- géométrie = forme 3D
- voxel = géométrie + assignation de textures sur ses faces
`voxel_textures` = table des voxels définis, pas des textures PNG brutes

### Pièges documentés (nouveaux)

**P43 — chemins MinIO textures par UUID du pack**
`textures/<pack_uuid>/<fichier>.png` — jamais `textures/<pack_name>/`.
Le `name` du pack n'apparaît jamais dans les chemins MinIO.
Renommer un pack ne casse aucun lien.

**P44 — `name` du pack immuable**
`name` = identifiant technique dans le manifest ZIP.
`PUT /api/texture-packs/:id` ne modifie que `label`, `description`, `tile_size`.
Modifier `name` casserait les imports ZIP croisés entre instances.

**P45 — GET / de textures.js supprimé**
L'ancienne `GET /api/textures/` scannait MinIO et faisait JSON.parse sur chaque fichier.
Avec des .zip et .png dans le dossier → crash nodemon immédiat.
La liste des packs est désormais dans `GET /api/texture-packs` (source de vérité en base).

**P46 — POST /voxel-textures/from-paths déclaré AVANT PUT /:id**
Route spécifique `/from-paths` déclarée avant la route paramétrique `/:id`.
Sinon Express interpréterait `/from-paths` comme un `id`.

### Fichiers créés/modifiés
- `server/src/db/migrations/32_migrate_seed_minio.js` — nouveau
- `server/src/routes/textures.js` — GET / supprimé
- `server/src/routes/voxel-textures.js` — POST /, POST /from-paths, PUT /:id, DELETE /:id ajoutés
- `server/src/routes/texture-packs.js` — refonte complète (9 routes)
- `client/src/lib/voxelTextures.js` — packName → packId
- `client/src/pages/TexturePacksPage.jsx` — nouvelle page complète
- `client/src/App.jsx` — route /texture-packs
- `client/src/pages/DashboardPage.jsx` — lien conditionnel GM
- `client/src/locales/fr.json` — namespace texturePacks

### Dépendances installées
- `server/` : `jszip`, `image-size`

### Validation fonctionnelle
- ✅ Migration 32 — 98 fichiers déplacés, MinIO vérifié
- ✅ GET /api/textures/<uuid>/sol/metal_plate_top.png → 200 image/png
- ✅ GET /api/voxel-textures → 78 textures, aucune régression
- ✅ GET /api/texture-packs → pack structure-station, texture_count correct
- ✅ GET /api/texture-packs/<uuid>/files → 97 fichiers PNG
- ✅ Page /texture-packs accessible, packs listés, textures affichées
- ✅ Onglet Voxels — constructeur fonctionnel, aperçu 3D rotatif
- ✅ Onglet Textures PNG — grille + flags inUse
- ✅ Popup sélecteur PNG fonctionnelle
- ✅ Création voxel via from-paths
- ✅ Session de jeu — voxels affichés avec textures correctes (plus de magenta)

### Points de vigilance session suivante
- Bug A toujours présent (toggle visible character non répercuté en temps réel)
- `block-types.js` toujours orphelin sur disque — peut être supprimé proprement
- La modification des faces d'un voxel existant (PUT faces) n'est pas encore exposée dans l'UI — seul le label et les géométries sont modifiables après création

# JOURNAL CHANTIER — Fiche Personnage Polaris
> Mémoire externe du chantier "character" — indépendant du JOURNAL.md d'Enclume
> Dernière mise à jour : 2026-04-14 — Session 1 (complète)

---

## Contexte

Projet intégré dans Enclume. Deux domaines distincts dans le même monorepo :
- Domaine VTT (existant) : cartes, voxels, tokens, sessions, temps réel
- Domaine Character (nouveau) : fiche perso, compétences, inventaire, bourse, marchands, crafting, initiative, combat

Ces modules existaient en HTML/JS vanilla connectés à Google Sheets.
**Objectif : tout migrer dans Enclume** — PostgreSQL remplace Google Sheets comme pivot central.

Lien entre domaines : base PostgreSQL partagée + auth JWT partagée.
Lien technique : `character_id` (UUID) remplace le `fid` Google Sheets dans tous les modules.

Le développeur des modules joueur sera impliqué. La fiche perso est sa "porte d'entrée" —
une fois l'API disponible, il remplace ses appels Google Sheets par des appels API Enclume.

---

## Sources de vérité

| Source | Contenu |
|---|---|
| `Fiche_Polaris_Online_-_Vierge.xlsx` onglet Personnage | Structure visuelle et règles de calcul |
| `Fiche_Polaris_Online_-_Vierge.xlsx` onglet Compétences | Catalogue complet des compétences (structure cols A-G) |
| `FichePerso_v4.txt` | Documentation de conception Modules 1 à 6 (incohérences connues, résolues dans ce journal) |
| Ce journal | Décisions prises, questions résolues, plan arrêté — **source de vérité finale** |

---

## Structure de fichiers — décision arrêtée

```
Enclume/
  client/
    src/
      [existant intact — domaine VTT]
      character/        — nouveau domaine, composants React fiche perso
  server/
    src/
      [existant intact — domaine VTT]
      routes/
        character/      — nouvelles routes Express fiche perso
      db/
        migrations/     — migrations existantes (001-032) + nouvelles préfixées char_
```

**Pourquoi `character/` dans `src/` et pas à la racine :**
Vite (client) et Node/Express (server) ont `src/` comme point d'entrée.
Placer `character/` en dehors de `src/` rendrait les fichiers invisibles sans bricolage de config.

**Pourquoi on ne renomme pas l'existant en `vtt/` :**
Trop risqué — tous les imports seraient à mettre à jour sur un projet de 32 migrations stables.
Convention adoptée : le nouveau code va dans `character/`, l'ancien reste en place.
Migration progressive possible quand une zone est de toute façon modifiée.

---

## Ce qui est compris et validé

### Structure de l'onglet Compétences (Excel)
Colonnes : A=famille, B=nom parent, C=nom enfant (sous-compétence), D=marqueur, E=attributs (ex: COO/PER), G=description.
Certaines compétences ont plusieurs sous-entrées (ex: Arts martiaux > Lutte / Tech. défensives / Tech. offensives).
Certaines ont plusieurs variantes d'attributs (ex: Armes Spéciales en FOR/COO et en COO/COO = deux entrées BDD distinctes).

### Calcul score Base d'une compétence
`Base = AN(attr_1) + AN(attr_2)`. Si un seul attribut : `AN(attr) + AN(attr)` (doublé).

### Calcul Niveau Actuel (na) d'un attribut
`na = (base_level + pc_modifier + mod_genotype) - TOTAL_MALUS`
Plancher : `if (na < 3) na = 3`
Puis mapping na → AN via table de correspondance (objet JS statique).

### Modificateur génotype
Tiré de `ref_genotypes` selon le génotype choisi. 4 génotypes V1 : HUMAIN, HYB_NAT, TEC_HYB, GEN_HYB.

### Malus global
Ignoré en V1 (TOTAL_MALUS = 0). Viendra des modules armures/blessures futurs.

### Attributs secondaires — pas de table SQL
Tout calculé côté JS. Formules :
- REA = (ADA + PER) / 2
- Initiative = REA (valeur brute)
- Seuil Étourdissement = (FOR + CON + VOL) / 3
- Seuil Inconscience = Seuil_Étour + 10
- Vitesse Marche = (FOR + COO + ADA) / 3
- Vitesse Course = Marche × 2
- Mod_Dom : table fixe si FOR <= 21, sinon 5 + floor((FOR - 21) / 2)
- Arrondi Polaris : 0.5 arrondi vers le bas (ex: 16.5 → 16)

### Colonne S dans les compétences
Flag "Spécialisée". Ignoré en V1.

### Table `characters` existante dans Enclume
Contient uniquement les données techniques du token 3D. Aucune donnée Polaris dedans.
Le lien : `char_sheet.character_id → characters.id (UUID)`.

### Nom du personnage — deux champs distincts
- `characters.name` dans Enclume = nom court du token (ex: "Soleil")
- `char_identity.char_name` dans la fiche = nom officiel complet (ex: "Wayde SR-4476")
Ces deux champs sont indépendants et peuvent différer. Pas de doublon.

### Accès à la fiche
Lecture et écriture : joueur propriétaire (`characters.user_id`) OU rôle GM.

---

## Décisions d'architecture

- **PostgreSQL uniquement** — pas de SQLite, pas de standalone.
- **Composant React intégré** dans Enclume — pas d'iframe HTML.
- **Approche itérative** — module par module, pas tout d'un coup.
- **Pas de table `characters` recréée** — FK vers l'existante.
- **Migrations format `.js`** comme le reste d'Enclume (convention P30).
- **UUID partout** sauf exceptions documentées.
- **Données statiques de référence** (génotypes, compétences) : stockées en BDD.
- **Calculs** : côté client JS uniquement — le serveur ne calcule rien.
- **`pc_modifier`** : valeur agrégée en V1. Historique XP = module futur séparé.
- **`char_attributes`** : format ligne par ligne (une ligne par attribut par personnage).
- **`ref_genotypes`** : une colonne par attribut — une ligne par génotype.
- **`ref_skill_requirements`** : table séparée (one-to-many).

---

## Schéma SQL validé — V1

### Tables de référence (statiques)

**`ref_genotypes`**
```
id          TEXT PK        — 'HUMAIN', 'HYB_NAT', 'TEC_HYB', 'GEN_HYB'
label       TEXT           — nom affiché
mod_for     INT DEFAULT 0
mod_con     INT DEFAULT 0
mod_coo     INT DEFAULT 0
mod_ada     INT DEFAULT 0
mod_per     INT DEFAULT 0
mod_int     INT DEFAULT 0
mod_vol     INT DEFAULT 0
mod_pre     INT DEFAULT 0
```

**`ref_skills`**
```
id          TEXT PK        — ex: 'ACROBATIE', 'ARTS_MARTIAUX_LUTTE'
family      TEXT           — 'Physique', 'Combat', 'Mental'...
label       TEXT           — nom affiché
parent      TEXT           — NULL si pas de parent, sinon ex: 'ARTS_MARTIAUX'
attr_1      TEXT           — 'FOR', 'COO'...
attr_2      TEXT           — NULL si attr_1 x2
marker      TEXT           — NULL=Standard, 'DIFF'=(-3), 'RES_X'=(X), 'LIMIT'=(•), 'PN', 'PREREQ'=(†)
description TEXT           — tooltip affiché sur la fiche
```

**`ref_skill_requirements`**
```
skill_id    TEXT FK→ref_skills.id
type        TEXT           — 'SKILL_MIN', 'MUTATION', 'GENOTYPE'
value       TEXT           — ex: 'INFORMATIQUE' ou 'MUT_QUEUE'
threshold   INT            — valeur minimale requise
PK(skill_id, type, value)
```

### Tables personnage (dynamiques)

**`char_sheet`** — table pivot
```
id              UUID PK DEFAULT gen_random_uuid()
character_id    UUID FK→characters.id ON DELETE CASCADE
chc             INT DEFAULT 11
created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
```

**`char_identity`**
```
char_sheet_id       UUID PK FK→char_sheet.id ON DELETE CASCADE
player_name         TEXT
char_name           TEXT
height              NUMERIC(4,1)
weight              NUMERIC(5,1)
skin                TEXT
eyes                TEXT
hair                TEXT
build               TEXT
distinctive_signs   TEXT
hand_pref           TEXT           — 'R', 'L', 'A'
```

**`char_archetype`**
```
char_sheet_id   UUID PK FK→char_sheet.id ON DELETE CASCADE
genotype_id     TEXT FK→ref_genotypes.id
age             INT
sex             TEXT
is_fertile      BOOLEAN DEFAULT FALSE
origin_geo      TEXT
origin_soc      TEXT
training_base   TEXT
higher_ed       TEXT
```

**`char_attributes`**
```
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
attr_id         TEXT           — 'FOR','CON','COO','ADA','PER','INT','VOL','PRE'
base_level      INT NOT NULL DEFAULT 7
pc_modifier     INT DEFAULT 0
PK(char_sheet_id, attr_id)
```

**`char_skills`**
```
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
skill_id        TEXT FK→ref_skills.id
mastery         INT DEFAULT 0
is_learned      BOOLEAN DEFAULT FALSE
PK(char_sheet_id, skill_id)
```

### Ce qui n'existe pas en base (calculé JS uniquement)
- Modificateur génotype, Niveau actuel (na), Aptitude Naturelle (AN)
- Score Base compétence, Total compétence
- Tous les attributs secondaires (REA, Initiative, seuils, vitesses, Mod_Dom)

---

## Périmètre V1

### Dans le scope
- Module 1 : Identité
- Module 2 : Archétype / Génotype
- Module 3 : Attributs primaires (8 + Chance)
- Module 4 : Attributs secondaires (calcul JS)
- Module 5 : Compétences (affichage + calcul + saisie maîtrise)
- Tables de référence : ref_genotypes, ref_skills, ref_skill_requirements

### Hors scope V1
- Colonne S (spécialisations)
- Module 6 : Mutations & Pouvoirs Polaris
- Malus global, Armures, Blessures, Munitions, Inventaire, Argent, XP historique

---

## Questions ouvertes

- [ ] Format exact des noms de fichiers de migration (Q20) — besoin de voir 2-3 noms réels
- [ ] Seed dans `up` ou fichier séparé (Q21) — besoin de confirmation
- [ ] Structure des routes API Express à définir

---

## Historique des sessions

### Session 1 — 2026-04-14
Phase apprentissage/compréhension + décisions d'architecture complètes.
26 questions posées, toutes répondues.
Découverte tardive de l'écosystème complet (7 modules JS, Google Sheets comme pivot).
Décision : tout migrer dans Enclume, Google Sheets abandonné.
Structure de fichiers arrêtée. Schéma SQL validé.
Aucun code produit.
Prochaine étape : répondre Q20+Q21 puis migrations SQL.

---

## Session 1 — suite (même journée)

### Migrations produites et appliquées ✅
- `33_char_ref_genotypes.js` — table + seed 4 génotypes
- `34_char_ref_skills.js` — table vide (seed manuel à prévoir)
- `35_char_ref_skill_requirements.js` — table vide (seed manuel à prévoir)
- `36_char_sheet.js` — 5 tables dynamiques (char_sheet, char_identity, char_archetype, char_attributes, char_skills)
- Batch 13 — 4 migrations — SR OK

### Routes API produites et validées ✅
- `server/src/routes/character/char-sheet.js` — 7 routes
- `server/src/index.js` — 2 lignes ajoutées (import + montage)
- SR OK

### Règle générale actée
Toujours privilégier le robuste au rapide. Pas de solution rapide, pas de rework.

### Prochaine étape
Composant React — `client/src/character/` — fiche personnage V1.
Périmètre : Modules 1+2+3+4 (identité, archétype, attributs, attributs secondaires).
Module 5 (compétences) après validation des modules précédents.

---

## Session 9C — 2026-04-19 — Chantier Entités V1

### Contexte
Suite directe de 9B. Objectif : implémenter le système d'entités interactables (portes, coffres, interrupteurs, etc.) de bout en bout — DB, serveur, WebSocket, client.

### Décisions d'architecture

**Blueprint / Instance pattern**
Deux tables séparées : `entity_blueprints` (modèle réutilisable) et `entities` (instance posée sur une battlemap).
Modifier un blueprint n'affecte pas rétroactivement les instances existantes — cohérence avec le pattern `voxel_textures`.
`deprecated` sur blueprint (pas ON DELETE RESTRICT) — même pattern que voxel_textures.

**Geometry JSONB**
`entity_blueprints.geometry` stocke `{ width, height, depth, faces: { east, west, top, bottom, south, north } }`.
Les faces référencent des `voxel_textures.id` (integer) — réutilisation du système de textures existant.
PE14 actif : `pos_y` en base = Z Three.js (profondeur), `pos_z` en base = Y Three.js (altitude).

**States JSONB**
`entity_blueprints.states` = tableau d'états `[{ id, name, visual_override: { face_overrides, opacity } }]`.
`entities.current_state_id` = index dans ce tableau. Fallback states[0] si index invalide (PE11).

**Interactions JSONB**
`entity_blueprints.interactions` = tableau `[{ id, action_label, skill_id, difficulty_dc, required_state_ids[], target_state_id }]`.
`entities.interaction_overrides` = `{ [interactionId]: { difficulty_dc?, skill_id? } }` — override par instance.
`entities.disabled_interactions` = tableau d'IDs désactivés sur l'instance.

**Flux réseau actions entités**
4 étapes : REQUEST (joueur → serveur) → PENDING (serveur → GM) → RESOLVE (GM → serveur) → RESULT (serveur → joueur).
Timeout 60s côté serveur — refus automatique si GM ne répond pas (PE12).
`skillTotal` calculé côté client, jamais recalculé serveur (PE1).
`pendingEntityActions` Map déclarée hors `initSocket` — une seule instance partagée.

**Onglet Actions GM dans Sidebar**
Remplace toute popup modale. Badge rouge compteur sur l'onglet. Navigation dans la file (‹ ›).
Panneau arbitrage : compétence, score joueur, difficulté modifiable, modificateur GM.
Boutons : Accepter (jet 2D10) / Réussite auto / Refuser.

**Canvas unique en mode édition**
`EntityEditorScene` intégrée dans `Editor3D.jsx` — pas de composant Canvas séparé.
`Editor3D` reçoit `activeEditorTab` en prop et route vers `EditorScene` ou `EntityEditorScene` dans le même Canvas R3F.
Évite le double contexte WebGL lors du switch d'onglets éditeur.

**Bug WebGL context lost documenté**
`THREE.WebGLRenderer: Context Lost` au switch `Canvas3D` ↔ `Editor3D` (mode play ↔ mode edit).
Cause : Three.js r160+ + drivers GPU Windows — deux contextes WebGL en transition simultanée.
Mitigation tentée : délai 300ms + loading screen logo. Non résolu — warning non bloquant, éditeur fonctionnel.
Décision : documenté, abandonné. L'éditeur et le canvas fonctionnent correctement après le warning.

### Fichiers produits

**shared/**
- `events.js` — 8 constantes ENTITY_* ajoutées

**server/src/db/migrations/**
- `41_entity_blueprints.js` — table entity_blueprints (migrations batch 15, appliquées)
- `42_entities.js` — table entities (migrations batch 15, appliquées)

**server/src/routes/**
- `entity-blueprints.js` — CRUD blueprints (GET /, GET /all, GET /:id, POST /, PUT /:id, DELETE /:id)
- `entities.js` — CRUD instances (GET /, POST /, PUT /:entityId, DELETE /:entityId) — mergeParams

**server/src/index.js** — imports + montages entity-blueprints et entities ajoutés

**server/src/socket/index.js**
- `socket.data.role = member.role` dans SESSION_JOIN (ciblage GM via fetchSockets)
- `pendingEntityActions` Map hors initSocket
- Handlers : ENTITY_ACTION_REQUEST, ENTITY_ACTION_RESOLVE, ENTITY_CREATED, ENTITY_DELETED, ENTITY_MOVED
- Helper `resolveEntityState()` après fermeture initSocket

**client/src/stores/entityStore.js** — Zustand : entities[], blueprints{}, setEntities/addEntity/removeEntity/updateEntity/upsertBlueprint

**client/src/components/EntityMesh.jsx** — composant partagé Canvas3D + Editor3D. Branches GLB (useGLTF) et voxel. Liseré BackSide cyan (Alt), overlay violet wireframe (gm_only). HoverIcon Html flottante au survol. PE11/PE14/PE4 respectés.

**client/src/components/EntityEditor.jsx** — composant autonome (non utilisé en production — remplacé par intégration dans Editor3D)

**client/src/components/Editor3D.jsx** — MODIFIÉ : imports EntityMesh + useEntityStore, GhostEntity + EntityEditorScene insérés, prop activeEditorTab ajoutée, Canvas unique route vers EntityEditorScene ou EditorScene selon onglet actif.

**client/src/components/Canvas3D.jsx** — MODIFIÉ : imports EntityMesh + useEntityStore, state altPressed (keydown/keyup Alt — e.code), chargement textures étendu aux entités, rendu EntityMesh dans Scene, handlers WS ENTITY_CREATED/DELETED/UPDATED/MOVED, prop onEntityClick.

**client/src/components/Sidebar.jsx** — MODIFIÉ : props activeEditorTab/onEditorTabChange/entityActionQueue/onEntityActionResolve, onglets Voxels/Entités en mode édition, onglet Actions GM avec badge rouge et panneau arbitrage complet.

**client/src/pages/SessionPage.jsx** — MODIFIÉ : import useEntityStore, état activeEditorTab + entityActionQueue + entityPanel + canvasVisible + handleModeChange (délai 300ms), loadSession + loadMap + MAP_SWITCH étendus aux entités, handlers WS ENTITY_ACTION_PENDING + ENTITY_ACTION_RESULT, handleEntityClick, handleEntityActionResolve, panneau flottant entité joueur.

### État fonctionnel
- SR serveur OK, nodemon clean
- Onglets Voxels/Entités présents et cliquables
- Mode entités affiche la scène 3D sans crash d'onglets
- Warning WebGL context lost au switch play/edit — non bloquant, éditeur fonctionnel
- Système entités non testable en l'état : aucun blueprint créable depuis l'UI

### Prochaine étape
**Chantier 9D — Blueprint Editor** : page Dashboard pour créer/modifier les blueprints d'entités. Clone de TexturePacksPage. Prérequis au test fonctionnel du système entités.

### Pièges actifs nouveaux

| Code | Description |
|---|---|
| PE1 | skillTotal calculé client — serveur ne recalcule jamais |
| PE2 | socket.data.role requis pour fetchSockets() ciblage GM |
| PE4 | face null = face invisible — guard avant accès matériaux |
| PE11 | fallback states[0] si current_state_id invalide |
| PE12 | timeout 60s pendingEntityActions — clearTimeout à la résolution |
| PE13 | touche R = rotation ghost ou entité sous curseur selon mousePosRef |
| PE14 | pos_y base = Z Three.js (profondeur), pos_z base = Y Three.js (altitude) |
| PE16 | e.code obligatoire pour Alt (AltLeft/AltRight) — invariant AZERTY/QWERTY |
## Session 33 — 2026-04-21

### Contexte de reprise
Suite du chantier 9C. Objectif : créer l'interface de création des blueprints (chantier 9D rebaptisé "Atelier du GM") et connecter le rendu entités en session.

### Décisions prises

**Atelier du GM — WorkshopPage remplace TexturePacksPage**
Route `/workshop` + redirect `/texture-packs → /workshop`.
Trois onglets dans l'ordre : Textures → Matériaux → Éléments interactifs.
Composants séparés : VoxelBuilderTab + EntityBuilderTab dans `client/src/components/`.

**Workflow GM final**
`Texture PNG → CHOIX : Matériau (voxel) OU Élément interactif`.
Les deux partent du même PNG brut. Aucune dépendance entre eux.
Un élément interactif n'hérite pas d'un matériau — il utilise directement les PNG.

**Format geometry.faces — chemins PNG strings**
`entity_blueprints.geometry.faces` = `{ east: "uuid.png", north: "uuid2.png" }`.
Même format que `voxel_textures.faces`. Plus d'integers voxel_texture_id.
Pack_id obligatoire sur blueprint pour construire l'URL (PEF1).

**entityTextureMaterials séparé de textureMaterials**
Canvas3D maintient deux dictionnaires :
- `textureMaterials` — voxels, indexé par voxel_texture_id integer
- `entityTextureMaterials` — entités, indexé par blueprint.id UUID
  Structure : `{ [bp.id]: { base: { faceMaterials }, states: { [stateId]: { faceMaterials } } } }`

**Face_overrides des états — chargement complet**
Pour chaque état avec face_overrides, un fakeTexObj fusionné est chargé.
EntityMeshVoxel choisit le jeu de matériaux selon l'état courant avec fallback sur base.

**Dimensions entités — width/height/depth libres**
Décision 1×1×1 annulée. Les entités ont des dimensions configurables.
`geometry.width/height/depth` stockés en JSONB — aucune migration.

**Upload GLB blueprints**
Route `POST /api/entity-blueprints/:id/upload-glb` — même pattern que characters.
MinIO : `glb/<blueprint_id>.glb`. Cache busting P19.

**Compétence skill_id — menu déroulant**
Chargé depuis `GET /api/char-ref/skills`. Affiche le label, stocke l'id.

**Migration 43**
`entity_blueprints.pack_id` UUID nullable FK → texture_packs.id.
`voxel_textures.usage_hint` TEXT nullable — hint de tri, jamais exclusif (PE17).

### Pièges actifs nouveaux

| Code | Description |
|---|---|
| PE17 | usage_hint = hint de tri, jamais exclusif — "Voir tout" toujours disponible |
| PE18 | blueprint.pack_id nullable — guard avant tout accès |
| PEF1 | pack_id obligatoire sur blueprint pour charger les textures |
| PEF2 | fakeTexObj conforme : { id, pack_id, faces } — faces = chemins PNG |
| PEF3 | entityTextureMaterials indexé par blueprint.id UUID |
| PEF4 | face_overrides états = même format chemin PNG |
| PEF5 | Blueprints sans pack_id → skip chargement textures, rendu magenta |
| PEF6 | Canvas3D : deux zones de chargement séparées voxels / entités |

### Fichiers produits

**Client**
- `client/src/pages/WorkshopPage.jsx` — shell Atelier du GM
- `client/src/components/VoxelBuilderTab.jsx` — onglet Matériaux
- `client/src/components/EntityBuilderTab.jsx` — onglet Éléments interactifs (refonte complète)
- `client/src/App.jsx` — route /workshop + redirect /texture-packs
- `client/src/pages/DashboardPage.jsx` — lien "Atelier du GM"
- `client/src/components/Canvas3D.jsx` — entityTextureMaterials séparé, chargement fakeTexObjs
- `client/src/components/EntityMesh.jsx` — prop entityTextureMaterials, accès par blueprint.id

**Serveur**
- `server/src/routes/entity-blueprints.js` — route POST /:id/upload-glb ajoutée
- `server/src/routes/voxel-textures.js` — usage_hint exposé dans GET et PUT
- `server/migrations/43_entity_pack_hint.js` — appliquée batch 16

### État fonctionnel
- SR serveur OK, nodemon clean tout au long de la session
- WorkshopPage accessible via /workshop, onglets fonctionnels
- Création blueprints OK depuis l'Atelier
- Upload GLB blueprint OK
- Menu déroulant skills OK
- Canvas3D charge les textures entités via fakeTexObjs

### Bug identifié — non corrigé
**Blueprints non visibles dans palette éditeur Sidebar.**
Créés dans l'Atelier mais n'apparaissent pas dans l'onglet Entités de l'éditeur.
Cause probable : entityStore ou Sidebar ne rechargent pas après création via WorkshopPage.
Priorité 1 prochaine session.

### Documents produits
- `PLAN_ENTITY_FACES.md` — plan complet refonte faces entités (disponible en outputs)
- `Entité_v4.md` — référence de conception mise à jour
- `EN_COURS.md` — mis à jour
- `ROADMAP.md` — mis à jour
## Session 34 — 2026-04-22

### Contexte de reprise
Suite du chantier 9E. Objectif : corriger le bug blueprints non visibles dans la palette éditeur, puis tester le système d'interactions entités de bout en bout.

### Travaux effectués et confirmés fonctionnels

**Bug 9D — Blueprints visibles dans palette éditeur ✅**
Cause : `entityStore.js` ne rechargait pas les blueprints après création depuis WorkshopPage. Le store était chargé uniquement au SESSION_JOIN.
Fix : ajout de `fetchBlueprints()` dans `entityStore.js` + appel dans `SessionPage.jsx` au montage + props `activeBlueprint`/`onBlueprintSelect` vers Sidebar et Editor3D.
Fichiers modifiés : `entityStore.js`, `SessionPage.jsx`, `Sidebar.jsx`.

**Pose entités depuis éditeur ✅**
`Editor3D.jsx` : `calcEntityPos` (raycasting voxels en priorité), mousedown gauche, `addEntity` après POST, `entityTextureMaterials` chargé, `removeEntity` sur Delete, `activeBlueprint` passé à `EntityEditorScene`.

**Contrôles éditeur ✅**
Pan clavier proportionnel hauteur caméra (`useFrame` + `keysPressed` Set, `PAN_FACTOR=0.8`).
Clic droit court = suppression voxel, drag droit = caméra (pattern `rightDownRef`, seuil 4px).

**Icône ⚙ — clignotement corrigé ✅**
Cause : `<Html>` drei avec `pointerEvents: 'auto'` sur le conteneur capturait les events pointer → boucle `onPointerEnter`/`onPointerLeave`.
Fix : `pointerEvents: 'none'` sur conteneur `<Html>`, `pointerEvents: 'auto'` sur le div interne uniquement.
Fichier modifié : `EntityMesh.jsx`.

**Icône ⚙ — cliquable ✅**
`pointer-events: none` CSS est une propriété héritée. L'enfant doit explicitement déclarer `pointerEvents: 'auto'` pour se réactiver. Fix : ajout de cette propriété sur le div interne de `HoverIcon`.
Fichier modifié : `EntityMesh.jsx`.

**Timer 400ms sur disparition ⚙ ✅**
Pattern `leaveTimerRef` : `onPointerEnter` annule le timer, `onPointerLeave` déclenche `setHovered(false)` après 400ms. Appliqué dans `EntityMeshVoxel` et `EntityMeshGlb`.
Fichier modifié : `EntityMesh.jsx`.

**Hitbox ×1.4 en X et Z ✅**
Hitbox invisible élargie pour faciliter le ciblage à angle rasant.
Fichier modifié : `EntityMesh.jsx`.

**RadialMenu ✅**
Nouveau composant `client/src/components/RadialMenu.jsx`. SVG fixed, tranches égales, animation open/close, hover, tranche GM "Modifier" en violet. Fermeture clic extérieur + Échap + bouton centre.

**EntityInstancePanel ✅**
Nouveau composant `client/src/components/EntityInstancePanel.jsx`. Champs : `label_override`, `gm_only` toggle, interactions actives/désactivées, `notes_gm`. Header draggable (pattern `dragRef` mousedown/mousemove/mouseup sur window).

**Textures entités — pack_id manquant ✅**
Cause racine : `GET /battlemaps/:id/entities` (route `entities.js`) ne sélectionnait pas `entity_blueprints.pack_id` dans le JOIN. Le blueprint embarqué retourné avait `pack_id: undefined`. Canvas3D et Editor3D ne pouvaient pas construire les URLs de textures → fallback magenta.
Fix : ajout de `'entity_blueprints.pack_id as bp_pack_id'` dans le SELECT, `bp_pack_id` dans le destructuring, `pack_id: bp_pack_id` dans l'objet blueprint. Même correction dans `socket/index.js` handler `ENTITY_CREATED` qui faisait le même JOIN manuel.
Fichiers modifiés : `server/src/routes/entities.js`, `server/src/socket/index.js`.

**Stabilisation useEffect textures Canvas3D ✅**
Cause : `entities` comme dépendance React dans le `useEffect` de chargement des textures. Chaque mise à jour WS (`ENTITY_MOVED`, `ENTITY_UPDATED`, etc.) recrée le tableau `entities` (référence Zustand), redéclenchant le `useEffect` → `setBlocksReady(false)` → flash/disparition textures.
Fix : remplacer `entities` par `blueprintIds` (chaîne stable des IDs de blueprints uniques triés) dans les dépendances. Le corps du `useEffect` accède toujours à `entities` en closure.
Fichier modifié : `client/src/components/Canvas3D.jsx`.

**Ordre déclaration React — P4 ✅**
`handleEntityAction` déclaré avant `handleEntityClick` dans SessionPage. `handleEntityAction` ajouté dans les dépendances de `handleEntityClick`. Sans cet ordre, `handleEntityClick` capturait une stale closure de `handleEntityAction` avec `socket = null`.
Fichier modifié : `client/src/pages/SessionPage.jsx`.

**Flux joueur → interactions ✅ (partiel)**
Flux joueur → `ENTITY_ACTION_REQUEST` → notification GM dans le chat → arbitrage Sidebar → `ENTITY_ACTION_RESOLVE` → `resolveEntityState` → changement d'état : fonctionne sur une porte sur deux (voir bugs ouverts).

### Bugs identifiés et non corrigés

**Bug S34-1 — Changement d'état non visible sans F5**
Symptôme : après une interaction réussie, `current_state_id` est bien mis à jour en base (confirmé), `ENTITY_UPDATED` est émis par le serveur, mais l'entité ne change pas d'apparence visuellement sans rechargement F5. Fonctionne sur une instance sur deux avec le même blueprint.
Cause suspectée : `entityTextureMaterials` dans Canvas3D est indexé par `blueprint.id`. Les matériaux pour tous les états sont chargés au montage. `EntityMesh` lit `entity.current_state_id` depuis le store pour choisir le bon jeu de matériaux. Si `updateEntity` met bien à jour `current_state_id` dans le store, `EntityMesh` devrait réagir. La cause exacte n'est pas encore identifiée — nécessite investigation dans `updateEntity` (store) et le handler `ENTITY_UPDATED` dans Canvas3D.
Fichiers à investiguer : `client/src/stores/entityStore.js`, `client/src/components/Canvas3D.jsx` handler `handleEntityUpdated`, `client/src/components/EntityMesh.jsx` résolution `currentState`.

**Bug S34-2 — Jet de dés lancé sans compétence sélectionnée**
Symptôme : après arbitrage, un jet `null (2d10) vs DC1` est affiché dans le chat même quand aucune compétence n'est assignée à l'interaction (`skill_id: null`).
Cause : dans `socket/index.js` handler `ENTITY_ACTION_RESOLVE`, la branche jet de dés ne vérifie pas si `pending.skillId` est null/vide avant de lancer le jet.
Correction à faire : guard `if (!pending.skillId) { resolveEntityState(...); return }` avant la branche jet.
Fichier à modifier : `server/src/socket/index.js`.

**Bug S34-3 — Formule de jet incorrecte : 2d10 au lieu de 1d20**
Symptôme : le jet affiché utilise 2d10 au lieu de 1d20. Le système de jeu Polaris utilise 1d20.
Cause : formule codée en dur dans `socket/index.js` handler `ENTITY_ACTION_RESOLVE`.
Fichier à modifier : `server/src/socket/index.js`.

**Bug S34-4 — GM auto-approve non implémenté**
Symptôme : quand le GM clique sur une interaction d'entité, rien ne se passe (radial ne s'ouvre pas ou action non exécutée).
Décision prise : quand le GM fait une action, elle doit être exécutée directement sans passer par le flux d'arbitrage, sans être tracée.
Cause du "radial ne s'ouvre pas" : non identifiée — probablement liée à la taille de la fenêtre (menu radial positionné hors écran quand la console F12 est ouverte).
Architecture à définir : soit un event WS dédié `ENTITY_ACTION_GM_DIRECT`, soit appel REST direct `PUT /entities/:id` avec `current_state_id` + broadcast WS depuis la route.
Note : `PUT /entities/:entityId` dans `entities.js` n'émet pas de WS — il faudrait soit y ajouter le broadcast, soit passer par un event WS dédié.
Fichiers concernés : `client/src/pages/SessionPage.jsx`, `server/src/routes/entities.js` ou `server/src/socket/index.js`.

**Bug S34-5 — Notifications interactions dans le chat**
Symptôme : les notifications d'actions en attente sont affichées dans un onglet "Actions" de la Sidebar — format non ergonomique.
Décision prise : les notifications doivent apparaître dans le fil chat (message système). Le bouton onglet "Chat" doit changer de couleur quand une notification non lue est présente.
Fichiers concernés : `client/src/pages/SessionPage.jsx` (handler `ENTITY_ACTION_PENDING`), `client/src/components/Sidebar.jsx` (style onglet Chat).

**Bug S34-6 — Détection ⚙ toujours difficile**
Symptôme : malgré hitbox ×1.4 et timer 400ms, l'icône ⚙ est très difficile à atteindre à angle rasant. La détection cesse parfois de fonctionner pendant plusieurs minutes sans raison apparente.
Cause de l'arrêt intermittent : non identifiée.
Cause de la difficulté à angle rasant : l'icône apparaît au-dessus de l'entité (`height/2 + 0.4`). Quand le curseur monte vers l'icône, il sort de la hitbox de l'entité avant d'atteindre l'icône. Le timer 400ms aide mais ne suffit pas si la distance entre le bord de la hitbox et l'icône est grande.
Piste : augmenter le timer à 600-800ms, ou rendre l'icône elle-même une zone de détection supplémentaire.

### Décisions prises cette session

**Interactions sans compétence → pas de jet**
Si `skill_id` est null ou vide, l'action réussit automatiquement sans jet de dés. Le serveur appelle directement `resolveEntityState` sans passer par la branche jet.

**Formule de jet : 1d20**
Le système Polaris utilise 1d20, pas 2d10. La formule dans `socket/index.js` doit être corrigée.

**GM auto-approve : exécution directe sans traçage**
Quand le GM déclenche une interaction sur une entité, l'état change immédiatement. Aucune entrée dans le chat, aucun arbitrage.

**Notifications : chat + couleur onglet**
Les notifications d'interactions en attente passent dans le fil chat (message système). Le bouton onglet "Chat" change de couleur (ex: orange) tant que des notifications non lues sont présentes.

### Piège documenté

**P47 — pack_id absent du JOIN entities GET**
`GET /battlemaps/:id/entities` retournait un blueprint embarqué sans `pack_id`.
`pack_id` doit être explicitement sélectionné dans le JOIN : `'entity_blueprints.pack_id as bp_pack_id'`, extrait dans le destructuring, et ajouté dans l'objet blueprint retourné.
Même règle pour tout handler socket qui fait le même JOIN manuel (ex: `ENTITY_CREATED`).

**P48 — handleEntityAction doit être déclaré avant handleEntityClick (P4)**
`handleEntityClick` appelle `handleEntityAction` et doit l'avoir dans ses dépendances.
Si `handleEntityAction` est déclaré après `handleEntityClick`, la stale closure capture `socket = null` au premier render.
Ordre obligatoire : `handleEntityAction` → `handleEntityClick`.

### Fichiers modifiés cette session

| Fichier | Modifications |
|---|---|
| `client/src/components/EntityMesh.jsx` | Timer 400ms leaveTimerRef, hitbox ×1.4, `pointerEvents: 'none'` Html + `pointerEvents: 'auto'` div interne HoverIcon |
| `client/src/components/Canvas3D.jsx` | `blueprintIds` remplace `entities` dans deps useEffect textures |
| `client/src/pages/SessionPage.jsx` | `handleEntityAction` déclaré avant `handleEntityClick`, ajouté dans ses deps, fallback character, `WS.ENTITY_ACTION_REQUEST` |
| `client/src/components/RadialMenu.jsx` | Nouveau — menu radial SVG |
| `client/src/components/EntityInstancePanel.jsx` | Nouveau — panneau config instance GM, header draggable |
| `server/src/routes/entities.js` | `pack_id` ajouté dans SELECT JOIN et objet blueprint retourné |
| `server/src/socket/index.js` | `pack_id` ajouté dans SELECT JOIN et objet blueprint dans ENTITY_CREATED |

### Validation fonctionnelle

- ✅ Blueprints visibles dans palette éditeur
- ✅ Textures entités affichées (fix pack_id)
- ✅ Icône ⚙ cliquable et stable (timer 400ms, pointerEvents)
- ✅ Flux joueur → interaction → arbitrage GM → changement d'état (partiel — une porte sur deux)
- ✅ Notifications dans le chat (côté joueur)
- ❌ Changement d'état visible sans F5 (Bug S34-1)
- ❌ Jet sans compétence (Bug S34-2)
- ❌ Formule 1d20 (Bug S34-3)
- ❌ GM auto-approve (Bug S34-4)
- ❌ Notifications chat + couleur onglet (Bug S34-5)
- ❌ Détection ⚙ robuste (Bug S34-6)