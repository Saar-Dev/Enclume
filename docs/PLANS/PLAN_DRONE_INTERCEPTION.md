# PLAN — Drone d'interception (bouclier) — v2.1

> Rédigé 2026-09-23 (v1) ; **réécrit le même jour (v2)** après analyse à charge + lecture complète des
> chemins de tir + recherche externe (§9) ; **v2.1** = analyse à charge de la v2 intégrée (coffre, CaC
> drone, roster, obstacle géométrique, Lot 2). Dette RAW d'origine : `docs/SYSTEME/COMBAT_FLUX.md` §7.4.
> Code : seules les étapes structurelles 0a/0b sont écrites (§7bis), non commitées. Les marqueurs `[VÉRIFIÉ]` = lu dans le code / la base ; `[HYPOTHÈSE]` /
> `[INCONNU]` = à trancher au codage, jamais présumé.

## 0. En clair (pour Saar)

Un **drone bouclier** protège un ou plusieurs personnages (ou une exo-armure). Quand un protégé se fait
tirer dessus **et est touché**, le drone tente un Test d'interception. S'il fait **mieux que l'attaquant**
(sa marge est supérieure), il s'interpose : c'est **lui** qui encaisse le tir, à la place du protégé.
Le drone n'intervient **que sur ce qui vise son protégé** (jamais sur ce qui passe simplement près de lui).
Il ne distingue pas un tir d'un explosif : il **rejoint, au plus court, un point de la trajectoire**,
à condition que **sa vitesse de déplacement maximale** le lui permette. Contre un **explosif** (grenade,
même à minuterie), il l'attrape en vol : la grenade **tombe à ses pieds** et explose là (tout de suite, ou au
Tour suivant), et le drone n'encaisse que **la moitié** des dégâts. Le protégé peut quand même être touché
s'il est dans le rayon. Jamais au corps à corps.

## 1. RAW — deux mécaniques, à ne pas confondre

**Source** : `docs/REGLES/REGLEDRONE.md` (Guide Technique), citations exactes.

### 1a. Drone bouclier personnel (`REGLEDRONE.md:712-735`)
> « Ce petit drone [...] flotte autour de l'appareil [...] et peut tenter de s'interposer entre l'engin et
> toute attaque. **S'il réussit à bloquer une arme affectant une zone (torpille ou obus par exemple), il
> absorbe la moitié des dommages.** Il ne sert à rien au corps à corps. [...] En cas d'attaque on effectue
> un test avec le niveau d'interception du drone. Si la marge de réussite de ce test est supérieure à la
> marge de réussite de l'attaque, le drone s'interpose. Il est alors traité comme un obstacle. »

Programme : `Interception 12`. **Vitesse : « - »** (aucune valeur au RAW → à saisir par le MJ, §3.6).
Commandé par l'ordinateur de l'hôte (ou une ceinture), pas de pilote séparé.

### 1b. CRD Neptune/Artémis (`REGLEDRONE.md:1018-1027`) — Lot 3
Même mécanique (Test de marge, jamais au CaC, moitié des dégâts vs explosion), plus : le CRD gère
plusieurs interceptions **simultanées**, **−1 par interception supplémentaire**, **maximum 4**. Les
mini-drones ne s'éloignent pas de plus de **10 m** de l'armure.

## 2. Décisions actées (Saar)

