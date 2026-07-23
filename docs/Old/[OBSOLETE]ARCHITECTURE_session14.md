# ARCHITECTURE — Décisions techniques et justifications
> Dernière mise à jour : 2026-04-06 Session 14

## Principes généraux
- Une décision prise = documentée ici
- Toute décision non documentée est considérée comme nulle
- Stabilité > vitesse d'itération

---

## Structure : Monorepo
**Décision :** un seul dépôt Git contenant `client/`, `server/`, `shared/`.
**Pourquoi :** simplifie le partage de code (events.js), cohérence des versions,
déploiement unique sur Raspberry Pi.
**Alternative écartée :** trois dépôts séparés — trop de complexité pour un projet privé 4-8 joueurs.

---

## `.env` unique à la racine
**Décision :** un seul fichier `.env` à la racine du monorepo.
**Pourquoi :** évite la duplication de configuration entre client et serveur. Source de vérité unique.
**Impact serveur :** `dotenv.config({ path: '../.env' })`.
**Impact client :** `vite.config.js` configuré avec `envDir` pointant vers la racine.
Variables Vite préfixées `VITE_` (ex: `VITE_API_URL`), accessibles via `import.meta.env`.
**Non négociable :** pas de `client/.env` séparé.

---

## ES Modules dans server/
**Décision :** `"type": "module"` dans `server/package.json`. Syntaxe `import/export` partout.
**Exception :** `knexfile.cjs` reste en CommonJS — la CLI Knex ne supporte pas les ES Modules.
**Commande Windows :** `node_modules\.bin\knex.cmd migrate:latest --knexfile knexfile.cjs`

---

## Base de données : PostgreSQL 16
**Décision :** PostgreSQL via Docker, géré par Knex.
**Pourquoi :** robuste, supporte JSONB (voxel_data, viewport_state, résultats dés),
compatible ARM64 pour Raspberry Pi.

---

## Clés primaires et étrangères : UUID
**Décision :** toutes les PK et FK utilisent `uuid`. Jamais `increments()`.
**Pourquoi :** cohérence avec les tables existantes. PostgreSQL refuse les FK si les types
ne correspondent pas. `increments()` produit un `bigint`, incompatible avec `uuid`.
**Pattern PK :** `table.uuid('id').primary().defaultTo(knex.fn.uuid())`
**Pattern FK :** `table.uuid('xxx_id').references('id').inTable('yyy')`
**Non négociable.**

---

## Ports
| Service | Port |
|---|---|
| Client React (Vite) | 5173 |
| Serveur Express | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

---

## Auth : JWT en cookie httpOnly
**Décision :** JWT stocké dans un cookie httpOnly, pas dans localStorage.
**Pourquoi :** protège contre les attaques XSS.
**Non négociable.**

---

## Calcul des dés : serveur uniquement
**Décision :** les résultats des dés sont toujours calculés côté serveur.
Le client reçoit un `seed` pour reproduire la même animation.
**Non négociable.**

---

## Sécurité des mots de passe
**Décision :** bcrypt, saltRounds = 12, minimum 8 caractères.
Pas de contraintes de complexité — contre-productif en pratique.

---

## Avatars
Générés automatiquement basés sur le nom d'utilisateur. Pas d'upload en Phase 1.
**Prévu Phase 3 :** option upload image via MinIO.

---

## Couleur utilisateur
**Décision :** chaque utilisateur a une couleur hex assignée aléatoirement à l'inscription
(parmi une palette de 12 teintes distinctes et lisibles sur fond sombre).
Stockée dans `users.color`. Modifiable par l'utilisateur dans ses paramètres.
**Usage :** halo de sélection et label des tokens PJ. Les tokens GM sont visuellement neutres
(pas de couleur spécifique), mais le champ est présent pour tous les profils par cohérence.
**Note :** `color` n'est jamais dans le JWT — toujours relire la DB ou GET /auth/me.

