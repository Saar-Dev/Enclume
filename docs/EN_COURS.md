# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-03-31 Session 4

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Fait en session 4
- ✅ Migration 14 — color sur users
- ✅ Migration 15 — table characters (uuid, user_id nullable, visible, glb_url, portrait_url)
- ✅ Migration 16 — character_id sur tokens
- ✅ Migration 17 — color sur tokens
- ✅ Convention UUID documentée dans CONVENTIONS.md (non négociable)
- ✅ auth.js — génération couleur aléatoire à l'inscription (palette 12 teintes)
- ✅ characters.js — routes CRUD complètes avec droits GM/owner
- ✅ assets.js — route proxy générale MinIO /api/assets/:folder/*filePath
- ✅ tokens.js — réécrit (JSON pur, character_id, pos_z, color)
- ✅ index.js — characters + assets branchés
- ✅ SessionPage.jsx — isGm calculé, tokens + characters chargés, drop géré
- ✅ Canvas3D.jsx — tokens 3D (GltfLoader, SkeletonUtils.clone, halo, label Inter)
- ✅ Sidebar.jsx — isGm prop, onglet Persos, drag characters
- ✅ client/public/fonts/inter.woff — police locale pour labels 3D
- ✅ OrbitControls maxPolarAngle — caméra bloquée au-dessus de Y=0
- ✅ Drag & drop Sidebar → canvas fonctionnel (token créé en base + affiché)

### Prochaine étape immédiate — session 5
**1. Nouveau modèle default.glb**
Le modèle actuel (généré par trimesh/IA) a des textures défaillantes.
Fournir un .glb propre exporté depuis Blender ou source fiable.
Uploader dans MinIO sous tokens/default.glb (remplacer l'existant).
Recalibrer Y_OFFSET et position du cercle dans Canvas3D.jsx selon le nouveau modèle.

**2. Drag & drop token sur la carte**
Déplacer un token déjà posé par drag manuel sur la grille.
Snap à la case la plus proche (Math.round).
OrbitControls désactivé pendant le drag.
PUT /tokens/:id pour persister la nouvelle position.

**3. Socket.io token:move côté client**
Brancher l'événement token:moved — mettre à jour l'état local tokens quand un autre client déplace.

### Suite dans l'ordre
4. Brancher chat sur Socket.io (remplacer le chat local)
5. Barre GM supérieure (battlemaps + affectation joueurs)
6. Menu contextuel clic droit canvas (token sélectionné)
7. X-Ray (occlusion blocs → transparence)
8. Viewport Snap GM + verrouillage
9. Dés — parser formule + animation seed partagé
10. Outils mesure (règle, portée, visée)

### Points de vigilance
- default.glb à remplacer — modèle actuel sans textures (problème asset, pas code)
- Y_OFFSET = 0.5 et position cercle à recalibrer avec le nouveau modèle
- Chaînes UI onglet Persos pas encore passées par i18next
- "La Forêt Maudite" sans battlemap (créée avant la transaction auto)
- isGm branché mais pas encore testé avec un vrai compte joueur
- Socket.io token:move non branché côté client
- Upload illustration 2D et token .glb par joueur — Phase 3
- Scènes 2D ambiance — Phase 3 (voir ROADMAP.md)
- CLIENT_URL + VITE_API_URL dans .env à reconfigurer sur Raspberry Pi