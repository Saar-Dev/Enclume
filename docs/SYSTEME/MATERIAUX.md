MATERIAUX.md — Système de matériaux de surface (état actuel, v2)

    Version : 2026-08-02 — document créé lors de l'audit du pipeline de matériaux, puis corrigé après analyse critique.

    Statut : Document de référence décrivant l'existant.
    Lire pour : tout travail sur l'apparence des murs, sols, plafonds et le générateur procédural.

Documents associés :

    docs/SYSTEME/SURFACES_SALLES.md — éditeur Salle et contrat des surfaces

    docs/SYSTEME/MOTEUR_MONDE.md — compilation physique du monde

1. Architecture générale

Le système de matériaux pour les surfaces (murs, sols, plafonds) repose sur un pipeline unique qui aboutit à un THREE.MeshStandardMaterial. Ce pipeline peut emprunter deux chemins :

    Chemin procédural (actif par défaut) : les propriétés du matériau (matière, peinture, motif, usure, saleté, relief) sont envoyées à generateProceduralMaterialTexture qui génère une texture d'albedo et une normal map sur un canvas, puis assemble un MeshStandardMaterial avec ces textures et des propriétés PBR déduites de la matière choisie.

    Chemin texture (existe dans le code, non exposé) : si un interiorTex est défini, le rendu utilise une texture chargée depuis les packs de textures. Ce chemin n'est pas accessible via l'interface utilisateur actuelle.

Dans les deux cas, le résultat est un MeshStandardMaterial appliqué aux meshes des murs, sols et plafonds.

[VÉRIFIÉ] — SurfaceDungeonScene.jsx, fonctions WallSegment, RoomSlab, FloorTile, CeilingTile, qui appellent toutes surfaceMaterialAt ou materialAt.
2. Flux de données complet
text

Palette de textures (activeMaterial)
        ↓
Editor3D.jsx (activeMaterial passé aux scènes)
        ↓
SurfaceEditorScene / applyRoomSelection / applyFloorSelection
        ↓
materialOrTextureForTool (décision procédural vs texture)
        ↓
room.floorTex / room.floorMaterial / room.wallInteriorTex / room.wallInteriorMaterial
        ↓
SurfaceDungeonScene.jsx (WallSegment, RoomSlab, FloorTile, CeilingTile)
        ↓
surfaceMaterialAt (procédural) ou materialAt (texture)
        ↓
THREE.MeshStandardMaterial

