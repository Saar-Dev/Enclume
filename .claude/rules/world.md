---
description: Autorité canonique du moteur monde, géométrie, navigation, LOS et connecteurs
paths:
  - "shared/world/**"
  - "server/src/services/world*.js"
  - "server/src/services/movementBudgetService.js"
  - "server/src/services/battlemapWorldPersistence.js"
  - "server/src/routes/battlemaps.js"
  - "client/src/components/Surface*.jsx"
  - "client/src/components/Canvas3D.jsx"
  - "client/src/components/Editor3D.jsx"
  - "client/src/components/ReliefBoxGeometry.jsx"
  - "client/src/lib/surfaceData.js"
---

# Moteur monde canonique

Lire `docs/SYSTEME/MOTEUR_MONDE.md` avant toute modification de ce périmètre.

## Autorités

- `surface_data` v12 est le document statique canonique, validé avant compilation.
- `shared/world/worldCompiler.js` produit un `WorldSnapshot` immuable.
- Ce snapshot est l'autorité unique pour supports, barrières, traversées, colliders, occluders,
  compartiments, régions, navigation, collision, occupation, LOS et couverture.
- PostgreSQL conserve le document durable; Redis et `voxel_data` ne sont jamais des autorités spatiales.
- Le rendu consomme le modèle canonique; il ne le redéfinit pas à partir de meshes Three.js.
- Document statique et état runtime sont séparés: portes, ascenseurs, fluides, feu, gaz, objets mobiles
  et occupants évoluent sans réécrire arbitrairement la géométrie source.

## Mesures et géométrie

- Toutes les règles emploient des mètres via `WorldMetrics`; la grille est une aide de saisie.
- Valeur par défaut: 1 case = 1,5 m; ne jamais enfouir cette constante dans un calcul métier.
- Respecter les axes et conversions définis par le compilateur et `entityTransform`.
- Une salle est un volume, pas une collection d'étages indépendants.
- Les salles multi-niveaux conservent leurs vides, murs continus et visibilité verticale.
- Courbes, profils, raccords et fusions sont décrits dans la géométrie canonique; aucune rustine de
  rendu ne doit masquer un trou ou un chevauchement réel.
- Deux salles adjacentes peuvent avoir des hauteurs différentes sans rendre le document invalide.
- Sol et plafond sont des faces intérieures; leur partage avec un volume adjacent doit être explicite.

## Canaux et connecteurs

- Mouvement, vision, projectiles et fluides sont des canaux indépendants portés par les capacités.
- Une porte, trappe, échelle, escalier, passerelle et ascenseur est un connecteur déclaré.
- Escaliers et échelles possèdent un trajet continu; un token peut s'y arrêter faute de budget.
- Un ascenseur est une cabine physique mobile, avec position, portes, capacité et passagers; ce n'est
  jamais une téléportation entre étages.
- Une passerelle fournit un support praticable et respecte l'enveloppe réelle des murs courbes/profilés.
- Le GLB définit l'apparence seulement; collision, support, coût et occlusion viennent des capacités.

## Interaction runtime sur une porte

- Une porte connaît trois états: `closed`, `open`, `locked`. L'état autoré vit dans
  `surface_data.connectors[].state`; l'état de partie vit dans `world_feature_states`
  (`feature_id = connector.worldId`, même table que l'ascenseur). Sans ligne runtime, l'état autoré
  fait foi; `doorGeometry` applique collision, LOS, eau et gaz selon l'état effectif.
- Ouvrir ou refermer une porte non verrouillée est une action libre, sans Test.
- Crocheter une porte `locked` est un Test **Systèmes de sécurité** arbitré par le MJ, sur le patron
  d'interaction d'entité. La Difficulté est `connector.lockDifficultyDc` (modificateur signé ajouté
  au Seuil, négatif = plus dur), autorée par porte; repli **−5** si absente.
- Le calcul d'un Test arbitré par le MJ (total, malus, jet, critique, breakdown, Catastrophe) a une
  autorité unique, `gmArbitratedTestService`, partagée avec l'interaction d'entité — jamais dupliquée.
- Contrat socket `CONNECTOR_ACTION_REQUEST` / `_PENDING` / `_RESOLVE` / `_RESULT`. Le connecteur est
  désigné par `connector.worldId`, jamais par la clé d'objet legacy de `surface_data.connectors`.
- La portée joueur↔porte est une distance point→segment (une porte est un segment ou un arc, pas un
  point), altitude comprise, via `worldMetrics` puis `worldSpatialQueryService`.
- Tout clic MJ sur le panneau connecteur est instantané, sans Test ni portée (mirroir de l'action
  directe MJ sur une entité), et peut re-verrouiller; un payload joueur ne verrouille jamais.
- Une mutation d'état émet `WORLD_RUNTIME_UPDATED { kind: 'door-state' }` et rafraîchit `featureStates`
  chez tous les clients. Le GLB ne reflète pas encore l'état ouvert/fermé — rendu 3D seul, la
  collision et la LOS sont correctes.

## Résolution serveur

- Le client envoie une intention ou destination; le serveur recalcule chemin, coût, position atteinte,
  distance, LOS, couverture et effets depuis le snapshot et l'état runtime courants.
- Les modificateurs de surface prédéfinis et personnalisés se composent explicitement.
- Le coût tient compte du mode de déplacement et autorise une position finale à l'intérieur d'un
  connecteur lorsque le budget est épuisé.
- Toute mutation invalide/recompile la granularité prévue par le moteur, sans créer un second cache
  autoritaire.

## Validation minimale

- Tester validation v12, compilation, sérialisation et rechargement.
- Tester salles adjacentes ou imbriquées, hauteurs différentes, courbes/profils et raccords.
- Tester plusieurs niveaux, arrêt sur connecteur, occupation, portes, LOS et couverture.
- Tester build client et rendu réel sans transformer un défaut géométrique en simple artefact masqué.
