# MISSION — Chantier 9A + 9B : Refonte voxel + Système de packs de textures
> Rédigé session 22 — 2026-04-08
> Document autonome — peut être lu sans autre contexte.
> Référence de conception : `docs/PLAN_VOXELS.md`
> Mémoire d'analyse : `ANALYSE_9AB.md` (fournir en début de session 9A/9B)
> Dépendance : Chantiers 1→8 terminés et validés (session 20 stable).

---

## Vue d'ensemble

Ce chantier est découpé en **4 sessions de code** (9A-1 à 9A-4) + **1 session 9B**.
Chaque session a un livrable stable identifié — ne jamais passer à la suivante
sans validation fonctionnelle complète de la précédente.

### Règle fondamentale de ce chantier

Le nouveau format voxel `{ "x:y:z": { "id": N, "r": 0 } }` remplace l'ancien
`{ "x:y:z": entier }`. Ce changement touche la base, le serveur, le client,
les WS et le format de sauvegarde. **Serveur et client doivent être mis à jour
dans la même session de code** — jamais l'un sans l'autre.

### Nouveaux pièges permanents (à ajouter dans SYSTEME.md après validation)

**P_voxel_format** — format voxel_data après migration 25
`{ "x:y:z": { "id": N, "r": 0 } }` — jamais un entier nu.
`id` = block_type_id global (integer auto-incrémenté).
`r` = rotation : 0/1/2/3 (quarts de tour axe Y).

**P_block_id_integer** — block_types.id est un integer, pas un UUID
Exception justifiée et documentée. Ne pas généraliser aux autres tables.
Stocké dans JSONB — jamais utilisé comme FK typée dans Knex.

**P_voxel_save_payload** — save() payload après refonte (remplace P16)
`payload[key] = { id: v.id, r: v.r }` — jamais `v.mat`, jamais l'objet entier.

**P_blocksReady_gate** — gate de rendu Canvas3D après refonte
`blocksReady` remplace `packsLoaded`. True même si 0 blocs (carte vide).
Guard obligatoire : `if (blockIds.length === 0) { setBlocksReady(true); return }`.

**P_raycasting_bbox** — raycasting toujours sur bounding box cubique
La géométrie custom (slope, wedge) est uniquement visuelle.
Le raycasting ignore la géométrie réelle — toujours BoxGeometry invisible.

---

## SESSION 9A-1 — Migrations + routes serveur

**Prérequis :** aucun.
**Durée estimée :** 1 session.
**Livrable :** serveur complet pour 9A. Client non touché — zéro régression garantie.

### Fichiers à uploader avant de coder

