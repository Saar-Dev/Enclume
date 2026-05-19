## 10. Décisions Techniques Validées (2026-05-09)

---

### **Localisation des Armes**


| **Décision**                           | **Source**            | **Statut**   | **Notes**                                |
| -------------------------------------- | --------------------- | ------------ | ---------------------------------------- |
| `**M` pour les armes à 1 main**        | Votre validation (Q1) | ✅ **Validé** | `MG`/`MD` géré côté client.              |
| `**2M` pour les armes à 2 mains**      | Votre validation      | ✅ **Validé** | Ex: Arme d'épaule, Arme lourde.          |
| `**Tr` pour les trépieds**             | Votre validation (Q2) | ✅ **Validé** | Armes lourdes avec `location = "2M/Tr"`. |
| `**M` pour les armes avec "Pistolet"** | Votre validation (Q3) | ✅ **Validé** | Ex: Pistolet choc Stun II → `M`.         |


---

### **Problèmes Techniques**


| **Problème**                     | **Cause**                                     | **Solution**         | **Statut**        |
| -------------------------------- | --------------------------------------------- | -------------------- | ----------------- |
| **Chaîne de caractères ouverte** | Syntaxe SQL incorrecte (guillemet non fermé). | Corriger la syntaxe. | ⚠️ **À résoudre** |


---

## 11. Prochaines Étapes (Priorité Absolue)

1. **Résoudre le problème de syntaxe SQL** (chaîne de caractères ouverte).
2. **Exécuter les requêtes une par une** avec `RETURNING count(*)` pour vérifier les mises à jour.
3. **Vérifier les armes restantes** (`location = 'AR'`).

---

## 12. Journal des Ajouts (Mise à Jour)

---

### 2026-05-09 — Session 4 (Validations)

- **Ajout** : `M` validé pour les armes à 1 main (choix `MG`/`MD` côté client).
- **Ajout** : `Tr` validé pour les armes lourdes (format `2M/Tr`).
- **Ajout** : Les armes avec "Pistolet" dans le nom → `location = 'M'`.
- **Ajout** : Problème de syntaxe SQL identifié (chaîne de caractères ouverte).
2026-05-09 — Session 6 (Clarifications Saar)


Ajout : mod_compat existe dans ref_equipment mais ne sert PAS pour le lien armes/munitions.

→ Le champ caliber est le SEUL champ valide pour la compatibilité armes/munitions.
→ mod_compat est réservé pour les accessoires/modificateurs (ex: Silencieux, Analyseur tactique).

(Hors scope pour le Chantier 10 Sprint 4 — Module Armes Équipées).


Ajout : 2M = Tr (pas de distinction entre armes à 2 mains et trépieds).

→ Les armes avec location = '2M' incluent déjà les armes nécessitant un trépied.
→ Pas besoin de requires_tripod ou de location = '2M/Tr'.


Ajout : Accessoires pour armes (Silencieux, etc.) :

Hors scope pour le Chantier 10 Sprint 4.
→ mod_compat sera utilisé pour ce cas d'usage dans un chantier futur.


Ajout : Règle absolue :

Ne JAMAIS supposer → Toujours vérifier (ex: existence de champs, valeurs en BDD).

2026-05-09 — Session 7 (Clarifications Saar)


Ajout : caliber est le SEUL champ valide pour déterminer le type de munition compatible avec une arme.

→ GP-C1 est un test incomplet (munition pour arme à énergie).
**→ Si caliber est NULL ou incorrect en BDD, la solution est de corriger la BDD, pas d'ajouter des règles alternatives (ex: utiliser name).
→ Aucune exception : Toujours utiliser caliber.


Ajout : Accessoires pour armes (Silencieux, etc.) :

Hors scope pour le Chantier 10 Sprint 4.
→ mod_compat est réservé pour ce cas d'usage dans un chantier futur.


Ajout : 2M ne couvre PAS les trépieds.

