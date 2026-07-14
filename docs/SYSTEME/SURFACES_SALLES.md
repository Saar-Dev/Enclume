# SYSTEME/SURFACES_SALLES.md — éditeur Salle

> Dernière mise à jour : 2026-07-14 — édition contextuelle, profils continus et passerelles découpées.

> Lire pour : tout code touchant `surface_data`, l’outil Salle, les murs de salles, les textures de sol/plafond/mur et l’étanchéité.

> Architecture physique complète : `docs/SYSTEME/MOTEUR_MONDE.md`.
> Ordre de migration : `docs/PLAN_MOTEUR_MONDE.md`.
> Fusion avec le projet combat : `docs/FUSION_PROJET_COUSIN.md`.

## Statut au 2026-07-14

L'éditeur Surface/Salle et son rendu existent. `surface_data` version 12 sait décrire des salles,
sols, murs, plafonds, escaliers et connecteurs. Depuis la Phase 1 du moteur de monde, ce document est
validé et compilé côté serveur en snapshot physique. Depuis la Phase 2, les collisions et la
navigation de session lisent ce snapshot. Depuis la Phase 3, la LOS, la couverture et l'interposition
le lisent également ; depuis la Phase 7, la FSM combat lui délègue aussi déplacements, distances,
portées, interactions et terrain instable. L'affichage de coupe conserve désormais tous les étages
inférieurs opaques et ne rend transparent que ce qui ferme le niveau courant. Depuis la Phase 10,
les murs courbes de salle sont des arcs structurés de leur contour,
partagés par le rendu, les collisions et la LOS. Depuis la Phase 11, supprimer un mur ouvre la
salle ou fusionne ses deux volumes, et une nouvelle salle est découpée par les contours courbes
déjà présents au lieu de superposer ses murs. Depuis la Phase 12, un mur arrondi reste un arc
paramétrique unique dans le document, le renderer et le snapshot physique. Sa tessellation n'est
plus une autorité enregistrée ni une collection de petits murs. La v9 ajoute les tranches verticales
canoniques nécessaires aux salles fusionnées de hauteurs différentes. La v10 ajoute les profils de
mur vus en coupe et déplace les réglages de sélection dans des panneaux contextuels. La v12 remplace
les anciennes faces d'apparence par `floorMaterial`, `ceilingMaterial` et `wallInteriorMaterial` et
conserve les profils d'apparence intérieure liés aux arêtes logiques des murs. Elle ne migre pas les
anciens champs `top/bottom`, `front/back` ou `exterior`.

Un arc conserve toujours les extrémités exactes enregistrées par le contour. Centre, rayon et angles
servent à générer les points intermédiaires, jamais à reconstruire les ancrages. Le renderer reprend
les extrémités des panneaux sources et le snapshot physique transporte les mêmes `from` / `to` ; un
arc horizontal, profilé ou non, rejoint ainsi le mur droit voisin sur une couture commune.

La finition d'édition repose maintenant sur les mêmes identités logiques : les panneaux contextuels
éditent une salle, un mur ou une entité, jamais un morceau de mesh. Les profils verticaux utilisent
une seule progression normalisée sur la hauteur totale de la salle. Les passerelles portent, quand
elles longent une salle, l'identifiant de la salle qui les découpe ; rendu, support et navigation
retrouvent alors la même emprise intérieure à leur altitude.

Ce document décrit le contrat de l'éditeur. `MOTEUR_MONDE.md` décrit le moteur commun qui compile
ce document pour la navigation, la collision, la visibilité et les effets. Ne pas ajouter une
seconde logique physique directement dans le renderer pour contourner cette migration.

## Source de vérité

Le mode Salle repose sur `surface_data.rooms`.

Une salle est un volume métier dont l'empreinte peut être non rectangulaire :

- cases de grille et broadphase : `cells`, sous forme de clés `x:z` uniques. Elles restent
  suffisantes pour une salle orthogonale, mais peuvent se chevaucher dans une case traversée par
  une courbe ;
- enveloppe de recherche : `minX`, `maxX`, `minZ`, `maxZ`, jamais utilisée comme propriété
  implicite ;
