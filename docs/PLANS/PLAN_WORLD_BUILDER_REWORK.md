# PLAN_WORLD_BUILDER_REWORK.md — Rework de l'édition de forme des salles

> **Stub — 2026-09-10.** Chantier identifié, **cadrage non commencé**. Ce document ne pré-cadre
> rien : il capture le déclencheur, l'état connu et la contrainte inter-chantiers, pour que la
> conversation de cadrage dédiée démarre avec un ancrage.
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

## Historique

- **2026-09-27** — §7 ajouté : bilan de session (réorganisation sidebar + corrections UX validées en
  jeu, extension matériaux procéduraux Lot 1 validée, dettes et pistes abandonnées consignées). Le
  chantier de forme des salles proprement dit (titre du document) n'a toujours pas de cadrage détaillé.
- **2026-09-16** — Confirmation externe ajoutée (§6) suite à une question directe de Saar sur
  l'éditeur d'entités qui a élargi la discussion à l'éditeur de surface dans son ensemble. Point
  UI/UX explicitement noté comme non couvert, cadrage détaillé toujours pas démarré.
- **2026-09-10** — stub créé depuis la conversation de cadrage des zones dangereuses (la recherche
  éditeurs de région pro a mis en évidence que le primitif d'édition 2D est partagé). Cadrage à faire.
