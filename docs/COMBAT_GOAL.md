# COMBAT_FINAL_GOAL.md — Cible Finale du Système de Combat
> **Statut** : DRAFT (À valider par Saar)
> **Objectif** : Définir **exactement** ce que le système de combat doit être à la fin du Chantier 11,
> pour **anticiper les bases de données, les formats, et les dépendances**.
> **Règle** : Ce document décrit **uniquement la cible finale**, pas les étapes d’implémentation.

---

---
## 🎯 **1. Vue d’Ensemble (Cible Finale)**
Le système de combat d’Enclume doit permettre de :
1. **Gérer des Tours** avec **2 Phases** (ANNONCE → RÉSOLUTION).
2. **Déclarer des intentions** (Déplacement, Attaque, Micro-actions) en Phase ANNONCE.
3. **Résoudre les actions** dans l’ordre en Phase RÉSOLUTION (Initiative décroissante).
4. **Appliquer des modificateurs** (Compétence, Portée, Circonstances) **uniquement en Phase RÉSOLUTION**.
5. **Gérer les exclusivités** (ex: Déplacement >3m bloque les autres actions, sauf micro-actions ≤ -3INI).
6. **Calculer les dégâts** et appliquer les blessures.

---
---
## 📋 **2. Fonctionnalités Finales (Liste Exhaustive)**

---
### **2.1 Gestion des Tours et Phases**
   **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Tours** | Un combat est divisé en **Tours** (1, 2, 3...). | `combat_sessions.round` | `INTEGER` |
 | **Phases** | Chaque Tour a **2 Phases** : ANNONCE (croissant) → RÉSOLUTION (décroissant). | `combat_sessions.current_phase` | `ENUM('ANNONCE', 'RESOLUTION')` |
 | **Passage entre Phases** | Le GM passe manuellement de ANNONCE à RÉSOLUTION, puis au Tour suivant. | `PUT /api/combat/sessions/:id/phase` | `{ next_phase: "ANNONCE" | "RESOLUTION" }` |
 | **Bouton "Passer"** | Le GM peut **passer le tour d’un PJ** qui n’a pas annoncé. | `POST /api/combat/sessions/:id/skip-turn` | `{ participant_id: "UUID" }` |

---
### **2.2 Sélection des Participants**
 | **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Pop-up GM** | Le GM sélectionne les **acteurs présents sur la carte** (tous pré-cochés par défaut). | `combat_participants` | Liste des `character_id`/`token_id` |
 | **État "Surpris"** | Pour les PJ, **test de REA** (Seuil - Dé). Si échec → `is_surprised: true` (ne peut pas agir au Tour 1). | `combat_participants.is_surprised`, `combat_participants.surprise_roll` | `BOOLEAN`, `INTEGER` |
 | **Lancement du Combat** | Crée une `combat_session` avec les participants sélectionnés. | `POST /api/combat/sessions` | `{ campaign_id, battlemap_id, participant_ids[] }` |

---
## 🎯 **2.3 Initiative : Calcul et Logique (Cœur du Système)**
> **Objectif de la Phase ANNONCE** :
> **1. Obtenir les intentions de l’acteur** (quelles actions veut-il faire ?).
> **2. Calculer son Initiative finale** (en fonction de ces actions).
> **→ L’Initiative finale détermine l’ordre des actions en Phase RÉSOLUTION.**

---
### **2.3.1 Définition de l’Initiative**
   **Concept** | **Description** | **Exemple** |
 |-------------|-----------------|-------------|
 | **Initiative de Base** | Valeur **statique** = **stat `REA`** (Réaction) de la fiche perso. | REA = 14 → Initiative de Base = 14. |
 | **Modificateurs d’Initiative** | **Bonus/Malus** appliqués en fonction des **actions annoncées** en Phase ANNONCE. | "Se précipiter" → **+3 Initiative**. |
 | **Initiative Finale** | `Initiative de Base + Σ(Modificateurs d’Initiative des actions annoncées)`. | Base 14 + "Se précipiter" (+3) = **17**. |
 | **Ordre des Actions** | **Phase ANNONCE** : Ordre **croissant** (les plus lents annoncent en premier). <br> **Phase RÉSOLUTION** : Ordre **décroissant** (les plus rapides agissent en premier). | Initiative 17 agit avant Initiative 15. |

