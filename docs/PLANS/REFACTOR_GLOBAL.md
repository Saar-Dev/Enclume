# PLAN_REFACTOR_GLOBAL — Analyse de refactor du projet Enclume

> Statut : analyse initiale, aucun code touché. Rédigé 2026-08-05 (Saar).
> Méthode : mesure de taille sur tous les fichiers `.js`/`.jsx` de `client/src`, `server/src`,
> `shared` (hors migrations), puis lecture ciblée des fichiers les plus volumineux via 3 agents de
> recherche en parallèle (Sidebar.jsx / cluster world builder / reste du dépôt). Détails ligne à ligne
> non re-vérifiés personnellement par moi au-delà des tailles brutes — à confirmer avant toute
> extraction réelle (`[OBSERVÉ]` = lu par un agent, pas par moi directement).
> Règle 10 (`RegleDocumentaire.md`) : ce PLAN est temporaire. À la clôture d'un chantier de refactor,
> retirer la ligne correspondante ici et, si le résultat introduit un invariant durable, le documenter
> dans la règle domaine ou le SYSTEME concerné — jamais laisser ce fichier comme référence permanente.

> **Contre-revue à charge — passe 1 (2026-08-05, Saar)** : la version initiale de ce document a été
> écrite sans consulter `docs/SYSTEME/SERVICES_COMBAT.md`, `docs/SYSTEME/EDITEUR.md` ni
> `docs/SYSTEME/REACT.md` — une violation directe de `CLAUDE.md` §2 et de la règle `combat.md`
> ("mécanique de combat implémentée sans avoir lu les règles routées"). Résultat concret : §4
> recommandait une factorisation des branches Pj/Pnj/Drone de `socketCombatHelpers.js` qui **contredit
> un invariant documenté** (code F2, `SERVICES_COMBAT.md`). Corrigé et fusionné dans le texte source
> des sections concernées (§2, §3, §4, §6) plutôt que laissé en encart contradictoire à côté de la
> version fausse.
>
> **Contre-revue à charge — passe 2 (2026-08-05, Saar)** : vérification que "aucun test" tenait aussi
> par contenu (recherche des noms de fonctions dans les `*.test.mjs`, pas seulement par nom de
> fichier) — confirmé, et déjà logué par le projet lui-même le 2026-08-01
> (`docs/BUGIDENTIFIE.md:1117-1119`) sur les mêmes fonctions. Vérification ligne par ligne des 5
> occurrences du calcul de dégâts CaC annoncées en passe 1 (une seule avait été confirmée par lecture
> directe, les 4 autres par grep seul) — le compte tient, avec une nuance de paramètres optionnels à
> respecter dans l'extraction. Correction de la recommandation "tests de caractérisation obligatoires
> avant tout" : la pratique réellement établie sur `socketCombatHelpers.js` (`node --check` + suite
> complète + clôture Testé/Non testé manuelle) diffère de la meilleure pratique générique — imposer un
> changement de convention est une décision à discuter avec Saar, pas une règle unilatérale de ce PLAN.
>
> **Recherche GitHub (2026-08-05, suite du même jour)** : faite après coup, en lisant du code réel
> (pas des résumés) — `pascalorg/editor` (21k★, éditeur R3F actif) pour `Editor3D.jsx`,
> `ArnoldSmith86/virtualtabletop` (VTT Node.js en production) pour la question des revisions/conflits
> d'écriture. Détail et pistes actionnables en §8.1.
>
> **Note — `CharacterModal` obsolète (2026-08-05, suite du même jour)** : §2 ci-dessous liste encore
> `CharacterModal` comme l'un des 3 composants internes de `Sidebar.jsx` à extraire (table, et étapes 1
> et 3 de l'ordre conseillé). Cette analyse date d'avant le Lot 2 de `docs/PLANS/PLAN_REFACTOR_SIDEBAR.md`
> (extraction réelle, même jour) et sa clôture de la dette CHARMODAL-DEAD1 (`docs/BUGIDENTIFIE.md`) :
> `CharacterModal` était déjà mort (jamais monté, remplacé par `client/src/character/CharacterWindow.jsx`)
> et a depuis été supprimé du dépôt. §2 n'est pas réécrit ligne à ligne (mesure de taille initiale,
> conservée telle quelle par cohérence avec la méthode décrite en tête de doc) — toute reprise de ce
> PLAN doit lire `CharacterModal` comme déjà traité, hors périmètre d'une future extraction.

---

## 1. Vue d'ensemble

82 fichiers dépassent 300 lignes sur `client/src` + `server/src` (hors migrations). Les 20 plus gros :

