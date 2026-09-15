# JOURNALANALYSE.md — Analyse à charge : PLAN_DECALS.md vs PLAN_RW_MATERIAUX.md

> Scratch analytique local (même statut que `docs/JOURNALTEMP.md`, CLAUDE.md §10 : non partagé, non
> versionné en pratique). `JOURNALTEMP.md` étant occupé par un autre chantier récent (refactor
> `socketCombatHelpers.js`), fichier séparé créé à la demande explicite de Saar pour ne pas mélanger
> les deux investigations. Écrit au fil de l'investigation, pas relu/nettoyé.

## Contexte de la demande

Saar demande un point critique (« à charge ») sur `docs/PLANS/PLAN_DECALS.md` et
`docs/PLANS/PLAN_RW_MATERIAUX.md`, deux chantiers jugés « trop proches pour ne pas être fusionnés ».
Consigne explicite : qualité > vitesse, prendre le temps, documenter.

## Étape 1 — Vérifier si le chevauchement était déjà connu

`docs/ROADMAP.md` a été **refondu le jour même (2026-08-25)** par une session Claude/Saar précédente
(commit `6b746a8`, tête de branche actuelle). §2 de ce document neuf contient déjà, mot pour mot :

> « Décorations murales (décals) | `PLANS/PLAN_DECALS.md` + `PLANS/PLAN_RW_MATERIAUX.md` Lot 3 |
> **Chevauchement réel non résolu** (trouvé 2026-08-25) : Lot 3 de RW_MATERIAUX traite les décals
> comme motifs cuits dans la texture procédurale (`PATTERN_PRESETS`, uniforme ou en masque) ;
> `PLAN_DECALS.md` les traite comme objets placés individuellement (position/rotation/taille propres,
> clic pour poser). Deux réponses concurrentes à la même question. **À trancher avec Saar** avant de
> cadrer l'un ou l'autre : l'un remplace l'autre, ou les deux coexistent comme deux sous-lots
> complémentaires — puis fusionner les deux documents (Règle 11, une info = un endroit) »

**Donc la présente tâche n'est pas une découverte nouvelle : c'est l'exécution du « à trancher avec
Saar » que la session précédente a explicitement laissé en attente le jour même.** Ma valeur ajoutée
ici doit être : vérifier cette caractérisation dans le code réel (pas seulement la relire), creuser le
POURQUOI du chevauchement, et proposer une réponse tranchée plutôt que de re-signaler le même
chevauchement une deuxième fois.

## Étape 2 — État réel du code (vérifié, pas supposé)

Les deux plans prétendent l'un comme l'autre (via `MATERIAUX.md` et `ROADMAP.md`) qu'aucun code n'a
démarré. Vérifié indépendamment par grep/lecture directe, pas repris tel quel :

- `wallDecoration` / `WallDecoration` / `[Dd]ecal` : **aucune occurrence en code applicatif**
  (`client/src`, `server/src`, `shared/`). Les seules occurrences trouvées (`CombatOverlay.jsx`,
  `Voxel.jsx`, `DiceMesh.jsx`, `Canvas2D.jsx`, `socketCombatHelpers.js`) sont sans rapport — vérifié
  par grep ciblé dans 2 de ces fichiers, zéro résultat, donc probablement des faux positifs du grep
  global (mot proche, pas `decal`) ou du texte hors-code. **Aucune base de code décal à réutiliser.**
- `proceduralMaterials.js` (743 lignes) : pas de paramètre `baseTextureUrl` ni `baseMaterial` dans
  `generateProceduralMaterialTexture` — Lots 1/2 de RW_MATERIAUX jamais codés. `PATTERN_PRESETS`
  contient encore exactement les 5 presets décrits par `MATERIAUX.md` (2026-08-02) : `none`,
  `metal_panels`, `tile_grid`, `planks`, `diamond_plate` — Lot 3 jamais codé non plus.
  `MATERIAL_PRESETS` : toujours 4 matières (steel/plastic/wood/concrete), pas de notion PBR.