- étage de base : `level` / `y` ;
- hauteur simple : `heightLevels`, exprimée en étages, pas en mètres ;
- volume à hauteur locale variable : `verticalProfile.slices[]`. Chaque tranche contient son
  `offset`, son multipolygone `footprint` et ses `wallPaths` canoniques. Le plafond est la différence
  entre une tranche et la suivante, pas une dalle globale placée au sommet maximal ;
- surfaces intérieures : `floorTex` / `floorMaterial` pour le sol et `ceilingTex` /
  `ceilingMaterial` pour le plafond. Une salle ne stocke aucune apparence de face extérieure ;
- murs : une apparence intérieure par salle ; les murs libres sont droits ou restent des
  données historiques, tandis que les arrondis de salle sont de vrais chemins circulaires ;
- arrondis de salle : `boundaryArcs`, chacun lié à une chaîne d'arêtes du contour avec un angle et
  un côté. Le chemin canonique dérivé conserve centre, rayon, angle initial, balayage et longueur ;
- découpes géométriques : `geometryClipRoomIds` soustrait le contour effectif de salles prioritaires
  au contour brut de la salle. Le graphe de dépendances est acyclique ;
- murs supprimés vers l'extérieur : `openWallEdgeKeys` retire les panneaux, colliders et occluders
  concernés sans supprimer le sol ni le plafond ;
- profil de mur vu de côté : `wallElevationProfiles[]` associe des arêtes logiques à un profil
  `curved` (`(`) ou `faceted` (`<`), une profondeur en mètres et un sens. Le profil `vertical` (`|`)
  est l'absence d'entrée ;
- apparence de mur : `wallAppearanceProfiles[]` associe les mêmes arêtes logiques au matériau ou à
  la texture de la face intérieure. L'apparence survit donc à l'arrondi horizontal, au
  profil vertical, à la sauvegarde et à la fusion d'une salle ;
- connecteurs : portes, escaliers, échelles, passerelles et ascenseurs entre salles/étages.
- passerelle ajustée à une salle : un sol `kind: bridge` peut porter `clipRoomId`. Ce lien demande au
  renderer et au compilateur d'intersecter sa dalle avec l'emprise intérieure réelle de la salle à
  sa hauteur ; la courbe horizontale et le retrait d'un profil vertical ne sont pas aplatis en AABB.

Lorsqu'une nouvelle salle recouvre une salle orthogonale existante à une hauteur commune, ses cases
sont transférées : elles sont ajoutées à la nouvelle empreinte et retirées de l'ancienne. Si une
salle déjà présente possède un arc ou une découpe, son contour effectif est prioritaire : la nouvelle
salle conserve ses cases de broadphase mais soustrait cette géométrie avec `geometryClipRoomIds`.
Les deux dalles et leurs murs se rejoignent alors exactement sur la courbe, sans intersection
physique. Si l'ancienne empreinte orthogonale est coupée en plusieurs îlots non reliés, chaque îlot
devient une salle distincte. Des salles empilées sans chevauchement vertical conservent en revanche
les mêmes coordonnées `x:z`.

Une salle `heightLevels > 1` existe dans chaque tranche verticale qu'elle traverse et décrit un seul
volume ouvert. Tous les étages inférieurs au niveau de coupe sont rendus, sans transparence. Quand
le point visé par la caméra se trouve dans une salle multi-hauteur, les murs de toutes ses tranches,
y compris au-dessus du niveau courant, sont rendus pour montrer le volume complet ; les autres
salles supérieures restent masquées. Une salle profonde conserve ses murs descendants et son vide
continu : un puits doit donc paraître profond. Aucun plancher intermédiaire n'est créé automatiquement. Une future trappe doit
être portée par un connecteur vertical —
typiquement une échelle — avec son propre état ouvert/fermé ; elle ne révèle jamais l'étage inférieur
entier.

Après fusion de salles de même sol mais de hauteurs différentes, la salle résultante n'est pas
aplatie à une hauteur unique. Sa tranche basse est l'union des deux empreintes ; les tranches hautes
ne conservent que les zones réellement hautes. Le moteur produit ainsi un plafond local au-dessus
de la zone basse et une paroi de ressaut autour de la zone haute. Rendu, sélection par étage,
collisions, LOS, eau, supports et compartiments lisent tous ce même `verticalProfile`.
Après chaque fusion, y compris une fusion en chaîne d'une salle déjà profilée, `heightLevels` et
`height` sont recalculés depuis les tranches canoniques produites. Ces métadonnées ne peuvent donc
plus rester celles de la salle active d'origine et contredire `verticalProfile.slices` à la sauvegarde.

