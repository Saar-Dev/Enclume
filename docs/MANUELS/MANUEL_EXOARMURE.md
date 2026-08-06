MANUEL_EXOARMURE.md — Réécrit (sections 1-2)

    Statut : Réécriture 2026-08-04 — remplace la version antérieure (V2/V3 fusionnées). Document de traduction logique des règles RAW du Livre de Base Polaris sur les armures mécanisées. Ce MANUEL est la source de vérité pour l'étape PLAN suivante.

    Principe fondateur : Ce document décrit quoi faire, jamais comment (pas de SQL, pas de code, pas de choix d'implémentation). Il doit être compréhensible et validable par un expert règles sans connaissance technique.

    Cycle de vie prévu : Rédaction → Validation Saar → Passage au PLAN → Archivage. Toute évolution ultérieure fera l'objet d'un nouveau MANUEL (ex : MANUEL_EXOARMURE_V2.md). Ce document ne sera pas modifié après le démarrage du PLAN.

1. Sources RAW

Les règles ci-dessous sont extraites du Livre de Base Polaris. En cas de contradiction entre ce MANUEL et les sources RAW, les sources RAW priment (conformément à la hiérarchie documentaire du projet).
Fichier dépôt	Pages LdB	Contenu couvert
docs/REGLES/REGLEARMURE.md	p.323-325	Types d'armures, catégories, éléments de l'armure, attributs (RD, Blindage, Vitesse, Exo-Force, malus d'Initiative)
docs/REGLES/REGLEARMURE.md	p.325-326	Combat en armure (initiative, actions, déplacements, dommages au contact, encombrement)
docs/REGLES/REGLEARMURE.md	p.326-328	Gestion des dommages (seuils, compteur d'Avaries, incidents, effets par localisation)
docs/REGLES/REGLEARMURE.md	p.328-329	Pertes d'Intégrité par paliers (Structure, Exosquelette, Générateur)
docs/REGLES/REGLEARMURE.md	p.329-330	Destruction, systèmes « Dernière chance », réparation
docs/REGLES/REGLEARMURE.md	p.330-338	Équipement des armures (systèmes de contrôle, senseurs, armement, systèmes défensifs)
docs/REGLES/REGLEARMURE.md	p.338-347	Modèles d'armures (catalogue)
Table Exo-Force (Annexe)	p.402	Correspondance EXF → modificateur de Dommages

Sources connexes (règles qui s'appliquent aux armures sans être dans le chapitre dédié) :

    docs/REGLES/REGLE_USURE&INTEGRITE.md p.273-274 — règles d'Intégrité du matériel, Tests de panne.

    Chapitre Combat — déplacements, initiative, attaques multiples.

2. Entités et attributs

Cette section décrit les « objets » du sous-système exo-armure, leurs caractéristiques, et ce qui est fixe (commun à toutes les armures d'un même modèle) par opposition à ce qui est variable (propre à chaque armure individuelle, évoluant avec le temps et les dégâts).

    Notation : Les termes en gras sont des concepts métier qui devront être ajoutés à docs/VOCABULARY.md s'ils n'y figurent pas déjà.

2.1 L'armure mécanisée (exo-armure)

Une armure mécanisée est un engin humanoïde lourd, blindé, motorisé par un exosquelette. Elle est considérée comme un véhicule à part entière, partageant certaines règles avec les navires.

Attributs fixes (définis par le modèle/template) :
Attribut	Description	Source RAW
Catégorie	Gabarit de l'armure : exo-alpha, exo-0 à exo-6, exo-oméga. Détermine la taille, l'encombrement, et les malus associés.	p.323-324
Environnement nominal	Milieu pour lequel l'armure est conçue : submarine (sous-marin), surface (air libre), hybrid (les deux), atmospheric, spatial, industrial.	p.323
Profondeur opérationnelle	Profondeur maximale sans risque (en mètres). Uniquement pertinent pour les armures sous-marines ou hybrides.	p.338
Profondeur limite	Profondeur où des Tests de pression sont nécessaires toutes les 10 minutes.	p.338
Profondeur d'écrasement	Profondeur où l'armure est instantanément détruite.	p.338
Exo-Force de base (EXF)	Puissance physique de l'exosquelette. Utilisée pour les dommages au contact et la capacité de port. Indépendante de la Force du pilote.	p.324-325
Vitesse de base	Déplacement en mètres par Tour. Peut avoir deux valeurs : une sous l'eau, une en surface.	p.324
Blindage de base (BLD)	Protection de la coque, retranchée aux dommages subis.	p.324
Résistance aux Dommages (RD)	Modificateur fixe appliqué après le Blindage. Dépend de la catégorie (table p.324).	p.324
Malus d'Initiative	Pénalité à l'Initiative du pilote. Une valeur sous l'eau, une en surface.	p.325

Attributs variables (propres à chaque armure individuelle) :
Attribut	Description	Source RAW
Intégrité Structure	État de la coque et du blindage. Possède une valeur maximale (usure définitive) et une valeur courante (dommages réparables). La valeur par défaut est 20/20.	p.325, 328-329
Intégrité Exosquelette	État de la motorisation. Même principe max/courant, défaut 20/20.	p.325, 328-329
Intégrité Générateur	État de la source d'énergie. Même principe max/courant, défaut 20/20. Pas de jauge d'autonomie — le générateur fournit de l'énergie illimitée tant qu'il fonctionne.	p.325, 328-329
Avaries	Compteurs de dommages subis, par gravité : légères, moyennes, graves, critiques, catastrophiques. Fonctionnent comme les compteurs de Blessures des personnages (une ligne pleine se reporte sur la ligne supérieure).	p.326
Systèmes installés	Liste des équipements auxiliaires (senseurs, ordinateurs, communicateurs, etc.). Chaque système possède sa propre Intégrité (max/courant).	p.330-338
Armement installé	Liste des armes et systèmes défensifs montés sur les hardpoints. Chaque arme possède sa propre Intégrité (max/courant).	p.335-337
2.2 Le pilote

Le pilote est un personnage humain (PJ ou PNJ) qui contrôle l'armure. Ses caractéristiques sont modifiées par l'armure qu'il pilote.
Règle	Description	Source RAW
Lien pilote-armure	Un personnage ne peut piloter qu'une seule armure à la fois. Une armure ne peut avoir qu'un seul pilote à la fois.	Interprétation de la logique RAW
Substitution des attributs	La Force, l'Agilité et les compétences de déplacement du pilote sont ignorées — on utilise les attributs de l'armure. L'Intelligence, la Volonté, etc. restent celles du pilote.	p.324-325
Plafonnement des compétences	Le niveau de la Compétence Manœuvre d'armure du pilote agit comme un plafond : toutes les compétences physiques et de combat (Tir, Corps à corps, etc.) sont limitées à ce niveau.	p.325
2.3 Les composants internes

Chaque composant (Structure, Exosquelette, Générateur) possède :

    Une Intégrité maximale (ITG max) : représente l'usure définitive. Ne peut pas être réparée au-delà. Diminue en cas d'Avarie critique ou catastrophique (Structure) ou d'incident grave (Exosquelette, Générateur).

    Une Intégrité courante (ITG courante) : représente les dommages subis. Peut être réparée. Si elle tombe à 0 ou moins, le composant est considéré comme détruit.

Les effets des paliers d'Intégrité sont détaillés en section 4 (Règles logiques).
2.4 Les avaries

Une Avarie est un dommage subi par l'armure, classé selon sa gravité :
Gravité	Seuil de dommages nets	Modificateur d'incident
Légère	5 à 9	+0
Moyenne	10 à 14	+2
Grave	15 à 19	+4
Critique	20 à 24	+6
Catastrophique	25 à 29	+8
Destruction	30 et plus	—

Le compteur d'Avaries fonctionne comme le compteur de Blessures des personnages : on coche une case de la ligne correspondant à la gravité. Quand une ligne est pleine, on efface toutes ses cases et on coche une case sur la ligne de gravité supérieure.
2.5 Les incidents

Un incident est un effet secondaire qui peut survenir lorsqu'une armure subit une Avarie. Il est déterminé par :

    Un jet de 1D10 + le modificateur d'incident (cf. tableau ci-dessus).

    Si le résultat est ≥ 7, un incident se produit.

    Un second jet de 1D10 détermine la localisation touchée :

        1-2 : Structure

        3-4 : Exosquelette

        5 : Générateur

        6-7 : Systèmes auxiliaires

        8-9 : Armement

        10 : Pilote

Les effets précis dépendent du score d'incident et de la localisation (détaillés en section 4).
2.6 Les systèmes auxiliaires et l'armement

    Systèmes auxiliaires : équipements électroniques, senseurs, ordinateurs, systèmes de survie, etc. Chaque système a sa propre Intégrité et peut tomber en panne.

    Armement : armes de contact, armes à distance, systèmes défensifs. Chaque arme a sa propre Intégrité et peut être endommagée.

    Hardpoints : points d'attache de l'armement. Une armure a un nombre fini de hardpoints (bras, épaules, torse...).

3. Relations et dépendances

Cette section décrit comment le sous-système « exo-armures » s'articule avec les autres parties du jeu déjà existantes ou prévues.
3.1 Lien avec le système de personnages

    Une armure mécanisée est un personnage de type spécial. Elle possède une fiche, peut être sélectionnée dans le roster de combat, et reçoit un token sur la carte.

    Le pilote (PJ ou PNJ) est un personnage distinct. Le lien entre les deux est logique : l'armure référence son pilote, le pilote référence son armure.

    L'armure ne peut pas agir sans pilote. Si le pilote est inconscient ou mort, l'armure est inerte (sauf si un autopilote est installé et programmé).

3.2 Lien avec le système de combat

    L'armure participe au combat via le même roster que les personnages humains.

    Elle utilise les mêmes règles de base (tours, actions, dégâts) mais avec les modifications détaillées en section 4.

    Les dommages infligés à l'armure suivent un pipeline spécifique (Blindage, RD, seuils d'Avarie) distinct des Blessures humaines.

    Les dégâts de type « Pilote » (incident localisation 10) contournent l'armure et s'appliquent directement au personnage humain, via le système de Blessures existant.

3.3 Lien avec le système d'équipement et d'Intégrité

    Les systèmes auxiliaires et l'armement de l'armure utilisent le même concept d'Intégrité que l'équipement standard (voir docs/REGLES/REGLE_USURE&INTEGRITE.md p.273-274).

    Chaque système/arme possède une Intégrité maximale (usure) et une Intégrité courante.

    Les pannes éventuelles sont traitées comme des pannes d'équipement classiques.

    Cependant, le pipeline d'incident (section 4.7) est autonome et ne dépend pas du système de Test de panne générique — il a ses propres seuils et effets.

3.4 Lien avec l'environnement (pression, profondeur)

    La routine de pression (section 4.9) interagit avec la topographie de la carte : elle surveille l'élévation Z (profondeur) des tokens d'armure.

    Elle dépend donc du système de positions 3D et du moteur monde, mais uniquement en lecture (pas d'écriture dans la géométrie).

3.5 Lien avec le système de statuts temporaires (token_statuses)

    Certains effets d'incident ont une durée fixe (ex : « paralysé pendant 2 Tours », « micro-coupures pendant 1D6+1 Tours »). Ces durées sont gérées via le mécanisme générique de statuts temporaires déjà en place (expiration automatique au changement de tour).

    D'autres effets sont évolutifs (ex : une fuite qui s'aggrave si elle n'est pas colmatée). Ceux-là nécessitent un traitement spécifique au moment du changement de tour, et pas seulement une expiration passive.

4. Règles logiques

Ce chapitre est le cœur du MANUEL. Il traduit les règles du Livre de Base en logique structurée, sans code, sans SQL.

    Convention : Les exemples sont présentés en italique et ne font pas autorité — seule la règle énoncée fait foi.

4.1 Substitution des attributs du pilote

Dès qu'un personnage pilote une armure, ses attributs physiques sont remplacés par ceux de la machine.
Attribut humain	Remplacé par	Règle
Force (FOR)	Exo-Force (EXF) de l'armure	La FOR du pilote est ignorée pour les dommages au contact et la capacité de port. On utilise l'EXF.
Agilité (AGI) / compétences de déplacement (Athlétisme, Hybride)	Vitesse (VIT) de l'armure	Le déplacement en mètres par Tour est strictement égal à la VIT de l'armure, selon le milieu (sous l'eau ou surface).
Défense naturelle / esquive	Blindage (BLD)	Le Blindage est retranché aux dommages subis. L'armure ne peut pas esquiver hors de son milieu nominal (voir §4.3).

Exemple : un pilote avec FOR 15 et EXF 68 utilise EXF 68 pour les dégâts au contact, ce qui donne un modificateur de +29 (table p.402).
4.2 Plafonnement des compétences par Manœuvre d'armure

Le niveau de la Compétence Manœuvre d'armure du pilote agit comme un plafond (un maximum) pour toutes les compétences physiques et de combat utilisées en armure :

    Tir (quelle que soit l'arme)

    Corps à corps

    Athlétisme (si applicable)

    Toute autre compétence physique

Exemple : un pilote a Tir à 18 et Manœuvre d'armure à 12. En armure, son Tir effectif est plafonné à 12.

Exception : armures assistées (exo-alpha et exo-0 sans exosquelette). Si l'armure est de catégorie exo-alpha ou exo-0 et configurée sans exosquelette, la compétence Manœuvre d'armure n'est pas utilisée et le plafonnement ne s'applique pas. (Ces armures sont alors traitées comme des protections simples — hors scope principal de ce MANUEL.)
4.3 Initiative

Le calcul de l'Initiative en armure diffère du calcul standard.

Formule :
text

Initiative = min(Réaction du pilote, Manœuvre d'armure) − (Malus d'Initiative × Facteur Milieu)

    Facteur Milieu = 1 si l'armure évolue dans son environnement nominal.

    Facteur Milieu = 2 si l'armure évolue hors de son environnement nominal (ex : armure sous-marine utilisée à l'air libre).

Seuil différé : si l'Initiative calculée est ≤ 0, l'action du personnage est reportée au premier rang du Tour de combat suivant (il agira en premier au prochain Tour).

Contraintes « Hors-Milieu » :

    Déplacement limité à l'Allure lente.

    Interdiction stricte d'esquiver, de sauter, ou d'effectuer des actions physiques importantes.

    Le malus d'Initiative est doublé (Facteur Milieu = 2).

Exemple : un pilote a Réaction 15, Manœuvre d'armure 12, et pilote une armure Orka (malus_init_underwater = -5) sous l'eau (son environnement nominal). Initiative = min(15, 12) − 5 = 7. S'il remonte à la surface (hors-milieu), Initiative = min(15, 12) − (5 × 2) = 2.
4.4 Déplacement

Le déplacement de l'armure est absolu : la Vitesse (VIT) du modèle définit le nombre de mètres par Tour, selon le milieu.

    Sous l'eau : speed_underwater mètres/Tour.

    En surface : speed_surface mètres/Tour.

Le pilote ne peut pas influencer cette valeur par ses compétences (Athlétisme, Hybride).

Hors-milieu : le déplacement est limité à l'Allure lente (généralement la moitié de la vitesse, selon les règles de déplacement standard).

Exemple : une armure avec speed_underwater = 5 se déplace de 5 mètres/Tour sous l'eau. En surface (hors-milieu), elle passe en Allure lente et se déplace de 2 ou 3 mètres/Tour (arrondi à la discrétion des règles de déplacement).
4.5 Attaque unique par Tour

Une armure mécanisée ne peut effectuer qu'une seule Attaque par Tour, quelle que soit la règle normale sur les attaques multiples.
4.6 Dommages au contact

Les dommages en combat au contact dépendent de deux éléments :

a) Dés de base par catégorie :
Catégorie	Dés de base
exo-alpha, exo-0	1D6+2
exo-1	1D10
exo-2, exo-3	1D10+3
exo-4	2D10
exo-5	2D10+3
exo-6	3D10
exo-oméga	3D10+3 et plus

b) Modificateur d'Exo-Force : on utilise la table standard du modificateur de Dommages (comme pour la Force humaine), appliquée à l'EXF de l'armure (et non à la Force du pilote). Voir table page 402.

Exemple : une armure de catégorie exo-4 (2D10) avec EXF 68 (modificateur +29) inflige 2D10 + 29 points de dommages bruts au contact.

Note : si l'EXF atteint 50 ou plus, l'armure peut endommager les Véhicules légers. Si l'EXF atteint 100 ou plus, elle inflige des Dommages massifs à l'échelle humaine. Ces seuils sont mentionnés ici mais leur traitement dépend d'un futur système de véhicules et de dégâts massifs.
4.7 Résolution des dommages subis (pipeline de dégâts)

Lorsqu'une armure est touchée par une attaque, on applique le pipeline suivant :

Étape 1 — Dommages bruts : l'attaque inflige ses dégâts normaux (dés + modificateurs).

Étape 2 — Réduction par le Blindage : Dommages réduits = Dommages bruts − Blindage effectif

Le Blindage effectif est le Blindage de base du modèle, modifié par les paliers d'Intégrité de la Structure (voir §4.8). Si le Blindage effectif est ≤ 0, aucune réduction.

Étape 3 — Application de la RD : Dommages nets = Dommages réduits + RD

La RD (Résistance aux Dommages) est un modificateur fixe par catégorie (table p.324). Une RD négative augmente les dégâts, une RD positive les réduit.

Exemple : une armure subit 35 points de dégâts bruts. Blindage effectif = 20, RD = -5. Dommages nets = (35 − 20) + (-5) = 10. Avarie moyenne.

Étape 4 — Détermination de l'Avarie : comparer les dommages nets aux seuils (tableau §2.4).

Étape 5 — Compteur d'Avaries : cocher une case de la ligne correspondante. Si la ligne est déjà pleine, effacer toutes ses cases et cocher une case sur la ligne de gravité supérieure.

Étape 6 — Incident : si une Avarie est subie (quelle que soit sa gravité), un jet d'incident peut se déclencher (voir §4.9).
4.8 Paliers d'Intégrité (effets dynamiques)

Les performances de l'armure se dégradent à mesure que ses composants perdent de l'Intégrité courante. Ces effets sont recalculés à chaque fois qu'on en a besoin (avant une action, après un dégât), jamais stockés.
4.8.1 Paliers de la Structure — effet sur le Blindage
Intégrité Structure courante	Effet sur le Blindage
11 et plus	Aucune réduction
6 à 10	Blindage diminué d'un tiers (arrondi à l'inférieur)
1 à 5	Blindage divisé par deux (arrondi à l'inférieur)
0 et moins	Blindage = 0 (aucune protection, armure trop fragile)

Exemple : Blindage de base = 34, Structure courante = 7 → Blindage effectif = 22 (34 × 2/3, arrondi inférieur).

Tant que la Structure n'est pas à 0, l'armure reste étanche et protège contre le milieu extérieur (sauf Avarie spécifique indiquant le contraire).
4.8.2 Paliers de l'Exosquelette — effet sur l'Exo-Force et la Vitesse
Intégrité Exosquelette courante	Effet
11 et plus	Aucun malus
6 à 10	Malus de -3 aux Tests de Manœuvre d'armure. EXF diminuée d'un tiers. Vitesse diminuée d'un tiers.
1 à 5	Malus de -5 aux Tests de Manœuvre d'armure. EXF diminuée de moitié. Vitesse diminuée de moitié.
0 et moins	Exosquelette détruit. Armure impossible à manœuvrer. EXF = 0, Vitesse = 0. Le pilote peut encore utiliser les systèmes qui ne dépendent pas de l'exosquelette.

Les arrondis se font à l'inférieur.

Exemple : EXF de base = 68, Exosquelette courant = 8 → EXF effective = 45 (68 × 2/3 = 45,33 arrondi à 45).
4.8.3 Paliers du Générateur — effet sur l'énergie et les systèmes
Intégrité Générateur courante	Effet
11 et plus	Aucun effet
6 à 10	Dès que l'Intégrité atteint 10, 1D6 (+1 par point perdu sous 10) Systèmes auxiliaires sont automatiquement isolés (inutilisables). Les Tests de panne sur Systèmes subissent un malus de -3. Si l'armure a un propulseur, sa Vitesse est réduite d'un tiers.
1 à 5	Dès que l'Intégrité atteint 5, et pour chaque point perdu ensuite, 2 Systèmes supplémentaires sont isolés (y compris les systèmes de support vital). Malus de -5 aux Tests de panne sur Systèmes. Vitesse du propulseur réduite de moitié. EXF divisée par deux.
0 et moins	Générateur hors service. Plus aucun système alimenté. L'armure n'est plus chauffée. EXF = 0, Vitesse = 0.

L'isolation des systèmes est aléatoire parmi les systèmes installés, mais le support vital est épargné au palier 6-10. Au palier 1-5, tout peut être isolé.
4.9 Incidents — résolution détaillée

Chaque fois qu'une armure subit une Avarie, un jet d'incident est effectué.

Étape 1 — Jet d'incident : 1D10 + Modificateur d'Avarie (voir tableau §2.4).

Si le résultat est inférieur à 7, aucun incident ne se produit.

Si le résultat est 7 ou plus, un incident se produit.

Étape 2 — Localisation : lancer 1D10.
1D10	Localisation touchée
1-2	Structure
3-4	Exosquelette
5	Générateur
6-7	Systèmes auxiliaires
8-9	Armement
10	Pilote

Note : si l'armure n'a pas d'exosquelette, un résultat 3-4 est redirigé vers la Structure.

Étape 3 — Résolution de l'effet : le score d'incident (résultat du 1D10 + modificateur) détermine la gravité de l'effet, selon la localisation. Les tableaux ci-dessous détaillent les effets pour chaque localisation et chaque tranche de score.
4.9.1 Incidents Structure (pertes d'étanchéité)

Les incidents Structure créent des fuites que le pilote doit colmater. La fuite est un effet évolutif : un compteur de Tours est initialisé. Si le pilote ne réussit pas une action de colmatage avant la fin du délai, l'armure subit automatiquement des Avaries chaque Tour.
Score	Effet	Délai de colmatage	Conséquence si délai expiré	Perte ITG Structure
7-10	Microfissures	10 Tours	1 Avarie légère automatique par Tour	Aucune
11-13	Fêlure	5 Tours	1 Avarie moyenne automatique par Tour	1 point temporaire
14-16	Fêlure critique	2 Tours	1 Avarie grave automatique par Tour	2 points temporaires
17-18	Brèche	1 Tour	1 Avarie critique automatique par Tour	3 points temporaires

    Les pertes d'Intégrité sont temporaires (elles se restaurent si la fuite est colmatée à temps).

    Les Avaries automatiques générées par la fuite ne déclenchent pas de nouveau jet d'incident (pour éviter les cascades infinies).

4.9.2 Incidents Exosquelette (blocages)
Score	Effet	Durée	Perte ITG Exosquelette
7-10	Blocage localisé : un membre (déterminé au hasard, 1D4) se bloque	Fin du Tour en cours	1 point temporaire
11-13	Blocage localisé aggravé : un membre se bloque	1D6+1 Tours	2 points temporaires
14-16	Blocage général : armure entière paralysée	2 Tours	3 points temporaires
17-18	Blocage général aggravé : armure entière paralysée	1D6+2 Tours	5 points temporaires, ITG max −1

Si plusieurs blocages se superposent, seule la durée la plus longue est prise en compte.
4.9.3 Incidents Générateur (chutes de tension)
Score	Effet	Durée	Perte ITG Générateur
7-10	Micro-coupures : malus de -3 aux actions liées aux systèmes	Fin du Tour en cours	1 point temporaire
11-13	Micro-coupures aggravées : malus de -3	1D6+1 Tours	2 points temporaires
14-16	Arrêt temporaire : armure non alimentée, inutilisable	2 Tours	3 points temporaires
17-18	Arrêt temporaire aggravé : armure non alimentée, inutilisable	1D6+2 Tours	5 points temporaires, ITG max −1

Si plusieurs incidents Générateur se superposent, seule la durée la plus longue est prise en compte.
4.9.4 Incidents Systèmes auxiliaires
Score	Effet
7-10	1 système au hasard perd 3 points d'ITG. Test de panne (1D20 > ITG courante → panne).
11-13	3 systèmes au hasard perdent 5 points d'ITG, ITG max −1. Test de panne pour chacun.
14-16	1D6+1 systèmes au hasard perdent 7 points d'ITG, ITG max −1. Test de panne pour chacun.
17-18	1D6+3 systèmes au hasard perdent 10 points d'ITG, ITG max −2. Test de panne pour chacun.

Détermination d'un système au hasard : chaque système installé possède un numéro. On lance un dé approprié (1D6, 1D10, 1D20 selon le nombre de systèmes). Si le dé tombe sur un emplacement vide, relancer jusqu'à obtenir un système existant.

Si on n'utilise pas les règles d'Intégrité, les systèmes touchés cessent de fonctionner pendant 1D6+2 Tours.
4.9.5 Incidents Armement

Même logique que les Systèmes auxiliaires, mais appliquée à un seul système d'arme ou de défense (déterminé au hasard).
Score	Effet
7-10	L'arme perd 3 points d'ITG. Test de panne.
11-13	L'arme perd 5 points d'ITG, ITG max −1. Test de panne.
14-16	L'arme perd 7 points d'ITG, ITG max −2. Test de panne.
17-18	L'arme perd 10 points d'ITG, ITG max −2. Test de panne.

Si on n'utilise pas les règles d'Intégrité, l'arme cesse de fonctionner pendant 1D6+2 Tours.
4.9.6 Incidents Pilote

Le pilote est normalement protégé tant que l'armure n'est pas détruite, mais il peut subir des contrecoups.
Score	Effet
7-10	2D10 points de Dommages de Choc
11-13	1D10 points de Dommages physiques directs (bypass le blindage de l'armure)
14-16	2D10 points de Dommages physiques directs
17-18	3D10 points de Dommages physiques directs

Les Dommages physiques directs peuvent être réduits si le pilote porte une armure personnelle légère (catégorie A) à l'intérieur de l'armure mécanisée.
4.10 Destruction majeure (≥ 30 points de dommages nets)

Lorsqu'une armure subit 30 points de dommages nets ou plus, la destruction est enclenchée.

Étape 1 — Effondrement de la Structure :

    L'Intégrité Structure courante tombe à 0.

    Pour chaque tranche de 3 points au-delà de 30 (33, 36, 39…), la Structure perd 1 point supplémentaire dans les niveaux négatifs. Ces niveaux négatifs compliquent les réparations futures.

Étape 2 — Incidents en cascade :

    Pour chaque tranche de 5 points au-delà de 30 (35, 40, 45…), un incident est déclenché sur un élément aléatoire (sauf Structure et Pilote), avec un modificateur de +8. On n'applique pas les effets décrits ci-dessus, seulement les pertes d'Intégrité associées.

Étape 3 — Système « Dernière chance » : si l'armure est équipée d'un système de survie d'urgence, il se déclenche :

    Guillotine : un jet de localisation humaine (Tête/Corps/Bras/Jambe) détermine la partie touchée. Si c'est un Bras ou une Jambe, le membre est sectionné (avec amputation du pilote) mais le reste de l'armure est isolé et le pilote survit.

    Congélation : le pilote est congelé instantanément. Il doit être récupéré et décongelé. Test de Constitution avec malus −2 + (−2 par heure de congélation). Échec = mort.

    Injection de drogues : le pilote est stabilisé mais inconscient. Il doit être traité en hôpital. Chaque jour, Test de Constitution avec malus −3 + (−1 par heure passée sous drogues). Réussite réduit le malus. Échec = perte d'1 point dans un Attribut aléatoire. Si un Attribut tombe à 2 ou moins = mort.

Étape 4 — Mort environnementale :

    Si l'armure n'a pas de système « Dernière chance » :

        En milieu sous-marin ou spatial : implosion instantanée, mort du pilote.

        À l'air libre : le pilote subit 1D10 + (dommages excédant 30) points de Dommages directs.

4.11 Routine environnementale — Pression et écrasement

Cette routine s'applique uniquement aux armures évoluant en milieu sous-marin.

Zone opérationnelle (profondeur ≤ profondeur_opérationnelle) : aucun effet.

Zone limite (profondeur_opérationnelle < profondeur < profondeur_écrasement) :

    Toutes les 10 minutes (en temps de jeu), un Test de Pression est effectué.

    Jet : 1D20 + Malus de gravité des Avaries actuelles (Légère −1, Moyenne −2, Grave −3, Critique −4, Catastrophique −5).

    Si le résultat est supérieur à l'Intégrité Structure courante, l'armure subit automatiquement une Avarie légère (localisée au hasard : Structure ou Systèmes).

Zone d'écrasement (profondeur ≥ profondeur_écrasement) :

    Destruction immédiate de l'armure. Mort du pilote. Aucun jet, aucune parade possible.

4.12 Réparation

La réparation d'une armure comporte deux aspects distincts : effacer les Avaries et restaurer l'Intégrité.
4.12.1 Réparation des Avaries

    Compétence : Mécanique (Exo-armures).

    Les Avaries sont traitées seuil par seuil (toutes les Avaries légères en une fois, puis les moyennes, etc.), dans n'importe quel ordre.

    Chaque case cochée au-delà de la première sur la ligne en cours impose un malus cumulatif de -2 au Test.

Gravité réparée	Temps nécessaire	Difficulté	Coût
Légères	1 jour	+5	1% du prix de l'armure
Moyennes	3 jours	+3	3% du prix de l'armure
Graves	5 jours	+0	5% du prix de l'armure
Critiques	1 semaine	−3	10% du prix de l'armure
Catastrophiques	2 semaines	−5	15% du prix de l'armure
Destruction	3 semaines	−7	15% du prix de l'armure (si réparable)

    Réussite : toutes les cases de la ligne traitée sont effacées.

    Échec : rien n'est réparé.

    Catastrophe au dé : une case d'Avarie supplémentaire est ajoutée sur la ligne en cours (la détection d'une Catastrophe dépend des règles de marge de réussite/échec — ⚠️ voir section 6, Question ouverte §6.1).

4.12.2 Restauration de l'Intégrité des composants

Chaque composant doit être réparé individuellement.
Composant	Compétence requise
Structure	Mécanique (Exo-armures)
Exosquelette	Mécanique (Exo-armures)
Générateur	Mécanique (Exo-armures)
Systèmes auxiliaires	Électronique
Armement	Armurerie

La procédure est la même que pour la réparation d'équipement standard :

    Test de Compétence.

    La marge de réussite indique le nombre de points d'Intégrité courante récupérés.

    Une Catastrophe au dé fait échouer la réparation et fait perdre définitivement 1 point d'Intégrité maximale au composant.

Note sur l'Intégrité négative : si la Structure est descendue à 0 ou en dessous (niveaux négatifs suite à une destruction), il faut d'abord restaurer l'Intégrité à au moins 1 avant que l'armure redevienne utilisable.
5. Règles optionnelles

Cette section identifie les règles marquées « OPTIONNEL » dans le Livre de Base et précise si elles sont retenues pour la version actuelle du projet.
5.1 Malus de Saisie / Lutte — RETENU

Source : REGLEARMURE.md p.326, encadré optionnel

Les armures lourdes ne sont pas conçues pour la lutte au corps à corps. Un malus s'applique aux actions de Saisie ou de Lutte :
Catégorie	Malus
exo-2, exo-3	−3
exo-4	−5
exo-5, exo-6	−7
exo-oméga	−10 et plus

Les catégories exo-alpha, exo-0 et exo-1 ne subissent pas ce malus.
5.2 Armure à terre — RETENU

Source : REGLEARMURE.md p.326, encadré optionnel

Si une armure de catégorie exo-1 ou plus est mise à terre à l'air libre, un Test de Manœuvre d'armure est nécessaire pour se redresser :
Catégorie	Modificateur au Test
exo-1	+5
exo-2	+3
exo-3	+0
exo-4	−3
exo-5	−5
exo-6	−7
exo-oméga	−10

Sous l'eau, ce Test n'est nécessaire que si l'armure n'a ni palmes ni système de propulsion fonctionnels.
5.3 Modificateur d'Initiative par système de contrôle — NON RETENU pour le moment

Source : REGLEARMURE.md p.330, encadré optionnel

Cette règle optionnelle ajoute un malus/bonus à l'Initiative selon le type d'interface de contrôle (manuelle, vocale, neuronale…). Non retenue pour la version actuelle — pourra faire l'objet d'un ajout ultérieur.
5.4 Armures assistées (exo-alpha/0 sans exosquelette) — NON TRAITÉES

Source : REGLEARMURE.md p.325, encadré

Les armures légères portées sans exosquelette sont traitées comme des protections simples et sortent du cadre de ce MANUEL. Elles suivent les règles d'équipement standard.
5.5 Intégrité des éléments (règle optionnelle) — RETENUE

Source : REGLEARMURE.md p.325, encadré

La gestion de l'Intégrité par composant (Structure, Exosquelette, Générateur, Systèmes, Armement) est une règle optionnelle dans le LdB. Elle est retenue dans ce projet car elle constitue le cœur du sous-système de dégradation.
5.6 Viser un endroit particulier — NON RETENU pour le moment

Source : REGLEARMURE.md p.327, encadré optionnel

Pouvoir cibler spécifiquement un système ou un point faible de l'armure avec un malus au Test d'attaque. Non retenu pour la version actuelle.
6. Questions ouvertes et ambiguïtés
6.1 Détection de la Catastrophe (marge de réussite/échec) — ⚠️ BLOQUANT

Source : REGLEARMURE.md p.329-330, règles de réparation

La réparation des Avaries mentionne une « Catastrophe au dé » qui ajoute une Avarie supplémentaire. La définition exacte d'une Catastrophe (échec critique) dépend de la règle générale de marge de réussite/échec, qui est actuellement en cours de clarification dans un chantier séparé (PLAN_TEST_CRITIQUE.md).

Conséquence : la section Réparation (§4.12) ne peut pas être codée tant que cette règle n'est pas stabilisée. Le PLAN devra intégrer cette dépendance et prévoir un point d'extension.
6.2 Dégâts à l'échelle des Véhicules légers (EXF ≥ 50) — REPORTÉ

Lorsque l'Exo-Force atteint 50, l'armure peut infliger des dégâts à l'échelle des Véhicules légers. Lorsqu'elle atteint 100, elle inflige des Dommages massifs. Ces mécaniques dépendent d'un système de véhicules qui n'existe pas encore. Le traitement est repoussé à un futur MANUEL Véhicules.
6.3 Gestion du token du pilote pendant le pilotage — HORS SCOPE V1

Que devient le token du personnage humain lorsque celui-ci pilote une armure ? Est-il masqué, déplacé automatiquement, laissé sur place ? Cette question n'est pas tranchée dans le LdB (le RAW suppose que le pilote est à l'intérieur de l'armure). Le PLAN devra statuer sur un comportement par défaut pour la V1, quitte à l'affiner plus tard.
6.4 Isolation automatique des systèmes par palier du Générateur — PRÉCISION NÉCESSAIRE

Le RAW (§4.8.3) indique que les systèmes sont isolés « au moment où le niveau descend à 10 » (ou 5). Cela signifie que l'isolation est un événement ponctuel déclenché par le franchissement de seuil, pas un état permanent réévalué à chaque Tour. Le PLAN devra clarifier : que se passe-t-il si des points d'Intégrité Générateur sont restaurés (réparation) ? Les systèmes précédemment isolés sont-ils automatiquement réalimentés ?
7. Hors périmètre

Ce MANUEL ne couvre pas les sujets suivants, qui feront l'objet de MANUELs ou de PLANS séparés :

    Véhicules légers et navires (règles p.348+) : bien que les armures lourdes (exo-5 et plus) soient considérées comme des véhicules légers, le système de combat naval n'est pas traité ici.

    Attaques IEM (Impulsions Électro-Magnétiques) : mentionnées dans le RAW mais non détaillées ici — chantier séparé.

    Catalogue complet des modèles d'armures (p.338-347) : seuls les attributs génériques sont couverts. Les fiches spécifiques (Explora, Typhon, Nymph, Orka…) ne sont pas listées.

    Catalogue complet des équipements (p.331-338) : seuls les principes généraux sont couverts. Les équipements spécifiques (senseurs, armes, communicateurs…) ne sont pas listés.

    Interface utilisateur : le MANUEL ne décrit pas comment les données sont présentées à l'écran (fenêtres, formulaires, rendu 3D).

    Télépilotage des drones : bien que la relation pilote-machine soit conceptuellement similaire, les drones obéissent à des règles différentes et ne sont pas couverts ici.

8. Passage au PLAN

Cette section synthétise les informations utiles pour l'étape suivante (rédaction du PLAN d'implémentation).
8.1 Points bloquants

    Détection de la Catastrophe (§6.1) : la section Réparation dépend de la clarification en cours sur la marge de réussite/échec critique. Le PLAN ne pourra pas finaliser le lot Réparation tant que PLAN_TEST_CRITIQUE.md n'aura pas tranché.

    Aucun autre bloquant identifié à ce stade.

8.2 Dépendances externes

    token_statuses (mécanisme existant) : les effets d'incident à durée fixe (paralysie, coupure) doivent utiliser le système générique de statuts temporaires.

    Système de combat existant : les exo-armures s'insèrent dans le même pipeline d'initiative, de tours et de résolution d'actions.

    Système de Blessures humaines : les dégâts « Pilote » (incident 10) doivent être redirigés vers le personnage humain lié.

    VOCABULARY.md : de nombreux termes nouveaux sont à ajouter (voir §8.3).

8.3 Termes à ajouter à VOCABULARY.md

Les concepts suivants, utilisés dans ce MANUEL, doivent être formalisés dans docs/VOCABULARY.md s'ils n'y figurent pas déjà :

    Exo-armure (armure mécanisée)

    Catégorie d'armure (exo-alpha, exo-0… exo-oméga)

    Environnement nominal

    Exo-Force (EXF)

    Blindage (BLD)

    Résistance aux Dommages (RD)

    Intégrité (maximale, courante)

    Structure, Exosquelette, Générateur (composants)

    Avarie (légère, moyenne, grave, critique, catastrophique)

    Compteur d'Avaries

    Incident

    Manœuvre d'armure (compétence)

    Systèmes auxiliaires

    Armement (hardpoints)

    Système « Dernière chance » (Guillotine, Congélation, Injection)

8.4 Complexités majeures

    Incidents Structure avec fuite évolutive (§4.9.1) : ce mécanisme combine un délai de colmatage, une action joueur, et une escalade automatique. C'est le point le plus complexe du pipeline d'incidents — le PLAN devra lui consacrer une attention particulière.

    Isolation automatique des systèmes au franchissement de seuil de Générateur (§4.8.3) : événement ponctuel avec sélection aléatoire, épargnant le support vital, avec un comportement à clarifier en cas de réparation.

    Paliers d'Intégrité dynamiques (§4.8) : les stats effectives doivent être recalculées à chaque lecture, jamais stockées. Ce patron de conception (derived data) doit être rigoureusement respecté pour éviter les désynchronisations.

8.5 Ordre de priorité suggéré

Cet ordre est une suggestion — le PLAN pourra le modifier.

    Fondations (entités, fiches, lien pilote)

    Substitution d'attributs et paliers dynamiques

    Initiative et déplacement

    Pipeline de dégâts et compteur d'Avaries

    Incidents (par localisation, en commençant par le plus simple)

    Destruction majeure

    Routine environnementale (pression)

    Réparation (bloquée, cf. §6.1)

Fin du MANUEL_EXOARMURE.md réécrit.