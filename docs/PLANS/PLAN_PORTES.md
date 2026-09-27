# PLAN_PORTES.md — Rendu 3D des portes (connecteurs) ne reflète pas l'état runtime

> 2026-09-27 — Bilan/cadrage, **aucun code modifié**. Détaille le Lot C de
> `PLAN_ENTITES_INTERACTIVES_ROADMAP.md` (« Rendu 3D des portes (connecteurs) »), resté non démarré.
> Remplace un bilan précédent (`BILAN_PORTE`, jamais commité) qui s'était trompé de système : il
> analysait `entity_blueprints` (§5 ci-dessous) en pensant y trouver « la porte », alors que la porte
> RAW du projet est un **connecteur** (`surface_data.connectors`), déjà largement construit et
> fonctionnel. Marquage : **[VÉRIFIÉ]** = lu dans le code cette session, **[HYPOTHÈSE]** = déduit sans
> confirmation, **[INCONNU]** = ni l'un ni l'autre.

---

## 0. Responsabilité unique

Constater précisément pourquoi une porte-connecteur ne s'ouvre/ferme jamais visuellement à l'écran,
alors que son état (ouvert/fermé/verrouillé), sa collision et sa LOS sont déjà corrects côté serveur.
Ce document ne couvre que ce point (+ un bug cosmétique connexe, §4). Chaque correctif retenu aura son
propre `PLAN_XXX.md`, un bug à la fois (AGENTS.md).

---

## 1. Ce qui est déjà fait et correct — ne pas rouvrir [VÉRIFIÉ]

Autorité : `.claude/rules/world.md` § « Interaction runtime sur une porte » ; conception et historique
complets (archivés, Règle 10) : `docs/Old/PLAN_INTERACTIONS_CONNECTEURS.md` (livré et validé en
session réelle le 2026-09-02, `10cde1e`/`05129fe`).

- Une porte a 3 états (`closed`/`open`/`locked`) : autoré dans `surface_data.connectors[].state`,
  runtime dans `world_feature_states` (`feature_id = connector.worldId`).
- `doorGeometry` (`shared/world/worldCompiler.js:455-466`) lit déjà l'état runtime et applique
  collision, LOS, eau et gaz en conséquence — **la porte bloque/débloque correctement le monde dès
  aujourd'hui**, sans lien avec ce qui est cadré ici.
- Le contrat socket complet (`CONNECTOR_ACTION_REQUEST/PENDING/RESOLVE/RESULT`), l'arbitrage MJ
  (Test **Systèmes de sécurité** pour crocheter, `gmArbitratedTestService.js` partagé avec les
  entités), l'override MJ, les boutons `DoorRuntimeControls`, le calcul de portée point→segment : tout
  est codé, testé (27/27 unitaires) et validé en jeu réel.
- Un bug réel trouvé pendant la validation 2026-09-02 (panneau qui se refermait au relâchement de la
  souris) a été corrigé et documenté — non lié à ce chantier.

**Rien de ce qui précède n'est à retoucher.**

---

## 2. Le problème réel [VÉRIFIÉ]

`DoorConnectorModel` (`client/src/components/SurfaceDungeonScene.jsx:1512-1585`) — le composant qui
monte le GLB d'une porte-connecteur dans la scène — ne lit **jamais** l'état runtime : ni
`connector.state`, ni `world_feature_states`, ni aucun prop dérivé. Il clone la scène GLB, la met à
l'échelle et la positionne (`box.floorPosition`), un point final. Confirmé par une recherche complète
des occurrences de `current_state_id`/`states[`/`is_blocking` : aucune ne touche ce fichier.

C'est exactement l'écart déjà documenté dans `world.md:71-73` : *« Le GLB ne reflète pas encore l'état
ouvert/fermé — rendu 3D seul, la collision et la LOS sont correctes »* et dans l'archive
`PLAN_INTERACTIONS_CONNECTEURS.md` (bannière : *« modèle GLB statique »*, listé hors périmètre de la
tranche 2026-09-02).

`ConnectorSegment` (ligne 1588) ne reçoit d'ailleurs aucun prop d'état runtime à transmettre — il
faudrait le faire descendre depuis `SurfaceDungeonScene`/`Canvas3D` (déjà chargé dans
`worldEffects.featureStates`, utilisé par `SurfaceConnectorPanel.jsx` pour les boutons Ouvrir/Fermer,
jamais par le rendu 3D).

