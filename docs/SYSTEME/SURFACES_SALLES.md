# SYSTEME/SURFACES_SALLES.md — éditeur Salle

> Dernière mise à jour : 2026-07-13 — distinction éditeur, moteur physique et état runtime.

> Lire pour : tout code touchant `surface_data`, l’outil Salle, les murs de salles, les textures de sol/plafond/mur et l’étanchéité.

> Architecture physique complète : `docs/SYSTEME/MOTEUR_MONDE.md`.
> Ordre de migration : `docs/PLAN_MOTEUR_MONDE.md`.

## Statut au 2026-07-13

L'éditeur Surface/Salle et son rendu existent. `surface_data` version 4 sait décrire des salles,
sols, murs, plafonds, escaliers et connecteurs. Depuis la Phase 1 du moteur de monde, ce document est
validé et compilé côté serveur en snapshot physique. Depuis la Phase 2, les collisions et la
navigation de session lisent ce snapshot ; la LOS et la résolution complète du combat attendent les
Phases 3 et 7.

Ce document décrit le contrat de l'éditeur. `MOTEUR_MONDE.md` décrit la cible commune qui compilera
ce document pour la navigation, la collision, la visibilité et les effets. Ne pas ajouter une
seconde logique physique directement dans le renderer pour contourner cette migration.

## Source de vérité

Le mode Salle repose sur `surface_data.rooms`.

Une salle est un objet métier rectangulaire :

- emprise grille : `minX`, `maxX`, `minZ`, `maxZ` ;
- étage de base : `level` / `y` ;
- hauteur : `heightLevels`, exprimée en étages, pas en mètres ;
- dalles : sol et plafond, avec textures ou matériaux séparés pour dessus/dessous ;
- murs : une face intérieure et une face extérieure ;
- connecteurs : portes, ascenseurs et futurs passages entre salles/étages.

Les dalles et les murs rendus ne doivent pas devenir la source de vérité. Ils sont dérivés depuis les salles au moment du rendu ou des calculs d’étanchéité.

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

## Sélection, dessin et modification

L’outil Salle est l’outil de référence.

- Par défaut, le clic gauche sélectionne.
- Un clic sélectionne la salle ou le connecteur 3D sous la souris.
- Un rectangle de sélection sélectionne les salles entièrement entourées.
- Le bouton “Ajouter une salle” passe en dessin de salle.
- Après création d’une salle, l’éditeur reste en dessin de salle pour permettre d’enchaîner plusieurs pièces.
- Le retour au mode sélection se fait uniquement par clic explicite sur “Sélection”.
- Modifier les options du panneau applique les changements à la salle sélectionnée : hauteur en étages, épaisseurs, blocage, textures ou matériaux procéduraux.

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

Une porte se pose depuis la configuration d’une salle sélectionnée. Elle doit être forcée sur un mur de cette salle. Si le mur est partagé par deux salles, le connecteur peut référencer les deux salles.

Un ascenseur se pose depuis la configuration d’une salle sélectionnée. Sa définition référence une
cabine et plusieurs arrêts. Son étage courant, ses portes et son déplacement appartiendront à un
automate runtime ; l'ascenseur ne doit pas être réduit à une téléportation vers un unique étage
d'arrivée.

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
- les morceaux gauche/droite ne gardent pas de cap côté ouverture, sinon ils débordent dans le cadre de porte ;
- le linteau reste rattaché à l’étage propriétaire du mur pour l’affichage par étage, même si son `y` de rendu est au-dessus de la porte.

Le modèle 3D de porte est aligné par sa boîte englobante : centré horizontalement, posé au sol, puis rendu avec un scale uniforme si une correction de taille est nécessaire. Il ne doit jamais être étiré séparément en largeur, hauteur ou profondeur pour remplir arbitrairement une case ou toute la longueur du mur.

La découpe latérale suit `wallCutWidth` (ou `openingWidth` en secours pour les anciens connecteurs) et reste centrée sur le connecteur. Le boîtier/clavier ne participe jamais à la largeur de découpe. Le mur peut seulement recouvrir le cadre de façon minime et symétrique pour éviter un filet de jour, sans compensation spéciale selon le côté.

Important : la découpe de porte doit être appliquée à toutes les familles de murs rendues (`roomsWallSegments(...)` et `surface.walls`). Sinon un mur persistant non découpé peut rester affiché derrière le connecteur et donner l’impression que le trou n’a pas changé.

## Connecteurs d’étages longs

Les escaliers doivent évoluer vers de vrais connecteurs entre étages :

- étage de départ ;
- étage d’arrivée ;
- emprise au sol ;
- sens d’entrée/sortie ;
- règles de collision et de navigation.

Les ascenseurs suivront la même logique de connecteur vertical, avec un volume et des arrêts d’étage, plutôt qu’un simple décor posé sur la carte.

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
