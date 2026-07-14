# SYSTEME/MOTEUR_MONDE.md — architecture physique, navigation et visibilité

> Dernière mise à jour : 2026-07-14 — Phase 15, contrat v12 et coupe multi-étages.
>
> Statut : **Phases 0 à 14 implémentées. Le snapshot est l'autorité physique de l'éditeur, de
> la session et du combat.**
>
> Lire pour : tout travail touchant le monde 3D, les coordonnées, les surfaces praticables, les
> collisions, les déplacements, les connecteurs, les lignes de vue, les zones ou les effets
> environnementaux.

Documents associés :

- `docs/SYSTEME/SURFACES_SALLES.md` — contrat de l'éditeur Salle et des surfaces ;
- `docs/PLAN_MOTEUR_MONDE.md` — ordre de migration et critères de validation ;
- `docs/FUSION_PROJET_COUSIN.md` — procédure et autorités pour une future fusion combat/monde ;
- `docs/SYSTEME/COMBAT.md` — déroulement du combat consommateur du moteur de monde ;
- `docs/REGLES/REGLESYSCOMBAT.md` — autorité Polaris pour les allures et les contraintes de terrain.

---

## 1. Décision d'architecture

Le monde doit devenir une autorité autonome, partagée par l'éditeur, la session et le combat.

```text
Éditeur
  -> document statique versionné
  -> compilateur du monde
  -> snapshot physique immuable
       -> déplacement
       -> collisions et occupation
       -> lignes de vue et couverture
       -> propagation eau/gaz et effets
       -> moteur de combat
```

Le combat ne doit plus connaître directement `voxel_data`, `surface_data`, Three.js ou Redis. Il
demande au moteur de monde si un déplacement, une visibilité ou une interaction spatiale est
possible.

Principes obligatoires :

1. une seule définition statique du monde ;
2. un snapshot physique dérivé et versionné ;
3. un serveur autoritaire pour les conséquences de jeu ;
4. une séparation stricte entre définition éditée, état de partie et apparence 3D ;
5. toutes les règles utilisent des unités explicites, jamais des coordonnées brutes supposées être
   des mètres ;
6. une propriété physique est définie une fois puis consommée par tous les systèmes.

---

## 2. État existant au 2026-07-13

### 2.1 Éditeur Surface `[EXISTANT]`

`battlemaps.surface_data` version 12 contient actuellement :

- `rooms`, `floors`, `walls`, `ceilings`, `stairs`, `connectors` ;
- les drapeaux `walkable`, `blocksMovement`, `blocksSight` ;
- des portes et ascenseurs structurels avec une apparence GLB attachée ;
- une hauteur d'étage d'éditeur (`STORY_HEIGHT`) et une grille fine (`SURFACE_FINE`) ;
- des `verticalProfile.slices` pour les volumes dont l'empreinte change selon la hauteur ;
- des `wallElevationProfiles` pour les murs courbes ou cassés vus en coupe ;
- des `wallAppearanceProfiles` pour l'apparence propre aux faces de chaque mur logique ;
- un calcul client d'étanchéité utilisé pour le rendu de l'eau.

Cet ensemble reste normalisé et rendu côté client par `client/src/lib/surfaceData.js`. À la
sauvegarde, `shared/world/surfaceDocument.js` le valide côté serveur, le normalise en version 12 et
persiste les UUID physiques absents. `shared/world/worldCompiler.js` en dérive ensuite le snapshot
physique autoritaire. Le renderer n'utilise pas encore ce snapshot pour fabriquer ses meshes.

### 2.2 Collisions et occupation `[EXISTANT — PHASE 7]`

Redis et son hash de collision ont été supprimés. `shared/world/spatialIndex.js` sépare :

- les colliders statiques compilés depuis le document monde ;
- les tokens et entités volumiques relus depuis PostgreSQL ;
- les supports praticables et les traversées ;
- les exclusions temporaires nécessaires à un mouvement atomique.

Plusieurs occupants peuvent partager un bucket d'index sans s'écraser. Toute création,
suppression, mutation d'état ou déplacement dynamique incrémente `runtime_revision`.

### 2.3 Déplacement de combat `[EXISTANT — PHASE 7]`

La déclaration ne stocke plus une simple case finale : elle conserve destination monde, allure
dérivée, plan explicable, budget en mètres et révisions observées. Le client peut demander une
destination, mais ne choisit ni le coût, ni l'allure suffisante, ni le modificateur d'initiative.

À la résolution, `executeBattlemapTokenMovement` verrouille la battlemap, réconcilie l'ascenseur,
recharge les occupants et effets, puis recalcule le chemin. Le token s'arrête exactement au budget
ou au dernier point stable. Le plan annoncé sert à expliquer un changement de monde, jamais à
contourner l'état courant.

### 2.4 Ligne de vue voxel `[LEGACY RETIRÉ DES CONSOMMATEURS]`

`shared/losUtils.js` a été supprimé. `server/src/lib/losService.js` et la caméra appellent le moteur
de visibilité du snapshot.

