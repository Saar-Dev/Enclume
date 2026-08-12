# PLAN_ADMIN.md — Rôle administrateur, page dédiée, gestion des utilisateurs

> **ARCHIVÉ le 2026-08-12** — chantier clos, les 3 lots confirmés par Saar en navigateur sur
> l'instance locale (bootstrap, chaque tuile de `/admin`, `/me`). Contenu durable :
> **`docs/SYSTEME/ADMIN.md`** — lire ce document pour l'état stable, celui-ci ne conserve que le
> détail de conception (analyse critique, alternatives écartées, recherche externe citée,
> `better-auth#3651`). Compte-rendu de clôture : `docs/JOURNAL8.md`, session 2026-08-12. Instance
> distante non encore testée (rien committé/poussé à la clôture) — à valider séparément lors du
> déploiement.
>
> Créé : 2026-08-12 (dev/Saar).
> Méthodologie appliquée : `docs/METHODO_PLAN.md`.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois
> tous les lots clos et confirmés en jeu ; le contenu durable (convention `role`/`requireAdmin`) sera
> transféré vers un futur `docs/SYSTEME/ADMIN.md` à ce moment-là.
> Responsabilité unique de ce document : planifier l'introduction d'un rôle administrateur global,
> son application aux outils déjà existants, et l'outil de gestion des utilisateurs qui en découle.
> Le système de tickets de bug (origine de cette conversation) est **hors périmètre** de ce plan — il
> réutilisera cette fondation une fois posée, dans un chantier séparé (§5).

---

## 0. Cadrage — ce qui est vrai aujourd'hui

Toutes les affirmations de cette section sont `[VÉRIFIÉ]` par lecture directe du code pendant cette
session, pas par mémoire de conversation ni par supposition.

### 0.1 Il n'existe aujourd'hui aucun rôle global

- `users` (`server/src/db/migrations/20260329_01_users.js`) : `id, email, password_hash, username,
  timestamps`. Aucune colonne de rôle.
- Le seul concept de rôle existant est **par campagne** : `campaign_members.role`
  (`20260329_03_campaign_members.js:6`, `text`, valeurs `'gm'`/`'player'`). Il ne dit rien du statut
  global d'un compte.
- `middleware/auth.js:4-18` (`requireAuth`) : `req.user` vient uniquement du payload JWT
  (`id, email, username`, signé dans `routes/users.js:81-85` et `routes/auth.js` au login). **Le rôle
  n'est jamais posé dans le JWT** — point de conception important, voir §3.1.

### 0.2 Les trois outils visés sont protégés de façon inégale, et plus faiblement que supposé

| Outil | Route(s) | Garde actuelle | Portée réelle |
|---|---|---|---|
| Santé serveur | `/health` → `GET /api/health/detailed` (`routes/health.js:117`) | `requireAuth` seul | N'importe quel compte joueur connecté voit process serveur (PID/user/commande), CPU, RAM, disque, températures |
| Calibration dés | `/dev/dice-calibration` (`App.jsx:73-75`) | `ProtectedRoute` seul (= connecté) | Idem — **et `DiceCalibrationPage.jsx` n'appelle aucune route serveur** : c'est un outil 100 % client, aucune donnée à protéger côté API |
| Catalogue équipement | `server/public/equipment-admin.html` → `routes/equipment.js` | Le fichier HTML lui-même : **aucune**, servi par `express.static` (`index.js:91`). Ses appels `PUT/POST/DELETE /api/equipment/:id` : `requireAuth` seul (`equipment.js:88,127,183`) | N'importe quel compte joueur peut aujourd'hui modifier/supprimer une ligne du catalogue global, avec ou sans ouvrir la page — il suffit d'appeler l'API |

`GET /api/health` (`index.js:101-102`, sans `/detailed`) est un endpoint de liveness distinct, public,
sans donnée sensible — **ne pas confondre avec `/api/health/detailed`, hors périmètre de ce plan**.

### 0.3 `equipment.js` mélange lecture gameplay et administration — erreur évitée de justesse

`GET /api/equipment` (`equipment.js:59`) et `GET /api/equipment/:id` (`:72`) ne sont pas des routes
d'administration : elles sont appelées par du gameplay normal, `[VÉRIFIÉ]` par recherche des
consommateurs client :

