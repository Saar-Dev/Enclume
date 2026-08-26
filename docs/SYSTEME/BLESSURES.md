# SYSTEME/BLESSURES.md — Blessures, armures, malus Polaris
> Source : SYSTEME.md §16
> Lire pour : wounds, ArmorWoundPanel, LocationPanel, mille-feuille, calculs P51

---

## Architecture générale

```
shared/woundConstants.js  — WOUND_LOCATIONS / SEVERITIES / MAX_COUNTS / PENALTIES / SEVERITY_COLORS
shared/armorConstants.js  — ARMOR_CATEGORY_MALUS / LOCATION_TO_SLOT / SLOT_TO_REF_LOCATION / LOCATION_TO_SVG / LOCATION_LABELS
server/lib/charStats.js   — calcWoundPenalty(wounds) / calcEncumbrancePenalty(totalWeight, forValue)
```

## Constantes blessures (woundConstants.js)

```javascript
WOUND_LOCATIONS = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']

WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']

WOUND_PENALTIES = { legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: 0 }
// mortelle=0 (pas -20) : REGLEBLESSURES.md dit "non applicable, le blessé ne peut entreprendre
// aucune action demandant un Test" — le -20 était une extrapolation jamais confirmée par le LdB,
// corrigé (WNDMORT, docs/BUGIDENTIFIE.md). 0 = défense en profondeur si isTestBlockingWound est
// oublié par un appelant, pas une vraie valeur RAW.
// calcWoundPenalty retourne le minimum ENTRE PLUSIEURS BLESSURES (pire seule retenue) — voir
// correction ci-dessous : ça ne veut plus dire "malus santé non-cumulatif" au sens large.

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

## Mille-feuille (calcMillefeuille — client uniquement)

```javascript
// Couches sur une localisation → max + reste/2
const max  = Math.max(...vals)
const rest = vals.reduce((s, v) => s + v, 0) - max
return max + rest / 2
// Affiché ETQ/PRT dans LocationPanel — non encore intégré côté serveur (résolution dommages future)
```

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

Malus de carence par catégorie d'armure. S'applique quand la FOR est insuffisante (`calcCarenceArmure`).

```javascript
ARMOR_CATEGORY_MALUS = { S: 0, A: -2, B: -3, C: -4, D: -6 }
// S = Sans contrainte (combinaison souple)
// A/B/C/D = armures de plus en plus lourdes
```

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

## P51 — effectiveMalus dans les jets (périmé, corrigé ci-dessous en 153-158)

```javascript
// server/src/socket/socketEntity.js:323 — chancesDeReussite (PAS socket/index.js, cf. correction)
effectiveMalus = calcActiveMalus({ wounds, fatiguePoints, totalWeight, forNA, settings })  // ≤ 0
chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
```

**Corrigé (audit 2026-08-26, périmé depuis `docs/PLAN_FATIGUE_DOMMAGES.md` §10 Lot 4)** : le calcul
`effectiveMalus` ne vit plus dans `socket/index.js` (fichier qui n'est qu'un routeur de handlers,
aucune formule dedans) mais dans `server/src/socket/socketEntity.js:323`. Il n'est plus recalculé
inline par site — un registre unique, `server/src/lib/activeMalusRegistry.js` (`calcActiveMalus`),
**somme** trois sources indépendantes (`wound`, `encumbrance`, `fatigue`), une entrée par lot futur
(Froid, Maladies/Poisons, Drogues, Irradiations) sans jamais retoucher les sites consommateurs.

**Malus blessures (entre plusieurs blessures) :** non-cumulatif — pire seule retenue (LdB p.236).
`calcWoundPenalty` retourne le minimum entre les blessures actives d'un même personnage.
**Malus encombrement :** cumulatif (règle maison).
**Malus fatigue :** cumulatif avec les deux précédents (`getFatigueLevelMalus`, exempté uniquement du
Test de Fatigue lui-même, RAW l.976-979).
**Entre les trois catégories (blessure/encombrement/fatigue) : cumulatif, pas "pire seul retenu"** —
correction de ce document, cette phrase était fausse depuis le Lot 4. **Jamais** appliquer sur un
attribut — toujours sur le total du jet.

## P49 — Promotion blessures

Si `res.data.promoted === true`, le serveur a supprimé la ligne source.
**Toujours `GET /wounds` complet** — jamais `setWounds(prev => [...prev, wound])` sur une promotion.

## Guérison et Infection (échéancier de campagne)

Consommateur du moteur d'échéances générique (`game_echeances`, `docs/PLAN_FATIGUE_DOMMAGES.md` §8).
Autorité complète (archivée) : `docs/Old/PLAN_BLESSURES_GUERISON.md`.

```
server/src/lib/woundEvolutionService.js  — les 2 handlers ci-dessous
shared/echeanceTypeRegistry.js           — condition_type → handler, interactive: true
server/src/routes/campaigns.js           — routes ci-dessous
client/src/components/BlessuresReviewPanel.jsx  — écran de revue MJ groupé
client/src/components/PendingRollsPanel.jsx     — jets joueurs en attente (Infection)
```

`interactive: true` — jamais résolus par le balayage automatique `sweepDueEcheances`, toujours via
`resolveEcheanceNow` (Lot 2), appelée dès qu'une réponse MJ/joueur est connue.

**`wound_healing_check`** — jamais de jet serveur pour son propre résultat ; lit `payload.mjChoice`
(`amelioration` / `echec` / `catastrophe`) déjà fourni par le MJ dans `BlessuresReviewPanel`. Table de
durée (`WOUND_HEALING`, `shared/woundConstants.js`) :

| Gravité | Durée | Soins constants | Forme |
|---|---|---|---|
| Moyenne | 3 jours | Non | échéance unique |
| Grave | 1 semaine | Non | échéance unique |
| Critique | 3 semaines | Oui | hebdomadaire, 3 occurrences |
| Mortelle | 5 semaines | Oui | hebdomadaire, 5 occurrences |

Légère guérit seule, sans échéance ni Test. `echec`/`catastrophe` engendrent une `wound_infection_check`.

**`wound_infection_check`** — garde un vrai jet (auto `resolvePolarisTest` ou joueur via l'événement
`WOUND_INFECTION_ROLL`, `server/src/socket/socketDice.js`), rythme fixe 2 jours. Seuil calculé par
`computeWoundInfectionThreshold` = NA(Constitution) + `WOUND_INFECTION[severity].baseModifier` - malus
de cases (-2/case au-delà de la première) - malus de périodes sans soin (-2/période) :

| Gravité | Modificateur | S'infecte même en réussite |
|---|---|---|
| Moyenne | +5 | Non |
| Grave | +0 | Non |
| Critique | -5 | Oui |
| Mortelle | -10 | Oui |

Mortelle non soignée : délai de survie (Constitution ou Constitution/2 heures) calculé et affiché au
MJ, jamais appliqué automatiquement — la mort reste narrative, à la charge du MJ.

**Routes** (`campaigns.js`, toutes vérifient `game_echeances.campaign_id === :id`) :
`POST .../game-time/request-advance|confirm-advance|cancel-advance`,
`GET .../game-echeances/pending-review` (GM), `GET .../game-echeances/my-pending-rolls`,
`POST .../game-echeances/:id/healing-choice`, `POST .../game-echeances/:id/infection-mode`.

**Événements** (`shared/events.js`) : `CAMPAIGN_ADVANCE_PENDING`/`_RESOLVED`/`_CANCELLED`,
`GAME_ECHEANCE_RESOLVED`, `WOUND_INFECTION_ROLL` (client→serveur) ; `WOUND_UPDATED` réutilisé tel
quel (pas un nouvel événement) pour resynchroniser la fiche personnage après résolution.

**Pièges** :

| Code | Description |
|---|---|
| — | `character_wounds.occurred_at_game_minutes` ancré sur `campaigns.game_time_resolved_minutes`, jamais `game_time_minutes` (affiché) — sinon une blessure posée après un recul MJ de l'horloge peut déclencher son échéance dès la prochaine avance, sans qu'aucune minute ne se soit écoulée |
| — | Fusion de `payload` avant `resolveEcheanceNow` (`healing-choice`/`infection-mode`) : toujours une expression SQL atomique (`payload \|\| ?::jsonb`), jamais un lire-puis-écrire JS |
| — | `wound_infection_check` n'est jamais créée à la naissance de la blessure — uniquement en conséquence d'un Échec/Catastrophe du `wound_healing_check` |

## Pièges inventaire

| Code | Description |
|---|---|
| PI1 | Container 'Sac' : dispo seulement si ≥1 item `ref_location='D'` — `isContainerAvailable()` avant POST/PUT |
| PI2 | Équipement `slot≠null` → container 'Sac' obligatoire — 400 si indispo, jamais Coffre silencieux |
| PI3 | Items équipés (`slot IS NOT NULL`) comptés dans poids — seul `container='Coffre'` exclut |
| PI4 | `calcEncumbrancePenalty` requiert FOR nette = `base_level + pc_modifier`, pas seulement `base_level` |
| PI5 | Items manuels (`equipment_id null`) → `ref_weight null` → exclus du calcul poids |
| PI8 | POST `/inventory` : LIKE query pour multi-slot — `WHERE slot = code` casse les multi-couches |
