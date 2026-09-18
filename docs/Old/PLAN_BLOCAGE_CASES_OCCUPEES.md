# PLAN_BLOCAGE_CASES_OCCUPEES.md — Empêcher de poser une entité sur une case déjà occupée

> Statut : CLOS 2026-09-18, validé jeu réel par Saar (« test fonctionnel »). Contenu durable
> transféré vers `docs/SYSTEME/ENTITES.md` §3.1/§3.3, `docs/SYSTEME/MOTEUR_MONDE.md` §2.2,
> `docs/JOURNAL8.md`, `client/public/CHANGELOG.md` (v237). Archivé ici (Règle 10) — document figé,
> ne plus éditer. Décisions actées : refus dur (Saar) ; mode `wall` exclu de la V1 (Saar) ;
> concurrence tranchée après recherche (§3bis-B — verrou ciblé en L2 uniquement, pas de contrainte
> PostgreSQL native, parité complète tokens/entités différée en V2 non cadrée si le besoin se
> confirme un jour).
>
> **Autorité** : moteur monde (`.claude/rules/world.md`, `.claude/rules/entities.md`), aucune
> règle Polaris directe — confort d'usage MJ, pas de RAW.

---

## 1. Vue d'ensemble

**Constat central du recensement (§2)** : contrairement à l'hypothèse du stub, **les tokens sont
déjà protégés** — création et déplacement consultent tous deux `canOccupy`
(`shared/world/spatialIndex.js`). Le vrai trou est ailleurs : **les entités du monde** (objets 3D
posés depuis l'éditeur — caisses, meubles, décors) **n'ont aucune vérification d'occupation**, ni
à la pose ni au déplacement. C'est ce trou, et lui seul, que ce plan comble.

**Périmètre V1** :
- `POST /api/battlemaps/:id/entities` (création) — refuser une pose qui chevauche un occupant
  bloquant existant (token ou autre entité).
- `PUT /api/entities/:entityId` (déplacement pos_x/pos_y/pos_z) — même refus.
- Restitution client (`Editor3D.jsx` drag, `EntityInstancePanel.jsx` champs numériques) : annuler
  la preview / afficher un message FR sur refus serveur.

**Hors périmètre V1** (voir §8) :
- Tokens — déjà protégés, aucun changement.
- `POST /tokens/:id/teleport` — bypass MJ explicite et documenté dans le code
  (`tokens.js:105-106`), décision produit déjà prise historiquement ; non remis en cause ici.
- Correction automatique de position (snap vers la case libre la plus proche) — cf. §3, écarté.
- Migration de données existantes (entités déjà en chevauchement réel, ex. Baboulinet) — aucune
  purge rétroactive ; le blocage ne s'applique qu'aux nouvelles poses/déplacements.

---

## 2. État des lieux `[VÉRIFIÉ code, 2026-09-17]`

### 2.1 Tokens — déjà protégés, rien à faire

- Création (`POST /battlemaps/:id/tokens`, `server/src/routes/tokens.js:17-103`) →
  `resolveBattlemapPlacement` → `resolvePlacementPoint` → `occupancy.canOccupy`
  (`server/src/services/worldMovementService.js:111-145`). Retourne `409` (« No free walkable
  surface near token destination ») si aucune case libre à proximité de la destination demandée.
- Déplacement en jeu (`world-move`, `executeBattlemapTokenMovement`,
  `worldMovementService.js:188-307`) → `planWorldPath` avec les mêmes occupants → le chemin ne
  traverse jamais une case occupée (narrow-phase circulaire `actorFootprintsOverlap`).
- Déplacement forcé (push/pull, `server/src/services/worldForcedMovementService.js:97-98`) →
  `canOccupy` testé à chaque pas, arrêt avant la case occupée.
- Édition générique (`PUT /tokens/:id`, `tokens.js:198-200`) refuse explicitement toute mutation
  de position (`400`) — oriente vers `world-move` ou `teleport`. Aucun contournement possible.
- `POST /tokens/:id/teleport` (`tokens.js:105-165`) : bypass spatial **volontaire**, commenté
  comme tel dans le code (« bypass spatial explicite, réservé au MJ »). Décision produit déjà
  actée avant ce chantier — hors périmètre (§1).

### 2.2 Entités du monde — trou confirmé, aucune vérification

- Création (`POST /battlemaps/:id/entities`, `server/src/routes/entities.js:112-164`) écrit
  `pos_x/pos_y/pos_z` en base sans consulter `canOccupy` ni `createOccupancyIndex`. Le commentaire
  en place (ligne 155, « L'occupation dynamique sera relue depuis PostgreSQL par le moteur monde »)
  décrit la *lecture* (le mouvement des tokens relit bien les entités comme occupants, cf. 2.3) —
  pas l'*écriture* : rien n'empêche d'insérer une entité par-dessus un occupant existant.
- Déplacement (`PUT /entities/:entityId`, `entities.js:170-220`) : même absence totale de
  vérification sur `pos_x/pos_y/pos_z`.
- Deux points d'entrée client, tous deux vers ces mêmes routes serveur (autorité unique déjà
  respectée côté architecture, cf. invariant #3 `AGENTS.md`) :
  - `Editor3D.jsx:588-608` — drag MJ avec ghost preview client, confirmé au drop par
    `PUT /entities/:entityId`.
  - `EntityInstancePanel.jsx:196-219` — champs numériques X/Y/Z, même route `PUT`.
- C'est précisément l'invariant non tenu de `.claude/rules/entities.md` : « Placement et
  déplacement interrogent le WorldSnapshot et l'occupation runtime, jamais Redis, un voxel ou le
  mesh rendu. »

### 2.3 Cas Baboulinet — explication cohérente avec 2.1/2.2

Le token PNJ ne peut pas avoir chevauché la caisse via son propre déplacement (protégé, §2.1). Le
scénario cohérent avec le code lu : la caisse (entité) a été posée ou déplacée dans l'éditeur
**après coup**, par-dessus un token déjà en place — geste aujourd'hui totalement silencieux côté
serveur (§2.2). Non vérifiable a posteriori sans rejouer l'historique ; sans conséquence sur le
plan, qui corrige le trou plutôt que de diagnostiquer cette instance précise.

### 2.4 Drones / spawn combat — aucun flux additionnel trouvé

Le déploiement de drone réutilise la création de token existante (`POST .../tokens`, §2.1, déjà
protégée). Le spawn combat ne crée pas de nouvelle position : les tokens combattants préexistent
sur la battlemap. Aucun autre point d'écriture de position découvert (`server/src/routes/battlemaps.js`
ne fait que rebroadcaster des positions déjà résolues par `worldMovementService`).

---

## 3. Décision produit à trancher avec Saar

Le stub initial posait la question comme un choix produit ouvert (refus dur / avertissement MJ /
correction automatique). Recensement fait, voici l'état réel des options :

**Option retenue (recommandation) — refus dur, cohérent avec l'existant.** C'est déjà exactement
le comportement des tokens (§2.1) : `canOccupy` refuse sans détour ni filet de rattrapage. Pas de
second mécanisme de collision à inventer (`.claude/rules/world.md` §3), pas de UX à concevoir —
l'entité refuse de se poser/déplacer, la preview côté client (ghost `Editor3D`, champ
`EntityInstancePanel`) revient à sa position précédente avec un message FR bref.