Le calcul Phase 3 prend désormais en compte :

- murs, portes et plafonds issus de `surface_data` ;
- volumes et rotation des entités ;
- transparence du verre/de la grille et opacité cumulée des volumes ;
- postures debout, accroupie et couchée ;
- couverture par quatre rayons anatomiques et acteurs interposés.

La persistance et la propagation de fumée/gaz arrivent en Phase 5 ; le moteur sait déjà recevoir ces
volumes comme occluders dynamiques atténuants.

### 2.5 Unités `[RÉSOLU — PHASE 7]`

Allures, chemins, portées d'arme, corps à corps, encerclement et interactions d'entité sont
exprimés en mètres. Les adaptateurs `pos_x/pos_y/pos_z` restent confinés à la frontière DB ; une
distance de règle passe toujours par `WorldMetrics` et utilise les trois axes.

### 2.6 Index des textures `[RÉSOLU — PHASE 1]`

Les deux routes appellent désormais `syncBattlemapTextureUsage(...)` dans leur transaction. L'index
est recalculé comme l'union de `voxel_data` et `surface_data` ; sauvegarder une représentation ne
peut plus effacer les usages de l'autre.

### 2.7 Socle partagé et compilation `[EXISTANT — PHASES 0 ET 1]`

Le dossier `shared/world/` fournit désormais :

- `worldMetrics.js` : conversions canoniques en mètres, hauteurs et adaptateurs PE14 ;
- `movementCost.js` : facteurs explicables, segments pondérés et arrêt à budget épuisé ;
- `worldContracts.js` : contrats versionnés et immuables `WorldDocument`, `WorldRuntimeState` et
  `WorldSnapshot` ;
- `surfaceDocument.js` : validation de schéma, normalisation v6, UUID physiques stables et adaptation
  de `surface_data` vers `WorldDocument` ;
- `worldCompiler.js` : compilation pure des supports, barrières, portails, colliders, occluders,
  traversées verticales et compartiments ;
- `index.js` : point d'entrée commun client/serveur ;
- `spatialIndex.js` et `navigation.js` : index statique, occupation dynamique, graphe 3D pondéré et
  planification autoritaire ;
- soixante-dix-sept tests Node, dont Jon, les portes, les occupants multiples, les budgets partiels, le
  placement sur support, les canaux de matériaux, la couverture et les occluders dynamiques.

La route Surface compile le document avant de le valider en base et
`GET /api/battlemaps/:id/world-snapshot` expose le résultat mis en cache par carte/révision. La
navigation de session, la LOS, les interactions physiques et le combat utilisent ces services. Les
anciens fichiers Redis, pathfinder client et LOS voxel ont été supprimés.

### 2.8 Persistance et révisions `[EXISTANT — PHASE 1]`

La migration 152 ajoute trois compteurs :

- `world_revision` change après toute modification d'une source physique ;
- `surface_revision` protège uniquement les éditions de `surface_data` ;
- `voxel_revision` protège uniquement les éditions de `voxel_data`.

Cette séparation est obligatoire tant que l'éditeur sauvegarde les deux documents via deux requêtes
distinctes. Utiliser seulement `world_revision` pour l'optimistic locking ferait entrer en conflit
les deux autosauvegardes d'un même éditeur. Chaque route verrouille la ligne `battlemaps`, compare sa
révision documentaire, met à jour données/révisions/index texture dans une seule transaction, puis
invalide ou remplit le cache du snapshot.

La réponse d'écriture doit contenir les trois colonnes de révision demandées à PostgreSQL ; elles
sont passées à Knex sous forme de tableau, jamais comme arguments positionnels ambigus. Sur un
conflit `surface_revision`, l'éditeur compare le document courant du serveur à la dernière base qu'il
a effectivement reçue. Il peut reprendre automatiquement une réponse perdue, mais refuse d'écraser
une modification concurrente réelle. `boundaryArcs` est inclus dans ce round-trip au même titre que
le reste de `surface_data`.

La duplication d'une carte réattribue tous les UUID physiques : deux cartes copiées ne doivent
jamais pointer vers le même futur état runtime.

### 2.9 Navigation et positions runtime `[EXISTANT — PHASE 2]`

- `tokens.position_space` vaut `world-feet` pour toute nouvelle position ; une ligne historique vaut
  `legacy-cell` et ne peut pas se déplacer tant qu'un MJ ne l'a pas replacée explicitement ;
- `battlemaps.runtime_revision` change après mouvement ou téléportation ;
- le point stocké est le contact des pieds dans le monde : `pos_x = X`, `pos_y = profondeur Z`,
  `pos_z = altitude Y` ;
- `POST /api/battlemaps/:id/world-path-preview` ne fait qu'un aperçu ;
- `POST /api/battlemaps/:id/world-move` dérive le budget de la fiche, verrouille le monde et persiste
  la position atteinte ;
- `POST /api/tokens/:id/teleport` est le bypass MJ explicite ;
- les créations de token se calent sur le support stable libre le plus proche à 1,25 unité monde ;
- le client raycaste les meshes marqués `worldSupport` et ne choisit jamais une case vide.

