# PLAN — Chantier 11 : Module Blessures
**Version** : 2.3 — Bug promotion état client corrigé (2026-05-07)
**Périmètre de cette session** : Étape 1 uniquement (blessures). Étapes 2–4 planifiées, non codées.

---

## Décisions architecturales actées

| Décision | Valeur |
|---|---|
| Numéro migration | **49** (`49_character_wounds.js`) |
| Ownership pattern | `router.param('characterId', ...)` — pattern Express.js officiel, remplace `assertOwnerOrGm` |
| Emplacement routes wounds | `char-sheet.js` (même router, bénéficie automatiquement de `router.param`) |
| `requireAuth` | Déplacé en `router.use(requireAuth)` en tête de router (une seule déclaration) |
| Calculs malus | Serveur uniquement — `charStats.js` fonctions pures |
| Malus global blessures | **Pire blessure toutes localisations confondues** (pas de cumul, confirmé LdB) |
| Constantes blessures | `shared/woundConstants.js` — importé serveur ET client (source unique de vérité) |
| State client | Local dans `CharacterSheet.jsx` — pattern identique à `charAdvantages` |
| Store Zustand | **Aucun** — pas de store dédié blessures |
| CSS | **Inline styles** — cohérent avec toute la fiche |
| WS room | `campaignId` via `req.character.campaign_id` — room existante |
| WS sync client V1 | **Non implémenté** — serveur broadcast, client ne l'écoute pas encore. Refresh requis. WS handlers client = Étape 4. |
| Client → serveur payload | `{ location, severity }` directement — pas de `damage` |
| Promotion automatique | Côté serveur, récursive, dans transaction knex |
| Blessures stabilisées à la promotion | **Supprimées** — comportement attendu (promotion annule les soins) |
| Test de Choc V1 | Flag `shock_test_required` dans le broadcast — gestion narrative, aucun état DB |

---

## Dépendance architecturale (rappel)

```
ref_equipment (catalogue) ← ✅ 636 items
    ↓
char_inventory (possessions joueur) ← 🔲 Chantier 10 sprint 2
    ↓
Étape 2 — Module Armes (équipé depuis inventaire)
Étape 3 — Module Armures (équipé depuis inventaire)
```

**Étapes 2 et 3 ne peuvent pas être codées avant `char_inventory`.**

---

## Mécanique Polaris — Blessures (LdB)

### Nombre de cases par localisation/gravité

| Localisation | Légères | Moyennes | Graves | Critiques | Mortelles |
|---|---|---|---|---|---|
| Tête | 3 | 3 | 2 | 2 | 1 |
| Corps | 4 | 3 | 3 | 2 | 2 |
| Bras Droit | 3 | 3 | 2 | 2 | 1 |
| Bras Gauche | 3 | 3 | 2 | 2 | 1 |
| Jambe Droite | 3 | 3 | 2 | 2 | 1 |
| Jambe Gauche | 3 | 3 | 2 | 2 | 1 |

### Malus par gravité

| Gravité | Malus |
|---|---|
| Légère | −1 |
| Moyenne | −3 |
| Grave | −5 |
| Critique | −10 |
| Mortelle | −20 |

**Règle malus global (confirmée LdB) : pire blessure toutes localisations confondues. Les autres ignorées.**

### Promotion automatique
Ligne pleine → **toutes** les blessures de cette gravité/localisation supprimées (y compris stabilisées) → 1 blessure de gravité supérieure ajoutée. Récursif si la ligne supérieure est aussi pleine.

Cas limite : ligne Mortelle pleine → `AppError(400)` — refus explicite, aucune suppression silencieuse, gestion narrative.

### Tests de Choc

| Gravité | Localisation | Test requis |
|---|---|---|
| Légère | toutes | non |
| Moyenne | toutes | non |
| Grave | Tête, Corps | oui |
| Grave | Bras, Jambe | non |
| Critique | toutes | oui |
| Mortelle | toutes | oui |

V1 : flag `shock_test_required` dans le broadcast. Indicateur visuel sur la blessure côté client. Aucun état DB.

