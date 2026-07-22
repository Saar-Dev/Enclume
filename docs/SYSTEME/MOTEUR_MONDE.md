# SYSTEME/MOTEUR_MONDE.md — architecture physique, navigation et visibilité

> Dernière mise à jour : 2026-07-22 — trappe d'échelle et matériau de grille ajouré canoniques.
>
> Statut : **Phases 0 à 16 implémentées. Le snapshot est l'autorité physique de l'éditeur, de
> la session et du combat.**
>
> Lire pour : tout travail touchant le monde 3D, les coordonnées, les surfaces praticables, les
> collisions, les déplacements, les connecteurs, les lignes de vue, les zones ou les effets
> environnementaux.

Documents associés :

- `docs/SYSTEME/SURFACES_SALLES.md` — contrat de l'éditeur Salle et des surfaces ;
- `docs/PLAN_MOTEUR_MONDE.md` — ordre de migration et critères de validation ;
- `docs/FUSION_PROJET_COUSIN.md` — procédure et autorités de la fusion combat/monde ;
- `docs/WORKFLOW_FUSION.md` — worktrees, branches, ports, données et déploiement de l'instance commune ;
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

`battlemaps.surface_data` version 13 contient actuellement :

- `rooms`, `floors`, `walls`, `ceilings`, `stairs`, `connectors` ;
- les drapeaux `walkable`, `blocksMovement`, `blocksSight` ;
- des portes et ascenseurs structurels avec une apparence GLB attachée ;
- une hauteur d'étage d'éditeur (`STORY_HEIGHT`) et une grille fine (`SURFACE_FINE`) ;
- des `verticalProfile.slices` pour les volumes dont l'empreinte change selon la hauteur ;
- des `wallElevationProfiles` pour les murs courbes ou cassés vus en coupe ;
- des `wallAppearanceProfiles` pour l'apparence propre aux faces de chaque mur logique ;
- un calcul client d'étanchéité utilisé pour le rendu de l'eau.

Cet ensemble reste normalisé et rendu côté client par `client/src/lib/surfaceData.js`. À la
sauvegarde, `shared/world/surfaceDocument.js` le valide côté serveur, le normalise en version 13 et
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
- `surfaceDocument.js` : validation de schéma, normalisation v13, UUID physiques stables et adaptation
  de `surface_data` vers `WorldDocument` ;
- `worldCompiler.js` : compilation pure des supports, barrières, portails, colliders, occluders,
  traversées verticales et compartiments ;
- `stairGeometry.js` : définition géométrique unique de l'escalier droit, de ses marches, de ses
  garde-corps, de ses ancrages praticables et de sa trémie ;
- `entityTransform.js` : échelle uniforme canonique des entités, bornée de `0.25` à `4` et partagée
  par client, routes et services spatiaux ;
- `index.js` : point d'entrée commun client/serveur ;
- `spatialIndex.js` et `navigation.js` : index statique, occupation dynamique, graphe 3D pondéré et
  planification autoritaire ;
- cent trente-trois tests monde/serveur, dont Jon, les portes, les occupants multiples, les budgets
  partiels, le placement sur support, les canaux de matériaux, la couverture, les occluders
  dynamiques et l'escalier paramétrique.

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

Un escalier v13 est un objet structurel paramétrique, pas un GLB qui masquerait une téléportation.
`kind: straight` porte une origine basse `x/z/y`, une arrivée `topY`, un axe et un sens, une
largeur, un giron, un nombre de marches, une épaisseur de support et deux garde-corps optionnels.
`kind: spiral` porte le centre `x/z`, les mêmes altitudes, les rayons intérieur/extérieur, le nombre
de tours, le sens horaire, l'orientation de l'entrée, l'épaisseur des marches, la colonne et le
garde-corps extérieur. Les configurations standard relient exactement un étage de 3,75 m avec
21 contremarches de 17,9 cm ; le colimaçon possède un diamètre de 3,75 m.

