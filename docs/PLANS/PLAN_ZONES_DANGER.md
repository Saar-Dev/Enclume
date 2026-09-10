# PLAN_ZONES_DANGER.md — Fondation « zones dangereuses »

> Rédigé 2026-09-09, **réécrit propre 2026-09-10** (consolidation d'un cadrage de ~35 tours).
> **Cadrage terminé. Aucun code écrit.** Ce document est auto-suffisant : il porte le contrat,
> l'architecture, les décisions RAW tranchées avec Saar, le catalogue exemple et le plan d'incréments.
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
| **Runtime par occupant** | `token_statuses.data` | durée restante, malus accumulé (escalade), Souffle courant, état de cascade |

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
  geometry: { mode: 'volume'|'compartiment', shape, volume: {min,max}, compartiments: [], wallAware,
              animation: null },        // animation (remplissage/dérive) = v2
  puissance: 0,                         // §2.E
  durationOverride: null,               // la grenade pose { policy:'timerDice', turns:'2d6' }
  metadata: {},                         // "Personnalisé" : formulaOverride…
  source: { kind: 'mj'|'grenade'|'flamethrower' },
  state: 'active' }
```

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
{ key:'feu:brasier', ... formula:'3d10', locations:0, locationMode:'all' ... }

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

// ── burning / acid / decompression (refonte §2.B) ──
//   burning -> alias/équivalent des préréglages feu ; acid -> acide:capsule ;
//   decompression -> { type:'damage', formula:'1d10', locationMode:'exposed', forcedLocation:'corps' }
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
> par `dangerCatalog.js` (§2.B), `feu:brasier` fige `locations:0` / `locationMode:'all'` — le catalogue
> l'emporte, l'ancien `1` disparaît. Ne pas recopier le `1`.

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
Souffle épuisé → cascade de Tests d'Athlétisme → noyade / asphyxie / effet du gaz. `surprised` →
Souffle max ÷ 2. `calcSouffle` (`shared/polarisUtils.js`) = un **plafond** ; **aucun Souffle courant
runtime**. Résolveur `drainResource` + la mini-FSM = **v2**.

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
| **Z0** | `shared/world/worldEffects.js` : schéma de ligne **complet** (tous les types validés, `phase`, params typés) + blocs de définition (`tags` / `durationPolicy` / `stackingPolicy` / `corrodes` / `attenuations` / `chaining`). **`shared/world/dangerCatalog.js`** : toutes les définitions, sourcées RAW. Tests purs. | `shared/`, aucune migration | `node --test shared/**` |
| **Z1** | `effectLineResolverRegistry` (patron `resolveModHooks`) ; `resolveActiveEffects` ; **refonte système dangers environnementaux** (§2.B) : `environmentalHazardPresets.js` **absorbé** dans `dangerCatalog.js`, `environmentalHazardRegistry.js` **dérivé** du catalogue, `resolveEnvironmentalHazardTicks` remplacé par le dispatch ; `exposeToHazard`/`clearHazard`/`turnsFromNow` conservés (feeder token). Résolveurs `damage` + `status` + `note` + `modifier` de base. Migration : **supprime les 6 valeurs `ref_equipment` corrompues** (§5.4). Non-régression stricte. | serveur, **rework**, migration | tests Lot 3 portés 1-pour-1 + **session Saar** (brûler / acide / décompresser comme avant) |
| **Z1b** | `ref_equipment.protections` JSONB (§2.G) ; `waterproof` s'y replie (migration + retrait colonne) ; outil admin / `equipmentMapping.js` / `inventoryService` / `diff_equip.mjs` adaptés ; résolveur `attenuation` lit `protections`. | serveur + client admin, **rework**, migration | build + session Saar |
| **Z2** | balayage roster × zones dans `startResolutionPhase` → `resolveActiveEffects` ; `durationPolicy` dans `endTurn` ; `worldSpatialQueryService.tokensInsideEffectVolume` (`centreDedans`) ; `remanence:'none'` à l'`exit` ; champ instance `puissance` (migration) branché dans les résolveurs. | serveur, migration | **insert manuel zone `feu:grand` → un token dedans brûle chaque Tour + s'éteint en sortant** |
| **Z3** | `aoeMechanisms/grenade_incendiary.js` sur `circleGrenade.js` ; explosion Tour+1 → `createWorldEffectInstance`. **Dé-gèle le chantier grenades** (maj `PLAN_GRENADES.md` §6). | serveur + migration `ref_equipment` | **preuve utilisateur #1** — lancer incendiaire → zone de feu au Tour suivant |
| **Z4** | résolveur `modifier` complet (entrée `ACTIVE_MALUS_SOURCES` alimentée par les zones) ; `escalation` = accumulateur mutable dans `token_statuses.data` ; `remanence:'decay'` (tique hors zone via `resolveActiveEffects`). | serveur | zone de gaz : malus qui monte en présence, décroît après la sortie |
| **Z5** | `gaz:irritant` (`modifier −3` + `decay`) **et** `gaz:décomposant` (`damage 1D6` + `escalade +2` + `decay`) — les 2 entièrement RAW en v1 ; atténuation `behavior` « retenir sa respiration » = ½ ; `aoeMechanisms/grenade_gas_*.js`. | serveur + migration | **preuve utilisateur #2** |
| **Z6** | **Éditeur E-v1** (§7.2) — porter l'outil effet sur le plateau de session (`Canvas3D.jsx`, aujourd'hui Editor3D seulement), MJ-only, aperçu optimiste + confirmation serveur ; flux catégorie → préréglage → géométrie ; 2 modes de géométrie : « remplir un compartiment » (`targetKind:'compartiment'`, zéro géométrie neuve) + rectangle + hauteur (existant) ; « Personnalisé » ; bascule visibilité MJ/joueur ; mesh translucide par catégorie ; i18n. **Pas de polygone (E-v2, §12).** | client | build + session Saar |
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
  - **« Remplir un compartiment »** — `targetKind:'compartiment'`. **Zéro géométrie neuve** :
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
compartiments, wallAware }`, §3) : E-v1 en remplit un sous-ensemble (`mode:'compartiment'` |
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
| `shared/world/dangerCatalog.test.mjs` | **neuf** | Le catalogue se charge sans jeter ; chaque entrée a une `source` non vide et une `key` conforme `EFFECT_KEY_RE` ; `feu:*` = 4 entrées dont `feu:brasier` `locations:0`/`locationMode:'all'` ; les 6 gaz présents ; `radiation:*` ×3 ; `corrodes` ⊂ matériaux connus ; `burning`/`acid`/`decompression` présents (alias/équivalents pour la refonte Z1). |
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

Champs de définition transverses (déjà en §3) : `durationPolicy` ∈ `permanent`\|`timerFixed`\|
`timerDice`\|`conditional`\|`oneShot` ; `stackingPolicy` ∈ `max`\|`independent` (v1) + `stackCount`\|
`refreshDuration` (déclarés, non résolus) ; `remanence` ∈ `none`\|`conditional`\|`decay`\|`fixed`.

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
| `shared/world/dangerCatalog.js` | Les entrées `feu:*` / `acide:capsule` / `decompression` deviennent **la** source des chiffres. `feu:brasier` = `3d10` / `locations:0` / `locationMode:'all'` (décision B3). |
| `shared/environmentalHazardPresets.js` | **supprimé** — ou réduit à `export { BURNING_PRESETS } from './world/dangerCatalog.js'` (dérivé) le temps de migrer `TokenStatusPanel.jsx`. `inferno` **change** (`locations:1` → sémantique brasier). |
| `shared/environmentalHazardRegistry.js` | `ENVIRONMENTAL_HAZARD_REGISTRY` **dérivé** : `listDangerDefinitions().filter(d => d.category ∈ FAMILLES_HAZARD).map(d => ({ code: d.hazardCode, forcedLocation: d.forcedLocation ?? null }))`. `findHazardRegistryEntry` inchangé en surface. |
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
2. `shared/statusCodes.js` : périmètre exact (fusionner `VALID_STATUS_CODES` + hazards + mod statuses ?)
   — risque de casser `socketToken.js` si mal cadré. Peut-être un incrément séparé avant Z1.
3. `modifier` base en Z1 vs tout en Z4 : est-ce que « poser le `token_status` sans le lire » a une
   valeur, ou Z1 s'arrête à `damage`/`status`/`note` ?
4. Tests service Lot 3 : localiser (`server/src/**/*hazard*.test` — aucun trouvé au grep initial ;
   vérifier `combatTurnEngine` / intégration).
5. `getAllHazardCodes()` dérivé : ordre des codes (le test `deepEqual` est sensible à l'ordre).
6. Le `down()` de la migration `ref_equipment` : re-vérifier les 6 valeurs exactes avant d'écrire.
