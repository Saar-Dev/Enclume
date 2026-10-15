PLAN — Décorations murales (Wall Decals)

> **2026-09-16** — Ambiguïté avec `PLAN_RW_MATERIAUX.md` Lot 3 résolue (voir `docs/VOCABULARY.md`
> « Ambiguïtés connues » — Décal). Les deux ne se recouvrent pas : Lot 3 = texture source d'un motif
> procédural appliqué à toute une surface (ingrédient du pipeline matériaux) ; ce document =
> objet décoratif ponctuel positionné à un endroit précis d'un mur, indépendant du matériau de base.
> Les deux peuvent coexister sur le même mur. Recherche pro (Three.js `DecalGeometry`, Unity Decal
> Projector, Unreal Decal Actor) faite le 2026-09-16 pour trancher la stratégie de rendu — voir §4bis.
> **Reste hors de ce document** : l'outil d'édition de forme de salle (arêtes/sommets), traité par
> `PLAN_WORLD_BUILDER_REWORK.md` — sujet distinct malgré la même session de cadrage.
>
> **2026-10-14** — Cadrage détaillé rédigé après analyse à charge contre le code réel actuel
> (`docs/JOURNALANALYSE.md`, section « 2026-10-14 — Reprise »). Pré-cadrage initial (ex-Étapes 1-7
> ci-dessous) remplacé par les Lots L0-L3. Catalogue réel trié et nettoyé depuis un pack acheté par
> Saar (licence confirmée OK), rangé dans `assets_source/decals/` (hors dépôt Git) — voir §Catalogue
> réel. Décisions de Saar actées : un décor s'affiche toujours au-dessus du matériau et du motif
> procédural du mur (Lot 2) ; aucune superposition entre deux décors n'est permise (Lot 1) ; effacer
> une case de mur sous un décor l'efface avec, sans bloquer (Lot 1). Relecture critique faite
> (`docs/JOURNALANALYSE.md` §G-J) : l'ancrage géométrique d'un décor a été corrigé pour reprendre le
> patron du connecteur de porte (position/orientation réelles), pas celui de
> `wallAppearanceProfiles` (pensé pour une région coloriée). **Lot 0 (catalogue) et Lot 1 (concept
> métier + réconciliation) CLOS, 2026-10-15.** Lot 2 (rendu 3D) à venir.

## Objectif

Permettre au MJ d'appliquer instantanément une décoration (signalétique, pochoirs militaires,
panneaux d'état, etc.) sur une face intérieure de mur, sans créer de nouveau GLB ni modifier le
matériau du mur.

## État des lieux vérifié (2026-10-14)

