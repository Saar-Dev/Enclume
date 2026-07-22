# SYSTEME/BLESSURES.md — Blessures, armures, malus Polaris
> Mis à jour : 2026-07-22 — autorité serveur du mille-feuille ; carence retirée.
> Source : SYSTEME.md §16
> Lire pour : wounds, ArmorWoundPanel, LocationPanel, mille-feuille, calculs P51

---

## Architecture générale

```
shared/woundConstants.js  — WOUND_LOCATIONS / SEVERITIES / MAX_COUNTS / PENALTIES / SEVERITY_COLORS
shared/armorConstants.js  — ARMOR_CATEGORY_MALUS / LOCATION_TO_SLOT / SLOT_TO_REF_LOCATION / LOCATION_TO_SVG / LOCATION_LABELS
server/src/lib/charStats.js — calcWoundPenalty / calcEncumbrancePenalty / calcResistanceArmure
server/src/lib/damageService.js — localisation, armure, dégâts nets, sévérité, blessure et choc
```

## Constantes blessures (woundConstants.js)

```javascript
WOUND_LOCATIONS = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']

WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']

WOUND_PENALTIES = { legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: -20 }
// calcWoundPenalty retourne le minimum (pire seul retenu)

SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000'
}
```

### WOUND_MAX_COUNTS — nombre max de blessures par localisation

| Localisation | Légère | Moyenne | Grave | Critique | Mortelle |
|---|---|---|---|---|---|
| Tête | 3 | 3 | 2 | 2 | 1 |
| Corps | 4 | 3 | 3 | 2 | 2 |
| Bras D/G | 3 | 3 | 2 | 2 | 1 |
| Jambe D/G | 3 | 3 | 2 | 2 | 1 |

## Composants client — onglet Matériel (CharacterWindow)

```
CharacterWindow
└── ArmorWoundPanel          — orchestrateur : charge wounds + inventory, layout 3 colonnes
    ├── LocationPanel × 6    — une localisation (Tête/Corps/Bras G/D/Jambe G/D)
    │   ├── armures équipées (multi-couches, mille-feuille ETQ/PRT/malus_cat)
    │   ├── select ajout couche (filtré par refCode + container='Sac')
    │   └── grille blessures (WOUND_SEVERITIES × MAX_COUNTS — clic POST/PUT/DELETE)
    ├── ContainerPanel (D)   — Sac à dos : équipement conteneur
    ├── ContainerPanel (Ce)  — Ceinture : équipement conteneur
    └── SilhouettePanel      — SVG silhouette 50%, colorée par pire blessure par localisation
```

## Mille-feuille d'armure

```javascript
// Autorité serveur, après filtrage des armures sur le slot touché :
calcResistanceArmure(armuresSlot)
// → { etq, prt } ; meilleure couche + moitié arrondie Polaris des autres couches
```

`server/src/lib/damageService.js` utilise déjà cette résistance dans la résolution complète d'un
impact. `LocationPanel.jsx` conserve un helper d'affichage local pour montrer les couches équipées,
mais il ne devient jamais l'autorité d'une résolution de combat.

## Codes slots — PI6 / PI7

```javascript
// LOCATION_TO_SLOT — armorConstants.js (complet)
{
  tete: 'T', corps: 'C',
  bras_gauche: 'BG', bras_droit: 'BD',
  jambe_gauche: 'JG', jambe_droite: 'JD',
  main_gauche: 'MG', main_droite: 'MD',  // slots armes / mains
  deux_mains: '2M', tripode: 'Tr',        // armes deux mains / support
}

// SLOT_TO_REF_LOCATION — slotCode → ref_location catalogue (complet)
{ T:'T', C:'C', BG:'B', BD:'B', JG:'J', JD:'J', MG:'M', MD:'M', '2M':'M', Tr:'M' }
// 'M' = main — tous les slots mains/armes mappent vers la ref_location 'M'

// SLOT_TO_WOUND_LOCATION — inverse pour blessures combat (existe déjà dans armorConstants.js)
{ T:'tete', C:'corps', BD:'bras_droit', BG:'bras_gauche', JD:'jambe_droite', JG:'jambe_gauche' }
// MG/MD/2M/Tr absents : les mains ne sont pas des localisations de blessure

// Dans LocationPanel :
const slotCode = LOCATION_TO_SLOT[location]           // 'BG'
const refCode  = SLOT_TO_REF_LOCATION[slotCode]       // 'B'
equippedItems  = items.filter(i => i.slot?.split('/').includes(slotCode))  // utilise 'BG'
availableItems = items.filter(i => i.ref_location?.split('/').includes(refCode))  // utilise 'B'
```

