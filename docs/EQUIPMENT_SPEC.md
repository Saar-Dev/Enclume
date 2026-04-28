📖 EQUIPMENT_SPEC.md — Architecture & Mécaniques (Module Équipement)

    Domaine : Fiche de Personnage Polaris V1 — Module Équipement, Armure et Encombrement
    Statut : Spécification Technique (Draft V1)
    Dépendances : CHARACTER_FLUX.md, schemaSQL.md

1. Modèle de Données (Polymorphisme & Séparation des préoccupations)

Pour éviter de saturer la RAM du client avec des tables SQL creuses de 30 colonnes, le domaine Équipement sépare strictement le Catalogue (la théorie) de l'Inventaire (l'instance).
1.1. Base de Référence (ref_equipment)

La base SQL reste plate pour faciliter l'import CSV, mais le backend (ou l'ORM) doit la distribuer sous forme d'interfaces typées :

    Tronc Commun (BaseEquipment) : id, family, category, name, description, price, weight, tech_level, manufacturer.

    Extension Protection (ArmorEquipment) :

        protection_phys (Int) : Valeur d'armure de base.

        protection_choc (Int) : Valeur d'absorption du choc (0 si armure souple).

        locations (String) : Chaîne de caractères (ex: T/C/B/JD). Nécessite une fonction de parsing (split('/')) pour générer un tableau de tags ['Tete', 'Corps', 'Bras', 'JambeD'].

        malus_category (String) : S, A, B, C, C**, D.

        req_for (Int) : Force minimale requise (souvent extrait de la colonne avec parenthèses 5 (10) dans le CSV).

    Extension Arme (WeaponEquipment) :

        damage_base (String) : ex: 1D6+2.

        choc_base (String).

        range, fire_mode, ammo_type, caliber.

        effects (String) : Le DSL brut (ex: DMG=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10);TXT=FX=ASSOMMANTE).

1.2. Données d'Instance (char_inventory)

C'est la table liée au personnage (char_sheet_id). Elle ne duplique AUCUNE donnée statique.

    instance_id (UUID) : Identifiant unique de l'objet possédé.

    ref_id (String) : Clé étrangère vers ref_equipment.

    equipped_slot (String) : Localisation actuelle sur le corps (TeteObj1, TeteObj2, Dos, Ceinture, MainDroite, etc.) ou null si dans le sac.

    condition (Int/String) : État d'usure.

    ammo_current (Int) : Balles restantes.

    loaded_ammo_ref (String) : Clé vers le type de munition chargée (qui déclenchera l'écrasement DSL).

2. Moteur de Résolution des Protections (Le "Mille-feuille")

Cette logique remplace les formules Excel MAX(...) et SOMME(...). Elle doit s'exécuter dans un useMemo côté React, recalculé uniquement si char_inventory ou les char_attributes changent.
2.1. Traitement par Zone Corporelle (x6)

Le système boucle sur 6 zones strictes : Tête, Corps, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droite.
Pour CHAQUE zone, le système identifie toutes les instances d'équipement équipées (jusqu'à 3 objets par zone, ex: Obj1, Obj2, Obj3).
2.2. Calcul de l'Armure Physique (Par zone)

    Extraire la valeur protection_phys des couches équipées sur la zone.

    Identifier la valeur la plus haute (plusGrande).

    Faire la somme des valeurs restantes.

    Formule de résolution : Math.ceil(plusGrande + (somme_restante / 2)).

    Ajouter le ResDom (Résistance aux Dommages issue des Attributs Secondaires).

2.3. Calcul de l'Armure de Choc (Par zone)

La logique est identique, mais elle ne s'applique qu'en utilisant la propriété protection_choc des objets. (Si une armure n'a pas de valeur de choc, elle vaut 0 dans ce calcul).
3. Moteur d'Encombrement et de Malus (Le Goulot d'Étranglement)

C'est la partie la plus sensible, traduisant la mécanique Excel =LET(forV; SIERREUR(1*ATTNaFor; 0)...) en code. Ce module évalue à quel point le personnage est gêné par son équipement.
3.1. Dictionnaire des Catégories de Malus

