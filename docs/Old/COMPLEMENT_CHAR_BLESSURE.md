---
# **Système de Blessures de Polaris – Documentation Technique et Fonctionnelle**
**Version** : 1.0
**Date** : 06/05/2026
**Contexte** : Intégration dans le VTT Enclume (projet interne).
**Public cible** : Développeurs, designers, MJ, et agents IA.
**Objectif** : Comprendre **à 100%** le système de blessures de Polaris pour une implémentation fidèle dans le VTT.

---

---

## **📌 Sommaire**
1. [Introduction et principes généraux](#1-introduction-et-principes-généraux)
2. [Structure des compteurs de blessures](#2-structure-des-compteurs-de-blessures)
3. [Gravités, malus et effets par localisation](#3-gravités-malus-et-effets-par-localisation)
4. [Tests de Choc](#4-tests-de-choc)
5. [États de santé (Étourdi, Inconscient, Coma)](#5-états-de-santé-étourdi-inconscient-coma)
6. [Stabilisation des blessures](#6-stabilisation-des-blessures)
7. [Aggravation et états des blessures](#7-aggravation-et-états-des-blessures)
8. [Exemples concrets](#8-exemples-concrets)
9. [Points de vigilance et FAQ](#9-points-de-vigilance-et-faq)
10. [Annexes](#10-annexes)

---

---

## **1. Introduction et principes généraux**
### **1.1. Philosophie du système**
Le système de blessures de Polaris est conçu pour :
- **Modéliser réalistement** l’impact des dégâts physiques sur un personnage.
- **Simplifier la gestion** en évitant les calculs complexes (ex : malus non cumulatifs).
- **Ajouter une dimension stratégique** via les Tests de Choc et la stabilisation.

### **1.2. Concepts clés**
| Terme               | Définition                                                                                     |
|---------------------|------------------------------------------------------------------------------------------------|
| **Seuil de blessure** | Valeur de dégâts cumulés déclenchant une blessure (ex : 5 pts → légère).                     |
| **Localisation**     | Partie du corps touchée (Tête, Corps, Bras D/G, Jambe D/G).                                    |
| **Gravité**          | Niveau de sévérité (Légère, Moyenne, Grave, Critique, Mortelle, Mort/Membre détruit).         |
| **Compteur**         | Tableau de cases à cocher par localisation et gravité.                                         |
| **Malus**            | Pénalité appliquée aux tests de compétences (ex : -5 pour une blessure grave).               |
| **Test de Choc**     | Jet de dés pour déterminer si le personnage est étourdi/inconscient à cause de la douleur.   |
| **Stabilisation**    | Action médicale pour éviter l’aggravation d’une blessure critique/mortelle.               |
| **Aggravation**      | Passage automatique à une gravité supérieure si une ligne de compteur est pleine.         |

### **1.3. Règles fondamentales**
1. **Cumul des dégâts** : Les points de dégâts s’additionnent jusqu’à atteindre un seuil → blessure correspondante.
2. **Hiérarchie des malus** : Seul le **malus de la blessure la plus grave par localisation** est appliqué.
3. **Promotion automatique** : Si une ligne de gravité est pleine, la prochaine blessure de même gravité fait monter d’un niveau.
4. **Tests de Choc** : Déclenchés pour les blessures **graves ou supérieures** (selon localisation).
5. **Stabilisation obligatoire** : Pour les blessures **critiques, mortelles, ou membre détruit**.

---

---

## **2. Structure des compteurs de blessures**
### **2.1. Localisations et lignes de gravité**
Chaque **localisation** a un compteur indépendant avec un **nombre fixe de cases par gravité** :

| Localisation       | Légères | Moyennes | Graves | Critiques | Mortelles | Mort/Membre détruit |
|--------------------|---------|----------|--------|-----------|-----------|---------------------|
| **Tête**           | 3       | 3        | 2      | 2         | 1         | Mort                |
| **Corps**          | 4       | 3        | 3      | 2         | 2         | Mort                |
| **Bras (D/G)**     | 3       | 3        | 2      | 2         | 1         | Membre détruit      |
| **Jambe (D/G)**    | 3       | 3        | 2      | 2         | 1         | Membre détruit      |

### **2.2. Mécanisme de promotion automatique**
- **Déclenchement** : Quand une ligne de gravité est **complètement remplie** et qu’une nouvelle blessure de **même gravité** est ajoutée.
- **Action** :
  1. **Toutes les cases de la ligne actuelle sont effacées**.
  2. **1 case est cochée dans la ligne de gravité supérieure**.
- **Exemple** :
  - Tête : 3 blessures légères (ligne pleine) + 1 légère → **1 moyenne** (ligne légère vidée).

### **2.3. Visuel des compteurs**
- **Couleurs par gravité** :
  | Gravité          | Couleur       | Exemple visuel (case) |
  |------------------|---------------|-----------------------|
  | Légère           | Jaune clair   | ⬜ (vide) → 🟡 (cochée) |
  | Moyenne          | Orange        | ⬜ → 🟠               |
  | Grave            | Rouge clair   | ⬜ → 🔴               |
  | Critique         | Rouge foncé   | ⬜ → 🟥               |
  | Mortelle         | Noir          | ⬜ → ⬛               |
  | Mort/Membre détruit | Gris       | ⬜ → ⚫               |

- **État des blessures** :
  - **Normale** : Case cochée avec la couleur de gravité.
  - **Stabilisée** : Case cochée avec un **contour vert** (ou autre indicateur visuel).

---

---

## **3. Gravités, malus et effets par localisation**
### **3.1. Tableau des malus et effets**
| Gravité          | Malus aux Tests | Stabilisation nécessaire ? | Test de Choc nécessaire ? | Effets spécifiques (par localisation)                                                                 |
|------------------|-----------------|----------------------------|----------------------------|-------------------------------------------------------------------------------------------------------|
| **Légère**       | -1              | Non                        | Non                        | Aucun effet supplémentaire.                                                                          |
| **Moyenne**      | -3              | Non                        | Non                        | Aucun effet supplémentaire.                                                                          |
| **Grave**        | -5              | Non                        | **Oui** (Tête/Corps)       | **Tête** : Test de Choc (-5). **Corps** : Test de Choc. **Bras/Jambe** : Allure moyenne max.          |
| **Critique**     | -10             | **Oui**                   | **Oui**                   | **Tête** : Test de Choc (-10). **Corps** : Allure lente max. **Bras** : Allure moyenne max. **Jambe** : Déplacement impossible. |
| **Mortelle**     | -20             | **Oui**                   | **Oui**                   | **Tête/Corps** : Inconscience/Coma. **Bras/Jambe** : Risque mort imminent.                              |
| **Mort/Membre détruit** | Mort immédiate ou membre détruit | Non applicable | Non | **Tête/Corps** : Mort subite. **Bras/Jambe** : Membre détruit (paralysie permanente).               |

### **3.2. Effets détaillés par localisation**
#### **Tête**
| Gravité       | Malus | Test de Choc | Effets                                                                                     |
|---------------|-------|--------------|--------------------------------------------------------------------------------------------|
| Légère        | -1    | Non          | Aucun.                                                                                     |
| Moyenne       | -3    | Non          | Aucun.                                                                                     |
| Grave         | -5    | Oui (-5)     | Test de Choc. Si échoue → Étourdi.                                                          |
| Critique      | -10   | Oui (-10)    | Test de Choc. Si échoue → Inconscient.                                                     |
| Mortelle      | -20   | Oui (-15)    | Test de Choc. Si échoue → Coma. **Stabilisation obligatoire** (sinon mort en `Constitution` minutes). |
| Mort          | Mort  | Non          | Mort immédiate.                                                                           |

#### **Corps**
| Gravité       | Malus | Test de Choc | Effets                                                                                     |
|---------------|-------|--------------|--------------------------------------------------------------------------------------------|
| Légère        | -1    | Non          | Aucun.                                                                                     |
| Moyenne       | -3    | Non          | Aucun.                                                                                     |
| Grave         | -5    | Oui          | Test de Choc. Si échoue → Étourdi.                                                          |
| Critique      | -10   | Oui          | Test de Choc. Allure **lente max**.                                                        |
| Mortelle      | -20   | Oui          | Test de Choc. **Risque mort imminent** (stabilisation obligatoire).                        |
| Mort          | Mort  | Non          | Mort immédiate.                                                                           |

#### **Bras (Droit/Gauche)**
| Gravité       | Malus | Test de Choc | Effets                                                                                     |
|---------------|-------|--------------|--------------------------------------------------------------------------------------------|
| Légère        | -1    | Non          | Aucun.                                                                                     |
| Moyenne       | -3    | Non          | Aucun.                                                                                     |
| Grave         | -5    | Non          | Allure **moyenne max**.                                                                     |
| Critique      | -10   | Oui          | Test de Choc. Allure **moyenne max**.                                                       |
| Mortelle      | -20   | Oui          | **Risque mort imminent** (stabilisation obligatoire).                                      |
| Membre détruit | -     | Non          | **Membre détruit** (paralysie permanente).                                                |

#### **Jambe (Droite/Gauche)**
| Gravité       | Malus | Test de Choc | Effets                                                                                     |
|---------------|-------|--------------|--------------------------------------------------------------------------------------------|
| Légère        | -1    | Non          | Aucun.                                                                                     |
| Moyenne       | -3    | Non          | Aucun.                                                                                     |
| Grave         | -5    | Non          | Allure **moyenne max**.                                                                     |
| Critique      | -10   | Oui          | Test de Choc. **Déplacement impossible**.                                                   |
| Mortelle      | -20   | Oui          | **Risque mort imminent** (stabilisation obligatoire).                                      |
| Membre détruit | -     | Non          | **Membre détruit** (paralysie permanente).                                                |

---
---

## **4. Tests de Choc**
### **4.1. Déclenchement**
- **Quand ?** : Pour les blessures **graves ou supérieures** (selon la localisation).
  - **Tête** : Grave, Critique, Mortelle.
  - **Corps** : Grave, Critique, Mortelle.
  - **Bras/Jambe** : Critique, Mortelle.

### **4.2. Mécanisme**
1. **Lancer 1D20**.
2. **Comparer au Seuil d’Étourdissement et d’Inconscience** du personnage :
   - **Résultat ≤ Seuil d’Étourdissement** → **Pas d’effet**.
   - **Seuil d’Étourdissement < Résultat ≤ Seuil d’Inconscience** → **Étourdi**.
   - **Résultat > Seuil d’Inconscience** → **Inconscient** (ou Coma si blessure mortelle).

### **4.3. Malus au Test de Choc**
- **Malus = malus de la blessure** (ex : blessure grave à la Tête → malus -5 au Test de Choc).
- **Non cumulable** : Seul le malus le plus élevé s’applique (ex : si un personnage a une blessure grave (-5) et critique (-10), seul **-10** compte).

### **4.4. Seuils par défaut (à confirmer)**
| État               | Seuil d’Étourdissement | Seuil d’Inconscience |
|--------------------|------------------------|-----------------------|
| **Personnage standard** | 10                     | 15                    |
| **Personnage robuste**  | 12                     | 18                    |
*(Note : Ces valeurs sont des suggestions. À valider avec les règles officielles ou le MJ.)*

---
---

## **5. États de santé (Étourdi, Inconscient, Coma)**
### **5.1. Étourdi**
- **Effets** :
  - Malus **-5 supplémentaire** à tous les tests.
  - **Déplacement limité à l’Allure moyenne max**.
  - **Ne peut pas attaquer** (peut se défendre).
- **Durée** :
  - **1D6 minutes** (ou valeur fixe à définir).
  - **Réveil automatique** après la durée.

### **5.2. Inconscient**
- **Effets** :
  - **Aucune action possible** (ni attaque, ni déplacement, ni test).
  - **Inconscient de son environnement**.
- **Durée** :
  - **1D6 heures** (ou valeur fixe).
  - **Réveil automatique** → **Étourdi pendant 1D6 minutes**.

### **5.3. Coma**
- **Effets** :
  - **Aucune action possible**.
  - **Réveil impossible sans test réussi**.
- **Durée et réveil** :
  - **Coma léger** :
    - Test de **Chance** toutes les **1D6 heures**.
    - **Réussite** → Réveil (étourdi pendant 1D6 minutes).
    - **Échec** → Nouveau test après 1D6 heures.
    - **Au-delà de 24h** → Test **1 fois par jour**.
    - **Au-delà de 1 semaine** → Test **1 fois par semaine**.
  - **Coma profond** :
    - Test de **Chance** **1 fois par jour** (niveau de Chance divisé par 2).
    - **Au-delà de 7 jours** → Test **1 fois par semaine**.
    - **Au-delà de 4 semaines** → Test **1 fois par mois**.
- **Bonus médicaux** :
  - Équipement médical avancé → Bonus **+1 à +5** au test de Chance.

---
---

## **6. Stabilisation des blessures**
### **6.1. Quand stabiliser ?**
- **Obligatoire pour** :
  - Blessures **critiques**.
  - Blessures **mortelles**.
  - **Membre détruit** (pour éviter la mort).

### **6.2. Processus**
1. **Test de Premiers soins** (compétence médicale) :
   - **Réussite** → La blessure est **stabilisée** (pas d’aggravation).
   - **Échec** → **Mort immédiate** (pour les blessures mortelles/membre détruit).
     - Pour les blessures critiques : **Aggravation en mortelle après `2 × Constitution` minutes** (sans nouveau test réussi).

### **6.3. Effets de la stabilisation**
- **Blessure stabilisée** :
  - **Ne peut plus s’aggraver**.
  - **Conserve son malus et ses effets** (ex : une blessure critique stabilisée reste à -10).
  - **Visuel** : Case cochée avec un **indicateur vert** (ou autre).

---
---

## **7. Aggravation et états des blessures**
### **7.1. Deux états pour les blessures**
| État        | Description                                                                 | Visuel               |
|-------------|-----------------------------------------------------------------------------|----------------------|
| **Normale** | Blessure active, sujette à aggravation (suractivité, infection, etc.).    | Case colorée         |
| **Stabilisée** | Blessure stabilisée par un test de Premiers soins. **Ne s’aggrave pas**. | Case colorée + contour vert |

### **7.2. Causes d’aggravation (gérées par le MJ)**
- **Suractivité** : Combat intense après une blessure grave.
- **Infection** : Pour les blessures ouvertes (ex : coupure, perforation).
- **Échec de stabilisation** : Pour les blessures critiques/mortelles.

### **7.3. Conséquences de l’aggravation**
- La blessure **passe au niveau supérieur** (ex : moyenne → grave).
- **Effet en cascade** : Si la ligne supérieure est pleine, la promotion continue (ex : grave → critique).

---
---

## **8. Exemples concrets**
### **8.1. Exemple 1 : Blessures progressives à la Tête**
1. **3 blessures légères** (3/3 cases cochées) → Malus **-1**.
2. **+1 blessure légère** → **Promotion en moyenne** (1/3) → Malus **-3**.
3. **+1 blessure grave** → Malus **-5** + **Test de Choc (-5)**.
   - Si **Test de Choc échoue** → **Étourdi** (malus total = -10, déplacement limité).
4. **+1 blessure critique** → Malus **-10** + **Test de Choc (-10)** + **Stabilisation obligatoire**.
   - Si **stabilisation échoue** → **Mort immédiate**.
   - Si **Test de Choc échoue** → **Inconscient** (durée : 1D6 heures).

### **8.2. Exemple 2 : Blessures multiples sur plusieurs localisations**
- **Tête** : 1 blessure critique (**-10**).
- **Corps** : 1 blessure grave (**-5**).
- **Jambe droite** : 1 blessure légère (**-1**).
- **Malus global appliqué** : **-10** (seul le malus le plus élevé compte).

### **8.3. Exemple 3 : Promotion automatique à la Jambe gauche**
1. **2 blessures graves** (2/2 cases cochées) → Malus **-5** + Allure moyenne max.
2. **+1 blessure grave** → **Promotion en critique** (1/2) → Malus **-10** + **Déplacement impossible** + **Stabilisation obligatoire**.

### **8.4. Exemple 4 : Test de Choc et Coma**
- **Blessure mortelle à la Tête** → Malus **-20** + **Test de Choc (-15)**.
  - **Test de Choc échoue** → **Coma léger**.
    - **Réveil** : Test de Chance toutes les 1D6 heures.
    - **Après 24h sans réussite** → Test 1 fois par jour.

---
---

## **9. Points de vigilance et FAQ**
### **9.1. Questions fréquentes**
| Question                                                                 | Réponse                                                                                     |
|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| **Les malus de blessures sont-ils cumulatifs ?**                      | Non. Seul le **malus le plus élevé par localisation** est appliqué.                       |
| **Les malus de Choc s’ajoutent-ils aux malus de blessures ?**           | Non. Seul le **malus le plus élevé** compte (ex : -10 pour une blessure critique + -5 pour le Choc → **-10**). |
| **Que se passe-t-il si une ligne de gravité est pleine et qu’on ajoute une blessure de même gravité ?** | **Promotion automatique** : La ligne est vidée, et 1 case est cochée dans la gravité supérieure. |
| **Faut-il stabiliser une blessure grave ?**                           | Non, sauf si le MJ l’impose pour des raisons narratives.                                  |
| **Un personnage peut-il mourir d’une blessure critique non stabilisée ?** | Oui, après un délai de **`2 × Constitution` minutes** (sans test de Constitution réussi). |
| **Comment gérer les Tests de Choc pour les PNJ ?**                    | **Ignoré** pour cette implémentation (comme demandé).                                      |
| **Quelle est la durée d’un état Étourdi/Inconscient ?**                 | **Étourdi** : 1D6 minutes. **Inconscient** : 1D6 heures. **Coma** : Variable (voir [5.3](#53-coma)). |

### **9.2. Pièges à éviter**
1. **Oublier la promotion automatique** :
   - Toujours vérifier si une ligne est pleine avant d’ajouter une blessure.
2. **Appliquer plusieurs malus par localisation** :
   - **Un seul malus par localisation** (le plus élevé).
3. **Négliger les Tests de Choc** :
   - **Obligatoires** pour les blessures graves/critiques/mortelles à la Tête/Corps/Bras/Jambe.
4. **Confondre "Mort" et "Membre détruit"** :
   - **Mort** : Tête/Corps → mort subite.
   - **Membre détruit** : Bras/Jambe → membre arraché (paralysie permanente).
5. **Stabiliser une blessure légère/moyenne** :
   - **Inutile** (sauf décision du MJ).

---
---

## **10. Annexes**
### **10.1. Résumé des seuils de gravité**
| Seuil | Gravité          | Malus | Stabilisation ? | Test de Choc ? |
|-------|------------------|-------|------------------|----------------|
| 5     | Légère           | -1    | Non              | Non            |
| 10    | Moyenne          | -3    | Non              | Non            |
| 15    | Grave            | -5    | Non              | Oui (Tête/Corps) |
| 20    | Critique         | -10   | Oui              | Oui            |
| 25    | Mortelle         | -20   | Oui              | Oui            |
| 30    | Mort/Membre détruit | Mort  | Non              | Non            |

### **10.2. Résumé des effets par localisation**
| Localisation | Légère | Moyenne | Grave               | Critique               | Mortelle               |
|--------------|--------|---------|---------------------|------------------------|------------------------|
| **Tête**     | -1     | -3      | -5 + Test de Choc (-5) | -10 + Test de Choc (-10) | Coma/Inconscience     |
| **Corps**    | -1     | -3      | -5 + Test de Choc    | -10 + Allure lente    | Risque mort imminent  |
| **Bras**     | -1     | -3      | -5 + Allure moyenne | -10 + Allure moyenne  | Risque mort imminent  |
| **Jambe**    | -1     | -3      | -5 + Allure moyenne | -10 + Déplacement impossible | Risque mort imminent |

### **10.3. Glossaire**
| Terme               | Définition                                                                                     |
|---------------------|------------------------------------------------------------------------------------------------|
| **Allure**          | Vitesse de déplacement (lente, moyenne, rapide).                                              |
| **Chance**          | Attribut du personnage utilisé pour les tests de réveil en cas de coma.                        |
| **Constitution**    | Attribut déterminant la résistance aux blessures et la durée avant aggravation.             |
| **Premiers soins**  | Compétence médicale utilisée pour stabiliser une blessure.                                   |
| **Seuil**           | Valeur de dégâts déclenchant une blessure (ex : 15 pts → grave).                              |

### **10.4. Références externes**
- Livre de base de Polaris (3ème édition).
- [Légrog - Polaris](https://www.legrog.org/jeux/polaris/polaris-3eme-edition/polaris-3eme-ed-fr).
- [Black Book Editions - Forums](https://www.black-book-editions.fr/forums.php).

---
---
## **📌 Validation de la compréhension**
Cette documentation couvre **l’intégralité du système de blessures de Polaris** tel que compris et validé avec vous.
Un agent ou un développeur **vierge** peut :
1. **Comprendre la structure** des compteurs et leur fonctionnement.
2. **Appliquer les règles** de malus, de promotion, et de Tests de Choc.
3. **Gérer les états de santé** (Étourdi, Inconscient, Coma).
4. **Intégrer la stabilisation** et l’aggravation.
5. **Répondre aux questions courantes** via la FAQ.

---
**Prochaine étape** :
- Si cette documentation est **validée**, nous pouvons passer à l’**Étape 2 : Conception technique** (modèle de données, API, composants React).
- Sinon, **précisez les points à corriger ou à clarifier**.