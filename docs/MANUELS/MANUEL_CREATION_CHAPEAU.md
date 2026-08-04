.# MANUEL_CREATION_CHAPEAU.md

    Statut : Rédaction 2026-08-04 — document chapeau du sous-système « Création de personnage ». Ce MANUEL décrit l'articulation globale des 5 étapes de création, le budget de Points de Création (PC), et le vocabulaire commun. Il ne contient aucune règle détaillée — chaque étape fait l'objet d'un MANUEL séparé.

    Principe fondateur : Ce document décrit quoi faire, jamais comment (pas de code, pas de SQL, pas de choix d'implémentation). Il doit être compréhensible et validable par un expert règles sans connaissance technique.

    Cycle de vie prévu : Rédaction → Validation Saar → Passage au PLAN → Archivage. Ce document ne sera pas modifié après le démarrage du PLAN. Toute évolution ultérieure fera l'objet d'un nouveau MANUEL.

1. Sources RAW
Fichier dépôt	Pages LdB	Contenu couvert
docs/REGLES/REGLECREATION.md	p.117	Introduction, étapes de création, Points de création
docs/REGLES/REGLECREATION.md	p.117	Méthode 1 : choisir un archétype (8 archétypes)
docs/REGLES/REGLECREATION.md	p.117-118	Méthode 2 : répartition libre des PC (budget, contraintes)

Sources connexes (référencées mais non incluses dans ce MANUEL) :

    docs/REGLES/REGLECREATION.md p.118-119 — Étape 1 : Capacités de base (→ MANUEL_CREATION_ETAPE1_ATTRIBUTS.md)

    docs/REGLES/REGLECREATION.md p.119-123 — Étape 2 : Type génétique (→ MANUEL_CREATION_ETAPE2_GENETIQUE.md)

    docs/REGLES/REGLECREATION.md p.123-128 — Étape 3 : Capacités spéciales (→ MANUEL_CREATION_ETAPE3_CAPACITES.md)

    docs/REGLES/REGLECREATION.md p.129-133 — Étape 4 : Expérience préliminaire (→ MANUEL_CREATION_ETAPE4_EXPERIENCE.md)

    docs/REGLES/REGLECREATION.md p.133-136 — Étape 5 : Avantages et Désavantages (→ MANUEL_CREATION_ETAPE5_AVANTAGES.md)

2. Entités et attributs
2.1 Point de Création (PC)

Le Point de Création (PC) est l'unité de budget commune à toutes les étapes de création. Il représente la valeur d'une amélioration, d'une capacité, ou d'un avantage.

    Budget de départ : 20 PC (méthode 2 — répartition libre).

    Gain de PC : le joueur peut gagner des PC supplémentaires en dotant son personnage de Désavantages (étape 5) ou de mutations désavantageuses (étape 3). Le total des PC gagnés par les Désavantages ne devrait pas dépasser 7 ou 8 PC (10 étant un maximum absolu).

    Dépense de PC : les PC sont dépensés à chaque étape pour améliorer les Attributs, choisir un type génétique hybride, acheter des mutations, acquérir de l'expérience, ou acheter des Avantages.

    Non reportables : les PC non dépensés à une étape restent disponibles pour les étapes suivantes — le budget est global, pas segmenté.

2.2 Étape de création

Une étape de création est une phase séquentielle de construction du personnage. Les 5 étapes sont :
Ordre	Étape	MANUEL associé	Résumé
1	Capacités de base	MANUEL_CREATION_ETAPE1_ATTRIBUTS.md	Attributs principaux (valeur de base, amélioration), Chance
2	Type génétique	MANUEL_CREATION_ETAPE2_GENETIQUE.md	Humain normal ou hybride (naturel, géno, techno), modificateurs d'Attributs
3	Capacités spéciales	MANUEL_CREATION_ETAPE3_CAPACITES.md	Mutations (choisies ou aléatoires), Polaris latent/non maîtrisé
4	Expérience préliminaire	MANUEL_CREATION_ETAPE4_EXPERIENCE.md	Origines, formations, études, Professions, Compétences, économies, âge
5	Avantages et Désavantages	MANUEL_CREATION_ETAPE5_AVANTAGES.md	Avantages, Désavantages, derniers détails

Règles :

    Les étapes sont exécutées dans l'ordre (1 → 2 → 3 → 4 → 5).

    Une étape ultérieure peut modifier le résultat d'une étape antérieure (ex : le type génétique modifie les Attributs déjà calculés).

    Le joueur peut à tout moment revenir en arrière et ajuster ses choix, tant que la création n'est pas finalisée. La création est un processus itératif, pas un pipeline à sens unique.

2.3 Archétype

Un archétype est un préréglage de répartition des PC, proposé par le LdB pour simplifier la création (méthode 1). Chaque archétype définit combien de PC sont alloués à chaque étape.

Les 8 archétypes sont :
Archétype	Capacités (1)	Génétique (2)	Spéciales (3)	Expérience (4)	Avantages (5)	Désavantages (5)	PC totaux
Personnage par défaut	8	0	0	12	0	0	20
Jeune premier	7	0	3	7	3	0	20
Jeune héritier	5	0	0	5	10	0	20
Hybride	5	5	0	10	0	0	20
Phénomène	5	0	7	12	0	+4	20
Survivant	7	0	3	12	3	+5	20
Vétéran	3	0	0	14	3	0	20
Vieux loup de mer	4	0	0	17	4	+5	20

Note : les Désavantages rapportent des PC (indiqués avec un +). Le budget total après application des Désavantages peut dépasser 20 PC — les PC excédentaires sont réinvestis dans les autres étapes selon la répartition indiquée.

Règle importante : un archétype n'est qu'une répartition automatique des PC. Les règles appliquées à chaque étape sont exactement les mêmes que pour la méthode 2 (répartition libre). Les archétypes ne créent pas de règles spécifiques — ils sont une aide à la décision.
3. Relations et dépendances
3.1 Entre les étapes

Le diagramme ci-dessous résume les interactions :
text

Étape 1 (Attributs) ──→ valeurs de base
      ↑                        │
      │                        ↓
      │               Étape 2 (Génétique) ──→ modifie Attributs, ajoute Avantages/Désavantages
      │                        │
      │                        ↓
      │               Étape 3 (Capacités)  ──→ peut rapporter des PC (mutations désavantageuses)
      │                        │
      │                        ↓
      │               Étape 4 (Expérience) ──→ peut exiger un type génétique spécifique
      │                        │
      │                        ↓
      └────────────── Étape 5 (Avantages/Désavantages) ──→ peut rapporter des PC

    Étape 2 → Étape 1 : le type génétique hybride applique des modificateurs aux Attributs calculés à l'étape 1. Ces modifications peuvent faire dépasser le plafond temporaire de 20.

    Étape 3 → Budget : les mutations désavantageuses rapportent des PC. Ces PC s'ajoutent au budget global et peuvent être dépensés dans n'importe quelle étape.

    Étape 4 → Étape 2 : certaines Professions exigent un type génétique spécifique (ex : Techno-hybride exige d'être passé par Soldat/Milicien et d'avoir suivi la Profession Techno-hybride). Le joueur doit anticiper cette exigence dès l'étape 2.

    Étape 5 → Budget : les Désavantages rapportent des PC.

    Étape 4 → Étape 1 : les effets de l'âge (fin de l'étape 4) modifient les Attributs.

