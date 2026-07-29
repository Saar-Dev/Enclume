# PLAN — Battlemap 2D (carte de scène : illustration ou tokens)

> Statut : Lot 0 (cadrage) tranché avec Saar 2026-07-25, aucun code encore écrit. Document
> temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/MOTEUR_MONDE.md` (rendu/carte) et
> `docs/VOCABULARY.md` (terminologie, non encore ajoutée — voir §5).
> Formalise les entrées ROADMAP « Scènes 2D ambiance » (Phase 3) et « Environnement carte 2D
> (Roll20-like) » (chantiers futurs), fusionnées ici en un seul chantier.

---

## 1. Objectif

Permettre au MJ de créer une carte **2D** (au sens : rendue à plat, caméra plongeante) en plus des
battlemaps 3D existantes, pour représenter un lieu — deux usages couverts par le même mécanisme :

- une **illustration pure** (ambiance, pas de grille, pas de token) ;
- une **battlemap 2D à tokens** (fond d'image + tokens ; grille optionnelle, purement visuelle/
  organisationnelle, désactivée par défaut), pour des scènes qui ne justifient pas la construction
  d'une battlemap 3D complète (temps de conception) mais où le groupe agit et se déplace quand même
  un minimum.

Distinction actée avec Saar (session 2026-07-25) : une **carte** montre un lieu où le groupe se
trouve. C'est différent d'un **Spotlight** (bibliothèque de présentation ponctuelle — personnage,
document, indice — qui se superpose sans changer de lieu) : voir §2, besoin distinct, hors périmètre
de ce plan.

> **Segmentation v1/v2 actée avec Saar (session 2026-07-29).** Ce plan couvre uniquement la **v1** :
> illustration et battlemap 2D à tokens, sans combat construit dessus, grille purement visuelle et
> désactivée par défaut. Le combat sur carte 2D (mouvement tactique, portée, ligne de vue affichée,
> allures compatibles avec les outils 3D) devient un chantier **v2**, non cadré à ce jour, plan
> séparé à écrire le moment venu — voir §2.

---

## 2. Hors périmètre explicite

- **Combat sur carte 2D (v2)** : mouvement tactique, portée, ligne de vue affichée, allures
  compatibles avec les outils 3D. Décision actée avec Saar (session 2026-07-29) : hors périmètre de
  ce plan (v1), plan v2 séparé à écrire quand cadré. Le bouton "⚔ Combat" reste donc gardé/masqué en
  mode 2D tant que ce plan v2 n'existe pas — voir §8, Lot 3, correction 2026-07-29.
- **Spotlight / bibliothèque de présentation** (montrer un personnage, un document, une enquête en
  overlay ponctuel sans quitter la scène en cours). Besoin réel identifié dans la même discussion,
  mais responsabilité différente (`docs/RegleDocumentaire.md` Règle 1) — se greffera probablement
  sur `campaign_documents`/`documents.js` existant. Plan séparé à écrire le moment venu.
- **Battlemap 3D existante** (`voxel_data`/`surface_data`/`WorldSnapshot`/`Editor3D.jsx`/
  `Canvas3D.jsx`) : ce plan n'y touche pas et ne la remplace pas. Elle reste l'outil pour les
  bagarres tactiques complètes.
- **Fog of war / illumination de zones dynamique** : besoin exprimé par Saar comme évolution
  possible « si le besoin des joueurs se fait sentir » — pas construit maintenant. Ce plan choisit
  simplement une architecture qui n'hypothèque pas cette évolution (voir §4.3).

---

## 3. Fondations déjà en place (réutilisables, pas à reconstruire)

- **`battlemaps`** (`server/src/db/migrations`, table courante) porte déjà `folder`, `image_url`,
  `grid_size`, `grid_enabled`, `grid_opacity`, `scale_label` — pensés dès l'origine pour un usage
  2D-compatible, mais `folder` n'est utilisé **nulle part côté client** aujourd'hui (sélecteur en
  barre plate, `SessionPage.jsx:528-559`).
- **`tokens.position_space`** distingue déjà `world-feet` (autorité actuelle, moteur monde) de
  `legacy-cell` (ancien système de positionnement 2D par grille, migration 153, **code mort** —
  rejeté explicitement par tout le pipeline combat : `worldMovementService.js:216`,
  `worldVisibilityService.js:81`, `socketCombatAnnouncement.js:35`). Précédent direct : le projet a
  déjà eu une « battlemap 2D à sa façon » avec sa propre autorité spatiale, et l'a abandonnée. Ne
  pas la réinventer (voir décision §4.1).
- **`shared/world/worldCompiler.js`** compile `surface_data` en `WorldSnapshot` immuable — autorité
  unique mouvement/LOS/couverture/occupation (`.claude/rules/world.md`).
- **`VisibilityService`** (`worldVisibilityService.js`) calcule déjà la vision par paire
  observateur/cible à partir des mêmes occluders/colliders que la collision (canaux Plein/Verre/
  Grille/Ouverture, `docs/SYSTEME/MOTEUR_MONDE.md §8`).
- **Système d'effets/zones générique** (`world_effect_definitions`/`world_effect_instances`,
  `docs/SYSTEME/MOTEUR_MONDE.md §9`) : modificateurs de mouvement/visibilité/dégâts/tests déjà
  extensibles sans nouveau système ad hoc — support naturel d'une future zone d'obscurité/source de
  lumière.
- **Stack rendu** : `@react-three/fiber` + `@react-three/drei` déjà en dépendance
  (`client/package.json:16-17`), aucune lib 2D (Konva/Pixi/Fabric) présente.

---

## 4. Décisions tranchées (Lot 0, 2026-07-25)

### 4.1 Une carte 2D est une battlemap à part entière, pas un second moteur

Une carte 2D est une ligne `battlemaps` avec un `surface_data` **trivial** (une pièce ouverte, sans
murs) plutôt qu'un système de coordonnées ou de règles séparé. Conséquence directe : tokens en
`world-feet` comme aujourd'hui, réutilisation intégrale de `worldMovementService`,
`worldVisibilityService`, budget de mouvement, statuts, INI — zéro logique métier dupliquée (P4).
Rejette explicitement l'option d'un nouveau `position_space` 2D (reviendrait à recréer
`legacy-cell`, cf. §3).

**[VÉRIFIÉ] 2026-07-25, par exécution réelle (script jetable, pas de fichier conservé) :**
`compileSurfaceWorld`/`prepareSurfaceData` acceptent une salle unique avec `floorEnabled: true` et
`wallEnabled: false` sans erreur — 100 supports de sol (une par case, salle 10×10), **0 barrière de
mur**, 1 compartiment, vision totale entre deux coins opposés (`status: 'clear'`, 0% de couverture
bloquée). Une `surface_data` **totalement vide** (`rooms: {}`) compile aussi sans erreur mais produit
**0 support** — pas de nœud de navigation, donc mouvement probablement cassé (pathfinding non testé
directement, mais l'absence de tout support l'exclut de toute façon). **Décision confirmée** : une
carte 2D est une salle unique, sol activé, murs désactivés — jamais une `surface_data` vide.

Réserve : le détail fin du calcul de portée de vision (coordonnées `y`/`z` de la ligne de visée) n'a
pas été confirmé au pixel près — l'appel direct à `evaluateWorldVisibility` en dehors de la route API
réelle a peut-être une forme de paramètres légèrement différente. Le statut `clear` et l'absence
d'erreur sont fiables ; le détail géométrique fin reste à confirmer via la vraie route au Lot 2/3.

### 4.2 Spotlight est un besoin distinct, hors de ce plan

Voir §2. Décision actée pour éviter qu'un seul chantier porte deux responsabilités (Règle 1
documentaire).

### 4.3 Rendu 2D : nouveau composant Three.js/react-three-fiber séparé — pas `Canvas3D.jsx`, pas de lib 2D dédiée

**Recherche externe (2026-07-25)**, demandée explicitement par Saar avant de figer ce choix — ne
jamais coder de zéro sans avoir regardé comment les pros font :

- **Foundry VTT** (référence du domaine) : moteur PixiJS (WebGL 2D dédié), jamais un moteur 3D —
  [Introduction to PIXI](https://foundryvtt.wiki/en/development/guides/pixi),
  [Frameworks and Libraries](https://foundryvtt.com/article/frameworks/).
- **Owlbear Rodeo 1.0** (open source) : Konva pour la carte 2D, Babylon.js réservé aux dés 3D,
  jamais réutilisé pour la carte —
  [owlbear-rodeo-legacy](https://github.com/owlbear-rodeo/owlbear-rodeo-legacy).
- **skyloutyr/VTT** (auto-hébergé, seul projet trouvé avec *exactement* notre contrainte : 2D et 3D
  dans le même outil) : un seul moteur (OpenGL/.NET), le mode 2D est une caméra 3D contrainte, avec
  son propre fog of war ray-tracé « for both 3D and 2D environments » —
  [GitHub](https://github.com/skyloutyr/VTT).
- **Nuance assumée** : Foundry/Owlbear ne sont pas de bons comparables directs — outils 2D purs dès
  l'origine, jamais eu à cohabiter avec un moteur 3D existant. Seul skyloutyr/VTT a notre problème
  réel, et c'est un projet plus confidentiel — un point de données, pas "la" pratique standard du
  domaine.
- **Correction d'une affirmation antérieure** : « le fog of war est quasi gratuit avec Three.js »
  était faux/non prouvé — Foundry et Owlbear le font tourner sur des moteurs 2D dédiés. L'algorithme
  (shadowcasting / polygone de visibilité, référence
  [Red Blob Games](https://www.redblobgames.com/)) est **indépendant du moteur de rendu**. Lib prête
  à l'emploi identifiée : [`visibility-polygon`](https://www.npmjs.com/package/visibility-polygon)
  (npm, construit un polygone à partir de segments de mur) — nos murs sont déjà calculés par
  `WorldSnapshot.spatial.barriers/colliders` (vérifié §4.1), donc la géométrie nécessaire existera
  déjà côté serveur le jour venu, quel que soit le moteur de rendu choisi.
- **Point rassurant confirmé** : le pattern « grille top-down + tokens » en react-three-fiber est
  documenté et pratiqué dans la communauté, pas une bidouille —
  [r3f-game-demo](https://github.com/coldi/r3f-game-demo),
  [Making a 2D RPG game with react-three-fiber](https://dev.to/flagrede/making-a-2d-rpg-game-with-react-tree-fiber-4af1).

**Décision maintenue, sur des bases plus modestes qu'avant** : nouveau composant Three.js/
react-three-fiber séparé. Pas parce que le fog of war y serait gratuit, mais parce que (1) c'est un
pattern communautaire réel et documenté, (2) ça évite une deuxième dépendance de rendu lourde
(Pixi/Konva) alors que Three.js est déjà dans le bundle, (3) ça garde toute la géométrie (murs,
sols) dans une seule source, le moteur monde existant. Une lib 2D dédiée (Pixi/Konva) reste une
option professionnelle sérieuse et documentée si Three.js s'avère pénible en pratique au Lot 2 — pas
un choix figé irréversible.

Débat mené à charge avec Saar (2026-07-25), trois options comparées :

| Option | Coût aujourd'hui | Coût futur (fog of war/éclairage) | Risque fusion `dev/monde` |
|---|---|---|---|
| Lib 2D dédiée (Konva/Pixi) | Faible | Élevé — occlusion/masquage à réécrire de zéro, hors du canal vision existant | Aucun |
| Nouveau composant Three.js séparé | Moyen | Faible — hérite des primitives Three.js (Fog, spotlights, stencil/render target) et du canal vision `§8` | Aucun |
| Modifier `Canvas3D.jsx` directement | Moyen | Faible | Élevé — fichier activement modifié par Codex sur `dev/monde` |

**Retenu : nouveau composant Three.js séparé** (nom de travail `Battlemap2D.jsx`, renommé `Canvas2D.jsx`
au Lot 2 — cohérence avec `Canvas3D.jsx`/`Editor3D.jsx`, nommés par rôle technique + dimension plutôt
que par concept métier ; pas de risque de collision future, ce plan exclut un `Editor2D` §7 point 4).
Principe de rendu :

- un plan texturé (géométrie plane) recevant `image_url` comme texture ;
- une **caméra orthographique** fixe — pas perspective, pour un rendu plat stable quel que soit le
  zoom (contrairement à la 3D) ;
- tokens en billboards/sprites (toujours face caméra) ;
- grille en overlay au-dessus du plan, réutilisant `grid_size`/`scale_label` existants ;
- coordonnées serveur inchangées (`world-feet`) — seule la caméra/le rendu changent de mode.

> **Correction 2026-07-28 (Lot 2 codé) — "plongeante" décrit l'intention visuelle, pas
> l'implémentation retenue, à ne pas lire comme une caméra tournée vers le bas.** La caméra plongeante
> classique (tournée pour regarder le long de l'axe `Y`, comme une vue aérienne d'un monde 3D Y-up)
> place le calcul d'`OrbitControls`/`MapControls` (utilisés pour le pan/zoom) exactement dans son point
> singulier (calcul sphérique autour de `camera.up`) — `[VÉRIFIÉ]` par lecture du code source
> `MapControls`/`OrbitControls`, confirmé par un vrai bug de pan lors du test du Lot 2. Architecture
> réellement codée (§10, Lot 2) : la carte est posée dans le plan que la caméra regarde **par
> défaut** (XY, caméra le long de `Z`, **sans rotation**, comme `coldi/r3f-game-demo`) — le rendu final
> est identique à l'œil (une carte plate vue de face), seule la mécanique caméra interne diffère de ce
> que ce paragraphe suggérait. Détail complet et raisons : §10, ligne Lot 2.

Bénéfice noté par Saar : une caméra orthographique séparée ouvre la porte à différentes
profondeurs/filtres visuels (plans superposés, effets de rendu propres au 2D) — à creuser au Lot 2,
pas cadré en détail ici.

**Spike de vérification (2026-07-25)**, avant de cadrer le Lot 2 en détail — instrumenter plutôt que
supposer (CLAUDE.md §6.4), même principe que la vérification serveur du Lot 0. Fichier HTML autonome
jetable (Three.js vanilla via CDN, hors dépôt) : plan texturé (illustration test générée), caméra
orthographique plongeante, grille overlay séparée, deux sprites billboard déplaçables par raycast
souris→plan avec accroche à la grille, zoom molette. **Validé visuellement par Saar** : netteté au
zoom, alignement grille/image et confort du drag tous « OK ». Le motif technique (pas le fichier
lui-même) sert de base au Lot 2 — voir §7.

### 4.4 Sélecteur de cartes : rework arborescence + icône de type, séquencé après le cœur du rendu

Le sélecteur actuel (barre plate, `SessionPage.jsx:528-559`) ne passera pas à l'échelle avec deux
types de carte. Cohérent avec `battlemaps.folder` déjà existant mais inutilisé. Retenu comme lot de
ce plan (le sélecteur sert exactement les cartes définies ici) mais **séquencé après** le rendu 2D
fonctionnel — un seul problème à la fois (CLAUDE.md §6.8).

---

## 5. Reste à trancher

Plus rien d'ouvert à ce stade. **Terminologie** : résolue, ajoutée à `docs/VOCABULARY.md` (« carte
2D », `render_mode`, `Canvas2D` utilisés sans ambiguïté depuis 4 lots). Les deux questions
produit de l'analyse critique du 2026-07-25 sont tranchées : suppression de dossier en `CASCADE`
avec confirmation client (§9), carte 2D modifiable après création via une action "Paramètres"
(§8).

---

## 6. Lot 1 — discriminant de rendu (détail)

> Cadrage 2026-07-25. Convention interne vérifiée (pas de recherche externe nécessaire — décision de
> nommage, pas un mécanisme non trivial) : les discriminants similaires (`fire_mode`, `reload_mode`,
> `state_fire_mode`, `type`) sont systématiquement `table.text(...).notNullable().defaultTo(...)`,
> jamais un enum Postgres natif. **Aucun code écrit.**

1. **Champ** : `battlemaps.render_mode`, `text`, `notNullable().defaultTo('3d')`. Toutes les
   battlemaps existantes et tout code qui ignore encore la colonne (ex. `dev/monde` avant fusion)
   continuent de se comporter en 3D — rétrocompatible par construction (CLAUDE.md §5).
2. **Génération de la salle triviale** : le serveur la synthétise à la création
   (`POST /battlemaps`) si `render_mode='2d'` — jamais via l'éditeur de salle/voxel, que le MJ ne
   voit jamais pour une carte 2D. Réutilise directement la forme vérifiée Lot 0
   (`floorEnabled: true`, `wallEnabled: false`).
3. **Dimensionnement de la salle triviale** : dépend de la taille de l'image uploadée (éviter qu'un
   token sorte du cadre de l'illustration) — renvoyé au **Lot 3** (flux de création MJ), qui gère
   déjà l'upload d'image.
4. **Migration** : plus haute actuelle `205_char_advantage_notes_category.js` (impair, Claude).
   Prochain numéro impair libre **207** — à reconfirmer contre `knex_migrations` au moment de coder
   (CLAUDE.md §5), pas figé ici.
5. **Réversibilité — écrit ici pour ne pas rester seulement dans la conversation (CLAUDE.md P8)** :
   `render_mode` ne contrôle que le rendu client, jamais ce que la donnée peut contenir. Rien
   n'empêche techniquement de rouvrir plus tard une carte 2D dans l'éditeur 3D existant
   (`Editor3D.jsx`) pour y ajouter de vrais murs/volumes — la salle triviale reste un `surface_data`
   standard, pas un format restreint. Aucune UI ne l'expose en Lot 1-4 (hors périmètre), mais
   l'architecture ne s'y oppose pas.

---

## 7. Lot 2 — composant de rendu (détail)

> Cadrage 2026-07-25, après validation du spike §4.3. **Aucun code produit écrit.**

**Périmètre strict** (ne pas déborder sur Lot 3) : rendu seul — plan texturé, grille, caméra
orthographique, pan/zoom. **Aucun token, aucune interaction d'édition, aucun flux de création.**

1. **Fichier** : `client/src/components/Canvas2D.jsx` (renommé depuis le nom de travail `Battlemap2D.jsx`
   — cohérence avec `Canvas3D.jsx`/`Editor3D.jsx`, voir §4.3). Nouveau fichier, ne touche pas
   `Canvas3D.jsx`/`Editor3D.jsx` (raison §4.3 : friction `dev/monde`).
2. **Conversion case↔mètres** : réutiliser `shared/world/worldMetrics.js`
   (`cellsToMeters`/`metersToCells`, `DEFAULT_WORLD_METRICS`) — **pas** recalculée à la main comme
   dans le spike jetable. Idem pour le futur raycasting token (Lot 3) : réutiliser
   `dbPositionToWorldPoint`/`worldPointToDbPosition` (convention PE14 déjà en place :
   `pos_y` DB = profondeur Z monde, `pos_z` DB = altitude Y monde) pour rester cohérent avec le
   reste du moteur dès le premier commit, pas une convention ad hoc propre au 2D.
3. **Persistance caméra (pan/zoom)** : réutiliser `battlemaps.viewport_state` (JSONB, déjà présent
   en base, déjà accepté par `PUT /battlemaps/:id` — `battlemaps.js:711-747`, champ à la ligne 724/733
   (référence corrigée 2026-07-28 — la ligne citée initialement pointait dans la route `GET /:id`,
   jamais vérifiée contre le fichier réel) — mais **jamais lu ni
   écrit côté client aujourd'hui**, colonne morte comme `folder` avant Lot 4). Pas de nouvelle
   colonne.
4. **Intégration `SessionPage.jsx`** : nouvelle branche de rendu conditionnée par
   `battlemap.render_mode === '2d'`, remplaçant le choix actuel `mode === 'edit' ? Editor3D :
   Canvas3D` (`SessionPage.jsx:570-571`). **Décision découlant directement de Lot 1 point 2** (le MJ
   ne voit jamais l'éditeur de salle/voxel pour une carte 2D) : le toggle "Éditer" (mode plein écran
   `Editor3D`, bouton dans `Sidebar.jsx:1034-1044` — corrigé 2026-07-28, ce n'est pas
   `handleCombatToggle`/le bouton "⚔ Combat" de la `gmBar`, deux mécanismes différents, jamais vérifié
   avant) n'a pas de sens pour une carte 2D et reste masqué/inactif quand `render_mode='2d'` (codé Lot
   2 : prop `renderMode2D` sur `Sidebar`). **Le bouton "⚔ Combat" lui, n'était pas gardé** au moment de
   la clôture de ce Lot 2 — correction du 2026-07-28, voir §8. **Décision inversée le 2026-07-29** (§8,
   segmentation v1/v2) : le bouton doit désormais être gardé/masqué en 2D — garde ajoutée au Lot 3, pas
   au Lot 2 déjà clos. **Ne pas confondre avec la modification
   image/grille** (Saar confirme une carte 2D doit rester modifiable après création) : ce n'est pas
   ce toggle-là, c'est une action "Paramètres" distincte, cadrée en Lot 3 §"Modification après
   création" — un panneau/modale, jamais un mode plein écran équivalent à `Editor3D`.
5. **Cadrage caméra initial** (absent du cadrage précédent, corrigé) : à l'ouverture d'une carte 2D,
   la caméra s'ajuste automatiquement pour cadrer l'image entière, centrée — pas de zoom/pan par
   défaut arbitraire. Calcul déterministe à partir des dimensions connues de la salle triviale (Lot 1
   point 3), pas une valeur devinée à l'écran.
6. **i18n** (`.claude/rules/i18n.md`, auto-chargée dès qu'un `.jsx` est touché) : aucun texte visible
   codé en dur — tout passe par `useTranslation()`/`t('session.*')`, clés ajoutées dans
   `client/src/locales/fr.json` **avant** usage.
7. **Condition de clôture du lot** : valider la netteté (§4.3 spike) avec une **vraie image
   uploadée** (JPEG/PNG réelle, pas la texture procédurale du spike jetable) avant de considérer ce
   lot terminé — le spike n'a validé qu'un cas favorable synthétique.

---

## 8. Lot 3 — tokens et flux de création (détail)

> Cadrage 2026-07-25, après lecture de `Canvas3D.jsx`, `useBattlemapManager.js`, `RadialMenu.jsx`.
> **Corrigé le 2026-07-28**, après relecture complète de `Scene` (`Canvas3D.jsx`, ~500-1300 lignes) —
> pas seulement des extraits — avant de coder quoi que ce soit. **Aucun code produit écrit.**

**Correctif du 2026-07-28 (2ᵉ passe) — le geste réel n'est pas "clic→prévisualisation→confirmation",
et cette prévisualisation n'existe qu'en combat.** Version précédente basée sur une lecture partielle
(`Canvas3D.jsx:693,947` isolément). Après lecture complète de `handleDragStart`/`handlePointerMove`/
`handlePointerUp` : le geste est un **drag** (pointerdown sur le token → mouvement → pointerup), avec
un ghost calculé **côté client** pendant le drag — pas des clics séparés. `world-path-preview` (l'aller-
retour serveur de prévisualisation) n'est appelé que si `combatMoveMode` est actif ; hors combat (le
seul cas pertinent pour le 2D aujourd'hui, pas de combat sur une carte 2D, §1), le pointerup déclenche
**un seul appel serveur** :
- MJ (n'importe quel token qu'il déplace, avec ou sans `character_id`) → `POST /tokens/:id/teleport`
  (`tokens.js:107` — action administrative MJ-only, transaction, **aucune notion de budget**) ;
- joueur déplaçant son propre token → `POST /battlemaps/:id/world-move` (budget calculé côté serveur
  depuis la fiche personnage, inchangé, CLAUDE.md §7).

Canvas2D reprend ce même flux à un seul appel (pas de prévisualisation combat, hors périmètre) : drag
avec ghost client, puis `teleport` (MJ) ou `world-move` (joueur) au relâchement — aucune règle métier
dupliquée, le serveur reste la seule autorité dans les deux cas.

**Correctif du 2026-07-28 — pas de hook `useTokenMovement.js` partagé, décision inversée.** La version
précédente de cette section demandait l'extraction obligatoire de la logique de mouvement de
`Canvas3D.jsx` vers un hook commun. Après lecture complète de `Scene` : cette logique n'est **pas**
isolée — elle est mêlée à `combatMoveMode`/`combatTargetMode`/`losMode` (`useCombatStore`), à la
caméra troisième-personne (`followToken`/`thirdPersonCameraActive`), au système d'entités et aux
changements de niveau d'affichage.

**Correction du 2026-07-28 (2ᵉ passe) — le combat sur une carte 2D n'est PAS interdit, contrairement à
ce qu'affirmait la version précédente.** Cette section présentait « pas de combat sur une carte 2D »
comme une décision actée par Saar — c'était une déduction non validée, jamais tranchée. Confirmé avec
Saar 2026-07-28 : le combat doit rester possible sur une carte 2D à terme. Rien dans le code ne
l'empêche d'ailleurs déjà (le bouton "⚔ Combat", `SessionPage.jsx:561-568`, n'est gardé par aucune
condition `render_mode`, contrairement au toggle Édition). Ce que ce Lot 3 ne fait **pas**, c'est
construire le combat complet sur 2D (portée, ligne de vue affichée, prévisualisation de chemin combat)
— report légitime par charge de travail, pas par impossibilité technique : à vérifier séparément
(`useCameraLOS.js`, `[VÉRIFIÉ]` 2026-07-28) la ligne de vue (`POST /battlemaps/:id/world-visibility`)
est déjà un calcul **serveur**, indépendant du rendu (basé sur le `WorldSnapshot` compilé depuis
`surface_data`, pas un raycast Three.js) — elle fonctionnerait sur une carte 2D sans changement
serveur, une salle triviale sans mur donnant simplement une ligne de vue toujours dégagée. Le seul
travail 2D-spécifique, le jour où le combat y sera construit : dessiner la ligne renvoyée dans le plan
de Canvas2D, et laisser tomber la mise en scène caméra "épaule" (`moveCameraToShoulder`), propre à une
caméra orbitale 3D, sans objet pour une caméra fixe plongeante. Non planifié dans ce Lot 3.

**Correction du 2026-07-29 — décision inversée : le combat EST bloqué en 2D pour la v1.** L'analyse
technique de la correction du 2026-07-28 ci-dessus reste valide (rien n'empêche techniquement le
combat sur 2D, la LOS serveur fonctionnerait déjà sans changement) — mais Saar a depuis tranché la
segmentation du plan en v1 (sans combat) / v2 (combat + grille tactique + LOS affichée + allures,
plan séparé non cadré à ce jour — voir §1, §2). Conséquence produit, pas technique : le bouton
"⚔ Combat" (`SessionPage.jsx:561-568`, `handleCombatToggle`) doit être gardé/masqué quand
`battlemap.render_mode === '2d'`, même patron que le toggle Édition (§7 point 4). Point de code
ajouté à ce Lot 3.

Deux options considérées pour le mouvement de base (hors combat, ce que ce Lot construit vraiment) :
- démêler le noyau combat de `Scene` pour en sortir un hook réellement pur → gros chantier à haut
  risque sur du code de production **sans aucun test automatisé**, pour un bénéfice nul tant que le 2D
  ne fait pas encore de combat ;
- forcer un hook partagé qui traînerait des dépendances combat inutiles pour Canvas2D aujourd'hui →
  abstraction prématurée (CLAUDE.md : « ne pas refactoriser au-delà de ce que la tâche exige »).

**Décision retenue** : Canvas2D n'appelle pas de code React partagé avec `Scene`, il consomme
directement les **mêmes routes serveur** (`teleport`/`world-move`, voir correctif ci-dessus) — déjà
l'autorité unique (CLAUDE.md §7) — via un drag propre à Canvas2D, plus simple que celui de `Scene` (pas
de combat construit dans ce lot, pas de caméra troisième-personne à porter). Aucune duplication de règle
métier : la règle (budget, droits MJ/joueur) reste calculée une seule fois, côté serveur, dans les
deux cas. Seul le geste d'interaction côté client n'est pas partagé — ce n'est pas une règle métier.

**Sélection et menu contextuel — mauvais composant cité, corrigé 2026-07-28.** La version précédente
citait `RadialMenu.jsx` comme « le » menu radial réutilisable. Vérifié contre l'usage réel dans
`SessionPage.jsx` : `RadialMenu` (L.927) sert aux **interactions d'entités du monde** (portes,
leviers — `onEntityClick`), sans rapport avec les tokens. Le vrai menu contextuel de token est
**`TokenRadialMenu.jsx`** (`SessionPage.jsx:738-754` — fiche personnage, retirer le token, rotation,
panneau de statuts, "viser", échange), jamais mentionné avant. Lui aussi vérifié DOM pur (aucun import
Three.js) — réutilisable tel quel, mais c'est **celui-ci** que Canvas2D doit consommer pour le clic
droit/double-clic sur un token, pas `RadialMenu`.

**Vérification de propriété absente du geste de déplacement — trouvé le 2026-07-28.** Le routage
serveur (`teleport`/`world-move`, plus haut) ne dit rien de la garde côté client qui décide **qui a le
droit de démarrer le drag**. Dans `Canvas3D.jsx` (`handleDragStart`) : un non-MJ ne peut démarrer un
drag que sur un token dont il possède le personnage (`character.user_id === user?.id`) — sinon rien ne
se passe, aucune requête serveur envoyée. Canvas2D doit reprendre cette même garde à l'identique avant
tout drag — sans elle, un joueur pourrait tenter de déplacer le token d'un autre joueur ou un marqueur
MJ (le serveur refuserait `world-move` sur un token qui n'est pas le sien, mais `teleport` est MJ-only
côté serveur — un joueur qui l'appellerait recevrait un 403, la garde client est une question d'UX
propre, pas une brèche de sécurité, mais son absence donnerait un bouton qui échoue silencieusement
plutôt qu'un geste qui ne démarre jamais).

**Dette de divergence assumée, à écrire noir sur blanc.** Canvas2D porte sa propre implémentation du
drag, séparée de celle de `Scene` (`Canvas3D.jsx`) — décision correcte pour ce lot (§8, plus haut :
éviter de toucher du code combat sans test pour un bénéfice nul aujourd'hui). Le jour où le combat sera
construit sur une carte 2D (confirmé possible par Saar, §8), ces deux implémentations client du "drag
un token" devront être réconciliées ou explicitement justifiées comme deux gestes différents pour deux
contextes différents — à retrancher à ce moment-là, pas oublié ici.

**Manque relevé le 2026-07-28, à combler en codant, pas avant** : `Canvas2D` (Lot 2, livré) ne reçoit
que `battlemap` en prop — aucun accès aux tokens/personnages. `Canvas3D`/`Scene` les lit directement
via `useTokenStore`/`useCharacterStore` (Zustand), pas via des props (`Canvas3D.jsx:527-528`). `Canvas2D`
devra faire de même (lire ces stores directement, pas ajouter un relais de props depuis
`SessionPage.jsx`) pour rendre les tokens du Lot 3b — cohérent avec « les stores contiennent l'état
partagé » (`.claude/rules/react.md`).

**Badges de statut — périmètre précisé (2026-07-28, imprécis avant).** `Canvas3D.jsx` les affiche via
`@react-three/drei` (`Billboard` + `Html`, `TokenMesh`, `Canvas3D.jsx:238-268,315-360`) — primitives
disponibles nativement dans Canvas2D puisque c'est aussi un contexte react-three-fiber (Lot 2).
**Extraction obligatoire, pas optionnelle** : contrairement au mouvement, `TokenLabel` (nom, canvas
texture + sprite) et le bloc badges (pastille MJ, icônes de statut) sont de la présentation pure, sans
état combat — aucune des raisons de la section précédente ne s'applique.
- **Sortent** vers un module partagé : `TokenLabel`, le bloc badge MJ (`Billboard`+`Text`), le bloc
  icônes de statut (`Html`+`img`), et les constantes qu'ils utilisent aujourd'hui uniquement définies
  en haut de `Canvas3D.jsx` — `FONT_URL`, `STATUS_CATEGORY`, `STATUS_CATEGORY_COLOR` (sans elles,
  l'extraction ne compile pas, elles doivent voyager avec le composant, pas être redéfinies en double).
- **Ne sortent pas** : `TokenActiveDisk` (pulsation tour actif) et `TokenRing` (anneau de sélection) —
  vérifié : ce sont déjà des composants de présentation pure pilotés par props (`isActive`/
  `isSelected`), pas couplés eux-mêmes à `useCombatStore` (c'est l'appelant qui calcule ces props
  depuis le combat/la sélection). Laissés dans `Canvas3D.jsx` par choix de périmètre (YAGNI) : Canvas2D
  n'a pas encore de sélection/tour actif à afficher (Lot 3b, pas encore fait). Si extraits plus tard,
  noter qu'ils sont tournés `[-Math.PI/2,0,0]` (convention sol XZ de `Canvas3D`) — à ajuster pour la
  convention XY sans rotation de Canvas2D (Lot 2), même type d'ajustement que la `Grid`.

**Grille — réglage d'offset, demandé par Saar 2026-07-28** : un champ de résolution seul (`grid_size`,
px/case) ne corrige pas un désalignement de l'image uploadée avec la grille (constat Roll20 : quasi
jamais pile au premier essai). Deux nouvelles colonnes `battlemaps.grid_offset_x`/`grid_offset_y`
(`integer`, `defaultTo(0)`, px) — migration **211** (impaire, Claude — 209 déjà pris par un autre
chantier sans rapport, correctif munitions `209_fix_ref_equipment_ammo_sap_iem.js`, vérifié contre
`knex_migrations`). Réglées dans le formulaire de création et la modale "Paramètres"
(deux champs numériques simples pour ce lot — pas de poignées de glisser-déposer sur l'aperçu, hors
périmètre V1, à reconsidérer si Saar le juge nécessaire après usage réel). `grid_size` par défaut
reste **64** (valeur déjà utilisée par les cartes 3D, `battlemaps.js`) — pas 70 (Roll20) : un défaut
différent selon `render_mode` sur la même colonne aurait été une incohérence silencieuse.

**Grille désactivée par défaut pour une carte 2D — décision Saar 2026-07-29.** `Canvas2D.jsx` respecte
déjà `grid_enabled` (`Canvas2D.jsx:153-154`, `[VÉRIFIÉ]` par lecture) — aucun nouveau rendu à écrire.
Le formulaire de création (2D) envoie `grid_enabled: false` par défaut, au lieu du défaut colonne
`true` (`20260329_04_battlemaps.js:8`, pensé pour la 3D) ; le MJ peut l'activer lui-même via
"Paramètres" (plus bas, "Modification après création") s'il veut un repère visuel/organisationnel —
jamais un mécanisme de combat tant que le plan v2 (§1, §2) n'existe pas.

**Point de code à ajouter — consommation de `grid_offset_x`/`grid_offset_y` dans `Canvas2D.jsx`
(absent de la rédaction précédente).** Le composant existe déjà (Lot 2, livré) : `<Grid position=
{[bounds.centerX, bounds.centerY, 0.01]} .../>` (`Canvas2D.jsx`). Le Lot 3 doit décaler cette
`position` (et la `position` du plan image si l'offset doit aussi recadrer l'image, à trancher au
moment de coder selon ce qui rend visuellement le mieux) des deux nouvelles valeurs — converties de
pixels vers l'unité de case déjà utilisée par `Canvas2D` (`offsetCells = offsetPx / grid_size`, pas
une nouvelle constante de conversion). Un vrai changement de fichier pour ce lot, pas seulement un
ajout de formulaire/colonnes.

**Ancien paragraphe "friction — budget des jetons libres MJ" retiré (2026-07-28)** : reposait sur une
prémisse fausse (voir correctif du geste ci-dessus) — un MJ qui déplace un jeton hors combat passe par
`/tokens/:id/teleport`, sans aucune notion de budget. Rien à résoudre, rien à coder ici.

**i18n** (`.claude/rules/i18n.md`) : formulaire de création, choix `render_mode`, tout texte visible
passe par `t('session.*')`/`t('common.*')` — clés ajoutées avant usage, comme pour Lot 2.

**Modification après création — tranché avec Saar 2026-07-25** : une carte 2D reste modifiable
(réuploader l'image, changer la grille), pas de "supprimer et recréer". Nouvelle action "Paramètres"
dans le menu contextuel existant (`mapContextMenu`, même patron que renommer/dupliquer/supprimer,
`useBattlemapManager.js:20,80-135`) — une modale, pas un mode plein écran (voir §7 point 4, ne pas
confondre avec le toggle "Éditer" qui reste hors périmètre pour le 2D). Réutilise exactement les
champs du formulaire de création (image, `grid_size`/`grid_enabled`/`grid_opacity`/
`grid_offset_x`/`grid_offset_y`) via le même `PUT /battlemaps/:id` déjà capable de recevoir les quatre
premiers (`battlemaps.js:711-747`, corrigé 2026-07-28) — les deux offsets s'y ajoutent au même endroit (même patron
`if (champ !== undefined) updates.champ = champ`).

Conséquence directe : le redimensionnement de la salle triviale (Lot 1 point 3) ne s'applique pas
qu'à la création. La fonction serveur qui calcule les bornes de la salle à partir des dimensions
d'image doit être un point unique appelé aussi bien par `POST /battlemaps` que par
`PUT /battlemaps/:id` quand une nouvelle image est fournie — pas dupliquée entre création et
modification (P4).

**Deux conséquences client de "Paramètres" absentes de la rédaction précédente, trouvées le
2026-07-28 :**
- **Mise à jour du store** : la modale doit appeler `setBattlemap(...)` (`useMapStore`) avec la réponse
  du `PUT`, même patron que `renameBattlemap` pour le renommage (`useBattlemapManager.js`). Sans ça,
  rien ne change à l'écran avant un rechargement complet de la page.
- **Recadrage caméra si la salle change de taille** : `MapCameraRig` (`Canvas2D.jsx`, Lot 2, livré) ne
  cadre la caméra **qu'une fois** au montage (`fitted.current`, jamais réinitialisé ensuite). Si
  "Paramètres" change l'image/la grille sans démonter `Canvas2D` (même `battlemap.id`, donc même
  `key`), la salle peut changer de taille sans que la caméra ne se recadre — vue obsolète (mal cadrée,
  zoom incohérent) jusqu'à un rechargement. À trancher en codant : soit réinitialiser `fitted.current`
  quand les bornes de la salle changent (comparer `bounds.widthCells`/`depthCells` reçus en prop),
  soit recadrer explicitement après une réponse "Paramètres" réussie — pas laissé au hasard.

**Flux de création MJ** : `handleMapCreate` (`useBattlemapManager.js:137-147`) n'envoie aujourd'hui
que `name` — aucune UI n'utilise l'upload d'image alors que le serveur le supporte déjà des deux
côtés (`multerUpload.single('image')` + `uploadToMinio('battlemaps')` sur `POST` **et**
`PUT /battlemaps`, `battlemaps.js:118-119` (POST) `,713-714` (PUT, corrigé 2026-07-28 — 686-687
pointait dans `GET /:id`, jamais vérifié contre le fichier réel). Même constat que `folder`/
`viewport_state` :
plomberie serveur déjà là, jamais branchée côté client. Lot 3 ajoute au formulaire existant (pas de
nouvelle route serveur) :

1. un choix `render_mode` (2D/3D) — 3D reste le comportement actuel par défaut, aucun changement sur
   ce chemin ;
2. un champ upload d'image, affiché seulement si `render_mode='2d'` ;
3. dimensions de l'image lues côté client (`Image().naturalWidth/naturalHeight`, API navigateur
   standard — **aucune dépendance serveur à ajouter**, pas de `sharp`/`jimp`, absents du projet
   aujourd'hui, vérifié) et envoyées avec le formulaire pour que le serveur dimensionne la salle
   triviale (Lot 1 point 3) à partir de `grid_size` (px/case) déjà existant.

**Manque relevé le 2026-07-28 — aucune formule écrite pour ce dimensionnement, à trancher en codant :**
`widthCells = Math.ceil(naturalWidth / grid_size)`, `depthCells = Math.ceil(naturalHeight /
grid_size)` (arrondi au supérieur — une case entamée compte entière, cohérent avec `roomEffectiveGridCells`
qui travaille en cases entières, `shared/world/roomGeometry.js`). Cas limite à décider au moment de
coder : image plus petite qu'une case (`naturalWidth < grid_size`) → `widthCells` minimum 1, jamais 0
(une salle 0×N ne compile pas, `surface_data.js` exige `minX`≠`maxX` implicitement via des bornes
finies mais une largeur nulle reste à tester explicitement avant de considérer ce point clos).

---

## 9. Lot 4 — arborescence du sélecteur (détail)

> Cadrage 2026-07-25. **Aucun code produit écrit.**

**Recherche externe** : Foundry VTT modélise ses dossiers de Scenes comme une entité `Folder` à part
entière, avec un pointeur `parent` vers un autre `Folder` — jamais un chemin encodé en texte dans la
Scene elle-même —
[Folder API](https://foundryvtt.com/api/classes/foundry.documents.Folder.html),
[Folders](https://foundryvtt.com/article/folders/). Confirme la liste d'adjacence plutôt qu'un
chemin texte type `"Act1/Donjon"` sur `battlemaps.folder`.

**Constat interne** : `battlemaps.folder` (`20260330_08_battlemaps_phase2.js:3`) est un `text` plat,
jamais pensé pour la profondeur, jamais lu côté client (vérifié précédemment). Aucun pattern
`parent_id` n'existe ailleurs dans le schéma — nouveau pattern justifié, rien à réutiliser.

**Décision — nouvelle table `battlemap_folders`** (liste d'adjacence, même conventions que
`battlemaps` — `uuid`, FK CASCADE, `table.timestamps(true, true)`, vérifiées
`20260329_04_battlemaps.js:3-4,10`) :

```
id                uuid primary, default knex.fn.uuid()
campaign_id       uuid not null, FK campaigns, CASCADE
parent_folder_id  uuid nullable, FK battlemap_folders(id), CASCADE — null = racine
name              text not null
timestamps
```

`battlemaps.folder_id` (uuid nullable, FK `battlemap_folders`) remplace `battlemaps.folder` (texte,
jamais utilisé — à retirer dans la même migration). Vérifier avant de la retirer qu'aucune ligne n'a
une valeur non nulle en base, par prudence (CLAUDE.md §11) — si une valeur existe malgré tout,
créer une ligne racine correspondante plutôt que la perdre silencieusement.

**Comportement à la suppression d'un dossier non vide — tranché avec Saar 2026-07-25** :
`battlemaps.folder_id` est **`CASCADE`**, comme `parent_folder_id` (suppression réellement destructive
— dossier, sous-dossiers et cartes contenues disparaissent). Sécurité déportée côté client, même
patron que l'existant : `handleMapDelete` (`useBattlemapManager.js:117-135`) utilise déjà
`window.confirm(t('session.deleteMapConfirm', ...))` avant de supprimer une carte. La suppression
d'un dossier réutilise ce patron avec un message adapté (« Ce dossier contient N carte(s) et M
sous-dossier(s) — tout supprimer ? »), le compte étant calculé côté client à partir de l'arborescence
déjà chargée dans le menu déroulant (pas de nouvel appel serveur nécessaire pour l'afficher).

**CRUD dossiers — réutilise le patron existant, pas un nouveau composant.** `useBattlemapManager.js`
a déjà un menu contextuel par carte (`mapContextMenu`, clic droit → renommer/dupliquer/supprimer,
`useBattlemapManager.js:20,80-135`). Lot 4 étend ce même patron aux dossiers (créer/renommer/
supprimer) et ajoute une entrée "Déplacer vers…" sur une carte pour choisir son dossier — pas de
glisser-déposer dans une popover exiguë, cohérent avec l'existant. Autorisation : MJ uniquement,
comme le reste de `battlemaps.js` (`requireRole('gm')`).

**Contrainte viewport** (`.claude/rules/react.md`) : le popover "Cartes ▾" doit rester intégralement
dans le viewport et se repositionner si nécessaire — même règle que les tooltips existants.

**i18n** (`.claude/rules/i18n.md`) : libellés du menu, dialogues créer/renommer dossier, "Déplacer
vers…" — clés `t('session.*')` ajoutées avant usage.

**Migration** : après réservation Lot 1 (207) et Lot 3 (211, grille), prochain numéro impair libre
pour ce lot : **213** — à reconfirmer contre `knex_migrations` au moment de coder, comme Lot 1
(209 déjà pris entre-temps par un autre chantier sans rapport, correctif munitions).

**Icône 2D/3D** : dérivée de `battlemaps.render_mode` (Lot 1) — aucun nouveau champ, juste un choix
d'icône côté client selon la valeur.

**Tri** : proposition — alphabétique par nom dans chaque dossier pour la V1, pas de
réordonnancement manuel (pas de `sort_order`) — évite d'étendre le périmètre. Ajustable si besoin
d'un ordre manuel confirmé plus tard.

**Forme d'UI — révisé avec Saar 2026-07-28, remplace la décision du 2026-07-25.** L'option "popover
déroulant" est abandonnée : Saar a partagé une référence Roll20 (deux panneaux — liste de dossiers à
gauche, grille de vignettes des cartes/dossiers du dossier courant à droite, barre de recherche,
bouton "Créer une carte"). Investissement UI nettement plus gros qu'un popover, assumé. La `gmBar`
(`SessionPage.jsx:528-559`) garde un déclencheur compact (bouton/icône "Cartes") ; le clic ouvre ce
nouveau panneau en modale plein cadre (pas un mode plein écran équivalent à `Editor3D` — juste une
modale par-dessus la session, fermeture au clic "Fermer"/Échap, la session reste chargée derrière).

**Vignettes — tranché avec Saar 2026-07-28** : texte seul pour la V1 (nom de la carte, pas d'image) —
sauf pour une carte 2D qui a déjà une image (`image_url`, Lot 1) : celle-ci sert de vignette sans coût
supplémentaire (déjà en base, déjà servie via `/api/assets/`). Une carte 3D n'a pas d'équivalent
aujourd'hui (pas de capture d'écran automatique) — **explicitement hors périmètre de ce lot** : un
mécanisme de capture à la fermeture d'une carte 3D est noté comme piste "v2", pas construit ici. Les
dossiers gardent leur icône générique (comme la capture Roll20 de référence).

**`sessionHeader` retiré entièrement — décision Saar 2026-07-25** : le bloc `SessionPage.jsx:511-526`
(bouton Accueil + nom de campagne) est supprimé, pas seulement redimensionné. Sortie déjà couverte
ailleurs, vérifié : onglet "Profil" de la sidebar (`Sidebar.jsx:2402-2403,2475`,
`navigate('/dashboard')`). Le nom de campagne reste visible via le titre d'onglet navigateur
(`SessionPage.jsx:67`, `document.title`), mécanisme indépendant, non affecté. Le menu "Cartes ▾"
étant réservé au MJ (zone `gmBar`, `isGm`), inutile d'y dupliquer un bouton de sortie.

---

## 10. Lots proposés (séquentiels — un seul actif à la fois)

| Lot | Contenu | Dépend de | Notes |
|---|---|---|---|
| 0 | Cadrage — clos (vérification technique §4.1 faite) | — | décisions §4 |
| 1 | **✅ clos** — discriminant `battlemaps.render_mode` (migration 207) + génération de la salle triviale à `POST /battlemaps` | Lot 0 | `image_url` corrigé au passage : chemin MinIO relatif (`req.file.objectName`) au lieu de l'URL complète (`MINIO_ENDPOINT` souvent `localhost`, injoignable depuis un navigateur distant) — même convention que `default_token_glb_url` |
| 2 | **✅ clos** — `Canvas2D.jsx` : plan texturé + caméra orthographique + grille + pan/zoom (`viewport_state`) + intégration `SessionPage.jsx`/`Sidebar.jsx` | Lot 1 | Architecture caméra revue après analyse à charge (recherche `coldi/r3f-game-demo` + code source `MapControls`/`OrbitControls`) : caméra le long de Z sans rotation (évite la singularité d'`OrbitControls` autour de `camera.up`), `screenSpacePanning=true` (le mode par défaut de `MapControls`, pensé pour une caméra élevée au-dessus d'un sol XZ, est dégénéré pour cette orientation). Pas de tokens ni de création carte à ce stade (Lot 3) |
| 3 | **✅ clos** — tokens (badges/labels extraits vers `TokenPresentation.jsx`, mouvement via `teleport`/`world-move`, garde de propriété, menu radial), grille réglable (`grid_offset_x`/`grid_offset_y`, migration 211, désactivée par défaut en 2D), flux de création MJ (choix 2D/3D, upload, dimensions), modale "Paramètres", bouton Combat gardé en 2D | Lot 2 | pas de hook `useTokenMovement` partagé — décision inversée le 2026-07-28, voir §8. Altitude de la salle triviale (`TRIVIAL_ROOM_FLOOR_Y = 0.125`) vérifiée par compilation réelle 2026-07-29. Deux correctifs trouvés en validant : offset label/badges token (calibré 3D, disproportionné en 2D) et `render_mode` absent du `SELECT` de la liste des cartes (bouton "Paramètres" invisible). Résidu non bloquant différé : grille non affichée malgré `grid_enabled=true` vérifié — voir `docs/BUGIDENTIFIE.md` **GRID2D1** |
| 4 | **✅ clos** — sélecteur de cartes façon Roll20 (`BattlemapSelectorPanel.jsx`, arbre de dossiers + grille de vignettes), arborescence `battlemap_folders` (migration 213), icône 2D/3D dérivée de `render_mode`, `sessionHeader` retiré, barre GM réduite à un déclencheur compact, "Déplacer vers…" ajouté au menu contextuel | Lot 3 | UI revue le 2026-07-28 (référence Roll20 partagée par Saar), remplace le popover initialement prévu. Suppression de dossier testée en base (BFS + CASCADE + nettoyage tokens confirmés par script direct). Deux correctifs trouvés en validant : `campaigns.js:183-187` sélectionnait encore l'ancienne colonne `battlemaps.folder` dans une sous-requête embarquée jamais consommée côté client (code mort depuis la fusion Kiwi, retiré entièrement plutôt que renommé — une seule source de vérité pour la liste des cartes, la route dédiée `/campaigns/:id/battlemaps`) ; spacer `flex:1` manquant après le retrait de l'ancienne barre de cartes en ligne (bouton Combat désaligné) |
| 5 | **Non commencé** — créateur de token 2D (recadrage circulaire/hexagonal/carré + bordure depuis le portrait de personnage, styles fournis par l'app) | Lot 4 | Dans le périmètre v1 (décision Saar 2026-07-29, remplace le renvoi du 2026-07-28 vers "hors de ce plan") — touche la fiche personnage, séquencé en dernier par charge de travail, pas par nécessité technique |

**Reste hors de ce plan, à traiter dans un nouveau document, pas avant** — élargi et reprécisé le
2026-07-28, **rien n'est tranché ici, à débattre entièrement le moment venu** (mots de Saar : « je ne
suis pas au clair avec moi-même ») :
- **Coffre hybride** — Saar précise que "Mon Coffre" (`VaultPage.jsx`, aujourd'hui : personnages/
  drones/vaisseaux/armures archivés) est censé devenir un espace personnel unifiant aussi **tous les
  fichiers du compte** (battlemaps, textures, illustrations de personnage) et, à terme, des skins
  (dés, personnages 3D). Explicitement voulu comme une fonctionnalité "basique" à s'inspirer d'un
  dépôt GitHub existant plutôt que codée de zéro — mais aucune décision de fond prise (modèle de
  données, quota, relation avec `campaign_documents` qui gère déjà des fichiers texte avec permissions
  mais pas de binaires/quota). **Ne rien présumer avant cette discussion.**

> Le créateur de token 2D, listé ici jusqu'au 2026-07-28, est réintégré dans le périmètre de ce plan
> (Lot 5 ci-dessus) le 2026-07-29 — seul le Coffre hybride reste réellement hors de ce plan.

---

## 11. Hors scope de ce plan (récap)

- Spotlight / bibliothèque de présentation (§2, §4.2) — plan séparé.
- Fog of war / illumination dynamique — non construit, seulement rendu possible par l'architecture
  choisie (§4.3).
- Toute modification de la battlemap 3D existante.
