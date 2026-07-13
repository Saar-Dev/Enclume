# PLAN_MOTEUR_MONDE.md — reconstruction progressive du moteur de monde

> Dernière mise à jour : 2026-07-13 — plan issu de l'audit croisé combat/monde.
>
> Statut : **Phases 0 à 8 codées et vérifiées ; moteur monde autoritaire branché au combat**.
>
> Priorité produit : fonctionnement du monde et de l'éditeur avant l'adaptation des mécaniques de
> combat historiques.

Source durable de l'architecture : `docs/SYSTEME/MOTEUR_MONDE.md`.

---

## 1. But

Remplacer progressivement les hypothèses voxel dispersées par un moteur commun capable de gérer :

- plusieurs étages ;
- sols, murs, portes et matériaux à canaux indépendants ;
- escaliers, échelles, passerelles et ascenseurs ;
- coût de déplacement exprimé en mètres ;
- arrêt en cours de parcours ;
- effets intégrés et personnalisés ;
- collisions, lignes de vue, couverture et propagation environnementale cohérentes ;
- validation serveur réutilisable par le combat.

Le chantier ne doit pas réécrire le moteur de combat pour le principe. Sa FSM et ses règles métier
sont conservées puis rebranchées sur les nouveaux services.

---

## 2. Garde-fous

- Travailler uniquement sur la branche/worktree d'intégration.
- Ne jamais modifier le dépôt de l'autre développeur.
- Aucun basculement des services actifs avant validation explicite.
- Les cartes voxel existantes peuvent servir de fixtures de comparaison, sans objectif de
  rétrocompatibilité. Elles ne doivent jamais contraindre le nouveau modèle.
- Chaque phase doit être livrable et réversible indépendamment.
- Supprimer un ancien chemin dès qu'il contourne ou fragilise l'autorité du nouveau moteur.
- Ne pas mélanger état de l'éditeur et état runtime.
- Ne pas utiliser Redis comme source durable.
- Tout changement de schéma reçoit une migration `up/down` testée sur une base clonée.

Point de départ Git vérifié :

- branche : `codex/world-engine-integration` ;
- merge : `8276086` ;
- parent combat : `255736d` ;
- parent Surface : `75a3aec`.

---

## 3. Phase 0 — contrats, unités et tests dorés ✅

### Livrables

- `WorldMetrics` et conversions canoniques en mètres ;
- schémas versionnés du document monde, des états runtime et du snapshot ;
- interfaces pures `WorldCompiler`, `MovementService`, `VisibilityService`, `EffectService` ;
- format de `PathPlan` et `PathSegment` ;
- fixtures minimales à deux étages ;
- tests dorés avant toute modification du combat.

### Tests de sortie

- 10 cases de 1,5 m coûtent 15 m, pas 10 m ni 22,5 m ;
- portée et déplacement utilisent la même conversion ;
- scénario Jon : `3 + 3×2×2 = 15 m` et arrêt à 3 m sur l'échelle ;
- conversion monde -> mètres -> monde stable dans les tolérances ;
- un document de version inconnue est rejeté proprement.

### Interdiction de phase

Ne pas encore modifier les actions de combat. Cette phase fixe les contrats et révèle les écarts
d'unité sans changer le comportement de production.

### Livré le 2026-07-13

- `shared/world/worldMetrics.js` ;
- `shared/world/movementCost.js` ;
- `shared/world/worldContracts.js` ;
- `shared/world/index.js` ;
- commande `npm run test:world` ;
- 13 tests réussis, `node --check` réussi et build client Vite réussi.

Le socle n'est pas encore branché au runtime. Cette absence est intentionnelle et relève de la
Phase 1, pas d'un oubli de la Phase 0.

---

## 4. Phase 1 — document monde et compilateur serveur ✅

### Livrables

- validation serveur de `surface_data`/`world_document` ;
- migration explicite entre versions du document ;
- UUID stables pour salles, barrières et connecteurs ;
- `world_revision` incrémentée atomiquement ;
- compilateur pur produisant supports, barrières, portails, colliders, occluders et compartiments ;
- cache de snapshot par carte et révision ;
- correction de l'index `battlemap_texture_usage` pour unir voxels et surfaces ;
- prévisualisation éditeur utilisant le même compilateur lorsque possible.

### Tests de sortie

- une salle simple produit un sol praticable et quatre barrières ;
- deux salles adjacentes ne produisent pas deux murs physiques superposés ;
- une porte découpe le mur mais reste un portail logique unique ;
- enregistrer les surfaces ne supprime pas l'usage des textures voxel et inversement ;
- une édition concurrente sur une ancienne révision est refusée ou fusionnée explicitement ;
- recompiler deux fois la même entrée produit le même snapshot.

