SYSTEME/ENTITES.md — Entités libres du monde 3D

    Version : 2.1 — 2026-08-02

    Remplace l'ancienne version (système Redis obsolète).
    Statut : Document de référence.
    Lire pour : tout travail sur les entités 3D libres, leur cycle de vie, leur apparence et leur
    persistance.

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

    Un ghost suit la souris (calcPreciseEntityPos), aimanté à la grille fine.

    Au clic gauche, POST /api/battlemaps/:id/entities crée l'entité.

    Le serveur rejette la création si le blueprint est de type connector (HTTP 400).

    ENTITY_CREATED est émis au socket pour les autres clients.

    bumpBattlemapRuntimeRevision est appelé pour invalider le cache du snapshot physique.

    Après une pose réussie, le blueprint actif est automatiquement désélectionné.

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

3.4 Rotation (touche R)

    L'entité sous le curseur pivote de 90° (r = (r + 1) % 4).

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

Les blueprints peuvent déclarer un champ animations. Ce champ est présent dans la structure du
manifeste mais n'est pas consommé par le moteur de jeu à ce jour.
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