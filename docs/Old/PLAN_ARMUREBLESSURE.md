# **JOURNALTAMPON.md — Documentation Finale de Planification**

> **Objectif** : Documenter la planification pour le module **Armure & Blessures** (remplacement du compteur de blessures).  
> **Méthode** : Un problème à la fois → Recherche → Solution documentée → **Validation avec transparence sur les doutes**.  
> **Dernière mise à jour** : 2026-05-07 (Session 53)  
> **Statut** : **Documentation complète, mais avec zones d'ombre à résoudre**

---

---

---

## **📌 Contexte Global Validé**

- **Module** : Remplacement du compteur de blessures par une interface **Armure & Blessures** + silhouette SVG.
- **Silhouette SVG** : Fournie par Saar (1 `path` = 1 localisation : `head`, `body`, `left-arm`, `right-arm`, `left-leg`, `right-leg`).
- `**WoundManager**` : Conservé jusqu’à validation complète, puis supprimé.
- **Approche** : **Un problème à la fois**, documentation avant implémentation.

---

---

---

## **✅ Problèmes Résolus et Documentés**

---

### **Problème 1 : Affichage des Objets Équipés par Localisation**

**Statut** : ✅ **Documenté et validé par Saar**

#### **Solution Validée**

1. **Fichier `shared/armorConstants.js**` :
  - `ARMOR_CATEGORY_MALUS` : Mapping des catégories `S/A/B/C/D` → malus numérique (`0`, `-2`, `-3`, `-4`, `-6`).
  - `LOCATION_CODES` : Mapping des localisations (`TÊTE: 'T'`, `CORPS: 'C'`, etc.).
  - `SVG_PATH_TO_LOCATION` : Mapping des IDs SVG (`head`, `body`, etc.) vers les localisations.
2. **Composant `EquipmentDropdown.jsx**` :
  - Menu déroulant pour sélectionner un objet compatible avec une localisation.
  - Filtre : `ref_equipment.location` **contient** le code de la localisation (ex: `"T"`).
  - Pour les couches 2 et 3 : filtre supplémentaire sur **catégorie `"S"**`.
3. **Composant `LocationPanel.jsx**` :
  - Affiche 1-3 `EquipmentDropdown` (couches d’armure).
  - Intègre `WoundCheckboxGrid` (compteur de blessures pour la localisation).
4. **Intégration dans `CharacterSheet.jsx**` :
  - Remplace `WoundManager` par 6 × `<LocationPanel>` (Tête, Corps, Bras G/D, Jambes G/D).
  - Ajoute `<Silhouette wounds={wounds} />` pour la vue globale.

---

---

### **Problème 2 : Intégration du Compteur de Blessures dans `LocationPanel**`

**Statut** : ✅ **Documenté, mais avec zones d'ombre (voir ci-dessous)**

#### **Solution Proposée**

1. **Nouveau composant `WoundCheckboxGrid.jsx**` :
  - Affiche 5 cases (1 par gravité : `legere`, `moyenne`, `grave`, `critique`, `mortelle`).
  - Couleur de fond : `SEVERITY_COLORS[severity]` si blessure présente.
  - Icônes : ✓ (stabilisée), ! (test de choc requis).
  - Callback : `onWoundToggle(location, severity, wound)`.
2. **Intégration dans `LocationPanel.jsx**` :
  - Filtre `wounds` par `location` et passe à `WoundCheckboxGrid`.
  - Gère les couches d’armure + compteur de blessures.
3. **Gestion des blessures dans `CharacterSheet.jsx**` :
  - Charge `wounds` via `GET /char-sheet/:characterId/wounds`.
  - Callback `handleWoundToggle` pour `POST/PUT /wounds`.
  - Recharge `wounds` si `promoted === true`.

---

---

---

## **❓ ZONES D'OMBRE ET DOUTES (À RÉSOUDRE AVANT FINALISATION)**

---

