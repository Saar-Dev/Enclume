SYSTEME/EDITEUR.md — Infrastructure commune de l'éditeur de monde

    Version : 1.0 — 2026-08-02
    Statut : Document de référence.
    Lire pour : comprendre le socle commun à tous les modes d'édition (surface, entité, voxel).

Documents associés :

    docs/SYSTEME/SURFACES_SALLES.md — éditeur de surface (outils, salles, connecteurs)

    docs/SYSTEME/ENTITES.md — entités libres (pose, cycle de vie)

    docs/SYSTEME/MATERIAUX.md — pipeline de matériaux procédural

    docs/SYSTEME/CORE.md — stores Zustand, événements WebSocket

    docs/SYSTEME/CONVENTIONS.md — pièges actifs (P12, P13, P52-P54)

    docs/SYSTEME/MOTEUR_MONDE.md — compilation physique du monde

1. Architecture générale

L'éditeur de monde est orchestré par le composant Editor3D (client/src/components/Editor3D.jsx).
Il s'active lorsque le GM bascule en mode Édition depuis la barre latérale (Sidebar.jsx).
text

SessionPage
  └── Sidebar (onglets, outils, palette)
        └── Editor3D (coordination)
              ├── SurfaceEditorScene (outils surface)
              ├── EntityEditorScene (pose/déplacement entités)
              └── EditorScene (voxels legacy)

Editor3D ne décrit pas lui-même le comportement des outils ; il fournit l'infrastructure
partagée : sauvegarde, undo/redo, chargement des textures, effets runtime, panneaux flottants.
2. Basculement jeu / édition

Le basculement est déclenché par le bouton Édition / Mode jeu dans la barre latérale
(Sidebar.jsx). Il appelle onModeChange qui remonte à SessionPage.

    En mode jeu (mode !== 'edit'), la barre latérale affiche les onglets Chat, Personnages,
    Bibliothèque et Profil.

    En mode édition (mode === 'edit'), la barre latérale affiche la palette de textures, les
    outils de surface, les contrôles de matériaux, et l'onglet Entités.

Le changement de mode ne démonte pas Editor3D — celui-ci reste monté et conserve son état
interne. La sauvegarde est déclenchée au moment du basculement (cleanup useEffect).
3. Onglets de l'éditeur

Deux onglets structurent l'édition :
Onglet	Rôle	Composant de scène
Monde (activeEditorTab === 'world')	Édition des surfaces et des voxels	SurfaceEditorScene
Entités (activeEditorTab === 'entity')	Pose et manipulation des entités libres	EntityEditorScene

Le changement d'onglet ne démonte pas la scène non active ; il conditionne simplement le rendu
dans le Canvas. L'état de chaque scène est conservé.
4. Sauvegarde automatique
4.1 Files d'attente

Deux files d'attente sérialisent les sauvegardes pour éviter les conflits :
javascript

voxelSaveQueueRef   // file pour les voxels
surfaceSaveQueueRef // file pour les surfaces

Chaque file est une promesse chaînée (.catch(() => {}).then(...)) qui garantit l'ordre des
requêtes PUT.
4.2 Révisions

Deux compteurs de révision locaux protègent contre les conflits d'écriture :
javascript

voxelSaveRevisionRef   // incrémenté avant chaque sauvegarde voxel
surfaceSaveRevisionRef // incrémenté avant chaque sauvegarde surface

Ces révisions sont comparées à battlemapRef.current.voxel_revision et
battlemapRef.current.surface_revision pour éviter d'écraser une version plus récente.
4.3 Auto-save périodique

Un setInterval de 60 secondes déclenche la sauvegarde si isDirty (voxels) ou
isSurfaceDirty (surfaces) est à true.
4.4 Sauvegarde au démontage

