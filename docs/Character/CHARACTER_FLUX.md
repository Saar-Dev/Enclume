# CHARACTER_FLUX.md — Flux de données du domaine Character
> Complément technique de CHARACTER.md
> Dernière mise à jour : 2026-05-09 — Session 55

Ce document décrit les flux de données, les dépendances entre composants, et les chaînes de chargement. À lire quand on modifie un composant Character.

---

## Arbre des composants

```
SessionPage
  └── CharacterWindow
        ├── [onglet Fiche]     → CharacterSheet
        │     ├── SkillsPanel
        │     └── AdvantagesPanel
        ├── [onglet Matériel]
        │     ├── ArmorWoundPanel          ← état centralisé wounds + inventory
        │     │     ├── LocationPanel × 6  (tete / corps / bras_gauche / bras_droit / jambe_gauche / jambe_droite)
        │     │     ├── ContainerPanel × 2 (Sac à dos / Ceinture)
        │     │     └── SilhouettePanel    (lecture seule — wounds prop)
        │     └── InventoryPanel           ← état local séparé
        ├── [onglet Bio]       → illustration + notes GM
        └── [onglet Params]    → propriétaire, GLB, suppression
```

---

## Chargement au montage — CharacterSheet

```
CharacterSheet(characterId)
  │
  ├─ 1. Promise.all (en parallèle)
  │       ├── GET /api/char-ref/genotypes    → state genotypes
  │       └── GET /api/char-ref/skills       → state refSkills
  │
  ├─ 2. GET /api/char-sheet/:id
  │       → sheet, identity, archetype, attributes[], skills[]
  │       └── si sheet=null : POST puis rechargement
  │
  └─ 3. GET /api/char-sheet/:id/advantages   (appel séparé, non bloquant)
          → state charAdvantages
          └── erreur → charAdvantages = [] (AdvantagesPanel s'affiche vide)
```

**Ordre de rendu :** loading spinner → après étape 2 → affichage fiche. AdvantagesPanel reçoit `charAdvantages=[]` puis se met à jour quand l'étape 3 termine.

---

## Chargement au montage — AdvantagesPanel

```
AdvantagesPanel(characterId)
  │
  └─ useEffect([], [])     ← au montage, sans condition modale
       GET /api/char-ref/mutations  → state refMutations
       (PC16 : nécessaire pour enrichir POST advantages avec mutation_nom)
```

**Chargement différé (à l'ouverture de la modale) :**
```
openModal()
  └── useEffect([modalOpen])
        GET /api/char-ref/skills        → refSkillsPolaris (filtre parent=POUVOIRS_POLARIS)
        GET /api/char-sheet/:id         → charSkillsPolaris (état is_learned des pouvoirs)
```

---

## Chargement au montage — ArmorWoundPanel

```
ArmorWoundPanel(characterId, reloadKey)
  │
  └─ useEffect([load, reloadKey])          ← se redéclenche quand reloadKey change
       Promise.all
         ├── GET /api/char-sheet/:id/wounds
         │     → state wounds[]            ← transmis à LocationPanel × 6 + SilhouettePanel
         └── GET /api/char-sheet/:id/inventory
               → state inventory[]         ← transmis à LocationPanel × 6 + ContainerPanel × 2
               → state totalWeight         ← affiché avec couleur gris/orange/rouge
               → state threshold           ← FOR × 3
```

**reloadKey** : entier (`inventoryVersion`) géré dans `CharacterWindow`. Incrémenté par `InventoryPanel.onInventoryMutated`. Permet à ArmorWoundPanel de se resynchroniser quand l'inventaire change depuis InventoryPanel (ajout/suppression d'item).

---

## Chargement au montage — InventoryPanel

```
InventoryPanel(characterId)
  │
  └─ useEffect([characterId])
       GET /api/char-sheet/:id/inventory
         → state items[], sols, total_weight, ini_penalty, threshold
```

**État séparé d'ArmorWoundPanel.** Les deux chargent le même endpoint mais gèrent leur propre état. La synchronisation passe par le mécanisme reloadKey décrit ci-dessus — pas de state partagé.

---

## Flux de sauvegarde

