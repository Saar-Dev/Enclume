# PLAN — Refonte du corpus d'instructions (CLAUDE.md + .claude/rules/ + enforcement)

> Créé 2026-09-01. Chantier de maintenance méta, pas une fonctionnalité.
> Responsabilité unique de ce document : **conduire la refonte du corpus d'instructions**
> (`CLAUDE.md`, `.claude/rules/*.md`, hooks/`settings`) — inventaire des défauts, décisions
> à prendre, travail segmenté en lots indépendants.
> **CHANTIER CLOS — 2026-09-01.** Tous les lots exécutés. Livré en un commit unique sur
> `dev/Saar`. Ce document est conservé comme **référence de la refonte** (§7 = table de
> correspondance `ancien CLAUDE.md §N → section AGENTS.md`, citée par `AGENTS.md` et par les
> annotations `§N` laissées dans le code et les plans).

---

## État courant — 2026-09-01 (CLOS)

> Ce plan a sédimenté (3 couches : §3 pré-conception, §7 conception « noyau mince », §8 analyse
> à charge). **Font foi : §7 (conception) + §8 (ajustements) + cet encadré.** §3 = archive.
> Nettoyage complet du plan au Lot 6.

**Décisions prises** : D1 `bug_tickets` = suivi bug + prochaine étape · D2 = seulement hook push
master · D3 supprimer `conventions.md` · D4 §13 → 1 ligne STOP · D5 mono-agent · D6 **noyau mince**
(`CLAUDE.md` cible 75-95 l.) · D7 **(B)** `AGENTS.md` = noyau, `CLAUDE.md` = `@AGENTS.md`.

**Lots faits (worktree, non committés — 1 seul commit au Lot 6)** :
- ✅ **Lot 1** — `CLAUDE.md` §10/§12 + `conventions.md:18` : `JOURNAL6`→`JOURNAL8`, suivi → `bug_tickets`.
- ✅ **Lot 2** — hook `guard-git-push` + `settings.json` `hooks` + `allow` git resserré.
- ✅ **Lot 3** — `rules/migrations.md` (NEW) + `react.md` +1 + `core.md` +1 (pointeur i18n).
- ✅ **Lot 3.1** — correctifs de l'analyse critique : `core.md` i18n = pointeur pur ; test hook
  versionné ; décomptes du plan corrigés ; cet encadré.
- ✅ **Lot 7** — inventaire des commandes : bloc « ## Commandes / ## Ne pas lancer » validé
  (voir §7 « Lots révisés » ; à insérer dans `AGENTS.md` au Lot 4). Aucun fichier touché.
- ✅ **Lot 9** — `git rm --cached .claude/settings.local.json` + `.gitignore` ; `deny:
  [AskUserQuestion]` remonté dans `settings.json` ; 3 entrées `allow` à credentials purgées de
  `settings.json`. 0 JWT dans les fichiers suivis.
- ✅ **Lot 4** — `AGENTS.md` réécrit = le noyau ; `CLAUDE.md` = stub `@AGENTS.md` ;
  `conventions.md` supprimé (`git rm`) ; `README_INSTALLATION.md` mis à jour.
  **Import `@AGENTS.md` VÉRIFIÉ** via `/context` 2026-09-01 : `AGENTS.md` (3.5k tk) + `CLAUDE.md`
  (0.1k tk) sous *Memory files* ; empreinte always-on ~5-6k → ~3.6k tokens ; 0 `rules/` toujours
  chargé (`conventions.md` `**/*` supprimé).
- ✅ **Lot 4.1** — 3 instructions perdues au rewrite réinjectées (`AGENTS.md` §Git « upstream
  absent → signaler » + §Méthode « bug non-repro → documenter d'abord » ; `migrations.md`
  « migration+test+réparation = 1 commit ») ; `npm test` « écrivent dans la base » → « dont une
  partie touche la base (`--env-file`) » (défaut [INFÉRÉ]). **+ 3 arbitrages d'expert :**
  - **D-noyau : 125 l. ACCEPTÉ** (Anthropic < 200 ; auto-mémoire déjà plus grosse ; chaque ligne
    passe le test « son retrait cause-t-il une erreur ? »). Trim pour atteindre 95 = phrases à
    rallonge ou reroutage d'invariants cross-cutting → **dégraderait** le doc. Fait : retrait du
    commentaire HTML de correspondance, fusion de 2 lignes, dédup `git diff --check`.
  - **D-README : `README_INSTALLATION.md` archivé** → `docs/Old/` + bandeau (paquet installé,
    collab Codex finie ; le contrat vit dans `AGENTS.md`). Aucune réf active.
  - **D-comment HTML : retiré** du noyau (strip incertain quand importé ; la table de
    correspondance complète est ici §7, ce plan étant archivé au Lot 6).
