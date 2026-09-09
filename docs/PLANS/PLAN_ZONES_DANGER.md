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

*Déjà modélisé (par token, pas par zone)* `[VÉRIFIÉ 2026-09-09]` :
- `burning` dans `environmentalHazardRegistry` (`forcedLocation: null`) + hook builtin `fire`
  (`modifiers` `movementMultiplier:1` / `sightOpacity:0.12` ; hook `turnStart` / `damage`
  `amountPerIntensity:1`).
- **Aucun catalogue `ref_equipment` d'intensités de feu.** L'intensité (petite flamme / moyen / grand
  feu / brasier) est un **choix du MJ à l'exposition** : elle vit dans `token_statuses.data`
  (`formula`, `locations`, `forcedLocation`), jamais dans le code (tranché Saar après recherche pro
  Foundry / PF2e — `PLAN_FATIGUE_DOMMAGES.md` §9 point 2).
- Route MJ manuelle : `POST /:id/tokens/:tokenId/hazards/:code/expose` `{ formula, locations?,
  forcedLocation? }` — **pas de `durationDice`** → un feu posé main est permanent jusqu'à
  `clearHazard`.
- Le lance-flammes code en dur `formula:'2D10', locations:'1D3', durationDice:'2D6'`
  (`aoeMechanisms/flamethrower.js`).
- **Écarts connus** : le hook builtin fait 1 point × intensité, pas la formule de dés RAW (le pont
  §2.1(2) doit brancher la vraie formule) ; `resolveTargetHit` accepte `armorReductionFactor` (défaut
  1) mais `resolveEnvironmentalHazardTicks` ne le passe jamais → « tenue ignifugée » non modélisée.

Analyse du cas complète en §4.1.

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

### 3.8 Eau / immersion — `REGLEBLESSURES.md` §§ Souffle, Froid, Noyade/Asphyxie, Décompression ; `REGLECOMPETENCE.md` (Athlétisme, Manœuvres sous-marines)

RAW lu directement le 2026-09-09 (`docs/REGLES/REGLEBLESSURES.md` = même chapitre « États de santé »
que `FATIGUE&DOMMAGES.md`, avec le §Souffle en entier). **Ce que l'eau fait réellement, RAW :**

- **Souffle** (`REGLEBLESSURES.md` §Souffle, OPTIONNEL) — l'attribut secondaire = nombre de Tours de
  combat pendant lesquels on **retient sa respiration**. `calcSouffle` (`shared/polarisUtils.js`) = le
  **plafond**. Prendre sa respiration = 1 Tour complet ; **surpris → Souffle ÷ 2** (une brèche qui
  inonde / dépressurise soudainement). Un seul et même attribut couvre **immersion, manque d'O₂
  (vide), et gaz nocif** — RAW littéral. Dès qu'on retient son souffle, perte selon l'activité :
  immobile −1 / Tour · modérée (marche, nage lente) −2 · intense (course, nage rapide) −3 ·
  **combat −4 / Tour**. Souffle épuisé → Test d'**Athlétisme** : MR ≥ 1 = ce nombre de Tours de
  sursis ; malus cumulatif (= points perdus selon activité) à chaque nouveau Test ; **Test raté →
  début de noyade / asphyxie / effet du gaz**. Hyperventilation (≈ 10 Tours de prépa, aucune autre
  action) : Test d'Athlétisme secret → ± MR Tours de Souffle.
  **`[VÉRIFIÉ]` : aucun Souffle *courant* runtime — `calcSouffle` ne produit qu'un plafond.**
- **Noyade / Asphyxie** (§3.4) : après le Test d'Athlétisme raté → inconscience en 2D6 Tours, mort
  ~5-7 min (réanimation Premiers soins, malus = 2 × minutes).
- **Froid de l'eau** (§3.5) : immersion / vêtements mouillés → tous les délais de Froid ÷ 2.
- **Terrain / nage** : vitesse via **Athlétisme** (FOR/COO) ; courants → Difficulté modifiée ;
  Catastrophe → blessure / emporté.
- **Manœuvres sous-marines** (FOR/COO) **remplace Acrobatie/Équilibre** sous l'eau **et plafonne** les
  Compétences de coordination (dont le combat) ; **pas** pour hybrides / créatures aquatiques.
  Équivalent apesanteur : **Manœuvres 0G**. Armure mécanisée : Manœuvre d'armure sous-marine /
  spatiale.
- **Décompression** (§3.3) : remontée trop rapide → 1D10 (ou 2D10) / Tour, Corps.
- **Respiration de fluide** (néo / hyper-fluide, `REGLECOMPETENCE.md`) : Compétence Respiration FOE,
  malus d'adaptation −4 / −10 pendant 2D6 min, Fatigue accélérée, profondeurs / durées limites —
  **échelle non-combat, hors périmètre**.
- **Pression des profondeurs** : `[INCONNU]` — pas de section dédiée dans cette extraction
  `REGLEBLESSURES.md` (la « décompression » est le seul volet pression). Limites de plongée par
  fluide dans `REGLECOMPETENCE.md` ; phénomène « Modification de la pression » (± 100 m / point) dans
  `REGLEPOLARIS.md` (incident de Force). À reconfirmer sur le PDF avant tout chantier profond.

**Unification RAW à retenir** : immersion, **vide spatial** et **gaz nocif** partagent la même
colonne vertébrale — « atmosphère non respirable » → on retient son souffle → Souffle décroît selon
l'activité → cascade de Tests d'Athlétisme → noyade / asphyxie / effet du gaz. Une seule mécanique
pour trois familles de zones.

### 3.9 Vide spatial / apesanteur / atmosphère hostile — `REGLEBLESSURES.md` (Souffle, Décompression, Froid), `REGLECOMPETENCE.md` §Manœuvres 0G, `REGLEARMURE.md`

RAW lu le 2026-09-09. **Il n'existe pas de section « Vide » autonome** dans le chapitre États de
santé. Ce que le vide / l'espace fait, RAW, c'est la somme de mécaniques déjà transcrites :

- **Pas d'air** → §3.8 (colonne vertébrale Souffle). Identique à la submersion, sans les couches
  nage / mouillé / courant.