→ 2M = armes à 2 mains uniquement.
→ Les trépieds sont gérés séparément (à clarifier ultérieurement).


Ajout : Rechargement des armes :

Logique :

Au clic sur le bouton "Recharger", le script cherche les munitions compatibles équipées (via caliber).
Rechargement partiel possible si la quantité disponible est insuffisante.
Si aucune munition compatible n'est disponible → Échec silencieux (pas de message d'erreur, pas de rechargement).

→ Pas de sélection manuelle via une liste déroulante "Munitions" :

La liste déroulante "Munitions" permet de sélectionner le type de munitions compatible avec l'arme (ex: pour afficher les stats), mais le rechargement utilise automatiquement les munitions équipées compatibles.


## 2.5 Champs Validés pour le Lien Armes/Munitions
- **`caliber`** : SEUL champ valide pour le lien armes/munitions.
  - **Règle absolue** : Si `caliber` est `NULL`, **corriger la BDD** (pas de fallback).
  - **Exemple** : FAV 34 → `caliber = '5,56 mm'` (voir image).

## 2.6 Localisation des Armes
- **`M`** : Armes à 1 main (ex: Pistolet).
- **`2M`** : Armes à 2 mains.
- **`Tr`** : Armes nécessitant un trépied (**traitées comme `2M` pour ce chantier**).

## 2.7 Rechargement des Armes
- **Logique** :
  1. Sélectionner une arme (filtre : `location = 'M'`/`'2M'`/`'Tr'` + `container != 'Coffre'`).
  2. Importer son `caliber` pour filtrer les munitions compatibles.
  3. Sélectionner une munition (filtre : `caliber = caliber_de_l'arme` + `container != 'Coffre'`).
  4. **Rechargement automatique** via les munitions équipées compatibles.
     - **Partiel autorisé** si quantité insuffisante.
     - **Échec silencieux** si aucune munition disponible.

## 2.8 Trépieds
- **`location = 'Tr'`** : Valide pour les armes nécessitant un trépied.
- **Traitement** : **Équivalent à `2M`** pour ce chantier (exclusion mutuelle avec `MG`/`MD`).
2026-05-09 — Session 8 (Résultats des Requêtes SQL)

1. Vérification des Munitions sans caliber (Q1.1)

Requête exécutée :
sql
Copier

SELECT id, name, family, caliber FROM ref_equipment WHERE family = 'Munitions' AND caliber IS NULL;




Résultat : 0 lignes retournées ✅

Implication : Toutes les munitions ont un caliber valide.
Action : Aucune correction nécessaire.


2. Vérification des Armes avec location = 'AR' ou NULL (Q1.2)

Requête exécutée :
sql
Copier

SELECT id, name, category, location FROM ref_equipment WHERE family = 'Armes' AND (location = 'AR' OR location IS NULL);




Résultat : 16 lignes retournées ⚠️

Toutes les lignes concernent des Accessoires pour armes (ex: Silencieux, Trépied, Analyseur tactique).
Aucune arme "classique" (Fusil, Pistolet, etc.) n'a location = NULL ou AR.
Implication :

Les accessoires n'ont pas de location (logique, car ils ne sont pas équipés comme des armes).
Les armes "classiques" ont déjà une location valide (M ou 2M).

Action : Aucune correction nécessaire pour les armes.

Les accessoires resteront avec location = NULL (hors scope pour ce chantier).



3. Clarification sur les Trépieds (Q4.1 et Q4.2)

location = 'Tr' existe pour les armes nécessitant un trépied.
Pour ce chantier, Tr = 2M :

Les armes avec location = 'Tr' sont traitées comme des armes à 2 mains.
Exclusion mutuelle : Si une arme a location = 'Tr', elle désactive MG et MD dans l'UI.


4. État des Armes Existantes

Aucune arme n'a de munition équipée (current_ammo n'existe pas encore).

Implication : La Migration 52 (current_ammo) initialisera ce champ à NULL par défaut.
Action : Pas besoin de mettre à jour les armes existantes (elles commenceront avec current_ammo = NULL).


