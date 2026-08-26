Documentation exhaustive de l'existant

    Audit de compréhension approfondie 2026-08-26 : schéma `bug_tickets` (`4_bug_tickets.js`) et
    routes `POST /api/tickets`/`GET /api/tickets/mine` confirmés colonne par colonne / route par
    route contre le code. Aucune correction nécessaire au-delà de la migration déjà réparée en §2.
    Version 1.0 — 2026-08-12. Contenu durable transféré depuis `docs/PLANS/PLAN_TICKETS.md` (Règle
    10 — un PLAN est temporaire) une fois les Lots 1 et 2 codés, testés et confirmés par Saar en
    navigateur (locaux). La méthodologie de triage (§6) est reprise telle quelle de l'ancien
    `docs/BUGIDENTIFIE.md`, archivé (`docs/Old/`) une fois son contenu importé en base (Lot 2).

1. Vue d'ensemble

Système de signalement et de triage : tout compte authentifié (joueur, MJ, admin) peut signaler un
bug, un déséquilibre de règle ou une suggestion via un formulaire dédié (`/tickets/new`). Les
signalements sont centralisés dans `bug_tickets` et triés par un admin sur `/admin/tickets`. Ce
système est l'autorité unique du suivi de bug depuis la fusion avec `docs/BUGIDENTIFIE.md` (archivé)
— seules les dettes non encore migrées restent dans `docs/EN_COURS.md`.

Propriétés fondamentales

    `origin` (joueur/MJ/admin/log) est calculé côté serveur à la création — jamais fourni par le
    client. Un joueur ne peut pas se déclarer admin. Ordre de priorité : admin > MJ (membre d'au
    moins une campagne en rôle `gm`) > joueur. `log` est réservé à un futur signalement automatique
    non humain (aucun émetteur construit à ce jour).

    `cluster_label` est un champ texte libre, pas une table de référence — décision explicite (« juste
    organiser des filtres »), cohérente avec le fonctionnement historique de `BUGIDENTIFIE.md`
    (« Cluster A »… jamais une table) et avec le modèle le plus éprouvé du domaine : GitHub Issues ne
    structure en dur que l'état (open/closed), tout le reste passe par des labels texte libres.

    Priorité et sévérité ne sont jamais saisies par le rapporteur — posées par l'admin au triage
    (bonnes pratiques externes + patron déjà en place dans l'ancien `BUGIDENTIFIE.md` : la priorité
    se décide en phase Triage, pas à la source du signalement).

    Un ticket clos n'est jamais supprimé (`status='resolved'`/`'wont_fix'`/`'duplicate'`) —
    traçabilité, même philosophie que l'absence d'historique de suppression ailleurs dans le projet.

2. Architecture
```
┌───────────────────────────────────────────────────────────────────────────┐
│                              SIDE SERVEUR                                  │
│                                                                             │
│  server/src/db/migrations/4_bug_tickets.js (+ 101_..._constraints.js,      │
│    198_..._foreign_keys.js, 310_..._seed.js) — corrigé 2026-08-26, pas     │
│    "241_bug_tickets.js" (réattribué à game_echeances_foreign_keys.js)      │
│    Table bug_tickets — id, reporter_id, origin, category, domain, title,   │
│    description, context (jsonb), status, priority, cluster_label,          │
│    linked_bug_code, admin_notes, reviewed_by/reviewed_at, created/updated. │
│    4 contraintes CHECK (origin, category, status, priority).               │
│                                                                             │
│  server/src/services/ticketService.js                                     │
│    createTicket(reporterId, payload) — calcule origin, valide category.    │
│    listTicketsForReporter(reporterId) — historique perso (GET /mine).      │
│    listTickets(filters) — vue admin, jointure reporter_username.           │
│    updateTicket(actorId, id, patch) — statut/priorité/cluster/notes, pose  │
│    reviewed_by/reviewed_at (patron `vault_transfer_requests`, confirmé par │
│    du code réel : FreeScout closed_by_user_id/closed_at).                  │
│                                                                             │
│  server/src/routes/tickets.js           POST /api/tickets   (requireAuth)  │
│                                          GET /api/tickets/mine             │
│  server/src/routes/adminTickets.js      GET/PATCH /api/admin/tickets      │
│                                          (requireAuth + requireAdmin)      │
│                                                                             │
│  server/src/scripts/importBugIdentifie.js                                 │
│    Script à usage unique (déjà exécuté) — a importé les ~45 entrées        │
│    actives de l'ancien BUGIDENTIFIE.md. Conservé pour traçabilité, pas     │
│    destiné à être relancé (idempotent via linked_bug_code si besoin).      │
└───────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────┐
│                              SIDE CLIENT                                   │
│                                                                             │
│  pages/ReportTicketPage.jsx      /tickets/new (ProtectedRoute) — formulaire│
│                                   minimal : catégorie, domaine (optionnel), │
│                                   titre, description. Contexte auto-capturé│
│                                   (path, user_agent), jamais demandé.       │
│  pages/AdminTicketsPage.jsx      /admin/tickets (AdminRoute) — liste       │
│                                   groupée par origine, filtres (origin/     │
│                                   status/cluster texte), édition inline du │
│                                   statut/priorité/cluster_label.            │
│  components/ChangelogPanel.jsx   Lien "Signaler un problème" dans le       │
│                                   footer — seul point d'entrée v1.         │
│  locales/tickets.json            Namespace i18n dédié (formulaire+enums+   │
│                                   écran admin), enregistré dans i18n.js.   │
└───────────────────────────────────────────────────────────────────────────┘
```