- `client/src/lib/surfaceData.js` (557 lignes) : aucune trace de `surfaceMaterialId`, `pbr-material`,
  `wallDecoration`.
- Aucune migration `*surface_material*` ni `*texture_pack*` récente au-delà des 6 déjà existantes
  (81/82/178/179/264/265, toutes antérieures et sans rapport avec le rework PBR).
- `Editor3D.jsx` : **1932 lignes** aujourd'hui. Le Lot 0 de RW_MATERIAUX visait ~200 lignes +
  extraction en `useEditorRefs.js`, `useEditorSave.js`, `useSurfaceUndo.js`, `useEditorTextures.js`,
  `useRuntimeState.js`, `useSurfacePanels.js`, `VoxelEditorScene.jsx`, `EntityEditorScene.jsx`.
  **Aucun de ces fichiers n'existe** (`client/src/hooks/` ne contient aucun fichier `useEditor*`/
  `useSurface*`). **Lot 0 n'a jamais démarré non plus.**
- Seuls 2 commits touchent ces 2 fichiers depuis leur création : `4f3027e` (réorganisation
  documentaire, 2026-08-04, simple déplacement de fichiers) et `4eb33a5` (« Préparation RW
  Migration », 2026-08-09) — ce dernier ne touche PLAN_DECALS.md que pour 18 lignes (à vérifier plus
  bas s'il modifie le fond) et ne touche pas du tout PLAN_RW_MATERIAUX.md ni de fichier de code
  matériaux/décal.

**Conclusion Étape 2** : le constat ROADMAP (« aucune trace de code démarré ») est confirmé de manière
indépendante. Les deux plans sont au même stade — 100% spec, 0% implémentation — mais avec une
différence de MATURITÉ de spec (voir Étape 4).

## Étape 3 — Nature réelle du chevauchement (lecture des deux documents en entier)

Confirmé, avec plus de détail que la ligne ROADMAP :

### RW_MATERIAUX Lot 3 (« Décals et motifs supplémentaires »)
- Dépend explicitement de Lot 2 (filtres procéduraux par-dessus une texture de base), lui-même
  dépendant de Lot 1 (texture de base PBR).
- Portée : « Exploiter les alpha/normal/height maps du bundle (câbles, grilles, boutons, rivets, etc.)
  **comme nouveaux motifs procéduraux** ou **comme masques d'effets** ».
- Autorité de données visée : `room.wallInteriorMaterial` / `wallAppearanceProfiles[].interiorMaterial`
  — champs qui **existent déjà** dans le schéma (`shared/world/surfaceDocument.js:262-281`,
  `validateWallAppearanceMaterial`). Le Lot 3 est une extension d'un pipeline et d'une autorité déjà en
  place, pas un nouveau concept de persistance.
- Portée spatiale : **surface entière** (un mur, une salle) — pas d'instance individuelle, pas de
  position ni de rotation propres. Le motif est cuit dans la texture générée au même titre qu'un
  `metal_panels` aujourd'hui.

### PLAN_DECALS (« Décorations murales »)
- Nouveau concept `WallDecoration` : texture + position + orientation + dimensions + couleur
  éventuelle, explicitement « pas de collision, pas de navigation, pas de LOS, pas de physique,
  uniquement de l'apparence ».
- Portée spatiale : **instance individuelle** posée au clic par le MJ (workflow décrit : sélection →
  motif → survol du mur → prévisualisation → clic → placement), avec sélection/déplacement/suppression/
  rotation/miroir/ordre d'affichage propres à chaque instance.
- Autorité de données visée : **inexistante aujourd'hui**, question ouverte du document lui-même
  (`surface_data.wallDecorations[]` vs `room.wallDecorations[]`), jamais tranchée.
- Le document liste lui-même, en conclusion, 5 documents qu'il lui manque pour être actionnable :
  schéma `surface_data`, validateur serveur, code de génération des murs (UV), système de matériaux,
  catalogue d'assets. **Les 5 sont maintenant lus dans cette session** (voir Étape 2 et fichiers cités
  ci-dessus) — le pré-cadrage de PLAN_DECALS peut donc être complété, il ne l'était pas avant
  aujourd'hui.

