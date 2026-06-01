# Journal de Nettoyage de la BDD Polaris
> **Dernière mise à jour** : [05/05/26]
> **Objectif** : Normaliser et nettoyer la BDD `BDD Polaris v2.xlsx` pour un export SQL propre et cohérent.
> **Philosophie** :
> - **Approche incrémentale** : Traiter un champ à la fois pour éviter les erreurs de masse.
> - **Cohérence absolue** : Tous les lots doivent avoir la même structure et les mêmes règles appliquées.
> - **Traçabilité** : Chaque modification est documentée ici, avec sa justification.
> - **Validation manuelle** : Les cas ambigus sont résolus via des pop-ups interactifs (Apps Script/VBA).
> - **Priorité à la qualité** : "Mieux vaut lent et propre que rapide et erroné."

---

---

## **📌 Légende des Statuts**
   Statut       | Description                                                                 |
 |--------------|-----------------------------------------------------------------------------|
 | ✅           | Champ traité et validé.                                                   |
 | 🚧           | Champ en cours de traitement.                                              |
 | ❌           | Champ non traité (à faire).                                                |
 | ⚠️           | Champ traité avec des exceptions ou des cas particuliers.                 |

---

---

## **📝 Historique des Actions**

---

### **🗓️ [Date] – Session 1 : Normalisation du champ "Mode de tir - String"**
**Statut** : ✅
**Fichier concerné** : `Lo01_v2.xlsx` (et tous les lots futurs).
**Script utilisé** : Apps Script (Google Sheets).
**Règles appliquées** :
1. **Valeurs valides** :
   - `CC` (Coup par coup)
   - `RC` (Rafale courte)
   - `RL` (Rafale longue)
   - `CC/RC/RL` (Multi-modes)
   - `-` (Donnée non pertinente).
2. **Gestion des cellules vides** :
   - Remplacées automatiquement par `-`.
3. **Gestion des erreurs** :
   - Pop-up pour chaque valeur inattendue (ex: `"Semi-Auto"`, `"Auto"`).
   - Option pour remplacer par `-` ou ignorer.
   - Bouton **"Annuler"** pour interrompre le script.
4. **Détection automatique** :
   - Le script trouve la colonne **"Mode de tir - String"** peu importe sa position.

**Exemples de transformations** :
 | Valeur Initiale | Valeur Finale | Justification                          |
 |------------------|----------------|----------------------------------------|
 | `CC`             | `CC`           | Déjà valide.                           |
 | `CC/RC/RL`       | `CC/RC/RL`     | Multi-modes autorisé.                 |
 | *(vide)*         | `-`            | Cellule vide → non pertinente.        |
 | `Semi-Auto`      | `-`            | Valeur invalide → remplacée après confirmation. |

**Fichiers modifiés** :
- `Lo01_v2.xlsx` (colonne "Mode de tir - String").
- Script Apps Script : [Lien vers le script ou nom du fichier].

**Prochaines étapes** :
- Appliquer le même script aux autres lots (`Lo02.xlsx`, etc.).
- Documenter les exceptions (ex: armes avec des modes de tir personnalisés).

---

### **🗓️ [Date] – Session 2 : Normalisation du champ "[Nom du Champ]"**
**Statut** : 🚧
**Fichier concerné** : [Nom du fichier].
**Script utilisé** : [Apps Script/VBA/Python].
**Règles appliquées** :
1. [Règle 1].
2. [Règle 2].
3. ...

**Exemples de transformations** :
 | Valeur Initiale | Valeur Finale | Justification |
 |------------------|----------------|---------------|
 | ...              | ...            | ...           |

**Fichiers modifiés** :
- [Liste des fichiers].

**Problèmes rencontrés** :
- [Description des problèmes et solutions].

---

---

