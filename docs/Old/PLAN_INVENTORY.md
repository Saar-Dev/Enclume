# PLAN_INVENTORY.md — Chantier 10 Sprint 2 : Module Inventaire
> Rédigé session 51 — 2026-05-07
> Remplace intégralement la version précédente (erronée).
> Statut : **validé pour implémentation**

---

## 1. Contexte

Implémenter le système d'inventaire des personnages Polaris (`char_inventory`) et la monnaie (`sols`).

**Prérequis satisfaits :**
- `ref_equipment` : 636 items seedés (migration 48) ✅
- `char_sheet` : table pivot stable (migration 36) ✅
- `router.param('characterId', ...)` dans `char-sheet.js` : ownership automatique ✅

**Périmètre sprint 2 :**
- Migration 50 (char_inventory + sols)
- CRUD inventaire (ajouter, déplacer, équiper, supprimer)
- Calcul encombrement
- Broadcast WS
- Composant `InventoryPanel.jsx`

**Hors périmètre (chantiers futurs) :**
- Transfert entre personnages (chantier dédié — WS bidirectionnel + validation double)
- UI armure (masquage des items équipés dans la vue Sac)
- Split de pile
- custom_props UI (champ présent en DB, non exposé en UI sprint 2)

---

## 2. Tables existantes impliquées

| Table | Rôle | Colonnes clés |
|---|---|---|
| `ref_equipment` | Catalogue statique | `id UUID`, `weight FLOAT`, `location VARCHAR(50)`, `protection INT`, `protection_shock INT`, `malus_cat TEXT` |
| `char_sheet` | Table pivot personnage | `id UUID`, `character_id UUID FK` |
| `char_attributes` | Attributs primaires | `char_sheet_id`, `attr_id TEXT`, `base_level INT`, `pc_modifier INT` |
| `characters` | Lien user/campagne | `id UUID` |

**Valeurs `ref_equipment.location` en base (vérifiées) :**
```
T        → Tête
C        → Corps
B        → Bras (les deux)
J        → Jambes (les deux)
Ce       → Contenants portables ceinture/poche/sac ventral
D        → Contenants portables sac/sac à dos
C/B/J    → Corps + Bras + Jambes
T/C/B/J  → Tête + Corps + Bras + Jambes
null     → Armes, munitions, divers
```

---

## 3. Migration 50

Deux opérations dans le même fichier `50_char_inventory.js`.

### 3.1 CREATE TABLE char_inventory

```sql
CREATE TABLE char_inventory (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id  UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id  UUID        REFERENCES ref_equipment(id) ON DELETE SET NULL,
    container     VARCHAR(20) NOT NULL DEFAULT 'Coffre',
    slot          VARCHAR(20) NULL,
    quantity      INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
    custom_name   VARCHAR(255) NULL,
    custom_desc   TEXT         NULL,
    notes         TEXT         NULL,
    custom_props  JSONB        NULL,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_char_inventory_character_id ON char_inventory(character_id);
CREATE INDEX idx_char_inventory_equipment_id ON char_inventory(equipment_id)
    WHERE equipment_id IS NOT NULL;
CREATE INDEX idx_char_inventory_slot ON char_inventory(slot)
    WHERE slot IS NOT NULL;
```

### 3.2 ALTER TABLE char_sheet

```sql
ALTER TABLE char_sheet ADD COLUMN sols INTEGER NOT NULL DEFAULT 0;
```

---

## 4. Colonnes — règles et contraintes

### 4.1 container

| Valeur | Disponibilité | Condition |
|---|---|---|
| `'Sac'` | Conditionnelle | character possède ≥1 item avec `ref_equipment.location = 'D'` |
| `'Ceinture'` | Conditionnelle | character possède ≥1 item avec `ref_equipment.location = 'Ce'` |
| `'Coffre'` | Toujours disponible | — |

**Validation côté serveur** (pas de CHECK SQL — dynamique) :
```js
const CONTAINERS_ALWAYS = ['Coffre']
const CONTAINERS_D  = ['Sac']      // requiert item location='D'
const CONTAINERS_CE = ['Ceinture'] // requiert item location='Ce'
```

Vérification disponibilité au POST et PUT :
```js
// Sac disponible ?
const hasSac = await db('char_inventory')
  .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
  .where({ 'char_inventory.character_id': characterId })
  .where('ref_equipment.location', 'D')
  .first()
```

### 4.2 slot

Valeurs autorisées : `T / C / B / J / C/B/J / T/C/B/J` — identique à `ref_equipment.location`.
`null` = item non équipé.