---
### **2.3.2 Comment les Actions Impactent l’Initiative**
> **Règle fondamentale** :
> **Seules les actions qui ont un impact sur l’Initiative modifient sa valeur.**
> Les autres actions (ex: "Déplacement long", "Attaquer") **n’ont pas d’impact direct sur l’Initiative**, mais peuvent être **exclusives** ou **générer des actions multiples**.
 | **Action** | **Impact sur l’Initiative** | **Exclusivité** | **Exemple** |
 |------------|-----------------------------|-----------------|-------------|
 | **Déplacement court (0-3m)** | **-3 Initiative** | ❌ Non exclusive | Initiative = 14 → **11**. |
 | **Déplacement long (>3m)** | **Aucun impact** (0) | ✅ **Action exclusive** (sauf micro-actions ≤ -3INI) | Initiative reste **14**, mais bloque les autres actions (sauf micro-actions). |
 | **Se précipiter** | **+3 Initiative** | ❌ Non exclusive | Initiative = 14 → **17**. |
 | **Attaquer (simple)** | **Aucun impact** (0) | ❌ Non exclusive | Initiative reste **14**. |
 | **Attaque multiple (2)** | **Aucun impact direct**, mais **génère 2 actions** à **Initiative-5** et **Initiative-10**. | ❌ Non exclusive (mais les 2 actions sont espacées) | Initiative = 14 → Actions à **14**, **9**, et **4**. |
 | **Dégainer une arme** | **-3 Initiative** (micro-action) | ❌ Toujours autorisée (même avec une action exclusive) | Initiative = 14 → **11**. |
 | **Retarder son action** | **Aucun impact** (0) | ✅ **Action exclusive** (reporté à la V2) | Initiative reste **14**, mais agit plus tard. |

