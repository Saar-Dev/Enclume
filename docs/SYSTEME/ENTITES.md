SYSTEME/ENTITES.md — Entités libres du monde 3D

    Version : 2.1 — 2026-08-02

    Remplace l'ancienne version (système Redis obsolète).
    Statut : Document de référence.
    Audit de compréhension approfondie 2026-08-26 : événements WS (§7.2), assertWallPlacementState,
    withEntityScale, absence réelle de consommation du champ animations (§5.4) et fichiers de
    référence (§9) confirmés contre le code. Aucune correction nécessaire.
    Mise à jour 2026-09-16 : §5.4 complétée — un mécanisme d'animation par état existe désormais
    (visual_override.animationProgress), distinct du champ animations toujours inexploité.
    Mise à jour 2026-09-17 : §10 ajoutée — interactions runtime (Ouvrir/Fermer/Déplacer), protocole
    socket, règle d'ownership. Moteur câblé et partiellement prouvé en jeu réel (Lot A2,
    PLAN_ENTITES_INTERACTIVES_ROADMAP.md) ; limites connues référencées vers 3 PLAN stub ouverts le
    même jour (détection de clic, autorité serveur, Difficulté/surcharge MJ).
    Mise à jour 2026-09-18 : §10.1/§10.5 — surcharge MJ par instance (Difficulté/Portée) livrée et
    validée en jeu réel, `PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md` clos et archivé (`docs/Old/`).
    Lire pour : tout travail sur les entités 3D libres, leur cycle de vie, leur apparence, leur
    persistance et leurs interactions en session.

Documents associés :

    docs/SYSTEME/ASSETS.md — atelier GM, flux MinIO, création des blueprints

    docs/SYSTEME/CREATION_OBJETS_3D.md — guide de fabrication des GLB et rédaction du manifeste

    docs/SYSTEME/SURFACES_SALLES.md — éditeur de surface (connecteurs structurels)

    docs/SYSTEME/CORE.md — stores Zustand, événements WebSocket

    docs/SYSTEME/CONVENTIONS.md — pièges actifs (PE, PEF)

    docs/SYSTEME/MOTEUR_MONDE.md — compilation physique et autorité du snapshot

1. Définition

Une entité est un objet 3D libre posé sur une carte. Elle possède :

    un blueprint qui définit son apparence et ses propriétés ;

    une position dans le monde (pos_x, pos_y, pos_z en convention PE14) ;

    une rotation (r, 0–3, par pas de 90°) ;

    un état visuel et une échelle uniforme optionnelle.

1.1 Distinction avec les autres éléments du monde
Élément	Définition	Document
Entité libre	Objet 3D posé librement (caisse, terminal, mur décoratif)	Ce document
Connecteur	Élément structurel lié à une salle (porte, échelle, ascenseur)	SURFACES_SALLES.md
Token	Représentation d'un personnage ou d'un drone	CORE.md

Les entités libres sont gérées par l'onglet Entités de l'éditeur. Les connecteurs sont posés
via les outils de salle ou de mur. Les deux utilisent des blueprints, mais leurs cycles de vie et
leurs contraintes diffèrent. L'API serveur rejette explicitement la pose d'un blueprint de type
connector comme entité libre.
2. Blueprints
2.1 Origine

Les blueprints proviennent de deux sources :

    Modèles intégrés (builtin-models/) synchronisés au démarrage du serveur. Leur manifeste
    (manifest.json) décrit les fichiers GLB, les materialSlots, le placementMode et
    l'origin_default du pack.

    Atelier GM (/workshop) : le MJ importe des PNG, crée des blueprints avec des textures par
    face et peut y attacher un GLB.

Détail complet de l'atelier et du format des blueprints → docs/SYSTEME/ASSETS.md. Guide de
fabrication des GLB et rédaction du manifeste → docs/SYSTEME/CREATION_OBJETS_3D.md.
2.2 Héritage du manifeste