`stairGeometry(...)` distribue la définition vers `straightStairGeometry(...)` ou
`spiralStairGeometry(...)` et dérive :

- les boîtes droites ou prismes de secteurs courbes rendus et leurs surfaces praticables ;
- les poteaux, mains courantes et la colonne centrale éventuelle ;
- l'empreinte et la trémie exacte découpée dans le plafond bas et le sol haut ;
- les colliders de mouvement et occluders de vue de chaque marche ;
- un ancrage stable par marche pour la navigation et l'arrêt d'un token.

Les secteurs courbes conservent leur polygone dans le snapshot sous la primitive
`horizontal-prism` et la colonne utilise `vertical-cylinder`. L'index spatial et la visibilité
effectuent leur narrow phase sur ces volumes réels au lieu de considérer leur seule AABB.

Pour un colimaçon, la trémie n'est jamais son carré englobant. La hauteur de dalle, la garde au
plafond et la progression de la volée déterminent le premier angle qui doit rester ouvert ; la
découpe se poursuit jusqu'à la dernière marche. Le secteur suivant reste plein et devient le
palier haut, exactement dans le sens de sortie. `rotationQuarterTurns` et `clockwise` transforment
ce même secteur : aucune orientation spéciale n'existe dans le renderer.

Les dalles découpées sont compilées comme `horizontal-multipolygon`, avec leurs contours et trous.
Leur AABB sert seulement à l'index large ; collisions et visibilité utilisent le multipolygone au
narrow phase. Ainsi, une zone de palier conservée visuellement est aussi un support physique, et
la trémie visible ne garde aucun collider rectangulaire invisible.

Le renderer, l'éditeur et `worldCompiler` ne recalculent donc jamais chacun leur propre escalier.
Le connecteur de graphe est produit automatiquement par la pose de l'objet et n'est pas exposé
comme un outil séparé. Les liaisons d'entrée/sortie ignorent uniquement les colliders appartenant
à ce même escalier ; elles continuent de respecter toutes les autres barrières. Les alias de coût
zéro entre un support et le premier ou dernier ancrage restent dans le graphe, mais sont retirés du
plan de mouvement rendu au client.

Dans l'éditeur, l'entrée se trouve sous **Objets 3D > Escaliers**. Un clic choisit l'objet, le survol
prévisualise la géométrie complète et le clic au sol la crée puis repasse en sélection. La molette
tourne ce même aperçu par quarts de tour avant le clic sans zoomer la caméra : l'orientation affichée
est donc exactement celle transmise à la définition canonique lors de la pose. Le popup permet
ensuite une rotation par quart de tour, l'activation des garde-corps, le multiplicateur de
déplacement et l'apparence procédurale. Le colimaçon ajoute le retournement horaire/antihoraire.
Une texture ou un futur modèle décoratif ne remplace jamais la géométrie physique dérivée.

### Échelle

Parcours vertical de type grimpe. Il contient assez d'ancrages pour persister un token entre deux
étages. Le mode course n'y est pas disponible par défaut.

L'UX suit désormais le même principe que l'escalier : **Objets 3D > Échelles** affiche la vraie
géométrie structurelle en prévisualisation, puis la pose crée automatiquement le connecteur
`ladder`, repasse en sélection et ouvre son popup. Celui-ci expose les niveaux, la rotation et le
coût. Aucun outil direct « Ajouter une échelle » ne doit coexister avec ce chemin.

Par défaut, cette pose crée aussi un connecteur `hatch` lié par `linkedLadderId`, sur la dalle du
palier le plus haut. La dalle est toujours découpée à cet endroit. Une trappe `closed` ou `locked`
remplace la partie retirée comme support et barrière horizontale ; une trappe `open` ou `destroyed`
ne produit ni support, ni collider, ni occluder. La traversée `climb` de l'échelle est activée
uniquement lorsque cette trappe est ouverte ou détruite. L'état initial appartient au document
statique ; l'état courant vient de `WorldRuntimeState.featureStates` et prévaut dans le snapshot.
Deux commandes gauche/droite font tourner sa charnière par quarts de tour, avant ou après la pose.