### **🚨 Doute 1 : Contenu de `woundConstants.js**`

**Problème** : Je n’ai pas pu lire le contenu exact de `woundConstants js.md` pour confirmer :

- `**WOUND_SEVERITIES**` existe-t-il et correspond-il à `['legere', 'moyenne', 'grave', 'critique', 'mortelle']` ?
- `**SEVERITY_COLORS**` existe-t-il et correspond-il à :
  ```javascript
  {
    legere: '#FFD700',
    moyenne: '#FFA500',
    grave: '#FF4500',
    critique: '#DC143C',
    mortelle: '#8B0000'
  }
  ```
- `**WOUND_LOCATIONS**` ou `**LOCATION_LABELS**` existent-ils ?  
*(Exemple : `tete: 'Tête', corps: 'Corps', ...`)*

**Impact** :

- Si ces constantes **n’existent pas**, il faut les **créer** dans `woundConstants.js`.
- Si elles **existent mais diffèrent**, il faut **les aligner** avec `WoundManager.jsx`.

**Action requise** :

- **Lire `woundConstants js.md**` pour confirmer ou infirmer.

---

---

### **🚨 Doute 2 : Disponibilité de `socket` dans `CharacterWindow**`

**Problème** : Dans `JOURNAL2.md` (Session 52), il est mentionné :

> *"Pattern WoundManager : state interne, fetch propre (pas de WS listeners — socket non disponible dans CharacterWindow V1)"*.

**Question** :

- `**socket` est-il disponible dans `CharacterWindow` en Session 53** ?
  - Si **oui** : On peut ajouter un listener `INVENTORY_UPDATE` dans `InventoryPanel`.
  - Si **non** : Utiliser un **rafraîchissement manuel** (comme dans `InventoryPanel` actuel).

**Impact** :

- Si `socket` n’est pas disponible, **pas de synchronisation temps réel** pour les blessures/armures.

**Action requise** :

- **Vérifier si `socket` est injecté dans `CharacterWindow.jsx**`.

---

---

### **🚨 Doute 3 : Mapping des Localisations entre `WoundManager` et `LocationPanel**`

**Problème** :

- Dans `WoundManager.jsx`, les localisations sont en **minuscules** (`tete`, `corps`, etc.).
- Dans `LocationPanel.jsx`, les localisations sont en **majuscules** (`TÊTE`, `CORPS`, etc.).

**Question** :

- Faut-il **standardiser** les localisations ?
  - Option 1 : Tout mettre en **minuscules** (comme dans `WoundManager`).
  - Option 2 : Créer un **mapping** entre les deux (ex: `TÊTE: 'tete'`).

**Impact** :

- Sans standardisation, **filtre incorrect** dans `WoundCheckboxGrid`.

**Action requise** :

- **Choisir une convention** (minuscules ou mapping) et l’appliquer partout.

---

---

### **🚨 Doute 4 : Gestion des `promoted` dans les Blessures**

**Problème** : Dans `WoundManager.jsx`, après un `POST/PUT` sur `/wounds` :

- Si `res.data.promoted === true`, **toute la liste des blessures est rechargée**.
- **Pourquoi** : Une promotion peut supprimer/modifier une blessure existante (ex: une blessure légère promue en grave).

**Question** :

- Est-ce que **toutes les modifications de blessures** peuvent déclencher une promotion ?
  - Si **oui** : Toujours recharger `wounds` après un `POST/PUT`.
  - Si **non** : Identifier les cas où `promoted` est `true`.

**Impact** :

- Si on **ne recharge pas** `wounds` après une modification, **désynchronisation** possible.

**Action requise** :

- **Vérifier la logique de promotion** dans `char-sheet.js` (backend).

---

---

### **🚨 Doute 5 : Intégration de la Silhouette SVG avec les Blessures**

**Problème** : La silhouette SVG doit afficher des **couleurs par localisation** en fonction de la **pire blessure**.