La compatibilité des anciennes cartes n'est pas un objectif. Leurs données peuvent rester présentes
pour des comparaisons, mais ne doivent provoquer ni adaptateur approximatif ni double moteur.

---

## 3. Sources de vérité `[EXISTANT]`

### 3.1 Document statique du monde

Le document édité décrit ce qui est construit :

- géométrie logique des salles, supports et barrières ;
- définitions des connecteurs ;
- matériaux et apparences ;
- propriétés physiques par défaut ;
- multiplicateurs de déplacement définis par le MJ ;
- identifiants stables et version de schéma.

Nom provisoire : `world_document`. `surface_data` peut rester le champ de stockage pendant la
migration, à condition que son schéma soit validé et versionné.

Chaque objet métier possède un UUID stable. Déplacer ou redimensionner un objet ne doit pas changer
son identité.

### 3.2 État de partie

Les états susceptibles de changer pendant une partie ne résident pas dans le document statique :

- porte ouverte, fermée, verrouillée ou endommagée ;
- ascenseur à l'arrêt, en déplacement, étage actuel et portes ;
- passerelle mobile déployée ou détruite ;
- feu, gaz, huile ou inondation actifs ;
- occupants et passagers.

Ils appartiennent à des enregistrements runtime reliés à l'UUID de la définition. Une sauvegarde de
l'éditeur ne doit jamais écraser un état de partie actif.

### 3.3 Snapshot physique

Le `WorldCompiler` transforme le document statique et les états runtime en un `WorldSnapshot`
immuable associé à une `worldRevision`.

Le snapshot contient au minimum :

- surfaces de support praticables ;
- nœuds et arêtes de navigation pondérées ;
- barrières entre espaces ;
- volumes de collision et d'occultation ;
- compartiments et graphes de perméabilité ;
- régions et effets actifs ;
- index spatiaux nécessaires aux requêtes rapides.

PostgreSQL reste la source durable. Aucun cache Redis de collision, de navigation ou de snapshot
n'est utilisé par le moteur du monde.

Le compilateur doit être une logique pure partageable : le client peut l'utiliser pour la
prévisualisation de l'éditeur, mais le serveur compile ou vérifie la version autoritaire.

Implémentation actuelle : le snapshot contient `supports`, `barriers`, `traversals`, `colliders`,
`occluders`, `compartments` et `regions`. L'ascenseur est compilé comme une cabine physique mobile ;
il ne crée jamais d'arête verticale ni de téléportation entre paliers.

---

## 4. Unités et coordonnées `[EXISTANT]`

Un module unique `WorldMetrics` fournit :

- conversion case <-> mètres ;
- conversion coordonnée logique <-> mètres ;
- conversion hauteur d'étage <-> mètres ;
- calcul des longueurs et portées ;
- arrondis et tolérances autorisés aux frontières de cellules.

Valeur de campagne par défaut : `metersPerCell = 1.5`.

Les données de règles et les coûts de déplacement sont exprimés en mètres. Les coordonnées de rendu
Three.js peuvent conserver une autre échelle, mais aucun calcul de règle ne compare directement une
coordonnée Three.js à une distance Polaris.

Une hauteur d'étage, une taille d'acteur et une dimension d'objet doivent donc avoir une valeur
physique canonique, même si le renderer applique ensuite un facteur visuel.

---

## 5. Navigation et coût du déplacement `[EXISTANT]`

### 5.1 Représentation

Le moteur utilise un graphe ou une lattice 3D pondérée adaptée à une grille tactique :

- un nœud représente une position stable sur un support praticable ;
- une barrière bloque une transition entre deux nœuds, pas nécessairement toute une cellule ;
- une arête décrit une portion de parcours et son mode ;
- les escaliers et échelles ajoutent des arêtes verticales échantillonnées ;
- une passerelle ajoute un support praticable en hauteur ;
- une porte active ou désactive une transition selon son état.

La longueur réelle de chaque segment est calculée par `WorldMetrics`. Une éventuelle règle tactique
différente pour les diagonales doit être une stratégie explicite, jamais un effet implicite de
l'algorithme.

### 5.2 Formule de coût

Pour chaque segment :

```text
coût effectif = distance physique en mètres
              × facteur du mode de traversée
              × facteur statique de la surface
              × facteurs des effets actifs
              × facteurs de l'acteur et de son équipement
```

Les catégories sont distinctes afin d'expliquer le calcul et de contrôler les cumuls. Les règles de
stacking de chaque catégorie doivent être déterministes.

Exemple de référence obligatoire :

```text
Jon dispose de 15 m.
Sol :     3 m × 1 = 3 m.
Échelle : 3 m × 2 (grimper) × 2 (barreaux glissants) = 12 m.
Total :   15 m ; Jon s'arrête sur l'échelle après 3 m de montée.
```

Ce scénario constitue un test doré permanent du moteur.