Une trappe peut référencer un blueprint GLB de connecteur `hatch` et ses clips d'animation, comme
une porte. Cela permet de décliner panneau battant, écoutille, panneau coulissant et boîtier de
commande sans créer de nouvelle primitive physique. Si aucun modèle n'est choisi, le renderer
utilise le panneau procédural. Dans tous les cas, le GLB reste strictement visuel : le connecteur
canonique demeure l'autorité pour la découpe, le support, la collision, la LOS et la traversée.

### Passerelle

Support praticable surélevé. Une passerelle fixe appartient au monde statique. Une passerelle
mobile ou destructible est une feature runtime possédant un composant de support praticable.
Une dalle qui longe une salle porte `clipRoomId`. Le helper partagé
`roomInteriorFootprintAtY(room, y, ...)` intersecte sa case avec la tranche polygonale exacte puis
retire le déplacement intérieur dû au profil vertical des murs à cette altitude. Le renderer
extrude cette intersection ; `worldCompiler` enregistre la même empreinte et un point de navigation
qu'elle contient. Courbes et profils ne peuvent donc créer ni support invisible hors de la salle,
ni chemin serveur absent du rendu.

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
- l'éditeur construit la physique depuis les objets structurels de la bibliothèque 3D. L'escalier
  crée sa traversée automatiquement ; le rendu générique d'une échelle ou un futur GLB n'est
  qu'une apparence ;
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

### Ouvertures vitrées structurelles

Les fenêtres murales appartiennent à `surface_data.connectors` : le modèle GLB n'est que leur
apparence. `window` est une ouverture vitrée fixe ; `screen-window` possède un état runtime parmi
`transparent`, `opaque` et `mirror`. Elles ne créent aucune traversée de navigation : mouvement et
fluides restent bloqués par leur barrière, tandis que leur canal de vision dépend de l'état courant.

Dans l'éditeur, elles sont découvertes et choisies dans **Objets 3D > Fenêtres**, mais cette entrée
de catalogue ne change pas leur nature. La pose raycast un mur, prévisualise le GLB et crée le
connecteur structurel avec sa géométrie déclarée ; elle ne crée jamais une `entity`. Les modèles
générés emploient une vitre continue sans traverse intérieure. Les fenêtres-écrans exposent un slot
de couleur **Charnières**, séparé de leur unique boîtier `FIXED`. Le champ d'apparence
`modelFacing: front|back` retourne le GLB de 180° autour de son ancrage sans toucher la découpe ni
les canaux physiques. La convention `__SLOT_03__Hinges` reste détectable sur une instance intégrée
déjà posée, même si son instantané de manifeste ne contenait pas encore le libellé du slot.

La découpe murale utilise l'intervalle vertical réel
`[openingBottom, openingBottom + openingHeight]`. Elle ne touche que les tranches verticales qu'elle
intersecte et conserve séparément le mur sous l'allège et au-dessus du linteau. Une baie couvrant
plusieurs niveaux forme donc une ouverture continue, sans être répétée à chaque étage ni supprimer
les portions de façade hors de son volume.

Une verrière horizontale `skylight` remplace une interface structurelle existante entre sol et
plafond. Elle peut occuper la base ou le sommet d'une salle haute, ou l'interface réellement partagée
par deux salles superposées ; elle ne peut pas flotter dans une tranche intermédiaire vide. Son
support reste praticable et bloque mouvement vertical et fluides, mais laisse passer la vision.
Dans l'éditeur, les quatre formats sont exposés exclusivement sous **Objets 3D > Dalles en verre**.
Le choix d'un modèle active le rayon de pose structurel et un fantôme cyan non occulté matérialise
l'emprise exacte avant le clic. La rotation de ce fantôme modifie la même orientation que celle
persistée ; aucune `entity` décorative n'est créée.

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

