# ANALYSE_9AB.md — Mémoire externe planification Chantiers 9A + 9B
> Créé session 22 — 2026-04-08
--- OBSOLETE - REMPLACE PAR MOTEUR_MONDE.md ---

---

## Contexte

Projet Enclume — session 22 dédiée à la planification (aucun code).
Objectif : rédiger MISSION_chantier_9.md avec séquence précise, dépendances, pièges, découpage sessions.
Approche : lire chaque fichier impacté, inventaire factuel, puis méta-analyse, puis rédaction.

Référence principale : `docs/PLAN_VOXELS.md` (rédigé session 21 — aucun code écrit).

---

## Fichiers à lire (checklist)

- [x] PLAN_VOXELS.md — référence principale (lu session 22)
- [x] Canvas3D.jsx — fichier le plus impacté (lu session 22)
- [x] SessionPage.jsx — toggle Canvas3D ↔ Editor3D, activeMaterial, onPackLoaded
- [x] server/src/socket/index.js — VOXEL_ADD à mettre à jour, nouveau VOXEL_UPDATE
- [x] server/src/routes/battlemaps.js — PUT /voxels + nouvelles routes lock/heartbeat
- [x] shared/events.js — ajout VOXEL_UPDATE/VOXEL_UPDATED

---

## Canvas3D.jsx — inventaire factuel (659 lignes)

### Localisation précise des zones voxel

| Zone | Lignes | Description |
|---|---|---|
| `textureCache` | 39 | Module-level cache — à conserver, usage change |
| `loadPackTextures(pack)` | 41–67 | **Remplacée entièrement** — nouvelle fn par IDs |
| `Voxel` composant | 70–79 | **Réécrit** — dispatch géométrie + rotation |
| `[voxels, setVoxels]` | 573 | State — conservé |
| `[materials, setMaterials]` | 574 | State — type change (`{ [blockId]: { geometry, faceMaterials } }`) |
| `[packsLoaded, setPacksLoaded]` | 575 | **Gate à reconsidérer** — plus de notion "pack chargé" |
| Init depuis `battlemap.voxel_data` | 582–590 | **Modifié** — `mat` entier → `{ id, r }` |
| Chargement pack | 592–601 | **Remplacé** — `api.get('/textures')` → `api.get('/block-types?ids=...')` |
| `save()` | 605–615 | **Modifié** — `payload[key] = v.mat` → `payload[key] = { id: v.id, r: v.r }` |
| Rendu voxels | 527–534 | **Modifié** — `materialId={v.mat}` → `blockId={v.id} rotation={v.r}` |
| `handleClick` pose | 424–478 | **Déménage dans Editor3D** — entièrement |
| `handleVoxelAdded` WS | 258–261 | **Modifié** — `{ x, y, z, mat }` → `{ x, y, z, id, r }` |
| `getColumnTopY` | 286–292 | **Inchangé** — lit x/y/z, pas mat |
| Guard dimensions | 472 | **Inchangé** |

### Ce qui NE change PAS en 9A

TokenRing, TokenMesh, handleDragStart, handlePointerMove, handlePointerUp,
handleKeyDown (Suppr token), threeToDb, MapControls, lumières, Grid.

### Props Canvas3D après 9A (selon PLAN_VOXELS)

**Supprimées :** `mode`, `activeMaterial`, `onPackLoaded`
**Conservées :** `onTokenDoubleClick`, `socket`

### Observation clé

`packsLoaded` gate le rendu de `<Scene>` (ligne 640). Après refonte :
Canvas3D charge les blocs par IDs présents dans `voxel_data` (pas un pack entier).
Le gate devient `blocksLoaded` ou équivalent — à définir précisément.

---

## SessionPage.jsx — inventaire factuel (744 lignes)

### États concernés par la refonte 9A

| État | Ligne | Rôle | Sort en 9A |
|---|---|---|---|
| `mode` | 37 | `'play'` / `'edit'` | **Conservé** — contrôle le toggle Canvas3D ↔ Editor3D |
| `activeMaterial` | 41 | Entier (ID matériau actif) | **Supprimé** — déménage dans Editor3D |
| `availableMaterials` | 42 | Tableau des matériaux dispo | **Supprimé** — déménage dans Editor3D |