| # | Décision | Date |
|---|---|---|
| Q1 | Lien de protection **persistant**, porté par le drone (pas par le combat). **Un drone peut protéger plusieurs personnages.** | 09-23 |
| Q2 | Le multi-drones (CRD) est planifié dès maintenant (Lot 3), pas différé à la légère. | 09-23 |
| Q3 | Un drone d'interception pur **ne « passe » pas** et n'a pas d'ordre permanent : c'est une **réaction**, pas une action de Tour. | 09-23 |
| Q4 | **Distance** : le drone doit pouvoir se déplacer jusqu'au point d'interposition avec sa **vitesse de déplacement maximale** (précisé par Q-D : le point est sur la trajectoire, pas sur le protégé). | 09-23 |
| Q5 | **Explosion** : le drone encaisse **la moitié** (« le RAW a raison ») ; l'explosion est déportée sur lui (précisé par Q-C/Q-D : la grenade tombe à ses pieds). Le protégé reste touché s'il est dans le rayon. | 09-23 |
| Q6 | **Protégé = l'exo** (l'exo protège déjà son pilote) ; un PJ à pied peut aussi être protégé. Le lien pointe un `characters.id`. | 09-23 |
| Q-A | **La moitié des dégâts d'explosion = le drone seul** (lecture littérale du RAW). Les autres dans le rayon, protégé compris, prennent les dégâts normaux (atténués par la distance au nouveau centre). | 09-23 |
| Q-B | **Le drone se déplace visiblement** jusqu'au point d'interposition. **Précisé le 09-24 : il se déplace dès qu'il TENTE (avant le Test), que celui-ci réussisse ou non** — un drone qui échoue reste sur la ligne de tir. | 09-23 |
| Q-C | **Une grenade à minuterie est interceptable** : le drone se déplace pour l'attraper, et la grenade **explose à ses pieds le Tour suivant**. (Annule la décision « non » prise plus tôt dans la journée.) | 09-23 |
| Q-D | **Le drone ne distingue pas explosif et projectile : il intercepte au plus court** — il rejoint le point de la trajectoire qui lui coûte le moins de déplacement. Même règle pour le tir simple et l'explosif. | 09-23 |
| Q-F | **Le drone n'intercepte QUE ce qui vise son protégé.** Jamais ce qui passe simplement à sa portée, ni ce qui vise quelqu'un d'autre, ni un explosif dont le protégé n'est que victime collatérale. | 09-23 |
| Q-G | Le drone peut intercepter une trajectoire **éloignée du protégé** : il suffit qu'il puisse l'atteindre avec sa vitesse max (« il est en capacité d'agir, il agit »). | 09-23 |
| Q-H | **Grenade visée sur le protégé mais dispersée ailleurs : le drone se déplace et tente quand même l'interception** (il réagit à la visée, pas au résultat ; trajectoire réelle suivie). | 09-23 |
| Q-I | **Un tir n'active le drone que si le protégé en est la cible** (la redirection existante gère déjà « le tir traverse sa case au centre »). Pas d'extension « toute la case » : chantier moteur séparé éventuel. | 09-23 |
| Q-E | Aucune exception « tir ami » : un drone intercepte tout ce qui **vise** son protégé, quel qu'en soit l'auteur (rare une fois Q-F posée : ne concerne qu'un allié qui viserait le protégé). | 09-23 |

## 3. Lot 1 — Tir simple (bouclier personnel)

### 3.1 Où se branche la réaction — UN seul endroit par famille de tir `[VÉRIFIÉ]`
Toutes les touches d'un Tir convergent dans **deux fonctions** (Chance/relance comprises) :

| Tireur | Fonction | Ligne |
|---|---|---|
| Humanoïde (PJ/PNJ) | `finalizeAssaultHitOutcome` | `socketCombatHelpers.js:3685` (aussi appelée après relance Chance, `:3825`) |
| Drone (dont **télépilotage**) et exo | `finalizeAssaultOutcome` | `socketCombatHelpers.js:3062` (appelée par `resolveDroneAssaultAction:2898`, `socketCombatExo.js:274` et `:326`) |

**Piège (analyse à charge) `[VÉRIFIÉ]`** : `finalizeAssaultOutcome` sert **aussi** le corps à corps d'un
drone — `resolveDroneAssaultAction` traite CaC et distance puis appelle la même finalisation (`:2760`,
`:2898`). Un branchement naïf ferait intercepter les attaques CaC de drones, contre le RAW. Le service
reçoit donc un paramètre **explicite** `attackKind: 'ranged' | 'melee'` posé par l'appelant (la branche
`isCaCWeapon` de `resolveDroneAssaultAction`) ; **jamais déduit** de `portee === null`. `finalizeAssaultHitOutcome`
(humanoïde) n'est atteinte que par un Tir (arme de contact exclue en amont, `:3296`) → `'ranged'`.

La v1 visait `resolveAssaultAction` : **faux** (elle sort tôt pour un tireur drone, `:3319`, l'exo est routé
en amont). Les deux finalisations relisent la cible depuis `action.target_token_id` : **substituer le token
cible du protecteur dans `action` avant le dispatch suffit** — tout le reste (drone-cible : dégâts,
intégrité, RD, émissions ; fenêtre de dégâts d'un tireur PJ via `cibleType:'drone'`,
`confirmDamage:668`) est déjà géré par les chemins existants. **Ne jamais** appeler
`resolveDroneIntegrityLoss` en direct (la v1 le proposait : pour un tireur PJ les dégâts ne sont **pas
encore lancés** à ce stade, `AWAITING_DAMAGE` les attend).

Patron pro correspondant `[VÉRIFIÉ, §9]` : points d'accroche nommés (midi-qol `isAttacked` = après le jet,
avant l'évaluation ; `isHit` = touché, avant les dégâts) — la réaction s'inscrit sur un moment du pipeline,
elle n'est jamais écrite dans une fonction de tir particulière. Ici : moment « touché, avant dégâts »,
matérialisé par **un appel unique** `resolveProtectorInterposition(...)` depuis les deux finalisations.

### 3.2 Nouveau module — cœur pur + coquille
- **Cœur pur** `shared/droneInterception.js` (+ `.test.mjs`) : `pickProtector(candidats)` (niveau le plus
  élevé, égalité → `token_id`), `isInterposed(margeDrone, margeAttaque)` (**strictement supérieure**, un
  échec du drone a une marge négative donc jamais supérieure). Aucun accès base.
- **Coquille** `server/src/lib/droneInterceptionService.js` : lecture base, portée, Test, émissions.
  Retourne `{ action }` (inchangée ou avec `target_token_id` substitué). Aucune logique métier dans les
  sockets.

### 3.3 Algorithme (tir touché uniquement, jamais CaC)
1. Cible du tir → `character_id`. **Principe (Q-F) : le drone n'intervient que si le tir VISE son protégé**
   (`action.target_token_id` = le protégé) — jamais sur un tir qui passe à sa portée en visant un autre,
   jamais sur un tir dont le protégé n'est pas la cible. Chercher les **protecteurs éligibles** :
   - lien `drone_interception_targets` (protégé = cette cible) ;
   - le drone a un programme **`interception`** (§3.5) ;
   - le drone a un **token sur la même battlemap** que le tir, pas sur la couche MJ cachée
     (`visibilityActorsFromTokens` exclut déjà `layer === 'gm'`, `worldVisibilityService.js:67`), et une
     **intégrité restante** (`drone_sheet.integrite_actuelle > 0`). **Le roster n'est PAS exigé** :
     `combat_roster` n'est rempli qu'**une fois**, à `COMBAT_START` (`socketCombatState.js:222`,
     seul site d'insertion) `[VÉRIFIÉ]` — exiger le roster rendrait un drone déployé en cours de combat
     définitivement incapable d'intercepter, sans raison RAW ;
   - le drone n'est pas **télépiloté ce Tour** (RAW : réaction en « mode autonome uniquement »,
     `COMBAT REFERENCE.md:575,645` ; télépilotage = choix non persistant par Tour, `COMBAT.md`
     § Télépilotage). **Piège `[VÉRIFIÉ]`** : la ligne `combat_actions` d'un télépilotage porte le token
     du **pilote** (`socketCombatAnnouncement.js:797`, Initiative), pas celui du drone ; le drone s'y
     retrouve par `drone_weapon_inv_id` (tir) ou `modifiers.dronePilotTokenId` (déplacement, `:750`).
     → **une seule fonction d'autorité** `isDroneTelepilotedThisTurn(campagne, drone)` (lignes du Tour
     courant, statut ≠ `skipped`), réutilisable par tout futur programme réactif — jamais reconstruite
     ailleurs, jamais un nouveau drapeau à synchroniser avec l'annulation d'une déclaration ;
   - le drone n'est pas la cible elle-même.
   Aucun éligible → sortie immédiate, **aucun bruit en chat**.