### 5.3 Plan de déplacement

Le client envoie une intention : acteur, destination souhaitée et allure. Le serveur retourne un
plan canonique composé de segments :

```js
{
  from,
  to,
  mode,
  distanceM,
  factors,
  costM,
  cumulativeCostM
}
```

Le serveur déduit l'action, le coût d'initiative et la position réellement atteignable. Le client
ne décide plus de `action_key` ou `ini_mod`.

Si le budget est épuisé sur un escalier ou une échelle, le token s'arrête au dernier ancrage valide
ou à une progression interpolée persistable. Il n'est jamais téléporté à l'autre extrémité.

En combat, le plan et sa `worldRevision` sont conservés avec l'action. À la résolution, les états
dynamiques et l'occupation sont revalidés ; le moteur replannifie ou tronque selon une politique
explicite.

Le même service traite déplacement de combat, déplacement libre autorisé et mouvement forcé. Seul
un déplacement administratif du MJ peut contourner la navigation, avec une commande distincte de
type téléportation.

---

## 6. Connecteurs verticaux `[EXISTANT, SAUF ASCENSEUR MOBILE]`

Un connecteur possède :

- UUID stable ;
- entrées, sorties et ancrages intermédiaires ;
- niveaux reliés ;
- modes de traversée autorisés ;
- coût de base et multiplicateur éditable ;
- conditions d'utilisation ;
- propriétés de mouvement, vision et perméabilité ;
- apparence optionnelle séparée.

### Escalier

Parcours continu ou échantillonné de type marche. Les tokens peuvent s'y arrêter et y combattre si
la règle de surface le permet.

### Échelle

Parcours vertical de type grimpe. Il contient assez d'ancrages pour persister un token entre deux
étages. Le mode course n'y est pas disponible par défaut.

### Passerelle

Support praticable surélevé. Une passerelle fixe appartient au monde statique. Une passerelle
mobile ou destructible est une feature runtime possédant un composant de support praticable.

### Ascenseur

Plateforme ou cabine mobile avec :

- liste d'arrêts ;
- position ou arrêt actuel ;
- portes de cabine et portes palières ;
- automate `idle/opening/open/closing/moving/blocked` ;
- temps de trajet et règles d'appel ;
- passagers attachés au référentiel de la cabine pendant le déplacement.

L'ascenseur n'est pas une téléportation entre connecteurs. Sa définition est statique ; son automate
et sa cabine appartiennent à l'état runtime.

### Implémentation Phase 4

- `surface_data.stairs` et les connecteurs `ladder` deviennent des traversées explicites du
  snapshot avec leurs points d'entrée/sortie physiques et leur multiplicateur MJ ;
- les ancrages d'une échelle sont espacés par défaut de 0,5 unité monde et le graphe respecte cette
  granularité ;
- une position déjà située sur une traversée crée un nœud transitoire au point exact sauvegardé,
  puis scinde l'arête : reprendre au tour suivant ne donne aucun déplacement gratuit ;
- `bridge` est une dalle de support structurelle. Son UUID est l'identité utilisée par l'état
  runtime pour la désactiver ou la marquer détruite sans réécrire sa définition ;
- l'éditeur construit la physique depuis des outils dédiés. Le rendu générique d'une échelle ou un
  futur GLB n'est qu'une apparence ;
- les labels du chemin présentent `distance × facteur = coût` pour les segments pondérés.

### Implémentation Phase 6

- un ascenseur compile une gaine évidée et une vraie cabine mobile : support praticable, plancher,
  plafond, parois, portes de cabine et compartiment ;
- chaque palier possède une barrière physique. Elle ne s'ouvre que si la cabine est exactement
  alignée et que l'automate est en phase `open` ;
- le graphe ne contient jamais de traversée verticale d'ascenseur. Il ne produit qu'une courte
  traversée d'embarquement lorsque cabine et palier sont compatibles ;
- l'automate pur `elevatorRuntime.js` persiste phase, position, arrêt courant, destination, file,
  échéances, blocage et état de reprise dans `world_feature_states` ;
- `worldElevatorService.js` avance cette horloge sous verrou de battlemap. Les appels concurrents
  sont ordonnés par date puis identité stable ; aucun timer en mémoire n'est une autorité ;
- `world_elevator_passengers` attache au plus une cabine à un token et stocke sa position locale.
  Toute réconciliation déplace ces tokens dans la même transaction avant navigation ou visibilité ;
- le renderer interpole la cabine depuis les mêmes échéances, tandis que le serveur reste
  l'autorité des collisions, des portes, de l'occupation et des lignes de vue ;
- les anciennes cartes ne justifient aucun mode de compatibilité. Une fixture legacy peut rester
  uniquement si elle ne modifie pas les contrats du monde canonique.

---

## 7. Collisions, occupation et entités `[EXISTANT]`

La topologie statique et l'occupation dynamique sont deux couches différentes.