3.2 Avec les autres sous-systèmes

    Attributs secondaires : calculés à partir des Attributs principaux (étape 1) une fois toutes les modifications appliquées. Le calcul générique (Aptitude naturelle, etc.) n'est pas propre à la création — il est documenté ailleurs et référencé ici comme dépendance.

    Compétences : les niveaux de Compétence sont calculés à partir des Attributs (niveau de base) puis améliorés par l'expérience préliminaire (étape 4). Le système de Compétences est un sous-système distinct.

    Professions : l'étape 4 référence les Professions disponibles. La liste et les détails de chaque Profession sont hors périmètre de ce MANUEL — ils feront l'objet d'un MANUEL ou d'une source de données séparée.

    Équipement : l'étape 4 permet l'achat de matériel avec les économies. Le système d'équipement est un sous-système distinct.

    Force Polaris : l'étape 3 peut débloquer l'accès à la Force Polaris. Le système Polaris est un sous-système distinct.

4. Règles logiques

    Note : cette section est volontairement réduite. Le chapeau ne décrit que les règles transverses aux 5 étapes. Chaque étape a sa propre logique, décrite dans son MANUEL dédié.

4.1 Budget global (méthode 2 — Répartition libre)

Règle : le joueur dispose de 20 PC au départ. Il peut les répartir librement entre les 5 étapes.