**Verdict Étape 3, contre l'intuition initiale de Saar** : ce ne sont **pas la même mécanique** sous
deux formulations différentes. Ce sont deux natures d'objet distinctes :
- Lot 3 = **propriété globale d'une surface** (un enrichissement de plus dans un pipeline de génération
  de texture déjà multi-étapes : couleur → motif → usure → saleté → normal map).
- PLAN_DECALS = **entité spatiale individuelle** (proche d'un connecteur ou d'une entité posée, pas
  d'un paramètre de matériau).

Fusionner ces deux natures dans une seule structure de données (ex. un unique `wallDecorations[]` qui
ferait les deux) violerait la Priorité #4 de CLAUDE.md (« une propriété métier ou physique possède une
autorité unique ») en confondant deux autorités différentes derrière un même nom — ce serait le
contraire de « aggrader l'architecture ». **Donc : ne pas fusionner les deux mécaniques.**

## Étape 4 — Le vrai point d'accroche, plus fin que la ligne ROADMAP

Le chevauchement n'est pas dans le rendu final, il est **en amont, dans le catalogue d'assets**.

- PLAN_DECALS §« Documentation dont j'ai besoin », point 5, dit explicitement : le catalogue d'assets
  doit être vérifié « afin que les décorations réutilisent l'infrastructure existante plutôt que d'en
  créer une parallèle ».
- RW_MATERIAUX Lot 3 est justement le chantier qui va introduire ce catalogue : des fichiers
  alpha/normal/height (« décals » au sens texture) importés via un mécanisme calqué sur l'import PBR
  déjà spécifié au Lot 1 v2 §4 (`POST /api/surface-materials/import`, stockage MinIO, nouvelle table).
- **Risque concret si les deux chantiers avancent sans coordination** : Lot 3 code un import/stockage
  scopé uniquement pour l'usage "motif tuilé/masque". PLAN_DECALS arrive ensuite, a besoin du même
  type d'asset (une image décal avec ses maps) mais pour un usage "objet posé" — et doit soit dupliquer
  l'import (interdit, Règle 11 `RegleDocumentaire.md` + Priorité #4 CLAUDE.md), soit réécrire l'import
  de Lot 3 après coup pour le rendre générique. C'est exactement le genre de rustine que CLAUDE.md
  Priorité #3 interdit d'empiler.

**C'est le chevauchement réel** : pas le rendu, mais la source des assets qui alimentent les deux
rendus. Un seul catalogue de « décals » (fichiers importés avec leurs maps), consommé par deux
mécanismes de rendu différents et non fusionnables.

## Étape 5 — Dépendance de séquencement non documentée (trouvaille indépendante)

PLAN_DECALS Étape 5 (« Outil d'édition ») ajoute un nouvel outil dans l'éditeur de surface — même zone
que celle que RW_MATERIAUX Lot 0 prévoit d'extraire (`Sidebar.jsx` → `SurfaceToolPanel.jsx` +
`useSurfaceTool.js`, Lot 1 §2.1) et que RW_MATERIAUX Lot 0 (le vrai Lot 0, `Editor3D.jsx` →
hooks/composants) prévoit de découper en amont.

**Aucun des deux documents PLAN_DECALS ne mentionne cette dépendance.** Si l'outil de décoration
murale est codé avant le Lot 0, il s'ajoute dans un `Editor3D.jsx`/`Sidebar.jsx` déjà monolithiques
(1932 lignes / ~1000 lignes visées) — puis devrait être ré-extrait au moment du Lot 0, travail fait
deux fois. C'est une seconde raison de traiter les deux plans comme dépendants l'un de l'autre au
niveau du **séquencement**, même si leurs mécaniques ne fusionnent pas.

