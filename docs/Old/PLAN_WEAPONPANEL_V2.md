# PLAN — WeaponPanel v2 (CS2 + CS3)
> Session 123 — 2026-06-24
> Statut : Plan partiellement validé — vérifications serveur à compléter en session suivante

---

## Bugs traités

| ID | Titre | Priorité |
|---|---|---|
| **CS3** | Arme à deux mains dans chaque main → "Main Directrice" | Haute |
| **CS2** | Changement d'arme : menu déroulant absent/peu visible | Moyenne |

Cluster O — fichier principal : `client/src/character/WeaponPanel.jsx`

---

## Lecture code réalisée (Session 123)

| Fichier | Lu | Trouvé |
|---|---|---|
| `WeaponPanel.jsx` | ✅ | 487L — `WEAPON_SLOTS`, `getSlotInfo`, `handleEquip`, conflit logic |
| `ArmorWoundPanel.jsx` | ✅ | Layout 3 colonnes — référence design |
| `CharacterSheet.jsx` | ✅ | `handPref` L.121/L.279 — `identity.hand_pref` (R/L/A) |
| `CharacterWindow.jsx` | ✅ | Intégration WeaponPanel, props passées |
| `char-sheet.js` route GET inventory | ✅ | L.808-872 — retourne `{items, sols, total_weight, ini_penalty, threshold}` |
| `ref_equipment` schema (migration 48) | ✅ | Champ `location text(50)` — flags : `M`, `2M`, `Tr` séparés par `/` |

### Recherche externe réalisée
- Vagabond (Foundry VTT) : deux slots visuels, arme 2H scelle le secondaire → **pattern retenu**
- PF2e, WFRP4e, Roll20 : patterns analysés
- Pattern pro = slots visuels côte à côte + indicateur "2H" scellant le slot secondaire

---

## Données métier confirmées (code)

### Slots DB — inchangés
```
WEAPON_SLOTS = ['MG', 'MD', '2M', 'Tr']
```

### `getSlotInfo(ref_location)` — inchangé
```js
M          → type '1H',    defaultSlot 'MG'
2M + Tr    → type '2M_Tr', defaultSlot '2M'
2M seul    → type '2M',    defaultSlot '2M'
Tr seul    → type 'Tr',    defaultSlot 'Tr'
```

### Logique conflits `handleEquip` — inchangée, déjà correcte
```js
isTwoHand = slot === '2M' || slot === 'Tr'
conflictSlots = isTwoHand ? ['MG', 'MD', '2M', 'Tr'] : [slot, '2M', 'Tr']
```

