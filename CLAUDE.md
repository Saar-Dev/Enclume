# CLAUDE.md — Projet Enclume
> Session 141 (suite 5) — 2026-07-08

---

## RÈGLES ABSOLUES

CODE > conversation. Jamais travailler de mémoire. Lire les fichiers.
1. Lire le fichier concerné avant toute proposition.
2. Confirmer la lecture : *"Fichier [nom] lu. Trouvé : [...]. Continuer ?"*
3. Plan exact avant de coder — lignes touchées, ce qui change, ce qui ne change pas.
4. "Je code ?" une seule fois, plan complet.
5. Relire le fichier produit en entier avant livraison.
6. Confirmation fonctionnelle obligatoire avant étape suivante.
7. **Un seul bug à la fois.** Plan pour un bug → validation → bug suivant. Jamais deux bugs dans le même plan.
8. **Reprise depuis un résumé = nouvelle session.** Exécuter le protocole complet sans exception.

---

## PROTOCOLE

### Début de session
> **Reprise depuis un résumé = nouvelle session — le résumé ne remplace jamais la lecture.**

- `docs/EN_COURS.md` [[docs/EN_COURS|EN_COURS]] → si la prochaine étape n'est pas claire depuis `## ÉTAT COURANT` ci-dessous.
- `docs/ASBUILT.md` [[docs/ASBUILT|ASBUILT]] → si la tâche touche à l'architecture (nouvelles routes, migrations, nouveaux services).
- `docs/JOURNAL5.md` [[JOURNAL5]] (dernier `## Session N` uniquement) → si un bug précis nécessite l'historique d'une décision.
- **Fichiers domaine → chargés automatiquement** via `.claude/rules/` quand les fichiers source sont ouverts.

### Avant de coder
- Lire les fichiers concernés. Jamais de mémoire.
- Plan exact : lignes touchées, ce qui change, ce qui ne change pas.
- "Je code ?" une seule fois.
- Pour tout composant UI : inventaire exhaustif (chaque bouton/input/handler) avant "Je code ?".

### Pendant le développement
- **Run à vide autocentré obligatoire** à la fin de chaque étape.
- **Sessions analytiques (audit, investigation, debug) :** utiliser `docs/JOURNALTEMP.md` comme scratch pad. Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

### Après chaque tâche confirmée fonctionnelle
- Appender [[JOURNAL5]]
- Mettre à jour le header date de tout fichier `.md` modifié.
- Proposer un scénario de test (étapes + résultat attendu) avant de passer à la suite.
- Fin de session : mettre à jour [[docs/EN_COURS|EN_COURS]], [[docs/ROADMAP|ROADMAP]], [[docs/ASBUILT|ASBUILT]], [[CLAUDE]]
- Fin de session : mettre à jour [[client/public/CHANGELOG|CHANGELOG]] — `## vN — date — titre`.
- Rappeler le push Git :
```powershell
git add .
git commit -m "Session N — ..."
git push origin master
```

### Fermeture de bug
Toute clôture ✅ exige :
- **Testé :** [ce qui a été vérifié]
- **Non testé :** [ce qui reste] → si non vide : `⚠️ clos partiel`

### Jamais
- Coder sans confirmation.
- Réécrire un fichier sans l'avoir relu dans cette session.
- Avancer sans confirmation fonctionnelle.
- Écrire "probablement / suppose / certainement" sur une cause non lue → `[INCONNU]` + `[DBG-X]`.
- Proposer un plan couvrant plusieurs bugs simultanément → un seul bug par plan.
- Traiter un résumé de conversation comme substitut à la lecture obligatoire des fichiers.
- Proposer un correctif par contournement ou patch arithmétique quand l'architecture correcte existe — toujours la solution robuste et pérenne, même pour un bug mineur.

---

## DÉTECTEUR DE DÉRIVE

→ "rapide / suppose / probablement / certainement / évidemment / je pense que / devrait" → STOP. Tous les fichiers lus ?
→ Diagnostic de cause racine sans lecture de code → STOP. `[INCONNU]` + `[DBG-X]`.
→ Fermer un bug sans "Testé / Non testé" → STOP.
→ "Je code ?" pour la 2e fois sur le même sujet → STOP. Plan complet → code directement.
→ Question de diagnostic console F12 → STOP. Lisible dans le code source ?
→ Créer événement WS / composant / fonction → STOP. Existe déjà ?
→ Implémenter mécanique de combat → STOP. `docs/REGLESYSCOMBAT.md` lu dans cette session ?
→ Conversation reprise depuis un résumé → STOP. Protocole début de session complet avant toute proposition.
→ Plan mentionnant deux bugs ou plus → STOP. Un bug à la fois.
→ Déclarer `[VÉRIFIÉ]` après lecture du code uniquement → STOP. Lire = `[HYPOTHÈSE]`. `[VÉRIFIÉ]` = instrumenté + observé en exécution.
→ Proposer un correctif sur une cause `[HYPOTHÈSE]` non instrumentée → STOP. Étape instrumentation obligatoire d'abord.
→ Bug non reproductible avant analyse → STOP. Documenter les conditions, ne pas analyser à l'aveugle.
→ Solution "temporaire" / "pour l'instant" / "patch rapide" proposée → STOP. Concevoir pour la durée dès le départ.

---

## PROJET

Enclume — VTT maison. Sessions privées 4–8 joueurs, Raspberry Pi 4.
Stack : React 19 + Vite / Node.js + Express + Socket.io / PostgreSQL + Redis + MinIO / Three.js R3F / Zustand / JWT httpOnly.
Zustand déjà en place pour les fonctionnalités existantes — tout nouveau domaine (ex : wizard création) suit le même pattern. Jamais de state local inter-étapes ou inter-composants quand un store existe.
Monorepo : `client/` + `server/` + `shared/` + `docs/`.
Démarrage : `.\start.ps1` depuis `Enclume/`. Vérification : `http://localhost:3001/api/health` + `http://localhost:5173`.
Git — toujours depuis `Enclume/`, jamais depuis `server/` ou `client/`.
Serveur Alpha "Kiwi" : `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md`.

**Nomenclature docs :**
| Préfixe | Rôle |
|---|---|
| `docs/SYSTEME/*.md` | Spécifications techniques d'implémentation (lire sur demande via rules) |
| `docs/REGLE*.md` | Sources de vérité règles Polaris (LdB) — source absolue |
| `docs/MANUEL*.md` | Synthèse technique des règles (séquences, pipeline) |
| `docs/PLAN_*.md` | Planifications réalisées ou en cours |
| `docs/ARCHI_REWORK.md` | Bible des reworks actifs |
| `docs/ARCHI_REWORK_DONE.md` | Specs complètes des reworks achevés |
| `.claude/rules/*.md` | Règles domaine — chargées automatiquement (path-scoped) |

---

## ÉTAT COURANT — Session 141 (suite 5) (2026-07-08)

- **Session 141 (suite 5) — Correction animation 3D dé D100 (percentile) + D10 ✅ CLOS.** Interruption
  ponctuelle hors chantier en cours (`AdvantagesPanel.jsx` ci-dessous reste la vraie suite). Signalement
  Saar : faces non alignées, résultat serveur ≠ affiché ("30+7" pour un roll serveur de 1), dé des
  unités visuellement cassé (arête/pointe face caméra, jamais une vraie face). Diagnostic [VÉRIFIÉ]
  par instrumentation réelle (`tools/inspect-glb.js` sur les `.glb` commités, pas une hypothèse de
  lecture) : `D10_FACE_GLB`/`D10U_FACE_GLB`/`D10T_FACE_GLB` (`diceMath.js`) ne correspondaient à
  aucune face réelle de `D10.glb`/`D100.glb`, jamais recalculées correctement depuis leur
  introduction Session 65 (même commit que l'ajout des `.glb`) — D4/D6/D8 confirmés corrects par la
  même méthode, D12/D20 hors scope (fonctionnels/déjà calibrés). Recherche pro demandée par Saar
  avant de coder (`byWulf/threejs-dice`, `Dice So Nice!` Foundry VTT) : confirme le pipeline de rendu
  existant déjà standard industrie ; piste "réactiver le D10 procédural" explicitement écartée par
  Saar (dés procéduraux médiocres, D20 procédural s'était avéré impossible à texturer proprement —
  raison probable du passage historique aux `.glb`). Architecture : les deux tables dupliquées à la
  main pour le même fichier `D10.glb` (`D10_FACE_GLB`/`D10U_FACE_GLB`, relevé par Saar) fusionnées en
  `D10_GLB_NORMALS` unique, `d10_units` dérivée automatiquement (relabeling `10→0`) au lieu d'être
  maintenue à la main ; `D10T_FACE_GLB` (D100.glb, fichier distinct) recalibrée indépendamment.
  Harnais de calibration `/dev/dice-calibration` (composant autonome, ne dépendant pas de la donnée
  à calibrer, pose statique + rotation "clock" pour vérifier la lisibilité) — Saar a lu les 20
  valeurs réelles en direct sur les vrais modèles. Code mort D10 procédural supprimé
  (`D10_KITE_NORMALS`/`D10_KITE_VALUES`/`createD10Geometry()`, `DiceMesh.jsx`/`diceMath.js`).
  Testé : dérivation + bijection 0-9 vérifiées, ESLint 0 erreur introduite (2 warnings préexistants
  confirmés via `git stash`), **SR + jet D100 réel en session confirmé fonctionnel par Saar**. Non
  testé : scénarios limites un par un (00/100), retrait de dé en cours d'animation.
  **Addendum post-fix (demande Saar)** : outil de calibration rendu **permanent** et généralisé aux
  7 dieType (`devFaceClusters.js`, k-means à la volée, zéro vecteur transcrit à la main +
  `getClosestFaceValue()` pour comparaison directe). Limite connue non bloquante : arête/pointe
  parfois affichée sur D8/D20 dans l'outil, **confirmée absente en jeu réel** (artefact outil,
  investigué en profondeur via le vrai `GLTFLoader`, décision Saar de ne pas creuser plus loin).
  Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 5)", `docs/PLAN_DICEREWORK3.md`.