- `server/src/db/migrations/` — lister les migrations existantes (confirmer qu'on est à 20)
- `server/src/routes/battlemaps.js` — déjà lu session 22, re-lire si modifié
- `server/src/index.js` — vérifier les montages existants

### Étape 1 — Migration 21 : table `texture_packs`

**Fichier :** `server/src/db/migrations/21_texture_packs.cjs`

```javascript
exports.up = async (knex) => {
  await knex.schema.createTable('texture_packs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.string('name').notNullable().unique()   // ex: "hard-sf"
    table.string('label').notNullable()           // ex: "Hard SF"
    table.text('description').nullable()
    table.integer('tile_size').defaultTo(128)
    table.uuid('created_by').references('id').inTable('users').nullable()
    table.timestamps(true, true)
  })
}
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('texture_packs')
}
```

### Étape 2 — Migration 22 : lock éditeur sur battlemaps

**Fichier :** `server/src/db/migrations/22_battlemaps_editor_lock.cjs`

```javascript
exports.up = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.uuid('editor_locked_by').references('id').inTable('users').nullable()
    table.timestamp('editor_locked_until').nullable()
  })
}
exports.down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('editor_locked_by')
    table.dropColumn('editor_locked_until')
  })
}
```

### Étape 3 — Migration 23 : texture_pack_categories + block_types

**Fichier :** `server/src/db/migrations/23_block_types.cjs`
**ORDRE OBLIGATOIRE dans exports.up :** `texture_pack_categories` AVANT `block_types` (FK).

```javascript
exports.up = async (knex) => {
  // 1. texture_pack_categories — AVANT block_types (FK)
  await knex.schema.createTable('texture_pack_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
    table.string('label').notNullable()
    table.integer('sort_order').defaultTo(0)
  })

  // 2. block_types — APRÈS texture_pack_categories
  await knex.schema.createTable('block_types', (table) => {
    table.increments('id')   // INTEGER auto — exception justifiée, jamais FK typée
    table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
    table.string('label').notNullable()
    table.string('geometry').notNullable()  // cube/slab_bottom/slab_top/slope/wedge
    table.jsonb('textures').notNullable()   // { all, top, bottom, side }
    table.boolean('deprecated').defaultTo(false)
    table.integer('sort_order').defaultTo(0)
    table.uuid('category_id').references('id').inTable('texture_pack_categories').nullable()
    table.timestamps(true, true)
  })
}
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('block_types')
  await knex.schema.dropTableIfExists('texture_pack_categories')
}
```

### Étape 4 — Migration 24 : seed pack hard-sf

**Fichier :** `server/src/db/migrations/24_seed_hard_sf.cjs`

Le pack hard-sf remplace le manifest MinIO actuel (contenu de test jetable).
UUID du pack hardcodé pour être stable entre environnements.
Les blocs sont tous `geometry: 'cube'` en V1 — pas de slopes/wedges dans le seed initial.
Le seed définit les catégories puis les blocs dans l'ordre — les IDs auto-incrémentés
partiront de 1.

Structure à respecter :
- Catégories : `floor`, `hazard`, `surface`, `wall`, `window`, `block`, `panel`, `furniture`
- Blocs : un bloc par matériau existant dans le nouveau manifest propre
- `textures` : `{ "top": "chemin/top.png", "side": "chemin/side.png" }` ou `{ "all": "chemin/all.png" }`

**Piège migration 24 :** Les chemins dans `textures` sont relatifs au pack dans MinIO.
`"floor/metal_grid.png"` → MinIO = `textures/hard-sf/floor/metal_grid.png`.
Jamais de chemin absolu en base.

```javascript
const PACK_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'  // fixe

exports.up = async (knex) => {
  // Insérer le pack
  await knex('texture_packs').insert({
    id: PACK_UUID,
    name: 'hard-sf',
    label: 'Hard SF',
    description: 'Pack science-fiction industriel',
    tile_size: 128,
  })

  // Insérer les catégories — récupérer leurs UUIDs pour les blocs
  const catIds = {}
  const categories = [
    { label: 'Sol', sort_order: 0 },
    { label: 'Danger', sort_order: 1 },
    { label: 'Surface', sort_order: 2 },
    { label: 'Mur', sort_order: 3 },
    { label: 'Fenêtre', sort_order: 4 },
    { label: 'Bloc', sort_order: 5 },
    { label: 'Panneau', sort_order: 6 },
    { label: 'Mobilier', sort_order: 7 },
  ]
  for (const cat of categories) {
    const [inserted] = await knex('texture_pack_categories')
      .insert({ pack_id: PACK_UUID, ...cat })
      .returning('id')
    catIds[cat.label] = inserted.id
  }

  // Insérer les blocs — IDs auto-incrémentés depuis 1
  // ⚠️ À COMPLÉTER avec le nouveau manifest propre au moment du codage
  // Structure de référence :
  await knex('block_types').insert([
    // Exemple — remplacer par le vrai contenu du nouveau manifest
    { pack_id: PACK_UUID, label: 'Sol métal grille', geometry: 'cube',
      textures: JSON.stringify({ all: 'floor/floor_metal_grid_rusty_a.png' }),
      category_id: catIds['Sol'], sort_order: 0 },
    // ... autres blocs
  ])
}
exports.down = async (knex) => {
  await knex('block_types').where({ pack_id: PACK_UUID }).delete()
  await knex('texture_pack_categories').where({ pack_id: PACK_UUID }).delete()
  await knex('texture_packs').where({ id: PACK_UUID }).delete()
}
```

**Note importante :** Le contenu exact du seed (liste des blocs) dépend du nouveau
manifest hard-sf propre à définir avant cette session. Ce document fournit la
structure — le contenu réel est à compléter au moment du codage.

### Étape 5 — Migration 25 : conversion one-shot voxel_data

**Fichier :** `server/src/db/migrations/25_voxel_data_format.cjs`
**IRRÉVERSIBLE sur les données.** Les données de test existantes sont jetables — OK.

```javascript
exports.up = async (knex) => {
  const battlemaps = await knex('battlemaps')
    .whereNotNull('voxel_data')
    .select('id', 'voxel_data')

  for (const bm of battlemaps) {
    const data = bm.voxel_data
    if (!data || typeof data !== 'object') continue

    const migrated = {}
    for (const [key, val] of Object.entries(data)) {
      // Entier nu → { id, r: 0 } | Déjà objet → passthrough
      migrated[key] = typeof val === 'number' ? { id: val, r: 0 } : val
    }

    await knex('battlemaps')
      .where({ id: bm.id })
      .update({ voxel_data: JSON.stringify(migrated) })
  }
}
exports.down = async (knex) => {
  // Non réversible — down est un no-op documenté
  console.warn('Migration 25 down : non réversible, voxel_data conservé tel quel')
}
```

### Étape 6 — Migration 26 : table battlemap_block_usage

**Fichier :** `server/src/db/migrations/26_battlemap_block_usage.cjs`

```javascript
exports.up = async (knex) => {
  await knex.schema.createTable('battlemap_block_usage', (table) => {
    table.uuid('battlemap_id').references('id').inTable('battlemaps').notNullable()
    table.integer('block_type_id').references('id').inTable('block_types').notNullable()
    table.primary(['battlemap_id', 'block_type_id'])
  })
}
exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('battlemap_block_usage')
}
```

**Validation migrations :**
```
node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs
```
Vérifier en base : 6 nouvelles tables/colonnes présentes. SR sans erreur.

---

### Étape 7 — Route GET /api/block-types

**Fichier nouveau :** `server/src/routes/block-types.js`

```javascript
import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/block-types — tous les blocs non deprecated
// GET /api/block-types?ids=1,3,7 — blocs par IDs (Canvas3D au chargement)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    let query = db('block_types')
      .join('texture_packs', 'block_types.pack_id', 'texture_packs.id')
      .select(
        'block_types.id',
        'block_types.pack_id',
        'block_types.label',
        'block_types.geometry',
        'block_types.textures',
        'block_types.deprecated',
        'block_types.sort_order',
        'block_types.category_id',
        'texture_packs.name as pack_name',
        'texture_packs.tile_size',
      )

    if (req.query.ids) {
      // Mode Canvas3D — IDs spécifiques uniquement
      const ids = req.query.ids.split(',').map(Number).filter(Boolean)
      query = query.whereIn('block_types.id', ids)
    } else {
      // Mode palette — tous les blocs non deprecated
      query = query.where({ 'block_types.deprecated': false })
        .orderBy(['block_types.pack_id', 'block_types.sort_order'])
    }

    const blocks = await query
    res.json({ blocks })
  } catch (err) {
    next(err)
  }
})

export default router
```

### Étape 8 — Route GET /api/texture-packs (lecture seule pour 9A)

**Fichier nouveau :** `server/src/routes/texture-packs.js`

```javascript
import { Router } from 'express'
import db from '../db/knex.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/texture-packs — liste des packs avec nombre de blocs
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const packs = await db('texture_packs')
      .leftJoin('block_types', 'texture_packs.id', 'block_types.pack_id')
      .select(
        'texture_packs.id',
        'texture_packs.name',
        'texture_packs.label',
        'texture_packs.description',
        'texture_packs.tile_size',
        db.raw('count(block_types.id) as block_count'),
      )
      .groupBy('texture_packs.id')
      .orderBy('texture_packs.created_at', 'asc')

    res.json({ packs })
  } catch (err) {
    next(err)
  }
})

// GET /api/texture-packs/:id — détail pack + blocs + catégories
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const pack = await db('texture_packs').where({ id: req.params.id }).first()
    if (!pack) return res.status(404).json({ error: 'Pack not found' })

    const categories = await db('texture_pack_categories')
      .where({ pack_id: req.params.id })
      .orderBy('sort_order')

    const blocks = await db('block_types')
      .where({ pack_id: req.params.id, deprecated: false })
      .orderBy('sort_order')

    res.json({ pack, categories, blocks })
  } catch (err) {
    next(err)
  }
})

export default router
```

### Étape 9 — Montage dans server/src/index.js

Ajouter après les imports existants et avant `app.listen` :
```javascript
import blockTypesRouter from './routes/block-types.js'
import texturePacksRouter from './routes/texture-packs.js'
```

Ajouter dans le bloc des montages :
```javascript
app.use('/api/block-types', blockTypesRouter)
app.use('/api/texture-packs', texturePacksRouter)
```

### Étape 10 — Modifier PUT /battlemaps/:id/voxels

**Fichier :** `server/src/routes/battlemaps.js`
**Après** le `UPDATE voxel_data`, ajouter le recalcul `battlemap_block_usage` :

```javascript
// Recalcul battlemap_block_usage — index des blocs utilisés
const usedIds = [...new Set(Object.values(voxel_data).map(v => v.id))]
await db('battlemap_block_usage')
  .where({ battlemap_id: req.params.id })
  .delete()
if (usedIds.length > 0) {
  await db('battlemap_block_usage').insert(
    usedIds.map(blockId => ({
      battlemap_id: req.params.id,
      block_type_id: blockId,
    }))
  )
}
```

### Étape 11 — Routes lock/heartbeat éditeur dans battlemaps.js

Ajouter avant `export default router` :

```javascript
// POST /api/battlemaps/:id/editor-lock — acquérir le lock éditeur
router.post('/:id/editor-lock', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    const member = await db('campaign_members')
      .where({ campaign_id: battlemap.campaign_id, user_id: req.user.id, role: 'gm' })
      .first()
    if (!member) throw new AppError(403, 'GM only')

    // Vérifier si le lock est actif par quelqu'un d'autre
    const isLocked = battlemap.editor_locked_by
      && battlemap.editor_locked_by !== req.user.id
      && battlemap.editor_locked_until > new Date()
    if (isLocked) {
      return res.status(423).json({ lockedBy: battlemap.editor_locked_by })
    }

    const lockedUntil = new Date(Date.now() + 60 * 1000)
    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_by: req.user.id,
      editor_locked_until: lockedUntil,
    })
    res.json({ ok: true, lockedUntil })
  } catch (err) { next(err) }
})

// DELETE /api/battlemaps/:id/editor-lock — libérer le lock
router.delete('/:id/editor-lock', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    // Seul le titulaire du lock peut le libérer
    if (battlemap.editor_locked_by !== req.user.id) {
      throw new AppError(403, 'Not lock owner')
    }

    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_by: null,
      editor_locked_until: null,
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// POST /api/battlemaps/:id/editor-heartbeat — renouveler le lock (toutes les 30s)
router.post('/:id/editor-heartbeat', requireAuth, async (req, res, next) => {
  try {
    const battlemap = await db('battlemaps').where({ id: req.params.id }).first()
    if (!battlemap) throw new AppError(404, 'Battlemap not found')

    // Seul le titulaire peut renouveler
    if (battlemap.editor_locked_by !== req.user.id) {
      throw new AppError(403, 'Not lock owner')
    }

    const lockedUntil = new Date(Date.now() + 60 * 1000)
    await db('battlemaps').where({ id: req.params.id }).update({
      editor_locked_until: lockedUntil,
    })
    res.json({ ok: true, lockedUntil })
  } catch (err) { next(err) }
})
```

### Critères de validation 9A-1

- [ ] `knex migrate:latest` sans erreur — 26 migrations appliquées
- [ ] Tables `texture_packs`, `texture_pack_categories`, `block_types`, `battlemap_block_usage` créées
- [ ] Colonnes `editor_locked_by` + `editor_locked_until` présentes sur `battlemaps`
- [ ] `GET /api/block-types` retourne les blocs du seed hard-sf
- [ ] `GET /api/block-types?ids=1,3` retourne exactement 2 blocs
- [ ] `GET /api/texture-packs` retourne le pack hard-sf avec `block_count`
- [ ] `POST /api/battlemaps/:id/editor-lock` retourne 200 ou 423
- [ ] SR sans erreur — aucune régression routes existantes
- [ ] `GET /api/battlemaps/:id` toujours fonctionnel (tokens non touchés)

---

## SESSION 9A-2 — WS + Canvas3D refonte

**Prérequis :** Session 9A-1 validée.
**Durée estimée :** 1 session (dense — prévoir de la marge).
**Livrable :** voxels affichés avec nouveau format, tokens non régressés,
pose/suppression temps réel fonctionnels.

### ⚠️ Règle de cette session

Serveur (socket) et client (Canvas3D) sont modifiés ensemble.
Le payload VOXEL_ADD change — les deux doivent être cohérents à la fin de la session.
Ne pas livrer une version intermédiaire où l'un est mis à jour sans l'autre.

### Fichiers à uploader avant de coder

- `shared/events.js` — confirmer l'état actuel
- `server/src/socket/index.js` — relire avant toute modification
- `client/src/components/Canvas3D.jsx` — relire avant toute modification

### Étape 12 — shared/events.js : +2 constantes voxel

Ajouter dans le bloc voxels, après `VOXEL_REMOVED` :
```javascript
VOXEL_UPDATE:  'voxel:update',
VOXEL_UPDATED: 'voxel:updated',
```

### Étape 13 — socket/index.js : modifier VOXEL_ADD

**Localisation :** lignes 136–165 (vérifier au moment du codage).

Deux lignes changent :
```javascript
// Ligne ~154 — avant
const next = { ...voxels, [key]: mat }
// après
const next = { ...voxels, [key]: { id, r } }

// Ligne ~161 — avant
io.to(socket.campaignId).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, mat })
// après
io.to(socket.campaignId).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, id, r })
```

Le destructuring du payload reçu change aussi :
```javascript
// avant
socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, mat }) => {
// après
socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, id, r }) => {
```

### Étape 14 — socket/index.js : ajouter handler VOXEL_UPDATE

Insérer après le handler VOXEL_REMOVE, avant MAP_SWITCH.
Spec complète issue de PLAN_VOXELS — copier exactement :

```javascript
// ─── VOXEL:UPDATE ─────────────────────────────────────────────────────────
// Le GM tourne un voxel déjà posé (touche R sur un bloc existant)
// Payload : { battlemapId, x, y, z, r }
socket.on(WS.VOXEL_UPDATE, async ({ battlemapId, x, y, z, r }) => {
  try {
    if (socket.role !== 'gm') {
      socket.emit('error', { message: 'GM only' })
      return
    }
    if (!battlemapId) return  // Guard identique VOXEL_ADD

    const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
    if (!battlemap) return

    const voxels = battlemap.voxel_data || {}
    const key = `${x}:${y}:${z}`

    // Guard race condition — voxel supprimé entre émission et réception
    if (!voxels[key]) return

    const next = { ...voxels, [key]: { ...voxels[key], r } }

    await db('battlemaps')
      .where({ id: battlemapId })
      .update({ voxel_data: JSON.stringify(next) })

    io.to(socket.campaignId).emit(WS.VOXEL_UPDATED, { battlemapId, x, y, z, r })
  } catch (err) {
    console.error('[WS] voxel:update error:', err.message)
  }
})
```

### Étape 15 — Canvas3D.jsx : nouvelle fonction loadBlockTextures

Remplace `loadPackTextures` (lignes 41–67). Supprimer l'ancienne entièrement.

```javascript
// Charge les textures pour un tableau d'IDs de blocs
// Retourne blockMaterials : { [blockId]: { geometry, faceMaterials: THREE.Material[] } }
async function loadBlockTextures(blocks) {
  const loader = new THREE.TextureLoader()
  const blockMaterials = {}

  for (const block of blocks) {
    const textures = block.textures  // { all?, top?, bottom?, side? }
    const packName = block.pack_name

    const loadTex = (path) => {
      if (!path) return Promise.resolve(null)
      const url = `${import.meta.env.VITE_API_URL}/api/textures/${packName}/${path}`
      if (textureCache[url]) return Promise.resolve(textureCache[url])
      return new Promise((resolve) => {
        loader.load(url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.magFilter = THREE.NearestFilter
          tex.minFilter = THREE.NearestFilter
          textureCache[url] = tex
          resolve(tex)
        }, undefined, () => {
          console.warn(`[Canvas3D] Texture manquante : ${url}`)
          resolve(null)
        })
      })
    }

    // Priorité : face spécifique > all > magenta
    const makeMat = (tex) => tex
      ? new THREE.MeshLambertMaterial({ map: tex })
      : new THREE.MeshBasicMaterial({ color: 0xFF00FF })  // magenta = texture manquante

    const topTex  = await loadTex(textures.top  || textures.all || null)
    const botTex  = await loadTex(textures.bottom || textures.all || null)
    const sideTex = await loadTex(textures.side  || textures.all || null)

    // BoxGeometry : right, left, top, bottom, front, back
    blockMaterials[block.id] = {
      geometry: block.geometry,
      faceMaterials: [
        makeMat(sideTex), makeMat(sideTex),
        makeMat(topTex),  makeMat(botTex),
        makeMat(sideTex), makeMat(sideTex),
      ],
    }
  }

  return blockMaterials
}
```

### Étape 16 — Canvas3D.jsx : composant Voxel réécrit

Remplace le composant `Voxel` (lignes 70–79). Supprimer l'ancien.

```javascript
// Composant Voxel — dispatch géométrie selon block.geometry
// blockData : { geometry, faceMaterials }
// rotation : 0/1/2/3 (quarts de tour axe Y)
function Voxel({ position, blockData, rotation }) {
  if (!blockData) return null  // bloc inconnu — silencieux

  const [px, py, pz] = position
  const rot = (rotation || 0) * (Math.PI / 2)

  // Toutes les géométries sont centrées à +0.5 (convention existante)
  const pos = [px + 0.5, py + 0.5, pz + 0.5]

  const { geometry, faceMaterials } = blockData

  // Géométries custom — slope et wedge
  // ⚠️ Le raycasting se fait sur une BoxGeometry invisible — voir P_raycasting_bbox
  const renderGeometry = () => {
    switch (geometry) {
      case 'slab_bottom':
        return <boxGeometry args={[1, 0.5, 1]} />
      case 'slab_top':
        return <boxGeometry args={[1, 0.5, 1]} />
      case 'slope':
        // Prisme 5 faces — géométrie custom (voir PLAN_VOXELS pour les vertices)
        // À implémenter avec BufferGeometry en session 9A-2
        return <boxGeometry args={[1, 1, 1]} />  // placeholder
      case 'wedge':
        return <boxGeometry args={[1, 1, 1]} />  // placeholder
      default:
        return <boxGeometry args={[1, 1, 1]} />  // cube
    }
  }

  const yOffset = geometry === 'slab_bottom' ? -0.25
    : geometry === 'slab_top' ? 0.25
    : 0

  return (
    <mesh
      position={[pos[0], pos[1] + yOffset, pos[2]]}
      rotation={[0, rot, 0]}
      userData={{ isVoxel: true, position }}
    >
      {renderGeometry()}
      {faceMaterials.map((mat, i) =>
        <meshLambertMaterial key={i} attach={`material-${i}`} {...mat} />
      )}
      {/* Bounding box invisible pour raycasting uniforme — P_raycasting_bbox */}
      <mesh visible={false} userData={{ isVoxel: true, position }}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </mesh>
  )
}
```

**Note :** La géométrie slope/wedge (BufferGeometry custom) est un placeholder
en session 9A-2. Le rendu visuel correct est affiné en session 9A-3.

### Étape 17 — Canvas3D.jsx : états et chargement

**Modifier les états (lignes ~573–575) :**
```javascript
// Avant
const [materials, setMaterials] = useState({})
const [packsLoaded, setPacksLoaded] = useState(false)

// Après
const [blockMaterials, setBlockMaterials] = useState({})  // { [blockId]: { geometry, faceMaterials } }
const [blocksReady, setBlocksReady] = useState(false)
```

**Remplacer l'initialisation voxel_data (lignes ~582–590) :**
```javascript
useEffect(() => {
  if (!battlemap?.voxel_data) return
  const map = {}
  for (const [key, val] of Object.entries(battlemap.voxel_data)) {
    const [x, y, z] = key.split(':').map(Number)
    // val = { id, r } après migration 25
    map[key] = { x, y, z, id: val.id, r: val.r }
  }
  setVoxels(map)
}, [battlemap?.id])
```

**Remplacer le chargement pack (lignes ~592–601) :**
```javascript
useEffect(() => {
  const loadBlocks = async () => {
    setBlocksReady(false)
    if (!battlemap?.voxel_data) { setBlocksReady(true); return }

    const blockIds = [...new Set(Object.values(battlemap.voxel_data).map(v => v.id))]

    // Guard — carte sans voxels
    if (blockIds.length === 0) { setBlocksReady(true); return }

    try {
      const { data } = await api.get(`/block-types?ids=${blockIds.join(',')}`)
      const loaded = await loadBlockTextures(data.blocks)
      setBlockMaterials(loaded)
    } catch (err) {
      console.error('[Canvas3D] Erreur chargement block_types :', err)
    } finally {
      setBlocksReady(true)
    }
  }
  loadBlocks()
}, [battlemap?.id])  // rechargement au changement de carte
```

**Supprimer** : `onPackLoaded` prop et son appel. `handleDirty` et `save()` — voir étape suivante.

### Étape 18 — Canvas3D.jsx : modifier save()

```javascript
// Avant
payload[key] = v.mat
// Après — P_voxel_save_payload
payload[key] = { id: v.id, r: v.r }
```

### Étape 19 — Canvas3D.jsx : mise à jour rendu voxels

Dans `Scene`, remplacer le rendu voxels (lignes ~527–534) :
```jsx
// Avant
{Object.values(voxels).map(v => (
  <Voxel key={getVoxelKey(v.x, v.y, v.z)}
    position={[v.x, v.y, v.z]}
    materialId={v.mat}
    materials={materials} />
))}

// Après
{Object.values(voxels).map(v => (
  <Voxel key={getVoxelKey(v.x, v.y, v.z)}
    position={[v.x, v.y, v.z]}
    blockData={blockMaterials[v.id]}
    rotation={v.r} />
))}
```

Mettre à jour les props passées à `Scene` depuis `Canvas3D` :
```jsx
// Supprimer : materials={materials}, activeMaterial={activeMaterial}
// Ajouter : blockMaterials={blockMaterials}
```

### Étape 20 — Canvas3D.jsx : mettre à jour les handlers WS voxel

Dans `Scene`, handler `handleVoxelAdded` :
```javascript
// Avant
const handleVoxelAdded = ({ x, y, z, mat }) => {
  setVoxels(prev => ({ ...prev, [key]: { x, y, z, mat } }))
}

// Après
const handleVoxelAdded = ({ x, y, z, id, r }) => {
  const key = getVoxelKey(x, y, z)
  setVoxels(prev => ({ ...prev, [key]: { x, y, z, id, r } }))
}
```

Ajouter handler `VOXEL_UPDATED` (nouveau) :
```javascript
const handleVoxelUpdated = ({ battlemapId, x, y, z, r }) => {
  if (battlemapId !== currentBattlemapId) return
  const key = getVoxelKey(x, y, z)
  setVoxels(prev => {
    if (!prev[key]) return prev
    return { ...prev, [key]: { ...prev[key], r } }
  })
}
socket.on(WS.VOXEL_UPDATED, handleVoxelUpdated)
// + cleanup dans le return du useEffect
```

### Étape 21 — Canvas3D.jsx : supprimer handleClick et logique edit

Supprimer entièrement (déménage dans Editor3D) :
- `handleClick` (lignes 424–478)
- `socket?.emit(WS.VOXEL_ADD, ...)` et `socket?.emit(WS.VOXEL_REMOVE, ...)`
- `onDirty` prop et son usage
- `save()` function et ses deux useEffect déclencheurs (auto-save + toggle mode)
- `isDirty` ref et `saveTimer` ref
- `prevMode` ref et son useEffect

**Ce qui reste dans Canvas3D :** lecture seule voxels + tokens + WS listeners.

### Étape 22 — Canvas3D.jsx : props après refonte

```javascript
// Avant
export default function Canvas3D({ mode, activeMaterial, onPackLoaded, onTokenDoubleClick, socket })

// Après
export default function Canvas3D({ onTokenDoubleClick, socket })
```

Le gate de rendu :
```jsx
// Avant
{packsLoaded && <Scene ... />}

// Après
{blocksReady && <Scene ... />}
```

### Critères de validation 9A-2

- [ ] `GET /api/battlemaps/:id` — tokens toujours affichés (zéro régression)
- [ ] Voxels existants (migrés) affichés avec les textures correctes
- [ ] Carte sans voxels — Scene montée, tokens visibles
- [ ] VOXEL_ADD reçu avec `{ id, r }` — voxel apparaît en temps réel
- [ ] VOXEL_REMOVE — voxel disparaît en temps réel (inchangé)
- [ ] save() — payload `{ id, r }` confirmé dans les requêtes réseau
- [ ] SR sans erreur

---

## SESSION 9A-3 — SessionPage toggle + Editor3D squelette + édition

**Prérequis :** Session 9A-2 validée.
**Durée estimée :** 1 session (la plus longue).
**Livrable :** mode édition fonctionnel — pose, suppression, rotation, ghost voxel.

### Fichiers à uploader avant de coder

- `client/src/pages/SessionPage.jsx` — relire avant toute modification
- `client/src/components/Canvas3D.jsx` — relire (état après 9A-2)
- `client/src/components/Sidebar.jsx` — relire pour intégrer la palette

### Étape 23 — SessionPage.jsx : nettoyage + toggle

**Supprimer :**
```javascript
const [activeMaterial, setActiveMaterial] = useState(1)      // ligne 41
const [availableMaterials, setAvailableMaterials] = useState([])  // ligne 42
```

**Modifier props Canvas3D :**
```jsx
// Avant
<Canvas3D mode={mode} activeMaterial={activeMaterial}
  onPackLoaded={setAvailableMaterials} onTokenDoubleClick={...} socket={...} />

// Après
<Canvas3D onTokenDoubleClick={handleTokenDoubleClick} socket={socket} />
```

**Ajouter import Editor3D :**
```javascript
import Editor3D from '../components/Editor3D'
```

**Remplacer Canvas3D par toggle conditionnel :**
```jsx
// Avant
<Canvas3D onTokenDoubleClick={handleTokenDoubleClick} socket={socket} />

// Après
{mode === 'edit'
  ? <Editor3D socket={socket} />
  : <Canvas3D onTokenDoubleClick={handleTokenDoubleClick} socket={socket} />
}
```

**Modifier props Sidebar — supprimer les 3 props matériaux :**
```jsx
// Supprimer ces 3 props :
activeMaterial={activeMaterial}
onMaterialChange={setActiveMaterial}
availableMaterials={availableMaterials}
```

### Étape 24 — GeometryIcon.jsx : nouveau composant

**Fichier nouveau :** `client/src/components/GeometryIcon.jsx`

5 icônes SVG inline (vue isométrique schématique), 14×14px, `currentColor`.
```jsx
export default function GeometryIcon({ geometry, size = 14, style }) {
  const s = size
  const icons = {
    cube: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        {/* Cube isométrique schématique — trait sur fond transparent */}
        <path d="M7 1L13 4.5V10.5L7 14L1 10.5V4.5L7 1Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M7 1V14M1 4.5L13 4.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
    slab_bottom: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M7 8L13 11V14L7 14L1 14V11L7 8Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M1 11L13 11" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
    slab_top: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M7 1L13 4.5V7L7 7L1 7V4.5L7 1Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M1 4.5L13 4.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
    slope: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M1 14L13 4.5V14L1 14Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M1 14L13 4.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
    wedge: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M1 14L7 1L13 14L1 14Z"
          stroke="currentColor" strokeWidth="1.2" fill="none"/>
      </svg>
    ),
  }
  return icons[geometry] ?? null
}
```

### Étape 25 — Editor3D.jsx : squelette R3F + raycasting + ghost voxel

**Fichier nouveau :** `client/src/components/Editor3D.jsx`

Architecture globale :
```javascript
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import * as THREE from 'three'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { useMapStore } from '../stores/mapStore'
import { useCharacterStore } from '../stores/characterStore'

// ─── Constantes — identiques à Canvas3D ──────────────────────────────────────
const VOXEL_SIZE = 1
const GRID_SIZE = 50

// ─── Ghost voxel — preview avant pose ────────────────────────────────────────
// Mesh semi-transparent sous le curseur, géométrie et rotation du bloc actif.
function GhostVoxel({ position, blockData, rotation, visible }) { ... }

// ─── Scène éditeur ────────────────────────────────────────────────────────────
function EditorScene({ voxels, setVoxels, blockMaterials, activeMaterial,
  socket, battlemapId, onExecute }) { ... }

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Editor3D({ socket }) {
  const { battlemap } = useMapStore()
  const { isGm } = useCharacterStore()

  const [voxels, setVoxels] = useState({})
  const [blockMaterials, setBlockMaterials] = useState({})
  const [blocksReady, setBlocksReady] = useState(false)
  const [activeMaterial, setActiveMaterial] = useState(null)  // { id, r }
  const [availableBlocks, setAvailableBlocks] = useState([])

  const isDirty = useRef(false)
  const saveTimer = useRef(null)
  const history = useRef([])    // tableau de Commands
  const cursor = useRef(-1)     // index courant dans history

  // Chargement identique à Canvas3D — blocs par IDs présents dans voxel_data
  // + chargement de TOUS les blocs pour la palette (disponibleBlocks)
  useEffect(() => { /* ... */ }, [battlemap?.id])

  const save = useCallback(async (currentVoxels) => {
    if (!isDirty.current || !battlemap?.id) return
    const payload = {}
    for (const [key, v] of Object.entries(currentVoxels)) {
      payload[key] = { id: v.id, r: v.r }  // P_voxel_save_payload
    }
    await api.put(`/battlemaps/${battlemap.id}/voxels`, { voxel_data: payload })
    isDirty.current = false
  }, [battlemap?.id])

  // ... lock, heartbeat, undo/redo — étape 9A-4

  return (
    <Canvas camera={{ position: [15, 15, 15], fov: 60 }} style={{ background: '#0f172a' }}>
      {blocksReady && (
        <EditorScene
          voxels={voxels} setVoxels={setVoxels}
          blockMaterials={blockMaterials}
          activeMaterial={activeMaterial}
          socket={socket}
          battlemapId={battlemap?.id}
          onExecute={(cmd) => { /* Command Pattern — étape 9A-4 */ }}
        />
      )}
    </Canvas>
  )
}
```

**Raycasting dans EditorScene :**
```javascript
// Raycasting — TOUJOURS sur bounding box cubique (P_raycasting_bbox)
// La géométrie custom (slope, wedge) ne participe pas au raycasting.
// Chaque voxel a un mesh BoxGeometry invisible avec userData.isVoxel = true.

const handlePointerMove = useCallback((e) => {
  // Calculer position ghost — raycaster sur les bbox isVoxel ou le sol
  const rect = gl.domElement.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )
  raycaster.setFromCamera(mouse, camera)
  // ... calculer ghostPos
}, [camera, gl])
```

**Ghost voxel :**
Semi-transparent (opacity 0.5), même géométrie que le bloc actif, suit le curseur.
Si `activeMaterial` null (aucun bloc sélectionné) → ghost non affiché.

### Étape 26 — Editor3D : pose, suppression, rotation

**Pose (clic gauche) :**
```javascript
if (e.button === 0 && activeMaterial) {
  const { id, r } = activeMaterial
  const key = getVoxelKey(x, y, z)
  const cmd = new PlaceVoxelCommand(key, x, y, z, id, r,
    voxels[key] || null)  // null = nouvelle pose
  onExecute(cmd)
  socket?.emit(WS.VOXEL_ADD, { battlemapId, x, y, z, id, r })
}
```

**Suppression (clic droit) :**
```javascript
if (e.button === 2) {
  // Raycaster sur les bbox isVoxel
  const cmd = new RemoveVoxelCommand(key, voxels[key])
  onExecute(cmd)
  socket?.emit(WS.VOXEL_REMOVE, { battlemapId, x, y, z })
}
```

**Rotation R :**
```javascript
const handleKeyDown = (e) => {
  if (e.key !== 'r' && e.key !== 'R') return
  if (blocSousCurseur) {
    // Rotation en place d'un bloc existant
    const newR = (voxels[key].r + 1) % 4
    const cmd = new RotateVoxelCommand(key, newR, voxels[key].r)
    onExecute(cmd)
    socket?.emit(WS.VOXEL_UPDATE, { battlemapId, x, y, z, r: newR })
  } else {
    // Rotation du ghost (activeMaterial)
    setActiveMaterial(prev => ({ ...prev, r: (prev.r + 1) % 4 }))
  }
}
```

**Raccourcis 1-9, 0 :**
```javascript
if (e.key >= '1' && e.key <= '9') {
  const idx = parseInt(e.key) - 1
  if (availableBlocks[idx]) setActiveMaterial({ id: availableBlocks[idx].id, r: 0 })
}
if (e.key === '0' && availableBlocks[9]) {
  setActiveMaterial({ id: availableBlocks[9].id, r: 0 })
}
```

### Étape 27 — Sidebar.jsx : palette en mode édition

En mode `edit`, afficher uniquement la palette de blocs.
La palette est rendue si `mode === 'edit'` — les onglets habituels sont masqués.

```jsx
// Dans Sidebar — avant le rendu des onglets habituels
if (mode === 'edit') {
  return (
    <div style={styles.container}>
      {/* Header Sidebar inchangé */}
      <BlockPalette
        blocks={availableBlocks}
        activeMaterial={activeMaterial}
        onSelect={(block) => onMaterialChange({ id: block.id, r: 0 })}
      />
    </div>
  )
}
```

`BlockPalette` est un sous-composant interne à Sidebar :
- Liste scrollable des blocs, groupés par catégorie
- Aperçu : texture `top` (ou `all`) en fond, icône géométrie en bas à gauche via `GeometryIcon`
- Sélection active = bordure colorée
- Bloc `deprecated: true` masqué

**Piège Sidebar :** `availableBlocks` et `activeMaterial` / `onMaterialChange` viennent
maintenant d'Editor3D via SessionPage. SessionPage doit passer ces props à Sidebar
**uniquement** en mode `edit`. En mode `play`, ces props sont absentes/null.

### Critères de validation 9A-3

- [ ] Toggle `mode === 'edit'` → Editor3D monté, Canvas3D démonté
- [ ] Toggle retour → Canvas3D remonté, tokens toujours affichés
- [ ] Ghost voxel visible sous le curseur en mode édition
- [ ] Clic gauche → voxel posé, broadcast VOXEL_ADD reçu par Canvas3D
- [ ] Clic droit → voxel supprimé, broadcast VOXEL_REMOVE reçu
- [ ] `R` → ghost tourne visuellement
- [ ] `R` sur bloc existant → rotation broadcastée via VOXEL_UPDATE
- [ ] Raccourcis 1–9 sélectionnent les blocs de la palette
- [ ] Palette Sidebar affiche les blocs avec aperçu texture + icône géométrie

---

## SESSION 9A-4 — Undo/redo + lock + Sidebar palette complète

**Prérequis :** Session 9A-3 validée.
**Durée estimée :** 1 session.
**Livrable :** Chantier 9A complet — tous les critères de validation cochés.

### Fichiers à uploader avant de coder

- `client/src/components/Editor3D.jsx` — état après 9A-3

### Étape 28 — Command Pattern undo/redo

```javascript
// ─── Commands ────────────────────────────────────────────────────────────────
class PlaceVoxelCommand {
  constructor(key, x, y, z, id, r, previous) {
    this.key = key; this.x = x; this.y = y; this.z = z
    this.id = id; this.r = r; this.previous = previous
  }
  execute(setVoxels) {
    setVoxels(prev => ({ ...prev, [this.key]: { x:this.x, y:this.y, z:this.z, id:this.id, r:this.r } }))
  }
  undo(setVoxels) {
    if (this.previous) {
      setVoxels(prev => ({ ...prev, [this.key]: this.previous }))
    } else {
      setVoxels(prev => { const next = {...prev}; delete next[this.key]; return next })
    }
  }
}

class RemoveVoxelCommand {
  constructor(key, previous) { this.key = key; this.previous = previous }
  execute(setVoxels) {
    setVoxels(prev => { const next = {...prev}; delete next[this.key]; return next })
  }
  undo(setVoxels) {
    setVoxels(prev => ({ ...prev, [this.key]: this.previous }))
  }
}

class RotateVoxelCommand {
  constructor(key, newR, oldR) { this.key = key; this.newR = newR; this.oldR = oldR }
  execute(setVoxels) {
    setVoxels(prev => ({ ...prev, [this.key]: { ...prev[this.key], r: this.newR } }))
  }
  undo(setVoxels) {
    setVoxels(prev => ({ ...prev, [this.key]: { ...prev[this.key], r: this.oldR } }))
  }
}
```

**Gestion historique dans Editor3D :**
```javascript
const onExecute = useCallback((cmd) => {
  cmd.execute(setVoxels)
  isDirty.current = true
  // Tronquer l'historique au cursor courant (écrase les redo futurs)
  history.current = history.current.slice(0, cursor.current + 1)
  history.current.push(cmd)
  // Plafonner à 50
  if (history.current.length > 50) history.current.shift()
  cursor.current = history.current.length - 1
}, [])

useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'z') {
      if (cursor.current < 0) return
      history.current[cursor.current].undo(setVoxels)
      isDirty.current = true
      cursor.current--
    }
    if (e.ctrlKey && e.key === 'y') {
      if (cursor.current >= history.current.length - 1) return
      cursor.current++
      history.current[cursor.current].execute(setVoxels)
      isDirty.current = true
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [])
```

### Étape 29 — Save auto + save au démontage

```javascript
// Auto-save toutes les 60s si dirty
useEffect(() => {
  saveTimer.current = setInterval(() => {
    if (isDirty.current) save(voxels)
  }, 60000)
  return () => clearInterval(saveTimer.current)
}, [save, voxels])

// Save au démontage (toggle retour mode jeu ou navigation)
useEffect(() => {
  return () => {
    if (isDirty.current) save(voxels)
  }
}, [save, voxels])
```

### Étape 30 — Lock éditeur + heartbeat

```javascript
// Acquisition du lock au montage
useEffect(() => {
  if (!battlemap?.id || !isGm) return

  const acquireLock = async () => {
    try {
      await api.post(`/battlemaps/${battlemap.id}/editor-lock`)
    } catch (err) {
      if (err.response?.status === 423) {
        // Un autre GM est en édition — bloquer l'accès
        console.warn('[Editor3D] Battlemap locked by another GM')
        // TODO : afficher un message à l'utilisateur + basculer en mode play
      }
    }
  }
  acquireLock()

  // Heartbeat toutes les 30s — renouvelle le lock (expiration 60s)
  const heartbeat = setInterval(async () => {
    try {
      await api.post(`/battlemaps/${battlemap.id}/editor-heartbeat`)
    } catch (err) {
      console.error('[Editor3D] Heartbeat failed :', err.message)
    }
  }, 30000)

  // Libération du lock au démontage
  return () => {
    clearInterval(heartbeat)
    api.delete(`/battlemaps/${battlemap.id}/editor-lock`).catch(() => {})
  }
}, [battlemap?.id, isGm])
```

### Critères de validation 9A (complets)

- [ ] Voxels existants migrés et affichés correctement (IDs globaux)
- [ ] Cube, slab_bottom, slab_top rendus correctement
- [ ] Slope et wedge rendus (visuellement correct ou placeholder — à noter)
- [ ] Rotation r:0/1/2/3 appliquée visuellement
- [ ] Ghost voxel visible avant pose, géométrie et rotation correctes
- [ ] `R` rotate le ghost avant pose
- [ ] `R` sur bloc posé → rotation broadcastée via VOXEL_UPDATE
- [ ] Undo Ctrl+Z fonctionnel (50 actions)
- [ ] Redo Ctrl+Y fonctionnel
- [ ] Save auto 60s si dirty
- [ ] Save au toggle retour jeu
- [ ] Lock : un seul GM en édition à la fois
- [ ] Heartbeat renouvelle le lock toutes les 30s
- [ ] Lock libéré au démontage d'Editor3D
- [ ] Palette blocs catégorisée, aperçu texture + icône géométrie
- [ ] Raccourcis 1-9,0 fonctionnels
- [ ] Canvas3D (session de jeu) non régressé — tokens, voxels, drag
- [ ] SR sans erreur

---

## SESSION 9B — Interface texture packs

**Prérequis :** Chantier 9A terminé et validé.
**Durée estimée :** 2 sessions (selon complexité ZIP).
**Livrable :** CRUD packs, import/export ZIP, page Dashboard `/texture-packs`.

### Vue d'ensemble 9B

9B ajoute le CRUD complet des texture_packs et block_types, et l'interface
utilisateur pour les gérer. C'est une surface nouvelle — pas de modification
de code existant stable.

### Fichiers à uploader avant de coder 9B

- `client/src/App.jsx` — ajouter route `/texture-packs`
- `client/src/pages/DashboardPage.jsx` — ajouter lien vers `/texture-packs`
- `server/src/routes/texture-packs.js` — état après 9A
- `server/src/routes/block-types.js` — état après 9A

### Routes serveur à ajouter (extension de 9A)

**texture-packs.js :**
```
POST   /api/texture-packs              — créer un pack (GM)
PUT    /api/texture-packs/:id          — modifier métadonnées
DELETE /api/texture-packs/:id          — 409 si blocs utilisés
GET    /api/texture-packs/:id/export   — ZIP (manifest + textures)
POST   /api/texture-packs/import       — importer ZIP (remapping localId)
```

**block-types.js :**
```
POST   /api/block-types                — créer bloc (upload texture + définition)
PUT    /api/block-types/:id            — modifier (deprecated, label, textures)
DELETE /api/block-types/:id            — 409 si ID dans un voxel_data
```

### DELETE /api/texture-packs/:id — logique 409

```javascript
// Vérifier si des blocs de ce pack sont utilisés dans des battlemaps
const usedBlocks = await db('battlemap_block_usage')
  .join('block_types', 'battlemap_block_usage.block_type_id', 'block_types.id')
  .where({ 'block_types.pack_id': req.params.id })
  .select('battlemap_block_usage.battlemap_id', 'block_types.id as block_id')

if (usedBlocks.length > 0) {
  return res.status(409).json({
    error: 'Pack utilisé dans des battlemaps',
    battlemapIds: [...new Set(usedBlocks.map(u => u.battlemap_id))],
  })
}
```

### DELETE /api/block-types/:id — logique 409

```javascript
const usages = await db('battlemap_block_usage').where({ block_type_id: req.params.id })
if (usages.length > 0) {
  return res.status(409).json({
    error: 'Bloc utilisé dans des battlemaps',
    battlemapIds: usages.map(u => u.battlemap_id),
  })
}
```

### Import ZIP — points critiques

**Path traversal — NON NÉGOCIABLE :**
```javascript
const safePath = path.resolve(destDir, filePath)
if (!safePath.startsWith(destDir)) throw new Error('Path traversal detected')
```

**Remapping localId → ID global :**
```javascript
// localId = ID dans le manifest ZIP (1, 2, 3...)
// ID global = auto-incrémenté lors de l'INSERT en base
// Jamais stocker le localId en base
const idMapping = {}
for (const block of manifest.blocks) {
  const [inserted] = await db('block_types').insert({...}).returning('id')
  idMapping[block.localId] = inserted.id
}
```

**Validation textures à l'upload :**
- Format : PNG ou JPG uniquement
- Dimensions : multiples de `pack.tile_size` (ex: 128×128, 256×256)
- Plafond : rejeter si total block_types > 9999 après import

**Ordre d'écriture : MinIO AVANT base**
```
1. Écrire textures dans MinIO
2. INSERT texture_packs en base
3. INSERT block_types en base
Si étape 3 échoue → fichiers orphelins dans MinIO (inoffensifs, jamais servis)
Si étape 1 échoue → rien en base, état propre
```

### Page Dashboard /texture-packs

- Accessible uniquement si GM dans au moins une campagne
- Liste des packs : nom, description, tile_size, block_count, auteur
- Bouton "Créer un pack" → formulaire (name, label, tile_size)
- Par pack : bouton "Exporter ZIP" + bouton "Importer ZIP"
- Éditeur de pack : upload textures, définir blocs (geometry + textures + label + catégorie)
- Aperçu bloc : texture top/all + GeometryIcon en bas à gauche
- Route dans App.jsx : `/texture-packs`
- Lien dans DashboardPage : visible uniquement si GM dans une campagne

### Critères de validation 9B

- [ ] CRUD packs fonctionnel (create, read, update, delete avec 409)
- [ ] CRUD block_types fonctionnel (create avec upload texture, update, delete avec 409)
- [ ] Upload texture validé (format + dimensions multiples de tile_size)
- [ ] Export ZIP téléchargeable
- [ ] Import ZIP — blocs créés avec IDs globaux, remapping localId correct
- [ ] Import ZIP — path traversal bloqué (test avec `../../../etc/passwd`)
- [ ] Import ZIP — plafond 9999 blocs vérifié
- [ ] Page `/texture-packs` accessible GM uniquement
- [ ] Pack importé utilisable immédiatement dans l'éditeur
- [ ] SR sans erreur

---

## Pièges globaux de ce chantier

**Ne jamais** utiliser `v.mat` après la migration 25 — c'est `v.id`.
**Ne jamais** stocker un entier nu dans `voxel_data` après la migration 25.
**Ne jamais** faire le raycasting sur la géométrie custom — toujours sur la bbox invisible.
**Ne jamais** supprimer un bloc utilisé dans un voxel_data — `deprecated: true` à la place.
**Ne jamais** généraliser `increments()` à d'autres tables — block_types est l'unique exception.
**Ne jamais** lancer la migration 25 sans que la migration 24 soit passée (IDs inexistants).
**Ne jamais** déployer VOXEL_ADD socket sans mettre à jour Canvas3D handleVoxelAdded dans la même session.
**Toujours** `texture_pack_categories` avant `block_types` dans la migration 23 (FK).
**Toujours** MinIO avant base pour les textures (ordre d'écriture).
**Toujours** `{ id: v.id, r: v.r }` dans le payload save() — jamais l'objet mémoire entier.