### Attributs (CharacterSheet)
```
onChange(attrId, val)
  → attrsRef.current = newAttrs  (synchrone)
  → setAttrs(newAttrs)
  → clearTimeout + setTimeout 500ms
       PUT /attributes { attributes: [...] }
       → onSaved?.()  → ✓ dans CharacterWindow header
```

### Maîtrise compétence (SkillsPanel — GM uniquement)
```
onChange(skillId, val)
  → localMasteryRef.current[skillId] = val  (synchrone)
  → setLocalMastery(...)
  → clearTimeout + setTimeout 500ms  (timer par skillId)
       PUT /skills { skills: [{ skill_id, mastery }] }   ← is_learned non envoyé = conservé
       → onSaved?.()
```

### Distribution XP (CharacterSheet — GM uniquement)
```
onChange(xpAvailable, val)
  → setXpAvailable(val)
  → clearTimeout + setTimeout 500ms (xpDebounceTimer)
       PUT /xp { xp_available: val }   ← jamais xp_total depuis le client
       → onSaved?.()
```

### Achat compétence (SkillsPanel — owner ou GM)
```
handleBuy(skill)
  → if (isBuyingRef.current) return    ← guard synchrone (PC21)
  → if (xpAvailable < cout) return     ← guard client
  → isBuyingRef.current = true
  → setBuyingSkillId(skill.id)         ← UI bouton '…'
  → POST /skills/buy { skill_id }
       → onSkillBought({ skill_id, mastery, is_learned, xp_available, cout })
            → CharacterSheet.handleSkillBought
                 → setCharSkills : map si existant, push si nouvelle entrée
                 → setXpAvailable(xp_available)
                 → onSaved?.()
  finally: isBuyingRef.current = false, setBuyingSkillId(null)
```

### Ajout mutation (AdvantagesPanel)
```
handleAddMutation(muta_numero)
  → POST /advantages { type:'MUTATION', muta_numero }
  → enrichit réponse avec refMutations local (mutation_nom, linked_skill_id)
  → onAdvantagesChange(prev => updater)  ← updater function (pattern React fonctionnel)
       → CharacterSheet.setCharAdvantages(updated)
            → prop charAdvantages descendante vers SkillsPanel
                 → activeMutations recalculé (useMemo)
                      → isVisible() réévalue toutes les compétences
```

### Toggle pouvoir Polaris (AdvantagesPanel)
```
handleTogglePolaris(skillId)
  → PUT /skills/toggle-learned { skill_id, is_learned: !current }
  → setCharSkillsPolaris(updated)  ← state LOCAL à AdvantagesPanel
  ⚠️ NE remonte PAS vers CharacterSheet.charSkills
```

---

## Flux blessures (LocationPanel)

Le cycle clic d'une case suit 3 états : vide → blessure → stabilisée → guérie (supprimée).

```
handleBoxClick(severity, index)
  │
  ├─ case vide (wound == null)
  │     POST /char-sheet/:id/wounds { location, severity }
  │       → res.data.promoted : si true → serveur a supprimé toute la ligne
  │                                        et inséré une blessure de gravité sup.
  │       → res.data.shock_test_required : si true → affiche '!' sur la case
  │       → onWoundsReload()              ← toujours : GET /wounds complet (P49)
  │
  ├─ case active (wound.is_stabilized == false)
  │     PUT /char-sheet/:id/wounds/:woundId/stabilize
  │       → onWoundsReload()
  │
  └─ case stabilisée (wound.is_stabilized == true)
        DELETE /char-sheet/:id/wounds/:woundId
          → onWoundsReload()
```

**P49 — onWoundsReload est TOUJOURS un GET complet, jamais une mise à jour locale.** La promotion supprime des enregistrements sans retourner l'état complet — seul un rechargement est fiable.

**Broadcasts WS :** le serveur émet `WOUND_ADDED`, `WOUND_UPDATED` ou `WOUND_REMOVED` sur la room `campaignId`. **Actuellement non écoutés côté client** — l'état wounds est géré localement par ArmorWoundPanel via `onWoundsReload`.

---

## Flux équipement armure (LocationPanel)

