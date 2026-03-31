# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-03-31 Session 3

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Fait en session 2
- ✅ Migrations Phase 2 (13 migrations, base stable)
- ✅ MinIO configuré (bucket enclume-assets, middleware upload)
- ✅ Routes battlemaps + tokens
- ✅ Pivot 3D — Three.js / R3F remplace Konva.js
- ✅ Script start.ps1
- ✅ Socket.io — auth WebSocket + tous les événements
- ✅ i18next configuré (fr.json, client/src/i18n.js)
- ✅ SessionPage.jsx — navigation et chargement fonctionnels
- ✅ Canvas3D.jsx — R3F opérationnel, caméra orbitale
- ✅ Sidebar.jsx — redimensionnable, cachable, outils GM, chat local, onglets
- ✅ Layout SessionPage — canvas flex + sidebar contrôlée

### Fait en session 3
- ✅ Système de packs de textures — format manifest.json validé et documenté
- ✅ Route /api/textures — liste packs + proxy PNG depuis MinIO (sans CORS)
- ✅ Route PUT /battlemaps/:id/voxels — sauvegarde voxel_data séparée (JSON pur, sans multer)
- ✅ Canvas3D — éditeur voxel fonctionnel (pose/efface, raycasting, textures)
- ✅ Canvas3D — sauvegarde auto 60s + sauvegarde à la fermeture de l'éditeur
- ✅ Sidebar — palette de matières fonctionnelle en mode édition
- ✅ SessionPage — chef d'orchestre activeMaterial + availableMaterials
- ✅ vite.config.js — envDir racine monorepo (VITE_API_URL dans .env racine)
- ✅ Premier pack hard-sf uploadé dans MinIO (9 matières)

### Prochaine étape immédiate
**Tokens 3D — fallback sphère colorée + label**
Un token = une sphère colorée avec label flottant au-dessus.
Placé sur la carte par le GM en mode jeu.
Socket.io token:move déjà implémenté côté serveur — à brancher côté client.

### Suite dans l'ordre
1. Tokens 3D — fallback sphère + label
2. Placement token par le GM (clic sur la carte)
3. Drag & drop tokens + Socket.io token:move branché
4. Brancher chat sur Socket.io (remplacer le chat local)
5. Barre GM supérieure (battlemaps + affectation joueurs)
6. Menu contextuel clic droit canvas
7. X-Ray (occlusion blocs → transparence)
8. Viewport Snap GM + verrouillage
9. Dés — parser formule + animation seed partagé
10. Outils mesure (règle, portée, visée)

### Points de vigilance
- isGM hardcodé à true dans Sidebar — à brancher sur le vrai rôle
- "La Forêt Maudite" sans battlemap (créée avant la transaction auto)
- Token générique .glb à fournir plus tard (specs dans ARCHITECTURE.md)
- Table zones conservée pour Phase 3
- CLIENT_URL + VITE_API_URL dans .env à reconfigurer sur Raspberry Pi
- console.log debug retiré de Canvas3D et textures.js ✅
