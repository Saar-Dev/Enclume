# PLAN_ENVIRONNEMENT_MILIEUX.md — Détection du milieu (sous-marin/surface/atmosphérique/spatial) par le moteur monde

> Statut : planification pure, aucun code écrit. Origine : PLAN_EXOARMURE.md §16.2.5 — le correctif
> codé le 2026-08-23 pour la spécialité Manœuvre d'armure d'une exo-armure hybride (choix manuel
> `exo_sheet.active_maneuver_environment`) est un pis-aller explicitement temporaire. Saar (2026-08-23,
> "TU VAS TROP VITE") a arrêté le codage pour repartir sur la vraie architecture : *"l'environnement
> doit être généré par le world builder. Chaque pièce construite a son propre environnement
> (atmosphérique, sous-marine, espace ou surface). Et si le token est en dehors des pièces, c'est la
> propriété de la carte qui prend la relève."*
>
> Document séparé de `PLAN_EXOARMURE.md` (`docs/RegleDocumentaire.md` Règle 13 : "un document est
> découpé uniquement lorsqu'il porte plusieurs responsabilités distinctes") — c'est une capacité du
> moteur monde, pas une mécanique propre à l'exo-armure ; d'autres consommateurs futurs pourraient en
> avoir besoin (drones sous-marins, dangers environnementaux humains en vide spatial, etc.), même si
> le déclencheur immédiat est exo-armure.

---

## 1. Ce qui existe déjà — vérifié avant de proposer quoi que ce soit

- **Aucun concept "environnement" n'existe aujourd'hui sur une pièce** (`room`, `surface_data` v12) ni
  sur une battlemap. Vérifié : `docs/SYSTEME/MOTEUR_MONDE.md` ne mentionne que `walkable`/
  `blocksMovement`/`blocksSight` comme drapeaux de salle, et une "étanchéité" calculée côté client pour
  le rendu de l'eau (pas une autorité serveur).
- **Un système de régions/effets existe déjà** (`docs/SYSTEME/MOTEUR_MONDE.md` §9, Phase 5,
  `shared/world/worldEffects.js` vérifié en lecture) : `BUILTIN_WORLD_EFFECTS` (feu, inondation, gaz,
  huile/glissant, terrain instable) + définitions personnalisées de campagne, appliquées comme
  instances liées à un volume/feature/compartiment/entité/token, avec hooks `déplacement`/`visibilité`/
  `dégâts`/`tests`/`restrictions`. Le combat consomme déjà ce registre pour les coûts, la visibilité et
  les tests de terrain instable (§9, ligne 720). Le document lui-même anticipe ce chantier : *"La
  traduction détaillée des hooks `test` [...] en règles Polaris reste une frontière métier future ;
  elle réutilisera la détection spatiale existante sans la réimplémenter"* (ligne 721-723) — cette
  phrase date d'avant cette session, donc pas écrite pour ce chantier précisément, mais directement
  applicable. Envisagé comme Option B (§3), non retenu.
- **`WorldQueryService`** (nommé ainsi dans `docs/SYSTEME/MOTEUR_MONDE.md` §11, "Contrat avec le
  combat") est en réalité `server/src/services/worldSpatialQueryService.js` — vérifié : aujourd'hui il
  n'expose que des fonctions de mesure de distance (`measureBattlemapTokenDistance` etc.), aucune
  fonction "quelle région/pièce contient ce point" n'y est encore exposée proprement (la détection
  point-dans-salle existe en interne pour la navigation/LOS, `shared/world/spatialIndex.js`/
  `navigation.js`, mais pas comme utilitaire réutilisable côté service).
- **Distinction "room" vs "compartiment"** : une `room` est l'unité géométrique authored par le MJ dans
  l'éditeur Surface ; un "compartiment" (`shared/world/worldCompiler.js`, §10 MOTEUR_MONDE.md) est une
  unité DÉRIVÉE par le compilateur (regroupement de pièces reliées par des passages, pour la
  propagation eau/gaz) — pas la même chose (voir §5.2).
- **Compilation réelle des salles** — vérifié dans `shared/world/worldCompiler.js:123-179`
  (`roomFloorEntries`/`roomCeilingEntries`) : le compilateur ne garde pas un objet "salle compilée"
  unique avec un contour — il décompose chaque `room` en entrées de sol/plafond par cellule de grille,
  chacune portant déjà `sourceRoomWorldId` (comme `blocksMovement`/`blocksSight`/`blocksWater`
  aujourd'hui). C'est le mécanisme naturel à réutiliser (détaillé §4).

## 2. Portée confirmée par Saar (2026-08-23)

- Une pièce construite porte son propre environnement (un de : sous-marine / surface / atmosphérique /
  spatiale).
- Si un token est hors de toute pièce, l'environnement de la **carte** (battlemap) prend le relais —
  donc une battlemap a besoin elle aussi d'un environnement par défaut.
- **Explicitement hors périmètre** (Saar) : le déplacement en 0G ou en vol libre ("mode avion") n'est
  pas traité pour l'instant — ce chantier concerne uniquement la résolution de la spécialité Manœuvre
  d'armure (`resolveManeuverSkillId`), pas les mécaniques de mouvement atmosphérique/spatial
  (`getExoMovementBudget` reste inchangé, toujours limité à `surface_movement_mode`/
  `underwater_movement_mode`).

## 3. Architecture retenue — Option A : champ statique sur `room`

Deux options envisagées, comparées avant de trancher (CLAUDE.md §7 — chercher l'existant avant
d'inventer). **Option A retenue par Saar (2026-08-23).**

**Option A (retenue)** — l'environnement devient une propriété intrinsèque de la pièce, au même niveau
que `walkable`/`blocksMovement`/`blocksSight` — posée une fois par le MJ en construisant la pièce dans
l'éditeur Surface, jamais un calque séparé à repeindre à la main. Correspond littéralement à "chaque
pièce construite a son propre environnement" — propriété intrinsèque, jamais désynchronisée de la
géométrie de la pièce. Coût : évolution de schéma `surface_data` + UI éditeur + compilateur + nouvelle
colonne `battlemaps` + nouvelle fonction de requête (détail complet §4).

**Option B (non retenue)** — réutiliser le registre d'effets/régions déjà existant
(`shared/world/worldEffects.js`, §1 ci-dessus) : l'environnement devient une nouvelle famille de
définitions (`BUILTIN_DEFINITIONS`) que le MJ applique comme région peinte sur la carte, même mécanisme
que feu/inondation/gaz. Presque aucune nouvelle infrastructure, mais l'environnement ne serait plus
intrinsèque à la pièce — une zone peinte à la main à retracer si la géométrie de la pièce change.
Écartée car elle ne correspond pas à la formulation de Saar (propriété de la pièce elle-même, pas un
calque séparé).

**Invariants qui ne dépendent pas de l'option** :
- Le combat ne lit jamais `surface_data`/le snapshot directement (`.claude/rules/world.md`,
  `.claude/rules/core.md`) — toujours via le service dédié.
- Timing : l'environnement doit être résolu depuis la position **réellement atteinte** du token, en
  Phase RÉSOLUTION, jamais depuis une position d'Annonce non encore validée — même principe que
  distance/portée/LOS (`.claude/rules/combat.md` : "recalculer [...] depuis la position réellement
  atteinte").

## 4. Plan d'implémentation détaillé (Option A) — recherche faite, rien codé

"Quel environnement à telle position" se résout en 3 niveaux (§5.5) via la cellule de sol sous le
point → `sourceRoomWorldId` → `room.environment`, en réutilisant le mécanisme déjà en place pour
`blocksMovement`/`blocksSight`/`blocksWater` (§1) :

1. Pièce trouvée, `environment` posé → cette valeur.
2. Pièce trouvée, `environment` absent → `surface` (repli fixe pièce, §5.5).
3. Aucune pièce à cette position → `default_environment` de la battlemap (`submarine` par défaut, §5.4).

Ordre proposé, chaque étape restant vérifiable séparément (CLAUDE.md §6.5) :

1. **Schéma `surface_data`** — `shared/world/surfaceDocument.js` : ajouter `room.environment` (nullable,
   4 valeurs `submarine`/`surface`/`atmospheric`/`spatial`). Vérifier d'abord si le validateur rejette
   les clés inconnues sur `room` (pas confirmé en lecture rapide — `SURFACE_DATA_VERSION = 12`, une seule
   constante, mais aucune fonction `validateRoom` unique trouvée, seulement `validateRoomVerticalProfile`)
   — trancherait si un bump vers v13 est réellement nécessaire ou si un champ optionnel supplémentaire
   passe déjà sans lui.
2. **Compilateur** — `shared/world/worldCompiler.js` : propager `room.environment` sur les entrées de sol
   (`roomFloorEntries`, ligne ~132-145) au même titre que `blocksMovement`. Pas nécessaire sur les
   entrées de plafond (`roomCeilingEntries`) — l'environnement d'un point se lit depuis le sol sous les
   pieds, jamais depuis le plafond au-dessus.
3. **Battlemap** — nouvelle migration : `battlemaps.default_environment` (`text NOT NULL DEFAULT
   'submarine'` + CHECK restreint aux 4 valeurs `submarine`/`surface`/`atmospheric`/`spatial` — même
   discipline que `exo_sheet.environment`/`active_maneuver_environment`, §5.4).
4. **Requête** — nouvelle fonction générique dans `server/src/services/worldSpatialQueryService.js` (le
   vrai nom derrière "WorldQueryService", §1) : implémente la résolution à 3 niveaux ci-dessus (+ le cas
   escaliers/ascenseurs, point 5.6 ci-dessous). Signature exacte à définir à l'implémentation
   (probablement `getEnvironmentAtPosition(snapshot, position, battlemap)`) — **générique**, pas
   spécifique à l'exo, réutilisable par tout futur consommateur (drones, dangers environnementaux
   humains, §6) qui aurait besoin de savoir "quel milieu à cette position", même si l'exo-armure reste
   le seul consommateur câblé par ce chantier.
5. **Éditeur Surface** — panneau propriétés de salle (composant exact à identifier, pas encore recherché
   — `SurfaceConnectorPanel.jsx` existe pour les connecteurs, l'équivalent salle reste à localiser) :
   sélecteur des 4 valeurs par pièce **+ sélection multiple pour édition en lot** (§5.2 — poser le même
   environnement sur plusieurs pièces en une action, mécanisme de sélection multiple à identifier dans
   l'éditeur existant), + un réglage carte (paramètres de battlemap) pour `default_environment`.
6. **Consommation combat — plafond Manœuvre d'armure, UNIQUEMENT pour une armure hybride (relecture
   2026-08-25)** : pour une armure non-hybride (`environment` fixe), la spécialité RAW est déterministe
   (`REGLEARMURE.md:202-207` — "la spécialité appropriée" est une caractéristique fixe de l'armure,
   aucune ambiguïté) : **aucun besoin d'interroger le moteur monde**, `resolveManeuverSkillId` reste
   inchangée pour ces 5 environnements sur 6. La chaîne `active_maneuver_environment → détection
   monde → repli` (§5.3) ne s'applique **que** quand `exoSheet.environment === 'hybrid'` — ne pas
   interroger le monde pour le reste, ni par principe (coût), ni par RAW (aucune règle ne le demande).
   `resolveManeuverSkillId` prend aujourd'hui `(exoSheet)` seul (pas de notion de position) — la branche
   hybride seule a besoin d'une position de token en plus.
   **Changement de signature réel, plus large qu'un simple ajout de paramètre à 3 fonctions** : la
   position ne peut être ajoutée à `resolveManeuverSkillId` sans remonter jusqu'à
   `resolveCombatantTestContext(db, character, skillId)` (`combatantContextService.js`), le
   **dispatcher partagé** — or ce dispatcher est appelé par **6 sites** dans `socketCombatHelpers.js`
   (612/1428/1593/1728/1941/2921, cf. `PLAN_EXOARMURE.md` §16.2.1), pas seulement les 3 déjà identifiés
   pour l'exo ; la plupart servent des personnages **humanoïdes**, où la position ne sert jamais à rien.
   Au moins 2 de ces sites (~612/1941, contexte Acrobatie/Équilibre défenseur) construisent aujourd'hui
   un objet minimal `{id: characterIdCible, campaign_id}` sans référence explicite à un token — **à
   vérifier à l'implémentation** si le token du défenseur y est déjà accessible ou s'il faut un fetch
   supplémentaire pour obtenir sa position. Signature exacte à définir alors (probablement un paramètre
   optionnel `{ tokenPosition }`, `undefined` pour tout appelant humanoïde — jamais requis pour eux).
   Appelants réellement concernés par la nouvelle position (armure hybride uniquement) : `socketCombatState.js:86`
   (Initiative, Lot 3), `socketCombatHelpers.js:2289` ("Se relever", Lot 2bis) et
   `combatantContextService.js:213` (Seuil de Test) — position **réellement résolue** du token (Phase
   RÉSOLUTION, jamais l'Annonce), sauf pour l'Initiative qui se calcule avant tout mouvement du Tour —
   position de départ du combat dans ce cas précis, à confirmer que ça reste correct.
7. **EAU1 (inclus, Saar 2026-08-24 — "l'idée c'est de tout recouper") — universel, tout type d'armure** :
   contrairement au point 6, ce calcul concerne **toute** exo, hybride ou non — `socketCombatState.js:104-110`
   calcule le malus d'Initiative "hors-milieu" en supposant aujourd'hui qu'une armure `submarine` est
   **toujours** hors de son milieu (`× 2` systématique), faute de signal de position réelle — limite déjà
   documentée dans le code (EAU1). Avec la fonction du point 4 disponible, ce calcul compare
   l'environnement réel détecté à la position du token à l'environnement nominal de l'armure
   (`exoSheet.environment`, y compris non-hybride) pour décider si le malus doit réellement être
   doublé, au lieu de le supposer. Même appelant que le point 6 (`socketCombatState.js`), même besoin
   de position — mais s'applique indépendamment du caractère hybride ou non de l'armure.

**Non résolu, à vérifier précisément à l'implémentation** : nécessité d'un bump `SURFACE_DATA_VERSION`
(point 1) — pas tranché ici, juste signalé pour ne pas le découvrir en cours de code.

## 5. Décisions — reprises une par une (2026-08-23)

### 5.1 Option A ou B — TRANCHÉ : Option A (§3).

### 5.2 Sur quelle structure vivre la donnée — TRANCHÉ (Saar, 2026-08-24) : le compartiment (aujourd'hui = `room`), tag statique en v1

**Vérifié avant de trancher** : dans le code réel du compilateur (`shared/world/worldCompiler.js:1152-
1169`, `addCompartments`), un compartiment est aujourd'hui créé **un par pièce**, systématiquement
(`id: \`compartment:${room.worldId}\``, `kind: 'room'`) — jamais un regroupement de plusieurs pièces
tant qu'aucune fusion n'est codée. Le §10 MOTEUR_MONDE.md parle d'un "graphe de compartiments reliés par
des canaux de perméabilité" : les pièces restent des nœuds séparés reliés par des arêtes (portes/
ouvertures), pas fusionnées en un objet commun — pour l'instant.

**Décision (Saar)** : c'est bien le **compartiment**, pas la pièce en tant que telle, qui est
l'autorité conceptuelle — l'intérêt du compartiment sur la pièce est précisément l'aspect groupe (« si
une fuite a lieu dans un compartiment, cela affecte toutes les rooms liées »). Deux volets :

- **v1 (ce plan) : tag statique**, posé par le MJ à la construction — pas de propagation dynamique liée
  aux brèches/portes ouvertes (« en v1, un état statique suffira », Saar 2026-08-24). Stockage encore
  porté par `room.environment` (puisque compartiment = pièce 1-pour-1 aujourd'hui), + outil d'édition en
  lot dans l'éditeur Surface (sélection multiple → poser l'environnement sur plusieurs pièces en une
  action) pour éviter de cibler chaque pièce individuellement.
- **v2 (hors périmètre explicite, §8)** : propagation dynamique — si des pièces reliées par un passage
  non scellé fusionnent en un compartiment de propagation partagé (eau/gaz, §10 MOTEUR_MONDE.md), une
  brèche pourrait faire basculer l'environnement de tout le compartiment affecté, réutilisant le même
  graphe de perméabilité déjà construit en Phase 5 (`buildCompartmentPropagationGraph`/
  `propagateEffectThroughCompartments`, `shared/world/worldEffects.js`). Nécessite d'abord que la fusion
  de compartiments elle-même existe (pas le cas aujourd'hui) — chantier à part, pas dans ce plan.

Reste à localiser dans l'éditeur Surface au moment de l'implémentation (mécanisme de sélection multiple
de pièces à identifier — pas encore recherché).

### 5.3 Sort de `active_maneuver_environment` (pis-aller déjà codé) — TRANCHÉ (Saar) : conservé

**Décision (Saar, 2026-08-24)** : un réglage manuel pour le MJ serait idéal — **conservé**, pas retiré.
Contrairement à la proposition initiale (retrait complet, une seule autorité), `active_maneuver_environment`
reste une dérogation explicite que le MJ peut poser pour trancher autrement que ce que dit la géométrie
détectée (cas narratif, situation particulière). **Précision (relecture 2026-08-25)** : cette chaîne de
priorité ne concerne que `exoSheet.environment === 'hybrid'` (§4 point 6) — pour les 5 autres valeurs,
la spécialité reste directement déterministe, jamais de détection monde ni de dérogation à consulter.
Priorité de résolution à l'implémentation, hybride uniquement (ordre proposé, à confirmer si besoin) :
`active_maneuver_environment` du pilote si posé → sinon détection automatique par la position (§4) →
sinon repli pièce/carte (§5.4-5.5).

### 5.4 Valeur par défaut de la carte — TRANCHÉ (Saar, 2026-08-24) : `submarine`

**Décision (Saar)** : `battlemaps.default_environment` par défaut **`submarine`**, pas `surface` comme
proposé initialement — cohérent avec le cadre Polaris (l'extérieur d'une carte est l'océan par défaut,
pas la terre ferme). Colonne `NOT NULL DEFAULT 'submarine'`.

### 5.5 Valeur par défaut d'une pièce sans tag explicite — TRANCHÉ (Saar, 2026-08-24) : `surface`

**Décision (Saar)** : une pièce construite mais non taguée explicitement suppose `surface` (espace
construit présumé pressurisé/normal, sauf indication contraire) — **différent** du défaut de la carte
(§5.4). Deux niveaux de repli distincts, pas un seul :

1. Pièce avec `environment` explicitement posé → cette valeur.
2. Pièce sans `environment` posé (mais une pièce existe à cette position) → `surface` (repli fixe, pas
   le défaut de la carte).
3. Aucune pièce à cette position (hors de toute pièce construite) → `default_environment` de la
   battlemap (§5.4, `submarine` par défaut).

Aucune migration de données nécessaire au-delà des colonnes elles-mêmes (nullable sur `room`, pas de
backfill obligatoire) — la résolution à 3 niveaux ci-dessus gère tous les cas dès le déploiement.

### 5.6 Escaliers, passerelles, cabines d'ascenseur — pas de pièce, ouvert (relecture 2026-08-24)

**Décision (Saar, 2026-08-24)** — tranchée en deux temps, aucun cas spécial à coder :

- **Cabine d'ascenseur** — vérifié : c'est déjà un compartiment autonome dans le compilateur
  (`kind: 'elevator-cabin'`, `worldCompiler.js:1141-1148`). Décision : **compartiment autonome, défaut
  fixe `surface`**, jamais un héritage de l'étage traversé pendant le trajet — comportement propre à ce
  compartiment, indépendant de la résolution générale §4.
- **Escalier/passerelle** — vérifié : `surface.stairs` n'a **aucun** compartiment propre dans
  `addCompartments` (seules les `rooms` et les cabines d'ascenseur en génèrent un). Décision : rien à
  coder de spécial — un token sur un escalier retombe simplement sur la résolution normale par position
  (§4), qui varie naturellement le long de l'escalier s'il traverse deux compartiments d'environnements
  différents (cohérent physiquement : on change bien de milieu en montant d'un pont submergé vers un
  pont surface).

## 6. Stratégie de test — absente du plan jusqu'ici (relecture 2026-08-24)

Aucune mention de validation dans les versions précédentes de ce document — gap complet, à combler
avant tout code, cohérent avec la discipline `.claude/rules/world.md`/`.claude/rules/combat.md` :

- **Schéma/validateur** — `room.environment`/`battlemaps.default_environment` acceptent les 4 valeurs,
  rejettent le reste ; round-trip normalisation/validation v12 (ou v13 si bump nécessaire, §4 point 1).
- **Compilateur** — `room.environment` atteint bien les entrées de sol compilées (`roomFloorEntries`),
  y compris pour des pièces multi-niveaux (`verticalProfile.slices`) et des pièces empilées à des
  hauteurs différentes (vérifié §1 : la clé de cellule inclut déjà `y`, donc déjà correctement isolées
  — un test doit confirmer ce comportement explicitement, pas seulement le supposer).
- **Requête** (`getEnvironmentAtPosition` ou équivalent) — les 3 niveaux de repli (§5.5), la priorité
  `active_maneuver_environment` (§5.3), le compartiment autonome de la cabine d'ascenseur et le cas
  escalier (§5.6, tous deux tranchés).
- **Combat réel** — scénario Node/PostgreSQL réel avec une exo hybride dans une pièce taguée, une pièce
  non taguée, hors de toute pièce, avec et sans dérogation manuelle — pour l'Initiative, le Se-relever
  et un Test de combat, les 3 appelants du point 6 de §4.
- **EAU1** (malus Initiative hors-milieu) — le doublement du malus reflète désormais l'environnement
  réel du token comparé à l'environnement nominal de son armure, pas une supposition systématique
  "sous-marine = toujours hors-milieu" (voir ajout au point 6 de §4).
- **Éditeur/build client** — build complet après l'ajout du contrôle de sélection de salle (patron déjà
  appliqué à chaque Lot de `PLAN_EXOARMURE.md` §16).

## 7. Prise de recul — risques hérités et validation externe (2026-08-25)

Recherche externe faite avant de conclure (CLAUDE.md — ne pas coder de zéro, s'inspirer de l'existant
éprouvé) : comparé à **Foundry VTT "Scene Regions"** (v12, le VTT le plus mature du marché — régions
avec plage d'élévation par forme, résolution par segment de mouvement, événements d'entrée/sortie).
Deux enseignements :

- **Confirme l'architecture retenue** : élévation encodée dans la clé de cellule (`${x}:${z}:${y}`,
  déjà vérifié §1) et résolution depuis la position **réellement atteinte** (pas le trajet parcouru)
  sont cohérents avec leur design ET avec la philosophie déjà actée dans ce projet
  (`.claude/rules/combat.md`). Pas une invention isolée.
- **Fait remonter un risque hérité, pas nouveau mais plus sensible désormais** : `roomFloorEntries`
  (`shared/world/worldCompiler.js:131`, `if (entries.has(key)) continue`) fait gagner **silencieusement**
  la première pièce traitée si deux pièces se superposent sur la même cellule/hauteur — déjà le
  comportement actuel pour `blocksMovement`/`blocksSight` (peu grave, visible au rendu). Une fois
  `environment` ajouté, une superposition de pièces mal construite donnerait un environnement
  silencieusement faux, sans erreur ni avertissement. **Pas un bug introduit par ce chantier** — un
  risque préexistant du compilateur, à documenter clairement plutôt qu'à hériter en silence. Pas de
  correctif proposé ici (hors périmètre — toucherait le compilateur au-delà de l'ajout du champ) ; à
  minima, un avertissement de compilation sur collision de clé serait un chantier séparé à envisager.

**Réassurance à vérifier explicitement à l'implémentation, pas seulement supposée** : ce mécanisme est
**strictement exo** — `resolveManeuverSkillId`/la détection monde ne sont jamais invoquées pour un
personnage `pj`/`pnj`. Zéro changement de comportement pour la résolution humaine, aucun risque de
régression sur le combat existant hors exo.

**Performance, à confirmer à l'implémentation** : la requête "quel environnement à cette position" doit
rester un lookup direct par clé de cellule (`O(1)`, comme `roomFloorEntries` déjà), jamais un scan de
toutes les pièces — le snapshot compilé est déjà mis en cache (LRU, `docs/SYSTEME/MOTEUR_MONDE.md`
2.8), donc pas de coût de compilation répété, seulement s'assurer que la fonction de requête elle-même
ne réintroduit pas un scan linéaire.

**Cohabitation avec les champs déjà existants sur `exo_sheet`** : une fois ce chantier livré, `exo_sheet`
porte 3 notions distinctes proches dans le nom mais différentes dans le rôle — `environment` (milieu
nominal de conception de l'armure), `surface_movement_mode`/`underwater_movement_mode` (mouvement,
sous-marine/surface uniquement, inchangé par ce chantier), et `active_maneuver_environment` (dérogation
manuelle, hybride uniquement). Aucune fusion proposée ici — juste signalé pour qu'une session future ne
les confonde pas, à clarifier dans `VOCABULARY.md` au moment de l'implémentation (l'entrée "Manœuvre
d'armure" y existe déjà et devra être mise à jour, pas dupliquée).

## 8. Ce que ce chantier ne couvre pas

- Le déplacement en 0G/vol libre (mouvement atmosphérique/spatial) — décision Saar 2026-08-23, reste
  non traité, `getExoMovementBudget` inchangé.
- Les effets de dangers environnementaux eux-mêmes pour un humain (manque d'air, dépressurisation,
  etc.) — hors périmètre, uniquement la résolution de la spécialité Manœuvre d'armure exo (+ EAU1) ici.
- Toute rétro-configuration des pièces/battlemaps existantes au-delà du réglage de repli (§5.5).
- **Propagation dynamique de l'environnement** (brèches, portes ouvertes faisant basculer tout un
  compartiment reliés) — décision Saar 2026-08-24, "en v1 un état statique suffira" (§5.2). Nécessite en
  plus que la fusion de plusieurs pièces en un seul compartiment de propagation existe d'abord (pas le
  cas aujourd'hui, §5.2) — v2, chantier séparé.
