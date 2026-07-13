# SYSTEME/SURFACES_SALLES.md — éditeur Salle

> Dernière mise à jour : 2026-07-13 — murs courbes canoniques, portes tangentes et accessoires plaqués sur l'arc.

> Lire pour : tout code touchant `surface_data`, l’outil Salle, les murs de salles, les textures de sol/plafond/mur et l’étanchéité.

> Architecture physique complète : `docs/SYSTEME/MOTEUR_MONDE.md`.
> Ordre de migration : `docs/PLAN_MOTEUR_MONDE.md`.

## Statut au 2026-07-13

L'éditeur Surface/Salle et son rendu existent. `surface_data` version 8 sait décrire des salles,
sols, murs, plafonds, escaliers et connecteurs. Depuis la Phase 1 du moteur de monde, ce document est
validé et compilé côté serveur en snapshot physique. Depuis la Phase 2, les collisions et la
navigation de session lisent ce snapshot. Depuis la Phase 3, la LOS, la couverture et l'interposition
le lisent également ; depuis la Phase 7, la FSM combat lui délègue aussi déplacements, distances,
portées, interactions et terrain instable. Depuis la Phase 8, l'affichage isole strictement l'étage
courant. Depuis la Phase 10, les murs courbes de salle sont des arcs structurés de leur contour,
partagés par le rendu, les collisions et la LOS. Depuis la Phase 11, supprimer un mur ouvre la
salle ou fusionne ses deux volumes, et une nouvelle salle est découpée par les contours courbes
déjà présents au lieu de superposer ses murs. Depuis la Phase 12, un mur arrondi reste un arc
paramétrique unique dans le document, le renderer et le snapshot physique. Sa tessellation n'est
plus une autorité enregistrée ni une collection de petits murs.

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
- hauteur : `heightLevels`, exprimée en étages, pas en mètres ;
- dalles : sol et plafond, avec textures ou matériaux séparés pour dessus/dessous ;
- murs : une face intérieure et une face extérieure ; les murs libres sont droits ou restent des
  données historiques, tandis que les arrondis de salle sont de vrais chemins circulaires ;
- arrondis de salle : `boundaryArcs`, chacun lié à une chaîne d'arêtes du contour avec un angle et
  un côté. Le chemin canonique dérivé conserve centre, rayon, angle initial, balayage et longueur ;
- découpes géométriques : `geometryClipRoomIds` soustrait le contour effectif de salles prioritaires
  au contour brut de la salle. Le graphe de dépendances est acyclique ;
- murs supprimés vers l'extérieur : `openWallEdgeKeys` retire les panneaux, colliders et occluders
  concernés sans supprimer le sol ni le plafond ;
- connecteurs : portes, escaliers, échelles, passerelles et ascenseurs entre salles/étages.

Lorsqu'une nouvelle salle recouvre une salle orthogonale existante à une hauteur commune, ses cases
sont transférées : elles sont ajoutées à la nouvelle empreinte et retirées de l'ancienne. Si une
salle déjà présente possède un arc ou une découpe, son contour effectif est prioritaire : la nouvelle
salle conserve ses cases de broadphase mais soustrait cette géométrie avec `geometryClipRoomIds`.
Les deux dalles et leurs murs se rejoignent alors exactement sur la courbe, sans intersection
physique. Si l'ancienne empreinte orthogonale est coupée en plusieurs îlots non reliés, chaque îlot
devient une salle distincte. Des salles empilées sans chevauchement vertical conservent en revanche
les mêmes coordonnées `x:z`.

Une salle `heightLevels > 1` existe dans chaque tranche verticale qu'elle traverse et décrit un seul
volume ouvert. Depuis une tranche haute, son sol de base, ses murs descendants et le contenu situé
plus bas dans sa propre emprise restent visibles : un puits profond doit donc paraître profond.
Aucun plancher intermédiaire n'est créé automatiquement et les pièces inférieures extérieures à
cette emprise restent absentes. Une future trappe doit être portée par un connecteur vertical —
typiquement une échelle — avec son propre état ouvert/fermé ; elle ne révèle jamais l'étage inférieur
entier.

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

## Mur intérieur / extérieur

On ne raisonne plus en “face A / face B”.

Chaque panneau de mur physique possède deux faces :

- face intérieure de la salle située d’un côté ;
- face extérieure uniquement si aucune salle n’occupe l’autre côté.

Cas important : si deux salles se touchent, le même panneau de mur porte deux casquettes intérieures. La face vue depuis la salle A utilise le mur intérieur de A, et la face vue depuis la salle B utilise le mur intérieur de B. Une face extérieure ne doit jamais écraser une face intérieure.

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
- Un clic sélectionne la salle ou le connecteur 3D sous la souris.
- Un rectangle de sélection sélectionne les salles entièrement entourées.
- Le bouton “Ajouter une salle” passe en dessin de salle.
- Après création d’une salle, l’éditeur reste en dessin de salle pour permettre d’enchaîner plusieurs pièces.
- Le retour au mode sélection se fait uniquement par clic explicite sur “Sélection”.
- Modifier les options du panneau applique les changements à la salle sélectionnée : hauteur en étages, épaisseurs, blocage, textures ou matériaux procéduraux.
- **Arrondir des murs** regroupe les arêtes colinéaires : tout le côté compris entre deux angles se
  sélectionne en un clic.
- Deux murs voisins ou plus forment une chaîne ouverte. Une réglette de 5° à 175° affiche l'arc en
  direct ; **Inverser le côté** change son sens, **Appliquer l'arrondi** modifie le contour et
  **Remettre droit** retire l'arc touché.
- Les sélections disjointes, les murs partiels, le contour fermé entier et les chaînes séparant des
  voisins différents sont refusés.
- **Supprimer les murs** accepte un ou plusieurs murs complets. Vers l'extérieur, le volume reste
  une salle unique mais la frontière devient ouverte. Entre deux salles de même sol et de même
  hauteur, les deux salles sont fusionnées ; la salle actuellement sélectionnée survit et conserve
  ses matériaux, réglages et `worldId`, tandis que les connecteurs de la salle absorbée sont
  remappés. Une porte posée sur la séparation supprimée disparaît avec celle-ci.
- Supprimer une séparation courbe retire également l'arc qui la portait. Le contour fusionné est
  recalculé depuis l'union des empreintes au lieu de conserver une frontière invisible.

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

Une porte se pose depuis la configuration d’une salle sélectionnée. Elle doit être forcée sur un mur
de cette salle, droit ou arrondi. Sur un arc, le connecteur conserve son abscisse curviligne, son
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

Les modèles 3D de portes/ascenseurs sont choisis depuis la configuration de la salle, pas depuis l’onglet des objets libres. Ils sont attachés au connecteur comme apparence (`modelBlueprintId`, label, catégorie, GLB), mais ils ne doivent pas redevenir la source de vérité.

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

## Coût de déplacement et effets

Toute surface praticable et tout connecteur doivent accepter un multiplicateur de déplacement MJ,
par défaut `1`. Ce multiplicateur statique représente par exemple des débris permanents ou un
escalier très endommagé.

Les événements de partie, comme de l'huile répandue, un incendie, du gaz ou une inondation, sont des
instances d'effet superposées à la surface. Ils ne doivent pas réécrire son multiplicateur de base.
La formule et les règles de cumul sont définies dans `docs/SYSTEME/MOTEUR_MONDE.md`.
