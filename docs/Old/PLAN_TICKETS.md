# PLAN_TICKETS.md — Système de tickets de bug (joueur/GM/admin → triage admin)

> **ARCHIVÉ le 2026-08-12** — Lots 1 et 2 codés, testés et confirmés par Saar en navigateur (instance
> locale), y compris l'import du contenu de `docs/Old/BUGIDENTIFIE.md` (45 tickets). Contenu durable :
> **`docs/SYSTEME/TICKETS.md`** — lire ce document pour l'état stable, celui-ci ne conserve que le
> détail de conception (analyse critique, alternatives écartées, recherche externe citée — GitHub
> Issues, FreeScout, Sentry). Compte-rendu de clôture : `docs/JOURNAL8.md`, session 2026-08-12.
> Instance distante non testée (rien poussé à la clôture) — à valider séparément lors du déploiement.

> Statut : en conception, aucun code écrit. Méthodologie `docs/METHODO_PLAN.md`.
> Chantier fondateur repris (voir `docs/JOURNAL8.md` 2026-08-12) : le rôle admin global
> (`docs/SYSTEME/ADMIN.md`) existe désormais et sert d'autorité pour ce chantier — la tuile
> "Tickets" de `/admin` (désactivée) attend ce travail.

---

## 0. Cadrage — faits vérifiés

- [VÉRIFIÉ] `docs/EN_COURS.md` ne référence aucun chantier "tickets" actif ; aucune dette ne le
  couvre. Le seul point d'ancrage existant est la tuile "Tickets" désactivée sur `/admin`
  (`client/src/pages/AdminPage.jsx`, hors périmètre de `docs/Old/PLAN_ADMIN.md` §5).
- [VÉRIFIÉ] `docs/VOCABULARY.md` ne définit ni "Ticket" ni "Cluster" comme concept produit.
  `docs/BUGIDENTIFIE.md` en revanche définit et utilise activement **"Cluster"** depuis longtemps :
  regroupement manuel de bugs/dettes par « même fichier source / même cause racine / même
  mécanique / fix A nécessite fix B » (`BUGIDENTIFIE.md:21`), avec des identifiants courts
  (Cluster A, B, C… U) réutilisés dans `EN_COURS.md` et plusieurs `JOURNAL*.md`. C'est un procédé
  **manuel, interne, orienté cause racine de code**, tenu par le développeur pendant la phase
  Analyser/Correctif de la méthode Triage→Reproduire→Analyser→Instrumenter→Corriger→Valider.
- [VÉRIFIÉ] La demande de Saar porte sur un regroupement **côté admin, sur les tickets entrants**
  (« ranger par origine, regroupable en cluster ») — donc en amont de `BUGIDENTIFIE.md`, avant même
  qu'un ticket devienne un bug analysé. C'est un regroupement de *rapports* (dédoublonnage/tri),
  pas un regroupement de *causes racines de code*. Les deux notions se ressemblent mais ne sont pas
  identiques → traité comme point ouvert §4.1 (nom à trancher pour éviter la collision de
  vocabulaire).
- [VÉRIFIÉ] Aucun point d'entrée global (header/layout commun) n'existe dans le client :
  `client/src/App.jsx` déclare des routes plates sans layout partagé ; chaque page gère son propre
  chrome. `ChangelogPanel.jsx` n'est monté que sur `DashboardPage.jsx:378`.
- [VÉRIFIÉ] `ChangelogPanel.jsx` est un rail "SYSTEM_LOG" (ouvert/fermé), thème diagnostic système
  déjà cohérent avec un lien de signalement — pas de lien "signaler un bug" existant nulle part.
- [VÉRIFIÉ] Pas de layout partagé pendant une session de jeu (combat/exploration) — `SessionPage.jsx`
  a sa propre `Sidebar`. Un point d'entrée en session est un chantier distinct, plus risqué (surface
  combat/monde), traité en hors périmètre §5.
- [VÉRIFIÉ] Convention de table "requête + revue admin" déjà éprouvée et confirmée en base réelle :
  `server/src/db/migrations/130_vault_transfer_requests.js` — `id uuid` (`gen_random_uuid()`),
  `requested_by`/`reviewed_by`/`reviewed_at` (provenance, `ON DELETE SET NULL`), `status text` +
  `CHECK` en `knex.raw`. Patron identique déjà réutilisé pour `users.role` (migration 240, ce
  chantier même). Je réutilise ce patron plutôt que d'en inventer un nouveau.
