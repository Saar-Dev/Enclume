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

## 2026-10-14 — Reprise : analyse à charge de PLAN_DECALS.md contre le code réel actuel

Contexte : les étapes 1-8 ci-dessus datent du 2026-08-25/26, avant le rework complet de l'éditeur
(World Builder v2, peindre/effacer des cases, purge voxel). Saar redemande aujourd'hui une analyse à
charge du même plan, « PREND TON TEMPS » répété deux fois. Lu intégralement avant de commencer :
`docs/PLANS/PLAN_DECALS.md`, `docs/PLANS/PLAN_EDITEUR_CARTE.md` (orchestration, Phase 4), `docs/SYSTEME/
SURFACES_SALLES.md`, `docs/SYSTEME/MATERIAUX.md` (les deux à jour au 2026-10-14, vérifiés fidèles au code
par leurs propres audits de compréhension), puis le code réel.

### A. Le blocage G-décals (identité de mur) est en fait déjà levé, PLAN_EDITEUR_CARTE.md ne l'affirme
pas aussi clairement que ROADMAP.md

`ROADMAP.md` §2 ligne « Décorations murales » dit encore littéralement : « 4b (spec + code) attend que
la Phase 1 (forme des salles) fixe comment l'identité d'un mur/d'une arête survit à une modification de
forme ». Or `PLAN_EDITEUR_CARTE.md` §3 (« G-décals ») et §4.1 montrent que Plan B (peindre/effacer des
cases, livré et validé en jeu le 2026-09-28) a réglé la question PAR L'APPROCHE, pas par un mécanisme
d'identité stable : aucun mur n'a d'id persistant dans Enclume (confirmé — `roomBoundaryEdgeKey`,
`shared/world/roomGeometry.js:56`, dérive toujours la clé des coordonnées), mais Plan B ne fait jamais
« glisser » un mur d'une position à une autre, donc le risque que l'identité change silencieusement sous
un décal déjà posé ne se produit plus pour CE geste précis. **Verdict : la porte G-décals est franchie.**
Le ROADMAP.md n'est pas faux mais formule la condition d'une façon qui laisse croire à un blocage actif,
alors que la condition est remplie depuis le 2026-09-28 — à corriger dans le ROADMAP si Saar valide cette
lecture.

### B. Le patron d'ancrage recommandé (Étape 8 ci-dessus, `wallDecorations[]` façon
`wallAppearanceProfiles[]`) a un coût d'implémentation précis, maintenant connu ligne par ligne

Vérifié dans `client/src/lib/surfaceRooms.js` : `wallAppearanceProfiles`/`wallElevationProfiles` sont
réconciliés (purgés par arête retenue, fonction partagée `prunedByRetainedEdges`) à exactement
**2 endroits** — fusion de deux salles (`mergeRooms`, ~l.744-757) et peinture/effacement de cases
(`paintRoomFootprintCells`, ~l.974-975) — plus un **3ᵉ endroit qui RECONSTRUIT une entrée pour les
arêtes sélectionnées** (`applyRoomWallAppearance`, ~l.1130-1141, logique différente : remplace l'apparence
des arêtes choisies, pas une purge). Si un futur `wallDecorations[]` suit exactement ce patron, il faudra
répéter la même ligne de purge aux mêmes 2-3 endroits — travail CONNU, borné, pas une inconnue
architecturale.

**Trouvaille en chemin, indépendante de PLAN_DECALS** : un 4ᵉ endroit où une arête change de statut —
`deleteRoomBoundaryWalls`, branche « mur ouvert vers l'extérieur » (~l.698-718) — ne fait PAS cette purge
(contrairement à sa branche sœur « fusion de salles », ~l.730+, qui la fait). Une apparence de mur posée
puis le mur supprimé vers l'extérieur laisse une entrée orpheline dans le document, qui pourrait
ressusciter si la même arête redevient un mur plein plus tard. Ticketé : `WALL-APPEARANCE-ORPHAN-ON-
EXTERIOR-OPEN` (créé 2026-10-14, priorité basse, non bloquant pour décals — mais si on copie le patron
sans corriger, le même trou existera pour les décals dès le premier jour).

### C. Le catalogue d'assets à réutiliser (Étape 4 ci-dessus) a changé de nature depuis 2026-08-25 — la
recommandation de l'Étape 8 est partiellement obsolète