2. **Portée et déplacement** (Q4, Q-B) :
   - Budget = `getCharacterMovementBudget(droneId, 'max').budgetM` (`movementBudgetService.js:48` ; drone =
     valeur unique `drone_sheet.vitesse` en m/Tour, `buildDroneAllures:164`) `[VÉRIFIÉ]`.
   - **Point d'interposition « au plus court » (Q-D)** : le point de la **trajectoire** (segment
     tireur → cible, **strictement entre les deux**) que le drone atteint au **moindre coût de
     déplacement**, chemin réel (murs, occupation) compris. Il n'y a **aucune notion de « devant le
     protégé »** ni de rayon de token : la v2 initiale s'y appuyait (≈ 0,7 m), c'est abandonné.
   - **Un token ne se pose jamais « exactement » sur la ligne** `[VÉRIFIÉ]` : les positions de marche sont
     les **centres de cases** (un nœud de navigation par support, voisinage à 8 cases, `navigation.js:132-144`
     et `:181`) ; une destination est **ajustée sur le nœud libre le plus proche**, à 1,25 m au plus
     (`nearestNode`, `:332`). Les points « libres » (transient) n'existent que sur les escaliers et échelles
     (`:363-378`). La v2.1 imaginait donc à tort des points échantillonnés sur la ligne ; **abandonné**.
   - **Modèle « à la case » (proposition de Saar, retenue)** : *un token occupe une case ; un projectile
     qui traverse une case ou y arrive concerne le token qui l'occupe.* Une case = une **dalle de sol
     entière** : le compilateur crée **une dalle par cellule entière** `[x, x+1] × [z, z+1]`
     (`worldCompiler.js:129-146` et `:764-786`) `[VÉRIFIÉ]` → **la case d'un point = `(floor(x), floor(z))`**
     (+ étage). **Aucune tolérance de distance** (l'idée « demi-case » de la v2.1 est abandonnée).
   - **Candidats** = les cases que le **segment de tir traverse** (parcours de grille exact, algorithme
     standard d'Amanatides & Woo, *A Fast Voxel Traversal Algorithm for Ray Tracing*, 1987 — coin
     compris : une case touchée par le segment compte), à une **hauteur compatible** (la ligne passe entre le
     sol de la case et la hauteur du profil du token — **en unités monde, comme `findWorldInterceptors`**
     `[VÉRIFIÉ]` : `visibility.js` additionne `profile.height` (1,8) à des altitudes en unités monde, pas
     en mètres ; on lit donc `normalizeVisibilityProfile({}).height`, la même autorité) ; les cases du
     tireur et de la cible sont exclues
     (occupées, donc déjà écartées par l'occupation). Deux petites fonctions **pures** dans `shared/world`
     (`cellOfPoint`, `cellsCrossedBySegment`), testées : segment horizontal, vertical, diagonale, passage
     par un coin, segment dans une seule case, changement d'étage.
   - **Primitive moteur à ajouter (petite, testée)** : `findNavigationPath` (`navigation.js:430`) fait déjà
     un **Dijkstra pur qui s'arrête au premier candidat atteint** quand plusieurs destinations sont
     possibles (`:456-495`) `[VÉRIFIÉ]`, mais son ensemble de candidats est figé à « la destination ou ses
     voisins libres ». On y ajoute une option **`destinationPredicate(node) → booléen`** (« le nœud libre le
     moins coûteux qui satisfait ce prédicat »), relayée par `planWorldPath` (`:539`) et
     `planBattlemapTokenMovement` (`worldMovementService.js:210`). Le premier nœud satisfaisant que le
     Dijkstra dépile est **exactement** le plus proche en coût — c'est « au plus court », sans
     échantillonnage ni comparaison de plusieurs chemins. Tests dans `navigation.test.mjs` : candidat le
     moins coûteux, candidats tous occupés, aucun atteignable, départ déjà candidat (coût 0), comportement
     **inchangé** sans prédicat. Réutilisable (tout futur « atteindre une position qui vérifie X »).
   - **Atteignable ?** le plan résultant doit rendre `status === 'destination'` (coût ≤ budget).
     `'budget'` = trajet **partiel** → **refusé** (le drone n'arrive pas sur la trajectoire) ;
     `'unreachable'` idem (`navigation.js:559-585`) `[VÉRIFIÉ]`. Le drone **déjà sur la trajectoire**
     (coût 0) intercepte sans bouger.
   - **Exécution (Q-B, précisé 09-24)** dès que le drone **tente** — **avant** le Test, qu'il le gagne ou non :
     `executeBattlemapTokenMovement` vers le nœud retenu, puis `WORLD_RUNTIME_UPDATED` + `TOKEN_MOVED`
     (même payload que la Résolution de déplacement de combat, `socketCombatResolution.js:424-459`).
     **Aucun changement client** `[VÉRIFIÉ]` : le client ne lit de `TOKEN_MOVED` que
     `tokenId/pos_x/pos_y/pos_z/position_space/updated_at` (`useTokenSocket.js:13`, garde d'obsolescence par
     `updated_at`, `tokenStore.js`) — `worldMovement` n'est consommé nulle part côté client ; et tout
     `WORLD_RUNTIME_UPDATED` de `kind` autre que `elevator-clock` rafraîchit l'état du monde
     (`useWorldRuntimeSync.js:39`) → nouveau `kind: 'drone-interposition'`.
   - **Coût :** le moteur n'a **aucun compteur de mouvement par Tour** (chaque déplacement déclaré
     reçoit son budget entier) `[VÉRIFIÉ]` → le déplacement d'interposition est **gratuit** (n'entame
     rien pour le propre Tour du drone). Simplification à journaliser : le RAW décrit le drone qui
     « flotte autour » de l'appareil, il n'est pas à un endroit fixe.
   - Ce code d'émission existe déjà **deux fois** (`socketCombatResolution.js:424-459`, `socketToken.js:60-77`) :
     une troisième copie serait une dette. **Étape 0 du Lot 1** : extraire un émetteur partagé, sans
     changement de comportement (structurel, testable seul).
   - Vitesse absente (`MovementBudgetError`) → drone inéligible **avec message MJ explicite** (« vitesse non
     renseignée »), jamais un silence.
3. Plusieurs éligibles : **un seul essaie** (le plus haut niveau). Pas de cascade en cas d'échec (RAW muet ;
   simplification à journaliser).
4. **Test d'interception** : même pipeline que la Détection drone (`socketCombatHelpers.js:2997-3016`) :
   `resolveTestOutcome(roll, niveau)` + bonus de réussite critique + relance d'échec critique +
   `maybeTriggerCatastrophe` (nouveau site `drone_interception`) + `DICE_RESULT` en chat. Aucun modificateur
   de situation sur ce Test (simplification à journaliser).
5. `isInterposed(margeDrone, mr)` vrai → chat « le drone X s'interpose et encaisse à la place de Y » ;
   `action.target_token_id` = token du drone ; la finalisation continue normalement. Faux → rien ne change.
6. Tir Multi : chaque tir sœur = sa propre tentative.

`mr` d'un succès = le jet lui-même (`resolveTestOutcome`, `polarisTestResolution.js:77`) : la comparaison
« marge drone > marge attaque » tient sans test de réussite supplémentaire `[VÉRIFIÉ]`.

### 3.4 Priorité avec l'interception « géométrique » déjà en place `[VÉRIFIÉ]`
`losService.js:22` redirige déjà un tir vers tout token situé **sur la ligne** (`findWorldInterceptors`,
`shared/world/visibility.js:211`), **avant le jet**, sans Test. Deux mécanismes portent donc le mot
« interception ». Règle :
- un drone **éligible** qui protège la cible courante est **retiré des intercepteurs** (il passe par son
  Test, pas par la redirection automatique). **Éligible = toutes les conditions du §3.3 sauf le Test**
  (token, intégrité, non télépiloté, atteignable). Un protecteur **inéligible** (hors de portée,
  télépiloté, vitesse absente) qui se trouve sur la ligne reste un obstacle géométrique **comme
  aujourd'hui** : le retirer sans condition ferait disparaître un obstacle réel (régression). L'éligibilité
  est **recalculée** à la finalisation (le contexte différé Chance est sérialisé en base : rien de calculé
  au moment de la LOS n'y voyage). **Où :** dans `losService.redirectToInterceptor` (`:22`, qui prend
  `interceptors[0]`) — on filtre la liste avant de choisir. **Pas** dans le moteur monde : la géométrie
  (`findWorldInterceptors`, `evaluateWorldVisibility`) reste pure, sans connaître une règle de jeu ; le
  paramètre `excludeActorIds` existant n'est donc pas modifié `[VÉRIFIÉ : passe par 3 couches, aucune
  n'est nécessaire]`. Le filtre lit la même liste de protecteurs que le service (§3.2) ;
- tout autre token sur la ligne garde le comportement actuel, inchangé ;
- **Vocabulaire** : nommer le nouveau concept « interposition de protecteur » (à consigner dans
  `docs/VOCABULARY.md`) pour ne pas le confondre avec « cible interposée » (géométrique).

