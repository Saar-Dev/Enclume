# SYSTEME/MOTEUR_MONDE.md — architecture physique, navigation et visibilité

> Dernière mise à jour : 2026-07-13 — audit du moteur de monde et intégration de l'éditeur Surface.
>
> Statut : **architecture cible validée, non encore implémentée**. Les sections marquées
> `[EXISTANT]` décrivent le code livré. Les sections `[CIBLE]` sont le contrat à respecter pendant
> la reconstruction.
>
> Lire pour : tout travail touchant le monde 3D, les coordonnées, les surfaces praticables, les
> collisions, les déplacements, les connecteurs, les lignes de vue, les zones ou les effets
> environnementaux.

Documents associés :

- `docs/SYSTEME/SURFACES_SALLES.md` — contrat de l'éditeur Salle et des surfaces ;
- `docs/PLAN_MOTEUR_MONDE.md` — ordre de migration et critères de validation ;
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

`battlemaps.surface_data` version 4 contient actuellement :

- `rooms`, `floors`, `walls`, `ceilings`, `stairs`, `connectors` ;
- les drapeaux `walkable`, `blocksMovement`, `blocksSight` ;
- des portes et ascenseurs structurels avec une apparence GLB attachée ;
- une hauteur d'étage d'éditeur (`STORY_HEIGHT`) et une grille fine (`SURFACE_FINE`) ;
- un calcul client d'étanchéité utilisé pour le rendu de l'eau.

Cet ensemble est actuellement normalisé, compilé et rendu côté client par
`client/src/lib/surfaceData.js`. La route `PUT /api/battlemaps/:id/surface` vérifie seulement que la
racine reçue est un objet JSON puis la stocke. Il n'existe pas encore de validation de schéma ni de
compilation serveur.

### 2.2 Collisions `[EXISTANT, TRANSITOIRE]`

`server/src/lib/redis.js` construit un hash Redis `collision:{battlemapId}` indexé par clé
`x:y:z`. Il contient les tokens, les entités bloquantes et les voxels.

Limites vérifiées :

- une seule valeur par cellule : une écriture peut masquer un autre occupant ;
- une entité bloquante est réduite à sa cellule d'origine, sans dimensions ni rotation ;
- les salles, sols, murs et connecteurs de `surface_data` sont absents ;
- les positions flottantes ne correspondent pas naturellement aux clés exactes de cellule ;
- Redis mélange cache de géométrie statique et occupation dynamique.

### 2.3 Déplacement `[EXISTANT, TRANSITOIRE]`

`client/src/lib/pathfinder.js` exécute un A* Chebyshev : huit directions et coût uniforme de `1`
par case. Il lit les voxels et les tokens ; les appelants passent actuellement une liste d'entités
vide. Il ne connaît ni multiplicateur de surface, ni escalier structurel, ni échelle, ni passerelle,
ni ascenseur.

Pendant un combat, le client envoie encore la destination, `action_key` et `ini_mod`. Le serveur
persiste ces valeurs sans recalculer le chemin ni son coût. À la résolution, il contrôle la case
d'arrivée et, si elle est occupée, essaie seulement la case située directement avant la destination.
Le chemin déclaré n'est ni stocké ni revalidé.

Le déplacement direct `TOKEN_MOVE` accepte également des coordonnées après contrôle de propriété,
sans interroger une physique commune du monde.

### 2.4 Ligne de vue `[EXISTANT, TRANSITOIRE]`

`shared/losUtils.js` et `server/src/lib/losService.js` raycastent uniquement `voxel_data`. La hauteur
d'œil est fixée à `pos_z + 2.5` et la couverture repose sur quatre rayons d'un personnage debout.

Ne participent pas encore au calcul :

- murs, portes et plafonds issus de `surface_data` ;
- volumes réels des entités ;
- verre, grille et matériaux semi-transparents ;
- fumée, gaz et autres effets volumiques ;
- posture physique canonique du token.

### 2.5 Unités `[DETTE CRITIQUE]`

`shared/polarisUtils.js::calcAllures()` retourne des distances Polaris en mètres. Le pathfinder et
plusieurs interfaces de combat les utilisent comme un nombre de cases. Avec une case voulue à
1,5 m, 15 m peuvent donc devenir 15 cases, soit 22,5 m.

Cette dette doit être corrigée avant toute nouvelle mécanique verticale.

### 2.6 Index des textures `[DETTE CONNUE]`

Les routes de sauvegarde voxel et surface suppriment chacune toutes les lignes
`battlemap_texture_usage` de la carte puis réinsèrent uniquement les textures de leur propre
document. Sauvegarder une représentation peut donc effacer l'index d'utilisation de l'autre.

---

## 3. Sources de vérité `[CIBLE]`

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

PostgreSQL reste la source durable. Redis peut mettre en cache un snapshot ou ses tuiles, jamais
devenir son autorité.

Le compilateur doit être une logique pure partageable : le client peut l'utiliser pour la
prévisualisation de l'éditeur, mais le serveur compile ou vérifie la version autoritaire.

---

## 4. Unités et coordonnées `[CIBLE]`

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

## 5. Navigation et coût du déplacement `[CIBLE]`

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

Ce scénario constitue un test doré du futur moteur.

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

## 6. Connecteurs verticaux `[CIBLE]`

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

---

## 7. Collisions, occupation et entités `[CIBLE]`

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

---

## 8. Vision et couverture `[CIBLE]`

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

## 9. Surfaces, régions et effets `[CIBLE]`

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

---

## 10. Eau, gaz et compartiments `[CIBLE]`

Le calcul d'eau actuel de l'éditeur constitue une preuve de concept topologique, pas une simulation
runtime autoritaire.

Le compilateur doit produire des compartiments reliés par des passages ayant des canaux de
perméabilité séparés. Eau, gaz et éventuellement pression peuvent ensuite se propager sur ce graphe
sans réinterpréter les meshes de rendu.

Une porte peut donc bloquer l'eau sans bloquer la vision, ou laisser fuir du gaz selon ses
propriétés et son état.

---

## 11. Contrat avec le combat `[CIBLE]`

La machine à états de combat existante reste l'orchestrateur. Elle appelle :

- `MovementService` pour planifier, budgéter et appliquer un déplacement ;
- `VisibilityService` pour ligne de vue et couverture ;
- `EffectService` pour modificateurs, contraintes et hooks ;
- `WorldQueryService` pour portée, proximité, occupation et intersection de régions.

Le combat ne duplique aucune formule spatiale. Portée, couverture et effets sont recalculés après la
position réellement atteinte.

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
10. Toute migration reste compatible avec les cartes voxels jusqu'à validation du remplacement.

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