- un mur ou une porte est généralement une barrière entre deux espaces ;
- une entité possède un ou plusieurs colliders avec dimensions et rotation ;
- un token possède un volume ou profil corporel ;
- plusieurs éléments peuvent partager la même cellule logique ;
- l'index spatial retourne tous les candidats, pas un unique `{type,id}` ;
- l'occupation temporaire ne provoque pas la recompilation de toute la géométrie statique.

Une entité 3D est composée de capacités indépendantes : apparence, collider, occluder, support
praticable, perméabilité, danger, déclencheur. Le GLB n'est jamais la source physique : il visualise
les propriétés déclarées.

### 7.1 Tranche d'étage affichée

`displayLevel = N` signifie que la scène interactive ne contient que la tranche N. Les géométries,
entités, tokens et régions des niveaux inférieurs ou supérieurs ne sont ni rendus, ni raycastés, ni
utilisés comme supports de placement, sauf dans un volume ouvert explicitement décrit.

Une salle haute de plusieurs étages est un tel volume. Depuis une tranche supérieure, le renderer
conserve son véritable sol de base, toutes ses parois jusqu'au fond, ainsi que les entités, tokens et
régions plus bas dont le point monde se trouve dans son emprise horizontale et verticale. Cette
exception est locale : une salle basse adjacente ou empilée n'est pas révélée. Aucun plancher
intermédiaire n'est inventé et le plafond n'existe que dans la tranche supérieure. Les connecteurs
verticaux sont découpés par tranche ou exposent uniquement leur palier courant.

### 7.2 Murs courbes et contours de salles

Depuis `surface_data` v6, une courbe de salle est stockée dans `room.boundaryArcs`. Un arc référence
les arêtes logiques remplacées, ses deux extrémités, son angle central et son côté. Ce n'est pas un
mur décoratif superposé : `shared/world/roomGeometry.js` reconstruit un contour unique consommé par
les dalles, plafonds, murs, sélection et compilation physique.

Dans l'éditeur, les arêtes colinéaires sont regroupées en murs complets entre deux angles. Le MJ
sélectionne au moins deux murs voisins, règle l'angle de 5° à 175° avec un aperçu direct, peut
inverser le côté de l'arc, puis applique ou retire l'arrondi. Une sélection disjointe, un contour
fermé entier ou des murs ne partageant pas le même voisin sont refusés.

Depuis `surface_data` v8, l'arc circulaire est également l'autorité du mur. Le chemin canonique porte
son centre, son rayon, son angle initial, son balayage et sa longueur. Le renderer en fabrique un seul
mesh continu, avec normales radiales lissées et coordonnées UV calculées sur la longueur réelle de
l'arc. Une texture ne recommence donc pas à chaque subdivision visuelle.

Ses points de départ et d'arrivée restent toutefois les ancrages exacts du contour. La
tessellation calcule uniquement les points intermédiaires : elle force son premier et son dernier
point sur ces ancrages. Les regroupements client conservent les extrémités des panneaux sources et
le snapshot `wall-arc` expose `from` / `to`. Une erreur d'arrondi trigonométrique ne peut donc plus
séparer un arc de son mur droit voisin dans le rendu, les collisions ou la LOS.

Le compilateur produit un collider/occluder canonique `wall-arc`. Son AABB exacte sert au broadphase.
Le déplacement et la LOS peuvent échantillonner l'arc à l'intérieur de leur narrow phase, mais ces
segments temporaires ne sont jamais persistés et ne deviennent jamais l'autorité du monde. Modifier
la finesse du rendu ou du test étroit ne change donc ni l'identité du mur ni ses ouvertures.

Une porte peut être attachée à un mur X/Z droit ou à un arc. Sur un arc, son ancrage contient
l'abscisse curviligne, le point exact, la tangente et la normale locales. Le panneau de porte, qui
reste rigide, est tangent à la courbe ; son sens et les traversées utilisent la normale. L'ouverture
découpe le chemin canonique en portions d'arc avant/après et en linteau, même si elle aurait traversé
plusieurs anciennes subdivisions. Les anciens murs libres `axis: segment` restent lisibles, mais ne
sont pas le modèle d'un arrondi de salle.

### 7.3 Empreinte et propriété d'une salle

Depuis `surface_data` v5, `room.cells` décrit l'empreinte orthogonale. En v6,
`room.boundaryArcs` remplace des chaînes du contour. En v7, une courbe peut partager une case entre
deux salles : `cells` devient alors la graine de grille et de broadphase, tandis que le contour
effectif est l'autorité géométrique. `room.geometryClipRoomIds` soustrait les contours prioritaires
et `room.openWallEdgeKeys` transforme une frontière extérieure en ouverture. `minX`, `maxX`,
`minZ`, `maxZ` restent uniquement une AABB de broadphase.

La v8 ne change pas cette propriété du sol : elle rend le chemin de frontière canonique jusque dans
le mur compilé. `cells` reste l'index discret, le multipolygone reste l'autorité d'occupation et
`wall-arc` devient l'autorité continue pour collision, visibilité, rendu et ancrage des portes.