- Le blocage historique (« un mur garde-t-il son identité quand on modifie la forme d'une salle ? »)
  est levé depuis le 2026-09-28 : l'outil de forme des salles actuel (peindre/effacer des cases) ne
  fait jamais « glisser » un mur d'une position à une autre (`PLAN_EDITEUR_CARTE.md` §4.1).
- Aucune ligne de code `wallDecoration`/décal n'existe dans le projet à ce jour.
- **Patron d'ancrage géométrique inspiré d'une porte, pas de celui d'une couleur de mur** (corrigé
  après relecture critique du 2026-10-14, `docs/JOURNALANALYSE.md` §G) : `wallAppearanceProfiles[]`
  (`edgeKeys[]` seul) est pensé pour colorier UNE RÉGION entière, sans position ni orientation propre
  — il ne convient pas à un objet positionné précisément, surtout sur un mur courbe.
  **Correction du 2026-10-14 (deuxième passe, après avoir lu `makeDoorConnectorFromWallPoint`
  jusqu'au bout cette fois — la première affirmation de ce document [« confirmé identiques pour un
  mur droit ou courbe »] était fausse, la lecture s'était arrêtée avant la fin)** : une porte n'a
  PAS une seule représentation géométrique, elle en a deux, choisies selon le mur
  (`client/src/lib/connectors.js:129-258`) :
  - mur droit (`panel.axis === 'x'`/`'z'`, le seul cas possible aujourd'hui — Tier A, murs toujours
    à 90°) : un simple rectangle `{axis, x0, x1, z0, z1, alongCenter}`, sans ancre ni tangente ;
  - mur courbe (`panel.axis === 'segment'`, réservé aux arcs) : `anchorX/Z, tangentX/Z, normalX/Z,
    rotationY, curveId, curveOffset`.

  La preuve empirique confirme ce clivage : une porte construite à la main avec `axis:'segment'`
  mais sans `curveId`/`curveOffset` est **rejetée par le validateur de production**
  (`shared/world/surfaceDocument.js:401-404`, testé directement contre `validateSurfaceData`) — ces
  deux champs ne sont donc jamais optionnels pour une vraie porte sur arc, jamais utilisés pour un
  mur droit. Cette dualité existe chez les portes pour une raison précise, étrangère aux décors :
  `x0/x1/z0/z1` (mur droit) et `curveId`/`curveOffset` (mur courbe) servent tous deux à
  **découper un trou dans le maillage du mur** (`worldCompiler.js` `doorMatchesWall`/
  `splitWallPiece`), un calcul exact qui a besoin d'une représentation différente selon la forme.

  **Un décor ne découpe jamais rien** (apparence pure, `.claude/rules/world.md`) : il n'a donc besoin
  d'AUCUNE des deux représentations spécifiques des portes, seulement de la partie qui sert à savoir
  où et dans quel sens le dessiner — `anchorX/Z, tangentX/Z, normalX/Z, rotationY` — calculable de la
  même façon pour un mur droit (tangente triviale : `(1,0)`/`(0,1)` selon l'axe) ou un arc (tangente
  déjà calculée par la branche courbe de `makeDoorConnectorFromWallPoint`). **C'est une
  simplification choisie pour les décors, pas un patron déjà utilisé tel quel ailleurs dans le
  code** — à écrire comme une fonction neuve (Lot 1, ci-dessous), inspirée des deux branches de
  `makeDoorConnectorFromWallPoint` sans les copier. `sourceEdgeKeys` reste une référence de
  stabilité/traçabilité, jamais pour calculer la position
  (`shared/world/surfaceFieldTypes.js:53-59`). Le décor reste dans `room.wallDecorations[]`, jamais
  dans `surface_data.connectors` — il n'a ni état runtime ni règle de collision, `connectors` est
  réservé à ça (`.claude/rules/world.md`). Ni une entité posée (`entities.state.placement.wallId`,
  mécanisme distinct réservé aux objets 3D libres), ni une nouvelle forme de données inventée à
  partir de rien.
- Aucun pipeline d'import d'image « qualité pro » n'existe pour les surfaces : l'ancien
  `PLAN_RW_MATERIAUX.md` qui en prévoyait un est archivé (`docs/Old/`), jamais construit ; la suite
  réelle du rework matériaux (Phase 3 de `PLAN_EDITEUR_CARTE.md`) a pris la voie 100% procédurale.
  Le catalogue d'images existant (`surface_textures`, ex-`voxel_textures`) décrit une texture
  carrelée sur 6 faces de cube — pensé pour un matériau de mur/sol répété à l'infini, pas pour une
  image unique détourée posée à un endroit précis. **Un décor a besoin de sa propre fiche de
  données**, même si elle range ses fichiers dans le même coffre de stockage (MinIO).
