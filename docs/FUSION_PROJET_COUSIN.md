# FUSION_PROJET_COUSIN.md — contrat d'intégration combat / moteur monde

> Dernière mise à jour : 2026-07-14 — profils continus, édition contextuelle et passerelles contraintes.
>
> But : fusionner une nouvelle version du projet combat sans modifier le dépôt de l'autre
> développeur, sans réintroduire les anciennes cartes et sans dupliquer les décisions spatiales.

## 1. Points de départ vérifiés

- branche d'intégration : `codex/world-engine-integration` ;
- première fusion combat/monde : `8276086` ;
- parent combat historique : `255736d` ;
- parent éditeur Surface historique : `75a3aec` ;
- contrat d'apparence et d'affichage v12 : `47b0563` ;
- le dépôt de l'autre développeur reste en lecture seule. Toute fusion se fait dans un worktree ou
  une branche d'intégration distincte.

Ces identifiants servent de repères, pas de branches à réécrire. Avant une nouvelle fusion, noter
les deux nouveaux commits de tête et créer un tag de sauvegarde sur l'intégration actuelle.

## 2. Autorité de chaque sous-système

| Domaine | Autorité à conserver | Ce que l'autre côté peut faire |
|---|---|---|
| Géométrie statique | `surface_data` v12 puis `shared/world/worldCompiler.js` | L'éditeur écrit le document, le combat ne le lit pas directement |
| Position/occupation | snapshot monde + état runtime PostgreSQL | Le combat demande une mesure, un plan ou une exécution |
| Déplacement | `server/src/services/worldMovementService.js` | La FSM fournit destination, acteur et budget de règles |
| Budget/allure | `server/src/services/movementBudgetService.js` | Les règles combat fournissent les allures calculées de la fiche |
| LOS/couverture | `server/src/services/worldVisibilityService.js` | Le combat consomme le résultat après la position réellement atteinte |
| Distance/proximité | `server/src/services/worldSpatialQueryService.js` | Le combat ne recalcule pas une distance depuis X/Y/Z |
| Effets de terrain | `server/src/services/worldEffectService.js` | Les règles interprètent les hooks retournés |
| Ordre des actions, dégâts, états | FSM et règles combat | Elles orchestrent les services monde sans les remplacer |
| Affichage 3D | composants client Surface/Three.js | Il prévisualise ; il n'autorise jamais un résultat de règle |
| Transformations d'entités | `shared/world/entityTransform.js` + `entities.state.transform` | UI, collision et LOS consomment la même échelle uniforme |

Règle de fusion : garder la règle métier combat la plus récente quand elle ne décide pas de la
géométrie. Dès qu'un conflit touche chemin, position atteinte, distance, portée spatiale, collision,
LOS, couverture ou effet de terrain, conserver l'appel au service monde et adapter le code combat
autour de son résultat.

## 3. Rupture volontaire `surface_data` v12

Une salle v12 ne possède que les apparences suivantes :

```text
floorTex / floorMaterial
ceilingTex / ceilingMaterial
wallInteriorTex / wallInteriorMaterial
wallAppearanceProfiles[].interiorTex / interiorMaterial
```

Sont supprimés et refusés par le validateur :

```text
floorTop* / floorBottom*
ceilingTop* / ceilingBottom*
wallFront* / wallBack* / wallExterior* / wallTop*
wallAppearanceProfiles[].exterior*
```

Il ne faut ajouter ni alias, ni fallback, ni migration de ces valeurs. Les anciennes cartes peuvent
servir de capture ou de fixture visuelle, mais ne sont pas des entrées valides du nouveau moteur.
Lors d'une fusion, tout code réintroduisant un de ces champs doit être supprimé ou réécrit contre le
contrat v12.

### Plafond et sol empilés

Le plafond d'une salle basse et le sol d'une salle haute ne sont pas deux dalles indépendantes à
rendre ensemble. `roomHorizontalInterfaces()` dérive une frontière unique à une altitude donnée :

- vue depuis le niveau bas : apparence `ceiling*` de la salle inférieure ;
- dès que le niveau haut est affiché : apparence `floor*` de la salle supérieure ;
- jamais deux surfaces coplanaires simultanées.

Le compilateur physique continue de dériver supports et barrières depuis les volumes. Aucun code de
combat ne doit reconstruire cette interface depuis les meshes.

## 4. Affichage des étages à préserver

- le niveau courant et tous les niveaux inférieurs sont rendus ;
- les niveaux inférieurs sont opaques ;
- les niveaux supérieurs sont masqués, sauf le contenu complet du `RoomVolume` multi-hauteur dans
  lequel se trouve la caméra ou, lorsque celle-ci reste dehors, que vise sa cible de contrôle ;
