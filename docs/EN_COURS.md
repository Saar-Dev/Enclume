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

MISE AJOUR 22h58 29/03/2026
# EN COURS — Travail en cours / incomplet

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète

## Phase 2 — Battlemap + dés
### Prochaines étapes
- Routes serveur : battlemaps, tokens
- Intégration Konva.js côté client
- Drag & drop tokens + synchronisation Socket.io
- Lanceur de dés (grille NdX + parser formule)
- Animation dés (seed partagé)
- Log partagé des jets

## Points de vigilance
- CLIENT_URL dans .env à configurer sur Raspberry Pi
- Bouton "Launch" sur les cards campagne — non fonctionnel (Phase 2)
- Pas de vérification email à l'inscription (décision validée)
