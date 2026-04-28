# MISSION — Chantier 9A addendum : Refonte modèle texture × géométrie
> Rédigé session 25 (planification) — complète MISSION_chantier_9.md
> Remplace les sessions 9A-4 et 9A-5 initialement prévues.
> Référence : PLAN_VOXELS.md version 2.
> Dépendance : sessions 9A-1, 9A-2, 9A-3 validées.

---

## Contexte

Le modèle `block_type = (texture, géométrie)` s'est révélé trop rigide.
Refonte : texture et géométrie sont orthogonales. Un voxel = `(tex, geo, r)`.
Deux sessions de code : DB+serveur d'abord, client ensuite.
Déploiement atomique obligatoire entre socket et client (P27).

---

## SESSION 9A-4 — DB + Serveur

**Prérequis :** Sessions 9A-1, 9A-2, 9A-3 validées.
**Durée estimée :** 1 session.
**Livrable :** serveur complet pour le nouveau modèle. Client non touché — zéro régression garantie.

### Fichiers à uploader avant de coder

- `server/src/db/migrations/24_seed_structure_station.js` — déjà lu, pour référence
- `server/src/routes/battlemaps.js` — relire PUT /voxels
- `server/src/socket/index.js` — relire VOXEL_ADD
- `server/src/index.js` — relire les montages

### Étape A — Migration 27 : table voxel_textures

**Fichier :** `server/src/db/migrations/27_voxel_textures.js`

```javascript
export const up = async (knex) => {
  await knex.schema.createTable('voxel_textures', (table) => {
    table.increments('id')
    table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
    table.uuid('category_id').references('id').inTable('texture_pack_categories').nullable()
    table.string('label').notNullable()
    table.jsonb('faces').notNullable()
    // { top?, bottom?, north?, south?, east?, west?, all? }
    // 'side' accepté en lecture uniquement (alias rétrocompat → north/south/east/west)
    table.jsonb('allowed_geometries').nullable()
    // null = toutes géométries autorisées
    // Array : ["cube","slab_bottom"] = restreint
    table.boolean('deprecated').defaultTo(false)
    table.integer('sort_order').defaultTo(0)
    table.integer('legacy_block_type_id').nullable()
    // Colonne temporaire — mapping block_types → voxel_textures pour migration 30
    // Droppée en migration 31
    table.timestamps(true, true)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('voxel_textures')
}
```

### Étape B — Migration 28 : table battlemap_texture_usage

**Fichier :** `server/src/db/migrations/28_battlemap_texture_usage.js`

```javascript
export const up = async (knex) => {
  await knex.schema.createTable('battlemap_texture_usage', (table) => {
    table.uuid('battlemap_id').references('id').inTable('battlemaps').notNullable()
    table.integer('voxel_texture_id').references('id').inTable('voxel_textures').notNullable()
    table.primary(['battlemap_id', 'voxel_texture_id'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('battlemap_texture_usage')
}
```

### Étape C — Migration 29 : seed voxel_textures depuis block_types

**Fichier :** `server/src/db/migrations/29_seed_voxel_textures.js`

Convertit les 78 blocs `block_types` structure-station vers `voxel_textures`.
Stocke `legacy_block_type_id` pour le mapping de la migration 30.
Conversion `side` → `bottom + north + south + east + west`.

```javascript
const PACK_UUID = 'b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e'

export const up = async (knex) => {
  const blocks = await knex('block_types')
    .where({ pack_id: PACK_UUID })
    .orderBy('sort_order')

  for (const block of blocks) {
    const rawFaces = block.textures  // { top?, side?, all? }
    const faces = {}

    if (rawFaces.top) faces.top = rawFaces.top
    if (rawFaces.all) faces.all = rawFaces.all
    if (rawFaces.side) {
      // 'side' = alias pour les 4 faces latérales + bottom par défaut
      faces.bottom = rawFaces.side
      faces.north  = rawFaces.side
      faces.south  = rawFaces.side
      faces.east   = rawFaces.side
      faces.west   = rawFaces.side
    }

    await knex('voxel_textures').insert({
      pack_id:              block.pack_id,
      category_id:          block.category_id,
      label:                block.label,
      faces:                JSON.stringify(faces),
      allowed_geometries:   null,
      deprecated:           false,
      sort_order:           block.sort_order,
      legacy_block_type_id: block.id,
    })
  }
}

export const down = async (knex) => {
  await knex('voxel_textures').where({ pack_id: PACK_UUID }).delete()
}
```