---

## 3. Les assets — instrumentation faite [VÉRIFIÉ]

`output/futuristic_doors/manifest.json` (8 portes, `placement_mode_default: "connector"`) déclare un
champ texte libre `opening` par asset, jamais consommé par du code — pure métadonnée descriptive.
L'inconnu de ce paragraphe (les `.glb` embarquent-ils des clips exploitables ?) a été tranché en lisant
directement le chunk JSON glTF de chacun des 8 fichiers (`output/futuristic_doors/glb/*.glb`, parseur
binaire minimal, sans dépendance) plutôt qu'en le supposant :

| Asset | `opening` (manifeste) | Clips trouvés dans le `.glb` |
|---|---|---|
| `01_standard_hatch` | manual_wheel_unlock_then_swing | **2** : `..._Manual_Wheel_Turn_Pivot`, `..._Left_Hinge_Swing` |
| `02_airlock_door` | manual_wheel_unlock_then_pressure_swing | **2** : idem (molette + vantail) |
| `03_sliding_door` | double_slide_x | **2** : `SLIDE_LEFT_PANEL_Open_X_Negative`, `SLIDE_RIGHT_PANEL_Open_X_Positive` |
| `04_glass_door` | glass_swing | **1** : `Left_Hinge_Swing` |
| `05_glass_sliding_door` | double_glass_slide_x | **2** : gauche + droite |
| `06_large_hangar_door` | large_vertical_lift_z | **1** : `LIFT_HANGAR_PANEL_Open_Z_Positive` |
| `07_large_glass_hangar_door` | large_glass_lift_z | **1** : idem |
| `08_three_part_triangular_door` | 3 pales, rotation | **3** : `LOWER_LEFT`/`LOWER_RIGHT`/`TOP_..._Rotate_Y` |