Le code doit mapper les catégories textuelles en valeurs numériques pures :
const malusMap = { 'S': 0, 'A': -2, 'B': -3, 'C': -4, 'C**': -5, 'D': -6 };
3.2. Évaluation de la Zone (La Règle du Pire)

Pour chaque localisation (y compris les conteneurs spéciaux Dos et Ceinture qui ont leurs propres prérequis) :

    Identifier la pire catégorie : Parmi les objets de la zone, trouver la catégorie qui a la valeur numérique la plus basse (la plus pénalisante). Ex: si TeteObj1="C" et TeteObj2="A", la catégorie retenue est "C" (-4).

    Pénalité de Force : Trouver le req_for de CHAQUE objet de la zone.

    Calculer le delta de Force pour chaque objet : delta = Math.max(0, req_for - FOR_actuelle).

    Retenir le delta le plus élevé de la zone : pire_delta_for.

    Malus Final de la Zone : MalusZone = (Valeur de la pire catégorie) - pire_delta_for.

3.3. Détermination du "Pire Malus" Global (Titre du Tableau 2)

    Le système compare les MalusZone des 6 zones corporelles + Dos + Ceinture.

    Il retient le chiffre le plus pénalisant (le plus bas).

    Output : Ce chiffre devient la constante global_encumbrance_malus.

3.4. Injection dans le DAG (Arbre de Dépendances)

Conformément aux règles de CHARACTER_FLUX.md, ce global_encumbrance_malus n'est JAMAIS sauvegardé en base de données. Il est injecté à la volée :

    Comme modificateur conditionnel (marker: 'LIMIT' ou similaire) sur les ref_skills concernées (Acrobatie, Athlétisme, Escalade, etc.).

    Comme pénalité sur la variable dérivée de la Vitesse de Déplacement.

    Comme modificateur de difficulté sur les jets de Résistance à la Fatigue.

4. Moteur de Résolution du Choc (États de Santé)

Bien que faisant partie du système de santé, le Choc est intimement lié à l'armure. Le moteur doit surveiller deux seuils (issus des Attributs Secondaires) : Seuil d'Étourdissement et Seuil d'Inconscience.

    Trigger : Lorsqu'un personnage reçoit des Dommages (après réduction par l'armure de la zone touchée), un jet de 1D20 est déclenché.

    Condition 1 (Échec mineur) : 1D20 > Seuil d'Étourdissement ET <= Seuil d'Inconscience.

        Effet appliqué : État Étourdi. Impossible d'attaquer, Malus global de -5 à toutes les actions (se cumule aux blessures), vitesse bridée à l'Allure Moyenne.

    Condition 2 (Échec majeur) : 1D20 > Seuil d'Inconscience.

        Effet appliqué : État Inconscient. Incapacité totale. Déclenchement de la mécanique de Coma (Jets de Chance périodiques selon la gravité).

5. Le Tokenizer d'Effets (Parser DSL)

Pour gérer la colonne "Effets" des munitions et des armes, nous devons implémenter un parseur d'AST (Abstract Syntax Tree) très léger.

Syntaxe Cible : TYPE=ACTION(VALEUR) séparé par des ;.
Exemple : DMG=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10);TXT=FX=ASSOMMANTE
5.1. Mécanique de Surcharge (Override)

Lorsqu'une munition est liée à une instance d'arme, le parseur lit le DSL de la munition :

    SET(...) : Écrase purement et simplement la statistique de base de l'arme.

    ADD(...) : Ajoute une valeur (ex: +2 aux dégâts).

    TXT=FX=... : Ajoute un tag qualitatif (ex: Assommante, Perçante) qui sera interprété par le module de jet de dés lors du combat.

Sécurité (Fail-back) : Si le parseur échoue à lire la syntaxe (erreur de frappe dans le CSV), il doit l'ignorer, lever un console.warn, et renvoyer les statistiques de base de l'arme pour ne pas faire crasher l'interface CharacterSheet.