Créer une salle transfère les cases recouvertes des salles orthogonales dont le volume vertical
intersecte le sien. Face à une salle déjà courbe ou découpée, la salle existante est prioritaire et
la nouvelle reçoit une différence polygonale : elle épouse la frontière réelle même lorsque l'arc
dépasse sa boîte de cases. Les murs sont ensuite dérivés du contour effectif. Si les cases restantes
forment plusieurs composantes connexes, elles deviennent plusieurs salles et plusieurs
compartiments. Deux étages sans intersection verticale ne se retirent aucune case.

Les dalles droites peuvent être regroupées en rectangles. Dès qu'un arc ou une découpe existe, la
dalle et le plafond utilisent le multipolygone extrudé exact, trous compris. Murs, collisions, LOS
et compartiments suivent ce même contour. Le graphe actuel attache ses supports discrets aux centres
de cases contenus par la géométrie effective ; une évolution vers des supports polygonaux pourra se
faire sans changer l'autorité du contour.

### 7.4 Suppression et fusion de murs

La suppression porte sur un mur complet entre deux angles, jamais sur un fragment implicite :

- si une seule salle possède la frontière, ses clés sont ajoutées à `openWallEdgeKeys` ; le sol et
  le plafond restent présents, mais aucun mur, collider ou occluder n'est compilé ;
- si deux salles de même base possèdent la frontière, elles sont fusionnées même si leurs hauteurs
  diffèrent. La
  salle active conserve son identité physique, ses matériaux et ses réglages ; la salle absorbée et
  les portes de la séparation disparaissent, et les autres connecteurs sont remappés ;
- la fusion construit un `verticalProfile` canonique : union des empreintes présentes dans chaque
  tranche, plafond local sur toute zone qui s'arrête et murs de ressaut sur les zones qui continuent ;
- le nombre et la hauteur des niveaux sont redérivés de ces tranches après chaque fusion. Une salle
  déjà fusionnée peut donc être fusionnée à nouveau sans désynchroniser `heightLevels`, `height` et
  `verticalProfile.slices` ;
- la même dérivation est appliquée juste avant le `PUT` client puis avant la validation serveur. Les
  tranches contiguës sont l'autorité ; `heightLevels` et `height` sont des métadonnées dérivées. Le
  validateur brut reste strict, tandis que la frontière canonique répare uniquement ce décalage
  déterministe ;
- les arcs touchant la séparation sont retirés avant de reconstruire l'union, afin qu'une ancienne
  frontière courbe ne survive pas comme limite fantôme ;
- toute différence géométrique qui référençait la salle absorbée est réécrite vers la survivante.

La suppression d'une salle entière est également canonique : elle retire l'entrée de `rooms`, tous
les connecteurs qui la référencent, enlève son identifiant des `geometryClipRoomIds` restants et
réattribue à la salle survivante les arcs partagés dont elle était propriétaire. Aucun identifiant
de salle supprimée ne subsiste donc dans le document sauvegardé.

Le compilateur consomme ces mêmes données pour les canaux mouvement, vision, eau et gaz. Une
ouverture supprimée dans l'éditeur ne peut donc pas rester bloquante dans le snapshot serveur.

### 7.5 Profils verticaux de murs

`room.wallElevationProfiles` décrit la coupe verticale d'une face logique par `type`, `depth` et
`direction`. Le type est `curved` pour une courbe continue ou `faceted` pour un profil cassé. Le mur
vertical n'a pas d'entrée. Les clés d'arêtes conservent l'identité logique même si le même mur est
également un arc dans le plan.

`direction = 1` signifie toujours vers l'intérieur de la salle propriétaire et `direction = -1`
vers l'extérieur. Cette sémantique ne dépend pas de l'ordre des sommets : `roomBoundaryPaths`
calcule `interiorNormalSign` en sondant les deux côtés de la normale gauche contre le multipolygone
effectif de chaque tranche. Le renderer et `worldCompiler` consomment ce même signe dérivé.
Lorsque le compilateur réordonne un mur axial dans son sens canonique croissant, il permute aussi
ses profils avant/arrière et inverse `elevationProfileDirection` ; la normalisation d'identité ne
peut donc plus retourner la forme physique.

L'assemblage physique distingue deux cas :

- façade extérieure : un seul propriétaire, les deux faces suivent la même translation et
  l'épaisseur nominale reste constante ;
- mur mitoyen : chaque salle peut définir sa face intérieure. La face opposée reste fixe et la
  profondeur devient une variation d'épaisseur orientée vers la salle propriétaire.

Le renderer génère un maillage lofté continu à partir du chemin horizontal et des niveaux du profil.
Le compilateur ajoute le profil aux primitives `wall-segment`/`wall-arc`, élargit leur broadphase de
la profondeur maximale, puis `spatialIndex` le subdivise localement en bandes verticales uniquement
pour les tests étroits. Collision, mouvement et LOS voient donc la même forme que le rendu sans
faire de la tessellation une donnée persistée.