| Rang | Fichier | Lignes | Domaine |
|---|---|---|---|
| 1 | `client/src/components/Sidebar.jsx` | 3449 | UI transversale |
| 2 | `server/src/socket/socketCombatHelpers.js` | 3047 | Combat |
| 3 | `client/src/components/SurfaceDungeonScene.jsx` | 2164 | World builder |
| 4 | `client/src/components/Editor3D.jsx` | 1978 | World builder |
| 5 | `server/src/routes/character/char-sheet.js` | 1825 | Personnage |
| 6 | `client/src/character/CharacterSheet.jsx` | 1775 | Personnage |
| 7 | `client/src/components/CombatActionWindow.jsx` | 1753 | Combat |
| 8 | `client/src/components/Canvas3D.jsx` | 1697 | Rendu 3D |
| 9 | `shared/world/roomGeometry.js` | 1577 | World (partagé) |
| 10 | `client/src/pages/SessionPage.jsx` | 1457 | Session |
| 11 | `server/src/services/creationService.js` | 1327 | Création perso |
| 12 | `client/src/components/CombatGmDeclareWindow.jsx` | 1284 | Combat |
| 13 | `client/src/components/SurfaceEditorScene.jsx` | 1272 | World builder |
| 14 | `shared/world/worldCompiler.js` | 1207 | World (partagé) |
| 15 | `client/src/components/DicePanel.jsx` | 1168 | Dés |
| 16 | `client/src/components/TradeWindow.jsx` | 1092 | Échanges |
| 17 | `server/src/routes/battlemaps.js` | 1091 | World/API |
| 18 | `client/src/components/EntityBuilderTab.jsx` | 1021 | Entités |
| 19 | `client/src/lib/surfaceRooms.js` | 990 | World (partagé) |
| 20 | `client/src/character/AdvantagesPanel.jsx` | 906 | Personnage |

