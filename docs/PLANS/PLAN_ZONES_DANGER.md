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

### 1.2 `environmentalHazardService.js` (statuts périodiques par token)

**Fait** : `token_statuses` avec `data:{formula,locations,forcedLocation}` + `expires_at_turn` ; tick
à `combatTurnEngine.startResolutionPhase` (jointure `combat_roster ⋈ token_statuses` filtrée par
`getAllHazardCodes()` → `resolveEnvironmentalHazardTicks` → `resolveTargetHit` par Localisation →
`COMBAT_ATTACK_RESULT`) ; `exposeToHazard` / `clearHazard` (linger Acide 1D6 Tours) ; purge
universelle fin de Tour (`expires_at_turn <= newTurn`). 3 codes en dur : `burning` / `acid` /
`decompression`.

**Pas fait** : rien de spatial. Le MJ pose ça à la main, token par token.

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

### 2.B — Refonte de `environmentalHazardService`

`burning` / `acid` / `decompression` deviennent des **définitions du catalogue** (§4). Le tick actuel
(`resolveEnvironmentalHazardTicks`) disparaît au profit de `resolveActiveEffects`. **Deux
alimentateurs, une résolution** :
- exposition MJ à la main sur un token (`exposeToHazard`) → pose une instance `targetKind:'token'` ;
- balayage de présence d'une zone → pose des conditions sur les occupants.

→ **autorité unique de l'invariant 2 enfin respectée.** Non-régression stricte exigée (tests
existants + session Saar).

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
grand = `1D3` ; **brasier = toutes** (RAW muet → décision Saar : mort garantie). **Ignifugé** : le
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

### 5.5 Souffle — `REGLEBLESSURES.md` §Souffle `[VÉRIFIÉ]`  *(v2, ne bloque pas le noyau)*

**Timer de blocage respiratoire commun** (immersion / vide / gaz — pas une unification totale : chaque
menace garde son effet propre). Perte selon l'**activité dérivée** :
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
| **Z1** | `effectLineResolverRegistry` (patron `resolveModHooks`) ; `resolveActiveEffects` ; **refonte `environmentalHazardService`** (`burning`/`acid`/`decompression` → catalogue) ; résolveurs `damage` + `status` + `note` + `modifier` de base. Migration : **supprime les 6 valeurs `ref_equipment` corrompues** (§5.4). Non-régression stricte. | serveur, **rework**, migration | tests existants + **session Saar** (non-régression `burning`/`acid`) |
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

1. **Plans détaillés Z0 et Z1** (Z1 = le rework le plus risqué : refonte `environmentalHazardService`
   sans régression).
2. **Validation Saar** de §5 (RAW) — surtout §5.3 gaz (déjà vérifié) et §5.5 Souffle (inférence).
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

---

## 12. Séquencement global — chantiers liés

Saar rework le **world builder** : de « salles purement rectangulaires » à « dessiner un volume et le
modifier en tirant / ajoutant des arêtes ». C'est **le même primitif d'édition de forme 2D** que le
sculpteur de volume de danger (E-v2, §7.3). **On ne le construit pas deux fois.**

| Ordre | Chantier | Conversation | Dépend de |
|---|---|---|---|
| **1** | **Zones dangereuses — noyau Z0→Z5** (ce plan) + éditeur **E-v1** (Z6 : rectangle + « remplir un compartiment », porté sur le plateau de session) | celle-ci → agent d'implémentation | rien |
| **2** | **Rework world builder** — géométrie de salle non rectangulaire + **primitif d'édition d'arêtes 2D** dans `shared/world` (le vrai manque : `aoeShapes.js` ne couvre que circle/cone/ray, les salles sont des empreintes de cases) | **séparée, dédiée** — cadrage complet à faire | rien (parallélisable avec 1) |
| **3** | **Éditeur de volume de danger E-v2** — polygone / ellipse / rectangle pivoté / poignées sur canvas / « tracer depuis les murs » | séparée, **après** 2 | le primitif d'édition 2D livré par 2 |

**Le contrat géométrie de l'instance est stable dès maintenant** (`geometry: { mode, shape, volume,
compartiments, wallAware }`, §3) : E-v1 en remplit un sous-ensemble (`mode:'compartiment'` |
rectangle AABB), E-v2 le complète (`shape:'polygon'|'ellipse'`) **sans le changer**. Aucun des trois
chantiers ne bloque le contrat ; seul l'ordre 2 → 3 est contraint.
