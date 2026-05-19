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
---

## Session 36 — 2026-04-28

### Contexte
Reprise après session 34. Chantier 9F-0 + corrections flux interactions entités.

### Travail effectué

**`server/src/lib/charStats.js` — NOUVEAU ✅**
Bibliothèque de calcul pure (aucun accès DB) — source de vérité mécanique serveur.
- Tables : AN_TABLE (LdB p.114), MOD_DOM_TABLE (p.113), RD_TABLE (p.114), RES_NAT_TABLE (p.114), DIFFICULTY_MOD_TABLE (p.404)
- Tables qualitatives documentées non utilisées en V1 : ATTR_LEVEL_LABELS, MASTERY_LEVEL_LABELS, SKILL_LEVEL_LABELS
- ATTR_LABELS : labels complets attributs (LdB p.112-113)
- ATTR_DESCRIPTIONS : descriptions complètes pour tooltips futurs
- Fonctions : calcNA, calcAN, calcAttributeAN, calcAttributeNA, getGenotypeModForAttr
- calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow) — Base + mastery (PC4 attr_2=null)
- getModDom, calcREA, calcSeuils, calcVitesses, calcResistanceDommages, calcResistanceNaturelle, calcResistanceDroguesInput, calcSouffle
- Coût XP : getCoutAugmentation, getCoutDeblocageX, getCoutTotal (ajoutés par chantier Character parallèle)

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import charStats.js (calcSkillTotal, calcAttributeAN, getGenotypeModForAttr, ATTR_LABELS)
- PE1 supprimé — commentaire mis à jour
- ENTITY_ACTION_REQUEST : characterId et attributeId ajoutés dans pendingEntityActions Map
- ENTITY_ACTION_REQUEST : guard résolution directe sans GM si !skill_id && !attribute_id → resolveEntityState direct
- ENTITY_ACTION_RESOLVE : 4 requêtes DB en Promise.all (char_attributes, char_archetype, char_skills, ref_skills) + ref_genotypes séquentiel après archetype
- ENTITY_ACTION_RESOLVE : calcSkillTotal ou calcAttributeAN selon branche skillId/attributeId
- Formule Polaris correcte : chancesDeReussite = mechanicalTotal + difficulty_dc + gmModifier / isSuccess = diceRoll <= chancesDeReussite (LdB p.404)
- Label chat : `"${formulaLabel} [${mechanicalTotal}] — Chances : ${chancesDeReussite} (Dif.${diffLabel})"`
- DICE_RESULT : champs structurés ajoutés (skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess)
- Fallback mechanicalTotal=0 si char_sheet introuvable — log warning

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- skillTotal retiré du payload ENTITY_ACTION_REQUEST (serveur calcule)
- attributeId: interaction.attribute_id || null ajouté au payload
- Handler DICE_RESULT : champs structurés ajoutés au destructuring + transmis à addMessage
- handleEntityActionResolve : setEntityActionQueue supprimé (ReferenceError — variable inexistante)

**`client/src/components/Sidebar.jsx` — MODIFIÉ ✅**
- Panel GM : skillTotal retiré (non disponible avant arbitrage)
- Rendu dice : branche entity_action séparée si msg.skillLabel !== undefined
  - Format : nom compétence + résultat dé en grand + détail (compétence/dif/seuil) + badge SUCCÈS/ÉCHEC
  - Fond coloré vert (succès) ou rouge (échec)
- Jets normaux inchangés

**`client/src/components/EntityInstancePanel.jsx` — MODIFIÉ ✅**
- Sélecteur "État actuel" ajouté (select depuis blueprint.states)
- Guard : affiché uniquement si blueprint.states.length > 1
- current_state_id envoyé dans PUT /entities/:id + updateEntity store
- PANEL_H_EST : 360 → 420

**`client/src/character/EntityBuilderTab.jsx` — MODIFIÉ ✅**
- Label "Difficulté (DC)" → "Modificateur de difficulté"
- Hint ajouté : "+5 Facile · 0 Moyen · -5 Difficile"
- Valeur par défaut difficulty_dc : 10 → 0

**`client/src/locales/fr/translation.json` — MODIFIÉ ✅**
- entityActionDetail, entityActionSuccess, entityActionFail ajoutés dans section sidebar

### Règles mécaniques Polaris confirmées (LdB p.404)
```
Chances de réussite = skillTotal + difficulty_dc + gmModifier
Jet 1d20 ≤ chances → SUCCÈS
Jet 1d20 > chances → ÉCHEC
difficulty_dc = modificateur signé (-20 à +10)
gmModifier = ajustement GM au moment arbitrage, défaut 0
```

### Pièges documentés

**PE1 — SUPPRIMÉ**
Le serveur calcule via charStats.js. Client calcule pour affichage uniquement.

### Validation fonctionnelle
- ✅ charStats.js — calculs Polaris serveur corrects
- ✅ Formule jet correcte (dé ≤ seuil)
- ✅ Affichage structuré jet entity_action dans chat
- ✅ Sélecteur état actuel EntityInstancePanel
- ✅ Guard résolution directe sans compétence (sans notif GM)
- ✅ crash setEntityActionQueue corrigé
- ✅ EntityBuilderTab — label difficulté + valeur par défaut
- ✅ Jets normaux inchangés

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/lib/charStats.js` | NOUVEAU — calculs Polaris purs |
| `server/src/socket/index.js` | charStats import, calcul serveur, formule Polaris, champs structurés DICE_RESULT |
| `client/src/pages/SessionPage.jsx` | payload corrigé, DICE_RESULT structuré, crash setEntityActionQueue |
| `client/src/components/Sidebar.jsx` | rendu entity_action structuré, panel GM nettoyé |
| `client/src/components/EntityInstancePanel.jsx` | sélecteur état actuel |
| `client/src/character/EntityBuilderTab.jsx` | label difficulté, valeur défaut |
| `client/src/locales/fr/translation.json` | 3 clés entity_action |
---

## Session 39 — 2026-04-28

### Contexte
Chantier 9F-A — Fondations mouvement. Prérequis : 9F-0 validé session 36.

### Travail préparatoire (long — intentionnel)
Analyse exhaustive avant tout code : inventaire complet des mutations de position, décisions d'architecture collision map Redis, identification de tous les cas edge (token layer GM, entités is_blocking, SESSION_JOIN sans player_location, changement layer token, resolveEntityState).

Décisions d'architecture actées :
- Cache-aside Redis (pattern pro) — DB source de vérité, Redis accélérateur O(1)
- Pas de dénormalisation `is_blocking` sur `entities` — JOIN blueprint au SESSION_JOIN (O(n) acceptable, appel rare)
- Pipeline Redis dans `buildCollisionMap` — O(1) réseau au lieu de O(n)
- Maintenance Redis dans les routes REST (DELETE tokens/entities) — position disponible avant suppression
- Handlers WS TOKEN_DELETED / ENTITY_DELETED ne touchent pas Redis — évite double-traitement
- `collisionMoveToken` : hdel systématique sur ancienne case, hset conditionnel (layer != 'gm')

### Travail effectué

**`shared/events.js` — MODIFIÉ ✅**
- `TOKEN_ROTATE: 'token:rotate'` ajouté

**`server/src/lib/redis.js` — NOUVEAU ✅**
- Client ioredis singleton — `REDIS_URL` depuis `.env`
- `buildCollisionMap(battlemapId)` — pipeline Redis, filtre layer 'gm', JOIN blueprint pour is_blocking (PE11)
- `isCaseOccupied(battlemapId, x, y, z, excludeIds)` — O(1), tunnel de swap PE22
- Helpers maintenance : `collisionAddToken`, `collisionRemoveToken`, `collisionMoveToken`
- Helpers maintenance : `collisionAddEntity`, `collisionRemoveEntity`, `collisionMoveEntity`, `collisionUpdateEntityState`
- Helpers maintenance : `collisionAddVoxel`, `collisionRemoveVoxel`

**`server/src/db/migrations/44_tokens_rotation.js` — NOUVEAU ✅**
- Colonne `r INTEGER NOT NULL DEFAULT 0` sur `tokens`

**`server/src/db/migrations/45_polaris_mr_table.js` — NOUVEAU ✅**
- Table `polaris_mr` (mr_min PK, mr_max nullable, dmax) + seed 6 lignes

**`server/src/routes/tokens.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddToken` après INSERT
- `PUT /:id` : `collisionMoveToken` si position change
- `DELETE /:id` : `collisionRemoveToken` AVANT suppression

**`server/src/routes/entities.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddEntity` après INSERT (blueprint déjà chargé)
- `PUT /:entityId` : `collisionMoveEntity` si position change, `collisionUpdateEntityState` si état change
- `DELETE /:entityId` : `collisionRemoveEntity` AVANT suppression

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `SESSION_JOIN` : `buildCollisionMap` via `player_locations` — non bloquant si absent
- `TOKEN_MOVE` : `collisionMoveToken` après update DB
- `VOXEL_ADD` : `collisionAddVoxel`
- `VOXEL_REMOVE` : `collisionRemoveVoxel`
- `VOXEL_UPDATE` : pas de maintenance (position inchangée, seule rotation change)
- `TOKEN_CREATED` / `TOKEN_DELETED` : commentaires clarifiés — maintenance dans REST, pas ici
- `ENTITY_CREATED` / `ENTITY_DELETED` / `ENTITY_MOVED` : idem — maintenance dans REST
- Nouveau handler `TOKEN_ROTATE` : ownership check, `r = (r+1) % 8`, broadcast `TOKEN_UPDATED`
- `resolveEntityState` : `collisionUpdateEntityState` après update + `returning` étendu avec `battlemap_id`

**`client/src/components/Canvas3D.jsx` — MODIFIÉ ✅**
- Prop `onTokenRotate` ajoutée (Canvas3D + Scene)
- `rotation.y = (token.r ?? 0) * Math.PI / 4` sur `<group>` parent du TokenMesh (PE21)
- Tilt drag conservé sur `<primitive>` — indépendant de la rotation permanente
- `handlePointerUp` : clic court sur token propriétaire → `onTokenRotate?.(token.id)`
- `onTokenRotate` dans les deps de `handlePointerUp` (P3)

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- Handler `TOKEN_UPDATED` : `updateToken(token)` — merge partiel via store
- Callback `handleTokenRotate` : `socket?.emit(WS.TOKEN_ROTATE, { tokenId })` — `socket` dans deps (P3)
- Prop `onTokenRotate={handleTokenRotate}` sur `<Canvas3D>`

### Pièges documentés (nouveaux)

**PE24 — `collisionMoveToken` : hdel systématique sur ancienne case**
Si un token change de layer (ex: 'token' → 'gm'), il faut quand même retirer l'ancienne case Redis.
`hdel` systématique sur `oldToken` si `oldToken.layer !== 'gm'`.
`hset` conditionnel sur `newToken` si `newToken.layer !== 'gm'`.

**PE25 — maintenance Redis dans REST, pas dans les handlers WS reliques**
`TOKEN_CREATED` et `TOKEN_DELETED` WS sont des reliques — la maintenance collision map est dans les routes REST correspondantes. Ne pas doubler.
Même règle pour `ENTITY_CREATED`, `ENTITY_DELETED`, `ENTITY_MOVED`.

**PE26 — `resolveEntityState` : `returning` doit inclure `battlemap_id`**
`collisionUpdateEntityState` a besoin de `battlemap_id`. Le `.returning([...])` de `resolveEntityState` doit l'inclure explicitement — Knex ne retourne pas toutes les colonnes par défaut avec une liste.

### Dépendances installées
- `server/` : `ioredis` (9 packages, 0 vulnerabilities après `npm audit fix`)

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ `[Redis] Connecté` au démarrage
- ✅ `[Redis] Collision map reconstruite` au SESSION_JOIN
- ✅ Migrations 44 + 45 appliquées
- ✅ TOKEN_ROTATE fonctionnel — rotation token visible côté client

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `shared/events.js` | TOKEN_ROTATE ajouté |
| `server/src/lib/redis.js` | NOUVEAU — client + helpers collision map |
| `server/src/db/migrations/44_tokens_rotation.js` | NOUVEAU — colonne r tokens |
| `server/src/db/migrations/45_polaris_mr_table.js` | NOUVEAU — table polaris_mr + seed |
| `server/src/routes/tokens.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/routes/entities.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/socket/index.js` | buildCollisionMap SESSION_JOIN, TOKEN_ROTATE handler, maintenance voxels, resolveEntityState étendu |
| `client/src/components/Canvas3D.jsx` | rotation.y token r, onTokenRotate callback, prop |
| `client/src/pages/SessionPage.jsx` | TOKEN_UPDATED handler, handleTokenRotate, prop Canvas3D |
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
---

## Session 36 — 2026-04-28

### Contexte
Reprise après session 34. Chantier 9F-0 + corrections flux interactions entités.

### Travail effectué

**`server/src/lib/charStats.js` — NOUVEAU ✅**
Bibliothèque de calcul pure (aucun accès DB) — source de vérité mécanique serveur.
- Tables : AN_TABLE (LdB p.114), MOD_DOM_TABLE (p.113), RD_TABLE (p.114), RES_NAT_TABLE (p.114), DIFFICULTY_MOD_TABLE (p.404)
- Tables qualitatives documentées non utilisées en V1 : ATTR_LEVEL_LABELS, MASTERY_LEVEL_LABELS, SKILL_LEVEL_LABELS
- ATTR_LABELS : labels complets attributs (LdB p.112-113)
- ATTR_DESCRIPTIONS : descriptions complètes pour tooltips futurs
- Fonctions : calcNA, calcAN, calcAttributeAN, calcAttributeNA, getGenotypeModForAttr
- calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow) — Base + mastery (PC4 attr_2=null)
- getModDom, calcREA, calcSeuils, calcVitesses, calcResistanceDommages, calcResistanceNaturelle, calcResistanceDroguesInput, calcSouffle
- Coût XP : getCoutAugmentation, getCoutDeblocageX, getCoutTotal (ajoutés par chantier Character parallèle)

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import charStats.js (calcSkillTotal, calcAttributeAN, getGenotypeModForAttr, ATTR_LABELS)
- PE1 supprimé — commentaire mis à jour
- ENTITY_ACTION_REQUEST : characterId et attributeId ajoutés dans pendingEntityActions Map
- ENTITY_ACTION_REQUEST : guard résolution directe sans GM si !skill_id && !attribute_id → resolveEntityState direct
- ENTITY_ACTION_RESOLVE : 4 requêtes DB en Promise.all (char_attributes, char_archetype, char_skills, ref_skills) + ref_genotypes séquentiel après archetype
- ENTITY_ACTION_RESOLVE : calcSkillTotal ou calcAttributeAN selon branche skillId/attributeId
- Formule Polaris correcte : chancesDeReussite = mechanicalTotal + difficulty_dc + gmModifier / isSuccess = diceRoll <= chancesDeReussite (LdB p.404)
- Label chat : `"${formulaLabel} [${mechanicalTotal}] — Chances : ${chancesDeReussite} (Dif.${diffLabel})"`
- DICE_RESULT : champs structurés ajoutés (skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess)
- Fallback mechanicalTotal=0 si char_sheet introuvable — log warning

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- skillTotal retiré du payload ENTITY_ACTION_REQUEST (serveur calcule)
- attributeId: interaction.attribute_id || null ajouté au payload
- Handler DICE_RESULT : champs structurés ajoutés au destructuring + transmis à addMessage
- handleEntityActionResolve : setEntityActionQueue supprimé (ReferenceError — variable inexistante)

**`client/src/components/Sidebar.jsx` — MODIFIÉ ✅**
- Panel GM : skillTotal retiré (non disponible avant arbitrage)
- Rendu dice : branche entity_action séparée si msg.skillLabel !== undefined
  - Format : nom compétence + résultat dé en grand + détail (compétence/dif/seuil) + badge SUCCÈS/ÉCHEC
  - Fond coloré vert (succès) ou rouge (échec)
- Jets normaux inchangés

**`client/src/components/EntityInstancePanel.jsx` — MODIFIÉ ✅**
- Sélecteur "État actuel" ajouté (select depuis blueprint.states)
- Guard : affiché uniquement si blueprint.states.length > 1
- current_state_id envoyé dans PUT /entities/:id + updateEntity store
- PANEL_H_EST : 360 → 420

**`client/src/character/EntityBuilderTab.jsx` — MODIFIÉ ✅**
- Label "Difficulté (DC)" → "Modificateur de difficulté"
- Hint ajouté : "+5 Facile · 0 Moyen · -5 Difficile"
- Valeur par défaut difficulty_dc : 10 → 0

**`client/src/locales/fr/translation.json` — MODIFIÉ ✅**
- entityActionDetail, entityActionSuccess, entityActionFail ajoutés dans section sidebar

### Règles mécaniques Polaris confirmées (LdB p.404)
```
Chances de réussite = skillTotal + difficulty_dc + gmModifier
Jet 1d20 ≤ chances → SUCCÈS
Jet 1d20 > chances → ÉCHEC
difficulty_dc = modificateur signé (-20 à +10)
gmModifier = ajustement GM au moment arbitrage, défaut 0
```

### Pièges documentés

**PE1 — SUPPRIMÉ**
Le serveur calcule via charStats.js. Client calcule pour affichage uniquement.

### Validation fonctionnelle
- ✅ charStats.js — calculs Polaris serveur corrects
- ✅ Formule jet correcte (dé ≤ seuil)
- ✅ Affichage structuré jet entity_action dans chat
- ✅ Sélecteur état actuel EntityInstancePanel
- ✅ Guard résolution directe sans compétence (sans notif GM)
- ✅ crash setEntityActionQueue corrigé
- ✅ EntityBuilderTab — label difficulté + valeur par défaut
- ✅ Jets normaux inchangés

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/lib/charStats.js` | NOUVEAU — calculs Polaris purs |
| `server/src/socket/index.js` | charStats import, calcul serveur, formule Polaris, champs structurés DICE_RESULT |
| `client/src/pages/SessionPage.jsx` | payload corrigé, DICE_RESULT structuré, crash setEntityActionQueue |
| `client/src/components/Sidebar.jsx` | rendu entity_action structuré, panel GM nettoyé |
| `client/src/components/EntityInstancePanel.jsx` | sélecteur état actuel |
| `client/src/character/EntityBuilderTab.jsx` | label difficulté, valeur défaut |
| `client/src/locales/fr/translation.json` | 3 clés entity_action |
---