### Livré le 2026-07-13

- `shared/world/surfaceDocument.js` valide et normalise `surface_data` v1 à v10, attribue des UUID
  stables et produit le `WorldDocument` canonique ;
- `shared/world/worldCompiler.js` compile salles, dalles, murs partagés, portes découpées, escaliers,
  ascenseurs désactivés en attente de leur contrôleur, colliders, occluders et compartiments ;
- `GET /api/battlemaps/:id/world-snapshot` expose le snapshot serveur mis en cache par carte et
  `world_revision` ;
- migration 152 : `world_revision`, `surface_revision`, `voxel_revision` et backfill des UUID ;
- sauvegardes voxel/surface transactionnelles avec verrou de ligne et optimistic locking propre à
  chaque document ;
- `battlemap_texture_usage` est désormais l'union atomique des textures voxel et Surface ;
- la duplication d'une carte recrée les UUID physiques pour ne pas partager son futur état runtime ;
- 27 tests passent, le build client passe et la migration `up/down` a été validée sur une base
  PostgreSQL isolée.

Limites assumées à la sortie de Phase 1 : le renderer de l'éditeur continue d'afficher directement
`surface_data`, les voxels ne sont pas encore compilés dans le snapshot et les consommateurs de jeu
historiques ne lisent pas encore ce snapshot. Ces branchements relèvent des Phases 2 et 3.

---

## 5. Phase 2 — collisions et navigation autoritaires ✅

### Livrables

- index spatial statique distinct de l'occupation dynamique ;
- colliders dimensionnés et orientés pour entités et tokens ;
- graphe de navigation 3D pondéré ;
- multiplicateur de déplacement sur toute surface praticable et tout connecteur ;
- endpoint/service de planification serveur ;
- chemin recalculé sous transaction avec `world_revision` et `runtime_revision` ;
- troncature à la dernière position atteignable ;
- commande MJ de téléportation distincte du déplacement normal ;
- coordonnées canoniques `world-feet` distinctes des positions `legacy-cell`.

### Tests de sortie

- un client forgé ne traverse ni mur ni plafond ;
- le serveur ignore les `action_key`/`ini_mod` calculés par le client ;
- une entité large bloque toutes les positions couvertes par son collider ;
- deux occupants indexés au même endroit ne s'écrasent pas ;
- changer une porte après la déclaration provoque revalidation, replanning ou troncature ;
- déplacement libre et déplacement de combat obtiennent le même chemin pour le même profil.

### Livré le 2026-07-13

- `shared/world/spatialIndex.js` sépare colliders statiques et occupants dynamiques volumétriques ;
- `shared/world/navigation.js` construit le graphe 3D pondéré et applique A*, portes, supports,
  multiplicateurs de surface, traversées fractionnables et arrêts stables ;
- `server/src/services/worldMovementService.js` met en cache les graphes, charge l'occupation,
  replanifie sous verrous et ne persiste que le point réellement atteint ;
- `server/src/services/movementBudgetService.js` calcule les allures depuis la fiche Polaris côté
  serveur ; le client choisit une allure, jamais un budget libre pour un déplacement de jeu ;
- `POST /world-path-preview`, `POST /world-move` et `POST /tokens/:id/teleport` séparent aperçu,
  déplacement autoritaire et dérogation MJ ;
- `TOKEN_MOVE` transporte une intention `{ destination, gait }` et rejette l'ancien déplacement par
  coordonnées directes ;
- la migration 153 ajoute `runtime_revision` et `tokens.position_space`. Les lignes existantes sont
  marquées `legacy-cell` sans conversion approximative ; toute nouvelle position est `world-feet` ;
- le canvas sélectionne les supports Surface, affiche le chemin serveur et rend les coordonnées
  canoniques sans décalage de demi-case ;
- les tokens nouvellement créés sont calés sur un support stable libre ; la collision token n'est
  plus maintenue dans le hash Redis historique ;
- 39 tests passent, le build Vite passe et la migration 153 `up/down` a été vérifiée sur PostgreSQL
  isolé.

Limite assumée : la FSM de résolution du combat et la LOS restent sur leur ancien chemin jusqu'aux
Phases 3 et 7. Le flux de mouvement du monde, lui, ne possède plus de bypass client direct.

---

## 6. Phase 3 — lignes de vue et matériaux ✅

### Livrables

- `VisibilityService` sur le snapshot physique ;
- posture et dimensions corporelles canoniques ;
- échantillons de couverture configurables ;
- occluders d'entités et barrières de `surface_data` ;
- canaux mouvement/vision/fluides indépendants ;
- prévisualisation client fondée sur la même requête ou la même logique pure ;
- suppression progressive du raycast exclusif à `voxel_data`.

### Tests de sortie

