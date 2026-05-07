JournalGemini.md — MÉMOIRE CENTRALE ÉQUIPEMENT (V3 - FULL)
🏗️ 1. Architecture & Modèle de Données
1.1. Séparation des préoccupations

    Le Catalogue (ref_equipment) : Table plate pour l'import, distribuée par le backend en interfaces typées (Base, Armor, Weapon).  

    L'Inventaire (char_inventory) : Table d'instance liée au char_sheet_id. Ne duplique aucune donnée statique. Contient : instance_id (UUID), ref_id (FK), equipped_slot, condition, ammo_current, loaded_ammo_ref.  

1.2. Organisation de l'Espace (Conteneurs)

    Localisations Corporelles (Slots) : TeteObj1, TeteObj2, Dos, Ceinture, MainDroite, MainGauche, etc..  

    CEINTURE (BELT) : 3 emplacements fixes. Capacité maximale de 3 kg. Si surcharge ou slots pleins, l'ajout bascule manuellement dans le sac. Accès rapide en combat.  

    SAC (BAG) : Accès lent (action complète). Capacité limitée par la Force globale.  

    CACHE (STASH) : Poids neutre (0 kg sur la fiche active).  

⚖️ 2. Moteurs de Calcul (Logique Métier)
2.1. Protection (Le "Mille-feuille")

    Zones de couverture (6) : Tête, Corps, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droite.  

    Règle de cumul (1+S+S) : Chaque zone accepte au maximum une armure de catégorie maîtresse (A, B, C, D). Les deux autres slots sont réservés aux catégories "S".  

    Formule Physique & Choc : Appliquée par zone. Valeur = Math.ceil(PlusGrande + (SommeDesAutres / 2)) + ResDom.  

    Note sur le Choc : Si une armure n'a pas de protection_choc, sa valeur est de 0 dans ce calcul spécifique.  

2.2. Encombrement et Malus

    Seuil de Confort : Force * 3 kg (Somme de Porté + Sac + Ceinture).  

    Dictionnaire des Malus : S: 0 | A: -2 | B: -3 | C: -4 | D: -6.  

    Règle du Pire (Global Malus) :

        Calculer le MalusZone pour chaque localisation : Valeur_Pire_Catégorie - Math.max(0, Pire_Req_For - FOR_actuelle).  

        Le MalusZone le plus bas (le plus pénalisant) de toutes les zones devient le global_encumbrance_malus.  

    Injection DAG : Ce malus n'est jamais stocké. Il est injecté dynamiquement sur les ref_skills (Acrobatie, Athlétisme, etc.) et la Vitesse de Déplacement.  

🛠️ 3. Spécifications du Parser & DSL
3.1. DSL des Effets (Armes et Munitions)

    Syntaxe : TYPE=ACTION(VALEUR); séparé par des points-virgules.  

    Actions :

        SET(...) : Écrase la statistique de base.  

        ADD(...) : Ajoute une valeur numérique.  

        TXT=FX=... : Tag qualitatif (ex: ASSOMMANTE, PERÇANTE).  

    Exemple Munition : DMG_H=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10);TXT=FX=ASSOMMANTE.  

3.2. Traitement des Dommages

    Structure cible : h (Humaine), v_minus (Véhicule léger V-), v_plus (Véhicule lourd V+).  

    Format d'entrée : Chaîne brute type "1D10 (H) / 1D6 (V-) / 1D4 (V+)".  

🚀 4. Pipeline d'Exportation & Cas Critiques
4.1. État des Scripts

    0_extractor.js (OK) : Nettoyage brut, conversion des poids (virgule vers point), extraction initiale des dommages.  

    1_convert_equip.js (EN COURS) : Gère l'encodage UTF-8 (dégâts, portée, etc.) et la priorité aux clés techniques.  

4.2. Dettes Techniques à intégrer dans le Script 2

    Le Bâton Ordonnateurs (EQ_00066) : Triplement obligatoire de l'item.  

        EQ_00066 : Mode Passif (Dégâts 1D10+5).  

        EQ_00066_ELEC : Mode Électrique (Dégâts 2D10+5, prix/poids 0).  

        EQ_00066_PERF : Mode Pointe (Dégâts 1D6+7 perfo, Malus -7, Compétence Arts Martiaux, prix/poids 0).  

    Scission Munitions : Scinder le champ off_ammo_raw pour isoler la capacité du coût de recharge.  

    Harmonisation Nations : Normalisation des chaînes (ex: "Union Med." systématique).  

    Conversion Poids : Typage strict en Float pour le moteur de charge.  

4.3. Exceptions Figées (Anti-Erreur)

    Kevlar : Protection fixée à 10. Pas de calcul complexe pour les dégâts perforants.  

    ATI Alpha : Catégorisé comme "Accessoire". Pas de protection, pas de prérequis de Force.  

    Fibres Vivantes : Gilet retiré du catalogue (trop complexe).

--- NOTES USER EN VRAC ---
Pour la colonne protection_choc (ou def_shock_mod), le script va devoir utiliser 0 plutôt que null en l'absence de valeur. -> "0" par défaut pour le Choc.
Règle des Poids Manquants : Tout item de type "Grenade" ayant un poids indéfini (-) se voit attribuer une valeur par défaut de 0.5 kg.  

Typage SQL : Conversion forcée en Float (ex: 0.0) pour permettre les additions du moteur de charge.
Instruction de Parsing des Dommages (Logique de repli) :

    Tentative de Split : Le script cherche les marqueurs standard (H), (V-), (V+).  

    Détection d'Exception : Si la chaîne de dommage contient des caractères non conventionnels (ex: /Tour, Loc, zone), le script abandonne le découpage numérique.  

    Stockage DSL : L'intégralité de la chaîne brute est déplacée dans le champ effects de la base SQL avec le tag TXT=FX=.  

        Exemple 00176 : effects: "TXT=FX=1D6/Tour ×1D3 Loc (+1/Tour en zone);".  

    Valeur par défaut : Les colonnes de dégâts numériques (off_damage_h, etc.) sont alors mises à 0 ou null pour cet item afin d'éviter les erreurs de calcul.

    ## 🛠️ Logique de Conversion Métier (Session 45.D)

