MANUEL_CREATION_ETAPE1_ATTRIBUTS.md

    Statut : Rédaction 2026-08-04 — MANUEL de l'étape 1 « Capacités de base » du sous-système de création de personnage. Ce document décrit la logique de répartition des Attributs principaux et de la Chance. Il s'insère dans le cadre défini par MANUEL_CREATION_CHAPEAU.md — le vocabulaire commun (PC, étape, archétype) y est défini et n'est pas redéfini ici.

    Principe fondateur : Ce document décrit quoi faire, jamais comment (pas de code, pas de SQL, pas de choix d'implémentation). Il doit être compréhensible et validable par un expert règles sans connaissance technique.

    Cycle de vie prévu : Rédaction → Validation Saar → Passage au PLAN → Archivage. Ce document ne sera pas modifié après le démarrage du PLAN.

1. Sources RAW
Fichier dépôt	Pages LdB	Contenu couvert
docs/REGLES/REGLECREATION.md	p.118	Valeur de base des Attributs (score de départ, ambiances, plafond temporaire)
docs/REGLES/REGLECREATION.md	p.118	Table des coûts progressifs (niveaux 8 à 20)
docs/REGLES/REGLECREATION.md	p.118	Amélioration des Attributs par PC (méthode 2)
docs/REGLES/REGLECREATION.md	p.118	Valeur de base de la Chance
docs/REGLES/REGLECREATION.md	p.118-119	Niveau de base des Compétences (rappel — non détaillé ici)

Sources connexes :

    MANUEL_CREATION_CHAPEAU.md — Budget PC global, interactions entre étapes.

    Le calcul des Attributs secondaires et des niveaux de base des Compétences est référencé mais non décrit ici (sous-systèmes distincts).

2. Entités et attributs
2.1 Attribut principal

Un Attribut principal est une caractéristique fondamentale du personnage (Force, Constitution, Coordination, Adaptation, Perception, Intelligence, Volonté, Présence). Il possède une valeur numérique qui influence les Attributs secondaires et les niveaux de base des Compétences.

À ce stade de la création, les Attributs n'ont pas encore de modificateurs liés au type génétique (étape 2), aux mutations (étape 3), ou à l'âge (étape 4). Ces modificateurs s'appliqueront ultérieurement et pourront faire dépasser le plafond temporaire de 20.
2.2 Point d'Attribut

Le point d'Attribut est l'unité de progression des Attributs principaux. Il ne doit pas être confondu avec le Point de Création (PC). Un PC dépensé dans cette étape donne 2 points d'Attributs (voir section 4.2).
2.3 Chance

La Chance est un Attribut spécial, distinct des 8 Attributs principaux. Elle possède sa propre valeur de départ (voir section 4.3) et n'est pas améliorable par des points d'Attributs ou des PC lors de cette étape.
3. Relations et dépendances
3.1 Avec les autres étapes de création

    Étape 2 (Type génétique) : modifie les Attributs principaux calculés ici. Les modificateurs s'appliquent après la répartition initiale et peuvent faire dépasser le plafond temporaire de 20.

    Étape 4 (Expérience préliminaire) : les effets de l'âge (fin de l'étape 4) réduisent les Attributs.

    Étape 3 et 5 : pas d'interaction directe avec les Attributs (sauf si une mutation ou un Avantage modifie un Attribut — traité dans les MANUELs correspondants).

3.2 Avec les autres sous-systèmes

    Attributs secondaires : calculés à partir des Attributs principaux une fois toutes les modifications appliquées (étapes 1 à 4). Le calcul générique n'est pas décrit ici.

    Compétences : les niveaux de base des Compétences dépendent des Attributs principaux. Le calcul n'est pas décrit ici — seul un rappel est donné en section 4.4.

4. Règles logiques
4.1 Valeur de base des Attributs

Source : REGLECREATION.md p.118

Chaque Attribut principal commence avec une valeur de 7. Le joueur reçoit ensuite un nombre de points d'Attributs supplémentaires à répartir librement entre les 8 Attributs. Ce nombre dépend de l'ambiance de jeu choisie par le MJ :
Ambiance	Points d'Attributs supplémentaires	Total à répartir (8 × 7 + suppl.)
Réaliste	30	86
Intermédiaire	38	94
Héroïque	46	102

