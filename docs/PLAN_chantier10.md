CHAPITRE 1 : Architecture de la Base de Données (Data Layer)

Ce chapitre définit la structure exacte pour la persistance de l'inventaire d'un personnage. Il sert de base pour la création de la migration Knex.js et du modèle de données associé.
1.1. Table character_inventory

Cette table gère l'instanciation des objets possédés par un personnage. Elle agit comme une table de liaison enrichie entre la table characters (PostgreSQL) et la base de données statique des équipements (equipmentData / ref_equipment).
Schéma détaillé (Spécifications pour Migration Knex)
Nom de la Colonne	Type SQL (Knex)	Contraintes & Validations	Description / Rôle
id	uuid	primary()	Identifiant unique de l'instance de l'objet.
character_id	uuid	notNullable(), references('id').inTable('characters').onDelete('CASCADE')	Clé étrangère liant l'objet à la fiche du personnage. Si le perso est supprimé, l'inventaire l'est aussi.
base_item_id	string	notNullable()	Identifiant de référence de l'objet (ex: "EQ_00001"). Sert de clé pour récupérer les statistiques (poids, dégâts, protection) depuis le fichier statique JS.
quantity	integer	notNullable(), defaultTo(1), unsigned()	Quantité possédée (pour les munitions ou consommables). Doit être ≥0.
container_type	string	notNullable(), defaultTo('BAG')	Définit où se trouve l'objet. Valeurs autorisées (ENUM) : 'BAG' (Sac), 'BELT' (Ceinture), 'STASH' (Cache), 'EQUIPPED' (Porté).
equipped_slot	string	nullable()	Utilisé uniquement si container_type === 'EQUIPPED'. Définit l'emplacement exact.
current_ammo	integer	nullable(), unsigned()	Spécifique aux armes à feu. Stocke le nombre de balles actuellement dans le chargeur de cette instance d'arme.
custom_notes	text	nullable()	Champ libre pour le joueur (ex: "Balles traçantes", ou note manuelle sur l'exception du Kevlar).
1.2. Contraintes Métier (Database & API Level)

Pour éviter les corruptions de données et garantir les règles de Polaris, l'API devra valider les règles suivantes avant toute insertion/mise à jour (via un middleware ou dans le contrôleur) :

    Règle d'intégrité des Slots (ENUMs autorisés pour equipped_slot) :

        Protections/Vêtements : 'HEAD', 'TORSO', 'ARM_L', 'ARM_R', 'LEG_L', 'LEG_R'.

        Armes/Mains : 'HAND_MAIN', 'HAND_OFF'.

        Si container_type est différent de 'EQUIPPED', alors equipped_slot DOIT être NULL.

    Contrainte d'unicité des armes : Les slots 'HAND_MAIN' et 'HAND_OFF' ne peuvent contenir qu'un seul objet chacun à un instant T pour un même character_id.

    Contrainte de Ceinture (BELT) : La limite de poids et de slots de la ceinture (3 slots, max 3kg) ne sera pas gérée par une contrainte SQL stricte, mais par une validation logique côté API/Frontend lors du transfert d'un objet vers container_type: 'BELT'.
	CHAPITRE 2 : Moteurs de Calcul (Logic Layer)

Ce chapitre spécifie les algorithmes de résolution. Ces fonctions devront idéalement être écrites sous forme de modules utilitaires (ex: inventoryUtils.js) partagés entre le frontend (pour l'affichage en temps réel) et le backend (pour la validation des jets de dés).
2.1. Algorithme de Calcul des Protections (Le "Mille-feuille")

Fonction cible : calculateZoneProtection(zoneItems, characterForce)
Entrées : - zoneItems : Un tableau d'objets character_inventory filtré pour un equipped_slot spécifique (ex: 'TORSO'), enrichi des données de ref_equipment.

    characterForce : La statistique FOR actuelle du personnage (Entier).

Étape 1 : Mapping des Catégories
Le système doit convertir la lettre de catégorie d'armure (base_category dans le JSON) en malus numérique fixe :

    'S' = 0

    'A' = -2

    'B' = -3

    'C' = -4

    'C' = -5

    'D' = -6

Étape 2 : Validation de la Règle "1+S+S"

    Le script compte le nombre d'items dont la catégorie n'est PAS 'S'.

    Si ce nombre est > 1, l'algorithme retourne une Erreur de Validation (l'UI devra empêcher l'équipement de ce deuxième objet majeur).

Étape 3 : Calcul de la Protection (Prot) et du Choc (Choc)

    Extraire toutes les valeurs de Protection des items de la zone.

    Extraire toutes les valeurs de Choc des items de la zone.

    Trouver la valeur maximale : MaxProt = Math.max(...protections), MaxChoc = Math.max(...chocs).

    Faire la somme de toutes les autres valeurs (le "Reste") : SumResteProt, SumResteChoc.

    Appliquer la formule :

        FinalProt = Math.ceil(MaxProt + (SumResteProt / 2))

        FinalChoc = Math.ceil(MaxChoc + (SumResteChoc / 2))

        Note métier (Kevlar) : L'exception du Kevlar n'est pas traitée mathématiquement ici. Elle reste une note texte (custom_notes).

Étape 4 : Calcul du Malus d'Encombrement d'Armure (Surcoût FOR)

    Identifier l'armure de la zone ayant le plus gros prérequis de Force (ReqFOR_max).

    Identifier l'armure de la zone ayant la catégorie la plus lourde (CatMalus_pire).

    Calculer la carence en Force : CarenceFOR = Math.max(0, ReqFOR_max - characterForce).

    Formule du malus local : MalusZone = CatMalus_pire - CarenceFOR.

        Exemple : Catégorie B (-3) et une carence de 2 (FOR 11 pour ReqFOR 13) → Malus de la zone = -5.

Sortie de la fonction : Un objet { finalProt: Int, finalChoc: Int, malusZone: Int }.
Note globale : L'interface devra boucler cette fonction sur les 6 zones, et extraire le malusZone le plus bas (le "Pire Malus") pour l'injecter dans les compétences globales du personnage (LIMIT).
2.2. Algorithme de Calcul de la Charge Globale

Fonction cible : calculateTotalWeight(inventoryItems, characterForce)
Entrées :

    inventoryItems : La liste complète des objets du personnage.

    characterForce : La stat FOR du perso.

Étape 1 : Filtrage des Conteneurs
L'algorithme ignore totalement les items où container_type === 'STASH'.

Étape 2 : Somme des Masses

    Pour chaque item valide (BAG, BELT, EQUIPPED) :

        Poids de la ligne = item.quantity * ref_equipment.base_weight.

        Exception Munitions/Consommables : Le poids ne fluctue pas dynamiquement au tir. Il est lu tel quel. (Le trigger de mise à jour de la BDD se fait au RELOAD).

    TotalWeight = Sum(Poids de toutes les lignes).

Étape 3 : Évaluation de la Surcharge

    Calcul du seuil : MaxWeight = characterForce * 3.

    Statut : isOverloaded = TotalWeight > MaxWeight.

    Calcul du Malus de Charge : (Note : Puisque la règle officielle manque, nous appliquerons par défaut un palier simple).

        Si isOverloaded === false → WeightMalus = 0

        Si isOverloaded === true → WeightMalus = - (Math.ceil(TotalWeight - MaxWeight)) (soit -1 par kilo en trop, valeur arbitraire à confirmer pour éviter l'abus).

Sortie de la fonction : Un objet { totalWeight: Float, maxWeight: Float, isOverloaded: Boolean, weightMalus: Int }.
CHAPITRE 3 : Interface Utilisateur (UI/UX Layer)

Ce chapitre spécifie l'intégration du nouvel onglet "MATÉRIEL" au sein du composant existant CharacterSheet. Il s'inspire du design de référence fourni (Inventory.html) tout en s'adaptant à l'architecture React.
3.1. Architecture des Composants React

L'onglet "MATÉRIEL" sera encapsulé dans un composant parent EquipmentTab.

Arborescence cible :
Plaintext

<EquipmentTab> (Connecté au store/contexte pour récupérer 'char_inventory')
 ├── <WeightGauge /> (Barre de progression : Poids Actuel / Poids Max)
 ├── <div className="grid grid-cols-2">
 │    ├── <ActiveEquipment> (Colonne Gauche : Silhouette & Ceinture)
 │    │    ├── <ProtectionSlots /> (6 zones)
 │    │    ├── <WeaponSlots /> (2 mains)
 │    │    └── <BeltSlots /> (3 emplacements rapides)
 │    │
 │    └── <InventoryContainer> (Colonne Droite : Sac & Cache)
 │         ├── <InventoryFilters /> (Tabs: Tout, Armes, Armures, Conso)
 │         └── <InventoryGrid> (Liste des items non-équipés)
 │              └── <ItemCard /> (Composant unitaire)
 │
 └── <ItemActionModal /> (Modale cachée par défaut, gère les transferts)

3.2. Spécifications des Sous-Composants
A. <WeightGauge /> (Indicateur de Surcharge)

    Props attendues : totalWeight (Float), maxWeight (Float, calculé via FOR×3).

    Visuel : Une barre de progression horizontale (type <progress> stylisée avec Tailwind).

    Code couleur (Logique métier) :

        Poids≤(Max×0.75) : Vert (bg-green-500 / "Good").

        (Max×0.75)<Poids≤Max : Orange (bg-yellow-500).

        Poids>Max : Rouge (bg-red-500 / "Bad" - Surcharge).

    Affichage texte : "{totalWeight} kg / {maxWeight} kg (Seuil)"

B. <ActiveEquipment /> (La Silhouette)

Ce composant affiche les objets dont le container_type est 'EQUIPPED' ou 'BELT'.

    Layout : Une structure en grille ou positionnement relatif simulant une silhouette humaine.

    Slots de Protection (container_type: 'EQUIPPED') :

        6 boutons/zones fixes (HEAD, TORSO, ARM_L, ARM_R, LEG_L, LEG_R).

        État Vide : Affiche le nom de la zone en filigrane.

        État Rempli : Affiche le nom de l'item (ex: "Gilet Tactique"), sa Prot/Choc, et une icône de catégorie (A, B, C...).

    Slots d'Armes : HAND_MAIN, HAND_OFF. Affiche les dégâts et les munitions actuelles (current_ammo).

    Slots Ceinture (container_type: 'BELT') :

        Exactement 3 emplacements rendus via une boucle.

        Poids cumulé des 3 slots affiché en en-tête de cette sous-section ({beltWeight} / 3.0 kg).

C. <InventoryGrid /> & <ItemCard /> (Le Stockage)

Ce composant liste les objets dont le container_type est 'BAG' ou 'STASH'.

    <ItemCard /> : Basé sur le design Inventory.html.

        Un bloc avec un fond sombre (bg-[#151923]).

        Header : Nom de l'objet + Quantité en badge (ex: x10).

        Chips (Badges) : Petits tags pour les stats clés (Poids unitaire, Dégâts ou Protection).

        Interaction : Un clic complet sur la carte ouvre le <ItemActionModal />.

D. <ItemActionModal /> (Le Routeur d'Actions)

C'est le composant le plus critique pour l'UX. Lorsqu'un joueur clique sur un item (qu'il soit équipé ou dans le sac), cette modale s'ouvre.

    Donnée injectée : L'objet character_inventory complet de l'item cliqué + les infos ref_equipment.

    Actions disponibles (Boutons) : L'affichage des boutons est conditionnel selon le statut actuel de l'objet.

        Bouton "Équiper" : Ouvre un sous-menu demandant sur quel Slot (si plusieurs compatibles). Modifie le container_type en 'EQUIPPED'.

        Bouton "Mettre à la ceinture" : Uniquement si Poids≤3kg et qu'il reste un slot BELT vide.

        Bouton "Mettre dans le sac" : Modifie le container_type en 'BAG'.

        Bouton "Stocker à la planque" : Modifie le container_type en 'STASH'.

        Bouton "Supprimer" : Action destructive (Delete SQL). Demande une confirmation.

    Cas particulier (Munitions/Consommables) : Si la quantité est >1, ajouter des boutons "+ / -" pour diviser le stack ou consommer une unité.

3.3. Gestion des Flux de Données (Hooks)

Pour qu'une IA code proprement, il faut isoler la logique des appels API de l'UI.

    Création d'un Hook custom : useInventory(characterId).

    Fonctions exposées par le Hook :

        inventory (Array) : La liste complète des items.

        isLoading (Boolean).

        moveItem(itemId, targetContainer, targetSlot = null) : Fonction pour déclencher le changement d'état.

        updateQuantity(itemId, delta) : Fonction pour les consommables/munitions.

        deleteItem(itemId) : Fonction de destruction.

    Optimisation (Debounce) : Contrairement aux points de vie, le déplacement d'un objet (Sac vers Porté) doit déclencher une mise à jour API immédiate pour que le serveur valide les règles métier (Chapitre 2 : Règle "1+S+S") et renvoie une erreur si la contrainte n'est pas respectée.
	CHAPITRE 4 : Interface de Programmation (API / Network Layer)

Ce chapitre spécifie les routes à ajouter dans ou autour de ton fichier characters.js. Ces endpoints gèrent le CRUD (Create, Read, Update, Delete) de l'inventaire tout en appliquant les validations côté serveur.
4.1. Base de la Route & Middlewares

Toutes les requêtes relatives à l'inventaire d'un personnage seront montées sur la route de base suivante (dans le contexte de ton routeur imbriqué characters.js) :

Base URL : GET/POST/PUT/DELETE /api/campaigns/:campaignId/characters/:id/inventory

Middlewares requis pour toutes les routes d'inventaire :

    requireAuth : L'utilisateur doit être connecté.

    checkCharacterOwnershipOrGm (Middleware à créer ou existant) : Seul le joueur à qui appartient le personnage (user_id de la fiche) OU le Game Master de la campagne (role === 'gm') a le droit de modifier cet inventaire.

4.2. Spécification des Endpoints
A. Récupérer l'inventaire complet

    Méthode : GET /

    Description : Récupère l'intégralité de la table char_inventory pour le personnage :id.

    Traitement Serveur : * Doit idéalement faire un JOIN avec la vue statique/table de référence ref_equipment pour renvoyer les stats de l'objet (Poids, Prot, Dégâts) directement au client.

    Réponse Succès (200 OK) : Un tableau d'objets (les instances avec leurs données de base injectées).

B. Ajouter un nouvel objet (Loot / Achat)

    Méthode : POST /

    Payload (JSON) :
    JSON

    {
      "base_item_id": "EQ_00001",
      "quantity": 1,
      "container_type": "BAG", 
      "equipped_slot": null
    }

    Validation API :

        Vérifier que base_item_id existe dans la référence.

        Si container_type === 'EQUIPPED', vérifier que equipped_slot est fourni et valide (cf. Chapitre 1).

    Réponse Succès (201 Created) : L'objet char_inventory nouvellement créé (avec son id UUID).

C. Mettre à jour un objet (Déplacer, Équiper, Tirer)

C'est la route la plus complexe, car elle déclenche les vérifications métier de Polaris.

    Méthode : PUT /:itemId

    Payload (JSON) :
    JSON

    {
      "container_type": "EQUIPPED",
      "equipped_slot": "TORSO",
      "quantity": 1,
      "current_ammo": 40,
      "custom_notes": ""
    }

    Validation Métier (Crucial) : * Si la requête tente d'équiper une armure (Catégorie A, B, C, D) sur un slot (ex: 'TORSO'), le serveur doit faire une requête préalable (SELECT sur les items déjà équipés sur 'TORSO'). S'il y a déjà une armure majeure, le serveur doit rejeter la requête pour respecter la règle "1+S+S".

    Réponse Erreur (400 Bad Request) : {"error": "Impossible d'équiper : Une armure principale occupe déjà cette zone."}

    Réponse Succès (200 OK) : L'objet mis à jour.

D. Supprimer / Jeter un objet

    Méthode : DELETE /:itemId

    Description : Supprime définitivement la ligne char_inventory.

    Réponse Succès (204 No Content).

4.3. Gestion du Calcul Global (Le Flux de données)

Puisque les calculs de Charge et de Protection (Chapitre 2) sont basés sur cet inventaire, une décision d'architecture doit être prise concernant qui calcule quoi :

    Option A (Client-Side Rendering - Recommandée) : L'API se contente de renvoyer la liste des objets via le GET. Le Frontend (React) utilise les utilitaires du Chapitre 2 pour calculer le "Mille-feuille" et le poids en temps réel à chaque modification de son State local.

    Option B (Server-Side Calculation) : À chaque PUT ou POST, le serveur recalcule le MalusZone et la Surcharge, puis met à jour directement les valeurs limit_mod dans la table characters.

(Pour un VTT fluide, l'Option A couplée à un debouncing pour synchroniser le résultat final avec le serveur est souvent préférable pour ne pas surcharger la base de données à chaque déplacement de grenade du sac vers la ceinture).

CHAPITRE 5 : Synchronisation & Intégrité (The Glue)

Ce dernier chapitre assure que les calculs de l'onglet "MATÉRIEL" impactent réellement les jets de dés du personnage.
5.1. Injection des Malus (Le pont avec les Skills)

L'inventaire génère deux valeurs critiques : totalWeightMalus et worstArmorMalus.

    Règle d'application : Ces deux malus sont cumulatifs.

    Cible : Ils doivent être soustraits dynamiquement à la LIMIT (ou au test de compétence) des compétences de type physique (Coordination, Acrobatie, Discrétion, etc.).

    Planification technique : Dans ton composant CharacterSheet, nous ajouterons un useEffect qui écoute les changements d'inventaire et met à jour un objet globalInventoryModifiers. Cet objet sera passé aux composants de calcul des compétences.

5.2. Gestion du Reload (Munitions & Masse)

Comme convenu, on ne veut pas recalculer le poids à chaque balle tirée pour éviter de spammer l'API.

    Événement RELOAD : Un bouton sur l'arme dans l'UI.

    Action : 1. Le joueur saisit le nombre de balles/chargeurs consommés.
    2. L'API met à jour la quantity dans char_inventory.
    3. Le Front reçoit la nouvelle quantité et met à jour la WeightGauge.

5.3. Sécurité & Anti-Triche (Validation Serveur)

Même si le client calcule, le serveur doit rester le juge de paix.

    Plan technique : Lors d'un PUT /inventory/:itemId pour équiper un objet, le contrôleur Express doit ré-exécuter la logique du Chapitre 2.2 (Règle 1+S+S).

    Conséquence : Si un joueur tente de "forcer" l'équipement d'une deuxième armure de catégorie B via la console ou un lag, le serveur renvoie une AppError(400) et le client annule le mouvement visuel de l'objet.
⚙️ Correction A : Gestion Simplifiée du Poids (Munitions)

    La Règle : Le poids total est exclusivement calculé sur les quantités (quantity) présentes dans l'inventaire (Sac, Ceinture, Porté).

    Le Flux : Quand un joueur recharge (RELOAD) :

        On diminue la quantity de l'item Munition dans le sac.

        Le poids total chute mécaniquement (car Poids=Quantiteˊ×Poids_Unitaire).

        Les balles dans l'arme (current_ammo) sont considérées comme sans poids (incluses dans le poids de base de l'arme ou simplement ignorées pour la simplicité).

⚙️ Correction B : Règle du "Pire Malus" (Armor)

    La Règle : Les malus de zone ne sont jamais cumulatifs.

    Le Calcul : Le système calcule le MalusZone pour les 6 zones. La fiche personnage ne retient et n'applique que la valeur la plus basse (la plus punitive).

        Exemple : Bras G (-2), Jambe D (-5) → Malus total appliqué aux tests = -5.

⚙️ Correction C : Validation de Compatibilité (UI)

    Contrainte Modale : Lors de l'ouverture de la modale d'action d'une arme, le bouton "RECHARGER" ne doit être enabled que si le script trouve dans l'inventaire un objet dont le caliber (ou ammo_type) correspond exactement à celui défini dans la fiche technique de l'arme.

📓 APPEND : JournalGemini.md (Phase 2 - CLÔTURE)

    Derniers Arbitrages Techniques validés :

        Poids Munitions : Calculé sur le stock. Les munitions engagées dans l'arme sont de masse nulle pour le moteur.

        Cumul Malus : Règle du "Pire Malus" uniquement (non-cumulatif entre zones).

        Vérification Type : Verrouillage logique de la recharge par correspondance de calibre.

        Compatibilité VTT : Confirmée (Stack Express/Knex/WS compatible).