**Option écartée — correction automatique (snap vers case libre la plus proche).** Rejetée : les
entités n'ont pas de graphe de navigation qui contraint leur pose (contrairement aux tokens,
limités aux nœuds `support` du graphe) — un objet mural, une caisse au sol ou un décor suspendu
n'ont pas de notion homogène de « case libre la plus proche ». Inventer cette notion serait un
second mécanisme de collision (interdit par la règle citée ci-dessus) pour un gain marginal face
au refus dur.

**Option écartée — avertissement MJ avec confirmation.** Rejetée par cohérence : aucun autre point
du moteur monde (tokens compris) ne propose de bypass-avec-confirmation pour une collision
d'occupation ; introduire ce patron ici créerait une divergence de comportement UX entre entités
et tokens sans raison métier.

**Le risque du stub (« empilement volontaire de mise en scène ») est déjà résolu par une donnée
existante, sans rien ajouter :** `dynamicOccupantsFromRows` (`worldMovementService.js:75-93`)
exclut déjà du calcul d'occupation toute entité dont l'état a `is_blocking === false`. Le refus dur
ne s'appliquera donc qu'aux entités déjà déclarées bloquantes — une bougie, un décor au sol ou une
tache de sang (non bloquants par nature) restent empilables exactement comme aujourd'hui. Aucun
nouveau champ, aucune nouvelle décision de données.

