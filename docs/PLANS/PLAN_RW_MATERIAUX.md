Plan de rework — Vue d'ensemble

Rédigé le : 2026-08-02
Objet : Guideline des lots pour la refonte du système de matériaux d'Enclume.
Usage : Ce document donne la vision globale. Chaque lot fera l'objet d'une analyse détaillée par un agent dédié.
Lot 0 — Refactor de l'éditeur

Objectif : Extraire la logique métier d'Editor3D.jsx en hooks et composants spécialisés, sans modifier aucun comportement.

Périmètre :

    Scinder Editor3D.jsx en modules distincts (voxels, surfaces, entités, sauvegarde, contrôles caméra).

    Créer des hooks réutilisables (useSurfaceEditor, useEntityEditor, etc.).

    Préserver l'intégralité des fonctionnalités existantes.

Dépendances : Aucune.

Critère de succès : Tous les tests passent, l'interface est inchangée.
Lot 1 — Textures de base

Objectif : Permettre à l'utilisateur de choisir une texture de base pour les surfaces, parmi les packs disponibles, et de l'appliquer aux murs, sols et plafonds.

Périmètre :

    Ajouter un sélecteur de texture dans les panneaux Salle et Mur.

    Connecter le système de packs de textures (texture_packs) aux outils de surface.

    Modifier proceduralMaterials.js pour accepter une texture de base comme entrée.

    Supprimer le toggle « Procédural / Texture » — une seule voie : texture + enrichissement.

