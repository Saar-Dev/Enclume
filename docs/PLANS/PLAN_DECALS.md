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
testé à la clôture de ce lot** : la route HTTP `GET /api/decal-assets` elle-même (jamais de serveur
lancé par l'agent) — reste à vérifier au moment du Lot 3 (premier consommateur réel), pas bloquant
avant. **Mise à jour 2026-10-15, testée par Saar au Lot 3** : la route répondait mais son champ
`url` pointait une adresse MinIO directe (`getFileUrl`), jamais servie par l'application — contraire
à la convention déjà en place pour tout le reste des assets (`/api/assets/*filePath`, jeton signé
car `THREE.TextureLoader` n'envoie jamais le cookie de session entre deux ports différents). Vignettes
et rendu 3D restaient vides. Corrigé (`image_url` relatif + `signAssetFieldsMiddleware`, même
patron que `modelGlbUrl`) — détail dans l'Historique.
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

## Révision 2026-10-15 — retour du premier test réel de Saar

**Contexte** : premier test réel du Lot 3 par Saar. Trois défauts concrets trouvés (images
manquantes — corrigé séparément, cf. Historique — flux de clic qui ne fait pas ce qu'on attend) et
trois manques de fond jamais confirmés avec lui avant de coder (teinte, position libre vs grille,
mur seul vs mur+sol). Recherche faite (doc + forums + dépôts, demande explicite de Saar) avant de
corriger. Réponses de Saar aux deux questions ouvertes : **position libre**, **mur et sol**. Cette
section **remplace** la conception des Lots 2 et 3 ci-dessous (gardés tels quels pour l'historique,
marqués dépassés) — Lots 2 et 3 doivent être en bonne partie recodés, pas juste patchés.

### A. Modèle d'interaction — outil tampon (« stamp/brush »), pas deux actions séparées

Le flux à deux étapes (choisir une vignette, PUIS cliquer un bouton « Poser » caché plus bas) est
abandonné. **Confirmé par la recherche** (pas une préférence personnelle) : c'est le patron standard
de ce genre d'outil — Tiled (éditeur de cartes de référence, open source) et les outils de pose
d'objets de Godot (GoPlacer) fonctionnent à l'identique : choisir dans la palette **active
immédiatement** le mode pose, un fantôme suit le curseur, un clic pose et **reste en mode pose**
pour enchaîner plusieurs poses, jusqu'à ce que l'outil change de mode. Reprendre un objet déjà posé
(le sélectionner pour le déplacer/modifier/supprimer) est un second mode, décrit en C.

- Choisir une vignette dans la palette (mur ou sol) → `onPatch` fixe directement
  `mode: 'decal'|'floor-decal'` + l'asset choisi, sans bouton intermédiaire.
- Le fantôme de pose (déjà écrit, `DecalPreview.jsx`) reste valable, juste déclenché plus tôt dans
  le flux.
- Après une pose réussie, le mode reste actif (même règle déjà appliquée aux portes/connecteurs,
  §12.9 `PLAN_WORLD_BUILDER_REWORK.md`) — enchaîner plusieurs décors sans rouvrir la palette.

### B. Mur ET sol — deux collections séparées, pas une fusionnée

**Décision, avec sa raison** : `room.floorDecorations[]`, nouveau, à côté de `room.wallDecorations[]`
(inchangé dans sa forme) — pas un tableau unique `decorations[]` avec un champ `surface`. Un décor
mural et un décor de sol sont adressés structurellement différemment (arêtes de mur pour l'un, case
de sol pour l'autre) : les fusionner forcerait une branche `if (surface === 'wall') ... else ...`
dans CHAQUE fonction qui les touche (validateur, réconciliation, rendu, outil) sans rien gagner en
retour — c'est le même choix déjà fait par ce projet entre `connectors` (adressés par position) et
`wallAppearanceProfiles` (adressés par arêtes), jamais fusionnés malgré une forme de surface
proche. Ce qui EST partagé entre les deux (et reste un seul endroit) : le catalogue d'assets (Lot
0), le rendu du quad texturé/teinté (Lot 2), et le patron d'outil tampon (A ci-dessus).

- **Ancrage sol** : position libre `anchorX/anchorZ` n'importe où dans l'empreinte de la salle (pas
  d'ancrage sur une arête), normale fixe vers le haut `(0,1,0)`, `rotationY` libre (choisie à la
  pose, pas déduite d'un mur). Même champs `widthM/heightM/mirror/color` que le mur.
- **Réconciliation sol** : même esprit que `wallDecorationsSurvivingEdges` (Lot 1) mais par case —
  un décor de sol disparaît si la case de sol qui le porte (celle qui contient `anchorX/anchorZ`)
  sort de l'empreinte de la salle (`paintRoomFootprintCells` en mode retrait). Pas de notion de
  « porte sur cette case » à vérifier contrairement au mur (une porte ne couvre jamais une case de
  sol entière) — **à confirmer à l'implémentation** si un connecteur de sol existant (trappe,
  ascenseur) doit bloquer la pose, par analogie avec la porte sur un mur.
- **Rendu sol** : même technique que le mur (quad orienté, décalage physique — ici vers le haut
  depuis le sol — pour rester devant le matériau du sol, jamais un artifice de rendu), paramétrée
  par la normale et la tangente au lieu de les dériver d'un panneau de mur.

### C. Décor déjà posé — repositionnable, pas seulement supprimable

Remis en périmètre (exclu à tort du Lot 3 initial, jamais confirmé avec Saar) : reprendre un décor
déjà posé pour le déplacer. Patron confirmé par la recherche (Godot/GoPlacer : « mode transformation
en place pour un nœud de scène déjà posé »). Même mécanisme de sélection que celui déjà choisi pour
la suppression (liste dans le panneau du mur ou de la salle, pas un clic direct sur l'image en 3D —
raison inchangée depuis le Lot 2 : apparence pure, jamais une collision) ; déplacer un décor
sélectionné depuis cette liste rebascule l'outil sur son point d'ancrage pour le reposer ailleurs
(même geste que la pose initiale, pas un glisser-déposer séparé à inventer).

### D. Teinte — convention universelle, pas un nouveau mécanisme

**Confirmé par la recherche** : Three.js, Godot (`modulate`), Phaser (`tint`) et Unity partagent la
même convention — une couleur qui se **multiplie** avec la texture, déjà le comportement de
`material.color` sur le `MeshStandardMaterial` déjà utilisé (Lot 2), laissé à blanc par défaut
jusqu'ici (= aucune teinte). Nouveau champ `color` (hex) sur chaque décor (mur et sol), exposé par un
sélecteur de couleur dans le panneau. **Conséquence technique vérifiée par la recherche** (piège
documenté, pas une supposition) : la teinte exige un matériau non partagé entre décors dès qu'elle
diffère de blanc — le cache `decalMaterialFor` (partagé par texture, Lot 2) doit être reclé par
`(texture, color)`, jamais par texture seule, sous peine de teindre tous les décors de la même image
d'un coup. Sans effet visible sur une image déjà entièrement blanche/transparente (la plupart du
catalogue) que si l'image porte réellement du blanc à teindre — à vérifier visuellement par Saar une
fois codé, pas garanti identique sur toutes les images du pack.

### Statut

Rien de codé pour cette révision — cadrage présenté à Saar, analyse à charge à faire avant tout
code (même règle que d'habitude), puis Lots 2 et 3 repris en profondeur : nouveaux champs/collection
(Lot 1 bis), rendu teinté + sol (Lot 2 bis), outil tampon unifié mur/sol + repositionnement (Lot 3
bis).

## Lot 2 — Rendu 3D — **CLOS, partiel ⚠️ (2026-10-15) — conception dépassée, voir « Révision 2026-10-15 » ci-dessus**

**Objectif** : afficher chaque `room.wallDecorations[]` comme une image plate collée sur la face
intérieure du mur qu'elle référence, toujours visible au-dessus du matériau/motif du mur, sans
jamais toucher au mesh ni au matériau du mur lui-même, sans collider ni occluder.

**Révision du 2026-10-15 (cadrage initial du 2026-09-16 vérifié contre le code réel)** —
`THREE.DecalGeometry` est **écarté**, au profit d'un simple quad orienté pour mur droit ET mur
courbe. `DecalGeometry` est bien disponible (three 0.183.2, présent via `@react-three/fiber` ;
`three/addons/geometries/DecalGeometry.js`, lu en entier) mais son usage réel exige une référence
au Mesh Three.js déjà construit du mur (sa géométrie réelle, sa `matrixWorld`) pour projeter puis
découper le décor dessus, et porte un risque de distorsion documenté par les auteurs **autour des
coins** — alors qu'un décor est par construction toujours ancré à un seul panneau, jamais à cheval
sur un coin (`wallDecorationsOverlap`, Lot 1). Un décor étant toujours petit devant le rayon d'un
mur courbe (salle de taille normale), un quad plat donne un résultat visuellement équivalent sans
avoir à retrouver l'objet Mesh réel dans la scène ni relancer un calcul de projection à chaque
changement du monde. Simplification réelle, pas une impasse technique.

**Position et orientation du quad** :
- Position de base = `anchorX/anchorZ` (déjà stocké), décalée vers l'intérieur de la salle d'une
  demi-épaisseur de mur + une petite marge — pour toucher la face intérieure sans s'enfoncer dans
  le mur ni flotter devant.
- Axe horizontal du quad = `tangentX/Z` (déjà stocké).
- **Point non vu au cadrage précédent** : le sens de `normalX/Z` stocké n'est qu'une rotation à 90°
  de la tangente — il ne garantit pas de regarder vers l'intérieur de la salle propriétaire du
  décor. Au rendu, corriger ce sens avec `interiorNormalSignsByRoom[decoration.roomId]` (calcul
  déjà fait ailleurs — `roomWalls.js`, `cameraCutaway.js` — pour savoir quelle face d'un mur est
  « dedans » pour une salle donnée). Sans cette correction, une partie des décors se retrouverait
  orientée vers l'extérieur, invisible depuis la salle qui les porte.
- Ordre d'affichage devant le matériau/motif : obtenu naturellement par le décalage physique vers
  l'intérieur (profondeur réelle, pas un artifice `renderOrder`/`polygonOffset`).
- `mirror` : inversion simple de la coordonnée horizontale de la texture du quad.

**Point ouvert non résolu par le Lot 1, à trancher maintenant (mon avis, pas une règle de jeu)** :
la donnée posée au Lot 1 ne garde aucune hauteur de pose sur le mur (seulement sa position le long
du mur, `anchorX/Z`). Proposition : une hauteur fixe depuis le sol (hauteur réelle d'un panneau,
~1,5 m), identique quelle que soit la hauteur de la salle — plutôt qu'un centrage sur toute la
hauteur du mur, qui donnerait des panneaux absurdement hauts dans une salle à plusieurs étages.
Aucune modification du schéma `wallDecorations` nécessaire (constante de rendu, pas une donnée
posée) ; à confirmer par Saar avant de coder. **Corrigé après analyse à charge (§M,
JOURNALANALYSE.md 2026-10-15)** : `getWallRenderBox` autorise un mur aussi bas que 0,5 m
(`Math.max(0.5, wall.height || 2.5)`) — la hauteur de pose doit être plafonnée à la hauteur réelle
du mur porteur moins une marge, jamais utilisée comme constante brute.

**Matériau du quad (ajouté après analyse à charge, §N)** : `MeshStandardMaterial` (carte couleur +
transparence), la même famille que le matériau du mur (`proceduralMaterialAt`,
`MeshStandardMaterial`, réagit à l'éclairage de la scène) — jamais `MeshBasicMaterial`, qui resterait
à luminosité fixe quelle que soit la lumière de la salle, visuellement incohérent avec le mur juste
derrière.

**Chargement des images** : même mécanisme que les textures de mur déjà en place (`GET
/surface-textures` suivi d'un chargeur dédié, dans `client/src/components/Editor3D.jsx` et
`client/src/components/Canvas3D.jsx`) — nouvel appel `GET /decal-assets` (déjà en place depuis le
Lot 0) suivi d'un chargement de texture, câblé aux deux mêmes endroits, pas un troisième mécanisme.

**Fichiers livrés** :
- `client/src/lib/wallDecorationGeometry.js` (nouveau) : géométrie pure (pas de JSX/Three.js) —
  `findWallDecorationPanel` (retrouve le panneau de mur réel porteur d'un décor, départagé par
  position quand plusieurs panneaux post-découpe-porte partagent les mêmes `sourceEdgeKeys`, §P) et
  `wallDecorationPlacement` (position + rotation du quad, hauteur plafonnée à la hauteur réelle du
  mur §M, sens de la normale corrigé par `interiorNormalSignsByRoom` §N). Séparé du rendu pour rester
  testable par `node --test` (un `.jsx` ne se charge pas dans ce harnais).
- `client/src/lib/wallDecorationGeometry.test.mjs` (nouveau) : 5 scénarios réels, dont le scénario §P
  (panneaux post-découpe-porte ambigus par clé, départagés par position).
- `client/src/lib/decalAssets.js` (nouveau) : chargement des images du catalogue en textures
  Three.js, même patron que `surfaceTextures.js` (cache par URL).
- `client/src/components/SurfaceDungeonScene.jsx` : nouveau composant `WallDecorationPlane`, lu à
  côté de `WallSegment` (qui lit déjà `wallAppearanceProfiles`) ; matériau `MeshStandardMaterial`
  partagé par texture (§N) ; raycast désactivé (apparence pure, jamais une collision/sélection).
- `client/src/components/Editor3D.jsx` et `client/src/components/Canvas3D.jsx` : chargement du
  catalogue de décors (`GET /decal-assets`, catalogue complet non filtré), même emplacement que le
  chargement des `surface_textures`, transmis en prop `decalAssetCatalog` jusqu'à
  `SurfaceDungeonScene` (via `EntityEditorScene`/`SurfaceEditorScene`/`Scene`).

**Invariant** : un décor n'ajoute jamais de collider ni d'occluder ; une apparence 3D n'implique
jamais une collision (`.claude/rules/world.md`) ; un décor est toujours visible au-dessus du
matériau et du motif du mur (décalage physique vers l'intérieur, pas un artifice de rendu).

**Limite connue et acceptée (§O)** : un quad plat s'écarte légèrement de la vraie courbe sur un mur
à très faible rayon — négligeable pour un décor (~0,5 m) sur une salle de taille normale, jamais
observé dans ce projet à ce jour ; pas une correction à faire maintenant.

**Testé** : `node --check`/lint ciblé (propre, zéro nouvelle erreur — comparé au lint de la branche
avant ce lot) sur les 7 fichiers touchés ; build client (`npm run build`, propre) ; les 5 scénarios
de `wallDecorationGeometry.test.mjs` (dont le sens de la normale vérifié **empiriquement** pour le
cas simple — une salle seule a déjà `interiorNormalSignsByRoom = 1`, aucune inversion nécessaire —
et le scénario §P, panneaux ambigus post-découpe-porte départagés par position réelle, pas supposé) ;
les 61 scénarios de `surfaceData.test.mjs` et les 949 tests purs de `shared/` toujours verts (aucune
régression). **Non testé : ⚠️ clos partiel** — rendu jamais vu dans un navigateur réel (ni serveur ni
navigateur lancés par l'agent, AGENTS.md). **Bloqué, pas seulement « pas encore fait » :** aucun
décor ne peut exister dans une carte réelle avant le Lot 3 (l'outil de pose) — ce lot ne peut donc
pas être validé visuellement avant que le Lot 3 existe. La route `GET /api/decal-assets` (jamais
exercée avant ce lot, §L) et le rendu réel (sens de l'image, miroir, ordre d'affichage, mur droit ET
courbe) ne seront vérifiables qu'une fois le Lot 3 posable — **la validation visuelle par Saar
reste la clôture réelle de ce lot, mais elle n'est atteignable qu'après le Lot 3**, pas avant.

**Données** : aucune (lecture seule, aucune écriture en base ni migration).

**Retour arrière** : `git revert`/retrait des fichiers listés ci-dessus — aucune donnée persistée,
aucun risque.

## Lot 3 — Outil d'édition — **CLOS, partiel ⚠️ (2026-10-15) — conception dépassée, voir « Révision 2026-10-15 » plus haut**

**Objectif** : poser un décor sur un mur déjà sélectionné, le supprimer. Débloque la validation
visuelle du Lot 2 (premier moyen réel de faire exister un décor dans une carte).

**Emplacement — tranché, pas une question ouverte** : le panneau du mur sélectionné
(`SurfaceWallPanel.jsx`) a déjà exactement ce patron pour les portes — une section « Ouvertures »
avec un bouton désactivé tant que plusieurs tronçons de mur sont sélectionnés, qui bascule l'outil
en mode pose (`startDoorPlacement` : `onPatch({ mode: 'connector', connectorType: 'door',
connectorWallEdgeKeys: [...selectedKeys] })`). Un décor suit le même précédent — nouvelle section
« Décoration » dans ce même panneau, un nouveau mode d'outil (`mode: 'decal'`), jamais un panneau
séparé.

**Catalogue de vignettes — précédent direct trouvé** : `SurfaceEditorPanel.jsx` a déjà une palette
de vignettes groupées par catégorie pour choisir une texture de mur (bloc `showTexturePalette`,
grille de boutons avec l'image en fond, bordure active). Même composant visuel pour choisir un
décor (catégorie `signage`/`military` du Lot 0 → vignette → sélection), pas une nouvelle UI de
palette inventée.

**Pose (clic dans la scène)** : `SurfaceEditorScene.jsx` a déjà une fonction générique de
résolution du point de clic sur un mur contraint à une sélection (`getSelectedDoorWallPoint`) —
**vérifié en la lisant intégralement jusqu'à son dernier `return` (§S, JOURNALANALYSE.md
2026-10-15)**, rien dedans n'est spécifique à une porte (elle filtre par salle/arêtes sélectionnées,
pas par type de connecteur) : réutilisée telle quelle pour `mode === 'decal'`, pas dupliquée. La pose elle-même
passe par un nouveau fichier pur, même patron que `computeConnectorPlacement.js`
(`tool.connectorType === 'door' ? applyDoorConnector(...) : ...`) : `computeDecalPlacement.js`
appelle `makeWallDecorationFromWallPoint` puis `addRoomWallDecoration` (Lot 1, déjà écrits) et
retourne `{ surfaceData, error }` — l'erreur (mur déjà porteur d'une porte, chevauchement, salle
disparue : messages déjà rédigés au Lot 1) s'affiche dans le même champ que les erreurs de mur déjà
existantes (`roomArcError`, déjà lu par `SurfaceWallPanel.jsx`).

**Sélection d'un décor déjà posé, pour le supprimer — simplifié au moment de coder, par rapport au
cadrage §Q** : le cadrage prévoyait de réactiver le raycast du quad pour un clic direct sur l'image,
comme pour un connecteur (`handleConnectorPointerSelect`). En écrivant le code, plus simple et tout
aussi complet : un décor est de toute façon ancré à un seul tronçon de mur déjà identifié par
`sourceEdgeKeys` — pas besoin de cliquer l'image elle-même pour le retrouver. La section
« Décoration » du panneau du mur sélectionné liste directement les décors dont `sourceEdgeKeys`
recoupe la sélection courante (simple filtre sur la donnée, zéro raycast), chacun avec son bouton
supprimer (`removeRoomWallDecoration`, déjà écrit au Lot 1). Le raycast du quad reste désactivé
(Lot 2, inchangé) — pas de régression de l'invariant « apparence pure, jamais une collision », et
une dépendance en moins (pas de nouveau gestionnaire de clic 3D à maintenir).

**Aperçu avant le clic — ajouté après analyse à charge (§R), absent du premier cadrage** : la pose
d'une porte affiche déjà un fantôme semi-transparent qui suit la souris avant le clic
(`ConnectorPreview.jsx`, recalculé en direct depuis `makeDoorConnectorFromWallPoint`). Sans
l'équivalent pour un décor, la pose serait un clic à l'aveugle — régression d'UX silencieuse par
rapport à l'outil porte existant. Nouveau composant du même patron (`DecalPreview.jsx`) : appelle
`makeWallDecorationFromWallPoint` sur le point survolé, réutilise le calcul de placement du Lot 2
(`wallDecorationPlacement`), rendu à opacité réduite.

**Taille par défaut** : `width_px`/`height_px` du catalogue (Lot 0) donnent un ratio réel — hauteur
fixe par défaut (à définir à l'implémentation, probablement proche de la hauteur de pose du Lot 2,
~0,5 m) et largeur dérivée du ratio, pas une saisie manuelle en v1.

**Miroir** : une case à cocher dans la section, appliquée au moment de la pose (champ `mirror` déjà
dans le schéma du Lot 1, déjà consommé par le rendu du Lot 2) — pas un bouton à retrouver après
coup sur un décor déjà posé (voir hors périmètre).

**Hors périmètre de ce lot** : déplacer un décor déjà posé le long du mur (glisser-déposer),
rotation arbitraire (seul le miroir, à la pose, est permis), redimensionnement après pose,
bibliothèque de favoris, recherche texte dans le catalogue — à n'envisager que si le catalogue
grossit réellement au-delà du contenu initial.

**Fichiers livrés** :
- `client/src/lib/surfaceTools/computeDecalPlacement.js` (nouveau) : partie pure de la pose, même
  patron que `computeConnectorPlacement.js`.
- `client/src/lib/surfaceTools/computeDecalPlacement.test.mjs` (nouveau) : 5 scénarios réels (pose
  mur droit/courbe, taille par défaut vs fournie, échec sans mur sous le curseur, erreur propagée du
  Lot 1).
- `client/src/components/surfaceTools/DecalPreview.jsx` (nouveau) : fantôme de pose, même patron
  que `ConnectorPreview.jsx`.
- `client/src/components/SurfaceDungeonScene.jsx` : `WallDecorationPlane` exporté (réutilisé par
  l'aperçu) et prend un prop `opacity` (clonage via `withOpacity`, jamais une mutation du matériau
  partagé) ; renfort `polygonOffset` sur le matériau du décor (recherche faite, cf. échange avec
  Saar 2026-10-15).
- `client/src/components/SurfaceEditorScene.jsx` : nouveau mode d'outil `decal` câblé partout où
  `connector`/porte l'était déjà (mousedown/mousemove/mouseup, aperçu au survol, commit via
  `computeDecalPlacement`).
- `client/src/components/SurfaceWallPanel.jsx` : nouvelle section « Décoration » — liste des décors
  du mur sélectionné + suppression, palette à vignettes groupées par catégorie, case miroir, bouton
  de pose.
- `client/src/components/Editor3D.jsx` : catalogue brut des décors conservé (`decalAssets`, en plus
  de `decalAssetCatalog` déjà chargé au Lot 2) pour alimenter la palette ; `handleDecalRemove`.
- `client/src/locales/builder.json` : nouvelles clés `surfaceWallPanel.decoration*`/`addDecal*`
  (namespace déjà utilisé par ce panneau, ajoutées avant leur premier usage JSX).

**Testé** : `node --check`/lint ciblé sur les 10 fichiers touchés (propre, zéro nouvelle erreur par
rapport à la branche avant ce lot — comparé explicitement) ; build client (`npm run build`,
propre) ; les 5 scénarios de `computeDecalPlacement.test.mjs` ; les 71 scénarios de
`surfaceData.test.mjs`/`wallDecorationGeometry.test.mjs` et les 949 tests purs de `shared/` toujours
verts (aucune régression). **Non testé : ⚠️ clos partiel** — comme le Lot 2, jamais vu dans un vrai
navigateur (ni serveur ni navigateur lancés par l'agent). C'est maintenant possible en principe
(l'outil de pose existe), reste à vérifier par Saar : poser un décor en vrai, le voir au bon endroit
et dans le bon sens (Lot 2), le supprimer depuis le panneau, et la route catalogue qui répond
réellement (§L, jamais exercée).

**Données** : aucune (code client seul, aucune migration ni écriture serveur nouvelle).

**Retour arrière** : `git revert`/retrait des fichiers listés — aucune donnée persistée, aucun
risque.

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
- **2026-10-15 (Lot 1 clos)** — `room.wallDecorations[]`, ancrage géométrique
  (`makeWallDecorationFromWallPoint`), réconciliation (suppression/fusion de mur, effacement de
  case) codés et testés (10 scénarios). Dette consciente notée : vérification faite par un script
  scratch, jamais portée en test permanent.
- **2026-10-15 (dette réglée)** — Les 10 scénarios du Lot 1 portés dans
  `client/src/lib/surfaceData.test.mjs` (tests permanents), avant de reprendre le code.
- **2026-10-15 (analyse à charge du cadrage Lot 2)** — `THREE.DecalGeometry` écarté au profit d'un
  quad orienté (§K-O, `JOURNALANALYSE.md`) ; deux oublis techniques trouvés et corrigés avant le
  code : hauteur de pose plafonnée à la hauteur réelle du mur, matériau éclairé
  (`MeshStandardMaterial`) plutôt que `MeshBasicMaterial`.
- **2026-10-15 (Lot 2 codé)** — Rendu 3D livré et testé (5 scénarios, dont le risque réel de panneau
  ambigu après découpe par porte, §P). Demande de validation visuelle envoyée à Saar par erreur :
  aucun décor ne pouvait encore exister dans une vraie carte (pas d'outil de pose) — corrigé,
  reporté sur le Lot 3.
- **2026-10-15 (recherche avant le Lot 3, demande explicite de Saar)** — Documentation officielle et
  forums consultés avant de coder l'outil d'édition : confirment le choix déjà fait (raycast
  désactivable, piège réel documenté sur le miroir d'une texture partagée, quad plat adapté à un
  décor mural). Renfort `polygonOffset` ajouté en conséquence.
- **2026-10-15 (analyse à charge du cadrage Lot 3)** — Deux corrections avant le code (§Q-R,
  `JOURNALANALYSE.md`) : aperçu de pose absent du premier cadrage, ajouté ; mécanisme de sélection
  d'un connecteur mal caractérisé (deux mécanismes distincts, pas un). En codant, simplification
  trouvée par rapport au cadrage corrigé : un décor se gère depuis la liste du panneau Mur, jamais
  par un clic direct sur son image — le raycast du quad reste désactivé, inchangé depuis le Lot 2.
- **2026-10-15 (Lot 3 codé, chantier code-complet)** — Outil de pose/suppression livré et testé (5
  scénarios). Les 4 lots sont désormais tous écrits ; le chantier reste clos partiel ⚠️, rien vu
  dans un vrai navigateur.
- **2026-10-15 (bug trouvé par Saar au premier essai réel)** — Vignettes du catalogue et rendu 3D
  tous deux vides malgré un code par ailleurs fonctionnel (sélection, tooltip). Cause : la route du
  Lot 0 renvoyait une adresse MinIO directe (`getFileUrl`), jamais servie par l'application — toutes
  les autres images du projet (GLB, portraits, textures) passent par une route de proxy dédiée
  (`/api/assets/*filePath`) avec un jeton signé dans l'URL, nécessaire car `THREE.TextureLoader`
  n'envoie jamais le cookie de session entre deux ports différents (dev et Kiwi). Corrigé en
  réutilisant exactement ce mécanisme déjà existant (champ `image_url` relatif + 1 ligne de
  middleware déjà écrit ailleurs) — aucune nouvelle route créée. Repéré uniquement parce que Saar a
  pu tester en vrai : aucune vérification possible côté agent avant (ni serveur ni navigateur).