- [VÉRIFIÉ] Dernière migration présente : **240** (`240_users_role.js` + son test), tous devs
  confondus — prochain numéro disponible : **241**.
- [VÉRIFIÉ] `requireAdmin` (`server/src/middleware/requireAdmin.js`) et le patron liste+revue déjà
  codé pour `AdminUsersPage.jsx`/`adminUserService.js` sont directement réutilisables pour l'écran
  admin de ce chantier (liste + changement de statut + modale de confirmation) — même
  UI (`.card`/`.badge`, overlay modal de `VaultPage.jsx`) déjà validée par Saar en navigateur.
- [VÉRIFIÉ] Détermination du rôle contextuel "GM" : pas de fonction serveur centralisée, mais
  patron répété partout (`campaigns.js:385` entre autres) : `campaign_members.role === 'gm'` par
  ligne. Le client calcule déjà un équivalent global pour l'UI (`DashboardPage.jsx:40`,
  `campaigns.some(c => c.role === 'gm')`) — jamais fait server-side de façon autoritaire à ce jour,
  à construire pour ce chantier (l'origine d'un ticket ne peut pas être déclarée par le client).
- [VÉRIFIÉ] i18n : `client/src/i18n.js` ne charge que 5 namespaces (`translation`=`fr.json`,
  `creation`, `combat`, `charSheet`, `builder`). Le chantier admin précédent a ajouté ses clés
  directement dans `fr.json` (petit volume : ~25 clés). `.claude/rules/i18n.md` est explicite : « un
  domaine dense a son propre fichier namespace… jamais tout entassé dans `fr.json` ». Ce chantier-ci
  est plus dense (formulaire + 3 enums + liste admin + modales) → nouveau namespace `tickets.json`,
  pas un ajout à `fr.json` (voir §3.6).
- [VÉRIFIÉ] JSONB déjà utilisé dans le projet pour des données structurées non figées par schéma SQL
  (`campaign_members`/`campaigns` settings, `campaignSettingsService.js` `SETTINGS_SCHEMA`) — patron
  réutilisable pour le contexte auto-capturé du ticket (§3.1).

## 1. Décisions actées (déjà tranchées par Saar dans la demande)

