# PLAN_ZONES_DANGER.md — Fondation « zones dangereuses »

> Rédigé 2026-09-09, **réécrit propre 2026-09-10** (consolidation d'un cadrage de ~35 tours).
> **Cadrage terminé. Z0+Z1+Z2+Z4 codés et clos** — détail §11 historique, 2026-09-28. `Z3, Z5→Z7`
> restent à coder (Z5 reste partiel : `gaz:irritant` fonctionne de bout en bout depuis Z4, mais
> `gaz:décomposant`, l'escalade sur ligne `damage` et `grenade_gas_*` ne sont pas faits). Ce document
> est auto-suffisant : il porte le contrat, l'architecture, les décisions RAW tranchées avec Saar, le
> catalogue exemple et le plan d'incréments.
>
> **Responsabilité unique** (`docs/RegleDocumentaire.md` R1) : *comment une zone d'effet runtime,
> posée sur une battlemap, est résolue tour après tour sur ses occupants, et comment elle naît /
> expire.* **Hors responsabilité** : classification d'un espace (sous-marin / surface / spatial) →
> `PLAN_ENVIRONNEMENT_MILIEUX.md` ; géométrie du monde compilé → `.claude/rules/world.md` ;
> **éditeur de volume MJ** : E-v1 (rectangle + « remplir une pièce ») = §7 de ce plan ; le
> **sculpteur polygone** (E-v2) est un consommateur du rework world builder → §12, chantier séparé.
>
> **Autorité RAW** : *Livre de Base Polaris* > ce document.
> **Historique du raisonnement** : commits `fe0235e`..`47f3df7` sur `dev/Saar` + conversation de
> cadrage (la v1 sprawlante de ce fichier, ~1600 lignes, est dans l'historique git).

---

## 1. Constat `[VÉRIFIÉ code, 2026-09-09]`

Deux demi-systèmes existent ; aucun ne fait le travail complet.

### 1.1 `world_effect_instances` + `shared/world/worldEffects.js` (zones spatiales)

**Fait** : modèle de données volumique (`targetKind` ∈ `volume` (AABB 3D) / `compartment` / `support`
/ `feature` / `entity` / `token`), définitions builtin (`fire` / `flooded` / `gas` / `oil` /
`unstable`) + custom par campagne (`world_effect_definitions`), `modifiers` déclaratifs
(`movementMultiplier`, `sightOpacity` — réellement appliqués : coût de déplacement, occlusion LOS),
`hooks` déclaratifs, propagation par graphe de compartiments (canal `gas`/`water`, coupé par porte
fermée). MJ peut créer/éditer une instance via `battlemaps.js`.

**Pas fait** : **aucun hook n'est exécuté** (`type:'damage'` est une description, rien ne le relie à
`resolveTargetHit`) ; **aucune boucle de Tour** ; `duration_rounds` **jamais décrémenté** ; **rien ne
crée d'instance depuis le combat**.

`[VÉRIFIÉ base locale]` : `world_effect_definitions` = **0 ligne**, `world_effect_instances` = **0
ligne**. Aucune rétro-compat de données.

### 1.2 Le système « dangers environnementaux » (Lot 3, `PLAN_FATIGUE_DOMMAGES` §9) — **plus complet qu'il n'y paraît**

Quatre fichiers, en production, **RAW-vérifiés contre Polaris 3ᵉ éd. p.242-243** :

- **`shared/environmentalHazardRegistry.js`** — `ENVIRONMENTAL_HAZARD_REGISTRY = [{acid}, {decompression,
  forcedLocation:'corps'}, {burning}]`. Patron `echeanceTypeRegistry` : **un lookup par ligne, zéro
  agrégation entre dangers** d'un même token (choix délibéré, ≠ `resolveModHooks`). `findHazardRegistryEntry`,
  `getAllHazardCodes()`.
- **`shared/environmentalHazardPresets.js`** — `BURNING_PRESETS` (`small` 1d6 · `medium` 1d10 · `large`
  2d10 / `1d3` Loc · `inferno` 3d10 / **`locations:1`** — écrit avant la décision Saar B3, cf. §5.1) ·
  `DECOMPRESSION_PRESETS` (`normal` 1d10 · `severe` 2d10). Pré-remplit le formulaire MJ, jamais imposé.
  **Ne valide rien** — porte des chaînes, comme `fallDamageConstants.js`.
- **`server/src/lib/environmentalHazardService.js`** — `exposeToHazard(…, {formula, locations,
  forcedLocation, durationDice})` (pose une ligne `token_statuses`, `data:{formula,locations,forcedLocation}`,
  `durationDice` = durée finie optionnelle : lance-flammes « 2D6 Tours ») ; `clearHazard(…, {linger})`
  (linger Acide 1D6, **réservé à `acid` par le RAW**) ; `resolveEnvironmentalHazardTicks` (roll `data.formula`
  → `resolveTargetHit` par Localisation → `COMBAT_ATTACK_RESULT` ; **aucun `armorReductionFactor`** — RAW) ;
  `turnsFromNow` (`current_turn + roll + 1`, le `+1` compense la purge de fin de Tour). Tick appelé depuis
  `combatTurnEngine.startResolutionPhase` (jointure `combat_roster ⋈ token_statuses` filtrée par
  `getAllHazardCodes()`). **Commentaire dans le code : « un vrai stacking serait une refonte du système
  de dangers — hors périmètre ».** ← c'est cette refonte (§2.B).
- **`client/.../TokenStatusPanel.jsx`** — l'UI MJ d'exposition. **Le feeder « exposition manuelle » du
  §2.B existe déjà.** Codes `burning`/`acid`/`decompression` : catégorie `dot`, assets `/assets/status/*.svg`,
  clés i18n `status.*` déjà là.

**Pas fait** : **rien de spatial** — le MJ pose ça à la main, token par token. Pas de catalogue unique
(les chiffres sont éclatés entre `environmentalHazardPresets.js` et le RAW). Pas de stacking. Le tick
est un résolveur codé en dur (roll → `resolveTargetHit`), pas un dispatch par type de ligne.

### 1.3 Le chantier = le pont — patron *spawner*

La zone pose une **condition** (`token_statuses`) sur ses occupants ; **une seule résolution
généralisée** (registre) la traite ; la condition porte sa propre sortie. Validé par 4 réfs
indépendantes (§10). **Hors combat = HORS SCOPE** (décision Saar — aligné avec tout le marché VTT).

---

## 2. Architecture

> Recherche : Unreal GAS (`GameplayEffectComponents`), Unity GAS open-source (sjai013), 2 writeups
> status-effects, Caves of Qud, Divinity: Original Sin 2 (surfaces). **Constat : le patron « registre
> déclaratif + dispatcher générique, jamais un switch central » est déjà le style maison**
> (`activeMalusRegistry.js` — son en-tête le dit —, `weaponModRegistry` + `resolveModHooks`,
> `echeanceTypeRegistry`). C'est *exactement* le modèle `GameplayEffectComponents`. On l'applique aux
> lignes d'effet de zone et on **y refond `environmentalHazardService`**.

### 2.A — `effectLineResolverRegistry` (le cœur)

`shared/` = contrat + validation pure ; serveur = résolveurs. Une entrée par **type de ligne d'effet** :

> **Précision de patron** : la *forme* du dispatcher (map `RESOLVERS` + `applicableResolvers`) vient de
> `weaponModService`, mais la *sémantique* est un **lookup par `type`** (patron `echeanceTypeRegistry`
> / `environmentalHazardRegistry`), **pas** l'agrégation multi-sources de `resolveModHooks`. L'invariant
> Lot 3 est préservé : **zéro agrégation entre plusieurs dangers d'un même token** — chaque ligne
> `token_statuses` se résout indépendamment via un seul lookup.


```
{ type,                          // 'damage' | 'status' | 'modifier' | 'note' | 'test' | 'statLoss'
                                 //  | 'chance' | 'drainResource' | 'skillOverride' | 'forcedMove'
                                 //  | 'accumulateLevel' | 'corrodeEquipment' | 'chain'
  phase,                         // 'onEnter' | 'onExit' | 'onTraverse' | 'onTurn'
  validateParams(params),        // shared, pur
  resolve(ctx) }                 // serveur — réutilise resolveTargetHit / gmArbitratedTestService /
                                 //   statusService / integrityService / activeMalusRegistry / …
```

`resolveActiveEffects` (une passe, dans `startResolutionPhase`) **dispatche via ce registre**.
- **v1 enregistre `damage`, `status`, `modifier`, `note`.** Les autres types **valident** (contrat
  complet dès Z0) mais **n'ont pas de résolveur** → `log("type non résolu (v2)")`, no-op.
- **v2 = ajouter une entrée au registre.** Zéro changement du dispatcher, du schéma stocké, de la
  boucle de Tour. C'est ça, « adaptatif ».

### 2.B — Refonte du système « dangers environnementaux » (Lot 3 → catalogue)

Ce qui existe (§1.2) est **absorbé**, pas doublé :

| Aujourd'hui | Après refonte |
|---|---|
| `environmentalHazardPresets.js` (`BURNING_PRESETS`, `DECOMPRESSION_PRESETS`) | **fondu dans `dangerCatalog.js`** : `feu:petit/moyen/grand/brasier`, `decompression`. Le fichier de presets disparaît (ou devient un ré-export mince du catalogue le temps de migrer les imports). |
| `environmentalHazardRegistry.js` (`[{acid},{decompression},{burning}]`) | **dérivé du catalogue** : « la liste des `status_code` de danger » = les clés du catalogue dont la `category` est une famille de danger. `getAllHazardCodes()` lit le catalogue. `forcedLocation:'corps'` de la décompression = un champ de la définition catalogue. |
| `resolveEnvironmentalHazardTicks` (roll `data.formula` → `resolveTargetHit`, **codé en dur**) | **remplacé** par `resolveActiveEffects` : la définition catalogue porte `effects:[{type:'damage', formula, locations, …}]`, dispatché via `effectLineResolverRegistry` (§2.A). Le résolveur `damage` réutilise `resolveTargetHit` — même sortie `COMBAT_ATTACK_RESULT`. |
| `exposeToHazard` / `clearHazard` / `turnsFromNow` / `durationDice` / linger Acide | **conservés** comme l'un des deux alimentateurs (pose une instance `targetKind:'token'`). `turnsFromNow` (+1 purge) reste la primitive de durée. |

**Deux alimentateurs, une résolution** :
- exposition MJ à la main sur un token (`exposeToHazard`, UI `TokenStatusPanel.jsx`) → instance `targetKind:'token'` ;
- balayage de présence d'une zone → conditions sur les occupants.

→ **invariant 2 enfin respecté** : plus de résolveur de dégât codé en dur à côté du registre, plus de
chiffres RAW éclatés entre un fichier de presets et le catalogue. Non-régression stricte exigée (les
tests Lot 3 existants — `environmentalHazardRegistry.test.mjs`, `environmentalHazardPresets.test.mjs`,
tests service — **doivent passer inchangés ou être portés 1-pour-1** + session Saar : brûler / acide /
décompresser un token comme avant la refonte).

### 2.C — Flyweight

| | Où | Contenu |
|---|---|---|
| **Définition** | code (`dangerCatalog.js`) pour les builtin ; `world_effect_definitions` (DB) pour les custom MJ | immuable : `key`, `label`, `category`, `tags`, `durationPolicy`, `stackingPolicy`, `modifiers`, `effects[]`, `attenuations[]`, `chaining[]`, `corrodes[]`, `source` (citation RAW) |
| **Instance** | `world_effect_instances` (DB) | `definitionKey`, `geometry`, `puissance` (§2.E), `durationOverride`, `metadata`, `source.kind`, `state` |
| **Runtime par occupant** | `token_statuses.data` | durée restante · malus accumulé (escalade, Z4) · *(v2 : Souffle courant, état de cascade — n'existent pas encore, §5.5)* |

Le lookup `definitionKey` → catalogue (code) **puis** `world_effect_definitions` (DB).

### 2.D — `dangerCatalog.js` (la « bible » RAW)

`shared/world/dangerCatalog.js` — patron `polarisUtils.js` / `armorConstants.js`. **TOUTES** les
définitions builtin, complètes, **avec la citation RAW en commentaire au-dessus de chaque chiffre**.
Source de vérité unique. `ref_equipment` (grenades/capsules) ne porte **plus aucune mécanique** —
juste `aoe_profile` (volume) + une clé `dangerKey` (dans le JSONB `aoe_profile`). Le nettoyage des 6
lignes `ref_equipment` corrompues (§5.4) = **suppression** des valeurs, pas migration.

### 2.E — Facteur `puissance` (patron « SetByCaller Magnitude », GAS)

Un scalaire **entier signé** sur l'instance, **défaut 0**, **toujours additif** (le RAW dit « malus /
dégât **dépendant de** la puissance » — jamais « double ») :
- `damage` → `formule + puissance` (bonus au jet) ;
- `test` → `difficulté + puissance` (plus dur) ;
- `modifier` → `value − |puissance|` (pire).

Défaut 0 ⟹ les préréglages sont **inchangés** sauf si le MJ pousse le curseur. **Pas de mode
`multiply`.** Reste distinct de `world_effect_instances.intensity` (multiplicatif, défaut 1) qui sert
le **géométrie/ambiance** (`movementMultiplier`, `sightOpacity`) — deux axes, pas de collision.

### 2.F — Interaction & immunité **par tags, jamais par matrice** (patron DOS2)

- `attenuations: [{ by: 'protectionKey' | 'trait' | 'behavior', key, effect: 'immune' | 'halve' |
  'partial' | 'arbitrate', scope?, when? }]` — une tenue NBC = `immune` à `atmosphere:gas` ;
  « retenir sa respiration » = `behavior` `halve` (coût en Souffle) ; `fireproof` = `arbitrate`
  (émet une note MJ, n'applique rien — le RAW mandate une réduction mais ne la chiffre pas).
- `zoneInteractionRules: [{ whenTag, meetsTag, action: 'remove' | 'convert' | 'amplify', toKey? }]`
  — **v1 en livre 0** (Polaris n'a pas de « les surfaces interagissent » ; le MJ arbitre « tu sautes
  dans l'eau, le feu s'éteint »). La forme existe dans le contrat.

### 2.G — Protections équipement : `ref_equipment.protections` JSONB

Remplace la prolifération de colonnes (`waterproof` + `fireproof` + `gas_mask` + …) :
```
protections: {
  'terrain:water':  { degree: 'full' },
  'atmosphere:gas': { degree: 'partial', scope: ['peau'], except: ['neurotoxique'] },  // masque à gaz
  'hazard:fire':    { degree: 'partial' },                                             // ignifugé
}
```
Les `attenuations` du catalogue référencent ces clés. **Rework assumé** : `waterproof` (colonne
existante — outil admin, `equipmentMapping.js`, `inventoryService`, `diff_equip.mjs`) s'y replie
(migration + retrait de colonne). → incrément **Z1b**.

### 2.H — Timing dans le moteur de tour `[VÉRIFIÉ combatTurnEngine.js]`

Structure Polaris : **pas de tour par créature** — phase ANNONCE → `startResolutionPhase` →
`advanceTimeline` (marche unique dans l'échelle d'Initiative) → `endTurn` (`current_turn++`, purge
universelle des statuts `expires_at_turn <= newTurn`). `startResolutionPhase` fait déjà, **avant la
marche** : `buildTimelineEntries` → tick des mods → tick des dangers → `advanceTimeline`.

1. **`startResolutionPhase` gagne un balayage de présence**, juste **avant** le tick généralisé :
   pour chaque zone active, chaque token du roster **géométriquement dedans** (règle `centreDedans`
   en v1 — voir §6 F4) → applique/rafraîchit (idempotent) la condition `token_status`. Puis
   `resolveActiveEffects` résout **toutes** les conditions (zone-driven **et** décroissantes hors
   zone). **Seul endroit où « qui est dans la zone » se calcule — 1×/Tour.**
2. **Entrer en cours de résolution** (step de mouvement, `worldMovementService` émet `enter`) :
   ligne `onTurn` → condition posée maintenant, **1er tick au `startResolutionPhase` suivant** ;
   ligne `onEnter` / `onTraverse` **one-shot** (piège, geyser traversé) → **résolue inline**.
3. **Zone posée ce Tour** (grenade, pose MJ) → **tick au Tour suivant**.
4. **Cycle de vie** : décrément `durationPolicy` / `duration_rounds` dans **`endTurn`** ; à 0 →
   `state = 'expired'`, plus de condition posée, `WORLD_RUNTIME_UPDATED`.
5. **`decay` hors zone** : une condition à `remanence: 'decay'` tique **seule** via
   `resolveActiveEffects` (qui itère aussi les `token_statuses` actifs, pas seulement les zones) —
   le balayage de présence ne gère que enter/refresh.
6. **Aucune interaction avec l'échelle `resolve_on_turn` / le report Ini ≤ 0** — le tick de zone est
   une opération de masse pré-marche, comme les ticks mods/hazard le sont déjà. Seul lien :
   grenade→zone (l'explosion, déjà une entrée autonome, appelle `createWorldEffectInstance`).
7. Réutiliser la machinerie `exposeToHazard` / `turnsFromNow` (hérite du `+1` de compensation de
   purge). Ignorer les tokens `unconscious` (comme le tick actuel).

---

## 3. Contrat — le schéma

### Définition (`dangerCatalog.js` entry ou `world_effect_definitions` row)

```
{ key: 'feu:grand', label, category: 'feu', tags: ['hazard:fire'], icon, builtin: true,
  hazardCode: 'burning',                // status_code de la condition token_statuses que cette famille
                                        //   pose (feu:*→burning · acide:*→acid · decompression→decompression).
                                        //   Sert à DÉRIVER environmentalHazardRegistry en Z1 (§14.4).
                                        //   null = définition non postable comme condition « token ».
  forcedLocation: null,                 // clé LOCATION_TO_SLOT forcée au niveau DÉFINITION
                                        //   (décompression → 'corps'). Prime sur l'instance ET sur locationMode.
  durationPolicy: 'permanent',          // permanent | timerFixed | timerDice | conditional | oneShot
  durationParams: {},                   // ex. conditional -> { condition: 'aération' }
  stackingPolicy: 'max',                // v1 : 'max' (par catégorie) | 'independent'
                                        //      'stackCount' / 'refreshDuration' = déclarés, non résolus
  modifiers: { movementMultiplier: 1, sightOpacity: 0.12 },   // passif géométrie/ambiance (existant)
  effects: [ <ligne d'effet>, ... ],
  attenuations: [ <règle §2.F>, ... ],
  chaining: [],                         // { engendre, délai, condition, géométrie } — v1 : 0 résolveur
  corrodes: [],                         // ['chair'|'métal'|…] — résolveur corrodeEquipment = v2
  source: "citation RAW" }
```

### Ligne d'effet

```
{ type, phase,                          // §2.A
  // -- damage --
  formula, locations, locationMode: 'random'|'exposed'|'all', forcedLocation, damageType, armorFactor,
  // -- modifier --
  target: 'actions'|…, value,
  // -- status --
  statusCode,                           // v1 : uniquement des codes EXISTANTS (un code neuf = travail moteur)
  // -- transverses --
  escalation: null | { perTurn, cap },  // accumulateur mutable dans token_statuses.data
  remanence: 'none'|'conditional'|'decay'|'fixed',
  remanenceParams: {} }                 // decay: { perTurn } · fixed: { turns, earlyStop } ·
                                        // conditional: { label } (retrait MJ manuel en v1)
```

**Types de ligne — statut v1** : `damage`, `status`, `modifier`, `note` = résolus. `test`,
`statLoss`, `chance`, `drainResource`, `skillOverride`, `forcedMove`, `accumulateLevel`,
`corrodeEquipment`, `chain` = **dans le contrat (validés), résolveur = v2**.

> **`locationMode` se mappe sur la précédence existante, il ne la remplace pas** (§2.B). Le résolveur
> `damage` de Lot 3 applique déjà : `entry.forcedLocation` (registre) `??` `data.forcedLocation`
> (instance, choix MJ) `??` aléatoire `1D20`. Traduction en Z1 : `locationMode:'all'` → toutes les
> Localisations ; `'exposed'` → lit `data.forcedLocation` de l'instance, sinon aléatoire ; `'random'`
> → aléatoire. Le champ `forcedLocation` de la **définition** (décompression → `'corps'`) prime sur
> tout. Aucun nouveau code de résolution de Localisation — on branche le vocabulaire du catalogue sur
> `resolveTargetHit(forcedSlotCode)`.

### Instance (`world_effect_instances`)

```
{ id, battlemapId, definitionKey,
  geometry: { mode: 'volume'|'compartment', shape, volume: {min,max}, compartments: [], wallAware,
              animation: null },        // animation (remplissage/dérive) = v2
  puissance: 0,                         // §2.E (champ + migration = Z2)
  durationOverride: null,               // la grenade pose { policy:'timerDice', turns:'2d6' }
  metadata: {},                         // "Personnalisé" : formulaOverride…
  source: { kind: 'mj'|'grenade'|'flamethrower' },
  state: 'active' }
```

> **Réconciliation avec l'existant (à trancher en Z2)** : `normalizeEffectInstance` (`worldEffects.js`)
> a déjà `targetKind ∈ volume|support|feature|compartment|entity|token` + `volume` (AABB) + `targetId`.
> Le bloc `geometry` ci-dessus est une **proposition de restructuration** ; l'alternative est de garder
> `targetKind`/`volume`/`targetId` tels quels et de n'ajouter que `puissance` + `durationOverride`.
> Orthographe **`compartment`** (celle du code), pas « compartiment ».

---

## 4. Catalogue — entrées de référence (`dangerCatalog.js`)

> Formes indicatives ; noms de champs définitifs figés en écrivant Z0. `puissanceMode` retiré —
> `puissance` est toujours additif (§2.E).

```
// ── feu:braise / feu:petit ── FATIGUE&DOMMAGES.md §Feu : petite flamme 1D6/Tour, Localisation exposée
{ key:'feu:petit', category:'feu', tags:['hazard:fire'], durationPolicy:'permanent', stackingPolicy:'max',
  modifiers:{ movementMultiplier:1, sightOpacity:0.12 },
  effects:[ { type:'damage', phase:'onTurn', formula:'1d6', locations:1, locationMode:'exposed',
              damageType:'fire', armorFactor:1, remanence:'none' } ],
  attenuations:[ { by:'protectionKey', key:'hazard:fire', effect:'arbitrate' } ] }

// ── feu:moyen ── 1D10/Tour, Localisation exposée
{ key:'feu:moyen', ... formula:'1d10', locations:1, locationMode:'exposed' ... }

// ── feu:grand ── 2D10/Tour, 1D3 Localisations
{ key:'feu:grand', ... formula:'2d10', locations:'1d3', locationMode:'random' ... }

// ── feu:brasier ── 3D10/Tour, TOUTES les Localisations — mort garantie en 1 Tour (Saar B3)
{ key:'feu:brasier', category:'feu', hazardCode:'burning', ...
  effects:[ { type:'damage', phase:'onTurn', formula:'3d10', locations:null, locationMode:'all',
              damageType:'fire', armorFactor:1, remanence:'none' } ] }

// ── acide:capsule ── §Acide + catalogue Capsule acide (1D10) ; persistance 1D6 Tours
{ key:'acide:capsule', category:'acide', tags:['hazard:acid'], durationPolicy:'permanent',
  stackingPolicy:'max', corrodes:['chair'],
  effects:[ { type:'damage', phase:'onTurn', formula:'1d10', locations:1, locationMode:'random',
              damageType:'acid', armorFactor:1,
              remanence:'fixed', remanenceParams:{ turns:'1d6', earlyStop:'neutralisant' } } ] }

// ── gaz:irritant ── Livre de Base §Gaz irritants (p.310) — le « gaz simple » de la preuve #2
{ key:'gaz:irritant', category:'gaz', tags:['atmosphere:gas','atmosphere:gas:irritant'],
  durationPolicy:'conditional', durationParams:{ condition:'aération' }, stackingPolicy:'max',
  modifiers:{ sightOpacity:0.2 },
  effects:[
    { type:'modifier', phase:'onTurn', target:'actions', value:-3,
      remanence:'decay', remanenceParams:{ perTurn:1 } },
    // v2 (no-op + log jusqu'au résolveur `test`) :
    { type:'test', phase:'onTurn', skill:'CON', difficulty:0,
      onFail:{ type:'modifier', target:'actions', valueFromFailMargin:true, cumulative:true } } ],
  attenuations:[
    { by:'protectionKey', key:'atmosphere:gas', effect:'immune' },
    { by:'behavior', tag:'holdBreath', effect:'halve', cost:'souffle' } ] }

// ── gaz:décomposant ── Livre de Base §Gaz décomposants — l'autre gaz preuve #2 (100% RAW en v1)
{ key:'gaz:décomposant', category:'gaz', tags:['atmosphere:gas','atmosphere:gas:decomposing'],
  durationPolicy:'conditional', stackingPolicy:'max',
  effects:[ { type:'damage', phase:'onTurn', formula:'1d6', locations:1, locationMode:'random',
              damageType:'fire',                     // "blessures comme le feu"
              escalation:{ perTurn:2, cap:null },
              remanence:'decay', remanenceParams:{ perTurn:1 } } ],
  attenuations:[ { by:'protectionKey', key:'atmosphere:gas', effect:'immune' } ] }

// ── gaz:vésicant / suffocant / neurotoxique / assommant ──
//   dans le catalogue dès Z0, avec leur(s) ligne(s) `damage`/`status` (résolues v1)
//   + leurs lignes `test`/`statLoss`/`chance` (no-op + log jusqu'à v2). Verbatim RAW = §5.3.

// ── zone:radiation (×3 : légères 1D6 / importantes 2D6 / massives 3D6) ──
{ key:'radiation:massives', category:'radiation', tags:['hazard:radiation'],
  durationPolicy:'permanent', stackingPolicy:'max',
  effects:[ { type:'accumulateLevel', phase:'onEnter', track:'irradiation', formula:'3d6' } ] }
//   résolveur accumulateLevel = v2 (bloqué sur PLAN_FATIGUE_DOMMAGES « Radiations Lot 9 »)

// ── decompression (refonte §2.B) ── forcedLocation au niveau DÉFINITION (RAW : toujours le Corps)
{ key:'decompression', category:'decompression', hazardCode:'decompression', forcedLocation:'corps',
  durationPolicy:'permanent', stackingPolicy:'max',
  effects:[ { type:'damage', phase:'onTurn', formula:'1d10', damageType:'decompression',
              armorFactor:1, remanence:'none' } ] }   // locationMode ignoré : forcedLocation prime
//   burning  -> famille feu:* (hazardCode:'burning') ; acid -> acide:capsule (hazardCode:'acid')
```

### Flux « grenade incendiaire » (preuve utilisateur #1)

1. **Annonce** (Tour N) — joueur déclare `grenade incendiaire` sur un point (comme la frag).
2. **Lancer** (Tour N) — Test de Coordination COO + dispersion `1D6` à l'échec → point d'impact
   (réutilise `resolveGrenadeThrow` / `circleGrenade.js`, chantier grenades).
3. **Entrée d'échelle autonome** planifiée pour Tour N+1 au rang d'Ini du lanceur (`autoResolve`).
4. **Tour N+1** — le step autonome appelle `createWorldEffectInstance({ definitionKey:'feu:grand',
   geometry:{ centre=impact, rayon=aoe_profile.radiusM → AABB }, durationOverride:{ policy:'timerDice',
   turns:'2d6' }, source:{ kind:'grenade' } })` + marqueur 3D.
5. **Tour N+2, `startResolutionPhase`** — balayage → conditions posées → `resolveActiveEffects` →
   `damage` `2D10` / `1D3` Loc → `COMBAT_ATTACK_RESULT`.
6. **`endTurn`** — décrément timer `2D6` ; à 0 → `expired`.

---

## 5. RAW par famille — décisions tranchées (Saar, 2026-09-10)

### 5.1 Feu — `FATIGUE&DOMMAGES.md` §Feu

4 intensités (`1D6`/`1D10`/`2D10`/`3D10`). Localisations : petite+moyen = « exposée » (désignée MJ) ;
grand = `1D3` ; **brasier = 3D10 sur TOUTES les Localisations** (RAW muet → décision Saar B3
re-confirmée 2026-09-10 : mort garantie en 1 Tour).

> **Écart à corriger en Z1** : `shared/environmentalHazardPresets.js` a `inferno … locations:1`
> (écrit avant B3, commentaire « RAW ne précise pas, 1 par défaut »). Quand ce fichier est absorbé
> par `dangerCatalog.js` (§2.B), `feu:brasier` fige `locationMode:'all'` (`locations` ignoré) — le
> catalogue l'emporte, l'ancien `1` disparaît. Ne pas recopier le `1`.

**Ignifugé** : le
RAW dit « réduit considérablement » mais **ne liste aucun équipement ni aucun chiffre** → colonne
`protections['hazard:fire']` (peuplée MJ, aucun seed) + `attenuation` `arbitrate` (note MJ, aucune
réduction auto). « Vêtements qui prennent feu » (le feu suit hors zone) = **v1 : non modélisé**
(`remanence:'none'`) — v2, statut `burning` séparé.

### 5.2 Acide — `FATIGUE&DOMMAGES.md` §Acide

« Dégâts progressifs **comme le feu** » → **même résolveur `damage`**. Pas d'échelle de « puissance »
RAW → double champ MJ à la pose : **dégât + durée** (`linger`, défaut `1D6` Tours). Un seul ancrage
catalogue : `Capsule acide` = `1D10`. Corrosion de l'**équipement** (`corrodes:['métal']` +
résolveur `corrodeEquipment` → `integrityService.adjustIntegrity`) = **v2** (quand Usure & Intégrité
L5 est stable ; le contrat le prévoit dès Z0).

### 5.3 Gaz — `[VÉRIFIÉ Livre de Base, Saar]` §Gaz (p.309-310)

Préambule : **propagation instantanée** (pas m³/Tour), **dissipation conditionnelle (vent)** →
`durationPolicy:'conditional'`. Volume par vecteur (capsule ≈ 10 m³ · grenade ≈ 30 m³ · obus ≈ 1000
m³). **Rémanence universelle** (aucun gaz `remanence:'none'`). **Immunité = protection étanche
seulement** (masque à gaz : partiel — peau seule contre vésicant, **insuffisant contre neurotoxique**
; NBC / pressurisé : total). « Puissance du gaz » = le facteur `puissance` (§2.E). « Retenir sa
respiration » = ½ de l'effet / Tour (arrondi sup.), coût en Souffle (§5.5).

| Gaz | Effet / Tour de présence | Escalade | Rémanence sortie | v1 ? |
|---|---|---|---|---|
| **vésicant** | `1D6` sur `1D3` Loc ; ½ chances ; quasi-aveugle | +1 Dommage/T | `conditional` (solution neutralisante) | `damage`+`status` oui ; ½ chances + `chance` = v2 |
| **suffocant** | Test CON → −1 CON (perte déf. sauf Test de Chance) ; ½ chances | — | `decay` −1 malus / 2 T | `test`+`statLoss`+`chance` = v2 |
| **irritant** | malus **−3** ; Test CON → malus supplémentaire cumulatif | via échec | `decay` −1/T | **oui** (`modifier` + `decay`) — le Test = v2 |
| **neurotoxique** | Test CON → −1 Résistance (**même hors zone**) ; mort sauf MR ≥ 15 / atropine + Chance | — | `conditional` | `test`+`statLoss`+`chance` = v2 |
| **décomposant** | `1D6`/Tour ; « blessures comme le feu » | +2 Dommages/T | `decay` −1/T | **oui** (`damage` + `escalade` + `decay`) |
| **assommant** | Test de résistance au Choc | +1 malus/T | `decay` (RAW muet, défaut) | `test` = v2 |

### 5.4 Données `ref_equipment` — 6 lignes corrompues `[VÉRIFIÉ base]`

`Grenade/Capsule à gaz — décomposants` : `nation` contient `"1D6/Tour (+2/Tour en zone; -1/Tour hors
zone)"`. `— vésicants` : `nation` contient `"1D6/Tour ×1D3 Loc (+1/Tour en zone)"`. `— assommants` :
`damage_h` contient `"Test Résistance au Choc"`. → migration Z1 : **supprime** ces valeurs (la donnée
vit dans `dangerCatalog.js`). Les lignes irritant/neuro/suffocant sont `null` partout (normal, prose
dans `description`). Lignes acide : propres.

### 5.5 Souffle — `REGLEBLESSURES.md` §Souffle  *(v2, ne bloque pas le noyau)*

`[RAW VÉRIFIÉ]` : les paliers de perte (−1 immobile / −2 modérée / −3 intense / −4 combat), Souffle
épuisé → cascade de Tests d'Athlétisme → noyade / asphyxie / effet du gaz, `surprised` → Souffle
max ÷ 2. `[INFÉRENCE de cadrage, acceptée par Saar via E1/E2 §8]` : traiter immersion / vide / gaz
comme **un seul timer de blocage respiratoire** (chaque menace garde son effet propre — pas une
mécanique unique).

Perte selon l'**activité dérivée** (décision Saar E1) :
`arme au clair ? −4 : (déplacement ? mapping gait [lent→−2, rapide/max→−3] : −1)`.
*(À vérifier au moment de coder : le moteur distingue-t-il « arme dégainée » de « possédée » ? sinon
proxy = « a déclaré une action de combat ce Tour ».)*
`calcSouffle` (`shared/polarisUtils.js`) = un **plafond** ; **aucun Souffle courant runtime**
aujourd'hui. Résolveur `drainResource` + la mini-FSM de cascade = **v2**.

### 5.6 Décompression — `FATIGUE&DOMMAGES.md` §Décompression

`1D10` (ou `2D10`) / Tour, **Corps** (`forcedLocation:'corps'`). Résolveur `damage` — **v1**.

### 5.7 Radiations — `FATIGUE&DOMMAGES.md` §Irradiations `[texte déjà transcrit, complet]`

Gain à l'**entrée** : `1D6` / `2D6` / `3D6` (légères / importantes / massives). Re-tick : mensuel /
hebdo / **quotidien** → **rien à l'échelle du Tour**. Seuils 5/10/15/20/25/30 → pertes CON temp +
Fatigue + points permanents = **`PLAN_FATIGUE_DOMMAGES` (Radiations Lot 9, non construit)**. →
`zone:radiation` dans le catalogue dès Z0 (`accumulateLevel` à l'entrée) ; **résolveur = v2**.

### 5.8 Terrain — `REGLESYSCOMBAT.md` §Allures ; builtins `unstable` / `oil`

Terrain difficile/dangereux → le joueur *choisit* l'Allure lente, **pas de dégât**. Seuls dégâts
liés : +`1D10` aux Dommages de chute (terrain accidenté), malus de combat « terrain instable ». →
`modifiers` (`movementMultiplier`) + hook `traverse` (test Équilibre) — **déjà couvert par les
builtins**. Zéro type de ligne neuf.

### 5.9 Froid, Noyade — hors périmètre

Froid : échelle **heure**, hors combat. Noyade : la conséquence d'un Souffle épuisé (§5.5).

---

## 6. Plan d'implémentation

**Périmètre v1** : combat-only · patron spawner · lignes `damage` / `status` / `modifier` / `note`
résolues · géométrie `volume` (AABB) + `compartiment` (existants) · règle de recouvrement
`centreDedans` · `puissance` additif · `stackingPolicy` `max` par catégorie · **pas** d'interaction
zone × zone. **Le catalogue est complet dès Z0** ; seuls les résolveurs sont incrémentaux.

| # | But | Nature | Preuve |
|---|---|---|---|
| **Z0** | `shared/world/dangerEffectLines.js` (neuf) : schéma de ligne **complet** (13 types validés, `phase`, params typés). Extension **additive** de `worldEffects.js:normalizeEffectDefinition` (8 blocs optionnels dont `hazardCode` / `forcedLocation`). **`shared/world/dangerCatalog.js`** (neuf) : toutes les définitions, sourcées RAW. Tests purs + non-régression des 5 builtins. **Détail §13.** | `shared/`, aucune migration, additif | `node --test shared/**` |
| **Z1** | `effectLineResolverRegistry` (dispatcher `weaponModService` + lookup par type §2.A) ; `resolveActiveEffects` ; **refonte système dangers environnementaux** (§2.B) : `environmentalHazardPresets.js` **absorbé** dans `dangerCatalog.js`, `environmentalHazardRegistry.js` **dérivé** (`hazardCode`), `resolveEnvironmentalHazardTicks` remplacé par le dispatch ; `exposeToHazard`/`clearHazard`/`turnsFromNow` conservés (feeder token). Résolveurs `damage` + `status` + `note` + `modifier` de base. Migration : **supprime les 6 valeurs `ref_equipment` corrompues** (§5.4). **4 sous-étapes, détail §14.** | serveur, **rework**, migration | tests Lot 3 portés / mis à jour + **session Saar** (brûler / acide / décompresser comme avant) |
| **Z1b** | `ref_equipment.protections` JSONB (§2.G) ; `waterproof` s'y replie (migration + retrait colonne) ; outil admin / `equipmentMapping.js` / `inventoryService` / `diff_equip.mjs` adaptés ; résolveur `attenuation` lit `protections`. | serveur + client admin, **rework**, migration | build + session Saar |
| **Z2** | balayage roster × zones dans `startResolutionPhase` → `resolveActiveEffects` ; `durationPolicy` dans `endTurn` ; `worldSpatialQueryService.tokensInsideEffectVolume` (`centreDedans`) ; `remanence:'none'` à l'`exit` ; champ instance `puissance` (migration) branché dans les résolveurs. | serveur, migration | **insert manuel zone `feu:grand` → un token dedans brûle chaque Tour + s'éteint en sortant** |
| **Z3** | `aoeMechanisms/grenade_incendiary.js` sur `circleGrenade.js` ; explosion Tour+1 → `createWorldEffectInstance`. **Dé-gèle le chantier grenades** (maj `PLAN_GRENADES.md` §6). | serveur + migration `ref_equipment` | **preuve utilisateur #1** — lancer incendiaire → zone de feu au Tour suivant |
| **Z4** | résolveur `modifier` complet (entrée `ACTIVE_MALUS_SOURCES` alimentée par les zones) ; `escalation` = accumulateur mutable dans `token_statuses.data` ; `remanence:'decay'` (tique hors zone via `resolveActiveEffects`). | serveur | zone de gaz : malus qui monte en présence, décroît après la sortie |
| **Z5** | `gaz:irritant` (`modifier −3` + `decay`) **et** `gaz:décomposant` (`damage 1D6` + `escalade +2` + `decay`) — les 2 entièrement RAW en v1 ; atténuation `behavior` « retenir sa respiration » = ½ ; `aoeMechanisms/grenade_gas_*.js`. | serveur + migration | **preuve utilisateur #2** |
| **Z6** | **Éditeur E-v1** (§7.2) — porter l'outil effet sur le plateau de session (`Canvas3D.jsx`, aujourd'hui Editor3D seulement), MJ-only, aperçu optimiste + confirmation serveur ; flux catégorie → préréglage → géométrie ; 2 modes de géométrie : « remplir un compartiment » (`targetKind:'compartment'`, zéro géométrie neuve) + rectangle + hauteur (existant) ; « Personnalisé » ; bascule visibilité MJ/joueur ; mesh translucide par catégorie ; i18n. **Pas de polygone (E-v2, §12).** | client | build + session Saar |
### 6.1 — Analyse critique de l'éditeur de zones ACTUEL (2026-09-27, vérifiée dans le code après `165be2b`)

Griefs initiaux de Saar, ré-examinés fichier par fichier après la réorganisation de la sidebar
(`165be2b`, Structure / Objets 3D / Zones dangereuses) pour savoir ce qu'elle a réellement réglé et
ce qui reste identique. Portée : `client/src/components/SurfaceEditorPanel.jsx` (bloc
`mode === 'effect'`, ligne ~580) et `SurfaceEditorScene.jsx` (création de zone, ligne ~1079 ;
rendu 3D, ligne ~445).

**Réglé par `165be2b`** : les zones ont désormais leur propre onglet de haut niveau (icône dédiée),
distinct de « Structure ». Le déplacement caméra au clavier fonctionne maintenant sur cet écran.
C'est une vraie amélioration de navigation — mais elle s'arrête à l'onglet : le **contenu** de
l'écran Zones dangereuses n'a pas été touché par ce commit.

**Confirmé toujours présent (grief 1 — pas d'édition)** : `SurfaceEditorScene.jsx:1079-1099`,
`mode === 'effect'` appelle TOUJOURS `onRuntimeEffectCreate` au relâchement du glisser — aucune
branche de sélection d'une instance existante (contrairement à Salle/Mur qui ont
`selectedRoomId`/`roomWallEdit`). La liste « Effets actifs » (`SurfaceEditorPanel.jsx` ligne ~672)
n'offre qu'un bouton « Supprimer » — aucun « Modifier ». Changer l'intensité ou la hauteur d'une
zone déjà posée = la supprimer et la redessiner à l'identique, avec risque de décalage.

**Confirmé toujours présent, et AGGRAVÉ par le travail de ce jour (grief 2 — liste sans tri)** : le
`<select>` (`SurfaceEditorPanel.jsx` ligne ~586) reste un menu plat, dans l'ordre brut de
`worldEffects.definitions`. Avant Z0-Z2 il listait 5 entrées (les anciens types vides) ; il en liste
maintenant ~20 (5 legacy + 15 entrées RAW du catalogue) depuis que `loadWorldEffectDefinitions` les
réconcilie (Z2 étape 2). **Le tri par catégorie n'a jamais été codé, seulement prévu dans ce plan**
(§9 tableau Z6, « flux catégorie → préréglage ») — la donnée existe déjà et est déjà envoyée au
client (`definition.category` : `feu`/`acide`/`gaz`/`radiation`/`decompression`, servi par
`serializeDefinition`), simplement inutilisée côté panneau.

**Confirmé toujours présent (grief 3 — superposition)** : Salle, Mur et Connecteur ont chacun leur
PROPRE fenêtre flottante (`SurfaceRoomPanel.jsx`, `SurfaceWallPanel.jsx`,
`SurfaceConnectorPanel.jsx`, tous `FloatingPanelSection` + position mémorisée en localStorage —
exactement ce que `165be2b` vient d'améliorer pour ces trois-là). **Aucun `SurfaceEffectPanel.jsx`
n'existe** : la configuration de zone (type, intensité, hauteur, effet MJ personnalisé, liste des
zones actives) reste entassée dans la colonne étroite de la sidebar, sans bénéficier d'aucune des
améliorations de ce commit. C'est une vraie asymétrie structurelle, pas une impression.

**Confirmé toujours présent (grief 4 — aucun retour visuel)** : `SurfaceEditorScene.jsx:445` —
`region.definitionKey === 'gas' ? '#a3e635' : region.definitionKey === 'flooded' ? '#38bdf8' :
'#fb7185'`. Deux cas spéciaux (gaz vert, inondé bleu), TOUT LE RESTE retombe sur la même couleur
saumon à opacité 0,13 — donc aujourd'hui, les ~15 nouvelles entrées RAW (tous les feux, l'acide, la
décompression, les radiations, tous les gaz RAW) sont visuellement identiques sur la carte. Avec
seulement 5 types ce défaut passait presque inaperçu ; avec 20, il devient bloquant : impossible de
distinguer un « grand feu » d'une « décompression » posée à côté sans rouvrir la liste et lire
l'étiquette de chacune une par une.

**Trouvé en creusant, non signalé par Saar mais réel** : le champ `puissance` (Z2 étape 4, ajouté
aujourd'hui côté serveur) n'a AUCUN champ dans ce panneau — seules l'intensité et la hauteur du
volume sont éditables. Un MJ ne peut pas encore renforcer une zone depuis l'interface. Aucune trace
non plus de la durée restante dans la liste « Effets actifs » (juste le label et l'intensité).

**Trouvé en creusant, violation d'une règle du projet** : tout le texte de cet écran est en dur en
français, jamais passé par `t()` — « Région environnementale », « Effet », « Intensité », « Hauteur
du volume », « Nouvel effet MJ », « Clé technique », « Nom », « Multiplicateur de déplacement »,
« Note / règle MJ », « Créer et sélectionner », « Effets actifs », « Supprimer ». Chaque autre bloc
de ce même fichier (Salle, Mur, Connecteur) passe déjà par `useTranslation()` — l'écran Zones
dangereuses est le seul oublié, `.claude/rules/react.md` l'interdit formellement.

### 6.2 — Proposition de rework (toujours dans le périmètre Z6, zéro code fait)

Rien ci-dessous n'est codé. Ordre proposé du moins coûteux au plus structurant — chaque point est
indépendant, aucun ne nécessite un changement serveur (tout ce qu'il faut existe déjà côté base
depuis Z0→Z2) :

1. **i18n d'abord** (§ règle du projet) — sortir les ~12 chaînes en dur vers `builder.json`/`fr.json`
   avant de toucher à autre chose : sinon chaque point suivant ajoute encore plus de texte en dur à
   défaire ensuite.
2. **Regroupement du menu par catégorie** — `<optgroup>` sur `definition.category` (déjà servi par
   `serializeDefinition`, aucun changement serveur). Coût : quelques lignes, gain immédiat sur le
   grief le plus visible (20 entrées en vrac).
3. **Couleur/occlusion par catégorie** — remplacer le double `? :` de `SurfaceEditorScene.jsx:445`
   par une petite table `category → couleur` (feu, acide, gaz, radiation, décompression, + les 5
   legacy) au lieu d'un cas spécial par clé technique. Rend chaque zone reconnaissable au premier
   coup d'œil sans ouvrir aucun panneau.
4. **Fenêtre flottante dédiée** — extraire un `SurfaceEffectPanel.jsx` sur le patron exact de
   `SurfaceRoomPanel.jsx`/`SurfaceWallPanel.jsx` (`FloatingPanelSection`, position mémorisée) :
   récupère gratuitement tout ce que `165be2b` vient d'apporter aux trois autres.
5. **Sélection = édition** — un clic sur une zone existante (dans la liste « Effets actifs » ou
   directement dans la scène 3D) charge ses valeurs dans le panneau au lieu d'ouvrir seulement un
   bouton « Supprimer » ; valider modifie l'instance (`updateWorldEffectInstance`, déjà existant côté
   serveur, jamais appelé côté client aujourd'hui) au lieu d'en créer une nouvelle.
6. **Champ `puissance`** — ajouter le champ manquant au panneau (et l'afficher dans la liste des
   zones actives, avec la durée restante si l'instance en a une).

Ordre 1→3 est purement additif et sans risque (aucun contrat existant ne change). 4→6 touchent la
structure du composant (nouvelle fenêtre flottante, nouveau flux de sélection) — plus proches d'un
vrai incrément Z6 qu'd'une correction ponctuelle, à cadrer normalement (plan exact, analyse à
charge) avant de coder, comme toute autre étape de ce plan.

**Chevauchement avec S1 — vérifié, levé (2026-09-27, réponse META EDITEUR)** : le patron de fenêtre
flottante existe déjà et n'attend aucun audit S1 séparé — `client/src/lib/floatingPanel.js`
(`useDraggablePanelPosition`, position mémorisée en localStorage par type de panneau) consommé via
`FloatingPanelSection.jsx`, déjà adopté par `SurfaceRoomPanel.jsx`/`SurfaceWallPanel.jsx`/
`SurfaceConnectorPanel.jsx` (`165be2b`) et `EntityInstancePanel.jsx` (autre domaine). Le point 4
(« fenêtre flottante dédiée ») doit rejoindre cette même famille, pas en inventer une nouvelle. Les
5 autres points ne touchent pas ce patron — confirmé sans dépendance à vérifier.
| **Z7** | Joueur — avertissement **non bloquant** si le chemin déclaré traverse une zone visible ; zones `cachée` masquées aux joueurs. | client | build + session Saar |

**Noyau v1 = Z0 → Z5.**

**Validation** (`AGENTS.md` clôture) : Z0 = `node --check` + tests purs ; Z1–Z5 = combat + monde +
migration → **scénario réel Saar + build client** à chaque incrément ; Z6–Z7 = build + validation
visuelle Saar.

**Décision F4** : `centreDedans` seul en v1 — le geyser de flamme ultra-localisé ne mord que si le
centre du token est dans le volume ; `toutRecouvrement` = v2 si le jeu réel le réclame.

---

## 7. Interface MJ

> **Principe (Saar)** : le MJ a beaucoup de prép par battlemap. Poser une zone doit être **rapide,
> peu de clics**. Concevoir pour les **90 %** (préréglages + « remplir une pièce ») + l'**exception**
> (« Personnalisé »).

### 7.1 Le noyau (Z0→Z5) n'exige **presque aucun** travail d'éditeur

Preuve Z2 = **insert manuel** d'une instance. Z3 (grenade) **crée l'instance depuis le combat**,
sans éditeur. L'outil effet **existant** de l'Editor3D (glisser un rectangle + hauteur → une AABB
`world-effects/instances`) suffit à tout valider. **Aucun travail d'éditeur n'est sur le chemin
critique du noyau.**

### 7.2 Éditeur E-v1 (incrément Z6) — petit, sans géométrie neuve

- **Porter l'outil sur le plateau de session** (`Canvas3D.jsx`) : MJ-only, aperçu optimiste +
  confirmation serveur. Aujourd'hui il n'existe que dans l'Editor3D de prépa ; `Canvas3D` ne fait
  que **rendre** les régions (`runtimeEffectRegions`), aucun handler de création.
- **Flux** : bouton par **catégorie** (feu · eau · acide · gaz · …) → **préréglage** (chaque `key`
  du catalogue = un bouton : braise · petit · grand · brasier) → **géométrie**, **deux modes** :
  - **« Remplir un compartiment »** — `targetKind:'compartment'`. **Zéro géométrie neuve** :
    `worldEffects.instanceBounds()` unionne déjà les AABB de la pièce ciblée et
    `compileEffectRegions` la sort déjà. Couvre « la salle est en feu », « le sas se remplit de
    gaz » — la majorité des cas MJ.
  - **Rectangle + hauteur** — l'outil actuel (`normalizeCellSelection` → AABB, `baseY + effectHeight`),
    tel quel.
- **Bouton « Personnalisé »** → fenêtre dédiée, tous les champs du contrat (§3) → **définition
  custom** (`world_effect_definitions`) + son instance. Un bloc de formulaire par ligne d'effet
  (menu `type` → champs du type), `escalade` / `remanence` / `attenuations` en sous-blocs repliés.
  Pas de texte libre sauf libellés et formule de dés. **90 % ne l'ouvriront jamais.**
- **Bascule aperçu MJ ⇄ joueur** + respect d'un flag `cachée` (instance masquée aux joueurs).

### 7.3 Éditeur E-v2 — le sculpteur de volume (**hors de ce plan**, cf. §12)

Ellipse · rectangle pivoté · **polygone** (formes ordonnées, ajout/soustraction de trous,
point-dans-région) · poignées sur canvas (déplacer / redimensionner / pivoter) · « tracer depuis
les murs ». Exige une **géométrie 2D de région dans `shared/world` qui n'existe pas**
(`aoeShapes.js` = circle/cone/ray transitoire ; les salles compilées sont des empreintes de cases).
**Ce primitif est celui du rework du world builder** — le construire ici = un second moteur
d'édition de forme (invariant 2). E-v2 est un **consommateur** du rework world builder. Voir §12.

---

## 8. Décisions Saar — récap (2026-09-10)

| Réf | Décision |
|---|---|
| **Architecture** | registre unique + refonte `environmentalHazardService` (pas de 2ᵉ tick) ; catalogue code ; `puissance` **additif** ; `protections` JSONB ; interaction par tags |
| **Hors combat** | HORS SCOPE |
| **Nuage** | intégré (spec de consommateur) ; propagation instantanée (RAW), pas de mode « propagation lente » |
| **A1 feu** | 4 préréglages RAW + « Personnalisé » |
| **A2 Souffle** | timer commun + N conséquences (pas unification totale) |
| **A3 acide** | même résolveur que le feu |
| **A4 gaz** | 6 descriptions `PLAN_NUAGE` §3 fidèles au livre ; préambule §Gaz ajouté (§5.3) |
| **B1/B2 ignifugé** | `protections['hazard:fire']` (aucun seed) + `attenuation` `arbitrate` ; pas de réduction auto |
| **B3 brasier** | toutes Localisations, mort garantie en 1 Tour |
| **C1 acide** | double champ MJ : dégât + durée |
| **C2 corrosion équipement** | v2 (contrat le prévoit dès Z0) |
| **C3/D5 données** | migration = suppression des 6 valeurs corrompues |
| **D1 puissance gaz** | = le facteur `puissance` unifié |
| **D2 plafond escalade** | pas de plafond |
| **D3 retenir sa respiration** | ½ de l'effet / Tour, coût Souffle |
| **D4 gaz v1** | catalogue complet dès Z0 ; preuve #2 = `gaz:irritant` + `gaz:décomposant` (100 % RAW v1) |
| **D6 immunité gaz** | `protections['atmosphere:gas']` avec `scope` / `except` (masque partiel, insuffisant neuro) |
| **E1 activité Souffle** | dérivée (arme au clair → −4 ; sinon gait ; sinon −1) |
| **E2 surpris** | Souffle max ÷ 2 |
| **F1 stacking** | `max` par catégorie |
| **F2/F3 chaining / interaction** | forme dans le contrat, 0 résolveur / 0 règle v1 (MJ arbitre) |
| **F4 recouvrement** | `centreDedans` seul v1 |
| **F5 remanence conditional** | persiste + retrait MJ manuel |
| **F6 milieu sous-marin/0G** | v2 ; défaut salle + override zone |
| **Éditeur de volume** | E-v1 = Z6 (rectangle + « remplir un compartiment », plateau de session) ; sculpteur polygone E-v2 = après le rework world builder (§12) |

---

## 9. v2 — différé (chacun = 1 résolveur de plus, contrat déjà en place)

`test` (Tests CON des gaz) · `statLoss` (suffocant / neurotoxique) · `chance` (Tests de Chance) ·
`drainResource` (Souffle + cascade Athlétisme) · `skillOverride` (sous-marin / 0G — réconcilier avec
`PLAN_ENVIRONNEMENT_MILIEUX`) · `forcedMove` (courant) · `accumulateLevel` (radiations → Fatigue &
Dommages Lot 9) · `corrodeEquipment` (acide → équipement, Usure L5) · `chain` (feu → fumée / air
vicié) · `géométrie.animation` (eau qui monte, nuage qui dérive) · `zoneInteractionRules` non vides ·
pièges (`cachée jusqu'à détection` + désamorçage) · `toutRecouvrement` · « enflamme la cible »
(feu qui suit hors zone) · préréglages UI riches · **éditeur E-v2** (sculpteur de volume polygone —
consommateur du rework world builder, §12).

---

## 10. Reste à faire (aucun code dans la conversation de cadrage)

1. **Plans détaillés Z0 (§13) et Z1 (§14)** = faits 2026-09-10. Chacun a une liste de points pour
   son propre tour d'analyse à charge (§13.7, §14.8) — à faire au moment de coder, pas maintenant.
2. **Validation Saar de §5 (RAW)** — §5.3 gaz déjà vérifié ; §5.5 Souffle : le cadre « timer commun »
   est une inférence mais **acceptée de fait** via les décisions E1/E2 (§8), et c'est du v2. Rien
   d'ouvert qui bloque.
3. **Pas de `PLAN_ZONES_DANGER_EDITEUR.md` à ce stade.** L'éditeur E-v1 tient dans §7.2 (incrément
   Z6). Le sculpteur de volume E-v2 sera cadré dans le sillage du rework world builder — conversation
   séparée, voir §12.

---

## 11. Historique

- **2026-09-09** — trouvaille (chantier grenades 3-bis) : la mécanique zones dangereuses est un
  échafaudage. Cadrage ouvert.
- **2026-09-09/10** — 5 cas RAW + 4 scénarios de stress + recherche pro (Foundry, PF2e, Fantasy
  Grounds, GAS, DOS2, Caves of Qud) + 3 analyses à charge. Décisions A→G tranchées avec Saar.
- **2026-09-10** — réécriture propre de ce document (consolidation). Trail détaillé : commits
  `fe0235e`..`47f3df7` sur `dev/Saar`.
- **2026-09-10** — recherche éditeurs de région pro (Foundry Scene Regions, Owlbear Fog, Talespire) +
  reconnaissance du code client. Constat : l'éditeur de volume polygone partage son primitif avec le
  rework world builder à venir → resserrement (§7 scindé E-v1 / E-v2, §12 séquencement, abandon d'un
  `PLAN_ZONES_DANGER_EDITEUR.md` autonome).
- **2026-09-10** — recon du système « dangers environnementaux » (Lot 3) : `environmentalHazardRegistry.js`
  + `environmentalHazardPresets.js` + `TokenStatusPanel.jsx` recensés (§1.2). §2.B précisé (absorption
  presets / dérivation registre / remplacement du tick codé en dur). Brasier `3D10` toutes Loc
  re-confirmé (écart avec l'ancien preset `inferno locations:1` noté §5.1). `locationMode` mappé sur
  la précédence existante (§3).
- **2026-09-10** — stub `PLAN_WORLD_BUILDER_REWORK.md` (le primitif d'édition 2D est partagé) ;
  renvoi `PLAN_FATIGUE_DOMMAGES` §9 → §2.B ; ROADMAP rafraîchie. **Plans détaillés Z0 (§13) et Z1
  (§14) écrits** — Z1 découpé en 4 sous-étapes (registre / bascule du tick / absorption presets +
  résolveurs / migration `ref_equipment`).
- **2026-09-10** — analyse à charge du plan complet (Saar). Corrections : `hazardCode` +
  `forcedLocation` niveau **définition** ajoutés au contrat (§3, §13.3) — sans eux Z1.4 ne pouvait pas
  dériver `environmentalHazardRegistry` ; convention `locations` clarifiée (pas de `0` magique,
  `locationMode:'all'` ⟹ `locations` ignoré) ; §2.A précise que `effectLineResolverRegistry` = *forme*
  `weaponModService` mais *sémantique* lookup-par-type sans agrégation (invariant Lot 3 préservé) ;
  §5.5 dédupliqué ; instance `geometry` vs `targetKind` existant = réconciliation explicitement
  reportée à Z2, orthographe `compartment` ; INDEX.md §6 complété.
- **2026-09-27** — **Z0 codé** (`shared/world/dangerEffectLines.js`, `shared/world/dangerCatalog.js` +
  extension additive de `worldEffects.js`, tests aux 3 fichiers). Recherche externe avant code :
  Foundry pf2e (`foundryvtt/pf2e`, Rule Elements — registre clé→classe builtin+custom, clé inconnue =
  log + skip jamais un throw, un fichier par type) confirme l'architecture registre/dispatch déjà
  retenue contre un système mature en production, pas seulement des principes de design (GAS/DOS2 déjà
  cités). Corrections trouvées en écrivant (le plan divergeait de son propre contrat sur ces points,
  jamais un choix RAW) :
  - `EFFECT_KEY_RE` (`worldEffects.js`) élargie pour accepter `:` — aucune clé namespacée
    (`feu:grand`, `gaz:irritant`) n'aurait passé la validation existante.
  - Clés catalogue toujours ASCII, jamais accentuées (`gaz:décomposant` → `gaz:decomposant`, `vésicant`
    → `vesicant`) — convention machine/label déjà en vigueur partout ailleurs (labels accentués,
    codes ASCII) ; §4 les écrivait accentuées par glissement, jamais une décision RAW.
  - `modifier` (ligne) gagne `valueFromFailMargin`/`cumulative` (optionnels) : le `test.onFail` de
    gaz:irritant (§4) n'a pas de `value` fixe, sa magnitude vient de la marge d'échec — absent du
    tableau générique §3, présent dans l'exemple.
  - `attenuations[].tag` accepté en synonyme de `key` (§4 gaz:irritant, entrée `behavior` écrite avec
    `tag` pas `key`) + champ `cost` optionnel (ressource dépensée, ex. `souffle`).
  - Une ligne IMBRIQUÉE (`test.onFail`, `chance.onSuccess/onFail`, `drainResource.onEmpty`) ne porte
    pas de `phase` (ressort `phase:null`) — les exemples §4 n'en donnaient jamais une, l'exiger cassait
    le contrat déjà écrit.
  - `DANGER_CATALOG` est un objet plain gelé, jamais un `Map` : `Object.freeze(map)` ne bloque pas
    `.set()`/`.delete()` (piège JS), seul un objet gelé l'empêche vraiment — même patron que
    `BUILTIN_WORLD_EFFECTS`.
  - `hazardCode` n'est renseigné que pour les 3 familles déjà couvertes par le Lot 3 (`feu:*`→`burning`,
    `acide:capsule`→`acid`, `decompression`→`decompression`) — gaz et radiations n'ont pas encore de
    condition token Lot-3-style, `hazardCode` y reste `null` (pas une valeur inventée) ; la dérivation
    Z1.4 doit dédupliquer les 4 `feu:*` sur un seul code `burning`.
  - **4 entrées gaz restées à sourcer verbatim** (`gaz:vesicant`/`suffocant`/`neurotoxique`/`assommant`) :
    écrites à partir du tableau condensé §5.3 (déjà `[VÉRIFIÉ Livre de Base, Saar]` pour ses CHIFFRES),
    mais avec des mappings `[HYPOTHÈSE]` marqués en commentaire dans `dangerCatalog.js` — **à confirmer
    par Saar contre le Livre de Base avant de les considérer RAW-closes** : `damageType:'gaz'` du
    vésicant (aucune analogie "comme le feu" sourcée, contrairement au décomposant) ; `skill:'choc'` de
    l'assommant (code de compétence non vérifié contre l'implémentation réelle du Test de Choc) ; la
    persistance "même hors zone" du neurotoxique (RAW) n'a aucun champ dans le contrat de ligne `test`
    actuel (seuls damage/status/modifier portent une rémanence) — signalé en commentaire, aucun champ
    inventé pour la contourner, à trancher explicitement au cadrage du résolveur `test` (v2).
  - Validation : `node --check` ×3, `node --test` ciblé (39 tests Z0) + `node --test 'shared/**/*.test.mjs'`
    (915 tests, zéro régression) + `git diff --check`. Aucun consommateur en Z0 : comportement de jeu
    inchangé, confirmé par le test de non-régression des 5 builtins legacy.
- **2026-09-27 (suite)** — **Z1.1 codé** : `server/src/services/effectLineResolverService.js`
  (`resolveDamageLine` + `RESOLVERS`/`findEffectLineResolver`, patron `weaponModService.js` — carte
  locale, jamais un throw pour un type sans résolveur). **Simplification vs §14.2** : le
  `shared/world/effectLineResolverRegistry.js` prévu par le plan (`{type, phase, validateParams}`)
  n'est PAS créé — ce vocabulaire existe déjà dans `dangerEffectLines.js` (Z0, `EFFECT_LINE_TYPES`/
  `TYPE_NORMALIZERS`), le recréer aurait été un 2ᵉ moteur de validation (invariant 2). La carte
  type→résolveur reste côté serveur seul, comme `weaponModService.js` le fait déjà pour ses hooks.
  `resolveForcedSlotCodes` implémente la précédence §3 (définition > ligne > mode, `'all'` = les 6
  Localisations RAW une fois chacune, `locations` ignoré) — logique NEUVE, la boucle historique de
  `resolveEnvironmentalHazardTicks` ne connaissait qu'un seul `forcedSlotCode` répété. `armorFactor`
  (Z0) branché sur `resolveTargetHit({armorReductionFactor})` (valeur 1 partout au catalogue → aucun
  effet observable aujourd'hui, `damageService.js` n'agit que si `!== 1`). Rien n'appelle ce service
  (Z1.2 = la bascule). Test d'intégration base locale (5 cas, fixture créée/nettoyée, patron
  `deathStateService.test.mjs`/`woundService.test.mjs` NO_CHANCE) : résolveur inconnu → `undefined` ;
  `locationMode:'exposed'` + choix MJ → 1 frappe à l'endroit choisi, blessure posée ; `locationMode:'all'`
  (`feu:brasier`) → 6 frappes, une par Localisation, `locations:null` bien ignoré ; `forcedLocation` de
  définition (`decompression`) prime sur la ligne ; token sans personnage → neutre, aucune émission.
  **Non-régression à surveiller en Z1.2** (pas un blocage Z1.1) : sous ce modèle, `acide:capsule` a
  `locationMode:'random'` (texte littéral du plan §4) — un `forcedLocation` MJ posé aujourd'hui sur une
  exposition Acide via `/hazards/acid/expose` ne sera plus honoré après la bascule (seul `'exposed'` lit
  l'instance, §3 texte littéral). À confirmer avec Saar en session au moment de Z1.2, pas avant.
- **2026-09-27 (suite) — Z1.2 codé** (bascule réelle, incrément le plus risqué du plan) :
  `combatTurnEngine.js` appelle désormais `effectLineResolverService.js:resolveActiveEffects` au lieu
  de `resolveEnvironmentalHazardTicks` (supprimée, plus aucun appelant — import mort retiré aussi de
  `socketCombatHelpers.js`, confirmé par grep avant suppression : aucun autre appelant réel dans tout
  `server/`, seuls 3 fichiers la citaient en commentaire). **Non-régression stricte respectée** :
  `resolveActiveEffects` reconstruit une ligne `damage` depuis `token_statuses.data` (jamais depuis
  `dangerCatalog.js` — la note d'en-tête du fichier l'explicite) ; `entry.forcedLocation` (registre
  INCHANGÉ) prime toujours, exactement comme avant ; l'ancienne précédence
  `entry.forcedLocation ?? data.forcedLocation ?? aléatoire` est préservée à l'identique (donc
  l'inquiétude notée au-dessus pour Z1.1 — Acide qui perdrait son `forcedLocation` MJ — **ne se
  matérialise PAS** : `resolveActiveEffects` la contourne en injectant `data.forcedLocation` directement
  dans `line.forcedLocation`, jamais via `instanceForcedLocation`/`locationMode:'exposed'` qui l'aurait
  ignorée. Le point à surveiller décale donc à Z1.3+, quand la lecture basculera vers le catalogue).
  **Bug réel trouvé et corrigé par un test, pas par relecture** : `resolveForcedSlotCodes` (Z1.1)
  renvoyait la CLÉ de Localisation (`'bras_gauche'`) au lieu du slotCode attendu par `resolveTargetHit`
  (`'BG'`) — `damageService.js:354` (`SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'`) absorbait l'erreur en
  retombant SILENCIEUSEMENT sur `'corps'`, ce qui faisait passer à tort les tests Z1.1 (qui testaient
  tous une Localisation forcée = `'corps'`, jamais une autre). Trouvé par le test « Acide/bras_gauche »
  de Z1.2 (seul cas testé avec une Localisation forcée ≠ corps) ; corrigé (conversion `LOCATION_TO_SLOT`
  ajoutée dans `resolveForcedSlotCodes`) ; 9/9 tests dédiés + 127 tests serveur des fichiers liés
  (`combatTurnEngine.test.mjs` inclus) + `node --test 'shared/**/*.test.mjs'` (915) tous verts après
  correction. Aucun résidu de fixture (vérifié par lecture de la base). `git diff --check` propre.
- **2026-09-27 (suite) — Z1.3 partiel : `ENVIRONMENTAL_HAZARD_REGISTRY` dérivé.**
  `shared/environmentalHazardRegistry.js` n'est plus la source : `deriveEnvironmentalHazardRegistry()`
  construit le tableau depuis `dangerCatalog.js` (dédup par `hazardCode`, ordre figé
  `['acid','decompression','burning']` pour ne pas casser les tests `deepEqual`, `lingersOnClear`
  dérivé de `remanence==='fixed'` sur la ligne damage — trouvaille du run à vide §14.8 pt7, appliquée
  ici). **Sortie bit-à-bit identique** à l'ancien tableau littéral (vérifié directement en chargeant le
  module). Les 3 tests existants (`environmentalHazardRegistry.test.mjs` — deepEqual strict,
  `tokenStatusRegistry.test.mjs`, `dangerCatalog.test.mjs`) passent **sans modification** (pas
  « portés » : ils n'avaient pas besoin de changer, la dérivation reproduit l'ancien contrat au bit).
  `TokenStatusPanel.jsx` (client) importe ce fichier directement — chaîne d'import vérifiée sans aucun
  module server-only (`crypto`/`db`), **build client relancé et vert** pour le confirmer, pas seulement
  lu.
  **Volontairement PAS fait dans ce lot** (périmètre resserré, deux raisons distinctes) :
  1. `shared/environmentalHazardPresets.js` / `TokenStatusPanel.jsx` — absorption reportée. Le
     formulaire d'exposition manuelle n'a pas de notion de `locationMode` ; représenter `feu:brasier`
     (`locationMode:'all'`) dans ce formulaire texte n'a pas de traduction honnête aujourd'hui
     (`locations:null` → un champ texte qui afficherait littéralement "null"). Question produit/UX
     (le brasier doit-il être exposable à la main via ce panneau, ou seulement via une zone/un
     lance-flammes plus tard ?), pas une décision d'archi pure — à trancher avec Saar au moment de Z6
     (éditeur MJ) plutôt que de forcer une réponse maintenant. Zéro régression : fichier non touché.
  2. Résolveurs `note` / `status` / `modifier` (base) — non ajoutés : **aucune ligne du catalogue
     actuel n'est atteignable par un chemin réel** (les lignes `modifier`/`status`/`chance` n'existent
     que sur les gaz, dont `hazardCode` reste `null` — `getAllHazardCodes()` ne les remonte pas, donc
     `resolveActiveEffects` ne les verra jamais avant Z5). Les construire maintenant serait un « v2
     inventé sans besoin exprimé » (piège inverse déjà noté par Saar, chantier drones). `modifier`
     attend de toute façon Z4 (`ACTIVE_MALUS_SOURCES`) pour avoir un sens complet.
  Reste donc de Z1 : **Z1.4** (migration `ref_equipment`, §14.5 — nettoyage isolé, faible risque).
