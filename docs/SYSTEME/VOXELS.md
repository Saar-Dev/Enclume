# SYSTEME/VOXELS.md — Coordonnées, voxels, PE14
> Source : SYSTEME.md §7–§8
> Lire pour : tout code touchant les voxels, coordonnées 3D, tokens (pos_x/y/z), overlays canvas

---

## Flux voxels — coordonnées et format

### Coordonnées voxel
```javascript
// Base = entiers bruts
// Rendu Three.js = brut + 0.5 (centrage dans la case)
// Ne jamais mélanger (P5)
```

### Format voxel_data
```javascript
// Base (migration 30) :
{ "x:y:z": { "tex": N, "geo": "cube", "r": 0 } }
// Clé "x:y:z" = convention Three.js brute (y=altitude, z=profondeur)

// Mémoire React :
{ "x:y:z": { x, y, z, tex, geo, r } }

// save() payload — jamais l'objet mémoire entier (P16) :
payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
```

### Convention clés collision map Redis — voxels (PE28)
```
voxel_data stocke : "x:y_altitude:z_profondeur" (Three.js brut)
Redis collision map : "x:z_profondeur:y_altitude" (PE14 base)
Conversion dans buildCollisionMap/collisionAddVoxel/collisionRemoveVoxel :
  const [vx, vy, vz] = voxelKey.split(':').map(Number)
  const pe14Key = `${vx}:${vz}:${vy}`
```
**Convention Redis = PE14 partout (tokens, entités, voxels). Three.js = rendu uniquement.**

---

## Coordonnées entités — PE14

```javascript
// Base de données → Three.js (rendu dans EntityMesh)
posX = entity.pos_x + width/2
posY = entity.pos_z + height/2   // pos_z base = altitude Y Three.js
posZ = entity.pos_y + depth/2    // pos_y base = profondeur Z Three.js

// Three.js → base de données (pose depuis Editor3D)
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }
// Identique à threeToDb() — jamais inline
```

**Règle PE14 résumée :**
| Colonne DB | Signification Three.js |
|---|---|
| `pos_x` | axe X (inchangé) |
| `pos_y` | axe Z (profondeur) |
| `pos_z` | axe Y (altitude) |

S'applique à : tokens, entités, voxels Redis. Ne s'applique PAS aux clés voxel_data en base (Three.js brut).

---

## PE34 — Altitude pieds token en Three.js (session 61)

```javascript
// Token group (lerpPos) centré à : Y = token.pos_z + 0.5 (centre du voxel)
// Y_OFFSET = 0.5 (primitive au-dessus du centre) → pieds à : Y = token.pos_z + 1.0

// Formule pieds token (Three.js Y) :
const feetY = token.pos_z + 1.0

// Pour un overlay au sol (anneau, cercle) — +0.05 évite le z-fighting :
const overlayY = token.pos_z + 1.0 + 0.05
```
**Piège :** `token.pos_z + 0.5` = centre du voxel (intérieur) — overlays sols cachés.
`token.pos_z + 1.0` = surface du sol = pieds du token.
Cohérent avec PE29 (step-by-step collision à pos_z+1 = espace de marche).

---

## Pièges voxels — référence rapide

| Code | Description |
|---|---|
| P12 | `VOXEL_ADD` handler : guard `if (!battlemapId) return` en tête — battlemapId peut être null si carte non chargée |
| P17 | Séparateur clé voxel = `":"` — `"x:y:z"` NON NÉGOCIABLE. Jamais `"x,y,z"` ni `"x-y-z"`. |
| P22 | `voxel_textures.id` = integer — exception UUID du projet. `increments()` intentionnel. |
| P26 | `blocksReady = true` même si 0 textures — ne pas conditionner sur la longueur du tableau |
| P32 | Ordre faces `BoxGeometry` (Three.js) : east(0), west(1), top(2), bottom(3), south(4), north(5) — index matériaux fixes |