Un blueprint peut omettre origin dans sa définition. Il hérite alors de origin_default défini
au niveau du pack dans le manifeste. Ce mécanisme permet d'appliquer une convention commune à tous
les objets d'un pack sans répéter le champ sur chaque entrée.
2.3 Dimensions physiques

Les blueprints déclarent leurs dimensions dans l'unité de monde Enclume (enclume_world_unit,
correspondant au mètre) :

    footprint_width_m : largeur au sol

    footprint_depth_m : profondeur au sol

    height_m : hauteur totale

Ces champs déterminent l'occupation spatiale de l'entité et sont utilisés par le moteur de monde
pour la collision et la ligne de vue.
2.4 Palette dans l'éditeur

Dans la barre latérale, l'onglet Entités affiche les blueprints disponibles :

    Les blueprints sont groupés par catégorie avec une barre de recherche (filtre sur label et
    category).

    Les blueprints de type connector sont exclus de la liste.

    Un bouton Rafraîchir recharge les modèles intégrés (refreshBuiltinModels).

    Cliquer sur un blueprint le sélectionne pour la pose ; un second clic le désélectionne.

    Après une pose réussie, le blueprint actif est automatiquement désélectionné : une nouvelle
    pose exige un nouveau choix explicite dans la palette.

    Un aperçu 3D du modèle sélectionné (Object3DPreview) est affiché avant la pose.

    Depuis PLAN_ENTITES_INTERACTIVES_ROADMAP.md Lot A (2026-09-16) : après une pose réussie, le
    blueprint actif reste sélectionné (pose répétée du même objet). Pour arrêter, recliquer le même
    blueprint dans la palette, en choisir un autre, ou appuyer sur Échap.

2.5 Placement mode
Mode	Comportement
free	L'entité se pose au sol, centrée ou calée au coin selon origin
wall	L'entité s'aimante sur un mur existant. wallMount restreint les faces autorisées

Le mode connector est réservé aux connecteurs structurels et ne peut pas être utilisé pour une
entité libre.
3. Cycle de vie dans l'éditeur

