# PLAN_WIZARD_AVANTAGES_IMPLANTATION.md — Guide d'exécution pour agent neuf

> Ce document a une seule responsabilité : permettre à un agent qui n'a **aucun souvenir** de la
> conversation qui a produit `docs/PLAN_WIZARD_AVANTAGES.md` (Phase 3) de coder un lot en toute
> sécurité, sans relire 1400 lignes d'historique de décisions, et sans reproduire les erreurs déjà
> trouvées et corrigées. Ce n'est pas un résumé du plan — c'est un mode d'emploi pour l'exécuter.
> `PLAN_WIZARD_AVANTAGES.md` reste la seule autorité pour le contenu (§5/§6) et le contrat technique
> (§8) : ce document **pointe** vers ses sections, il ne les recopie pas.

---

## STATUT (mis à jour 2026-07-23) — Lots 1 à 7 CODÉS, TESTÉS ET CONFIRMÉS FONCTIONNELS PAR SAAR

Ne pas repartir de zéro sur les Lots 1-5 : `resolveCareerRandomEffects` (Lot 1), `computeCareerBlockSavings`
(Lot 2), `resolveSetbackEffects` (Lot 3), leur câblage complet dans `creationService.js` (Lot 4) et
l'UI câblée dans `ProAdvantagesAndSetbacks.jsx` (Lot 5) existent déjà, avec tests réels (181/181 sur
`shared/`, 33/33 sur `server/src/services/`) + build client vérifié (`vite build`, `eslint`). Détail
complet de ce qui a été fait, fichier par fichier, dans `PLAN_WIZARD_AVANTAGES.md` §16/§17/§18 et ce
document §4/§4bis — les lire avant de toucher quoi que ce soit ici, pour ne pas dupliquer ou casser ce
qui existe. **Rien de tout ça n'est committé** (vérifier `git status` avant de continuer). Le §4
ci-dessous (détail du Lot 1) est conservé tel qu'écrit avant le code — utile pour comprendre les
décisions prises, mais décrit un travail déjà terminé, pas une tâche à faire. **Vérifié en navigateur
par Saar (2026-07-23) : Lot 5/6 fonctionnel** (tirage carrières + Revers, y compris Attentat/Choc
psychologique après le correctif UX §4bis 4e correction) — un scénario réel joué, pas une couverture
exhaustive des 37 métiers × 27 Revers.

**Lot 6, moitié Revers, `[FAIT, 2026-07-22]`** : les 27 Revers ont un `effects[]` réel en base
(migration **194**, `ref_setbacks`, appliquée). Voir §5ter pour le détail complet (3 nouveaux
mécanismes ajoutés en cours de route, corrections vs les stubs de test antérieurs).

**Lot 6, moitié métiers, `[FAIT, 2026-07-23]`** : les 37 métiers ont un `effects[]` réel en base
(migrations **196**+**198**, `ref_career_random_benefits`, appliquées). Voir §5quater pour le détail
complet (mécanisme `skill_choice`/"Formation" nouveau, correctif d'un bug de production trouvé sur
`chasseur_primes`, découverte d'un 16e cas `income_multiplier_permanent`). **Lot 6 est maintenant
entièrement clos — reste uniquement le Lot 7 (clôture documentaire)** — voir §5.

---

## 0. Avant de faire quoi que ce soit

1. Lire `CLAUDE.md` (racine du dépôt) en entier — protocole du projet, non négociable.
2. Exécuter `git status --short --branch` (CLAUDE.md §4) — vérifier la branche et l'absence de
   travail non committé d'un autre chantier avant de toucher quoi que ce soit.
3. Lire `.claude/rules/conventions.md` et `.claude/rules/core.md`. Lire aussi `.claude/rules/dice.md`
   dès qu'un sous-jet est en jeu (`money_reward`, Lot 1 — voir piège 11 : le sous-jet suit le circuit
   `DICE_ROLL`/`DICE_RESULT` existant, le résolveur ne lance jamais rien lui-même) — son chargement
   automatique dépend du nom de fichier (`*dice*.js`), `creationService.js` ne le déclenchera pas
   tout seul.
4. Lire ce document en entier avant de commencer un lot, même si un lot précédent a déjà été fait.
5. Ne PAS lire `docs/PLAN_WIZARD_AVANTAGES.md` en entier d'un coup — il contient l'historique complet
   des corrections (5 passes critiques successives). Utiliser les pointeurs de section ci-dessous.

## 1. Règle absolue : autorisation par lot, jamais globale

Le travail est segmenté en 7 lots (`PLAN_WIZARD_AVANTAGES.md` §13). **Une autorisation de coder ne
vaut que pour UN SEUL lot.** Ne jamais enchaîner sur le lot suivant sans une nouvelle confirmation
explicite de Saar, même si "on continue" a été dit à un moment de la conversation. Un incident réel
s'est déjà produit dans ce chantier : du code a été écrit après un simple "ok" qui ne visait pas
ça. Après chaque lot : produire un résumé **Testé / Non testé** (`CLAUDE.md` §11) et s'arrêter.

## 2. Où trouver la vérité (pointeurs, pas de copie)

| Besoin | Aller à |
|---|---|
| Contenu exact des 27 Revers, effet par effet | `PLAN_WIZARD_AVANTAGES.md` §5 (table markdown) |
| Contenu exact des 37 métiers, effet par effet | `PLAN_WIZARD_AVANTAGES.md` §6 (une sous-section par métier) |
| Vocabulaire complet des types d'effet JSONB | `PLAN_WIZARD_AVANTAGES.md` §8.1 (table) + §8.1bis/§8.1ter (précisions Célébrité/agrégation) |
| Condition externe Force Polaris | `PLAN_WIZARD_AVANTAGES.md` §8.2 |
| Forme de sortie du résolveur (`pending`/`done`) | `PLAN_WIZARD_AVANTAGES.md` §8.3 |
| Ce qu'il reste à faire avant le 1er code | `PLAN_WIZARD_AVANTAGES.md` §8.4 |
| Architecture du résolveur récursif de Revers (Lot A) | `PLAN_WIZARD_AVANTAGES.md` §4 |
| Séquence des 7 lots et leurs dépendances | `PLAN_WIZARD_AVANTAGES.md` §13 |

Si un détail semble manquer ici, chercher dans `PLAN_WIZARD_AVANTAGES.md` par le numéro de section
ci-dessus **avant** de improviser une solution — 5 passes de vérification ont déjà eu lieu, la
probabilité qu'une ambiguïté restante soit déjà tranchée quelque part dans ces sections est élevée.

## 3. Pièges déjà trouvés — ne pas les reproduire