## **🎯 Philosophie du Nettoyage**
### **1. Principes Généraux**
- **Un champ à la fois** :
  - Éviter la surcharge cognitive et les erreurs en traitant **un seul champ par session**.
  - Exemple : D'abord "Mode de tir", puis "Portée", puis "Poids", etc.
- **Cohérence entre les lots** :
  - Chaque lot doit avoir **la même structure** et les **mêmes règles appliquées**.
  - Utiliser des **scripts reproductibles** (Apps Script, VBA, ou Python).
- **Validation interactive** :
  - Utiliser des **pop-ups** pour les cas ambigus (ex: valeurs inattendues).
  - Toujours donner à l'utilisateur le choix de **valider, ignorer, ou annuler**.

### **2. Règles de Normalisation**
 | **Type de Donnée**       | **Règle**                                                                                     | **Exemple**               |
 |--------------------------|---------------------------------------------------------------------------------------------|---------------------------|
 | **Valeurs manquantes**   | Remplacées par `-` (donnée non pertinente) ou `NULL` (donnée inconnue).                     | `-`                       |
 | **Valeurs multiples**   | Séparées par `/` (ex: `CC/RC/RL`).                                                          | `CC/RC/RL`                |
 | **Formats standardisés** | Respecter les formats définis dans `PLAN_EQUIPMENT.md` et `JournalGemini.md`.              | `BP/CP/MP/LP`             |
 | **Exceptions**           | Documentées dans ce journal et traitées au cas par cas.                                    | Kevlar → `protection=10`  |

### **3. Gestion des Erreurs**
- **Pop-ups obligatoires** :
  - Toute valeur inattendue doit déclencher un **pop-up** pour validation manuelle.
- **Journalisation** :
  - Les cas ambigus ou les exceptions sont **notés dans ce journal** pour référence future.
- **Tests incrémentaux** :
  - Chaque script est testé sur **un petit lot** avant d'être appliqué à la BDD complète.

### **4. Outils Utilisés**
 | **Outil**               | **Usage**                                                                                     | **Avantages**                              | **Inconvénients**                     |
 |-------------------------|---------------------------------------------------------------------------------------------|-------------------------------------------|---------------------------------------|
 | **Apps Script**         | Normalisation interactive dans Google Sheets.                                              | Intégré, collaboratif, pop-ups natifs.    | Quotas d'exécution, moins flexible.   |
 | **VBA (Excel)**         | Normalisation locale avec macros.                                                          | Puissant, rapide, pas de limites de temps. | Nécessite Excel, moins collaboratif. |
 | **Python (Pandas)**     | Traitement par lots pour les transformations complexes.                                    | Flexible, automatisable, versionnable.    | Nécessite un environnement local.    |

---

---

## **📂 Structure des Fichiers**
Pour organiser les fichiers liés au nettoyage :

### 🗓️ [Date] – Transformation de "Mun. (Coût)" en STRING
**Statut** : ✅
**Script** : Apps Script (`transformerMunitions`).
**Règles** :
- Format `"X (Y)"` → `Contenance chargeur = X` (STRING), `Coût chargeur = Y` (STRING).
- Normalisation des espaces : `"1 000"` → `"1000"`.
- Conservation des formats non standard (ex: `"1500 x niv"`, `"1 heure"`).
- Non-armes → `NULL` (cellule vide).
**Décision SQL** : `VARCHAR(50)` pour `contenance_chargeur` et `cout_chargeur`.

