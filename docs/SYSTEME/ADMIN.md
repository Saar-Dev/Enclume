Documentation exhaustive de l'existant

    Version 1.0 — 2026-08-12. Contenu durable transféré depuis `docs/PLANS/PLAN_ADMIN.md`
    (Règle 10 — un PLAN est temporaire) une fois les 3 lots codés et testés en conditions réelles
    (base locale). Le PLAN garde le détail de conception (analyse critique, alternatives écartées,
    recherche externe) ; ce document garde l'état stable pour un futur lecteur/agent.

1. Vue d'ensemble

Un rôle administrateur **global** (`users.role`, `'user'` | `'admin'`) donne accès à un ensemble
d'outils d'exploitation/maintenance regroupés sous `/admin` : santé serveur, calibration des dés,
édition directe du catalogue d'équipement, gestion des comptes (promouvoir/rétrograder). Distinct de
`campaign_members.role` (`gm`/`player`), qui reste un rôle **par campagne** et ne dit rien du statut
global d'un compte.

Propriétés fondamentales

    Un seul flag global (`users.role`), pas de table de permissions séparée — volontairement
    minimal, pas de RBAC multi-rôles construit par anticipation (voir PLAN_ADMIN.md §2 pour
    l'analyse des alternatives écartées).

    Aucun historique des promotions/rétrogradations passées — état courant seulement, avec
    provenance du dernier changement (`role_granted_by`/`role_granted_at`, même patron que
    « Provenance des octrois », `docs/VOCABULARY.md`).

    `role` n'entre jamais dans le JWT — toujours relu en base à chaque requête admin
    (`requireAdmin`), pour qu'une rétrogradation soit immédiate et non différée jusqu'à expiration
    du cookie (7 jours).

    Bootstrap par variable d'environnement (`ADMIN_BOOTSTRAP_EMAIL`), pas par migration — une
    migration est un fichier identique déployé sur toutes les instances, inadapté à une valeur
    (l'email à promouvoir) qui diffère par instance (local/distant n'ont pas les mêmes comptes).

    La base impose l'invariant indépendamment de la couche applicative : `CHECK (role IN ('user',
    'admin'))` sur `users.role`.

2. Architecture
```
┌───────────────────────────────────────────────────────────────────────────┐
│                              SIDE SERVEUR                                  │
│                                                                             │
│  server/src/db/migrations/240_users_role.js                               │
│    Colonnes role/role_granted_by/role_granted_at + contrainte CHECK        │
│                                                                             │
│  server/src/lib/bootstrapAdmin.js                                         │
│    bootstrapAdminFromEnv() — appelée dans index.js juste après             │
│    db.migrate.latest(), avant syncBuiltinModels(). Lit                     │
│    process.env.ADMIN_BOOTSTRAP_EMAIL, promeut si trouvé et pas déjà admin, │
│    silencieuse si variable absente, warn si email introuvable.             │
│                                                                             │
│  server/src/middleware/requireAdmin.js                                    │
│    Chaîné après requireAuth. Relit role en base à CHAQUE requête (jamais   │
│    le JWT). Fail-closed : égalité stricte à 'admin'.                       │
│                                                                             │
│  server/src/services/adminUserService.js                                  │
│    listUsers() — jamais password_hash.                                    │
│    changeUserRole(actorId, targetId, newRole) — garde dernier admin :      │
│    bloque (409) toute rétrogradation qui ferait tomber le compte total     │
│    d'admins à zéro, quel que soit l'acteur (précédent better-auth#3651).   │
│                                                                             │
│  server/src/routes/adminUsers.js        GET /api/admin/users              │
│                                          PATCH /api/admin/users/:id/role   │
│  server/src/routes/adminTools.js        GET /api/admin/tools/equipment    │
│    Sert server/src/admin/ref-equipment-tool.html (déplacé hors de         │
│    server/public/ — anciennement servi par express.static SANS AUCUNE     │
│    garde, même le chargement de la page était public). Le fichier ne      │
│    contient que du JS inline, ses fetch() ciblent des chemins absolus     │
│    (/api/equipment/...), donc insensible à son URL de service.            │
│                                                                             │
│  server/src/routes/equipment.js                                           │
│    GET / , GET /:id , GET /ref/skills  → requireAuth SEUL (gameplay :      │
│    InventoryPanel, MerchantsPage, DroneWindow — NE JAMAIS gater ces GET)   │
│    POST / , PUT /:id , DELETE /:id     → requireAuth + requireAdmin        │
│                                                                             │
│  server/src/routes/health.js            GET /api/health/detailed          │
│    → requireAuth + requireAdmin (différent de GET /api/health, liveness   │
│    public sans donnée sensible, jamais gaté)                              │
│                                                                             │
│  server/src/routes/auth.js              GET /me — inclut role au select   │
└───────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────┐
│                              SIDE CLIENT                                   │
│                                                                             │
│  App.jsx                                                                   │
│    AdminRoute — redirige vers /dashboard si role !== 'admin'. Seule        │
│    protection possible pour /dev/dice-calibration (aucune route serveur   │
│    à gater — outil 100% client). Réel rempart pour /health (le serveur    │
│    gate déjà) — cohérence de traitement, pas redondance nécessaire.       │
│    Routes : /admin, /admin/users, /health, /dev/dice-calibration          │
│                                                                             │
│  pages/AdminPage.jsx            Grille de tuiles (Santé, Dice, BDD lien   │
│                                  direct hors SPA, Utilisateurs, Tickets   │
│                                  désactivée — hors périmètre actuel)      │
│  pages/AdminUsersPage.jsx       Liste + confirmation avant tout           │
│                                  changement de rôle (jamais un clic seul) │
│  pages/DashboardPage.jsx        Bouton "Administration" dans le header,   │
│                                  visible seulement si user.role==='admin' │
└───────────────────────────────────────────────────────────────────────────┘
```

3. Invariants à ne jamais casser

    `role` n'entre jamais dans le payload JWT (`middleware/auth.js`, `routes/users.js`
    ré-signature du cookie) — seule une lecture DB fraîche fait foi.

    `requireAdmin` fail-closed : égalité stricte `role === 'admin'`, jamais `role !== 'user'`. Un
    compte introuvable ou un rôle inattendu est toujours refusé, jamais traité comme admin.

    `equipment.js` : les 3 routes `GET` restent `requireAuth` seul — gameplay normal (inventaire,
    marchands, drones). Seules les 3 routes de mutation passent sous `requireAdmin`.

    `GET /api/admin/users` (et toute route qui expose un utilisateur) exclut toujours
    `password_hash`.

    La garde dernier admin (`adminUserService.changeUserRole`) compte les admins **sans regarder
    qui demande** — formulation générale de l'invariant "il doit toujours rester au moins un
    admin", pas un cas particulier "auto-rétrogradation" (voir le fichier pour le raisonnement
    complet sur la portée réelle de cette généralisation).

    Aucun secret dans les logs (`[BOOTSTRAP-ADMIN]`, erreurs `requireAdmin`) — email/id
    uniquement.

4. Simplifications documentées (délibérées, pas des raccourcis silencieux)

    Pas de verrou multi-lignes strict sur la garde dernier admin (pas de `SELECT ... FOR UPDATE`
    sur toutes les lignes admin, pas d'isolation `SERIALIZABLE`) — accepté vu le nombre d'admins de
    ce projet et le fait que l'action est un clic manuel confirmé, pas une automatisation. À revoir
    si ce projet gagne un jour une vraie automatisation de gestion des rôles.

    Pas d'historique des promotions/rétrogradations — décision produit (Saar), pas une contrainte
    technique. `role_granted_by`/`role_granted_at` ne portent que le dernier changement.

    `equipment.js` mélange toujours lecture gameplay et administration dans un seul fichier — la
    cause racine (deux responsabilités, un fichier) est documentée mais pas traitée par un refactor
    de fichier, jugé hors périmètre de l'invariant demandé ("outils accessibles uniquement par
    l'admin").

5. Hors périmètre actuel

    Système de tickets de bug (table dédiée, formulaire joueur/MJ, vue de triage) — réutilisera
    cette fondation (`role`/`requireAdmin`) une fois construit, chantier séparé. La tuile existe
    sur `/admin`, désactivée.

    MFA/2FA sur les comptes admin — écarté d'un renommage/identifiant décoratif au profit du
    rate-limiting déjà en place (`server/src/lib/authRateLimit.js`) ; MFA resterait la vraie piste
    professionnelle si un durcissement supplémentaire était souhaité un jour.

Documents associés : `docs/PLANS/PLAN_ADMIN.md` (conception, analyse critique, alternatives
écartées, recherche externe citée) ; `docs/VOCABULARY.md` (« Administrateur (rôle) ») ;
`docs/ASBUILT.md` (ligne `ADMIN_BOOTSTRAP_EMAIL`, arborescence `server/src/admin/`).