### Cycle de vie d'une blessure (UX clicks)

```
Case vide         → [clic] → Blessure normale (colorée)
Blessure normale  → [clic] → Stabilisée (✓ vert)
Stabilisée        → [clic] → Supprimée (guérison)
```

Dé-stabilisation : impossible en un clic. Le GM clique stabilisée → guérie → puis recrée si besoin. Comportement accepté (fréquence trop faible pour justifier une route dédiée).

---

## Étape 1 — Fichiers

### Fichiers créés (3)

| Fichier | Rôle |
|---|---|
| `server/src/db/migrations/49_character_wounds.js` | Table `character_wounds` |
| `shared/woundConstants.js` | Constantes blessures — source unique de vérité (serveur + client) |
| `client/src/character/WoundManager.jsx` | Composant UI blessures |

### Fichiers modifiés (4)

| Fichier | Modification |
|---|---|
| `server/src/routes/character/char-sheet.js` | Refactor ownership → `router.param` + ajout `router.use(requireAuth)` + 4 routes wounds |
| `server/src/lib/charStats.js` | +`calcWoundPenalty(wounds)` (importe les constantes depuis `shared/`) |
| `shared/events.js` | +`WOUND_ADDED`, `WOUND_UPDATED`, `WOUND_REMOVED` dans l'objet `WS` |
| `client/src/character/CharacterSheet.jsx` | +state `wounds`, +chargement initial, +import WoundManager, +bloc UI |

---

## Détail technique

### 1. `shared/woundConstants.js` — à créer en premier

```javascript
// shared/woundConstants.js
export const WOUND_LOCATIONS = [
  'tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche',
]

export const WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']

export const WOUND_MAX_COUNTS = {
  tete:          { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  corps:         { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
  bras_droit:    { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  bras_gauche:   { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_droite:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_gauche:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
}

export const WOUND_PENALTIES = {
  legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: -20,
}
```

---

### 2. `shared/events.js` — ajouts dans l'objet WS

```javascript
// À ajouter dans l'objet WS existant, section Blessures :

// Blessures
WOUND_ADDED:   'wound:added',    // serveur → room : blessure ajoutée (+ promoted, shock_test_required)
WOUND_UPDATED: 'wound:updated',  // serveur → room : blessure stabilisée
WOUND_REMOVED: 'wound:removed',  // serveur → room : blessure supprimée (guérison)
```

---

### 3. `server/src/db/migrations/49_character_wounds.js`

```javascript
// Syntaxe validée contre migration 48 (ref_equipment) :
// - export const up = async (knex) => {}
// - table.primary() pas .primaryKey()
// - table.timestamps(true, true) pas individual created_at/updated_at
// - knex.raw() pas knex.schema.raw() — "fiabilité maximale indépendamment de la version Knex"

export const up = async (knex) => {
  await knex.schema.createTable('character_wounds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('location').notNullable()
    table.text('severity').notNullable()
    table.boolean('is_stabilized').notNullable().defaultTo(false)
    table.timestamps(true, true)
  })

  // CHECK constraints — raw SQL pour fiabilité maximale (pattern migration 48)
  await knex.raw(`
    ALTER TABLE character_wounds
      ADD CONSTRAINT chk_wounds_location
        CHECK (location IN ('tete','corps','bras_droit','bras_gauche','jambe_droite','jambe_gauche')),
      ADD CONSTRAINT chk_wounds_severity
        CHECK (severity IN ('legere','moyenne','grave','critique','mortelle'))
  `)

  await knex.raw(
    'CREATE INDEX idx_wounds_char_sheet_id ON character_wounds(char_sheet_id)'
  )
}

export const down = async (knex) => {
  await knex.schema.dropTable('character_wounds')
}
```

---

### 4. `char-sheet.js` — refactor ownership + routes wounds

#### Imports à ajouter en tête de fichier

```javascript
import { WS } from '../../../../shared/events.js'
import {
  WOUND_LOCATIONS, WOUND_SEVERITIES, WOUND_MAX_COUNTS,
} from '../../../../shared/woundConstants.js'
```

