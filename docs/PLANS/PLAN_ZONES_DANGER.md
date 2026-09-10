# PLAN_ZONES_DANGER.md — Fondation « zones dangereuses persistantes »

> Rédigé 2026-09-09 (Claude/Saar), révisé 2026-09-10. **Section faisant autorité : §10** (révision
> architecture après recherche approfondie). §1–§9 = cadrage et raisonnement, conservés ; §8 / §8bis /
> §9.Z0a sont **supplantés par §10**. Aucun code : reste §10.7 (validations Saar + plan Z0 détaillé +
> extraction de l'éditeur de volume).
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

**4 préréglages livrés (définitions builtin) + « Personnalisé »** (Saar A1, §4.10) :

| Préréglage | Formule / Tour | Localisations | Mode |
|---|---|---|---|
| `feu:braise` / `feu:petit` | `1D6` | 1 | `exposed` (le MJ désigne) |
| `feu:moyen` | `1D10` | 1 | `exposed` |
| `feu:grand` | `2D10` | `1D3` | `random` |
| `feu:brasier` | `3D10` | **toutes** (`all`) | — · **mort garantie en 1 Tour** (Saar B3) |

**Atténuation ignifugée (Saar B1/B2)** : colonne `ref_equipment.fireproof` (booléen, miroir de
`waterproof`, aucun seed) + ligne `note` « réduction RAW à arbitrer par le MJ ». Pas de réduction
automatique — le RAW ne liste aucun équipement ni aucun chiffre.

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
`Capsule acide` (catalogue) = `damage_h "1D10"` — seul point d'ancrage chiffré.

**Tranché (Saar, 2026-09-10)** :
- **C1** — pas d'échelle « puissance ». L'acide = **double champ MJ à la pose : dégât + durée**
  (`linger`). Préréglage `acide:capsule` (`1D10` / Tour, `1D6` Tours de persistance). Résolveur =
  celui du feu (A3).
- **C2** — v1 : **dégât au personnage seulement**. Le contrat porte `corrodes:[...]` +
  `cibleDeLEffet:'équipement'` **dès Z0** ; le résolveur `corrodeEquipment` (→
  `integrityService.adjustIntegrity`) = **v2**, quand l'intégration combat d'Usure (L5) est stable.

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

### 3.6 Radiations — `FATIGUE&DOMMAGES.md` §Irradiations (p.249-250) `[VÉRIFIÉ — texte complet déjà transcrit]`

- **Gain** selon la source : `1D6` (légères — fuites) · `2D6` (importantes — incident labo/centrale) ·
  `3D6` (massives — bombe / réacteur). Ajouté au **niveau d'irradiation** du personnage.
- **Seuils** 5 / 10 / 15 / 20 / 25 / 30 → pertes **temporaires** de CON (2 / 3 / 5 / 7 / 10 / 10) +
  Fatigue croissante ; à partir du seuil 20, aussi des pertes **permanentes** de CON ; **+1 point
  d'irradiation permanent à chaque seuil franchi** (jamais soignable).
- **Re-exposition** : « rester dans une zone irradiée fait re-subir les dégâts de base » — mais à
  intervalle **mensuel** (légères) / **hebdomadaire** (importantes) / **quotidien** (massives).
  **Aucun re-tick à l'échelle du Tour de combat.**
- Traitement : hôpital spécialisé uniquement, −1 niveau / 3 jours.

**Rôle d'une `zone:radiation` (tranché Saar 2026-09-10)** : ligne `accumulateLevel {track:'irradiation',
trigger:'enter', formula:'1d6'|'2d6'|'3d6'}` — gain **une fois à l'entrée**, rien par Tour. Le « niveau
→ effets » appartient à `PLAN_FATIGUE_DOMMAGES` (« Radiations Lot 9 », **non construit**). →
**définition dans le catalogue dès Z0, résolveur = v2** (bloqué sur Fatigue&Dommages Lot 9).

### 3.7 Gaz de combat — `[VÉRIFIÉ Livre de Base, Saar 2026-09-10]`

Les 6 descriptions de `PLAN_NUAGE.md` §3 (assommant · décomposant · irritant · neurotoxique ·
suffocant · vésicant) sont **fidèles au Livre de Base** — confirmé par Saar sur le texte source
(§Gaz p.309-310). **Le préambule §Gaz, lui, n'était pas capté** — il porte des mécaniques
structurantes :

- **Propagation = INSTANTANÉE.** « Les gaz se répandent **instantanément** dans la zone dans laquelle
  ils sont utilisés et y stagnent jusqu'à ce qu'ils soient dispersés. » → pas de m³/Tour progressif ;
  la zone se remplit d'un coup.
- **Dissipation = conditionnelle (vent), pas un timer.** « …jusqu'à ce qu'ils soient dispersés (par
  le vent, par exemple) ». → `durationPolicy: conditional`, pas `timerDés`.
- **Volume par vecteur** : capsule ≈ 10 m³ · grenade ≈ 30 m³ · obus ≈ 1 000 m³ — « indications
  approximatives, dépend de la concentration ».
- **Rémanence universelle** : « les victimes présentes sur les lieux… même si elles quittent la zone
  d'effet, sont **encore intoxiquées** ». → aucun gaz n'a `remanence: none`. Modes RAW observés :
  `decay` (irritant −1/Tour ; suffocant −1 tous les 2 Tours ; décomposant −1/Tour) ·
  `conditional` (vésicant : jusqu'à la solution neutralisante ; neurotoxique : jusqu'à MR ≥ 15 ou
  atropine + Test de Chance — **agit même hors zone**).
- **Immunité = protection parfaitement isolée et étanche seulement.** « Aucune armure, même
  naturelle, ne protège… sauf les protections parfaitement isolées et étanches. » Nuances par gaz :
  - vésicant : NBC / armure pressurisée = immunité ; **masque à gaz seul = dégâts à la peau
    uniquement** (poumons / yeux protégés) ;
  - neurotoxique : **seule** une tenue pressurisée ou NBC — **le masque à gaz ne suffit pas** ;
  - suffocant / irritant / assommant : masque à gaz **ou** NBC **ou** équipement isolé/pressurisé.
- **« Puissance du gaz »** = « concentration » ; « les dommages indiqués ne concernent que des
  concentrations normales ». C'est le curseur d'intensité — sa valeur reste une décision MJ
  (§10.8-D1).
- **« Retenir sa respiration »** : assommant → « réduire de moitié l'**intensité** » ; suffocant →
  « réduire de moitié les **effets** ». (§10.8-D3.)

**Effets par Tour, RAW verbatim :**

| Gaz | Effet / Tour de présence | Escalade | Rémanence en sortie |
|---|---|---|---|
| **vésicant** | `1D6` Dommages sur `1D3` Loc. ; ½ chances de réussite ; quasi-aveugle | +1 Dommage / Tour | `conditional` — jusqu'à solution neutralisante |
| **suffocant** | Test CON (malus = puissance) → échec : −1 CON (perte définitive sauf Test de Chance) ; ½ chances | — | `decay` −1 malus / 2 Tours |
| **irritant** | malus base **−3** ; Test CON → échec : malus supplémentaire cumulatif = modif. d'échec | via l'échec du Test | `decay` −1 / Tour |
| **neurotoxique** | Test CON → échec : −1 Résistance (**même hors zone**) ; mort sauf MR ≥ 15 / atropine + Chance | — | `conditional` — jusqu'à MR ≥ 15 ou atropine |
| **décomposant** | `1D6` Dommages / Tour ; blessures « comme le feu » | +2 Dommages / Tour | `decay` −1 / Tour |
| **assommant** | Test de résistance au Choc (malus = puissance) | +1 malus / Tour | *(RAW muet — `decay` par défaut)* |

→ **Le « gaz simple » de v1 (§10.8-D4)** = l'**irritant** : c'est le seul dont l'effet de base
(`modifier −3`) ne dépend **pas** d'un Test (le Test irritant n'ajoute qu'un *supplément*). Idéal
pour prouver `modifier` + `escalade` + `decay` sans le type `test`.

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

**Unification RAW — version corrigée (Saar A2, 2026-09-10)** : **pas** une seule mécanique. Le
**Souffle est un *timer de blocage respiratoire* commun** à l'immersion, au vide et aux gaz : on
retient sa respiration, on perd `−1` (immobile) à `−4`/Tour (combat), épuisé → cascade de Tests
d'Athlétisme → « commence à se noyer / s'asphyxier / subir l'effet du gaz ». **Mais chaque menace
garde son effet propre par Tour** — noyade (eau), asphyxie (vide), effet spécifique (les 6 gaz,
§3.7). « Retenir sa respiration » **consomme le Souffle** et **divise l'effet de la menace par 2**.
→ côté moteur : **un** sous-système `holdBreath` / Souffle + **N** effets de menace (résolveurs
distincts), pas un `drainResource` unique.

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
- **Géométrie** : volume fixe · compartiment(s) · forme AOE ·
  **mobile / dérivante** (nuage déplacé par le MJ ou par un vecteur de vent — §4.6) ·
  (plus tard) change de volume (eau qui monte). → « mobile » et « change de volume » = la même
  capacité *géométrie dynamique* sous deux angles, à mutualiser.
  **NB `[VÉRIFIÉ RAW §3.7]`** : le gaz se répand **instantanément** dans sa zone (pas de m³/Tour
  progressif) puis stagne jusqu'à dispersion par le vent — donc pas de mode « propagation lente »
  pour les gaz.
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

### 4.8 Schéma consolidé — synthèse des 5 cas (2026-09-09)

Les bullets de §4 accrétés sur 5 cas, remis en **schéma typé** (= « lignes d'effet typées + préréglages »
de §5.5.5). Extension de l'actuel `world_effect_definitions` (`key`/`label`/`category`/`stacking`/
`modifiers`/`hooks`) et `world_effect_instances` (`definitionKey`/`targetKind`/`volume`/`intensity`/
`duration_rounds`/`state`).

#### Définition de zone (réutilisable — builtin ou custom campagne)

```
{
  key, label, category, icon,
  effets: [ <ligne d'effet>, ... ],          // 0..N, une zone en cumule
  atténuations: [ <règle d'atténuation>, ... ],
  cycleDeVieParDéfaut: <cycle de vie>,
  visibilitéParDéfaut: 'affichée' | 'cachée' | 'cachée_jusqu_détection',
  chaînage: [ { engendre: <key>, délai, condition } ],   // ex. feu -> fumée si lieu clos
}
```

#### Ligne d'effet (le cœur — ~8 types, un `type` + params)

| `type` | Params | v1 ? | Cas |
|---|---|---|---|
| `dégât` | `formule` · `nbLoc` (nb\|dés) · `modeLoc` (exposée\|aléatoire\|forcée) · `locForcée` · `typeDégât` · `facteurArmure` | **v1** | feu, acide, décompression |
| `statut` | `statusCode` · `rémanence` (voir ci-dessous) | **v1** | brûlé, aveuglé, trempé |
| `modificateur` | `cible` (actions\|déplacement\|vision) · `valeur` | **v1** | terrain, gaz irritant −3 |
| `test` | `compétence`\|`attribut` · `difficulté` (val \| `depuisIntensité`) · `surÉchec`: `<ligne d'effet>` | v2 | gaz (Test CON/Tour) |
| `drainRessource` | `ressource` (`souffle`) · `tauxDepuis` (`activité`) · `àZéro`: `<cascade>` | v2 | submersion, vide, gaz retenu |
| `substitutionCompétence` | `remplace` · `par` · `plafonne`: [...] | v2 | sous-marin, 0G |
| `mouvementForcé` | `vecteur` · `magnitude` | v2 | courant |
| `perteCarac` | `carac` · `montant` · `définitiv-sur-échec-de-Chance` ? | v2 | gaz suffocant/neurotoxique |

Propriétés transverses d'une ligne :
- `déclencheur` : `entrée` (one-shot) · `présence_au_Tour` · `sortie` · `traversée`.
- `conditionGéométrique` : `toujours` · `seuilFranchi` (taille token vs profondeur — submersion)
  **+ règle de recouvrement** (§4.9) : `toutRecouvrement` (geyser, brûlure au frôlement) ·
  `centreDedans` (défaut) · `seuilVertical` (tête sous l'eau).
- `escalade` : `{ parTour: +X, plafond }` — réutilisable par `test` / `modificateur` / `statut`.
- `rémanence` (ce que devient l'effet à la sortie) : `rien` · `persistanceFixe {tours}` ·
  `décroissance {parX, tousLesN}` · `conditionnelle {condition d'arrêt nommée}`.
  → tout mode ≠ `rien` ⟹ **la zone pose un `token_status`** (patron spawner, §5.2).
- `cibleDeLEffet` : `personnage` · `équipement {matériau}` (route `char_inventory` / Intégrité) ·
  `géométrie`.

#### Règle d'atténuation

```
{ par: 'équipement' | 'trait' | 'comportement' | 'barrière',
  tag: 'masque_gaz' | 'branchies' | 'retenir_souffle' | ...,
  canal: 'gas' | 'water',                 // pour 'barrière'
  réduit: 'totale' | 'partielle',
  portéePartielle: ['peau'] }              // vésicant + masque = peau seulement
```

#### Cycle de vie (instance)

```
{ mode: 'permanent' | 'timerFixe {tours}' | 'timerDés {formule}' | 'conditionnel {aération}'
       | 'oneShot',
  extinctionAnticipée: <condition nommée> }   // MJ, immersion sur feu, neutralisant sur acide
```

#### Géométrie (instance)

```
{ mode: 'volume' | 'compartiment',
  forme: 'boîte' | 'prisme' | ... ,        // §4.7 non tranché
  volume: <AABB | polygone+z>,
  compartiments: [...],
  murConscient: bool,                       // §4.7 question 2
  animation: null | 'remplissage {axe, taux}'   // §4.9 — eau qui monte
          | 'dérive {vecteur}'                  // nuage mobile
          | 'propagation {canal}' }             // gaz de pièce en pièce
```

#### Ce que ça résout / expose

- **Résout §7.7** : le vocabulaire *est* fini (8 types de ligne + 4 blocs), pas une grammaire. La
  question « colonnes vs JSONB » : les `effets` / `atténuations` / `chaînage` vivent en JSONB validé
  (comme `hooks` aujourd'hui), l'extension de `normalizeHook` = valider ces 8 types.
- **v1 = 3 types de ligne** (`dégât` / `statut` / `modificateur`) + atténuation équipement + cycle de
  vie + visibilité affichée/cachée. Le reste (Souffle, compétence, courant, cascade de test) = v2,
  chacun = 1 type de ligne en plus, additif.
- **Préréglages** builtin : `fire` / `gas` / `acid` / `flooded` = des définitions à `effets`
  pré-remplis ; le MJ compose des lignes pour du custom.
- **Expose** : la « puissance du gaz » (§3.7) = probablement `difficulté: depuisIntensité` +
  `escalade` — à confirmer sur le RAW gaz.

### 4.9 Test du schéma §4.8 — 4 scénarios (Saar, 2026-09-09)

| Scénario | Le schéma colle ? | Détail |
|---|---|---|
| **Sol instable / couvert de déchets** | ✅ **cas dégénéré, colle bien** | 1 ligne `modificateur` (`cible: déplacement`) + 1 ligne `test` sur `traversée` (Équilibre) + option `modificateur` `cible: actions` (malus combat « terrain instable », RAW) + option `+1D10 Dommages de chute`. Cycle de vie `permanent`, aucun tick, aucun état d'occupant. La zone la plus légère — le schéma **dégrade proprement**. |
| **Salle qui s'emplit d'eau** (cale sèche, sas) | ⚠️ **effets OK, géométrie non** | Effets : `modificateur` (déplacement) + `test` (nage) + `conditionGéométrique: seuilFranchi` → `drainRessource` Souffle quand la tête passe sous l'eau (= §4.2 submersion, exactement le cas prévu). `mode: compartiment` + `murConscient` → l'eau s'arrête aux murs du sas. **Manque** : `géométrie.animation = remplissage {axe: Y, taux}` — le niveau qui monte le long de Y. `dérive` (nuage) est horizontal, pas ça. |
| **Geyser de flamme sur un tuyau** (fuite de gaz enflammé, ultra-localisé) | ✅ **colle**, expose une sous-question | `mode: volume`, `forme: cylindre` très fin, position fixe, `murConscient: false`. 1 ligne `dégât` (`déclencheur: traversée` **et** `présence_au_Tour`), formule feu moyen/grand. Cycle `conditionnel` (`extinctionAnticipée: fermer la vanne`). **Expose** : `conditionGéométrique` doit porter une **règle de recouvrement** — le jet fait 0,5 m, le token 1,5 m → « tout recouvrement = exposé » vs « centre dedans » vs « seuil vertical ». Pas binaire. |
| **Chambre froide** | ✅ **colle, mais quasi-inerte** par fidélité RAW | Le Froid RAW (§3.5) est à l'**échelle heure** (Test de Fatigue toutes les 2 h, dégâts après 1 h). En combat (échelle seconde) il ne mord presque pas. Une chambre froide = danger sur la **durée** = hors combat = **HORS SCOPE** (décision Saar). Le MJ narre. *Sauf* version « cryo-flash instantané » = piège `oneShot` (`dégât` type `froid` ou `statut: gelé`) — ça, ça colle. |

**Ce que ces 4 scénarios ajoutent au schéma :**

1. **`géométrie.animation`** = un axe manquant, ≥ 3 modes : `remplissage {axe}` (eau qui monte) ·
   `dérive {vecteur}` (nuage) · `propagation {canal}` (gaz de pièce en pièce). Tous « géométrie
   dynamique » v2 (déjà signalé §4.6). La salle qui s'emplit = `remplissage`.
2. **`conditionGéométrique` n'est pas binaire** — il faut une **règle de recouvrement** :
   `toutRecouvrement` (geyser, brûlure au frôlement) · `centreDedans` (défaut) · `seuilVertical`
   (tête sous l'eau — submersion). À ajouter à §4.8.
3. Le schéma **dégrade proprement** vers le cas trivial (terrain = `modificateur` seul, pas de tick).
   Bon signe.
4. **Le scope combat-only rend certains « lieux dangereux » classiques quasi-inertes** (chambre
   froide, suffocation lente) — par conception, fidèle au RAW, le MJ narre. À noter pour que ce ne
   soit pas relu comme un trou.
5. Le cycle de vie **`conditionnel` + condition d'arrêt nommée** est porteur : fermer la vanne
   (geyser), pomper / fermer le sas (eau), éteindre (feu), neutraliser (acide).

### 4.10 Principe d'interface MJ (Saar, 2026-09-10)

> **Le MJ a beaucoup de préparation par battlemap.** Créer la carte **et** ses conditions
> spécifiques doit être **rapide, peu de clics, peu de temps**. Concevoir pour les **90 %** (des
> préréglages tout prêts) + l'**exception** (un mode « Personnalisé » complet).

**Flux de pose d'une zone (vision Saar)** :
1. une fenêtre → un bouton par **catégorie** (feu · eau · acide · gaz · débris · …) ;
2. sélection d'un **préréglage** de la catégorie (feu : braise · petit feu · grand feu · brasier) ;
3. un bouton **« Personnalisé »** → fenêtre dédiée, tous les champs du contrat §4.8 ;
4. puis la **géométrie** (§4.7 — sous-chantier).

Poser une zone standard = **catégorie → préréglage → géométrie → fini** (~3 interactions).

**Conséquence pour le contrat** : un préréglage = une **définition builtin complète** (`formula` /
`locations` / `remanence` / `attenuations` pré-remplis d'après le RAW). « Personnalisé » = une
**définition custom** (`world_effect_definitions`). Le contrat porte déjà les deux (builtin vs
custom) — **le catalogue de préréglages fait partie de la livraison**, pas juste le moteur.

**Sur « le déclaratif ne doit pas devenir un langage »** (§4.8) : la fenêtre « Personnalisé » = un
bloc de formulaire par ligne d'effet (menu `type` → champs du type), `escalade` / `remanence` /
`attenuations` en sous-blocs repliés. Pas de texte libre sauf les libellés et la formule de dés.
Mais **90 % des MJ ne l'ouvriront jamais** — ils cliquent un préréglage.

**Catalogue de préréglages v1** (définitions builtin à livrer avec le noyau) :
`feu:braise` (1D6, Loc. exposée) · `feu:petit` (1D6) · `feu:grand` (2D10, 1D3 Loc.) · `feu:brasier`
(3D10, 1D3 Loc.) · `acide:faible` · `acide:fort` · `gaz:irritant` (le « gaz simple » de Z5) ·
*(fumigène / débris / eau peu profonde = selon avancement des types de ligne)*.

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
3. ~~Jusqu'où va le déclaratif~~ **Tranché — §4.8** : schéma consolidé, 8 types de ligne d'effet +
   4 blocs de définition, JSONB validé. Reste l'écriture fine du validateur (`normalizeHook` v2),
   pas une décision ouverte.
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

### 7.5 Timing dans le moteur de tour — **esquissé 2026-09-09** (`[VÉRIFIÉ` lecture `combatTurnEngine.js]`)

**Structure du Tour Polaris** (rappel — pas de tour par créature) : phase ANNONCE (déclarations
simultanées) → `startResolutionPhase` → `advanceTimeline` (marche unique dans l'échelle d'Initiative,
pas-à-pas ; steps autonomes possibles) → `endTurn` (wipe, `current_turn++`, purge universelle des
statuts `expires_at_turn <= newTurn`).

`startResolutionPhase` fait déjà, **avant la marche**, dans l'ordre : `buildTimelineEntries` → **tick
des mods** (`onTurnStart`) → **tick des dangers environnementaux** (`combat_roster ⋈ token_statuses
WHERE status_code IN hazardCodes` → `resolveEnvironmentalHazardTicks`) → broadcast → `advanceTimeline`.

**Design proposé (colle au patron spawner, §5.2) :**

1. **`startResolutionPhase` gagne un « balayage de présence »**, juste **avant** le tick hazard :
   pour chaque zone active, pour chaque token du roster **géométriquement dedans**, appliquer /
   rafraîchir (idempotent) la condition `token_status` correspondante. Puis le **tick hazard
   généralisé** (aujourd'hui 3 codes en dur → registre de zone) résout toutes les conditions, y
   compris celles qui viennent d'être posées. Ordre : balayage → tick. C'est le seul endroit où
   « qui est dans la zone » se calcule — **une fois par Tour**, roster × zones (§7.4 borné).
2. **Entrée en cours de résolution** (step de mouvement, `worldMovementService` émet `enter`) :
   - ligne `présence_au_Tour` → **poser la condition maintenant, résoudre au `startResolutionPhase`
     suivant** (tu entres ce Tour, tu encaisses le 1er tick au Tour d'après — RAW « mesuré en Tours »,
     cohérent avec la grenade et le `+1` de `turnsFromNow`) ;
   - ligne `entrée` / `traversée` **one-shot** (piège, geyser traversé) → **résoudre inline** pendant
     le step de mouvement.
3. **Zone posée ce Tour** (grenade incendiaire, pose MJ) → **tick au Tour suivant**. La grenade :
   l'explosion différée est **déjà un step autonome** à Tour+1 (`resolution_snapshot.autoResolve`) ;
   elle appellera `createWorldEffectInstance` ; le 1er tick de la zone = le `startResolutionPhase`
   d'après.
4. **Cycle de vie** : décrément de `duration_rounds` sur les zones actives dans **`endTurn`**, à côté
   de la purge universelle. À 0 → `state = 'expired'`, plus de condition posée, `WORLD_RUNTIME_
   UPDATED`. Les conditions déjà posées portent leur propre `expires_at_turn` → purgées par la purge
   universelle existante (donc `rémanence: rien` s'éteint tout seul ; `conditionnelle` persiste,
   nettoyée à part).
5. **File `resolve_on_turn` / report Ini ≤ 0 / échelle** : **aucune interaction** — le tick de zone
   est une opération **de masse pré-marche**, comme les ticks mods et hazard le sont déjà. Il ne crée
   **pas** d'entrée d'échelle. Seul lien : grenade→zone, où l'explosion (déjà une entrée autonome)
   crée l'instance.
6. **`endTurn` vs `startResolutionPhase`** : garder le tick à `startResolutionPhase`, **unifié avec le
   tick hazard existant** — ne pas scinder la logique. Un token tué en cours de résolution aura pris
   son tick de zone au début : RAW-neutre.

**Reste à vérifier** : réutiliser la machinerie `exposeToHazard` / `turnsFromNow` pour les conditions
posées par zone (hériter du `+1` de compensation de purge) ; le balayage de présence doit ignorer les
tokens `unconscious` / hors-combat comme le fait déjà le tick hazard.

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
Fantasy Grounds (`SAVEO:`…).
**Résolu (§4.8, 2026-09-09)** : schéma consolidé écrit — **8 types de ligne d'effet** (dégât · statut ·
modificateur · test · drainRessource · substitutionCompétence · mouvementForcé · perteCarac) + 4 blocs
de définition (atténuations · cycleDeVie · visibilité · chaînage). Vocabulaire fini, pas une grammaire.
Stockage : JSONB validé (comme `hooks`), l'extension de `normalizeHook` = valider ces 8 types.
Plus un verrou.

### 7.8 La preuve « feu » est probablement trop mince pour dérisquer l'archi

Le feu exerce : boucle de Tour, expiration, hook → `resolveTargetHit`, spawn depuis combat.
Il n'exerce **pas** : l'état d'occupant (7.2), les Tests, le spawn de statut persistant, le modèle de
volume, le hors-combat, l'interaction de zones. « Le feu marche » ne validerait presque rien pour le
reste. Envisager **feu + un gaz** comme preuve, pour toucher la FSM d'occupant.

### 7.9 Rendu joueur / UX de déclaration — cadré dans l'incrément Z6 (§8)

Un joueur doit **voir** la zone (rendue en volume translucide, couleur par catégorie ; une zone
`cachée` — gaz incolore — visible du MJ seul) et être **averti sans être bloqué** si son chemin
déclaré la traverse (`combat.md` : l'annonce ne refuse jamais). Le client a déjà `effectRegion`
(`Canvas3D.jsx`) + `worldRuntimeStore` + le brouillard `sightOpacity`. Manque : un mesh de volume par
instance active + l'avertissement de traversée à l'annonce. → **incrément Z6**.

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

**Restent vraiment ouverts** : ~~le timing dans le moteur de tour (§7.5)~~ **esquissé** (balayage de
présence + tick à `startResolutionPhase`, unifié avec le tick hazard) ; le rendu joueur (§7.9) ;
l'audit Souffle (Q6.6) ; les formes de volume (§4.7) ; interaction zone × zone (§7.6, différée).
L'éditeur de volume (§4.7) reste un sous-chantier indépendant.

## 8. Plan d'implémentation v1 (esquisse 2026-09-09)

**Périmètre v1** (§7 conclusion) : combat-only · patron spawner · lignes `dégât` / `statut` /
`modificateur` seulement · géométrie AABB `volume` + mode `compartiment` existants · pas
d'interaction zone × zone · preuve = **feu + un gaz simple**.

**Différé v2, explicitement hors v1** : lignes `test` / `drainRessource` (Souffle) /
`substitutionCompétence` / `mouvementForcé` / `perteCarac` · `géométrie.animation` (eau qui monte,
nuage qui dérive, propagation) · formes de volume non-AABB (§4.7, sous-chantier) · interaction
zone × zone · `cachée jusqu'à détection` (pièges) · routage du dégât matériel (acide → `char_inventory`,
sauf si Usure & Intégrité est prêt) · réconciliation `PLAN_ENVIRONNEMENT_MILIEUX`.

### Incréments (séquencés)

| # | But | Fichiers principaux | Migration | Preuve établie |
|---|---|---|---|---|
| **Z0** | Schéma de ligne d'effet + généralisation du registre hazard | `shared/world/worldEffects.js` (`normalizeHook` v2 : `dégât`/`statut`/`modificateur` + `déclencheur`/`rémanence`/`escalade`) ; `shared/` registre de zone (dérive `getAllHazardCodes` des définitions actives + les 3 legacy) ; `environmentalHazardService.js` (passe `armorReductionFactor` depuis `data`, applique `statut`) | non (JSONB) | non-régression `burning`/`acid` identiques ; tests purs `worldEffects.test.mjs` |
| **Z1** | Boucle de présence + cycle de vie au Tour | `combatTurnEngine.startResolutionPhase` (balayage présence avant le tick hazard) ; `combatTurnEngine.endTurn` (décrément `duration_rounds` → `expired`) ; `worldEffectService.sweepZonePresence` ; `worldSpatialQueryService.tokensInsideEffectVolume` (règle `centreDedans` v1) | non | **MJ pose une zone `fire` → un token dedans encaisse le dégât RAW chaque Tour** (test combat DB + session Saar) |
| **Z2** | Spawn depuis le combat — grenade incendiaire | `aoeMechanisms/grenade_incendiary.js` (sur `circleGrenade.js`) ; step autonome Tour+1 → `createWorldEffectInstance` ; `PLAN_GRENADES.md` | `ref_equipment` + `aoe_profile` (miroir 322/328) | **lancer incendiaire → zone de feu au Tour suivant → brûle les tokens dedans** (preuve noyau #1) |
| **Z3** | Ligne `statut` + `enter`/`exit` au mouvement + rémanence | `worldMovementService` (`enter` → pose condition différée ; `exit` → applique `rémanence`) ; `worldEffectService` | non | mouvement-à-travers pose un statut ; `rémanence: rien` s'efface à la sortie, `conditionnelle` persiste |
| **Z4** | Gaz simple (2ᵉ consommateur-preuve) | définition `gas` : ligne `modificateur` (`cible: actions`, −3) + `escalade` (+1/Tour) + `rémanence: décroissance` ; `aoeMechanisms/grenade_gas_irritant.js` | `ref_equipment` grenade gaz | **zone de gaz : malus qui monte en présence, décroît après la sortie** (preuve noyau #2 — exerce l'état d'occupant / escalade / décroissance). Écart RAW acté : le Test de Constitution du gaz irritant = v2 |
| **Z5** | UI MJ — définitions en lignes d'effet + pose / retrait + rendu | `SurfaceEditorPanel.jsx` (form `type` → champs) ; liste des instances actives + suppression ; `Canvas3D.jsx` (mesh de volume translucide par instance, couleur par catégorie, respect `visibilité`) ; i18n | non | le MJ compose + pose + voit + retire une zone custom |
| **Z6** | Joueur — avertissement de déclaration + rendu (§7.9) | client annonce : chemin déclaré traverse une zone visible → avertissement **non bloquant** ; zones `cachée` masquées aux joueurs | non | un joueur voit les zones et est prévenu s'il déclare une traversée |

**Noyau v1 = Z0 → Z4.** Z5 / Z6 = la couche UX MJ / joueur, peuvent suivre ou se paralléliser.
**⚠️ Découpage révisé par l'analyse à charge §8bis : 9 incréments Z0a→Z7, `modificateur` déplacé vers
`activeMalusRegistry` (pas le tick).** La table ci-dessous est conservée pour l'historique ; suivre
§8bis.

**Validation** (proportionnée, `AGENTS.md` clôture) : Z0 = `node --check` + tests purs ; Z1–Z4 =
combat + monde + migration → **scénario réel Saar** + build client à chaque incrément ; Z5–Z6 = build
client + validation visuelle Saar.

**Ordre vs autres chantiers** : Z2/Z4 réutilisent `circleGrenade.js` (chantier grenades GELÉ, reprend
là). L'éditeur de volume (§4.7) est un sous-chantier parallèle, non bloquant pour Z0–Z4.

## 8bis. Analyse à charge du plan §8 (2026-09-09)

Faite à la demande de Saar avant de passer au plan détaillé de Z0.

### Ce qui cloche

**1. Z0 confond « le schéma » et « la généralisation de la résolution ».**
- Le schéma (`normalizeHook` v2) vit dans `shared/`, importé client **et** serveur — se tromper de
  forme se propage partout. C'est un incrément à part.
- « Généraliser le registre hazard » = coupler `environmentalHazardService` (par token, par campagne)
  à `worldEffectService` (par battlemap), et **ajouter un 3ᵉ rôle** à `resolveEnvironmentalHazardTicks`
  alors que ses propres commentaires disent « deux registres séparés, jamais fusionnés ». → **le tick
  de zone ne doit pas entrer dans `resolveEnvironmentalHazardTicks`** : un `resolveZoneTick` **frère**
  dans `startResolutionPhase`, qui **réutilise** `resolveTargetHit` / `statusService`. Garder les 3
  codes hazard legacy tels quels.

**2. `[VÉRIFIÉ]` La ligne `modificateur` n'est PAS le même chemin que `dégât` / `statut`.**
Un malus passif « −3 à tous les Tests tant qu'on est dedans » se branche dans
`server/src/lib/activeMalusRegistry.js` — registre déclaratif, une entrée `compute(ctx)` par source,
lu à **chaque** résolution de Test. C'est le patron établi (Froid Lot 5, Maladies Lot 7, Drogues Lot
8). Une zone `modificateur` = **une nouvelle entrée `ACTIVE_MALUS_SOURCES`**, pas le tick. Le plan
§8 les regroupe à tort en « v1, même chemin ».

**3. La preuve de Z1 est en l'air.** « MJ pose une zone `fire` » — via quoi ? L'UI de pose en session
est Z5. La vraie preuve utilisateur bout-en-bout = **Z2** (la grenade pose la zone). Z1 se prouve par
un **insert manuel / seam de debug**. À restater.

**4. `rémanence` minimale nécessaire dès Z1.** Z1 pose des conditions ; sans le mode `rien` (efface à
la sortie) il **pose sans jamais retirer proprement**. Le `rien` + `conditionnelle` vont en Z1 ; les
modes `décroissance` / `persistanceFixe` en Z4.

**5. Z4 est sous-dimensionné.** L'escalade (+1/Tour) et la décroissance = **écriture mutable dans
`token_statuses.data` à chaque tick**, que le tick hazard ne fait pas aujourd'hui (il lit, jette,
résout). C'est la « mini-FSM d'occupant » de §7.2. Z4 ≈ 2 incréments (l'accumulateur + l'entrée
`activeMalusRegistry` qui lit la valeur).

**6. `chaînage` (feu → fumée) n'est dans aucun incrément** ni dans la liste v2. → l'ajouter en v2
différé, explicitement.

**7. Limites v1 à écrire noir sur blanc :**
- règle de recouvrement `centreDedans` seule ⟹ **le geyser de Saar (§4.9) ne marche pas en v1**
  (il lui faut `toutRecouvrement`) ;
- AABB non mur/sol-conscient ⟹ une zone plus haute qu'un étage **déborde** au-dessus/dessous. Le MJ
  doit dimensionner à un étage.

**8. Z2 / Z5-gaz dé-gèlent le chantier grenades** (`circleGrenade.js`, GELÉ 2026-09-09). C'est *la*
manière prévue qu'il reprenne — mais mettre à jour `PLAN_GRENADES.md` §6 quand Z2 démarre.

**9. Back-compat du builtin `fire`.** Les `world_effect_instances` existantes (Saar, Kiwi) pointent
sur l'ancien `fire` (`amountPerIntensity: 1`, pas la formule RAW). Passer `fire` au nouveau schéma =
changement de comportement — migration / valeur par défaut à définir dans Z0a.

**10. Rythme réel.** Z1→Z5 = à chaque fois code → **session Saar réelle** → retour. ~5 rondes gatées.
Le plan se lit plus compact qu'il ne se vivra. Pas un défaut — un attendu à poser.

### Découpage révisé

| # | But | Intégration |
|---|---|---|
| **Z0** *(ex-Z0a+Z0b, fusionnés — cf. §9.Z0a analyse à charge)* | Schéma `shared/world/worldEffects.js` : `normalizeHook` v2 (`dégât` enrichi + `statut` ; `rémanence {rien\|conditionnelle}` ; **pas** `modifier` — reporté en Z3) **+** `resolveZoneTick` **frère** du tick hazard dans `startResolutionPhase` (réutilise `resolveTargetHit` / `statusService`) + `worldSpatialQueryService.tokensInsideEffectVolume` (`centreDedans`) | pur `shared/` + serveur, **pas** de fusion avec `resolveEnvironmentalHazardTicks`, aucune migration, tests unitaires |
| **Z1** | Balayage de présence + cycle de vie : `startResolutionPhase` (balayage → `resolveZoneTick`) ; `endTurn` (`duration_rounds` → `expired`) ; `rémanence: rien` à l'`exit`. **Preuve : insert manuel zone `fire` → brûle + s'éteint en sortant** | serveur |
| **Z2** | Grenade incendiaire — spawn réel depuis le combat, sur `circleGrenade.js`. **Preuve utilisateur #1.** Dé-gèle le chantier grenades | serveur + migration `ref_equipment` |
| **Z3** | Ligne `modificateur` — **ajout du type `modifier` à `normalizeHook`** (reporté de Z0) + nouvelle entrée `ACTIVE_MALUS_SOURCES` alimentée par une zone/condition | `shared/` + serveur, `activeMalusRegistry.js` |
| **Z4** | Escalade + décroissance — accumulateur mutable dans `token_statuses.data` au tick + `rémanence: décroissance` (la mini-FSM) | serveur |
| **Z5** | Gaz simple = Z3 + Z4 assemblés (`modificateur −3` + escalade + décroissance). **Preuve utilisateur #2.** Test CON du gaz = v2 | serveur + migration |
| **Z6** | UI MJ — form lignes d'effet + pose/retrait + rendu mesh translucide | client |
| **Z7** | Joueur — avertissement de traversée à la déclaration + rendu des zones cachées | client |

**Noyau v1 = Z0a → Z5.** Verdict : le plan **tient**, mais §8 sous-découpe (7 → 9 incréments) et
place mal `modificateur`. Pas de « ne pas faire » — le cadrage reste solide, l'ambition v1 reste
justifiée.

## 9. Plans détaillés par incrément

### 9.Z0a — Schéma de ligne d'effet (`shared/world/worldEffects.js`)

> Plan présenté 2026-09-09. **Pur `shared/`, zéro migration, zéro serveur, zéro client.** Aucun effet
> jeu observable (Z0a ne branche rien — la résolution est Z0b / Z3).

**Objectif** : étendre le vocabulaire déclaratif des `hooks` pour porter les lignes d'effet `dégât`
(enrichie) et `statut` (neuve), + `modifier` comme **descripteur** (résolu en Z3 via
`activeMalusRegistry`, pas ici), sans casser l'existant.

**Fichier unique : `shared/world/worldEffects.js`**

1. `HOOK_TYPES` → `+ 'status'` `+ 'modifier'` (les 4 actuels restent).
2. `normalizeHook`, par type :
   - **`damage`** (enrichi, rétro-compatible) :
     - `formula` : `string | null` (forme dés regex ; validation fine = serveur ; `null` ⟹ l'instance
       fournit via `metadata.formula`) ;
     - `locations` : `number` (clamp 1–20) **ou** `string` dés — défaut `1` ;
     - `locationMode` : `'exposed' | 'random'` — défaut `'random'` ;
     - `forcedLocation` : `string | null` (clé `LOCATION_TO_SLOT`, validée serveur) ;
     - `armorFactor` : clamp 0–1, défaut `1` ;
     - `amountPerIntensity` : **conservé** (clamp 0–1000), déprécié — filet legacy `fire` ;
     - `damageType` : inchangé.
   - **`status`** (neuf) : `statusCode` (slug, obligatoire) · `remanence` ∈ `'none' | 'conditional'`
     (v1 ; `decay` / `fixed` **rejetés** en Z0a, ajoutés Z4) · `remanenceCondition` (libellé ≤ 128).
   - **`modifier`** (neuf, descripteur seul) : `modifierTarget: 'actions'` (v1) · `value` clamp
     −20…0. **Consommé par rien en Z0a.**
   - `note` / `test` / `restriction` : **inchangés**.
3. `HOOK_EVENTS` : **inchangé**. Mapping §4.8 : `entrée`→`enter` · `présence_au_Tour`→`turnStart` ·
   `sortie`→`exit` · `traversée`→`traverse`.
4. `BUILTIN_DEFINITIONS.fire` : hook `damage` →
   `{ event:'turnStart', type:'damage', damageType:'fire', formula:null, locations:1, locationMode:'exposed', amountPerIntensity:1 }`.
   `amountPerIntensity:1` gardé = filet : une instance `fire` existante sans `metadata.formula`
   continue à 1×intensité au lieu de planter. `gas` / `flooded` / `oil` / `unstable` : inchangés.
5. `normalizeEffectDefinition` : inchangé (mappe déjà `hooks.map(normalizeHook)`).
6. `compileEffectRegions` / `collect*` : **inchangés** — filtrent par `event`, agnostiques du `type`.
   Vérifier qu'aucun ne présuppose les 4 types actuels.

**Invariants** : « une définition custom n'exécute jamais de code » (les 2 types neufs = descripteurs
validés) · `shared/` pur (aucune importation serveur) · rétro-compat (tout hook ancienne forme reste
valide).

**Hors-périmètre Z0a** : la résolution (Z0b `resolveZoneTick` + Z3 `activeMalusRegistry`) ·
`remanence: decay|fixed`, `escalation` (Z4) · les blocs `géométrie` / `atténuations` / `cycleDeVie` /
`chaînage` de §4.8 · toute migration (JSONB déjà) · client / UI.

**Tests (`shared/world/worldEffects.test.mjs`)** : hook `status` valide / `statusCode` absent rejeté /
`remanence:'decay'` rejeté · hook `modifier` valide / `value` > 0 → 0 · `damage` ancienne forme
acceptée · `damage` nouvelle forme acceptée · `BUILTIN_WORLD_EFFECTS.fire` forme enrichie ·
non-régression des tests existants.

**Validation** : `node --check` + `node --test 'shared/**/*.test.mjs'`. Pas de session Saar.

### 9.Z0a — Analyse à charge (2026-09-10) → **le plan devient « Z0 » (fusion Z0a + Z0b)**

1. **`modifier` sort de Z0a.** Schéma mort (rien ne le consomme avant Z3). Z0a ne porte que
   `damage` enrichi + `status`. Le type `modifier` sera ajouté **avec** Z3 (`activeMalusRegistry`),
   où son consommateur existe et où son ncommage se tranche.
2. **Fusion Z0a + Z0b → un seul incrément « Z0 ».** Un schéma sans consommateur peut churner ; le
   prouver immédiatement par `resolveZoneTick` évite un tour à vide. Z0 finit sur un **résolveur
   testable unitairement** (toujours pas de session Saar — c'est Z1).
3. **`[VÉRIFIÉ DB locale]` `world_effect_definitions` = 0 ligne, `world_effect_instances` = 0 ligne.**
   Aucune rétro-compat de données stockées. `amountPerIntensity` reste **accepté** (validation du
   builtin + toute entrée ancienne forme) mais **sans prétention de repli fonctionnel** : `resolveZoneTick`
   **exige** une `formula` (hook ou instance) ; une instance `fire` sans formule = **mal configurée →
   loggée + sautée**, jamais un silencieux 1×intensité.
4. **Formule de dés** : regex dans `shared/`, mais la validation **autoritaire** (`parseDice` /
   `isValidDiceFormula`) tourne à la **création** de la définition / de l'instance côté serveur —
   **jamais différée au tick** (même discipline que `exposeToHazard`, `environmentalHazardService.js`).
5. **Champs du hook = valeurs par défaut ; le `metadata` de l'instance surcharge.** À acter pour que
   la résolution Z0 soit sans ambiguïté (miroir du `data.formula` par instance actuel).
6. **`remanence: 'conditional'` en v1** = le statut **persiste à la sortie + le MJ le retire à la
   main**. `remanenceCondition` = **libellé d'affichage seul** en v1. Les conditions d'arrêt
   automatiques (submersion éteint le feu, neutralisant, medkit) = v2.
7. **`[VÉRIFIÉ code]` `worldEffectService.serializeDefinition` / `definitionFromRow` = pass-through
   pour `hooks`** → **aucun changement serveur pour le schéma**. Le seul ajout serveur de Z0 est
   `resolveZoneTick`.

**Verdict** : plan sain. Resserré à `damage` + `status`, Z0a et Z0b fusionnés. Pas de « ne pas faire ».

## 10. Révision architecture — recherche approfondie (2026-09-10)

> Demande de Saar : prise de recul, on est allé trop vite. Mandat : qualité structurelle >>>
> vitesse, aggradation de l'architecture, se documenter / s'inspirer des pros, ne jamais coder de
> zéro, s'assurer que l'archi est **pérenne** (robuste) **et adaptative**.
>
> **Cette section prime sur §8 / §8bis / §9.Z0a** (conservés pour l'historique du raisonnement).

### 10.1 Recherche — comment les pros modélisent un système d'effets généraliste et adaptatif

| Source | Ce qu'on en retient |
|---|---|
| **Unreal Gameplay Ability System — `GameplayEffect`** (`dev.epicgames.com/documentation/.../gameplay-effects-...`) | Effet = **asset data-only**. 3 politiques de durée : `instant` / `durational` / `infinite`. **Périodique** = tique à chaque `period` (à la fois « Added » et « Executed »). Modifiers `Add`/`Multiply`/`Override` sur un attribut nommé. **`ExecutionCalculation`** = échappatoire pour les calculs qu'un modifier ne couvre pas — **un type d'exécution enregistré, pas du script libre**. **Depuis UE 5.3 : `GameplayEffectComponents`** — l'effet est un **sac de composants enfichables**, chacun enregistre des callbacks, **aucun switch central**. On ajoute un comportement en ajoutant un composant. |
| **Unity GAS (sjai013, open-source documenté)** (`github.com/sjai013/unity-gameplay-ability-system`) | Même modèle en plus lisible : `GameplayEffect` ScriptableObject + `Modifier {attribut, opérateur, magnitude}` + **GameplayTags hiérarchiques** à 3 usages : *Application Requirements* (l'effet peut-il s'appliquer), *Ongoing Requirements* (suspendu ou actif), *Removal Requirements* (retrait anticipé). Extension = sous-classe `AbstractAbilityScriptableObject` (data) + `AbstractAbilitySpec` (exécution). |
| **« A Framework for Status Effects » (Stray Pixels)** + **« RPG Status Effect and Cooldown Architecture »** | **Flyweight** : définition statique immuable (durée, tick rate, stacking, icône) **vs** instance runtime légère (réf. définition, durée restante, stacks, source). **Tick centralisé** (une boucle, pas N boucles). **Événementiel** : le manager émet `OnApplied` / `OnTicked` / `OnRemoved`, l'UI/audio/vfx s'abonnent — l'effet **ne touche jamais la présentation**. Bitmask par catégorie pour les requêtes O(1) (« peut-il agir ? »). |
| **Caves of Qud** (ECS « parts » + effets XML moddables) | Effet porte un **type en bit-vector** (`Poison`, `Fire`, `Mental`…) utilisé pour l'immunité et les cure-all. Tout est reconfigurable **au niveau du blueprint XML, sans script**. |
| **Divinity: Original Sin 2 — surfaces / nuages** (le maître-étalon des « zones adaptatives qui interagissent ») | Surfaces (sol) + nuages (air), chacun un **type**. Interactions = **règles data** (« feu + huile → plus de feu », « eau + électricité → électrifié », « feu maudit évapore l'eau »). **Pas une matrice N×N codée en dur** — une liste de règles clés par (type, type). `blessed` / `cursed` = un **état modificateur orthogonal** posé par-dessus le type de surface. |

### 10.2 Constat : la maison a déjà le patron

`activeMalusRegistry.js` (son en-tête le dit mot pour mot), `weaponModRegistry` + `resolveModHooks`
(`RESOLVERS[hookName]` + `applicableHandlers`, `[VÉRIFIÉ code]`), `echeanceTypeRegistry`,
`environmentalHazardRegistry` : **le projet applique déjà partout le patron « registre déclaratif +
dispatcher générique, jamais un switch central qui grossit »**. C'est *exactement* le modèle
`GameplayEffectComponents` d'UE 5.3. L'architecture adaptative que Saar veut **est le style maison** —
il faut juste l'appliquer aux lignes d'effet de zone, et **y refondre `environmentalHazardService`**
au lieu de bricoler une 2ᵉ boucle à côté.

### 10.3 Architecture recommandée

**(A) Un registre unique `effectLineResolverRegistry`** (`shared/` = contrat + validation ;
serveur = résolveurs). Une entrée par `type` de ligne d'effet :

```
{ type: 'damage' | 'status' | 'modifier' | 'test' | 'drainResource' | 'skillOverride'
       | 'forcedMove' | 'statLoss' | ... ,
  phase: 'onEnter' | 'onExit' | 'onTraverse' | 'onTurn',   // quand le résolveur tourne
  validateParams(params),                                   // shared, pur
  resolve(ctx) }                                            // serveur — réutilise resolveTargetHit /
                                                            //   gmArbitratedTestService / statusService / …
```

`resolveActiveEffects` (une passe, dans `startResolutionPhase`) **dispatche via ce registre**.
- **v1 enregistre `damage` + `status`.** Les autres types **valident** (le contrat est complet — Saar :
  « prévoir la suite ») mais **n'ont pas de résolveur** → log « type non résolu (v2) », no-op.
- **v2 = ajouter une entrée au registre.** Zéro changement du dispatcher, du schéma stocké, de la
  boucle de Tour. C'est ça, « adaptatif ».

**(B) `environmentalHazardService` est refondu dans ce registre.** `burning` / `acid` /
`decompression` deviennent des **définitions d'effet** (une ligne `damage`, `forcedLocation` pour la
décompression). Le tick hazard actuel disparaît au profit de `resolveActiveEffects`. **Deux
alimentateurs, une résolution** :
- exposition MJ à la main sur un token (l'actuel `exposeToHazard`) → pose une instance `targetKind:'token'` ;
- balayage de présence d'une zone → pose des conditions sur les occupants.
→ **l'autorité unique de l'invariant 2 est enfin respectée** (aujourd'hui `resolveEnvironmentalHazardTicks`
est déjà un mini-moteur ; on ne veut pas d'un 2ᵉ, on veut *le* moteur).

**(C) Flyweight explicite.** Définition (`world_effect_definitions`) = immuable : `tags` (Set —
`hazard:fire`, `atmosphere:gas`…), `durationPolicy`, `stackingPolicy`, lignes d'effet ordonnées,
`attenuations`, `chaining`. Instance (`world_effect_instances`) = géométrie + intensité + overrides.
Runtime par occupant = `token_statuses` (durée restante, stacks, malus accumulé, état de cascade).

**(D) Interaction & immunité par *tags*, jamais par matrice** (patron DOS2 + GAS) :
- `attenuations: [{ by:'equipmentTag'|'trait'|'behavior', tag, effect:'immune'|'halve'|'partial', scopeTags:[...] }]`
  — une tenue NBC = `immune` à `atmosphere:*` ;
- `zoneInteractionRules: [{ whenTag, meetsTag, action:'remove'|'convert'|'amplify', toKey? }]`
  — v1 en livre 0 ou 1 (`terrain:water` retire `hazard:fire`), **la forme existe** ;
- `blessed`/`cursed` de DOS2 = validation externe de notre idée « intensité / état modificateur
  orthogonal » — à garder en tête, pas en v1.

**(E) Découplage présentation** : les résolveurs émettent des événements (`COMBAT_ATTACK_RESULT`,
`WORLD_RUNTIME_UPDATED`, une notice système) — **jamais de rendu ni de texte FR figé** (déjà la
règle, `i18n.md` / `core.md`).

**(F) Tick centralisé** dans `startResolutionPhase` (§7.5 inchangé sur ce point), purge dans
`endTurn`. Échelle table → pas de min-heap, une simple requête.

**(G) `shared/world/dangerCatalog.js` — la « bible » RAW (proposition Saar, 2026-09-10).**
Un module de référence unique, patron `polarisUtils.js` / `armorConstants.js` / `fatigueConstants.js` :
**TOUTES les définitions de danger builtin** (4 préréglages feu, `acide:capsule`, **les 6 gaz**,
`zone:radiation`, décompression, terrain…), chacune = le contrat §10.3(C) instancié, **avec la
citation RAW en commentaire** au-dessus de chaque chiffre.
- **Le catalogue est complet dès Z0. La *résolution* est incrémentale** (décision Saar D4) : une
  définition dont une ligne utilise un type sans résolveur v1 (`test`, `statLoss`, `accumulateLevel`,
  `corrodeEquipment`) **existe quand même** — cette ligne no-ope + log jusqu'à v2. Un MJ peut poser
  une zone `gaz:vésicant` en v1 : la ligne `damage` s'applique, le reste attend.
- **Source de vérité unique.** Les lignes `ref_equipment` (grenades / capsules) ne portent **plus
  aucune mécanique** — juste `aoe_profile` (volume) + une **clé** de catalogue.
- `world_effect_definitions` (DB) = **uniquement** les définitions **custom** MJ. Les builtins sont
  du code, versionnés, testés, sourcés.
- Répond à « les effets sont-ils clairs à coder ? » : **un seul fichier** où tout est spécifié,
  chiffré, sourcé.
- Le nettoyage `ref_equipment` = **supprimer** les valeurs corrompues (§10.8-C3), pas les migrer.

**(H) Facteur de puissance — patron « SetByCaller Magnitude » (UE GAS), décision Saar D1.**
Un scalaire **`puissance`** sur l'instance = « ce danger est-il fort ? », curseur unique que le MJ
comprend, **appliqué à toutes les familles** :
- **gaz / acide** : le RAW le *demande* (« malus / dégât **dépendant de la puissance** ») ;
- **feu** : réglage fin **optionnel** par-dessus un préréglage (défaut neutre — le préréglage EST
  l'intensité) ;
- **radiations** : `puissance` = le choix `1D6` / `2D6` / `3D6`.
Chaque **résolveur** décide comment `puissance` s'applique à sa ligne (un `damage` : `+ puissance`
au jet ou `× puissance` ; un `test` : `difficulté − puissance` ; un `modifier` : `value − puissance`).
**À concevoir en détail** : réutiliser `world_effect_instances.intensity` (multiplicatif, défaut 1,
sert déjà `movementMultiplier` / `sightOpacity`) **vs** ajouter `puissance` (additif, défaut 0) —
tranche : `intensity` reste le curseur **géométrie/ambiance**, `puissance` (neuf, défaut 0) est le
curseur **magnitude d'effet**. Deux axes distincts, pas de collision.

**(I) `ref_equipment.protections` JSONB — décision Saar D6.** Remplace la prolifération de colonnes
booléennes (`waterproof`, + `fireproof`, `gas_mask`, `nbc_suit`, `pressurized`…) par **un champ
structuré** :
```
protections: {
  'terrain:water':   { degree: 'full' },
  'atmosphere:gas':  { degree: 'partial', scope: ['peau'], except: ['neurotoxique'] },  // masque à gaz
  'hazard:fire':     { degree: 'partial' },                                             // ignifugé
}
```
Les `attenuations` du catalogue référencent ces clés (= les `tags` de catégorie de danger).
**Rework assumé** (priorités Saar) : `waterproof` (colonne existante — outil admin, seed
`equipmentMapping.js`, `inventoryService`, `diff_equip.mjs`) se replie dedans (migration
`waterproof:true → protections:{'terrain:water':{degree:'full'}}`, puis retrait de la colonne).
→ **incrément dédié**, séquencé tôt (avec ou juste après Z1).

### 10.4 Ce que ça change vs §8 / §8bis

- **§8bis « `resolveZoneTick` frère » → abandonné.** Remplacé par (B) : **refonte** de
  `environmentalHazardService` en `resolveActiveEffects` + registre. C'est plus de travail, c'est
  l'aggradation que Saar demande explicitement.
- **§9.Z0a `normalizeHook` v2 → élargi** : le contrat porte **tous** les types de ligne (validation),
  pas seulement `damage` + `status`. Seule la *résolution* est incrémentale.
- **§4.8 confirmé** comme le contrat — c'est la bonne intuition, la recherche la valide (GAS
  Modifiers + Executions + Tags = nos lignes typées + le registre).

### 10.5 Plan d'implémentation révisé (contre le contrat complet)

| # | But | Nature |
|---|---|---|
| **Z0 — Contrat + bible** | `shared/world/worldEffects.js` : schéma de ligne d'effet **complet** (tous les types validés : `damage` · `status` · `modifier` · `note` · `test` · `statLoss` · `chance` · `drainResource` · `skillOverride` · `forcedMove` · `accumulateLevel` · `corrodeEquipment` · `chain` ; `phase`, `params` typés) + `tags` / `durationPolicy` / `stackingPolicy` / `puissance` (§10.3-H) / `corrodes` / `attenuations` / `chaining` sur la définition. **`shared/world/dangerCatalog.js`** : **toutes** les définitions builtin, complètes et sourcées RAW (4 préréglages feu · `acide:capsule` · **les 6 gaz** · `zone:radiation` × 3 · `décompression` · terrain). Tests purs. | `shared/`, aucune migration |
| **Z1 — Registre + refonte hazard + nettoyage `ref_equipment`** | `effectLineResolverRegistry` (dispatcher générique, patron `resolveModHooks`) ; `resolveActiveEffects` ; **`environmentalHazardService` refondu** : `burning`/`acid`/`decompression` → définitions du catalogue ; non-régression stricte (tests existants + session Saar). Résolveurs `damage` + `status` + `note`. `ref_equipment` : **supprime les 6 valeurs corrompues** (§10.8-C3), ajoute un lien vers la clé de catalogue. | serveur, **rework**, migration |
| **Z1b — `ref_equipment.protections` JSONB** | §10.3-I : champ `protections` structuré ; `waterproof` s'y replie (migration + retrait de colonne) ; outil admin / `equipmentMapping.js` / `inventoryService` / `diff_equip.mjs` adaptés ; le résolveur `attenuation` lit `protections`. | serveur + client (outil admin), **rework**, migration |
| **Z2 — Présence + cycle de vie + `puissance`** | balayage roster × zones dans `startResolutionPhase` → `resolveActiveEffects` ; `duration_rounds` / `durationPolicy` dans `endTurn` ; `worldSpatialQueryService.tokensInsideEffectVolume` (`centreDedans` v1) ; `rémanence:none` à l'`exit` ; le scalaire `puissance` (nouveau champ instance) branché dans les résolveurs. **Preuve : insert manuel zone `fire` → brûle + s'éteint en sortant.** | serveur, migration (colonne `puissance`) |
| **Z3 — Grenade incendiaire** | `aoeMechanisms/grenade_incendiary.js` sur `circleGrenade.js` ; explosion Tour+1 → `createWorldEffectInstance`. **Preuve utilisateur #1.** Dé-gèle le chantier grenades. | serveur + migration `ref_equipment` |
| **Z4 — `modifier` + escalade + décroissance** | résolveur `modifier` (entrée `ACTIVE_MALUS_SOURCES` alimentée par les zones) ; `stackingPolicy` + accumulateur mutable dans `token_statuses.data` ; `rémanence:decay`. | serveur |
| **Z5 — Gaz (preuve #2)** | `gaz:irritant` (`modifier −3` + `decay`) **et** `gaz:décomposant` (`damage 1D6` + `escalade +2` + `decay`) — les 2 entièrement RAW en v1 ; atténuation `behavior` « retenir sa respiration » = ½ ; `aoeMechanisms/grenade_gas_*.js`. **Preuve utilisateur #2.** | serveur + migration |
| **Z6 — UI MJ** · **Z7 — Joueur** | inchangés vs §8bis (fenêtre catégorie → préréglage → « Personnalisé » (§4.10) + rendu mesh ; avertissement de traversée à la déclaration). | client |

**Noyau v1 = Z0 → Z5.** **Le catalogue est complet dès Z0** ; ce qui est différé = **les résolveurs**
(chacun = 1 entrée de registre en plus, contrat déjà en place) : `test` (Test CON des gaz),
`statLoss` (suffocant / neurotoxique), `chance` (Test de Chance), `drainResource` (Souffle + cascade
Athlétisme), `skillOverride` (sous-marin / 0G), `forcedMove` (courant), `accumulateLevel` (radiations
→ Fatigue&Dommages Lot 9), `corrodeEquipment` (acide → Usure L5), `chain` (feu → fumée),
`géométrie.animation` (eau qui monte, nuage qui dérive), `zoneInteractionRules` étendues, pièges.

### 10.6 Ce qui sort de ce document

- **L'éditeur de volume MJ** (§4.7 / 4.7bis) → doc dédié `PLAN_ZONES_DANGER_EDITEUR.md` à créer. Le
  **contrat géométrie** (`world_effect_instances.volume` / `compartiment` / formes / `animation`)
  reste ici ; le **build UI + interaction** part. RegleDocumentaire R1 (une responsabilité par doc).
- **Validation des lectures RAW** (§3 + unification Souffle) par Saar — **prérequis** avant de figer
  la moindre mécanique de jeu (`AGENTS.md` clôture : une règle de jeu exige une validation Saar).

### 10.7 Package de reprise — reste à produire (aucun code dans cette conversation)

**Objectif de la conversation de cadrage : l'agent qui reprend a tout pour bien travailler.**

1. **§10.8 — Décisions requises de Saar** ✅ *(rédigé — voir ci-dessous ; Saar tranche au fil de l'eau)*.
2. **§10.9 — Exemple travaillé** : la définition `grenade incendiaire` remplie contre le contrat
   §10 (prouve aussi que le contrat est saisissable en formulaire).
3. **§10.10 — Prérequis données** : nettoyage `ref_equipment` (lignes acide + gaz malformées) scopé.
4. **§10.11 — Plans détaillés Z0 et Z1** (Z1 = refonte `environmentalHazardService`, l'incrément le
   plus risqué).
5. **`PLAN_ZONES_DANGER_EDITEUR.md`** : extraction §4.7 (éditeur de volume MJ).

### 10.8 Décisions requises de Saar

Chaque point : le trou, puis **[DÉFAUT PROPOSÉ]** — Saar répond « ok » ou donne sa valeur. Tant
qu'un point n'est pas tranché, l'agent applique le défaut **et le marque `[DÉFAUT NON VALIDÉ]` dans
le code + un ticket**.

#### A. Validation des lectures RAW — **TRANCHÉ (Saar, 2026-09-10)**

- **A1. ✅ RÉSOLU** — **4 préréglages RAW livrés** (braise / petit feu / grand feu / brasier, formule
  + Localisations pré-remplies) **+ « Personnalisé »** (fenêtre dédiée, tous les champs). Philosophie
  générale : concevoir pour les **90 %** (préréglages) + l'**exception** (libre) ; la pose d'une zone
  doit être **rapide, peu de clics** (le MJ a beaucoup de prép par battlemap). Techniquement : les 4
  préréglages = des **définitions builtin** (`formula` baked-in, pas `null`) ; « Personnalisé » = une
  définition custom. Voir §4.10 (principe d'interface).
- **A2. ✅ RÉSOLU (modèle corrigé)** — pas d'unification totale. **Le Souffle = un *timer de blocage
  respiratoire* commun** (eau / vide / gaz) : `−1` (immobile) à `−4`/Tour (combat), épuisé → Tests
  d'Athlétisme. **Chaque menace garde son effet propre par Tour** (noyade / asphyxie / effet du gaz).
  « Retenir sa respiration » consomme le Souffle et **divise l'effet par 2**. → §3.8 à corriger dans
  ce sens.
- **A3. ✅ RÉSOLU** — feu et acide partagent le **résolveur `damage`** (formule / Tour + Localisations
  + persistance à la sortie). RAW littéral « comme le feu ».
- **A4. ✅ RÉSOLU** — les 6 descriptions de `PLAN_NUAGE.md` §3 sont **fidèles au Livre de Base**
  (Saar a fourni le texte source). **Le préambule §Gaz manquait** — ajouté à §3.7 : propagation
  **instantanée** (pas m³/Tour), dissipation **conditionnelle (vent)**, rémanence **universelle**
  (aucun gaz `remanence: none`), immunité = **protection étanche seulement** (nuances par gaz —
  masque insuffisant contre le neurotoxique). Tableau des 6 effets/Tour verbatim en §3.7.

#### B. Feu — trous RAW — **TRANCHÉ (Saar, 2026-09-10)**

- **B1 + B2. ✅ RÉSOLU** — le RAW dit « certaines tenues ignifugées réduisent considérablement » mais
  **ne liste aucun équipement, nulle part** (omission de l'auteur) et **ne donne aucun chiffre**. Rien
  à seeder. →
  - **`ref_equipment.protections['hazard:fire']`** (via le champ JSONB `protections`, §10.3-I —
    remplace l'idée d'une colonne `fireproof` isolée). `null` partout par défaut, **aucun seed**,
    peuplé **par le MJ** au cas par cas.
  - **Aucune atténuation automatique.** La définition feu porte une ligne **`note`** : cible protégée
    `hazard:fire` touchée → « réduction RAW à arbitrer » dans le résultat. Seul endroit où le
    « réduit considérablement » du RAW existe. `[recommandé Claude, Saar non explicitement tranché —
    à confirmer, coût ~nul, réversible]`.
  - Une réduction automatique (ex. `degree:'partial'` → ÷ 2) = **une ligne `attenuation` à ajouter**
    plus tard, le slot est prévu.
- **B3. ✅ RÉSOLU (Saar)** — brasier = **`3D10` / Tour × TOUTES les Localisations** (`locationMode:
  'all'`), rien ne réduit. **Mort garantie en 1 Tour, aucun jet de survie** — « personne ne survit
  6 secondes dans un haut-fourneau ». Assumé.

#### C. Acide + données `ref_equipment` — **TRANCHÉ (Saar, 2026-09-10)**

- **C1. ✅ RÉSOLU** — pas d'échelle RAW, un seul point d'ancrage catalogue (`Capsule acide` =
  `damage_h "1D10"`). → l'acide = **double champ MJ à la pose : dégât + durée**. Pas de « puissance »
  abstraite. Préréglage `acide:capsule` (`1D10` / Tour, `1D6` Tours de persistance à la sortie).
- **C2. ✅ RÉSOLU — v2, mais prévu dès le contrat.** v1 = l'acide brûle **le personnage seulement**.
  Le contrat porte **dès Z0** : `corrodes: ['chair' | 'métal' | 'plastique' | …]` sur la définition
  + `cibleDeLEffet: 'équipement'` sur la ligne. Le **résolveur** `corrodeEquipment` (appelle
  `integrityService.adjustIntegrity`, déjà là — Usure L2) = un incrément v2, quand l'intégration
  combat d'Usure (L5) est stable. Jamais « on verra ».
- **C3. ✅ RÉSOLU — remplacé par le catalogue (proposition Saar, voir §10.3-G).** `[VÉRIFIÉ base]` :
  6 lignes `ref_equipment` corrompues — gaz **décomposants** + **vésicants** (Grenade + Capsule) ont
  une formule dans `nation` ; gaz **assommants** (×2) ont `"Test Résistance au Choc"` dans `damage_h`.
  Les lignes irritant / neuro / suffocant (×2) sont **vides** (mécanique en prose dans `description`).
  Lignes acide : **propres**. → La migration de nettoyage **supprime** les valeurs corrompues (ne les
  migre nulle part) ; la vraie donnée vit dans `shared/world/dangerCatalog.js` ; `ref_equipment` ne
  garde qu'`aoe_profile` (volume) + une **clé** de catalogue. Fait avec Z1.

#### D. Gaz — **TRANCHÉ (Saar, 2026-09-10)**

- **D1. ✅ RÉSOLU — généralisé.** « Puissance du gaz » = le **facteur `puissance` unifié** (§10.3-H,
  patron GAS SetByCaller). Le MJ saisit **un** scalaire à la pose (défaut neutre), qui scale
  l'effet — gaz, acide (RAW le *demande*), feu (réglage fin optionnel), radiations. Fin des champs
  ad-hoc « le MJ tape un nombre » par famille.
- **D2. ✅ RÉSOLU (Saar)** — **pas de plafond**. L'effet aggrave chaque Tour jusqu'à la sortie
  (décroissance) ou la mort. Fidèle au RAW.
- **D3. ✅ RÉSOLU** — « retenir sa respiration » = **½ de l'effet par Tour** (dégât ou malus),
  arrondi au supérieur, pendant que le Souffle tient (`−1` à `−4`/Tour, A2). Uniforme tous gaz.
  = atténuation `by: 'behavior'`, `effect: 'halve'`, coût en Souffle.
- **D4. ✅ RÉSOLU (Saar) — le catalogue contient les 6 gaz dès Z0** (D4 : « on a le RAW, on convertit
  au format »). Résolution incrémentale : v1 résout `damage` + `modifier` + `remanence` →
  `gaz:irritant` (`modifier −3` + `decay`) et `gaz:décomposant` (`damage 1D6` + `escalade +2` +
  `decay`) marchent en entier. `gaz:assommant` / `suffocant` / `neurotoxique` / `vésicant` sont dans
  le catalogue avec leurs lignes `damage` (résolues) + `test` / `statLoss` / `chance` (no-op + log
  jusqu'à v2). Tableau des 6 effets verbatim = §3.7. **Preuve utilisateur #2** = poser un
  `gaz:décomposant` ou `gaz:irritant` (les deux entièrement RAW en v1).
- **D5. ✅ RÉSOLU** — voir §10.8-C3 : migration = **suppression** des valeurs corrompues, la donnée
  vit dans `dangerCatalog.js`.
- **D6 (nouveau). ✅ RÉSOLU** — immunité gaz : champ `ref_equipment.protections` JSONB (§10.3-I).
  Contrairement à `fireproof`, **il y a de la donnée RAW** : `Masque à gaz`, `Cartouche Masque à gaz`
  existent dans le catalogue ; NBC / pressurisé nommés par gaz. → à taguer :
  `protections['atmosphere:gas']` = `{degree:'partial', scope:['peau'], except:['neurotoxique']}`
  (masque) · `{degree:'full'}` (NBC / pressurisé). Fait dans l'incrément `protections` (§10.5).

#### E. Souffle (v2 — flaggé, pas bloquant pour le noyau) — **TRANCHÉ (Saar, 2026-09-10)**

- **E1. ✅ RÉSOLU** — activité **dérivée** (la donnée existe) :
  `arme au clair ? −4 : (déplacement ce Tour ? mapping gait [lent→−2, rapide/max→−3] : −1)`.
  Le « mode combat » du moteur = compteur de Tours, pas un indicateur d'activité.
  **À vérifier au moment de coder** : le moteur distingue-t-il « arme dégainée » de « arme
  possédée » ? Sinon proxy = « a déclaré une action de combat ce Tour ». L'agent qui code E1
  tranche avec le code sous les yeux.
- **E2. ✅ RÉSOLU** — `surprised` → Souffle max effectif = `calcSouffle` ÷ 2.

#### F. Conventions techniques — **TRANCHÉ (Saar « on teste comme ça, on modifiera si besoin »)**

- **F1.** `stackingPolicy` : v1 = **`'max'`** (le pire l'emporte — **déjà** le comportement de
  `burning` : `applyModStatus` écrase + `turnsFromNow` fait `max`) + `'independent'`. `'stackCount'` /
  `'refreshDuration'` = déclarés, non résolus v1.
- **F2.** `chaining` : forme `{ engendre, délai, condition, géométrie }` dans le contrat ; **0
  résolveur** v1.
- **F3.** `zoneInteractionRules` : **0 règle** v1 (Polaris n'a pas de « les surfaces interagissent » —
  c'est du DOS2 ; le MJ arbitre). Forme `{ whenTag, meetsTag, action }` dans le contrat.
- **F4. ✅ RÉSOLU (Saar)** — **`centreDedans` seul en v1**. Le geyser de flamme ne mord que si le
  centre du token est dans le volume ; l'effleurer ne fait rien. `toutRecouvrement` = v2 si le jeu
  réel le réclame.
- **F5.** `remanence: 'conditional'` v1 = persiste à la sortie + **retrait MJ manuel** ;
  `remanenceCondition` = libellé d'affichage. Extinction auto (immersion / neutralisant) = v2.
- **F6.** Milieu (sous-marin / 0G) : v2 ; direction **défaut salle + override zone** (patron PF2e) ; à
  acter dans `PLAN_ENVIRONNEMENT_MILIEUX` quand `skillOverride` arrivera.

#### G. Coordination inter-chantiers

- **G1.** Z3 / Z5 **dé-gèlent le chantier grenades** — mettre à jour `PLAN_GRENADES.md` §6 au
  démarrage de Z3.
- **G2.** *(aparté hors zones)* Grenade à énergie — `armorFactor` du champ d'énergie vs armure
  physique : `[à confirmer]`, non tranché par Saar, reste sur `1` par défaut. Suivi côté chantier
  grenades, pas ici.

## 11. Historique

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
- **2026-09-09 (schéma consolidé)** — §4.8 : les bullets de §4 accrétés sur 5 cas remis en schéma
  typé. **8 types de ligne d'effet** (dégât · statut · modificateur v1 ; test · drainRessource ·
  substitutionCompétence · mouvementForcé · perteCarac v2) + 4 blocs de définition (atténuations,
  cycleDeVie, visibilité, chaînage). Ferme Q6.3 / §7.7. v1 = 3 types de ligne. Préréglages builtin
  fire/gas/acid/flooded. Toujours rien codé.
- **2026-09-09 (test du schéma)** — §4.9 : 4 scénarios Saar (sol instable · salle qui s'emplit d'eau ·
  geyser de flamme · chambre froide). Ajouts au schéma : `géométrie.animation` (remplissage / dérive /
  propagation) ; `conditionGéométrique` porte une **règle de recouvrement** (toutRecouvrement /
  centreDedans / seuilVertical). Constats : le schéma dégrade proprement vers le terrain ; le scope
  combat-only rend la chambre froide quasi-inerte (RAW = échelle heure) — par conception.
- **2026-09-09 (chasse aux cas — convergence)** — revue des cas restants (irradiation, électricité,
  brouillage, soin, obscurité, sonique) : tous mappent sur les 8 types de ligne, parfois avec une
  nouvelle valeur de `modificateur.cible`. Aucun structurellement neuf → **arrêt de la chasse aux
  cas**, décision Saar.
- **2026-09-09 (timing moteur de tour)** — §7.5 esquissé, `combatTurnEngine.js` lu. Design :
  **balayage de présence** (roster × zones, 1×/Tour) puis **tick à `startResolutionPhase`, unifié
  avec le tick hazard existant** ; entrée en cours de résolution → condition posée, résolue au Tour
  suivant (one-shot pièges/geyser = inline) ; `duration_rounds` décrémenté dans `endTurn` ; **aucune
  interaction avec l'échelle `resolve_on_turn`** (opération de masse pré-marche). Toujours rien codé.
- **2026-09-09 (plan d'implémentation v1)** — §8 : 7 incréments séquencés Z0→Z6. Noyau = Z0→Z4
  (schéma de ligne · boucle de présence + cycle de vie · grenade incendiaire · gaz simple), 2
  preuves. Z5 (UI MJ) / Z6 (joueur) = couche UX. Différé v2 explicité (test/Souffle/compétence/
  mouvement forcé, animation géométrique, formes non-AABB, interaction zone × zone, pièges).
  §7.9 (rendu joueur) rabattu sur Z6. **Cadrage terminé — prêt à passer au plan détaillé de Z0 puis
  au code, sur validation Saar.** Toujours rien codé.
- **2026-09-09 (analyse à charge du plan §8)** — §8bis : 10 constats. Le tick de zone ne fusionne pas
  avec `resolveEnvironmentalHazardTicks` ; `modificateur` passe par `activeMalusRegistry` ; Z4
  sous-dimensionné (mini-FSM) ; limites v1 explicitées. Découpage → 9 incréments Z0a→Z7.
- **2026-09-10 (plan détaillé Z0 + analyse à charge)** — §9.Z0a : plan du schéma
  (`normalizeHook` v2 : `damage` enrichi + `status`). Analyse à charge : `modifier` reporté en Z3
  (schéma mort) ; **Z0a + Z0b fusionnés en « Z0 »** (schéma prouvé par son résolveur, pas de tour à
  vide) ; `[VÉRIFIÉ DB]` 0 ligne `world_effect_*` → aucune rétro-compat de données ; validation dés
  autoritaire à la création, jamais au tick ; `remanence:conditional` v1 = persiste + retrait MJ
  manuel. Prêt à coder Z0. Toujours rien codé.
- **2026-09-10 (groupes A–D des décisions Saar)** — §10.8 : A (RAW) + B (feu) + C (acide) + D (gaz)
  tranchés. Généralisations décidées : **facteur `puissance` unifié** (patron GAS SetByCaller,
  §10.3-H) — un curseur MJ pour toutes les familles ; **`ref_equipment.protections` JSONB** (§10.3-I)
  — remplace `waterproof`/`fireproof`/… , rework assumé, incrément Z1b ; **`dangerCatalog.js`
  contient TOUTES les définitions dès Z0**, résolution incrémentale (les 6 gaz, radiations, tout).
  RAW gaz vérifié par Saar (fidèle) + préambule §Gaz ajouté (§3.7). RAW radiations : déjà transcrit
  (`FATIGUE&DOMMAGES.md`), non-combat, zone = `accumulateLevel` à l'entrée, résolveur v2.
  §3.1/§3.2/§3.6/§3.7 enrichis, §10.5 plan révisé (Z0→Z7 + Z1b).
- **2026-09-10 (prise de recul + recherche architecture)** — Saar : « on est allé trop vite ».
  Recherche approfondie (UE GAS `GameplayEffectComponents`, Unity GAS open-source, 2 writeups
  status-effects, Caves of Qud, Divinity OS2 surfaces). **§10** créé, fait autorité : le patron
  « registre déclaratif + dispatcher générique » (déjà le style maison — `activeMalusRegistry`,
  `resolveModHooks`) EST l'archi adaptative visée. Reco : **un `effectLineResolverRegistry` unique** ;
  **refonte de `environmentalHazardService` dedans** (`burning`/`acid`/`decompression` deviennent des
  définitions) ; interaction & immunité **par tags, jamais par matrice** (patron DOS2). §8bis
  « resolveZoneTick frère » abandonné. Contrat = tous les types de ligne validés dès Z0, résolution
  incrémentale. Plan révisé Z0→Z7. **Décision Saar : cette conversation ne produira aucun code** — son
  but = package de reprise complet. **§10.8 « Décisions requises de Saar »** rédigée (28 points,
  chacun avec un défaut proposé). Reste : §10.9 (exemple travaillé) · §10.10 (nettoyage `ref_equipment`)
  · §10.11 (plans Z0/Z1) · `PLAN_ZONES_DANGER_EDITEUR.md`.