La transformation uniforme appartient à `entity.state.transform.scale`. La route d'entités la
normalise avec `shared/world/entityTransform.js`, puis le socket rediffuse l'état complet. Le rendu,
`worldMovementService` et `worldVisibilityService` appliquent le même facteur aux dimensions du
blueprint. Agrandir ou réduire un objet modifie donc ensemble son apparence, son occupation et son
volume occultant. La rotation continue d'utiliser la rotation canonique de l'entité. La molette
modifie cette valeur par pas de 90° pendant la prévisualisation d'une pose libre ; les boutons du
popup modifient la même valeur après la pose. Un objet mural conserve l'orientation dérivée de sa
face d'ancrage.

Les animations GLB sont une capacité visuelle dérivée. `builtinModelCatalog` lit les noms de clips
dans le chunk JSON du GLB et inscrit `geometry.animationClips`; un modèle ouvrable reçoit les états
`closed`/`open` et une `visual_override.animationProgress` normalisée. `useModelStateAnimation`
applique les mêmes clips à l'entité libre ou au modèle d'un connecteur, joue la transition vers la
nouvelle pose puis la fige exactement à son terme. Le temps d'animation ne modifie ni collision ni
LOS : celles-ci lisent l'état métier persistant.

La sélection GLB suit la géométrie, pas une AABB. Chaque mesh non skinné reçoit deux coques additives
enfants ; elles héritent donc automatiquement des pivots, rotations et animations internes. Les
objets à slots de matériau affichent également un rendu compact dans la section **Apparence** de
leur tooltip. Ce rendu consomme les mêmes `materialOverrides` que l'objet réel.

### 7.1 Tranche d'étage affichée

`displayLevel = N` rend tout l'intérieur de la tranche N. Les intérieurs strictement inférieurs
restent eux aussi rendus avec leurs matériaux opaques, mais les vraies interfaces horizontales et
les vraies parois les occultent naturellement. Ils ne deviennent donc visibles que par une
ouverture géométrique réelle : trémie d'escalier, trappe ouverte ou dalle vitrée. Les murs
inférieurs ne participent pas à la coupe caméra du niveau courant et restent opaques. Les niveaux
supérieurs restent masqués en temps normal.

Cette occlusion est un contrat du moteur, pas un masque visuel ajouté par objet. La visibilité
« enveloppe » et la visibilité « intérieur » acceptent les points des niveaux inférieurs ; la
différence porte sur la coupe caméra, réservée à l'enveloppe du niveau courant ou au volume
multi-niveau actif. Le depth buffer tranche ensuite avec les dalles et parois canoniques. Tous les
consommateurs — jeu, éditeur, picking, tokens, effets et structures horizontales — utilisent les
mêmes altitudes, sans rendre les murs inférieurs transparents ni inventer une seconde scène.

Une salle haute de plusieurs étages est l'exception locale. Le renderer conserve son véritable sol
de base, toutes ses parois jusqu'au fond ainsi que les murs et le contenu spatial de ses tranches
au-dessus de N — passerelles, connecteurs, objets 3D, tokens et effets — afin d'en montrer le volume
complet. Une salle adjacente ou empilée qui ne fait pas partie de ce volume n'est pas révélée. Aucun
plancher intermédiaire n'est inventé et le plafond n'existe que dans la tranche supérieure. Les
règles de picking et de placement continuent d'interroger la tranche réelle des éléments.

L'identité du volume actif et l'occlusion des façades ont deux autorités séparées. Pour un joueur,
le volume actif vient de la position monde du token suivi. Pour le MJ et l'éditeur, il vient de la
cible de `MapControls`, stable pendant un zoom ou une orbite. La position physique de la caméra ne
choisit plus le volume dès qu'une de ces autorités existe ; elle sert seulement au test de côté des
façades. Traverser accidentellement une salle voisine avec l'œil ne peut donc plus masquer tout le
contenu supérieur du volume réellement observé.