### 3.5 Catalogue — `category='interception'` `[VÉRIFIÉ, code + base locale]`
Le programme **existe déjà** (« Interception », `ref_equipment`, famille Logiciels) mais avec
`category='pilotage'` (seed `303_ref_equipment_seed.js`) — catégorie **partagée** avec « Pilotage » et
« Dissimulation », donc inexploitable pour filtrer. La catégorie d'un programme est **copiée du catalogue à
l'ajout** ; `COMBAT REFERENCE.md:645` attend déjà `interception`.
- **Migration** (prochain numéro libre, vérifier `knex_migrations` ; dernier fichier = 356) : `UPDATE
  ref_equipment SET category='interception'` **par `name`** (jamais par `id`, règle core) + `UPDATE
  drone_programs` des lignes déjà copiées (jointure `equipment_id`). Base locale : 0 ligne concernée
  aujourd'hui ; serveurs distants **[INCONNU]** → la migration couvre les deux cas.
- **Client** : ajouter `interception` dans `PROGRAM_CATEGORIES` (`DroneSheet.jsx:130-148`) et son libellé
  `drone.category.interception` (`fr.json`, à côté de `:1181`). Programme ajouté en « custom » : la catégorie
  se choisit à la main dans la même liste.

### 3.6 Données
Nouvelle table `drone_interception_targets` (fichiers `NNN_…js` structure + `NNN_…_constraints.js`) :
```
drone_character_id     uuid not null  → characters(id) on delete cascade
protected_character_id uuid not null  → characters(id) on delete cascade
created_at             timestamptz not null default now()
PK (drone_character_id, protected_character_id)
INDEX (protected_character_id)          -- la lecture à chaque tir se fait par protégé
```
Garde applicative (les FK ne la donnent pas) : même campagne, drone ≠ protégé, le protecteur est de type
`drone`. Le protégé peut être `pj`, `pnj` ou `exo` (Q6).

**Coffre (Vault) — piège `[VÉRIFIÉ]`** : `assertRegistryUpToDate` (`vaultService.js:150-178`) **lève une
erreur 500** à chaque clonage si une table a une FK vers `characters` sans figurer dans le registre ni dans
`EXCLUDED_TABLES`. Sans action, **cette table casserait tout transfert/clonage de personnage**. Décision :
l'ajouter à `EXCLUDED_TABLES` (`:138`) — un lien de protection décrit un **agencement de campagne**, pas le
personnage ; un drone cloné arrive **sans ses protégés** (les personnages liés n'existent pas dans la
campagne de destination). À journaliser ; test : le garde-fou doit passer sur la base migrée.

**Vitesse du drone bouclier** : le RAW indique « - ». Sans valeur dans la fiche, le drone ne peut pas
s'interposer (§3.3-2). À signaler au MJ lors de la création (texte d'aide dans la section « Protection »).

### 3.7 API et UI
- **REST** dans `server/src/routes/character/char-sheet.js`, à côté de `/:characterId/drone/programs`
  (`:1852`, garde MJ) : `GET|POST|DELETE /:characterId/drone/interception-targets`. **Pas** de nouveau
  fichier de routes (le plan v1 en proposait un) — même famille, même garde, même service métier.
- **Client** : nouvelle section « Protection » dans `DroneSheet.jsx`, juste après « Programmes » (`:408`),
  sélection des personnages de la campagne (exos inclus). Toutes les chaînes en i18n (`rules/i18n.md`).
- `DroneWindow.jsx` / `DroneDeclareSection.jsx` : aucun changement (Q3).
- **Messages de combat** (interposition, vitesse non renseignée, échec) : `COMBAT_SYSTEM_NOTICE` avec
  `i18nKey` + `params` (patron `socketCombatAoe.js:595`, `rules/i18n.md` : jamais de texte FR figé émis par
  le serveur), clés ajoutées dans le namespace de session **avant** usage. Le libellé du `DICE_RESULT`
  suit le patron existant des Tests de drone (Détection, Armement).

### 3.8 Tests
- Pur : `shared/droneInterception.test.mjs` (choix du protecteur, marge strictement supérieure, échec du
  drone, égalités).
- Toutes les **conditions d'éligibilité** vivent dans le cœur pur : la coquille ne fait que **rassembler
  les données** (liens, programme, intégrité, télépilotage, faisabilité du trajet) et les lui passer —
  ainsi hors de portée, détruit, télépiloté, sans programme, vitesse absente, CaC se testent **sans base**
  (le service lui-même ne l'est pas sans base : validé en jeu réel, comme les autres services de combat).
- Garde-fou du coffre : le clonage d'un personnage passe sur la base migrée (nouvelle table exclue).
- Scénario réel (Saar) : PJ tire sur un protégé → Test visible en chat → le drone encaisse ; tireur drone,
  exo et télépiloté ; exo protégée.

## 4. Lot 2 — Explosif intercepté : la grenade tombe aux pieds du drone (Q5, Q-A, Q-C, Q-D)

RAW : « s'il réussit à bloquer une arme affectant une zone [...] il absorbe la moitié des dommages ». Le
blocage reste conditionné à un **Test** (la v1 écrivait « pas un Test » : faux). **Le drone ne distingue pas
un explosif d'un projectile** (Q-D) : même règle de point d'interposition qu'au Lot 1 (§3.3-2, « au plus
court »). Contre un explosif, le drone **attrape la grenade en vol** : elle **tombe à ses pieds** et
explose là, **immédiatement (percussion) ou au Tour suivant (minuterie)** (Q-C). Le drone **seul** prend la
moitié des dégâts (Q-A).