## Session 39 — 2026-04-28

### Contexte
Chantier 9F-A — Fondations mouvement. Prérequis : 9F-0 validé session 36.

### Travail préparatoire (long — intentionnel)
Analyse exhaustive avant tout code : inventaire complet des mutations de position, décisions d'architecture collision map Redis, identification de tous les cas edge (token layer GM, entités is_blocking, SESSION_JOIN sans player_location, changement layer token, resolveEntityState).

Décisions d'architecture actées :
- Cache-aside Redis (pattern pro) — DB source de vérité, Redis accélérateur O(1)
- Pas de dénormalisation `is_blocking` sur `entities` — JOIN blueprint au SESSION_JOIN (O(n) acceptable, appel rare)
- Pipeline Redis dans `buildCollisionMap` — O(1) réseau au lieu de O(n)
- Maintenance Redis dans les routes REST (DELETE tokens/entities) — position disponible avant suppression
- Handlers WS TOKEN_DELETED / ENTITY_DELETED ne touchent pas Redis — évite double-traitement
- `collisionMoveToken` : hdel systématique sur ancienne case, hset conditionnel (layer != 'gm')

### Travail effectué

**`shared/events.js` — MODIFIÉ ✅**
- `TOKEN_ROTATE: 'token:rotate'` ajouté

**`server/src/lib/redis.js` — NOUVEAU ✅**
- Client ioredis singleton — `REDIS_URL` depuis `.env`
- `buildCollisionMap(battlemapId)` — pipeline Redis, filtre layer 'gm', JOIN blueprint pour is_blocking (PE11)
- `isCaseOccupied(battlemapId, x, y, z, excludeIds)` — O(1), tunnel de swap PE22
- Helpers maintenance : `collisionAddToken`, `collisionRemoveToken`, `collisionMoveToken`
- Helpers maintenance : `collisionAddEntity`, `collisionRemoveEntity`, `collisionMoveEntity`, `collisionUpdateEntityState`
- Helpers maintenance : `collisionAddVoxel`, `collisionRemoveVoxel`

**`server/src/db/migrations/44_tokens_rotation.js` — NOUVEAU ✅**
- Colonne `r INTEGER NOT NULL DEFAULT 0` sur `tokens`

**`server/src/db/migrations/45_polaris_mr_table.js` — NOUVEAU ✅**
- Table `polaris_mr` (mr_min PK, mr_max nullable, dmax) + seed 6 lignes

**`server/src/routes/tokens.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddToken` après INSERT
- `PUT /:id` : `collisionMoveToken` si position change
- `DELETE /:id` : `collisionRemoveToken` AVANT suppression

**`server/src/routes/entities.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddEntity` après INSERT (blueprint déjà chargé)
- `PUT /:entityId` : `collisionMoveEntity` si position change, `collisionUpdateEntityState` si état change
- `DELETE /:entityId` : `collisionRemoveEntity` AVANT suppression

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `SESSION_JOIN` : `buildCollisionMap` via `player_locations` — non bloquant si absent
- `TOKEN_MOVE` : `collisionMoveToken` après update DB
- `VOXEL_ADD` : `collisionAddVoxel`
- `VOXEL_REMOVE` : `collisionRemoveVoxel`
- `VOXEL_UPDATE` : pas de maintenance (position inchangée, seule rotation change)
- `TOKEN_CREATED` / `TOKEN_DELETED` : commentaires clarifiés — maintenance dans REST, pas ici
- `ENTITY_CREATED` / `ENTITY_DELETED` / `ENTITY_MOVED` : idem — maintenance dans REST
- Nouveau handler `TOKEN_ROTATE` : ownership check, `r = (r+1) % 8`, broadcast `TOKEN_UPDATED`
- `resolveEntityState` : `collisionUpdateEntityState` après update + `returning` étendu avec `battlemap_id`

**`client/src/components/Canvas3D.jsx` — MODIFIÉ ✅**
- Prop `onTokenRotate` ajoutée (Canvas3D + Scene)
- `rotation.y = (token.r ?? 0) * Math.PI / 4` sur `<group>` parent du TokenMesh (PE21)
- Tilt drag conservé sur `<primitive>` — indépendant de la rotation permanente
- `handlePointerUp` : clic court sur token propriétaire → `onTokenRotate?.(token.id)`
- `onTokenRotate` dans les deps de `handlePointerUp` (P3)

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- Handler `TOKEN_UPDATED` : `updateToken(token)` — merge partiel via store
- Callback `handleTokenRotate` : `socket?.emit(WS.TOKEN_ROTATE, { tokenId })` — `socket` dans deps (P3)
- Prop `onTokenRotate={handleTokenRotate}` sur `<Canvas3D>`

### Pièges documentés (nouveaux)

**PE24 — `collisionMoveToken` : hdel systématique sur ancienne case**
Si un token change de layer (ex: 'token' → 'gm'), il faut quand même retirer l'ancienne case Redis.
`hdel` systématique sur `oldToken` si `oldToken.layer !== 'gm'`.
`hset` conditionnel sur `newToken` si `newToken.layer !== 'gm'`.

**PE25 — maintenance Redis dans REST, pas dans les handlers WS reliques**
`TOKEN_CREATED` et `TOKEN_DELETED` WS sont des reliques — la maintenance collision map est dans les routes REST correspondantes. Ne pas doubler.
Même règle pour `ENTITY_CREATED`, `ENTITY_DELETED`, `ENTITY_MOVED`.

**PE26 — `resolveEntityState` : `returning` doit inclure `battlemap_id`**
`collisionUpdateEntityState` a besoin de `battlemap_id`. Le `.returning([...])` de `resolveEntityState` doit l'inclure explicitement — Knex ne retourne pas toutes les colonnes par défaut avec une liste.

### Dépendances installées
- `server/` : `ioredis` (9 packages, 0 vulnerabilities après `npm audit fix`)

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ `[Redis] Connecté` au démarrage
- ✅ `[Redis] Collision map reconstruite` au SESSION_JOIN
- ✅ Migrations 44 + 45 appliquées
- ✅ TOKEN_ROTATE fonctionnel — rotation token visible côté client

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `shared/events.js` | TOKEN_ROTATE ajouté |
| `server/src/lib/redis.js` | NOUVEAU — client + helpers collision map |
| `server/src/db/migrations/44_tokens_rotation.js` | NOUVEAU — colonne r tokens |
| `server/src/db/migrations/45_polaris_mr_table.js` | NOUVEAU — table polaris_mr + seed |
| `server/src/routes/tokens.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/routes/entities.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/socket/index.js` | buildCollisionMap SESSION_JOIN, TOKEN_ROTATE handler, maintenance voxels, resolveEntityState étendu |
| `client/src/components/Canvas3D.jsx` | rotation.y token r, onTokenRotate callback, prop |
| `client/src/pages/SessionPage.jsx` | TOKEN_UPDATED handler, handleTokenRotate, prop Canvas3D |
---

## Session 40 — 2026-04-29

### Contexte
Chantier 9F-B1 — Déplacement entités orthogonal (serveur + atelier).
Prérequis : 9F-A ✅ session 39.

### Travail effectué

**`shared/events.js` — MODIFIÉ ✅**
- `ENTITY_MOVE_REQUEST: 'entity:move_request'` ajouté — joueur → serveur
- `ENTITY_MOVE_RESULT: 'entity:move_result'` ajouté — serveur → joueur

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import `calcAttributeNA` ajouté (charStats.js)
- Import `isCaseOccupied` ajouté (redis.js)
- Cache `MR_TABLE` + `getMrTable()` + `getDmax()` déclarés hors `initSocket`
- Handler `ENTITY_MOVE_REQUEST` complet :
  - Guards : campaignId, rôle GM rejeté, double-soumission via pendingEntityActions
  - Chargement : entity, blueprint, interaction (move_type vérifié), token acteur
  - Ownership token → character.user_id === socket.user.id
  - Distance Tchebychev 3D (inclut altitude pos_z)
  - Calcul direction : dPosX / dPosY (PE14 — destZ = pos_y base)
  - Guard orthogonalité + guard destination = position actuelle
  - Calcul actualMoveType par dot(AE, AD) — PE27
  - Validation cohérence moveType client vs actualMoveType serveur
  - Chargement stats character : char_sheet, attrs, archetype, genotype
  - calcAttributeNA(attrs, attributeId, genotypeRow) — source de vérité serveur
  - Jet 1d20 via parseDice
  - MR = attributeNA + diceRoll - effectiveDifficulty
  - getDmax(mrTable, mr) + dmax_override si défini
  - Broadcast DICE_RESULT vers room
  - Si dmax=0 → ENTITY_MOVE_RESULT { success: false } + return
  - Step-by-step : isCaseOccupied entity + acteur, excludeIds=[tokenId,entityId] (PE22)
  - Update DB entity + token (pos_x, pos_y — pos_z inchangé)
  - collisionMoveEntity + collisionMoveToken Redis
  - Broadcast ENTITY_MOVED + TOKEN_MOVED → room
  - ENTITY_MOVE_RESULT → socket.id uniquement

**`docs/PLAN_ENTITY.md` — MODIFIÉ ✅**
- §3 interactions : `move_type: 'push'/'pull'` → `move_type: 'displacement'` (interaction unique)
- `pull_dmax_override` → `dmax_override` (plafonne push ET pull)
- Décision UX figée : une seule interaction "Déplacer", push/pull déterminé par vecteurs
- §5 flux déplacement réécrit : ghost + feedback couleur temps réel (Option 4)
- §8 payload : tokenId ajouté, attributeTotal supprimé, moveType ajouté, convention destZ documentée
- §10 : dmax_override mis à jour
- §12 : PE27 ajouté
- Plan d'implémentation 9F-B : étapes 1-3 marquées ✅

**`client/src/components/EntityBuilderTab.jsx` — REFONTE ✅**
- `startEdit` : normalisation complète des interactions au chargement
  - Déduction `type` depuis `move_type` legacy (rétrocompatibilité)
  - Correction nullables : `null` → `''` pour éviter `value={null}` sur selects (warning React)
- `addInteraction` : default `type: 'skillcheck'`, structure propre
- `handleSave` : sérialisation séparée par type
  - Déplacement : `action_label: 'Déplacer'` forcé, `move_type: 'displacement'` (rétrocompat serveur)
  - SkillCheck : `move_type: null`, `dmax_override: null`
- Rendu interactions — refonte complète :
  - En-tête : select type (SkillCheck | Déplacement) en ligne, atomique via setForm
  - Champs SkillCheck : Label (pleine largeur), Compétence, Attribut, Difficulté, Portée, État cible
  - Champs Déplacement : Attribut lié (FOR défaut), Difficulté, Déplacement max, Portée
  - États depuis lesquels disponible : commun aux deux types
  - `id` technique en monospace en bas de chaque bloc

### Décisions UX figées (session 40)

**Interaction déplacement — une seule, pas deux**
Le GM configure une interaction "Déplacer" (`move_type: 'displacement'`).
Le client détermine push/pull en temps réel par dot(AE, AD) + feedback couleur.
Le serveur recalcule indépendamment et valide (PE27).

**UX mode visée — Option 4 (validée)**
Ghost semi-transparent snapé sur 4 axes. Feedback couleur temps réel :
- dot > 0 → ghost BLEU + "Pousser"
- dot < 0 → ghost ORANGE + "Tirer"
- dot = 0 → ghost ROUGE + "Impossible" (clic bloqué)
Implémentation : 9F-B2 (SessionPage + Canvas3D + RadialMenu).

### Pièges documentés (nouveaux)

