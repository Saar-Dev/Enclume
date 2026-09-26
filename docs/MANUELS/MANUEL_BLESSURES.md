# MANUEL_BLESSURES.md — Logique de jeu des blessures physiques (compteur, effets, stabilisation, guérison, infection)

> Version : V1 — 2026-09-26 (première rédaction, à valider par Saar).
> Statut : **Brouillon à valider.** Aucune règle de ce document n'est implémentée *parce qu'elle est ici* : le code existant est comparé au manuel dans `docs/PLANS/PLAN_GUERISON_RAW.md`, jamais l'inverse.
> Responsabilité unique : traduire le chapitre État de santé (Blessures physiques) du Livre de Base Polaris en logique structurée, **sans interprétation** : chaque règle cite le livre ; ce que le livre ne dit pas
> est déclaré en section 6 (questions ouvertes), jamais tranché en silence.
> Ce document ne contient ni code, ni SQL, ni architecture. Gabarit : `docs/MANUELS/GABARIT_MANUEL.md` (V1).
> Décision de Saar (2026-09-26) : le livre fait autorité ; ses lectures antérieures ne sont que des lectures.

**Comment lire les citations** : chaque passage écrit entre guillemets français est une **citation littérale** du fichier `docs/REGLES/REGLEBLESSURES.md` (les césures de fin de ligne du fichier extrait sont ignorées). Une vérification
automatique confirme que chaque citation existe dans le fichier (voir section 8.6). Les *exemples* en italique ne font pas autorité : seule la règle énoncée fait foi.

---

## 1. Sources RAW

| Fichier dépôt | Lignes (extrait texte) | Contenu couvert |
|---|---|---|
| `docs/REGLES/REGLEBLESSURES.md` | 16-33 | Seuils de blessures (Dommages → gravité) |
| idem | 35-58 | Compteur de blessures : cases, débordement d'une ligne |
| idem | 59-182 | Description et effets de chaque gravité (malus, déplacement, Choc, stabilisation, aggravation, séquelles) |
| idem | 183-191 | Malus aux Tests (non cumulatifs) |
| idem | 192-206, 253-266 | « Stabilisation nécessaire ! » : délais sans stabilisation (Critique, Mortelle, Membre détruit) |
| idem | 207-253 | Options : simplifier les blessures des PNJ ; malus dus à l'état de santé ; malus cumulatifs |
| idem | 256-266, 331-358 | « Stabiliser une blessure » : Test de Premiers soins |
| idem | 267-330 | Choc (optionnel) : Étourdi, Inconscient, durée, table |
| idem | 359-434 | **Durée de guérison et soins nécessaires** : périodes, table, traitement par Localisation, réussite / échec / Catastrophe, guérison naturelle |
| idem | 435-488 | **Infection** : Test de Constitution par gravité |
| idem | 489-505 | Suractivité |
| `docs/REGLES/REGLESYSCOMBAT.md` | ~1620-1640, ~1753 | Localisation des dommages ; renvoi vers le compteur (« La gestion des cases de blessure est abordée en détail dans le chapitre État de santé ») |
| `docs/REGLES/REGLECOMPETENCE.md` | Premiers soins (~1084), Médecine (~580), Chirurgie (~981) | Compétences de soins (descriptions courtes) |
| `docs/REGLES/ATTRIBUTS.md` | ~74-79 | Résistance au Choc : Seuil d'Étourdissement et Seuil d'Inconscience |
| `docs/REGLES/REGLE_CHANCE.md` | ~108-131 | Réduction de gravité par la Chance → traitée dans `docs/MANUELS/MANUEL_CHANCE.md`, **jamais recopiée ici** |

Règle dispersée : la gestion d'une blessure est répartie entre le chapitre Combat (Localisation, jet de Dommages), le chapitre État de santé (compteur, effets, soins) et les Attributs (Résistance au Choc).
Le tableau du compteur de blessures de la fiche est une **image** : ses nombres de cases ne figurent pas dans le texte extrait (voir question Q2).

---

## 2. Entités et attributs

### 2.1 La blessure
| Attribut | Description | Source RAW |
|---|---|---|
| **Gravité** | Légère, Moyenne, Grave, Critique, Mortelle, Mort subite / Membre détruit (six lignes) | 16-33, 150-163 |
| **Localisation** | Tête, Corps, Bras droit, Bras gauche, Jambe droite, Jambe gauche (colonnes du compteur) | 150-163 |
| **Date de réception** | Point de départ de la **période de guérison** de CETTE blessure (chaque blessure a sa période) | 363-368, 393-395 |
| **Stabilisée** | État atteint par un Test de Premiers soins réussi (Critique à hémorragie, Mortelle, Membre détruit) | 192-206, 331-358 |