---

## Rôles dans une campagne
Un seul rôle par utilisateur par campagne (GM ou player).
Plusieurs GMs possibles sur une même campagne.
**Vue joueur pour le GM :** toggle côté interface en Phase 3 —
le GM reste GM en base, l'interface simule la vue joueur.

---

## Statuts d'une campagne
`draft` / `active` (défaut) / `completed` / `archived`
Validés côté serveur dans les routes PUT /campaigns/:id.

---

## Organisation MinIO
Un seul bucket `enclume-assets` avec sous-dossiers :
- `campaigns/` — illustrations de campagne
- `battlemaps/` — images de fond des cartes (optionnel en 3D)
- `tokens/` — fichiers .glb des tokens (dont `default.glb` — modèle générique)
- `textures/` — packs de textures voxel (voir section dédiée)
- `documents/` — PDF et fichiers partagés (Phase 3)
- `audio/` — sons critiques, ambiance (Phase 3)

Le bucket reste en mode **PRIVATE**. Le serveur Express proxifie tous les accès
— le client ne touche jamais MinIO directement.
**Pourquoi PRIVATE :** MinIO ne connaît pas les utilisateurs d'Enclume. Passer par Express
permet de vérifier les JWT et les droits selon le contexte. Performant sur réseau local,
pas de surcoût significatif pour 4-8 joueurs.

---

## Route proxy assets — générale
**Décision :** `GET /api/assets/:folder/*filePath` — route générale qui proxyfie
n'importe quel sous-dossier de MinIO vers le client.
**Pourquoi générale et non ciblée :** extensible sans nouvelle route à chaque nouveau
type d'asset.
**Auth requise :** oui — vérification JWT.
**Cache-Control :** `public, max-age=3600` sur les fichiers statiques (PNG, GLB).
**Note :** la route `/api/textures` existante reste en place pour compatibilité.

---

## Uploads par les joueurs
**Décision :** les joueurs uploaderront leurs assets (portrait 2D, token .glb) via Express,
pas directement vers MinIO.
**Pattern :** `POST /api/characters/:id/upload` — Express valide, uploade dans MinIO,
met à jour `portrait_url` ou `glb_url` en base.
**Limites de taille :** à définir par type de fichier. À implémenter lors du développement
de l'upload joueur.

---

## Système de textures voxel — packs
**Décision :** textures organisées en packs thématiques dans MinIO.
**Structure :** `textures/<pack-name>/manifest.json` + PNGs dans sous-dossiers libres.
**Format manifest.json :**
```json
{
  "name": "hard-sf",
  "label": "Hard SF",
  "tileSize": 128,
  "materials": [
    { "id": 1, "name": "...", "label": "...", "top": "floor/xxx.png", "side": "floor/xxx.png" }
  ]
}
```
- `id` : entier stocké dans `voxel_data` en base — compact et stable
- `top` / `side` : chemins relatifs dans le pack
- `tileSize` : résolution des textures (128×128px actuellement)
- Le code charge le premier pack disponible par défaut
- Route proxy : `GET /api/textures/:pack/*filePath` — pas de CORS possible

---

## Moteur de rendu : Three.js / R3F
**Décision :** Three.js via @react-three/fiber (R3F) v9 + @react-three/drei v10.
Konva.js abandonné définitivement — jamais installé dans le projet.
**Pourquoi :** démo technique voxel 3D validée — le projet est orienté SF,
la 3D résout nativement altitude, portée et ligne de vue.
**Non négociable.**

---

## Contrôles caméra — MapControls
**Décision :** `MapControls` de drei — configuration définitive depuis session 7.
```javascript
mouseButtons: { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }
listenToKeyEvents(window)
keyPanSpeed = 20
maxPolarAngle = Math.PI / 2   // caméra bloquée au-dessus de Y=0
```
**Ne pas revenir à OrbitControls.**
**Pourquoi :** LEFT libéré pour la sélection/drag des tokens. MIDDLE = pan. RIGHT = rotate.
`maxPolarAngle` empêche la caméra de passer sous le sol.

