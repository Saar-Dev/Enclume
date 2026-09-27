# PLAN_GUERISON_RAW — Guérison, infection et cases des blessures : se conformer au texte du livre

> 2026-09-26 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé dans `docs/Old/` et fusionné dans `docs/SYSTEME/BLESSURES.md` une fois clos.
> Statut : 🟡 **Cadré le 2026-09-26. Lot A CLOS et poussé (`79f5557`, validé en jeu). Lot B1 (un seul Test d'infection par localisation) CLOS, poussé (`e24da4c`), validé en jeu (migrations 365-366). Lot B2 (réponse de l'écran par localisation) CLOS, validé en jeu (255 tests en base + 17 tests client + 882 tests purs verts, build client OK).** Il reprend et remplace le ticket `WOUND-HEAL-LINE-CAPACITY` (bug n°2 de la résolution de bugs) et le ticket
> `WOUND-FULL-LINE-TWO-CONVENTIONS`. Suite de `PLAN_REVUE_GUERISON.md` (écran de revue, Lots 0-2a livrés).
> Base de travail : **`docs/MANUELS/MANUEL_BLESSURES.md`** (V1, 2026-09-26 : le chapitre du livre traduit et vérifié, à valider par Saar) — le §2 ci-dessous n'en est que l'extrait utile ; en cas de divergence, le manuel prévaut.
> Hiérarchie : **Livre de Base Polaris (`docs/REGLES/REGLEBLESSURES.md`)** > `SYSTEME/BLESSURES.md` > ce plan.

---

## 1. Décision de Saar (2026-09-26)

Saar a donné plusieurs lectures de la règle (« 3 Légères = 1 Moyenne », « la guérison n'intervient qu'une fois par localisation, la plus légère d'abord »), puis : *« Si tu arrives à comprendre et
faire fonctionner un système de guérison à partir du RAW, go. C'est LA solution idéale. Ce que je te livre, ce sont MES interprétations. »* — **le texte du livre fait autorité** ; ses lectures
antérieures (dont « la dernière case convertit », `Old/COMPARATIF.md` : « texte RAW ambigu, tranché par Saar ») ne sont plus des décisions à préserver. Toute lecture retenue ici est écrite ; tout
écart avec le texte est une décision de Saar journalisée (`docs/JOURNAL8.md`, invariant 5).

## 2. Ce que dit le livre — extraction (`REGLEBLESSURES.md`)

| # | Règle du livre | Lignes |
|---|---|---|
| **R1** | **Cases** : chaque ligne (localisation × gravité) a un nombre de cases. « **Lorsque toutes les cases d'une ligne sont cochées et que le personnage subit une nouvelle blessure de cette gravité** : 1. cocher une case dans le degré supérieur, 2. effacer les blessures de la ligne complète. » La ligne doit donc être PLEINE avant la nouvelle blessure : sur la tête, 3 Légères coexistent, la 4ᵉ convertit. | 47-53 |
| **R2** | **Durée de guérison** : « la durée minimum nécessaire pour qu'une blessure diminue et se transforme en une blessure de gravité inférieure » ; un Membre détruit devient une Critique. Chaque blessure a **sa** période. | 363-368, 413-433 |
| **R3** | **Soins** : Médecine, ou Premiers soins pour les moins graves ; Chirurgie **avant** toute phase de soins pour les plus graves ; difficulté par gravité (table). | 369-385 |
| **R4** | **Par localisation** : « traitées Localisation par Localisation, **quel que soit le nombre de cases cochées sur chaque ligne** (le médecin guérit un « bras », plutôt qu'une « blessure sur le bras ») ». **-2 au Test par case cochée en plus de la première.** Soins constants : un Test de Médecine **par semaine** (Critique, Mortelle, Membre détruit). | 386-392 |
| **R5** | **Réussite** : la guérison est en bonne voie ; « s'il est arrivé à la fin de la période de guérison qui correspond à **sa** blessure, celle-ci diminue d'un niveau ». | 393-395 |
| **R6** | **Échec** : « un (et un seul) Test de Constitution pour la période en cours » (infection). | 395-398 |
| **R7** | **Catastrophe** = absence totale de soins : un Test de Constitution **tous les deux jours** pendant la période en cours. | 398-401 |
| **R8** | **Guérison naturelle** : Légère guérit seule ; Moyenne et Grave peuvent se passer de soins ; toute blessure non soignée qui en réclame risque l'infection. | 402-407 |
| **R9** | **Infection** : « tous les deux jours, et pour chaque **Localisation** présentant une ou plusieurs blessures susceptibles de s'infecter et non soignée correctement », un Test de Constitution — Moyenne +5 (échec : une case de plus sur la ligne Moyenne, « avec le risque de **dépasser la capacité** de cette ligne, et donc de subir une blessure de gravité supérieure ») ; Grave 0, -2 par case en plus (échec : une case de plus) ; Critique -5, -2 par case en plus (une case de plus **même en cas de réussite**) ; Mortelle / Membre détruit -10 (gangrène : survie = Constitution heures, ou la moitié sur un échec ; amputation d'un membre). | 439-485 |
| **R10** | **Malus de période** (Grave, Critique) : -2 par période de deux jours sans soins corrects. | 452-466 |
| **R11** | **Suractivité** : jugée par le MJ ; une case de plus sur la ligne de la blessure la plus grave. | 489-505 |
| **R12** | **Stabilisation** (échelle de minutes, **autre mécanique**) : « traitées Localisation par Localisation, **les degrés de gravité les plus élevés étant prioritaires** ». C'est le SEUL endroit du livre qui ordonne les blessures d'une localisation, et l'ordre est le plus grave d'abord. | 341-343 |

**Ce que le livre NE dit PAS** : rien n'y impose qu'**une seule** blessure guérisse par tick de localisation, ni « la plus légère d'abord » pour la guérison (R12 est l'inverse, et vaut pour la stabilisation). Deux
Légères de même ligne, dues le même jour, suivent R4 : elles sont traitées ensemble.

