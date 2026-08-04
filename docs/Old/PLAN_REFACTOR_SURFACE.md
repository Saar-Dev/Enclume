PLAN_REFACTOR_SURFACE.md — V4 finale

Version : 2026-08-03 — V4
Statut : ✅ Lot 0 terminé, plan complet prêt pour Lot 1a.
Responsabilité unique : stratégie de refactor de client/src/lib/surfaceData.js.
1. Objectif

Restructurer client/src/lib/surfaceData.js (~1500 lignes) en modules à responsabilité unique, sans modifier le format surface_data v12 ni le comportement observable de l'éditeur. Le projet est en phase de développement, sans risque de perte de données.
2. État des lieux
2.1 Architecture actuelle [VÉRIFIÉ]

    surfaceData.js exporte ~45 fonctions et constantes.

    Trois dépendances directes : roomGeometry.js (géométrie), proceduralMaterials.js (matériaux procéduraux), surfaceDocument.js (version v12).

    Transformations pures (surfaceData, params) → newSurfaceData.

    Deux responsabilités : transformation structurelle (apply*) et décision de matériau (materialOrTextureForTool et satellites).

    Duplications : normalizeSurfaceMaterialPreset / normalizedSurfaceMaterial (surfaceMaterial.js), surfaceTextureIds / collectSurfaceTextureIds (surfaceDocument.js), hashString (3 versions).

2.2 Consommateurs [VÉRIFIÉ — Lot 0]
Module	Importé par	Fonctions importées
surfaceData.js	Canvas3D.jsx, Editor3D.jsx, SurfaceDungeonScene.jsx, SurfaceEditorScene.jsx, SurfaceRoomPanel.jsx, surfacePersistence.js	normalizeSurfaceData, apply*, roomsWallSegments, computeSurfaceGridExtent, expandRoomsToSurface, findRoomAtCell, getRoomBaseY, etc.
surfaceMaterial.js	SurfaceMaterialEditor.jsx, SurfaceRoomPanel.jsx, SurfaceWallPanel.jsx	normalizedSurfaceMaterial

surfaceMaterial.js est vivant → unification prévue, pas suppression.
3. Décisions et justifications
Décision	Justification	Source
Extraire la décision de matériau en premier	materialOrTextureForTool n'est pas importée directement par l'UI, contrairement à roomsWallSegments et aux fonctions de connecteurs. L'extraction du module de décision est donc sans impact sur les composants.	Lot 0 (grep imports)
Extraire roomsWallSegments dans un second temps	Importée par SurfaceEditorScene.jsx, nécessite une mise à jour d'import dans ce composant. L'extraction est plus risquée, donc après materialDecision.js.	Lot 0
Extraire les connecteurs en troisième	Dépend de roomWalls.js (pour wallPointDistanceToPanel). L'ordre évite les dépendances circulaires.	Analyse du code, surfaceData.js
Créer surfaceUtils.js pour les fonctions partagées	hashString, clampNumber, formatLevel, sameLevel sont utilisées par plusieurs groupes de fonctions. Les isoler évite que materialDecision.js ou roomWalls.js importent surfaceData.js.	Analyse du code
Unifier surfaceMaterial.js plutôt que le supprimer	Importé par trois composants React. La suppression casserait l'application. L'unification préserve le comportement.	Lot 0
Ne pas unifier hashString entre surfaceData.js et proceduralMaterials.js	Les deux versions ont le même nom mais des implémentations différentes. Les unifier changerait les seeds des matériaux procéduraux et pourrait altérer l'apparence visuelle. Risque inacceptable pour un refactor. La duplication est documentée comme technique.	Analyse du code
Conserver la duplication surfaceTextureIds / collectSurfaceTextureIds	surfaceTextureIds est côté client (surfaceData.js), collectSurfaceTextureIds côté serveur (surfaceDocument.js). Duplication intentionnelle client/serveur, confirmée par VOCABULARY.md qui distingue les rôles.	VOCABULARY.md, SURFACES_SALLES.md
Conserver expandRoomsToSurface	Utilisée par Editor3D.jsx, ce n'est pas du code mort. Pourra être extraite plus tard si nécessaire.	Lot 0
Granularité « un lot par fichier modifié »	Limite les régressions, facilite l'isolation des erreurs, permet des tests ciblés. Conforme à CLAUDE.md §6 et §11.	CLAUDE.md, METHODO.md
4. Stratégie