(migrations exclues volontairement : leur taille est normale et ne relève pas d'un refactor)

**Constat transversal** : le mono-fichier "composant page = quasi tout le fichier" est l'anti-pattern
dominant côté client (Sidebar, CharacterSheet, CombatActionWindow, SessionPage, CombatGmDeclareWindow,
DicePanel, TradeWindow, EntityBuilderTab, AdvantagesPanel, CharacterWindow, CombatOverlay partagent le
même profil : un seul composant par défaut contient 80-95 % du fichier, avec 15 à 46 `useState`).
Aucun de ces fichiers ne porte de `TODO`/`FIXME` documentant cette dette — elle n'est nulle part dans
`docs/EN_COURS.md` non plus, à part indirectement.

---

## 2. Priorité 1 — `client/src/components/Sidebar.jsx` (3449 lignes)

Le plus gros fichier du client. Il cumule au moins **8 responsabilités indépendantes** dans un seul
fichier, dont 3 composants React internes non exportés (`CharacterModal`, `DiceBreakdownPopover`,
9 icônes SVG) :

| Bloc | Lignes approx. | Nature |
|---|---|---|
| Icônes SVG | 44-107 | Présentation pure |
| `CharacterModal` | 114-444 | Modale fiche perso (onglets, upload, notes GM) |
| `DiceBreakdownPopover` + `formatMrDegreeTitle` | 449-500 | Popover breakdown de jet |
| Palette monde/surface (blueprints connecteurs, textures, matériaux) | 503-1149, 1107-1930 | ~800 lignes, le plus gros bloc JSX |
| Effets runtime monde (`worldEffects`) | 735-789 | Fetch + listener socket dupliqué avec Editor3D.jsx |
| Barre d'outils GM (mode edit/play, layers) | 1059-1105 | UI |
| Chat + dés + déclarations combat | 946-965, 1975-2329 | Chat temps réel |
| Onglet Personnages | 2332-2411 | Formulaire + liste draggable |
| Onglet Profil | 2418-2496 | Config compte + membres connectés |
| Modale raccourcis clavier | 2501-2538 | UI |
| Objet `styles` inline | 2543-3449 | **906 lignes**, ~26 % du fichier |

**Duplication identifiée** (`[OBSERVÉ]` agent) :
- `DiceBreakdownPopover` (Sidebar.jsx:449-488) réimplémente un pattern quasi identique au popover
  d'`.ini-popover` dans `CombatActionWindow.jsx:169,661,1441-1451` — même concept, deux implémentations.
- Le fetch `/battlemaps/:id/world-effects` est appelé indépendamment dans `Sidebar.jsx:739-747` et
  `Editor3D.jsx:1242-1243,1515` — aucun store/hook partagé (`entityStore`/`mapStore` n'exposent rien
  de tel), alors que la règle `react.md` demande "Les stores contiennent l'état partagé; éviter une
  seconde copie locale divergente".

**Découpage naturel proposé** (ordre suggéré, chaque extraction est un lot indépendant) :
1. `Sidebar.styles.js` ou migration vers classes CSS `sidebar-*` (déjà en partie utilisées) —
   **pas un passage mécanique global** : `grep` compte **38 usages de `...styles.X` en spread**
   (composition base + override conditionnel, ex. un bouton actif qui étend `styles.matBtn` avec une
   couleur dynamique). Chaque site doit être audité individuellement pour distinguer la part
   réellement dynamique (→ CSS custom property, conforme à `react.md`) de la composition statique
   (→ classe). Aucun test n'existe sur `Sidebar.jsx` (confirmé — voir encart tests, §6) ; ajouter un
   test de rendu par composant extrait avant de toucher `CharacterModal`/`DiceBreakdownPopover`.
2. `SidebarIcons.jsx` — extraction triviale, seul lot réellement sans risque comportemental du groupe.
3. `CharacterModal.jsx` + `DiceBreakdownPopover.jsx` — composants déjà isolés, juste à déplacer.
4. `SidebarChatTab.jsx`, `SidebarCharactersTab.jsx`, `SidebarProfileTab.jsx`, `SidebarHelpModal.jsx`.
5. `SurfaceEditorPanel.jsx` (palette textures/connecteurs/effets) + hook `useWorldEffects(battlemapId, socket)`
   partagé avec `Editor3D.jsx` pour éliminer la duplication de fetch.

---

## 3. Priorité 2 — Cluster world builder

Contexte : `docs/Old/PLAN_REFACTOR_SURFACE.md` (archivé, Lots 1-7) a **déjà scindé** `surfaceData.js`
en façade + modules (`surfaceCore.js`, `surfaceGeometry.js`, `surfaceRooms.js`, `roomWalls.js`,
`connectors.js`, `surfaceStairs.js`, `materialDecision.js`, `surfaceUtils.js`). Ce travail ne doit pas
être refait — la dette restante est ailleurs.

| Fichier | Lignes | Verdict |
|---|---|---|
| `client/src/components/Editor3D.jsx` | 1978 | **Prioritaire** — voir détail ci-dessous |
| `client/src/components/SurfaceDungeonScene.jsx` | 2164 | God component de rendu, voir détail |
| `client/src/components/SurfaceEditorScene.jsx` | 1272 | Sain structurellement (délègue à SurfaceDungeonScene) |
| `shared/world/roomGeometry.js` | 1577 | Volumineux mais mono-responsabilité, pas urgent |
| `shared/world/worldCompiler.js` | 1207 | Propre, un seul export public, pas urgent |
| `client/src/lib/surfaceRooms.js` / `roomWalls.js` / `surfaceData.js` | 990/558/557 | Déjà refactorés (Lots 1-7) |
| `shared/world/surfaceDocument.js` / `navigation.js` | 583/594 | Responsabilité claire, pas de mélange détecté |

### `Editor3D.jsx` (1978 l.) — infrastructure d'édition centralisée par conception, pas un fourre-tout accidentel
3 composants dans un fichier (`EntityEditorScene` 229-777, `EditorScene` 777-1156, `Editor3D`
1156-1978), 19 `useState`, 42 `useEffect`, 26 `useCallback`. `docs/SYSTEME/EDITEUR.md` (2026-08-02)
documente explicitement ce fichier comme un composant **délibérément centralisateur** : *"Editor3D ne
décrit pas lui-même le comportement des outils ; il fournit l'infrastructure partagée : sauvegarde,
undo/redo, chargement des textures, effets runtime, panneaux flottants."* Le comportement des outils
est déjà séparé dans `SurfaceEditorScene`/`EntityEditorScene`/`EditorScene` — donc "réseau + UI + rendu
mélangés" est une lecture trop vague de la dette réelle. La vraie violation SRP est **5 responsabilités
d'infrastructure distinctes cumulées dans un seul fichier**, chacune déjà délimitée par une section du
document : §4 sauvegarde (files d'attente + révisions), §5 undo/redo, §6 chargement textures, §7 effets
runtime/ascenseurs, §8 panneaux flottants — dont les appels réseau/socket directs
(`api.post/put/delete`, `socket.emit(WS.ENTITY_*)`, `socket.emit(WS.VOXEL_*)`, 605-1067 ;
`socket.on(WS.WORLD_RUNTIME_UPDATED)`, 1284) qui relèvent de §4/§7.

Découpage suggéré : suivre les frontières déjà actées par l'équipe dans `EDITEUR.md`, pas des noms de
hooks inventés — `useEditorAutoSaveQueue`, `useEditorUndoRedo`, `useEditorTextureLoading`,
`useEditorRuntimeEffects`, `useEditorFloatingPanels`, fichiers séparés pour
`EntityEditorScene`/`EditorScene`. Si ce refactor est fait, `EDITEUR.md` doit être mis à jour dans le
même commit (Règle 2 documentaire — sinon le doc devient une fiction qui ne décrit plus le code réel).

### `SurfaceDungeonScene.jsx` (2164 l.) — pas de duplication éditeur/jeu, mais god component
Bonne nouvelle : `SurfaceEditorScene.jsx` **rend** `SurfaceDungeonScene` plutôt que de recalculer sa
propre géométrie — pas de copier-coller entre édition et jeu. En revanche `SurfaceDungeonScene.jsx`
concentre ~50 fonctions internes non exportées : caches de textures (`WeakMap`/`Map`, 51-54), UV,
géométrie de murs courbes (`makeCurvedWallGeometry`, 948-1055), découpe de portes
(`splitWallForDoorConnector`, 1231), animation d'ascenseur (`AnimatedElevatorCabin`, 1434).
`SurfaceEditorScene.jsx` a ses propres previews (`WallPreview`/`StairPreview`/`ConnectorPreview`) qui
recalculent des formes similaires côté aperçu — **duplication partielle** à vérifier de près avant
extraction.

Découpage suggéré : extraire matériaux procéduraux/textures et génération de murs courbes vers un
module partagé entre `SurfaceDungeonScene.jsx` et les previews de `SurfaceEditorScene.jsx`.

`roomGeometry.js`, `worldCompiler.js`, `surfaceDocument.js`, `navigation.js` : **pas de refactor
urgent** — volumineux mais mono-responsabilité, aucune violation de l'autorité `WorldSnapshot`
détectée (le compilateur délègue bien à `roomGeometry.js`, pas de recalcul géométrique local ailleurs).

---

## 4. Priorité 3 — Autres fichiers volumineux

### `server/src/socket/socketCombatHelpers.js` (3047 l.) — le plus gros fichier serveur
Orchestration FSM combat mélangée avec le calcul complet des règles métier (situationnels, dés,
blessures) inline plutôt que délégué. Fonctions énormes : `resolveMeleeAction` 458 l. (1234-1691),
`resolveAssaultAction` 426 l. (2442-2867), `resolveDroneAssaultAction` 323 l. (2092-2414),
`confirmDamage` 247 l. (772-1018), `confirmMeleeDefense` 222 l. (550-771).

Point positif : `checkCombatLOS` et `measureBattlemapTokenDistance` sont bien délégués à
`losService`/`worldSpatialQueryService` — **aucune violation de l'autorité spatiale** détectée
(conforme à `combat.md`).

**Ne pas factoriser `resolveMeleeDefensePnj`/`Drone`/`Pj` (1761/1885/1925) ni
`resolveAssaultHitPj`/`Pnj`/`Drone` (2868/2935/2955) en table de dispatch.** `docs/SYSTEME/SERVICES_COMBAT.md`
§8 documente explicitement, code **F2** : *"`resolveDroneAssaultAction` a 3 branches distinctes (drone
cible, PNJ cible, PJ cible). **Ne pas uniformiser.**"* Lecture directe du code confirme que ce ne sont
pas trois copier-coller accidentels : PJ diffère un jet de défense au joueur (insertion
`combat_pending`, résolu plus tard par `confirmMeleeDefense`), PNJ résout tout de suite un jet de
défense complet côté serveur, Drone n'a **aucun jet de défense** (RAW §7.4 : sans programme esquive,
test simple encaissé). Fusionner ces trois flux coderait une règle absente du Livre de Base — violation
de la priorité absolue n°9 de `CLAUDE.md`.

