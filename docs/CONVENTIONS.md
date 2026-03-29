# CONVENTIONS — Règles de code et de nommage

## Principes généraux
- Toute convention non documentée ici n'existe pas
- En cas de doute : poser la question plutôt que d'inventer

---

## Nommage des fichiers
| Contexte | Convention | Exemple |
|---|---|---|
| Fichiers JS | camelCase | `knex.js`, `diceParser.js` |
| Fichiers de routes | camelCase | `auth.js`, `campaigns.js` |
| Migrations | date_ordre_nom | `20260329_01_users.js` |
| Composants React | PascalCase | `BattleMap.jsx`, `DiceRoller.jsx` |
| Hooks React | camelCase, préfixe `use` | `useSocket.js`, `useAuth.js` |
| Stores Zustand | camelCase, suffixe `Store` | `authStore.js`, `battlemapStore.js` |

---

## Nommage dans le code
| Contexte | Convention | Exemple |
|---|---|---|
| Variables / fonctions | camelCase | `campaignId`, `getUserById` |
| Constantes | SCREAMING_SNAKE_CASE | `JWT_SECRET`, `MAX_FILE_SIZE` |
| Classes | PascalCase | `DiceParser` |
| Tables SQL | snake_case | `campaign_members`, `dice_rolls` |
| Colonnes SQL | snake_case | `created_at`, `owner_id` |
| Événements WebSocket | namespace:action | `token:move`, `dice:result` |

---

## Structure des routes Express
Chaque fichier de route exporte un `Router` Express.
Pattern uniforme :
```javascript
import { Router } from 'express'
const router = Router()

router.get('/', async (req, res) => {
  try {
    // logique
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
```

---

## Gestion des erreurs
- Toujours un bloc `try/catch` dans les routes async
- Erreur 400 : mauvaise requête (données manquantes ou invalides)
- Erreur 401 : non authentifié
- Erreur 403 : authentifié mais pas autorisé (mauvais rôle)
- Erreur 404 : ressource introuvable
- Erreur 500 : erreur serveur inattendue

---

## Sécurité (non négociable)
- Jamais de calcul de dés côté client
- Vérification des droits sur chaque route ET chaque événement WebSocket
- JWT uniquement en cookie httpOnly — jamais dans localStorage
- Mots de passe : bcrypt, saltRounds = 12
- Fichiers uploadés : validation type MIME + taille max 20Mo

---

## imports
- ES Modules partout dans `server/src/` et `client/src/`
- Exception : `knexfile.cjs` en CommonJS
- Imports groupés dans cet ordre :
  1. Bibliothèques externes (`express`, `knex`…)
  2. Modules internes (`../db/knex`, `../middleware/auth`…)
  3. Constantes partagées (`../../shared/events.js`)

---

## WebSocket
- Les noms d'événements viennent TOUJOURS de `shared/events.js`
- Jamais de chaîne en dur : pas de `socket.on('token:move', ...)` 
- Toujours : `socket.on(WS.TOKEN_MOVE, ...)`

## Ordre des imports dans index.js
Toujours dans cet ordre, sans exception :
1. `dotenv` en premier — avant tout autre import
2. Bibliothèques externes (express, cors, socket.io...)
3. Modules internes (db, middleware, routes...)