| Cas | Mouvement | Vision | Fluide |
|---|---:|---:|---:|
| Mur plein | bloqué | bloquée | bloqué |
| Vitre | bloqué | visible | bloqué |
| Grille | bloqué | visible | configurable |
| Porte ouverte | permis | visible | configurable |
| Fumée | permis | atténuée/bloquée selon densité | sans objet |

### Livré le 2026-07-13

- `shared/world/visibility.js` fournit profils de posture, yeux canoniques, raycast AABB 3D,
  transmittance, couverture multi-échantillons et interposition des acteurs ;
- `server/src/services/worldVisibilityService.js` combine occluders statiques, volumes d'entités,
  tokens et snapshot courant ;
- `POST /api/battlemaps/:id/world-visibility` expose le même calcul à la prévisualisation client ;
- `useCameraLOS` ne raycaste plus les voxels : il affiche les points et le résultat renvoyés par le
  serveur ;
- `server/src/lib/losService.js` conserve les effets métier du combat mais délègue désormais LOS,
  couverture et interposition au moteur de monde ;
- murs pleins, verre et grilles ont des canaux mouvement/vision/eau/gaz vérifiés séparément ;
- les entités peuvent fournir `blocksSight`/`blocks_sight`, un collider/occluder dimensionné, une
  rotation et une opacité ;
- les positions legacy sont refusées et la LOS entre étages utilise les plafonds/murs du snapshot ;
- 48 tests passent et le build Vite passe.

Limite assumée : les volumes atténuants sont déjà supportés par le service pur, mais leur persistance
et leur propagation (fumée, gaz, feu) relèvent de la Phase 5.

Ajouter les cas couverture debout, accroupi et couché dès que la pose canonique existe.

---

## 7. Phase 4 — étages, escaliers, échelles et passerelles ✅

### Livrables

- étage logique et hauteur physique explicites ;
- outil/connecteur Escalier compilé en parcours praticable ;
- outil/connecteur Échelle avec mode `climb` ;
- ancrages intermédiaires persistables ;
- passerelle fixe comme support statique ;
- composant de support pour passerelle mobile ou destructible ;
- affichage du chemin et du coût segment par segment dans l'éditeur et la session.

### Tests de sortie

- un token peut s'arrêter sur chaque portion utile d'un escalier ;
- un token peut finir son tour au milieu d'une échelle ;
- le coût de grimpe s'ajoute au multiplicateur MJ sans remplacer celui-ci ;
- retirer/détruire une passerelle invalide le chemin et la surface de support ;
- aucune liaison verticale n'est créée entre deux étages sans connecteur explicite ;
- portée et ligne de vue fonctionnent entre étages.

### Livré le 2026-07-13

- les escaliers compilent leurs extrémités au sommet réel des dalles et restent fractionnables ;
- les échelles sont des connecteurs structurels `climb`, indépendants de leur apparence, avec
  ancrages fins et reprise exacte d'un déplacement commencé au tour précédent ;
- le graphe crée un nœud transitoire lorsqu'un token est déjà au milieu d'une traversée : aucun
  retour gratuit à un palier et aucune téléportation à l'étage suivant ;
- l'éditeur expose Escalier, Échelle et Passerelle ainsi qu'un multiplicateur libre `×0,05` à
  `×100` sur les surfaces et connecteurs ;
- une passerelle est un support statique identifié, compilable ou supprimable par état runtime ;
- l'échelle générique rend rails et barreaux praticables sans faire du GLB une autorité physique ;
- la prévisualisation du trajet affiche pour chaque segment son mode, sa distance, son facteur et
  son coût en mètres ;
- 50 tests monde passent et le build client Vite passe.

Limite volontaire : l'ascenseur reste désactivé tant que l'automate et la cabine mobile de Phase 6
ne sont pas présents. Les états runtime persistants et les effets environnementaux arrivent en
Phase 5.

---

## 8. Phase 5 — régions et effets environnementaux ✅

### Livrables

- registre de définitions d'effets intégrées et personnalisées ;
- instances liées à une surface, un volume, une entité ou un token ;
- multiplicateurs et règles de stacking par catégorie ;
- hooks d'entrée, sortie, traversée, début et fin de tour ;
- effets intégrés initiaux : feu, inondation, gaz, huile/glissant, terrain instable ;
- propagation fondée sur les compartiments et canaux de perméabilité ;
- remplacement ou migration de l'ancienne table `zones`, actuellement sans consommateur actif.

### Tests de sortie

- casser un baril crée une instance d'huile sans modifier la définition du sol ;
- une zone d'huile modifie le coût et peut demander un test prévu par sa définition ;
- fermer une porte étanche modifie la propagation au changement de révision runtime ;
- un effet personnalisé peut fournir un multiplicateur et une note sans exécuter de code arbitraire ;
- le passage du chemin dans une zone déclenche l'effet même si la destination est hors de la zone ;
- feu/gaz/eau utilisent le même graphe de compartiments que les portes.

