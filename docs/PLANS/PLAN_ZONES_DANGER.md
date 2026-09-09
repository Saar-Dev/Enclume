# PLAN_ZONES_DANGER.md — Fondation « zones dangereuses persistantes »

> Rédigé 2026-09-09 (Claude/Saar). **Cadrage — pas un plan d'implémentation.** Seule la §1 (Constat)
> est `[VÉRIFIÉ]` et stable ; les §3 à §6 sont **NON FIGÉES** — matière d'exploration à rouvrir à
> chaque reprise. Aucune ligne de code tant que la liste de champs (§4) n'est pas arrêtée avec Saar.
>
> Responsabilité unique (`docs/RegleDocumentaire.md` R1) : *comment une zone d'effet runtime, une
> fois posée sur une battlemap, est résolue tour après tour sur ses occupants, et comment elle
> naît / expire.* **Hors responsabilité** : la classification d'un espace (sous-marin / surface /
> atmosphérique / spatial) → `PLAN_ENVIRONNEMENT_MILIEUX.md` ; la géométrie du monde compilé →
> `.claude/rules/world.md`. Autorité RAW : *Livre de Base Polaris* > ce document.

## 1. Constat technique `[VÉRIFIÉ]` (lecture code 2026-09-09)

Deux demi-systèmes existent ; aucun ne fait le travail complet.

### 1.1 Zones spatiales — `world_effect_instances` + `shared/world/worldEffects.js`

**Fait :**
- Modèle de données : instance liée à un `targetKind` ∈ `volume` (AABB) / `compartment` / `support` /
  `feature` / `entity` / `token` ; `intensity` ; `duration_rounds` ; `state` ∈
  `active` / `paused` / `expired` (migration `95_world_effect_instances.js`, contraintes `192_*`).
- Définitions : builtin `fire` / `flooded` / `gas` / `oil` / `unstable` (`BUILTIN_WORLD_EFFECTS`) +
  définitions custom par campagne (`world_effect_definitions`, `93_*`). Une définition custom
  **n'exécute jamais de code** — seul un vocabulaire validé (`modifiers`, `hooks`) produit une
  conséquence de jeu.
- `modifiers` : `movementMultiplier`, `sightOpacity` — réellement appliqués (coût de déplacement à
  travers ; occlusion LOS via `effectOccludersFromRegions`).
- `hooks` : `event` ∈ `enter` / `exit` / `traverse` / `turnStart` / `turnEnd` ; `type` ∈
  `note` / `test` / `damage` / `restriction` — **purement déclaratifs, jamais exécutés** (voir 1.3).
- Propagation : `buildCompartmentPropagationGraph` + `propagateEffectThroughCompartments` (canal
  `gas` / `water`, atténuation, coupée par une barrière qui `blocks` le canal — porte fermée).
  Exposée par `createPropagatedWorldEffectInstances`.
- Le MJ peut créer / modifier / supprimer une instance : route `battlemaps.js`
  (`createWorldEffectInstance`).
- Le mouvement à travers calcule et persiste des events `enter` / `traverse` / `exit`
  (`worldMovementService.js` → `pathEffectEvents` → table `world_effect_events`).

**Pas fait :**
- **Aucun hook n'est exécuté.** `hooks[].type === 'damage'` porte `amountPerIntensity` ; rien ne le
  relie à `damageService.resolveTargetHit`. `type === 'test'` porte `testKey` / `difficulty` ; rien
  ne le relie à `gmArbitratedTestService`. Les events de mouvement sont *calculés et stockés*, jamais
  résolus en conséquence de jeu.
- **Aucune boucle `turnStart` / `turnEnd`.** Rien n'itère les zones actives à chaque Tour.
- **`duration_rounds` n'est jamais décrémenté ni comparé.** Une zone posée reste `active`
  indéfiniment.
- **Rien ne crée d'instance depuis la résolution de combat** (grenade, lance-flammes, tir).

### 1.2 Statuts périodiques par token — `environmentalHazardService.js`

**Fait :**
- `token_statuses` avec `status_code` ∈ registre (`shared/environmentalHazardRegistry.js` : `acid`,
  `decompression`, `burning`), `data: { formula, locations, forcedLocation }`, `expires_at_turn`.