Chacun de ces points a été une vraie erreur trouvée en vérifiant contre le code ou le texte source
(pas une hypothèse). Ne pas les redécouvrir à ses dépens :

1. **Un type d'effet inconnu ne doit jamais disparaître en silence.** `resolveCareerRandomEffects`
   actuel (`shared/careerAdvantages.js`) a un `default: break` qui avale silencieusement tout type
   non géré. En étendant ce switch (Lot 1), traiter explicitement chaque type du §8.1 — pour tout
   type encore non géré, throw ou log, jamais un silence qui produirait des données mortes en base.
2. **"à partir de cette année" a 3 sens différents** selon le type exact : `income_percent`
   (additif, permanent, s'empile), `income_multiplier_permanent` (permanent mais plafonné à la
   valeur maximale déjà atteinte, ne se recompose jamais), `income_multiplier` (ponctuel, une seule
   tranche). Vérifier le type exact ligne par ligne dans §5/§6, ne jamais deviner à partir de la
   formulation française seule.
3. **Les noms de catégorie ne sont pas interchangeables entre métiers.** `Planque/Cache` (Espion,
   Contrebandier) ≠ `Cache/Planque` (Voleur) — deux chaînes réellement différentes dans
   `ref_career_point_categories`. Copier la chaîne exacte donnée en §6, ne jamais normaliser.
4. **"Opposants" n'est pas une catégorie** (`category`) — c'est une jauge `char_traits`
   (`trait_type: 'opponent'`, effet `trait`). Absent de `ref_career_point_categories`, vérifié.
5. **`resolveCareerRandomEffects`/`resolveSetbackEffects` sont des fonctions pures, sans accès DB.**
   Toute lecture/écriture (char_traits, grantAdvantage, addMutation, jets serveur) est faite par
   l'appelant (`creationService.js`), jamais par le résolveur lui-même.
6. **Ne jamais tester avec des fixtures inventées.** Un précédent code écrit sur ce chantier avait
   15 tests qui passaient sur des données fictives et zéro test sur les 27 Revers réels — supprimé
   pour cette raison. Toujours tester contre des lignes réelles de §5/§6, et toujours vérifier la
   non-régression sur `chasseur_primes` (migration 188, seul cas déjà mécanisé en production).
7. **Le résolveur ne connaît pas la Célébrité totale du personnage** — `celebrity_reward` (Pirate,
   Voleur) a besoin de la Célébrité déjà accumulée (base + carrières précédentes + tranches
   antérieures de la carrière en cours), pas juste le delta de cette fonction. Ce paramètre doit
   être passé en entrée par l'appelant (§8.1bis).
8. **`choice` n'a pas encore de champ d'entrée/sortie.** Ni `picks` (`{blockIndex, roll,
   useAsPoints}`) ni `setbackRolls` (`{blockIndex, roll}`) n'ont de champ pour la réponse du joueur
   à un `choice`. Ajouter un champ `choice: number|null` aux deux avant de coder quoi que ce soit
   qui en dépend (§8.3). Le format `{status:'pending', ...}` doit aussi porter un `kind:'roll'|
   'choice'` pour distinguer "il manque un jet" de "il manque une décision".