## 3. Conformité du code actuel

| Règle | Code | Verdict |
|---|---|---|
| R1 cases | *Avant le Lot A* : `isWoundLinePromoted` convertissait la blessure qui **remplirait** la dernière case (3ᵉ Légère sur 3 cases), sauf Mortelle | **DIVERGENT** (lecture de Saar, texte pris à l'envers) → **corrigé par le Lot A** : `isWoundLineFull`, une seule définition |
| R1 côté Chance | `hasSeverityRoom` : `count < max` (littéral) | conforme ; *avant le Lot A* deux notions de « pleine » coexistaient (ticket `WOUND-FULL-LINE-TWO-CONVENTIONS`), désormais une seule |
| R1 côté guérison | *Avant le Lot A* : `resolveWoundImprovement` écrivait la case sans vérifier la place | **DÉFAUT** (`WOUND-HEAL-LINE-CAPACITY` : 5 Légères pour 3 cases) → **corrigé** : la guérison pose par `resolveWoundInsertion` |
| Cases par ligne (relevé de Saar sur la fiche, `MANUEL_BLESSURES.md` 2.2) | `WOUND_MAX_COUNTS` : Tête 3/3/2/2/1/1, Corps 4/3/3/2/2/1, Bras et Jambes 3/3/2/2/1/1 | **conforme** (comparé ligne à ligne le 2026-09-26) |
| R2 durées, R4 soins constants | `WOUND_HEALING` (+ test d'anti-dérive vs `DUREE_GUERISON_SOINS_TABLE`), échéance hebdomadaire | conforme |
| R5 | à la fin de **sa** période, une échéance par case | conforme |
| R6 | Échec → UNE échéance d'infection ponctuelle **par case** | approché : le livre parle d'un Test **par localisation** |
| R7 | Catastrophe → infection récurrente (2 jours) sur la fenêtre de la période | approché (idem, par case) |
| R9 modificateurs, R10 | `WOUND_INFECTION` : +5 / 0 / -5 / -10, -2 par case, -2 par période | conforme ; « Mortelle sans case de plus » = décision assumée (survie affichée au MJ, jamais appliquée) |
| R9 par localisation | une infection par case (chacune son jet) | **DIVERGENT** : un Échec sur 3 cases d'une localisation lance 3 jets là où le livre en lance 1 |
| R4 « par localisation » (écran) | une réponse par **ligne** ; la carte de personnage répond pour tout | approché |
| R3 / R8 | le MJ décide l'issue (Réussite / Échec / Catastrophe) ; aucun jet serveur de Médecine | par choix (décision d'origine 2026-07-29) |
| R11, R12 | non implémentés | hors périmètre |

## 4. Lots (un par tour : plan exact → analyse à charge → code → validation de Saar)

| Lot | Contenu | Livre |
|---|---|---|
| **A — Les cases** | **Une seule règle de « ligne pleine », celle du livre** : la ligne convertit quand elle est PLEINE et qu'une nouvelle blessure de cette gravité arrive (`count >= max`, pour TOUTES les lignes — l'exception Mortelle devient la règle générale). La guérison ne contourne plus la règle : une blessure qui guérit se pose comme n'importe quelle nouvelle blessure (`resolveWoundInsertion`), donc une ligne pleine est effacée et la case est cochée au-dessus. La Chance (`hasSeverityRoom`) et l'aggravation partagent la même fonction. Corrige `WOUND-HEAL-LINE-CAPACITY` et `WOUND-FULL-LINE-TWO-CONVENTIONS`. | R1 |
| **B — Un Test par localisation** | La réponse de l'écran de revue devient **par localisation** (toutes ses blessures échues) ; un Échec ou une Catastrophe lance **un** Test de Constitution par localisation et non un par case (malus de -2 par case en plus, déjà au seuil) ; à plusieurs gravités dans une localisation, lecture à écrire (le livre donne une table par gravité). **Plan à écrire après le Lot A.** | R4, R6, R7, R9 |
| **hors périmètre** | Suractivité (R11), Stabilisation (R12, échelle de minutes), jets de Médecine / Chirurgie par le serveur (R3), application automatique de la survie (R9) | — |