Toutes les interactions ont lieu dans EntityEditorScene (client/src/components/Editor3D.jsx).
3.1 Pose libre (clic gauche)

    L'utilisateur sélectionne un blueprint dans la palette Entités.

    Un ghost suit la souris (calcPreciseEntityPos), aimanté à la grille fine par défaut, ou à la
    grande case visible (centre à x.5) si le snap grille est actif (touche G, toggle global,
    Lot A point 5, 2026-09-16) — portée limitée à la pose au sol, les objets muraux gardent leur
    snap fin. Un highlight vert de la case ciblée s'affiche sous le fantôme quand ce mode est actif
    (seule affordance visuelle du toggle, pas de bouton dans une barre d'outils).

    Depuis Lot A, point 2 (2026-09-16) : la hauteur de pose est celle du sommet le plus haut sous le
    curseur — sol/voxel (comportement d'origine) ou une autre entité déjà posée en mode free sur le
    même étage. Aucun raycast 3D contre les meshes : recherche par case de grille, même patron que
    columnTops/displayedFloorSupports (footprint ajusté par la rotation et l'échelle de l'entité).
    Les entités murales ne comptent jamais comme support. **Granularité fine (SURFACE_FINE, quart
    de case) pour la recherche de support entité**, pas la case entière du sol/voxel — une case
    entière déclenchait l'empilement jusqu'à ~1 unité du bord réel d'un objet (imprécision confirmée
    en jeu), corrigé pour matcher la précision déjà utilisée par le placement lui-même.

    Au clic gauche, POST /api/battlemaps/:id/entities crée l'entité.

    Le serveur rejette la création si le blueprint est de type connector (HTTP 400).

    Depuis 2026-09-18 (PLAN_BLOCAGE_CASES_OCCUPEES, archivé) : le serveur refuse aussi (HTTP 409)
    la création d'une entité bloquante (placementMode free uniquement) dont l'empreinte chevauche
    un token ou une autre entité déjà bloquante — même autorité que le déplacement des tokens
    (canOccupy/actorFootprintsOverlap, shared/world/spatialIndex.js), jamais vérifiée avant à la
    pose. Une entité non bloquante (state.is_blocking === false) reste empilable sans restriction.
    Les entités murales (placementMode wall) ne sont pas concernées — l'approximation circulaire du
    moteur surestimerait un objet plat contre un mur. Sur refus, le client annule le ghost et
    affiche un message (session.entityPositionOccupied, patron declare_error).

    ENTITY_CREATED est émis au socket pour les autres clients.

    bumpBattlemapRuntimeRevision est appelé pour invalider le cache du snapshot physique.

    Depuis Lot A (2026-09-16) : le blueprint actif reste sélectionné après la pose (pose répétée) —
    voir §2.4. Échap (SessionPage.jsx, ignoré si le focus est dans un champ texte) désélectionne
    explicitement.

3.2 Placement mural

    L'entité s'aimante sur les faces des murs existants.

    La position est contrainte par wallMount : une entité avec allowExterior: false ne peut pas
    se placer sur la face extérieure d'un mur.

    wallMount.default_bottom_height définit la hauteur par défaut au-dessus du sol pour l'entité.

    Le serveur valide que l'état contient un placement avec wallId, wallAxis et wallFace
    valides (assertWallPlacementState).

3.3 Déplacement par drag

    mousedown sur une entité existante → entityDragRef stocke l'ID et la position initiale.

    Au-delà de 4 px de mouvement, un ghost suit la souris.

    Au mouseup, un seul PUT /api/entities/:id est envoyé, puis ENTITY_MOVED est émis.

    Cas mural : le drag cherche obligatoirement un nouveau mur. La rotation est recalculée
    depuis la normale de la face et n'est pas réglable manuellement.

    L'entité déplacée est exclue de sa propre recherche de support (sinon elle utiliserait sa
    propre hauteur comme sol pendant qu'on la glisse et resterait figée en l'air).

    Depuis 2026-09-18 (PLAN_BLOCAGE_CASES_OCCUPEES, archivé) : même refus d'occupation qu'à la
    création (§3.1) si la position change réellement, pour une entité bloquante en placementMode
    free. Le PUT générique (§4.2, EntityInstancePanel) envoie toujours pos_x/pos_y/pos_z même sans
    déplacement — le serveur compare à la position en base, jamais à la seule présence du champ,
    pour ne pas re-tester une position inchangée à chaque sauvegarde du panneau. Verrou
    transactionnel PostgreSQL (.forUpdate(), ordre battlemaps→tokens→entities, symétrique à
    executeBattlemapTokenMovement) uniquement quand la position change réellement — pas sur les
    autres champs du panneau.

3.4 Rotation (touche R)

    Priorité au fantôme : si une pose est en cours (blueprint actif), R tourne toujours le
    fantôme, jamais une entité déjà posée qui se trouverait par hasard sous le curseur (bug
    corrigé le 2026-09-16 — l'ordre inverse faisait tourner l'entité sous le curseur en priorité,
    contre-intuitif pendant une pose).

    Sans pose en cours, l'entité sous le curseur pivote de 90° (r = (r + 1) % 4).

    PUT /api/entities/:id persiste, ENTITY_MOVED diffuse.

    Les entités en mode wall ne peuvent pas être tournées librement (leur orientation est dictée
    par le mur).

3.5 Suppression (Delete / Backspace)

    DELETE /api/entities/:id supprime l'entité en base, puis ENTITY_DELETED est émis.

    Le store entityStore retire immédiatement l'entité.

    bumpBattlemapRuntimeRevision est appelé.

4. Transformation (échelle)
4.1 Échelle uniforme

