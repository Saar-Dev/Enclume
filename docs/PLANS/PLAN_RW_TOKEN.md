# PLAN_ANIMATIONS.md — Pipeline d’animations squelettiques pour tokens

> Version 3 (professionnelle) — 2026-07-26, mise à jour 2026-07-26 (run à vide RV1-RV8 + corrections RV4/RV7).
> Lecture obligatoire avant toute modification du périmètre.
> Prérequis Phase 7 : `docs/PLAN_CHARACTER_STATES.md` (autorité position/arme, dont dépend le choix
> d'animation — pas de `tokens.current_posture`, cf. Phase 7 et §3.2bis).
> Voir aussi : `JOURNALTEMP.md` (mémoire de conception), `VOCABULARY.md` (termes),
> `SYSTEME/ASSETS.md` (MinIO), `Canvas3D.jsx` (client).

## 1. Objectif

Intégrer dans Enclume un système d’**animations squelettiques indépendantes du maillage** pour les
tokens (personnages). Le but est de :

- représenter visuellement l’état d’un personnage (debout, accroupi, allongé, arme au clair…) via
  des animations squelettiques ;
- détecter la partie du corps touchée par un clic (tête, torse, bras…) grâce à des volumes de
  collision (hitboxes) attachés aux os ;
- poser les fondations pour la future personnalisation des personnages (skin, équipement visible).

Le **skin** (maillage 3D) sera ajouté plus tard. Aujourd’hui, on travaille uniquement avec le
squelette (rig) et les animations.

---

## 2. Concepts clés

- **Squelette / Rig** : hiérarchie d’os (bones) représentant l’armature d’un humanoïde. Dans ce
  projet, on utilise le standard `mixamorig` (issu de Mixamo), mais un système de mapping permet
  d’importer des squelettes non-Mixamo (voir §3.5).
- **Animation** : suite de keyframes décrivant un mouvement (ex. `idle_normal`, `crouch_to_idle`).
  Une animation peut être jouée en boucle (`loop`), une seule fois (`once`) ou figée à une frame
  (`pose`).
- **Posture** (terme défini dans `VOCABULARY.md`) : état logique d’un token qui détermine quelle
  animation est jouée. Exemple : `"debout_arme_au_clair"`.
- **Hitbox** : volume simple (sphère, boîte) attaché à un socket (point d’attache sur un os), utilisé
  pour détecter la partie du corps touchée par un raycast. Géré par le `BoneAttachmentSystem`.
- **Socket** : point d’attache standardisé sur un os (ex. `right_hand`, `head`, `back`) avec une
  position et rotation relative. Les hitboxes et les futurs équipements s’attachent à des sockets.
- **AnimationController** : petite machine à états qui valide les transitions entre postures et gère
  la file d’animations en cours (prépare les futures transitions avec blending).
- **AnimationCache** : cache centralisé qui garantit qu’un même fichier GLB n’est chargé qu’une seule
  fois, même si plusieurs tokens l’utilisent.

---

## 3. Architecture

### 3.1 Principes professionnels

1. **Séparation squelette / animations** : le squelette de référence (T-pose) est stocké dans un
   fichier séparé. Les animations sont des fichiers indépendants (un par clip ou par ensemble
   logique). Cela permet de charger le squelette une fois et de lui appliquer n’importe quelle
   animation compatible.
2. **Retargeting simplifié** : un mapping de noms d’os permet d’adapter des animations provenant de
   sources non-Mixamo vers le squelette cible. Sans cela, on reste prisonnier de Mixamo.
3. **Sockets standardisés** : les hitboxes et équipements s’attachent à des points nommés (ex.
   `right_hand`) plutôt que directement à des os. Cela permet de régler finement la position et
   l’orientation.
4. **Contrôleur d’animations** : un `AnimationController` minimal (même en V1) structure la logique
   d’état et prépare l’ajout futur de transitions avec blending.
5. **Cache partagé** : un `AnimationCache` évite de recharger le même GLB pour plusieurs tokens.
6. **Tests unitaires** : chaque phase inclut des tests automatisés (Jest/Mocha).

### 3.2 Backend

POST /api/skeletons/upload → fbx2gltf → MinIO (skeletons/<uuid>.glb) → table skeletons
POST /api/animations/upload → fbx2gltf → MinIO (animations/<uuid>.glb) → table animations
GET/POST/PUT/DELETE /api/posture-mappings (table posture_mappings)
GET/POST/PUT/DELETE /api/bone-attachments (table bone_attachments)
GET/POST/PUT/DELETE /api/bone-mappings (table bone_mappings, pour le retargeting)


- **Conversion** : `fbx2gltf` (binaire standalone, empaqueté dans `server/bin/`).
- **Stockage** : MinIO, préfixes `skeletons/` et `animations/`. Pas de modification du proxy
  `/api/assets`.
- **Base de données** :
  - Table `skeletons` : `id`, `label`, `file_path`. Contient le squelette de référence (T-pose).
  - Table `animations` : `id`, `label`, `file_path`, `play_mode` (`loop`/`once`/`pose`),
    `frame_default`, `skeleton_id` (FK, optionnel). Si `skeleton_id` est null, l’animation est
    compatible avec n’importe quel squelette `mixamorig`.
  - Table `posture_mappings` (correctif RV7, run à vide 2026-07-26) : clé composite
    `(position_value_code, weapon_value_code)` — chacun nullable et référençant
    `ref_character_state_values` filtré par axe (`docs/PLAN_CHARACTER_STATES.md`), **jamais** une
    chaîne texte libre. `animation_id` (FK), `play_mode`, `frame`. Nullable sur une des deux clés =
    ligne de repli (« n'importe quelle arme pour cette position », ou l'inverse) — voir §3.2bis.
    Pas de calque haut/bas du corps (pattern Unity Animation Layers/three.js additive blending
    étudié et écarté : aucun artiste 3D disponible pour régler la zone de transition colonne
    vertébrale — une table plate à 12 combinaisons reste gérable à la main).
  - Table `bone_attachments` : `id`, `socket_name` (ex. `right_hand`), `bone_name` (ex.
    `mixamorig:RightHand`), `type` (`hitbox`/`socket`), `shape`, dimensions, `offset_x/y/z`,
    `rotation_x/y/z`. Remplace l’ancienne `hitbox_definitions`.
  - Table `bone_mappings` : `id`, `source_bone`, `target_bone` (ex. `Spine1` →
    `mixamorig:Spine`). Utilisé pour le retargeting simplifié.

### 3.2bis Résolution de repli et sourcing des animations (ajouté suite à RV7, 2026-07-26)

Contrainte actée : **aucun artiste 3D disponible**. Les 12 combinaisons (4 positions × 3 armes) doivent
être trouvées dans des bibliothèques toutes faites, pas produites sur mesure — certaines combinaisons
précises (ex. « à genou, arme rangée ») peuvent tout simplement ne pas exister en catalogue.

- **Résolution en cascade** à la lecture de `posture_mappings`, dans cet ordre : (1) ligne exacte
  `(position, weapon)` ; (2) ligne `(position, null)` — même position, arme ignorée ; (3) ligne
  `(null, weapon)` — même arme, position ignorée ; (4) T-pose (fallback déjà prévu Phase 8). Une
  combinaison introuvable en bibliothèque n'interrompt donc pas le pipeline — elle dégrade
  proprement vers la position ou l'arme seule, jamais vers le squelette figé en premier recours.
- **Sourcing** — pistes concrètes trouvées en recherche externe, à vérifier avant de lancer la Phase 1 :
  le pack gratuit **MoCap Online « Free Pistol Animation Pack »** contient déjà des combinaisons
  stance+arme toutes faites (idle/marche/jog/course, **avec et sans visée**, en position debout et
  accroupie) — exactement la forme de donnée attendue par ce plan, licence commerciale incluse.
  Source : [MoCap Online — Free Pistol Animation Starter Pack](https://mocaponline.itch.io/free-pistol-animation-starter-pack).
  Mixamo reste la source par défaut pour le squelette de référence et les postures simples (idle,
  marche) ; les combinaisons stance+arme plus spécifiques viendront probablement d'ailleurs.
- **Conséquence sur la Phase 3.5 (retargeting)** : les packs hors Mixamo n'utilisent pas forcément la
  convention `mixamorig:*` — la table `bone_mappings` (déjà prévue §3.5) passe donc de « fonctionnalité
  de confort » à **prérequis probable**, pas une extension optionnelle.
- **Avant de construire tout le pipeline (Phase 1)** : faire l'inventaire des 12 combinaisons contre les
  bibliothèques disponibles (Mixamo + pack ci-dessus a minima) et noter celles introuvables — ça ne
  bloque rien (résolution en cascade ci-dessus) mais évite de découvrir le trou en pleine Phase 6.

### 3.3 Client Three.js

- **`AnimationCache`** : Map globale URL → `Promise<GLTF>`. Évite de recharger le même fichier
  plusieurs fois. Partagé via un contexte React ou un module JS simple.
- **`AnimationController`** : classe légère qui possède un état courant, une méthode
  `requestPosture(postureId)` validant les transitions, et un `AnimationMixer` sous-jacent. Prépare
  les futurs blendings.
- **`TokenAnimatedBody`** : composant React qui charge le squelette via `useGLTF`, puis les
  animations nécessaires, crée un `AnimationController`, et expose `setPosture()`.
- **`BoneAttachmentSystem`** : utilitaire qui crée des sockets (groupes positionnés sur les os) et y
  attache des hitboxes ou des équipements. Expose `createSocket()`, `attachHitbox()`,
  `getHitPart()`, et plus tard `attachEquipment()`.
- Intégration dans `TokenMesh` : si un `skeletonUrl` est fourni, `TokenAnimatedBody` remplace
  `TokenGlbBody` (ou s’affiche en surimpression en mode debug).
- Raycasting : le raycaster existant de la scène interroge les volumes des hitboxes (via
  `getHitPart()`).

### 3.4 Éditeur d’administration

Page `/admin/tokens` — autorisation corrigée suite à RV4 (2026-07-26) : **pas de rôle « admin »
global dans ce projet** (vérifié, aucune colonne/table de ce type n'existe). Décision Saar : accès
ouvert à **n'importe quel MJ, toute campagne confondue** — le catalogue squelettes/animations est
partagé entre campagnes, donc l'appartenance à une campagne précise n'a pas de sens ici. Middleware
`requireAnyGm` (nouveau, `server/src/middleware/auth.js`, à côté de `requireAuth` existant) :
`db('campaign_members').where({ user_id: req.user.id, role: 'gm' }).first()` — vrai si l'utilisateur
est MJ d'au moins une campagne, quelle qu'elle soit. Aucune migration, aucun nouveau concept
d'autorisation : réutilise le rôle `campaign_members.role` déjà en place partout ailleurs.

Deux onglets :
- **Chorégraphie** (actif) : upload de squelettes et d’animations, conversion, prévisualisation du
  squelette animé + hitboxes/sockets, édition du mapping posture↔animation, édition des attachments
  et du mapping d’os.
- **Skin** (placeholder) : message « Gestion des skins à venir ». Sera activé quand le pipeline skin
  sera implémenté.

### 3.5 Retargeting simplifié

Un fichier d’animation non-Mixamo peut être importé à condition qu’un mapping de noms d’os soit
configuré dans la table `bone_mappings`. Par exemple, si le fichier source utilise `Spine1` au lieu
de `mixamorig:Spine`, le mapping traduit automatiquement. Cela permet d’importer des animations
Blender, Cascadeur, etc.

La validation à l’upload vérifie que tous les os cibles (`mixamorig:*`) existent dans le mapping ou
dans le fichier source. Si un os essentiel est absent, l’import est rejeté avec un message
explicite.

---

## 4. Décisions techniques actées

| Sujet | Décision V1 | Raison |
|-------|-------------|--------|
| Séparation squelette / animations | **Fichiers séparés obligatoires**. Un squelette de référence + des fichiers d’animation indépendants. | Modularité, réutilisabilité, évitement de duplication. |
| Stockage du mapping | **SQL propre** : tables `posture_mappings`, `bone_attachments`, `bone_mappings`. | Intégrité référentielle, validation native, évolutif. |
| Standard de rig | **`mixamorig` par défaut**, mais `bone_mappings` permet l’import de squelettes non-Mixamo. | Flexibilité sans sacrifier la compatibilité. |
| Synchronisation réseau | **Réutilisation de `TOKEN_UPDATED`** existant. Le payload inclut `current_posture`. | Pas de nouvel événement inutile. |
| Attachments | Module unique `BoneAttachmentSystem` avec **sockets standardisés**. | Anticipe les futurs équipements visibles, positionnement fin. |
| Contrôleur d’animations | **`AnimationController` minimal** avec validation des transitions. | Structure le code et prépare le blending. |
| Cache de chargement | **`AnimationCache`** partagé entre tous les tokens. | Évite les chargements redondants. |
| Tests | **Tests unitaires à partir de la Phase 2**, dans chaque phase. | Qualité et non-régression. |
| Gestion des transitions (`once`) | **Différée à une V2** (blending, crossfade). | Le `AnimationController` et la colonne `play_mode` les anticipent. |

---

## 5. Phases de réalisation

### Phase 1 — Préparation technique (1 jour)

**Objectif** : valider la chaîne de conversion et l’affichage d’un squelette dans Three.js.

- Installer `fbx2gltf` sur le serveur Debian. Empaqueter le binaire dans `server/bin/`.
- Télécharger depuis Mixamo :
  - Un **squelette de référence** : choisir un personnage simple (ex. Y Bot), le télécharger en T-pose
    **sans animation** (ou avec une animation d’une seule frame en T-pose). Format FBX, sans skin.
  - Une **animation** : `idle_normal`, format FBX, sans skin.
- Convertir les deux FBX en GLB via `fbx2gltf`.
- Vérifier que les noms d’os `mixamorig:` sont préservés.
- Charger le squelette et l’animation dans une scène Three.js de test, appliquer l’animation via
  `AnimationMixer`, et afficher le squelette avec `SkeletonHelper`.
- Vérifier la coexistence de plusieurs `<Canvas>` (page admin + scène de jeu).

**Tests** : aucun test automatisé dans cette phase exploratoire.

**Validation** : le squelette est visible et correctement animé.

---

### Phase 2 — Import backend et stockage (1,5 jour)

**Objectif** : pouvoir uploader un squelette et une animation depuis l’interface d’administration.

- Migrations :
  - `XXX_create_skeletons.js`
  - `XXX_create_animations.js`
- Routes :
  - `POST /api/skeletons/upload` (`requireAnyGm`, §3.4) : réception FBX, validation, conversion,
    stockage MinIO (`skeletons/<uuid>.glb`), insertion en base.
  - `POST /api/animations/upload` (`requireAnyGm`) : idem, mais le champ `skeleton_id` est optionnel.
    Stockage dans `animations/<uuid>.glb`.
- Validation commune :
  - Magic bytes FBX (`Kaydara FBX Binary`).
  - Taille max : 5 Mo.
  - Timeout de 30 s pour `fbx2gltf`.
  - Présence de l’os racine `mixamorig:Hips` dans le GLB converti (sauf si un `bone_mapping` est
    fourni pour traduire les noms d’os — cette partie sera faite en Phase 6).
- Endpoint `GET /api/skeletons` et `GET /api/animations` pour lister les entités disponibles.
- Endpoint `GET /api/animations/:id/clips` : retourne la liste des noms de clips contenus dans le
  GLB (utilise `gltf-transform` en Node.js ou un script Python).

**Fichiers créés** :
- `server/src/lib/fbxConverter.js` (wrapper pour `fbx2gltf`).
- `server/src/lib/gltfInspector.js` (lecture des clips d’un GLB).
- `server/src/routes/skeletons.js`
- `server/src/routes/animations.js`

**Tests** :
- Conversion d’un FBX valide → succès, fichier présent dans MinIO.
- Upload d’un fichier non-FBX → rejet 400.
- Upload d’un FBX sans `mixamorig:Hips` (et sans mapping) → rejet 422.
- `GET /api/animations/:id/clips` retourne les noms de clips attendus.

---

### Phase 3 — Modélisation SQL du mapping, des attachments et du retargeting (0,5 jour)

**Objectif** : mettre en place les tables de configuration.

- Migrations :
  - `YYY_create_posture_mappings.js`
  - `YYY_create_bone_attachments.js`
  - `YYY_create_bone_mappings.js`
- Routes CRUD :
  - `GET/POST/PUT/DELETE /api/posture-mappings`
  - `GET/POST/PUT/DELETE /api/bone-attachments`
  - `GET/POST/PUT/DELETE /api/bone-mappings`
- Jeu de données par défaut :
  - 9 postures avec `animation_id` pointant vers les animations importées.
  - 6 attachments de type `hitbox` (tête, torse, bras gauche/droit, jambe gauche/droite) avec
    sockets standardisés.
  - Une entrée de mapping d’os pour `mixamorig:Hips` → `mixamorig:Hips` (identité) comme exemple.

**Fichiers créés** :
- `server/src/routes/postureMappings.js`
- `server/src/routes/boneAttachments.js`
- `server/src/routes/boneMappings.js`

**Tests** :
- CRUD complet pour chaque table.
- Contrainte d’unicité sur `posture_mappings.posture`.
- Contrainte de clé étrangère `posture_mappings.animation_id → animations.id`.
- Contrainte CHECK sur `bone_attachments.type` et `bone_attachments.shape`.

---

### Phase 4 — Client : `AnimationCache` et `AnimationController` (1 jour)

**Objectif** : mettre en place l’infrastructure de chargement et de contrôle des animations.

- Créer `client/src/lib/AnimationCache.js` :
  - Map `cache = new Map()`.
  - Fonction `async loadGLTF(url)` : si l’URL est dans le cache, retourne la promesse existante ;
    sinon, lance `useGLTF` (ou un loader natif) et stocke la promesse.
  - Fonction `preload(url)` pour anticiper les chargements.
- Créer `client/src/lib/AnimationController.js` :
  - Constructeur : prend un `AnimationMixer`, un mapping de postures, et une configuration de
    transitions (fichier JSON ou objet).
  - `requestPosture(postureId)` : vérifie si la transition est autorisée, arrête l’animation en
    cours, joue la nouvelle.
  - `update(deltaTime)` : met à jour le mixer (appelé depuis `useFrame`).
  - État interne : `currentPosture`, `isTransitioning` (toujours false en V1).
- Tests unitaires (Jest) :
  - `requestPosture` change bien l’animation jouée.
  - Une demande de posture non mappée lève une erreur.
  - Le cache retourne la même promesse pour deux appels avec la même URL.

**Tests** :
- Tests unitaires du cache et du contrôleur (Jest, hors navigateur).
- Test manuel dans un composant React simple : charger un squelette et une animation, appeler
  `requestPosture`, vérifier que le changement est visible.

---

### Phase 5 — Client : `TokenAnimatedBody` et `BoneAttachmentSystem` (2 jours)

**Objectif** : afficher un squelette animé sur la battlemap, avec des hitboxes fonctionnelles.

- Créer `client/src/components/TokenAnimatedBody.jsx` :
  - Props : `skeletonUrl`, `animationUrls` (tableau), `initialPosture`, `boneAttachmentsConfig`.
  - Utilise `AnimationCache.loadGLTF()` pour charger le squelette et les animations.
  - Crée un `AnimationMixer` sur le squelette, l’enveloppe dans un `AnimationController`.
  - Ajoute les hitboxes via `BoneAttachmentSystem`.
  - Affiche le squelette avec `SkeletonHelper` (mode debug).
  - Expose `setPosture(postureId)` qui délègue au contrôleur.
- Créer `client/src/lib/BoneAttachmentSystem.js` :
  - `createSocket(boneName, offset, rotation)` : retourne un `THREE.Group` positionné et orienté
    par rapport à l’os, ajouté comme enfant de l’os.
  - `attachHitbox(socket, config)` : crée un volume (sphere/box) invisible dans le socket, avec
    `userData.hitPart`.
  - `getHitPart(intersects)` : retourne la première partie touchée.
  - `attachEquipment(socket, mesh)` : méthode vide (placeholder pour la V2).
- Modifier `TokenMesh` dans `Canvas3D.jsx` :
  - Accepter une prop `animationConfig` (objet contenant `skeletonUrl`, `animationUrls`, etc.).
  - Si `animationConfig` est fourni, rendre `TokenAnimatedBody` au lieu de `TokenGlbBody`.
  - Pour le test, passer une constante `HARDCODED_ANIMATION_CONFIG`.

**Tests** :
- Tests unitaires de `BoneAttachmentSystem` : création de sockets, attachement de hitboxes,
  récupération de la partie touchée.
- Test manuel : afficher un token animé sur la battlemap, cliquer sur sa tête, vérifier dans la
  console que `"head"` est affiché.

---

### Phase 6 — Éditeur d’administration (2 jours)

**Objectif** : permettre à n'importe quel MJ (§3.4, `requireAnyGm`) de gérer les squelettes, animations,
mappings, et attachments via une interface dédiée.

- Créer `client/src/pages/TokenAdminPage.jsx`, route `/admin/tokens`.
- Onglet **Chorégraphie** (actif) :
  - **Upload** : formulaires séparés pour les squelettes et les animations. Feedback de conversion.
    Liste des entités existantes avec possibilité de suppression.
  - **Prévisualisation** : `<Canvas>` séparé affichant le squelette sélectionné, avec possibilité
    de charger une animation et de la jouer. Les sockets/hitboxes sont visibles (wireframe coloré).
    La prévisualisation se met à jour en temps réel quand l’admin modifie un offset.
  - **Mapping** : formulaire structuré pour `posture_mappings` (dropdown pour sélectionner
    l’animation, choix du `play_mode`).
  - **Attachments** : formulaire structuré pour `bone_attachments` (choix du socket, de l’os, de
    la forme, des dimensions, offset/rotation avec prévisualisation en direct).
  - **Mappings d’os** : formulaire pour `bone_mappings` (source → cible).
- Onglet **Skin** (placeholder) : message informatif.

**Fichiers créés/modifiés** :
- `client/src/pages/TokenAdminPage.jsx`
- `client/src/App.jsx` (ajout de la route)

**Tests** :
- Test manuel de bout en bout : upload d’un squelette, upload d’une animation, création d’un
  mapping, prévisualisation, sauvegarde.

---

### Phase 7 — Intégration avec les tokens (1 jour)

**Objectif** : les tokens peuvent avoir une posture persistée et synchronisée entre clients.

- Migration `ZZZ_add_token_posture.js` : ajouter `current_posture TEXT` à la table `tokens`.
- Modifier `PUT /api/tokens/:id` pour accepter `current_posture`.
- Modifier `server/src/socket/socketToken.js` : inclure `current_posture` dans le payload de
  `TOKEN_UPDATED`.
- Côté client : `TokenMesh` lit `token.current_posture` et appelle `setPosture()` sur le
  `TokenAnimatedBody`. Un changement de posture émet `TOKEN_UPDATED` et est reçu par les autres
  clients.
- Ajouter un sélecteur de posture temporaire dans le menu radial du token (pour le test) ou dans la
  console.

**Tests** :
- Changement de posture côté MJ → visible côté joueur (test manuel avec deux onglets).
- Le payload de `TOKEN_UPDATED` contient bien `current_posture`.

---

### Phase 8 — Robustesse, finitions et documentation (1 jour)

**Objectif** : solidifier le système, nettoyer le code, documenter.

- Posture par défaut si l’animation référencée est manquante (T-pose du squelette).
- Fallback si le fichier GLB est absent de MinIO.
- Test de performance : charger 20 tokens animés simultanément, mesurer le framerate.
- Nettoyage des logs de debug, suppression des `SkeletonHelper` hors mode debug.
- Mise à jour de `VOCABULARY.md` avec les nouveaux termes.
- Rédaction d’un scénario d’acceptation (voir §7).
- Mise à jour de `docs/EN_COURS.md` et clôture de la tâche.

**Tests** :
- Scénario d’acceptation complet.
- Test de performance (manuel).

---

## 6. Hypothèses à vérifier en Phase 1

- [ ] `fbx2gltf` préserve les noms d’os `mixamorig:` (majuscules, préfixe).
- [ ] Les animations sans skin depuis Mixamo sont lisibles par `useGLTF` sans erreur.
- [ ] `AnimationMixer` fonctionne avec une armature seule (pas de mesh).
- [ ] Les volumes hitbox attachés aux sockets restent correctement positionnés pendant l’animation.
- [ ] Le raycaster existant intersecte bien les volumes hitbox.
- [ ] Plusieurs `<Canvas>` (admin + jeu) coexistent sans conflit WebGL.
- [ ] Un FBX de squelette (T-pose, sans animation) est correctement exporté par Mixamo.

---

## 7. Dettes documentées

- **Transitions (`once`) et blending** : le `AnimationController` et la colonne `play_mode` les
  anticipent, mais elles ne sont pas implémentées en V1.
- **Interface graphique avancée** : les formulaires structurés remplacent le JSON libre, mais un
  éditeur visuel (gizmos dans la vue 3D) reste souhaitable à terme.
- **Synchronisation fine** : les animations ne sont pas synchronisées à la frame près entre clients
  (acceptable pour un VTT).
- **Cohérence avec l’état de combat** : `current_posture` est une colonne indépendante de
  `combat_roster.state_position` et `state_weapon`. Un alignement automatique sera nécessaire à
  terme pour éviter des incohérences visuelles.
- **Sécurité `fbx2gltf`** : le binaire est appelé en ligne de commande avec timeout. Une sandbox
  plus stricte (conteneur, chroot) serait plus robuste si le service est exposé au public.
- **Retargeting complet** : le mapping de noms d’os (table `bone_mappings`) est une solution
  simplifiée. Un vrai retargeting (proportions du squelette, différences de longueur d’os)
  nécessiterait un algorithme plus avancé (IK, correspondance de poses).
- **Cache d’animations** : le `AnimationCache` est en mémoire (Map). Pour une utilisation
  long-terme avec beaucoup d’animations, il faudra une stratégie d’éviction (LRU).

---

## 8. Scénario d’acceptation

**Contexte** : le MJ a préparé un squelette de référence et 9 animations (debout, accroupi, allongé
× trois états d’arme).

1. Le MJ ouvre `/admin/tokens`, onglet Chorégraphie.
2. Il uploade le squelette de référence (FBX, T-pose). La conversion réussit.
3. Il uploade les 9 animations FBX. La conversion réussit. Il peut lister les clips de chaque
   animation.
4. Il configure les postures : associe chaque état (`debout_arme_au_clair`, etc.) à une animation
   et un `play_mode` (`loop`).
5. Il configure les sockets/hitboxes : 6 parties du corps, avec leurs os, dimensions, offsets. La
   prévisualisation montre les volumes en temps réel.
6. Il ouvre la battlemap. Le token de John est configuré pour utiliser le squelette et les
   animations.
7. Le MJ change la posture de John en `accroupi_arme_au_clair` via une action (menu radial pour le
   test). Le token de John s’accroupit.
8. Le joueur de John, sur un autre client, voit son token changer de posture.
9. En mode debug, le MJ clique sur la tête du squelette de John. La console affiche `"head"`.
10. Le MJ clique sur le torse. La console affiche `"torso"`.
11. Le MJ supprime une animation utilisée par une posture. Le token de John passe en T-pose
    (fallback). Aucune erreur fatale.

---

## 9. Fichiers concernés

| Fichier | Action | Phase |
|---|---|---|
| `server/bin/fbx2gltf` | Ajouter (binaire) | 1 |
| `server/src/lib/fbxConverter.js` | Créer | 2 |
| `server/src/lib/gltfInspector.js` | Créer | 2 |
| `server/src/db/migrations/XXX_create_skeletons.js` | Créer | 2 |
| `server/src/db/migrations/XXX_create_animations.js` | Créer | 2 |
| `server/src/routes/skeletons.js` | Créer | 2 |
| `server/src/routes/animations.js` | Créer | 2 |
| `server/src/db/migrations/YYY_create_posture_mappings.js` | Créer | 3 |
| `server/src/db/migrations/YYY_create_bone_attachments.js` | Créer | 3 |
| `server/src/db/migrations/YYY_create_bone_mappings.js` | Créer | 3 |
| `server/src/routes/postureMappings.js` | Créer | 3 |
| `server/src/routes/boneAttachments.js` | Créer | 3 |
| `server/src/routes/boneMappings.js` | Créer | 3 |
| `server/index.js` | Modifier (routes) | 2-3 |
| `client/src/lib/AnimationCache.js` | Créer | 4 |
| `client/src/lib/AnimationController.js` | Créer | 4 |
| `client/src/lib/BoneAttachmentSystem.js` | Créer | 5 |
| `client/src/components/TokenAnimatedBody.jsx` | Créer | 5 |
| `client/src/components/Canvas3D.jsx` | Modifier (intégration TokenAnimatedBody + hitboxes) | 5 |
| `client/src/pages/TokenAdminPage.jsx` | Créer | 6 |
| `client/src/App.jsx` | Modifier (route admin) | 6 |
| `server/src/db/migrations/ZZZ_add_token_posture.js` | Créer | 7 |
| `server/src/routes/tokens.js` | Modifier (PUT current_posture) | 7 |
| `server/src/socket/socketToken.js` | Modifier (payload TOKEN_UPDATED) | 7 |
| `shared/events.js` | Vérifier (pas de nouvel event) | 7 |
| `docs/VOCABULARY.md` | Modifier (nouveaux termes) | 8 |
| `docs/EN_COURS.md` | Mettre à jour (clôture) | 8 |
| `docs/PLAN_ANIMATIONS.md` | Ce document | — |