La duplication réelle, plus étroite et sans risque RAW, est le calcul brut de dégâts
(`damageService.getEffectiveMeleeDamage` → `getMrModifier(...)` →
`degautsBruts = rawDice + modDomAttaque + (modDom ?? 0) + combatModeBonus`), répété **5 fois**
(lignes 708-714, 826-834, 1708-1713, 1843-1848, 1901-1909 — les 5 relues intégralement, pas seulement
par `grep`). Nuance à respecter dans l'extraction : le site 826-834 (`confirmDamage`, chemin PJ différé)
omet volontairement `naturalWeaponCharMutationId`/`charSheetId` — *"formule mutation déjà résolue et
stable, seule l'arme équipée est re-fetchée"* — donc un futur `computeMeleeRawDamage(ctx, mr)` doit
accepter ces deux paramètres en optionnels, pas les rendre obligatoires partout.

**Prérequis avant d'y toucher.** Zéro test dédié n'existe pour ce fichier — et ce n'est pas une
découverte : `docs/BUGIDENTIFIE.md:1117-1119` l'a déjà noté le 2026-08-01, sur ces mêmes fonctions
(*"aucun test dédié à `resolveMeleeAction`/`resolveMeleeDefensePj` n'existe dans le dépôt, confirmé par
recherche"*). La pratique réellement établie sur ce fichier, documentée à plusieurs reprises dans
`BUGIDENTIFIE.md`, n'est pas "tests unitaires avant modification" mais `node --check` (syntaxe) +
suite serveur complète `node --test` verte (régression) + clôture explicite
**Testé/Non testé** avec validation manuelle par Saar en jeu. Imposer des tests de caractérisation
avant toute extraction serait un changement de convention pour ce fichier précis — légitime vu que le
gap "aucun test dédié" revient dans plusieurs entrées de `BUGIDENTIFIE.md` sans jamais être comblé,
mais c'est une décision à discuter avec Saar, pas à imposer silencieusement dans ce PLAN.

**Meilleure porte d'entrée que "refactor proactif"** : `docs/EN_COURS.md` liste déjà **COM27** —
*"CaC multi-attaque : jet de défense semble se lancer avant le jet d'attaque (signalé Saar, non
instrumenté)"*. Si ce bug est confirmé dans `resolveMeleeAction`/`resolveMeleeDefensePj` (zone exacte
de ce fichier), c'est l'occasion d'y toucher avec une cause racine réelle à corriger — conforme à la
boussole ("si un bug peut être l'occasion d'un refactor, on en profite") — plutôt qu'un refactor
spéculatif sans symptôme.

