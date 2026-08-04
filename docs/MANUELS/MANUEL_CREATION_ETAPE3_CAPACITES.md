MANUEL_CREATION_ETAPE3_CAPACITES.md

    Statut : Rédaction 2026-08-04 — MANUEL de l'étape 3 « Capacités spéciales » du sous-système de création de personnage. Ce document décrit la logique d'acquisition des mutations et l'accès à la Force Polaris. Il s'insère dans le cadre défini par MANUEL_CREATION_CHAPEAU.md — le vocabulaire commun (PC, étape, archétype) y est défini et n'est pas redéfini ici.

    Principe fondateur : Ce document décrit quoi faire, jamais comment (pas de code, pas de SQL, pas de choix d'implémentation). Il doit être compréhensible et validable par un expert règles sans connaissance technique.

    Cycle de vie prévu : Rédaction → Validation Saar → Passage au PLAN → Archivage. Ce document ne sera pas modifié après le démarrage du PLAN.

1. Sources RAW
Fichier dépôt	Pages LdB	Contenu couvert
docs/REGLES/REGLECREATION.md	p.123-124	Introduction aux capacités spéciales, mutations, achat, tirage aléatoire
docs/REGLES/REGLECREATION.md	p.124-125	Table des mutations (D100, noms, coûts, types)
docs/REGLES/REGLECREATION.md	p.125-128	Description détaillée des mutations (effets mécaniques, fluff)
docs/REGLES/REGLECREATION.md	p.129	Polaris latent et non maîtrisé (règle avancée), coût en PC
docs/REGLES/REGLECREATION.md	p.129	Maîtrise de la Force Polaris, achat de pouvoirs

Sources connexes :

    MANUEL_CREATION_CHAPEAU.md — Budget PC, interactions entre étapes.

    MANUEL_CREATION_ETAPE5_AVANTAGES.md — Les mutations désavantageuses sont distinctes des Désavantages de l'étape 5.

    Le fonctionnement détaillé de la Force Polaris (pouvoirs, activation, libération accidentelle) est hors périmètre — il fera l'objet d'un MANUEL séparé (MANUEL_POLARIS.md).

2. Entités et attributs
2.1 Mutation

Une mutation est une altération génétique du personnage. Elle peut être :

    Avantageuse (coût en PC positif) : confère un bonus mécanique.

    Désavantageuse (coût en PC négatif, c'est-à-dire qu'elle rapporte des PC) : impose un malus.

    Neutre (coût 0 PC) : n'a pas d'effet mécanique notable mais identifie le personnage comme mutant.

Chaque mutation possède :

    Un nom.

    Une plage de D100 dans la table des mutations.

    Un type (Avantage, Désavantage, Neutre).

    Un coût en PC (positif si avantageuse, négatif si désavantageuse, 0 si neutre).

    Un effet mécanique résumé.

2.2 Capacité Polaris

La capacité Polaris représente l'aptitude du personnage à manipuler la Force Polaris. Elle se décline en plusieurs niveaux :

    Maîtrise de la Force Polaris : la compétence permettant de contrôler volontairement le Polaris. Le personnage peut acheter des pouvoirs.

    Polaris latent : la Force Polaris sommeille chez le personnage, qui l'ignore. Le MJ décide quand elle se manifeste.

    Polaris non maîtrisé : le personnage sait qu'il a ce pouvoir mais ne peut pas le contrôler. Il peut acheter jusqu'à 2 pouvoirs (déterminés aléatoirement), mais leur activation est toujours incontrôlée.

Ces capacités ont un coût en PC (voir section 4.3). Leur fonctionnement détaillé est hors périmètre de ce MANUEL.
3. Relations et dépendances
3.1 Avec les autres étapes de création

    Budget PC (chapeau) : les mutations désavantageuses rapportent des PC, qui s'ajoutent au budget global. Les mutations avantageuses coûtent des PC.

    Étape 5 (Avantages/Désavantages) : les mutations sont distinctes des Avantages/Désavantages. Un personnage peut avoir à la fois des mutations (étape 3) et des Avantages/Désavantages (étape 5). Les coûts et gains en PC se cumulent normalement.

    Étape 2 (Type génétique) : aucun lien direct. Un hybride peut aussi avoir des mutations (il est déjà un mutant).

3.2 Avec les autres sous-systèmes

    Force Polaris : l'étape 3 débloque l'accès au sous-système Polaris (maîtrise, pouvoirs, activation). Le fonctionnement détaillé est décrit dans un MANUEL séparé (MANUEL_POLARIS.md).

    Compétences : la Maîtrise de la Force Polaris est une compétence spéciale. Son amélioration éventuelle suit les règles normales (étape 4).

4. Règles logiques
4.1 Acquisition des mutations

Il existe trois façons d'obtenir des mutations. Elles peuvent être combinées librement.
4.1.1 Achat (choix libre)

Le joueur peut choisir librement une ou plusieurs mutations dans la table (section 4.2). Chaque mutation a un coût en PC :

    Mutation avantageuse : le joueur dépense le nombre de PC indiqué.

    Mutation désavantageuse : le joueur gagne le nombre de PC indiqué (ces PC s'ajoutent au budget global).

    Mutation neutre : coût 0 PC.

Le MJ a un droit de veto sur les mutations choisies, notamment celles qu'il juge inappropriées.
4.1.2 Tirage aléatoire (optionnel, gratuit)

Le joueur peut tenter un tirage aléatoire sans dépenser de PC. La procédure est la suivante :

    Lancer 1D20 pour déterminer le nombre de mutations :

        1-15 : 1 mutation

        16-19 : 2 mutations

        20 : 3 mutations

    Pour chaque mutation, lancer 1D100 dans la table des mutations (section 4.2). Le résultat détermine la mutation obtenue.

Important : le tirage aléatoire est totalement incontrôlé. Le joueur peut obtenir une mutation avantageuse, désavantageuse, ou neutre. Les mutations désavantageuses obtenues aléatoirement ne rapportent pas de PC (contrairement à celles achetées volontairement).
4.1.3 Suppression de mutation

Un joueur peut supprimer une mutation obtenue par tirage aléatoire si le résultat ne lui convient pas. Le coût est de 1 PC par mutation supprimée (ou +1 point de Désavantage en méthode 1 par archétype). La suppression d'une mutation avantageuse est gratuite.

Un joueur peut donc, en théorie, supprimer une mutation aléatoire désavantageuse (en payant 1 PC) et la remplacer par une mutation achetée (en payant son coût normal). Cette opération a un coût net en PC.
4.2 Table synthétique des mutations

    Note : les effets listés sont des résumés mécaniques. Seul le texte complet du LdB fait foi pour les détails et les cas particuliers. Les coûts indiqués sont ceux de la méthode 2 (achat volontaire).

D100	Mutation	Type	Coût PC	Effet mécanique
01-06	Adaptation extérieure	Avantage	3 PC	Permet de développer la Compétence Adaptation extérieure (CON/CON, −3). Le niveau donne le nombre d'heures passées à la Surface sans effet néfaste.
07-10	Amphibie	Avantage	2 PC	Le personnage peut respirer sous l'eau et à l'air libre indifféremment.
11-13	Androgyne	Neutre	0	Aucun effet mécanique. Le personnage ne présente pas de caractères sexuels distinctifs.
14-16	Asexué	Neutre	0	Aucun effet mécanique. Le personnage est dépourvu d'organes reproducteurs fonctionnels.
17-19	Autofécondation	Neutre	0	Le personnage peut se reproduire seul (utile si fécond et isolé).
20-23	Caractère génétique animal	Avantage	2 PC	Choisir ou lancer 1D4 : 1. Félin, 2. Canin, 3. Reptilien, 4. Simiesque. Bonus de +2 aux Tests liés aux traits de l'animal (agilité féline, flair canin…).
24-25	Contact corrosif	Avantage	3 PC	La peau du personnage est acide. Contact prolongé = 1D10 dégâts par Tour.
26-27	Contagion	Avantage	3 PC	Le personnage est porteur sain d'une maladie. Il ne subit pas ses effets mais peut la transmettre.
28-30	Corne	Avantage	1 PC	Une corne inflige 1D6+2 dégâts supplémentaires en combat au contact.
31-35	Crocs	Avantage	1 PC	Morsure = 1D6 dégâts. Si déjà une arme naturelle, bonus de +2.
36-40	Difformités légères	Désavantage	+1 PC	Malus de -2 en Présence et Compétences sociales.
41-43	Difformités importantes	Désavantage	+3 PC	Malus de -5 en Présence et Compétences sociales. Peut déclencher peur ou hostilité.
44-46	Empathie	Avantage	4 PC	Permet de ressentir les émotions d'une cible (Test d'Adaptation/Perception). Bonus variable aux Tests sociaux.
47-49	Excroissance osseuse rétractable	Avantage	3 PC	Lame osseuse rétractable. Dommages 1D10+2, peut surprendre (bonus d'initiative au premier round).
50-52	Griffes	Avantage	2 PC	Griffes rétractables. Dommages au contact +2. Bonus d'escalade.
53	Instabilité moléculaire	Avantage	4 PC	Le personnage peut altérer temporairement une partie de son corps (imiter un visage, changer de couleur…). Test d'Adaptation/Volonté.
54-56	Métamorphe	Avantage	4 PC	Le personnage peut prendre l'apparence d'un autre humanoïde (taille similaire). Test d'Adaptation/Volonté. Ne copie pas la voix.
57-58	Organe sensoriel manquant	Désavantage / Neutre	variable	Lancer 1D6 : 1. Papilles gustatives atrophiées (0 PC). 2. Nez atrophié (+1 PC, malus odorat). 3. Toucher atrophié (+1 PC). 4. Oreille manquante (+2 PC, malus Perception auditive). 5. Œil manquant (+3 PC, malus Perception visuelle). 6. Relancer.
59-60	Organe sensoriel amélioré	Avantage / Neutre	variable	Lancer 1D6 : 1. Goût amélioré (0 PC). 2. Odorat amélioré (1 PC, bonus +2 olfactif). 3. Toucher amélioré (1 PC). 4. Oreille supplémentaire (2 PC, bonus +2 Perception auditive). 5. Œil supplémentaire (2 PC, bonus +2 Perception visuelle, champ de vision élargi). 6. Relancer.
61	Parasite(s)	Avantage	1 PC	Le personnage héberge des organismes symbiotiques. Ils peuvent offrir un bonus (ex : +2 contre maladies) ou un malus mineur selon l'espèce.
62-66	Peau renforcée	Avantage	2 PC	Bonus de +2 au Blindage naturel (cumulable avec armure).
67	Purulence	Désavantage	+2 PC	La peau suinte en permanence. Malus de -3 en Présence. Risque d'infection des plaies.
68-70	Queue	Avantage	1 PC	Queue préhensile (bonus +2 en Escalade, peut saisir de petits objets) ou non (simple équilibre).
71	Radiation	Avantage	3 PC	Le personnage émet des radiations (faibles). Il peut les intensifier pour infliger 1D10 dégâts par Tour dans un rayon de 2 m.
72-75	Régénération	Avantage	2 PC	Récupération de 1 point de vie par heure (ou 1D6 par jour). Ne régénère pas les membres perdus.
76-80	Résistance naturelle	Avantage	1 PC	Choisir ou lancer 1D6 : 1. Feu (+2 contre feu/chaleur). 2. Froid (+2 contre froid). 3. Drogues (+2 contre drogues/toxines). 4. Maladies (+2 contre maladies). 5. Poisons (+2 contre poisons). 6. Radiations (+2 contre radiations).
81-85	Sixième sens	Avantage	1 PC	Bonus de +2 aux Tests de Perception pour détecter des dangers immédiats ou des présences cachées.
86-88	Sonar	Avantage	3 PC	Le personnage émet et perçoit des ondes sonores. Équivalent à un sonar biologique. Ne fonctionne pas à l'air libre.
89	Squelette renforcé	Avantage	3 PC	Bonus de +3 en Constitution pour résister aux fractures et aux dégâts de Choc.
90-92	Symbiote(s)	Avantage	3 PC	Le personnage héberge une créature symbiotique intelligente (ver parasite, colonie de micro-organismes…). Confère des capacités variables (vision nocturne, résistance, etc.) mais peut avoir des exigences propres.
93-95	Tentacule rétractable	Avantage	1 PC	Un tentacule préhensile rétractable. Peut saisir, étrangler (dégâts progressifs), ou donner un bonus de +2 en Lutte.
96-00	Vision nocturne	Avantage	3 PC	Le personnage voit dans l'obscurité totale (même sous l'eau). Aucune pénalité liée à l'absence de lumière.
4.3 Accès à la Force Polaris
4.3.1 Maîtrise de la Force Polaris

Le joueur peut acheter la Maîtrise de la Force Polaris pour son personnage. Cela lui donne accès à la Compétence spéciale Maîtrise de la Force Polaris et lui permet d'acheter des pouvoirs.

    Coût en PC : 3 PC (à confirmer selon le RAW — le texte fourni mentionne le coût des pouvoirs mais pas explicitement celui de la maîtrise elle-même. Le chapeau des archétypes « Phénomène » parle de 7 PC pour « mutations choisies, ou maîtrise de la Force Polaris avec un pouvoir gratuit choisi et deux pouvoirs supplémentaires déterminés aléatoirement » — le détail exact est à extraire du chapitre complet sur le Polaris.)

    Pouvoirs : chaque pouvoir a un coût en PC (non détaillé dans l'extrait fourni). Le fonctionnement des pouvoirs est décrit dans MANUEL_POLARIS.md.

4.3.2 Polaris latent

Coût : 3 PC.

Le personnage possède la Force Polaris à l'état latent, sans le savoir. Les conditions de libération sont entièrement à la discrétion du MJ (généralement un traumatisme majeur). Le personnage ne peut pas déclencher cette libération volontairement.

En termes de jeu, cela signifie que le joueur ne peut pas utiliser de pouvoirs Polaris tant que le MJ n'a pas décidé de la libération. Cela peut n'arriver jamais, ou se manifester de manière subtile et indirecte.

Restriction : le MJ ne devrait pas autoriser plus d'un Polaris latent parmi les personnages du groupe.
4.3.3 Polaris non maîtrisé

Coût : 3 PC.

Le personnage sait qu'il possède la Force Polaris mais ne la contrôle pas. Il peut acheter jusqu'à 2 pouvoirs (déterminés par un tirage aléatoire dans la table de libération accidentelle). Cependant, il ne possède pas la Compétence Maîtrise de la Force Polaris — l'activation des pouvoirs est toujours incontrôlée et peut se révéler dangereuse.

Les règles de libération accidentelle sont décrites dans MANUEL_POLARIS.md.
5. Règles optionnelles
5.1 Mutations aléatoires — RETENUE

Source : REGLECREATION.md p.123, encadré optionnel

Cette règle est décrite en section 4.1.2. Elle est retenue comme mode d'acquisition alternatif gratuit.
5.2 Polaris latent / non maîtrisé — RETENU avec prudence

Source : REGLECREATION.md p.129, règle avancée

Ces options sont retenues mais avec la mise en garde du RAW : elles ne doivent pas être choisies à la légère. Le PLAN pourra prévoir un avertissement dans l'interface, voire une option GM pour désactiver ces choix.
5.3 Mutants et société — NON RETENU pour le moment

Source : REGLECREATION.md p.123, encadré optionnel

Cette règle optionnelle impose des malus sociaux (Présence, Compétences sociales) aux mutants selon la communauté visitée. Non retenue pour la version actuelle — elle est trop dépendante du contexte narratif et du bon vouloir du MJ. Pourra être intégrée ultérieurement comme règle de campagne.
6. Questions ouvertes et ambiguïtés
6.1 Coût exact de la Maîtrise de la Force Polaris

L'extrait RAW fourni ne précise pas le coût en PC de la maîtrise elle-même (seulement celui du Polaris latent/non maîtrisé : 3 PC). Le chapitre complet sur le Polaris doit être consulté. Le PLAN devra confirmer ce coût avant l'implémentation.
6.2 Interaction entre Polaris latent et mutations

Un personnage peut-il avoir à la fois un Polaris latent et des mutations ? Le RAW ne l'interdit pas explicitement. Le PLAN devra statuer sur d'éventuelles restrictions.
6.3 Tirage aléatoire et budget PC

Le RAW indique que les mutations désavantageuses obtenues aléatoirement ne rapportent pas de PC. Mais si le joueur les supprime (1 PC) puis en achète une avantageuse, le coût net peut être important. Le PLAN devra s'assurer que l'interface gère correctement ces flux de PC.
7. Hors périmètre

    Le fonctionnement détaillé de la Force Polaris (pouvoirs, activation, libération accidentelle, effets) — voir MANUEL_POLARIS.md (à créer).

    La liste des pouvoirs Polaris et leurs coûts — idem.

    Le chapitre complet sur les mutations au-delà des effets mécaniques résumés dans le tableau — le texte descriptif complet est dans le LdB.

    L'évolution des mutations après la création (apparition de nouvelles mutations en cours de campagne) — hors périmètre de la création.

8. Passage au PLAN
8.1 Points bloquants

    Coût de la Maîtrise de la Force Polaris à confirmer (§6.1).

8.2 Dépendances externes

    Système Polaris (MANUEL_POLARIS.md) : l'étape 3 débloque l'accès mais le fonctionnement détaillé dépend d'un MANUEL et d'un PLAN séparés.

    Système de Compétences : la Compétence Maîtrise de la Force Polaris et la Compétence Adaptation extérieure doivent être intégrées à la liste des compétences spéciales.

8.3 Termes à ajouter à VOCABULARY.md

    Mutation — déjà défini dans le chapeau.

    Mutation avantageuse / désavantageuse / neutre — classification.

    Tirage aléatoire de mutations — procédure gratuite (1D20 puis 1D100).

    Suppression de mutation — coût 1 PC.

    Force Polaris — capacité à manipuler le Polaris.

    Maîtrise de la Force Polaris — compétence spéciale.

    Polaris latent / non maîtrisé — états particuliers de la capacité Polaris.

8.4 Complexités majeures

    Gestion des PC en flux : l'étape 3 peut à la fois dépenser et rapporter des PC, avec des interactions entre achat, tirage aléatoire gratuit, et suppression payante. Le PLAN devra modéliser un budget dynamique qui se met à jour en temps réel.

    Table des mutations étendue : la table synthétique contient environ 45 entrées. Certaines ont des sous-tables (organe sensoriel, résistance naturelle…). Le PLAN devra décider si ces données sont stockées en base ou dans un fichier de constantes.

8.5 Ordre de priorité suggéré

    Étape 1 — Attributs (réalisé)

    Étape 2 — Type génétique (réalisé)

    Étape 3 — Capacités spéciales (ce MANUEL)

    Étape 4 — Expérience préliminaire

    Étape 5 — Avantages/Désavantages

L'étape 3 peut être développée indépendamment des étapes 4 et 5, à condition que le budget PC soit géré de manière centralisée (cf. chapeau).

Fin du MANUEL_CREATION_ETAPE3_CAPACITES.md.