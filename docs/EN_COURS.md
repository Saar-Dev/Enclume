# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-04-06 Session 14

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Fait en session 9
- ✅ Canvas3D.jsx — getColumnTopY corrigé (-1 si vide, ≥0 si voxel)
- ✅ Canvas3D.jsx — altitude tokens corrigée (baseY + 0.5, drag columnY + 0.5 + DRAG_HOVER)
- ✅ DashboardPage.jsx — i18n complet (toutes chaînes en dur remplacées)
- ✅ fr.json — namespaces dashboard, profile, sidebar complétés
- ✅ server/src/routes/users.js — PUT /api/users/me (username, email, color, password)
- ✅ server/src/index.js — montage /api/users
- ✅ DashboardPage.jsx — modale profil utilisateur (username, email, color, password)
- ✅ SessionPage.jsx — barre GM supérieure (liste cartes, prévisualisation, MAP_SWITCH)
- ✅ SessionPage.jsx — menu clic droit barre GM (renommer, page d'accueil, déplacer groupe, dupliquer, supprimer, nouvelle carte)
- ✅ SessionPage.jsx — reconnectTrigger pattern (reconnexion socket propre)
- ✅ SessionPage.jsx — messages système connexion/déconnexion dans le fil
- ✅ campaigns.js — PUT /:id accepte default_battlemap_id
- ✅ battlemaps.js — POST /:id/duplicate (avec JSON.stringify voxel_data)
- ✅ socket/index.js — SESSION_JOIN retourne onlineUserIds, socket.data.userId stocké
- ✅ socket/index.js — CHAT_MESSAGE inclut color (lue depuis DB)
- ✅ Sidebar.jsx — onglet Joueurs (présence en ligne, badges, nom personnage)
- ✅ Sidebar.jsx — onglet Config (username + color picker, reconnectTrigger)
- ✅ Sidebar.jsx — chat couleur + messages système
- ✅ users.js — JWT régénéré si username/email change

### Fait en session 10 (décisions + MISSION files — aucun code)
- ✅ Analyse critique externe traitée — 8 chantiers planifiés dans MISSION files
- ✅ MISSION_chantier1.md à MISSION_chantier8.md rédigés
- ✅ Périmètre migration 19 (timestamps) acté
- ✅ Sujet voxels analysé — format `"x:y:z": mat` retenu (Chantier 3)

### Fait en session 11
- ✅ Chantier 1 — Serveur seul émetteur WS
  - server/src/index.js — app.set('io', io)
  - server/src/routes/tokens.js — broadcasts POST + PUT + DELETE
  - server/src/routes/characters.js — broadcast PUT actionsRouter
  - client/src/pages/SessionPage.jsx — suppression emit TOKEN_CREATED + TOKEN_DELETED
  - client/src/components/Canvas3D.jsx — suppression emit TOKEN_MOVE + TOKEN_DELETED
  - client/src/components/Sidebar.jsx — suppression emit CHARACTER_UPDATED (×2)

### Fait en session 12
- ✅ Chantier 2 — Timestamps + updated_at dans les payloads
  - server/src/db/migrations/20260405_19_timestamps.js — migration 19 (5 tables)
  - server/src/socket/index.js — TOKEN_MOVE updated_at + Bug B VOXEL_ADD guard
  - server/src/routes/tokens.js — updated_at PUT + TOKEN_MOVED payload
  - server/src/routes/characters.js — updated_at PUT + re-SELECT updated_at + CHARACTER_UPDATED payload
  - server/src/routes/campaigns.js — updated_at PUT + returning étendu
  - server/src/routes/battlemaps.js — updated_at PUT /:id + PUT /:id/voxels
  - server/src/routes/users.js — updated_at PUT + returning étendu
  - client/src/pages/SessionPage.jsx — TOKEN_MOVED guard obsolescence updated_at
- ✅ Chantier 4 (partiel) — loadSession extrait en useCallback dans SessionPage.jsx
- ✅ Bug B corrigé — VOXEL_ADD guard `if (!battlemapId) return`

### Fait en session 13
- ✅ Chantier 3 — Format voxel optimisé `"x:y:z": mat`
  - server/src/routes/battlemaps.js — validation PUT /:id/voxels : objet au lieu de tableau
  - server/src/socket/index.js — VOXEL_ADD + VOXEL_REMOVE : logique dictionnaire
  - client/src/components/Canvas3D.jsx — getVoxelKey (`:`) + init battlemap + save() corrigé
  - Nettoyage base : `UPDATE battlemaps SET voxel_data = '{}'` appliqué

### Fait en session 14
- ✅ Chantier 5 étape 1/4 — tokenStore
  - client/src/stores/tokenStore.js — nouveau store (setTokens, addToken, removeToken, updateToken)
  - client/src/pages/SessionPage.jsx — useState tokens → useTokenStore, 7 points de mutation
- ✅ Bug MAP_SWITCH corrigé — clic barre GM ne déplace plus les joueurs
  - loadMap() — chargement local uniquement (clic barre GM, suppression carte active)
  - handleMapSwitch() — loadMap + emit MAP_SWITCH (bouton "Déplacer le groupe ici" uniquement)

---

## Prochaine étape — Session 15 : Chantier 5 étape 2/4

### characterStore — characters, members, isGm
Même pattern que tokenStore.
Fichiers à uploader avant de coder : SessionPage.jsx (version déployée), Sidebar.jsx.

---

## Bugs connus à corriger

### Bug A — Toggle visible character non répercuté en temps réel
**Symptôme :** GM toggle visible sur un character → joueur ne voit pas le token apparaître/disparaître.
**Cause :** SessionPage met à jour `characters` via CHARACTER_UPDATED, mais les tokens sur la carte
dépendent de `tokens`. Aucun filtre ne retire/ajoute les tokens selon `character.visible` en temps réel.
Le filtrage existe au chargement initial (GET /battlemaps/:id filtre par rôle côté serveur).
**Correction prévue :** Chantier 8 (Calque GM) — filtrage côté client des tokens selon character.visible.

### Bug C — Reconnexion automatique post-redémarrage serveur non fonctionnelle
**Symptôme :** après redémarrage serveur, socket se reconnecte (transport OK) mais SESSION_JOIN
n'est pas ré-émis → socket hors room → broadcasts perdus. F5 résout le problème.
**Cause :** architecture — SESSION_JOIN non ré-émis sur reconnexion automatique socket.io.
**Correction prévue :** Chantier 5 — SESSION_STATE côté serveur + store Zustand côté client.
Voir MISSION_chantier5 addendum session 12.

---

## Suite dans l'ordre (chantiers restants)

- **Chantier 5 étape 2/4** — characterStore (characters, members, isGm)
- **Chantier 5 étape 3/4** — mapStore (battlemap, battlemaps)
- **Chantier 5 étape 4/4** — sessionStore (socket, onlineUsers, reconnectTrigger, messages) + reconnexion robuste Bug C
- **Chantier 6** — Dés (étapes A→E, spec dans MISSION_chantier6)
- **Chantier 7** — Tests routes critiques serveur
- **Chantier 8** — Features Phase 2 (dont correction Bug A toggle visible)

---

## Points de vigilance permanents

- **"La Forêt Maudite"** — pas de default_battlemap_id → ne jamais utiliser pour les tests
- **token.owner_id** — mort, jamais renseigné → toujours `character_id → characters.user_id`
- **socket dans dependency arrays** — tout useCallback qui émet doit inclure socket
- **ordre déclaration React** — useState socket avant les callbacks qui l'utilisent
- **coordonnées voxel** — données brutes en base, +0.5 uniquement dans le rendu visuel
- **reconnectTrigger** — ne jamais appeler socket.disconnect/connect depuis Sidebar
- **voxel_data** — format base `{ "x:y:z": mat }`, format mémoire React `{ "x:y:z": { x, y, z, mat } }`
- **voxel_data save()** — toujours projeter `payload[key] = v.mat` avant envoi REST
- **voxel_data socket** — VOXEL_ADD/REMOVE lisent/écrivent `mat` seul en base
- **socket.data.userId** — stocker au SESSION_JOIN pour fetchSockets()
- **JWT régénéré** — users.js le régénère si username/email change
- **CLIENT_URL + VITE_API_URL** — à reconfigurer dans .env sur Raspberry Pi
- **Calque GM** — tokens layer='gm' non encore filtrés côté client (Bug A)
- **Serveur seul émetteur WS** — ne jamais remettre de socket.emit post-REST côté client
- **req.app.get('io')** — pattern d'accès à io depuis les routes Express
- **updated_at dans les PUT** — toujours `updates.updated_at = db.fn.now()` avant `.update(updates)`
- **Bug C reconnexion** — après redémarrage serveur, F5 requis jusqu'au Chantier 5 étape 4
- **loadMap vs handleMapSwitch** — loadMap = local uniquement / handleMapSwitch = local + emit MAP_SWITCH. Ne jamais inverser.