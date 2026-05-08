# JOURNALTAMPON — Mémoire externe session 53
> Rédigé par Claude Code après lecture de 4 plans + fichiers code réels
> Ne pas versionner. Sert de scratch de session.

---

## TL;DR — Ce que l'on veut faire

Remplacer `WoundManager` (tableau de blessures seul) dans l'onglet **Matériel** par un composant fusionné **ArmorWoundPanel** qui affiche :
- La silhouette SVG de ICON.svg, coloriée par la pire blessure par localisation
- 6 blocs de localisation (tête / corps / bras G & D / jambes G & D), chacun avec :
  - 1 à 3 dropdowns pour sélectionner une armure équipée (depuis char_inventory)
  - Les stats de l'armure : ETQ / PRT / Malus
  - La grille de blessures (5 cases par gravité — logique extraite de WoundManager)
- 2 panels conteneurs : SAC À DOS + CEINTURE avec leurs stats

Design de référence : `docs/Character/DESIGN_CHARv2.png`

---

## Lecture des 4 plans — Synthèse et tri

### Ce qui vient de PLAN_ARMUREv1.md (le plus proche du design)
- Silhouette = couleur des localisations selon pire blessure (via WoundManager)
- Chaque localisation : 1–3 couches armure + grille blessures SOUS les couches
- SAC / CEINTURE : stats Contenance + Étanchéité + Malus
- Format stats armure : `ETQ: X  PRT: A / -8`
- Règle "1+S+S" vérifiée côté serveur (déjà en place dans char-sheet.js session 51)
- **À retenir** : scope minimal, fidèle au design, réutilise WoundManager tel quel

### Ce qui vient de PLAN_chantier10.md (sprint 2, déjà livré)
- La migration 50 (char_inventory) et toutes les routes sont déjà en production ✅
- Le moteur mille-feuille (FinalProt = max + reste/2) est spécifié mais pas implémenté
- malusMap : S=0 / A=-2 / B=-3 / C=-4 / D=-6 — à mettre dans armorConstants.js
- **À retenir** : toute l'infra BDD + API est prête. Le mille-feuille est hors scope sprint.

### Ce qui vient de PLAN_ARMUREBLESSURE.md (5 doutes — résolus ci-dessous)
- Approche bien construite, mais posait des questions sur des fichiers non lus
- Tous les doutes sont maintenant résolus (voir section Doutes ci-dessous)
- **À retenir** : WoundCheckboxGrid = extraire la grille du WoundManager existant

### Ce qui vient de PLAN_EQUIPMENT.md (spec technique exhaustive)
- Trop large pour ce sprint (armes, munitions, DSL parser, reload)
- Formules mille-feuille présentes et cohérentes avec PLAN_chantier10
- **À retenir** : hors scope sprint. Consulter si on intègre les calculs plus tard.

---

## Résolution des 5 doutes de PLAN_ARMUREBLESSURE

### Doute 1 — woundConstants.js ✅ RÉSOLU (fichier lu)
```js
WOUND_LOCATIONS  = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']
WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']
WOUND_MAX_COUNTS = { tete: { legere:3, moyenne:3, grave:2, critique:2, mortelle:1 }, ... }
WOUND_PENALTIES  = { legere:-1, moyenne:-3, grave:-5, critique:-10, mortelle:-20 }
```
`SEVERITY_COLORS` et `LOCATION_LABELS` ne sont PAS dans woundConstants.js — ils sont définis
localement dans WoundManager.jsx :
```js
SEVERITY_COLORS = { legere:'#FFD700', moyenne:'#FFA500', grave:'#FF6B6B', critique:'#FF0000', mortelle:'#8B0000' }
LOCATION_LABELS = { tete:'Tête', corps:'Corps', bras_droit:'Bras D', bras_gauche:'Bras G', ... }
```
→ Les exporter depuis woundConstants.js dans cette session, ou les répliquer dans ArmorWoundPanel.