### Props Canvas3D à modifier (lignes 401–407)

Supprimées : `mode`, `activeMaterial`, `onPackLoaded`
Conservées : `onTokenDoubleClick`, `socket`

### Props Sidebar à modifier (lignes 411–425)

Supprimées : `activeMaterial`, `onMaterialChange`, `availableMaterials`
Conservées : toutes les autres

### Toggle à implémenter (ligne 401)

```jsx
// Avant
<Canvas3D ... />
// Après
{mode === 'edit' ? <Editor3D ... /> : <Canvas3D ... />}
```
Conteneur `<div style={styles.canvas}>` (ligne 392) conservé — seul le contenu change.

### Handlers WS — aucun impact 9A

Lignes 254–298 : TOKEN_MOVED, TOKEN_CREATED, TOKEN_DELETED, CHAT_MESSAGE,
CHARACTER_UPDATED, DICE_RESULT, MAP_SWITCH — tous inchangés.
Note : VOXEL_ADDED/REMOVED sont dans Scene (Canvas3D), pas ici.

### Observation clé

`mode` reste dans SessionPage (décide quel composant monter).
`activeMaterial` + `availableMaterials` : supprimés de SessionPage, état interne d'Editor3D.
Suppression chirurgicale — aucun impact sur le reste du fichier.

---

## events.js — inventaire factuel (34 lignes)

### Constantes voxel existantes
```
VOXEL_ADD / VOXEL_ADDED / VOXEL_REMOVE / VOXEL_REMOVED
```

### À ajouter pour 9A
```javascript
VOXEL_UPDATE:  'voxel:update',   // émis par Editor3D (rotation en place)
VOXEL_UPDATED: 'voxel:updated',  // broadcast serveur
```
Modification : 2 lignes dans le bloc voxels. Chirurgicale, zéro régression.

Note : TOKEN_UPDATED existe mais non utilisé selon ASBUILT — sans impact 9A.

---

## socket/index.js — inventaire factuel (388 lignes)

### Handlers voxel — localisation précise

**VOXEL_ADD (lignes 136–165)**
- Payload reçu : `{ battlemapId, x, y, z, mat }`
- Ligne 154 : `const next = { ...voxels, [key]: mat }` — stocke entier
- Ligne 161 : broadcast `{ battlemapId, x, y, z, mat }`
- **Modifié en 9A** : `mat` → `{ id, r }` payload + broadcast
  - L. 154 → `const next = { ...voxels, [key]: { id, r } }`
  - L. 161 → `emit(..., { battlemapId, x, y, z, id, r })`

**VOXEL_REMOVE (lignes 170–193)**
- Payload + broadcast : inchangés en 9A

**VOXEL_UPDATE — à ajouter après VOXEL_REMOVE**
- Spec complète dans PLAN_VOXELS (lignes 462–491) — rien à inventer
- Guard `battlemapId` obligatoire (pattern identique à VOXEL_ADD ligne 144)

### Observation
VOXEL_REMOVE n'a pas de guard `battlemapId` (contrairement à VOXEL_ADD ligne 144).
VOXEL_UPDATE doit l'avoir — prévu dans PLAN_VOXELS.

### Ce qui ne change pas en 9A
SESSION_JOIN, TOKEN_MOVE, TOKEN_CREATED, TOKEN_DELETED,
MAP_SWITCH, MAP_VIEWPORT, DICE_ROLL, CHAT_MESSAGE, CHARACTER_UPDATED, disconnect.

---

## battlemaps.js — inventaire factuel

### Routes existantes

| Route | Impact 9A |
|---|---|
| GET /campaigns/:id/battlemaps | Aucun |
| POST /campaigns/:id/battlemaps | Aucun |
| GET /battlemaps/:id | Aucun |
| PUT /battlemaps/:id | Aucun (grid_opacity, viewport_state déjà présents) |
| DELETE /battlemaps/:id | Aucun |
| PUT /battlemaps/:id/voxels | **Modifié** — recalcul battlemap_block_usage après save |
| POST /battlemaps/:id/duplicate | Aucun |

