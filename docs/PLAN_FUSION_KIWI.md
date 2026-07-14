# PLAN_FUSION_KIWI.md — Fusion frontend Kiwi (Enclume-codex) + backend actuel
> Créé : 2026-07-14 — Session fusion-kiwi
> Corrigé après analyse critique indépendante (agent Plan, lecture fraîche des fichiers réels) — voir "Corrections issues de l'analyse critique" avant "Plan d'exécution".
> ✅ CLOS 2026-07-14 (Session 142) — fonctionnel confirmé Saar en navigateur. Détail complet :
> `docs/JOURNAL6.md` "Session 142". Suite possible : `[SURF-COLLISION]` (`docs/EN_COURS.md`),
> chantier séparé non cadré ici.

---

## Contexte et historique de ce chantier (à lire avant tout)

Deux copies du projet coexistent sur le même serveur :
- **Copie principale** (`c:\Users\Nemet\Documents\Enclume`, branche `fusion-kiwi`) — Saar : tout le backend (142 migrations), Wizard, Combat, Coffre, Moding, documentation à jour. Git actif, HEAD à Session 141.
- **Copie secondaire** (`Enclume-codex/Enclume-codex/`) — Kiwi : prototype frontend de terrain 3D en relief, censé remplacer le système de cartes en voxels. Figée au commit Session 84, **aucun historique Git pour le travail de Kiwi lui-même** (fichiers jamais committés, `git log --all` vide dessus).

**Objectif tranché par Saar, sans ambiguïté (voir citations exactes plus bas)** :
> "MOI VOULOIR FRONTEND KIWI. POINT. EDITEUR KIWI OUI, EDITEUR VOXEL NON, PLAYGROUND KIWI OUI, PLAYGROUND VOXEL NON."
> "Pathfinding et collision comme TOUTES LES FONCTIONNALITES manquantes ne sont pas à implanter. Ce sont des chantiers à part. Là, le chantier c'est la fusion de ce qui existe côté Kiwi (front-end) et ce qui existe côté Saar (back-end)."
> "Mon travail n'est pas de redécider quoi que ce soit, c'est de prendre ce que Kiwi a écrit et le fusionner dans notre structure actuelle." — confirmé par Saar : "OUI ! ENFIN !"

**Ce que ça signifie concrètement** :
- Portage **mécanique**, pas un redesign. Kiwi a déjà câblé la solution complète de son côté (éditeur + playground) — le travail consiste à reproduire ce câblage dans notre structure actuelle (nos stores, notre `SessionPage.jsx`, notre `battlemaps.js`), pas à le repenser.
- Pathfinding, collision, ligne de vue sur le nouveau modèle `surface_data` : **explicitement hors scope**. Restent sur `voxel_data` tel quel (inchangé, non démoli). Un combat sur une carte construite avec le nouvel éditeur ne sera pas garanti fonctionnel niveau collision — c'est un chantier séparé, assumé et accepté par Saar.
- Ne pas se soucier de préserver les cartes voxel existantes ("j'en ai rien à foutre").

**Erreurs commises et corrigées dans cette session, à ne pas répéter** :
1. Premier chantier ("Chantier A") = reskin visuel du rendu voxel existant (`DungeonTerrainScene`, dérivé de `voxel_data`) sans toucher à l'éditeur. **Erreur de périmètre** — Saar voulait le vrai remplacement (éditeur + playground), pas un habillage cosmétique. Code : swap `Canvas3D.jsx:910` `CulledVoxelScene` → `DungeonTerrainScene`. **Ce chantier reste en place tel quel** (il n'est pas faux, juste insuffisant) — le plan ci-dessous le complète, ne le défait pas, sauf au point 11 où `DungeonTerrainScene` redevient un simple repli.
2. Tentative parallèle de porter le "Générateur de matériaux" (`MaterialGeneratorTab.jsx`) dans l'Atelier (Workshop) — **retirée sur demande explicite de Saar** ("Retire, qu'on reparte sur une base saine"). Fichier restauré à l'état brut Kiwi (untracked, non modifié).
3. Plusieurs propositions de plan faites sur la base de `grep`/extraits de lignes au lieu d'une lecture complète des fichiers concernés — **corrigé** : tous les fichiers listés en section "Fichiers lus intégralement" ci-dessous ont été lus en entier avant ce plan, sur exigence explicite de Saar ("POURQUOI Tu commence pas par là ?!: LIRE ?!").

