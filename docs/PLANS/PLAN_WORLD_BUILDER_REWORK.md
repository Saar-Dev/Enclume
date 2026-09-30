# PLAN_WORLD_BUILDER_REWORK.md — Rework de l'édition de forme des salles

> Créé comme stub le 2026-09-10 (cadrage non commencé) ; cadré et largement codé depuis (§6→§9, dernière
> mise à jour 2026-09-29). Plan B (§8) livré et validé en jeu. **Peinture de mur (Lot A) : EN PAUSE (§9)**
> — après 3 correctifs successifs (bug de palette, bug de priorité texture/procédural, bug d'échelle en
> mode case, absence de sélection de salle, fuite de couleur sur mur mitoyen), Saar constate l'échec de la
> méthode de correctifs itératifs sur cet outil et interdit toute nouvelle correction avant un vrai
> cadrage UI/UX — voir §9 pour ses constatations complètes, non diagnostiquées. La Phase 2 (refactor
> `Editor3D.jsx`/`SurfaceEditorScene.jsx`) est reportée par Saar — voir `PLAN_EDITEUR_CARTE.md` §1 pour le
> suivi de roadmap à jour. **§10 (2026-09-29, même jour)** : Saar redémarre le sujet dans une nouvelle
> conversation, explicitement sans reprendre le diagnostic de la précédente (« à toi d'analyser le code
> réel »). Contre-diagnostic indépendant mené (lecture de code + script jetable empirique) : garde-fou porte
> absent corrigé, duplication d'autorité sur `interiorTex` corrigée, hypothèse de fusion de tronçon réfutée.
> **§10e (même jour, suite)** : cause réelle de « certains murs refusent toute modification » trouvée
> (sélection de murs qui s'accumulait silencieusement + panneau flottant qui applique la couleur en direct
> sur toute la sélection) et corrigée — **validée en jeu par Saar** (« Résolution du problème des murs non
> modifiables. Bien joué »). Occlusion caméra désactivée en édition (2ᵉ blocage de test, corrigé). Restent
> ouverts : le flux Sélection→salle→Peindre (§9), et « Ajouter une salle » qui ne reste pas actif (§10b),
> en attente d'une clarification de Saar. **§11 (même jour, suite)** : Saar propose un rework « World Builder
> v2 » (stratégie strangler fig — reconstruire la coquille d'interaction à côté, garder l'ancien tant qu'il ne
> gêne pas), recadré après recherche (second-system effect) au périmètre de la coquille seule — modèle de
> données/compilateur/rendu repris tels quels. Stub créé, cadrage réel pas commencé. La poignée (§10c) reste
> une exigence explicite de Saar, pas une option que ce rework pourrait écarter — confirmé en clair (« je la
> veux cette poignée ! ») après une confusion pendant la rédaction. Détail complet en §10 et §11.
>
> **Autorité** : *Livre de Base Polaris* n'a rien à dire ici (pur outillage) → `docs/SYSTEME/EDITEUR.md`
> + `docs/SYSTEME/SURFACES_SALLES.md` + `.claude/rules/world.md`.

---

## 1. Déclencheur (Saar, 2026-09-10)

> « Le world builder actuel ne me satisfait pas : uniquement des salles purement rectangulaires. Je
> compte le rework pour adopter la logique : **dessiner un volume rectangulaire et le modifier en
> ajoutant des arêtes et en redimensionnant les arêtes.** »

L'inspiration vient de la recherche faite pour l'éditeur de zones dangereuses (Foundry Scene Regions,
Owlbear Fog) : primitives (rectangle / ellipse) + **polygone éditable par poignées** (déplacer une
arête, ajouter un sommet), formes ordonnées combinées en booléen (ajout / trou), « tracer depuis les
murs ».

## 2. État connu `[VÉRIFIÉ code + docs, 2026-09-10 — à re-vérifier au cadrage]`

- **Le modèle de données de salle n'est PAS rectangulaire** : `surface_data.rooms[].verticalProfile.slices[]`
  porte un **multipolygone `footprint`** + `wallPaths` canoniques ; `boundaryArcs` (arrondis) ;
  `geometryClipRoomIds` (soustraction booléenne entre salles) ; `openWallEdgeKeys` ; `wallElevationProfiles`.
  Le compilateur (`shared/world/worldCompiler.js`) extrude déjà « le contour effectif exact, trous et
  polygones disjoints compris » (`SURFACES_SALLES.md` §Formes).
- **C'est l'UX d'édition qui est pauvre** : `SurfaceEditorScene.jsx` peint des **cases de grille**
  (`applyFloorSelection` → `cells` en clés `x:z`) ; `worldCompiler.js` construit le `footprint` depuis
  ces cases. Les formes riches (arcs, clips, profils de mur) sont éditées par des panneaux annexes, pas
  au tracé direct. **Aucun éditeur de sommets / d'arêtes de contour n'existe.**
- `shared/world/aoeShapes.js` = `circle` / `cone` / `ray` horizontales transitoires (combat) — **pas**
  une bibliothèque de géométrie 2D d'édition.

## 3. Ce que le cadrage devra faire

- **Recenser l'existant avant de dessiner** : `boundaryArcs`, `geometryClipRoomIds`, `wallPaths`,
  `verticalProfile.slices` — le rework outille un modèle déjà riche, il ne le refait pas. Le risque
  est de construire un second modèle de contour à côté du multipolygone canonique (invariant 2).
- Définir le **primitif d'édition 2D partagé** dans `shared/world/` : représentation d'un contour
  éditable (sommets ordonnés + arêtes + arcs), opérations (déplacer une arête, insérer/retirer un
  sommet, ajout/trou), test point-dans-contour. **Autorité unique**, réutilisée par le compilateur,
  la requête spatiale et les éditeurs.
- Interaction canvas : poignées, snap-grille togglable, aperçu réversible jusqu'à confirmation serveur
  (`.claude/rules/world.md` : client = intention, serveur = autorité).
- Migration des salles existantes (empreintes de cases → contours) — ou coexistence.

## 4. Contrainte inter-chantiers — **l'éditeur de zones dangereuses E-v2 en dépend**

`PLAN_ZONES_DANGER.md` §7.3 + §12 : le **sculpteur de volume de danger** (polygone / ellipse /
poignées) consomme **ce même primitif d'édition 2D**. Le construire deux fois = deux moteurs
d'édition de forme (invariant 2). Séquencement (`PLAN_ZONES_DANGER.md` §12) :

1. Zones dangereuses noyau Z0→Z5 + éditeur danger **E-v1** (rectangle + « remplir un compartiment ») — sans dépendance.
2. **Ce chantier** — parallélisable avec 1.
3. Éditeur danger **E-v2** — après 2, consomme le primitif livré ici.

Le primitif d'édition 2D livré ici doit donc être **agnostique du domaine** : une salle et un volume
de danger sont deux consommateurs d'un même contour éditable.

## 5. Hors périmètre (à confirmer au cadrage)

Rendu 3D des murs / profils verticaux (déjà en place) ; connecteurs ; matériaux ; le mode voxel.

---

## 6. Confirmation externe (2026-09-16) — direction validée, cadrage détaillé toujours à faire

Recherche pro dédiée (déclenchée par une question directe de Saar : formes additives combinées vs
édition de sommets/arêtes) — converge deux fois avec le constat du §2 :

