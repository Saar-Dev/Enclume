# BILAN_PORTE — Les portes : état réel du code
> 2026-09-26 — Bilan analytique, **aucun code modifié**.
> Responsabilité unique : constater pourquoi une porte n'est pas utilisable aujourd'hui (ouvrir/fermer,
> traverser, positions/animations). Ce n'est pas un plan d'implémentation : chaque correctif listé en
> §6 fera l'objet de son propre plan, un bug à la fois.

---

## 0. Méthode et limites

- Lecture du code source uniquement (client + serveur + shared). Fichiers lus : `EntityMesh.jsx`,
  `EntityBuilderTab.jsx`, `EntityInstancePanel.jsx`, `RadialMenu.jsx`, `SessionPage.jsx`,
  `Canvas3D.jsx`, `Editor3D.jsx`, `entityStore.js`, `useEntitySocket.js`, `pathfinder.js`,
  `socketEntity.js`, `socketToken.js`, `socketCombatResolution.js`, `redis.js`,
  `routes/entities.js`, migrations `41_entity_blueprints.js`/`42_entities.js`, `combatSections.js`,
  `docs/SYSTEME/ENTITES.md`, `.claude/rules/entities.md`.
- **Base de données non accessible depuis cet environnement** : le contenu réel des blueprints
  "porte" (nombre d'états, `is_blocking` stocké, GLB ou voxel) n'a pas été consulté.
- Rien n'a été instrumenté ni exécuté. Conformément à `CLAUDE.md`, tout constat ci-dessous est donc
  **`[HYPOTHÈSE]`** (lu dans le code), sauf mention `[INCONNU]`. Aucun n'est `[VÉRIFIÉ]`.
- `docs/REGLES/REGLESYSCOMBAT.md` non lu dans cette session : rien ici ne tranche une règle de combat.

---

## 1. Constat de départ : il n'existe pas d'objet « porte » dans le code

Aucune occurrence de `door`/`porte` comme concept dans `client/src`, `server/src` ou `shared/`. Une
porte est une **entité générique** (Chantiers 9C–9E) : un `entity_blueprints` créé à la main dans
l'Atelier du MJ, avec :

| Champ blueprint | Contenu (migration 41 + `EntityBuilderTab.jsx:294-327`) |
|---|---|
| `geometry` | `{ width, height, depth, faces }` — toujours une boîte (`BoxGeometry`) |
| `glb_url` | modèle GLB optionnel (remplace la boîte) |
| `states[]` | `{ id, name, is_blocking, is_transparent, visual_override: { opacity, face_overrides } }` |
| `interactions[]` | `{ id, action_label, skill_id, attribute_id, difficulty_dc, required_state_ids, target_state_id, range }` |

Une instance posée (`entities`) porte `current_state_id`. « Ouvrir » ou « Fermer » est donc une
interaction qui fait passer `current_state_id` d'un état à un autre. Toute la mécanique de la porte
dépend de ce que contiennent ces états et ces interactions.

### Flux actuel d'une interaction (lu de bout en bout)

1. Survol de l'entité → icône ⚙ (`EntityMesh.jsx:85,169,183,300`).
2. Clic → `handleEntityClick` filtre les interactions par état courant (`SessionPage.jsx:371`),
   ouvre le menu radial ou lance l'action directement.
3. Joueur → `ENTITY_ACTION_REQUEST` ; MJ → `ENTITY_ACTION_GM_DIRECT` (`SessionPage.jsx:310-341`).
4. Serveur : sans compétence ni attribut → résolution directe ; sinon arbitrage MJ + jet 1d20
   (`socketEntity.js:62-331`).
5. Succès → `resolveEntityState` : `current_state_id = target_state_id`, maintenance Redis
   (`collisionUpdateEntityState`), broadcast `ENTITY_UPDATED` (`socketEntity.js:24-55`).
6. Client → `updateEntity` (`Canvas3D.jsx:495-504`) → `EntityMesh` relit l'état : **seules
   l'opacité et les textures de faces changent** (`EntityMesh.jsx:25,32,221-224`).

Le tuyau d'état fonctionne donc de bout en bout en théorie. Les problèmes sont dans ce qui l'alimente
(l'éditeur), dans ce qui le consomme (collision, pathfinding) et dans ce qu'il sait représenter (aucune
position ni animation).

---

## 2. Symptôme A — les joueurs ne peuvent pas ouvrir/fermer

**A1. Une interaction sans « état requis » coché n'apparaît jamais.** `[HYPOTHÈSE]`
Le filtre est `i.required_state_ids.includes(currentStateId)` (`SessionPage.jsx:371` et `:755`). Une
liste vide signifie donc « jamais disponible », pas « toujours disponible ». L'éditeur crée chaque
interaction avec `required_state_ids: []` (`EntityBuilderTab.jsx:252`) : tant que le MJ ne coche pas
explicitement les états, l'interaction reste invisible.

**A2. Un blueprint sans état n'expose aucune interaction, mais affiche quand même l'icône ⚙.**
`[HYPOTHÈSE]`
`hasInteractions` compte les interactions du blueprint sans filtre (`EntityMesh.jsx:85,183`), alors
que le menu filtre par état (A1). Avec 0 interaction disponible et un joueur, `handleEntityClick`
ouvre un menu radial vide (`SessionPage.jsx:384`, `RadialMenu.jsx:47`). L'utilisateur voit une icône
qui ne fait rien.

**A3. Confusion entre l'`id` d'un état et sa position dans la liste.** `[HYPOTHÈSE]`
- L'éditeur crée un état avec `id: prev.states.length` (`EntityBuilderTab.jsx:193`). Supprimer un état
  ne renumérote rien (`:204-214`) : on obtient par exemple `[{id:0},{id:2}]`, et un ajout ultérieur
  peut produire un id en double.
- Le serveur écrit `current_state_id = interaction.target_state_id`, c'est-à-dire un **id**
  (`socketEntity.js:38`) ; le panneau MJ écrit aussi un id (`EntityInstancePanel.jsx:239-242`).
- Mais tous les consommateurs lisent `current_state_id` comme un **index** : `stateList[entity.
  current_state_id]` (`EntityMesh.jsx:25`), `states[e.current_state_id]` (`redis.js:67,149`).
- Tant que les ids valent leurs index (aucune suppression), c'est invisible. Après une suppression
  d'état, la porte affiche et bloque selon le mauvais état, ou retombe sur `states[0]` (PE11). Le
  commentaire de la migration 42 (« index entier dans states[] ») et le piège PE7 décrivent un index,
  alors que le code écrit un id.

**A4. Changer l'état depuis le panneau MJ n'est pas diffusé aux joueurs.** `[HYPOTHÈSE]`
`EntityInstancePanel` fait un `PUT /entities/:id` (collision Redis correctement mise à jour,
`routes/entities.js:189-200`), met à jour **le store local du MJ**, puis émet `ENTITY_UPDATED` avec
`{ entityId, gm_only }` seulement (`EntityInstancePanel.jsx:112`). Le serveur relaie ces seuls champs
(`socketEntity.js:775-778`). Les joueurs ne reçoivent jamais le nouveau `current_state_id` : la porte
reste fermée chez eux jusqu'à un rechargement.

**A5. Le serveur ne revalide ni l'état requis ni la portée.** `[HYPOTHÈSE]`
`ENTITY_ACTION_REQUEST` vérifie le personnage, l'entité et l'interaction, mais pas
`required_state_ids` ni `range` (`socketEntity.js:62-104`). La portée n'est testée côté client que
pour le déplacement d'entité (`RadialMenu.jsx:52-60`) : on peut ouvrir une porte depuis l'autre bout de
la carte. Ce n'est pas bloquant pour « ouvrir », mais c'est un trou de validation.

**A6. En combat, aucune action ne permet d'ouvrir une porte.** `[HYPOTHÈSE]`
L'action « Interagir — ouvrir une porte… -3 à -5 » existe dans la liste, mais `active: false, hint:
'sprint suivant'` (`combatSections.js:133`).

**A7. Personnage utilisé pour le jet.** `[HYPOTHÈSE]`
À défaut d'un personnage appartenant au joueur, le code prend le premier personnage visible de la
campagne (`SessionPage.jsx:324-325`). Le serveur rejette ensuite la requête (`socketEntity.js:69`,
`character.user_id !== user.id`) : cela échoue sans aucun message pour le joueur. Le cas reste
marginal, mais il donne le même symptôme : « je clique et rien ne se passe ».

---

## 3. Symptôme B — on ne peut pas traverser

**B1. Aucune porte créée dans l'Atelier n'est jamais bloquante.** `[HYPOTHÈSE]`
À la sauvegarde, chaque état est écrit avec `is_blocking: false, is_transparent: false` en dur
(`EntityBuilderTab.jsx:294-297`), et aucun champ UI ne permet de changer ces valeurs (seule
occurrence client de `is_blocking` dans l'éditeur). Fermée ou ouverte, la porte est absente de la
collision map Redis.

**B2. Un blueprint sans état est bloquant en permanence.** `[HYPOTHÈSE]`
`resolveIsBlocking` et `buildCollisionMap` retombent sur `is_blocking ?? true` quand l'état est
introuvable (`redis.js:68,150`). Une porte sans état est posée dans Redis et n'en sort jamais, puisque
aucune interaction ne peut changer son état (A1/A2).

**B3. L'empreinte de collision fait toujours une seule case.** `[HYPOTHÈSE]`
La clé Redis est `pos_x:pos_y:pos_z` (`redis.js:70,158`), quels que soient `width`/`height`/`depth` et
la rotation `r`. Une porte de 2 de haut ou de 2 de large n'occupe qu'une case de collision.

**B4. Le déplacement libre (hors combat) ignore toute collision.** `[HYPOTHÈSE]`
Le glisser-déposer d'un token fait un `PUT /tokens/:id` direct (`Canvas3D.jsx:806-822`) ; le
`TOKEN_MOVE` WS ne vérifie rien non plus (`socketToken.js:11-43`). C'est une téléportation : aucune
porte, aucun mur ne bloque.

**B5. En combat, le chemin ignore les entités et le serveur ne vérifie que l'arrivée.** `[HYPOTHÈSE]`
- L'A* client reçoit une liste d'entités vide : `findPath(voxels, tokens, [], …)`
  (`Canvas3D.jsx:646`, commentaire « Callers pass [] for V1 », `pathfinder.js:94-95`).
- Même alimenté, `pathfinder.js:97` lit `e.state?.is_blocking` : `entities.state` est le JSONB libre
  de notes MJ (migration 42). La bonne source est `blueprint.states[current_state_id].is_blocking`.
- Le serveur teste uniquement la case d'arrivée, plus une case de repli (`isCellFree`,
  `socketCombatResolution.js:214-252`). Il ne teste pas les cases traversées.

### Écart avec le symptôme signalé — `[INCONNU]` `[DBG-PORTE1]`

D'après le code, **une porte n'empêche presque jamais de passer**, au contraire : c'est l'inverse de
ce qui est signalé. Le seul cas de blocage lisible est B2 (blueprint sans état) combiné à un
déplacement **de combat** dont l'**arrivée** est la case de la porte (`COMBAT_RESOLVE_MOVE_BLOCKED`).
Traverser la case pour s'arrêter au-delà passe quand même.

Le symptôme n'est donc pas expliqué par la lecture. Avant toute analyse supplémentaire, il faut
documenter les conditions de reproduction :
1. Hors combat (glisser-déposer) ou en combat (déplacement déclaré) ?
2. Destination sur la case de la porte, ou au-delà ?
3. Message « déplacement bloqué/partiel » affiché ?
4. Contenu du blueprint en base :
   `SELECT label, glb_url, states, interactions FROM entity_blueprints WHERE label ILIKE '%porte%';`
5. Une porte posée dans une ouverture de mur : les voxels de part et d'autre, et sous la porte, sont-ils
   bien vides ou pleins ?

Instrumentation proposée : un log `[DBG-PORTE1]` dans `isCellFree` (`socketCombatResolution.js:215`)
qui indique la cellule testée et le contenu Redis trouvé (`type`/`id`).

---

## 4. Symptôme C — positions ouverte/fermée et animations inutilisées

**C1. Le modèle de données ne sait pas représenter une position.** `[HYPOTHÈSE]`
`visual_override` ne contient que `opacity` et `face_overrides` (migration 41,
`EntityBuilderTab.jsx:297`). Il n'y a ni rotation, ni translation, ni pivot, ni clip par état. Une porte
voxel ne peut donc que **changer de texture ou de transparence** : pas de battant qui pivote, pas de
panneau qui coulisse.

**C2. Les clips d'animation des GLB ne sont jamais lus.** `[HYPOTHÈSE]`
`EntityMeshGlb` ne récupère que `scene` de `useGLTF(glbUrl)` (`EntityMesh.jsx:92`). Aucune occurrence
de `useAnimations`, `AnimationMixer` ou `.animations` dans `client/src`. Les animations « ouvrir » et
« fermer » d'un GLB de porte sont chargées puis ignorées, et rien ne relie un clip à un état.

**C3. Plusieurs instances du même GLB partagent un même objet 3D.** `[HYPOTHÈSE]`
`useGLTF` met en cache une seule `scene` par URL, montée telle quelle par `<primitive object={scene}/>`
(`EntityMesh.jsx:144`). `SkeletonUtils` est importé mais jamais utilisé (`:5`) : il n'y a aucun
clonage. Un objet Three.js n'a qu'un parent : **deux portes du même modèle ne peuvent pas s'afficher
en même temps**, et les matériaux sont mutés en place (`:95-109`), donc l'opacité d'une instance
s'applique à toutes. En plus, la transparence n'est jamais remise à `false` quand l'opacité revient à 1
(`:101-104`). À observer en navigateur pour passer à `[VÉRIFIÉ]`.

**C4. Aucune transition.** `[HYPOTHÈSE]`
Le seul interpolateur existant porte sur la position de l'entité entière (lerp 300 ms,
`EntityMesh.jsx:111-124,205-218`). Un changement d'état échange les matériaux instantanément.

**C5. Pas de géométrie de porte dans l'Atelier.** `[HYPOTHÈSE]`
La porte fine (épaisseur 0 ou 0,1) est le lot 1 non codé de `docs/PLAN_GEOMETRIE.md` (roadmap
« Géométries entités : door + trapdoor dans l'Atelier 🔲 »). Remarque de lecture : le centre est
calculé à `pos_y + depth/2` (`EntityMesh.jsx:30`), donc une porte d'épaisseur 0,1 sera collée au bord
de sa case, pas centrée. La rotation `r` pivote autour de ce centre décalé, donc la porte sort de sa
case après rotation.

---

## 5. Synthèse cause → symptôme

| # | Cause | Fichier:ligne | Utiliser | Traverser | Position/anim |
|---|---|---|---|---|---|
| A1 | `required_state_ids` vide = interaction invisible | `SessionPage.jsx:371`, `EntityBuilderTab.jsx:252` | ● | | |
| A2 | ⚙ affichée sans interaction disponible | `EntityMesh.jsx:85,183` | ● | | |
| A3 | id d'état écrit, index lu | `EntityBuilderTab.jsx:193`, `socketEntity.js:38`, `EntityMesh.jsx:25`, `redis.js:67,149` | ● | ● | ● |
| A4 | État changé par le MJ non diffusé | `socketEntity.js:775-778` | ● | | ● |
| A6 | « Interagir » inactif en combat | `combatSections.js:133` | ● | | |
| B1 | `is_blocking` forcé à `false` | `EntityBuilderTab.jsx:296` | | ● | |
| B2 | Blueprint sans état = bloquant permanent | `redis.js:68,150` | | ● | |
| B3 | Collision sur une seule case | `redis.js:70,158` | | ● | |
| B4 | Glisser-déposer sans collision | `Canvas3D.jsx:806-822` | | ● | |
| B5 | A* sans entités + mauvais champ + serveur arrivée seule | `Canvas3D.jsx:646`, `pathfinder.js:97`, `socketCombatResolution.js:214` | | ● | |
| C1 | Pas de transform par état | migration 41, `EntityBuilderTab.jsx:297` | | | ● |
| C2 | Clips GLB ignorés | `EntityMesh.jsx:92` | | | ● |
| C3 | Scène GLB partagée | `EntityMesh.jsx:5,92,144` | | | ● |

---

## 6. Pistes — ordre suggéré, un plan par ligne

Aucune n'est planifiée ligne à ligne ici. Chacune demande sa propre lecture complète avant « Je code ? ».

1. **A3 — identité d'état stable** (prérequis de tout le reste) : trancher « `current_state_id` = id »
   ou « = index », aligner éditeur, serveur, Redis et rendu, puis vérifier les données existantes en
   base (ids ≠ index ?).
2. **B1 — rendre `is_blocking` éditable par état** dans l'Atelier, et arrêter de l'écraser à la
   sauvegarde. Vérifier ensuite les blueprints existants en base.
3. **A1/A2 — sémantique de `required_state_ids`** : décider si une liste vide signifie « toujours
   disponible », et masquer ⚙ quand rien n'est disponible dans l'état courant.
4. **A4 — diffuser `current_state_id`** après un changement fait depuis le panneau MJ.
5. **B5 — pathfinding combat** : fournir les entités bloquantes à l'A* (avec la bonne source), puis
   décider si le serveur doit valider le chemin et pas seulement l'arrivée.
6. **C1/C2/C3 — positions et animations** : c'est un chantier de conception, pas un correctif. Pistes à
   comparer : transform par état (rotation/translation/pivot, interpolée) pour les portes voxel, et
   association état → clip pour les GLB (`useAnimations` de drei), avec clonage par instance
   (`SkeletonUtils.clone`) comme préalable.
7. **B3 — empreinte multi-cases** (tient compte de `width`/`depth`/`r`), à coupler avec
   `docs/PLAN_GEOMETRIE.md` lot 1 (Porte).
8. **A6 — action « Interagir » en combat** : lire `docs/REGLES/REGLESYSCOMBAT.md` avant tout plan.
9. **B4 — collision hors combat** : décision de conception (le glisser-déposer libre est peut-être
   voulu pour le MJ).

### Questions pour Saar

- Quels blueprints « porte » existent aujourd'hui (voxel ou GLB, nombre d'états) ? Voir `[DBG-PORTE1]`.
- Ouvrir une porte ordinaire : sans jet (direct) par défaut, le jet étant réservé aux portes
  verrouillées ou forcées ?
- Animations : faut-il s'appuyer sur les clips fournis dans les GLB, sur une rotation calculée par le
  moteur (valable aussi pour les portes voxel), ou sur les deux ?
- Hors combat : une porte fermée doit-elle bloquer le glisser-déposer d'un joueur (B4) ?