🔍 Mise à Jour des Zones d'Ombre


  
    
      Zone d'Ombre
      Statut
      Source
      Action
    
  
  
    
      Munitions sans caliber
      ✅ Résolu
      Q1.1 (0 lignes)
      Aucune.
    
    
      Armes avec location = 'AR' ou NULL
      ✅ Résolu
      Q1.2 (accessoires uniquement)
      Aucune correction pour les armes.
    
    
      Trépieds (location = 'Tr')
      ✅ Résolu
      Q4.1 et Q4.2
      Traiter comme 2M.
    
    
      Initialisation de current_ammo
      ✅ Résolu
      Votre validation
      NULL par défaut.
    
  2026-05-09 — Session 9 (Planification Finalisée pour Chantier 10 Sprint 4)

1. Données Validées (Sources de Vérité)


ref_equipment :

caliber : SEUL champ valide pour le lien armes/munitions. Toutes les munitions ont un caliber valide (0 NULL vérifié via SQL).
location :

Armes : M (1 main), 2M (2 mains), Tr (trépied, traité comme 2M).
Accessoires : NULL (hors scope pour ce chantier).



char_inventory :

current_ammo : À ajouter via Migration 52 (UUID, FK vers ref_equipment.id, ON DELETE SET NULL).
Initialisation : NULL par défaut pour les armes existantes.


2. Constantes (armorConstants.js)
À ajouter :
javascript
Copier

export const LOCATION_TO_SLOT = {
  ...LOCATION_TO_SLOT, // Existantes
  main_gauche: 'MG',
  main_droite: 'MD',
  deux_mains: '2M',
  tripode: 'Tr', // Traité comme '2M' pour ce chantier
};

export const SLOT_TO_REF_LOCATION = {
  ...SLOT_TO_REF_LOCATION, // Existantes
  MG: 'M',
  MD: 'M',
  '2M': 'M',
  Tr: 'M', // 'Tr' mappe à 'M' pour compatibilité
};




3. Spécifications Fonctionnelles


Sélection des armes :

Filtre : family = 'Armes' + location IN ('M', '2M', 'Tr') + container != 'Coffre'.
Action : Importer caliber, damage_h, range, fire_mode.


Sélection des munitions :

Filtre : family = 'Munitions' + caliber = caliber_de_l'arme + container != 'Coffre'.
Action : Afficher les stats (pas de sélection manuelle pour le rechargement).


Rechargement :

Automatique via munitions équipées compatibles.
Partiel autorisé si quantité disponible < ammo_count.
Échec silencieux si aucune munition disponible.


Validation serveur :

Vérifier que weapon.caliber === ammo.caliber pour current_ammo.


4. Planification des Tâches


  
    
      Étape
      Description
      Livrable
      Statut
    
  
  
    
      1
      Vérification des données BDD
      Résultats SQL validés
      ✅ Terminé
    
    
      2
      Mise à jour de J_ARMES.md
      Documentation complète
      ✅ Terminé
    
    
      3
      Migration 52 (current_ammo)
      Fichier SQL 52_add_current_ammo_to_inventory.js
      ⏳ Prêt
    
    
      4
      Modifications de armorConstants.js
      Code des constantes
      ⏳ Prêt
    
    
      5
      Backend (validation current_ammo)
      Spécifications API
      ⏳ Prêt
    
    
      6
      Frontend (WeaponPanel.jsx)
      Spécifications UI
      ⏳ Prêt
    
  



5. Risques et Mitigations


  
    
      Risque
      Mitigation
      Statut
    
  
  
    
      Incompatibilité current_ammo
      Validation serveur via caliber
      ✅ Planifié
    
    
      Rechargement partiel non géré
      Logique côté client : min(ammo_count, quantité_disponible)
      ✅ Planifié
    
    
      Trépieds non gérés
      Tr traité comme 2M
      ✅ Planifié
    
  



Fin de la mise à jour.