**Règle d'équipement :**
```
slot IS NOT NULL → container DOIT être 'Sac'
```
Si le PUT demande un slot et que container != 'Sac' → déplacer vers 'Sac' dans la même opération (atomique). Si 'Sac' n'est pas disponible → 400.

**Conflit de slot :** un seul item par slot. Vérifier avant équipement :
```js
const conflict = await db('char_inventory')
  .where({ character_id: characterId, slot: newSlot })
  .whereNot({ id: itemId })
  .first()
if (conflict) throw new AppError(409, 'Slot already occupied')
```

**Armure équipée et poids :** `container` reste `'Sac'` même si `slot IS NOT NULL`. Le poids est toujours compté. Future UI armure = filtre visuel côté client uniquement (`WHERE slot IS NULL` pour la vue Sac).

### 4.3 Stackabilité

Items empilables si même `equipment_id` + même `container` + `slot IS NULL`.
Items avec `slot IS NOT NULL` : jamais stackés.

Au POST, si item empilable déjà présent → `UPDATE quantity = quantity + newQty` au lieu d'INSERT.

### 4.4 custom_props (structure — UI hors sprint 2)

```js
// Exemples de structures attendues
{ "charges": 3, "charges_max": 10 }           // batterie, chargeur
{ "modules": ["Visée laser", "Silencieux"] }   // arme modifiée
{ "programmes": ["ICE Noire V2"] }             // cyberdeck
{ "level": 2 }                                 // item à niveaux
```

Champ libre JSONB. Aucun schéma imposé en DB. Validation métier à implémenter lors des UI dédiées.

---

## 5. Calcul encombrement

### 5.1 Formule

```
total_weight  = SUM(ref_equipment.weight * char_inventory.quantity)
                WHERE char_inventory.character_id = :id
                  AND char_inventory.container != 'Coffre'
                  AND ref_equipment.weight IS NOT NULL

threshold     = FOR_value × 3          (FOR = attribut base_level + pc_modifier)

ini_penalty   = MAX(0, CEIL(total_weight - threshold))
```

### 5.2 Implémentation

Fonction pure dans `server/src/lib/charStats.js` :
```js
export function calcEncumbrancePenalty(totalWeight, forValue) {
  const threshold = forValue * 3
  return Math.max(0, Math.ceil(totalWeight - threshold))
}
```