- **Froid** → §3.5 (l'espace est froid ; combinaison spatiale = annule jusqu'à un seuil).
- **Décompression** → §3.3 (transition de pression : sortir d'un sas sans combinaison, remonter).
- **Apesanteur (0G)** : **pas un danger** — modificateur de déplacement + **Manœuvres 0G remplace
  Acrobatie/Équilibre et plafonne les Compétences de coordination** (même effet structurel que
  Manœuvres sous-marines, §4.2). Armure mécanisée → Manœuvre d'armure spatiale.
- **Implosion d'armure dans le vide** (`REGLEARMURE.md`) : si la coque éclate en milieu hostile →
  **mort instantanée** du pilote. Conséquence spéciale d'une destruction d'armure, **pas un tick de
  zone** — noté seulement.
- **« La Surface »** (monde empoisonné) : zone composite = atmosphère toxique (pluies acides §3.2) +
  radiations (§3.6) + Souffle. Pas une mécanique neuve, un assemblage.

**Conclusion du cas** : « vide » ne crée **aucun champ nouveau**. Il valide que 3 familles de Saar
(eau-submersion, vide, gaz) se réduisent à *une* mécanique Souffle + des couches composables
(froid, décompression, mouvement). Resserrement, pas expansion.

## 4. Liste de champs — **NON FIGÉE, cœur du cadrage**

À construire cas par cas avec Saar : les champs *émergent* des cas RAW, on ne les invente pas dans le
vide. Premier jet des colonnes qu'une définition de zone devra porter, à valider / trancher :

- **Effet(s)** — une zone peut en cumuler : `dégât` | `test` | `statut` | `modificateur` |
  `perte de carac` | `soin` *(= dégât négatif, même résolveur)* | `drain de ressource` (§4.2) |
  `mouvement forcé` (§4.2, courant) | `substitution / plafond de compétence` (§4.2, sous-marin / 0G).
- Par effet `dégât` : formule de dés · nb de Localisations (fixe ou formule) · Localisation forcée ·
  type (feu / acide / …) · facteur de réduction d'armure.
- Par effet `test` : attribut / compétence · Difficulté (d'où ? « puissance » ?) · conséquence
  d'échec (malus ? statut ? perte ?).
- Par effet `drain de ressource` : quelle ressource (Souffle…) · montant / Tour · conséquence à 0.
- **Cadence** : à l'entrée (one-shot) · par Tour de présence · passif permanent.
- **Condition d'application** : toujours · seulement si un seuil géométrique est franchi (taille du
  token vs profondeur de la zone — §4.2 submersion).
- **Escalade** : + par Tour de présence (montant, plafond ?).
- **Rémanence en sortie** — ce qui arrive à l'occupant qui quitte la zone (4 modes) :
  `rien` (arrêt net) · `persistance fixe` (N Tours puis arrêt — acide RAW 1D6 Tours) ·
  `décroissance` (−X / Tour ou −X / N Tours jusqu'à 0 — gaz irritant −1/Tour, suffocant −1/2 Tours) ·
  `conditionnelle` (jusqu'à un geste — éteindre le feu, se sécher).
  → tout mode ≠ `rien` **et** `persistance fixe` acceptent une **condition d'arrêt anticipé** nommée
  (neutraliser l'acide, medkit antibrûlure…) — champ commun avec « Extinction » du feu.
  → « enflamme la cible » = pour le feu, choisir `conditionnelle` au lieu de `rien`. Quel que soit le
  mode ≠ `rien`, l'effet doit survivre à la zone → statut attaché au token (**patron spawner**).
- **Cible de l'effet** : personnage · **équipement / matériau** (acide : chair / métal / plastique…
  — RAW §3.2 ; route vers `char_inventory` + Usure&Intégrité) · géométrie (le feu brûle les débris).
- **Atténuation** : équipement immunisant (total / partiel) **ou capacité de perso** (branchies /
  hybride / génotype, compétence Respiration FOE — §4.2) · comportement (« apnée » = ½) · barrière
  (porte fermée coupe le canal).
- **Cycle de vie** : `duration_rounds` fixe · timer de dés · conditionnel (aération / vent) ·
  permanent jusqu'au retrait MJ · one-shot puis disparaît.
- **Géométrie** : volume fixe · compartiment(s) · forme AOE · se propage (m³ / Tour) ·
  **mobile / dérivante** (nuage déplacé par le MJ ou par un vecteur de vent — §4.6) ·
  (plus tard) change de volume (eau qui monte). → « mobile » et « change de volume » = la même
  capacité *géométrie dynamique* sous deux angles, à mutualiser.
- **Chaînage** : engendre une autre zone (feu → fumée / air vicié) — décalage / délai ? condition
  (lieu clos) ?
- **Visibilité joueurs** : affichée · cachée (bascule MJ) · **cachée jusqu'à détection** (piège :
  Difficulté de repérage — Test Pièges / Perception — + désamorçable par Test Pièges — §4.5).
- **Intensité** : scalaire unique actuel — sert au mouvement + opacité + (proposé) échelle du dégât /
  Test.

### 4.1 Cas « feu » — premier cas travaillé (2026-09-09)

RAW : §3.1. État actuel (par token, `[VÉRIFIÉ]`) : §3.1 paragraphe « Déjà modélisé ».

**Ce que le MJ doit pouvoir renseigner pour poser une zone de feu :**

| Champ | Valeurs (feu) | Remarque |
|---|---|---|
| **Formule dégât / Tour** | saisie libre (`1D6` / `1D10` / `2D10` / `3D10` selon l'intensité) | **décision Saar 2026-09-09 : ligne libre pour le moment**, pas d'enum de préréglages — le scalaire `intensity` ne suffit pas (chaque cran RAW change aussi la Localisation) ; un menu de préréglages viendra comme confort UI plus tard |
| **Nb de Localisations** | saisie libre (`1` / `1D3` / …) | petite + moyen = 1 ; grand feu = 1D3 ; brasier = MJ |
| **Mode de Localisation** | exposée (forcée) · aléatoire | petite + moyen = « Localisation exposée » désignée par le MJ ; grand + brasier = aléatoire |
| **Localisation exposée** | clé `LOCATION_TO_SLOT` | visible seulement si mode = exposée |
| Cadence | par Tour de présence (`turnStart`) | fixe pour le feu — pas un choix |
| **Facteur de réduction d'armure** | 1 (normal) · < 1 (tenue ignifugée) | `resolveTargetHit` le supporte déjà ; le tick ne le passe pas |
| Équipement ignifugé | liste → réduction / immunité | RAW « tenues ignifugées » — nécessite un drapeau `ref_equipment` |
| **Rémanence en sortie** | `rien` · `conditionnelle` (jusqu'à extinction) | « enflamme la cible » = choisir `conditionnelle` (cf. axe §4) — pas un champ propre au feu |
| **Extinction** | action MJ · immersion (recouvrement zone `flooded`) · timer | RAW « jusqu'à ce que les flammes soient éteintes » |
| **Cycle de vie de la zone** | permanent jusqu'à extinction · timer fixe N Tours · timer dés | grenade incendiaire = timer court ; feu de carte = permanent |
| Modificateurs | `sightOpacity` (fumée légère) · `movementMultiplier` | builtin `fire` : 0.12 / 1 |
| **Engendre** | fumée · air vicié (si lieu clos) | chaînage — hors preuve-de-concept, mais le champ doit exister dans le vocabulaire |
| Stress | déclenche un Test de Volonté (hybrides, animaux → fuite) | RAW — effet secondaire, à cadrer plus tard |

**Trouvailles du cas feu (impactent le socle) :**

1. **Le scalaire `intensity` ne capture pas l'échelle du feu.** Les 4 crans changent la *structure*
   (règle de Localisation), pas seulement l'ampleur. → **décision Saar 2026-09-09** : la définition
   porte `formula` + nb Localisations + mode explicitement (saisie libre) ; pas d'enum de préréglages
   pour l'instant (menu de confort UI plus tard). Aligné sur le modèle par-token (`data`).
2. **`armorReductionFactor` est dans `resolveTargetHit` (défaut 1) mais jamais passé par
   `resolveEnvironmentalHazardTicks`.** Câblage trivial (`data.armorReductionFactor` → l'appel).
   Prérequis de « tenue ignifugée ».
3. **La rémanence en sortie ≠ `rien` ⟹ patron *spawner*.** Pour le feu : la zone pose un `burning`
   sur l'occupant ; à la sortie il s'efface (exposition passagère) OU persiste jusqu'à extinction
   (a pris feu). L'effet doit alors survivre à la zone → statut attaché au token. Argument direct
   pour Q6.1 : la zone est un spawner de statut, pas une résolution in situ. C'est un axe **général**
   (§4 « Rémanence en sortie »), pas un champ propre au feu — cf. réponse à Saar : pour l'inondation
   le même axe donne « vêtements trempés » (qui alimente ensuite le Froid ÷ 2), pour l'acide « linger
   1D6 Tours », pour le gaz « décroissance −1 / Tour ».
4. **Extinction par recouvrement de zones** : une zone `flooded` sur une zone `fire` doit l'éteindre.
   → interaction inter-zones (hors socle minimal, à cadrer).
5. **Pas de `durationDice` sur la route MJ manuelle** — feu posé main = permanent. La grenade
   incendiaire aura besoin de `duration_rounds` (colonne existante, jamais utilisée). Confirme le
   point 3 du socle (§2.1).

### 4.2 Cas « inondation » — deuxième cas travaillé (2026-09-09)

RAW : §3.8 (+ §3.4 noyade, §3.5 froid). État actuel : builtin `flooded`
(`movementMultiplier: 2`, hook `traverse` note « règles de nage ») + canal de propagation `water`
+ drapeau `blocksWater` par salle / barrière. **Rien d'autre.**

**Constat majeur : « inondation » n'est pas *un* cas, c'est 3-4 couches d'effet qui s'empilent.**

| Couche | Effet | État |
|---|---|---|
| **Eau au sol** (peu profond) | `movementMultiplier` ; nage = Athlétisme ; pas de dégât | builtin `flooded` — OK |
| **Submersion** (tête sous l'eau, pas d'appareil) | RAW §3.8 : on retient son souffle → Souffle −1 à −4 / Tour selon l'activité (combat = −4) → épuisé → cascade de Tests d'Athlétisme (malus cumulatif) → Test raté → noyade (2D6 Tours → inconscience) | **rien** — pas de Souffle courant runtime |
| **Froid de l'eau** | chaînage → Froid (délais ÷ 2) ; rémanence `conditionnelle` « vêtements trempés » | chaînage à cadrer |
| **Courant** | modificateur Difficulté Athlétisme + **mouvement forcé** directionnel | `worldForcedMovementService` existe, pas branché |

**Unification RAW (§3.8)** : la couche « Submersion » n'est pas propre à l'eau — **immersion, vide
spatial et gaz nocif partagent la même mécanique** (retenir son souffle → Souffle → cascade
Athlétisme → noyade / asphyxie / effet du gaz). C'est *une* mécanique de zone, réutilisée par trois
familles. Le « retenir sa respiration = ½ » des gaz (`PLAN_NUAGE`) EST ce mécanisme.

**Champs nouveaux que ce cas fait émerger (au-delà du feu) :**

- **Substitution / plafond de compétence** : la zone *remplace* Acrobatie/Équilibre par Manœuvres
  sous-marines (ou 0G) et *plafonne* les Compétences de coordination. Type d'effet `modificateur`
  bien plus structurel qu'un malus plat. `[INCONNU]` : le moteur combat sait-il router ça ?
- **Drain de ressource / Tour** : la zone consomme une ressource (Souffle) au lieu d'infliger un
  dégât. Généralise l'axe « Escalade » : escalade = +malus / Tour ; drain = −ressource / Tour. RAW
  §3.8 : le taux dépend de l'**activité de l'occupant** (−1 immobile … −4 combat), pas de la zone —
  la définition porte « quelle ressource » + « conséquence à 0 » (ici : cascade Athlétisme → noyade),
  le taux est lu sur l'occupant.
- **Condition d'application géométrique** : la submersion ne s'applique que si la tête est sous l'eau
  → dépend de **taille du token vs profondeur de la zone** (échelle Y). Champ « seuil de
  déclenchement géométrique ».
- **Immunité par capacité de perso, pas que par équipement** : branchies / hybride (génotype),
  Respiration FOE (compétence) — l'atténuation (§4) doit accepter *équipement OU capacité*.
- **Mouvement forcé directionnel** (courant) : la zone *pousse*, pas seulement ralentit → vecteur +
  intensité, via `worldForcedMovementService`.
- **Une instance = plusieurs couches** : « inondation profonde » = terrain + submersion + froid.
  Conforte §4 « une zone cumule plusieurs effets ».

**Trouvailles impactant le socle :**

1. **Aucun Souffle runtime.** `calcSouffle` = un plafond calculé, pas de valeur courante. Prérequis
   de submersion **et de vide et de gaz nocif** (mécanique unifiée §3.8). Même besoin d'état par
   token que le compteur d'exposition (Q6.2) — un seul « état d'occupant vis-à-vis d'une zone »
   couvrirait les deux. La cascade RAW (Souffle → Tests d'Athlétisme → noyade) est plus riche qu'un
   simple compteur : c'est une petite FSM par occupant.
2. **Substitution / plafond de compétence** : à auditer côté moteur combat **avant** tout chantier
   eau. `PLAN_ENVIRONNEMENT_MILIEUX.md` classe le milieu mais ne route pas encore les compétences.
3. **Condition géométrique (taille vs profondeur)** dépend de l'échelle Y — repousse tout le volet
   « profond » avec la géométrie temporelle (niveau qui monte).
4. **Le courant = consommateur naturel de `worldForcedMovementService`.**
5. **Confirme la stratégie du cadrage** : l'inondation est bien plus lourde que le feu (Souffle
   runtime + routage de compétences + géométrie Y). Le socle minimal reste **le feu** (mono-couche) ;
   l'eau vient nettement plus tard, par couches.

### 4.3 Cas « vide spatial / apesanteur » — troisième cas (2026-09-09)

RAW : §3.9. **Aucun champ nouveau.** Le cas sert à valider le resserrement :

- **Atmosphère non respirable** (vide, air vicié, lieu clos privé d'O₂) = la mécanique Souffle de
  §3.8, sans les couches aquatiques. Un seul type d'effet `atmosphère non respirable` (paramètre :
  rien de plus que « déclenche la cascade Souffle »).
- **0G** = effet `substitution / plafond de compétence` (§4.2) + modificateur de déplacement. Pas de
  dégât. Réutilise à l'identique le champ créé pour le sous-marin.
- **Chaînage concret** : feu en **lieu clos** → `Engendre` une zone `atmosphère non respirable` qui
  grandit par compartiment (RAW §3.1 « raréfaction de l'oxygène dans un lieu clos »). Premier exemple
  net du champ `Engendre` + du modèle de compartiments.
- **Composites** : « la Surface » = acide + radiations + Souffle empilés, pas une définition neuve.

→ Les familles F1 (atmosphère/gaz), F3-submersion (eau) et F4 (vide) **partagent la colonne
vertébrale Souffle**. Le vocabulaire se resserre : 1 mécanique respiratoire + des couches.

### 4.4 Cas « acide » — quatrième cas (2026-09-09)

RAW : §3.2 (`REGLEBLESSURES.md` / `FATIGUE&DOMMAGES.md` §Acide). État actuel : `acid` +
`clearHazard(linger: true)` = 1D6 Tours.

RAW en clair : dégâts progressifs **« comme le feu »**, rythme + durée selon la **puissance**, ou
jusqu'à neutralisation. Atmosphère corrosive (pluies acides de la Surface) → dégâts jusqu'à la sortie,
puis **1D6 Tours de persistance** (ou neutralisation avant). **Préciser la cible matérielle** (métal /
chair / …). Neutralisant généralement nommé.

**Champs : quasi identiques au feu**, plus deux précisions :
- **Rémanence en sortie** = `persistance fixe` 1D6 Tours **avec condition d'arrêt anticipé**
  (neutralisant) — d'où l'ajout au champ §4.
- **Cible = matériau** : l'acide ronge l'équipement, pas que le perso. → le résolveur doit router un
  dégât vers `char_inventory` (schéma ITG d'Usure & Intégrité, L0 livré). Synergie directe avec ce
  chantier.

**Trouvaille socle** : « comme le feu » est littéral dans le RAW → feu et acide partagent le même
résolveur de dégât progressif. Le seul vrai ajout de l'acide = **dégât matériel** (route
`char_inventory` / Intégrité).

### 4.5 Cas « terrain & pièges » — cinquième cas (2026-09-09)

RAW browsé : `REGLESYSCOMBAT.md` §Allures, §Test de Pièges ; `REGLECOMPETENCE.md` / `ATTRIBUTS.md`
§Pièges (-3) ; `REGLECACARTMARTIAUX.md` (terrain instable) ; §Chute (terrain accidenté). État actuel :
builtins `unstable` / `oil` (`modifiers` + hook `traverse` test).

**Terrain — la zone la plus légère, aucun champ neuf :**
- « Terrain difficile » (décombres, glissant, boue, végétation, passage étroit, **eau jusqu'à la
  taille**) et « terrain dangereux » (mines, pièges, équilibre instable, débris tranchants) → le
  joueur *choisit* l'**Allure lente**. Pas de malus forcé, **pas de dégât**.
- Seuls dégâts liés : chute sur terrain accidenté = **+1D10** aux Dommages de chute (§Chute) ;
  combat « sur terrain instable / en équilibre » = malus (`REGLECACARTMARTIAUX`).
- → `modifiers` (`movementMultiplier`) + hook `traverse` (test Équilibre) + option modificateur de
  combat + option `+ND aux Dommages de chute`. Les builtins `unstable` / `oil` le font déjà.

**Pièges — pas un effet, une couche visibilité + interaction :**
- Compétence **Pièges (-3)** : créer / poser / **repérer** / **désamorcer**. MR à la pose →
  efficacité **ou** dissimulation (malus au repérage). Déclenchement « par un procédé quelconque
  (laser, mouvement…) ».
- Le RAW **ne définit aucun effet de piège** — un piège délivre ce qu'on lui câble (lame, explosif,
  gaz). → un piège = une zone avec `cadence: à l'entrée (one-shot)` + `caché jusqu'à détection`
  (Difficulté de repérage) + `réarmable` (oui/non) + `désamorçable` (Test Pièges). L'**effet**
  réutilise tout le vocabulaire de zone.
- Nouveaux champs : `caché jusqu'à détection` + `DC repérage` + `désamorçage` — couche visibilité
  (§4), pas un nouvel effet.

### 4.6 Débat — le nuage (`PLAN_NUAGE`) est-il une zone dangereuse ?

**Position de Saar (2026-09-09)** : une zone dangereuse *est* un volume, déplaçable par le MJ,
concomitant sur plusieurs pièces — donc un nuage qui se déplace **est** une zone dangereuse.

**Analyse `[VÉRIFIÉ code]`** : le socle le permet déjà en grande partie —
- `world_effect_instances.targetKind` accepte `volume` (AABB) **et** `compartment` (multi-pièces).
- `propagateEffectThroughCompartments` crée **N instances liées** (une par compartiment,
  `metadata.propagatedFrom`), canal `gas`, coupé par porte fermée.
- `updateWorldEffectInstance` peut déjà changer `volume` → le MJ *pourrait* déjà déplacer une zone
  (pas d'UI, pas de dérive automatique).
- L'effet du nuage (colonne Souffle §3.8), la dissipation (timer), l'occlusion (`sightOpacity`) sont
  déjà dans le vocabulaire.

**Ce qui manque pour un nuage vraiment mobile :**
1. **Déplacer / faire dériver** une instance volume (glisser MJ ; ou vecteur de vent → recalcul
   chaque Tour).
2. **Un nuage = une entité, pas N instances figées** : la propagation actuelle fige N instances à la
   création ; un nuage qui bouge doit **recalculer sa couverture de compartiments** chaque Tour.
3. Dissipation **conditionnelle** (aération / vent), pas qu'un timer.

**Recommandation : intégrer.** `PLAN_NUAGE` devient une **spec de consommateur** qui apporte au
socle la capacité **« géométrie dynamique »** (mobile / dérivante / propagative) — **la même** que
« eau qui monte », à mutualiser. Ça ne casse pas `PLAN_NUAGE` : ses 6 gaz + fumigènes restent la
matière ; ils deviennent des définitions de zone à effet Souffle + occlusion. → répond à **Q6.4**.
Reste hors socle minimal (le feu, mono-couche statique, ne le demande pas).

### 4.7 Éditeur de volume MJ — demande Saar 2026-09-09

**Demande** : refondre l'interface « zone dangereuse » pour un **volume réel** —
- le MJ choisit la **forme** (cube · sphère · cylindre · autre ?) ;
- **redimensionnement** par poignée sur chaque arête ;
- **déplacement** en drag & drop sur la playground (vue de session, pas l'éditeur).

**État actuel `[VÉRIFIÉ code]`** : `SurfaceEditorPanel.jsx` (mode `effect`, dans **Editor3D**, pas la
session) — empreinte **peinte sur la grille** + champs `Intensité` et `Hauteur du volume` (nombres).
La géométrie stockée (`world_effect_instances.volume`) est **déjà un AABB 3D** (`{min:{x,y,z},
max:{x,y,z}}`) — donc un vrai volume, pas une empreinte 2D. `pointInsideEffectBounds` /
`segmentIntersectsEffectBounds` / occluders / facteurs de déplacement le consomment.
`world_effect_instances.targetKind` accepte aussi `compartment` : l'effet remplit alors N
compartiments entiers (rooms reliées), **géométrie = les salles elles-mêmes, respect des murs
gratuit** — c'est le mode « nuage qui remplit une pièce » (déjà utilisé par la propagation).

**Position Saar 2026-09-09** : Enclume a un **world builder 3D avec étages** → on a **besoin d'un
volume**, pas d'une empreinte 2D + bande d'élévation. Le modèle Foundry (§5.1) = une contrainte d'un
moteur 2D, **pas une cible pour nous**. Forme précise : **pas encore fixée**.

**Les vraies questions (à trancher avec Saar) :**
1. **Quelles formes de volume ?** Options, du moins cher au plus flexible :
   - `boîte AABB` (actuel) — test trivial, redim. par 6 faces, pas de rotation ;
   - `boîte orientée` (+ rotation autour de Z) — couvre un couloir en biais ;
   - `sphère` — 1 poignée (rayon), naturel pour une explosion ;
   - `cylindre vertical` (disque + hauteur) — colonne de gaz / de feu ;
   - `prisme` (polygone dessiné au sol + extrusion en hauteur) — le plus flexible, colle à une
     section de pièce irrégulière ;
   - `compartiment(s)` (déjà là) — remplit des salles entières, mur-conscient.
   `aoeShapes.js` fait `circle` / `cone` / `ray` (2D horizontal, pour l'AOE) — **pas** une lib de
   volumes 3D prête, à ne pas surestimer.
2. **Géométrie consciente ou aveugle ?** Un `volume` brut ignore murs et sols (le feu « traverse »
   un plancher scellé si l'AABB déborde). Le mode `compartment` est mur-conscient. Faut-il que le
   `volume` brut soit clippé par la géométrie du monde (ne pas franchir un sol / mur plein), ou
   garde-t-on deux modes explicites (`volume` aveugle pour une pose rapide MJ + explosions ;
   `compartment` conscient pour nuages / inondation) ?
3. **Multi-étages** : « le feu de l'étage 1 atteint-il l'étage 2 ? » doit dépendre d'un plancher
   entre les deux (géométrie du monde), pas seulement du recouvrement en Z.
4. **Interaction runtime sur la playground** : nouvelle surface dans `Canvas3D.jsx` (session), MJ
   only, aperçu optimiste + confirmation serveur (`react.md`) — le socle données existe
   (`world_effect_instances` runtime + `runtime_revision`), pas l'interaction. Poignées de redim. +
   drag = à concevoir par forme.
5. **Éditeur (authoring statique) vs playground (runtime)** : deux points de pose. Aujourd'hui seul
   l'éditeur existe.

6. **Éditeur de forme libre (proposition Saar, 2026-09-09)** — flux : bouton dans une pièce → crée
   un volume « Zone de danger » = la salle ; arêtes visibles et sélectionnables pour redim. ; curseur
   sur le volume = déplacer ; double-clic = nouvelle arête ; fenêtre Valider / Annuler en bas à
   droite. Détaché de la pièce d'origine (« détacher la forme de la pièce qui l'a vue naître »).
   Analyse UX en §4.7bis.

**Séquencement** : surtout **UX + géométrie**, ne dépend PAS du résolveur d'effets — peut avancer en
parallèle et rendrait le consommateur « zones MJ » réel plus tôt. Sous-chantier dédié.

### 4.7bis Éditeur de forme — analyse UX (2026-09-09)

**Idiomes pour de l'édition de forme 3D « ultra-simple »** (l'édition de maillage libre est hors
sujet pour un outil MJ) :
- **Primitives paramétriques** — choisir boîte / sphère / cylindre, 1 poignée par paramètre. Simple,
  formes régulières seulement.
- **Empreinte extrudée (2.5D)** — un **polygone 2D vu de dessus** + une **hauteur** (Z bas / haut).
  Toute l'édition reste 2D + 1 scalaire ; formes quelconques (concaves, en L). Patron SketchUp
  push/pull, éditeurs de plan, volumes de nav-mesh. **C'est le bon modèle pour la demande de Saar.**

**Donnée** : le volume = liste ordonnée de sommets (polygone) + `zBas` / `zHaut`. La proposition de
Saar (ajout d'arêtes) impose ce modèle `prisme` (§4.7 option 5), quel que soit l'éditeur.

**Articulation de « ajouter des arêtes »** (standard) :
- sommets = poignées attrapables aux coins, contraintes au plan horizontal ; Z via 2 poignées
  verticales ou les faces haut / bas ;
- **ajout de sommet = poignée « + » au milieu de chaque arête** (la glisser scinde) — plus
  découvrable que le double-clic (garder les deux) ; **double-clic sur un sommet = le supprimer** ;
- **garde-fou anti-auto-sécance** (refuser le drag qui crée un nœud papillon) ; concave = OK ;
- **accrochage** grille / murs / autres sommets, touche modificatrice pour libérer ;
- session = aperçu client réversible ; **Valider** = 1 écriture (`updateWorldEffectInstance`),
  **Annuler** = retour (patron rotation / échelle existant, `react.md`).

**Le flux de Saar, point par point :**
| Étape | Verdict |
|---|---|
| Bouton dans une pièce → volume = la salle | ✅ excellente amorce. `[VÉRIFIÉ]` une salle Enclume = **empreinte de cellules de grille** (`worldCompiler.js:1191`), pas un polygone → le volume créé = le contour de ces cellules. Copie détachée (option « lié à la salle » plus tard). |
| Arêtes visibles + sélectionnables pour redim. | ✅ standard |
| Curseur sur le volume → déplacer | ✅ mais contrainte de plan (horizontal par défaut, poignée dédiée verticale) + priorité de clic aux poignées |
| Double-clic → nouvelle arête | ⚠️ OK ; ajouter **aussi** les poignées « + » d'arête ; « double-clic dans le vide » = rien |
| Fenêtre Valider / Annuler bas-droite | ✅ colle au codebase |

**Ce que le flux omet** : contrôle de **hauteur / Z** ; accrochage ; **rendu** (remplissage
translucide + arêtes colorées, visible à travers les murs) ; **clipping par la géométrie du monde**
(question 2 ci-dessus, non tranchée).

**Feasibility — le point dur** : `[VÉRIFIÉ]` **aucun éditeur de sommets n'existe dans le client**
(rooms et effets = peints à la cellule ; grep : pas de `addVertex` / `splitEdge` / drag de sommet).
Le flux de Saar = **un nouveau paradigme d'interaction** (raycasting de poignées 3D, plans de drag,
accrochage, garde anti-auto-sécance) — **le gros morceau du sous-chantier.**

**Phasage recommandé :**
- **v1** : preset boîte + « copier la salle » (prisme aligné axes, depuis les cellules) + déplacer +
  redim. par face + hauteur. Couvre déjà « le gaz remplit cette pièce / cette zone ».
- **v2** : le sculpteur de polygone (sommets + arêtes « + »). ~60 % du travail du sous-chantier,
  autonome. Si Saar le veut d'emblée, c'est jouable — juste dimensionner le sous-chantier en
  conséquence.

### Interface MJ sans code

À réfléchir une fois les champs stabilisés — cases à cocher + champs numériques + listes déroulantes,
zéro script. Point d'attention : exprimer « malus +1 / Tour, −1 / Tour après sortie, sauf masque »
sans que ça devienne un langage.

## 5. Références pro — recherche 2026-09-09

### 5.1 Foundry VTT v12 — Scene Regions (l'autorité géométrie / événements)

- **Géométrie = composite de *Shapes* 2D** (rectangle · ellipse · polygone) + trous (shapes
  négatives) + **une plage d'élévation** (bas / haut). **Pas de primitive 3D** — un « cylindre » =
  ellipse + plage d'élévation ; **pas de sphère**. Dessin sur le canvas, redimensionnement /
  déplacement par poignées de la couche Régions, « shape depuis les murs ».
- **Behaviors continus** : Adjust Darkness · Suppress Weather · **Modify Movement Cost** (0–5 par
  pas de 0,25 — quasi identique à notre `movementMultiplier`).
- **Behaviors événementiels**, abonnés à des *Events* : `Enters` / `Exits` / `Moves In` / `Out` /
  `Within`, **`Starts / Ends Turn`**, **`Starts / Ends Round`**, `Region Boundary Changed`.
- **Le cœur n'a AUCUN behavior « dégât » ni « statut ».** Un dégât dans une région passe par
  `Execute Script` ou un module tiers (Enhanced Region Behaviors : « Trap Region » = jet de save +
  dégât à l'entrée / sortie / dans la zone). → même le leader du marché n'a pas de dégât
  environnemental déclaratif natif.
- **PF2e sur Foundry** ajoute des **types d'environnement de scène + overrides par région** → le
  *milieu* est une propriété de région, surchargeable par zone. Confirme la direction de
  réconciliation (§7.10).

### 5.2 Pathfinder 2e — « Persistent Damage » (le mécanisme RdR pour un dégât continu)

- C'est une **condition sur la créature**, pas un suivi par la zone. Elle tique **à la fin du Tour
  de la créature** (dés relancés à chaque tick), puis **jet à plat DC 15 pour s'en débarrasser**.
  Foundry PF2e l'auto-résout / retire en fin de Tour.
- → **validation externe du patron *spawner* (Q6.1)** : la zone applique une condition à l'entrée ;
  la condition vit sur le token, tique sur son Tour, porte sa propre sortie (jet à plat = notre
  « condition d'arrêt anticipé »). La zone n'a alors **pas besoin d'une requête « qui est dedans »
  parfaite par Tour** — seuls `enter` / `exit` comptent (atténue §7.4).

### 5.3 Fantasy Grounds — grammaire d'effets `SAVEO` / `AURA` (le « jusqu'où va le déclaratif »)

- FG-Aura-Effect : une aura ajoute / retire des effets aux autres par proximité. Exemple littéral :
  `AURA: 10 foe; Stench; IF: FACTION(foe); SAVEO: wisdom DC 16; SAVEEFF: poisoned 1r`.
- `SAVEO` = save récurrent · `SAVEDMG` = dégât sur échec · `SAVEEFF` = condition sur échec ·
  codes de durée `(C)` etc.
- → la réponse du marché à Q6.3 : une **grammaire de tags `clé: valeur`** composable, sans
  JavaScript — mais **c'est bien un mini-langage**. À l'opposé, Foundry = formulaire + échappatoire
  script. Le « tout en cases à cocher » de Saar correspond au modèle **Active Effects de D&D 5e**
  (lignes typées `clé / mode / valeur`) **+ un catalogue de préréglages** (`dfreds-convenient-
  effects`) pour les cas courants.

### 5.4 Module « Danger Zone » (napolitanod) — exactement notre sujet

- Modèle : **zone** (géométrie) + **danger** (paquet d'effets) + **trigger** (événement). Tout au
  formulaire, échappatoires macro.
- Triggers : mouvement de token, **changements de Tour / Round / ordre d'initiative**, bouton manuel,
  API macro.
- Effets : *active effects* (= statuts / conditions), effets persistants, spawn de tokens, création
  de lumières / murs, déplacement de tokens, macros, sons, animations.

### 5.5 Ce sur quoi les pros convergent — à retenir

1. **Séparation stricte** géométrie ≠ effet ≠ trigger (on l'a : instance / définition / hooks).
2. Foundry : géométrie = shape(s) 2D + plage d'élévation, pas de primitive 3D. **NON retenu pour
   Enclume** (Saar, 2026-09-09) : notre world builder est 3D avec étages → on veut un **vrai
   volume**. Le modèle Foundry est une contrainte d'un moteur 2D. Forme du volume : ouverte (§4.7).
3. **Le dégât continu n'est pas la zone qui tique les occupants** — c'est la zone qui **pose une
   condition sur la créature à l'entrée** ; la condition tique sur le Tour de la créature et porte sa
   propre sortie. = patron *spawner*, et ça résout à moitié §7.1, §7.2, §7.4.
4. **L'état par occupant vit sur la créature** (condition + compteur), pas dans une table
   zone×occupant. Notre `token_statuses` + `data` + `expires_at_turn` est la bonne étagère.
5. **Déclaratif = lignes d'effet typées + catalogue de préréglages**, pas une grammaire libre.
6. **Milieu = propriété de région surchargeable** (PF2e) → direction pour §7.10.
7. **Personne n'automatise le hors-combat** → la décision « hors scope » de Saar est alignée avec
   tout le marché.
8. **Personne n'automatise l'interaction zone × zone** → MJ arbitre ; différer / liste blanche (§7.6).

Sources : `foundryvtt.com/article/scene-regions/` · `foundryvtt.com/packages/enhanced-region-behavior`
· `2e.aonprd.com/Conditions.aspx?ID=29` (Persistent Damage) · `foundryvtt.com/packages/pf2e`
(environment regions) · `github.com/napolitanod/Danger-Zone` · `github.com/bmos/FG-Aura-Effect` ·
`github.com/DFreds/dfreds-convenient-effects`.

## 6. Questions ouvertes (ordre de traitement à décider avec Saar)

1. ~~Une boucle ou deux ?~~ **Tranché par la recherche (§5.2 / §5.5.3)** : patron *spawner* — la zone
   pose une condition (`token_statuses`) à l'`enter`, la condition tique sur le Tour de la créature
   via le tick hazard généralisé et porte sa propre sortie. Pas de 2ᵉ boucle. Reste à faire : la
   généralisation du tick hazard (aujourd'hui 3 codes en dur).
2. **État par occupant** : validé « sur la créature » (§5.5.4) — `token_statuses.data` +
   `expires_at_turn`. La cascade Souffle RAW (§3.8) reste plus riche qu'un compteur (mini-FSM) —
   à loger dans `data`.
3. Jusqu'où va le déclaratif : **cadré par §5.3 / §5.5.5** — lignes d'effet typées (patron Active
   Effects) + catalogue de préréglages, **pas** de grammaire libre. Reste à écrire le vocabulaire
   exact (extension de `normalizeHook`).
4. ~~`PLAN_NUAGE` : absorbé ici ou reste spec de consommateur ?~~ **Tranché 2026-09-09 (§4.6)** :
   intégré — `PLAN_NUAGE` = spec de consommateur, apporte au socle la capacité « géométrie
   dynamique » (mobile / dérivante), mutualisée avec « eau qui monte ». Hors socle minimal.
5. ~~Hors combat~~ **Tranché Saar 2026-09-09 : HORS SCOPE.** Les zones ne mordent qu'en combat
   (tick au Tour). Aligné avec tout le marché (§5.5.7). Hors combat, au mieux un `enter` / `traverse`
   cosmétique — pas de résolution.
6. Audit du système « Souffle » (prérequis air / eau) — toujours ouvert.

## 7. Analyse à charge du plan (2026-09-09)

Faite à la demande de Saar après 5 cas. **Ce qui va nous manquer / ce qui est sous-planifié.**

### 7.1 Le « résolveur unique » est en réalité un *orchestrateur* + 3 sous-systèmes neufs

« Une autorité, jamais un 2ᵉ moteur » reste vrai pour le **dégât** (`resolveTargetHit`) et le **Test**
(`gmArbitratedTestService`) et le **statut** (`statusService`). Mais le pont hook → effet est un
**dispatcher** vers N autorités, et 3 types d'effet du §4 **n'ont aucune autorité existante** :
- `drain de ressource` (Souffle) + sa cascade RAW (Tests d'Athlétisme → noyade) = une **petite FSM
  par occupant**, à écrire de zéro ;
- `substitution / plafond de compétence` (sous-marin / 0G) : `[INCONNU]` si le moteur combat sait
  router « utilise Manœuvres sous-marines au lieu d'Acrobatie » — probablement non ;
- `mouvement forcé` déclenché *par une zone* (courant) : `worldForcedMovementService` existe mais est
  déclenché par une action, pas par une présence passive dans une zone.
→ Ce ne sont pas des câblages, ce sont des chantiers. Le mot « échafaudage à compléter » sous-estime.
**Post-recherche** : le patron *spawner* (§5.5.3) réduit le dispatcher — la zone ne fait que poser une
condition à l'`enter` ; le tick vit ensuite dans `token_statuses`. Restent les 3 sous-systèmes neufs,
mais ils deviennent des **types de condition** (pas des branches de zone) : `drain de Souffle`,
`compétence substituée`, `poussé par un courant` = 3 nouveaux statuts à résoudre dans le tick
généralisé. Chacun un incrément, hors socle minimal.

### 7.2 L'état d'occupant (Q6.2) — étagère validée par la recherche

`[Post-recherche § 5.5.4]` : les pros logent l'état **sur la créature** (condition + compteur), pas
dans une table zone × occupant. → `token_statuses.data` (Tours de présence, malus accumulé, Souffle
courant, état de cascade) + `expires_at_turn`. Pas de table neuve. La cascade Souffle RAW reste une
mini-FSM à sérialiser dans `data`. Le seul suivi côté zone = `enter` / `exit` (déjà calculé par
`worldMovementService`).

### 7.3 ~~Hors combat~~ — **TRANCHÉ : hors scope** (Saar, 2026-09-09)

Les zones ne mordent qu'**en combat** (tick au Tour). Aucun VTT du marché n'automatise le
hors-combat (§5.5.7). Hors combat : au mieux un `enter` / `traverse` cosmétique, jamais de
résolution. Ferme Q6.5 et cette entrée.

### 7.4 « Qui est dans la zone » — allégé par le patron spawner

`[Post-recherche § 5.2 / 5.5.3]` : pour le **dégât continu**, seuls `enter` / `exit` comptent (la
condition posée fait le tick, pas la zone) — plus besoin d'une requête « qui est dedans » parfaite
chaque Tour. Restent à traiter proprement : le test **vertical** (tête sous l'eau — §4.2), la
**taille / empreinte** du token, les formes non-AABB (§4.7), les salles multi-niveaux — mais sur les
seuls événements de franchissement, pas en boucle par Tour. Le test vertical reste réel (world
builder 3D, §4.7) — pas la bande Z simplifiée de Foundry.

### 7.5 Timing dans le moteur de tour — non esquissé

Quand le tick de zone se déclenche-t-il exactement dans `combatTurnEngine` ? Avant / après la
résolution du mouvement ? Une zone posée ce Tour tick-t-elle ce Tour ou au suivant ? Interaction
avec la file `resolve_on_turn`, avec le report d'Initiative ≤ 0, avec la purge de fin de Tour
(`expires_at_turn <= newTurn`). C'est du vrai design dans le moteur de tour.

### 7.6 Interaction zone × zone — signalée 3×, jamais cadrée

`flooded` éteint `fire` (§4.1.4) ; gaz inflammable + feu = explosion ; deux zones `fire` se cumulent
comment. `effectMovementFactorsForSegment` a une règle `stacking` (max / multiply) pour le
**déplacement** seulement. Rien pour l'interaction des effets. Combinatoire à borner explicitement
(liste blanche de paires qui interagissent, tout le reste = indépendant).

### 7.7 Le déclaratif vs DSL (Q6.3) reste non résolu — et c'est un verrou

`normalizeHook` (shared) ne connaît que `note` / `test` / `damage` / `restriction`, 2-3 params
chacun. Le §4 = ~15 champs. Étendre `normalizeHook` = *là* que « cases à cocher vs langage » se
tranche concrètement, et c'est la porte de l'UI MJ sans code **et** du stockage (colonnes vs JSONB
validé).
**Post-recherche § 5.3 / 5.5.5** : direction retenue = **lignes d'effet typées** (patron *Active
Effects* de D&D 5e : `clé / mode / valeur`) **+ un catalogue de préréglages** (feu / acide / gaz
livrés en préréglages ; le MJ compose des lignes pour du custom). **Pas** de grammaire libre à la
Fantasy Grounds (`SAVEO:`…). Reste à écrire le vocabulaire exact des lignes — mais le principe est
cadré, ce n'est plus un verrou ouvert.

### 7.8 La preuve « feu » est probablement trop mince pour dérisquer l'archi

Le feu exerce : boucle de Tour, expiration, hook → `resolveTargetHit`, spawn depuis combat.
Il n'exerce **pas** : l'état d'occupant (7.2), les Tests, le spawn de statut persistant, le modèle de
volume, le hors-combat, l'interaction de zones. « Le feu marche » ne validerait presque rien pour le
reste. Envisager **feu + un gaz** comme preuve, pour toucher la FSM d'occupant.

### 7.9 Rendu joueur / UX de déclaration — absent

Comment un joueur sait-il qu'il entre dans une zone dangereuse ? La voit-il rendue (feu / eau oui,
gaz incolore non par choix MJ) ? Est-il averti à la phase d'annonce s'il déclare un mouvement à
travers ? `combat.md` : l'annonce ne refuse jamais — mais l'info doit remonter.

### 7.10 Réconciliation avec `PLAN_ENVIRONNEMENT_MILIEUX`

Le routage de compétence (sous-marin / 0G) : porté par la **zone** ou par le **milieu de la salle**
(l'autre plan) ? Une zone `flooded` dans une salle à atmosphère vs une salle nativement sous-marine
= comportements différents. Les deux plans se chevauchent sur « qu'est-ce qui rend un combat
sous-marin » et ne sont pas réconciliés.
**Post-recherche § 5.1 / 5.5.6** : PF2e-sur-Foundry met le **type d'environnement sur la région**,
avec **override par zone**. Direction : le milieu par défaut vit sur la salle (`PLAN_ENVIRONNEMENT_
MILIEUX`), une zone peut le **surcharger** localement. À acter à deux dans les deux docs.

### Conclusion de l'analyse

`[Révisée post-recherche 2026-09-09]` — la recherche a **retiré 3 des 10 points** (hors-combat
tranché hors scope ; déclaratif cadré ; état d'occupant = étagère `token_statuses` connue) et
**allégé 2 autres** (spawner ⟹ pas de dispatcher lourd ni de requête spatiale par Tour). Il reste
un chantier sérieux mais **plus un pont conditionnel** :

**v1 réaliste** (ambition resserrée, alignée marché) :
- zones **combat-only** ;
- patron **spawner** : la zone pose une condition `token_statuses` à l'`enter`, le tick hazard
  généralisé (aujourd'hui 3 codes en dur → registre) la résout, la condition porte sa sortie ;
- effets v1 : **dégât · statut · modificateur** (+ `dégât matériel` acide si Usure&Intégrité prêt) ;
- **Souffle / drain / routage de compétence / mouvement forcé = v2** (chacun = un type de condition
  en plus) ;
- géométrie : **vrai volume 3D** (Enclume est 3D avec étages) — forme(s) à trancher (§4.7) ;
  l'AABB actuel + le mode `compartment` (mur-conscient) sont déjà là comme base ;
- **pas** d'interaction zone × zone (MJ arbitre) ;
- preuve = **feu + un gaz simple** (pas le feu seul — §7.8).

**Restent vraiment ouverts** : le timing dans le moteur de tour (§7.5), le rendu joueur (§7.9),
l'audit Souffle (Q6.6), le vocabulaire exact des lignes d'effet.
L'éditeur de volume (§4.7) reste un sous-chantier indépendant.

## 8. Historique

- **2026-09-09** — Trouvaille pendant le chantier grenades 3-bis (`docs/JOURNAL8.md`,
  `PLAN_GRENADES.md` §6) : la mécanique « zones dangereuses » est un échafaudage. Cadrage ouvert
  (ce document). Périmètre réduit au noyau ; 0G / vide / escalade / pièges / eau montante sortis.
  RAW feu + acide + décompression + noyade + froid + radiations transcrits ; réfs pro Foundry v12 /
  PF2e relevées. Rien codé.
- **2026-09-09 (suite)** — 5 cas travaillés RAW en main (§4.1 feu · §4.2 inondation · §4.3
  vide/apesanteur · §4.4 acide · §4.5 terrain & pièges). §4 enrichi (rémanence 4 modes, drain de
  ressource, substitution de compétence, cible matériau, cachée-jusqu'à-détection, géométrie
  dynamique). Décisions Saar : formule feu en saisie libre ; nuage intégré (Q6.4 tranchée, §4.6) ;
  éditeur de volume MJ demandé (§4.7, sous-chantier UX indépendant). **Unification RAW forte** :
  immersion + vide + gaz partagent la colonne vertébrale Souffle. Hors combat **tranché hors scope**.
  **Analyse à charge (§7)** : 10 angles sous-planifiés — fondation multi-incréments, pas un pont.
- **2026-09-09 (recherche pro)** — Foundry v12 Scene Regions · PF2e Persistent Damage · Fantasy
  Grounds `SAVEO`/`AURA` · module « Danger Zone » (§5 réécrit). Retombées : patron **spawner**
  confirmé (la zone pose une condition, la créature la porte) ; état d'occupant = `token_statuses`
  (pas de table neuve) ; déclaratif = lignes typées + préréglages (pas de grammaire libre) ;
  milieu = propriété de région surchargeable. **Géométrie : Saar écarte le modèle 2D+élévation de
  Foundry — Enclume est 3D avec étages, on veut un vrai volume (forme ouverte, §4.7).**
  §7 révisée (3 points retirés, 2 allégés). v1 réaliste esquissée (§7 conclusion). Toujours rien codé.
- **2026-09-09 (correction géométrie)** — Saar **écarte** le modèle Foundry « 2D + élévation » : le
  world builder Enclume est 3D avec étages, la zone est un **vrai volume**. Le `world_effect_
  instances.volume` est d'ailleurs déjà un AABB 3D. §4.7 rouvert : forme(s) du volume non fixées
  (options listées : AABB, boîte orientée, sphère, cylindre, prisme, compartiments) + question
  « géométrie consciente des murs / sols ou aveugle » + multi-étages. §5.5.2 / §7 corrigés.
- **2026-09-09 (UX éditeur de forme)** — Proposition Saar : bouton dans une pièce → volume = la
  salle, arêtes glissables, double-clic = nouvelle arête, Valider / Annuler. Analyse UX (§4.7bis) :
  modèle = **empreinte extrudée (polygone 2D + hauteur)** ; « ajouter une arête » = poignée « + » au
  milieu d'arête (standard) ; `[VÉRIFIÉ]` aucun éditeur de sommets dans le client (tout est peint à
  la cellule) → nouveau paradigme d'interaction = le gros du sous-chantier. Phasage : v1 boîte +
  « copier la salle » ; v2 sculpteur de polygone (~60 %).