### Doute 2 — socket dans CharacterWindow ✅ RÉSOLU (fichier lu)
`socket` **n'est pas disponible** dans CharacterWindow.jsx (pas de prop, pas d'import).
Pattern V1 confirmé : fetch REST propre, pas de WS listeners. À respecter pour ce sprint.
Conséquence : pas de sync temps réel sur les blessures/armures — même comportement que WoundManager et InventoryPanel actuels.

### Doute 3 — Mapping localisations ✅ RÉSOLU
Deux conventions coexistent, mapping obligatoire :
```
BDD / woundConstants    SVG (ICON.svg)
─────────────────────   ────────────────
tete                 → head
corps                → body
bras_gauche          → left-arm
bras_droit           → right-arm
jambe_gauche         → left-leg
jambe_droite         → right-leg
```
Convention BDD = source de vérité. Le SVG ne sert qu'à la coloration visuelle.

### Doute 4 — Promotion blessures ✅ RÉSOLU (P49)
Oui, tout POST/PUT peut déclencher `promoted=true`. Pattern WoundManager (déjà correct) :
```js
if (res.data.promoted) {
  const fresh = await api.get(`/char-sheet/${characterId}/wounds`)
  setWounds(fresh.data.wounds || [])
}
```
À reproduire intégralement dans le nouveau composant. Ne pas optimiser.

### Doute 5 — Calcul pire blessure par localisation ✅ RÉSOLU
Calculer dans le composant parent (ArmorWoundPanel) via useMemo, passer en props à la silhouette :
```js
const worstByLocation = useMemo(() => {
  const result = {}
  for (const loc of WOUND_LOCATIONS) {
    const here = wounds.filter(w => w.location === loc)
    if (!here.length) { result[loc] = null; continue }
    const idx = Math.min(...here.map(w => WOUND_SEVERITIES.indexOf(w.severity)))
    result[loc] = WOUND_SEVERITIES[idx]   // sévérité la plus grave = index le plus élevé
  }
  return result
}, [wounds])
```
Attention : "pire" = sévérité la plus haute dans le tableau. `indexOf('mortelle') = 4` > `indexOf('legere') = 0`.
Donc `Math.max`, pas `Math.min` :
```js
const idx = Math.max(...here.map(w => WOUND_SEVERITIES.indexOf(w.severity)))
```

---

## Découvertes critiques après lecture des fichiers serveur

### VALID_SLOTS (char-sheet.js ligne 757)
```js
const VALID_SLOTS = ['T', 'C', 'B', 'J', 'C/B/J', 'T/C/B/J']
```
- 'B' = les deux bras (pas de BD/BG distincts)
- 'J' = les deux jambes (pas de JD/JG distincts)
- Pas de slot asymétrique dans le système actuel

### ref_equipment.location — Format réel (JOURNALBDD.md ligne 266)
```
"Combinaisons de T/C/B/J/D/Ce (ex: 'T/C/B/J', 'D', 'Ce')"
```
- Codes : T=Tête, C=Corps, B=Bras(les deux), J=Jambes(les deux), D=Dos, Ce=Ceinture
- Plusieurs codes séparés par '/' → parser : `ref_location.split('/').includes(code)`
- D et Ce = containers (pas dans VALID_SLOTS, dans VALID_CONTAINERS)

### Conflit slot — logique serveur actuelle
```js
// POST et PUT /inventory/:itemId — char-sheet.js
const conflict = await db('char_inventory')
  .where({ character_id: characterId, slot: updates.slot })
  .whereNot({ id: itemId })
  .first()
if (conflict) throw new AppError(409, 'Slot déjà occupé')
```
**STRICT : 1 seul item par slot, point.** Pas de logique "1+S+S" implémentée.
PLAN_ARMUREv1 affirmait "✅ Implémentée" — c'était une erreur de l'agent.

### Conséquence sur le design à 6 panels
WOUND_LOCATIONS = 6 emplacements (bras_gauche, bras_droit, jambe_gauche, jambe_droite séparés)
VALID_SLOTS = 4 codes armure (T, C, B, J)

→ BRAS G et BRAS D partageraient le même slot='B' (même item affiché dans les deux panels)
→ JAMBE G et JAMBE D partageraient le même slot='J'