**Conclusion : les 8 assets ont déjà des clips correctement nommés et structurés — aucun rework
d'asset, aucune animation procédurale de secours nécessaire.** Chaque clip a exactement 1 canal
(un seul node animé), et **l'ensemble des clips d'un même GLB représente une seule ouverture** — pour
`01`/`02`, la molette et le vantail bougent ensemble (pas de séquence en deux temps à gérer dans le
runtime : RAW simplifie déjà l'action à `open`/`close`, §1) ; pour `03`/`05`, les deux panneaux
coulissent en miroir ; pour `08`, les trois pales tournent ensemble. **Aucun cas où deux clips du même
GLB représenteraient deux transitions différentes** (ex. un clip pour déverrouiller, un autre pour
ouvrir) — donc pas besoin de mapper individuellement des clips à des états, juste de tous les piloter
par la même progression.

Contrôleur qui en découle — généralisation directe du mécanisme entité déjà en production
(`docs/SYSTEME/ENTITES.md` §5.4 : `THREE.AnimationMixer` sur `animations[0]` uniquement, lerp d'un
`animationProgress` 0→1) : la seule différence est de créer une action et de piloter le temps pour
**chaque** clip de `gltf.animations`, pas seulement le premier. `open` → progression 1 ; `closed` et
`locked` → progression 0 (une porte verrouillée est visuellement fermée, RAW confirmé
`PLAN_INTERACTIONS_CONNECTEURS.md` §4 point 4). La question « clips vs nœuds nommés + transform
procédural » (posée dans une version précédente de ce document) est tranchée : les clips existent et
suffisent, pas besoin de l'alternative procédurale.

---

## 4. Bug du cadre de sélection — CLOS (2026-09-27) [VÉRIFIÉ]

**Signalé par Saar en jeu** (capture d'écran) : le cadre de sélection jaune d'une porte ne suit pas
l'orientation réelle de la porte — toujours la même orientation, quel que soit le mur. Root cause
vérifiée par calcul, pas devinée : `connectorDoorBox` (ligne 1348-1387, partagée par
`ConnectorSelectionOutline` et `DoorConnectorFallback`) échangeait déjà `width`/`depth` selon
`connector.axis === 'z'` **puis** appliquait `rotationY = Math.PI / 2` par-dessus — double
compensation. Pour un connecteur d'axe `'z'`, l'échange de dimensions ET la rotation de 90° annulent
mutuellement la correction : la boîte ressort systématiquement dans la forme d'un connecteur d'axe
`'x'`, quelle que soit l'orientation réelle du mur — exactement le symptôme rapporté (« toujours dans
le même sens »). `rotationY` seul porte déjà toute la correction d'orientation nécessaire (vérifié
matriciellement : une rotation de 90° échange déjà les étendues X/Z d'une boîte) — les dimensions
doivent rester dans une convention locale fixe, jamais pré-échangées.

**Correctif** : `width`/`depth` toujours assignés dans la convention locale de l'axe `'x'`
(`width = alongLength`, `depth = fallbackDepth`), sans branche spécifique à `'z'`. `rotationY`
inchangé. `DoorConnectorModel` (le rendu réel du GLB) ne lit jamais `box.args` — seulement
`box.floorPosition`/`box.rotationY`/sa propre échelle — donc l'apparence de la porte elle-même est
inchangée ; seul le cadre de sélection (et le placeholder avant chargement du GLB) est affecté.
`npx eslint`/`npm run build` propres. **Non testé en jeu** — à confirmer par Saar sur une porte posée
sur un mur d'axe Z (le cas qui était visiblement cassé).

---

## 5. Hors périmètre de ce document — système différent, actuellement inerte [VÉRIFIÉ contre la base + CONVENTIONS.md]

En explorant `entity_blueprints`/`entities` (le système d'accessoires génériques interactifs —
caisses, coffres — sur lequel portait le bilan initial avant qu'il ne soit établi que ce n'est pas la
« porte » RAW), deux bugs réels ont été trouvés dans `EntityBuilderTab.jsx` (l'onglet Entités de
l'Atelier GM, `/workshop`) — **un troisième point, initialement classé bug, ne l'est pas : voir
correction ci-dessous.**

**Correction (2026-09-27, recherche exhaustive du pattern `current_state_id`/`.states[` sur tout le
dépôt, demandée par Saar après l'analyse à charge)** : la lecture positionnelle
`states[current_state_id]` (`EntityMesh.jsx:89`, `worldMovementService.js:59-61`,
`worldVisibilityService.js:22-23`) n'est **pas un bug**. C'est une convention documentée et nommée,
que l'analyse à charge précédente aurait dû vérifier avant de conclure (AGENTS.md : *« avant de
conclure qu'aucun piège connu ne couvre un sujet : `docs/SYSTEME/CONVENTIONS.md` §19 »*, étape sautée) :
- `docs/SYSTEME/CONVENTIONS.md:98` — **PE11** : « fallback `states[0]` si `current_state_id`
  invalide ».
- `docs/ASBUILT.md:1606` — **PE7** : « `current_state_id` = index entier dans `states[]` — **jamais
  UUID** ».
- Migration d'origine (`server/src/db/migrations_archive/42_entities.js:22-24`, commentaire conservé
  intact) : *« current_state_id : index entier dans states\[\] du blueprint. Si l'index devient
  invalide suite à modification du blueprint → fallback sur states\[0\] côté client (PE11). »*

Autrement dit : `.id` sur un état n'a jamais été conçu comme un identifiant stable indépendant de sa
position — c'est un **index**, par contrat documenté depuis l'origine de la table `entities`. Les
trois lectures positionnelles sont donc conformes à l'architecture voulue, pas une lecture par id
manquante. **Rien à corriger dans `EntityMesh.jsx`, `worldMovementService.js` ou
`worldVisibilityService.js`.** Recherche exhaustive (`\.states\[` + `current_state_id` sur tout le
dépôt, pas seulement les fichiers déjà connus) : aucun autre site de lecture, positionnel ou non, n'a
été trouvé au-delà de ceux déjà cités et de l'écriture (`socketEntity.js:36`, `entities.js:154,177,227`,
elles-mêmes conformes à PE7).

Ce que ça change pour les deux bugs restants de `EntityBuilderTab.jsx` : le second (id dupliqué après
suppression+ajout d'état) reste réel, mais se reformule à la lumière de PE7 — puisque `.id` **est**
l'index par contrat, `removeState` (lignes 210-222) qui ne renumérote pas les états restants après une
suppression laisse leur `.id` **désynchronisé de leur position réelle** dans le tableau. Une
`required_state_ids`/`target_state_id` saisie par le MJ après une suppression référencerait alors le
mauvais état au moment de la lecture positionnelle (PE7/PE11 appliqués correctement, mais sur une
donnée déjà corrompue en amont par l'éditeur). Le bug est donc uniquement dans l'écriture
(`EntityBuilderTab.jsx`), jamais dans la lecture.

**Constat Saar (2026-09-27), confirmé en interrogeant `enclumeBD` directement** : l'Atelier est un
reliquat de la V1 (éditeur voxel), jamais remis à niveau, et actuellement **vide et inutilisable en
pratique** — pas seulement à vide de contenu :
- `texture_packs` : **0 ligne**. `WorkshopPage.jsx` exige de sélectionner un pack existant avant
  d'atteindre `EntityBuilderTab` (onglet d'un pack sélectionné) — sans pack, l'onglet n'est jamais
  atteignable.
- `entity_blueprints` : 78 lignes, **toutes** avec `builtin_key` renseigné (synchronisées au démarrage
  serveur depuis les manifestes `output/*/manifest.json`, `refreshBuiltinModels`) — **zéro** ligne
  `builtin_key IS NULL` (créée via l'Atelier). Aucun GM n'a jamais utilisé cet éditeur pour produire
  quoi que ce soit dans cette base. Vérifié aussi : sur ces 78, `states[].id` est contigu (`id ===
  index`) sans exception — cohérent avec PE7, jamais généré autrement que par du JSON manifeste écrit
  à la main en respectant la convention.

Les deux bugs restants sont donc dans du **code mort en pratique aujourd'hui** :

- Une interaction nouvellement créée a `required_state_ids: []` par défaut (ligne 258) — invisible
  pour toujours côté joueur (`getAvailableInteractions`, `entityInteractions.js:13-17`) tant que le MJ
  ne coche pas explicitement un état, sans aucun avertissement pour ce cas précis. L'icône ⚙
  (`EntityMesh.jsx:170,416`, `hasInteractions`) s'affiche quand même, ouvrant un menu radial vide.
- `addState` assigne `id: prev.states.length` (ligne 199) ; `removeState` (lignes 210-222) ne
  renumérote jamais les ids restants — supprimer un état puis en ajouter un nouveau peut produire deux
  états avec le même `id`, ou désynchroniser un `id` de sa position réelle (voir plus haut).

Aucun des deux ne concerne une porte-connecteur (§1-4) — à ne pas mélanger dans un même correctif
(Règle 1, `docs/RegleDocumentaire.md`).

---

## 6. Ordre retenu — deux fils, pas trois

La recherche exhaustive du §5 élimine ce qui était présenté comme le fil le moins cher (« lecture
positionnelle ») : ce n'était pas un bug, rien à planifier dessus. Il ne reste que deux fils
indépendants, tous les deux à traiter, dans cet ordre :

1. **Rendu 3D des portes-connecteurs** (§2-4) — impact observable *aujourd'hui* en jeu (aucune porte ne
   s'anime, à chaque pose). Instrumentation §3 faite : les 8 assets ont déjà les clips nécessaires,
   contrôleur bien scopé (généralisation du mixer mono-clip existant à N clips). Prêt pour un
   `PLAN_XXX.md` d'implémentation détaillé — prochaine étape distincte, pas encore écrite ici.
2. **Bugs de l'éditeur `EntityBuilderTab.jsx`** (§5) — en second, pas par négligence : une correction
   ici dépend d'une décision produit non tranchée (remettre l'Atelier en service, et sous quelle forme
   — Saar évoque une refonte pour y intégrer les entités interactives, pas juste une réactivation à
   l'identique). Corriger avant cette décision risquerait de patcher un flux voué à être reconçu — un
   coût réel contre un bénéfice nul tant que l'Atelier reste à 0 pack. Séquencement dicté par une
   dépendance produit, pas une priorité de confort.

---

## 7. Plan d'implémentation du fil 1 [CIBLE — rien codé]

Recherche faite avant de proposer une architecture (consigne Saar : documentation officielle, pas de
code inventé) : lecture complète du mécanisme mono-clip déjà en production
(`EntityMesh.jsx:176-242,325-338`, animé pour les caisses), doc officielle Three.js
(`AnimationAction`/`AnimationMixer` — le contrôle manuel de `.time` par action est la technique
documentée pour scruter une animation image par image) et code source de `useAnimations`
(`@react-three/drei`, déjà une dépendance du projet). Conclusion : **ne pas utiliser `useAnimations`**
— son `useFrame((state, delta) => mixer.update(delta))` interne (`node_modules/@react-three/drei/
core/useAnimations.js:35`) est fait pour une lecture en temps réel, pas pour du scrub manuel image par
image ; un ticket ouvert de longue date sur ce hook (`pmndrs/drei#1175`, nettoyage au démontage) ajoute
un risque évitable. Le patron mono-clip déjà validé en jeu réel (caisses/coffres) est la meilleure
base : le généraliser à N clips plutôt que réinventer.

### 7.1 Le fil de données manque encore une étape

`Canvas3D.jsx:2090` passe `runtimeFeatureStates={runtimeElevatorStates}` à `SurfaceDungeonScene`, qui
injecte `connector.runtimeState = runtimeFeatureStates[connector.worldId || id]`
(`SurfaceDungeonScene.jsx:2156`) avant de rendre `<ConnectorSegment>`. Ce point d'injection existe déjà
et est générique (peu importe le type de connecteur) — mais la donnée fournie aujourd'hui
(`runtimeElevatorStates`) est spécifique aux ascenseurs (état enrichi phase/position,
`worldElevatorService.js`), jamais aux portes. `connector.runtimeState` pour une porte est donc
toujours `null` en pratique. Il faut fusionner les deux sources avant l'injection (clés disjointes par
construction — un `worldId` de porte n'apparaît jamais dans `runtimeElevatorStates` et
inversement) : `runtimeFeatureStates={{ ...worldEffects.featureStates, ...runtimeElevatorStates }}`
à l'appel de `SurfaceDungeonScene` (`Canvas3D.jsx:2090`). `worldEffects.featureStates` est déjà chargé
côté client (utilisé par `SurfaceConnectorPanel.jsx`), aucune nouvelle requête réseau.

### 7.2 État effectif — réutiliser la formule serveur, ne pas en inventer une deuxième

`DoorConnectorModel` doit dériver son état effectif avec **exactement** la même priorité que le
serveur (`PLAN_INTERACTIONS_CONNECTEURS.md` §4 point 3, `socketConnector.js`) :
`connector.runtimeState?.state ?? connector.state ?? 'closed'`. `open` → cible d'animation 1 ;
`closed` et `locked` → cible 0 (une porte verrouillée est visuellement fermée, RAW confirmé même
document §4 point 4). Dans l'éditeur de carte (`SurfaceEditorScene.jsx`, hors session), il n'y a pas de
`world_feature_states` — la formule retombe naturellement sur `connector.state` (l'état autoré), sans
branche séparée à écrire.

### 7.3 Contrôleur multi-clips — généralisation du patron `EntityMesh.jsx`

Dans `DoorConnectorModel` (`SurfaceDungeonScene.jsx:1512-1585`) :
- `useGLTF(url)` donne déjà `animations` en plus de `scene` (comme `EntityMesh.jsx:177`) — aujourd'hui
  ignoré. Récupérer tous les clips, pas seulement `[0]`.
- Un seul `THREE.AnimationMixer` sur la scène clonée ; une action par clip (`mixer.clipAction(clip)`),
  chacune jouée puis mise en pause (`action.play(); action.paused = true`) — identique au patron
  existant.
- **Une seule valeur de progression (0→1) pilote toutes les actions du même GLB**, pas un couple
  temps/cible par clip : `action.time = progress * action.getClip().duration` pour chaque action, à
  chaque frame. Justifié par l'inspection §3 — sur les 8 assets, tous les clips d'un même GLB
  représentent une seule ouverture (jamais deux transitions différentes dans le même fichier), donc
  une progression unique suffit et garantit que les clips restent visuellement synchronisés même s'ils
  ont des durées différentes (ex. `01_standard_hatch` : molette + vantail).
- Lerp exponentiel de la progression, même formule que l'existant (`1 - Math.exp(-delta / 0.25)`,
  `EntityMesh.jsx:334`) — cohérence visuelle avec les caisses, déjà éprouvée en jeu.
- Nettoyage identique : `newMixer.stopAllAction()` au démontage/changement de scène.

**Décision assumée, pas devinée, à confirmer par Saar en jeu** : pour les portes à 2 clips
(`01`/`02`/`03`/`05`), les deux clips jouent **simultanément** (molette et vantail progressent
ensemble), pas en séquence (« tourner la molette PUIS ouvrir »). Rien dans le `.glb` ni le manifeste
ne code un ordre ou un décalage temporel entre les deux clips d'un même asset — jouer les deux en
simultané avec la même progression est le comportement le plus simple et le mieux supporté par la
technique de scrub manuel (§ recherche ci-dessus). Si le rendu réel donne une impression fausse (la
molette qui tourne alors que la porte est déjà grande ouverte), c'est un réglage cosmétique
(décalage de progression par clip), pas un changement d'architecture — à ajuster après un premier
retour visuel, jamais deviné à l'avance.

### 7.4 Fichiers touchés (exhaustif, rien d'autre)

- `client/src/components/SurfaceDungeonScene.jsx` — `DoorConnectorModel` (lecture animations + mixer
  multi-clips), `connectorAssetUrl`/`connectorDoorBox` inchangés.
- `client/src/components/Canvas3D.jsx` — fusion `worldEffects.featureStates`/`runtimeElevatorStates`
  à l'appel de `SurfaceDungeonScene` (une ligne).
- Aucune migration, aucun événement socket nouveau, aucun changement serveur — le rendu consomme une
  donnée déjà diffusée (`WORLD_RUNTIME_UPDATED { kind: 'door-state' }` rafraîchit déjà
  `worldEffects.featureStates` via `useWorldRuntimeSync.js`, sans rien à modifier ici).

### 7.5 Hors périmètre de ce lot

- Le bug cosmétique du cadre de sélection (§4) — indépendant, son propre correctif si confirmé en jeu.
- Toute portée/interaction/collision — déjà correctes et non touchées (§1).
- Le réglage fin d'un décalage temporel entre clips d'un même asset (§7.3) — différé à un retour visuel
  réel.

**Validation minimale avant de considérer ce lot fait** (proportionnée au risque, `AGENTS.md` §Clôture) :
`npx eslint` sur les 2 fichiers touchés, `npm run build` client, puis scénario réel par Saar (poser une
porte de chaque mécanisme — pivot, coulissante, triangulaire, lift — et observer l'ouverture/fermeture
en jeu, y compris dans l'éditeur de carte hors session).

### 7.6 État — CLOS, validé en jeu (2026-09-27)

Codé exactement selon §7.1-7.4 : `SurfaceDungeonScene.jsx` (`DoorConnectorModel` lit tous les clips de
`useGLTF`, mixer + une action par clip, progression 0→1 dérivée de
`connector.runtimeState?.state ?? connector.state ?? 'closed'`, lerp exponentiel identique à
`EntityMesh.jsx`) ; `Canvas3D.jsx` (`connectorRuntimeStates` = fusion mémoïsée
`worldEffects.featureStates`/`runtimeElevatorStates`, remplace l'ancien
`runtimeFeatureStates={runtimeElevatorStates}`).

**Testé** : `npx eslint` sur les 2 fichiers (0 erreur sur `SurfaceDungeonScene.jsx` ; `Canvas3D.jsx` a
14 erreurs/3 avertissements, tous pré-existants — comptage identique avant/après via `git stash`, zéro
régression introduite) ; `npm run build` client propre.

**Testé en jeu (Saar, 2026-09-27)** : « Fonctionnel sur les 8 types de portes. » Le rendu simultané des
2 clips (molette + vantail, §7.3) n'a pas été signalé comme problématique — décision assumée confirmée
par l'usage, pas de réglage de décalage à faire.

**Données** : aucune migration, aucun changement serveur.

**Fil 1 (rendu 3D des portes) CLOS.** Reste le fil 2 (§5, bugs `EntityBuilderTab.jsx`) — code mort tant
que l'Atelier reste à 0 pack, attend une décision produit distincte de Saar.