Le contexte caméra est indexé par `displayLevel`. Dès que l'étage affiché change, le contexte de
l'ancien étage devient synchroniquement nul, avant même le recalcul 3D suivant. Il ne peut donc pas
conserver temporairement — ou indéfiniment dans un onglet ralenti — le sol et le contenu intérieur
d'une salle simple de l'étage précédent. Le nouveau contexte n'est réactivé qu'après résolution
d'une salle appartenant réellement à la nouvelle tranche.

Le calcul graphique des murs situés devant la caméra reçoit l'identité de ce volume. Il teste donc
toutes ses tranches visibles contre l'empreinte de son vrai sol, et pas uniquement les murs du
`displayLevel`. Les parois avant deviennent transparentes comme dans une salle simple, tandis que
les parois arrière et les salles voisines restent opaques.

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

L'origine et la hauteur du profil sont celles du volume complet de la salle, pas celles de la
tranche en cours. Chaque panneau dérivé transporte `elevationProfileOriginY` au sol de base et
`elevationProfileHeight` égal à la hauteur totale. Le paramètre normalisé reste donc continu quand
le mur traverse plusieurs étages : un bombé ou un chevron ne recommence jamais à chaque niveau.

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
arêtes restantes et retire ceux de la séparation supprimée. Le validateur v13 contrôle les clés,
les textures et les valeurs d'apparence entre 0 et 100. Le contrat v13 refuse les anciennes
apparences `exterior`, ainsi que les faces de salle `top/bottom` et `front/back`.

Le motif procédural `industrial_grate` est un matériau ajouré réutilisable. Sa texture RGBA est
rendue avec `alphaTest`, pas avec un panneau semi-transparent : un fragment appartient au barreau
ou est entièrement absent. Cela conserve le depth buffer, les ombres et la lecture des niveaux
inférieurs sans les artefacts de tri du verre. Le dessus d'un sol, d'un mur, d'une marche, d'une
passerelle ou d'une trappe peut utiliser ce cutout ; les chants et les pièces structurelles fines
emploient son matériau métallique plein associé.

Pour éviter deux réseaux séparés par toute la profondeur d'un mur ou d'une dalle, une surface
ajourée est affichée comme une coque unique de 4,5 cm. Elle reste alignée sur la face de support ;
son collider conserve l'épaisseur structurelle déclarée. Sur les escaliers uniquement, les UV du
dessus répètent le motif 2 × 2 afin de resserrer le pas des mailles sans modifier le réglage des
autres surfaces.

Apparence et physique restent deux champs séparés. Choisir ce motif hors d'une salle applique
explicitement le preset `barrierType: grate` (`blocksMovement: true`, `blocksSight: false`,
`blocksWater: false`). Dans une salle, le changement d'une seule face ne modifie pas implicitement
les canaux physiques de tout le volume. `worldCompiler` lit exclusivement ces canaux : ni l'alpha,
ni la normal map, ni un éventuel GLB ne deviennent une autorité de collision ou de LOS.

Les interfaces horizontales sont dérivées par altitude depuis les empreintes de sol et les régions
de plafond. Si un plafond et un sol coïncident, une seule interface est rendue : plafond depuis le
niveau inférieur, sol dès que le niveau supérieur est affiché. Depuis le niveau inférieur, elle
conserve l'opacité de coupe du plafond courant, même si une salle possède un sol au-dessus. Depuis
le niveau supérieur, le plafond inférieur n'est plus rendu et le sol supérieur, opaque, occupe
l'interface. Les sols inférieurs restent rendus derrière les interfaces plus hautes afin de devenir
visibles par une trémie ou une verrière ; les plafonds concurrents restent dédupliqués.

`roomHorizontalInterfaces` est l'unique autorité de rendu des dalles de salle. Le renderer ne
dessine plus les sols dans une boucle indépendante : chaque interface choisit exactement une face
et un propriétaire (`ceilingRoomId` ou `floorRoomId`) lorsque cette face appartient au niveau
courant ou au volume multi-niveau actif ; sinon elle ne rend rien. Cette règle interdit
qu'un plafond bas et un sol haut concurrents occupent le même plan ou que le matériau de la salle
basse soit conservé après le passage à l'étage supérieur.