### GET /inventory — champs disponibles ✅ suffisants
```
ref_name, ref_family, ref_category, ref_weight, ref_location,
ref_protection, ref_protection_shock, ref_malus_cat, ref_capacity
```
- `ref_protection` = ETQ (protection physique)
- `ref_protection_shock` = PRT (protection choc)
- `ref_malus_cat` = S/A/B/C/D → converti via malusMap côté client
- Pas besoin de modifier le serveur pour l'affichage

---

## Ce qui existe déjà et est réutilisable

| Élément | Fichier | Statut |
|---|---|---|
| Routes inventaire | `server/src/routes/character/char-sheet.js` | ✅ en prod (session 51) |
| Table char_inventory | migration 50 | ✅ déployée |
| ref_equipment 636 items | migration 48 + seed | ✅ peuplée |
| Règle "1+S+S" | char-sheet.js PUT inventory | ✅ serveur |
| Logique blessures | WoundManager.jsx | ✅ à décomposer |
| Constants blessures | shared/woundConstants.js | ✅ complet |
| Silhouette SVG | docs/ICON.svg | ✅ 6 paths nommés |
| calcWoundPenalty | server/lib/charStats.js | ✅ |
| calcEncumbrancePenalty | server/lib/charStats.js | ✅ |

---

## Architecture cible du composant

```
ArmorWoundPanel.jsx  (remplace WoundManager dans onglet Matériel)
│
├── state : wounds[], inventory[], loading
├── load() : GET /wounds + GET /inventory en parallèle
│
├── <SilhouettePanel wounds={wounds} />
│   └── ICON.svg inline — fill par localisation selon worstByLocation
│
├── <ContainerPanel type="D" items={inventory} onEquip onUnequip />   ← SAC À DOS
├── <ContainerPanel type="Ce" items={inventory} onEquip onUnequip />  ← CEINTURE
│
└── {WOUND_LOCATIONS.map(loc =>
     <LocationPanel
       key={loc}
       location={loc}
       items={inventory}           ← filtrés dans LocationPanel par slot == loc
       wounds={wounds}             ← filtrés dans LocationPanel par location == loc
       onEquip onUnequip onWoundToggle
     />
   )}
```

### LocationPanel (1 par localisation)
```
<LocationPanel>
  ├── Header : nom localisation + couleur pire blessure
  ├── [dropdown armure couche 1]   → PUT inventory/:itemId {slot: loc, container: 'Sac'}
  ├── [dropdown armure couche 2]   → idem (filtre catégorie 'S' uniquement)
  ├── [dropdown armure couche 3]   → idem
  └── Grille blessures (reprise logique WoundManager handleBoxClick)
```

---

## Règles métier armure à implémenter côté client (affichage uniquement)

### malusMap (à mettre dans shared/armorConstants.js)
```js
export const ARMOR_CATEGORY_MALUS = { S: 0, A: -2, B: -3, C: -4, D: -6 }
```

### Filtrage dropdowns
- **Couche 1** : items où `ref_equipment.location` contient le code de la localisation
  - Codes : tete='T', corps='C', bras_droit='B', bras_gauche='B', jambe_droite='J', jambe_gauche='J'
  - Source : `ref_equipment.location` = chaîne type 'T/C/B/JD' — split('/') pour parser
- **Couches 2 et 3** : même filtre + catégorie = 'S' uniquement (règle "1+S+S")
- **SAC / CEINTURE** : location = 'D' ou 'Ce' respectivement, 1 objet max

### Stats affichées par couche (pas de calcul client)
Depuis `inventory item JOIN ref_equipment` (déjà renvoyé par GET /inventory) :
- ETQ : `ref_equipment.protection_phys` (ou champ custom_props.etq si override)
- PRT : `ref_equipment.protection_choc`
- Malus : `ref_equipment.malus_cat` → converti via ARMOR_CATEGORY_MALUS

---

## Modèle mental exact des dropdowns (validé Saar session 53)