### Étape D — Migration 30 : conversion voxel_data { id, r } → { tex, geo, r }

**Fichier :** `server/src/db/migrations/30_voxel_data_refonte.js`
**IRRÉVERSIBLE sur les données.**

```javascript
export const up = async (knex) => {
  // 1. Construire le mapping legacy_block_type_id → voxel_texture_id
  const textures = await knex('voxel_textures')
    .whereNotNull('legacy_block_type_id')
    .select('id', 'legacy_block_type_id')

  const blockToTex = {}
  for (const t of textures) {
    blockToTex[t.legacy_block_type_id] = t.id
  }

  // 2. Lire geometry depuis block_types (encore présente à ce stade)
  const blockGeos = {}
  const blocks = await knex('block_types').select('id', 'geometry')
  for (const b of blocks) { blockGeos[b.id] = b.geometry }

  // 3. Convertir chaque battlemap
  const battlemaps = await knex('battlemaps')
    .whereNotNull('voxel_data')
    .select('id', 'voxel_data')

  for (const bm of battlemaps) {
    const data = bm.voxel_data
    if (!data || typeof data !== 'object') continue

    const migrated = {}
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'object' && val.id !== undefined) {
        const texId = blockToTex[val.id]
        const geo   = blockGeos[val.id] || 'cube'
        if (!texId) {
          console.warn(`[Migration 30] block_type_id ${val.id} sans voxel_texture — voxel ignoré`)
          continue
        }
        migrated[key] = { tex: texId, geo, r: val.r ?? 0 }
      } else {
        console.warn(`[Migration 30] format inattendu clé ${key}`, val)
      }
    }

    await knex('battlemaps')
      .where({ id: bm.id })
      .update({ voxel_data: JSON.stringify(migrated) })
  }
}

export const down = async (knex) => {
  console.warn('[Migration 30] down : non réversible, voxel_data conservé tel quel')
}
```

### Étape E — Migration 31 : drop block_types + nettoyage

**Fichier :** `server/src/db/migrations/31_drop_block_types.js`
**IRRÉVERSIBLE.**

```javascript
export const up = async (knex) => {
  // 1. Dropper legacy_block_type_id (colonne temporaire migration 29)
  await knex.schema.alterTable('voxel_textures', (table) => {
    table.dropColumn('legacy_block_type_id')
  })
  // 2. Dropper battlemap_block_usage (ancienne table)
  await knex.schema.dropTableIfExists('battlemap_block_usage')
  // 3. Dropper block_types (ancienne table — FK vers texture_packs/categories, pas vers voxel_data)
  await knex.schema.dropTableIfExists('block_types')
}

export const down = async (knex) => {
  console.warn('[Migration 31] down : non réversible')
}
```

### Étape F — Route /api/voxel-textures

**Fichier nouveau :** `server/src/routes/voxel-textures.js`

Remplace `block-types.js` — même logique, table et champs mis à jour.
Voir spec complète dans PLAN_VOXELS.md section "Route serveur".

**Points clés :**
- Route : `GET /api/voxel-textures` (sans `?ids`) — tous les non-deprecated, ordonnés par catégorie + sort_order
- Route : `GET /api/voxel-textures?ids=1,3,7` — par IDs (Canvas3D au chargement)
- JOIN `texture_packs` pour `pack_name` + `tile_size`
- LEFT JOIN `texture_pack_categories` pour `category_label` + `category_sort_order`
- Retourne `{ textures: [...] }`

### Étape G — Mettre à jour server/src/index.js