9. **Une décision de contenu (interprétation d'une règle du jeu) n'est jamais à la charge de
   l'agent qui code.** Si une ambiguïté de règle apparaît (pas déjà tranchée dans §5/§6/§8), s'arrêter
   et la remonter à Saar — ne jamais improviser une interprétation "raisonnable" du LdB.
10. **Migrations** : les colonnes nécessaires existent déjà depuis la migration 188 (`effects`
    JSONB sur `ref_career_random_benefits`/`ref_setbacks`). La plupart du travail est du peuplement
    de données (UPDATE), pas une nouvelle migration de schéma. Si une migration de schéma s'avère
    malgré tout nécessaire, **demander la parité de numéro à Saar avant de choisir un numéro** — la
    branche courante (`dev/Saar`) ne correspond littéralement à aucune des branches de `CLAUDE.md`
    §3, la convention paire/impaire n'est pas évidente ici.
11. **`[FAIT, Lot 1/4]` `reconcileCreation` ne protégeait que `char_skills`/`char_careers` (STEP4) et
    `char_advantages` (STEP5) contre les ré-applications répétées — rien d'autre.** Vérifié en
    lisant le code jusqu'au bout (§14 du plan). **Corrections codées** :
    - `char_traits` : ajouter `char_traits.where({char_sheet_id: sheetId}).del()` au bloc STEP4
      (même endroit que le wipe `char_skills`/`char_careers`, l.430-431), avant réinsertion.
    - `char_mutations` (`grant_mutation`) : `addMutation()` fait un UPSERT qui incrémente `count`
      à chaque appel (`mutationService.js:56`) — ajouter
      `char_mutations.where({char_sheet_id: sheetId, source: 'campaign'}).del()` au même bloc
      STEP4 avant de rappeler `addMutation()`. Sûr : `wizard_locked_at` n'est pas encore posé
      pendant l'édition du Wizard, aucun octroi `'campaign'` légitime (en jeu) ne peut donc exister
      sur cette fiche à ce stade.
    - `char_advantages` (Lot 3/4) : STEP5 fait un `.del()` inconditionnel
      (`creationService.js:667`, invariant documenté "STEP5 est le seul écrivain") qui supprimerait
      silencieusement tout Ennemi/Recherché accordé par un Revers en STEP4. Remplacer par
      `.where({char_sheet_id: sheetId, acquired_during: 'creation_step5'})` — met aussi à jour le
      commentaire d'invariant (l.664-666) dans le même changement.
    Les deux premières corrections sont un prérequis du Lot 1, pas une option — les coder en même
    temps que l'extension du résolveur.
    **`[FAIT, 2026-07-22]` 4e correction trouvée après coup, en préparant le Lot 5** : le bloc STEP4
    n'avait **aucun wipe** de ses propres lignes `acquired_during='trauma'` avant sa boucle
    `grantAdvantage()` — asymétrie avec `char_traits`/`char_mutations` juste au-dessus, qui ont bien
    ce wipe. `grantAdvantage()` fait un `INSERT` nu ; toute violation de la contrainte unique
    `(char_sheet_id, advantage_id) WHERE removed_at IS NULL` devient `AppError(409)` — donc un
    personnage dont un Revers accorde un avantage (ex. Recherché) faisait planter le **2e**
    `reconcile` (peek, retour en arrière, double "Terminer"), pas juste une fuite de données
    silencieuse comme les deux premiers cas. Corrigé en ajoutant
    `char_advantages.where({char_sheet_id, acquired_during:'trauma'}).del()` au même bloc STEP4
    (même emplacement que les deux wipes ci-dessus), en plus du rescoping STEP5 déjà décidé. Les 4
    corrections sont maintenant codées ensemble — plus de wipe manquant connu sur ce chantier.
    **`[FAIT, 2026-07-22]` 4 corrections supplémentaires trouvées lors d'une analyse critique dédiée
    (post-préparation Lot 5), avant toute implantation du Lot 5 lui-même** :
    - **A — frontière d'erreur asymétrique.** L'appel à `resolveSetbackEffects` (l.~460) n'avait
      aucun try/catch, contrairement à `computeCareerBlockSavings` juste en dessous qui reconvertit
      déjà ses erreurs en `AppError(400)`. Une `Error` brute du résolveur de Revers (cible
      introuvable, choix invalide, jet hors plages, récursion trop profonde, type inconnu — toutes
      possibles dès qu'une donnée de Revers du Lot 6 contient une faute de saisie) remontait donc en
      500 non géré. Corrigé en enveloppant toute la boucle `for (const sb of setbackRolls)` dans un
      try/catch qui relance les `AppError` telles quelles et reconvertit le reste en `AppError(400)`.
    - **B — `addMutation()` confondait deux origines sous `source='campaign'` codé en dur.**
      Un `grant_mutation` issu d'un Revers/tirage carrière (Lot 1/4, `creationService.js`) et un
      octroi narratif MJ post-verrouillage (`AdvantagesPanel.jsx`, seul appelant existant avant ce
      correctif) écrivaient tous deux `source:'campaign'` — aucune traçabilité possible après coup,
      contrairement à `char_advantages.acquired_during` qui distingue bien `'trauma'`. Corrigé en
      ajoutant un paramètre `source = 'campaign'` (avant `trxOpt`, donc le seul appelant existant
      — `char-sheet.js:797`, 3 arguments — n'a rien à changer, il prend le défaut) ; `creationService.js`
      passe désormais `'trauma'` explicitement. **Effet de bord obligatoire** : le wipe STEP4 du
      piège 11 point 2 (`char_mutations.where({..., source:'campaign'})`) ciblait la mauvaise valeur
      une fois ce correctif appliqué — reciblé sur `source:'trauma'` (le wipe `'campaign'` n'aurait
      plus jamais rien trouvé à effacer pendant le Wizard, puisque cette valeur n'y est plus jamais
      écrite).
    - **C — le wipe `char_advantages`/`trauma` (correction précédente, point ci-dessus) ne
      recalculait pas `mod_identity`.** STEP5 (l.818-828/838-840) capture les champs `mod_identity`
      des avantages actifs AVANT son propre wipe, puis appelle `recomputeIdentity()` après
      réinsertion — le nouveau wipe `trauma` de STEP4 n'avait pas cette étape symétrique. Un
      avantage accordé par un Revers avec un `mod_identity` non nul (aucun cas confirmé aujourd'hui
      dans `92_ref_advantages.js` — un seul `mod_identity` non nul sur tout le catalogue, sans lien
      connu à un Revers — mais l'architecture doit être correcte indépendamment des données
      actuelles) resterait figé sur sa dernière valeur si le Revers change ou disparaît entre deux
      reconciles. Corrigé en dupliquant exactement le patron STEP5 : capture `traumaIdentityFieldsSet`
      avant le wipe `trauma`, `recomputeIdentity(trx, sheetId, [...traumaIdentityFieldsSet])` après
      la boucle `grantAdvantage()`.
    - **D — aucune validation serveur contre un `career_id` dupliqué.** Le client
      (`CareersAllocator.jsx:321-322`, `handleAdd`) interdit déjà d'ajouter deux fois la même
      carrière, mais rien côté serveur ne le garantissait — contraire au principe "le serveur reste
      autoritaire" (`.claude/rules/core.md`). Corrigé par un `Set`-based check au tout début du bloc
      STEP4 (même patron que `seenSetbackBlocks`/`seenBlocks` déjà existants dans ce fichier),
      indépendamment de toute question de règle de jeu sur la répétition de carrières (non tranchée,
      hors sujet de ce correctif — le serveur applique simplement ce que le client impose déjà).
    Ces 4 corrections referment les derniers écarts trouvés lors de la relecture critique ; aucune
    n'a nécessité de nouvelle décision d'architecture — chacune réutilise un patron déjà validé
    ailleurs dans le même fichier (Lot 4 lui-même pour A/B/C, `seenSetbackBlocks` pour D).
    **`[FAIT, 2026-07-22]` Renommage `'trauma'` → `'revers'`** : toutes les valeurs `'trauma'`
    décrites ci-dessus (`char_advantages.acquired_during` ET `char_mutations.source`) sont désormais
    `'revers'` dans le code réel (`creationService.js`, `mutationService.js`) — même mot que le nom
    joueur/UI de la mécanique (`docs/VOCABULARY.md` "Revers"). Migration **192** ajoute `'revers'` à
    la contrainte CHECK de `char_mutations.source` (`char_advantages.acquired_during` n'en a pas,
    renommage code seul). Le texte ci-dessus garde `'trauma'` pour la trace de décision — **le code
    et la base font foi**, pas cette prose.

12. **`money_reward` ne lance JAMAIS de dé lui-même.** Le résolveur (`resolveCareerRandomEffects`)
    est une fonction pure sans I/O, rappelée à chaque `reconcileCreation` (qui recrée tout STEP4 à
    chaque appel, Phase 2 §7) — un tirage interne re-roulerait silencieusement à chaque
    revalidation du Wizard, un bug de déterminisme quasi invisible. Le sous-jet (1D100 Marchand
    itinérant/4, 1D10 Pirate/3) suit le circuit **déjà existant et vérifié** : client
    `socket.emit(WS.DICE_ROLL, {formula: die})` (`shared/events.js:29-30`), valeur reçue via
    `DICE_RESULT` stockée dans `pick.moneyRoll` avant soumission REST — jamais recalculée côté
    serveur pendant la résolution.

## 4. Lot 1 — détail actionnable `[FAIT — conservé pour le contexte des décisions, pas une tâche restante]`

**But** : étendre le résolveur de carrière existant pour qu'il gère tous les types d'effet du §8.1
sans rien casser sur `chasseur_primes`. Aucune donnée n'est peuplée à ce stade.

**Fichiers concernés** :
- `shared/careerAdvantages.js` — fonction `resolveCareerRandomEffects(picks, benefitRows)` (fonction
  pure, actuellement ligne 82, confirmé exact). Étendre le `switch` pour les types qui apparaissent
  réellement dans les 37 métiers (§6) : `trait`, `celebrity_reward`, `money_reward`, `choice`,
  `income_multiplier_permanent`, `grant_mutation`. Ajouter un paramètre d'entrée pour la Célébrité
  déjà accumulée (§8.1bis) et un champ `choice` sur les `picks`.
  **Vérifié 2026-07-22** : `grant_advantage`, `manual_grant_choice` et `points_cap` n'apparaissent
  **jamais** dans les 37 tables de métiers (recherche exhaustive dans §6) — ce sont des mécanismes
  exclusivement côté Revers (§5, Lot 3). Ne PAS les implémenter dans ce lot : il n'existerait aucune
  donnée réelle pour les tester, ce qui violerait la règle "pas de fixtures inventées" (piège 6). Le
  `default: break` remplacé par un throw (piège 1) les couvre correctement s'ils apparaissaient un
  jour par erreur dans une donnée de carrière.
- `server/src/services/creationService.js` — appel actuel à `resolveCareerRandomEffects` autour de
  la ligne 509-511 (`resolvedEffects.incomeMultiplier`/`incomePercent` consommés ligne 511). Étendre
  la consommation des nouveaux totaux (ceux qui existent réellement côté carrières, voir ci-dessus) :
  upsert `char_traits` (+ règle de conversion Opposant→Ennemi, `enemy_rule =
  '3_opposants_echangent_1_ennemi'`, §8.4), appel à `addMutation(sheetId, mutation_id, subtype_id)`
  (`server/src/services/mutationService.js:34`) pour `grant_mutation`. Pour `money_reward` : aucun
  jet à faire ici, juste lire `pick.moneyRoll` (déjà déterminé côté client via `DICE_ROLL`/
  `DICE_RESULT`, piège 12) et multiplier — ne pas introduire de logique de tirage dans ce fichier.
  `grantAdvantage()` (`advantageService.js` ~ligne 129) n'est **pas** nécessaire pour ce lot :
  `grant_advantage` n'apparaît dans aucune des 37 tables de métiers (piège ci-dessus), il sera
  consommé au Lot 3/4 (Revers) uniquement.
  **Avant d'écrire l'upsert `char_traits` et l'appel à `addMutation()` : appliquer les deux wipes
  décidés au piège 11** (`char_traits.where({char_sheet_id}).del()` et
  `char_mutations.where({char_sheet_id, source:'campaign'}).del()`, tous deux dans le même bloc
  STEP4 que le wipe existant de `char_skills`/`char_careers`). Sans ça, chaque ré-soumission du
  Wizard dupliquerait les gains Allié/Ennemi/Contact et ferait grimper le niveau d'une mutation
  sans nouveau tirage.

**Ne PAS faire dans ce lot** : le calcul par tranche de 5 ans (Lot 2), le résolveur de Revers
(Lot 3), le peuplement des données (Lot 6), l'UI (Lot 5).

**Tests requis avant de considérer le lot fini** — un cas réel par type, pas "au moins un" :
- Non-régression complète sur `chasseur_primes` (seul cas réel déjà mécanisé, migration 188) —
  mêmes résultats qu'avant l'extension.
- Cas neuf simple pour les 6 types déjà gérés + les 6 nouveaux, chacun sur une ligne réelle du §6 :
  `trait` → Artisan/5 (Allié) ; `celebrity_reward` → Pirate/5 ou Voleur/5 (Mise à prix, avec le
  paramètre Célébrité-déjà-accumulée non nul pour vérifier qu'il est bien pris en compte) ;
  `money_reward` → Marchand itinérant/4 ou Pirate/3, avec un `pick.moneyRoll` fixé (déjà déterminé,
  comme s'il venait d'un vrai `DICE_RESULT` — ne pas faire lancer de dé au résolveur pendant le
  test) ; `choice` → Chasseur de primes/4 (accepte ET
  refuse, les deux branches) ; `income_multiplier_permanent` → n'importe lequel des 15 cas (§8.1),
  y compris un test de non-cumul si le même résultat est simulé deux fois ; `grant_mutation` →
  Cultivateur/Éleveur/4 (seul cas dans les 37 métiers).
- `grant_advantage`/`manual_grant_choice`/`points_cap` : pas de données réelles disponibles côté
  carrières (voir ci-dessus) — un test unitaire isolé de la branche `switch` avec une entrée minimale
  est acceptable ici (ce n'est pas "inventer un scénario", juste vérifier qu'un type valide mais
  absent des 37 métiers ne casse rien s'il apparaît).
- Un type non géré (hors ces 9) doit faire échouer bruyamment (throw), jamais disparaître en
  silence (piège 1).
- `node --test` sur l'ensemble de `shared/` pour vérifier l'absence de régression transverse.

**Clôture du lot** : résumé Testé/Non testé, puis attendre le prochain "go" avant le Lot 2.

## 4bis. Lot 5 — détail actionnable `[FAIT, 2026-07-22]`

**But** : câbler l'UI du Wizard pour que le joueur puisse réellement déclencher les jets/choix que
les Lots 1-4 savent maintenant résoudre — sans ça, `resolveSetbackEffects`/`choice`/`money_reward`
n'ont aucune interface pour recevoir `answers`/`pick.choice`/`pick.moneyRoll`.

**Fichier concerné** : `client/src/components/creation/ProAdvantagesAndSetbacks.jsx` (déjà le
composant existant du tirage 1D10/Revers, à étendre, pas remplacer).

**Ce qu'il faut câbler** (lire `PLAN_WIZARD_AVANTAGES.md` §13 lot 5, §4 pour le modèle
manuel/auto-résolu) :
- Reducer pour la file de jets "suspense" (`chained_setback`) — un par un, joueur-initié, un clic
  par jet. Chaque jet passe par `socket.emit(WS.DICE_ROLL, {formula})` → `DICE_RESULT` (même circuit
  que le tirage 1D10 déjà existant dans ce fichier, piège 12 — ne PAS inventer un 2e circuit).
- Jets "détail" (`subroll`) : auto-résolus dans la foulée dès que le jet de suspense correspondant
  est connu — même circuit `DICE_ROLL`/`DICE_RESULT`, mais déclenché automatiquement par le code,
  sans bouton à cliquer (différence purement UX, piège 15/§1 du plan).
- UI à deux boutons pour `choice` (accepte/refuse ou équivalent) — stocke l'index choisi dans
  `pick.choice`/`answers[key]` selon le contexte (carrière ou Revers).
- `manual_grant_choice` : ne pas tenter de résoudre automatiquement — afficher le signal ("ce
  personnage doit recevoir X ou Y, variante à définir à table") ; le serveur écrit déjà la ligne
  `char_traits` `pending_*` correspondante (Lot 4 fait), l'UI n'a qu'à informer le joueur/MJ, pas à
  choisir à sa place.
- À chaque étape, appeler côté client la même logique de résolution que `resolveCareerRandomEffects`/
  `resolveSetbackEffects` (`shared/`, déjà réutilisables client+serveur par construction) pour savoir
  "qu'est-ce qui manque encore" (`{status:'pending', kind, key}`) — ne pas réinventer cette logique
  dans le composant React.

**Tests** : ce lot touche du React/UI — pas de test automatisé attendu ici (mémoire : pas de test
navigateur piloté par un agent). Tester manuellement dans le Wizard réel, scénario Accident (cascade
simple) puis Polaris (pire cas, 2 niveaux) au minimum.

**`[FAIT, 2026-07-22]` Réalisé, avec 2 écarts trouvés par rapport au plan ci-dessus — analyse
critique dédiée avant implantation, cf. mémoire du chantier** :
- **Lot 5a (préalable, `shared/`, testé)** : le contrat "pending" de `resolveSetbackEffects` ne
  suffisait pas pour l'UI — `chained_setback` (suspense, joueur-initié) et `subroll` (détail,
  auto-tiré) renvoyaient exactement la même forme `{kind:'roll', key, die}`, impossible à distinguer
  sans reparcourir `effects[]` côté client. Ajouté un champ `origin: 'chained_setback'|'subroll'`.
  Le pending `choice` ne portait qu'un compte d'options (`options: N`), pas de texte — ajouté un
  champ `label?` optionnel au schéma des options, surfacé en `options: [{label}]`. Tests étendus
  (`shared/setbackEffects.test.mjs`, 12/12).
- **Asymétrie career/Revers** : `resolveCareerRandomEffects` n'a pas de contrat pending (il lève une
  erreur si `pick.choice`/`pick.moneyRoll` manque) — contrairement aux Revers, les effets de carrière
  ne sont jamais imbriqués (un seul `choice` OU `money_reward` par ligne, jamais les deux, jamais
  récursif). Plutôt que forcer le même mécanisme récursif, nouvelle fonction pure dédiée et non
  récursive : `getPendingCareerPickStep(rolledRow, pick)` (`shared/careerAdvantages.js`, testée).
- **Lot 5b (UI, `ProAdvantagesAndSetbacks.jsx`, réécrit)** : reducer généralisé (`awaiting` unifié,
  un seul jet en vol tous domaines confondus, `setbackResolution` pour une cascade Revers en cours —
  ne rejoint `setbackRolls`/le payload envoyé au parent qu'une fois `resolveSetbackEffects` renvoyé
  `done`). Auto-tir des subrolls/money_reward via `useEffect` (jamais un clic), boutons pour
  chained_setback/choice. Prop `forcePolaris` ajoutée (`Step4Experience.jsx`, dérivée de
  `step5Data.advantages`, aucun nouvel appel réseau). Nouvelles classes CSS `.wiz4-choicebtn(s)`/
  `.wiz4-manual-note` et clés i18n (`creation.json`) — aucun texte UI codé en dur.
- **Vérifié** : `npx vite build` (compile sans erreur), `npx eslint` (0 warning), 116/116 tests
  `shared/*.test.mjs`. **Non vérifié** : aucun test navigateur réel (règle du projet, jamais piloté
  par l'agent) — scénarios à tester manuellement : Accident (cascade simple), Polaris avec/sans Force
  Polaris (palier 2), Complot (subroll + "Deux jets"), Emprisonnement (choice imbriqué),
  Chasseur de primes/4 (choice carrière), Marchand itinérant/4 (money_reward carrière).

**`[FAIT, 2026-07-22]` 3 corrections supplémentaires trouvées lors d'une 2e analyse critique dédiée,
après confirmation que l'UI était fonctionnelle** (Saar : "Fonctionnel... Analyse à charge") :
- **Persistance de `setbackResolution` manquante.** Naviguer entre sous-étapes (ex. Carrières puis
  retour sur Avantages & Revers) démonte/remonte `ProAdvantagesAndSetbacks` — `randomPicks`/
  `proAdvAllocations`/`setbackRolls` survivent déjà (remontés à `Step4Experience`), mais une cascade
  Revers EN COURS (`setbackResolution`, jamais synced) était perdue, forçant un nouveau jet 1D100.
  Corrigé en remontant `setbackResolution` à `Step4Experience.jsx` exactement comme les 3 autres
  (nouvelle prop `initialSetbackResolution`/`onSetbackResolutionChange`, jamais envoyée au serveur
  via `buildPayload`, purement un confort UI de sous-étape). `awaiting` (jet en vol), lui, ne doit
  jamais être restauré — aucun jet ne peut réellement être "en vol" après un remount.
- **Bug de course réel entre les 2 effets d'auto-tir.** Deux `useEffect` séparés (subroll Revers,
  money_reward carrière) lisaient tous deux `busy` au même rendu — si les deux conditions devenaient
  vraies simultanément (typiquement au montage, une fois `initialSetbackResolution` restaurable),
  les deux dispatchaient un `awaiting` différent et émettaient chacun un dé : le second écrasait le
  premier en state, et le DICE_RESULT du premier (déjà parti au serveur) s'attribuerait ensuite à
  tort au domaine du second. Fusionnés en un seul effet, Revers vérifié en premier puis carrière
  seulement si aucun dé Revers n'a été émis ce tour-ci — jamais les deux dans le même passage, mais
  une cascade qui attend un clic joueur (chained_setback/choice) ne bloque plus indéfiniment la
  carrière.
- **Contexte qui change après coup (Force Polaris) peut rendre un Revers déjà committé incomplet.**
  `force_polaris` est lu en LIVE (dérivé de `step5Data`, pas figé au moment du commit) — si le joueur
  résout Polaris (95) sans Force Polaris, va ensuite en Step5 la choisir, puis revient sur Step4, le
  recalcul d'affichage redevient `pending` (palier 2 désormais atteignable) pour une ligne déjà dans
  `setbackRolls`, sans mécanisme pour la compléter (`setbackResolution` reste `null` pour ce bloc) —
  bouton/choix affichés mais sans effet réel. Le serveur recalculera de toute façon la même chose au
  prochain reconcile et rejettera en 400 (même philosophie que tout le chantier : jamais un état
  figé) — autant l'anticiper côté UI. Corrigé par une réouverture automatique (`REOPEN_SETBACK_RESOLUTION`
  : sort le bloc de `setbackRolls`, le replace dans `setbackResolution`) dès qu'un committé recalculé
  redevient `pending` avec le contexte actuel.
- Les 3 corrections réutilisent le patron déjà en place (aucune n'a demandé de nouvelle décision
  d'architecture) — `npx vite build`/`eslint`/116 tests `shared/` toujours propres après coup.

**`[FAIT, 2026-07-23]` 4e correction, trouvée par Saar en testant en navigateur réel (pas une analyse
de code)** : les jets enchaînés (Attentat, 2 `chained_setback`) et auto-tirés (Choc psychologique,
`subroll`) ne montraient jamais leur résultat — le joueur voit des dés se lancer sans explication ni
retour, et la note `manual_grant_choice` affichait les codes bruts (`adv_044, adv_045...`) au lieu de
noms lisibles. Root cause : `resolveSetbackEffects` ne renvoyait jamais les valeurs déjà tirées à
l'appelant (le contrat pending/done ne portait que ce qu'il restait à faire, jamais ce qui avait déjà
été répondu), et l'UI n'avait jamais accès au catalogue `ref_advantages`.
- `shared/setbackEffects.js` : le résolveur renvoie désormais aussi `history` (liste des jets déjà
  répondus, target/valeur/hit pour chained_setback, valeur pour subroll/irradiation_reward) —
  construite pendant la MÊME traversée que la résolution, jamais une 2e passe dupliquée. Champ
  additif (`{...result, history}`), tous les appelants existants (serveur, UI) inchangés. 19 tests
  `setbackEffects.test.mjs` mis à jour + 2 nouveaux tests dédiés (Attentat, Choc psychologique,
  reproduisant exactement les deux cas remontés par Saar) + 3 assertions équivalentes ajustées dans
  `reversEffectsData.test.mjs`.
- `ProAdvantagesAndSetbacks.jsx` : séparateur visuel (`<hr class="wiz4-divider">`) entre le texte de
  règle et la résolution (proposition de Saar) ; journal des jets (`liveResolution.history`) affiché
  pendant ET après la résolution ; noms d'avantages résolus via un nouveau catalogue
  `advantagesCatalog` (prop, alimenté par `Step4Experience.jsx` réutilisant l'endpoint existant
  `/creation/:sheetId/step5/ref` — même source que Step5, aucune duplication).
- Même défaut trouvé côté carrières (`money_reward`, ex. Pirate/3, Marchand itinérant/4) : le montant
  réellement tiré n'était jamais affiché, juste "effet appliqué". Corrigé au même endroit (le
  multiplicateur vient de `rolledRow.effects`, le jet brut était déjà en state via `pick.moneyRoll` —
  aucune nouvelle donnée nécessaire).
- Nouvelles clés i18n (`creation.json`) : `setback_roll_hit`/`setback_roll_miss`/
  `setback_roll_detail`/`career_random_money_result`. Nouvelles classes CSS : `.wiz4-divider`,
  `.wiz4-rolllog(-item)`.
- **Testé** : 181/181 `shared/*.test.mjs`, `npx eslint` (0 erreur sur les fichiers touchés — une
  erreur `no-unused-vars` pré-existante sur `Step4Experience.jsx:122` (`showSetbacks`), hors de ce
  changement, signalée à Saar mais pas corrigée ici), `npx vite build` propre. **Non testé** :
  validation navigateur par Saar (règle du projet, jamais piloté par l'agent) — c'est justement ce
  qui a permis de trouver le bug d'origine, donc prioritaire à revérifier.

## 5. Lots 6-7 — pointeurs

- Lot 6 (peuplement des données) → §5 et §6 du plan en entier, un métier/Revers à la fois, chaque
  ligne testée individuellement contre le texte RAW (`docs/REGLES/REVERS PROFESSIONNELS.md` et
  `docs/REGLES/AVANTAGES ALEATOIRE.md`), pas seulement contre le contrat. Débloqué dès maintenant
  (Lots 1/3 faits) — peut avancer en parallèle du Lot 5.
- Lot 7 (clôture) → mise à jour `docs/EN_COURS.md` (vérifier s'il est toujours périmé), `docs/ASBUILT.md`,
  `client/public/CHANGELOG.md`.

### 5bis. Lot 6 (métiers) — plan d'attaque `[FAIT, 2026-07-23 — voir §5quater pour le réalisé]`

**`[FAIT, 2026-07-22]` La moitié Revers de ce plan d'attaque est terminée — voir §5ter pour le
détail. `[FAIT, 2026-07-23]` La moitié métiers ci-dessous est également terminée — voir §5quater.**

**Ce qui est déjà fait, à ne pas refaire** : les tableaux "effet en clair" par résultat (1D10 pour
chacun des 37 métiers, §6 du plan, ex. `docs/PLAN_WIZARD_AVANTAGES.md:779` pour Artisan/Artiste) sont
déjà rédigés et déjà vérifiés contre le Livre de Base (5 passes critiques, sessions antérieures). Le
Lot 6 n'est donc **pas** une nouvelle lecture des règles — c'est la **traduction** de ces tableaux déjà
vérifiés vers le vocabulaire JSONB `effects[]` (§8.1 du plan), ligne par ligne, ~360 entrées restantes
(37 métiers × ~10 résultats). Même méthode que les 27 Revers (§5ter) : un module `shared/` dédié aux
données réelles (source unique, testé), une migration qui l'importe, jamais de duplication.

**Numérotation** : vérifier `knex_migrations` (`npx knex migrate:status --knexfile knexfile.cjs`
depuis `server/`, read-only) ET le dossier avant de choisir, parité paire (Saar/Codex) — dernière
migration connue au 2026-07-22 : **194** (Revers, §5ter).

**Vérification par ligne** (ne pas sauter, c'est le point qui a fait échouer les passes précédentes
si bâclé, et qui a servi à trouver 3 mécanismes manquants pendant le peuplement des Revers, §5ter) :
chaque ligne migrée doit être relue contre le texte RAW exact du tableau §6 correspondant — pas juste
contre le résumé "effet en clair" (qui peut lui-même contenir une coquille de transcription non
détectée par les 5 passes précédentes, elles ont vérifié le texte RAW original, pas ce résumé).
Ajouter un test réel (`shared/*.test.mjs`) par ligne à effet mécanique (pas narrative) au moins pour
un échantillon représentatif de chaque métier. **Attention particulière** : vérifier pour chaque métier
si un effet chiffré (ex. "perd tous ses points de compétence") a une magnitude EXPLICITE ou nécessite
la perte totale (`points_cap`/`income_multiplier` à 0, §5ter) — ne jamais deviner un nombre absent du
texte RAW.

**Note de contexte (2026-07-22)** : la moitié Revers a été implantée dans cette même session
(43% de contexte restant au départ, mais le travail s'est avéré nécessiter une extension réelle du
résolveur — §5ter — pas seulement de la saisie, donc traité intégralement plutôt que reporté à
mi-chemin). Les 37 métiers restent à faire, dans une session fraîche.

### 5ter. Lot 6, moitié Revers — réalisé `[FAIT, 2026-07-22]`

**Fichiers** : `shared/reversEffectsData.js` (données réelles, source unique — `REVERS_ROLL_RANGES` +
`REVERS_EFFECTS_BY_NAME`), `shared/reversEffectsData.test.mjs` (28 tests, un par Revers + cas
composés), migration **194** (`server/src/db/migrations/194_ref_setbacks_revers_effects.js`, importe
et applique les données, **exécutée** — vérifié en base : `chk_char_mutations_source`... non, ici
`ref_setbacks.effects` — les 27 lignes contiennent le JSONB attendu, requête directe faite).

**3 mécanismes ajoutés, aucun n'existait avant ce lot** (trouvés en essayant de traduire Diffamation/
Trahison/Irradiation/Polaris tier 2 — pas de la saisie pure, une vraie extension du résolveur) :
- `trait` op `gauge_fraction_delta` + nouveau type `celebrity_fraction` (`shared/traitAggregation.js`,
  nouveau fichier, testé isolément) : Diffamation/Trahison ("perd un quart/la moitié de ses Alliés/
  Contacts/Célébrité") ont besoin d'une fraction du total déjà accumulé — le résolveur
  (`setbackEffects.js`) est une fonction pure sans accès DB, il ne peut jamais connaître ce total.
  Résolu en différant le calcul à l'agrégateur (`creationService.js`, qui voit tous les effets d'un
  coup) : fraction calculée contre le gain BRUT (avant toute fraction), jamais en cascade entre deux
  Revers du même type (décision documentée dans le fichier, pas de règle du jeu qui tranche l'ordre).
  Arrondi via `polarisRound` déjà décidé (`PLAN_WIZARD_AVANTAGES.md` §Lot C).
- `irradiation_reward` (`setbackEffects.js`) : Irradiation (2D10 cumulés) suit le même principe que
  `money_reward` (`careerAdvantages.js`, déjà existant côté carrières) — le résolveur ne lance jamais
  ce dé, la valeur est déjà connue via le circuit `DICE_ROLL`/`DICE_RESULT` existant.
- `subroll.condition` (`setbackEffects.js`) : Polaris tier 2 a une branche "Culte du Trident" qui
  n'est pas un Revers nommé (pas de `target` possible pour `chained_setback`) — un `subroll` direct
  avec son propre `choice()` convient mieux, mais doit être gaté par `force_polaris` comme le reste du
  tier 2 ; `subroll` n'avait pas ce garde-fou (seul `chained_setback` l'avait). Ajouté par symétrie.

**Corrections trouvées en vérifiant contre le texte RAW ligne par ligne** (pas seulement contre le
résumé "effet en clair" du plan, qui masquait ces écarts) :
- Le "stub" de test `shared/setbackEffects.test.mjs` (jamais le peuplement final, disclaimer déjà
  présent dans ce fichier) sous-estimait Bannissement, Fugitif : `skill_points -5` au lieu de la
  perte TOTALE réelle (RAW : "perd TOUS ses points de compétence" — aucun nombre, contrairement à
  Accident/Attentat qui disent "5 points"). Réutilisé `points_cap(skill_points, 0)` + `income_multiplier(0)`,
  le même mécanisme déjà en place pour Renvoi (plafond partiel à 5), jamais un nouveau type.
- Polaris (tête de pont) n'avait que 2 des 4 chaînes du tier 1 (Blessure, Deuil — Mutilation et
  Catastrophe manquaient) et 2 des 5 branches du tier 2 (Fugitif, Deuil — Ennemi important,
  Bannissement et Culte du Trident manquaient).
- Complot (tête de pont) n'avait que 4 des 7 branches (3-4 Emprisonnement, 5 Fugitif, 6-8 Mise à pied
  temporaire manquaient).
