---
paths:
  - "client/src/stores/authStore.js"
  - "client/src/stores/sessionStore.js"
  - "client/src/stores/mapStore.js"
  - "client/src/stores/libraryStore.js"
  - "client/src/App.jsx"
  - "client/src/main.jsx"
  - "server/src/middleware/auth.js"
  - "server/src/middleware/role.js"
  - "server/src/socket/auth.js"
  - "shared/events.js"
---
# Domaine : Auth, Stores Zustand & WebSocket

**Spec technique → `docs/SYSTEME/CORE.md`**

## Pièges critiques

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.
Oublier → fermeture capturée, valeur stale, émission silencieusement ignorée.

**shared/events.js — registre unique**
Avant tout nouvel event WS : vérifier `shared/events.js` — existe déjà ?
Tout event non listé là n'existe pas. Jamais de string d'event hardcodée.

**PE2 — socket.data.role**
Pour `fetchSockets()`, utiliser `socket.data.role` — pas `socket.user.role`.

**PC44 — io.fetchSockets() pour les slots joueur**
Nécessaire quand le GM clique "Agir" pour un slot joueur (le socket du GM ≠ le socket du joueur).

**reconnectTrigger — jamais depuis Sidebar**
Ne jamais appeler `socket.disconnect/connect` depuis Sidebar.
`reconnectTrigger` incrémenté uniquement depuis SessionPage.

**Auth JWT httpOnly — 7 jours**
`updated_at` jamais dans le payload JWT (P14).
`updated_at` toujours après le guard `Object.keys` dans les routes REST (P13).

**PC41 — Express 5 : routes sans `/` initial → 404 silencieux**
Toujours `'/:id/foo'` — jamais `':id/foo'`.

**PC42 — NULL en PostgreSQL**
`WHERE NOT col = 'val'` exclut les NULL. Toujours `(col IS NULL OR col != 'val')`.
