# PLAN_VOXELS.md — Refonte voxel + Système de packs de textures
> Version initiale : session 21 — 2026-04-08
> Révision majeure : session 25 (planification) — refonte modèle texture × géométrie
> Ce document est la référence pour les Chantiers 9A et 9B.
> À fournir en début de session avant tout travail sur ces chantiers.

---

## Contexte et pourquoi cette révision

Le modèle initial (`block_type` = paire texture+géométrie) forçait la création d'une
entrée en base par combinaison (texture, géométrie). Pour "sol métal en cube ET en slope",
il fallait deux `block_types` avec les mêmes textures. Ce n'est pas extensible.

**Décision de révision :** séparer texture et géométrie. Un voxel = (texture, géométrie, rotation).
Les deux dimensions sont orthogonales et combinables librement par le GM.

Conséquence : les raccourcis 1-9 sélectionnent une géométrie (pas un bloc entier).
La palette Sidebar affiche les textures. Le GM choisit texture + géométrie séparément.

---

## Décisions fondamentales verrouillées

### Format voxel_data — NON NÉGOCIABLE après migration 30

**Avant (migrations 21-26 — modèle intermédiaire) :**
```json
{ "0:0:0": { "id": 1, "r": 0 } }
```

**Après (migration 30 — modèle définitif) :**
```json
{ "0:0:0": { "tex": 1, "geo": "cube", "r": 0 } }
```