#### Remplacement de `assertOwnerOrGm` — début du fichier

Supprimer la fonction `assertOwnerOrGm` (lignes 35-49 actuelles).
Supprimer `requireAuth` de chaque route (remplacé par `router.use`).

```javascript
// ─── Ownership automatique sur toutes les routes /:characterId ────────────────
router.use(requireAuth)

router.param('characterId', async (req, res, next, characterId) => {
  try {
    const character = await db('characters').where({ id: characterId }).first()
    if (!character) return next(new AppError(404, 'Character not found'))

    const member = await db('campaign_members')
      .where({ campaign_id: character.campaign_id, user_id: req.user.id })
      .first()
    if (!member) return next(new AppError(403, 'You are not a member of this campaign'))

    req.character = character
    req.isGm     = member.role === 'gm'

    const isOwner = character.user_id === req.user.id
    if (!isOwner && !req.isGm) return next(new AppError(403, 'You do not have permission to access this sheet'))

    next()
  } catch (err) { next(err) }
})
```

#### Routes existantes — diff minimal après refactor

Chaque route perd `requireAuth` et l'appel `assertOwnerOrGm`. Elle utilise `req.character` et `req.isGm` à la place. Exemple :

```javascript
// AVANT
router.get('/:characterId', requireAuth, async (req, res, next) => {
  try {
    await assertOwnerOrGm(req.params.characterId, req.user.id)
    // ...

// APRÈS
router.get('/:characterId', async (req, res, next) => {
  try {
    // req.character et req.isGm déjà disponibles via router.param
    // ...
```

Les routes qui utilisaient `isGm` (PUT /skills, PUT /xp) lisent désormais `req.isGm`.

#### Helper promotion (local à char-sheet.js)

```javascript
// ─── Helper promotion blessures ───────────────────────────────────────────────
function isShockTestRequired(severity, location) {
  if (severity === 'critique' || severity === 'mortelle') return true
  if (severity === 'grave' && (location === 'tete' || location === 'corps')) return true
  return false
}

function nextSeverity(severity) {
  const idx = WOUND_SEVERITIES.indexOf(severity)
  return idx < WOUND_SEVERITIES.length - 1 ? WOUND_SEVERITIES[idx + 1] : null
}

// Récursif — résout la promotion en cascade dans une transaction knex
// Lance AppError si la ligne Mortelle est pleine (cas terminal)
async function resolveWoundInsertion(trx, char_sheet_id, location, severity) {
  const maxCount = WOUND_MAX_COUNTS[location]?.[severity]
  if (!maxCount) throw new AppError(400, `Gravité "${severity}" invalide pour "${location}"`)

  const { count } = await trx('character_wounds')
    .where({ char_sheet_id, location, severity })
    .count('* as count')
    .first()

  if (parseInt(count) < maxCount) {
    const [wound] = await trx('character_wounds')
      .insert({ char_sheet_id, location, severity, is_stabilized: false })
      .returning('*')
    return { wound, promoted: false }
  }

  const next = nextSeverity(severity)
  if (!next) throw new AppError(400, 'Ligne mortelle pleine — gestion manuelle requise')

  // Supprimer toutes (y compris stabilisées — comportement LdB confirmé)
  await trx('character_wounds').where({ char_sheet_id, location, severity }).del()

  const result = await resolveWoundInsertion(trx, char_sheet_id, location, next)
  return { ...result, promoted: true }
}
```

#### 4 routes wounds (à ajouter en fin de fichier)