### Livré le 2026-07-13

- `shared/world/worldEffects.js` définit le registre commun, le cumul par catégorie, les régions,
  les hooks sûrs et les occluders atténuants ;
- effets intégrés initiaux : Feu, Inondé, Gaz, Huile/glissant et Terrain instable ;
- un effet personnalisé accepte nom, icône, note, multiplicateur, opacité et hooks déclaratifs
  (`note`, `test`, `damage`, `restriction`) sans jamais exécuter de script MJ ;
- les instances ciblent volume, support, feature, compartiment, entité ou token ;
- le graphe A* applique les facteurs environnementaux pendant la recherche, pas après le choix du
  chemin, et les événements sont calculés sur les segments réellement parcourus ;
- la LOS reçoit les mêmes volumes Feu/Gaz comme occluders dynamiques atténuants ;
- les hooks `enter`, `exit`, `traverse`, `turnStart` et `turnEnd` sont exposés aux consommateurs ;
- la propagation eau/gaz suit les compartiments et les canaux des portes ;
- migration 154 : définitions de campagne, états de features, instances, journal d'événements et
  archivage de l'ancienne table `zones` sous `legacy_zones` ;
- routes GM de création, modification, suppression et propagation ; lecture membre et événement
  temps réel `WORLD_RUNTIME_UPDATED` ;
- l'éditeur peint des volumes runtime, affiche les régions, crée un effet MJ inconnu et supprime une
  instance active ; la session affiche les mêmes volumes ;
- 57 tests monde passent, le build Vite passe et la migration 154 `up/down` a été vérifiée dans une
  transaction PostgreSQL annulée.

Les valeurs intégrées sont des défauts système explicites ; une campagne peut les compléter par un
effet personnalisé. Les conséquences Polaris finales des hooks restent consommées par le combat en
Phase 7.

---

## 9. Phase 6 — ascenseur mobile ✅

### Livrables

- définition statique cabine, arrêts et portes palières ;
- état runtime et automate de l'ascenseur ;
- appels, destination, temps de trajet et blocages ;
- référentiel mobile de cabine ;
- rattachement et détachement des passagers ;
- navigation possible uniquement lorsque cabine et palier sont compatibles ;
- visibilité/collision mises à jour pendant le trajet selon la règle choisie.

### Tests de sortie

- impossible d'embarquer porte fermée ou cabine absente ;
- les passagers se déplacent avec la cabine sans téléportation indépendante ;
- une sauvegarde de l'éditeur ne ramène pas la cabine à son état initial ;
- deux demandes concurrentes produisent un ordre déterministe ;
- un blocage de porte empêche le départ ;
- reconnexion et redémarrage restaurent l'état runtime.

### Implémentation livrée

- `shared/world/elevatorRuntime.js` porte l'automate pur et sérialisable, les arrêts multiples,
  l'interpolation physique, la file d'appels stable et le blocage/reprise des portes ;
- le compilateur découpe la gaine dans les dalles, produit une cabine mobile praticable, ses
  colliders/occluders, ses portes palières et une traversée d'embarquement seulement au palier
  aligné avec portes ouvertes ; aucune arête verticale d'ascenseur n'existe ;
- `worldElevatorService.js` réconcilie l'horloge sous verrou de battlemap, persiste l'état dans
  `world_feature_states` et déplace les tokens attachés dans le même référentiel local ;
- la migration 155 ajoute `world_elevator_passengers`. La file et les échéances restant dans l'état
  de feature, un redémarrage ne perd ni la destination ni les passagers ;
- déplacement, occupation, LOS et couverture réconcilient la cabine avant de compiler leur
  snapshot runtime ;
- l'éditeur configure les arrêts, l'orientation de porte et la vitesse. Éditeur et session rendent
  la vraie petite cabine mobile ; un joueur appelle un palier, le MJ peut aussi bloquer, débloquer,
  ouvrir ou fermer la porte ;
- validation : 64 tests monde, build Vite et aller-retour transactionnel PostgreSQL de la migration
  155.

---

## 10. Phase 7 — branchement complet du combat et retrait du legacy ✅

### Livrables

- la FSM combat appelle les services de monde au lieu des voxels ;
- déplacement, portée, couverture et LOS recalculés après la position atteinte ;
- modificateurs d'allure dérivés côté serveur ;
- terrain instable et suppression branchés sur les régions et chemins ;
- métriques et preview client alignées ;
- télémétrie de comparaison retirée après validation ;
- anciens chemins collision/pathfinder/LOS voxel supprimés ;
- documentation `ASBUILT`, `SYSTEME/COMBAT` et manuel mise à jour à la clôture.