### 4.1 Où se branche la réaction `[VÉRIFIÉ]`
Dans `resolveAoeAssaultAction` (`socketCombatAoe.js:469`), le lancer d'une grenade se résout dans un bloc
qui ne s'exécute **qu'une fois, au lancer** (`if (aoe.intendedOrigin && !aoe.resolvedOrigin)`, `:548`) :
Test de Coordination (`coord.mr` = la « marge de l'attaque ») → dispersion → **point d'impact réel figé**
`aoe.resolvedOrigin` (`:580`) → séparation percussion / minuterie (`:583`). **Le branchement se place
entre `:581` et `:583`**, donc **avant** la séparation : **un seul point pour les deux modes de
détonation**. Conséquence utile : la ré-entrée au Tour+1 (`resolvedOrigin` déjà posé) ne repasse jamais par
ce bloc — aucun drapeau nécessaire, aucun risque de seconde interception à l'explosion.
1. **« Vise son protégé » (Q-F)** : une grenade n'a **aucun token cible** (`targetTokenId: null`, seul un
   point visé `aoe.intendedOrigin` est envoyé, `buildDeclarePayload.js:208-216`, `socketCombatAnnouncement.js:776`)
   `[VÉRIFIÉ]`. Elle **vise un protégé** quand le **point visé** (avant dispersion) tombe **dans sa case**
   (`cellOfPoint(point visé) = case du protégé`, même étage) — modèle « à la case », sans tolérance de
   distance. Une grenade visée sur un
   ennemi voisin qui souffle le protégé **par ricochet n'est PAS interceptée** (le drone ne réagit pas à
   ce qui ne le vise pas). **Aucun calcul de zone au lancer** : la v2.1 prévoyait d'extraire
   `computeAoeZone` — **abandonné**, plus nécessaire (moins de code structurel touché).
   **Q-H (décidé)** : le drone réagit à la **visée**, pas au **résultat** — une grenade visée sur le
   protégé mais dispersée ailleurs est quand même interceptée (le drone ne peut pas savoir à l'avance où
   elle tombera). La trajectoire suivie est la trajectoire réelle (lanceur → point d'impact après dispersion).
2. **Trajectoire** = segment lanceur → point d'impact réel (après dispersion). Point d'interposition,
   éligibilité, Test, déplacement : **exactement le Lot 1** (`resolveProtectorInterposition`, mode
   « zone »), marge = `coord.mr`.
3. **Succès** : le drone rejoint le point P ; `aoe.resolvedOrigin := P` (**la grenade tombe à ses pieds**) ;
   `aoe.interposedDroneTokenId := drone`. Ces deux champs sont **persistés ensemble** avec
   l'écriture `jsonb_set` déjà présente (`:590` percussion, `:621` minuterie — même ligne SQL étendue),
   donc durables jusqu'au Tour+1 (redémarrage serveur compris).
4. **Percussion** : on poursuit dans le bloc d'explosion existant, qui recalcule la zone depuis P.
   **Minuterie** : entrée d'échelle et marqueur 3D (`COMBAT_GRENADE_ARMED`, `:642`) partent avec P — le
   marqueur montre la grenade là où elle est réellement tombée. À l'explosion (Tour+1), la zone est
   calculée depuis P comme d'habitude.
5. **Une seule interposition par grenade.** Le drone peut avoir bougé entre-temps (il agit à son rang au
   Tour+1) : hors de la zone, il ne prend rien ; dedans, il prend la moitié (§4.2).
- **Périmètre** : formes **circulaires** seulement (les deux grenades du catalogue, `[VÉRIFIÉ, base
  locale]` : `grenade_frag` rayon **15 m**, `grenade_energy` 2,5 m — **toutes deux à minuterie par
  défaut**, donc le cas minuterie est le cas courant). Un cône (fusil à pompe) ou un jet (lance-flammes) ne
  se « recentre » pas : hors périmètre. Lance-torpilles / lance-missiles du RAW : aucun profil de zone
  aujourd'hui, à raccorder quand ils en auront un (même point d'accroche « point d'impact figé »).
- Tireur exo/drone lançant une grenade : non câblé aujourd'hui (`resolveGrenadeThrow:382`) ; hors lot.
- **Efficacité** : la protection dépend d'où se trouve le drone. Un drone proche du protégé attrape la
  grenade près de lui (avec 15 m de rayon le protégé reste dans le souffle) ; un drone lointain l'attrape
  plus tôt. C'est la conséquence directe de « au plus court », pas un défaut.

### 4.2 La moitié des dégâts (Q-A : le drone seul)
Appliquée **une seule fois, de façon générique**, dans `finalizeAoeResolution` (`:864-873`) sur la ligne
dont le `tokenId` = `aoe.interposedDroneTokenId`, **après** `mech.computeTargetDamage` (jamais dans un
mécanisme : le registre reste inchangé). Hypothèses à journaliser : la moitié porte sur les **dégâts bruts,
avant blindage/RD** du drone (`calcDroneDegatsNets`, `:268`), **arrondie à l'inférieur** (même convention
que `getCriticalSuccessBonus`, `polarisTestResolution.js:105`). Aucun autre protégé n'est concerné.

## 5. Lot 3 — CRD multi-drones (plafond et malus)
Compteur **persistant** (un `pendingMaps` en mémoire ne survit pas à un redémarrage) :
`combat_roster.interception_uses_this_turn smallint not null default 0`, remis à 0 dans le `update` en bloc
d'`endTurn` (`combatTurnEngine.js:752`) `[VÉRIFIÉ]`. Malus = `−1 × usages déjà faits ce Tour` sur le Seuil ;
au-delà de **4** : refus avec message (`crd_saturated`), jamais un échec silencieux.
- « Simultané » (RAW) est traduit « dans le même Tour » : simplification à journaliser (JOURNAL8).
- **CRD vs bouclier personnel** : un **champ explicite** sur la fiche (plafond de simultanéité ; NULL/1 =
  bouclier personnel), **jamais** une détection par nom ou par `charge_utile` (fallback interdit).
- Portée CRD : 10 m de l'armure (RAW) ; le bouclier personnel n'a pas de plafond au RAW (illimité, à écrire).

## 6. Ce que ce chantier ne fait PAS (dit clairement)
- Corps à corps : exclu par le RAW.
- Cascade vers un second protecteur après échec du premier.
- Interruption / rang d'Initiative de la réaction (`COMBAT REFERENCE.md:715`, « hors scope V1 »).
- Budget de programmes actifs `gestion_systemes` (LdB p.279, `COMBAT REFERENCE.md:656`) : non implémenté
  ailleurs non plus.
- Zones non circulaires (cône, jet) ; grenade lancée par un drone ou une exo.
- Coût en mouvement de l'interposition (gratuite, §3.3-2) et retour du drone à sa place après coup
  `[HYPOTHÈSE, non validée par Saar]` : il reste où il s'est interposé ; le MJ ou son prochain
  déplacement le replace.