L'Étape 8 recommandait de référencer « Lot 1 §4 de RW_MATERIAUX (import PBR, `POST /api/surface-
materials/import`, stockage MinIO, nouvelle table) » comme autorité du catalogue d'assets image.
**Vérifié : cette route n'existe pas** (`grep` sur `server/src/routes/` — aucune trace de
`surface-materials`/import PBR) et `PLAN_RW_MATERIAUX.md` lui-même est maintenant archivé
(`docs/Old/PLAN_RW_MATERIAUX.md`) : la suite réelle du rework matériaux (Phase 3 de
`PLAN_EDITEUR_CARTE.md`, R1 fait et validé le 2026-09-27, commit `8962c8c`) a pris une route entièrement
différente — des presets de matière procédurale ajoutés directement dans le générateur
(`proceduralMaterials.js`), **aucun pipeline d'import d'image PBR jamais construit**. `docs/SYSTEME/
MATERIAUX.md` §7 confirme explicitement cette limite actuelle : « pas de lien entre les packs de
textures et les surfaces », « pas d'enrichissement d'une texture de base ».

Ce qui EXISTE réellement et pourrait servir de socle de stockage (coffre, pas la fiche de données) :
`surface_textures` (ex-`voxel_textures`, renommé 2026-10-14) + `texture-pack.js` (CRUD, MinIO, import/
export ZIP) — mais sa fiche de donnée décrit une texture carrelée sur **6 faces d'un cube**
(`faces: {east, west, top, bottom, south, north}`), pensée pour un matériau de mur/sol répété à
l'infini, pas pour une image unique détourée (alpha), posée à une taille et une position précises comme
l'exige un décal. **Conclusion vérifiée, pas supposée** : réutiliser le COFFRE (bucket MinIO, conventions
de chemin, CRUD de packs) est pertinent ; réutiliser la FICHE `faces` 6-faces ne l'est pas — un décal a
besoin de sa propre table/forme de données (image + alpha + dimensions réelles), même si elle emprunte le
même mécanisme de stockage. Le point 5 de « Documentation dont j'ai besoin » de `PLAN_DECALS.md` («
réutiliser l'infrastructure existante plutôt qu'en créer une parallèle ») reste vrai au niveau du stockage
mais pas au niveau du schéma — nuance absente du plan actuel.

### D. Les « Questions ouvertes » de PLAN_DECALS.md sont déjà en grande partie répondues par le code/les
docs actuels, mais le document lui-même n'a jamais été mis à jour pour le dire

1. « UV existants ou projection indépendante ? » — Répondu par `docs/SYSTEME/SURFACES_SALLES.md` : les UV
   de mur suivent des coordonnées monde signées (continues le long d'un mur droit OU d'un arc), pas une
   répétition par petit panneau. Et répondu une seconde fois, différemment, par la décision de rendu déjà
   écrite au §4bis du plan lui-même (quad plaqué en mur plan, `DecalGeometry` en mur courbe) : avec
   `DecalGeometry`, la question de l'UV du MUR ne se pose plus pour le décal (il se projette sur le maillage
   réel, pas sur un système d'UV à maintenir). **Le plan répond à sa propre question deux fois dans deux
   sections différentes sans jamais le dire explicitement** — à nettoyer.
2. « UV continu ou reconstruit par panneau sur un mur courbe ? » — Répondu : continu (« ses UV avancent
   selon la longueur de l'arc », confirmé ligne à ligne par l'audit de compréhension 2026-08-26 du même
   document). Sans incidence sur le décal pour la même raison que le point 1.
3. « Le renderer accepte-t-il déjà plusieurs couches de matériau sur un mur ? » — Non vérifié formellement
   dans le rendu (`WallSegment`, `SurfaceDungeonScene.jsx`), MAIS la question devient sans objet si on suit
   la décision déjà actée au §4bis : un décal est un quad/mesh séparé posé en léger décalage devant le mur,
   jamais une seconde couche DANS le matériau du mur lui-même. Cette question peut être retirée de la liste,
   pas creusée davantage.
4. « Traverser une porte / être découpé ? » — Toujours ouverte, légitimement : aucun précédent dans le code
   actuel pour une découpe automatique d'un objet décoratif par une ouverture. Piste la plus simple et déjà
   dans le patron existant : interdire la pose d'un décal sur une case de mur qui porte une porte (le même
   calcul `doorOnCell`/`boundaryEdgesTouchingCell` que `classifyRoomFootprintCells` utilise déjà pour
   refuser d'effacer une case de mur portant une porte, `surfaceRooms.js` ~l.899-901) — réutiliser, pas
   réinventer.
5. « Que devient un décal si le mur est fusionné/scindé/supprimé ? » — Répondu précisément par B. ci-dessus.

### E. Alternative d'ancrage jamais évaluée par le plan : le patron des entités posées sur un mur

`entities.state.placement.wallId` (table `entities`, PAS `surface_data` — mécanisme déjà utilisé pour
ancrer un objet 3D libre à un mur, dérivé des coordonnées du panneau de mur, `roomWalls.js`
`roomsWallSegments`, voir `PLAN_EDITEUR_CARTE.md` §4.4) est un second patron d'ancrage mural déjà vivant
dans le code, distinct du patron `edgeKeys` de `wallAppearanceProfiles`. Le plan actuel ni la recommandation
de l'Étape 8 ne le mentionnent comme alternative pesée puis écartée. **Avis (pas encore tranché)** : le
patron `wallAppearanceProfiles` reste le bon choix pour un décal — c'est de la pure apparence comme lui,
pas un objet physique sélectionnable/déplaçable comme une entité — mais le document gagnerait à dire
explicitement pourquoi l'autre patron existant a été écarté, plutôt que de ne jamais le citer.

### F. Ce que je NE recommande PAS de faire maintenant

Aucun point ci-dessus n'est bloquant pour écrire un cadrage détaillé de PLAN_DECALS.md (Phase 4b). Aucun
n'exige de code. Le point C (catalogue d'assets) est le seul qui change réellement une recommandation
précédente (Étape 8) ; les autres sont des précisions/confirmations. Rien n'indique qu'il faille revoir la
séparation décal-objet / motif-surface déjà tranchée aux Étapes 3/7/8 — elle tient toujours face au code
actuel.

## 2026-10-14 (suite) — Analyse à charge du cadrage détaillé écrit (Lots L0-L3)

Cadrage détaillé rédigé dans `PLAN_DECALS.md` (Lots L0-L3, voir ce fichier). Relecture critique
demandée par Saar (« PREND TON TEMPS », deux fois). Un vrai défaut architectural trouvé dans Lot 1 —
pas une confirmation, une correction.

### G. Lot 1 a copié le mauvais patron existant pour l'ancrage géométrique

Le Lot 1 tel qu'écrit calque l'ancrage d'un décor sur `wallAppearanceProfiles[]` (`{id, edgeKeys[],
...}`). **[VÉRIFIÉ par lecture]** : `wallAppearanceProfiles` est pensé pour peindre UNE RÉGION (un
ensemble non ordonné de cases de mur, toutes coloriées pareil) — il ne porte ni position précise, ni
orientation, ni taille propre, parce qu'il n'en a pas besoin (la couleur couvre toute la case).

Un décor a l'exigence inverse : une position exacte, une orientation, une taille, et doit fonctionner
aussi bien sur un mur droit que sur un mur courbe. **Ce problème est déjà résolu dans le code, mais
par un autre mécanisme que celui que j'ai cité** : le connecteur de porte. `shared/world/
surfaceFieldTypes.js:59` et `shared/world/surfaceDocument.js:402` (`DOOR_SEGMENT_REQUIRED`) montrent
qu'une porte stocke `anchorX, anchorZ, tangentX, tangentZ, normalX, normalZ, rotationY, curveOffset,
curveId` **en plus** de `sourceEdgeKeys` (`surfaceFieldTypes.js:53`) — `sourceEdgeKeys` ne sert que de
référence de stabilité/traçabilité, PAS à calculer la position. La position/orientation réelles
viennent de l'ancre + tangente + normale + décalage curviligne, qui fonctionnent identiquement sur un
mur droit ou un arc. La fonction qui calcule cette ancre à la pose existe déjà et est nommée :
`makeDoorConnectorFromWallPoint` (`client/src/lib/connectors.js:129`), appelée depuis un rayon 3D
lancé contre le mur sélectionné (même geste que celui prévu pour poser un décor, Lot 3).

**Conclusion : un décor doit reprendre le patron géométrique de la porte (ancre + tangente/normale +
`curveOffset` + `sourceEdgeKeys` comme référence de stabilité), pas celui de `wallAppearanceProfiles`.**
Le champ `offset (0-1 ou mètres, à trancher)` que j'avais laissé ouvert dans Lot 1 n'a plus lieu
d'être tranché arbitrairement : `curveOffset` est déjà la convention existante, à reprendre telle
quelle. Ça ne change rien à la DÉCISION (toujours `room.wallDecorations[]`, toujours hors de
`surface_data.connectors` — un décor n'a ni état runtime ni règle de collision, `.claude/rules/
world.md` réserve `connectors` à ça) : seule la FORME des champs géométriques change, pour reprendre
un mécanisme déjà prouvé plutôt que d'en inventer un neuf à moitié spécifié.

### H. Conséquence sur la purge (réconciliation à la suppression/fusion d'un mur)

Le Lot 1 prévoyait de purger `wallDecorations` avec `prunedByRetainedEdges` (le même outil que
`wallAppearanceProfiles`), dans `mergeRooms` et `paintRoomFootprintCells`. **Ce outil est fait pour
RÉDUIRE une région** (garder les cases encore valides, perdre les autres) — il n'a pas de sens pour un
objet ponctuel : un décor ne peut pas être « réduit », il est entier ou il n'existe plus.

**[VÉRIFIÉ par lecture]** : les portes suivent déjà une règle différente et plus simple, cohérente
avec un ancrage ponctuel — suppression totale, jamais de recadrage partiel. `deleteRoomBoundaryWalls`
calcule `removedDoorIds` une seule fois (`doorConnectorTouchesBoundaryEdges`, ~l.694) et l'applique
identiquement dans SES DEUX branches : mur ouvert vers l'extérieur (~l.703-704) ET fusion de deux
salles (~l.800-801). Un décor doit suivre exactement la même règle : si son mur d'ancrage disparaît
(fusion ou ouverture vers l'extérieur), le décor est supprimé en entier — jamais réduit. Plus simple à
coder que ce que Lot 1 prévoyait (une seule fonction de suppression à réutiliser, pas un nouvel usage
de `prunedByRetainedEdges`).

**Point non tranché, trouvé en creusant cette différence** : pour l'outil « peindre/effacer des
cases », les portes suivent une TROISIÈME règle, encore différente — `classifyRoomFootprintCells` en
mode « effacer » **refuse carrément d'effacer une case qui porte une porte** (`doorOnCell`,
~l.899-901), elle ne la supprime jamais silencieusement. Aucun précédent dans le code n'indique quoi
faire pour un décor sur ce chemin précis : bloquer l'effacement de la case (comme une porte, plus
protecteur) ou laisser effacer et supprimer le décor en silence (plus simple, cohérent avec « c'est
juste de la déco, pas une porte qui bloquerait le jeu »). **Question réelle pour Saar, pas une
évidence à trancher seul** — une porte est fonctionnelle (bloquer protège un objet qui a un coût de
pose), un décor est cosmétique (bloquer pourrait juste agacer un MJ qui veut repeindre un mur).

### I. Portée du contrôle « pas de superposition »

Confirmé en relisant `.claude/rules/world.md` (« chaque panneau de mur physique peut recevoir deux
contributions intérieures ») : un mur partagé par deux salles a UNE apparence par salle, de chaque
côté. Le contrôle de superposition de Saar (« pas de superposition de décals ») ne doit donc comparer
que les décors de LA MÊME salle sur LE MÊME mur — deux décors posés par deux salles voisines sur les
deux faces d'un même mur physique ne se superposent pas visuellement, ne doivent pas se bloquer l'un
l'autre. À écrire explicitement dans le Lot 1, pas supposé implicitement.

**Deuxième précision, par analogie avec les portes** : une porte ne traverse jamais un coin (toujours
posée sur un seul tronçon de mur droit ou un seul arc, jamais à cheval sur deux). Un décor devrait
suivre la même contrainte — ne jamais chevaucher un coin — plutôt que d'être une question ouverte
silencieuse.

### J. Point mineur — Lot 0, le mot « seed »

`NNN_decal_assets_seed.js` suggère un seed Knex classique (petites données de référence, SQL pur).
Le contenu réel à importer (321 images) doit aussi être uploadé vers MinIO (un service externe) — un
seed Knex ne doit pas faire d'appel réseau vers MinIO (hors de son rôle). Le bon patron est un script
one-shot (`server/src/scripts/import_decal_assets_*.js`), même famille que les scripts d'import de
`texture-pack.js`, pas un fichier de migration/seed. Détail d'implémentation, pas une erreur
d'architecture — à corriger dans le texte du Lot 0.

### Verdict

Point G (ancrage géométrique) est une vraie correction de fond — le Lot 1 tel qu'écrit aurait marché
« à peu près » sur un mur droit mais aurait mal géré un mur courbe (la vraie raison pour laquelle le
rendu, Lot 2, a besoin de `DecalGeometry` plutôt que d'un simple quad). Point H en découle directement
(même ancrage ponctuel ⇒ même règle de suppression que les portes, pas un recadrage de région). Point
I est une précision de portée, pas un changement de conception. Point J est cosmétique. **Un point
reste une vraie question ouverte pour Saar** (§H, bloquer ou pas l'effacement d'une case sous un
décor) — à poser, pas à trancher seul : ni une règle de jeu ni une vraie décision d'architecture, mais
un choix d'ergonomie MJ que je ne peux pas deviner.

## 2026-10-15 — Analyse à charge du cadrage détaillé du Lot 2 (rendu 3D)

Revue critique demandée par Saar sur le cadrage Lot 2 que je viens d'écrire (quad orienté au lieu de
`DecalGeometry`, correction de sens par `interiorNormalSignsByRoom`, hauteur fixe ~1,5 m, chargement
calqué sur `textureMaterials`). Code réellement lu pour cette revue :
`client/src/lib/surfaceGeometry.js` (`getWallRenderBox`, `getWallThicknessFine`), le module
`DecalGeometry.js` de `three` en entier (déjà fait pour écrire le cadrage), `Editor3D.jsx`/
`Canvas3D.jsx` (chargement de `textureMaterials`), `server/src/routes/decal-assets.js` et sa section
de clôture du Lot 0 plus haut dans ce même plan.

### K. Contradiction avec ma propre conclusion de la veille (§Verdict ci-dessus) — assumée, pas oubliée

Le verdict du 2026-10-14 affirmait que le rendu « a besoin de `DecalGeometry` plutôt que d'un simple
quad » à cause d'un mauvais ancrage sur mur courbe (point G). **Ce qui a changé** : le point G a
justement été corrigé au Lot 1 (CLOS) — l'ancrage d'un décor sur un mur courbe est maintenant calculé
exactement sur le point réel du cercle (`makeWallDecorationFromWallPoint`, `connectors.js`), pas sur
la corde approximative d'un panneau tessellé. Une fois l'ancrage exact obtenu, le besoin d'une vraie
projection boîte-sur-maillage (`DecalGeometry`) tombe : c'est justement ce que cet outil apporte de
plus qu'un quad (coller sur une surface dont on ne connaît pas la position exacte) — ici, on la
connaît déjà. La conclusion de la veille n'était pas fausse dans son contexte (elle visait le défaut
d'ancrage, pas le choix de rendu en soi) mais la phrase elle-même, lue isolément, est maintenant
trompeuse. Je la laisse dans le journal (trace d'investigation, pas réécrite) et ce paragraphe sert de
correctif explicite.

### L. La route HTTP `GET /api/decal-assets` n'a jamais tourné en vrai

**[VÉRIFIÉ]** — relu la clôture du Lot 0 ci-dessus : « Non testé : la route HTTP `GET
/api/decal-assets` elle-même (jamais de serveur lancé par l'agent) ». Le cadrage Lot 2 que je viens
d'écrire suppose silencieusement, dans « Chargement des images », que cette route répond déjà
correctement — elle n'a encore jamais répondu à une vraie requête. Risque concret : une erreur de
montage de route (ordre des routes statiques/paramétrées, `.claude/rules/core.md`), un champ
manquant dans la réponse (`url`/`ratio`), ou un problème d'auth (`requireAuth`) ne serait découvert
qu'au moment de coder le Lot 2 — pas bloquant pour écrire le code, mais la première vérification
réelle (Saar démarre le serveur, un appel réel à la route) doit arriver tôt dans le Lot 2, pas être
reportée après tout le reste.

### M. Hauteur fixe ~1,5 m — angle mort trouvé en vérifiant `getWallRenderBox`

**[VÉRIFIÉ]** — `getWallRenderBox` (`surfaceGeometry.js:88`) calcule la hauteur réelle d'un mur par
`Math.max(0.5, Number(wall.height) || 2.5)` : une salle peut légitimement avoir un mur de 0,5 m de
haut (volume bas, mezzanine, passage réduit). Mon cadrage proposait une hauteur fixe de 1,5 m
« identique quelle que soit la hauteur de la salle » sans jamais vérifier qu'elle rentre dans le mur
réel — sur un mur bas, le décor dépasserait du plafond. **Correctif à ajouter au plan avant de
coder** : plafonner la hauteur de pose à la hauteur réelle du mur (déjà disponible via
`getWallRenderBox`) moins une marge, jamais une constante utilisée sans contrôle. Simple à corriger
(un `Math.min`), mais absent du cadrage initial — pas une évidence à laisser de côté.

### N. Matériau du quad — incohérence de lumière non tranchée au cadrage

**[HYPOTHÈSE confirmée par lecture]** — le mur réel (`WallSegment`/`proceduralMaterialAt`,
`SurfaceDungeonScene.jsx`) utilise `MeshStandardMaterial` (réagit à l'éclairage de la scène :
torches, lumière colorée, pénombre). Le cadrage Lot 2 ne tranchait pas le type de matériau du quad.
Un `MeshBasicMaterial` (non éclairé) resterait à la même luminosité quelle que soit la lumière de la
salle, visuellement incohérent avec le mur juste derrière (un décor plein jour sur un mur dans le
noir). Décision à ajouter au plan : le quad du décor utilise aussi `MeshStandardMaterial` (carte
couleur + transparence), même famille que le mur — cohérence d'éclairage, coût de performance
négligeable au vu du nombre de décors attendus sur une carte réelle.

### O. Limite acceptée, pas un défaut caché : mur très fortement courbé

**[HYPOTHÈSE, pas vérifiée empiriquement]** — un quad plat colle exactement au point d'ancrage mais
s'écarte légèrement de la vraie courbe sur les bords du décor (la flèche d'un cercle). Négligeable
pour un décor de l'ordre de 0,5 m sur un mur de salle de taille normale (rayon de plusieurs mètres) ;
deviendrait visible sur un mur à très faible rayon (ex. une tourelle étroite). Aucun précédent dans
ce projet de mur courbe à rayon aussi serré observé en explorant le code — limite connue et
documentée dans le plan, pas une impasse technique à corriger maintenant ni un risque caché.

### P. Scénario de test manquant, pas juste une hypothèse à accepter

**[À VÉRIFIER PAR UN TEST RÉEL, pas une relecture]** — le cadrage suppose qu'un décor retrouve
toujours son panneau de mur porteur par `sourceEdgeKeys` pour lire `interiorNormalSignsByRoom`, y
compris après qu'une porte soit posée plus tard sur une AUTRE partie du même mur (ce qui redécoupe
les panneaux via `cutWallsForDoorConnectors`). Lecture du code : plausible (le découpage se fait par
clé de case, stable), mais seule l'analyse à charge du 2026-10-14 sur un sujet voisin (§P, portes) a
montré qu'une lecture « jusqu'au bout » peut rater une différence réelle. Ce scénario doit être un
des cas testés au moment du code (comme les 10 scénarios du Lot 1), pas seulement une supposition
qui tient à la lecture.

### Verdict (Lot 2)

Deux points changent le texte du plan avant de coder : **M** (plafonner la hauteur à la hauteur
réelle du mur) et **N** (matériau éclairé, pas basique) — je les intègre directement dans
`PLAN_DECALS.md` ci-dessus, ce ne sont pas des questions pour Saar, juste des oublis techniques du
premier passage. **L** n'est pas bloquant mais fixe une vérification à ne pas reporter (la route
HTTP réelle, dès que le serveur tourne). **O** est une limite assumée, à signaler une fois à Saar,
pas à corriger. **P** devient un scénario de test explicite du Lot 2, pas une hypothèse qu'on laisse
filer. **K** n'est pas une erreur de ce cadrage — c'est une correction assumée d'une conclusion que
j'avais écrite la veille, sur la base d'une information qui a changé depuis (le Lot 1 a corrigé
l'ancrage qui rendait cette conclusion vraie à l'époque). Rien ici n'invalide le choix du quad :
au contraire, la revue le renforce (un seul point d'ancrage, déjà exact, suffit).

## 2026-10-15 (suite) — Analyse à charge du cadrage détaillé du Lot 3 (outil d'édition)

Revue critique du cadrage Lot 3 que je viens d'écrire, après exploration du code réel de l'éditeur
(`SurfaceEditorScene.jsx`, `SurfaceWallPanel.jsx`, `SurfaceEditorPanel.jsx`,
`surfaceTools/ConnectorPreview.jsx`, `surfaceTools/computeConnectorPlacement.js`,
`surfaceTools/resolveSelectHit.js`). Deux points corrigés, un point confirmé par lecture complète
(pas partielle).

### Q. La sélection d'un connecteur existant a DEUX mécanismes, pas un seul — j'en avais décrit un et
mal nommé l'autre

Le cadrage affirmait « la sélection d'un connecteur existant raycaste contre son vrai mesh ». En
lisant `findConnectorAtWorldPoint` en entier (`SurfaceEditorScene.jsx` ~l.301-356) : **c'est faux**
pour ce chemin précis — c'est un test géométrique pur contre les coordonnées stockées du connecteur
(boîte min/max calculée depuis `connector.x0/x1/z0/z1`), aucun raycast contre un mesh. Ce chemin est
le filet de secours utilisé par le clic générique en mode Sélection (`resolveSelectHit`), pour un
clic qui tombe près du connecteur sans le toucher pile.

**Un second mécanisme existe en plus**, trouvé juste après : `handleConnectorPointerSelect`
(~l.358-376) est un gestionnaire posé directement sur le mesh rendu du connecteur (pointerDown React
Three Fiber) — celui-là exige bien que le mesh accepte le raycast. `skipNextCanvasMouseDownRef` évite
que le clic soit traité une seconde fois par le gestionnaire générique.

**Conséquence pour le Lot 3** : réactiver le raycast du quad (déjà anticipé au Lot 2) reste la bonne
décision, mais pour reproduire le mécanisme PRINCIPAL (clic direct sur le mesh, comme
`handleConnectorPointerSelect`), pas un filet de secours géométrique — ce second mécanisme (comme
`findConnectorAtWorldPoint`) n'est pas nécessaire pour une v1 : un décor est un quad plat, visible,
facile à cliquer pile, contrairement à une porte dont la zone cliquable peut être plus ambiguë près
d'un mur épais.

### R. Angle mort réel : rien dans le cadrage ne prévoyait d'aperçu avant le clic

En cherchant comment la pose d'une porte affiche un fantôme semi-transparent qui suit la souris
avant le clic (`ConnectorPreview.jsx`, lu en entier) : ce composant recalcule la géométrie en direct
depuis `makeDoorConnectorFromWallPoint(surfaceData, drag.end, surfaceTool)` et rend un
`ConnectorSegment` à opacité réduite. **Le cadrage Lot 3 ne prévoyait rien d'équivalent pour un
décor** — sans aperçu, poser un décor serait un clic à l'aveugle, moins confortable que l'outil
porte existant, régression d'UX silencieuse si je ne la corrige pas maintenant. Correctif à ajouter
au plan : un composant `DecalPreview.jsx` du même patron, qui appelle
`makeWallDecorationFromWallPoint` sur le point survolé et réutilise le rendu du Lot 2
(`wallDecorationPlacement`) à opacité réduite.

### S. Vérifié par lecture complète (pas partielle, leçon du Lot 1 appliquée) : `getSelectedDoorWallPoint`
n'a rien de spécifique à une porte

Le cadrage affirmait pouvoir réutiliser cette fonction telle quelle pour un décor. Lue intégralement
cette fois (`SurfaceEditorScene.jsx` l.246-299, jusqu'à son dernier `return`) : elle filtre par
salle/arêtes sélectionnées et raycaste contre le plan du mur, sans aucune branche conditionnée par un
type de connecteur. L'affirmation du cadrage est confirmée, pas seulement plausible.

### T. Vérifié : `tool.selectedRoomId` est garanti déjà posé quand le panneau Mur est visible

`handleRoomWallPointerSelect` (~l.378-380) refuse de sélectionner un mur si `selectedRoomId` n'est
pas déjà renseigné — la sélection d'un mur suppose toujours une salle déjà sélectionnée avant. La
résolution de `roomId` par `makeWallDecorationFromWallPoint` (qui retombe sur `selectedRoomId`) aura
donc toujours une valeur utilisable au moment où le bouton de pose du Lot 3 est cliquable.

### Verdict (Lot 3)

Deux corrections ajoutées au plan avant de coder : **Q** (réactivation du raycast = reproduire le
clic direct sur le mesh du connecteur, pas son filet de secours géométrique — inutile en v1) et **R**
(aperçu avant clic, absent du premier cadrage, ajouté comme composant à part entière plutôt que comme
détail mineur). **S** et **T** confirment deux affirmations du cadrage par lecture complète, pas
supposées — aucune ne nécessite de changement.

## 2026-10-15 (suite) — Analyse à charge de la révision post-test réel (outil tampon, teinte,
repositionnement — sol reporté v2 par Saar)

Revue critique de la section « Révision 2026-10-15 » du plan, avant tout nouveau code. Sol (point B)
retiré du périmètre par Saar — non analysé ici, repris tel quel pour une v2 future.

### U. Fusion `selectDecalAsset`/`startDecalPlacement` — le code actuel a deux fonctions, la révision n'en veut qu'une

**[VÉRIFIÉ par lecture du code déjà commité]** — `SurfaceWallPanel.jsx` a aujourd'hui deux actions
séparées : `selectDecalAsset(asset)` (ne fait que `onPatch({ decalAssetId, decalWidthM,
decalHeightM })`) et `startDecalPlacement()` (ne fait que `onPatch({ mode: 'decal',
connectorWallEdgeKeys })`), déclenchées par deux éléments différents (clic vignette vs clic bouton).
La révision (§A) exige qu'un seul clic sur la vignette déclenche les deux à la fois. Changement
mécanique mais réel : fusionner les deux patches en un seul appel au clic sur la vignette,
supprimer le bouton « Poser ce décor » et sa logique de `disabled`.

### V. Repositionner un décor déjà posé — le cadrage dit « même geste que la pose », mais élude un vrai risque de perte

Le texte de la révision (§C) dit : « déplacer un décor sélectionné … rebascule l'outil sur son
point d'ancrage … même geste que la pose initiale ». Non précisé, et ça change le risque réel :
**quand l'ancien décor est-il retiré ?**
- Option 1 (retrait immédiat au clic « Déplacer », avant même d'avoir cliqué le nouvel
  emplacement) : simple, réutilise `removeRoomWallDecoration` + le flux de pose tel quel sans
  aucune modification de `addRoomWallDecoration`/`wallDecorationsOverlap`. Risque réel : si
  l'utilisateur change d'outil avant de cliquer un nouvel emplacement, le décor a disparu — **pas
  une perte de données réelle**, `[VÉRIFIÉ]` ce projet a un Annuler/Refaire déjà câblé sur l'éditeur
  de surface (`onSurfaceUndo`/`onSurfaceRedo`, `SurfaceEditorPanel.jsx`) : un Ctrl+Z récupère le
  décor sans rien coder de plus.
- Option 2 (retrait seulement au moment où le nouvel emplacement est confirmé, échange atomique) :
  plus sûr pour l'utilisateur mais exige de faire passer un `excludeDecorationId` à travers
  `computeDecalPlacement` → `addRoomWallDecoration` → `wallDecorationsOverlap`, pour que le décor en
  cours de déplacement ne se bloque pas lui-même comme un chevauchement avec sa propre ancienne
  position pendant l'aperçu.
**Recommandation** : option 1 — le filet de sécurité existe déjà (Annuler), construire
l'exclusion de chevauchement de l'option 2 ajouterait un paramètre traversant 3 fonctions pour un
risque déjà couvert autrement. À confirmer par Saar si le risque « ça disparaît pendant que je
choisis où le remettre » le gêne malgré le Ctrl+Z disponible.

### W. Teinte — un patron déjà présent dans ce projet, pas à inventer

**[VÉRIFIÉ]** — `SurfaceMaterialEditor.jsx` (l.162-163) a déjà exactement le contrôle qu'il faut
pour la teinte d'un décor : `<input type="color">` + un champ texte miroir, avec repli sur une
valeur par défaut si la chaîne n'est pas un hex valide. Même composant visuel à réutiliser pour
`decalColor`, pas une nouvelle UI de sélecteur de couleur à construire.

### X. Cache de matériau reclé par (texture, couleur) — confirmé nécessaire, portée du changement précisée

Le cache actuel (`decalMaterialCache`, Lot 2) est une `Map` indexée par objet `texture` SEUL. Le
reclé en `(texture, couleur)` doit se faire SANS recréer tout le cache : une `Map` imbriquée
(`Map<texture, Map<couleurHex, material>>`), même structure que `opacityMaterialCache` déjà présent
dans le même fichier (`Map` externe par matériau de base, `Map` interne par variante) — patron déjà
utilisé dans ce fichier pour un besoin structurellement identique (une variante dérivée d'un
matériau de base, mise en cache séparément), pas à réinventer.

### Verdict

**U** et **W** sont mécaniques, à appliquer sans discussion. **X** est mécanique mais précise
l'implémentation exacte (réutiliser le patron `opacityMaterialCache` déjà dans le fichier). **V**
est le seul point avec une vraie recommandation à confirmer (option 1, retrait immédiat + filet
Annuler existant) plutôt qu'une construction plus complexe pour un risque déjà couvert — pas
bloquant, mais à dire explicitement avant de coder puisque ça change le comportement perçu par
l'utilisateur en cas d'hésitation pendant un déplacement.