### 🗓️ [Date] – Normalisation du champ "Portée" (Version 2)
**Statut** : ✅
**Script** : Apps Script (`normaliserPortee`).
**Règles** :
- Format standard : `X/Y/Z/A (B)` avec **X < Y < Z < A < B** (ex: `3/15/30/60 (90)`).
- **Nettoyage des espaces** : `"1 200"` → `"1200"`.
- Exceptions conservées : `"Spécial"`, `"ZE [nombre] m"`, `"100"`.
- Artefacts numériques isolés (ex: `1`, `2`) → `NULL`.
- Formats invalides → `NULL` après confirmation.
**Type SQL** : `VARCHAR(50) NULL`.
### 🗓️ [Date] – Normalisation du champ "DIS (M.Noir)" (avec contexte)
**Statut** : ✅
**Script** : Apps Script (`normaliserDIS`).
**Règles** :
- Format standard : `X (Y)` avec `-20 ≤ X ≤ 99` et `-20 ≤ Y ≤ 99`.
- Valeur par défaut pour les cellules vides : `20(20)`.
- `"Introuvable"` ou formats invalides → `-99(-99)`.
- **Pop-ups avec contexte** : Affiche le nom de l'équipement et le numéro de ligne.
**Type SQL** : `VARCHAR(20) NOT NULL`.
### 🗓️ [Date] – Normalisation des champs "INIT" et "FOR"
**Statut** : ✅
**Script** : Apps Script (`normaliserINITEtFOR`).
**Règles** :
- **INIT** : Entiers ≤ 0 (ex: `-1`, `-5`). Valeurs invalides → `NULL`.
- **FOR** : Entiers ≥ 0 (ex: `5`, `10`). Valeurs invalides → `NULL`.
- Cellules vides → `NULL` (cellule vide).
- Pop-up pour confirmation des valeurs inattendues.
**Types SQL** :
- `INIT`: `INTEGER NULL`
- `FOR`: `INTEGER NULL`
---
### **🗓️ [Date du Jour] – Session [X] : Normalisation des colonnes "Dommage (H)", "Dommage (V-)", "Dommage (V+)" et "Choc"**
**Statut** : ✅
**Script** : Apps Script (`normaliserDommage` et `normaliserChoc`).
---
#### **📌 Contexte**
- **Objectif** : Normaliser les colonnes de dégâts pour un export SQL propre.
- **Colonnes traitées** :
  - `Dommage (H)` → Dispatché en `Dommage (H)`, `Dommage (V-)`, `Dommage (V+)`.
  - `Choc` → Même logique que `Dommage (H)` (à confirmer).
- **Philosophie** :
  - **Conservation des valeurs originales** : Aucune modification des valeurs (ex: `5D6+3` reste `5D6+3`).
  - **Dispatch intelligent** : Séparation des échelles `(H)`, `(V-)`, `(V+)`.
  - **Gestion des exceptions** : `Variable`, `Spécial`, `**` (recherche manuelle).
  - **Pas de `NULL`** : Remplacement par `-` pour les cellules vides.

---

#### **📋 Règles Appliquées**
   **Champ**               | **Format Valide**               | **Action**                                                                                     | **Exemple**                     | **Type SQL**       |
 |-------------------------|----------------------------------|-------------------------------------------------------------------------------------------------|---------------------------------|--------------------|
 | **Dommage (H)**         | `XdY+Z` ou `XdY`                 | Conserver tel quel.                                                                             | `5D6+3`, `4D10`                 | `VARCHAR(50)`      |
 | **Dommage (V-)**        | `XdY+Z (V-)`                     | Extraire `XdY+Z` et placer dans `Dommage (V-)`.                                              | `1D6x2(V-)` → `1D6x2`          | `VARCHAR(50)`      |
 | **Dommage (V+)**        | `XdY+Z (V+)`                     | Extraire `XdY+Z` et placer dans `Dommage (V+)`.                                              | `2D8+1(V+)` → `2D8+1`          | `VARCHAR(50)`      |
 | **Multi-échelles**      | `XdY+Z(H)/AdB(V-)/CdE(V+)`      | Dispatcher chaque partie dans la colonne correspondante.                                    | `4D10+3(H)/1D6x2(V-)`          | -                  |
 | **Effets**              | `XdY+Z (+1/tr)`                  | Conserver `XdY+Z` dans `Dommage (H)` et ignorer l'effet (ou stocker dans `Effets Munitions`).   | `1D10+3 (+1/tr)` → `1D10+3`    | -                  |
 | **Exceptions**          | `Variable`, `Spécial`             | Conserver tel quel dans `Dommage (H)`.                                                        | `Variable` → `Variable`         | `VARCHAR(50)`      |
 | **Recherche**           | `**`                              | **Pop-up d'alerte** : "Recherche nécessaire pour [Nom] en ligne X".                          | `**` → Alerte utilisateur      | -                  |
 | **Valeurs vides**       | *(vide)*                          | Remplacer par `-` dans toutes les colonnes.                                                   | *(vide)* → `-`                  | -                  |