- Toute sauvegarde de `surface_data` (`PUT /api/battlemaps/:id/surface`,
  `server/src/routes/battlemaps.js`) incrémente systématiquement `world_revision` **et**
  `surface_revision` et recompile tout le `WorldSnapshot`, sans distinction de la nature du champ
  modifié (déjà vrai aujourd'hui pour une simple couleur de mur). Un décor ne changera rien à ce
  comportement ni ne l'aggrave spécifiquement — question de l'ancien §6 refermée : pas de traitement
  spécial à prévoir, le coût de compilation est un chantier séparé et déjà suivi
  (`PLAN_EDITEUR_CARTE.md` §20).

## Lot 0 — Catalogue d'assets décals (fondation, pas de rendu, pas d'outil d'édition) — **CLOS (2026-10-14)**

**Objectif** : une fiche de données pour « une image de décor », distincte de la fiche 6-faces des
textures de surface, avec un premier contenu réel (le pack trié, voir §Catalogue réel).

**Fichiers livrés** :
- `server/src/db/migrations/390_decal_assets.js` (structure) + `391_decal_assets_constraints.js`
  (contraintes) : table `decal_assets` — `id` (UUID), `category` (`signage`/`military`, CHECK),
  `label`, `image_path` (chemin MinIO), `width_px`/`height_px` (dimensions réelles — le ratio se
  calcule à la lecture, jamais stocké séparément, une seule autorité), `source_pack` (traçabilité),
  `deprecated`, `sort_order`. `UNIQUE(source_pack, label)` rend l'import idempotent par clé
  naturelle (`.claude/rules/core.md` SEED-ID-DETERM), jamais par `id`.
- stockage : même bucket et même convention de chemin que `texture-pack.js` (MinIO, `decals/<uuid>.png`),
  pas sa fiche `faces`.
- `server/src/scripts/import_decal_assets_20261014_initial.js` : script one-shot (lecture de
  `assets_source/decals/`, upload MinIO puis insertion, MinIO avant base — patron
  `texture-packs.js`), **pas un seed Knex** — un seed ne doit pas faire d'appel réseau vers MinIO.
  **Pas lancé par l'agent** (écrit en base hors `bug_tickets`, AGENTS.md) — à lancer par Saar.
- `server/src/routes/decal-assets.js` (monté dans `index.js`) : `GET /api/decal-assets`, liste des
  décalques non dépréciés avec URL MinIO et ratio calculé, patron `surface-textures.js`.

**Invariant** : un asset décal = une image détourée (alpha) + ses dimensions réelles, jamais le
schéma 6-faces d'une texture de surface — deux fiches, un seul coffre de stockage.

**Testé** : `node --check` sur les 5 fichiers (propre) ; aller-retour réel de la migration contre la
base locale (`up()`/`down()` importés directement) — schéma et les deux contraintes vérifiés en
conditions réelles. **Piège trouvé en route** : avoir testé puis annulé (`down()`) la migration ne
l'applique pas pour de vrai — rien ne déclenche `db.migrate.latest()` tant que le serveur ne démarre
pas, ce que ni Saar ni l'agent ne fait dans ce flux de travail. Le script d'import a donc d'abord
échoué (`decal_assets does not exist`) quand Saar l'a lancé — corrigé en appliquant la migration
pour de vrai via `db.migrate.latest()` (mécanisme officiel, pas la CLI brute), vérifié n'avoir
appliqué que ces deux migrations (`knex_migrations` contrôlé avant/après). Saar a ensuite lancé
l'import lui-même (« 321 créés, 0 déjà présents ») ; **vérifié en lecture seule par l'agent après
coup** : 321 lignes en base réparties exactement comme attendu (121 signage, 100+100 militaire),
dimensions cohérentes (2048/2049×2048), et un fichier MinIO réellement présent et lisible (taille et
type corrects) — pas seulement le message de succès du script pris pour argent comptant. **Non
testé** : la route HTTP `GET /api/decal-assets` elle-même (jamais de serveur lancé par l'agent) —
reste à vérifier au moment du Lot 3 (premier consommateur réel), pas bloquant avant.
**Données** : 321 lignes créées dans `decal_assets` (nouvelle table, aucune donnée de jeu existante
touchée) + 321 fichiers dans MinIO (`decals/<uuid>.png`). **Retour arrière** : `down()` des deux
migrations (testé) ; les fichiers MinIO resteraient orphelins après un rollback, à nettoyer
manuellement si jamais nécessaire (pas automatisé, risque jugé mineur pour une table neuve).

**Hors périmètre de ce lot** : upload depuis l'éditeur par l'utilisateur (v2, le contenu de départ
suffit) ; normal map/relief du décor (le pack Military en fournit certains mais aucun consommateur
avant Lot 2) ; atlas de texture partagé (optimisation à n'envisager que si le nombre de décors posés
sur une carte réelle le justifie — pas avant).

## Lot 1 — Concept métier WallDecoration + schéma surface_data — **CLOS (2026-10-15)**

**Objectif** : persister un décor, ancré sur un mur comme une porte l'est déjà (position/orientation
réelles), qui disparaît entièrement si son mur d'ancrage disparaît.

**Fichiers** :
- `shared/world/surfaceDocument.js` (`validateFeature`, collection `rooms`) : nouvelle entrée
  `wallDecorations[]` — `{id, assetId, sourceEdgeKeys[] (référence de stabilité, jamais pour calculer
  la position), anchorX, anchorZ, tangentX, tangentZ, normalX, normalZ, rotationY, widthM, heightM
  (dérivées du ratio réel de l'asset, Lot 0, × une échelle), mirror}` — **une seule forme pour mur
  droit ET courbe, à la différence du connecteur de porte** (voir État des lieux ci-dessus : une
  porte a DEUX représentations différentes selon le mur, parce qu'elle doit découper un trou dans le
  maillage ; un décor n'en a besoin que d'une, plus simple, parce qu'il ne découpe rien). Jamais le
  patron de `wallAppearanceProfiles` non plus (voir État des lieux).
- `shared/world/surfaceFieldTypes.js` + `shared/world/importGuard.js` (`profileCount`, l.212) :
  types stricts et plafond de complexité par salle, `wallDecorations` compté au même titre que les
  autres collections de mur.
- `client/src/lib/connectors.js` : fonction de pose `makeWallDecorationFromWallPoint` (nouveau
  fichier ou export voisin), **fonction neuve inspirée des deux branches de
  `makeDoorConnectorFromWallPoint` (~l.129-258), sans les copier telles quelles** : reprend le même
  rayon 3D contre le mur sélectionné (`roomsWallSegments`/`wallPointDistanceToPanel`) et, pour les
  DEUX cas de panneau (`axis: 'x'/'z'` et `axis: 'segment'`), calcule seulement
  `anchorX/Z, tangentX/Z, normalX/Z, rotationY` — triviaux sur un mur droit (tangente `(1,0)`/`(0,1)`
  selon l'axe), repris de la branche courbe existante sur un arc. Jamais `x0/x1/z0/z1` (format de
  découpe des portes, inutile ici) ni `curveId`/`curveOffset` (servent uniquement à
  `worldCompiler.js` pour découper un trou dans un mur arrondi,
  `doorMatchesWall`/`splitWallPiece`, ~l.479-582 — un décor ne découpe jamais rien,
  `.claude/rules/world.md`). Le test de superposition (ci-dessous) se calcule à ce même moment,
  transitoirement, sans être persisté comme un champ séparé.
- `client/src/lib/surfaceRooms.js` :
  - **réconciliation = suppression entière, jamais un recadrage partiel** (un décor est un point, pas
    une région — `prunedByRetainedEdges` ne s'applique pas ici, corrigé après relecture critique du
    2026-10-14, `docs/JOURNALANALYSE.md` §H). Reprendre exactement la règle déjà appliquée aux portes
    : `deleteRoomBoundaryWalls` calcule une seule fois les connecteurs touchés par les arêtes
    supprimées (`doorConnectorTouchesBoundaryEdges`, ~l.694) et l'applique identiquement dans ses
    deux branches — mur ouvert vers l'extérieur (~l.703-704) et fusion de deux salles (~l.800-801).
    Même calcul, même portée, étendu aux décors dont `sourceEdgeKeys` touche les arêtes supprimées.
  - **outil peindre/effacer des cases (`classifyRoomFootprintCells`, mode « effacer ») : un décor
    n'empêche jamais d'effacer sa case, contrairement à une porte** (`doorOnCell` bloque aujourd'hui
    ; un décor ne bloque pas — décision de Saar, 2026-10-14, « Effacer tout, option 2 »). Effacer la
    case supprime le décor avec elle, silencieusement, pas de confirmation séparée.
  - correctif du trou trouvé le 2026-10-14 sur l'existant (ticket
    `WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN`) : `deleteRoomBoundaryWalls`, branche « mur ouvert vers
    l'extérieur » (~l.698-718), ne purge aujourd'hui ni `wallAppearanceProfiles` ni
    `wallElevationProfiles`. Toujours à corriger pour ces deux-là dans ce lot, indépendamment des
    décors (qui, eux, suivent la règle de suppression des portes, pas celle-ci).
  - refus de pose d'un décor sur une case de mur qui porte une porte : réutiliser le calcul déjà
    écrit pour interdire d'effacer un tel mur (`boundaryEdgesTouchingCell`/`doorOnCell`,
    `classifyRoomFootprintCells`, ~l.899-901), jamais une seconde implémentation du même filtre.
  - **refus de pose si la zone occupée par le nouveau décor chevauche un décor déjà posé sur le
    même mur, côté salle, hors coin** (décision de Saar, 2026-10-14 : « pas de superposition de
    décals ») — projection transitoire des deux décors sur l'axe du tronçon de mur (même calcul que
    la fabrication de l'ancre, ci-dessus — pas un champ `curveOffset` stocké, voir note sur le
    schéma) puis test d'intervalles `position ± largeur/2`, **limité aux décors de la même salle et
    du même côté du mur** (un mur partagé par deux salles a une apparence par salle, `.claude/rules/
    world.md` — deux décors posés par les deux salles voisines sur les deux faces d'un même mur ne se
    superposent pas visuellement, ne doivent pas se bloquer) ; **un décor ne chevauche jamais un
    coin**, même contrainte qu'une porte (toujours posée sur un seul tronçon droit ou un seul arc).
    Aucun ordre d'affichage entre décors à gérer : ils ne se recouvrent jamais.

