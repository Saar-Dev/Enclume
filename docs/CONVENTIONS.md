# CONVENTIONS — Règles de code et de nommage
> Dernière mise à jour : 2026-04-06 Session 14

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

## Localisation — i18n NON NÉGOCIABLE
**Toute chaîne visible par l'utilisateur doit passer par i18next. Sans exception.**

Cette règle s'applique à chaque fichier React créé ou modifié, dès la première ligne de texte.
Ne pas reporter l'i18n "pour plus tard" — c'est la source de la dette technique.

```javascript
// ✅ Correct
import { useTranslation } from 'react-i18next'
const { t } = useTranslation()
<button>{t('common.save')}</button>

// ❌ Interdit — chaîne en dur
<button>Enregistrer</button>
<button>Save</button>
```

**Règles :**
- Toute nouvelle clé ajoutée dans le code doit être ajoutée simultanément dans `client/src/locales/fr.json`
- Les clés suivent la structure `namespace.clé` : `common.save`, `dashboard.title`, `character.description`
- Si une clé n'existe pas encore dans `fr.json`, la créer immédiatement — jamais laisser une clé manquante
- Le fichier `fr.json` est la source de vérité — pas les chaînes dans le code

**Architecture i18n :**
Un seul fichier `fr.json` chargé sous le namespace `translation` (configuration i18n.js).
Toujours `useTranslation()` sans argument — jamais `useTranslation('sidebar')` ou autre namespace nommé.

**Namespaces existants dans fr.json :**
`common` / `auth` / `dashboard` / `session` / `dice` / `chat` / `token` / `battlemap` / `errors` / `sidebar` / `character` / `profile`

**Dette i18n connue — chaînes en dur résiduelles (à corriger) :**
- `Sidebar.jsx` ligne ~473 — `"Mesure"` (label bouton outil de mesure) → clé `sidebar.measureLabel` à créer
- `SessionPage.jsx` ligne ~244 — `"${username} a rejoint la session"` (message système connexion) → clé `session.userJoined` à créer
- `SessionPage.jsx` ligne ~253 — `"${username} a quitté la session"` (message système déconnexion) → clé `session.userLeft` à créer
- `SessionPage.jsx` ligne ~446 — `title="Ouvrir la sidebar"` (bouton réouverture sidebar) → clé `session.openSidebar` à créer

---

## Migrations Knex — convention UUID
**Non négociable — à respecter dans toutes les migrations sans exception.**

Toutes les clés primaires et clés étrangères utilisent **`uuid`**.
Jamais `increments()` — qui produit un `bigint` incompatible avec les UUID existants.

```javascript
// ✅ Correct — PK
table.uuid('id').primary().defaultTo(knex.fn.uuid())

// ✅ Correct — FK
table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')

// ❌ Interdit
table.increments('id')
table.integer('campaign_id')
table.bigInteger('user_id')
```

**Pourquoi :** toutes les tables existantes (sessions 1-3) utilisent `uuid`.
PostgreSQL refuse les FK si les types ne correspondent pas exactement.
Cette erreur a été découverte en session 4 — ne pas la reproduire.

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

**Routes montées sous un parent avec paramètre** (ex: `/api/campaigns/:campaignId/characters`) :
utiliser `Router({ mergeParams: true })` pour accéder aux paramètres du parent.

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
- Fichiers uploadés : validation type MIME + taille max selon le type (voir ARCHITECTURE.md)
- MinIO toujours en mode PRIVATE — tout accès passe par Express

---

## Imports
- ES Modules partout dans `server/src/` et `client/src/`
- Exception : `knexfile.cjs` en CommonJS
- Imports groupés dans cet ordre :
  1. Bibliothèques externes (`express`, `knex`…)
  2. Modules internes (`../db/knex`, `../middleware/auth`…)
  3. Constantes partagées (`../../shared/events.js`)

**Ordre des imports dans index.js — sans exception :**
1. `dotenv` en premier — avant tout autre import
2. Bibliothèques externes (express, cors, socket.io...)
3. Modules internes (db, middleware, routes...)

---

## WebSocket
- Les noms d'événements viennent TOUJOURS de `shared/events.js`
- Jamais de chaîne en dur : pas de `socket.on('token:move', ...)`
- Toujours : `socket.on(WS.TOKEN_MOVE, ...)`