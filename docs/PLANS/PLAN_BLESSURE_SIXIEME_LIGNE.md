# PLAN_BLESSURE_SIXIEME_LIGNE — Compteur de blessures : la 6ᵉ ligne « Mort subite / Membre détruit »

> 2026-09-23 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé dans `docs/Old/` et
> fusionné dans `docs/SYSTEME/COMBAT.md` une fois clos.
> Statut : 🟡 **cadrage terminé, aucun code écrit.** Décisions Saar du 2026-09-23 en §2. Points encore
> ouverts en §7. Un seul problème (Règle « un plan = un bug ») : la 6ᵉ ligne du compteur RAW n'existe pas
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
   statut `dead` est un *effet* de cette blessure, pas une seconde autorité.
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
| Débordement / ≥ 30 | Un seul chemin, la promotion existante : un coup ≥ 30 **ou** une ligne Mortelle pleine écrit la blessure 6ᵉ ligne (`nextSeverity`). Aucun cas particulier par localisation. |
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

- **Lot 1 — Statut `dead`.** Autonome, sans migration (`token_statuses.status_code` n'a aucun CHECK, seulement
  unique/PK/FK — vérifié). Sites exacts (relus 2026-09-23) :
  - serveur : `socketToken.js:160` (`VALID_STATUS_CODES` + **bascule réservée au MJ** — aujourd'hui le
    propriétaire du token peut basculer n'importe quel statut valide, `:152-153`) ;
    `socketCombatResolution.js:165` et `:353` (gardes assommé → `forfeitToken`, ajouter `dead`) ;
    `socketCombatState.js:302` **inchangé** (liste explicite `stunned`/`unconscious` : `dead` n'est déjà pas
    effacé à la fin du combat — à couvrir par un test) ; `/heal` l'efface déjà (tous statuts).
  - client : `TokenStatusPanel.jsx` (`STATUS_LIST`, couleur de catégorie, clic réservé MJ ; la grille 5
    colonnes passe à 4 lignes), `TokenPresentation.jsx` (`STATUS_CATEGORY`), icône
    `client/public/assets/status/dead.svg` (même gabarit hexagonal que les autres), `fr.json` `status.dead`,
    `useCombatSocket.js:175` (le message de refus ne connaît que « inconscient »/« étourdi »).
  - constaté, hors lot : la garde d'annonce (`socketCombatAnnouncement.js:259`) ne teste que `stunned`
    (pas `unconscious`) ; `dead` suit `unconscious`, pas d'extension ici.
- **Lot 2 — La 6ᵉ ligne.** Migration `chk_wounds_severity` ; `WOUND_SEVERITIES`, `WOUND_MAX_COUNTS`,
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

1. **Mort : par token ou par personnage ?** Statuts par token, blessures par fiche
   (`clearCharacterWoundsAndStatuses` traite déjà « tous les tokens du personnage »). À trancher au Lot 1.
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
5. ~~Nombre de cases de la 6ᵉ ligne du compteur papier~~ — **tranché par Saar : une seule case** (§2.4).
   Écart éventuel avec le papier non vérifié [INCONNU] : sans conséquence, la mort est binaire.
6. **Coût Chance** : confirmer « 3 points de coût → Critique » (§2.2).