## 5. Lot A — plan exact (avant analyse à charge)

**Invariant** : « ligne pleine » = une seule fonction partagée (`shared/woundConstants.js`), lue par l'aggravation, la guérison et la Chance. **Un seul problème** : la règle des cases du livre, partout.

**Fichiers** : `shared/woundConstants.js` (+ test) — `isWoundLinePromoted` littérale, `OVERFLOW_ONLY_SEVERITIES` supprimée ; `server/src/lib/woundUtils.js` (+ test) — `resolveWoundInsertion` accepte `{ isStabilized, occurredAtGameMinutes }`
et les transmet à la case finale ; `resolveWoundImprovement` s'appuie sur `resolveWoundInsertion` (la boucle « ligne pleine → effacer → monter » écrite le 2026-09-26 disparaît : une seule règle) ; `hasSeverityRoom` = négation de la même fonction ;
`server/src/lib/woundEvolutionService.js` (trace) ; `docs/SYSTEME/BLESSURES.md`, `docs/SYSTEME/CONVENTIONS.md` (P65), `docs/JOURNAL8.md`. Aucune migration.

**Propriété à prouver** (analyse à charge) : une guérison qui remonte par la cascade **ne dépasse jamais sa gravité d'origine** (la case d'origine vient d'être supprimée : sa ligne a au plus `max - 1` cases, donc une place) ;
la Chance n'ouvre jamais de réduction que `resolveWoundInsertion` refuserait ; la Mortelle garde son comportement (une 2ᵉ Mortelle à la tête déborde vers la 6ᵉ ligne).

**Écart de comportement assumé** : la 3ᵉ Légère sur la tête (3 cases) ne convertit plus ; la 4ᵉ convertit (les 3 sont effacées, une Moyenne est cochée). Les fiches existantes ne sont pas touchées ; la ligne Légère à 5 cases de Baboulinet
(tête) sera traitée à part (main ou script, choix de Saar).