**Invariant** : un décor est ancré par une position/orientation réelle (patron porte), `sourceEdgeKeys`
n'étant qu'une référence de stabilité ; pure apparence — zéro collision, navigation, LOS ou occupation
(`.claude/rules/world.md`) ; si le mur d'ancrage disparaît, le décor disparaît entièrement ; deux
décors ne se superposent jamais (refusé à la pose, même salle/même côté/hors coin uniquement).

**Hors périmètre de ce lot** : déplacer un décor déjà posé par glisser-déposer libre (v1 = retirer
puis reposer).

**Fichiers livrés** : `shared/world/surfaceFieldTypes.js` (`DECORATION_ENTRY`) ;
`shared/world/surfaceDocument.js` (`validateFeature`, collection `rooms`) ;
`shared/world/importGuard.js` (`profileCount`) ; `client/src/lib/connectors.js`
(`makeWallDecorationFromWallPoint`) ; `client/src/lib/surfaceRooms.js`
(`wallDecorationsSurvivingEdges`, `addRoomWallDecoration`, `removeRoomWallDecoration`, purge câblée
dans `mergeRooms`/`paintRoomFootprintCells`/les deux branches de `deleteRoomBoundaryWalls`, correctif
`WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN` appliqué dans la même foulée) ; `client/src/lib/
surfaceData.js` (barrel, nouveaux exports).