### PUT /battlemaps/:id/voxels — ajout après UPDATE

```javascript
const usedIds = [...new Set(Object.values(voxel_data).map(v => v.id))]
await db('battlemap_block_usage').where({ battlemap_id: req.params.id }).delete()
if (usedIds.length > 0) {
  await db('battlemap_block_usage').insert(
    usedIds.map(blockId => ({ battlemap_id: req.params.id, block_type_id: blockId }))
  )
}
```

### Routes à ajouter en 9A

- POST /battlemaps/:id/editor-lock — acquérir le lock
- DELETE /battlemaps/:id/editor-lock — libérer le lock
- POST /battlemaps/:id/editor-heartbeat — renouveler (30s)

Vérification lock : `editor_locked_by !== req.user.id && editor_locked_until > new Date()` → 423

### Observations

- `cover_image_url` cité en commentaire dans duplicate mais absent du schéma actuel.
- PUT /voxels a un try/catch local — les autres routes s'appuient sur errorHandler global. À conserver tel quel.

---

## shared/events.js — inventaire factuel

> À compléter après lecture du fichier.

---

## Méta-analyse — à rédiger après tous les fichiers lus

> À compléter.

---

## MISSION_chantier_9.md — à rédiger en fin de session

> À compléter.

---

## Méta-analyse

### 1. Vue d'ensemble des impacts réels

**Fichiers modifiés en 9A :**

| Fichier | Nature | Complexité |
|---|---|---|
| `shared/events.js` | +2 constantes | Triviale |
| `server/src/socket/index.js` | Modifier VOXEL_ADD (2 lignes) + ajouter VOXEL_UPDATE (~35 lignes) | Faible |
| `server/src/routes/battlemaps.js` | Modifier PUT /voxels + ajouter 3 routes lock | Moyenne |
| `client/src/components/Canvas3D.jsx` | Refonte chargement blocs + composant Voxel + save + WS handlers | **Élevée** |
| `client/src/pages/SessionPage.jsx` | Suppression 3 états + 3 props + toggle conditionnel | Faible |
| `client/src/components/Editor3D.jsx` | **Nouveau fichier complet** | **Très élevée** |
| `client/src/components/GeometryIcon.jsx` | **Nouveau fichier** (5 SVG) | Faible |
| `client/src/pages/SessionPage.jsx` | import Editor3D | Triviale |

**Fichiers nouveaux côté serveur (routes) :**
- `server/src/routes/block-types.js` — GET /block-types + GET /block-types?ids=
- `server/src/routes/texture-packs.js` — GET /texture-packs (lecture seule en 9A)
- Montage dans `server/src/index.js` (+2 lignes)

**Migrations (6) :**
- 21 : texture_packs
- 22 : battlemaps.editor_locked_by + editor_locked_until
- 23 : texture_pack_categories + block_types (ordre FK obligatoire)
- 24 : seed hard-sf
- 25 : one-shot voxel_data entier → { id, r }
- 26 : battlemap_block_usage

---

### 2. Séquence critique — dépendances réelles

La séquence du PLAN_VOXELS est correcte mais certaines dépendances méritent d'être explicitées :

**Bloc A — Fondation DB (migrations 21→26)**
Toutes les migrations doivent passer AVANT tout code serveur ou client.
Ordre interne obligatoire : 21 → 22 → 23 (categories AVANT block_types) → 24 → 25 → 26.
Migration 25 (one-shot) transforme les données existantes — irréversible.
Validation : `knex migrate:latest` sans erreur + vérifier la structure en DB.

**Bloc B — Serveur routes (block-types, texture-packs, battlemaps)**
Dépend du Bloc A (tables existent).
Peut être fait entièrement avant de toucher le client.
Validation : tester les routes avec curl/Insomnia avant de passer au client.