**Tests** : pur (`isWoundLinePromoted` sur toutes les lignes, y compris 1 case) ; base (aggravation littérale, cascade à 2 lignes, guérison sur ligne pleine, Membre détruit, annulation d'avance, Chance inchangée, 6ᵉ ligne) ; les tests qui
encodaient l'ancienne lecture sont **réécrits et journalisés**, jamais supprimés en silence.

---

## 6. Lot A — analyse à charge (2026-09-26)

Marquage : [VÉRIFIÉ] = lu dans le code ou exécuté ; [HYPOTHÈSE] = lecture non tranchée par le livre.

**Ce que le changement fait** [VÉRIFIÉ] : la règle « la ligne convertit quand elle est PLEINE » (`count >= max`) devient l'unique règle, pour toutes les lignes. Le seuil actuel (`max - 1`) ne subsiste plus ; l'exception Mortelle
disparaît (elle n'en est plus une : avec `count >= max`, la 2ᵉ Mortelle à la tête déborde déjà, comme aujourd'hui). Lecture des appelants : `resolveWoundInsertion` a trois appelants (`applyWound` = dégâts, route d'ajout manuel via `applyWound`,
infection = case en plus) ; `resolveWoundImprovement` en a deux (handler de guérison, Chance). Aucun autre code ne connaît la notion de promotion (`isWoundLinePromoted` et `OVERFLOW_ONLY_SEVERITIES` : lus uniquement par `woundUtils.js` et un test).

**Propriété prouvée — une guérison ne dépasse jamais sa gravité d'origine** [VÉRIFIÉ par raisonnement, puis par test] : la case d'origine S est supprimée avant la pose ; la cible T est strictement sous S
(`improvedSeverity` : le cran du dessous, ou Critique pour la 6ᵉ ligne) ; la cascade monte d'un cran à la fois (`nextSeverity`) et rencontre S au plus tard ; à S, la ligne compte au plus `max - 1` cases
(un état valide n'en a jamais plus de `max`) : il y a de la place, la cascade s'y arrête. **Reste un cas hors état valide** : une ligne DÉJÀ au-dessus de sa capacité (l'ancien défaut « 5 Légères pour 3 cases » a pu en laisser) : à S elle serait « pleine »
et la guérison aggraverait la blessure. Parade : la guérison passe un **plafond** (`ceilingSeverity` = gravité d'origine) à `resolveWoundInsertion` ; à ce niveau la case rendue par la blessure guérie est réutilisée, la ligne n'est jamais jugée pleine.
Dans un état valide le plafond ne change rien (testé) ; dans un état corrompu il empêche d'empirer. État de la base locale (lecture, 2026-09-26) : **aucune ligne au-dessus de sa capacité** (15 lignes, 3 pleines : Baboulinet bras gauche Légère 3/3, deux Mortelles 1/1).

**Cohérence Chance** [VÉRIFIÉ] : la Chance ne propose une réduction que vers un palier avec de la place (`hasSeverityRoom` = « pas pleine ») et REVÉRIFIE à la réponse (`woundService.js:369`) ; avec une seule définition de « pleine », la pose ne
peut plus convertir sous ses pieds (le défaut d'origine : la Chance vérifiait la place, la pose « remplissait » et convertissait — points perdus). L'exception « palier plein » (`REGLE_CHANCE.md:125-131`) descend jusqu'au premier palier libre : inchangée.

**Ce qui change en jeu (écart assumé, conforme au livre)** [VÉRIFIÉ par lecture des capacités] : une ligne se remplit entièrement avant de convertir. Tête : 3 Légères tiennent (la 4ᵉ convertit), 3 Moyennes, **2 Graves, 2 Critiques** (la 3ᵉ convertit) ;
Corps : 4 Légères, 3 Moyennes, 3 Graves, 2 Critiques, 2 Mortelles ; Bras/Jambes comme la Tête. Un personnage encaisse donc **une blessure de plus par ligne avant de convertir** (sauf Mortelle, inchangée). Les fiches existantes ne sont pas touchées.
Une guérison qui aboutit sur une ligne pleine efface la ligne et coche la case au-dessus (jusqu'à la gravité d'origine) : « la règle des cases est toujours valable durant la guérison » (Saar, 2026-09-26) ; le livre ne le dit pas explicitement (Q3, hypothèse
du manuel, non bloquante) [HYPOTHÈSE confirmée par Saar].

**Conséquence sur l'interface, à connaître** [VÉRIFIÉ, `LocationPanel.jsx:156-175`] : la saisie manuelle sur la fiche ne peut plus provoquer une conversion : une ligne pleine n'a plus de case vide à cliquer (avant, la dernière case cliquée convertissait).
La conversion se produit à la prochaine blessure reçue par le combat (`applyWound`) ou par l'infection ; à la main, le MJ coche la case du dessus et efface la ligne lui-même. Non traité ici (aucune interface inventée) ; noté comme suite possible.

**Hors périmètre découvert** [VÉRIFIÉ] : le compteur d'**Avaries des exo-armures** (`exoAvarieService.js:70`, `exoConstants.js:80-82`) recopie la même lecture « la case qui complèterait la ligne convertit » ; le livre (`REGLEARMURE.md:335-337`,
« quand une ligne est complète alors qu'on doit noter une Avarie de cette gravité ») est aussi littéral. Ticket créé (`EXO-AVARIE-LINE-CONVENTION`) ; corriger demande sa décision (les cases du compteur d'exo ont été « confirmées » séparément, PLAN_EXOARMURE §11.2) et
peut réutiliser la fonction partagée du Lot A.

**Tests qui encodent l'ancienne lecture** (à réécrire et journaliser, jamais supprimer en silence) : `shared/woundConstants.test.mjs` (3 tests `isWoundLinePromoted`) ; `woundUtils.test.mjs` (cascade Moyenne 2 cases, une promotion ne programme que la case finale,
cascade complète à la tête, cascade qui s'arrête sur la Mortelle vide, échéances des cases fusionnées) ; `woundService.test.mjs` (promotion en cascade annule les échéances) ; `woundEvolutionService.test.mjs` (infection : la ligne déborde). Docs : `BLESSURES.md`,
`CONVENTIONS.md` P65, `VOCABULARY.md` (Débordement), `EN_COURS.md` (P63-P65), `PLAN_BLESSURE_SIXIEME_LIGNE.md` (note datée), entrée `JOURNAL8` « guérison sur ligne d'arrivée pleine » à réécrire.

---

## 7. Lot B — plan (2026-09-26, avant analyse à charge ; Lot A poussé `79f5557`)

Marquage : [VÉRIFIÉ] = lu dans le code ; [HYPOTHÈSE] = lecture non tranchée par le livre.

### 7.1 Ce que le code fait aujourd'hui [VÉRIFIÉ]
- **Guérison** : UNE échéance par case (`woundHealingSchedule.js`, `payload.woundId`) — conforme à R5 (chaque blessure a sa période). L'écran regroupe déjà par **ligne** (localisation × gravité) et par personnage ; le MJ peut répondre ligne par ligne (geste d'exception).
- **Infection** : un Échec (ou une Catastrophe) de la guérison d'une case crée UNE échéance d'infection **par case** (`buildInfectionSpawn`, `payload.woundId`) ; chacune lance son propre jet, calcule son seuil sur la gravité de SA case (`computeWoundInfectionThreshold`) et, sur un Échec, coche une case de plus.
  Écart avec R9 (« pour chaque **Localisation** … un Test de Constitution ») : 3 Moyennes à la Jambe gauche + un Échec = **3 jets** et jusqu'à 3 cases de plus, là où le livre en veut **un**. Et à plusieurs gravités dans une localisation, chaque case lance son jet au lieu d'un seul, sur la pire blessure (Q5, tranchée par Saar).
- Une échéance d'infection vit et meurt avec **sa case** (`cancelWoundEcheances`, Lot 0) ; le jet du joueur (`socketDice.js`, `WOUND_INFECTION_ROLL`) et le jet automatique (`woundReviewBatchService.js`) lisent `payload.woundId`.

### 7.2 Deux lots, dans cet ordre (un problème par lot)
| Lot | Problème | Livre |
|---|---|---|
| **B1 — Un seul jet d'infection par localisation** | l'infection appartient à une **localisation** (personnage + localisation), plus à une case ; un Échec ou une Catastrophe n'en crée jamais plus d'une par localisation ; le seuil se calcule sur la **pire** blessure susceptible de s'infecter de la localisation | R6, R7, R9, Q5 |
| **B2 — Une seule réponse de Test de soins par localisation** | l'écran répond par **localisation** (toutes ses blessures échues, quelle que soit la gravité) au lieu de par ligne ; le serveur refuse deux issues différentes pour la même localisation dans un même lot | R4 |

B1 d'abord : c'est lui qui corrige le jeu (nombre de jets). B2 est un regroupement d'écran + une garde serveur ; sans B1, il ne changerait rien aux jets.

### 7.3 B1 — modèle visé
- **Identité** : une échéance d'infection = (personnage, localisation) ; `payload: { location, periodesSansSoin }` (plus de `woundId`). Au plus **une** échéance vivante par (personnage, localisation).
- **Création** : la guérison en Échec/Catastrophe appelle UNE fonction « assurer l'infection de la localisation » (idempotente, indépendante de l'ordre des cases traitées) : rien de vivant → elle crée ; une échéance vivante existe → elle **fusionne** (une infection récurrente l'emporte sur une ponctuelle ; la fenêtre la plus longue ; l'échéance la plus proche). Les modifications entrent dans les entrées d'annulation d'avance (ce qui ferme aussi `ECHEANCE-SPAWN-UNDO` pour ce cas).
- **Résolution** : le handler lit les blessures **au moment du jet** : la pire blessure susceptible de s'infecter (`WOUND_INFECTION`) fixe le modificateur, le malus de cases (Q6), le malus de période, l'effet (case en plus sur SA ligne — règle des cases du Lot A —, ou délai de survie). Aucune blessure susceptible : l'échéance se termine sans jet.
- **Mort de l'échéance** : `deleteWoundRows` (seul suppresseur) annule aussi l'infection d'une localisation qui n'a plus AUCUNE blessure susceptible de s'infecter (retournée dans `cancelledEcheances`, donc restaurée par l'annulation d'avance).
- **Seuil** : une seule fonction `computeLocationInfectionThreshold` (jet automatique du MJ ET jet du joueur, aujourd'hui deux appelants de `computeWoundInfectionThreshold`).
- **Données** : une migration convertit les infections **vivantes** existantes (blessure → localisation, doublons d'une même localisation fusionnés, sans blessure → annulées) ; les infections terminées gardent leur ancien payload (historique, jamais relu).
- **Fichiers probables** : `woundEvolutionService.js` (handlers, seuil), `woundHealingSchedule.js` (création, annulation), `woundUtils.js` (`deleteWoundRows`), `woundReviewService.js` (vue : une infection par localisation), `woundReviewBatchService.js`, `socket/socketDice.js`, `PendingRollsPanel.jsx` (libellé), une migration, tests, `docs/SYSTEME/BLESSURES.md`.

### 7.4 Lectures retenues (à confirmer par Saar)
| Sujet | Lecture retenue | Statut |
|---|---|---|
| **Q6** — cases « en plus de la première » pour le malus de −2 de l'infection | Les cases de la **ligne de la pire blessure** susceptible de s'infecter (pas toutes les cases de la localisation) | **TRANCHÉE par Saar** (2026-09-26 : « on ne compte que les cases de la pire blessure ») |
| Q7 — après un Échec/une Catastrophe | La guérison de la case reprend une période plus tard (Moyenne/Grave : la durée de la gravité ; soins constants : 1 semaine) — comportement actuel | [HYPOTHÈSE] = code actuel |
| Q8 — cadence du Test de soins Moyenne/Grave | Un seul Test, à la fin de la période — comportement actuel | [HYPOTHÈSE] = code actuel |
| Q10 — début du cycle d'infection | Le jour de l'Échec (échéance de guérison), puis tous les 2 jours sur la période — comportement actuel | [HYPOTHÈSE] = code actuel |
| Période d'une Catastrophe quand plusieurs blessures échues n'ont pas la même période | La plus longue (la fusion prend la plus longue fenêtre) | [HYPOTHÈSE] |
| Un Échec quand une infection de la localisation est déjà vivante | Aucun jet de plus : une localisation = un jet par période de deux jours | [HYPOTHÈSE] (conséquence de « pour chaque Localisation ») |

---

## 8. Lot B1 — analyse à charge (2026-09-26)

**Lecture des lecteurs de `payload.woundId` d'une infection** [VÉRIFIÉ] : `woundEvolutionService.js` (handler + seuil), `woundHealingSchedule.js` (création, annulation avec la case), `woundReviewService.js` (vue de l'écran, jets en attente du joueur),
`woundReviewBatchService.js` (jet automatique), `socketDice.js` (jet du joueur), `PendingRollsPanel.jsx` (libellé) ; les tests de ces fichiers ; un script historique (`cancel_ghost_wound_echeances_20260925.js`, à usage unique, non touché).
Base locale : 3 infections vivantes (même personnage) — à convertir.

**Défauts trouvés dans mon plan (corrigés avant de coder)**
1. **Annulation prématurée** : faire annuler l'infection par `deleteWoundRows` quand une localisation n'a « plus de blessure susceptible » la tuerait à tort pendant une **promotion** (la ligne est effacée AVANT que la case du dessus soit cochée : un coup qui convertit 3 Moyennes en Grave perdrait l'infection alors que la Grave est infectable).
   → l'annulation se règle **à la fin de l'opération publique** (`resolveWoundInsertion` après promotion, `resolveWoundImprovement`, suppression directe), jamais au milieu d'une cascade ; `deleteWoundRows` reçoit une option `settleInfections` (vrai par défaut, faux dans la cascade et l'amélioration, qui règlent une fois à la fin).
2. **Concurrence** : deux lots simultanés pourraient créer deux infections pour la même localisation → une contrainte d'**unicité en base** (index unique partiel : une infection vivante par personnage et localisation), migration séparée (règle `migrations.md` : structure / contraintes). Le doublon perdant échoue dans son savepoint et l'entrée est annulée (le MJ recommence, la fusion s'applique).
3. **Fin de vie** : l'ancienne règle « l'infection meurt avec sa case » n'existe plus ; elle vit sa fenêtre (Catastrophe) ou son jet (Échec) tant que la localisation a une blessure susceptible ; sinon elle est annulée avec la dernière (journalisée : annuler l'avance la restaure).
   Différence de comportement vs avant [VÉRIFIÉ par lecture] : une Critique qui guérit en Grave ne tue plus « son » infection (la localisation porte toujours une blessure susceptible) — décision consignée, à voir en jeu.

**Ordre d'écriture** (nodemon applique les migrations dès l'écriture d'un fichier sous `server/`) : le code d'abord, les migrations en DERNIER (conversion des infections vivantes, puis contrainte d'unicité).

**Fusion** (`ensureLocationInfection`, idempotente) : rien de vivant → création ; vivante → récurrente l'emporte sur ponctuelle, occurrences les plus nombreuses, échéance la plus proche ; aucun changement → aucune entrée d'annulation.

---

## 9. Lot B2 — plan : l'écran répond par localisation (2026-09-26, avant analyse à charge)

Marquage : [VÉRIFIÉ] = lu dans le code ; [HYPOTHÈSE] = lecture non tranchée par le livre.

### 9.1 Le problème [VÉRIFIÉ]
Le livre (R4, l. 386-392) : « traitées **Localisation par Localisation**, quel que soit le nombre de cases cochées sur chaque ligne ». Aujourd'hui l'écran de revue répond par **ligne** (localisation × gravité) : une Jambe gauche avec 2 Moyennes et 1 Grave montre
DEUX blocs, chacun avec ses boutons (`WoundReviewLine.jsx`) ; le MJ peut donc mettre Réussite sur l'un et Échec sur l'autre, alors que le livre ne connaît qu'UN Test par localisation. Rien, côté serveur, ne l'empêche (`resolveHealingChoices` accepte n'importe quelle combinaison d'issues).
L'unité « ligne » vient de la vue (`buildLine`, clé `localisation:gravité`), pas du livre. Depuis B1, le seul autre écart avec R4 est cette unité de réponse : les jets d'infection sont déjà par localisation.

### 9.2 Modèle visé
- **Unité de réponse = (personnage, localisation)** : UNE issue (Réussite / Échec / Catastrophe) pour toutes les échéances de guérison **échues** (répondables) de cette localisation, quelle que soit la gravité. Les échéances non échues ou pas encore ouvertes (`active`, prochaine ronde) ne sont pas concernées : elles auront leur Test à leur date [HYPOTHÈSE = Q8, comportement actuel : un Test à la fin de la période de la blessure].
- **Le serveur garde l'invariant** (autorité unique, jamais la seule vue) : `resolveHealingChoices` refuse (409, rien d'écrit) un lot qui, pour une localisation, ne contient pas TOUTES ses échéances répondables, ou leur donne des issues différentes. Une échéance périmée (`stale`) ou non ouverte n'entre pas dans le compte.
  Choix « toutes ou aucune » plutôt que « même issue dans le lot » : deux clics successifs sur deux gravités de la même localisation feraient sinon deux Tests ; l'exigence de complétude ferme aussi ce cas.
- **Une seule fonction pure de regroupement** (`groupHealingByLocation`, dans `woundReviewService.js`) lue par la vue ET par la garde : jamais deux définitions de « quelles échéances forment un Test ».
- **La vue** : `card.lines` (ligne = localisation × gravité) devient `card.locations` : `{ key, location, severity (la pire gravité échue), dueCases, queuedCases, answerable, dueEcheanceIds (toutes les échues de la localisation), kits, lines: [détail par gravité, lecture seule : cases, échues, gravité d'arrivée, étapes] }`.
  **Kits** : un seul jeu par localisation — celui de la pire gravité échue (Q5 : « le Test porte sur la pire blessure » ; à égalité, celui du premier Test) ; `kitTotals` = un jeu par localisation répondable. Le décompte reste AFFICHÉ, jamais consommé (décision de Saar).
- **Le client** : `healingEntriesForLocation(location, outcome)` remplace `…ForLine` ; le détail replié de la carte affiche un bloc PAR LOCALISATION (boutons Réussite/Échec/Catastrophe), avec en dessous la conséquence de « Réussite » gravité par gravité ; le geste par défaut (« toute la carte ») ne change pas de sens.
  Le découpage en lots (200 entrées) ne coupe JAMAIS une localisation (sinon la garde refuserait les deux moitiés) : chaque entrée porte sa localisation, `chunkEntries` ne sépare pas deux entrées du même groupe.
- **Hors périmètre** : l'infection reste son propre bloc (une par localisation, B1) ; Lot 2b (silhouette, choix des kits, `care`) ; aucune migration, aucune donnée touchée ; la règle « −2 par case en plus » du Test de soins n'est pas calculée par l'application (le Test se joue à la table).

### 9.3 Fichiers
`server/src/lib/woundReviewService.js` (+ test) · `server/src/lib/woundReviewBatchService.js` (+ test) · `client/src/lib/woundReviewGestures.js` (+ test) · `WoundReviewLine.jsx` → `WoundReviewLocation.jsx` (renommage) · `WoundReviewCard.jsx` · `client/src/locales/combat.json` (clés `woundReview.line.*` → `woundReview.location.*`) · `client/src/index.css` (classes de ligne, si renommées) ·
commentaire de `shared/woundConstants.js` (« un kit par Test et par ligne » → par localisation) · docs : `SYSTEME/BLESSURES.md` (payload de la vue, invariant de la garde), `PLAN_REVUE_GUERISON.md` (contrat §12, note datée), `VOCABULARY.md` (unité de réponse), CHANGELOG v262, ROADMAP, JOURNAL8 (rejeu).

### 9.4 Tests visés
Vue : deux gravités dans une localisation → un seul bloc, toutes les échéances échues, un seul jeu de kits (la pire gravité) ; payload figé mis à jour. Garde : réponse partielle refusée, issues différentes refusées, échéance périmée/non ouverte non exigée, deux personnages d'une même localisation indépendants, échéance orpheline hors groupe, rien d'écrit sur refus.
Client : entrées par localisation, découpage en lots qui ne sépare pas un groupe, comptes de carte. Rejouer les 297 tests en base du domaine + tests purs.

### 9.5 À examiner dans l'analyse à charge
Course entre la lecture de la vue et l'envoi (une échéance devient répondable entre-temps → refus 409, la vue est relue) ; échec de handler sur UNE entrée d'une localisation (le savepoint de l'entrée est annulé, les autres passent : la localisation est alors à moitié répondue — à trancher) ; kits quand la pire gravité échue est en cours de soins constants et qu'une gravité plus légère est à son premier Test ; message d'erreur du refus (i18n) ; compatibilité du payload avec l'ancien client déjà chargé dans un navigateur ouvert.

---

## 10. Lot B2 — analyse à charge (2026-09-26)

**Défaut trouvé dans le code existant, que B2 rend inévitable à traiter : l'ORDRE de résolution dans une localisation** [VÉRIFIÉ par lecture de `placeWound` / `resolveWoundImprovement`]
Une guérison qui aboutit se pose comme une nouvelle blessure (Lot A) : si la ligne d'arrivée est pleine, elle est effacée, ses échéances annulées, et la case est cochée au-dessus. Aujourd'hui l'ordre des réponses est celui de l'écran — la pire gravité d'abord (`byWorstFirst`), par accident d'affichage.
Exemple : Corps, 3 Moyennes (ligne pleine, capacité 3) + 1 Grave, toutes échues, « Réussite ». **Pire d'abord** : la Grave veut devenir Moyenne, la ligne est pleine → les 3 Moyennes sont effacées, la Grave est recochée (période repartie de zéro) ; les 3 réponses « Moyenne » deviennent périmées (« déjà traitées ») et sont perdues.
**Du plus léger d'abord** : les 3 Moyennes deviennent 3 Légères, puis la Grave devient Moyenne (place libre) → 3 Légères + 1 Moyenne, aucune réponse perdue. Démontré : améliorer une case de gravité S ne touche que la ligne S−1 (et écrit au plus à S) ; en traitant du plus léger au plus grave, aucune case encore à traiter n'est jamais effacée par une cascade.
Les issues Échec/Catastrophe ne dépendent pas de l'ordre (l'infection est fusionnée, idempotente). → Le **serveur** fixe l'ordre (du plus léger au plus grave, puis identifiant), jamais le client ; c'est aussi ce qui évite un blocage mutuel entre deux lots (verrous pris dans le même ordre).
Le livre ne dit rien de l'ordre (aucun texte : R4/R5 parlent de blessures qui « diminuent d'un niveau ») : c'est un choix, à faire valider par Saar avant de coder (question posée), consigné au JOURNAL8.

**Corrections apportées au plan §9**
1. **Atomicité par localisation** (répond au §9.5 « échec de handler sur une entrée ») : le point de sauvegarde n'est plus par entrée mais par LOCALISATION pour les guérisons. Si une seule échoue, toute la localisation est annulée (toutes ses entrées `error`), reste à répondre, jamais à moitié répondue ; les autres localisations du lot passent. Les infections gardent une entrée = un point de sauvegarde.
2. **La garde tourne DANS la transaction**, après verrouillage (`FOR UPDATE`, ordre d'identifiant) des échéances de guérison répondables des personnages visés : la complétude et l'unicité d'issue sont vérifiées sur des lignes qui ne peuvent plus bouger (une lecture avant la transaction laissait une fenêtre : une échéance ouverte entre-temps). Un refus annule tout (rien n'était écrit).
3. **L'ordre des résultats** : `traceBatch` associe `results[i]` à `entries[i]` ; le regroupement et le tri par localisation changent l'ordre d'exécution → les résultats sont remis dans l'ordre d'entrée avant de sortir.
4. **Clé de groupe côté client = personnage + localisation** (deux personnages ont la même « jambe_gauche » : le bloc PNJ envoie leurs entrées dans un seul lot).
5. **Pas de couche de compatibilité** avec l'ancien format `lines` : deux formats en parallèle seraient un second contrat. Un onglet resté ouvert avant le déploiement se recharge (F5) ; ses réponses partielles sont de toute façon refusées par la garde, avec un message.
6. **Classes CSS inchangées** (`wound-review-line` sert aussi au bloc d'infection : ce n'est pas un nom de « ligne du compteur ») ; la clé de traduction `woundReview.line.queued` (partagée avec le bloc d'infection) devient `woundReview.queued`.
7. **Message du refus** : texte français brut comme les autres refus de ce service (`choices : …`, 404) ; il ne s'affiche que si le client envoie une réponse incomplète (bug de client ou onglet périmé), l'écran normal ne peut pas le provoquer.

**Vérifié, sans changement**
- **Kits** : la pire gravité échue fixe le jeu de kits ; les gravités plus légères sont couvertes (Médecine couvre Premiers soins ; la Chirurgie du premier Test n'est demandée que par Mortelle / Membre détruit, les plus graves). Seul cas pathologique (un Membre détruit en soins constants et une Mortelle à son premier Test sur le même membre) : le décompte affiché serait celui du Membre détruit ; il n'est jamais consommé.
- **Course lecture/envoi** : couverte par le point 2. **Lots de plus de 200 entrées** : une localisation compte quelques entrées au plus (capacités de la fiche), `chunkEntries` ne la sépare pas.
- Aucun autre lecteur de `card.lines` que `WoundReviewCard` et `woundReviewGestures` [VÉRIFIÉ par recherche] ; aucun autre appelant de `resolveHealingChoices` que la route MJ.