### Tests de sortie

- parcours complet déclaration -> résolution avec déplacement partiel ;
- un changement du monde entre annonce et résolution est traité explicitement ;
- attaque après escalier utilise la position réellement atteinte ;
- portée, couverture et effets sont identiques côté prévisualisation et résolution serveur ;
- aucun payload client ne permet d'imposer une distance ou un modificateur favorable ;
- aucune dépendance runtime au format voxel historique.

### Livré le 2026-07-13

- `shared/combatMovement.js` devient le registre unique des allures, actions, couleurs et coûts
  d'initiative. Le serveur choisit l'allure minimale depuis le coût réel du chemin ; les valeurs
  `action_key` et `ini_mod` du payload ne sont plus une autorité ;
- la migration 156 stocke l'intention canonique (`destination_world`, allure, plan, budget et
  révisions). Une ancienne action pendante est invalidée plutôt que convertie en faux trajet 3D ;
- à la résolution, le chemin est toujours recalculé sous verrou. Une modification de structure,
  de cabine, d'effet ou d'occupation entre annonce et résolution produit un arrêt partiel ou un
  refus explicite, jamais une téléportation vers l'ancienne destination ;
- `worldSpatialQueryService.js` mesure corps à corps, encerclement, interactions et tirs en 3D et
  en mètres. `shared/combatRange.js` déduit la bande Polaris depuis la distance et la portée de
  l'arme ; le choix client de la bande est ignoré ;
- LOS, couverture, interposition, terrain instable et huile/glissant proviennent du snapshot et des
  régions d'effet. Les traversées sont journalisées et renvoyées avec le mouvement de combat ;
- `worldForcedMovementService.js` remplace la collision Redis du pousser/tirer : le token et l'objet
  forment une paire rigide qui s'arrête au dernier support libre ;
- la migration 157 convertit les portées d'interaction historiques de cases vers les mètres ;
- `redis.js`, `socketVoxel.js`, `client/src/lib/pathfinder.js` et `shared/losUtils.js` sont supprimés.
  L'onglet principal de l'éditeur s'appelle désormais **Monde**. Le rendu optionnel d'anciens voxels
  peut rester une fixture visuelle, sans participer à une décision physique ;
- validation : 77 tests monde/combat purs, deux migrations `up/down` sur PostgreSQL, checks Node,
  build Vite et recherche globale sans consommateur Redis/pathfinder/LOS voxel.

---

## 11. Phase 8 — tranches d'étage, eau et murs courbes ✅

### Règle de tranche

- afficher l'étage N retire du renderer et des interactions les sols, murs, tokens, entités et
  effets appartenant aux autres étages ;
- une salle haute de plusieurs étages est un volume ouvert local : depuis chaque tranche qu'elle
  traverse, son vrai sol inférieur, ses parois descendantes et son contenu plus bas restent
  visibles, sans plancher intermédiaire inventé ; son plafond appartient à sa dernière tranche ;
- cette exception est bornée par l'emprise horizontale et verticale de la salle. Elle ne révèle
  jamais une salle inférieure voisine ou superposée qui n'appartient pas à ce volume ;
- escaliers, échelles et ascenseurs restent présents uniquement sur leur portion ou palier pertinent
  pour la tranche courante ;
- une future trappe sera une capacité d'un connecteur vertical, généralement liée à une échelle,
  et non une raison de réafficher l'étage inférieur.

### Corrections et géométrie

- la surface extérieure de l'eau prend le sommet global de la carte et n'empile plus une nappe au
  plafond de chaque étage ;
- un objet d'un étage inférieur ne peut plus intercepter un clic ni servir de support dans l'éditeur
  de l'étage courant, sauf s'il est visible au fond du même volume multniveau ; même visible, il ne
  remplace jamais le plan de placement de l'étage courant ;
- l'éditeur expose **Mur droit** pour les panneaux libres. Les anciens murs courbes restent lisibles,
  mais les arrondis de salle sont désormais une transformation structurée de contour (Phase 10) ;
- les portes restent attachées aux portions droites. Une porte courbe exigerait un modèle et une
  découpe dédiés, elle n'est donc pas simulée approximativement.

### Validation

- tests purs de hauteur d'eau, de visibilité bornée d'un volume multniveau et de génération de
  courbe ;
- validation du document canonique pour les segments orientés ;
- compilation des colliders et occluders d'un mur courbe ;
- suite monde complète et build Vite.

---

## 12. Phase 9 — empreintes exclusives et contours de salles ✅

### Contrat `surface_data` v5

