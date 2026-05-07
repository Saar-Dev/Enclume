.)
markdown
Copier

# Étape 1 : Design — Module Inventaire (Migration 50)
> **Source de vérité** : Aligné sur `SCHEMA_EQUIPMENT.md`, `PLAN_EQUIPMENT.md`, et discussions avec Saar (2026-05-07).
> **Statut** : Validé pour passage à l'Étape 2 (Planification de la conception).
> **Dernière mise à jour** : 2026-05-07 (Session 49).

---

## 1. Contexte
### 1.1 Objectif
Implémenter un **système d'inventaire** pour les personnages du VTT Enclume, inspiré de `50_Inventory_WebApp.txt` (Google Apps Script + Sheets), mais **adapté à la stack Enclume** :
- **Backend** : PostgreSQL (tables SQL) + Node.js/Express.
- **Frontend** : React 19 + Zustand.
- **Synchronisation** : WebSocket (Socket.io) pour les mises à jour temps réel.

### 1.2 Périmètre
- **Création de la table `char_inventory`** : Lier les items (`ref_equipment`) aux personnages (`characters`), avec gestion des **conteneurs** et **slots d'équipement**.
- **Intégration avec les règles Polaris** :
  - Calcul des **protections par zone** (moteur "Mille-feuille").
  - Gestion de l'**encombrement** (malus global basé sur le poids).
- **Pas de modification** de `ref_equipment` (déjà déployée et seedée en Migration 48).

---

## 2. Architecture Actuelle (À Connaître)
### 2.1 Tables Existantes
   Table | Rôle | Statut |
 |-------|------|--------|
 | `ref_equipment` | Catalogue statique des équipements (armes, armures, etc.). **636 items seedés**. | ✅ Déployée (Migration 48) |
 | `ref_equipment_skills` | Junction : `ref_equipment` ↔ compétences boostées/requises. | ✅ Déployée |
 | `ref_equipment_skill_assoc` | Junction : `ref_equipment` ↔ compétences d'utilisation. | ✅ Déployée |
 | `ref_equipment_ammo_compat` | Junction : compatibilité munitions/armes. | ✅ Déployée |
 | `characters` | Fiches personnages. | ✅ Existante |

**Source** : `SCHEMA_EQUIPMENT.md`, `JOURNALBDD.md` (Session 8).

---