```
handleEquip(itemId)
  → construit newSlot = join([...existingParts, slotCode])
    (ex : item déjà en BG, on équipe en BD → slot = 'BG/BD')
  → PUT /char-sheet/:id/inventory/:itemId { slot: newSlot }
  → onInventoryChange(res.data.item)   ← mise à jour locale dans ArmorWoundPanel
       setInventory(prev => prev.map(i => i.id === item.id ? item : i))

handleUnequip(itemId)
  → construit newSlot = remaining.join('/') || null
    (retire slotCode de la liste — si vide → null)
  → PUT /char-sheet/:id/inventory/:itemId { slot: newSlot }
  → onInventoryChange(res.data.item)   ← même mise à jour locale
```

**Règle 1+S+S :** le serveur refuse si le slot contient déjà une armure non-S et que le nouvel item est aussi non-S. Le client préfiltere `availableItems` en conséquence (hasNonS).

---

## Flux équipement container (ContainerPanel)

```
handleEquip(itemId)
  → PUT /char-sheet/:id/inventory/:itemId { slot: type }   (type = 'D' ou 'Ce')
  → onInventoryChange(res.data.item)

handleUnequip()
  → PUT /char-sheet/:id/inventory/:equippedItem.id { slot: null }
  → onInventoryChange(res.data.item)
```

**Simple slot exclusif** (1 item max) — pas de mille-feuille, pas de multi-slot.

---

## Flux inventaire (InventoryPanel → reloadKey)

```
InventoryPanel — mutation (ajout / suppression / déplacement container)
  → POST ou DELETE ou PUT /inventory
  → met à jour state local items
  → onInventoryMutated()

CharacterWindow.bumpInventoryVersion()
  → setInventoryVersion(v => v + 1)

ArmorWoundPanel.useEffect([load, reloadKey])
  → reload complet wounds + inventory
```

Ce mécanisme garantit qu'après l'ajout d'un sac à dos dans InventoryPanel, ArmorWoundPanel actualise ses `availableItems` dans LocationPanel (PI1 — sac conditionnel).

---

## calcMillefeuille

Formule mille-feuille Polaris : protection finale = max + reste/2.

```js
// LocationPanel.jsx
function calcMillefeuille(items, field) {
  const vals = items.map(i => i[field] ?? 0).filter(v => v > 0)
  if (!vals.length) return null
  const max  = Math.max(...vals)
  const rest = vals.reduce((s, v) => s + v, 0) - max
  return max + rest / 2   // ⚠️ arbitrage Math.ceil non tranché — vérifier LdB
}
```

Appelée deux fois par LocationPanel :
- `calcMillefeuille(equippedItems, 'ref_protection')` → ETQ (résistance)
- `calcMillefeuille(equippedItems, 'ref_protection_shock')` → PRT (choc)

**Arbitrage en attente :** les plans originaux spécifiaient `Math.ceil(max + rest/2)`. LdB à vérifier avant de trancher.

---

## slotCode vs refCode (LocationPanel)

Deux codes distincts coexistent dans LocationPanel pour gérer la compatibilité avec `ref_equipment`.

```js
const slotCode = LOCATION_TO_SLOT[location]
// tete:'T', corps:'C', bras_gauche:'BG', bras_droit:'BD',
// jambe_gauche:'JG', jambe_droite:'JD'

const refCode = SLOT_TO_REF_LOCATION[slotCode] ?? slotCode
// T:'T', C:'C', BG:'B', BD:'B', JG:'J', JD:'J'
```

| Usage | Code | Pourquoi |
|---|---|---|
| `equippedItems` filter | `slotCode` | Indépendance bras/jambes (PI6) |
| `handleEquip/Unequip` | `slotCode` | Écriture en base — code précis |
| `availableItems` filter | `refCode` | `ref_equipment.location` utilise encore B/J |

**Exemple :** une Pagan (`ref_location='B'`) est disponible dans les panels BG et BD via `refCode='B'`, mais s'équipe séparément per-localisation via `slotCode` (PI7).

---

## Routes REST blessures

Toutes sous `/api/char-sheet/:characterId`. Auth + ownership via `router.param`.

