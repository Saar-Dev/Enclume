# PLAN_EDITEUR_CARTE.md — Chantier global « rework de l'éditeur de carte » : ordre et dépendances

> Créé 2026-09-26 (Saar / Claude). **Document d'orchestration, pas un plan de lot** : il fixe l'ordre, les
> dépendances et le statut des segments, et renvoie vers les documents qui portent le détail (Règle 2 et 11 de
> `docs/RegleDocumentaire.md` — une information = un endroit). Temporaire (Règle 10) : à archiver quand S0→S4
> sont clos. **Aucun segment n'est pré-cadré ici** ; chacun aura son cadrage et son analyse à charge avant tout code.
>
> Autorité : `docs/SYSTEME/EDITEUR.md`, `docs/SYSTEME/SURFACES_SALLES.md`, `docs/SYSTEME/MOTEUR_MONDE.md`,
> `.claude/rules/world.md`.

## 1. Déclencheur et périmètre

Saar (2026-09-26) : rework de l'éditeur de carte, chantier massif à segmenter. Il regroupe :

| Sujet | Document porteur | État |
|---|---|---|
| Sauvegarde / export de carte | *(aucun — ligne backlog `ROADMAP.md` §4 « Sauvegarde/export carte 3D »)* | rien de cadré ni de codé |
| Forme des salles (sommets / arêtes) | `PLAN_WORLD_BUILDER_REWORK.md` | stub, cadrage non commencé |
| UI/UX des panneaux (fil 2 de l'audit du 2026-09-16) | *(aucun ; contexte : mémoire « audit 4 fils », `PLAN_WORLD_BUILDER_REWORK.md` §6)* | non cadré |
| Décorations murales (décals) | `PLAN_DECALS.md` | stratégie de rendu tranchée, pas de code, pas de lots |
| Rendu 3D des portes (connecteurs) | `PLAN_ENTITES_INTERACTIVES_ROADMAP.md` Lot C | non cadré |

**Hors chantier** : `PLAN_NUAGE.md` (effet de jeu, dépend de la fondation zones dangereuses, `PLAN_ZONES_DANGER.md`).
Seul lien : l'éditeur de volumes de danger E-v2 **consommera** le primitif d'édition 2D livré par S2
(`PLAN_ZONES_DANGER.md` §7.3 et §12) — S2 le construit agnostique du domaine, E-v2 reste un autre chantier.
Lots A/B de `PLAN_ENTITES_INTERACTIVES_ROADMAP.md` : hors chantier (A clos ; B = contenu manifest, décision produit de Saar).

## 2. Feuille de route complète (proposition — à valider par Saar avant tout code)

Principe (Saar, 2026-09-26) : **valider le plan complet du chantier avant de coder la première étape**, pour ne pas préparer un travail
dont la pertinence pour la suite serait incertaine. Ce chapitre vérifie donc, lot par lot, **ce que chaque lot produit et qui le réutilise**.
Niveau de spécification : **D** = détaillé (plan à lot exact), **C** = cadré (objectifs, dépendances, décisions), **À** = à cadrer.

### 2.1 Segments

| Segment | Contenu | Dépend de | Spéc. | Plan |
|---|---|---|---|---|
| **S0** | Export / import de carte, v1 = la carte seule | rien | **D** | `PLAN_EXPORT_CARTE.md` (validé) |
| **S1** | Cadrage forme des salles **+** UI/UX des panneaux (une conversation) | S0 (filet de sécurité) | À | `PLAN_WORLD_BUILDER_REWORK.md` (stub) |
| **S2** | Code de la forme des salles (primitif d'édition 2D partagé) | S1 | À | à écrire en S1 |
| **S3** | Décorations murales | S2 | C | `PLAN_DECALS.md` |
| **S4** | Rendu 3D des portes (multi-clips) | rien | C | `PLAN_ENTITES_INTERACTIVES_ROADMAP.md` Lot C |
| **v2a** | Export des objets posés (entités), deux profils | S0 (et S2 pour les ancrages, voir §2.4) | C | `PLAN_EXPORT_CARTE.md` §10 |
| **v2b** | Export des effets monde | v2a | C | idem |
| **v3** | Assets : textures de pack, objets personnalisés, fond 2D | v2a | C | idem |
| **Purge** | Faire disparaître le voxel | S0 (sauvegarde), garde-fous `PLAN_PURGE_VOXEL.md` §0 | À | `PLAN_PURGE_VOXEL.md` (stub) |

Raisons de l'ordre (décidées avec Saar) : **S0 d'abord** (utile immédiatement — sauvegarde urgente — et filet avant S2 qui pourrait
migrer des cartes) ; **S1 avant S2** (la forme des salles ne se cadre pas sans passe UI/UX) ; **S3 après S2** (les décals s'ancrent sur
des murs dont l'identité doit être stable) ; **S4 indépendant** (domaine connecteurs) ; **purge en dernier** (la peur de perdre des
données fixe des garde-fous, et S0 en fournit la sauvegarde).

### 2.2 Lots de S0 : ce que chacun produit et qui le réutilise

Ordre d'exécution **révisé** (recommandation de Claude, suite à la demande de Saar : le lot qui touche une route de production passe le plus
tard possible, les lots purs et additifs en premier).

| Ordre | Lot | Produit (réutilisable) | Réutilisé par |
|---|---|---|---|
| 1 | **L1a** (4 sous-lots, plan exact dans `PLAN_EXPORT_CARTE.md` §12) cœur pur `shared/` : plafonds `MAP_LIMITS` (banc d'essai), garde structurelle, types stricts, enveloppe et réglages (`mapSettings.js`, source unique aussi pour L0a), règles de modèle (résolveur injecté), fixtures | `MAP_LIMITS` modifiable ; **banc d'essai de compilation** ; module de fixtures ; validation stricte d'un document | S2 (limites recalibrées pour les contours, fixtures de formes), S3 (clés de `surface_data`), ticket `SURFACE-DOC-NO-BOUNDS`, v2a/v2b (mêmes garde-fous) |
| 2 | **L1b** point d'entrée de migration de `surface_data` | `migrateSurfaceData` ; fixtures d'export v12 | **S2 (étape 12→13)**, S3, chargement normal d'une carte ancienne |
| 3 | **L0b** `AppError` / `errorHandler` avec `params` | erreurs traduisibles nommant un élément | L2, L3, L4b, tout futur refus (S2, S3, v2) |
| 4 | **L2** export serveur | route `GET …/export` | L4, v2a (s'étend) |
| 5 | **L0a** `insertBattlemapFromSurface` + liste de réglages + test avec base (touche « Dupliquer ») | création de carte unique et testée | L3, v2a (entités insérées dans la même transaction), correction de « Dupliquer » (ticket), purge (retire le paramètre `voxelData`) |
| 6 | **L3** import serveur | `prepareImport`, deux passes | v2a, v2b |
| 7 | **L4a** `registerFlush` ; **L4b** `useMapTransfer` + i18n ; **L4c** fenêtre + bouton | vidange asynchrone de l'éditeur ; hook | outils d'édition de S2 (tout besoin « lire l'état persisté »), v2 |
| 8 | **L5** clôture | `docs/SYSTEME/EXPORT_CARTE.md`, migration dans `SURFACES_SALLES.md` | tous |

Cet ordre remplace celui de `PLAN_EXPORT_CARTE.md` §9 (numérotation des lots inchangée, ordre d'exécution révisé). Justification : L1a,
L1b et L0b sont **additifs** (aucun comportement existant ne change) et L2 ne fait que lire ; la seule modification d'une route de
production (« Dupliquer », L0a) n'arrive qu'au moment où L3 en a besoin, avec le cœur pur déjà en place.

### 2.3 Portes de décision (points de non-retour)

- **G1 — fin de S0** : aller-retour export → import validé par Saar sur sa carte réelle ; sauvegarde personnelle effectivement produite.
  Rien de S1/S2 ne démarre avant.
- **G2 — fin du cadrage S1** : identité d'arête, autorité de la forme, migration cases → contours, interface : validés par Saar
  **avant** tout code de S2.
- **G3 — avant toute migration de cartes existantes (S2)** : export vérifié de chaque carte concernée.
- **G4 — avant la purge** : sauvegarde de la base vérifiée, accord explicite de Saar élément par élément.

### 2.4 Inventaire des ancres à préserver au moment de S2 (`[VÉRIFIÉ]` le 2026-09-26)

Tout ce qui référence la géométrie par des clés dérivées des coordonnées devra survivre (ou être migré) quand un sommet bouge :
`boundaryArcs`, `wallElevationProfiles`, `wallAppearanceProfiles`, `openWallEdgeKeys`, `wallPaths` de tranche, portes et ascenseurs
(coordonnées, `curveId`, `curveOffset`), décorations murales (S3), **et les ancrages muraux des objets posés**. Ces derniers ne sont
**pas** dans `surface_data` : `entities.state.placement.wallId` (table `entities`) est une clé dérivée des coordonnées du panneau
(`room-wall:x:…`, `roomWalls.js` `roomsWallSegments`) — corrige l'hypothèse « dérivé des clés legacy de salle ». Conséquences :
(1) l'export v2a reste valide (coordonnées inchangées à l'import) ; (2) la migration de S2 devra **aussi réécrire des lignes de base**
et les entités contenues dans d'anciens exports (chaîne de migration du format d'export, pas seulement de `surface_data`).

### 2.5 Registre d'incertitudes (ce dont je ne suis pas sûr à 100 %)

| # | Incertitude | Où elle sera levée |
|---|---|---|
| U1 | Le branchement de la route « Dupliquer » n'est couvert par aucun test machine | clic de Saar après L0a |
| U2 | Cause exacte de la lenteur de compilation (croissance plus rapide que la surface) ; nécessité d'un `worker_thread` | banc d'essai L1a ; ticket `WORLD-COMPILE-SUPERLINEAR` |
| U3 | Politique des clés inconnues **dans les éléments** de `surface_data` : une liste blanche couple chaque futur ajout de champ (S2, S3) au validateur | L1a ; recommandation : plafonds + clés dangereuses + liste blanche de premier niveau seulement, sauf schéma partagé étendu par S2/S3 |
| U4 | Le schéma de S2 (contours, identités d'arête) peut changer profondément `surface_data` : la migration 12→13 sera « la première vraie » | G2 ; fixtures d'export v12 (L1b) |
| U5 | Comportement du rendu si un modèle est introuvable (pas d'`ErrorBoundary` autour des portes) | contourné : `modelGlbUrl = null` |
| U6 | Contenu exact du champ `source` des effets, et ce que fait `VoxelBuilderTab` | v2b ; purge |
| U7 | Sources web des analyses E non relues intégralement | cadrages concernés |
| U8 | Sémantique fine de `registerFlush` (conflit 409, échec réseau) | L4a, validation de Saar |
| U9 | Types stricts d'un import : durcir le validateur de production risque de rejeter des cartes historiques légitimes (coordonnées de sols lues dans des clés textuelles) | L1a-3, exploration avant code |

### 2.6 Pertinence du travail préparatoire (réponse à la demande de Saar)

Chaque lot de S0 a au moins deux consommateurs ci-dessus ; **aucun n'est jetable**. Les plus risqués pour la suite sont **L1a** (politique des
clés inconnues, U3) et **L1b** (première migration réelle, U4) : ils sont placés en premier **parce qu'ils sont purs et testables sans
toucher au fonctionnement actuel**, et parce qu'ils fixent le contrat que S2 devra respecter. À l'inverse, on n'a pas encore écrit une
ligne du code de S2 : **S1 n'est pas spécifiable maintenant** (c'est son rôle) ; le plan complet en fixe le cadre (§2.1, §2.3, §2.4), pas
le détail.

## 3. Cible de l'export et décisions S0

L'export sert à se protéger de la perte de la base et à partager une carte entre campagnes et entre créateurs. Il est livré par
versions : **v1 = la carte seule**, puis entités, effets, assets. **Toutes les décisions, le périmètre, le format, les lots et les
questions de S0 vivent dans `PLAN_EXPORT_CARTE.md` (seule autorité, Règle 2)** ; ce document ne les recopie pas.

## 4. Points durs déjà identifiés (`[VÉRIFIÉ]` le 2026-09-26 — à re-vérifier au cadrage du segment concerné)

1. **Identité d'arête** — `roomBoundaryEdgeKey` (`shared/world/roomGeometry.js:56`) dérive la clé des
   coordonnées (`edge:x:z|x:z`). `boundaryArcs`, `wallElevationProfiles`, `wallAppearanceProfiles`,
   `openWallEdgeKeys` et les `wallPaths` de tranche (`sourceEdgeKeys`, `curveArcId`) sont indexés dessus.
   Les connecteurs persistés **ne** stockent **pas** de clé d'arête (correction 2026-09-26, vérifié
   `client/src/lib/connectors.js`) : une porte dépend de coordonnées fines, de `curveId` (= `arc.id`, hash des
   clés) et de `curveOffset`. Déplacer un sommet invalide toutes les clés touchées, et le modèle actuel ne sait
   pas représenter un sommet non entier (arêtes = arêtes unitaires du réseau entier, `roomBoundaryEdges`).
   **Bloquant pour S2 et S3** : une stratégie d'identité stable doit être tranchée en S1.
2. **Autorité de la forme** — la forme d'une salle vient de `cells` + `boundaryArcs` + `geometryClipRoomIds`
   (`roomBoundaryMultiPolygon`), sauf si `verticalProfile.slices[]` est explicite (sa première tranche l'emporte,
   `roomGeometry.js:927-929`). Le primitif de S2 ne doit pas créer un second modèle de contour (invariant 2) ;
   la question « cases vs contours : migration ou coexistence » est à trancher en S1.
3. **Logique d'édition côté client** — les opérations (créer, fusionner, arrondir, supprimer un mur) vivent dans
   `client/src/lib/surfaceRooms.js` ; le serveur ne fait que valider. Ce qui remonte dans `shared/world/` est une
   décision d'autorité de S1 (invariant 3).
4. **Périmètre d'une carte** — `POST /api/battlemaps/:id/duplicate` copie `surface_data`, `voxel_data`, la grille
   et l'usage des textures, mais **ni les entités (`entities`), ni les effets monde, ni les états runtime**.
   L'export doit définir explicitement son périmètre (S0).
5. **Taille des points d'entrée** — `Editor3D.jsx` (~1580 lignes) et `SurfaceEditorScene.jsx` (~1270 lignes)
   concentrent les modes d'outil ; le Lot 0 de `PLAN_RW_MATERIAUX.md` (extraction en hooks) n'a jamais été fait.
   Les poignées de sommets s'y brancheront : à traiter au cadrage S1 (UI/UX), pas à contourner.

## 5. Méthode

- Analyses à charge **en lecture seule** d'abord (5 axes, 2026-09-26, voir §6), puis cadrage de S0.
- Chaque segment : cadrage → analyse à charge → plan exact (fichiers, invariant, hors-périmètre) → code → validation
  de Saar. Un segment à la fois. Recherche pro et dépôts GitHub avant toute mécanique non triviale.
- Réalisation déléguée à des agents : **pas maintenant**. Envisageable segment par segment, une fois son plan validé
  et critiqué, pour des lots réellement indépendants (candidats : S0 côté serveur, S4), en worktree isolé et avec
  relecture de chaque diff. Pas pour S2 (fichiers partagés, séquentiel).

## 6. Analyses critiques lancées le 2026-09-26 (lecture seule)

A. Forme des salles contre le code (identité d'arête, références, migration, autorité).
B. Décorations murales contre le code (ancrage, rendu plan/courbe, révisions).
C. Périmètre réel d'une carte pour l'export (tables, références, risques à l'import).
D. Rendu 3D des portes (composant réel, contrôleur multi-clips).
E. Recherche externe (édition sommets/arêtes, formats d'export/partage de cartes, decals).

Les conclusions retenues seront ajoutées **dans la section du segment concerné**, jamais dupliquées ici.

## 7. Acquis des analyses A→E (2026-09-26)

Rapports d'agents lus, points décisifs revérifiés dans le code par Claude (les sources web de E ne sont pas
revérifiées : l'agent a lu des résumés d'outil, pas le texte brut). Ce qui suit est un état des lieux pour les
cadrages, **pas une décision**.

### S0 — Export / import (analyses C, E axe 2, puis analyse à charge)
Résultats consignés et intégrés dans `PLAN_EXPORT_CARTE.md` (référence unique). Deux constats intéressent les autres segments :
- l'ancienne chaîne de migration de `surface_data` **n'existe pas** (`validateSurfaceData` accepte 1..12, `normalizeSurfaceDataDocument`
  réécrit `version: 12`) : S0 (lot L1b) crée le point d'entrée, S2 y ajoutera l'étape 12→13 et devra continuer d'importer les exports v12 ;
- un fichier tiers est une entrée hostile : les plafonds structurels et la validation stricte du document (lots L1a) profitent aussi à
  `PUT /surface` (ticket `SURFACE-DOC-NO-BOUNDS`).

### S1/S2 — Forme des salles (analyse A, + E axe 1)
- `[VÉRIFIÉ]` Le modèle actuel ne sait pas représenter un sommet non entier (arêtes = arêtes unitaires du réseau
  entier, `roomBoundaryEdges`).
- `[VÉRIFIÉ]` Deux modèles de forme coexistent déjà : `cells` et `verticalProfile.slices[]` ; après fusion ils
  peuvent se contredire (`applyRoomBoundaryArc` ne touche que `boundaryArcs`). Un contour source de vérité
  consoliderait cet état au lieu d'ajouter un modèle.
- Le contour éditable doit être **multi-anneaux et par tranche** (trous, îlots) : le « polygone simple à une
  boucle » du stub §6 est incompatible avec le modèle.
- Une porte sur mur oblique droit est aujourd'hui refusée (`curveId` obligatoire sur porte `segment`,
  `doorMatchesWall` ne relie `segment` qu'à un mur `arc`). Autres limites dès l'angle libre : déduplication des
  murs mitoyens en T, écart rendu exact / dalles par case, validateur sans contrôle d'auto-intersection.
- Le serveur ne valide que le schéma, jamais le résultat d'une fusion/arrondi : l'autorité de fait est le client.
- Options examinées : identité d'arête persistante portée par un contour source de vérité (recommandée par A et E)
  vs remappage de clés à chaque geste (écarté : identité calculée depuis la géométrie, sommets non entiers
  impossibles). Migration en une fois plutôt que coexistence (v12 a déjà choisi « pas de compatibilité » une fois).
  Pratique externe : sommet = enregistrement à id stable + ordre séparé (tldraw), annulation par deltas avec marques de
  geste, snap en couche séparée, CSG encapsulé dans un seul service (`polygon-clipping` : classe d'erreurs connue).
- Questions pour le cadrage S1 : angles libres ou non ; sol par case ou contour exact ; migration ; ancrage d'une porte
  quand son arête change de longueur ; le serveur rejoue-t-il l'opération ; anneau simple ou multi-anneaux (voir
  ci-dessus : multi-anneaux) ; identifiant d'ancrage des décals.

### S3 — Décorations murales (analyse B, + E axe 3)
- `[VÉRIFIÉ]` **Piège de perte silencieuse** : `normalizeSurfaceData` client (`surfaceCore.js:50-76`) reconstruit le
  document avec une liste fermée de clés ; une clé top-level nouvelle est effacée à la sauvegarde. Vaut pour toute
  donnée future (décors, métadonnées).
- `[VÉRIFIÉ]` « Pas de recompilation » impossible en l'état : chaque `PUT /surface` incrémente `world_revision` et
  recompile ; un décor posé en partie ferait passer `worldChanged` des plans de déplacement en attente
  (effet côté client : `[INCONNU]`). Le compilateur ignore naturellement les décors.
- `[VÉRIFIÉ]` Aucun id de panneau de mur n'est stable (dérivé des coordonnées ou d'un hash) ; les UV du mur ne sont
  pas un contrat exploitable ; la face est décalée de l'épaisseur ; un profil vertical courbe rend « mur plan »
  ambigu ; le relief réel déplace les sommets de ±0,12 ; portes et transparence de coupe s'appliquent au rendu.
- `[VÉRIFIÉ]` Deux collecteurs d'ids de textures divergent (le client omet `wallAppearanceProfiles[].interiorTex`).
- Ancre : clé d'arête + id de salle + fraction (seule option supportée aujourd'hui), stockée par salle
  (`room.wallDecorations[]`), avec une fonction unique de résolution ancre → surface ; à remplacer par l'id stable de S2.
  L'upload de textures exige des multiples de `tile_size` : inadapté aux affiches (ratio libre, alpha).
- Ruban généré depuis l'arc analytique pour les murs courbes = `[HYPOTHÈSE]` de E, non testée (prototype requis).
- Sept questions produit dans le rapport B (face vs mur entier, porte recouverte, comportement à la fusion, 2D seul…).

### S4 — Rendu 3D des portes (analyse D)
- `[VÉRIFIÉ]` C'est d'abord un trou de câblage : `Canvas3D.jsx:2090` et `Editor3D.jsx:1513` passent
  `runtimeElevatorStates` au rendu ; une porte reçoit donc un état runtime vide. `SurfaceDungeonScene` ne lit aucune
  animation. La formule d'état effectif existe en double (compilateur, panneau) et serait triplée : helper partagé requis.
- Contrôleur des caisses (`EntityMesh.jsx`) extractible en hook partagé (modes rattrapage lissé / rampe linéaire,
  arrêt à l'équilibre, test de non-régression caisses) — `[HYPOTHÈSE]` à valider ; **amende** la phrase du Lot C
  « pas une extension du contrôleur EntityMesh ».
- 8 GLB de portes : clips lus dans les fichiers (1 pivot, 1 pivot + volant, 2 coulissants, 1 panneau de hangar
  à +3,3 m pour un étage de 2,5 m, 3 clips pour la triangulaire), tous à 24 fps, pose de repos = fermé ; une seule
  progression commune suffit. Le serveur ne fournit aucune phase de transition : animation pilotée par l'état cible
  + temps local recommandée, collision/LOS restant instantanées (à accepter ou refuser par Saar).

### Dettes structurelles rencontrées en chemin
Neuf tickets `bug_tickets` créés le 2026-09-26 : `BATTLEMAP-DUPLICATE-INCOMPLETE`, `SURFACE-TEXTURE-COLLECTORS-DIVERGE`,
`DOOR-EFFECTIVE-STATE-DUPLICATED` (à traiter avec S4), `DOC-ROADMAP-DECALS-LINE-STALE`, `ASSETS-ROUTE-NO-AUTH`,
`CONNECTOR-MODEL-URL-ABSOLUTE`, `SURFACE-DOC-NO-BOUNDS`, `TEXTUREPACKS-IMPORT-ERROR-OBJECT`, `MAP-SCALE-NO-AUTHORITY`.
Une dernière n'est pas un ticket mais une question de S1 : le serveur ne valide pas le résultat des opérations d'édition
(fusion, arrondi). Le piège de la liste fermée de clés de `normalizeSurfaceData` côté client (S3) est couvert par
`MAP-SCALE-NO-AUTHORITY`.

## Historique

- **2026-09-26** — création. Segmentation S0→S4 validée par Saar ; export = sauvegarde perso v1 puis partage
  entre créateurs ; analyses A→E lancées.
- **2026-09-26** — S0 : cadrage et analyse à charge dans `PLAN_EXPORT_CARTE.md` ; blocs S0 de ce document réduits à des renvois.
- **2026-09-26** — feuille de route complète (§2) : lots, réutilisations, ordre d'exécution de S0 révisé, portes de décision, inventaire des ancres de S2, registre d'incertitudes ; à valider avant tout code.