**Bloc C — shared/events.js + socket/index.js**
Dépend du Bloc A (conceptuellement) mais techniquement indépendant.
Peut être fait en parallèle avec Bloc B.
VOXEL_ADD modifié doit être déployé serveur + client en même temps (migration atomique).

**Bloc D — Canvas3D.jsx refonte**
Dépend de Bloc B (route GET /block-types?ids= doit exister).
Dépend de Bloc C (nouveaux payloads WS).
C'est le bloc le plus risqué — Canvas3D est en production pour les tokens.
Règle : les tokens ne doivent PAS régresser.

**Bloc E — Editor3D.jsx (nouveau)**
Dépend de Bloc C (émet VOXEL_ADD/UPDATE avec nouveau format).
Dépend de Bloc D (partage les stores Zustand, la scène R3F).
Peut être développé de façon incrémentale (squelette → raycasting → édition → undo/redo → lock).

**Bloc F — SessionPage.jsx + toggle**
Dépend de Bloc E (Editor3D doit exister pour être monté).
Modification chirurgicale — faible risque.

**Bloc G — Sidebar palette**
Dépend de Bloc B (données block_types disponibles) et Bloc E (Editor3D actif).
Peut être fait en dernier — la palette est un ajout, pas une modification.

---

### 3. Points de risque identifiés

**Risque 1 — Régression Canvas3D (CRITIQUE)**
Canvas3D est utilisé en production pour les tokens + voxels.
La refonte touche le chargement, le rendu voxel, les WS handlers, save().
Si une étape intermédiaire casse le rendu token → session de jeu inutilisable.
Mitigation : ordre strict — modifier Canvas3D APRÈS que les migrations et routes serveur sont validées. Tester les tokens après chaque sous-étape de Canvas3D.

**Risque 2 — Migration 25 irréversible**
La conversion `entier → { id, r }` sur voxel_data est one-shot.
Si les IDs dans les voxels existants ne correspondent pas aux IDs de block_types après seed → voxels orphelins affichés en magenta.
Mitigation : seed hard-sf (migration 24) doit assigner les IDs 1, 2, 3... dans le même ordre que les matériaux actuels. Vérifier le mapping avant de lancer la migration 25.

**Risque 3 — packsLoaded gate dans Canvas3D**
Actuellement `{packsLoaded && <Scene ... />}` — sans ce gate, Scene se montait avant que les textures soient prêtes.
Après refonte, le chargement est asynchrone par IDs. Si `voxel_data` est vide (carte sans voxels), `blockIds.length === 0` → pas de requête → que se passe-t-il ? Scene doit quand même se monter pour afficher les tokens.
Mitigation : le gate devient `blocksReady` = true dès que le chargement est terminé (même si 0 blocs). Guard explicite `if (blockIds.length === 0) { setBlocksReady(true); return }`.

**Risque 4 — Editor3D complexité**
Editor3D est un nouveau composant R3F avec raycasting, ghost voxel, Command Pattern, undo/redo, lock, heartbeat.
C'est la partie la plus longue du chantier. Si elle est sous-estimée, elle peut déborder sur plusieurs sessions.
Mitigation : découper en sous-étapes validables indépendamment (squelette fonctionnel → édition basique → undo/redo → lock).

**Risque 5 — Déploiement atomique VOXEL_ADD**
Le payload de VOXEL_ADD change (`mat` → `{ id, r }`).
Si serveur et client ne sont pas mis à jour ensemble : serveur envoie `{ id, r }`, vieux client lit `mat` → undefined → voxel pose silencieusement échoue.
Mitigation : dans l'ordre de la session — modifier socket/index.js + Canvas3D handleVoxelAdded dans la même session, tester immédiatement après.

---

### 4. Découpage sessions réaliste

**Session 9A-1 : Migrations + routes serveur (fondation)**
- Migrations 21→26 (Bloc A)
- Routes block-types.js + texture-packs.js (GET seul) (Bloc B)
- Montage index.js
- Modifier PUT /battlemaps/:id/voxels (battlemap_block_usage)
- Routes lock/heartbeat battlemaps.js
- Validation : toutes les routes testées curl/Insomnia
- Livrable stable : serveur complet pour 9A, client non touché