**PE27 — moveType calculé client ET recalculé serveur**
Client envoie `moveType` dans le payload (feedback UX).
Serveur recalcule indépendamment via dot(AE, AD).
Si discordance → refus silencieux.
Jamais faire confiance au `moveType` client seul.

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ F12 : interaction `type: 'displacement'`, `move_type: 'displacement'`, `action_label: 'Déplacer'`, `attribute_id: 'FOR'`, `target_state_id: null` — sérialisé correctement
- ✅ Interactions SkillCheck legacy chargées sans warning React
- ✅ Select type SkillCheck / Déplacement — bascule atomique

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `shared/events.js` | ENTITY_MOVE_REQUEST + ENTITY_MOVE_RESULT ajoutés |
| `server/src/socket/index.js` | handler ENTITY_MOVE_REQUEST complet, cache MR_TABLE, import calcAttributeNA + isCaseOccupied |
| `docs/PLAN_ENTITY.md` | §3/5/8/10/12 mis à jour — décision UX Option 4, PE27, payload corrigé |
| `client/src/components/EntityBuilderTab.jsx` | refonte formulaire interactions — type SkillCheck/Déplacement, startEdit normalisé |

### Prochaine étape : 9F-B2
- `RadialMenu.jsx` — tranche "Déplacer" (grisée si hors portée)
- `SessionPage.jsx` — `handleEntityMove` + listener `ENTITY_MOVE_RESULT`
- `Canvas3D.jsx` — mode visée ghost + feedback couleur dot(AE,AD) + snap 4 axes + clic destination
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
---

## Session 36 — 2026-04-28

### Contexte
Reprise après session 34. Chantier 9F-0 + corrections flux interactions entités.

### Travail effectué

**`server/src/lib/charStats.js` — NOUVEAU ✅**
Bibliothèque de calcul pure (aucun accès DB) — source de vérité mécanique serveur.
- Tables : AN_TABLE (LdB p.114), MOD_DOM_TABLE (p.113), RD_TABLE (p.114), RES_NAT_TABLE (p.114), DIFFICULTY_MOD_TABLE (p.404)
- Tables qualitatives documentées non utilisées en V1 : ATTR_LEVEL_LABELS, MASTERY_LEVEL_LABELS, SKILL_LEVEL_LABELS
- ATTR_LABELS : labels complets attributs (LdB p.112-113)
- ATTR_DESCRIPTIONS : descriptions complètes pour tooltips futurs
- Fonctions : calcNA, calcAN, calcAttributeAN, calcAttributeNA, getGenotypeModForAttr
- calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow) — Base + mastery (PC4 attr_2=null)
- getModDom, calcREA, calcSeuils, calcVitesses, calcResistanceDommages, calcResistanceNaturelle, calcResistanceDroguesInput, calcSouffle
- Coût XP : getCoutAugmentation, getCoutDeblocageX, getCoutTotal (ajoutés par chantier Character parallèle)

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import charStats.js (calcSkillTotal, calcAttributeAN, getGenotypeModForAttr, ATTR_LABELS)
- PE1 supprimé — commentaire mis à jour
- ENTITY_ACTION_REQUEST : characterId et attributeId ajoutés dans pendingEntityActions Map
- ENTITY_ACTION_REQUEST : guard résolution directe sans GM si !skill_id && !attribute_id → resolveEntityState direct
- ENTITY_ACTION_RESOLVE : 4 requêtes DB en Promise.all (char_attributes, char_archetype, char_skills, ref_skills) + ref_genotypes séquentiel après archetype
- ENTITY_ACTION_RESOLVE : calcSkillTotal ou calcAttributeAN selon branche skillId/attributeId
- Formule Polaris correcte : chancesDeReussite = mechanicalTotal + difficulty_dc + gmModifier / isSuccess = diceRoll <= chancesDeReussite (LdB p.404)
- Label chat : `"${formulaLabel} [${mechanicalTotal}] — Chances : ${chancesDeReussite} (Dif.${diffLabel})"`
- DICE_RESULT : champs structurés ajoutés (skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess)
- Fallback mechanicalTotal=0 si char_sheet introuvable — log warning

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- skillTotal retiré du payload ENTITY_ACTION_REQUEST (serveur calcule)
- attributeId: interaction.attribute_id || null ajouté au payload
- Handler DICE_RESULT : champs structurés ajoutés au destructuring + transmis à addMessage
- handleEntityActionResolve : setEntityActionQueue supprimé (ReferenceError — variable inexistante)

**`client/src/components/Sidebar.jsx` — MODIFIÉ ✅**
- Panel GM : skillTotal retiré (non disponible avant arbitrage)
- Rendu dice : branche entity_action séparée si msg.skillLabel !== undefined
  - Format : nom compétence + résultat dé en grand + détail (compétence/dif/seuil) + badge SUCCÈS/ÉCHEC
  - Fond coloré vert (succès) ou rouge (échec)
- Jets normaux inchangés

**`client/src/components/EntityInstancePanel.jsx` — MODIFIÉ ✅**
- Sélecteur "État actuel" ajouté (select depuis blueprint.states)
- Guard : affiché uniquement si blueprint.states.length > 1
- current_state_id envoyé dans PUT /entities/:id + updateEntity store
- PANEL_H_EST : 360 → 420

**`client/src/character/EntityBuilderTab.jsx` — MODIFIÉ ✅**
- Label "Difficulté (DC)" → "Modificateur de difficulté"
- Hint ajouté : "+5 Facile · 0 Moyen · -5 Difficile"
- Valeur par défaut difficulty_dc : 10 → 0

**`client/src/locales/fr/translation.json` — MODIFIÉ ✅**
- entityActionDetail, entityActionSuccess, entityActionFail ajoutés dans section sidebar

### Règles mécaniques Polaris confirmées (LdB p.404)
```
Chances de réussite = skillTotal + difficulty_dc + gmModifier
Jet 1d20 ≤ chances → SUCCÈS
Jet 1d20 > chances → ÉCHEC
difficulty_dc = modificateur signé (-20 à +10)
gmModifier = ajustement GM au moment arbitrage, défaut 0
```

### Pièges documentés

**PE1 — SUPPRIMÉ**
Le serveur calcule via charStats.js. Client calcule pour affichage uniquement.

### Validation fonctionnelle
- ✅ charStats.js — calculs Polaris serveur corrects
- ✅ Formule jet correcte (dé ≤ seuil)
- ✅ Affichage structuré jet entity_action dans chat
- ✅ Sélecteur état actuel EntityInstancePanel
- ✅ Guard résolution directe sans compétence (sans notif GM)
- ✅ crash setEntityActionQueue corrigé
- ✅ EntityBuilderTab — label difficulté + valeur par défaut
- ✅ Jets normaux inchangés

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/lib/charStats.js` | NOUVEAU — calculs Polaris purs |
| `server/src/socket/index.js` | charStats import, calcul serveur, formule Polaris, champs structurés DICE_RESULT |
| `client/src/pages/SessionPage.jsx` | payload corrigé, DICE_RESULT structuré, crash setEntityActionQueue |
| `client/src/components/Sidebar.jsx` | rendu entity_action structuré, panel GM nettoyé |
| `client/src/components/EntityInstancePanel.jsx` | sélecteur état actuel |
| `client/src/character/EntityBuilderTab.jsx` | label difficulté, valeur défaut |
| `client/src/locales/fr/translation.json` | 3 clés entity_action |
---

## Session 39 — 2026-04-28

### Contexte
Chantier 9F-A — Fondations mouvement. Prérequis : 9F-0 validé session 36.

### Travail préparatoire (long — intentionnel)
Analyse exhaustive avant tout code : inventaire complet des mutations de position, décisions d'architecture collision map Redis, identification de tous les cas edge (token layer GM, entités is_blocking, SESSION_JOIN sans player_location, changement layer token, resolveEntityState).

Décisions d'architecture actées :
- Cache-aside Redis (pattern pro) — DB source de vérité, Redis accélérateur O(1)
- Pas de dénormalisation `is_blocking` sur `entities` — JOIN blueprint au SESSION_JOIN (O(n) acceptable, appel rare)
- Pipeline Redis dans `buildCollisionMap` — O(1) réseau au lieu de O(n)
- Maintenance Redis dans les routes REST (DELETE tokens/entities) — position disponible avant suppression
- Handlers WS TOKEN_DELETED / ENTITY_DELETED ne touchent pas Redis — évite double-traitement
- `collisionMoveToken` : hdel systématique sur ancienne case, hset conditionnel (layer != 'gm')

### Travail effectué

**`shared/events.js` — MODIFIÉ ✅**
- `TOKEN_ROTATE: 'token:rotate'` ajouté

**`server/src/lib/redis.js` — NOUVEAU ✅**
- Client ioredis singleton — `REDIS_URL` depuis `.env`
- `buildCollisionMap(battlemapId)` — pipeline Redis, filtre layer 'gm', JOIN blueprint pour is_blocking (PE11)
- `isCaseOccupied(battlemapId, x, y, z, excludeIds)` — O(1), tunnel de swap PE22
- Helpers maintenance : `collisionAddToken`, `collisionRemoveToken`, `collisionMoveToken`
- Helpers maintenance : `collisionAddEntity`, `collisionRemoveEntity`, `collisionMoveEntity`, `collisionUpdateEntityState`
- Helpers maintenance : `collisionAddVoxel`, `collisionRemoveVoxel`

**`server/src/db/migrations/44_tokens_rotation.js` — NOUVEAU ✅**
- Colonne `r INTEGER NOT NULL DEFAULT 0` sur `tokens`

**`server/src/db/migrations/45_polaris_mr_table.js` — NOUVEAU ✅**
- Table `polaris_mr` (mr_min PK, mr_max nullable, dmax) + seed 6 lignes

**`server/src/routes/tokens.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddToken` après INSERT
- `PUT /:id` : `collisionMoveToken` si position change
- `DELETE /:id` : `collisionRemoveToken` AVANT suppression

**`server/src/routes/entities.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddEntity` après INSERT (blueprint déjà chargé)
- `PUT /:entityId` : `collisionMoveEntity` si position change, `collisionUpdateEntityState` si état change
- `DELETE /:entityId` : `collisionRemoveEntity` AVANT suppression

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `SESSION_JOIN` : `buildCollisionMap` via `player_locations` — non bloquant si absent
- `TOKEN_MOVE` : `collisionMoveToken` après update DB
- `VOXEL_ADD` : `collisionAddVoxel`
- `VOXEL_REMOVE` : `collisionRemoveVoxel`
- `VOXEL_UPDATE` : pas de maintenance (position inchangée, seule rotation change)
- `TOKEN_CREATED` / `TOKEN_DELETED` : commentaires clarifiés — maintenance dans REST, pas ici
- `ENTITY_CREATED` / `ENTITY_DELETED` / `ENTITY_MOVED` : idem — maintenance dans REST
- Nouveau handler `TOKEN_ROTATE` : ownership check, `r = (r+1) % 8`, broadcast `TOKEN_UPDATED`
- `resolveEntityState` : `collisionUpdateEntityState` après update + `returning` étendu avec `battlemap_id`

**`client/src/components/Canvas3D.jsx` — MODIFIÉ ✅**
- Prop `onTokenRotate` ajoutée (Canvas3D + Scene)
- `rotation.y = (token.r ?? 0) * Math.PI / 4` sur `<group>` parent du TokenMesh (PE21)
- Tilt drag conservé sur `<primitive>` — indépendant de la rotation permanente
- `handlePointerUp` : clic court sur token propriétaire → `onTokenRotate?.(token.id)`
- `onTokenRotate` dans les deps de `handlePointerUp` (P3)

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- Handler `TOKEN_UPDATED` : `updateToken(token)` — merge partiel via store
- Callback `handleTokenRotate` : `socket?.emit(WS.TOKEN_ROTATE, { tokenId })` — `socket` dans deps (P3)
- Prop `onTokenRotate={handleTokenRotate}` sur `<Canvas3D>`

### Pièges documentés (nouveaux)

**PE24 — `collisionMoveToken` : hdel systématique sur ancienne case**
Si un token change de layer (ex: 'token' → 'gm'), il faut quand même retirer l'ancienne case Redis.
`hdel` systématique sur `oldToken` si `oldToken.layer !== 'gm'`.
`hset` conditionnel sur `newToken` si `newToken.layer !== 'gm'`.

**PE25 — maintenance Redis dans REST, pas dans les handlers WS reliques**
`TOKEN_CREATED` et `TOKEN_DELETED` WS sont des reliques — la maintenance collision map est dans les routes REST correspondantes. Ne pas doubler.
Même règle pour `ENTITY_CREATED`, `ENTITY_DELETED`, `ENTITY_MOVED`.

**PE26 — `resolveEntityState` : `returning` doit inclure `battlemap_id`**
`collisionUpdateEntityState` a besoin de `battlemap_id`. Le `.returning([...])` de `resolveEntityState` doit l'inclure explicitement — Knex ne retourne pas toutes les colonnes par défaut avec une liste.

### Dépendances installées
- `server/` : `ioredis` (9 packages, 0 vulnerabilities après `npm audit fix`)

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ `[Redis] Connecté` au démarrage
- ✅ `[Redis] Collision map reconstruite` au SESSION_JOIN
- ✅ Migrations 44 + 45 appliquées
- ✅ TOKEN_ROTATE fonctionnel — rotation token visible côté client

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `shared/events.js` | TOKEN_ROTATE ajouté |
| `server/src/lib/redis.js` | NOUVEAU — client + helpers collision map |
| `server/src/db/migrations/44_tokens_rotation.js` | NOUVEAU — colonne r tokens |
| `server/src/db/migrations/45_polaris_mr_table.js` | NOUVEAU — table polaris_mr + seed |
| `server/src/routes/tokens.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/routes/entities.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/socket/index.js` | buildCollisionMap SESSION_JOIN, TOKEN_ROTATE handler, maintenance voxels, resolveEntityState étendu |
| `client/src/components/Canvas3D.jsx` | rotation.y token r, onTokenRotate callback, prop |
| `client/src/pages/SessionPage.jsx` | TOKEN_UPDATED handler, handleTokenRotate, prop Canvas3D |
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
---

## Session 36 — 2026-04-28

### Contexte
Reprise après session 34. Chantier 9F-0 + corrections flux interactions entités.

### Travail effectué

**`server/src/lib/charStats.js` — NOUVEAU ✅**
Bibliothèque de calcul pure (aucun accès DB) — source de vérité mécanique serveur.
- Tables : AN_TABLE (LdB p.114), MOD_DOM_TABLE (p.113), RD_TABLE (p.114), RES_NAT_TABLE (p.114), DIFFICULTY_MOD_TABLE (p.404)
- Tables qualitatives documentées non utilisées en V1 : ATTR_LEVEL_LABELS, MASTERY_LEVEL_LABELS, SKILL_LEVEL_LABELS
- ATTR_LABELS : labels complets attributs (LdB p.112-113)
- ATTR_DESCRIPTIONS : descriptions complètes pour tooltips futurs
- Fonctions : calcNA, calcAN, calcAttributeAN, calcAttributeNA, getGenotypeModForAttr
- calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow) — Base + mastery (PC4 attr_2=null)
- getModDom, calcREA, calcSeuils, calcVitesses, calcResistanceDommages, calcResistanceNaturelle, calcResistanceDroguesInput, calcSouffle
- Coût XP : getCoutAugmentation, getCoutDeblocageX, getCoutTotal (ajoutés par chantier Character parallèle)

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import charStats.js (calcSkillTotal, calcAttributeAN, getGenotypeModForAttr, ATTR_LABELS)
- PE1 supprimé — commentaire mis à jour
- ENTITY_ACTION_REQUEST : characterId et attributeId ajoutés dans pendingEntityActions Map
- ENTITY_ACTION_REQUEST : guard résolution directe sans GM si !skill_id && !attribute_id → resolveEntityState direct
- ENTITY_ACTION_RESOLVE : 4 requêtes DB en Promise.all (char_attributes, char_archetype, char_skills, ref_skills) + ref_genotypes séquentiel après archetype
- ENTITY_ACTION_RESOLVE : calcSkillTotal ou calcAttributeAN selon branche skillId/attributeId
- Formule Polaris correcte : chancesDeReussite = mechanicalTotal + difficulty_dc + gmModifier / isSuccess = diceRoll <= chancesDeReussite (LdB p.404)
- Label chat : `"${formulaLabel} [${mechanicalTotal}] — Chances : ${chancesDeReussite} (Dif.${diffLabel})"`
- DICE_RESULT : champs structurés ajoutés (skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess)
- Fallback mechanicalTotal=0 si char_sheet introuvable — log warning

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- skillTotal retiré du payload ENTITY_ACTION_REQUEST (serveur calcule)
- attributeId: interaction.attribute_id || null ajouté au payload
- Handler DICE_RESULT : champs structurés ajoutés au destructuring + transmis à addMessage
- handleEntityActionResolve : setEntityActionQueue supprimé (ReferenceError — variable inexistante)

**`client/src/components/Sidebar.jsx` — MODIFIÉ ✅**
- Panel GM : skillTotal retiré (non disponible avant arbitrage)
- Rendu dice : branche entity_action séparée si msg.skillLabel !== undefined
  - Format : nom compétence + résultat dé en grand + détail (compétence/dif/seuil) + badge SUCCÈS/ÉCHEC
  - Fond coloré vert (succès) ou rouge (échec)
- Jets normaux inchangés

**`client/src/components/EntityInstancePanel.jsx` — MODIFIÉ ✅**
- Sélecteur "État actuel" ajouté (select depuis blueprint.states)
- Guard : affiché uniquement si blueprint.states.length > 1
- current_state_id envoyé dans PUT /entities/:id + updateEntity store
- PANEL_H_EST : 360 → 420

**`client/src/character/EntityBuilderTab.jsx` — MODIFIÉ ✅**
- Label "Difficulté (DC)" → "Modificateur de difficulté"
- Hint ajouté : "+5 Facile · 0 Moyen · -5 Difficile"
- Valeur par défaut difficulty_dc : 10 → 0

**`client/src/locales/fr/translation.json` — MODIFIÉ ✅**
- entityActionDetail, entityActionSuccess, entityActionFail ajoutés dans section sidebar

### Règles mécaniques Polaris confirmées (LdB p.404)
```
Chances de réussite = skillTotal + difficulty_dc + gmModifier
Jet 1d20 ≤ chances → SUCCÈS
Jet 1d20 > chances → ÉCHEC
difficulty_dc = modificateur signé (-20 à +10)
gmModifier = ajustement GM au moment arbitrage, défaut 0
```

### Pièges documentés

**PE1 — SUPPRIMÉ**
Le serveur calcule via charStats.js. Client calcule pour affichage uniquement.

### Validation fonctionnelle
- ✅ charStats.js — calculs Polaris serveur corrects
- ✅ Formule jet correcte (dé ≤ seuil)
- ✅ Affichage structuré jet entity_action dans chat
- ✅ Sélecteur état actuel EntityInstancePanel
- ✅ Guard résolution directe sans compétence (sans notif GM)
- ✅ crash setEntityActionQueue corrigé
- ✅ EntityBuilderTab — label difficulté + valeur par défaut
- ✅ Jets normaux inchangés

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/lib/charStats.js` | NOUVEAU — calculs Polaris purs |
| `server/src/socket/index.js` | charStats import, calcul serveur, formule Polaris, champs structurés DICE_RESULT |
| `client/src/pages/SessionPage.jsx` | payload corrigé, DICE_RESULT structuré, crash setEntityActionQueue |
| `client/src/components/Sidebar.jsx` | rendu entity_action structuré, panel GM nettoyé |
| `client/src/components/EntityInstancePanel.jsx` | sélecteur état actuel |
| `client/src/character/EntityBuilderTab.jsx` | label difficulté, valeur défaut |
| `client/src/locales/fr/translation.json` | 3 clés entity_action |
---