```javascript
// Supprimer
import blockTypesRouter from './routes/block-types.js'
app.use('/api/block-types', blockTypesRouter)

// Ajouter
import voxelTexturesRouter from './routes/voxel-textures.js'
app.use('/api/voxel-textures', voxelTexturesRouter)
```

### Étape H — Mettre à jour socket/index.js : VOXEL_ADD

Deux changements dans le handler VOXEL_ADD :

```javascript
// Avant
socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, id, r }) => {
  // ...
  const next = { ...voxels, [key]: { id, r } }
  io.to(...).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, id, r })

// Après
socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, tex, geo, r }) => {
  // ...
  const next = { ...voxels, [key]: { tex, geo, r } }
  io.to(...).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, tex, geo, r })
```

### Étape I — Mettre à jour battlemaps.js : PUT /voxels

Recalcul `battlemap_texture_usage` au lieu de `battlemap_block_usage` :

```javascript
// Avant
const usedIds = [...new Set(Object.values(voxel_data).map(v => v.id))]
await db('battlemap_block_usage').where({ battlemap_id: id }).delete()
if (usedIds.length > 0) {
  await db('battlemap_block_usage').insert(
    usedIds.map(blockId => ({ battlemap_id: id, block_type_id: blockId }))
  )
}

// Après
const usedTexIds = [...new Set(Object.values(voxel_data).map(v => v.tex))]
await db('battlemap_texture_usage').where({ battlemap_id: id }).delete()
if (usedTexIds.length > 0) {
  await db('battlemap_texture_usage').insert(
    usedTexIds.map(texId => ({ battlemap_id: id, voxel_texture_id: texId }))
  )
}
```

### Critères de validation 9A-4

- [ ] `knex migrate:latest` sans erreur — 31 migrations appliquées
- [ ] Table `voxel_textures` créée avec 78 entrées (structure-station)
- [ ] Table `battlemap_texture_usage` créée
- [ ] `voxel_data` converti : format `{ tex, geo, r }` vérifié en base
- [ ] Tables `block_types` + `battlemap_block_usage` supprimées
- [ ] `GET /api/voxel-textures` → 78 textures, faces + pack_name + category_label corrects
- [ ] `GET /api/voxel-textures?ids=1,3` → 2 textures exactes
- [ ] SR sans erreur — aucune régression routes existantes (tokens, sessions, etc.)
- [ ] `GET /api/battlemaps/:id` toujours fonctionnel (tokens non touchés)

---

## SESSION 9A-5 — Client

**Prérequis :** Session 9A-4 validée.
**Durée estimée :** 1 session dense.
**Livrable :** éditeur voxel complet avec nouveau modèle. Canvas3D non régressé.

⚠️ **Règle de cette session :** socket (VOXEL_ADD payload) et client (Canvas3D + Editor3D)
sont déployés dans la même session. Atomique — jamais l'un sans l'autre.

### Fichiers à uploader avant de coder

- `client/src/lib/voxelTextures.js` — état après 9A-3
- `client/src/components/Voxel.jsx` — état après 9A-3
- `client/src/components/Canvas3D.jsx` — état après 9A-3
- `client/src/components/Editor3D.jsx` — état après 9A-3
- `client/src/components/Sidebar.jsx` — état après 9A-3
- `client/src/pages/SessionPage.jsx` — état après 9A-3

### Étape J — voxelTextures.js : loadVoxelTextures

Remplace `loadBlockTextures`. Même cache module-level `textureCache`.

Différences clés :
- Paramètre : `textures[]` (depuis `/api/voxel-textures`) au lieu de `blocks[]`
- Résolution alias `side` → north/south/east/west/bottom
- Ordre faces : east, west, top, bottom, south, north (BoxGeometry Three.js)
- Retourne `{ [texId]: { faceMaterials } }` — pas de `geometry` dans les matériaux

Voir spec complète dans PLAN_VOXELS.md section "Chargement client".

### Étape K — Voxel.jsx : props mises à jour