### A. Normalisation des Poids
- Tout poids absent (`-`) ou invalide doit être converti en `0.0` (Float)[cite: 4].
- Exception Grenades : Si `category == "Grenade"` et `weight == "-"`, injecter `0.5`[cite: 2].

### B. Traitement des Dommages Non-Numériques (Cas 00176)
- Si le champ "Dommage" ne respecte pas le format numérique standard ou contient des termes complexes[cite: 3] :
  - Créer un effet via le DSL : `TXT=FX=[CONTENU_BRUT];`[cite: 1].
  - Injecter ce texte dans la colonne `effects` du JSON SQL[cite: 1].
  - Mettre les colonnes `off_damage_X` à `null` pour éviter les conflits de types[cite: 4].

### C. Initialisation Défensive
- Toute armure sans valeur de "Protection Choc" doit être initialisée à `0` (Integer) en base, et non `null`[cite: 1].

Le Tag "Étanche" :
Dans Excel, c'est souvent jeté dans une colonne "Notes" ou "Effet". En SQL, ça ne peut pas "flotter" hors structure.

    Solution pour le script : Tout texte orphelin dans les colonnes de notes pour les équipements généraux doit être encapsulé dans le champ effects via le DSL de texte.

Le mot "Kevlar" dans le nom d'un sac:
Bien qu'il s'appelle "Sac tactique en kevlar", ce n'est pas une armure. Le script 0_extractor.js ne doit pas chercher à lui attribuer une valeur de protection par erreur. Son type "Equipement Général" le protège de ce faux-positif.

## 🛠️ Logique de Conversion Métier - Extraction Excel vers SQL (Session 45)

### A. Normalisation des Poids et des Chocs
- **Float forcé :** Tout poids absent (`-`) ou invalide doit être converti en `0.0` (Float) pour le moteur d'encombrement.
- **Exception Grenades :** Si `category == "Grenade"` et `weight == "-"`, injecter `0.5` kg.
- **Protection Choc :** Toute armure sans valeur explicite de "Protection Choc" doit être initialisée à `0` (Integer) en base, et non `null` (critique pour la formule "Mille-feuille").

### B. Traitement des Dommages et Variables
- **Logique de repli (Dommages) :** Si la chaîne de dommage ne respecte pas le split standard `(H) / (V-) / (V+)` ou contient des termes complexes (ex: `/Tour`, `Loc`, `zone`) :
  1. Mettre les colonnes numériques `off_damage_X` à `null` ou `0`.
  2. Injecter la chaîne brute dans le DSL via : `TXT=FX=[CONTENU_BRUT];` dans la colonne `effects`.
- **Variables et Multiplicateurs :** 
  - Si un prix contient une variable (ex: `1500 x niv`), extraire l'entier de base dans `price` (ex: `1500`) et documenter la formule dans `price_modifier` ou via DSL.

### C. Gestion des Conteneurs et Accessoires
- **Capacité (Sacs) :** Récupérer la donnée brute (Float) dans une colonne dédiée. Le calcul croisé avec la Force sera fait dynamiquement par le moteur.
- **Mots-clés isolés :** Toute propriété descriptive ("étanche", "fragile") dans les notes devient un tag DSL : `TXT=FX=[MOT_CLE];`.
- **Localisation (Le "T") :** Un "T" en fin de ligne désigne l'emplacement **Tête**. Le script doit mapper cela vers le champ `equipped_slot`.

### D. Cas Particuliers & Clonage
- **Faux positifs :** Un objet comme le "Sac tactique en kevlar" est un "Equipement Général". Le mot "kevlar" ne doit pas déclencher le parsing d'armure.
- **Clonage (Le Bâton Ordonnateurs - 00066) :** Les objets à modes multiples doivent générer plusieurs entrées SQL.
  - Base : `EQ_00066` (Mode passif).
  - Clones : `EQ_00066_ELEC`, `EQ_00066_PERF`. Les clones ont un poids et un prix de `0` pour ne pas fausser l'inventaire. Leurs compétences requises et statistiques sont ajustées.
  ## 🛠️ Logique de Conversion Métier - Accessoires Armes (Session 45.E)

### E. Variables Avancées (Poids et Formules quadratiques)
- **Prix complexes (ex: `1000 x (niv x niv)`) :** Le script extrait l'entier de base (`1000`) pour la colonne `price`[cite: 1]. Le reste (`x (niv x niv)`) est converti en `* (level * level)` et stocké dans `price_modifier`.
- **Poids variable (ex: `0.1 kg x niv`) :** 
  - `base_weight` (Float) prend la valeur numérique de base (`0.1`)[cite: 1].
  - Injecter un avertissement dans `effects` : `TXT=FX=Poids variable (* niveau);`[cite: 1].

### F. Multi-Compatibilité d'Accessoires (Séparateur `|`)
- Si le champ "Compétence" contient le séparateur `|` (ex: `Armes Lourdes | Armes de poing`), cela indique les armes compatibles.
- **Action :** Ne PAS chercher à lier un `skill_id`. Laisser `skill_id` à `null`.
- **DSL :** Créer un tag de compatibilité dans `effects` : `TXT=COMPAT=[CHAINE_BRUTE];`[cite: 1].

### G. Application stricte Poids Manquant
- L'implant palmaire (poids `-`, non-grenade) est validé à `0.0` Float[cite: 1].