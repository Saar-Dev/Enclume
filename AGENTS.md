# AGENTS.md — Contrat du projet Enclume

> Révisé 2026-09-01 — refonte « noyau mince » (ex-`CLAUDE.md` §1-§13 condensé ici + routé vers
> `.claude/rules/`). Historique et table de correspondance `§N → section` :
> `docs/Old/PLAN_CLAUDEMD_REFONTE.md`.

VTT maison (table virtuelle) pour le JDR *Polaris*. Client React 19 + Three.js
(`@react-three/fiber`), serveur Node / Express 5, PostgreSQL (Knex), MinIO, temps réel
Socket.IO, moteur monde 3D compilé. Monorepo : `client/` `server/` `shared/`. Dev solo
(Saar) sur `dev/Saar`.

Ce fichier est le contrat, pour tout agent. `CLAUDE.md` l'importe (`@AGENTS.md`) ; Claude Code
charge en plus `.claude/rules/*.md` selon leur frontmatter `paths:`. Un agent qui ne fait pas
ce routage lit lui-même chaque règle dont les `paths` couvrent un fichier touché.

## Commandes  (depuis la racine sauf mention)
- Syntaxe JS serveur/shared : `node --check <fichier.js|.mjs|.cjs>` — échoue sur `.jsx`
  (pour le JSX : lint ou build client)
- JSON de locale : `node -e "JSON.parse(require('fs').readFileSync('<fichier>','utf8'))"`
- Lint client : `cd client && npm run lint`   (ciblé : `cd client && npx eslint <fichiers>`)
- Build client : `cd client && npm run build`
- Tests purs (aucune base) : `node --test 'shared/**/*.test.mjs'`
- Test ciblé : `node --test <chemin/x.test.mjs>` — toujours un chemin explicite
- Avant livraison : `git diff --check`
- Pas de linter serveur : `node --check` est le seul contrôle statique côté serveur

## Ne pas lancer (sans demande explicite de Saar)
- Le serveur (`server/` : `npm run dev`/`start`, `nodemon`) — au démarrage il applique les
  migrations Knex en attente (`.claude/rules/migrations.md`)
- `npm test` complet — inclut `server/src/db/migrations_archive/` (échecs attendus) et des
  tests serveur dont une partie touche la base locale (`--env-file` requis)
- Client `dev`/`preview`, navigateur, `npm run test:e2e` (Playwright) — Saar teste l'UI
- `start.ps1` / `start.sh` — lancement complet de la stack

## Invariants non négociables
1. Code et données observées > mémoire > conversation. Lire les fichiers concernés et leurs
   appelants avant de diagnostiquer ou modifier. Lecture seule = hypothèse ; exécuté ou testé
   = vérifié. Un résumé de session ne remplace pas la lecture de reprise.
2. Chercher la cause racine. Jamais de rustine, de second moteur, de fallback legacy, de
   solution « temporaire » — sur tout domaine.
3. Une propriété métier ou physique = une autorité unique. Pas de logique métier dupliquée
   client / serveur. Serveur = autorité ; client = intention / prévisualisation.
4. Préserver les changements existants du worktree. Jamais `reset --hard`, `checkout --`,
   `clean` ni nettoyage destructif sans autorisation explicite.
5. Une mécanique de jeu colle au texte RAW du *Livre de Base Polaris* ; tout écart est une
   décision écrite dans `docs/JOURNAL8.md`, jamais un raccourci silencieux.