```javascript
// Avant
function Voxel({ position, blockData, rotation })
// blockData = { geometry, faceMaterials }

// Après
function Voxel({ position, textureMaterials, geometry, rotation })
// textureMaterials = { faceMaterials }
// geometry = string depuis voxel_data.geo
```

`geometry` vient maintenant de `voxel_data` directement, pas des matériaux.

### Étape L — Canvas3D.jsx : mise à jour

**Initialisation voxels :**
```javascript
// Avant
map[key] = { x, y, z, id: val.id, r: val.r }
// Après
map[key] = { x, y, z, tex: val.tex, geo: val.geo, r: val.r }
```

**Chargement textures :**
```javascript
// Avant
const blockIds = [...new Set(Object.values(battlemap.voxel_data).map(v => v.id))]
const { data } = await api.get(`/block-types?ids=${blockIds.join(',')}`)
const loaded = await loadBlockTextures(data.blocks)

// Après
const texIds = [...new Set(Object.values(battlemap.voxel_data).map(v => v.tex))]
if (texIds.length === 0) { setBlocksReady(true); return }  // garde P26
const { data } = await api.get(`/voxel-textures?ids=${texIds.join(',')}`)
const loaded = await loadVoxelTextures(data.textures)
```

**Rendu voxels :**
```javascript
// Avant
<Voxel position={[v.x, v.y, v.z]} blockData={blockMaterials[v.id]} rotation={v.r} />

// Après
<Voxel position={[v.x, v.y, v.z]}
  textureMaterials={textureMaterials[v.tex]}
  geometry={v.geo}
  rotation={v.r} />
```

**Handlers WS voxels :**
```javascript
// handleVoxelAdded
const handleVoxelAdded = ({ x, y, z, tex, geo, r }) => {
  const key = getVoxelKey(x, y, z)
  setVoxels(prev => ({ ...prev, [key]: { x, y, z, tex, geo, r } }))
}

// handleVoxelUpdated — inchangé (modifie r uniquement)

// handleVoxelRemoved — inchangé
```

**État renommé :**
```javascript
// Avant
const [blockMaterials, setBlockMaterials] = useState({})
// Après
const [textureMaterials, setTextureMaterials] = useState({})
```

### Étape M — Editor3D.jsx : mise à jour

**activeMaterial nouveau format :**
```javascript
// Avant : { id, r }
// Après : { texId, geo, r }
```

**Initialisation voxels :**
```javascript
map[key] = { x, y, z, tex: val.tex, geo: val.geo, r: val.r }
```

**Chargement — tous les blocs pour la palette :**
```javascript
const { data } = await api.get('/voxel-textures')
onBlocksLoaded?.(data.textures)
const loaded = await loadVoxelTextures(data.textures)
setTextureMaterials(loaded)
```

**Pose (handleMouseDown clic gauche) :**
```javascript
const { texId, geo, r } = activeMaterial
setVoxels(prev => ({ ...prev, [key]: { x, y, z, tex: texId, geo, r } }))
socket?.emit(WS.VOXEL_ADD, { battlemapId, x, y, z, tex: texId, geo, r })
```

**Raccourcis Digit1-5 :**
```javascript
const GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']

// Dans handleKeyDown (EditorScene) :
if (e.code >= 'Digit1' && e.code <= 'Digit5') {
  const idx = parseInt(e.code.replace('Digit', '')) - 1
  const geo = GEOMETRIES[idx]
  // Guard allowed_geometries
  if (activeMaterial) {
    const texDef = availableTextures.find(t => t.id === activeMaterial.texId)
    const allowed = texDef?.allowed_geometries
    if (allowed !== null && allowed !== undefined && !allowed.includes(geo)) return
    onActiveMaterialChange(prev => prev ? { ...prev, geo } : prev)
  }
}
```

**save() payload :**
```javascript
// Avant
payload[key] = { id: v.id, r: v.r }
// Après
payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
```

