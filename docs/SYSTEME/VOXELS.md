# SYSTEME/VOXELS.md — Format voxel legacy et adaptateurs de coordonnées
> Mis à jour : 2026-07-22 — retrait complet de l'autorité spatiale voxel/Redis.
> Source : SYSTEME.md §7–§8
> Lire pour : rendu des anciennes cartes voxel, registre `voxel_textures` et adaptation DB/monde
>
> Statut : `voxel_data` est conservé pour le rendu et l'édition des anciennes cartes. Il n'est plus
> une autorité de collision, de navigation, de LOS ou de combat. Cette autorité appartient au
> `WorldSnapshot` compilé depuis `surface_data` v13.

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

### Limite du format legacy

La clé `"x:y:z"` de `voxel_data` reste en axes Three.js bruts : `y` est l'altitude et `z` la
profondeur. Elle ne doit jamais être injectée dans les services de monde. Une carte active est
validée avec `shared/world/surfaceDocument.js`, puis compilée par `shared/world/worldCompiler.js`.
Les anciens helpers Redis `buildCollisionMap` / `collisionAddVoxel` / `collisionRemoveVoxel` ont été
retirés.

---

## Coordonnées entités — PE14

```javascript
// Base de données → point monde/Three.js
const point = dbPositionToWorldPoint(row)
// { x: row.pos_x, y: row.pos_z, z: row.pos_y }

// Point monde/Three.js → base de données
const position = worldPointToDbPosition(point)
// { pos_x: point.x, pos_y: point.z, pos_z: point.y }
```

**Règle PE14 résumée :**
| Colonne DB | Signification Three.js |
|---|---|
| `pos_x` | axe X (inchangé) |
| `pos_y` | axe Z (profondeur) |
| `pos_z` | axe Y (altitude) |

S'applique aux tokens et entités runtime. Ne s'applique pas aux clés `voxel_data`, qui restent un
format de rendu legacy en axes Three.js bruts.

---

## PE34 — Altitude des pieds d'un token canonique

```javascript
if (token.position_space !== 'world-feet') {
  // Ancien token : le MJ doit le replacer avant un déplacement moteur autoritaire.
}
const feet = dbPositionToWorldPoint(token)
const overlayY = feet.y + 0.05 // évite le z-fighting
```

Pour `position_space = 'world-feet'`, la position sauvegardée est déjà le point de contact des pieds
avec le support. Ne jamais réintroduire `+0.5` ou `+1.0` dans un calcul physique. Le décalage de
compatibilité des anciens tokens est uniquement visuel dans `Canvas3D`.

---

## Pièges voxels — référence rapide

| Code | Description |
|---|---|
| P17 | Séparateur clé voxel = `":"` — `"x:y:z"` NON NÉGOCIABLE. Jamais `"x,y,z"` ni `"x-y-z"`. |
| P22 | `voxel_textures.id` = integer — exception UUID du projet. `increments()` intentionnel. |
| P26 | `blocksReady = true` même si 0 textures — ne pas conditionner sur la longueur du tableau |
| P32 | Ordre faces `BoxGeometry` (Three.js) : east(0), west(1), top(2), bottom(3), south(4), north(5) — index matériaux fixes |