- seul le plafond qui ferme le niveau courant utilise l'opacité de coupe ;
- une salle multi-hauteur conserve son vide et ses murs descendants, sans plancher implicite ;
- murs, passerelles, escaliers, connecteurs, objets 3D, tokens et effets d'un volume actif restent
  visibles sur toute sa hauteur ;
- la transparence de caméra est décidée par façade complète. Toutes les tranches verticales et les
  morceaux créés par une porte partagent un `facadeId` de rendu. La salle active vient d'abord de
  la position 3D réelle de la caméra dans le volume, puis de la cible des contrôles lorsque la caméra
  est dehors. `interiorNormalSignsByRoom` indique ensuite le côté intérieur de
  chaque façade pour cette salle ; caméra du côté extérieur signifie transparent, caméra du côté
  intérieur signifie opaque. Ne pas réintroduire de rayons vers des centres de cases ;
- les bouchons internes des découpes de porte ne sont pas rendus.

La visibilité graphique d'un étage inférieur ne lui donne pas l'autorité de support de placement
dans l'éditeur courant. Ne pas confondre rendu, picking éditeur et collision runtime.

### Profils, passerelles et entités

- `wallElevationProfiles` décrit un profil unique sur la hauteur totale de la salle. Toute version
  qui redémarre la progression à chaque étage doit être rejetée ;
- une passerelle peut porter `clipRoomId`. Son mesh et son support compilé doivent tous deux employer
  `roomInteriorFootprintAtY(...)`, courbe horizontale et profil vertical compris ;
- l'échelle d'un objet libre vit dans `entity.state.transform.scale`, bornée à `0.25..4`. Le service
  de mouvement et le service de visibilité doivent la lire en même temps que le renderer ;
- les panneaux de salle, mur et objet sont des clients de ces contrats. Le nom de salle est éditable,
  l'identifiant de mur est copiable mais immuable, et une porte ne se crée que depuis le mur actif.
- la transition `select -> connector/door` conserve `selectedRoomWallKeys` et
  `connectorWallEdgeKeys`. Une fusion qui ferme le panneau ou masque la sélection à ce moment casse
  la pose de porte ;
- `roomsWallSegments(...)` doit transporter les `sourceEdgeKeys` des chemins canoniques jusque dans
  les panneaux physiques. Le picking de porte rayonne uniquement contre ces panneaux sélectionnés
  et son aperçu instancie le même modèle que le connecteur final ;
- les dalles libres et passerelles lisent les profils d'apparence `floor/ceiling`, jamais les anciens
  noms d'outil `top/bottom`.

## 5. Fichiers à fusionner selon leur rôle

### Autorité monde — ne pas remplacer par une version combat historique

- `shared/world/**`, notamment `roomGeometry.js`, `entityTransform.js` et `worldCompiler.js` ;
- `server/src/services/world*.js` et `movementBudgetService.js` ;
- migrations monde 152 à 157 et leurs variantes datées ;
- validation/persistance Surface dans `server/src/services/battlemapWorldPersistence.js` ;
- composants `Surface*`, `ReliefBoxGeometry.jsx` et `client/src/lib/surfaceData.js` ;
- documentation `MOTEUR_MONDE.md` et `SURFACES_SALLES.md`.

### Autorité combat — reprendre les règles récentes, puis rebrancher

- tables, évaluateurs et documentation de règles combat ;
- fenêtres de déclaration/résolution et ergonomie de combat ;
- calculs non spatiaux : initiative, compétences, dégâts, armure, états et actions exclusives.

### Zones de conflit à résoudre manuellement

- `server/src/socket/socketCombatAnnouncement.js` : doit appeler
  `planBattlemapTokenMovement()` ;
- `server/src/socket/socketCombatResolution.js` : doit appeler
  `executeBattlemapTokenMovement()` puis recalculer distance/LOS ;
- `server/src/socket/socketCombatHelpers.js` et `server/src/lib/losService.js` : conserver les
  adaptateurs vers les services monde ;
- `server/src/routes/battlemaps.js`, `tokens.js`, `entities.js` : conserver révisions,
  placement canonique, normalisation de `state.transform.scale` et mesures serveur ;
- `client/src/pages/SessionPage.jsx` et `client/src/components/Canvas3D.jsx` : fusionner l'UI combat
  sans supprimer les props de monde, d'étage et de destination ;
- migrations : comparer le contenu et les tables, ne jamais résoudre un conflit uniquement en
  choisissant le plus grand numéro de fichier.

## 6. Contrats d'appel pour le combat

Entrées serveur à conserver :

```javascript
planBattlemapTokenMovement({ battlemap, token, destination, authorizedBudgetM, actorProfile })
executeBattlemapTokenMovement({ battlemapId, tokenId, destination, authorizedBudgetM, actorProfile })
measureBattlemapTokenDistance({ sourceTokenId, targetTokenId, ... })
evaluateBattlemapVisibility({ battlemap, sourceToken, targetToken, sourceProfile, targetProfile })
```

