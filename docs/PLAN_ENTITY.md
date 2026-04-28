# PLAN_ENTITY.md — Domaine Entités interactables
> Remplace `Entité.md` — renommé pour cohérence avec PLAN_WORKSHOP.md
> Dernière mise à jour : 2026-04-29
> Chantiers 9C ✅ / 9D ✅ / 9E ✅ — Chantiers 9F-A/B/C 🔲 en planification
> Pour l'historique des décisions : voir JOURNAL.md sessions 33-35.

---

## Sommaire

1. [Vocabulaire et positionnement](#1-vocabulaire-et-positionnement)
2. [Modèle de données — état stable](#2-modèle-de-données--état-stable)
3. [Système états et interactions — état stable](#3-système-états-et-interactions--état-stable)
4. [Rendu Three.js — état stable](#4-rendu-threejs--état-stable)
5. [Flux réseau — protocole d'interaction joueur](#5-flux-réseau--protocole-dinteraction-joueur)
6. [Chantier 9F-0 — Module polaris.js — Calcul serveur (PRÉREQUIS)](#6-chantier-9f-0--module-polarisjs--calcul-serveur-prérequis-9f-b)
7. [Chantier 9F-A — Fondations mouvement](#7-chantier-9f-a--fondations-mouvement)
8. [Chantier 9F-B — Interaction déplacement entité (orthogonal)](#8-chantier-9f-b--interaction-déplacement-entité-orthogonal)
9. [Chantier 9F-C — Diagonal + animation Lerp](#9-chantier-9f-c--diagonal--animation-lerp)
10. [Carte de collision Redis](#10-carte-de-collision-redis)
11. [Table des marges de réussite Polaris](#11-table-des-marges-de-réussite-polaris)
12. [Pièges — référence complète](#12-pièges--référence-complète)
13. [Hors scope](#13-hors-scope)

---

## 1. Vocabulaire et positionnement

| Terme | Définition |
|---|---|
| **Character** | Personnage joueur = illustration + fiche de stats + token 3D |
| **Token** | Représentation 3D du character sur la battlemap — se déplace, a une orientation |
| **Voxel** | Élément de décor statique = géométrie + texture(s). Aucun comportement |
| **Entité** | Élément interactif = géométrie + texture(s) + comportement (états, interactions) |
| **Blueprint** | Préfabriqué d'entité — configuré dans l'Atelier, posé en instance sur la carte |
| **Instance** | Entité posée sur une battlemap — paramètres indépendants du blueprint |
| **Acteur** | Token 3D du character joueur qui déclenche une interaction |
| **MR** | Marge de Réussite = `attributeTotal + 1d20 - DC` |

### Règle fondamentale Blueprint / Instance

Une modification de blueprint **ne se répercute pas** sur les instances déjà posées.
À partir du moment où une entité est posée, elle est unique.

### Layers visuels

Entités : layer voxel (entre décor et tokens). Séparation logique uniquement — table `entities` distincte de `voxel_data`.

### Découvrabilité — touche Alt

`Alt` maintenu → liseré cyan (`#00ffff`, `scale * 1.05`, `THREE.BackSide`) sur toutes les entités.
Implémenté ✅ — `e.code === 'AltLeft' || 'AltRight'` (PE16).

---

## 2. Modèle de données — état stable

### Table `entity_blueprints`

```sql
id              UUID     PK DEFAULT gen_random_uuid()
created_by      UUID     FK → users.id
pack_id         UUID     FK → texture_packs.id NULL   -- migration 43
label           TEXT     NOT NULL
glb_url         TEXT     NULL
geometry        JSONB    NOT NULL DEFAULT '{}'
states          JSONB    NOT NULL DEFAULT '[]'
interactions    JSONB    NOT NULL DEFAULT '[]'
deprecated      BOOLEAN  NOT NULL DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Table `entities`

```sql
id                    UUID     PK DEFAULT gen_random_uuid()
battlemap_id          UUID     FK → battlemaps.id ON DELETE CASCADE
blueprint_id          UUID     FK → entity_blueprints.id
pos_x                 INT      NOT NULL
pos_y                 INT      NOT NULL   -- profondeur (axe Z Three.js) — PE14
pos_z                 INT      NOT NULL   -- altitude  (axe Y Three.js) — PE14
r                     INT      NOT NULL DEFAULT 0
current_state_id      INT      NOT NULL DEFAULT 0
gm_only               BOOLEAN  NOT NULL DEFAULT false
label_override        TEXT     NULL
interaction_overrides JSONB    NOT NULL DEFAULT '{}'
disabled_interactions TEXT[]   NOT NULL DEFAULT '{}'
state                 JSONB    NOT NULL DEFAULT '{}'
notes_gm              TEXT     NULL
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

### Table `tokens` — état actuel

```sql
id                UUID     PK
battlemap_id      UUID     FK → battlemaps.id CASCADE
character_id      UUID     FK → characters.id SET NULL
label             TEXT
image_url         TEXT
pos_x             FLOAT
pos_y             FLOAT    -- profondeur (axe Z Three.js) — PE14
pos_z             FLOAT    -- altitude  (axe Y Three.js) — PE14
layer             TEXT
cover_percent     INT
notes             TEXT
gm_notes          TEXT
visible_to_players BOOLEAN
```

**⚠ Colonne `r` absente** — à ajouter en migration 9F-A (voir §6).

### Coordonnées — convention NON NÉGOCIABLE (PE14)

```
pos_x = axe X Three.js
pos_y = profondeur (axe Z Three.js) — NON l'altitude
pos_z = altitude   (axe Y Three.js) — NON la profondeur
```

Jamais inline — toujours via `threeToDb()`.

---

## 3. Système états et interactions — état stable

### Champ `states` (JSONB)

```json
[
  {
    "id": 0,
    "name": "Fermé",
    "is_blocking": true,
    "is_transparent": false,
    "visual_override": {
      "opacity": 1.0,
      "face_overrides": {}
    }
  },
  {
    "id": 1,
    "name": "Ouvert",
    "is_blocking": false,
    "is_transparent": true,
    "visual_override": {
      "opacity": 0.0,
      "face_overrides": {}
    }
  }
]
```

### Champ `interactions` (JSONB) — étendu 9F-B

```json
[
  {
    "id": "ouvrir",
    "action_label": "Ouvrir",
    "required_state_ids": [0],
    "target_state_id": 1,
    "skill_id": "CROCHETAGE",
    "difficulty_dc": 15,
    "range": 1.5
  },
  {
    "id": "pousser",
    "action_label": "Pousser",
    "required_state_ids": [0, 1],
    "target_state_id": null,
    "attribute_id": "FOR",
    "difficulty_dc": 12,
    "range": 1.5,
    "move_type": "push",
    "pull_dmax_override": null
  }
]
```

**Champs ajoutés pour les interactions de déplacement (9F-B) :**

| Champ | Type | Description |
|---|---|---|
| `attribute_id` | TEXT \| null | `'FOR'` — référence `char_attributes.attr_id`. Prioritaire sur `skill_id` si présent |
| `target_state_id` | INT \| null | `null` = interaction de déplacement (pas de changement d'état) |
| `move_type` | TEXT \| null | `'push'` \| `'pull'` \| null (null = interaction d'état classique) |
| `pull_dmax_override` | INT \| null | Si défini, force Dmax à cette valeur (ex: `1` pour Pull limité) |

**Règle de résolution du test :**
- Si `attribute_id` présent → jet d'attribut : `na(attribute_id) + 1d20 vs difficulty_dc`
- Si `skill_id` présent → jet de compétence : `skillTotal + 1d20 vs difficulty_dc`
- Si ni l'un ni l'autre → succès automatique sans jet

### Résolution des overrides par instance

```js
const blueprintInteraction = blueprint.interactions.find(i => i.id === interactionId)
const override = entity.interaction_overrides[interactionId] ?? {}
const resolved = { ...blueprintInteraction, ...override }
// resolved.difficulty_dc et resolved.attribute_id/skill_id sont les valeurs effectives
```

---

## 4. Rendu Three.js — état stable

### EntityMesh.jsx — comportement actuel ✅

- `EntityMeshVoxel` : BoxGeometry(width, height, depth), 6 matériaux par face
- `EntityMeshGlb` : useGLTF + SkeletonUtils.clone()
- `HoverIcon` : **toujours monté** (PE20) — visibilité CSS (`visibility`, `opacity`, `pointerEvents`)
- Hitbox : `BoxGeometry(width*1.4, height+0.8, depth*1.4)` décalée `+0.4` en Y
- `transparent={true}` obligatoire sur `meshLambertMaterial` (PE19)
- Timer 600ms sur `onPointerLeave`

### Format faces — chemins PNG (PEF1-PEF6)

```json
{
  "width": 1, "height": 2, "depth": 1,
  "faces": {
    "east": "uuid1.png", "west": "uuid1.png",
    "top": "uuid2.png", "bottom": null,
    "south": "uuid1.png", "north": "uuid1.png"
  }
}
```

- Chemins PNG relatifs au pack — `pack_id` obligatoire (PEF1)
- `null` = face invisible (PE4)
- Jamais d'integers `voxel_texture_id`

### Rotation tokens (9F-A)

```js
rotation.y = r * Math.PI / 4   // 8 orientations, incréments 45°
// r = 0 → 0°, r = 1 → 45°, ..., r = 7 → 315°
```

---

## 5. Flux réseau — protocole d'interaction joueur

### Flux état (implémenté ✅ session 35)

```
Joueur clique ⚙ → RadialMenu → handleEntityAction
  → si isGm : socket.emit(ENTITY_ACTION_GM_DIRECT) → resolveEntityState → ENTITY_UPDATED
  → si joueur : socket.emit(ENTITY_ACTION_REQUEST) → ENTITY_ACTION_PENDING (chat GM)
    → GM Accepter/Refuser → ENTITY_ACTION_RESOLVE → resolveEntityState → ENTITY_UPDATED
```

### Flux déplacement (9F-B — à implémenter)

```
Joueur clique ⚙ → RadialMenu
  → vérif distance token ↔ entité < interaction.range
  → si ok : tranche "Déplacement" active → clic
  → curseur devient ghost entité (mode visée)
  → joueur déplace souris → ghost snapé sur 4 axes orthogonaux (9F-B) ou 8 axes (9F-C)
  → clic destination → client détermine Push/Pull par vecteur
  → client émet ENTITY_MOVE_REQUEST { entityId, interactionId, attributeTotal, destinationX, destinationZ }
  → serveur valide, calcule MR, détermine Dmax, exécute steps
  → serveur émet ENTITY_MOVED + TOKEN_MOVED (positions finales)
  → client anime Lerp 300ms (9F-C)
```

### Nouvel event WS — 9F-B

```js
// À ajouter dans shared/events.js
ENTITY_MOVE_REQUEST: 'entity:move_request',  // joueur → serveur
ENTITY_MOVE_RESULT:  'entity:move_result',   // serveur → joueur (résultat jet + positions)
```

`ENTITY_MOVED` et `TOKEN_MOVED` existants sont réutilisés pour le broadcast positions.

---

## 6. Chantier 9F-0 — Module `polaris.js` — Calcul serveur (PRÉREQUIS 9F-B)

### Contexte et décision

PE1 ("skillTotal calculé client — jamais recalculé serveur") était une rustine d'architecture posée
en session 9C pour avancer vite. Elle crée une faille : un joueur peut envoyer `skillTotal: 999`
sans détection. Le serveur doit être source de vérité pour toutes les valeurs mécaniques.

La table AN et toutes les formules Polaris sont documentées dans `CHARACTER.md` section 6.
Elles sont implémentables côté serveur sans aucune migration SQL.

**Règle après 9F-0 :** le client calcule pour l'affichage (réactivité UI). Le serveur recalcule
indépendamment pour toute résolution mécanique. Le serveur est source de vérité.

### `server/src/lib/polaris.js` — contenu

```js
// ─── Table AN — Aptitude Naturelle ────────────────────────────────────────────
const AN_TABLE = [
  { min: 3,  max: 3,         an: -4 },
  { min: 4,  max: 4,         an: -3 },
  { min: 5,  max: 5,         an: -2 },
  { min: 6,  max: 7,         an: -1 },
  { min: 8,  max: 9,         an:  0 },
  { min: 10, max: 12,        an: +1 },
  { min: 13, max: 15,        an: +2 },
  { min: 16, max: 18,        an: +3 },
  { min: 19, max: 21,        an: +4 },
  { min: 22, max: 24,        an: +5 },
  { min: 25, max: Infinity,  an: +6 },
]

// ─── calcNA — Niveau actuel d'un attribut ─────────────────────────────────────
// PC2 : TOTAL_MALUS = 0 en V1
export function calcNA(base, pcMod, modGen) {
  return Math.max(3, base + pcMod + modGen)
}

// ─── calcAN — Aptitude Naturelle depuis niveau actuel ─────────────────────────
export function calcAN(na) {
  const row = AN_TABLE.find(r => na >= r.min && na <= r.max)
  return row?.an ?? -4
}

// ─── calcAttributeTotal — na d'un attribut pour un character ─────────────────
// Lit char_attributes + char_archetype + ref_genotypes
export async function calcAttributeTotal(db, charSheetId, attrId) {
  const attr = await db('char_attributes')
    .where({ char_sheet_id: charSheetId, attr_id: attrId }).first()
  if (!attr) throw new Error(`Attribut ${attrId} introuvable`)

  const archetype = await db('char_archetype')
    .where({ char_sheet_id: charSheetId }).first()
  const genotype = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  const modGen = genotype ? (genotype[`mod_${attrId.toLowerCase()}`] ?? 0) : 0
  return calcNA(attr.base_level, attr.pc_modifier ?? 0, modGen)
}

// ─── calcSkillTotal — Total d'une compétence pour un character ────────────────
// Lit char_skills + char_attributes + ref_skills + char_archetype + ref_genotypes
// PC4 : AN doublé si attr_2 = null
export async function calcSkillTotal(db, charSheetId, skillId) {
  const skill = await db('ref_skills').where({ id: skillId }).first()
  if (!skill) throw new Error(`Compétence ${skillId} introuvable`)

  const na1 = await calcAttributeTotal(db, charSheetId, skill.attr_1)
  const na2 = skill.attr_2
    ? await calcAttributeTotal(db, charSheetId, skill.attr_2)
    : na1   // PC4 — AN doublé si attr_2 null

  const an1 = calcAN(na1)
  const an2 = calcAN(na2)
  const base = an1 + an2

  const charSkill = await db('char_skills')
    .where({ char_sheet_id: charSheetId, skill_id: skillId }).first()
  const mastery = charSkill?.mastery ?? 0

  return base + mastery  // PC11 — peut être négatif, jamais clampé
}
```

### Modifications socket/index.js — ENTITY_ACTION_RESOLVE

Le handler reçoit actuellement `skillTotal` depuis le client. Après 9F-0 :

```js
// Avant (PE1 — rustine)
const { requestId, approved, autoSuccess, gmModifier } = data
// pending.skillTotal utilisé directement

// Après (9F-0 — serveur source de vérité)
// pending stocke skillId (pas skillTotal)
// Recalcul serveur :
const skillTotal = pending.skillId
  ? await calcSkillTotal(db, pending.charSheetId, pending.skillId)
  : 0
```

**Ce que `pendingEntityActions` doit stocker :** ajouter `charSheetId` au moment de `ENTITY_ACTION_REQUEST`.
Le client envoie `characterId` → le serveur résout `charSheetId` via `char_sheet.character_id`.

### Modifications SessionPage.jsx — payload ENTITY_ACTION_REQUEST

```js
// Avant
socket.emit(WS.ENTITY_ACTION_REQUEST, {
  requestId, characterId, entityId, interactionId,
  skillId: interaction.skill_id || null,
  skillTotal: 0,  // ← supprimé
})

// Après
socket.emit(WS.ENTITY_ACTION_REQUEST, {
  requestId, characterId, entityId, interactionId,
  skillId: interaction.skill_id || null,
  // skillTotal supprimé — le serveur recalcule
})
```

### Périmètre exact

- ✅ Aucune migration SQL
- ✅ Aucun changement côté Character (fiche, UI)
- ✅ Le client continue à calculer et afficher les totaux pour l'UI
- ✅ Seul le payload WS et la résolution serveur changent
- ❌ PE1 supprimé comme convention



### Objectif

Poser les fondations sans UX de déplacement :
- Rotation tokens (clic propriétaire)
- Migration `r` sur tokens
- Collision map Redis
- Table SQL marges de réussite

### Migration A1 — colonne `r` sur tokens

```javascript
// Format : 20260429_44_tokens_rotation.js
export const up = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.integer('r').notNullable().defaultTo(0)
    // r = 0..7 — incréments 45° — rotation.y = r * Math.PI/4
    // V1 utilise 0/2/4/6 (90°) — V2 utilise tous (45°)
    // Migration unique — anticipe 9F-C
  })
}
export const down = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('r')
  })
}
```

### Migration A2 — table marges de réussite

```javascript
// Format : 20260429_45_polaris_mr_table.js
// Seed immédiatement après via knex.seed ou dans up()
export const up = async (knex) => {
  await knex.schema.createTable('polaris_mr', (table) => {
    table.integer('mr_min').notNullable()    // MR minimum (inclusif)
    table.integer('mr_max').nullable()       // MR maximum (null = illimité)
    table.integer('dmax').notNullable()      // cases de déplacement max
    table.primary(['mr_min'])
  })
  // Seed données
  await knex('polaris_mr').insert([
    { mr_min: -999, mr_max: -1,  dmax: 0 }, // Échec
    { mr_min: 0,    mr_max: 4,   dmax: 1 },
    { mr_min: 5,    mr_max: 9,   dmax: 2 },
    { mr_min: 10,   mr_max: 14,  dmax: 3 },
    { mr_min: 15,   mr_max: 24,  dmax: 4 },
    { mr_min: 25,   mr_max: null, dmax: 5 },
  ])
}
export const down = async (knex) => {
  await knex.schema.dropTable('polaris_mr')
}
```

### Rotation token — flux

**Client (Canvas3D) :**
- Clic gauche sur son propre token (ownership via `character.user_id === user.id`)
- Émet `TOKEN_ROTATE { tokenId }` — le serveur incrémente `r`
- Pas de `r` dans le payload client — le serveur est source de vérité pour l'incrément

**Serveur (socket/index.js) :**
```js
socket.on(WS.TOKEN_ROTATE, async ({ tokenId }) => {
  const token = await db('tokens').where({ id: tokenId }).first()
  if (!token) return
  const character = await db('characters').where({ id: token.character_id }).first()
  if (character?.user_id !== socket.data.userId && socket.data.role !== 'gm') return
  const newR = ((token.r ?? 0) + 1) % 8   // incrément 45°, modulo 8
  const [updated] = await db('tokens').where({ id: tokenId })
    .update({ r: newR, updated_at: db.fn.now() }).returning('*')
  io.to(token.campaignId).emit(WS.TOKEN_UPDATED, { token: updated })
})
```

**⚠ Note :** `TOKEN_UPDATED` existe déjà dans `events.js`. Réutilisé.

### Collision map Redis — initialisation (9F-A)

Structure :
```
Redis Hash : collision:{battlemap_id}
  clé    : "x:y:z"      (séparateur : — P17)
  valeur : JSON { type: 'token'|'entity'|'voxel', id: uuid }
```

**Reconstruction au SESSION_JOIN (serveur) :**
```js
async function buildCollisionMap(battlemapId) {
  const key = `collision:${battlemapId}`
  await redis.del(key)

  // Tokens
  const tokens = await db('tokens').where({ battlemap_id: battlemapId })
  for (const t of tokens) {
    await redis.hset(key, `${t.pos_x}:${t.pos_y}:${t.pos_z}`,
      JSON.stringify({ type: 'token', id: t.id }))
  }

  // Entités
  const entities = await db('entities').where({ battlemap_id: battlemapId })
  for (const e of entities) {
    await redis.hset(key, `${e.pos_x}:${e.pos_y}:${e.pos_z}`,
      JSON.stringify({ type: 'entity', id: e.id }))
  }

  // Voxels — faces solides uniquement (geo !== 'air')
  const bm = await db('battlemaps').where({ id: battlemapId }).first()
  const voxels = bm?.voxel_data ?? {}
  for (const [key_v, v] of Object.entries(voxels)) {
    const [x, y, z] = key_v.split(':').map(Number)
    await redis.hset(key, `${x}:${y}:${z}`,
      JSON.stringify({ type: 'voxel', id: key_v }))
  }

  await redis.expire(key, 86400) // TTL 24h — reconstruite au prochain SESSION_JOIN
}
```

**Maintenance temps réel :**
- `TOKEN_MOVED` → `redis.hdel(old_key)` + `redis.hset(new_key)`
- `ENTITY_MOVED` → idem
- `VOXEL_ADD` → `redis.hset`
- `VOXEL_REMOVE` → `redis.hdel`
- `TOKEN_CREATED/DELETED`, `ENTITY_CREATED/DELETED` → idem

**Helper de vérification :**
```js
async function isCaseOccupied(battlemapId, x, y, z, excludeIds = []) {
  const raw = await redis.hget(`collision:${battlemapId}`, `${x}:${y}:${z}`)
  if (!raw) return false
  const cell = JSON.parse(raw)
  return !excludeIds.includes(cell.id)
}
```

`excludeIds` = [tokenId, entityId] — le "tunnel de swap" (PE22) : acteur et entité se traversent mutuellement pendant le mouvement.

---

---

## 7. Chantier 9F-A — Fondations mouvement

### Objectif

Poser les fondations sans UX de déplacement :
- Migration `r` sur tokens (8 orientations 45°)
- Migration table `polaris_mr` + seed
- Collision map Redis : construction + maintenance
- `TOKEN_ROTATE` : event + handler serveur + clic client

### Migration A1 — colonne `r` sur tokens

```javascript
// Format : 20260429_44_tokens_rotation.js
export const up = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.integer('r').notNullable().defaultTo(0)
    // r = 0..7 — incréments 45° — rotation.y = r * Math.PI/4
    // Migration unique — anticipe 9F-C (diagonal)
  })
}
export const down = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('r')
  })
}
```

### Migration A2 — table marges de réussite

```javascript
// Format : 20260429_45_polaris_mr_table.js
export const up = async (knex) => {
  await knex.schema.createTable('polaris_mr', (table) => {
    table.integer('mr_min').notNullable().primary()
    table.integer('mr_max').nullable()   // null = illimité
    table.integer('dmax').notNullable()
  })
  await knex('polaris_mr').insert([
    { mr_min: -999, mr_max: -1,   dmax: 0 },
    { mr_min: 0,    mr_max: 4,    dmax: 1 },
    { mr_min: 5,    mr_max: 9,    dmax: 2 },
    { mr_min: 10,   mr_max: 14,   dmax: 3 },
    { mr_min: 15,   mr_max: 24,   dmax: 4 },
    { mr_min: 25,   mr_max: null, dmax: 5 },
  ])
}
export const down = async (knex) => {
  await knex.schema.dropTable('polaris_mr')
}
```

### Rotation token — flux

**Client (Canvas3D) :**
- Clic gauche sur son propre token (ownership via `character.user_id === user.id`)
- Émet `TOKEN_ROTATE { tokenId }` — le serveur est source de vérité pour l'incrément

**Serveur (socket/index.js) :**
```js
socket.on(WS.TOKEN_ROTATE, async ({ tokenId }) => {
  const token = await db('tokens').where({ id: tokenId }).first()
  if (!token) return
  const character = await db('characters').where({ id: token.character_id }).first()
  if (character?.user_id !== socket.data.userId && socket.data.role !== 'gm') return
  const newR = ((token.r ?? 0) + 1) % 8   // incrément 45°, modulo 8
  const [updated] = await db('tokens').where({ id: tokenId })
    .update({ r: newR, updated_at: db.fn.now() }).returning('*')
  io.to(token.campaignId).emit(WS.TOKEN_UPDATED, { token: updated })
})
```

**⚠ Note :** `TOKEN_UPDATED` existe déjà dans `events.js`. Réutilisé.

### Collision map Redis — voir §9

---

## 8. Chantier 9F-B — Interaction déplacement entité (orthogonal)

### Objectif

Implémenter le déplacement d'entité complet en orthogonal (4 axes) avec :
- UX client : ghost, snap axial, détection Push/Pull
- Jet d'attribut FOR serveur
- Algorithme step-by-step avec collision
- Broadcast positions finales

### Détermination Push/Pull par vecteur

```
A = position acteur (token)
E = position entité
D = position destination (clic joueur)

Vecteur AE = E - A  (acteur → entité)
Vecteur AD = D - A  (acteur → destination)

dot(AE, AD) > 0 → PUSH (entité dans la même direction que la destination)
dot(AE, AD) < 0 → PULL (acteur s'interpose entre entité et destination)
dot(AE, AD) = 0 → cas ambigu → refusé côté client
```

### Dmax et mode Pull

```js
// Serveur — après calcul MR
const mr = attributeTotal + diceResult - difficulty_dc
const row = await db('polaris_mr')
  .where('mr_min', '<=', mr)
  .where(function() { this.whereNull('mr_max').orWhere('mr_max', '>=', mr) })
  .first()
const dmax = row?.dmax ?? 0

// Override Pull
if (moveType === 'pull' && interaction.pull_dmax_override !== null) {
  dmax = Math.min(dmax, interaction.pull_dmax_override)
}
```

### Algorithme step-by-step (orthogonal — 9F-B)

```
Pour k = 1 à Dmax :
  nextEntityPos = entityPos + direction * k
  nextActorPos  = actorPos  + direction * k   (acteur suit à chaque pas)

  Si isCaseOccupied(nextEntityPos, exclude=[tokenId, entityId]) → STOP à k-1
  Si isCaseOccupied(nextActorPos,  exclude=[tokenId, entityId]) → STOP à k-1

Résultat : positions finales entityPos + (k-1)*direction, actorPos + (k-1)*direction
```

**Note "tunnel de swap" (PE22) :** pendant le calcul, `tokenId` et `entityId` sont mutuellement exclus du check collision. Ils peuvent occuper la même case intermédiaire dans le calcul — leurs positions réelles changent seulement à la fin.

### Payload client → serveur

```js
socket.emit(WS.ENTITY_MOVE_REQUEST, {
  entityId,
  interactionId,
  attributeTotal,    // na(FOR) calculé client — PE1 étendu
  destX,             // case destination (coordonnées base — entières)
  destZ,             // pos_y base (profondeur) — PE14
})
```

**⚠ Le client envoie `destX` et `destZ` (coordonnées base, entières).** Le serveur recalcule la direction et valide la cohérence (orthogonalité, distance ≤ Dmax).

### Payload serveur → clients

```js
// Résultat jet + positions finales — vers joueur uniquement
io.to(socket.id).emit(WS.ENTITY_MOVE_RESULT, {
  requestId,
  diceResult,
  mr,
  dmax,
  finalEntityPos: { pos_x, pos_y, pos_z },
  finalActorPos:  { pos_x, pos_y, pos_z },
  success: dmax > 0,
})

// Broadcast positions — vers toute la room
io.to(campaignId).emit(WS.ENTITY_MOVED, { entityId, pos_x, pos_y, pos_z, updated_at })
io.to(campaignId).emit(WS.TOKEN_MOVED,  { tokenId,  pos_x, pos_y, pos_z })
```

### Lock — via pendingEntityActions (Option B)

Pas de colonne `is_moving`. La Map `pendingEntityActions` existante bloque les doubles soumissions.
Guard en tête du handler `ENTITY_MOVE_REQUEST` :
```js
const alreadyPending = [...pendingEntityActions.values()]
  .some(p => p.entityId === entityId)
if (alreadyPending) return  // entité déjà en cours de traitement
```

---

## 8. Chantier 9F-C — Diagonal + animation Lerp

### Objectif

Extension de 9F-B :
- 8 axes de mouvement (orthogonal + diagonal 45°)
- Animation Lerp 300ms client (acteur + entité simultanés)
- Rotation tokens à 45° (UI clic)

### Rotation tokens à 45°

`r` est déjà 0-7 depuis la migration 9F-A. En 9F-C, tous les incréments sont utilisables.
UI : clic gauche token propriétaire → `r = (r + 1) % 8` — rotation visible immédiate.

En 9F-B, seuls r=0/2/4/6 sont proposés à l'UI (radio 4 directions).
En 9F-C, r=0..7 tous proposés.

### Validation diagonale (règle D&D)

```
Pas diagonal vers (x+1, z+1) :
  Vérifier (x+1, z) et (x, z+1) séparément.
  BLOQUÉ si les DEUX cases adjacentes sont occupées.
  Libre si au moins UNE des deux est libre.
```

### Snap axial client

Le client snape la destination sur l'axe le plus proche selon un ratio 2:1 :
```js
const dx = Math.abs(dest.x - entity.pos_x)
const dz = Math.abs(dest.z - entity.pos_y)  // pos_y base = Z Three.js (PE14)

if (dx > 2 * dz) → axe X pur (orthogonal)
if (dz > 2 * dx) → axe Z pur (orthogonal)
else → diagonal 45°
```

### Animation Lerp — client

```js
// À la réception de ENTITY_MOVED + TOKEN_MOVED
// Interpolation simultanée sur 300ms
const lerp = (start, end, t) => start + (end - start) * t
// t = elapsed / 300, clamped 0..1
// Appliqué dans useFrame R3F ou via requestAnimationFrame
```

### Adjacence Tchebychev — validation finale serveur

Après chaque pas k :
```js
const distTchebychev = Math.max(
  Math.abs(entityPos.x - actorPos.x),
  Math.abs(entityPos.z - actorPos.z),
)
if (distTchebychev > 1) { stop at k-1; break }
```

---

## 9. Carte de collision Redis

### Décision d'architecture

Redis est retenu pour la collision map — pas une table SQL dérivée.

**Pourquoi Redis plutôt que SQL :**
- Requêtes SQL à la volée : O(n) par case, problème à Dmax=5, bloquant pour pathfinding futur
- Table SQL dérivée : risque de désynchronisation silencieuse
- Redis Hash : O(1) par case, cohérent avec l'usage Redis existant (sessions), reconstruit au SESSION_JOIN

**Format clé :** `collision:{battlemap_id}` → Hash `"x:y:z"` → JSON
Séparateur `:` — conforme P17.

**TTL :** 24h. Reconstruite à chaque SESSION_JOIN (au moins un joueur en session).

**Maintenance :** mise à jour à chaque mutation de position (TOKEN_MOVED, ENTITY_MOVED, VOXEL_ADD/REMOVE, CREATE/DELETE).

**Tunnel de swap (PE22) :** lors du step-by-step, `excludeIds = [tokenId, entityId]` — acteur et entité ignorés dans les checks mutuels.

---

## 10. Table des marges de réussite Polaris

```
MR = attributeTotal + 1d20 - difficulty_dc

MR      Dmax
< 0      0 (échec)
0-4      1 case
5-9      2 cases
10-14    3 cases
15-24    4 cases
25+      5 cases
```

**Exception Pull :** si `interaction.pull_dmax_override` défini → `dmax = min(dmax_table, pull_dmax_override)`.

**Stockée en SQL** (`polaris_mr`) — seed dans la migration 45.
**Lue en mémoire** au démarrage du serveur ou à la première requête — pas de requête SQL par jet.

```js
// Cache serveur (chargé une fois au démarrage)
let MR_TABLE = null
async function getMrTable() {
  if (!MR_TABLE) MR_TABLE = await db('polaris_mr').orderBy('mr_min')
  return MR_TABLE
}
function getDmax(mr) {
  const table = MR_TABLE
  const row = table.find(r => mr >= r.mr_min && (r.mr_max === null || mr <= r.mr_max))
  return row?.dmax ?? 0
}
```

---

## 12. Pièges — référence complète

| Code | Description |
|---|---|
| PE1 | ~~skillTotal calculé client~~ — **SUPPRIMÉ en 9F-0**. Le serveur calcule via `polaris.js`. Le client calcule pour l'affichage uniquement. |
| PE2 | `socket.data.role` pour fetchSockets() |
| PE4 | Face `null` = invisible — guard obligatoire |
| PE7 | `current_state_id` = index entier dans `states[]`, pas un UUID |
| PE11 | Fallback `stateList[0]` si `current_state_id` invalide |
| PE12 | `clearTimeout` + `pendingEntityActions.delete` à chaque résolution |
| PE13 | Touche `R` = rotation ghost OU entité sous curseur — jamais les deux |
| PE14 | `pos_y` base = Z Three.js (profondeur). `pos_z` base = Y Three.js (altitude). NON NÉGOCIABLE |
| PE16 | `e.code` pour Alt — invariant AZERTY/QWERTY |
| PE17 | `usage_hint` = hint de tri, jamais exclusif |
| PE18 | `blueprint.pack_id` nullable — guard avant accès |
| PE19 | `transparent={true}` sur meshLambertMaterial — sinon opacity=0 ineffectif |
| PE20 | `HoverIcon` toujours monté — jamais conditionnel à `hovered` |
| PE21 | `r` tokens = 0-7 (45° incréments) — `rotation.y = r * Math.PI / 4` |
| PE22 | Tunnel de swap : `excludeIds = [tokenId, entityId]` dans `isCaseOccupied` pendant step-by-step |
| PE23 | Collision map Redis reconstruite au SESSION_JOIN — pas au démarrage serveur |
| PEF1 | `pack_id` obligatoire sur blueprint — guard si null |
| PEF2 | `fakeTexObj` conforme : `{ id, pack_id, faces }` |
| PEF3 | `entityTextureMaterials` indexé par `blueprint.id` UUID |
| PEF4 | `face_overrides` états = chemins PNG |
| PEF5 | Blueprint sans `pack_id` → skip + rendu magenta |
| PEF6 | Canvas3D : chargements voxels et entités séparés |

---

## 13. Hors scope

| Fonctionnalité | Décision |
|---|---|
| Calcul `attributeTotal` côté serveur | Chantier Character dédié — dette technique documentée §11 |
| Pathfinding tokens (A*) | Phase 3+ — collision map Redis prête à l'emploi |
| Diagonal 45° (rotation tokens + snap + Tchebychev) | Chantier 9F-C |
| Animation Lerp 300ms | Chantier 9F-C |
| `is_blocking` / `is_transparent` entités | Stocké en base, non implémenté — LOS futur |
| `auto_reset_timer` entités | Non stocké V1 |
| `/sc` couplé à une entité | Décision définitive : ambiguïté ciblage irrésoluble |
| Toggle global `gm_only` | V2 |
| Export pack avec blueprints | V2 |
| Sélection rectangulaire éditeur | V2 |
| Rotation libre axes X/Z | V1 = axe Y uniquement |

---

## Plan d'implémentation — ordre des chantiers

### 9F-0 — Module polaris.js (PRÉREQUIS ABSOLU — 1 session)
1. `server/src/lib/polaris.js` — AN_TABLE, calcNA, calcAN, calcAttributeTotal, calcSkillTotal
2. `socket/index.js` — ENTITY_ACTION_RESOLVE : remplacer `skillTotal` client par `calcSkillTotal` serveur
3. `SessionPage.jsx` — retirer `skillTotal` du payload ENTITY_ACTION_REQUEST
4. Tests console F12 — vérifier que le calcul serveur produit les mêmes résultats que le client
5. PE1 supprimé des conventions — remplacé par "serveur source de vérité"

### 9F-A — Fondations (1 session) — APRÈS 9F-0 validé
1. Migration 44 : `r` sur tokens (0-7, 45°)
2. Migration 45 : `polaris_mr` + seed
3. Collision map Redis : `buildCollisionMap` + maintenance dans handlers existants
4. `TOKEN_ROTATE` : event dans `events.js` + handler serveur + clic client Canvas3D
5. Affichage rotation token dans le composant token 3D

### 9F-B — Déplacement orthogonal (1-2 sessions) — APRÈS 9F-A validé
1. `ENTITY_MOVE_REQUEST` + `ENTITY_MOVE_RESULT` dans `events.js`
2. Handler serveur : validation, jet d'attribut via `polaris.js`, MR, step-by-step, broadcast
3. Atelier : champs `move_type` + `attribute_id` dans le formulaire interaction
4. Client RadialMenu : tranche Déplacement (grisée si hors portée)
5. Client mode visée : ghost entité, snap 4 axes, clic destination

### 9F-C — Diagonal + polish (1-2 sessions) — APRÈS 9F-B validé
1. Snap 8 axes + validation diagonale serveur
2. UI rotation tokens 45° (tous les r=0..7)
3. Animation Lerp 300ms (acteur + entité simultanés)
4. Validation Tchebychev serveur