**Décision de Saar (2026-09-18)** : refus dur confirmé.

---

## 3bis. Analyse à charge (2026-09-18) — erreurs et points ouverts trouvés en revérifiant le code

### Erreurs de la v1.0, corrigées ici et en §4/§5

- **Mauvaise source pour `is_blocking`.** La v1.0 disait tester
  `initialState.is_blocking` (le JSON `state` envoyé par le client dans le body POST/PUT — en
  réalité transform/scale/placement/materialOverrides, jamais `is_blocking`,
  `EntityInstancePanel.jsx:215`). `is_blocking` vit uniquement sur
  `blueprint.states[current_state_id]` (`entityState()`,
  `worldMovementService.js:59-62` ; confirmé par le même patron dans
  `worldVisibilityService.js:35` et par `EntityBuilderTab.jsx:314-317` qui écrit `is_blocking`
  dans `form.states[]`, jamais dans l'état d'instance). Le bon test est donc
  `(blueprint.states?.[current_state_id ?? entity.current_state_id ?? 0]?.is_blocking ?? true)
  !== false` — jamais un champ du body de la requête.
- **Condition de déclenchement du contrôle PUT sous-spécifiée.** `EntityInstancePanel.jsx:196-209`
  (bouton Enregistrer) envoie **toujours** `pos_x/pos_y/pos_z`, y compris quand la position n'a
  pas changé — contrairement à `Editor3D.jsx` qui n'appelle `PUT` qu'après un drag réel. Tester la
  présence du champ (`pos_x !== undefined`) déclencherait donc le contrôle d'occupation à *chaque*
  sauvegarde du panneau (y compris un simple changement de `notes_gm`), avec un risque de faux
  refus sur une position pourtant inchangée si l'entité elle-même est actuellement invalide
  vis-à-vis d'un autre occupant apparu entre-temps. Le contrôle doit comparer la **valeur finale
  résolue** à la position **actuelle en base** de l'entité (`nextPosX !== entity.pos_x`, etc.), pas
  la présence du champ dans le payload.
- **`r` retiré de la condition de déclenchement.** Le rayon de collision utilisé par
  `actorFootprintsOverlap` (`Math.max(width, depth) / 2` ou `collider.radius`,
  `worldMovementService.js:81-89`) ne dépend jamais de `r` — une rotation seule ne change jamais
  l'empreinte circulaire actuelle du projet. Revérifier sur un changement de `r` seul est inutile
  (pas un bug si on le garde, juste une requête gaspillée) — retiré de la condition de
  déclenchement dans un souci de clarté, pas de correction fonctionnelle.

### Points ouverts — à trancher avant de coder

**A. Mode de pose `wall`.** Le blueprint distingue `free` / `wall` / `connector`
(`entities.js:12-15`), et `wall` a déjà sa propre validation (`assertWallPlacementState`,
ancrage à un mur). L'approximation circulaire du moteur (`Math.max(width, depth) / 2`, pas de
véritable rectangle orienté) est calibrée pour des acteurs au sol à peu près circulaires/carrés
(le commentaire de `spatialIndex.js:76-85` documente déjà un faux positif réel de ce type,
BUG-DEPLACEMENT1). Un objet mural large et plat (ex. une bannière 2m × 0,05m) obtiendrait un rayon
de test de 1 m — largement surestimé par rapport à son emprise réelle contre le mur — avec un
risque concret de refuser une pose murale pourtant physiquement libre, uniquement à cause de
l'approximation. **Recommandation** : restreindre le contrôle d'occupation à
`placementMode === 'free'` en V1 ; les entités murales restent non vérifiées (comportement actuel
inchangé pour elles), un vrai contrôle mural nécessiterait une géométrie orientée-mur hors
périmètre de ce plan (déplacé en §8, à cadrer séparément si le besoin se confirme).