1. Formulaire dédié type questionnaire (pas une simple boîte de texte dans une modale).
2. Table BDD dédiée, pas de réutilisation de `BUGIDENTIFIE.md` ou d'un système existant.
3. Champ **Origine** : `player` / `gm` / `admin` / `log` — les 3 premiers sont des rôles de compte au
   moment du signalement, le 4e (`log`) est réservé à un signalement automatique non humain (aucun
   mécanisme de ce type n'existe encore dans le projet — voir §5, hors périmètre v1, colonne prête).
4. Écran admin : liste rangée par origine, avec un mécanisme de regroupement ("cluster" au sens de
   Saar = tickets à logique identique ou proche).
5. Lien d'entrée envisagé depuis le Changelog, sous réserve de mon avis — **avis : pertinent**, voir
   §3.7 (thème "system log" cohérent, aucun meilleur point d'entrée disponible sans toucher au
   layout de session, ce qui est hors périmètre v1).

## 2. Analyse critique et recherche externe

**Recherche externe (bonnes pratiques formulaire de bug report)** — cohérente sur plusieurs sources
(Zonka, CornerCue, Bird Eats Bug, Featurebase) : un formulaire orienté utilisateur final doit rester
court (5-6 champs maximum, langage simple, pas de jargon), et tout ce que l'application peut capturer
automatiquement (environnement, page courante, métadonnées) ne doit jamais être redemandé à
l'utilisateur. Sévérité/priorité sont des champs de **triage par l'équipe**, pas des champs remplis
par le rapporteur (le rapporteur juge mal l'impact réel). C'est exactement le modèle déjà en place
dans `BUGIDENTIFIE.md` : la priorité est posée en phase 1 (Triage), jamais par la source du signalement.
→ Décision : le formulaire joueur ne comporte NI priorité NI sévérité. Ces champs sont admin-only,
posés après coup (`status`/`priority` nullable à la création).

**Recherche externe (regroupement automatique de type Sentry)** — le "fingerprinting" de Sentry
regroupe des **exceptions techniques** (stacktrace, classe d'erreur) de façon algorithmique. Nos
tickets sont des rapports en langage naturel écrits par des humains (joueurs/GM) : il n'y a pas de
stacktrace ni de signal structuré à hasher. Un algorithme de similarité texte serait un projet à part
entière (recherche NLP), disproportionné pour le volume attendu (projet à un seul GM actif). →
Décision : regroupement **manuel par l'admin**, pas algorithmique — cohérent avec la façon dont
`BUGIDENTIFIE.md` fonctionne déjà (un humain décide qu'un cluster existe).

**Cohérence architecturale (Priorité #4 CLAUDE.md — une propriété possède une autorité unique)** —
`BUGIDENTIFIE.md` reste l'autorité unique du **processus de correction** (Triage→…→Valider) une fois
qu'un signalement est reconnu comme un vrai bug à corriger. La table `bug_tickets` ne le remplace pas
et ne duplique pas sa logique : elle est la **file d'entrée** (comment un rapport arrive, est
dédupliqué/trié) qui peut, une fois triée, donner naissance à une entrée `BUGIDENTIFIE.md` (lien
faible, texte libre — voir `linked_bug_code` §3.1) ou être classée sans suite (suggestion, doublon,
non reproductible, refusé). Beaucoup de tickets ne deviendront jamais un bug `BUGIDENTIFIE.md`
(suggestions, incompréhensions, doublons) : les deux registres ont des cycles de vie différents et
ne doivent pas être fusionnés de force.

## 3. Conception

### 3.1 Schéma DB — migration `241_bug_tickets.js`

Une seule table, patron `vault_transfer_requests` (§0) :

```
bug_tickets
  id                uuid PK (gen_random_uuid())
  reporter_id       uuid NULL → users.id ON DELETE SET NULL
                    (NULL réservé à origin='log', pas de rapporteur humain)
  origin            text NOT NULL CHECK IN ('player','gm','admin','log')
                    -- calculé serveur à la création, jamais fourni par le client (voir §3.2)
  category          text NOT NULL CHECK IN ('bug','balance','suggestion','other')
  domain            text NULL
                    -- PAS de CHECK constraint : la liste des domaines de jeu (Combat, Monde,
                    -- Personnage...) évolue au fil des chantiers (docs/SYSTEME/INDEX.md) ; un CHECK
                    -- figerait une migration à chaque nouveau domaine. Liste proposée côté client
                    -- (select avec les intitulés SYSTEME/INDEX.md §3), non forcée en base.
  title             text NOT NULL
  description       text NOT NULL
  context           jsonb NULL
                    -- auto-capturé, jamais saisi : { path, campaign_id, character_id, user_agent }
  status            text NOT NULL DEFAULT 'new'
                    CHECK IN ('new','triaged','in_progress','suspended','resolved','wont_fix','duplicate')
                    -- 'suspended' ajouté dès le Lot 1 pour matcher le vocabulaire déjà utilisé par
                    -- BUGIDENTIFIE.md ("suspendu" — bug non reproductible, en attente d'occurrence,
                    -- ex. ASCENSEUR1) — évite une migration corrective au Lot 2 (fusion, §3.8).
  priority          text NULL CHECK IN ('low','medium','high','critical')
                    -- NULL tant que l'admin n'a pas trié (cohérent BUGIDENTIFIE.md phase Triage)
  cluster_label     text NULL
                    -- Texte libre, PAS de table de référence séparée (décision Saar §4.1 : "juste
                    -- organiser des filtres"). Patron directement recopié de BUGIDENTIFIE.md lui-même
                    -- (`Cluster A`, `Cluster N`…, toujours du texte libre, jamais une table) et du
                    -- modèle le plus éprouvé du domaine : GitHub Issues ne structure en dur que
                    -- l'état (open/closed) — catégorie/cluster/priorité y sont des labels texte
                    -- libres, jamais des colonnes figées avec FK.
  linked_bug_code   text NULL   -- pointeur libre vers un code BUGIDENTIFIE.md (ex. "WIZ13"), admin
                    -- (Lot 1 : lien manuel vers l'historique pré-fusion ; Lot 2 : sans objet, plus
                    -- de fichier séparé à référencer)
  admin_notes       text NULL  -- jamais exposé au rapporteur
  reviewed_by       uuid NULL → users.id ON DELETE SET NULL
  reviewed_at       timestamptz NULL
  created_at        timestamptz NOT NULL DEFAULT now()
  updated_at        timestamptz NOT NULL DEFAULT now()
```

`reviewed_by`/`reviewed_at` (qui a changé le statut, quand) est le même patron de provenance que
`vault_transfer_requests`/`users.role_granted_by` — confirmé par du code réel : FreeScout
(`app/Conversation.php`, helpdesk self-hosted PHP, ~5k★) trace ses changements de statut avec
`closed_by_user_id`/`closed_at`, exactement la même idée.

### 3.2 Calcul serveur de `origin` (jamais fourni par le client)

Dans le service de création (`ticketService.createTicket`), résolution dans cet ordre :

1. `users.role === 'admin'` → `origin = 'admin'`
2. sinon, au moins une ligne `campaign_members` avec `role = 'gm'` pour cet utilisateur → `'gm'`
3. sinon → `'player'`
4. `'log'` n'est jamais atteint par ce chemin (aucun appelant humain) — réservé à un futur appel
   interne non construit dans ce lot (§5).

Point ouvert : Saar est actuellement le seul admin ET le seul GM actif du projet → toute action de
Saar remontera `origin = 'admin'` avec cette priorité, jamais `'gm'`. Si l'intention est de tracer
"signalé pendant une partie en tant que MJ" séparément du statut de compte global, l'ordre de
priorité doit être inversé ou un second signal capturé. Détail en §4.2.

### 3.3 Serveur — routes et service

- `server/src/services/ticketService.js` : `createTicket`, `listTickets(filters)`,
  `updateTicket(actorId, id, patch)` (statut, priorité, `cluster_label`, `linked_bug_code`,
  `admin_notes` — un seul PATCH générique, pas une route par champ).
- `server/src/routes/tickets.js` :
  - `POST /api/tickets` — `requireAuth` seul (tout compte connecté peut signaler).
  - `GET /api/tickets/mine` — `requireAuth` (un joueur voit l'historique de ses propres tickets,
    pas ceux des autres — évite d'exposer des rapports d'autres joueurs).
  - `GET /api/admin/tickets`, `PATCH /api/admin/tickets/:id` — `requireAuth` + `requireAdmin`,
    montés à côté de `adminUsersRouter` dans `index.js`.

### 3.4 Client — formulaire de signalement

`client/src/pages/ReportTicketPage.jsx`, route `/tickets/new`. Champs (mirroring bonnes pratiques
§2) :
- `category` (select : Bug / Déséquilibre / Suggestion / Autre)
- `domain` (select non contraint en base, options = sections `SYSTEME/INDEX.md` §3 + "Autre")
- `title` (texte court)
- `description` (textarea)
- Auto-capturé sans champ visible : `path` (`window.location.pathname` au moment du clic
  "Signaler"), `campaign_id` (si le compte a une campagne active identifiable), `user_agent`.

Pas de champ priorité/sévérité (§2). Pas de pièce jointe/capture d'écran (§5, hors périmètre v1).

### 3.5 Client — écran admin

`client/src/pages/AdminTicketsPage.jsx`, route `/admin/tickets`, tuile "Tickets" de `AdminPage.jsx`
activée (retrait de `disabled`). Reprend le patron déjà validé de `AdminUsersPage.jsx` :
- Liste filtrable par `origin` (Joueur / MJ / Admin / Log), `status`, `domain`, et `cluster_label`
  (filtre texte — taper "Cluster N" regroupe visuellement tous les tickets qui portent ce libellé,
  exactement comme on chercherait "Cluster N" dans `BUGIDENTIFIE.md` aujourd'hui).
- Chaque ticket : titre, catégorie, domaine, badge statut, `cluster_label` affiché en badge s'il est
  posé, éditable inline (simple champ texte, pas de modale dédiée — cohérent avec la décision §4.1).
- Action changement de statut (select inline + confirmation avant `resolved`/`wont_fix`, pas avant
  `triaged`/`in_progress`/`suspended` qui sont réversibles sans conséquence).
- Pas de suppression de ticket — un ticket clos reste `status='resolved'`/`'wont_fix'`/`'duplicate'`,
  jamais supprimé (traçabilité, cohérent avec l'absence générale de suppression physique déjà
  observée ailleurs dans le projet — ex. pas d'historique supprimé pour `role_granted_by`).

### 3.6 i18n — nouveau namespace `tickets.json`

Ajout dans `client/src/i18n.js` (`import tickets from './locales/tickets.json'` +
`resources.fr.tickets`), suivant le patron déjà en place pour `combat`/`charSheet`/`builder`. Clés :
formulaire (`tickets.form.*`), enums (`tickets.category.*`, `tickets.domain.*`, `tickets.status.*`,
`tickets.priority.*`), écran admin (`tickets.admin.*`).

### 3.7 Point d'entrée — lien dans le Changelog

Avis demandé par Saar : **pertinent**. `ChangelogPanel.jsx` a déjà le thème "SYSTEM_LOG"/diagnostic
et est déjà le seul endroit du client visité par tous les comptes après connexion (ouverture
automatique sur nouvelle version, `ChangelogPanel.jsx:53`). Ajout d'un lien discret dans son footer
(§ligne 189-198 actuelle) vers `/tickets/new`, sans toucher à sa logique de parsing existante.

### 3.8 Lot 2 (chantier séparé, après validation navigateur du Lot 1) — fusion avec `BUGIDENTIFIE.md`

Non conçu en détail ici (prématuré tant que le Lot 1 n'est pas validé), mais le périmètre attendu
est esquissé pour vérifier que le schéma du Lot 1 n'aura pas besoin d'être retouché :
- Script d'import ponctuel : parcourt les ~30 entrées actives de `BUGIDENTIFIE.md`, crée une ligne
  `bug_tickets` par entrée (`origin='admin'`, `category='bug'`, `cluster_label` repris tel quel
  depuis les sections "Cluster X" existantes, `status` mappé depuis le vocabulaire actuel — "non
  close"→`triaged`, "suspendu"→`suspended`, etc.).
- CLI terminal (`server/src/scripts/ticketCli.js` ou équivalent) pour que Claude puisse
  créer/consulter/modifier des tickets pendant une session de code sans navigateur — nécessaire car
  une partie des entrées actuelles de `BUGIDENTIFIE.md` viennent d'audits de code, pas d'un
  formulaire rempli par un humain.
- La table de méthodologie (Triage→Reproduire→Analyser→Instrumenter→Corriger→Valider,
  `BUGIDENTIFIE.md:6-21`) migre vers le futur `docs/SYSTEME/TICKETS.md` (contenu durable, même
  mouvement que `PLAN_ADMIN.md` → `SYSTEME/ADMIN.md`) — ce n'est pas une donnée, elle ne va pas en
  base.
- Mise à jour de la ligne d'`EN_COURS.md` qui cite aujourd'hui `BUGIDENTIFIE.md` comme « autorité
  unique » du détail technique d'un bug.
- `docs/BUGIDENTIFIE.md` archivé (`docs/Old/`, bandeau de redirection) une fois l'import vérifié.

## 4. Décisions (arbitrées par Saar le 2026-08-12)

**4.1 Nom du regroupement → tranché : fusion complète prévue avec `BUGIDENTIFIE.md`, donc pas de
collision à éviter — le mot "Cluster" est directement réutilisé.** Intention de Saar : dès que
l'interface est opérationnelle, `docs/BUGIDENTIFIE.md` doit être **remplacé** par elle (voir §4.1bis
ci-dessous pour l'analyse à charge de cette bascule — traitée comme Lot 2, pas Lot 1). Conséquence
sur le schéma : le champ n'est plus une table de référence normalisée (`ticket_groups`, abandonné)
mais un simple **texte libre filtrable**, conforme à la fois à la demande explicite de Saar (« juste
organiser des filtres ») et au patron déjà utilisé par `BUGIDENTIFIE.md` lui-même (`Cluster A`,
`Cluster N`… — jamais une table, toujours du texte libre dans un document). C'est aussi le modèle du
précédent le plus éprouvé qui existe pour ce genre de regroupement : **GitHub Issues** ne structure
en dur que l'état (`open`/`closed`) — catégorie, cluster, priorité passent tous par des **labels
libres** (many-to-many texte), jamais des colonnes figées. Champ retenu :
`bug_tickets.cluster_label text NULL` (pas de table séparée, pas de FK) — voir schéma corrigé §3.1.

**4.1bis — Analyse à charge de la fusion avec `BUGIDENTIFIE.md` (avant d'accepter tel quel).**
Remplacer purement et simplement ce fichier pose deux problèmes concrets, pas juste théoriques :
  - **Origine des entrées.** `BUGIDENTIFIE.md` contient aujourd'hui des dettes trouvées par audit de
    code (ESLint, lecture de fichiers, tests) — pas des rapports remplis via un formulaire par un
    humain qui navigue dans l'app. Le formulaire web (§3.4) n'est pas le bon outil pour ce cas d'usage
    (Claude ne pilote pas de navigateur — mémoire actée, `feedback_no_browser_testing`). Il faut un
    point d'entrée en ligne de commande.
  - **`BUGIDENTIFIE.md` est cité comme « autorité unique » par `docs/EN_COURS.md` lui-même** (ligne
    d'en-tête : « Le détail technique d'un bug reste dans `docs/BUGIDENTIFIE.md` (autorité unique) »).
    Basculer l'autorité vers la table `bug_tickets` implique de mettre à jour cette ligne
    d'`EN_COURS.md`, pas seulement d'ajouter une fonctionnalité à côté.
  - **La méthode elle-même** (Triage→Reproduire→Analyser→Instrumenter→Corriger→Valider,
    `BUGIDENTIFIE.md:6-21`) est un texte de méthodologie, pas une donnée — elle doit survivre quelque
    part (probable candidat : `docs/SYSTEME/TICKETS.md`, le futur document durable de ce chantier,
    même mouvement que `PLAN_ADMIN.md` → `SYSTEME/ADMIN.md`), pas être perdue dans la bascule.
  → **Décision retenue : la fusion est confirmée comme objectif, mais découpée en Lot 2** (§3.8),
  après validation du Lot 1 en navigateur par Saar — pas construite en même temps que le formulaire
  et l'écran admin de base. Le schéma du Lot 1 est conçu pour l'absorber sans migration corrective
  (statut `suspended` ajouté dès maintenant §3.1, `cluster_label` en texte libre réutilisable tel
  quel avec les libellés `Cluster A`…`Cluster U` existants).

**4.2 Priorité `admin` > `gm` dans le calcul de `origin` → tranché : conservé tel quel.** Saar confirme
que l'origine sert avant tout de filtre, pas d'affirmation identitaire stricte — pas de sélecteur de
contexte supplémentaire.

**4.3 Référentiel du champ `domain` → confirmé.** Sections `SYSTEME/INDEX.md` §3.1-3.6 + "Autre".

**4.4 Pièces jointes → confirmé hors périmètre v1**, `context` JSONB absorbera une clé
`attachment_key` plus tard sans migration.

## 5. Hors périmètre (Lot 1)

- Point d'entrée depuis une session de jeu (Sidebar en combat/exploration) — layout partagé
  inexistant, chantier de refonte de layout à part, pas demandé explicitement par Saar cette fois.
- `origin = 'log'` réellement produit par un mécanisme automatique (ex. capture d'exception serveur
  non gérée) — colonne/CHECK prêts, aucun émetteur construit.
- Pièces jointes / captures d'écran (§4.4).
- Notifications (email, in-app) à la création d'un ticket ou à son changement de statut —
  `SECU-EMAIL1` (`docs/EN_COURS.md:130`) documente déjà l'absence de toute mécanique d'email sur
  l'instance actuelle ; pas de notification in-app existante à réutiliser non plus.
- **Fusion avec `BUGIDENTIFIE.md`** (import des entrées existantes, CLI terminal, retrait du
  fichier, mise à jour d'`EN_COURS.md`) — confirmée comme objectif final par Saar (§4.1bis), mais
  reportée en Lot 2 explicite (§3.8), après validation navigateur du Lot 1. `linked_bug_code` reste
  un simple pointeur texte manuel en attendant.
- Regroupement automatique/algorithmique (§2) — uniquement manuel (`cluster_label` texte libre)
  dans ce lot.

## 6. Plan de tests

- `server/src/services/ticketService.test.mjs` — création (chaque `origin` calculé correctement
  selon `users.role`/`campaign_members.role` réels insérés en base), transition de statut,
  écriture/lecture de `cluster_label`, `GET /tickets/mine` ne renvoie que les tickets du rapporteur.
- `server/src/db/migrations/241_bug_tickets.test.mjs` — `up`/`down`, contraintes `CHECK` (rejets
  attendus sur valeurs hors énumération), FK `ON DELETE SET NULL`.
- Scénario navigateur (à la charge de Saar, cf. mémoire déjà actée — pas de pilotage Playwright par
  Claude) : signalement joueur → apparition dans `/admin/tickets` → tri par origine → création d'un
  groupe → changement de statut → lien Changelog.

## 7. Récapitulatif pour Saar

Les 4 points ouverts sont tranchés (§4) : `cluster_label` texte libre (pas de table), origine
inchangée, domaine = sections `SYSTEME/INDEX.md`, pièces jointes hors périmètre. Fusion avec
`BUGIDENTIFIE.md` confirmée comme objectif mais découpée en Lot 2 explicite (§3.8), après validation
navigateur du Lot 1 — le schéma du Lot 1 est déjà prêt à l'absorber (`suspended`, `cluster_label`,
`linked_bug_code`). Prêt à coder le Lot 1 dès confirmation.