Cette règle est répétée aux frontières de sauvegarde. `normalizeSurfaceData` la réapplique juste
avant chaque `PUT`, puis `prepareSurfaceData` la réapplique côté serveur avant validation et
compilation. Les `verticalProfile.slices` contiguës sont l'autorité ; une requête mise en file avec
une ancienne valeur de `heightLevels` ne provoque plus un refus transitoire.

Les dalles et les murs rendus ne doivent pas devenir la source de vérité. Les salles sans contrainte
géométrique peuvent regrouper leurs cases en rectangles de rendu. Les salles arrondies ou découpées
extrudent leur contour effectif exact, trous et polygones disjoints compris. Le même contour fournit
dalles, murs, sélection, colliders, occluders et compartiments. Une case de grille ne suffit donc
plus à revendiquer tout son carré lorsqu'une courbe la traverse ; le contour effectif départage les
salles et le centre de case reste l'ancrage discret du graphe de navigation actuel.

Pendant la migration, `surface_data` reste le nom de stockage du document statique. Les changements
survenus en partie — porte ouverte, ascenseur en déplacement, passerelle détruite, feu, gaz, huile ou
inondation — doivent à terme vivre dans un état runtime séparé. Une sauvegarde de l'éditeur ne doit
jamais écraser cet état.

### Contrat de sauvegarde Phase 1

- chaque feature de `rooms`, `floors`, `walls`, `ceilings`, `stairs` et `connectors` reçoit un
  `worldId` UUID stable au premier backfill ou à la première sauvegarde ;
- la clé de collection historique reste une clé de compatibilité, jamais l'identité runtime ;
- `PUT /api/battlemaps/:id/surface` valide le document complet avant écriture et retourne la version
  normalisée avec ses UUID ;
- `surface_revision` détecte une sauvegarde fondée sur une ancienne version de Surface sans entrer
  en conflit avec une sauvegarde voxel ;
- `world_revision` invalide tous les snapshots dès qu'une source physique change ;
- `GET /api/battlemaps/:id/world-snapshot` fournit le snapshot compilé correspondant à cette
  révision ;
- dupliquer une carte réattribue ses `worldId`, afin que ses futurs états de porte, passerelle ou
  ascenseur restent indépendants.

Les erreurs HTTP de sauvegarde ne sont plus assimilées à un succès par l'éditeur. Les requêtes sont
sérialisées par document et les compteurs renvoyés par le serveur restent monotones même si les
réponses voxel et Surface arrivent dans un ordre différent.

Depuis le correctif de persistance v8, la route retourne explicitement `world_revision`,
`surface_revision` et `voxel_revision` avec le document Surface réellement écrit. Si une réponse a
été perdue et que la révision locale est devenue obsolète, le client relit la carte et ne rebase sa
sauvegarde que si le document serveur est encore identique à sa dernière base connue. Une vraie
édition concurrente n'est jamais écrasée silencieusement et produit une alerte visible dans
l'éditeur. Le scénario salle carrée → arrondi → sortie de l'éditeur → rechargement fait partie des
tests de non-régression.

## Grille et échelle

La grille de l’éditeur reste la référence visuelle. Une case de grille représente 1,5 m côté intention de jeu.

Pour les textures, le carrelage/motif doit suivre cette case de référence : une répétition logique doit tomber sur les lignes de grille, aussi bien au sol que sur les murs. Les UV de mur se basent donc sur les coordonnées monde signées, pas sur une répétition locale par petit panneau.

## Apparence intérieure et parois physiques

On ne raisonne plus en “face A / face B”.

Chaque panneau de mur physique peut recevoir deux contributions intérieures :

- face intérieure de la salle située d’un côté ;
- face intérieure d'une éventuelle salle située de l'autre côté.

Si aucune salle n'occupe l'autre côté, le renderer réemploie l'apparence intérieure du mur. Il
n'existe aucun réglage d'apparence extérieure dans le document v12.