Un useEffect avec cleanup sauvegarde les deux documents lorsque le composant est démonté
(changement de carte, basculement vers le mode jeu). La sauvegarde utilise saveFireAndForget
pour ne pas bloquer le démontage React.
4.5 Format des données

    Voxels : objet { "x:y:z": { tex, geo, r } } — conforme à la convention PE14.

    Surfaces : surface_data v12, normalisé par normalizeSurfaceData avant envoi.

4.6 Réconciliation après erreur

Si une sauvegarde surface échoue, une alerte est affichée en bas de l'écran. Le composant
Editor3D expose surfaceSaveError, rendu comme une bannière rouge fixe.
5. Undo / Redo surface
5.1 Piles

Deux piles limitées à 50 entrées chacune :
javascript

surfaceUndoStackRef  // clones profonds du surfaceData avant modification
surfaceRedoStackRef  // clones profonds après undo

À chaque modification de surfaceData, l'état précédent est poussé dans la pile undo et la pile
redo est vidée.
5.2 Déclenchement

    Ctrl+Z : handleSurfaceUndo() dépile et restaure l'état précédent.

    Ctrl+Y ou Ctrl+Shift+Z : handleSurfaceRedo() dépile et restaure l'état suivant.

    Les touches sont désactivées quand l'onglet Entités est actif ou quand un champ texte a le
    focus.

    Des requêtes externes (surfaceUndoRequest, surfaceRedoRequest) peuvent également déclencher
    undo/redo.

5.3 Notification

L'état des piles (surfaceUndoDepth, surfaceRedoDepth) est remonté au parent via
onSurfaceUndoStateChange et onSurfaceRedoStateChange. La barre latérale utilise ces flags
pour activer/désactiver les boutons Annuler et Refaire.
6. Chargement des textures
6.1 Textures voxel (textureMaterials)

Au montage, Editor3D charge toutes les textures non-deprecated via GET /voxel-textures, puis
les convertit avec loadVoxelTextures. Le flag blocksReady passe à true une fois le
chargement terminé, même si aucune texture n'existe (P26). Les scènes ne sont rendues qu'après
blocksReady === true.
6.2 Textures d'entités (entityTextureMaterials)

Un useEffect observe les blueprints des entités présentes sur la carte. Pour chaque blueprint
avec pack_id et geometry.faces, un fakeTexObj est construit et chargé via
loadVoxelTextures. Le résultat est structuré par blueprint et par état visuel :
javascript

entityTextureMaterials = {
  [blueprint.id]: {
    base: { faceMaterials: [...] },
    states: { [stateId]: { faceMaterials: [...] } }
  }
}

Les blueprints sans pack_id sont ignorés (PEF5).
7. Effets runtime et ascenseurs

Autorité unique côté client : `client/src/stores/worldRuntimeStore.js` (Zustand — `worldEffects`,
`runtimeElevatorStates` + actions `fetchWorldEffects`/`fetchRuntimeElevators`) et
`client/src/lib/useWorldRuntimeSync.js` (cycle de vie : fetch initial, poll pendant transition,
écoute socket). Remplace 3 fetchs indépendants historiques (`Sidebar.jsx`/`Editor3D.jsx`/
`Canvas3D.jsx`) — chantier `docs/Old/PLAN_WORLD_RUNTIME_EFFECTS_STORE.md` (archivé, contenu durable
ici).

`useWorldRuntimeSync(battlemapId, socket)` est appelé **une seule fois par session**, depuis
`Editor3D.jsx` OU `Canvas3D.jsx` selon le mode (mutuellement exclusifs sur une carte 3D — jamais
montés ensemble). `Sidebar.jsx` ne l'appelle pas et ne fetch rien elle-même : elle lit `worldEffects`
directement via `useWorldRuntimeStore`, ce qui est sûr car son panneau de gestion des effets n'est
visible que pendant qu'`Editor3D.jsx` est monté (mode === 'edit') et synchronise déjà le store.

7.1 Effets runtime

