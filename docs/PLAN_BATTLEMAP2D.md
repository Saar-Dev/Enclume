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
- une **battlemap 2D à tokens** (fond d'image + grille + placement de tokens), pour des scènes qui
  ne justifient pas la construction d'une battlemap 3D complète (temps de conception) mais où le
  groupe agit et se déplace quand même un minimum.

Distinction actée avec Saar (session 2026-07-25) : une **carte** montre un lieu où le groupe se
trouve. C'est différent d'un **Spotlight** (bibliothèque de présentation ponctuelle — personnage,
document, indice — qui se superpose sans changer de lieu) : voir §2, besoin distinct, hors périmètre
de ce plan.

---

## 2. Hors périmètre explicite

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
- une **caméra orthographique** fixe, plongeante — pas perspective, pour un rendu plat stable quel
  que soit le zoom (contrairement à la 3D) ;
- tokens en billboards/sprites (toujours face caméra) ;
- grille en overlay au-dessus du plan, réutilisant `grid_size`/`scale_label` existants ;
- coordonnées serveur inchangées (`world-feet`) — seule la caméra/le rendu changent de mode.

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
   en base, déjà accepté par `PUT /battlemaps/:id` — `battlemaps.js:697,706` — mais **jamais lu ni
   écrit côté client aujourd'hui**, colonne morte comme `folder` avant Lot 4). Pas de nouvelle
   colonne.
4. **Intégration `SessionPage.jsx`** : nouvelle branche de rendu conditionnée par
   `battlemap.render_mode === '2d'`, remplaçant le choix actuel `mode === 'edit' ? Editor3D :
   Canvas3D` (`SessionPage.jsx:570-571`). **Décision découlant directement de Lot 1 point 2** (le MJ
   ne voit jamais l'éditeur de salle/voxel pour une carte 2D) : le toggle "Éditer" (mode plein écran
   `Editor3D`, `handleCombatToggle`/bouton mode, zone `gmBar`) n'a pas de sens pour une carte 2D et
   reste masqué/inactif quand `render_mode='2d'`. **Ne pas confondre avec la modification
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
> **Aucun code produit écrit.**

**Correction du spike Lot 2** : le drag continu utilisé pour vérifier le rendu ne doit **pas** être
repris tel quel pour les tokens de personnage. `Canvas3D.jsx` utilise un patron clic→sélection→
prévisualisation de chemin→confirmation (`selectedTokenId`, `combatMoveMode`,
`POST /battlemaps/:id/world-path-preview` puis `world-move`, `Canvas3D.jsx:693,947`) : le budget de
mouvement est calculé et autorisé côté serveur (CLAUDE.md §7, « le serveur reste autoritaire »). Un
drag libre contournerait ce budget. Canvas2D doit réutiliser ce même patron pour les tokens de
personnage, pas le drag du spike qui ne validait que le rendu, jamais l'interaction de jeu réelle.
Exception déjà existante et à conserver telle quelle : les jetons sans `character_id` (marqueurs MJ
libres) utilisent déjà une voie `gm-preview` sans budget strict (`battlemaps.js:319-326`).

**Sélection et menu radial** : `RadialMenu.jsx` est un composant DOM pur, sans dépendance Three.js
(vérifié) — réutilisable tel quel.

**Badges de statut** : `Canvas3D.jsx` les affiche via `@react-three/drei` (`Billboard` + `Html`,
`Canvas3D.jsx:334-359`) — primitives disponibles nativement dans Canvas2D puisque c'est aussi un
contexte react-three-fiber (Lot 2). **Extraction obligatoire, pas optionnelle** (corrigé — laissé
"à confirmer" précédemment risquait une dérive sous pression du "ça marche" vers une duplication qui
viole P4) : `TokenLabel` et le bloc badges sortent de `Canvas3D.jsx` vers un module partagé consommé
par les deux renderers, avant que Lot 3 soit considéré clos.

**Extraction obligatoire (mouvement)** : même raison. La logique de prévisualisation/confirmation
(`world-path-preview`/`world-move`, état `combatMoveMode`/`pendingMoveSelection`) sort de
`Canvas3D.jsx` vers un hook partagé (nom de travail `useTokenMovement.js`) consommé par les deux
renderers — condition de clôture du lot, pas une amélioration facultative.

**Friction identifiée et résolue — budget des jetons libres MJ sur carte 2D** : la voie `gm-preview`
existante (`battlemaps.js:319-326`) exige un `budget_m` numérique saisi par le MJ, pensé pour le
combat tactique 3D. Sur une salle ouverte sans combat, obliger une saisie manuelle à chaque
repositionnement serait pénible. Résolu sans toucher au serveur : pour un jeton libre sur une carte
2D, le client calcule automatiquement un budget généreux (diagonale de la salle triviale, connue
dès Lot 1 point 3) au lieu de demander une saisie — le MJ place le jeton librement, la route
existante reste inchangée.

**i18n** (`.claude/rules/i18n.md`) : formulaire de création, choix `render_mode`, tout texte visible
passe par `t('session.*')`/`t('common.*')` — clés ajoutées avant usage, comme pour Lot 2.

**Modification après création — tranché avec Saar 2026-07-25** : une carte 2D reste modifiable
(réuploader l'image, changer la grille), pas de "supprimer et recréer". Nouvelle action "Paramètres"
dans le menu contextuel existant (`mapContextMenu`, même patron que renommer/dupliquer/supprimer,
`useBattlemapManager.js:20,80-135`) — une modale, pas un mode plein écran (voir §7 point 4, ne pas
confondre avec le toggle "Éditer" qui reste hors périmètre pour le 2D). Réutilise exactement les
champs du formulaire de création (image, `grid_size`/`grid_enabled`/`grid_opacity`) via le même
`PUT /battlemaps/:id` déjà capable de les recevoir (`battlemaps.js:684-719`).

Conséquence directe : le redimensionnement de la salle triviale (Lot 1 point 3) ne s'applique pas
qu'à la création. La fonction serveur qui calcule les bornes de la salle à partir des dimensions
d'image doit être un point unique appelé aussi bien par `POST /battlemaps` que par
`PUT /battlemaps/:id` quand une nouvelle image est fournie — pas dupliquée entre création et
modification (P4).

**Flux de création MJ** : `handleMapCreate` (`useBattlemapManager.js:137-147`) n'envoie aujourd'hui
que `name` — aucune UI n'utilise l'upload d'image alors que le serveur le supporte déjà des deux
côtés (`multerUpload.single('image')` + `uploadToMinio('battlemaps')` sur `POST` **et**
`PUT /battlemaps`, `battlemaps.js:118-119,686-687`). Même constat que `folder`/`viewport_state` :
plomberie serveur déjà là, jamais branchée côté client. Lot 3 ajoute au formulaire existant (pas de
nouvelle route serveur) :

1. un choix `render_mode` (2D/3D) — 3D reste le comportement actuel par défaut, aucun changement sur
   ce chemin ;
2. un champ upload d'image, affiché seulement si `render_mode='2d'` ;
3. dimensions de l'image lues côté client (`Image().naturalWidth/naturalHeight`, API navigateur
   standard — **aucune dépendance serveur à ajouter**, pas de `sharp`/`jimp`, absents du projet
   aujourd'hui, vérifié) et envoyées avec le formulaire pour que le serveur dimensionne la salle
   triviale (Lot 1 point 3) à partir de `grid_size` (px/case) déjà existant.

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

**Migration** : après réservation Lot 1 (207), prochain numéro impair libre pour ce lot : **209** —
à reconfirmer contre `knex_migrations` au moment de coder, comme Lot 1.

**Icône 2D/3D** : dérivée de `battlemaps.render_mode` (Lot 1) — aucun nouveau champ, juste un choix
d'icône côté client selon la valeur.

**Tri** : proposition — alphabétique par nom dans chaque dossier pour la V1, pas de
réordonnancement manuel (pas de `sort_order`) — évite d'étendre le périmètre. Ajustable si besoin
d'un ordre manuel confirmé plus tard.

**Forme d'UI — tranché avec Saar 2026-07-25** : option A, menu déroulant "Cartes ▾" depuis la
`gmBar` actuelle, arborescence affichée en popover. La barre `gmBar` (`SessionPage.jsx:528-559`,
liste plate de boutons) est remplacée par ce menu ; le reste de la `gmBar` (bouton mode combat)
n'est pas affecté.

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
| 3 | Intégration tokens (billboards, drag & drop, sélection) + flux de création MJ (choix 2D/3D, upload) | Lot 2 | réutilise budget/mouvement/statuts existants |
| 4 | Rework sélecteur de cartes : arborescence dossiers + icône 2D/3D | Lot 3 | consomme `battlemaps.folder` déjà existant |

**Reste hors de ce plan, à traiter dans un nouveau document après le Lot 4** (élargissement identifié en testant le Lot 2, 2026-07-28) : gestionnaire de stockage/upload MinIO pour le MJ, grille à résolution réglable selon l'image de fond, tokens 2D (détection 2D/3D + fiche personnage), créateur de token 2D (recadrage circulaire + bordure).

---

## 11. Hors scope de ce plan (récap)

- Spotlight / bibliothèque de présentation (§2, §4.2) — plan séparé.
- Fog of war / illumination dynamique — non construit, seulement rendu possible par l'architecture
  choisie (§4.3).
- Toute modification de la battlemap 3D existante.
