--- ETAPE 1 - CARACTERISTIQUE DE BASE ---
1. COMPOSANTS UI — INVENTAIRE EXHAUSTIF (Interface Joueur)

Pour cette Étape 1, le Wizard de création affichera les éléments d'interface suivants :

    Affichage du Contexte (Lecture seule, hérité de la config GM) :

        Badge d'ambiance de jeu : REALISTE, INTERMEDIAIRE ou HEROIQUE (ou PERSONNALISE).
        Score de Chance calculé automatiquement : badge affichant 11, 13 ou 15.

    Sélecteur de configuration du personnage :

        RadioGroup (Optionnel, si activé par le GM) : Genre (MASCULIN / FEMININ).

    Zone de répartition des Attributs (8 blocs identiques) :

        Chaque bloc contient :

            Un label (FOR, CON, COO, ADA, PER, INT, VOL, PRE).
            Un affichage de la valeur actuelle (commence à 7, ou 5 pour la FOR si genre Féminin).
            Deux boutons d'ajustement (- / +).

    Compteurs globaux de validation (Dynamiques) :

        VisualGauge / Texte : Points de répartition restants (Pool initial basé sur l'ambiance moins le coût cumulé actuel).
        VisualGauge / Texte (Conditionnel) : Points bonus féminins restants (0/2 à distribuer en COO ou PRE).

    Action :

        Bouton Suivant : Désactivé tant que les pools de points ne sont pas exactement à 0 et que les contraintes ne sont pas respectées.

2. PLAN EXACT D'IMPLÉMENTATION
A. Fichiers touchés (Périmètre)

    shared/rules/polarisCreationFormulas.js (Nouveau fichier de règles pures côté partagé).
    client/src/components/creation/Step1Attributes.jsx (Nouveau composant d'interface).
    server/src/services/creationService.js (Nouveau service ou extension pour valider et persister).

B. Ce qui change (Écritures en Base de Données via Knex)

Lors de la validation de l'étape, le code va insérer ou mettre à jour :

    char_sheet : Initialisation de la ligne, persistance de la valeur chc (Chance) déterminée par l'ambiance.
    char_attributes : Insertion de 8 lignes (une par attr_id).

        La valeur finale choisie par le joueur est stockée dans base_level.
        pc_modifier est initialisé à 0.

C. Ce qui ne change pas

    Les tables char_identity, char_archetype et char_skills ne sont pas altérées lors de cette étape.
    Aucun calcul d'attribut secondaire (Initiative, Seuils de blessure) n'est figé en base de données.

3. RÈGLES DE GESTION & ALGORITHMES (Business Logic)
Table de coût cumulatif (Lookup Table)

Pour calculer le coût d'un attribut à partir de son niveau de départ (base_initiale = 7, ou 5 pour la Force d'une femme) :
JavaScript

const COST_LOOKUP = {
  5: 0, 6: 0, // Uniquement pour la baisse initiale de FOR du personnage féminin
  7: 0,  8: 1,  9: 2,  10: 3,  11: 4,  12: 5,  13: 6,  14: 7,  15: 8,
  16: 10, // +2
  17: 12, // +2
  18: 14, // +2
  19: 17, // +3
  20: 20  // +3
};
// Note user : je suis presque sur que cette table existe déjà en SQL. Eviter de hardcoder des tables.

Formule du coût pour un attribut donné : cout = COST_LOOKUP[valeur_cible] - COST_LOOKUP[base_initiale]
Règles de validation strictes (Guard Clauses avant soumission)

    Pool standard : La somme des coûts de chaque attribut doit être strictement égale au pool d'ambiance configuré (30, 38, 46 ou Custom).
    Pool féminin (si actif) : Si genre === 'FEMININ', les points investis en COO et PRE provenant du pool bonus doivent être exactement égaux à 2, et la valeur de départ de FOR avant investissement standard doit avoir été initialisée à 5.
    Bornes : Aucun attribut ne peut être inférieur à sa base initiale, ni supérieur à 20.

SCÉNARIO DE TEST ATTENDU (Validation fonctionnelle)Entrée : Campagne en ambiance INTERMEDIAIRE (38 points d'attributs, Chance 13). Option personnage féminin activée. Le joueur choisit un personnage Féminin.Action : * Vérifier que l'attribut FOR commence bien à 5.Augmenter la FOR de 5 à 7 (Coût calculé : $0 - 0 = 0$ points, car les paliers en dessous de 7 ne coûtent rien selon la règle).Augmenter la CON de 7 à 16 (Coût calculé : 10 points).Distribuer les 2 points bonus féminins : +1 en COO (valeur 8) et +1 en PRE (valeur 8) sans que cela ne réduise le pool de 38 points.Résultat attendu : L'interface affiche Points restants : 28 ($38 - 10$). Le bouton "Suivant" reste bloqué tant que les 28 points restants ne sont pas entièrement dépensés. À la validation, la base de données reçoit la Chance à 13 et les 8 lignes d'attributs avec leurs base_level respectifs.
	
--- ETAPE 2 - TYPE GENETIQUE --- 
e.1. COMPOSANTS UI — INVENTAIRE EXHAUSTIF (Interface Joueur)Pour cette Étape 2, le Wizard de création affichera les éléments d'interface suivants :Affichage du Contexte (Hérité de l'Étape 1 & Config GM) :Points de Création (PC) globaux restants.Rappel des attributs actuels (lecture seule ou mini-tableau).Sélecteur de Type Génétique (Composant principal) :Une grille de 4 options (Cartes ou RadioButtons) : Humain Normal, Hybride Naturel, Géno-Hybride, Techno-Hybride.Chaque option affiche clairement son coût en PC (ex: 0 ou 5 PC).Panneau de Détails Dynamique (Conditionnel selon la sélection) :Liste des Modificateurs d'Attributs (ex: FOR +1, INT -2) en vert/rouge.Compétences innées acquises (ex: Compétence "Hybride" à +3).Capacités spéciales (ex: Respiration aquatique).Action :Bouton Suivant : Désactivé si le joueur n'a pas assez de PC pour payer le type génétique sélectionné.2. PLAN EXACT D'IMPLÉMENTATIONA. Fichiers touchés (Périmètre)shared/rules/polarisGenotypeFormulas.js (Nouveau fichier : dictionnaire de données et validation).client/src/components/creation/Step2Genotype.jsx (Nouveau composant UI).server/src/services/creationService.js (Extension de l'existant pour gérer l'étape 2).B. Ce qui change (Évolution de l'état et DB)Lors de la validation de l'étape, le payload va ordonner les mutations suivantes :char_archetype : Mise à jour de la colonne genotype_id avec la valeur choisie (ex: hybride_naturel).Pool de PC : Déduction du coût du génotype du pool global du personnage (état temporaire de création).char_attributes : Les modificateurs du génotype NE SONT PAS ajoutés au base_level de l'Étape 1. Conformément à la logique Enclume existante, ils seront enregistrés dans la colonne pc_modifier ou gérés dynamiquement à la lecture. Recommandation : enregistrer le delta dans pc_modifier pour garder la trace de la ligne de base intacte.char_skills : Si le génotype octroie une compétence (ex: Hybride +3), création d'une ligne avec skill_id, mastery: 3, et is_learned: true.C. Ce qui ne change pasLa ligne base_level des attributs issue de l'Étape 1 reste intacte en base de données.Les attributs secondaires (Initiative, Seuils) ne sont toujours pas calculés ou persistés.3. RÈGLES DE GESTION & ALGORITHMES (Business Logic)Dictionnaire des Génotypes (Lookup Table)Le moteur de règles devra exposer un objet strict définissant chaque génotype :Identifiant (humain_normal, hybride_naturel, etc.)Coût en PC (0 ou 5)Modificateurs d'Attributs (Map de deltas : { FOR: +1, INT: -2 })Compétences bonus (Array d'objets : [{ skill_id: 'hybride', mastery: 3 }])Règles de validation strictes (Guard Clauses)Solvabilité : Le joueur doit posséder un nombre de PC $\ge$ au coût du génotype. Sinon, le choix est bloqué.Dépassement de Limites (Règle Spéciale) : Contrairement à l'Étape 1, les modificateurs génétiques ont le droit de faire passer un attribut au-dessus de 20 ou en dessous de 7 (jusqu'à un minimum absolu déterminé par le LdB, souvent 1). Le validateur de cette étape doit accepter ces dépassements.Disponibilité (Option GM) : Le Wizard doit filtrer les génotypes si le GM a restreint la liste (allowed_genotypes dans le CampaignContext).4. SCÉNARIO DE TEST ATTENDUEntrée : Personnage issu de l'Étape 1 avec 20 PC disponibles, FOR à 10, INT à 10.Action :Le joueur sélectionne "Hybride Naturel".L'UI affiche le coût de 5 PC et les modificateurs prévus.Le joueur clique sur "Suivant".Résultat attendu :Le validateur accepte la transaction.La base de données inscrit genotype_id = 'hybride_naturel' dans char_archetype.La compétence "Hybride" à +3 est insérée dans char_skills.L'affichage reflète 15 PC restants pour l'Étape 3.