---
### **2.3.3 Calcul de l’Initiative Finale (Formule)**
```javascript
// 1. Initiative de Base (stat REA de la fiche perso)
const initiativeBase = character.attributes.REA.value;

// 2. Somme des Modificateurs d’Initiative des actions annoncées
const initiativeMods = actions.reduce((sum, action) => {
  if (action.impactsInitiative) {
    return sum + action.initiative_mod; // Ex: +3 pour "Se précipiter", -3 pour "Déplacement court"
  }
  return sum;
}, 0);

// 3. Initiative Finale
const initiativeFinal = initiativeBase + initiativeMods;



Exemples concrets :


  
    
      Actions Annoncées
      Initiative de Base
      Modificateurs
      Initiative Finale
      Actions Générées en RÉSOLUTION
    
  
  
    
      Déplacement court
      14
      -3
      11
      1 action à Initiative 11.
    
    
      Se précipiter + Attaquer
      14
      +3
      17
      1 action à Initiative 17.
    
    
      Attaque multiple (2)
      14
      0
      14
      2 actions à Initiative 14 et 9 (14-5).
    
    
      Déplacement long + Dégainer
      14
      -3 (Dégainer)
      11
      1 action "Déplacement long" à 11 + 1 micro-action "Dégainer" à 11.
    
    
      Déplacement court + Attaquer
      14
      -3
      11
      2 actions à Initiative 11.
    
  



2.3.4 Actions Exclusives vs. Non-Exclusives


  
    
      Type
      Définition
      Impact sur l’Initiative
      Autres Actions Autorisées ?
      Exemple
    
  
  
    
      Non-exclusive
      Action qui n’empêche pas d’autres actions.
      Peut modifier l’Initiative (ex: +3, -3).
      ✅ Oui
      "Se précipiter", "Déplacement court", "Attaquer".
    
    
      Exclusive
      Action qui bloque les autres actions (sauf micro-actions ≤ -3INI).
      Aucun impact sur l’Initiative (0).
      ❌ Non (sauf micro-actions)
      "Déplacement long", "Retarder son action" (V2).
    
    
      Micro-action
      Action toujours autorisée, même avec une action exclusive.
      Peut modifier l’Initiative (ex: -3).
      ✅ Toujours
      "Dégainer une arme", "Saisir un objet à portée".
    
  



Règle clé :

Une action exclusive (ex: Déplacement long) bloque toutes les autres actions, sauf les micro-actions (ex: Dégainer).
Une micro-action peut toujours être ajoutée, même avec une action exclusive.


2.3.5 Actions Multiples (Ex: Attaque Multiple)


  
    
      Action
      Description
      Impact sur l’Initiative
      Actions Générées en RÉSOLUTION
    
  
  
    
      Attaque multiple (2)
      Le joueur annonce 2 attaques.
      Aucun impact direct sur l’Initiative de base.
      2 actions à Initiative et Initiative-5.
    
    
      Attaque multiple (3)
      Le joueur annonce 3 attaques.
      Aucun impact direct sur l’Initiative de base.
      3 actions à Initiative, Initiative-5, et Initiative-10.
    
    
      Enchaînement (2 attaques)
      1ère à +0, 2ème à -3.
      Aucun impact direct sur l’Initiative de base.
      2 actions à Initiative et Initiative-3.
    
  



Logique :

Le joueur annonce une "Attaque multiple (2)" en Phase ANNONCE.
En Phase RÉSOLUTION, le système génère automatiquement 2 actions :

1ère action : Initiative finale (ex: 14).
2ème action : Initiative finale - 5 (ex: 9).

Modificateur de Compétence : -5 (appliqué à toutes les attaques du Tour).


2.3.6 Résumé des Règles de la Phase ANNONCE

Le joueur choisit ses actions dans le questionnaire.
Chaque action peut :

Modifier l’Initiative (ex: "Se précipiter" +3, "Déplacement court" -3).
Être exclusive (ex: "Déplacement long" bloque les autres actions, sauf micro-actions).
Générer des actions multiples (ex: "Attaque multiple (2)" → 2 actions en RÉSOLUTION).

L’Initiative finale est calculée :

Initiative Finale = Initiative de Base (REA) + Σ(Modificateurs d’Initiative des actions annoncées).
Les actions sont triées :

Phase ANNONCE : Ordre croissant (les plus lents annoncent en premier).
Phase RÉSOLUTION : Ordre décroissant (les plus rapides agissent en premier).



---
## **2.4 Déclaration des Actions (Phase ANNONCE)**
 | **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Types d’Actions** | `MOVE`, `ATTACK`, `DRAW_WEAPON`, `GRAB_OBJECT`, `DELAY`, `PREPARE`. | `combat_actions.action_type` | `ENUM` |
 | **Déplacement** | Le joueur clique sur la carte pour définir `target_coords`. | `combat_actions.target_coords` | `JSONB {x, y, z}` | **Attaque** | Le joueur clique sur une cible pour définir `target_id`. | `combat_actions.target_id` | `UUID` |
 | **Micro-actions** | Toujours autorisées (ex: Dégainer (-3INI), Saisir à portée (-3INI)). | `combat_actions.is_micro_action`, `combat_actions.micro_action_init_mod` | `BOOLEAN`, `INTEGER` |
 | **Exclusivités** | Déplacement >3m = **action exclusive** (sauf micro-actions ≤ -3INI). | `combat_actions.is_exclusive` | `BOOLEAN` |
 | **Ghost Tokens** | Affichage des intentions de déplacement en Phase ANNONCE. | `target_coords` | `JSONB` |
 | **Aura de Portée** | Affichage de la portée de l’arme (basée sur `ref_equipment.range`). | `ref_equipment.range` | `VARCHAR` (ex: "M", "L") |
 | **Raycast** | Ligne de vue affichée (sans blocage). | `Three.js Raycaster` | - |

---
## **2.5 Résolution des Actions (Phase RÉSOLUTION)**
 | **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Ordre de Résolution** | Actions résolues par **Initiative décroissante**. | `ORDER BY initiative_final DESC` | - |
 | **Vérification de Validité** | En Phase RÉSOLUTION : vérifie **portée** (via `ref_equipment.range`) et **ligne de vue** (Raycast). | `range_mod`, `Three.js Raycaster` | `INTEGER`, `BOOLEAN` |
 | **Échec Automatique** | Si cible **hors portée** ou **hors ligne de vue** → Action **forcément ratée** (mais **exécutée** : perte de munitions). | `combat_actions.status = 'FAILED'` | `VARCHAR` |
 | **Annulation des Intents** | Si `Target.Health < Dead` → Annuler ses **Intents restants**. | `characters.health` | `INTEGER` |

---
## **2.6 Modificateurs (Phase RÉSOLUTION uniquement)**
 | **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Modificateurs de Compétence** | Ex: "Attaque multiple" (-5), "Cible en mouvement" (-2). | `combat_actions.competence_mod` | `INTEGER` |
 | **Modificateurs de Portée** | Bout portant (+5), Moyenne (-5), Longue (-10), Extrême (-15). | `combat_actions.range_mod` | `INTEGER` |
 | **Modificateurs de Circonstances** | Taille de la cible, Obscurité, Couverture. | `combat_actions.circumstance_mods` | `JSONB {obscurity: -3, cover: -2}` |
 | **Seuil (Target Number)** | `Seuil = Attribut + Compétence + Σ(Modificateurs_Situation + Modificateurs_Portée)`. | `combat_actions.target_number` | `INTEGER` |

---
## **2.7 Calcul des Dégâts**
 | **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Table de Conversion (Marge → Bonus)** | Marge 1-2: +0, 3-4: +1, 5-6: +2, ..., 35+: +9. | `combat_actions.marge_bonus` | `INTEGER` |
 | **Dégâts Bruts** | `Weapon_Damage + Marge_Bonus`. | `combat_actions.raw_damage` | `INTEGER` |
 | **Dégâts Nets** | `(Weapon_Damage + Marge_Bonus) - (Armor_Loc + Resistance_Cible)`. | `combat_actions.net_damage` | `INTEGER` |
 | **Application des Blessures** | Utilise `POST /char-sheet/:id/wounds`. | `characters_wounds` | Table existante |

---
## **2.8 Retarder son Action (V2)**
 | **Fonctionnalité** | **Description** | **Données Nécessaires** | **Format** |
 |--------------------|-----------------|-------------------------|------------|
 | **Bouton "Intervenir"** | En Phase RÉSOLUTION, le joueur clique pour **fixer son Initiative** = Initiative de l’acteur en cours. | `combat_participants.initiative_final` | `INTEGER` |
 | **Ordre d’Action** | Agit **juste après** l’acteur en cours (sans interrompre). | `ORDER BY initiative_final DESC` | - |
 | **Alternative MJ** | Le MJ peut **déplacer manuellement** la fenêtre d’intervention. | `PUT /api/combat/participants/:id/initiative` | `{ initiative_final: NEW_VALUE }` |

---
---
## 🗃️ **3. Modèle de Données Final (Tables SQL)**
*(Toutes les tables et champs nécessaires pour la cible finale)*

---
### **3.1 Tables Principales**
```sql
-- 1. Sessions de combat
CREATE TABLE combat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  battlemap_id UUID NOT NULL REFERENCES battlemaps(id),
  status VARCHAR(20) NOT NULL DEFAULT 'IDLE', -- 'IDLE', 'ANNONCE', 'RESOLUTION'
  round INTEGER NOT NULL DEFAULT 1,
  current_phase VARCHAR(20) NOT NULL DEFAULT 'ANNONCE',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Participants au combat
