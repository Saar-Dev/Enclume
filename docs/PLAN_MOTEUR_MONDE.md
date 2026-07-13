# PLAN_MOTEUR_MONDE.md — reconstruction progressive du moteur de monde

> Dernière mise à jour : 2026-07-13 — plan issu de l'audit croisé combat/monde.
>
> Statut : **Phases 0 à 5 codées et vérifiées ; phases 6 et 7 planifiées**.
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

- `shared/world/surfaceDocument.js` valide et normalise `surface_data` v1 à v4, attribue des UUID
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

## 10. Phase 7 — branchement complet du combat et retrait du legacy

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

---

## 11. Matrice de non-régression minimale

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

## 12. Définition de fini du chantier

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