**Testé** : `node --check` sur les 5 fichiers touchés (propre) ; ESLint ciblé (0 problème) ; build
client propre ; les 143 tests purs existants (`surfaceData.test.mjs`, `surfaceDocument.test.mjs`,
`surfaceFieldTypes.test.mjs`, `importGuard.test.mjs`, `roomGeometry.test.mjs`) toujours au vert, y
compris la dérive de types (toute donnée numérique validée en production doit figurer dans
`surfaceFieldTypes.js`). **Scénario réel écrit pour l'occasion** (script Node autonome, aucun
serveur/base, 10 cas) : géométrie plausible sur mur droit ET sur arc (tangente/normale unitaires et
perpendiculaires, ancre exactement sur le cercle pour l'arc) ; deux décors qui se chevauchent sur le
même mur → le second refusé ; deux décors éloignés sur le même mur → les deux acceptés (pas de faux
positif) ; pose refusée sur un mur qui porte une porte ; effacer la case d'un mur décoré le supprime
sans bloquer (option 2) ; ouvrir un mur vers l'extérieur supprime le décor ET confirme le correctif
de l'orphelin (une apparence posée sur ce même mur disparaît aussi, alors qu'elle restait avant) ;
fusion de deux salles : le décor du mur partagé disparaît, celui d'un autre mur survit ;
`removeRoomWallDecoration` retire proprement et signale une erreur sur un id déjà absent ; le
validateur de production rejette un décor malformé (10/10 scénarios passés).
**Non testé** : rendu (Lot 2, pas encore écrit) et pose réelle depuis l'éditeur (Lot 3) — aucun des
deux n'existe encore, rien à tester avant eux.
**Données** : aucune — ce lot ne touche que du code (schéma/validation/fonctions pures), aucune
migration, aucune écriture en base.
**Retour arrière** : revert des 5 fichiers (pas de migration, pas de donnée persistée à nettoyer).