### `server/src/routes/character/char-sheet.js` (1825 l.)
27 routes, bonne granularité par route, mais **114 appels `db(...)` directs** malgré des services déjà
importés (advantageService, mutationService, charSheetService, inventoryService). Incohérence :
certaines routes délèguent entièrement, d'autres font du SQL inline (`/skills/buy`, 131 l., 528-658,
mélange validation + calcul de coût + écriture DB).

Découpage suggéré : `characterSheetMutationService.js` pour aligner les routes attributes/skills/xp/wounds
sur le pattern déjà utilisé par advantages/mutations dans le même fichier.

### `client/src/character/CharacterSheet.jsx` (1775 l.)
Composant par défaut de 1052 l. (199-1320), 46 `useState`, seulement 5 `useEffect` — état très
fragmenté. `SecondaryListRow` (1321-1775, 455 l.) est anormalement long pour une ligne de tableau.
`calcSecondary`/`buildSecondaryTooltips` (100-198) dupliquent potentiellement des calculs déjà présents
côté serveur (`charStats.js`) — **à vérifier avant tout refactor** (source d'autorité unique, règle
`react.md` "Le client prévisualise une intention mais n'est pas autoritaire").

Découpage suggéré : hook `useCharacterSheetData` (fetch + mutations) + scission par section (identité,
attributs, compétences, XP).

### `client/src/components/CombatActionWindow.jsx` (1753 l.)
Le composant React le plus monolithique du dépôt : 1676 l. dans un seul composant (78-1753), 26
`useState`, 9 `useEffect`, une seule extraction faite (`StateSelector`, 37-77). Risque de logique
dupliquée entre branches CaC/Tir/Assaut/Défense au sein du même render.

Découpage suggéré : sous-composants par mode d'action + hook `useCombatActionState` pour l'état
transverse (cible, arme, modificateurs).

### `client/src/components/Canvas3D.jsx` (1697 l.)
Mieux structuré que la moyenne (sous-composants `TokenRing`, `TokenGlbBody`, `ThirdPersonCamera`
déjà extraits), mais `Scene` (939 l., 460-1398) reste énorme et mélange caméra, drag & drop de
tokens, sélection et rendu. Raycaster utilisé pour du picking d'interaction UI uniquement — pas de
recalcul LOS/collision, pas de violation détectée.

Découpage suggéré : `useTokenDragDrop`, `useSceneSelection` en hooks séparés du JSX de rendu.