## Étape 6 — Asymétrie de maturité des deux documents

- `PLAN_RW_MATERIAUX.md` : spec complète et actionnable — 5 lots (0 à 4), responsabilités détaillées
  par fichier, dépendances explicites, critères de succès, hors-scope explicite. Rédigé 2026-08-02,
  document de référence `MATERIAUX.md` associé et à jour avec le code actuel (vérifié Étape 2).
- `PLAN_DECALS.md` : pré-cadrage ouvert. Pas de lots, pas de fichiers cibles nommés, 5 questions
  ouvertes non tranchées, et l'auteur lui-même liste les documents qu'il n'a pas encore lus pour
  pouvoir trancher. **Pas prêt à devenir un lot codable en l'état** — contrairement à RW_MATERIAUX.

## Conclusion — recommandation (à confirmer par Saar avant toute écriture de fichier)

1. **Ne pas fusionner les mécaniques.** Lot 3 (motif/masque cuit dans la texture d'une surface) et
   PLAN_DECALS (objet posé individuellement) restent deux lots séparés, deux structures de données
   séparées, deux morceaux de renderer séparés — les fusionner violerait l'autorité unique.
2. **Fusionner les documents en un seul plan** (Règle 11 `RegleDocumentaire.md`), avec :
   - un socle commun « Catalogue de décals » (import de fichiers alpha/normal/height, stockage MinIO,
     table dédiée) réutilisant le mécanisme d'import PBR déjà spécifié en Lot 1 v2 §4 de
     RW_MATERIAUX — écrit une seule fois, consommé par les deux lots suivants ;
   - Lot « décal-motif » (ex-Lot 3 RW_MATERIAUX, inchangé sur le fond) ;
   - Lot « décal-objet » (ex-PLAN_DECALS, complété avec les 5 documents maintenant lus dans cette
     session — schéma, validateur, UV des murs, `wallAppearanceProfiles` comme référence de forme pour
     `wallDecorations[]`, catalogue d'assets) ;
   - dépendance explicite du lot « décal-objet » sur le Lot 0 (refactor éditeur), absente des deux
     documents actuels.
3. Point non tranché à poser à Saar avant d'écrire quoi que ce soit : le document fusionné remplace-t-il
   `PLAN_DECALS.md` (archivé) au profit d'un `PLAN_RW_MATERIAUX.md` étendu, ou les deux documents
   restent séparés mais se référencent explicitement l'un l'autre (moins de réécriture, plus proche de
   « une info = un endroit » si chacun garde sa responsabilité unique : RW_MATERIAUX = pipeline de
   matériau de surface, DECALS = objets posés) ? Les deux respectent Règle 11 selon l'angle choisi —
   c'est un choix éditorial, pas un choix technique tranché par le code.

**Rien codé, rien fusionné dans les fichiers réels — analyse seule, comme demandé.**

## Étape 7 (suite, sur relance Saar) — confrontation aux pratiques pro et à l'existant GitHub

Saar refuse le questionnaire fermé pour une question architecturale — demande une discussion directe
sur deux points : (1) la séparation identifiée est-elle la bonne pratique, a-t-on raison de faire
ainsi ; (2) faut-il améliorer/repenser, et existe-t-il des projets GitHub proches à exploiter.
Recherche externe faite (feedback_github_research, feedback_research) avant de répondre.

### Recherche 1 — la séparation motif-surface / objet-posé est un pattern reconnu, pas une invention

- **Unreal Engine, Landscape Material Layers** : blend de plusieurs matériaux sur une surface entière
  via vertex-paint ou masque de texture (canaux R=AO, G=mousse, B=saleté typiquement) — exactement la
  forme du Lot 3 RW_MATERIAUX (motif/masque cuit dans la texture d'une surface entière, pas d'instance
  individuelle). [Landscape Materials in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/landscape-materials-in-unreal-engine).
- **Unreal Decal Actor / Unity Decal Projector** : objet indépendant avec sa propre position/
  rotation/taille, projeté sur la géométrie existante — exactement la forme de PLAN_DECALS (`WallDecoration`).
  [Decal atlas with one material - Epic Dev Forums](https://forums.unrealengine.com/t/decal-atlas-with-one-material-is-it-possible/495319),
  [Unity - Introduction to decals in URP](https://docs.unity3d.com/6000.1/Documentation/Manual/urp/renderer-feature-decal.html).
- **Trim sheets** (une texture partagée, beaucoup de motifs, appliquée par UV plutôt que générée par
  salle) : technique standard pour justement éviter de générer une texture unique par surface — pattern
  proche de ce que Lot 3 propose (réutiliser les alpha/normal/height du bundle comme motifs). [Creating
  Environments efficiently through Iteration and Trim Sheets](https://www.linkedin.com/pulse/creating-environments-efficiently-through-iteration-trim-pichler).

**Verdict** : dans tous les moteurs vérifiés, ces deux briques sont des systèmes **séparés**, jamais
fusionnés en une seule primitive. La recommandation de l'Étape 6 (ne pas fusionner les mécaniques,
fusionner le catalogue d'assets en amont) correspond donc au pattern professionnel standard, pas à un
choix arbitraire du projet.

### Recherche 2 — décals techniques : Three.js a l'outil officiel, mais aucun plan ne prévoit l'échelle

- `THREE.DecalGeometry` existe en tant qu'addon officiel three.js : projette un volume sur la
  géométrie réelle du mesh cible (intersection d'un cube avec la géométrie, clip des UV/normales) —
  fonctionne quelle que soit la forme du mesh sous-jacent, donc **répond directement** à la question
  ouverte non tranchée de `PLAN_DECALS.md` (« les murs courbes utilisent-ils un UV continu ou reconstruit
  par panneau ? ») : avec `DecalGeometry`, la réponse n'a pas d'importance, la projection se fait sur la
  géométrie déjà tessellée, pas sur un système d'UV personnalisé à maintenir. [DecalGeometry – three.js
  docs](https://threejs.org/docs/pages/DecalGeometry.html), [spite/THREE.DecalGeometry sur
  GitHub](https://github.com/spite/THREE.DecalGeometry). PLAN_DECALS Étape 4 mentionne « DecalMesh »
  sans préciser qu'il s'agit de cet addon officiel — à expliciter.
- **Mais aucun plan ne prévoit l'échelle** : la recherche sur les décals en jeu confirme que « créer un
  nouveau matériau pour chaque décal différent ajoute un draw call par décal » et que l'atlas de
  textures (plusieurs motifs dans une seule image, comme un trim sheet) est la réponse standard pour
  beaucoup de décals. [Decal atlas with one material - Epic Dev
  Forums](https://forums.unrealengine.com/t/decal-atlas-with-one-material-is-it-possible/495319),
  [Generating Texture Atlases for Optimized Assets](https://medium.com/@pablobandinopla/generating-texture-atlases-for-optimized-assets-63fd7a04021f).
  Un MJ décorant une station entière (des dizaines à des centaines de décals plausibles sur toute une
  carte) est à l'échelle « beaucoup de décals », pas « quelques bullet holes ». `PLAN_DECALS.md` Étape 4
  reste au milieu du gué (« quad projeté ou DecalMesh, suivant les performances ») sans jamais mentionner
  d'atlas ni de regroupement de matériau — lacune réelle, pas cosmétique, à combler avant de coder.

### Recherche 3 — précédent GitHub direct trouvé, et une vraie limite structurelle révélée par comparaison

`majidmanzarpour/threejs-procedural-dungeon` — générateur de donjon procédural en Three.js, le seul
précédent trouvé combinant génération procédurale de texture + décoration de salles à l'échelle d'une
carte complète (pas juste un exemple isolé). [Dépôt
GitHub](https://github.com/majidmanzarpour/threejs-procedural-dungeon).

Vérifié (WebFetch sur le README) :

- **Textures procédurales générées sur canvas au chargement**, pas de shader temps réel, pas d'assets
  chargés depuis le disque — même famille technique que `generateProceduralMaterialTexture` d'Enclume.
  Ça valide que l'approche canvas d'Enclume n'est pas une erreur de conception : un projet comparable
  fait le même choix et tient la charge.
- **Les décorations (torches, runes, portails) sont des instances individuelles posées via
  `InstancedMesh`, jamais cuites dans la texture des murs** — troisième confirmation indépendante (après
  Unreal/Unity) que motif-surface et objet-posé sont deux mécanismes distincts même dans un projet du
  même genre qu'Enclume.
- **La raison pour laquelle ça tient à l'échelle (~6000 tuiles, framerate maintenu) : un nombre fini de
  textures/motifs réutilisées massivement via l'instanciation**, pas une texture unique générée par
  combinaison de paramètres.

**Ce dernier point retourné contre RW_MATERIAUX Lot 1/2, pas seulement contre DECALS** :
`docs/SYSTEME/MATERIAUX.md` (lu Étape 2 de cette même analyse) documente déjà, sur le système actuel,
qu'« il n'y a aucune invalidation » du cache de textures procédurales et que « sur une session longue
avec beaucoup de variations, la mémoire peut croître » — limite connue, déjà actée comme non bloquante
« en pratique » mais jamais résolue. Lots 1/2 ajoutent une texture de base PBR **en plus** des curseurs
usure/saleté/relief déjà continus (0-100) par salle — ça **multiplie** le nombre de combinaisons
uniques possibles par salle, donc aggrave structurellement une limite déjà connue au lieu de la régler.
Le seul précédent comparable trouvé évite ce piège par construction (palette finie + instanciation), pas
en gérant un cache qui grossit sans fin.

### Réponse aux deux questions de Saar

1. **La séparation est-elle pertinente, est-ce la bonne pratique ?** Oui, confirmée par 3 sources
   indépendantes (Unreal Landscape Layers, Unity/Unreal Decal Actor, `threejs-procedural-dungeon`) :
   motif-surface et objet-posé sont deux systèmes séparés dans tous les précédents trouvés, jamais une
   seule primitive fusionnée. Le chevauchement perçu par Saar est réel mais se situe dans le catalogue
   d'assets partagé (Étape 4 ci-dessus), pas dans la mécanique de rendu — confirmé, pas contredit, par
   cette recherche.
2. **Faut-il améliorer/repenser ? Projets GitHub à exploiter ?** Pas de refonte de l'architecture
   générale (WorldSnapshot, `surface_data`, séparation apparence/collision — validée par comparaison, pas
   remise en cause par cette recherche). Deux points précis à corriger **avant** de coder, indépendants
   du chevauchement DECALS/RW_MATERIAUX lui-même :
   - Lot 1/2 RW_MATERIAUX : trancher curseurs continus par salle (aggrave un problème mémoire déjà
     documenté et non résolu) vs palette finie de profils réutilisables + cache borné (pattern du seul
     précédent trouvé qui tient à l'échelle d'une carte complète).
   - PLAN_DECALS Étape 4 : préciser `THREE.DecalGeometry` (addon officiel, répond de fait à la question
     ouverte des murs courbes) + prévoir un atlas de motifs décals partagé dès la conception, pas
     « suivant les performances » découvert après coup.
   Aucun projet GitHub trouvé ne couvre le périmètre complet d'Enclume (VTT PBR + décals + station
   spatiale) — le seul précédent utile (`threejs-procedural-dungeon`) sert de validation d'architecture
   et de garde-fou sur l'échelle, pas de bibliothèque à réutiliser directement.

## Étape 8 — Tranché : deux documents séparés, pas un document commun

Saar demande directement « un document commun ou deux » — décision prise sur la base de la
constitution documentaire du projet elle-même, pas d'une préférence arbitraire.

**`docs/RegleDocumentaire.md` Règle 1 + Règle 13** : « Un document est découpé uniquement lorsqu'il
porte plusieurs responsabilités distinctes » / « la taille n'est jamais un critère ». Or l'Étape 3 (et
sa confirmation indépendante Étape 7 par 3 précédents professionnels : Unreal Landscape Layers, Unity/
Unreal Decal Actor, `threejs-procedural-dungeon`) établit que motif-surface (RW_MATERIAUX) et
objet-posé (DECALS) sont deux responsabilités réellement distinctes, jamais fusionnées dans aucun
précédent trouvé. **Les fusionner en un document violerait Règle 1** — ce serait recréer, au niveau
documentaire, exactement l'erreur qu'on éviterait au niveau du code en gardant deux structures de
données séparées.

**Décision : deux documents séparés, chacun garde sa responsabilité unique**, avec le chevauchement
réglé par des références croisées (Règle 2 : « une information = un seul endroit, les autres
documents utilisent un lien »), pas par une fusion de contenu :

1. **Cause racine du chevauchement perçu = une collision de vocabulaire, pas d'architecture.** Le mot
   « décal » est utilisé pour deux concepts différents sans être passé par `docs/VOCABULARY.md`
   (CLAUDE.md §2 : « avant un nouveau concept métier, lire ou mettre à jour VOCABULARY.md » — jamais
   fait pour ce mot précis, vérifiable : aucune entrée « décal » trouvée lors des lectures de cette
   session). Correctif : ajouter à VOCABULARY.md deux entrées distinctes (ex. « Motif de surface » pour
   le motif/masque cuit dans la texture d'une salle/mur ; « Décoration murale » ou « Décal » réservé
   exclusivement à l'objet posé individuellement) et renommer le Lot 3 de RW_MATERIAUX pour ne plus
   utiliser seul le mot « décal » (ex. « Lot 3 — Motifs de surface et masques d'usure localisée »).
   Rien qu'avec ce renommage, la plus grande partie de l'impression de doublon disparaît.
2. **`PLAN_RW_MATERIAUX.md` reste l'unique autorité du pipeline de matériau de surface** (Lots 0-4
   inchangés sur le fond, Lot 3 reformulé au point 1). Lot 1 §4 (import PBR, `/api/surface-materials/
   import`, stockage MinIO) devient explicitement l'autorité du catalogue d'assets image (alpha/normal/
   height) — étendue de l'infrastructure `texture-pack.js`/`texture_packs` déjà existante, pas un
   nouveau système.
3. **`PLAN_DECALS.md` reste l'unique autorité de l'objet posé individuellement**, complété (pas
   fusionné) avec :
   - une ligne de dépendance explicite vers `PLAN_RW_MATERIAUX.md` Lot 0 (séquencement — l'outil de
     pose s'implante dans `SurfaceToolPanel.jsx` une fois extrait, pas dans `Sidebar.jsx` directement) ;
   - une ligne de référence explicite vers Lot 1 §4 pour le catalogue d'assets, au lieu de
     redéfinir un mécanisme d'import séparé (Règle 11) ;
   - les findings de l'Étape 7 : `THREE.DecalGeometry` (addon officiel, répond à la question ouverte
     des murs courbes) comme mécanisme de rendu recommandé, et un atlas de motifs décals partagé à
     prévoir dès la conception (question ouverte à trancher, pas encore une réponse) ;
   - `wallDecorations[]` sur le même patron de forme que `wallAppearanceProfiles[]` (déjà en autorité
     dans le schéma, `edgeKeys[]` + un contenu) plutôt qu'une structure ad hoc.

**Rien encore écrit dans les deux fichiers `docs/PLANS/*.md` réels — décision actée ici, exécution en
attente du feu vert de Saar** (CLAUDE.md §6.7 : modifier 2 documents de référence + VOCABULARY.md est un
changement de scope réel, pas une clarification cosmétique).
