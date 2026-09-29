# PLAN_EDITEUR_CARTE.md — Roadmap de l'éditeur de carte (l'outil, pas les mécaniques de jeu qui le consomment)

> Créé 2026-09-26, réécrit en profondeur le 2026-09-27, **recentré le 2026-09-27** (Saar : « reste focus sur
> l'éditeur, uniquement l'éditeur — c'est déjà un énorme chantier »). Ce document a un temps porté aussi l'export de
> carte, la purge du voxel et les zones dangereuses : ils ont chacun leur propre document et leur propre agent, ce
> document ne les recopie plus (Règle 2, une information = un endroit). Voir §0 pour le tracé exact du périmètre.
>
> **Document d'orchestration, pas un plan de lot** : il fixe l'ordre, les dépendances et le statut de chaque phase de
> l'éditeur, et renvoie vers les documents qui portent le détail. Temporaire (Règle 10) : à archiver quand toutes les
> phases listées ici sont closes.
>
> **Mode de travail** : une session orchestratrice (celle-ci, « META EDITEUR ») qui planifie, anticipe et tient ce
> document à jour ; une ou plusieurs sessions d'implémentation par phase en cours de code.
>
> Autorité : `docs/SYSTEME/EDITEUR.md`, `docs/SYSTEME/SURFACES_SALLES.md`, `docs/SYSTEME/MOTEUR_MONDE.md`,
> `.claude/rules/world.md`.

## 0. Périmètre — l'éditeur, rien d'autre

**Est l'éditeur** : l'outil que le MJ utilise pour construire une carte — forme des salles, panneaux et ergonomie de
saisie, matériaux de surface, décorations murales, apparence des connecteurs (portes, ascenseurs) posés dans l'outil.
Les fichiers concernés : `Editor3D.jsx`, `SurfaceEditorScene.jsx`, `SurfaceEditorPanel.jsx`, `SurfaceRoomPanel.jsx`,
`SurfaceWallPanel.jsx`, `SurfaceConnectorPanel.jsx`, `SurfaceMaterialEditor.jsx`, `proceduralMaterials.js`,
`client/src/lib/floatingPanel.js`, `client/src/lib/surfaceRooms.js`, `shared/world/roomGeometry.js`.

**N'est pas l'éditeur, chacun son document, pas recopié ici** :
- **Export/import de carte** — `PLAN_EXPORT_CARTE.md` (segment S0, en pause, pas urgent).
- **Purge du voxel** — `PLAN_PURGE_VOXEL.md` (stub, garde-fous stricts).
- **Zones dangereuses** (résolution en jeu : feu, gaz, dégâts, propagation) — `PLAN_ZONES_DANGER.md`, chantier séparé,
  sa propre session (`enclume-51`). Seul son écran de pose de zone (un panneau *dans* l'éditeur) touche l'infrastructure
  d'ici (voir §6, point sur `floatingPanel.js`) — l'éditeur en est un **fournisseur d'infrastructure**, pas le
  propriétaire de ce chantier.
- **Pathfinding/collision des portes en combat** — bug `03_sliding_door`, moteur monde, `PLAN_PORTES.md` §9. Le rendu
  visuel de la porte **dans l'éditeur**, lui, est bien de ce périmètre (phase 5, ci-dessous) et déjà clos.
- **Chantiers voisins sans code ici** (référencés une fois, pas suivis) : `PLAN_ADMIN_BACKUP.md` (sauvegarde de toute
  l'instance), `PLAN_KIWI_BASCULE.md`, `PLAN_GRENADES.md`, `PLAN_ENVIRONNEMENT_MILIEUX.md` (touchera un jour le
  panneau Salle, à re-signaler alors), `PLAN_BATTLEMAP2D.md` (cartes 2D, zone d'interface distincte), `PLAN_ENTITES_
  INTERACTIVES_ROADMAP.md` (portes, déjà clos, cohérent avec `PLAN_PORTES.md`).

## 1. Roadmap réelle — dans l'ordre

### Phase 1 — Forme des salles (`PLAN_WORLD_BUILDER_REWORK.md`) — EN COURS

- **1a. Cadrage** — **FAIT (Saar, 2026-09-27)**. Preuve empirique : le moteur supporte déjà L/T/U/trous/îlots/
  multi-niveau via `room.cells`, sans code. Scope retenu : **Tier A** — cases rectilignes, toujours 90°, jamais
  d'arête à angle libre (le moteur combat ne gère pas des cellules fragmentées par un mur en diagonale). Conséquence
  directe : `cells` reste le modèle de données, **aucune migration de `surface_data` à prévoir**.
- **1b. Plan A — UI/UX générale** — **FAIT et validé en jeu** (`165be2b`) : sidebar en 3 écrans (Structure / Objets 3D
  / Zones dangereuses), bouton « Porte » direct, caméra clavier réparée dans Structure/Zones dangereuses, position des
  fenêtres flottantes et sections accordéon mémorisées par type de panneau, brouillard corrigé, section Identité
  allégée.
- **1c. Plan B — le geste de modification de forme** — **CODÉ ET VALIDÉ EN JEU par Saar (2026-09-28)**, mais pas dans
  la forme prévue par ce document : la maquette Artifact (poignée sur un tronçon de mur, façon Sims) a été abandonnée
  en cours de route après deux échecs de test en navigateur — détail complet, y compris la cause racine des échecs et
  la recherche qui a mené au changement d'approche, dans `PLAN_WORLD_BUILDER_REWORK.md` §8. Retenu à la place :
  peindre/effacer directement les cases de l'empreinte de la salle (une salle sélectionnée, clic/glisser sur les
  cases), qui élimine par construction le risque d'identité d'arête noté au point 1 du §4 (rien ne « glisse », aucun
  mur ne change de position). Saar a explicitement choisi de coder Plan B avant la Phase 2 (axe 2, §2) plutôt que
  d'attendre le refactor.
  Reste ouvert : l'outil de peinture de matériau sur les murs (Lot A, livré avant Plan B) a été testé par Saar et jugé
  non fonctionnel/pas compris. Deux correctifs réactifs tentés dans la foulée (sans plan, sans analyse à charge)
  jugés par Saar comme du bricolage et annulés (2026-09-28). Repris avec un vrai passage UI/UX (recherche pro :
  Substance Painter, Blender, Les Sims) puis analyse de code, présentés et validés par Saar avant code — **Option 2
  retenue : cet outil n'offre plus AUCUNE texture pré-faite, uniquement le matériau procédural**, ce qui supprime la
  cause racine trouvée (une texture choisie ailleurs écrasait silencieusement tout réglage procédural).
  `paintRoomWallEdges`/`paintRoomWallRoom` (`surfaceRooms.js`) ne considèrent plus jamais `textureId`, quoi que porte
  l'outil ; `SurfaceEditorPanel.jsx` réutilise le composant partagé `SurfaceMaterialEditor.jsx` (déjà utilisé par les
  panneaux flottants Salle/Mur) au lieu d'en recopier les champs. Puis deux bugs de plus corrigés par cause racine
  (portée « case » bloquée sur une seule case ; murs mitoyens qui se peignaient en double ou refusaient de changer,
  `roomWalls.js`) — détail complet `PLAN_WORLD_BUILDER_REWORK.md` §8.
  **EN PAUSE (Saar, 2026-09-29)** : après ce 3ᵉ cycle de correctifs, Saar constate l'échec de la méthode de
  correctifs itératifs sur cet outil précis (« Cette méthode ne FONCTIONNE PAS ») et interdit toute nouvelle
  correction avant un vrai cadrage UI/UX — ses constatations complètes (flux de sélection de salle peu intuitif,
  duplication d'interface avec le panneau APPARENCE existant, changement de couleur qui écrase des murs déjà
  peints, murs non identifiés qui refusent toute modification, superposition visuelle en mode case) sont
  consignées telles quelles, non diagnostiquées, dans `PLAN_WORLD_BUILDER_REWORK.md` §9. Ne pas reprendre par
  correctif ponctuel.

### Phase 2 — Dette d'infrastructure de l'éditeur (`PLAN_RW_MATERIAUX.md` Lot 0) — À FAIRE, reporté après Plan B

- **2a. Refactor `Editor3D.jsx` (1580 lignes) / `SurfaceEditorScene.jsx` (1479 lignes, en hausse)** en hooks et
  composants spécialisés (plan déjà détaillé depuis 2026-08-02, jamais rejoué). Sans risque par construction (critère
  de succès = comportement et tests inchangés). **Décision de Saar (2026-09-28) : reporté après Plan B**, une fois
  qu'on sait réellement de quoi l'éditeur a besoin, plutôt que de refactorer à l'aveugle avant — Plan B a été codé
  directement dans le monolithe (voir 1c). La dette est donc plus grosse qu'avant, pas résolue, juste consciemment
  reportée.
- **2b. Dette de duplication trouvée en route** : `SurfaceEditorPanel.jsx` (mode Salle) réimplémente à la main les 6
  champs de matériau déjà factorisés dans `SurfaceMaterialEditor.jsx` — à corriger, indépendant du reste, bas risque.

### Phase 3 — Matériaux de surface (`PLAN_RW_MATERIAUX.md` R1→R4) — EN COURS, non urgent

- **R1 — FAIT et validé** (`8962c8c`) : 4 matières (inox, alu, titane, anticorrosion) + 11 motifs, carte de rugosité
  par pixel, bandes de rugosité bornées par matériau.
- **Reste, non urgent, indépendant de tout le reste** : bruit de Voronoi/cellulaire (l'actuel est « blobby »,
  affecte aussi les matériaux plus anciens), matières « coût modéré » (caoutchouc, céramique, cuivre-patine, époxy),
  matières nécessitant transparence (verre, mousse, béton fissuré) — ce dernier groupe attend un support de
  transparence que le moteur n'a pas encore.

### Phase 4 — Décorations murales (`PLAN_DECALS.md`) — bloqué en partie, une étape possible dès maintenant

- **4a. Étude du modèle existant** — son plan liste 5 documents/fichiers à lire avant de spécifier (schéma
  `surface_data`, validateur serveur, génération des murs, système de matériaux — celui-ci vient d'être documenté en
  détail dans `PLAN_PURGE_VOXEL.md` §6 —, catalogue d'assets). **Peut commencer maintenant**, en parallèle, sans
  attendre la Phase 1c : c'est de la lecture, pas du code.
- **4b. Spécification et code** — attend que Plan B (1c) fixe la façon dont l'identité d'un mur/d'une arête survit à
  une modification de forme : l'ancrage d'une décoration murale (`stabilité des UUID`, sa propre étape 3) dépend
  exactement du même mécanisme.

### Phase 5 — Apparence des connecteurs dans l'éditeur (`PLAN_PORTES.md`) — CLOS pour ce périmètre

Rendu 3D synchronisé sur l'état runtime (mixer multi-clips, généralisation du patron des entités) et bug du cadre de
sélection déformé : **codés, testés, validés en jeu** sur les 8 types de portes (`1ea1150`, `ec5ef82`). Rien à ajouter
à la roadmap de l'éditeur sur ce point. Le problème résiduel (`03_sliding_door` infranchissable au pathfinding de
combat) est un sujet moteur monde/collision, pas un sujet d'éditeur — suivi dans `PLAN_PORTES.md` §9, hors de ce
document désormais (§0).

## 2. Ordre recommandé et pourquoi

**2, puis 1c, en parallèle avec 4a et 3 (aucune dépendance entre eux) :**

1. **Phase 2** (refactor `Editor3D.jsx` + dette de duplication) — additif, sans risque, et rend la Phase 1c moins
   coûteuse à coder ensuite. Bon candidat pour démarrer maintenant.
2. **Phase 1c** (Plan B, le geste de modification de forme) — la pièce la plus attendue, techniquement prête
   (scope tranché, aucune migration de données), une fois la Phase 2 posée.
3. **Phase 4a** (lecture du modèle existant pour les décals) — peut tourner en parallèle des deux précédentes, zéro
   risque, zéro dépendance.
4. **Phase 3** (suite des matériaux) — indépendante, à faire quand on veut, pas de dépendance avec le reste.
5. **Phase 4b** (code des décals) — seulement une fois 1c livré.

**Axe séparé, qui n'est pas à moi de trancher** : si Saar préfère coder 1c avant 2 malgré le risque d'empiler sur le
monolithe, c'est un choix légitime (priorité personnelle, voir l'ancien §2 de ce document, conservé en esprit même si
la table axe 1/axe 2 n'est plus recopiée ici faute d'objet — elle ne s'appliquait qu'au choix entre chantiers
différents, plus pertinent maintenant que le périmètre est un seul chantier).

## 3. Portes de décision (points de non-retour, propres à l'éditeur)

- **G2 — cadrage de la forme des salles — franchie de fait le 2026-09-27, Plan B livré et validé le 2026-09-28** :
  identité d'arête, autorité de la forme (`cells`), interface (Plan A) tranchés par Saar en travaillant directement ;
  Plan B codé (peindre/effacer des cases, pas la poignée maquettée) et validé en jeu. Reste le re-test de la peinture
  de mur après correction de bug (voir 1c).
- **G-décals — avant de spécifier `PLAN_DECALS.md` en détail** : Plan B livré et son mécanisme d'ancrage de mur/arête
  connu.

## 4. Points durs déjà identifiés — `[VÉRIFIÉ]` le 2026-09-26/27

1. **Identité d'arête — résolu pour Plan B par le choix d'approche, pas par un mécanisme d'id** : `roomBoundaryEdgeKey`
   (`shared/world/roomGeometry.js:56`) dérive toujours la clé des coordonnées, et `boundaryArcs`,
   `wallElevationProfiles`, `wallAppearanceProfiles`, `openWallEdgeKeys` en dépendent toujours — ça reste vrai. Le
   risque résiduel (une arête disparaît sans déplacer aucun sommet) avait été confirmé plus large que prévu en
   creusant : aucun mur n'a jamais d'identité stable dans Enclume (recherche pro citée dans
   `PLAN_WORLD_BUILDER_REWORK.md` §8, react-planner/DCEL). Un système d'id persistant avait été envisagé, puis
   abandonné : Plan B retenu (peindre/effacer des cases) ne fait jamais « glisser » un mur d'une position à une autre,
   il ajoute/retire des cases entières — le problème ne se pose donc plus pour ce geste précis. Reste vrai pour toute
   future mécanique qui déplacerait littéralement un mur (hors périmètre ici).
2. **Autorité de la forme — tranché : `cells` reste le modèle, pas de migration.** Confirmé empiriquement
   (`enclume-cb`, scripts Node contre le moteur réel) : `cells` supporte déjà L/T/U/trous/îlots/multi-niveau sans
   changement de code. La carte réelle n'utilise que `cells` (deux salles, 403 et 40 cases, rectangles pleins).
3. **Logique d'édition côté client** — les opérations (créer, fusionner, arrondir, supprimer un mur) vivent dans
   `client/src/lib/surfaceRooms.js` ; le serveur ne fait que valider le schéma, jamais le résultat d'une fusion ou
   d'un arrondi. Ce que Plan B fait remonter dans `shared/world/` est une décision d'autorité à trancher en le codant.
   **Primitive déjà là, signalée par la session zones dangereuses (2026-09-28)** : `findRoomAtCell`
   (`client/src/lib/surfaceRooms.js`) détecte déjà « quelle salle sous ce point », aujourd'hui câblée seulement côté
   éditeur — candidate directe pour la détection de clic du geste de Plan B (sélectionner une salle avant de tirer une
   arête), à vérifier avant d'en écrire une nouvelle.
4. **Ancrages muraux des objets posés** — `entities.state.placement.wallId` (table `entities`, pas `surface_data`)
   est une clé dérivée des coordonnées du panneau de mur (`room-wall:x:…`, `roomWalls.js` `roomsWallSegments`).
   **Inchangé par Plan B tel que livré** : peindre/effacer des cases ne change l'identité d'aucun mur existant plus
   que ne le faisaient déjà la création/fusion/suppression de salle présentes avant ce chantier — gap pré-existant,
   ni aggravé ni corrigé, toujours hors périmètre.
5. **Taille des points d'entrée** — voir Phase 2. `Plan A` et `R1` ont montré que ce n'est pas un prérequis dur, mais
   son coût augmente à chaque ajout ; Plan B en ajoute beaucoup (une nouvelle interaction complète).
6. **Infrastructure partagée avec d'autres consommateurs** — `client/src/lib/floatingPanel.js`
   (`useDraggablePanelPosition`/`FloatingPanelSection`) est déjà consommé par Salle/Mur/Connecteur (Plan A) et le
   panneau d'entité. **Confirmé (2026-09-28)** : le rework de l'écran zones dangereuses (chantier séparé, §0) a
   réutilisé ce même patron (`SurfaceEffectPanel.jsx`) plutôt que d'en inventer un autre, et n'a touché ni
   `Editor3D.jsx` ni aucun fichier de la Phase 1/2 (son panneau lit le store Zustand directement, hors du chemin de
   callbacks Salle/Mur/Connecteur) — aucun conflit de fichier avec ce chantier.

## 5. Méthode

- Chaque phase : cadrage → analyse à charge → plan exact (fichiers, invariant, hors-périmètre) → code → validation de
  Saar. Une phase de code à la fois ; la lecture/l'étude (Phase 4a) peut avancer en parallèle sans risque.
- Recherche pro et dépôts GitHub avant toute mécanique non triviale (déjà fait pour l'identité d'arête, Dungeondraft/
  Foundry, et pour les matériaux, Material Maker).
- Réalisation déléguée à des agents : envisageable phase par phase une fois son plan validé et critiqué. Pas pour
  Plan B tant que la Phase 2 n'a pas réduit le fichier partagé (risque de conflit entre deux agents sur le même
  monolithe).

## 6. Suivi live

| Phase | Session | Dernier signal |
|---|---|---|
| 1 (forme des salles) + 3 (R1) | `enclume-cb` — Saar directement, session non lancée par cette orchestration | Rapport de fin de session (2026-09-27), 3 commits poussés (`165be2b`, `8962c8c`, `78159ea`) : Tier A, Plan A codé et validé, R1 avancé. |
| 1c (Plan B) | agent « forme des salles » (META EDITEUR) | 2026-09-29 : peindre/effacer des cases validé en jeu par Saar (clos) ; peinture de mur (Lot A) **EN PAUSE** après 3 cycles de correctifs — Saar constate l'échec de la méthode itérative sur cet outil, interdit toute nouvelle correction, ses constatations consignées `PLAN_WORLD_BUILDER_REWORK.md` §9 pour un futur cadrage ; rien commité. Même jour, nouvelle conversation : contre-diagnostic indépendant (`PLAN_WORLD_BUILDER_REWORK.md` §10) — deux bugs trouvés et corrigés, testés 49/49 + build propres, pas commités (garde-fou porte manquant ; duplication d'autorité `interiorTex` entre sidebar et panneau flottant Mur, tranchée), hypothèse de fusion de tronçon réfutée par script empirique, cause de « la couleur écrase tout » toujours `[INCONNU]`. |
| 5 (connecteurs) | `PORTES` | Clos pour ce périmètre (`1ea1150`, `ec5ef82`) — voir §0 pour ce qui reste hors de ce document. |

## Historique

- **2026-09-29** — Peinture de mur (Lot A, 1c) mise **EN PAUSE** : après un 3ᵉ cycle de correctifs (bug de palette,
  bug de priorité texture/procédural, bug d'échelle case, sélection de salle absente, fuite de couleur mitoyenne),
  Saar constate l'échec de la méthode de correctifs itératifs sur cet outil et interdit toute nouvelle correction
  avant un vrai cadrage UI/UX — constatations consignées `PLAN_WORLD_BUILDER_REWORK.md` §9. Peindre/effacer les
  cases (Plan B) non affecté, reste clos et validé.
- **2026-09-28** — Plan B (1c) codé et validé en jeu, en abandonnant la maquette « poignée sur mur » en cours de
  route (détail dans `PLAN_WORLD_BUILDER_REWORK.md` §8) ; Phase 2 (refactor) explicitement reportée par Saar après
  Plan B plutôt qu'avant ; peinture de mur (Lot A) recodée en Option 2 (procédural seul) après un premier bricolage
  annulé par Saar — testé (44/44), pas encore confirmé en navigateur ; §1, §3, §4
  mis à jour en conséquence.
- **2026-09-26** — création, segmentation initiale S0→S4.
- **2026-09-26/27** — cadrage de l'export (S0), feuille de route complète, puis pause de S0 (pas urgent).
- **2026-09-27** — réécriture élargie à `PLAN_RW_MATERIAUX.md` et `PLAN_ZONES_DANGER.md`/`PLAN_NUAGE.md` ; cadre de
  lecture axe 1 (technique) / axe 2 (préférence de Saar), après trois recommandations d'ordre différentes dans la
  même conversation.
- **2026-09-27** — mode multi-session formalisé ; suivi des sessions zones dangereuses (`enclume-51`) et portes
  (`PORTES`), coordination croisée (patron de fenêtre flottante partagé, concept d'état de porte).
- **2026-09-27** — pivot majeur trouvé après coup : Saar a lui-même mené la Phase 1 (Tier A, Plan A) et une partie de
  la Phase 3 (R1) dans une session non orchestrée ici (`enclume-cb`). Leçon retenue : ce document doit rattraper
  l'état réel plutôt que supposer qu'une phase « pas encore attribuée » est inactive.
- **2026-09-27** — Saar juge un point d'étape trop superficiel : balayage complet des 32 plans de `docs/PLANS/` pour
  vérifier qu'aucun chantier voisin n'était oublié (admin backup, Kiwi, grenades, environnement des milieux,
  battlemap 2D, roadmap entités interactives) — consigné, aucun n'appartient à l'éditeur lui-même.
- **2026-09-27** — **recentrage strict sur l'éditeur** (Saar : « reste focus sur l'éditeur, uniquement l'éditeur »).
  Document réécrit : export, purge voxel et zones dangereuses sortent du corps du texte (ils gardent leur document,
  référencés une fois en §0) ; le reste devient une **roadmap réelle en 5 phases** avec un ordre recommandé explicite
  (Phase 2 avant Phase 1c, Phase 4a en parallèle, Phase 3 et Phase 5 indépendantes/closes).