- une salle possède une empreinte explicite `cells`; ses bornes ne sont plus qu'une enveloppe de
  recherche et ne donnent aucun droit implicite sur les cases absentes ;
- dessiner une nouvelle salle dans un volume existant transfère les cases recouvertes à la nouvelle
  salle. L'ancienne adopte immédiatement le contour restant ;
- seules des salles dont les volumes verticaux se croisent se découpent. Deux salles empilées sur
  des étages distincts conservent leurs empreintes respectives ;
- si la découpe sépare l'ancienne empreinte en plusieurs composantes non reliées, le moteur crée des
  salles distinctes avec des identités stables au lieu de conserver un compartiment artificiellement
  discontinu.

### Consommateurs alignés

- sélection, surbrillance, dalles, plafonds, murs partagés, eau et connecteurs lisent la même
  empreinte ;
- le renderer fusionne les cases restantes en rectangles de dalles, mais cette optimisation ne
  change jamais la propriété des cases ;
- le compilateur produit un seul support par case propriétaire et dérive les murs depuis les arêtes
  du nouveau contour ;
- chaque compartiment compilé expose aussi son empreinte, afin que son AABB reste un simple
  broadphase et ne réintroduise pas la salle englobante dans la salle imbriquée.

### Validation

- transfert d'une salle intérieure 2 × 2 dans une salle 4 × 4 ;
- huit panneaux de mur communs et aucune dalle dupliquée ;
- séparation automatique d'une salle coupée en deux ;
- non-régression des salles superposées sur des étages distincts ;
- validation documentaire v5 et compilation de compartiments exclusifs.

---

## 13. Phase 10 — arrondis structurés de salles ✅

### Contrat `surface_data` v6

- `room.boundaryArcs` décrit un arc circulaire par ses arêtes remplacées, ses extrémités, son angle
  central et son côté ;
- `shared/world/roomGeometry.js` est l'autorité pure pour les boucles, murs droits regroupés, chaînes
  sélectionnées, échantillonnage des arcs, contours et segments physiques ;
- un arrondi appartient à la salle et, lorsqu'un contour est partagé, à toutes les salles voisines
  du même étage. Une salle empilée aux mêmes coordonnées n'est jamais modifiée ;
- les cases restent l'autorité logique des supports et du coût de déplacement. L'arc transforme la
  géométrie du plancher, du plafond et des murs sans inventer de nouvelle propriété de case.

### Éditeur

- après sélection d'une salle, **Arrondir des murs** rend chaque portion droite entre deux angles
  cliquable comme un seul mur ;
- au moins deux murs contigus sont requis ; la réglette 5°–175° affiche l'arc en direct et le côté
  peut être inversé ;
- **Remettre droit** retire l'arc touchant la sélection ;
- une porte déjà posée sur la chaîne bloque la transformation, à tous les niveaux d'une salle haute ;
- l'ancien bouton de courbe libre est retiré de l'éditeur de salle.

### Géométrie et physique

- les dalles et plafonds courbes sont extrudés depuis le même contour, avec prise en charge des cours
  intérieures ;
- les murs sont compilés depuis les mêmes segments que le rendu ;
- les AABB restent l'index de broadphase, mais déplacement et visibilité utilisent un prisme orienté
  par segment pour éviter les faux obstacles dans les coins de la boîte englobante ;
- collision, étanchéité et LOS conservent leurs canaux indépendants (`solid`, `glass`, `grate`).

### Validation

- regroupement des arêtes colinéaires et refus des sélections disjointes ou partielles ;
- contour, rendu et compilation dérivés du même arc ;
- isolation des étages superposés et refus d'une porte portée par la chaîne ;
- tests dédiés de narrow phase orientée pour collision et LOS ;
- 85 tests monde/combat, ESLint ciblé sans erreur et build Vite validés.

---

## 14. Phase 11 — suppression, fusion et priorité géométrique ✅

### Contrat `surface_data` v7

- `room.openWallEdgeKeys` décrit les murs extérieurs supprimés sans supprimer les dalles ;
- `room.geometryClipRoomIds` forme un graphe acyclique de différences polygonales. Une salle créée
  après une salle courbe soustrait la géométrie de celle-ci et épouse sa frontière exacte ;
- les `cells` restent l'index discret et le broadphase. Dans une case partiellement coupée par une
  courbe, le multipolygone effectif est l'autorité d'occupation ;
- les documents v1 à v6 restent lisibles. La migration v6 détecte les recouvrements avec une salle
  arrondie plus ancienne et ajoute les découpes requises.

### Éditeur et fusion

- un ou plusieurs murs complets sélectionnés peuvent être supprimés ;
- une frontière extérieure devient une ouverture physique ;
- une frontière entre deux salles de même base fusionne les volumes. Depuis la Phase 13, leurs
  hauteurs peuvent différer et sont conservées dans un profil vertical. La salle
  active conserve son `worldId`, ses matériaux et réglages ;