## 7. Ordre de travail
Deux étapes structurelles, chacune en commit à part, **sans changement de comportement** : (0a) émetteur
de déplacement partagé (§3.3-2) ; (0b) option `destinationPredicate` (+ borne `maxCostM`) de la navigation, avec ses tests (§3.3-2). Puis
Lot 1 (tir) → validation jeu réel → Lot 2 (explosif, désormais le cas courant : les deux grenades sont à
minuterie par défaut) → validation → Lot 3 (CRD). Lot 2 et Lot 3 n'ont aucune dépendance entre eux. Chaque lot se clôt
séparément (règle 10 : PLAN archivé + `SYSTEME/COMBAT.md` + `SYSTEME/COMBAT_FLUX.md` §7.4 + ROADMAP +
JOURNAL8 + CHANGELOG à la clôture, **avant** d'écrire « CLOS »).

## 7bis. Avancement (2026-09-23) — étapes 0a et 0b faites, NON commitées
- **0b (fait, testé)** : `shared/world/gridCells.js` (`cellOfPoint`, `cellsCrossedBySegment`, `createSegmentCellPredicate`, 13 tests) ;
  `navigation.js` : option `destinationPredicate` + borne `maxCostM` sur `findNavigationPath` / `planWorldPath` (8 tests ajoutés,
  les 9 existants inchangés) ; relais dans `planBattlemapTokenMovement` (`worldMovementService.js`, sans test : demande la base).
  Suite complète `shared/**` : 630 / 630.
- **0a (fait, testé, périmètre réduit)** : `server/src/lib/tokenMovementEmitter.js` (`buildTokenMovedPayload`,
  `emitExecutedTokenMovement`, 5 tests) ; adopté par la Résolution de déplacement de combat (`socketCombatResolution.js`,
  message identique, ordre d’émission conservé). **Constat** : 8 sites construisent le même message `TOKEN_MOVED`
  (`routes/battlemaps.js`, `routes/tokens.js` ×2, `socketToken.js`, `socketEntity.js` ×2, `socketCombatResolution.js` ×2) avec des
  suppléments `worldMovement` différents. Seul le site de combat est migré (le seul que le drone imite) ; les 7 autres restent
  tels quels — consolidation possible plus tard, hors chantier.
- **Lot 1, tranche A (faite, testée)** : `shared/droneInterception.js` — noyau pur : `ineligibilityReason`, `screenCandidates`,
  `pickProtector`, `isInterposed`, `aimedAtProtected` (17 tests, dont les vraies marges de `resolveTestOutcome`). `attackKind`
  explicite obligatoire (jamais déduit). Suite `shared/**` : voir dernier passage.
- **Lot 1, tranches B, C, D (codées, NON testées en jeu, migrations NON validées sur la base)** :
  - B : `server/src/lib/droneInterceptionService.js` (`resolveProtectorInterposition`, `filterProtectorInterceptors`),
    `droneTelepilotState.js`, `criticalFailReroll.js` (extrait de `socketCombatHelpers.js`, réexporté),
    `services/droneInterceptionLinksService.js`.
  - C : migrations `357` (table), `358` (contraintes + index), `359` (catalogue Interception → `interception`) ;
    `vaultService.js` (`EXCLUDED_TABLES`) ; routes REST `GET|POST|DELETE /char-sheet/:id/drone/interception-targets` ;
    fiche drone (`DroneProtectionSection.jsx`, catégorie `interception` dans `DroneSheet.jsx` et `ExoComputerPanel.jsx`) ;
    clés `fr.json`.
  - D : `finalizeAssaultHitOutcome` (`attackKind: 'ranged'`) et `finalizeAssaultOutcome` (`attackKind` explicite, CaC drone →
    `'melee'`, 3 appelants mis à jour) ; `losService.redirectToInterceptor` retire les protecteurs éligibles.
  - Validé par : 649 tests `shared/**`, 187 tests serveur sans base (340 ignorés : base requise), lint + build client,
    chargement de tous les modules touchés. **Le service d'interposition lui-même n'est exécuté par aucun test** (il lit la
    base et le moteur monde) : validation en jeu réelle obligatoire.
  - **À faire avant jeu** : (1) dérouler les migrations 357-359 — test aller-retour dans une transaction annulée, script prêt
    dans le dossier temporaire, base injoignable au moment de l'écriture (Docker Desktop en pause) ; (2) validation en partie.
- **Non fait** : Lot 2 (explosif), Lot 3 (CRD).

## 8. Questions ouvertes (règle du jeu — c'est à Saar de trancher)
**Aucune question ouverte** : Q-A à Q-I sont tranchées (§2). Rappel de Q-I :
- **Q-I — « Un projectile qui traverse la case du protégé » active-t-il le drone ? Non (décidé).** Pour un **tir**, le
  déclencheur reste « le protégé est la cible du tir ». Le cas « le tir traverse sa case en visant
  quelqu'un derrière » est **déjà géré par la redirection existante** (`losService`, avant le jet) : elle
  fait du protégé la cible **quand la ligne passe à moins de 0,35 unité monde (≈ 0,5 m) de son centre** (rayon du profil par
  défaut, `visibility.js:53`), donc dans une bande étroite d'une case de 1,5 m. Étendre à « toute la
  case » changerait la règle de redirection **pour tout le monde** (un token occupe sa case entière), donc
  hors de ce chantier. *Recommandation : ne pas y toucher ici ; à traiter comme un chantier moteur séparé
  si tu le souhaites.* Pour une **grenade**, seul « le point visé est dans sa case » compte (une grenade
  qui survole une case n'y atterrit pas).

## 9. Recherche externe (consultée 2026-09-23)
- **midi-qol** (FoundryVTT) : réactions accrochées à des moments nommés du pipeline (`isAttacked` après le
  jet et avant l'évaluation, `isHit`, `isDamaged`), une réaction par round comptée à part (miroir du
  compteur CRD, Lot 3). Docs lues : README GitLab (résumé). **Code source non lu.**
- **rpg-toolkit** (Go) : pause/reprise d'un déroulé pour une réaction, séparation moteur/livre de règles.
  Docs d'architecture lues (partiel). **Code non lu.**
- Sources : `gitlab.com/tposney/midi-qol`, `github.com/tposney/midi-qol`,
  `github.com/KirkDiggler/rpg-toolkit` (`docs/architecture/overview.md`),
  `github.com/foundryvtt/dnd5e/wiki/Hooks`.
- Limite assumée : ce sont des inspirations de **forme** (accroche unique nommée, compteur de réactions,
  pause/reprise — déjà présente chez nous via `AWAITING_DAMAGE`), pas des modèles à recopier.

## 10. Restant à vérifier avant de coder
- Lot 1 : le **prédicat de candidature** (case traversée par le segment, hauteur compatible ; trajectoire
  qui change d'étage ou traverse un obstacle ; cases partielles des pièces à contour courbe, dont la dalle
  est un `footprint` découpé, `worldCompiler.js:776-781`) — pur, testable sur `shared/world` avant tout
  câblage. **Attention perf `[VÉRIFIÉ]`** : `findNavigationPath` ne borne **pas** sa recherche par le
  budget (le budget n'intervient qu'après, dans `planWorldPath`, `:577`) ; sans candidat atteignable la
  recherche parcourrait toute la carte. La variante à prédicat reçoit donc aussi une borne de coût
  (`maxCostM` = budget du drone) qui arrête l'expansion — à ajouter avec le prédicat, testée (« aucun
  candidat dans le budget » rend `null` sans explorer au-delà).
- Lot 1 : un drone volant/amphibie suit-il les mêmes règles de navigation ? (`mode_deplacement` est
  « purement narratif », décision Saar 2026-08-28, `movementBudgetService.js:162`) → traité comme un
  déplacement au sol tant que cette décision tient ; **[INCONNU]** si un drone aérien doit ignorer les murs.
- Lot 2 : `coord.mr` est déjà en portée au point de branchement (`:581-583`, même bloc) ; le test « vise le
  protégé » (§4.1-1) est purement géométrique (point visé ↔ position du protégé), sans calcul de zone.
- Lot 2 : cas où le **lanceur lui-même** est le protégé qu'il vise (auto-visée) : traité comme les autres
  (Q-E, aucune exception). Cas où le drone interposé est aussi celui du lanceur.
- Lot 2 : à l'explosion au Tour+1, si le drone a été détruit ou a quitté la zone, `interposedDroneTokenId`
  ne désigne aucune ligne de résultat : ne rien faire, jamais d'erreur.
- Lot 1 : le nouveau point le plus proche peut se trouver **derrière un obstacle plein** pour la
  trajectoire des projectiles mais atteignable pour le déplacement (mur bas, etc.) : le canal
  « projectiles » du moteur est distinct de « mouvement » (`rules/world.md`) — à vérifier que le
  point retenu est bien traversé par la ligne de tir réelle, sinon le rejeter.

## 7ter. Décisions de test en jeu (2026-09-24)
- **Option B (Saar)** : le décor (entités) ne bloque pas le drone qui s'interpose ; seuls les tokens occupent une case pour lui
  (`ignoreEntityOccupants` dans `planBattlemapTokenMovement` / `executeBattlemapTokenMovement`, réservé à ce cas). Motif : sur la
  carte de test, les 6 cases de la trajectoire étaient toutes occupées (tokens + décor) → « unreachable » à tort.
- **Le drone se déplace dès qu'il tente** (avant le Test), succès ou échec.
- **Chaque étape est dite au chat** (`COMBAT_SYSTEM_NOTICE`, clés `session.drone*` de `fr.json`) : motif d'inéligibilité, portée
  impossible, déplacement (ou « déjà en position »), résultat du Test avec les deux marges. Journal serveur : lignes `[DBG] interposition —`.
- Constat de test : un drone de Seuil 10 ne bat quasi jamais une attaque de marge > 10 (RAW) ; monter son Interception pour tester.
- **Tir raté (Saar, 2026-09-24) : le drone ne bouge pas.** C'est le comportement codé (l'interposition n'est appelée que sur un
  tir touché) ; confirmé au journal : tir raté MR −17 → aucune ligne `interposition`.