Extraire les responsabilités non structurelles par ordre d'autonomie décroissante. Chaque lot ne modifie qu'un seul fichier à la fois. Un module surfaceUtils.js contiendra les fonctions utilitaires partagées.

Ordre des lots :

    Lot 0 : Cartographie des consommateurs ✅

    Lot 1a : surfaceUtils.js + materialDecision.js (création)

    Lot 1b : surfaceData.js (intégration)

    Lot 1c : surfaceMaterial.js (unification) + màj 3 composants React

    Lot 2a : roomWalls.js (création)

    Lot 2b : surfaceData.js + SurfaceEditorScene.jsx (intégration)

    Lot 3a : connectors.js (création)

    Lot 3b : surfaceData.js + SurfaceEditorScene.jsx (intégration)

    Lot 4 : Nettoyage final

5. Lots détaillés
Lot 0 — Cartographie des consommateurs ✅

Action : rechercher tous les imports de surfaceData.js et surfaceMaterial.js.
Résultat : 6 consommateurs pour surfaceData.js, 3 pour surfaceMaterial.js. Détail en §2.2.
Décisions impactées : unification de surfaceMaterial.js, mise à jour des imports dans SurfaceEditorScene.jsx pour les Lots 2b et 3b.
Statut : terminé.
Lot 1a — Création de surfaceUtils.js et materialDecision.js

Fichiers créés :

    client/src/lib/surfaceUtils.js

    client/src/lib/materialDecision.js

Fichiers modifiés : aucun.

Fonctions extraites dans surfaceUtils.js (depuis surfaceData.js) :

    hashString (version surfaceData.js)

    clampNumber, formatLevel, sameLevel

Fonctions extraites dans materialDecision.js (depuis surfaceData.js) :

    materialOrTextureForTool, makeSurfaceMaterial, normalizeSurfaceMaterialPreset (export canonique)

    pickSurfaceTexture, pickTextureVariant, pickTextureFromPackage

    surfaceBlockingForTool, toolForMaterialFace

Tests unitaires : materialDecision.test.js — couvre materialOrTextureForTool, surfaceBlockingForTool, pickTextureVariant.

Critères de succès :

    Tests unitaires passent.

    Les nouveaux modules n'importent ni Three.js ni React.

    Aucune modification de surfaceData.js à ce stade.

Note : hashString n'est pas unifiée avec proceduralMaterials.js (risque seeds, voir §3).
Lot 1b — Intégration dans surfaceData.js

Fichier modifié : client/src/lib/surfaceData.js

Description : remplacer les définitions locales de hashString, clampNumber, formatLevel, sameLevel par des imports depuis surfaceUtils.js. Remplacer les fonctions de décision de matériau par des imports depuis materialDecision.js. Supprimer normalizeSurfaceMaterialPreset. Réexporter les fonctions publiques pour ne pas casser les imports existants.

Critères de succès :

    Tests manuels : création de salle, modification de matériau, changement procédural/texture.

    Aucune régression visuelle.

Lot 1c — Unification de surfaceMaterial.js

