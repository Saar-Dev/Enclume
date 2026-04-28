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

## Session 15 — 2026-04-06

### Contexte de reprise
Chantiers 1 ✅, 2 ✅, 3 ✅, 4 partiel ✅, 5 étape 1/4 ✅ — session 14.
Session 15 : Chantier 5 étape 2/4 — characterStore + migration complète des props données.

---

### Chantier 5 — étape 2/4 : characterStore + migration stores dans Canvas3D et Sidebar ✅

#### Pourquoi cette étape va plus loin que la spec initiale

La spec prévoyait uniquement le characterStore. Après analyse, il est apparu que :
- Migrer characterStore sans migrer les props de Canvas3D et Sidebar aurait laissé
  SessionPage comme intermédiaire inutile (il aurait lu le store puis repassé les données en props)
- L'objectif documenté du Chantier 5 dans MISSION_chantier est explicite :
  "Aucune prop de données ne transite plus par SessionPage vers Canvas3D ou Sidebar"
- Faire A maintenant et B dans 2 semaines n'a aucun intérêt — une seule session cohérente

Decision validée avant de coder : migrer les 4 fichiers en une session.

#### Recherche effectuée — Zustand dans R3F Canvas

Vérification documentée : les stores Zustand créés avec `create()` sont globaux (module JS),
pas basés sur React Context. Ils fonctionnent à l'intérieur de `<Canvas>` R3F sans aucune
configuration supplémentaire. C'est la solution recommandée officiellement par l'équipe R3F
pour partager l'état entre le monde DOM et le monde Canvas.
Référence : https://github.com/react-spring/react-three-fiber/issues/114

#### `client/src/stores/characterStore.js` — nouveau fichier

6 actions couvrant tous les cas de mutation :

- `setCharacters(characters)` — remplacement complet (loadSession, changement de carte)
- `setMembers(members, userId)` — remplacement complet + calcul isGm atomique en interne.
  Une seule action pour garantir que members et isGm ne sont jamais désynchronisés.
- `addCharacter(character)` — ajout simple (création depuis Sidebar)
- `removeCharacter(characterId)` — suppression (handleDelete dans CharacterModal)
- `updateCharacter(partial)` — mise à jour partielle par id (description, gm_notes, visible, user_id)
- `upsertCharacter(character)` — ajout ou remplacement selon existence (handler WS CHARACTER_UPDATED).
  Couvre les deux cas : character mis à jour et character nouvellement visible pour un joueur.

#### `client/src/pages/SessionPage.jsx` — adapté

Suppressions :
- `useState` pour `characters`, `members`, `isGm` — remplacés par `useCharacterStore()`
- `handleTokenMove` et `handleTokenDelete` — supprimés (relayaient vers le store sans logique ajoutée)

Modifications :
- `loadSession` : `setMembers(members, user?.id)` remplace les 3 setters séparés
- Handler `CHARACTER_UPDATED` : `setCharacters(prev => ...)` → `upsertCharacter(updatedCharacter)`
- `handleCharacterDrop` : `characters` lu depuis le store (dependency array inchangé)
- `handleTokenDoubleClick` : `characters` et `isGm` lus depuis le store
- `handleContextMenuDelete` : appelle `removeToken` directement (plus de `handleTokenDelete`)

Props Canvas3D supprimées : `tokens`, `characters`, `isGm`, `user`, `onTokenMove`, `onTokenDelete`
Props Sidebar supprimées : `isGm`, `characters`, `onCharactersChange`, `campaignMembers`

#### `client/src/components/Sidebar.jsx` — adapté

- Props supprimées : `isGm`, `characters`, `onCharactersChange`, `campaignMembers`
- Ajout : `import { useCharacterStore }` — `characters`, `members`, `isGm`, `addCharacter` lus depuis le store
- `handleCreateCharacter` : `onCharactersChange(prev => [...prev, char])` → `addCharacter(char)`
- `CharacterModal` : prop `onCharactersChange` supprimée, remplacée par `useCharacterStore` direct
  - `updateCharacter({ id, description })` — description blur
  - `updateCharacter({ id, gm_notes })` — gm_notes blur
  - `updateCharacter({ id, visible })` — toggle visible
  - `updateCharacter(updated)` — assign user
  - `removeCharacter(id)` — suppression
  - `members` lu depuis le store pour le select d'assignation propriétaire