Gain de PC supplémentaires :

    Par les mutations désavantageuses (étape 3) : chaque mutation désavantageuse rapporte le nombre de PC indiqué dans sa description.

    Par les Désavantages (étape 5) : chaque Désavantage rapporte le nombre de PC indiqué dans sa description.

Contraintes :

    Aucune limite stricte de dépense par étape, mais il n'est pas conseillé de dépenser plus de 15 à 20 PC dans une seule étape.

    Le total des PC gagnés par les Désavantages ne devrait pas dépasser 7 ou 8 PC (10 maximum absolu).

Report de PC : les PC non dépensés à une étape restent disponibles. Le joueur peut les conserver jusqu'à la fin de la création.
4.2 Ordre des étapes

Règle : les étapes sont exécutées dans l'ordre 1→2→3→4→5. Une étape ultérieure peut modifier les résultats d'une étape antérieure.

Itération : le joueur peut revenir en arrière à tout moment pour ajuster ses choix. La création est un processus itératif, pas un pipeline rigide. Exemple : si le joueur découvre à l'étape 4 qu'il n'a pas assez de PC pour l'expérience souhaitée, il peut revenir à l'étape 1 et réduire ses Attributs pour libérer des PC.

Finalisation : une fois que le joueur a terminé ses choix et que le total des PC dépensés correspond au budget (20 + gains), la création est finalisée. Les Attributs secondaires et les niveaux de base des Compétences peuvent alors être calculés.
4.3 Méthode 1 — Archétypes

Règle : le joueur choisit l'un des 8 archétypes. L'archétype détermine automatiquement la répartition des PC entre les étapes. Chaque étape est ensuite résolue normalement, avec le nombre de PC indiqué par l'archétype.

Les archétypes ne sont pas des règles spécifiques. Ce sont des préréglages de répartition. Toutes les règles décrites dans les MANUELs d'étapes s'appliquent de la même façon, quel que soit l'archétype choisi.

Exemple : un joueur choisit l'archétype « Survivant ». Il dispose de 7 PC pour l'étape 1, 0 pour l'étape 2, 3 pour l'étape 3, 12 pour l'étape 4, 3 pour l'étape 5, et gagne 5 PC via les Désavantages (étape 5). Il applique ensuite chaque étape normalement, avec ces budgets.
4.4 Interactions entre étapes — synthèse
Interaction	Sens	Description
Génétique → Attributs	Étape 2 modifie étape 1	Chaque type génétique applique des modificateurs aux Attributs principaux déjà calculés. Ces modifications peuvent faire dépasser 20.
Capacités → Budget	Étape 3 ajoute des PC	Les mutations désavantageuses rapportent des PC au budget global.
Expérience → Génétique	Étape 4 exige étape 2	Certaines Professions requièrent un type génétique spécifique.
Expérience → Attributs	Étape 4 modifie étape 1	Les effets de l'âge réduisent les Attributs.
Avantages → Budget	Étape 5 ajoute des PC	Les Désavantages rapportent des PC au budget global.
5. Règles optionnelles
5.1 Personnage féminin — NON RETENU pour le moment

Source : REGLECREATION.md p.118, encadré optionnel

Cette règle optionnelle applique des modificateurs d'Attributs différents selon le sexe du personnage (Force −2, bonus en Coordination ou Présence). Non retenue — la création est unisexe par défaut. Le sexe du personnage est un choix narratif sans impact mécanique, sauf pour la condition de fécondité (voir règles de campagne, hors périmètre).
5.2 Ambiance de jeu (Réaliste/Intermédiaire/Héroïque) — RETENUE

Source : REGLECREATION.md p.118

L'ambiance choisie par le MJ détermine :

    Le nombre de points d'Attributs de base (Réaliste : 30, Intermédiaire : 38, Héroïque : 46).

    Le score de Chance de départ (Réaliste : 11, Intermédiaire : 13, Héroïque : 15).

Ce paramètre est global à la campagne et s'applique à tous les personnages. Il est traité dans l'étape 1.
5.3 Autres règles optionnelles

Les règles optionnelles spécifiques à chaque étape sont traitées dans les MANUELs correspondants :

    Mutations aléatoires → Étape 3

    Niveau maximum des Compétences → Étape 4

    Compétences avec conditions requises → Étape 4

    Personnages expérimentés → Étape 4

    Personnages très jeunes → Étape 4

    Mutants et société → Étape 3