- Tick à `combatTurnEngine.startResolutionPhase` : jointure `combat_roster ⋈ token_statuses` filtrée
  par `getAllHazardCodes()` → `resolveEnvironmentalHazardTicks` → `resolveTargetHit` par Localisation
  → `COMBAT_ATTACK_RESULT` émis (visible chat MJ + joueur ciblé).
- Cycle de vie : `exposeToHazard` (pose, `durationDice` optionnel → `expires_at_turn`), `clearHazard`
  (retrait ; `linger` réservé Acide RAW = 1D6 Tours), purge universelle fin de Tour
  (`expires_at_turn <= newTurn`, `socketCombatHelpers.js`).
- `turnsFromNow` : primitive `current_turn + roll + 1` (le `+1` compense la purge de fin de Tour).

**Pas fait :** rien de spatial. Le MJ pose ça à la main, token par token. Pas de notion de « zone »,
d'entrée / sortie, ni de compteur d'exposition.

### 1.3 Ce qui manque = le pont entre 1.1 et 1.2

| Manque | Où ça devrait vivre |
|---|---|
| Boucle « pour chaque zone active, pour chaque token dedans, à chaque Tour » | `combatTurnEngine`, à côté du tick hazard existant |
| Résolution des hooks déclaratifs → formule / Test réels | un résolveur unique ; **jamais** un 2ᵉ moteur (invariants 2 & 3) — réutilise `resolveTargetHit` / `gmArbitratedTestService` / `statusService` |
| Décrément + expiration de `duration_rounds` → `state = 'expired'` | même boucle de Tour |
| « quels tokens sont dans quelle zone », recalculé serveur depuis les positions réelles | `worldSpatialQueryService` (a déjà `pointInsideEffectBounds`) |
| Création d'instance depuis la résolution de combat | sites d'appel AOE (`socketCombatAoe` / mécanismes) |

## 2. Périmètre

### 2.1 Noyau de la fondation (ce chantier)

1. Boucle de Tour sur les zones actives + expiration `duration_rounds`.
2. Pont hook déclaratif → résolveur unique (dégât / test / statut / modificateur).
3. Requête « tokens dans la zone », serveur-autoritaire.
4. `createWorldEffectInstance` appelé depuis la résolution de combat.
5. **Consommateur-preuve unique : grenade incendiaire** — volume fixe, effet `fire` (le hook
   `turnStart` / `damage` builtin existe déjà), `duration_rounds` court. Le plus petit bout qui
   exerce les 4 points ci-dessus.

### 2.2 Consommateurs suivants (chacun son propre incrément, après le noyau)

- Gaz de combat + fumigène → `PLAN_NUAGE.md` devient une spec de consommateur (propagation + escalade
  + immunité + décroissance en sortie).
- Capsules à zone.
- Tir de suppression (zone persistante inter-tours = 1 de ses 2 bloqueurs ; l'autre = chantier
  Chance).
- Zones dangereuses posées par le MJ (aujourd'hui posables mais inertes).

### 2.3 Hors périmètre — notés, pas conçus ici

- **0G / apesanteur**, **escalade**, **débris / obstacle / terrain accidenté**, **verre au sol** :
  relèvent du moteur monde (déplacement, connecteurs, `modifiers` de surface) ou des builtins
  `oil` / `unstable` existants — pas une « zone dangereuse » à résolution par Tour.
- **Pièges** (pics au sol / mur) : ajoutent une notion d'armement / détection (Perception ou Systèmes
  de sécurité) / déclenchement one-shot — mécanique distincte, RAW Polaris à vérifier (probablement
  mince).
- **Niveau d'eau qui monte** : géométrie qui change de volume dans le temps (touche l'échelle Y du
  playground) — chantier moteur monde autant que zone, à traiter en dernier et séparément.
- **Froid, radiations, maladies / poisons, faim / soif, noyade / asphyxie** : ont leur RAW propre
  (`FATIGUE&DOMMAGES.md`) et des échelles hors combat (heures / jours). Une zone pourra les
  *déclencher* plus tard, mais leur résolution n'est pas ce chantier.

## 3. RAW transcrit — `[VÉRIFIÉ` + source `]`

### 3.1 Feu — `docs/REGLES/FATIGUE&DOMMAGES.md` §Feu