- `CharacterModal` prop `socket` supprimée (n'était plus utilisée après Chantier 1)

#### `client/src/components/Canvas3D.jsx` — adapté

- Props supprimées : `tokens`, `characters`, `isGm`, `user`, `onTokenMove`, `onTokenDelete`
- `Scene` : ajout `import { useTokenStore }`, `import { useCharacterStore }`, `import { useAuthStore }`
- `Scene` lit directement : `tokens`, `updateToken`, `removeToken` (tokenStore) /
  `characters`, `isGm` (characterStore) / `user` (authStore)
- `handlePointerUp` : `onTokenMove(res.data.token)` → `updateToken(res.data.token)` (store direct)
- `handleKeyDown` : `onTokenDelete(selectedTokenId)` → `removeToken(selectedTokenId)` (store direct)
- Canvas3D exporté : props réduites à `battlemap`, `mode`, `activeMaterial`,
  `onVoxelDataChange`, `onPackLoaded`, `onTokenDoubleClick`, `socket`

---

### Fichiers modifiés session 15

- `client/src/stores/characterStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — characterStore + suppressions useState + nettoyage props
- `client/src/components/Sidebar.jsx` — characterStore direct + suppressions props
- `client/src/components/Canvas3D.jsx` — tokenStore/characterStore/authStore directs + suppressions props

### Validation fonctionnelle session 15
- ✅ Drag token GM → joueur voit en temps réel
- ✅ Création token depuis Sidebar → token apparaît, pas de doublon
- ✅ Suppression token (Suppr + menu contextuel) → disparaît pour tous
- ✅ Changement de carte → tokens rechargés correctement
- ✅ Onglet Persos → liste des characters visible, drag vers canvas fonctionnel
- ✅ Onglet Joueurs → membres listés avec présence en ligne
- ✅ Toggle visible character (GM) → modale fonctionne
- ✅ Création character → apparaît dans la liste
- ✅ Suppression character → disparaît de la liste
- ✅ Chat → fonctionnel

### Prochaine étape
Chantier 5 étape 3/4 : mapStore (battlemap, battlemaps).

## Session 16 — 2026-04-07

### Contexte de reprise
Chantier 5 étapes 1/4 ✅, 2/4 ✅ — session 15.
Session 16 : Chantier 5 étape 3/4 — mapStore (battlemap, battlemaps).

---

### Chantier 5 — étape 3/4 : mapStore ✅

#### Décisions techniques

**`voxels` conservé dans Canvas3D — divergence documentée avec la MISSION**
La MISSION prévoyait `voxels` dans mapStore. Décision après analyse :
`voxels` est un état de rendu interne à Canvas3D, muté en temps réel à chaque clic
(plusieurs fois par seconde en mode édition). Le globaliser créerait des re-renders
sur tous les composants abonnés à chaque pose/suppression. Aucun composant hors
Canvas3D n'en a besoin. Reste en `useState` local à Canvas3D.

**`onVoxelDataChange` supprimée**
Ce callback appelait `setBattlemap(prev => ({...prev, voxel_data: data}))` dans
SessionPage après une sauvegarde REST. Analyse : Canvas3D réinitialise `voxels`
uniquement sur changement de `battlemap?.id` (pas de `voxel_data`). La mise à jour
était sans effet observable — supprimée proprement.

**`renameBattlemap(id, name)` — action atomique**
Le renommage touchait deux états simultanément : `battlemaps` (liste) ET `battlemap`
(carte active si renommée). Une action atomique dans le store garantit qu'ils ne
peuvent jamais être désynchronisés.

**`remaining` calculé avant `removeBattlemap`**
Dans `handleMapDelete`, `remaining = battlemaps.filter(...)` est calculé AVANT
l'appel à `removeBattlemap(bm.id)` — même principe que le pattern React `setState`
asynchrone : la valeur lue est celle avant la mutation.

#### `client/src/stores/mapStore.js` — nouveau fichier

5 actions :
- `setBattlemap(battlemap)` — remplacement complet (loadSession, loadMap, MAP_SWITCH)
- `setBattlemaps(battlemaps)` — remplacement complet (loadSession)
- `renameBattlemap(id, name)` — renomme dans la liste ET dans battlemap active (atomique)
- `addBattlemap(battlemap)` — ajout dans la liste (duplication, création)
- `removeBattlemap(battlemapId)` — suppression de la liste

#### `client/src/pages/SessionPage.jsx` — adapté

- `useState(battlemap)` et `useState(battlemaps)` supprimés → `useMapStore()`
- `handleMapRename` : 2 mutations séparées → `renameBattlemap(id, name)` atomique
- `handleMapDuplicate` : `setBattlemaps(prev => [...prev, bm])` → `addBattlemap(bm)`
- `handleMapCreate` : idem → `addBattlemap(bm)`
- `handleMapDelete` : `setBattlemaps(prev => prev.filter(...))` → `removeBattlemap(id)`
- `onVoxelDataChange` supprimée des props Canvas3D

#### `client/src/components/Canvas3D.jsx` — adapté

- Prop `battlemap` supprimée — lue depuis `useMapStore()` directement
- Prop `onVoxelDataChange` supprimée — mise à jour était sans effet observable
- `save()` simplifié : plus d'appel `onVoxelDataChange` après la sauvegarde REST
- Props Canvas3D exporté réduites à : `mode`, `activeMaterial`, `onPackLoaded`,
  `onTokenDoubleClick`, `socket`

---

### Fichiers modifiés session 16

- `client/src/stores/mapStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — mapStore + suppressions useState + nettoyage props
- `client/src/components/Canvas3D.jsx` — useMapStore direct + suppression prop battlemap/onVoxelDataChange

### Validation fonctionnelle session 16
- ✅ Chargement de session → voxels s'affichent correctement
- ✅ Poser/supprimer un voxel → visible pour tous en temps réel
- ✅ Sauvegarde voxels (passage edit → play) → persistée en base
- ✅ Changer de carte via barre GM → carte et tokens rechargés
- ✅ Renommer une carte → nom mis à jour dans la barre ET dans le titre si carte active
- ✅ Dupliquer / créer / supprimer une carte → liste mise à jour correctement
- ✅ Déplacer le groupe → tous les joueurs changent de carte

### Prochaine étape
Chantier 5 étape 4/4 : sessionStore (onlineUsers, messages) + reconnexion robuste Bug C.

---

## Session 17 — 2026-04-07

### Contexte de reprise
Chantier 5 étapes 1/4 ✅, 2/4 ✅, 3/4 ✅ — session 16.
Session 17 : Chantier 5 étape 4/4 — sessionStore + reconnexion robuste Bug C.

---

### Chantier 5 — étape 4/4 : sessionStore + Bug C ✅

#### Décision architecturale — divergence avec la MISSION

La MISSION prévoyait :
- SESSION_STATE côté serveur (socket/index.js modifié, shared/events.js modifié)
- sessionStore gérant le cycle de vie socket + handler `connect` pour ré-émettre SESSION_JOIN
- Problème : `connect` se déclenche à la connexion initiale ET à la reconnexion → double chargement

**Solution retenue — plus simple et plus robuste :**

`socket.io.on('reconnect', ...)` sur le **Manager** socket.io (pas sur l'instance socket).
Depuis socket.io v3, les événements de reconnexion sont sur le Manager (`socket.io`),
pas sur le socket. `socket.io.on('reconnect')` se déclenche **uniquement** lors d'une
reconnexion automatique — pas à la connexion initiale. Zéro ambiguïté, zéro flag.

```javascript
s.io.on('reconnect', () => {
  setReconnectTrigger(n => n + 1)
})
```

Cela déclenche le useEffect socket entier : nouvelle instance socket créée,
SESSION_JOIN ré-émis, `loadSession` rechargé → état complet resynchronisé depuis le serveur.
C'est exactement le même mécanisme que le bouton "Reconnexion" manuel de l'onglet Config,
maintenant automatisé.

**Avantages :** zéro modification serveur, zéro nouvelle constante WS, pas de double chargement.

#### `client/src/stores/sessionStore.js` — nouveau fichier

5 actions :
- `setOnlineUsers(onlineUsers)` — remplacement complet (SESSION_JOINED)
- `addOnlineUser(userId)` — ajout (SESSION_USER_JOINED)
- `removeOnlineUser(userId)` — suppression (SESSION_USER_LEFT)
- `addMessage(message)` — ajout d'un message (chat, système, futur : dés)
- `resetSession()` — reset complet (disponible pour usage futur)

#### `client/src/pages/SessionPage.jsx` — adapté

- `useState(messages)` et `useState(onlineUsers)` supprimés → `useSessionStore()`
- Handlers WS branchés sur les actions du store :
  - SESSION_JOINED → `setOnlineUsers(new Set([userId, ...onlineUserIds]))`
  - SESSION_USER_JOINED → `addOnlineUser(userId)` + `addMessage({...})`
  - SESSION_USER_LEFT → `removeOnlineUser(userId)` + `addMessage({...})`
  - CHAT_MESSAGE → `addMessage({...})`
- `s.io.on('reconnect', () => setReconnectTrigger(n => n + 1))` — correction Bug C
- Props Sidebar supprimées : `messages`, `onlineUsers`

#### `client/src/components/Sidebar.jsx` — adapté

- Props `messages` et `onlineUsers` supprimées
- `import { useSessionStore }` ajouté
- `messages` et `onlineUsers` lus directement depuis le store

---

### État final du Chantier 5 — SessionPage après migration complète

**useState restants dans SessionPage (légitimes — état UI local) :**
```
campaign          — utilisé uniquement dans SessionPage (handleSetDefault)
loading           — état de chargement initial
error             — état d'erreur initial
mode              — état UI (edit/play)
layer             — état UI (token/gm)
sidebarVisible    — état UI
sidebarWidth      — état UI
activeMaterial    — état UI
availableMaterials — liste chargée depuis Canvas3D
mapContextMenu    — menu contextuel barre GM
showRenameModal / renameTarget / renameValue  — UI modale renommage
showCreateModal / createMapName              — UI modale création
socket            — cycle de vie socket (migre en sessionStore étape future)
reconnectTrigger  — déclenche le useEffect socket
contextMenu       — menu contextuel token
```

**Stores Zustand opérationnels :**
- `tokenStore` — tokens
- `characterStore` — characters, members, isGm
- `mapStore` — battlemap, battlemaps
- `sessionStore` — onlineUsers, messages

---

### Fichiers modifiés session 17

- `client/src/stores/sessionStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — sessionStore + Bug C (s.io.on reconnect)
- `client/src/components/Sidebar.jsx` — useSessionStore direct + suppressions props

### Validation fonctionnelle session 17
- ✅ Chat → messages s'affichent correctement
- ✅ Onglet Joueurs → présence en ligne fonctionne
- ✅ Messages système connexion/déconnexion → apparaissent dans le chat
- ✅ Bug C corrigé → redémarrage serveur → reconnexion automatique sans F5
- ✅ Bouton reconnexion manuel (onglet Config) → fonctionne toujours
- ✅ Fonctionnel général → aucune régression

### Chantier 5 — TERMINÉ ✅

Toutes les étapes validées :
- Étape 1/4 : tokenStore ✅ (session 14)
- Étape 2/4 : characterStore + migration Canvas3D/Sidebar ✅ (session 15)
- Étape 3/4 : mapStore ✅ (session 16)
- Étape 4/4 : sessionStore + Bug C ✅ (session 17)

### Prochaine étape
Chantier 6 — Dés (étapes A→E, spec dans MISSION_chantier6).

---

## Session 17 — append — Décision architecturale Chantier 6 : dice_config

### Contexte
Avant toute implémentation du système de dés, analyse complète de la structure
de données pour les seuils critiques. Les colonnes `critical_success` et
`critical_fail` (migration 07, JSONB, jamais utilisées) sont remplacées.

### Décision : JSONB colonne unique `dice_config` sur `campaigns`

**Structure :**
```json
{
  "d20": { "success": { "min": 18, "max": 20 }, "fail": { "min": 1, "max": 1 } },
  "d6":  { "success": { "min": 6,  "max": 6  }, "fail": null },
  "d100":{ "success": null,                      "fail": { "min": 1, "max": 5 } }
}
```

**Règles de nullabilité :**
- Dé absent de la structure = critiques désactivés sur ce dé
- `success: null` = pas de succès critique sur ce dé
- `fail: null` = pas d'échec critique sur ce dé

**Règle d'évaluation serveur :** `total >= min && total <= max` (plage inclusive).
`min === max` = valeur exacte (cas courant — ex: D&D succès sur 20, Polaris sur 1).

**Dés couverts (liste exhaustive) :** d4, d6, d8, d10, d12, d20, d100.

### Pourquoi JSONB et pas 28 colonnes scalaires

Option écartée : 28 colonnes INTEGER (`d4_success_min`, `d4_success_max`, ...).

JSONB retenu car :
1. On ne filtre, indexe, ni agrège jamais sur `dice_config` en SQL — usage
   exclusivement "lire en entier, parser en JS, utiliser". C'est le cas d'usage
   exact pour lequel JSONB existe dans PostgreSQL.
2. 28 colonnes = schéma pollué, ajouter un dé = migration, `PUT /campaigns/:id`
   à 28 paramètres.
3. Le typage PostgreSQL n'apporte rien ici : la validation métier
   (`1 <= min <= max <= faces du dé`) ne peut pas être exprimée par un type SQL
   et doit être faite côté serveur dans tous les cas.

La robustesse réelle vient du **validateur serveur** dans `campaigns.js PUT /:id`,
pas du type SQL.

### Validateur serveur (à implémenter dans campaigns.js)
```javascript
const VALID_DICE  = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DICE_FACES  = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }

// Pour chaque clé de dice_config :
// - clé doit être dans VALID_DICE
// - success et fail sont null ou { min: integer, max: integer }
// - si présent : 1 <= min <= max <= DICE_FACES[dé]
```

### Migration 20
Fichier : `20260407_20_campaigns_dice_config.js`
- `dropColumn('critical_success')`
- `dropColumn('critical_fail')`
- `table.jsonb('dice_config').nullable().defaultTo(null)`

### Couleur dans les résultats de dés
La couleur affichée dans le fil de messages pour un jet de dé = couleur de profil
de l'utilisateur qui lance. Lue depuis la DB dans le handler socket `DICE_ROLL`
(même pattern que `CHAT_MESSAGE`). Jamais depuis le JWT.

---

## Session 17 — suite — Chantier 6 : Migration 20 + Étape A ✅

### Migration 20 — appliquée ✅
Batch 9. Fichier : `20260407_20_campaigns_dice_config.js`
- `dropColumn('critical_success')` — colonne JSONB orpheline supprimée
- `dropColumn('critical_fail')` — idem
- `table.jsonb('dice_config').nullable().defaultTo(null)` — nouvelle colonne
20 migrations stables.

### Chantier 6 — Étape A : Paramètres campagne ✅

#### Fichiers créés / modifiés

**`server/src/routes/campaigns.js`**
- Constantes `VALID_DICE` et `DICE_FACES` ajoutées en tête de fichier
- Fonction `validateDiceConfig(config)` — validateur complet avant écriture :
  - `null` accepté (désactive tous les critiques)
  - seules les clés VALID_DICE acceptées
  - `success` et `fail` : null ou `{ min, max }` avec `1 <= min <= max <= faces`
  - erreurs AppError 400 avec messages explicites
- `PUT /:id` : ajout `dice_config` dans les champs acceptés
  - `JSON.stringify(dice_config)` avant écriture (pattern P8 — cohérent avec voxel_data)
  - `dice_config` ajouté dans le `.returning([...])`

**`client/src/locales/fr.json`**
- `dashboard.settings` ajouté
- Namespace `settings` créé — 29 clés couvrant :
  - navigation page, états (saving, saved, errors)
  - 3 sections (dés, joueurs placeholder, fiche placeholder)
  - mode simple (toggles, labels, aperçu)
  - mode expert (tableau colonnes)

**`client/src/App.jsx`**
- Import `CampaignSettingsPage` ajouté
- Route `/campaigns/:campaignId/settings` ajoutée sous `ProtectedRoute`

**`client/src/pages/DashboardPage.jsx`**
- Bloc `cardActions` ajouté sous `cardFooter` dans chaque carte campagne
- Visible uniquement si `campaign.role === 'gm'`
- Bouton "Configuration" → `navigate(`/campaigns/${campaign.id}/settings`)`
- Style `btnSettings` : lien souligné discret, séparé par une bordure top
- `cursor: 'pointer'` ajouté sur `logoutBtn` et `btnSecondary` (manquant)

**`client/src/pages/CampaignSettingsPage.jsx`** — nouveau fichier
- Route : `/campaigns/:campaignId/settings`
- Charge la campagne via `GET /campaigns/:id` au montage
- Guard : 403 → message "Accès réservé au MJ" + retour Dashboard
  (vérification stricte côté serveur sur le PUT — `requireRole('gm')`)
- Navigation latérale : Dés (active) / Joueurs (placeholder) / Fiche (placeholder)
- Bouton Enregistrer en header + feedback "Configuration enregistrée" (3s)

**Section Dés — trois niveaux imbriqués :**

Niveau 1 — Toggle global "Activer les critiques"
- Si désactivé → `dice_config: null` sauvegardé

Niveau 2 — Mode simple (défaut)
- Réussite critique : checkbox + toggle MIN/MAX
- Échec critique : checkbox + toggle MIN/MAX
- Aperçu D20 SVG inline (placeholder — à remplacer par asset final)
  mis à jour en temps réel selon les toggles
- `buildSimpleConfig()` : applique la règle uniforme à tous les 7 dés
  `MAX` → `{ min: faces, max: faces }` / `MIN` → `{ min: 1, max: 1 }`
- Lien "Mode expert" en bas

Niveau 3 — Mode expert
- Tableau compact : 7 lignes (D4→D100) × colonnes Actif / Succès / Échec
- Chaque critique : checkbox actif + inputs min/max bornés (1 → faces du dé)
- `buildExpertConfig()` : construit dice_config depuis la grille
- Bascule expert → simple : réglages par dé perdus (comportement confirmé)
- Bascule simple → expert : grille initialisée depuis les toggles simples
- Lien "← Mode simple" en bas

**Fonctions utilitaires (toutes pures, hors composant) :**
- `buildSimpleConfig(successOn, failOn)` → dice_config uniforme
- `buildExpertConfig(expertRows)` → dice_config par dé
- `initExpertRows(diceConfig)` → state grille depuis config existante

#### Validation fonctionnelle
- ✅ Bouton "Configuration" visible sur les cartes GM dans le Dashboard
- ✅ Navigation `/campaigns/:id/settings` fonctionnelle
- ✅ Toggle critiques → affiche/masque la section
- ✅ Mode simple → aperçu D20 mis à jour en temps réel
- ✅ Bascule mode expert → tableau 7 lignes
- ✅ Bascule retour mode simple → réinitialisation toggles
- ✅ Sauvegarde → "Configuration enregistrée"
- ✅ SR — aucune régression

### Prochaine étape
Chantier 6 — Étape B : DicePanel (composant flottant + draggable).

---

## Session 17 — suite — Chantier 6 : Étape B ✅

### Chantier 6 — Étape B : DicePanel ✅

#### Fichiers créés / modifiés

**`client/src/components/DicePanel.jsx`** — nouveau fichier
- Composant auto-suffisant — état interne uniquement, aucune prop de données
- Props : `socket`, `mode`
- Deux états : replié (bouton flottant) / déplié (panneau flottant)

**État replié :**
- Bouton rond 44×44px, position fixed bas-gauche (20px, 20px depuis le bas)
- Icône SVG DICE1 fournie par l'utilisateur — nettoyée (carré, currentColor, sans métadonnées)
- `mode === 'edit'` → opacity 0.3, pointer-events none
- Clic → bascule isOpen

**État déplié :**
- Panneau position fixed, dimensions 320×460px
- Position initiale : bas-gauche au-dessus du bouton
- Clamp lors du drag : panneau ne sort jamais de l'écran

**Header :**
- Titre "Lanceur de dés"
- Toggle "Jet au MJ" — désactivé (opacity 0.35, disabled), tooltip "Disponible prochainement"
  Préparé pour l'Étape D (jets privés) — affiché mais non fonctionnel
- Bouton ✕ fermeture

**Grille dés :**
- 7 lignes (D4, D6, D8, D10, D12, D20, D100) × 5 colonnes (quantités 2→6, comme Roll20)
- Clic cellule → `socket.emit(WS.DICE_ROLL, { formula: '2d6' })`

**Jet avancé :**
- Input formule libre + bouton Lancer (ou Enter)
- `socket.emit(WS.DICE_ROLL, { formula: '2d6+3' })`
- Bouton désactivé si formule vide

**Drag — handle "Déplacer" en footer :**
- Pattern `useRef` + listeners `pointermove`/`pointerup` sur `document`
- `dragState` en `useRef` (pas useState) — pas de re-render pendant le mouvement
- Seul `setPos` déclenche le re-render de positionnement
- Cleanup `removeEventListener` dans `useEffect` retour + dans `handleDragEnd`

**`client/src/pages/SessionPage.jsx`** — modifié
- Import `DicePanel` ajouté
- `<DicePanel socket={socket} mode={mode} />` monté avant la fermeture du container
  (position fixed — indépendant du flux, mais conventionnellement après les overlays)

**`client/src/locales/fr.json`** — complété
- `dice.panel` : "Lanceur de dés"
- `dice.gmRoll` : "Jet au MJ"
- `dice.gmRollSoon` : "Disponible prochainement"
- `dice.launch` : "Lancer"
- `dice.move` : "Déplacer"
- `dice.advanced` : "Jet avancé"
- `dice.disabledInEdit` : "Indisponible en mode édition"

#### Validation fonctionnelle
- ✅ Icône dé visible bas-gauche en mode jeu
- ✅ Icône grisée et non cliquable en mode édition
- ✅ Clic → panneau déplié avec grille 7×5
- ✅ Clic cellule → `dice:roll` émis (vérifié console serveur)
- ✅ Champ jet avancé → Enter ou bouton Lancer → formule émise
- ✅ Handle "Déplacer" → panneau draggable, clampé dans l'écran
- ✅ Bouton ✕ → fermeture
- ✅ SR — aucune régression

---

### Chantier 6 — Étapes C + E : décisions architecturales prises, implémentation à venir

#### Analyse Sidebar.jsx — rendu messages

Fil de messages actuel dans `Sidebar.jsx` — deux types :
- `msg.system === true` → message système (connexion/déconnexion)
- sinon → message chat `{ id, user, color, text, time }`

Les résultats de dés seront un **troisième type** : `msg.type === 'dice'`.
Structure complète du message dé côté client :
```javascript
{
  id: `dice-${userId}-${timestamp}`,
  type: 'dice',
  user: username,
  color,           // couleur profil de l'émetteur
  formula,         // ex: "2d6+3"
  rolls,           // ex: [4, 5]
  total,           // ex: 12
  isCriticalSuccess: false,
  isCriticalFail: false,
  time,            // toLocaleTimeString
}
```

Le rendu dans `Sidebar.jsx` ajoutera un `else if (msg.type === 'dice')` dans le `map`
existant — sans toucher au rendu des messages chat ou système.

#### Payload DICE_RESULT (serveur → clients)
```json
{
  "userId": "...",
  "username": "...",
  "color": "#e05b5b",
  "formula": "2d6+3",
  "rolls": [4, 5],
  "total": 12,
  "isCriticalSuccess": false,
  "isCriticalFail": false,
  "seed": 42,
  "timestamp": "2026-04-07T..."
}
```

#### `diceParser.js` — spec
- Supporte : `dX`, `NdX`, `NdX+M`, `NdX-M`
- `crypto.randomInt` natif Node.js — pas de dépendance externe
- Retourne : `{ rolls, total, formula, seed, dieType }`
- `dieType` : `'d20'` si formule simple, `null` si mixte ou modificateur
  → utilisé pour lookup `dice_config` côté serveur
- `seed` : dérivé des rolls (préparé pour animation 3D future)

#### Évaluation critiques côté serveur
```javascript
// Lecture dice_config depuis campaigns
const campaign = await db('campaigns').where({ id: socket.campaignId }).first()
const diceConfig = campaign?.dice_config
// Si dieType connu et config présente :
const dieConfig = diceConfig?.[dieType]
isCriticalSuccess = dieConfig?.success
  ? total >= dieConfig.success.min && total <= dieConfig.success.max
  : false
isCriticalFail = dieConfig?.fail
  ? total >= dieConfig.fail.min && total <= dieConfig.fail.max
  : false
```

#### Animation CSS (phase simple)
`@keyframes diceRoll` sur l'icône dé dans le message — rotation + rebond, 800ms.
Déclenché à l'apparition d'un nouveau message `type: 'dice'` dans le fil.
Le `seed` est généré et inclus dans le payload mais non utilisé côté client en phase simple.
Préparé pour l'animation 3D R3F future (Chantier 8+).

### Prochaine étape
Chantier 6 — Étapes C + E : `diceParser.js` + handler `DICE_ROLL` serveur
+ handler `DICE_RESULT` client + rendu Sidebar.

Fichiers à uploader en début de prochaine session :
- `server/src/socket/index.js` ✅ (lu — placeholder DICE_ROLL connu)
- `client/src/components/Sidebar.jsx` ✅ (lu — rendu messages connu)
- `client/src/pages/SessionPage.jsx` ✅ (lu — handler DICE_RESULT à ajouter)
- `client/src/locales/fr.json` ✅ (lu — clés dés résultats à ajouter)
---

## Session 18 — 2026-04-07 — Chantier 6 : Étapes C + E + correctifs

### Contexte de reprise
Session 17 (suite) stable confirmée. Démarrage session 18 — implémentation complète dés :
parser serveur, broadcast résultat, rendu Sidebar, puis correctifs UX post-validation.

---

### Chantier 6 — Étapes C + E ✅

#### Fichiers créés

**`server/src/lib/diceParser.js`** — nouveau
- `parseDice(formula)` async — export nommé
- Regex `^(\d+)?d(\d+)([+-]\d+)?$i` — supporte `dX`, `NdX`, `NdX+M`, `NdX-M`
- `crypto.randomInt(1, faces + 1)` — zéro dépendance externe
- `dieType` : toujours non-null pour formule valide (`'d20'`, `'d6'`, etc.)
  Le modificateur est ignoré pour le lookup `dice_config` — décision session 18 :
  les critiques sont évalués sur le total (modificateur inclus) mais le type de dé
  est déterminé par les faces uniquement, pas par la présence d'un modificateur.
- `seed` : XOR de tous les rolls — entier, préparé pour animation 3D future
- Gardes : count [1→100], faces [2→1000]
- Lève une `Error` explicite si formule invalide ou hors bornes

**`server/src/routes/dice.js`** — nouveau
- `POST /api/dice/roll` — route REST standalone, hors session socket
- `{ requireAuth }` — import nommé (pas default)
- Retourne `{ rolls, total, formula, dieType, seed }` sans broadcast ni dice_config
- Erreur formule invalide → 400 (pas 500)

#### Fichiers modifiés

**`server/src/index.js`**
- Import `diceRouter` ajouté
- Montage `app.use('/api/dice', diceRouter)` après `/api/users`

**`server/src/socket/index.js`**
- Import `parseDice` ajouté
- Handler `DICE_ROLL` remplacé (placeholder → implémentation complète, async)
- Guard `if (!socket.campaignId) return` en tête
- 4 étapes : parseDice → couleur DB → dice_config → broadcast DICE_RESULT
- Lecture couleur : pattern identique CHAT_MESSAGE (try/catch indépendant, fallback `'#5b8dee'`)
- Lecture dice_config : try/catch indépendant — erreur DB → critiques désactivés silencieusement
- Évaluation critiques : `total >= cfg.min && total <= cfg.max` (plage inclusive)
- Broadcast `WS.DICE_RESULT` à `io.to(socket.campaignId)` — tous les membres de la room
- Formule invalide → log serveur, aucun broadcast

**`client/src/pages/SessionPage.jsx`**
- Handler `WS.DICE_RESULT` ajouté dans le useEffect socket (après CHARACTER_UPDATED)
- `addMessage({ id: \`dice-${userId}-${timestamp}\`, type: 'dice', ... })`

**`client/src/components/Sidebar.jsx`**
- `IconDice` SVG ajouté (D6 5 points, 14×14px, currentColor)
- `messagesEndRef` + auto-scroll `scrollIntoView({ behavior: 'smooth' })` à chaque nouveau message
- `animatingDiceId` state + `lastDiceIdRef` + useEffect animation (Option B — timer 800ms)
- `@keyframes diceRoll` + `.dice-icon-animating` dans `<style>` tag dans le return principal
  (hors bloc conditionnel `activeTab === 'chat'` — toujours dans le DOM)
- Animation via `className="dice-icon-animating"` (pas style inline) — redéclenche à chaque ajout
- 3e branche `if (msg.type === 'dice')` dans le `map` messages
  Rendu : icône animée (couleur lanceur) + nom + heure + badges critiques + formule + rolls + total
- Commandes chat `/r <formule>` et `/roll <formule>` interceptées dans `sendMessage`
  → `socket.emit(WS.DICE_ROLL, { formula })`, pas de CHAT_MESSAGE, setChatInput('')
- Styles ajoutés : `messageDice`, `diceCritSuccess`, `diceCritFail`, `diceHeader`, `diceIcon`,
  `diceIconAnimating`, `diceBody`, `diceFormula`, `diceRolls`, `diceEquals`, `diceTotal`,
  `badgeCritSuccess`, `badgeCritFail`

**`client/src/locales/fr.json`**
- `dice.advanced` : "Jet avancé"
- `dice.criticalSuccess` : "Réussite critique"
- `dice.criticalFail` : "Échec critique"

---

### Correctifs UX post-validation

#### Correctif 1 — Position bouton DicePanel

**Symptôme :** bouton dé bas-gauche (position fixe `left: 20, bottom: 20`) non optimal.
**Correction :** bouton déplacé en haut-droite du Canvas3D, collé à la Sidebar.

**`client/src/components/DicePanel.jsx`**
- Nouvelles props : `sidebarVisible` (bool), `sidebarWidth` (number)
- Position bouton : `right = sidebarVisible && sidebarWidth ? sidebarWidth + 12 : 12`, `top: 48px`
  (48px = sous la barre GM 40px + marge 8px — dérive vers la droite si sidebar fermée)
- Fond bouton : `#16162a` → `#2a2a4a`, bordure `#2a2a3e` → `#3a3a5e`, icône `#8888a8` → `#9090c0`

**`client/src/pages/SessionPage.jsx`**
- `<DicePanel>` reçoit `sidebarVisible={sidebarVisible}` et `sidebarWidth={sidebarWidth}`

#### Correctif 2 — Labels dés cliquables (1dX)

**Symptôme :** grille commençait à 2 dés — impossible de lancer 1dX depuis la grille.
**Correction :** labels D4/D6/D8/D10/D12/D20/D100 rendus comme boutons cliquables.
- Clic sur label → `emitRoll(dieFormula)` → lance `1dX`
- Style `labelBtn` ajouté (même apparence, curseur pointer, hover implicite)

---

### Décisions techniques session 18

**dieType avec modificateur** : toujours non-null. `2d6+3` → `dieType: 'd6'`.
Le modificateur est ignoré pour le lookup dice_config (les critiques s'appliquent
au type de dé, pas à la formule complète). Correction par rapport à la spec initiale
qui disait `null` si modificateur — abandonnée après réflexion métier.

**requireAuth import nommé** : `middleware/auth.js` exporte `requireAuth` en named export,
pas en default. Erreur découverte au premier SR — corrigée immédiatement.
Ajouté dans CONVENTIONS.md (piège à ne pas reproduire).

**Animation dé — className vs style inline** : style inline `animation:` ne redéclenche pas
l'animation si le nœud DOM existe déjà. Solution : classe CSS `.dice-icon-animating`
ajoutée/retirée via `animatingDiceId` state — le navigateur redéclenche à chaque ajout.

**`<style>` tag animation** : doit être dans le return principal (toujours dans le DOM),
pas dans le bloc conditionnel `{activeTab === 'chat' && ...}`. Si l'onglet n'est pas actif
au moment de la réception, le keyframe est inconnu → animation silencieuse.

---

### Validation fonctionnelle session 18
- ✅ SR sans erreur
- ✅ Clic dé dans DicePanel → résultat visible dans le fil chat (formule + rolls + total)
- ✅ Auto-scroll vers le bas à chaque nouveau message
- ✅ Badge "Réussite critique" / "Échec critique" si dice_config configurée et seuil atteint
- ✅ Aucune régression sur chat, système, personnages
- ✅ Labels D4→D100 cliquables → lance 1dX
- ✅ Bouton DicePanel haut-droit canvas, collé à la sidebar, dérive si fermée
- ✅ Fond bouton plus visible (#2a2a4a)
- ⬜ Animation dé — en cours de validation (correctif className livré)
- ⬜ /r et /roll — en cours de validation

### Prochaine étape
Chantier 7 — Tests routes critiques serveur.

## Session 19 — 2026-04-07 — Calque GM + correctifs couleurs tokens

### Contexte de reprise
Session 18 stable confirmée. Chantier 7 mis en pause (reporter après fin Phase 2).
Démarrage session 19 — Calque GM + correctifs issus des tests.

### Travail effectué

#### Calque GM — filtrage client
**`client/src/components/Canvas3D.jsx`**
- Filtre `tokens.filter(token => isGm || token.layer !== 'gm')` ajouté dans le rendu Scene
- Tokens `layer='gm'` invisibles pour les joueurs côté client
- Côté serveur : filtrage déjà présent dans `GET /battlemaps/:id` (`.whereNot({ layer: 'gm' })`)

#### Calque GM — indicateur visuel pour le GM
**`client/src/components/Canvas3D.jsx`**
- `TokenRing` : prop `opacity` ajoutée, `baseOpacity = opacity ?? 0.5`
- `TokenMesh` : prop `isGmLayer` ajoutée
- Si `isGmLayer` : opacité 50% sur les matériaux du clone (transparent + opacity 0.5)
- Si `isGmLayer` : anneau à opacity 0.25
- Si `isGmLayer` : `fillOpacity={0.5}` sur le label Text
- Si `isGmLayer` : second Text `⊘ GM` violet (#a855f7) au-dessus du label
- `isGmLayer` ajouté au dependency array du useMemo clonedScene

#### Bug layer hardcodé — SessionPage
**`client/src/pages/SessionPage.jsx`**
- `handleCharacterDrop` : `layer: 'token'` remplacé par `layer` (état SessionPage)
- `layer` ajouté au dependency array du useCallback
- Désormais, un drop depuis la Sidebar crée le token sur le calque actif (token ou gm)

#### Bug couleur characters — characters.js
**`server/src/routes/characters.js`**
- `PUT /characters/:id` : quand `user_id` change, recalcul automatique de `color`
  - Désassignation (`user_id: null`) → couleur PNJ par défaut `#4A90D9`
  - Nouvelle assignation → `users.color` du nouveau propriétaire
- Données existantes corrigées via SQL :
  `UPDATE characters SET color = users.color FROM users WHERE characters.user_id = users.id`

### Décisions techniques
- Chantier 7 (tests) reporté après fin Phase 2 — trop tôt, cible mobile
- Indicateur visuel calque GM : opacité 50% + badge `⊘ GM` violet — pas d'icône SVG
  (drei Text ne supporte pas les icônes SVG, Inter ne contient pas les emojis)
- Couleur PNJ par défaut `#4A90D9` conservée — cohérent avec le POST characters

### Validation fonctionnelle
- ✅ Token GM invisible pour les joueurs
- ✅ Token GM visible pour le GM avec opacité 50% + badge ⊘ GM violet
- ✅ Drop sur calque GM actif → token créé avec layer='gm'
- ✅ Couleurs characters corrigées en base (UPDATE 5)
- ✅ Nouveaux tokens →

## Session 20 — 2026-04-08 — Upload portrait/GLB + renommage character

### Contexte de reprise
Session 19 stable confirmée. X-ray et tests automatiques abandonnés.
Démarrage session 20 — Chantier 8 : upload assets characters + renommage.

### Décisions techniques

**objectName fixe sans extension (MinIO)**
`characters/<id>/illustration` et `characters/<id>/model3D` — noms fixes.
`putObject` écrase l'ancien automatiquement (même clé MinIO, bucket sans versioning).
Pas d'extension → Content-Type transmis dans les metadata MinIO au `putObject`.
`assets.js` lit `stat.metaData['content-type']` en priorité sur la détection par extension.

**portrait_url et glb_url stockent le chemin MinIO (objectName) — pas une URL complète.**
URL d'affichage côté client : `${VITE_API_URL}/api/assets/${character.portrait_url}`
Pattern identique à `DEFAULT_TOKEN_URL`. Cohérent avec `/api/assets/:folder/*filePath`.

**glb_url avec ?v=timestamp pour cache busting useGLTF**
`useGLTF` cache par URL (suspend-react). Même fichier MinIO, URL différente → rechargement.
Valeur stockée en base : `characters/<id>/model3D?v=1712345678`.
`assets.js` utilise `req.params.filePath` (pas les query params) → MinIO reçoit le chemin propre.

**useGLTF déplacé dans TokenMesh**
Chaque token charge son propre GLB via `useGLTF(glbUrl)`.
Cache global partagé — si plusieurs tokens utilisent `default.glb`, un seul chargement réseau.
`gltfScene` retourné par `useGLTF` est une référence stable (suspend-react cache par URL).
`useMemo([gltfScene, isGmLayer])` ne se recalcule que si l'URL ou le calque change.
Suppression de `GltfLoader` composant, `gltfScene` state, prop `gltfScene` dans Canvas3D.

**glbUrl calculé dans Scene, passé en prop à TokenMesh**
`characters` déjà disponible via `useCharacterStore()` dans Scene.
`character.glb_url` → URL proxy / null → `DEFAULT_TOKEN_URL`.
TokenMesh ne lit pas de store directement — cohérent avec l'architecture existante.

**Correction bug opacité matériaux (session 19 tardive)**
Les matériaux Three.js sont partagés par référence entre tous les clones du même `gltfScene`.
Sans clone des matériaux, muter `opacity` sur un token GM corrompait tous les autres tokens.
Correction : `cloneMat(mat)` — clone chaque matériau individuellement avant mutation.
Pattern : `child.material = child.material.map(cloneMat)` (array) ou `cloneMat(child.material)` (unique).

**multerGlb — filtre MIME dédié**
`ALLOWED_GLB_MIME_TYPES = ['model/gltf-binary', 'application/octet-stream']`
Séparé de `multerUpload` pour ne pas contaminer le filtre image.
`multerUpload` et `uploadToMinio` existants inchangés — zéro régression.

**Droits upload**
Portrait : GM ou owner (asset visible par tous les membres).
GLB : GM uniquement (asset technique 3D).

**Renommage character**
Icône plume dans le header de CharacterModal, visible GM et owner.
Clic → `<input>` en focus, remplace le `<span>` du nom.
Sauvegarde : blur ou Entrée → `PUT /characters/:id { name }`.
Annulation : Échap → restauration du nom original.
Guard : nom inchangé ou vide → pas d'appel API.

### Fichiers modifiés

**`server/src/middleware/upload.js`**
- `ALLOWED_GLB_MIME_TYPES` ajouté : `['model/gltf-binary', 'application/octet-stream']`
- `glbFileFilter` ajouté
- `multerGlb` exporté — filtre dédié GLB
- `multerUpload`, `uploadToMinio` inchangés

**`server/src/routes/assets.js`**
- `stat.metaData?.['content-type']` lu en priorité sur `getContentType(filePath)`
- Permet de servir correctement les assets sans extension (portrait, model3D)
- Fallback extension conservé pour les assets existants

**`server/src/routes/characters.js`**
- Import `multerUpload`, `multerGlb`, `getMinioClient`, `BUCKET` ajoutés
- Helper `broadcastCharacterUpdate(characterId, app)` factorisé (SELECT complet + broadcast)
- `POST /characters/:id/portrait` — GM ou owner — multerUpload + minio.putObject + UPDATE portrait_url
- `POST /characters/:id/glb` — GM uniquement — multerGlb + minio.putObject + UPDATE glb_url avec ?v=timestamp
- Routes existantes (GET, POST, PUT, DELETE) inchangées

**`client/src/components/Canvas3D.jsx`**
- `GltfLoader` composant supprimé
- `gltfScene` useState supprimé
- `Scene` : suppression prop `gltfScene`, calcul `glbUrl` par token depuis `characters`
- `TokenMesh` : prop `gltfScene` → prop `glbUrl` + `useGLTF(glbUrl)` interne
- `useMemo clonedScene` : deps `[gltfScene, isGmLayer]` (gltfScene = retour useGLTF, stable)
- Correction bug matériaux partagés : `cloneMat(mat)` clone chaque matériau avant mutation
- Guard `{gltfScene && tokens.map(...)}` supprimé — tokens se rendent dès `packsLoaded`

**`client/src/components/Sidebar.jsx`**
- `IconPen` SVG ajouté (plume 13×13px, currentColor)
- `CharacterModal` :
  - `canEditName = isGm || isOwner`
  - `editingName` state + `nameInput` state
  - `handleNameSave` : PUT + updateCharacter + onCharacterUpdate + guard nom inchangé/vide
  - `handleNameKeyDown` : Entrée → save, Échap → annulation
  - Header : `<input>` si editingName, sinon `<span>` + bouton plume si canEditName
  - `canUploadPortrait = isGm || isOwner`
  - `portraitUploading` + `glbUploading` states
  - `handlePortraitUpload` : POST multipart `/characters/:id/portrait`
  - `handleGlbUpload` : POST multipart `/characters/:id/glb`
  - Bloc illustration : `<img>` si `portrait_url`, sinon placeholder + bouton upload
  - Onglet settings : bouton upload GLB (GM uniquement)
  - Styles ajoutés : `portraitImg`, `uploadBtn`, `nameInput`, `namePenBtn`
  - Style `illustrationPlaceholder` étendu : `flexDirection: column`, `minHeight`, `padding`

**`client/src/locales/fr.json`**
- `character.portraitAlt`, `character.portraitUpload`, `character.portraitUploading`
- `character.glbUpload`, `character.glbUploading`
- `character.rename`

### Validation fonctionnelle
- ✅ Upload portrait → image affichée immédiatement dans la modale
- ✅ Upload GLB → token 3D mis à jour sur la carte en temps réel (broadcast CHARACTER_UPDATED)
- ✅ Fallback default.glb si pas de glb_url
- ✅ Renommage character — blur/Entrée sauvegarde, Échap annule
- ✅ Tokens non-GM : opacité normale (correction bug matériaux partagés)
- ✅ Tokens GM : opacité 50% + badge ⊘ GM (comportement session 19 préservé)
- ✅ SR sans erreur — aucune régression sur routes existantes

### Pièges documentés (nouveaux)

**P_assets_content_type** — assets sans extension
`portrait_url` et `glb_url` stockent le chemin MinIO sans extension.
`assets.js` lit `stat.metaData['content-type']` (metadata MinIO) pour le Content-Type.
Si un asset est uploadé sans metadata Content-Type → fallback `application/octet-stream`.
Toujours passer `{ 'Content-Type': req.file.mimetype }` dans `minio.putObject`.

**P_glb_cache_busting** — useGLTF cache par URL
`glb_url` en base inclut `?v=<timestamp>` pour forcer le rechargement après remplacement.
`assets.js` utilise `req.params.filePath` (hors query params) → MinIO reçoit le chemin propre.
Ne jamais stocker `glb_url` sans le `?v=` — le token afficherait l'ancien modèle après upload.

**P_material_clone** — matériaux Three.js partagés par référence
`SkeletonUtils.clone(gltfScene)` clone le graphe de scène mais PAS les matériaux.
Tous les clones du même `gltfScene` partagent les mêmes objets matériau.
Muter `opacity` sans cloner corrompt tous les tokens utilisant le même GLB.
Toujours `mat.clone()` avant toute mutation de matériau dans `useMemo clonedScene`.
## Session 23 — 2026-04-09 — Chantier 9A-1 : Migrations + routes serveur

### Contexte de reprise
Session 22 stable confirmée (planification — aucun code).
Session 23 = première session de code du Chantier 9A.
Préalable : définition du pack de textures de démarrage (univers Polaris, hard-SF sous-marine).

### Décisions prises

**Pack de démarrage — structure-station**
- Ancien pack `hard-sf` abandonné — contenu de test jetable, MinIO vidé
- Nouveau pack : `name: 'structure-station'`, `label: 'Structure de station'`
- Univers Polaris (Philippe Tessier) — hard-SF sous-marine
- 4 catégories : Sol, Mur, Fenêtre, Bloc — extensibles par l'utilisateur via interface 9B
- 78 blocs, tous `geometry: 'cube'` en V1
- Textures PNG 64/128/256px — source Minecraft resourcepacks
- Chemins MinIO : `textures/structure-station/<categorie>/<fichier>.png`
- UUID pack fixe : `b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e`
- Manifest transport ZIP généré : `textures/structure-station/manifest.json`

**Format migrations : .js (ES module)**
La MISSION spécifiait `.cjs` — toutes les migrations existantes (01→20) sont en `.js`.
Les nouvelles migrations 21→26 sont produites en `.js` avec `export const up/down`.
Écart documenté — MISSION à corriger en session suivante si besoin.

**Recalcul battlemap_block_usage dans PUT /voxels**
Après chaque save voxel, DELETE + INSERT dans `battlemap_block_usage`.
Guard `if (usedIds.length > 0)` avant l'INSERT — carte vide = pas d'INSERT.

**Routes lock/heartbeat**
3 routes ajoutées dans `battlemaps.js` :
- `POST /:id/editor-lock` — acquire lock (60s), 423 si locké par autre GM
- `DELETE /:id/editor-lock` — libère le lock (titulaire uniquement)
- `POST /:id/editor-heartbeat` — renouvelle le lock (+60s, titulaire uniquement)

### Fichiers créés/modifiés

**`server/src/db/migrations/`**
- `21_texture_packs.js` — table texture_packs
- `22_battlemaps_editor_lock.js` — colonnes editor_locked_by + editor_locked_until sur battlemaps
- `23_block_types.js` — tables texture_pack_categories + block_types (ordre FK obligatoire)
- `24_seed_structure_station.js` — seed pack structure-station (4 catégories, 78 blocs)
- `25_voxel_data_format.js` — conversion one-shot voxel_data entier → { id, r }
- `26_battlemap_block_usage.js` — table battlemap_block_usage (PK composite)

**`server/src/routes/block-types.js`** — nouveau
- `GET /api/block-types` — tous les blocs non deprecated (palette)
- `GET /api/block-types?ids=1,3,7` — blocs par IDs (Canvas3D au chargement)
- JOIN texture_packs pour pack_name + tile_size

**`server/src/routes/texture-packs.js`** — nouveau (lecture seule 9A)
- `GET /api/texture-packs` — liste packs avec block_count
- `GET /api/texture-packs/:id` — détail pack + catégories + blocs

**`server/src/routes/battlemaps.js`** — modifié
- `PUT /:id/voxels` : recalcul battlemap_block_usage après save
- `POST /:id/editor-lock` — nouveau
- `DELETE /:id/editor-lock` — nouveau
- `POST /:id/editor-heartbeat` — nouveau

**`server/src/index.js`** — modifié
- Import + montage `/api/block-types` et `/api/texture-packs`

**`textures/structure-station/manifest.json`** (MinIO)
- Format transport ZIP — 78 blocs avec localIds 1→78, 4 catégories

### Validation fonctionnelle
- ✅ 26 migrations appliquées (batch 10) sans erreur
- ✅ `GET /api/block-types` → 78 blocs, geometry + textures + pack_name corrects
- ✅ `GET /api/block-types?ids=1,3` → 2 blocs exacts
- ✅ `GET /api/texture-packs` → pack structure-station, block_count: 78
- ✅ `POST /api/battlemaps/:id/editor-lock` → `{ ok: true, lockedUntil: ... }`
- ✅ SR sans erreur — aucune régression routes existantes

### Points de vigilance session suivante (9A-2)
- `textures.js` ancienne route : crashe si un fichier non-JSON est dans MinIO — `liste.txt` supprimé en session 23, vigilance à maintenir
- Session 9A-2 : VOXEL_ADD socket + Canvas3D refonte — déploiement atomique obligatoire (P27)

## Session 24 — 2026-04-09 — Chantier 9A-2 : WS + Canvas3D refonte

### Contexte de reprise
Session 23 stable confirmée (migrations 21→26, routes block-types/texture-packs/lock).
Session 24 = deuxième session de code du Chantier 9A — déploiement atomique WS + Canvas3D.

### Décisions prises

**Déploiement atomique confirmé**
socket/index.js et Canvas3D.jsx livrés dans la même session — règle P27 respectée.

**`makeMat` retourne toujours `MeshLambertMaterial`**
Pour garantir la cohérence de type avec le pattern spread JSX existant `<meshLambertMaterial {...mat} />`.
Cas texture absente : `MeshLambertMaterial({ color: 0xFF00FF })` — pas de `MeshBasicMaterial`.
Décision : homogénéité de type > économie de constructeur.

**`battlemapId` dans les dépendances du useEffect WS**
`handleVoxelUpdated` capture `battlemapId` en closure.
Sans `battlemapId` dans `[socket, battlemapId]`, le handler garderait l'ancien ID après MAP_SWITCH.
Ajout `battlemapId` aux dépendances — les listeners sont recréés proprement au changement de carte.

**`save()` supprimé de Canvas3D**
Confirmé par MISSION étape 21 et PLAN_VOXELS : `save()` déménage dans Editor3D (session 9A-3).
Canvas3D est maintenant lecture seule — zéro `socket.emit`, uniquement `socket.on`.

### Fichiers modifiés

**`shared/events.js`**
- +2 constantes après VOXEL_REMOVED : `VOXEL_UPDATE: 'voxel:update'` + `VOXEL_UPDATED: 'voxel:updated'`

**`server/src/socket/index.js`**
- Handler VOXEL_ADD : destructuring `mat` → `{ id, r }`, `next` et broadcast mis à jour
- Handler VOXEL_UPDATE : nouveau, inséré entre VOXEL_REMOVE et MAP_SWITCH
  - Guard battlemapId (identique VOXEL_ADD)
  - Guard race condition : `if (!voxels[key]) return`
  - UPDATE `{ ...voxels[key], r }` — préserve `id`, écrase `r`
  - Broadcast VOXEL_UPDATED avec `{ battlemapId, x, y, z, r }`

**`client/src/components/Canvas3D.jsx`** — refonte complète
- `loadPackTextures` → `loadBlockTextures(blocks)` : charge par IDs, priorité faces (spécifique > all > magenta), `MeshLambertMaterial` homogène
- Composant `Voxel` réécrit : props `blockData` + `rotation`, géométries (slab/slope/wedge placeholder), bbox invisible raycasting (P23)
- Props `Canvas3D` : `mode/activeMaterial/onPackLoaded` supprimés — `{ onTokenDoubleClick, socket }` uniquement
- États : `materials/packsLoaded` → `blockMaterials/blocksReady`
- `isDirty` ref, `saveTimer` ref, `save()`, `handleDirty`, useEffects auto-save + prevMode : supprimés
- Init `voxel_data` : `map[key] = { x, y, z, mat }` → `map[key] = { x, y, z, id: val.id, r: val.r }`
- Chargement : `api.get('/textures')` → `api.get('/block-types?ids=...')` + guard P26
- WS listeners : `handleVoxelAdded` mis à jour `{ id, r }` + `handleVoxelUpdated` ajouté, deps `[socket, battlemapId]`
- `handleClick` + listeners mousedown/contextmenu : supprimés (déménagent Editor3D)
- Gate : `packsLoaded` → `blocksReady`
- Props `<Scene>` : alignées (blockMaterials, suppression mode/activeMaterial/materials/onDirty)

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ Voxels existants (migrés migration 25) affichés avec textures correctes
- ✅ Carte sans voxels — Scene montée, tokens visibles (guard P26 actif)
- ⏳ VOXEL_ADD/REMOVE temps réel — testé en 9A-3 (nécessite Editor3D)
- ⏳ save() payload `{ id, r }` — testé en 9A-3

### Pièges documentés (rappel)
- P27 — VOXEL_ADD déploiement atomique : respecté dans cette session
- P26 — blocksReady gate : implémenté avec guard `blockIds.length === 0`
- P3 — socket dans dependency arrays : `[socket, battlemapId]` dans le useEffect WS

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

## Session 15 — 2026-04-06

### Contexte de reprise
Chantiers 1 ✅, 2 ✅, 3 ✅, 4 partiel ✅, 5 étape 1/4 ✅ — session 14.
Session 15 : Chantier 5 étape 2/4 — characterStore + migration complète des props données.

---

### Chantier 5 — étape 2/4 : characterStore + migration stores dans Canvas3D et Sidebar ✅

#### Pourquoi cette étape va plus loin que la spec initiale

La spec prévoyait uniquement le characterStore. Après analyse, il est apparu que :
- Migrer characterStore sans migrer les props de Canvas3D et Sidebar aurait laissé
  SessionPage comme intermédiaire inutile (il aurait lu le store puis repassé les données en props)
- L'objectif documenté du Chantier 5 dans MISSION_chantier est explicite :
  "Aucune prop de données ne transite plus par SessionPage vers Canvas3D ou Sidebar"
- Faire A maintenant et B dans 2 semaines n'a aucun intérêt — une seule session cohérente

Decision validée avant de coder : migrer les 4 fichiers en une session.

#### Recherche effectuée — Zustand dans R3F Canvas

Vérification documentée : les stores Zustand créés avec `create()` sont globaux (module JS),
pas basés sur React Context. Ils fonctionnent à l'intérieur de `<Canvas>` R3F sans aucune
configuration supplémentaire. C'est la solution recommandée officiellement par l'équipe R3F
pour partager l'état entre le monde DOM et le monde Canvas.
Référence : https://github.com/react-spring/react-three-fiber/issues/114

#### `client/src/stores/characterStore.js` — nouveau fichier

6 actions couvrant tous les cas de mutation :

- `setCharacters(characters)` — remplacement complet (loadSession, changement de carte)
- `setMembers(members, userId)` — remplacement complet + calcul isGm atomique en interne.
  Une seule action pour garantir que members et isGm ne sont jamais désynchronisés.
- `addCharacter(character)` — ajout simple (création depuis Sidebar)
- `removeCharacter(characterId)` — suppression (handleDelete dans CharacterModal)
- `updateCharacter(partial)` — mise à jour partielle par id (description, gm_notes, visible, user_id)
- `upsertCharacter(character)` — ajout ou remplacement selon existence (handler WS CHARACTER_UPDATED).
  Couvre les deux cas : character mis à jour et character nouvellement visible pour un joueur.

#### `client/src/pages/SessionPage.jsx` — adapté

Suppressions :
- `useState` pour `characters`, `members`, `isGm` — remplacés par `useCharacterStore()`
- `handleTokenMove` et `handleTokenDelete` — supprimés (relayaient vers le store sans logique ajoutée)

Modifications :
- `loadSession` : `setMembers(members, user?.id)` remplace les 3 setters séparés
- Handler `CHARACTER_UPDATED` : `setCharacters(prev => ...)` → `upsertCharacter(updatedCharacter)`
- `handleCharacterDrop` : `characters` lu depuis le store (dependency array inchangé)
- `handleTokenDoubleClick` : `characters` et `isGm` lus depuis le store
- `handleContextMenuDelete` : appelle `removeToken` directement (plus de `handleTokenDelete`)

Props Canvas3D supprimées : `tokens`, `characters`, `isGm`, `user`, `onTokenMove`, `onTokenDelete`
Props Sidebar supprimées : `isGm`, `characters`, `onCharactersChange`, `campaignMembers`

#### `client/src/components/Sidebar.jsx` — adapté

- Props supprimées : `isGm`, `characters`, `onCharactersChange`, `campaignMembers`
- Ajout : `import { useCharacterStore }` — `characters`, `members`, `isGm`, `addCharacter` lus depuis le store
- `handleCreateCharacter` : `onCharactersChange(prev => [...prev, char])` → `addCharacter(char)`
- `CharacterModal` : prop `onCharactersChange` supprimée, remplacée par `useCharacterStore` direct
  - `updateCharacter({ id, description })` — description blur
  - `updateCharacter({ id, gm_notes })` — gm_notes blur
  - `updateCharacter({ id, visible })` — toggle visible
  - `updateCharacter(updated)` — assign user
  - `removeCharacter(id)` — suppression
  - `members` lu depuis le store pour le select d'assignation propriétaire
- `CharacterModal` prop `socket` supprimée (n'était plus utilisée après Chantier 1)

#### `client/src/components/Canvas3D.jsx` — adapté

- Props supprimées : `tokens`, `characters`, `isGm`, `user`, `onTokenMove`, `onTokenDelete`
- `Scene` : ajout `import { useTokenStore }`, `import { useCharacterStore }`, `import { useAuthStore }`
- `Scene` lit directement : `tokens`, `updateToken`, `removeToken` (tokenStore) /
  `characters`, `isGm` (characterStore) / `user` (authStore)
- `handlePointerUp` : `onTokenMove(res.data.token)` → `updateToken(res.data.token)` (store direct)
- `handleKeyDown` : `onTokenDelete(selectedTokenId)` → `removeToken(selectedTokenId)` (store direct)
- Canvas3D exporté : props réduites à `battlemap`, `mode`, `activeMaterial`,
  `onVoxelDataChange`, `onPackLoaded`, `onTokenDoubleClick`, `socket`

---

### Fichiers modifiés session 15

- `client/src/stores/characterStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — characterStore + suppressions useState + nettoyage props
- `client/src/components/Sidebar.jsx` — characterStore direct + suppressions props
- `client/src/components/Canvas3D.jsx` — tokenStore/characterStore/authStore directs + suppressions props

### Validation fonctionnelle session 15
- ✅ Drag token GM → joueur voit en temps réel
- ✅ Création token depuis Sidebar → token apparaît, pas de doublon
- ✅ Suppression token (Suppr + menu contextuel) → disparaît pour tous
- ✅ Changement de carte → tokens rechargés correctement
- ✅ Onglet Persos → liste des characters visible, drag vers canvas fonctionnel
- ✅ Onglet Joueurs → membres listés avec présence en ligne
- ✅ Toggle visible character (GM) → modale fonctionne
- ✅ Création character → apparaît dans la liste
- ✅ Suppression character → disparaît de la liste
- ✅ Chat → fonctionnel

### Prochaine étape
Chantier 5 étape 3/4 : mapStore (battlemap, battlemaps).

## Session 16 — 2026-04-07

### Contexte de reprise
Chantier 5 étapes 1/4 ✅, 2/4 ✅ — session 15.
Session 16 : Chantier 5 étape 3/4 — mapStore (battlemap, battlemaps).

---

### Chantier 5 — étape 3/4 : mapStore ✅

#### Décisions techniques

**`voxels` conservé dans Canvas3D — divergence documentée avec la MISSION**
La MISSION prévoyait `voxels` dans mapStore. Décision après analyse :
`voxels` est un état de rendu interne à Canvas3D, muté en temps réel à chaque clic
(plusieurs fois par seconde en mode édition). Le globaliser créerait des re-renders
sur tous les composants abonnés à chaque pose/suppression. Aucun composant hors
Canvas3D n'en a besoin. Reste en `useState` local à Canvas3D.

**`onVoxelDataChange` supprimée**
Ce callback appelait `setBattlemap(prev => ({...prev, voxel_data: data}))` dans
SessionPage après une sauvegarde REST. Analyse : Canvas3D réinitialise `voxels`
uniquement sur changement de `battlemap?.id` (pas de `voxel_data`). La mise à jour
était sans effet observable — supprimée proprement.

**`renameBattlemap(id, name)` — action atomique**
Le renommage touchait deux états simultanément : `battlemaps` (liste) ET `battlemap`
(carte active si renommée). Une action atomique dans le store garantit qu'ils ne
peuvent jamais être désynchronisés.

**`remaining` calculé avant `removeBattlemap`**
Dans `handleMapDelete`, `remaining = battlemaps.filter(...)` est calculé AVANT
l'appel à `removeBattlemap(bm.id)` — même principe que le pattern React `setState`
asynchrone : la valeur lue est celle avant la mutation.

#### `client/src/stores/mapStore.js` — nouveau fichier

5 actions :
- `setBattlemap(battlemap)` — remplacement complet (loadSession, loadMap, MAP_SWITCH)
- `setBattlemaps(battlemaps)` — remplacement complet (loadSession)
- `renameBattlemap(id, name)` — renomme dans la liste ET dans battlemap active (atomique)
- `addBattlemap(battlemap)` — ajout dans la liste (duplication, création)
- `removeBattlemap(battlemapId)` — suppression de la liste

#### `client/src/pages/SessionPage.jsx` — adapté

- `useState(battlemap)` et `useState(battlemaps)` supprimés → `useMapStore()`
- `handleMapRename` : 2 mutations séparées → `renameBattlemap(id, name)` atomique
- `handleMapDuplicate` : `setBattlemaps(prev => [...prev, bm])` → `addBattlemap(bm)`
- `handleMapCreate` : idem → `addBattlemap(bm)`
- `handleMapDelete` : `setBattlemaps(prev => prev.filter(...))` → `removeBattlemap(id)`
- `onVoxelDataChange` supprimée des props Canvas3D

#### `client/src/components/Canvas3D.jsx` — adapté

- Prop `battlemap` supprimée — lue depuis `useMapStore()` directement
- Prop `onVoxelDataChange` supprimée — mise à jour était sans effet observable
- `save()` simplifié : plus d'appel `onVoxelDataChange` après la sauvegarde REST
- Props Canvas3D exporté réduites à : `mode`, `activeMaterial`, `onPackLoaded`,
  `onTokenDoubleClick`, `socket`

---

### Fichiers modifiés session 16

- `client/src/stores/mapStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — mapStore + suppressions useState + nettoyage props
- `client/src/components/Canvas3D.jsx` — useMapStore direct + suppression prop battlemap/onVoxelDataChange

### Validation fonctionnelle session 16
- ✅ Chargement de session → voxels s'affichent correctement
- ✅ Poser/supprimer un voxel → visible pour tous en temps réel
- ✅ Sauvegarde voxels (passage edit → play) → persistée en base
- ✅ Changer de carte via barre GM → carte et tokens rechargés
- ✅ Renommer une carte → nom mis à jour dans la barre ET dans le titre si carte active
- ✅ Dupliquer / créer / supprimer une carte → liste mise à jour correctement
- ✅ Déplacer le groupe → tous les joueurs changent de carte

### Prochaine étape
Chantier 5 étape 4/4 : sessionStore (onlineUsers, messages) + reconnexion robuste Bug C.

---

## Session 17 — 2026-04-07

### Contexte de reprise
Chantier 5 étapes 1/4 ✅, 2/4 ✅, 3/4 ✅ — session 16.
Session 17 : Chantier 5 étape 4/4 — sessionStore + reconnexion robuste Bug C.

---

### Chantier 5 — étape 4/4 : sessionStore + Bug C ✅

#### Décision architecturale — divergence avec la MISSION

La MISSION prévoyait :
- SESSION_STATE côté serveur (socket/index.js modifié, shared/events.js modifié)
- sessionStore gérant le cycle de vie socket + handler `connect` pour ré-émettre SESSION_JOIN
- Problème : `connect` se déclenche à la connexion initiale ET à la reconnexion → double chargement

**Solution retenue — plus simple et plus robuste :**

`socket.io.on('reconnect', ...)` sur le **Manager** socket.io (pas sur l'instance socket).
Depuis socket.io v3, les événements de reconnexion sont sur le Manager (`socket.io`),
pas sur le socket. `socket.io.on('reconnect')` se déclenche **uniquement** lors d'une
reconnexion automatique — pas à la connexion initiale. Zéro ambiguïté, zéro flag.

```javascript
s.io.on('reconnect', () => {
  setReconnectTrigger(n => n + 1)
})
```

Cela déclenche le useEffect socket entier : nouvelle instance socket créée,
SESSION_JOIN ré-émis, `loadSession` rechargé → état complet resynchronisé depuis le serveur.
C'est exactement le même mécanisme que le bouton "Reconnexion" manuel de l'onglet Config,
maintenant automatisé.

**Avantages :** zéro modification serveur, zéro nouvelle constante WS, pas de double chargement.

#### `client/src/stores/sessionStore.js` — nouveau fichier

5 actions :
- `setOnlineUsers(onlineUsers)` — remplacement complet (SESSION_JOINED)
- `addOnlineUser(userId)` — ajout (SESSION_USER_JOINED)
- `removeOnlineUser(userId)` — suppression (SESSION_USER_LEFT)
- `addMessage(message)` — ajout d'un message (chat, système, futur : dés)
- `resetSession()` — reset complet (disponible pour usage futur)

#### `client/src/pages/SessionPage.jsx` — adapté

- `useState(messages)` et `useState(onlineUsers)` supprimés → `useSessionStore()`
- Handlers WS branchés sur les actions du store :
  - SESSION_JOINED → `setOnlineUsers(new Set([userId, ...onlineUserIds]))`
  - SESSION_USER_JOINED → `addOnlineUser(userId)` + `addMessage({...})`
  - SESSION_USER_LEFT → `removeOnlineUser(userId)` + `addMessage({...})`
  - CHAT_MESSAGE → `addMessage({...})`
- `s.io.on('reconnect', () => setReconnectTrigger(n => n + 1))` — correction Bug C
- Props Sidebar supprimées : `messages`, `onlineUsers`

#### `client/src/components/Sidebar.jsx` — adapté

- Props `messages` et `onlineUsers` supprimées
- `import { useSessionStore }` ajouté
- `messages` et `onlineUsers` lus directement depuis le store

---

### État final du Chantier 5 — SessionPage après migration complète

**useState restants dans SessionPage (légitimes — état UI local) :**
```
campaign          — utilisé uniquement dans SessionPage (handleSetDefault)
loading           — état de chargement initial
error             — état d'erreur initial
mode              — état UI (edit/play)
layer             — état UI (token/gm)
sidebarVisible    — état UI
sidebarWidth      — état UI
activeMaterial    — état UI
availableMaterials — liste chargée depuis Canvas3D
mapContextMenu    — menu contextuel barre GM
showRenameModal / renameTarget / renameValue  — UI modale renommage
showCreateModal / createMapName              — UI modale création
socket            — cycle de vie socket (migre en sessionStore étape future)
reconnectTrigger  — déclenche le useEffect socket
contextMenu       — menu contextuel token
```

**Stores Zustand opérationnels :**
- `tokenStore` — tokens
- `characterStore` — characters, members, isGm
- `mapStore` — battlemap, battlemaps
- `sessionStore` — onlineUsers, messages

---

### Fichiers modifiés session 17

- `client/src/stores/sessionStore.js` — nouveau fichier
- `client/src/pages/SessionPage.jsx` — sessionStore + Bug C (s.io.on reconnect)
- `client/src/components/Sidebar.jsx` — useSessionStore direct + suppressions props

### Validation fonctionnelle session 17
- ✅ Chat → messages s'affichent correctement
- ✅ Onglet Joueurs → présence en ligne fonctionne
- ✅ Messages système connexion/déconnexion → apparaissent dans le chat
- ✅ Bug C corrigé → redémarrage serveur → reconnexion automatique sans F5
- ✅ Bouton reconnexion manuel (onglet Config) → fonctionne toujours
- ✅ Fonctionnel général → aucune régression

### Chantier 5 — TERMINÉ ✅

Toutes les étapes validées :
- Étape 1/4 : tokenStore ✅ (session 14)
- Étape 2/4 : characterStore + migration Canvas3D/Sidebar ✅ (session 15)
- Étape 3/4 : mapStore ✅ (session 16)
- Étape 4/4 : sessionStore + Bug C ✅ (session 17)

### Prochaine étape
Chantier 6 — Dés (étapes A→E, spec dans MISSION_chantier6).

---

## Session 17 — append — Décision architecturale Chantier 6 : dice_config

### Contexte
Avant toute implémentation du système de dés, analyse complète de la structure
de données pour les seuils critiques. Les colonnes `critical_success` et
`critical_fail` (migration 07, JSONB, jamais utilisées) sont remplacées.

### Décision : JSONB colonne unique `dice_config` sur `campaigns`

**Structure :**
```json
{
  "d20": { "success": { "min": 18, "max": 20 }, "fail": { "min": 1, "max": 1 } },
  "d6":  { "success": { "min": 6,  "max": 6  }, "fail": null },
  "d100":{ "success": null,                      "fail": { "min": 1, "max": 5 } }
}
```

**Règles de nullabilité :**
- Dé absent de la structure = critiques désactivés sur ce dé
- `success: null` = pas de succès critique sur ce dé
- `fail: null` = pas d'échec critique sur ce dé

**Règle d'évaluation serveur :** `total >= min && total <= max` (plage inclusive).
`min === max` = valeur exacte (cas courant — ex: D&D succès sur 20, Polaris sur 1).

**Dés couverts (liste exhaustive) :** d4, d6, d8, d10, d12, d20, d100.

### Pourquoi JSONB et pas 28 colonnes scalaires

Option écartée : 28 colonnes INTEGER (`d4_success_min`, `d4_success_max`, ...).

JSONB retenu car :
1. On ne filtre, indexe, ni agrège jamais sur `dice_config` en SQL — usage
   exclusivement "lire en entier, parser en JS, utiliser". C'est le cas d'usage
   exact pour lequel JSONB existe dans PostgreSQL.
2. 28 colonnes = schéma pollué, ajouter un dé = migration, `PUT /campaigns/:id`
   à 28 paramètres.
3. Le typage PostgreSQL n'apporte rien ici : la validation métier
   (`1 <= min <= max <= faces du dé`) ne peut pas être exprimée par un type SQL
   et doit être faite côté serveur dans tous les cas.

La robustesse réelle vient du **validateur serveur** dans `campaigns.js PUT /:id`,
pas du type SQL.

### Validateur serveur (à implémenter dans campaigns.js)
```javascript
const VALID_DICE  = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DICE_FACES  = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }

// Pour chaque clé de dice_config :
// - clé doit être dans VALID_DICE
// - success et fail sont null ou { min: integer, max: integer }
// - si présent : 1 <= min <= max <= DICE_FACES[dé]
```

### Migration 20
Fichier : `20260407_20_campaigns_dice_config.js`
- `dropColumn('critical_success')`
- `dropColumn('critical_fail')`
- `table.jsonb('dice_config').nullable().defaultTo(null)`

### Couleur dans les résultats de dés
La couleur affichée dans le fil de messages pour un jet de dé = couleur de profil
de l'utilisateur qui lance. Lue depuis la DB dans le handler socket `DICE_ROLL`
(même pattern que `CHAT_MESSAGE`). Jamais depuis le JWT.

---

## Session 17 — suite — Chantier 6 : Migration 20 + Étape A ✅

### Migration 20 — appliquée ✅
Batch 9. Fichier : `20260407_20_campaigns_dice_config.js`
- `dropColumn('critical_success')` — colonne JSONB orpheline supprimée
- `dropColumn('critical_fail')` — idem
- `table.jsonb('dice_config').nullable().defaultTo(null)` — nouvelle colonne
20 migrations stables.

### Chantier 6 — Étape A : Paramètres campagne ✅

#### Fichiers créés / modifiés

**`server/src/routes/campaigns.js`**
- Constantes `VALID_DICE` et `DICE_FACES` ajoutées en tête de fichier
- Fonction `validateDiceConfig(config)` — validateur complet avant écriture :
  - `null` accepté (désactive tous les critiques)
  - seules les clés VALID_DICE acceptées
  - `success` et `fail` : null ou `{ min, max }` avec `1 <= min <= max <= faces`
  - erreurs AppError 400 avec messages explicites
- `PUT /:id` : ajout `dice_config` dans les champs acceptés
  - `JSON.stringify(dice_config)` avant écriture (pattern P8 — cohérent avec voxel_data)
  - `dice_config` ajouté dans le `.returning([...])`

**`client/src/locales/fr.json`**
- `dashboard.settings` ajouté
- Namespace `settings` créé — 29 clés couvrant :
  - navigation page, états (saving, saved, errors)
  - 3 sections (dés, joueurs placeholder, fiche placeholder)
  - mode simple (toggles, labels, aperçu)
  - mode expert (tableau colonnes)

**`client/src/App.jsx`**
- Import `CampaignSettingsPage` ajouté
- Route `/campaigns/:campaignId/settings` ajoutée sous `ProtectedRoute`

**`client/src/pages/DashboardPage.jsx`**
- Bloc `cardActions` ajouté sous `cardFooter` dans chaque carte campagne
- Visible uniquement si `campaign.role === 'gm'`
- Bouton "Configuration" → `navigate(`/campaigns/${campaign.id}/settings`)`
- Style `btnSettings` : lien souligné discret, séparé par une bordure top
- `cursor: 'pointer'` ajouté sur `logoutBtn` et `btnSecondary` (manquant)

**`client/src/pages/CampaignSettingsPage.jsx`** — nouveau fichier
- Route : `/campaigns/:campaignId/settings`
- Charge la campagne via `GET /campaigns/:id` au montage
- Guard : 403 → message "Accès réservé au MJ" + retour Dashboard
  (vérification stricte côté serveur sur le PUT — `requireRole('gm')`)
- Navigation latérale : Dés (active) / Joueurs (placeholder) / Fiche (placeholder)
- Bouton Enregistrer en header + feedback "Configuration enregistrée" (3s)

**Section Dés — trois niveaux imbriqués :**

Niveau 1 — Toggle global "Activer les critiques"
- Si désactivé → `dice_config: null` sauvegardé

Niveau 2 — Mode simple (défaut)
- Réussite critique : checkbox + toggle MIN/MAX
- Échec critique : checkbox + toggle MIN/MAX
- Aperçu D20 SVG inline (placeholder — à remplacer par asset final)
  mis à jour en temps réel selon les toggles
- `buildSimpleConfig()` : applique la règle uniforme à tous les 7 dés
  `MAX` → `{ min: faces, max: faces }` / `MIN` → `{ min: 1, max: 1 }`
- Lien "Mode expert" en bas

Niveau 3 — Mode expert
- Tableau compact : 7 lignes (D4→D100) × colonnes Actif / Succès / Échec
- Chaque critique : checkbox actif + inputs min/max bornés (1 → faces du dé)
- `buildExpertConfig()` : construit dice_config depuis la grille
- Bascule expert → simple : réglages par dé perdus (comportement confirmé)
- Bascule simple → expert : grille initialisée depuis les toggles simples
- Lien "← Mode simple" en bas

**Fonctions utilitaires (toutes pures, hors composant) :**
- `buildSimpleConfig(successOn, failOn)` → dice_config uniforme
- `buildExpertConfig(expertRows)` → dice_config par dé
- `initExpertRows(diceConfig)` → state grille depuis config existante

#### Validation fonctionnelle
- ✅ Bouton "Configuration" visible sur les cartes GM dans le Dashboard
- ✅ Navigation `/campaigns/:id/settings` fonctionnelle
- ✅ Toggle critiques → affiche/masque la section
- ✅ Mode simple → aperçu D20 mis à jour en temps réel
- ✅ Bascule mode expert → tableau 7 lignes
- ✅ Bascule retour mode simple → réinitialisation toggles
- ✅ Sauvegarde → "Configuration enregistrée"
- ✅ SR — aucune régression

### Prochaine étape
Chantier 6 — Étape B : DicePanel (composant flottant + draggable).

---

## Session 17 — suite — Chantier 6 : Étape B ✅

### Chantier 6 — Étape B : DicePanel ✅

#### Fichiers créés / modifiés

**`client/src/components/DicePanel.jsx`** — nouveau fichier
- Composant auto-suffisant — état interne uniquement, aucune prop de données
- Props : `socket`, `mode`
- Deux états : replié (bouton flottant) / déplié (panneau flottant)

**État replié :**
- Bouton rond 44×44px, position fixed bas-gauche (20px, 20px depuis le bas)
- Icône SVG DICE1 fournie par l'utilisateur — nettoyée (carré, currentColor, sans métadonnées)
- `mode === 'edit'` → opacity 0.3, pointer-events none
- Clic → bascule isOpen

**État déplié :**
- Panneau position fixed, dimensions 320×460px
- Position initiale : bas-gauche au-dessus du bouton
- Clamp lors du drag : panneau ne sort jamais de l'écran

**Header :**
- Titre "Lanceur de dés"
- Toggle "Jet au MJ" — désactivé (opacity 0.35, disabled), tooltip "Disponible prochainement"
  Préparé pour l'Étape D (jets privés) — affiché mais non fonctionnel
- Bouton ✕ fermeture

**Grille dés :**
- 7 lignes (D4, D6, D8, D10, D12, D20, D100) × 5 colonnes (quantités 2→6, comme Roll20)
- Clic cellule → `socket.emit(WS.DICE_ROLL, { formula: '2d6' })`

**Jet avancé :**
- Input formule libre + bouton Lancer (ou Enter)
- `socket.emit(WS.DICE_ROLL, { formula: '2d6+3' })`
- Bouton désactivé si formule vide

**Drag — handle "Déplacer" en footer :**
- Pattern `useRef` + listeners `pointermove`/`pointerup` sur `document`
- `dragState` en `useRef` (pas useState) — pas de re-render pendant le mouvement
- Seul `setPos` déclenche le re-render de positionnement
- Cleanup `removeEventListener` dans `useEffect` retour + dans `handleDragEnd`

**`client/src/pages/SessionPage.jsx`** — modifié
- Import `DicePanel` ajouté
- `<DicePanel socket={socket} mode={mode} />` monté avant la fermeture du container
  (position fixed — indépendant du flux, mais conventionnellement après les overlays)

**`client/src/locales/fr.json`** — complété
- `dice.panel` : "Lanceur de dés"
- `dice.gmRoll` : "Jet au MJ"
- `dice.gmRollSoon` : "Disponible prochainement"
- `dice.launch` : "Lancer"
- `dice.move` : "Déplacer"
- `dice.advanced` : "Jet avancé"
- `dice.disabledInEdit` : "Indisponible en mode édition"

#### Validation fonctionnelle
- ✅ Icône dé visible bas-gauche en mode jeu
- ✅ Icône grisée et non cliquable en mode édition
- ✅ Clic → panneau déplié avec grille 7×5
- ✅ Clic cellule → `dice:roll` émis (vérifié console serveur)
- ✅ Champ jet avancé → Enter ou bouton Lancer → formule émise
- ✅ Handle "Déplacer" → panneau draggable, clampé dans l'écran
- ✅ Bouton ✕ → fermeture
- ✅ SR — aucune régression

---

### Chantier 6 — Étapes C + E : décisions architecturales prises, implémentation à venir

#### Analyse Sidebar.jsx — rendu messages

Fil de messages actuel dans `Sidebar.jsx` — deux types :
- `msg.system === true` → message système (connexion/déconnexion)
- sinon → message chat `{ id, user, color, text, time }`

Les résultats de dés seront un **troisième type** : `msg.type === 'dice'`.
Structure complète du message dé côté client :
```javascript
{
  id: `dice-${userId}-${timestamp}`,
  type: 'dice',
  user: username,
  color,           // couleur profil de l'émetteur
  formula,         // ex: "2d6+3"
  rolls,           // ex: [4, 5]
  total,           // ex: 12
  isCriticalSuccess: false,
  isCriticalFail: false,
  time,            // toLocaleTimeString
}
```

Le rendu dans `Sidebar.jsx` ajoutera un `else if (msg.type === 'dice')` dans le `map`
existant — sans toucher au rendu des messages chat ou système.

#### Payload DICE_RESULT (serveur → clients)
```json
{
  "userId": "...",
  "username": "...",
  "color": "#e05b5b",
  "formula": "2d6+3",
  "rolls": [4, 5],
  "total": 12,
  "isCriticalSuccess": false,
  "isCriticalFail": false,
  "seed": 42,
  "timestamp": "2026-04-07T..."
}
```

#### `diceParser.js` — spec
- Supporte : `dX`, `NdX`, `NdX+M`, `NdX-M`
- `crypto.randomInt` natif Node.js — pas de dépendance externe
- Retourne : `{ rolls, total, formula, seed, dieType }`
- `dieType` : `'d20'` si formule simple, `null` si mixte ou modificateur
  → utilisé pour lookup `dice_config` côté serveur
- `seed` : dérivé des rolls (préparé pour animation 3D future)

#### Évaluation critiques côté serveur
```javascript
// Lecture dice_config depuis campaigns
const campaign = await db('campaigns').where({ id: socket.campaignId }).first()
const diceConfig = campaign?.dice_config
// Si dieType connu et config présente :
const dieConfig = diceConfig?.[dieType]
isCriticalSuccess = dieConfig?.success
  ? total >= dieConfig.success.min && total <= dieConfig.success.max
  : false
isCriticalFail = dieConfig?.fail
  ? total >= dieConfig.fail.min && total <= dieConfig.fail.max
  : false
```

#### Animation CSS (phase simple)
`@keyframes diceRoll` sur l'icône dé dans le message — rotation + rebond, 800ms.
Déclenché à l'apparition d'un nouveau message `type: 'dice'` dans le fil.
Le `seed` est généré et inclus dans le payload mais non utilisé côté client en phase simple.
Préparé pour l'animation 3D R3F future (Chantier 8+).

### Prochaine étape
Chantier 6 — Étapes C + E : `diceParser.js` + handler `DICE_ROLL` serveur
+ handler `DICE_RESULT` client + rendu Sidebar.

Fichiers à uploader en début de prochaine session :
- `server/src/socket/index.js` ✅ (lu — placeholder DICE_ROLL connu)
- `client/src/components/Sidebar.jsx` ✅ (lu — rendu messages connu)
- `client/src/pages/SessionPage.jsx` ✅ (lu — handler DICE_RESULT à ajouter)
- `client/src/locales/fr.json` ✅ (lu — clés dés résultats à ajouter)
---

## Session 18 — 2026-04-07 — Chantier 6 : Étapes C + E + correctifs

### Contexte de reprise
Session 17 (suite) stable confirmée. Démarrage session 18 — implémentation complète dés :
parser serveur, broadcast résultat, rendu Sidebar, puis correctifs UX post-validation.

---

### Chantier 6 — Étapes C + E ✅

#### Fichiers créés

**`server/src/lib/diceParser.js`** — nouveau
- `parseDice(formula)` async — export nommé
- Regex `^(\d+)?d(\d+)([+-]\d+)?$i` — supporte `dX`, `NdX`, `NdX+M`, `NdX-M`
- `crypto.randomInt(1, faces + 1)` — zéro dépendance externe
- `dieType` : toujours non-null pour formule valide (`'d20'`, `'d6'`, etc.)
  Le modificateur est ignoré pour le lookup `dice_config` — décision session 18 :
  les critiques sont évalués sur le total (modificateur inclus) mais le type de dé
  est déterminé par les faces uniquement, pas par la présence d'un modificateur.
- `seed` : XOR de tous les rolls — entier, préparé pour animation 3D future
- Gardes : count [1→100], faces [2→1000]
- Lève une `Error` explicite si formule invalide ou hors bornes

**`server/src/routes/dice.js`** — nouveau
- `POST /api/dice/roll` — route REST standalone, hors session socket
- `{ requireAuth }` — import nommé (pas default)
- Retourne `{ rolls, total, formula, dieType, seed }` sans broadcast ni dice_config
- Erreur formule invalide → 400 (pas 500)

#### Fichiers modifiés

**`server/src/index.js`**
- Import `diceRouter` ajouté
- Montage `app.use('/api/dice', diceRouter)` après `/api/users`

**`server/src/socket/index.js`**
- Import `parseDice` ajouté
- Handler `DICE_ROLL` remplacé (placeholder → implémentation complète, async)
- Guard `if (!socket.campaignId) return` en tête
- 4 étapes : parseDice → couleur DB → dice_config → broadcast DICE_RESULT
- Lecture couleur : pattern identique CHAT_MESSAGE (try/catch indépendant, fallback `'#5b8dee'`)
- Lecture dice_config : try/catch indépendant — erreur DB → critiques désactivés silencieusement
- Évaluation critiques : `total >= cfg.min && total <= cfg.max` (plage inclusive)
- Broadcast `WS.DICE_RESULT` à `io.to(socket.campaignId)` — tous les membres de la room
- Formule invalide → log serveur, aucun broadcast

**`client/src/pages/SessionPage.jsx`**
- Handler `WS.DICE_RESULT` ajouté dans le useEffect socket (après CHARACTER_UPDATED)
- `addMessage({ id: \`dice-${userId}-${timestamp}\`, type: 'dice', ... })`

**`client/src/components/Sidebar.jsx`**
- `IconDice` SVG ajouté (D6 5 points, 14×14px, currentColor)
- `messagesEndRef` + auto-scroll `scrollIntoView({ behavior: 'smooth' })` à chaque nouveau message
- `animatingDiceId` state + `lastDiceIdRef` + useEffect animation (Option B — timer 800ms)
- `@keyframes diceRoll` + `.dice-icon-animating` dans `<style>` tag dans le return principal
  (hors bloc conditionnel `activeTab === 'chat'` — toujours dans le DOM)
- Animation via `className="dice-icon-animating"` (pas style inline) — redéclenche à chaque ajout
- 3e branche `if (msg.type === 'dice')` dans le `map` messages
  Rendu : icône animée (couleur lanceur) + nom + heure + badges critiques + formule + rolls + total
- Commandes chat `/r <formule>` et `/roll <formule>` interceptées dans `sendMessage`
  → `socket.emit(WS.DICE_ROLL, { formula })`, pas de CHAT_MESSAGE, setChatInput('')
- Styles ajoutés : `messageDice`, `diceCritSuccess`, `diceCritFail`, `diceHeader`, `diceIcon`,
  `diceIconAnimating`, `diceBody`, `diceFormula`, `diceRolls`, `diceEquals`, `diceTotal`,
  `badgeCritSuccess`, `badgeCritFail`

**`client/src/locales/fr.json`**
- `dice.advanced` : "Jet avancé"
- `dice.criticalSuccess` : "Réussite critique"
- `dice.criticalFail` : "Échec critique"

---

### Correctifs UX post-validation

#### Correctif 1 — Position bouton DicePanel

**Symptôme :** bouton dé bas-gauche (position fixe `left: 20, bottom: 20`) non optimal.
**Correction :** bouton déplacé en haut-droite du Canvas3D, collé à la Sidebar.

**`client/src/components/DicePanel.jsx`**
- Nouvelles props : `sidebarVisible` (bool), `sidebarWidth` (number)
- Position bouton : `right = sidebarVisible && sidebarWidth ? sidebarWidth + 12 : 12`, `top: 48px`
  (48px = sous la barre GM 40px + marge 8px — dérive vers la droite si sidebar fermée)
- Fond bouton : `#16162a` → `#2a2a4a`, bordure `#2a2a3e` → `#3a3a5e`, icône `#8888a8` → `#9090c0`

**`client/src/pages/SessionPage.jsx`**
- `<DicePanel>` reçoit `sidebarVisible={sidebarVisible}` et `sidebarWidth={sidebarWidth}`

#### Correctif 2 — Labels dés cliquables (1dX)

**Symptôme :** grille commençait à 2 dés — impossible de lancer 1dX depuis la grille.
**Correction :** labels D4/D6/D8/D10/D12/D20/D100 rendus comme boutons cliquables.
- Clic sur label → `emitRoll(dieFormula)` → lance `1dX`
- Style `labelBtn` ajouté (même apparence, curseur pointer, hover implicite)

---

### Décisions techniques session 18

**dieType avec modificateur** : toujours non-null. `2d6+3` → `dieType: 'd6'`.
Le modificateur est ignoré pour le lookup dice_config (les critiques s'appliquent
au type de dé, pas à la formule complète). Correction par rapport à la spec initiale
qui disait `null` si modificateur — abandonnée après réflexion métier.

**requireAuth import nommé** : `middleware/auth.js` exporte `requireAuth` en named export,
pas en default. Erreur découverte au premier SR — corrigée immédiatement.
Ajouté dans CONVENTIONS.md (piège à ne pas reproduire).

**Animation dé — className vs style inline** : style inline `animation:` ne redéclenche pas
l'animation si le nœud DOM existe déjà. Solution : classe CSS `.dice-icon-animating`
ajoutée/retirée via `animatingDiceId` state — le navigateur redéclenche à chaque ajout.

**`<style>` tag animation** : doit être dans le return principal (toujours dans le DOM),
pas dans le bloc conditionnel `{activeTab === 'chat' && ...}`. Si l'onglet n'est pas actif
au moment de la réception, le keyframe est inconnu → animation silencieuse.

---

### Validation fonctionnelle session 18
- ✅ SR sans erreur
- ✅ Clic dé dans DicePanel → résultat visible dans le fil chat (formule + rolls + total)
- ✅ Auto-scroll vers le bas à chaque nouveau message
- ✅ Badge "Réussite critique" / "Échec critique" si dice_config configurée et seuil atteint
- ✅ Aucune régression sur chat, système, personnages
- ✅ Labels D4→D100 cliquables → lance 1dX
- ✅ Bouton DicePanel haut-droit canvas, collé à la sidebar, dérive si fermée
- ✅ Fond bouton plus visible (#2a2a4a)
- ⬜ Animation dé — en cours de validation (correctif className livré)
- ⬜ /r et /roll — en cours de validation

### Prochaine étape
Chantier 7 — Tests routes critiques serveur.

## Session 19 — 2026-04-07 — Calque GM + correctifs couleurs tokens

### Contexte de reprise
Session 18 stable confirmée. Chantier 7 mis en pause (reporter après fin Phase 2).
Démarrage session 19 — Calque GM + correctifs issus des tests.

### Travail effectué

#### Calque GM — filtrage client
**`client/src/components/Canvas3D.jsx`**
- Filtre `tokens.filter(token => isGm || token.layer !== 'gm')` ajouté dans le rendu Scene
- Tokens `layer='gm'` invisibles pour les joueurs côté client
- Côté serveur : filtrage déjà présent dans `GET /battlemaps/:id` (`.whereNot({ layer: 'gm' })`)

#### Calque GM — indicateur visuel pour le GM
**`client/src/components/Canvas3D.jsx`**
- `TokenRing` : prop `opacity` ajoutée, `baseOpacity = opacity ?? 0.5`
- `TokenMesh` : prop `isGmLayer` ajoutée
- Si `isGmLayer` : opacité 50% sur les matériaux du clone (transparent + opacity 0.5)
- Si `isGmLayer` : anneau à opacity 0.25
- Si `isGmLayer` : `fillOpacity={0.5}` sur le label Text
- Si `isGmLayer` : second Text `⊘ GM` violet (#a855f7) au-dessus du label
- `isGmLayer` ajouté au dependency array du useMemo clonedScene

#### Bug layer hardcodé — SessionPage
**`client/src/pages/SessionPage.jsx`**
- `handleCharacterDrop` : `layer: 'token'` remplacé par `layer` (état SessionPage)
- `layer` ajouté au dependency array du useCallback
- Désormais, un drop depuis la Sidebar crée le token sur le calque actif (token ou gm)

#### Bug couleur characters — characters.js
**`server/src/routes/characters.js`**
- `PUT /characters/:id` : quand `user_id` change, recalcul automatique de `color`
  - Désassignation (`user_id: null`) → couleur PNJ par défaut `#4A90D9`
  - Nouvelle assignation → `users.color` du nouveau propriétaire
- Données existantes corrigées via SQL :
  `UPDATE characters SET color = users.color FROM users WHERE characters.user_id = users.id`

### Décisions techniques
- Chantier 7 (tests) reporté après fin Phase 2 — trop tôt, cible mobile
- Indicateur visuel calque GM : opacité 50% + badge `⊘ GM` violet — pas d'icône SVG
  (drei Text ne supporte pas les icônes SVG, Inter ne contient pas les emojis)
- Couleur PNJ par défaut `#4A90D9` conservée — cohérent avec le POST characters

### Validation fonctionnelle
- ✅ Token GM invisible pour les joueurs
- ✅ Token GM visible pour le GM avec opacité 50% + badge ⊘ GM violet
- ✅ Drop sur calque GM actif → token créé avec layer='gm'
- ✅ Couleurs characters corrigées en base (UPDATE 5)
- ✅ Nouveaux tokens →

## Session 20 — 2026-04-08 — Upload portrait/GLB + renommage character

### Contexte de reprise
Session 19 stable confirmée. X-ray et tests automatiques abandonnés.
Démarrage session 20 — Chantier 8 : upload assets characters + renommage.

### Décisions techniques

**objectName fixe sans extension (MinIO)**
`characters/<id>/illustration` et `characters/<id>/model3D` — noms fixes.
`putObject` écrase l'ancien automatiquement (même clé MinIO, bucket sans versioning).
Pas d'extension → Content-Type transmis dans les metadata MinIO au `putObject`.
`assets.js` lit `stat.metaData['content-type']` en priorité sur la détection par extension.

**portrait_url et glb_url stockent le chemin MinIO (objectName) — pas une URL complète.**
URL d'affichage côté client : `${VITE_API_URL}/api/assets/${character.portrait_url}`
Pattern identique à `DEFAULT_TOKEN_URL`. Cohérent avec `/api/assets/:folder/*filePath`.

**glb_url avec ?v=timestamp pour cache busting useGLTF**
`useGLTF` cache par URL (suspend-react). Même fichier MinIO, URL différente → rechargement.
Valeur stockée en base : `characters/<id>/model3D?v=1712345678`.
`assets.js` utilise `req.params.filePath` (pas les query params) → MinIO reçoit le chemin propre.

**useGLTF déplacé dans TokenMesh**
Chaque token charge son propre GLB via `useGLTF(glbUrl)`.
Cache global partagé — si plusieurs tokens utilisent `default.glb`, un seul chargement réseau.
`gltfScene` retourné par `useGLTF` est une référence stable (suspend-react cache par URL).
`useMemo([gltfScene, isGmLayer])` ne se recalcule que si l'URL ou le calque change.
Suppression de `GltfLoader` composant, `gltfScene` state, prop `gltfScene` dans Canvas3D.

**glbUrl calculé dans Scene, passé en prop à TokenMesh**
`characters` déjà disponible via `useCharacterStore()` dans Scene.
`character.glb_url` → URL proxy / null → `DEFAULT_TOKEN_URL`.
TokenMesh ne lit pas de store directement — cohérent avec l'architecture existante.

**Correction bug opacité matériaux (session 19 tardive)**
Les matériaux Three.js sont partagés par référence entre tous les clones du même `gltfScene`.
Sans clone des matériaux, muter `opacity` sur un token GM corrompait tous les autres tokens.
Correction : `cloneMat(mat)` — clone chaque matériau individuellement avant mutation.
Pattern : `child.material = child.material.map(cloneMat)` (array) ou `cloneMat(child.material)` (unique).

**multerGlb — filtre MIME dédié**
`ALLOWED_GLB_MIME_TYPES = ['model/gltf-binary', 'application/octet-stream']`
Séparé de `multerUpload` pour ne pas contaminer le filtre image.
`multerUpload` et `uploadToMinio` existants inchangés — zéro régression.

**Droits upload**
Portrait : GM ou owner (asset visible par tous les membres).
GLB : GM uniquement (asset technique 3D).

**Renommage character**
Icône plume dans le header de CharacterModal, visible GM et owner.
Clic → `<input>` en focus, remplace le `<span>` du nom.
Sauvegarde : blur ou Entrée → `PUT /characters/:id { name }`.
Annulation : Échap → restauration du nom original.
Guard : nom inchangé ou vide → pas d'appel API.

### Fichiers modifiés

**`server/src/middleware/upload.js`**
- `ALLOWED_GLB_MIME_TYPES` ajouté : `['model/gltf-binary', 'application/octet-stream']`
- `glbFileFilter` ajouté
- `multerGlb` exporté — filtre dédié GLB
- `multerUpload`, `uploadToMinio` inchangés

**`server/src/routes/assets.js`**
- `stat.metaData?.['content-type']` lu en priorité sur `getContentType(filePath)`
- Permet de servir correctement les assets sans extension (portrait, model3D)
- Fallback extension conservé pour les assets existants

**`server/src/routes/characters.js`**
- Import `multerUpload`, `multerGlb`, `getMinioClient`, `BUCKET` ajoutés
- Helper `broadcastCharacterUpdate(characterId, app)` factorisé (SELECT complet + broadcast)
- `POST /characters/:id/portrait` — GM ou owner — multerUpload + minio.putObject + UPDATE portrait_url
- `POST /characters/:id/glb` — GM uniquement — multerGlb + minio.putObject + UPDATE glb_url avec ?v=timestamp
- Routes existantes (GET, POST, PUT, DELETE) inchangées

**`client/src/components/Canvas3D.jsx`**
- `GltfLoader` composant supprimé
- `gltfScene` useState supprimé
- `Scene` : suppression prop `gltfScene`, calcul `glbUrl` par token depuis `characters`
- `TokenMesh` : prop `gltfScene` → prop `glbUrl` + `useGLTF(glbUrl)` interne
- `useMemo clonedScene` : deps `[gltfScene, isGmLayer]` (gltfScene = retour useGLTF, stable)
- Correction bug matériaux partagés : `cloneMat(mat)` clone chaque matériau avant mutation
- Guard `{gltfScene && tokens.map(...)}` supprimé — tokens se rendent dès `packsLoaded`

**`client/src/components/Sidebar.jsx`**
- `IconPen` SVG ajouté (plume 13×13px, currentColor)
- `CharacterModal` :
  - `canEditName = isGm || isOwner`
  - `editingName` state + `nameInput` state
  - `handleNameSave` : PUT + updateCharacter + onCharacterUpdate + guard nom inchangé/vide
  - `handleNameKeyDown` : Entrée → save, Échap → annulation
  - Header : `<input>` si editingName, sinon `<span>` + bouton plume si canEditName
  - `canUploadPortrait = isGm || isOwner`
  - `portraitUploading` + `glbUploading` states
  - `handlePortraitUpload` : POST multipart `/characters/:id/portrait`
  - `handleGlbUpload` : POST multipart `/characters/:id/glb`
  - Bloc illustration : `<img>` si `portrait_url`, sinon placeholder + bouton upload
  - Onglet settings : bouton upload GLB (GM uniquement)
  - Styles ajoutés : `portraitImg`, `uploadBtn`, `nameInput`, `namePenBtn`
  - Style `illustrationPlaceholder` étendu : `flexDirection: column`, `minHeight`, `padding`

**`client/src/locales/fr.json`**
- `character.portraitAlt`, `character.portraitUpload`, `character.portraitUploading`
- `character.glbUpload`, `character.glbUploading`
- `character.rename`

### Validation fonctionnelle
- ✅ Upload portrait → image affichée immédiatement dans la modale
- ✅ Upload GLB → token 3D mis à jour sur la carte en temps réel (broadcast CHARACTER_UPDATED)
- ✅ Fallback default.glb si pas de glb_url
- ✅ Renommage character — blur/Entrée sauvegarde, Échap annule
- ✅ Tokens non-GM : opacité normale (correction bug matériaux partagés)
- ✅ Tokens GM : opacité 50% + badge ⊘ GM (comportement session 19 préservé)
- ✅ SR sans erreur — aucune régression sur routes existantes

### Pièges documentés (nouveaux)

**P_assets_content_type** — assets sans extension
`portrait_url` et `glb_url` stockent le chemin MinIO sans extension.
`assets.js` lit `stat.metaData['content-type']` (metadata MinIO) pour le Content-Type.
Si un asset est uploadé sans metadata Content-Type → fallback `application/octet-stream`.
Toujours passer `{ 'Content-Type': req.file.mimetype }` dans `minio.putObject`.

**P_glb_cache_busting** — useGLTF cache par URL
`glb_url` en base inclut `?v=<timestamp>` pour forcer le rechargement après remplacement.
`assets.js` utilise `req.params.filePath` (hors query params) → MinIO reçoit le chemin propre.
Ne jamais stocker `glb_url` sans le `?v=` — le token afficherait l'ancien modèle après upload.

**P_material_clone** — matériaux Three.js partagés par référence
`SkeletonUtils.clone(gltfScene)` clone le graphe de scène mais PAS les matériaux.
Tous les clones du même `gltfScene` partagent les mêmes objets matériau.
Muter `opacity` sans cloner corrompt tous les tokens utilisant le même GLB.
Toujours `mat.clone()` avant toute mutation de matériau dans `useMemo clonedScene`.
## Session 23 — 2026-04-09 — Chantier 9A-1 : Migrations + routes serveur

### Contexte de reprise
Session 22 stable confirmée (planification — aucun code).
Session 23 = première session de code du Chantier 9A.
Préalable : définition du pack de textures de démarrage (univers Polaris, hard-SF sous-marine).

### Décisions prises

**Pack de démarrage — structure-station**
- Ancien pack `hard-sf` abandonné — contenu de test jetable, MinIO vidé
- Nouveau pack : `name: 'structure-station'`, `label: 'Structure de station'`
- Univers Polaris (Philippe Tessier) — hard-SF sous-marine
- 4 catégories : Sol, Mur, Fenêtre, Bloc — extensibles par l'utilisateur via interface 9B
- 78 blocs, tous `geometry: 'cube'` en V1
- Textures PNG 64/128/256px — source Minecraft resourcepacks
- Chemins MinIO : `textures/structure-station/<categorie>/<fichier>.png`
- UUID pack fixe : `b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e`
- Manifest transport ZIP généré : `textures/structure-station/manifest.json`

**Format migrations : .js (ES module)**
La MISSION spécifiait `.cjs` — toutes les migrations existantes (01→20) sont en `.js`.
Les nouvelles migrations 21→26 sont produites en `.js` avec `export const up/down`.
Écart documenté — MISSION à corriger en session suivante si besoin.

**Recalcul battlemap_block_usage dans PUT /voxels**
Après chaque save voxel, DELETE + INSERT dans `battlemap_block_usage`.
Guard `if (usedIds.length > 0)` avant l'INSERT — carte vide = pas d'INSERT.

**Routes lock/heartbeat**
3 routes ajoutées dans `battlemaps.js` :
- `POST /:id/editor-lock` — acquire lock (60s), 423 si locké par autre GM
- `DELETE /:id/editor-lock` — libère le lock (titulaire uniquement)
- `POST /:id/editor-heartbeat` — renouvelle le lock (+60s, titulaire uniquement)

### Fichiers créés/modifiés

**`server/src/db/migrations/`**
- `21_texture_packs.js` — table texture_packs
- `22_battlemaps_editor_lock.js` — colonnes editor_locked_by + editor_locked_until sur battlemaps
- `23_block_types.js` — tables texture_pack_categories + block_types (ordre FK obligatoire)
- `24_seed_structure_station.js` — seed pack structure-station (4 catégories, 78 blocs)
- `25_voxel_data_format.js` — conversion one-shot voxel_data entier → { id, r }
- `26_battlemap_block_usage.js` — table battlemap_block_usage (PK composite)

**`server/src/routes/block-types.js`** — nouveau
- `GET /api/block-types` — tous les blocs non deprecated (palette)
- `GET /api/block-types?ids=1,3,7` — blocs par IDs (Canvas3D au chargement)
- JOIN texture_packs pour pack_name + tile_size

**`server/src/routes/texture-packs.js`** — nouveau (lecture seule 9A)
- `GET /api/texture-packs` — liste packs avec block_count
- `GET /api/texture-packs/:id` — détail pack + catégories + blocs

**`server/src/routes/battlemaps.js`** — modifié
- `PUT /:id/voxels` : recalcul battlemap_block_usage après save
- `POST /:id/editor-lock` — nouveau
- `DELETE /:id/editor-lock` — nouveau
- `POST /:id/editor-heartbeat` — nouveau

**`server/src/index.js`** — modifié
- Import + montage `/api/block-types` et `/api/texture-packs`

**`textures/structure-station/manifest.json`** (MinIO)
- Format transport ZIP — 78 blocs avec localIds 1→78, 4 catégories

### Validation fonctionnelle
- ✅ 26 migrations appliquées (batch 10) sans erreur
- ✅ `GET /api/block-types` → 78 blocs, geometry + textures + pack_name corrects
- ✅ `GET /api/block-types?ids=1,3` → 2 blocs exacts
- ✅ `GET /api/texture-packs` → pack structure-station, block_count: 78
- ✅ `POST /api/battlemaps/:id/editor-lock` → `{ ok: true, lockedUntil: ... }`
- ✅ SR sans erreur — aucune régression routes existantes

### Points de vigilance session suivante (9A-2)
- `textures.js` ancienne route : crashe si un fichier non-JSON est dans MinIO — `liste.txt` supprimé en session 23, vigilance à maintenir
- Session 9A-2 : VOXEL_ADD socket + Canvas3D refonte — déploiement atomique obligatoire (P27)
## Session 26 — 2026-04-12 — Chantier 9A-4 : DB + Serveur (refonte modèle texture × géométrie)

### Contexte de reprise
Sessions 9A-1 ✅ / 9A-2 ✅ / 9A-3 ✅ validées.
Session 26 = refonte du modèle voxel côté DB et serveur.
Référence active : MISSION_9A_addendum.md section SESSION 9A-4.

### Décisions prises

**Refonte modèle voxel — séparation texture × géométrie**
Le modèle `block_type = (texture, géométrie)` est remplacé par `voxel_textures` (texture seule).
La géométrie est maintenant dans `voxel_data.geo` — orthogonale à la texture.
Format voxel_data définitif : `{ "x:y:z": { "tex": N, "geo": "cube", "r": 0 } }`.

**Deux batches de migration**
La migration 31 (drop irréversible) était dans le dossier au moment du `migrate:latest`.
Les 5 migrations ont été appliquées en un seul batch — résultat identique à deux batches séparés.
État final vérifié en base avant de continuer.

**Données voxels au format inattendu**
Plusieurs battlemaps contenaient des voxels dans des formats anciens :
- Objet mémoire React complet `{ x, y, z, mat }` (P16 violé lors de sessions de test)
- Entiers avec clés entières (format très ancien, antérieur à migration 25)
Ces voxels ont été ignorés par la migration 30 avec `console.warn` — comportement prévu.
Les voxels au format `{ id, r }` correct ont tous été convertis en `{ tex, geo, r }`.

**État intermédiaire attendu (P27)**
Canvas3D et Editor3D appellent encore `/api/block-types` (404) — route supprimée.
Les voxels n'apparaissent pas en session de jeu. C'est l'état documenté entre 9A-4 et 9A-5.
Tokens, connexion, navigation : non régressés.

### Fichiers créés/modifiés

**`server/src/db/migrations/`**
- `27_voxel_textures.js` — CREATE TABLE voxel_textures (increments, faces JSONB, allowed_geometries JSONB, legacy_block_type_id temporaire)
- `28_battlemap_texture_usage.js` — CREATE TABLE battlemap_texture_usage (PK composite)
- `29_seed_voxel_textures.js` — seed 78 textures depuis block_types, conversion side → faces nommées, legacy_block_type_id peuplé
- `30_voxel_data_refonte.js` — conversion voxel_data { id, r } → { tex, geo, r } via mapping legacy_block_type_id (IRRÉVERSIBLE)
- `31_drop_block_types.js` — drop legacy_block_type_id + battlemap_block_usage + block_types (IRRÉVERSIBLE)

**`server/src/routes/voxel-textures.js`** — nouveau
- `GET /api/voxel-textures` — toutes les textures non deprecated, ordonnées catégorie + sort_order
- `GET /api/voxel-textures?ids=1,3,7` — par IDs (Canvas3D au chargement)
- JOIN texture_packs + LEFT JOIN texture_pack_categories
- Retourne `{ textures: [...] }` — legacy_block_type_id jamais exposée (P35)

**`server/src/socket/index.js`** — modifié
- VOXEL_ADD : payload `{ id, r }` → `{ tex, geo, r }` (destructuring + stockage + broadcast)
- Tous les autres handlers inchangés

**`server/src/routes/battlemaps.js`** — modifié
- PUT /:id/voxels : recalcul `battlemap_texture_usage` au lieu de `battlemap_block_usage`
- `v.tex` au lieu de `v.id`, `voxel_texture_id` au lieu de `block_type_id`

**`server/src/index.js`** — modifié
- Import + montage `/api/voxel-textures` remplace `/api/block-types`
- `/api/texture-packs` inchangé

### Validation fonctionnelle
- ✅ 31 migrations appliquées sans erreur
- ✅ `voxel_textures` : 78 entrées, faces correctes (side → north/south/east/west/bottom)
- ✅ `block_types` supprimée
- ✅ `battlemap_block_usage` supprimée
- ✅ `voxel_data` converti : format `{ tex, geo, r }` confirmé en base
- ✅ `GET /api/voxel-textures` → 78 textures, faces + pack_name + category_label corrects
- ✅ `GET /api/voxel-textures?ids=1,3` → 2 textures exactes
- ✅ SR sans erreur
- ✅ Tokens, connexion, navigation non régressés
- ⚠️ Canvas3D appelle `/api/block-types` (404) — état intermédiaire attendu, corrigé en 9A-5

### Points de vigilance session suivante (9A-5)
- Déploiement atomique obligatoire (P27) : socket envoie déjà `{ tex, geo, r }`, client doit être mis à jour dans la même session
- Canvas3D : remplacer `/block-types?ids=` par `/voxel-textures?ids=`, `v.id` → `v.tex`, `blockMaterials` → `textureMaterials`
- Editor3D : même mises à jour + `activeMaterial` format `{ texId, geo, r }` au lieu de `{ id, r }`
- Sidebar : palette affiche `voxel_textures` groupées par catégorie
- Voir MISSION_9A_addendum.md section SESSION 9A-5 pour la spec complète
---

## Session 9A-5 — 2026-04-13

**Chantier :** 9A — Refonte voxel + système de packs de textures
**Étape :** 9A-5 Client — Canvas3D + Editor3D + Sidebar palette textures
**Durée :** 1 session

### Objectif
Mettre à jour le client pour utiliser le nouveau modèle `{ tex, geo, r }` introduit en 9A-4.
Déploiement atomique obligatoire (P27) — socket et client dans la même session.

### Fichiers modifiés

**`client/src/lib/voxelTextures.js`**
- `loadBlockTextures` → `loadVoxelTextures`
- Paramètre `blocks[]` → `textures[]` (depuis `/api/voxel-textures`)
- Résolution 6 faces nommées (east, west, top, bottom, south, north) selon P32
- Gestion alias `side` → north/south/east/west (rétrocompat seed V1 — P33)
- Retour `{ [texId]: { faceMaterials } }` — plus de `geometry` dans les matériaux (P31)

**`client/src/components/Voxel.jsx`**
- Props : `blockData` → `textureMaterials + geometry`
- `geometry` vient de `voxel_data.geo`, pas des matériaux (P31)
- Guard : `!blockData` → `!textureMaterials`

**`client/src/components/Canvas3D.jsx`**
- `blockMaterials` → `textureMaterials`
- Init voxels : `{ id, r }` → `{ tex, geo, r }`
- Chargement : `/block-types?ids=` → `/voxel-textures?ids=`, `data.blocks` → `data.textures`
- Handler VOXEL_ADDED : `{ id, r }` → `{ tex, geo, r }`
- Rendu Voxel : `blockData={blockMaterials[v.id]}` → `textureMaterials={textureMaterials[v.tex]} geometry={v.geo}`
- Dépendances useEffect init voxels + chargement : `[battlemap?.id]` → `[battlemap?.id, battlemap?.voxel_data]`
  (nécessaire pour que Canvas3D se réinitialise après une save depuis Editor3D sans F5)

**`client/src/components/Editor3D.jsx`**
- Mêmes substitutions que Canvas3D côté chargement et rendu
- `activeMaterial` : `{ id, r }` → `{ texId, geo, r }`
- Pose clic gauche : `{ id, r }` → `{ texId, geo, r }`, `VOXEL_ADD` payload mis à jour
- Raccourcis Digit1-9/0 (sélection bloc) → Digit1-5 (sélection géométrie uniquement)
  - Sémantique changée : les chiffres modifient `geo` dans `activeMaterial`, pas le bloc entier
  - `e.preventDefault()` ajouté — empêche la "Recherche rapide" de Firefox sur Digit4
  - Guard `allowed_geometries` avec `activeMaterial` dans le dependency array
- `GhostVoxel` : reçoit `geometry` en prop, affiche la bonne géométrie (slab avec yOffset)
- Save payload : `{ id: v.id, r: v.r }` → `{ tex: v.tex, geo: v.geo, r: v.r }` (×2)
- `saveFireAndForget` et `save()` appellent `setBattlemap({ ...battlemap, voxel_data: payload })`
  après succès — met à jour le store pour que Canvas3D se réinitialise au remontage
- Pattern `battlemapRef` : ref miroir de `battlemap` pour stabiliser `saveFireAndForget`
  (évite de recréer le timer 60s à chaque update du store)

**`client/src/components/Sidebar.jsx`**
- Palette : `block.textures` → `block.faces` (colonne `voxel_textures`)
- Détection active : `activeMaterial?.id` → `activeMaterial?.texId`
- Sélection : `{ id: block.id, r: 0 }` → `{ texId: block.id, geo: 'cube', r: 0 }`
- Icône géométrie par bouton supprimée → `GeometryIcon` dans le header palette (géo active)

**`client/src/pages/SessionPage.jsx`**
- Commentaires mis à jour : `{ id, r }` → `{ texId, geo, r }`, `blocs` → `textures`
- Aucun changement fonctionnel

### Bugs corrigés en session

**Ghost bloqué sur cube** : `GhostVoxel` recevait seulement `rotation`, pas `geometry`.
Corrigé : prop `geometry={activeMaterial?.geo || 'cube'}` + dispatch géométrie correcte.

**Touche 4 ouvre "Recherche rapide" Firefox** : `e.preventDefault()` manquant sur Digit1-5.
Corrigé.

**Voxels invisibles à la sortie de l'éditeur (sans F5)** : deux causes combinées.
1. Editor3D ne mettait pas à jour `mapStore.battlemap` après une save.
2. Canvas3D avait `[battlemap?.id]` comme dépendance — ne réagissait pas au changement de `voxel_data`.
Corrigé : `setBattlemap` après chaque save + dépendance `[battlemap?.id, battlemap?.voxel_data]`.

### Documentation

**SYSTEME.md** — refonte complète : 5389 lignes → 616 lignes.
- Suppression des 3 copies dupliquées des sections 1-24 (~3500 lignes de bruit)
- Suppression sections obsolètes (format voxel `mat`, route block-types)
- Mise à jour sections 3, 5, 6, 7 pour l'état réel post-9A-5
- Ajout pattern `battlemapRef`, cycle de vie save voxels, pièges actifs centralisés

### Validation fonctionnelle
- ✅ SR sans erreur
- ✅ Canvas3D — voxels existants (migrés) affichés avec textures correctes
- ✅ Canvas3D — tokens non régressés (drag, sélection, suppression)
- ✅ Canvas3D — voxels mis à jour immédiatement à la sortie de l'éditeur (sans F5)
- ✅ Editor3D — ghost voxel visible, géométrie correcte (slab, cube)
- ✅ Editor3D — pose + VOXEL_ADD `{ tex, geo, r }` broadcasté
- ✅ Editor3D — Canvas3D reçoit VOXEL_ADDED et affiche le nouveau voxel
- ✅ Editor3D — suppression + VOXEL_REMOVE
- ✅ Editor3D — Digit1-3 géométrie change (cube, slab_bottom, slab_top)
- ✅ Editor3D — Digit4-5 = slope/wedge (placeholder cube, données correctes en base)
- ✅ Editor3D — R rotation ghost / rotation voxel existant
- ✅ Editor3D — save auto 60s (200 OK confirmé)
- ✅ Editor3D — save au démontage (200 OK confirmé)
- ✅ Sidebar — palette 78 textures groupées par catégorie
- ✅ Sidebar — clic texture → ghost apparaît avec cette texture
- ✅ Touche 4 — fenêtre Firefox résolue

## Session 9B — 2026-04-14 — Chantier 9B : Interface CRUD texture packs + constructeur de voxels

### Contexte de reprise
Session 9A-5 stable confirmée. Chantier 9A complet. Démarrage session 9B.

### Travail effectué

**Migration 32 — déplacement fichiers MinIO seed structure-station**
- Tous les fichiers du pack structure-station déplacés de `textures/structure-station/` vers `textures/b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e/`
- 98 fichiers migrés (97 PNG + manifest.json)
- `faces` en base inchangées — chemins relatifs au pack identiques
- Irréversible — down = no-op documenté

**Convention chemins MinIO — définitive**
- Chemin MinIO : `textures/<pack_uuid>/<fichier>.png`
- `faces` en base stocke des chemins relatifs à l'UUID du pack
- Client construit : `VITE_API_URL/api/textures/<pack_id>/<path>`
- Le `name`/`label` du pack n'apparaît jamais dans les chemins MinIO
- Renommage pack = uniquement `label` en base, zéro impact fichiers

**`server/src/routes/textures.js` — nettoyage**
- `GET /` supprimé — scannait MinIO + JSON.parse → crashait sur fichiers non-JSON (P28)
- `GET /:pack/*filePath` inchangé — générique, fonctionne avec UUID ou name
- Ajout Content-Type `.zip` pour servir les archives

**`server/src/routes/voxel-textures.js` — extension**
- `POST /` — créer texture avec upload PNG (principal obligatoire + 6 faces optionnelles)
- `POST /from-paths` — créer voxel depuis PNG déjà dans MinIO (constructeur UI)
- `PUT /:id` — modifier label, deprecated, allowed_geometries, sort_order, category_id
- `DELETE /:id` — 409 si utilisée dans battlemap_texture_usage

**`server/src/routes/texture-packs.js` — refonte complète**
- GET / corrigé : JOIN `voxel_textures` au lieu de `block_types` (P42)
- GET /:id corrigé : query `voxel_textures` au lieu de `block_types` (P42)
- `POST /` — créer pack + ZIP initial
- `PUT /:id` — modifier label/description/tile_size (`name` immuable)
- `DELETE /:id` — 409 via battlemap_texture_usage JOIN voxel_textures + nettoyage MinIO
- `GET /:id/export` — servir ZIP pré-calculé depuis MinIO
- `POST /import` — importer ZIP : MinIO AVANT base, remapping localId, guard path traversal
- `GET /:id/files` — lister PNG bruts MinIO avec flag `inUse`
- `POST /:id/files` — uploader un PNG dans le pack
- `DELETE /:id/files/*path` — supprimer PNG, 409 si utilisé dans faces d'un voxel

**`client/src/lib/voxelTextures.js` — correction URL**
- `packName` → `packId` dans la construction d'URL
- URL construite : `VITE_API_URL/api/textures/<pack_id>/<path>`

**`client/src/pages/TexturePacksPage.jsx` — nouvelle page complète**
- Layout : colonne packs (200px) + zone détail
- Onglets dans le détail : **Voxels** / **Textures PNG**
- Onglet Voxels : liste voxels gauche + constructeur droite
  - Constructeur : nom + 7 cases faces cliquables (popup sélecteur PNG) + checklist géométries
  - Aperçu 3D temps réel : mini Canvas R3F avec `Voxel` rotatif (useFrame)
  - Création via `POST /api/voxel-textures/from-paths`
  - Modification via `PUT /api/voxel-textures/:id`
  - Dépréciation / réactivation inline
- Onglet Textures PNG : grille PNG + flag rouge si utilisé + upload + suppression
- Import/Export ZIP
- Création pack (modal)
- Suppression pack (modal + 409)
- Ownership : boutons d'édition visibles uniquement si `created_by === user.id`

**`client/src/App.jsx`** — route `/texture-packs` ajoutée

**`client/src/pages/DashboardPage.jsx`** — lien conditionnel GM (`campaigns.some(c => c.role === 'gm')`)

**`client/src/locales/fr.json`** — namespace `texturePacks` ajouté (24 clés)

### Décisions prises

**`name` du pack — immuable après création**
Identifiant technique dans le manifest ZIP. `PUT /:id` modifie uniquement `label`, `description`, `tile_size`.

**ZIP pré-calculé**
Créé/mis à jour après chaque modification (création pack, ajout/suppression texture, PUT pack).
Export = servir le ZIP existant depuis MinIO directement, sans reconstruction à la demande.

**Ownership packs**
`requireRole` inutilisable (pas de campaignId dans l'URL).
Pattern retenu : `pack.created_by === req.user.id`.
Tout utilisateur authentifié peut créer un pack.

**`created_by` seed structure-station**
Mis à jour manuellement via SQL pour permettre les modifications depuis l'UI :
`UPDATE texture_packs SET created_by = '<user_id>' WHERE id = 'b4e8f2a1-...'`

**Terminologie clarifiée**
- texture = fichier PNG de surface
- géométrie = forme 3D
- voxel = géométrie + assignation de textures sur ses faces
`voxel_textures` = table des voxels définis, pas des textures PNG brutes

### Pièges documentés (nouveaux)

**P43 — chemins MinIO textures par UUID du pack**
`textures/<pack_uuid>/<fichier>.png` — jamais `textures/<pack_name>/`.
Le `name` du pack n'apparaît jamais dans les chemins MinIO.
Renommer un pack ne casse aucun lien.

**P44 — `name` du pack immuable**
`name` = identifiant technique dans le manifest ZIP.
`PUT /api/texture-packs/:id` ne modifie que `label`, `description`, `tile_size`.
Modifier `name` casserait les imports ZIP croisés entre instances.

**P45 — GET / de textures.js supprimé**
L'ancienne `GET /api/textures/` scannait MinIO et faisait JSON.parse sur chaque fichier.
Avec des .zip et .png dans le dossier → crash nodemon immédiat.
La liste des packs est désormais dans `GET /api/texture-packs` (source de vérité en base).

**P46 — POST /voxel-textures/from-paths déclaré AVANT PUT /:id**
Route spécifique `/from-paths` déclarée avant la route paramétrique `/:id`.
Sinon Express interpréterait `/from-paths` comme un `id`.

### Fichiers créés/modifiés
- `server/src/db/migrations/32_migrate_seed_minio.js` — nouveau
- `server/src/routes/textures.js` — GET / supprimé
- `server/src/routes/voxel-textures.js` — POST /, POST /from-paths, PUT /:id, DELETE /:id ajoutés
- `server/src/routes/texture-packs.js` — refonte complète (9 routes)
- `client/src/lib/voxelTextures.js` — packName → packId
- `client/src/pages/TexturePacksPage.jsx` — nouvelle page complète
- `client/src/App.jsx` — route /texture-packs
- `client/src/pages/DashboardPage.jsx` — lien conditionnel GM
- `client/src/locales/fr.json` — namespace texturePacks

### Dépendances installées
- `server/` : `jszip`, `image-size`

### Validation fonctionnelle
- ✅ Migration 32 — 98 fichiers déplacés, MinIO vérifié
- ✅ GET /api/textures/<uuid>/sol/metal_plate_top.png → 200 image/png
- ✅ GET /api/voxel-textures → 78 textures, aucune régression
- ✅ GET /api/texture-packs → pack structure-station, texture_count correct
- ✅ GET /api/texture-packs/<uuid>/files → 97 fichiers PNG
- ✅ Page /texture-packs accessible, packs listés, textures affichées
- ✅ Onglet Voxels — constructeur fonctionnel, aperçu 3D rotatif
- ✅ Onglet Textures PNG — grille + flags inUse
- ✅ Popup sélecteur PNG fonctionnelle
- ✅ Création voxel via from-paths
- ✅ Session de jeu — voxels affichés avec textures correctes (plus de magenta)

### Points de vigilance session suivante
- Bug A toujours présent (toggle visible character non répercuté en temps réel)
- `block-types.js` toujours orphelin sur disque — peut être supprimé proprement
- La modification des faces d'un voxel existant (PUT faces) n'est pas encore exposée dans l'UI — seul le label et les géométries sont modifiables après création

# JOURNAL CHANTIER — Fiche Personnage Polaris
> Mémoire externe du chantier "character" — indépendant du JOURNAL.md d'Enclume
> Dernière mise à jour : 2026-04-14 — Session 1 (complète)

---

## Contexte

Projet intégré dans Enclume. Deux domaines distincts dans le même monorepo :
- Domaine VTT (existant) : cartes, voxels, tokens, sessions, temps réel
- Domaine Character (nouveau) : fiche perso, compétences, inventaire, bourse, marchands, crafting, initiative, combat

Ces modules existaient en HTML/JS vanilla connectés à Google Sheets.
**Objectif : tout migrer dans Enclume** — PostgreSQL remplace Google Sheets comme pivot central.

Lien entre domaines : base PostgreSQL partagée + auth JWT partagée.
Lien technique : `character_id` (UUID) remplace le `fid` Google Sheets dans tous les modules.

Le développeur des modules joueur sera impliqué. La fiche perso est sa "porte d'entrée" —
une fois l'API disponible, il remplace ses appels Google Sheets par des appels API Enclume.

---

## Sources de vérité

| Source | Contenu |
|---|---|
| `Fiche_Polaris_Online_-_Vierge.xlsx` onglet Personnage | Structure visuelle et règles de calcul |
| `Fiche_Polaris_Online_-_Vierge.xlsx` onglet Compétences | Catalogue complet des compétences (structure cols A-G) |
| `FichePerso_v4.txt` | Documentation de conception Modules 1 à 6 (incohérences connues, résolues dans ce journal) |
| Ce journal | Décisions prises, questions résolues, plan arrêté — **source de vérité finale** |

---

## Structure de fichiers — décision arrêtée

```
Enclume/
  client/
    src/
      [existant intact — domaine VTT]
      character/        — nouveau domaine, composants React fiche perso
  server/
    src/
      [existant intact — domaine VTT]
      routes/
        character/      — nouvelles routes Express fiche perso
      db/
        migrations/     — migrations existantes (001-032) + nouvelles préfixées char_
```

**Pourquoi `character/` dans `src/` et pas à la racine :**
Vite (client) et Node/Express (server) ont `src/` comme point d'entrée.
Placer `character/` en dehors de `src/` rendrait les fichiers invisibles sans bricolage de config.

**Pourquoi on ne renomme pas l'existant en `vtt/` :**
Trop risqué — tous les imports seraient à mettre à jour sur un projet de 32 migrations stables.
Convention adoptée : le nouveau code va dans `character/`, l'ancien reste en place.
Migration progressive possible quand une zone est de toute façon modifiée.

---

## Ce qui est compris et validé

### Structure de l'onglet Compétences (Excel)
Colonnes : A=famille, B=nom parent, C=nom enfant (sous-compétence), D=marqueur, E=attributs (ex: COO/PER), G=description.
Certaines compétences ont plusieurs sous-entrées (ex: Arts martiaux > Lutte / Tech. défensives / Tech. offensives).
Certaines ont plusieurs variantes d'attributs (ex: Armes Spéciales en FOR/COO et en COO/COO = deux entrées BDD distinctes).

### Calcul score Base d'une compétence
`Base = AN(attr_1) + AN(attr_2)`. Si un seul attribut : `AN(attr) + AN(attr)` (doublé).

### Calcul Niveau Actuel (na) d'un attribut
`na = (base_level + pc_modifier + mod_genotype) - TOTAL_MALUS`
Plancher : `if (na < 3) na = 3`
Puis mapping na → AN via table de correspondance (objet JS statique).

### Modificateur génotype
Tiré de `ref_genotypes` selon le génotype choisi. 4 génotypes V1 : HUMAIN, HYB_NAT, TEC_HYB, GEN_HYB.

### Malus global
Ignoré en V1 (TOTAL_MALUS = 0). Viendra des modules armures/blessures futurs.

### Attributs secondaires — pas de table SQL
Tout calculé côté JS. Formules :
- REA = (ADA + PER) / 2
- Initiative = REA (valeur brute)
- Seuil Étourdissement = (FOR + CON + VOL) / 3
- Seuil Inconscience = Seuil_Étour + 10
- Vitesse Marche = (FOR + COO + ADA) / 3
- Vitesse Course = Marche × 2
- Mod_Dom : table fixe si FOR <= 21, sinon 5 + floor((FOR - 21) / 2)
- Arrondi Polaris : 0.5 arrondi vers le bas (ex: 16.5 → 16)

### Colonne S dans les compétences
Flag "Spécialisée". Ignoré en V1.

### Table `characters` existante dans Enclume
Contient uniquement les données techniques du token 3D. Aucune donnée Polaris dedans.
Le lien : `char_sheet.character_id → characters.id (UUID)`.

### Nom du personnage — deux champs distincts
- `characters.name` dans Enclume = nom court du token (ex: "Soleil")
- `char_identity.char_name` dans la fiche = nom officiel complet (ex: "Wayde SR-4476")
Ces deux champs sont indépendants et peuvent différer. Pas de doublon.

### Accès à la fiche
Lecture et écriture : joueur propriétaire (`characters.user_id`) OU rôle GM.

---

## Décisions d'architecture

- **PostgreSQL uniquement** — pas de SQLite, pas de standalone.
- **Composant React intégré** dans Enclume — pas d'iframe HTML.
- **Approche itérative** — module par module, pas tout d'un coup.
- **Pas de table `characters` recréée** — FK vers l'existante.
- **Migrations format `.js`** comme le reste d'Enclume (convention P30).
- **UUID partout** sauf exceptions documentées.
- **Données statiques de référence** (génotypes, compétences) : stockées en BDD.
- **Calculs** : côté client JS uniquement — le serveur ne calcule rien.
- **`pc_modifier`** : valeur agrégée en V1. Historique XP = module futur séparé.
- **`char_attributes`** : format ligne par ligne (une ligne par attribut par personnage).
- **`ref_genotypes`** : une colonne par attribut — une ligne par génotype.
- **`ref_skill_requirements`** : table séparée (one-to-many).

---

## Schéma SQL validé — V1

### Tables de référence (statiques)

**`ref_genotypes`**
```
id          TEXT PK        — 'HUMAIN', 'HYB_NAT', 'TEC_HYB', 'GEN_HYB'
label       TEXT           — nom affiché
mod_for     INT DEFAULT 0
mod_con     INT DEFAULT 0
mod_coo     INT DEFAULT 0
mod_ada     INT DEFAULT 0
mod_per     INT DEFAULT 0
mod_int     INT DEFAULT 0
mod_vol     INT DEFAULT 0
mod_pre     INT DEFAULT 0
```

**`ref_skills`**
```
id          TEXT PK        — ex: 'ACROBATIE', 'ARTS_MARTIAUX_LUTTE'
family      TEXT           — 'Physique', 'Combat', 'Mental'...
label       TEXT           — nom affiché
parent      TEXT           — NULL si pas de parent, sinon ex: 'ARTS_MARTIAUX'
attr_1      TEXT           — 'FOR', 'COO'...
attr_2      TEXT           — NULL si attr_1 x2
marker      TEXT           — NULL=Standard, 'DIFF'=(-3), 'RES_X'=(X), 'LIMIT'=(•), 'PN', 'PREREQ'=(†)
description TEXT           — tooltip affiché sur la fiche
```

**`ref_skill_requirements`**
```
skill_id    TEXT FK→ref_skills.id
type        TEXT           — 'SKILL_MIN', 'MUTATION', 'GENOTYPE'
value       TEXT           — ex: 'INFORMATIQUE' ou 'MUT_QUEUE'
threshold   INT            — valeur minimale requise
PK(skill_id, type, value)
```

### Tables personnage (dynamiques)

**`char_sheet`** — table pivot
```
id              UUID PK DEFAULT gen_random_uuid()
character_id    UUID FK→characters.id ON DELETE CASCADE
chc             INT DEFAULT 11
created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
```

**`char_identity`**
```
char_sheet_id       UUID PK FK→char_sheet.id ON DELETE CASCADE
player_name         TEXT
char_name           TEXT
height              NUMERIC(4,1)
weight              NUMERIC(5,1)
skin                TEXT
eyes                TEXT
hair                TEXT
build               TEXT
distinctive_signs   TEXT
hand_pref           TEXT           — 'R', 'L', 'A'
```

**`char_archetype`**
```
char_sheet_id   UUID PK FK→char_sheet.id ON DELETE CASCADE
genotype_id     TEXT FK→ref_genotypes.id
age             INT
sex             TEXT
is_fertile      BOOLEAN DEFAULT FALSE
origin_geo      TEXT
origin_soc      TEXT
training_base   TEXT
higher_ed       TEXT
```

**`char_attributes`**
```
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
attr_id         TEXT           — 'FOR','CON','COO','ADA','PER','INT','VOL','PRE'
base_level      INT NOT NULL DEFAULT 7
pc_modifier     INT DEFAULT 0
PK(char_sheet_id, attr_id)
```

**`char_skills`**
```
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
skill_id        TEXT FK→ref_skills.id
mastery         INT DEFAULT 0
is_learned      BOOLEAN DEFAULT FALSE
PK(char_sheet_id, skill_id)
```

### Ce qui n'existe pas en base (calculé JS uniquement)
- Modificateur génotype, Niveau actuel (na), Aptitude Naturelle (AN)
- Score Base compétence, Total compétence
- Tous les attributs secondaires (REA, Initiative, seuils, vitesses, Mod_Dom)

---

## Périmètre V1

### Dans le scope
- Module 1 : Identité
- Module 2 : Archétype / Génotype
- Module 3 : Attributs primaires (8 + Chance)
- Module 4 : Attributs secondaires (calcul JS)
- Module 5 : Compétences (affichage + calcul + saisie maîtrise)
- Tables de référence : ref_genotypes, ref_skills, ref_skill_requirements

### Hors scope V1
- Colonne S (spécialisations)
- Module 6 : Mutations & Pouvoirs Polaris
- Malus global, Armures, Blessures, Munitions, Inventaire, Argent, XP historique

---

## Questions ouvertes

- [ ] Format exact des noms de fichiers de migration (Q20) — besoin de voir 2-3 noms réels
- [ ] Seed dans `up` ou fichier séparé (Q21) — besoin de confirmation
- [ ] Structure des routes API Express à définir

---

## Historique des sessions

### Session 1 — 2026-04-14
Phase apprentissage/compréhension + décisions d'architecture complètes.
26 questions posées, toutes répondues.
Découverte tardive de l'écosystème complet (7 modules JS, Google Sheets comme pivot).
Décision : tout migrer dans Enclume, Google Sheets abandonné.
Structure de fichiers arrêtée. Schéma SQL validé.
Aucun code produit.
Prochaine étape : répondre Q20+Q21 puis migrations SQL.

---

## Session 1 — suite (même journée)

### Migrations produites et appliquées ✅
- `33_char_ref_genotypes.js` — table + seed 4 génotypes
- `34_char_ref_skills.js` — table vide (seed manuel à prévoir)
- `35_char_ref_skill_requirements.js` — table vide (seed manuel à prévoir)
- `36_char_sheet.js` — 5 tables dynamiques (char_sheet, char_identity, char_archetype, char_attributes, char_skills)
- Batch 13 — 4 migrations — SR OK

### Routes API produites et validées ✅
- `server/src/routes/character/char-sheet.js` — 7 routes
- `server/src/index.js` — 2 lignes ajoutées (import + montage)
- SR OK

### Règle générale actée
Toujours privilégier le robuste au rapide. Pas de solution rapide, pas de rework.

### Prochaine étape
Composant React — `client/src/character/` — fiche personnage V1.
Périmètre : Modules 1+2+3+4 (identité, archétype, attributs, attributs secondaires).
Module 5 (compétences) après validation des modules précédents.

---

## Session 9C — 2026-04-19 — Chantier Entités V1

### Contexte
Suite directe de 9B. Objectif : implémenter le système d'entités interactables (portes, coffres, interrupteurs, etc.) de bout en bout — DB, serveur, WebSocket, client.

### Décisions d'architecture

**Blueprint / Instance pattern**
Deux tables séparées : `entity_blueprints` (modèle réutilisable) et `entities` (instance posée sur une battlemap).
Modifier un blueprint n'affecte pas rétroactivement les instances existantes — cohérence avec le pattern `voxel_textures`.
`deprecated` sur blueprint (pas ON DELETE RESTRICT) — même pattern que voxel_textures.

**Geometry JSONB**
`entity_blueprints.geometry` stocke `{ width, height, depth, faces: { east, west, top, bottom, south, north } }`.
Les faces référencent des `voxel_textures.id` (integer) — réutilisation du système de textures existant.
PE14 actif : `pos_y` en base = Z Three.js (profondeur), `pos_z` en base = Y Three.js (altitude).

**States JSONB**
`entity_blueprints.states` = tableau d'états `[{ id, name, visual_override: { face_overrides, opacity } }]`.
`entities.current_state_id` = index dans ce tableau. Fallback states[0] si index invalide (PE11).

**Interactions JSONB**
`entity_blueprints.interactions` = tableau `[{ id, action_label, skill_id, difficulty_dc, required_state_ids[], target_state_id }]`.
`entities.interaction_overrides` = `{ [interactionId]: { difficulty_dc?, skill_id? } }` — override par instance.
`entities.disabled_interactions` = tableau d'IDs désactivés sur l'instance.

**Flux réseau actions entités**
4 étapes : REQUEST (joueur → serveur) → PENDING (serveur → GM) → RESOLVE (GM → serveur) → RESULT (serveur → joueur).
Timeout 60s côté serveur — refus automatique si GM ne répond pas (PE12).
`skillTotal` calculé côté client, jamais recalculé serveur (PE1).
`pendingEntityActions` Map déclarée hors `initSocket` — une seule instance partagée.

**Onglet Actions GM dans Sidebar**
Remplace toute popup modale. Badge rouge compteur sur l'onglet. Navigation dans la file (‹ ›).
Panneau arbitrage : compétence, score joueur, difficulté modifiable, modificateur GM.
Boutons : Accepter (jet 2D10) / Réussite auto / Refuser.

**Canvas unique en mode édition**
`EntityEditorScene` intégrée dans `Editor3D.jsx` — pas de composant Canvas séparé.
`Editor3D` reçoit `activeEditorTab` en prop et route vers `EditorScene` ou `EntityEditorScene` dans le même Canvas R3F.
Évite le double contexte WebGL lors du switch d'onglets éditeur.

**Bug WebGL context lost documenté**
`THREE.WebGLRenderer: Context Lost` au switch `Canvas3D` ↔ `Editor3D` (mode play ↔ mode edit).
Cause : Three.js r160+ + drivers GPU Windows — deux contextes WebGL en transition simultanée.
Mitigation tentée : délai 300ms + loading screen logo. Non résolu — warning non bloquant, éditeur fonctionnel.
Décision : documenté, abandonné. L'éditeur et le canvas fonctionnent correctement après le warning.

### Fichiers produits

**shared/**
- `events.js` — 8 constantes ENTITY_* ajoutées

**server/src/db/migrations/**
- `41_entity_blueprints.js` — table entity_blueprints (migrations batch 15, appliquées)
- `42_entities.js` — table entities (migrations batch 15, appliquées)

**server/src/routes/**
- `entity-blueprints.js` — CRUD blueprints (GET /, GET /all, GET /:id, POST /, PUT /:id, DELETE /:id)
- `entities.js` — CRUD instances (GET /, POST /, PUT /:entityId, DELETE /:entityId) — mergeParams

**server/src/index.js** — imports + montages entity-blueprints et entities ajoutés

**server/src/socket/index.js**
- `socket.data.role = member.role` dans SESSION_JOIN (ciblage GM via fetchSockets)
- `pendingEntityActions` Map hors initSocket
- Handlers : ENTITY_ACTION_REQUEST, ENTITY_ACTION_RESOLVE, ENTITY_CREATED, ENTITY_DELETED, ENTITY_MOVED
- Helper `resolveEntityState()` après fermeture initSocket

**client/src/stores/entityStore.js** — Zustand : entities[], blueprints{}, setEntities/addEntity/removeEntity/updateEntity/upsertBlueprint

**client/src/components/EntityMesh.jsx** — composant partagé Canvas3D + Editor3D. Branches GLB (useGLTF) et voxel. Liseré BackSide cyan (Alt), overlay violet wireframe (gm_only). HoverIcon Html flottante au survol. PE11/PE14/PE4 respectés.

**client/src/components/EntityEditor.jsx** — composant autonome (non utilisé en production — remplacé par intégration dans Editor3D)

**client/src/components/Editor3D.jsx** — MODIFIÉ : imports EntityMesh + useEntityStore, GhostEntity + EntityEditorScene insérés, prop activeEditorTab ajoutée, Canvas unique route vers EntityEditorScene ou EditorScene selon onglet actif.

**client/src/components/Canvas3D.jsx** — MODIFIÉ : imports EntityMesh + useEntityStore, state altPressed (keydown/keyup Alt — e.code), chargement textures étendu aux entités, rendu EntityMesh dans Scene, handlers WS ENTITY_CREATED/DELETED/UPDATED/MOVED, prop onEntityClick.

**client/src/components/Sidebar.jsx** — MODIFIÉ : props activeEditorTab/onEditorTabChange/entityActionQueue/onEntityActionResolve, onglets Voxels/Entités en mode édition, onglet Actions GM avec badge rouge et panneau arbitrage complet.

**client/src/pages/SessionPage.jsx** — MODIFIÉ : import useEntityStore, état activeEditorTab + entityActionQueue + entityPanel + canvasVisible + handleModeChange (délai 300ms), loadSession + loadMap + MAP_SWITCH étendus aux entités, handlers WS ENTITY_ACTION_PENDING + ENTITY_ACTION_RESULT, handleEntityClick, handleEntityActionResolve, panneau flottant entité joueur.

### État fonctionnel
- SR serveur OK, nodemon clean
- Onglets Voxels/Entités présents et cliquables
- Mode entités affiche la scène 3D sans crash d'onglets
- Warning WebGL context lost au switch play/edit — non bloquant, éditeur fonctionnel
- Système entités non testable en l'état : aucun blueprint créable depuis l'UI

### Prochaine étape
**Chantier 9D — Blueprint Editor** : page Dashboard pour créer/modifier les blueprints d'entités. Clone de TexturePacksPage. Prérequis au test fonctionnel du système entités.

### Pièges actifs nouveaux

| Code | Description |
|---|---|
| PE1 | skillTotal calculé client — serveur ne recalcule jamais |
| PE2 | socket.data.role requis pour fetchSockets() ciblage GM |
| PE4 | face null = face invisible — guard avant accès matériaux |
| PE11 | fallback states[0] si current_state_id invalide |
| PE12 | timeout 60s pendingEntityActions — clearTimeout à la résolution |
| PE13 | touche R = rotation ghost ou entité sous curseur selon mousePosRef |
| PE14 | pos_y base = Z Three.js (profondeur), pos_z base = Y Three.js (altitude) |
| PE16 | e.code obligatoire pour Alt (AltLeft/AltRight) — invariant AZERTY/QWERTY |
## Session 33 — 2026-04-21

### Contexte de reprise
Suite du chantier 9C. Objectif : créer l'interface de création des blueprints (chantier 9D rebaptisé "Atelier du GM") et connecter le rendu entités en session.

### Décisions prises

**Atelier du GM — WorkshopPage remplace TexturePacksPage**
Route `/workshop` + redirect `/texture-packs → /workshop`.
Trois onglets dans l'ordre : Textures → Matériaux → Éléments interactifs.
Composants séparés : VoxelBuilderTab + EntityBuilderTab dans `client/src/components/`.

**Workflow GM final**
`Texture PNG → CHOIX : Matériau (voxel) OU Élément interactif`.
Les deux partent du même PNG brut. Aucune dépendance entre eux.
Un élément interactif n'hérite pas d'un matériau — il utilise directement les PNG.

**Format geometry.faces — chemins PNG strings**
`entity_blueprints.geometry.faces` = `{ east: "uuid.png", north: "uuid2.png" }`.
Même format que `voxel_textures.faces`. Plus d'integers voxel_texture_id.
Pack_id obligatoire sur blueprint pour construire l'URL (PEF1).

**entityTextureMaterials séparé de textureMaterials**
Canvas3D maintient deux dictionnaires :
- `textureMaterials` — voxels, indexé par voxel_texture_id integer
- `entityTextureMaterials` — entités, indexé par blueprint.id UUID
  Structure : `{ [bp.id]: { base: { faceMaterials }, states: { [stateId]: { faceMaterials } } } }`

**Face_overrides des états — chargement complet**
Pour chaque état avec face_overrides, un fakeTexObj fusionné est chargé.
EntityMeshVoxel choisit le jeu de matériaux selon l'état courant avec fallback sur base.

**Dimensions entités — width/height/depth libres**
Décision 1×1×1 annulée. Les entités ont des dimensions configurables.
`geometry.width/height/depth` stockés en JSONB — aucune migration.

**Upload GLB blueprints**
Route `POST /api/entity-blueprints/:id/upload-glb` — même pattern que characters.
MinIO : `glb/<blueprint_id>.glb`. Cache busting P19.

**Compétence skill_id — menu déroulant**
Chargé depuis `GET /api/char-ref/skills`. Affiche le label, stocke l'id.

**Migration 43**
`entity_blueprints.pack_id` UUID nullable FK → texture_packs.id.
`voxel_textures.usage_hint` TEXT nullable — hint de tri, jamais exclusif (PE17).

### Pièges actifs nouveaux

| Code | Description |
|---|---|
| PE17 | usage_hint = hint de tri, jamais exclusif — "Voir tout" toujours disponible |
| PE18 | blueprint.pack_id nullable — guard avant tout accès |
| PEF1 | pack_id obligatoire sur blueprint pour charger les textures |
| PEF2 | fakeTexObj conforme : { id, pack_id, faces } — faces = chemins PNG |
| PEF3 | entityTextureMaterials indexé par blueprint.id UUID |
| PEF4 | face_overrides états = même format chemin PNG |
| PEF5 | Blueprints sans pack_id → skip chargement textures, rendu magenta |
| PEF6 | Canvas3D : deux zones de chargement séparées voxels / entités |

### Fichiers produits

**Client**
- `client/src/pages/WorkshopPage.jsx` — shell Atelier du GM
- `client/src/components/VoxelBuilderTab.jsx` — onglet Matériaux
- `client/src/components/EntityBuilderTab.jsx` — onglet Éléments interactifs (refonte complète)
- `client/src/App.jsx` — route /workshop + redirect /texture-packs
- `client/src/pages/DashboardPage.jsx` — lien "Atelier du GM"
- `client/src/components/Canvas3D.jsx` — entityTextureMaterials séparé, chargement fakeTexObjs
- `client/src/components/EntityMesh.jsx` — prop entityTextureMaterials, accès par blueprint.id

**Serveur**
- `server/src/routes/entity-blueprints.js` — route POST /:id/upload-glb ajoutée
- `server/src/routes/voxel-textures.js` — usage_hint exposé dans GET et PUT
- `server/migrations/43_entity_pack_hint.js` — appliquée batch 16

### État fonctionnel
- SR serveur OK, nodemon clean tout au long de la session
- WorkshopPage accessible via /workshop, onglets fonctionnels
- Création blueprints OK depuis l'Atelier
- Upload GLB blueprint OK
- Menu déroulant skills OK
- Canvas3D charge les textures entités via fakeTexObjs

### Bug identifié — non corrigé
**Blueprints non visibles dans palette éditeur Sidebar.**
Créés dans l'Atelier mais n'apparaissent pas dans l'onglet Entités de l'éditeur.
Cause probable : entityStore ou Sidebar ne rechargent pas après création via WorkshopPage.
Priorité 1 prochaine session.

### Documents produits
- `PLAN_ENTITY_FACES.md` — plan complet refonte faces entités (disponible en outputs)
- `Entité_v4.md` — référence de conception mise à jour
- `EN_COURS.md` — mis à jour
- `ROADMAP.md` — mis à jour