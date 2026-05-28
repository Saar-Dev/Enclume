# JOURNALTEMP.md — Mémoire Externe : Corps à Corps (Polaris → Enclume)

> Créé le : 2026-05-28  
> Dernière mise à jour : 2026-05-28  
> Statut : **En cours de collecte et validation**  
> Règle : **Append-only** (ne jamais écraser, toujours ajouter)

---

## 📌 Index

1. [Règles Polaris (Corps à Corps)](#1-règles-polaris-corps-à-corps)
2. [Flux Technique (Enclume)](#2-flux-technique-enclume)
3. [Composants UI](#3-composants-ui)
4. [Base de Données](#4-base-de-données)
5. [Pièges Techniques](#5-pièges-techniques)
6. [To-Do List](#6-to-do-list)
7. [Questions Ouvertes](#7-questions-ouvertes)

---

## 1. Règles Polaris (Corps à Corps)

### 1.1 Définition et Portée

- **Corps à corps** = Mains nues + Lutte + Armes blanches + Objets improvisés.
- **Engagé au contact** = **3 mètres ou moins** (cercle de 3m de diamètre).
- **Hors de portée** → Déplacement nécessaire (Préparation : 3 points d'initiative pour ≤3m, Action complète pour >3m).

### 1.2 Compétences Utilisées


| Type d'Attaque | Compétence Attaquant                                        | Compétence Défenseur                                        | Source         |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | -------------- |
| Mains nues     | `ARTS_MARTIAUX` (Techniques offensives) ou `COMBAT_CONTACT` | `ARTS_MARTIAUX` (Techniques défensives) ou `COMBAT_CONTACT` | `ref_skills` ✅ |
| Arme blanche   | `ARMES_BLANCHES` (ou spécialisation)                        | `ARMES_BLANCHES` ou `PARADE`                                | `ref_skills` ✅ |
| Lutte (saisie) | `ARTS_MARTIAUX` (Lutte)                                     | `ARTS_MARTIAUX` (Lutte) ou `FOR` (opposition)               | `ref_skills` ✅ |
| Balayage       | `COMBAT_CONTACT` (malus -5)                                 | `COO` (Test de Coordination)                                | `ref_skills` ✅ |
| Clé/Projection | `ARTS_MARTIAUX` (Lutte)                                     | `ARTS_MARTIAUX` (Lutte) ou `FOR` (opposition)               | `ref_skills` ✅ |


### 1.3 Mécanique de Base

- **Test en opposition** : Attaquant vs Défenseur.
  - **Réussite** :
    - Attaquant réussit **ET** Défenseur échoue → **Attaque touche**.
    - Défenseur réussit → **Pare/esquive** (pas de dégâts).
    - Les deux réussissent → **Rien ne se passe** (ou malus selon règles avancées).
    - Les deux échouent → **Rien ne se passe**.
  - **Marge de réussite** : Plus elle est grande, plus l'attaque est efficace (ex: bonus aux dégâts).
- **Formule de jet** : **1D20 + skillTotal** (comme toutes les compétences Polaris).
  - `skillTotal = calcAN(na_attr1) + calcAN(na_attr2) + mastery` (cf. `SYSTEME/COMBAT.md`).
  - **Exemple** : Pour `ARMES_BLANCHES` (attr1: `FOR`, attr2: `ADA`) :
    ```js
    na_FOR = max(3, FOR.base_level + FOR.pc_modifier + genotype.mod_FOR)
    na_ADA = max(3, ADA.base_level + ADA.pc_modifier + genotype.mod_ADA)
    skillTotal = calcAN(na_FOR) + calcAN(na_ADA) + mastery
    ```

### 1.4 Dégâts

- **Formule** : **Dégâts de l'arme + Modificateur de dégâts (contact)**.
  - **Source** : `ref_equipment.damage_h` (ex: `1D6` pour un couteau, `1D8` pour une épée) **+ `charStats.js:modificateur_dommage_contact**`.
  - **Armes naturelles** (mains nues) : `**1D4 + modificateur_dommage_contact**` (par défaut).
- **Localisation** : **Aléatoire via `LOC_TABLE CONTACT**` (à confirmer : cf. `SYSTEME/COMBAT.md` pour `LOC_TABLE D20`).

### 1.5 Modes de Combat (p. 223)


| Mode         | Effets                                                                                                                                                                                       | Coût                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Normal**   | Aucun                                                                                                                                                                                        | -                                   |
| **Défensif** | +3 aux Tests d'opposition contre l'adversaire. **Pas d'attaque possible**. Retarde son action pour la prochaine attaque adverse.                                                             | Préparation (3 points d'initiative) |
| **Retraite** | +5 aux Tests d'opposition contre l'adversaire. **Pas d'attaque possible**. Doit céder du terrain (sinon → mode Défensif). Retarde son action pour la prochaine attaque adverse.              | Préparation (3 points d'initiative) |
| **Offensif** | +3 aux Tests d'attaque. **-5 aux Tests d'opposition** si attaqué.                                                                                                                            | -                                   |
| **Charge**   | **+3 aux Tests d'attaque et de dégâts**. **-7 aux Tests d'opposition** si attaqué. **Distance minimale de 3m**. Déplacement court gratuit (pas de perte d'initiative). **Action exclusive**. | Action                              |


### 1.6 Combattre Plusieurs Adversaires


| Nombre d'Adversaires | Malus (Tests d'Opposition) |
| -------------------- | -------------------------- |
| 2                    | -5                         |
| 3                    | -7                         |
| 4                    | -10                        |


- **Limite** : Maximum **4 adversaires** simultanés (au-delà, les combattants se gênent).

### 1.7 Modificateurs d'Initiative (Préparations)


| Préparation                                          | Modificateur                                      |
| ---------------------------------------------------- | ------------------------------------------------- |
| Dégainer une arme (prêt à dégainer)                  | -3                                                |
| Dégainer une arme (pas prêt à dégainer)              | -5                                                |
| Saisir un objet à portée de main                     | -3                                                |
| Saisir un objet à quelques pas                       | -5 à -10                                          |
| Venir au corps à corps pour saisir son adversaire    | -3                                                |
| Prononcer une phrase courte, donner des ordres brefs | -3                                                |
| Observer le combat                                   | 1 information par tranche de 5 pts d'Init.        |
| Tenter de repérer un objet/arme/personne             | 1 Test d'Observation par tranche de 5 pts d'Init. |
| Utiliser un mécanisme simple (interrupteur, porte)   | -3 à -5                                           |
| Changer le mode de tir d'une arme à feu              | -3                                                |
| Tirer depuis une couverture                          | -3 à -5                                           |


### 1.8 Modificateurs de Situation (Combat au Contact)


| Situation                                                       | Modificateur                                    |
| --------------------------------------------------------------- | ----------------------------------------------- |
| Attaqué par le côté (ou par-dessus/dessous)                     | -3                                              |
| Attaqué alors qu'on est au sol                                  | -5                                              |
| Position désavantageuse (espace confiné, arme grande)           | -3 à -5                                         |
| Attaque depuis une position avantageuse (surélevée, couverture) | +3                                              |
| Utiliser sa main non directrice                                 | -5                                              |
| Terrain instable ou en équilibre                                | Limité par le niveau en **Acrobatie/Équilibre** |
| Mauvaise luminosité                                             | -3 à -5                                         |


### 1.9 Déplacement (Modificateurs)


| Action                    | Modificateur |
| ------------------------- | ------------ |
| S'accroupir/Se redresser  | -3           |
| Déplacement court         | -3           |
| Se jeter à terre, plonger | -5           |
| Se relever                | -10          |


### 1.10 Précipitation

- **Effets** : **+3 à l'Initiative** et **-5 aux Tests d'action**.

---

## 2. Flux Technique (Enclume)

### 2.1 Événements WebSocket

#### `COMBAT_ACTION_DECLARE` (v2)

- **Payload** :
  ```js
  {
    tokenId: UUID,
    state: { state_position, state_weapon, state_cover, state_vitesse, state_fire_mode, state_combat_mode },
    mapActions: {
      melee: {
        targetId: UUID,
        weaponId: UUID | null,  // null = mains nues
        isRiposte: boolean,
        combatMode: 'normal' | 'defensif' | 'retraite' | 'offensif' | 'charge'
      },
      assault: { ... },  // Tir
      move: { ... }
    },
    quick: { ... }
  }
  ```
- **Validation serveur** :
  - Vérifier que `targetId` est **à ≤ 3m** (PE14 : `Math.sqrt(dx^2 + dy^2) ≤ 3`).
  - Vérifier que `state_weapon === 'drawn'` si `weaponId` est présent.
  - Vérifier que `ref_equipment.location` est `**M` ou `2M**` (pas `Tr` ou `Ce`).
  - Vérifier que la **compétence** correspond à l'arme (ex: `ARMES_BLANCHES` pour une épée).

#### `DICE_ROLL` / `DICE_RESULT`

- **Attaquant** :
  - Lance `1D20 + skillTotal` (via `DiceRoller`).
  - **Payload** :
    ```js
    {
      type: 'melee_attack',
      userId: UUID,
      formula: '1D20 + skillTotal',
      mechanicalTotal: number,
      skillTotal: number,
      targetId: UUID,
      weaponId: UUID | null,
      isRiposte: boolean,
      combatMode: string
    }
    ```
- **Défenseur** :
  - Le serveur **génère automatiquement** un `DICE_ROLL` pour le jet d'opposition.
  - **Payload** :
    ```js
    {
      type: 'melee_defense',
      userId: UUID,  // Défenseur
      formula: '1D20 + skillTotal',
      mechanicalTotal: number,
      skillTotal: number,
      attackerId: UUID,
      isRiposte: boolean,
      combatMode: string
    }
    ```

#### `COMBAT_ATTACK_RESULT`

- **Résultat** :
  ```js
  {
    attackerId: UUID,
    defenderId: UUID,
    hit: boolean,  // true si mechanicalTotal_attacker > mechanicalTotal_defender
    margin: number,  // Marge de réussite (mechanicalTotal_attacker - mechanicalTotal_defender)
    weaponId: UUID | null,
    isRiposte: boolean,
    combatMode: string
  }
  ```

#### `COMBAT_DAMAGE_PROMPT` (si `hit: true`)

- **Dégâts** :
  - Si `weaponId` → Récupérer `ref_equipment.damage_h` (ex: `1D8`).
  - Si **mains nues** → `1D4`.
  - **Modificateur** : `+ modificateur_dommage_contact` (source: `charStats.js`).
  - **Localisation** : Aléatoire via `LOC_TABLE CONTACT`.
  - **Payload** :
    ```js
    {
      attackerId: UUID,
      defenderId: UUID,
      damageFormula: '1D8 + modificateur_dommage_contact',
      weaponId: UUID | null,
      location: string  // Ex: 'T', 'C', 'BD', 'BG', 'JD', 'JG'
    }
    ```

### 2.2 Calculs Serveur

- `**skillTotal**` :
  - Utiliser le **pattern existant** dans `DICE_ROLL` handler (`socket/index.js` ~lignes 680-695).
  - **Compétences** :
    - `ARMES_BLANCHES` → `attr1: FOR`, `attr2: ADA`.
    - `ARTS_MARTIAUX` (Lutte) → `attr1: FOR`, `attr2: COO`.
    - `COMBAT_CONTACT` → `attr1: FOR`, `attr2: ADA` (à confirmer).
- **Modificateurs** :
  - Appliquer les **modificateurs de situation** (ex: `-5` si attaqué par le côté).
  - Appliquer les **modificateurs de mode de combat** (ex: `+3` en mode **Offensif** pour l'attaquant).
  - Appliquer les **malus multiples adversaires** (ex: `-5` si 2 adversaires).

### 2.3 LOC_TABLE CONTACT

- **À confirmer** : Remplacer `LOC_TABLE D20` par `LOC_TABLE CONTACT` pour le corps à corps.
  - **Hypothèse** : Même table que `LOC_TABLE D20` (cf. `SYSTEME/COMBAT.md`) :

    | D20   | Localisation      |
    | ----- | ----------------- |
    | 1-2   | Tête (T)          |
    | 3-8   | Corps (C)         |
    | 9-11  | Bras Droit (BD)   |
    | 12-14 | Bras Gauche (BG)  |
    | 15-17 | Jambe Droite (JD) |
    | 18-20 | Jambe Gauche (JG) |


---

## 3. Composants UI

### 3.1 `CombatActionWindow`

- **Modifications** :
  - Ajouter **onglet "Corps à Corps"** avec :
    - Sélecteur de **cible** (`combatTargetMode`).
    - Sélecteur d'**arme** (mains nues ou `ref_equipment` avec `location = 'M'` ou `2M`).
    - Sélecteur de **mode de combat** (`normal`, `défensif`, `retraite`, `offensif`, `charge`).
    - Case à cocher **"Riposte"** (si parade réussie).
  - **Logique** :
    - Si `weaponId` est sélectionné → `state_weapon` doit être `'drawn'`.
    - Si `combatMode = 'charge'` → Vérifier que la cible est **à ≥ 3m** (sinon, désactiver).

### 3.2 `CombatModifiersWindow`

- **Modifications** :
  - Ajouter **modificateurs de situation** :
    - Position (ex: `+3` si position avantageuse, `-5` si au sol).
    - Arme (ex: `-5` si main non directrice).
    - Terrain (ex: `-3` à `-5` si instable).
    - Luminosité (ex: `-3` à `-5` si mauvaise).
  - Ajouter **modificateurs de mode de combat** :
    - `+3`/`+5` en défense (mode `défensif`/`retraite`).
    - `+3` en attaque (mode `offensif`/`charge`).
    - `-5`/`-7` en opposition (mode `offensif`/`charge`).
  - Ajouter **malus multiples adversaires** :
    - `-5`/ `-7`/ `-10` selon le nombre d'adversaires (2/3/4).

### 3.3 `CombatDamageWindow`

- **Modifications** :
  - **Déjà compatible** (cf. Sprint 7.4).
  - Afficher **localisation aléatoire** (via `LOC_TABLE CONTACT`).
  - Afficher **sévérité** (via seuils de dégâts nets).

### 3.4 `WeaponPanel`

- **Modifications** :
  - **Déjà implémenté** (Sprint 55).
  - Filtrer les armes avec `location = 'M'` ou `2M` pour le corps à corps.

### 3.5 `CombatRosterWindow`

- **Modifications** :
  - Ajouter **icône "Engagé au contact"** si distance ≤ 3m entre deux tokens.

---

## 4. Base de Données

### 4.1 Tables à Utiliser/Modifier


| Table            | Champ                | Type    | Description                                                              |
| ---------------- | -------------------- | ------- | ------------------------------------------------------------------------ |
| `combat_actions` | `type`               | TEXT    | Ajouter `'melee'` aux types existants.                                   |
| `combat_actions` | `melee_target_id`    | UUID    | Cible de l'attaque en corps à corps.                                     |
| `combat_actions` | `melee_weapon_id`    | UUID    | Arme utilisée (NULL = mains nues).                                       |
| `combat_actions` | `melee_is_riposte`   | BOOLEAN | Indique si c'est une riposte.                                            |
| `combat_actions` | `melee_combat_mode`  | TEXT    | Mode de combat (`normal`, `defensif`, `retraite`, `offensif`, `charge`). |
| `combat_actions` | `melee_roll`         | INT     | Résultat du jet d'attaque (1D20 + skillTotal).                           |
| `combat_actions` | `melee_defense_roll` | INT     | Résultat du jet de défense (1D20 + skillTotal).                          |
| `combat_actions` | `melee_hit`          | BOOLEAN | Si l'attaque a touché.                                                   |
| `combat_actions` | `melee_damage_roll`  | TEXT    | Formule de dégâts (ex: `1D8 + 2`).                                       |
| `combat_actions` | `melee_damage_net`   | INT     | Dégâts nets (après armure).                                              |
| `combat_actions` | `melee_location`     | TEXT    | Localisation (T, C, BD, BG, JD, JG).                                     |


### 4.2 `ref_equipment`

- **Champs existants** :
  - `damage_h`: Dégâts de base (ex: `1D6`).
  - `location`: `M` (1 main), `2M` (2 mains), `Tr` (trépied), `Ce` (ceinture), etc.
- **À vérifier** :
  - Existe-t-il un champ pour `**modificateur_dommage_contact**` ?
    - **Réponse de Saar** : Non. **Solution** : Utiliser `charStats.js:modificateur_dommage_contact` (calculé dynamiquement).

### 4.3 `charStats.js`

- **Fonction à ajouter** :
  ```js
  // Calcul du modificateur de dégâts au corps à corps
  function getModificateurDommageContact(characterId) {
    // Exemple : FOR.base_level + FOR.pc_modifier
    const FOR = await getAttribute(characterId, 'FOR');
    return FOR.base_level + FOR.pc_modifier;
  }
  ```

---

## 5. Pièges Techniques


| Code     | Description                                                                          | Solution                                                              |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **PC01** | Ne pas confondre `melee` et `assault` dans `mapActions`.                             | Toujours vérifier `type` avant de traiter.                            |
| **PE14** | Distance en PE14 (`pos_x`, `pos_y` = profondeur, `pos_z` = altitude).                | Calculer la distance avec `Math.sqrt(dx^2 + dy^2)` (ignorer `pos_z`). |
| **PE33** | D10 overlay à `position=[0,0,0]` (ne pas déplacer).                                  | Appliquer aussi aux dés de dégâts.                                    |
| **P51**  | Malus santé non cumulatifs (pire seul).                                              | `effectiveMalus = woundPenalty - encumbrancePenalty`.                 |
| **PC27** | `!token.character_id` = Entité de décor (jamais PNJ).                                | Vérifier `character.type === 'pnj'` pour les PNJ.                     |
| **PC02** | Vérifier que la cible est à **≤ 3m** avant de permettre l'attaque.                   | Utiliser PE14 pour calculer la distance.                              |
| **PC03** | Ne pas autoriser les armes à distance (`Tr`, `Ce`) en corps à corps.                 | Filtrer `ref_equipment.location` (`M`, `2M` uniquement).              |
| **PC04** | **Mode de combat** : Vérifier que `charge` n'est possible que si cible à **≥ 3m**.   | Désactiver le mode si condition non remplie.                          |
| **PC05** | **Parade/Riposte** : Ne pas oublier de **broadcast** le résultat de la parade au GM. | Toujours notifier le GM des actions défensives.                       |


---

## 6. To-Do List

### 6.1 Backend (Serveur)

- **Ajouter `melee` comme type d'action** dans `combat_actions.type`.
- **Implémenter `COMBAT_ACTION_DECLARE` handler pour `melee`** :
  - Valider `targetId` à ≤ 3m (PE14).
  - Valider `weaponId` (si présent) : `location = 'M'` ou `2M`.
  - Valider `state_weapon = 'drawn'` si `weaponId` présent.
  - Calculer `skillTotal` pour l'attaquant et le défenseur.
  - Appliquer les **modificateurs de situation** et **mode de combat**.
- **Générer automatiquement le jet de défense** (`DICE_ROLL` type `melee_defense`).
- **Implémenter `COMBAT_ATTACK_RESULT` pour `melee`** :
  - Comparer `mechanicalTotal_attacker` vs `mechanicalTotal_defender`.
  - Si `hit: true`, déclencher `COMBAT_DAMAGE_PROMPT`.
- **Ajouter `modificateur_dommage_contact`** dans `charStats.js`.
- **Vérifier `LOC_TABLE CONTACT`** (ou utiliser `LOC_TABLE D20`).

### 6.2 Frontend (Client)

- **Modifier `CombatActionWindow`** :
  - Ajouter onglet **"Corps à Corps"** avec sélecteurs (cible, arme, mode de combat, riposte).
  - Valider que `combatMode = 'charge'` → cible à ≥ 3m.
- **Modifier `CombatModifiersWindow`** :
  - Ajouter modificateurs de **situation** (position, arme, terrain, luminosité).
  - Ajouter modificateurs de **mode de combat** (`+3`/`+5` en défense, `+3` en attaque).
  - Ajouter malus **multiples adversaires** (`-5`/`-7`/`-10`).
- **Vérifier `WeaponPanel`** :
  - Filtrer les armes avec `location = 'M'` ou `2M`.
- **Modifier `CombatRosterWindow`** :
  - Ajouter icône **"Engagé au contact"** si distance ≤ 3m.

### 6.3 Tests

- **Test unitaire** :
  - Vérifier calcul de `skillTotal` pour `ARMES_BLANCHES`/`ARTS_MARTIAUX`.
  - Vérifier calcul de distance (PE14).
  - Vérifier application des modificateurs.
- **Test d'intégration** :
  - Simuler un combat en corps à corps (Attaquant vs Défenseur).
  - Vérifier que la parade/riposte fonctionne.
  - Vérifier que les dégâts sont calculés correctement.

---

## 7. Questions Ouvertes

### 7.1 Règles (À Confirmer avec Saar)

- **`LOC_TABLE CONTACT`** : Est-ce la même que `LOC_TABLE D20` ?
- **Modificateur de dégâts** : Est-ce toujours `FOR` ? Ou dépend-il de l'arme ?
- **Mode de combat** :
  - Le mode **"Défensif"** empêche-t-il **toute** attaque, ou seulement les attaques **non retardées** ?
  - Le mode **"Retraite"** impose-t-il un **déplacement** ?

### 7.2 Technique (À Valider)

- **`ref_equipment`** : Faut-il ajouter un champ `is_melee` pour faciliter le filtrage ?
- **`charStats.js`** : Faut-il pré-calculer `modificateur_dommage_contact` pour chaque personnage ?
- **WebSocket** : Faut-il un **nouvel événement** `COMBAT_MELEE_ATTACK` au lieu de réutiliser `COMBAT_ACTION_DECLARE` ?

---

## 📌 Résumé des Découvertes Clés

1. **Corps à corps = Tests en opposition** (Attaquant vs Défenseur).
2. **Dégâts = dégâts_arme + modificateur_dommage_contact** (source: `charStats.js`).
3. **Localisation aléatoire via `LOC_TABLE CONTACT**` (à confirmer).
4. **Modes de combat** : Normal, Défensif (+3 défense, pas d'attaque), Retraite (+5 défense, pas d'attaque), Offensif (+3 attaque, -5 défense), Charge (+3 attaque/dégâts, -7 défense, distance ≥ 3m).
5. **Modificateurs** : Position, arme, terrain, luminosité, multiples adversaires.
6. **Flux technique** : `COMBAT_ACTION_DECLARE` (melee) → `DICE_ROLL` (attaque/défense) → `COMBAT_ATTACK_RESULT` → `COMBAT_DAMAGE_PROMPT`.

---

## 🎯 Prochaine Étape

1. **Valider les questions ouvertes** avec Saar (cf. section 7).
2. **Affiner le plan d'implémentation** (ordre des fichiers à modifier, tests).
3. **Commencer par le backend** (handler `COMBAT_ACTION_DECLARE` pour `melee`).

---

**Note** : Ce fichier est une **mémoire externe**. Toute nouvelle découverte doit être **immédiatement appendée** ici.