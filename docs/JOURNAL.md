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