CREATE TABLE combat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_session_id UUID NOT NULL REFERENCES combat_sessions(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id), -- NULL si entité (non-character)
  token_id UUID REFERENCES tokens(id), -- NULL si character
  is_surprised BOOLEAN NOT NULL DEFAULT false,
  initiative_base INTEGER, -- Valeur de REA (pour les characters)
  initiative_final INTEGER, -- initiative_base + Σ(initiative_mod)
  surprise_roll INTEGER, -- Résultat du dé20 pour le test de surprise (NULL si PNJ)
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'DEFEATED'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(combat_session_id, character_id),
  UNIQUE(combat_session_id, token_id)
);

-- 3. Actions de combat
CREATE TABLE combat_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_session_id UUID NOT NULL REFERENCES combat_sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES combat_participants(id),
  action_type VARCHAR(20) NOT NULL, -- "MOVE", "ATTACK", "DRAW_WEAPON", "GRAB_OBJECT", "DELAY", "PREPARE"
  target_id UUID, -- UUID de la cible (pour ATTACK)
  target_coords JSONB, -- {x, y, z} pour MOVE ou tir sur zone
  initiative_mod INTEGER DEFAULT 0, -- Modificateur d’Initiative (ex: +3 pour "Se précipiter")
  competence_mod INTEGER DEFAULT 0, -- Modificateur de Compétence (ex: -5 pour "Attaque multiple")
  range_mod INTEGER DEFAULT 0, -- Modificateur de Portée (ex: -5 pour "Moyenne portée")
  damage_mod INTEGER DEFAULT 0, -- Modificateur de Dégâts (ex: +3 pour "Frappe puissante")
  is_exclusive BOOLEAN DEFAULT false, -- true si action exclusive (ex: déplacement >3m)
  is_micro_action BOOLEAN DEFAULT false, -- true si micro-action (ex: Dégainer)
  micro_action_init_mod INTEGER DEFAULT 0, -- Modificateur d’Initiative pour les micro-actions (ex: -3)
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- "PENDING", "RESOLVED", "FAILED", "SKIPPED"
  target_number INTEGER, -- Seuil (Attribut + Compétence + Modificateurs)
  marge_bonus INTEGER, -- Bonus de la table Marge → Dégâts (ex: +3)
  raw_damage INTEGER, -- Dégâts bruts (Weapon_Damage + Marge_Bonus)
  net_damage INTEGER, -- Dégâts nets (raw_damage - Armor - Resistance)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Index pour les performances
CREATE INDEX idx_combat_sessions_campaign ON combat_sessions(campaign_id);
CREATE INDEX idx_combat_sessions_phase ON combat_sessions(current_phase);
CREATE INDEX idx_combat_participants_session ON combat_participants(combat_session_id);
CREATE INDEX idx_combat_participants_initiative ON combat_participants(initiative_final);
CREATE INDEX idx_combat_actions_session ON combat_actions(combat_session_id);
CREATE INDEX idx_combat_actions_participant ON combat_actions(participant_id);
CREATE INDEX idx_combat_actions_initiative ON combat_actions(initiative_mod);