- **CODÉ 2026-09-24 (non retesté en jeu)** : `server/src/lib/droneDamageNotice.js` (+ test), `woundSeverityForDamage` (+ test),
  `resolveDroneIntegrityLoss` renvoie son résultat, message `session.droneDamaged*` aux 5 sites de `socketCombatHelpers.js`,
  `reportProtectedMiss` (tir raté sur protégé), compteur d'id côté `useSessionSocket.js` (couvre TOUTES les notices), clés `fr.json`.
  Reste : site AOE (`socketCombatAoe.js:269`) au Lot 2. Même faiblesse d'id (`clé-timestamp`) sur les messages de dés et de chat
  (`useSessionSocket.js`), non corrigée ici.
- **2ᵉ essai en jeu (2026-09-24, journal)** : tir touché MR 5 ; Drone AX déjà sur la trajectoire (coût 0 m, « déjà en position »),
  Test jet 3 / Seuil 10 → marge 3, non supérieure à 5 → échec d'interception, le tir touche Joueur Test. Conforme au RAW. Le
  message de dégâts d'un drone interposé n'a donc pas encore été exercé (drone à monter à Interception 30 pour le voir).
- **3ᵉ essai (chat, Saar 2026-09-24)** : deux messages se contredisaient (carte « réussi » / notice « rate son interception »
  quand le Test est réussi mais la marge insuffisante) → scindé en `droneInterceptTestFailed` / `droneInterceptOutmatched`.
  Et « Initiative ≤ 0 : Action reportée » apparaissait pour le drone à chaque combat : `buildTimelineEntries`
  (`combatTurnEngine.js`) déduisait le report de `resolution_snapshot != null`, or `drone_auto` pose
  `{ autoResolve: true }` → corrigé par un ensemble `carriedTokenIds` du report réel ; 2 tests ajoutés dans
  `combatTurnEngine.test.mjs` (base de test : écrits par le test lui-même, à lancer par Saar avec `--env-file`).
- **Trouvaille hors chantier** : `GET /api/char-sheet/<Jean Val-Jean, PNJ>/wounds` renvoie 403 au client de Joueur Test pendant la
  Résolution (3 fois, avant son tir) — le client d'un joueur lit les blessures du PNJ tireur. Sans lien avec le drone ; à
  transformer en ticket (`bug_tickets`), non investigué.
- **Chat trop muet sur les dégâts (Saar, 2026-09-24) — plan validé, analyse à charge faite.** Constat : un PNJ qui
  touche un drone (`resolveAssaultHitPnjDrone`) ne dit rien au chat (résultat seulement dans la fenêtre MJ) ; les autres cas
  (`resolveAttackHitDrone`, `resolveDamageConfirmDroneTarget`) donnent une carte incomplète, aucun ne dit le niveau de blessure.
  Il y a 6 sites de dégâts drone (693, 2005, 2240, 3112, 3926 de `socketCombatHelpers.js`, + `socketCombatAoe.js:269`).
  Décisions : (1) `resolveDroneIntegrityLoss` renvoie `{severity, newIntegrite, detruit}` et un constructeur unique de message
  `session.droneDamaged` est poussé PAR L'APPELANT (jamais émis en direct depuis la fonction : il passerait avant le message
  « s'interpose ») ; adopté aux 5 sites de `socketCombatHelpers.js`, le site AOE est repris au Lot 2 ; (2) l'échelle de gravité
  du drone (5/10/15/20/25, détruit ≥ 30) est un doublon de `BLESSURE_SEUILS_TABLE` (`shared/woundConstants.js`) : fonction pure
  partagée + test ; (3) bug trouvé : le client déduplique les messages système par `sys-<clé>-<timestamp>` (`sessionStore.addMessage`)
  → deux notices de même clé dans la même milliseconde (ex. deux drones inéligibles pour le même motif) se perdent : ajouter un
  identifiant unique côté serveur ; (4) message « tir raté sur un protégé, le drone n'intervient pas » aux deux points de tir
  raté (silencieux si pas de lien ou tir de contact). Le point « aucun drone n'intervient sur un touché » est déjà dit (motifs
  d'inéligibilité) et reste silencieux sans lien / cible = drone. Observation à ne pas corriger ici : le drone perd 1 d'intégrité
  à CHAQUE touche, même sous 5 de dégâts nets (le chat va le rendre visible) — à confronter au RAW (LdB p.82-88).
- **Premier essai réussi en jeu (2026-09-24, journal serveur)** : tir touché MR 7 sur Joueur Test protégé → Drone AX rejoint la
  trajectoire (7,24 m sur 25) → Test jet 8 / Seuil 10, MR 8 > 7 → s'interpose. Non vérifié à ce stade : dégâts effectivement
  encaissés par le drone (le journal ne les trace pas) et messages de chat (vus par Saar seulement).

## 7quater. Lot 2 — plan exact relu contre le code (2026-09-24)
Relecture de `socketCombatAoe.js` : les repères du §4 sont toujours bons (lancer `:548`, point d'impact figé `:580`,
séparation percussion/minuterie `:583`, écritures `jsonb_set` `:590`/`:621`, `finalizeAoeResolution` `:827`).
Écarts et compléments trouvés à la relecture :
1. **`isInterposed` doit exiger un Test RÉUSSI.** Contre un tir touché la marge d'attaque est ≥ 0, donc un Test raté (marge
   négative) ne passait jamais ; contre une grenade dont le Test de Coordination est RATÉ, la marge d'attaque est négative et un
   Test de drone raté « plus proche de 0 » passerait à tort. Signature → `isInterposed({ isSuccess, mr }, attackMr)`.
2. **Le service d'interposition se scinde** : un noyau commun (éligibilité, portée, déplacement, Test, messages) et deux
   entrées — le tir (`resolveProtectorInterposition`, inchangée pour les appelants) et la grenade
   (`resolveGrenadeInterposition`). Le noyau reçoit une trajectoire et un protégé, plus une « action de tir » : `gatherCandidates`
   et le Test cessent de lire `action.target_token_id`.
3. **« Vise son protégé »** : nouveau `listProtectedTokens(battlemapId)` (liens ⨝ tokens de la carte) puis `aimedAtProtected`
   (déjà écrit et testé au Lot 1) sur `aoe.intendedOrigin`.
4. **Persistance** : les deux écritures `jsonb_set` identiques (percussion / minuterie) passent par un seul constructeur
   `throwModifiersUpdate` qui ajoute `interposedDroneTokenId` quand il existe.
5. **Point d'impact** : après interposition, `resolvedOrigin` = position du drone après son déplacement (relue en base) ; l'entrée
   d'échelle et le marqueur 3D partent de là, sans autre changement.
