# PLAN_BLESSURE_SIXIEME_LIGNE — Compteur de blessures : la 6ᵉ ligne « Mort subite / Membre détruit »

> 2026-09-23 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé dans `docs/Old/` et
> fusionné dans `docs/SYSTEME/COMBAT.md` une fois clos.
> Statut : 🟡 **Lot 1 (statut `dead`, conséquences d'un cadavre) CLOS et archivé — `docs/Old/PLAN_STATUT_MORT.md` ; il ne
> reste ici que la 6ᵉ ligne dans le moteur : Lots 2-4, non commencés.** Décisions Saar du 2026-09-23 en §2. Points
> encore ouverts en §7. Un seul problème (Règle « un plan = un bug ») : la 6ᵉ ligne du compteur RAW n'existe pas
> dans le moteur.
> Hiérarchie : Livre de Base Polaris (`docs/REGLES/REGLEBLESSURES.md`) > ce plan.

---

## 1. Problème (cause racine unique)

Le compteur de blessures du RAW a **6 lignes** : Légères (5), Moyennes (10), Graves (15), Critiques (20),
Mortelles (25), **Mort subite / Membre détruit (30)** — `REGLEBLESSURES.md:20-26` (seuils) et `:135-149`
(compteur). Le moteur n'en implémente que 5 : `WOUND_SEVERITIES` (`shared/woundConstants.js:7`), contrainte SQL
`chk_wounds_severity` (migration 124), `WOUND_MAX_COUNTS`. La 6ᵉ ligne est à la fois :
- **la cible d'un coup ≥ 30** de dégâts nets ;
- **la cible du débordement de la ligne Mortelle** (même mécanisme de promotion que Légère → Moyenne → …).

Trois symptômes, une seule absence.

### 1.1 Constats (code réel, pas documentation)

| # | Constat | Statut |
|---|---|---|
| C1 | ≥ 30 net → `_severityForDamage` renvoie `mortelle` + `is_lethal: true` (`damageService.js:300`), même blessure qu'à 25. | [VÉRIFIÉ] lecture |
| C2 | `is_lethal` n'est pas persisté : `applyWound` ne le reçoit pas (`woundService.js:27`). Il ne sert qu'au malus de Choc (`charStats.js:351` : -10 sur un membre au lieu de -5) et à l'étiquette « LÉTAL » (`CombatResultPanels.jsx:83`). | [VÉRIFIÉ] lecture + exécution de `getShockMalus` |
| C3 | Tête/Corps à ≥ 30 : malus de Choc de Mortelle (-15/-10), personne ne meurt. Aucun état « mort » n'existe (grep `dead`/`mort` vide ; seuls `stunned`/`unconscious`/`evanoui`). La mort est « narrative » (`woundEvolutionService.js:198`). | [VÉRIFIÉ] |
| C4 | **Débordement muet** : `nextSeverity('mortelle') === null` (exécuté) ; capacité Mortelle = 1 (tête, bras, jambes), 2 (corps). Une 2ᵉ Mortelle sur la tête lève `AppError('Ligne pleine')` (`woundUtils.js:54`), `applyWound` l'avale et renvoie `null` : aucune blessure écrite, aucun Test de Choc. | [VÉRIFIÉ] `nextSeverity`/capacités exécutés ; la levée d'erreur elle-même lue, pas exécutée sur la base |
| C5 | Annexe, même racine : l'Infection d'une Mortelle (`infectsOnSuccess: true`) réinsère une Mortelle (`woundEvolutionService.js:194`), non rattrapé par le handler → lève sur les localisations à capacité 1. | [HYPOTHÈSE] lu, non exécuté |
| C6 | Route manuelle `POST /char-sheet/:id/wounds` (`char-sheet.js:927`) valide `WOUND_SEVERITIES` : le MJ ne peut pas non plus poser la 6ᵉ ligne à la main. | [VÉRIFIÉ] lecture |
| C7 | Le client boucle sur `WOUND_SEVERITIES` (`LocationPanel.jsx:266`) et indexe la « pire » blessure avec `indexOf` (`SilhouettePanel.jsx:21`) : une 6ᵉ valeur apparaît sans réécriture. | [VÉRIFIÉ] lecture |
| C8 | Chance : `CHANCE_ELIGIBLE_SEVERITIES` contient `mortelle` ; un coup ≥ 30 ouvre aujourd'hui les réductions d'une Mortelle (1-2 degrés). Le RAW prévoit explicitement le rachat d'une Mort subite en Critique (`REGLE_CHANCE.md:122-123`). | [VÉRIFIÉ] |

### 1.2 Texte RAW pertinent
- **Mort subite** : « le personnage meurt sur le coup » (`REGLEBLESSURES.md:164-167`). Aucun Test.
- **Membre détruit** (Bras/Jambe seulement, même seuil 30) : le membre est détruit, paralysie permanente ;
  stabilisation nécessaire, mort imminente ; **aucun Test possible** (`:174-179`) ; Choc -10 ;
  Jambes : déplacement impossible ; Bras : Allure lente. Guérison 3 semaines, Chirurgie + Médecine,
  difficulté -3 ; « un Membre détruit devient une Blessure critique » (`:368`).
- Les colonnes `membreDetruit` de `BLESSURE_EFFETS_TABLE`, `CHOC_DUREE_TABLE`, `DUREE_GUERISON_SOINS_TABLE`
  (`woundConstants.js`) existent déjà (Encyclopédie), sans consommation moteur.

## 2. Décisions Saar (2026-09-23)

1. **La mort est un statut de token** (`dead`), à mettre en place dans tous les cas, indépendamment du
   sort des membres détruits.
2. **Chance sur la 6ᵉ ligne : coût de 3 points** (le RAW ne chiffre pas ; 2 semblait « peu vu la
   blessure »). **Divergence RAW assumée** à inscrire dans `docs/JOURNAL8.md` (invariant 5). Elle dépasse
   aussi la limite générale de « 2 points d'un seul coup » (`REGLE_CHANCE.md:119`) : exception explicite
   à cette ligne. Résultat visé : une Blessure critique (RAW `:122-123`). *Lecture retenue : c'est le
   **coût** qui passe à 3, pas le nombre de degrés — à confirmer.*
3. **Rendu visuel d'un membre détruit** : barrer toutes les blessures du membre et les passer en gris.
4. **La 6ᵉ ligne = une seule case, pour les 6 localisations** (tranché 2026-09-23). Affichage : la case est
   masquée et remplacée par le mot « Mort » (Tête/Corps) ou « Membre détruit » (bras/jambes) — le mot
   dépend de la localisation, la gravité stockée est unique. **Une blessure « Mort » (Tête/Corps) active le
   statut `dead` sur le token.** Conséquence : la 6ᵉ gravité est une vraie ligne écrite partout (la
   `WOUND_OVERFLOW` par localisation du §3 devient inutile, `nextSeverity('mortelle')` suffit), et le
   statut `dead` est un *effet* de cette blessure, pas une seconde autorité (déjà livré : `docs/Old/PLAN_STATUT_MORT.md`).
   **Case masquée — comportement validé (2026-09-23) :** le mot est toujours visible (grisé si la blessure
   est absente, mis en évidence si active) et **cliquable** comme les autres cases (pose/retrait manuel MJ).
   **Chance : « 3 points de coût → Critique » confirmé** (§2.2).
5. Le report de 2026-07-29 (« Membre détruit = Option de campagne future ») était une décision de
   périmètre pour le lot Guérison, pas une affirmation du RAW (`docs/Old/PLAN_BLESSURES_GUERISON.md:226-244`).
   **Mort subite n'y a jamais été tranchée** (aucune occurrence dans ce plan) : elle est tombée dans le
   report sans décision. Ce plan lève le report.

## 3. Architecture retenue

Deux concepts que le RAW distingue :
- **La blessure aiguë** = la 6ᵉ ligne du compteur, avec ses propres paramètres (Effets, Choc, Guérison,
  Stabilisation).
- **L'état permanent du membre** (paralysie) : survit à la guérison de la blessure. *Le compteur papier ne
  le suit pas* — c'est la phrase du RAW « ne retrouvera plus l'usage » + le rendu voulu (§2.3) qui l'exigent.

| Élément | Choix |
|---|---|
| Blessure aiguë | Une 6ᵉ valeur dans `WOUND_SEVERITIES` (nom → §7), **capacité 1 sur les 6 localisations** (§2.4). Migration de `chk_wounds_severity` (règle `migrations.md`). |
| Débordement / ≥ 30 | Un coup ≥ 30 **ou** le dépassement de la ligne Mortelle écrit la blessure 6ᵉ ligne. **Correction (analyse à charge 2026-09-24)** : la règle des autres lignes — « la blessure qui *remplirait* la dernière case convertit » (`currentCount >= maxCount - 1`, confirmée par Saar) — ne doit **pas** s'appliquer à Mortelle : avec 1 case (tête, membres), toute Mortelle deviendrait aussitôt Mort. La ligne Mortelle se remplit jusqu'à sa capacité (comportement actuel, RAW : Mortelle à la tête = survie avec stabilisation) et seul le **dépassement** (`currentCount >= maxCount`, aujourd'hui `AppError` « Ligne pleine ») écrit la 6ᵉ ligne. Confirmé par Saar : « d'où l'importance des casques ». |
| Statut `dead` | Effet de la blessure 6ᵉ ligne sur Tête/Corps, posé dans `applyWound` (une seule autorité, tous les chemins : combat, chute, froid, route manuelle MJ). **Retiré quand cette blessure disparaît** (Chance, `/heal`, suppression MJ) — sinon statut et blessure divergent. |
| Affichage | Case masquée, mot « Mort » / « Membre détruit » selon la localisation (§2.4). |
| `is_lethal` | **Supprimé** : la gravité elle-même porte l'information (une autorité, plus de drapeau parallèle). L'étiquette « LÉTAL » et le malus de Choc en dérivent. |
| Guérison | Table « cible de guérison » : la 6ᵉ valeur redescend vers `critique` (RAW `:368`), pas vers `mortelle`. |
| Interdiction de Test | La 6ᵉ valeur rejoint `TEST_BLOCKING_SEVERITIES` (RAW `:175`). |
| État permanent | Table `character_destroyed_limbs` (fiche, localisation ∈ bras/jambes, `destroyed_at_game_minutes`, UNIQUE), écrite dans la transaction d'insertion de la blessure. Le client en dérive barré + gris. |

**Alternatives écartées.**
- *Drapeau sur la Mortelle* : toutes les tables RAW sont indexées par gravité → un `if (drapeau)` dans
  chacune = second moteur ; ne résout pas le débordement.
- *Table d'état seule (sans 6ᵉ valeur)* : ne sait ni déborder, ni guérir en Critique, ni porter les malus.

## 4. Lots (ordre et dépendances)

- **Lot 1 — Statut `dead` et conséquences d'un cadavre : ✅ CLOS et ARCHIVÉ (2026-09-24)** — `docs/Old/PLAN_STATUT_MORT.md`
  (historique, décisions, analyses à charge) ; documentation définitive `docs/SYSTEME/STATUTS_TOKEN.md`. Sous-lots livrés :
  option de campagne (`df7dcce`), registre unique 1a (`845412d`), statut `dead` 1b (`c30ce5b`), retrait direct 1d
  (`65dc133`), blocage proactif 1c (`b443c4c`), pas de Chance pour un mort 1e (`35a5197`), pas d'état de corps vivant sur
  un cadavre 1f (`26543f6`). **Ce que les Lots 2-4 en réutilisent** : `deathStateService.js:isCharacterDead`,
  `statusService.js:applyDeathConsequences(io, db, campaignId, characterId)` (à appeler quand la blessure « Mort » est
  écrite), `shared/tokenStatusRegistry.js` (`isDeath`, `incompatibleWithDeath`). Règle de Saar : *le cadavre reste là et
  prend des blessures* — le décompte n'a donc de sens complet qu'avec la 6ᵉ ligne (Lot 2).
- **Constaté 2026-09-24 — recoupement avec la session « interception des drones » (non commitée à ce
  jour)** : elle ajoute `woundSeverityForDamage(degatsNets)` dans `shared/woundConstants.js`, lecture de
  `BLESSURE_SEUILS_TABLE` (sans la 6ᵉ ligne), pour la gravité d'un coup sur un drone. Or
  `damageService.js` (`_severityForDamage`) recopie ces mêmes seuils pour l'humain. **Au Lot 2, une seule
  autorité des seuils** : `woundSeverityForDamage` (avec la 6ᵉ ligne) sert l'humain ET le drone, et
  `_severityForDamage` disparaît. À coordonner avec le commit de l'autre session avant de toucher ce fichier.
- **Découpage du Lot 2 (2026-09-24, après analyse à charge)** : **2a « la 6ᵉ gravité existe, se pose, s'affiche »** — codé, en
  attente du test de Saar : migration 363 ; constantes (`mort_subite`, capacités, couleur grise, seuil 30, Test interdit,
  jambe immobilisée) ; débordement de la ligne Mortelle (`isWoundLinePromoted`, voir §3) ; seuils uniques
  (`woundSeverityForDamage`, `_severityForDamage` supprimé) ; `is_lethal` retiré partout ; Choc lu dans
  `BLESSURE_EFFETS_TABLE` (`getWoundEffects`) ; tri SQL généré (`woundSeverityRankSql`) ; pose/retrait manuel de la 6ᵉ ligne
  MJ seul (`GM_ONLY_WOUND_SEVERITIES`) ; infection d'une Mortelle sans case en plus (`WOUND_INFECTION.extraCase`, RAW :
  survie en heures — remonté de 2b pour ne pas laisser un état intermédiaire faux) ; affichage (mot Mort / Membre détruit,
  silhouette, menu radial, résultats, chat, Encyclopédie). Défaut préexistant corrigé au passage : `isMortalWoundImmobilized`
  lisait `wound_location` (colonne réelle : `location`), la règle « jambe mortelle = déplacement impossible » ne se déclenchait
  jamais. **2b « ses conséquences »** — à faire : `dead` posé/retiré par réconciliation idempotente dans la transaction de la
  blessure (modèle `applyDefeatedStatus`/`determineDefeatedStatus` du système Shadowrun 5 de FoundryVTT), Membre détruit guérit
  en Critique (table cible de guérison ≠ `previousSeverity`), pas d'échéance de guérison pour Mort.
- **Lot 2 — La 6ᵉ ligne (plan d'origine).** Migration `chk_wounds_severity` ; `WOUND_SEVERITIES`, `WOUND_MAX_COUNTS`,
  `WOUND_PENALTIES`, `SEVERITY_COLORS` (gris), `WOUND_HEALING`, `WOUND_INFECTION`, `TEST_BLOCKING_SEVERITIES` ;
  `nextSeverity`/`previousSeverity`/`getWorstWoundSeverity` ; `resolveWoundInsertion` (débordement →
  6ᵉ ligne ou `dead`) ; `_severityForDamage` (≥ 30) ; retrait de `is_lethal` (une cinquantaine d'occurrences dans
  `socketCombatHelpers.js`, `socketCombatAoe.js`, `coldExposureService`, `environmentalHazardService`,
  `fallDamageService`, panneaux client) ; Choc via la gravité ; route manuelle ; libellés i18n.
- **Lot 3 — Chance sur la 6ᵉ ligne.** Coût 3 → Critique (§2.2) ; `computeAvailableSeverityReductions`
  ne modélise que des degrés 1-2 : prévoir une option dédiée. Décider le moment de pose de `dead` (§7).
- **Lot 4 — État permanent du membre + rendu.** Table `character_destroyed_limbs`, broadcast, barré/gris
  dans `LocationPanel` et `SilhouettePanel`. Séparable : les Lots 1-3 livrent déjà le compteur RAW complet ;
  le Lot 4 ajoute la persistance de la paralysie.

Chaque lot : plan exact présenté avant code, analyse à charge distincte, validation Saar en jeu réel pour
les comportements visibles (invariant « clôture »).

## 5. Tests attendus (`.claude/rules/blessures.md`)

Seuils exacts : 24/25, 29/30 dégâts nets ; 2ᵉ Mortelle sur tête (→ `dead`), 3ᵉ sur corps ; 2ᵉ Mortelle sur
bras/jambe (→ 6ᵉ ligne) ; ≥ 30 sur tête/corps/membre ; promotion en cascade complète ; Choc -10 sur membre
via la gravité ; Test interdit ; guérison → `critique` ; Chance à 3 points (Chance insuffisante, timeout,
refus) ; `/heal` ; pas de régression sur les 5 lignes existantes. Transport réel du payload (`WOUND_ADDED`).

## 6. Hors périmètre

- Mécaniques d'usage d'un membre détruit (arme à deux mains, etc.) : le rendu et l'état suffisent ici.
- Séquelles de Membre détruit (`sequellesConstants.js`) : déjà des tables Encyclopédie, non branchées.
- Mise à jour documentaire de clôture (Règle 10) : `SYSTEME/COMBAT.md`, `ROADMAP.md:164`, `JOURNAL8.md`,
  Encyclopédie (`blessures-seuils.json:30`), commentaires `woundConstants.js:55,85` (l'affirmation
  « règle optionnelle » n'est pas prouvée), `charStats.js:347`, `CHANGELOG.md`.

## 7. Points ouverts

1. ~~**Mort : par token ou par personnage ?**~~ — **tranché au chantier « Statut Mort »** : `dead` est posé sur un token,
   mais la mort se LIT au niveau du personnage (`isCharacterDead` : un token du personnage porte `dead`), comme `/heal` ;
   `applyDeathConsequences` purge les états interdits de TOUS les tokens du personnage.
2. **Moment de pose de `dead` vs choix de Chance.** `applyWound` corrige la gravité *après coup*
   (`woundService.js:94-132`, choix délibéré). `dead` étant dérivé de la blessure (§3), la voie naturelle
   est : poser, puis retirer si la Chance est dépensée (la blessure 6ᵉ ligne est remplacée par une Critique).
   Coût : un instant de « mort » visible avant le choix. Alternative : différer la pose jusqu'à la réponse.
   Décision au Lot 3.
7. ~~Case masquée~~ — **tranché** (§2.4). ~~Coût Chance~~ — **tranché** (§2.2).
3. **Infection d'une Mortelle** (C5) : une fois la 6ᵉ ligne existante, réinsérer une Mortelle infectée
   *promeut* vers Mort/Membre détruit, alors que la décision du 2026-07-30 est « délai de survie affiché,
   jamais appliqué » (`woundEvolutionService.js:198`). À trancher au Lot 2.
4. **Nom de la 6ᵉ valeur** : vérifier `docs/VOCABULARY.md` avant tout nouveau concept (AGENTS.md).
5. ~~Nombre de cases du compteur papier~~ — **[VÉRIFIÉ] sur la fiche (capture de Saar, 2026-09-24)** : les capacités de
   `WOUND_MAX_COUNTS` (Légères 3/4/3/3/3/3, Moyennes 3, Graves 2/3/2/2/2/2, Critiques 2, Mortelles 1/2/1/1/1/1) sont
   exactes ; la 6ᵉ ligne y est « Mort » (mot, sans case) en Tête et Corps et **une case** sur chaque bras/jambe. Saar
   maintient la décision §2.4 : une case pour les 6 localisations, affichée comme un mot.
6. **Coût Chance** : confirmer « 3 points de coût → Critique » (§2.2).