### 2.2 Le compteur de blessures
Un tableau de la fiche de personnage : **une ligne par gravité, une colonne par Localisation**, chaque intersection porte un nombre de **cases**. « Le nombre total de blessures qu'un personnage peut recevoir est limité. »
La ligne « Mort/Membre détruit (30) » du tableau porte « Mort » en Tête et en Corps (Localisations où la 6ᵉ ligne tue) ; les autres colonnes portent des cases (Membre détruit).
**Nombre de cases par ligne** — le tableau du compteur est une image absente du texte extrait ; les valeurs ci-dessous sont relevées **par Saar sur la fiche imprimée** (2026-09-26, réponse à Q2) et **ne sont pas une citation** du livre :

| Gravité | Tête | Corps | Bras (droit, gauche) | Jambes (droite, gauche) |
|---|---|---|---|---|
| Légère (5) | 3 | 4 | 3 | 3 |
| Moyenne (10) | 3 | 3 | 3 | 3 |
| Grave (15) | 2 | 3 | 2 | 2 |
| Critique (20) | 2 | 2 | 2 | 2 |
| Mortelle (25) | 1 | 2 | 1 | 1 |
| Mort / Membre détruit (30) | Mort (1) | Mort (1) | Membre détruit (1) | Membre détruit (1) |

### 2.3 La période de guérison
Durée propre à chaque gravité, exprimée en jours ou en semaines (table de la section 4.8). Elle vaut pour **chaque blessure**, pas pour la Localisation.

### 2.4 Le Test de soins
Test de Médecine ou de Premiers soins (Chirurgie avant toute phase de soins pour les plus graves), avec une **difficulté** par gravité (section 4.8) et un malus par case supplémentaire.

### 2.5 Le Test de Constitution contre l'infection
Test de Constitution avec un modificateur par gravité, effectué par période de deux jours (section 4.10).

---

## 3. Relations et dépendances