Règles de répartition :

    Plafond temporaire : à ce stade, aucun Attribut ne peut dépasser 20. Ce plafond pourra être dépassé ultérieurement (type génétique, mutations…).

    Coût progressif : les niveaux n'ont pas tous le même coût en points d'Attributs. Voir tableau ci-dessous.

    Niveaux 8 à 15 : coût normal (1 point par niveau).

    Niveaux 16 à 18 : coût double (2 points par niveau).

    Niveaux 19 et 20 : coût triple (3 points par niveau).

Table complète des coûts :
Niveau visé	Coût cumulé en points d'Attributs (depuis la base de 7)
8	1
9	2
10	3
11	4
12	5
13	6
14	7
15	8
16	10
17	12
18	14
19	17
20	20

Exemple : pour amener un Attribut de 7 à 14, il faut dépenser 7 points d'Attributs. Pour l'amener de 7 à 17, il faut 12 points. Pour l'amener de 7 à 20, il faut 20 points — soit le maximum possible à ce stade.

Exemple (création de Carian, ambiance Intermédiaire) : le joueur reçoit 38 points d'Attributs. Il répartit comme suit : Force 12 (5 points), Constitution 13 (6 points), Coordination 12 (5 points), Adaptation 12 (5 points), Perception 10 (3 points), Intelligence 10 (3 points), Volonté 14 (7 points), Présence 9 (2 points). Total : 5+6+5+5+3+3+7+2 = 36 points sur 38. Il reste 2 points non utilisés.
4.2 Amélioration des Attributs par PC (méthode 2)

Source : REGLECREATION.md p.118

Le joueur peut dépenser des PC (Points de Création, voir MANUEL_CREATION_CHAPEAU.md) pour obtenir des points d'Attributs supplémentaires. 1 PC = 2 points d'Attributs.
PC dépensés	Points d'Attributs gagnés
1 PC	+2
2 PC	+4
3 PC	+6
4 PC	+8
5 PC	+10
6 PC	+12
7 PC	+14
8 PC	+16

Les règles de répartition (coût progressif, plafond à 20) restent inchangées.

Exemple (création de Carian) : le joueur a alloué 5 PC à cette étape. Il gagne 10 points d'Attributs supplémentaires. Il améliore Force à 14 (coût : 2 points), Constitution à 14 (1 point), Coordination à 14 (2 points), Perception à 12 (2 points), Adaptation à 15 (3 points). Total : 2+1+2+2+3 = 10 points. Les autres Attributs restent inchangés.
4.3 Valeur de base de la Chance

Source : REGLECREATION.md p.118

Le score de Chance de départ dépend de l'ambiance de jeu :
Ambiance	Chance de départ
Réaliste	11
Intermédiaire	13
Héroïque	15

La Chance n'est pas améliorable par des points d'Attributs ou des PC à cette étape. Elle pourra être modifiée ultérieurement par des Avantages ou Désavantages (étape 5).
4.4 Niveau de base des Compétences (rappel)

Source : REGLECREATION.md p.118-119

    Note : ceci est un rappel. Le calcul détaillé appartient au sous-système des Compétences, pas à ce MANUEL.

À ce stade, le personnage ne possède encore aucun niveau de maîtrise dans ses Compétences. Chaque Compétence a toutefois un niveau de base, calculé ainsi :

    Si la Compétence est associée à deux Attributs : niveau de base = Aptitude naturelle du premier Attribut + Aptitude naturelle du second.

    Si la Compétence est associée à un seul Attribut : niveau de base = Aptitude naturelle de cet Attribut × 2.

L'Aptitude naturelle est elle-même dérivée du niveau de l'Attribut (table standard, hors périmètre de ce MANUEL).

Règle importante : il n'est pas nécessaire de calculer tous les niveaux de base à ce stade. Le calcul peut être fait plus tard, lorsque la Compétence est effectivement utilisée ou améliorée (étape 4). Les niveaux de base seront de toute façon recalculés si les Attributs sont modifiés par les étapes ultérieures (type génétique, âge…).
5. Règles optionnelles
5.1 Ambiance de jeu — RETENUE