- **Dungeondraft** (l'outil le plus comparable — création de cartes de donjon pour JDR) : son outil
  de mur de base pose déjà les sommets **un par un**, pas par primitive. Le mode additif (combiner
  des formes) n'existe même pas dans le cœur du logiciel — c'est un **mod communautaire** ("Wall
  Shapes"), signe que même côté pro, l'additif est un gadget d'appoint, jamais la fondation.
- **Foundry VTT** n'a même pas de concept de « salle » : murs = segments libres, LOS = polygone de
  visibilité calculé à la volée. Notre moteur (salles volumétriques, `boundaryArcs`,
  `verticalProfile.slices`) est déjà plus riche que cette référence — le rework outille un modèle
  déjà mûr, il ne rattrape pas un retard.
- CSG 2D générique (Clipper2, martinez-polygon-clipping) : pièges documentés (segments/aires
  quasi-nulles, arêtes qui se touchent = cas dégénéré fragile) confirmant le risque déjà identifié
  au §3 — un second modèle de contour à nettoyer avant triangulation, contre un polygone simple à
  une boucle que le `worldCompiler` consomme directement.

**Confirmation** : édition directe de sommets/arêtes sur un contour à une seule boucle, additif au
mieux comme aide de dessin qui produit *in fine* un polygone simple, jamais comme second modèle de
données. Le §3 (primitif d'édition 2D partagé, `shared/world/`) reste la bonne cible — rien à
changer dans la direction technique.

**Point ouvert non couvert par cette recherche, soulevé par Saar le même jour** : l'UI/UX actuelle
de l'éditeur de surface (panneaux flottants denses, styles inline, aucune affordance visuelle pour
les raccourcis clavier existants) est jugée « au mieux inadaptée ». La recherche pro ci-dessus
tranche la **représentation de données et l'algorithme**, pas l'**interaction concrète** (comment un
MJ non-développeur pose un sommet, le déplace, annule un geste). Avant tout code sur ce chantier, le
cadrage dédié (§3, jamais commencé) devra inclure une vraie passe UI/UX — a minima regarder à quoi
ressemble concrètement l'outil de mur de Dungeondraft (pas seulement son modèle de données), pas
uniquement la question technique déjà tranchée ici.

## 7. Session 2026-09-27 — bilan : pivot UI/UX + matériaux, la forme des salles n'a toujours pas avancé

**Constat d'ouverture, vérifié empiriquement (scripts Node jetables important `roomGeometry.js` /
`worldCompiler.js` directement)** : le moteur (`shared/world/roomGeometry.js`,
`worldCompiler.js`) supporte déjà, **sans aucun changement de code**, les salles en L/T/U, les trous,
les îlots disjoints, l'arrondi automatique aux angles rentrants, l'ouverture de mur n'importe où, et
le multi-niveau à recouvrement partiel — via le modèle `room.cells` (cases `"x:z"`) déjà utilisé par
`makeRoomFromSelection`. Ceci a redirigé tout le chantier : **Tier A** retenu (formes rectilignes
multi-cellules, toujours à 90°, jamais d'arête libre) plutôt que Tier B (arêtes à angle libre) —
décision de Saar, le moteur combat ne gère pas les cellules fragmentées par un mur en diagonale.
Référence d'interface changée de Foundry/Dungeondraft vers **le mode construction des Sims 4** (cet
éditeur est un outil 3D, pas une carte 2D). Reformulation du chantier par Saar : « pas ajouter des
fonctionnalités mais les rendre accessibles, pertinentes et logiques » — l'essentiel du travail
constaté ci-dessous est donc de l'UI/UX sur des capacités déjà existantes, pas du moteur.

**Codé, validé par Saar en usage réel** :
- Sidebar réorganisée en 3 écrans (Structure / Objets 3D / Zones dangereuses) au lieu d'une liste
  plate ; bouton « Porte » direct (avant : fallait sélectionner un mur au préalable, corrigé aussi
  côté logique de sélection dans `SurfaceEditorScene.jsx`) ; doublon de section « Connecteurs »
  retiré de la sidebar.
- Déplacement caméra au clavier : cassé dans les écrans Structure/Zones dangereuses
  (`SurfaceEditorScene.jsx` posait `mouseButtons` sans jamais appeler
  `orbitRef.current.listenToKeyEvents(window)`, contrairement à `EntityEditorScene` qui, lui,
  fonctionnait) — corrigé.
- Position des fenêtres flottantes (Salle/Mur/Connecteur) et sections accordéon ouvertes/fermées :
  mémorisées en `localStorage` par type de panneau (`useDraggablePanelPosition`,
  `FloatingPanelSection`), indépendamment de l'objet sélectionné.
- Brouillard d'ambiance (`Skydome.jsx`) : passé d'exponentiel (`FogExp2`, sans distance de départ —
  masquait déjà ~55 % de la scène à 20 unités alors que la grille va jusqu'à 50) à linéaire
  (`near`/`far`), nul sur toute la zone constructible, dense seulement en périphérie.
- Section « Identité » : réduite (champ nom seul, sans cadre accordéon) sur le panneau Salle ;
  retirée entièrement du panneau Mur (elle n'affichait qu'un identifiant technique interne en lecture
  seule, jugée inutile).

**Matériaux procéduraux — Lot 1, validé par Saar (« tous les bons marchés » en matières, « bons
marchés + coût modéré » en motifs)**, dans `client/src/lib/proceduralMaterials.js` :
- 4 matières ajoutées (Acier inoxydable, Aluminium, Titane, Revêtement anticorrosion) et 11 motifs
  (surface rugueuse, panneaux nervurés, tôle ondulée, bandes longitudinales, anneaux boulonnés, trame
  hexagonale, plaques superposées, béton coffré, béton segmenté, plaques soudées, peinture cloquée).
- Après un premier retour de Saar (« nul, générique ») : recherche des techniques pro confirmée
  (Material Maker génère toujours albedo+rugosité+métallique+normal+AO ensemble, jamais une seule
  couleur isolée) → ajout d'une **vraie carte de rugosité par pixel**, dérivée des mêmes données que
  l'albédo (usure, rouille, saleté, arêtes), remplaçant la constante unique par famille de matériau
  qui rendait les 4 nouvelles matières quasi non-métalliques par défaut (`metalness: 0.08`) ; valeurs
  de base rugosité/métallisation déplacées sur le preset (source unique, plus de switch dupliqué dans
  `SurfaceDungeonScene.jsx`) ; bande de rugosité bornée autour de la base de chaque matériau pour
  empêcher l'accumulation usure+rouille+arêtes de pousser vers un miroir ou un mat total irréalistes
  (trouvé sur l'Acier, seul matériau `rust: true`) ; Revêtement anticorrosion recalé sur la texture de
  base lisse du Plastique (il héritait à tort des stries de métal brossé des métaux nus).
- **Connu incomplet, délibérément pas retouché ce lot** (Saar : « Lot A seul pour commencer ») :
  - `hex_grid` : approximation par 3 familles de droites — donne une grille **triangulaire**, pas de
    vrais hexagones (le code l'admettait déjà en commentaire).
  - `rivet_rings` : anneau creux + cratère, pas un dôme plein — jugé « moche et inutilisable ».
  - Bruit de base = bruit de valeur uniquement (`fractalNoise`/`valueNoise`), documenté comme
    « blobby/mou » comparé au bruit de gradient/cellulaire des outils pro — contribue à l'aspect
    générique sur tous les matériaux, anciens compris. Gros rayon d'action, pas commencé (« Lot B »).
  - Matières « coût modéré » (Caoutchouc, Céramique, Cuivre-patine, Époxy/résine) et « vrai nouveau
    morceau » (Verre/transparence, Composites, Mousse technique, Béton fissuré, Grille à vrai trou) :
    hors périmètre de ce lot, les derniers dépendent d'un bruit de Voronoi/cellulaire pas encore écrit
    et/ou d'un support de transparence que le moteur n'a pas.
- Dette déjà connue, pas corrigée : `SurfaceEditorPanel.jsx` réimplémente à la main les 6 champs
  matière déjà factorisés dans `SurfaceMaterialEditor.jsx` (doublon, signalé au §6 de
  `PLAN_PURGE_VOXEL.md`).

**Catalogue de textures (`voxel_textures`)** : documenté en détail (pas codé, sur demande explicite
de Saar) dans `PLAN_PURGE_VOXEL.md` §6 — ce n'est pas un système concurrent du moteur procédural mais
un four de cuisson optionnel (même fonction `generateProceduralMaterialTexture`, résultat figé en PNG
via l'atelier), actuellement vide en base parce que jamais utilisé, pas par bug.

**Piste explorée puis abandonnée** : import de textures image PBR (Poly Haven/ambientCG) pour étendre
les matériaux — Saar a explicitement tranché que la demande était d'étendre la **génération
procédurale**, pas d'importer des fichiers image (« Aucune utilisation de fichier image comme
texture »). Problèmes techniques réels trouvés en cours de route avant l'abandon (non actionnés) :
convention de normal map incorrecte (`_nor_dx_` au lieu de `_nor_gl_`), fichiers dépassant la limite
serveur de 20 Mo, `.exr` non supporté (ni filtre MIME serveur, ni `EXRLoader` côté client).

**Ce qui n'a toujours pas avancé** : le sujet-titre de ce document (édition de forme non-rectangulaire
par arêtes/sommets, §1-§6 ci-dessus) — cadrage détaillé jamais commencé, zéro code. Le Plan B
(nettoyage `SurfaceWallPanel.jsx` + geste de modification de forme 3D façon Sims sur les murs) a été
maquetté en Artifact (glisser une arête de mur pour agrandir/rétrécir une salle) mais attend encore
d'être codé, après validation du Plan A ci-dessus (qui vient d'arriver).

## 8. Session 2026-09-28 — Plan B livré : maquette abandonnée en route, peindre les cases retenu

**Point de départ** : Saar tranche entre les deux gestes comparés dans la maquette Artifact (§7) — **poignée sur
mur = structure** (agrandir/rétrécir une salle), **peindre = matériau des murs** (pas des cases, reformulé en
texturer chaque case de mur à trois granularités : case/tronçon/salle). Recherche pro faite avant tout code
(react-planner, Sims 4, Substance Painter, Blender — détail déjà consigné §7 et dans la mémoire de session) ;
Lot A (peinture de matériau) codé en premier car sans risque (`client/src/lib/surfaceRooms.js` :
`paintRoomWallEdges`/`paintRoomWallRoom`, réutilisent `wallAppearanceProfiles` déjà à la bonne granularité).

**Lot B (poignée sur mur) codé puis abandonné après deux échecs de test réel** : la première version (poignée
visible seulement au survol) ne montrait jamais la sphère de préhension en navigateur, malgré lint/tests/build
propres et deux relectures manuelles du code. Un rewrite « toujours visible » (inspiré à tort d'une lecture trop
rapide des conventions de gizmo pro) a été proposé avec une formulation malheureuse (« cacher jusqu'au survol est
un anti-pattern ») présentant comme une évidence pro ce qui était en réalité ma propre erreur de conception initiale
— corrigé après coup, leçon consignée dans la mémoire de session (communication).

**Cause racine réelle, trouvée seulement après que Saar a demandé de prendre du recul sur l'architecture** :
`handlePosition` multipliait `midX`/`midZ` par `SURFACE_FINE` (= 4) alors que la ligne verte du mur (`linePoints`,
juste au-dessus dans le même fichier) utilisait les coordonnées brutes — même espace que `wall.from`/`wall.to`. La
poignée était donc rendue, mais 4× plus loin de l'origine que le mur qu'elle était censée manipuler. Un mélange
entre l'espace « scène » et l'espace « grille fine » du système voxel legacy, tous deux présents dans le même
fichier sans jamais être mélangés ailleurs — trouvé en comparant les deux lignes côte à côte, pas en devinant. Une
seconde affirmation non vérifiée trouvée au même moment : le commentaire du code citait `PivotControls` de `drei`
« déjà présent dans ce projet » — faux, vérifié en listant `node_modules/@react-three/drei/core/` : ni
`PivotControls` ni `DragControls` n'y sont installés (version 10.7.7). Ce qui est réellement installé et a servi de
référence vérifiée : `three-stdlib/controls/TransformControls.js`, qui sépare bien un mesh visible (`gizmo`) d'un
mesh de collision plus généreux et jamais démonté (`picker`) — le principe visé était juste, la citation qui le
justifiait ne l'était pas.

**Recul demandé par Saar : remettre en question la poignée elle-même, pas juste corriger le bug.** Analyse UI/UX à
charge du geste de poignée (asymétrie cachée agrandir/rétrécir, validation seulement après relâchement, succès
partiel silencieux sur case occupée, taille de poignée non adaptée au zoom, ambiguïté sur mur mitoyen, pas
d'annulation en cours de geste, couleur non alignée sur la convention `#fbbf24` déjà en place) — huit problèmes de
détail, mais Saar a demandé un pas de recul plus large : *la poignée sur un mur (objet dérivé, sans identité stable
dans ce code, cf. §7 « aucun mur n'a jamais d'identité stable ») est-elle la bonne primitive d'interaction, ou
devrait-on manipuler directement la case (seule donnée à identité stable, `room.cells`) ?*

**Solution retenue : peindre/effacer directement les cases**, comme Dungeondraft ou RimWorld (la salle est un
ensemble de cases, le mur n'est qu'un rendu dérivé du contour) plutôt que Sims (glisser un mur). Élimine par
construction la traduction case → mur → sens/magnitude qui avait produit le bug d'échelle, et le besoin d'identité
persistante de mur envisagé au §7/`PLAN_EDITEUR_CARTE.md` §4 point 1 (rien ne glisse, une case s'ajoute ou se
retire, une porte sur une case retirée bloque le retrait au lieu de disparaître — même principe de refus déjà
appliqué par `applyRoomBoundaryArc`/`applyRoomWallElevationProfile`).

**Codé** (`client/src/lib/surfaceRooms.js`) : `classifyRoomFootprintCells`/`paintRoomFootprintCells` remplacent
entièrement `extendRoomWallRun` (supprimé, pas gardé en parallèle — invariant 2). Garde-fous : porte sur la case
retirée, salle vidée, salle coupée en deux (mêmes messages qu'avant) ; case ajoutée qui resterait un îlot déconnecté
refusée automatiquement ; retour case-par-case (acceptée/refusée + raison) pour un aperçu en direct pendant le
geste, jamais un résultat découvert seulement après coup. Interaction (`SurfaceEditorScene.jsx`) : réutilise le
système générique de glisser-déposer déjà en place pour les autres outils (sol, salle...) au lieu d'un mécanisme de
mesh séparé — la case vient du même repère que `getFloorCell`, éliminant la classe de bug d'échelle rencontrée avec
la poignée. Mode « Modifier la forme » exige désormais une salle déjà sélectionnée.

**Testé et validé en jeu par Saar (2026-09-28)** : le geste fonctionne. Une question de Saar en test a révélé un
garde-fou injustifié — case intérieure refusée au retrait « pour éviter un trou dans une salle » sans avoir vérifié
que le moteur le supporte déjà. Vérifié après coup dans `shared/world/roomGeometry.js` : `roomBoundaryLoops`
construit ses contours uniquement depuis les arêtes de bord et classe **toute boucle fermée** comme un trou dès que
son aire est négative, peu importe pourquoi la case manquante est absente — déjà le mécanisme utilisé pour les
découpes entre salles (`geometryClipRoomIds`). Garde-fou retiré ; un pilier au milieu d'une salle est maintenant une
forme valide, retrait comme n'importe quelle autre case. Nouveau test qui interroge `roomBoundaryLoops` sur le
résultat (pas seulement `accepted === true`) pour le prouver, pas le supposer.

**Lot A (peinture de matériau des murs) — cassé, deux correctifs réactifs annulés, repris avec un vrai passage
UI/UX.** Testé par Saar en même temps que Plan B, jugé non fonctionnel/pas compris. Deux pistes réelles trouvées en
lisant le code : (1) `showTexturePalette` (`SurfaceEditorPanel.jsx`) ne listait jamais le mode `paint-wall` ; (2)
`materialOrTextureForTool` (`materialDecision.js`) priorise toujours `textureId` sur le matériau procédural, sans
reset à l'entrée du mode. **Deux correctifs réactifs codés dans la foulée, sans étape de plan ni d'analyse à
charge — jugés par Saar comme du bricolage sans réflexion et annulés intégralement (2026-09-28)** : « Bricolage.
aucune reflexion => poubelle. [...] Ce n'était PAS tolérable la première fois, ça ne l'est toujours pas ! » —
référence directe au même travers déjà commis sur la poignée de mur plus haut dans cette session.

Repris depuis le début, exactement comme pour la poignée de mur : recherche pro (Substance Painter — type de
remplissage explicite par calque, jamais de priorité implicite ; Blender Texture Paint — texture active toujours un
champ explicite ; Les Sims 4 — un seul système de nuanciers, pas de mélange à arbitrer) puis deux options techniques
présentées à Saar. **Option 1** (bascule explicite Texture/Procédural) vs **Option 2** (cet outil n'offre plus que
le matériau procédural, jamais de texture pré-faite). **Saar tranche Option 2, sans ambiguïté.**

Trouvaille supplémentaire en creusant avant de coder : `client/src/components/SurfaceMaterialEditor.jsx` est un
composant déjà partagé (déjà utilisé par `SurfaceRoomPanel.jsx`/`SurfaceWallPanel.jsx`) portant exactement les six
champs de matériau procédural. `SurfaceEditorPanel.jsx` les réimplémente pourtant à la main pour le mode Salle —
dette déjà documentée (`PLAN_EDITEUR_CARTE.md` Phase 2b), jamais corrigée. Le premier correctif annulé ajoutait une
**troisième** copie manuelle de ces mêmes champs ; la reprise réutilise le composant partagé tel quel.

**Codé** : `paintRoomWallEdges`/`paintRoomWallRoom` (`surfaceRooms.js`) ne considèrent plus jamais `textureId`/
`packId` — la cause racine (priorité implicite invisible) est coupée à la source de la fonction, pas contournée par
un reset côté UI qui aurait pu être recontourné par un autre état résiduel. `SurfaceEditorPanel.jsx` insère
`<SurfaceMaterialEditor>` dans le bloc `paint-wall`. **Testé** : 44/44 (`surfaceData.test.mjs`), dont un nouveau test
qui simule délibérément un outil contaminé (`wallInteriorTexId` + `surfaceMaterialMode: 'texture'` posés) et vérifie
que le résultat reste procédural — preuve que la cause racine est coupée, pas juste évitée par les données du test.
Build client propre. **Pas encore confirmé par Saar en navigateur.**

**Décision de Saar** : la Phase 2 (refactor `Editor3D.jsx`/`SurfaceEditorScene.jsx`, `PLAN_EDITEUR_CARTE.md` §1)
reste reportée après ce chantier, « quand on saura ce dont on a besoin réellement » — pas avant, comme initialement
recommandé. `SurfaceEditorScene.jsx` est passé à 1479 lignes.

**Portée de peinture (case/tronçon/salle) — deux bugs distincts, cause racine trouvée par lecture/calcul, pas
supposée.** Saar teste et rapporte : la portée « case » ne peint jamais qu'une seule case fixe (jamais celle sous le
curseur), la portée « salle » « perd les murs » sur les formes non triviales.
- **Case** : `PaintableRoomWall` (`SurfaceEditorScene.jsx`) divisait `event.point` par `SURFACE_FINE` avant de le
  comparer au mur, alors que le mesh cliquable — et `wall.from`/`wall.to` — sont déjà en coordonnées brutes (même
  famille de confusion d'unités que le bug de la poignée de redimensionnement, découverte plus haut dans cette même
  session). Calcul à la main confirmé : la projection résultante clampe systématiquement sur la première case, quel
  que soit le point réel du clic. Ligne unique dans tout le projet (`roomWallEdgeKeyAtPoint` n'a qu'un seul appelant)
  — corrigée en retirant la division en trop.
- **Salle** : pas un problème de forme complexe — `roomsWallSegments` (`roomWalls.js`, le vrai rendu 3D des murs) a
  déjà la bonne solution pour un mur mitoyen (une carte indexée par clé géométrique canonique, un panneau physique
  par mur avec face avant/arrière distinctes). `roomBoundaryWallRuns`/`roomSelectableWallRuns`, utilisées par l'outil
  de peinture, n'ont aucune notion de ce panneau canonique — elles raisonnent une salle à la fois. Tous les autres
  consommateurs de ces fonctions (redimensionner une salle, arrondir un coin, le panneau flottant d'un mur) les
  appellent déjà sur une seule salle sélectionnée au préalable ; « Peindre un mur » était le seul outil du projet à
  les appeler pour toutes les salles du niveau affiché en même temps, sans sélection — deux zones de clic invisibles
  superposées sur tout mur mitoyen. Corrigé en alignant l'outil sur le même patron que les autres : une salle
  sélectionnée au préalable (bouton désactivé sinon, comme « Modifier la forme »), rendu limité à cette salle.

**Codé, testé (44/44 inchangé, aucun test pur possible sur ce bug précis — c'est un gestionnaire d'événement r3f, pas
une fonction pure), lint et build propres.**

**Troisième bug rapporté par Saar après retest : les murs mitoyens (les deux faces d'un même mur physique) se
peignent en double ou refusent de changer selon les cas — « le problème principal ». Trouvé dans
`roomsWallSegments` (`client/src/lib/roomWalls.js`, la fonction dont dérive tout le rendu 3D des murs, pas
seulement la peinture) : `const segmentExterior = segmentInterior` faisait porter la couleur d'une salle sur la
face qui appartient à l'AUTRE salle, un mur mitoyen ne recevant sa vraie couleur par côté que si l'ordre de
traitement des salles et le système de priorité interne/extérieur s'alignaient par hasard. Corrigé : chaque salle
ne revendique plus que SA PROPRE face (`frontSource`/`backSource` passe `null` côté opposé au lieu de dupliquer sa
propre couleur) ; le filet de secours déjà existant (`completeRoomWallPanel`, copie depuis le côté rempli si
l'autre n'a jamais été réclamé par personne) continue de couvrir le cas d'un mur extérieur au bâtiment (une seule
salle propriétaire) sans changement de comportement là. Deux tests ajoutés : peindre les deux salles d'un mur
mitoyen avec des couleurs différentes garde chaque couleur sur sa propre face ; peindre une seule salle laisse
l'autre hériter par le filet de secours sans écraser la salle peinte. 46/46, lint et build propres.

**Pas encore confirmé par Saar en navigateur** (aucun des trois derniers correctifs — case, salle mitoyenne
sélection, murs mitoyens double-peinture). Restent aussi non couverts, signalés par Saar mais pas encore
investigués : peinture impossible sur un mur portant une porte/portail, chevauchement visuel des murs aux angles.

Rien commité cette session (Saar commit après confirmation fonctionnelle, per `AGENTS.md`).

## 9. Peinture de mur (Lot A) — EN PAUSE, constat d'échec de la méthode de correctifs itératifs (2026-09-29)

Après le cycle de corrections du §8 (palette absente, priorité texture/procédural, échelle en mode case, sélection
de salle absente, fuite de couleur sur mur mitoyen), Saar teste à nouveau et conclut sur la méthode elle-même, pas
seulement sur un bug de plus : **« Interdiction de corriger. Cette méthode ne FONCTIONNE PAS. cette longue
conversation en est la preuve. »** Consigne explicite : mettre à jour le plan avec ses constatations, ne rien
corriger dans l'immédiat. Ce qui suit est retranscrit tel quel, **non diagnostiqué, aucune cause cherchée** —
matière pour un futur cadrage, pas une liste de bugs prête à corriger un par un.

### Constatations de Saar (verbatim ou résumées, non expliquées)

- **« Ajouter une salle » ne reste pas actif** : une fois une salle posée, l'outil repasse en mode Sélection au lieu
  de rester en mode création — empêche d'enchaîner la pose de plusieurs salles sans recliquer le bouton à chaque
  fois.
- **Le verbatim du bouton peut être amélioré** (bouton non précisé par Saar — à clarifier à la reprise).
- **Cliquer sur « Peindre un mur » ferme une fenêtre qui contient déjà toute l'interface nécessaire** (l'onglet/
  panneau APPARENCE, déjà branché sur `SurfaceMaterialEditor.jsx` via les panneaux flottants Salle/Mur) **pour en
  dupliquer une partie dans la sidebar** — jugé non intuitif. Confirme et aggrave, du point de vue de l'usage réel,
  la dette de duplication déjà documentée (`PLAN_EDITEUR_CARTE.md` Phase 2b) : il existe maintenant deux interfaces
  de choix de matériau qui ne coexistent pas proprement, l'une ferme l'autre au lieu de la réutiliser.
- **Portée « Salle »** : changer la couleur s'applique à la salle entière — jugé logique et correct par Saar.
- **Portées « Case »/« Tronçon »** : changer la couleur dans le panneau **change aussi la couleur de murs déjà
  peints** — « c'est stupide ». Observation seule, aucune cause cherchée.
- **Mode Case** : à la lisière entre deux cases peintes, les couches de peinture se superposent visuellement —
  **déjà signalé avant cette session, toujours pas corrigé.**
- **Changer de salle en cours de peinture** : flux jugé peu intuitif — retour obligatoire en mode Sélection,
  sélectionner la nouvelle salle, repartir en mode Peinture. Conséquence directe de l'exigence de salle sélectionnée
  ajoutée au §8 pour corriger la fuite de couleur sur mur mitoyen — ce correctif déplace un coût ergonomique
  ailleurs, il ne le supprime pas.
- **Outil jugé intestable en l'état** : « le changement de couleur ÉCRASE à chaque fois toutes les couleurs de
  murs » — empêche toute validation fonctionnelle du reste des points.
- **Certains murs refusent toute modification, sans logique identifiable par Saar** (« lesquels ? je ne comprends
  pas la logique ») — lien possible avec les portes/portails déjà signalés comme impossibles à peindre (§8),
  possiblement une cause distincte. Non tranché.

### État à la reprise

**Peinture de mur (Lot A) : EN PAUSE, ne pas reprendre par correctifs ponctuels.** Plan B (peindre/effacer les
cases d'une salle, §8) reste validé et fonctionnel — cette pause ne concerne que la peinture de matériau. La
reprise doit commencer par un vrai passage cadrage/UI-UX (même méthode que celle qui a fonctionné pour Plan B,
§8 : recherche pro, options présentées, tranchées par Saar, AVANT tout code), qui prenne en compte au minimum :
l'existence déjà réelle de `SurfaceMaterialEditor.jsx` et des panneaux flottants Salle/Mur (à réutiliser ou fusionner
avec l'interface de la sidebar, pas dupliquer une troisième fois) ; la distinction entre « réglage courant du
pinceau » (ne doit rien changer rétroactivement à ce qui est déjà peint) et « apparence déjà posée sur un mur » ;
le flux de sélection de salle pendant une session de peinture continue.

### Leçon de méthode

Consignée dans [[feedback_workflow_plan_then_code]] : une succession de correctifs ponctuels sur un même outil,
même chacun individuellement vérifié (lu, tracé au calcul, testé), ne remplace pas un vrai cadrage amont quand le
problème réel est dans l'interaction/l'architecture d'interface et non dans un bug isolé. Plusieurs correctifs
réussis un par un peuvent s'accumuler en un échec global — le signal à surveiller n'est pas seulement « ce
correctif est-il sûr ? » mais « combien de correctifs d'affilée sur le même outil, et pourquoi ça continue à ne
pas marcher ? ».

## 10. Contre-diagnostic indépendant (2026-09-29, nouvelle conversation) — un bug isolé corrigé, une piste réfutée

Saar redémarre le sujet dans une nouvelle conversation et coupe explicitement l'accès au diagnostic de la
précédente (« si je voulais l'avis des anciennes conversations, je ne les aurais pas fermées ») : la précédente
était en biais cognitif, incapable de prendre du recul. Consigne : lire le code réel, me faire mon propre avis,
avant tout code. Il donne aussi sa propre lecture, en la marquant explicitement révisable (« JE PEUX ME
TROMPER ») : le problème de peinture n'est **pas** pour lui de l'UI/UX (certains murs refusent la modification),
la poignée est une fonctionnalité distincte des cases (rapide/gros vs fin/détail), l'interface est un vrai
capharnaüm à ranger. Ce qui suit est mon propre contre-diagnostic, mené sur le code réel de cette session,
indépendamment du diagnostic non retenu de la session précédente.

### 10a. Peinture — un bug réel trouvé et corrigé, une piste sérieuse réfutée par test empirique

**`[VÉRIFIÉ]` bug corrigé** : `applyRoomWallAppearance` (`surfaceRooms.js`, appelée par `paintRoomWallEdges`/
`paintRoomWallRoom`) était la **seule** des quatre opérations de mur (avec profil d'élévation, arc, et
peinture) à n'avoir **aucun garde-fou porte** — `applyRoomWallElevationProfile` et `applyRoomBoundaryArc`
appellent toutes deux `doorConnectorTouchesBoundaryEdges` et refusent avec un message clair ; la peinture ne le
faisait pas. Ça n'explique pas à lui seul « certains murs refusent toute modification » (rien ne bloquait la
peinture nulle part, donc un refus observé vient d'ailleurs — scope, sélection, ou un cas non reproduit ici) mais
c'est une vraie incohérence d'autorité entre quatre opérations censées suivre la même règle. Corrigé : garde-fou
ajouté, symétrique aux deux autres opérations, testé (voir 10d).

**`[HYPOTHÈSE]` posée puis `[RÉFUTÉE PAR TEST]`** : en lisant `roomWallAppearanceForEdges` (`roomGeometry.js:895`,
un `.find()` qui prend la première entrée de `wallAppearanceProfiles` chevauchant les `sourceEdgeKeys` d'un
`path` rendu) et `roomsWallSegments` (`roomWalls.js:269`), j'ai soupçonné que le rendu réel fusionne plusieurs
cases d'un même tronçon droit en un seul panneau de mur, et que peindre une case ferait alors hériter tout le
panneau fusionné de sa couleur — ce qui collerait avec « la couleur écrase tout » et la superposition en mode
case. **Vérifié empiriquement par script jetable** (`node`, import direct de `surfaceData.js`, aucune
modification du dépôt) : salle à mur nord de 3 cases, case 1 peinte rouge, case 3 peinte bleue, case 2 laissée
par défaut → `roomsWallSegments` renvoie **3 panneaux distincts**, un par case, chacun avec son
`frontMaterial`/`backMaterial` propre (rouge / `null` / bleu) et son `sourceEdgeKeys` propre. Pas de fusion, pas
d'aliasing : la donnée ET sa résolution de rendu logique sont correctes case par case pour un mur droit sans arc.
Recherche complémentaire (grep) dans `SurfaceDungeonScene.jsx` (le vrai renderer Three.js, pas seulement l'éditeur) :
aucun fusionnement de géométrie/matériau par lot (`mergeGeometries`, `InstancedMesh`, batching) trouvé — chaque
panneau semble bien rendu avec son propre matériau. **Mon hypothèse initiale était donc fausse.**

**`[INCONNU]` — reste à investiguer, pas encore fait** : la cause réelle de « changer la couleur écrase tout »
et de la superposition en mode case n'est pas trouvée. Candidats non testés, par ordre de suspicion :
1. Murs avec coin arrondi (`boundaryArcs`) — `collectCurveSegmentMetadata` regroupe plusieurs arêtes d'origine
   sous un même jeu de `curveSourceEdgeKeys` partagé par tous les segments échantillonnés de la courbe ; si un
   coin arrondi touche une case peinte différemment de ses voisines, l'aliasing pourrait s'y produire — jamais
   testé, le script ci-dessus ne couvrait que le cas droit.
2. Mur mitoyen (deux salles) au-delà du cas déjà corrigé au §8 — la correction du 28/09 a réglé le partage
   front/back par salle, mais pas retestée spécifiquement avec la peinture par case des deux côtés.
3. Confusion d'état du pinceau plutôt que corruption de donnée : si le réglage courant du pinceau
   (`surfaceToolState.materialProfiles.wallInterior`) se retrouve pré-rempli avec la couleur d'un mur qui vient
   d'être cliqué, ajuster ensuite le curseur puis cliquer ailleurs donnerait l'impression trompeuse que « changer
   la couleur dans le panneau » a rétroactivement changé un mur déjà peint, sans qu'aucune donnée ne soit
   réellement corrompue — pas vérifié, demande de tracer l'état du pinceau pendant une session de peinture réelle
   (donc en jeu, pas par script).
Sans reproduction confirmée, aucun correctif ne doit être tenté sur ce point précis (invariant méthode : jamais de
correctif sur cause non instrumentée). La piste 1 est vérifiable par le même genre de script jetable ; la piste 3
demande une observation en session réelle par Saar (quelles valeurs le panneau affiche-t-il juste avant/après le
clic « stupide » ?).

**Conclusion argumentée sur le désaccord de framing** : je rejoins Saar — ce qui a été vérifié n'est pas un
problème d'UI/UX (agencement, flux). C'est soit un bug isolé déjà trouvé et corrigé (garde-fou porte), soit une
cause encore non localisée mais clairement du côté données/rendu ou état d'interaction, pas de l'agencement visuel.
Le classement en « cadrage UI/UX nécessaire » du §9 restait justifié pour les points de flux qu'il listait
(fenêtre qui se ferme, changement de salle en cours de peinture) mais pas pour « certains murs ne sont pas
peignables » / « la couleur écrase tout », qui sont des bugs à traquer par la méthode habituelle (lire, tracer,
instrumenter), pas par un atelier UI/UX.

### 10b. Interface — duplication d'autorité trouvée et tranchée

**`[VÉRIFIÉ]` puis corrigé** : deux chemins distincts écrivaient `wallAppearanceProfiles` (même donnée, même
salle, mêmes edgeKeys possibles) avec des règles différentes :
- Sidebar, mode « Peindre un mur » → `paintRoomWallEdges`/`paintRoomWallRoom` (`surfaceRooms.js:1157`) : matériau
  procédural **forcé**, texture toujours mise à `null`, quoi que porte l'outil (décision du 28/09, Option 2).
- Panneau flottant « Mur » (sélection classique) → section Apparence → `SurfaceWallPanel.jsx` `patchAppearance`
  → `onAppearanceChange` → `applyRoomWallAppearance` directement (`Editor3D.jsx:1351`) : **préservait** la texture
  déjà posée (`interiorTex` lu depuis l'état stocké, jamais forcé à `null`).

Décision tranchée moi-même (architecture/périmètre, pas une règle de jeu) après vérification que ce n'était pas
un choix à arbitrer entre deux besoins réels : `showTexturePalette` (`SurfaceEditorPanel.jsx:186`) ne s'affiche
qu'en mode `room`/`wall`, jamais en mode `paint-wall` ; et `SurfaceRoomPanel.jsx`'s `MATERIAL_FACES` n'a que
`floor`/`ceiling`, jamais `wallInterior`. **Aucun chemin d'interface actuel ne peut donc plus jamais écrire
`wallInteriorTexId`** — la « préservation de texture » du panneau flottant protégeait une valeur qu'aucune UI ne
peut plus produire depuis Option 2, un reliquat mort plutôt qu'une fonctionnalité concurrente légitime. Corrigé :
`applyRoomWallAppearance` force désormais `interiorTex: null` inconditionnellement (seule autorité, les deux
appelants la traversent) ; `SurfaceWallPanel.jsx` ne calcule plus ni ne transmet `interiorTex` (code mort retiré,
pas laissé en place). Une texture déjà stockée en base par un mur jamais retouché depuis reste lue et rendue
normalement (`roomsWallSegments` ne change pas) — seule une **nouvelle** écriture d'apparence la purge désormais,
quel que soit le chemin emprunté. Testé (voir 10d).

**`[VÉRIFIÉ]` bug isolé, non corrigé, sans ambiguïté de conception** : après une pose de salle réussie en mode
« Ajouter une salle », `SurfaceEditorScene.jsx` force `mode: 'select'` (~ligne 1186-1198) au lieu de rester en
création — confirme le constat de Saar au §9. Pas touché ce tour (un problème à la fois, le garde-fou porte était
prioritaire car déjà entièrement qualifié) ; bon candidat pour la prochaine passe, mécanique et sans risque.

### 10c. Poignée de redimensionnement — EXIGENCE CONFIRMÉE de Saar, pas une option à arbitrer

**Saar (2026-09-29, en réaction à une confusion pendant le rework de ce document) : « je la veux cette
poignée ! »** — la poignée est une fonctionnalité demandée, complémentaire de la peinture/effacement de cases
(§8), pas une piste à évaluer puis potentiellement écarter au profit de Plan B. Rapide/gros (poignée) vs
fin/détail (cases) : deux outils qui coexistent, ni l'un ne remplace l'autre. À ne jamais retirer du périmètre
sans que Saar le demande explicitement.

Le geste actuel (`reshape-room`, §8) traduit déjà tout glissé en un lot de cases via
`classifyRoomFootprintCells`/`paintRoomFootprintCells`, avec aperçu case par case en direct — la case reste la
seule donnée réellement écrite. Rien dans le code lu ne interdit qu'une poignée soit une **deuxième interaction**
au-dessus du même pipeline (elle produirait, elle aussi, un lot de cases à ajouter/retirer) : dans ce cas elle ne
réintroduit pas le problème d'identité de mur qui avait fait abandonner Lot B au §8, puisqu'aucune position de mur
ne serait manipulée directement. Le risque à éviter explicitement si ce chantier est repris : que la poignée en
vienne à manipuler une géométrie de mur (`wall.from`/`wall.to`) plutôt que de traduire son geste en cases — exactement
l'erreur du 28/09. Pas assez creusé pour dire si « rapide/gros » vs « fin/détail » exige deux mécanismes de calcul
distincts ou juste deux interactions différentes au-dessus de la même opération de données (`classifyRoomFootprintCells`) ;
non commencé, en attente d'une décision sur l'ordre des chantiers.

### 10d. Ce qui a été codé ce tour

1. **Garde-fou porte** ajouté à `applyRoomWallAppearance` (`surfaceRooms.js`), symétrique à
   `applyRoomWallElevationProfile`/`applyRoomBoundaryArc` : peindre un mur qui porte une porte est refusé avec le
   même message d'erreur (« Déplace ou supprime la porte avant de peindre ce mur. »), qu'on passe par le panneau
   flottant Mur ou par l'outil sidebar « Peindre un mur » (`paintRoomWallEdges` route par la même fonction).
2. **Autorité unique sur `interiorTex`** : `applyRoomWallAppearance` force désormais `interiorTex: null`
   inconditionnellement (voir 10b) ; `SurfaceWallPanel.jsx` ne calcule/transmet plus cette valeur morte.

Trois tests ajoutés dans `surfaceData.test.mjs` (deux garde-fou porte, un pour l'autorité `interiorTex` côté
`applyRoomWallAppearance`, sur le même patron que les tests existants pour l'élévation/l'arc/Option 2).
**Testé** : `node --test client/src/lib/surfaceData.test.mjs` → 49/49 (46 existants + 3 nouveaux), `node --check`
et `npx eslint` propres sur les trois fichiers touchés (`surfaceRooms.js`, `surfaceData.test.mjs`,
`SurfaceWallPanel.jsx`), `npm run build` (client) propre. Pas encore confirmé par Saar en navigateur.
Détail des fichiers et du test dans l'historique de commit à venir (pas encore commité — Saar commit après
confirmation fonctionnelle, per `AGENTS.md`).

### 10e. Suite le même jour — Saar rapporte trois blocages de test, deux corrigés

Saar tente de tester et rapporte ne pas pouvoir : « lorsque je sélectionne une couleur, tout ce que je viens de
peindre change de couleur » **avant même de cliquer** sur un mur. Ce détail (« avant même de cliquer ») élimine
mes deux pistes du 10a (fusion de tronçon, réfutée ; garde-fou porte, sans rapport) et en désigne une nouvelle,
vérifiée par lecture de code, pas supposée :

**`[VÉRIFIÉ]` cause trouvée et corrigée** : le panneau flottant Mur (sélection classique, pas l'outil sidebar
« Peindre un mur ») applique la couleur **en direct sur toute la sélection courante**, à chaque tick du curseur
de couleur, sans aucun clic de confirmation (`SurfaceMaterialEditor` → `patchAppearance` → `onAppearanceChange`
→ `applyRoomWallAppearance` immédiatement, `Editor3D.jsx:1351`) — comportement déjà établi, cohérent avec
l'élévation et l'arc dans le même panneau, pas une anomalie en soi. Le vrai problème : la sélection de murs
(`handleRoomWallPointerSelect`, `SurfaceEditorScene.jsx`) **s'accumulait silencieusement à chaque clic** — cliquer
un mur puis un autre ajoutait le second à la sélection au lieu de remplacer le premier, sans jamais se
réinitialiser tant qu'on reste sur la même salle (contrairement à la sélection de salle, qui remplace toujours).
Cliquer sur plusieurs murs l'un après l'autre pour les regarder, puis ajuster la couleur, repeignait donc
d'un coup tout ce qui avait été cliqué depuis, sans qu'aucun clic de peinture n'ait jamais eu lieu — correspond
exactement au symptôme. Corrigé : un clic simple remplace désormais la sélection par ce seul mur (même
convention que la sélection de salle) ; Maj-clic garde l'ancien comportement d'ajout/retrait pour une vraie
sélection multiple délibérée.

**`[HYPOTHÈSE]` non retenue à corriger, à confirmer par Saar** : le bouton « Sélectionner tous les murs »
(`SurfaceWallPanel.jsx`) sélectionne délibérément tous les edgeKeys de la salle en un clic (pas via
`paintRoomWallRoom`/portée Salle du pinceau sidebar — ce bouton passe par `applyRoomWallAppearance` avec une
liste d'edgeKeys qui couvre tout, un mécanisme différent qui produit un résultat visuel similaire). Si Saar
l'utilise pour « regarder » la salle puis ajuste la couleur en oubliant que la sélection couvre tout, le même
symptôme se reproduirait — mais ce chemin fait ce qu'il annonce (sélectionner tout, puis éditer tout) : pas
touché, pas un bug en soi. À confirmer si le correctif ci-dessus ne suffit pas.

**`[VÉRIFIÉ]` deuxième blocage corrigé** : « les murs invisibles » — `useOccludedWallIds`
(`SurfaceDungeonScene.jsx`) fait disparaître (opacité 0.18) les murs entre la caméra et la pièce visée, une
fonctionnalité de confort en jeu (`Canvas3D.jsx`, comportement inchangé, toujours actif) mais qui gênait le
clic/la vue en édition. `SurfaceDungeonScene` est aussi monté deux fois dans l'éditeur — une fois par
`Editor3D.jsx` (onglet Objets 3D, fond de scène) et une fois par `SurfaceEditorScene.jsx` (onglet Structure, où
se fait la peinture) : les deux avaient besoin du correctif. Nouveau prop `wallOcclusionEnabled` (défaut `true`,
comportement inchangé partout ailleurs), désactivé explicitement aux deux points d'appel de l'éditeur.

**`[NON TRAITÉ]` troisième blocage, déjà signalé au §9, pas retouché ce tour** : devoir repasser par Sélection →
cliquer la nouvelle salle → recliquer « Peindre un mur » pour changer de salle en cours de peinture. Toujours un
vrai sujet, pas mécanique comme les deux ci-dessus — nécessite de revoir comment le mode paint-wall change de
salle cible, hors périmètre de ce tour (un problème à la fois).

**Testé** : `node --check`, `npx eslint` (`SurfaceEditorScene.jsx`, `SurfaceDungeonScene.jsx`, `Editor3D.jsx`)
et `npm run build` (client) propres ; `node --test client/src/lib/surfaceData.test.mjs` → 49/49 (inchangé, ces
correctifs touchent des gestionnaires d'événements r3f/React, aucun test pur possible).

**`[VÉRIFIÉ EN JEU]` (Saar, 2026-09-29)** : « Résolution du problème des murs non modifiables. Bien joué » —
confirme que le correctif de sélection (10e) explique et corrige bien le constat brut du §9 (« certains murs
refusent toute modification, sans logique identifiable » — non pas un blocage réel, mais l'effet visible d'une
sélection accumulée puis écrasée par le curseur de couleur). Referme ce point précis du §9. Les points de flux
du §9 non couverts ici (fenêtre qui se ferme, changer de salle en cours de peinture) restent ouverts.

## 11. World Builder v2 — rework de la coquille d'interaction (stub, cadrage à peine commencé)

> Nouvelle phase de CE chantier, pas un document séparé (Règle 2 — une information = un seul endroit ; la
> tentative initiale de créer `PLAN_WORLD_BUILDER_V2.md` à côté a été corrigée le même jour, cf. Historique).
> Zéro code, zéro décision figée au-delà du périmètre ci-dessous.
>
> **`[TRANCHÉ PAR SAAR]` (2026-09-30) : stratégie strangler fig (§11.0) abandonnée, confirmée par Saar
> (« Je confirme, pas de strangler fig »).** Constat qui a motivé la question : aucune coquille « v2 »
> séparée n'a jamais existé dans les faits — tout ce qui a été livré depuis ce §11 (poignée §10c, dock fixe
> §12.10 point 4, motifs importés §14, pile d'annulation §12.10 point 5, refonte du panneau Salle §13.6) a
> été codé **directement dans les fichiers existants**, jamais dans une coquille neuve à côté ; l'ambition
> initiale de reconstruire à côté n'a en réalité jamais été suivie. §11.5 (stratégie de coexistence v1/v2)
> devient sans objet pour la même raison — il n'y a qu'un seul éditeur, toujours en fonctionnement. Nouvelle
> direction : décomposition en place, un fichier par responsabilité, un mode à la fois, au même rythme
> incrémental déjà validé six fois par Saar en navigateur — inspirée du pattern `StateNode` de tldraw
> (éditeur canvas React open source, 45k+ étoiles : chaque outil est son propre dossier, chaque état de cet
> outil son propre fichier — voir `SelectTool.ts`/`childStates/` sur `github.com/tldraw/tldraw`), pas de
> nouvelle dépendance (pas XState). Le reste de ce §11 (recherche §11.6.1, audit §11.6.2) reste valide et
> sert de matière à la suite ; seule la stratégie de coexistence change.

### 11.0. Déclencheur (Saar, 2026-09-29, run à vide de bilan)

> « L'architecture actuelle de l'éditeur est une usine à gaz. On voulait de toute manière un gros rework pour
> régler ce problème de fichier volumineux et à multi-responsabilités. Ma proposition : on reconstruit le
> World Builder v2 à côté, à partir de modules nouveaux ou remaniés proprement, sur la base d'un cahier des
> charges sain et robuste. On ne détruit pas l'ancien — on le garde jusqu'à ce qu'il nous emmerde ou fin de
> chantier validé pour le chantier 2. »

Analogie de Saar : reprendre les briques saines d'un immeuble qui menace de s'effondrer pour reconstruire
proprement à côté, sans démolir l'existant avant que le neuf soit prêt.

**Recherche faite avant d'accepter la proposition telle quelle** (Claude, même session) :
- **Strangler Fig Pattern** (Martin Fowler / Azure Architecture Center / Wikipedia) — construire le nouveau à
  côté, l'ancien continue de tourner, migration incrémentale, chaque étape réversible et livre de la valeur.
  Exactement le patron que décrit Saar, confirmé comme la stratégie la plus sûre pour moderniser un système qui
  fonctionne mais pèse.
- **Second-system effect** (Fred Brooks, *The Mythical Man-Month* ; Wikipedia ; Albright Labs) — risque inverse
  documenté : un premier système qui marche est souvent suivi d'un second sur-conçu parce qu'on reconstruit « en
  pensant à tout » plutôt qu'en résolvant ce qui fait mal aujourd'hui. Garde-fou retenu pour ce chantier :
  **nommer le problème actuel précis avant toute abstraction ; si la seule justification d'une abstraction est
  « ça pourrait servir plus tard », s'arrêter.**

**Accord de Saar sur le recadrage proposé** (« Ok pour moi ») : ce rework touche la **coquille d'interaction**
de l'éditeur (machine à états des outils, gestion des panneaux, patron de sélection/édition) — **pas** le
modèle de données, le compilateur, l'autorité géométrique ni le rendu 3D partagé, vérifiés solides et flexibles
dans ce même document pour ce qui a été testé (§7 : L/T/U/trous/multi-niveau déjà supportés sans code ; §10a :
résolution d'apparence par case correcte pour un mur droit sans arc, vérifiée par script jetable — **le cas
avec coin arrondi n'est pas retesté, cf. réserve du §11.1**).

### 11.1. Ce qui est repris tel quel (briques saines, jamais réécrites par ce chantier)

- **Modèle de données** : `surface_data` / `surfaceData.rooms[]` — canonique, inchangé.
- **Compilateur** : `shared/world/worldCompiler.js` — produit le `WorldSnapshot`, autorité unique spatiale
  (`.claude/rules/world.md`), inchangé.
- **Autorité géométrique** : `shared/world/roomGeometry.js` (`roomBoundaryEdges`, `roomBoundaryWallRuns`,
  `roomSelectableWallRuns`, arcs, contours) — vérifié empiriquement (§7) comme supportant déjà
  L/T/U/trous/îlots/multi-niveau sans changement de code.
- **Fonctions de mutation** : `client/src/lib/surfaceRooms.js` (`paintRoomFootprintCells`,
  `paintRoomWallEdges`, `applyRoomWallAppearance`, `applyRoomBoundaryArc`, etc.) — logique métier déjà
  correcte et testée (49 tests purs, `surfaceData.test.mjs`), garde-fous portes/mitoyens/îlots déjà en place.
- **Rendu 3D** : `client/src/components/SurfaceDungeonScene.jsx` + `client/src/lib/roomWalls.js` — partagé avec
  le mode jeu (`Canvas3D.jsx`), vérifié correct au niveau donnée pour un mur droit sans arc (§10a).

**`[RÉSERVE]` avant de considérer cette brique comme définitivement saine** : la cause de « la couleur écrase
tout » reste `[INCONNU]` (§10a), et le candidat de tête non testé est précisément un mur avec coin arrondi —
c'est-à-dire potentiellement **cette même brique** (`roomGeometry.js`/`roomWalls.js`), pas la coquille
d'interaction. Si l'audit (§11.6 point 2) ou une reproduction de Saar confirme que la cause vit dans le rendu
partagé plutôt que dans l'interaction, ce n'est plus une brique à reprendre telle quelle sans réserve : la
corriger passerait avant de la considérer figée pour v1 et v2 à la fois.

**`[TRANCHÉ PAR SAAR]` (2026-09-30) : réserve levée, n'est plus d'actualité.** Pas une preuve technique que
la cause vit bien dans l'interaction plutôt que dans le rendu partagé — la cause reste `[INCONNU]` au sens
strict, jamais reproduite ni écartée par script. C'est une décision de Saar de ne plus la traiter comme un
préalable bloquant à la refonte (§11.6 point 5 retiré de la méthode, ne fait plus partie du plan de cadrage).

**v1 et v2 écrivent et lisent exclusivement via ces mêmes fonctions** — aucun risque de divergence sur le
document canonique pendant la coexistence, par construction (invariant 3 d'`AGENTS.md` : une autorité unique).

### 11.2. Ce qui est reconstruit (la coquille, périmètre réel de ce chantier)

- `client/src/components/Editor3D.jsx` (1581 lignes, vérifié `wc -l` le 2026-09-29)
- `client/src/components/SurfaceEditorScene.jsx` (1485 lignes, vérifié `wc -l` le 2026-09-29)
- `client/src/components/SurfaceEditorPanel.jsx` (1347 lignes, vérifié `wc -l` le 2026-09-29)
- Panneaux flottants associés (`SurfaceRoomPanel.jsx`, `SurfaceWallPanel.jsx`, `SurfaceConnectorPanel.jsx`,
  `SurfaceEffectPanel.jsx`) — à réévaluer un par un, pas supposés tous à refaire.

**La poignée de redimensionnement (§10c) fait partie du périmètre de cette coquille à reconstruire** — c'est
une interaction que le v1 actuel n'a jamais eue proprement (abandonnée au §8 pour une raison d'implémentation,
pas de besoin), donc un candidat direct pour la nouvelle machine à états d'outils plutôt qu'un ajout après
coup. Exigence confirmée de Saar (§10c), pas une option que le cadrage pourrait écarter.

Dette déjà nommée avant ce chantier (`PLAN_EDITEUR_CARTE.md` Phase 2, reportée plusieurs fois depuis 2026-08,
notamment par Saar lui-même après Plan B — voir §8 ci-dessus) — cette section 11 la reprend avec un scope plus
large (rework, pas simple refactor) plutôt que la recopier.

### 11.3. Problèmes réels déjà observés — la matière du cahier des charges (pas de besoins imaginés)

Recensés en lisant le code réel cette session (peinture de mur, §10/10e ci-dessus), pas supposés :

1. **Duplication d'autorité sur une même donnée** (§10b) : deux chemins d'interface écrivaient
   `wallAppearanceProfiles` avec des règles différentes avant correction du 2026-09-29. Trouvé en creusant un
   seul symptôme, sur une seule donnée. `[HYPOTHÈSE]` non vérifiée : d'autres occurrences similaires pourraient
   exister ailleurs dans l'éditeur — aucune recherche systématique menée, aucune autre trouvée à ce stade. C'est
   l'objet de l'audit du §11.6 point 2, pas une affirmation.
2. **Deux patrons d'interaction concurrents pour la même intention** (« changer l'apparence d'un mur ») : clic
   direct sur le mur (outil pinceau, portée choisie à l'avance) vs sélection multi-mur en mode Sélection puis
   édition dans un panneau flottant. Aucune règle ne dit laquelle est la référence.
3. **Couplage mode + sélection + ouverture de panneau** qui rend indiscernable de l'extérieur un changement
   « petit » d'un changement « gros » — cas vécu : « Ajouter une salle qui ne reste pas actif » (§9/§10b)
   semblait mécanique, s'est avéré coupler trois responsabilités.
4. **Application en direct sans regroupement** (§10e) : chaque tick d'un curseur (matériau, profil
   d'élévation) déclenche à la fois une sauvegarde réseau et une entrée dans la pile d'annulation (49
   emplacements) — un seul geste de réglage peut à lui seul saturer l'historique d'annulation.
5. **Composant de rendu partagé jeu/édition sans convention explicite** (§10e) : `SurfaceDungeonScene.jsx` sert
   les deux publics ; l'occlusion de mur face caméra, pensée pour le confort du joueur, a fui silencieusement
   dans l'éditeur jusqu'à devenir bloquante pour la peinture — pas de garde-fou structurel qui empêche la
   récidive avec la prochaine fonctionnalité de ce genre.
6. **Fichiers à responsabilités multiples non séparées** (§11.2) — chaque nouvelle fonctionnalité (Plan B, Lot
   A, zones dangereuses) est arrivée dans le même monolithe faute de refactor préalable, aggravant la dette à
   chaque itération plutôt que de la stabiliser.

### 11.4. Explicitement hors périmètre de ce chantier

- Les mécaniques de jeu qui consomment l'éditeur (zones dangereuses, portes, décals, matériaux procéduraux) —
  chacune son propre plan, référencées une fois dans `PLAN_EDITEUR_CARTE.md` §0, pas reprises ici.
- Le modèle de données, le compilateur, le rendu 3D partagé (§11.1) — sujets seulement si un besoin **réel et
  nommé** apparaît en cours de cadrage, jamais par anticipation. Un candidat nommé existe déjà pour le rendu 3D
  partagé (réserve du §11.1, cause encore `[INCONNU]` du §10a) — pas hors périmètre par anticipation, mais pas
  encore confirmé non plus.
- Toute abstraction dont la seule justification serait « plus flexible pour plus tard » (garde-fou second-
  system effect, §11.0).

### 11.5. Stratégie de coexistence — à cadrer, rien de tranché

Questions ouvertes, aucune réponse encore :
- Comment un MJ bascule entre v1 et v2 dans l'interface (sélecteur explicite ? v2 comme nouvel onglet à côté de
  Structure/Objets 3D/Zones dangereuses ? battlemap de test dédiée avant bascule réelle) ?
- Jusqu'à quand v1 reste maintenu en parallèle (« jusqu'à ce qu'il nous emmerde », dixit Saar) — pas de critère
  objectif fixé pour l'instant.
- Les correctifs trouvés sur v1 pendant la coexistence (comme ceux du 2026-09-29, §10/10e) continuent-ils
  d'être portés sur v1, ou v1 est-il gelé au comportement actuel dès que le cadrage v2 démarre réellement ?
- **Coordination avec les autres sessions déjà actives sur ce même périmètre** : cette même conversation a
  trouvé, avant de commiter le travail du 2026-09-29 (§10/10e), qu'une autre session (« RW_FORMES SALLES »,
  identifiée via `ListAgents`) avait laissé un gros volume de travail non commité sur `surfaceRooms.js`/
  `SurfaceEditorScene.jsx` — exactement les fichiers que ce chantier v2 va reconstruire. Pas de protocole écrit
  pour éviter qu'une session démarre v2 en parallèle d'une autre qui modifie encore v1 sur les mêmes fichiers.

### 11.6. Méthode et prochaines étapes

Avant tout plan de code, dans l'ordre :
1. **Recherche pro** sur les patrons d'éditeurs 3D comparables — **fait, voir 11.6.1**.
2. **Audit** : les autres duplications d'autorité potentielles dans l'éditeur (§11.3 point 1) — **fait, voir
   11.6.2**.
3. **Décision du patron d'interaction unique** pour « sélectionner puis éditer » (§11.3 point 2), présentée et
   tranchée par Saar avant tout code — même méthode que celle qui a fonctionné pour Plan B (§8). **Question
   concrète posée en 11.6.2, en attente de la décision de Saar.**
4. **Cadrage de la coexistence** (§11.5) — tranché par Saar, pas déduit techniquement seul.
5. ~~Lever la réserve du §11.1 sur le rendu 3D partagé.~~ **`[TRANCHÉ PAR SAAR]` (2026-09-30) : retiré de la
   méthode, n'est plus d'actualité — voir la note de fermeture au §11.1.**

Points 3 et 4 restent ouverts, en attente de décision de Saar ou d'investigation dédiée (le point 3 a peut-être
été répondu de fait par la règle verbe/nom du §13.1 — peindre un mur garde ses deux chemins, sidebar « geste
rapide » et panneau « réglage précis », tant que les deux écrivent via la même fonction d'autorité ; jamais
recroisé explicitement avec cette question, à confirmer avant de le rayer pour de bon). Cette section fixe le
périmètre et le garde-fou (second-system effect) ; les points 1 et 2 apportent maintenant une matière concrète,
pas encore un plan de code actionnable.

#### 11.6.1. Recherche pro — trois patrons directement transposables

**Éditeur three.js (`mrdoob/three.js`, `editor/js/`)** — la référence la plus proche : même moteur de rendu que
Enclume, un éditeur 3D en production depuis des années.
- `Editor.js` = état canonique unique + bus de signaux (pub/sub) que les panneaux UI écoutent, jamais une
  copie locale de l'état — même invariant que la règle 3 d'`AGENTS.md` (autorité unique), déjà respecté côté
  `surfaceRooms.js`/`surfaceData` pour Enclume, mais pas côté état d'interaction (mode/sélection).
- **Une classe par opération** (`editor/js/commands/` : `SetMaterialColorCommand.js`, `SetPositionCommand.js`,
  `MoveObjectCommand.js`, 25 fichiers, un par intention métier) plutôt qu'un réducteur ou un fichier
  monolithique — répond directement à `[OBSERVÉ]` §11.3 point 6 (fichiers à responsabilités multiples) : la
  dette d'Enclume vient de ce que *toute* la logique d'interaction (mode, sélection, callbacks de panneau) vit
  dans 2-3 fichiers de 1300-1600 lignes au lieu d'une unité par opération.
- **`History.js` fusionne les commandes continues au lieu de les empiler** `[VÉRIFIÉ]` (lecture directe du
  code source, `raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/History.js` et
  `commands/SetMaterialColorCommand.js`) : chaque commande porte un flag `updatable` ; une nouvelle commande
  du même type, sur le même objet/attribut, dans les 500 ms de la précédente, appelle `lastCmd.update(cmd)`
  (qui ne fait que remplacer `newValue`) au lieu de pousser une nouvelle entrée d'historique — un curseur de
  couleur glissé en continu ne produit qu'**une** entrée d'annulation, pas une par tick. Réponse directe et
  sourcée à `[OBSERVÉ]` §11.3 point 4 (49 emplacements d'annulation saturés par un seul réglage continu) :
  Enclume n'a pas besoin d'inventer ce mécanisme, juste de reprendre `updatable` + fenêtre de fusion par
  (salle, opération, clés d'arête) sur sa propre pile d'undo.

**Machines à états explicites pour le mode/outil (XState, cité par plusieurs sources convergentes :
`mastery.games`, `hackernoon.com`, `telerik.com`)** — le patron professionnel documenté pour « un composant a
un jeu fini d'états exclusifs, chacun avec ses transitions valides » (dropdown fermé/ouvert/sélectionné cité en
exemple direct, mais le principe est générique). Répond à `[OBSERVÉ]` §11.3 point 3 (couplage mode + sélection
+ panneau indiscernable de l'extérieur, cause du bug « Ajouter une salle » qui ne reste pas actif, §10b) : au
lieu d'un `mode: 'select' | 'paint-wall' | 'reshape-room' | …` en `useState` réassigné à la main à N endroits
différents dans `SurfaceEditorScene.jsx`/`Editor3D.jsx` (dont un oubli confirmé, §10b), une machine à états
déclare une fois pour toutes quelles transitions existent (ex. : `pose-salle → pose-salle` autorisée après une
pose réussie, pas `pose-salle → select` implicite) — le bug devient une transition absente à ajouter, pas un
`setMode('select')` à retrouver dans le code.

**Ce que la recherche ne tranche pas** : aucune source trouvée ne documente un patron consacré pour découpler
« sélection courante » de « outil actif » (§11.3 point 2, clic direct du pinceau vs sélection puis panneau) —
voir 11.6.2 ci-dessous, la réponse est venue de l'audit du code réel d'Enclume, pas de la recherche externe.

Sources : [Editor: UI panels idea — issue #5949](https://github.com/mrdoob/three.js/issues/5949) ·
[three.js/editor (dev)](https://github.com/mrdoob/three.js/tree/dev/editor) ·
[Visual Editor — DeepWiki mrdoob/three.js](https://deepwiki.com/mrdoob/three.js/6.1-visual-editor) ·
[History.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/History.js) ·
[commands/SetMaterialColorCommand.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/commands/SetMaterialColorCommand.js) ·
[State Machines in React — mastery.games](https://mastery.games/post/state-machines-in-react/) ·
[Upgrade your React UI with state machines — HackerNoon](https://hackernoon.com/upgrade-your-react-ui-with-state-machines-30d1298e90be) ·
[How to Use Finite State Machines in React — Telerik](https://www.telerik.com/blogs/how-to-use-finite-state-machines-react).

#### 11.6.2. Audit — la duplication n'est pas systémique, elle suit un vrai clivage structurel

**`[VÉRIFIÉ]` par grep direct sur `surfaceRooms.js` et ses appelants (2026-09-29)**, pas supposé : les quatre
opérations de mur citées au §10a (appearance/arc/élévation/peinture) n'ont **pas** toutes deux chemins
d'écriture.
- `applyRoomBoundaryArc` et `applyRoomWallElevationProfile` n'ont **qu'un seul appelant produit dans le
  client** : `Editor3D.jsx` (le panneau flottant Mur, après sélection classique). Aucun outil sidebar
  équivalent n'existe pour arrondir un coin ou régler une élévation directement au clic.
- `applyRoomWallAppearance`, elle, a **deux** appelants distincts : `Editor3D.jsx` (même panneau flottant) ET
  `paintRoomWallEdges`/`paintRoomWallRoom` (`surfaceRooms.js`, appelées depuis l'outil sidebar « Peindre un
  mur »), qui l'invoquent chacune avec des règles différentes avant la correction du §10b.

**Conclusion argumentée** : la duplication d'autorité trouvée au §10b n'est pas un symptôme répandu dans tout
l'éditeur (`[HYPOTHÈSE]` du §11.3 point 1 maintenant testée, réfutée en tant que risque systémique) — elle est
la conséquence mécanique d'un seul fait structurel, exactement celui identifié à la fin de 11.6.1 : **la
peinture est aujourd'hui la seule opération de mur qui a à la fois un outil sidebar « clic direct » ET un
chemin panneau flottant « sélectionner puis éditer »**, donc la seule à pouvoir diverger entre deux chemins.
Arc et élévation n'ont pas ce risque aujourd'hui simplement parce qu'ils n'ont qu'un chemin — pas parce qu'ils
seraient mieux conçus.

**Question concrète pour la décision du point 3 (patron d'interaction unique), à trancher par Saar avant tout
code de la coquille v2** : plutôt que choisir dans l'abstrait entre « clic direct » et « sélection puis panneau »,
la vraie question posée par cet audit est **est-ce que chaque opération de mur (peindre, arrondir, élever)
doit offrir les deux mêmes chemins de façon cohérente, ou seule la peinture en a-t-elle vraiment besoin (geste
rapide et répétitif) alors qu'arc/élévation restent des réglages ponctuels qui n'ont jamais réclamé de raccourci
direct** ? Dans les deux cas, la coquille v2 ne doit garder qu'**une seule fonction d'application par donnée**
(ce qui existe déjà, `applyRoomWallAppearance` etc.) — la question ne porte que sur le nombre de chemins
d'interaction qui peuvent y mener, pas sur l'autorité elle-même.

### 11.7. Décomposition en un fichier par responsabilité — étape 1, nettoyage préparatoire (2026-09-30)

Inventaire factuel complet des 12 modes fait par un agent dédié (rapport intégral non recopié ici, deux
affirmations fortes vérifiées à la main avant d'agir : mode `ceiling` jamais déclenché par aucun bouton —
confirmé sur tout l'historique git de `SurfaceEditorPanel.jsx` — et `wall-reshape` qui ne touche jamais
`surfaceTool.mode`, confirmé par grep). Trois trouvailles, corrigées ici (étape 1 de l'ordre retenu, avant
l'extraction du moteur commun) :

- **Mode `ceiling` : question posée à Saar avant de coder** (« c'est un reliquat de Kiwi v1, je ne sais pas à
  quoi ça sert, on l'a remplacé/fait mieux ? »). Vérifié avant de répondre : `surface.ceilings` (la donnée que ce
  mode aurait écrite) est réelle et utilisée — `worldCompiler.js` (`roomCeilingEntries`) la lit comme couche
  manuelle qui prime sur le plafond auto-généré de chaque salle ; équivalent, pour un plafond, de ce que
  « Passerelle » fait déjà pour un sol (poser une dalle hors de toute salle). Seul le bouton éditeur n'a jamais
  été branché, depuis l'origine — **`[TRANCHÉ PAR SAAR]` : abandon, aucun intérêt.** Retiré : la branche
  `applyCeilingSelection` du switch de pose (`SurfaceEditorScene.jsx`), le composant `CeilingPreview` et son
  rendu, la branche de hint morte (`SurfaceEditorPanel.jsx`), la fonction `applyCeilingSelection`
  (`surfaceData.js`) et `getToolCeilingHeight` (`surfaceCore.js`, plus son import/ré-export devenus inutiles),
  le défaut `ceilingHeight` (`SurfaceEditorPanel.jsx`/`SessionPage.jsx`, dupliqué dans les deux). **Non touché** :
  `surface.ceilings`/`worldCompiler.js`/le plafond auto-généré des salles — aucun rapport avec l'abandon, risque
  disproportionné pour un nettoyage sans impact utilisateur.
- **Double aperçu à la pose d'un connecteur** (porte/ascenseur/échelle) : le switch d'aperçu générique n'avait
  pas de branche pour `mode === 'connector'`, retombait donc sur `FloorPreview` (boîte bleue générique) qui se
  superposait au vrai `ConnectorPreview` rendu séparément. Corrigé par une branche explicite (`null`), même
  patron que `reshape-room`/`wall-reshape` qui ont déjà chacun leur aperçu rendu ailleurs.
- **Deux messages d'erreur de connecteur codés en dur en français** (`SurfaceEditorScene.jsx`, refus de pose)
  — violaient `.claude/rules/i18n.md`. `SurfaceEditorScene.jsx` n'avait d'ailleurs jamais `useTranslation`
  importé du tout. Ajouté ; deux clés neuves `surfaceEditor.connectorDoorWallError`/`connectorPlacementError`
  (`fr.json`), même texte, juste plus la source.

`npx eslint` (0 erreur, 0 avertissement neuf — un avertissement `exhaustive-deps` introduit par l'ajout de `t`
à l'effet de pose, corrigé en l'ajoutant aux dépendances), `npm run build` propre, `node --test
client/src/lib/surfaceData.test.mjs` 49/49 inchangé. **Non testé : le double-aperçu connecteur en navigateur**
(le seul des trois avec un effet visuel — poser une porte/ascenseur/échelle en glissant devrait maintenant
n'afficher qu'un seul aperçu). **`Fonctionnel` (Saar, 2026-09-30, testé en navigateur).**

### 11.8. Décomposition en un fichier par responsabilité — étape 2, début (2026-09-30)

**Ajustement de méthode présenté et validé par Saar avant de coder** : plutôt que dessiner le moteur commun
complet puis migrer les 11 outils dessus (risque de deviner une forme fausse pour des outils pas encore
vraiment touchés — le garde-fou second-system effect du §11.0), le moteur grossit **par la preuve** : un
outil à la fois, une règle commune n'est généralisée qu'une fois confirmée par un 2ᵉ/3ᵉ cas réel.

**`[CODÉ]`, comportement préservé, `⚠️ non testé en navigateur`.** Premier geste, mécanique et à faible
risque (déplacer du code déjà correct, pas le réécrire) : les 6 composants d'aperçu 3D purs de
`SurfaceEditorScene.jsx` (pilotés uniquement par leurs props, aucune fermeture sur l'état interne du
composant) extraits dans `client/src/components/surfaceTools/` — un fichier chacun (`FloorPreview.jsx`,
`RoomPreview.jsx`, `SelectionPreview.jsx`, `WallPreview.jsx`, `StairPreview.jsx`,
`EffectVolumePreview.jsx`). Comportement identique vérifié : seule différence de forme, l'alias local
`getEditPlaneY` (littéralement `getToolElevation` sans rien ajouter) inliné dans le nouveau `FloorPreview.jsx`
plutôt que réimporté depuis `SurfaceEditorScene.jsx` pour ce seul appelant — pas une simplification hors
périmètre, une conséquence directe du déplacement. Imports nettoyés en conséquence dans
`SurfaceEditorScene.jsx` (`getToolFloorThickness`, `getToolRoomHeightLevels`, `makeStairFromSelection`,
`stairStepBoxes`, `makeWallsFromDrag` : plus utilisés que par ces composants, retirés ; `getWallRenderBox`,
`STORY_HEIGHT`, `normalizeCellSelection`, `getToolElevation` : vérifiés encore utilisés ailleurs dans le
fichier, conservés). `SurfaceEditorScene.jsx` : 1550 → 1417 lignes. Laissés en place pour un tour ultérieur
(plus couplés : `ConnectorPreview` a son propre `useMemo`/état dérivé de `surfaceData`,
`RoomFootprintPaintPreview` est partagée par `reshape-room`/`wall-reshape`, deux « sous-outils » traités à
part par ce chantier, pas des outils sidebar comme les 6 extraits ici).

`npx eslint` (0 problème), `npm run build` propre, `node --test client/src/lib/surfaceData.test.mjs` 49/49
inchangé. **Testé, `Fonctionnel` (Saar, 2026-09-30).**

**Suite immédiate, même tour** : les deux composants laissés en attente ci-dessus extraits à leur tour, même
recette mécanique — `ConnectorPreview.jsx` (son `useMemo` déplacé avec lui, aucune fermeture sur l'état de
`SurfaceEditorScene.jsx`) et `RoomFootprintPaintPreview.jsx`. Imports nettoyés pareillement
(`classifyRoomFootprintCells`, `makeDoorConnectorFromWallPoint`, `makeElevatorConnectorFromCell`,
`makeLadderConnectorFromCell`, `roomsWallRenderPaths` : plus utilisés que par ces deux composants, retirés ;
`roomCellKey`, `normalizeSurfaceData`, `levelToY`, `STORY_HEIGHT` : encore utilisés ailleurs, conservés).
`SurfaceEditorScene.jsx` : 1417 → 1352 lignes (1550 lignes au départ de cette étape — 198 lignes, 8
composants d'aperçu, tous déplacés). `npx eslint` (0 problème), `npm run build` propre, 49/49 inchangé.
**Non testé en navigateur** : le sous-outil Remodeler/poignée de mur (aperçu vert/rouge) et le geste de pose
de connecteur (aperçu réel du modèle) — aucune régression attendue, code déplacé à l'identique.
**Testé, `Fonctionnel` (Saar, 2026-09-30).**

### 11.9. Décomposition — premier morceau du dispatch (registre d'application par mode, 2026-09-30)

**`[CODÉ]`, comportement préservé (test croisé), `⚠️ non testé en navigateur`.** Après les aperçus (§11.8),
premier geste sur le vrai « moteur commun » : le chaînage `mode === 'wall' ? applyWallDrag(...) : mode ===
'stair' ? ... : applyFloorSelection(...)` (fin du pointerUp générique) remplacé par un registre mode→fonction,
`client/src/lib/surfaceTools/applyToolMode.js` : `applyToolMode(mode, surfaceData, drag, tool, activeMaterial,
availableBlocks)`. Couvre seulement `wall`/`stair`/`bridge`/`erase` + le repli `applyFloorSelection` — les
seuls modes qui partageaient déjà ce chaînage sans effet de bord annexe. `select`/`room`/`connector`/`effect`/
`reshape-room`/`wall-reshape`/`paint-wall` gèrent chacun panneaux/hover/clés d'arête en plus d'un simple calcul
de `nextData` (branches `if (mode === X) { ...; return }` plus haut dans le même handler) — pas dans ce
registre, laissés tels quels pour un tour ultérieur, un outil à la fois.
- Petite adaptation de signature actée dans le registre, pas cachée : `applyWallDrag` prend `(start, end)`
  séparément (pas un objet `drag`) — enveloppé dans une fonction d'un ligne qui déballe `drag.start`/
  `drag.end`, comportement identique. `eraseSurfaceSelection` ignore `activeMaterial`/`availableBlocks` —
  la signature commune du registre les lui passe quand même, sans effet (elle ne les lit jamais).
- **Test croisé neuf** (`applyToolMode.test.mjs`, 5 tests) : pour chaque mode, vérifie que passer par le
  registre produit un résultat `deepEqual` à l'appel direct de la fonction d'origine avec les mêmes
  arguments — preuve que l'adaptation de signature ne change rien, pas seulement supposée.
- `SurfaceEditorScene.jsx` : 1352 → 1340 lignes. `npx eslint` (0 problème), `npm run build` propre, `node
  --test client/src/lib/surfaceData.test.mjs client/src/lib/surfaceTools/applyToolMode.test.mjs` 54/54.
  **Testé, `Fonctionnel` (Saar, 2026-09-30).**

### 11.10. Décomposition — pause de réflexion demandée par Saar, puis lecture complète avant code (2026-09-30)

Saar, après §11.9 : « pause de réflexion avant de continuer. Tu ne peux coder que si et seulement si tu es
sûr à 100 % » — pas une simple formule, prise au sens littéral. Plutôt que proposer un découpage pour les 7
branches restantes (`select`/`room`/`connector`/`effect`/`reshape-room`/`wall-reshape`/`paint-wall`) à partir
de ce qui avait déjà été lu (seulement leurs `pointerUp`), lecture complète de `pointerDown`/`pointerMove`/
`pointerUp` faite avant tout code, un outil à la fois — confirmé par lecture, pas supposé : **Zone d'effet**
n'a aucun cas spécial ni en `pointerDown` ni en `pointerMove` (chemin par défaut, `getFloorCell`, comme la
plupart des modes) ; seul `pointerUp` a une branche propre. Aucune interdépendance cachée avec un autre mode.

**`[CODÉ]`, comportement préservé (test unitaire), `⚠️ non testé en navigateur`.** Même patron que §11.9
(garder les effets de bord en place, extraire seulement le calcul pur) : `buildEffectVolumePayload(drag,
tool)` (`client/src/lib/surfaceTools/buildEffectVolumePayload.js`) construit le payload ; `onRuntimeEffect
Create`/`setHoverPreview(null)`/`preventDefault`/`stopPropagation` restent dans `SurfaceEditorScene.jsx`
(callbacks/refs du composant, n'ont pas leur place dans une fonction pure). 3 tests neufs (valeurs
explicites, défauts, sélection nulle). `SurfaceEditorScene.jsx` : 1340 → 1327 lignes `[CORRIGÉ]` — voir la
note de fin de §11.14, le chiffre d'origine (1244) était faux, mesuré avec un outil PowerShell peu fiable.
`npx eslint` (0
problème), `npm run build` propre, `node --test client/src/lib/surfaceData.test.mjs
client/src/lib/surfaceTools/applyToolMode.test.mjs client/src/lib/surfaceTools/buildEffectVolumePayload.test.mjs`
57/57. **Testé, `Fonctionnel` (Saar, 2026-09-30).**

### 11.11. Décomposition — Salle (rien à faire) et dispatch pur du Connecteur (2026-09-30)

Lecture complète (pointerDown/pointerMove/pointerUp) faite avant tout code pour Salle, Connecteur,
Remodeler et la poignée de mur, comme annoncé.

- **Salle : rien à extraire, constat pas un correctif.** `pointerDown`/`pointerMove` suivent le chemin par
  défaut (aucun cas spécial) ; `pointerUp` n'a que 4 lignes de glue (appel à `applyRoomSelectionWithResult`,
  déjà une fonction pure de `surfaceRooms.js` — donc déjà « un fichier, une responsabilité » à ce niveau —
  puis sauvegarde + `preventDefault`/`stopPropagation`). Créer un fichier ici aurait été de l'abstraction
  sans besoin réel (garde-fou §11.0).
- **Connecteur : `[CODÉ]`, comportement préservé (test croisé), `⚠️ non testé en navigateur`.** Seul le
  dispatch pur (porte/ascenseur/échelle → quelle fonction `apply*Connector` appeler) extrait —
  `computeConnectorPlacement(surfaceData, dragEnd, tool)`
  (`client/src/lib/surfaceTools/computeConnectorPlacement.js`). Tout le reste reste dans
  `SurfaceEditorScene.jsx`, propre au composant et pas mécaniquement séparable sans y toucher : le message
  d'erreur traduit, la remise à zéro de `connectorWallEdgeKeys`, et surtout les deux points de
  `preventDefault`/`stopPropagation` différents selon succès/échec (trouvés en lisant, pas supposés
  identiques). Le clic sans point valide en `pointerDown` (garde une porte de démarrer un glissé fantôme) et
  l'aperçu au survol en `pointerMove` (`hoverPreview`) sont, eux, intégrés au moteur générique de
  glisser-déposer partagé par plusieurs modes — pas extraits, un sujet à part.
  - Test croisé neuf (3 tests) : chaque `connectorType` (et le repli implicite sur ascenseur) produit un
    résultat `deepEqual` à l'appel direct de la fonction d'origine.
  - `SurfaceEditorScene.jsx` : 1327 → 1318 lignes `[CORRIGÉ]` (idem, voir §11.14). `npx eslint` (0 problème), `npm run build` propre, `node
    --test client/src/lib/surfaceData.test.mjs client/src/lib/surfaceTools/applyToolMode.test.mjs
    client/src/lib/surfaceTools/buildEffectVolumePayload.test.mjs
    client/src/lib/surfaceTools/computeConnectorPlacement.test.mjs` 60/60. **Testé, `Fonctionnel` (Saar,
    2026-09-30).**

### 11.12. Décomposition — Sélection et Remodeler, Mur/wall-reshape confirmés déjà factorisés (2026-09-30)

Saar : « arrête de bloquer juste pour que je te dise ok toutes les deux actions... tu avances à ton rythme,
prends des pauses dès que tu estimes cela pertinent » — enchaîné sans repasser par une validation à chaque
fichier, la méthode elle-même restant celle déjà validée (lecture complète avant code, un outil à la fois,
test croisé, cross-check contre le comportement d'origine).

- **`wall-reshape` (la poignée) : rien à faire, déjà bien factorisé depuis l'incrément 6** — sa logique
  vit déjà dans des fonctions pures partagées (`wallRunRowCountForCell`/`wallRunReshapeCells`,
  `shared/world/roomGeometry.js`), la branche `Scene.jsx` n'est que de la glue (seuil clic/glissé, appel
  à `handleReshapeRoomCommit`, événements). Même verdict que Salle au tour précédent.
- **Sélection : `[CODÉ]`, comportement préservé (test croisé, 4 cas), `⚠️ non testé en navigateur`.** La
  branche la plus exercée de tout l'éditeur (chaque clic en mode Sélection) — traitée avec la même rigueur,
  pas plus vite parce qu'elle est fréquente. Décision pure extraite : `resolveSelectHit(...)`
  (`client/src/lib/surfaceTools/resolveSelectHit.js`) détermine QUOI a été touché (connecteur / une salle
  avec son patch / plusieurs salles / rien) ; `Scene.jsx` garde tous les appels `onSurfaceToolChange`/
  `onSurfaceConnectorSelect`/`onSurfaceRoomSelect`/`preventDefault`/`stopPropagation` inchangés. Un cas
  limite trouvé en lisant (pas en supposant) : si `roomToSurfaceToolPatch` renvoyait un jour `null` pour une
  salle trouvée, le code d'origine ne fait STRICTEMENT rien (pas de sélection, pas d'effacement) — préservé
  à l'identique (`{ kind: 'none' }`), bien que ce cas soit aujourd'hui inatteignable en pratique
  (`roomToSurfaceToolPatch` ne renvoie `null` que si la salle est absente, déjà exclu par la garde
  précédente) — documenté, pas supprimé silencieusement.
- **Remodeler (reshape-room), premier clic : `[CODÉ]`, comportement préservé (test croisé, 3 cas), `⚠️ non
  testé en navigateur`.** Seule la décision « ajouter ou retirer » extraite :
  `resolveReshapeRoomCellMode(surfaceData, roomId, start)`
  (`client/src/lib/surfaceTools/resolveReshapeRoomCellMode.js`) — `null` si aucune salle sélectionnée (le
  composant garde alors son comportement d'origine, ne pas démarrer de glissé). Le reste de son
  `pointerUp` (seuil, construction de la liste de cases, appel à `handleReshapeRoomCommit`) reste en place,
  déjà minimal.
- `SurfaceEditorScene.jsx` : 1318 → 1307 lignes `[CORRIGÉ]` (idem, voir §11.14). `npx eslint` (0 problème), `npm run build` propre, `node
  --test client/src/lib/surfaceData.test.mjs client/src/lib/surfaceTools/*.test.mjs` 67/67. **Testé,
  `Fonctionnel` (Saar, 2026-09-30).**

### 11.13. Décomposition — Peindre un mur, composants visuels déplacés (2026-09-30)

**`[CODÉ]`, comportement préservé une fois une erreur trouvée EN ÉCRIVANT corrigée, `⚠️ non testé en
navigateur`.** `handlePaintWallClick` (glue, appelle déjà des fonctions pures de `surfaceRooms.js`) : rien à
faire, même verdict que Salle/wall-reshape. Les deux composants visuels (`PaintableRoomWall`/
`PaintableRoomWalls` — meshes cliquables + surlignage au survol, seul mécanisme d'interaction de cet outil
qui sort exprès du glisser-déposer générique depuis §11.9) déplacés dans
`client/src/components/surfaceTools/PaintableRoomWalls.jsx`, même patron que les 8 aperçus du §11.8
(composants React purs pilotés par leurs props, un `useState` local pour le survol n'y change rien).

**Erreur trouvée avant qu'elle ne touche le vrai fichier, pas après** : en recopiant `PaintableRoomWalls`,
j'ai d'abord écrit `onPaint={() => onPaint?.(room.id, wallRun.edgeKeys)}` — j'avais mal recopié le
branchement d'origine, qui passe `edgeKeys => onPaint?.(room.id, edgeKeys)` (les clés RÉELLEMENT calculées
au clic par `PaintableRoomWall`, selon la portée `case`/`tronçon`/`salle` et le point cliqué précis via
`roomWallEdgeKeyAtPoint`). Ma version aurait toujours peint le tronçon entier, portée `case` cassée sans
qu'aucun test ne le révèle. Trouvé en relisant le fichier source ligne à ligne avant de considérer
l'extraction terminée, pas après un rapport de bug — corrigé avant tout commit.

- `SurfaceEditorScene.jsx` : 1307 → 1227 lignes `[CORRIGÉ]` (idem, voir §11.14). `npx eslint` (0 problème), `npm run build` propre, 67/67
  inchangé (comportement de rendu, pas de logique pure nouvelle à tester par cross-check ici — la
  vérification est la relecture qui a trouvé l'erreur ci-dessus, pas un test automatisé).
- **Testé, `Fonctionnel` (Saar, 2026-09-30).**

### 11.14. Décomposition — overlays de sélection (salle, murs, poignée, arc, zones déjà posées) (2026-09-30)

En terminant l'audit annoncé au tour précédent (« pas encore auditées »), 4 composants purs supplémentaires
trouvés — même famille que les 8 aperçus du §11.8, juste plus loin dans le fichier, ratés lors de ce premier
passage. **`[CODÉ]`, comportement préservé (code déplacé à l'identique), `⚠️ non testé en navigateur`.**

- `RoomSelectionOverlay.jsx` : contour + remplissage jaune de la salle sélectionnée
  (`SelectedRoomOverlay` + son helper `roomSelectionShapes` + `RoomSelectionShape`/`RoomSelectionContour`,
  gestion de la mémoire Three.js — `geometry.dispose()` — déplacée avec eux).
- `RoomWallSelectionOverlay.jsx` : murs sélectionnables d'une salle + **la poignée de redimensionnement**
  elle-même (`SelectableRoomWall`, `onReshapeStart`) — la fonctionnalité la plus attendue de tout ce
  chantier (§10c) ; déplacée à l'identique, pas retouchée, sans changer une ligne de son comportement.
- `RoomArcPreview.jsx` : aperçu de l'arrondi de coin sur les murs sélectionnés.
- `RuntimeEffectRegions.jsx` : zones dangereuses déjà posées (visibles indépendamment du mode courant).
- Imports nettoyés en conséquence (`isWorldPointVisibleAtLevel`, `yToLevel` du barrel `surfaceData.js`/
  `surfaceCore.js`, `makeRoomBoundaryArc`/`roomBoundaryContours`/`sampleRoomBoundaryArc` de
  `roomGeometry.js`, `getEffectRegionColor`, et enfin `getWallRenderBox` — plus aucun appelant dans
  `Scene.jsx` une fois ces 4 composants partis).

`SurfaceEditorScene.jsx` : 1227 → 958 lignes. `npx eslint` (0 problème), `npm run build` propre, 67/67
inchangé. **Testé, `Fonctionnel` (Saar, 2026-09-30), poignée comprise.**

**`[CORRIGÉ]` 2026-09-30, en préparant le bilan ci-dessous** : tous les comptages de lignes de §11.10 à
§11.13 ci-dessus étaient faux — mesurés via PowerShell (`Get-Content ... | Measure-Object -Line`), qui
sous-compte silencieusement (aucune erreur, juste un nombre plus petit que la réalité, écart constaté
jusqu'à 269 lignes). Revérifié via `git show <commit>:... | wc -l` (Bash) pour chaque commit réel — les
chiffres ci-dessus sont maintenant les vrais. Aucun code n'était faux, seule la mesure rapportée dans ce
document l'était — `.claude`/mémoire mis à jour pour ne plus utiliser cet outil pour compter des lignes.

**Bilan de toute la décomposition (§11.7→§11.14), chiffres vérifiés** : `SurfaceEditorScene.jsx` 1550 → 958
lignes (-38,2 %, pas -42,6 % comme annoncé avant correction), 13 fichiers neufs dans
`client/src/components/surfaceTools/` et `client/src/lib/surfaceTools/`, chacun une seule responsabilité,
la plupart testés par comparaison croisée contre le comportement d'origine. Ce qui
reste dans `Scene.jsx` : le moteur de glisser-déposer générique (`dragRef`/`setDrag`/
`skipNextCanvasMouseDownRef`, les 3 handlers souris) — légitimement la seule pièce qui n'est PAS « un
outil » mais le socle partagé par tous, pas encore auditée pour une extraction propre.

## 12. Audit UX complet de l'interface actuelle — demande explicite de Saar (2026-09-29)

> Saar : « Comme exprimé précédemment, l'interface UI/UX est un bordel sans nom : plein de fonctionnalités qui
> se sont ajoutées et jamais réfléchies d'un point de vue UI. J'ai besoin d'un expert UI/UX pour repenser
> l'intégralité de l'interface. »

Recadre le §11 : jusqu'ici, la recherche (11.6.1) et l'audit (11.6.2) portaient sur l'architecture de code
(machine à états, pattern de commande, duplication d'autorité). Cette demande porte d'abord sur l'expérience
elle-même — taxonomie des outils, cohérence, charge cognitive — pas sur le fichier qui l'implémente. Les deux
convergent (une bonne IA se code ensuite avec les patrons du 11.6.1) mais l'ordre change : la décision de
design précède le refactor technique qui la sert, pas l'inverse.

### 12.1. Méthode

Audit heuristique — Jakob Nielsen, 10 heuristiques d'utilisabilité, méthode standard de l'industrie
(`nngroup.com`, référence de facto pour ce type d'évaluation) — appliqué à un inventaire réel de l'interface
(lu dans le code, pas deviné), croisé avec les constats déjà posés par Saar lui-même (§9, non diagnostiqués à
l'époque) et les bugs déjà trouvés en creusant le code (§10/§11.3). Puis confrontation à trois références déjà
mobilisées dans ce chantier (Dungeondraft, Blender, l'éditeur three.js) pour leurs patrons concrets.

### 12.2. Inventaire réel `[VÉRIFIÉ]` (lecture directe de `SurfaceEditorPanel.jsx`, 2026-09-29)

- **3 onglets visibles, 2 dimensions d'état réelles** : Structure / Objets 3D / Zones dangereuses sont rendus
  comme 3 boutons, mais le code n'a que `activeEditorTab: 'world' | 'entity'` — Structure et Zones dangereuses
  partagent `'world'`, distinguées seulement par `surfaceToolState.mode === 'effect'` (lignes 375-412). Le
  commentaire du code l'assume ouvertement : « Aucun nouvel état, zéro risque pour le parent » — une décision
  optimisée pour la sécurité du code, pas pour un modèle mental cohérent côté utilisateur (heuristique n°2,
  *match between system and the real world*, 12.3).
- **Dans l'écran Structure, 4 groupes de boutons, à la cohérence de présentation inégale** (lignes 453-612) :
  1. *Sélection* — 1 bouton, sans titre de section.
  2. *« Structure »* (titre de section) — Salle, Mur, Escalier, Passerelle (4 boutons de création).
  3. *« Connecteurs »* (titre de section) — Porte, Ascenseur, Échelle (3 boutons de création).
  4. **Sans titre de section** — Peindre un mur, Remodeler (`reshapeRoom`), Effacer : mélange deux outils de
     retouche et un outil destructif, seul groupe des quatre sans étiquette, et seul groupe où 2 des 3 boutons
     sont désactivés tant qu'aucune salle n'est sélectionnée (`disabled={!surfaceToolState.selectedRoomId}`,
     lignes 577 et 593) sans que le 3ᵄ (Effacer) partage cette contrainte ni qu'aucun n'explique pourquoi par un
     tooltip visible dans le code lu.
  → **11 modes distincts au total** (`select, room, wall, stair, bridge, connector×3, paint-wall, reshape-room,
  erase`) dans un seul écran, groupés par ordre d'ajout historique `[HYPOTHÈSE]` (pas vérifié par `git blame`)
  plutôt que par intention d'usage.
- **Deux interfaces concurrentes pour éditer l'apparence d'un mur** (déjà creusé §10b/§11.6.2) : l'outil sidebar
  « Peindre un mur » (clic direct, portée choisie) et le panneau flottant Mur (sélection classique puis
  formulaire) — aucun des deux ne renvoie à l'autre, l'un ferme l'autre au lieu de le réutiliser (constat brut
  de Saar, §9 : « ferme une fenêtre qui contient déjà toute l'interface nécessaire pour en dupliquer une
  partie »).

### 12.3. Audit heuristique — violations trouvées, sourcées sur le code ou les constats déjà consignés

1. **Consistance et standards** — violée : la peinture de mur a deux chemins d'interaction concurrents
   (12.2), les trois autres opérations de mur (arc, élévation) n'en ont qu'un (§11.6.2) — aucune règle
   n'indique laquelle est la référence pour une future fonctionnalité.
2. **Correspondance système/réalité** — violée : 3 onglets affichés pour 2 dimensions d'état réelles (12.2) ;
   la « Structure » technique (`activeEditorTab`) ne coïncide pas avec la structure perçue par l'utilisateur.
3. **Reconnaître plutôt que se souvenir** — violée : 11 modes dans un seul écran, deux des quatre groupes de
   boutons sans étiquette de section (12.2) — la charge de mémorisation repose sur l'utilisateur, pas sur
   l'interface qui devrait la porter.
4. **Design esthétique et minimaliste** — violée : deux interfaces qui font un travail qui se recoupe pour la
   même donnée (12.2, mur) — de l'information/des contrôles redondants qui se disputent l'attention sans valeur
   ajoutée l'un par rapport à l'autre.
5. **Contrôle et liberté de l'utilisateur** — violée en partie : application en direct sans regroupement
   (§11.3 point 4) — un seul geste continu (glisser un curseur) peut à lui seul saturer une bonne part des 49
   emplacements d'annulation, réduisant la liberté de revenir en arrière sur d'*autres* actions.
6. **Visibilité de l'état du système** — violée : « Ajouter une salle » qui ne reste pas actif après une pose
   réussie (§9/§10b) — le mode retombe silencieusement en Sélection, aucun signal explicite ne dit à
   l'utilisateur qu'il vient de quitter le mode création.
7. **Prévention des erreurs** — violée jusqu'à correction : le bug « la couleur change avant même de cliquer »
   (§10e) était exactement une absence de garde-fou — une action irréversible (repeindre) appliquée à une
   cible ambiguë (une sélection accumulée silencieusement) sans étape de confirmation. Corrigé au niveau code
   (§10e), mais le patron sous-jacent (application en direct sur « la sélection courante », sans que
   l'utilisateur voie clairement laquelle) reste fragile par construction, pas seulement par ce bug précis.

### 12.4. Trois patrons professionnels convergents, déjà mobilisés dans ce chantier

- **Dungeondraft** (`encounterlibrary.com`, `dungeondraft-encyclopaedia.gitbook.io`) : les outils sont groupés
  par catégorie de haut niveau dans la barre latérale (Design / Terrain / Objets), chaque catégorie sa propre
  icône — jamais une liste plate d'outils individuels au même niveau.
- **Blender** (`blender.org`, N-panel) : **un seul panneau de propriétés contextuel**, toujours au même
  endroit, qui affiche ce qui concerne l'élément actif quel qu'il soit — pas une fenêtre dédiée par type
  d'objet qui se multiplie à chaque nouvelle fonctionnalité.
- **Éditeur three.js** (déjà détaillé en 11.6.1) : commandes fusionnables par fenêtre de temps — répond à la
  violation n°5 ci-dessus avec un mécanisme déjà éprouvé, pas à réinventer.

Sources : [The Design Tools — Encounter Library](https://encounterlibrary.com/dungeondraft-basics/design-tools/) ·
[The Object Tools — Encounter Library](https://encounterlibrary.com/dungeondraft-basics/object-tools/) ·
[MAIN MENU — Dungeondraft Encyclopaedia](https://dungeondraft-encyclopaedia.gitbook.io/guide/introduction/first-look/main-menu) ·
[Context-sensitive user interface — Wikipedia](https://en.wikipedia.org/wiki/Context-sensitive_user_interface) ·
[Nielsen's Heuristics — The Decision Lab](https://thedecisionlab.com/reference-guide/design/nielsens-heuristics) ·
[Heuristic Evaluation Workbook — NN/g](https://media.nngroup.com/media/articles/attachments/Heuristic_Evaluation_Workbook_1_Fillable.pdf).

### 12.5. Direction de refonte proposée — à valider par Saar, pas une décision prise

Trois changements d'information architecture, chacun répond à une violation précise du 12.3, présentés pour
décision (même méthode que Plan B et Lot A Option 1/2, §8) :

1. **`[CODÉ]` Regrouper les 11 modes par phase de travail plutôt que par ordre d'ajout** : « Bâtir » (Salle, Mur,
   Escalier, Passerelle), « Connecteurs » (Porte, Ascenseur, Échelle, déjà titré), « Finir » (Peindre, Remodeler,
   Effacer) — chaque groupe étiqueté de façon cohérente (corrige violations 3 et 4). Sélection reste hors groupe :
   c'est un état permanent, pas un outil de création. **Trouvé non fait lors d'une relecture critique demandée par
   Saar (2026-09-30) — validé en principe dès ce tour-ci (§12.5) mais jamais codé** malgré tout le reste livré ;
   corrigé : deux nouvelles clés i18n (`surfaceEditor.buildSection`/`finishSection`, `fr.json`), deux titres de
   section ajoutés dans `SurfaceEditorPanel.jsx` (`structureSection` réservé à l'onglet, ne pouvait pas être
   réutilisé pour le groupe — partagé avec le nom de l'onglet Structure). Aucune logique touchée.
2. **Une seule source d'apparence de mur, pas un panneau unique pour tout** — correction après lecture
   complète du contenu réel des panneaux (§12.7) : l'idée d'un panneau de propriétés unique façon Blender
   N-panel, écrite ici sans avoir encore lu ce contenu, était trop large. Salle/Mur/Connecteur/Effet sont des
   objets réellement différents avec des propriétés différentes — les fusionner recréerait le capharnaüm sous
   une autre forme. Le patron Blender s'applique correctement à un seul point précis, déjà identifié en
   §11.6.2 : le raccourci « Peindre un mur » (sidebar) et le panneau flottant Mur doivent alimenter la même
   instance de `SurfaceMaterialEditor`, pas deux copies concurrentes (corrige violation 1 et 4 pour ce cas
   précis, sans toucher au reste des panneaux). Détail panneau par panneau : §12.7.
3. **Rendre l'état « toujours en train de créer » visible explicitement** (ex. contour actif plus marqué,
   libellé « Ajoute une salle — clique pour continuer, Échap pour arrêter ») au lieu d'un retour silencieux en
   mode Sélection (corrige violation 6).

**Restent hors de cette proposition, non tranchés** : les 3 onglets vs 2 dimensions d'état (violation 2) —
faut-il un vrai 3ᵉ état ou une meilleure présentation du même état ? ; l'application en direct sans
regroupement (violation 5) — la fusion par fenêtre de temps du 11.6.1 est une réponse technique, mais l'UX de
« qu'est-ce que je suis en train de modifier » mérite d'être vérifiée séparément.

### 12.6. Ce que je ne tranche pas seul

Le choix des libellés, le nombre de groupes, l'ordre d'affichage et l'apparence concrète du panneau contextuel
sont des préférences d'usage quotidien — Saar est le seul utilisateur réel de cet outil. Je décide
l'architecture technique qui les sert (§11.6.1) mais pas ces choix-là seul, par la même méthode que Plan B/Lot A
(recherche pro, options concrètes présentées, tranchées par Saar, avant tout code). Prochaine étape naturelle
si cette direction convient : une maquette visuelle (comme celle utilisée pour Plan B, §7-8) pour réagir sur du
concret plutôt que sur du texte, avant tout code de la coquille v2.

### 12.7. Contenu réel des panneaux — garder / jeter / re-présenter, panneau par panneau

Saar, après la maquette du 12.6 : « Tu n'as rien résolu puisque tu as tout survolé. Contenu de la fenêtre,
qu'est-ce qu'on garde, qu'est-ce qu'on jette, comment on le présente ? » — juste : le 12.5/12.6 précédents
proposaient un patron abstrait sans avoir lu le contenu réel des cinq panneaux flottants. Ce qui suit vient
d'une lecture complète (`SurfaceRoomPanel.jsx` 270 lignes, `SurfaceWallPanel.jsx` 267, `SurfaceConnectorPanel.jsx`
539, `SurfaceMaterialEditor.jsx` 86, `SurfaceEffectPanel.jsx` 134 — `[VÉRIFIÉ]`, pas survolé), champ par champ.

**`SurfaceMaterialEditor.jsx` — GARDER tel quel, c'est la référence, pas un problème.**
Matériau, motif, teinte (picker + hex), usure/salissure/relief (curseurs), bascule relief réel/normal map — six
champs cohérents, un seul composant, déjà réutilisé par Salle et Mur. Le seul défaut n'est pas dans ce fichier :
`SurfaceEditorPanel.jsx` (sidebar, mode Salle) réimplémente ces six champs à la main au lieu de monter ce
composant (dette déjà nommée, `PLAN_EDITEUR_CARTE.md` Phase 2b) — à corriger dans ce chantier, pas une nouvelle
trouvaille.

**`SurfaceEffectPanel.jsx` — GARDER quasiment tel quel, un seul défaut cosmétique.**
Intensité, Puissance, Durée (lecture seule) — trois champs, une section, cohérent. Défaut trouvé : le titre de
la section répète le kicker de l'en-tête (« Zone d'effet » deux fois) — à corriger, sans enjeu de fond.

**`SurfaceRoomPanel.jsx` — GARDER l'essentiel, deux trouvailles réelles.**
- Nom (hors section, en haut) ; section Géométrie (ouverte) : niveau de base, volume, hauteur *(select 1-6
  niveaux, uniquement si la salle n'a pas encore de profil vertical canonique — sinon une note)*, épaisseurs
  dalle/plafond/mur ; section Déplacement (repliée) : coût, collision (solide/verre/grille) ; section Apparence
  (repliée) : onglets Sol/Plafond + `SurfaceMaterialEditor` ; section Connecteurs (repliée) : raccourcis
  Ascenseur/Échelle ; suppression avec confirmation à deux temps.
- **Trouvaille 1 `[VÉRIFIÉ]`** : la section Connecteurs est un TROISIÈME chemin pour poser un ascenseur/une
  échelle, en plus du groupe « Connecteurs » de la sidebar — mais en lisant `startConnector` (ligne 46-57), il
  appelle exactement le même `onPatch({mode:'connector', connectorType, …})` que la sidebar : pas une
  duplication d'autorité comme celle du mur (§10b), juste un second point d'ENTRÉE vers le même mécanisme.
  **GARDER** comme raccourci contextuel (poser un ascenseur en étant déjà dans une salle a du sens), il n'y a
  rien à corriger ici — à la différence du mur, où deux chemins avaient deux comportements différents.
- **Trouvaille 2** : les épaisseurs (dalle/plafond/mur) sont des réglages qu'on pose une fois et qu'on ne
  retouche presque jamais, mélangés dans la section Géométrie *ouverte par défaut* avec des informations qu'on
  consulte souvent (niveau, volume). **RE-PRÉSENTER** : sortir les trois épaisseurs dans une sous-section
  « Avancé » repliée par défaut, garder niveau/volume/hauteur visibles d'emblée.

**`SurfaceConnectorPanel.jsx` (539 lignes, le plus gros et le seul sans `FloatingPanelSection`) — le vrai
problème de contenu de ce chantier.**
Lu en entier : info (type/niveau/dimensions) ; [porte] état (fermée/ouverte/verrouillée) + difficulté de
serrure ; **`ElevatorRuntimeControls`** (état de cabine, file d'appels, boutons d'étage, actions MJ
bloquer/débloquer/ouvrir/fermer) ; **`DoorRuntimeControls`** (état effectif, ouvrir/crocheter, fermer,
verrouiller pour le MJ) ; coût de déplacement ; couleurs (surcharges de matériau par emplacement du modèle
GLB) ; suppression avec confirmation.
- **Trouvaille `[VÉRIFIÉ]`, pas encore documentée avant cette lecture** : ce panneau mélange sans aucune
  séparation visuelle deux MOMENTS d'usage complètement différents — **construire la carte** (état par défaut,
  difficulté de serrure, coût de déplacement, couleurs, suppression) et **jouer une session en cours**
  (`ElevatorRuntimeControls`/`DoorRuntimeControls` : ouvrir/fermer/verrouiller/appeler un étage *maintenant*,
  sur l'état d'exécution réel `runtimeState`). Les deux rendent au même endroit, avec la même apparence, sans
  bandeau ni distinction — un MJ qui voit “État : Fermée” pendant une session ne peut pas savoir d'un coup
  d'œil si régler ce menu déroulant change la valeur par défaut de la carte ou l'état réel de la porte en
  train de se jouer devant les joueurs. `[HYPOTHÈSE]`, à vérifier en session réelle : le menu déroulant
  `connector.state` (édition, ligne 239) coexiste-t-il avec les boutons runtime sans qu'on sache lequel gagne ?
  Pas testé, à observer avant de corriger — pas un correctif à improviser sur une cause non vérifiée.
- **DÉCISION PROPOSÉE, pas tranchée** : séparer visuellement (bandeau de fond distinct, ou franchement deux
  onglets internes « Réglages » / « Contrôle en session ») les champs d'édition des contrôles runtime — jamais
  la même rangée de gris uniforme pour « je configure la carte » et « j'ouvre cette porte devant mes joueurs
  maintenant ».
- **JETER de la priorité visuelle, pas le contenu** : « Couleurs » (surcharges de matériau par emplacement) est
  un réglage rare — à replier par défaut dans une section « Apparence avancée », pas au même niveau que le
  reste.
- **RE-PRÉSENTER** : adopter `FloatingPanelSection` comme les trois autres panneaux (Salle/Mur/Effet) — ce
  fichier est le seul des quatre sans aucune section repliable, incohérence confirmée par la lecture, pas
  supposée.

**`SurfaceWallPanel.jsx` — contenu à re-hiérarchiser, pas à couper ; une vraie incohérence de sécurité trouvée.**
Bouton « Sélectionner tous les murs » (hors section) ; section Apparence (repliée) ; section Profil
d'élévation (ouverte : vertical/courbe/facetté, profondeur, angle, direction) ; section Ouvertures (ouverte :
ajouter une porte, actif seulement si un seul tronçon est sélectionné) ; puis, **hors de toute section** :
angle d'arc (si ≥ 2 murs sélectionnés), une grille de 4 boutons (Inverser dans le plan / Appliquer l'arc /
Redresser / Supprimer), un indice de fusion, une erreur éventuelle.
- **Trouvaille `[VÉRIFIÉ]`** : les 4 derniers boutons n'ont aucun titre de section — exactement le genre de
  contenu accumulé sans plan que Saar dénonce. Ils mélangent en plus deux opérations très différentes dans une
  seule grille visuellement uniforme : courber/redresser le tracé (réversible, un réglage) et **supprimer le(s)
  mur(s) sélectionné(s)** (destructif). **Trouvaille de sécurité** : Salle, Connecteur et Effet ont tous les
  trois une confirmation à deux temps avant suppression (`confirmDelete`) — ce panneau, seul des quatre, **n'en
  a aucune** sur « Supprimer le(s) mur(s) » (ligne 226-233) : un clic suffit, sans second temps.
- **DÉCISION PROPOSÉE** : donner un vrai titre à cette zone (« Forme du tronçon » ou équivalent) ; sortir
  Supprimer de la grille 2×2 pour l'aligner sur le patron de confirmation des trois autres panneaux (pas une
  question de goût, une incohérence de sécurité réelle) ; garder Inverser/Appliquer/Redresser groupés, ce sont
  bien trois réglages de la même opération.
- **GARDER** : Apparence et Profil d'élévation, déjà bien sectionnés, rien à changer sur ces deux-là.

### 12.8. Flux utilisateur réels — vérifiés dans `SurfaceEditorScene.jsx`, pas décrits de mémoire

Saar : « la hiérarchie [de la sidebar] est OK, mais c'est tout ? Quel est le flux utilisateur ? » — lu le
gestionnaire réel (`handleMouseDown`/`handleMouseUp`, lignes ~1020-1293) pour chacun des 11 modes, pas deviné
depuis les noms de bouton.

**Trois familles de geste, pas une seule** :
1. **Glisser un rectangle de cases** (Salle, Escalier, Passerelle, Plafond, Effacer, Remodeler la salle, Zone
   d'effet) — mouse-down pose le premier coin, mouse-move prévisualise, mouse-up applique sur le rectangle.
2. **Glisser un point fin sur un mur/tracé** (Mur droit, Porte) — même familles de gestes, mais la coordonnée
   est un point sur une arête (`getWallPoint`/`getSelectedDoorWallPoint`), pas une case entière : plus précis,
   mais visuellement identique à l'utilisateur (même geste de glisser), rien ne signale la différence de
   granularité avant de commencer à glisser.
3. **Cliquer un point** (Ascenseur, Échelle — un seul point, pas de rectangle) et **Sélection** (clic simple =
   remplace, glisser = sélection multiple de salles).

**`[VÉRIFIÉ]` — la vraie trouvaille : trois règles différentes coexistent pour « le mode reste-t-il actif après
un geste réussi ? », sans aucun signal visuel pour savoir laquelle s'applique** :
- **Salle** (ligne 1191-1216) : reste en mode création si le geste n'a RIEN créé (case invalide, chevauchement)
  ; **repasse en Sélection** si une salle a été créée — et ouvre alors automatiquement son panneau flottant.
  Règle conditionnelle, jamais annoncée à l'écran (§9/§10b/§12.3 violation 6).
- **Connecteur** (porte/ascenseur/échelle, ligne 1218-1241) : repasse **toujours** en Sélection après une pose
  réussie, jamais de persistance — poser trois portes de suite oblige à recliquer le bouton trois fois. Jamais
  signalé jusqu'ici, trouvé en lisant ce tour.
- **Mur/Escalier/Passerelle/Plafond/Effacer/Remodeler/Effet** (ligne 1243-1292) : **ne change jamais de mode**
  après un geste — toujours persistant, adapté à un usage répétitif (peindre plusieurs cases de suite).
  Trois comportements différents, aucune règle écrite qui dise laquelle s'applique à quoi, et aucun indice à
  l'écran dans les 11 cas. Le §12.5 point 3 (bandeau d'état actif) répond à la conséquence visible (Salle) mais
  pas à la cause : l'absence d'une règle unique. **`[HYPOTHÈSE]` à trancher avec Saar, pas déduite seule** :
  soit une règle unique s'applique à tous les outils de création (persister par défaut, quitter sur Échap —
  cohérent avec Mur/Escalier/etc., ce qui changerait Salle et Connecteur), soit chaque outil garde sa règle
  mais elle devient visible (le bandeau proposé en §12.5, généralisé aux 11 modes, pas seulement Salle).

**Deux flux de création différents pour un geste pourtant similaire (« tracer un volume »)** : Salle propose
d'abord de dessiner, puis ouvre son panneau pour nommer/configurer après coup (configurer après tracer) ; Zone
d'effet (mode `effect`) demande de choisir définition/intensité/puissance DANS LA SIDEBAR avant de tracer, puis
crée l'instance directement au relâchement sans ouvrir de panneau de réglage (configurer avant tracer). Deux
philosophies opposées pour deux gestes qui se ressemblent à l'écran — `[HYPOTHÈSE]`, pas vérifié si c'est un
choix délibéré (chaque zone du même type partage ses réglages, une salle est toujours unique) ou un oubli.

**Flux de sélection (mode `select`, ligne 1127-1189)**, pour mémoire : clic simple sur un connecteur → le
sélectionne et ouvre son panneau ; clic simple sur une case de salle → sélectionne LA salle entière, ouvre son
panneau, active l'édition de ses murs (`roomWallEdit:true`, ce qui rend les arêtes cliquables — géré par un
second gestionnaire, `handleRoomWallPointerSelect`, déjà documenté §10e) ; glisser sur plusieurs cases →
sélection multiple de salles, sans édition de mur active.

### 12.9. Paradigme d'interaction retenu — flux utilisateur cible

Saar : « je voulais m'inspirer d'un Sims, mais est-ce le meilleur plan ? Dungeondraft ? On innove ? On met
tout sur la sidebar ? Sur la fenêtre ? 50/50 ? Je ne sais pas. » — c'est une vraie question d'architecture
d'interaction, pas de goût : je tranche, avec les preuves déjà réunies en §12.7/§12.8, et je signale les deux
points qui restent son choix.

**Pourquoi ni Sims ni Dungeondraft ne sont, seuls, la bonne référence de fond.** Les deux sont des outils 2D
vus du dessus, avec une caméra simple, et surtout **sans objets à réglages profonds** : Sims édite un
revêtement par un choix de nuancier (une bande d'échantillons en bas d'écran), Dungeondraft règle un pinceau
(taille, texture) — ni l'un ni l'autre n'a d'équivalent à « profil d'élévation courbe avec angle et profondeur »,
« coût de déplacement », « difficulté de serrure », ou un objet qui sert à la fois à *construire* la carte et à
*jouer* une session (§12.7, `SurfaceConnectorPanel`). Enclume a cette profondeur-là. Chercher l'inspiration
seulement chez Sims/Dungeondraft, c'est chercher une réponse à une question qu'ils ne se posent pas.

**La bonne famille de référence, déjà universelle chez les outils 3D pros** `[VÉRIFIÉ, connaissance du domaine]`
**: Blender, Unity, Unreal, Godot — tous partagent la même disposition à trois colonnes fixes : Outils (gauche) |
Viewport 3D (centre) | Propriétés (droite), le panneau de propriétés toujours au même endroit, jamais une
fenêtre flottante qui se déplace ou se perd. Ce n'est pas une mode, c'est devenu la disposition par défaut de
toute la catégorie d'outils la plus proche d'Enclume (contrairement à Sims/Dungeondraft, qui sont dans une
catégorie voisine mais différente : éditeur 2D grand public, pas outil de création 3D). **Recommandation : ce
squelette à trois colonnes fixes est la structure macro à adopter — pas une invention, la convention du domaine
le plus pertinent.**

**Où Dungeondraft ET Enclume lui-même (pas une référence externe) s'appliquent : le niveau micro, pas la
disposition d'ensemble.**
- Dungeondraft, pour le regroupement des outils par catégorie dans la colonne de gauche (déjà proposé en
  §12.5 point 1 : Bâtir/Connecter/Finir) — juste, mais seulement pour CETTE colonne.
- **Enclume lui-même**, pour le geste : Plan B (peindre/effacer des cases pour la forme d'une salle, §8) est
  une manipulation directe dans le viewport 3D, **déjà codée, déjà validée en jeu par Saar** — la seule preuve
  de ce chantier qui n'est pas une hypothèse. Elle confirme que la manipulation directe dans le viewport
  fonctionne ici pour un geste grossier/répétitif. La poignée de redimensionnement (§10c, rapide/gros, encore
  à livrer) est le même principe à une autre granularité — pas un dossier concurrent.

**Flux cible proposé, un seul jeu de règles au lieu de trois (répond directement au §12.8)** :
1. **Tout outil de pose/dessin reste actif après un geste réussi** (Salle, Mur, Escalier, Passerelle, Porte,
   Ascenseur, Échelle, Peindre, Remodeler, Effacer, Zone d'effet) — étend aux Connecteurs et généralise Salle
   la règle déjà correcte de la majorité des outils (§12.8) : poser 3 portes de suite ne redemande plus 3 clics
   sur le bouton. Sortie explicite par **Échap** ou par un clic sur « Sélection », jamais silencieuse.
2. **Un bandeau d'état actif permanent** (proposé en §12.5 point 3, généralisé ici à tous les outils de pose,
   pas seulement Salle) — toujours visible tant qu'un outil de création est actif.
3. **Un seul panneau de propriétés, fixe, colonne de droite** — remplace les fenêtres flottantes/déplaçables
   actuelles (Salle/Mur/Connecteur/Effet gardent leur contenu propre, §12.7 : ce n'est pas une fusion en un
   panneau unique, c'est un **emplacement** unique). Sélectionner un objet, par clic direct ou par un raccourci
   de la colonne de gauche (peindre un mur, par ex.), affiche toujours ses propriétés au même endroit — referme
   pour de bon la duplication trouvée en §10b/§11.6.2, plus par une règle de contenu mais par une contrainte de
   structure (il ne peut plus y avoir deux endroits, il n'y a plus qu'un endroit).
4. **La poignée de redimensionnement (§10c) est un sous-outil du panneau Salle sélectionnée**, pas un 12ᵉ bouton
   de la colonne de gauche : « cases » (fin, détail) et « poignée » (rapide, gros) coexistent comme deux
   sous-modes d'édition de forme dans ce panneau, tous deux agissant dans le viewport — cohérent avec l'exigence
   de Saar (§10c) sans faire grossir encore la colonne de gauche.
5. **`[VÉRIFIÉ]` — trouvaille du jour, jamais documentée avant cette lecture** : dans `Editor3D.jsx`, le panneau
   Connecteur ne reçoit pas `canEdit` (donc `true` par défaut, tous les champs d'édition visibles) **ET**
   reçoit `onElevatorCommand={handleElevatorCommand}` réellement câblé et fonctionnel (ligne 1125/1551) — un MJ
   peut appeler un ascenseur en vrai depuis l'éditeur, hors de toute session ; `onDoorCommand`, lui, n'est pas
   câblé côté éditeur (les boutons Ouvrir/Fermer d'une porte s'affichent mais ne font rien, `!onCommand` les
   désactive). Un mélange asymétrique, pas juste « pas séparé visuellement » comme écrit au tour précédent.
   **Recommandation : le panneau d'édition ne pilote plus jamais un connecteur en direct** (retirer
   `onElevatorCommand` de l'appel dans `Editor3D.jsx`) — piloter un ascenseur ou une porte réellement reste
   le rôle exclusif de `Canvas3D.jsx` (une vraie session). Si Saar veut un jour tester un connecteur depuis
   l'éditeur, ce serait une action explicite (« Aperçu en jeu »), pas un panneau qui fait les deux sans le dire.

**Les deux points ci-dessus, tranchés** — Saar (2026-09-29) : « la fenêtre ne me gêne pas spécialement, j'ai
tendance à bouger la caméra plutôt que la fenêtre (déplacement au clavier indispensable). Fais à ton idée. »
- **Panneau fixe, confirmé** : Saar ne déplace pas ces fenêtres en usage réel (il navigue par la caméra) — le
  passage à une colonne fixe à droite n'est pas une perte de confort constatée, seulement une simplification
  de code (retrait de `useDraggablePanelPosition` sur ces quatre panneaux, plus de position à mémoriser).
- **Persistance des Connecteurs après un geste réussi, retenue** : décidé, cohérent avec la règle unique du
  point 1 ci-dessus — poser plusieurs portes/ascenseurs/échelles de suite reste dans l'outil, Échap ou
  Sélection pour sortir, comme tous les autres outils de pose.

### 12.10. Plan d'implémentation séquencé — trois incréments codés, deux restent

Le cadrage (§12.1-12.9) est refermé : paradigme choisi, contenu des quatre panneaux décidé champ par champ,
flux de persistance unifié, les deux derniers points tranchés par Saar (« fais à ton idée » — lu comme
autorisant la levée de la pause du §9 pour les incréments ci-dessous, isolés et déjà entièrement raisonnés).

**Codé, testé, pas encore confirmé par Saar en navigateur** (`node --check`/`npx eslint` propres sur les 5
fichiers touchés, `npm run build` propre, `surfaceData.test.mjs` 49/49 inchangé — ces correctifs touchent des
gestionnaires d'événements React/DOM, aucun test pur possible) :

1. **Confirmation avant suppression de mur** (`SurfaceWallPanel.jsx`) — alignée sur le patron `confirmDelete`
   des trois autres panneaux. En le faisant, la zone sans titre du bas a aussi reçu le sien
   (`shapeSection`, « Forme du tronçon », nouvelle clé `builder.json`) et n'a plus que les trois réglages de
   courbure (Inverser/Appliquer/Redresser) — Supprimer en est sorti, seul bouton dangereux du panneau.
2. **Retrait du pilotage direct de connecteur depuis l'éditeur** — **`[CORRIGÉ]` fait mieux que le plan initial**
   : au lieu de retirer seulement `onElevatorCommand` dans `Editor3D.jsx` (ce qui aurait laissé
   `DoorRuntimeControls` dans le même état de « bouton mort » déjà trouvé pour les portes, §12.7 — une
   rustine locale, pas la cause racine), `SurfaceConnectorPanel.jsx` gate maintenant
   `ElevatorRuntimeControls`/`DoorRuntimeControls` sur `!canEdit`, symétrique au `canEdit &&` qui protège déjà
   tous les champs d'autorité. Une seule règle dans le composant partagé, plus jamais un cas particulier par
   appelant. `Editor3D.jsx` : `handleElevatorCommand`/`refreshRuntimeElevators` retirés (devenus inutiles),
   `canEdit` posé explicitement.
3. **Persistance de mode unifiée (§12.9 point 1) + Échap (point 2) — `[CORRIGÉ]` plus petit que prévu, pas de
   nouveau module.** En l'implémentant, le §12.9/12.10 initial (« machine à états du mode/outil », un nouveau
   module `shared/`/`client/src/lib/`) s'est révélé être exactement le sur-dimensionnement que le garde-fou
   second-system-effect (§11.0) demande de repérer : le vrai correctif tient dans les fichiers existants.
   - `SurfaceEditorScene.jsx` : les branches Salle et Connecteur ne forcent plus `mode:'select'` après un
     geste réussi — désormais alignées sur Mur/Escalier/Passerelle/Effacer/Remodeler/Zone d'effet, qui ne l'ont
     jamais fait. `connectorWallEdgeKeys` remis à `[]` après une pose de porte réussie — **trouvaille en
     implémentant** : sans ça, une 2ᵉ porte serait restée invisiblement limitée au mur choisi pour la 1ʳᵉ
     (`connectors.js` filtre les panneaux de mur sur cette clé), un risque qui n'existait pas tant que le mode
     repassait systématiquement en Sélection.
   - `Editor3D.jsx` : un `useEffect` Échap (patron déjà en place pour Ctrl+Z, la touche G, Delete) repasse en
     Sélection depuis n'importe quel mode de pose, même reset de `connectorWallEdgeKeys`.
   - `SurfaceEditorPanel.jsx` : la ligne d'indice contextuel déjà existante (`sidebar-tool-hint`, un indice par
     mode) faisait déjà presque tout le travail du « bandeau d'état actif » du §12.9 point 2 — pas besoin d'un
     nouveau composant. Corrigée au passage : `paint-wall` et `reshape-room` tombaient sur l'indice générique
     de dalle (`hintSlab`) faute de branche dédiée ; trois indices (Passerelle, Zone d'effet, Échelle) étaient
     du texte français codé en dur dans le JSX au lieu de passer par `t()` (`i18n.md`, invariant violé, trouvé
     en lisant) — déplacés dans `fr.json` (`hintBridge`/`hintEffect`/`hintLadder`) ; `hintRoom` affirmait encore
     l'ancien comportement (« l'éditeur revient automatiquement en sélection ») — corrigé pour ne plus mentir ;
     un suffixe commun (`hintEscapeSuffix`) ajouté à tous les indices des outils de pose, une seule fois, pas
     dupliqué huit fois.
   - **`[VÉRIFIÉ]` trouvé, non corrigé, périmètre distinct** : `connectorWallEdgeKeys` reste aussi mal remis à
     zéro quand on ABANDONNE une pose de porte en cliquant directement le bouton « Sélection » de la sidebar
     (au lieu d'Échap) — gap préexistant, indépendant de ce tour (le bouton Sélection ne l'a jamais fait), pas
     aggravé par la persistance de mode. Laissé tel quel, à reprendre si Saar le rencontre en usage réel.

4. **Colonne de propriétés fixe pour Salle/Mur — `[CODÉ]`, testé, pas encore confirmé par Saar.** En le
   préparant, un fait structurel a changé le découpage prévu : `SurfaceRoomPanel.jsx`/`SurfaceWallPanel.jsx`
   ne servent que l'éditeur (`Editor3D.jsx`, seul appelant) — position fixe sans risque. Mais
   `SurfaceConnectorPanel.jsx`/`SurfaceEffectPanel.jsx` sont **partagés avec le mode Jeu**
   (`Canvas3D.jsx`/`SessionDangerZonePanel.jsx` via `SessionPage.jsx`) — leur fixer la position aurait aussi
   changé le comportement en session, hors périmètre de ce chantier (§11.4, l'éditeur seulement). Scindé en
   4a (fait) et 4b (reporté, ci-dessous) plutôt que traité d'un bloc comme prévu.
   - **4a — Salle et Mur, fait** : `useDraggablePanelPosition`/`x`/`y` retirés des deux composants (toujours
     utilisé ailleurs par Connecteur/Effet/`EntityInstancePanel.jsx` — pas touché, pas orphelin), position
     statique `top:16/right:16`. `Editor3D.jsx` : `handleSurfaceRoomSelect`/`handleSurfaceWallSelect`
     simplifiés (`clientX`/`clientY` retirés, jamais utilisés ailleurs que pour cette position). Call sites
     nettoyés dans `SurfaceEditorScene.jsx` (`onSurfaceRoomSelect`/`onSurfaceWallSelect`, y compris un
     `nativeEvent` devenu mort dans `handleRoomWallPointerSelect`). `node --check`/`eslint`/`build` propres,
     49/49 tests inchangés (gestionnaires d'événements, aucun test pur possible). Contenu interne des deux
     panneaux inchangé (§12.7 reste la référence, pas réécrit).
   - **4b — Connecteur et Effet, `[CODÉ]` (2026-09-30), `⚠️ non testé en navigateur`** : nouvelle prop
     `dockRight` (nom retenu, pas `dockPosition`) sur `SurfaceConnectorPanel.jsx`/`SurfaceEffectPanel.jsx` —
     fournie côté éditeur (`Editor3D.jsx` pour Connecteur, `SurfaceEditorPanel.jsx` pour Effet, via
     `sidebarWidth` déjà branché pour 4a) : position fixe `top:16/right:dockRight`, en-tête non
     déplaçable. Absente côté session (`Canvas3D.jsx`/`SessionDangerZonePanel.jsx`, non touchés) :
     `useDraggablePanelPosition` reste le seul chemin, comportement strictement inchangé —
     `docked = dockRight != null` bascule entre les deux dans le même composant, le hook reste toujours
     appelé (règle des hooks) mais son résultat est ignoré en mode docké. `sidebarWidth` propagé
     `Sidebar.jsx` (son propre prop `width`) → `SurfaceEditorPanel.jsx` → `SurfaceEffectPanel`, séparément
     de la chaîne `SessionPage.jsx` → `Editor3D.jsx` déjà en place pour Connecteur/Salle/Mur. `npx eslint`
     (0 problème)/`npm run build` propres.
5. **Pile d'annulation fusionnable — `[CODÉ]`, testé et confirmé fonctionnel par Saar en navigateur
   (2026-09-30).** Audit réel (pas
   supposé) des quatre panneaux avant de coder : seul le panneau Mur écrit en continu dans `surfaceData` à
   chaque tick d'un `<input type="range">` — Apparence (`handleSurfaceWallAppearanceChange`) et profil
   d'élévation (effet `wallElevationProfileActionId`, un id neuf par tick via `event.timeStamp`). Le panneau
   Salle ne patch que `surfaceTool` (réglage du pinceau, pas la donnée) ; Connecteur/Effet n'ont que des
   `<input type="number">`, un cas distinct et non confirmé comme un vrai problème — laissés tels quels,
   extensibles avec le même mécanisme si Saar en fait le constat.
   - `handleSurfaceDataChange(nextSurfaceData, mergeKey)` (`Editor3D.jsx`) : nouveau second paramètre
     optionnel, reprend `updatable` + fenêtre de fusion de `History.js` (three.js editor, déjà sourcé en
     §11.6.1). Un nouveau `surfaceUndoMergeRef` retient `{ key, timestamp }` du dernier push. Même `mergeKey`
     dans les 500 ms du push précédent → aucune nouvelle entrée d'annulation (l'état d'avant-geste reste en
     haut de pile, seul l'état courant/la sauvegarde réseau avancent) ; sinon comportement strictement
     identique à avant. `mergeKey` absent (tous les autres appelants, non touchés) → comportement inchangé.
   - Clé de fusion = `` `wall-appearance:${roomId}:${selectedRoomWallKeys.join(',')}` `` / `` `wall-elevation:
     ${roomId}:${selectedRoomWallKeys.join(',')}` `` — même salle + même sélection d'arêtes = même geste,
     calculée dans `Editor3D.jsx` (déjà en possession de `surfaceTool`), aucune prop à faire remonter depuis
     `SurfaceWallPanel.jsx`.
   - Fichier unique touché (`Editor3D.jsx`), aucun autre appelant modifié — un seul invariant (fusion des
     commandes continues), pas mélangé à autre chose. `npx eslint` (0 problème)/`npm run build` propres ; pas
     de test pur possible (logique de composant, pas une fonction `shared/`). Seul un test en navigateur peut
     confirmer : glisser un curseur (usure/relief/motif ou profondeur d'élévation) en continu puis un seul
     Ctrl+Z doit annuler tout le geste, pas un tick.
6. **Poignée de redimensionnement — `[CODÉ]`, testé (logique pure), pas encore confirmé par Saar en
   navigateur.** Livrée avant 4b/5 (Saar : « c'est toi l'expert », lu comme une priorité assumée sur
   l'exigence répétée du §10c plutôt qu'un ordre technique).
   - **Conception, présentée et confirmée par Saar avant le code** (« clic = sélectionner comme avant, glisser
     = pousser le mur ») : le geste ne s'active que sur un tronçon DROIT (jamais un arc, v1) déjà sélectionné
     — un premier clic reste une sélection pure, inchangée ; glisser un tronçon déjà actif pousse toute sa
     longueur de N rangées de cases, dans le même pipeline `classifyRoomFootprintCells`/
     `paintRoomFootprintCells` que Plan B (§8), jamais une position de mur. Ce choix (drag seulement sur
     sélection déjà active, pas sur le tout premier clic) simplifie la désambiguïsation clic/glissé — un
     premier clic-glissé sur un mur non sélectionné le sélectionne juste, sans lire le glissé.
   - **Deux fonctions pures nouvelles** (`shared/world/roomGeometry.js`, testées indépendamment l'une de
     l'autre puis croisées) : `wallRunReshapeCells(run, rowCount)` — tronçon + rangées signées → lot de
     cases, dérivée et vérifiée à la main ligne par ligne contre la construction réelle des arêtes
     (`roomBoundaryEdges`), jamais supposée ; `wallRunRowCountForCell(run, cell)` — l'inverse, case survolée
     → rowCount. 10 tests neufs (`roomGeometry.test.mjs`, 24/24 avec les existants), dont un test croisé qui
     vérifie que les deux fonctions s'accordent sur de vrais tronçons de `roomBoundaryWallRuns`, pas seulement
     sur des objets inventés à la main — aucune des deux coordonnées (case, rangée) ne passe jamais par
     `SURFACE_FINE`, cause du bug d'échelle qui avait fait échouer la première tentative (§8).
   - **Câblage** (`SurfaceEditorScene.jsx`) : `SelectableRoomWall` appelle un nouveau `onReshapeStart` au lieu
     de `onToggle` quand le tronçon cliqué est déjà actif et droit ; `handleWallReshapeStart` amorce le drag
     générique existant (`dragRef`/`setDrag`, mode `'wall-reshape'`) au lieu d'un second système
     d'événements — `handleMouseMove` n'a nécessité AUCUNE modification (le mode retombe déjà sur
     `getFloorCell`, la branche générique) ; seul `handleMouseUp` reçoit une branche neuve. Seuil de 6 px
     (`WALL_RESHAPE_CLICK_THRESHOLD_PX`) avant de compter un glissé, pour ne jamais pousser le mur d'une
     rangée sur un simple re-clic (`wallRunRowCountForCell` n'a jamais de valeur neutre). Aperçu vert/rouge en
     direct réutilisant `RoomFootprintPaintPreview` telle quelle — même rendu que Plan B, pas dupliqué.
   - **Hors périmètre v1, assumé** : tronçons courbes (arcs) — pas de poignée dessus, comportement clic
     inchangé. Annuler en cours de glissé (un des 8 problèmes UX du §8) : couvert par le clic droit déjà
     générique à tout le système de drag (`cancelDrag`), pas par Échap (qui ne coupe pas un drag actif, aucun
     mode de drag ne le fait aujourd'hui — cohérent avec l'existant, pas une régression propre à la poignée).
   - **`node --check`/`eslint`/`build` propres.** Ce qui N'A PAS pu être vérifié sans navigateur : le geste
     réel (le clic sur le maillage 3D du mur déclenche-t-il bien avant le mousedown générique du canvas, la
     poignée « se sent »-elle bien) — repose sur l'ordre `pointerdown` avant `mousedown` du standard DOM et
     sur le patron `skipNextCanvasMouseDownRef` déjà éprouvé (connecteurs, sélection de mur), pas une
     supposition neuve, mais un point que seul un test en jeu peut confirmer.

Chaque incrément 4b/5 reste un plan à part entière avant son propre code — rien commencé sur ceux-là.

## 13. Constitution de l'interface — la règle explicitée, la faille qu'elle révèle, résolution

Déclencheur (Saar, 2026-09-30) : « j'ai du mal à comprendre ce choix... est-ce qu'il y a une logique ? Ou
c'est du random ? » à propos du partage sidebar/fenêtre, après avoir repéré que la poignée de
redimensionnement (§10c/12.10 point 6) et le mode sidebar « Remodeler » (Plan B, §8) font manifestement la
même famille de choses par deux chemins différents. La règle existait déjà par fragments (§12.9), jamais
énoncée comme une règle unique ni vérifiée mode par mode. Fait ici, avant tout nouveau code — Saar : « on
bloque tout le reste », priorité absolue à ce cadrage.

### 13.1. La règle

**Sidebar = quel outil est actif** (un verbe : « que fait mon prochain geste dans le viewport »).
**Fenêtre/dock = les attributs de l'objet sélectionné** (un nom : « qu'est-ce qu'EST cet objet »), prolongée
dans le viewport par des poignées de manipulation directe quand elles modifient un attribut de la sélection
— ces poignées appartiennent au dock, pas à la sidebar, même si le geste a lieu dans la vue 3D.

Sources externes qui confirment que ce n'est pas une invention : la distinction Toolbar/Properties editor de
Blender (le Toolbar détermine ce que fait un clic dans la vue, le N-panel affiche les attributs de l'objet
actif, indépendamment de l'outil) ; le code réel de l'éditeur three.js (`editor/js/Sidebar.js`, lu ce tour —
`UITabbedPanel` fixe qui empile arbre de scène et propriétés de la sélection, jamais un outil de création).

**Nuance nécessaire, pas une exception qui casse la règle** : un outil de peinture (Peindre un mur) reste
légitimement dans la sidebar même s'il cible une salle déjà choisie, parce que son geste est un parcours
libre du viewport (clics/glissés sur des cibles non prédéterminées à l'avance, un mur parmi N) — c'est
l'identité de pinceau qui est active, pas un attribut fixe qu'on consulte. La forme d'une salle (cases,
poignée), à l'inverse, N'A PAS de cible à choisir librement : elle porte toujours sur LA salle sélectionnée,
dans son ensemble — un attribut au même titre que sa couleur ou son épaisseur de dalle. C'est ce qui la
distingue de Peindre et la classe avec les attributs du panneau, pas avec les outils de la sidebar.

### 13.2. La faille — pas une nouvelle décision, un écart entre un plan déjà écrit et le code livré

`[VÉRIFIÉ, relecture du doc]` §12.9 point 4 (2026-09-29) le disait déjà : « La poignée de redimensionnement
est un sous-outil du panneau Salle sélectionnée, pas un 12ᵉ bouton de la colonne de gauche : "cases" et
"poignée" coexistent comme deux sous-modes d'édition de forme dans ce panneau. » L'incrément 6 (la poignée)
a été livré conforme à cette règle — elle ne s'active qu'en mode Sélection, sur un mur déjà actif, jamais
comme un bouton de sidebar. Mais **« Remodeler » (mode `reshape-room`, le pinceau de cases de Plan B) n'a
jamais été sorti de la sidebar** — il est resté un bouton du groupe « Finir » (`SurfaceEditorPanel.jsx` ligne
595), contredisant la règle que ce même chantier avait déjà tranchée. Ce que Saar a senti n'est pas un défaut
de la logique sidebar/fenêtre — c'est une migration commencée (la poignée) et jamais terminée (le pinceau de
cases est resté à l'ancien endroit).

### 13.3. Audit complet contre la règle du 13.1 — chaque mode, chaque panneau `[VÉRIFIÉ, code lu ce tour]`

**Sidebar — tous verbes, portée non prédéterminée, confirmés sains :**
- Sélection : état neutre, base à partir de laquelle les sous-outils du dock s'activent.
- Salle, Mur, Escalier, Passerelle, Porte/Ascenseur/Échelle : tracent/posent un NOUVEL objet — jamais un
  attribut d'un objet existant. Sains.
- Peindre (`paint-wall`) : cible une salle déjà choisie mais reste un parcours libre de murs non prédéterminés
  (nuance du 13.1) — sain, déjà unifié avec le panneau Mur au niveau donnée (§10b, même instance de
  `SurfaceMaterialEditor`), pas au niveau de son point d'entrée, et ce n'est pas nécessaire.
- Effacer (`erase`) : « Dessine une zone pour supprimer les éléments de l'étage choisi » — portée libre, tout
  l'étage, aucune salle présélectionnée requise. Sain.
- **Remodeler (`reshape-room`) : seul écart trouvé** — son propre indice le dit lui-même (« sur les cases de
  la salle SÉLECTIONNÉE ») : portée fixe (LA salle active dans son ensemble), pas un parcours libre. Un
  attribut, pas un outil. À sortir de la sidebar (13.4).

**Fenêtre/dock — tous attributs de la sélection, confirmés sains :**
- `SurfaceRoomPanel` : libellé, dalle/plafond, épaisseur de mur, connecteurs, suppression — tous des
  attributs de la salle. Recevra la forme (13.4).
- `SurfaceWallPanel` : matériau (`SurfaceMaterialEditor`), courbure (Inverser/Appliquer/Redresser — un
  attribut de forme du tronçon sélectionné, même famille que la forme d'une salle), suppression. Sain.
- `SurfaceConnectorPanel`/`SurfaceEffectPanel` : attributs du connecteur/de la zone sélectionnée, contrôles
  runtime maintenant correctement masqués en édition (§12.10 point 2). Sains.

**Conclusion de l'audit : la règle est bonne, un seul mode l'enfreint, un seul correctif à faire.** Pas de
refonte plus large nécessaire.

### 13.4. Résolution concrète — migration de « Remodeler » vers le panneau Salle

- Retirer le bouton « Remodeler » du groupe « Finir » dans `SurfaceEditorPanel.jsx` (passe de 3 boutons à 2 :
  Peindre/Effacer).
- Ajouter dans `SurfaceRoomPanel.jsx` une section « Forme » qui expose les deux sous-outils déjà prévus par
  §12.9 point 4, l'un à côté de l'autre : le pinceau de cases (mécanique interne `reshape-room` inchangée,
  seul le point d'entrée change) et la poignée (déjà fonctionnelle dans le viewport dès qu'un tronçon droit
  de la salle sélectionnée est actif, §12.10 point 6).
- **Faille de découvrabilité trouvée en creusant cette question, à corriger dans le même geste** `[VÉRIFIÉ]` :
  la poignée n'est mentionnée dans AUCUN texte d'indice (`hintSelect` ne parle que de la sélection de salle,
  pas de la poignée) et ne porte aucun signal visuel distinct au survol d'un mur déjà sélectionné (le
  survol/actif produit le même `showLine`, qu'on soit sur le point « ça va (re)sélectionner » ou « ça va
  glisser »). Sans la mention explicite dans la nouvelle section « Forme » du panneau, la poignée reste une
  fonctionnalité invisible découverte par accident. Corriger : mention explicite dans la section « Forme »,
  et si simple à faire dans le même geste, un curseur distinct (`grab`) au survol d'un tronçon déjà actif.
- Le hint `reshapeRoomHint` reste valide tel quel (déjà écrit pour « la salle sélectionnée », pas pour un
  bouton de sidebar). Le state `surfaceTool.mode === 'reshape-room'` reste identique en interne — seul son
  déclenchement change d'endroit.

**`[CODÉ]`** — Saar délègue (« tu es l'expert UX/UI... je te laisse faire »). Fait, dans l'ordre du 13.4 :
- `SurfaceEditorPanel.jsx` : bouton et icône « Remodeler » retirés du groupe « Finir » (2 boutons restants :
  Peindre/Effacer) ; son bloc d'indice/erreur dédié retiré aussi (devenu orphelin, plus aucun bouton ne
  l'ouvre depuis la sidebar).
- **`[VÉRIFIÉ en lisant, pas supposé]` obstacle réel trouvé en préparant ce déplacement** : `Editor3D.jsx`
  ferme `SurfaceRoomPanel`/`SurfaceWallPanel` dès que `surfaceTool.mode !== 'select'` (sauf une exception déjà
  câblée pour la pose de porte sur un mur sélectionné) — sans correction, le panneau Salle aurait disparu à
  l'instant même où son propre bouton « Remodeler » est cliqué, avant même de pouvoir peindre une case.
  Corrigé en étendant l'exception déjà existante (`mode === 'reshape-room'` ajouté à la liste, même
  raisonnement que l'exception porte : toujours la même salle sélectionnée).
- `SurfaceRoomPanel.jsx` : nouvelle section « Forme » (`FloatingPanelSection`), entre Géométrie et
  Déplacement/collision — un bouton qui bascule `reshape-room`/`select` (mécanique interne `reshape-room`
  inchangée), un rappel textuel explicite de la poignée (§13.1's faille de découvrabilité) affiché tant que
  le mode est actif, et l'erreur d'arc (`roomArcError`) déplacée ici avec son déclencheur.
- **Hors périmètre, assumé** : pas de curseur distinct au survol d'un mur déjà sélectionné (§13.4 l'envisageait
  « si simple ») — aucun mécanisme de changement de curseur n'existe encore dans `SurfaceEditorScene.jsx`
  (`[VÉRIFIÉ]`, recherché), l'introduire aurait été une nouvelle plomberie, pas une extension simple. Le
  rappel textuel dans la section « Forme » reste le correctif de découvrabilité livré ce tour.
- `builder.json`/`fr.json` : trois clés neuves (`surfaceRoomPanel.shapeSection/reshapeButton/reshapeHint`),
  une clé morte retirée (`surfaceEditor.reshapeRoom`, plus aucun appelant). `npx eslint`/`node --check`
  JSON/`npm run build` propres (0 erreur, avertissements React Hooks préexistants dans `Editor3D.jsx`, sans
  rapport avec ce correctif). Pas encore testé par Saar en navigateur.

### 13.5. Correctifs après le premier test navigateur de Saar (2026-09-30) — livré non testé, 5 défauts réels

Le §13.4 livré sans jamais avoir été vu tourner. Saar, en le testant : « Tu es vraiment en mode expert
UI/UX ?! ... Tu n'es PAS au niveau du tout. » Cinq défauts concrets, tous corrigés dans la foulée, avant
pause forcée demandée par Saar.

1. **`[CORRIGÉ]` Chevauchement fenêtre/sidebar** — `[VÉRIFIÉ, jamais vérifié avant]` la sidebar occupe déjà
   le bord droit de l'écran (poignée de redimensionnement à gauche de la sidebar, largeur variable
   220-500px, `Sidebar.styles.js`/`SessionPage.jsx`) — le panneau Salle/Mur fixé en `right:16` (increment
   4a) recouvrait la sidebar dès que sa largeur dépassait ce décalage minimal, jamais testé en navigateur
   avant ce tour. Un patron déjà établi pour exactement ce problème existait (`sidebarWidth` passé en prop,
   utilisé par `DicePanel`/`EncyclopediaWindow`/`CombatOverlay`) mais n'était pas branché sur `Editor3D`.
   Branché : `SessionPage.jsx` → `Editor3D.jsx` (nouvelle prop `sidebarWidth`) → `SurfaceRoomPanel.jsx`/
   `SurfaceWallPanel.jsx` (nouvelle prop `dockRight = sidebarWidth + 16`, remplace le `right:16` figé).
2. **`[CORRIGÉ]` Section « Forme » stupide** — Saar : « Géométrie sert à ça. » Fusionnée dans la section
   Géométrie existante (plus de section dédiée) — la classification verbe/nom du §13.1 restait juste, mais
   je l'ai traduite en une nouvelle section plutôt que de vérifier si une section existante du même panneau
   couvrait déjà la forme (elle le fait : dalle/plafond/épaisseur de mur y sont déjà). Erreur de jugement,
   pas d'invalidation de la règle.
3. **`[CORRIGÉ]` Libellé du bouton** — « Remodeler (peindre les cases) » → « Remodeler » (`builder.json`).
4. **`[CORRIGÉ]` Peinture du plafond inutile** — `[VÉRIFIÉ, code de rendu lu]` `SurfaceDungeonScene.jsx`
   (`ceilingIsVisible`) conditionne l'affichage du plafond à `displayLevel`/au volume caméra ; en édition
   (un seul étage affiché), le plafond de la salle éditée ne remplit quasiment jamais ces conditions —
   cohérent avec l'observation de Saar. Onglet Plafond retiré de la section Apparence de
   `SurfaceRoomPanel.jsx` (ne montre plus que Sol, sans sélecteur d'onglet devenu inutile à une seule
   option) ; **la donnée `materialProfiles.ceiling` n'est pas supprimée**, seule cette UI ne l'expose plus —
   au cas où un autre contexte de vue la rendrait un jour pertinente.
5. **`[CORRIGÉ]` Portée de peinture de mur « oubliée »** — le sélecteur case/tronçon/salle existait bien
   dans le code (`[VÉRIFIÉ]`, pas une régression de ce chantier), mais rien ne la rappelait dans le bandeau
   d'indice persistant (§12.9 point 2) une fois qu'on peint et que les boutons défilent hors champ — même
   famille de défaut que la poignée non découvrable (§13.4). `paintWallRoomHint` affiche maintenant la
   portée active (`{{scope}}`), aux deux endroits où cet indice s'affiche.

`npx eslint`/JSON/`npm run build` propres (0 erreur) sur les 7 fichiers touchés. Pas encore re-testé par
Saar. **Leçon retenue, pas encore appliquée à un correctif futur** : le §13.4 a été livré et documenté
comme fait sans jamais avoir tourné dans un navigateur — le mot « codé » dans ce document a couvert du code
qui compile, pas du code vu fonctionner. Distinction à tenir explicitement à partir de maintenant.

### 13.6. Revue détaillée du panneau Salle par Saar (2026-09-30, en testant §13.5) — `⚠️ clos partiel`

Saar a ouvert le panneau et listé 7 points concrets, panneau sous les yeux. Traités :
1. **`[CORRIGÉ]`** Titre + champ « Nom de la salle » redondants (les deux affichaient le même id brut
   type `room:-24:...` tant qu'aucun nom n'est donné) → titre du header rendu éditable inline (icône
   crayon `IconEdit`, déjà existante dans `SidebarIcons.jsx`, réutilisée), champ séparé retiré.
2. **`[CORRIGÉ]`** « Étage de base » / « Volume » : deux lignes → une seule ligne compacte.
3. **`[CORRIGÉ]`** « Déplacement et collision » (section peu utilisée) déplacée en dernier, après
   Apparence — devient la dernière section utile puisque Connecteurs verticaux disparaît (point 7).
4. **`[CORRIGÉ]`** Doublon « Apparence » (titre de section) / « Apparence de la salle » (libellé
   dessous) → libellé retiré, un seul intitulé.
5. **`[NOTÉ, pas fait]`** Aperçu visuel pour Matière/Motif au lieu de listes texte — techniquement
   possible (`generateProceduralMaterialTexture` existe déjà, produit de vraies textures) mais demande
   une vraie conception (combien de miniatures, quand les générer, coût de rendu) — pas bricolé dans le
   même geste que les 4 corrections ci-dessus. Reste ouvert, chantier propre à cadrer.
6. **`[NOTÉ]`** Nuancier custom pour la Peinture — déjà identifié comme mini-chantier séparé plus tôt
   dans cette conversation, pas répété ici.
7. **`[CORRIGÉ]`** Section « Connecteurs verticaux » retirée du panneau Salle (doublon avec le groupe
   Connecteurs de la sidebar — cohérent avec la règle §13.1 : poser un ascenseur/une échelle est un
   verbe, sa place est la sidebar, pas le panneau de propriétés). `startConnector` et les clés i18n
   associées (`connectorsSection`/`elevatorButton`/`ladderButton`/`roomAppearanceLabel`) retirés,
   devenus morts.

`npx eslint` (0 problème), JSON, `npm run build` propres. **Non testé : rien en navigateur.**

## 14. Motifs importés — height maps réelles au lieu de motifs dessinés à la main (2026-09-30)

Saar fournit 36 height maps (CC0, ambientCG et équivalents) réparties en 5 familles
(metal/metal-tiles/concrete/plaster/plastic), 512px, dans `docs/PLANS/Motifs/` — dossier `SOURCE/`
(source4k + source1k, 530 Mo) explicitement exclu, seules les versions 512px retenues (14 Mo).

**`[CODÉ]`, `⚠️ clos partiel` — rien vu en navigateur.**

- Fichiers copiés dans `client/public/textures/displacement/<metal|metal-tiles|concrete|plaster|
  plastic>/` (assets statiques servis avec l'app, aucun passage par la base/MinIO — vérifié que
  `texture-packs.js`/`voxel_textures` sert un système différent, textures de voxels, pas réutilisable
  ici sans le dénaturer).
- Nouveau module `client/src/lib/displacementMaps.js` : décode chaque PNG une fois (canvas → canal
  rouge → `Float32Array` 0..1), cache mémoire par `src`, `sampleDisplacementMap(src, u, v)` tuilé
  (wrap). Renvoie 0.5 (neutre) tant qu'un fichier n'est pas encore décodé.
- **Chargement** : tous les motifs importés sont préchargés au chargement du module
  `proceduralMaterials.js` (36 petits fichiers, même origine) plutôt que chargés à la demande avec un
  mécanisme de rafraîchissement — plus simple, aucune modification de `SurfaceDungeonScene.jsx`
  (2000+ lignes, cache de matériaux par descriptor jamais invalidé sans ça) nécessaire. Le cas
  « relief plat parce que pas encore chargé » reste possible en théorie mais improbable en pratique.
- 36 nouvelles entrées dans `PATTERN_PRESETS` (`proceduralMaterials.js`), chacune `{id, label, group,
  src}` — préfixe `img_`, groupées par famille. Les 16 motifs procéduraux existants reçoivent
  `group: 'Procédural'` pour la cohérence.
- `samplePatternHeight`/`applyPattern` : nouveau branchement en tête (`IMPORTED_PATTERN_SRC[pattern]`)
  qui échantillonne la vraie image au lieu du calcul procédural — recentré autour de 0 (`(brut - 0.5) *
  0.5 * relief`) pour rester compatible avec le buffer de hauteur partagé (peinture/usure/crasse
  continuent de s'appliquer par-dessus sans changement).
- Liste « Motif » regroupée en `<optgroup>` (nouveau `PROCEDURAL_PATTERN_GROUPS`, calculé une fois) —
  nécessaire dès qu'elle passe de 16 à 52 options. Appliqué aux deux consommateurs existants
  (`SurfaceMaterialEditor.jsx`, `MaterialGeneratorTab.jsx`), pas seulement celui visé au départ.
- `npx eslint` (0 problème), `node --test client/src/lib/surfaceData.test.mjs` (49/49, aucune
  régression), `npm run build` propres.

**Point réglé** : Saar a supprimé lui-même `docs/PLANS/Motifs/` (dont `SOURCE/`, 530 Mo) une fois les
36 fichiers utiles vérifiés en place dans `client/public/`. Rien à commiter côté doc/plan pour ce
dossier — il n'existe plus.

### 14.1. Correctif de performance — chargement paresseux, décodage réduit (2026-09-30)

Saar signale 3-4 secondes d'écran noir au chargement, après §14. **`[HYPOTHÈSE]` raisonnée, jamais
mesurée avec un profileur** : le préchargement de §14 décodait les 36 fichiers d'un coup au chargement
du module (`new Image()` + `ctx.getImageData()` en pleine résolution 512px) — une lecture de pixels
pleine résolution bloque le fil principal, 36 fois d'affilée pouvant suffire à l'geler. Saar : « SI ET
SEULEMENT SI ce n'est pas du bricolage » — refonte, pas un correctif local :

- **Chargement paresseux** : plus de préchargement au chargement de l'app. `sampleDisplacementMap`
  (`displacementMaps.js`) déclenche lui-même le chargement d'une source à son premier échantillonnage
  réel, jamais avant — le coût devient proportionnel à ce qui est réellement affiché, pas au nombre
  total de motifs au catalogue (36 aujourd'hui, autant demain si la liste grossit).
- **Décodage réduit** : `createImageBitmap({resizeWidth/Height: 256, resizeQuality:'high'})` remplace
  `new Image()` + lecture pleine résolution — le redimensionnement est déporté au navigateur (hors fil
  principal sur la plupart des implémentations), et la lecture de pixels finale porte sur 256px, pas
  512px (4× moins de données). 256 choisi avec marge sur les deux appelants réels de
  `generateProceduralMaterialTexture` (128px fixe côté `SurfaceDungeonScene.jsx`, `tile_size` par
  défaut 128 côté `MaterialGeneratorTab.jsx`) — pas un cache par taille demandée, aucun appelant
  actuel n'en a besoin (`feedback_quality_architecture_first` : ne pas résoudre un besoin que
  personne n'a exprimé).
- **Problème réintroduit par le chargement paresseux, résolu proprement cette fois** : un motif
  importé pas encore chargé au moment du bake produit un relief neutre (plat) — correct dans
  l'instant, mais l'ancien design (préchargement massif) évitait d'avoir à corriger ça une fois le
  fichier chargé. `proceduralMaterials.js` expose `isImportedPatternReady`/`onImportedPatternReady`
  (le mapping motif → fichier reste encapsulé, `SurfaceDungeonScene.jsx` ne connaît que l'id du
  motif) ; `SurfaceDungeonScene.jsx` : `proceduralMaterialAt` enregistre un callback quand un motif
  n'était pas prêt au bake — au chargement réel, il retire l'entrée périmée du cache
  (`proceduralSurfaceMaterialCache`) et prévient un registre d'écouteurs (`sceneRefreshListeners`,
  module local à ce fichier) ; le composant racine `SurfaceDungeonScene` s'y abonne une fois
  (`useState`/`useEffect`) et force un nouveau rendu de tout l'arbre à la notification — aucun des
  composants enfants (`RoomFloorSurface` etc., 11 points d'appel, aucun `React.memo`, vérifié) n'a
  besoin d'être touché individuellement.
- `npx eslint` (0 problème), `node --test client/src/lib/surfaceData.test.mjs` (49/49), `npm run
  build` propres. **Non mesuré : la durée réelle du gel avant/après** — seul Saar peut confirmer que
  le délai a effectivement disparu ou nettement diminué.

### 14.2. Retrait des motifs procéduraux, Relief à 50 % au choix d'un motif (2026-09-30)

Saar, en testant §14.1 : « Mieux sur le point du préchargement... RELIEF devrait passer à 50 % dès
qu'un motif est sélectionné. Les motifs procéduraux, on peut les dégager. »

**`[CODÉ]`, `⚠️ clos partiel` — rien vu en navigateur.**

- **Relief auto à 50 %** : `SurfaceMaterialEditor.jsx`/`MaterialGeneratorTab.jsx`, le `onChange` du
  sélecteur Motif force `relief: 50` dès qu'un motif réel est choisi (pas au retour à « Aucun
  motif », relief laissé tel quel dans ce sens) — sans ça, choisir un motif avec Relief à 0 (valeur
  par défaut) ne montrait strictement rien, aucun signal que le motif s'était bien appliqué.
- **Retrait des 15 motifs procéduraux** (Plaques rivetées, Dalles jointes, Planches, Tôle striée,
  Surface rugueuse, Panneaux nervurés, Tôle ondulée, Bandes longitudinales, Anneaux boulonnés, Trame
  hexagonale, Plaques superposées, Béton coffré, Béton segmenté, Plaques soudées, Peinture cloquée) —
  les motifs importés (§14) les rendent obsolètes, c'était exactement leur défaut d'origine (dessinés
  à la main, approximatifs). `none` reste (état « pas de relief », pas un motif à comparer).
  Suppression complète, pas un simple retrait de la liste : les 15 fonctions `apply*`/`sample*`
  dédiées (~440 lignes), `patternAccumulationMask` (n'avait plus de motif à reconnaître une fois les
  3 patterns qu'elle ciblait retirés — ses deux appels dans `applyWear`/`applyDirt` simplifiés en
  retirant le seul terme `feature` de leurs formules, pas de rustine de compat), et les helpers
  devenus orphelins (`metalPanelLineWidths`, `lowerRect`, `strokeInsetRect`, `patternGrooveColor`,
  `patternHighlightColor`, `METAL_PANEL_EDGE_WIDTH_FACTOR`) — trouvés via `eslint` (`no-unused-vars`),
  pas par relecture manuelle exhaustive. `applyPattern`/`samplePatternHeight` réduites à leur seule
  logique restante (juste la branche motif importé).
- **Compatibilité arrière, non vérifiée** : une salle/mur déjà sauvegardé avec un de ces 15 ids de
  motif retombera sur `PATTERN_PRESETS[0]` (`'none'`) au prochain rendu — relief silencieusement
  perdu pour ce mur, pas de crash. Acceptable ici (fonctionnalité livrée dans cette même session,
  aucune carte de Saar n'a eu le temps de s'appuyer dessus), mais **jamais vérifié en base** — si un
  test en navigateur révèle un mur avec ce problème, ce sera la cause.
- `npx eslint` (0 problème), `node --test client/src/lib/surfaceData.test.mjs` (49/49, aucune
  régression), `npm run build` propre (taille du bundle en légère baisse, cohérent avec le retrait).
- **`[NOTÉ]` Reste ouvert, jamais cadré** : outil ÉCHELLE (scale) pour redimensionner/tuiler un motif importé
  indépendamment de sa résolution source (demande de Saar en testant §14.1, jusqu'ici seulement discutée en
  conversation, pas consignée — corrigé ici pour ne pas la perdre). Aujourd'hui `sampleDisplacementMap`
  mappe `u,v` directement sur le motif complet sans facteur de répétition ; ajouter l'échelle touchera
  `displacementMaps.js` et le sixième champ (`relief`) de `SurfaceMaterialEditor.jsx`/
  `MaterialGeneratorTab.jsx` — son propre plan avant tout code, pas mélangé à un autre tour.

## 15. Bilan et plan d'action — demande explicite de Saar avant compactage (2026-09-30)

Analyse sérieuse de ce qui reste, faite avant compactage pour que ce document seul suffise à reprendre —
pas la mémoire de session, qui disparaît. Statuts vérifiés à l'instant (git/wc -l), pas recopiés d'ailleurs.

### 15.1. Ce qui est fait, poussé, testé — ne pas retoucher sans raison neuve

- Constitution sidebar/dock (§13), motifs importés + chargement paresseux (§14/§14.1), retrait des motifs
  procéduraux + Relief auto (§14.2), pile d'annulation fusionnable (§12.10 pt 5), décomposition complète de
  `SurfaceEditorScene.jsx` en un fichier par responsabilité (§11.7→§11.14, 1550→958 lignes, -38 %, 13
  fichiers neufs sous `surfaceTools/`). **`[VÉRIFIÉ]` pas encore poussé au moment d'écrire ceci** (6
  commits d'avance sur `origin/dev/Saar`, jusqu'à `e6d32a19` inclus) — à pousser avant tout compactage pour
  que l'état durable ne vive pas que dans une conversation qui va être résumée.
- **Peinture de mur (Lot A)** : le statut « EN PAUSE » du §9 est **périmé**, pas corrigé sur place pour
  préserver l'historique. Depuis, l'outil a été retesté en jeu à plusieurs reprises dans cette même session
  (§11.13, portée case/tronçon/salle) et confirmé fonctionnel — traité comme un chantier clos en pratique,
  bien que le §9 lui-même ne porte aucune mention de clôture. À corriger si un doute resurgit dessus.

### 15.2. Ce qui reste réellement — 5 chantiers indépendants, chacun son propre plan

1. **Décomposition de `Editor3D.jsx` (1616 lignes) et `SurfaceEditorPanel.jsx` (1341 lignes)** — même dette
   que `SurfaceEditorScene.jsx` avant ce tour (`[OBSERVÉ]` §11.3 point 6), **jamais commencée**. `[HYPOTHÈSE]`
   non vérifiée : leur contenu n'est pas de la même nature que `Scene.jsx` (qui était surtout de la gestion
   d'événements pointeur + rendu d'aperçu — un bon candidat pour « un outil, un fichier »). `Editor3D.jsx`
   orchestre l'état (panneaux, pile d'annulation, sauvegarde réseau) ; `SurfaceEditorPanel.jsx` est
   presque entièrement du JSX (boutons, sections par mode). Le même patron pourrait s'appliquer côté panneau
   (une section de sidebar par outil = un fichier), mais ça n'a jamais été vérifié ligne par ligne comme
   `Scene.jsx` l'a été — **à auditer avant de supposer que la même méthode s'applique tel quel**.
2. **Outil ÉCHELLE (scale/tuilage) pour les motifs importés** (§14.2, note ci-dessus) — demande de Saar,
   jamais cadré.
3. **Aperçu visuel (miniatures) pour Matière/Motif** (§13.6 point 5) — demande une vraie conception
   (nombre de miniatures, quand les générer, coût de rendu), jamais cadré.
4. **Nuancier custom pour la Peinture** (remplacer les 9 `<input type="color">` natifs du projet) — mini-
   chantier identifié tôt dans le chantier, jamais cadré.
5. **Pose d'une échelle-connecteur sur une autre échelle** (continuité verticale multi-étages, demande de
   Saar au §11.7) — cause exacte non vérifiée (`makeLadderConnectorFromCell`/`applyLadderConnector`,
   `client/src/lib/connectors.js`, jamais relus pour ce point précis), jamais cadré.

### 15.3. Plan d'action proposé — ordre et pourquoi

**Un chantier à la fois, plan → analyse à charge → code, comme toujours.** Ordre suggéré, pas imposé :

1. **Auditer `Editor3D.jsx`/`SurfaceEditorPanel.jsx` avant de décider s'ils se décomposent pareil** —
   lecture complète d'abord (comme pour `Scene.jsx`), pas une extraction mécanique par optimisme. S'ils
   s'y prêtent, même méthode (un outil à la fois, test croisé, commit par lot). S'ils ne s'y prêtent pas,
   le dire clairement plutôt que de forcer le patron.
2. **Puis les 4 mini-chantiers (2-5 ci-dessus), un par un**, du plus petit au plus gros : échelle-sur-
   échelle (bug ciblé, cause à vérifier d'abord) → outil ÉCHELLE motif (petit, 2 fichiers touchés) →
   miniatures Matière/Motif (demande une conception, pas juste du code) → nuancier custom (9 emplacements,
   le plus transverse).

Rien de ceci n'est engagé — présenté pour décision de Saar avant tout code, comme le reste de ce chantier.

## 16. Audit `Editor3D.jsx` / `SurfaceEditorPanel.jsx` — §15.3 point 1, lecture complète faite (2026-09-30)

Lecture intégrale des deux fichiers (1616 + 1341 lignes), comme `Scene.jsx` l'avait été avant sa
décomposition. `[VÉRIFIÉ]` l'hypothèse `[HYPOTHÈSE]` du §15.2 point 1 : **ils ne se découpent pas de la
même façon l'un que l'autre, ni de la même façon que `Scene.jsx`** — trois formes différentes, pas une.

### 16.1. `SurfaceEditorPanel.jsx` (1341 lignes) — le bon candidat « un outil, un fichier »

Presque entièrement du JSX conditionnel sur `surfaceToolState.mode` (lignes 373-1340) : un bloc par mode
(Salle, Mur, Escalier/Passerelle, Connecteur avec sous-cas porte/ascenseur/échelle, Peindre un mur avec sa
portée case/tronçon/salle, Zone d'effet avec formulaire d'effet personnalisé + liste des zones posées),
chaque bloc lisant surtout `surfaceToolState`/`updateSurfaceTool` et peu de dérivés locaux. Même patron que
`Scene.jsx` avant ce tour : blocs déjà délimités par `if (surfaceToolState.mode === '...')`, faible
couplage entre blocs. **Le même chantier « un fichier par responsabilité » s'applique tel quel** — extraire
chaque bloc vers `surfaceTools/<Mode>PanelSection.jsx`, props = `surfaceToolState`, `updateSurfaceTool`,
et les quelques callbacks/dérivés spécifiques (ex. `connectorChoices`, `worldEffects` pour le bloc Effet).

### 16.2. `Editor3D.jsx` (1616 lignes) — deux parties de nature différente

- **`EntityEditorScene` (lignes 114-795, ~680 lignes)** : scène de l'onglet Entités — mêmes ingrédients que
  `Scene.jsx` avant décomposition : handlers pointerdown/pointerup/pointermove/keydown (rotation R, snap
  grille G, suppression Delete) + fonctions de calcul pur (`calcEntityPos`, `calcPreciseEntityPos` — pose
  au sol/sur mur avec supports voxels/sol/entités empilées —, `entityTopSupportAt`, `getEntityUnderCursor`).
  **Même méthode que ce tour applicable telle quelle** : extraire les fonctions de calcul pur vers
  `lib/entityTools/` (ou `surfaceTools/` si on juge le regroupement plus simple), test croisé par fonction,
  glue (état React, appels API, émissions socket) laissée en place dans `EntityEditorScene`.
- **Le composant `Editor3D` principal (lignes 806-1616, ~810 lignes)** : PAS un dispatch par mode d'outil —
  de l'orchestration transverse : chargement voxels/surface depuis `battlemap`, deux files de sauvegarde
  fire-and-forget avec suivi de révision (voxels + surface), pile d'annulation/rétablissement fusionnable
  (§12.10 pt 5) avec ses raccourcis clavier, état d'ouverture des 3 panneaux flottants (connecteur/salle/mur)
  et leurs effets de fermeture automatique, raccourcis clavier globaux (Échap, chiffres 1-5 géométrie), et
  le rendu final (Canvas + 2 scènes + 3 panneaux). **Le patron « un outil, un fichier » ne s'applique pas ici
  — la matière n'est pas un dispatch d'outil mais des préoccupations transverses.** Un découpage cohérent
  serait par préoccupation, extraite en hook dédié : `useSurfaceUndoRedo` (pile + fusion + raccourcis),
  `useBattlemapPersistence` ou deux hooks distincts pour les files voxels/surface (save queue + revision +
  auto-save 60s + save au démontage), `useSurfacePanels` (état des 3 panneaux + fermetures croisées). Pas
  vérifié plus finement que cette lecture (pas de découpage fichier par fichier proposé ici, juste la forme
  du problème) — à cadrer comme son propre lot si Saar veut poursuivre ce chantier plutôt que les 4
  mini-chantiers du §15.2.

### 16.3. Ce que ça change pour l'ordre proposé au §15.3

L'audit demandé est fait ; la réponse n'est pas « oui, même méthode partout » ni « non, rien ne s'applique »
mais **trois découpages différents pour trois matières différentes**, dont un (les hooks d'`Editor3D`) n'a
jamais été pratiqué dans ce chantier — pas la simple continuation mécanique du patron déjà validé.
Décision pour Saar : poursuivre ici (probablement `SurfaceEditorPanel.jsx` d'abord, le plus mécanique et le
moins risqué des trois) ou basculer sur les 4 mini-chantiers du §15.2 dans l'ordre déjà proposé. Rien
d'engagé, aucun code écrit pour ce point.

### 16.4. Décision tranchée (Saar délègue le choix technique, 2026-09-30) — recherche faite avant de coder

Saar délègue explicitement le choix technique, avec pour seule contrainte le respect des priorités du
projet (architecture saine, robuste/pérenne, adaptative — jamais de bricolage). Recherche faite avant de
trancher (Règle « recherche avant de coder ») :

- **tldraw** (`HistoryManager`) : pile d'annulation par « marks » (points d'arrêt explicites) plutôt qu'un
  snapshot à chaque tick — c'est très exactement le principe déjà en place dans `Editor3D.jsx` depuis le
  `mergeKey` du §12.10 pt 5. Confirmation, aucun changement nécessaire sur ce point.
  Source : https://tldraw.dev/sdk-features/history
- **React (doc officielle)** : un hook personnalisé se justifie pour un cas d'usage concret et nommable
  (`useSurfaceUndoRedo`, pas un wrapper générique type `useMount`/`useEffectOnce`). Les trois blocs
  transverses identifiés en §16.2 (pile d'annulation, files de sauvegarde, état des panneaux) correspondent
  chacun à un cas concret et nommable — le patron s'applique légitimement, ce n'est pas une abstraction
  gratuite. Source : https://react.dev/learn/reusing-logic-with-custom-hooks
- **Excalidraw** : a fait la même bascule sur son propre panneau (sidebar monolithique → sections/onglets
  séparés) — confirme que « une section de panneau, un fichier » est un patron pro reconnu pour ce genre
  de fichier, pas une invention de ce chantier. Source : https://github.com/excalidraw/excalidraw/issues/6124

**Ordre retenu** : `SurfaceEditorPanel.jsx` (patron déjà prouvé sur `Scene.jsx`, le plus mécanique) →
`EntityEditorScene` dans `Editor3D.jsx` (même méthode, deuxième preuve avant de la généraliser) → hooks
transverses d'`Editor3D.jsx` (patron neuf pour ce chantier, en dernier) → **puis** les 4 mini-chantiers du
§15.2. Raison de cet ordre, pas seulement « le plus facile d'abord » : au moins deux des quatre
mini-chantiers (nuancier custom, outil ÉCHELLE motif) touchent directement `SurfaceEditorPanel.jsx` —
les faire atterrir dans des sections déjà séparées plutôt que dans le fichier monolithique évite d'ajouter
de la matière neuve à un fichier qu'on sait devoir démonter ensuite.

### 16.5. Décomposition de `SurfaceEditorPanel.jsx` — premier incrément (2026-09-30)

Deux sections extraites, `eslint`/`build` propres, non testées en navigateur (checkpoint demandé avant de
poursuivre sur les blocs plus gros — Connecteur/Salle/Mur/Zone d'effet touchent chacun plusieurs dizaines
de handlers, risque de mauvais câblage de prop plus élevé que ces deux premiers) :

- **`EntityPalettePanelSection.jsx`** (nouveau) — palette de l'onglet Objets 3D, bloc totalement autonome
  (son propre `activeEditorTab === 'entity'`), aucun couplage avec les outils du monde. Lit
  `useEntityStore()` directement (patron déjà utilisé ailleurs, ex. `Editor3D.jsx`) plutôt que de recevoir
  `blueprints`/`refreshBuiltinModels` en props — évite un simple relais. `blueprintPlacementMode` dupliqué
  tel qu'il l'était déjà dans 4 fichiers avant ce tour (`Editor3D.jsx`, `EntityInstancePanel.jsx`,
  `EntityBuilderTab.jsx`) — dette préexistante, pas corrigée ici (hors périmètre de cet incrément).
- **`PaintWallPanelSection.jsx`** (nouveau) — réglages du mode Peindre un mur (portée case/tronçon/salle +
  éditeur de matériau). A révélé que `CHIP_BTN_STYLE` et `PAINT_WALL_SCOPE_LABEL_KEYS` sont utilisés à la
  fois par ce bloc et par le bandeau d'indice resté dans le fichier principal — extraits dans
  `surfaceTools/panelSharedConstants.js` plutôt que dupliqués (la duplication aurait été un vrai risque :
  deux listes de clés qui divergent silencieusement).
- Les icônes SVG et `TAB_ICON_BTN_STYLE` restent dans `SurfaceEditorPanel.jsx` — utilisés uniquement par le
  sélecteur d'outil (le bandeau de boutons lui-même), qui reste le menu central, pas une section par outil.
- `SurfaceMaterialEditor` n'était importé que pour ce bloc — import retiré du fichier principal.
- 1341 → 1232 lignes (`wc -l`, pas `Measure-Object`).

### 16.6. Décomposition de `SurfaceEditorPanel.jsx` — deuxième incrément, les 4 blocs restants (2026-09-30)

Testé fonctionnel par Saar entre les deux incréments (§16.5). Quatre sections extraites, `eslint`/`build`
propres, pas encore testé en navigateur au moment d'écrire ceci :

- **`ConnectorPanelSection.jsx`** (nouveau) — champs Ascenseur + choix du modèle 3D + couleurs de matériau.
  **Ne couvre pas tout le mode Connecteur** : le petit bloc Échelle (étage d'arrivée + orientation, 2
  champs) reste inline dans `SurfaceEditorPanel.jsx`, à un autre endroit du JSX (avant le champ transverse
  « coût de déplacement », alors que ce composant est rendu après) — les fusionner aurait changé l'ordre
  d'affichage réel pour le mode Échelle sans raison technique. Choix délibéré de ne pas forcer une pureté
  « un mode = un fichier unique » au prix d'un changement visuel, consigné ici plutôt que corrigé en
  silence. Contient aussi une condition redondante héritée de l'original
  (`surfaceToolState.mode === 'connector'` vérifiée une deuxième fois alors que le fragment parent le
  garantit déjà) — gardée telle quelle, pas nettoyée pendant l'extraction pour limiter le risque.
- **`EffectZonePanelSection.jsx`** (nouveau) — mode Zone d'effet complet : sélection du type d'effet,
  intensité/hauteur/puissance, formulaire de création d'effet personnalisé, liste des zones déjà posées.
- **`RoomPanelSection.jsx`** (nouveau) — mode Salle complet : dimensions (hauteur/épaisseur sol/épaisseur
  mur) ET matériau appliqué (face/matériau/motif/peinture/usure/saleté/relief/variations/collision),
  regroupés dans un seul composant bien qu'ils étaient séparés par le bloc Mur dans le DOM d'origine — sans
  effet visible puisque Salle et Mur ne sont jamais actifs simultanément (un seul `mode` à la fois).
- **`WallPanelSection.jsx`** (nouveau) — mode Mur droit : épaisseur + hauteur, seul reste un tout petit
  composant (36 lignes).
- Imports devenus morts dans le fichier principal retirés : `Object3DPreview`, `groupEffectDefinitions`,
  `materialSlotDisplayValue`, `MODEL_SLOT_LABELS`, `PROCEDURAL_MATERIAL_PRESETS`,
  `PROCEDURAL_PATTERN_PRESETS`. Le `<div style={roomToolGrid}>` vide qui entourait les 3 champs Salle
  disparaît pour les autres modes (aucun enfant, `display:grid` sans padding/hauteur déclarés dans
  `Sidebar.styles.js:101-105` — vérifié, aucun effet visuel).
- Reste dans `SurfaceEditorPanel.jsx` : le bandeau d'onglets haut niveau, la ligne annuler/refaire, le
  sélecteur d'outil (boutons + icônes SVG), le bloc Échelle (2 champs), le champ transverse « coût de
  déplacement », la palette de textures pré-faites (partagée Salle/Mur) et le bandeau d'indice — tout ce
  qui est soit menu, soit vraiment partagé entre plusieurs modes, cohérent avec §16.1.
- 1232 → 791 lignes (`wc -l`). Total du chantier §16.5+16.6 : 1341 → 791 (-41 %), 7 fichiers neufs sous
  `surfaceTools/` (1331 lignes cumulées, dont une bonne part de style/props JSX répété, pas de la logique
  neuve).

### 16.7. Correction d'une hypothèse du §16.2 — `calcEntityPos`/`calcPreciseEntityPos` ne sont pas extractibles en fonctions pures (2026-09-30)

En commençant l'étape 2 de l'ordre retenu (§16.4, `EntityEditorScene` dans `Editor3D.jsx`), relecture plus
attentive de ce que §16.2 avait proposé trop vite : « extraire les fonctions de calcul pur vers
`lib/entityTools/` ». Faux à l'exécution — `calcEntityPos`, `calcPreciseEntityPos` et
`getEntityUnderCursor` lisent directement `camera`, `gl`, `scene`, `raycaster` (objets Three.js vivants,
pas des données), exactement comme `getFloorCell`/`getWallPoint` dans `SurfaceEditorScene.jsx` — qui,
eux, n'ont JAMAIS été extraits pendant tout le §11, restés comme glue délibérément. Généraliser le patron
« extraire la décision pure » à des fonctions de raycasting aurait été la même erreur que la
généralisation évitée au §11.11 (preventDefault/stopPropagation) — repérée cette fois avant d'écrire du
code, pas après. **Correction** : ces trois fonctions restent dans `EntityEditorScene`. Ce qui est
réellement extractible, par analogie avec les aperçus déjà sortis de `Scene.jsx` au §11.8, ce sont les
petits composants de rendu pur déjà présents juste au-dessus d'`EntityEditorScene` dans `Editor3D.jsx` :
`GhostEntityBounds`, `TileSnapHighlight`, `GhostEntity` — voir §16.8.

### 16.8. Fantômes de pose d'entité extraits (2026-09-30)

- **`entityTools/GhostEntityBounds.jsx`**, **`entityTools/TileSnapHighlight.jsx`**,
  **`entityTools/GhostEntity.jsx`** (nouveaux, dossier neuf — ces composants concernent la pose d'entités,
  pas les outils de surface, `surfaceTools/` aurait été un nom trompeur). Aucune logique changée, purs
  composants de rendu déjà autonomes (props uniquement), même patron que les aperçus du §11.8.
  `eslint`/`build` propres.
- Reste dans `Editor3D.jsx` / `EntityEditorScene` : tout le reste — raycasting, drag, raccourcis clavier,
  appels API, émissions socket. Pas un dispatch par mode d'outil comme `Scene.jsx` l'était ; peu de matière
  supplémentaire extractible sans forcer le patron sur du code qui ne s'y prête pas (§16.7).
- 1616 → 1560 lignes (`wc -l`) — réduction modeste et attendue : la majorité du fichier est légitimement de
  l'orchestration/glue (§16.2), pas des composants de rendu purs comme ceux qui viennent d'en sortir.

### 16.9. Retour de Saar sur le sélecteur de portée de peinture de mur — à revoir plus tard, pas perdu (2026-09-30)

Saar signale que le module « peindre une CASE, une SECTION ou un mur complet » (portée
case/tronçon/salle) lui semble avoir disparu de la sidebar depuis la refonte UI/UX (§12/§13). **Vérifié
`[VÉRIFIÉ]` : le code existe toujours et fonctionne** — `PaintWallPanelSection.jsx` (§16.5) affiche les 3
boutons de portée, câblés sur `paintRoomWallEdges`/`paintRoomWallRoom`
(`client/src/lib/surfaceRooms.js:1172-1217`), accessible via l'outil « Peindre un mur » de la sidebar —
Saar l'a lui-même testé fonctionnel dans cette session (retour après §16.5). Rien de supprimé. Le
malentendu porte probablement sur l'emplacement/la visibilité de cet outil depuis la refonte §12-13 (plus
difficile à retrouver qu'avant), pas sur une perte de fonctionnalité — à revoir avec Saar plus tard, pas
cadré, rien changé ici.

### 16.10. Premier hook transverse extrait — `useSurfacePanels` (2026-09-30)

Suite de l'ordre retenu (§16.4) : après `SurfaceEditorPanel.jsx` et les fantômes d'`EntityEditorScene`,
premier essai du patron « hook » pour `Editor3D.jsx` — jamais pratiqué avant dans ce chantier.

- **`client/src/lib/useSurfacePanels.js`** (nouveau, convention du dépôt : hooks sous `lib/useXxx.js`,
  pas sous `components/`) — état et logique des 3 panneaux flottants (connecteur/salle/mur) : les 3
  `useState`, les 2 `useMemo` (connecteur/salle sélectionnés), les 9 handlers (select/patch/delete/close),
  les 4 `useEffect` de synchronisation. Reçoit `surfaceData`, `surfaceDataRef` (les deux — le ref pour les
  lectures « valeur la plus récente » dans patch/delete, `surfaceData` réactif pour les `useMemo`/`useEffect`,
  exactement la convention déjà en place dans `Editor3D.jsx`, pas une nouveauté), `surfaceTool`,
  `onSurfaceToolChange`, et `onSurfaceDataChange` (= `handleSurfaceDataChange`, qui reste dans
  `Editor3D.jsx` — le hook ne sait rien de la pile d'annulation ni des files de sauvegarde, juste
  « committer un nouveau surfaceData »).
- **Trouvaille réelle de l'outillage** : déplacer ce code tel quel dans un fichier `useXxx.js` a fait
  apparaître 4 erreurs `react-hooks/set-state-in-effect` qui n'existaient PAS quand ce code vivait dans
  `Editor3D.jsx` (vérifié : `eslint` sur la version d'avant extraction, 0 erreur, mêmes lignes) — la règle
  cible spécifiquement les fonctions reconnues comme hooks (`use[A-Z]…`), pas les composants React
  classiques. Signal réel du outil officiel React sur le design de ce hook (une pile d'effets qui
  s'auto-corrigent est un signe qu'ils devraient être une dérivation au rendu, pas un effet) — mais
  corriger ça aurait changé le comportement, pas juste déplacé du code, donc **désactivé ligne à ligne
  avec justification** plutôt que corrigé dans la même passe (un problème à la fois). Noté ici comme piste
  de vraie amélioration pour une passe séparée, pas oubliée.
- 1560 → 1418 lignes sur `Editor3D.jsx` (`wc -l`), 202 lignes neuves dans `useSurfacePanels.js`.
  `eslint`/`build` propres. Reste dans `Editor3D.jsx` : chargement voxels/surface, les deux files de
  sauvegarde fire-and-forget, la pile d'annulation/rétablissement fusionnable, les raccourcis clavier
  globaux — la partie la plus risquée à découper (persistance, pas juste de l'UI), volontairement pas
  attaquée dans le même tour que ce premier essai du patron hook.

### 16.11. Pourquoi la pile d'annulation + les files de sauvegarde restent non découpées ce tour — et une trouvaille en cours de route (2026-09-30)

En préparant l'extraction de `useVoxelSaveQueue`/`useSurfaceSaveQueue`/`useSurfaceUndoRedo` (dernier tiers
du §16.4), lecture complète du bloc restant. Deux raisons de stopper ici plutôt que de forcer la fin de la
décomposition dans le même tour :

1. **Couplage réel, pas juste apparent** : `handleSurfaceDataChange` (la pile d'annulation) appelle
   directement `saveSurfaceFireAndForget` (la file de sauvegarde) à chaque commit — les deux partagent
   aussi `battlemapRef`, le timer d'auto-save (60s) et l'effet de sauvegarde au démontage. Les séparer
   proprement demande de décider quel hook appelle quel autre (interface, pas juste un copier-coller) —
   contrairement à `useSurfacePanels` (§16.10) qui ne connaissait `handleSurfaceDataChange` que comme
   callback opaque.
2. **Trouvaille `[VÉRIFIÉ]` en cours de lecture, pas liée à la décomposition** : `isDirty` (dirtiness des
   voxels, distinct de `isSurfaceDirty`) n'est JAMAIS mis à `true` dans tout `Editor3D.jsx` — seulement
   remis à `false` après une sauvegarde réussie (ligne ~963). `saveFireAndForget` (voxels) fait donc
   toujours un early-return et ne sauvegarde jamais rien. `setVoxels` n'est appelé qu'une fois, au
   chargement initial (ligne ~815) — aucune pose de voxel ne semble passer par ce composant. `[HYPOTHÈSE]`
   probable : reliquat de l'ancien système de pose voxel, remplacé par Salle/Mur (`SurfaceDungeonScene`),
   `CulledVoxelScene` gardé seulement comme rendu de repli quand `!hasSurfaceContent(surfaceData)`. Pas
   vérifié plus loin (pas cherché si un autre composant met `isDirty` à jour via une réf exposée), pas
   touché — hors périmètre de cette décomposition, à vérifier séparément avant toute suppression.

**Décision** : ne pas extraire ces hooks dans ce tour. Risque réel (persistance de données, pas juste de
l'UI) contre un gain incertain tant que le point 2 n'est pas tranché — cohérent avec l'invariant STOP
d'`AGENTS.md` (ne pas coder sur une zone dont une partie du fonctionnement réel est encore `[HYPOTHÈSE]`).
Présenté à Saar pour décision : soit cadrer une vérification du point 2 en premier, soit accepter de
laisser cette dernière partie d'`Editor3D.jsx` en l'état (elle n'empêche pas le reste du chantier) et
passer aux 4 mini-chantiers du §15.2.

**Suite** : le point 2 (`isDirty` voxel) a déclenché son propre chantier, désormais suivi dans
`docs/PLANS/PLAN_PURGE_VOXEL.md` §7 (isolement du code voxel mort, pas une suppression) — pas ici, pour
ne pas mélanger un lot de purge avec ce chantier de décomposition (règle explicite du §0 de ce plan).

## Historique

- **2026-09-30** — §16.5 (palette Objets 3D + réglages Peindre un mur) testé par Saar : fonctionnel, deux
  retours à consigner, aucun des deux dans le périmètre de ce chantier (décomposition de fichiers) :
  1. **Idée pour plus tard, non cadrée** : outil pipette pour Peindre un mur/sol — copier la configuration
     d'un mur ou d'un sol déjà posé pour la réutiliser (mémoriser un matériau existant plutôt que de le
     recomposer). Rien codé, rien cadré.
  2. **Lag réel signalé par Saar (2-4s) à chaque changement de mur ciblé en mode Peindre un mur** — cause
     racine trouvée `[VÉRIFIÉ]`, pas de ma décomposition de ce tour (aucune logique de matériau touchée,
     seulement du JSX de panneau) : en portée « case », `paintRoomWallEdges` dérive le seed du matériau des
     clés d'arête du mur cliqué (`surfaceRooms.js:1176-1179`) → `makeSurfaceMaterial` le réduit à un panier
     `variant-${hash % 4}` (`materialDecision.js:57-63`) → le cache de matériaux procéduraux de
     `SurfaceDungeonScene.jsx` est indexé sur ce panier (4 seulement, et changer de matériau/motif les
     invalide tous). Peindre un mur jamais vu dans ce panier déclenche une régénération synchrone complète
     de la texture (albédo/normal/rugosité, canvas 128×128 avec plusieurs passes par carte,
     `proceduralMaterials.js`) + upload GPU ; repeindre le MÊME mur est instantané (cache atteint) —
     cohérent avec l'observation de Saar. `[HYPOTHÈSE non instrumentée]` : le clonage JSON du document
     entier pour la pile d'annulation et le recalcul de toute la géométrie de scène (`useMemo` clés sur
     `surfaceData`, `SurfaceDungeonScene.jsx` lignes ~2064-2092) pourraient s'ajouter à ce coût, jamais
     mesurés séparément de la bake elle-même. Pas corrigé — mérite son propre cadrage (chantier perf séparé),
     décision de Saar à prendre séparément du reste de ce chantier.
- **2026-09-30** — §11.7 (nettoyage) validé fonctionnel par Saar en navigateur. **Note hors périmètre de ce
  document, à faire remonter dans `docs/EN_COURS.md` (pas fait ici pour éviter de committer les changements
  non liés d'une autre session en cours sur ce même fichier) :** Saar demande de revoir la logique de pose
  d'une échelle pour permettre de poser une échelle sur une autre échelle (continuité verticale sur plusieurs
  étages) — actuellement non permis, cause exacte non vérifiée (`makeLadderConnectorFromCell`/
  `applyLadderConnector`, `client/src/lib/connectors.js`, jamais lu pour ce point précis). Rien codé, rien
  cadré.
- **2026-09-30** — Après une relecture critique demandée par Saar sur l'ensemble du chantier : trouvé que le
  regroupement de la sidebar (§12.5 point 1, « Bâtir/Connecteurs/Finir »), présenté et validé en principe dès
  le premier tour, n'avait jamais été codé — tout le reste livré (poignée, dock fixe, correctifs isolés) avait
  laissé intact l'écran le plus visible, celui qui avait déclenché le reproche initial de Saar (« bordel »).
  Corrigé dans la foulée : deux titres de section ajoutés (`SurfaceEditorPanel.jsx`), deux clés i18n neuves
  (`fr.json`), aucune logique touchée. `eslint`/`build` propres.
- **2026-09-29** — Commit `c1eaeceb` (« World Builder v2 : cadrage UX + poignée de redimensionnement »,
  12 fichiers) **entièrement validé en jeu par Saar**, les trois points restés en suspens après le commit
  compris : persistance de mode + Échap (« vraiment plus agréable, bon choix »), confirmation avant
  suppression de mur, retrait des contrôles de session du panneau Connecteur en édition. Plus rien de
  non testé sur ce commit. Reste à décider avec Saar : pousser `dev/Saar`, puis lequel de 4b (colonne fixe
  Connecteur/Effet) ou 5 (pile d'annulation fusionnable) reprendre.
- **2026-09-29** — Incrément 6 (poignée de redimensionnement) codé, la fonctionnalité la plus attendue de ce
  chantier et la seule ayant déjà échoué deux fois (§8). Conception présentée et confirmée par Saar avant le
  code (« oui, en théorie cela me va »). Le geste ne s'active que sur un tronçon droit déjà sélectionné —
  simplifie la désambiguïsation clic/glissé sans changer le comportement du tout premier clic. Deux fonctions
  géométriques pures ajoutées (`wallRunReshapeCells`, `wallRunRowCountForCell`,
  `shared/world/roomGeometry.js`), dérivées indépendamment puis vérifiées l'une contre l'autre par test (10
  tests neufs, 24/24 avec l'existant), jamais `SURFACE_FINE` dans leur espace de coordonnées — la cause exacte
  de l'échec précédent. Câblée sur le système de drag générique déjà existant (`dragRef`/`setDrag`, nouveau
  mode `'wall-reshape'`) plutôt qu'un second système d'événements ; réutilise l'aperçu vert/rouge de Plan B
  tel quel. `node --check`/`eslint`/`build` propres. Ce que seul un test en jeu peut confirmer : la
  coopération réelle entre le clic sur le maillage 3D du mur et le système de glissé du canvas.
- **2026-09-29** — Incrément 4a codé (« continue ») : colonne de propriétés fixe pour Salle et Mur, les deux
  panneaux à usage éditeur unique. En le préparant, trouvé que Connecteur et Effet sont en réalité partagés
  avec le mode Jeu (`Canvas3D.jsx`/`SessionDangerZonePanel.jsx`) — leur fixer la position aurait changé un
  comportement hors périmètre de ce chantier ; scindé en 4a (fait) et 4b (reporté, nécessite une prop
  optionnelle pour ne pas toucher le comportement en session). `useDraggablePanelPosition` retiré de Salle/Mur
  seulement, toujours utilisé ailleurs (Connecteur/Effet/`EntityInstancePanel.jsx`), pas orphelin. Signalé que
  le prérequis de la poignée (point 6) est maintenant satisfait et peut passer devant 4b/5 si Saar la préfère.
  `node --check`/`eslint`/`build` propres, 49/49 tests inchangés, rien confirmé par Saar en navigateur.
- **2026-09-29** — §12.10 codé (3 des 5 incréments listés) : Saar délègue explicitement (« c'est toi
  l'expert, je suis inutile »), lu comme autorisant la levée de la pause du §9 pour ces incréments isolés déjà
  entièrement raisonnés. Confirmation à deux temps ajoutée sur la suppression de mur ; contrôles runtime
  (ouvrir/fermer/verrouiller) retirés de l'éditeur en corrigeant `SurfaceConnectorPanel.jsx` lui-même
  (`!canEdit`), pas seulement l'appelant — plus robuste que le plan initial, qui aurait laissé les boutons de
  porte dans le même état de bouton mort déjà trouvé au §12.7 ; persistance de mode unifiée + Échap, sans le
  nouveau module « machine à états » prévu au tour précédent — implémenté, le second-system-effect a joué :
  la ligne d'indice contextuel existante suffisait déjà, pas besoin d'un bandeau séparé. Trouvaille en cours de
  route : `connectorWallEdgeKeys` (restreint une porte au mur choisi) devait être remis à zéro après une pose
  réussie, sans quoi la persistance nouvellement activée aurait limité invisiblement une 2ᵉ porte au mur de la
  1ʳᵉ — corrigé pour Échap et succès, gap préexistant identique via le bouton Sélection laissé tel quel (hors
  périmètre de ce tour). Trois textes d'indice codés en dur trouvés et déplacés en `fr.json` (invariant i18n
  violé avant ce tour). `node --check`/`eslint`/`build` propres, 49/49 tests inchangés, rien confirmé par Saar
  en navigateur. Restent : colonne de propriétés fixe, pile d'annulation fusionnable, poignée — dépendent de
  la coquille v2, rien commencé.
- **2026-09-29** — §12.9 fermé, §12.10 ajouté : Saar tranche les deux derniers points (« la fenêtre ne me
  gêne pas, je bouge la caméra plutôt » → panneau fixe confirmé sans perte de confort réelle ; « fais à ton
  idée » → persistance des connecteurs retenue). Cadrage UX (§12) refermé. Plan d'implémentation séquencé
  proposé : deux corrections isolées et déjà root-causées (confirmation de suppression sur le panneau Mur,
  retrait du pilotage direct d'ascenseur depuis l'éditeur) qui n'attendent pas la coquille v2 mais restent
  bloquées par la pause du §9 tant que Saar ne la lève pas explicitement pour ce périmètre ; quatre incréments
  qui, eux, dépendent de la coquille v2 (machine à états du mode, colonne de propriétés fixe, pile d'annulation
  fusionnable, poignée en sous-outil), dans cet ordre, chacun son propre plan avant son propre code. Rien codé.
- **2026-09-29** — §12.9 ajouté : Saar demande directement l'avis d'expert sur le paradigme (Sims ? Dungeondraft
  ? innover ? sidebar/fenêtre/50-50 ?), constatant qu'il « sèche » seul. Tranché : ni Sims ni Dungeondraft
  seuls (2D, sans objets à réglages profonds, sans double usage édition/session) — la bonne famille de
  référence est celle des outils de création 3D pros (Blender/Unity/Unreal/Godot), disposition à trois colonnes
  fixes (Outils/Viewport/Propriétés), Dungeondraft et Plan B (déjà validé en jeu) s'appliquant seulement au
  niveau micro (regroupement, gestes). Flux cible proposé : une seule règle de persistance pour tous les outils
  de pose (au lieu de trois, §12.8), bandeau d'état généralisé, panneau de propriétés fixe unique (referme la
  duplication du §10b par la structure, pas par une règle), poignée (§10c) comme sous-outil du panneau Salle.
  Nouvelle trouvaille en creusant `Editor3D.jsx`/`Canvas3D.jsx` : le panneau Connecteur de l'éditeur pilote
  réellement un ascenseur en direct (`handleElevatorCommand` câblé, `canEdit` par défaut à `true`) alors
  qu'aucune session n'est en cours — recommandé de retirer ce câblage de l'éditeur. Deux points laissés à Saar
  : panneau fixe vs déplaçable (régression possible d'un choix déjà investi), persistance des connecteurs
  (jamais signalée comme gênante par lui). Rien codé.
- **2026-09-29** — §12.7/12.8 ajoutés après reproche justifié de Saar (« tu n'as rien résolu puisque tu as
  tout survolé ») sur le §12 initial : la proposition « un seul panneau contextuel » était écrite sans avoir lu
  le contenu réel des panneaux, corrigée en §12.5 point 2. Lecture complète des 5 fichiers de panneau
  (`SurfaceRoomPanel/WallPanel/ConnectorPanel/MaterialEditor/EffectPanel.jsx`) : décision garder/jeter/
  re-présenter champ par champ (§12.7) — trouvailles réelles non identifiées avant cette lecture : le panneau
  Connecteur mélange sans distinction visuelle l'édition de carte et le contrôle runtime (porte/ascenseur en
  session) ; le panneau Mur n'a aucune confirmation avant de supprimer un mur, contrairement aux trois autres
  panneaux ; le panneau Connecteur est le seul des quatre sans aucune section repliable. Lecture du
  gestionnaire réel de gestes (`SurfaceEditorScene.jsx` lignes ~1020-1293) pour les 11 modes (§12.8) : trois
  règles différentes de persistance de mode après un geste réussi coexistent sans aucun signal visuel (Salle
  conditionnelle, Connecteur jamais persistant, le reste toujours persistant) — la vraie cause derrière le
  symptôme déjà connu « Ajouter une salle ne reste pas actif » (§9/§10b), qui s'avère être un cas d'un problème
  plus large, pas un bug isolé. Deux flux de création opposés trouvés pour Salle (dessiner puis configurer) et
  Zone d'effet (configurer puis dessiner). Rien tranché : présenté à Saar pour décision, pas de code.
- **2026-09-29** — §12 ajouté : Saar demande explicitement un audit UI/UX complet de l'interface (« un expert
  UI/UX pour repenser l'intégralité de l'interface »), recadrant le §11 (jusque-là centré architecture de code)
  vers l'expérience elle-même. Audit heuristique (Nielsen, 10 heuristiques) sur un inventaire réel de
  l'interface (lecture directe de `SurfaceEditorPanel.jsx` : 3 onglets pour 2 dimensions d'état réelles, 11
  modes en 4 groupes de boutons à la cohérence inégale, deux interfaces concurrentes pour éditer un mur) :
  7 violations trouvées, chacune sourcée sur le code ou un constat déjà consigné (§9/§10/§11.3), pas inventée.
  Trois patrons pro convergents (Dungeondraft : groupement par catégorie ; Blender : panneau de propriétés
  contextuel unique ; three.js editor : déjà en 11.6.1). Trois axes de refonte proposés (regroupement par phase
  de travail, panneau contextuel unique, visibilité explicite du mode actif) — présentés pour décision de Saar,
  rien tranché unilatéralement (§12.6). Prochaine étape si la direction convient : maquette visuelle.
- **2026-09-29** — §11.6 points 1 et 2 traités (recherche pro + audit), à la demande de Saar de se lancer sur
  l'implantation de `PLAN_EDITEUR_CARTE.md`. Recherche pro (three.js editor `mrdoob/three.js`, sourcé et lu
  directement — `Command`/`updatable`/`History` avec fusion 500 ms, une classe par opération ; XState pour les
  machines à états de mode) apporte deux réponses concrètes et sourcées à §11.3 points 4 et 6, jamais un
  patron trouvé pour découpler sélection/outil (point 2). Audit par grep direct sur `surfaceRooms.js` et ses
  appelants : la duplication d'autorité du §10b n'est pas systémique — `applyRoomBoundaryArc`/
  `applyRoomWallElevationProfile` n'ont qu'un seul appelant (panneau flottant), seule la peinture a deux
  chemins (outil sidebar + panneau). Reformule la question du point 3 : pas « quel patron d'interaction
  choisir dans l'abstrait » mais « la peinture a-t-elle vraiment besoin d'un raccourci direct que les autres
  n'ont pas, ou faut-il uniformiser » — posée à Saar, pas encore tranchée. Points 3, 4, 5 restent ouverts.
- **2026-09-29** — Deux relectures à charge de §11, à la demande de Saar (« prends le temps de te relire », puis
  « relance une analyse à charge avant le compact »), après constat qu'une première passe avait laissé des
  trous. 1ʳᵉ relecture : en-tête pas à jour, §10c/§11 pas croisés (le risque exact qui avait déclenché « je la
  veux cette poignée ! »), aucune entrée d'historique pour §11, et dans `PLAN_EDITEUR_CARTE.md` un classement
  erroné (v2 listé comme « n'est pas l'éditeur »), une inversion ci-dessus/ci-dessous, un ordre de phases devenu
  contradictoire non signalé. 2ᵉ relecture, plus dure : deux affirmations trop fortes sur le rendu 3D partagé
  (« déjà correct » alors que seul le cas sans arc est vérifié — le coin arrondi reste le candidat n°1 non
  testé de « la couleur écrase tout », §10a), un terme interdit sans preuve (« probablement pas isolé » →
  reformulé `[HYPOTHÈSE]`), une réserve de fond ajoutée (§11.1/§11.6.5 : ne pas figer le rendu partagé comme
  « repris tel quel » avant d'avoir levé cette réserve), un angle mort de coordination inter-sessions ajouté
  (§11.5), une confusion de mécanisme corrigée (bouton « Sélectionner tous les murs » ≠ portée Salle du
  pinceau), et des nombres de lignes obsolètes corrigés (`wc -l` réel : 1581/1485/1347, pas les chiffres
  approximatifs d'origine). Leçon retenue : une première passe de relecture, même consciencieuse, ne suffit pas
  sur un document écrit vite en fin de session dense — vérifier des faits (compter les lignes, relire les
  §-références une à une) plutôt que de se relire seulement pour la forme.
- **2026-09-29** — §11 ajouté, même conversation, après §10e : Saar propose un rework « World Builder v2 »
  (strangler fig, coexiste avec l'éditeur actuel) pendant un run à vide de bilan. Recadré après recherche
  (Strangler Fig Pattern / second-system effect) au périmètre de la coquille d'interaction seule ; modèle de
  données, compilateur, autorité géométrique et rendu 3D partagé repris tels quels. **Erreur commise et
  corrigée le même jour** : un premier stub a été créé comme document séparé (`PLAN_WORLD_BUILDER_V2.md`) —
  Saar a repris sur le manque de rigueur (Règle 2, une information = un seul endroit ; ce chantier était déjà
  en cours ici) ; fichier supprimé, contenu intégré comme §11 de ce document. Dans la foulée, Saar a confirmé
  en clair que la poignée de redimensionnement (§10c) reste une exigence, pas une option que ce rework
  pourrait écarter silencieusement — §10c et §11.2 mis à jour en conséquence pour que ce soit explicite sans
  avoir à deviner. Rien codé, cadrage réel (recherche pro, audit, décisions d'interaction) pas commencé.
- **2026-09-29** — §10e ajouté, même conversation : Saar rapporte que ses tests sont bloqués par « la couleur
  change dès que je choisis une couleur, avant même de cliquer ». Cause trouvée : sélection de murs qui
  s'accumule silencieusement à chaque clic + panneau flottant Mur qui applique la couleur en direct sur toute
  la sélection courante. Corrigé (clic simple remplace, Maj-clic étend). Deuxième blocage rapporté (« murs
  invisibles » en édition) : corrigé, occlusion caméra désactivée dans les deux points de montage de l'éditeur,
  laissée intacte en jeu. Troisième blocage (flux Sélection→salle→Peindre) : noté, pas corrigé ce tour. Lint +
  build propres, rien commité, pas encore confirmé par Saar en navigateur.
- **2026-09-29** — §10 ajouté, nouvelle conversation, contre-diagnostic indépendant explicitement demandé par
  Saar sans reprendre celui de la session précédente. Deux bugs trouvés et corrigés, testés 49/49 + lint + build
  client propres, rien commité : garde-fou porte manquant sur `applyRoomWallAppearance` (symétrique à
  élévation/arc) ; duplication d'autorité sur `interiorTex` entre l'outil sidebar et le panneau flottant Mur,
  tranchée moi-même après avoir vérifié qu'aucun chemin d'interface actuel ne peut plus écrire de texture sur un
  mur (Option 2 du 28/09 rendue cohérente partout, pas seulement dans l'outil pinceau). Hypothèse de fusion de
  tronçon **réfutée** par script jetable empirique (le rendu résout bien l'apparence case par case) — la cause
  de « la couleur écrase tout » reste `[INCONNU]`, candidats listés en 10a pour la suite. Accord avec Saar sur le
  fond : ce qui a été vérifié n'est pas un problème d'UI/UX pour les points « mur non peignable »/« couleur qui
  écrase » ; reste un vrai sujet UI/UX pour les points de flux déjà listés au §9 (fenêtre qui se ferme, etc.).
- **2026-09-29** — §9 ajouté : après 3 correctifs successifs sur la peinture de mur (§8), Saar constate que la
  méthode de correctifs itératifs a échoué sur cet outil précis et impose l'arrêt (« Interdiction de corriger »).
  Peinture de mur (Lot A) passée EN PAUSE ; ses constatations (verbatim, non diagnostiquées) consignées pour un
  futur cadrage. Plan B (§8) non affecté, reste validé.
- **2026-09-28** — §8 ajouté : Plan B livré (peindre/effacer des cases, pas la poignée maquettée), validé en jeu,
  bug de garde-fou (case intérieure) corrigé après une question de Saar, Phase 2 reportée par choix explicite de
  Saar. Peinture de mur (Lot A) : deux correctifs réactifs annulés par Saar (bricolage sans plan), reprise avec
  recherche pro + deux options présentées, Option 2 tranchée (procédural seul) et codée — testée (44/44), pas
  encore confirmée en navigateur.
- **2026-09-27** — §7 ajouté : bilan de session (réorganisation sidebar + corrections UX validées en
  jeu, extension matériaux procéduraux Lot 1 validée, dettes et pistes abandonnées consignées). Le
  chantier de forme des salles proprement dit (titre du document) n'a toujours pas de cadrage détaillé.
- **2026-09-16** — Confirmation externe ajoutée (§6) suite à une question directe de Saar sur
  l'éditeur d'entités qui a élargi la discussion à l'éditeur de surface dans son ensemble. Point
  UI/UX explicitement noté comme non couvert, cadrage détaillé toujours pas démarré.
- **2026-09-10** — stub créé depuis la conversation de cadrage des zones dangereuses (la recherche
  éditeurs de région pro a mis en évidence que le primitif d'édition 2D est partagé). Cadrage à faire.