6. **Moitié des dégâts** dans `finalizeAoeResolution`, sur les dégâts BRUTS de la ligne du drone, arrondie à l'inférieur
   (`halveExplosionDamage`, pur, testé) ; un drone absent de la zone à l'explosion (déplacé, détruit) : message, jamais d'erreur.
7. **Chat** (demande Saar) : « le drone attrape la grenade, elle tombera à ses pieds », variantes « zone » des messages
   d'échec (même clé + `context: 'zone'`), « le drone absorbe la moitié (X → Y) », « le drone n'est plus dans la zone »,
   et le message de dégâts drone (`buildDroneDamageNotice`) branché sur le site AOE resté en suspens.
8. **Hors lot, inchangé** : cône / jet (pas de recentrage), tireur exo/drone (non câblé), CRD (Lot 3).
Tests : `isInterposed` (nouvelle signature), `halveExplosionDamage`, `aimedAtProtected` (déjà là). Le service et le tronc AOE
n'ont pas de test automatique (base + monde) : retest en jeu par Saar (grenade à minuterie ET à percussion, drone gagnant et perdant).

### Analyse à charge du Lot 2 (2026-09-24) — le plan tient, avec 4 ajustements
Vérifié dans le code : (a) la ré-entrée du Tour+1 ne repasse pas par le bloc de lancer (garde `!aoe.resolvedOrigin`) ;
(b) `aoe` est relu depuis `combat_actions.modifiers` à la ré-entrée, donc `interposedDroneTokenId` persisté y revient (et dans le
contexte gelé d'un choix Chance) ; (c) le marqueur 3D et la reconnexion (`socket/index.js:202`) lisent `resolution_snapshot.resolvedOrigin`
→ `resolvedOrigin` doit être ajusté AVANT l'insertion de l'entrée d'échelle ; (d) `filterGrenadeFragHitTargets` n'exclut personne (le
drone à distance 0 est une cible normale) ; (e) `scattered` n'est utilisé nulle part côté client ; (f) segment nul (lancer sur sa
propre case) : `cellsCrossedBySegment` renvoie une case ; (g) un drone n'a jamais d'ouverture de choix Chance (aucun bruit de ce côté).
Ajustements : 1. la trajectoire d'une grenade est œil du lanceur → POINT D'IMPACT AU SOL (pas œil → œil comme le tir) ;
2. le changement de signature de `isInterposed` touche l'appel du Lot 1 et ses tests ; 3. en explosion, le drone est cherché par
`tokenId` dans les cibles finales : absent → message, jamais d'erreur ; 4. deux protégés dans la même case sont impossibles (les
tokens se bloquent entre eux) : on prend le premier trouvé, sans logique multi-protégés.
Hypothèses de règle à journaliser (JOURNAL8) : la moitié porte sur les dégâts BRUTS (RAW : « la moitié des dommages », avant
blindage/RD) ; la « marge de l'attaque » d'une grenade est celle de son Test de Coordination (`coord.mr`, négative si le lancer est
raté → tout Test de drone RÉUSSI la bat) ; l'interception se joue sur la trajectoire réelle (après dispersion).

### Lot 2 — CODÉ (2026-09-24), non retesté en jeu, non commité
Décisions de Saar : moitié des dommages BRUTS (arrondie à l'inférieur) ; lancer raté = facile à intercepter (marge négative) ;
interception sur la trajectoire réelle. Fichiers : `shared/droneInterception.js` (`isInterposed({isSuccess, mr}, attackMr)`,
`halveExplosionDamage`) + tests ; `lib/droneInterceptionService.js` (noyau `attemptInterposition`, entrées tir et
`resolveGrenadeInterposition`) ; `services/droneInterceptionLinksService.js` (`listProtectedTokens`) ; `socket/socketCombatAoe.js`
(hook entre le Test de Coordination et la séparation percussion/minuterie, `throwModifiersUpdate`, moitié des dégâts et messages dans
`finalizeAoeResolution`, message de dégâts drone) ; `fr.json` (variantes `_zone`, `droneAbsorbsHalf/Nothing`).
Vérifié : 710 tests ; rejeu lecture seule sur la carte de test (protégé trouvé si le point visé est dans sa case, pas une case plus
loin ; le drone atteint la trajectoire d'une grenade). NON couvert par un test automatique : le tronc AOE et le service (base + monde).

### Lot 2 — décision Saar 2026-09-24 (retest minuterie) : « vise son protégé » = distance, plus « case exacte »
Constat en jeu : le point visé (−1,38 ; 0,55) était à 1,43 m des pieds de Joueur Test mais dans la case voisine → aucun drone ne
réagissait (« viser les pieds de sa cible ne déclenche rien »). Décision : réglage `GRENADE_PROTECTION_AIM_RADIUS_M` (mètres,
horizontal, bornes comprises) dans `shared/droneInterception.js`, **valeur de départ 1,5 m**, à ajuster aux tests ; à consigner au
JOURNAL8 avec sa valeur finale. `aimedAtProtected` = distance (`horizontalDistanceBetweenWorldPointsM`) + même étage ; plusieurs
protégés dans le rayon = tous visés (leurs drones réagissent, le noyau retient le meilleur niveau). Les TIRS ne changent pas (Q-I).
Message « la grenade ne vise aucun protégé (visée à plus de X m de …) » quand des protégés existent sur la carte.
Remplace le « modèle à la case » de Q-F pour les grenades (§4.1-1 et §7quater).

### Retest grenade (Saar 2026-09-24, soir) — ce qui a marché, ce qui est corrigé, ce qui n'est pas du chantier
Marché : lancer MR 5 → grenade « visant Joueur Test (à moins de 1,5 m) » → Drone AX déplacé de 4,24 m → Test jet 17 / Seuil 10, raté →
« la grenade poursuit sa trajectoire », puis « grenade amorcée ». Branche « drone perd » validée en jeu. Restent à voir : drone qui
GAGNE (grenade à ses pieds, moitié des dégâts), percussion, explosion du Tour+1 avec drone interposé.
Corrigé : distances dites au chat arrondies à 2 décimales (`roundMeters`).
Constats HORS chantier (à ticketer, non corrigés ici) :
- fenêtre Chance PNJ « Catastrophe — Chance (PNJ) / Éviter la zone d'effet (Jean Val-Jean) » peu claire : le lanceur est dans son propre
  souffle (rayon 15 m, RAW : le lanceur n'est jamais exclu) et le titre « Catastrophe » est réutilisé pour un simple choix de Chance ;
- message serveur figé en français (règle i18n) « L'ordre a changé entre-temps… fermez-la » (`socketCombatResolution.js:304`) : Confirmer
  cliqué sur la fenêtre de modificateurs d'un token qui n'est plus le pas courant ;
- carte de durée d'étourdissement affichée « succès » (badge sans objet) ;
- **`queryTokensInShape` ne filtre aucun statut** : un token tagué « mort » (Baboulinet) reste cible d'une zone et reçoit une fenêtre de
  Chance — à traiter avec le chantier statut `dead` (`PLAN_BLESSURE_SIXIEME_LIGNE.md`, Lot 1b) ;
- 403 `GET /api/char-sheet/<PNJ>/wounds` côté client d'un joueur (déjà noté plus haut, aussi pour Baboulinet).