Chaque angle reçoit un descripteur dérivé `profileJoinStart` / `profileJoinEnd` par face physique.
Chaque face conserve les identifiants des salles dont elle est l'intérieur, puis choisit le voisin
portant la même salle. Une jonction en T au bout d'un mur mitoyen peut ainsi employer un voisin
différent pour chaque face. Le maillage recalcule à chaque hauteur l'intersection des volumes et ne
suppose plus que les deux murs ont le même profil : un mur vertical adjacent est lofté à son
extrémité si son voisin est profilé. Il reprend les niveaux verticaux du profil voisin afin que
l'intersection soit matérialisée par des sommets communs à chaque hauteur, y compris au milieu de la
courbe. Le snapshot ne
persiste pas cette finition ; le compilateur la redérive et transforme les mêmes intersections en
paddings longitudinaux sur les deux murs. Le narrow phase les applique seulement au premier ou au
dernier segment d'un arc tessellé. Rendu, mouvement et LOS ferment ainsi le même coin.

### 7.6 Apparence canonique des murs

`room.wallAppearanceProfiles[]` associe un ensemble d'`edgeKeys` à l'apparence intérieure du mur.
Chaque entrée peut porter `interiorTex` et `interiorMaterial`. Les matériaux procéduraux enregistrent matière, peinture,
motif, usure, saleté, relief et mode de relief réel.

Cette donnée appartient au mur logique, pas à la tessellation de son mesh. `roomBoundaryPaths`
résout le profil à partir des arêtes sources et le propage aux chemins droits comme aux arcs ; le
renderer l'applique ensuite à chaque panneau dérivé. Une fusion de salles conserve les profils des
arêtes restantes et retire ceux de la séparation supprimée. Le validateur v12 contrôle les clés,
les textures et les valeurs d'apparence entre 0 et 100. Le contrat v12 refuse les anciennes
apparences `exterior`, ainsi que les faces de salle `top/bottom` et `front/back`.

Les interfaces horizontales sont dérivées par altitude depuis les empreintes de sol et les régions
de plafond. Si un plafond et un sol coïncident, une seule interface est rendue : plafond depuis le
niveau inférieur, sol dès que le niveau supérieur est visible. Tous les niveaux inférieurs au plan
de coupe restent opaques. La transparence des murs ne s'applique qu'au niveau courant et au mur
logique complet ; les morceaux créés par une porte partagent le même groupe d'opacité et leurs faces
de coupe internes ne sont pas dessinées.

---

## 8. Vision et couverture `[EXISTANT]`

`VisibilityService` interroge le snapshot compilé :

- volumes occultants des murs, plafonds et entités ;
- état des portes ;
- canaux des matériaux ;
- volumes de fumée ou de gaz ;
- pose, hauteur et collider de l'observateur et de la cible.

Canaux indépendants obligatoires :

| Matériau | Mouvement | Vision | Eau/gaz |
|---|---:|---:|---:|
| Plein | bloqué | bloquée | bloqués |
| Verre | bloqué | permise ou atténuée | bloqués |
| Grille | bloqué | permise | permis selon réglage |
| Ouverture | permis | permise | permis |

La couverture utilise plusieurs échantillons corporels issus de la pose canonique. La posture ne
doit pas exister uniquement dans `combat_roster` si elle affecte le monde physique.

---

## 9. Surfaces, régions et effets `[EXISTANT — PHASE 5]`

Toute surface praticable accepte un multiplicateur statique libre saisi par le MJ. `1` signifie
aucun malus ; la valeur doit être strictement positive. Une valeur élevée, par exemple `5`, permet
de représenter un escalier détruit ou encombré sans créer un nouveau type codé.

Les changements survenus pendant la partie sont des instances d'effet, pas des modifications
silencieuses de la surface statique.

Le registre d'effets comprend :

- définitions intégrées : feu, inondation, gaz, huile/glissant, terrain instable ;
- définitions personnalisées de campagne ;
- instances liées à une surface, un volume, une entité ou un token ;
- intensité, durée, source et hooks de tour ;
- modificateurs déclaratifs sûrs : déplacement, visibilité, dégâts, tests ou restrictions.

Les effets intégrés peuvent propager et appliquer automatiquement leurs règles. Un effet
personnalisé inconnu conserve au minimum son libellé, son icône, sa note MJ et les modificateurs
déclaratifs supportés. Aucun script arbitraire saisi par le MJ n'est exécuté sur le serveur.

Le même évaluateur d'effets est consommé par le déplacement, la visibilité, le combat et les hooks
de tour. Il ne doit pas y avoir une seconde table de correspondance propre à chaque système.

Les zones spatiales servent aussi aux mécaniques telles que la suppression : le moteur teste le
chemin traversé, pas seulement la case finale.

### Implémentation Phase 5

- `world_effect_definitions` contient les définitions personnalisées d'une campagne ; les cinq
  définitions intégrées vivent dans le registre versionné du code ;
- `world_effect_instances` est l'état durable d'une partie et cible un volume, une feature, un
  compartiment, une entité ou un token ;