---
#### **🔧 Scripts Utilisés**
- **`normaliserDommage()`** :
  - Traitement par **lots de 200 lignes** pour éviter les timeouts.
  - **Recherche flexible** des colonnes par mot-clé (`Dommage (H)`, `Nom`).
  - **Dispatch** des valeurs selon les échelles `(H)`, `(V-)`, `(V+)`.
  - **Pop-ups avec contexte** : Affiche le **nom de l'équipement** et la **ligne** pour les cas ambigus.
  - **Gestion des erreurs** : `SpreadsheetApp.flush()` après chaque lot.

- **`normaliserChoc()`** *(si applicable)* :
  - Même logique que `normaliserDommage()`, adapté pour la colonne `Choc`.

---
#### **📊 Exemples de Transformations**
 | **Valeur Initiale**       | **Dommage (H)** | **Dommage (V-)** | **Dommage (V+)** | **Effets Munitions** | **Notes**                     |
 |---------------------------|-----------------|------------------|------------------|----------------------|--------------------------------|
 | `5D6+3`                   | `5D6+3`         | `-`              | `-`              | `-`                  | Format simple.                |
 | `4D10+3(H)/1D6x2(V-)`     | `4D
 
 ### 🗓️ [Date] – Normalisation des colonnes "Prix" et "Price modifier"
**Statut** : ✅
**Script** : Apps Script (`normaliserPrix`).
**Règles** :
- **Prix** : Chiffre entier (ex: `1000`). Espaces supprimés (ex: `1 000` → `1000`).
- **Price modifier** : Extrait les modificateurs (ex: `x niveau`, `x (NT x NT)`).
- **Cas spéciaux** :
  - `x (niveau x niveau)` → `x niveau²`.
  - `500 x (gen x NT) x 2` → `Prix = 1000` (calcul : `500 * 2`), `Price modifier = x (gen x NT) x 2`.
- **Inachetable** : `-` (pas `NULL`).
- **Pop-ups** : Affiche le nom de l'équipement et la ligne pour les formats invalides.
**Types SQL** :
- `Prix` : `INTEGER NULL` (ou `VARCHAR(50)` si conservation des formats).
- `Price modifier` : `VARCHAR(50) NULL`.

---

### 🗓️ [05/05/26] – Session 3 : Définition des champs NT, Fabricant, Bonus, Niv Max, Nation
**Statut** : ✅
**Source** : Validation explicite Saar session 46.

| Champ | Type SQL | Nullable | Règles |
|---|---|---|---|
| `NT` | `INTEGER NOT NULL` | Non | Chiffres romains I→VII convertis en entiers 1→7. Aucune exception connue. |
| `Fabricant` | `VARCHAR(50)` | NULL | Texte libre ≤ 50 chars. NULL si absent. |
| `Bonus` | `VARCHAR(50)` | NULL | Texte libre ≤ 50 chars. NULL si absent. |
| `Niv Max` | `INTEGER` | NULL | Nombre entier. NULL si pas de niveau max. |
| `Nation` | `VARCHAR(50)` | NULL | Faction/organisation ≤ 50 chars. NULL si absent. |

---

### 🗓️ [05/05/26] – Session 4 : Champs #8, #18, #25, #27, #29, #30
**Statut** : ✅

**Règle générale confirmée** : tous les champs sont NULL par défaut sauf mention explicite NOT NULL. Aucun besoin de le préciser champ par champ.

| Champ | Type SQL | Règles |
|---|---|---|
| `poids` (#8) | `FLOAT NULL` | Valeur numérique en kg. L'exception "0,5 kg x (niv/2)" s'adapte au format (une occurrence). |
| `choc` (#18) | `VARCHAR(50) NULL` | Identique aux champs Dommage. Vide → `"-"`. |
| `calibre` (#25) | `VARCHAR(50) NULL` | Ex: "5,56 mm", "Calibre 12", "Darts 4,5 mm ST". |
| `protection_choc` (#29) | `INTEGER NULL` | Valeur 0-99. Aucune exception identifiée. |
| `localisation` (#30) | `VARCHAR(50) NULL` | Combinaisons de T/C/B/J/D/Ce (ex: "T/C/B/J", "D", "Ce"). |

**Champ #27 — Compétence associée** : même architecture que #11 (compétences uniquement, jamais d'attribut).
Table de jonction dédiée :
```sql
ref_equipment_skill_assoc (
  item_id   TEXT NOT NULL REFERENCES ref_equipment(id) ON DELETE CASCADE,
  skill_id  TEXT NOT NULL REFERENCES ref_skills(id)    ON DELETE RESTRICT,
  PRIMARY KEY (item_id, skill_id)
)
```
Sémantique distincte de `ref_equipment_skills` (#11) : #11 = compétence que l'item booste/requiert, #27 = compétence utilisée pour opérer l'item.

---

### 🗓️ [05/05/26] – Session 5 : Champs #31, #32, #33, #35
**Statut** : ✅

| Champ | Type SQL | Règles |
|---|---|---|
| `cat_malus` (#31) | `TEXT NULL CHECK (cat_malus IN ('S','A','B','C','D'))` | 5 valeurs exactement. C** **éliminé** — n'existe plus dans les données. NULL accepté. |
| `contenance` (#32) | `FLOAT NULL` | Identique à poids. Aucune exception identifiée. |
| `etancheite` (#33) | `BOOLEAN NULL` | true / false / NULL. |
| `effets_munitions` (#35) | `TEXT NULL` | DSL applicatif (ex: `DMG=SET(1D6+2);CHOC=SET(...)`. Aucune contrainte DB, parsing côté application. |

---

### 🗓️ [05/05/26] – Session 6 : Champs #28, #34
**Statut** : ✅

| Champ | Type SQL | Règles |
|---|---|---|
| `protection` (#28) | `INTEGER NULL` | Valeur 0-99. |
| `protection_modifier` (#28 bis) | `VARCHAR(50) NULL` | Stocke `"Niveau"` pour l'unique item à protection dynamique. Même pattern que prix/prix_modifier. NULL pour tous les autres items. |
| Armes éligibles (#34) | Junction table | `ref_equipment_ammo_compat` — auto-référence sur ref_equipment. Voir ci-dessous. |

**Table de jonction #34 — ref_equipment_ammo_compat** :
```sql
ref_equipment_ammo_compat (
  ammo_id    UUID NOT NULL REFERENCES ref_equipment(id) ON DELETE CASCADE,
  weapon_id  UUID NOT NULL REFERENCES ref_equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (ammo_id, weapon_id)
)
```
Auto-référence : ammo_id et weapon_id pointent tous les deux vers ref_equipment.id. Standard SQL.

---

### 🗓️ [05/05/26] – Session 7 : Corrections et confirmations finales
**Statut** : ✅

| Champ | Décision | Détail |
|---|---|---|
| `nt` | `INTEGER NOT NULL CHECK (nt BETWEEN 1 AND 7)` | "I à II" dans source = erreur de saisie, corrigé à l'entrée manuelle. |
| `min_str` | `INTEGER NULL CHECK (min_str BETWEEN 3 AND 20)` | Valeurs 3-20 confirmées par Saar. |
| `init_mod` | `INTEGER NULL CHECK (init_mod < 0)` | 0 = NULL. Strictement négatif. |
| `fire_mode` | `VARCHAR(20) NULL CHECK (fire_mode IN ('CC','RC','RL','CC/RC','CC/RL','RC/RL','CC/RC/RL','-'))` | 8 valeurs exactes. |
| `description` | `TEXT NULL` | Pas de limite de longueur (PostgreSQL TEXT). |
| `manufacturer` | `VARCHAR(50) NULL` | Le plus long connu : "Palia (République du Corail)" = 29 chars. |
| Convention NULL | `NULL` partout | Les `"-"` du fichier source deviennent `NULL` en base. Aucun sentinel string. |

---

---

## ✅ SCHÉMA FINAL VERROUILLÉ — [05/05/26]
> Validé explicitement par Saar. Migration 48 rédigée sur cette base.

### Table principale — `ref_equipment`

| Colonne SQL | Type | Contrainte |
|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` |
| `family` | `TEXT` | `NOT NULL` |
| `category` | `TEXT` | `NOT NULL` |
| `name` | `TEXT` | `NOT NULL` |
| `description` | `TEXT` | NULL |
| `price` | `INTEGER` | NULL |
| `price_modifier` | `VARCHAR(50)` | NULL |
| `weight` | `FLOAT` | NULL |
| `tech_level` | `INTEGER` | `NOT NULL, CHECK (1–7)` |
| `manufacturer` | `VARCHAR(50)` | NULL |
| `bonus` | `VARCHAR(50)` | NULL |
| `max_level` | `INTEGER` | NULL |
| `nation` | `VARCHAR(50)` | NULL |
| `damage_h` | `VARCHAR(50)` | NULL |
| `damage_v_low` | `VARCHAR(50)` | NULL |
| `damage_v_high` | `VARCHAR(50)` | NULL |
| `shock` | `VARCHAR(50)` | NULL |
| `range` | `VARCHAR(50)` | NULL |
| `min_str` | `INTEGER` | `NULL, CHECK (3–20)` |
| `init_mod` | `INTEGER` | `NULL, CHECK (< 0)` |
| `fire_mode` | `VARCHAR(20)` | `NULL, CHECK IN (CC/RC/RL/CC/RC/CC/RL/RC/RL/CC/RC/RL/-)` |
| `ammo_count` | `VARCHAR(50)` | NULL |
| `ammo_cost` | `VARCHAR(50)` | NULL |
| `caliber` | `VARCHAR(50)` | NULL |
| `rarity` | `VARCHAR(20)` | `NOT NULL DEFAULT '20(20)'` |
| `linked_attr` | `TEXT` | `NULL, CHECK IN (FOR/CON/COO/ADA/PER/INT/VOL/PRE)` |
| `protection` | `INTEGER` | NULL |
| `protection_modifier` | `VARCHAR(50)` | NULL |
| `protection_shock` | `INTEGER` | NULL |
| `location` | `VARCHAR(50)` | NULL |
| `malus_cat` | `TEXT` | `NULL, CHECK IN (S/A/B/C/D)` |
| `capacity` | `FLOAT` | NULL |
| `waterproof` | `BOOLEAN` | NULL |
| `ammo_effects` | `TEXT` | NULL |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

