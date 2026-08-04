MANUEL_CREATION_ETAPE2_GENETIQUE.md

    Statut : Rédaction 2026-08-04 — MANUEL de l'étape 2 « Type génétique » du sous-système de création de personnage. Ce document décrit la logique de choix du type génétique (humain normal ou hybride) et ses conséquences mécaniques immédiates. Il s'insère dans le cadre défini par MANUEL_CREATION_CHAPEAU.md — le vocabulaire commun (PC, étape, archétype) y est défini et n'est pas redéfini ici.

    Principe fondateur : Ce document décrit quoi faire, jamais comment (pas de code, pas de SQL, pas de choix d'implémentation). Il doit être compréhensible et validable par un expert règles sans connaissance technique.

    Cycle de vie prévu : Rédaction → Validation Saar → Passage au PLAN → Archivage. Ce document ne sera pas modifié après le démarrage du PLAN.

1. Sources RAW
Fichier dépôt	Pages LdB	Contenu couvert
docs/REGLES/REGLECREATION.md	p.119	Introduction — quatre types génétiques, humain normal par défaut
docs/REGLES/REGLECREATION.md	p.119-120	Hybride naturel (coût, modificateurs d'Attributs, Avantages/Désavantages)
docs/REGLES/REGLECREATION.md	p.121-122	Géno-hybride (coût, conditions, modificateurs, spécificités)
docs/REGLES/REGLECREATION.md	p.122-123	Techno-hybride (coût, conditions, modificateurs, spécificités)

Sources connexes :

    MANUEL_CREATION_CHAPEAU.md — Budget PC, interactions entre étapes.

    MANUEL_CREATION_ETAPE1_ATTRIBUTS.md — Attributs principaux avant modificateurs.

    MANUEL_CREATION_ETAPE4_EXPERIENCE.md — Certaines conditions d'accès aux types hybrides sont vérifiées à l'étape 4.

2. Entités et attributs
2.1 Type génétique

Le type génétique définit la nature biologique du personnage et sa capacité à évoluer en milieu aquatique. Il existe quatre types :

    Humain normal — aucun avantage ni inconvénient particulier.

    Hybride naturel (néo-hybride) — mutant naturel, le plus adapté à l'eau, le plus désavantagé à l'air libre.

    Géno-hybride — humain transformé par la technologie du Culte du Trident.

    Techno-hybride — humain lourdement modifié par l'Hégémonie, souvent contre son gré.

Chaque type hybride possède :

    Un coût en PC.

    Des modificateurs d'Attributs appliqués aux valeurs issues de l'étape 1.

    Des Avantages et Désavantages automatiques (distincts de ceux de l'étape 5 — ils ne coûtent ni ne rapportent de PC supplémentaires).

    Des conditions d'accès qui peuvent exiger certaines années d'expérience (étape 4).

2.2 Compétence Hybride

La Compétence Hybride est une compétence spéciale réservée aux personnages de type hybride. Elle représente leur affinité avec le milieu aquatique. Son niveau de maîtrise initial dépend du type génétique, et elle évolue avec l'expérience (voir étape 4). Elle est utilisée pour :

    Les Tests de déplacement et d'action sous l'eau (à la place de Manœuvres sous-marines ou Athlétisme, selon le type).

    Déterminer la profondeur maximale que le personnage peut atteindre.

    Déclencher les effets de la Mutation évolutive (pour les hybrides naturels et géno-hybrides).

3. Relations et dépendances
3.1 Avec les autres étapes de création

    Étape 1 (Attributs) : les modificateurs d'Attributs du type génétique s'appliquent après la répartition de l'étape 1. Ils peuvent faire dépasser le plafond temporaire de 20.

    Étape 4 (Expérience préliminaire) : certaines conditions d'accès aux types hybrides exigent des années spécifiques dans des Professions (ex : Techno-hybride → 2 ans Soldat/Milicien + 1 an Techno-hybride). La vérification se fait à l'étape 4, mais le joueur doit anticiper le coût en années dès l'étape 2.

    Étape 5 (Avantages/Désavantages) : les Avantages/Désavantages conférés par le type génétique sont automatiques et distincts de ceux de l'étape 5. Un hybride peut tout à fait acheter des Avantages supplémentaires ou prendre des Désavantages supplémentaires à l'étape 5.

3.2 Avec les autres sous-systèmes

    Compétences : la Compétence Hybride est une compétence spéciale. Elle suit les règles normales d'amélioration des Compétences (étape 4).

    Environnement : les règles de profondeur, de froid, de chaleur, et de dépendance au milieu aquatique interagissent avec le système d'environnement (pression, température…).

4. Règles logiques
4.1 Humain normal

Coût : 0 PC.

Modificateurs d'Attributs : aucun.

Avantages/Désavantages automatiques : aucun.

L'humain normal ne possède pas la Compétence Hybride. Il est soumis aux règles normales de déplacement sous l'eau (Compétence limitative Manœuvres sous-marines, équipement obligatoire pour respirer, etc.).
4.2 Coût en PC des types hybrides
Type génétique	Coût de base	Coût réduit (condition)
Hybride naturel	5 PC	—
Géno-hybride	5 PC	—
Techno-hybride	5 PC	4 PC si le personnage est un déserteur (recherché par l'Hégémonie)

Le coût en PC n'inclut pas les années d'expérience préliminaire nécessaires pour certains types (ex : le Techno-hybride exige 2 ans de Soldat/Milicien + 1 an de Techno-hybride, qui coûtent 3 PC supplémentaires à l'étape 4).
4.3 Modificateurs d'Attributs par type

Les modificateurs suivants sont appliqués après la répartition de l'étape 1. Ils peuvent faire dépasser le plafond de 20, ou faire descendre un Attribut en dessous de 7.
Attribut	Hybride naturel	Géno-hybride	Techno-hybride
Force	+1	+1	+2
Constitution	+2	+1	+3
Coordination	+2	+2	—
Adaptation	+1	—	−2
Intelligence	−2	—	—
Volonté	—	—	+3
Présence	—	−2	−6 (minimum 3)

Exemple : un personnage avec Force 14 à l'étape 1 devient Force 15 en hybride naturel, Force 16 en techno-hybride.
4.4 Règles communes à tous les hybrides

Les règles suivantes s'appliquent à tous les types hybrides (naturel, géno, techno), sauf exception explicitement mentionnée dans les spécificités de chaque type.
4.4.1 Adaptation aquatique

Tous les hybrides sont parfaitement adaptés au milieu aquatique. Leurs Compétences physiques ne sont pas limitées par la Compétence limitative Manœuvres sous-marines. Leur vitesse de déplacement sous l'eau est celle de la colonne « Techno-hybride » de la table des déplacements (voir chapitre Combat, page 220).
4.4.2 Immunité au froid (dans l'eau seulement)

Tous les hybrides ne ressentent pas la température de l'eau. Aucune pénalité due au froid en immersion. Hors de l'eau, ils sont vulnérables normalement.
4.4.3 Sensibilité à la chaleur

Tous les hybrides tolèrent mal la chaleur.
Type	Effet
Hybride naturel	Dommages de feu/chaleur augmentés de +3. Malus de -3 aux Tests de Fatigue en environnement chaud. Si au repos, Test de Fatigue toutes les 2 heures.
Géno-hybride	Dommages de feu/chaleur augmentés de +2. Mêmes conditions de Tests.
Techno-hybride	Dommages de feu/chaleur augmentés de +2. Mêmes conditions de Tests.

Si le MJ n'utilise pas les règles avancées de Fatigue, appliquer un malus général de -2 à tous les Tests, augmenté de -1 toutes les 2 heures (maximum -10, puis Tests de Résistance au Choc à la discrétion du MJ).
4.4.4 Dépendance au milieu aquatique

Tous les hybrides doivent rester hydratés. Après un temps passé hors de l'eau, un Test de Volonté est requis.
Type	Délai avant premier Test	Intervalle entre Tests	Malus cumulatif par intervalle
Hybride naturel	Volonté en heures	1 heure	−2 (−3 dès Hybride +7)
Géno-hybride	Volonté en heures	2 heures	−2 (−3 dès Hybride +10)
Techno-hybride	Volonté en heures	10 heures	−2

Effet en cas d'échec : perte temporaire de 1 point de Force et malus cumulatif de -1 à tous les Tests physiques (y compris Fatigue) par échec. Si la Force est réduite de 50%, le personnage doit impérativement s'immerger. Récupération en 2D6 minutes une fois dans l'eau.

Tenues hydratantes : elles confèrent un bonus de +10 au Test de Volonté.
4.4.5 Claustrophobie

Tous les hybrides souffrent de claustrophobie dans les endroits étroits ou bondés.

    Malus de -3 à tous les Tests.

    En armure : Test de Volonté toutes les heures, avec malus cumulatif de -2 par heure passée dans l'armure. En cas d'échec, le personnage tente de retirer l'armure. En cas de Catastrophe, crise de panique (paralysie). En cas de réussite, le bonus de réussite s'ajoute au malus du prochain Test.

Note : les hybrides en armure subissent le malus général de -2 à leurs Tests, mais celui-ci ne compte pas pour le Test de Volonté.
4.4.6 Recherché

Tous les hybrides sont des individus recherchés par les marchands de chair, les laboratoires génétiques, et le Culte du Trident (pour les hybrides naturels et géno-hybrides). Les techno-hybrides sont souvent des fugitifs hégémoniens traqués par le Prisme. Cet état de fait n'est pas un Désavantage mécanique au sens de l'étape 5, mais une contrainte narrative et sociale permanente.
4.5 Hybride naturel — Spécificités
4.5.1 Compétence Hybride

    Niveau de maîtrise initial : +3.

    Peut remplacer Manœuvres sous-marines et Athlétisme (natation) si le personnage est libre de ses mouvements (pas d'armure, pas de combinaison).

    Coût d'amélioration normal (comme une Compétence professionnelle) — voir étape 4.

4.5.2 Profondeur maximale

Un hybride naturel peut plonger jusqu'à (niveau global d'Hybride) × 1 000 mètres. Il ne peut pas dépasser 100 m tant qu'il n'a pas développé Hybride au niveau 1.
4.5.3 Mutation évolutive

La Mutation évolutive est un processus graduel qui modifie l'apparence et les capacités de l'hybride à mesure que sa Compétence Hybride progresse.

Effets mécaniques par palier de maîtrise (niveau de maîtrise, pas niveau global) :
Niveau de maîtrise atteint	Résistance aux dommages (sec/eau)	Perception visuelle (sec/eau)
+5	+1 / −1	−1 / +1
+7	+2 / −2	−2 / +2
+10	+3 / −3	−3 / +3
+13	+4 / −4	−4 / +4
+15	+5 / −5	−5 / +5

    Résistance aux dommages : modificateur cumulatif appliqué aux dommages subis. Au sec, un modificateur positif rend plus vulnérable. Sous l'eau, un modificateur négatif réduit les dommages subis.

    Perception visuelle : modificateur cumulatif aux Tests de Perception sollicitant directement la vue.

4.5.4 Blocage du Trident

Un hybride naturel ne peut pas agir contre un prêtre du Trident ou le Culte sans réussir un Test de Volonté avec un malus de −5. S'il est confronté directement à un prêtre, Test d'opposition de Volonté avec le même malus.

Note : si l'hybride doit agir contre une personne se prétendant prêtre, ce blocage peut lui révéler si l'individu est véritablement un prêtre (il ressentira le blocage). L'hybride ne peut pas se montrer hostile a priori pour tester cela.
4.6 Géno-hybride — Spécificités
4.6.1 Conditions d'accès

Le personnage doit avoir passé au moins 1 an au sein du Groupe spécial d'intervention du Culte du Trident. Cette année est à comptabiliser dans l'expérience préliminaire (étape 4).
4.6.2 Compétence Hybride

    Niveau de maîtrise initial : +0.

    Peut remplacer Manœuvres sous-marines (mais pas Athlétisme pour la natation) si libre de ses mouvements.

    Coût d'amélioration normal.

4.6.3 Profondeur maximale

Un géno-hybride peut plonger jusqu'à (niveau global d'Hybride / 2) × 1 500 mètres. Il ne peut pas dépasser 100 m tant qu'il n'a pas développé Hybride au niveau 1.
4.6.4 Mutation évolutive

Mêmes effets que l'hybride naturel (tableau §4.5.3), mais les paliers sont atteints aux niveaux de maîtrise +5, +10 et +15 seulement. Le modificateur maximum est donc de ±3 au lieu de ±5.
4.6.5 Blocage du Trident

Même règle que l'hybride naturel (§4.5.4), mais le malus est de −7 au lieu de −5.
4.7 Techno-hybride — Spécificités
4.7.1 Conditions d'accès

Le personnage doit :

    Être originaire d'Hégémonie.

    Avoir passé au moins 2 ans dans la Profession Soldat/Milicien.

    Avoir passé au moins 1 an dans la Profession Techno-hybride après sa modification.

Ces années sont à comptabiliser dans l'expérience préliminaire (étape 4).
4.7.2 Compétence Hybride

    Niveau de maîtrise initial : +0.

    Ne peut pas remplacer Manœuvres sous-marines ou Athlétisme. Ces compétences doivent être développées séparément.

    Coût d'amélioration normal.

4.7.3 Profondeur maximale

Un techno-hybride peut plonger jusqu'à 1 500 mètres + (niveau global d'Hybride / 2) × 1 500 mètres. Il ne peut pas dépasser 100 m tant qu'il n'a pas développé Hybride au niveau 1.
4.7.4 Mutation évolutive

Le techno-hybride ne subit pas de Mutation évolutive. Il ne bénéficie pas des modificateurs de Résistance aux dommages et de Perception visuelle liés à cette règle.
4.7.5 Blocage du Trident

Le techno-hybride ne souffre pas du Blocage du Trident.
4.7.6 Coût réduit (déserteur)

Si le personnage est un déserteur hégémonien recherché par le Prisme, le coût du type génétique est réduit à 4 PC au lieu de 5.
5. Règles optionnelles
5.1 Jouer un hybride (recommandation MJ) — INFORMATION

Source : REGLECREATION.md p.119, encadré

Le LdB recommande aux MJ de ne pas laisser des joueurs débutants incarner des hybrides, en raison de la complexité des règles spécifiques. Ce n'est pas une règle mécanique, mais une recommandation d'accompagnement. Le PLAN pourra prévoir un avertissement dans l'interface si un joueur choisit un type hybride.
5.2 Mutants et société — OPTIONNEL, traité à l'étape 3

Source : REGLECREATION.md p.123, encadré optionnel

Cette règle optionnelle impose des malus sociaux (Présence, Compétences sociales) aux mutants et hybrides selon la communauté. Elle est traitée dans MANUEL_CREATION_ETAPE3_CAPACITES.md.
6. Questions ouvertes et ambiguïtés
6.1 Calcul de la profondeur maximale avec niveau global nul

Le RAW indique qu'un hybride ne peut pas dépasser 100 m tant qu'il n'a pas développé Hybride au niveau 1 (niveau global). Le PLAN devra clarifier le comportement pour un niveau global de 0 (ex : géno-hybride avec Hybride +0) : la profondeur est-elle de 0 m, de 100 m, ou autre ?
6.2 Cumul des modificateurs de Mutation évolutive

Les modificateurs de la Mutation évolutive sont "cumulatifs" — le modificateur total à +10 est la somme des modificateurs de +5, +7 et +10. Le PLAN devra s'assurer que cette accumulation est correctement calculée.
7. Hors périmètre

    La liste complète des Professions (Soldat/Milicien, Techno-hybride, etc.) — voir le MANUEL correspondant ou la source de données Professions.

    Les règles détaillées de déplacement sous l'eau — voir le chapitre Combat.

    Les règles de Fatigue — sous-système distinct.

    Les règles de Pression et de profondeur pour les personnages non hybrides — hors périmètre de la création.

    L'évolution post-création de la Compétence Hybride — l'étape 4 ne traite que l'expérience préliminaire, pas la progression en cours de campagne.

8. Passage au PLAN
8.1 Points bloquants

Aucun point bloquant identifié.
8.2 Dépendances externes

    Système d'Attributs (étape 1) : les modificateurs s'appliquent après le calcul initial.

    Système de Compétences : la Compétence Hybride doit être créée et intégrée à la liste des compétences spéciales.

    Système de Fatigue : requis pour les Tests liés à la chaleur et à la dépendance au milieu aquatique. Si le système n'est pas encore implémenté, la règle alternative (malus général de -2) doit être utilisée.

    Système d'environnement : la profondeur, la température, et le milieu (eau/air) doivent être disponibles pour appliquer les modificateurs de Mutation évolutive, de Dépendance, etc.

8.3 Termes à ajouter à VOCABULARY.md

    Type génétique — déjà défini dans le chapeau.

    Hybride naturel / Géno-hybride / Techno-hybride — les trois types hybrides.

    Compétence Hybride — compétence spéciale des hybrides.

    Mutation évolutive — dégradation progressive des capacités selon le niveau d'Hybride.

    Blocage du Trident — impossibilité psychologique d'agir contre le Culte.

    Adaptation aquatique — absence de limitation par Manœuvres sous-marines.

    Dépendance au milieu aquatique — nécessité de s'immerger régulièrement.

    Tenue hydratante — équipement réduisant la Dépendance.

8.4 Complexités majeures

    Gestion des modificateurs dynamiques : la Mutation évolutive (hybride naturel et géno) introduit des modificateurs qui varient dans le temps (selon le niveau de Compétence) et selon le milieu (air/eau). Le PLAN devra décider si ces modificateurs sont recalculés à la volée ou stockés.

    Interactions avec la Fatigue : si le système de Fatigue n'est pas encore prêt, la règle alternative (malus général) doit être intégrée comme solution temporaire. Le PLAN devra prévoir une migration vers le système de Fatigue lorsqu'il sera disponible.

8.5 Ordre de priorité suggéré

    Étape 1 — Attributs (réalisé)

    Étape 2 — Type génétique (ce MANUEL)

    Étape 3 — Capacités spéciales

    Étape 4 — Expérience préliminaire

    Étape 5 — Avantages/Désavantages

Fin du MANUEL_CREATION_ETAPE2_GENETIQUE.md.