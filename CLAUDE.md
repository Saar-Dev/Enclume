# CLAUDE.md — Projet Enclume
> Intégration commune `8393/8394` — 2026-07-15 ; dernière tête cousin : Session 141 (suite 31).

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
- `docs/WORKFLOW_FUSION.md` → obligatoire avant toute fusion, publication ou intervention sur
  l'instance commune `8393/8394`.
- `docs/FUSION_PROJET_COUSIN.md` → obligatoire pour résoudre un conflit combat / moteur monde.
- `docs/JOURNAL6.md` [[JOURNAL6]] (dernier `## Session N` uniquement) → si un bug précis nécessite l'historique d'une décision.
- **Fichiers domaine → chargés automatiquement** via `.claude/rules/` quand les fichiers source sont ouverts.

### Avant de coder
- Lire les fichiers concernés. Jamais de mémoire.
- Plan exact : lignes touchées, ce qui change, ce qui ne change pas.
- "Je code ?" une seule fois.
- Pour tout composant UI : inventaire exhaustif (chaque bouton/input/handler) avant "Je code ?".

### Pendant le développement
- **Run à vide autocentré obligatoire** à la fin de chaque étape.
- **Sessions analytiques (audit, investigation, debug) :** utiliser `docs/JOURNALTEMP.md` comme scratch pad. Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL6.md en fin de session.

### Après chaque tâche confirmée fonctionnelle
- Appender [[JOURNAL6]]
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
→ Nouveau terme métier / concept Enclume introduit (mécanique, table, pattern nommé) → STOP. `docs/VOCABULARY.md` vérifié/mis à jour ?
→ Créer un nouveau fichier `docs/*.md` → STOP. Quelle est sa responsabilité unique (`docs/RegleDocumentaire.md` Règle 14) ? Une info déjà documentée ailleurs → référencer, jamais dupliquer.

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
| `docs/FOUNDATION.md` | Hiérarchie des sources de vérité (LdB > FOUNDATION > VOCABULARY > SYSTEM > DOMAIN > MANUEL > PLAN) — lire si un conflit entre deux docs doit être arbitré |
| `docs/VOCABULARY.md` | Dictionnaire officiel (concepts métier, ambiguïtés, acronymes) — lire/mettre à jour dès qu'un terme métier ou concept Enclume est ambigu ou nouveau |
| `docs/RegleDocumentaire.md` | Contrat de classement documentaire (où ranger une nouvelle doc, règle "une responsabilité par document") — lire avant de créer un nouveau fichier `docs/*.md` |
| `docs/SYSTEME/*.md` | Spécifications techniques d'implémentation (lire sur demande via rules) |
| `docs/REGLE*.md` | Sources de vérité règles Polaris (LdB) — source absolue |
| `docs/MANUEL*.md` | Synthèse technique des règles (séquences, pipeline) |
| `docs/PLAN_*.md` | Planifications réalisées ou en cours — temporaire, archivé vers `docs/Old/` une fois le chantier clos (`RegleDocumentaire.md` Règle 10) |
| `docs/ARCHI_REWORK.md` | Bible des reworks actifs |
| `docs/ARCHI_REWORK_DONE.md` | Specs complètes des reworks achevés |
| `.claude/rules/*.md` | Règles domaine — chargées automatiquement (path-scoped) |

---

## ÉTAT COURANT — Session 141 (suite 31) (2026-07-13)

- **Intégration commune 2026-07-15 — PREMIÈRE FUSION DÉPLOYÉE.** Les dépôts actifs du cousin (`8193/8194`) et du
  moteur monde (`8293/8294`) restent inchangés. La branche `integration`, dans
  `/home/codex/Enclume-fusion`, fusionne la tête monde `92ae9a9` avec `origin/master` `bad0190` et
  est validée par le merge `1f048cd` sur `8393/8394`, base `vtt_fusion`. Ne jamais importer `origin/fusion-kiwi` dans le
  moteur v12. Références : `docs/WORKFLOW_FUSION.md` et `docs/FUSION_PROJET_COUSIN.md`.
- **Session 141 (suite 31) — Transfert du skin Wizard (Section 12, sci-fi premium/glassmorphism)
  vers le reste de l'interface ✅ CLOS, fonctionnel confirmé Saar ("testé et magnifique").** Demande
  hors chantiers en cours, exigence répétée deux fois par Saar : "architecture propre, pas de
  bricolage" / "tu peux coder UNIQUEMENT si architecture propre". **Constat avant tout code** : 3
  systèmes visuels coexistaient dans `client/src/index.css` — Section 3 (tokens de base, bleu
  désaturé `#5b8dee`), Section 10 (HUD chamfré `.btn`/`.badge`, grep confirme 25 fichiers
  consommateurs dont les fenêtres de combat — pas un système propre au Dashboard), Section 11
  (Combat Window System, palette tactique délibérément distincte, non touchée), Section 12 (skin
  Wizard, `--wiz-*` redéclarées en double sous `.wiz-page`/`.wiz-shell`). **Architecture retenue**
  (pattern primitives + alias sémantiques, pas de renommage massif) : les `--wiz-*` montent dans
  `:root` une seule fois ; les tokens génériques déjà consommés par des centaines de points dans
  toute l'app (`--bg-app`, `--color-primary`, `--text-primary/secondary/muted`, `--border-subtle/
  strong`, etc.) deviennent des **alias** vers ces primitives — zéro renommage ailleurs dans l'app.
  `.card`/`button`/`input` (Section 7) et `.btn`/`.btn-ghost`/`.btn-danger`/`.btn-gold`/`.btn-
  success`/`.badge`+variantes/`.btn-toggle` (Section 10) reskinnés : retrait du chamfer (`clip-
  path`), glass (`backdrop-filter: blur`) + halo cyan. Nouvelle classe **`.app-shell`** (fond dégradé
  + halo pulsé, réutilise l'animation `wizPulse` déjà existante) partagée par `.dashboard` et
  `CampaignSettingsPage.jsx` — pas une 3ᵉ duplication du même effet (Login garde son propre bloc,
  légitimement différent : filigrane logo occupant `::before`). **Étendu en 2 temps, chacun validé
  par Saar avant le suivant** : (1) `LoginPage.jsx`+`DashboardPage.jsx` (test) ; (2)
  `CampaignSettingsPage.jsx` + 5 `Section*.jsx` + `sharedStyles.js` (pages de configuration
  campagne). **6 vrais bugs trouvés et corrigés en marchant** (pas des features) : `--border-normal`
  inexistant (`DashboardPage.jsx` + `sharedStyles.js` ×4 — inputs sans bordure visible) ; `--bg-card`
  inexistant (`sharedStyles.js`) ; `.login-error` référencée en JSX mais jamais stylée ; `.login-
  title` avec un var CSS mort (`--font-family`) ; 6 occurrences de bleu `#5b8dee`/
  `rgba(91,141,238,...)` figées en dur, désynchronisées du token `--color-primary` dès le 1er lot.
  **Nettoyage architectural additionnel (lot Settings)** : suppression de `sharedStyles.section`/
  `optionBtn`/`optionBtnActive`/`btnSecondary`/`btnDanger` — dupliquaient `.card`/`.btn`/`.btn-
  ghost`/`.btn-danger`/`.btn-toggle` déjà existants ; un seul système de boutons/cartes dans toute
  l'app désormais. **Incident évité** : 2ᵉ serveur Vite de test lancé pour une vérification visuelle
  automatisée (Playwright) a produit une erreur `EPERM` sur `node_modules/.vite/deps` (signal de
  contention avec un serveur potentiellement déjà en cours) — process arrêté immédiatement plutôt
  que d'insister, `git status` reconfirmé propre. Vérification visuelle laissée à Saar en navigateur
  réel. **Hors scope confirmé/différé** : Section 11 (combat) intacte ; `ChangelogPanel.jsx` (100%
  styles inline hex, zéro token — reskin = réécriture complète) laissé tel quel ; `RegisterPage.jsx`
  (même bug `--border-normal`, fichier séparé sans classe partagée) non touché — candidats naturels
  d'une suite. **Testé** : équilibre CSS, ESLint sur les 9 fichiers touchés (0 nouvelle erreur,
  `git stash`/`git stash pop` à 2 reprises), grep de sweep, **parcours navigateur confirmé
  fonctionnel par Saar** sur les 3 zones (Login, Dashboard, CampaignSettingsPage 5 onglets). **Non
  testé** : chaque toggle de `SectionCharacterSheet.jsx` (11 options) cliqué individuellement — rendu
  visuel global confirmé, pas chaque interaction isolément. Détail complet : item "73."
  `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session 141 (suite 31)".
- **Session 141 (suite 30) — `docs/PLAN_MODING_PHASEB.md` Groupe 2 : Lunette de visée ✅ CLOS,
  fonctionnel confirmé Saar.** Suite de Groupe 1 (suite 28, clos). Plan déjà entièrement rédigé et
  tranché en amont — session de codage, tous les fichiers concernés relus avant code (dont
  `docs/REGLES/REGLESYSCOMBAT.md` section Tir visé, obligatoire avant toute mécanique combat).
  **Trou d'architecture trouvé et corrigé avant code** : le plan proposait de passer `portee` à
  `getAimIniCost`/`getAimBonusComp`, appelées en Phase 1 Déclaration (`socketCombatAnnouncement.js`)
  — or `portee` (`confirmedModifiers.portee`) n'existe que côté Phase 2 Résolution
  (`socketCombatResolution.js`/`socketCombatHelpers.js`). Rappel de Saar sur le principe des deux
  phases (Phase 1 = intentions déclarées sans valeur numérique, Phase 2 = résolution serveur) : le
  coût INI/bonus stocké à la Déclaration ne dépend que du niveau physique de la Lunette
  (`lunetteNiveau`) ; le plafond LdB par portée ("pas de lunette niv.>3 à portée courte") est
  désormais un **clamp en Phase 2**, dans `resolveAssaultAction` — nouvelle fonction
  `getEffectiveAimBonus(aimBonusComp, {lunetteNiveau, portee})`, `LUNETTE_PORTEE_CAP` reste donc
  réellement utilisé (pas écarté comme envisagé un temps avant cette correction). **Codé** :
  migration `142_ref_equipment_lunette_niveaux.js` (10 lignes niv.1-10 remplaçant la ligne générique
  `bonus="niv"`, `mod_slot='optique'`, `mod_requires_aim=true`, `price=1000×niv²`) ; `shared/
  combatExclusiveActions.js` (`getAimBonusComp`/`getAimIniCost` en miroir avec `lunetteNiveau`,
  `getLunetteNiveau`, `getEffectiveAimBonus`) ; `socketCombatAnnouncement.js` (fetch mods conditionnel
  + `lunetteNiveau` re-dérivé serveur, payload de déclaration inchangé) ; `socketCombatHelpers.js`
  (`resolveAssaultAction` : clamp Phase 2, réutilise `installedMods` déjà fetché pour Groupe 1) ;
  `inventoryService.js`/`battlemaps.js` (sous-requête scalaire `lunette_niveau` ajoutée à 2 fetchs
  existants, aucun nouvel appel réseau, évite le N+1 déjà écarté côté MJ) ; `combatSections.js`/
  `AssaultRangedPanel.jsx`/`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` (slider dynamique).
  **2 bugs réels trouvés et corrigés avant tout test** : régression d'écrêtage (`getAimBonusComp`/
  `getAimIniCost` renvoyaient `0` au lieu de clamper au plafond dès que les points demandés le
  dépassaient — cassait le comportement classique déjà en prod) ; migration 142 — `weight` (0.1
  source) omis des 10 nouvelles lignes par le premier `up()` (déjà auto-appliqué par nodemon, P53),
  corrigé + réparé directement en base, `down()` reconstruit avec les vraies valeurs vérifiées contre
  la source pré-migration (`tech_level=2`, `manufacturer="Trinicom"`, `rarity="15 (20)"` — pas des
  valeurs devinées). **Testé** : 21 scénarios purs, migration round-trip byte-identique (post-
  correctif), scénario complet en base réelle (fixture jetable, nettoyage vérifié 0 résidu) couvrant
  tout le pipeline installation→déclaration→résolution, `node --check` 0 erreur, ESLint 0 nouvelle
  erreur, SR, **fonctionnel confirmé Saar** ("test validé"). **Non testé** : parcours navigateur réel.
  **Incident git signalé, sans rapport avec le code** : session parallèle a committé (`4c258cc`, déjà
  poussé) la majorité des fichiers de ce chantier sous un message sans rapport — même pattern déjà
  documenté (suite 23), contenu vérifié intact par grep + tous les tests. **Prochain chantier :
  Groupe 4** (slot `logiciel`, 4 mécaniques à détailler individuellement). Détail complet : item "72."
  `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session 141 (suite 30)", `docs/PLAN_MODING_PHASEB.md`.
