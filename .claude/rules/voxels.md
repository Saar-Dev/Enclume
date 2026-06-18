---
paths:
  - "client/src/components/Canvas3D.jsx"
  - "client/src/components/CulledVoxelScene.jsx"
  - "client/src/components/Editor3D.jsx"
  - "client/src/components/Voxel.jsx"
  - "client/src/lib/buildCulledMesh.js"
  - "client/src/lib/voxelTextures.js"
  - "server/src/lib/voxelTextures.js"
  - "server/src/routes/battlemaps.js"
---
# Domaine : Voxels, 3D & Canvas

**Spec technique → `docs/SYSTEME/VOXELS.md`**

## Pièges critiques

**PE14 — coordonnées voxels**
`pos_y` DB = profondeur (Z Three.js). `pos_z` DB = altitude (Y Three.js).
Voxels Redis convertis Three.js→PE14 dans buildCollisionMap/add/remove.
Coordonnées **brutes en base** — `+0.5` uniquement dans le rendu visuel, jamais en DB.

**P32 — Ordre faces BoxGeometry**
east(0), west(1), top(2), bottom(3), south(4), north(5).
`buildCulledMesh` groupe par `(texId × physIdx)` — ordre strict.

**ROTATION_FACE_MAP — cubes r≠0**
`ROTATION_FACE_MAP[r][physIdx]→origPhysIdx` pour textures multi-faces correctes sur cubes tournés.
Ajouté Session 77 Phase B.

**VX1 — getVoxelSurfaceTop : cas manquants**
Pas de gestion slope/wedge en V1. `slab_bottom → y+0.5` uniquement. Connu et documenté.

**buildCulledMesh — fonction pure**
Pas d'import Three.js. Pas d'accès DOM. Groupement par `(texId × physIdx P32)`.

**CulledVoxelScene — dispose**
`dispose` via `useEffect` cleanup — ne pas omettre pour éviter les fuites mémoire GPU.
Non-cubes → `<Voxel>` individuel (pas dans le mesh fusionné).

**colTopSurface — useMemo O(1)**
Remplace `getColumnTopY O(N)` — ne pas revenir au parcours linéaire.
