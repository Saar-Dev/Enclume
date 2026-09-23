# PLAN_FORME_COLLISION_ENTITES.md — Forme de collision des entités (cercle → forme explicite)

> **CLOS 2026-09-23** — codé, 623 tests verts (`shared/**/*.test.mjs` + les 3 fichiers serveur
> touchés), **validé en jeu réel par Saar**. Deux passes d'analyse à charge indépendantes avant
> code (5 + 5 trous trouvés et corrigés, détail plus bas), **puis 3 trous supplémentaires trouvés
> par moi en codant** (aucun des deux agents ne les avait vus) et **1 régression trouvée en
> lançant les tests existants**, tous corrigés avant de considérer le chantier terminé — voir
> « Trouvailles du codage » en fin de document.

## Origine

Saar (2026-09-22) : « les caisses (entités interactives) sont mal délimitées : elles bloquent
complètement une action de déplacement d'un token posé à côté ». Confirmé par lecture de code ET
par des données réelles de la base locale (`enclumeBD`), pas supposé.

## Root cause [VÉRIFIÉ code + données réelles]

`entityOccupant()` (`server/src/services/worldMovementService.js:73-90`, autorité unique du profil
de collision d'une entité, réutilisée par `dynamicOccupantsFromRows` ET par `entities.js`) :

```js
const collider = state?.collider || {}
const width = Number(collider.width || geometry.width || 1) * scale
const depth = Number(collider.depth || geometry.depth || 1) * scale
return {
  ...
  actorProfile: {
    radius: Number(collider.radius ? collider.radius * scale : Math.max(width, depth) / 2),
    ...
  },
}
```

Cette forme (`{point, actorProfile:{radius, height}}`) est celle déjà utilisée pour les ACTEURS
(humanoïdes/drones, raisonnablement approximés par un cylindre vu du dessus). `entityOccupant`
réutilise la même interface par simplicité — une seule fonction de recouvrement
(`actorFootprintsOverlap`, `shared/world/spatialIndex.js:86-94`) pour tout ce qui occupe de
l'espace. Correct pour un objet à peu près carré, faux pour un objet allongé.

**Vérifié en base locale** (`entity_blueprints`, aucun `collider` configuré sur AUCUN blueprint
actuel — repli systématique sur `Math.max(width, depth) / 2`) :
- « Lot de caisses assorties » : `width=2.259m, depth=1.049m` → rayon de collision calculé = **1,13
  m**, alors que l'objet ne fait que 0,52 m du centre à son bord réel dans le sens de la
  profondeur. Un token à 1 m sur le côté étroit du pack — visuellement dans le vide — se fait
  bloquer comme s'il était dessus.
- Même défaut pour « Pack de caisses sous bâche » (`width=2.2, depth=0.92` → rayon 1,1 m).

**Rotation ignorée** : `entities.r` n'est lu nulle part dans `entityOccupant()`. Sans conséquence
pour un cercle (invariant par rotation) mais devient un bug actif dès qu'une forme orientée
(rectangle) est introduite si `r` n'est pas pris en compte.

**[CORRIGÉ v2, erreur trouvée par l'analyse à charge]** — `entities.r` n'a **PAS** la même
convention que `tokens.r`. Vérifié directement (4 sites indépendants et cohérents) :
`EntityMesh.jsx:103` (`(entity.r || 0) * (Math.PI / 2)`), `Editor3D.jsx:665`
(`(entity.r + 1) % 4`), `Editor3D.jsx:234`, `worldVisibilityService.js:42` — **`entities.r` est
0-3, incréments de 90°**, pas 0-7/45° comme `tokens.r`. Même nom de colonne, convention
différente. Ça change l'angle ET simplifie radicalement l'algorithme ci-dessous (§ Algorithme).

**Confirmé par Saar** : le catalogue va s'étendre à des formes hétérogènes — sous-marin (coque
allongée), lit, table, chaises, évier, bac (probablement rectangulaires) et **tonneau
(réellement cylindrique — le cercle est la forme CORRECTE pour lui, pas une approximation à
corriger)**. Un unique remplacement « cercle → rectangle » serait donc une deuxième
sur-simplification, pas une correction.

## Pourquoi le cercle a été choisi à l'origine

Pas un choix délibéré pour les entités : réutilisation de l'interface déjà existante pour les
acteurs (`actorProfile{radius,height}`), qui évite la gestion d'orientation qu'un rectangle
imposerait. Raisonnable pour un coffre ou un baril à l'époque où le catalogue ne contenait que des
objets ~carrés ; ne généralise pas aux packs allongés ni aux formes futures annoncées.

## Design retenu

Étendre le champ `collider` du blueprint — **déjà lu en premier par `entityOccupant`, déjà présent
dans le schéma JSONB, mais jamais peuplé par aucun blueprint actuel** (vérifié en base : zéro ligne
avec un `collider` non vide) — avec une forme explicite et extensible :

- `collider: { shape: 'circle', radius }` — cercle inchangé, test cercle-cercle existant
  (`actorFootprintsOverlap`), correct pour un tonneau ou une table ronde.
- `collider: { shape: 'rect', width, depth }` — nouveau test cercle-vs-rectangle **orienté**,
  utilise `entity.r` pour la rotation (jamais lu aujourd'hui — corrigé dans le même geste).
- **Défaut si `collider` absent** (tout le catalogue actuel aujourd'hui) : `rect` avec
  `width`/`depth` déjà dérivés de `geometry.width`/`geometry.depth` — strictement plus sûr que le
  cercle actuel pour la quasi-totalité du catalogue (caisses, futur lit/table/chaises/évier/bac
  sont tous plus proches d'un rectangle que d'un cercle). Un tonneau resterait testé comme un
  rectangle (sur-conservateur, jamais cassé) tant que personne n'a explicitement configuré
  `shape:'circle'` sur son blueprint.
- Le discriminant `shape` reste ouvert à une **capsule** (deux demi-cercles + un rectangle) pour un
  sous-marin ou un tonneau couché — **documenté ici comme extension V2, pas construit maintenant**
  (Invariant projet : le V1 définit le V2, ne l'enterre pas).

## Algorithme — révisé v2, plus simple que la v1

**v1 (écartée)** proposait un test cercle-vs-rectangle orienté par trigonométrie générale (repère
local du rectangle). **Devenu inutile** une fois la convention `entity.r` corrigée : avec 4
orientations possibles seulement (0/90/180/270°), un rectangle d'entité est **toujours aligné aux
axes du monde** — jamais en diagonale. Une rotation de 90°/270° échange simplement largeur et
profondeur effectives ; il n'existe pas d'angle intermédiaire à gérer.

Conséquence directe : **aucune trigonométrie nécessaire, dans aucun des deux cas** —
1. **Cercle (acteur) vs rectangle (entité)** : clamp axis-aligned classique (le cas particulier
   trivial du cas général, sans rotation à défaire) — `closestX = clamp(circleX, rectMinX,
   rectMaxX)`, idem Z, puis distance de ce point au centre du cercle comparée au rayon.
2. **Rectangle vs rectangle** (cas trouvé par l'analyse à charge, atteignable via `entities.js` au
   placement/déplacement d'une entité elle-même — voir § Fichiers touchés) : les deux rectangles
   étant toujours axis-aligned, c'est un test de chevauchement de boîtes AXIS-ALIGNED ordinaire —
   **`boundsIntersect` (`spatialIndex.js:40-46`) déjà existant convient tel quel**, pas de nouvelle
   fonction à écrire pour ce cas.

**Largeur/profondeur effectives** (échangées sur quart de tour impair, patron déjà existant et
directement réutilisé — pas réinventé) : `worldVisibilityService.js` (`dynamicOccludersFromEntities`,
`quarterTurns = Math.trunc(entity.r) % 4`, swap width/depth si tour impair) fait déjà exactement ce
calcul pour l'occlusion LOS. `entityOccupant()` doit appliquer le même calcul pour l'occupation —
une seule formule de swap, réutilisée, pas dupliquée une troisième fois.

## Fichiers touchés (v2, complétée après analyse à charge)

- **`shared/world/spatialIndex.js`** :
  - `normalizeActorProfile` (lignes 56-65) — **trou le plus sérieux trouvé par la revue, absent de
    la v1**. Cette fonction `deepFreeze({radius, height, maxStepHeight})` un profil et **jette
    silencieusement tout autre champ** — elle est appelée par `actorBoundsAt` (bounds
    broad-phase), `segmentBlockers` (swept bounds), `canOccupy` ET `actorFootprintsOverlap` :
    absolument tous les points d'entrée de collision. Un profil `{shape:'rect', halfWidth,
    halfDepth}` sans `radius` retomberait silencieusement sur `radius: 0.35` par défaut pour le
    broad-phase — AABB beaucoup trop petite, cassant l'invariant documenté ligne 407-411 (« le
    broad-phase reste un sur-ensemble garanti, aucun faux négatif possible »). **Fix retenu** :
    étendre `normalizeActorProfile` pour accepter `shape`/`halfWidth`/`halfDepth` en plus de
    `radius`/`height`/`maxStepHeight` (jamais les jeter) ; pour un profil `rect`, dériver un
    `radius` "enveloppe" = demi-diagonale (`Math.hypot(halfWidth, halfDepth)`, garanti ≥ tout point
    du rectangle) utilisé UNIQUEMENT par le broad-phase (`actorBoundsAt`) — conservateur par
    construction, jamais un faux négatif. Le narrow-phase (`actorFootprintsOverlap`) utilise
    `shape`/`halfWidth`/`halfDepth` quand présents, sinon le comportement cercle-cercle actuel
    inchangé.
  - `actorFootprintsOverlap` : dispatch selon la forme de CHAQUE occupant — cercle-cercle
    (existant, inchangé), cercle-rectangle (clamp axis-aligned, § Algorithme), rectangle-rectangle
    (réutilise `boundsIntersect` existant, § Algorithme — cas trouvé par la revue, voir point
    suivant).
- **`server/src/routes/entities.js`** (lignes ~157, ~283, trouvé par la revue, absent des
  « Fichiers touchés » de la v1) : `canOccupy(candidateOccupant.point, candidateOccupant.actorProfile,
  ...)` y est appelé avec le profil de l'ENTITÉ candidate elle-même comme premier argument (rôle
  "acteur" de la fonction) — poser/déplacer une entité rectangulaire à côté d'une autre entité
  rectangulaire est donc un vrai chemin rectangle-vs-rectangle atteignable aujourd'hui, pas
  seulement acteur-vs-entité. Couvert par le cas 2 de l'algorithme révisé (boîtes axis-aligned),
  aucune fonction supplémentaire nécessaire une fois `normalizeActorProfile`/
  `actorFootprintsOverlap` corrigés ci-dessus.
- **`server/src/services/worldMovementService.js`** (`entityOccupant`) : lit `collider.shape` +
  largeur/profondeur effectives (échangées selon `entity.r`, § Algorithme), construit le bon
  profil. **Corrige aussi la convention d'origine** (`geometry.origin`/`floor-center` vs coin,
  trouvé par la revue — sans conséquence pour un cercle symétrique, mais un rectangle a besoin de
  son centre réel pour que le clamp axis-aligned soit juste) : réutilise le calcul déjà existant
  dans `worldVisibilityService.js` (`centered = origin === 'floor-center' ...`), pas une
  troisième formule.
- **`server/src/services/worldForcedMovementService.js`** (lignes 120-129, **deuxième autorité de
  profil de collision trouvée par la 1ʳᵉ revue, absente de la v1** ; **intégration précisée après
  la 2ᵉ revue, qui a trouvé le remplacement littéral silencieusement cassant**) :
  `entityProfile()` locale, indépendante de `entityOccupant()`, avec un repli encore plus faux
  (ignore `geometry.width`/`depth`, retourne un rayon fixe de 0,5 m pour toute entité sans
  `collider` configuré — c'est-à-dire toutes aujourd'hui). Violation de l'invariant projet « une
  propriété physique = une autorité unique » (`AGENTS.md` §3), préexistante à ce plan mais qu'il
  doit corriger puisqu'il touche directement ce domaine.
  **Fix, 3 corrections précises (vérifiées contre le code réel, pas seulement écrites)** :
  1. La requête ligne 156 (`.select('id', 'states')`) **ne charge jamais `geometry`** — confirmé.
     `entityOccupant()` en a besoin pour dériver width/depth quand `collider` est vide (100 % du
     catalogue actuel). Ajouter `'geometry'` à ce `.select(...)`, sinon chaque entité retomberait
     sur `width=depth=1` codé en dur dans `entityOccupant`, peu importe sa vraie taille — un bug
     différent, pas meilleur que l'actuel. Ce chargement affecte aussi `dynamicOccupantsFromRows
     (tokens, entities)` (ligne 175, réutilise le même tableau `entities`) — donc tous les
     occupants-entités de ce flux, pas seulement celle qu'on pousse.
  2. `entityOccupant()` retourne un objet **enveloppé** `{id, kind, point, actorProfile:{...}}`,
     pas un profil plat — confirmé. `resolveRigidPairSteps`/`canOccupy`/`isSegmentClear` attendent
     un profil plat `{radius, height, maxStepHeight}` à la racine (c'est ce que rend l'actuel
     `entityProfile()`). Un remplacement littéral (« faire pointer vers `entityOccupant()` »)
     passerait l'enveloppe entière là où un profil plat est attendu — `normalizeActorProfile`
     lirait `input.radius === undefined` et retomberait **silencieusement** sur le défaut 0,35 m
     (régression silencieuse, pas un crash qui alerterait). Utiliser explicitement
     `entityOccupant(entity)?.actorProfile`, jamais l'objet retourné seul.
  3. `entityOccupant()` retourne `null` si l'état courant de l'entité n'est pas bloquant ;
     l'actuel `entityProfile()` local ne retourne jamais `null`. Aucun chemin géré aujourd'hui pour
     un profil null dans `resolveRigidPairSteps`/`executeBattlemapRigidPairMovement` — à trancher
     au codage (repli conservateur : traiter comme non-bloquant/skip du test de dégagement, jamais
     un throw qui casserait un déplacement légitime).
- Tests : `shared/world/spatialIndex.test.mjs` — cercle-rectangle axis-aligned, cercle-rectangle
  avec swap largeur/profondeur (`r` impair), rectangle-rectangle (cas `entities.js`), non-régression
  cercle-cercle (acteur vs acteur, acteur vs entité-cercle), et un cas broad-phase (vérifier qu'une
  entité rectangle à la limite du rayon enveloppant reste bien candidate avant le narrow-phase).
  **`server/src/services/worldMovementService.test.mjs`** (trouvé par la 2ᵉ revue, absent de la
  v2) : deux assertions figent en dur l'ancienne formule buggée — ligne 28
  (`occupants[0].actorProfile.radius === 1` pour `collider:{width:2,depth:1}`, soit
  `max(2,1)/2`) et lignes 61-62 (`occupant.actorProfile.radius === 1.5` pour
  `geometry:{width:2,depth:1}` à l'échelle 1.5). Les deux cassent dès que la formule change — à
  migrer vers les nouvelles valeurs attendues (profil `rect` avec largeur/profondeur effectives),
  pas seulement des tests neufs à ajouter à côté.
- **Construction des bounds du cas rectangle-vs-rectangle (§ Algorithme, précisé après la 2ᵉ
  revue)** : `boundsIntersect` est un vrai test 3D et convient, mais les bounds de CHAQUE occupant
  doivent être construites explicitement à partir de son centre réel (post-swap rotation,
  post-correction d'origine) ± demi-largeur/demi-profondeur, `min.y = feet.y`/`max.y = feet.y +
  height` — **jamais** `actorBoundsAt` (qui donnerait la boîte carrée enveloppe/demi-diagonale,
  beaucoup trop permissive pour un test narrow-phase, correcte seulement pour le broad-phase).
- Aucune migration : `collider` est un JSONB déjà existant du blueprint, jamais peuplé — rien à
  migrer, seulement à commencer à le renseigner (manuellement ou via un futur outil — absence
  confirmée par la revue : aucun chemin de code ne permet aujourd'hui de le configurer, une
  écriture manuelle en base sera nécessaire pour marquer un tonneau `shape:'circle'`).

## Invariant

Un acteur (token, humanoïde/drone/exo) reste toujours modélisé comme un cercle — ce plan ne touche
jamais ce cas. La forme d'une entité est une donnée explicite du blueprint, jamais déduite de sa
`category` (vérifié en base : les catégories du catalogue actuel, ex. `futuristic_tables_chairs`,
mélangent des formes différentes — pas un signal fiable). **Une seule autorité pour le profil
d'occupation d'une entité (`entityOccupant`) — renforcé par ce plan**, pas seulement inchangé : la
duplication trouvée dans `worldForcedMovementService.js` (§ Fichiers touchés) est supprimée au
passage, pas laissée de côté.

## Hors périmètre (V1)

- Forme capsule (sous-marin, tonneau couché) — documentée ci-dessus, pas codée.
- `collider.offset` (`{x,y,z}`, trouvé par la 2ᵉ revue) — déjà utilisé par
  `dynamicOccludersFromEntities` (occlusion/LOS, `worldVisibilityService.js:47-50`) mais pas porté
  par `entityOccupant()` dans ce plan. Sans conséquence aujourd'hui (aucun blueprint ne configure
  `collider`, `offset` compris) mais c'est une deuxième divergence entre les deux systèmes qui
  consomment le même schéma `collider` — notée explicitement plutôt que laissée invisible.
- UI d'édition du `collider` par blueprint (pour qu'un auteur de catalogue marque explicitement un
  tonneau comme cercle) — le correctif atterrit avec un défaut `rect` sûr pour tout le catalogue
  existant ; une UI de configuration peut suivre séparément, non bloquante pour corriger le bug
  remonté.
- `docs/Old/PLAN_PLACEMENT_TOKEN_MJ.md` (placement MJ non validé, CLOS) — bug trouvé dans la même session,
  indépendant techniquement de celui-ci (l'un est un problème de validation de placement, l'autre
  un problème de forme géométrique de collision).

## Analyse à charge (2026-09-22) — verdict et suite

Agent indépendant, sans le contexte de cadrage — 5 points soulevés, tous traités dans cette v2 :
1. Formule de rotation fausse (`/4` au lieu de `/2`) — **corrigée**, vérifiée moi-même contre
   `EntityMesh.jsx:103` avant d'accepter.
2. `normalizeActorProfile` jette silencieusement les champs de forme, casserait le broad-phase —
   **corrigée** (§ Fichiers touchés).
3. Rectangle-vs-rectangle atteignable via `entities.js`, non couvert par la v1 — **corrigée**,
   et simplifiée par la correction de rotation (boîtes axis-aligned, pas de SAT).
4. Deuxième autorité de profil de collision dans `worldForcedMovementService.js` — **corrigée**,
   vérifiée moi-même (lignes 120-129) avant d'accepter.
5. Convention d'origine (`floor-center` vs coin) non gérée pour un rectangle — **corrigée**
   (réutilise le calcul déjà existant de `worldVisibilityService.js`).

**Reste légitimement ouvert** (non tranchable par lecture de code, l'agent l'a aussi noté) : la
fidélité de `geometry.width`/`geometry.depth` à l'emprise réelle au sol pour CHAQUE blueprint du
catalogue — ne se vérifie qu'à l'usage/en jeu réel, pas par avance.

**Ordre de fusion avec `docs/Old/PLAN_PLACEMENT_TOKEN_MJ.md`** (CLOS) : les deux plans touchaient
`worldMovementService.js` mais des fonctions différentes (`resolveBattlemapPlacement` vs
`entityOccupant`) — pas de conflit structurel attendu, simple risque de diff qui se chevauche si
codés en parallèle plutôt qu'à la suite.

## Trouvailles du codage (2026-09-23) — au-delà des deux analyses à charge

Ni la 1ʳᵉ ni la 2ᵉ passe n'avait détecté ces points — trouvés en implémentant, par grep exhaustif
systématique plutôt qu'en corrigeant un site à la fois :

1. **`loadBattlemapDynamicOccupants` (`worldMovementService.js`) ne sélectionnait jamais
   `entities.r`.** C'est la fonction la PLUS utilisée du moteur monde pour charger les occupants
   dynamiques (pathfinding, placement, déplacement de tokens — `resolveBattlemapPlacement`,
   `planBattlemapTokenMovement`, `executeBattlemapTokenMovement` en dépendent tous). Sans ce
   correctif, aucune entité rectangulaire tournée n'aurait jamais son échange largeur/profondeur
   appliqué dans le chemin le plus emprunté du jeu réel — bien plus grave que les deux sites déjà
   identifiés par les revues (`entities.js`, spécifiques à la pose/au déplacement d'UNE entité).
2. **`entities.js` (création ET déplacement d'entité)** : les deux candidats testés avant écriture
   (`candidateOccupant = entityOccupant({...})`) ne transmettaient pas `r` non plus — un
   commentaire existant affirmait explicitement « r n'entre pas dans le test, le rayon circulaire
   ne dépend jamais de la rotation », vrai avant ce plan, faux depuis. Corrigé aux deux sites
   (création : `r ?? 0`, identique à ce qui est écrit en base juste après ; déplacement : `nextR`
   calculé sur le même patron que `nextPosX/Y/Z` déjà existant), commentaire mis à jour.
3. **Régression trouvée en lançant les tests existants** (pas par une revue) :
   `worldForcedMovementService.test.mjs` avait un test qui comptait implicitement sur l'ancien
   défaut `entityProfile = {}` (profil générique appliqué même sans le préciser) pour vérifier
   qu'un occupant bloque l'entité poussée. En changeant le défaut vers `null` (§ point 4.3, « aucun
   test pour une entité non bloquante »), ce test a cassé. Corrigé en rendant le profil explicite
   dans le test (`genericEntityProfile`) plutôt qu'en réintroduisant un défaut implicite fragile —
   plus un nouveau test dédié qui vérifie spécifiquement le comportement `null`.

**Leçon retenue** : deux analyses à charge indépendantes et rigoureuses ont quand même laissé
passer 3 sites réels + 1 régression — pas parce qu'elles étaient mal faites, mais parce que
`entity.r`/`entityProfile` sont consommés à de nombreux points d'entrée dispersés, et qu'un grep
exhaustif au moment d'écrire le code (pas seulement au moment de le concevoir) reste nécessaire
même après un cadrage très soigné. Confirme la valeur de lancer la suite de tests complète
(`node --test 'shared/**/*.test.mjs'` + les fichiers serveur touchés) avant de considérer un
chantier fini, pas seulement les tests qu'on vient d'écrire soi-même.

## Validation

**Testé** : `node --check` sur les 4 fichiers serveur/partagés touchés, 623 tests verts
(`shared/**/*.test.mjs` complet + `worldMovementService.test.mjs` +
`worldForcedMovementService.test.mjs` + `worldVisibilityService.test.mjs`, 0 échec). **Confirmé
fonctionnel en jeu réel par Saar (2026-09-23)** : un token peut se tenir à côté du côté étroit d'un
pack de caisses sans être bloqué, reste bloqué s'il se tient dessus ou contre le côté large.
**Données** : aucune migration — `collider` est un JSONB déjà existant, toujours non peuplé (le
défaut `rect` couvre tout le catalogue actuel).
**Retour arrière** : `git revert` du commit applicable, aucune dépendance externe.