### `client/src/pages/SessionPage.jsx` (1457 l.)
`SessionContent` fait 1384 l. (75-1457), 31 `useState`. **TODO explicite ligne 476** :
`// TODO chantier /sc : résoudre le character actif du joueur` — dette déjà documentée dans le code
mais absente d'`EN_COURS.md`, à vérifier.

Découpage suggéré : hook `useSessionPanelsState` par domaine, pousser l'état spécifique dans les
composants enfants qui gèrent déjà en partie leur propre état (CombatOverlay, DicePanel, TradeWindow).

### `server/src/services/creationService.js` (1327 l.)
`reconcileCreation` fait 691 l. — la fonction la plus longue relevée côté serveur — alors que
`getStep1State`…`getStep5State` sont déjà séparés ailleurs dans le même fichier : incohérence de
granularité, découpage par étape possible en miroir de l'existant.

### Survol rapide (dette de même profil, pas de détail ligne par ligne)
`CombatGmDeclareWindow.jsx` (1284 l., composant 1211 l.), `DicePanel.jsx` (1168 l., 937 l.),
`TradeWindow.jsx` (1092 l., 1076 l.), `EntityBuilderTab.jsx` (1021 l., 935 l.),
`AdvantagesPanel.jsx` (906 l., 854 l.), `CharacterWindow.jsx` (864 l., 796 l.),
`CombatOverlay.jsx` (854 l., 835 l.) : même anti-pattern "composant unique = quasi tout le fichier",
6 à 37 `useState` chacun, aucun `TODO`/`FIXME`. `CombatOverlay.jsx` ne recalcule pas distance/LOS
localement (mentions en commentaires JSX seulement) — bonne délégation au serveur.

---

## 5. Fichiers cités en référence positive (ne pas toucher, exemples à suivre)

- `server/src/socket/socketEntity.js` (781 l.) — délègue correctement à `worldSpatialQueryService`,
  `worldForcedMovementService`, `worldRuntimeService`. Bon contre-exemple face à
  `socketCombatHelpers.js` pour montrer que le respect de "toute décision spatiale passe par world*"
  est atteignable dans ce dépôt.
- `client/src/lib/proceduralMaterials.js` (743 l.) — fonctions courtes (max 69 l.), le mieux factorisé
  du lot analysé.
- `shared/world/worldCompiler.js`, `shared/world/navigation.js`, `shared/world/surfaceDocument.js` —
  responsabilité unique claire malgré la taille pour le premier.
- `server/src/routes/battlemaps.js` (1091 l., 26 routes) — long par nombre de routes, pas par taille
  de fonction (98 l. max) : pas un refactor prioritaire malgré le classement en taille brute.

---

## 6. Recommandation de séquençage

La version initiale ordonnait ces chantiers par facilité d'exécution ("le plus mécanique d'abord") —
un critère de *vitesse*, explicitement écarté par la boussole du 2026-08-05. Le critère retenu ici est
**risque × valeur**, avec un constat transversal : **aucun des 6 fichiers prioritaires listés ici n'a
de test dédié aujourd'hui** (vérifié par nom de fichier ET par contenu — recherche des noms de
fonctions dans tous les `*.test.mjs` du dépôt, zéro résultat). Ce n'est pas un dépôt sans culture de
test : 80 fichiers `*.test.mjs` existent, lancés via `node --test` (convention confirmée par
`docs/ASBUILT.md`/`docs/BUGIDENTIFIE.md`, pas de script `npm test` dans `package.json`). Le gap est
spécifique à ces gros fichiers d'orchestration — probablement parce qu'un handler WS/DB complet est
plus dur à tester unitairement qu'un service pur, ce que confirme `combatAttackRoll.js` (le noyau pur
utilisé par `socketCombatHelpers.js`) qui, lui, est testé (`combatAttackRoll.test.mjs`, 10 cas).

Le contrat (`CLAUDE.md` §6.8 : "Un plan ne couvre qu'un seul bug ou problème à la fois") s'applique —
**chaque ligne ci-dessous est un chantier séparé, à valider indépendamment**, pas un lot groupé. Le
mode de validation (tests de caractérisation vs. pratique établie `node --check` + suite complète +
clôture Testé/Non testé manuelle) est une décision à prendre avec Saar au moment de chaque lot, pas
une règle unilatérale de ce document (voir précision dans la section `socketCombatHelpers.js` ci-dessus) :