Dépendances : Lot 0 (refactor de l'éditeur) recommandé.

Critère de succès : Toute salle reçoit une texture de base, l'utilisateur peut la changer, et la sauvegarde préserve ce choix.
Lot 2 — Filtres procéduraux

Objectif : Recâbler le pipeline procédural existant pour qu'il enrichisse la texture de base (usure, saleté, relief, motifs) sans la remplacer.

Périmètre :

    Modifier generateProceduralMaterialTexture pour superposer les effets à la texture plutôt que de générer la couleur de base.

    Conserver les sliders usure, saleté, relief et les sélecteurs motif dans l'interface.

    Ajuster le cache pour prendre en compte la texture de base.

Dépendances : Lot 1 (textures de base).

Critère de succès : Une même texture de base peut être rendue sale, usée, avec des motifs, produisant des variations visibles sans perdre son identité.
Lot 3 — Décals et motifs supplémentaires

Objectif : Exploiter les alpha/normal/height maps du bundle (câbles, grilles, boutons, rivets, etc.) comme nouveaux motifs procéduraux ou comme masques d'effets.

Périmètre :

    Ajouter de nouveaux PATTERN_PRESETS basés sur les décals.

    Permettre aux décals de servir de masques pour localiser l'usure ou la saleté.

    Étudier la possibilité d'importer de nouveaux décals via l'interface.

Dépendances : Lot 2 (filtres procéduraux).

Critère de succès : L'utilisateur peut ajouter des éléments fonctionnels (grilles, câbles, éclairages) en relief sur ses surfaces.
Lot 4 — Objets 3D et cohérence environnementale

Objectif : Peupler la scène avec des GLB et assurer leur cohérence esthétique avec la salle qui les contient (héritage optionnel de l'usure et de la saleté).

Périmètre :

    Convertir les objets 3D du bundle en .glb.

    Concevoir le mécanisme d'héritage des propriétés d'ambiance (déjà préparé : contrat RoomAmbientProperties, booléen inheritRoomEffects).

    Ajouter un toggle par entité pour activer/désactiver l'héritage.

Dépendances : Lot 2 (filtres procéduraux), lot 0 (refactor) recommandé.

Critère de succès : Un objet placé dans une salle peut automatiquement adopter son usure et sa saleté.
Résumé du contexte

Cette feuille de route fait suite à une analyse approfondie du système de matériaux existant, documentée dans MATERIAUX.md. L'architecture retenue est hybride exclusive : une texture de base obligatoire, enrichie systématiquement par le pipeline procédural (usure, saleté, relief, motifs). L'objectif est de permettre à un MJ de construire une station spatiale entière avec une poignée de textures variées automatiquement.

La documentation de l'état actuel (MATERIAUX.md v2, SURFACES_SALLES.md) et le plan V1 sont disponibles pour les agents qui prendront en charge chaque lot.
-----------------------------------------------------------------------------
Lot 0 — Refactor de l'éditeur (Editor3D.jsx)

Version : 1.0 — 2026-08-02
Statut : Prêt pour développement
Domaine : Éditeur 3D
1. Objectif

Extraire la logique métier du composant monolithique Editor3D.jsx (~1200 lignes) en hooks et composants spécialisés, sans modifier aucun comportement ni aucune interface utilisateur.
2. Architecture cible
text

Editor3D.jsx (~200 lignes) — coordination
├── VoxelEditorScene.jsx — scène d'édition voxel
├── EntityEditorScene.jsx — scène d'édition d'entités
├── useEditorRefs.js — refs partagées (battlemap, surfaceData, voxels)
├── useEditorSave.js — sauvegarde (voxels + surface, auto-save)
├── useSurfaceUndo.js — undo/redo surface
├── useEditorTextures.js — chargement des textures
├── useRuntimeState.js — effets runtime et ascenseurs
├── useSurfacePanels.js — état et handlers des panneaux flottants
├── editorConstants.js — constantes partagées
└── editorUtils.js — utilitaires partagés

3. Responsabilités détaillées
3.1 VoxelEditorScene.jsx

Extrait de : Fonction EditorScene (lignes ~180-650 de l'original).

Responsabilités :

    Rendu des voxels existants via le composant Voxel

    Ghost voxel (GhostVoxel) pour la prévisualisation de pose

    Ghost salle voxel (RoomSelectionGhost) pour l'outil salle voxel

    Gestion du clavier (touches fléchées pour le pan, touche R pour la rotation)

    Pose de voxels (clic gauche), suppression (clic droit court)

    Construction de salles voxel (buildRoomVoxels)

    Gestion de l'outil salle (roomTool)

Props :

    voxels, setVoxels — état des voxels

    textureMaterials — textures chargées

    activeMaterial, onActiveMaterialChange — matériau actif

    roomTool — outil salle voxel

    socket, battlemapId — communication serveur

    isDirty — ref indiquant si des modifications non sauvegardées existent

Dépendances :

    editorConstants.js (GRID_SIZE, ROOM_DEFAULTS)

    editorUtils.js (getVoxelKey, normalizeRoomSelection, buildRoomVoxels)

    Composants : Voxel, GhostVoxel, RoomSelectionGhost, MapControls, Grid

3.2 EntityEditorScene.jsx

Extrait de : Fonction EntityEditorScene (lignes ~180-550 de l'original).

Responsabilités :

    Rendu des entités existantes via EntityMesh

    Ghost entité (GhostEntity) pour la prévisualisation de pose

    Pose d'entités (clic gauche), déplacement (drag), rotation (touche R), suppression (Delete/Backspace)

    Calculs de position (calcEntityPos, calcPreciseEntityPos)

    Gestion de la grille et du changement de niveau (displayLevel)

    Détection d'entité sous le curseur (getEntityUnderCursor)

    Communication API et socket pour les opérations CRUD sur les entités

Props :

    voxels, surfaceData — données de la scène

    textureMaterials, entityTextureMaterials — textures

    socket, battlemapId — communication

    activeBlueprint — blueprint à poser

    displayLevel — niveau affiché

    selectedEntityId, onEntitySelect — sélection

    onBlueprintPlaced — callback après pose

Dépendances :

    editorConstants.js (GRID_SIZE, SURFACE_FINE)

    editorUtils.js (blueprintPlacementMode)

    surfaceData.js — fonctions géométriques

    useEntityStore — store Zustand

    Composants : EntityMesh, GhostEntity, GhostEntityBounds, MapControls, Grid, SurfaceDungeonScene, CulledVoxelScene

3.3 useEditorRefs.js

Responsabilités :

    Créer et exposer les refs partagées entre les hooks

    Assurer la synchronisation des refs avec les états React correspondants

Refs exposées :
javascript

{
  battlemapRef,        // miroir de battlemap
  surfaceDataRef,      // miroir de surfaceData
  voxelsRef,           // miroir de voxels
  isDirty,             // indicateur de modifications voxels
  isSurfaceDirty,      // indicateur de modifications surface
}

Utilisation : Les hooks useEditorSave, useSurfaceUndo, useRuntimeState consomment ces refs pour accéder aux données à jour sans déclencher de re-rendus.
3.4 useEditorSave.js

Extrait de : Fonctions saveFireAndForget, saveSurfaceFireAndForget, timers d'auto-save (lignes ~900-1000 de l'original).

Responsabilités :

    Sauvegarde des voxels (PUT /api/battlemaps/:id/voxels)

    Sauvegarde des surfaces (persistSurfaceDocument)

    Files d'attente de sauvegarde (voxelSaveQueueRef, surfaceSaveQueueRef)

    Auto-save toutes les 60 secondes

    Sauvegarde au démontage (cleanup)

    Gestion des révisions (voxelSaveRevisionRef, surfaceSaveRevisionRef)

    Mise à jour du store Zustand (setBattlemap)

Fonctions retournées :
javascript

{
  saveFireAndForget,          // sauvegarde fire-and-forget des voxels
  saveSurfaceFireAndForget,   // sauvegarde fire-and-forget des surfaces
}

Dépendances :

    useEditorRefs — pour battlemapRef, surfaceDataRef, voxelsRef, isDirty, isSurfaceDirty

    useMapStore — pour setBattlemap

    surfacePersistence.js — pour persistSurfaceDocument

    editorUtils.js — pour cloneSurfaceData

3.5 useSurfaceUndo.js

Extrait de : Fonctions handleSurfaceUndo, handleSurfaceRedo, piles undo/redo (lignes ~1030-1100 de l'original).

Responsabilités :

    Gestion des piles undo/redo surface (limitées à 50 entrées)

    Fonctions handleSurfaceUndo, handleSurfaceRedo

    Écoute des touches Ctrl+Z / Ctrl+Y (hors entités)

    Notification de l'état undo/redo au parent (onSurfaceUndoStateChange, onSurfaceRedoStateChange)

    Synchronisation avec les requêtes externes (surfaceUndoRequest, surfaceRedoRequest)

Fonctions retournées :
javascript

{
  handleSurfaceUndo,
  handleSurfaceRedo,
  surfaceUndoDepth,
  surfaceRedoDepth,
}

Dépendances :

    useEditorRefs — pour surfaceDataRef, isSurfaceDirty

    saveSurfaceFireAndForget — reçu en paramètre depuis useEditorSave

    editorUtils.js — pour cloneSurfaceData

3.6 useEditorTextures.js

Extrait de : Chargement des textures voxel et entités (lignes ~950-1020 de l'original).

Responsabilités :

    Chargement initial des textures voxel (loadVoxelTextures depuis /api/voxel-textures)

    Chargement des textures d'entités (avec états visuels)

    Gestion du cache et de l'état blocksReady

    Notification au parent (onBlocksLoaded)

Fonctions retournées :
javascript

{
  textureMaterials,           // textures voxel chargées
  entityTextureMaterials,     // textures entités chargées
  blocksReady,                // booléen indiquant si les textures sont prêtes
}

Dépendances :

    useEntityStore — pour la liste des entités et leurs blueprints

    voxelTextures.js — pour loadVoxelTextures

3.7 useRuntimeState.js (ajout)

Extrait de : Gestion des effets runtime et ascenseurs (lignes ~920-990 de l'original).

Responsabilités :

    Chargement initial des effets runtime (GET /api/battlemaps/:id/world-effects)

    Chargement initial des ascenseurs (GET /api/battlemaps/:id/world-elevators)

    Polling des ascenseurs en transition (toutes les 300ms)

    Écoute socket WS.WORLD_RUNTIME_UPDATED

    Fonctions handleRuntimeEffectCreate, handleElevatorCommand

Fonctions retournées :
javascript

{
  runtimeEffectRegions,
  runtimeElevatorStates,
  handleRuntimeEffectCreate,
  handleElevatorCommand,
}

Dépendances :

    useEditorRefs — pour battlemapRef

    api.js — pour les appels REST

3.8 useSurfacePanels.js (ajout)

Extrait de : Gestion des panneaux flottants et leurs handlers (lignes ~1100-1200 de l'original).

Responsabilités :

    État des trois panneaux : surfaceConnectorPanel, surfaceRoomPanel, surfaceWallPanel

    Handlers de sélection : handleSurfaceConnectorSelect, handleSurfaceRoomSelect, handleSurfaceWallSelect

    Handlers de fermeture : closeSurfaceConnectorPanel, closeSurfaceRoomPanel, closeSurfaceWallPanel

    Handlers de modification : handleSurfaceConnectorPatch, handleSurfaceConnectorDelete, handleSurfaceRoomDelete

    handleSurfaceWallAppearanceChange

    Synchronisation avec le tool et les données

    Détection de suppression externe (pièce disparue → fermeture du panneau)

Fonctions retournées :
javascript

{
  surfaceConnectorPanel,
  surfaceRoomPanel,
  surfaceWallPanel,
  selectedSurfaceConnector,   // objet connector résolu
  selectedSurfaceRoom,        // objet room résolu
  handleSurfaceConnectorSelect,
  handleSurfaceRoomSelect,
  handleSurfaceWallSelect,
  handleSurfaceConnectorPatch,
  handleSurfaceConnectorDelete,
  handleSurfaceRoomDelete,
  handleSurfaceWallAppearanceChange,
  closeSurfaceConnectorPanel,
  closeSurfaceRoomPanel,
  closeSurfaceWallPanel,
}

Dépendances :

    useEditorRefs — pour surfaceDataRef

    surfaceData.js — pour les fonctions de manipulation

3.9 editorConstants.js (ajout)

Constantes exportées :
javascript

GRID_SIZE = 50
ROOM_DEFAULTS = {
  enabled: false,
  wallHeight: 2,
  floorTexId: null,
  wallTexId: null,
}
GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']
PAN_FACTOR = 0.8

Dépendances : Aucune.
3.10 editorUtils.js (ajout)

Fonctions exportées :
javascript

getVoxelKey(x, y, z)           // "x:y:z"
cloneSurfaceData(data)          // JSON.parse(JSON.stringify(data))
blueprintPlacementMode(bp)      // bp.geometry?.placementMode || 'free'
clampInt(value, min, max, fallback)
normalizeRoomSelection(selection)
buildRoomVoxels(selection, roomTool, activeMaterial)

Dépendances :

    editorConstants.js (GRID_SIZE, ROOM_DEFAULTS)

3.11 Editor3D.jsx (composant principal allégé)

Responsabilités résiduelles :

    Rendu du Canvas Three.js

    Rendu conditionnel des scènes selon activeEditorTab

    Rendu des panneaux flottants

    Rendu du message d'erreur de sauvegarde

    Coordination des hooks

    Gestion des raccourcis clavier géométrie (Digit1-5)

Structure :
jsx

export default function Editor3D(props) {
  const refs = useEditorRefs()
  const { saveFireAndForget, saveSurfaceFireAndForget } = useEditorSave(refs)
  const { handleSurfaceUndo, handleSurfaceRedo, ... } = useSurfaceUndo(refs, saveSurfaceFireAndForget)
  const { textureMaterials, entityTextureMaterials, blocksReady } = useEditorTextures()
  const { runtimeEffectRegions, runtimeElevatorStates, ... } = useRuntimeState(refs)
  const panels = useSurfacePanels(refs, props)

  return (
    <div>
      <Canvas>
        {blocksReady && activeEditorTab === 'entity' && <EntityEditorScene ... />}
        {blocksReady && activeEditorTab !== 'entity' && <SurfaceEditorScene ... />}
      </Canvas>
      {surfaceSaveError && <ErrorAlert ... />}
      {panels.surfaceConnectorPanel && <SurfaceConnectorPanel ... />}
      {panels.surfaceRoomPanel && <SurfaceRoomPanel ... />}
      {panels.surfaceWallPanel && <SurfaceWallPanel ... />}
    </div>
  )
}

4. Dépendances entre modules
text

Editor3D.jsx
├── useEditorRefs (ne dépend de rien)
├── useEditorSave (dépend de useEditorRefs)
├── useSurfaceUndo (dépend de useEditorRefs, useEditorSave)
├── useEditorTextures (dépend de useEntityStore)
├── useRuntimeState (dépend de useEditorRefs)
├── useSurfacePanels (dépend de useEditorRefs, surfaceData, surfaceTool)
├── VoxelEditorScene (dépend de editorConstants, editorUtils)
└── EntityEditorScene (dépend de editorConstants, editorUtils, useEntityStore)

5. Tests de non-régression

Avant le refactor, exécuter et documenter le résultat des tests suivants :

    □

    npm test — tests unitaires existants
    □

    Test manuel : ouvrir une carte existante, vérifier l'affichage des voxels
    □

    Test manuel : ouvrir une carte existante, vérifier l'affichage des surfaces (salles, murs)
    □

    Test manuel : basculer entre les onglets voxel/surface/entité
    □

    Test manuel : poser un voxel, attendre l'auto-save, recharger
    □

    Test manuel : créer une salle, la modifier, undo/redo, recharger
    □

    Test manuel : poser une entité, la déplacer, la supprimer
    □

    Test manuel : ouvrir les panneaux (salle, mur, connecteur), les fermer
    □

    Test manuel : vérifier le polling des ascenseurs en transition

6. Plan de migration

    Créer editorConstants.js et editorUtils.js

    Créer useEditorRefs.js

    Créer useEditorSave.js (dépend de useEditorRefs)

    Créer useSurfaceUndo.js (dépend de useEditorRefs, useEditorSave)

    Créer useEditorTextures.js

    Créer useRuntimeState.js

    Créer useSurfacePanels.js

    Extraire VoxelEditorScene.jsx et EntityEditorScene.jsx

    Réécrire Editor3D.jsx avec les hooks et composants extraits

    Exécuter les tests de non-régression

Chaque étape est validée par les tests avant de passer à la suivante. En cas d'échec, revenir à l'étape précédente.
7. Critères de succès

    Editor3D.jsx passe de ~1200 à ~200 lignes

    Tous les tests existants passent à l'identique

    L'interface est strictement inchangée

    Les nouveaux fichiers sont documentés dans EDITOR3D.md

8. Hors-scope

    Modification des fonctionnalités existantes

    Changement de l'interface utilisateur

    Optimisation des performances (sauf régression)

    Écriture de nouveaux tests (sauf si les tests existants sont insuffisants)
-----------------------------------------------------------------------------
Lot 1 — Textures de base pour les surfaces

Version : 1.0 — 2026-08-02
Statut : Spécification pour développement
Domaine : Matériaux de surface
1. Objectif

Permettre à l'utilisateur de choisir une texture de base pour les surfaces (sols, murs, plafonds) parmi les packs de textures disponibles, et de l'enrichir avec le pipeline procédural existant (usure, saleté, relief, motifs).

L'architecture est hybride exclusive : une texture de base obligatoire, enrichie systématiquement par les effets procéduraux. Aucun toggle « Procédural / Texture » n'est proposé.
2. Architecture cible
2.1 Extraction de la Sidebar

Pour ne pas aggraver le monolithe, la logique de l'éditeur de surface est extraite de Sidebar.jsx dans un composant dédié.
text

Sidebar.jsx — conteneur
├── SurfaceToolPanel.jsx — éditeur de surface (outils, réglages, apparence)
│   ├── SurfaceTexturePicker.jsx — sélecteur de texture de base
│   └── SurfaceMaterialEditor.jsx — éditeur procédural (existant)
│   └── useSurfaceTool.js — logique métier (état, handlers)

2.2 Flux de données
text

SurfaceTexturePicker (clic vignette)
  → useSurfaceTool.setBaseTexture(texId)
    → tool.wallInteriorTexId = texId
      → applyRoomToolUpdate / materialOrTextureForTool
        → room.wallInteriorTex = texId
          → SurfaceDungeonScene (rendu) → materialAt(textureMaterials, texId)

2.3 Modification du générateur procédural

generateProceduralMaterialTexture dans proceduralMaterials.js accepte un nouveau paramètre optionnel baseTextureUrl.

    Si baseTextureUrl est fourni, le canvas est initialisé avec cette image (ctx.drawImage), puis les filtres procéduraux (motif, usure, saleté) sont appliqués par-dessus.

    Si baseTextureUrl est absent, le comportement actuel (génération de la couleur via materialBase) est conservé.

    La normal map continue d'être dérivée du heightmap combiné (relief de la texture + effets).

3. Responsabilités détaillées
3.1 useSurfaceTool.js (nouveau)

Extrait de : Logique actuellement dans Sidebar.jsx (state surfaceToolState, handlers).

Responsabilités :

    État de l'outil de surface (surfaceTool)

    Tous les handlers de modification (updateSurfaceTool, updateSurfaceMaterial, etc.)

    Gestion du sélecteur de connecteurs

    Gestion des effets runtime

    Sélection de la texture de base (setBaseTexture)

    Synchronisation avec les props externes (onSurfaceToolChange)

Interface :
javascript

{
  surfaceTool,                    // état complet de l'outil
  updateSurfaceTool,              // patch partiel
  updateSurfaceMaterial,          // patch du matériau procédural
  setBaseTexture,                 // sélection de la texture de base
  connectorChoices,               // blueprints filtrés par type
  selectedConnectorChoice,        // blueprint sélectionné
  connectorMaterialSlots,         // slots de couleur du modèle
  updateConnectorMaterialSlot,    // mise à jour d'un slot
  clearConnectorMaterialSlot,     // reset d'un slot
  worldEffects,                   // définitions et instances d'effets
  refreshWorldEffects,            // rechargement
  createCustomEffect,             // création d'un effet personnalisé
  deleteRuntimeEffect,            // suppression d'une instance
}

3.2 SurfaceTexturePicker.jsx (nouveau)

Responsabilités :

    Afficher la liste des textures disponibles pour les surfaces, groupées par pack/catégorie

    Permettre la sélection d'une texture de base

    Afficher un aperçu de la texture sélectionnée

    Filtrer les textures par type (surface vs. voxel) — dans un premier temps, réutiliser availableBlocks et ajouter un filtrage par catégorie

Props :

    availableBlocks — liste des textures disponibles

    selectedTexId — ID de la texture actuellement sélectionnée

    onSelect — callback appelé avec l'ID de la texture choisie

3.3 SurfaceToolPanel.jsx (nouveau)

Extrait de : Section roomTool actuellement dans Sidebar.jsx.

Responsabilités :

    Rendu des boutons d'outils (sélection, salle, mur, escalier, passerelle, connecteurs, effet, gomme)

    Rendu des réglages spécifiques à chaque outil

    Rendu de l'éditeur de matériau procédural (existant)

    Rendu du sélecteur de texture (SurfaceTexturePicker)

    Affichage des hints et messages d'aide

Props :

    Toutes les valeurs et handlers retournés par useSurfaceTool

    availableBlocks

    canSurfaceUndo, canSurfaceRedo, onSurfaceUndo, onSurfaceRedo

3.4 proceduralMaterials.js (modification)

Fonction impactée : generateProceduralMaterialTexture

Modification :

    Nouveau paramètre baseTextureUrl (optionnel)

    Si présent, remplacer la génération de la couleur de base par ctx.drawImage

    Le reste du pipeline (motif, usure, saleté, normal map) s'applique par-dessus

    La clé de cache (proceduralMaterialKey) inclut baseTextureUrl pour éviter les collisions

3.5 Sidebar.jsx (allégement)

Suppression : Toute la section roomTool et les handlers associés (environ 500 lignes).

Ajout : Un composant SurfaceToolPanel consommateur de useSurfaceTool.
3.6 surfaceData.js (vérification, pas de modification)

Vérification : materialOrTextureForTool gère déjà le cas où interiorTex est défini. Lorsque le tool contient un wallInteriorTexId, la fonction pickSurfaceTexture est appelée et le résultat est stocké dans room.wallInteriorTex.

Aucune modification nécessaire, mais il faut s'assurer que le fallbackTexId est correctement propagé depuis activeMaterial vers le tool, puis vers materialOrTextureForTool.
4. Dépendances
text

SurfaceToolPanel.jsx
├── useSurfaceTool.js (nouveau)
├── SurfaceTexturePicker.jsx (nouveau)
├── SurfaceMaterialEditor.jsx (existant)
└── Object3DPreview.jsx (existant)

useSurfaceTool.js
├── surfaceData.js (existant)
├── proceduralMaterials.js (existant)
└── api.js (existant)

5. Critères de succès

    □

    L'utilisateur peut choisir une texture de base pour les sols, murs et plafonds via un sélecteur dans SurfaceToolPanel.
    □

    La texture sélectionnée est appliquée aux nouvelles surfaces créées.
    □

    Les effets procéduraux (motif, usure, saleté, relief) s'appliquent par-dessus la texture choisie.
    □

    Les surfaces existantes (créées avant le Lot 1) continuent de fonctionner sans erreur.
    □

    La sauvegarde et le rechargement préservent le choix de la texture.
    □

    Sidebar.jsx est allégé de la logique d'édition de surface.
    □

    Le rendu visuel est amélioré (texture de base + variations).

6. Hors-scope

    Décals / nouveaux motifs (câbles, grilles, boutons) → Lot 3

    Cohérence automatique salle → GLB → Lot 4

    Modification du cache procédural (sauf ajout de la clé baseTextureUrl)

    Création d'un nouveau type de pack « surfaces » — dans un premier temps, réutilisation des packs existants avec filtrage par catégorie
-----------------------------------------------------------------------------
Lot 1 — Textures de base pour les surfaces (v2, corrigé)

Version : 2.0 — 2026-08-02
Statut : Spécification pour développement
Domaine : Matériaux de surface
1. Objectif

Permettre à l'utilisateur d'importer un pack de textures PBR (dossier de 7 fichiers par matériau) et de l'utiliser comme base pour les surfaces. Cette base est ensuite enrichie par le pipeline procédural existant (motif, usure, saleté, relief).

Tous les canaux PBR sont branchés directement dans le MeshStandardMaterial final : map (basecolor), normalMap, roughnessMap, metalnessMap, aoMap. Le height pourra être utilisé ultérieurement pour le relief réel (displacement), mais n'est pas requis pour la V1.
2. Architecture cible
2.1 Flux de données
text

Import (dossier de fichiers) → stockage MinIO + table texture_packs (type=surface)
SurfaceTexturePicker (sélection d'un matériau)
  → useSurfaceTool.setBaseMaterial(materialId)
    → tool.surfaceMaterialId = materialId
      → applyRoomToolUpdate / materialOrTextureForTool
        → room.wallInteriorTex = null (obsolète, on utilise le nouveau champ surfaceMaterial)
        → room.wallInteriorMaterial = { type: 'pbr-material', materialId, ...proceduralParams }
          → SurfaceDungeonScene (rendu) → nouveau cache PBR + pipeline procédural

2.2 Nouveaux composants
text

Sidebar.jsx — conteneur (allégé)
├── SurfaceToolPanel.jsx — éditeur de surface (outils, réglages, apparence)
│   ├── SurfaceTexturePicker.jsx — sélecteur de matériau PBR
│   ├── SurfaceMaterialEditor.jsx — éditeur procédural (existant, enrichi)
│   └── useSurfaceTool.js — logique métier (état, handlers)

3. Responsabilités détaillées
3.1 SurfaceTexturePicker.jsx (nouveau)

Responsabilités :

    Lister les matériaux PBR disponibles pour les surfaces (depuis une nouvelle route API /api/surface-materials ou via la table voxel_textures avec un nouveau champ type).

    Afficher une vignette de prévisualisation (la basecolor).

    Permettre la sélection d'un matériau.

    Un matériau PBR est un dossier de 7 fichiers : {name}_basecolor.jpg, {name}_normal.jpg, {name}_roughness.jpg, {name}_metallic.jpg, {name}_height.jpg, {name}_ambientocclusion.jpg (et _normalOGL en variante).

    Pour la vignette, utiliser l'URL de la basecolor.

Props :

    materials : liste des matériaux PBR disponibles.

    selectedMaterialId : ID du matériau sélectionné.

    onSelect(materialId) : callback.

3.2 useSurfaceTool.js (nouveau, extrait de Sidebar)

Ajout par rapport à la version précédente :

    setBaseMaterial(materialId) : met à jour tool.surfaceMaterialId.

    surfaceMaterialId est stocké dans le tool et persisté dans surface_data.

3.3 proceduralMaterials.js (modification)

Fonction impactée : generateProceduralMaterialTexture

Nouveau paramètre : baseMaterial (objet contenant les URLs des maps PBR).

Comportement :

    Si baseMaterial est fourni :

        Charger la basecolor dans le canvas (via ctx.drawImage).

        Appliquer les filtres procéduraux (motif, usure, saleté) par-dessus.

        Générer la normal map à partir du heightmap combiné (relief de la texture + procédural).

    Si baseMaterial est absent, revenir au comportement par défaut (génération from scratch pour la rétrocompatibilité).

Matériau Three.js final :

    map : canvas combiné (basecolor + effets).

    normalMap : normal map combinée (PBR normal + procédural).

    roughnessMap : roughness map PBR.

    metalnessMap : metallic map PBR.

    aoMap : ambient occlusion map PBR.

    color, roughness, metalness : valeurs de secours si les maps ne sont pas disponibles.

3.4 Cache

Le cache proceduralSurfaceMaterialCache est indexé par une clé incluant le materialId du matériau PBR sélectionné et tous les paramètres procéduraux.
3.5 Persistance

    Un nouveau champ surfaceMaterialId est ajouté dans le tool et dans surface_data.rooms (à côté de floorTex, wallInteriorTex, etc.).

    wallInteriorTex et floorTex deviennent obsolètes pour le nouveau système mais sont conservés pour la rétrocompatibilité.

    La validation serveur (surfaceDocument.js) est mise à jour pour accepter le nouveau champ.

4. Import de matériaux PBR
4.1 Mécanisme

Un nouveau point d'entrée API (ou une extension de texture-pack.js) permet d'importer un dossier de fichiers pour un matériau.

Exemple :
text

POST /api/surface-materials/import
Content-Type: multipart/form-data
Files: Metal_CooperPattern_01_basecolor.jpg, Metal_CooperPattern_01_normal.jpg, ...

Le serveur :

    Reçoit les fichiers.

    Détecte le nom de base (ex: Metal_CooperPattern_01).

    Stocke les fichiers dans MinIO sous surface-materials/{uuid}/.

    Crée une entrée dans voxel_textures (ou une nouvelle table surface_materials) avec le champ type: 'pbr' et les chemins de chaque map.

    Retourne l'ID du matériau importé.

4.2 Anciens packs voxel

Ils restent exclusivement pour les voxels. Aucune compatibilité n'est prévue. Le SurfaceTexturePicker n'affiche que les matériaux de type pbr.
5. Allègement de Sidebar.jsx

La logique d'édition de surface (outils, réglages, sélecteur de texture) est extraite dans SurfaceToolPanel.jsx, qui consomme useSurfaceTool.js. Sidebar.jsx passe de ~1000 lignes à ~500 lignes.
6. Critères de succès

    □

    L'utilisateur peut importer un dossier de textures PBR et le voir apparaître dans le sélecteur.
    □

    Le matériau PBR sélectionné est appliqué aux surfaces (sols, murs, plafonds).
    □

    Les effets procéduraux (motif, usure, saleté, relief) s'appliquent par-dessus la base PBR.
    □

    Tous les canaux PBR sont utilisés dans le rendu final.
    □

    La sauvegarde et le rechargement préservent le choix du matériau.
    □

    Sidebar.jsx est significativement allégé.
    □

    Les cartes existantes (sans surfaceMaterialId) continuent de fonctionner sans erreur.

7. Hors-scope

    Décals / nouveaux motifs → Lot 3

    Cohérence automatique salle → GLB → Lot 4

    Gestion de la hauteur (displacement) → Lot 2 ou ultérieur

    Import de packs via ZIP (pour l'instant, import fichier par fichier ou dossier)

----------------------------------------------------------------------------