- Blessure (tête de pont) n'avait que 2 des 10 résultats du sous-jet (seuls FOR/CON étaient présents).
- `PLAN_WIZARD_AVANTAGES.md` §Lot C (l.533) référençait `adv_050` pour "Ennemi"/"Ennemi important" —
  contredit par sa propre correction du lendemain (l.513-516, contrainte unique `char_advantages`
  empêchant de compter). Résolu avec `char_traits` (déjà la bonne brique, §Lot C) ; "important" porté
  par le champ `note`, texte non consommé mécaniquement (même simplification que le reste des jauges).
- `manual_grant_choice` (Fugitif/Vendetta/Contrat→Recherché, Choc psychologique, Mutilation) utilisait
  des codes placeholder (`recherche_petite`, etc.) dans la tête de pont — remplacés par les vrais
  `advantage_id` (`adv_062`-`066` phobies, `adv_044`-`049` déséquilibres mentaux, `adv_067`/`068`
  Recherché, `adv_056`/`057` Infirmité — vérifiés en base, migration 92).

**Vérifié** : 28/28 tests `reversEffectsData.test.mjs`, 186/186 sur l'ensemble `shared/*.test.mjs` +
`server/src/services/*.test.mjs`, `node --check` sur tous les fichiers touchés, migration 194 exécutée
et données relues en base (les 27 lignes `ref_setbacks.effects` correspondent aux données attendues).
**Non vérifié** : consommation réelle en base par un vrai personnage (aucun scénario de bout en bout
joué dans le Wizard avec ces données — les tests couvrent le résolveur, pas encore l'intégration
`creationService.js` de bout en bout avec de vraies données de carrière) ; test navigateur (règle du
projet, jamais piloté par l'agent).

### 5quater. Lot 6, moitié métiers — réalisé `[FAIT, 2026-07-23]`

**Fichiers** : `shared/careerRandomEffectsData.js` (données réelles, source unique —
`CAREER_RANDOM_EFFECTS_BY_CODE`, 36 codes définis + 6 alias d'objet partagé pour les carrières dont le
tableau 1D10 est identique), `shared/careerRandomEffectsData.test.mjs` (21 tests), migrations
**196** (`server/src/db/migrations/196_ref_career_random_benefits_effects.js`, peuplement neuf, exécutée)
et **198** (`198_chasseur_primes_result4_choice.js`, correctif isolé, exécuté) — vérifié en base
directement (les lignes `ref_career_random_benefits.effects` des 37 métiers contiennent le JSONB
attendu).

**Protocole suivi, différent des lots précédents** : Saar a explicitement rejeté un `AskUserQuestion`
et demandé à la place un survol complet des 37 métiers pour lister TOUTES les questions ouvertes
d'abord, résolues ensemble ensuite en un seul batch (mémoire `feedback_no_questionnaire.md`) — pas de
migration corrective par petite ambiguïté. 10 questions ont été soumises en prose et tranchées par
Saar en une fois (Formation = choix libre parmi les compétences professionnelles du métier ; add_skill
fixe pour Prêtre du Trident/4 pour s'harmoniser aux autres Prêtres ; Alliés/Fournisseur = simple `+1`
sans note, pas de sur-conception ; etc.) avant tout code.

**2 nouveaux types d'effet, aucun n'existait avant ce lot** :
- `skill_choice {}` ("Formation") — le joueur choisit librement une compétence dans la liste
  professionnelle du métier (`ref_career_skills`). Résolu via un nouveau champ `pick.chosenSkillId`
  (résolveur throw si absent, jamais un silence) ; accumulé dans `totals.chosenSkills` ; consommé
  côté serveur (`creationService.js`) en validant l'ID contre le set des compétences du métier puis en
  l'ajoutant à `careersCtx[i].skills` — réutilise le budget/plafond déjà géré par
  `computeSkillAllocation`, aucun nouveau sous-système. `getPendingCareerPickStep` étendu en
  conséquence pour que l'UI sache qu'un choix manque.
- `add_skill { skill_id }` — octroi fixe (non choisi), utilisé uniquement pour Prêtre du Trident/4
  (Acrobatie/Équilibre + Combat armé, harmonisé avec les autres Prêtres suite à la décision de Saar).
  Même chemin de consommation qu'au-dessus via `totals.grantedSkills`.
- Câblage UI (`ProAdvantagesAndSetbacks.jsx`) : nouveau sélecteur `<select>` (classe `.wiz4-skillselect`)
  pour `skill_choice`, alimenté par les compétences du métier (`career.skills`, désormais avec `label`
  — `getStep4RefData` étendu pour le joindre) ; `hasPendingCareerStep` ajouté au calcul de `canNext`
  (gap réel préexistant comblé au passage, pas spécifique à `skill_choice` : aucun pending carrière ne
  bloquait "Suivant" avant ce lot).

**3 bugs de production réels trouvés et corrigés** (pas des coquilles de saisie de ce lot — des écarts
entre le RAW et une donnée déjà en base ou déjà résumée) :
- **Pirate/8** : le résumé "effet en clair" du plan disait "Groupe/Gang gratuit, narratif" (copié du
  Barman/3 ou Chasseur de primes/8 par erreur) — le RAW réel est "Transfert génétique : Célébrité +6,
  Relations +4, Allié +2", totalement différent. Corrigé en revérifiant le RAW ligne à ligne, pas
  seulement le résumé (même piège que celui documenté §5ter pour les Revers).
- **`chasseur_primes` résultat 4** (déjà mécanisé en production, migration 188) appliquait son bonus
  (`income_percent +20`/`celebrity +4`/`skill_points +4`) de façon **inconditionnelle**, alors que le
  plan avait depuis tranché que ce résultat est un choix accepte/refuse (comme Médecin/4,
  Mercenaire/4) — la migration 188, écrite avant cette décision, ne l'avait jamais reçue. Corrigé par
  la migration 198, **isolée** de la migration 196 (peuplement neuf) : un correctif sur une donnée déjà
  en production n'est jamais mélangé à un peuplement neuf, même numéro pair suivant immédiatement.
- **`[FAIT, 2026-07-23, 2e passe critique]` Pirate/3 ("Butin")** : le RAW dit "100 x 1D10 sols
  supplémentaires, Célébrité +2, Matériel +2" — seul le `money_reward` avait été repris dans la
  première traduction (migration 196), Célébrité/Matériel oubliés. Trouvé en revérifiant
  systématiquement chaque ligne à mécanisme spécial (`money_reward`/`celebrity_reward`/
  `grant_mutation`/`add_skill`, les 5 seuls cas sur 37 métiers) contre le texte RAW plutôt que contre
  le résumé — le test existant (`careerRandomEffectsData.test.mjs`) n'asserait que sur
  `moneyRewardSols`, jamais sur les deux autres effets de la même ligne, ce qui avait laissé passer
  l'omission. Corrigé par la migration **200**, même isolation que 198 (correctif sur donnée déjà en
  production, jamais mélangé à un peuplement neuf). Test étendu pour asserter les 3 effets de la
  ligne, pas seulement celui qui motivait le test à l'origine.

