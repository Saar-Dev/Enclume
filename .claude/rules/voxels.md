---
description: Rendu voxel historique, strictement non autoritaire
paths:
  - "client/src/**/*Voxel*.jsx"
  - "client/src/**/*voxel*.js"
  - "client/src/**/voxelTextures*"
---

# Voxels legacy / rendu

- `voxel_data` est un format historique ou visuel; il ne contraint jamais le monde canonique.
- Aucun calcul de collision, navigation, occupation, LOS, couverture ou portée ne dépend des voxels.
- Toute conversion voxel vers rendu est un adaptateur à sens unique, pas un second modèle métier.
- Le décalage de centre de cube (`+0.5`) appartient uniquement à la conversion de rendu si nécessaire.
- Respecter l'ordre des faces attendu par Three.js et documenter la correspondance des matériaux.
- Une texture utilisée sur plusieurs faces n'est chargée qu'une fois puis partagée consciemment.
- Disposer géométries, matériaux et textures créés lorsque le rendu est détruit, sans disposer une
  ressource encore partagée.
- Toute nouvelle fonctionnalité monde est ajoutée à `surface_data`/`WorldSnapshot`, jamais ici.