Stockée dans entity.state.transform.scale, entre 0.25 et 4.

    Normalisée par shared/world/entityTransform.js (withEntityScale) à chaque sauvegarde.

    Validée côté serveur dans PUT /api/entities/:id.

    Consommée par le renderer, l'occupation et la LOS — un GLB agrandi a un volume physique cohérent
    avec son apparence.

4.2 Interface d'édition

Le panneau d'instance (ouvert par clic sur une entité en mode sélection) expose les couleurs, les
coordonnées et la rotation (0/90/180/270 degrés). La transformation d'échelle s'effectue
également depuis ce panneau.
5. Apparence et rendu
5.1 Deux modes de rendu

Le composant EntityMesh (client/src/components/EntityMesh.jsx) gère deux modes :
Mode	Condition	Rendu
GLB	Le blueprint possède glb_url	Modèle 3D chargé via useGLTF, avec slots couleur et eau
Boîte texturée	Le blueprint possède geometry.faces	Boîte avec 6 faces texturées (PNG par face)
5.2 Textures par face

Les textures sont chargées via loadVoxelTextures et structurées dans entityTextureMaterials :
javascript

entityTextureMaterials = {
  [blueprint.id]: {
    base: { faceMaterials: [...6 mats...] },
    states: { [stateId]: { faceMaterials: [...6 mats...] } }
  }
}

    null dans faces → face invisible.

    Les face_overrides d'un état sont fusionnés avec les faces de base.

5.3 Slots couleur GLB

Les modèles intégrés exposent des materialSlots dans leur manifeste. Chaque slot possède un
code (SLOT_01…SLOT_05), un label, une default_hex et une liste material_names qui fait le
lien avec les noms de matériaux dans le fichier GLB. Les overrides sont stockés dans
entity.state.materialOverrides, avec priorité à l'état visuel courant sur l'état de l'instance.
Les matériaux marqués FIXED dans le modèle ne sont jamais recolorés.
5.4 Animations

Le champ animations (liste de clips déclarés) reste présent dans la structure du manifeste mais
n'est toujours pas consommé par le moteur de jeu.

Depuis 2026-09-16 (chantier caisses interactives), un mécanisme distinct existe : un state peut
déclarer visual_override.animationProgress (0 à 1). EntityMesh.jsx construit un
THREE.AnimationMixer sur la scène clonée de l'entité et lit le premier clip d'animation du GLB
(animations[0], indépendant de son nom) — convention retenue : temps 0 du clip = valeur 0,
fin du clip = valeur 1. La progression interpole en douceur vers la cible au changement d'état
(lerp, comme la position) et snape instantanément au montage (pas de rejeu de l'animation à
chaque chargement de carte). Ne gère qu'un seul clip par GLB ; un modèle à plusieurs clips
synchronisés (ex. deux vantaux de porte coulissante) n'est pas couvert par ce mécanisme.
Détail et incident de mise au point : docs/Old/PLAN_CAISSES_INTERACTIVES.md (archivé, Règle 10)
et docs/JOURNAL8.md.
5.5 Eau sur les modèles GLB

Un mesh GLB dont le nom contient water_surface, waterfall, fluid_window ou fluid_band (ou
dont le userData porte editor_water_role) reçoit automatiquement un shader d'eau animé. Voir
SURFACES_SALLES.md pour la distinction avec l'effet runtime « inondation ».
5.6 Comportements visuels
Comportement	Déclencheur	Rendu
Halo de sélection	Entité sélectionnée (isSelected)	Contour doré lumineux + pointLight
Icône d'interaction (⚙)	Survol d'une entité avec interactions	Icône cliquable au-dessus de l'entité
Icône d'attente (⏳)	Entité en attente d'arbitrage GM (pendingEntityId)	Sablier au-dessus de l'entité
Liseré Alt	Touche Alt enfoncée (altPressed)	Contour cyan autour de l'entité
Overlay GM	Entité gm_only	Contour violet wireframe + opacité réduite (×0.5)
Lerp 300 ms	Tout changement de position	Interpolation fluide (tau = 0.1)
5.7 Ghost de prévisualisation

    Avant la pose, un ghost suit la souris avec le même rendu que l'entité finale.

    Opacité réduite (PREVIEW_OPACITY = 0.42), raycasting désactivé.

    Une hitbox invisible élargie (+40 % largeur, +0,8 hauteur) facilite le clic de sélection en
    mode session.