**Session 9A-2 : WS + Canvas3D refonte**
- events.js (+2 constantes) (Bloc C)
- socket/index.js VOXEL_ADD + VOXEL_UPDATE (Bloc C)
- Canvas3D : loadBlockTextures + composant Voxel + init voxel_data + save() + WS handlers (Bloc D)
- Validation : voxels existants affichés, tokens non régressés, pose/suppression fonctionnels
- Risque : session potentiellement longue — Canvas3D est dense

**Session 9A-3 : Editor3D squelette + édition**
- SessionPage toggle (Bloc F — simple, à faire en début)
- Editor3D squelette R3F + raycasting bounding box + ghost voxel (Bloc E)
- Editor3D pose + suppression + rotation R
- GeometryIcon.jsx (Bloc E)
- Validation : pose/suppression/rotation fonctionnels en mode édition

**Session 9A-4 : Editor3D undo/redo + lock + Sidebar palette**
- Editor3D Command Pattern undo/redo 50 actions
- Editor3D save auto 60s + save au démontage + dirty flag
- Editor3D heartbeat 30s
- Sidebar : palette blocs (Bloc G)
- Validation : critères 9A complets

---

### 5. Questions ouvertes à trancher avant de coder

**Q1 — Mapping IDs migration 25**
Les voxels existants en base ont des matériaux 1, 2, 3... correspondant aux matériaux du pack hard-sf actuel.
Le seed hard-sf (migration 24) doit assigner les mêmes IDs dans le même ordre.
Question : quel est l'ordre actuel des matériaux dans le manifest/textures existant ?
À vérifier avant de rédiger la migration 24 pour garantir la cohérence.

**Q2 — blocksReady gate**
Remplace `packsLoaded`. Nom exact et condition exacte à définir dans la spec Canvas3D.

**Q3 — Sidebar en mode édition**
Sidebar reçoit `mode` prop. En mode édition, elle affiche la palette.
La Sidebar actuelle a déjà un système d'onglets.
La palette est-elle un onglet supplémentaire ou remplace-t-elle tous les onglets ?
PLAN_VOXELS dit "même composant Sidebar, contenu conditionnel selon mode" — à confirmer.

**Q4 — Editor3D props**
PLAN_VOXELS dit que Canvas3D perd `mode`, `activeMaterial`, `onPackLoaded`.
Editor3D reçoit quoi exactement depuis SessionPage ?
Minimum nécessaire : `socket`, `battlemapId` (depuis useMapStore directement ?).


---

## Questions ouvertes — décisions tranchées

**Q1 — Mapping IDs migration 25 : RÉSOLU**
Le manifest actuel est du contenu de test jetable. Les voxels existants en base
sont également des données de test sans valeur.
Migration 25 peut écraser sans précaution.
Le seed hard-sf (migration 24) définit les IDs globaux de zéro — auto-incrémentés
depuis 1, dans l'ordre défini par le nouveau manifest propre à rédiger.
Pas de contrainte de rétrocompatibilité avec les données existantes.

**Q2 — blocksReady gate : RÉSOLU**
`blocksReady` = true dès que le chargement async des block_types est terminé,
que `blockIds.length` soit 0 ou non.
Guard explicite en tête : `if (blockIds.length === 0) { setBlocksReady(true); return }`
Nom retenu dans le code : `blocksReady`.

**Q3 — Sidebar palette en mode édition : RÉSOLU**
En mode `edit` : la Sidebar affiche uniquement la palette de blocs.
Les autres onglets sont masqués. Retour en mode `play` → onglets normaux.
Même composant Sidebar, contenu conditionnel sur `mode`.

**Q4 — Editor3D props : RÉSOLU**
Editor3D lit `battlemap` directement depuis `useMapStore()` (même pattern que Canvas3D).
SessionPage passe uniquement `socket` en prop.
Cohérent avec l'architecture existante — pas de prop drilling de données.