- `client/src/character/InventoryPanel.jsx:156` — ajout d'un objet à l'inventaire (tout joueur)
- `client/src/pages/MerchantsPage.jsx:52` — catalogue marchand
- `client/src/character/DroneWindow.jsx:488` — équipement de drone

Aucun appel `PUT`/`POST`/`DELETE` vers `/equipment` n'existe ailleurs que dans
`equipment-admin.html`. **Seules ces trois routes de mutation** (`POST /`, `PUT /:id`, `DELETE /:id`,
`equipment.js:88,127,183`) doivent passer sous garde admin — les trois `GET` restent `requireAuth`,
inchangées. Une version antérieure de ce plan proposait de gater les 6 routes ; ça aurait cassé
l'inventaire de tout joueur. Erreur détectée et corrigée avant tout code, listée ici pour que la
raison de cette distinction reste traçable.

### 0.4 Aucun précédent de route cliente réservée à un rôle dans ce projet

`[VÉRIFIÉ]` sur les trois pages déjà réservées au MJ en pratique : `CampaignSettingsPage`,
`MerchantsPage`, `WorkshopPage`. Toutes trois sont montées sous le `ProtectedRoute` générique
(`App.jsx:51-65`), identique à n'importe quelle page connectée — aucune n'a de garde de rôle côté
client. Ni `CampaignSettingsPage.jsx` ni `MerchantsPage.jsx` (recherché explicitement) ne contiennent
de vérification `role`/redirection. La seule protection réelle de ces pages est le serveur (chaque
mutation vérifie le rôle) ; côté client, seul le bouton d'accès est masqué (`DashboardPage.jsx`,
`isGmAnywhere`).

Conséquence pour ce plan (détail complet §3.2) : pas de nouveau pattern générique à inventer pour
Santé/BDD (le serveur suffit, comme pour le MJ) — mais **Dice n'a aucun serveur à qui déléguer cette
décision** (§0.2), donc un garde-fou côté client y est la seule protection possible, pas une
généralisation gratuite.

### 0.5 Conventions déjà en place à réutiliser (pas à réinventer)

- Colonnes `_by`/`_at` (uuid nullable → `users`, FK `onDelete('SET NULL')`) : omniprésentes —
  `created_by`, `resolved_by`, `requested_by`/`reviewed_by` (`130_vault_transfer_requests.js`),
  `applied_by`, `editor_locked_by`. Précédent direct pour `role_granted_by`/`role_granted_at`.
- « Provenance des octrois » (`docs/VOCABULARY.md`) : `char_advantages.acquired_during`,
  `char_mutations.source` — une colonne de provenance sur l'entité elle-même, jamais une table
  d'historique séparée, même pour des données plus sensibles mécaniquement (avantages, mutations) que
  le statut admin. Précédent direct pour ne **pas** construire de table d'audit (tranché par Saar).
- Migrations `_data` séparées d'une migration de schéma quand les deux responsabilités sont
  distinctes (`48_ref_equipment.js` / `48b_ref_equipment_data.js`).
- `routes/users.js:20-90` (`PUT /me`) : allowlist explicite de champs (`username, email, color,
  password`), jamais de spread de `req.body` — déjà le bon réflexe anti mass-assignment, à reproduire
  pour toute nouvelle route de mutation utilisateur.

### 0.6 Numérotation de migration

Fichiers de migration inspectés directement (`ls server/src/db/migrations`), pas la mémoire
d'`EN_COURS.md` (qui affiche encore "234" — déjà périmé, des migrations 235-239 existent sur disque).
Plus haut numéro simple trouvé : **239**. Prochain numéro libre proposé : **240** (schéma `role`
seul — le second numéro `241` initialement réservé pour la migration de bootstrap n'est plus
nécessaire, §0.8/§3 Lot 1), à revérifier contre `knex_migrations` au moment d'écrire le fichier (P54 —
nodemon applique automatiquement dès l'écriture).

### 0.7 Accès base de données depuis cet environnement

`[VÉRIFIÉ]` : pas de `.env` accessible, pas de `psql` installé dans ce checkout Windows. Cohérent avec
`CLAUDE.md` §3 — le dépôt serveur réel (`/home/didier/Enclume`) est une machine distincte. **Impossible
de vérifier ici** l'état réel de `users` sur quelque instance que ce soit.

### 0.8 Deux instances, deux jeux de comptes distincts — invalide la première version du bootstrap

