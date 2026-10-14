---
description: Rendu d'un bloc texturé isolé (Voxel.jsx) — forme cubique de catalogue, pas un format de carte
paths:
  - "client/src/**/*Voxel*.jsx"
---

# Bloc texturé « voxel » — rendu du catalogue

> Mise à jour 2026-10-14 (PLAN_PURGE_VOXEL.md Lot 6) : le format de carte `voxel_data` et son pipeline
> sont morts et retirés (Lots 1-3) — ce qui reste sous ce nom est uniquement le rendu d'un bloc
> texturé isolé (`Voxel.jsx`), utilisé par l'aperçu du catalogue (`VoxelBuilderTab.jsx`). « Voxel » y
> désigne une forme cubique/bloc, pas une carte. Détail : `docs/SYSTEME/VOXELS.md`.

- Aucun calcul de collision, navigation, occupation, LOS, couverture ou portée ne dépend de ce rendu.
- Le décalage de centre de cube (`+0.5`) appartient uniquement à la conversion de rendu si nécessaire.
- Respecter l'ordre des faces attendu par Three.js et documenter la correspondance des matériaux.
- Une texture utilisée sur plusieurs faces n'est chargée qu'une fois puis partagée consciemment.
- Disposer géométries, matériaux et textures créés lorsque le rendu est détruit, sans disposer une
  ressource encore partagée.
- Toute nouvelle fonctionnalité monde est ajoutée à `surface_data`/`WorldSnapshot`, jamais ici.