- une fusion en chaîne redérive `heightLevels` et `height` du nombre de tranches canoniques avant
  sauvegarde ; les métadonnées de l'ancienne salle active ne peuvent pas survivre par erreur ;
- portes sur la frontière supprimée, références de salles des connecteurs et dépendances de découpe
  sont nettoyées ou remappées atomiquement ;
- supprimer une frontière courbe retire aussi l'arc séparateur.

### Géométrie et physique

- `shared/world/roomGeometry.js` calcule différence, intersection, aire, multipolygone, appartenance
  d'un point et segments à partir d'une seule géométrie effective ;
- les dalles prennent en charge plusieurs polygones et leurs trous ;
- les murs courbes communs sont dédupliqués en un panneau physique partagé ;
- rendu, sélection, compilateur, collisions et LOS consomment les mêmes segments ;
- 92 tests monde/combat et 12 tests client Surface passent, ESLint ciblé ne remonte aucune erreur et
  le build Vite est validé.

---

## 15. Phase 12 — murs courbes canoniques et portes tangentes ✅

### Contrat `surface_data` v8

- `room.boundaryArcs` reste la définition éditée ; `roomBoundaryPaths(...)` en dérive un chemin
  canonique avec centre, rayon, angle initial, balayage, longueur et identité de courbe ;
- un arrondi n'est plus représenté par une collection de petits murs dans le snapshot : le
  compilateur émet une géométrie `wall-arc` unique ;
- une porte courbe conserve son abscisse curviligne, son ancrage exact, sa tangente et sa normale.
  Le sens du connecteur est ainsi indépendant de l'ordre de tessellation ;
- la découpe d'une porte partage l'arc en intervalles avant/après et linteau, sans perdre son
  identité ni limiter l'ouverture à une subdivision visuelle.

### Rendu et physique

- le renderer génère un mesh continu pour chaque portion d'arc visible ; les normales analytiques
  suivent le rayon et les UV suivent la longueur, ce qui garantit la continuité des textures ;
- le nombre de subdivisions du mesh est uniquement un niveau de détail. Il n'est jamais sauvegardé
  comme structure du mur ;
- le cadre d'une porte reste tangent et rigide, tandis que ses accessoires muraux déportés sont
  projetés sur le cercle et tournés selon la tangente locale. Le boîtier concave ne traverse donc plus
  le mur et son débord ne modifie pas la largeur structurelle de l'ouverture ;
- broadphase, collision et LOS consomment `wall-arc`. Une tessellation locale est permise uniquement
  comme adaptateur interne du narrow phase ;
- un mur courbe commun reste un unique obstacle dédupliqué pour les deux salles.

### Sélection dans l'éditeur

- une salle sélectionnée reçoit une teinte de sol légère et un seul contour, sans recouvrir en jaune
  chacun de ses murs, son plafond et ses dalles ;
- ses murs deviennent immédiatement cliquables en mode sélection. Les volumes de hit restent
  invisibles au repos ; seul le mur survolé ou sélectionné porte un trait ;
- `roomSelectableWallRuns(...)` expose la même unité logique à l'interface : un côté droit continu
  vaut un mur et un arc canonique complet vaut un mur, indépendamment de ses subdivisions ;
- les commandes d'arrondi, de remise à plat et de suppression restent visibles dès la sélection de
  la salle. Une frontière déjà ouverte est absente des cibles de clic.

### Validation

- porte sur arc : point sur le rayon, tangente et normale unitaires orthogonales, rotation stable ;
- découpe d'arc et traversée dans le sens de la normale ;
- collision et LOS sur `wall-arc` sans faux obstacle hors de la courbe ;
- sauvegarde round-trip d'une salle arrondie, récupération sûre d'une révision locale obsolète et
  refus d'écraser une vraie modification concurrente ;
- 100 tests monde/combat et 20 tests client Surface/persistance/géométrie passent ; ESLint ciblé ne remonte aucune erreur
  et le build Vite est validé.

---

## 16. Phase 13 — volumes canoniques à hauteur variable ✅

### Contrat `surface_data` v9

- `room.verticalProfile.slices[]` est la source de vérité lorsqu'une salle n'a pas la même emprise à
  chaque hauteur ; chaque tranche contient son empreinte multipolygone et ses murs canoniques ;
- supprimer une séparation fusionne désormais les salles de même sol sans exiger la même hauteur ;
- le plafond est dérivé par différence entre deux tranches successives. Une zone basse reçoit son
  plafond local tandis qu'une zone haute conserve ses murs et son plafond supérieur ;