> Dommages selon l'intensité, par Tour de combat, tant que le personnage y est exposé :
> - petite flamme : 1D6 / Tour, **Localisation exposée**
> - feu moyen : 1D10 / Tour, Localisation exposée (vêtements qui prennent feu)
> - grand feu : 2D10 / Tour, **1D3 Localisations** (aspergé de liquide inflammable enflammé — feu
>   difficile à étouffer)
> - brasier : 3D10 / Tour
>
> Tenues ignifugées : réduction. Effets induits cités : **fumées toxiques / asphyxiantes /
> aveuglantes**, **chaleur intense**, **raréfaction de l'O₂ en lieu clos**, **stress** (hybrides,
> animaux → fuite).

*Déjà partiellement modélisé* : `burning` dans `environmentalHazardRegistry` + hook builtin `fire`
(`amountPerIntensity: 1`, `turnStart`). Le catalogue `ref_equipment` a Petite flamme / Feu moyen /
Grand feu / Brasier (chantier Fatigue & Dommages Lot 3). **Écart connu** : le hook builtin fait
1 point × intensité, pas la formule de dés RAW — le pont §2.1(2) doit brancher la vraie formule.

### 3.2 Acide — `FATIGUE&DOMMAGES.md` §Acide

> Dommages progressifs (comme le feu), à un rythme et pendant une durée dépendant de la **puissance**,
> ou jusqu'à neutralisation. En atmosphère corrosive : dommages jusqu'à la **sortie de zone**, puis
> **persistance 1D6 Tours** (ou jusqu'à neutralisation). Certaines substances rongent le métal, la
> chair, etc. — **préciser la cible matérielle**.

*Déjà modélisé* : `acid` + `clearHazard(linger:true)` = 1D6 Tours RAW.

### 3.3 Décompression — `FATIGUE&DOMMAGES.md` §Décompression

> 1D10 (ou 2D10 si plusieurs paliers manqués) points / Tour, **Corps** (Localisation forcée « pour
> simplifier »). S'arrête : caisson hyperbare ou redescente au dernier palier respecté.

*Déjà modélisé* : `decompression`, `forcedLocation: 'corps'`.

### 3.4 Souffle / apnée / noyade — `FATIGUE&DOMMAGES.md` §Noyade-Asphyxie

> On commence à se noyer / s'asphyxier **quand il n'y a plus de points de Souffle**. Puis inconscience
> en **2D6 Tours**, puis mort en ~5-7 minutes. Réanimation Premiers soins possible avant (malus =
> 2 × minutes écoulées). Eau glaciale : survie légèrement meilleure (malus = minutes, pas 2 ×).

`[INCONNU]` : le système « Souffle » (points, hyperventilation, `docs/REGLES/FATIGUE&DOMMAGES.md`
§Décompression mentionne un « niveau habituel de Souffle ») n'a pas été audité côté code — à faire
avant tout chantier air / eau.

### 3.5 Froid — `FATIGUE&DOMMAGES.md` §Froid  *(hors périmètre, transcrit pour référence)*

Échelle 10-15 °C / 5-10 / ~0 / < 0 ; Tests de résistance à la Fatigue à fréquence croissante ;
Dommages physiques 1D10 croissant d'1D10 / heure à partir de « Glacial » (Bras + Jambes puis Corps
+ Tête). **Immersion / vêtements mouillés : tous les temps ÷ 2.** Combinaison grand froid : annule
(jusqu'à un seuil). Hybrides : insensibles sous l'eau.

### 3.6 Radiations — `FATIGUE&DOMMAGES.md` §Radiations  *(hors périmètre, référence)*

Niveau d'irradiation à seuils (5 / 10 / 15 / 20 / 25 / 30) → pertes temporaires de CON + Fatigue ;
+1 point **permanent** à chaque seuil franchi ; **« rester dans une zone irradiée fait re-subir les
dégâts »** (≈ tick de zone), échelle non-combat.

### 3.7 Gaz de combat (6 types) — verbatim dans `PLAN_NUAGE.md` §3

Assommant / décomposant / irritant / neurotoxique / suffocant / vésicant. Patrons récurrents :
Test (Constitution ou résistance au Choc) **par Tour de présence** ; malus **+1 par Tour** dans la
zone ; **décroissance** en sortie (−1 / Tour, ou −1 / 2 Tours) ; « **puissance du gaz** » = Difficulté
des Tests (origine de la valeur `[INCONNU]`) ; immunité masque / NBC / pressurisé (parfois partielle :
masque = peau seulement pour le vésicant) ; « retenir sa respiration » = ½ intensité.

## 4. Liste de champs — **NON FIGÉE, cœur du cadrage**

À construire cas par cas avec Saar : les champs *émergent* des cas RAW, on ne les invente pas dans le
vide. Premier jet des colonnes qu'une définition de zone devra porter, à valider / trancher :

- **Effet(s)** — une zone peut en cumuler : `dégât` | `test` | `statut` | `modificateur` |
  `perte de carac` | `soin` *(= dégât négatif, même résolveur)*.
- Par effet `dégât` : formule de dés · nb de Localisations (fixe ou formule) · Localisation forcée ·
  type (feu / acide / …) · facteur de réduction d'armure.
- Par effet `test` : attribut / compétence · Difficulté (d'où ? « puissance » ?) · conséquence
  d'échec (malus ? statut ? perte ?).
- **Cadence** : à l'entrée (one-shot) · par Tour de présence · passif permanent.
- **Escalade** : + par Tour de présence (montant, plafond ?).
- **Rémanence en sortie** : décroissance (−X / Tour, ou −X / N Tours) ou persistance fixe (1D6 Tours).
- **Cible de l'effet** : personnage · équipement · géométrie.
- **Atténuation** : liste d'équipements immunisants (total / partiel) · comportement (« apnée » = ½) ·
  barrière (porte fermée coupe le canal).
- **Cycle de vie** : `duration_rounds` fixe · timer de dés · conditionnel (aération) · permanent
  jusqu'au retrait MJ · one-shot puis disparaît.
- **Géométrie** : volume fixe · compartiment(s) · forme AOE · se propage · (plus tard) change de
  volume.
- **Chaînage** : engendre une autre zone (feu → fumée) — décalage / délai ?
- **Visibilité joueurs** : affichée / cachée (bascule MJ).
- **Intensité** : scalaire unique actuel — sert au mouvement + opacité + (proposé) échelle du dégât /
  Test.

### Interface MJ sans code

À réfléchir une fois les champs stabilisés — cases à cocher + champs numériques + listes déroulantes,
zéro script. Point d'attention : exprimer « malus +1 / Tour, −1 / Tour après sortie, sauf masque »
sans que ça devienne un langage.

## 5. Références pro (informatif)

- **Foundry VTT v12 — Scene Regions / Region Behaviors** : une région porte des *Behaviors*
  déclaratifs qui s'abonnent à des *Events* (`token enters`, `token starts / ends turn inside`,
  `token moves within`…). Le cœur est sans script ; l'automatisation avancée (jets de sauvegarde +
  dégâts typés) passe par des modules tiers (Enhanced Region Behaviors). → valide le modèle
  « zone = déclaratif + événements + routine ».