## 3. Design Proposé pour `char_inventory`
### 3.1 Table SQL
```sql
CREATE TABLE char_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES ref_equipment(id) ON DELETE SET NULL,
    container VARCHAR(50) NOT NULL DEFAULT 'Coffre',
    slot VARCHAR(50) NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    custom_name VARCHAR(255) NULL,
    custom_desc TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_char_inventory_character_id ON char_inventory(character_id);
CREATE INDEX idx_char_inventory_equipment_id ON char_inventory(equipment_id);
CREATE INDEX idx_char_inventory_slot ON char_inventory(slot) WHERE slot IS NOT NULL;



3.2 Colonnes : Définitions et Règles


  
    
      Colonne
      Type
      Description
      Contraintes
    
  
  
    
      id
      UUID
      Clé primaire.
      DEFAULT gen_random_uuid()
    
    
      character_id
      UUID
      FK vers characters.id.
      NOT NULL, ON DELETE CASCADE
    
    
      equipment_id
      UUID
      FK vers ref_equipment.id.
      NULL si objet manuel (non catalogué). ON DELETE SET NULL
    
    
      container
      VARCHAR(50)
      Conteneur où l'objet est stocké.
      NOT NULL, DEFAULT 'Coffre'. Valeurs autorisées : ['Sac', 'Ceinture', 'Coffre', 'Main droite', 'Main gauche', 'Poche'] (enum côté code).
    
    
      slot
      VARCHAR(50)
      Slot d'équipement (ex: Torse, Main droite).
      NULL = objet non équipé. slot IS NOT NULL ≡ équipé.
    
    
      quantity
      INTEGER
      Quantité (pour les stacks).
      NOT NULL, DEFAULT 1, CHECK (quantity > 0)
    
    
      custom_name
      VARCHAR(255)
      Nom personnalisé (si différent du catalogue).
      NULL
    
    
      custom_desc
      TEXT
      Description personnalisée.
      NULL
    
    
      notes
      TEXT
      Notes du joueur.
      NULL
    
    
      created_at
      TIMESTAMP
      Date de création.
      NOT NULL, DEFAULT NOW()
    
    
      updated_at
      TIMESTAMP
      Date de dernière modification.
      NOT NULL, DEFAULT NOW()
    
  


3.3 Règles Métier
3.3.1 Conteneurs (container)

Valeurs statiques : Gérées via un enum côté code (pas de table dédiée).

Exemple (JavaScript) :
javascript
Copier

const ALLOWED_CONTAINERS = ['Sac', 'Ceinture', 'Coffre', 'Main droite', 'Main gauche', 'Poche'];





Validation :

Côté serveur : Vérifier que container ∈ ALLOWED_CONTAINERS.
Côté client : <select> limité aux valeurs autorisées.

3.3.2 Slots (slot)

Valeurs dynamiques : Dépendent de ref_equipment.locations.

Exemple : Si ref_equipment.locations = "T/C" (Torse/Corps), alors slot ne peut être que Torse ou Corps.

Validation :

Côté serveur : Vérifier que slot est dans la liste des localisations autorisées pour equipment_id.
Côté client : Filtrer les slots proposés en fonction de ref_equipment.locations.

Équipement :

slot IS NOT NULL = objet équipé.
slot = NULL = objet en inventaire (non équipé).

3.3.3 Stackabilité

Les objets identiques (equipment_id) dans le même container peuvent être fusionnés (mise à jour de quantity).
Exception : Les objets équipés (slot IS NOT NULL) ne peuvent pas être stackés.
3.3.4 Poids et Encombrement

Poids total :
sql
Copier

SELECT SUM(e.weight * i.quantity)
FROM char_inventory i
JOIN ref_equipment e ON i.equipment_id = e.id
WHERE i.character_id = '...';




Malus d'encombrement :

Utiliser ref_equipment.malus_cat (S, A, B, C, D) pour appliquer un malus global (ex: -1 à toutes les compétences).
À intégrer avec le système de malus existant (cf. shared/woundConstants.js).

3.3.5 Protection "Mille-feuille"

Pour chaque zone du corps (ex: Torse), sommer les protection et protection_shock des armures équipées dans cette zone.
Requête exemple :
sql
Copier

SELECT
    i.slot,
    SUM(e.protection) AS total_protection,
    SUM(e.protection_shock) AS total_protection_shock
FROM char_inventory i
JOIN ref_equipment e ON i.equipment_id = e.id
WHERE i.character_id = '...' AND i.slot IS NOT NULL
GROUP BY i.slot;





4. Intégration avec Enclume
4.1 Lien avec char_sheet

Onglet "Matériel" :

Déjà mentionné comme livré en sprint 1 du Chantier 11 (EN_COURS.md).
Composant React : InventoryPanel.jsx (à créer).

Synchronisation :

Les malus d'encombrement (malus_cat) doivent être intégrés dans les jets Polaris (via calcWoundPenalty ou équivalent).

4.2 API REST


  
    
      Endpoint
      Méthode
      Description
      Payload
    
  
  
    
      /api/characters/:id/inventory
      GET
      Liste l'inventaire d'un personnage.
      { items: [...] }
    
    
      /api/characters/:id/inventory
      POST
      Ajoute un objet à l'inventaire.
      { equipment_id, container, slot, quantity, ... }
    
    
      /api/characters/:id/inventory/:itemId
      PUT
      Met à jour un objet.
      { container, slot, quantity, ... }
    
    
      /api/characters/:id/inventory/:itemId
      DELETE
      Supprime un objet.
      —
    
    
      /api/characters/:id/inventory/transfer
      POST
      Transfère un objet vers un autre personnage.
      { itemId, target_character_id, quantity }
    
  


4.3 WebSocket

Événements :

inventory:add : Nouvel objet ajouté.
inventory:update : Objet modifié (ex: changement de slot).
inventory:remove : Objet supprimé.
inventory:transfer : Objet transféré.

Broadcast :

Envoyer aux joueurs concernés (ex: GM + propriétaire de l'objet).


5. Pièges et Contraintes
5.1 Pièges Critiques (cf. SYSTEME.md)

P1 : Ne jamais utiliser token.owner_id. Toujours : token.character_id → characters.user_id.

Applicable ici : Toujours lier char_inventory à characters.id (pas à users.id).

P13 : updated_at doit être mis à jour après le guard Object.keys(updates).length === 0.
P49 : Pour les promotions de blessures, rechargement complet obligatoire.

Analogie : Si un objet est transféré, toujours recharger l'inventaire complet côté client.

5.2 Contraintes Techniques

UUID : Toutes les clés primaires en UUID v4.
Transactions :

Les opérations de transfert (inventory_transferItem) doivent être atomiques (ex: débiter l'inventaire source avant de créditer la cible).

Validation :

Toujours valider container et slot côté serveur (même si le frontend le fait).


6. Questions Ouvertes (À Valider en Étape 2)

Gestion des objets manuels (equipment_id = NULL) :

Faut-il autoriser la création d'objets non catalogués (ex: "Objet personnel") ?
Si oui, comment gérer leurs poids/protection (champs manuels) ?

Limite de quantité par stack :

Faut-il une limite maximale (ex: 99) pour quantity ?

Historique des modifications :

Faut-il une table char_inventory_history pour tracer les changements (ex: pour le GM) ?

Permissions :

Qui peut transférer des objets entre personnages ? (GM seulement ? Ou joueurs entre eux ?)