3. Invariants à ne jamais casser

    `origin` n'est jamais lu depuis le corps de la requête client — toujours recalculé serveur
    (`ticketService.createTicket`) à partir de `users.role`/`campaign_members.role`.

    `priority`/`severity` ne sont jamais des champs du formulaire joueur (`ReportTicketPage.jsx`) —
    seul l'écran admin les pose.

    `GET /api/tickets/mine` ne renvoie jamais les tickets d'un autre rapporteur.

    `cluster_label` reste un champ texte libre — ne pas le remplacer par une table de référence sans
    revalider la décision (voir §1 et `docs/Old/PLAN_TICKETS.md` §4.1 pour l'analyse complète).

    Un ticket n'est jamais supprimé physiquement — seulement fait transiter vers un statut clos.

4. Méthodologie de triage (reprise de l'ancien `BUGIDENTIFIE.md`)

Le workflow manuel Triage → Reproduire → Analyser → Instrumenter → Corriger → Valider reste la
référence pour transformer un ticket en correctif, indépendamment du fait que le registre soit
maintenant en base plutôt qu'en markdown :

| Phase | Action | Règle critique |
|---|---|---|
| **1. Triage** (batch) | Sur `/admin/tickets` : poser statut/priorité/`cluster_label` | Ne pas coder à cette étape |
| **2. Reproduire** | Reproduire le bug de façon fiable et répétable. Documenter les conditions exactes | **Sans reproduction confirmée, aucune analyse n'est valide** |
| **3. Analyser** (par cluster) | Lire les fichiers → formuler une hypothèse — "5 Pourquoi" → effets de bord possibles | Résultat = `[HYPOTHÈSE]` uniquement |
| **4. Instrumenter** | Énoncer la prédiction, ajouter un log `[DBG-...]`, reproduire, observer → `[HYPOTHÈSE] → [VÉRIFIÉ]` | Toujours obligatoire |
| **5. Correctif** (par cluster) | 1 commit par cause racine | Ne jamais mixer deux clusters |
| **6. Validation** | Test fonctionnel → zones adjacentes → passer le ticket à `resolved` | Fermeture sans test fonctionnel → interdit |

**Définition cluster** (`cluster_label`) : même fichier source / même cause racine / même mécanique /
un correctif nécessite l'autre.

5. Simplifications documentées (délibérées, pas des raccourcis silencieux)

    Regroupement (`cluster_label`) manuel, jamais algorithmique — un signalement joueur est un texte
    libre en langage naturel, sans stacktrace ni signal structuré à exploiter (contrairement au
    fingerprinting Sentry, qui regroupe des exceptions techniques, pas des rapports humains).

    Pas de pièces jointes/captures d'écran en v1 — `context` (jsonb) pourra accueillir une clé
    `attachment_key` plus tard sans migration si le besoin se confirme.

    Pas de notification (email/in-app) à la création ou au changement de statut d'un ticket —
    `SECU-EMAIL1` (`docs/EN_COURS.md`) documente déjà l'absence de toute mécanique d'email sur
    l'instance actuelle.

    Le domaine (`domain`) n'est pas contraint en base (pas de CHECK) — la liste des domaines de jeu
    évolue au fil des chantiers ; un CHECK figerait une migration à chaque nouveau domaine. La liste
    proposée côté client suit les sections de `docs/SYSTEME/INDEX.md` §3.

6. Import initial (Lot 2, 2026-08-12)

`server/src/scripts/importBugIdentifie.js` a transcrit manuellement le contenu de l'ancien
`BUGIDENTIFIE.md` (sections "Clusters actifs"/"Détail des bugs" + table BETA, hors deux entrées que
le fichier déclarait lui-même résolues) — 45 tickets créés, `origin='admin'`, `linked_bug_code` posé
à l'identifiant d'origine pour traçabilité. Deux divergences trouvées entre `EN_COURS.md` et
`BUGIDENTIFIE.md` pendant la transcription (cluster de UI2/UI3, CS4/CS5/COM20/COM21 absents du
registre `BUGIDENTIFIE.md`) sont documentées dans les `admin_notes` des tickets concernés et dans le
script lui-même — pas corrigées silencieusement.

7. Hors périmètre actuel

    Point d'entrée de signalement depuis une session de jeu (Sidebar en combat/exploration) — aucun
    layout partagé pendant une session, chantier de refonte à part.

    `origin='log'` réellement produit par un mécanisme automatique (capture d'exception serveur) —
    colonne/CHECK prêts, aucun émetteur construit.

    CLI terminal pour créer/consulter des tickets sans navigateur — utile pour un futur signalement
    « trouvé en auditant le code » sans repasser par un script à usage unique à chaque fois, pas
    construit à ce jour (le script d'import a suffi pour la bascule initiale).

Documents associés : `docs/Old/PLAN_TICKETS.md` (conception, analyse critique, recherche externe
citée — GitHub Issues, FreeScout) ; `docs/Old/BUGIDENTIFIE.md` (registre pré-fusion, archivé) ;
`docs/VOCABULARY.md` (« Ticket », « Cluster ») ; `docs/SYSTEME/ADMIN.md` (rôle admin, base de ce
chantier).