À une frontière horizontale commune, le plafond de la salle inférieure et le sol de la salle
supérieure forment une seule interface dérivée. Vue d'en bas elle emploie le plafond inférieur ; dès
que l'étage supérieur est affiché, elle emploie son sol. Deux dalles coplanaires ne sont jamais
rendues ensemble.

### Profil vertical d'un mur

La courbe horizontale du contour et le profil vertical sont deux axes indépendants. Un même mur peut
donc être un arc vu du dessus et être courbe ou cassé vu de côté. Le renderer construit un maillage
continu par loft ; il ne superpose pas de cubes et n'enregistre aucune tessellation comme donnée
métier.

Le paramètre vertical du profil est calculé une seule fois entre le sol de base et le sommet réel de
la salle. Un mur de trois étages forme donc une seule parenthèse ou un seul chevron sur toute sa
hauteur ; il ne répète jamais le motif dans chaque tranche. Les tranches restent seulement des
propriétaires d'affichage et de collision du morceau qu'elles traversent.

- mur extérieur : les deux faces sont translatées par le même profil ; sa forme reste visible depuis
  l'intérieur comme depuis l'extérieur et son épaisseur nominale reste constante ;
- mur entre deux salles : le profil appartient à la face de la salle depuis laquelle il a été édité.
  La face de la salle voisine reste sur la frontière commune ; la profondeur fait donc varier
  l'épaisseur vers la salle éditée sans empiéter dans la voisine ;
- le côté intérieur n'est jamais déduit de l'axe X/Z. Chaque chemin reçoit un
  `interiorNormalSign` dérivé de l'empreinte polygonale réelle de sa tranche. La même règle couvre
  murs droits, arcs, trous, découpes et profils verticaux de salles fusionnées ;
- le broadphase inclut la profondeur maximale. Le narrow phase de collision et de LOS échantillonne
  seulement le profil canonique à la hauteur testée ; ces bandes temporaires ne sont jamais
  sauvegardées ;
- angle et profondeur sont deux vues synchronisées du même paramètre géométrique. Le document garde
  la profondeur canonique pour éviter deux valeurs contradictoires.
- tout angle reçoit un raccord volumique dérivé par face et par salle. À chaque hauteur, le moteur
  intersecte séparément les faces avant et arrière avec le voisin qui possède réellement la même
  salle. Le raccord reste donc fermé si un seul mur est profilé, si les profondeurs diffèrent, si un
  arc rejoint un mur droit, ou au bout d'un mur mitoyen où chaque face rejoint un mur différent. Le
  mur voisin resté vertical est lui aussi prolongé jusqu'à cette intersection et reprend la grille
  de subdivision verticale du profil voisin. Les deux maillages partagent ainsi leurs sommets à
  toutes les hauteurs, y compris entre le bas et le haut du profil ;
- arrondir horizontalement un mur déjà profilé conserve ses `sourceEdgeKeys`, son profil vertical et
  ses raccords. Les deux transformations peuvent donc être appliquées dans n'importe quel ordre ;
- une porte rigide déjà ancrée bloque la modification du profil vertical de son mur. Elle doit être
  déplacée ou supprimée ; le moteur ne décale jamais silencieusement l'ouverture et son collider.

## Salles qui se chevauchent ou se touchent

Tracer une salle dans une salle existante ou contre une salle existante ne doit pas empiler des murs en double.

Le générateur fabrique un seul panneau par frontière physique, puis fusionne les contributions des salles. Les dalles déjà couvertes par une salle englobante peuvent être ignorées, mais les murs manquants restent ajoutés pour permettre les sous-salles, cloisons et pièces adjacentes.

Une AABB rectangulaire n'est jamais une preuve de collision avec une salle arrondie. La différence
polygonale est calculée sur les contours effectifs : si un arc sort de l'ancienne empreinte de cases
ou coupe une case voisine, toute nouvelle salle intersectée est découpée sur cet arc. Les segments
communs sont dédupliqués ensuite en un seul mur physique portant les deux identités de salle.

## Sélection, dessin et modification

L’outil Salle est l’outil de référence.

- Par défaut, le clic gauche sélectionne.
- Un clic sélectionne la salle, le mur, l'objet ou le connecteur 3D sous la souris. Son panneau
  contextuel s'ouvre automatiquement du côté de l'objet où l'écran dispose de place ; il peut
  ensuite être déplacé par son en-tête et reste contraint à la fenêtre.