6. Questions ouvertes et ambiguïtés
6.1 Les PC non dépensés sont-ils perdus ?

Le RAW ne précise pas explicitement si les PC non dépensés à la fin de la création sont perdus ou convertis en quelque chose. L'usage suggère qu'ils sont simplement perdus — la création est un budget à dépenser, pas à épargner. Le PLAN devra trancher : faut-il prévoir un avertissement dans l'interface si des PC restent non dépensés ?
6.2 Limite de dépense par étape

Le RAW conseille de ne pas dépasser 15-20 PC par étape, mais ne l'interdit pas formellement. Le PLAN devra décider si cette limite est une règle stricte (blocage applicatif) ou un conseil (avertissement non bloquant).
6.3 Création itérative

Le RAW implique que le joueur peut revenir en arrière (exemple de Carian qui ajuste ses choix). Le PLAN devra décider comment modéliser cela dans l'interface : création linéaire avec possibilité de revenir ? Ou toutes les étapes accessibles en parallèle avec un résumé du budget restant ?
7. Hors périmètre

Ce MANUEL ne couvre pas :

    Le détail de chaque étape — voir les 5 MANUELs associés.

    Le calcul des Attributs secondaires — sous-système générique, référencé mais non décrit ici.

    Le calcul des niveaux de base des Compétences — idem.

    La liste complète des Professions — fera l'objet d'une source de données séparée.

    La liste complète des Avantages/Désavantages — voir MANUEL_CREATION_ETAPE5_AVANTAGES.md pour le système et la table synthétique.

    La liste complète des Mutations — voir MANUEL_CREATION_ETAPE3_CAPACITES.md pour le système et la table synthétique.

    Le système de Force Polaris — sous-système distinct, simplement débloqué par l'étape 3.

    Le système d'Équipement — sous-système distinct, simplement utilisé par l'étape 4.

    L'interface utilisateur de création — le MANUEL décrit les règles, pas l'écran de création.

    L'évolution du personnage après la création (montée de niveau, apprentissage, etc.) — hors périmètre de la création.

8. Passage au PLAN
8.1 Points bloquants

Aucun point bloquant identifié au niveau du chapeau. Les blocages éventuels seront identifiés dans les MANUELs d'étapes.
8.2 Dépendances externes

    Système d'Attributs (existant) : les Attributs principaux et secondaires sont déjà modélisés dans le projet.

    Système de Compétences (existant ou à créer) : les Compétences sont référencées par l'étape 4.

    Système de Professions (à créer) : la liste des Professions et leurs caractéristiques devront être disponibles pour l'étape 4.

    Système Polaris (à créer) : débloqué par l'étape 3.

    Système d'Équipement (existant) : utilisé par l'étape 4.

8.3 Termes à ajouter à VOCABULARY.md

    Point de Création (PC) — unité de budget de création.

    Étape de création — phase séquentielle de construction du personnage.

    Archétype — préréglage de répartition des PC.

    Ambiance de jeu — paramètre global (Réaliste/Intermédiaire/Héroïque).

    Type génétique — humain normal, hybride naturel, géno-hybride, techno-hybride.

    Mutation — capacité spéciale, avantageuse ou désavantageuse.

    Expérience préliminaire — années de carrière avant le début du jeu.

    Profession — métier exercé pendant l'expérience préliminaire.

    Avantage / Désavantage — trait positif ou négatif permanent.

8.4 Complexités majeures

    Gestion des interactions entre étapes : l'étape 2 modifie l'étape 1, l'étape 4 peut exiger l'étape 2, l'étape 3 et 5 modifient le budget. Le PLAN devra concevoir un flux de données qui permet ces rétroactions sans boucles infinies.

    Création itérative vs linéaire : l'interface devra permettre au joueur de revenir en arrière tout en maintenant la cohérence des choix déjà faits.

8.5 Ordre de priorité suggéré

Cet ordre suit la logique de construction du personnage :

    Fondations (budget PC, cadre des étapes) — ce MANUEL

    Étape 1 — Attributs

    Étape 2 — Type génétique

    Étape 3 — Capacités spéciales

    Étape 4 — Expérience préliminaire

    Étape 5 — Avantages et Désavantages

L'étape 4 est la plus complexe et dépend de l'existence d'un référentiel de Professions. Le PLAN pourra commencer par les étapes 1-2-3-5 en parallèle de la préparation du référentiel Professions.

Fin du MANUEL_CREATION_CHAPEAU.md.