## Session 39 — 2026-04-28

### Contexte
Chantier 9F-A — Fondations mouvement. Prérequis : 9F-0 validé session 36.

### Travail préparatoire (long — intentionnel)
Analyse exhaustive avant tout code : inventaire complet des mutations de position, décisions d'architecture collision map Redis, identification de tous les cas edge (token layer GM, entités is_blocking, SESSION_JOIN sans player_location, changement layer token, resolveEntityState).

Décisions d'architecture actées :
- Cache-aside Redis (pattern pro) — DB source de vérité, Redis accélérateur O(1)
- Pas de dénormalisation `is_blocking` sur `entities` — JOIN blueprint au SESSION_JOIN (O(n) acceptable, appel rare)
- Pipeline Redis dans `buildCollisionMap` — O(1) réseau au lieu de O(n)
- Maintenance Redis dans les routes REST (DELETE tokens/entities) — position disponible avant suppression
- Handlers WS TOKEN_DELETED / ENTITY_DELETED ne touchent pas Redis — évite double-traitement
- `collisionMoveToken` : hdel systématique sur ancienne case, hset conditionnel (layer != 'gm')

### Travail effectué

**`shared/events.js` — MODIFIÉ ✅**
- `TOKEN_ROTATE: 'token:rotate'` ajouté

**`server/src/lib/redis.js` — NOUVEAU ✅**
- Client ioredis singleton — `REDIS_URL` depuis `.env`
- `buildCollisionMap(battlemapId)` — pipeline Redis, filtre layer 'gm', JOIN blueprint pour is_blocking (PE11)
- `isCaseOccupied(battlemapId, x, y, z, excludeIds)` — O(1), tunnel de swap PE22
- Helpers maintenance : `collisionAddToken`, `collisionRemoveToken`, `collisionMoveToken`
- Helpers maintenance : `collisionAddEntity`, `collisionRemoveEntity`, `collisionMoveEntity`, `collisionUpdateEntityState`
- Helpers maintenance : `collisionAddVoxel`, `collisionRemoveVoxel`

**`server/src/db/migrations/44_tokens_rotation.js` — NOUVEAU ✅**
- Colonne `r INTEGER NOT NULL DEFAULT 0` sur `tokens`

**`server/src/db/migrations/45_polaris_mr_table.js` — NOUVEAU ✅**
- Table `polaris_mr` (mr_min PK, mr_max nullable, dmax) + seed 6 lignes

**`server/src/routes/tokens.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddToken` après INSERT
- `PUT /:id` : `collisionMoveToken` si position change
- `DELETE /:id` : `collisionRemoveToken` AVANT suppression

**`server/src/routes/entities.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `POST /` : `collisionAddEntity` après INSERT (blueprint déjà chargé)
- `PUT /:entityId` : `collisionMoveEntity` si position change, `collisionUpdateEntityState` si état change
- `DELETE /:entityId` : `collisionRemoveEntity` AVANT suppression

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import helpers redis.js
- `SESSION_JOIN` : `buildCollisionMap` via `player_locations` — non bloquant si absent
- `TOKEN_MOVE` : `collisionMoveToken` après update DB
- `VOXEL_ADD` : `collisionAddVoxel`
- `VOXEL_REMOVE` : `collisionRemoveVoxel`
- `VOXEL_UPDATE` : pas de maintenance (position inchangée, seule rotation change)
- `TOKEN_CREATED` / `TOKEN_DELETED` : commentaires clarifiés — maintenance dans REST, pas ici
- `ENTITY_CREATED` / `ENTITY_DELETED` / `ENTITY_MOVED` : idem — maintenance dans REST
- Nouveau handler `TOKEN_ROTATE` : ownership check, `r = (r+1) % 8`, broadcast `TOKEN_UPDATED`
- `resolveEntityState` : `collisionUpdateEntityState` après update + `returning` étendu avec `battlemap_id`

**`client/src/components/Canvas3D.jsx` — MODIFIÉ ✅**
- Prop `onTokenRotate` ajoutée (Canvas3D + Scene)
- `rotation.y = (token.r ?? 0) * Math.PI / 4` sur `<group>` parent du TokenMesh (PE21)
- Tilt drag conservé sur `<primitive>` — indépendant de la rotation permanente
- `handlePointerUp` : clic court sur token propriétaire → `onTokenRotate?.(token.id)`
- `onTokenRotate` dans les deps de `handlePointerUp` (P3)

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- Handler `TOKEN_UPDATED` : `updateToken(token)` — merge partiel via store
- Callback `handleTokenRotate` : `socket?.emit(WS.TOKEN_ROTATE, { tokenId })` — `socket` dans deps (P3)
- Prop `onTokenRotate={handleTokenRotate}` sur `<Canvas3D>`

### Pièges documentés (nouveaux)

**PE24 — `collisionMoveToken` : hdel systématique sur ancienne case**
Si un token change de layer (ex: 'token' → 'gm'), il faut quand même retirer l'ancienne case Redis.
`hdel` systématique sur `oldToken` si `oldToken.layer !== 'gm'`.
`hset` conditionnel sur `newToken` si `newToken.layer !== 'gm'`.

**PE25 — maintenance Redis dans REST, pas dans les handlers WS reliques**
`TOKEN_CREATED` et `TOKEN_DELETED` WS sont des reliques — la maintenance collision map est dans les routes REST correspondantes. Ne pas doubler.
Même règle pour `ENTITY_CREATED`, `ENTITY_DELETED`, `ENTITY_MOVED`.

**PE26 — `resolveEntityState` : `returning` doit inclure `battlemap_id`**
`collisionUpdateEntityState` a besoin de `battlemap_id`. Le `.returning([...])` de `resolveEntityState` doit l'inclure explicitement — Knex ne retourne pas toutes les colonnes par défaut avec une liste.

### Dépendances installées
- `server/` : `ioredis` (9 packages, 0 vulnerabilities après `npm audit fix`)

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ `[Redis] Connecté` au démarrage
- ✅ `[Redis] Collision map reconstruite` au SESSION_JOIN
- ✅ Migrations 44 + 45 appliquées
- ✅ TOKEN_ROTATE fonctionnel — rotation token visible côté client

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `shared/events.js` | TOKEN_ROTATE ajouté |
| `server/src/lib/redis.js` | NOUVEAU — client + helpers collision map |
| `server/src/db/migrations/44_tokens_rotation.js` | NOUVEAU — colonne r tokens |
| `server/src/db/migrations/45_polaris_mr_table.js` | NOUVEAU — table polaris_mr + seed |
| `server/src/routes/tokens.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/routes/entities.js` | maintenance Redis POST/PUT/DELETE |
| `server/src/socket/index.js` | buildCollisionMap SESSION_JOIN, TOKEN_ROTATE handler, maintenance voxels, resolveEntityState étendu |
| `client/src/components/Canvas3D.jsx` | rotation.y token r, onTokenRotate callback, prop |
| `client/src/pages/SessionPage.jsx` | TOKEN_UPDATED handler, handleTokenRotate, prop Canvas3D |
---

## Session 40 — 2026-04-29

### Contexte
Chantier 9F-B1 — Déplacement entités orthogonal (serveur + atelier).
Prérequis : 9F-A ✅ session 39.

### Travail effectué

**`shared/events.js` — MODIFIÉ ✅**
- `ENTITY_MOVE_REQUEST: 'entity:move_request'` ajouté — joueur → serveur
- `ENTITY_MOVE_RESULT: 'entity:move_result'` ajouté — serveur → joueur

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Import `calcAttributeNA` ajouté (charStats.js)
- Import `isCaseOccupied` ajouté (redis.js)
- Cache `MR_TABLE` + `getMrTable()` + `getDmax()` déclarés hors `initSocket`
- Handler `ENTITY_MOVE_REQUEST` complet :
  - Guards : campaignId, rôle GM rejeté, double-soumission via pendingEntityActions
  - Chargement : entity, blueprint, interaction (move_type vérifié), token acteur
  - Ownership token → character.user_id === socket.user.id
  - Distance Tchebychev 3D (inclut altitude pos_z)
  - Calcul direction : dPosX / dPosY (PE14 — destZ = pos_y base)
  - Guard orthogonalité + guard destination = position actuelle
  - Calcul actualMoveType par dot(AE, AD) — PE27
  - Validation cohérence moveType client vs actualMoveType serveur
  - Chargement stats character : char_sheet, attrs, archetype, genotype
  - calcAttributeNA(attrs, attributeId, genotypeRow) — source de vérité serveur
  - Jet 1d20 via parseDice
  - MR = attributeNA + diceRoll - effectiveDifficulty
  - getDmax(mrTable, mr) + dmax_override si défini
  - Broadcast DICE_RESULT vers room
  - Si dmax=0 → ENTITY_MOVE_RESULT { success: false } + return
  - Step-by-step : isCaseOccupied entity + acteur, excludeIds=[tokenId,entityId] (PE22)
  - Update DB entity + token (pos_x, pos_y — pos_z inchangé)
  - collisionMoveEntity + collisionMoveToken Redis
  - Broadcast ENTITY_MOVED + TOKEN_MOVED → room
  - ENTITY_MOVE_RESULT → socket.id uniquement

**`docs/PLAN_ENTITY.md` — MODIFIÉ ✅**
- §3 interactions : `move_type: 'push'/'pull'` → `move_type: 'displacement'` (interaction unique)
- `pull_dmax_override` → `dmax_override` (plafonne push ET pull)
- Décision UX figée : une seule interaction "Déplacer", push/pull déterminé par vecteurs
- §5 flux déplacement réécrit : ghost + feedback couleur temps réel (Option 4)
- §8 payload : tokenId ajouté, attributeTotal supprimé, moveType ajouté, convention destZ documentée
- §10 : dmax_override mis à jour
- §12 : PE27 ajouté
- Plan d'implémentation 9F-B : étapes 1-3 marquées ✅

**`client/src/components/EntityBuilderTab.jsx` — REFONTE ✅**
- `startEdit` : normalisation complète des interactions au chargement
  - Déduction `type` depuis `move_type` legacy (rétrocompatibilité)
  - Correction nullables : `null` → `''` pour éviter `value={null}` sur selects (warning React)
- `addInteraction` : default `type: 'skillcheck'`, structure propre
- `handleSave` : sérialisation séparée par type
  - Déplacement : `action_label: 'Déplacer'` forcé, `move_type: 'displacement'` (rétrocompat serveur)
  - SkillCheck : `move_type: null`, `dmax_override: null`
- Rendu interactions — refonte complète :
  - En-tête : select type (SkillCheck | Déplacement) en ligne, atomique via setForm
  - Champs SkillCheck : Label (pleine largeur), Compétence, Attribut, Difficulté, Portée, État cible
  - Champs Déplacement : Attribut lié (FOR défaut), Difficulté, Déplacement max, Portée
  - États depuis lesquels disponible : commun aux deux types
  - `id` technique en monospace en bas de chaque bloc

### Décisions UX figées (session 40)

**Interaction déplacement — une seule, pas deux**
Le GM configure une interaction "Déplacer" (`move_type: 'displacement'`).
Le client détermine push/pull en temps réel par dot(AE, AD) + feedback couleur.
Le serveur recalcule indépendamment et valide (PE27).

**UX mode visée — Option 4 (validée)**
Ghost semi-transparent snapé sur 4 axes. Feedback couleur temps réel :
- dot > 0 → ghost BLEU + "Pousser"
- dot < 0 → ghost ORANGE + "Tirer"
- dot = 0 → ghost ROUGE + "Impossible" (clic bloqué)
Implémentation : 9F-B2 (SessionPage + Canvas3D + RadialMenu).

### Pièges documentés (nouveaux)

**PE27 — moveType calculé client ET recalculé serveur**
Client envoie `moveType` dans le payload (feedback UX).
Serveur recalcule indépendamment via dot(AE, AD).
Si discordance → refus silencieux.
Jamais faire confiance au `moveType` client seul.

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ F12 : interaction `type: 'displacement'`, `move_type: 'displacement'`, `action_label: 'Déplacer'`, `attribute_id: 'FOR'`, `target_state_id: null` — sérialisé correctement
- ✅ Interactions SkillCheck legacy chargées sans warning React
- ✅ Select type SkillCheck / Déplacement — bascule atomique

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `shared/events.js` | ENTITY_MOVE_REQUEST + ENTITY_MOVE_RESULT ajoutés |
| `server/src/socket/index.js` | handler ENTITY_MOVE_REQUEST complet, cache MR_TABLE, import calcAttributeNA + isCaseOccupied |
| `docs/PLAN_ENTITY.md` | §3/5/8/10/12 mis à jour — décision UX Option 4, PE27, payload corrigé |
| `client/src/components/EntityBuilderTab.jsx` | refonte formulaire interactions — type SkillCheck/Déplacement, startEdit normalisé |

### Prochaine étape : 9F-B2
- `RadialMenu.jsx` — tranche "Déplacer" (grisée si hors portée)
- `SessionPage.jsx` — `handleEntityMove` + listener `ENTITY_MOVE_RESULT`
- `Canvas3D.jsx` — mode visée ghost + feedback couleur dot(AE,AD) + snap 4 axes + clic destination
---

## Session 41 — 2026-04-30 — Chantier 9F-B2 : mode visée client

### Contexte
Suite directe de la session 40. 9F-B1 (serveur) validé et stable.
Objectif : implémenter le mode visée complet côté client.

### Décisions prises cette session

**Q1 — Ghost : carré wireframe au sol**
Après débat (losange XCOM, plan plein, boîte blueprint, GLB), décision finale :
`PlaneGeometry(1,1)` avec `meshBasicMaterial wireframe`, posé au sommet de la colonne.
Plus simple, indépendant de la géométrie de l'entité, lisible pour le joueur.

**Q2 — moveTarget géré dans SessionPage (Option A)**
SessionPage est le chef d'orchestre. Canvas3D reçoit `moveTarget` en prop, émet le WS, appelle `onMoveCancel`.
Le listener `ENTITY_MOVE_RESULT` dans SessionPage fait `setMoveTarget(null)`.

**Q3 — GM-A : jets pour tous, GM compris**
Le guard `if (socket.role === 'gm') return` dans ENTITY_MOVE_REQUEST a été retiré.
Guards en aval protègent les cas dégénérés (token sans character, character sans char_sheet → retour silencieux).
Feature "paramètre campagne GM entity move mode" (3 options) → reportée en chantier dédié.

**Q4 — Annulation silencieuse du mode visée**
Clic sur entité pendant mode visée → `setMoveTarget(null)` + return. Pas de radial.

**Couleur ghost — révision en cours de session**
Spec initiale : bleu=push, orange=pull, rouge=impossible.
Décision finale : vert=atteignable (push ou pull), rouge=impossible.
Le joueur n'a pas besoin de distinguer push/pull — c'est un détail interne.

**Hauteur ghost**
`getColumnTopY` retourne l'index Y brut du voxel le plus haut.
Sommet visuel = `maxY + 1` (voxel centré à maxY+0.5, taille 1).
Formule finale : `getColumnTopY(x, z) + 1 + 0.05`.

**i18n labels ghost**
`moveLabels` calculés dans Canvas3D export (où `t()` est accessible), passés en prop à Scene.
Pas d'exception i18n — pas de chaînes en dur dans les composants R3F.
Note : les labels "Pousser/Tirer/Impossible" ont été retirés du ghost final (carré wireframe sans texte).
Les clés i18n restent en base pour usage futur.

### Pièges rencontrés et résolus

**Ghost trop bas — deux itérations**
Première tentative : `y = 0.02` → dans le voxel.
Deuxième tentative : `getColumnTopY + 0.55` → toujours trop bas (formule incorrecte).
Solution finale : `getColumnTopY + 1 + 0.05` — compris après analyse de la fonction.

**lineBasicMaterial linewidth ignoré par WebGL**
`lineLoop` avec `linewidth > 1` → toujours 1px (limitation driver WebGL).
Remplacé par `PlaneGeometry wireframe` — plus visible, plus simple.

**useTranslation absent dans Canvas3D**
Détecté en simulation avant le code — aurait causé un crash immédiat.
Ajout import `useTranslation` depuis `react-i18next`.

**socket absent des deps handlePointerUp**
Bug latent existant avant ce chantier — corrigé au passage.
`socket` ajouté dans les deps de `handlePointerUp`.

**Pattern ref obligatoire pour callbacks stables**
`ghostPos` et `dotResult` en state (pour le rendu JSX) + `ghostRef` (pour la lecture stable dans handlePointerUp).
`tokensRef` pour `tokens` dans `handlePointerMove` — pattern P40 appliqué.

**handleMoveCancel inline → instable**
`onMoveCancel={() => setMoveTarget(null)}` inline dans le JSX → recréé à chaque render.
Remplacé par `handleMoveCancel = useCallback(() => setMoveTarget(null), [])` dans SessionPage.

**useEffect Échap séparé du useEffect Alt**
Deux useEffects distincts pour ne pas re-attacher les listeners Alt à chaque activation du mode visée.
Le useEffect Échap a `if (!moveTarget) return` — s'attache uniquement si nécessaire.

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ Radial menu : tranche Déplacer visible pour interactions displacement
- ✅ Grisage tranche si acteur hors portée
- ✅ Mode visée activé au clic tranche Déplacer
- ✅ Ghost wireframe visible au sommet des voxels
- ✅ Snap 4 axes orthogonaux fonctionnel
- ✅ Couleur vert/rouge selon dot(AE,AD)
- ✅ Clic destination → ENTITY_MOVE_REQUEST émis
- ✅ Message chat après résultat (succès/échec)
- ✅ Annulation Échap
- ✅ Annulation par clic entité (guard Q4)
- ✅ GM peut déclencher le déplacement (guard retiré)

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/socket/index.js` | Retrait guard `if (socket.role === 'gm') return` dans ENTITY_MOVE_REQUEST |
| `client/src/locales/fr.json` | Section `entity` + 5 clés i18n |
| `client/src/components/RadialMenu.jsx` | Props onMove/actorToken/entity, isOutOfRange, branche displacement, grisage |
| `client/src/pages/SessionPage.jsx` | moveTarget state, handleEntityMove, handleMoveCancel, guard Q4, listener ENTITY_MOVE_RESULT, JSX Canvas3D + RadialMenu |
| `client/src/components/Canvas3D.jsx` | useTranslation, moveTarget/onMoveCancel props, useEffect Échap, tokensRef/ghostRef, mode visée handlePointerMove/Up, ghost JSX wireframe |