- **Session 141 (suite 5) — EN COURS, pas encore codé.** `polaris_latent` (OPT-04) élargi par Saar
  en chantier de correction d'`AdvantagesPanel.jsx` : bug pré-existant trouvé (composant écrit
  avant la migration 99 "char_advantages V2", ne correspond plus au schéma réel — `hasMuta029`
  toujours faux, flux d'ajout en jeu cassé depuis cette migration). Plan complet en 5 lots dans
  **`docs/PLAN_ADVANTAGESPANEL.md`** — **Lot A détaillé ligne-à-ligne, prêt à coder** (7 fichiers
  précis : migration `123_ref_advantages_polaris.js`, `getStep5RefData`, `advantageConstraints.js`,
  `advantageService.js`, `AdvantagesPanel.jsx`, i18n). Dette annexe trouvée et documentée (non
  prioritaire, backlog) : **`[CS7]`** — `SkillsPanel.jsx` a le même bug (`activeMutations` toujours
  vide), rend 10 compétences liées aux mutations invisibles pour tout personnage. **Prochaine
  étape pour une session neuve : ouvrir `docs/PLAN_ADVANTAGESPANEL.md`, section Lot A, et suivre
  le protocole standard (lire les fichiers cités, confirmer, "Je code ?").**
- **Session 141 (suite 4) — Options de campagne : `young_penalty` (OPT-10) ✅ câblée.** Malus FOR/PRE
  16-19 ans (`REGLE_CREATION.txt` « PERSONNAGES TRÈS JEUNES (OPTIONNEL) ») — `getAgeEffects()`
  (`shared/polarisUtils.js`) ne couvrait jusqu'ici que le malus de vieillesse 30+, jamais 16-19 ans
  (code mort, pas un conflit de source cette fois — juste une règle jamais implémentée). Gaté par
  `settings.young_penalty`, malus non applicable par attribut si sa valeur de base est déjà ≤7.
  Analyse à charge demandée par Saar avant codage — 3 points vérifiés : aperçu `AgeSelector.jsx`
  reste basé sur `baseAge` (pas `finalAge`), désynchronisation assumée par Saar (cohérente avec le
  malus 30+ existant, jamais corrigé) ; péremption de `char_attributes.base_level` côté serveur
  vérifiée non risquée (les 2 seuls appels `/reconcile` envoient toujours le payload complet
  step1→step5) ; génotype ne modifie jamais `char_attributes` directement (vérifié). **7/11 options
  faites** (`ambiance`, `random_mutations`, `feminin_bonus`, `random_pro_advantages`,
  `skill_prerequisites`, `skill_max_level`, `young_penalty`) — 4 restantes. Testé : `node --check`/
  ESLint 0 erreur introduite, scénarios `node -e` (OFF/ON par tranche d'âge, seuil ≤7, non-interaction
  avec le malus de vieillesse), SR, **parcours navigateur confirmé Saar ("Fonctionnel")**. Détail
  complet : `docs/JOURNAL6.md` "Session 141 (suite 4)".