**B. Concurrence — décision (2026-09-18, après recherche, Saar délègue le choix technique).**

Correction d'un fait établi trop vite en v1.0 : la **création** de token
(`POST /battlemaps/:id/tokens`, `tokens.js:17-103` → `resolveBattlemapPlacement`) **n'est pas non
plus transactionnelle** — elle lit les occupants puis insère en deux opérations séparées, sans
verrou. Seul le **déplacement** (`executeBattlemapTokenMovement`, une action répétée, fréquente,
potentiellement multi-joueurs pendant un tour de combat actif) est verrouillé
(`db.transaction` + `.forUpdate()` sur `battlemaps`/`tokens`/`entities`, dans cet ordre). Le
précédent du projet n'est donc pas « tout est verrouillé », mais « verrouillé seulement là où
plusieurs acteurs peuvent réellement écrire en même temps ».

Alternative « pro » recherchée avant de trancher : PostgreSQL a un outil natif conçu exactement
pour « deux lignes ne doivent jamais se chevaucher » — la contrainte `EXCLUDE ... USING gist`
(extension `btree_gist`), qui offre une meilleure concurrence qu'un verrou pessimiste (aucune
ligne bloquée, seul un vrai chevauchement est rejeté à l'écriture). **Écartée pour ce projet** :
elle exigerait de matérialiser en colonnes SQL un rayon/une hauteur qui n'existent aujourd'hui que
comme un calcul JS dérivé (`blueprint.geometry` + `state` courant + échelle, recalculé à la
volée par `dynamicOccupantsFromRows`), synchronisées par triggers à chaque changement de
blueprint/état/échelle — un **second moteur de collision** dupliquant `actorFootprintsOverlap` en
SQL, exactement ce que `.claude/rules/world.md` interdit (« pas de second mécanisme de
collision »), et qui ne remplacerait de toute façon pas l'usage JS de cette même fonction pour le
pathfinding des tokens (`canOccupy` appelé à chaque nœud candidat, pas exprimable comme contrainte
statique). Garder une autorité unique (JS, `spatialIndex.js`) pour toute décision spatiale du
projet prime sur la meilleure concurrence théorique d'un mécanisme parallèle.

**Décision retenue — cohérente avec le précédent réel (verrou seulement où le risque est réel)** :
- **L1 (création)** : aucune transaction — symétrique à la création de token
  (`resolveBattlemapPlacement`), pas une régression par rapport à l'existant, un MJ posant une
  entité est un cas d'usage aussi mono-rédacteur qu'un MJ créant un token.
- **L2 (déplacement via `PUT /entities/:entityId`)** : uniquement quand la position change
  réellement (§3bis, condition de déclenchement déjà posée), envelopper lecture des occupants +
  écriture dans une transaction avec verrous, **même ordre de tables que
  `executeBattlemapTokenMovement`** pour éviter un deadlock croisé avec lui : `battlemaps` (la
  ligne) → `tokens` (toutes, battlemap) → `entities` (toutes, battlemap). `bumpBattlemapRuntimeRevision`
  accepte déjà un second paramètre `database` (`worldRuntimeService.js:4`) — l'appeler avec `trx`
  à l'intérieur de la même transaction, pas de nouvelle fonction.
- Les PUT qui ne touchent pas la position (label, `gm_only`, interactions, matériaux…) gardent le
  chemin actuel, sans transaction — aucun changement de comportement pour l'immense majorité des
  sauvegardes du panneau.

**V2, explicitement définie et différée, pas enterrée** (§8) : la vraie parité architecturale avec
les tokens serait de séparer `PUT /entities/:entityId` en « édition générique, position interdite »
(mirroir exact de `tokens.js:198-200`) + un endpoint dédié `move`, structurellement identique à
`executeBattlemapTokenMovement`. Non fait en V1 : ça change le contrat de deux points d'entrée
client (`Editor3D.jsx`, `EntityInstancePanel.jsx`) pour un risque de course aujourd'hui
strictement théorique (MJ mono-rédacteur). À réévaluer si un vrai symptôme de concurrence apparaît
(ex. plusieurs MJ simultanés sur une campagne).