6. Français partout, y compris les descriptions d'appels d'outils.
7. Ce fichier (et `CLAUDE.md` qui l'importe) est la seule source d'instructions modifiable sur
   demande. La mémoire auto est un journal que Claude tient sur lui-même, pas un second
   exemplaire des règles.

## Méthode de travail
- Explorer → planifier → analyse à charge → coder : étapes distinctes, une par tour. Ne pas
  coder tant que le plan exact (fichiers, invariant, hors-périmètre) n'est pas présenté.
- Un plan = un seul bug ou problème. Le suivant attend la validation du précédent.
- Qualité structurelle > vitesse : le temps et la quantité de travail ne sont jamais un
  argument ; si stabiliser demande un rework, le faire.
- Chercher la doc officielle et du code pro (GitHub) avant toute mécanique non triviale ;
  ne jamais coder de zéro.
- Réutiliser un événement / service / composant / store / utilitaire existant avant d'en créer.
- « Run à vide » = réflexion libre sur le sujet en cours, sans lancer le serveur.
- Un bug non reproductible : documenter les conditions exactes avant toute analyse ; durcir le
  point de crash confirmé, tracer les hypothèses sans les coder.
- Ne pas redemander « je code ? » une deuxième fois sur le même sujet.
- Termes interdits sans preuve : « probablement », « certainement », « évidemment » →
  employer `[INCONNU]`, formuler l'hypothèse, définir l'instrumentation qui tranche.
- Marquer `[OBSERVÉ]` / `[VÉRIFIÉ]` / `[HYPOTHÈSE]` / `[INCONNU]` dans les analyses sensibles.
- **STOP** si tu te vois : diagnostiquer sans avoir lu, coder une cause `[HYPOTHÈSE]` non
  instrumentée, ou improviser une solution « temporaire » / un second moteur / un fallback.

## Autorités & routage
- Règles domaine auto-chargées depuis `.claude/rules/*.md` selon leurs `paths:` — elles ne
  remplacent jamais la lecture du fichier source concerné.
- **Moteur monde** : le `WorldSnapshot` (compilé depuis `surface_data` par `worldCompiler`) est
  l'autorité unique des supports, barrières, collision, occupation, LOS et navigation. Toute
  décision spatiale passe par les services `world*` / `movementBudgetService` — jamais une
  lecture directe de `surface_data`, Three.js ou `voxel_data`. Une apparence 3D n'implique
  jamais une collision. PostgreSQL est durable ; Redis et `voxel_data` ne sont jamais
  l'autorité spatiale. Détail : `.claude/rules/world.md`.
- **Combat** : la FSM combat orchestre le non-spatial (initiative, compétences, actions,
  dégâts, armures) ; toute décision spatiale passe par les services `world*`.
  Détail : `.claude/rules/combat.md`.
- **Migrations** : `.claude/rules/migrations.md`. Deux pièges toujours en tête : `nodemon`
  applique une migration dès l'écriture du fichier ; jamais rappeler `up()` sans avoir vérifié
  `knex_migrations`.
- Avant un nouveau concept métier : `docs/VOCABULARY.md`. Avant un nouveau document :
  `docs/RegleDocumentaire.md`. Avant de conclure qu'aucun piège connu ne couvre un sujet :
  `docs/SYSTEME/CONVENTIONS.md` §19 — index maître P/PE/PC/PI, plus complet que les `rules/`.
- Hiérarchie d'autorité : *Livre de Base Polaris* > `FOUNDATION` > `VOCABULARY` > `SYSTEME` >
  règles domaine > `MANUEL` > `PLAN`.
- `users.role === 'admin'` n'est jamais réutilisé comme raccourci d'autorisation pour un besoin
  métier plus étroit — détail `.claude/rules/core.md`.

## Git & branche
- Dev solo sur `dev/Saar`. Jamais de développement ni de push direct sur `master` (le push
  master est bloqué par le hook `.claude/hooks/guard-git-push.js`).
- Avant une nouvelle tâche : `git status --short --branch` ; `git fetch origin` ; si la branche
  a un upstream publié, avancer uniquement en `git merge --ff-only` ; si l'upstream n'existe pas
  encore, ne pas inventer de synchronisation — signaler la publication manquante. Jamais de
  `git pull` aveugle, `reset --hard`, `checkout --` ou nettoyage destructif.
- Commit : une cause racine atomique à la fois (plusieurs fichiers ensemble s'ils implémentent
  le même invariant). Format `Session N (Dev) — Titre`. Commit puis push `dev/Saar`
  seulement après confirmation fonctionnelle de Saar.

## Suivi & documentation
- Bugs et prochaine étape : `bug_tickets` (`/admin/tickets`), voir `docs/SYSTEME/TICKETS.md`.
- `docs/EN_COURS.md` : dettes pas encore migrées en ticket, chantier en cours, points de
  vigilance permanents.
- `docs/JOURNAL8.md` : décisions et validations durables. `docs/ASBUILT.md` : déployé et
  stable. `docs/ROADMAP.md` : la suite. `client/public/CHANGELOG.md` : visible utilisateurs.
- Mettre à jour la date des documents réellement modifiés. Une dette ne vit que dans un seul
  document.

## Clôture
Toute clôture indique :
- **Testé :** commandes et scénarios réellement exécutés ;
- **Non testé :** ce qui reste — si non vide, marquer `⚠️ clos partiel` ;
- **Données :** migrations, imports ou effets runtime éventuels ;
- **Retour arrière :** tag, sauvegarde ou commit applicable si le risque le justifie.

Les validations techniques automatisables s'enchaînent sans pause ; fermer un comportement
visuel ou une règle de jeu exige une validation de Saar.

Validation proportionnée au risque : typo / 1 fichier → `node --check` + tests ciblés du
module ; multi-fichiers d'un même invariant → + tests transverses du domaine ; migration /
combat / monde → + scénario réel concerné + build client.

Avant livraison : `git diff --check`, worktree propre, aucun secret. Ne pas corriger les
vulnérabilités npm avec `--force`.