Le dropdown d'un panel localisation N'AFFICHE PAS les items déjà équipés au slot.
Il affiche les items de l'inventaire **disponibles** pour cette localisation :
```
items.filter(i => {
  if (!i.ref_location) return false
  const codes = i.ref_location.split('/')
  return codes.includes(locationCode) && i.container !== 'Coffre'
})
```
Résultat : les deux panels Bras G et Bras D proposent exactement les mêmes choix
(tous les items avec ref_location contenant 'B', hors Coffre).
Si l'user équipe depuis Bras G → slot='B' → l'item disparaît du dropdown Bras G.
Bras D propose toujours les mêmes items (dont le même item, mais il est déjà à slot='B').
PUT avec slot déjà pris → 409 côté serveur → UI signale "slot occupé".
C'est le comportement attendu.

L'item actuellement équipé (slot='B') est affiché en header du panel (avec stats ETQ/PRT/Malus).
Le dropdown n'est pour que pour changer ce qui est équipé.

---

## Décision architecture — Multi-couche (1+S+S)

### Sprint 53 (ce sprint) : couche unique
**Décision : multi-couche hors scope.**
- La modification du serveur ajoute du risque sans valeur immédiate pour les tests
- La couche unique est jouable et valide l'architecture complète
- Zéro changement serveur pour ce sprint

### Sprint suivant : architecture multi-couche documentée

**Changement serveur requis :** `char-sheet.js` — remplacer le conflit check dans POST et PUT

```js
// ACTUEL (1 per slot strict)
const conflict = await db('char_inventory')
  .where({ character_id: characterId, slot: updates.slot })
  .whereNot({ id: itemId })
  .first()
if (conflict) throw new AppError(409, 'Slot déjà occupé')

// FUTUR (1+S+S : 1 majeur + 2 supplémentaires catégorie S)
const existingAtSlot = await db('char_inventory')
  .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
  .where({ 'char_inventory.character_id': characterId, 'char_inventory.slot': updates.slot })
  .whereNot({ 'char_inventory.id': itemId })
  .select('char_inventory.id', 'ref_equipment.malus_cat')

if (existingAtSlot.length >= 3) {
  throw new AppError(409, 'Slot complet — maximum 3 couches par localisation')
}

// Récupérer la catégorie du nouvel item
const newItemRef = await db('char_inventory')
  .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
  .where({ 'char_inventory.id': itemId })
  .select('ref_equipment.malus_cat')
  .first()
const newCat = newItemRef?.malus_cat ?? null

const existingNonS = existingAtSlot.filter(i => i.malus_cat && i.malus_cat !== 'S')
if (newCat && newCat !== 'S' && existingNonS.length >= 1) {
  throw new AppError(409, 'Slot déjà occupé par une armure principale (règle 1+S+S)')
}
```

**Changement UI requis :**
- Chaque panel localisation : afficher jusqu'à 3 "couches" (items avec même slot)
- Dropdown conditionnel couches 2/3 : filter supplémentaire `ref_malus_cat === 'S'` (ou null)
- Bouton "+" pour ajouter une couche (actif si < 3 items et règle 1+S+S OK)
- Affichage mille-feuille = FinalProt + FinalChoc calculés localement sur les 3 couches

**Pas de migration nécessaire** — c'est uniquement une modification du check API.

---

## Périmètre — DÉCIDÉ session 53

### Dans ce sprint (FINAL)
1. `shared/armorConstants.js` — malusMap S/A/B/C/D + LOCATION_TO_SLOT
2. `client/src/character/SilhouettePanel.jsx` — SVG inline colorié par pire blessure
3. `client/src/character/LocationPanel.jsx` — 1 panel localisation (armor dropdown + stats + grille blessures)
4. `client/src/character/ContainerPanel.jsx` — 1 panel SAC ou CEINTURE avec stats
5. `client/src/character/ArmorWoundPanel.jsx` — assemblage, fetch wounds + inventory, state
6. `client/src/character/CharacterWindow.jsx` — remplacer `<WoundManager>` par `<ArmorWoundPanel>`
   InventoryPanel reste EN DESSOUS, inchangé.
   WoundManager.jsx reste dans le repo (ne pas supprimer — utilisé potentiellement ailleurs).