**PI6 :** `bras_gauche:'BG'`, `bras_droit:'BD'`, `jambe_gauche:'JG'`, `jambe_droite:'JD'` — pas de partage B/J.
**PI7 :** `slotCode` pour equip/unequip. `refCode` pour le lookup catalogue uniquement. Ne pas confondre.

## ARMOR_CATEGORY_MALUS (armorConstants.js)

Valeurs de catégorie encore affichées dans l'interface d'inventaire :

```javascript
ARMOR_CATEGORY_MALUS = { S: 0, A: -2, B: -3, C: -4, D: -6 }
// S = Sans contrainte ; A/B/C/D = catégories de plus en plus lourdes
```

`calcCarenceArmure` a été retiré en session 141. Ne pas réintroduire ce calcul dans le serveur sans
une décision de règle explicite portée par Saar ; `ARMOR_CATEGORY_MALUS` n'est pas, à lui seul, une
autorité de résolution.

## Routes REST armures/blessures

```
GET    /char-sheet/:id/wounds
  → { wounds: [], wound_penalty: number }

POST   /char-sheet/:id/wounds  { location, severity }
  → 201 { wound, promoted: bool, shock_test_required: bool }
  + WS WOUND_ADDED broadcast { characterId, wound, promoted, shock_test_required }

PUT    /char-sheet/:id/wounds/:wid/stabilize
  → { wound } (is_stabilized: true)
  + WS WOUND_UPDATED broadcast { characterId, wound }

DELETE /char-sheet/:id/wounds/:wid
  → { ok: true }
  + WS WOUND_REMOVED broadcast { characterId, woundId }

GET    /char-sheet/:id/inventory
  → { items, sols, total_weight, threshold }

POST   /char-sheet/:id/inventory
  → 201 { item }
PUT    /char-sheet/:id/inventory/:itemId
  → { item }
DELETE /char-sheet/:id/inventory/:itemId
  → { ok: true }

PUT    /char-sheet/:id/sols  { sols }
  → { sols }  + WS SOLS_UPDATED { characterId, sols }

GET    /char-sheet/:id/weapon-skill/:weaponInvId
  → { skillId, skillLabel, skillTotal }   // null partout si arme sans compétence associée
```

## P51 — effectiveMalus dans les jets

```javascript
// socket/index.js — chancesDeReussite
const woundPenalty       = calcWoundPenalty(wounds)         // ≤ 0, pire blessure seule
const encumbrancePenalty = calcEncumbrancePenalty(weight, FOR)  // ≥ 0, règle maison
effectiveMalus = woundPenalty - encumbrancePenalty           // ≤ 0
chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
```

**Malus santé (blessures, fatigue) :** non-cumulatif — pire seul retenu (LdB p.236). `calcWoundPenalty` retourne déjà le minimum.
**Malus encombrement :** cumulatif (règle maison).
**Jamais** cumuler deux sources de malus santé. **Jamais** appliquer sur un attribut — toujours sur le total du jet.

## P49 — Promotion blessures

Si `res.data.promoted === true`, le serveur a supprimé la ligne source.
**Toujours `GET /wounds` complet** — jamais `setWounds(prev => [...prev, wound])` sur une promotion.

## Pièges inventaire

| Code | Description |
|---|---|
| PI1 | Container 'Sac' : dispo seulement si ≥1 item `ref_location='D'` — `isContainerAvailable()` avant POST/PUT |
| PI2 | Équipement `slot≠null` → container 'Sac' obligatoire — 400 si indispo, jamais Coffre silencieux |
| PI3 | Items équipés (`slot IS NOT NULL`) comptés dans poids — seul `container='Coffre'` exclut |
| PI4 | `calcEncumbrancePenalty` requiert FOR nette = `base_level + pc_modifier`, pas seulement `base_level` |
| PI5 | Items manuels (`equipment_id null`) → `ref_weight null` → exclus du calcul poids |
| PI8 | POST `/inventory` : LIKE query pour multi-slot — `WHERE slot = code` casse les multi-couches |