```javascript
// ─── GET /:characterId/wounds ─────────────────────────────────────────────────
router.get('/:characterId/wounds', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.json({ wounds: [] })

    const wounds = await db('character_wounds')
      .where({ char_sheet_id: sheet.id })
      .orderBy('created_at', 'asc')
    res.json({ wounds })
  } catch (err) { next(err) }
})

// ─── POST /:characterId/wounds ────────────────────────────────────────────────
router.post('/:characterId/wounds', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const { location, severity } = req.body
    if (!WOUND_LOCATIONS.includes(location)) throw new AppError(400, `Localisation invalide : ${location}`)
    if (!WOUND_SEVERITIES.includes(severity)) throw new AppError(400, `Gravité invalide : ${severity}`)

    const result = await db.transaction(trx =>
      resolveWoundInsertion(trx, sheet.id, location, severity)
    )

    const shock_test_required = isShockTestRequired(result.wound.severity, result.wound.location)

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_ADDED, {
      characterId: req.params.characterId,
      wound:       result.wound,
      promoted:    result.promoted,
      shock_test_required,
    })

    res.status(201).json({ wound: result.wound, promoted: result.promoted, shock_test_required })
  } catch (err) { next(err) }
})

// ─── PUT /:characterId/wounds/:woundId/stabilize ──────────────────────────────
// Note P46 : déclarée AVANT DELETE /:characterId/wounds/:woundId
router.put('/:characterId/wounds/:woundId/stabilize', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const wound = await db('character_wounds')
      .where({ id: req.params.woundId, char_sheet_id: sheet.id }).first()
    if (!wound) throw new AppError(404, 'Wound not found')

    const [updated] = await db('character_wounds')
      .where({ id: req.params.woundId })
      .update({ is_stabilized: true, updated_at: db.fn.now() })
      .returning('*')

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_UPDATED, {
      characterId: req.params.characterId,
      wound: updated,
    })

    res.json({ wound: updated })
  } catch (err) { next(err) }
})

// ─── DELETE /:characterId/wounds/:woundId ─────────────────────────────────────
router.delete('/:characterId/wounds/:woundId', async (req, res, next) => {
  try {
    const sheet = await db('char_sheet')
      .where({ character_id: req.params.characterId }).first()
    if (!sheet) throw new AppError(404, 'Sheet not found')

    const wound = await db('character_wounds')
      .where({ id: req.params.woundId, char_sheet_id: sheet.id }).first()
    if (!wound) throw new AppError(404, 'Wound not found')

    await db('character_wounds').where({ id: req.params.woundId }).del()

    req.app.get('io').to(req.character.campaign_id).emit(WS.WOUND_REMOVED, {
      characterId: req.params.characterId,
      woundId: req.params.woundId,
    })

    res.json({ deleted: true, woundId: req.params.woundId })
  } catch (err) { next(err) }
})
```

---

### 5. `charStats.js` — ajout `calcWoundPenalty`

```javascript
import { WOUND_PENALTIES } from '../../../shared/woundConstants.js'
// Confirmé : server/src/lib/ → ../../../ → Enclume/shared/

/**
 * Malus global blessures — pire blessure toutes localisations confondues.
 * Règle LdB : les autres blessures sont ignorées.
 * @param {Array} wounds — [{ severity, ... }]
 * @returns {number} malus (≤ 0)
 */
export function calcWoundPenalty(wounds) {
  if (!wounds || wounds.length === 0) return 0
  let worst = 0
  for (const w of wounds) {
    const p = WOUND_PENALTIES[w.severity] ?? 0
    if (p < worst) worst = p
  }
  return worst
}
```

---

### 6. `CharacterSheet.jsx` — modifications

#### Imports à ajouter

```javascript
import WoundManager from './WoundManager.jsx'
```

#### State + chargement (dans `useEffect load()`)

```javascript
const [wounds, setWounds] = useState([])

// Dans useEffect, après le chargement des advantages :
try {
  const woundsRes = await api.get(`/char-sheet/${characterId}/wounds`)
  if (!cancelled) setWounds(woundsRes.data.wounds || [])
} catch (wErr) {
  console.error('Erreur chargement wounds :', wErr)
}
```

#### Bloc JSX (après Bloc 6 Avantages)

```jsx
{/* ══ BLOC 7 — BLESSURES ═══════════════════════════════════════════ */}
<div style={s.block}>
  <div style={s.blockTitle}>Blessures</div>
  <WoundManager
    wounds={wounds}
    onWoundsChange={setWounds}
    characterId={characterId}
    canEdit={canEdit}
  />
</div>
```

---

### 7. `WoundManager.jsx`

Props : `{ wounds, onWoundsChange, characterId, canEdit }`