La face choisie et son altitude sont deux décisions distinctes. Une interface fournit un
`yOverride` numérique lorsqu'elle impose son plan exact. Pour un sol de salle rendu sans surcharge,
`null` ou `undefined` signifie obligatoirement « utiliser `room.y` » ; pour un plafond, « utiliser
le haut de la salle ». Une surcharge explicite `0` reste valide. Il est interdit de tester une
surcharge par `Number.isFinite(Number(value))` sans avoir d'abord exclu `null`, puisque JavaScript
convertit `null` en `0` et replacerait silencieusement tout plancher à l'étage zéro.

Un plafond sans sol au-dessus est une toiture extérieure, pas un contenu intérieur du niveau bas.
Lorsque son altitude correspond au plan du niveau affiché, cette toiture reste donc rendue et
opaque. Sur le même plan, une interface qui possède un `floorRoomId` privilégie toujours le sol de
la salle supérieure. Une salle multi-niveau ne crée aucune toiture intermédiaire : seule la région
de plafond produite par `roomCeilingRegions` à son véritable sommet peut devenir une toiture.

Les murs supérieurs du seul volume multi-hauteur actuellement visé sont également rendus, sans
révéler les salles supérieures voisines. La transparence des murs ne s'applique qu'au niveau courant
ou à ce volume actif, et toujours au mur logique complet ; les morceaux créés par une porte
partagent le même groupe d'opacité et leurs faces de coupe internes ne sont pas dessinées.

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

Une fenêtre structurelle compile ces canaux indépendamment de son mesh : `window` laisse passer la
vision ; `screen-window` la laisse passer uniquement dans l'état `transparent`. Les états `opaque`
et `mirror` occultent la ligne de vue sans transformer la baie en mur plein ni modifier son identité.
Une verrière horizontale laisse également passer la vision tout en conservant son support physique.
Le client rend alors réellement la scène du dessous derrière le verre. Cette propriété ne change
ni l'opacité des murs inférieurs ni les occluders compilés qui les représentent.

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
runtime autoritaire. Il sépare néanmoins deux responsabilités qui ne doivent jamais partager la
même géométrie :

- les colonnes d'eau physiques représentent les volumes extérieurs et excluent les compartiments
  étanches ;
- la surface océanique visible est un plan continu sur l'emprise globale de la carte et ne possède
  donc aucun trou au-dessus d'une salle sèche.

La nappe extérieure utilise une hauteur géométrique stricte : maximum des faces supérieures de
sols, plafonds, murs et escaliers de la carte. Un plafond stocke son plan médian ; sa
demi-épaisseur est ajoutée, puis une garde de cinq hauteurs d'étage canoniques place l'océan loin
au-dessus de la station. Une salle haute ne peut donc ni afficher l'eau dans sa toiture, ni découper
la surface de l'océan.

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

### Validation navigateur de l'autorité de déplacement

Le scénario de recette de l'intégration a été exécuté sur `8393` avec deux identités réelles, une
campagne temporaire isolée et une carte `surface_data` v13 à deux salles. Il confirme le contrat
suivant :

- un joueur qui déplace son token sur un support valide passe par `world-move`, avec trajet et
  budget recalculés par le serveur ;
- un budget insuffisant arrête le token au dernier support stable au lieu d'accepter la destination
  demandée ;
- un mur fermé rend la destination de la salle voisine inaccessible et produit un 409 journalisé,
  sans état optimiste persistant dans le client ;
- une destination sans support n'émet aucun mouvement côté joueur ;
- le MJ peut volontairement contourner la navigation avec `teleport` et poser le token sur le plan
  libre hors de la structure.

Le scénario est contrôlé dans un vrai Chromium, positions PostgreSQL comprises. Toutes les données
temporaires sont supprimées après validation. Cette différence `world-move` joueur / `teleport` MJ
est un contrat permanent, pas une règle d'affichage.

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