### Hors scope (chantiers suivants)
- Multi-couche 1+S+S — architecture documentée ci-dessus, sprint dédié
- Calcul mille-feuille (FinalProt / FinalChoc)
- Module Armes (HAND_MAIN/HAND_OFF) — Chantier 11 étape 2
- WS listeners CharacterWindow — V2

### Zéro changement serveur ce sprint
Toutes les routes sont en place. Aucune migration.

---

## Pièges spécifiques à ce chantier

**P_ARM1 — codes localisation dans ref_equipment**
`ref_equipment.location` = chaîne délimitée par '/' : ex 'T', 'C/B', 'T/C/B/JD'
Toujours `location.split('/').includes(code)` — jamais `===`

**P_ARM2 — slot dans char_inventory ≠ localisation woundConstants**
`char_inventory.slot` stocke les valeurs de `ref_equipment.location` (ex: 'T', 'C', 'B', 'J')
`WOUND_LOCATIONS` utilise 'tete', 'corps', 'bras_droit', etc.
Mapping nécessaire dans les deux sens.

**P_ARM3 — Container forcé 'Sac' pour les équipements (PI2)**
Lors d'un équipement : `container='Sac'` obligatoire. Si Sac indisponible → 400 serveur.
Ne pas surprendre l'utilisateur : vérifier `isContainerAvailable('Sac')` avant d'envoyer.

**P_ARM4 — Couche 2/3 filtrée sur catégorie 'S'**
Un seul item de catégorie non-S par zone. Le filtre couche 2/3 doit exclure A/B/C/D.
Serveur valide (règle "1+S+S") mais le dropdown doit déjà filtrer pour éviter un 400.

**P_ARM5 — `woundPenalty` dans GET /wounds**
Depuis session 52, GET /wounds retourne `{ wounds, wound_penalty }`.
Utiliser `wound_penalty` du serveur plutôt que recalculer localement.

---

## Fichiers à lire avant de coder

1. `client/src/character/InventoryPanel.jsx` — comprendre le pattern fetch + la structure items retournée
2. `server/src/routes/character/char-sheet.js` — vérifier la réponse exacte de GET /inventory (quels champs ref_equipment sont joints)
3. `shared/woundConstants.js` — déjà lu ✅
4. `client/src/character/WoundManager.jsx` — déjà lu ✅
5. `docs/ICON.svg` — déjà lu ✅

---

## Ordre d'implémentation — FINAL (100% confiant, session 53)

### Étape 0 — 2 micro-modifications serveur

**A. char-sheet.js** — `getItemWithRef` + GET /inventory SELECT :
ajouter `'ref_equipment.waterproof as ref_waterproof'` après `ref_capacity` dans les deux endroits.

**B. shared/woundConstants.js** — ajouter :
```js
export const SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000',
}
```

### Étape 1 — shared/armorConstants.js (nouveau)
```js
export const ARMOR_CATEGORY_MALUS = { S: 0, A: -2, B: -3, C: -4, D: -6 }
export const LOCATION_TO_SLOT = {
  tete:'T', corps:'C', bras_gauche:'B', bras_droit:'B', jambe_gauche:'J', jambe_droite:'J',
}
export const LOCATION_TO_SVG = {
  tete:'head', corps:'body', bras_gauche:'left-arm', bras_droit:'right-arm',
  jambe_gauche:'left-leg', jambe_droite:'right-leg',
}
export const LOCATION_LABELS = {
  tete:'Tête', corps:'Corps', bras_gauche:'Bras G', bras_droit:'Bras D',
  jambe_gauche:'Jambe G', jambe_droite:'Jambe D',
}
```

### Étape 2 — SilhouettePanel.jsx (nouveau)
- SVG inline (paths copiés depuis docs/ICON.svg)
- Props : `wounds[]`
- `worstByLocation` useMemo → pour chaque location, `Math.max(...wounds.filter(loc).map(indexOf(severity)))`
- `fill` par path : `SEVERITY_COLORS[worstSev]` ou `'#D9F7FF'` si aucune blessure