- renderer, visibilité par étage, placement, supports, compartiments, collision, LOS et eau
  consomment le même profil. Aucun adaptateur de combat ne reconstruit une hauteur parallèle ;
- les salles simples restent lisibles sans profil explicite et sont adaptées vers des tranches à la
  frontière du moteur.

### Interface

- cliquer une salle ouvre un panneau contextuel proche du clic, sur le même principe que les objets
  3D ;
- le panneau expose épaisseurs, coût de déplacement, collision et matériaux par face ;
- une salle à hauteur variable signale son profil structurel et ne propose pas de hauteur globale
  susceptible de détruire ses plafonds locaux ;
- la barre latérale conserve les outils de création, pas l'inspecteur de la sélection.

---

## 17. Phase 14 — profils verticaux de murs et panneau contextuel ✅

### Contrat `surface_data` v10

- `room.wallElevationProfiles[]` rattache un profil `curved` ou `faceted` à des arêtes logiques ;
  profondeur et sens sont canoniques, l'angle affiché est une conversion synchronisée ;
- la courbure du contour vue du dessus et le profil vu de côté sont orthogonaux et combinables ;
- sur une façade extérieure, les deux faces suivent la même translation ; sur un mur mitoyen, seule
  la face de la salle éditée varie et l'autre frontière reste fixe, faisant varier l'épaisseur sans
  empiéter dans la salle voisine ;
- le renderer crée un maillage lofté continu. Le compilateur conserve le profil dans
  `wall-segment`/`wall-arc`, élargit le broadphase et le narrow phase collision/LOS échantillonne la
  hauteur localement ;
- les profils sont conservés lors d'une fusion et retirés avec les arêtes réellement supprimées.
- une porte déjà ancrée bloque la transformation verticale de son mur afin que maillage, ouverture,
  portail et collider ne puissent pas diverger.
- les raccords sont des intersections volumétriques dérivées par face et par salle à chaque hauteur.
  Ils ferment aussi le cas d'un unique mur profilé, de profondeurs différentes et d'une jonction en
  T où les deux faces d'un mur mitoyen rejoignent des voisins distincts ; le loft et le padding
  collision/LOS prolongent les côtés concernés. Un arc horizontal conserve son profil vertical.

### Interface

- cliquer directement un mur ouvre son panneau contextuel ;
- le panneau regroupe sélection multiple, arrondi horizontal, remise à plat, suppression/fusion et
  profils `|`, `(`, `<` ;
- deux réglettes liées permettent d'éditer profondeur et angle ; le sens est choisi explicitement
  vers l'intérieur ou vers l'extérieur et repose sur la normale intérieure du contour effectif ;
- fermer le panneau de mur désélectionne les murs mais conserve la salle active.
- les panneaux de salle, mur et objet/connecteur 3D exposent directement leur suppression ; la
  salle et l'objet demandent confirmation et la suppression de salle nettoie connecteurs, clips et
  propriété des arcs partagés.

### Validation

- 112 tests du moteur/serveur et 29 tests client Surface/persistance passent ;
- ESLint ciblé des fichiers Surface ne remonte aucune erreur ;
- build Vite de production validé.

---

## 18. Matrice de non-régression minimale

Chaque phase doit conserver ou ajouter ces scénarios :

1. ancienne carte voxel, fixture facultative de comparaison uniquement ;
2. salle Surface simple ;
3. salles adjacentes avec porte ;
4. plusieurs étages sans connexion ;
5. escalier avec multiplicateur MJ ;
6. échelle avec arrêt intermédiaire ;
7. passerelle détruite pendant un plan ;
8. ascenseur entre au moins trois étages ;
9. verre, grille et mur plein ;
10. huile créée par un objet cassé ;
11. feu, gaz et inondation dans des compartiments ;
12. token et entité volumique concurrents ;
13. changement de `world_revision` entre planification et résolution ;
14. tentative de déplacement forgée côté client ;
15. sauvegardes alternées voxels/surfaces sans perte d'index texture.

---

## 17. Définition de fini du chantier

Le moteur de monde est considéré terminé lorsque :

- l'éditeur et le serveur valident le même schéma ;
- une source statique et un état runtime distincts sont identifiables ;
- le snapshot physique sert à la navigation, collision, LOS et effets ;
- toutes les distances de règles sont en mètres ;
- tous les déplacements de jeu sont autoritaires côté serveur ;
- les connecteurs verticaux autorisent l'arrêt en cours de parcours ;
- l'ascenseur persiste son état et transporte réellement ses passagers ;
- le combat ne lit plus directement `voxel_data` pour ses décisions spatiales ;
- les scénarios de la matrice passent ;
- l'ancien moteur est retiré dès que les consommateurs restants sont rebranchés ; aucune migration
  des cartes historiques n'est requise.