- **Session 141 (suite 29) — Interface d'ajout Avantage/Désavantage (octroi MJ narratif) + bug
  DELETE 500 pré-existant corrigé ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Demande Saar :
  le bouton "+" du bloc AVANTAGES & DÉSAVANTAGES ne permettait d'ajouter que Mutations/Force
  Polaris/Autres. **Point d'architecture trouvé avant tout code, soumis à Saar** : la route serveur
  `POST /advantages` existait déjà mais appelait `addAdvantage()` — la fonction du Wizard Step5, qui
  exige une ligne `char_pc_ledger` (sinon erreur 500) et débite réellement des PC. Pour un personnage
  déjà verrouillé, ce ledger est presque toujours épuisé (dette `pc_postcreation` jamais crédité) —
  l'octroi aurait échoué en pratique pour quasiment tout personnage réel. **Décision Saar : octroi
  narratif MJ, sans coût PC, MJ uniquement** — même philosophie que Mutations (Lot D)/Autres (Lot C).
  **Recherche/vérification exigée par Saar ("100%, aucune zone d'ombre") avant de coder** : confirmé
  qu'aucun autre appelant de `validateAdvantage` n'existe (ajout du 7ᵉ paramètre `skipBudgetCheck`
  sans risque de régression) ; confirmé par test réel que `max_desavantage_pc` (plafond de
  conception, 10 PC) devait rester actif même en sautant le budget (`sufficient_pc`, lui, spécifique
  au budget de création). **Codé** : `advantageConstraints.js` (`skipBudgetCheck`, saute uniquement
  `sufficient_pc`) ; `advantageService.js` (`grantAdvantage()` NOUVEAU — mêmes contraintes
  qu'`addAdvantage` moins le budget, aucun contact `char_pc_ledger`, retour aplati identique à
  `getAdvantages()` sans quoi la ligne fraîchement ajoutée se serait affichée vide côté client ;
  **bug latent trouvé et fermé avant qu'il ne devienne actif** — `removeAdvantage()` décrémentait le
  ledger inconditionnellement, corrigé pour ne le faire que si `acquired_during==='creation_step5'`,
  confirmé par le schéma migration 99 qui prévoyait déjà 4 valeurs possibles pour cette colonne) ;
  `char-sheet.js` (`POST /advantages` gagne `req.isGm`, bascule vers `grantAdvantage`) ; `ref.js`
  (`GET /char-ref/advantages` NOUVEAU, catalogue complet, même style que `/mutations`) ;
  `AdvantagesPanel.jsx` (4ᵉ bouton "Avantage/Désavantage", grille 2×2, étape liste groupée
  Avantages/Désavantages, grisée si déjà possédé) ; `fr.json` (6 clés). **Bug de production
  pré-existant trouvé en testant via une vraie requête HTTP (jamais fait avant pour cette route —
  les sessions précédentes testaient uniquement par appel direct de fonction, ce qui contourne
  Express)** : `DELETE /advantages/:id` faisait `const { reason } = req.body` sans garde — Express 5
  laisse `req.body` à `undefined` sans body/Content-Type, exactement le cas du bouton "×" existant
  (`api.delete(...)` sans body) → **500 à chaque clic, en production, depuis toujours, sans rapport
  avec ce chantier**. Le même fichier a déjà le bon pattern ailleurs (`req.body || {}`, route
  inventaire) — oubli isolé, corrigé (1 ligne). **Testé** : `node --check` 0 erreur, ESLint 0
  nouvelle erreur, `fr.json` valide, **tests via de vraies requêtes HTTP** (JWT signé pour un GM et
  un joueur réels de la même campagne) — catalogue (200, 79 lignes), octroi GM (201, forme aplatie
  correcte), joueur non-GM (403 confirmé), avantage déjà possédé/unique (rejeté), 2 désavantages
  cumulant >10 PC (rejeté, plafond confirmé actif malgré `skipBudgetCheck`), `adv_076` narratif
  (`is_fertile` basculé puis restauré), `DELETE` sans body (500 avant correctif, 200 après), ledger
  d'un personnage sans `char_pc_ledger` jamais requis ni touché, base vérifiée propre après chaque
  test, SR tout du long. **SR + parcours navigateur confirmé fonctionnel par Saar**. Détail complet :
  `docs/EN_COURS.md` item "71.", `docs/JOURNAL6.md` "Session 141 (suite 29)".