Source : REGLECREATION.md p.118

Cf. section 4.1. L'ambiance de jeu est un paramètre global de campagne. Elle est traitée comme une règle standard dans ce MANUEL.
5.2 Personnage féminin — NON RETENU

Source : REGLECREATION.md p.118, encadré optionnel

Cette règle propose des modifications d'Attributs basées sur le sexe du personnage (Force −2, bonus de +1 en Coordination ou Présence). Non retenue — la création est unisexe par défaut. Voir MANUEL_CREATION_CHAPEAU.md section 5.1 pour la décision globale.
6. Questions ouvertes et ambiguïtés
6.1 Points d'Attributs non utilisés

Le RAW ne précise pas si les points d'Attributs non répartis à la fin de l'étape 1 sont perdus ou reportés. Le chapeau (MANUEL_CREATION_CHAPEAU.md) indique que les PC non dépensés restent disponibles, mais les points d'Attributs sont une sous-unité propre à l'étape 1 (1 PC = 2 points d'Attributs). Logiquement, les points d'Attributs non utilisés sont perdus une fois l'étape 1 terminée — ils ne peuvent pas être convertis en PC pour les étapes suivantes. Le PLAN devra clarifier ce point dans l'interface.
6.2 Plafond temporaire de 20

Le RAW fixe un plafond à 20 « à ce stade ». Les étapes ultérieures (type génétique, mutations) peuvent le dépasser. Le PLAN devra s'assurer que la validation du plafond est bien une contrainte temporaire, pas une règle permanente sur la fiche de personnage.
7. Hors périmètre

    Le calcul des Attributs secondaires (Aptitudes naturelles, Résistance, etc.) — sous-système distinct.

    Le calcul détaillé des niveaux de base des Compétences — sous-système distinct, simplement rappelé en section 4.4.

    Les modificateurs d'Attributs dus au type génétique — traités dans l'étape 2.

    Les modificateurs d'Attributs dus aux mutations — traités dans l'étape 3.

    Les modificateurs d'Attributs dus à l'âge — traités dans l'étape 4.

    La dépense de PC pour d'autres étapes — voir les MANUELs correspondants.

    L'interface utilisateur de répartition — le MANUEL décrit les règles, pas l'écran de saisie.

8. Passage au PLAN
8.1 Points bloquants

Aucun point bloquant identifié pour cette étape.
8.2 Dépendances externes

    Système d'Attributs (existant) : les 8 Attributs principaux sont déjà modélisés. L'étape 1 ne fait qu'initialiser leurs valeurs de base.

    Paramètre d'ambiance (à créer ou existant) : la valeur d'ambiance (Réaliste/Intermédiaire/Héroïque) doit être disponible pour calculer le budget de points d'Attributs et le score de Chance.

8.3 Termes à ajouter à VOCABULARY.md

    Point d'Attribut — sous-unité de progression des Attributs principaux (1 PC = 2 points d'Attributs). À distinguer du Point de Création (PC).

    Plafond temporaire — contrainte limitant un Attribut à 20 pendant l'étape 1, pouvant être dépassée ultérieurement.

8.4 Complexités majeures

    Coût progressif : la table des coûts (niveaux 8 à 20) introduit une non-linéarité. Le PLAN devra choisir entre stocker la valeur finale de l'Attribut (perte d'information sur le chemin) ou modéliser une fonction de conversion « valeur → coût cumulé » pour valider le budget.

    Interaction avec les étapes ultérieures : les modifications d'Attributs par le type génétique (étape 2) et l'âge (étape 4) doivent s'appliquer après les calculs de l'étape 1, sans invalider la validation du budget initial.

8.5 Ordre de priorité suggéré

Cette étape est la première de la création. Elle doit être traitée avant l'étape 2 (qui modifie les Attributs) et l'étape 4 (qui les réduit via l'âge). L'ordre naturel est :

    Étape 1 — Attributs (ce MANUEL)

    Étape 2 — Type génétique

    Étape 3 — Capacités spéciales

    Étape 4 — Expérience préliminaire

    Étape 5 — Avantages/Désavantages

Fin du MANUEL_CREATION_ETAPE1_ATTRIBUTS.md.