| Lien | Nature | Sens | Statut |
|---|---|---|---|
| **Combat → blessure** | Un jet de Dommages nets atteint un seuil : la blessure correspondante est reçue sur la Localisation touchée (« Le joueur coche alors l'une des cases correspondant au niveau de blessure reçu, sur la Localisation touchée »). | Combat écrit le compteur | Existant |
| **Chance → blessure** | Dépenser de la Chance réduit la gravité d'une blessure subie. Règle propre : `MANUEL_CHANCE.md`. Une note du livre demande de descendre encore quand le palier visé « ne peut plus accepter de nouvelles blessures (toutes les cases disponibles ont été cochées) ». | Chance modifie la gravité reçue | Existant (manuel séparé) |
| **Blessure → Tests** | Malus aux Tests (non cumulatif), effets de déplacement, Test de Choc. | La blessure conditionne les Tests | Existant |
| **Blessure → temps de jeu** | Périodes de guérison en jours et en semaines, infection tous les 2 jours, stabilisation en minutes : trois échelles de temps. | Le temps de jeu fait avancer la guérison | Existant (horloge de campagne) |
| **Personnage → blessure** | Constitution (Tests d'infection, délais de survie), Résistance au Choc (Attributs). | Le personnage fournit des valeurs | Existant |
| **Compétences de soins** | Premiers soins, Médecine, Chirurgie : Tests de stabilisation et de guérison. | Le soignant est un personnage (PJ ou PNJ) ou un établissement | Existant côté fiche |

⚠️ Dépendance : les Tests de soins exigent un **soignant** et du **matériel** (« trousse médicale complète », « instruments et pansements stériles »). Le livre laisse au MJ l'appréciation du matériel (section 4.8).

---

## 4. Règles logiques

### 4.1 Seuils de blessures (Dommages → gravité)
Référence : 16-33.
« Dès que la somme de points de dommages physiques reçus atteignent ou dépassent l'un de ces seuils, le personnage reçoit la blessure correspondante ».

| Seuil de Dommages | Gravité |
|---|---|
| 5 | Blessure légère |
| 10 | Blessure moyenne |
| 15 | Blessure grave |
| 20 | Blessure critique |
| 25 | Blessure mortelle |
| 30 | Mort subite / Membre détruit |

Le livre précise : « La seule règle véritablement importante, ici, est celle des seuils de blessures physiques. » Ce que « la somme » additionne exactement (un seul jet de Dommages, ou plusieurs) : voir Q1.

### 4.2 Cocher une case
Référence : 35-42.
Dès qu'un personnage est blessé, le joueur « doit alors cocher l'une des cases du compteur de blessures […] correspondant à la Localisation touchée et à la gravité de la blessure ».

### 4.3 Débordement d'une ligne
Référence : 43-53.
« Dans chaque Localisation, lorsque toutes les cases d'une ligne sont cochées et que le personnage subit une nouvelle blessure de cette gravité, le joueur doit alors : 1. Cocher une case dans le degré de gravité supérieur 2. Effacer les blessures notées dans les cases de la ligne complète ».
Le livre en donne la raison : « On considère en effet que l'ensemble des blessures subies à un certain niveau de gravité finit par constituer une blessure de gravité supérieure. »

Énoncé logique :
1. Une ligne est **pleine** quand **toutes** ses cases sont cochées.
2. Si une nouvelle blessure d'une gravité arrive sur une ligne **pleine**, alors on efface toutes les cases de cette ligne **et** on coche une case de la ligne du dessus (même Localisation).
3. Si une ligne n'est pas pleine, la nouvelle blessure coche simplement une case libre.

*Exemple : la Tête a une ligne Légère de 3 cases (voir Q2). Trois Légères sont cochées : la ligne est pleine. Une 4ᵉ Légère arrive : les 3 Légères sont effacées, une case Moyenne est cochée.*
*Exemple : avec 2 Légères seulement, la ligne n'est pas pleine : la 3ᵉ Légère coche la 3ᵉ case, aucune conversion.*

Ce que le livre ne dit pas : que faire quand la ligne du dessus est elle-même pleine (Q3) ; la ligne Mortelle, dont le degré supérieur est « Mort/Membre détruit » (Q4).

### 4.4 Description et effets par gravité
Référence : 59-182. Chaque gravité impose un malus aux Tests, éventuellement des effets de déplacement et un **Test de Choc** (section 4.12), une **stabilisation** et des **séquelles**.

| Gravité | Malus aux Tests | Effets par Localisation | Test de Choc (malus) | Aggravation possible | Stabilisation |
|---|---|---|---|---|---|
| Légère | −1 | — | — | Suractivité | — |
| Moyenne | −3 | — | — | Infection, Suractivité | — |
| Grave | −5 | Jambes : Allure moyenne maximum. Corps : Allure moyenne maximum. Tête : Allure moyenne maximum | Corps : nécessaire (aucun malus). Tête : nécessaire (−5). Jambes : —. Bras : — | Infection, Suractivité | — |
| Critique | −10 | Bras : Allure moyenne maximum. Jambes : déplacement impossible. Corps : Allure lente maximum. Tête : Allure lente maximum | Bras : nécessaire (aucun malus). Jambes : nécessaire (aucun malus). Corps : nécessaire (−5). Tête : nécessaire (−10) | Infection, Suractivité | Nécessaire, mais **seulement** si la blessure peut causer une hémorragie (« C'est au MJ de décider »)|
| Mortelle | Non applicable : le blessé « ne peut entreprendre aucune action demandant un Test » | Bras : Allure lente maximum. Jambes : déplacement impossible. Corps : Allure lente maximum. Tête : Allure lente maximum | Bras : −5. Jambes : −5. Corps : −10. Tête : −15 | (Infection : voir 4.10) | Nécessaire ! Mort imminente ! |
| Mort subite | Le personnage « meurt sur le coup » (Tête, Corps) | — | — | — | — |
| Membre détruit (Bras / Jambe) | Non applicable (aucune action demandant un Test) | Bras : Allure lente maximum. Jambes : déplacement impossible. Le membre est « arraché ou irrémédiablement détruit » (paralysé, n'est plus utilisable) | Bras : −10. Jambes : −10 | (Infection : voir 4.10) | Nécessaire ! Mort imminente ! |

Séquelles : mentionnées pour Grave (Tête seulement), Critique, Mortelle, Membre détruit ; le livre écrit « Les règles concernant les différents effets des blessures – malus aux tests, Choc, Stabilisation, Aggravation, Séquelles – sont développées dans les sections qui suivent » mais **aucune section Séquelles n'existe** dans le texte fourni (Q9).

### 4.5 Malus aux Tests — non cumulatifs
Référence : 183-191.
« Ces malus ne sont pas cumulatifs : quel que soit le nombre de blessures subies […] on ne prend en compte que le malus le plus élevé, celui qui correspond à la blessure la plus grave (et ce, même si le personnage a reçu plusieurs blessures de même gravité). »
*Exemple (du livre) : une Blessure grave (−5) et deux Blessures critiques (−10) donnent un malus final de −10.*
Option (section 5) : compter en plus −1 par Localisation ayant reçu une blessure grave ou supérieure, au-delà de la première.

### 4.6 « Stabilisation nécessaire ! » — délais sans stabilisation
Référence : 192-206 et 253.
Sur les blessures critiques (à hémorragie), mortelles et Membres détruits, la stabilisation est immédiate, par un Test de Premiers soins réussi (4.7). Sans stabilisation, ou en cas d'échec au Test :

| Gravité | Conséquence sans stabilisation |
|---|---|
| Critique | « le personnage n'aura pas de complications pendant un nombre de minutes égal au double de son niveau de Constitution. Au-delà, il doit réussir un Test de Constitution. En cas de réussite, il dispose d'une nouvelle période de (5 + modificateur de réussite) minutes sans aggravation supplémentaire, avant de devoir refaire un Test de Constitution. En cas d'échec, le personnage a perdu trop de sang : la Blessure critique se transforme en Blessure mortelle. » |
| Mortelle / Membre détruit | « le personnage peut survivre pendant un nombre de minutes égal à son niveau de Constitution avant de mourir. » |

Après la mort : « seul un équipement médical de très haute technologie […] peut permettre de ramener un personnage à la vie par réanimation, à condition que la durée de la mort ne soit pas supérieure à une dizaine de minutes ».

### 4.7 Stabiliser une blessure
Référence : 256-266, 331-358.
« Le personnage qui tente de stabiliser une blessure doit effectuer un Test de Premiers soins, avec le malus suivant : »

| Blessure | Malus au Test de Premiers soins |
|---|---|
| Critique | +0 |
| Mortelle (Bras, Jambe) ou Membre détruit | −3 |
| Mortelle (Tête, Corps) | −5 |

Règles :
1. « Les Blessures doivent être traitées Localisation par Localisation, les degrés de gravité les plus élevés étant logiquement prioritaires. »
2. « Si, sur le Compteur de blessures, la ligne du degré de blessure traitée comporte plus d'une case cochée, l'intervenant subit un malus supplémentaire de −2 au Test de Premiers soins. »
3. Temps : « Chaque tentative nécessite un temps d'intervention de base de 10 minutes, auquel il faut retrancher le modificateur de réussite, ou ajouter le modificateur d'échec. »
4. Matériel : « l'intervenant doit avoir une trousse médicale complète à sa disposition, sinon il subit un malus supplémentaire de −5 à son Test de Premiers soins. »
5. Réussite : « la blessure a été stabilisée. » Une Mortelle « reste toutefois extrêmement préoccupante, et nécessite une attention constante » : le MJ peut demander de nouveaux Tests si la situation l'exige.
6. Échec : « la stabilisation a échoué, et l'intervenant a perdu du temps ».

Cette mécanique est à l'**échelle des minutes** ; elle est distincte de la guérison (jours et semaines, 4.8).

### 4.8 Durée de guérison et soins nécessaires
Référence : 359-434.
« Chaque blessure possède une durée de guérison, exprimée en jours ou en semaines. C'est la durée minimum nécessaire pour qu'une blessure diminue et se transforme en une blessure de gravité inférieure. Ainsi, au bout de 3 semaines, une Blessure critique a la possibilité de se transformer en Blessure grave. Les Blessures voient leur gravité décroître peu à peu, jusqu'à disparaître totalement. » « Note : un Membre détruit devient une Blessure critique. »

| Gravité | Durée de guérison | Guérison naturelle ? | Soins nécessaires | Difficulté | Soins constants ? |
|---|---|---|---|---|---|
| Légère | 1 jour | Oui | Aucune | — | Non |
| Moyenne | 3 jours | Oui | Médecine ou Premiers soins | +5 | Non |
| Grave | 1 semaine | Oui | Médecine ou Premiers soins | +3 | Non |
| Critique | 3 semaines | Non | Médecine | +0 | Oui |
| Mortelle | 5 semaines | Non | Chirurgie + Médecine | Bras / Jambe : −3 ; Corps : −5 ; Tête : −7 | Oui |
| Membre détruit | 3 semaines | Non | Chirurgie + Médecine | −3 | Oui |

Soins : « toutes peuvent être traitées par un Test de Médecine, les moins graves peuvent également être soignées par un simple Test de Premiers soins. Enfin, les plus graves nécessitent aussi un Test réussi de Chirurgie avant toute phase de soins médicaux. »
Difficulté : ces valeurs correspondent à « des conditions de soins correctes : un environnement sain, du matériel médical et des médicaments disponibles, un bloc opératoire normalement équipé ». Sans matériel approprié, « les malus peuvent être augmentés de 3 à 5 points, selon la situation. Un chirurgien sans matériel ne peut pas opérer le blessé… Dans ce dernier cas, le MJ peut soumettre le personnage à un Test contre l'infection, ou aggraver les séquelles des blessures. » Dans un hôpital très équipé, « le MJ peut diminuer les malus ».

### 4.9 Le traitement « Localisation par Localisation »
Référence : 386-392.
« Les blessures sont traitées Localisation par Localisation, quel que soit le nombre de cases cochées sur chaque ligne de blessure (pour simplifier, disons qu'en fait le médecin guérit un « bras » ou une « jambe », plutôt qu'une « blessure sur le bras » ou « sur la jambe »…). Chaque case de blessure cochée en plus de la première impose toutefois un malus cumulatif supplémentaire de −2 au Test à effectuer. De plus, certaines blessures exigent des Soins constants, ce qui signifie que le Test de Médecine doit être effectué chaque semaine. »

Énoncé logique :
1. Le Test de soins porte sur une **Localisation** entière, quel que soit le nombre de cases d'une ligne.
2. Difficulté du Test = difficulté de la gravité (table 4.8) − 2 par case cochée en plus de la première.
3. Pour les gravités à soins constants (Critique, Mortelle, Membre détruit), le Test est refait **chaque semaine** pendant toute la période.

*Exemple : la Jambe gauche porte 2 cases Critiques. Le Test de Médecine (difficulté +0) subit −2 (2ᵉ case) : +0 −2 = −2.*
**Plusieurs gravités dans une même Localisation** (décision de Saar, 2026-09-26, Q5) : le Test porte sur la **pire blessure** de la Localisation — sa difficulté (table 4.8) et, pour l'infection, son modificateur (4.12) sont ceux de la gravité la plus élevée présente. Le livre ne dit pas si « le nombre de cases » compte toutes les lignes de la Localisation ou seulement la ligne traitée (Q6).

### 4.10 Résultat du Test de soins : réussite, échec, Catastrophe
Référence : 393-401.
- **Réussite** : « la guérison est en bonne voie, et le blessé se remet normalement. S'il est arrivé à la fin de la période de guérison qui correspond à sa blessure, celle-ci diminue d'un niveau de gravité. »
- **Échec** : « Un échec force le blessé à effectuer un (et un seul) Test de Constitution pour la période en cours, pour lutter contre les effets de l'Infection ».
- **Catastrophe** : « Une Catastrophe équivaut à une absence totale de soins : le blessé est alors entièrement soumis aux règles d'Infection, et doit donc effectuer un Test de Constitution tous les deux jours pendant la période de guérison en cours. »

Le livre ne précise pas ce que devient la période elle-même après un échec ou une Catastrophe (elle continue, ou recommence) : Q7.

### 4.11 Guérison naturelle
Référence : 402-407.
« Les Blessures légères guérissent naturellement toutes seules, et certaines blessures de gravité moyenne (Blessures moyennes et graves) peuvent éventuellement se passer de soins médicaux. Le blessé ne peut alors compter que sur ses capacités de guérison naturelle. Néanmoins, toutes les blessures non soignées ET réclamant des soins risquent de s'aggraver par l'infection ».
Énoncé logique : Légère → guérit seule, sans risque notable (« très peu de risques de s'aggraver »). Moyenne et Grave → peuvent se passer de soins mais, non soignées, restent exposées à l'infection. Critique, Mortelle, Membre détruit : colonne Guérison naturelle = Non (table 4.8).

### 4.12 Infection
Référence : 435-488.
« Tous les deux jours, et pour chaque Localisation présentant une ou plusieurs blessures susceptibles de s'infecter et qui n'a pas été soignée correctement, le joueur doit effectuer un Test de Constitution pour son personnage, avec le modificateur indiqué ci-dessous, et appliquer les effets correspondant au résultat obtenu ».

| Gravité | Modificateur au Test de Constitution | Malus par case en plus de la première | Test réussi | Test raté | Malus par période de deux jours sans soins |
|---|---|---|---|---|---|
| Moyenne | +5 | — | Pas d'infection sur cette Localisation, la guérison se poursuit normalement. | Infection légère : cocher **une case de blessure supplémentaire** sur la ligne des Blessures moyennes (« avec le risque de dépasser la capacité de cette ligne, et donc de subir une blessure de gravité supérieure »). | — |
| Grave | 0 | −2 | Pas d'infection, mais le malus de période s'applique. | Infection légère : une case supplémentaire sur la ligne des Blessures graves. | −2 par période (« aucun malus le premier jour, −2 le deuxième jour, −4 le troisième jour, etc. ») |
| Critique | −5 | −2 | « malgré la réussite, les blessures de la Localisation s'infectent inévitablement par manque de soins » : une case supplémentaire sur la ligne des Critiques. | Les blessures s'infectent : une case supplémentaire sur la ligne des Critiques. | −2 par période, après un test raté |
| Mortelle / Membre détruit | −10 | −2 | « malgré la réussite, les blessures de la Localisation s'infectent inévitablement par manque de soins, et dégénèrent en gangrène avancée. Le blessé survit pendant un […] nombre d'heures égal à sa Constitution, puis meurt d'une septicémie […]. Si la blessure est localisée sur une jambe ou un bras, l'amputation est inévitable pour sauver le blessé. » | Comme ci-contre, « mais le blessé ne peut survivre qu'un nombre d'heures égal à la moitié de son niveau de Constitution ». | — |

Note : « si le personnage se trouve dans un environnement particulièrement insalubre […] (rue, navire, ou pire, égouts), le meneur de jeu peut même imposer un malus supplémentaire (de −3 à −5, selon la situation). »
Énoncé logique : **un Test par Localisation concernée**, tous les deux jours, tant qu'elle n'est pas « soignée correctement » ; la case supplémentaire cochée suit la règle de débordement (4.3).

### 4.13 Suractivité
Référence : 489-505.
« Un personnage blessé est censé se reposer (et se faire soigner…), pour récupérer de ses blessures. S'il reste actif, physiquement, ses blessures ne peuvent que s'aggraver. » Le degré d'activité qui aggrave dépend de la gravité :

| Gravité | Activité susceptible d'aggraver |
|---|---|
| Légère | Activités physiques très intensives (combats incessants, entraînement intensif, travail physique éprouvant…) |
| Moyenne | Activités physiques intensives (entraînement ou travail physique normal) |
| Grave | La plupart des activités et travaux physiques |
| Critique | Tout ce qui peut empêcher un personnage de se reposer calmement… |

« C'est au MJ de juger si l'activité d'un personnage est susceptible d'aggraver ses blessures […]. S'il juge qu'une aggravation pour cause de suractivité est plausible, le joueur doit alors cocher une case supplémentaire sur la ligne correspondant à la blessure la plus grave. Si plusieurs Localisations comportent des blessures de même gravité, la Localisation touchée est tirée au sort. » Pour une Blessure grave, l'aggravation par suractivité est « systématique ».

### 4.14 Choc (règle optionnelle)
Référence : 267-330 ; `ATTRIBUTS.md` ~74-79.
« La Résistance au Choc d'un personnage se compose de deux valeurs : le Seuil d'Étourdissement et le Seuil d'Inconscience. » Seuil d'Étourdissement = (FOR + CON + VOL) / 3 ; Seuil d'Inconscience = Seuil d'Étourdissement + 10.
« Effectuer un Test de Choc revient à lancer 1D20, et à comparer le résultat avec ces deux seuils » :
- résultat ≤ Seuil d'Étourdissement : Test réussi, aucun effet ;
- résultat > Seuil d'Étourdissement et ≤ Seuil d'Inconscience : le personnage est **Étourdi** ;
- résultat > Seuil d'Inconscience : le personnage est **Inconscient**.

Effets : Étourdi — ne peut plus attaquer (mais peut se défendre), −5 à toutes ses actions (en plus du malus de blessure), vitesse maximum Allure moyenne. Inconscient — ne peut ni agir ni se déplacer ; s'il se réveille, il est « automatiquement Étourdi pendant 1D6 minutes ».
Durée (table du livre, en Tours de combat « TC » ou en minutes) :

| Blessure reçue | Localisation | Étourdissement | Inconscience | Catastrophe |
|---|---|---|---|---|
| Grave | Tête | 2 TC | 2 minutes | 1D6 minutes |
| Grave | Corps | 1 TC | 1 minute | 1 minute |
| Critique | Tête | 3D6 TC | 3D6 minutes | Coma léger |
| Critique | Corps | 2D6 TC | 2D6 minutes | 3D6 minutes |
| Critique | Bras / Jambes | 1D6 TC | 1D6 minutes | 2D6 minutes |
| Mortelle | Tête | 3D6 minutes | Coma léger | Coma profond |
| Mortelle | Corps | 2D6 minutes | 3D6 minutes | Stabilisation nécessaire |
| Mortelle | Bras / Jambes | 1D6 minutes | 2D6 minutes | Stabilisation nécessaire |
| Membre détruit | Bras / Jambes | 2D6 minutes | 3D6 minutes | Stabilisation nécessaire |

Comas (détail dans le livre, lignes 273-290) : « Coma léger » — Test de Chance toutes les 1D6 heures, puis chaque jour au-delà d'une journée, chaque semaine au-delà d'une semaine ; « Coma profond » — Test de Chance par jour à niveau divisé par deux, puis chaque semaine au-delà de 7 jours, chaque mois au-delà de 4 semaines. « Stabilisation nécessaire : le personnage ne peut pas reprendre ses esprits tant que sa blessure n'a pas été stabilisée. »

---

## 5. Règles optionnelles

| Règle | Référence | Résumé | Décision |
|---|---|---|---|
| **Simplifier la gestion des blessures des PNJ** | 207-224 | Pour la plupart des adversaires, ne tenir compte que de la gravité la plus importante, sans cases à cocher ; le système détaillé est « réservé aux personnages des joueurs, ainsi qu'à leurs adversaires les plus marquants ». | **À statuer par Saar** (le projet applique aujourd'hui le système détaillé à tous les personnages) |
| **Malus cumulatifs** | 234-253 | Compter −1 de plus par Localisation ayant reçu une blessure grave ou supérieure, au-delà de la première. | **NON RETENUE** (option « un système plus réaliste (mais aussi plus incapacitant) » ; la règle de base — malus non cumulatifs — est retenue) |
| **Choc** | 305-330 | Tests de Choc (Étourdi, Inconscient). Le livre précise qu'ils servent aussi aux « dommages assommants ». | **RETENUE** (déjà utilisée) |

---

## 6. Questions ouvertes et ambiguïtés

**Q1 — Que « somme » additionne-t-elle ?** (16-33) « Dès que la somme de points de dommages physiques reçus atteignent ou dépassent l'un de ces seuils » : la somme des dommages d'**un** coup (après protections), ou un cumul entre coups ? Le chapitre Combat (~1753) parle d'un jet de Dommages qui donne « une blessure ». *Hypothèse de travail : un coup = une blessure, déterminée par les Dommages nets de ce coup.*

**Q2 — Nombre de cases par ligne et par Localisation.** ✅ **RÉSOLUE** (Saar, 2026-09-26). Le tableau du compteur est une image : les nombres n'apparaissent pas dans le texte. Saar les a relevés sur la fiche imprimée : voir le tableau de la section 2.2. La règle de débordement (4.3) en dépend.

**Q3 — Cascade.** (43-53) Quand la case du degré supérieur à cocher tombe sur une ligne elle-même pleine, le livre ne le dit pas. *Hypothèse de travail : la même règle s'applique à la ligne du dessus (nouvelle blessure sur une ligne pleine → on efface et on monte encore).* ⚠️ Non bloquant si Saar confirme.

**Q4 — Débordement de la ligne Mortelle.** (43-53, 150-163) La ligne au-dessus des Mortelles est « Mort/Membre détruit ». *Hypothèse de travail : une Mortelle de trop (2ᵉ à la Tête, 3ᵉ au Corps…) coche la 6ᵉ ligne : Mort (Tête, Corps) ou Membre détruit (Bras, Jambes).*

**Q5 — Plusieurs gravités dans une Localisation.** ✅ **TRANCHÉE par Saar** (2026-09-26 : la pire blessure). (386-392, 435-488) Le livre traite « Localisation par Localisation » mais donne une difficulté et un modificateur d'infection **par gravité**. **Décision : c'est la gravité la plus élevée de la Localisation qui fixe la difficulté du Test de soins et le modificateur du Test d'infection.** Cohérent avec l'esprit du livre (« la blessure la plus grave éclipse toutes les autres », 4.5 ; « les degrés de gravité les plus élevés étant logiquement prioritaires », 4.7). *Conséquences retenues par cohérence — à confirmer : la case supplémentaire d'une infection est cochée sur la ligne de cette pire gravité ; le décompte des cases cochées en plus de la première porte sur cette ligne (voir Q6).*

**Q6 — Case cochée en plus de la première.** ✅ **TRANCHÉE par Saar** (2026-09-26 : seules les cases de la ligne de la pire blessure comptent — Jambe avec 1 Critique et 2 Moyennes : Critique −5, aucun malus de cases). (386-392, 450-470) Le malus de −2 compte-t-il les cases de la ligne traitée seulement, ou toutes les cases de la Localisation ? (Pour la stabilisation, le livre dit « la ligne du degré de blessure traitée » ; pour la guérison et l'infection il dit « chaque case de blessure cochée en plus de la première ».) *Hypothèse : la ligne de la gravité considérée.*

**Q7 — Que devient la période après un échec ou une Catastrophe ?** (393-401) Le livre parle d'un Test de Constitution « pour la période en cours » sans dire si la guérison de la blessure progresse. *À trancher.*

**Q8 — Quand a lieu le Test de soins des gravités sans soins constants ?** (386-392) Pour les Moyennes et Graves (colonne Soins constants = Non), un Test est-il fait **une fois** à la fin de la période, ou à chaque jour / période ? Le livre ne fixe la cadence hebdomadaire que pour les soins constants.

**Q9 — Séquelles.** (123, 163, 180) Annoncées, non décrites. Hors périmètre tant que Saar n'a pas transcrit la règle.

**Q10 — Début du cycle d'infection.** (435-441) « Tous les deux jours » à compter de quand (réception de la blessure, échec de soins, fin de la période) ? *À trancher.*

**Q11 — Légère : Test ou pas ?** (416-434) colonne Soins nécessaires = Aucune : aucune blessure Légère ne demande de Test de soins ; elle disparaît à la fin de sa période. Confirmer que cela vaut aussi quand une Légère est cochée en plus d'une blessure plus grave dans la même Localisation.

**Q12 — Une blessure qui guérit et arrive sur une ligne pleine.** ✅ **TRANCHÉE par Saar** (2026-09-26, en cours du Lot A : durant la guérison, la règle des cases est toujours valable). (43-53, 363-368) Le livre décrit la conversion pour une blessure subie, et la guérison comme une blessure qui se transforme en blessure de gravité inférieure ; il ne dit pas ce qui se passe si la ligne inférieure est déjà pleine. **Décision : la blessure devenue plus légère se pose comme une nouvelle blessure de cette gravité** — ligne pleine effacée, case cochée au-dessus, de ligne pleine en ligne pleine — sans jamais dépasser la gravité d'origine (sa case vient d'être libérée).

---

## 7. Hors périmètre

- **Réduction de gravité par la Chance** : `MANUEL_CHANCE.md` (le présent manuel n'en décrit que la note sur les cases pleines, en 3).
- **Séquelles** : règle absente du texte (Q9).
- **Autres sources de dommages physiques** (acide, chutes, feu, froid, noyade, dommages étourdissants et assommants…) : chapitre distinct du livre (`REGLEBLESSURES.md` ~507 et suivantes) ; elles **produisent** des blessures mais leurs règles propres ne sont pas ici.
- **Localisation des dommages et jet de Dommages** : chapitre Combat (`REGLESYSCOMBAT.md`).
- **Armures et protections**, **exo-armures** (avaries), **drones** (intégrité) : autres systèmes.
- **Résolution des Tests** (marges, Catastrophes, réussites critiques) : `REGLES_LdB.md` / règles de Tests.
- **Réanimation** au-delà de la mention du 4.6.

---

## 8. Passage au PLAN

### 8.1 Points bloquants
Aucun point bloquant depuis les réponses de Saar du 2026-09-26 (Q2 : capacités relevées ; Q5 : la pire blessure). Les questions restantes ont chacune une hypothèse de travail écrite ; **Q7, Q8 et Q10** (cadence des Tests et période après un échec) conditionnent le modèle de la guérison par Localisation et sont à confirmer avant d'en coder le Lot B.

### 8.2 Dépendances externes
Horloge de campagne (périodes de guérison, cycle de 2 jours) ; compétences de soins (Premiers soins, Médecine, Chirurgie) ; Chance (`MANUEL_CHANCE.md`) ; Tests et Résistance au Choc.

### 8.3 Termes à ajouter à `VOCABULARY.md` (à vérifier avant ajout : les termes déjà présents ne sont pas redéfinis)
Déjà présents : Stabilisation, Guérison (blessure), Infection (blessure), Mort subite / Membre détruit (6ᵉ ligne), Débordement (ligne Mortelle). **Nouveaux** : **Ligne (du compteur)**, **Case (du compteur)**, **Ligne pleine**, **Période de guérison**,
**Soins constants**, **Guérison naturelle**, **Suractivité**, **Localisation traitée** (le Test de soins porte sur une Localisation).

### 8.4 Complexités majeures
Trois échelles de temps (minutes, jours, semaines) ; cascade du débordement (4.3) ; Test **par Localisation** face à des périodes **par blessure** (4.9 et 4.10) ; case supplémentaire d'infection qui peut elle-même déborder (4.12).

### 8.5 Ordre de priorité suggéré
1. Règle des cases (4.1-4.3) — fondation de tout le reste. 2. Guérison par blessure et par période (4.8, 4.10). 3. Test par Localisation (4.9) et infection par Localisation (4.12). 4. Suractivité (4.13), puis Stabilisation (4.6-4.7) si elle n'est pas déjà couverte.
Le PLAN `docs/PLANS/PLAN_GUERISON_RAW.md` reprend ces lots.

### 8.6 Vérification des citations
Chaque citation entre guillemets français de ce manuel est comparée automatiquement au texte des fichiers RAW cités en section 1 (`REGLEBLESSURES.md`, `REGLESYSCOMBAT.md`, `REGLE_CHANCE.md`, `ATTRIBUTS.md`) et de `RegleDocumentaire.md` (césures de fin de ligne et signes typographiques normalisés). Commande : `node tools/verify-manual-quotes.mjs docs/MANUELS/MANUEL_BLESSURES.md docs/REGLES/REGLEBLESSURES.md docs/REGLES/REGLESYSCOMBAT.md docs/REGLES/REGLE_CHANCE.md docs/REGLES/ATTRIBUTS.md docs/RegleDocumentaire.md`.
Résultat du 2026-09-26 : **85 citations sur 85 retrouvées** ; les **54 valeurs chiffrées** des tableaux (seuils, malus, déplacements, Choc, durées, modificateurs d'infection) ont été contrôlées une à une contre le texte du livre (0 écart).
Consigné dans `docs/JOURNAL8.md` (entrée du 2026-09-26, MANUEL_BLESSURES). Ce contrôle ne remplace pas la relecture de Saar.

### 8.7 Remarque documentaire
`docs/RegleDocumentaire.md` (Règle 9) décrit les MANUELS comme des guides d'utilisation qui « ne définissent jamais une règle métier », alors que `GABARIT_MANUEL.md` V1 et tous les manuels existants portent la traduction du livre. Ce manuel suit le **gabarit** (pratique établie) ; l'écart entre la Règle 9 et le gabarit est à arbitrer par Saar.

Fin de MANUEL_BLESSURES.md V1.