## Lot 2 — Rendu 3D

**Objectif** : afficher un décor sur le mur qu'il référence, sans toucher au mesh ni au matériau du
mur lui-même.

**Fichiers** :
- `client/src/components/SurfaceDungeonScene.jsx` : nouveau composant de rendu qui lit
  `room.wallDecorations[]`, au même niveau que `WallSegment` lit déjà `wallAppearanceProfiles`.
- mur plan (cas par défaut) : quad simple en léger décalage vers l'intérieur de la salle (sens déjà
  porté par `interiorNormalSign`, dérivé par salle), matériau = texture du décor (alpha
  transparent) — jamais une seconde couche ajoutée au matériau du mur lui-même.
- mur courbe ou profilé : `THREE.DecalGeometry` (addon officiel three.js), projeté sur le maillage
  réel du mur, recalculé à chaque changement du `WorldSnapshot` — jamais stocké en coordonnées
  Three.js indépendantes (le rendu ne redéfinit jamais le modèle canonique).
- chargement de texture : réutiliser le loader déjà utilisé par `surfaceTextures.js`
  (`THREE.TextureLoader`), pas un nouveau mécanisme de chargement.
- **ordre d'affichage imposé (décision de Saar, 2026-10-14)** : un décor se dessine toujours
  au-dessus du matériau procédural ET du motif du mur qui le porte — jamais caché derrière, quel que
  soit l'ordre dans lequel les composants se rendent. En pratique : le décalage vers l'intérieur
  (léger offset positif) suffit pour le quad plan ; pour `DecalGeometry`, vérifier à l'implémentation
  que l'ordre de rendu (`renderOrder` Three.js) ou le `polygonOffset` place bien le décor devant,
  jamais un test au cas par cas découvert en jeu.

**Invariant** : un décor n'ajoute jamais de collider ni d'occluder ; une apparence 3D n'implique
jamais une collision (`.claude/rules/world.md`) ; un décor est toujours visible au-dessus du
matériau et du motif du mur.

**Hors périmètre de ce lot** : découpe dynamique d'un décor par une porte posée après coup — déjà
empêché à la pose (Lot 1), pas un cas à gérer au rendu.

## Lot 3 — Outil d'édition

**Objectif** : poser, sélectionner, déplacer le long du mur, supprimer, tourner/mettre en miroir un
décor, depuis l'éditeur.

**Fichiers** : s'implante dans la structure déjà décomposée de l'éditeur (Phase 2/6 de
`PLAN_EDITEUR_CARTE.md`, close) — jamais rajouté dans un monolithe. Emplacement exact (panneau de
mur existant vs nouveau panneau dédié) : question UI/UX à trancher au moment de ce lot, pas
supposée ici.

**Workflow** : catégorie → vignette du catalogue (Lot 0) → survol du mur sélectionné → aperçu →
clic → placement. Décor déjà posé : sélectionné par clic, même langage visuel que mur/connecteur
(`.claude/rules/world.md`/`SURFACES_SALLES.md`) → suppression/rotation/miroir dans le panneau.