Rappel de Saar (2026-08-12) : **local et distant sont deux bases séparées, avec des comptes
différents**. Ce fait était déjà écrit noir sur blanc dans `CLAUDE.md` §3 (`.env`, PostgreSQL, MinIO,
caches "restent propres à l'instance de travail") et dans `EN_COURS.md` ("bascule locale" vs
"confirmation secondaire serveur distant" pour d'autres chantiers) — je l'avais lu en tout début de
conversation sans le relier à la conception du bootstrap. Ça invalide la V1 de ce plan (une seule
migration `241_users_role_bootstrap_admin.js`, un email en dur) : une migration est un fichier de code
**identique** déployé sur les deux instances (`db.migrate.latest()`, `index.js:148`, appelé
automatiquement au démarrage sur chacune) — un email en dur ne peut pas être correct sur les deux à la
fois si les comptes diffèrent. Correctif en §3 (Lot 1).

### 0.10 Audit sécurité — lecture complète de `equipment.js` et `health.js` (pas seulement leur en-tête)

`[VÉRIFIÉ]` par lecture intégrale des deux fichiers (pas juste les premières lignes lues aux tours
précédents) :

- **Pas d'injection SQL** : toutes les requêtes `equipment.js` passent par le query builder Knex
  (`.insert(fields)`, `.update(fields)`, `.where({id})`) — jamais de concaténation de chaîne SQL brute.
  `health.js` (`readDisk`/`readProcesses`/`readServices`) exécute des commandes shell via `execAsync`,
  mais ce sont des chaînes **statiques**, aucune entrée utilisateur (`req.query`/`req.body`) n'y est
  interpolée — pas d'injection de commande possible depuis le client.
- **`equipment.js` — mass-assignment de colonnes, pas de rôle** : `sanitize()` (`:27-45`) coerce les
  types mais ne filtre pas les **clés** acceptées — `POST`/`PUT` écrivent n'importe quelle colonne
  présente dans `req.body` sur `ref_equipment`. Risque réel mais **faible et préexistant** : cette
  table ne porte aucune colonne de permission/propriété (uniquement du contenu de catalogue de jeu),
  donc rien à escalader via ce biais aujourd'hui. Pas causé par ce plan, pas corrigé par lui non plus
  (`requireAdmin` ferme qui peut appeler la route, pas ce qu'on peut y écrire une fois admis — deux
  problèmes distincts, §2.1). **Signalé, explicitement hors périmètre** — à traiter dans un futur
  passage dédié si `ref_equipment` gagne un jour une colonne sensible.
- **`health.js:84-96` (`readProcesses`)** — `ps aux --sort=-%cpu | head -6`, capture la ligne de
  commande de chaque processus (tronquée à 60 caractères). Si un processus du serveur réel était
  démarré avec un secret **inline** dans sa ligne de commande (ex.
  `DATABASE_URL=postgres://user:pass@... node index.js` au lieu d'un fichier d'environnement
  systemd), ce secret serait visible dans cette réponse. `readServices()` (`:102-115`) interroge
  `enclume-server`/`enclume-client` comme unités **systemd**, ce qui suggère fortement (`[INFÉRÉ]`, non
  vérifiable depuis ce checkout Windows — pas d'accès à `/home/didier/Enclume`) que les secrets
  passent par `EnvironmentFile=`, pas par la ligne de commande. **Gater cette route derrière
  `requireAdmin` (Lot 2) réduit déjà l'exposition (d'"tout joueur" à "admin seul") quoi qu'il en soit**
  — mais je ne peux pas vérifier la ligne de commande réelle des unités systemd distantes. Demande
  ponctuelle à Saar (pas un blocage du plan) : confirmer que `systemctl cat enclume-server` ne montre
  aucun secret inline sur les deux instances.

### 0.9 Précédent direct déjà présent dans ce projet — pas besoin d'inventer un mécanisme

`[VÉRIFIÉ]` `routes/auth.js:60-70` : `REGISTRATION_CODE`, lu depuis `process.env` **à l'exécution**
(pas en migration), avec garde explicite (`AppError 500` si absent/mal formé) — documenté
`docs/ASBUILT.md:708` (« Code d'invitation `REGISTRATION_CODE` dans `.env` »). C'est exactement le
patron qu'il faut ici : une valeur sensible et différente par instance, dans le `.env` propre à
chaque instance (déjà la règle du projet, §3 `CLAUDE.md`), jamais committée. Recherche externe
confirmant que ce n'est pas propre à ce projet : Django (`DJANGO_SUPERUSER_EMAIL` +
`--noinput`, [How to automate creating a Django super user](https://vuyisile.com/how-to-automate-creating-a-django-super-user/))
fait la même chose pour bootstrap un premier admin — à la différence près que Django l'utilise pour
**créer** un compte (mot de passe fourni en clair, l'article lui-même déconseille ça en production),
alors qu'ici le compte existe déjà : on ne fait qu'une promotion de rôle, aucun secret en transit.

`[VÉRIFIÉ]` `index.js:141-160` : séquence de démarrage déjà établie —
`db.raw('SELECT 1')` → `db.migrate.latest()` → `syncBuiltinModels()` (réconciliation idempotente d'un
catalogue au boot, précédent structurel direct) → connexion MinIO → `listen()`. Point d'insertion
naturel pour une réconciliation idempotente supplémentaire, sans inventer de nouveau mécanisme de
cycle de vie.

---

## 1. Décisions déjà actées (rappel, pas à rediscuter)

- Rôle nommé `admin` (pas de renommage thématique, pas de leurre décoratif — décidé, argumenté par
  l'absence de valeur défensive réelle d'un flag leurre face à l'allowlisting déjà en place §0.5).
- Pas d'historique des promotions/rétrogradations passées — état courant seulement.
- Bootstrap par variable d'environnement `ADMIN_BOOTSTRAP_EMAIL` (jamais en dur dans un fichier
  versionné — voir §0.8/§0.9 et §3 Lot 1 pour le mécanisme corrigé). Valeur confirmée (2026-08-12) :
  **`d.lebosse@protonmail.com` sur les deux instances**, locale et distante.
- Répartition en lots, validés un par un — pas de code avant validation explicite de chaque lot.

---

## 2. Analyse critique (Phase 2 méthodologie)

### 2.1 Problème structurel identifié : `equipment.js` n'a pas de séparation lecture/administration

Déjà détaillé en §0.3. La cause racine n'est pas "un oubli de garde" mais que ce routeur porte deux
responsabilités distinctes (catalogue consultable par tous les joueurs + édition du catalogue global)
sans découpage de fichier ni de préfixe de route qui le rendrait visible d'un coup d'œil. Ce plan ne
propose **pas** de scinder `equipment.js` en deux fichiers (hors périmètre, risque de régression sur
un fichier qui fonctionne) — seulement d'ajouter `requireAdmin` aux trois routes de mutation, en
commentant explicitement pourquoi les trois autres n'y passent pas, pour qu'un futur lecteur ne
"corrige" pas ça par erreur.

### 2.2 `/dev/dice-calibration` ne peut pas être vraiment sécurisé

`[VÉRIFIÉ]` §0.2 : aucun appel serveur. Un contrôle client (`AdminRoute`) empêche la navigation
normale (clic, barre d'adresse) mais n'empêche pas quelqu'un de modifier le bundle JS en local pour
contourner la redirection. C'est un plafond bas et je le signale explicitement plutôt que de laisser
croire que `AdminRoute` "sécurise" cet outil au même niveau que Santé/BDD — pour cet outil précis, sans
enjeu de donnée (pas de lecture/écriture serveur), c'est un niveau de protection suffisant, mais pas du
même ordre.

### 2.3 Portée de "gestion des utilisateurs" — décision de segmentation

Saar : « c'est un outil à part entière à créer ». Je le traite comme un lot séparé (Lot 3) plutôt que
de l'intégrer au Lot 1 (fondation) ou au Lot 2 (gate des outils existants), pour trois raisons :

1. Le Lot 1 pose la colonne `role` — la gestion des utilisateurs (lister, promouvoir, rétrograder) est
   un **consommateur** de cette colonne, pas une condition pour qu'elle existe. Les découpler permet de
   valider la fondation seule avant d'ajouter une surface d'API supplémentaire.
2. Aucun des 4 outils cités par Saar au tour précédent ("ticket, health page, bdd et dice") n'incluait
   "utilisateurs" — c'est apparu ensuite, une fois la question du bootstrap posée. Le traiter comme un
   lot distinct évite de re-élargir silencieusement un scope déjà validé.
3. Une route `PATCH /:id/role` est une nouvelle surface d'attaque (élévation de privilège si mal
   gardée) — elle mérite sa propre revue, pas d'être noyée dans le lot "brancher 3 outils existants".

---

## 3. Conception — Lots

### Lot 1 — Fondation : colonne `role`, garde serveur, bootstrap

**Migration `240_users_role.js` (schéma)**
```js
users.role            text NOT NULL DEFAULT 'user'   // 'user' | 'admin'
users.role_granted_by uuid NULL REFERENCES users(id) ON DELETE SET NULL
users.role_granted_at timestamp NULL
```
+ contrainte, même patron que `chk_vault_transfer_requests_status`
(`130_vault_transfer_requests.js:35-39`, `[VÉRIFIÉ]`) :
```sql
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin'))
```
Défense en profondeur : même si un bug applicatif futur (endpoint mal écrit, script ponctuel, faute
de frappe) tentait d'écrire une valeur hors de `'user'`/`'admin'`, la base la refuse — indépendamment
de la couche qui a essayé d'écrire. Coût nul, précédent déjà établi dans ce projet, pas une
invention.

`role_granted_by`/`role_granted_at` : mis à jour à **chaque** changement de rôle (promotion ou
rétrogradation), dans les deux sens — donne "qui a fait le dernier changement, quand" sans construire
d'historique (§0.5, §1). `NULL` = jamais changé depuis la création du compte (le cas du bootstrap :
personne ne "promeut" le premier admin, voir ci-dessous).

**Invariants de sécurité à ne jamais casser (pour ce lot et tout ce qui en dépendra) :**
1. `role` n'entre **jamais** dans le payload JWT (§0.9/`middleware/auth.js`) — seule une lecture DB
   fraîche fait foi. Si un futur passage sur `routes/users.js` (ré-signature du cookie,
   `:80-87`) est modifié pour une raison quelconque, `role` ne doit toujours pas y apparaître.
2. `requireAdmin` doit **fermer par défaut** (fail-closed) : `role === 'admin'` en égalité stricte,
   jamais `role !== 'user'` (qui traiterait une valeur inattendue comme admin). Si l'utilisateur du
   JWT n'existe plus en base (compte supprimé après émission du token), rejeter — ne jamais traiter
   "introuvable" comme "admin".
3. `GET /api/admin/users` (Lot 3) exclut `password_hash` du `select` — même réflexe que
   `routes/auth.js:148` (`GET /me`).
4. Aucun log (`[BOOTSTRAP-ADMIN]` ou futur `[ADMIN-ROLE-CHANGE]`) ne contient autre chose que
   email/id — jamais de mot de passe ni de secret (`core.md` — "ne jamais exposer un secret dans...
   les logs").

**Bootstrap admin — PAS de migration, corrigé suite à §0.8/§0.9**

Une migration est un fichier de code identique déployé sur les deux instances — inadaptée à une
valeur (l'email à promouvoir) qui diffère par instance. Nouveau mécanisme, calqué sur le précédent
`REGISTRATION_CODE` déjà dans ce projet (§0.9) :

- Nouveau `server/src/lib/bootstrapAdmin.js`, fonction `bootstrapAdminFromEnv()` :
  ```js
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL
  if (!email) return // pas configuré sur cette instance — no-op silencieux, sûr par défaut
  const updated = await db('users')
    .where({ email })
    .andWhere('role', '!=', 'admin')
    .update({ role: 'admin', role_granted_at: db.fn.now() })
  if (updated === 0) {
    console.warn(`[BOOTSTRAP-ADMIN] Aucun compte "${email}" trouvé ou déjà admin.`)
  } else {
    console.log(`[BOOTSTRAP-ADMIN] ${email} promu admin.`)
  }
  ```
- Appelée dans `index.js`, juste après `await db.migrate.latest()` (ligne 148 — garantit que la
  colonne `role` existe) et avant/aux côtés de `syncBuiltinModels()` — même séquence de démarrage,
  aucun nouveau point d'entrée créé.
- Idempotente par construction (`role != 'admin'` dans le `WHERE`) : ne re-déclenche pas
  `role_granted_at` à chaque redémarrage une fois la promotion faite une première fois.
- `role_granted_by` reste `NULL` (bootstrap = origine, personne ne l'a accordé — inchangé).
- Chaque instance définit (ou non) `ADMIN_BOOTSTRAP_EMAIL` dans son propre `.env`, jamais commité
  (cohérent avec `CLAUDE.md` §3 — `.env` propre à chaque instance). Une instance sans cette variable
  (ex. un futur clone de contribution) ne promeut personne automatiquement — comportement sûr par
  défaut, contrairement à une migration qui aurait tenté de matcher un email sur n'importe quelle
  base où elle tourne.
- À documenter dans `docs/ASBUILT.md`, même ligne de style que `REGISTRATION_CODE` (§0.9), au moment
  de coder ce lot.

**`middleware/requireAdmin.js` (nouveau, serveur)**
- Chaîné après `requireAuth`.
- Relit `role` **en base à chaque requête** — jamais depuis le JWT. Raison : le JWT ne contient
  aujourd'hui que `id/email/username` et n'est régénéré que si l'un de ces trois change
  (`routes/users.js:80-87`) ; si `role` y était ajouté, une rétrogradation resterait sans effet jusqu'à
  expiration du cookie (7 jours) ou reconnexion. Contredit directement "pouvoir rétrograder quelqu'un
  au besoin". Le coût d'une lecture DB supplémentaire par requête admin est négligeable au volume de
  ce projet.

**`routes/auth.js:145-149` (`GET /me`)** — ajoute `role` au `.select([...])`. C'est le point d'entrée
unique déjà utilisé par le client pour charger l'utilisateur courant (`App.jsx:36-37` →
`authStore`) — aucun nouveau mécanisme de chargement à créer côté client.

**`docs/VOCABULARY.md`** — nouvelle entrée "Administrateur (rôle)" avant tout code (§2 CLAUDE.md).

---

### Lot 2 — Page Admin + gate des 3 outils existants

- `requireAdmin` sur `equipment.js` : uniquement `POST /`, `PUT /:id`, `DELETE /:id` (§0.3/§2.1). Les
  3 `GET` restent `requireAuth`. Commentaire explicite dans le fichier pour figer cette distinction.
- `requireAdmin` sur `routes/health.js` (route unique, `GET /`).
- **Correction post-implémentation (Saar, 2026-08-12)** : gater seulement l'API d'`equipment.js`
  laissait `server/public/equipment-admin.html` chargeable par quiconque, sans compte, via
  `express.static` (§0.2) — la page (formulaire complet) restait visible, seule sa soumission
  échouait. Déplacé et renommé : `server/src/admin/ref-equipment-tool.html` (hors de `public/`, plus
  jamais servi statiquement), servi uniquement par `GET /api/admin/tools/equipment`
  (`routes/adminTools.js`, `requireAuth`+`requireAdmin`) — la page elle-même exige maintenant d'être
  admin pour être chargée, pas seulement pour la soumettre. Le renommage n'ajoute rien à la sécurité
  une fois la garde posée (même raisonnement qu'§0.9 sur l'identifiant admin décoratif écarté) ; c'est
  le déplacement hors de `public/` qui referme le vrai trou — le renommage évite seulement qu'un nom
  de fichier trivialement devinable traîne en clair dans les logs d'accès/le bundle.
- `AdminRoute` (client, miroir de `ProtectedRoute`, `App.jsx:18-23`) — redirige vers `/dashboard` si
  connecté mais `role !== 'admin'`. Appliqué à `/admin` (nouvelle) et `/dev/dice-calibration`
  (justification §2.2 : seule protection possible pour cet outil). `/health` en hérite par cohérence,
  même si le vrai rempart y est déjà côté serveur. Doit reproduire le garde `isLoading` de
  `ProtectedRoute` (`App.jsx:20`, `if (isLoading) return null`) **avant** de tester `role` — sinon un
  instant de `user` non encore chargé (fetch `/auth/me` async, `App.jsx:36-37`) pourrait être lu comme
  "pas admin" et rediriger à tort, ou pire, laisser passer un flash de contenu avant que le rôle réel
  soit connu si l'ordre des conditions est inversé.
- Nouvelle page `AdminPage.jsx`, route `/admin`. Grille de tuiles (réutilise la classe `.card` déjà
  centralisée dans `index.css`, même famille visuelle que les cartes de campagne du Dashboard) :
  Santé, Dice, BDD (lien direct vers `equipment-admin.html`, hors SPA), Utilisateurs (désactivée —
  Lot 3), Tickets (désactivée — hors périmètre de ce plan, §5).
- `DashboardPage.jsx` — bouton "Admin" dans le header, visible seulement si `user.role === 'admin'`,
  même pattern que `isGmAnywhere` → bouton Workshop déjà existant.

---

### Lot 3 — Outil "Gestion des utilisateurs"

**API serveur (nouveau fichier `routes/adminUsers.js`, ou extension de `routes/users.js` sous
`requireAdmin` — à trancher au moment de coder, détail d'implémentation sans impact de plan)**
- `GET /api/admin/users` (`requireAdmin`) — liste `id, username, email, role, created_at`. Jamais
  `password_hash`. Pas de pagination/recherche en V1 — `[INFÉRÉ]` volume d'utilisateurs de ce projet
  suffisamment faible pour une liste simple ; à enrichir seulement si ça devient un vrai besoin.
- `PATCH /api/admin/users/:id/role` (`requireAdmin`) — body `{ role: 'admin' | 'user' }`. Validation
  stricte de la valeur (`if (!['user','admin'].includes(role)) throw 400` — rejet explicite, jamais de
  coercition silencieuse) en plus de la contrainte DB (§3 Lot 1, défense en profondeur, pas redondance
  inutile : l'appli renvoie une erreur claire, la DB garantit l'invariant même si l'appli avait un
  bug). `404` explicite si `:id` ne correspond à aucun utilisateur. Pose `role_granted_by =
  req.user.id`, `role_granted_at = now()`. Allowlist stricte du body (`role` seul, même réflexe que
  `routes/users.js:64-68`, §0.5) — jamais de spread de `req.body`.
  **Garde dernier admin (§4.1, résolu)** : si `role: 'user'` et que la cible est actuellement `admin`,
  compter les admins restants (`SELECT COUNT(*) FROM users WHERE role='admin'`) — si le compte
  tomberait à 0, rejeter en `409` avant toute écriture. Vérifiée quel que soit l'acteur (un admin
  rétrogradant un *autre* admin est soumis à la même garde qu'une auto-rétrogradation — voir §4.1,
  précédent better-auth). `[SIMPLIFICATION DOCUMENTÉE]` la vérification (comptage) et l'écriture ne
  sont pas verrouillées ensemble par un lock multi-lignes strict — une vraie garantie contre une
  double rétrogradation strictement simultanée des deux derniers admins exigerait un verrou plus
  lourd (ex. `SELECT ... FOR UPDATE` sur toutes les lignes admin, ou isolation `SERIALIZABLE`). Écarté
  ici : ce projet a un nombre d'admins minuscule, l'action est un clic manuel confirmé (pas
  automatisée), la fenêtre de course serait de l'ordre de la milliseconde entre deux clics humains
  simultanés — coût d'implémentation disproportionné par rapport au risque réel. À revoir seulement
  si ce projet gagne un jour une vraie automatisation de gestion des rôles.
  Pas de rate-limiting dédié : contrairement à `/register` (cible = un attaquant non authentifié
  essayant de deviner un secret, `getRegisterBlockRetrySecs`), cette route exige déjà d'être admin
  pour être appelée — la barrière est l'authentification/autorisation elle-même, pas la fréquence
  d'appel.

**Client**
- Nouvelle tuile "Utilisateurs" activée sur `/admin`, ouvre un panneau/table : liste des comptes, rôle
  actuel, bouton "Promouvoir"/"Rétrograder" avec confirmation avant appel API (pas d'action en un
  clic sur un changement de privilège).

---

## 4. Points ouverts — décision de Saar requise avant de coder

0. ~~**(Lot 1, bloquant)** Valeur de `ADMIN_BOOTSTRAP_EMAIL` sur chaque instance~~ — **résolu
   (2026-08-12)** : `d.lebosse@protonmail.com` sur les deux instances (§1). Lot 1 débloqué.
1. ~~**Auto-verrouillage**~~ — **résolu (2026-08-12), recherché avant de trancher** : la garde ne porte
   pas sur "empêcher de se rétrograder soi-même" (trop étroit — un admin pourrait quand même
   rétrograder un *autre* admin et vider le système). Précédent trouvé : better-auth
   (bibliothèque d'auth Node.js réelle) a eu exactement ce bug
   ([better-auth#3651](https://github.com/better-auth/better-auth/issues/3651)) — un owner pouvait se
   rétrograder sans qu'aucun autre owner n'existe. Leur correctif, retenu ici : bloquer **toute**
   rétrogradation `admin → user` qui ferait tomber le compte total d'admins à zéro, quel que soit
   l'acteur. Voir §3 Lot 3 pour l'implémentation exacte.
2. ~~**Emplacement du fichier de routes**~~ — **résolu en codant** : `routes/adminUsers.js` séparé
   (route mince) + `services/adminUserService.js` (logique + garde dernier admin), pas une extension
   de `routes/users.js`. Choix fait par cohérence avec le pattern déjà établi ailleurs dans ce projet
   (`advantageService.js`, `inventoryService.js` — logique métier extraite en service, route en fine
   couche HTTP), plutôt que la logique inline vue dans `equipment.js` (code plus ancien, pas le
   patron à reproduire pour du nouveau code). Permet aussi un test direct de la garde dernier admin
   sans monter Express (`adminUserService.test.mjs`).

Aucun autre point ouvert identifié pour les Lots 1 et 2 à ce stade.

---

## 5. Hors périmètre (explicite)

- **Système de tickets de bug** (table `bug_reports`, formulaire joueur/MJ, vue de triage) — sujet
  d'origine de la conversation, chantier séparé, réutilisera `role`/`requireAdmin` une fois ce plan
  clos. La tuile "Tickets" existe sur `/admin` dès le Lot 2 mais reste désactivée jusqu'à ce chantier.
- **Historique des promotions/rétrogradations** — écarté explicitement par Saar (§1).
- **Bannir/suspendre un compte, modifier l'email ou le mot de passe d'un tiers depuis l'outil admin** —
  jamais demandé, non inventé.
- **Scinder `equipment.js` en fichiers lecture/administration séparés** — la cause racine identifiée en
  §2.1 est réelle mais son traitement complet (refactor de fichier) dépasse la demande initiale
  ("outils accessibles uniquement par l'admin") ; le correctif minimal (garde sur les 3 routes de
  mutation, commentaire explicite) suffit à l'invariant demandé sans réécrire un fichier qui
  fonctionne par ailleurs.
- **Recherche/pagination/filtrage sur la liste d'utilisateurs** — V1 = liste simple (§3, Lot 3).
- **Promotion automatique du premier compte inscrit** (pattern vu dans plusieurs outils self-hosted
  pour une toute première installation) — écarté : ce projet a déjà des comptes existants sur ses deux
  instances, "premier inscrit" ne désignerait pas forcément Saar ni le bon compte sur une base déjà
  peuplée. Le mécanisme par `ADMIN_BOOTSTRAP_EMAIL` (§3, Lot 1) couvre le vrai besoin sans ce risque.

---

## 6. Plan de tests (par lot, à l'exécution — rien testé à ce stade, ce document est une conception)

- **Lot 1** : test manuel sur **chaque instance concernée** (§4.0) — `ADMIN_BOOTSTRAP_EMAIL` positionné
  dans le `.env` propre à l'instance, redémarrage, vérifier le `[BOOTSTRAP-ADMIN]` promu dans les logs
  puis `role: 'admin'` dans `GET /auth/me`. Vérifier qu'un compte tiers reste `role: 'user'`. Vérifier
  qu'un second redémarrage ne re-déclenche pas (`role_granted_at` inchangé). Vérifier le
  `[BOOTSTRAP-ADMIN]` d'avertissement sur une instance sans variable définie ou avec un email absent.
- **Lot 2** : scénario réel navigateur — un compte non-admin ne voit pas le bouton "Admin" sur le
  Dashboard, un accès direct à `/admin` et `/dev/dice-calibration` redirige vers `/dashboard`, un
  appel direct (ex. `curl`/devtools) à `PUT /api/equipment/:id` avec un compte non-admin renvoie 403,
  un appel `GET /api/equipment` avec un compte non-admin fonctionne toujours (non-régression
  inventaire/marchand/drone — le point exact que l'erreur de §2.1 aurait cassé).
- **Lot 3** : promotion et rétrogradation testées en jeu réel avec un second compte ; vérifier le
  comportement choisi pour le point ouvert §4.1 une fois tranché.

---

## 7. Récapitulatif — rien n'est codé

Ce document est une conception. Le prochain message ne devrait contenir aucun fichier de code ni
migration tant que Saar n'a pas validé, lot par lot, dans l'ordre 1 → 2 → 3, avec les points ouverts
du §4 tranchés avant le Lot 3.