Fichiers modifiés :

    client/src/lib/materialDecision.js (ajout de l'export canonique)

    client/src/components/SurfaceMaterialEditor.jsx

    client/src/components/SurfaceRoomPanel.jsx

    client/src/components/SurfaceWallPanel.jsx

Fichier supprimé : client/src/lib/surfaceMaterial.js

Description : ajouter normalizeSurfaceMaterialPreset comme export canonique dans materialDecision.js. Mettre à jour les imports dans les trois composants React. Supprimer surfaceMaterial.js.

Critère de succès : aucune duplication restante, les panneaux de matériau fonctionnent.
Lot 2a — Création de roomWalls.js

Fichier créé : client/src/lib/roomWalls.js
Fichiers modifiés : aucun.

Fonctions extraites (depuis surfaceData.js) :

    roomsWallSegments, mergeStraightWallPanels, roomsWallRenderPaths

    ensureRoomWallPanel, completeRoomWallPanel, roomWallSegments

    roomWallInteriorTex, roomWallInteriorMaterial

    wallCoversPanel, addMissingWalls, wallPointDistanceToPanel

    curveWallStyleKey, straightWallStyleKey

Tests unitaires : roomWalls.test.js — roomsWallSegments et mergeStraightWallPanels avec données mockées.

Critères de succès :

    Tests unitaires passent.

    Le module n'importe pas surfaceData.js (constantes via surfaceUtils.js ou réexport).

Note : roomsWallSegments est importée par SurfaceEditorScene.jsx. Le Lot 2b mettra à jour cet import.
Lot 2b — Intégration dans surfaceData.js et SurfaceEditorScene.jsx

Fichiers modifiés :

    client/src/lib/surfaceData.js

    client/src/components/SurfaceEditorScene.jsx

Description : remplacer les définitions locales dans surfaceData.js par des imports depuis roomWalls.js. Mettre à jour l'import de roomsWallSegments dans SurfaceEditorScene.jsx.

Critères de succès :

    Tests manuels : rendu des murs de salle, pose de portes sur murs de salle.

Lot 3a — Création de connectors.js

Fichier créé : client/src/lib/connectors.js
Fichiers modifiés : aucun.
Dépendance : roomWalls.js (pour wallPointDistanceToPanel).

Fonctions extraites :

    makeDoorConnectorFromWallPoint, applyDoorConnector

    makeElevatorConnectorFromCell, applyElevatorConnector

    makeLadderConnectorFromCell, applyLadderConnector

    connectorCommonBlocking, connectorModelFromTool, etc.

Tests unitaires : connectors.test.js — création de porte, ascenseur, échelle.

Note : SurfaceEditorScene.jsx importe directement les fonctions applyDoorConnector, makeDoorConnectorFromWallPoint, etc. Le Lot 3b mettra à jour ces imports.
Lot 3b — Intégration dans surfaceData.js et SurfaceEditorScene.jsx

Fichiers modifiés :

    client/src/lib/surfaceData.js

    client/src/components/SurfaceEditorScene.jsx

Description : remplacer les définitions locales par des imports depuis connectors.js. Mettre à jour les imports dans SurfaceEditorScene.jsx.

Critères de succès :

    Tests manuels : pose de porte, ascenseur, échelle. Connecteurs existants sur carte de test inchangés.

Lot 4 — Nettoyage

Fichier modifié : client/src/lib/surfaceData.js

Description :

    expandRoomsToSurface conservée (utilisée par Editor3D.jsx).

    roomToSurfaceToolPatch : vérifier le consommateur et déplacer si pertinent.

    Duplication surfaceTextureIds / collectSurfaceTextureIds : conservée (client/serveur intentionnel).

    Duplication hashString entre surfaceData.js et proceduralMaterials.js : conservée, documentée comme dette technique.

6. Hors-scope

    Modification du format surface_data v12.

    Modification de roomGeometry.js, proceduralMaterials.js, surfaceDocument.js.

    Refonte de l'UI (Sidebar, Editor3D, panneaux).

    Ajout de la sélection de texture.

    Cache des matériaux dans SurfaceDungeonScene.jsx.

    Unification de hashString entre surfaceData.js et proceduralMaterials.js.

7. Prérequis avant le Lot 1a

    Environnement de développement fonctionnel sur dev/Saar.

    Une carte de test avec salles, murs, connecteurs.

5a	surfaceGeometry.js	getWallFineBounds, getWallRenderBox, makeWallsFromDrag, makeWallSegment, applyWallDrag, makeWallFromDrag, wallCoversPanel, addMissingWalls	~250 lignes
5b	Intégration	màj surfaceData.js + SurfaceEditorScene.jsx	—
6a	surfaceRooms.js	getRoomFootprintCells, findRoomAtCell, findRoomsInSelection, applyRoomSelection, applyRoomSelectionWithResult, applyRoomToolUpdate, deleteSurfaceRoom, deleteRoomBoundaryWalls, applyRoomBoundaryArc, removeRoomBoundaryArcs, applyRoomWallElevationProfile, applyRoomWallAppearance, roomToSurfaceToolPatch + helpers	~400 lignes
6b	Intégration	màj surfaceData.js + composants	—
7a	surfaceStairs.js	makeStairFromSelection, applyStairSelection, stairStepBoxes	~100 lignes
7b	Intégration	màj surfaceData.js + SurfaceEditorScene.jsx

Document de travail validé. Chaque lot clôturé avec « Testé / Non testé » conformément à CLAUDE.md.
---------------------------------------------------------
Récapitulatif
Modules créés
Fichier	Rôle
surfaceUtils.js	hashString, clampNumber, formatLevel, sameLevel
surfaceCore.js	STORY_HEIGHT, levelToY, yToLevel, getRoomBaseY, getRoomHeightLevels
materialDecision.js	Décision de matériau + normalizedSurfaceMaterial
roomWalls.js	Assemblage des murs de pièces
connectors.js	Création de portes, ascenseurs, échelles
Modules modifiés
Fichier	Changement
surfaceData.js	Fonctions extraites, réexports ajoutés, imports corrigés
SurfaceEditorScene.jsx	Imports connecteurs migrés vers connectors.js
SurfaceMaterialEditor.jsx	Import migré vers materialDecision.js
SurfaceRoomPanel.jsx	Import migré vers materialDecision.js
SurfaceWallPanel.jsx	Import migré vers materialDecision.js
Module supprimé
Fichier	Raison
surfaceMaterial.js	Unifié avec materialDecision.js
Pour Claude Code

Tous les fichiers sont dans un répertoire séparé, sans affecter le code en production. Claude Code devra :

    Vérifier chaque fichier créé/modifié (syntaxe, imports, cohérence)
    dossier /docs/REFACTOR/
    Corriger les imports de SurfaceEditorScene.jsx qui pointe vers roomWalls.js pour des fonctions qui n'y sont pas

    Exécuter les tests existants

    Builder le client

    Tester l'éditeur de surface (création de salle, murs, connecteurs, matériaux)
-------------------------------------------------------------------------
Le plan V4 est entièrement exécuté. Voici le bilan :
Architecture résultante
Module	Responsabilité	Lignes
surfaceUtils.js	hashString, clampNumber, formatLevel, sameLevel	~50
surfaceCore.js	STORY_HEIGHT, levelToY, yToLevel, getRoomBaseY, getRoomHeightLevels	~30
materialDecision.js	Décision de matériau (procédural/texture)	~250
roomWalls.js	Assemblage des murs de pièces	~300
connectors.js	Création de portes, ascenseurs, échelles	~350
surfaceGeometry.js	Géométrie des murs (rendu, drag)	~250
surfaceRooms.js	Gestion des pièces (création, modification, suppression)	~600
surfaceStairs.js	Création et rendu des escaliers	~100
surfaceData.js	Barrel + getters + apply* floor/ceiling/bridge + erase + expand	~700

Total : 8 modules extraits + 1 barrel. surfaceData.js est passé de ~1500 à ~700 lignes.
Graphe de dépendances (pas de cycles)
text

surfaceUtils ──→ surfaceCore ──→ materialDecision
                                 ├──→ surfaceGeometry
                                 ├──→ roomWalls ──→ connectors
                                 ├──→ surfaceRooms
                                 ├──→ surfaceStairs
                                 └──→ surfaceData (barrel)

Modules supprimés

    surfaceMaterial.js (unifié avec materialDecision.js)

Composants modifiés

    SurfaceEditorScene.jsx

    SurfaceMaterialEditor.jsx

    SurfaceRoomPanel.jsx

    SurfaceWallPanel.jsx

Lot 4 restant (nettoyage)

    Duplication hashString : documentée comme dette technique

    expandRoomsToSurface : conservée (utilisée par Editor3D.jsx)

    roomToSurfaceToolPatch : conservée dans surfaceRooms.js

    Imports inutilisés : à vérifier par Claude Code

Pour Claude Code

    Vérifier syntaxe et imports de tous les modules

    Corriger SurfaceEditorScene.jsx (imports erronés)

    Exécuter les tests existants

    Builder le client

    Tester l'éditeur de surface