- **2026-09-27 (suite) — Z1.4 codé. Z1 est clos.** Migration `367_fix_ref_equipment_gas_mechanic_text.js`
  (numéro vérifié sur `ls migrations/` **et** `knex_migrations`, pas depuis EN_COURS.md — piège connu
  de la règle migrations). **Les 6 lignes réellement corrompues ont été interrogées en base avant
  d'écrire quoi que ce soit** (invariant 1 : ne pas recopier §5.4 tel quel) — confirmation exacte :
  Grenade+Capsule pour décomposants/vésicants (colonne `nation`) et assommants (colonne `damage_h`),
  6 valeurs exactes obtenues par requête directe. Les 6 lignes irritant/neurotoxique/suffocant
  (Grenade+Capsule) étaient bien déjà `null` ; la ligne Acide (`damage_h:'1D10'`) est propre (une
  formule y est normale, pas une corruption) — vérifié, pas supposé.
  **nodemon tournait réellement en tâche de fond** (une autre session a la stack dev lancée) :
  la migration s'est auto-appliquée à l'écriture du fichier, détecté en interrogeant
  `knex_migrations` AVANT d'appeler `up()` moi-même (règle `migrations.md`, pour ne jamais la
  rappeler à l'aveugle sur des données déjà correctes). Round-trip testé en important le module et en
  appelant `down()` puis `up()` directement (jamais la CLI knex) : restauration exacte des 6 valeurs
  d'origine puis re-nettoyage confirmés par lecture directe de la base ; un 3ᵉ `up()` sur des lignes
  déjà propres lève bien l'erreur de garde prévue (`"nation" inattendu... déjà nettoyé ?`), pas une
  corruption silencieuse. État final vérifié : les 6 lignes sont propres. Aucun test existant ne
  référence les anciennes valeurs (grep négatif hors seeds d'origine et cette migration).
  **Z1 est maintenant clos dans son ensemble** (Z1.1→Z1.4) : bascule réelle faite et testée, registre
  dérivé du catalogue, données corrompues nettoyées. Reste, hors Z1 : Z1b (protections JSONB), Z2
  (balayage spatial — le premier incrément qui rend une zone posée sur une carte réellement active),
  Z3 (grenade incendiaire), Z4 (modifier complet), Z5 (preuve gaz), Z6/Z7 (éditeur MJ, avertissement
  joueur). Les 3 points volontairement différés plus haut (presets/TokenStatusPanel, résolveurs
  note/status/modifier, les 4 gaz `[HYPOTHÈSE]`) restent ouverts, chacun rattaché à l'incrément où il
  redeviendra pertinent.
- **2026-09-27 (suite) — Z2 démarré, découpé en sous-étapes (le plan ne le faisait pas, contrairement
  à Z1) : 1/ requête spatiale pure ; 2/ branchement au Tour + pose de condition ; 3/ expiration
  (`duration_rounds`) ; 4/ champ `puissance`.**
  **Sous-étape 1 codée** (recherche externe faite avant code : les événements de région de Foundry VTT
  V12+ — `TOKEN_ENTER`/`TOKEN_EXIT`/`TOKEN_MOVE_WITHIN`/`TOKEN_TURN_START`/`TOKEN_ROUND_START` —
  confirment que la distinction déjà retenue ici, enter/exit one-shot vs balayage 1×/Tour, est le
  découpage standard d'un système de zones dans un moteur de jeu en production, pas une invention).
  `shared/world/worldEffects.js:tokensInsideEffectRegions` (pure, "centreDedans" F4, réutilise
  `pointInsideEffectBounds` déjà existant — même primitif que `collectPointEffectHooks`, généralisé à
  plusieurs tokens) + `server/src/services/worldSpatialQueryService.js:tokensInsideEffectVolume`
  (wrapper IO mince, patron `queryTokensInShape` du même fichier — même réconciliation d'ascenseurs).
  6 tests purs sur la primitive (chevauchement de zones, frontière incluse, cas vides). Le wrapper
  IO n'a PAS son propre test dédié : construire une `surface_data` réelle pour ça seul aurait été
  disproportionné (aucun test existant ne le fait pour tout `worldEffectService.js`) — il sera exercé
  pour de vrai par l'étape 2 (preuve du plan : « insert manuel zone feu:grand → un token dedans brûle
  chaque Tour »), ce qui est un test plus significatif qu'un test isolé du wrapper seul. `node --test
  'shared/**/*.test.mjs'` = 918 (915+3), zéro régression, zéro consommateur encore (comme Z0).
- **2026-09-27 (suite) — Z2 étape 2 codée : branchement au Tour, comportement visible.** Trouvaille
  AVANT code (lecture, pas hypothèse) : `effectDefinitionRegistry`/`compileEffectRegions`/
  `createWorldEffectInstance` ne connaissaient QUE les 5 builtins legacy (`fire`/`flooded`/`gas`/`oil`/
  `unstable`) + le custom MJ (`world_effect_definitions`) — jamais `dangerCatalog.js` (Z0). Poser une
  zone `feu:grand`/`decompression`/`acide:capsule` aurait donc échoué (« Définition d'effet inconnue »)
  avant même d'atteindre le balayage. C'était noté « à trancher en Z2 » (§3, commentaire
  « Réconciliation avec l'existant ») — tranché : `worldEffectService.js:loadWorldEffectDefinitions`
  fait rejoindre `listDangerDefinitions()` aux lignes custom (un seul point d'entrée, déjà utilisé par
  tous les consommateurs) ; les entrées catalogue sont déjà normalisées (`builtin:true`) mais
  `effectDefinitionRegistry` les re-normalise avec `custom:true` (elle ne fait pas la différence) —
  effet cosmétique uniquement (`definition.builtin` n'est lu que par la liste UI de l'éditeur, pas
  construite avant Z6), noté ici pour ne pas être oublié, pas corrigé maintenant (pas dans le périmètre
  de cette étape).
  **Le balayage** (`effectLineResolverService.js:sweepZoneExposure`, appelé depuis
  `combatTurnEngine.js:startResolutionPhase` juste avant le tick `resolveActiveEffects` existant,
  résolution de la carte active = `campaigns.current_battlemap_id` repli `default_battlemap_id`, même
  patron que `woundService.js:healCampaignCharacters`) réutilise `exposeToHazard`/`clearHazard` (Lot 3,
  MJ-manuel) plutôt qu'une 2ᵉ voie d'écriture de `token_statuses` : une zone qui expose EST la même
  mécanique qu'un MJ qui expose à la main, seule la source diffère. `exposeToHazard` gagne deux clés
  optionnelles (`zoneInstanceId`, `remanence`) écrites dans `data` UNIQUEMENT quand l'appelant est le
  balayage — le chemin MJ-manuel produit exactement le même `data` qu'avant (non-régression). Sortie
  de zone : `remanence:'none'` (feu/décompression) → `clearHazard` immédiat ; `remanence:'fixed'`
  (acide) → `clearHazard({linger:true})`, réutilise le `lingersOnClear` déjà dérivé en Z1.3.
  Deux limites connues et acceptées (déjà présentes ailleurs dans le système, pas introduites ici) :
  1/ deux zones qui partagent le même `hazardCode` sur un même token (ex. deux feux qui se recouvrent)
  ne s'agrègent jamais (« zéro agrégation », §2 architecture) — sortir de l'une peut éteindre la
  condition même si l'autre couvre encore, comme deux expositions manuelles du même danger se
  seraient déjà écrasées (commentaire « décision G », `environmentalHazardService.js`) ; 2/
  `feu:brasier` (`locationMode:'all'`) est exposé comme un feu à Localisation unique — `resolveActiveEffects`
  force encore `locationMode:'random'` (§14.3), exactement le même écart que le préréglage "inferno"
  du panneau MJ actuel (`environmentalHazardPresets.js`, `locations:1`), déjà rattaché à Z6.
  **Testé** : 3 nouveaux tests dans `effectLineResolverService.test.mjs` (12 au total, tous verts) —
  zone `feu:grand` posée par `createWorldEffectInstance` → un token dedans reçoit `burning`
  (`data.zoneInstanceId`, `expires_at_turn:null`) → le token sort (déplacé hors du volume) → la
  condition disparaît immédiatement ; même scénario avec `acide:capsule` → la sortie laisse une
  persistance (`expires_at_turn` posé, la ligne reste) au lieu de disparaître ; aucune zone/roster/
  carte → aucune exception. `node --test 'shared/**/*.test.mjs'` = 918 (inchangé, aucun fichier
  partagé nouveau). Résidu de fixture vérifié par lecture directe de la base : zéro ligne de test
  restante (les 4 `world_effect_instances` `fire`/`gas` trouvées en base sont les zones posées par
  Saar lors de son test en jeu du 2026-09-27, pas touchées). Build client vérifié (aucun changement
  server-only ne devait le casser, confirmation systématique). **Non testé** : le passage réel par
  `combatTurnEngine.js:startResolutionPhase` (un vrai Tour de combat) — les tests exercent
  `sweepZoneExposure` directement ; câbler `combat_state`/`campaigns.current_battlemap_id` pour un
  scénario de combat complet aurait dupliqué la fixture déjà lourde de `combatTurnEngine.test.mjs`
  sans rien vérifier de plus sur CETTE fonction. Reste Z2 étape 3 (expiration `duration_rounds`) et
  étape 4 (`puissance`).
- **2026-09-27 (suite) — Z2 étape 3 codée : expiration `duration_rounds`.** Symétrique de l'étape 2 :
  décrément en FIN de Tour (`combatTurnEngine.js:endTurn`), balayage de présence en DÉBUT de Tour
  (étape 2, inchangée). `worldEffectService.js:tickWorldEffectInstanceDurations` (neuf) décrémente les
  instances actives à `duration_rounds` non nul, passe `state:'expired'` à 0 — ne touche JAMAIS
  `token_statuses` : `compileEffectRegions` filtre déjà `state!=='active'` (vérifié en lisant le code
  avant d'écrire, pas supposé), donc le balayage du Tour suivant ne verra plus l'instance expirée et
  retirera lui-même la condition posée (logique déjà en place, étape 2) — pas une 2ᵉ voie de retrait à
  maintenir en parallèle. `WORLD_RUNTIME_UPDATED{kind:'effect-expired'}` émis UNIQUEMENT si une
  instance a réellement expiré ce Tour (une simple décrémentation ne rafraîchit rien côté client —
  aucun rendu de `duration_rounds` avant Z6, l'émettre à chaque Tour aurait été du bruit réseau gratuit).
  Petit refactor en passant : la résolution `current_battlemap_id ?? default_battlemap_id`, dupliquée
  entre l'étape 2 (`startResolutionPhase`) et cette étape (`endTurn`), extraite en
  `resolveActiveBattlemapId(campaignId)` (une seule fois, appelée aux deux endroits).
  **Testé** : 3 tests neufs dans `server/src/services/worldEffectService.test.mjs` (fichier qui
  n'existait pas — premier test dédié à ce service) : décrément + expiration à 0 + permanente jamais
  touchée ; `runtimeRevision` bumpée seulement quand une expiration réelle a lieu (pas à chaque simple
  décrément) ; aucune instance à durée finie → aucun effet, jamais un throw. `node --test
  'shared/**/*.test.mjs'` = 918 (inchangé), tests ciblés en base = 55/55 (effectLineResolverService +
  worldEffectService + combatTurnEngine), build client vérifié, aucun résidu de fixture (les
  `world_effect_instances` `fire`/`gas` restantes en base sont celles de Saar, pas touchées).
  **Non testé** : le passage réel par `combatTurnEngine.js:endTurn` en combat (même raisonnement que
  l'étape 2 — `tickWorldEffectInstanceDurations` est exercée directement, câbler tout `combat_state`
  pour ce seul ajout aurait dupliqué la fixture de `combatTurnEngine.test.mjs` sans rien vérifier de
  plus sur cette fonction précise). Reste Z2 étape 4 (`puissance`, migration).
- **2026-09-27 (suite) — Z2 étape 4 codée : champ `puissance`. Z2 est clos dans son ensemble.**
  Migration `368_world_effect_instances_puissance.js` : colonne `numeric(10,4)` défaut `0` (déjà
  auto-appliquée par nodemon avant mon propre `up()` — vérifié dans `knex_migrations` avant de rien
  rappeler, round-trip `down()`/`up()` direct confirmé, jamais la CLI). `puissance` = **entier signé**
  (§2.E), toujours additif, jamais un mode `multiply` — distinct d'`intensity` (multiplicatif,
  géométrie/ambiance seule, inchangé). Chaîne complète câblée : `worldEffects.js:
  normalizeEffectInstance` (défaut 0, arrondi à l'entier) → `compileEffectRegions` (porté sur la
  région) → `tokensInsideEffectRegions` (porté sur le membership) → `sweepZoneExposure` (écrit dans
  `token_statuses.data.puissance`, réécrit chaque Tour comme le reste — un MJ qui change la puissance
  d'une zone déjà posée n'a rien à resynchroniser à la main) → `resolveActiveEffects` (`row.data.
  puissance ?? 0`) → `resolveDamageLine` (`degautsBruts = jet + puissance`, câblé depuis Z1.1, jamais
  alimenté jusqu'ici). `exposeToHazard` gagne le paramètre, écrit dans `data` UNIQUEMENT côté zone
  (même garde que `zoneInstanceId`/`remanence`, étape 2) — chemin MJ-manuel inchangé.
  **Testé** : 2 tests dans `worldEffects.test.mjs` (round-trip signé + arrondi entier, jamais de
  valeur fractionnaire) ; 1 test dans `worldEffectService.test.mjs` (persistance création + mise à
  jour, défaut 0, valeur négative valide) ; 1 test bout-en-bout dans `effectLineResolverService.
  test.mjs` — zone `feu:petit` (`1d6`) posée avec `puissance:100` → balayage → tick → `degautsBruts`
  émis vérifié ≥ 101 (preuve que la puissance atteint réellement le jet, pas seulement stockée).
  `node --test 'shared/**/*.test.mjs'` = 920, tests ciblés en base = 60/60, build client vérifié,
  aucun résidu de fixture. Un test PRÉ-EXISTANT sans rapport (`combatTurnEngine.test.mjs`, surprise/
  Initiative, jet de dés réel) a échoué une fois de façon isolée puis est repassé au vert deux fois de
  suite juste après, sans qu'aucun fichier touché ici n'ait de lien avec ce mécanisme — noté à Saar
  par transparence, non retenu comme régression de ce lot (aucune reproduction).
  **Z2 est maintenant clos dans son ensemble** (étapes 1→4) : une zone posée en base a un cycle de vie
  complet — présence détectée, condition posée/rafraîchie, dégâts tiqués (puissance comprise),
  extinction/persistance à la sortie, expiration après sa durée. Reste dans le plan : Z3 (grenade
  incendiaire — dégèle le chantier grenades), Z4 (malus `modifier` complet), Z5 (gaz RAW complet,
  preuve utilisateur #2), Z6 (éditeur MJ digne de ce nom, griefs Saar déjà consignés ci-dessus), Z7
  (avertissement joueur).
- **2026-09-27 (suite) — Analyse critique de l'éditeur de zones ACTUEL + proposition de rework,
  zéro code.** Demande explicite de Saar après sa propre session (`165be2b`, sidebar réorganisée en
  3 écrans Structure/Objets 3D/Zones dangereuses avec META EDITEUR). Chaque grief original ré-vérifié
  ligne par ligne dans le code actuel (pas supposé) : la réorganisation a résolu la navigation
  (onglet dédié, icône, clavier) mais n'a touché AUCUN contenu de l'écran Zones dangereuses lui-même —
  les 4 griefs originaux sont tous encore présents tels quels, et le grief « liste sans tri » s'est
  même aggravé (5 → 20 entrées suite à la réconciliation du catalogue RAW, Z2 étape 2). Deux points
  supplémentaires trouvés en creusant, jamais signalés par Saar : `puissance` (Z2 étape 4) n'a aucun
  champ dans ce panneau ; tout le texte de cet écran est en dur en français (seul bloc de ce fichier
  qui ne passe pas par `t()`, viole `.claude/rules/react.md`). Détail complet et proposition de
  rework en 6 points (ordre du moins coûteux au plus structurant) : §6.1/§6.2 ci-dessus. Signalé le
  chevauchement avec l'audit S1 (`PLAN_WORLD_BUILDER_REWORK.md` §6) à vérifier avant tout code.
  Toujours zéro ligne codée sur ce point — Saar mène sa propre revue d'ergonomie, cette session reste
  en stand-by.
- **2026-09-28 — Mockup validé par Saar (« Parfait. go »), rework codé en deux lots.**
  Chevauchement S1 levé avant code (réponse META EDITEUR, `a05c5cf`) : le patron de fenêtre flottante
  (`useDraggablePanelPosition`/`FloatingPanelSection`) existe déjà, rien à réinventer.
  **Lot 1 (`6338e40`) — points 1/2/3/6, additifs, sans risque** : i18n complet de l'écran (12 clés
  neuves + réutilisation de `effectZone`, déjà présente mais jamais câblée, et de `common.close`/
  `common.delete`) ; regroupement du `<select>` par catégorie (`<optgroup>`, table `category → clé
  i18n` couvrant à la fois le vocabulaire RAW et celui, différent, des 5 légataires) ; couleur par
  catégorie dans `SurfaceEditorScene.jsx` (remplace le double ternaire `gas`/`flooded`) ; champ
  puissance ajouté au panneau + à la création d'instance + affiché dans la liste si non nul.
  **Lot 2 — points 4/5 (fenêtre flottante + édition)** : trouvaille en creusant avant de coder — la
  liste « Effets actifs » ne passe PAS par les callbacks Editor3D.jsx comme Salle/Mur/Connecteur
  (elle lit `useWorldRuntimeStore` directement, appels REST locaux à `SurfaceEditorPanel.jsx`), donc
  aucun changement dans `Editor3D.jsx` n'était nécessaire — tout tient dans un état local
  (`effectInspector`) + un nouveau composant. `SurfaceEffectPanel.jsx` (neuf) : inspecteur flottant
  d'une zone existante, patron exact de `SurfaceRoomPanel.jsx` (`FloatingPanelSection` +
  `useDraggablePanelPosition`, position mémorisée) mais namespace i18n par défaut (fr.json, pas
  `'builder'` — vérifié dans le code : Salle/Mur utilisent le namespace `builder.json` séparé,
  jamais fusionné avec `surfaceEditor.*` ; s'en servir aurait cassé toutes les clés). Un bouton
  « Modifier » (nouveau, à côté de « Supprimer ») ouvre l'inspecteur ; il corrige intensité/puissance
  via `PATCH /world-effects/instances/:id` (`updateWorldEffectInstance`, route déjà existante côté
  serveur depuis Z2, jamais appelée côté client jusqu'ici) sans toucher au volume déjà tracé.
  **Limite assumée, pas oubliée** : redessiner le volume (déplacer/agrandir une zone) reste hors
  périmètre — nécessiterait une détection de clic sur le maillage 3D existant
  (`worldMovementService`/raycasting dans `SurfaceEditorScene.jsx`), un vrai incrément à part.
  **Testé** : lint ciblé propre, build client vérifié aux deux lots. Aucun changement serveur (tout
  le nécessaire existait déjà depuis Z2 étapes 2 et 4). **Non testé en jeu** — Saar teste l'UI
  lui-même (`.claude/rules` : jamais le serveur/navigateur lancés par l'agent).
- **2026-09-28 — Rapport Saar « fonctionnel » + 2 correctifs trouvés en vérifiant.**
  (1) Menu déroulant illisible (texte clair sur fond blanc à l'ouverture) : cause racine, pas un
  style de `<select>` à corriger — aucun `color-scheme` n'était déclaré sur la page, donc Chromium/
  Firefox ouvraient la liste d'options avec le thème CLAIR natif du navigateur quel que soit le CSS
  de la page. `color-scheme: dark` ajouté sur `:root` (`client/src/index.css`) — corrige ce menu et
  protège au passage tout autre `<select>` de l'appli (dont `.wiz4-skillselect`, vérifié : même
  vulnérabilité latente, jamais déclenchée visiblement). (2) En vérifiant le point 3 (couleur par
  catégorie) : la correction du 2026-09-28 n'avait touché QUE l'éditeur de carte
  (`SurfaceEditorScene.jsx`) — le plateau de **session** (`Canvas3D.jsx`, ce qu'un joueur/MJ voit
  réellement en partie) avait une copie strictement identique de l'ancien double ternaire
  `gas`/`flooded`, jamais corrigée. Extrait en `client/src/lib/effectRegionColors.js`
  (`getEffectRegionColor`), consommé par les deux fichiers — une seule table, plus de duplication.
  Testé : lint ciblé (erreurs pré-existantes de `Canvas3D.jsx` confirmées identiques avant/après via
  `git stash`, aucune régression introduite), build client vérifié.
- **2026-09-28 — Z4 codé et clos (« on termine le plan », effets visuels reportés).**
  Le vrai problème, creusé avant de coder (plus profond que la ligne Z4 du tableau ne le dit) :
  `RESOLVERS` (`effectLineResolverService.js`) ne contenait que `damage` ; `sweepZoneExposure` ne
  repérait que les lignes `type:'damage'` et posait la condition via `exposeToHazard`/`hazardCode` —
  un mécanisme structurellement inapplicable aux zones `modifier` (gaz), qui ont `hazardCode:null`
  par construction (Z0). **Nouveau domaine séparé** `server/src/lib/zoneModifierService.js` (patron
  `iemSurvivalService.js` : pose + tick dans un seul fichier), jamais `exposeToHazard`/`clearHazard`
  (gardés par `findHazardRegistryEntry`, qui ne connaît que les 3 hazardCode RAW) :
  `applyZoneModifier`/`clearZoneModifier` (écriture `token_statuses` directe, `status_code =
  definition.key`, `data.kind:'zoneModifier'`) + `resolveZoneModifierTicks` (décroissance
  `remanence:'decay'`, appelée depuis `combatTurnEngine.js` juste après `resolveIemSurvivalTicks`,
  filtrée par `data.kind` — jamais `getAllHazardCodes()`) + `resolveZoneModifierMalus` (somme des
  malus `target:'actions'` actifs, pour le point 4).
  `sweepZoneExposure` (`effectLineResolverService.js`) étendue : boucle d'entrée pose aussi une ligne
  `modifier` `onTurn` (indépendante de la branche `damage` existante, pas un elseif) ; boucle de
  sortie distingue `row.data.kind === 'zoneModifier'` (retrait immédiat si `remanence:'none'`, sinon
  laissé tel quel — jamais `clearHazard`, qui lèverait pour un `status_code` de définition gaz sans
  entrée au registre hazard). Escalade (`escalation:{perTurn,cap}`) : la magnitude s'éloigne de zéro
  d'un cran par Tour de présence CONTINUE dans la MÊME zone (`escalationStacks`, remis à 0 sur un
  changement de `zoneInstanceId`), plafonnée par `cap`.
  **Point 4 (nouvelle entrée `ACTIVE_MALUS_SOURCES`) corrigé en cours de route** : le patron annoncé
  à Saar (« même patron que `iemSurvivalMalus` ») s'est révélé inexact une fois le code relu —
  `iemSurvivalMalus` est indexé par PERSONNAGE (`exo_computers`, pas de token nécessaire), alors que
  le malus de zone dépend de la POSITION d'un TOKEN. Faire passer un `tokenId` à travers les 9 sites
  d'appel de `resolveCombatantTestContext` (`socketCombatHelpers.js`/`socketCombatExo.js`/
  `socketCombatAoe.js`) aurait été un chantier à part, avec un vrai risque de mélanger attaquant/
  défenseur. Solution retenue à la place, sans toucher aucun des 9 sites : `resolveZoneModifierMalus`
  dérive les tokens actifs depuis le `characterId` déjà en main (`statusService.resolveCharacterTokens`,
  déjà utilisé par `reconcileWoundDeath`) — appelée automatiquement DANS
  `resolveHumanoidTestContext` (`combatantContextService.js`) pour un appelant humanoïde direct ;
  `resolveExoTestContext` calcule la sienne depuis le token DE L'EXO (`exoCharacter.id`, jamais celui
  du pilote — c'est l'exo qui est physiquement dans le gaz) et la passe en `zoneModifierMalusOverride`.
  **Non-régression `damage` (Z0-Z2)** : les 14 tests existants d'`effectLineResolverService.test.mjs`
  passent inchangés ; les 41 tests existants de `combatantContextService.test.mjs` passent inchangés
  (aucun n'exerçait un malus de zone non nul avant ce jour — la non-régression est donc garantie
  aussi par construction : `zoneModifierMalus` vaut `0` par défaut pour tout token sans ligne
  `zoneModifier`, `??` jamais `||`).
  **Testé** : `node --env-file=.env --test` sur les 3 fichiers touchés — 8 tests neufs
  (`zoneModifierService.test.mjs`, pose/escalade/cap/reset-de-zone/decay/somme), 1 test neuf
  (`sweepZoneExposure` sur `gaz:irritant`, bout en bout), 1 test neuf (`combatantContextService`,
  `effectiveMalus` reflète une ligne `zoneModifier`) — 64/64 verts au total sur ces 3 fichiers.
  Aucune migration. **Non testé en jeu** (Saar : « les tests devront attendre », malus sans effet
  visuel — cohérent avec « les effets visuels restent reportés »).
  **Non fait, hors périmètre déclaré de Z4** : l'escalade (`escalation:{perTurn:2,cap:null}`) de la
  ligne `damage` de `gaz:décomposant` n'est PAS câblée dans `resolveDamageLine`/`resolveActiveEffects`
  — seule l'escalade côté `modifier` (nouvelle, `zoneModifierService.js`) est faite. `gaz:décomposant`
  reste donc à moitié fonctionnel (le `1d6`/Tour de base tourne déjà via `RESOLVERS.damage` depuis Z2,
  l'escalade +2/Tour non). Rattaché à Z5, pas à Z4 (Z4 = « malus modifier de zone », pas « toute
  escalade du catalogue ») — à traiter explicitement quand Z5 sera repris.
- **2026-09-28 — Z6 (portage en session, lot 1/2) codé, NON TESTÉ EN JEU, pas encore commité.**
  Décisions Saar avant de coder : point d'entrée = **Sidebar > Outils > « Zone de danger »** (menu
  déroulant existant, patron Commerce/Encyclopédie — pas un onglet permanent, la pose est trop rare
  pour ça), fenêtre **flottante** (pas un onglet). Périmètre explicitement réduit à ce lot (décision
  agent, technique déléguée par Saar) : **seul le mode rectangle est câblé** — « remplir un
  compartiment » reste un lot suivant (aucune détection de pièce au clic dans `Canvas3D.jsx`
  aujourd'hui, contrairement à l'éditeur ; `findRoomAtCell` existe et est réutilisable quand ce lot
  sera repris).
  Livré : `client/src/lib/effectDefinitionGroups.js` (neuf — extraction du regroupement par catégorie
  de `SurfaceEditorPanel.jsx`, une seule table partagée) ; `client/src/components/
  SessionDangerZonePanel.jsx` (neuf — formulaire de pose + liste « Effets actifs » réutilisant
  `SurfaceEffectPanel.jsx` tel quel) ; `Sidebar.jsx` (entrée de menu, gardée `isGm` — le menu Outils
  n'en avait aucune par défaut) ; `SessionPage.jsx` (état `dangerZoneToolOpen`/`placingZone`,
  `handleZonePlaceCommit` = POST `/battlemaps/:id/world-effects/instances` + refresh, aucune route
  serveur nouvelle) ; `Canvas3D.jsx` (mode de pose isolé — voir ci-dessous).
  **Risque identifié et traité** : `Canvas3D.jsx` est le plateau de SESSION (pas l'éditeur hors-partie)
  — `handlePointerMove`/`handlePointerUp` y sont déjà une fonction dense partagée par 6+ mécaniques
  (déplacement, attaque, visée AOE/LOS, drag de token…), avec un historique de bugs de conflit entre
  modes (commentaires `CLICKATTACK-MOVECONFLICT1`, `COMBAT-DEPLACEMENT-HOVER` déjà dans le fichier).
  Plutôt que d'entrelacer une 7ᵉ mécanique dans cette logique, le mode `placingZone` est un **guard
  isolé en tout premier** dans les deux handlers (return immédiat, rien d'autre n'exécute tant qu'une
  pose est armée) + son propre listener `pointerdown` séparé (aucun autre mode n'en avait besoin,
  aucun n'existait avant). Rejoint l'autorité unique `aimModes` de l'export par défaut
  (PLAN_CLIC_3D_UNIFICATION.md §9.1) pour Échap/curseur — pas un 2ᵉ mécanisme d'annulation inventé.
  Un `placingZone` null (99,9% du temps) laisse tout le reste du fichier strictement inchangé.
  **Testé** : lint ciblé (Canvas3D.jsx : 17→18 problèmes, +1 — exactement le même patron `react-hooks/
  refs` pré-existant sur 14 autres ref-miroirs de ce fichier, confirmé par comparaison directe avant/
  après, pas une nouvelle catégorie de dette ; les autres fichiers touchés : 0 problème neuf), build
  client réussi. **Non testé en jeu — ⚠️ clos partiel** : geste de glisser-rectangle, aperçu
  translucide, ouverture/fermeture du panneau, jamais vérifiés dans un navigateur réel (Saar teste
  l'UI, jamais l'agent). Pas encore commité — attend sa confirmation fonctionnelle (AGENTS.md).

---

## 12. Séquencement global — chantiers liés

Saar rework le **world builder** : de « salles purement rectangulaires » à « dessiner un volume et le
modifier en tirant / ajoutant des arêtes ». C'est **le même primitif d'édition de forme 2D** que le
sculpteur de volume de danger (E-v2, §7.3). **On ne le construit pas deux fois.**

| Ordre | Chantier | Conversation | Dépend de |
|---|---|---|---|
| **1** | **Zones dangereuses — noyau Z0→Z5** (ce plan) + éditeur **E-v1** (Z6 : rectangle + « remplir un compartiment », porté sur le plateau de session) | celle-ci → agent d'implémentation | rien |
| **2** | **Rework world builder** — `docs/PLANS/PLAN_WORLD_BUILDER_REWORK.md` (stub, cadrage à faire) : UX d'édition de forme de salle + **primitif d'édition d'arêtes 2D agnostique** dans `shared/world` (le modèle de salle est déjà multipolygone ; c'est l'UX qui peint des cases) | **séparée, dédiée** — cadrage complet à faire | rien (parallélisable avec 1) |
| **3** | **Éditeur de volume de danger E-v2** — polygone / ellipse / rectangle pivoté / poignées sur canvas / « tracer depuis les murs » | séparée, **après** 2 | le primitif d'édition 2D livré par 2 |

**Le contrat géométrie de l'instance est stable dès maintenant** (`geometry: { mode, shape, volume,
compartments, wallAware }`, §3) : E-v1 en remplit un sous-ensemble (`mode:'compartment'` |
rectangle AABB), E-v2 le complète (`shape:'polygon'|'ellipse'`) **sans le changer**. Aucun des trois
chantiers ne bloque le contrat ; seul l'ordre 2 → 3 est contraint.

---

## 13. Plan détaillé — incrément Z0

> **Statut : plan, pas de code.** À exécuter par l'agent d'implémentation après validation Saar,
> en respectant la méthode `AGENTS.md` (explorer → plan → analyse à charge → coder, un tour chacun).

### 13.1 Objectif et périmètre

`shared/` **uniquement**. Livrer le **contrat complet** (schéma de définition + schéma de ligne
d'effet, les 13 types **validés**) et **`shared/world/dangerCatalog.js`** (toutes les définitions
builtin, chaque chiffre sourcé RAW en commentaire), avec des **tests purs**.

**Purement additif** : nouveaux exports, champs **optionnels** sur `normalizeEffectDefinition`.
Zéro migration, zéro serveur, zéro client. **Rien ne consomme `dangerCatalog.js`** à la fin de Z0 —
c'est Z1 qui branche le registre et la refonte. Aucun comportement de jeu ne change.

### 13.2 Fichiers

| Fichier | Nature | Contenu |
|---|---|---|
| `shared/world/dangerEffectLines.js` | **neuf** | `normalizeEffectLine(line, index)` — valide les 13 `type` (`EFFECT_LINE_TYPES`), la `phase` (`EFFECT_LINE_PHASES` = `onEnter`/`onExit`/`onTraverse`/`onTurn`), et les params **typés par type** (voir 13.3). Pur ; jette `TypeError`/`RangeError` comme `worldEffects.js`. Exporte aussi les deux Sets. |
| `shared/world/worldEffects.js` | **extension additive** | `normalizeEffectDefinition` accepte 8 blocs **optionnels** (`tags`, `durationPolicy`+`durationParams`, `stackingPolicy`, `effects[]` — validées via `normalizeEffectLine` —, `attenuations[]`, `chaining[]`, `corrodes[]`, `source`), tous **défaut vide/neutre**. Les 5 builtins legacy (`fire`/`flooded`/`gas`/`oil`/`unstable`) et les 6 consommateurs **ne passent aucun de ces blocs** → sortie inchangée + champs à défaut. `hooks[]` legacy **conservé** tel quel (coexiste avec `effects[]` ; retiré quand les builtins migrent, Z6). **Aucune suppression, aucun renommage.** |
| `shared/world/dangerCatalog.js` | **neuf** | Patron `armorConstants.js` / `environmentalHazardPresets.js`. Toutes les définitions (§4 + §5), chacune passée par `normalizeEffectDefinition`. **Citation RAW en commentaire au-dessus de chaque chiffre.** Exporte `DANGER_CATALOG` (Map gelée), `listDangerDefinitions()`, `getDangerDefinition(key)`. Porte les **chaînes** de formule (`'2d10'`) + commentaire « consommé par `server/src/lib/diceParser.js#parseDice` » — **ne valide pas les dés** (convention `fallDamageConstants.js` ; `diceParser` est serveur-only). |
| `shared/world/dangerEffectLines.test.mjs` | **neuf** | Par type : params valides acceptés ; params manquants / hors bornes rejetés ; `phase` invalide rejetée ; `type` inconnu rejeté. |
| `shared/world/dangerCatalog.test.mjs` | **neuf** | Le catalogue se charge sans jeter ; chaque entrée a une `source` non vide et une `key` conforme `EFFECT_KEY_RE` ; `feu:*` = 4 entrées dont `feu:brasier` `locationMode:'all'` / `locations:null` ; les 6 gaz présents ; `radiation:*` ×3 ; `corrodes` ⊂ matériaux connus ; **chaque famille de danger a un `hazardCode`** ; `decompression` porte `forcedLocation:'corps'` (niveau définition) ; la dérivation `hazardCode` → 3 codes `acid`/`decompression`/`burning` (pour Z1.4). |
| `shared/world/worldEffects.test.mjs` | **compléter** | Non-régression : les 5 builtins legacy produisent **exactement** la même sortie qu'avant. + un cas « définition avec blocs danger » round-trip. |

**Question d'analyse à charge** : `dangerEffectLines.js` fichier séparé **ou** fusion dans
`worldEffects.js` ? Argument séparé : `worldEffects.js` fait déjà 418 l. et mêle registre + géométrie
+ propagation ; une ligne d'effet est de la **résolution de règle**, pas de la géométrie. Argument
fusion : un seul point d'entrée de normalisation. → trancher au tour d'analyse à charge (proposition :
**séparé**, même dossier, importé par `worldEffects.js`).

### 13.3 Contrat de ligne d'effet — détail figé en Z0

| `type` | Params | v1 |
|---|---|---|
| `damage` | `formula` (str), `locations` (int\|str dés), `locationMode` (`random`\|`exposed`\|`all`), `forcedLocation` (clé `LOCATION_TO_SLOT`\|null), `damageType` (str), `armorFactor` (num, défaut 1), `escalation` (`null`\|`{perTurn,cap}`), `remanence`, `remanenceParams` | **résolu** |
| `status` | `statusCode` (slug — **existence vérifiée en Z1**, pas en Z0), `escalation`, `remanence`, `remanenceParams` | **résolu** |
| `modifier` | `target` (`actions`\|…), `value` (int signé), `escalation`, `remanence`, `remanenceParams` | **résolu** |
| `note` | `label` (str), `text` (str) | **résolu** |
| `test` | `skill`/`attribute` (str), `difficulty` (int), `onFail` (ligne imbriquée) | validé, résolveur **v2** |
| `statLoss` | `stat` (str), `amount` (int\|dés), `recovery` (str) | validé, **v2** |
| `chance` | `onSuccess`/`onFail` (lignes) | validé, **v2** |
| `drainResource` | `resource` (`souffle`\|…), `rate` (int\|dérivé), `onEmpty` (ligne) | validé, **v2** |
| `skillOverride` | `skill` (str), `mode` (`disable`\|`swap`), `swapTo` (str) | validé, **v2** |
| `forcedMove` | `direction` (str\|`awayFromCenter`), `distance` (num\|dés) | validé, **v2** |
| `accumulateLevel` | `track` (`irradiation`\|…), `formula` (str) | validé, **v2** |
| `corrodeEquipment` | `slotMode` (`hit`\|`worn`\|`all`), `amount` (int\|dés) | validé, **v2** |
| `chain` | `engendre` (key catalogue), `délai` (int Tours), `condition` (str), `géométrie` (str) | validé, **v2** |

Champs de définition transverses (§3) : `hazardCode` (`str`\|`null` — `status_code` posé, sert la
dérivation du registre en Z1) ; `forcedLocation` (clé `LOCATION_TO_SLOT`\|`null`, niveau définition,
prime sur tout) ; `durationPolicy` ∈ `permanent`\|`timerFixed`\|`timerDice`\|`conditional`\|`oneShot` ;
`stackingPolicy` ∈ `max`\|`independent` (v1) + `stackCount`\|`refreshDuration` (déclarés, non résolus) ;
`remanence` ∈ `none`\|`conditional`\|`decay`\|`fixed`.

**Convention `locations`** : entier (`1`) ou formule (`'1d3'`) = nombre de Localisations tirées ;
`locationMode:'all'` ⟹ `locations` **ignoré** (toutes les Localisations). Pas de valeur magique `0` —
`feu:brasier` porte `locationMode:'all'` et `locations:null`.

### 13.4 Hors Z0 (rappel)

Aucun résolveur · aucune modif base (`world_effect_definitions`/`_instances`) · `puissance` sur
l'instance = champ **Z2** (migration) · nettoyage des 6 lignes `ref_equipment` = **Z1** ·
absorption réelle de `environmentalHazardPresets.js` = **Z1** (Z0 met juste les entrées équivalentes
dans le catalogue) · `dangerCatalog.js` importé par un service = **Z1**.

### 13.5 Invariants

- **Inv. 3** (autorité unique) : `normalizeEffectLine` = seule validation de forme d'une ligne
  d'effet, `shared/`, réutilisée telle quelle par le serveur en Z1.
- **Inv. 2** : extension de `normalizeEffectDefinition`, **pas** un second normaliseur ; `dangerCatalog.js`
  ne duplique pas `environmentalHazardPresets.js` — il le **remplacera** (Z1).
- **`world.md`** : les volumes/rayons du catalogue sont en **mètres** (`WorldMetrics`), jamais en cases.
- **Règle RAW 5** : chaque chiffre du catalogue porte sa citation ; tout écart (ex. brasier vs RAW muet)
  → déjà tracé §5, à recopier en commentaire.

### 13.6 Validation Z0

`node --check` sur les 3 `.js` ; `node --test shared/world/dangerEffectLines.test.mjs
shared/world/dangerCatalog.test.mjs shared/world/worldEffects.test.mjs` ; `node --test 'shared/**/*.test.mjs'`
(non-régression large). **Pas** de build client, **pas** de serveur, **pas** de session Saar — aucun
comportement de jeu ne change. `git diff --check`.

### 13.7 Points pour l'analyse à charge (tour dédié avant code)

1. `dangerEffectLines.js` séparé vs fusion `worldEffects.js`.
2. Nom du bloc : `effects` vs `effectLines` vs `lines` dans la définition.
3. `hooks[]` legacy vs `effects[]` : confirmer la coexistence en Z0, planifier le retrait en Z6.
4. `formula` : regex de forme locale (dupliquée de `diceParser.DICE_REGEX` avec commentaire pointeur)
   vs aucune validation. Recenser : `NdX`, `NdX±M`, `dX`, `1d3` pour `locations`.
5. `type:'status'` : pas de liste de `status_code` autoritaire unique aujourd'hui (éclatée entre
   `socketToken.VALID_STATUS_CODES`, `weaponModRegistry`, `environmentalHazardRegistry`). Décider si
   Z1 crée un `shared/statusCodes.js` (aggradation probable) — **hors Z0**, mais à acter.
6. `dangerCatalog.js` : une clé par intensité (`feu:petit`…) confirmée vs une définition paramétrée.
7. Catalogue : figer les noms de familles `category` (`feu`/`acide`/`gaz`/`radiation`/…) — ils
   servent au `stackingPolicy` « par catégorie » et à la dérivation de `getAllHazardCodes()` en Z1.

---

## 14. Plan détaillé — incrément Z1

> **Statut : plan, pas de code.** L'incrément **le plus risqué** : il remplace un système en
> production (dangers environnementaux, Lot 3) par le dispatch générique, **sans régression**.
> Découpé en 4 sous-étapes indépendamment testables (méthode `AGENTS.md` : un plan = un problème).

### 14.1 Objectif

Brancher le **registre** `effectLineResolverRegistry` + `resolveActiveEffects`, y **refondre** le
système Lot 3 (§2.B), livrer les résolveurs `damage` / `status` / `note` / `modifier` (base).
**Toujours pas de spatial** (le balayage de zone = Z2) : à la fin de Z1, la seule source de
conditions reste `exposeToHazard` (feeder token), mais la **résolution** passe par le nouveau chemin.

**Le risque** : `burning` / `acid` / `decompression` sont testés en session réelle et ont des tests
purs `deepEqual`. Toute déviation de dégât, de Localisation, de timing de purge, de linger Acide ou
d'émission `COMBAT_ATTACK_RESULT` est une régression.

### 14.2 Sous-étape Z1.1 — le registre + le résolveur `damage`, **sans branchement**

| Fichier | Nature | Contenu |
|---|---|---|
| `shared/world/effectLineResolverRegistry.js` | neuf (shared = contrat) | `EFFECT_LINE_RESOLVERS` : une entrée par `type` — `{ type, phase, validateParams }` (le `resolve` est serveur). Miroir de `weaponModRegistry` (`findModRegistryEntry`) / `environmentalHazardRegistry`. `findEffectLineResolver(type)` → `undefined` si absent, **jamais un throw** (patron maison). |
| `server/src/services/effectLineResolverService.js` | neuf | Les `resolve(ctx)` serveur. **Z1.1 n'enregistre que `damage`**. `resolveDamageLine(ctx)` : lit `formula` / `locations` / `locationMode` / `forcedLocation` de la ligne + `puissance` (défaut 0) → `parseDice` → boucle Localisation → `resolveTargetHit` → `COMBAT_ATTACK_RESULT`. **Copie fidèle de `resolveEnvironmentalHazardTicks` (lignes 147-188)** — mêmes champs d'événement, même `isPnj:true`, même absence d'`armorReductionFactor`. `applicableResolvers` + un `RESOLVERS` map comme `weaponModService`. |
| `*.test.mjs` | neuf | Le registre expose `damage` ; `findEffectLineResolver('inconnu')` → `undefined` ; `validateParams` de `damage` accepte/rejette. Résolveur `damage` = test d'intégration serveur (base) sur un token, compare le hit à l'ancien chemin. |

**Rien n'appelle ce service à la fin de Z1.1.** `node --check` + tests.

### 14.3 Sous-étape Z1.2 — `resolveActiveEffects` + **la bascule** du tick

| Fichier | Changement |
|---|---|
| `server/src/services/effectLineResolverService.js` | `resolveActiveEffects(io, db, campaignId, rows)` : pour chaque ligne `token_statuses` active, résout la/les ligne(s) d'effet de sa **définition catalogue** via le registre. Pour Z1.2, ne traite que les définitions à ligne `damage` `phase:'onTurn'`. |
| `server/src/socket/combatTurnEngine.js` (≈171-173) | **remplace** `resolveEnvironmentalHazardTicks(...)` par `resolveActiveEffects(...)`. La jointure `combat_roster ⋈ token_statuses` filtrée par `getAllHazardCodes()` **reste** (Z2 ajoutera le balayage de zone à côté). |
| `server/src/lib/environmentalHazardService.js` | `resolveEnvironmentalHazardTicks` **supprimé** (plus aucun appelant). `getAllHazardCodes` **conservé** mais **dérivé du catalogue** (§14.4). `exposeToHazard` / `clearHazard` / `turnsFromNow` **inchangés**. |
| `server/src/socket/socketCombatHelpers.js:18` | **import mort supprimé** (`resolveEnvironmentalHazardTicks, getAllHazardCodes` importés, jamais utilisés — vérifié). |

**C'est le moment de non-régression.** Preuve : session Saar — exposer `burning` / `acid` (linger) /
`decompression` sur un token, dérouler 3 Tours, comparer dégâts + Localisation + expiration au
comportement d'avant. Les tests service Lot 3 doivent passer (ou être portés à `resolveActiveEffects`).

### 14.4 Sous-étape Z1.3 — absorption presets + dérivation registre + résolveurs `status`/`note`/`modifier`

| Fichier | Changement |
|---|---|
| `shared/world/dangerCatalog.js` | Les entrées `feu:*` / `acide:capsule` / `decompression` deviennent **la** source des chiffres. `feu:brasier` = `3d10` / `locationMode:'all'` (décision B3). |
| `shared/environmentalHazardPresets.js` | **supprimé** — ou réduit à `export { BURNING_PRESETS } from './world/dangerCatalog.js'` (dérivé) le temps de migrer `TokenStatusPanel.jsx`. `inferno` **change** (`locations:1` → sémantique brasier). |
| `shared/environmentalHazardRegistry.js` | `ENVIRONMENTAL_HAZARD_REGISTRY` **dérivé** : les `hazardCode` **distincts** du catalogue (`feu:*`→`burning` dédupliqué), chacun avec le `forcedLocation` de sa définition. Résultat = `[{acid,null},{decompression,'corps'},{burning,null}]`. **Ordre figé** (le test est `deepEqual`) → trier explicitement. `findHazardRegistryEntry` / `getAllHazardCodes` inchangés en surface. |
| `shared/environmentalHazardPresets.test.mjs` | **mis à jour, pas porté verbatim** : `small`/`medium`/`large` + décompression inchangés ; la ligne `inferno` reflète la nouvelle sémantique. |
| `shared/environmentalHazardRegistry.test.mjs` | **porté** : l'assertion « 3 codes, décompression `forcedLocation:'corps'` » doit tenir sur le résultat **dérivé**. |
| `server/src/services/effectLineResolverService.js` | enregistre `note` (émet une note MJ/chat — patron `type:'note'` de `worldEffects`), `status` (pose un `token_status` via `statusService.applyModStatus` — valide le code contre `shared/statusCodes.js`, **créé ici** = aggradation, cf. Z0 §13.7 pt 5), `modifier` **base** (pose/rafraîchit un `token_status` portant la valeur ; le branchement dans `calcActiveMalus` via une entrée `ACTIVE_MALUS_SOURCES` = **Z4**, avec escalade + `decay`). |

### 14.5 Sous-étape Z1.4 — migration `ref_equipment`

Migration Knex (`.claude/rules/migrations.md` : jamais d'`id` en dur, matcher par clé métier `name`) :
**vide** les 6 valeurs corrompues (§5.4) — `Grenade/Capsule à gaz — décomposants` (`nation`),
`— vésicants` (`nation`), `— assommants` (`damage_h`), et vérifier les 3 autres lignes gaz. La donnée
vit dans `dangerCatalog.js`. Pas de nouvelle colonne (le `dangerKey` dans `aoe_profile` JSONB = Z3).
`down()` : ré-écrit les valeurs (documentées dans la migration).

### 14.6 Callers & non-régression — inventaire complet `[VÉRIFIÉ grep]`

| Site | Impact Z1 |
|---|---|
| `combatTurnEngine.js:168-173` | bascule tick (Z1.2) |
| `socketCombatHelpers.js:18` | import mort → retrait (Z1.2) |
| `routes/campaigns.js:572-588` (`/hazards/:code/expose\|clear`) | **inchangé** — `exposeToHazard`/`clearHazard` conservés |
| `aoeMechanisms/flamethrower.js:70` (`exposeToHazard('burning', …, durationDice:'2D6')`) | **inchangé** — le feeder token marche pareil |
| `coldExposureService.js:183` / `fallDamageService.js:100` (commentaires « même patron ») | aucun code, commentaires à jour éventuels |
| `client/TokenStatusPanel.jsx` | consomme `BURNING_PRESETS` — **inchangé** si on garde le ré-export ; sinon migrer l'import vers le catalogue |
| Tests : `environmentalHazardRegistry.test.mjs`, `environmentalHazardPresets.test.mjs` + tests service Lot 3 | portés / mis à jour (§14.4) |

**Validation Z1** (`AGENTS.md` — migration + combat) : `node --test 'shared/**/*.test.mjs'` + tests
serveur ciblés + **build client** + **session Saar** : brûler / acide (linger) / décompresser un
token = identique à avant ; un `feu:brasier` exposé manuellement tue en 1 Tour.

### 14.7 Hors Z1

Balayage de présence spatial (**Z2**) · `puissance` sur l'instance / migration (**Z2**) · `escalation`
+ `remanence:'decay'` + entrée `ACTIVE_MALUS_SOURCES` (**Z4**) · `protections` JSONB (**Z1b**) ·
`dangerKey` dans `aoe_profile` (**Z3**) · les 9 résolveurs v2.

### 14.8 Points pour l'analyse à charge (tour dédié)

1. `resolveActiveEffects` : itère les `token_statuses` **ou** reçoit les `rows` de l'appelant (comme
   `resolveEnvironmentalHazardTicks` aujourd'hui) ? Cohérence avec le futur balayage Z2.
2. ~~`shared/statusCodes.js`~~ **résolu (Z0, run à vide 2026-09-27)** : `shared/tokenStatusRegistry.js`
   existe déjà (créé 2026-09-24, après le cadrage) et couvre exactement ce besoin — `findTokenStatus`
   est l'autorité à utiliser pour vérifier l'existence d'un `statusCode` de ligne `status`. Aucun
   fichier à créer, aucun risque sur `socketToken.js` (rien n'y change).
3. `modifier` base en Z1 vs tout en Z4 : est-ce que « poser le `token_status` sans le lire » a une
   valeur, ou Z1 s'arrête à `damage`/`status`/`note` ?
4. Tests service Lot 3 : localiser (`server/src/**/*hazard*.test` — aucun trouvé au grep initial ;
   vérifier `combatTurnEngine` / intégration).
5. `getAllHazardCodes()` dérivé : ordre des codes (le test `deepEqual` est sensible à l'ordre) — **et
   dédupliquer** : les 4 `feu:*` du catalogue (Z0) partagent le même `hazardCode:'burning'`, la
   dérivation doit produire une seule entrée `burning`, pas 4.
6. Le `down()` de la migration `ref_equipment` : re-vérifier les 6 valeurs exactes avant d'écrire.
7. **`lingersOnClear`** (`environmentalHazardRegistry.js`, ajouté 2026-09-24 — après le cadrage, pas
   dans le contrat §3 d'origine) : à dériver de `remanence === 'fixed'` sur la ligne `damage` de la
   définition catalogue portant ce `hazardCode` — vrai seulement pour `acide:capsule` en Z0 (feu:*/
   decompression ont `remanence:'none'`). Pas un champ à ajouter au contrat : la donnée existe déjà
   dans `remanence`, `clearHazard(..., {linger:true})` n'a besoin que du booléen dérivé.