### Prochaine étape : 9F-C
Diagonal 45° + animation Lerp 300ms.
Voir `docs/PLAN_ENTITY.md` §9.
---

## Session 43 — 2026-05-01 — Chantier 9F-C : Diagonal + Lerp + débuggage

### Contexte de reprise
Session 42 = échec (protocole non suivi). Session 43 repart de zéro sur 9F-C.
Fichiers relus intégralement : index.js, Canvas3D.jsx, Sidebar.jsx, SessionPage.jsx, fr.json, EntityMesh.jsx, EntityEditor.jsx, redis.js, migration 30.

### Décisions prises

**Logs debug conservés dans index.js**
Décision dev : les logs `[DBG]` step-by-step sont utiles pour le diagnostic. Conservés volontairement. À retirer avant production.

**Couleurs ghost**
Retour à la spec session 40 : bleu=push (#2563eb), orange=pull (#f97316), rouge=impossible (#ef4444).
La spec session 41 (vert/rouge) était une simplification abandonnée.

**Lerp exponentiel tau=0.1**
95% de la distance en ~300ms. Pas de dépendance au framerate (utilise `delta` de useFrame).
Pattern P40 : position via ref uniquement, jamais via prop JSX ni state React.

### Travail effectué

**`server/src/socket/index.js` — MODIFIÉ ✅**
- Suppression bloc Tchebychev (l.1047-1053) — cause du bug blocage systématique
- `mr` ajouté dans le broadcast `DICE_RESULT`
- Logs debug `[DBG]` ajoutés à chaque return silencieux du handler ENTITY_MOVE_REQUEST
- Logs debug `[DBG]` ajoutés dans la boucle step-by-step (entityBlocked/actorBlocked)

**`client/src/pages/SessionPage.jsx` — MODIFIÉ ✅**
- `mr` ajouté dans la destructuration du handler DICE_RESULT
- `mr` ajouté dans `addMessage`

**`client/src/locales/fr/translation.json` — MODIFIÉ ✅**
- `sidebar.displacementSuccess` : `"RÉUSSITE — Marge : {{mr}}"`
- `sidebar.displacementFail` : `"ÉCHEC — Marge : {{mr}}"`

**`client/src/components/Sidebar.jsx` — MODIFIÉ ✅**
- Badge displacement remplacé par badge avec MR : "RÉUSSITE — MARGE : X" / "ÉCHEC — MARGE : X"
- Branche skillcheck inchangée (`entityActionSuccess`/`entityActionFail`)

**`client/src/components/Canvas3D.jsx` — MODIFIÉ ✅**
- Snap 8 axes contraint depuis l'entité (ratio 2:1) — `entity.pos_x + Math.round(dPosX)` etc.
- Diagonal : `dist = Math.round((|dPosX| + |dPosZ|) / 2)`
- Couleurs ghost : `dotResult > 0 → bleu`, `dotResult < 0 → orange`, `= 0 → rouge`
- Lerp 300ms TokenMesh : groupRef + lerpPos + targetRef + isDraggingRef + useFrame
- Position `<group>` TokenMesh pilotée par useFrame — prop `position` retirée

**`client/src/components/EntityMesh.jsx` — MODIFIÉ ✅**
- Import `useFrame` depuis `@react-three/fiber`
- Lerp 300ms dans `EntityMeshVoxel` — après useEffect, avant JSX
- Lerp 300ms dans `EntityMeshGlb` — après useMemo, avant guard `if (!clonedScene) return null`
- Position `<group>` pilotée par useFrame dans les deux sous-composants

**`client/src/components/EntityEditor.jsx` — MODIFIÉ ✅**
- Correction bug préexistant : `textureMaterials` → `entityTextureMaterials` (prop incorrecte)

### Investigation bugs (session)

**Bug 1 — stepsCompleted=0 sur réussite**
Cause identifiée : bloc Tchebychev. Supprimé. Résolu.

**Bug 2 — "Déplacement échoué" avec MR positive**
Cause : `success` dans ENTITY_MOVE_RESULT = `stepsCompleted > 0` (déplacement physique),
pas `isSuccess` du jet. Comportement correct — le message système reflète le déplacement réel.
Le badge dans Sidebar reflète le jet (MR). Les deux sont corrects et indépendants.

**Bug 3 — ghost s'affichait sur cases hors-axe**
Cause : snap ne contraignait pas depuis l'entité (`Math.round(worldPos.x)` libre).
Corrigé : `entity.pos_x + Math.round(dPosX)`.

**Collision map voxels — investigation**
Case (13,0,1) bloquait step-by-step. Vérification Redis + PostgreSQL : voxel réel confirmé en base.
y=0 dans voxel_data = sol réel sur cette carte. Pas de bug. Comportement attendu.

### Validation fonctionnelle
- ✅ Déplacement orthogonal est/ouest + nord/sud fonctionnel
- ✅ Badge MR : "RÉUSSITE — MARGE : 13" / "ÉCHEC — MARGE : -5"
- ✅ Ghost sur 8 axes exacts depuis l'entité
- ✅ Couleurs bleu/orange/rouge correctes
- ✅ Animation Lerp TokenMesh ~300ms
- ✅ Animation Lerp EntityMesh ~300ms

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `server/src/socket/index.js` | Fix Tchebychev, mr dans DICE_RESULT, logs debug |
| `client/src/pages/SessionPage.jsx` | mr dans destructuration + addMessage |
| `client/src/locales/fr/translation.json` | displacementSuccess + displacementFail |
| `client/src/components/Sidebar.jsx` | Badge displacement avec MR |
| `client/src/components/Canvas3D.jsx` | Snap 8 axes contraint, couleurs ghost, Lerp TokenMesh |
| `client/src/components/EntityMesh.jsx` | Lerp 300ms EntityMeshVoxel + EntityMeshGlb |
| `client/src/components/EntityEditor.jsx` | Correction prop entityTextureMaterials |

### Prochaine étape
Chantier suivant à définir. Voir ROADMAP.md.
## Session 44 — 2026-05-01 — Bug A + Dice Rework

### Contexte de reprise
Session 43 terminée : 9F-C ✅ complet et stable.
EntityEditorOLD.jsx supprimé en début de session.

### Bug A — Toggle visible character — Résolu ✅

**Diagnostic :** toute la chaîne était correcte sur le papier (PUT /characters/:id → broadcast CHARACTER_UPDATED → upsertCharacter → store → re-render). Le bug était dans `characterStore.upsertCharacter` : aucun guard sur `visible` — un character invisible broadcasté à un joueur était ajouté/conservé dans son store au lieu d'être retiré.

**Correction `client/src/stores/characterStore.js` :**
- `upsertCharacter` : guard `if (!character.visible && !state.isGm)` → filter le character du store
- Le broadcast CHARACTER_UPDATED envoie l'objet complet — le store reproduit le filtre serveur côté client

**Piège documenté PE31 :** guard visible+isGm dans upsertCharacter.

### Dice Rework — Complet V1 ✅

**Architecture retenue (aménagement spec Dice_rework.md) :**
- DiceRoller monté dans Canvas3D — un seul contexte WebGL. Pas de DiceOverlay HTML séparé.
- DICE_RESULT consommé deux fois en parallèle : chat + animation
- Animation déclenchée uniquement si `!skillLabel`
- `seed` du payload initialise le PRNG déterministe

**Dés validés :**
| Dé | Géométrie | Chiffre | Statut |
|---|---|---|---|
| D6 | BoxGeometry | CanvasTexture par face | ✅ |
| D4 | TetrahedronGeometry | CanvasTexture par face | ✅ |
| D8 | OctahedronGeometry | CanvasTexture par face | ✅ |
| D20 | IcosahedronGeometry | CanvasTexture par face | ✅ |
| D12 | DodecahedronGeometry | Atlas 12 cases (centroïde 0.397) | ✅ |
| D10/D100 | Trapezohedron custom | Html overlay V1 position=[0,0,0] | ✅ V1 |

**D10 — décision V1/V2 :**
UV mapping d'un kite = problème de projection géométrique non trivial.
V1 : Html overlay centré — lisible, acceptable.
V2 : modèle Blender (.glb) avec UVs pré-calculés — chantier futur (PE33).

**Pièges documentés :**
- PE31 — upsertCharacter : guard visible+isGm
- PE32 — DiceMesh useMemo deps [geoDef.type, color, dieType]
- PE33 — D10 Html overlay position=[0,0,0]

### Fichiers modifiés cette session
| Fichier | Modifications |
|---|---|
| `client/src/stores/characterStore.js` | upsertCharacter — guard visible+isGm (Bug A) |
| `client/src/lib/diceMath.js` | NOUVEAU — PRNG, mappings, normales D4/D6/D8/D12/D20/D10 |
| `client/src/components/DiceMesh.jsx` | NOUVEAU — géométries, matériaux, animation, Html overlay |
| `client/src/components/DiceRoller.jsx` | NOUVEAU — orchestrateur R3F dans Canvas |
| `client/src/components/Canvas3D.jsx` | +2 props dicePayload/onDiceDone |
| `client/src/pages/SessionPage.jsx` | lastDiceRoll state, filtrage skillLabel, color dans payload |

### Validation fonctionnelle
- ✅ Bug A — toggle visible character répercuté en temps réel
- ✅ D6/D4/D8/D20/D12 — face correcte + chiffre + couleur lanceur
- ✅ D10/D100 — géométrie trapezohedron + Html overlay lisible
- ✅ Animation déclenchée sur jets normaux, absente sur jets entité

### Dettes session 44
- D10 UV texturing V2 (Blender) — PE33
- useDiceAudio.js — sons d'impact — todo
- .gitattributes:3 attribut invalide — dette ancienne
- Logs [DBG] index.js — conservés volontairement

---

## Session 45 — 2026-05-02 — Documentation

### Travail effectué
- Vérification archivabilité Dice Rework à partir de JOURNAL44.md ✅
- Mise à jour ROADMAP.md : chantier Dice Rework ✅ + D10 V2 todo + audio todo + nettoyage "Animation dé 3D" des idées/hors scope
- Mise à jour EN_COURS.md : Dice Rework ✅ + dettes documentées
- Mise à jour ASBUILT.md : section Dice Rework + PE31/32/33 + migration 46
- Append JOURNAL2.md : sessions 44 + 45

### Décisions documentées
- Dice Rework archivé comme ✅ V1 complète — D10 V2 et audio explicitement en todo
- DiceOverlay HTML séparé : remplacé par DiceRoller dans Canvas3D — décision session 44 définitive

---

## Session 45 (suite) — 2026-05-03 — Upload illustration campagne

### Chantier — Campaign cover upload

**Fonctionnalité :** les GM peuvent uploader une illustration par campagne depuis la page Dashboard (clic sur la zone cover → file picker → upload → affichage immédiat).

**MinIO — arborescence campagne actée**
- Chemin cover : `campaigns/<campaign_id>/cover` — nom fixe, sans extension, Content-Type en metadata (conforme P18)
- Convention générale établie : tous les assets d'une campagne sous `campaigns/<campaign_id>/`
  - Cover campagne : `campaigns/<campaign_id>/cover`
  - (futur) Cartes 2D, tokens 2D, bibliothèque : même racine
- Migration future documentée (non codée) : `characters/<id>/illustration` → `campaigns/<campaign_id>/characters/<id>`
  Raison : characters peuvent exister sans campagne — migration complexe, chantier dédié ultérieur.

**Fichiers produits :**
| Fichier | Modification |
|---|---|
| `server/src/db/migrations/47_campaigns_cover_url.js` | NOUVEAU — `campaigns.cover_url TEXT nullable` |
| `server/src/routes/campaigns.js` | POST `/:id/cover` + `cover_url` dans SELECT GET / |
| `client/src/locales/fr.json` | +3 clés dashboard : coverUpload, coverUploading, coverErrorUpload |
| `client/src/pages/DashboardPage.jsx` | Zone cover interactive (pendingCoverIdRef pattern) |

**Pattern pendingCoverIdRef :**
Un seul `<input type="file" hidden>` partagé pour toutes les campagnes.
`pendingCoverIdRef.current = campaignId` avant `.click()` — évite la stale closure qui surviendrait avec useState.

### Validation fonctionnelle
- ✅ Upload cover campagne depuis Dashboard
- ✅ Affichage immédiat après upload (mise à jour locale du state)
- ✅ Curseur `wait` pendant l'upload
- ✅ Erreur affichée si upload échoue

---

## Session 46 — 2026-05-05 — Chantier 10 sprint 1 : Schéma ref_equipment

### Chantier — Définition schéma ref_equipment

**Objectif :** Définir champ par champ le schéma SQL de `ref_equipment` avant de coder.

**Analyse pipeline extraction (clarification) :**
- Source réelle : `ExtractEQUIP.xlsx` (fichier maître Excel)
- `0_extractor.js` lit le XLSX via lib `xlsx` → produit `STEP1_cleaned_data.js` (33 champs, propre)
- `1_convert_equip.js` (STALE) avait 7 champs manquants + bug nommage damage → corrigé
- Le CSV n'entre pas dans le pipeline Node.js — export humain uniquement

**Schéma retenu — 35 colonnes :**
Tronc commun + extensions Arme / Protection / Munition / Conteneur.
Tous les champs valeur "texte riche" (formule prix, localisations armure, effets munitions DSL) stockés en TEXT pour flexibilité maximale.

**Décisions architecturales :**
- `malus_cat` : CHECK déployé = `S, A, B, C, D` uniquement (5 valeurs). C** éliminé — absent des données et rejeté par la contrainte. *(Note session 47 : noms de colonnes définitifs dans migration 48, pas dans cette entrée)*
- `price` : TEXT (peut contenir "1000 x niv", formules)
- `def_protection` : TEXT (peut contenir "niv" pour objets levelables)
- `rarity` : TEXT (peut contenir "Introuvable", valeurs négatives "-20 (-15)")
- 3 junction tables : `ref_equipment_skills`, `ref_equipment_skill_assoc`, `ref_equipment_ammo_compat`
- 6 CHECK constraints sur les catégories critiques (family, def_malus_type, fire_mode...)

---

## Session 47 — 2026-05-06 — Chantier 10 sprint 1 : Migration + Route + Page admin

### Chantier — Implémentation complète sprint 1

**Migration 48 déployée :**
- Table `ref_equipment` (35 colonnes, 6 CHECK constraints)
- Table `ref_equipment_skills` (junction : item ↔ compétences requises)
- Table `ref_equipment_skill_assoc` (junction : item ↔ compétence associée au jet)
- Table `ref_equipment_ammo_compat` (junction : munition ↔ armes compatibles)

**Route `/api/equipment` (CRUD complet) :**
- `GET /` — liste tous les items
- `GET /ref/skills` — liste compétences (pour multi-select) — AVANT `/:id` (P46)
- `GET /:id` — item par id
- `POST /` — création avec transaction (item + 3 junction tables)
- `DELETE /:id` — suppression
- Sanitize : champs vides → `null`, bool `waterproof` → `true | null` (pas `false` pour items sans waterproof)

**Page admin standalone `server/public/equipment-admin.html` :**
- Servie par `express.static` — auth via JWT cookie httpOnly (même domaine `localhost`)
- Saisie YAML flow style compact (js-yaml@4.1.0 CDN) — 33 alias courts
- Presets catégories (Arme / Protection / Munition / Conteneur / Divers) — fieldsets dim/highlight
- Multi-select compétences groupées par famille (avec Ctrl+clic)
- CRUD complet : liste items, suppression, formulaire complet

**Bugs corrigés lors de la run à vide :**
- Bug A : apostrophes dans les noms français cassaient les inline `onclick` → event delegation sur `tbody` + `data-id`/`data-name` attributes
- Bug B : `waterproof` unchecked = `false` au lieu de `null` → `form.waterproof.checked ? true : null`

**Fichiers produits :**
| Fichier | Modification |
|---|---|
| `server/src/db/migrations/48_ref_equipment.js` | NOUVEAU — ref_equipment + 3 junction tables |
| `server/src/routes/equipment.js` | NOUVEAU — CRUD complet + transaction |
| `server/public/equipment-admin.html` | NOUVEAU — page admin standalone ~750 lignes |
| `server/src/index.js` | +express.static public/ + route /api/equipment |

### Validation fonctionnelle
- ✅ Migration 48 déployée
- ✅ API CRUD fonctionnelle
- ✅ Page admin accessible `localhost:3001/equipment-admin.html`
- ✅ Saisie YAML rapide opérationnelle
- ✅ Presets catégories visuels
- ✅ Multi-select compétences

### Décisions documentées
- Architecture page admin : standalone HTML V1 (React V2 plus tard dans DashboardPage — GM only)
- YAML flow style choisi sur JSON (trop verbeux) et pipe-séparé (trop fragile)
- Preset selector HORS du `<form>` pour persister entre items (GM saisit 20 armes sans re-sélectionner)

---

## Session 48 — 2026-05-06 — Chantier 10 : Injection ref_equipment + Vérification

### Contexte
Suite directe de la session 47 (sprint 1 livré). Objectif : peupler `ref_equipment` depuis `STEP1_cleaned_data.js` et vérifier l'intégrité des données injectées.

### Seed script — `server/src/db/seeds/2_seed_equipment.js`

Script créé avec philosophie **KO par défaut** : tout champ ambigu → rejet avec rapport, pas de conversion silencieuse.

**Architecture :**
- Mode simulation par défaut (`node 2_seed_equipment.js`) — aucun INSERT
- Mode insert opt-in (`--insert` flag requis)
- Guard name : items déjà en base (même `name`) → skippés → script re-runnable N fois
- 3 niveaux de validation :
  - Niveau 1 — Ancres NOT NULL (`base_family`, `base_category`, `base_name`) + NT (I–VII) + rarity (regex `XX(YY)`)
  - Niveau 2 — Contraintes DB (`fire_mode` IN liste 8 valeurs, `malus_cat` IN {S,A,B,C,D}, `min_str` 3–20, `init_mod < 0`)
  - Niveau 3 — Parsing typé (`price`, `protection`, `capacity`, `waterproof`)
- Rapport rejections → `server/src/db/seeds/rejections.json`
- INSERT en batch de 100 via knex

**Itérations de dry-run :**
| Run | Corrections apportées |
|---|---|
| Run 1 | NT "I à VI" → borne basse ; prix formule ("1500 x niv") → price+modifier ; "étanche" → WP_TRUE |
| Run 2 | "pression" → WP_TRUE ; NT "null" (string) → tech_level=1 par défaut (flagué, pas rejeté) |
| Run 3 | 2 rejections restantes : Oxyma (init_mod="var.") et Poing Kryss (init_mod="1" > 0) — intentionnels |

**Résultat insert :** 715 valides, 2 rejetés, 636 items en BDD après nettoyage des doublons STEP1 (82 noms dupliqués dans l'Excel → 1 seule ligne en BDD par nom). Oxyma et Poing Kryss ajoutés manuellement.

### Vérification — `server/diff_equip.mjs`

Script de comparaison STEP1 vs BDD (copie exacte des parsers du seed). Identifie les items dont les valeurs BDD divergent de STEP1 → révèle les items saisis manuellement avant le seed.

**25 divergences initiales, triées en 3 catégories :**

| Catégorie | Nature | Action |
|---|---|---|
| 1 — Enrichissements intentionnels | 13 armes à énergie (coût piles GP-xx ajouté), rarités illégaux, localisations | Conservés |
| 2 — Erreurs confirmées vs livre de règles | damage_h Cougar/Nérid 650/Sniper AV, price_modifier Silencieux/Lunette, NT Harnais/Trépied | Corrigés manuellement |
| 3 — Compromis acceptés | Poing Kryss init_mod=null (+1 impossible en BDD, CHECK < 0), typo Oxyma "Variable" | Acceptés |

**État final :** 23 divergences toutes confirmées comme intentionnelles ou acceptées. BDD cohérente.

### Décisions actées

- **Source de vérité** : Livre de règles > ExtractEQUIP.xlsx/STEP1 > BDD. STEP1 a quelques erreurs vs livre (damage_h notamment).
- **Junction tables skills** (`ref_equipment_skill_assoc`, `ref_equipment_skills`) : non peuplées par le seed — enrichissement manuel au gré des items consultés, en cours.
- **`diff_equip.mjs`** : outil de vérification pérenne conservé dans `server/` — utilisable pour toute future vérification batch.
- Fichiers temporaires de vérification (`check_equip*.mjs`) supprimés.

### Fichiers produits / modifiés
| Fichier | Modification |
|---|---|
| `server/src/db/seeds/2_seed_equipment.js` | NOUVEAU — seed KO-par-défaut, dry-run, guard name, batch 100 |
| `server/diff_equip.mjs` | NOUVEAU — diff STEP1 vs BDD, réutilisable |

### État fonctionnel
- ✅ 636 items en `ref_equipment` — données vérifiées et cohérentes
- ✅ 2 items manuels (Oxyma, Poing Kryss) présents
- ✅ Aucune anomalie structurelle — doublons nettoyés
- ⏳ Junction tables skills — enrichissement manuel en cours

---

## Session 49 — 2026-05-07 — Chantier 11 Étape 1 : Module Blessures

### Contexte
Suite de la session 48. Chantier 11 Étape 1 : système de blessures Polaris complet (character_wounds) — DB, serveur, client, UI.

### Travail effectué

**Migration 49 — `character_wounds`**
- Table `character_wounds` : id UUID PK gen_random_uuid(), char_sheet_id UUID FK CASCADE, location TEXT, severity TEXT, is_stabilized BOOLEAN DEFAULT false, timestamps
- CHECK constraints SQL natifs : location IN ('tete','corps','bras_droit','bras_gauche','jambe_droite','jambe_gauche'), severity IN ('legere','moyenne','grave','critique','mortelle')
- Index `idx_wounds_char_sheet_id`
- Batch 22 appliqué — SR OK

**`shared/woundConstants.js` — NOUVEAU**
Source de vérité partagée server + client.
- `WOUND_LOCATIONS` — 6 localisations
- `WOUND_SEVERITIES` — 5 gravités
- `WOUND_MAX_COUNTS` — maxCount par (localisation, gravité) selon LdB Polaris
- `WOUND_PENALTIES` — malus par gravité : légère -1 / moyenne -3 / grave -5 / critique -10 / mortelle -20

**`shared/events.js` — modifié**
3 événements WS ajoutés : `WOUND_ADDED`, `WOUND_UPDATED`, `WOUND_REMOVED`.

**`server/src/routes/character/char-sheet.js` — refactorisé + extension**
- Pattern `router.param('characterId', ...)` remplace le helper `assertOwnerOrGm` — pattern Express officiel
- `router.use(requireAuth)` unique avant le param — plus de `requireAuth` par route
- `req.character` et `req.isGm` injectés par le param, disponibles dans toutes les routes
- Helper `isShockTestRequired(severity, location)` — retourne true si critique, mortelle, ou grave + tête/corps
- Helper `nextSeverity(severity)` — retourne la prochaine gravité dans WOUND_SEVERITIES, ou null
- `resolveWoundInsertion(trx, char_sheet_id, location, severity)` — récursive dans une transaction knex, gère la promotion automatique
- 4 routes blessures : GET /wounds, POST /wounds, PUT /wounds/:woundId/stabilize, DELETE /wounds/:woundId
- Broadcasts WS : WOUND_ADDED (POST), WOUND_UPDATED (stabilize), WOUND_REMOVED (DELETE)

**`server/src/lib/charStats.js` — modifié**
- `calcWoundPenalty(wounds)` ajoutée — retourne le malus de la blessure la plus grave (pas la somme)

**`client/src/character/WoundManager.jsx` — NOUVEAU**
Composant autonome : state interne `wounds[]` + useEffect fetch GET /wounds au montage.
- Grille : WOUND_LOCATIONS (lignes) × WOUND_SEVERITIES (colonnes)
- Cases fixes : `Array.from({ length: maxCount })` — jamais plus de cases que maxCount
- Clic case vide → POST (ajouter blessure)
- Clic blessure non stabilisée → PUT stabilize (checkmark vert)
- Clic blessure stabilisée → DELETE (guérison)
- Promotion transparente : si `res.data.promoted === true` → rechargement complet GET /wounds (P49)
- Badge `!` orange sur blessure nécessitant un jet de choc (`shock_test_required`)
- Malus blessures affiché si `woundPenalty < 0`
- Props : `{ characterId, canEdit }`

**`client/src/character/CharacterWindow.jsx` — modifié**
- Onglet "Matériel" ajouté entre "Fiche" et "Bio & info"
- WoundManager monté dans l'onglet Matériel

**`client/src/locales/fr.json` — modifié**
- `"tabMateriel": "Matériel"` ajouté dans namespace `character`

### Décision d'architecture : promotion automatique

La promotion se déclenche côté serveur quand `currentCount >= maxCount - 1` ET qu'une gravité supérieure existe.
Le Nème clic (qui remplirait la ligne) déclenche la promotion au lieu d'insérer : le serveur supprime toutes les blessures de la ligne source et en insère une dans la gravité suivante.
L'utilisateur ne voit jamais une ligne pleine — le passage est transparent.
Lignes mortelles (pas de gravité suivante) : insertion normale jusqu'à maxCount, puis AppError 400.

### Piège documenté

**P49 — Promotion blessures : rechargement complet obligatoire**
Quand `res.data.promoted === true`, le serveur a supprimé des blessures existantes (toute la ligne source).
Ne jamais `setWounds(prev => [...prev, wound])` sur une promotion — des wounds supprimées resteraient en state.
Toujours recharger via GET /wounds si `promoted === true`.

### Fichiers produits / modifiés
| Fichier | Modification |
|---|---|
| `shared/woundConstants.js` | NOUVEAU — source de vérité blessures |
| `shared/events.js` | +3 événements WS blessures |
| `server/src/db/migrations/49_character_wounds.js` | NOUVEAU — table character_wounds |
| `server/src/routes/character/char-sheet.js` | router.param + 4 routes blessures |
| `server/src/lib/charStats.js` | calcWoundPenalty |
| `client/src/character/WoundManager.jsx` | NOUVEAU — composant grille blessures |
| `client/src/character/CharacterWindow.jsx` | onglet Matériel |
| `client/src/locales/fr.json` | tabMateriel |

### Validation fonctionnelle ✅
- Migration 49 appliquée — Batch 22 — SR OK
- GET /wounds → 200 OK
- POST /wounds (légère, tête) → blessure créée, badge `!` visible
- Clic blessure → stabilisée (checkmark vert)
- Clic stabilisée → guérison (suppression)
- 3ème clic légère tête → promotion automatique transparente (2 légères → 1 moyenne)

---

## Session 50 — 2026-05-07

### Contexte
Reprise après session 49. Objectif : corriger PC22 (bug 403 toggle `is_learned` compétences MUTATION/POLARIS).

### Problème initial — PC22
`handleTogglePolaris` dans `AdvantagesPanel.jsx` appelait `PUT /char-sheet/:id/skills` (route GM-only) → 403 pour les joueurs possédant leur propre fiche.

### Travail effectué

**`server/src/routes/character/char-sheet.js` — route dédiée ajoutée (P46)**
- Nouvelle route `PUT /:characterId/skills/toggle-learned` déclarée AVANT `PUT /:characterId/skills` (P46 — spécifique avant paramétrique)
- Pas de guard `isGm` — `router.param` injecte déjà owner+GM
- Guard métier : `refSkill.parent !== 'POUVOIRS_POLARIS'` → 400 (restreint aux pouvoirs Polaris uniquement)
- UPSERT : `insert { mastery: 0, is_learned }` + `.onConflict().merge(['is_learned'])` — préserve la maîtrise existante
- Retourne `{ skill }` depuis un SELECT post-upsert

**`client/src/character/AdvantagesPanel.jsx` — rework architectural (lift state up)**
Raison : le composant maintenait sa propre copie de `charSkillsPolaris` en état local, sans jamais remonter les changements vers `CharacterSheet`. Résultat : toggle visible dans le modal mais invisible dans SkillsPanel.

- Supprimé : états locaux `refSkillsPolaris`, `charSkillsPolaris`, `loadingRef`
- Supprimé : `useEffect` lazy-load qui faisait un `GET /char-sheet/:id` redondant
- Ajouté en props : `charSkills`, `refSkillsPolaris`, `onSkillLearnedChange`
- `learnedPolarisSet` useMemo — source : `charSkills` prop (plus `charSkillsPolaris` local)
- `handleTogglePolaris` : appelle `onSkillLearnedChange?.(skillId, !isCurrentlyLearned)` au lieu de `setCharSkillsPolaris`
- Render : `loadingRef` → checks `.length === 0` sur les props

**`client/src/character/CharacterSheet.jsx` — propriétaire unique des données**
- `refSkillsPolaris` useMemo filtré depuis `refSkills` existant (aucun appel réseau supplémentaire)
- `handlePolarisToggled` useCallback (deps vides — utilise uniquement `setCharSkills` stable) :
  - met à jour `charSkills` par merge si skill existante, sinon push `{ skill_id, mastery: 0, is_learned }`
- 3 nouvelles props passées à `<AdvantagesPanel>` : `charSkills`, `refSkillsPolaris={refSkillsPolaris}`, `onSkillLearnedChange={handlePolarisToggled}`

### Décision architecturale

Problème racine : duplication de données — `AdvantagesPanel` avait sa propre copie de `charSkills` isolée du reste de la fiche.
Solution : lift state up — `CharacterSheet` est le seul propriétaire de `charSkills`. `AdvantagesPanel` lit et émet, ne stocke pas.
Bénéfice collatéral : suppression d'un appel réseau redondant `GET /char-sheet/:id`.

### Piège documenté

**P50 — toggle Polaris : ne jamais dupliquer charSkills dans un sous-composant**
Tout sous-composant de la fiche qui lit ET modifie `charSkills` doit recevoir les données en props et émettre les changements via callback.
Stocker une copie locale → changements non propagés vers SkillsPanel (learnedSet jamais mis à jour).

### Fichiers modifiés
| Fichier | Modification |
|---|---|
| `server/src/routes/character/char-sheet.js` | +route `PUT /:characterId/skills/toggle-learned` (avant PUT /:id/skills) |
| `client/src/character/AdvantagesPanel.jsx` | rework — suppression états locaux, props charSkills/refSkillsPolaris/onSkillLearnedChange |
| `client/src/character/CharacterSheet.jsx` | +refSkillsPolaris useMemo, +handlePolarisToggled, +3 props AdvantagesPanel |

### Validation fonctionnelle ✅
- SR sans erreur
- Joueur : toggle pouvoir Polaris → plus de 403
- Pouvoir togglé ON → apparaît dans SkillsPanel immédiatement
- Pouvoir togglé OFF → disparaît de SkillsPanel immédiatement
- Onglet "Matériel" visible et fonctionnel dans la fenêtre personnage
- ⏳ Chantier 10 sprint 2 (`char_inventory`) — prérequis : ref_equipment peuplée ✅
---

## Session 51 — 2026-05-07

### Chantier 10 sprint 2 — Module Inventaire (`char_inventory`)

**Contexte**
Planification complète en début de session : analyse critique du PLAN_INVENTORY.md produit en amont, correction de 7 erreurs (URL routes, nom colonne `location` vs `locations`, conflit onglet WoundManager, naming WS, modèle slots T/C/B/J vs BG/BD/JG/JD). Décision : Modèle A (slot = valeurs `ref_equipment.location`). Plan validé pour implémentation.

**Migration 50 — `50_char_inventory.js` ✅**
- `CREATE TABLE char_inventory` : UUID PK, FK `characters` CASCADE, FK `ref_equipment` SET NULL, `container VARCHAR(20)` DEFAULT 'Coffre', `slot VARCHAR(20)` nullable, `quantity INTEGER` CHECK > 0, `custom_name/custom_desc/notes/custom_props JSONB`, timestamps
- `ALTER TABLE char_sheet ADD COLUMN sols INTEGER NOT NULL DEFAULT 0`
- 3 index partiels : `character_id`, `equipment_id WHERE NOT NULL`, `slot WHERE NOT NULL`
- Constraint `chk_inventory_quantity` via raw SQL

**`server/src/lib/charStats.js` ✅**
- Ajout `calcEncumbrancePenalty(totalWeight, forValue)` : `MAX(0, CEIL(totalWeight - forValue*3))`
- Fonction pure, cohérente avec la convention du fichier

**`shared/events.js` ✅**
- Ajout `INVENTORY_ADDED / INVENTORY_UPDATED / INVENTORY_REMOVED / SOLS_UPDATED`

**`server/src/routes/character/char-sheet.js` ✅**
- Import `calcEncumbrancePenalty` ajouté
- 3 helpers privés : `isContainerAvailable`, `getDefaultContainer`, `getItemWithRef` (JOIN avec ref_equipment)
- 5 routes ajoutées en fin de fichier :
  - `GET /:characterId/inventory` — items + sols + total_weight + ini_penalty + threshold
  - `PUT /:characterId/sols` — P46 : déclarée AVANT `/:itemId`
  - `POST /:characterId/inventory` — stacking + validation container/slot + default container
  - `PUT /:characterId/inventory/:itemId` — P13 + slot force Sac + conflit slot (PI2)
  - `DELETE /:characterId/inventory/:itemId` — décrément ou DELETE complet
- Logique container : Sac disponible si ≥1 item `ref_equipment.location='D'`, Ceinture si `location='Ce'`, Coffre toujours
- Encombrement : items `container='Coffre'` exclus du calcul poids
- FOR = `base_level + pc_modifier` depuis `char_attributes WHERE attr_id='FOR'`

**`client/src/character/InventoryPanel.jsx` ✅ (NOUVEAU)**
- Pattern WoundManager : state interne, fetch propre (pas de WS listeners — socket non disponible dans CharacterWindow V1)
- Header : poids total / seuil / malus INI si > 0 / sols (cliquable si canEdit)
- Items groupés par container (Sac → Ceinture → Coffre)
- Par item : nom (custom_name || ref_name), quantité ×N, slot [T] si équipé, poids
- Actions canEdit : select container (availableContainers calculé depuis items), select slot (container='Sac' uniquement), bouton ✕ delete
- Edge case : container actuel toujours dans les options même si devenu indisponible
- Bloc "Ajouter" visible uniquement si `isGm` :
  - Chargement lazy `GET /api/equipment` (636 items) au premier clic
  - Filtre client-side nom/category/family — 50 résultats max affichés
  - Confirmation : quantité + container (availableContainers uniquement) → POST
  - Stacking auto géré côté serveur

**`client/src/character/CharacterWindow.jsx` ✅**
- Import InventoryPanel
- Onglet 'materiel' : WoundManager + InventoryPanel (canEdit + isGm props)
- Commentaire "Étape 1" retiré

**Pièges documentés dans PLAN_INVENTORY.md**
- PI1 : container 'Sac' non disponible si pas d'item location='D' → default 'Coffre'
- PI2 : équipement (slot ≠ null) → container forcé 'Sac' ; si indisponible → 400 (jamais silencieux)
- PI3 : items équipés (slot ≠ null) toujours comptés dans l'encombrement (container='Sac')
- PI4 : FOR nette = base_level + pc_modifier (pas seulement base_level)
- PI5 : items manuels (equipment_id null) : ref_weight null → exclus du calcul poids

**Bug diagnostiqué en test**
Migration 50 appliquée avec succès mais serveur démarré avant appliquation → "relation char_inventory does not exist". Fix : rollback + migrate:latest → table confirmée dans `public`. À retenir : toujours SR après migration.

**Décisions**
- Transfert entre personnages : reporté chantier dédié (WS bidirectionnel, validation double MMO-style)
- WS listeners InventoryPanel V1 : non implémentés (socket non threaded dans CharacterWindow) — serveur broadcast les events pour future intégration
- Édition sols côté owner : possible actuellement (canEdit), restriction GM-only reportée chantier futur
- Slot = valeurs `ref_equipment.location` (Modèle A) : T/C/B/J/C/B/J/T/C/B/J


---

## Session 52 — 2026-05-07

### Intégration malus INI/jets — blessures + encombrement

**Contexte et règle documentée (LdB p.236 + règle maison)**
Discussion critique avant implémentation : les malus d'état de santé (blessures) sont non-cumulatifs entre eux — pire blessure seule retenue. Le malus d'encombrement est une règle maison séparée qui s'additionne au malus santé.
```
effectiveMalus = calcWoundPenalty(wounds)   — malus santé ≤ 0, pire blessure
              − calcEncumbrancePenalty()    — malus encombrement ≥ 0, règle maison
// effectiveMalus toujours ≤ 0
```
Décision UX : malus affiché une seule fois sur Initiative (pas sur chaque compétence — 120 lignes en rouge = bruit, pas information).

**`server/src/routes/character/char-sheet.js`**
- Import `calcWoundPenalty` ajouté
- GET /wounds : réponse enrichie `{ wounds, wound_penalty: calcWoundPenalty(wounds) }`

**`client/src/character/CharacterSheet.jsx`**
- États : `woundPenalty` (≤0) + `encumbrancePenalty` (≥0)
- Fetch parallèle GET /wounds + GET /inventory dans load() — try/catch indépendant, non-bloquant
- `effectiveMalus = woundPenalty - encumbrancePenalty`
- `iniTooltip` useMemo — sans malus : texte LdB p.213 verbatim ; avec malus : détail par source
- `iniValue = secondary.rea + effectiveMalus`
- BLOC 4 Initiative : valeur `iniValue`, rouge `#e05c5c` si actif, tooltip
- `SecondaryField` : tooltip `position: fixed` + `getBoundingClientRect()` — échappe `overflow:hidden` sans modifier le parent (standard pro, évite React Portal)

**`server/src/socket/index.js`**
- Imports : `calcWoundPenalty, calcEncumbrancePenalty` ajoutés
- `let effectiveMalus = 0` déclaré aux côtés de `mechanicalTotal`
- Dans `if (sheet)` : fetch wounds + calcul poids inventaire (miroir exact GET /inventory) + `effectiveMalus = woundPenalty - encumbrancePenalty`
- `chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus`
- `effectiveMalus` dans payload DICE_RESULT (pour affichage futur dans le chat)
- Guard try/catch indépendant — fallback 0 si calcul échoue

### Validation fonctionnelle ✅
- SR sans erreur
- Fiche sans blessure : hover Initiative → tooltip LdB p.213
- Fiche avec blessure grave : Initiative rouge (−5), tooltip affiche REA base / Malus blessures / Initiative effective
- Jet de compétence avec blessure : chancesDeReussite réduite dans le chat

## Session 54 — 2026-05-08

### Contexte
Session 53 livrait ArmorWoundPanel multi-couches + poids brut. Utilisateur signalait : équiper Pagan sur Bras Gauche l'équipait aussi sur Bras Droit (même slotCode 'B'). Idem jambes 'J'. Pas de déplacement, équipement indépendant par localisation demandé.

### Problème racine
`LOCATION_TO_SLOT` mappait `bras_gauche → 'B'` ET `bras_droit → 'B'` (Polaris : armure couvre la paire). Avec le multi-slot indépendant (`slot='T/BG'`), les deux bras partageaient le même code → équiper à l'un affichait partout.

### Solution — Codes distincts BG/BD/JG/JD

**`shared/armorConstants.js`**
- LOCATION_TO_SLOT : `bras_gauche:'BG'`, `bras_droit:'BD'`, `jambe_gauche:'JG'`, `jambe_droite:'JD'`
- Nouveau export SLOT_TO_REF_LOCATION : `{ BG:'B', BD:'B', JG:'J', JD:'J', T:'T', C:'C' }`
  Mappe chaque code vers le code `ref_equipment.location` pour la compat (Pagan `ref_location='T/C/B/J'` couvre BG et BD)

**`client/src/character/LocationPanel.jsx`**
- Import SLOT_TO_REF_LOCATION ajouté
- `refCode = SLOT_TO_REF_LOCATION[slotCode] ?? slotCode` — convertit 'BG' → 'B' pour lookup `ref_location`
- `availableItems` : utilise `refCode` au lieu de `slotCode` pour la compat
  - `i.ref_location?.split('/').includes(refCode)` — Pagan ref_location='B' inclut 'B' ✓
- `equippedItems`, `handleEquip`, `handleUnequip` : inchangés, utilisent `slotCode` pour les slots individuels
- Aucun impact ContainerPanel (D/Ce intacts)

**`server/src/routes/character/char-sheet.js`**
- VALID_SLOTS ligne 757 : `['T','C','BG','BD','JG','JD','D','Ce']` (remplace 'B', 'J', 'C/B/J', 'T/C/B/J')
- PUT handler BASE_ARMOR : `new Set(['T','C','BG','BD','JG','JD'])`
- POST handler ligne 940 : WHERE slot changeé en LIKE query pour compter les couches multi-slot
  `whereRaw("'/' || COALESCE(char_inventory.slot, '') || '/' LIKE ?", [`%/${resolvedSlot}/%`])`

**Migration 51** — `server/src/db/migrations/51_inventory_slot_codes.js`
- Nullifie slots stales dans char_inventory :
  `UPDATE char_inventory SET slot = NULL WHERE slot ~ '(^|/)(B|J)(/|$)'`
  Regex : match 'B' ou 'J' comme segment complet (exclut BG, BD, JG, JD)
- ref_equipment.location intouché — B/J persistent, le mapping client gère la compat

### Flux utilisateur validé ✅
1. Pagan `ref_location='T/C/B/J'` en sac
2. Équipe Tête → slot='T', visible uniquement en Tête ✓
3. Équipe Bras Droit → slot='T/BD', visible en Tête ET Bras Droit ✓
4. Équipe Bras Gauche → slot='T/BD/BG', visible en Tête + deux bras ✓
5. Retire Tête → slot='BD/BG', Tête libérée ✓
6. Sélectionne autre armure à Tête → indépendant, aucun déplacement ✓
7. Jambes → independent per-leg logic ✓

### États finaux
- SR : migration 51 exécutée, slots stales B/J nullifiés
- Poids brut : affiché avec couleur (gris < 75%, orange 75-99%, rouge ≥100%)
- Poids max : FOR × 3 (serveur retourne `threshold` dans GET /inventory)
- UI : ArmorWoundPanel colonnes adaptées, silhouette 50% centré
- Multi-couche : fonctionne sur toutes les localisations
### **2026-05-09 — Session 54 (Localisation des Armes)**

**Tâche** : Assigner une `location` à toutes les armes (`M`, `2M`, `2M/Tr`, `Tr`, `NULL`).  
**Statut** : ✅ **Terminé**.

---

#### **Actions Exécutées**


| **Catégorie**           | **Localisation** | **Nombre de Lignes** | **Requête SQL**                                                                                                                                                                                       | **Statut** |
| ----------------------- | ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Accessoires pour armes  | `NULL`           | 16                   | `UPDATE ref_equipment SET location = NULL WHERE family = 'Armes' AND category = 'Accessoires pour armes';`                                                                                            | ✅          |
| Armes de poing          | `M`              | 19                   | `UPDATE ref_equipment SET location = 'M' WHERE family = 'Armes' AND category = 'Armes de poing';`                                                                                                     | ✅          |
| Armes d'épaule          | `2M`             | 20                   | `UPDATE ref_equipment SET location = '2M' WHERE family = 'Armes' AND category = 'Arme d''épaule';`                                                                                                    | ✅          |
| Armes lourdes           | `2M/Tr`          | 10                   | `UPDATE ref_equipment SET location = '2M/Tr' WHERE family = 'Armes' AND category = 'Arme lourde';`                                                                                                    | ✅          |
| Armes de contact        | `M`/`2M`         | 39                   | `UPDATE ref_equipment SET location = CASE WHEN name LIKE '%2M%' OR name LIKE '%2 mains%' OR name LIKE '%deux mains%' THEN '2M' ELSE 'M' END WHERE family = 'Armes' AND category = 'Arme de contact';` | ✅          |
| Armes de trait          | `2M`             | 6                    | `UPDATE ref_equipment SET location = '2M' WHERE family = 'Armes' AND category = 'Arme de trait';`                                                                                                     | ✅          |
| Armes de jet            | `M`              | 15                   | `UPDATE ref_equipment SET location = 'M' WHERE family = 'Armes' AND category = 'Armes de jet';`                                                                                                       | ✅          |
| Lanceurs                | `2M`             | 6                    | `UPDATE ref_equipment SET location = '2M' WHERE family = 'Armes' AND category = 'Lanceur';`                                                                                                           | ✅          |
| Armes sous-marines      | `2M`             | 10                   | `UPDATE ref_equipment SET location = '2M' WHERE family = 'Armes' AND category = 'Armes sous-marines à projectiles';`                                                                                  | ✅          |
| Armes à supercavitation | `2M`             | 6                    | `UPDATE ref_equipment SET location = '2M' WHERE family = 'Armes' AND category = 'Armes à supercavitation';`                                                                                           | ✅          |
| Armes étourdissantes    | `2M`/`M`         | 11                   | `UPDATE ref_equipment SET location = CASE WHEN name LIKE '%Pistolet%' THEN 'M' ELSE '2M' END WHERE family = 'Armes' AND category = 'Armes étourdissantes et soniques';`                               | ✅          |
| Grenades                | `M`              | 15                   | `UPDATE ref_equipment SET location = 'M' WHERE family = 'Armes' AND category = 'Grenade';`                                                                                                            | ✅          |
| Armes à énergie         | `2M`/`M`/`Tr`    | 13                   | Traité manuellement par Saar.                                                                                                                                                                         | ✅          |
| Armes massives          | `Tr`             | 8                    | `UPDATE ref_equipment SET location = 'Tr' WHERE family = 'Armes' AND (category = 'Arme à énergie' AND name LIKE '%Canon%' OR category = 'Armes à supercavitation') AND location != '2M/Tr';`          | ✅          |


---

#### **Résultats Finaux**


| **Localisation** | **Nombre d'Armes** | **Exemples**                                           |
| ---------------- | ------------------ | ------------------------------------------------------ |
| `NULL`           | 16                 | Silencieux, Trépied, Système de tir assisté, etc.      |
| `M`              | 87                 | Couteau Congre, ANG 200, Grenade à fragmentation, etc. |
| `2M`             | 60                 | AX 56, FAV 76, Arbalète Leysur IV, etc.                |
| `2M/Tr`          | 11                 | Gatling micro Cyclone, Fusil Gauss, etc.               |
| `Tr`             | 12                 | Faisceau Pulsar, Désintégrateur, etc.                  |


---

#### **Points à Valider**

1. **Armes en `Tr**` : Confirmer que ces armes (ex: Faisceau Pulsar) sont bien **non portables** sans trépied.
2. **Armes en `2M/Tr**` : Confirmer que ces armes (ex: Gatling micro Cyclone) peuvent être **portées en `2M` mais nécessitent un `Tr` pour une utilisation optimale.
3. **Intégration Frontend** :
  - `M` → Choix entre `MG`/`MD` côté client.
  - `2M/Tr` → Gestion des slots `2M` + `Tr`.
  - `Tr` → Slot dédié pour les armes massives.

---

#### **Prochaines Étapes Proposées**

1. **Mettre à jour `armorConstants.js**` pour inclure `M`, `Tr`, et `2M/Tr`.
2. **Vérifier l'impact sur le frontend** (affichage des slots, équipement).
3. **Passer à la mise à jour des munitions** (ex: `caliber`, `current_ammo`).

---

**Fin de la tâche "Localisation des Armes".**
Session 55 — 2026-05-10

    Roadmap : Restructuration complète de ROADMAP.md par domaines fonctionnels (Tactique, Économie, Moteur). Intégration du système d'initiative Polaris et du HUD de combat contextuel.

    Dette Technique : Correction de .gitattributes. Normalisation globale en eol=lf. Nettoyage des lignes de commande parasites dans le fichier. Commit 264281f effectué.
---

## Session 55 — 2026-05-19

### Chantier 10 sprint 4 — Module Armes équipées

**Périmètre livré**
- Armes 1 main (slots MG/MD) uniquement en v1. Armes 2M/Tr ignorées (décision Saar).
- Migration 52 : colonne `char_inventory.current_ammo UUID FK ref_equipment.id SET NULL`
- `shared/armorConstants.js` : ajout MG/MD/2M/Tr dans LOCATION_TO_SLOT + SLOT_TO_REF_LOCATION
- `char-sheet.js` : WEAPON_SLOTS constant, SELECT +6 champs arme+munition, branch POST/PUT armes (exclusivité 2M↔MG/MD, PI2 Sac, current_ammo validation caliber)
- `InventoryPanel.jsx` : VALID_SLOTS corrigé (bug dormant depuis migration 51 — codes B/J stales)
- `WeaponPanel.jsx` (NEW) : liste armes équipées, stats DMG/CHC/PTÉ/TIR/CAL, munition chargée, rechargement automatique (silence si aucune ammo compatible), équipement depuis stock, déséquipement
- `CharacterWindow.jsx` : WeaponPanel monté entre ArmorWoundPanel et InventoryPanel

**Bugs détectés et corrigés en session**
- **Crash React 409** : `errorHandler.js` envoie `{ error: { status, message } }` — objet imbriqué. WeaponPanel lisait `?.error` (objet) et le rendait en JSX. Corrigé → `?.error?.message` sur les 3 handlers (unequip, reload, equip). Voir PI9.
- **Calibre manquant** : `ref_caliber` non affiché dans la statsRow. Ajout de la ligne `CAL xxx`.

---

### Chantier données — Nettoyage nomenclature munitions

**Problème identifié**
Les noms de munitions contenaient un qualificatif d'arme redondant (`- Arme de poing`, `- Fusil de précision`…) alors que `caliber` est le seul lien de compatibilité (règle JARMES.md). Résultat : 9mm avait 9 entrées pour 5 types réels.

**Décisions (Saar)**
- Périmètre : tous les calibres
- Format retenu : `{calibre} - Munition {type}` pour balles balistiques (ex: `9 mm - Munition HP`)
- Carreaux/Flèches/Darts : `{famille} - Projectile {type}` (conservent "Projectile")
- Capsules / GPs / Pénétrants : inchangés
- "Standard" en premier dans les listes (tri WeaponPanel)

**Migration 53 — Deux phases**
- Phase 1 — Fusions (11 groupes) : UPDATE char_inventory.current_ammo vers l'entrée gardée + DELETE doublons
  - 9mm : HP×2, IEM×2, assommante×2, standard×2 → 4 fusions
  - 5.45mm : standard×2 → 1 fusion
  - 7.62mm : standard×5→1 (4 supprimées), SAP×2→1 → 5 fusions
  - 12.7mm : standard×2→1 → 1 fusion
- Phase 2 — Renommages : 89 entrées, nom explicite par-nom (`where({ name: from })`), sans regex
- `down()` : inverse les renommages — fusions irréversibles (documenté)

**WeaponPanel — tri munitions**
`availableAmmoFor` : `.sort()` ajouté — "standard" en premier (includes), puis `localeCompare('fr')`.
Affecte aussi `handleReload` qui prend `compatAmmos[0]`.

**Piège découvert (PI10)**
`2_seed_equipment.js` NE PAS rejouer après migration 53 — réinsérerait 636 items aux anciens noms sans erreur (pas de UNIQUE sur `name`).

---

## Session 56 — 2026-05-19

### Chantier 10 sprint 5 — Mille-feuille serveur + polarisRound unifié + ref_min_str

**Décisions préalables**
- `polarisRound` déclaré règle unique d'arrondi — source unique dans `shared/polarisUtils.js`, jamais redéfini localement.
- Rounding mille-feuille : `polarisRound(rest / 2)` confirmé (LdB p.312 : pas d'arrondi explicite → standard Polaris appliqué).
- Carence FOR : `−1 par point de FOR manquant`, appliqué à tous les jets (LdB).
- Affichage carence FOR (rouge si FOR < min_str) reporté à Chantier 11 sprint 3 — nécessite fetch attributs dans ArmorWoundPanel, logiquement groupé avec la résolution dommages en combat.

**Livré**
- `shared/polarisUtils.js` (NOUVEAU) — `polarisRound(x) = Math.floor(x + 0.4)` — source unique
- `server/src/lib/charStats.js` :
  - Import `polarisRound` depuis shared — définition locale supprimée
  - `calcResistanceArmure(equippedItems)` → `{ etq, prt }` — mille-feuille avec polarisRound (par slot)
  - `calcCarenceArmure(equippedItems, forNA)` → carence ≥ 0 (pire min_str − forNA, tous jets)
- `client/src/character/CharacterSheet.jsx` : import depuis shared — `const polarisRound` locale supprimée
- `client/src/character/LocationPanel.jsx` : import depuis shared — `calcMillefeuille` utilise `polarisRound`
- `server/src/routes/character/char-sheet.js` : `ref_equipment.min_str as ref_min_str` ajouté dans les 2 SELECT GET /inventory

**Aucune migration** — `min_str` existait déjà en base (migration 48).

**Piège documenté (PI11)**
`polarisRound` = source unique `shared/polarisUtils.js`. Jamais redéfini localement. Import : `'../../../shared/polarisUtils.js'`.