### Trépied — identification (correction Session 123)
Un item trépied (le support physique) a :
- `ref_location` contenant `'Tr'` (même flag que les armes, séparé par `/`)
- `ref_family !== 'Armes'` (ce n'est pas une arme)

Détection côté client :
```js
const hasTrepied = items.some(i =>
  i.container !== 'Coffre' &&
  i.ref_family !== 'Armes' &&
  (i.ref_location || '').split('/').includes('Tr')
)
```
**⚠ À vérifier en session suivante** : confirmer `ref_family` exact des trépied en DB
(query `SELECT name, family, location FROM ref_equipment WHERE location LIKE '%Tr%'`)

### `hand_pref` — existe dans `char_sheet_identity.hand_pref`
- 'R' = droitier (Main Directrice = slot `MD`)
- 'L' = gaucher (Main Directrice = slot `MG`)
- 'A' = ambidextre (pas de malus secondaire)
- **Non transmis à WeaponPanel actuellement** → solution : ajouter au GET inventory

---

## Plan technique

### Fichiers à modifier

| Fichier | Nature |
|---|---|
| `server/src/routes/character/char-sheet.js` | +4 lignes (ajout `hand_pref` dans réponse GET inventory) |
| `client/src/character/WeaponPanel.jsx` | Refonte rendu — logique métier inchangée |
| `client/src/character/CharacterWindow.jsx` | **Aucun changement** |

---

### 1. Server — `char-sheet.js` — GET inventory (L.808-872)

**Après L.812** (après `const sheet = await db('char_sheet')...`), ajouter :
```js
const identity = await db('char_sheet_identity')
  .where({ char_sheet_id: sheet.id })
  .first()
```

**⚠ Vérifier en session** : le nom exact de la table `char_sheet_identity`
(chercher dans les migrations ou dans le code `saveIdentity`)

**Modifier réponse L.864** :
```js
res.json({
  items,
  sols:         sheet.sols,
  total_weight: totalWeight,
  ini_penalty:  iniPenalty,
  threshold,
  hand_pref:    identity?.hand_pref || 'R',   // AJOUT
})
```

**Ce qui ne change pas** : toute la logique items, poids, seuil, pénalité INI

---

### 2. Client — `WeaponPanel.jsx` — Refonte rendu

#### A. Nouveaux states (remplacent `equipItemId`, `equipSlot`)

```js
const [handPref,    setHandPref]    = useState('R')
const [equipDir,    setEquipDir]    = useState('')    // weapon id pour colonne DIRECTRICE
const [equipSec,    setEquipSec]    = useState('')    // weapon id pour colonne SECONDAIRE
const [equip2MId,   setEquip2MId]   = useState('')    // weapon id pour section DEUX MAINS
const [equip2MSlot, setEquip2MSlot] = useState('2M')  // '2M' ou 'Tr'
```

Supprimer : `equipSlot`, `equipItemId`

#### B. Lecture `hand_pref` dans le useEffect existant

```js
api.get(`/char-sheet/${characterId}/inventory`)
  .then(res => {
    if (!cancelled) {
      setItems(res.data.items || [])
      setHandPref(res.data.hand_pref || 'R')  // AJOUT
    }
  })
```

#### C. Dérivées (memo/computed)

```js
const isAmbi  = handPref === 'A'
const dirSlot = handPref === 'L' ? 'MG' : 'MD'
const secSlot = handPref === 'L' ? 'MD' : 'MG'

const weaponDir = equippedWeapons.find(w => w.slot === dirSlot)
const weaponSec = equippedWeapons.find(w => w.slot === secSlot)
const weapon2M  = equippedWeapons.find(w => w.slot === '2M' || w.slot === 'Tr')

const hasTrepied = items.some(i =>
  i.container !== 'Coffre' &&
  i.ref_family !== 'Armes' &&
  (i.ref_location || '').split('/').includes('Tr')
)

// available1H : armes à une main seulement
const available1H = availableWeapons.filter(i =>
  getSlotInfo(i.ref_location).type === '1H'
)

// available2M : armes 2M + 2M_Tr + Tr pur (correction — Tr pur était manquant)
const available2M = availableWeapons.filter(i =>
  ['2M', '2M_Tr', 'Tr'].includes(getSlotInfo(i.ref_location).type)
)
```

#### D. Handler équipement — paramétrique

```js
const handleEquipItem = useCallback(async (itemId, slot) => {
  if (!itemId || !slot) return
  const isTwoHand     = slot === '2M' || slot === 'Tr'
  const conflictSlots = isTwoHand ? ['MG', 'MD', '2M', 'Tr'] : [slot, '2M', 'Tr']
  const conflicts     = equippedWeapons.filter(w => w.id !== itemId && conflictSlots.includes(w.slot))
  setEquipping(true)
  try {
    for (const c of conflicts) {
      const r = await api.put(`/char-sheet/${characterId}/inventory/${c.id}`, { slot: null })
      setItems(prev => prev.map(i => i.id === c.id ? r.data.item : i))
    }
    const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot })
    setItems(prev => prev.map(i => i.id === itemId ? res.data.item : i))
    setEquipDir(''); setEquipSec(''); setEquip2MId('')  // reset les 3 forms
    setErrors(prev => { const n = { ...prev }; delete n.equip; return n })
    onInventoryMutated()
  } catch (err) {
    setErrors(prev => ({ ...prev, equip: err.response?.data?.error?.message || 'Erreur équipement' }))
  } finally {
    setEquipping(false)
  }
}, [characterId, equippedWeapons, onInventoryMutated])

const handleSelect2M = useCallback((itemId) => {
  setEquip2MId(itemId)
  if (!itemId) { setEquip2MSlot('2M'); return }
  const item = available2M.find(i => i.id === itemId)
  setEquip2MSlot(getSlotInfo(item?.ref_location).defaultSlot || '2M')
}, [available2M])
```

Supprimer : `handleEquip()`, `handleSelectWeapon()`

#### E. Sous-composant interne `WeaponCard`

**Extraire avant de modifier le layout** pour isoler la logique ammo/reload existante.

```jsx
function WeaponCard({ weapon, canEdit, compatAmmos, ammoSelected, onAmmoSelect,
                      onReload, onUnequip, errors }) {
  // JSX exact du map() actuel (weaponHeader + statsRow + ammoSection + errorMsg)
  // Aucune logique ne change — simple extraction
}
```

#### F. Layout JSX — nouvelle structure

```
Règle : weapon2M présent  → afficher DEUX MAINS only, masquer DIR/SEC
         weapon2M absent   → afficher DIR/SEC + section DEUX MAINS vide
```

**Section DIR / SEC (si pas de weapon2M) :**
```jsx
<div style={twoColGrid}>
  {/* Colonne DIRECTRICE */}
  <div style={col}>
    <div style={colHeader}>
      {isAmbi ? 'MAIN GAUCHE' : 'MAIN DIRECTRICE'}
    </div>
    {weaponDir
      ? <WeaponCard weapon={weaponDir} ... />
      : canEdit && available1H.length > 0 && (
          <select value={equipDir} onChange={e => setEquipDir(e.target.value)}>
            <option value="">— Équiper —</option>
            {available1H.map(...)}
          </select>
          <button onClick={() => handleEquipItem(equipDir, dirSlot)} disabled={!equipDir || equipping}>
            Équiper
          </button>
        )
    }
  </div>

  {/* Colonne SECONDAIRE */}
  <div style={col}>
    <div style={colHeader}>
      {isAmbi ? 'MAIN DROITE' : 'MAIN SECONDAIRE'}
      {!isAmbi && weaponSec && <span style={malusNote}>−5</span>}
    </div>
    {weaponSec
      ? <WeaponCard weapon={weaponSec} ... />
      : canEdit && available1H.length > 0 && (
          <select value={equipSec} onChange={e => setEquipSec(e.target.value)}>
            <option value="">— Équiper —</option>
            {available1H.map(...)}
          </select>
          <button onClick={() => handleEquipItem(equipSec, secSlot)} disabled={!equipSec || equipping}>
            Équiper
          </button>
        )
    }
  </div>
</div>
```

**Section DEUX MAINS (toujours visible en bas) :**
```jsx
<div style={sectionTwoHands}>
  <div style={sectionHeader}>DEUX MAINS / TRÉPIED</div>
  {weapon2M
    ? <>
        <WeaponCard weapon={weapon2M} ... />
        {weapon2M.slot === 'Tr' && !hasTrepied && (
          <div style={warning}>⚠ Trépied absent du sac — malus actif</div>
        )}
        {weapon2M.slot === '2M' && hasTrepied &&
         getSlotInfo(weapon2M.ref_location).type === '2M_Tr' && (
          <div style={info}>Trépied disponible dans le sac</div>
        )}
      </>
    : canEdit && available2M.length > 0 && (
        <>
          <select value={equip2MId} onChange={e => handleSelect2M(e.target.value)}>
            <option value="">— Équiper arme 2 mains / trépied —</option>
            {available2M.map(...)}
          </select>
          {equip2MId && getSlotInfo(available2M.find(i=>i.id===equip2MId)?.ref_location).type === '2M_Tr' && (
            <select value={equip2MSlot} onChange={e => setEquip2MSlot(e.target.value)}>
              <option value="2M">2 mains (sans trépied)</option>
              <option value="Tr">Trépied</option>
            </select>
          )}
          <button onClick={() => handleEquipItem(equip2MId, equip2MSlot)}
                  disabled={!equip2MId || equipping}>
            Équiper
          </button>
        </>
      )
  }
</div>
```

**Labels ambi** : `isAmbi = true` → col gauche = "MAIN GAUCHE" (slot `MD` par défaut), col droite = "MAIN DROITE". Pas de badge −5.

---

## Ce qui ne change PAS

- Clés slot DB : `MG`, `MD`, `2M`, `Tr` → **aucune migration**
- `WEAPON_SLOTS`, `SLOT_LABELS`, `getSlotInfo` → inchangés
- `handleUnequip`, `handleReload`, `availableAmmoFor`, `ammoNameForRef` → inchangés
- `availableWeapons`, `equippedWeapons` useMemo → inchangés
- Routes API côté serveur → inchangées (ajout d'un seul champ dans réponse existante)
- `CharacterWindow.jsx` → inchangé

---

## Vérifications à faire EN DÉBUT DE SESSION suivante (avant de coder)

1. **Nom table identity** : chercher `char_sheet_identity` dans les migrations ou `char-sheet.js`
   → confirmer le nom exact avant d'écrire la query serveur
2. **`ref_family` des trépied** : query DB ou chercher dans migrations
   → confirmer que les trépied ont `ref_family !== 'Armes'`
3. **Trépied pur (type 'Tr')** : vérifier s'il existe des armes avec `location = 'Tr'` SANS `2M`
   → si oui, confirmer que `available2M` incluant le type `'Tr'` est correct
4. **Validation slot serveur** : lire PUT inventory `char-sheet.js` L.1101+
   → vérifier s'il y a un guard serveur sur les slots autorisés (important avant de changer la logique client)

---

## Ordre d'implémentation

1. Vérifications préliminaires (liste ci-dessus)
2. Server : `hand_pref` dans GET inventory response (+4 lignes)
3. WeaponPanel : `handPref` state + lecture `res.data.hand_pref`
4. WeaponPanel : extraire `WeaponCard` sous-composant (sans changer le layout) → SR → tester ammo/reload
5. WeaponPanel : nouveau layout (colonnes DIR/SEC + section DEUX MAINS)
6. WeaponPanel : remplacer handlers
7. SR + test scénarios V1–V10

---

## Scénarios de validation (V1–V10)

| V | Scénario | Résultat attendu |
|---|---|---|
| V1 | Droitier, arme 1H équipée MD | Badge "MAIN DIRECTRICE" colonne droite |
| V2 | Gaucher, arme 1H équipée MG | Badge "MAIN DIRECTRICE" colonne gauche |
| V3 | Arme 2M équipée | Colonnes DIR/SEC masquées, DEUX MAINS full-width |
| V4 | Arme 2M_Tr en slot Tr + trépied dans sac | Info "Trépied disponible" |
| V5 | Arme 2M_Tr en slot Tr + pas de trépied | ⚠ "Trépied absent" |
| V6 | Équiper 2H quand 1H en DIR et SEC | Les deux déséquipés auto |
| V7 | Équiper 1H en DIR quand 2H équipé | 2H déséquipé auto |
| V8 | Ambidextre | Colonnes "MAIN GAUCHE / DROITE", pas de badge −5 |
| V9 | Rechargement arme slot DIR | Inchangé (régression check ammo/reload) |
| V10 | CS2 — slot vide | Dropdown "— Équiper —" visible directement dans la colonne |

---

## Bugs Cluster O restants (non traités dans ce plan)

| ID | Titre | Fichier principal |
|---|---|---|
| CS1 | Description arme manquante | `ref_description` absent SELECT inventory — sprint séparé |
| CS4 | Catégorie "Techniques" compétences | `SkillsPanel.jsx` + DB `ref_skills` |
| CS5 | Compétence réservée (X) : coût ouverture | `SkillsPanel.jsx` logique achat |
| CS6 | Force Polaris = Avantage | DB `ref_advantages`/`ref_mutations` |
