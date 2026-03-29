# EN COURS — Travail en cours / incomplet

## Phase 0 — ✅ Complète

### 1. Connexion DB vérifiée au démarrage serveur
**Statut :** ✅ Stable

**Fichier concerné :** `server/src/index.js`
**Statut :** pas encore implémenté

# EN COURS — Travail en cours / incomplet

## Phase 1 — Auth + campagnes
### Prochaines étapes
- Gestion d'erreurs (fondations avant tout)
- Middleware requireAuth (JWT)
- Middleware requireGM
- Routes auth (register, login, logout, me)

---

### 2. `shared/events.js`
**Quoi :** fichier source de vérité pour tous les noms d'événements
WebSocket. Client et serveur l'importent tous les deux — personne
n'écrit les noms d'événements en dur dans le code.

**Fichier concerné :** `shared/events.js`
**Statut :** pas encore créé

---

### 3. Client React (Vite)
**Quoi :** initialiser l'application React dans `client/` avec Vite.
Installer les dépendances de base. Vérifier qu'elle démarre et
communique avec le serveur.

**Dossier concerné :** `client/`