Sources consultées : contraintes d'exclusion PostgreSQL/GiST — Crunchy Data
(https://www.crunchydata.com/blog/postgres-constraints-for-newbies), Cybertec
(https://www.cybertec-postgresql.com/en/exclusion-constraints-in-postgresql-and-a-tricky-problem/) ;
verrouillage pessimiste Knex/`FOR UPDATE` — documentation Knex.js
(https://knexjs.org/guide/transactions.html).

**C. `EntityInstancePanel` — refus atomique.** Le panneau envoie tous les champs modifiés en un
seul `PUT` (position, label, `gm_only`, interactions, matériaux…). Un refus d'occupation bloque
donc aussi les autres modifications saisies dans la même sauvegarde. Déjà le comportement actuel
pour toute autre validation de ce PUT (`assertWallPlacementState` rejette déjà tout le payload de
la même façon) — pas une régression introduite par ce plan, juste une conséquence à ne pas
découvrir en testant.

---

## 4. L1 — Vérification serveur à la création (`POST /battlemaps/:id/entities`)

Fichier : `server/src/routes/entities.js`. Ne s'applique qu'aux entités `placementMode === 'free'`
(§3bis-A ; `wall` et `connector` restent inchangés — `connector` déjà rejeté ligne 131-133).

```js
// Après résolution du blueprint (ligne ~130), avant l'insertion, seulement si placementMode === 'free' :
// - is_blocking vient de blueprint.states[0]?.is_blocking (current_state_id est codé 0 à la
//   création, entities.js:147) — JAMAIS de initialState/req.body.state (transform/scale/placement
//   uniquement, cf. §3bis). Défaut conservateur si states vide/absent : bloquant (true).
// - si non bloquant : ne pas vérifier, comportement actuel inchangé (cohérent avec
//   dynamicOccupantsFromRows qui exclut déjà ces entités des occupants d'un token en mouvement)
// - si bloquant : construire le profil acteur (radius/height depuis blueprint.geometry +
//   collider du state + scale de normalizedEntityState, même formule que dynamicOccupantsFromRows
//   worldMovementService.js:75-93 — extraire cette formule en fonction exportée réutilisable par
//   les deux call sites plutôt que la redupliquer dans entities.js, cf. invariant #3 AGENTS.md)
// - charger les occupants dynamiques de la battlemap (loadBattlemapDynamicOccupants, déjà
//   exporté par worldMovementService.js) et tester createOccupancyIndex(occupants).canOccupy(
//   point, actorProfile)
// - si refusé : AppError(409, 'Position already occupied') — pas de snap, pas de retry serveur
```

Réutilise `loadBattlemapDynamicOccupants` / `createOccupancyIndex` / `actorFootprintsOverlap`
tels quels (§3, `.claude/rules/world.md`) — aucune nouvelle fonction de collision, seule la
dérivation occupant-depuis-ligne mérite d'être extraite en fonction partagée (voir ci-dessus) pour
ne pas dupliquer la formule entre `worldMovementService.js` et `entities.js`.

---

## 5. L2 — Vérification serveur au déplacement (`PUT /entities/:entityId`)

Même fichier, même restriction `placementMode === 'free'`, avec trois différences par rapport à
L1 :
- Position finale = fusion `pos_x/pos_y/pos_z` reçus + valeurs actuelles de l'entité pour les
  champs non fournis (le PUT est partiel, cf. `entities.js:193-195`).
- `excludeIds: [entity.id]` passé à `canOccupy` — l'entité ne doit pas se bloquer elle-même
  (patron déjà utilisé par `worldForcedMovementService.js:97-98` pour l'acteur qui se déplace).
- **Déclenchement par comparaison de valeur, pas de présence de champ** : ne vérifier que si la
  position finale résolue diffère de la position actuelle en base
  (`nextPosX !== entity.pos_x || nextPosY !== entity.pos_y || nextPosZ !== entity.pos_z`) —
  `EntityInstancePanel.jsx:205-209` envoie `pos_x/pos_y/pos_z` à **chaque** sauvegarde, même sans
  changement réel (§3bis) ; tester la seule présence du champ re-déclencherait le contrôle sur
  toute édition de `notes_gm`/`label_override`. `r` n'entre pas dans la condition — l'empreinte
  circulaire actuelle ne dépend pas de la rotation (§3bis).
- Si `current_state_id` change dans le même PUT, utiliser la nouvelle valeur pour relire
  `blueprint.states[current_state_id]` avant de calculer `is_blocking`/le collider — un
  changement d'état peut rendre une entité bloquante ou non, ou changer ses dimensions.

---

## 6. L3 — Restitution client

- `Editor3D.jsx:595` (`api.put('/entities/...')` sur confirmation du drag) : sur `409`, annuler la
  preview (revenir à la position d'avant-drag, même patron que le ghost/ratage documenté dans
  `feedback_dragdrop_ux` — ne pas conserver la position fantôme) + toast/log FR bref.
- `EntityInstancePanel.jsx:205` (`api.put`) : sur `409`, ne pas appliquer les nouveaux champs
  X/Y/Z, les réinitialiser à `entity.pos_x/y/z` (le `useEffect` ligne 128/134 le fait déjà au
  changement d'entité — vérifier qu'il se redéclenche aussi sur échec local), afficher le message.
- Nouvelle clé i18n dans `client/src/locales/builder.json` (namespace déjà existant pour
  l'éditeur, cf. `.claude/rules/i18n.md`) — le serveur reste en anglais interne (patron déjà en
  place, cf. `tokens.js` messages `AppError`), le client mappe le statut `409` vers la clé FR
  (même patron que `TexturePacksPage.jsx:206` pour un autre domaine).
- `Canvas3D.jsx:933` avale déjà silencieusement un `409` sur la preview de déplacement monde
  (tokens) — vérifier si le rendu 3D des entités passe par un chemin de preview comparable qui
  aurait besoin du même traitement, ou si `Editor3D.jsx` est le seul consommateur (à confirmer en
  lisant le rendu de preview d'entité au moment de coder, pas supposé ici).

---

## 7. Tests

- `node --check server/src/routes/entities.js`
- Étendre les tests existants de `worldMovementService` / `spatialIndex` si une fonction
  d'assemblage occupants-au-repos est extraite (à confirmer au moment de coder — L1/L2 peuvent
  réutiliser `loadBattlemapDynamicOccupants` sans nouvelle fonction testable isolément).
- Scénario réel (Saar) : poser une entité bloquante sur une case occupée par un token → refus ;
  déplacer une entité bloquante sur une case occupée par une autre entité bloquante → refus ;
  poser/déplacer une entité non bloquante (`is_blocking: false`) sur une case occupée → autorisé
  (comportement inchangé) ; PUT ne touchant pas la position → inchangé.

---

## 8. Hors périmètre / différé

- Migration/nettoyage des chevauchements déjà présents en base (dont l'instance Baboulinet) — pas
  couvert, pas bloquant pour ce plan.
- `POST /tokens/:id/teleport` — bypass MJ volontaire, non remis en cause.
- Toute UX de confirmation/snap — écartée en §3, pas un report « V2 » mais un choix architectural
  tranché (cohérence avec le patron tokens existant).
- **Entités murales (`placementMode === 'wall'`)** (§3bis-A) : non vérifiées en V1, approximation
  circulaire trop imprécise pour un objet plat contre un mur. V2 si le besoin se confirme en jeu
  réel : géométrie de collision orientée-mur (rectangle le long de la face, pas un cercle) — pas
  cadrée ici, à ouvrir dans un plan dédié si Saar rencontre le problème concrètement.
- **Parité architecturale complète entités/tokens** (§3bis-B, V2) : séparer `PUT /entities/:entityId`
  en édition générique (position interdite, mirroir `tokens.js:198-200`) + endpoint `move` dédié
  transactionnel, structurellement identique à `executeBattlemapTokenMovement`. Différé tant que
  la fenêtre de course MJ-concurrent (aujourd'hui atténuée en L2 par un verrou ciblé, §3bis-B)
  reste théorique — à rouvrir si un symptôme réel apparaît.
- Contrainte PostgreSQL `EXCLUDE ... USING gist` (§3bis-B) : écartée, pas différée — dupliquerait
  `actorFootprintsOverlap` en un second moteur de collision SQL, incompatible avec l'autorité
  unique JS exigée par `.claude/rules/world.md`.