- Un rectangle de sélection sélectionne les salles entièrement entourées.
- Le bouton “Ajouter une salle” passe en dessin de salle.
- Après création d’une salle, l’éditeur sélectionne immédiatement la nouvelle salle, ouvre son
  panneau et revient en mode sélection.
- Le bouton global nomme toujours l'action cible : **Édition** en mode jeu, **Mode jeu** dans
  l'éditeur. Les boutons **Calque**, **Token** et **Outils** sont masqués pendant l'édition, où ils
  n'ont aucune action utile.
- Le panneau de salle expose un nom éditable avec les opérations texte natives (sélection,
  copier/coller), puis contient hauteur simple, épaisseurs de dalle/plafond/mur, multiplicateur de
  déplacement, collision, apparence du sol et du plafond — matière, motif, peinture,
  usure, saleté et relief — et accès à la création des connecteurs. Une salle à
  `verticalProfile` affiche sa hauteur locale comme propriété structurelle au lieu de proposer un
  sélecteur global trompeur. Il expose aussi **Supprimer la salle** avec confirmation ; cette
  suppression retire ses connecteurs et nettoie les références de découpe des salles restantes.
- La sélection d'une salle affiche uniquement une teinte légère sur son sol courant et un trait sur
  son contour effectif. Les murs, plafond et autres composants ne reçoivent pas chacun leur propre
  surbrillance.
- Une fois la salle sélectionnée, ses murs sont cliquables directement, sans activer un sous-mode.
  Un mur reste sans surimpression au repos, devient turquoise au survol puis reçoit une aura jaune
  sur tout son volume lorsqu'il est sélectionné. Une entité sélectionnée utilise le même langage
  visuel plutôt qu'une simple boîte filaire.
- Cliquer un mur remplace le panneau de salle par le panneau de mur. Celui-ci regroupe sélection
  multiple, arrondi dans le plan, suppression/fusion et profil vertical `|` / `(` / `<` avec
  réglettes de profondeur et d'angle. Le sens est un choix explicite **Vers l'intérieur** ou
  **Vers l'extérieur**, commun à tout le contour. Il contient l'apparence intérieure, un identifiant
  technique sélectionnable mais non modifiable, **Ajouter une porte** pour le mur unique actif et
  **Sélectionner tous les murs de la salle**. La barre latérale reste réservée aux outils de création.
- Les familles de réglages longues sont regroupées en sections repliables. Les panneaux de salle,
  mur, objet et connecteur 3D restent déplaçables après leur placement automatique.
- Les réglages initiaux d'usure, de saleté et de relief valent `0`. Seule une modification explicite
  de l'utilisateur crée un aspect altéré ou un relief géométrique.
- Chaque panneau de sélection destructible expose son action au même endroit : salle, mur et objet
  ou connecteur 3D. Les salles et objets demandent une confirmation avant mutation.
- Les arêtes colinéaires forment un mur droit sélectionnable. Un arc canonique entier forme également
  un seul mur sélectionnable, quelle que soit sa tessellation de rendu.
- Deux murs voisins ou plus forment une chaîne ouverte. Une réglette de 5° à 175° affiche l'arc en
  direct ; **Inverser la courbure** change son sens, **Appliquer l'arrondi** modifie le contour et
  **Remettre droit** retire l'arc touché.
- Les sélections disjointes, les murs partiels, le contour fermé entier et les chaînes séparant des
  voisins différents sont refusés.
- **Supprimer les murs** accepte un ou plusieurs murs complets. Vers l'extérieur, le volume reste
  une salle unique mais la frontière devient ouverte. Entre deux salles de même sol, même si leurs
  hauteurs diffèrent, les deux salles sont fusionnées ; la salle actuellement sélectionnée survit et conserve
  ses matériaux, réglages et `worldId`, tandis que les connecteurs de la salle absorbée sont
  remappés. Une porte posée sur la séparation supprimée disparaît avec celle-ci.
- Supprimer une séparation courbe retire également l'arc qui la portait. Le contour fusionné est
  recalculé depuis l'union des empreintes au lieu de conserver une frontière invisible.
- Un mur déjà ouvert ne conserve aucune zone de sélection invisible.