---

## Fichiers lus intégralement dans cette session (preuve de lecture, pas de grep)

**Côté Kiwi (`Enclume-codex/Enclume-codex/client/src/`)** :
- `components/Editor3D.jsx` (1101 lignes)
- `components/SurfaceEditorScene.jsx` (347 lignes)
- `components/SurfaceDungeonScene.jsx` (470 lignes)
- `lib/surfaceData.js` (997 lignes)
- `lib/buildDungeonTerrainMesh.js` (221 lignes)
- `lib/reliefGeometry.js` (380 lignes)
- `components/DungeonTerrainScene.jsx` (93 lignes)
- `components/Sidebar.jsx` — header (1-15) + barre d'outils surface complète (427-1150)
- `server/src/routes/battlemaps.js` — route `PUT /:id/surface` complète (270-360) + `POST /:id/duplicate`

**Côté actuel (`client/src/`, `server/src/`)** :
- `components/Editor3D.jsx` (781 lignes, entier)
- `pages/SessionPage.jsx` (1037 lignes, entier)
- `components/Sidebar.jsx` (2470 lignes, entier)
- `components/Canvas3D.jsx` (chunks ciblés : imports, ligne 910, useEffect voxels/textureMaterials ~1200-1284)
- `server/src/routes/battlemaps.js` (416 lignes, entier)
- `lib/pathfinder.js`, `lib/redis.js` (collision), `lib/losService.js`, `lib/useCameraLOS.js` — confirmés 100% basés sur `voxel_data`, aucune lecture de `surface_data` (audit dédié, hors scope de ce chantier)

---

## Corrections issues de l'analyse critique

Une analyse critique indépendante (agent frais, relecture complète des fichiers réels, aucune
confiance a priori dans les citations du premier passage) a confirmé l'architecture générale du
plan mais trouvé **un bug bloquant non documenté** et **une violation de convention** à corriger
avant tout code. Verdict complet : plan non exécutable tel quel, corrections ci-dessous intégrées
au "Plan d'exécution".

### Correction bloquante 1 — chargement des textures dans `Canvas3D.jsx` (point 11)