Imports nécessaires :
```javascript
import { WOUND_LOCATIONS, WOUND_SEVERITIES, WOUND_MAX_COUNTS, WOUND_PENALTIES } from '../../../shared/woundConstants.js'
// Confirmé : même pattern que client/src/components/ → ../../../shared/events.js (Vite OK)
import api from '../lib/api.js'
```

**Logique handleBoxClick :**
```
case vide           → POST /char-sheet/:characterId/wounds { location, severity }
                        si response.data.promoted === true :
                          // Promotion : des blessures ont été supprimées côté serveur.
                          // onWoundsChange([...wounds, wound]) serait incohérent.
                          GET /char-sheet/:characterId/wounds → onWoundsChange(fresh)
                        sinon :
                          onWoundsChange([...wounds, response.data.wound])
                        dans tous les cas, si response.data.shock_test_required :
                          setLastAddedWoundId(response.data.wound.id)

blessure normale    → PUT  /char-sheet/:characterId/wounds/:id/stabilize
                      → onWoundsChange(wounds.map(w => w.id === id ? response.data.wound : w))

blessure stabilisée → DELETE /char-sheet/:characterId/wounds/:id
                      → onWoundsChange(wounds.filter(w => w.id !== id))
```

**Malus affiché (client, affichage uniquement) :**
```javascript
const woundPenalty = useMemo(() => {
  let worst = 0
  for (const w of wounds) {
    const p = WOUND_PENALTIES[w.severity] ?? 0
    if (p < worst) worst = p
  }
  return worst
}, [wounds])
```

**Couleurs gravités :**
```javascript
const SEVERITY_COLORS = {
  legere:   '#FFD700',
  moyenne:  '#FFA500',
  grave:    '#FF6B6B',
  critique: '#FF0000',
  mortelle: '#8B0000',
}
```

**États visuels des cases :**
| État | Visuel |
|---|---|
| Vide | Fond transparent, bordure `#2a2a3e` |
| Normale | Fond `SEVERITY_COLORS[severity]`, bordure blanche |
| Stabilisée | Fond couleur + `✓` vert + box-shadow vert |
| shock_test_required | Badge `!` orange sur la blessure (état local `lastAddedWoundId`) |

Inline styles cohérents avec `CharacterSheet.jsx` (palette `#0e0e1a`, `#1e1e2e`, `#2a2a3e`).

---

## Étapes 2–4 — Haute-niveau (non codées)

### Étape 2 — Module Armes (prérequis : Chantier 10 sprint 2)
Pioche dans `char_inventory → ref_equipment`. Aucune table standalone.

### Étape 3 — Module Armures (prérequis : Chantier 10 sprint 2)
Même architecture. Protection par localisation — interaction future avec seuils blessures.

### Étape 4 — Polish
- WS handlers client-side wounds (sync temps réel sans refresh)
- États santé DB : Étourdi / Inconscient / Coma
- Intégration `calcWoundPenalty` dans jets de compétences serveur

---

## Points de vigilance

| Code | Description |
|---|---|
| P46 | Route `stabilize` déclarée AVANT `DELETE /:woundId` (spécifique avant paramétrique) |
| P47 | Promotion côté client : si `response.data.promoted === true`, rechargement complet (`GET /wounds`) obligatoire. Sinon l'état client contient des blessures supprimées côté serveur. |
| P13 | `updated_at = db.fn.now()` dans PUT stabilize ✅ présent |
| — | `router.param` + `router.use(requireAuth)` : l'ordre déclaratif importe. `router.use(requireAuth)` EN PREMIER, puis `router.param`. |
| — | Lire migration 48 avant de coder migration 49 — vérifier syntaxe CHECK exacte |
| — | Vérifier chemin `shared/` dans `vite.config.js` avant import côté client |
| — | Tester double promotion (légère pleine + moyenne pleine) avant validation |
| — | `resolveWoundInsertion` récursif : vérifier que la transaction knex se propage correctement |
| — | Cas terminal (mortelle pleine) : AppError 400 — refus explicite, jamais silencieux |
