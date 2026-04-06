## Session 4 — 2026-03-31

### Contexte de reprise
Session 3 stable confirmée. Démarrage session 4 — librairie de personnages + tokens sur la carte.

### Décisions prises

**Table characters — unifiée PJ/PNJ/véhicule/drone**
user_id nullable — NULL = entité GM (PNJ, objet interactif).
Pas de stats — dépendent de la fiche personnage (autre développeur, hors scope).
Champs glb_url et portrait_url présents dès la migration pour éviter une migration future.
visible booléen — contrôle la visibilité dans la librairie pour les joueurs.

**Couleur utilisateur**
Champ color VARCHAR(7) ajouté sur users (migration 14).
Assignée aléatoirement à l'inscription depuis une palette de 12 teintes distinctes.
Modifiable par l'utilisateur dans ses paramètres (Phase 3).
Les tokens GM sont neutres — la couleur ne s'affiche pas sur leurs tokens, mais le champ est présent pour tous les profils par cohérence.

**character_id sur tokens**
Migration 16 — liaison token ↔ character via character_id nullable.
SET NULL si le character est supprimé — le token reste sur la carte.

**color sur tokens**
Migration 17 — champ color nullable sur tokens.
Héritée du character à la création, modifiable par le GM.

**Convention UUID — NON NÉGOCIABLE**
Découverte en session 4 : toutes les PK/FK existantes utilisent uuid, pas bigint.
Toute nouvelle migration doit utiliser table.uuid('id').primary().defaultTo(knex.fn.uuid()).
Documentée dans CONVENTIONS.md.

