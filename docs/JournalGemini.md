Journal de Bord - Projet Polaris
Ce document sert de mémoire externe pour le développement du système de jeu Polaris. Il contient les analyses validées, les annotations techniques et les arbitrages de conception pour éviter toute dérive ou omission.
1. Système d'Armes
Architecture UI / BDD
Slots d'équipement : 2 slots principaux (Arme 1, Arme 2).
Source de vérité : La base ref_weapons dicte les stats de base. L'inventaire gère les instances (mods, munitions).
Champs dynamiques : Compétence liée (calculée selon le score du joueur), état du chargeur, mode de tir.
Moteur de Dégâts
Utilisation d'un utilitaire parseWeaponDamage gérant :
SET(X) : Remplacement des dégâts de base.
ADD(X) : Ajout de dés ou modificateurs fixes.
Note : Les effets de munitions sont traités de manière narrative/humaine pour éviter les bugs de calcul complexes.
2. Système de Protection
Logique de Résolution (Le Mille-feuille)
Règle du "1 + S + S" : Chaque zone accepte au maximum une armure de catégorie maîtresse (A, B, C, D, C**). Les autres slots sont réservés aux catégories S.
Calcul par Localisation : ValeurArmure = CEIL(Max + (Reste/2)) + ResDom.
Calcul du Choc : ValeurChoc = CEIL(MaxChoc + (ResteChoc/2)).
Gestion du Malus
Le malus global est la somme cumulative du malus d'armure et du malus de charge totale.
3. Compléments d'Analyse (Phase 1 - Validés)
Sujet
Décision d'Analyse
 
Poids des Munitions
Recalcul du poids total de l'inventaire uniquement lors d'un Rechargement (Reload) ou modification d'inventaire.
Cas du Kevlar
Protection fixée à 10. Pas d'automatisation des exceptions de dégâts perforants. Gestion humaine via une note.
ATI Alpha
Catégorisée comme Accessoire. Pas de protection, pas de prérequis de Force. DIS -10(-5) = Disponibilité.
Exclusions
Gilet en fibres vivantes : Retiré du développement (complexité excessive).

Notes de Vigilance
Phase 1 : Toujours en cours. Interdiction de passer au code avant validation complète de l'analyse.
Masse Totale : Bien vérifier l'addition Poids Porté + Poids Sac pour le calcul du malus de charge.

⚠️ Mise à jour du Journal de Bord (Append)

    Charge : Seuil de confort fixé à FOR×3 kg. Au-delà, application du malus de surcharge (à définir, probablement indexé sur le dépassement).

    Localisations : Extension à 6 zones distinctes (Symétrie Latérale activée pour Bras et Jambes).

    Interface : L'onglet "MATÉRIEL" sera divisé en deux colonnes ou sections : "Équipement Actif" (Silhouette/Slots) et "Inventaire" (Grille type Inventory.html).
	
	📓 APPEND : JournalGemini.md (Phase 2 - Planification)
1. Règle de Charge & Masse (LOGIC)

    Seuil de confort : FOR×3 kg.

    Calcul : ∑(Poids_Porteˊ)+∑(Poids_Sac)+∑(Poids_Ceinture).

    Malus de Surcharge : Se déclenche au premier kilo dépassant le seuil. (Formule de malus à confirmer).

    Trigger Recalcul : Uniquement sur action RELOAD (Munitions) ou MANUAL_UPDATE (Inventaire).

2. Architecture du Stockage (DATA/UI)

    CEINTURE (BELT) :

        Slots : 3 emplacements fixes.

        Capacité : 3 kg max.

        Comportement : BLOQUÉ. Pas de débordement automatique vers le sac. Si > 3kg ou slots pleins, l'ajout est impossible ou bascule manuellement dans le sac.

    SAC (BAG) :

        Accès : Action complète en combat.

        Capacité : Limitée par la force globale du perso.

    CACHE (STASH) :

        Poids : Neutre (0 kg sur la fiche active).

3. Localisations de Protection (DATA)

    Zones (6) : TÊTE, CORPS, BRAS_G, BRAS_D, JAMBE_G, JAMBE_D.

    Calcul Mille-feuille : Exécuté indépendamment sur chacune des 6 zones.

4. Points d'Attention (ANTI-ERREUR)

    Kevlar : Erreur de complexité identifiée -> Fixé à 10 (Note manuelle uniquement).

    ATI Alpha : Erreur de lecture identifiée -> Accessoire, pas d'armure, pas de prérequis FOR.

    Munitions : Ne pas automatiser les dégâts/effets.
	
C'est noté. Simple, efficace, pas d'usine à gaz. Un consommable est un objet standard avec un multiplicateur de poids.

J'effectue l'APPEND de données dans le journal. C'est la dernière brique de la Phase 2.
📓 APPEND : JournalGemini.md (Phase 2 - FINALISATION)
5. Gestion des Consommables (DATA)

    Modèle : Objet standard.

    Champs obligatoires : Nom, Quantité, Poids_Unitaire.

    Logique de Masse : Poids_Total_Consommable = Quantité × Poids_Unitaire.

    Abstraction : Pas de jauges d'énergie, d'oxygène ou de faim spécifiques. La gestion est numérique (décrémentation de la quantité).

6. État des Lieux de la Planification (CHECKLIST 100%)

    [X] Structure BDD : Table d'instance char_inventory avec lien ref_equipment.

    [X] Localisations : 6 zones (Tête, Corps, Bras G/D, Jambes G/D).

    [X] Règle de Protection : Mille-feuille 1+S+S validé par zone.

    [X] Système de Charge : Seuil FOR×3 kg (Porté + Sac + Ceinture).

    [X] Conteneurs : * CEINTURE : 3 slots / 3 kg max / Accès rapide.

        SAC : Accès lent / Poids total.

        CACHE : Poids neutre.

    [X] Munitions : Poids calculé au RELOAD uniquement.

    [X] Exceptions : Kevlar (note manuelle), ATI Alpha (accessoire).

    [X] UI/UX : Migration de l'intelligence visuelle de Inventory.html vers React.