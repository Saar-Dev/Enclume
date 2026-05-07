# **Plan d'Intégration des Blessures de Polaris dans Enclume**

**Version** : 1.0  
**Date** : 06/05/2026  
**Objectif** : Intégrer le système de blessures de Polaris dans le domaine **Character** du VTT Enclume, en respectant l'architecture existante, les conventions, et les flux de données.

---

---

## **📌 Sommaire**

1. [Contexte et Objectifs](#1-contexte-et-objectifs)
2. [Analyse de l'Architecture Existante](#2-analyse-de-larchitecture-existante)
  - [2.1. Structure du Projet Enclume](#21-structure-du-projet-enclume)
  - [2.2. Domaine Character](#22-domaine-character)
  - [2.3. Schéma SQL Existants](#23-schéma-sql-existants)
  - [2.4. Routes API Existantes](#24-routes-api-existantes)
  - [2.5. Composants React Existants](#25-composants-react-existants)
  - [2.6. Flux de Données et Ownership](#26-flux-de-données-et-ownership)
  - [2.7. Conventions et Pièges](#27-conventions-et-pièges)
3. [Spécifications Fonctionnelles des Blessures](#3-spécifications-fonctionnelles-des-blessures)
4. [Conception Technique](#4-conception-technique)
  - [4.1. Modèle de Données](#41-modèle-de-données)
  - [4.2. Routes API](#42-routes-api)
  - [4.3. Logique Métier](#43-logique-métier)
  - [4.4. Composants React](#44-composants-react)
  - [4.5. Intégration avec le Système de Combat](#45-intégration-avec-le-système-de-combat)
  - [4.6. WebSocket (Socket.io)](#46-websocket-socketio)
5. [Implémentation](#5-implémentation)
  - [5.1. Étapes Prioritaires](#51-étapes-prioritaires)
  - [5.2. Fichiers à Modifier/Créer](#52-fichiers-à-modifiercréer)
  - [5.3. Tests et Validation](#53-tests-et-validation)
6. [Risques et Points de Vigilance](#6-risques-et-points-de-vigilance)
7. [Annexes](#7-annexes)

---

---

---

## **1. Contexte et Objectifs**

### **1.1. Contexte**

Le projet **Enclume** est un VTT (Virtual Tabletop) en développement, structuré en **deux domaines indépendants** :

- **Domaine VTT** : Cartes, voxels, tokens, sessions, temps réel (déjà stable).
- **Domaine Character** : Fiche personnage (Polaris), compétences, inventaire, blessures, etc. (en cours de migration depuis Google Sheets vers PostgreSQL).

**Objectif** :  
Intégrer le **système de blessures de Polaris** (documenté précédemment) dans le domaine **Character**, en respectant :

- L’**architecture existante** (PostgreSQL, Express, React, Zustand).
- Les **conventions Enclume** (UUID, ownership, flux serveur → client).
- Les **règles métiers Polaris** (seuils, malus, Tests de Choc, stabilisation).

### **1.2. Objectifs Spécifiques**

1. **Stockage des blessures** :
  - Etendre `char_sheet` pour gérer les blessures
  - Gérer les **localisations** (Tête, Corps, Bras D/G, Jambe D/G) et **gravités** (Légère → Mortelle).
  - Implémenter la **promotion automatique** (si une ligne de gravité est pleine).
2. **Calcul des malus** :
  - Appliquer le **malus le plus élevé par localisation** (ex : -10 pour une blessure critique à la Tête).
  - Intégrer les malus dans les **calculs de compétences** (via `charStats.js` ou équivalent).
3. **Gestion des Tests de Choc** :
  - Déclencher les Tests de Choc pour les blessures **graves/critiques/mortelles**.
  - Appliquer les états **Étourdi/Inconscient/Coma** (durée, malus supplémentaires).
4. **Stabilisation** :
  - Assurer deux niveaux de blessures : normale ou stabilisée
5. **UI/UX** :
  - Créer un **composant React** pour afficher/modifier les blessures (tableau visuel comme dans Excel).
  - Intégrer les **interactions** (clic pour ajouter une blessure, double-clic pour stabiliser).
6. **Synchronisation** :
  - Utiliser **WebSocket** pour synchroniser les blessures entre clients (GM et joueurs).
  - Mettre à jour les **malus globaux** en temps réel.

---

---

## **2. Analyse de l'Architecture Existante**

---

### **2.1. Structure du Projet Enclume**

```bash
Enclume/
├── client/               # Frontend (React + Vite)
│   ├── src/
│   │   ├── [existant]     # Domaine VTT (Canvas3D, SessionPage, etc.)
│   │   ├── character/     # Nouveau domaine Character (à développer)
│   │   │   ├── components/ # Composants React (ex: WoundCounter.jsx)
│   │   │   ├── stores/     # Stores Zustand (ex: characterStore.js)
│   │   │   ├── lib/        # Logique métier (ex: charStats.js)
│   │   │   └── pages/      # Pages (ex: CharacterSheetPage.jsx)
│   │   └── App.jsx        # Routes principales
│   └── locales/           # i18n (fr.json, en.json)
│
├── server/               # Backend (Node.js + Express)
│   ├── src/
│   │   ├── [existant]     # Domaine VTT (routes, handlers, etc.)
│   │   ├── routes/
│   │   │   └── character/  # Nouvelles routes API (ex: wounds.js)
│   │   ├── db/
│   │   │   └── migrations/ # Migrations Knex (ex: char_001_wounds.js)
│   │   └── lib/           # Logique serveur (ex: charStatsServer.js)
│   └── knexfile.cjs      # Configuration Knex
│
├── shared/               # Code partagé (events.js, types, etc.)
└── docs/                 # Documentation (CHARACTER.md, ROADMAP_CHARACTER.md, etc.)
```

**Points clés** :

- **Monorepo** : Client (React) et Serveur (Express) partagent la même base **PostgreSQL**.
- **Domaine Character** :
  - **Nouveau** : Tout le code lié à la fiche personnage va dans `client/src/character/` et `server/src/routes/character/`.
  - **Lien avec le VTT** : `char_sheet.character_id → characters.id` (UUID).
  - **Authentification** : JWT partagé (cookie `httpOnly`).

---

### **2.2. Domaine Character**

#### **2.2.1. Contexte (d'après `JOURNAL2.md`)**

- **Origine** : Les modules Character existaient en **HTML/JS vanilla** connectés à **Google Sheets**.
- **Migration** : Tout est en train d’être migré vers **PostgreSQL** (pivot central).
- **Lien technique** :
  - `character_id` (UUID) remplace le `fid` (Google Sheets ID) dans tous les modules.
  - **Base partagée** : PostgreSQL + auth JWT partagée entre VTT et Character.

#### **2.2.2. Périmètre V1 (déjà implémenté)**

D’après `JOURNAL2.md`, les modules suivants sont **déjà en place** :

- **Module 1** : Identité (`char_identity`).
- **Module 2** : Archétype/Génotype (`char_archetype`).
- **Module 3** : Attributs primaires (`char_attributes`).
- **Module 4** : Attributs secondaires (calculés en JS, **pas en base**).
- **Module 5** : Compétences (`char_skills`).

**Hors scope V1** (à implémenter plus tard) :

- Inventaire, bourse, marchands, crafting, initiative, combat **détaillé**.

#### **2.2.3. Décisions d'Architecture**

- **PostgreSQL uniquement** : Pas de SQLite ou de standalone.
- **Composants React intégrés** : Pas d’iframe HTML.
- **Approche itérative** : Module par module.
- **Pas de recréation de `characters**` : Utilisation de la table existante (`char_sheet.character_id → characters.id`).
- **Migrations** : Format `.js` (convention **P30**).
- **UUID partout** (sauf exceptions documentées).
- **Données statiques** (génotypes, compétences) : Stockées en **base de données**.
- **Calculs** : **Côté client JS uniquement** (le serveur ne calcule rien).
- `**pc_modifier**` : Valeur agrégée en V1 (historique XP = futur module).

---

### **2.3. Schéma SQL Existants**

D’après `JOURNAL2.md`, les tables suivantes **existent déjà** pour le domaine Character :

#### **2.3.1. Tables de Référence (Statiques)**

```sql
-- Génotypes (ex: Humain, Kaelish, etc.)
CREATE TABLE ref_genotypes (
    id TEXT PRIMARY KEY,       -- ex: 'HUM', 'KAE'
    nom TEXT NOT NULL,
    FOR INT, CON INT, COO INT, ADA INT, PER INT, INT INT, VOL INT, PRE INT,
    -- Autres champs (modificateurs, etc.)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Compétences (catalogue complet)
CREATE TABLE ref_skills (
    id TEXT PRIMARY KEY,       -- ex: 'ATHLETISME', 'MEDECINE'
    nom TEXT NOT NULL,
    famille TEXT,              -- ex: 'Physique', 'Social'
    parent_id TEXT,            -- Pour les sous-compétences (NULL si racine)
    attributs TEXT[],          -- ex: ['FOR', 'COO']
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Exigences de compétences (pour débloquer des compétences)
CREATE TABLE ref_skill_requirements (
    skill_id TEXT REFERENCES ref_skills(id),
    type TEXT,                  -- ex: 'attribut', 'compétence'
    value TEXT,                -- ex: 'FOR', 'ATHLETISME'
    threshold INT,              -- Seuil requis
    PRIMARY KEY (skill_id, type, value)
);
```

#### **2.3.2. Tables Dynamiques (Par Personnage)**

```sql
-- Table pivot pour la fiche personnage
CREATE TABLE char_sheet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE, -- Lien avec le VTT
    chc INT DEFAULT 11,        -- Chance (1-20)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Module 1: Identité
CREATE TABLE char_identity (
    char_sheet_id UUID PRIMARY KEY REFERENCES char_sheet(id) ON DELETE CASCADE,
    player_name TEXT,           -- Nom du joueur
    char_name TEXT,             -- Nom officiel du personnage (≠ characters.name)
    height NUMERIC(4,1),        -- Taille en mètres
    weight NUMERIC(5,1),        -- Poids en kg
    skin TEXT, eyes TEXT, hair TEXT, build TEXT,
    distinctive_signs TEXT,
    hand_pref TEXT CHECK (hand_pref IN ('R', 'L', 'A')) -- Main dominante
);

-- Module 2: Archétype
CREATE TABLE char_archetype (
    char_sheet_id UUID PRIMARY KEY REFERENCES char_sheet(id) ON DELETE CASCADE,
    genotype_id TEXT REFERENCES ref_genotypes(id),
    age INT,
    sex TEXT,
    is_fertile BOOLEAN DEFAULT FALSE,
    origin_geo TEXT,             -- Origine géographique
    origin_soc TEXT,             -- Origine sociale
    training_base TEXT,          -- Formation de base
    higher_ed TEXT               -- Études supérieures
);

-- Module 3: Attributs primaires (8 + Chance)
CREATE TABLE char_attributes (
    char_sheet_id UUID REFERENCES char_sheet(id) ON DELETE CASCADE,
    attr_id TEXT NOT NULL CHECK (attr_id IN ('FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE')),
    base_level INT NOT NULL DEFAULT 7, -- Niveau de base (7-20+)
    pc_modifier INT DEFAULT 0,   -- Modificateur PC (Points de Compétence)
    PRIMARY KEY (char_sheet_id, attr_id)
);

-- Module 5: Compétences
CREATE TABLE char_skills (
    char_sheet_id UUID REFERENCES char_sheet(id) ON DELETE CASCADE,
    skill_id TEXT REFERENCES ref_skills(id),
    mastery INT DEFAULT 0,      -- Maîtrise (0+)
    is_learned BOOLEAN DEFAULT FALSE, -- Si la compétence est apprise
    PRIMARY KEY (char_sheet_id, skill_id)
);
```

#### **2.3.3. Ce qui n'existe pas en base (calculé en JS)**

- **Attributs secondaires** :
  - `REA = (ADA + PER) / 2`
  - `Initiative = REA` (valeur brute)
  - `Seuil Étourdissement = (FOR + CON + VOL) / 3`
  - `Seuil Inconscience = Seuil_Étour + 10`
  - `Vitesse Marche = (FOR + COO + ADA) / 3`
  - `Vitesse Course = Marche × 2`
  - `Mod_Dom` (Modificateur de Dégâts) : Table fixe si `FOR <= 21`, sinon `5 + floor((FOR - 21) / 2)`.
- **Scores de compétences** :
  - `Score Base = base_level (attribut) + modificateur génotype + modificateur PC`.
  - `Total = Score Base + mastery`.

---

### **2.4. Routes API Existantes**

D’après `JOURNAL2.md`, les routes suivantes **existent déjà** pour le domaine Character :

- `**GET /api/characters/:id/sheet**` : Récupérer la fiche complète d’un personnage.
- `**POST /api/characters/:id/sheet**` : Créer une fiche pour un personnage.
- `**PUT /api/characters/:id/sheet**` : Mettre à jour une fiche.
- `**GET /api/ref/genotypes**` : Lister les génotypes.
- `**GET /api/ref/skills**` : Lister les compétences.
- `**GET /api/characters/:id/attributes**` : Récupérer les attributs.
- `**PUT /api/characters/:id/attributes/:attr_id**` : Mettre à jour un attribut.

**À noter** :

- **Pas de route pour les blessures** (à implémenter).
- **Calculs côté client** : Le serveur ne fait **aucun calcul** (ex : malus, seuils). Tout est géré en JS dans le frontend.

---

### **2.5. Composants React Existants**

D’après `JOURNAL2.md`, les composants suivants **existent déjà** pour le domaine Character :

- `**CharacterSheetPage.jsx**` : Page principale de la fiche personnage.
- `**AttributeEditor.jsx**` : Éditeur d’attributs primaires.
- `**SkillList.jsx**` : Liste des compétences (avec calculs de scores).
- `**IdentityForm.jsx**` : Formulaire pour l’identité du personnage.
- `**ArchetypeForm.jsx**` : Formulaire pour l’archétype/génotype.

**Store Zustand** :

- `**characterStore.js**` : Gère l’état global de la fiche personnage (attributs, compétences, etc.).

**À noter** :

- **Pas de composant pour les blessures** (à créer).
- **Logique métier** : Centralisée dans `client/src/character/lib/charStats.js` (calculs des attributs secondaires, scores de compétences, etc.).

---

### **2.6. Flux de Données et Ownership**

#### **2.6.1. Ownership (Qui peut faire quoi ?)**


| Action               | Rôle Requit            | Vérification                                                                   |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Lire une fiche       | Joueur propriétaire    | `char_sheet.character_id → characters.user_id = req.user.id`                   |
| &nbsp;               | GM                     | `req.user.role === 'GM'`                                                       |
| Modifier une fiche   | Joueur propriétaire    | Idem + vérification `character_id`                                             |
| &nbsp;               | GM                     | Idem                                                                           |
| Ajouter une blessure | GM **ou** Propriétaire | À définir (probablement GM uniquement pour les blessures critiques/mortelles). |


#### **2.6.2. Flux de Données**

1. **Frontend (React)** :
  - Récupère les données via **API REST** (ex : `GET /api/characters/:id/sheet`).
  - Calcule les **attributs secondaires** et **scores de compétences** en JS.
  - Met à jour l’UI via **Zustand** (`characterStore`).
  - Émet des événements **WebSocket** pour la synchronisation temps réel (ex : `WOUND_ADDED`).
2. **Backend (Express)** :
  - **Ne calcule rien** : Se contente de stocker/retriever les données brutes.
  - **Valide les contraintes** (ex : `mastery >= 0`, `base_level` entre 7 et 20+).
  - **Broadcast WebSocket** : Envoie les mises à jour aux clients concernés (ex : GM et propriétaire).
3. **Base de Données (PostgreSQL)** :
  - Stocke les **données brutes** (ex : `char_attributes.base_level`).
  - **Pas de colonnes calculées** (tout est fait en JS).

#### **2.6.3. WebSocket (Socket.io)**

- **Événements existants** (d’après `SYSTEME.md`) :
  - `TOKEN_MOVED`, `ENTITY_STATE_CHANGED`, `DICE_RESULT` (domaine VTT).
- **À ajouter pour les blessures** :
  - `WOUND_ADDED` : Nouvelle blessure ajoutée.
  - `WOUND_STABILIZED` : Blessure stabilisée.
  - `WOUND_PROMOTED` : Promotion automatique (ligne pleine → niveau supérieur).
  - `SHOCK_TEST_REQUESTED` : Demande de Test de Choc (GM → joueur).
  - `SHOCK_TEST_RESULT` : Résultat du Test de Choc (joueur → GM).

**Ownership WebSocket** :

- Le serveur **ne push jamais** vers un client sans vérifier l’**ownership** (ex : un joueur ne reçoit que les blessures de **ses** personnages ou celles gérées par le GM).

---

### **2.7. Conventions et Pièges**

#### **2.7.1. Conventions Enclume (à respecter)**


| Convention               | Description                                                                              | Exemple                                            |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **UUID partout**         | Toutes les PK/FK sont des UUID (sauf exceptions documentées comme `voxel_textures.id`).  | `char_sheet.id = gen_random_uuid()`                |
| **Noms de tables**       | `snake_case`, préfixe `char_` pour le domaine Character.                                 | `char_wounds`, `char_identity`                     |
| **Noms de colonnes**     | `snake_case`, pas de `_id` pour les FK (sauf si nécessaire).                             | `character_id` (FK), `char_sheet_id` (FK)          |
| **Timestamps**           | `created_at` et `updated_at` sur toutes les tables dynamiques.                           | `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` |
| **Migrations**           | Format `.js`, nom `char_XXX_description.js` (préfixe `char_` pour le domaine Character). | `20260506_char_001_wounds.js`                      |
| **Routes API**           | `/api/characters/:id/...` pour les routes liées aux personnages.                         | `POST /api/characters/:id/wounds`                  |
| **Événements WebSocket** | `SCREAMING_SNAKE_CASE` dans `shared/events.js`.                                          | `WOUND_ADDED`, `SHOCK_TEST_REQUESTED`              |
| **Calculs**              | **Côté client uniquement** (sauf exceptions).                                            | `charStats.js` (frontend)                          |
| **i18n**                 | Toutes les chaînes visibles passent par `t()` (fichiers `locales/fr.json`).              | `t('wounds.light')` → "Légère"                     |
| **Ownership**            | Toujours vérifier `character.user_id === req.user.id` ou `req.user.role === 'GM'`.       | Middleware `requireCharacterOwnership`             |


#### **2.7.2. Pièges Critiques (d'après `SYSTEME.md` et `JOURNAL2.md`)**


| Piège   | Description                                                                                                     | Solution                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **P1**  | `token.owner_id` est mort → **toujours utiliser `token.character_id → characters.user_id**`.                    | Vérifier `characters.user_id` pour l’ownership.                                                       |
| **P2**  | `socket.data.role` inaccessible via `fetchSockets()` → **utiliser `socket.data.userId` et `socket.data.role**`. | Stocker `role` au `SESSION_JOIN`.                                                                     |
| **P11** | **Calculs côté serveur UNIQUEMENT** pour les dés → **les blessures aussi ?**                                    | À clarifier : Les malus de blessures sont calculés **côté client** (comme les attributs secondaires). |
| **PC1** | Pas de `_` final dans les `ref_skills.id`.                                                                      | Ex : `'ATHLETISME'` (OK), `'ATHLETISME_'` (❌).                                                        |
| **PC2** | `char_attributes` : **pas de colonnes calculées** (tout en JS).                                                 | `REA`, `Initiative`, etc. sont calculés dans `charStats.js`.                                          |
| **PC3** | `char_skills.mastery` peut être **négatif** (si malus).                                                         | Valider en frontend.                                                                                  |
| **PC7** | `ref_skills.id` : **pas de `_` final**.                                                                         | Respecter cette règle pour les nouvelles entrées.                                                     |


**Piège spécifique aux blessures** :

- **Ne pas recalculer les malus côté serveur** : Comme pour les attributs secondaires, les malus de blessures doivent être **calculés en JS** (frontend).
- **Synchronisation WebSocket** : Le serveur **broadcast** les changements (ex : `WOUND_ADDED`), mais **ne calcule pas** les malus.

---

---

## **3. Spécifications Fonctionnelles des Blessures**

*(Rappel : Voir la documentation complète dans `polaris-wounds-system-doc` pour les détails.)*

### **3.1. Résumé des Règles Métier**


| Concept            | Règle                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **Seuils**         | 5 (Légère), 10 (Moyenne), 15 (Grave), 20 (Critique), 25 (Mortelle), 30 (Mort/Membre détruit). |
| **Localisations**  | Tête, Corps, Bras D/G, Jambe D/G.                                                             |
| **Compteurs**      | Chaque localisation a un compteur indépendant (ex : Tête = 3 Légères, 3 Moyennes, etc.).      |
| **Promotion**      | Si une ligne est pleine → **1 case cochée dans la gravité supérieure** + ligne vidée.         |
| **Malus**          | Seul le **malus le plus élevé par localisation** est appliqué.                                |
| **Tests de Choc**  | Déclenchés pour les blessures **Graves/Critiques/Mortelles** (selon localisation).            |
| **Stabilisation**  | Obligatoire pour **Critiques/Mortelles/Membre détruit**. Échec → Mort ou aggravation.         |
| **États de santé** | Étourdi (-5 malus, allure moyenne), Inconscient (aucune action), Coma (réveil par test).      |


### **3.2. Données à Stocker**


| Donnée          | Type        | Description                                                                                  | Exemple                                |
| --------------- | ----------- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| `character_id`  | UUID        | Lien avec `characters.id` (VTT).                                                             | `550e8400-e29b-41d4-a716-446655440000` |
| `location`      | TEXT        | Localisation (`tete`, `corps`, `bras_droit`, `bras_gauche`, `jambe_droite`, `jambe_gauche`). | `tete`                                 |
| `severity`      | TEXT        | Gravité (`legere`, `moyenne`, `grave`, `critique`, `mortelle`).                              | `grave`                                |
| `is_stabilized` | BOOLEAN     | Si la blessure est stabilisée.                                                               | `false` (par défaut)                   |
| `created_at`    | TIMESTAMPTZ | Date de création.                                                                            | `2026-05-06T10:00:00Z`                 |
| `updated_at`    | TIMESTAMPTZ | Date de mise à jour.                                                                         | `2026-05-06T10:00:00Z`                 |


### **3.3. Logique Métier à Implémenter**

#### **3.3.1. Ajout d'une Blessure**

1. **Entrée** : `character_id`, `location`, `damage` (points de dégâts).
2. **Calcul de la gravité** :
  - Cumul des dégâts pour la localisation → déterminer la **gravité** (ex : 12 pts → `moyenne`).
3. **Vérification de la promotion** :
  - Si la ligne de gravité est **pleine** → **promotion automatique** (ex : 3 `legere` → 1 `moyenne`).
4. **Ajout en base** :
  - Insérer une nouvelle ligne dans `character_wounds`.
5. **Calcul du malus global** :
  - Pour chaque localisation, trouver la **blessure la plus grave** → appliquer son malus.
6. **Déclenchement du Test de Choc** (si applicable) :
  - Si `severity` est `grave`, `critique`, ou `mortelle` → **demander un Test de Choc** (GM → joueur).
7. **Broadcast WebSocket** :
  - Émettre `WOUND_ADDED` à tous les clients concernés (GM + propriétaire).

#### **3.3.2. Stabilisation d'une Blessure**

1. **Entrée** : `wound_id`, `success` (booléen, résultat du Test de Premiers soins).
2. **Mise à jour en base** :
  - `is_stabilized = true` si `success = true`.
3. **Conséquences** :
  - Si `success = false` et `severity = mortelle` → **mort immédiate**.
  - Si `success = false` et `severity = critique` → **aggravation en mortelle après `2 × Constitution` minutes**.
4. **Broadcast WebSocket** :
  - Émettre `WOUND_STABILIZED` (ou `WOUND_AGGRAVATED` en cas d’échec).

#### **3.3.3. Test de Choc**

1. **Entrée** : `character_id`, `wound_id`, `diceRoll` (1D20).
2. **Calcul du résultat** :
  - Comparer `diceRoll` aux **seuils d’Étourdissement/Inconscience** du personnage.
  - Appliquer le **malus de la blessure** (ex : -5 pour une blessure grave à la Tête).
3. **Déterminer l’état** :
  - `diceRoll <= Seuil Étourdissement` → **Aucun effet**.
  - `Seuil Étourdissement < diceRoll <= Seuil Inconscience` → **Étourdi**.
  - `diceRoll > Seuil Inconscience` → **Inconscient** (ou **Coma** si blessure mortelle).
4. **Application des effets** :
  - **Étourdi** : Malus **-5 supplémentaire**, allure **moyenne max**.
  - **Inconscient** : **Aucune action possible**, durée = 1D6 heures.
  - **Coma** : Durée variable (voir [5.3](#53-coma)).
5. **Broadcast WebSocket** :
  - Émettre `SHOCK_TEST_RESULT` avec l’état résultant.

#### **3.3.4. Promotion Automatique**

1. **Déclenchement** : Quand une ligne de gravité est **pleine** et qu’une nouvelle blessure de **même gravité** est ajoutée.
2. **Actions** :
  - **Supprimer toutes les blessures de cette gravité** pour la localisation.
  - **Ajouter 1 blessure de la gravité supérieure**.
3. **Broadcast WebSocket** :
  - Émettre `WOUND_PROMOTED`.

---

---

## **4. Conception Technique**

---

### **4.1. Modèle de Données**

#### **4.1.1. Nouvelle Table : `character_wounds**`

```sql
CREATE TABLE character_wounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    char_sheet_id UUID NOT NULL REFERENCES char_sheet(id) ON DELETE CASCADE,
    location TEXT NOT NULL CHECK (location IN ('tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche')),
    severity TEXT NOT NULL CHECK (severity IN ('legere', 'moyenne', 'grave', 'critique', 'mortelle')),
    is_stabilized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (char_sheet_id, location, severity, id) -- Éviter les doublons pour la même gravité/localisation
);
```

**Notes** :

- **Pas de colonne `damage**` : Les dégâts sont **cumulés en mémoire** (frontend) pour déterminer la gravité.
- `**char_sheet_id**` : Lien avec la fiche personnage (et non `character_id` directement) pour respecter l’architecture existante.
- `**is_stabilized**` : Par défaut `FALSE`. Passe à `TRUE` après un Test de Premiers soins réussi.

#### **4.1.2. Index Recommandés**

```sql
CREATE INDEX idx_character_wounds_char_sheet_id ON character_wounds(char_sheet_id);
CREATE INDEX idx_character_wounds_location ON character_wounds(location);
CREATE INDEX idx_character_wounds_severity ON character_wounds(severity);
```

#### **4.1.3. Données Statiques (Optionnel)**

Si on veut stocker les **seuils de gravité** et **malus** en base (pour éviter de les coder en dur) :

```sql
CREATE TABLE ref_wound_severities (
    id TEXT PRIMARY KEY,       -- 'legere', 'moyenne', etc.
    threshold INT NOT NULL,    -- 5, 10, 15, etc.
    penalty INT NOT NULL,      -- -1, -3, -5, etc.
    requires_stabilization BOOLEAN NOT NULL DEFAULT FALSE,
    requires_shock_test BOOLEAN NOT NULL DEFAULT FALSE,
    shock_penalty INT           -- -5, -10, -15 (pour les Tests de Choc)
);

-- Données initiales
INSERT INTO ref_wound_severities VALUES
    ('legere', 5, -1, FALSE, FALSE, NULL),
    ('moyenne', 10, -3, FALSE, FALSE, NULL),
    ('grave', 15, -5, FALSE, TRUE, -5),
    ('critique', 20, -10, TRUE, TRUE, -10),
    ('mortelle', 25, -20, TRUE, TRUE, -15);
```

**Avantage** :

- Permet de **modifier les règles** sans toucher au code.
- **Inconvénient** : Ajoute une table supplémentaire (à évaluer).

---

### **4.2. Routes API**

#### **4.2.1. Nouvelles Routes à Créer**


| Méthode | Endpoint                                          | Description                                         | Middleware                  |
| ------- | ------------------------------------------------- | --------------------------------------------------- | --------------------------- |
| `GET`   | `/api/characters/:id/wounds`                      | Récupérer toutes les blessures d’un personnage.     | `requireCharacterOwnership` |
| `POST`  | `/api/characters/:id/wounds`                      | Ajouter une blessure (avec `location` et `damage`). | `requireCharacterOwnership` |
| `PUT`   | `/api/characters/:id/wounds/:wound_id/stabilize`  | Stabiliser une blessure (avec `success`).           | `requireGMOrOwner`          |
| `GET`   | `/api/characters/:id/wounds/shock-test`           | Récupérer les seuils de Choc pour un personnage.    | `requireCharacterOwnership` |
| `POST`  | `/api/characters/:id/wounds/:wound_id/shock-test` | Soumettre un résultat de Test de Choc.              | `requireCharacterOwnership` |


#### **4.2.2. Exemples de Payloads**

##### `**POST /api/characters/:id/wounds**`

**Request** :

```json
{
  "location": "tete",
  "damage": 12
}
```

**Response (201 Created)** :

```json
{
  "wound": {
    "id": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv",
    "char_sheet_id": "550e8400-e29b-41d4-a716-446655440000",
    "location": "tete",
    "severity": "moyenne",
    "is_stabilized": false,
    "created_at": "2026-05-06T10:00:00Z",
    "updated_at": "2026-05-06T10:00:00Z"
  },
  "promoted": false,          -- Si une promotion a eu lieu
  "new_severity": null,       -- Nouvelle gravité en cas de promotion
  "shock_test_required": false -- Si un Test de Choc est nécessaire
}
```

##### `**PUT /api/characters/:id/wounds/:wound_id/stabilize**`

**Request** :

```json
{
  "success": true
}
```

**Response (200 OK)** :

```json
{
  "wound": {
    "id": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv",
    "is_stabilized": true,
    "updated_at": "2026-05-06T10:05:00Z"
  },
  "aggravated": false,        -- Si la blessure s'est aggravée (échec)
  "new_severity": null        -- Nouvelle gravité en cas d'aggravation
}
```

##### `**POST /api/characters/:id/wounds/:wound_id/shock-test**`

**Request** :

```json
{
  "diceRoll": 14
}
```

**Response (200 OK)** :

```json
{
  "result": "etourdi",        -- "aucun", "etourdi", "inconscient", "coma"
  "malus": -5,                -- Malus supplémentaire (0 si aucun)
  "duration": "1D6 minutes",  -- Durée de l'état
  "seuils": {
    "etourdissement": 10,
    "inconscience": 15
  }
}
```

---

### **4.3. Logique Métier**

#### **4.3.1. Backend (Express)**

**Fichier** : `server/src/routes/character/wounds.js`

**Fonctions clés** :

1. `**getWounds**` :
  - Récupère toutes les blessures d’un `char_sheet_id`.
  - **Pas de calcul** : Retourne les données brutes.
2. `**addWound**` :
  - **Entrée** : `char_sheet_id`, `location`, `damage`.
  - **Logique** :  
  a. Récupérer les blessures existantes pour la `location`.  
  b. **Cumuler les dégâts** pour déterminer la nouvelle `severity`.  
  c. Vérifier si la ligne de `severity` est **pleine** → **promotion automatique**.  
  d. Insérer la nouvelle blessure en base.  
  e. **Déclencher un Test de Choc** si `severity` est `grave`, `critique`, ou `mortelle`.  
  f. **Broadcast WebSocket** (`WOUND_ADDED`).
  - **Sortie** : La blessure ajoutée + flags (`promoted`, `shock_test_required`).
3. `**stabilizeWound**` :
  - **Entrée** : `wound_id`, `success`.
  - **Logique** :  
  a. Mettre à jour `is_stabilized`.  
  b. Si `success = false` et `severity = mortelle` → **supprimer le personnage** (ou marquer comme mort).  
  c. Si `success = false` et `severity = critique` → **aggravation en mortelle** (après délai).  
  d. **Broadcast WebSocket** (`WOUND_STABILIZED` ou `WOUND_AGGRAVATED`).
4. `**submitShockTest**` :
  - **Entrée** : `wound_id`, `diceRoll`.
  - **Logique** :  
  a. Récupérer la blessure et les **seuils du personnage** (`Seuil Étourdissement`, `Seuil Inconscience`).  
  b. Appliquer le **malus de la blessure** (ex : -5 pour `grave` à la Tête).  
  c. Déterminer l’état (`aucun`, `étourdi`, `inconscient`, `coma`).  
  d. **Broadcast WebSocket** (`SHOCK_TEST_RESULT`).

#### **4.3.2. Frontend (React)**

**Fichiers** :

- `client/src/character/lib/woundUtils.js` : Logique métier (calculs, promotion, etc.).
- `client/src/character/stores/woundStore.js` : Store Zustand pour gérer l’état des blessures.
- `client/src/character/components/WoundCounter.jsx` : Composant d’affichage/édition.

**Fonctions clés** :

1. `**calculateWoundSeverity(damage)**` :
  - Détermine la gravité en fonction des **seuils** (5, 10, 15, etc.).
  - **Exemple** :
    ```javascript
    function calculateWoundSeverity(damage) {
      if (damage >= 25) return 'mortelle';
      if (damage >= 20) return 'critique';
      if (damage >= 15) return 'grave';
      if (damage >= 10) return 'moyenne';
      return 'legere';
    }
    ```
2. `**getWoundPenalty(charSheet)**` :
  - Calcule le **malus global** en fonction des blessures les plus graves par localisation.
  - **Exemple** :
    ```javascript
    function getWoundPenalty(charSheet) {
      const locations = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche'];
      let maxPenalty = 0;
      for (const loc of locations) {
        const worstWound = getWorstWound(charSheet, loc);
        if (worstWound) {
          const penalty = getPenaltyForSeverity(worstWound.severity);
          maxPenalty = Math.min(maxPenalty, penalty); // On prend le malus le plus négatif
        }
      }
      return maxPenalty;
    }
    ```
3. `**checkPromotion(wounds, location, severity)**` :
  - Vérifie si une ligne de gravité est **pleine** et déclenche la promotion.
  - **Exemple** :
    ```javascript
    function checkPromotion(wounds, location, severity) {
      const counts = {
        tete: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
        corps: { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
        bras_droit: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
        // ... autres localisations
      };
      const maxCount = counts[location][severity];
      const currentCount = wounds.filter(w => w.location === location && w.severity === severity).length;
      if (currentCount >= maxCount) {
        return { promote: true, newSeverity: getNextSeverity(severity) };
      }
      return { promote: false };
    }
    ```
4. `**getShockTestSeuils(charSheet)**` :
  - Calcule les **seuils d’Étourdissement/Inconscience** à partir des attributs.
  - **Exemple** :
    ```javascript
    function getShockTestSeuils(charSheet) {
      const { FOR, CON, VOL } = charSheet.attributes; // Niveaux actuels (base + pc_modifier)
      const seuilEtourdissement = Math.floor((FOR + CON + VOL) / 3);
      const seuilInconscience = seuilEtourdissement + 10;
      return { seuilEtourdissement, seuilInconscience };
    }
    ```

---

### **4.4. Composants React**

#### **4.4.1. `WoundCounter.jsx**`

**Objectif** : Afficher et gérer les blessures pour une localisation donnée.

**Props** :

```javascript
{
  charSheet: Object,       // Fiche personnage complète
  location: String,        // 'tete', 'corps', etc.
  wounds: Array,            // Blessures pour cette localisation
  onAddWound: Function,     // Callback pour ajouter une blessure
  onStabilizeWound: Function // Callback pour stabiliser une blessure
}
```

**Structure** :

```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '../constants/wounds';

const SEVERITY_ORDER = ['legere', 'moyenne', 'grave', 'critique', 'mortelle'];
const MAX_COUNTS = {
  tete: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  corps: { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
  bras_droit: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  // ... autres localisations
};

const WoundCounter = ({ charSheet, location, wounds, onAddWound, onStabilizeWound }) => {
  const { t } = useTranslation();

  // Filtrer les blessures pour cette localisation
  const locationWounds = wounds.filter(w => w.location === location);

  // Grouper par gravité
  const woundsBySeverity = SEVERITY_ORDER.reduce((acc, severity) => {
    acc[severity] = locationWounds.filter(w => w.severity === severity);
    return acc;
  }, {});

  // Vérifier si une ligne est pleine
  const isLineFull = (severity) => {
    return woundsBySeverity[severity].length >= MAX_COUNTS[location][severity];
  };

  // Ajouter une blessure
  const handleAddWound = (severity) => {
    onAddWound(location, severity);
  };

  // Stabiliser une blessure
  const handleStabilize = (woundId) => {
    onStabilizeWound(woundId);
  };

  return (
    <div className="wound-counter">
      <h3>{t(`locations.${location}`)}</h3>
      {SEVERITY_ORDER.map(severity => (
        <div key={severity} className="wound-line">
          <span className="severity-label" style={{ color: SEVERITY_COLORS[severity] }}>
            {t(`wounds.${severity}`)} ({MAX_COUNTS[location][severity]})
          </span>
          <div className="wound-boxes">
            {Array.from({ length: MAX_COUNTS[location][severity] }).map((_, index) => {
              const wound = woundsBySeverity[severity][index];
              return (
                <div
                  key={index}
                  className={`wound-box ${wound ? 'checked' : ''} ${wound?.is_stabilized ? 'stabilized' : ''}`}
                  style={{ backgroundColor: wound ? SEVERITY_COLORS[severity] : 'transparent' }}
                  onClick={() => !wound && handleAddWound(severity)}
                  onDoubleClick={() => wound && handleStabilize(wound.id)}
                >
                  {wound && (
                    <span className="wound-tooltip">
                      {t('wounds.penalty', { penalty: getPenaltyForSeverity(severity) })}
                      {wound.is_stabilized && <span> (Stabilisée)</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {isLineFull(severity) && (
            <div className="promotion-warning">
              {t('wounds.promotionWarning', { nextSeverity: t(`wounds.${getNextSeverity(severity)}`) })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default WoundCounter;
```

**Styles CSS** :

```css
.wound-counter {
  margin-bottom: 1rem;
  border: 1px solid #ccc;
  padding: 0.5rem;
  border-radius: 4px;
}

.wound-line {
  margin-bottom: 0.5rem;
}

.severity-label {
  font-weight: bold;
  margin-right: 0.5rem;
}

.wound-boxes {
  display: flex;
  gap: 0.25rem;
}

.wound-box {
  width: 20px;
  height: 20px;
  border: 1px solid #999;
  cursor: pointer;
  position: relative;
}

.wound-box.checked {
  border-color: #333;
}

.wound-box.stabilized {
  box-shadow: 0 0 0 2px #28a745; /* Vert pour stabilisé */
}

.promotion-warning {
  font-size: 0.8rem;
  color: #dc3545; /* Rouge */
  margin-top: 0.25rem;
}
```

#### **4.4.2. `WoundManager.jsx**`

**Objectif** : Gérer toutes les localisations et afficher le **malus global**.

**Structure** :

```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import WoundCounter from './WoundCounter';
import { useWoundStore } from '../stores/woundStore';

const LOCATIONS = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche'];

const WoundManager = ({ charSheet }) => {
  const { t } = useTranslation();
  const { wounds, addWound, stabilizeWound } = useWoundStore(charSheet.id);
  const globalPenalty = getWoundPenalty(charSheet, wounds);

  return (
    <div className="wound-manager">
      <h2>{t('wounds.title')}</h2>
      <div className="global-penalty">
        {t('wounds.globalPenalty')}: <strong>{globalPenalty}</strong>
      </div>
      <div className="locations-grid">
        {LOCATIONS.map(location => (
          <WoundCounter
            key={location}
            charSheet={charSheet}
            location={location}
            wounds={wounds}
            onAddWound={addWound}
            onStabilizeWound={stabilizeWound}
          />
        ))}
      </div>
    </div>
  );
};

export default WoundManager;
```

---

### **4.5. Intégration avec le Système de Combat**

#### **4.5.1. Où déclencher l'ajout de blessures ?**

Dans le VTT, les **dégâts** sont appliqués via :

1. **Attaques** : Quand un jet de dégâts est lancé (ex : `DICE_RESULT` avec `damage`).
2. **Effets spéciaux** : Pièges, chutes, etc.

**Flux proposé** :

1. **Côté client (VTT)** :
  - Quand un personnage subit des dégâts (ex : via un jet de dés ou une interaction) :
    - **Appeler `POST /api/characters/:id/wounds**` avec `location` et `damage`.
    - **Attendre la réponse** (pour savoir si un Test de Choc est nécessaire).
2. **Côté serveur** :
  - **Valider l’ownership** (seul le GM ou le propriétaire peut ajouter des blessures).
  - **Ajouter la blessure** en base.
  - **Déclencher un Test de Choc** si nécessaire.
  - **Broadcast WebSocket** (`WOUND_ADDED`).
3. **Côté client (Character)** :
  - **Écouter `WOUND_ADDED**` → mettre à jour le store `woundStore`.
  - **Afficher une popup** si un Test de Choc est nécessaire.

#### **4.5.2. Intégration avec `charStats.js**`

**Fichier** : `client/src/character/lib/charStats.js`

**Modifications nécessaires** :

1. **Ajouter le calcul du malus de blessures** :
  ```javascript
   export function calculateGlobalPenalty(charSheet, wounds) {
     const woundPenalty = getWoundPenalty(charSheet, wounds);
     const shockPenalty = getShockPenalty(charSheet); // Malus de Choc (ex : -5)
     return woundPenalty + shockPenalty; // Cumul des malus
   }
  ```
2. **Intégrer le malus dans les calculs de compétences** :
  ```javascript
   export function calculateSkillTotal(charSheet, skill, wounds) {
     const baseScore = calculateBaseScore(charSheet, skill);
     const mastery = charSheet.skills.find(s => s.skill_id === skill.id)?.mastery || 0;
     const globalPenalty = calculateGlobalPenalty(charSheet, wounds);
     return baseScore + mastery + globalPenalty; // Appliquer le malus
   }
  ```

---

### **4.6. WebSocket (Socket.io)**

#### **4.6.1. Événements à Ajouter**

Dans `shared/events.js` :

```javascript
// Blessures
export const WOUND_ADDED = 'WOUND_ADDED';
export const WOUND_STABILIZED = 'WOUND_STABILIZED';
export const WOUND_PROMOTED = 'WOUND_PROMOTED';
export const WOUND_AGGRAVATED = 'WOUND_AGGRAVATED';

// Tests de Choc
export const SHOCK_TEST_REQUESTED = 'SHOCK_TEST_REQUESTED';
export const SHOCK_TEST_RESULT = 'SHOCK_TEST_RESULT';
```

#### **4.6.2. Backend (Serveur)**

Dans `server/src/index.js` (ou un fichier dédié) :

```javascript
// Écouter les connexions WebSocket
io.on('connection', (socket) => {
  // Stocker userId et role au SESSION_JOIN (déjà implémenté)
  socket.on(WS.SESSION_JOIN, (data) => {
    socket.data.userId = data.userId;
    socket.data.role = data.role;
  });

  // Gérer l'ajout de blessure
  socket.on(WS.WOUND_ADDED, (data) => {
    // Vérifier l'ownership (GM ou propriétaire)
    if (!isOwnerOrGM(socket, data.characterId)) return;

    // Ajouter la blessure en base
    const wound = addWound(data.characterId, data.location, data.damage);

    // Broadcast aux clients concernés
    io.to(`character-${data.characterId}`).emit(WS.WOUND_ADDED, wound);

    // Si Test de Choc nécessaire, notifier le GM
    if (wound.shock_test_required) {
      io.to(`gm-room-${data.sessionId}`).emit(WS.SHOCK_TEST_REQUESTED, {
        characterId: data.characterId,
        woundId: wound.id,
        severity: wound.severity,
        location: wound.location
      });
    }
  });

  // Gérer la stabilisation
  socket.on(WS.WOUND_STABILIZED, (data) => {
    if (!isGM(socket)) return; // Seul le GM peut stabiliser
    const result = stabilizeWound(data.woundId, data.success);
    io.to(`character-${result.characterId}`).emit(WS.WOUND_STABILIZED, result);
  });

  // Gérer le Test de Choc
  socket.on(WS.SHOCK_TEST_RESULT, (data) => {
    if (!isOwnerOrGM(socket, data.characterId)) return;
    const result = submitShockTest(data.woundId, data.diceRoll);
    io.to(`character-${data.characterId}`).emit(WS.SHOCK_TEST_RESULT, result);
    io.to(`gm-room-${data.sessionId}`).emit(WS.SHOCK_TEST_RESULT, result); // Notifier le GM
  });
});

// Helper pour vérifier l'ownership
function isOwnerOrGM(socket, characterId) {
  return socket.data.role === 'GM' ||
         (socket.data.userId && isCharacterOwner(socket.data.userId, characterId));
}
```

#### **4.6.3. Frontend (Client)**

Dans `client/src/character/stores/woundStore.js` :

```javascript
import { create } from 'zustand';
import { socket } from '../../lib/socket';
import * as WS from '../../../shared/events';

export const useWoundStore = create((set) => ({
  wounds: [],
  setWounds: (wounds) => set({ wounds }),
  addWound: (wound) => set((state) => ({ wounds: [...state.wounds, wound] })),
  stabilizeWound: (woundId, success) =>
    set((state) => ({
      wounds: state.wounds.map(w =>
        w.id === woundId ? { ...w, is_stabilized: success } : w
      )
    })),
  clearWounds: () => set({ wounds: [] }),

  // Écouter les événements WebSocket
  initializeSocket: (characterId) => {
    socket.on(WS.WOUND_ADDED, (wound) => {
      if (wound.char_sheet_id === characterId) {
        set((state) => ({ wounds: [...state.wounds, wound] }));
      }
    });

    socket.on(WS.WOUND_STABILIZED, (data) => {
      set((state) => ({
        wounds: state.wounds.map(w =>
          w.id === data.wound.id ? { ...w, is_stabilized: data.success } : w
        )
      }));
    });

    socket.on(WS.SHOCK_TEST_REQUESTED, (data) => {
      // Afficher une popup pour le Test de Choc
      alert(`Test de Choc requis pour ${data.location} (${data.severity})!`);
    });

    socket.on(WS.SHOCK_TEST_RESULT, (result) => {
      // Appliquer l'état (Étourdi/Inconscient/Coma)
      if (result.result === 'etourdi') {
        alert(`Étourdi ! Malus: ${result.malus}, Durée: ${result.duration}`);
      } else if (result.result === 'inconscient') {
        alert(`Inconscient ! Durée: ${result.duration}`);
      }
    });
  }
}));
```

---

---

## **5. Implémentation**

---

### **5.1. Étapes Prioritaires**


| Étape  | Description                           | Fichiers à Modifier/Créer                                             | Dépendances |
| ------ | ------------------------------------- | --------------------------------------------------------------------- | ----------- |
| **1**  | Créer la table `character_wounds`     | `server/db/migrations/char_001_wounds.js`                             | Aucune      |
| **2**  | Créer les routes API                  | `server/src/routes/character/wounds.js`                               | Étape 1     |
| **3**  | Implémenter la logique métier backend | `server/src/routes/character/wounds.js`                               | Étape 2     |
| **4**  | Créer le store Zustand                | `client/src/character/stores/woundStore.js`                           | Aucune      |
| **5**  | Créer les utilitaires frontend        | `client/src/character/lib/woundUtils.js`                              | Étape 4     |
| **6**  | Créer le composant `WoundCounter`     | `client/src/character/components/WoundCounter.jsx`                    | Étape 5     |
| **7**  | Créer le composant `WoundManager`     | `client/src/character/components/WoundManager.jsx`                    | Étape 6     |
| **8**  | Intégrer dans `CharacterSheetPage`    | `client/src/character/pages/CharacterSheetPage.jsx`                   | Étape 7     |
| **9**  | Ajouter les événements WebSocket      | `shared/events.js`, `server/src/index.js`, `client/src/lib/socket.js` | Étape 3     |
| **10** | Intégrer avec `charStats.js`          | `client/src/character/lib/charStats.js`                               | Étape 5     |
| **11** | Ajouter les traductions               | `client/src/locales/fr.json`                                          | Aucune      |
| **12** | Tester et valider                     | Tests manuels + corrections                                           | Toutes      |


---

### **5.2. Fichiers à Modifier/Créer**

#### **5.2.1. Backend (Serveur)**


| Fichier                                             | Action        | Contenu                                            |
| --------------------------------------------------- | ------------- | -------------------------------------------------- |
| `server/db/migrations/char_001_wounds.js`           | **Créer**     | Migration pour `character_wounds`                  |
| `server/db/migrations/char_002_wound_severities.js` | **Optionnel** | Migration pour `ref_wound_severities`              |
| `server/src/routes/character/wounds.js`             | **Créer**     | Routes API + logique métier                        |
| `server/src/index.js`                               | **Modifier**  | Ajouter les handlers WebSocket                     |
| `shared/events.js`                                  | **Modifier**  | Ajouter les événements `WOUND_*` et `SHOCK_TEST_*` |


#### **5.2.2. Frontend (Client)**


| Fichier                                             | Action       | Contenu                                          |
| --------------------------------------------------- | ------------ | ------------------------------------------------ |
| `client/src/character/stores/woundStore.js`         | **Créer**    | Store Zustand pour les blessures                 |
| `client/src/character/lib/woundUtils.js`            | **Créer**    | Fonctions utilitaires (calculs, promotion, etc.) |
| `client/src/character/components/WoundCounter.jsx`  | **Créer**    | Composant pour une localisation                  |
| `client/src/character/components/WoundManager.jsx`  | **Créer**    | Composant parent pour toutes les localisations   |
| `client/src/character/pages/CharacterSheetPage.jsx` | **Modifier** | Intégrer `WoundManager`                          |
| `client/src/character/lib/charStats.js`             | **Modifier** | Intégrer le malus de blessures                   |
| `client/src/locales/fr.json`                        | **Modifier** | Ajouter les traductions pour les blessures       |
| `client/src/lib/socket.js`                          | **Modifier** | Initialiser les listeners WebSocket              |


---

### **5.3. Tests et Validation**

#### **5.3.1. Scénarios de Test**


| Scénario                             | Étapes                                                                                            | Résultat Attendu                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Ajout d'une blessure légère**      | 1. `POST /api/characters/:id/wounds` avec `location: tete`, `damage: 4`                           | Blessure `legere` ajoutée, malus = -1        |
| **Promotion automatique**            | 1. Ajouter 3 blessures `legere` à la Tête. 2. Ajouter une 4ème `legere`.                          | Promotion en `moyenne`, ligne `legere` vidée |
| **Test de Choc**                     | 1. Ajouter une blessure `grave` à la Tête.                                                        | `shock_test_required: true`                  |
| **Stabilisation réussie**            | 1. `PUT /api/characters/:id/wounds/:id/stabilize` avec `success: true`                            | `is_stabilized: true`                        |
| **Stabilisation échouée (critique)** | 1. `PUT /api/characters/:id/wounds/:id/stabilize` avec `success: false`                           | Aggravation en `mortelle` après délai        |
| **Test de Choc échoué**              | 1. `POST /api/characters/:id/wounds/:id/shock-test` avec `diceRoll: 18` (seuil Inconscience = 15) | État = `inconscient`, durée = 1D6 heures     |
| **Malus global**                     | 1. Ajouter une blessure `critique` à la Tête (-10) et `grave` au Corps (-5)                       | Malus global = -10                           |


#### **5.3.2. Validation Fonctionnelle**

- **Backend** :
  - Vérifier que les routes retournent les **bonnes données** (status 200/201).
  - Vérifier que les **broadcasts WebSocket** fonctionnent.
  - Vérifier que les **promotions automatiques** sont déclenchées.
- **Frontend** :
  - Vérifier que les **composants s’affichent correctement**.
  - Vérifier que les **malus sont appliqués** aux compétences.
  - Vérifier que les **popups de Test de Choc** apparaissent.
- **Intégration VTT** :
  - Vérifier que les **blessures sont ajoutées** depuis le VTT (ex : après un jet de dégâts).
  - Vérifier que les **états (Étourdi/Inconscient)** bloquent les actions.

---

---

## **6. Risques et Points de Vigilance**

### **6.1. Risques Techniques**


| Risque                        | Description                                                                                   | Mitigation                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Conflits de migrations**    | La migration `char_001_wounds.js` pourrait entrer en conflit avec d’autres migrations.        | Préfixer les migrations Character par `char_` et vérifier l’ordre. |
| **Performances**              | Les requêtes pour calculer les malus globaux pourraient être lentes si beaucoup de blessures. | Utiliser des **index** sur `char_sheet_id` et `location`.          |
| **Synchronisation WebSocket** | Les événements WebSocket pourraient ne pas atteindre tous les clients.                        | Vérifier que `socket.join(`character-${characterId}`)` est appelé. |
| **Calculs côté client**       | Les malus pourraient être calculés différemment entre clients.                                | Centraliser la logique dans `woundUtils.js`.                       |
| **Ownership**                 | Un joueur pourrait modifier les blessures d’un autre personnage.                              | Toujours vérifier `requireCharacterOwnership` ou `requireGM`.      |


### **6.2. Points de Vigilance Spécifiques**

1. **Promotion automatique** :
  - **Vérifier que la ligne est bien vidée** avant d’ajouter la blessure de niveau supérieur.
  - **Gérer les cas limites** (ex : promotion de `mortelle` → que faire ?).
2. **Tests de Choc** :
  - **Ne pas oublier le malus de la blessure** dans le calcul du Test de Choc.
  - **Gérer les durées** (1D6 minutes/hours) : Utiliser une librairie comme `dice-roller` pour simuler les dés.
3. **Stabilisation** :
  - **Pour les blessures mortelles**, un échec = **mort immédiate** → supprimer le personnage ou le marquer comme mort.
  - **Pour les blessures critiques**, un échec = **aggravation en mortelle après `2 × Constitution` minutes** → utiliser un `setTimeout` côté serveur ?
4. **États de santé** :
  - **Étourdi/Inconscient/Coma** : Bloquer les actions du personnage (ex : désactiver les boutons d’attaque).
  - **Durée du Coma** : Implémenter un **compteur** (ex : `setInterval` côté client pour vérifier la fin du coma).
5. **Intégration avec le VTT** :
  - **Ne pas casser les flux existants** (ex : `DICE_RESULT` pour les jets de dégâts).
  - **Vérifier que les malus de blessures** sont bien pris en compte dans les **jets de compétences**.

---

### **6.3. Décisions à Prendre**


| Décision                                              | Options                                                                    | Recommandation                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Où stocker les seuils de gravité ?**                | 1. En dur dans le code. 2. Dans une table `ref_wound_severities`.          | **Option 2** (plus flexible pour les mises à jour).                                            |
| **Comment gérer la durée des états (Étourdi/Coma) ?** | 1. Côté client (setTimeout). 2. Côté serveur (base de données + cron job). | **Option 1** (plus simple, mais moins robuste en cas de F5).                                   |
| **Qui peut ajouter des blessures ?**                  | 1. GM uniquement. 2. GM + propriétaire.                                    | **Option 2** (le propriétaire peut ajouter des blessures légères/moyennes, le GM pour toutes). |
| **Comment gérer la mort d’un personnage ?**           | 1. Supprimer la fiche. 2. Ajouter un flag `is_dead` dans `char_sheet`.     | **Option 2** (pour conserver l’historique).                                                    |
| **Faut-il un historique des blessures ?**             | 1. Oui (table `character_wound_history`). 2. Non.                          | **Option 2** (pour la V1, on peut s’en passer).                                                |


---

---

## **7. Annexes**

### **7.1. Résumé des Fichiers à Créer/Modifier**

#### **Backend**


| Fichier                                             | Type         | Priorité |
| --------------------------------------------------- | ------------ | -------- |
| `server/db/migrations/char_001_wounds.js`           | Migration    | ⭐⭐⭐      |
| `server/db/migrations/char_002_wound_severities.js` | Migration    | ⭐⭐       |
| `server/src/routes/character/wounds.js`             | Route API    | ⭐⭐⭐      |
| `server/src/index.js`                               | Modification | ⭐⭐⭐      |
| `shared/events.js`                                  | Modification | ⭐⭐⭐      |


#### **Frontend**


| Fichier                                             | Type         | Priorité |
| --------------------------------------------------- | ------------ | -------- |
| `client/src/character/stores/woundStore.js`         | Store        | ⭐⭐⭐      |
| `client/src/character/lib/woundUtils.js`            | Utilitaires  | ⭐⭐⭐      |
| `client/src/character/components/WoundCounter.jsx`  | Composant    | ⭐⭐⭐      |
| `client/src/character/components/WoundManager.jsx`  | Composant    | ⭐⭐⭐      |
| `client/src/character/pages/CharacterSheetPage.jsx` | Modification | ⭐⭐⭐      |
| `client/src/character/lib/charStats.js`             | Modification | ⭐⭐⭐      |
| `client/src/locales/fr.json`                        | Traductions  | ⭐⭐       |
| `client/src/lib/socket.js`                          | Modification | ⭐⭐⭐      |


### **7.2. Exemple de Migration (`char_001_wounds.js`)**

```javascript
// server/db/migrations/char_001_wounds.js
import { v4 as uuidv4 } from 'uuid';

export async function up(knex) {
  await knex.schema.createTable('character_wounds', (table) => {
    table.uuid('id').primaryKey().defaultTo(uuidv4());
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE');
    table.specificType('location', 'TEXT').notNullable()
      .checkIn(['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']);
    table.specificType('severity', 'TEXT').notNullable()
      .checkIn(['legere', 'moyenne', 'grave', 'critique', 'mortelle']);
    table.boolean('is_stabilized').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Index pour optimiser les requêtes
  await knex.schema.raw(`
    CREATE INDEX idx_character_wounds_char_sheet_id ON character_wounds(char_sheet_id);
    CREATE INDEX idx_character_wounds_location ON character_wounds(location);
    CREATE INDEX idx_character_wounds_severity ON character_wounds(severity);
  `);
}

export async function down(knex) {
  await knex.schema.dropTable('character_wounds');
}
```

### **7.3. Exemple de Route API (`wounds.js`)**

```javascript
// server/src/routes/character/wounds.js
import express from 'express';
import { requireCharacterOwnership, requireGMOrOwner } from '../../middleware/auth.js';
import { addWound, stabilizeWound, submitShockTest } from '../../lib/woundService.js';
import * as WS from '../../../shared/events.js';

const router = express.Router();

// GET /api/characters/:id/wounds
router.get('/:id/wounds', requireCharacterOwnership, async (req, res) => {
  try {
    const wounds = await getWoundsByCharSheet(req.params.id);
    res.json(wounds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/characters/:id/wounds
router.post('/:id/wounds', requireCharacterOwnership, async (req, res) => {
  try {
    const { location, damage } = req.body;
    const wound = await addWound(req.params.id, location, damage);

    // Broadcast WebSocket
    req.app.get('io').to(`character-${req.params.id}`).emit(WS.WOUND_ADDED, wound);

    res.status(201).json(wound);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/characters/:id/wounds/:wound_id/stabilize
router.put('/:id/wounds/:wound_id/stabilize', requireGMOrOwner, async (req, res) => {
  try {
    const { success } = req.body;
    const result = await stabilizeWound(req.params.wound_id, success);

    // Broadcast WebSocket
    req.app.get('io').to(`character-${result.char_sheet_id}`).emit(
      success ? WS.WOUND_STABILIZED : WS.WOUND_AGGRAVATED,
      result
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/characters/:id/wounds/:wound_id/shock-test
router.post('/:id/wounds/:wound_id/shock-test', requireCharacterOwnership, async (req, res) => {
  try {
    const { diceRoll } = req.body;
    const result = await submitShockTest(req.params.wound_id, diceRoll);

    // Broadcast WebSocket
    req.app.get('io').to(`character-${result.char_sheet_id}`).emit(WS.SHOCK_TEST_RESULT, result);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

### **7.4. Exemple de Service Backend (`woundService.js`)**

```javascript
// server/src/lib/woundService.js
import knex from '../db/knex.js';
import { getShockTestSeuils } from './charStatsServer.js';
import * as WS from '../../shared/events.js';

// Seuils de gravité (pourrait être dans ref_wound_severities)
const SEVERITY_THRESHOLDS = {
  legere: 5,
  moyenne: 10,
  grave: 15,
  critique: 20,
  mortelle: 25
};

// Nombre max de blessures par gravité/localisation
const MAX_COUNTS = {
  tete: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  corps: { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
  bras_droit: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  bras_gauche: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_droite: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_gauche: { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 }
};

// Malus par gravité
const PENALTIES = {
  legere: -1,
  moyenne: -3,
  grave: -5,
  critique: -10,
  mortelle: -20
};

// Gravités nécessitant un Test de Choc
const SHOCK_TEST_SEVERITIES = ['grave', 'critique', 'mortelle'];

// Gravités nécessitant une stabilisation
const STABILIZATION_SEVERITIES = ['critique', 'mortelle'];

// Ajouter une blessure
export async function addWound(charSheetId, location, damage) {
  // 1. Récupérer les blessures existantes pour cette localisation
  const existingWounds = await knex('character_wounds')
    .where({ char_sheet_id: charSheetId, location })
    .select('*');

  // 2. Calculer la gravité en cumulant les dégâts
  const totalDamage = existingWounds.reduce((sum, w) => {
    // Note: En V1, on stocke pas les dégâts en base, donc on recalcule à partir des gravités existantes
    // Pour simplifier, on suppose que chaque blessure = seuil minimal de sa gravité
    // Ex: une blessure 'moyenne' = 10 pts de dégâts
    return sum + SEVERITY_THRESHOLDS[w.severity];
  }, 0) + damage;

  let severity = 'legere';
  if (totalDamage >= SEVERITY_THRESHOLDS.mortelle) severity = 'mortelle';
  else if (totalDamage >= SEVERITY_THRESHOLDS.critique) severity = 'critique';
  else if (totalDamage >= SEVERITY_THRESHOLDS.grave) severity = 'grave';
  else if (totalDamage >= SEVERITY_THRESHOLDS.moyenne) severity = 'moyenne';

  // 3. Vérifier la promotion automatique
  let promoted = false;
  let newSeverity = null;
  const currentCount = existingWounds.filter(w => w.severity === severity).length;
  if (currentCount >= MAX_COUNTS[location][severity]) {
    // Supprimer toutes les blessures de cette gravité
    await knex('character_wounds')
      .where({ char_sheet_id: charSheetId, location, severity })
      .del();

    // Passer à la gravité supérieure
    newSeverity = getNextSeverity(severity);
    severity = newSeverity;
    promoted = true;
  }

  // 4. Insérer la nouvelle blessure
  const [wound] = await knex('character_wounds')
    .insert({
      char_sheet_id: charSheetId,
      location,
      severity,
      is_stabilized: false
    })
    .returning('*');

  // 5. Vérifier si un Test de Choc est nécessaire
  const shockTestRequired = SHOCK_TEST_SEVERITIES.includes(severity) &&
                            (location === 'tete' || location === 'corps' ||
                             severity === 'critique' || severity === 'mortelle');

  return {
    ...wound,
    promoted,
    newSeverity,
    shockTestRequired
  };
}

// Stabiliser une blessure
export async function stabilizeWound(woundId, success) {
  const wound = await knex('character_wounds')
    .where({ id: woundId })
    .first();

  if (!wound) throw new Error('Blessure introuvable');

  // Mettre à jour is_stabilized
  await knex('character_wounds')
    .where({ id: woundId })
    .update({ is_stabilized: success, updated_at: knex.fn.now() });

  // Si échec et blessure mortelle/critique
  if (!success) {
    if (wound.severity === 'mortelle') {
      // Marquer le personnage comme mort (à implémenter)
      await markCharacterAsDead(wound.char_sheet_id);
      return { ...wound, aggravated: false, newSeverity: null, isDead: true };
    } else if (wound.severity === 'critique') {
      // Aggraver en mortelle
      const newSeverity = 'mortelle';
      await knex('character_wounds')
        .where({ id: woundId })
        .update({ severity: newSeverity, updated_at: knex.fn.now() });
      return { ...wound, aggravated: true, newSeverity };
    }
  }

  return { ...wound, aggravated: false, newSeverity: null };
}

// Soumettre un Test de Choc
export async function submitShockTest(woundId, diceRoll) {
  const wound = await knex('character_wounds')
    .where({ id: woundId })
    .first();

  if (!wound) throw new Error('Blessure introuvable');

  // Récupérer les seuils du personnage
  const charSheet = await knex('char_sheet')
    .where({ id: wound.char_sheet_id })
    .first();

  const attributes = await knex('char_attributes')
    .where({ char_sheet_id: wound.char_sheet_id })
    .select('attr_id', 'base_level', 'pc_modifier');

  const attrMap = {};
  attributes.forEach(a => {
    attrMap[a.attr_id] = a.base_level + a.pc_modifier;
  });

  const { seuilEtourdissement, seuilInconscience } = getShockTestSeuils(attrMap);

  // Appliquer le malus de la blessure
  const malus = PENALTIES[wound.severity] || 0;
  const adjustedRoll = diceRoll + malus;

  let result;
  if (adjustedRoll <= seuilEtourdissement) {
    result = 'aucun';
  } else if (adjustedRoll <= seuilInconscience) {
    result = 'etourdi';
  } else {
    result = wound.severity === 'mortelle' ? 'coma' : 'inconscient';
  }

  // Durée (simplifiée)
  let duration;
  if (result === 'etourdi') duration = '1D6 minutes';
  else if (result === 'inconscient') duration = '1D6 heures';
  else if (result === 'coma') duration = '1D6 heures (léger)';

  return {
    woundId,
    char_sheet_id: wound.char_sheet_id,
    result,
    malus: result === 'etourdi' ? -5 : 0,
    duration,
    seuils: { seuilEtourdissement, seuilInconscience }
  };
}

// Helpers
function getNextSeverity(severity) {
  const order = ['legere', 'moyenne', 'grave', 'critique', 'mortelle'];
  const index = order.indexOf(severity);
  return index < order.length - 1 ? order[index + 1] : null;
}

async function markCharacterAsDead(charSheetId) {
  // À implémenter : ajouter un flag is_dead dans char_sheet
  await knex('char_sheet')
    .where({ id: charSheetId })
    .update({ is_dead: true, updated_at: knex.fn.now() });
}
```

### **7.5. Glossaire des Termes Techniques**


| Terme                     | Définition                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- |
| **char_sheet**            | Table pivot pour la fiche personnage (lien avec `characters.id`).                     |
| **char_sheet_id**         | UUID de la fiche personnage (FK dans toutes les tables Character).                    |
| **Ownership**             | Vérification que l’utilisateur a le droit d’accéder/modifier une ressource.           |
| **Broadcast WebSocket**   | Envoyer un message à tous les clients connectés à une "room" (ex : `character-{id}`). |
| **Promotion automatique** | Mécanisme de passage à une gravité supérieure quand une ligne est pleine.             |
| **Test de Choc**          | Jet de dés pour déterminer si le personnage est étourdi/inconscient.                  |
| **Stabilisation**         | Action médicale pour éviter l’aggravation d’une blessure.                             |


---

---

## **📌 Prochaines Étapes**

1. **Valider ce plan** :
  - Confirmer que l’**architecture proposée** correspond à vos attentes.
  - **Préciser les décisions ouvertes** (ex : durée des états, qui peut ajouter des blessures).
2. **Prioriser les étapes** :
  - Commencer par les **migrations et routes API** (backend).
  - Puis passer au **frontend** (composants + store).
3. **Implémenter par itération** :
  - **Étape 1** : Backend (migrations + routes + WebSocket).
  - **Étape 2** : Frontend (store + utilitaires + composants).
  - **Étape 3** : Intégration avec le VTT (dégâts → blessures).

---

**Question pour vous** :

- **Ce plan vous convient-il ?** Si oui, par où souhaitez-vous commencer ?
- **Y a-t-il des points à modifier ou à clarifier ?** (ex : décisions ouvertes, architecture, etc.)