**Hors périmètre de ce lot** : glisser-déposer libre, bibliothèque de favoris, recherche texte dans
le catalogue — à n'envisager que si le catalogue grossit réellement au-delà du contenu initial.

## Catalogue réel — tri du pack acheté (2026-10-14, licence confirmée OK par Saar)

Source originale : `docs/Sign_Decals/` (pack acheté, trois sous-packs `JRO_D_*`, chacun en 2-3
variantes du même contenu visuel). Trié, nettoyé, et déplacé vers `assets_source/decals/` — hors du
dépôt Git (`.gitignore`). **Importé en base le 2026-10-14** (Lot 0, 321 lignes vérifiées). Détail du
tri : `assets_source/decals/README.md`.

**Gardé** :
- **`assets_source/decals/signage/` (121 fichiers)** — pictogrammes seuls, sans cadre de panneau
  routier (flèches de direction, aéroport, virage, dos d'âne, électricité, chute de pierres,
  glissant...). Catégorie prévue `signage`. Vérifié : vrai canal alpha (transparence réelle, pas un
  fond noir opaque), 2048×2048.
- **`assets_source/decals/military_navy/` et `assets_source/decals/military_white/` (100 fichiers
  chacun)** — pochoirs et plaques abstraites (chiffres au pochoir, flèches RETRACT/ENGAGE, panneaux
  d'état type « BA2 / Batch.F7 »), même forme dans deux teintes réellement différentes (pas un
  doublon de format comme signage/PNG supprimé plus bas) : les deux variantes sont gardées comme
  deux choix visuels. Catégorie prévue `military`.

**Supprimé (pas pertinent pour des décors muraux 3D)** :
- `UI&HUD_Decals/` — éléments d'interface à l'écran (HUD de jeu vidéo : bandeaux, journaux de
  commande), pas des objets à poser sur un mur. Texte anglais incrusté dans l'image en plus.
- Dossiers `SVG` de chaque pack — même contenu visuel que leurs équivalents matriciels, format non
  consommé par le pipeline de rendu actuel.
- `Sign_Decals/PNG/` (panneaux encadrés, cercle rouge réglementaire) — redondant avec `signage/`
  pour le même pictogramme (comparé fichier par fichier), cadre moins adapté à une station spatiale.
  2 fichiers qui n'existaient QUE là (`JRO_D_Misc_NoParking_3/4`) récupérés dans `signage/` avant la
  suppression du dossier — rien perdu.

## Historique

- **2026-09-16** — Ambiguïté avec `PLAN_RW_MATERIAUX.md` résolue, recherche pro faite, stratégie de
  rendu tranchée (§4bis).
- **2026-10-14** — Analyse à charge du pré-cadrage contre le code réel (`docs/JOURNALANALYSE.md`).
  Blocage d'identité de mur confirmé levé ; patron d'ancrage précisé ligne par ligne ; un défaut
  pré-existant trouvé et ticketé (`WALL-APPEARANCE-ORPHAN-ON-EXTERIOR-OPEN`) ; piste de catalogue
  d'assets de l'ancienne recommandation invalidée (jamais construite) et remplacée. Cadrage détaillé
  rédigé (Lots L0-L3).
- **2026-10-14 (suite)** — Licence du pack confirmée OK par Saar. Deux décisions actées : ordre
  d'affichage décor > matériau/motif imposé (Lot 2), aucune superposition entre décors (Lot 1,
  referme la question ouverte de l'ancien plan). Pack trié : 2 sous-dossiers non pertinents
  supprimés (HUD/UI, panneaux encadrés redondants) + formats SVG non consommés supprimés ; contenu
  gardé déplacé de `docs/Sign_Decals/` vers `assets_source/decals/` (hors dépôt Git).