**Route /api/assets/:folder/*filePath**
Route générale proxy MinIO — remplace une multiplication de routes ciblées.
Sans auth — les assets statiques (GLB, PNG) ne sont pas sensibles.
Content-Type automatique selon extension : png, jpg, glb, json, pdf.
La route /api/textures reste en place pour compatibilité.

**tokens.js réécrit**
Multer retiré du POST — la route reçoit du JSON pur.
character_id, pos_z, color ajoutés dans le INSERT.
Upload image token prévu sur POST /api/tokens/:id/upload (Phase suivante).

**Drag HTML → canvas**
V1 : token créé au centre de la carte (pos_x=0, pos_y=0, pos_z=0).
Mécanisme : dataTransfer sur dragstart (Sidebar) → onDrop sur la div canvas (SessionPage).
Itération possible si l'expérience s'avère inconfortable en pratique.

**isGm calculé côté client**
Calculé dans SessionPage depuis campaign.members — plus hardcodé dans Sidebar.
La vraie valeur vient de la base de données.

**Police Inter locale**
client/public/fonts/inter.woff — copiée depuis node_modules/@fontsource/inter/files/.
Utilisée par Text de drei pour les labels de tokens — pas de dépendance CDN.

**Tokens 3D — rendu**
Modèle .glb chargé via useGLTF dans un sous-composant GltfLoader.
Clone via SkeletonUtils.clone (three-stdlib) — gère les textures embarquées en base64.
SRGBColorSpace forcé sur mat.map après clone — correctif pour modèles générés par trimesh.
Scale x2, Y_OFFSET 0.5 (à ajuster selon le modèle final).
OrbitControls — maxPolarAngle = Math.PI / 2 — caméra bloquée au-dessus de Y=0.

**Modèle default.glb**
Uploadé dans MinIO sous tokens/default.glb.
Modèle actuel généré par IA (free-3d.fr via trimesh) — textures défaillantes (noires).
À remplacer par un modèle propre exporté depuis Blender.
Le code de rendu est correct — le problème est l'asset, pas le code.

**Scènes 2D ambiance — décision reportée**
Idée validée : battlemap type 'scene' avec image plein écran + tokens 2D (illustration dans cercle).
Reportée en Phase 3 pour ne pas bloquer les tokens 3D. Documentée dans ROADMAP.md.

### Migrations appliquées
Batch 5 : 3 migrations — color users, characters, character_id tokens
Batch 6 : 1 migration — color tokens
Total : 18 migrations, toutes stables

### Fichiers créés/modifiés
server/src/routes/auth.js — génération couleur aléatoire au register
server/src/routes/characters.js — CRUD complet
server/src/routes/assets.js — proxy général MinIO (sans auth)
server/src/routes/tokens.js — réécrit (JSON pur, character_id, pos_z, color)
server/src/index.js — ajout characters + assets
client/src/pages/SessionPage.jsx — isGm, tokens, characters, drop
client/src/components/Canvas3D.jsx — tokens 3D, GltfLoader, SkeletonUtils, halo, label
client/src/components/Sidebar.jsx — isGm prop, onglet Persos, drag characters
client/public/fonts/inter.woff — police locale pour labels 3D
docs/CONVENTIONS.md — convention UUID migrations + mergeParams
docs/ARCHITECTURE.md — couleur users, route assets, tokens cascade, Clone, Inter
docs/ROADMAP.md — mise à jour complète session 4

### État fonctionnel vérifié
- Création de personnage depuis la Sidebar ✅
- Drag depuis Sidebar → token créé en base et affiché sur la carte ✅
- Modèle 3D visible sur la carte ✅
- Halo de couleur au sol ✅
- Label flottant avec nom du personnage ✅
- OrbitControls bloqué sous Y=0 ✅
- isGm branché sur la vraie valeur ✅

### Points de vigilance session suivante
- default.glb à remplacer — modèle actuel sans textures (problème asset, pas code)
- Y_OFFSET et position cercle à recalibrer avec le nouveau modèle
- Chaînes UI de l'onglet Persos pas encore passées par i18next (en dur en français)
- Drag & drop token sur la carte (déplacement) non implémenté
- Socket.io token:move non branché côté client
- isGm branché mais pas encore testé avec un vrai compte joueur

### Prochaine étape
1. Fournir un nouveau default.glb propre (Blender ou source fiable)
2. Recalibrer Y_OFFSET et position cercle
3. Drag & drop token sur la carte pour déplacement
4. Socket.io token:move branché côté client

## Session 5 — 2026-04-01

### Contexte de reprise
Session 4 stable confirmée. Démarrage session 5 — nouveau default.glb + drag & drop déplacement tokens.

### Travail effectué

**Nouveau default.glb — Blender 5.1.0**
Modèle recrée depuis zéro dans Blender par l'utilisateur.
- Origine placée aux pieds (centre de la base) ✅
- Dimensions : 1 unité de large × 2 unités de haut ✅
- Texture atlas unique `default.png` appliquée sur slot Base Color du Principled BSDF ✅
- Color Space corrigé : Linear → sRGB (cause du rendu noir en session 4) ✅
- Exporté en .glb avec textures embarquées
- Uploadé dans MinIO sous `tokens/default.glb` (remplacement de l'ancien)
- Validé visuellement dans Canvas3D — texture visible, proportions correctes ✅

**Calibration Canvas3D.jsx**
Y_OFFSET et scale ajustés visuellement après import du nouveau modèle.
Valeurs finales trouvées par l'utilisateur après tests — stables.
Principe retenu : le code s'adapte au modèle, pas l'inverse.
`clonedScene` identifié comme bug latent (recréé à chaque render) — correction prévue lors du drag.

### Décisions prises

**Drag & drop déplacement tokens — spec validée**

Comportement :
- `onPointerDown` sur token → début drag immédiat
- Si souris n'a pas bougé au `pointerUp` (seuil 3-4px) → sélection (pas drag)
- Pendant le drag : token suit curseur en temps réel, légère élévation Y+0.3
- Inclinaison selon direction du déplacement (delta XZ) — amplitude max ±0.3 rad
- Au relâchement : raycasting sur plan Y=0, scan colonne voxels pour Y final
- Token se pose sur le dessus du voxel le plus haut à cette position XZ
- Si pas de voxel → Y=0 (sol)
- Snap à la case : Math.round(x), Math.round(z)
- PUT /tokens/:id pour persister
- OrbitControls désactivé pendant le drag

**Mapping coordonnées — NON NÉGOCIABLE**
Piège identifié et documenté. À respecter dans tout le code de drag.
```
Three.js (tx, ty, tz) → base de données :
  pos_x = tx   (X Three.js = X base)
  pos_y = tz   (Z Three.js = pos_y base)
  pos_z = ty   (Y Three.js altitude = pos_z base)
```
Ce mapping doit être isolé dans une fonction utilitaire nommée explicitement.
Ne jamais faire ce mapping inline dans un handler.

**Architecture du drag — décisions techniques**
- État du drag dans `Scene`, pas dans `TokenMesh` — pour écouter `onPointerMove` sur canvas entier
- `clonedScene` dans `useMemo` dans `TokenMesh` — éviter recréation à chaque render pendant drag
- Callback `onTokenMove` descendu SessionPage → Canvas3D → Scene — pour mettre à jour tokens en base + état local
- `orbitRef` passé en prop à Scene → TokenMesh pour désactiver pendant drag
- PUT retourne `{ token: updated }` — mettre à jour le tableau tokens dans SessionPage
- Socket.io `token:move` — étape 3, après drag fonctionnel

**Sélection vs menu contextuel**
- Clic gauche court → sélection (halo illuminé)
- Token reste sélectionné jusqu'à clic sur autre token ou clic vide
- Clic droit sur token sélectionné → menu contextuel (stats placeholder + outils) — Phase 3
- Maintien clic gauche → drag

### Fichiers lus cette session
- `client/src/components/Canvas3D.jsx` — état actuel stable ✅
- `server/src/routes/tokens.js` — format PUT vérifié ✅

### Prochaine étape — à coder
1. Corriger `clonedScene` → `useMemo` dans `TokenMesh`
2. Ajouter état drag dans `Scene` (draggingTokenId, dragPosition)
3. `onPointerDown` sur TokenMesh → notifie Scene
4. `onPointerMove` sur canvas DOM → raycasting plan Y=0, mise à jour dragPosition
5. `onPointerUp` → raycasting final + scan voxels colonne + snap + PUT + reset
6. Inclinaison token pendant drag (delta XZ → rotation)
7. Callback `onTokenMove` dans SessionPage

### Points de vigilance
- Mapping coordonnées Three.js ↔ base de données — fonction utilitaire obligatoire
- `clonedScene` dans useMemo — ne pas oublier
- OrbitControls désactivé pendant drag — via orbitRef.current.enabled
- `onPointerMove` sur gl.domElement (canvas entier), pas sur le mesh
- Tester avec un vrai compte joueur — isGm pas encore testé
- Chaînes UI onglet Persos pas encore passées par i18next
- Socket.io token:move non branché côté client (étape suivante)

## Session 5 — suite (2026-04-01)

### Corrections apportées cette session

**default.glb — nouveau modèle Blender**
- Dimensions correctes : 1×2 unités, origine aux pieds ✅
- Texture atlas default.png appliquée, Color Space sRGB ✅
- Y_OFFSET et scale calibrés visuellement par l'utilisateur ✅
- Principe retenu : le token s'adapte au système, pas l'inverse

**Drag & drop déplacement tokens — implémenté**
- onPointerDown → drag, clic court → sélection
- DRAG_LIFT = 8 pendant le drag (token en l'air)
- Raycasting plan Y=0 au drop, snap Math.round
- threeToDb() — fonction utilitaire mapping coordonnées (NON NÉGOCIABLE)
- OrbitControls désactivé pendant drag
- clonedScene dans useMemo — correction bug recréation GLB
- isGm descendu SessionPage → Canvas3D → Scene
- Validation drop : GM Y 0-8, Joueur Y 0-7

**Bug altitude +1 corrigé**
getColumnTopY retournait maxY+1 même pour voxels Y=0.
Correction : return maxY (pas maxY+1). Le token se pose au niveau du voxel, pas dessus.

**isGm passé à Canvas3D**
SessionPage passe maintenant isGm={isGm} à Canvas3D.

### Problèmes non résolus — à traiter session suivante

**pointLight sélection token — ne fonctionne pas**
Cause probable : Three.js r155+ — useLegacyLights=false par défaut.
intensity=100 + distance=40 : toujours invisible.
Cause alternative possible : le clonedScene (primitive) est un objet Three.js natif,
les lumières R3F dans le même group ne l'affectent peut-être pas.
SOLUTION RETENUE : remplacer la pointLight par une animation useFrame sur le halo.
Animation : anneau qui tourne, oscille en hauteur (+/-0.01), pulse en opacité.

**Précision du raycast pendant le drag — mauvaise**
Cause : plan de raycasting à Y=DRAG_LIFT=8, angle oblique → erreur de projection amplifiée.
BONNE PRATIQUE trouvée (Three.js cookbook, codepen kaolay) :
- Au pointerDown : intersectObjects sur le token mesh → point de clic exact
- planeY = point de clic Y (hauteur réelle du clic sur le modèle)
- offset = intersectionPoint - tokenPosition
- Pendant move : raycast sur plan à planeY, soustraire offset
- Au drop : raycast sur plan Y=0 (correct, inchangé)
Cette approche garantit que le token reste exactement sous le curseur quelle que soit l'angle caméra.

### À coder immédiatement

1. Animation halo sélection (useFrame) — remplace pointLight
2. Précision raycast drag (plan au Y du clic + offset)
3. getColumnTopY bug altitude — CORRIGÉ (return maxY, pas maxY+1)

### État fichiers actuels
Canvas3D.jsx — version avec drag fonctionnel, altitude corrigée, pointLight présente mais invisible
SessionPage.jsx — stable, isGm passé à Canvas3D

### Rappel conventions critiques
- threeToDb(tx, ty, tz) → { pos_x: tx, pos_y: tz, pos_z: ty } — JAMAIS inline
- clonedScene dans useMemo — ne pas oublier
- useFrame disponible dans TokenMesh (enfant de Scene, enfant de Canvas) ✅
- GltfLoader = sous-composant dédié pour useGLTF (règle hooks React)
- Police Inter locale : font="/fonts/inter.woff"

## Session 5 — 2026-04-01

### Contexte de reprise
Session 4 stable confirmée. Objectifs : nouveau default.glb + drag & drop déplacement tokens.

---

### Travail effectué

**default.glb — Blender 5.1.0**
Modèle recréé par l'utilisateur depuis zéro.
- Origine aux pieds, dimensions 1×2 unités ✅
- Texture atlas default.png, Color Space Linear→sRGB corrigé ✅
- Y_OFFSET et scale calibrés visuellement ✅
- Uploadé dans MinIO tokens/default.glb

**Drag & drop déplacement tokens — implémenté et affiné**
Plusieurs itérations. État final stable :
- Raycasting sur plan Y=0 uniquement (approche Foundry VTT — précis, simple)
- XZ depuis raycast, Y dynamique = getColumnTopY + DRAG_HOVER pendant le drag
- Token flotte au-dessus du sol local, suit l'altitude des voxels en temps réel
- Snap Math.round au drop
- OrbitControls désactivé pendant drag
- Inclinaison token selon direction déplacement (DRAG_TILT_MAX = 0.3 rad)
- threeToDb() — mapping coordonnées NON NÉGOCIABLE
- clonedScene dans useMemo — correction bug recréation GLB

**Validation drop**
- GM : Y 0-8 (liberté totale, peut poser sur le vide)
- Joueur : Y 1-7 (voxel obligatoire sous les pieds, pas sur mur max)

**Correction conflit sélection DOM/React**
`justSelectedRef` dans Canvas3D — empêche `handleCanvasClick` d'effacer
une sélection posée dans le même cycle par `handlePointerUp`.

**TokenRing — anneau de base unifié**
Un seul composant anneau par token, toujours visible, deux états :
- Normal : statique, Y=0.6 local (au-dessus des pieds, Y_OFFSET=0.5), opacité 0.5
- Sélectionné : oscillation hauteur + diamètre via useFrame, opacité monte à ~0.95
- Pendant drag : Y=0.1 (au ras du sol pour aider à viser la case cible)
Couleur = token.color (propriétaire du token).

**pointLight supprimée**
La pointLight de sélection ne fonctionnait pas (Three.js r155+ useLegacyLights=false).
Remplacée définitivement par TokenRing animé.

**DRAG_LIFT supprimé**
Remplacé par altitude dynamique getColumnTopY + DRAG_HOVER = 0.5.

---

### Décisions techniques importantes

**Mapping coordonnées — NON NÉGOCIABLE**
```
threeToDb(tx, ty, tz) → { pos_x: tx, pos_y: tz, pos_z: ty }
```
Ne jamais faire ce mapping inline. Toujours passer par cette fonction.

**getColumnTopY — retourne maxY (pas maxY+1)**
Le token se pose AU NIVEAU du voxel, pas au-dessus.
Correction appliquée en session 5.

**Approche drag — pattern Foundry VTT**
Après recherche : les VTT pros séparent drag XZ (raycast sol) et altitude (calculée après drop).
Raycasting toujours sur Y=0 pendant le drag. Altitude calculée au drop uniquement.
Source : Foundry VTT v13, module elevated-vision, codepen kaolay Three.js.

**pointLight dans R3F + MeshLambertMaterial**
Ne fonctionne pas avec Three.js r155+ (useLegacyLights=false par défaut).
Solution : animations useFrame sur meshBasicMaterial pour les effets visuels de sélection.

**isGm descendu jusqu'à Scene**
SessionPage → Canvas3D (prop isGm) → Scene → handlePointerUp pour validation drop.

---

### État fichiers après session 5

**Canvas3D.jsx** — version stable avec :
- Drag fonctionnel, précision excellente
- TokenRing animé (sélection + drag)
- justSelectedRef (conflit sélection corrigé)
- Altitude dynamique pendant drag
- Validation drop GM/joueur

**SessionPage.jsx** — stable, isGm + onTokenMove passés à Canvas3D.

---

### À faire — session 6 (dans l'ordre)

1. Socket.io token:moved branché côté client
2. Chat branché Socket.io (remplace chat local)
3. Calque GM — tokens invisibles pour les joueurs
4. Barre GM supérieure (gestion battlemaps, affectation joueurs)
5. X-Ray — voxels transparents devant tokens
6. Viewport Snap GM + verrouillage

### Points de vigilance session suivante
- Tester avec un vrai compte joueur — isGm pas encore testé en conditions réelles
- Chaînes UI onglet Persos pas encore passées par i18next
- "La Forêt Maudite" sans battlemap (créée avant la transaction auto)
- Orientation token (N/S/E/O) — prévu Phase 3, via menu contextuel clic droit
- CLIENT_URL + VITE_API_URL à reconfigurer sur Raspberry Pi

### Conventions critiques à rappeler
- threeToDb() — JAMAIS inline
- clonedScene dans useMemo — ne pas oublier
- useFrame disponible dans TokenMesh (enfant de Canvas) ✅
- GltfLoader = sous-composant dédié pour useGLTF (règle hooks React)
- Police Inter locale : font="/fonts/inter.woff"
- UUID partout en base — jamais increments()
- Knex CLI Windows : node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs

## Session 6 — 2026-04-01

### Contexte de reprise
Session 5 stable confirmée. Démarrage session 6 — tâches UI manquantes + Socket.io côté client.

### Fichiers lus cette session (dans l'ordre)
- `shared/events.js` — constantes WS complètes ✅
- `server/src/socket/index.js` — format payloads vérifié ✅
- `client/src/pages/SessionPage.jsx` — socket={null} confirmé ✅
- `client/src/components/Canvas3D.jsx` — état complet vérifié ✅
- `client/src/components/Sidebar.jsx` — logique complète vérifiée ✅
- `client/package.json` — socket.io-client ABSENT confirmé ✅

### Constats établis avant de coder

**socket/index.js — payloads confirmés**
TOKEN_MOVED émet : { tokenId, pos_x, pos_y, pos_z } — pas un token complet.
TOKEN_CREATED / TOKEN_DELETED / TOKEN_UPDATED : non émis côté serveur socket.
CHAT_MESSAGE émet : { userId, username, text, timestamp } — champs différents du chat local
Sidebar ({ id, user, text, time }) — mapping nécessaire quand on branchera le chat.

**Canvas3D.jsx — problèmes confirmés**
- socket.emit('voxel:add') et socket.emit('voxel:remove') : chaînes en dur — violation CONVENTIONS.md.
  Correction : importer WS et utiliser WS.VOXEL_ADD / WS.VOXEL_REMOVE.
- WS non importé dans Canvas3D — à corriger en même temps.
- pointLight ligne 441 : inutile (Three.js r155+ legacy lights), à retirer.
- Suppression token (touche Suppr) : absente — tâche 1b.

**Sidebar.jsx — constats**
- Suppression character : absente — tâche 1c.
- Chat local (state React pur) : conforme, aucun Socket.io.
- char.owner_username utilisé ligne 318 : doit être retourné par GET /campaigns/:id/characters.
  Non bloquant maintenant.
- Chaînes en dur (non i18next) : connu depuis session 4, basse priorité.

**SessionPage.jsx — constats**
- socket={null} passé à Canvas3D : confirmé.
- handleTokenMove : reçoit un token complet. Compatible avec TOKEN_MOVED si on reconstruit
  le token depuis l'état local avant d'appeler la fonction.
- isGm calculé depuis members.find(m => m.id === user?.id) — pas encore testé avec vrai joueur.

**client/package.json — bloquant**
socket.io-client absent. À installer AVANT tout code Socket.io :
  cd client && npm install socket.io-client

**Chemin import WS depuis client/src/**
shared/events.js est à la racine du monorepo, pas dans client/.
Depuis client/src/components/ : ../../../shared/events.js
Depuis client/src/pages/ : ../../shared/events.js
À vérifier selon la config Vite (alias possible).

**Passage socket à Canvas3D — décision prise**
useRef ne déclenche pas de re-render → Canvas3D reçoit null et ne voit jamais le socket.
Solution retenue : useState(null) pour le socket dans SessionPage.
socketRef.current = io(...) puis setSocket(socketRef.current) après connexion.
Légèrement moins performant mais correct et simple.

### Plan session 6 — dans l'ordre strict

**Étape 1 — Tâches UI (pas de risque, routes serveur prêtes)**

1a. Bouton déconnexion — SessionPage.jsx
Bouton overlay coin supérieur gauche du canvas.
api.post('/auth/logout') → authStore.clear() → navigate('/login').

1b. Suppression token (touche Suppr) — Canvas3D.jsx
keydown sur document dans useEffect.
Conditions : selectedTokenId non null + isGm.
DELETE /api/tokens/:id → callback vers SessionPage → retirer du tableau tokens.
En même temps : import WS, corriger les deux emit en chaînes dures, retirer pointLight.

1c. Suppression character — Sidebar.jsx
IconTrash SVG à ajouter dans la section icônes.
Bouton dans charCard, isGm uniquement.
window.confirm + DELETE /characters/:id + onCharactersChange(prev => prev.filter(...)).
Style charDeleteBtn à ajouter.

1d. Commentaire TODO chat — Sidebar.jsx
Une ligne dans sendMessage : // TODO: brancher Socket.io — étape 6

**Étape 2 — Installation socket.io-client**
cd client && npm install socket.io-client
SR attendu sans erreur. Vérifier package.json mis à jour.

**Étape 3 — Socket.io côté client — SessionPage.jsx**
useState(null) pour le socket.
useEffect au montage : io() + emit SESSION_JOIN + on TOKEN_MOVED + cleanup disconnect.
TOKEN_MOVED handler :
  socket.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z }) => {
    setTokens(prev => prev.map(t =>
      t.id === tokenId ? { ...t, pos_x, pos_y, pos_z } : t
    ))
  })
Passer socket={socket} à Canvas3D (remplace socket={null}).

**Étape 4 — Test deux comptes simultanés**
Navigateur + onglet privé. GM + joueur.
Vérifier : drag token GM → joueur voit le déplacement en temps réel.
Premier vrai test isGm avec un compte joueur réel.
Utiliser une campagne créée après la transaction auto (pas "La Forêt Maudite").

### Ce qu'on ne fait PAS cette session
- Chat Socket.io
- TOKEN_CREATED / TOKEN_DELETED via socket
- Toute migration ou nouvelle route serveur
- i18next sur les chaînes en dur Sidebar

### Points de vigilance session suivante
- Tester isGm avec un vrai compte joueur (étape 4)
- owner_username sur characters — vérifier que la route le retourne
- "La Forêt Maudite" sans default_battlemap_id — ne pas utiliser pour les tests
- Chat Socket.io — mapping champs à faire (userId/username/text/timestamp → id/user/text/time)

## Session 6 — 2026-04-01 (mise à jour)

### Décisions prises en session 6

**Suppression token — deux mécanismes**
Touche Suppr/Backspace sur token sélectionné (GM uniquement) — implémenté dans Canvas3D.
Clic droit sur token → menu contextuel "Retirer du plateau" — à implémenter (propriétaire OU GM).
Les deux coexistent.

**Menu contextuel clic droit token 3D**
S'ouvre uniquement si l'utilisateur est propriétaire du token OU GM.
Actions actuelles : "Retirer du plateau" (DELETE /tokens/:id).
Placeholders non branchés : "Mesure", "Ligne de vue", "Portée".
Se ferme sur clic ailleurs.
Toutes les chaînes via i18next (namespace `token`).

**Fenêtre character modale**
Déclencheur : clic sur une charCard dans Sidebar.
Modale position fixed, z-index élevé, par-dessus tout.
Accessible à tous les membres (joueurs + GM).
visible=false → character absent de la liste joueur → pas de clic possible.
3 onglets :
- "Fiche" : placeholder Phase 3
- "Notes" : description (éditable GM+owner, lecture joueur) + gm_notes (GM uniquement)
- "Paramètres" : toggle visible (GM) + supprimer character (GM)
Bouton toggle visible en haut à droite, visible tous onglets, GM uniquement.
Illustration : placeholder — portrait_url prévu Phase 3.
Toutes les chaînes via i18next (namespace `character`).

**Migration 18 — description + gm_notes sur characters**
Deux champs TEXT nullable.
description : visible tous membres.
gm_notes : filtré côté route — jamais retourné aux joueurs.

**i18n — règle non négociable documentée dans CONVENTIONS.md**
Toute chaîne visible utilisateur passe par i18next. Sans exception. Sans report.
Nouvelle section ajoutée dans CONVENTIONS.md avec dette technique listée.
Namespaces à créer : `character`, `profile`, `sidebar`.

**Route PUT /api/users/me**
À créer. Champs : username, email, color, password (avec vérification ancien mdp).
Menu profil dans DashboardPage (modal dans header).

**Bouton déconnexion SessionPage — retiré du plan**
handleLogout existe déjà dans DashboardPage et fonctionne. Pas besoin dans SessionPage.

**Illustration character**
portrait_url existe déjà sur characters (migration 15).
Affichage et upload reportés Phase 3. Placeholder dans la modale pour l'instant.

### Fichiers modifiés session 6
- client/src/components/Canvas3D.jsx — WS import, emit corrigés, pointLight retirée, keydown Suppr
- docs/CONVENTIONS.md — section i18n + dédoublonnage
- docs/EN_COURS.md — mise à jour complète

### Fichiers à modifier dans la suite de la session
- server/src/db/migrations/20260401_18_characters_text_fields.js — à créer
- server/src/routes/characters.js — PATCH description/gm_notes + filtre gm_notes joueurs
- server/src/routes/users.js — PUT /me (à créer)
- client/src/components/Sidebar.jsx — modale character + TODO chat
- client/src/components/Canvas3D.jsx — menu contextuel clic droit
- client/src/pages/SessionPage.jsx — onTokenDelete + Socket.io
- client/src/pages/DashboardPage.jsx — i18n + menu profil
- client/src/locales/fr.json — namespaces character + profile + sidebar

### Points de vigilance
- Toujours lire le fichier avant de le modifier — jamais réécrire de mémoire
- i18n obligatoire sur tout nouveau texte — namespace character pour la modale
- gm_notes filtré côté serveur — ne jamais l'envoyer aux joueurs dans GET characters
- Menu contextuel : vérifier ownership token avant d'afficher (token.owner_id === user.id || isGm)
- socket.io-client à installer (cd client && npm install socket.io-client) avant Socket.io client

## Session 6 — 2026-04-01 (final)

### Contexte de reprise
Session 5 stable confirmée. Objectifs session 6 : tâches UI manquantes + Socket.io côté client.

### Décisions prises

**Suppression token — deux mécanismes coexistants**
Touche Suppr/Backspace sur token sélectionné (GM uniquement) — implémenté dans Canvas3D.
Clic droit sur token → menu contextuel "Retirer du plateau" — à implémenter session suivante.
Les deux coexistent.

**Fenêtre character modale**
Déclencheur : clic sur une charCard dans Sidebar (distingué du drag via dragStartPos ref).
Modale position fixed, z-index élevé, par-dessus tout.
Accessible à tous les membres.
visible=false → character absent de la liste joueur → pas de clic possible.
3 onglets : Fiche (placeholder Phase 3) / Notes (description + gm_notes) / Paramètres.
Bouton toggle visible en haut à droite, tous onglets, GM uniquement.
Illustration : placeholder — portrait_url prévu Phase 3.
Sauvegarde au blur des champs texte (pas à chaque frappe).
Toutes les chaînes via i18next (namespace character).

**visible = false par défaut à la création**
Tout nouveau character est invisible aux joueurs.
Le GM choisit quand le révéler via le toggle.

**Bug toggle visible — résolu**
Cause : onCharactersChange utilisait updater(characters) avec characters stale.
Solution : prop onCharacterUpdate séparée, reçoit le character complet depuis la réponse serveur,
appelle setSelectedCharacter directement — pas de dépendance au tableau.

**Route 404 sur PUT/DELETE /characters/:id — résolu**
Cause : characters.js monté uniquement sous /api/campaigns/:campaignId/characters.
Le client appelait /api/characters/:id qui n'existait pas.
Solution : actionsRouter exporté en nommé depuis characters.js,
monté sous /api/characters dans index.js.
Même pattern que tokensRouter monté sous /api/tokens.
Les routes PUT/:id et DELETE/:id récupèrent campaign_id depuis le character en base
— pas besoin de campaignId dans l'URL.

**onTokenDelete manquant dans SessionPage — résolu**
Canvas3D recevait socket={null} et onTokenDelete={undefined}.
La touche Suppr appelait undefined() — erreur silencieuse.
Ajout de handleTokenDelete dans SessionPage et passage à Canvas3D.

**errorHandler amélioré**
Log systématique (plus limité au mode dev).
Route et méthode HTTP incluses dans le log.
Stack trace complète uniquement pour les vrais 500.
Permet d'identifier rapidement la source des erreurs.

**Bug 500 GET /api/textures — asset manquant**
Cause : fichier block_space_quartza.png référencé dans manifest.json mais absent de MinIO.
Solution : asset uploadé dans MinIO par l'utilisateur.
Pas un bug de code — asset manquant.

**Migration 18 — description + gm_notes sur characters**
Deux champs TEXT nullable.
description : visible tous membres.
gm_notes : filtré côté serveur — jamais retourné aux joueurs dans GET.

**i18n — règle non négociable**
Section ajoutée dans CONVENTIONS.md.
Namespaces créés : character, sidebar.
Clés token complétées : removeFromMap, measure, lineOfSight, range.
Dette technique listée dans CONVENTIONS.md.

### Fichiers modifiés session 6
- server/src/db/migrations/20260401_18_characters_text_fields.js — créé
- server/src/routes/characters.js — description/gm_notes + actionsRouter standalone
- server/src/index.js — import actionsRouter + montage /api/characters
- server/src/middleware/errorHandler.js — logs améliorés
- client/src/components/Canvas3D.jsx — WS import, emit corrigés, pointLight retirée, keydown Suppr, onTokenDelete
- client/src/components/Sidebar.jsx — modale character 3 onglets, i18n complet, TODO chat
- client/src/pages/SessionPage.jsx — handleTokenDelete + onTokenDelete passé à Canvas3D
- client/src/locales/fr.json — namespaces character + sidebar + token complétés
- docs/CONVENTIONS.md — section i18n non négociable, dédoublonnage
- docs/EN_COURS.md — mise à jour complète

### État fonctionnel vérifié
- Suppression token touche Suppr (GM) ✅
- Toggle visible/invisible character ✅
- Suppression character depuis modale ✅
- visible=false par défaut à la création ✅
- errorHandler loggue route + méthode + stack ✅

### Non résolu — session suivante
- Menu contextuel clic droit token 3D
- Socket.io côté client (TOKEN_MOVED, SESSION_JOIN)
- socket.io-client absent de client/package.json — installer avant Socket.io
- Chat branché Socket.io
- Dashboard i18n + menu profil utilisateur (PUT /api/users/me)

### Points de vigilance session suivante
- "La Forêt Maudite" sans default_battlemap_id — ne pas utiliser pour les tests
- isGm pas encore testé avec un vrai compte joueur
- owner_username sur characters — vérifier que GET retourne bien ce champ
- Chat Socket.io — mapping champs : userId/username/text/timestamp → id/user/text/time
- CLIENT_URL + VITE_API_URL dans .env à reconfigurer sur Raspberry Pi
- Clic droit token : menu contextuel visible uniquement si propriétaire OU GM

## Session 7 — 2026-04-02

### Contexte de reprise
Session 6 stable confirmée. Objectif session 7 : menu contextuel token + Socket.io client.

### Problème rencontré — clic droit non fonctionnel

Première implémentation : menu contextuel déclenché via `onPointerDown` button===2 sur TokenMesh.
Non fonctionnel : OrbitControls interceptait le clic droit (pan caméra) avant R3F.
`stopPropagation()` R3F ne bloque pas les listeners DOM natifs d'OrbitControls.

### Analyse et décision — migration MapControls

Recherche effectuée sur les pratiques VTT (Foundry) et la doc Three.js.
Découverte : Three.js dispose de `MapControls`, variante d'OrbitControls conçue pour les vues carte/stratégie.
Preset natif MapControls : LEFT=PAN, MIDDLE=DOLLY, RIGHT=ROTATE.
Le clic droit étant affecté à la rotation (pas au pan), il devient disponible pour d'autres usages.

**Décision finale retenue :**
- Clic droit canvas vide → rotation orbitale (MapControls natif)
- Double clic sur token → menu contextuel (onDoubleClick R3F, sans conflit)
- Touches directionnelles → pan caméra (listenToKeyEvents natif MapControls)
- Molette enfoncée → pan souris
- Clic gauche canvas vide → désélection (inchangé)
- Drag token → clic gauche maintenu (inchangé)

### Décisions techniques

**Migration OrbitControls → MapControls**
Import depuis `@react-three/drei` — déjà installé, zéro nouvelle dépendance.
`<OrbitControls>` → `<MapControls>` dans le JSX.
mouseButtons : `{ LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }`.
`orbitRef.current.listenToKeyEvents(window)` — active le pan clavier natif.
`orbitRef.current.keyPanSpeed = 20` — vitesse pan clavier (défaut 7, trop lent).
`maxPolarAngle = Math.PI / 2` conservé — caméra bloquée au-dessus de Y=0.

**Double clic token → menu contextuel**
`onDoubleClick` existe nativement dans R3F sur les meshes — pas de timer à gérer.
Ajouté sur le group de TokenMesh, propagé via `onTokenDoubleClick` jusqu'à SessionPage.
Le double clic sélectionne d'abord (premier clic), puis ouvre le menu (deuxième clic) — comportement standard.

**handleDragStart nettoyé**
Garde `if (e.nativeEvent.button !== 0) return` — clic droit ignoré proprement.
Plus de détection button===2 ni de logique contextuelle dans handleDragStart.

**Menu contextuel HTML — SessionPage.jsx**
Rendu HORS du Canvas R3F, en position fixed par-dessus tout.
State : `contextMenu = { token, x, y }` ou `null`.
Ownership vérifié via lookup `characters` en state — pas de JOIN serveur, pas de migration.
Position adaptive : s'ouvre du bon côté selon la position du curseur dans la fenêtre (MENU_W=180, MENU_H=136).
Fermeture sur mousedown ailleurs (useEffect + cleanup).
Actions : "Retirer du plateau" (branché), Mesure / Ligne de vue / Portée (placeholders disabled).
i18n : namespace `token` — toutes les clés existaient déjà dans fr.json.

### Fichiers modifiés session 7
- client/src/components/Canvas3D.jsx — MapControls, double clic, handleDragStart nettoyé
- client/src/pages/SessionPage.jsx — contextMenu state, handleTokenDoubleClick, menu HTML

### État fonctionnel vérifié
- Double clic sur token → menu contextuel s'ouvre ✅
- "Retirer du plateau" → token supprimé ✅
- Clic droit canvas vide → rotation caméra ✅
- Touches directionnelles → pan caméra ✅
- Drag token → fonctionne toujours ✅
- Suppression touche Suppr → fonctionne toujours ✅

### Leçon apprise
Ne pas improviser sur un problème d'ergonomie de contrôles 3D.
Chercher ce que les professionnels font (Foundry VTT, Three.js cookbook).
La solution existait nativement dans Three.js — MapControls conçu exactement pour ce cas d'usage.

### Non résolu — session suivante
- Socket.io côté client (TOKEN_MOVED, SESSION_JOIN)
- socket.io-client absent de client/package.json — installer avant Socket.io
- Test deux comptes simultanés — isGm pas encore testé avec un vrai compte joueur

### Points de vigilance session suivante
- "La Forêt Maudite" sans default_battlemap_id — ne pas utiliser pour les tests
- Chat Socket.io — mapping champs : userId/username/text/timestamp → id/user/text/time
- keyPanSpeed = 20 — à ajuster en test si besoin

## Session 8 — 2026-04-03

### Contexte de reprise
Session 7 stable confirmée. Objectifs session 8 :
- Brancher Socket.io côté client (suite session 7)
- Implémenter les broadcasts manquants (TOKEN_CREATED, TOKEN_DELETED, CHARACTER_UPDATED)
- Ouvrir les actions token aux joueurs propriétaires
- Corriger l'alignement voxel/grille (bug découvert en session)

---

### Décisions prises

**Socket.io côté client — architecture état**
`socket` stocké dans `useState(null)` dans SessionPage — pas `useRef`.
Raison : `useRef` ne déclenche pas de re-render, Canvas3D recevrait `null` en permanence.
Pattern : `const s = io(...)` → handlers → `setSocket(s)` → cleanup `s.disconnect()`.
`socket` déclaré AVANT `handleCharacterDrop` dans le fichier — obligation car `handleCharacterDrop` l'utilise dans son dependency array.

**Ownership tokens — correction fondamentale**
La table `tokens` a une colonne `owner_id` — jamais renseignée en pratique.
L'ownership réel passe par `character_id → characters.user_id`.
Toute vérification d'ownership sur les tokens doit utiliser ce chemin.
Règle documentée : `token.character_id → db('characters').user_id === req.user.id`.
Applicable côté serveur REST (tokens.js) ET côté socket (socket/index.js).
**NON NÉGOCIABLE — ne jamais utiliser `token.owner_id`.**

**Broadcast TOKEN_CREATED**
Le GM place un token via drag depuis Sidebar → POST REST → token créé en base.
Sans broadcast, le joueur ne voit rien tant qu'il n'actualise pas.
Architecture retenue :
- Client émet `WS.TOKEN_CREATED { tokenId }` après le POST réussi
- Serveur relit le token en base (pour avoir toutes les colonnes) → broadcast `{ token }` à toute la room
- Tous les clients (y compris l'émetteur) écoutent `WS.TOKEN_CREATED` → ajout au tableau tokens si absent (guard doublon)

**Broadcast TOKEN_DELETED**
Deux déclencheurs côté client : touche Suppr (Canvas3D) et menu contextuel (SessionPage).
Architecture retenue :
- Client fait le DELETE REST → succès → émet `WS.TOKEN_DELETED { tokenId }` → met à jour état local
- Serveur reçoit `WS.TOKEN_DELETED { tokenId }` → broadcast à toute la room
- Tous les clients écoutent `WS.TOKEN_DELETED` → filtrent le token du tableau

**Broadcast CHARACTER_UPDATED**
Déclenché quand le GM change la visibilité d'un character ou son propriétaire.
Problème fetchSockets() : les remote sockets n'exposent pas les propriétés custom (`socket.role`).
Solution : `io.to(socket.campaignId).emit()` — broadcast à tous, version sans `gm_notes`.
Le GM a déjà la version complète via la réponse REST — pas besoin de lui envoyer `gm_notes` par socket.
Filtrage `gm_notes` obligatoire côté serveur avant le broadcast.
Côté client SessionPage : si le character existe → update, s'il n'existe pas → ajout (character nouvellement visible pour un joueur).

**Broadcast VOXEL_ADDED / VOXEL_REMOVED**
Canvas3D émettait déjà ces événements mais n'écoutait pas les broadcasts en retour.
Ajout d'un `useEffect` dans `Scene` qui écoute `WS.VOXEL_ADDED` et `WS.VOXEL_REMOVED`.
Cleanup propre avec `socket.off()` dans le return du useEffect.

**POST token ouvert aux joueurs**
La route était GM uniquement. Ouverture aux joueurs sous deux conditions strictes :
1. `character.user_id === req.user.id` — le joueur est propriétaire du character
2. Aucun token avec ce `character_id` n'existe déjà sur cette battlemap — contrainte doublon
Le GM reste libre de créer autant de tokens qu'il veut (pas de contrainte doublon pour le GM).

**DELETE token ouvert aux joueurs**
Même pattern que le POST et le PUT : ownership via `character_id → user_id`.

**Ownership drag Canvas3D**
`handleDragStart` bloque le drag si l'utilisateur n'est pas propriétaire du character lié au token.
Vérification : `characters.find(c => c.id === token.character_id)?.user_id === user?.id`.
`user` et `characters` passés comme props de SessionPage → Canvas3D → Scene.
Effet visuel : le token d'un autre joueur est visuellement non-draggable (aucune animation de drag ne se déclenche).

**Alignement voxel/grille — bug fondamental découvert session 8**
Origine : Three.js BoxGeometry a son origine au centre du cube.
Un cube à `position=[0,0,0]` s'étend de -0.5 à +0.5 sur chaque axe.
La grille drei/Grid a ses lignes aux coordonnées entières 0, 1, 2...
Résultat : les centres des cubes tombaient sur les intersections de grille — les cubes débordaient sur 4 cellules.

Correction retenue :
- `Voxel` : `position={[x+0.5, y+0.5, z+0.5]}` — décalage visuel uniquement, données en base inchangées
- `userData={{ isVoxel: true, position }}` conserve les coordonnées brutes pour le raycasting
- `Grid` : `position={[0, 0, 0]}` — lignes aux entiers = bords des cubes
- `TokenMesh` : `x = baseX + 0.5`, `z = baseZ + 0.5` — token centré dans sa cellule
- Pendant le drag : `dragState.x + 0.5`, `dragState.z + 0.5` — cohérence visuelle
- Y non décalé sur les tokens : `Y_OFFSET = 0.5` compense déjà l'origine au centre du cube

**Validation drop joueur — règle confirmée**
Session 5 avait établi : joueur Y 1-7 (voxel obligatoire sous les pieds, sol nu interdit).
Cette règle est maintenue. Elle signifie : `getColumnTopY(x, z) >= 1 && <= 7`.
Le joueur ne peut pas poser dans le vide ni sur un mur (hauteur maximale 8).

**PUT /characters/:id — owner_username dans la réponse**
Le `returning()` brut ne retourne pas `owner_username` (qui vient d'un JOIN users).
Correction : après le UPDATE, faire un SELECT avec LEFT JOIN users.
La réponse REST retourne maintenant le character complet avec `owner_username`.
Impact : cohérence entre la réponse REST et ce que `handleToggleVisible` attend côté Sidebar.

**campaigns.js GET /:id — ouvert aux membres**
La route était restreinte aux GM. Ouverte à tous les membres de la campagne.
Raison : SessionPage en a besoin pour charger `campaign.members` et calculer `isGm`.

**Leçon apprise — fetchSockets() et propriétés custom**
`io.in(room).fetchSockets()` retourne des remote socket adapters.
Ces objets n'exposent que `id`, `handshake`, `rooms`, `data` — pas les propriétés custom comme `socket.role`.
Pour partager des données via fetchSockets, utiliser `socket.data.xxx` (pas `socket.xxx`).
Dans notre cas : `socket.role` est inaccessible sur les remote sockets.
Solution : broadcaster à tous via `io.to()` et filtrer le contenu (ex: retirer `gm_notes`) plutôt que filtrer les destinataires.

**Leçon apprise — dependency arrays useCallback**
`socket` utilisé dans un callback doit être dans son dependency array.
Sinon la closure capture `null` (valeur au montage) et `socket?.emit()` ne fait rien.
Cas identifiés et corrigés : `handleContextMenuDelete` (SessionPage), `handleKeyDown` (Canvas3D), `handleCharacterDrop` (SessionPage).

**Leçon apprise — ordre de déclaration React**
Un `useState` doit être déclaré avant tout `useCallback` qui l'utilise dans son dependency array.
`const [socket, setSocket] = useState(null)` doit précéder `handleCharacterDrop` dans SessionPage.
Violation = `ReferenceError: can't access lexical declaration before initialization`.

---

### Fichiers modifiés session 8

**shared/events.js**
- Ajout `CHARACTER_UPDATED: 'character:updated'`

**server/src/socket/index.js**
- `TOKEN_MOVE` : correction ownership — `token.character_id → characters.user_id` (plus `token.owner_id`)
- `TOKEN_CREATED` : nouveau handler — relit token en base → broadcast `{ token }` à toute la room
- `TOKEN_DELETED` : nouveau handler — broadcast `{ tokenId }` à toute la room
- `CHARACTER_UPDATED` : nouveau handler — relit character avec LEFT JOIN users → broadcast `characterPublic` (sans gm_notes) via `io.to()`

**server/src/routes/tokens.js**
- `POST /battlemaps/:id/tokens` : ouvert aux joueurs propriétaires + contrainte doublon
- `PUT /tokens/:id` : ownership via `character_id → user_id` (plus `owner_id`)
- `DELETE /tokens/:id` : ouvert aux joueurs propriétaires (même pattern que PUT)

**server/src/routes/characters.js**
- `PUT /characters/:id` : `returning()` remplacé par SELECT avec LEFT JOIN users → retourne `owner_username`

**server/src/routes/campaigns.js**
- `GET /campaigns/:id` : ouvert à tous les membres (plus GM uniquement)

**client/src/components/Canvas3D.jsx**
- `Scene` : useEffect écoute `WS.VOXEL_ADDED` / `WS.VOXEL_REMOVED` → update `voxels` state
- `Scene` : props `user` et `characters` ajoutées
- `handleDragStart` : vérification ownership — bloque si pas propriétaire et pas GM
- `handleDragStart` : dependency array `[isGm, user, characters]`
- `handleKeyDown` : `socket?.emit(WS.TOKEN_DELETED, { tokenId })` après DELETE + `socket` dans dependency array
- `TokenMesh` : `x = baseX + 0.5`, `z = baseZ + 0.5` (au repos) et `dragState.x + 0.5`, `dragState.z + 0.5` (drag)
- `Voxel` : `position={[x+0.5, y+0.5, z+0.5]}` — alignement grille
- `Grid` : `position={[0, 0, 0]}`
- `Canvas3D` : props `user` et `characters` ajoutées, transmises à `Scene`

**client/src/pages/SessionPage.jsx**
- `const [socket, setSocket] = useState(null)` déplacé AVANT `handleCharacterDrop`
- `const [members, setMembers] = useState([])` ajouté
- `const [messages, setMessages] = useState([])` ajouté
- `setMembers(members)` ajouté dans le useEffect de chargement
- `handleCharacterDrop` : `socket?.emit(WS.TOKEN_CREATED, { tokenId })` après POST + `socket` dans dependency array
- `handleContextMenuDelete` : `socket?.emit(WS.TOKEN_DELETED, { tokenId })` après DELETE + `socket` dans dependency array
- Socket useEffect : écoute TOKEN_CREATED, TOKEN_DELETED, CHAT_MESSAGE, CHARACTER_UPDATED
- `user` et `characters` passés à Canvas3D
- `messages`, `socket`, `campaignMembers={members}` passés à Sidebar

**client/src/components/Sidebar.jsx**
- Import `WS` depuis `shared/events.js`
- Props ajoutées : `messages`, `socket`, `campaignMembers`
- État local `messages` supprimé — contrôlé par SessionPage
- `sendMessage` : `socket?.emit(WS.CHAT_MESSAGE, { text })` — plus de setState local
- `handleToggleVisible` : `socket?.emit(WS.CHARACTER_UPDATED, { characterId })` après PUT
- `CharacterModal` : props `socket` et `campaignMembers` ajoutées
- Onglet Paramètres : liste déroulante assignation joueur (filtrée `role === 'player'`)
- Assignation `user_id` via liste déroulante : `socket?.emit(WS.CHARACTER_UPDATED, { characterId })` après PUT
- Style `select` ajouté dans l'objet styles

---

### État fonctionnel vérifié en fin de session 8

- Socket.io connexion GM + joueur simultanés ✅
- TOKEN_MOVED : déplacement GM → joueur voit en temps réel ✅
- TOKEN_MOVED : déplacement joueur (son token) → GM voit en temps réel ✅
- TOKEN_CREATED : GM place token → joueur voit apparaître sans F5 ✅
- TOKEN_DELETED : GM supprime (Suppr ou menu) → joueur voit disparaître ✅
- TOKEN_DELETED : joueur supprime son token (menu) → broadcasté ✅
- CHAT_MESSAGE : chat fonctionnel dans les deux sens ✅
- CHARACTER_UPDATED : GM rend visible → joueur voit dans sa liste ✅
- CHARACTER_UPDATED : GM assigne character à joueur → mis à jour sans F5 ✅
- Joueur ne peut pas drag un token qui ne lui appartient pas ✅
- Joueur importe son token (drag depuis Sidebar) → une seule fois, doublon refusé ✅
- Voxels alignés dans les cellules de la grille ✅
- Tokens centrés dans les cellules de la grille ✅
- Drag token pendant déplacement → visuellement aligné ✅
- VOXEL_ADDED/REMOVED : GM pose/efface voxel → joueur voit en temps réel ✅

### Non résolu / points de vigilance session 9

**BUG PRIORITAIRE — Validation Y drop joueur cassée par le décalage voxel**
`getColumnTopY` retourne la coordonnée Y brute du voxel en base (entier).
Le décalage visuel +0.5 est uniquement dans le rendu — les données restent inchangées.
Avec la correction d'alignement, un voxel à Y=0 (sol) est visuellement à 0.5 mais `getColumnTopY` retourne 0.
La condition `snappedY >= 1` bloque donc tout drop joueur sur une carte avec un seul niveau de voxels (Y=0).
**Correction à faire en session 9 :** revoir la logique de validation Y pour qu'elle reflète
la présence d'un voxel dans la colonne, pas sa valeur Y absolue.
Piste : `getColumnTopY(x,z) >= 0` (voxel présent) && `getColumnTopY(x,z) <= 7` (pas un mur).

- "La Forêt Maudite" sans default_battlemap_id — ne jamais utiliser pour les tests
- Dette i18n : DashboardPage (chaînes en anglais)
- CLIENT_URL + VITE_API_URL dans .env à reconfigurer sur Raspberry Pi
## Session 9 — 2026-04-04

### Contexte de reprise
Session 8 stable confirmée. Bug prioritaire : validation Y drop joueur (getColumnTopY).

---

### Travail effectué

**BUG — getColumnTopY (Canvas3D.jsx)**
`getColumnTopY` retournait 0 pour colonne vide ET pour voxel à Y=0 — ambiguïté.
Correction : retourner `maxY` brut (-1 si vide, ≥0 si voxel trouvé).
Pendant le drag : `Math.max(0, columnY) + DRAG_HOVER` pour éviter altitude négative.
Validation drop joueur : `minY = isGm ? -1 : 0` / `maxY = isGm ? 8 : 7`.
Bug résolu — joueur peut poser sur voxels Y=0.

**Dashboard i18n (DashboardPage.jsx + fr.json)**
Toutes les chaînes en anglais en dur remplacées par clés i18next.
Namespace `dashboard` complété : joinWithCode, create, join, roleGM, rolePlayer, errorLoad, errorCreate, errorJoin.
"Enclume" (nom propre) conservé en dur — pas traduit.

**Route PUT /api/users/me (users.js)**
Nouveau fichier server/src/routes/users.js.
Champs : username, email, color, password (+ current_password requis).
Validation couleur hex `/^#[0-9A-Fa-f]{6}$/`.
Si username ou email change : JWT régénéré dans le cookie (sinon socket.user.username reste l'ancien).
Monté sous /api/users dans index.js.

**Menu profil utilisateur (DashboardPage.jsx)**
Modale position fixed déclenchée par clic sur username dans le header.
`handleProfileSave` : diff vs user actuel → envoie seulement les champs modifiés.
`setUser(res.data.user)` → authStore mis à jour immédiatement.
Namespace i18n `profile` créé dans fr.json.

**Barre GM supérieure (SessionPage.jsx)**
Liste des battlemaps chargée au montage via GET /campaigns/:id/battlemaps.
Clic simple = GM prévisualise (charge localement sans déplacer joueurs).
Écoute WS.MAP_SWITCH côté client — joueurs + GM chargent la nouvelle carte.
Séparation clic simple / Déplacer le groupe (menu contextuel).

**Menu contextuel barre GM (SessionPage.jsx + campaigns.js + battlemaps.js)**
Clic droit sur bouton carte → menu HTML position fixed.
Actions : Renommer, Définir page d'accueil, Déplacer le groupe, Dupliquer, Supprimer, Nouvelle carte.
campaigns.js PUT /:id : ajout default_battlemap_id dans les updates.
battlemaps.js : ajout POST /:id/duplicate.
Bug duplicate : voxel_data doit être JSON.stringify() avant INSERT (Knex ne sérialise pas si déjà objet JS).

**Onglet Joueurs Sidebar (Sidebar.jsx + SessionPage.jsx + socket/index.js)**
Liste membres avec badge MJ/Joueur, indicateur en ligne (point vert/gris).
Nom du personnage associé calculé côté client depuis `characters`.
Présence en ligne : SESSION_JOINED inclut désormais `onlineUserIds` (liste des connectés).
Correction : `socket.data.userId` stocké au SESSION_JOIN (accessible via fetchSockets(), contrairement à socket.user).

**Onglet Config Sidebar (Sidebar.jsx)**
Username + color picker, sauvegarde via PUT /users/me.
Reconnexion socket via pattern `reconnectTrigger` dans SessionPage (ne jamais appeler socket.disconnect/connect depuis Sidebar).
Namespace i18n sidebar complété.

**Chat amélioré (Sidebar.jsx + SessionPage.jsx + socket/index.js)**
Nom affiché en couleur du compte (color lue depuis DB dans handler CHAT_MESSAGE).
Messages système connexion/déconnexion dans le fil (SESSION_USER_JOINED/LEFT → `{ system: true }`).
Fix username chat : JWT régénéré + reconnectTrigger force nouveau socket avec nouveau JWT.

**Altitude tokens 3D (Canvas3D.jsx)**
Tokens avaient les pieds dans les voxels.
Cause : groupe à `baseY`, modèle à `Y_OFFSET=0.5` dans le groupe → pieds à Y=0.5 au lieu de Y=1.0.
Correction : groupe à `baseY + 0.5`, modèle à `Y_OFFSET=0.5` → pieds à Y=1.0 = dessus du voxel Y=0.
Pendant drag : `columnY + 0.5 + DRAG_HOVER`.

---

### Décisions prises

**Dés — spec validée pour session 10**
1. Fenêtre Paramètres campagne (Dashboard) — configurer seuils critiques par dé
2. Parser formule : `NdX+M`, `NdX-M`, `NdX` — calcul serveur uniquement
3. Jet privé au MJ (whisper) — payload `{ to: 'gm' }`, broadcast émetteur + GMs uniquement
4. Interface dés flottante au-dessus du canvas

**reconnectTrigger pattern — NON NÉGOCIABLE**
Sidebar ne possède pas le socket. SessionPage gère le cycle de vie.
Reconnexion = `setReconnectTrigger(n => n + 1)` dans SessionPage.
Le cleanup du useEffect socket (`return () => s.disconnect()`) gère la déconnexion propre.

**color dans CHAT_MESSAGE**
Lue depuis DB à chaque message (pas dans le JWT).
Serveur : `await db('users').where({ id: socket.user.id }).select('color').first()`

---

### Fichiers créés/modifiés session 9

**Nouveaux fichiers :**
- server/src/routes/users.js — PUT /api/users/me

**Fichiers modifiés :**
- client/src/components/Canvas3D.jsx — getColumnTopY, altitude tokens, drag hover
- client/src/components/Sidebar.jsx — onglet Joueurs, onglet Config, chat couleur/système, reconnectTrigger
- client/src/pages/SessionPage.jsx — barre GM, menu clic droit cartes, onglet joueurs, reconnectTrigger, messages système
- client/src/locales/fr.json — namespaces dashboard, profile, sidebar complétés
- server/src/routes/campaigns.js — PUT /:id accepte default_battlemap_id
- server/src/routes/battlemaps.js — POST /:id/duplicate
- server/src/routes/index.js — montage /api/users
- server/src/socket/index.js — SESSION_JOIN (onlineUserIds), CHAT_MESSAGE (color), socket.data.userId
- docs/SYSTEME.md — §11 à §21 ajoutés
- docs/ROADMAP.md — mise à jour complète session 9

---

### État fonctionnel vérifié en fin de session 9

- Bug Y drop joueur corrigé ✅
- Dashboard i18n complet ✅
- PUT /api/users/me fonctionnel (username, email, color, password) ✅
- Modale profil Dashboard ✅
- Barre GM supérieure — liste cartes, clic prévisualise ✅
- Menu clic droit barre GM — renommer, page d'accueil, déplacer groupe, dupliquer, supprimer, nouvelle carte ✅
- Onglet Joueurs Sidebar — présence en ligne temps réel ✅
- Onglet Config Sidebar — username + couleur ✅
- Chat — nom en couleur, messages système connexion/déconnexion ✅
- Altitude tokens 3D corrigée — pieds sur les voxels ✅

### Points de vigilance session 10

- **reconnectTrigger** — ne jamais gérer socket.disconnect/connect dans Sidebar
- **voxel_data duplicate** — toujours JSON.stringify() avant INSERT
- **socket.data.userId** — stocker au SESSION_JOIN pour fetchSockets()
- **JWT régénéré** — si username/email change dans PUT /users/me
- **"La Forêt Maudite"** — pas de default_battlemap_id, ne jamais utiliser pour les tests
- **Calque GM** — tokens layer='gm' non encore filtrés côté client (tâche suivante)

## Session 10 — 2026-04-05

### Contexte de reprise
Session 9 stable confirmée. Analyse critique externe reçue et traitée avant tout développement.
Décisions architecturales prises en début de session — à intégrer dans ARCHITECTURE.md, CONVENTIONS.md, EN_COURS.md après validation fonctionnelle.

---

### Décisions prises — à intégrer dans la doc (tampon)

**A — Règles character/token (→ ARCHITECTURE.md)**

Un character appartient à une campagne. Il est la source de vérité pour :
qui contrôle, qui peut modifier, portrait, token 3D, token 2D, textes.
Exception : `gm_notes` visible GM uniquement.

Un token est la présence d'un character sur une battlemap.
Il hérite de toutes les permissions de son character parent.
Il n'a pas de droits propres.

Règles de cycle de vie :
- Map supprimée → tokens supprimés (CASCADE en base — déjà implémenté)
- Map dupliquée → tokens NON dupliqués (comportement actuel, validé)
- Character supprimé → tokens supprimés (CASCADE en base — déjà implémenté)
- Token supprimé → rien (SET NULL sur character_id — déjà en base)

**B — Règle Three.js (→ ARCHITECTURE.md + CONVENTIONS.md)**

Ne jamais stocker d'objets Three.js dans le state React.
Géométries et matériaux réutilisés → `useMemo`.
Raison : bugs impossibles à reproduire (uniquement après N minutes, N changements de map).

**C — Dette validation dupliquée (→ CONVENTIONS.md)**

Certaines règles métier sont vérifiées à la fois côté client et côté serveur
(exemple : voxel obligatoire sous le token pour les joueurs).
Risque : une règle changée à un endroit sera oubliée ailleurs.
Règle à suivre : toute règle métier critique doit être vérifiée côté serveur.
Le client peut la vérifier aussi pour l'UX, mais le serveur est la source de vérité.
Si on modifie une règle → chercher TOUTES les occurrences (client + serveur + socket).

**D — Reconnexion socket (→ EN_COURS.md)**

Si un joueur perd la connexion, son state local peut être faux (events manqués).
Solution retenue : full reload à la reconnexion.
À implémenter : handler `reconnect` côté socket.io-client →
  GET /campaigns/:id + GET /battlemaps/:id + GET /tokens → reset complet du state.
Simple, robuste, adapté à 4-8 joueurs sur LAN.
PAS de sync incrémentale, PAS d'event history — overkill pour ce projet.

**E — Timestamps (→ migration 19)**

Ajouter `updated_at` sur la table `tokens` (minimum).
Raison : filet de sécurité pour les race conditions futures + diagnostic plus facile.
Migration légère, pas de changement logique.

**F — Refactor SessionPage → stores Zustand (→ ROADMAP.md)**

SessionPage concentre trop de responsabilités (state, socket, logique métier, props drilling).
Solution à terme : stores Zustand par domaine.
Proposition :
  sessionStore.js  — socket, onlineUsers, reconnectTrigger, messages
  mapStore.js      — battlemap, battlemaps, voxels
  tokenStore.js    — tokens
  characterStore.js — characters, members
SessionPage devient un orchestrateur léger.
Canvas3D et Sidebar lisent les stores directement au lieu de recevoir des props.
À faire APRÈS que les features prioritaires soient stables — pas maintenant.

**G — Ordre des sessions révisé**

Session 10 : Timestamps (migration 19) + Reconnexion full reload
Session 11 : Dés (étapes A→E, spec EN_COURS.md)
Session 12 : Refactor SessionPage → stores Zustand
Session 13 : Tests routes serveur critiques (ownership, permissions, contrainte doublon)

**H — Tests visuels manuels**

À faire par l'utilisateur : deux navigateurs simultanés (GM + joueur), scénarios critiques.
Résultats à noter dans EN_COURS.md section "Tests manuels effectués".

---

### Fonctionnalité développée cette session
(à compléter après développement)

## Session 10 — 2026-04-05 (suite)

### Décisions prises — timestamps (à intégrer dans ARCHITECTURE.md + migrations)

**Périmètre complet acté — migration 19**

Une seule migration couvre toutes les tables existantes.
Pattern : `created_at` + `updated_at` sauf exceptions notées.

| Table | created_at | updated_at | Justification |
|---|---|---|---|
| tokens | ✅ | ✅ | Déplacement temps réel — updated_at permet d'ignorer events obsolètes |
| battlemaps | ✅ | ✅ | Savoir quelle version un joueur a chargée |
| characters | ✅ | ✅ | Cohérence broadcast CHARACTER_UPDATED |
| campaigns | ✅ | ✅ | Cohérence générale |
| users | ✅ | ✅ | Utile si profil change pendant session active |
| campaign_members | ✅ | ❌ | joined_at suffit, updated_at sans valeur métier aujourd'hui |
| dice_rolls | ✅ | ❌ | Un jet ne se modifie pas |
| player_locations | ❌ | ✅ | Position courante — updated_at uniquement |
| walls | ✅ | ✅ | Cohérence future |
| zones | ✅ | ✅ | Cohérence future |
| documents | ✅ | ✅ | Phase 3 — prévoir maintenant |

Pattern Knex :
```javascript
table.timestamp('created_at').defaultTo(knex.fn.now())
table.timestamp('updated_at').defaultTo(knex.fn.now())
```

**Modifications routes requises après migration :**
Chaque PUT en base doit ajouter `updated_at = db.fn.now()` dans l'objet updates.
Fichiers concernés : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js.

**Autocritique documentée :**
Ma proposition initiale (tokens uniquement) était insuffisante.
Cause : raisonnement "faisable rapidement" au lieu de "ce dont le projet a besoin".
Question correcte à poser : "Quels objets changent d'état et ont besoin de traçabilité ?"
Ne pas reproduire cette erreur — analyse complète avant proposition.

---

### Sujet voxels — analyse en cours (décision non encore prise)

**Problème identifié :**
Format actuel `voxel_data` : tableau `[{x, y, z, mat}]` stocké en JSONB.
- Sauvegarde en base = réécriture complète du tableau à chaque modification
- Lookup = O(n) pour trouver un voxel
- Pas de diff possible sans reconstruire le tableau complet

**Ce qui fonctionne déjà bien :**
Les événements socket VOXEL_ADD / VOXEL_REMOVE envoient déjà des diffs unitaires.
Le problème est la persistance en base, pas le transport socket.

**Limite documentée dans ARCHITECTURE.md :**
"Au-delà de ~3000 cubes visibles, optimisation nécessaire."
Décision : changer MAINTENANT, avant que des cartes soient créées avec l'ancien format.

**Options analysées :**
- Option A — chunks : complexe, utile seulement à très grande échelle
- Option B — clé compressée `"x:y:z": mat` : lookup O(1), diff trivial, payload compact
- Option C — binaire : overkill pour ce projet

**Option B retenue comme candidate :**
```javascript
// Avant
[{ x: 12, y: 4, z: 2, mat: 3 }, ...]

// Après
{ "12:4:2": 3, "13:4:2": 1 }
```

**Impact du changement :**
- Migration : altération du champ voxel_data (données existantes à convertir)
- Serveur : routes battlemaps.js (lecture/écriture voxel_data)
- Serveur : socket/index.js (handlers VOXEL_ADD / VOXEL_REMOVE)
- Client : Canvas3D.jsx (lecture voxels, éditeur, raycasting)

**Questions ouvertes — à trancher avant de coder :**
1. Valeur 0 ou absence de clé pour "pas de voxel" ? → absence de clé (plus propre)
2. Suppression d'un voxel = `delete obj["x:y:z"]` → trivial
3. Données existantes en base : y a-t-il des battlemaps avec des voxels réels à migrer ?
   Si oui, script de conversion dans la migration up().
   Si non (projet en dev, cartes vides ou de test), migration up() repart de zéro.

**À décider ensemble avant de coder le sujet voxels.**

## Session 11 — 2026-04-05

### Contexte de reprise
Session 10 stable confirmée (décisions architecturales + MISSION files rédigés, aucun code).
Ordre d'exécution confirmé : les MISSION files font foi, pas la décision G du JOURNAL session 10.
Chantier 1 exécuté en session 11.

---

### Chantier 1 — Serveur seul émetteur WS ✅

**Principe :**
Le client ne broadcast plus jamais après un appel REST.
Le serveur broadcast après chaque écriture en base via `req.app.get('io')`.

**Infrastructure ajoutée :**
`app.set('io', io)` dans `server/src/index.js` — placé après création de `io`, avant `initSocket`.
Permet aux routes Express d'accéder à `io` via `req.app.get('io')` sans import circulaire.

**Broadcasts ajoutés côté serveur :**
- `tokens.js POST /` → `TOKEN_CREATED { token }` après INSERT
- `tokens.js PUT /:id` → `TOKEN_MOVED { tokenId, pos_x, pos_y, pos_z }` après UPDATE
- `tokens.js DELETE /:id` → `TOKEN_DELETED { tokenId }` après DELETE
- `characters.js actionsRouter PUT /:id` → `CHARACTER_UPDATED` (sans gm_notes) après UPDATE + SELECT

**Emit post-REST supprimés côté client :**
- `SessionPage.jsx handleCharacterDrop` — suppression `socket?.emit(WS.TOKEN_CREATED, ...)`
- `SessionPage.jsx handleContextMenuDelete` — suppression `socket?.emit(WS.TOKEN_DELETED, ...)`
- `Canvas3D.jsx handlePointerUp` — suppression `socket?.emit(WS.TOKEN_MOVE, ...)`
- `Canvas3D.jsx handleKeyDown` — suppression `socket?.emit(WS.TOKEN_DELETED, ...)`
- `Sidebar.jsx handleToggleVisible` — suppression `socket?.emit(WS.CHARACTER_UPDATED, ...)`
- `Sidebar.jsx onChange select assignation` — suppression `socket?.emit(WS.CHARACTER_UPDATED, ...)`

**Emit conservés côté client (commandes, pas broadcasts post-REST) :**
- `MAP_SWITCH` dans SessionPage — commande GM volontaire
- `VOXEL_ADD` / `VOXEL_REMOVE` dans Canvas3D — édition temps réel socket
- `CHAT_MESSAGE` dans Sidebar — pas un post-REST

**Dependency arrays nettoyés :**
- `handlePointerUp` — `socket` retiré (n'émet plus)
- `handleKeyDown` — `socket` retiré (n'émet plus)
- `handleToggleVisible` — `socket` retiré (n'émet plus)
- `handleCharacterDrop` — `socket` retiré (n'émet plus)

**Handlers socket/index.js conservés en l'état** (TOKEN_MOVE, TOKEN_CREATED, TOKEN_DELETED,
CHARACTER_UPDATED) — double broadcast bénin pendant la période de transition.
À nettoyer dans un chantier dédié après validation complète.

---

### Validation fonctionnelle Chantier 1

- ✅ GM déplace token → joueur voit en temps réel
- ✅ Joueur déplace son token → GM voit en temps réel
- ✅ GM crée token (drag Sidebar) → joueur voit apparaître
- ✅ GM supprime token (menu ou Suppr) → joueur voit disparaître
- ✅ SR sans erreur
- ❌ GM toggle visible character → joueur ne voit pas (bug préexistant — voir ci-dessous)

---

### Bugs identifiés cette session

**Bug 1 — Toggle visible character non répercuté en temps réel (préexistant)**
Comportement : le broadcast CHARACTER_UPDATED arrive bien côté client.
SessionPage met à jour `characters` correctement.
Mais les tokens sur la carte dépendent de `tokens`, pas de `characters`.
Aucun filtre ne retire/ajoute les tokens en fonction de `character.visible` après un broadcast.
Le filtrage existe côté serveur au chargement initial (GET /battlemaps/:id filtre par rôle),
mais pas en temps réel après un toggle.
Confirmé préexistant — non introduit par le Chantier 1.
**À corriger dans le Chantier 8 (Calque GM).**

**Bug 2 — VOXEL_ADD error: Undefined binding(s) detected (préexistant)**
Message nodemon : `[WS] voxel:add error: Undefined binding(s) detected when compiling FIRST. Undefined column(s): [id]`
Cause probable : `battlemapId` est `undefined` dans le payload VOXEL_ADD.
`battlemapId` vient de la prop `battlemapId={battlemap?.id}` passée à Scene depuis Canvas3D.
Si `battlemap` est null entre deux chargements de carte, `battlemapId` est `undefined`.
Le handler socket/index.js tente alors `db('battlemaps').where({ id: undefined })` → erreur Knex.
Non introduit par le Chantier 1 — handler socket/index.js non modifié.
**À corriger dans un chantier dédié : guard `if (!battlemapId) return` dans le handler VOXEL_ADD.**

---

### Fichiers modifiés session 11

- `server/src/index.js` — `app.set('io', io)`
- `server/src/routes/tokens.js` — broadcasts POST + PUT + DELETE + import WS
- `server/src/routes/characters.js` — broadcast PUT actionsRouter + import WS
- `client/src/pages/SessionPage.jsx` — suppression emit TOKEN_CREATED + TOKEN_DELETED
- `client/src/components/Canvas3D.jsx` — suppression emit TOKEN_MOVE + TOKEN_DELETED
- `client/src/components/Sidebar.jsx` — suppression emit CHARACTER_UPDATED (×2)

---

### Points de vigilance session suivante (Chantier 2)

- Uploader les nouvelles versions de tokens.js et characters.js (modifiés en session 11)
- Migration 19 : nouveaux fichiers à créer (pattern migration 18 comme référence)
- Routes à modifier pour `updated_at` : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js
- SessionPage.jsx : reconnexion full reload (`loadSession` en useCallback + handler `reconnect` socket)
- L'ordre de déclaration React reste critique : `loadSession` doit être déclaré AVANT le useEffect socket

## Session 12 — 2026-04-05

### Contexte de reprise
Chantier 1 ✅ (session 11). Chantier 2 commence cette session.
Rappel : les MISSION files font foi sur la décision G du JOURNAL session 10.

### Plan d'exécution validé — Chantier 2 + Chantier 4

**Chantier 2 — Timestamps**

Partie A — Migration 19 (`20260405_19_timestamps.js`)
alterTable sur 10 tables. player_locations exclue (colonnes déjà présentes migration 10).
walls et zones : updated_at seulement (created_at déjà présent migration 10).
Pattern : .nullable() sans backfill — données de test, base effaçable.

Partie B — updated_at dans les routes PUT
Fichiers : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js.
`updates.updated_at = db.fn.now()` dans chaque PUT.
returning explicites (campaigns, users) : ajouter 'updated_at' — robustesse Chantier 5.
battlemaps PUT /:id/voxels : updated_at dans l'update (pas de returning nécessaire).
characters.js re-SELECT : ajouter 'characters.updated_at' dans les colonnes.

Partie C — updated_at dans les payloads WS
TOKEN_MOVED payload : ajouter updated_at.
TOKEN_CREATED : automatique via returning('*').
CHARACTER_UPDATED : via re-SELECT étendu (Partie B).
socket/index.js TOKEN_MOVE handler : update avec returning('*') + updated_at dans broadcast.
SessionPage.jsx TOKEN_MOVED handler : ignorer si payload.updated_at < local updated_at.

Bug B corrigé dans socket/index.js : guard `if (!battlemapId) return` dans VOXEL_ADD.

**Chantier 4 — Reconnexion full reload**
SessionPage.jsx : extraire load() en useCallback loadSession.
Déclaré après reconnectTrigger (l.87), avant handleMapSwitch (l.91).
useEffect chargement initial → useEffect(() => { loadSession() }, [loadSession]).
useEffect socket → s.on('reconnect', () => loadSession()) + loadSession dans deps.

**Ordre d'exécution**
1. Migration 19 + knex migrate:latest
2. socket/index.js (Bug B + TOKEN_MOVE)
3. tokens.js (Partie B + C)
4. characters.js (Partie B + C)
5. campaigns.js (Partie B)
6. battlemaps.js (Partie B)
7. users.js (Partie B)
8. SessionPage.jsx (Partie C + Chantier 4)

### Fichiers modifiés cette session
(à compléter après validation fonctionnelle)


## Session 12 — 2026-04-05

### Contexte de reprise
Chantier 1 ✅ (session 11). Chantier 2 + Chantier 4 exécutés cette session.
Rappel : les MISSION files font foi sur la décision G du JOURNAL session 10.

---

### Chantier 2 — Timestamps + updated_at dans les payloads ✅

**Partie A — Migration 19 (`20260405_19_timestamps.js`)**

Vérification complète de toutes les migrations 01→18 avant d'écrire la migration.
Résultat : la plupart des tables avaient déjà created_at + updated_at via `table.timestamps(true, true)`.

Colonnes réellement ajoutées (seulement ce qui manquait) :
- `tokens` — created_at + updated_at (migration 05 n'avait aucun timestamp)
- `characters` — updated_at seulement (created_at présent migration 15)
- `walls` — updated_at seulement (created_at présent migration 10)
- `zones` — updated_at seulement (created_at présent migration 10)
- `player_locations` — created_at seulement (updated_at présent migration 10)

Tables non touchées (colonnes déjà présentes) :
users, campaigns, campaign_members, battlemaps, documents, dice_rolls.

Pattern : `.nullable()` sans backfill — données de test, base effaçable.
down() : ordre inverse strict du up().

**Partie B — updated_at dans les routes PUT**

5 fichiers modifiés. Pattern uniforme : `updates.updated_at = db.fn.now()` après
construction de l'objet updates, avant le `.update(updates)`.
Placé après le guard `Object.keys(updates).length === 0` dans characters.js et tokens.js
— updated_at seul ne peut jamais déclencher un update vide.

returning explicites complétés :
- campaigns.js PUT /:id → 'updated_at' ajouté dans .returning([...])
- users.js PUT /me → 'updated_at' ajouté dans .returning([...]) — pas dans le JWT

battlemaps.js PUT /:id/voxels : updated_at ajouté dans l'objet update inline
(pas de .returning sur cette route).

**Partie C — updated_at dans les payloads WS**

tokens.js PUT /:id — TOKEN_MOVED payload : { tokenId, pos_x, pos_y, pos_z, updated_at }
characters.js actionsRouter PUT /:id — re-SELECT étendu avec 'characters.updated_at'
→ characterPublic le porte via destructuring spread.
TOKEN_CREATED : automatique via returning('*').

socket/index.js TOKEN_MOVE handler :
- update avec .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'updated_at'])
- broadcast TOKEN_MOVED inclut updated_at: updated.updated_at

SessionPage.jsx handler TOKEN_MOVED :
- destructure updated_at depuis le payload
- guard : if (updated_at && t.updated_at && updated_at < t.updated_at) return t
- met à jour updated_at dans l'état local du token

**Bug B corrigé — VOXEL_ADD guard**
socket/index.js : `if (!battlemapId) return` en tête du handler VOXEL_ADD.

---

### Chantier 4 — Reconnexion full reload ✅

SessionPage.jsx :
- `load()` extraite en `useCallback loadSession` — déclaré AVANT useState socket (ligne ~47)
- `useEffect(() => { loadSession() }, [loadSession])` remplace l'ancien useEffect de chargement
- `s.on('reconnect', () => loadSession())` ajouté dans le useEffect socket
- dependency array useEffect socket : `[campaignId, reconnectTrigger, loadSession]`

Ordre React respecté : loadSession déclaré avant tout useCallback qui l'utilise.

---

### Fichiers modifiés session 12

- `server/src/db/migrations/20260405_19_timestamps.js` — nouveau fichier
- `server/src/socket/index.js` — TOKEN_MOVE updated_at + Bug B VOXEL_ADD guard
- `server/src/routes/tokens.js` — updated_at PUT + TOKEN_MOVED payload
- `server/src/routes/characters.js` — updated_at PUT + re-SELECT updated_at + CHARACTER_UPDATED payload
- `server/src/routes/campaigns.js` — updated_at PUT + returning étendu
- `server/src/routes/battlemaps.js` — updated_at PUT /:id + PUT /:id/voxels
- `server/src/routes/users.js` — updated_at PUT + returning étendu
- `client/src/pages/SessionPage.jsx` — loadSession useCallback + TOKEN_MOVED guard + reconnect

### Validation fonctionnelle attendue
- SR sans erreur après knex migrate:latest
- GM déplace token → joueur voit en temps réel (inchangé)
- Reconnexion réseau → session rechargée automatiquement
- Pas de régression sur les fonctionnalités session 11

## Session 12 — 2026-04-05

### Contexte de reprise
Chantier 1 ✅ (session 11). Chantier 2 + Chantier 4 exécutés cette session.
Rappel : les MISSION files font foi sur la décision G du JOURNAL session 10.

---

### Chantier 2 — Timestamps + updated_at dans les payloads ✅

**Partie A — Migration 19 (`20260405_19_timestamps.js`)**

Vérification complète de toutes les migrations 01→18 avant d'écrire la migration.
Résultat : la plupart des tables avaient déjà created_at + updated_at via `table.timestamps(true, true)`.

Colonnes réellement ajoutées (seulement ce qui manquait) :
- `tokens` — created_at + updated_at (migration 05 n'avait aucun timestamp)
- `characters` — updated_at seulement (created_at présent migration 15)
- `walls` — updated_at seulement (created_at présent migration 10)
- `zones` — updated_at seulement (created_at présent migration 10)
- `player_locations` — created_at seulement (updated_at présent migration 10)

Tables non touchées (colonnes déjà présentes) :
users, campaigns, campaign_members, battlemaps, documents, dice_rolls.

Pattern : `.nullable()` sans backfill — données de test, base effaçable.
down() : ordre inverse strict du up().

**Partie B — updated_at dans les routes PUT**

5 fichiers modifiés. Pattern uniforme : `updates.updated_at = db.fn.now()` après
construction de l'objet updates, avant le `.update(updates)`.
Placé après le guard `Object.keys(updates).length === 0` dans characters.js et tokens.js
— updated_at seul ne peut jamais déclencher un update vide.

returning explicites complétés :
- campaigns.js PUT /:id → 'updated_at' ajouté dans .returning([...])
- users.js PUT /me → 'updated_at' ajouté dans .returning([...]) — pas dans le JWT

battlemaps.js PUT /:id/voxels : updated_at ajouté dans l'objet update inline
(pas de .returning sur cette route).

**Partie C — updated_at dans les payloads WS**

tokens.js PUT /:id — TOKEN_MOVED payload : { tokenId, pos_x, pos_y, pos_z, updated_at }
characters.js actionsRouter PUT /:id — re-SELECT étendu avec 'characters.updated_at'
→ characterPublic le porte via destructuring spread.
TOKEN_CREATED : automatique via returning('*').

socket/index.js TOKEN_MOVE handler :
- update avec .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'updated_at'])
- broadcast TOKEN_MOVED inclut updated_at: updated.updated_at

SessionPage.jsx handler TOKEN_MOVED :
- destructure updated_at depuis le payload
- guard : if (updated_at && t.updated_at && updated_at < t.updated_at) return t
- met à jour updated_at dans l'état local du token

**Bug B corrigé — VOXEL_ADD guard**
socket/index.js : `if (!battlemapId) return` en tête du handler VOXEL_ADD.

---

### Chantier 4 — Reconnexion full reload ✅ (partiel)

SessionPage.jsx :
- `load()` extraite en `useCallback loadSession` — déclaré AVANT useState socket (ligne ~47)
- `useEffect(() => { loadSession() }, [loadSession])` remplace l'ancien useEffect de chargement
- dependency array useEffect socket : `[campaignId, reconnectTrigger, loadSession]`

Ordre React respecté : loadSession déclaré avant tout useCallback qui l'utilise.

**Bug C — Reconnexion automatique post-redémarrage serveur non fonctionnelle**

Symptôme : après redémarrage serveur, socket se reconnecte (transport OK) mais
SESSION_JOIN n'est pas ré-émis → socket n'est pas dans la room → broadcasts perdus.
Le F5 résout le problème (rechargement complet de la page).

Tentative de correction : handler s.on('reconnect') — n'a pas fonctionné.
Cause : problème architectural — SESSION_JOIN non ré-émis sur reconnexion automatique,
et le bon nom d'événement socket.io-client v4 nécessite investigation.

Décision : solution robuste uniquement — pas de bricolage.
La reconnexion robuste est intégrée au périmètre du Chantier 5.
Handler reconnect retiré de SessionPage.jsx — code non fonctionnel supprimé.

Solution cible documentée dans MISSION_chantier5 :
- Côté serveur : émettre SESSION_STATE à la connexion (tokens, characters, battlemap, onlineUsers)
- Côté client : handler connect dans le store Zustand qui ré-émet SESSION_JOIN + recharge
- Plus de dépendance à un événement nommé différemment selon les versions

---

### Fichiers modifiés session 12

- server/src/db/migrations/20260405_19_timestamps.js — nouveau fichier
- server/src/socket/index.js — TOKEN_MOVE updated_at + Bug B VOXEL_ADD guard
- server/src/routes/tokens.js — updated_at PUT + TOKEN_MOVED payload
- server/src/routes/characters.js — updated_at PUT + re-SELECT updated_at + CHARACTER_UPDATED payload
- server/src/routes/campaigns.js — updated_at PUT + returning étendu
- server/src/routes/battlemaps.js — updated_at PUT /:id + PUT /:id/voxels
- server/src/routes/users.js — updated_at PUT + returning étendu
- client/src/pages/SessionPage.jsx — loadSession useCallback + TOKEN_MOVED guard

### Validation fonctionnelle session 12
- ✅ Migration 19 appliquée sans erreur (Batch 8)
- ✅ updated_at écrit en base après déplacement token (vérifié psql)
- ✅ GM déplace token → joueur voit en temps réel
- ✅ Fonctionnel général inchangé — aucune régression
- ⚠️ Bug C — reconnexion post-redémarrage serveur → reporté Chantier 5

## Session 4 — 2026-03-31

### Contexte de reprise
Session 3 stable confirmée. Démarrage session 4 — librairie de personnages + tokens sur la carte.

### Décisions prises

**Table characters — unifiée PJ/PNJ/véhicule/drone**
user_id nullable — NULL = entité GM (PNJ, objet interactif).
Pas de stats — dépendent de la fiche personnage (autre développeur, hors scope).
Champs glb_url et portrait_url présents dès la migration pour éviter une migration future.
visible booléen — contrôle la visibilité dans la librairie pour les joueurs.

**Couleur utilisateur**
Champ color VARCHAR(7) ajouté sur users (migration 14).
Assignée aléatoirement à l'inscription depuis une palette de 12 teintes distinctes.
Modifiable par l'utilisateur dans ses paramètres (Phase 3).
Les tokens GM sont neutres — la couleur ne s'affiche pas sur leurs tokens, mais le champ est présent pour tous les profils par cohérence.

**character_id sur tokens**
Migration 16 — liaison token ↔ character via character_id nullable.
SET NULL si le character est supprimé — le token reste sur la carte.

**color sur tokens**
Migration 17 — champ color nullable sur tokens.
Héritée du character à la création, modifiable par le GM.

**Convention UUID — NON NÉGOCIABLE**
Découverte en session 4 : toutes les PK/FK existantes utilisent uuid, pas bigint.
Toute nouvelle migration doit utiliser table.uuid('id').primary().defaultTo(knex.fn.uuid()).
Documentée dans CONVENTIONS.md.

**Route /api/assets/:folder/*filePath**
Route générale proxy MinIO — remplace une multiplication de routes ciblées.
Sans auth — les assets statiques (GLB, PNG) ne sont pas sensibles.
Content-Type automatique selon extension : png, jpg, glb, json, pdf.
La route /api/textures reste en place pour compatibilité.

**tokens.js réécrit**
Multer retiré du POST — la route reçoit du JSON pur.
character_id, pos_z, color ajoutés dans le INSERT.
Upload image token prévu sur POST /api/tokens/:id/upload (Phase suivante).

**Drag HTML → canvas**
V1 : token créé au centre de la carte (pos_x=0, pos_y=0, pos_z=0).
Mécanisme : dataTransfer sur dragstart (Sidebar) → onDrop sur la div canvas (SessionPage).
Itération possible si l'expérience s'avère inconfortable en pratique.

**isGm calculé côté client**
Calculé dans SessionPage depuis campaign.members — plus hardcodé dans Sidebar.
La vraie valeur vient de la base de données.

**Police Inter locale**
client/public/fonts/inter.woff — copiée depuis node_modules/@fontsource/inter/files/.
Utilisée par Text de drei pour les labels de tokens — pas de dépendance CDN.

**Tokens 3D — rendu**
Modèle .glb chargé via useGLTF dans un sous-composant GltfLoader.
Clone via SkeletonUtils.clone (three-stdlib) — gère les textures embarquées en base64.
SRGBColorSpace forcé sur mat.map après clone — correctif pour modèles générés par trimesh.
Scale x2, Y_OFFSET 0.5 (à ajuster selon le modèle final).
OrbitControls — maxPolarAngle = Math.PI / 2 — caméra bloquée au-dessus de Y=0.

**Modèle default.glb**
Uploadé dans MinIO sous tokens/default.glb.
Modèle actuel généré par IA (free-3d.fr via trimesh) — textures défaillantes (noires).
À remplacer par un modèle propre exporté depuis Blender.
Le code de rendu est correct — le problème est l'asset, pas le code.

**Scènes 2D ambiance — décision reportée**
Idée validée : battlemap type 'scene' avec image plein écran + tokens 2D (illustration dans cercle).
Reportée en Phase 3 pour ne pas bloquer les tokens 3D. Documentée dans ROADMAP.md.

### Migrations appliquées
Batch 5 : 3 migrations — color users, characters, character_id tokens
Batch 6 : 1 migration — color tokens
Total : 18 migrations, toutes stables

### Fichiers créés/modifiés
server/src/routes/auth.js — génération couleur aléatoire au register
server/src/routes/characters.js — CRUD complet
server/src/routes/assets.js — proxy général MinIO (sans auth)
server/src/routes/tokens.js — réécrit (JSON pur, character_id, pos_z, color)
server/src/index.js — ajout characters + assets
client/src/pages/SessionPage.jsx — isGm, tokens, characters, drop
client/src/components/Canvas3D.jsx — tokens 3D, GltfLoader, SkeletonUtils, halo, label
client/src/components/Sidebar.jsx — isGm prop, onglet Persos, drag characters
client/public/fonts/inter.woff — police locale pour labels 3D
docs/CONVENTIONS.md — convention UUID migrations + mergeParams
docs/ARCHITECTURE.md — couleur users, route assets, tokens cascade, Clone, Inter
docs/ROADMAP.md — mise à jour complète session 4

### État fonctionnel vérifié
- Création de personnage depuis la Sidebar ✅
- Drag depuis Sidebar → token créé en base et affiché sur la carte ✅
- Modèle 3D visible sur la carte ✅
- Halo de couleur au sol ✅
- Label flottant avec nom du personnage ✅
- OrbitControls bloqué sous Y=0 ✅
- isGm branché sur la vraie valeur ✅

### Points de vigilance session suivante
- default.glb à remplacer — modèle actuel sans textures (problème asset, pas code)
- Y_OFFSET et position cercle à recalibrer avec le nouveau modèle
- Chaînes UI de l'onglet Persos pas encore passées par i18next (en dur en français)
- Drag & drop token sur la carte (déplacement) non implémenté
- Socket.io token:move non branché côté client
- isGm branché mais pas encore testé avec un vrai compte joueur

### Prochaine étape
1. Fournir un nouveau default.glb propre (Blender ou source fiable)
2. Recalibrer Y_OFFSET et position cercle
3. Drag & drop token sur la carte pour déplacement
4. Socket.io token:move branché côté client

## Session 5 — 2026-04-01

### Contexte de reprise
Session 4 stable confirmée. Démarrage session 5 — nouveau default.glb + drag & drop déplacement tokens.

### Travail effectué

**Nouveau default.glb — Blender 5.1.0**
Modèle recrée depuis zéro dans Blender par l'utilisateur.
- Origine placée aux pieds (centre de la base) ✅
- Dimensions : 1 unité de large × 2 unités de haut ✅
- Texture atlas unique `default.png` appliquée sur slot Base Color du Principled BSDF ✅
- Color Space corrigé : Linear → sRGB (cause du rendu noir en session 4) ✅
- Exporté en .glb avec textures embarquées
- Uploadé dans MinIO sous `tokens/default.glb` (remplacement de l'ancien)
- Validé visuellement dans Canvas3D — texture visible, proportions correctes ✅

**Calibration Canvas3D.jsx**
Y_OFFSET et scale ajustés visuellement après import du nouveau modèle.
Valeurs finales trouvées par l'utilisateur après tests — stables.
Principe retenu : le code s'adapte au modèle, pas l'inverse.
`clonedScene` identifié comme bug latent (recréé à chaque render) — correction prévue lors du drag.

### Décisions prises

**Drag & drop déplacement tokens — spec validée**

Comportement :
- `onPointerDown` sur token → début drag immédiat
- Si souris n'a pas bougé au `pointerUp` (seuil 3-4px) → sélection (pas drag)
- Pendant le drag : token suit curseur en temps réel, légère élévation Y+0.3
- Inclinaison selon direction du déplacement (delta XZ) — amplitude max ±0.3 rad
- Au relâchement : raycasting sur plan Y=0, scan colonne voxels pour Y final
- Token se pose sur le dessus du voxel le plus haut à cette position XZ
- Si pas de voxel → Y=0 (sol)
- Snap à la case : Math.round(x), Math.round(z)
- PUT /tokens/:id pour persister
- OrbitControls désactivé pendant le drag

**Mapping coordonnées — NON NÉGOCIABLE**
Piège identifié et documenté. À respecter dans tout le code de drag.
```
Three.js (tx, ty, tz) → base de données :
  pos_x = tx   (X Three.js = X base)
  pos_y = tz   (Z Three.js = pos_y base)
  pos_z = ty   (Y Three.js altitude = pos_z base)
```
Ce mapping doit être isolé dans une fonction utilitaire nommée explicitement.
Ne jamais faire ce mapping inline dans un handler.

**Architecture du drag — décisions techniques**
- État du drag dans `Scene`, pas dans `TokenMesh` — pour écouter `onPointerMove` sur canvas entier
- `clonedScene` dans `useMemo` dans `TokenMesh` — éviter recréation à chaque render pendant drag
- Callback `onTokenMove` descendu SessionPage → Canvas3D → Scene — pour mettre à jour tokens en base + état local
- `orbitRef` passé en prop à Scene → TokenMesh pour désactiver pendant drag
- PUT retourne `{ token: updated }` — mettre à jour le tableau tokens dans SessionPage
- Socket.io `token:move` — étape 3, après drag fonctionnel

**Sélection vs menu contextuel**
- Clic gauche court → sélection (halo illuminé)
- Token reste sélectionné jusqu'à clic sur autre token ou clic vide
- Clic droit sur token sélectionné → menu contextuel (stats placeholder + outils) — Phase 3
- Maintien clic gauche → drag

### Fichiers lus cette session
- `client/src/components/Canvas3D.jsx` — état actuel stable ✅
- `server/src/routes/tokens.js` — format PUT vérifié ✅

### Prochaine étape — à coder
1. Corriger `clonedScene` → `useMemo` dans `TokenMesh`
2. Ajouter état drag dans `Scene` (draggingTokenId, dragPosition)
3. `onPointerDown` sur TokenMesh → notifie Scene
4. `onPointerMove` sur canvas DOM → raycasting plan Y=0, mise à jour dragPosition
5. `onPointerUp` → raycasting final + scan voxels colonne + snap + PUT + reset
6. Inclinaison token pendant drag (delta XZ → rotation)
7. Callback `onTokenMove` dans SessionPage

### Points de vigilance
- Mapping coordonnées Three.js ↔ base de données — fonction utilitaire obligatoire
- `clonedScene` dans useMemo — ne pas oublier
- OrbitControls désactivé pendant drag — via orbitRef.current.enabled
- `onPointerMove` sur gl.domElement (canvas entier), pas sur le mesh
- Tester avec un vrai compte joueur — isGm pas encore testé
- Chaînes UI onglet Persos pas encore passées par i18next
- Socket.io token:move non branché côté client (étape suivante)

## Session 5 — suite (2026-04-01)

### Corrections apportées cette session

**default.glb — nouveau modèle Blender**
- Dimensions correctes : 1×2 unités, origine aux pieds ✅
- Texture atlas default.png appliquée, Color Space sRGB ✅
- Y_OFFSET et scale calibrés visuellement par l'utilisateur ✅
- Principe retenu : le token s'adapte au système, pas l'inverse

**Drag & drop déplacement tokens — implémenté**
- onPointerDown → drag, clic court → sélection
- DRAG_LIFT = 8 pendant le drag (token en l'air)
- Raycasting plan Y=0 au drop, snap Math.round
- threeToDb() — fonction utilitaire mapping coordonnées (NON NÉGOCIABLE)
- OrbitControls désactivé pendant drag
- clonedScene dans useMemo — correction bug recréation GLB
- isGm descendu SessionPage → Canvas3D → Scene
- Validation drop : GM Y 0-8, Joueur Y 0-7

**Bug altitude +1 corrigé**
getColumnTopY retournait maxY+1 même pour voxels Y=0.
Correction : return maxY (pas maxY+1). Le token se pose au niveau du voxel, pas dessus.

**isGm passé à Canvas3D**
SessionPage passe maintenant isGm={isGm} à Canvas3D.

### Problèmes non résolus — à traiter session suivante

**pointLight sélection token — ne fonctionne pas**
Cause probable : Three.js r155+ — useLegacyLights=false par défaut.
intensity=100 + distance=40 : toujours invisible.
Cause alternative possible : le clonedScene (primitive) est un objet Three.js natif,
les lumières R3F dans le même group ne l'affectent peut-être pas.
SOLUTION RETENUE : remplacer la pointLight par une animation useFrame sur le halo.
Animation : anneau qui tourne, oscille en hauteur (+/-0.01), pulse en opacité.

**Précision du raycast pendant le drag — mauvaise**
Cause : plan de raycasting à Y=DRAG_LIFT=8, angle oblique → erreur de projection amplifiée.
BONNE PRATIQUE trouvée (Three.js cookbook, codepen kaolay) :
- Au pointerDown : intersectObjects sur le token mesh → point de clic exact
- planeY = point de clic Y (hauteur réelle du clic sur le modèle)
- offset = intersectionPoint - tokenPosition
- Pendant move : raycast sur plan à planeY, soustraire offset
- Au drop : raycast sur plan Y=0 (correct, inchangé)
Cette approche garantit que le token reste exactement sous le curseur quelle que soit l'angle caméra.

### À coder immédiatement

1. Animation halo sélection (useFrame) — remplace pointLight
2. Précision raycast drag (plan au Y du clic + offset)
3. getColumnTopY bug altitude — CORRIGÉ (return maxY, pas maxY+1)

### État fichiers actuels
Canvas3D.jsx — version avec drag fonctionnel, altitude corrigée, pointLight présente mais invisible
SessionPage.jsx — stable, isGm passé à Canvas3D

### Rappel conventions critiques
- threeToDb(tx, ty, tz) → { pos_x: tx, pos_y: tz, pos_z: ty } — JAMAIS inline
- clonedScene dans useMemo — ne pas oublier
- useFrame disponible dans TokenMesh (enfant de Scene, enfant de Canvas) ✅
- GltfLoader = sous-composant dédié pour useGLTF (règle hooks React)
- Police Inter locale : font="/fonts/inter.woff"

## Session 5 — 2026-04-01

### Contexte de reprise
Session 4 stable confirmée. Objectifs : nouveau default.glb + drag & drop déplacement tokens.

---

### Travail effectué

**default.glb — Blender 5.1.0**
Modèle recréé par l'utilisateur depuis zéro.
- Origine aux pieds, dimensions 1×2 unités ✅
- Texture atlas default.png, Color Space Linear→sRGB corrigé ✅
- Y_OFFSET et scale calibrés visuellement ✅
- Uploadé dans MinIO tokens/default.glb

**Drag & drop déplacement tokens — implémenté et affiné**
Plusieurs itérations. État final stable :
- Raycasting sur plan Y=0 uniquement (approche Foundry VTT — précis, simple)
- XZ depuis raycast, Y dynamique = getColumnTopY + DRAG_HOVER pendant le drag
- Token flotte au-dessus du sol local, suit l'altitude des voxels en temps réel
- Snap Math.round au drop
- OrbitControls désactivé pendant drag
- Inclinaison token selon direction déplacement (DRAG_TILT_MAX = 0.3 rad)
- threeToDb() — mapping coordonnées NON NÉGOCIABLE
- clonedScene dans useMemo — correction bug recréation GLB

**Validation drop**
- GM : Y 0-8 (liberté totale, peut poser sur le vide)
- Joueur : Y 1-7 (voxel obligatoire sous les pieds, pas sur mur max)

**Correction conflit sélection DOM/React**
`justSelectedRef` dans Canvas3D — empêche `handleCanvasClick` d'effacer
une sélection posée dans le même cycle par `handlePointerUp`.

**TokenRing — anneau de base unifié**
Un seul composant anneau par token, toujours visible, deux états :
- Normal : statique, Y=0.6 local (au-dessus des pieds, Y_OFFSET=0.5), opacité 0.5
- Sélectionné : oscillation hauteur + diamètre via useFrame, opacité monte à ~0.95
- Pendant drag : Y=0.1 (au ras du sol pour aider à viser la case cible)
Couleur = token.color (propriétaire du token).

**pointLight supprimée**
La pointLight de sélection ne fonctionnait pas (Three.js r155+ useLegacyLights=false).
Remplacée définitivement par TokenRing animé.

**DRAG_LIFT supprimé**
Remplacé par altitude dynamique getColumnTopY + DRAG_HOVER = 0.5.

---

### Décisions techniques importantes

**Mapping coordonnées — NON NÉGOCIABLE**
```
threeToDb(tx, ty, tz) → { pos_x: tx, pos_y: tz, pos_z: ty }
```
Ne jamais faire ce mapping inline. Toujours passer par cette fonction.

**getColumnTopY — retourne maxY (pas maxY+1)**
Le token se pose AU NIVEAU du voxel, pas au-dessus.
Correction appliquée en session 5.

**Approche drag — pattern Foundry VTT**
Après recherche : les VTT pros séparent drag XZ (raycast sol) et altitude (calculée après drop).
Raycasting toujours sur Y=0 pendant le drag. Altitude calculée au drop uniquement.
Source : Foundry VTT v13, module elevated-vision, codepen kaolay Three.js.

**pointLight dans R3F + MeshLambertMaterial**
Ne fonctionne pas avec Three.js r155+ (useLegacyLights=false par défaut).
Solution : animations useFrame sur meshBasicMaterial pour les effets visuels de sélection.

**isGm descendu jusqu'à Scene**
SessionPage → Canvas3D (prop isGm) → Scene → handlePointerUp pour validation drop.

---

### État fichiers après session 5

**Canvas3D.jsx** — version stable avec :
- Drag fonctionnel, précision excellente
- TokenRing animé (sélection + drag)
- justSelectedRef (conflit sélection corrigé)
- Altitude dynamique pendant drag
- Validation drop GM/joueur

**SessionPage.jsx** — stable, isGm + onTokenMove passés à Canvas3D.

---

### À faire — session 6 (dans l'ordre)

1. Socket.io token:moved branché côté client
2. Chat branché Socket.io (remplace chat local)
3. Calque GM — tokens invisibles pour les joueurs
4. Barre GM supérieure (gestion battlemaps, affectation joueurs)
5. X-Ray — voxels transparents devant tokens
6. Viewport Snap GM + verrouillage

### Points de vigilance session suivante
- Tester avec un vrai compte joueur — isGm pas encore testé en conditions réelles
- Chaînes UI onglet Persos pas encore passées par i18next
- "La Forêt Maudite" sans battlemap (créée avant la transaction auto)
- Orientation token (N/S/E/O) — prévu Phase 3, via menu contextuel clic droit
- CLIENT_URL + VITE_API_URL à reconfigurer sur Raspberry Pi

### Conventions critiques à rappeler
- threeToDb() — JAMAIS inline
- clonedScene dans useMemo — ne pas oublier
- useFrame disponible dans TokenMesh (enfant de Canvas) ✅
- GltfLoader = sous-composant dédié pour useGLTF (règle hooks React)
- Police Inter locale : font="/fonts/inter.woff"
- UUID partout en base — jamais increments()
- Knex CLI Windows : node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs

## Session 6 — 2026-04-01

### Contexte de reprise
Session 5 stable confirmée. Démarrage session 6 — tâches UI manquantes + Socket.io côté client.

### Fichiers lus cette session (dans l'ordre)
- `shared/events.js` — constantes WS complètes ✅
- `server/src/socket/index.js` — format payloads vérifié ✅
- `client/src/pages/SessionPage.jsx` — socket={null} confirmé ✅
- `client/src/components/Canvas3D.jsx` — état complet vérifié ✅
- `client/src/components/Sidebar.jsx` — logique complète vérifiée ✅
- `client/package.json` — socket.io-client ABSENT confirmé ✅

### Constats établis avant de coder

**socket/index.js — payloads confirmés**
TOKEN_MOVED émet : { tokenId, pos_x, pos_y, pos_z } — pas un token complet.
TOKEN_CREATED / TOKEN_DELETED / TOKEN_UPDATED : non émis côté serveur socket.
CHAT_MESSAGE émet : { userId, username, text, timestamp } — champs différents du chat local
Sidebar ({ id, user, text, time }) — mapping nécessaire quand on branchera le chat.

**Canvas3D.jsx — problèmes confirmés**
- socket.emit('voxel:add') et socket.emit('voxel:remove') : chaînes en dur — violation CONVENTIONS.md.
  Correction : importer WS et utiliser WS.VOXEL_ADD / WS.VOXEL_REMOVE.
- WS non importé dans Canvas3D — à corriger en même temps.
- pointLight ligne 441 : inutile (Three.js r155+ legacy lights), à retirer.
- Suppression token (touche Suppr) : absente — tâche 1b.

**Sidebar.jsx — constats**
- Suppression character : absente — tâche 1c.
- Chat local (state React pur) : conforme, aucun Socket.io.
- char.owner_username utilisé ligne 318 : doit être retourné par GET /campaigns/:id/characters.
  Non bloquant maintenant.
- Chaînes en dur (non i18next) : connu depuis session 4, basse priorité.

**SessionPage.jsx — constats**
- socket={null} passé à Canvas3D : confirmé.
- handleTokenMove : reçoit un token complet. Compatible avec TOKEN_MOVED si on reconstruit
  le token depuis l'état local avant d'appeler la fonction.
- isGm calculé depuis members.find(m => m.id === user?.id) — pas encore testé avec vrai joueur.

**client/package.json — bloquant**
socket.io-client absent. À installer AVANT tout code Socket.io :
  cd client && npm install socket.io-client

**Chemin import WS depuis client/src/**
shared/events.js est à la racine du monorepo, pas dans client/.
Depuis client/src/components/ : ../../../shared/events.js
Depuis client/src/pages/ : ../../shared/events.js
À vérifier selon la config Vite (alias possible).

**Passage socket à Canvas3D — décision prise**
useRef ne déclenche pas de re-render → Canvas3D reçoit null et ne voit jamais le socket.
Solution retenue : useState(null) pour le socket dans SessionPage.
socketRef.current = io(...) puis setSocket(socketRef.current) après connexion.
Légèrement moins performant mais correct et simple.

### Plan session 6 — dans l'ordre strict

**Étape 1 — Tâches UI (pas de risque, routes serveur prêtes)**

1a. Bouton déconnexion — SessionPage.jsx
Bouton overlay coin supérieur gauche du canvas.
api.post('/auth/logout') → authStore.clear() → navigate('/login').

1b. Suppression token (touche Suppr) — Canvas3D.jsx
keydown sur document dans useEffect.
Conditions : selectedTokenId non null + isGm.
DELETE /api/tokens/:id → callback vers SessionPage → retirer du tableau tokens.
En même temps : import WS, corriger les deux emit en chaînes dures, retirer pointLight.

1c. Suppression character — Sidebar.jsx
IconTrash SVG à ajouter dans la section icônes.
Bouton dans charCard, isGm uniquement.
window.confirm + DELETE /characters/:id + onCharactersChange(prev => prev.filter(...)).
Style charDeleteBtn à ajouter.

1d. Commentaire TODO chat — Sidebar.jsx
Une ligne dans sendMessage : // TODO: brancher Socket.io — étape 6

**Étape 2 — Installation socket.io-client**
cd client && npm install socket.io-client
SR attendu sans erreur. Vérifier package.json mis à jour.

**Étape 3 — Socket.io côté client — SessionPage.jsx**
useState(null) pour le socket.
useEffect au montage : io() + emit SESSION_JOIN + on TOKEN_MOVED + cleanup disconnect.
TOKEN_MOVED handler :
  socket.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z }) => {
    setTokens(prev => prev.map(t =>
      t.id === tokenId ? { ...t, pos_x, pos_y, pos_z } : t
    ))
  })
Passer socket={socket} à Canvas3D (remplace socket={null}).

**Étape 4 — Test deux comptes simultanés**
Navigateur + onglet privé. GM + joueur.
Vérifier : drag token GM → joueur voit le déplacement en temps réel.
Premier vrai test isGm avec un compte joueur réel.
Utiliser une campagne créée après la transaction auto (pas "La Forêt Maudite").

### Ce qu'on ne fait PAS cette session
- Chat Socket.io
- TOKEN_CREATED / TOKEN_DELETED via socket
- Toute migration ou nouvelle route serveur
- i18next sur les chaînes en dur Sidebar

### Points de vigilance session suivante
- Tester isGm avec un vrai compte joueur (étape 4)
- owner_username sur characters — vérifier que la route le retourne
- "La Forêt Maudite" sans default_battlemap_id — ne pas utiliser pour les tests
- Chat Socket.io — mapping champs à faire (userId/username/text/timestamp → id/user/text/time)

## Session 6 — 2026-04-01 (mise à jour)

### Décisions prises en session 6

**Suppression token — deux mécanismes**
Touche Suppr/Backspace sur token sélectionné (GM uniquement) — implémenté dans Canvas3D.
Clic droit sur token → menu contextuel "Retirer du plateau" — à implémenter (propriétaire OU GM).
Les deux coexistent.

**Menu contextuel clic droit token 3D**
S'ouvre uniquement si l'utilisateur est propriétaire du token OU GM.
Actions actuelles : "Retirer du plateau" (DELETE /tokens/:id).
Placeholders non branchés : "Mesure", "Ligne de vue", "Portée".
Se ferme sur clic ailleurs.
Toutes les chaînes via i18next (namespace `token`).

**Fenêtre character modale**
Déclencheur : clic sur une charCard dans Sidebar.
Modale position fixed, z-index élevé, par-dessus tout.
Accessible à tous les membres (joueurs + GM).
visible=false → character absent de la liste joueur → pas de clic possible.
3 onglets :
- "Fiche" : placeholder Phase 3
- "Notes" : description (éditable GM+owner, lecture joueur) + gm_notes (GM uniquement)
- "Paramètres" : toggle visible (GM) + supprimer character (GM)
Bouton toggle visible en haut à droite, visible tous onglets, GM uniquement.
Illustration : placeholder — portrait_url prévu Phase 3.
Toutes les chaînes via i18next (namespace `character`).

**Migration 18 — description + gm_notes sur characters**
Deux champs TEXT nullable.
description : visible tous membres.
gm_notes : filtré côté route — jamais retourné aux joueurs.

**i18n — règle non négociable documentée dans CONVENTIONS.md**
Toute chaîne visible utilisateur passe par i18next. Sans exception. Sans report.
Nouvelle section ajoutée dans CONVENTIONS.md avec dette technique listée.
Namespaces à créer : `character`, `profile`, `sidebar`.

**Route PUT /api/users/me**
À créer. Champs : username, email, color, password (avec vérification ancien mdp).
Menu profil dans DashboardPage (modal dans header).

**Bouton déconnexion SessionPage — retiré du plan**
handleLogout existe déjà dans DashboardPage et fonctionne. Pas besoin dans SessionPage.

**Illustration character**
portrait_url existe déjà sur characters (migration 15).
Affichage et upload reportés Phase 3. Placeholder dans la modale pour l'instant.

### Fichiers modifiés session 6
- client/src/components/Canvas3D.jsx — WS import, emit corrigés, pointLight retirée, keydown Suppr
- docs/CONVENTIONS.md — section i18n + dédoublonnage
- docs/EN_COURS.md — mise à jour complète

### Fichiers à modifier dans la suite de la session
- server/src/db/migrations/20260401_18_characters_text_fields.js — à créer
- server/src/routes/characters.js — PATCH description/gm_notes + filtre gm_notes joueurs
- server/src/routes/users.js — PUT /me (à créer)
- client/src/components/Sidebar.jsx — modale character + TODO chat
- client/src/components/Canvas3D.jsx — menu contextuel clic droit
- client/src/pages/SessionPage.jsx — onTokenDelete + Socket.io
- client/src/pages/DashboardPage.jsx — i18n + menu profil
- client/src/locales/fr.json — namespaces character + profile + sidebar

### Points de vigilance
- Toujours lire le fichier avant de le modifier — jamais réécrire de mémoire
- i18n obligatoire sur tout nouveau texte — namespace character pour la modale
- gm_notes filtré côté serveur — ne jamais l'envoyer aux joueurs dans GET characters
- Menu contextuel : vérifier ownership token avant d'afficher (token.owner_id === user.id || isGm)
- socket.io-client à installer (cd client && npm install socket.io-client) avant Socket.io client

## Session 6 — 2026-04-01 (final)

### Contexte de reprise
Session 5 stable confirmée. Objectifs session 6 : tâches UI manquantes + Socket.io côté client.

### Décisions prises

**Suppression token — deux mécanismes coexistants**
Touche Suppr/Backspace sur token sélectionné (GM uniquement) — implémenté dans Canvas3D.
Clic droit sur token → menu contextuel "Retirer du plateau" — à implémenter session suivante.
Les deux coexistent.

**Fenêtre character modale**
Déclencheur : clic sur une charCard dans Sidebar (distingué du drag via dragStartPos ref).
Modale position fixed, z-index élevé, par-dessus tout.
Accessible à tous les membres.
visible=false → character absent de la liste joueur → pas de clic possible.
3 onglets : Fiche (placeholder Phase 3) / Notes (description + gm_notes) / Paramètres.
Bouton toggle visible en haut à droite, tous onglets, GM uniquement.
Illustration : placeholder — portrait_url prévu Phase 3.
Sauvegarde au blur des champs texte (pas à chaque frappe).
Toutes les chaînes via i18next (namespace character).

**visible = false par défaut à la création**
Tout nouveau character est invisible aux joueurs.
Le GM choisit quand le révéler via le toggle.

**Bug toggle visible — résolu**
Cause : onCharactersChange utilisait updater(characters) avec characters stale.
Solution : prop onCharacterUpdate séparée, reçoit le character complet depuis la réponse serveur,
appelle setSelectedCharacter directement — pas de dépendance au tableau.

**Route 404 sur PUT/DELETE /characters/:id — résolu**
Cause : characters.js monté uniquement sous /api/campaigns/:campaignId/characters.
Le client appelait /api/characters/:id qui n'existait pas.
Solution : actionsRouter exporté en nommé depuis characters.js,
monté sous /api/characters dans index.js.
Même pattern que tokensRouter monté sous /api/tokens.
Les routes PUT/:id et DELETE/:id récupèrent campaign_id depuis le character en base
— pas besoin de campaignId dans l'URL.

**onTokenDelete manquant dans SessionPage — résolu**
Canvas3D recevait socket={null} et onTokenDelete={undefined}.
La touche Suppr appelait undefined() — erreur silencieuse.
Ajout de handleTokenDelete dans SessionPage et passage à Canvas3D.

**errorHandler amélioré**
Log systématique (plus limité au mode dev).
Route et méthode HTTP incluses dans le log.
Stack trace complète uniquement pour les vrais 500.
Permet d'identifier rapidement la source des erreurs.

**Bug 500 GET /api/textures — asset manquant**
Cause : fichier block_space_quartza.png référencé dans manifest.json mais absent de MinIO.
Solution : asset uploadé dans MinIO par l'utilisateur.
Pas un bug de code — asset manquant.

**Migration 18 — description + gm_notes sur characters**
Deux champs TEXT nullable.
description : visible tous membres.
gm_notes : filtré côté serveur — jamais retourné aux joueurs dans GET.

**i18n — règle non négociable**
Section ajoutée dans CONVENTIONS.md.
Namespaces créés : character, sidebar.
Clés token complétées : removeFromMap, measure, lineOfSight, range.
Dette technique listée dans CONVENTIONS.md.

### Fichiers modifiés session 6
- server/src/db/migrations/20260401_18_characters_text_fields.js — créé
- server/src/routes/characters.js — description/gm_notes + actionsRouter standalone
- server/src/index.js — import actionsRouter + montage /api/characters
- server/src/middleware/errorHandler.js — logs améliorés
- client/src/components/Canvas3D.jsx — WS import, emit corrigés, pointLight retirée, keydown Suppr, onTokenDelete
- client/src/components/Sidebar.jsx — modale character 3 onglets, i18n complet, TODO chat
- client/src/pages/SessionPage.jsx — handleTokenDelete + onTokenDelete passé à Canvas3D
- client/src/locales/fr.json — namespaces character + sidebar + token complétés
- docs/CONVENTIONS.md — section i18n non négociable, dédoublonnage
- docs/EN_COURS.md — mise à jour complète

### État fonctionnel vérifié
- Suppression token touche Suppr (GM) ✅
- Toggle visible/invisible character ✅
- Suppression character depuis modale ✅
- visible=false par défaut à la création ✅
- errorHandler loggue route + méthode + stack ✅

### Non résolu — session suivante
- Menu contextuel clic droit token 3D
- Socket.io côté client (TOKEN_MOVED, SESSION_JOIN)
- socket.io-client absent de client/package.json — installer avant Socket.io
- Chat branché Socket.io
- Dashboard i18n + menu profil utilisateur (PUT /api/users/me)

### Points de vigilance session suivante
- "La Forêt Maudite" sans default_battlemap_id — ne pas utiliser pour les tests
- isGm pas encore testé avec un vrai compte joueur
- owner_username sur characters — vérifier que GET retourne bien ce champ
- Chat Socket.io — mapping champs : userId/username/text/timestamp → id/user/text/time
- CLIENT_URL + VITE_API_URL dans .env à reconfigurer sur Raspberry Pi
- Clic droit token : menu contextuel visible uniquement si propriétaire OU GM

## Session 7 — 2026-04-02

### Contexte de reprise
Session 6 stable confirmée. Objectif session 7 : menu contextuel token + Socket.io client.

### Problème rencontré — clic droit non fonctionnel

Première implémentation : menu contextuel déclenché via `onPointerDown` button===2 sur TokenMesh.
Non fonctionnel : OrbitControls interceptait le clic droit (pan caméra) avant R3F.
`stopPropagation()` R3F ne bloque pas les listeners DOM natifs d'OrbitControls.

### Analyse et décision — migration MapControls

Recherche effectuée sur les pratiques VTT (Foundry) et la doc Three.js.
Découverte : Three.js dispose de `MapControls`, variante d'OrbitControls conçue pour les vues carte/stratégie.
Preset natif MapControls : LEFT=PAN, MIDDLE=DOLLY, RIGHT=ROTATE.
Le clic droit étant affecté à la rotation (pas au pan), il devient disponible pour d'autres usages.

**Décision finale retenue :**
- Clic droit canvas vide → rotation orbitale (MapControls natif)
- Double clic sur token → menu contextuel (onDoubleClick R3F, sans conflit)
- Touches directionnelles → pan caméra (listenToKeyEvents natif MapControls)
- Molette enfoncée → pan souris
- Clic gauche canvas vide → désélection (inchangé)
- Drag token → clic gauche maintenu (inchangé)

### Décisions techniques

**Migration OrbitControls → MapControls**
Import depuis `@react-three/drei` — déjà installé, zéro nouvelle dépendance.
`<OrbitControls>` → `<MapControls>` dans le JSX.
mouseButtons : `{ LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }`.
`orbitRef.current.listenToKeyEvents(window)` — active le pan clavier natif.
`orbitRef.current.keyPanSpeed = 20` — vitesse pan clavier (défaut 7, trop lent).
`maxPolarAngle = Math.PI / 2` conservé — caméra bloquée au-dessus de Y=0.

**Double clic token → menu contextuel**
`onDoubleClick` existe nativement dans R3F sur les meshes — pas de timer à gérer.
Ajouté sur le group de TokenMesh, propagé via `onTokenDoubleClick` jusqu'à SessionPage.
Le double clic sélectionne d'abord (premier clic), puis ouvre le menu (deuxième clic) — comportement standard.

**handleDragStart nettoyé**
Garde `if (e.nativeEvent.button !== 0) return` — clic droit ignoré proprement.
Plus de détection button===2 ni de logique contextuelle dans handleDragStart.

**Menu contextuel HTML — SessionPage.jsx**
Rendu HORS du Canvas R3F, en position fixed par-dessus tout.
State : `contextMenu = { token, x, y }` ou `null`.
Ownership vérifié via lookup `characters` en state — pas de JOIN serveur, pas de migration.
Position adaptive : s'ouvre du bon côté selon la position du curseur dans la fenêtre (MENU_W=180, MENU_H=136).
Fermeture sur mousedown ailleurs (useEffect + cleanup).
Actions : "Retirer du plateau" (branché), Mesure / Ligne de vue / Portée (placeholders disabled).
i18n : namespace `token` — toutes les clés existaient déjà dans fr.json.

### Fichiers modifiés session 7
- client/src/components/Canvas3D.jsx — MapControls, double clic, handleDragStart nettoyé
- client/src/pages/SessionPage.jsx — contextMenu state, handleTokenDoubleClick, menu HTML

### État fonctionnel vérifié
- Double clic sur token → menu contextuel s'ouvre ✅
- "Retirer du plateau" → token supprimé ✅
- Clic droit canvas vide → rotation caméra ✅
- Touches directionnelles → pan caméra ✅
- Drag token → fonctionne toujours ✅
- Suppression touche Suppr → fonctionne toujours ✅

### Leçon apprise
Ne pas improviser sur un problème d'ergonomie de contrôles 3D.
Chercher ce que les professionnels font (Foundry VTT, Three.js cookbook).
La solution existait nativement dans Three.js — MapControls conçu exactement pour ce cas d'usage.

### Non résolu — session suivante
- Socket.io côté client (TOKEN_MOVED, SESSION_JOIN)
- socket.io-client absent de client/package.json — installer avant Socket.io
- Test deux comptes simultanés — isGm pas encore testé avec un vrai compte joueur

### Points de vigilance session suivante
- "La Forêt Maudite" sans default_battlemap_id — ne pas utiliser pour les tests
- Chat Socket.io — mapping champs : userId/username/text/timestamp → id/user/text/time
- keyPanSpeed = 20 — à ajuster en test si besoin

## Session 8 — 2026-04-03

### Contexte de reprise
Session 7 stable confirmée. Objectifs session 8 :
- Brancher Socket.io côté client (suite session 7)
- Implémenter les broadcasts manquants (TOKEN_CREATED, TOKEN_DELETED, CHARACTER_UPDATED)
- Ouvrir les actions token aux joueurs propriétaires
- Corriger l'alignement voxel/grille (bug découvert en session)

---

### Décisions prises

**Socket.io côté client — architecture état**
`socket` stocké dans `useState(null)` dans SessionPage — pas `useRef`.
Raison : `useRef` ne déclenche pas de re-render, Canvas3D recevrait `null` en permanence.
Pattern : `const s = io(...)` → handlers → `setSocket(s)` → cleanup `s.disconnect()`.
`socket` déclaré AVANT `handleCharacterDrop` dans le fichier — obligation car `handleCharacterDrop` l'utilise dans son dependency array.

**Ownership tokens — correction fondamentale**
La table `tokens` a une colonne `owner_id` — jamais renseignée en pratique.
L'ownership réel passe par `character_id → characters.user_id`.
Toute vérification d'ownership sur les tokens doit utiliser ce chemin.
Règle documentée : `token.character_id → db('characters').user_id === req.user.id`.
Applicable côté serveur REST (tokens.js) ET côté socket (socket/index.js).
**NON NÉGOCIABLE — ne jamais utiliser `token.owner_id`.**

**Broadcast TOKEN_CREATED**
Le GM place un token via drag depuis Sidebar → POST REST → token créé en base.
Sans broadcast, le joueur ne voit rien tant qu'il n'actualise pas.
Architecture retenue :
- Client émet `WS.TOKEN_CREATED { tokenId }` après le POST réussi
- Serveur relit le token en base (pour avoir toutes les colonnes) → broadcast `{ token }` à toute la room
- Tous les clients (y compris l'émetteur) écoutent `WS.TOKEN_CREATED` → ajout au tableau tokens si absent (guard doublon)

**Broadcast TOKEN_DELETED**
Deux déclencheurs côté client : touche Suppr (Canvas3D) et menu contextuel (SessionPage).
Architecture retenue :
- Client fait le DELETE REST → succès → émet `WS.TOKEN_DELETED { tokenId }` → met à jour état local
- Serveur reçoit `WS.TOKEN_DELETED { tokenId }` → broadcast à toute la room
- Tous les clients écoutent `WS.TOKEN_DELETED` → filtrent le token du tableau

**Broadcast CHARACTER_UPDATED**
Déclenché quand le GM change la visibilité d'un character ou son propriétaire.
Problème fetchSockets() : les remote sockets n'exposent pas les propriétés custom (`socket.role`).
Solution : `io.to(socket.campaignId).emit()` — broadcast à tous, version sans `gm_notes`.
Le GM a déjà la version complète via la réponse REST — pas besoin de lui envoyer `gm_notes` par socket.
Filtrage `gm_notes` obligatoire côté serveur avant le broadcast.
Côté client SessionPage : si le character existe → update, s'il n'existe pas → ajout (character nouvellement visible pour un joueur).

**Broadcast VOXEL_ADDED / VOXEL_REMOVED**
Canvas3D émettait déjà ces événements mais n'écoutait pas les broadcasts en retour.
Ajout d'un `useEffect` dans `Scene` qui écoute `WS.VOXEL_ADDED` et `WS.VOXEL_REMOVED`.
Cleanup propre avec `socket.off()` dans le return du useEffect.

**POST token ouvert aux joueurs**
La route était GM uniquement. Ouverture aux joueurs sous deux conditions strictes :
1. `character.user_id === req.user.id` — le joueur est propriétaire du character
2. Aucun token avec ce `character_id` n'existe déjà sur cette battlemap — contrainte doublon
Le GM reste libre de créer autant de tokens qu'il veut (pas de contrainte doublon pour le GM).

**DELETE token ouvert aux joueurs**
Même pattern que le POST et le PUT : ownership via `character_id → user_id`.

**Ownership drag Canvas3D**
`handleDragStart` bloque le drag si l'utilisateur n'est pas propriétaire du character lié au token.
Vérification : `characters.find(c => c.id === token.character_id)?.user_id === user?.id`.
`user` et `characters` passés comme props de SessionPage → Canvas3D → Scene.
Effet visuel : le token d'un autre joueur est visuellement non-draggable (aucune animation de drag ne se déclenche).

**Alignement voxel/grille — bug fondamental découvert session 8**
Origine : Three.js BoxGeometry a son origine au centre du cube.
Un cube à `position=[0,0,0]` s'étend de -0.5 à +0.5 sur chaque axe.
La grille drei/Grid a ses lignes aux coordonnées entières 0, 1, 2...
Résultat : les centres des cubes tombaient sur les intersections de grille — les cubes débordaient sur 4 cellules.

Correction retenue :
- `Voxel` : `position={[x+0.5, y+0.5, z+0.5]}` — décalage visuel uniquement, données en base inchangées
- `userData={{ isVoxel: true, position }}` conserve les coordonnées brutes pour le raycasting
- `Grid` : `position={[0, 0, 0]}` — lignes aux entiers = bords des cubes
- `TokenMesh` : `x = baseX + 0.5`, `z = baseZ + 0.5` — token centré dans sa cellule
- Pendant le drag : `dragState.x + 0.5`, `dragState.z + 0.5` — cohérence visuelle
- Y non décalé sur les tokens : `Y_OFFSET = 0.5` compense déjà l'origine au centre du cube

**Validation drop joueur — règle confirmée**
Session 5 avait établi : joueur Y 1-7 (voxel obligatoire sous les pieds, sol nu interdit).
Cette règle est maintenue. Elle signifie : `getColumnTopY(x, z) >= 1 && <= 7`.
Le joueur ne peut pas poser dans le vide ni sur un mur (hauteur maximale 8).

**PUT /characters/:id — owner_username dans la réponse**
Le `returning()` brut ne retourne pas `owner_username` (qui vient d'un JOIN users).
Correction : après le UPDATE, faire un SELECT avec LEFT JOIN users.
La réponse REST retourne maintenant le character complet avec `owner_username`.
Impact : cohérence entre la réponse REST et ce que `handleToggleVisible` attend côté Sidebar.

**campaigns.js GET /:id — ouvert aux membres**
La route était restreinte aux GM. Ouverte à tous les membres de la campagne.
Raison : SessionPage en a besoin pour charger `campaign.members` et calculer `isGm`.

**Leçon apprise — fetchSockets() et propriétés custom**
`io.in(room).fetchSockets()` retourne des remote socket adapters.
Ces objets n'exposent que `id`, `handshake`, `rooms`, `data` — pas les propriétés custom comme `socket.role`.
Pour partager des données via fetchSockets, utiliser `socket.data.xxx` (pas `socket.xxx`).
Dans notre cas : `socket.role` est inaccessible sur les remote sockets.
Solution : broadcaster à tous via `io.to()` et filtrer le contenu (ex: retirer `gm_notes`) plutôt que filtrer les destinataires.

**Leçon apprise — dependency arrays useCallback**
`socket` utilisé dans un callback doit être dans son dependency array.
Sinon la closure capture `null` (valeur au montage) et `socket?.emit()` ne fait rien.
Cas identifiés et corrigés : `handleContextMenuDelete` (SessionPage), `handleKeyDown` (Canvas3D), `handleCharacterDrop` (SessionPage).

**Leçon apprise — ordre de déclaration React**
Un `useState` doit être déclaré avant tout `useCallback` qui l'utilise dans son dependency array.
`const [socket, setSocket] = useState(null)` doit précéder `handleCharacterDrop` dans SessionPage.
Violation = `ReferenceError: can't access lexical declaration before initialization`.

---

### Fichiers modifiés session 8

**shared/events.js**
- Ajout `CHARACTER_UPDATED: 'character:updated'`

**server/src/socket/index.js**
- `TOKEN_MOVE` : correction ownership — `token.character_id → characters.user_id` (plus `token.owner_id`)
- `TOKEN_CREATED` : nouveau handler — relit token en base → broadcast `{ token }` à toute la room
- `TOKEN_DELETED` : nouveau handler — broadcast `{ tokenId }` à toute la room
- `CHARACTER_UPDATED` : nouveau handler — relit character avec LEFT JOIN users → broadcast `characterPublic` (sans gm_notes) via `io.to()`

**server/src/routes/tokens.js**
- `POST /battlemaps/:id/tokens` : ouvert aux joueurs propriétaires + contrainte doublon
- `PUT /tokens/:id` : ownership via `character_id → user_id` (plus `owner_id`)
- `DELETE /tokens/:id` : ouvert aux joueurs propriétaires (même pattern que PUT)

**server/src/routes/characters.js**
- `PUT /characters/:id` : `returning()` remplacé par SELECT avec LEFT JOIN users → retourne `owner_username`

**server/src/routes/campaigns.js**
- `GET /campaigns/:id` : ouvert à tous les membres (plus GM uniquement)

**client/src/components/Canvas3D.jsx**
- `Scene` : useEffect écoute `WS.VOXEL_ADDED` / `WS.VOXEL_REMOVED` → update `voxels` state
- `Scene` : props `user` et `characters` ajoutées
- `handleDragStart` : vérification ownership — bloque si pas propriétaire et pas GM
- `handleDragStart` : dependency array `[isGm, user, characters]`
- `handleKeyDown` : `socket?.emit(WS.TOKEN_DELETED, { tokenId })` après DELETE + `socket` dans dependency array
- `TokenMesh` : `x = baseX + 0.5`, `z = baseZ + 0.5` (au repos) et `dragState.x + 0.5`, `dragState.z + 0.5` (drag)
- `Voxel` : `position={[x+0.5, y+0.5, z+0.5]}` — alignement grille
- `Grid` : `position={[0, 0, 0]}`
- `Canvas3D` : props `user` et `characters` ajoutées, transmises à `Scene`

**client/src/pages/SessionPage.jsx**
- `const [socket, setSocket] = useState(null)` déplacé AVANT `handleCharacterDrop`
- `const [members, setMembers] = useState([])` ajouté
- `const [messages, setMessages] = useState([])` ajouté
- `setMembers(members)` ajouté dans le useEffect de chargement
- `handleCharacterDrop` : `socket?.emit(WS.TOKEN_CREATED, { tokenId })` après POST + `socket` dans dependency array
- `handleContextMenuDelete` : `socket?.emit(WS.TOKEN_DELETED, { tokenId })` après DELETE + `socket` dans dependency array
- Socket useEffect : écoute TOKEN_CREATED, TOKEN_DELETED, CHAT_MESSAGE, CHARACTER_UPDATED
- `user` et `characters` passés à Canvas3D
- `messages`, `socket`, `campaignMembers={members}` passés à Sidebar

**client/src/components/Sidebar.jsx**
- Import `WS` depuis `shared/events.js`
- Props ajoutées : `messages`, `socket`, `campaignMembers`
- État local `messages` supprimé — contrôlé par SessionPage
- `sendMessage` : `socket?.emit(WS.CHAT_MESSAGE, { text })` — plus de setState local
- `handleToggleVisible` : `socket?.emit(WS.CHARACTER_UPDATED, { characterId })` après PUT
- `CharacterModal` : props `socket` et `campaignMembers` ajoutées
- Onglet Paramètres : liste déroulante assignation joueur (filtrée `role === 'player'`)
- Assignation `user_id` via liste déroulante : `socket?.emit(WS.CHARACTER_UPDATED, { characterId })` après PUT
- Style `select` ajouté dans l'objet styles

---

### État fonctionnel vérifié en fin de session 8

- Socket.io connexion GM + joueur simultanés ✅
- TOKEN_MOVED : déplacement GM → joueur voit en temps réel ✅
- TOKEN_MOVED : déplacement joueur (son token) → GM voit en temps réel ✅
- TOKEN_CREATED : GM place token → joueur voit apparaître sans F5 ✅
- TOKEN_DELETED : GM supprime (Suppr ou menu) → joueur voit disparaître ✅
- TOKEN_DELETED : joueur supprime son token (menu) → broadcasté ✅
- CHAT_MESSAGE : chat fonctionnel dans les deux sens ✅
- CHARACTER_UPDATED : GM rend visible → joueur voit dans sa liste ✅
- CHARACTER_UPDATED : GM assigne character à joueur → mis à jour sans F5 ✅
- Joueur ne peut pas drag un token qui ne lui appartient pas ✅
- Joueur importe son token (drag depuis Sidebar) → une seule fois, doublon refusé ✅
- Voxels alignés dans les cellules de la grille ✅
- Tokens centrés dans les cellules de la grille ✅
- Drag token pendant déplacement → visuellement aligné ✅
- VOXEL_ADDED/REMOVED : GM pose/efface voxel → joueur voit en temps réel ✅

### Non résolu / points de vigilance session 9

**BUG PRIORITAIRE — Validation Y drop joueur cassée par le décalage voxel**
`getColumnTopY` retourne la coordonnée Y brute du voxel en base (entier).
Le décalage visuel +0.5 est uniquement dans le rendu — les données restent inchangées.
Avec la correction d'alignement, un voxel à Y=0 (sol) est visuellement à 0.5 mais `getColumnTopY` retourne 0.
La condition `snappedY >= 1` bloque donc tout drop joueur sur une carte avec un seul niveau de voxels (Y=0).
**Correction à faire en session 9 :** revoir la logique de validation Y pour qu'elle reflète
la présence d'un voxel dans la colonne, pas sa valeur Y absolue.
Piste : `getColumnTopY(x,z) >= 0` (voxel présent) && `getColumnTopY(x,z) <= 7` (pas un mur).

- "La Forêt Maudite" sans default_battlemap_id — ne jamais utiliser pour les tests
- Dette i18n : DashboardPage (chaînes en anglais)
- CLIENT_URL + VITE_API_URL dans .env à reconfigurer sur Raspberry Pi
## Session 9 — 2026-04-04

### Contexte de reprise
Session 8 stable confirmée. Bug prioritaire : validation Y drop joueur (getColumnTopY).

---

### Travail effectué

**BUG — getColumnTopY (Canvas3D.jsx)**
`getColumnTopY` retournait 0 pour colonne vide ET pour voxel à Y=0 — ambiguïté.
Correction : retourner `maxY` brut (-1 si vide, ≥0 si voxel trouvé).
Pendant le drag : `Math.max(0, columnY) + DRAG_HOVER` pour éviter altitude négative.
Validation drop joueur : `minY = isGm ? -1 : 0` / `maxY = isGm ? 8 : 7`.
Bug résolu — joueur peut poser sur voxels Y=0.

**Dashboard i18n (DashboardPage.jsx + fr.json)**
Toutes les chaînes en anglais en dur remplacées par clés i18next.
Namespace `dashboard` complété : joinWithCode, create, join, roleGM, rolePlayer, errorLoad, errorCreate, errorJoin.
"Enclume" (nom propre) conservé en dur — pas traduit.

**Route PUT /api/users/me (users.js)**
Nouveau fichier server/src/routes/users.js.
Champs : username, email, color, password (+ current_password requis).
Validation couleur hex `/^#[0-9A-Fa-f]{6}$/`.
Si username ou email change : JWT régénéré dans le cookie (sinon socket.user.username reste l'ancien).
Monté sous /api/users dans index.js.

**Menu profil utilisateur (DashboardPage.jsx)**
Modale position fixed déclenchée par clic sur username dans le header.
`handleProfileSave` : diff vs user actuel → envoie seulement les champs modifiés.
`setUser(res.data.user)` → authStore mis à jour immédiatement.
Namespace i18n `profile` créé dans fr.json.

**Barre GM supérieure (SessionPage.jsx)**
Liste des battlemaps chargée au montage via GET /campaigns/:id/battlemaps.
Clic simple = GM prévisualise (charge localement sans déplacer joueurs).
Écoute WS.MAP_SWITCH côté client — joueurs + GM chargent la nouvelle carte.
Séparation clic simple / Déplacer le groupe (menu contextuel).

**Menu contextuel barre GM (SessionPage.jsx + campaigns.js + battlemaps.js)**
Clic droit sur bouton carte → menu HTML position fixed.
Actions : Renommer, Définir page d'accueil, Déplacer le groupe, Dupliquer, Supprimer, Nouvelle carte.
campaigns.js PUT /:id : ajout default_battlemap_id dans les updates.
battlemaps.js : ajout POST /:id/duplicate.
Bug duplicate : voxel_data doit être JSON.stringify() avant INSERT (Knex ne sérialise pas si déjà objet JS).

**Onglet Joueurs Sidebar (Sidebar.jsx + SessionPage.jsx + socket/index.js)**
Liste membres avec badge MJ/Joueur, indicateur en ligne (point vert/gris).
Nom du personnage associé calculé côté client depuis `characters`.
Présence en ligne : SESSION_JOINED inclut désormais `onlineUserIds` (liste des connectés).
Correction : `socket.data.userId` stocké au SESSION_JOIN (accessible via fetchSockets(), contrairement à socket.user).

**Onglet Config Sidebar (Sidebar.jsx)**
Username + color picker, sauvegarde via PUT /users/me.
Reconnexion socket via pattern `reconnectTrigger` dans SessionPage (ne jamais appeler socket.disconnect/connect depuis Sidebar).
Namespace i18n sidebar complété.

**Chat amélioré (Sidebar.jsx + SessionPage.jsx + socket/index.js)**
Nom affiché en couleur du compte (color lue depuis DB dans handler CHAT_MESSAGE).
Messages système connexion/déconnexion dans le fil (SESSION_USER_JOINED/LEFT → `{ system: true }`).
Fix username chat : JWT régénéré + reconnectTrigger force nouveau socket avec nouveau JWT.

**Altitude tokens 3D (Canvas3D.jsx)**
Tokens avaient les pieds dans les voxels.
Cause : groupe à `baseY`, modèle à `Y_OFFSET=0.5` dans le groupe → pieds à Y=0.5 au lieu de Y=1.0.
Correction : groupe à `baseY + 0.5`, modèle à `Y_OFFSET=0.5` → pieds à Y=1.0 = dessus du voxel Y=0.
Pendant drag : `columnY + 0.5 + DRAG_HOVER`.

---

### Décisions prises

**Dés — spec validée pour session 10**
1. Fenêtre Paramètres campagne (Dashboard) — configurer seuils critiques par dé
2. Parser formule : `NdX+M`, `NdX-M`, `NdX` — calcul serveur uniquement
3. Jet privé au MJ (whisper) — payload `{ to: 'gm' }`, broadcast émetteur + GMs uniquement
4. Interface dés flottante au-dessus du canvas

**reconnectTrigger pattern — NON NÉGOCIABLE**
Sidebar ne possède pas le socket. SessionPage gère le cycle de vie.
Reconnexion = `setReconnectTrigger(n => n + 1)` dans SessionPage.
Le cleanup du useEffect socket (`return () => s.disconnect()`) gère la déconnexion propre.

**color dans CHAT_MESSAGE**
Lue depuis DB à chaque message (pas dans le JWT).
Serveur : `await db('users').where({ id: socket.user.id }).select('color').first()`

---

### Fichiers créés/modifiés session 9

**Nouveaux fichiers :**
- server/src/routes/users.js — PUT /api/users/me

**Fichiers modifiés :**
- client/src/components/Canvas3D.jsx — getColumnTopY, altitude tokens, drag hover
- client/src/components/Sidebar.jsx — onglet Joueurs, onglet Config, chat couleur/système, reconnectTrigger
- client/src/pages/SessionPage.jsx — barre GM, menu clic droit cartes, onglet joueurs, reconnectTrigger, messages système
- client/src/locales/fr.json — namespaces dashboard, profile, sidebar complétés
- server/src/routes/campaigns.js — PUT /:id accepte default_battlemap_id
- server/src/routes/battlemaps.js — POST /:id/duplicate
- server/src/routes/index.js — montage /api/users
- server/src/socket/index.js — SESSION_JOIN (onlineUserIds), CHAT_MESSAGE (color), socket.data.userId
- docs/SYSTEME.md — §11 à §21 ajoutés
- docs/ROADMAP.md — mise à jour complète session 9

---

### État fonctionnel vérifié en fin de session 9

- Bug Y drop joueur corrigé ✅
- Dashboard i18n complet ✅
- PUT /api/users/me fonctionnel (username, email, color, password) ✅
- Modale profil Dashboard ✅
- Barre GM supérieure — liste cartes, clic prévisualise ✅
- Menu clic droit barre GM — renommer, page d'accueil, déplacer groupe, dupliquer, supprimer, nouvelle carte ✅
- Onglet Joueurs Sidebar — présence en ligne temps réel ✅
- Onglet Config Sidebar — username + couleur ✅
- Chat — nom en couleur, messages système connexion/déconnexion ✅
- Altitude tokens 3D corrigée — pieds sur les voxels ✅

### Points de vigilance session 10

- **reconnectTrigger** — ne jamais gérer socket.disconnect/connect dans Sidebar
- **voxel_data duplicate** — toujours JSON.stringify() avant INSERT
- **socket.data.userId** — stocker au SESSION_JOIN pour fetchSockets()
- **JWT régénéré** — si username/email change dans PUT /users/me
- **"La Forêt Maudite"** — pas de default_battlemap_id, ne jamais utiliser pour les tests
- **Calque GM** — tokens layer='gm' non encore filtrés côté client (tâche suivante)

## Session 10 — 2026-04-05

### Contexte de reprise
Session 9 stable confirmée. Analyse critique externe reçue et traitée avant tout développement.
Décisions architecturales prises en début de session — à intégrer dans ARCHITECTURE.md, CONVENTIONS.md, EN_COURS.md après validation fonctionnelle.

---

### Décisions prises — à intégrer dans la doc (tampon)

**A — Règles character/token (→ ARCHITECTURE.md)**

Un character appartient à une campagne. Il est la source de vérité pour :
qui contrôle, qui peut modifier, portrait, token 3D, token 2D, textes.
Exception : `gm_notes` visible GM uniquement.

Un token est la présence d'un character sur une battlemap.
Il hérite de toutes les permissions de son character parent.
Il n'a pas de droits propres.

Règles de cycle de vie :
- Map supprimée → tokens supprimés (CASCADE en base — déjà implémenté)
- Map dupliquée → tokens NON dupliqués (comportement actuel, validé)
- Character supprimé → tokens supprimés (CASCADE en base — déjà implémenté)
- Token supprimé → rien (SET NULL sur character_id — déjà en base)

**B — Règle Three.js (→ ARCHITECTURE.md + CONVENTIONS.md)**

Ne jamais stocker d'objets Three.js dans le state React.
Géométries et matériaux réutilisés → `useMemo`.
Raison : bugs impossibles à reproduire (uniquement après N minutes, N changements de map).

**C — Dette validation dupliquée (→ CONVENTIONS.md)**

Certaines règles métier sont vérifiées à la fois côté client et côté serveur
(exemple : voxel obligatoire sous le token pour les joueurs).
Risque : une règle changée à un endroit sera oubliée ailleurs.
Règle à suivre : toute règle métier critique doit être vérifiée côté serveur.
Le client peut la vérifier aussi pour l'UX, mais le serveur est la source de vérité.
Si on modifie une règle → chercher TOUTES les occurrences (client + serveur + socket).

**D — Reconnexion socket (→ EN_COURS.md)**

Si un joueur perd la connexion, son state local peut être faux (events manqués).
Solution retenue : full reload à la reconnexion.
À implémenter : handler `reconnect` côté socket.io-client →
  GET /campaigns/:id + GET /battlemaps/:id + GET /tokens → reset complet du state.
Simple, robuste, adapté à 4-8 joueurs sur LAN.
PAS de sync incrémentale, PAS d'event history — overkill pour ce projet.

**E — Timestamps (→ migration 19)**

Ajouter `updated_at` sur la table `tokens` (minimum).
Raison : filet de sécurité pour les race conditions futures + diagnostic plus facile.
Migration légère, pas de changement logique.

**F — Refactor SessionPage → stores Zustand (→ ROADMAP.md)**

SessionPage concentre trop de responsabilités (state, socket, logique métier, props drilling).
Solution à terme : stores Zustand par domaine.
Proposition :
  sessionStore.js  — socket, onlineUsers, reconnectTrigger, messages
  mapStore.js      — battlemap, battlemaps, voxels
  tokenStore.js    — tokens
  characterStore.js — characters, members
SessionPage devient un orchestrateur léger.
Canvas3D et Sidebar lisent les stores directement au lieu de recevoir des props.
À faire APRÈS que les features prioritaires soient stables — pas maintenant.

**G — Ordre des sessions révisé**

Session 10 : Timestamps (migration 19) + Reconnexion full reload
Session 11 : Dés (étapes A→E, spec EN_COURS.md)
Session 12 : Refactor SessionPage → stores Zustand
Session 13 : Tests routes serveur critiques (ownership, permissions, contrainte doublon)

**H — Tests visuels manuels**

À faire par l'utilisateur : deux navigateurs simultanés (GM + joueur), scénarios critiques.
Résultats à noter dans EN_COURS.md section "Tests manuels effectués".

---

### Fonctionnalité développée cette session
(à compléter après développement)

## Session 10 — 2026-04-05 (suite)

### Décisions prises — timestamps (à intégrer dans ARCHITECTURE.md + migrations)

**Périmètre complet acté — migration 19**

Une seule migration couvre toutes les tables existantes.
Pattern : `created_at` + `updated_at` sauf exceptions notées.

| Table | created_at | updated_at | Justification |
|---|---|---|---|
| tokens | ✅ | ✅ | Déplacement temps réel — updated_at permet d'ignorer events obsolètes |
| battlemaps | ✅ | ✅ | Savoir quelle version un joueur a chargée |
| characters | ✅ | ✅ | Cohérence broadcast CHARACTER_UPDATED |
| campaigns | ✅ | ✅ | Cohérence générale |
| users | ✅ | ✅ | Utile si profil change pendant session active |
| campaign_members | ✅ | ❌ | joined_at suffit, updated_at sans valeur métier aujourd'hui |
| dice_rolls | ✅ | ❌ | Un jet ne se modifie pas |
| player_locations | ❌ | ✅ | Position courante — updated_at uniquement |
| walls | ✅ | ✅ | Cohérence future |
| zones | ✅ | ✅ | Cohérence future |
| documents | ✅ | ✅ | Phase 3 — prévoir maintenant |

Pattern Knex :
```javascript
table.timestamp('created_at').defaultTo(knex.fn.now())
table.timestamp('updated_at').defaultTo(knex.fn.now())
```

**Modifications routes requises après migration :**
Chaque PUT en base doit ajouter `updated_at = db.fn.now()` dans l'objet updates.
Fichiers concernés : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js.

**Autocritique documentée :**
Ma proposition initiale (tokens uniquement) était insuffisante.
Cause : raisonnement "faisable rapidement" au lieu de "ce dont le projet a besoin".
Question correcte à poser : "Quels objets changent d'état et ont besoin de traçabilité ?"
Ne pas reproduire cette erreur — analyse complète avant proposition.

---

### Sujet voxels — analyse en cours (décision non encore prise)

**Problème identifié :**
Format actuel `voxel_data` : tableau `[{x, y, z, mat}]` stocké en JSONB.
- Sauvegarde en base = réécriture complète du tableau à chaque modification
- Lookup = O(n) pour trouver un voxel
- Pas de diff possible sans reconstruire le tableau complet

**Ce qui fonctionne déjà bien :**
Les événements socket VOXEL_ADD / VOXEL_REMOVE envoient déjà des diffs unitaires.
Le problème est la persistance en base, pas le transport socket.

**Limite documentée dans ARCHITECTURE.md :**
"Au-delà de ~3000 cubes visibles, optimisation nécessaire."
Décision : changer MAINTENANT, avant que des cartes soient créées avec l'ancien format.

**Options analysées :**
- Option A — chunks : complexe, utile seulement à très grande échelle
- Option B — clé compressée `"x:y:z": mat` : lookup O(1), diff trivial, payload compact
- Option C — binaire : overkill pour ce projet

**Option B retenue comme candidate :**
```javascript
// Avant
[{ x: 12, y: 4, z: 2, mat: 3 }, ...]

// Après
{ "12:4:2": 3, "13:4:2": 1 }
```

**Impact du changement :**
- Migration : altération du champ voxel_data (données existantes à convertir)
- Serveur : routes battlemaps.js (lecture/écriture voxel_data)
- Serveur : socket/index.js (handlers VOXEL_ADD / VOXEL_REMOVE)
- Client : Canvas3D.jsx (lecture voxels, éditeur, raycasting)

**Questions ouvertes — à trancher avant de coder :**
1. Valeur 0 ou absence de clé pour "pas de voxel" ? → absence de clé (plus propre)
2. Suppression d'un voxel = `delete obj["x:y:z"]` → trivial
3. Données existantes en base : y a-t-il des battlemaps avec des voxels réels à migrer ?
   Si oui, script de conversion dans la migration up().
   Si non (projet en dev, cartes vides ou de test), migration up() repart de zéro.

**À décider ensemble avant de coder le sujet voxels.**

## Session 11 — 2026-04-05

### Contexte de reprise
Session 10 stable confirmée (décisions architecturales + MISSION files rédigés, aucun code).
Ordre d'exécution confirmé : les MISSION files font foi, pas la décision G du JOURNAL session 10.
Chantier 1 exécuté en session 11.

---

### Chantier 1 — Serveur seul émetteur WS ✅

**Principe :**
Le client ne broadcast plus jamais après un appel REST.
Le serveur broadcast après chaque écriture en base via `req.app.get('io')`.

**Infrastructure ajoutée :**
`app.set('io', io)` dans `server/src/index.js` — placé après création de `io`, avant `initSocket`.
Permet aux routes Express d'accéder à `io` via `req.app.get('io')` sans import circulaire.

**Broadcasts ajoutés côté serveur :**
- `tokens.js POST /` → `TOKEN_CREATED { token }` après INSERT
- `tokens.js PUT /:id` → `TOKEN_MOVED { tokenId, pos_x, pos_y, pos_z }` après UPDATE
- `tokens.js DELETE /:id` → `TOKEN_DELETED { tokenId }` après DELETE
- `characters.js actionsRouter PUT /:id` → `CHARACTER_UPDATED` (sans gm_notes) après UPDATE + SELECT

**Emit post-REST supprimés côté client :**
- `SessionPage.jsx handleCharacterDrop` — suppression `socket?.emit(WS.TOKEN_CREATED, ...)`
- `SessionPage.jsx handleContextMenuDelete` — suppression `socket?.emit(WS.TOKEN_DELETED, ...)`
- `Canvas3D.jsx handlePointerUp` — suppression `socket?.emit(WS.TOKEN_MOVE, ...)`
- `Canvas3D.jsx handleKeyDown` — suppression `socket?.emit(WS.TOKEN_DELETED, ...)`
- `Sidebar.jsx handleToggleVisible` — suppression `socket?.emit(WS.CHARACTER_UPDATED, ...)`
- `Sidebar.jsx onChange select assignation` — suppression `socket?.emit(WS.CHARACTER_UPDATED, ...)`

**Emit conservés côté client (commandes, pas broadcasts post-REST) :**
- `MAP_SWITCH` dans SessionPage — commande GM volontaire
- `VOXEL_ADD` / `VOXEL_REMOVE` dans Canvas3D — édition temps réel socket
- `CHAT_MESSAGE` dans Sidebar — pas un post-REST

**Dependency arrays nettoyés :**
- `handlePointerUp` — `socket` retiré (n'émet plus)
- `handleKeyDown` — `socket` retiré (n'émet plus)
- `handleToggleVisible` — `socket` retiré (n'émet plus)
- `handleCharacterDrop` — `socket` retiré (n'émet plus)

**Handlers socket/index.js conservés en l'état** (TOKEN_MOVE, TOKEN_CREATED, TOKEN_DELETED,
CHARACTER_UPDATED) — double broadcast bénin pendant la période de transition.
À nettoyer dans un chantier dédié après validation complète.

---

### Validation fonctionnelle Chantier 1

- ✅ GM déplace token → joueur voit en temps réel
- ✅ Joueur déplace son token → GM voit en temps réel
- ✅ GM crée token (drag Sidebar) → joueur voit apparaître
- ✅ GM supprime token (menu ou Suppr) → joueur voit disparaître
- ✅ SR sans erreur
- ❌ GM toggle visible character → joueur ne voit pas (bug préexistant — voir ci-dessous)

---

### Bugs identifiés cette session

**Bug 1 — Toggle visible character non répercuté en temps réel (préexistant)**
Comportement : le broadcast CHARACTER_UPDATED arrive bien côté client.
SessionPage met à jour `characters` correctement.
Mais les tokens sur la carte dépendent de `tokens`, pas de `characters`.
Aucun filtre ne retire/ajoute les tokens en fonction de `character.visible` après un broadcast.
Le filtrage existe côté serveur au chargement initial (GET /battlemaps/:id filtre par rôle),
mais pas en temps réel après un toggle.
Confirmé préexistant — non introduit par le Chantier 1.
**À corriger dans le Chantier 8 (Calque GM).**

**Bug 2 — VOXEL_ADD error: Undefined binding(s) detected (préexistant)**
Message nodemon : `[WS] voxel:add error: Undefined binding(s) detected when compiling FIRST. Undefined column(s): [id]`
Cause probable : `battlemapId` est `undefined` dans le payload VOXEL_ADD.
`battlemapId` vient de la prop `battlemapId={battlemap?.id}` passée à Scene depuis Canvas3D.
Si `battlemap` est null entre deux chargements de carte, `battlemapId` est `undefined`.
Le handler socket/index.js tente alors `db('battlemaps').where({ id: undefined })` → erreur Knex.
Non introduit par le Chantier 1 — handler socket/index.js non modifié.
**À corriger dans un chantier dédié : guard `if (!battlemapId) return` dans le handler VOXEL_ADD.**

---

### Fichiers modifiés session 11

- `server/src/index.js` — `app.set('io', io)`
- `server/src/routes/tokens.js` — broadcasts POST + PUT + DELETE + import WS
- `server/src/routes/characters.js` — broadcast PUT actionsRouter + import WS
- `client/src/pages/SessionPage.jsx` — suppression emit TOKEN_CREATED + TOKEN_DELETED
- `client/src/components/Canvas3D.jsx` — suppression emit TOKEN_MOVE + TOKEN_DELETED
- `client/src/components/Sidebar.jsx` — suppression emit CHARACTER_UPDATED (×2)

---

### Points de vigilance session suivante (Chantier 2)

- Uploader les nouvelles versions de tokens.js et characters.js (modifiés en session 11)
- Migration 19 : nouveaux fichiers à créer (pattern migration 18 comme référence)
- Routes à modifier pour `updated_at` : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js
- SessionPage.jsx : reconnexion full reload (`loadSession` en useCallback + handler `reconnect` socket)
- L'ordre de déclaration React reste critique : `loadSession` doit être déclaré AVANT le useEffect socket

## Session 12 — 2026-04-05

### Contexte de reprise
Chantier 1 ✅ (session 11). Chantier 2 commence cette session.
Rappel : les MISSION files font foi sur la décision G du JOURNAL session 10.

### Plan d'exécution validé — Chantier 2 + Chantier 4

**Chantier 2 — Timestamps**

Partie A — Migration 19 (`20260405_19_timestamps.js`)
alterTable sur 10 tables. player_locations exclue (colonnes déjà présentes migration 10).
walls et zones : updated_at seulement (created_at déjà présent migration 10).
Pattern : .nullable() sans backfill — données de test, base effaçable.

Partie B — updated_at dans les routes PUT
Fichiers : tokens.js, characters.js, campaigns.js, battlemaps.js, users.js.
`updates.updated_at = db.fn.now()` dans chaque PUT.
returning explicites (campaigns, users) : ajouter 'updated_at' — robustesse Chantier 5.
battlemaps PUT /:id/voxels : updated_at dans l'update (pas de returning nécessaire).
characters.js re-SELECT : ajouter 'characters.updated_at' dans les colonnes.

Partie C — updated_at dans les payloads WS
TOKEN_MOVED payload : ajouter updated_at.
TOKEN_CREATED : automatique via returning('*').
CHARACTER_UPDATED : via re-SELECT étendu (Partie B).
socket/index.js TOKEN_MOVE handler : update avec returning('*') + updated_at dans broadcast.
SessionPage.jsx TOKEN_MOVED handler : ignorer si payload.updated_at < local updated_at.

Bug B corrigé dans socket/index.js : guard `if (!battlemapId) return` dans VOXEL_ADD.

**Chantier 4 — Reconnexion full reload**
SessionPage.jsx : extraire load() en useCallback loadSession.
Déclaré après reconnectTrigger (l.87), avant handleMapSwitch (l.91).
useEffect chargement initial → useEffect(() => { loadSession() }, [loadSession]).
useEffect socket → s.on('reconnect', () => loadSession()) + loadSession dans deps.

**Ordre d'exécution**
1. Migration 19 + knex migrate:latest
2. socket/index.js (Bug B + TOKEN_MOVE)
3. tokens.js (Partie B + C)
4. characters.js (Partie B + C)
5. campaigns.js (Partie B)
6. battlemaps.js (Partie B)
7. users.js (Partie B)
8. SessionPage.jsx (Partie C + Chantier 4)

### Fichiers modifiés cette session
(à compléter après validation fonctionnelle)


## Session 12 — 2026-04-05

### Contexte de reprise
Chantier 1 ✅ (session 11). Chantier 2 + Chantier 4 exécutés cette session.
Rappel : les MISSION files font foi sur la décision G du JOURNAL session 10.

---

### Chantier 2 — Timestamps + updated_at dans les payloads ✅

**Partie A — Migration 19 (`20260405_19_timestamps.js`)**

Vérification complète de toutes les migrations 01→18 avant d'écrire la migration.
Résultat : la plupart des tables avaient déjà created_at + updated_at via `table.timestamps(true, true)`.

Colonnes réellement ajoutées (seulement ce qui manquait) :
- `tokens` — created_at + updated_at (migration 05 n'avait aucun timestamp)
- `characters` — updated_at seulement (created_at présent migration 15)
- `walls` — updated_at seulement (created_at présent migration 10)
- `zones` — updated_at seulement (created_at présent migration 10)
- `player_locations` — created_at seulement (updated_at présent migration 10)

Tables non touchées (colonnes déjà présentes) :
users, campaigns, campaign_members, battlemaps, documents, dice_rolls.

Pattern : `.nullable()` sans backfill — données de test, base effaçable.
down() : ordre inverse strict du up().

**Partie B — updated_at dans les routes PUT**

5 fichiers modifiés. Pattern uniforme : `updates.updated_at = db.fn.now()` après
construction de l'objet updates, avant le `.update(updates)`.
Placé après le guard `Object.keys(updates).length === 0` dans characters.js et tokens.js
— updated_at seul ne peut jamais déclencher un update vide.

returning explicites complétés :
- campaigns.js PUT /:id → 'updated_at' ajouté dans .returning([...])
- users.js PUT /me → 'updated_at' ajouté dans .returning([...]) — pas dans le JWT

battlemaps.js PUT /:id/voxels : updated_at ajouté dans l'objet update inline
(pas de .returning sur cette route).

**Partie C — updated_at dans les payloads WS**

tokens.js PUT /:id — TOKEN_MOVED payload : { tokenId, pos_x, pos_y, pos_z, updated_at }
characters.js actionsRouter PUT /:id — re-SELECT étendu avec 'characters.updated_at'
→ characterPublic le porte via destructuring spread.
TOKEN_CREATED : automatique via returning('*').

socket/index.js TOKEN_MOVE handler :
- update avec .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'updated_at'])
- broadcast TOKEN_MOVED inclut updated_at: updated.updated_at

SessionPage.jsx handler TOKEN_MOVED :
- destructure updated_at depuis le payload
- guard : if (updated_at && t.updated_at && updated_at < t.updated_at) return t
- met à jour updated_at dans l'état local du token

**Bug B corrigé — VOXEL_ADD guard**
socket/index.js : `if (!battlemapId) return` en tête du handler VOXEL_ADD.

---

### Chantier 4 — Reconnexion full reload ✅

SessionPage.jsx :
- `load()` extraite en `useCallback loadSession` — déclaré AVANT useState socket (ligne ~47)
- `useEffect(() => { loadSession() }, [loadSession])` remplace l'ancien useEffect de chargement
- `s.on('reconnect', () => loadSession())` ajouté dans le useEffect socket
- dependency array useEffect socket : `[campaignId, reconnectTrigger, loadSession]`

Ordre React respecté : loadSession déclaré avant tout useCallback qui l'utilise.

---

### Fichiers modifiés session 12

- `server/src/db/migrations/20260405_19_timestamps.js` — nouveau fichier
- `server/src/socket/index.js` — TOKEN_MOVE updated_at + Bug B VOXEL_ADD guard
- `server/src/routes/tokens.js` — updated_at PUT + TOKEN_MOVED payload
- `server/src/routes/characters.js` — updated_at PUT + re-SELECT updated_at + CHARACTER_UPDATED payload
- `server/src/routes/campaigns.js` — updated_at PUT + returning étendu
- `server/src/routes/battlemaps.js` — updated_at PUT /:id + PUT /:id/voxels
- `server/src/routes/users.js` — updated_at PUT + returning étendu
- `client/src/pages/SessionPage.jsx` — loadSession useCallback + TOKEN_MOVED guard + reconnect

### Validation fonctionnelle attendue
- SR sans erreur après knex migrate:latest
- GM déplace token → joueur voit en temps réel (inchangé)
- Reconnexion réseau → session rechargée automatiquement
- Pas de régression sur les fonctionnalités session 11

## Session 12 — 2026-04-05

### Contexte de reprise
Chantier 1 ✅ (session 11). Chantier 2 + Chantier 4 exécutés cette session.
Rappel : les MISSION files font foi sur la décision G du JOURNAL session 10.

---

### Chantier 2 — Timestamps + updated_at dans les payloads ✅

**Partie A — Migration 19 (`20260405_19_timestamps.js`)**

Vérification complète de toutes les migrations 01→18 avant d'écrire la migration.
Résultat : la plupart des tables avaient déjà created_at + updated_at via `table.timestamps(true, true)`.

Colonnes réellement ajoutées (seulement ce qui manquait) :
- `tokens` — created_at + updated_at (migration 05 n'avait aucun timestamp)
- `characters` — updated_at seulement (created_at présent migration 15)
- `walls` — updated_at seulement (created_at présent migration 10)
- `zones` — updated_at seulement (created_at présent migration 10)
- `player_locations` — created_at seulement (updated_at présent migration 10)

Tables non touchées (colonnes déjà présentes) :
users, campaigns, campaign_members, battlemaps, documents, dice_rolls.

Pattern : `.nullable()` sans backfill — données de test, base effaçable.
down() : ordre inverse strict du up().

**Partie B — updated_at dans les routes PUT**

5 fichiers modifiés. Pattern uniforme : `updates.updated_at = db.fn.now()` après
construction de l'objet updates, avant le `.update(updates)`.
Placé après le guard `Object.keys(updates).length === 0` dans characters.js et tokens.js
— updated_at seul ne peut jamais déclencher un update vide.

returning explicites complétés :
- campaigns.js PUT /:id → 'updated_at' ajouté dans .returning([...])
- users.js PUT /me → 'updated_at' ajouté dans .returning([...]) — pas dans le JWT

battlemaps.js PUT /:id/voxels : updated_at ajouté dans l'objet update inline
(pas de .returning sur cette route).

**Partie C — updated_at dans les payloads WS**

tokens.js PUT /:id — TOKEN_MOVED payload : { tokenId, pos_x, pos_y, pos_z, updated_at }
characters.js actionsRouter PUT /:id — re-SELECT étendu avec 'characters.updated_at'
→ characterPublic le porte via destructuring spread.
TOKEN_CREATED : automatique via returning('*').

socket/index.js TOKEN_MOVE handler :
- update avec .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'updated_at'])
- broadcast TOKEN_MOVED inclut updated_at: updated.updated_at

SessionPage.jsx handler TOKEN_MOVED :
- destructure updated_at depuis le payload
- guard : if (updated_at && t.updated_at && updated_at < t.updated_at) return t
- met à jour updated_at dans l'état local du token

**Bug B corrigé — VOXEL_ADD guard**
socket/index.js : `if (!battlemapId) return` en tête du handler VOXEL_ADD.

---

### Chantier 4 — Reconnexion full reload ✅ (partiel)

SessionPage.jsx :
- `load()` extraite en `useCallback loadSession` — déclaré AVANT useState socket (ligne ~47)
- `useEffect(() => { loadSession() }, [loadSession])` remplace l'ancien useEffect de chargement
- dependency array useEffect socket : `[campaignId, reconnectTrigger, loadSession]`

Ordre React respecté : loadSession déclaré avant tout useCallback qui l'utilise.

**Bug C — Reconnexion automatique post-redémarrage serveur non fonctionnelle**

Symptôme : après redémarrage serveur, socket se reconnecte (transport OK) mais
SESSION_JOIN n'est pas ré-émis → socket n'est pas dans la room → broadcasts perdus.
Le F5 résout le problème (rechargement complet de la page).

Tentative de correction : handler s.on('reconnect') — n'a pas fonctionné.
Cause : problème architectural — SESSION_JOIN non ré-émis sur reconnexion automatique,
et le bon nom d'événement socket.io-client v4 nécessite investigation.

Décision : solution robuste uniquement — pas de bricolage.
La reconnexion robuste est intégrée au périmètre du Chantier 5.
Handler reconnect retiré de SessionPage.jsx — code non fonctionnel supprimé.

Solution cible documentée dans MISSION_chantier5 :
- Côté serveur : émettre SESSION_STATE à la connexion (tokens, characters, battlemap, onlineUsers)
- Côté client : handler connect dans le store Zustand qui ré-émet SESSION_JOIN + recharge
- Plus de dépendance à un événement nommé différemment selon les versions

---

### Fichiers modifiés session 12

- server/src/db/migrations/20260405_19_timestamps.js — nouveau fichier
- server/src/socket/index.js — TOKEN_MOVE updated_at + Bug B VOXEL_ADD guard
- server/src/routes/tokens.js — updated_at PUT + TOKEN_MOVED payload
- server/src/routes/characters.js — updated_at PUT + re-SELECT updated_at + CHARACTER_UPDATED payload
- server/src/routes/campaigns.js — updated_at PUT + returning étendu
- server/src/routes/battlemaps.js — updated_at PUT /:id + PUT /:id/voxels
- server/src/routes/users.js — updated_at PUT + returning étendu
- client/src/pages/SessionPage.jsx — loadSession useCallback + TOKEN_MOVED guard

### Validation fonctionnelle session 12
- ✅ Migration 19 appliquée sans erreur (Batch 8)
- ✅ updated_at écrit en base après déplacement token (vérifié psql)
- ✅ GM déplace token → joueur voit en temps réel
- ✅ Fonctionnel général inchangé — aucune régression
- ⚠️ Bug C — reconnexion post-redémarrage serveur → reporté Chantier 5
## Session 13 — 2026-04-06

### Contexte de reprise
Chantiers 1 ✅, 2 ✅, 4 (partiel) ✅ — session 12.
Session 13 : Chantier 3 — Format voxel optimisé.

---

### Chantier 3 — Format voxel optimisé `"x:y:z": mat` ✅

**Décision clé — séparateur `":"` retenu**
Choix entre `"x,y,z"` (existant Canvas3D) et `"x:y:z"` (spec MISSION).
Décision : `":"` — convention du domaine (Minecraft, moteurs voxel), non ambigu,
cohérent spec ↔ code, lisible dans psql. Le coût de migration est identique dans les deux cas.

**Deux représentations distinctes et séparées :**
- **Mémoire React** : `{ "x:y:z": { x, y, z, mat } }` — les composants ont x, y, z, mat disponibles
- **Base de données** : `{ "x:y:z": mat }` — format minimal, lookup O(1), diff facile

**battlemaps.js — PUT /:id/voxels**
Validation remplacée : `Array.isArray` → `typeof === 'object' && !Array.isArray`.
Le reste de la route inchangé.

**socket/index.js — VOXEL_ADD**
Ancien : `.filter()` sur tableau + `.push()` + `JSON.stringify`.
Nouveau : `const key = \`\${x}:\${y}:\${z}\`` + spread `{ ...voxels, [key]: mat }` + `JSON.stringify`.
`voxels = battlemap.voxel_data || {}` (objet vide, pas tableau vide).

**socket/index.js — VOXEL_REMOVE**
Ancien : `.filter()` sur tableau.
Nouveau : spread + `delete next[key]` + `JSON.stringify`.

**Canvas3D.jsx — 4 zones modifiées**
1. `getVoxelKey` : séparateur `","` → `":"`
2. Initialisation depuis battlemap : `for...of tableau` → `Object.entries` + `key.split(':').map(Number)`
3. `save()` : projection mémoire → base avant envoi (`payload[key] = v.mat`)
4. Envoi direct du dictionnaire à la route PUT /voxels (plus de `Object.values`)

**Bug découvert et corrigé dans la même session**
`save()` envoyait `{ "x:y:z": { x, y, z, mat } }` au lieu de `{ "x:y:z": mat }`.
Conséquence : voxels sauvegardés avec objets imbriqués → rechargement silencieusement cassé
(`materialId` recevait un objet, `<Voxel>` ne rendait rien).
Correction : projection explicite `payload[key] = v.mat` dans `save()` avant l'appel REST.

**Nettoyage base de données effectué**
```sql
UPDATE battlemaps SET voxel_data = '{}' WHERE voxel_data IS NULL OR voxel_data::text = '[]';
```

---

### Fichiers modifiés session 13

- `server/src/routes/battlemaps.js` — validation PUT /:id/voxels : objet au lieu de tableau
- `server/src/socket/index.js` — VOXEL_ADD + VOXEL_REMOVE : logique dictionnaire
- `client/src/components/Canvas3D.jsx` — getVoxelKey + init battlemap + save() corrigé

### Validation fonctionnelle session 13
- ✅ Poser un voxel → format en base confirmé `{"x:y:z": mat}` (entiers, pas d'objets imbriqués)
- ✅ Recharger la page → voxels s'affichent correctement
- ✅ Supprimer un voxel → disparaît visuellement et en base
- ✅ Joueur voit les modifications voxel en temps réel (VOXEL_ADDED / VOXEL_REMOVED)
- ✅ Sauvegarde effective au passage edit → play

## Session 14 — 2026-04-06

### Contexte de reprise
Chantiers 1 ✅, 2 ✅, 3 ✅, 4 partiel ✅ — session 13.
Session 14 : début du Chantier 5 — migration progressive SessionPage → stores Zustand.
Étape 1/4 : tokenStore.

---

### Chantier 5 — étape 1/4 : tokenStore ✅

#### Pourquoi

Avant ce chantier, l'état `tokens` vivait dans `useState` local à `SessionPage`.
Conséquence : chaque composant qui avait besoin des tokens (Canvas3D, Sidebar)
devait les recevoir en prop depuis SessionPage, et SessionPage devait orchestrer
toutes les mutations (WS entrants, REST sortants, drag, suppression).
SessionPage grossissait à chaque feature — surface de bug croissante.

Le store Zustand centralise les mutations : n'importe quel composant peut lire
ou écrire les tokens sans passer par SessionPage comme intermédiaire.

#### Ce qui a changé

**`client/src/stores/tokenStore.js` — nouveau fichier**

Quatre actions couvrant tous les cas de mutation :

- `setTokens(tokens)` — remplacement complet du tableau.
  Appelé au chargement initial (`loadSession`) et au changement de carte
  (`handleMapSwitch`, handler `MAP_SWITCH`). Remplace l'ancien `setTokens` useState.

- `addToken(token)` — ajout avec guard doublon intégré.
  Guard nécessaire car TOKEN_CREATED est broadcasté à toute la room y compris
  l'émetteur du drag — sans guard, le token apparaîtrait deux fois chez le GM.
  Appelé dans `handleCharacterDrop` (drop depuis Sidebar) et handler WS TOKEN_CREATED.

- `removeToken(tokenId)` — suppression par id.
  Appelé dans `handleTokenDelete` (touche Suppr, menu contextuel) et handler WS TOKEN_DELETED.

- `updateToken(partial)` — mise à jour partielle avec guard obsolescence.
  `partial = { id, pos_x, pos_y, pos_z, updated_at }`.
  Guard : si `updated_at` reçu < `updated_at` local → événement ignoré (race condition réseau).
  Ce guard était inline dans SessionPage (session 12) — il est maintenant dans le store,
  seul endroit légitime pour cette logique.
  Appelé dans `handleTokenMove` (confirmation REST après drag) et handler WS TOKEN_MOVED.

**`client/src/pages/SessionPage.jsx` — adapté**

- `useState([])` pour tokens supprimé — remplacé par `useTokenStore()` ligne 18.
- Les 7 points de mutation (`handleCharacterDrop`, `handleTokenMove`, `handleTokenDelete`,
  handlers TOKEN_MOVED / TOKEN_CREATED / TOKEN_DELETED / MAP_SWITCH) appellent
  désormais les actions du store au lieu de `setTokens(prev => ...)` inline.
- Canvas3D conserve la prop `tokens` pour l'instant — pas de changement dans Canvas3D
  cette étape (migration progressive : un store validé avant de toucher les composants).

---

### Bug identifié — handleMapSwitch émet MAP_SWITCH à tous les joueurs

**Symptôme :** le GM clique sur une carte dans la barre GM → tous les joueurs
changent de carte. Or seul le bouton "Déplacer le groupe ici" devrait faire ça.

**Cause :** `handleMapSwitch` émet `WS.MAP_SWITCH` avec `userIds: []` à chaque appel,
y compris les changements de carte locaux du GM. Le handler client interprète
`userIds.length === 0` comme "tous concernés".
`handleGroupMove` appelle `handleMapSwitch` — correct.
Clic direct sur la barre GM appelle aussi `handleMapSwitch` — incorrect,
il devrait charger la carte localement sans émettre MAP_SWITCH.

**Ce n'est pas une régression de cette session** — ce code n'a pas été touché.
Bug pré-existant révélé par les tests de validation.

**Correction :** scinder `handleMapSwitch` en deux fonctions :
- `loadMap(battlemapId)` — charge localement, sans emit (clic barre GM)
- `handleGroupMove(bm)` — appelle `loadMap` puis émet MAP_SWITCH (bouton groupe)
À traiter en début de session suivante, avant de continuer le Chantier 5.

---

### Fichiers modifiés session 14

- `client/src/stores/tokenStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — useState tokens → useTokenStore, 7 points de mutation

### Validation fonctionnelle session 14
- ✅ Drag token GM → joueur voit en temps réel
- ✅ Création token depuis Sidebar → token apparaît, pas de doublon
- ✅ Suppression token (Suppr + menu contextuel) → disparaît pour tous
- ✅ Changement de carte → tokens rechargés correctement
- ⚠️ Bug MAP_SWITCH — documenté, correction prévue session 15 avant Chantier 5 étape 2

### Prochaine étape
Corriger le bug MAP_SWITCH, puis Chantier 5 étape 2/4 : `characterStore` (characters, members, isGm).