- `world_feature_states` porte notamment l'état détruit/désactivé d'une passerelle et portera
  l'automate d'ascenseur ;
- `world_effect_events` journalise les entrées, sorties et traversées effectivement résolues ;
- le cumul `max` choisit le facteur le plus contraignant d'une catégorie ; `multiply` conserve des
  facteurs séparés et explicables entre catégories ;
- le renderer affiche les régions mais leur AABB déclaré, et non le mesh translucide, reste
  l'autorité physique ;
- l'ancienne table `zones`, sans consommateur actif, est archivée par la migration 154. Aucun
  adaptateur approximatif n'est maintenu.

Le combat consomme déjà les régions pour les coûts, la visibilité et les tests de terrain instable,
et les traversées résolues sont journalisées. La traduction détaillée des hooks `test` ou `damage`
en règles Polaris reste une frontière métier future ; elle réutilisera la détection spatiale
existante sans la réimplémenter.

---

## 10. Eau, gaz et compartiments `[EXISTANT — PROPAGATION PHASE 5]`

Le calcul d'eau actuel de l'éditeur constitue une preuve de concept topologique, pas une simulation
runtime autoritaire.

Le compilateur doit produire des compartiments reliés par des passages ayant des canaux de
perméabilité séparés. Eau, gaz et éventuellement pression peuvent ensuite se propager sur ce graphe
sans réinterpréter les meshes de rendu.

Une porte peut donc bloquer l'eau sans bloquer la vision, ou laisser fuir du gaz selon ses
propriétés et son état.

---

## 11. Contrat avec le combat `[EXISTANT — PHASE 7]`

La machine à états de combat existante reste l'orchestrateur. Elle appelle :

- `MovementService` pour planifier, budgéter et appliquer un déplacement ;
- `VisibilityService` pour ligne de vue et couverture ;
- `EffectService` pour modificateurs, contraintes et hooks ;
- `WorldQueryService` pour portée, proximité, occupation et intersection de régions.

Le combat ne duplique aucune formule spatiale. Portée, couverture et effets sont recalculés après la
position réellement atteinte.

À la déclaration, le client fournit uniquement une destination. Le serveur planifie le trajet avec
le budget maximal autorisé, dérive l'allure minimale suffisante et conserve le plan ainsi que les
révisions du monde. À la résolution, le trajet est recalculé sous verrou et peut s'arrêter avant la
destination si le budget, un obstacle, une porte, un effet ou l'état runtime l'impose.

Les distances de contact, charge, portée d'arme, proximité d'adversaires et interaction avec une
entité sont des distances 3D en mètres. Les bandes de portée proviennent de la portée de l'arme et
de la position réellement atteinte ; une valeur `confirmedModifiers.portee` envoyée par le client
n'est jamais une autorité de règle.

Les modificateurs dérivés sont calculés par le serveur. Une dérogation du MJ, si elle existe, est
explicite, auditée et accompagnée d'une raison ; elle ne remplace pas silencieusement le résultat du
moteur.

---

## 12. Invariants à ne pas casser

1. Une case de jeu vaut 1,5 m par défaut, mais les règles manipulent des mètres.
2. L'apparence GLB n'est jamais l'autorité de collision, de vue ou de navigation.
3. Une sauvegarde de l'éditeur ne modifie pas l'état runtime d'une partie.
4. Un token peut s'arrêter au milieu d'un parcours vertical.
5. Les canaux mouvement, vision et fluides sont indépendants.
6. Le serveur recalcule le chemin, le coût et la position atteignable.
7. Le client peut prévisualiser, jamais imposer un résultat de règle.
8. Tous les consommateurs utilisent le même snapshot et la même révision.
9. Tout objet structurel possède une identité stable.
10. Une carte voxel historique ne doit jamais imposer une contrainte au moteur canonique.
11. Les étages supérieurs au plan de coupe sont masqués. Les étages inférieurs sont visibles et
    opaques, mais ne remplacent jamais le support de placement de la tranche courante.
12. Une salle multi-hauteur traverse ses tranches sans recevoir de plancher implicite et conserve
    son vide continu au sein du monde inférieur affiché.
13. Une case ne peut appartenir qu'à une seule salle pour un même volume vertical.
14. Les bornes d'une salle sont un broadphase ; seule son empreinte explicite fait autorité.

---

## 13. Provenance de l'intégration

Cette architecture a été définie après lecture croisée :

- du moteur de combat de la branche historique ;
- du pathfinder, des collisions Redis et de la LOS voxel ;
- de l'éditeur Surface/Salle et de ses connecteurs ;
- des règles Polaris de déplacement et de terrain ;
- des besoins exprimés pour étages, échelles, passerelles, ascenseurs et effets.

Branche de travail : `codex/world-engine-integration`.

Commit d'intégration : `8276086` — parents `255736d` (Session 141 suite 30) et `75a3aec`
(snapshot de l'éditeur Surface). Le dépôt de travail de l'autre développeur n'a pas été modifié ;
l'intégration a été réalisée dans un worktree séparé.