- **Pathfinder 2e — hazards complexes** : un hazard « complexe » a une **initiative** et une
  **routine par round** (nombre d'actions entre parenthèses). Un hazard environnemental « n'a pas le
  droit de cibler précisément les PJ » — il arrose la zone. → conforte : la zone tick sur *tout* ce
  qui est dedans, sans ciblage.

## 6. Questions ouvertes (ordre de traitement à décider avec Saar)

1. **Une boucle ou deux ?** Zone = *spawner* de `token_statuses` (résolution dans le tick hazard
   généralisé) vs 2ᵉ boucle « zone-tick » parallèle. Penchant fort : spawner (une seule autorité).
2. Compteur d'exposition (Tours de présence continue par token × zone) : nouvelle table ? JSONB sur
   l'instance ? `token_statuses.data` ?
3. Jusqu'où va le déclaratif avant de devenir un DSL (§4, interface MJ).
4. `PLAN_NUAGE` : absorbé ici ou reste spec de consommateur ?
5. Hors combat : le tick ne tourne qu'en combat (au Tour) ? Hors combat, seuls `enter` / `traverse` ?
6. Audit du système « Souffle » (prérequis air / eau).

## 7. Historique

- **2026-09-09** — Trouvaille pendant le chantier grenades 3-bis (`docs/JOURNAL8.md`,
  `PLAN_GRENADES.md` §6) : la mécanique « zones dangereuses » est un échafaudage. Cadrage ouvert
  (ce document). Périmètre réduit au noyau ; 0G / vide / escalade / pièges / eau montante sortis.
  RAW feu + acide + décompression + noyade + froid + radiations transcrits ; réfs pro Foundry v12 /
  PF2e relevées. Rien codé.
