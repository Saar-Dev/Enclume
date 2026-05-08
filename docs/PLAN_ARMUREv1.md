📄 Étape 1 : Concept Validé pour le Module Armes/Sac/Inventaire
(À intégrer dans docs/PLAN_ARMES_SAC_INVENTAIRE.md)

🎯 Objectif
Remplacer l’interface actuelle du compteur de blessures par une interface Armes/Sac/Inventaire basée sur DESIGN_CHARv2.png, en conservant temporairement l’ancien compteur pour validation.

Intégration : Nouvelle interface au-dessus de l’existante dans CharacterWindow.

À supprimer : Le doublon (compteur de blessures) une fois le module validé.

📌 Périmètre Exact
1. Structure Visuelle (Basée sur DESIGN_CHARv2.png)

Silhouette centrale :

Aucun objet (arme/armure) affiché.
Couleurs des localisations (Tête, Corps, Bras G/D, Jambes G/D) = pire blessure de la localisation (via WoundManager).

Localisations (Tête, Corps, Bras G/D, Jambes G/D) :

Menu déroulant pour sélectionner 1 à 3 objets compatibles (ref_equipment.location contient le code de la localisation, ex: 'T' pour Tête).
Affichage des objets équipés :

3 stats : Armure, Choc, Malus (depuis char_inventory par défaut, sinon ref_equipment).
Format : ETQ: X, PRT: Y / Z (ex: PRT: A / -8).

Compteur de blessures :

Déjà implémenté dans WoundManager → réutilisé tel quel (sans modification).
Placement : Uniquement sous la section de la localisation correspondante (ex: compteur de blessures de la Tête sous les équipements de la Tête).


SAC À DOS / CEINTURE (menus centraux) :

Sélection d’un seul objet par conteneur (location = 'D' pour Sac à Dos, 'Ce' pour Ceinture).
Affichage : Nom de l’objet + 3 stats (Contenance, Etancheité, Malus pour les sacs).
Fonctionnalité : Une fois équipé, l’utilisateur peut y placer des objets (via l’inventaire, hors scope de ce chantier).


2. Règles Métier

Filtrage des objets :

Source : char_inventory (filtré par character_id + container != 'Coffre').
Filtre : ref_equipment.location contient le code de la localisation (ex: 'T' pour Tête, 'D' pour Dos).

Équipement :

slot mis à jour avec la localisation (ex: 'TÊTE').
container forcé à 'Sac' (règle PI2).
Vérification de la règle "1+S+S" côté serveur (1 armure majeure par slot).

Déséquipement :

slot = NULL.

Malus :

Affichés tels quels depuis char_inventory ou ref_equipment (pas de calcul côté client).

Blessures :

Intégration : Utiliser le module WoundManager existant pour :

Colorier les localisations dans la silhouette.
Afficher le compteur de blessures à cocher (grille Légère → Mortelle) sous chaque localisation.



3. Exceptions

SAC À DOS / CEINTURE :

1 objet max par conteneur (D ou Ce).
Pas de règle "1+S+S".

Objets customs :

Hors scope pour l’instant (non traités).


🔌 Intégration Technique
1. API et WebSocket (Validé via JOURNAL2.md Session 52)

Endpoints API pour char_inventory :

GET /:characterId/inventory → Récupère les objets + sols, total_weight, ini_penalty, threshold.
PUT /:characterId/sols → Met à jour les sols.
POST /:characterId/inventory → Ajoute un objet (stacking + validation container/slot).
PUT /:characterId/inventory/:itemId → Déplace/équipe un objet (règle "1+S+S", slot forcé à 'Sac').
DELETE /:characterId/inventory/:itemId → Supprime un objet.

WebSocket :

Événements : INVENTORY_ADDED, INVENTORY_UPDATED, INVENTORY_REMOVED, SOLS_UPDATED.
Déjà implémenté dans server/src/socket/index.js et shared/events.js.

2. Calculs (Côté Serveur Uniquement)

Malus de surcharge : calcEncumbrancePenalty(totalWeight, forValue) → MAX(0, CEIL(totalWeight - forValue * 3)).
Malus de blessures : calcWoundPenalty(wounds) → Pire malus (≤ 0).
Malus effectif : effectiveMalus = woundPenalty - encumbrancePenalty (toujours ≤ 0).
3. Composants React à Implémenter


  
    
      Composant
      Rôle
      Props/State
      Intégration
    
  
  
    
      LocationPanel
      Conteneur pour une localisation (ex: Tête).
      location, equippedItems, wounds, onEquip, onUnequip.
      Utilise EquipmentDropdown et WoundCheckboxGrid.
    
    
      EquipmentDropdown
      Menu déroulant pour sélectionner un objet compatible.
      location, items (filtrés via ref_equipment.location), onSelect.
      Appelle PUT /:characterId/inventory/:itemId pour équiper.
    
    
      EquipmentLayer
      Affiche un objet équipé + ses 3 stats (Armure, Choc, Malus).
      item (depuis char_inventory ou ref_equipment), onUnequip.
      Affiche les stats telles quelles depuis la base.
    
    
      WoundCheckboxGrid
      Compteur de blessures (déjà existant dans WoundManager).
      wounds (pour la localisation), onWoundToggle.
      Réutilisé tel quel (sans modification), placé sous EquipmentLayer.
    
    
      SacCeinturePanel
      Menu pour SAC À DOS / CEINTURE.
      location ('D' ou 'Ce'), items (filtrés), onSelect.
      Appelle PUT /:characterId/inventory/:itemId pour équiper.
    
    
      Silhouette
      Silhouette humaine avec couleurs des blessures.
      wounds (depuis WoundManager).
      Aucun objet affiché, seulement les couleurs des blessures.
    
  



4. Flux de Données

Chargement initial :

GET /:characterId/inventory → Récupère les objets équipés.
GET /wounds → Récupère les blessures (déjà implémenté).

Équipement/Déséquipement :

PUT /:characterId/inventory/:itemId → Met à jour slot et container.
Broadcast WebSocket : INVENTORY_UPDATED → Met à jour l’UI en temps réel.

Blessures :

Utilisation directe de WoundManager (déjà intégré dans CharacterSheet).


📜 Règles Transverses (À Respecter)

Pas de calcul côté client :

Les malus (Armure, Choc, Surcharge) sont affichés tels quels depuis char_inventory ou ref_equipment.
Les calculs (ex: effectiveMalus) sont côté serveur uniquement.

Pas de destruction d’objets :

Uniquement équipement/déséquipement dans cette interface.

Couches d’équipement :

1 à 3 couches max par localisation (ex: Tête, Corps).
Ordre des couches : Non persistant en base (affichage dans l’ordre de sélection).

SAC À DOS / CEINTURE :

1 objet max par conteneur (D ou Ce).
Pas de règle "1+S+S".


✅ Validation Finale


  
    
      Point
      Statut
      Source
    
  
  
    
      3 stats (Armure, Choc, Malus)
      ✅ Validé
      Vos réponses + ref_equipment
    
    
      Compteur de blessures réutilisable
      ✅ Validé
      WoundManager existant
    
    
      Endpoints API char_inventory
      ✅ Implémentés
      JOURNAL2.md Session 52
    
    
      WebSocket (INVENTORY_UPDATE)
      ✅ Opérationnel
      JOURNAL2.md Session 52
    
    
      Règle "1+S+S" côté serveur
      ✅ Implémentée
      char-sheet.js (Session 52)
    
  