- **Session 141 (suite 27) — Bug GENOTYPE : compétence "Hybride" visible pour un personnage Humain
  ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Trouvé par Saar en testant le Lot 5 (suite 26,
  ci-dessous), hors périmètre de ce lot, traité en session séparée ("un bug à la fois").
  **Diagnostic `[VÉRIFIÉ]`** : `ref_skills.HYBRIDE` avait zéro ligne `ref_skill_requirements` —
  jamais gaté depuis sa création, visible pour tout le monde. Recherche élargie : `type='GENOTYPE'`
  avait zéro ligne dans toute la table, ce mécanisme n'a jamais été alimenté malgré son support déjà
  codé dans `SkillsPanel.jsx`. Les 232 descriptions de compétences vérifiées : `HYBRIDE` est la
  seule à mentionner une restriction de génotype/mutation — cas isolé. Texte LdB : accessible aux
  génotypes `HYB_NAT`/`GEN_HYB`/`TEC_HYB` **OU** à la mutation Amphibie — 4 alternatives (OR), alors
  que le moteur existant (`isVisible`) traite toutes les lignes en ET. **Recherche externe exigée
  par Saar avant tout code** ("aucun bricolage toléré, architecture sérieuse et robuste") : 5etools
  (compendium D&D5e figé, situation la plus proche d'Enclume) modélise ses prérequis de dons en
  2 niveaux (tableau externe = ET, tableau imbriqué = OU), schéma qui sert tout le contenu 5e depuis
  des années. PF2e (Foundry) a un système `Predicate` récursif, mais conçu pour du contenu
  communautaire arbitraire — déjà écarté pour ce projet ailleurs (`docs/PLAN_TIRVISE.md`/Lot 2
  `PLAN_MUTATION2.md`). Décision : modèle à 2 niveaux, prouvé suffisant (`HYBRIDE` = seul cas, un
  seul niveau d'imbrication requis). **Codé** : migration `140_ref_skill_requirements_or_group.js`
  (colonne `or_group`, text nullable, même convention que `ref_career_skills.choice_group` migration
  121, 4 lignes `HYBRIDE`) ; `shared/skillRequirements.js` (NOUVEAU, `areRequirementsSatisfied`,
  pattern `naturalWeapons.js` — une seule fonction pure, client+serveur) ; `SkillsPanel.jsx`
  (`isVisible` généralisé — MUTATION/ADVANTAGE/GENOTYPE passent par le même évaluateur ET/OU,
  SKILL_MIN reste séparé) ; `char-sheet.js` (`POST /skills/buy` étendu à GENOTYPE). **Testé** :
  `node --check` 0 erreur, ESLint 0 nouvelle erreur (retour exact aux problèmes préexistants), 9
  scénarios purs sur `areRequirementsSatisfied` (dont non-régression du cas Lot 5 à ligne isolée et
  un cas à 2 groupes indépendants — ET entre groupes confirmé), round-trip migration byte-identique,
  2 scénarios en base réelle sur "Mr sourire" (Humain sans Amphibie → rejeté ; avec Amphibie ajoutée
  temporairement → satisfait, résidu 0 après nettoyage), SR, **parcours navigateur confirmé
  fonctionnel par Saar** ("Hybride" disparue de sa fiche). **Non testé** : cas positif en navigateur
  (génotype `HYB_NAT`/`GEN_HYB`/`TEC_HYB` réel rendant "Hybride" visible). Détail complet :
  `docs/EN_COURS.md` item "70.", `docs/JOURNAL6.md` "Session 141 (suite 27)".
- **Session 141 (suite 26) — `docs/PLAN_MUTATION2.md` Lot 5 : Déblocage de compétences (`[CS7]`)
  ✅ CLOS, fonctionnel confirmé Saar en navigateur.** `SkillsPanel.jsx` (`activeMutations`) lisait
  `charAdvantages.type==='MUTATION'`/`.muta_numero` — champs inexistants en V2 (`char_advantages`
  n'a jamais eu ces colonnes depuis la migration 99) → Set toujours vide → 10 compétences
  structurellement invisibles pour **100% des personnages**, sans exception (vérifié `[VÉRIFIÉ]` : le
  check final s'applique même à une compétence déjà `is_learned=true`). 8 des 10 lignes
  `ref_skill_requirements` référençaient encore l'ancien identifiant V1 (`muta_XXX`, table `ref_
  mutations` V1 migration 38, supprimée migration 94) — remappées par correspondance de nom (sans
  ambiguïté, croisées contre les 45 lignes `ref_mutations` V2) vers le `mutation_id` V2 réel.
  **Erreur de donnée confirmée par Saar, à ne pas contourner** : les 2 lignes restantes
  (`MAITRISE_DE_LA_FORCE_POLARIS`/`MAITRISE_DE_LECHO_POLARIS`) référençaient `muta_029`
  ("Sensibilité au Polaris") — *"muta_029 NE DOIT PAS EXISTER"* (Saar) : cette mutation n'a jamais dû
  exister en V2, l'accès réel passe par l'Avantage `adv_079` "Force Polaris" (texte LdB déjà en base
  le confirme littéralement : *"pour développer cette Compétence, vous devez acheter l'Avantage
  Force Polaris"*). Bascule vers un nouveau type de prérequis `ADVANTAGE` (aucune contrainte DB ne
  l'empêchait, `type` est `text` libre). **2ᵉ trou trouvé en traçant `POST /skills/buy`** : seul
  SKILL_MIN était revalidé côté serveur — fermé (MUTATION/ADVANTAGE désormais toujours revalidés,
  jamais gatés par une option, à l'achat). **Analyse critique demandée par Saar avant confirmation
  navigateur** : les 10 compétences étaient invisibles pour 100% des personnages avant le fix (aucun
  risque de régression visible→invisible) ; anomalie de donnée pré-existante trouvée sur "Mr
  sourire" (`MAITRISE_DE_LA_FORCE_POLARIS` déjà `is_learned=true, mastery=2` sans `adv_079` ni
  mutation, déjà invisible pour lui avant le fix, reste cohérent après) ; `shared/careerSkills.js`
  (moteur Wizard) confirmé ne jamais lire `ref_skill_requirements` (gap pré-existant distinct, non
  aggravé, hors scope). **Hors scope, transféré en dette séparée** (`docs/BUGIDENTIFIE.md` POL1,
  décision Saar) : `adv_078` "Polaris non maîtrisé" doit déclencher un tirage aléatoire de 2
  pouvoirs Polaris sans jamais débloquer les 2 compétences Maîtrise — mécanique jamais construite.
  Migration `139_fix_ref_skill_requirements_mutations.js`. **Test réel effectué avec un vrai
  personnage** (Saar : *"aucune donnée précieuse en dev"*) : "Mr sourire" utilisé comme personnage
  de test — `adv_079` octroyé (insert direct, `addAdvantage()` exige un `char_pc_ledger` que ce
  personnage n'a pas) + mutation "Contagion" octroyée via le vrai `mutationService.addMutation()`.
  **2 problèmes trouvés par Saar en testant, hors scope de ce lot, repris en sessions séparées**
  (suites 27 et 29 ci-dessus). **Testé** : `node --check`, ESLint 0 nouvelle erreur, round-trip
  migration byte-identique, 5 scénarios en base réelle, SR, **parcours navigateur confirmé
  fonctionnel par Saar**. Détail complet : `docs/PLAN_MUTATION2.md` Lot 5, `docs/EN_COURS.md` item
  "69.", `docs/JOURNAL6.md` "Session 141 (suite 26)".
- **Session 141 (suite 28) — `docs/PLAN_MODING_PHASEB.md` Groupe 1 : bonus fixes optique +
  architecture des slots exclusifs ✅ CLOS, fonctionnel confirmé Saar.** Suite de `docs/PLAN_MODING.md`
  Phase A (item 63, terminée) — plan Phase B déjà entièrement rédigé et analysé en amont (architecture
  des slots + analyse critique déjà validées Saar avant cette session de codage). **Gap trouvé pendant
  la vérification finale ("sûr à 100%" demandé par Saar), corrigé avant code** : les 2 mods déjà
  installés en prod (Phase A) auraient eu `mod_slot = NULL` après l'`ALTER TABLE` sans backfill
  explicite — le garde-fou d'exclusivité ne les aurait jamais vus lors d'un swap futur, laissant deux
  mods du même slot coexister silencieusement (exactement le bug que l'architecture doit empêcher).
  Migration corrigée pour backfiller `char_inventory_mods.mod_slot` via jointure, en plus des 16
  lignes catalogue. Vérifié aussi avant d'écrire les `WHERE name = ...` : apostrophes typographiques
  (`’` U+2019, pas `'`) sur 4 des 16 noms (inspection code point par code point — un `UPDATE` à 0
  ligne matchée ne lève aucune exception) ; unicité globale des 16 noms dans toute la table
  (aucune collision hors périmètre) ; `ref_equipment.location` NULL confirmé pour les 16 lignes
  (P57 — stacking légitime au retour en inventaire lors d'un swap, aucun accessoire équipable).
  **Incident de numérotation en cours de route (P53)** : le numéro 140 pris entre-temps par une
  session parallèle (`140_ref_skill_requirements_or_group.js`, batch 105, déjà appliquée) — ma
  migration, auto-appliquée par nodemon sous le même préfixe "140" mais un nom de fichier différent
  (batch 106), renommée `141_ref_equipment_mod_slots.js` après coup, `knex_migrations` corrigé par
  UPDATE ciblé pour refléter le renommage sans déclencher de ré-exécution — même remédiation que
  l'incident P52 (Session 134). **Codé** : migration `141` — `ref_equipment.mod_slot`/
  `mod_requires_aim` (16 lignes catalogue, 4 slots `optique`/`logiciel`/`canon`/`poignee`, 3 items
  hors Phase B laissés à `NULL`) + `char_inventory_mods.mod_slot` (snapshotté, backfillé) +
  `UNIQUE(weapon_inv_id, mod_slot) WHERE mod_slot IS NOT NULL` (index partiel, pattern
  `uq_char_mut_no_sub`). `modingService.js` : `installMod` swap le slot dans la même transaction
  (retour en inventaire via nouvelle `returnModToInventory`, Coffre, stacking P57 ; edge case
  catalogue supprimé loggé et skip proprement) ; nouvelle fonction pure `calcWeaponModBonus`
  (Groupe 1 — cherche l'unique item `mod_slot='optique'` non `mod_requires_aim`, bonus entier valide
  sinon `{total:0}`). `socketCombatHelpers.js` (`resolveAssaultAction`, humanoïdes uniquement, pas le
  chemin drone) : fetch mods installés ajouté au `Promise.all` existant, `weaponModComp` ajouté à
  `totalModComp`, entrée `breakdown` nommant l'item précis. **Aucun changement client** : `MOD_
  INSTALLED` (déjà émis par la route existante) déclenche déjà un refetch complet de l'inventaire
  chez tous les clients connectés (`useCharacterSocket.js`, même mécanisme que
  `INVENTORY_ADDED/UPDATED/REMOVED`), et l'acteur voit le swap directement dans la réponse HTTP de
  `installMod`. **Testé** : migration round-trip `down`/`up` byte-identique (16/16 lignes `mod_slot`
  correctes, 2/2 mods déjà installés backfillés, index restauré) ; 6 scénarios en base réelle
  (fixture jetable sur un personnage réel, nettoyage vérifié à 0 résidu) — sans mod (`0`), 1 mod
  optique (`+4` exact), swap vers un 2ᵉ mod optique (ancien revenu en inventaire, un seul actif,
  `+2`), mod `logiciel` installé en parallèle (jamais compté, slot différent), swap vers la Lunette
  `mod_requires_aim=true` (`0`, jamais confondu avec un bonus plat), contrainte UNIQUE rejetant une
  insertion brute concurrente (`23505`) ; `node --check` 0 erreur, SR, **fonctionnel confirmé Saar**
  ("All tests OK"). **Non testé** : parcours navigateur réel (aucun changement client dans ce lot,
  rien de visuel à observer hormis le breakdown du jet). **Prochain chantier : Groupe 2 (Lunette de
  visée)** — `docs/PLAN_MODING_PHASEB.md`, entièrement tranché, réutilise l'architecture de slots
  déjà livrée (aucun nouveau prérequis). Détail complet : item "68." `docs/EN_COURS.md`,
  `docs/JOURNAL6.md` "Session 141 (suite 28)", `docs/PLAN_MODING_PHASEB.md`.
- **Session 141 (suite 25) — `docs/PLAN_MUTATION2.md` Lot 4 : Armure naturelle → Résistance aux
  dommages + Arme naturelle ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Suite du Lot 3
  (suite 23, clos). **Décisions Saar actées avant code** : `natural_armor` est une constante toujours
  active qui modifie directement RD, jamais une pièce de plus dans le mille-feuille ETQ de l'armure
  portée (aucune règle LdB sourcée pour combiner les deux — même logique que la suppression de
  `calcCarenceArmure`, suite 16) ; le gate "après saisie" (Crocs/Corne) réutilise le statut `grappled`
  déjà pleinement fonctionnel (`token_statuses`), "pas de narratif" (demande explicite Saar) ; la
  sélection d'arme naturelle est une option radio gratuite de plus (le choix d'arme au CaC est déjà
  sans coût par déclaration) — pas de nouveau mécanisme "changer d'arme" contrairement à la première
  proposition de Saar, corrigée après vérification du code réel. **Analyse critique demandée par
  Saar (recherche externe — PF2e Foundry, Open5e, D&D5e) avant tout code** : 3 décisions confirmées
  (Strikes mains-nues/naturelles/armes unifiés dans PF2e — confirme `skillId` inchangé ; schéma
  Open5e en chaîne plate — confirme `natural_weapon_formula VARCHAR` ; Grappled = condition booléenne
  sur la cible en D&D5e/PF2e — confirme l'absence de traçage du grappler) et **1 correction réelle** :
  le gate "cible saisie" a été déplacé de booléens inline vers `shared/naturalWeapons.js` (NOUVEAU),
  même patron que `shared/combatExclusiveActions.js` (Tir visé) — une seule fonction pure réutilisée
  client (tooltip) et serveur (rejet), pas de duplication d'une architecture déjà validée dans ce
  projet. **Vérification finale du pipeline avant tout code (exigée par Saar — "sûr à 100%") : 2 vrais
  trous trouvés et corrigés avant d'écrire une ligne de code** — `weapon_inv_id` n'est jamais transmis
  en direct à `resolveMeleeAction`, c'est une colonne réelle de `combat_actions` écrite en Phase 1 et
  relue en Phase 2 (le plan initial sautait cette chaîne à 4 maillons, corrigé par une 3ᵉ colonne
  `combat_actions.natural_weapon_char_mutation_id` + plomberie complète) ; la fenêtre MJ n'a pas la
  même architecture que la fenêtre PJ (endpoint batché `/combat-equipment` pour tout le roster, pas
  un fetch par personnage — un fetch par PNJ aurait réintroduit le N+1 que ce batch évite déjà,
  corrigé en étendant ce même endpoint). **Codé** : `getNaturalArmorMod` + 4 sites RD rebranchés ;
  migration `138` (2 colonnes `ref_mutations` + 1 colonne `combat_actions`, backfill des 4
  mutations) ; `shared/naturalWeapons.js` (NOUVEAU) ; `mutationService.getMutations()` étendu ;
  `battlemaps.js` (`/combat-equipment` + `naturalWeapons` par token) ; `resolveMeleeAction` (gate +
  formule, revalidation serveur complète) ; `socketCombatAnnouncement.js` (persistance) ;
  `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` (PJ et MJ/PNJ) ; `MeleeCombatPanel.jsx`
  (radios + tooltip). **Dette `[CHOC1]` ajoutée** : bonus LdB "+1D6 Choc si tête" de Corne non câblé
  — `calcResistanceArmure` calcule déjà un `prt` (protection_shock) jamais consommé par
  `damageService.js`, aucun pool de "dommages de Choc" distinct des dégâts physiques n'existe dans le
  pipeline actuel, chantier séparé hors scope de ce lot. **Point de règle soulevé par Saar en
  validant le parcours navigateur** (*"peut-on frapper avec Cornes/Griffes sans saisir
  l'adversaire ?"*) : texte LdB (`REGLE_MUTATION.md`) relu directement pour trancher — Corne/Crocs
  conditionnées à "après avoir effectué une saisie" (aucune autre mécanique décrite pour ces deux
  mutations dans le texte source), Griffes/Excroissance osseuse rétractable sans précondition.
  Lecture RAW confirmée correcte (déjà ce qui était codé), conservée telle quelle. **Testé** :
  `node --check` 0 erreur (10 fichiers), ESLint client 0 nouvelle erreur (`git stash`, +1 warning
  `exhaustive-deps` même classe qu'un pattern déjà existant), round-trip migration 138 réel en base
  réelle (byte-identique, P53/P54 respectés — `knex_migrations` vérifiée avant tout appel manuel), 8
  scénarios purs, 3 scénarios en base réelle en transaction annulée (dont un **rejet confirmé** sur
  une mutation forgée appartenant à un autre personnage), SR, **parcours navigateur confirmé
  fonctionnel par Saar** (PJ et MJ/PNJ). **Non testé** : cas limites de la section H un par un
  (validation globale) ; bonus "deux armes" combiné à une arme naturelle en conditions réelles
  (couvert par construction, pas re-testé manuellement). Détail complet : item "67."
  `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session 141 (suite 25)", `docs/PLAN_MUTATION2.md` Lot 4.
- **Session 141 (suite 24) — Fiche perso : détail de calcul en tooltip pour les attributs
  secondaires ✅ CLOS.** Suite du Lot 3 (suite 23, confirmé fonctionnel navigateur). Réutilise le
  pattern déjà en prod `iniTooltip` (texte multi-lignes `\n`, CSS `pre-line` déjà en place). `shared/
  polarisUtils.js` : `getAdvantageRowsForAttr`/`getAdvantageRowsForResistance` (variante "liste
  nommée", refactor `sumModByKey` sur un `filterModByKey` partagé, comportement inchangé). **Décision
  Saar (question posée)** : mutations en total agrégé (pas nommées — éviterait un fetch
  supplémentaire), avantages nommés (déjà disponibles côté client). `CharacterSheet.jsx` :
  `buildSecondaryTooltips` + 2 helpers locaux (attribut/résistance, pas un moteur générique pour 9
  stats fixes), 9 tooltips concernés (reaction, souffle, seuilEtour, seuilIncons,
  resistanceDommages + 4 résistances naturelles). `fr.json` : 3 clés génériques réutilisées. **Testé**
  : 4 scénarios réels, non-régression des fonctions refactorées, `node --check`, ESLint 0 nouvelle
  erreur, SR. **Non testé** : parcours navigateur (hover réel). Détail complet : item "66."
  `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session 141 (suite 24)".
- **Session 141 (suite 23) — `docs/PLAN_MUTATION2.md` Lot 3 : Résistance aux Dommages + Choc câblés
  ✅ CLOS, fonctionnel confirmé Saar en navigateur.** `shared/polarisUtils.js` :
  `getMutationModForResistance` (symétrique à `getAdvantageModForResistance`) + `calcResistanceDommages`/
  `calcSeuils` étendues (mutation + avantage, addition directe — correcte grâce au correctif du bug
  RD). **Consolidation trouvée avant de coder (analyse critique demandée par Saar)** : la branche PNJ
  auto-résolution CaC (`socketCombatHelpers.js`) dupliquait presque à l'identique
  `damageService.resolveTargetHit` — remplacée par un seul appel plutôt que d'y dupliquer une 2ᵉ fois
  le fetch mutations/avantages (même erreur que celle ayant nécessité 2 correctifs pour le bug RD).
  `resolveTargetHit` devient le seul point d'insertion RD/Choc pour toute la résolution de combat.
  Macros `seuil_etourdi`/`seuil_incons` complétées + nouvelle macro `resistance_dommages` (décision
  Saar). `CharacterSheet.jsx` rebranchée dans la même passe (fiche = résolution combat). **Testé** :
  11 scénarios purs, `node --check`, ESLint 0 nouvelle erreur, grep de sweep, vérification en base
  réelle (personnage réel "Squelette renforcé", delta +2 RD/+3 seuil confirmé), SR, **parcours combat
  réel en navigateur confirmé fonctionnel par Saar**. **Incident git signalé, sans rapport avec le code** : ce
  correctif et celui de suite 22 ont été committés sous le message "Moding Phase A" (session
  parallèle, `git add -A` sur dépôt partagé) — contenu vérifié intact, historique déjà poussé non
  réécrit. Détail complet : item "65." `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session 141 (suite 23)".
- **Session 141 (suite 21) — `docs/PLAN_MODING.md` Phase A (Customisation d'armes) ✅ TERMINÉE,
  8/8 étapes.** Chantier repris après levée de la pause du 2026-07-09 (Tir visé, bloquant pour la
  Phase B, clos Session 141 suite 17 — dette `TIRVISE` close). Analyse critique demandée par Saar
  avant codage : gap trouvé (anti-doublon `char_inventory_mods` protégé seulement côté applicatif,
  fenêtre de course avec un mod en stack ×2+) corrigé par une contrainte `UNIQUE(weapon_inv_id,
  equipment_id)`, précédent direct `uq_char_mut_no_sub` (migration 109). Étape 0 (extraction
  `server/src/services/inventoryService.js` depuis `char-sheet.js` — 6 routes + 4 helpers, aucun
  changement de comportement) codée et **confirmée fonctionnelle par Saar** avant de poursuivre.
  Étapes 1-7 enchaînées ensuite : migration `137_char_inventory_mods` (136 déjà pris par une
  session parallèle, P53 reconfirmé une 3ᵉ fois), `modingService.js` (`getModingState`/`installMod`),
  `WS.MOD_INSTALLED`, routes `GET/POST /:characterId/moding/*`, handler socket client
  `onModInstalled`, `ModingWindow.jsx` (NOUVEAU, fenêtre flottante pattern `TradeWindow.jsx`), bouton
  "Customisation" dans `InventoryPanel.jsx` (gaté `canEdit` — owner OU GM, pas `isGm` seul comme le
  bloc "Ajouter" voisin, correction faite en codant). **Testé à 3 niveaux** : service (10 scénarios
  réels, dont vérification directe que la contrainte UNIQUE rejette un insert brut en double —
  `23505`), HTTP réel (JWT signé), **navigateur réel (Playwright headless piloté, capture d'écran
  avant/après)** — installation d'un mod confirmée visuellement, inventaire rafraîchi en temps réel
  sans reload. Aucune régression trouvée sur le reste de l'inventaire (13 scénarios non-régression
  Étape 0). **Non testé** : parcours navigateur rejoué manuellement par Saar (Étapes 1-7 validées
  par l'automate seulement), compte joueur non-GM. Détail complet : `docs/PLAN_MODING.md`,
  `docs/JOURNAL6.md` "Session 141 (suite 21)".
- **Session 141 (suite 22) — Bug RD (Résistance aux Dommages) : signe inversé corrigé
  ⚠️ CLOS PARTIEL.** Trouvé en ouvrant `docs/PLAN_MUTATION2.md` Lot 3 : lecture obligatoire de
  `docs/REGLES/REGLESYSCOMBAT.md` avant mécanique combat — la règle dit d'**ajouter** le modificateur
  de Résistance aux Dommages aux dégâts ("un personnage fort et résistant va réduire les dégâts,
  faible... aggravés"), le code (`damageService.js`/`socketCombatHelpers.js`, duplicata inline) le
  **soustrayait**. `RD_TABLE`/`calcResistanceDommages` (`shared/polarisUtils.js`) hors de cause —
  croisées correctes contre la table brute LdB (`docs/Old/AttributsTooltips.md`), le bug est dans la
  formule de consommation, pas la donnée (même principe que la correction Résistances naturelles,
  suite 19 : corriger la pièce qui diverge de la source vérifiée). **`[VÉRIFIÉ]` par exécution réelle
  avant/après** (`node -e`, 3 profils FOR/CON) : formule fautive donnait un personnage fort (18/18)
  plus touché (14 dégâts nets) qu'un faible (4/4, 6 dégâts) à dégâts bruts identiques — corrigé,
  désormais fort=6/faible=14, conforme à la règle. **Saar a explicitement demandé confirmation de la
  robustesse de la solution avant codage** (pas de bricolage) — confirmé que le correctif doit vivre
  dans la formule (pas la table, seule pièce vérifiable contre le livre et utilisée en affichage
  fiche lecture-seule). Corrigé aux 2 sites réels (`degautsBruts - etq - rd` → `+ rd`), doc alignée
  (`docs/SYSTEME/COMBAT.md`, `docs/MANUELSYSCOMBAT.md`, `docs/STRUCTURE_SYSCOMBAT.md`). **Effet de
  bord positif** : lève le "signe non trivial" ouvert dans `PLAN_MUTATION2.md` Lot 3 pour
  `adv_018`/`adv_030`/`adv_060` — le résolveur générique déjà construit pour les Résistances
  naturelles (`getAdvantageModForResistance`) s'applique désormais tel quel à RD, sans inversion par
  `type`. Testé : instrumentation réelle avant/après, `node --check`, grep de sweep (aucun 3ᵉ site),
  SR. **Non testé** : parcours combat réel en navigateur — laissé non testé sur décision explicite de
  Saar pour enchaîner directement sur le Lot 3. Détail complet : item "64." `docs/EN_COURS.md`,
  `docs/JOURNAL6.md` "Session 141 (suite 22)".
- **Session 141 (suite 20) — Bonus féminin : règle fixe -2 FOR/+1 COO/+1 PRE + revalidation du
  bascule Sexe ✅ CLOS.** Demande Saar : la mécanique `feminin_bonus` (remise forfaitaire invisible
  sur COO/PRE, Session 141 suite 14) n'est pas compréhensible — simplification en règle fixe, sans
  choix de répartition. **Antécédent relu avant tout code** : une 1ʳᵉ tentative de correctif direct
  sur COO/PRE (avant la remise) avait été abandonnée (plafonnait le spinner, cassait l'achat PC
  normal au-delà du bonus) — vérifié que la répartition fixe demandée par Saar élimine cette source
  de complexité, aucun plafond de spinner recréé. **Vrai bug trouvé en testant le plan (captures
  Saar)** : basculer Sexe M↔F après avoir déjà réparti des points changeait silencieusement le
  budget sans jamais revalider — `Step1Attributes.jsx` ne passait jamais par `validateStep1` (le
  serveur seul l'appelait), et `validateStep1` lui-même ne rejetait jamais un budget dépassé (G1
  traitait "dépassé" et "non dépensé" pareil). `shared/polarisUtils.js` :
  `getAttributeBase(attrId, isFeminin)` (FOR:5, COO:8, PRE:8) remplace `getFemininBonusDiscount` +
  **G1bis** (budget dépassé = erreur dure). `Step1Attributes.jsx` : gate "Suivant" alignée sur le
  pattern déjà établi par `CareersAllocator.jsx`/Étape 4 (`validation = useMemo(() =>
  validateStep1(...))`), `handleSetFeminin` redevenu trivial. **Bug trouvé en testant ma propre
  correction** : valeur hors bornes (>20 après bascule) → `COST_LOOKUP` sans entrée → `NaN` dans le
  HUD — corrigé (`—` affiché). `Step2Genotype.jsx` : angle mort fermé au passage (ignorait
  `femininBonusEnabled`). Testé : lint 0 nouvelle erreur, scénarios `node -e` (G1bis + G3 sur
  bascule), **vérification en base réelle** (64 fiches non verrouillées, 0 en dépassement ; 0
  personnage féminin en cours avec l'option active actuellement). SR + **fonctionnel confirmé
  Saar**. Non testé : parcours navigateur réel du bascule Sexe. Détail complet : item "62."
  `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session 141 (suite 20)".
- **Session 141 (suite 19) — Résistances naturelles (poison/maladie/radiation/drogue) câblées +
  Attributs secondaires manquants ajoutés sur la fiche perso ✅ CLOS.** `docs/PLAN_RESNAT.md`.
  Recherche pro exigée par Saar (Foundry Active Effects, PF2e IWR) avant tout code a fait rejeter un
  premier plan (inversion de signe à l'exécution selon `type`, rustine) au profit d'une correction à
  la source. **Bug de données réel trouvé en base, croisé avec le texte LdB exact** : 6 lignes
  `ref_advantages`/`ref_mutations` ("Résistance naturelle augmentée", "Résistance naturelle" ×4,
  "Purulence", "Contagion") stockaient un delta positif pour un effet censé améliorer la résistance —
  avec `Seuil = Intensité − Modificateur` (formule confirmée par Saar, Test différé à un chantier
  futur), ça dégradait le Seuil au lieu de l'améliorer. Cas le plus parlant : "Contagion" (immunité
  totale, sentinelle 9999) aurait rendu un personnage immunisé **systématiquement en échec**, l'exact
  opposé de la règle. Migration `136` (NOUVEAU) corrige les 6 lignes + normalise la divergence de clé
  `"drug"`(avantages)/`"drugs"`(mutations). 0 personnage réel n'avait jamais acquis ces lignes — zéro
  régression. `shared/polarisUtils.js` : `getAdvantageModForResistance` (résolveur générique,
  symétrique à `getAdvantageModForAttr` du Lot 2, aucune inspection de `type` — la donnée porte son
  signe). 4 nouvelles sources de macro (`resistance_poison/maladie/radiation` + fix de
  `resistance_drogues`, buggée depuis toujours — exposait le NA brut au lieu du modificateur réel).
  **Addendum même session** : Saar signale l'absence de Résistance aux dommages/Résistances
  naturelles/Souffle sur la fiche perso (vs liste LdB p.114 attributs secondaires) — 5 fonctions
  (`calcResistanceDommages`/`calcResistanceNaturelle`/`calcResistanceDroguesInput`/`calcSeuils`/
  `calcSouffle`) consolidées de `charStats.js` (serveur seul) vers `shared/polarisUtils.js` (même
  principe que `calcREA` Lot 2), tous les appelants serveur redirigés (jamais de transit par
  `charStats.js`, leçon Lot 2). `CharacterSheet.jsx` : 6 nouveaux `<SecondaryField>` ajoutés **après**
  l'existant (rien retiré, consigne explicite Saar). **Décision de scope délibérée** : "Résistance aux
  dommages" affichée en valeur de base seulement (FOR+CON, sans mutation/avantage) — la résolution de
  combat réelle (`resolveTargetHit`/`resolveMeleeAction`) ne les consomme pas encore (Lot 3 de
  `docs/PLAN_MUTATION2.md`, non traité) ; même raison pour ne pas toucher au modificateur d'avantage
  sur "Choc" (`adv_030`/`adv_060`). **Testé** : round-trip migration réel (byte-identique), 9
  scénarios unitaires purs, test bout-en-bout en base réelle (personnage existant, transaction
  annulée, 0 résidu — mutation+avantage combinés donnent bien un Seuil amélioré, stacking vérifié),
  non-régression numérique des 5 fonctions déplacées, ESLint client 0 nouvelle erreur (confirmé
  `git stash`), SR (`/api/health` 200). **Parcours navigateur confirmé fonctionnel par Saar**
  (capture d'écran fiche réelle : 6 nouveaux champs corrects). **Non testé** : parcours navigateur des
  macros (`resistance_poison`/etc.) — seule la fiche a été vérifiée visuellement. **Passe UI/UX même
  session ✅ CLOS (3 itérations, toutes confirmées par Saar)** : mockup interactif → hybride
  cartes/liste choisi ; capture fiche complète → vraie cause de la longueur identifiée (bloc
  Compétences ~60 lignes, pas les Attributs secondaires) → **accordéon sur 6 blocs** (En-tête reste
  ancre fixe) + **mémorisation par TYPE de fiche** (`localStorage` `owned`/`other` via `isOwner`, pas
  par personnage — "mes fiches perso ne s'affichent pas pareil que les autres") + **Attributs
  secondaires en 2 colonnes** (2 listes indépendantes, écart assumé vs maquette entrelacée, jugé plus
  lisible) ; puis Allures regroupées avec Réaction/Initiative + séparateur discret (`separator` sur
  `SecondaryField`, robuste au retour à la ligne). `blockOpen` rechargé via
  `useEffect([isOwner, characterId])` (composant sans `key={characterId}`, dette Session 141 suite 9).
  Testé à chaque itération : ESLint 0 nouvelle erreur, `fr.json` valide, SR + **parcours navigateur
  confirmé fonctionnel par Saar** ("Conforme"). **Chantier suivant identifié : `PLAN_MUTATION2.md`
  Lot 3** (Résistance aux Dommages + Choc — scope déjà recentré, pas détaillé ligne à ligne). Détail
  complet : `docs/PLAN_RESNAT.md`, `docs/JOURNAL6.md` "Session 141 (suite 19)".
- **Session 141 (suite 17) — Tir visé (LdB p.227-228) + framework Actions Exclusives ✅ CLOS.**
  Chantier ouvert par une demande de planification pure ("fonctionnalité qui semble manquer"), mené
  en passes validées une à une : recherche externe (Bob Nystrom, *Game Programming Patterns* — la
  légalité d'une action doit être encapsulée dans sa propre définition ; trait "Flourish" de
  Pathfinder 2e/Foundry VTT — même mécanique, confirme qu'un registre léger est le bon dimensionnement,
  **pas** un moteur de règles généraliste type "Rule Elements" PF2e, qui existe spécifiquement pour du
  contenu communautaire — pas notre cas) → plan (`docs/PLAN_TIRVISE.md`) → **2 analyses critiques
  demandées par Saar avant tout code** (7 puis 3 points trouvés et corrigés : mauvais numéro de
  migration prévisionnel, type de colonne faux, gap `[INCONNU]` sur `current_initiative ≤ 0` non géré
  — dette `INI3` ajoutée séparément, duplication de check entre deux fonctions) → backend → client.
  `shared/combatExclusiveActions.js` (NOUVEAU) : évaluateur pur, pattern `careerEligibility.js` —
  `getAimIneligibilityReasons` (liste de raisons, alimente le tooltip UI) dont `isAimEligible` dérive
  (jamais dupliqué) + `isExclusiveDeclaration` (registre générique d'actions exclusives, peuplé pour
  Tir visé seul — Charge/Rafale longue le rejoindront dans leurs propres sessions futures, leurs
  bonus mécaniques existant déjà, seule l'exclusivité manque). **Règle centrale, trouvée en
  discussion avec Saar** : *"tu ne vises que si tu ne fais que ça"* — dégainer/changer de mode de tir
  est une transition d'état au même titre qu'un déplacement, résout mécaniquement en une seule règle
  l'immobilité, l'incompatibilité avec Précipiter et avec Rechargement (au lieu de trois cas
  particuliers séparés). **Piège explicitement évité** : "exclusive" (générique) ≠ "immobile" — Charge
  exige un déplacement, un flag générique aurait cassé Charge à sa correction future — gardés
  séparés par construction. Migration `134` (`combat_actions.aim_bonus_comp`, smallint nullable,
  miroir `fire_mode_bonus_comp`) + `socketCombatAnnouncement.js`/`socketCombatHelpers.js` (validation
  serveur + Seuil). **Collision évitée avec un agent concurrent** : codage de `resolveAssaultAction`
  suspendu en trouvant `totalModComp`/`breakdown` en cours de modification non committée par un autre
  agent (correctif double-comptage bonus double-arme), repris seulement après confirmation Saar.
  Client (×2 fenêtres PJ `CombatActionWindow.jsx` + MJ `CombatGmDeclareWindow.jsx`) : inventaire UI
  exhaustif fait avant codage (demande explicite Saar) — nouvelle option "Tir visé" dans
  `AssaultRangedPanel.jsx` (3ᵉ choix entre "Tir simple"/"Tir à répétition"), grisée avec tooltip
  listant les raisons précises d'inéligibilité (demande Saar : *"Action impossible car - X"*).
  **1 correctif annexe trouvé en chemin** : commentaire JSDoc faux prétendant `isDualWield` figé à
  `false` côté MJ — vérifié faux par lecture du code réel, câblage déjà pleinement fonctionnel,
  seule la documentation était obsolète (corrigée, zéro changement de comportement).
  **Trouvaille finale de Saar, hors scope confirmé** : *"le Tir visé, ça fonctionne sur une
  localisation visée ?!"* — "Viser une Localisation précise" (LdB p.229-230) est une règle
  **distincte** (malus pour choisir la zone touchée au lieu du 1D20 aléatoire, aucun lien mécanique
  avec Tir visé), déjà documentée et jamais implémentée sous l'identifiant **`COM9`**
  (`docs/BUGIDENTIFIE.md`) — suite possible, non tranchée à la clôture de cette session.
  **Dette `INI3` ajoutée** (`docs/BUGIDENTIFIE.md`, cluster H) : `current_initiative ≤ 0` non géré
  côté serveur (gap systémique pré-existant, documenté par `MANUELSYSCOMBAT.md` §3, Tir visé
  augmente juste la probabilité de le déclencher — pas corrigé dans ce chantier).
  **Testé** : `node --check` (backend), 10 scénarios unitaires `isAimEligible`/
  `getAimIneligibilityReasons`, test réel de bout en bout sur `resolveAssaultAction` (fixture
  jetable en base réelle, nettoyage vérifié — la fonction n'acceptant pas de transaction), round-trip
  migration réel (P52/P53/P54 respectés), ESLint client (`git stash`/`pop` : 14 problèmes
  pré-existants confirmés inchangés, 0 nouvelle erreur), **SR + parcours navigateur confirmé
  fonctionnel par Saar**. **Non testé** : scénarios de rejet `COMBAT_DECLARE_ERROR` en conditions
  réelles navigateur (fonction pure et cas nominal seuls vérifiés en direct) ; combinaisons Tir
  visé + Précipiter/Rechargement en conditions réelles (couvertes par construction, pas re-testées
  manuellement scénario par scénario). Détail complet : `docs/PLAN_TIRVISE.md`,
  `docs/JOURNAL6.md` "Session 141 (suite 17)", `docs/MANUELSYSCOMBAT.md` §6.4 (mis à jour).
- **Session 141 (suite 16) — Audit combat suite à 4 signalements d'agents externes + `ref_equipment_
  skill_assoc` reconstruite ✅ CLOS.** Point de départ : deux lots de rapports d'agents externes
  signalant 4 problèmes potentiels côté combat/résistances ("on a tout pété" — Saar). Chaque
  affirmation vérifiée indépendamment (requêtes DB réelles + lecture de code + historique Git),
  aucune prise pour argent comptant. **1 bug majeur réel, confirmé et élargi** : `ref_equipment_
  skill_assoc` (table "compétence d'utilisation" consommée par `resolveAssaultAction`/
  `resolveMeleeAction`, distincte de `ref_equipment_skills` "compétences boostées/requises" — même
  schéma, jamais fusionnées, jamais consommée en jeu, voir dette `[EQSKILLS1]`) n'avait **jamais été
  peuplée par aucun seed/migration** depuis sa création (migration 48, Session 47) — recherche Git
  exhaustive (`git log -S`) : aucun commit n'a jamais inséré de données dedans, les 25 lignes en base
  provenaient de tests manuels ponctuels via l'API admin (`routes/equipment.js`, jamais reliée à
  aucune UI client). Trou bien plus large que rapporté : quasi-totalité des catégories d'armes
  touchée (pas seulement "Armes de poing"), et non uniforme (6 compétences différentes dans la seule
  catégorie déjà complète "Arme à énergie", jugement arme par arme, jamais une règle catégorie→
  compétence). **1 fausse piste initialement écartée, puis réouverte et confirmée** : `calcCarenceArmure`
  non gaté par `encumbrance_enabled` — d'abord classé "infirmé" (carence présentée comme règle de
  base LdB Session 56, distincte de l'encombrement, règle maison étiquetée comme telle) sur la seule
  foi d'un tag `(LdB)` non sourcé dans `docs/Old/JOURNAL2.md:5053` (aucune page citée, contrairement
  à la quasi-totalité des autres entrées de ce journal). Recherche exhaustive relancée sur exigence
  Saar (grep complet `docs/REGLES/*` — REGLESYSCOMBAT.md, REGLEARMURE.md, REGLE_CREATION.txt,
  REGLECOMPETENCE.md) : **zéro citation, zéro page, aucune trace textuelle** de "carence"/"min_str"/
  "Force minimum" dans le LdB. Mécanique jugée non sourcée → **`calcCarenceArmure` effacée
  entièrement** (fonction, 2 sites d'appel CaC+distance, breakdown, logs debug, doc associée) —
  colonne `ref_equipment.min_str` conservée (donnée brute réutilisable, indépendante du calcul
  fabriqué). "Résistances naturelles"/Choc — constats exacts mais **déjà documentés** dans
  `docs/PLAN_MUTATION2.md` Lot 3 (ouvert le même jour), bloqués sur un `[INCONNU]` documentaire réel,
  chantier séparé non touché ici. **Correction** : Saar a fourni `docs/ExtractCOMP.md` (extraction de
  la vraie colonne "Compétence associée" du Google Sheet source, 139 armes — distincte de la colonne
  "Compétences / Attributs" qui alimente déjà `ref_equipment_skills`, confusion initiale entre les
  deux colonnes clarifiée en cours de route). Migration `135_ref_equipment_skill_assoc_weapons.js`
  (NOUVEAU) : 130 nouvelles paires + 3 corrections confirmées Saar hors périmètre du fichier (TMP II,
  Canon à infrasons, et **Lance-flammes** : Arme spéciale CONTACT FOR/COO → Arme spéciale DISTANCE
  COO/PER, erreur de mémoire proposée par Saar lui-même puis corrigée après recoupement avec
  `REGLECOMPETENCE.md` p.191, qui cite littéralement le lance-flamme comme exemple de la compétence
  distance). **Rigueur de vérification ×3 exigée explicitement par Saar** ("la faiblesse d'un LLM
  c'est sa mémoire") : aucune donnée retapée à la main — un premier script générateur en `node -e`
  inline a produit une vraie erreur de citation shell (backtick interprété par bash avant JS),
  détectée et écartée avant écriture, régénérée proprement via un script fichier (hors `server/`).
  Triple recoupement automatisé (nom↔base 139/139, libellé↔`ref_skills.id` 11/11, proposé↔existant),
  nodemon a auto-appliqué la migration dès l'écriture (P53 confirmé en action, faux négatif de
  diagnostic corrigé en cours de route), **état final vérifié 154/154 paires, 0 écart**, round-trip
  `down()`→25→`up()`→154 réel par appel direct des fonctions du module (P52). **Dette `[EQSKILLS1]`
  ajoutée** : `ref_equipment_skills` jamais consommée en logique de jeu (seulement écrite/relue par
  l'API admin), 1 item (TMP II) avec une entrée visiblement erronée. Testé : recoupements
  automatisés + round-trip réel. Non testé : parcours combat réel en navigateur (assaut arme de
  poing/CaC avec un personnage réel). Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 16)".
- **Session 141 (suite 15) — `docs/PLAN_VAULT.md` : Coffre (Vault) personnel ✅ TERMINÉ, Étapes 0
  à 7 codées et testées.** Conversation dédiée entière (analyse critique demandée deux fois par
  Saar avant tout code, recherche pro systématique — Roll20 Character Vault, Foundry Compendium
  Packs, motif SQL "exclusive arc"). Nouvel espace personnel de stockage de personnages,
  indépendant de toute campagne : transfert = **copie**, jamais un déplacement. Migrations `129`
  (`vaults` + `characters.vault_id`, invariant XOR imposé par contrainte SQL) / `130`
  (`vault_transfer_requests`, index unique partiel anti-doublon). `vaultService.js` :
  `COMPANION_REGISTRY` (extensible par type — PJ/PNJ partagent l'arbre `char_sheet`, drone son
  propre arbre, prêt pour exo-armure/vaisseau plus tard sans réécrire le clonage) + garde-fou
  anti-dérive (compare la liste codée en dur à une vraie requête `information_schema` à chaque
  clonage — toute future table liée à un personnage non enregistrée casse bruyamment au lieu de
  perdre une donnée en silence). Routes `/api/vault/*` + 1 route dans `char-sheet.js`. UI complète
  (Étape 7, 4 lots) : carte "Coffre" en première position de la grille Dashboard, page dédiée,
  bouton d'envoi dans les fenêtres personnage/drone, sélecteur de campagne + badge "En attente",
  onglet "Joueurs" de `CampaignSettingsPage.jsx` enfin rempli (désactivé depuis Session 131).
  **4 vrais bugs trouvés et corrigés avant tout impact utilisateur**, aucun via une simple relecture
  passive : le garde-fou anti-dérive avait lui-même un angle mort (cherchait des colonnes nommées
  `character_id`, aurait raté une vraie FK nommée différemment) ; `characters.type` a 3 valeurs
  (pj/pnj/drone), pas 2 — un forçage en dur aurait corrompu un drone cloné ; un personnage Wizard
  non finalisé ne doit pas pouvoir rejoindre le Coffre (resterait bloqué sans mécanisme de reprise) ;
  un clone importé en campagne doit être explicitement reverrouillé (`wizard_locked_at`), sans quoi
  invisible dans la liste sans aucune erreur. **Testé à chaque étape** : scénarios en base réelle
  (transactions annulées) puis, pour l'UI, par un vrai navigateur piloté (Playwright, JWT signé,
  cookie réel, captures d'écran) — parcours complet confirmé de bout en bout. Nettoyage systématique
  vérifié après chaque test ; activité concurrente réelle détectée en fin de session (brouillons
  créés en temps réel) — non touchée, seuls les artefacts de test identifiés avec certitude
  supprimés. **Dette `[CSPLAYERSTAB]` ajoutée** (avertissement React préexistant, cosmétique, sans
  rapport avec ce chantier). **Non testé** : bouton "Refuser" pas recliqué séparément (symétrique à
  "Approuver", déjà testé côté service) ; parcours équivalent sur `DroneWindow.jsx` (code identique
  à `CharacterWindow.jsx`, vérifié par lecture + lint seulement) ; contenu non-personnage du Coffre
  (hors scope, extension future prévue). Détail complet : `docs/PLAN_VAULT.md` (toutes les étapes
  avec leurs tests), item "57." `docs/EN_COURS.md`, `docs/JOURNAL6.md` "Session Coffre (Vault)".
- **Session 141 (suite 14) — 4 correctifs enchaînés, chacun trouvé en testant le précédent.**
  Point de départ : bug signalé par Saar — supprimer un character ne supprimait jamais ses tokens
  sur les battlemaps, ils restaient en combat sans fiche liée. **(1) `server/src/lib/
  tokenLifecycle.js` (NOUVEAU)** : `removeTokens()` centralise nettoyage Redis + suppression DB +
  broadcast `TOKEN_DELETED`, réutilisé par `characters.js`/`tokens.js`/`battlemaps.js` (2ᵉ trou
  identique trouvé en vérifiant : la suppression de battlemap avait le même angle mort) — testé par
  vraies requêtes HTTP contre le serveur réel (JWT signé), Redis + `combat_roster` (CASCADE)
  vérifiés avant/après. **(2) Migration `132`** : en testant, Saar a signalé des tokens visibles sur
  la carte sans fiche personnage dans la sidebar — investigation a révélé que 9 personnages de
  "Camp LOCALE" avaient chacun **2 lignes `char_sheet`** (bug historique, `character_id` n'a jamais
  eu de contrainte `UNIQUE` depuis la migration 36) avec des données réellement divergentes
  (attributs, compétences, sols). Dédoublonnage déterministe (règle uniforme, données de dev — pas
  d'arbitrage au cas par cas, décision Saar) + contrainte `UNIQUE` ajoutée. **(3) `reconcileCreation`
  gagne `finalize`** : la vraie cause de la disparition en sidebar — `handleTerminate` faisait 2
  appels réseau non-atomiques (`reconcile` puis `lock`), toute coupure entre les deux laissait la
  fiche `complete` mais jamais verrouillée pour toujours. Fusionnés en un seul appel atomique
  (réutilise `lockWizard(sheetId, trx)`, déjà construit pour le Coffre — jamais recodé de zéro).
  **Migration `133`** : backfill `wizard_locked_at` pour 20 fiches historiques (critère dérivé du
  code : `creation_state IS NULL` ou `'complete'`, jamais les vrais brouillons `draft_step0`).
  **(4) Bonus féminin Coordination/Présence** : dernier test navigateur de Saar a bloqué toute
  répartition en Présence — investigation a révélé un bug de Session 137 jamais vu jusqu'ici, la
  règle plafonnait la **valeur finale** de COO/PRE au lieu de remiser le **coût PC** (mauvaise
  lecture de "les valeurs de base... modifiées", `REGLE_CREATION.txt:293-296`). Saar a proposé de ne
  pas ajouter de nouvelle UI (comme pour Force) — vérifié mathématiquement qu'une remise forfaitaire
  dans `calcTotalCost` est équivalente à un décalage de base par attribut pour toute répartition :
  **zéro nouvel état, zéro nouvelle UI**, les 3 éditions précédentes sur `Step1Attributes.jsx`
  annulées intégralement. **✅ CLOS, fonctionnel confirmé Saar** (item 4 seul confirmé en navigateur
  réel — items 1-3 testés par instrumentation directe, jamais par un parcours navigateur complet).
  **Dette `[WIZLOCK1]` ajoutée** (2 fiches trouvées bloquées avant le correctif (3), cause
  probable identifiée non re-vérifiée sur ces cas précis). **Non testé** : suppression de
  character/battlemap via l'UI réelle (testé HTTP direct uniquement) ; parcours Wizard complet
  jusqu'à "Terminer" en conditions réelles navigateur. Détail complet : `docs/JOURNAL6.md`
  "Session 141 (suite 14)".
- **Session 141 (suite 13) — `docs/PLAN_MUTATION2.md` Lot 1 (attributs primaires mutations) ✅
  CLOS, fonctionnel confirmé Saar.** Suite directe de "suite 10" (diagnostic/architecture).
  Consolidation `calcNA`/`calcAN` vers `shared/polarisUtils.js` (fin de la triple duplication
  serveur/client), PI4 (encombrement) réellement corrigé sur 5 sites + option de campagne
  `encumbrance_enabled`/`encumbrance_multiplier`, ~20 sites serveur/client rebranchés.
  **4 bugs trouvés et corrigés en testant avec Saar** (migrations 127/128) : vue
  `char_mutation_effects_view` aveugle aux sous-types de mutation (`ref_mutation_subtypes` jamais
  jointe — "Caractère génétique animal" toujours à 0) ; sélecteur de sous-type manquant côté Lot D
  (`AdvantagesPanel.jsx`) ; état client (`CharacterSheet.jsx`) jamais rafraîchi après ajout/retrait
  d'une mutation (`onSaved` = simple ✓ visuel, ne recharge rien) ; **bug le plus sérieux** —
  `SUM()` Postgres sur colonne `integer` retourne un `bigint`, que `node-pg` parse en **chaîne JS**
  (jamais casté) — `calcNA` concaténait au lieu d'additionner (`10+'2'`→`102` au lieu de `12`),
  cause exacte du "COO Niveau Actuel = 110" signalé par Saar. Chaque correctif vérifié par
  **instrumentation en base réelle** (transactions systématiquement annulées), pas seulement par
  lecture de code. Détail complet : item "55." `docs/EN_COURS.md` et `docs/JOURNAL6.md`
  "Session 141 (suite 13)". Prochaine étape : Lot 2 (Attributs secondaires).
- **Session 141 (suite 12) — Options de campagne `revers` (OPT-06) ✅ CLOS + mode développeur
  écarté ✅ CLOS + consolidation mini-stepper Avantages pro ✅ CLOS.** Note de numérotation :
  "suite 10"/"suite 11" déjà pris par deux sessions parallèles sans rapport (`PLAN_MUTATION2.md`/
  `PLAN_MODING.md`), repéré avant collision — cette session prend "suite 12". **Revers** :
  déclencheur = total d'années cumulées toutes carrières confondues (pas par métier, contrairement
  au Tirage 1D10 Lot 6) — confirmé `REGLE_CREATION.txt:1190-1199`. Obligatoire, narratif uniquement
  (même traitement que Force Polaris OPT-04). Table `docs/REGLES/REGLEREVERS.md` fournie par Saar
  (27 catégories 1D100). Migration `126_ref_setbacks_revers_table.js` (NOUVEAU) + `shared/
  careerSetbacks.js` (NOUVEAU, fichier indépendant de `careerAdvantages.js` — analyse critique
  validée avant fusion, mécaniques trop différentes) + `SetbacksAllocator.jsx` (NOUVEAU, sous-step
  dédiée). **Mode développeur** demandé par Saar pour accélérer les tests, puis écarté : incohérence
  serveur trouvée (Étape 1 bloquait un budget non dépensé, Étape 4 jamais) ; Saar a proposé mieux —
  bouton "Suivant" toujours actif, avertissement au premier clic, confirmation au second
  (`validateStep1` G1 rendu non-bloquant, `Step1Attributes.jsx`/`CareersAllocator.jsx`, état dérivé
  jamais `useEffect`+`setState`). **Consolidation Avantages pro** : Tirage 1D10 (Lot 6) invisible
  dans l'onglet `CareersAllocator.jsx` — nouveau `ProAdvantagesAllocator.jsx` (répartition manuelle
  + Tirage fusionnés par métier, règle par construction le risque de séquençage d'une conversion
  rétroactive de jet en points), onglet "avant" retiré intégralement. **2 vrais bugs trouvés en run
  à vide** : signature d'avertissement ne couvrant pas `randomPicks` ; sur-dépensé traité comme un
  simple avertissement côté client alors que le serveur rejette toujours le dépassement de budget
  — corrigé en blocage dur. **Dette `[WIZ-4]` ajoutée** (mini-stepper ne revalide jamais les
  blocages durs au clic direct, préexistant, filet serveur en place). **Roadmap ouverte
  (`[ADV1]`/`[ADV2]`/`[ADV3]`)** : Célébrité/Allié/Contact/revenus cumulatifs/déblocage de
  compétence non trackés mécaniquement, confirmé avec un vrai exemple en base — chantier dédié à
  planifier ensuite (décision Saar). Testé : couverture 1-100 vérifiée par script, `node --check`/
  ESLint 0 erreur introduite (sweep final), SR + parcours navigateur confirmé Saar. Non testé :
  conversion rétroactive en conditions réelles (corrigée par construction, pas re-testée
  manuellement), finalisation complète non confirmée scénario par scénario. Détail complet :
  `docs/JOURNAL6.md` "Session 141 (suite 12)".
- **Session 141 (suite 11) — `docs/PLAN_MODING.md` analysé + corrigé, chantier mis EN PAUSE ✅
  CLOS.** Session analytique/planification pure, **aucun code écrit**. Plan rédigé Session 120,
  jamais commencé depuis (0% codé, vérifié). Corrigé (migration renumérotée, routes déplacées dans
  `char-sheet.js` — réutilise le guard ownership existant, `REGLEARMURE.md` retiré — mauvaise
  source, mécas pas armes portatives, socket `INVENTORY_*` requalifié obligatoire) et scindé en
  **Phase A** (rangement inventaire, plan complet, prêt à coder — Étape 0 ajoutée : extraction
  `inventoryService.js` depuis `char-sheet.js`, portée vérifiée ligne par ligne) / **Phase B** (effet
  mécanique sur le Test de tir, découpée en 5 lots). "On ne laisse rien au codage" (Saar) : 1 vrai
  bug trouvé dans ma propre proposition (DELETE inconditionnel du mod cassait en cas de stack —
  piège **P7**, corrigé), mécanisme d'ouverture `ModingWindow` et rafraîchissement temps réel
  tranchés par lecture directe du code client. **Phase B** : seul le Lot B1 (bonus statiques) est
  sans dépendance manquante — B2 (Lunette de visée) dépend de **Tir visé**, mécanique combat
  totalement absente du code (0 référence, nouvelle dette **TIRVISE**, distincte de `COM9` et
  "Changer le mode de tir" malgré la proximité dans `REGLESYSCOMBAT.md`). **Décision Saar : Tir visé
  est prioritaire, chantier moding mis en pause dans son ensemble** en attendant. Détail complet :
  `docs/JOURNAL6.md` "Session 141 (suite 11)", `docs/PLAN_MODING.md`.
- **Session 141 (suite 10) — `docs/PLAN_MUTATION2.md` affiné avec Saar (diagnostic + architecture,
  aucun code).** Décision : mutations et avantages sont la même famille de problème (moteur
  d'application unique, deux catalogues normalisés vers la même forme), découpage retenu en
  **7 lots par type d'effet** — Lot 1 Attributs primaires, Lot 2 Attributs secondaires, Lot 3
  Résistances, Lot 4 Armure/arme naturelle, Lot 5 Déblocage de compétences (`[CS7]`), Lot 6
  Identité, Lot 7 Narratif/économie. Recherche approfondie cette session : `ref_advantages.
  mod_attribute` ne cible jamais un attribut primaire (seulement `reaction`/`breath`, des
  attributs secondaires) — le recoupement mutations/avantages n'est donc réel que sur les
  résistances (`damage`/`shock`) ; le schéma V2 `ref_mutations` (migration 95) n'a plus de colonnes
  structurées pour l'arme naturelle (contrairement à l'ancien V1) — Lot 4 est le plus lourd du
  plan ; `ref_skill_requirements.type='MUTATION'` référence encore d'anciens identifiants V1
  (`muta_XXX`), un mapping vers les `mutation_id` V2 sera nécessaire pour le Lot 5 (`[CS7]`).
  **Prochaine étape : détailler le Lot 1 ligne-à-ligne avec Saar.** Détail complet :
  `docs/PLAN_MUTATION2.md`.
- **Session 141 (suite 9) — `docs/PLAN_ADVANTAGESPANEL.md` : Lots C+D ✅ CLOS, chantier terminé.**
  **Lot C (notes "Autres")** : conception requise avant plan — discussion directe (pas de
  questionnaire structuré, rappel Saar) sur pourquoi une nouvelle table plutôt que réutiliser le
  pattern texte libre d'avant migration 99 : le schéma V1 était souple (pas de FK catalogue), la
  migration 99 a introduit un modèle strict pour de vrais avantages mécaniques — réintroduire
  "Autre" via une ligne catalogue générique aurait contourné la contrainte unique par
  `advantage_id` et rendu `snapshot_data` incohérent. Précédent déjà dans le projet : `char_mutations`
  séparée de `char_advantages` pour la même raison. Migration `124_char_advantage_notes.js`
  (NOUVEAU) + `advantageService.js` (3 fonctions) + `char-sheet.js` (3 routes `/advantage-notes`) +
  `AdvantagesPanel.jsx` (liste fusionnée `combinedEntries`, badge `AUT`).
  **Correction d'une erreur de ma propre analyse à charge du Lot C** : j'avais affirmé que les
  routes `/advantages` n'avaient aucun contrôle de propriété au-delà de `requireAuth` — **faux**,
  `router.param('characterId', ...)` (`char-sheet.js:54-76`) l'enforce déjà sur toutes les routes
  du fichier (pose `req.isGm`/vérifie l'appartenance à la campagne), je l'avais raté en ne lisant
  pas assez loin. Trouvé et corrigé en recherchant pour le Lot D.
  **Lot D (mutations octroyées en jeu)** : périmètre confirmé avec Saar avant code — MJ uniquement
  (lecture seule joueur), aucun coût PC (octroi narratif), pas de sous-type/tirage aléatoire (le MJ
  gère). Migration `125_char_mutations_source_campaign.js` (CHECK `source` +`'campaign'`) +
  `mutationService.js` (NOUVEAU — upsert stackable mirrors STEP3, override sexe/fécondité,
  soft-delete `status='removed'`) + 3 routes `/mutations` (GET public, POST/DELETE `req.isGm`,
  réutilise le middleware existant) + `AdvantagesPanel.jsx` (badge "MUT", bouton grisé si `!isGm`).
  **Bug MUT2 corrigé au passage** (`ref.js` — `orderBy('muta_numero')` inexistant → `mutation_id`).
  Testé : `node --check`/ESLint 0 erreur (3 pré-existants `CharacterSheet.jsx` confirmés `git
  stash`), migrations vérifiées en base (P53/P54), cycles complets réels (`node -e`), SR +
  **fonctionnel confirmé Saar**.
  **Limite trouvée par Saar en testant le Lot D** : ajouter une mutation n'applique aucun effet
  mécanique. Vérifié `[VÉRIFIÉ]` — **gap pré-existant, vrai aussi pour le Wizard** :
  `char_mutation_effects_view` jamais interrogée nulle part, `calcNA()` (`charStats.js`) n'a que 3
  paramètres. Même diagnostic pour les Avantages (demandé par Saar) : 74/76 lignes `ref_advantages`
  ont des `mod_*` déclarés mais jamais lus. **`docs/PLAN_MUTATION2.md` créé** (diagnostic complet +
  3 pistes non tranchées, aucun code) — Lot E (`[CS7]`) **transféré** dans ce document (décision
  Saar, même famille de problème). Saar lance une session dédiée juste après celle-ci.
  `docs/PLAN_ADVANTAGESPANEL.md` marqué **chantier clos**. Détail complet : `docs/JOURNAL6.md`
  "Session 141 (suite 9)".
- **Session 141 (suite 8) — Bug réel D4 face "4" + roulis aléatoire des dés ✅ CLOS.** Suite de
  l'item 47 (ci-dessous), via l'outil de calibration étendu à tous les dés à la demande de Saar.
  **Bug outil corrigé** : ordre N1-Nk instable pour les dés symétriques (D4/D6/D8/D20, tous les
  clusters ont le même nombre de triangles) — tri secondaire déterministe ajouté
  (`devFaceClusters.js`). "Cassé" D8/D20 dans l'outil investigué en profondeur (clustering rejoué
  via le vrai `GLTFLoader`) et confirmé absent en jeu réel — artefact de l'outil, pas un bug,
  décision Saar de ne pas creuser plus loin.
  **Vrai bug production trouvé** (capture d'écran à l'appui — "1,2,3" visibles, "4" absent) : la
  face "4" du D4 s'affichait mal orientée en vraie session, pas seulement dans l'outil.
  `getFaceRollCorrection(dieType, faceValue)` (`diceMath.js`, NOUVEAU) appliqué dans `DiceMeshGlb`
  — `setFromUnitVectors` seul ne garantit aucun contrôle du roulis ; correction scope limité à D4
  face "4" (seule face signalée). **Demande Saar dans la foulée** : roulis aléatoire des dés
  (`getRandomClockDeg`, PRNG seedé) — **bug trouvé en testant** : pour un jet à un seul dé, `seed`
  = la valeur du résultat elle-même (XOR d'un seul élément, `diceParser.js`), donc deux jets sur le
  même chiffre avaient toujours le même roulis. Fix : `timestamp` du jet propagé
  `DiceRoller.jsx`→`DiceMesh.jsx`→`DiceMeshGlb`, combiné à `seed`. Voir piège dédié dans
  `.claude/rules/dice.md`. Testé : ordre stable (3 essais), clustering D8 revérifié via le vrai
  `GLTFLoader`, maths D4 vérifiées numériquement, roulis déterministe + variable par timestamp
  confirmé, ESLint 0 erreur introduite. **SR + D4 fonctionnel en jeu confirmé Saar, roulis aléatoire
  fonctionnel en jeu confirmé Saar.** Non testé : les 6 autres dés avec le nouveau roulis, angle de
  caméra très différent du défaut pour la correction D4. Détail complet : `docs/JOURNAL6.md`
  "Session 141 (suite 8)", `docs/PLAN_DICEREWORK3.md`.
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
- **Session 141 (suite 6) — AdvantagesPanel Lot A : Force Polaris (OPT-04) ✅ CLOS.** Reprise en
  session neuve depuis `docs/PLAN_ADVANTAGESPANEL.md` (Lot A déjà détaillé ligne-à-ligne par une
  session précédente, pas encore codé) : bug pré-existant confirmé — `AdvantagesPanel.jsx` écrit
  avant la migration 99 "char_advantages V2", `hasMuta029` toujours faux en pratique. **Écart trouvé
  avant codage, tranché avec Saar** : `docs/OPTIONS_CAMPAGNE.md` (OPT-04) mentionne une limite "1
  Polaris latent par groupe" (campagne) que le plan Lot A n'implémentait pas (seulement
  `family_limit:1`, par personnage) — décision Saar : hors scope, géré manuellement par le MJ.
  Migration `123_ref_advantages_polaris.js` (NOUVEAU, 3 lignes `adv_077`/`078`/`079`) +
  `getStep5RefData(campaignId)` (filtre 077/078 selon `settings.polaris_latent`) +
  `advantageConstraints.js` (contrainte `polaris_option_enabled`, ciblée par ID pour ne jamais
  bloquer `adv_079`) + `advantageService.js` (résout `campaignId` par jointure
  `char_sheet→characters`, jamais fait jusqu'ici avec seulement `sheetId`) + `AdvantagesPanel.jsx`
  (`hasMuta029`→`hasForcePolaris` sur `adv_079`) + `fr.json`. **8/11 options faites** (`ambiance`,
  `random_mutations`, `feminin_bonus`, `random_pro_advantages`, `skill_prerequisites`,
  `skill_max_level`, `young_penalty`, `polaris_latent`) — 3 restantes (`revers`,
  `skill_natural_prog`, `celebrity`). Dette annexe non prioritaire toujours backlog : **`[CS7]`** —
  `SkillsPanel.jsx` a le même bug racine (`activeMutations` toujours vide), rend 10 compétences
  liées aux mutations invisibles pour tout personnage. Testé : `node --check`/ESLint 0 erreur,
  migration vérifiée en base réelle (P53/P54 respectés), 5 scénarios `node -e` sur
  `validateAdvantage`, SR + **parcours navigateur confirmé fonctionnel par Saar**. Non testé : achat
  effectif de `adv_079` détaillé scénario par scénario ; dépendance PC 077/078→079
  (`pc_postcreation` jamais crédité) reste non résolue, hors scope. **Prochaine étape : Lot B**
  (affichage liste `AdvantagesPanel.jsx`, tâche séparée) — à planifier en détail avec Saar. Détail
  complet : `docs/JOURNAL6.md` "Session 141 (suite 6)".
- **Session 141 (suite 7) — AdvantagesPanel Lot B : affichage de la liste ✅ CLOS.** Tâche séparée
  du Lot A (règle "un seul bug à la fois"), plan ligne-à-ligne construit en relisant
  `AdvantagesPanel.jsx` (le plan écrit ne le détaillait qu'à gros grain). Confirmé contre une fiche
  réelle (`adv_002` "Ambidextre") : l'ancien code affichait badge "ATR" + **nom vide** (`adv.label`
  toujours `undefined` en V2). Fix : `adv.type === 'advantage'`/`'disadvantage'` (vraies valeurs) +
  `adv.name` (au lieu de `adv.label`/`adv.mutation_nom` jamais définis) + suppression du bloc
  `level` mort. Styles renommés (`badgeMut`→`badgeAdvantage`, `badgeAtr`→`badgeDisadvantage`) +
  `fr.json` (`AVA`/`DÉS`). `en.json` non touché (déjà invalide, dette `[JSON1]`). Testé : ESLint 0
  erreur, `fr.json` valide, sortie réelle `getAdvantages()` revérifiée (badge + nom corrects après
  fix), SR + **parcours navigateur confirmé fonctionnel par Saar**. Non testé : affichage d'un
  désavantage réel (aucune ligne `type:'disadvantage'` active trouvée en base, badge "DÉS" vérifié
  par lecture du code uniquement). **`docs/PLAN_ADVANTAGESPANEL.md` pas fini** : Lots A/B clos ;
  Lot C ("Autres" texte libre) et Lot D ("Mutations" en jeu, aucune route pour un personnage déjà
  verrouillé) restent à planifier en détail avec Saar, chacun sa session ; Lot E (`[CS7]`) reste
  backlog. Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 7)".
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
- **147 migrations stables** (142_ref_equipment_lunette_niveaux — Moding Phase B Groupe 2,
  Session 141 (suite 30) ; 141_ref_equipment_mod_slots — Moding Phase B Groupe 1,
  Session 141 (suite 28) ; 140_ref_skill_requirements_or_group — bug Hybride, Session 141 (suite 27) ;
  139_fix_ref_skill_requirements_mutations — `PLAN_MUTATION2.md` Lot 5, Session 141 (suite 26) ;
  138_ref_mutations_natural_weapon — Session 141 (suite 25) ;
  137_char_inventory_mods — Moding Phase A, Session 141 (suite 21) ;
  136_fix_ref_resistance_naturelle_sign — session parallèle ;
  135_ref_equipment_skill_assoc_weapons — Session 141 (suite 16) ;
  134_combat_actions_aim_bonus_comp — Tir visé, Session 141 (suite 17) ;
  133_char_sheet_wizard_locked_backfill — Session 141 (suite 14) ;
  132_char_sheet_dedupe_and_unique — Session 141 (suite 14) ;
  131_split_equippable_stacks — session parallèle ;
  130_vault_transfer_requests — Session 141 (suite 15) ;
  129_vaults — Session 141 (suite 15) ;
  128_char_mutation_effects_view_int_cast — Session 141 (suite 13) ;
  127_char_mutation_effects_view_subtypes — Session 141 (suite 13) ;
  126_ref_setbacks_revers_table — Session 141 (suite 12) ;
  125_char_mutations_source_campaign — Session 141 (suite 9) ;
  124_char_advantage_notes — Session 141 (suite 9) ;
  123_ref_advantages_polaris — Session 141 (suite 6) ;
  122_ref_career_random_benefits_lot1_and_points_alt — Session 140 ;
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
- **[ADV1]** Célébrité, Allié/Contact/Ennemi/Opposant et les autres "avantages relationnels" (`ref_career_random_benefits`, Revers, OPT-11) ne sont **trackés nulle part mécaniquement** sur la fiche personnage — aucune jauge/compteur réel. Bloque l'automatisation des tirages Avantages pro aléatoires (Lot 6) ET de Revers (OPT-06) au-delà de la simple conversion en points, qui elle est déjà automatisée. **À faire impérativement (décision Saar, Session 141 suite 12)** — chantier dédié à planifier après le mini-stepper Revers/Tirages, pas juste une note cosmétique.
- **[ADV2]** Bénéfices de carrière type "Revenus +10%/+20%/doublés à partir de cette année" (`ref_career_random_benefits`, ex. Cultivateur/Éleveur roll 3/7/9) — aucun mécanisme pour appliquer un modificateur cumulatif aux années futures ; `evaluateSalaryFormula`/économies ne gèrent qu'un montant ponctuel. Roadmap (Session 141 suite 12).
- **[ADV3]** Bénéfices de carrière débloquant l'accès à une compétence (ex. mutation/compétence "développée automatiquement" via un tirage) — non géré, aucun câblage vers `char_skills`/`char_mutations`. Roadmap (Session 141 suite 12).
- **[WIZ4]** `Step4Experience.jsx` — le mini-stepper (`isClickable`) ne revalide jamais les blocages durs de la sous-step quittée : un clic direct sur une sous-step déjà "reachable" (`highestSubStep` dépassé) contourne le blocage de la sous-step courante (ex. retirer sa seule carrière sur Carrières puis cliquer directement sur "Avantages pro"/"Revers"/"Récap" via le mini-stepper). Préexistant à Session 141 (suite 12), pas une régression du chantier Revers/Avantages pro — vérifié en relisant `Step4Experience.jsx` avant le rework. Filet de sécurité serveur (`reconcileCreation` STEP4, "Au moins une carrière requise") empêche toute donnée invalide persistée — juste un rejet tardif/générique au lieu d'un blocage immédiat. Non prioritaire, concerne l'architecture de navigation entière du mini-stepper, pas une sous-step isolée.
- **[WIZLOCK1]** (Session 141 suite 14) — 2 fiches trouvées `creation_state='complete'` mais `wizard_locked_at` jamais posé ("Mr STEP6 Final", "jeune") avant le correctif d'atomicité de cette session. Cause probable identifiée mais non re-vérifiée a posteriori sur ces 2 cas précis : `handleTerminate` (`WizardCreation.jsx`) faisait 2 appels réseau séparés (`reconcile` puis `lock`) — toute coupure entre les deux laissait la fiche dans cet état bloqué. Corrigé pour les finalisations futures (`reconcileCreation` gagne `finalize`, un seul appel atomique) — cette dette ne documente que l'historique, pas un risque encore actif.
- **[EQSKILLS1]** (Session 141 suite 16) — `ref_equipment_skills` ("compétences boostées/requises" : accessoires/implants/outils requérant ou boostant une compétence, ex. lunette de visée → Tir de précision) n'est consommée **nulle part** en logique de jeu — seulement écrite/relue par l'API admin `routes/equipment.js` (aucun composant `client/src` ne l'appelle, vérifié par grep). Donnée morte, jamais appliquée à un calcul. À distinguer de `ref_equipment_skill_assoc` (table jumelle au schéma identique, "compétence d'utilisation" — celle-là bien vivante, consommée par `resolveAssaultAction`/`resolveMeleeAction`), source de la confusion initiale de Saar sur un possible doublon. 1 seul item présent dans les deux tables (TMP II), dont l'entrée `ref_equipment_skills` (`ANALYSE_EMPATHIQUE` sur une arme) est visiblement une erreur de saisie ancienne. Fusion des deux tables possible mais non prioritaire (toucherait le moteur combat pour un gain cosmétique, aucun consommateur réel à préserver côté `ref_equipment_skills`).
- **[DOC1]** (Session 141 suite 18) — `docs/VOCABULARY.md` était un squelette vide (toutes sections `(...)`) depuis sa création, jamais réellement adopté par le protocole. Peuplé cette session avec un premier seed réel (concepts métier, ambiguïtés, acronymes, pièges historiques) en remplacement de `docs/GLOSSAIRE.md` (référencé par `.claude/rules/conventions.md` mais absent de ce repo — n'existe que dans le submodule `Enclume-codex/`, référence corrigée). Reste à enrichir au fil des sessions, jamais réécrit de zéro.
- **[DOC2]** (Session 141 suite 18) — `docs/SYSTEME/REGLES_LdB.md` : dump brut d'extraction LdB avec encodage mojibake par endroits, mal placé selon `docs/RegleDocumentaire.md` Règle 8 (dossier `REGLES/` réservé aux extraits LdB, pas `SYSTEME/`), doublon probable avec `docs/REGLES/REGLESYSCOMBAT.md`. Bandeau d'avertissement ajouté en tête de fichier ; vérification ligne-à-ligne + suppression/déplacement à faire en session dédiée — non fait ici (décision Saar, hors scope de cette passe).
- **[CHOC1]** (Session 141 suite 25, `docs/PLAN_MUTATION2.md` Lot 4 sous-lot B) — la mutation Corne a un bonus LdB "+1D6 dommages de Choc si le coup porte à la tête", non câblé. `calcResistanceArmure` (`charStats.js:290-299`) calcule déjà un `prt` (protection_shock) en plus de `etq`, mais `damageService.js:50` ne déstructure/utilise que `etq` — `prt` est calculé puis jeté. Aucun pool de "dommages de Choc" distinct des dégâts physiques n'existe dans le pipeline de résolution combat actuel. Corne câblée pour ses dégâts physiques de base (`1D10`) uniquement dans le Lot 4 ; le bonus tête reste différé jusqu'à ce que le pool `prt` soit branché (chantier séparé, non trivial).

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