- **2026-10-14 (relecture critique)** — Analyse à charge du cadrage lui-même (`docs/JOURNALANALYSE.md`
  §G-J). Défaut de fond trouvé et corrigé : l'ancrage géométrique d'un décor copiait
  `wallAppearanceProfiles` (pensé pour une région coloriée, sans position/orientation) au lieu du
  patron déjà éprouvé pour un point positionné sur un mur droit ou courbe — celui du connecteur de
  porte (`anchorX/Z, tangentX/Z, normalX/Z, rotationY`). Conséquence directe : la réconciliation à la
  suppression/fusion d'un mur devient une suppression entière du décor (règle déjà codée pour les
  portes), pas un recadrage partiel. Dernière question ouverte tranchée par Saar (« Effacer tout,
  option 2 ») : effacer une case de mur sous un décor l'efface avec, sans bloquer comme le ferait une
  porte. Lot 0 corrigé sur un point mineur (import = script, pas un seed Knex).
- **2026-10-14 (vérification avant premier code)** — Saar a demandé confirmation de certitude avant
  le feu vert (« si et seulement si tu es sûr à 100 % »). En vérifiant pour pouvoir répondre, un
  champ de trop trouvé dans le schéma Lot 1 : `curveOffset`/`curveId`, copiés du connecteur de porte
  par réflexe, ne servent chez la porte qu'à découper un trou dans un mur arrondi
  (`worldCompiler.js` `doorMatchesWall`/`splitWallPiece`) — un décor ne découpe jamais rien, ces deux
  champs sont donc retirés du schéma. `anchorX/Z + tangentX/Z + normalX/Z + rotationY` suffisent,
  confirmé identiques pour un mur droit ou courbe en lisant `makeDoorConnectorFromWallPoint`
  jusqu'au bout. Le test de superposition se calcule transitoirement à la pose, jamais stocké comme
  un champ séparé. Cadrage stabilisé, feu vert de Saar (« Go ») reçu pour le Lot 0.
- **2026-10-14 (Lot 0 codé)** — Table `decal_assets` (migration 390/391), route
  `GET /api/decal-assets`, script d'import one-shot écrits. Migration testée par aller-retour réel
  contre la base locale (schéma + les deux contraintes vérifiées en conditions réelles, puis
  `down()` confirmé propre — rien laissé appliqué).
- **2026-10-14 (Lot 0 importé)** — Piège trouvé : tester une migration par `up()`/`down()` ne
  l'applique pas pour de vrai, rien ne déclenche `db.migrate.latest()` sans démarrer le serveur —
  l'import de Saar a d'abord échoué (`decal_assets does not exist`), corrigé en appliquant la
  migration pour de vrai (mécanisme officiel knex, vérifié n'avoir touché que ces deux migrations).
  Saar a ensuite lancé l'import (321 créés). Vérifié en lecture seule par l'agent après coup : 321
  lignes réparties correctement, dimensions cohérentes, fichier MinIO réellement présent — **Lot 0
  clos**, sauf la route HTTP elle-même (jamais testée faute de serveur, reportée au Lot 3).
- **2026-10-14 (avant code du Lot 1, autocorrection)** — En relisant `makeDoorConnectorFromWallPoint`
  jusqu'au bout cette fois (la veille, la lecture s'était arrêtée avant la fin), trouvé que l'État
  des lieux affirmait quelque chose de faux : une porte n'a PAS une seule représentation géométrique
  pour mur droit et courbe, elle en a deux (`x0/x1/z0/z1` sur un mur droit, `anchorX/Z+tangente+
  curveOffset/curveId` sur un arc) — confirmé aussi en testant directement contre le validateur de
  production (une porte `axis:'segment'` sans `curveId`/`curveOffset` est rejetée). La décision
  finale pour les décors ne change pas (une seule forme simplifiée, sans `curveOffset`/`curveId`),
  mais sa justification était fausse (« confirmé identiques en lisant jusqu'au bout ») — corrigée :
  c'est une simplification choisie parce qu'un décor ne découpe jamais le mur, pas un patron déjà
  utilisé ailleurs tel quel. État des lieux et Lot 1 réécrits en conséquence avant tout code.