- ✅ **Lot 8** — sweep **ciblé** (pas exhaustif) : grep révèle ~65 refs `CLAUDE.md §N` sur ~30
  fichiers — ~25 commentaires de code + ~40 citations de plans + entrées `JOURNAL8` = annotations
  datées, **laissées** (sens récupérable via §7 de ce plan une fois archivé ; churner 30 fichiers
  dont du code prod = anti-aggradation). **7 édits ciblés** sur les en-têtes / instructions
  vivants : `JOURNAL8.md` en-tête, `EN_COURS.md` (×2), `SYSTEME/INDEX.md:24` (hiérarchie live),
  `METHODO_PLAN.md` (×2), `PLAN_LOCALISATION.md:221` (`conventions.md` → `RegleDocumentaire.md`
  Règle 2, mislabel). **Écarté : `JOURNALTEMP.md` / `JOURNALANALYSE.md`** — scratch d'autres
  chantiers (`project_parallel_sessions`), on n'y touche pas. `git grep conventions.md` hors
  Old → **0**.
  - Note Lot 6 : `METHODO_PLAN.md` était en CRLF (contraire à `.gitattributes eol=lf`) → le
    commit le normalisera en LF (diff whole-file attendu, c'est une correction).
- ✅ **Lot 6** — vérification finale conjointe (`git diff --check` OK, 15/15 fichiers référencés
  par `AGENTS.md` présents, hook 23/23, sanity greps `JOURNAL6`/`conventions.md`/ports = 0) ;
  date `Révisé 2026-09-01` ajoutée à `AGENTS.md` ; ce plan archivé `docs/Old/` ; **commit unique**
  sur `dev/Saar` ; entrée `docs/JOURNAL8.md`.

**CHANTIER TERMINÉ.**
(écrire `AGENTS.md` = noyau + `CLAUDE.md` = `@AGENTS.md` + suppr. `conventions.md` + §13→1 ligne
+ invariants cross-cutting F4 + maj `README_INSTALLATION.md`) → Lot 8 (sweep refs `§N`) → Lot 6
(vérif chargement `/context` + `/doctor` + commit unique + `JOURNAL8` + archivage).

**Cadence** : run à vide → analyse à charge → code = **tours distincts** (rappel analyse critique #2).

---

## 0. Cadre

### Origine
Analyse à charge du corpus d'instructions demandée le 2026-09-01, croisée avec la
documentation Anthropic à jour.

### Sources vérifiées
- [VÉRIFIÉ] `CLAUDE.md` (223 lignes), lu intégralement en session.
- [VÉRIFIÉ] `.claude/rules/*.md` — 11 fichiers, frontmatter + contenu de `conventions.md`.
- [VÉRIFIÉ] `.claude/settings.json` et `.claude/settings.local.json`.
- [VÉRIFIÉ] Absence de `.claude/hooks/`.
- [VÉRIFIÉ] Doc Anthropic : <https://code.claude.com/docs/en/best-practices>
  (section « Write an effective CLAUDE.md ») et <https://code.claude.com/docs/en/memory>
  (sections « Write effective instructions », « CLAUDE.md vs auto memory »,
  « Manage CLAUDE.md for large teams »).
- [VÉRIFIÉ] `docs/METHODO_PLAN.md`, `docs/RegleDocumentaire.md`.

### Citations Anthropic servant de critères
1. « target **under 200 lines** per CLAUDE.md file. Longer files consume more context and
   reduce adherence. »
2. « For each line, ask: *Would removing this cause Claude to make mistakes?* If not, cut it.
   **Bloated CLAUDE.md files cause Claude to ignore your actual instructions!** »
3. « If you emphasize many lines, **none of them stands out**. »
4. « Look for **conflicting instructions**… Claude may pick one arbitrarily. »
5. « **Hooks are deterministic** … Unlike CLAUDE.md instructions which are advisory. »
   / « Settings rules are enforced by the client regardless of what Claude decides. »
6. « write instructions that are **concrete enough to verify** » (ex. « Use 2-space
   indentation » et non « Format code properly »).
7. Auto-mémoire : « It also **skips anything your CLAUDE.md files already say**. »
8. Commentaires HTML de bloc dans `CLAUDE.md` : « **stripped before the content is injected**
   into Claude's context. Use them to leave notes for human maintainers. »

### Recherche externe — 2026-09-01 (Phase 3 METHODO_PLAN)

Sources consultées (au-delà de la doc Claude Code déjà citée) :
- [VÉRIFIÉ] HumanLayer, *Writing a good CLAUDE.md* — <https://www.humanlayer.dev/blog/writing-a-good-claude-md>
- [VÉRIFIÉ] Anthropic, *Effective context engineering for AI agents* —
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- [VÉRIFIÉ] Anthropic blog, *Using CLAUDE.md files* — <https://claude.com/blog/using-claude-md-files>
- [VÉRIFIÉ] `AGENTS.md` (spec ouverte, Linux Foundation depuis déc. 2025) — <https://agents.md/>
- [VÉRIFIÉ] CLAUDE.md exemplaire HumanLayer (repo `humanlayer/humanlayer`) — ~250 lignes racine,
  mais leur *règle interne* est « root file < 60 lignes », le reste en `agent_docs/` référencés.

Principes retenus (convergents entre sources) :

1. **Budget d'instructions — le mode d'échec est uniforme.** HumanLayer : « as you give the LLM
   more instructions, it doesn't simply ignore the newer instructions — **it begins to ignore
   all of them uniformly** ». Les modèles frontière suivent « ~150-200 instructions avec une
   cohérence raisonnable », et le *system prompt* de Claude Code en contient déjà ~50. →
   argument central de toute la refonte : le corpus Enclume (CLAUDE.md 223 l. + `conventions.md`
   toujours chargé + `core.md`/`react.md`/`i18n.md` quasi toujours) est vraisemblablement
   **au-delà du seuil de dégradation uniforme**.
2. **Divulgation progressive = déjà le bon mécanisme.** HumanLayer recommande un dossier de docs
   auto-descriptives référencées, « laisser Claude décider lesquelles sont pertinentes ». C'est
   exactement `.claude/rules/*` + `paths:` — Enclume le fait déjà bien. **Corollaire pour le Lot 3 :
   ne pas seulement *supprimer* du contenu de `CLAUDE.md`, mais le *descendre* dans une règle
   routée** quand il ne concerne qu'un domaine.
3. **« Bonne altitude »** (Anthropic context engineering) : ni logique sur-spécifiée et rigide,
   ni consigne vague — « spécifique assez pour guider, souple assez pour donner de fortes
   heuristiques ». Nuance le défaut M : « validation proportionnée au risque » est une
   heuristique de bonne altitude **légitime** ; le défaut réel est qu'elle est répétée 3× et
   **jamais accompagnée d'un seul exemple canonique** qui l'ancre.
4. **Exemples canoniques** plutôt qu'énumération de cas limites (Anthropic) → refonte du Lot 5.
5. **Faire respecter par des outils déterministes**, pas par la prose : linters, `Stop` hooks,
   slash commands (HumanLayer + Anthropic). Confirme la direction D2.
6. **Chaque ligne rédigée à la main** — « the file affects every single phase » ; itérer sur les
   points de friction réels, ne jamais auto-générer.
7. **Structure pro standard** (AGENTS.md / Anthropic blog) : description 1 ligne → stack →
   **commandes exactes build/test/lint/run** → architecture (3-5 dossiers). Enclume inverse la
   pyramide : ~200 l. de méta-process, **0 commande pratique**. → défaut O.
8. **`AGENTS.md`** : standard inter-agents (60k+ dépôts, 20+ outils). Claude Code lit `CLAUDE.md`,
   pas `AGENTS.md`, mais sait l'importer (`@AGENTS.md`) ou suivre un symlink. Non pertinent tant
   qu'Enclume est mono-agent (D5) ; à garder en réserve si un autre agent revient.

### Hors-scope
- Le contenu métier des règles (`combat.md`, `world.md`, `blessures.md`… — leurs invariants
  eux-mêmes ne sont pas remis en cause ici).
- Le nettoyage de la liste `allow` de `settings.json` (géante, chantier séparé).
- La refonte documentaire globale (`RegleDocumentaire.md`, arborescence `docs/`).
- Le contenu de la mémoire auto, **sauf** la déduplication avec `CLAUDE.md` §13.

---

## 1. Décisions requises de Saar (prose — pas de questionnaire)

### Décisions prises — 2026-09-01 (Saar valide les recommandations)

- **D1 → `bug_tickets` (écran `/admin/tickets`) = autorité du suivi de bug et de la
  prochaine étape.** `EN_COURS.md` conserve : dettes pas encore migrées, chantier en cours,
  points de vigilance permanents (bugs = ligne de suivi courte seulement). Roadmap →
  `docs/ROADMAP.md`. Formulation **non exclusive** dans `CLAUDE.md` (pas « source unique »).
  Source de vérité de cette répartition : en-tête de `docs/EN_COURS.md` + `docs/SYSTEME/TICKETS.md` §1
  — déjà alignés ; seuls `CLAUDE.md` §10/§12 et `conventions.md:18` sont en retard.
- **D2 → uniquement (a)** : `deny` push vers `master` + resserrage du `allow` `git push *`.
  (b) `Stop` hook Testé/Non testé : **abandonné** (casserait les tours d'analyse/plan,
  outrepassé après 8 blocages). (c) `PreToolUse` tests `server/` : **abandonné** (vraie
  suite de tests sous `server/`, cf. `EN_COURS` P56). (b) et (c) restent en garde écrite.
- **D3 → Option B** : supprimer `conventions.md` (Lot 4), remonter la seule ligne unique
  (taxonomie `[OBSERVÉ]/[VÉRIFIÉ]/[HYPOTHÈSE]/[INCONNU]` complète) dans `CLAUDE.md` §6.
- **D4 → garder le §13 dans `CLAUDE.md`, réduit de ~18 puces à ~5** (le distillat
  « ai-je dérivé ? » non dit ailleurs sous forme positive). Le reste part vers §6.8 / §11 /
  `core.md` / mémoire auto / hook D2a.
- **D5 → `CLAUDE.md` traité comme mono-propriétaire (Saar)** : coupes agressives sûres, pas
  d'`AGENTS.md`. `[INCONNU]` résiduel : confirmer qu'aucun autre agent (Cursor/Copilot) ne
  lit ce dépôt.

### Énoncé initial des décisions (conservé pour trace)

Ces choix orientent plusieurs lots ; rien n'est codé avant réponse.

- **D1 — Source officielle du suivi.** `CLAUDE.md` §10/§12 dit « `EN_COURS.md` est la source
  unique ». La mémoire auto (`feedback_doc_updates.md`) dit « EN_COURS n'est jamais à jour,
  `bug_tickets` est la seule source, dit littéralement par Saar 2026-08-22 ». Laquelle
  devient officielle dans `CLAUDE.md` ? (l'autre est mise à jour en conséquence)
- **D2 — Hooks souhaités.** Veux-tu des hooks déterministes ? Candidats : (a) `deny` git push
  vers `master` ; (b) `Stop` hook « clôture sans Testé/Non testé » — **peut être bruyant** ;
  (c) `PreToolUse` bloquant l'écriture de fichiers de test sous `server/`. Lesquels adopter ?
- **D3 — Rôle de `conventions.md`.** Il a `paths: ["**/*"]` → chargé à **chaque** session,
  comme un second `CLAUDE.md`, et recoupe ~80 % de `CLAUDE.md` §1. Option A : il devient LE
  noyau court toujours-chargé et `CLAUDE.md` maigrit. Option B : on le supprime, son contenu
  unique remonte dans `CLAUDE.md`. Préférence ?
- **D4 — Sort du §13 « Détecteur de dérive ».** Le garder comme dispositif (raccourci
  au régime : ~50 lignes de STOP), ou le convertir en règle courte + laisser les
  « cicatrices de session » à la mémoire auto ?
- **D5 — Partage de `CLAUDE.md`.** Est-il versionné/partagé avec un tiers aujourd'hui ?
  (impact sur l'agressivité des coupes et l'archivage)

---

## 2. Inventaire des défauts (constat)

| # | Défaut | Preuve | Critère Anthropic |
|---|--------|--------|-------------------|
| A | `CLAUDE.md` §10 nomme `docs/JOURNAL6.md` — **archivé** dans `docs/Old/` (JOURNAL7 aussi) ; le journal courant est `docs/JOURNAL8.md`, dont l'en-tête décrit exactement le rôle que §10 prête à « JOURNAL6 » | [VÉRIFIÉ] `ls docs/JOURNAL*` + `docs/Old/JOURNAL6.md` + en-tête `JOURNAL8.md` | #6 (référence périmée) |
| B | Contradiction EN_COURS vs bug_tickets entre `CLAUDE.md` §10/§12 et mémoire auto | [VÉRIFIÉ] les 2 textes | #4 |
| C | « jamais push vers `master` » (§5,§13) : aucun hook, et `settings.local.json` `allow` contient `Bash(git push *)` (passe sans prompt) | [VÉRIFIÉ] absence `.claude/hooks/` + `allow` | #5 |
| D | « clôture sans Testé/Non testé » (§13) : aucun `Stop` hook | [VÉRIFIÉ] | #5 |
| E | « fichiers de test sous `server/` interdits » (§5) : aucun `PreToolUse` bloquant | [VÉRIFIÉ] | #5 |
| F | AskUserQuestion : §13 le redit en prose alors que `deny` existe déjà | [VÉRIFIÉ] `settings.local.json` `deny` | #2 (ligne inutile) |
| G | `CLAUDE.md` = 223 lignes ; charge always-on réelle ≈ 240 (+ `conventions.md` `**/*`) | [VÉRIFIÉ] `wc -l` + frontmatter | #1, #2 |
| H | 3 dispositifs d'emphase concurrents : §1 « absolues » (9), §6 « interdits », §13 STOP (18) | [VÉRIFIÉ] lecture | #3 |
| I | Redondance : cause racine / lire-avant / Testé-Non-testé / préserver-worktree / RAW Polaris / un-bug-par-plan, chacun répété 3–5× (dont `conventions.md` et mémoire auto) | [VÉRIFIÉ] recensement | #2, #7 |
| J | En-tête lignes 3–8 : 6 lignes d'historique d'audit dans le contexte de chaque session | [VÉRIFIÉ] | #2, #8 |
| K | Contenu volatil/dérivable : §3 ports `8193/8194` + chemin `/home/didier/Enclume` ; §12 « État courant » | [VÉRIFIÉ] | « Information that changes frequently » / « figure out by reading code » |
| L | §8 et §9 dupliquent `world.md` / `combat.md` (qui se chargent déjà via `paths` au bon moment) | [VÉRIFIÉ] frontmatter `paths` + texte §8/§9 qui pointe vers ces rules | « move it to a rule » |
| M | Heuristiques répétées sans ancrage : « validation proportionnée au risque » (×3), « autant que possible » (§1.9), « inutilement » (§7) — *pas* un défaut d'altitude (recherche externe §3), mais aucune n'a d'exemple canonique qui l'ancre | [VÉRIFIÉ] | #6 nuancé « bonne altitude » |
| O | `CLAUDE.md` ne contient **aucune commande pratique** (build client, `node --test` + piège P56, `node --check`, lancer/ne pas lancer le serveur) — pyramide pro inversée : ~200 l. de méta-process, 0 invocation exacte | [VÉRIFIÉ] lecture intégrale | recherche externe §7 |
| N | §13 recoupe la mémoire auto stable (`feedback_no_questionnaire`, `feedback_planning_only_no_code_prompt`, admin shortcut → `core.md`) | [VÉRIFIÉ] index mémoire | #7 |

### Points solides à préserver (ne pas toucher)
- §2 routage `paths` (rules ciblées, `paths` corrects).
- Taxonomie `[OBSERVÉ]/[VÉRIFIÉ]/[HYPOTHÈSE]/[INCONNU]` (§6, `conventions.md`).
- Gate « Testé / Non testé » à la clôture (aligné « show evidence rather than asserting success »).
- Frontière `CLAUDE.md` vs mémoire auto explicitée (§1).
- Hiérarchie d'autorité unique (une propriété = une source).

---

## 3. Travail segmenté

> Chaque lot est un chantier **indépendant** : plan-run à vide → analyse à charge → exécution →
> validation, avant de passer au suivant (`CLAUDE.md` §6.8). L'ordre ci-dessous est celui de la
> valeur décroissante / risque croissant.
>
> **Contrainte commit (Saar, 2026-09-01)** : **aucun commit avant la fin du rework complet.**
> Toutes les modifications de tous les lots s'accumulent dans le worktree. Ne jamais `reset`,
> `checkout --` ni nettoyer — préserver l'accumulé entre les lots (`CLAUDE.md` §1.5, §4). Le
> `git diff` grossit lot après lot ; le relire en entier à chaque clôture de lot. Un seul commit
> (ou un petit nombre cohérent) au Lot 6.

### Lot 1 — Corrections factuelles (risque faible, gain fort) — run à vide fait 2026-09-01

**Même invariant** (`CLAUDE.md` §5) : « le corpus d'instructions ne contient que des références
factuelles exactes ». Fichiers touchés : `CLAUDE.md`, `.claude/rules/conventions.md`.

- **1a — `CLAUDE.md` §10 ligne 163** : `` `docs/JOURNAL6.md` `` → `` `docs/JOURNAL8.md` ``.
  Libellé concret conservé (Anthropic #6), pas de généralisation. Le reste de la phrase
  (« conserve les décisions et validations durables, pas les notes de réflexion ») est exact —
  ne pas y toucher.
- **1b — `CLAUDE.md` §10 ligne 162** (« `docs/EN_COURS.md` est la source unique des dettes et
  de la prochaine étape ») → réécrire en répartition **non exclusive**, transcrivant l'en-tête
  déjà en vigueur de `EN_COURS.md` :
  - suivi de bug + prochaine étape → `bug_tickets` / `/admin/tickets` (voir `docs/SYSTEME/TICKETS.md`) ;
  - `EN_COURS.md` = dettes non encore migrées, chantier en cours, points de vigilance permanents ;
  - suite / roadmap → `docs/ROADMAP.md`.
- **1c — `CLAUDE.md` §12** (« Le détail courant vit uniquement dans `docs/EN_COURS.md` ») →
  corriger le pointeur de la même façon. **Ne pas** refondre structurellement §12 ici
  (fusion/suppression = Lot 3d) — juste rendre la ligne exacte.
- **1d — `.claude/rules/conventions.md:18`** (« les dettes restent uniquement dans
  `docs/EN_COURS.md` ») → aligner sur 1b. *(Le fichier est supprimé en Lot 4 ; on corrige
  quand même pour ne pas laisser une contradiction vivante d'ici là.)*
- **Mémoire auto** : `feedback_doc_updates.md` dit déjà « bug_tickets est la source » →
  **aucun changement nécessaire**, vérifier seulement à l'exécution.
- **Hors périmètre, noté au §6** : `docs/ASBUILT.md` (~l.842-852) et `docs/EN_COURS.md:77`
  pointent `docs/JOURNAL6.md` au lieu de `docs/Old/JOURNAL6.md`.
- **Validation** : `git diff` relu ; `git diff --check` ; `grep -rn "JOURNAL6" CLAUDE.md .claude/`
  → 0 ; `grep -rn "EN_COURS" .claude/` → 0 occurrence « source unique ». Pas de test runtime
  possible (adhérence LLM non mesurable) — le diff relu **est** la preuve.
- **Commit** : `Session (Claude) — CLAUDE.md : corrections factuelles (journal courant + suivi bug_tickets)`

### Lot 2 — Enforcement du « jamais push master » (D2a) — run à vide 2026-09-01

**État observé** : `settings.local.json` `allow` contient `Bash(git push *)` (+ `git add *`,
`git commit *`) → push master passe **sans prompt**. Aucun `deny` git. Branche `dev/Saar` suit
`origin/dev/Saar`. Remote `origin` = `github.com/Saar-Dev/Enclume`.

**Contrainte technique** : le *matching* des permissions Bash de Claude Code est **par préfixe**,
pas « contient » — un `deny` ne peut pas exprimer « push dont la ligne contient `master` ». Il
peut lister les formes explicites (`git push origin master…`), pas `git push` nu ni les ordres
de mots exotiques. **Seul un hook `PreToolUse` bloque toutes les formes.**

**Options** (à trancher — plusieurs approches viables) :

- **A — minimal.** Retirer `Bash(git push *)` (et `git add *` / `git commit *`) de l'`allow` ;
  ajouter un `deny` des formes explicites master/main dans `.claude/settings.json` (committé).
  → tout push demande une confirmation ; master explicite est refusé sec. **Trou résiduel** :
  `git push` nu si Claude est sur master (repose sur le prompt vu par Saar).
- **B — robuste (recommandé).** A **+** premier hook du projet : `.claude/hooks/guard-git-push.js`
  (node, cross-plateforme), `PreToolUse` matcher `Bash`, dans `.claude/settings.json`. Parse la
  commande : bloque si elle vise `master`/`main` explicitement **ou** si c'est un push nu alors
  que l'upstream de `HEAD` finit par `/master` ou `/main`. `exit 2` + message. ~40 lignes,
  logique stable (master n'est jamais une cible dans ce workflow).
- **C — le plus strict.** `deny: ["Bash(git push:*)"]` = Claude ne pousse **jamais**, Saar
  pousse à la main. Simple et increvable, mais retire une capacité utilisée.

**Recommandation : B.** Aligne « qualité +++ / robustesse » ; le hook est le seul mécanisme
déterministe (Anthropic : hooks = enforcement, `CLAUDE.md`/prose = advisory). A seul laisse un
trou ; C est une régression d'ergonomie.

**✅ Lot 2 exécuté — B — 2026-09-01 (non committé, worktree)**
- NOUVEAU `.claude/hooks/guard-git-push.js` (node, 121 l.) + `.claude/hooks/guard-git-push.test.sh`
  (23 cas). Détection par **segment de
  commande** (`git push` en position de commande seulement, pas dans une chaîne `echo`/`grep`).
  Bloque : `origin master/main`, `-f`/`--force-with-lease` master, `HEAD:master`,
  `refs/heads/master`, `--all`, `--mirror`, env-prefixé, `git -C <path> push`, chaîné après `cd`,
  push nu si upstream de HEAD ∈ {master, main}. Laisse : `dev/Saar`, push nu sur `dev/Saar`,
  `--dry-run dev/Saar`, `git fetch/log ... master`, message de commit contenant « master »,
  `echo`/`grep` mentionnant la commande. Fail-safe : entrée illisible → `exit 0`.
- `.claude/settings.json` (committé) : bloc `hooks.PreToolUse` matcher `Bash`, **pas de `if`**
  (fail-safe : le script décide ; surcoût ~50 ms/appel Bash assumé pour un garde de sécurité).
- `.claude/settings.local.json` : retiré `Bash(git push *)`, `Bash(git add *)`, `Bash(git commit *)`
  de l'`allow` (2ᵉ garde-fou : tout push non couvert par le hook déclenche désormais un prompt).
- **Testé :** 22/22 cas unitaires (`scratchpad/test-guard.sh`) ; intégration réelle —
  `git push --dry-run origin master` bloqué par Claude Code avant exécution (message du hook
  affiché) ; JSON des 2 `settings` valides ; `node --check` du hook OK ; `git diff --check` OK.
- **Non testé :** push nu réel depuis `master` (impossible à jouer sans checkout master ;
  couvert par test unitaire mockant l'upstream). Comportement sur une machine sans `node` au
  `PATH` (le projet dépend de node partout — non pertinent).
- **Reste à faire (Lot 4)** : documenter le hook dans `docs/SYSTEME/CORE.md` ; noyau §Git
  « jamais push master » → « (garde `guard-git-push`) ».
- **Ligne commit final** : `enforcement : hook guard-git-push + allow git resserré`.

- **2d** — acter que `AskUserQuestion` est déjà couvert par `settings` `deny` (rien à faire).
- **Effet `CLAUDE.md`/noyau** : « jamais push master » reste 1 ligne dans le noyau §Git, mais
  devient « (bloqué par hook `guard-git-push`) » au lieu d'une règle d'espoir.
- **Validation** : tentative réelle `git push origin master` (dry-run/`--dry-run` ou sur un
  remote jouet) → confirmer le blocage ; `git push --dry-run` vers `dev/Saar` → confirmer que
  ça passe (prompt ou allow ciblé). Documenter le hook dans `docs/SYSTEME/CORE.md`.
- **Ligne de commit final** : `enforcement : hook guard-git-push + allow resserré`.

### Lot 3 — Dégraissage `CLAUDE.md` sous 200 lignes — **dépend de D4, D5**
- **3a** En-tête lignes 3–8 : convertir en commentaire HTML `<!-- … -->` (strippé du
  contexte) **ou** déplacer l'historique d'audit vers le journal de décisions.
- **3b** §8 et §9 : réduire à 2 lignes chacune (pointeur pur vers `world.md` / `combat.md` +
  `MOTEUR_MONDE.md` / `COMBAT.md`), ou supprimer si la règle routée se suffit à elle-même.
- **3c** §3 : retirer ports (`8193/8194`) et chemin (`/home/didier/Enclume`) — dérivables de
  `.env` ; garder « dév solo sur `dev/Saar`, jamais `master` ».
- **3d** §12 « État courant » : fusionner dans §10 ou supprimer (volatil, pointe déjà ailleurs).
- **3e** §13 *(selon D4)* : soit réduire aux seules puces non couvertes ailleurs, soit
  convertir en règle `.claude/rules/derive.md` courte ; migrer « Je code ? 2× » et l'astuce
  `users.role==='admin'` vers `core.md` / mémoire auto (défaut N).
- **Cible chiffrée** : `wc -l CLAUDE.md` < 200. Recompter après chaque sous-étape.
- **Validation** : `/doctor` (propose automatiquement les coupes de contenu dérivable) ;
  `/context` — mesurer le budget token mémoire avant/après.
- **Commit** : `Session (Claude) — CLAUDE.md : dégraissage sous 200 lignes`

### Lot 4 — Dédoublonnage `CLAUDE.md` ↔ `conventions.md` ↔ rules ↔ mémoire — **dépend de D3**
- **4a** Appliquer **D3** : trancher le rôle de `conventions.md`.
- **4b** Pour chaque invariant répété (défaut I), choisir **un** emplacement autoritaire ;
  remplacer les autres occurrences par rien ou un renvoi court :
  - cause racine → §1.3 (garde) ; retirer de §6, §13, `conventions.md`.
  - lire-avant-de-modifier → §6.1 (garde) ; §1.2 devient un renvoi ; retirer de §2, §13.
  - Testé / Non testé → §11 (garde, format complet) ; §1.7, §7, §13 renvoient.
  - préserver worktree / changements → §1.5 (garde) ; retirer de §7, §4 (§4 garde le détail git).
  - RAW Polaris / pas de raccourci → §1.9 (garde) ; retirer la redite de §13.
  - un bug par plan → §6.8 (garde) ; retirer de §5, §13.
- **4c** Confronter §13 ↔ mémoire auto `feedback_*` : retirer de §13 ce qui est déjà stable
  en mémoire (défaut N).
- **Validation** : `grep` de chaque mot-clé sur `CLAUDE.md` + `.claude/rules/` → confirmer
  l'unicité ; **relire les 3 sources ensemble** (piège Anthropic #4 : cohérence).
- **Commit** : `Session (Claude) — Instructions : dédoublonnage, une autorité par invariant`

### Lot 5 — Ancrer les heuristiques par un exemple canonique — **indépendant**
> Recherche externe §3-§4 : ces formulations sont de **bonne altitude**, ne pas les
> sur-spécifier ni les supprimer — leur donner **un** exemple canonique qui les ancre.
- **5a** « validation proportionnée au risque » : énoncer **une fois** (§11), avec 3 exemples
  canoniques — typo/1 fichier → `node --check` + tests ciblés du module ; multi-fichiers même
  invariant → + tests transverses du domaine ; migration/combat/monde → + scénario réel +
  build client. Les occurrences §1.6 renvoient à §11.
- **5b** §1.9 « autant que possible » → critère d'écart : « un écart au RAW est une décision
  écrite dans `JOURNAL8.md`, jamais implicite » (déjà à moitié dit en §1.9 — le rendre net).
- **5c** §7 « inutilement » / « proportionnés » → un exemple canonique ou suppression si §7
  devient redondant après Lot 4.
- **Validation** : chaque ligne réécrite garde une heuristique **+** un ancrage vérifiable.
- **Commit** : `Session (Claude) — Instructions : heuristiques ancrées par l'exemple`

### Lot 7 — Ajouter la section « Commandes » (défaut O) — **indépendant**
> Structure pro standard (recherche externe §7) : `CLAUDE.md` doit porter les invocations
> exactes du cycle dev. Aujourd'hui absentes — dispersées dans `ASBUILT` / la mémoire / nulle part.
- **7a** Inventorier les commandes réellement utilisées et sûres (sans lancer le serveur) :
  build client, `node --check <fichier>`, `node --test` **avec le piège P56** (exclut
  `migrations_archive/`), lint éventuel, `git diff --check`. Croiser avec `docs/ASBUILT.md`,
  `docs/SYSTEME/CORE.md`, `package.json`, la mémoire (`feedback_run_a_vide`, P53-P56).
- **7b** Ajouter une section courte « Commandes » en tête de `CLAUDE.md` (après la description),
  **+** ce qu'il ne faut **pas** lancer (serveur = nodemon applique les migrations ;
  navigateur = Saar teste lui-même).
- **7c** Vérifier qu'aucune de ces commandes n'est déjà mieux placée dans une règle routée
  (`core.md` pour le serveur, `react.md` pour le client) — divulgation progressive d'abord.
- **Validation** : exécuter chaque commande listée une fois → confirme qu'elle marche et est
  sûre ; `git diff --check`.
- **Commit** : `Session (Claude) — CLAUDE.md : section Commandes (cycle dev sûr)`

> ⚠️ Les Lots 3-7 ci-dessus sont la version **pré-conception** ; les versions à jour
> (noyau mince, D6) sont dans **§7 « Lots révisés par cette conception »**. Faire foi de §7.

### Lot 9 — Assainir le suivi Git de `.claude/` (trouvaille Lot 2)

**✅ Exécuté 2026-09-01 (worktree, non committé)** — option (i) + 9b :
- `settings.json` : `+ "deny": ["AskUserQuestion"]` ; **3 entrées `allow` purgées** (1 psql avec
  `vttpass`, 2 curl avec JWT réel + UUID perso). Les entrées à placeholder `__TRACKED_VAR__` /
  `__CMDSUB_OUTPUT__` **restent** (Claude Code y a déjà masqué les jetons — pas des secrets).
- `.gitignore` : `+ .claude/settings.local.json` `+ .claude/scheduled_tasks.lock`.
- `git rm --cached .claude/settings.local.json` → fichier **préservé sur disque**, sort du suivi.
- **Testé :** `settings.json` JSON valide (22 `allow`, `deny` présent, `hooks` intact) ;
  `git check-ignore` confirme les 2 patterns ; `git ls-files .claude/` = rules + `settings.json`
  seulement ; `git grep eyJhbGci…` sur fichiers suivis → **0**.
- **Non testé :** session Claude Code relancée (`deny` + hook rechargés depuis `settings.json`) —
  à confirmer au Lot 6.
- **Historique** : JWT expirés + `vttpass` (déjà dans `.env.example` par design) restent dans
  les commits antérieurs → **risque accepté**, pas de réécriture.
- **`additionalDirectories`** (chemin machine absolu, `server/` déjà sous la racine) perdu du
  versionnage — non pertinent ; Saar le remet si besoin.
- **Ligne commit final** : `git : settings.local.json dé-suivi + .gitignore + deny remonté`.

<details><summary>Plan initial (run à vide)</summary>

**État observé** : `.claude/settings.local.json` est **suivi par Git** (malgré `.local`), contient
des JWT de dev en dur dans des entrées `allow`, et `.gitignore` n'exclut rien sous `.claude/`.
Or la convention Anthropic : `settings.json` = partagé/committé ; `settings.local.json` =
personnel/par-machine, **gitignoré**.

- **9a** Décider (run à vide → présenter) :
  - **(i)** `git rm --cached .claude/settings.local.json` + l'ajouter à `.gitignore` ; **avant**,
    remonter dans `.claude/settings.json` ce qui est une **politique projet** et non une
    préférence machine : le `deny: ["AskUserQuestion"]`, et toute entrée `allow` réutilisable.
    Les JWT restent dans l'historique mais sont des jetons **localhost expirés** → risque
    accepté, sauf si Saar veut une réécriture d'historique.
  - **(ii)** + réécriture d'historique (`git filter-repo` / BFG) pour purger les jetons —
    lourd (force-push, resync), disproportionné pour des jetons expirés localhost. **Non
    recommandé** sauf demande explicite.
  - **(iii)** minimal : scrubber les chaînes de jetons du fichier courant, garder le suivi —
    perd la séparation partagé/personnel. **Non recommandé.**
- **9b** `.gitignore` : ajouter `.claude/settings.local.json` ; **garder** `.claude/hooks/`,
  `.claude/settings.json`, `.claude/rules/` suivis (ce sont des garde-fous partagés).
- **9c** Vérifier qu'aucun autre fichier sensible n'est suivi sous `.claude/` (ex.
  `scheduled_tasks.lock`).
- **Recommandation préliminaire : (i) + 9b.**
- **Validation** : `git ls-files .claude/` après → ne liste plus `settings.local.json` ;
  `git check-ignore` le confirme ; `.claude/settings.json` seul porte les politiques projet ;
  session Claude Code redémarrée → `deny AskUserQuestion` + hook toujours actifs.
- **Ligne commit final** : `git : settings.local.json dé-suivi + .gitignore .claude/`.
- **Dépendance** : à faire **après** Lot 2 (qui a modifié `settings.local.json`) et de
  préférence avant le commit unique du Lot 6.
</details>

> Note Lot 2 : la modif de `settings.local.json` (retrait des 3 `allow` git) reste **sur
> disque** mais le fichier sort du suivi (Lot 9) → le commit final montre une **suppression**,
> pas un diff de contenu. Un clone neuf part sans ces `allow` = défaut-deny = correct.

### Lot 6 — Vérification finale, commit & clôture — **après 1→5 + 7**
- Relecture conjointe `CLAUDE.md` + `.claude/rules/*` + `settings*` (cohérence, pas de
  contradiction résiduelle, pas de référence morte).
- `/context` : budget token mémoire avant/après (chiffre à consigner).
- `/doctor` : dernier passage.
- `grep -rn "JOURNAL6\|8193\|/home/didier" docs .claude` → 0 résultat attendu.
- Consolider les lignes de journal des lots 1-7 (voir les `**Commit**` de chaque lot) en **un
  seul commit** (ou petit nombre cohérent) sur `dev/Saar` — première écriture Git du chantier.
  Push seulement après confirmation Saar (`feedback_local_before_remote`).
- Écrire le compte-rendu dans `docs/JOURNAL8.md` (format `## Session N — Date — Titre`,
  clôture **Testé / Non testé / Données / Retour arrière**).
- Archiver ce plan → `docs/Old/PLAN_CLAUDEMD_REFONTE.md` avec bandeau de clôture.
- Mettre à jour la date de `CLAUDE.md` et des rules réellement modifiées.
- Les `**Commit**` listés sous chaque lot = fragments du message de commit final, pas des commits
  séparés (contrainte Saar).

---

## 4. Ordre d'exécution recommandé

1. **D1–D5** répondues par Saar (prose) — ✅ fait 2026-09-01.
2. **Lot 1** (corrections factuelles) — ✅ codé 2026-09-01, non committé (contrainte : commit au Lot 6).
3. **D6** (trim modéré vs noyau mince) — **bloque le Lot 3**, à trancher avant.
4. **Lot 2** (enforcement, réduit à D2a) — débloque les allègements de §5/§13.
5. **Lot 3** (dégraissage, *descendre* dans les rules) puis **Lot 4** (dédoublonnage) — cet
   ordre (dégraisser d'abord réduit la surface à dédoublonner).
6. **Lot 5** (ancrer les heuristiques) et **Lot 7** (section Commandes) — indépendants,
   s'intercalent n'importe quand.
7. **Lot 6** (vérif finale, **commit unique**, clôture).

## 5. Trouvailles hors périmètre (à traiter dans un passage doc dédié, pas ici)

- [VÉRIFIÉ] `docs/ASBUILT.md` lignes ~842-852 : 6 renvois `` `docs/JOURNAL6.md` `` qui
  devraient être `` `docs/Old/JOURNAL6.md` `` (fichier archivé le 2026-08-01).
- [VÉRIFIÉ] `docs/EN_COURS.md:77` : même renvoi `JOURNAL6` sans préfixe `Old/`.
- [INFÉRÉ] `docs/SYSTEME/` (CORE, COMBAT, INDEX, TICKETS, ARCHITECTURE_SOCKET, CHAT) +
  `FOUNDATION.md` + `AUDIT.md` + `METHODO_PLAN.md` référencent `EN_COURS.md` — vraisemblablement
  comme « voir EN_COURS » et non « EN_COURS est LA source », donc probablement sans conflit
  après Lot 1 ; à confirmer au cas par cas lors du passage doc.
- [INFÉRÉ] En-tête `EN_COURS.md` : le bloc « points de vigilance permanents » pourrait
  recouper `docs/SYSTEME/CONVENTIONS.md §19` (index maître P/PE/PC/PI cité par `CLAUDE.md` §2).
  À auditer séparément.
- [VÉRIFIÉ] `.claude/settings.local.json` suivi par Git + JWT dev expirés en dur ; `.gitignore`
  n'exclut rien sous `.claude/`. → **traité en Lot 9** (plus hors périmètre, demande Saar 2026-09-01).

---

## 6. Points ouverts

- [INFÉRÉ] Le `Stop` hook « Testé/Non testé » (2b) risque de gêner les tours purement
  analytiques / planification. À évaluer sur cas réels — possiblement abandonné.
- [INCONNU] Existe-t-il une convention de nommage/format des hooks déjà utilisée ailleurs
  dans l'écosystème Saar ? (aucun `.claude/hooks/` aujourd'hui — première fois)
- [INCONNU] `CLAUDE.md` est-il lu par d'autres agents que Claude Code (Codex/Kiwi partis
  depuis le 2026-08-04 d'après l'en-tête) → si non, `AGENTS.md` non requis.

---

## 7. Conception cible — noyau mince (D6, décidé 2026-09-01)

### Principe

`CLAUDE.md` ne garde que ce qui est **(a) toujours pertinent** ET **(b) impossible à router
par `paths:`** : invariants non négociables, méthode de travail, commandes, pointeurs
d'autorité. Tout le reste **descend** dans une règle routée qui se charge exactement quand
le domaine est touché (divulgation progressive — recherche externe §2). Cible : **70-90 lignes**.

### Décisions de conception (Claude, expert — Saar délègue, 2026-09-01)

- **Tension 2 — le bloc « Signaux de dérive / STOP » est SUPPRIMÉ en tant que section.**
  Raison (Anthropic : « if you emphasize many lines, none of them stands out » + « cut
  redundancy ») : 4 des 5 survivants ne font que répéter en négatif les Invariants énoncés
  en positif. Le seul point non couvert ailleurs (réutiliser un événement/service/composant
  avant d'en créer un) devient **une ligne positive dans §Méthode**. Le réflexe « STOP » est
  préservé par **une seule ligne** en fin de §Méthode. §13 : 24 lignes → 1 ligne.
- **Tension 3 — §Méthode reste dans le noyau, ~10 lignes, NON réduite.** Ne pas s'appuyer
  sur la mémoire auto : `CLAUDE.md` §1 (et Anthropic) posent que la mémoire est un journal,
  pas la couche d'instructions. La méthode gouverne chaque tâche → c'est du contenu always-on
  légitime, confirmé, pas une tension à trancher par la coupe. Chaque ligne rendue vérifiable
  (« étapes distinctes, une par tour » : contrôlable — ai-je sauté une étape ?).
- **Corollaire** : la cible passe de « 70-90 » à **« 75-95 lignes »** (méthode pleine assumée).

### Squelette cible de `CLAUDE.md`

```
# CLAUDE.md — Contrat du projet Enclume
<1-2 lignes : VTT maison pour le JDR Polaris — client React, serveur Node/Express,
PostgreSQL (Knex), MinIO, moteur monde 3D, temps réel Socket.IO. Dev solo (Saar) sur dev/Saar.
[À VÉRIFIER au Lot 4 : stack exacte + versions contre package.json / core.md]>

## Commandes            (← Lot 7 : liste validée, invocations exactes)
## Ne pas lancer        (serveur = nodemon applique les migrations ; navigateur = Saar teste)

## Invariants non négociables   (7 points, ex-§1 condensé)
  1. Code + données observées > mémoire > conversation. Lire les fichiers concernés
     et leurs appelants avant de diagnostiquer/modifier. Lecture seule = hypothèse ;
     exécuté ou testé = vérifié. Un résumé de session ne remplace pas la lecture de reprise.
  2. Cause racine. Jamais de rustine, de second moteur, de fallback legacy, de solution
     « temporaire » — sur tout domaine.
  3. Une propriété métier ou physique = une autorité unique. Pas de logique métier
     dupliquée client/serveur.
  4. Préserver les changements existants. Jamais reset/checkout--/nettoyage d'un worktree
     sans autorisation.
  5. Une mécanique de jeu colle au RAW du Livre de Base Polaris ; tout écart est une
     décision écrite dans JOURNAL8, jamais un raccourci silencieux.
  6. Français partout, y compris les descriptions d'appels d'outils.
  7. Ce fichier est la seule source d'instructions modifiable sur demande. La mémoire auto
     est un journal que Claude tient sur lui-même, pas un second exemplaire des règles.

## Méthode de travail   (ex-§6 + §1.6 heuristique + §13 absorbé)
  - Explorer → planifier → analyse à charge → coder : étapes distinctes, une par tour.
    Ne pas coder tant que le plan exact (fichiers, invariant, hors-périmètre) n'est pas présenté.
  - Un plan = un seul bug/problème. Le suivant attend la validation du précédent.
  - Qualité structurelle > vitesse : le temps et la quantité de travail ne sont jamais un
    argument ; si stabiliser demande un rework, le faire.
  - Chercher docs officielles + code pro (GitHub) avant toute mécanique non triviale ;
    ne jamais coder de zéro.
  - Réutiliser un événement / service / composant / store / utilitaire existant avant d'en
    créer un.
  - « Run à vide » = réflexion libre sur le sujet, sans lancer le serveur.
  - Ne pas redemander « je code ? » une 2ᵉ fois sur le même sujet.
  - Termes interdits sans preuve : « probablement », « certainement », « évidemment »
    → [INCONNU] + hypothèse + instrumentation qui tranche. Distinguer [OBSERVÉ] / [VÉRIFIÉ] /
    [HYPOTHÈSE] / [INCONNU] dans les analyses sensibles.
  - **STOP** si tu te vois : diagnostiquer sans avoir lu, coder une cause non instrumentée,
    ou improviser une solution « temporaire » / un second moteur / un fallback legacy.

## Autorités & routage
  - Règles domaine auto-chargées depuis `.claude/rules/*.md` selon leurs `paths:` — elles ne
    remplacent jamais la lecture du fichier source.
  - Moteur monde (`WorldSnapshot`) = autorité spatiale unique ; FSM combat = non-spatial.
    Détail : `rules/world.md`, `rules/combat.md`.
  - Migrations : `rules/migrations.md`. Deux pièges toujours en tête : nodemon applique une
    migration dès l'écriture du fichier ; jamais rappeler `up()` sans vérifier `knex_migrations`.
  - Avant un concept métier : `docs/VOCABULARY.md`. Avant un nouveau doc :
    `docs/RegleDocumentaire.md`. Index des pièges P/PE/PC/PI : `docs/SYSTEME/CONVENTIONS.md §19`.
  - Hiérarchie : Livre de Base Polaris > FOUNDATION > VOCABULARY > SYSTEME > règles domaine
    > MANUEL > PLAN.

## Git & branche        (ex-§3 + §4 + §5-commit condensés)
  - Dev solo sur `dev/Saar`. Jamais de dev dans `master`. Jamais de push direct `master`
    (bloqué par `settings` `deny` — Lot 2).
  - Avant une tâche : `git status --short --branch` ; `git fetch origin` ; si upstream publié,
    avancer en `merge --ff-only`. Jamais pull aveugle / `reset --hard` / `checkout --` /
    nettoyage destructif.
  - Commit : une cause racine atomique ; format `Session N (Dev) — Titre` ; commit puis push
    `dev/Saar` seulement après confirmation fonctionnelle de Saar.

## Suivi & documentation   (ex-§10 + §12, déjà corrigé Lot 1)
  - Bugs + prochaine étape : `bug_tickets` (`/admin/tickets`), voir `docs/SYSTEME/TICKETS.md`.
  - `docs/EN_COURS.md` : dettes non migrées + chantier en cours + points de vigilance.
  - `docs/JOURNAL8.md` : décisions/validations durables. `docs/ASBUILT.md` : déployé stable.
    `docs/ROADMAP.md` : la suite. `client/public/CHANGELOG.md` : visible utilisateurs.
  - Mettre à jour la date des docs modifiés. Une dette ne vit pas dans plusieurs docs.

## Clôture              (ex-§11, garde son format — point fort)
  Toute clôture : **Testé** (commandes/scénarios réellement exécutés) / **Non testé** (le
  reste → « ⚠️ clos partiel » si non vide) / **Données** (migrations, imports, runtime) /
  **Retour arrière** (tag/commit si le risque le justifie).
  Validation proportionnée au risque, ancrée : typo / 1 fichier → `node --check` + tests
  ciblés du module ; multi-fichiers même invariant → + tests transverses du domaine ;
  migration / combat / monde → + scénario réel concerné + build client.
  Vérifier `git diff --check`, statut worktree, absence de secrets. Pas de `npm audit fix --force`.
```

### Table de correspondance — rien ne se perd

| Actuel | Destination | Action |
|---|---|---|
| En-tête l.3-11 (historique versions) | — | Supprimer ; l'historique de refonte est dans ce plan + JOURNAL8 |
| §1.1-1.2 (code>mémoire, lire avant) | Core §Invariants 1 | Fusionner, condenser |
| §1.3 cause racine | Core §Invariants 2 (+ ligne STOP §Méthode) | Garder |
| §1.4 autorité unique | Core §Invariants 3 | Garder |
| §1.5 préserver worktree | Core §Invariants 4 | Garder |
| §1.6 validation proportionnée | Core §Clôture (ancrée, ex-Lot 5) | Déplacer + ancrer |
| §1.7 Testé/Non testé | Core §Clôture | Fusionner |
| §1.8 résumé ≠ lecture | Core §Invariants 1 | Fusionner |
| §1.9 RAW Polaris | Core §Invariants 5 | Garder |
| §1 hiérarchie doc | Core §Autorités | Garder 1 ligne |
| §1 langue FR | Core §Invariants 6 | Garder |
| §1 frontière CLAUDE.md/mémoire | Core §Invariants 7 | Condenser |
| §2 routage + pointeurs | Core §Autorités | Condenser 12→4 lignes |
| §3 espaces travail | Core §Git (solo/master) | ports/chemins **supprimés** ; archivage fusion supprimé |
| §4 sync git | Core §Git | Condenser, garder les interdits |
| §5 workflow commit | Core §Git | Condenser 5→3 lignes |
| **§5 sous-section Migrations (8 puces)** | **`rules/migrations.md` (NOUVEAU, path-scoped)** | Déplacer + fusionner avec EN_COURS P53-P56 ; 2 pièges max restent en pointeur Core |
| §6.1-8 avant de coder | Core §Méthode | Condenser 8→~5 lignes |
| §6 inventaire UI (boutons/champs/handlers) | `rules/react.md` | Déplacer si absent |
| §6 termes interdits | Core §Méthode | Garder 1 ligne |
| §7 pendant le dev | `rules/core.md` + `rules/react.md` (déjà) | Supprimer résiduel ; compléter core.md si trou |
| §8 autorité monde | `rules/world.md` (déjà) | Supprimer ; 1 ligne pointer Core §Autorités |
| §9 contrat combat | `rules/combat.md` (déjà) | Supprimer ; 1 ligne pointer Core §Autorités |
| §10 carte des docs | Core §Suivi | Condenser (déjà corrigé Lot 1) |
| §11 validation & clôture | Core §Clôture | Garder condensé |
| §12 état courant | Core §Git (« sous revue Saar ») | Supprimer le reste (redondant §Suivi) |
| §13 détecteur de dérive (18 puces) | 1 ligne STOP en §Méthode + absorption | voir ventilation |

**Ventilation §13** (décision de conception : pas de section « Signaux », tout est absorbé) :
`diagnostic sans lecture` + `[HYPOTHÈSE] non instrumentée` + `solution temporaire / second
moteur / fallback` → **ligne STOP unique** en fin de §Méthode. `événement-service-composant
sans recherche` → ligne positive §Méthode (« réutiliser… avant d'en créer »). `terme sans
VOCABULARY` + `doc sans RegleDocumentaire` + `dette copiée` → §Autorités / §Suivi. `mécanique
combat sans REGLESYSCOMBAT` → `rules/combat.md`. `migration sans audit` → `rules/migrations.md`.
`admin shortcut` → `rules/core.md` (déjà). `AskUserQuestion` + `push master` → `settings`
(Lot 2), puces supprimées. `« Je code ? » 2×` + `plan 2 bugs` + `clôture sans Testé/Non testé`
→ §Méthode / §Clôture (déjà, formulation positive). `résumé pour refaire/oublier` → §Invariants 1.

### Règle nouvelle : `.claude/rules/migrations.md`

```
---
description: Migrations Knex — numérotation, nodemon, rollback, seeds
paths:
  - "server/src/db/migrations/**"
  - "server/knexfile*"
  - "server/src/db/knex*"
---
```
Contenu = §5 sous-section Migrations + EN_COURS P53-P56, **en invariants + pointeur vers
`docs/SYSTEME/CORE.md`** pour le détail (ne pas recopier ce que CORE.md porte déjà).
Pré-check Lot 3 : lire `rules/core.md` + `docs/SYSTEME/CORE.md` — s'assurer que `migrations.md`
= invariants routés, pas un doublon.

### Lot 3 — run à vide 2026-09-01 (fichiers rouverts : `react.md`, `i18n.md`, `CORE.md §Migrations`, `core.md`)

**Constats qui changent le lot :**

- **F5 (i18n serveur) est déjà quasi résolu** : `i18n.md` `paths` inclut **déjà**
  `server/src/socket/**/*.js` et son contenu porte la règle serveur complète (`system:true` +
  `i18nKey`, résolu client). **Gap résiduel étroit** : les erreurs REST via `errorHandler`
  (`{error:{i18nKey}}`, `EN_COURS` PC48) — hors `server/src/socket/`. → **1 ligne dans `core.md`**
  (pointeur vers `i18n.md`), pas de modif des `paths` d'`i18n.md` (éviter de le charger pour
  tout le serveur).
- **`react.md` porte déjà les invariants d'état UI** (sélection/aperçu/validation/annulation
  explicites ; ouverture de panneau ne perd pas la sélection ; classes `.btn`…). Ce qui manque
  = le **réflexe méthodo** de `CLAUDE.md §6.2` : *recenser* avant de modifier. → **1 ligne**.
- **`CORE.md §Migrations` = P52-P56 complet** (tri lexical/CLI, nodemon, `up()` manuel, table =
  création+contraintes+seed, `node --test` archive). `migrations.md` = **pointeur + liste
  rapide**, jamais copie. `core.md` porte déjà `SEED-ID-DETERM` → cross-ref, pas duplication.

**Plan d'exécution Lot 3 (3 fichiers, aucun touche `CLAUDE.md`) :**

1. **NEW `.claude/rules/migrations.md`** (~18 l.). `paths` : `server/src/db/migrations/**`,
   `server/src/db/seeds/**`, `server/knexfile*`, `server/src/db/knex*`. Contenu : renvoi
   `docs/SYSTEME/CORE.md §Migrations` en tête + liste rapide (numérotation = prochain entier
   libre vérifié sur `ls migrations/` **et** `knex_migrations`, pas `EN_COURS` ; nodemon
   auto-applique à l'écriture → jamais de fichier de test sous `server/` ; jamais `up()`/`down()`
   manuel sans `SELECT knex_migrations` ; jamais la CLI knex brute ; rétrocompatible avec le
   code déployé ; une table = création + contraintes + seed, fichiers séparés ; seed audité par
   clé naturelle, jamais par `id` — cf. `core.md` ; `node --test` découvre `migrations_archive/`).
2. **`.claude/rules/react.md`** — +1 ligne : « Avant de modifier un composant existant :
   recenser boutons, champs, handlers, état de sélection et persistance concernés — ne pas
   casser un flux adjacent. »
3. **`.claude/rules/core.md`** — +1 ligne : « Un message d'erreur destiné à l'utilisateur passe
   par `i18nKey` (résolu client), jamais une chaîne FR figée — `rules/i18n.md`. »

**Pièges identifiés :** (a) `migrations.md` ne doit pas devenir un 2ᵉ CORE.md → strictement
pointeur + invariants courts ; (b) vérifier que `server/src/db/seeds/` existe avant de le mettre
en `paths` ; (c) ces 3 ajouts augmentent un peu le budget always-relevant de `core.md`/`react.md`
— compensé largement au Lot 4 quand `CLAUDE.md` fond. **Validation** : YAML frontmatter valide,
globs testés (`git ls-files` sur les patterns), relecture anti-duplication ; le test de
chargement réel est au Lot 4/6. **Ligne commit final** : `rules : migrations.md + i18n serveur
+ inventaire UI`.

**✅ Lot 3 exécuté — 2026-09-01 (non committé, worktree)**
- NEW `.claude/rules/migrations.md` (37 l.) : renvoi `docs/SYSTEME/CORE.md §Migrations` en tête
  + 8 invariants courts. `paths` = migrations + seeds + `knexfile*` + `knex*` (4 racines
  vérifiées présentes sur disque).
- `.claude/rules/react.md` +1 ligne (recenser boutons/champs/handlers/sélection/persistance
  avant de modifier un composant — ex-`CLAUDE.md §6.2`).
- `.claude/rules/core.md` +1 ligne : **pointeur pur** vers `rules/i18n.md` pour tout message
  utilisateur émis côté serveur (comble le gap canal REST `errorHandler` hors `server/src/socket/`).
  *(v1 restait une paraphrase d'`i18n.md` — corrigé en lot 3.1, cf. analyse critique #1.)*
- **F5 requalifié** : `i18n.md` couvre déjà le serveur Socket.IO (`paths` inclut
  `server/src/socket/**`) — seul le canal REST restait.
- **Testé :** frontmatter YAML parsé OK ; 4 racines `paths` existent ; `git diff --check` OK ;
  relecture anti-duplication (migrations.md = pointeur, pas 2ᵉ CORE.md ; core.md = pointeur pur).
- **Non testé :** chargement réel par `paths` (→ Lot 4/6 via `/context`).
- **Retour arrière :** `git checkout .claude/rules/{core,react}.md` + `rm .claude/rules/migrations.md`.

### Vérification « rien n'a cessé de se charger » (obligatoire, Lot 4)

Pour chaque domaine sorti de `CLAUDE.md`, confirmer que la règle se déclenche :
- toucher `server/src/db/migrations/000_x.js` → `migrations.md` chargé (`/context` ou hook
  `InstructionsLoaded`) ;
- toucher `client/src/pages/X.jsx` → `react.md` + `i18n.md` chargés ;
- toucher `server/src/services/combatX.js` → `combat.md` chargé ;
- toucher `shared/world/x.js` → `world.md` chargé.
- `grep -rn "§[0-9]" .claude/rules/ docs/` → aucune règle/doc ne référence un « CLAUDE.md §N »
  supprimé (les renvois inter-sections deviennent des renvois par titre).
- Risque résiduel identifié : du code touchant la logique de migration **hors**
  `server/src/db/migrations/` (ex. un service) ne chargerait pas `migrations.md` → mitigé par
  les 2 pièges gardés en pointeur Core §Autorités.

### Lots révisés par cette conception

- **Lot 3 (revu)** — *Extraire vers les règles routées.* Créer `rules/migrations.md` ;
  compléter `rules/react.md` (inventaire UI) et `rules/core.md` (résiduel §7 si trou).
  Vérifier le chargement par `paths`. **`CLAUDE.md` pas encore touché.**
- **✅ Lot 7 — livrable validé 2026-09-01** (run à vide : `package.json` racine/client/server,
  `client/eslint.config.js`, `ASBUILT`, `CORE.md` ; tests réels `node --check` sur `.jsx`/`.js`).
  Pièges confirmés : `node --check` échoue sur `.jsx` (exit 1) ; `npm test` matche
  `migrations_archive/` **et** touche la base locale (pas un réflexe) ; lint/build depuis
  `client/` ; aucun linter serveur ; `node --test` nu découvre tout. **Bloc à insérer au Lot 4
  dans `AGENTS.md` :**

  ```
  ## Commandes  (depuis la racine du dépôt sauf mention)
  - Syntaxe JS serveur/shared : `node --check <fichier.js|.mjs|.cjs>` — échoue sur `.jsx`
  - JSX : pas de `node --check` ; passer par le lint ou le build client
  - JSON de locale : `node -e "JSON.parse(require('fs').readFileSync('<fichier>','utf8'))"`
  - Lint client : `cd client && npm run lint`  (ciblé : `cd client && npx eslint <fichiers>`)
  - Build client : `cd client && npm run build`
  - Tests purs (aucune base) : `node --test 'shared/**/*.test.mjs'`
  - Test ciblé : `node --test <chemin/x.test.mjs>` — toujours un chemin explicite
  - Avant livraison : `git diff --check`
  - Pas de linter serveur : `node --check` est le seul contrôle statique côté serveur

  ## Ne pas lancer (sans demande explicite de Saar)
  - Le serveur (`server/` : `npm run dev`/`start`, `nodemon`) — au démarrage il applique
    les migrations Knex en attente (voir `rules/migrations.md`)
  - `npm test` complet — inclut `server/src/db/migrations_archive/` (échecs attendus) et
    des tests serveur qui écrivent dans la base locale
  - Client `dev`/`preview`, navigateur, `npm run test:e2e` (Playwright) — Saar teste l'UI
  - `start.ps1` / `start.sh` — lancement complet de la stack
  ```
  **[INCONNU]** version Node (pas de `.nvmrc` ni `engines` ; dev sur v24) — ne rien inventer.
  **`CLAUDE.md`/`AGENTS.md` pas touchés à ce lot.**
- **Lot 4 (revu) = LE rewrite** — Réécrire `CLAUDE.md` sur le squelette ci-dessus : intégrer
  les commandes (Lot 7) et les heuristiques ancrées (**Lot 5 absorbé ici**) ; §13 réduit ;
  supprimer tout ce qui est routé ; **supprimer `conventions.md`** (D3). Diff massif →
  relecture intégrale + `/context` avant/après + vérif de chargement ci-dessus.
- **Lot 5** — supprimé en tant que lot autonome (absorbé dans Lot 4).
- **Lot 2** — inchangé, indépendant.
- **Lot 6** — vérif finale + **commit unique** + `JOURNAL8` + archivage plan.

### Ordre révisé

1. D1-D5 ✅ · 2. Lot 1 ✅ (worktree) · 3. **D6 ✅ noyau mince** ·
4. Lot 2 (enforcement) · 5. Lot 3 (extraire vers rules) · 6. Lot 7 (inventaire commandes) ·
7. Lot 4 (écrire le noyau + câblage) · 8. Lot 8 (sweep des refs `§N`) · 9. Lot 6 (vérif + commit unique + clôture).

*(ordre affiné en §8 après l'analyse à charge de la conception)*

---

## 8. Analyse à charge de la conception §7 (2026-09-01)

Passe critique avant exécution. Fichiers rouverts : `AGENTS.md`, `.claude/rules/{core,combat,
entities}.md`, `docs/SYSTEME/CORE.md`, grep des refs `CLAUDE.md §N` dans tout `docs/`.

### F1 — GRAVE : `AGENTS.md` existe et était absent du plan

- `AGENTS.md` (38 l., racine) : contrat Codex, écrit pour l'ère 2-devs **morte le 2026-08-04**.
  Partiellement redondant avec `CLAUDE.md` (anti-pattern Anthropic #4/#7 : copies divergentes).
- Il **instruit de lire `.claude/rules/conventions.md`** (l.8) → le supprimer (D3) casse `AGENTS.md`.
  `README_INSTALLATION.md` le référence aussi.
- Claude Code ne lit pas `AGENTS.md` ; Anthropic recommande, quand les deux coexistent, que l'un
  **importe** l'autre (`@AGENTS.md`) pour une source unique.
- → **Décision D7 requise** (prose) :
  - **(A)** supprimer `AGENTS.md` (+ maj `README_INSTALLATION.md`). Aligne sur la réalité mono-agent.
  - **(B)** `AGENTS.md` **devient le noyau tool-agnostique** (le squelette §7) ; `CLAUDE.md` = stub
    `@AGENTS.md` + 1 ligne « Claude Code charge `.claude/rules/` automatiquement ». Source unique,
    standard Linux Foundation, zéro divergence. Coût quasi nul : le noyau, on l'écrit de toute façon.
  - **(C)** réduire `AGENTS.md` à un pointeur de 5 lignes (« ce dépôt suit `CLAUDE.md` ; router
    `.claude/rules/*` manuellement »).
- **Recommandation expert : (B).** C'est l'architecture cible correcte et le surcoût est marginal.
  (C) = repli minimal si on veut zéro risque. (A) = acceptable mais jette la porte inter-agents.
- **✅ D7 = (B) — décidé par Saar 2026-09-01.** `AGENTS.md` = noyau tool-agnostique ; `CLAUDE.md`
  = `@AGENTS.md` + 1 ligne sur le chargement auto de `.claude/rules/`. `README_INSTALLATION.md`
  à mettre à jour au Lot 4.
- Effet : le « Lot 4 = rewrite `CLAUDE.md` » devient **« écrire le noyau (dans `AGENTS.md` si D7=B)
  + câbler les deux fichiers »**.

### F2 — SÉRIEUX : la renumérotation des sections casse des refs vivantes

`grep "CLAUDE.md §"` dans `docs/` : refs à `§1.1 §1.4 §1.9 §2 §4 §5 §6.4 §6.5 §6.7 §6.8 §7 §8
§10 §11 §13` dans — actifs : `EN_COURS.md` (header « Règle §10 »), `JOURNAL8.md` (header + entrées
de session), `JOURNALTEMP.md`, `JOURNALANALYSE.md`, `AUDIT.md`, `docs/PLANS/PLAN_AOE.md`,
`docs/PLANS/PLAN_BATTLEMAP2D.md` ; + nombreux `docs/Old/` (ignorés).

- Mitigation :
  - Entrées de session `JOURNAL8` = record daté → **laisser** (décrivent ce qui était cité alors).
  - Refs structurelles vives (headers `EN_COURS`/`JOURNAL8`, PLANS actifs) → **sweep** vers un
    renvoi par **nom de section** (« `CLAUDE.md`, section Clôture ») ou sans numéro.
  - Bloc **commentaire HTML** en fin du noyau (strippé du contexte — Anthropic #8) : table
    `ancien §N → nouvelle section`, pour les humains qui suivent une vieille réf.
- → **Nouveau Lot 8 : sweep des refs `§N`.** N'annule pas le bénéfice ; ajoute du travail (assumé).

### F3 — MOYEN : `migrations.md` doit pointer, pas copier

`docs/SYSTEME/CORE.md` porte déjà **§ « Migrations — pièges (P52-P56) »** complet et à jour
(nodemon P53, jamais `up()` sans `knex_migrations` P54, table = création + seed P55, `node --test`
archive P56, tri lexical CLI P52). → `rules/migrations.md` = frontmatter + 3-4 invariants courts
+ **pointeur `docs/SYSTEME/CORE.md §Migrations`**. `rules/core.md` (`paths: server/src/**`)
porte déjà l'invariant seed-id et se charge pour **tout** le serveur → filet pour le code
migration hors `server/src/db/migrations/`.

### F4 — MOYEN : 2 invariants cross-cutting à écrire en toutes lettres dans le noyau

- **Spatial** : `combat.md` (l.24, 31) et `world.md` et `voxels.md` restent le contrat ; mais
  `entities.md` **ne le restate pas**. → le noyau §Autorités doit porter la ligne complète :
  « toute décision spatiale (collision / LOS / occupation / navigation) passe par les services
  `world*`, jamais une lecture directe de `surface_data` / Three.js / `voxel_data` ».
- **Serveur = autorité, client = intention/prévisualisation** : dans `core.md` (implicite) et
  `AGENTS.md` l.28, mais cross-cutting → 1 ligne explicite dans le noyau §Invariants.

### F5 — MINEUR : i18n texte en dur côté serveur

`conventions.md` #7 (générique) supprimé ; `i18n.md` `paths` = `client/src/**`. Le pattern
serveur `i18nKey` : vérifier au Lot 3 qu'il est dans `core.md` ; sinon l'y ajouter (1 ligne).

### F6 — vérifié OK

`combat.md` contient bien tout le contrat spatial et la règle ANNONCE/RÉSOLUTION. `AGENTS.md`
l.29 (« refuser un second moteur implicite ») est cohérent avec Invariant 2 — se fond dans F1.

### Verdict

**Noyau mince reste la bonne cible.** Ajustements actés :
1. **fusion avec la refonte `AGENTS.md`** (D7 — reco (B)) ;
2. **+1 Lot (8)** : sweep des refs `§N` + bloc commentaire de correspondance ;
3. le noyau §Autorités/§Invariants porte explicitement **4 lignes cross-cutting** (spatial complet,
   serveur=autorité, 2 pièges migration) — pas de simple renvoi ;
4. `migrations.md` = pointeur vers `CORE.md`, pas copie.

### Ordre final

Lot 2 ✅ → **Lot 3** (rules routées : `migrations.md` pointeur, `react.md` inventaire UI,
`core.md` i18n serveur si trou) → Lot 7 (inventaire commandes) → Lot 9 (assainir Git `.claude/`)
→ Lot 4 (écrire le noyau tool-agnostique dans `AGENTS.md` + câblage `CLAUDE.md = @AGENTS.md` +
suppr. `conventions.md` + §13→1 ligne + F4 + maj `README_INSTALLATION.md`) → Lot 8 (sweep `§N`)
→ Lot 6 (vérif chargement + commit unique + `JOURNAL8` + archivage).

*(D7 = B ✅ ; Lot 5 absorbé dans Lot 4 ; Lot 9 ajouté 2026-09-01 sur demande Saar)*