### Tables de jonction

| Table | FK 1 | FK 2 |
|---|---|---|
| `ref_equipment_skills` | `item_id UUID → ref_equipment` CASCADE | `skill_id TEXT → ref_skills` RESTRICT |
| `ref_equipment_skill_assoc` | `item_id UUID → ref_equipment` CASCADE | `skill_id TEXT → ref_skills` RESTRICT |
| `ref_equipment_ammo_compat` | `ammo_id UUID → ref_equipment` CASCADE | `weapon_id UUID → ref_equipment` CASCADE |

---

### ⚠️ Points en débat — Session 4 et 5

**Compétences / Attributs (#11)** : ✅ **VERROUILLÉ** — solution robuste validée par Saar.

**Règle** : un item a soit des compétences, soit un attribut. Jamais les deux.

**Pour les compétences** — table de jonction avec FK durs (many-to-many) :
```sql
ref_equipment_skills (
  item_id   TEXT NOT NULL REFERENCES ref_equipment(id) ON DELETE CASCADE,
  skill_id  TEXT NOT NULL REFERENCES ref_skills(id)    ON DELETE RESTRICT,
  PRIMARY KEY (item_id, skill_id)
)
```
- 0 ligne = item sans compétence
- 1 ligne = cas normal
- N lignes = item multi-compétences (ex : outil scientifique)
- `bonus_val` reste dans `ref_equipment` (s'applique à tous les liens égaux)

**Pour les attributs** — colonne CHECK dans `ref_equipment` :
```sql
linked_attr TEXT NULL CHECK (linked_attr IN ('FOR','CON','COO','ADA','PER','INT','VOL','PRE'))
```
Justification : les 8 attributs Polaris sont un ensemble **fermé et immuable** (constantes du système de jeu). Le CHECK constraint est l'outil SQL conçu exactement pour les ensembles fixes — même pattern que `char_attributes` (migration 36).

**Contrainte exclusive** : si `linked_attr` IS NOT NULL → aucune ligne dans `ref_equipment_skills`. Enforced application-level (arc exclusif, pattern établi dans le projet).

---

### 🗓️ [06/05/26] – Session 8 : Migration déployée + Page d'administration V1
**Statut** : ✅

#### Migration 48 — déployée
Fichier : `server/src/db/migrations/48_ref_equipment.js`
Commande : `cd server; npx knex migrate:latest --knexfile knexfile.cjs`
Résultat : 4 tables créées — `ref_equipment`, `ref_equipment_skills`, `ref_equipment_skill_assoc`, `ref_equipment_ammo_compat`.

#### API CRUD — `server/src/routes/equipment.js`
Montée sous `/api/equipment`. Routes :
- `GET /api/equipment` — liste résumé (id, family, category, name, tech_level, rarity)
- `GET /api/equipment/ref/skills` — ref_skills pour dropdowns (avant `/:id` dans la définition)
- `GET /api/equipment/:id` — item complet + données junction
- `POST /api/equipment` — transaction : INSERT ref_equipment + 3 tables junction
- `DELETE /api/equipment/:id` — cascade FK sur junction tables

Sanitize côté serveur : conversion string→int/float/bool, NULL pour chaîne vide. Transaction Knex pour atomicité.

#### Page d'administration standalone — `server/public/equipment-admin.html`
URL : `http://localhost:3001/equipment-admin.html`
Prérequis : être connecté via l'app React (JWT cookie partagé même domaine).
Fonctionnalités :
- **Saisie rapide YAML** : coller `{fam: Armes, nom: "...", nt: 3, ...}` → Parser → champs pré-remplis. 33 alias courts disponibles + noms DB complets acceptés. Parser : js-yaml@4.1.0 via CDN jsDelivr.
- **Presets catégories** : sélecteur "Type d'item" (Arme/Protection/Munition/Conteneur/Divers) → fieldsets highlight/dim visuels. Purement cosmétique, sans impact DB. Persist à travers les créations successives.
- Formulaire complet : 35 champs avec hints, dropdowns enum, multi-selects compétences.
- Table des items existants avec suppression (event delegation, résistant aux `innerHTML` replacements).

#### Bugs corrigés en session
| Bug | Détail | Fix |
|---|---|---|
| A — apostrophe onclick | Noms FR avec `'` cassaient le handler delete | Switched to `data-id`/`data-name` + event delegation |
| B — waterproof sémantique | Unchecked → `false` au lieu de `null` pour non-conteneurs | `form.waterproof.checked ? true : null` |