[VÉRIFIÉ] — Editor3D.jsx (passage d'activeMaterial aux scènes), surfaceData.js (fonctions applyRoomSelection, applyRoomToolUpdate, materialOrTextureForTool), SurfaceDungeonScene.jsx (rendu).
2.1 Propagation de la palette aux outils de surface

activeMaterial est défini dans le composant parent (Editor3D.jsx) et passé à la fois à EditorScene (mode voxel) et à SurfaceEditorScene (mode surface). Dans le mode surface, il est utilisé comme fallbackTexId dans les appels à applyRoomSelection, applyFloorSelection, applyCeilingSelection, etc. C'est ainsi que la texture sélectionnée dans la palette voxel peut devenir la texture d'une surface.

[VÉRIFIÉ] — Editor3D.jsx : activeMaterial est passé en prop à SurfaceEditorScene. surfaceData.js : fallbackTexId dans materialOrTextureForTool.

Chaînon manquant : le composant exact qui affiche les vignettes et définit activeMaterial n'a pas été identifié. BlockPalette.js et TexturePalette.js n'existent pas. La logique est probablement dans un composant parent non encore lu.
2.2 Décision automatique du mode

Le champ surfaceMaterialMode (dans le tool) est défini automatiquement par roomToSurfaceToolPatch :

    Si la salle possède un floorMaterial, ceilingMaterial ou wallInteriorMaterial, le mode est 'procedural'.

    Sinon, le mode est 'texture'.

Conséquence pratique : à la création d'une salle (sans matériau personnalisé), le mode est 'texture', donc la texture de la palette active est utilisée. Dès que l'utilisateur modifie un paramètre du matériau (ex. changer la matière), un materialPreset est défini, le mode bascule en 'procedural', et la texture est ignorée.

[VÉRIFIÉ] — surfaceData.js, fonction roomToSurfaceToolPatch.
3. Interface utilisateur

Les panneaux d'édition (SurfaceRoomPanel.jsx, SurfaceWallPanel.jsx) exposent un éditeur de matériau procédural via le composant SurfaceMaterialEditor. Cet éditeur permet de régler :

    Matière : steel, plastic, wood, concrete

    Motif : none, metal_panels, tile_grid, planks, diamond_plate

    Peinture : couleur hexadécimale

    Usure (wear) : 0-100

    Saleté (dirt) : 0-100

    Relief (relief) : 0-100

    Relief réel (realRelief) : booléen, détermine si le relief est géométrique (displacement) ou via une normal map

Les valeurs par défaut pour une nouvelle salle sont définies dans DEFAULT_SURFACE_MATERIAL_PRESET :
Champ	Valeur par défaut
material	'steel'
paint	'#6f7f8e'
pattern	'none'
wear	0
dirt	0
relief	0
realRelief	true
seed	'enclume'

[VÉRIFIÉ] — proceduralMaterials.js, constante DEFAULT_SURFACE_MATERIAL_PRESET.

L'éditeur ne comporte aucun sélecteur de texture d'image.

[VÉRIFIÉ] — SurfaceRoomPanel.jsx et SurfaceWallPanel.jsx : aucun composant de sélection de fichier ou de dropdown de packs n'est présent dans la section Apparence.
4. Générateur procédural
4.1 Entrée

Le générateur generateProceduralMaterialTexture reçoit un descripteur contenant :
Champ	Type	Valeur par défaut	Description
material	string	'steel'	Matière de base (acier, plastique, bois, béton)
paint	string	'#6f7f8e'	Couleur de peinture (hex)
pattern	string	'none'	Motif géométrique superposé
wear	number	0	Intensité de l'usure (0-100)
dirt	number	0	Intensité de la saleté (0-100)
relief	number	0	Intensité du relief (0-100)
realRelief	boolean	true	Relief géométrique ou normal map
seed	string	'enclume'	Graine aléatoire pour la variation
size	number	128	Taille du canvas en pixels

[VÉRIFIÉ] — proceduralMaterials.js, fonction makeProceduralMaterialDescriptor.
4.2 Pipeline

La génération s'effectue en cinq étapes successives sur un canvas 128×128 :

    Couleur de base (materialBase) : génère une couleur de fond à partir de la matière choisie, en utilisant du bruit fractal et des effets spécifiques (grain de bois, brossage métallique). La peinture est mélangée à cette couleur de base.

    Motif (applyPattern) : dessine un motif géométrique (plaques rivetées, dalles jointes, planches, tôle striée) par-dessus la couleur.

    Usure (applyWear) : ajoute des rayures, des éclats, et de la rouille (pour l'acier uniquement) en fonction du paramètre wear.

    Saleté (applyDirt) : ajoute des taches, des traînées et des particules de poussière en fonction du paramètre dirt.

    Normal map (makeNormalMap) : dérive une normal map à partir du heightmap combiné (relief de la matière + motif + usure + saleté).

Le canvas final est exporté en data URL PNG, et la normal map est générée séparément.

[VÉRIFIÉ] — proceduralMaterials.js, fonction generateProceduralMaterialTexture.
4.3 Assemblage du matériau Three.js

Le matériau final est un THREE.MeshStandardMaterial avec :

    map : texture albedo générée

    normalMap : normal map générée

    normalScale : ajusté selon l'intensité du relief

    roughness et metalness : déduits de la matière choisie via pbrForProcedural

Matière	roughness	metalness
steel	0.55	0.42
plastic	0.62	0.02
wood	0.78	0.02
concrete	0.88	0.01
default	0.72	0.08

[VÉRIFIÉ] — SurfaceDungeonScene.jsx, fonctions pbrForProcedural et proceduralMaterialAt.
4.4 Cache

Les matériaux générés sont mis en cache dans proceduralSurfaceMaterialCache, indexés par une clé JSON contenant tous les paramètres du descripteur. Un cache séparé proceduralPreviewMaterialCache existe pour les aperçus (sans relief ni détails).

Caractéristiques importantes du cache :

    Il n'y a aucune invalidation : un matériau généré reste en mémoire jusqu'au rechargement de la page.

    Chaque combinaison unique de paramètres crée une nouvelle entrée. L'ancienne n'est pas supprimée.

    Sur une session longue avec beaucoup de variations, la mémoire peut croître. Ce n'est pas un bug bloquant en pratique, mais c'est une caractéristique à connaître.

[VÉRIFIÉ] — SurfaceDungeonScene.jsx, variables proceduralSurfaceMaterialCache et proceduralPreviewMaterialCache, fonction proceduralMaterialKey.
5. Système de textures d'images
5.1 Chargement

Les textures d'images sont chargées via loadVoxelTextures depuis l'API /api/voxel-textures. Chaque texture est un objet contenant :

    pack_id : identifiant du pack de textures

    faces : objet associant chaque face (east, west, top, bottom, south, north) à un chemin de fichier PNG dans MinIO

    Optionnellement, faces.__procedural ou faces.procedural pour les métadonnées de relief procédural

La fonction charge chaque PNG via THREE.TextureLoader et crée un tableau de 6 MeshStandardMaterial (un par face), avec gestion optionnelle des normal maps (convention : <face>_normal).

[VÉRIFIÉ] — client/src/lib/voxelTextures.js, fonction loadVoxelTextures.
5.2 Lien avec les surfaces

Le rendu des surfaces peut utiliser ces textures via materialAt(textureMaterials, wall.frontTex, FACE.south). Cependant, le mécanisme qui définit interiorTex n'est pas exposé dans l'interface. La palette de textures visible dans l'éditeur alimente activeMaterial pour le mode voxel, et ce activeMaterial est propagé aux outils de surface comme fallbackTexId.

Chaînon manquant : le composant exact qui affiche les vignettes et définit activeMaterial n'a pas été identifié.
5.3 Distinction textures voxel / textures surface

La table voxel_textures et l'API associée ne font pas de distinction entre les textures destinées aux voxels et celles destinées aux surfaces. Une texture chargée pour un voxel peut techniquement être utilisée sur un mur. Cependant, rien dans l'interface ne permet de choisir une texture pour une surface.

[VÉRIFIÉ] — texture-pack.js et voxelTextures.js : aucune notion de type de surface.
5.4 Stockage

Les textures sont stockées dans MinIO sous le chemin textures/<pack_id>/<fichier>.png. Les métadonnées sont dans la table voxel_textures. Les packs sont gérés via l'API REST texture-pack.js (CRUD, import/export ZIP).

[VÉRIFIÉ] — texture-pack.js, routes API.
6. Persistance
6.1 Champs persistés

Les champs de texture sont persistés dans surface_data.rooms :
Champ	Type	Description
floorTex	string/number	Texture du sol
ceilingTex	string/number	Texture du plafond
wallInteriorTex	string/number	Texture intérieure des murs
floorMaterial	object	Matériau procédural du sol
ceilingMaterial	object	Matériau procédural du plafond
wallInteriorMaterial	object	Matériau procédural des murs
wallAppearanceProfiles[].interiorTex	string	Texture par groupe de murs
wallAppearanceProfiles[].interiorMaterial	object	Matériau par groupe de murs

Les matériaux procéduraux contiennent les champs : material, paint, pattern, wear, dirt, relief, realRelief, seed.

[VÉRIFIÉ] — surfaceDocument.js, fonction validateFeature (collection rooms).
6.2 Validation serveur

La validation côté serveur (validateFeature) accepte floorTex, ceilingTex, wallInteriorTex comme string ou number. Les matériaux (floorMaterial, etc.) sont validés avec des contraintes sur les champs wear, dirt, relief (0-100) et realRelief (booléen).

[VÉRIFIÉ] — surfaceDocument.js, fonction validateFeature.
6.3 Champs obsolètes

Les anciens champs floorTopTex, floorBottomTex, wallExteriorTex, etc. sont explicitement rejetés en version 12 du schéma.

[VÉRIFIÉ] — surfaceDocument.js, constante OBSOLETE_ROOM_APPEARANCE_FIELDS.
7. Limitations actuelles

    Aucun sélecteur de texture dans l'interface : le chemin « texture » existe dans le code (interiorTex est rendu, persisté, validé) mais l'utilisateur ne peut pas le choisir.

    Générateur procédural basique : les textures générées sont fonctionnelles mais manquent de richesse visuelle pour un style cartoon. Les motifs sont limités à cinq presets.

    Pas de lien entre les packs de textures et les surfaces : l'infrastructure existe mais n'est pas consommée par les outils de surface.

    Pas d'enrichissement d'une texture de base : le pipeline procédural actuel génère tout from scratch. Il ne peut pas prendre une texture existante et lui appliquer des effets par-dessus.

8. Fichiers de référence
Fichier	Rôle
client/src/lib/proceduralMaterials.js	Générateur procédural
client/src/lib/voxelTextures.js	Chargement des textures depuis l'API
client/src/lib/surfaceData.js	Logique métier des surfaces
client/src/lib/surfaceMaterial.js	Normalisation d'un profil de matériau
client/src/components/SurfaceDungeonScene.jsx	Rendu des murs, sols, plafonds
client/src/components/SurfaceRoomPanel.jsx	Panneau d'édition de salle
client/src/components/SurfaceWallPanel.jsx	Panneau d'édition de mur
client/src/components/SurfaceMaterialEditor.jsx	Éditeur de matériau procédural
shared/world/surfaceDocument.js	Validation et persistance
server/src/routes/texture-pack.js	API de gestion des packs

Note : Ce document décrit l'état du système au 2026-08-02. Il servira de référence pour les évolutions prévues dans le plan V1.