- **Session 141 (suite 3) — Wizard Step 4 : Formation "Autodidacte" (7 points libres) ✅ câblée.**
  Hors chantier "Options de campagne" (item 41 EN_COURS.md) — mécanique de base LdB toujours active.
  Le sélecteur de formation affichait un texte informatif sans aucune UI de répartition ni
  application de bonus (`ref_background_skills` sans ligne pour ce background, jamais implémenté
  malgré le commentaire de la migration 98 l'annonçant). Réflexion préalable en plusieurs tours +
  analyse à charge demandée par Saar avant codage : compétences éligibles restreintes par Saar à
  hors `(X)` réservées ET hors compétences à prérequis `SKILL_MIN` (29/232 en base, 10 familles).
  `shared/autodidacte.js` (NOUVEAU, règle pure partagée client/serveur) + `AutodidacteAllocator.jsx`
  (NOUVEAU, zéro nouvelle classe CSS) + `creationService.js` (`resolveAutodidacteSkills`, réutilise
  le pipeline existant des bonus d'origine sans toucher `careerSkills.js`/P55). **1 vrai bug trouvé
  par l'analyse à charge et corrigé** : reset de la répartition sur un simple re-clic de la carte
  déjà sélectionnée (`Step4Experience.jsx`, 3 handlers) — fix par garde `if (code === valeur
  actuelle) return`. Testé : `node --check`/ESLint 0 erreur introduite (1 préexistante confirmée),
  SR + fonctionnel confirmé Saar. Non testé : scénarios détaillés un par un, re-clic accidentel en
  conditions réelles, vérification base post-`reconcileCreation`. Détail complet :
  `docs/JOURNAL6.md` "Session 141 (suite 3)".
- **Session 141 (suite 2) — Options de campagne : `skill_max_level` (OPT-08) ✅ câblée.** Conflit de
  source trouvé avant tout code (même schéma que OPT-07) : `REGLE_CREATION.txt:1250-1263` marque le
  plafond de maîtrise par années d'expérience comme **« (OPTIONNEL) »**, mais `getSkillCap()`
  (`shared/careerSkills.js`, rework Step4 Lot 1, Session 139) l'appliquait **inconditionnellement**
  depuis sa création — ni client (`CareersAllocator.jsx`) ni serveur (`creationService.js` STEP4)
  ne lisaient `settings.skill_max_level`. Analyse à charge demandée par Saar avant codage (3 risques :
  régression comportementale par défaut, échec silencieux si câblage incomplet — `ctx.
  skillMaxLevelEnabled` undefined → `Infinity` sans erreur —, tests unitaires du Lot 1 obsolètes en
  silence) — confirmé par Saar : option OFF → aucun plafond de compétence (seul le budget Q2 limite).
  Plafond fixe +5 origine (règle non optionnelle) inchangé. Scope vérifié Wizard-only (règle "Lors de
  la création" ; `POST /skills/buy` en Progression n'a déjà aucun plafond). **6/11 options faites**
  (`ambiance`, `random_mutations`, `feminin_bonus`, `random_pro_advantages`, `skill_prerequisites`,
  `skill_max_level`) — 5 restantes. Testé : `node --check`/ESLint 0 erreur introduite, scénarios
  `node -e` couvrant explicitement l'état ON (pas seulement OFF, point décisif de l'analyse à charge),
  SR, **parcours navigateur confirmé Saar ("Fonctionnel")**. Détail complet : `docs/JOURNAL6.md`
  "Session 141 (suite 2)".
- **Session 141 — Options de campagne : `random_pro_advantages` (OPT-05) + `skill_prerequisites`
  (OPT-07) ✅ câblées.** OPT-05 : gate le bloc UI "Tirage 1D10" (`CareersAllocator.jsx`, Lot 6 Session
  140) selon `settings.random_pro_advantages` — même pattern que `randomMutationsEnabled`
  (gating client-only, pas de revalidation serveur). OPT-07 : **différente des précédentes** —
  conflit de source trouvé et résolu avant code (`OPTIONS_CAMPAGNE.md` vs `CHARACTER.md`, confirmé
  option réelle par Saar), s'applique sur la fiche personnage en jeu (pas le Wizard), gating
  **client (`SkillsPanel.isVisible`) + serveur (`POST /skills/buy` revalide via `calcSkillTotal`,
  déjà éprouvée en combat)** — demande explicite Saar "bien ET propre". `GET /char-sheet/:characterId`
  renvoie désormais `settings` (canal réutilisable pour les options restantes). Testé : ESLint 0
  nouvelle erreur, SR, requêtes DB réelles (chaîne de prérequis à 5 compétences), **parcours
  navigateur confirmé Saar** (MJ, PNJ, mode Progression — cascade de prérequis correcte, une
  confusion Maîtrise/Total résolue en cours de test, pas un bug). Détail complet :
  `docs/JOURNAL6.md` "Session 141" / "Session 141 (suite)".
- **✅ CHANTIER TERMINÉ : Redesign Step 4 Profession (8/8 lots)** → plan maître (archivé)
  **`docs/Old/PLAN_REWORKFINAL.md`**. **Lot 6 (tirage 1D10, dernier lot) ✅ codé + validé Saar — Session
  140** — migration 122 (`ref_career_random_benefits.points_alt` + 50 lignes manquantes Lot 1),
  `computeRandomBudgetDelta` (`shared/careerAdvantages.js`), `SocketProvider` monté pour la première
  fois dans le Wizard (`WizardCreation.jsx`), bloc UI + overlay `DiceRoller` réel dans
  `CareersAllocator.jsx`. **Bug trouvé et corrigé au 1er test navigateur** : `DICE_RESULT` n'inclut
  jamais `dieType` → tout jet animé hors `SessionPage` retombe sur un D6 — voir **P56**. Bonus même
  session : `Step3Mutations.jsx` "Lancer 1D20" converti en jet réel (`DiceLights.jsx` extrait en
  composant partagé). Détail complet : `docs/JOURNAL6.md` "Session 140".
  Lots 0-5 (fondations, UI, économies, avantages pro, compétences au choix) : voir historique
  sessions 139 ci-dessous. **Prochain chantier à définir avec Saar** — voir `docs/EN_COURS.md` item 44
  (options de campagne restantes, ou Lots 7/8 jamais cadrés en détail).
- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **127 migrations stables** (122_ref_career_random_benefits_lot1_and_points_alt — Session 140 ;
  121_ref_career_skills_choice_groups — Session 139 ;
  120_fix_ref_career_point_categories_lot1 — Session 139 ;
  119_char_sheet_wizard_lock — Session 139 ;
  118_fix_ref_mutations_organe_sensoriel_manquant — Session 138 ;
  117_ref_mutation_subtypes_description — Session 136 ;
  109_mutation_stacking + 108_fix_ref_mutations_encoding — Session 135 ;
  deux numéros 108/109 distincts coexistent avec le seeding carrières, voir P53)

**Session 140 — Redesign Step 4 : Lot 6 (tirage 1D10) — chantier terminé — + fix dieType + D20 réel Step3 ✅ clos :**
- Reprise en nouvelle session sur un plan déjà rédigé (`PLAN_REWORKFINAL.md §8`) : protocole complet
  appliqué, tous les fichiers cités relus dans cette session avant code (`DiceRoller.jsx`,
  `DiceMesh.jsx`, `diceMath.js`, `SocketContext.jsx`, `socket/index.js`, `socketDice.js`,
  `Canvas3D.jsx`, `CareersAllocator.jsx`, `Step4Experience.jsx`, `WizardCreation.jsx`,
  `creationService.js`, `careerAdvantages.js`, `REGLE_PROFESSION.md`) + requêtes réelles. Le plan
  s'est révélé exact, 2 écarts mineurs corrigés en le relisant (réf. fichier, comptage 22→32).
- **Enquête Chasseur de primes (demandée par Saar, refus explicite d'un questionnaire simpliste)** :
  Saar a fourni un extrait qu'il pensait être la vraie page LdB de ce métier, contredisant le constat
  "0 catégorie légitime" de la migration 120. Vérification croisée : texte mot pour mot identique à
  Mercenaire déjà en base — confirmé par Saar comme artefact de mise en page du livre (bavure
  page/colonne). Conclusion inchangée (0 catégorie légitime), mais le Lot 6 dissocie "jet 1D10
  disponible" de "conversion en points" pour respecter la table de tirage imprimée sans budget
  automatique pour ce métier spécifique.
- Migration `122_ref_career_random_benefits_lot1_and_points_alt.js` (NOUVEAU) : colonne `points_alt`
  + backfill 37 lignes `roll=10` + 50 lignes manquantes (5 carrières Lot 1, texte repris du fichier de
  référence `93_seed_ref_careers_lot1.cjs`, cross-vérifié contre `REGLE_PROFESSION.md`). Round-trip
  byte-identique testé (320↔370 lignes). `shared/careerAdvantages.js` : `computeRandomBudgetDelta`
  (nouveau) + `computeProAdvantageAllocation` gagne `ctx.randomBudgetDelta` (rétro-compatible).
  `creationService.js` : validation `randomPicks` (bornes/doublon/roll/`useAsPoints`) injectée dans Q3.
  `WizardCreation.jsx` : `SocketProvider` monté pour la 1ʳᵉ fois dans le Wizard. `CareersAllocator.jsx` :
  reducer étendu + bloc UI + overlay `<Canvas><DiceLights/><DiceRoller/></Canvas>` piloté par socket
  réel (jamais `Math.random`), garde anti-course sur le jet.
- **Bug trouvé après 1er test navigateur — "Lancer 1D10" affichait un D6.** Saar a soupçonné à raison
  une mauvaise réutilisation du système de dés existant. Cause tracée jusqu'au bout du pipeline :
  `socketDice.js` calcule `dieType` mais ne l'a **jamais inclus** dans le payload `DICE_RESULT` émis
  (utilisé seulement en interne pour `dice_config`) — `SessionPage` fonctionne uniquement parce que
  `useSessionSocket.js:62` reconstruit `dieType` côté client depuis le texte de la formule, étape que
  le commentaire (trompeur) de `DiceRoller.jsx` masquait. Fix : `dieType` forcé en dur au point
  d'appel (formule fixe connue, pas une supposition) — voir **P56**.
- **Bonus demandé par Saar dans la foulée** : `Step3Mutations.jsx` "Lancer 1D20" (méthode Tirage
  aléatoire) converti de `Math.random()` vers un jet réel, même mécanique. `DiceLights.jsx` (NOUVEAU)
  extrait en composant partagé (2 consommateurs réels désormais, `Canvas3D.jsx` toujours intact).
- **Testé** : migration round-trip byte-identique, 8 scénarios `computeRandomBudgetDelta`/
  `computeProAdvantageAllocation` (`node -e`, cas Chasseur de primes inclus), `getStep4RefData`
  vérifié en base réelle, ESLint 0 erreur introduite (`git stash` pour confirmer 1 erreur
  pré-existante non liée), SR répété, **SR + fonctionnel confirmé Saar** (Lot 6 après fix + D20 Step3).
- **Non testé** : les 4 rejets serveur du Tirage 1D10 en conditions réelles (bornes/doublon/roll
  inconnu/`useAsPoints` invalide), `char_careers.random_picks` vérifié en base post-`reconcileCreation`
  réel, retrait de carrière avec tirage en cours en conditions navigateur.
- Détail complet : `docs/JOURNAL6.md` "Session 140".

**Session 139 (suite) — Redesign Step 4 : Lot 0 (éligibilité) + Lot 1 (moteur de coût) ✅ clos :**
- Plan maître `docs/PLAN_REWORKFINAL.md` (8 lots, contrats données+payload verrouillés `§1bis`).
- **Lot 0** : `shared/careerEligibility.js` (évaluateur pur, raisons structurées codes+params) —
  remplace les 4 `validateCareer*` de `creationService.js` par `checkCareerEligibility` (parité
  stricte, `reasons[0]` formaté vers les messages historiques). Testé : parité 12/12 (node -e), SR +
  fonctionnel confirmé Saar.
- **Lot 1** : `shared/careerSkills.js` (`computeSkillAllocation`, réutilise `calcSkillCost`/
  `getMaxMasteryByYears` de `polarisUtils.js` — code mort jusqu'ici, 1er consommateur) +
  `education` ajouté à `getStep4RefData`. **Correction de modèle trouvée en lisant la source avant
  de coder** (`REGLE_CREATION.txt:1103-1128,1250-1263`, sur demande explicite Saar "code seulement
  si sûr à 100%") : le plafond par années cumulées (+2 études) ne s'applique qu'aux compétences
  **professionnelles** ; une compétence d'origine (géo/social/formation) non-professionnelle a un
  plafond **fixe +5**, pas `getMaxMasteryByYears(0)=3` comme écrit initialement dans le plan (corrigé
  dans `PLAN_REWORKFINAL §4`). Invisible (ni payload ni UI touchés — zéro régression).
- **Testé :** `node --check` 0 erreur, tests unitaires isolés (`node -e`, P53 respecté) sur
  `calcSkillCost`/`getMaxMasteryByYears`/`computeSkillAllocation` (nominal, cumul années skill
  partagé, `over_cap`, `over_budget`, plafond fixe +5, plafond via études seules), `getStep4RefData`
  vérifié en base réelle (12/12 lignes `ref_career_education`), SR + confirmé Saar.
- **Non testé :** intégration UI (prévue Lot 2).
- **Lot 2** : `CareersAllocator.jsx` réécrit entièrement (rail/agebar/detail/board **GLOBAL**/foot,
  `useReducer`, CSS `.wiz4-*`). Payload `skillAllocations` : per-career → top-level global (Contract B
  `§1bis`) ; `onAdd` réduit à 4 args. `creationService.js` `reconcileCreation` STEP4 valide désormais
  le budget compétences (Q2) via `computeSkillAllocation` avant upsert `char_skills`.
- **2 bugs `-Infinity` trouvés et corrigés (même mécanisme, 2 manifestations)**, aucun couvert par les
  tests synthétiques du Lot 1 : une compétence réservée `(X)` dotée d'un bonus d'origine positif
  bloquait (`isLearned` ne dépendait que du mécanisme `openedSkills`, Lot 5, jamais câblé) ; puis une
  `(X)` professionnelle **sans** bonus d'origine bloquait encore après le 1er fix — `REGLE_CREATION.txt:
  1129-1132` (non lue avant) précise qu'une compétence spéciale est accessible dès qu'une carrière
  retenue la liste. Voir **P55**. Détail complet : `docs/JOURNAL6.md` "Lot 2".
- **Testé (Lot 2) :** ESLint client 0 erreur, `node --check`, reproduction exacte des 2 bugs en
  `node -e` avant/après fix, régression complète Lot 1 (9 scénarios), SR + fonctionnel confirmé Saar
  (filtres, sélection, board avec compétences `(X)` pro/non-pro, plafonds 5/10/13 conformes).
- **Non testé (Lot 2) :** retrait de carrière (recalcul budget), parcours complet jusqu'à finalisation
  + vérification `char_skills.mastery` en base, onglets Carrière/Avantages (coquilles, Lot 3/4).
- Détail complet : `docs/JOURNAL6.md` "Session 139 (suite)".

**Session 139 (suite 2) — Redesign Step 4 : Lot 3 (économies) + bugfix filtre carrières ✅ clos :**
- **Lot 3** : onglet "Carrière & économies" (lecture seule) — table `.wiz4-prog` (titres/salaires
  triés, ligne courante surlignée selon `displayYears`) + encadré `.wiz4-ecobox` (économies pour la
  durée engagée) + tuile agebar "Économies de départ" (placeholder `—` du Lot 2, remplacé). Aucune
  migration, aucun changement serveur — `getStep4RefData` fournissait déjà `career.titles[]`.
- **Point de conception clé** : le serveur (`reconcileCreation` STEP4) persiste déjà les économies
  via `salaire(titre courant pour years) × years` (pas une accumulation par palier traversé) — le
  Lot 3 reproduit exactement cette formule côté client, sans jamais appeler `Math.random()`. Nouveau
  `estimateSalaryFormula()` (`shared/polarisUtils.js`, regex `SALARY_FORMULA_RE` extraite et
  partagée avec `evaluateSalaryFormula` sans changer son comportement aléatoire existant) : moyenne
  déterministe pour les titres à `salary_formula`, marquée `*`, montant réel déterminé par le serveur
  à la validation.
- **Vérification base réelle demandée par Saar** : scénario 3 ans Chasseur de primes + 2 ans
  Cultivateur/Éleveur → 3500 sols affichés. Confirmé conforme (`ref_career_titles` : 500¤/an × 3 +
  1000¤/an × 2 = 3500). Le "100¤/an" mentionné par Saar correspondait au rail de gauche (aperçu
  toujours calculé à 1 an, comportement Lot 2 préexistant), pas au taux réel à 2 ans investis —
  aucun bug.
- **Bugfix associé** : filtre carrières par défaut `'all'` → `'eligible'` (dette [CAR-DEF] repérée
  aux tests Lot 2, signalée par Saar comme source d'erreurs — un joueur pouvait sélectionner un
  métier non éligible par défaut). Une ligne, `CareersAllocator.jsx` `initialReducerState`.
- **Testé :** `node --check`, ESLint 0 erreur, `estimateSalaryFormula` testé en isolation (2 formules
  + cas invalides), non-régression `evaluateSalaryFormula` (2000 tirages), vérification base réelle
  du scénario Saar, SR + fonctionnel confirmé Saar.
- **Non testé :** les 8 scénarios détaillés un par un (validation globale Saar), confirmation
  visuelle navigateur du bugfix filtre (ESLint seul vérifié).
- Détail complet : `docs/JOURNAL6.md` "Lot 3" / "Bugfix — Filtre carrières par défaut".

**Session 139 (suite 3) — Redesign Step 4 : Migration 120 (fix data) + Lot 4 (avantages pro) ✅ clos :**
- **Migration 120** : `ref_career_point_categories` manquantes sur 4 des 5 carrières du Lot 1
  (`artisan_artiste`, `assassin`, `barman`, `contrebandier`) — trouvé en lisant avant de planifier le
  Lot 4, même angle mort que la migration 106 (jamais corrigé pour cette table). `chasseur_primes`
  (5ᵉ carrière) a 0 ligne légitimement (absent de la LdB p.156, confirmé par le fichier de référence
  pré-migration). **Vérification exhaustive demandée par Saar** avant tout code : les 30 sections
  restantes de `REGLE_PROFESSION.md` alignées via leurs en-têtes exactes contre les 32 lignes DB
  (variantes officier/pilote/soldat d'élite incluses) — 30/30 conformes, 2 normalisations cosmétiques
  sans impact. `server/src/db/migrations/120_fix_ref_career_point_categories_lot1.js` (NOUVEAU, 26
  lignes, `down()` symétrique). Nodemon a auto-appliqué la migration avant le test manuel (P53) — le
  1er appel direct à `up()` a levé une violation de contrainte unique (données déjà présentes,
  bookkeeping correcte) : contrairement à P54, la contrainte a empêché toute corruption. Round-trip
  `down`/`up` refait proprement ensuite, byte-identique.
- **Lot 4** : Avantages pro (5 pts/an **par métier**, `REGLE_CREATION.txt:1151-1159` — jamais lu
  avant ce lot, confirme Q3 déjà verrouillé `§1ter`). `shared/careerAdvantages.js`
  (`computeProAdvantageAllocation`, pattern identique `careerSkills.js`) + validation serveur Q3
  (`reconcileCreation` STEP4, par métier) + onglet "Avantages pro" (`CareersAllocator.jsx`,
  **zéro nouvelle classe CSS** — réutilise `.wiz4-skill`/`.wiz4-ctl`/`.wiz4-sbtn` du board
  compétences) + gating "Suivant" étendu (tous les métiers retenus doivent avoir leur pool réparti).
- **Cas limite trouvé en relecture avant livraison** (règle 5) : un métier à 0 catégorie
  (`chasseur_primes`) calculait un budget `5×années` invendable dans `computeProAdvantageAllocation`
  — bloquait "Suivant" indéfiniment. Fix : `budget = 0` si aucune catégorie valide pour ce métier.
- **Testé :** `node --check`/ESLint 0 erreur (1 erreur pré-existante non liée confirmée via
  `git diff --stat`), 6 scénarios unitaires isolés `computeProAdvantageAllocation`, migration 120
  vérifiée en base réelle + round-trip byte-identique, `getStep4RefData` vérifié en base réelle
  (26 lignes remontées), simulation validation serveur Q3 (rejet correct sur 2 cas), SR + fonctionnel
  confirmé Saar.
- **Non testé :** persistance `char_careers.pro_advantages` vérifiée en base après un
  `reconcileCreation` réel complet (scénario navigateur = flux UI + gating, pas lecture SQL
  post-finalize).
- Détail complet : `docs/JOURNAL6.md` "Migration 120" / "Lot 4".

**Session 139 (suite 4) — Redesign Step 4 : Lot 5 (compétences « au choix ») + nettoyage rail ✅ clos :**
- **Lot 5** : `PLAN_REWORKFINAL §7`, audit exhaustif des 44 lignes `ref_career_skills.conditional=true`
  déjà fait (6 phénomènes distincts sous un flag booléen unique). **Avant tout code (demande explicite
  Saar « sûr à 100% »)** : re-vérification de la source primaire `REGLE_PROFESSION.md` (pas seulement
  le plan déjà écrit) sur les cas les plus ambigus (marqueur « (au choix) » présent/absent) + requêtes
  SQL réelles (44 lignes, `is_category`/`parent`, absence de collision) — 0 écart trouvé.
- Migration `121_ref_career_skills_choice_groups.js` (NOUVEAU) : colonne `choice_group` + 24 lignes T3
  (catégorie/enfant-proxy) réécrites en vrais enfants `ref_skills.parent` groupés par `choice_group`
  (scopé `career_id`) + 4 doublons inertes supprimés (Diplomate ×3, Espion ×1) + 4 lignes Soldat
  d'élite `conditional` corrigé `true→false` (texte source sans marqueur « (au choix) », contrairement
  à Soldat/Milicien). Round-trip `down`/`up` testé en base réelle, byte-identique (P53 : nodemon avait
  déjà auto-appliqué `up()` avant le test manuel).
- `shared/careerSkills.js` : nouvelle `validateChoiceGroups(openedSkillIds, careerSkillRows)`
  (exclusivité par groupe, ignore les lignes T1 sans `choice_group`).
- `server/creationService.js` : `reconcileCreation` STEP4 valide les groupes avant de construire le
  contexte pro ; le payload `openedSkills` (déjà câblé serveur/moteur de coût depuis le Lot 2, jamais
  envoyé par le client) est désormais rempli par `Step4Experience.jsx`.
- `CareersAllocator.jsx` : reducer étendu (`openedSkills`, actions `TOGGLE_OPENED_SKILL`/
  `SELECT_CHOICE_GROUP_SKILL`, purge au retrait de carrière), nouveau bloc UI "Compétences au choix"
  (checkbox T1 solo / radio T3 exclusif), verrouillé tant que le métier n'est pas retenu. **Gap trouvé
  en relecture avant livraison (règle 5)** : `provenanceFor` (tag de provenance du board) ne couvrait
  pas les compétences "au choix" nouvellement ouvertes — corrigé dans le même lot.
- **Nettoyage UI associé (demande Saar)** : icône hexagonale du rail carrières retirée (`.wiz4-hex` +
  style inline `--hex`, `careerHexColor()` conservé pour les tags de provenance du board), colonne
  rail `.wiz4-cols` réduite `296px`→`246px`.
- **Testé :** migration round-trip `down`/`up` byte-identique en base réelle, `validateChoiceGroups`
  (6 scénarios `node -e`) + non-régression `computeSkillAllocation`, `node --check`/ESLint 0 erreur
  introduite (1 erreur pré-existante non liée confirmée via `git stash`), SR (`/api/health` 200),
  fonctionnel confirmé Saar ("All ok").
- **Non testé :** vérification directe `char_skills.is_learned` en base après un `reconcileCreation`
  réel avec un choix "au choix" sélectionné ; confirmation visuelle navigateur du nettoyage rail.
- Détail complet : `docs/JOURNAL6.md` "Lot 5" / "Nettoyage UI — icône hexagonale du rail carrières retirée".

**Session 139 — Fiche personnage consultable en permanence pendant le Wizard (fenêtre "peek") ✅ clos :**
- Plan complet rédigé en amont dans une conversation précédente : `docs/STE6_FINAL.md` (v3). Reprise
  en nouvelle session — protocole complet appliqué : tous les fichiers cités par le plan relus dans
  cette session avant tout codage. Aucune dérive bloquante trouvée ; deux précisions apportées en
  cours de lecture (repérage ligne à ligne `CharacterWindow.jsx` légèrement décalé ; le point
  "AdvantagesPanel" du plan renvoie en réalité à `CharacterSheet.jsx`, pas à `CharacterWindow.jsx`).
- Migration `119_char_sheet_wizard_lock.js` (NOUVEAU) : `char_sheet.wizard_locked_at` — sépare
  propriété "assistant" (rejouable pendant le Wizard) de propriété "runtime" (fiche éditable
  librement après verrouillage).
- `creationService.js` : `finalizeCreation` → `reconcileCreation` (pattern reconciliation
  Kubernetes/Terraform, payload partiel autorisé, rejouable — reset `is_fertile`/`char_skills`/
  `char_careers`/`char_advantages`+ledger avant chaque réapplication, effets d'âge en `update`
  absolu au lieu d'`increment`). Nouvelles fonctions `lockWizard`/`getCharacterPreview`.
  `routes/creation.js` : `/finalize` → `/reconcile` + nouvelles routes `/preview`/`lock`.
  `routes/characters.js` : filtre liste gate sur `wizard_locked_at` (au lieu de `creation_state`).
- `CharacterWindow.jsx` : prop `forceReadOnly` — cascade `effectiveIsGm`/`effectiveIsOwner` sur tous
  les calculs de permission ; `WizardCreation.jsx` : fenêtre "peek" montée en permanence dès l'étape
  1 (bouton dans `WizardHeader.jsx`), `handleTerminate` (reconcile complet + lock) remplace
  `handleFinalize`.
- **Déviation trouvée en codant (plan corrigé)** : l'appel `useCharacterStore.setCharacters([...])`
  prévu par le plan a été omis — `CharacterWindow.jsx` ne lit jamais `characters` depuis ce store
  partagé avec la session de jeu réelle ; l'appeler aurait risqué d'écraser silencieusement la vraie
  liste de personnages si l'onglet avait déjà une session chargée.
- **Testé :** `node --check`/ESLint 0 erreur, round-trip migration 119 (`down`/`up` par appel direct
  des fonctions, byte-identique), SR + parcours fonctionnel confirmé par Saar.
- **Non testé :** les 8 scénarios détaillés un par un de `docs/STE6_FINAL.md` §15 (validation donnée
  sur "SR et fonctionnel" globalement, pas listée point par point).
- Détail complet : `docs/JOURNAL6.md` "Session 139".

**Session 139 (suite 5) — Wizard Step1 : Description physique + Main directrice (2D10) ✅ clos :**
- Hors chantier Redesign Step4. Demande Saar : ajouter à l'Étape 1 les champs de la fiche perso
  (taille/poids/peau/corpulence/yeux/cheveux/signes particuliers) + Main directrice, en référence au
  Bloc 2 "Description" de `CharacterSheet.jsx`. Schéma DB déjà complet (`char_identity`, migration 36)
  — **aucune migration**. `reconcileCreation` STEP1 n'écrivait jusqu'ici que `char_name`/`player_name`.
- Main directrice : bouton "Définir" tirant 2D10 (`REGLE_CREATION.txt:1301-1311` : 2-15 Droitier,
  16-19 Gaucher, 20 Ambidextre) — pattern de tirage 100% client identique à `Step3Mutations.jsx`
  (`handleRoll`), pas un contournement (question explicite de Saar sur le risque de bricolage).
  Vérification avant code ("sûr à 100%") : `REGLE_CREATION.txt:1317-1324` confirme la Description
  physique purement narrative (non bloquante) — seule la Main directrice a une vraie mécanique de dé.
- `Step1Attributes.jsx` (nouveau bloc + `handleRollHandPref`), `creationService.js` (STEP1 étend
  l'insert/merge `char_identity` + garde `hand_pref ∈ {R,L,A}`), `creation.json` (15 clés), `index.css`
  (6 classes `.wiz1-desc-*`, calquées sur l'existant).
- **Bug préexistant découvert (non corrigé, voir dette HP1)** : `socketCombatHelpers.js:550` et
  `char-sheet.js:810` lisent `hand_pref` sur `char_sheet` (colonne inexistante — seule
  `char_identity.hand_pref` existe) → retombe toujours sur `'R'`, la mécanique Main directrice n'a
  probablement jamais été appliquée en combat. Trouvé par lecture directe, non instrumenté.
- **Testé :** `JSON.parse`/`node --check`/ESLint 0 erreur introduite, SR + fonctionnel confirmé Saar.
- **Non testé :** scénarios détaillés un par un, vérification base réelle post-`reconcileCreation`.
- Détail complet : `docs/JOURNAL6.md` "Session 139 (suite 5)".

**Session 138 — Fix `cost_pc` « Organe sensoriel manquant » (migration 118) + présentation cartes Step3 ✅ clos :**
- Signalement Saar (capture rulebook "TABLE DES MUTATIONS") : gain de PC faux pour "Organe sensoriel
  manquant" dans le Wizard Step3. Vérification exhaustive des 45 lignes `ref_mutations` vs
  `docs/Character/Creation/REGLE_CREATION.txt:812-898` demandée par Saar avant tout plan (un premier
  plan trop étroit n'avait vérifié que la mutation signalée) — 44/45 lignes correctes.
- Migration `118_fix_ref_mutations_organe_sensoriel_manquant.js` (NOUVEAU) : `cost_pc` corrigé sur 4
  sous-types (smell/touch 0→1, hearing 1→2, sight 2→3 ; taste inchangé, déjà correct). Cause :
  décalage d'indexation dans le seed d'origine `95_seed_ref_mutations.js:130-143`. Round-trip
  `down`/`up` testé via appel direct des fonctions du module — byte-identique.
- `Step3Mutations.jsx` : titre de carte tronqué (`overflow`/`ellipsis`/`nowrap` sur `st.cardName`)
  illisible pour les noms longs → variante déplacée sur sa propre ligne (nouveau style
  `st.cardVariant`, pattern repris de `st.rollSubtype` déjà utilisé côté tirage aléatoire),
  troncature retirée. Bénéfice indirect : la vue "tirage aléatoire" (même style réutilisé) profite
  aussi de la correction sans modification supplémentaire.
- **Effet de bord repéré (non corrigé, dette [MUT1])** : `Purulence` a `cost_pc = -2` en base,
  incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) —
  pourrait l'exclure du filtre `cost_pc >= 0` en méthode achat libre (`Step3Mutations.jsx:254`).
- **Testé :** valeurs DB conformes à la rulebook, round-trip migration byte-identique, ESLint 0
  erreur, confirmation visuelle navigateur par Saar (coûts corrects + titres non tronqués).
- **Non testé :** achat effectif d'une des 4 mutations corrigées en conditions réelles (dépense PC,
  `finalizeCreation`).
- Détail complet : `docs/JOURNAL6.md` "Session 138".

**Session 137 — Option de campagne `feminin_bonus` + Sexe/Fécondité (Step1/3/5) ✅ clos :**
- Portée élargie en cours de route (remarque Saar) : le Sexe choisi en Step1 peut être altéré par
  une mutation en Step3 (Asexué/Androgyne/Autofécondation), ce qui touche la Fécondité (désavantage
  `adv_076`, Step5) — plan complet rédigé avant codage : `docs/PLAN_SEXE.md`.
- Schéma DB déjà existant mais jamais câblé (`char_archetype.sex/is_fertile`, `ref_mutations.
  mod_sex/mod_fertility`, `ref_advantages.adv_076`) — aucune migration nécessaire.
- `creationService.js` : `feminin_bonus` gate l'effet mécanique (FOR base 5, bonus COO/PRE) sans
  cacher le sélecteur Sexe (règle LdB : Sexe = identité/fécondité, indépendant du bonus optionnel).
  STEP1 écrit `char_archetype.sex`, STEP3 l'override selon les mutations choisies + pose
  `is_fertile`. `advantageService.js`/`advantageConstraints.js` : achat de Fécondité pose
  `is_fertile = true`, bloqué si mutation stérilisante déjà présente (contrainte `not_if_sterile`,
  valable Wizard + fiche perso post-création).
- `Step1Attributes.jsx` : mock `isFeminin` mort supprimé, calcul mécanique gaté par
  `femininBonusEnabled` (4 points d'appel), ligne d'explication ajoutée dans l'accordéon règles
  (demande Saar post-implémentation) visible seulement si l'option est active.
- **Testé :** SR + parcours Wizard confirmé fonctionnel par Saar, lint/syntaxe validés sur tous les
  fichiers touchés (`node --check`, `JSON.parse`, ESLint, 0 erreur introduite).
- **Non testé :** les 8 scénarios détaillés de `PLAN_SEXE.md` un par un (validation donnée sur le
  parcours global, pas listée point par point).
- Détail complet : `docs/JOURNAL6.md` "Session 137".

**Session 136 — PLAN_STEP4 : mutations réelles dans le Wizard Step3 ✅ clos :**
- Migration 117 (`ref_mutation_subtypes.description` + backfill 4 lignes CGA) ; backend
  `getStep3RefData()` (mutations + `subtable` + `skills` imbriqués, pattern `Map` identique à
  `getStep4RefData`), route `GET /:sheetId/step3/ref`, `randomMutationsEnabled` propagé depuis
  `startCreation`.
- `Step3Mutations.jsx` réécrit entièrement (mocks supprimés) : 45 mutations réelles, variantes
  (Difformités, Organe sensoriel manquant/suppl., Résistance naturelle) libellées avec les vrais
  termes de la rulebook (vérifiés dans `REGLE_MUTATION.md`/`REGLE_AVANTAGES.md` avant codage —
  "légère/importante", pas "mineure/majeure" comme supposé initialement), tirage aléatoire sur un
  vrai D100 par plage avec relance sur doublon `is_unique`. `mutationsMeta` alimente
  `WizardReview.jsx` sans accès i18n/DB.
- Correctif UX post-fonctionnel (demande Saar) : halo de confirmation temporaire (`.wiz3-card-flash`,
  `index.css`) sur la carte cliquée — préférée à un déplacement de la liste de sélection.
- **Testé :** SR + fonctionnel confirmé par Saar (parcours Step3), halo confirmé fonctionnel,
  lint/syntaxe validés sur tous les fichiers touchés (`node --check`, `JSON.parse`, ESLint).
- **Non testé :** round-trip migration 117, achat stackable 2× et tirage D20/D100 en conditions
  réelles navigateur, toggle `random_mutations`.
- Détail complet : `docs/JOURNAL6.md` "Session 136".

**Session 135 — Bug encodage `ref_mutations` (migration 108) + PLAN_MUTATION stacking (migration 109) ✅ clos :**
- Bug découvert lors du run à vide sur PLAN_MUTATION : `95_seed_ref_mutations.js` insère du texte
  mojibake (octets UTF-8 mal réinterprétés en Windows-1252 puis ré-encodés) — 44/45 lignes
  `ref_mutations`, 4/4 `ref_mutation_subtypes`, 4 `ref_mutation_skills` corrompues. `108_fix_ref_mutations_encoding.js`
  (NOUVEAU) : transformation CP1252 déterministe et réversible, cross-vérifiée contre `docs/Character/Creation/REGLE_MUTATION.md`.
- **Incident et remédiation** (voir P54 ci-dessous) : rappel manuel redondant de `up()` après
  l'auto-application par nodemon a corrompu 6 lignes (remplacement `�`) ; réparation par extraction
  regex a introduit un second bug (décalage de `description`) ; corrigé définitivement par valeurs
  en dur cross-vérifiées. Détail complet : `docs/JOURNAL6.md` "Session 135".
- `109_mutation_stacking.js` (NOUVEAU) : colonne `ref_mutations.stack_deltas` (JSONB) sur les 9 lignes
  à incrément non-linéaire + réécriture `char_mutation_effects_view` (`SUM(base + (count-1) × COALESCE(delta, base))`).
- `creationService.js:245-269` (`finalizeCreation` STEP 3) : upsert `ON CONFLICT` sur l'index partiel
  `uq_char_mut_no_sub` — mutation stackable achetée 2× dans le même lot → `count` incrémenté au lieu
  de violer la contrainte unique.
- **Testé :** formule de stacking (3 scénarios), upsert anti-doublon, round-trip migration 109
  (`down`/`up`, jamais deux `up()` de suite), 45/45+4/4+10/10 lignes décodées sans anomalie —
  tout via transactions Postgres annulées ou vérifications directes en base.
- **Non testé :** parcours réel dans le wizard (`Step3Mutations.jsx` utilise encore le mock, confirmé
  par Saar — attendu tant que PLAN_STEP4 n'est pas implémenté, désormais débloqué).
- Plan archivé : `docs/Old/PLAN_MUTATION.md`.

**Session 134 suite — Lots 2-6 carrières (32 carrières) + FK ref_career_skills ✅ clos :**
- Migrations 108-109 (lot2), 111 (FK + suppression `skill_group`), 112-116 (lots 3-6). **37/37 carrières** en base, illustrations incluses directement dans chaque migration de seed (plus de migration séparée comme au lot 1).
- **Correction architecturale majeure** : `ref_career_skills.skill_id` a désormais une vraie FK vers `ref_skills.id` (`ON DELETE RESTRICT`) ; `skill_group` (texte libre jamais aligné avec `ref_skills.family`, source d'un bug de fragmentation UI) supprimé — le regroupement UI utilise désormais `ref_skills.family` via JOIN (`creationService.js:133`, `CareersAllocator.jsx:44-46`). Détail : `docs/Old/PLAN_CAREER_SKILLS_FK.md`.
- 2 bugs `required_genotype` trouvés et corrigés (`hybride_trident` → `GEN_HYB`, `techno_hybride` → `TEC_HYB` — valeurs inventées ne correspondant à aucun `ref_genotypes.id`).
- Détail complet : `docs/Old/PLAN_LOTS_3_6_CAREERS.md`, `docs/JOURNAL6.md` "Session 134 suite".
- **Testé :** 37/37 carrières, 0 orphelin FK, 0 carrière sans illustration, round-trip `up`/`down`/`up` par migration, wizard Step4 confirmé fonctionnel par Saar (carrières + génotypes + regroupement par famille).
- **Non testé :** branchement UI de `ref_career_equipment`/`ref_career_random_benefits`/`ref_career_point_categories` (peuplés mais non consommés par le code — chantier séparé) ; prérequis carrières (`ref_career_prerequisites`, non insérés).

**Session 134 — Migration 106 : correction lot 1 carrières (ref_career_skills) ✅ clos :**
- `106_fix_ref_career_skills_lot1.js` (NOUVEAU) : 9 corrections `skill_id`/`conditional` sur 5 carrières (artisan_artiste, assassin, barman, chasseur_primes, contrebandier) vs `REGLE_PROFESSION.md`. Aucune suppression `ref_careers`. C3 barman (armes au choix) hors scope. 93 lignes finales.
- **Incident et remédiation** : test round-trip via `npx knex migrate:down` a ciblé par erreur `99_char_advantages_v2.js` au lieu de 106 (tri lexical des noms de fichiers — voir P52 ci-dessous), droppant `char_advantages` + `char_pc_ledger.pc_postcreation`. Table vide au moment de l'incident, confirmé par Saar (aucune perte). Schéma restauré immédiatement, bookkeeping `knex_migrations` réparé. Détail complet : `docs/JOURNAL6.md` "Session 134".
- Round-trip de 106 refait proprement via appel direct des fonctions `up`/`down` du module (contourne le piège CLI) : byte-identique confirmé.
- **Testé :** 9 corrections vérifiées en base (93 lignes), round-trip `up`/`down`/`up` ✅, schéma `char_advantages` restauré ✅, wizard Step4 sur les 5 carrières confirmé par Saar (« all ok »)
- **Non testé :** —

**Session 133 — Migration 37-bis : consolidation ref_skills (3ᵉ révision) ✅ clos :**
- `105_ref_skills_37bis.js` (NOUVEAU) : `attr_1` nullable + colonne `is_category` (remplace le sentinel `attr_1='CHC'`) ; 2 suppressions (`MUTATION`, `ARMES_SATELLITES`) + re-parentage 8 mutations vers `CONTROLE_DES_MUTATIONS` ; 11 labels + 4 attrs + 113 markers corrigés (legacy `'S'` → vraie valeur LdB) ; 1 déplacement `ref_skill_requirements`. 249 lignes finales (251−2).
- `up`/`down` testés en base réelle : round-trip byte-identique vérifié (diff exit 0 sur les 251 lignes pré-migration).
- `SkillsPanel.jsx` : sentinel `attr_1==='CHC'` → `is_category` (8 catégories rejoignent le regroupement UI : Arts martiaux, Connaissance milieu naturel, Langages spécifiques, Langue ancienne, Langue étrangère, Manœuvre d'armure, Mécanique, Tactique). En-tête de colonnes par famille fusionné avec le nom de famille (contre-proposition Saar) — remplace le libellé générique "Compétence" répété, garde repli/dépli.
- **Effet de bord identifié et validé (pas un bug)** : les compétences `(X)` corrigées (ex-`'S'`) suivent désormais la règle de visibilité normale (masquées tant que non apprises) — comportement identique à `Pouvoirs Polaris`, confirmé voulu par Saar.
- **Testé :** round-trip DB ✅, regroupement 17 catégories en navigateur (normal + Progression) ✅, repli/dépli en-tête fusionné ✅
- **Non testé :** achat XP d'une compétence `(X)` nouvellement corrigée en mode Progression (logique inchangée, non re-testée explicitement)

**Dettes actives :**
- `SkillsPanel.jsx:155` (`isVisible`) — `if (skill.attr_1 === 'CHC') return false` code mort (jamais atteint vu les points d'appel actuels) — cosmétique, sans impact
- `server/src/routes/character/ref.js:38` — commentaire "234 skills" obsolète (table à 249 lignes désormais) — cosmétique
- **Résiduel split-brain** — `COMBAT_STATE_SYNC` reconnexion RESOLUTION — sprint futur
- "Changer le mode de tir" — non implémenté — sprint futur
- `useDiceAudio.js` — sons dés
- `.gitattributes:3` — attribut invalide
- Kiwi P-SRV-5 — ports Docker non restreints à 127.0.0.1
- `onTokenRotate` dead code Canvas3D/Scene
- `getVoxelSurfaceTop` — pas de cas slope/wedge
- Sprint Annonce v2 — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- Surprise critique (roll=1) → initiative=1 — à analyser
- [DBG-C1] Owner wizard — `character.user_id` null quand GM crée pour joueur absent (steps 1-3 non implémentés)
- **[WIZ-1]** Personnages incomplets (creation_state ≠ 'complete') visibles dans la liste — à filtrer côté Dashboard/liste
- **[WIZ-2]** Deux compteurs PC (header store vs CareersAllocator local) — cosmétique, sprint COUCHE 4c
- **[WIZ-3]** Formation "apprentissage_technique" → choix spécialité non implémenté — sprint COUCHE 4c
- **[JSON1]** `client/src/locales/en.json` invalide — guillemets non échappés `deleteMapConfirm` (préexistant) — casse tout le fichier EN
- **[OPT-W1]** 4/11 options de campagne sans effet mécanique branché (Wizard/SkillsPanel/CharSheet) — `ambiance`, `random_mutations`, `feminin_bonus`, `random_pro_advantages`, `skill_prerequisites`, `skill_max_level`, `young_penalty` câblées — sprint futur, en cours un par un
- **[OPT-W2]** `style={}` visuel dans `client/src/components/campaignSettings/*` (convention CSS) — basse priorité
- **[MUT1]** `Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) ; `Step3Mutations.jsx:254` (`cost_pc >= 0`) pourrait l'exclure de la liste achetable en méthode libre — non diagnostiqué en profondeur, sprint futur
- **[HP1]** Main directrice : `socketCombatHelpers.js:550` et `char-sheet.js:810` lisent `hand_pref` sur `char_sheet` (colonne inexistante) au lieu de `char_identity.hand_pref` → toujours `'R'` par défaut en combat, quel que soit le choix réel du joueur — sprint futur
- **[CS7]** `SkillsPanel.jsx:135-141` (`activeMutations`) lit `charAdvantages.type==='MUTATION'`/`muta_numero` (schéma V2 n'a jamais eu ces champs, `char_advantages` a été remplacé par la migration 99) au lieu de `char_mutations` (vraie table) → Set toujours vide → **10 compétences** à prérequis `type:'MUTATION'` (dont `MAITRISE_DE_LA_FORCE_POLARIS`/`MAITRISE_DE_LECHO_POLARIS`) structurellement invisibles pour tout personnage, `[VÉRIFIÉ]` en base réelle Session 141 (suite 5) — même cause racine que `AdvantagesPanel.jsx` (`docs/PLAN_ADVANTAGESPANEL.md`), rayon d'impact plus large (10 compétences, pas seulement Polaris) — non prioritaire, ajouté au backlog

---

## PIÈGES CRITIQUES

**P1 — token.owner_id mort**
→ Toujours : `token.character_id → characters.user_id`.

**PE14 — coordonnées entités pos_y/pos_z inversés**
`pos_y` DB = profondeur (Z Three.js). `pos_z` DB = altitude (Y Three.js).
```js
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }  // Three.js → DB
```

**BUG C — weapon_inv_id ≠ item_id**
`ref_equipment_skill_assoc.item_id` FK → `ref_equipment.id`, pas `char_inventory.id`.
Pattern : `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id`.
Erreur → skillTotal = 0, assaut toujours raté.

**P51 — effectiveMalus formule exacte**
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = skillTotal + totalDiffMod + effectiveMalus
```

**PC27 — Entité ≠ PNJ**
`!token.character_id` = entité de décor. PNJ = `character.type === 'pnj'`.

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

**[R8-27] — socket.campaignId / socket.role dépendance implicite post-REWORK-08**
`socket.campaignId` et `socket.role` restent settées dans SESSION_JOIN. Les helpers de `socketCombat.js` (`resolveMeleeAction`, `resolveReloadAction`, `COMBAT_MELEE_DEFENSE_CONFIRM`) les utilisent via `io.fetchSockets()` pour retrouver des sockets tiers. Supprimer ces deux lignes de SESSION_JOIN casse le CaC PJ↔PJ silencieusement.

**P52 — `knex migrate:down`/`migrate:latest` (CLI) ciblent par tri lexical des fichiers, pas par `knex_migrations`**
Numéros de migration à largeur inégale (`99_...` vs `100_...`-`106_...`) trient mal en lexical (`'9' > '1'`) : `migrate:down` sans argument peut rollback la mauvaise migration silencieusement (vécu Session 134 — `99_char_advantages_v2.js` droppé au lieu de `106_...`). Pour tester un round-trip `up`/`down` d'une migration précise : **appeler directement les fonctions exportées du module** (import du fichier + `await mig.down(knex)` / `await mig.up(knex)`), jamais la CLI knex brute sur ce projet.

**P53 — nodemon auto-applique les migrations dès qu'un fichier est écrit dans `server/`**
`server/src/index.js:103` appelle `db.migrate.latest()` au démarrage. `nodemon` (aucun `nodemonConfig` dans `package.json`) watch tout `server/` par défaut → toute écriture de fichier (même un script de test `.cjs`) déclenche un restart qui auto-applique les migrations en attente, avant tout test contrôlé. Vécu Session 134 suite : collision de numéro de migration (107 déjà pris) + crash serveur temporaire (bookkeeping désynchronisé après renommage). Vécu à nouveau Session 135 : mes migrations 108/109 (encodage + stacking mutations) coexistent avec deux autres fichiers 108/109 du seeding carrières (numéros dupliqués, sans collision de fichier ni conflit fonctionnel — tables disjointes — mais numérotation trompeuse pour toute lecture future). **Procédure sûre** : écrire tous les scripts de vérification/test en `node -e` inline (Bash), jamais de fichier dans `server/`, pour éviter tout redéclenchement pendant les tests. Avant de vérifier le prochain numéro de migration libre : toujours `ls server/src/db/migrations/` (ne pas se fier uniquement à EN_COURS.md, qui peut être en retard sur un travail parallèle non documenté).

**P54 — jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable**
Conséquence directe de P53 : si nodemon a déjà auto-appliqué la migration entre son écriture et le test manuel, un second appel direct à `up()` traite des données **déjà correctes** comme si elles étaient corrompues. Vécu Session 135 : `decodeMojibake()` rappelée sur du texte déjà décodé — les caractères déjà propres (code point ≤ 0xFF) sont repoussés comme octet UTF-8 isolé, produisant une séquence invalide que Node remplace silencieusement par `�` (**aucune erreur levée**, donc aucun signal d'alerte avant relecture manuelle du résultat). 6 lignes `ref_mutations` endommagées avant qu'un caractère non mappable ne fasse enfin planter la boucle. **Procédure sûre** : toujours `SELECT` la table `knex_migrations` (`WHERE name = '...'`) avant tout appel manuel à `up()`/`down()` ; pour un round-trip, ne jamais enchaîner deux `up()` sans `down()` entre les deux.

**P55 — Compétences réservées `(X)` : accessibilité via profession, pas seulement via bonus d'origine**
`calcSkillCost` (`shared/polarisUtils.js`) bloque (`cost: Infinity`) toute compétence marquée `(X)` si `!isLearned && target>0`. `isLearned` doit couvrir TROIS cas, tous confirmés par la règle (aucun n'est un bug isolé, les trois manquaient dans `computeSkillAllocation` avant Session 139) : (1) `openedSkills.includes(skillId)` — déblocage explicite (Avantage Formation, Lot 5) ; (2) `(baseMastery[skillId] ?? 0) > 0` — un bonus d'origine positif prouve que le personnage la pratique déjà ; (3) **`isPro`** (listée par une carrière retenue) — `REGLE_CREATION.txt:1129-1132` : *« toutes les Compétences spéciales sont normalement inaccessibles... à moins d'être indiquées dans la description de l'une des Professions du personnage »*. Oublier le cas (3) reproduit exactement le bug Session 139 (Lot 2) : une `(X)` professionnelle sans bonus d'origine plante en `-Infinity`. Le malus « base -3 » du premier point investi (`REGLE_CREATION.txt:1115`) s'applique quand même dans les trois cas — ce n'est pas un blocage, juste un coût de départ plus élevé (1pt pour atteindre -3, avant de grimper normalement).
**Piège wiring associé** : `computeSkillAllocation` ne doit recevoir QUE les `skill_id` réellement modifiés par le joueur — jamais un remplissage de toutes les compétences affichées (board) avec leur valeur de base, sinon le calcul est déclenché inutilement pour des compétences jamais touchées. Le plafond d'une ligne non touchée se calcule séparément via `getSkillCap(skillId, ctx)` (indépendant du coût).

**P56 — `DICE_RESULT` n'inclut jamais `dieType` — tout consommateur hors `SessionPage` doit le fournir lui-même**
`server/src/socket/socketDice.js` calcule `dieType` via `parseDice()` mais **ne l'a jamais inclus** dans le payload `DICE_RESULT` émis au client (`{userId, username, color, formula, rolls, total, isCriticalSuccess, isCriticalFail, seed, timestamp, secret}` — `dieType` reste server-side, utilisé uniquement pour le lookup `dice_config`/critiques). `SessionPage` fonctionne quand même parce que `client/src/lib/useSessionSocket.js:62` **reconstruit `dieType` côté client depuis le texte de la formule** avant de le passer à `DiceRoller` — étape facile à manquer si on ne lit que le commentaire de `DiceRoller.jsx` (*« payload : { rolls, dieType, seed, timestamp } depuis DICE_RESULT »*, trompeur — decrit la forme voulue, pas ce que le serveur envoie réellement). Sans `dieType`, `DiceMesh.jsx` retombe silencieusement sur `DIE_GEOMETRY['d6']` (fallback explicite `diceMath.js:27`) — **aucune erreur levée**, juste le mauvais dé affiché. Vécu Session 140 : le tirage 1D10 du Lot 6 affichait un D6, repéré par Saar au test navigateur. **Procédure sûre** : tout nouveau composant qui monte `<DiceRoller>` hors de `SessionPage`/`Canvas3D.jsx` doit ajouter `dieType` lui-même au payload reçu de `DICE_RESULT` — en dur si la formule émise à cet endroit est fixe (ex. toujours `'1d10'`), sinon en le dérivant de `formula` comme `useSessionSocket.js`.

---

## CONVENTIONS

**Communication :**
- SR = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- Félicitations ≠ validation.
- **CaC = Corps à corps** (melee). **CC = Coup par coup** (mode de tir, tir unique distance).

**CSS (Session 76) :**
- Bouton → `className="btn"` ou variante (`.btn-ghost`, `.btn-danger`, `.btn-gold`, `.btn-icon`, `.btn-toggle`, `.btn-tool`)
- Badge → `className="badge badge-gm"` etc.
- `style={}` = layout/position calculé uniquement (width, flex, margin, top) — jamais visuel.
- Valeurs visuelles dynamiques → CSS custom property.
- Classes dans `index.css` Section 10 — modifier une classe = modifier partout.

**i18n :**
- Aucune string UI hardcodée. Toujours `useTranslation` → `t('section.cle')`.
- Source unique : `client/src/locales/fr.json`. Ajouter la clé avant de l'utiliser.
- Combat (12) + équipement (6) : hors scope — sprint dédié futur.