1. `socketCombatHelpers.js` — **pas en refactor proactif** : investiguer d'abord **COM27**
   (`docs/EN_COURS.md`, jet de défense qui semble se lancer avant le jet d'attaque). Si la cause
   racine touche ce fichier, la corriger est l'occasion d'extraire le fragment `computeMeleeRawDamage`
   dupliqué (5 occurrences identifiées, avec la nuance de paramètres optionnels notée plus haut) —
   jamais les branches Pj/Pnj/Drone (interdit par F2, `SERVICES_COMBAT.md`). C'est le fichier au
   risque le plus élevé (autorité serveur combat) : il justifie de passer en premier *par le risque*,
   pas par la facilité.
2. `Editor3D.jsx` — extraction des 5 hooks d'infrastructure documentés par `EDITEUR.md` (autosave,
   undo/redo, textures, effets runtime, panneaux), avec mise à jour du document dans le même commit.
3. `Sidebar.jsx` — audit site par site des 38 compositions de style avant migration CSS, puis
   extraction des composants déjà isolés (`CharacterModal`, `DiceBreakdownPopover`) avec un test de
   rendu par composant extrait.
4. `Sidebar.jsx` / `Editor3D.jsx` — hook `useWorldEffects` partagé pour supprimer la duplication de
   fetch `world-effects` (dépend du lot 2).
5. Le reste (CharacterSheet, CombatActionWindow, SessionPage, char-sheet.js, creationService.js) —
   même constat d'absence de tests dédiés à traiter au cas par cas, à séquencer un par un à la
   demande ; pas de blocage fonctionnel identifié aujourd'hui qui imposerait un ordre entre eux.

---

## 7. Limites de cette analyse

- Lecture faite par 3 agents de recherche en parallèle (lecture seule) pour la version initiale, avec
  vérification ciblée par moi ensuite (grep dégâts CaC, grep spread styles, lecture directe des
  fonctions Pj/Pnj/Drone, lecture des 3 docs SYSTEME manqués) — mais pas une relecture exhaustive
  ligne à ligne des 6 fichiers prioritaires. Les numéros de ligne cités peuvent avoir dérivé si le
  fichier a bougé depuis.
- Analyse limitée aux fichiers `.js`/`.jsx` de `client/src`, `server/src`, `shared` — CSS, migrations,
  tests et documentation exclus du périmètre de comptage (mais la doc a été utilisée pour corriger
  les recommandations, voir contre-revue).
- Aucune mesure de complexité cyclomatique — le classement repose sur la taille en lignes et une
  lecture qualitative, pas un outil d'analyse statique dédié.
- Ne préjuge pas de la priorité produit : ce document liste une dette technique, pas un ordre
  d'exécution imposé — `docs/EN_COURS.md` reste l'autorité pour ce qui est réellement engagé.
- La contre-revue (bannière en tête de document, deux passes) a corrigé une erreur de fond sur
  `socketCombatHelpers.js` et une imprécision sur `Sidebar.jsx`/`Editor3D.jsx`, mais n'a vérifié en
  profondeur que les fichiers déjà cités par la première passe. D'autres fichiers du tableau §1
  (ex. `char-sheet.js`, `creationService.js`, `CombatOverlay.jsx`) n'ont reçu aucune passe de
  vérification contre la documentation SYSTEME — même prudence à appliquer avant d'agir dessus : lire
  `docs/SYSTEME/*.md` pertinent avant de proposer un découpage, pas seulement le code.
- La recherche externe GitHub a été faite en deuxième passe (§8.1) mais reste limitée à 2 dépôts lus
  en profondeur (1 fichier par dépôt) — un troisième axe (moteur de combat serveur-autoritaire en
  Node.js comparable à `socketCombatHelpers.js`) n'a pas trouvé de dépôt suffisamment proche pour
  justifier une lecture de code (les résultats trouvés étaient soit génériques, soit dans un autre
  langage).

---

## 8. Sources consultées (contre-revue) et recherche GitHub (2026-08-05, suite)

### 8.1 Dépôts open-source lus (code réel, pas juste des articles)