Le GET /inventory calcule et retourne `total_weight` et `ini_penalty` dans la réponse (nécessite JOIN ref_equipment + lecture de l'attribut FOR depuis char_attributes).

### 5.3 malus_cat — système distinct

`ref_equipment.malus_cat` ∈ `S / A / B / C / D` = pénalité intrinsèque de l'item (armure lourde → malus compétences). **Indépendant de l'encombrement poids.** Implémentation lors du chantier malus armure.

---

## 6. Monnaie — sols

Colonne `sols INTEGER NOT NULL DEFAULT 0` sur `char_sheet`.

Route dédiée :
```
PUT /api/char-sheet/:characterId/sols   { sols: N }
```

Guard : owner ou GM. Le GM peut modifier sans restriction. Le joueur peut seulement modifier sa propre fiche.

Broadcast `SOLS_UPDATED` après chaque modification.

---

## 7. API REST

Toutes les routes sont montées dans `server/src/routes/character/char-sheet.js`.
Le `router.param('characterId', ...)` existant gère l'auth + ownership automatiquement.

**Attention P46 :** déclarer les routes spécifiques AVANT les routes paramétriques.

| Méthode | Route | Description |
|---|---|---|
| GET | `/:characterId/inventory` | Liste inventaire + total_weight + ini_penalty + sols |
| POST | `/:characterId/inventory` | Ajouter item (stack si possible) |
| PUT | `/:characterId/inventory/:itemId` | Modifier container/slot/quantity/custom fields |
| DELETE | `/:characterId/inventory/:itemId` | Supprimer item (ou décrémenter quantity) |
| PUT | `/:characterId/sols` | Modifier solde sols |

### GET /:characterId/inventory — payload retourné

```js
{
  items: [
    {
      id, equipment_id, container, slot, quantity,
      custom_name, custom_desc, notes, custom_props,
      // dénormalisé depuis ref_equipment :
      ref_name, ref_family, ref_category, ref_weight,
      ref_location, ref_protection, ref_protection_shock,
      ref_malus_cat, ref_capacity
    }
  ],
  sols,
  total_weight,   // float
  ini_penalty,    // int
  threshold       // float = FOR * 3
}
```

### POST /:characterId/inventory — payload entrant

```js
{
  equipment_id,   // UUID ref_equipment (null si item manuel)
  container,      // 'Sac' | 'Ceinture' | 'Coffre' (défaut calculé si absent)
  slot,           // null par défaut
  quantity,       // défaut 1
  custom_name, custom_desc, notes   // optionnels
}
```

**Logique default container :**
1. Si `container` fourni → valider disponibilité → utiliser
2. Si absent : vérifier si character a un sac (`location='D'`) → 'Sac', sinon → 'Coffre'

### PUT /:characterId/inventory/:itemId — payload entrant

```js
{
  container,      // optionnel
  slot,           // optionnel — null pour déséquiper
  quantity,       // optionnel
  custom_name, custom_desc, notes, custom_props   // optionnels
}
```

**Ordre de traitement serveur (P13 — updated_at après le guard) :**
1. Guard `Object.keys(updates).length === 0` → 400
2. Si `slot` fourni et non null :
   a. Vérifier conflit de slot
   b. Forcer `container = 'Sac'`
   c. Vérifier disponibilité 'Sac'
3. Si `container` fourni : vérifier disponibilité
4. `updates.updated_at = db.fn.now()` ← APRÈS le guard
5. UPDATE + SELECT + broadcast

### DELETE /:characterId/inventory/:itemId

- Optionnel : `{ quantity: N }` → décrémente. Si quantité résultante ≤ 0 → DELETE.
- Par défaut : DELETE complet.

---

## 8. WebSocket

Événements à ajouter dans `shared/events.js` :

```js
INVENTORY_ADDED:   'inventory:added',    // serveur → room : item ajouté
INVENTORY_UPDATED: 'inventory:updated',  // serveur → room : item modifié
INVENTORY_REMOVED: 'inventory:removed',  // serveur → room : item supprimé
SOLS_UPDATED:      'sols:updated',       // serveur → room : solde sols modifié
```

**Scope broadcast :** room campagne entière (même pattern que `WOUND_ADDED`).
Payload minimal : `{ characterId, item }` / `{ characterId, itemId }` / `{ characterId, sols }`.

---

## 9. Composant React — InventoryPanel.jsx

**Fichier :** `client/src/character/InventoryPanel.jsx`

**Montage :** dans `CharacterWindow.jsx`, onglet `'materiel'`, **en dessous de `<WoundManager>`**.

**Props :** `{ characterId, canEdit }`

**State interne :** `items[]`, `sols`, `totalWeight`, `iniPenalty`, `threshold`

**Fetch :** `GET /api/char-sheet/:characterId/inventory` au montage.

**Affichage minimal :**
- En-tête : poids total, seuil (FOR×3), malus INI si > 0, solde sols
- Items groupés par container (Sac / Ceinture / Coffre)
- Par item : nom (custom_name || ref_name), quantité, slot si équipé
- Actions (si canEdit) : déplacer container, équiper/déséquiper, supprimer

**WS listeners :** écouter `INVENTORY_ADDED/UPDATED/REMOVED` → recharger via GET (pattern simple, pas d'update local partiel pour l'instant).

---

## 10. Pièges

| Code | Description |
|---|---|
| P13 | `updated_at = db.fn.now()` APRÈS le guard `Object.keys(updates).length === 0` |
| P46 | Route spécifique (`/sols`) déclarée AVANT route paramétrique (`/:itemId`) |
| P50 (analogie) | `InventoryPanel` ne stocke pas de copie locale de `charSkills` — pattern WoundManager : state interne, fetch propre |
| **PI1** | Container 'Sac' non disponible si character n'a pas d'item location='D' en inventaire → default 'Coffre' |
| **PI2** | Équipement (slot != null) → container forcé 'Sac'. Si 'Sac' indisponible → 400, ne pas silencieusement forcer 'Coffre' |
| **PI3** | Poids des items équipés (slot != null) EST compté dans l'encombrement — container reste 'Sac' |
| **PI4** | `calcEncumbrancePenalty` requiert la valeur FOR nette = `base_level + pc_modifier`. Lire depuis `char_attributes` WHERE `attr_id = 'FOR'` |
| **PI5** | Items manuels (`equipment_id = null`) : `ref_weight` null → exclus du calcul de poids. `custom_props` peut stocker un poids manuel si besoin futur |

---

## 11. Todo list — fonctionnalités reportées

- [ ] Split de pile (`POST /:characterId/inventory/:itemId/split`) — sprint 3
- [ ] Transfert entre personnages — chantier dédié (WS bidirectionnel, validation double, argent)
- [ ] UI custom_props — par type d'item (chargeur, batterie, programmes)
- [ ] Interface armure — masquage visuel items équipés (slot != null) dans la vue Sac
- [ ] Calcul malus_cat armure équipée — intégration dans jets Polaris
- [ ] Mille-feuille protection — calcul par zone (T/C/B/J) depuis items équipés