6. Entités réservées au GM (gm_only)

    Champ booléen gm_only sur l'instance.

    Côté serveur, GET /api/battlemaps/:id/entities exclut les entités gm_only pour les joueurs
    non-GM.

    Côté rendu, overlay violet wireframe et opacité réduite à 50 % pour le GM (afin de les
    distinguer), invisibles pour les joueurs.

7. Persistance et événements
7.1 Store Zustand

entityStore (CORE.md) :
javascript

{
  entities: [],       // instances de la carte courante
  blueprints: {}      // accumulé, jamais vidé entre cartes
}

Comportements clés :

    setEntities : remplace les instances, extrait et stocke les blueprints embarqués.

    fetchBlueprints : chargement global sans écraser les blueprints existants.

    refreshBuiltinModels : recharge les modèles intégrés (utilisé par l'atelier et l'onglet
    Entités).

    addEntity : guard doublon (vérifie si l'ID existe déjà).

    updateEntity : guard obsolescence via updated_at.

    removeEntity : filtre par ID.

7.2 Événements WebSocket
Événement	Émetteur	Récepteur	Description
ENTITY_CREATED	client (GM)	serveur → room	Entité posée
ENTITY_DELETED	client (GM)	serveur → room	Entité supprimée
ENTITY_MOVED	client (GM)	serveur → room	Entité déplacée
ENTITY_UPDATED	serveur	room	État changé
7.3 Autorité

Le serveur est l'autorité unique pour la position, la rotation, l'échelle et l'état des entités.
Le client prévisualise ses modifications mais ne valide qu'après la réponse du serveur.
7.4 Lien avec le moteur monde

Chaque mutation d'entité (création, modification, suppression) appelle
bumpBattlemapRuntimeRevision, ce qui incrémente runtime_revision et invalide le cache du
snapshot physique utilisé par le moteur de monde. Les entités sont ainsi prises en compte dans les
calculs de collision, d'occupation et de ligne de vue. Voir MOTEUR_MONDE.md.
8. Conventions et pièges
8.1 Convention PE14
text

pos_x = X (Three.js X)
pos_y = Z (profondeur Three.js)
pos_z = Y (altitude Three.js)

Tous les événements et routes utilisent cette convention.
8.2 Pièges (PEF*)
Code	Description
PEF1	pack_id obligatoire sur le blueprint — guard si null avant chargement des textures
PEF2	fakeTexObj conforme : { id, pack_id, faces } — faces = chemins PNG
PEF3	entityTextureMaterials indexé par blueprint.id UUID
PEF4	face_overrides = mêmes chemins PNG que faces
PEF5	Blueprint sans pack_id → skip + rendu magenta (debug)
PEF6	Chargements textures voxels et entités séparés dans Canvas3D
8.3 Distinction entité / connecteur

Ne jamais confondre une entité libre avec un connecteur. Les connecteurs :

    appartiennent à surface_data.connectors ;

    ont des règles de collision, de navigation et d'état runtime ;

    sont posés via l'outil Salle/Mur, pas via la palette Entités ;

    sont rejetés par l'API si on tente de les poser comme entité libre.

8.4 Validation serveur

    Le serveur vérifie que le blueprint n'est pas de type connector (HTTP 400).

    Pour les entités murales, assertWallPlacementState valide la présence de wallId, wallAxis
    et wallFace.

    L'échelle est normalisée par withEntityScale à chaque sauvegarde.

    updated_at = db.fn.now() est appliqué après le guard Object.keys (convention P13).

9. Fichiers de référence
Fichier	Rôle
client/src/components/Editor3D.jsx	EntityEditorScene (pose, drag, rotation, suppression)
client/src/components/EntityMesh.jsx	Rendu d'une entité (GLB ou boîte texturée)
client/src/stores/entityStore.js	Store Zustand
server/src/routes/entities.js	API REST CRUD
shared/world/entityTransform.js	Validation et normalisation de l'échelle
client/src/lib/voxelTextures.js	Chargement des textures
client/src/lib/modelMaterialSlots.js	Gestion des slots couleur

10. Interactions runtime (Ouvrir/Fermer/Déplacer)

Une entité posée peut porter des interactions déclenchables en session (pas dans l'éditeur GM) —
Ouvrir/Fermer un coffre, Pousser/Tirer une caisse pour se couvrir. Câblé et prouvé partiellement en
jeu réel (chantier caisses interactives, 2026-09-16, puis Lot A2 `move_type`, 2026-09-17 —
`PLAN_ENTITES_INTERACTIVES_ROADMAP.md`).

10.1 Schéma de données

`entity_blueprints.states`/`interactions` (JSONB, zéro validation de forme au niveau de la base —
voir `tools/validate-3d-manifest.mjs` pour la seule validation existante, côté manifest builtin) :

    states : liste { id, name } — un état visuel/logique (ex. 0 = fermé, 1 = ouvert).

    interactions : liste d'objets, un par action proposée au joueur/MJ :

Champ	Rôle
id	Identifiant stable de l'interaction (ex. "open", "move")
action_label	Libellé affiché sur la tranche du menu radial
required_state_ids	Liste blanche des états où l'interaction est proposée — jamais [] pour une interaction censée être toujours disponible (la rendrait invisible dans tous les états)
target_state_id	État cible après une action réussie (Ouvrir/Fermer) — ignoré si move_type est présent
move_type	'displacement' — bascule l'interaction en mode visée déplacement plutôt qu'action directe
attribute_id / skill_id	Attribut ou Compétence testée ; ni l'un ni l'autre = résolution directe sans jet
difficulty_dc	Modificateur signé ajouté au Seuil ; absent → 0 (voir 10.4, limite connue)
range	Portée en mètres depuis le token acteur ; absent → repli 1,5 m

`entities.disabled_interactions` (liste d'ids) et `entities.interaction_overrides` (jsonb, clé =
id d'interaction) permettent de désactiver ou surcharger une interaction sur une instance précise
sans toucher au blueprint partagé. Surcharge `difficulty_dc`/`range` éditable depuis
`EntityInstancePanel.jsx` (section « Interactions », un champ par interaction), normalisée par
`normalizeInteractionOverrides` (`shared/world/entityTransform.js`, autorité unique client+serveur —
valeur non finie ou id d'interaction absent du blueprint silencieusement écartés à l'écriture,
`PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md` L1, 2026-09-18).

10.2 Lecture côté client

`client/src/lib/entityInteractions.js` (`getAvailableInteractions(entity)`) est l'unique point de
lecture des interactions disponibles pour l'état courant d'une instance — filtre par
`required_state_ids` (liste blanche) et `disabled_interactions`, jamais dupliqué ailleurs dans
`SessionPage.jsx`.

10.3 Flux d'interaction

    Clic sur une entité → `handleEntityClick` (`SessionPage.jsx`). Une seule interaction
    disponible et pas MJ → action directe. Plusieurs (ou MJ, qui reçoit en plus une tranche
    « Modifier ») → menu radial (`RadialMenu.jsx`).

    Ouvrir/Fermer (sans move_type) → `ENTITY_ACTION_REQUEST` (joueur, arbitrage MJ si un Test est
    requis) ou `ENTITY_ACTION_GM_DIRECT` (MJ, résolution instantanée sans arbitrage — action MJ
    directe sans personnage engagé).

    Déplacer (move_type: 'displacement') → arme un mode visée (`moveTarget` côté client, curseur
    `'case'` via `useSceneCursor.js`, halo doré sur l'entité ciblée via `EntitySelectionHalo`,
    `EntityMesh.jsx isSelected`). Un bandeau centré (`SessionPage.jsx`, dérivé de `moveTarget`, aucun
    state séparé) affiche le modificateur de Difficulté effectif pendant toute la visée — seul chemin
    d'interaction sans arbitrage MJ, donc le seul où ni le joueur ni le MJ ne voyaient rien avant le
    jet (`PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md` L2, 2026-09-18 ; `getEffectiveInteractionDifficulty`,
    `client/src/lib/entityInteractions.js`, point de lecture unique partagé avec `getAvailableInteractions`).
    Un second clic sur une case de destination émet
    `ENTITY_MOVE_REQUEST` — le serveur revalide portée et direction (dot(AE,AD), PE27) avant de
    lancer le jet.

    Le serveur reste seul autoritaire sur le Seuil, la portée, la direction et le résultat — le
    client ne fait qu'exprimer une intention (guide-caméra/curseur), jamais une décision (règle
    générale entités, `.claude/rules/entities.md`).

    Le jet suit le circuit générique Test/Chance/Catastrophe (`shared/polarisTestResolution.js`,
    `chanceCatastropheChoiceService.js`) — un risque de Catastrophe ouvre un choix Chance routé au
    joueur propriétaire (PJ) ou au MJ (PNJ), avant toute résolution.

10.4 Ownership — qui peut déclencher une interaction

`server/src/lib/socketUtils.js` (`canActAsCharacter`) : le joueur propriétaire du personnage, ou le
MJ mais seulement via un PNJ (jamais un PJ — autorité du joueur préservée ; jamais un drone —
pilotage télécommandé dédié). Câblé sur `ENTITY_MOVE_REQUEST` uniquement à ce jour — cette règle est
dupliquée sous plusieurs formes ailleurs dans le serveur, cadrage en cours
(`docs/PLANS/PLAN_AUTORITE_PERSONNAGE_SERVEUR.md`).

Côté client, `client/src/lib/actingToken.js` (`resolveActingToken`) résout le token acteur (possédé
→ sélectionné → repli non-MJ) — autorité unique partagée par la caméra 3e personne, `handleEntityMove`
et le rendu du menu radial. Le serveur revalide toujours l'ownership réelle ; ce résolveur n'exprime
qu'une intention côté client.

10.5 Limites connues (2026-09-17)

    Détection de clic : **résolu 2026-09-17** (chantier clos, archivé `docs/Old/
    PLAN_CLIC_3D_UNIFICATION.md`) — arbitrage token/entité/connecteur unifié par une autorité
    `aimModeActive`/`blocksEntityClick`, validé en jeu réel. Détail du patron : `SYSTEME/REACT.md`
    P59. `Editor3D.jsx` (raycasting séparé du mode édition) reste explicitement hors périmètre,
    rattaché à `PLANS/PLAN_WORLD_BUILDER_REWORK.md` pour une éventuelle unification future.

    Difficulté ajustable par instance et affichée avant le jet (côté joueur pendant la visée, côté
    MJ déjà via `ENTITY_ACTION_PENDING`/`sidebar.actionDC` pour Ouvrir/Fermer) : **résolu 2026-09-18**
    (archivé `docs/Old/PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md`). Le MJ règle toujours `difficulty_dc`
    par défaut au blueprint (atelier `/workshop`, `EntityBuilderTab.jsx`) — aucun repli automatique
    dérivé du poids/taille n'a été ajouté (RAW silencieuse sur ce point, décision : le MJ configure à
    la source plutôt qu'un calcul générique).

    `move_type` reste à observer réussir en jeu réel avec une Difficulté réglée à une valeur jouable
    (validé jusqu'ici : configuration MJ + affichage joueur, pas encore un jet de Déplacer réussi avec
    ce réglage) — l'effet sur `state_cover`/LOS reste théorique tant que ce test n'est pas fait.