Le client envoie une destination, jamais une position finale garantie. Le serveur :

1. réconcilie les ascenseurs et l'état runtime ;
2. charge le snapshot et ses révisions ;
3. planifie avec supports, connecteurs, occupants et effets ;
4. applique le budget en mètres et s'arrête au dernier point stable ;
5. persiste la position réellement atteinte ;
6. recalcule distance, portée, LOS, couverture et hooks depuis cette position.

Ne jamais réintroduire un rayon de cases côté client, un pathfinder combat parallèle, une collision
Redis ou une LOS voxel pour « dépanner » un conflit de merge.

## 7. Procédure Git recommandée

1. sauvegarder les têtes des deux projets et le schéma PostgreSQL ;
2. créer une branche/worktree depuis l'intégration monde validée ;
3. importer la tête combat avec `git merge --no-commit --no-ff` ;
4. résoudre d'abord les contrats partagés et migrations, puis le serveur, puis le client ;
5. rechercher les anciens champs et anciens moteurs avant de lancer l'application ;
6. exécuter les tests purs, le build, le lint ciblé et Playwright ;
7. tester une vraie session combat sur une carte v12 à au moins deux étages ;
8. seulement ensuite créer le commit de fusion et redémarrer les services d'intégration.

Recherches minimales après résolution :

```bash
rg "floorTop|floorBottom|ceilingTop|ceilingBottom|wallFront|wallBack|wallExterior"
rg "voxel_data|redis|pathfinder|confirmedModifiers\.portee" server/src/socket server/src/lib
rg "planBattlemapTokenMovement|executeBattlemapTokenMovement|evaluateBattlemapVisibility"
```

Une occurrence peut être légitime dans un test de rejet ou une note historique ; toute occurrence
runtime doit être justifiée.

## 8. Validation obligatoire de la fusion

Commandes de base :

```bash
npm run test:world
node --test client/src/lib/surfaceData.test.mjs
cd client && npm run build
npx eslint src/components/Sidebar.jsx src/components/SurfaceDungeonScene.jsx \
  src/components/EntityInstancePanel.jsx src/components/EntityMesh.jsx \
  src/components/SurfaceRoomPanel.jsx src/components/SurfaceWallPanel.jsx \
  src/lib/surfaceData.js src/pages/SessionPage.jsx
cd .. && ENCLUME_BASE_URL=http://127.0.0.1:8293 npx playwright test tests/e2e/smoke.spec.mjs
```

Le lint global contient actuellement du passif dans des fichiers combat. Une fusion ne doit pas
masquer un nouvel échec : comparer le résultat avant/après et exiger zéro erreur sur les fichiers
modifiés.

Scénarios manuels indispensables :

- créer une carte v12 neuve ;
- salle basse + salle empilée : plafond depuis le bas, sol depuis le haut, aucun clignotement ;
- niveau supérieur : tous les étages inférieurs opaques ;
- mur droit et arc avec porte : transparence monobloc sans bouchons visibles ;
- salle multi-hauteur : profil vertical unique et contenu complet visible sur toute la hauteur dès
  que la caméra entre dans ce volume, même si la cible reste dehors ; les façades côté caméra
  deviennent transparentes sur toute leur hauteur et celles du fond restent opaques ;
- passerelle le long d'un arc profilé : aucune dalle visible ou praticable hors de la salle ;
- objet redimensionné : même emprise au rendu, au placement/collision et en LOS après rechargement ;
- panneau de mur : identifiant copiable, halo complet, porte contrainte au mur actif ;
- fusion de salles de hauteurs différentes puis sauvegarde/rechargement ;
- Jon : budget 15 m, 3 m au sol puis 3 m d'échelle à coût ×4, arrêt intermédiaire ;
- déclaration puis résolution combat après déplacement d'un ascenseur ou changement de porte ;
- portée, LOS et couverture recalculées depuis la position réellement atteinte.

## 9. Critères de refus d'une fusion

La fusion n'est pas acceptable si elle :

- rend à nouveau valide une ancienne face d'apparence de salle ;
- fait lire `surface_data`, Three.js ou `voxel_data` directement par une règle combat ;
- laisse le client imposer une distance, un chemin ou une position finale ;
- duplique un mur, un plafond/sol empilé ou un collider ;
- répète un profil vertical par étage ou laisse une passerelle sortir de son empreinte de salle ;
- applique l'échelle d'une entité au GLB sans l'appliquer à son occupant et à son occluder ;
- perd `world_revision`, `runtime_revision` ou les UUID de features ;
- mélange l'état statique de l'éditeur avec porte, effet, passerelle ou ascenseur runtime ;
- passe le build mais échoue un des scénarios dorés monde/combat.