Fausse affirmation du premier passage : `surfaceData` n'est **pas** un `useState`+`useEffect`
synchronisé comme `voxels` — chez Kiwi c'est une constante dérivée à chaque rendu :
`const surfaceData = normalizeSurfaceData(battlemap?.surface_data)` (pas de state, pas d'effect).

**Vrai problème bloquant** : le `useEffect` de chargement des textures (actuel, lignes 1211-1284)
ne calcule `voxelTexIds` que depuis `battlemap.voxel_data`. Sur une carte construite uniquement
avec le nouvel éditeur de surfaces (`voxel_data` vide), `textureMaterials` sera mis à `{}` —
**aucune texture ne sera chargée**, la carte s'affichera sans texture en mode jeu même si l'éditeur
(qui charge toute la palette sans filtre) fonctionne normalement. Bug silencieux, invisible si le
test se fait uniquement dans l'éditeur.

**Correction** : importer aussi `surfaceTextureIds` depuis `../lib/surfaceData.js` (fonction déjà
présente, vérifiée), fusionner `[...voxelTexIds, ...surfaceTextureIds(battlemap?.surface_data)]`
avant l'appel `/voxel-textures?ids=...`, et ajouter `battlemap?.surface_data` aux dépendances du
`useEffect`.

**Plomberie oubliée** : dans `Canvas3D.jsx`, le montage `hasSurfaceContent(...) ? <SurfaceDungeonScene/> : <DungeonTerrainScene/>`
se trouve dans un sous-composant `Scene()` (ligne 366) distinct du composant `Canvas3D` par défaut
(ligne 1122) qui détient `battlemap`. Il faut (a) ajouter `surfaceData` à la déstructuration des
props de `Scene()`, et (b) le passer explicitement à `<Scene ... surfaceData={surfaceData} />`
lors de son instanciation (~ligne 1299-1327) — sinon `surfaceData` n'est jamais visible à
l'intérieur de `Scene()`.

### Correction bloquante 2 — i18n sur la barre d'outils Sidebar (points 15-16)

Le bloc `roomTool` porté depuis Kiwi contient des dizaines de chaînes françaises codées en dur
sans accents (`Sol`, `Mur`, `Escalier`, `Plafond`, `Supprimer`, `Niveau`, `Epaisseur sol`,
`Materiau applique au trace`, `Peinture`, `Usure`, `Salete`, `Relief reel`, `Collision`, `Plein`/
`Verre`/`Grille`, "Maintiens clic gauche et tire pour...", "Annuler la derniere action (Ctrl+Z)",
etc.) — violation directe de `.claude/rules/react.md` ("jamais de string UI hardcodée — toujours
`useTranslation`"). 100% du reste de `Sidebar.jsx` (actuel et Kiwi) passe par `t(...)`.

**Correction** : ajouter une étape — créer les clés `sidebar.surfaceTool.*` dans
`client/src/locales/fr.json` (une par chaîne listée ci-dessus) et les substituer via `t(...)`
avant de committer ce bloc, au lieu de copier les chaînes en dur telles quelles.

### Corrections mineures (non bloquantes, à appliquer en codant)

- **Point 4** : `SessionPage.jsx` doit importer `DEFAULT_SURFACE_MATERIAL_PRESET` depuis
  `../lib/proceduralMaterials.js` (nécessaire pour l'état initial `surfaceTool`) — le plan ne le
  mentionnait que pour `Sidebar.jsx` (point 13), pas pour `SessionPage.jsx`. Sans cet import,
  `ReferenceError` au montage.
- **Point 5** : Kiwi passe `canSurfaceUndo={canSurfaceUndo && activeEditorTab !== 'entity'}` (idem
  redo) à `<Sidebar>`, pas le state brut — garde-fou pour désactiver undo/redo hors de l'onglet
  surface. À reproduire.
- **Point 9** : micro-race auto-corrective héritée telle quelle de Kiwi (`saveFireAndForget` et
  `saveSurfaceFireAndForget` peuvent s'écraser transitoirement dans le store Zustand local si les
  deux se déclenchent dans le même tick — la DB reste correcte, deux `PUT` indépendants sur deux
  colonnes). Non corrigée sciemment (portage mécanique, comportement déjà présent chez Kiwi).

### Angles morts trouvés, à trancher ou noter avant de coder

1. **Convention souris caméra incohérente** — Kiwi inverse `MIDDLE`/`RIGHT` sur `MapControls`
   dans les scènes portées (`MIDDLE: ROTATE, RIGHT: PAN`) par rapport à la convention actuelle
   partout ailleurs dans l'app (`MIDDLE: PAN, RIGHT: ROTATE`). Un portage verbatim introduirait un
   comportement souris différent selon l'onglet. **Décision retenue par défaut : garder notre
   convention actuelle (`MIDDLE: PAN, RIGHT: ROTATE`) dans les scènes portées, pour la cohérence
   UX globale de l'app — c'est un réglage de confort, pas un comportement fonctionnel voulu par
   Kiwi.** Signalé, pas bloquant, à corriger si Saar préfère l'inverse.
2. **Pas de synchronisation temps réel (WebSocket) pour `surface_data`** — contrairement à l'édition
   voxel (`WS.VOXEL_ADD/REMOVE/UPDATE`), aucun événement socket n'existe côté surface, ni chez
   Kiwi ni dans ce portage. Les autres clients connectés ne verront une modification de surface
   qu'après reload (auto-save 60s ou démontage). Régression fonctionnelle par rapport au système
   voxel, héritée de l'incomplétude de Kiwi — **accepté comme gap connu, chantier séparé** (même
   traitement que pathfinding/collision : non implémenté ici, pas bloquant pour ce chantier).
3. **Fichier orphelin `client/src/components/SurfaceDungeonScene.jsx_`** (underscore final,
   untracked, contenu divergent — implémentation de boulons différente). Reliquat, jamais importé
   nulle part. Laissé tel quel (untracked, ne sera jamais committé sans `git add` explicite) —
   signalé pour information, pas nettoyé dans ce chantier.
4. `editor-lock` (verrou d'édition) confirmé mort-code préexistant côté client — sans lien avec ce
   chantier, aucune action requise.
5. Carte sans `voxel_data` ni `surface_data` confirmée non bloquante (repli `DungeonTerrainScene`
   avec 0 voxel, aucun crash).
6. `activeEditorTab === 'entity'` confirmé non cassé par le portage.

---

## Plan d'exécution

### Backend

**1. Migration `143_battlemaps_surface_data.js`** (nouvelle, numéro vérifié libre) :
```js
export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.jsonb('surface_data').notNullable().defaultTo('{}')
  })
}
export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('surface_data')
  })
}
```
Identique à la migration 75 de Kiwi.

**2. `server/src/routes/battlemaps.js`** :
- Ajouter `PUT /:id/surface` — copie exacte de la route Kiwi (lignes 280-332 du fichier Kiwi, lue en entier) : validation `surface_data` objet, ownership GM, update colonne, recalcul `battlemap_texture_usage` depuis floors/walls(frontTex/backTex/topTex)/ceilings/stairs.
- `POST /:id/duplicate` (notre ligne ~332-347) : ajouter `surface_data: battlemap.surface_data ? JSON.stringify(battlemap.surface_data) : '{}'` à l'insert.

### Frontend — fichiers déjà présents (untracked), vérifiés purs/autonomes, à committer tels quels
**3.** `SurfaceEditorScene.jsx`, `SurfaceDungeonScene.jsx`, `surfaceData.js`, `ReliefBoxGeometry.jsx`, `reliefGeometry.js`, `proceduralMaterials.js`

### `client/src/pages/SessionPage.jsx`
**4.** Après ligne 96 (`availableBlocks`), ajouter : `surfaceTool` (state objet complet, calqué sur Kiwi `SessionPage.jsx` lignes 83-106), `surfaceUndoRequest`/`surfaceRedoRequest` (`useState(0)`), `canSurfaceUndo`/`canSurfaceRedo` (`useState(false)`).
**5.** Passer ces props à `<Editor3D>` (notre ligne 472-480) et `<Sidebar>` (notre ligne 535-557), mêmes noms que Kiwi.

### `client/src/components/Editor3D.jsx`
**6.** Import `SurfaceEditorScene`, `SurfaceDungeonScene`, `{ hasSurfaceContent, normalizeSurfaceData }` depuis `../lib/surfaceData.js`.
**7.** `EntityEditorScene` (nos lignes 70-246) : remplacer le rendu voxel systématique (lignes 226-231) par `hasSurfaceContent(surfaceData) ? <SurfaceDungeonScene surfaceData={surfaceData} textureMaterials={textureMaterials} showWater={false} ceilingOpacity={0.35} /> : Object.values(voxels).map(...)` (comme Kiwi lignes 324-338) — ajouter la prop `surfaceData` au composant.
**8.** **Supprimer `EditorScene`** (nos lignes 250-546, l'éditeur voxel actuel) — remplacé au montage par `SurfaceEditorScene`.
**9.** Composant principal `Editor3D` : ajouter `surfaceData` (state, init depuis `battlemap?.surface_data` via `normalizeSurfaceData`), `isSurfaceDirty`, `surfaceDataRef`, `surfaceUndoStackRef`/`surfaceRedoStackRef`, `surfaceSaveQueueRef`/`surfaceSaveRevisionRef`, `surfaceUndoDepth`/`surfaceRedoDepth`, `saveSurfaceFireAndForget`, `handleSurfaceDataChange`/`handleSurfaceUndo`/`handleSurfaceRedo`, effects de synchro undo/redo request + raccourci clavier Ctrl+Z/Ctrl+Y (copie quasi verbatim Kiwi lignes 755-1043). `voxels`/`isDirty`/`saveFireAndForget` existants restent inchangés (compat lecture EntityEditorScene).
**10.** `return` final (notre ligne 750-780) : remplacer le montage `EditorScene` par `SurfaceEditorScene` (props `surfaceData`, `onSurfaceDataChange={handleSurfaceDataChange}`, `textureMaterials`, `activeMaterial`, `surfaceTool`, `availableBlocks`), nouvelles props reçues (`surfaceTool`, `surfaceUndoRequest`, `surfaceRedoRequest`, `onSurfaceUndoStateChange`, `onSurfaceRedoStateChange`) ajoutées à la signature du composant.

### `client/src/components/Canvas3D.jsx`
**11.** Remplacer le montage actuel (`<DungeonTerrainScene voxels={voxels} textureMaterials={textureMaterials} />`, notre ligne 910 — Chantier A) par le pattern Kiwi complet :
```jsx
{hasSurfaceContent(surfaceData) ? (
  <SurfaceDungeonScene surfaceData={surfaceData} textureMaterials={textureMaterials} />
) : (
  <DungeonTerrainScene voxels={voxels} textureMaterials={textureMaterials} />
)}
```
Ajouter la dérivation `surfaceData` depuis `battlemap.surface_data` (nouveau, même pattern que le `useEffect` `voxels` existant ~lignes 1200-1209) + import `hasSurfaceContent`.

### `client/src/components/Sidebar.jsx`
**12.** Signature (notre ligne 468-483) : ajouter `surfaceTool, onSurfaceToolChange, canSurfaceUndo, canSurfaceRedo, onSurfaceUndo, onSurfaceRedo`.
**13.** Import `DEFAULT_SURFACE_MATERIAL_PRESET, PROCEDURAL_MATERIAL_PRESETS, PROCEDURAL_PATTERN_PRESETS` depuis `../lib/proceduralMaterials.js`.
**14.** Ajouter `surfaceToolState`/`updateSurfaceTool`/`surfaceMaterialState`/`surfacePaintValue`/`updateSurfaceMaterial` (copie exacte Kiwi lignes 453-487).
**15.** Dans le bloc `{mode === 'edit' && ...}` (nos lignes 798-911) : insérer le bloc undo/redo (Kiwi 776-801) puis la barre d'outils complète `roomTool` (Kiwi 814-1091 : boutons sol/mur/escalier/plafond/supprimer, élévation, épaisseurs par mode, matériau/motif/peinture/usure/saleté/relief/variations/collision/nouvelle variation) **avant** la palette de textures existante (qui reste identique — sert à peindre le matériau actif, réutilisée telle quelle par `SurfaceEditorScene` via `activeMaterial`).
**16.** `styles` : ajouter les clés `undoRow`, `undoBtn`, `undoBtnDisabled`, `roomTool`, `roomToolModes`, `roomToolModeBtn`, `roomToolModeBtnActive`, `roomToolGrid`, `roomToolLabel`, `roomToolInput`, `roomToolSelect`, `roomToolColorRow`, `roomToolColorInput`, `roomToolRangeRow`, `roomToolRange`, `roomToolRangeValue`, `roomToolToggle`, `roomToolToggleActive`, `roomToolToggleState`, `roomToolSectionTitle`, `roomToolSmallBtn`, `roomToolHint` — mêmes valeurs que Kiwi, même convention (objets JS inline, pattern déjà en place dans ce fichier).

---

## Ce qui n'est PAS dans ce plan (hors scope explicite)

- Pathfinding/collision/LOS sur `surface_data` — chantier séparé, non cadré ici.
- Démolition du code voxel (`Voxel.jsx`, `CulledVoxelScene.jsx`, `buildCulledMesh.js`, routes `voxel-textures`/`texture-packs`/`block-types`) — resteront en place tant que pathfinding/collision n'ont pas de remplaçant. Ne peuvent être démolis proprement qu'après ce chantier séparé.
- Migration/conversion des cartes voxel existantes vers `surface_data` — non demandée, non traitée.

## Vérification prévue avant livraison

- `node --check` sur les fichiers `.js` purs, ESLint sur les 5 fichiers modifiés (`SessionPage.jsx`, `Editor3D.jsx`, `Canvas3D.jsx`, `Sidebar.jsx`, `battlemaps.js`) + `git stash`/`pop` pour confirmer zéro nouvelle erreur introduite sur les fichiers déjà denses en warnings préexistants (`Canvas3D.jsx` notamment, 21 problèmes préexistants confirmés lors du Chantier A).
- Migration testée en base réelle (round-trip `up`/`down`).
- Scénario de test navigateur à proposer à Saar après codage (édition d'une salle sans voxel, sauvegarde, relecture en mode jeu).