### Étape 3 — LocationPanel.jsx (nouveau)
Props : `location`, `items[]`, `wounds[]`, `characterId`, `canEdit`, `onInventoryChange`, `onWoundsReload`

Logique armor slot :
```js
const slotCode = LOCATION_TO_SLOT[location]
const equipped = items.find(i => i.slot === slotCode)
const available = items.filter(i =>
  i.ref_location?.split('/').includes(slotCode) &&
  i.container !== 'Coffre' &&
  i.slot === null
)
```
- Si `equipped` : afficher `custom_name||ref_name | ETQ:ref_protection | PRT:ref_protection_shock | Malus:ARMOR_CATEGORY_MALUS[ref_malus_cat]` + bouton ×
- Sinon : `<select>` avec `available` + "— Aucun —"
- Équiper : `PUT /char-sheet/:id/inventory/:itemId {slot:slotCode}` → `onInventoryChange(res.data.item)`
- Déséquiper : `PUT {slot:null}` → `onInventoryChange(res.data.item)`

Logique blessures : logique WoundManager handleBoxClick, filtrée sur `location`
- `lastAddedWoundId` local state (indicateur choc visuel)
- POST/PUT/DELETE + promoted reload via `onWoundsReload()` (GET /wounds complet)

### Étape 4 — ContainerPanel.jsx (nouveau)
Props : `type` ('D' ou 'Ce'), `label`, `items[]`

```js
const containerItems = items.filter(i => i.ref_location === type) // EXACT MATCH
```
- Affiche premier item trouvé : nom + Contenance:ref_capacity + Étanchéité:ref_waterproof + Malus
- Si aucun : "Aucun [label] dans l'inventaire"

### Étape 5 — ArmorWoundPanel.jsx (nouveau)
Props : `characterId`, `canEdit`, `isGm`

State : `wounds[]`, `inventory[]`, `loading`

Fetch parallèle (try/catch indépendants, non-bloquants) :
```js
const [wRes, invRes] = await Promise.allSettled([
  api.get(`/char-sheet/${characterId}/wounds`),
  api.get(`/char-sheet/${characterId}/inventory`),
])
```

Callbacks :
- `handleInventoryChange(updatedItem)` → `setInventory(prev => prev.map(i => i.id===updatedItem.id ? updatedItem : i))`
- `handleWoundsReload()` → GET /wounds complet → setWounds

Layout (3 colonnes inline styles) :
```
Col gauche    |  Col centre          | Col droite
TÊTE         |  Silhouette SVG      | (vide — futur armes)
BRAS G       |  SAC À DOS           | BRAS D
JAMBE G      |  CORPS               | JAMBE D
             |  CEINTURE            |
```

### Étape 6 — CharacterWindow.jsx (modifié, 3 lignes)
Remplacer `<WoundManager>` par `<ArmorWoundPanel>`, garder `<InventoryPanel>` dessous.
WoundManager.jsx : NE PAS supprimer.

---

## Champs GET /inventory disponibles (après étape 0A)
```
id, equipment_id, container, slot, quantity, custom_name, custom_desc, notes, custom_props
ref_name, ref_family, ref_category, ref_weight, ref_location,
ref_protection, ref_protection_shock, ref_malus_cat, ref_capacity, ref_waterproof
```

## Points de vigilance pendant le code
- ContainerPanel filtre `=== 'D'` et `=== 'Ce'` EXACT (pas split — confirmé isContainerAvailable)
- LocationPanel filtre armor par `split('/').includes(slotCode)` + `slot === null`
- worstByLocation : Math.max sur indexOf → plus grave = index plus élevé dans WOUND_SEVERITIES
- Promoted reload : toujours GET /wounds complet si `res.data.promoted === true` (P49)
- canEdit guard sur équipements ET blessures
- Sac indisponible → serveur retourne 400 → catch + message utilisateur
- Aucun changement de migration nécessaire