**[pascalorg/editor](https://github.com/pascalorg/editor)** — 21 111★, poussé le jour même, éditeur 3D
architectural en React Three Fiber. Cas structurellement le plus proche d'`Editor3D.jsx` trouvé :
undo/redo, sauvegarde, sélection, panneaux flottants pour une scène 3D éditable. Fichier lu en entier :
[`packages/core/src/store/history-control.ts`](https://github.com/pascalorg/editor/blob/main/packages/core/src/store/history-control.ts).

Différence architecturale actionnable pour l'extraction `useEditorUndoRedo` proposée en §3 :
Enclume garde l'historique dans des **refs de composant** (`surfaceUndoStackRef`/`surfaceRedoStackRef`,
clones profonds manuels, `EDITEUR.md` §5) — l'historique meurt et renaît avec le montage d'`Editor3D`.
pascalorg/editor met l'historique **dans le store** (Zustand + middleware `zundo`/temporal), ce qui le
rend testable indépendamment du rendu (d'où les fichiers `.test.ts` colocalisés à chaque hook du
dossier `store/` — aucun équivalent client-side n'existe dans Enclume aujourd'hui, seul le serveur a
cette discipline de colocation). Deux idées directement réutilisables, indépendamment du choix
zustand-vs-refs :
- **Batching transactionnel** (`beginSceneCommitTransaction`/`endSceneCommitTransaction`) : plusieurs
  mutations internes à une seule action utilisateur ne poussent qu'**une** entrée d'historique. À
  vérifier si `Editor3D.jsx` a ce comportement ou pousse une entrée par mutation élémentaire (non
  vérifié dans cette passe).
- **Égalité sémantique avant commit** (`areSceneSnapshotsEqual`) : un no-op ne pousse ni historique ni
  `isDirty`. Directement applicable aux flags `isDirty`/`isSurfaceDirty` d'`EDITEUR.md` §4.3, qui
  déclenchent aujourd'hui l'auto-save toutes les 60s sans garantie explicite de ce filtre.

Ce n'est **pas une recommandation de migrer vers Zustand/zundo dans ce PLAN** — un tel changement
change l'architecture state React du projet, décision produit à discuter avec Saar, pas une conclusion
silencieuse d'une recherche GitHub. C'est un point de comparaison qui confirme où se trouve
l'amélioration réelle (transaction + égalité sémantique), indépendamment de l'implémentation choisie.

**[ArnoldSmith86/virtualtabletop](https://github.com/ArnoldSmith86/virtualtabletop)** — 294★, actif
(poussé aujourd'hui), VTT Node.js en production réelle. Fichier lu :
[`server/room.mjs`](https://github.com/ArnoldSmith86/virtualtabletop/blob/main/server/room.mjs).
Utilise un compteur `deltaID` monotone par room, envoyé aux clients pour détecter un état obsolète —
**confirme, plutôt que ne corrige, l'architecture Enclume existante** : `voxel_revision`/
`surface_revision` (`EDITEUR.md` §4.2, comparés à `battlemapRef.current.*_revision` avant d'écraser)
suivent exactement le même principe. Rien à changer ici ; c'est une validation externe indépendante
d'un choix déjà fait.

**[Alva2084/Tactical-Grid-Combat-Simulator](https://github.com/Alva2084/Tactical-Grid-Combat-Simulator)**
(Java) — README uniquement (pas de lecture de code, langage non transférable ligne à ligne). Confirme
que Strategy/State/Command par type d'unité est le patron reconnu pour du combat tactique — corrobore
*a posteriori*, depuis l'extérieur, que le refus d'uniformiser Pj/Pnj/Drone (F2,
`docs/SYSTEME/SERVICES_COMBAT.md`) est le bon choix architectural, pas une dette. Autorité réelle sur
ce point : le document interne, pas cette source externe (priorité n°1 `CLAUDE.md`).

### 8.2 Sources secondaires (vocabulaire, pas de poids décisionnel)

- [How to Refactor Legacy Code — Augment Code](https://www.augmentcode.com/learn/how-to-refactor-legacy-code)
- [Refactoring Legacy Code with the Strangler Fig Pattern — Shopify Engineering](https://shopify.engineering/refactoring-legacy-code-strangler-fig-pattern)
- [The Strangler Fig Pattern: Escape Legacy Hell Without the Big-Bang Rewrite — notna.tech](https://notna.tech/blog/strangler-fig-pattern-guide/)
- [React Three Fiber — Introduction (pmndrs docs)](https://r3f.docs.pmnd.rs/getting-started/introduction)

Ces sources confirment un vocabulaire déjà connu (characterization tests, Strangler Fig) mais n'ont
pesé sur aucune correction concrète — contrairement aux deux dépôts lus en §8.1, qui ont produit deux
pistes actionnables concrètes (batching transactionnel, égalité sémantique avant dirty/commit).

Sources internes faisant autorité (priorité sur toute source externe, `CLAUDE.md` priorité n°1) :
`docs/SYSTEME/SERVICES_COMBAT.md` (§8 code F2), `docs/SYSTEME/EDITEUR.md`, `docs/SYSTEME/REACT.md`,
`docs/BUGIDENTIFIE.md:1117-1119`.