- **Exemple** : Si la pire blessure de `TÊTE` est `grave`, alors `path#head` doit avoir la couleur `#FF4500`.

**Question** :

- Faut-il **calculer la pire blessure par localisation** dans :
  - `**Silhouette.jsx**` (composant dédié) ?
  - `**CharacterSheet.jsx**` (centralisé) ?

**Impact** :

- Si mal implémenté, **couleurs incorrectes** sur la silhouette.

**Action requise** :

- **Définir où calculer la pire blessure** (dans `Silhouette` ou `CharacterSheet`).

---

---

---

## **📝 Résumé des Fichiers et de Leur Statut**


| **Fichier**                                  | **Action**         | **Statut**    | **Doutes**                                               |
| -------------------------------------------- | ------------------ | ------------- | -------------------------------------------------------- |
| `shared/armorConstants.js`                   | Créer              | ✅ Documenté   | Aucun                                                    |
| `shared/woundConstants.js`                   | Vérifier/Compléter | ❌ **Doute 1** | `WOUND_SEVERITIES`, `SEVERITY_COLORS`, `WOUND_LOCATIONS` |
| `client/src/character/WoundCheckboxGrid.jsx` | Créer              | ✅ Documenté   | **Doute 3** (mapping localisations)                      |
| `client/src/character/LocationPanel.jsx`     | Créer              | ✅ Documenté   | **Doute 3** (mapping localisations)                      |
| `client/src/character/CharacterSheet.jsx`    | Modifier           | ✅ Documenté   | **Doute 2** (`socket`), **Doute 4** (`promoted`)         |
| `client/src/character/Silhouette.jsx`        | Créer              | ✅ Documenté   | **Doute 5** (calcul pire blessure)                       |
| `client/src/character/CharacterWindow.jsx`   | Vérifier           | ❌ **Doute 2** | `socket` disponible ?                                    |
| `server/src/routes/char-sheet.js`            | Vérifier           | ❌ **Doute 4** | Logique de `promoted`                                    |


---

---

---

## **🎯 Prochaines Étapes (Pour Résoudre les Doutes)**

1. **Lire `woundConstants js.md**` → Résoudre **Doute 1**.
2. **Lire `CharacterWindow.jsx.md**` → Résoudre **Doute 2**.
3. **Standardiser les localisations** → Résoudre **Doute 3**.
4. **Lire `char-sheet.js` (backend)** → Résoudre **Doute 4**.
5. **Définir où calculer la pire blessure** → Résoudre **Doute 5**.

---

---

## **❓ Questions pour Saar (Pour Avancer)**

1. **Pour `woundConstants.js**` :
  - Les constantes `WOUND_SEVERITIES` et `SEVERITY_COLORS` **existent-elles déjà** ?
  - Si oui, **quelles sont leurs valeurs exactes** ?
2. **Pour `socket` dans `CharacterWindow**` :
  - `**socket` est-il disponible** dans `CharacterWindow.jsx` en Session 53 ?
3. **Pour les localisations** :
  - Doit-on **standardiser en minuscules** (comme dans `WoundManager`) ou **créer un mapping** ?
4. **Pour la logique de `promoted**` :
  - Est-ce que **toutes les modifications de blessures** peuvent déclencher une promotion ?
5. **Pour la silhouette** :
  - **Où calculer la pire blessure par localisation** : dans `Silhouette.jsx` ou `CharacterSheet.jsx` ?

---

---

## **📌 Conclusion**

**La documentation est complète à 90%**, mais **5 doutes bloquants** subsistent.  
**Je ne finalise rien** avant d’avoir :

- ✅ **Réponses aux 5 questions ci-dessus**.
- ✅ **Vérification des fichiers concernés**.

**Prochaine action** :

- **Attendre vos réponses** ou **lire les fichiers manquants** pour résoudre les doutes.

*(Je reste en attente de vos instructions, Saar.)*