**Ghost voxel :**
Ghost affiche la géométrie `activeMaterial.geo` et la rotation `activeMaterial.r`.
GhostVoxel reçoit `geometry` en prop (pas de changement de rendu — cube pour l'instant).

**Rotation en place (touche R sur voxel existant) :**
```javascript
// VOXEL_UPDATE — inchangé : { battlemapId, x, y, z, r: newR }
// setVoxels — inchangé : modifie r uniquement
```

**Undo/redo — Commands mises à jour :**
```javascript
class PlaceVoxelCommand {
  constructor(key, x, y, z, tex, geo, r, previous) { ... }
  execute(setVoxels) {
    setVoxels(prev => ({ ...prev, [key]: { x,y,z,tex,geo,r } }))
  }
  undo(setVoxels) { /* restaure previous ou delete */ }
}
```

### Étape N — Sidebar.jsx : palette textures

**Props inchangées côté SessionPage** (même nommage `activeMaterial`, `onMaterialChange`, `availableBlocks`).

**Comportement palette :**
- Affiche les `voxel_textures` groupées par catégorie (depuis `availableBlocks` = `data.textures`)
- Aperçu : texture `faces.top` (ou `faces.all`) — chemin MinIO via `/api/textures/pack_name/...`
- Clic texture → `onMaterialChange({ texId: tex.id, geo: 'cube', r: 0 })`
  - `geo` = 'cube' par défaut, l'utilisateur change ensuite avec Digit1-5
- Afficher la géométrie active : `GeometryIcon` dans le header de la palette (indicateur de l'état courant)
- `deprecated: true` → masqué

**Plus d'icône géométrie par bouton** — la géométrie n'est plus liée à la texture.

### Étape O — SessionPage.jsx : activeMaterial format

```javascript
// Avant
const [activeMaterial, setActiveMaterial] = useState(null)  // { id, r }

// Après — format inchangé dans SessionPage, shape différente
const [activeMaterial, setActiveMaterial] = useState(null)  // { texId, geo, r }
```

Aucun autre changement dans SessionPage — le format est opaque pour SessionPage.

### Critères de validation 9A-5

- [ ] SR sans erreur
- [ ] Canvas3D — voxels existants (migrés) affichés avec textures correctes
- [ ] Canvas3D — carte sans voxels — Scene montée, tokens visibles (garde P26)
- [ ] Canvas3D — tokens non régressés (drag, sélection, suppression)
- [ ] Editor3D — ghost voxel visible sous le curseur
- [ ] Editor3D — clic gauche → voxel posé + VOXEL_ADD `{ tex, geo, r }` broadcasté
- [ ] Editor3D — Canvas3D reçoit VOXEL_ADDED et affiche le nouveau voxel
- [ ] Editor3D — clic droit → voxel supprimé + VOXEL_REMOVE broadcasté
- [ ] Editor3D — Digit1-5 → géométrie du ghost change visuellement
- [ ] Editor3D — `R` → ghost tourne / `R` sur bloc → VOXEL_UPDATE broadcasté
- [ ] Editor3D — save au démontage fonctionne (payload `{ tex, geo, r }`)
- [ ] Editor3D — auto-save 60s si dirty
- [ ] Sidebar — palette affiche les 78 textures structure-station groupées
- [ ] Sidebar — clic texture → ghost apparaît avec cette texture

---

## Pièges spécifiques à cette session

**Atomique socket + client :** VOXEL_ADD payload change (`id,r` → `tex,geo,r`).
Socket (9A-4) et Canvas3D/Editor3D (9A-5) doivent être déployés ensemble.
Ne jamais laisser une version intermédiaire où socket envoie `{ tex, geo, r }` et Canvas3D attend `{ id, r }`.

**Ordre des faces BoxGeometry :** east, west, top, bottom, south, north.
Ne pas confondre avec l'ancien ordre side, side, top, top, side, side.

**Guard allowed_geometries null :** `null` = toutes autorisées.
Vérifier `allowed !== null && allowed !== undefined` avant le check `.includes()`.