---

## Système de carte : Voxel 3D
**Décision :** les cartes sont des données voxel stockées en JSONB.
**Stockage :** champ `voxel_data` JSONB sur la table `battlemaps`.
**Taille max :** grille 50×50, hauteur max 8 niveaux.
Au-delà de ~3000 cubes visibles, optimisation nécessaire (faces visibles uniquement).

**Format voxel — deux représentations distinctes (NON NÉGOCIABLE) :**

Base de données :
```json
{ "x:y:z": mat }
```
Clé = coordonnées séparées par `":"`. Valeur = entier `mat` seul. Lookup O(1), diff facile.

Mémoire React (état local Canvas3D) :
```javascript
{ "x:y:z": { x, y, z, mat } }
```
Même clé, valeur enrichie pour le rendu.

**Règles critiques :**
- `getVoxelKey(x, y, z)` → `` `${x}:${y}:${z}` `` — séparateur `":"` non négociable
- `save()` doit projeter `payload[key] = v.mat` avant l'appel REST — jamais envoyer l'objet mémoire tel quel
- Initialisation depuis la DB : `Object.entries(voxel_data)` + `key.split(':').map(Number)`

---

## Séparation routes battlemaps
`PUT /battlemaps/:id` — métadonnées + image optionnelle (avec multer).
`PUT /battlemaps/:id/voxels` — voxel_data JSON pur (sans multer).
**Pourquoi :** une route = une responsabilité. Multer et JSON pur sont incompatibles.

---

## Coordonnées des tokens
Les tokens ont des coordonnées `(pos_x, pos_y, pos_z)` en base.
Champ `pos_z FLOAT` sur la table `tokens` (migration 12).

**Mapping Three.js ↔ base de données — NON NÉGOCIABLE :**
```javascript
threeToDb(tx, ty, tz) → { pos_x: tx, pos_y: tz, pos_z: ty }
```
- `pos_x` = axe X Three.js
- `pos_y` (base) = axe Z Three.js
- `pos_z` (base) = altitude Y Three.js

**Ne jamais faire ce mapping inline.** Toujours passer par `threeToDb()`.

**Coordonnées voxel — brutes vs rendu :**
Données en base = entiers bruts. Rendu Three.js = brut + 0.5.
Ne jamais mélanger dans un calcul.

---

## Calques — flag de visibilité
Le calque n'est pas un calque de rendu — c'est un flag :
- `token` : visible par tous
- `gm` : invisible aux joueurs (embuscades, PNJ non révélés)
- `background` : éléments de décor non interactifs
Le GM bascule les tokens entre calques à tout moment.

---

## Tokens — définition élargie
Un token = tout élément placé sur la carte : PJ, PNJ, monstre, décor interactif.
Pas de distinction de type en base — le GM organise via label et calque.

---

## Tokens 3D — spécifications
**Format :** `.glb` uniquement (tout-en-un, textures embarquées).
**Boîte englobante :** 1×1×2 unités (1 case largeur, 2 cases hauteur).
**Origine :** centre de la base (les pieds).
**Polygones :** maximum 2 000 triangles.
**Matériaux :** PBR standard Metallic/Roughness.
**Texture :** atlas unique, 512×512px ou 1024×1024px max.
**Animations :** aucune — décision définitive. Pas d'idle/move/attack.
**Fallback :** cascade dégressive —
  1. `.glb` spécifique du character (`glb_url`)
  2. Illustration 2D du character (`portrait_url`) — billboard sprite
  3. Modèle générique Enclume (`tokens/default.glb` dans MinIO)

---