| Méthode | Route | Rôle | Payload |
|---|---|---|---|
| GET | `/wounds` | Liste + `wound_penalty` calculé serveur | — |
| POST | `/wounds` | Ajoute blessure + promotion auto | `{ location, severity }` |
| PUT | `/wounds/:woundId/stabilize` | Stabilise (`is_stabilized=true`) | — |
| DELETE | `/wounds/:woundId` | Guérit (supprime) | — |

**Réponse POST `/wounds` :**
```json
{ "wound": {...}, "promoted": true/false, "shock_test_required": true/false }
```
Si `promoted=true` : le serveur a supprimé toute la ligne de la gravité inférieure (P49).

---

## Routes REST inventaire

| Méthode | Route | Rôle | Notes |
|---|---|---|---|
| GET | `/inventory` | Items + sols + total_weight + ini_penalty + threshold | Calcule FOR nette (PI4) |
| PUT | `/sols` | Modifie solde monétaire | |
| POST | `/inventory` | Ajoute item | Stacking auto si même equipment_id + container + slot null |
| PUT | `/inventory/:itemId` | Modifie container / slot / qty / custom | Validation 1+S+S (PI8 LIKE query) |
| DELETE | `/inventory/:itemId` | Supprime (qty partielle possible) | Body optionnel `{ quantity }` |

**Règles serveur POST/PUT slot armor :**
- Slot `D` ou `Ce` → exclusif (1 item max, conflit → 409)
- Slot `T/C/BG/BD/JG/JD` → LIKE `%/CODE/%` pour multi-slot, max 3 couches, règle 1+S+S

---

## WS broadcasts (char-sheet.js)

| Événement | Quand | Payload |
|---|---|---|
| `WOUND_ADDED` | POST /wounds | `{ characterId, wound, promoted, shock_test_required }` |
| `WOUND_UPDATED` | PUT /wounds/:id/stabilize | `{ characterId, wound }` |
| `WOUND_REMOVED` | DELETE /wounds/:id | `{ characterId, woundId }` |
| `INVENTORY_ADDED` | POST /inventory (nouvel item) | `{ characterId, item }` |
| `INVENTORY_UPDATED` | POST /inventory (stacking) + PUT /inventory/:id | `{ characterId, item }` |
| `INVENTORY_REMOVED` | DELETE /inventory/:id | `{ characterId, itemId }` |
| `SOLS_UPDATED` | PUT /sols | `{ characterId, sols }` |

**Note :** ces events sont émis mais non écoutés dans les composants Character actuellement — l'état est géré localement. À implémenter lors d'une session future si la synchronisation multi-fenêtres devient nécessaire.

---

## Mémoïsation dans CharacterSheet

```
genotypeData = useMemo([genotypes, genotypeId])
getModGen    = useCallback([genotypeData])
naMap        = useMemo([attrs, getModGen])     ← recalculé si attrs ou génotype change
anMap        = useMemo([naMap])                ← passé à SkillsPanel
secondary    = useMemo([naMap])
```

**Règle :** `anMap` est passé à `SkillsPanel` — si `anMap` change, `SkillsPanel` recalcule tous les `calcBase`. Ne jamais casser la mémoïsation de `anMap`.

---

## Mémoïsation dans SkillsPanel

```
learnedSet      = useMemo([charSkills])
activeMutations = useMemo([charAdvantages])  ← Set des muta_numero actifs
calcBase        = useCallback([anMap])
calcTotal       = useCallback([calcBase, localMastery])
isVisible       = useCallback([refSkills, learnedSet, calcTotal, genotypeId, activeMutations, progressionMode])
families        = useMemo([refSkills])
```

**Chaîne de dépendance visibilité :**
`charAdvantages` → `activeMutations` → `isVisible` → `visibleSkills` (rendu)

---

## Refs miroirs — pattern synchrone (PC12)

Problème : dans un debounce setTimeout, les closures capturent la valeur de state au moment de la création du timer, pas au moment de l'exécution. Solution : ref miroir mise à jour synchroniquement dans onChange.

```js
// Pattern standard dans CharacterSheet et SkillsPanel
const myRef = useRef(initialValue)

onChange = (val) => {
  myRef.current = val          // synchrone — toujours la dernière valeur
  setState(val)                // asynchrone — déclenche re-rendu
  clearTimeout(timer.current)
  timer.current = setTimeout(() => {
    api.put('/route', { value: myRef.current })  // lit la ref, pas le state
  }, 500)
}
```