**1 cas manquant, trouvé et catalogué** : Voleur/Criminel résultat 7 ("revenus doublés à partir de
cette année") est un 16e cas `income_multiplier_permanent`, non listé parmi les "15 cas connus" du
tableau vocabulaire du plan (`PLAN_WIZARD_AVANTAGES.md` §8.1) — trouvé en relisant le RAW multiligne
(un grep single-line avait raté plusieurs occurrences à cause d'un artefact de coupure de mot dans le
document source, ex. "par￾tir" scindant "partir").

**1 bug introduit puis corrigé pendant la rédaction des tests** : 14 entrées de type `choice` avaient
été écrites comme objets nus (`5: {...}`) au lieu de tableaux à un élément (`5: [{...}]`) — aurait levé
"not iterable" dans `resolveCareerRandomEffects` (`for (const effect of row?.effects ?? [])`). Trouvé
avant tout commit via inspection directe, corrigé par un script regex ciblé, revérifié par la suite de
tests complète.

**1 sur-correction trouvée lors d'une 2e analyse critique dédiée** (demandée explicitement par Saar,
"Analyse critique et profonde") : Assassin résultat 8 portait une note non demandée
(`'fournisseur_possible'`) sur son octroi `ally`, contredisant l'instruction explicite de Saar
("Alliés/Fournisseur = juste un +1, simple"). Retirée (donnée + test + ligne DB resynchronisée). Le
reste de cette 2e passe (noms de catégorie exacts par métier, invariant "jamais de `choice`/
`skill_choice`/`money_reward` imbriqué dans une branche de `choice`", portée exacte de
`income_multiplier_permanent` par métier) n'a trouvé aucun autre problème.

**Vérifié** : 21/21 tests `careerRandomEffectsData.test.mjs`, 179/179 sur l'ensemble `shared/*.test.mjs`
(0 régression, y compris non-régression `chasseur_primes` avant/après migration 198), 33/33
`server/src/services/*.test.mjs`, `node --check` sur tous les fichiers touchés, migrations 196/198/200
exécutées et données relues en base directement (requête directe sur `ref_career_random_benefits`
pour `pirate`/roll=3 après la migration 200). **Non vérifié** : scénario réel de bout en bout dans
le Wizard (aucun personnage réellement créé avec ces données) ; test navigateur (règle du projet,
jamais piloté par l'agent) — en particulier le sélecteur "Formation" (`skill_choice`) et le blocage
`hasPendingCareerStep` sur "Suivant".

Ne jamais commencer un lot sans avoir relu ses pointeurs, même si le lot précédent vient d'être fait
dans la même session.