Les anciens outils Dalle, Mur et Escalier peuvent rester temporairement visibles comme aides de test,
mais aucune compatibilité de carte ne justifie de dupliquer le nouveau modèle. La conception cible
passe par des objets Salle et des connecteurs d'étages.

## Connecteurs

Les portes et ascenseurs ne doivent pas être traités comme de simples entités 3D posées librement.

Ils appartiennent à `surface_data.connectors`, car ils portent des règles de structure :

- appartenance à une ou plusieurs salles ;
- position contrainte à une frontière physique pour une porte ;
- niveaux de départ/arrivée pour un ascenseur ;
- état futur : ouvert/fermé/verrouillé/étanche ;
- règles de collision, vue, déplacement et eau.

Chaque connecteur doit recevoir un UUID stable. Les identifiants dérivés de ses coordonnées sont
acceptables uniquement comme compatibilité temporaire : déplacer le connecteur ne doit pas lui
faire perdre son état runtime.

Une porte se pose exclusivement depuis le panneau du mur sélectionné. Le placement garde les
`sourceEdgeKeys` de ce mur comme contrainte et ne peut donc pas sauter sur un autre côté de la salle.
Le mur peut être droit ou arrondi. Sur un arc, le connecteur conserve son abscisse curviligne, son
point d'ancrage exact, la tangente et la normale locales. La porte rigide s'aligne sur la tangente et
s'ouvre du côté de la normale ; elle ne dépend donc ni d'une corde d'approximation ni du sens dans
lequel les anciens petits segments auraient été générés. Si le mur est partagé par deux salles, le
connecteur peut référencer les deux salles.

Un ascenseur se pose depuis la configuration d’une salle sélectionnée. Sa définition référence une
cabine et plusieurs arrêts. Son étage courant, ses portes et son déplacement appartiennent à un
automate runtime ; l'ascenseur ne doit pas être réduit à une téléportation vers un unique étage
d'arrivée.

Depuis la Phase 6, cette définition compile une gaine réellement évidée et une cabine praticable
mobile. Toutes les portes palières restent bloquantes lorsque la cabine est absente. Les tokens
embarqués sont attachés à son repère local durable et suivent sa hauteur sans déplacement gratuit.

Le modèle 3D d'une porte est choisi dans le flux lancé depuis le mur ; celui d'un ascenseur reste
choisi depuis la configuration de la salle. Ils ne viennent pas de l'onglet des objets libres. Ils
sont attachés au connecteur comme apparence (`modelBlueprintId`, label, catégorie, GLB), mais ils ne
doivent pas redevenir la source de vérité.

Les couleurs de composants GLB sont également une apparence de connecteur. Les overrides sont stockés dans `modelMaterialOverrides`, indexés par slot (`SLOT_01`, `SLOT_02`, etc.). Le renderer ne recolore que les matériaux déclarés en `SLOT_xx`; les matériaux `FIXED` du modèle restent intacts.

En mode sélection, cliquer sur un connecteur 3D ouvre un panneau flottant avec ses caractéristiques métier et ses options d’apparence : type, étage, dimensions, état de porte et couleurs exposées par les slots du modèle.

### Découpe de mur par une porte

Une porte ne supprime pas un panneau de mur complet. Elle crée une ouverture limitée à son emprise :

- largeur/profondeur/hauteur prises depuis la géométrie déclarée du modèle, sans conversion axe par axe avec la grille ;
- distinction entre `openingWidth` (passage/panneau utile) et `wallCutWidth` / empreinte extérieure (cadre complet à dégager dans le mur) ;
- position centrée sur le point cliqué, contrainte dans le panneau de mur ;
- découpe en morceaux : mur à gauche, mur à droite et linteau au-dessus si la hauteur du mur le permet ;
- une ouverture peut traverser plusieurs panneaux de mur voisins : le panneau cliqué ne doit pas limiter la largeur de découpe ;
- sur un mur arrondi, la largeur est convertie en intervalle curviligne et découpe l'arc canonique en
  portions avant, après et linteau sans réintroduire de petits murs comme données métier ;
- les morceaux gauche/droite ne gardent pas de cap côté ouverture, sinon ils débordent dans le cadre de porte ;
- le linteau reste rattaché à l’étage propriétaire du mur pour l’affichage par étage, même si son `y` de rendu est au-dessus de la porte.