- `tex` = voxel_texture_id (entier auto-incrémenté global)
- `geo` = string géométrie : `cube | slab_bottom | slab_top | slope | wedge`
- `r` = rotation : 0 / 1 / 2 / 3 (quarts de tour sur l'axe Y)
- Séparateur clé `":"` — NON NÉGOCIABLE (inchangé, P17)
- Une case = un voxel. Pas de double occupation. Limitation assumée.
- Pas de `packId` par voxel — les IDs sont globaux, multi-packs supporté.

### Géométries supportées V1

| Valeur `geo` | Description | Implémentation Three.js |
|---|---|---|
| `cube` | Cube plein | `BoxGeometry(1,1,1)` |
| `slab_bottom` | Demi-dalle basse | `BoxGeometry(1,0.5,1)`, offset Y -0.25 |
| `slab_top` | Demi-dalle haute | `BoxGeometry(1,0.5,1)`, offset Y +0.25 |
| `slope` | Rampe inclinée | Géométrie custom — prisme 5 faces (placeholder cube en 9A) |
| `wedge` | Coin biseauté | Géométrie custom — prisme 4 faces (placeholder cube en 9A) |

### Raycasting — règle fondamentale

Le raycasting se fait toujours sur la **bounding box cubique** (`BoxGeometry(1,1,1)`
invisible), quelle que soit la géométrie visuelle réelle.
La géométrie custom (slope, wedge) est uniquement visuelle.

Chaque voxel rendu a un `<mesh visible={false} userData={{ isVoxel: true, position }}>` pour
le raycasting — jamais sur la géométrie visible.

### Rotation — règle d'interaction

- `r` = cycle 0 → 1 → 2 → 3 → 0 (quarts de tour axe Y)
- `R` avant de poser = change la rotation du ghost voxel
- `R` avec le curseur sur un voxel posé = rotation en place → `VOXEL_UPDATE`
- Pas de sélection de zone — rotation unitaire V1

### Interactions éditeur — règles

| Action | Résultat |
|---|---|
| Clic palette texture | Sélectionne la texture active |
| Clic gauche canvas | Pose un voxel (texture active + géométrie active + rotation active) |
| Clic droit canvas | Supprime le voxel ciblé |
| `R` | Rotation ghost (curseur dans le vide) ou rotation en place (curseur sur voxel) |
| Touches `e.code` Digit1-5 | Sélection géométrie : 1=cube, 2=slab_bottom, 3=slab_top, 4=slope, 5=wedge |
| Touches `e.code` Digit6-9 | Réservés (futures géométries V2) |

**Note clavier :** utiliser `e.code` (invariant layout) et non `e.key` (dépend AZERTY/QWERTY).

**Clic gauche sur un voxel existant = pose un nouveau voxel sur la face ciblée.**
Pour remplacer : clic droit (supprimer) puis clic gauche (reposer).

---

## Architecture voxel_textures — source de vérité en base

### Décision fondamentale — NON NÉGOCIABLE

**La table `voxel_textures` est la source de vérité des textures, pas le manifest.**
Le manifest JSON reste utile uniquement comme **format de transport** (import/export ZIP).
Les textures ont des IDs globaux auto-incrémentés — pas de collision entre packs.
Une battlemap peut mélanger des textures de plusieurs packs sans stocker de `packId` par voxel.

### Table `voxel_textures` (migration 27)

```javascript
table.increments('id')
// INTEGER auto — exception justifiée à la convention UUID :
//   compact (1-4 chars vs 36), stocké dans JSONB, jamais FK typée
table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
table.uuid('category_id').references('id').inTable('texture_pack_categories').nullable()
table.string('label').notNullable()
table.jsonb('faces').notNullable()
// { top?, bottom?, north?, south?, east?, west?, all? }
// Alias 'side' accepté en lecture → north + south + east + west
// Priorité : face spécifique > all > magenta (#FF00FF)
table.jsonb('allowed_geometries').nullable()
// null = toutes géométries autorisées
// Array JSON : ["cube","slab_bottom"] = restreint
table.boolean('deprecated').defaultTo(false)
table.integer('sort_order').defaultTo(0)
table.integer('legacy_block_type_id').nullable()
// Colonne temporaire — mapping depuis block_types lors de la migration 30
// Droppée en migration 31 avec le drop de block_types
table.timestamps(true, true)
```

**Plafond applicatif :** 9999 textures max par pack (validation à l'import).

### Table `texture_pack_categories` (migration 23 — inchangée)

```javascript
table.uuid('id').primary().defaultTo(knex.fn.uuid())
table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
table.string('label').notNullable()
table.integer('sort_order').defaultTo(0)
```

**Ordre de création obligatoire :** `texture_pack_categories` avant `voxel_textures` — FK oblige.

### Table `battlemap_texture_usage` (migration 28)

Index des textures utilisées par battlemap — vérification `DELETE` en O(1) sans scan JSONB.

```javascript
table.uuid('battlemap_id').references('id').inTable('battlemaps').notNullable()
table.integer('voxel_texture_id').references('id').inTable('voxel_textures').notNullable()
table.primary(['battlemap_id', 'voxel_texture_id'])
```

**Mise à jour :** recalculée dans `PUT /battlemaps/:id/voxels` après chaque save.
```javascript
const usedTexIds = [...new Set(Object.values(voxel_data).map(v => v.tex))]
await db('battlemap_texture_usage').where({ battlemap_id: id }).delete()
if (usedTexIds.length > 0) {
  await db('battlemap_texture_usage').insert(
    usedTexIds.map(texId => ({ battlemap_id: id, voxel_texture_id: texId }))
  )
}
```

---

## Règles textures — faces nommées

### Convention de nommage des faces

Alignée sur la convention Minecraft/Three.js :
- `top` / `bottom` — dessus / dessous
- `north` / `south` / `east` / `west` — les 4 faces latérales
- `all` — fallback pour toutes les faces non définies explicitement
- `side` — **alias lecture uniquement** → `north + south + east + west` (rétrocompatibilité seed V1)

### Correspondance BoxGeometry Three.js

`BoxGeometry` expose ses 6 faces dans cet ordre (indices 0 à 5) :

| Index | Axe Three.js | Nom face | `faces` key |
|---|---|---|---|
| 0 | +X | Droite | `east` |
| 1 | -X | Gauche | `west` |
| 2 | +Y | Dessus | `top` |
| 3 | -Y | Dessous | `bottom` |
| 4 | +Z | Avant (vers caméra) | `south` |
| 5 | -Z | Arrière (profondeur) | `north` |

### Priorité de résolution par face

```
face spécifique (north/south/east/west/top/bottom) > all > magenta (#FF00FF)
```

Si ni face spécifique ni `all` → `MeshLambertMaterial({ color: 0xFF00FF })`.
Un `console.warn` identifie la texture fautive. Jamais de crash.

### Conversion `side` → faces nommées (migration 29 + `loadVoxelTextures`)

```javascript
// À la lecture de faces.side (seed V1, rétrocompat)
const resolvedFaces = { ...faces }
if (faces.side && !faces.north) resolvedFaces.north = faces.side
if (faces.side && !faces.south) resolvedFaces.south = faces.side
if (faces.side && !faces.east)  resolvedFaces.east  = faces.side
if (faces.side && !faces.west)  resolvedFaces.west  = faces.side
delete resolvedFaces.side
```

### Exemple — seed structure-station après conversion

```json
// Avant (migration 24, format block_types)
{ "top": "sol/metal_plate_top.png", "side": "sol/metal_plate_side.png" }

// Après (migration 29, format voxel_textures.faces)
{
  "top":    "sol/metal_plate_top.png",
  "bottom": "sol/metal_plate_side.png",
  "north":  "sol/metal_plate_side.png",
  "south":  "sol/metal_plate_side.png",
  "east":   "sol/metal_plate_side.png",
  "west":   "sol/metal_plate_side.png"
}
```

`bottom` reçoit l'image `side` par défaut — face inférieure rarement visible.

---

## Migrations — séquence complète

| N° | Nom | Contenu | Irréversible |
|---|---|---|---|
| 21 | texture_packs | Table texture_packs | Non |
| 22 | battlemaps_editor_lock | Colonnes editor_locked_by + editor_locked_until | Non |
| 23 | block_types | Tables texture_pack_categories + block_types | Non |
| 24 | seed_structure_station | Seed pack structure-station dans block_types | Non |
| 25 | voxel_data_format | `{ "x:y:z": entier }` → `{ id, r }` | **Oui** |
| 26 | battlemap_block_usage | Table battlemap_block_usage | Non |
| 27 | voxel_textures | Table voxel_textures | Non |
| 28 | battlemap_texture_usage | Table battlemap_texture_usage | Non |
| 29 | seed_voxel_textures | Seed structure-station dans voxel_textures + legacy_block_type_id | Non |
| 30 | voxel_data_refonte | `{ id, r }` → `{ tex, geo, r }` via legacy_block_type_id | **Oui** |
| 31 | drop_block_types | Drop block_types + battlemap_block_usage + legacy_block_type_id | **Oui** |

**Ordre obligatoire :** séquentiel. La migration 30 dépend de 29 (legacy_block_type_id).
La migration 31 dépend de 30 (données converties avant drop).

### Migration 29 — logique seed voxel_textures

```javascript
// Pour chaque bloc dans block_types (pack structure-station) :
// 1. Convertir faces : { top, side } → { top, bottom, north, south, east, west }
// 2. Insérer dans voxel_textures avec legacy_block_type_id = block_types.id
// 3. allowed_geometries = null (toutes autorisées)

const blocks = await knex('block_types')
  .where({ pack_id: PACK_UUID })
  .orderBy('sort_order')

for (const block of blocks) {
  const rawFaces = block.textures  // { top?, side?, all? }
  const faces = {}
  if (rawFaces.top)    { faces.top = rawFaces.top }
  if (rawFaces.all)    { faces.all = rawFaces.all }
  if (rawFaces.side) {
    faces.bottom = rawFaces.side
    faces.north  = rawFaces.side
    faces.south  = rawFaces.side
    faces.east   = rawFaces.side
    faces.west   = rawFaces.side
  }

  await knex('voxel_textures').insert({
    pack_id:               block.pack_id,
    category_id:           block.category_id,
    label:                 block.label,
    faces:                 JSON.stringify(faces),
    allowed_geometries:    null,
    deprecated:            false,
    sort_order:            block.sort_order,
    legacy_block_type_id:  block.id,
  })
}
```

### Migration 30 — logique conversion voxel_data

```javascript
// Construire le mapping legacy_block_type_id → voxel_texture_id
const textures = await knex('voxel_textures')
  .whereNotNull('legacy_block_type_id')
  .select('id', 'legacy_block_type_id')

const blockToTex = {}
for (const t of textures) {
  blockToTex[t.legacy_block_type_id] = t.id
}

// Lire geometry depuis block_types (encore présente à ce stade)
const blockGeos = {}
const blocks = await knex('block_types').select('id', 'geometry')
for (const b of blocks) { blockGeos[b.id] = b.geometry }

// Convertir chaque battlemap
const battlemaps = await knex('battlemaps')
  .whereNotNull('voxel_data')
  .select('id', 'voxel_data')

for (const bm of battlemaps) {
  const data = bm.voxel_data
  if (!data || typeof data !== 'object') continue

  const migrated = {}
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'object' && val.id !== undefined) {
      // Format { id, r } → { tex, geo, r }
      const texId = blockToTex[val.id]
      const geo   = blockGeos[val.id] || 'cube'
      if (!texId) {
        console.warn(`Migration 30 : block_type_id ${val.id} sans voxel_texture — voxel ignoré`)
        continue
      }
      migrated[key] = { tex: texId, geo, r: val.r ?? 0 }
    } else {
      // Données inattendues — ignorer avec warning
      console.warn(`Migration 30 : format inattendu pour la clé ${key}`, val)
    }
  }

  await knex('battlemaps')
    .where({ id: bm.id })
    .update({ voxel_data: JSON.stringify(migrated) })
}
```

### Migration 31 — drop

```javascript
// 1. Dropper legacy_block_type_id de voxel_textures
await knex.schema.alterTable('voxel_textures', t => t.dropColumn('legacy_block_type_id'))
// 2. Dropper battlemap_block_usage (ancienne table)
await knex.schema.dropTableIfExists('battlemap_block_usage')
// 3. Dropper block_types (ancienne table)
await knex.schema.dropTableIfExists('block_types')
```

`down` = no-op documenté pour 30 et 31 (irréversibles).

---

## Route serveur — /api/voxel-textures

**Remplace `/api/block-types`.** Pas de conflit avec `/api/textures` (proxy MinIO fichiers PNG).

```javascript
// GET /api/voxel-textures — toutes les textures non deprecated (palette)
// GET /api/voxel-textures?ids=1,3,7 — par IDs (Canvas3D au chargement)

router.get('/', requireAuth, async (req, res, next) => {
  let query = db('voxel_textures')
    .join('texture_packs', 'voxel_textures.pack_id', 'texture_packs.id')
    .leftJoin('texture_pack_categories', 'voxel_textures.category_id', 'texture_pack_categories.id')
    .select(
      'voxel_textures.id',
      'voxel_textures.pack_id',
      'voxel_textures.label',
      'voxel_textures.faces',
      'voxel_textures.allowed_geometries',
      'voxel_textures.deprecated',
      'voxel_textures.sort_order',
      'voxel_textures.category_id',
      'texture_packs.name as pack_name',
      'texture_packs.tile_size',
      'texture_pack_categories.label as category_label',
      'texture_pack_categories.sort_order as category_sort_order',
    )

  if (req.query.ids) {
    const ids = req.query.ids.split(',').map(Number).filter(Boolean)
    query = query.whereIn('voxel_textures.id', ids)
  } else {
    query = query
      .where({ 'voxel_textures.deprecated': false })
      .orderBy([
        { column: 'texture_pack_categories.sort_order', order: 'asc', nulls: 'last' },
        { column: 'voxel_textures.sort_order', order: 'asc' },
      ])
  }

  const textures = await query
  res.json({ textures })
})
```

---

## Chargement client — loadVoxelTextures

**Remplace `loadBlockTextures`.** Retourne `{ [texId]: { faceMaterials: THREE.Material[6] } }`.
La `geometry` ne fait plus partie des matériaux — elle vient de `voxel_data` directement.

```javascript
// client/src/lib/voxelTextures.js
export async function loadVoxelTextures(textures) {
  const loader = new THREE.TextureLoader()
  const result = {}

  for (const tex of textures) {
    const faces = tex.faces  // { top?, bottom?, north?, south?, east?, west?, all? }
    const packName = tex.pack_name

    // Résoudre alias 'side' → faces nommées (rétrocompat)
    const resolved = { ...faces }
    if (faces.side) {
      if (!resolved.north)  resolved.north  = faces.side
      if (!resolved.south)  resolved.south  = faces.side
      if (!resolved.east)   resolved.east   = faces.side
      if (!resolved.west)   resolved.west   = faces.side
      delete resolved.side
    }

    const loadTex = (path) => { /* ... identique à avant ... */ }

    const makeMat = (tex) => tex
      ? new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff })
      : new THREE.MeshLambertMaterial({ color: 0xFF00FF })

    // Ordre BoxGeometry : east(+X), west(-X), top(+Y), bottom(-Y), south(+Z), north(-Z)
    const eastTex   = await loadTex(resolved.east   || resolved.all || null)
    const westTex   = await loadTex(resolved.west   || resolved.all || null)
    const topTex    = await loadTex(resolved.top    || resolved.all || null)
    const bottomTex = await loadTex(resolved.bottom || resolved.all || null)
    const southTex  = await loadTex(resolved.south  || resolved.all || null)
    const northTex  = await loadTex(resolved.north  || resolved.all || null)

    result[tex.id] = {
      faceMaterials: [
        makeMat(eastTex),
        makeMat(westTex),
        makeMat(topTex),
        makeMat(bottomTex),
        makeMat(southTex),
        makeMat(northTex),
      ],
    }
  }

  return result
}
```

---

## Composant Voxel — après refonte

```jsx
// Props : position [x,y,z], textureMaterials { faceMaterials }, geometry string, rotation 0-3
function Voxel({ position, textureMaterials, geometry, rotation }) {
  if (!textureMaterials) return null

  const [px, py, pz] = position
  const rot = (rotation || 0) * (Math.PI / 2)
  const yOffset = geometry === 'slab_bottom' ? -0.25
    : geometry === 'slab_top' ? 0.25
    : 0

  return (
    <mesh position={[px+0.5, py+0.5+yOffset, pz+0.5]} rotation={[0, rot, 0]}
          userData={{ isVoxel: true, position }}>
      {/* Géométrie visuelle */}
      {geometry === 'slab_bottom' || geometry === 'slab_top'
        ? <boxGeometry args={[1, 0.5, 1]} />
        : <boxGeometry args={[1, 1, 1]} />}
      {textureMaterials.faceMaterials.map((mat, i) => (
        <meshLambertMaterial key={i} attach={`material-${i}`} {...mat} />
      ))}
      {/* BBox invisible — raycasting uniforme (P_raycasting_bbox) */}
      <mesh visible={false} userData={{ isVoxel: true, position }}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </mesh>
  )
}
```

---

## activeMaterial — nouveau format

```javascript
// Avant (sessions 9A-2/9A-3)
activeMaterial = { id: N, r: 0 }  // id = block_type_id

// Après (session 9A-5)
activeMaterial = { texId: N, geo: 'cube', r: 0 }
```

Stocké dans `SessionPage`. Passé à `Editor3D` et `Sidebar`.

Raccourcis Digit1-5 modifient `geo` uniquement :
```javascript
const GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']
// Digit1 → geo = 'cube', Digit2 → 'slab_bottom', etc.
onActiveMaterialChange(prev => prev ? { ...prev, geo: GEOMETRIES[idx] } : prev)
```

Guard `allowed_geometries` : si la texture active restreint les géométries et que la
géométrie demandée n'est pas dans la liste → raccourci ignoré silencieusement.

---

## WS — payloads mis à jour

```javascript
// VOXEL_ADD — avant
{ battlemapId, x, y, z, id, r }
// VOXEL_ADD — après
{ battlemapId, x, y, z, tex, geo, r }

// VOXEL_ADDED — idem VOXEL_ADD
// VOXEL_UPDATE — inchangé : { battlemapId, x, y, z, r }
// VOXEL_UPDATED — inchangé : { battlemapId, x, y, z, r }
// VOXEL_REMOVE / VOXEL_REMOVED — inchangés : { battlemapId, x, y, z }
```

---

## Palette Sidebar — après refonte

- Affiche les `voxel_textures` groupées par catégorie
- Aperçu : texture `top` (ou `all`) en fond d'image
- Sélection texture → `onMaterialChange({ texId: tex.id, geo: 'cube', r: 0 })`
- Pas d'icône géométrie par texture — la géométrie est sélectionnée via les raccourcis 1-5
- Afficher la géométrie active en cours (badge sur le bouton actif) : `GeometryIcon` dans le header palette
- `deprecated: true` → masqué de la palette, rendu conservé pour les voxels existants

---

## Format manifest — transport (import/export ZIP)

Le manifest est le **format de transport uniquement**. Jamais stocké en base tel quel.
Localités = IDs locaux au pack, remappés à l'import vers IDs globaux `voxel_textures`.

```json
{
  "name": "structure-station",
  "label": "Structure de station",
  "tileSize": 128,
  "categories": [
    { "id": "sol",    "label": "Sol",     "sort_order": 0 },
    { "id": "mur",    "label": "Mur",     "sort_order": 1 },
    { "id": "fenetre","label": "Fenêtre", "sort_order": 2 },
    { "id": "bloc",   "label": "Bloc",    "sort_order": 3 }
  ],
  "textures": [
    {
      "localId": 1,
      "label": "Plaque métal",
      "category": "sol",
      "faces": {
        "top":    "sol/metal_plate_top.png",
        "bottom": "sol/metal_plate_side.png",
        "north":  "sol/metal_plate_side.png",
        "south":  "sol/metal_plate_side.png",
        "east":   "sol/metal_plate_side.png",
        "west":   "sol/metal_plate_side.png"
      },
      "allowed_geometries": null,
      "sort_order": 0
    }
  ]
}
```

`geometry` disparaît du manifest — la géométrie est choisie par le GM à la pose.
`localId` = ID dans le ZIP, remappé à l'import. Jamais stocké en base.

---

## Éditeur — architecture (inchangée)

Canvas3D ↔ Editor3D toggle dans SessionPage. Mêmes règles lock, heartbeat, save.
Voir sections inchangées ci-dessous (lock, ghost, save, undo/redo).

### Lock éditeur — inchangé

Colonnes `editor_locked_by` + `editor_locked_until` sur `battlemaps` (migration 22).
Cycle : acquisition → heartbeat 30s → libération au démontage.
423 si locké par un autre GM.

### Ghost voxel

Mesh semi-transparent, géométrie = `activeMaterial.geo`, rotation = `activeMaterial.r`.
Suit le curseur. Non affiché si `activeMaterial` null.

### Save

`saveFireAndForget(currentVoxels)` — `fetch` sans await (fire-and-forget).
Payload : `payload[key] = { tex: v.tex, geo: v.geo, r: v.r }`.
Deux déclencheurs : auto-save 60s si dirty + cleanup useEffect au démontage.

### Undo/redo — Command Pattern (session 9A-5)

```javascript
class PlaceVoxelCommand {
  constructor(key, x, y, z, tex, geo, r, previous) { ... }
  execute(setVoxels) { setVoxels(prev => ({ ...prev, [key]: { x,y,z,tex,geo,r } })) }
  undo(setVoxels) { /* restaure previous ou delete */ }
}
class RemoveVoxelCommand { ... }
class RotateVoxelCommand { /* modifie r uniquement */ }
```

Historique limité à 50 actions. dirty = true dans execute() ET undo().

---

## Prévu V2/V3 — portes et entités actionnables

**Ne pas implémenter maintenant. Documenter pour ne pas oublier.**

Le modèle `{ tex, geo, r }` est extensible à `{ tex, geo, r, state }` sans migration destructive.

**Géométries futures :**
- `door_single` — porte simple (1×2 unités)
- `door_double` — double porte (2×2 unités)
- `window` — vitre (bloque ligne de vue selon flag)
- `wall_opaque` — mur opaque à la vue

**Table `voxel_textures.properties JSONB` (V2) :**
```json
{ "actionable": true, "blocks_los": false, "blocks_move": true }
```

**Nouvel event WS V2 :** `VOXEL_STATE_CHANGE` — `{ battlemapId, x, y, z, state: "open"|"closed" }`

**Rendu V2 :** un GLB différent selon `state` (porte ouverte / fermée).
En attendant V2, les portes sont des tokens (character avec GLB porte) — solution pragmatique V1.

---

## Pièges — liste complète mise à jour

**P_voxel_format_v2 — format voxel_data définitif après migration 30**
`{ "x:y:z": { "tex": N, "geo": "cube", "r": 0 } }` — jamais `{ id, r }` après migration 30.
`tex` = voxel_texture_id (integer). `geo` = string géométrie. `r` = rotation 0-3.

**P_geo_in_voxel — géométrie dans voxel_data, pas dans voxel_textures**
La géométrie d'un voxel posé est dans `voxel_data.geo`, pas dans `voxel_textures`.
`voxel_textures` ne contient que les faces — pas la forme.

**P_faces_order — ordre BoxGeometry Three.js**
`BoxGeometry` : index 0=east(+X), 1=west(-X), 2=top(+Y), 3=bottom(-Y), 4=south(+Z), 5=north(-Z).
`loadVoxelTextures` construit le tableau dans cet ordre exact.

**P_side_alias — 'side' est un alias lecture uniquement**
`faces.side` accepté à la lecture (seed V1, import ZIP legacy) → résolu en north/south/east/west.
Jamais écrire `side` dans un nouveau manifest ou insert direct.

**P_allowed_geo_null — null = toutes géométries autorisées**
`allowed_geometries: null` → aucune restriction. GM peut utiliser n'importe quelle géométrie.
`allowed_geometries: []` → aucune géométrie autorisée (équivalent deprecated).

**P_route_rename — /api/block-types remplacée par /api/voxel-textures**
`/api/block-types` n'existe plus après session 9A-4.
`/api/textures` reste le proxy MinIO fichiers PNG — pas de conflit.

**P_legacy_col_temp — legacy_block_type_id est temporaire**
Présente en migration 27, utilisée en 30, droppée en 31.
Ne jamais exposer cette colonne via l'API ni dans le client.

**P_migration_order_29_30 — 29 avant 30 obligatoire**
La migration 30 lit `legacy_block_type_id` pour construire le mapping.
Si 29 n'est pas passée, 30 convertit en données corrompues.

**P_drop_irrev_31 — migration 31 irréversible**
Drop de `block_types`, `battlemap_block_usage`, colonne `legacy_block_type_id`.
Valider la migration 30 en dev avant de lancer 31.

**P_activeMaterial_format — activeMaterial = { texId, geo, r }**
Plus `{ id, r }`. SessionPage stocke le nouveau format.
Editor3D et Sidebar reçoivent/modifient ce format.

**P_raccourcis_digit_code — e.code obligatoire pour les raccourcis clavier**
`e.key` dépend du layout (AZERTY : '&', 'é'...). `e.code` est invariant.
Digit1 → index 0 → 'cube', Digit2 → 'slab_bottom', etc.

**P_raycasting_bbox — inchangé**
Raycasting toujours sur `BoxGeometry(1,1,1)` invisible (`userData.isVoxel: true`).
Jamais sur la géométrie visuelle.

**P_voxel_texture_id_integer — integer, pas UUID**
Même exception que l'ancien `block_types.id`. Ne pas généraliser.

**P_save_fire_and_forget — save au démontage = fetch sans await**
`async` dans cleanup useEffect = Promise non attendue = requête non envoyée.
Utiliser `fetch(...)` direct sans `await` dans le cleanup.

**P12 — guard battlemapId dans VOXEL_ADD/VOXEL_UPDATE (inchangé)**
`if (!battlemapId) return` en tête des handlers socket.

**P17 — séparateur ":" voxel (inchangé)**
`getVoxelKey(x,y,z)` → `` `${x}:${y}:${z}` ``. Jamais ",".

**P_battlemap_texture_usage_recalc**
`PUT /battlemaps/:id/voxels` recalcule `battlemap_texture_usage` après chaque save.
Utilise `v.tex` (plus `v.id`). Guard `if (usedTexIds.length > 0)` avant INSERT.