Au montage, `fetchWorldEffects` appelle `GET /battlemaps/:id/world-effects` et peuple le store
(`definitions`, `instances`, `regions`, `featureStates`). Les régions sont affichées comme des
volumes translucides dans `SurfaceEditorScene`. L'écoute `WS.WORLD_RUNTIME_UPDATED` rafraîchit les
effets en temps réel, sauf pour les événements `elevator-*` (ignorés côté effets). La barre latérale
permet de créer des effets personnalisés (`POST .../world-effects/definitions`) et de supprimer des
instances existantes (`DELETE .../world-effects/instances/:id`) — chaque mutation rappelle
`fetchWorldEffects` directement pour un retour visuel immédiat côté auteur, en plus de l'émission
`WORLD_RUNTIME_UPDATED` qui propage aux autres clients connectés à la même campagne (la route de
création de définition n'émettait auparavant rien — corrigé dans le même chantier).

7.2 Ascenseurs

Au montage, `fetchRuntimeElevators` appelle `GET /battlemaps/:id/world-elevators` et peuple
`runtimeElevatorStates`. Si au moins un ascenseur est en transition (`closing`, `moving`, `opening`),
un polling de 300 ms est activé (`setInterval`) pour suivre le déplacement de la cabine. L'écoute
`WS.WORLD_RUNTIME_UPDATED` déclenche aussi un rafraîchissement, sauf pour l'événement
`elevator-clock` (tick d'horloge, ignoré côté ascenseurs pour éviter un fetch inutile à chaque tick).
8. Panneaux flottants

Trois panneaux contextuels s'ouvrent automatiquement lors de la sélection d'un élément :
Panneau	Composant	Déclencheur
Salle	SurfaceRoomPanel	Sélection d'une salle
Mur	SurfaceWallPanel	Sélection d'un ou plusieurs murs
Connecteur	SurfaceConnectorPanel	Sélection d'un connecteur

Les panneaux sont positionnés automatiquement à proximité de l'élément sélectionné. Ils sont
déplaçables par leur en-tête et restent contraints à la fenêtre. Un seul panneau est visible à la
fois — ouvrir un panneau ferme automatiquement les autres. Si l'élément sélectionné est supprimé
(par exemple, une salle effacée), le panneau correspondant est fermé.
9. Conventions et pièges
9.1 Sauvegarde
Code	Description
P12	VOXEL_ADD : guard if (!battlemapId) return avant toute émission
P13	updated_at = db.fn.now() après le guard Object.keys — jamais avant
9.2 Migrations
Code	Description
P52	CLI knex trie par ordre lexical — ne pas utiliser pour tester un round-trip
P53	nodemon réapplique les migrations à chaque écriture sous server/
P54	Vérifier knex_migrations avant tout appel manuel à up()/down()
9.3 Textures
Code	Description
P26	blocksReady = true même si 0 textures chargées
PEF5	Blueprint sans pack_id → skip + rendu magenta (debug)
PEF6	Chargements textures voxels et entités séparés
9.4 Convention PE14
text

pos_x = X (Three.js X)
pos_y = Z (profondeur Three.js)
pos_z = Y (altitude Three.js)

Les coordonnées stockées en base et transmises par les événements WS utilisent toujours cette
convention. Le rendu Three.js applique la conversion inverse.
10. Fichiers de référence
Fichier	Rôle
client/src/components/Editor3D.jsx	Coordination de l'éditeur
client/src/components/Sidebar.jsx	Barre latérale (onglets, outils, palette)
client/src/components/SurfaceEditorScene.jsx	Scène d'édition des surfaces
client/src/lib/surfaceData.js	Logique métier des surfaces
client/src/lib/surfacePersistence.js	Persistance du document surface
client/src/lib/voxelTextures.js	Chargement des textures
shared/world/surfaceDocument.js	Validation serveur du document surface
shared/world/entityTransform.js	Normalisation de l'échelle des entités