## Tokens 3D — instances multiples
**Décision :** utiliser le composant `<Clone>` de drei pour afficher plusieurs tokens
avec le même modèle `.glb`.
**Pourquoi :** `useGLTF` charge le modèle une seule fois en mémoire GPU.
`Clone` crée des références légères au même objet 3D — pas de rechargement,
pas de duplication mémoire. Suffisant pour 4-8 joueurs, pas besoin d'instancing.
**Pattern :**
```jsx
const { scene } = useGLTF(url)
// Pour chaque token :
<Clone object={scene} position={[x, y, z]} />
```

---

## Police 3D pour les labels de tokens
**Décision :** police Inter locale dans `client/public/fonts/inter.woff`.
Copiée depuis `node_modules/@fontsource/inter/files/`.
**Pourquoi locale :** `Text` de drei charge Roboto depuis Google Fonts CDN par défaut.
Une police locale garantit le fonctionnement hors ligne et évite toute latence réseau.
**Usage :** `<Text font="/fonts/inter.woff" ... />`

---

## Architecture WebSocket — serveur seul émetteur
**Décision :** le serveur est le seul émetteur d'événements WS suite à une action REST.
**Non négociable depuis Chantier 1 (session 11).**

```javascript
// ✅ Pattern cible
await api.put('/tokens/:id', data)
// silence côté client — le serveur broadcastera depuis la route REST

// ❌ Interdit
await api.put('/tokens/:id', data)
socket?.emit(WS.TOKEN_MOVED, { ... })  // double émission, désynchronisation possible
```

**Accès à `io` depuis les routes Express :**
```javascript
// server/src/index.js
app.set('io', io)

// Dans une route
const io = req.app.get('io')
io.to(campaignId).emit(WS.TOKEN_MOVED, { ... })
```

**Exceptions conservées côté client (commandes, pas broadcasts post-REST) :**
- `MAP_SWITCH` — commande GM volontaire
- `VOXEL_ADD` / `VOXEL_REMOVE` — édition temps réel socket
- `CHAT_MESSAGE` — pas un post-REST

---

## updated_at dans les routes PUT
**Décision :** tout PUT en base doit inclure `updated_at` (Chantier 2, session 12).
**Pattern obligatoire :**
```javascript
const updates = {}
// ... construire updates ...
if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update')
// updated_at APRÈS le guard — jamais avant
updates.updated_at = db.fn.now()
await db('table').where({ id }).update(updates).returning('*')
```
**Pourquoi après le guard :** si `updates` ne contient que `updated_at`, le guard ne lève
pas d'erreur et un update inutile est exécuté.
**`updated_at` jamais dans le JWT** — pas de valeur d'identité.

---

## Pattern reconnectTrigger — reconnexion socket
**Décision :** la reconnexion socket est gérée exclusivement depuis `SessionPage`
via un compteur `reconnectTrigger`. (session 9)

```javascript
// SessionPage.jsx
const [reconnectTrigger, setReconnectTrigger] = useState(0)

useEffect(() => {
  const s = io(...)
  // ...
  return () => s.disconnect()
}, [campaignId, reconnectTrigger, loadSession])

// Sidebar appelle onReconnectSocket → setReconnectTrigger(n => n + 1)
```

**Sidebar ne possède pas le socket.** Ne jamais appeler `socket.disconnect/connect`
depuis Sidebar ou un composant enfant. Toujours passer par `setReconnectTrigger`.

---

## Modes GM pendant la session
Pas de séparation éditeur/session — une toolbar qui switche entre modes :
- **Mode jeu** : déplacement tokens, dés, chat
- **Mode édition** : pose/suppression voxels, déplacement décor
Les modifications voxel sont broadcastées via Socket.io en temps réel.

---

## Éditeur voxel
Clic gauche : pose un voxel de la matière active.
Clic droit : efface le voxel ciblé.
Raycasting sur le plan de sol Y=0 et sur les voxels existants.
Pose sur face d'un voxel : position = voxel + normale de la face.
Sauvegarde automatique toutes les 60s si dirty + à la fermeture de l'éditeur.

