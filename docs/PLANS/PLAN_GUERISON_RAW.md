# PLAN_GUERISON_RAW — Guérison, infection et cases des blessures : se conformer au texte du livre

> 2026-09-26 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé dans `docs/Old/` et fusionné dans `docs/SYSTEME/BLESSURES.md` une fois clos.
> Statut : 🟡 **Cadré le 2026-09-26 ; Lot A : analyse à charge faite (§6), CODÉ (259 tests en base verts), en attente de validation en jeu par Saar.** Lot B non commencé (Q7/Q8/Q10 à confirmer). Il reprend et remplace le ticket `WOUND-HEAL-LINE-CAPACITY` (bug n°2 de la résolution de bugs) et le ticket
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