Le modèle 3D de porte est aligné par sa boîte englobante : centré horizontalement, posé au sol, puis rendu avec un scale uniforme si une correction de taille est nécessaire. Il ne doit jamais être étiré séparément en largeur, hauteur ou profondeur pour remplir arbitrairement une case ou toute la longueur du mur.

Sur un mur arrondi, le cadre et les vantaux restent rigides et tangents au point d'ancrage. En
revanche, chaque ensemble mural déporté du modèle (boîtier, clavier ou écran identifié côté façade
ou dos) est projeté sur la ligne médiane exacte du cercle puis orienté selon sa tangente locale. Les
deux faces suivent ainsi réellement la courbure sans élargir artificiellement l'ouverture ni déformer
la porte. Cette règle s'applique après le scale uniforme afin que le rayon du monde et les coordonnées
du GLB restent dans le même repère.

La découpe latérale suit `wallCutWidth` (ou `openingWidth` en secours pour les anciens connecteurs) et reste centrée sur le connecteur. Le boîtier/clavier ne participe jamais à la largeur de découpe. Le mur peut seulement recouvrir le cadre de façon minime et symétrique pour éviter un filet de jour, sans compensation spéciale selon le côté.

Le mesh d'un mur arrondi est continu sur toute la portion visible : ses normales suivent le rayon et
ses UV avancent selon la longueur de l'arc. Une texture traverse ainsi la courbe sans recommencer à
chaque ancien segment. Le nombre de subdivisions du mesh reste un détail de rendu réglable et ne
change jamais la géométrie du monde.

Important : la découpe de porte doit être appliquée à toutes les familles de murs rendues
(`roomsWallRenderPaths(...)` et `surface.walls`). Sinon un mur persistant non découpé peut rester
affiché derrière le connecteur et donner l’impression que le trou n’a pas changé.

## Connecteurs d’étages longs

Les escaliers doivent évoluer vers de vrais connecteurs entre étages :

- étage de départ ;
- étage d’arrivée ;
- emprise au sol ;
- sens d’entrée/sortie ;
- règles de collision et de navigation.

Les ascenseurs suivent la même logique de connecteur vertical, avec un volume, plusieurs arrêts et
un automate persistant, plutôt qu’un simple décor posé sur la carte.

Les escaliers et échelles doivent exposer des ancrages intermédiaires. Un token dont le budget est
épuisé termine son déplacement sur le connecteur, et non automatiquement à sa sortie.

Une passerelle fixe est une surface praticable en hauteur. Une passerelle mobile ou destructible est
une feature runtime possédant une capacité de support praticable ; son modèle 3D reste une apparence.

Au dessin, chaque case de passerelle cherche la salle réellement intersectée à son altitude et
enregistre son `clipRoomId`. `roomInteriorFootprintAtY(...)` reconstruit l'empreinte de tranche,
applique les arcs du contour et retire le bombé intérieur éventuel du mur. La dalle affichée est
l'intersection polygonale exacte. Le compilateur enregistre cette même empreinte et choisit un point
de navigation contenu dans celle-ci : une passerelle ne peut donc ni être vue ni empruntée dans la
partie qui sortirait d'une salle courbe ou profilée.

## Transformation des objets 3D

Le panneau d'une entité libre permet une rotation par pas de 90° à gauche ou à droite et une échelle
uniforme fine de `0.25` à `4`, par pas de `0.05`. Les objets ancrés structurellement à un mur gardent
leur orientation dérivée du connecteur. L'échelle canonique est stockée dans
`entity.state.transform.scale`, validée côté serveur, diffusée aux autres clients et consommée à la
fois par le renderer, la collision d'occupation et l'occlusion de ligne de vue. Le GLB agrandi n'est
donc jamais plus grand que son volume physique, ni l'inverse.

## Coût de déplacement et effets

Toute surface praticable et tout connecteur doivent accepter un multiplicateur de déplacement MJ,
par défaut `1`. Ce multiplicateur statique représente par exemple des débris permanents ou un
escalier très endommagé.

Les événements de partie, comme de l'huile répandue, un incendie, du gaz ou une inondation, sont des
instances d'effet superposées à la surface. Ils ne doivent pas réécrire son multiplicateur de base.
La formule et les règles de cumul sont définies dans `docs/SYSTEME/MOTEUR_MONDE.md`.