---

## Ownership — pattern commun à toutes les routes

```js
async function assertOwnerOrGm(characterId, userId) {
  const character = await db('characters').where({ id: characterId }).first()
  if (!character) throw new AppError(404, 'Character not found')
  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: userId }).first()
  if (!member) throw new AppError(403, 'Not a campaign member')
  const isOwner = character.user_id === userId
  const isGm = member.role === 'gm'
  if (!isOwner && !isGm) throw new AppError(403, 'Forbidden')
  return { character, isGm }
}
```

En pratique implémenté via `router.param('characterId', ...)` — `req.character` et `req.isGm` disponibles dans tous les handlers.

---

## Dépendances entre tables Character

```
characters (VTT)
  └── char_sheet  ←─────────────────────────────────┐
        ├── char_identity                            │ ON DELETE CASCADE
        ├── char_archetype → ref_genotypes           │
        ├── char_attributes                          │
        ├── char_skills    → ref_skills              │
        │                    → ref_skill_requirements│
        ├── char_advantages → ref_mutations          │
        ├── character_wounds                         │
        └── char_inventory → ref_equipment           │
                              ← 636 items            │
```

**Cascade :** supprimer `characters` → supprime toute la fiche Polaris automatiquement.

**`char_inventory`** : colonne `character_id` (FK directe sur `characters`), pas sur `char_sheet`. Calculs de poids et de seuil utilisent `char_attributes.FOR` (via JOIN char_sheet).

**`character_wounds`** : colonnes `char_sheet_id` (FK cascade), `location`, `severity`, `is_stabilized`.

---

## Points d'attention pour modifier un composant

### Modifier CharacterSheet
- Respecter l'ordre de déclaration : useState AVANT useCallback/useMemo qui les utilisent (P4)
- `attrsRef` et `chcRef` doivent être mis à jour synchroniquement DANS onChange ET au chargement API
- `charAdvantages` est chargé séparément — son absence ne bloque pas le rendu de la fiche

### Modifier SkillsPanel
- `charAdvantages` est une prop requise (peut être `[]` mais pas undefined)
- `isVisible` dépend de 6 valeurs mémoïsées — vérifier les deps si on ajoute une règle
- Guard CHC en tête de `isVisible` : ne jamais supprimer

### Modifier AdvantagesPanel
- `refMutations` chargé au montage (useEffect sans deps) — ne pas conditionner à modalOpen
- `handleAddMutation` doit enrichir la réponse POST avec `refMutations` local
- `onAdvantagesChange` est le seul canal de remontée vers CharacterSheet

### Modifier ArmorWoundPanel
- État centralisé `wounds` et `inventory` : ne pas dupliquer dans les enfants
- `handleInventoryChange` = mise à jour locale (map) — assez pour equip/unequip (item retourné complet)
- `handleWoundsReload` = GET complet — obligatoire après toute mutation blessure (P49)
- `reloadKey` déclenche un reload complet — ne pas l'utiliser à la légère

### Modifier LocationPanel
- `slotCode` pour toute écriture en base (equip/unequip) — jamais `refCode`
- `refCode` uniquement pour `availableItems` filter sur `ref_location`
- `calcMillefeuille` retourne `null` si aucun item équipé — toujours null-checker avant affichage
- Limite 3 couches vérifiée côté serveur ET côté client (`equippedItems.length < 3`)

### Modifier ContainerPanel
- Slot exclusif (`slot === type`) — pas de multi-slot, pas de mille-feuille
- `availableItems` filtre `ref_location === type && slot === null` (item non déjà équipé ailleurs)

### Modifier les routes inventaire
- LIKE query obligatoire pour les slots armor multi-couches : `'/' || slot || '/' LIKE '%/CODE/%'` (PI8)
- `isContainerAvailable` doit être appelé avant tout POST/PUT qui change le container (PI1)
- `container` forcé à `'Sac'` par le serveur quand `slot` armor est fourni (PI2)
- Items manuels (`equipment_id null`) : `ref_weight` null → exclus du calcul poids (PI5)