---

## Murs invisibles
Table `walls` conservée — murs logiques invisibles (vitres, fenêtres, cloisons).
Bloquent la ligne de vue sans être des voxels visibles.

---

## Zones
Table `zones` conservée pour Phase 3 (effets de sorts, zones de danger, Polaris).
L'altitude Z gère nativement avantage/désavantage — pas de zones dédiées à ça.

---

## Matière eau
Faisable avec Three.js : plan animé, shader de distorsion, transparence.
Pertinent pour Polaris (JDR sous-marin).
Un voxel de type "eau" affiche ce matériau animé au lieu d'un cube solide.
**Prévu Phase 3.**

---

## X-Ray (occlusion)
Quand un voxel se trouve entre la caméra et un token,
il est rendu transparent automatiquement.
Implémentation : raycasting caméra → token, transparence sur les hits.

---

## Viewport — comportement
- Par défaut : chaque joueur navigue librement
- "Snap GM" : le viewport du joueur suit celui du GM (persistant)
- "Verrouiller vue" : le GM bloque tous les joueurs sur sa position

---

## Outil règle/mesure
Distance euclidienne 3D entre deux points.
Affichage en cases × `scale_label` de la carte.

---

## Dés — système
Tous les dés : D4, D6, D8, D10, D12, D20, D100.
Calcul toujours côté serveur (non négociable).
Critiques configurables par campagne, par dé (seuil haut / seuil bas).

---

## Battlemaps — organisation
- Organisation en dossiers par campagne (ex: Ville/, Donjon/)
- Chaque battlemap a ses propres paramètres de grille
- Une battlemap créée automatiquement à la création de campagne
- Le GM peut basculer chaque joueur vers n'importe quelle battlemap

---

## Dessin libre — abandonné
Hors scope définitivement.

---

## Sidebar — structure des onglets
La Sidebar contient 5 onglets actifs + 1 placeholder. L'ordre et le contenu sont fixes.

**Onglet Chat**
Fil de messages chronologique, fusionné avec le log des jets de dés.
Input texte en bas.
Branché sur Socket.io (WS.CHAT_MESSAGE).
Messages système connexion/déconnexion inclus dans le fil.
Mapping payload serveur : `{ userId, username, color, text, timestamp }` → `{ id, user, color, text, time }`.

**Onglet Persos**
Liste des characters de la campagne (filtrée selon `visible` pour les joueurs).
Drag natif HTML vers le canvas pour placer un token.
Clic sur une carte → modale fiche character (3 onglets : Fiche / Notes / Paramètres).
Bouton "Nouveau personnage" (GM uniquement).
Toggle visible/invisible (GM uniquement, dans la modale).
Propriétaire affiché dans l'onglet Paramètres de la modale uniquement.

**Onglet Joueurs**
Liste des membres de la campagne.
Indicateur en ligne / hors ligne (basé sur Socket.io présence).
Badge GM / Joueur selon le rôle dans la campagne.
Nom du personnage principal associé au joueur (si existant).

**Onglet Dés**
Interface flottante au-dessus du canvas (pas dans la Sidebar).
Grille nombre × type : 1 à 4 dés, types D4 / D6 / D8 / D10 / D12 / D20 / D100.
Lien "Jet avancé" → formule libre (ex: 2d6+3).
Résultats affichés dans le Chat (log fusionné).
Critiques configurables par campagne, par dé (seuil haut / seuil bas).
Calcul toujours côté serveur (non négociable).

**Onglet Bibliothèque**
Documents partagés uploadés dans MinIO.
Visibilité gérée par le GM (visible / masqué aux joueurs).
Phase 3.

**Onglet Config**
Paramètres utilisateur accessibles en session.
Changement de couleur (token halo + label).
Changement du nom d'affichage.
Ces modifications passent par PUT /api/users/me.
Si username change → nouveau JWT régénéré + reconnectTrigger déclenché.