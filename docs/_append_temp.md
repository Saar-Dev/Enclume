

---

## 6. Règles Omises — Compléments Obligatoires

Les sections suivantes complètent le manuel avec les règles du LdB non couvertes dans la version initiale. Source : REGLESYSCOMBAT.md (LdB Polaris, source de vérité absolue).

---

### 6.1 Modificateurs de Circonstances — Combat à Distance (LdB p.227)

Le pipeline balistique doit appliquer ces modificateurs AVANT le jet de tir :

#### Déplacement de la cible
| Allure cible | Modificateur |
|---|---|
| Allure moyenne | -3 |
| Allure rapide | -5 |
| Allure maximale | -7 |

#### Déplacement du tireur
| Allure tireur | Modificateur |
|---|---|
| Allure lente | -3 |
| Allure moyenne | -5 |
| Allure rapide | -7 |
| Allure maximale | Tir impossible |

#### Couverture de la cible
| Type de couverture | Modificateur |
|---|---|
| Partielle (50% du corps) | -3 |
| Importante (75% du corps) | -5 |
| Totale | Tir impossible (sauf tir en aveugle) |

#### Conditions d'eclairage
| Obscurite | Modificateur |
|---|---|
| Legere | -3 |
| Importante | -5 |
| Totale | Tir impossible (sauf tir en aveugle avec Test Observation oppose) |

#### Taille de la cible
| Taille | Modificateur |
|---|---|
| Minuscule (~30 cm) | -10 |
| Tres petite (~50 cm) | -5 |
| Petite (~1 m) | -3 |
| Moyenne (taille humaine) | 0 |
| Grande (~3 m) | +3 |
| Tres grande (~5 m) | +5 |
| Enorme (~7 m) | +10 |
| Gigantesque (10 m et +) | +15 |

**Implementation :** Ces modificateurs sont a integrer dans `resolveAssaultAction` (serveur) et dans `CombatModifiersWindow.jsx` (client). Les allures du tireur et de la cible sont disponibles via `state_vitesse` (combat_roster) et le deplacement declare (combat_actions).

---

### 6.2 Pipeline Combat au Contact (CaC) — Test d'Opposition (LdB p.222-225)

Contrairement au combat a distance (test simple), le CaC utilise un **test d'opposition** entre les deux combattants.

#### Resolution
```
[1. Verification distance]
   Engage au contact = distance <= 3m (ou selon allonge de l'arme)

[2. Test d'opposition]
   Attaquant : Test Competence CaC (Combat arme / Combat a mains nues / Armes lourdes)
   Defenseur : Test Competence CaC (meme categorie)

[3. Lecture du resultat]
   A reussit, D rate  => Attaque passe, jet de dommages
   A rate, D reussit  => Attaque bloquee (D peut contre-attaquer si Arts martiaux)
   Les deux ratent    => Rien ne se passe
   Les deux reussissent => Meilleure marge de reussite l'emporte. Egalite = rien.

[4. Dommages (si attaque passe)]
   Dommages_Bruts = Dommages_Arme + MR + Mod_Dommages_Contact (FOR)
   Dommages_Nets  = Dommages_Bruts + Mod_Resistance_Dommages_Defenseur
   Gravite = par tranche de 5 points nets

[5. Localisation]
   1D20 => table localisation (colonne "Contact" optionnelle du LdB)
```

#### Cible sans defense
Si la cible ne peut pas se defendre (surprise totale, inconsciente) : test simple avec **+5** au lieu du test d'opposition.

#### Modificateurs de situation CaC
| Situation | Mod |
|---|---|
| Attaque par le cote | -3 |
| Attaque alors qu'on est au sol | -5 |
| Position desavantageuse (espace confine) | -3 a -5 |
| Position avantageuse (sureleve, couverture) | +3 |
| Utiliser la main non directrice | -5 |
| Terrain instable | limite par Acrobatie/Equilibre |

#### Deux armes (CaC)
- Attaquant : +3 au Test de combat au contact
- Arts martiaux permettent une attaque supplementaire gratuite avec malus -5

---

### 6.3 Attaques Multiples par Tour (LdB p.218-219)

**Regle avancee — doit etre annoncee lors de la declaration d'intention.**

- Maximum **3 attaques** par tour de combat.
- Malus applique a **toutes** les attaques du tour :
  - 2 attaques : **-5** a tous les tests
  - 3 attaques : **-7** a tous les tests
- Intervalles d'initiative :
  - 1ere attaque : score d'Initiative normal
  - 2eme attaque : INI - 5
  - 3eme attaque : INI - 10
- Si une attaque est decalee au-dela de la phase 1 => **supprimee**. Le malus est ajuste.
- Une attaque qui utilise Precision (+3 INI) decale TOUTES les attaques suivantes dans le meme sens.

**Actions exclusives incompatibles avec attaques multiples :** Charge, Tir vise, Rafale longue, Tir de suppression (voir 6.4).

**Implementation :**
- `CombatActionWindow` doit permettre de declarer N attaques (1/2/3) avec affichage du malus et des phases INI calculees.
- `COMBAT_ACTION_DECLARE` insere N lignes dans `combat_actions` avec les sequences et initiative_at_execution calcules.
- `combat_actions` stocke le `multi_attack_malus` (-5 ou -7) applique au jet.

---

### 6.4 Actions Exclusives (LdB p.218-219, p.227-228)

Certaines actions n'autorisent **qu'une seule attaque** par tour :

| Action | Type | Regle |
|---|---|---|
| Charge | CaC | Exclusive. Necessite elan (deplacement court gratuit minimum). +3 attaque, +3 dommages, -7 defense jusqu'a prochaine action. |
| Tir vise | Distance | Exclusive. Immobile obligatoire. +1 test par tranche de 2 INI sacrifies (max +5). |
| Rafale longue | Distance | Exclusive. 5 a 20 balles. +2 test et +2 dommages par groupe de 5 balles. |
| Tir de suppression | Distance | Exclusive. Zone 3m de base, +3m ou +2 test par groupe de 5 balles. Test de Chance pour chaque cible dans la zone. |
| Rafale longue multi-adversaires | Distance | Exclusive. Un groupe de 5 balles par cible. Ecart max 3m entre cibles. |

**Regle de coherence :** `EXCLUSIVE_ACTIONS` dans combatSections.js doit correspondre exactement a cette liste. Une action exclusive detectee dans le payload bloque toute ligne `combat_actions` supplementaire pour ce token au meme tour.

---

### 6.5 Retarder son Action (LdB p.218)

Un joueur peut ne pas agir a sa phase d'initiative et attendre.

- Peut agir a **n'importe quelle phase ulterieure** dans le meme tour.
- Si action retardee vs action normale a la meme phase => **action retardee prioritaire** (resolue en premier).
- Si deux actions retardees a la meme phase => regles normales d'egalite d'initiative.
- Report d'un tour entier possible : agit **des la 1ere phase du tour suivant** quelle que soit son initiative.
- **Une action precipitee ne peut pas etre retardee.**

**Implementation :**
- `COMBAT_ACTION_DECLARE` avec `action_key: 'delayed'` + `target_initiative` (phase choisie).
- `startResolutionPhase` integre ces slots avec la regle de priorite.

---

### 6.6 Saisie (Lutte) — Preparation -3 INI (LdB p.226)

Effectuer une saisie sur un adversaire necessite d'abord de **reussir un test de combat au contact**. Cette saisie est une **Preparation** qui coute **-3 points d'Initiative**.

- La saisie se declare en phase d'annonce => modifie immediatement l'initiative courante (-3).
- L'action de lutte (cle / etranglement / projection) n'est executee qu'a la phase d'initiative resultante.
- Si la saisie echoue, l'action de lutte n'a pas lieu.

**Implementation :** A ajouter dans `STATE_COSTS` serveur (socket/index.js) et dans `combatSections.js`.

---

### 6.7 Reset de l'Initiative en Debut de Tour (LdB p.213)

A chaque nouveau tour, **avant les declarations**, chaque personnage redetermine son Initiative de base :

1. `current_initiative` <- `base_initiative` (remise a zero des modificateurs du tour precedent).
2. Les modificateurs de blessures/fatigue affectant `base_initiative` sont recalcules si necessaire.
3. Ensuite seulement les declarations commencent dans l'ordre croissant recalcule.

**Implementation :**
La routine `endTurn` (socket/index.js) doit executer :
```sql
UPDATE combat_roster
SET current_initiative = base_initiative
WHERE campaign_id = :campaignId
```
Ce reset doit se faire **AVANT** le passage en phase ANNOUNCEMENT du tour suivant.

---

### 6.8 Simultaneite — Note d'Implementation (LdB p.214)

Le LdB dit : egalite de Reaction = **actions simultanees** (les deux attaques se resolvent en parallele, les deux peuvent s'entretuer mutuellement avant que l'une annule l'autre).

**Limitation VTT acceptee :** Un VTT doit ordonner l'affichage. Le tiebreaker aleatoire actuel est une simplification necessaire pour l'ordre visuel. La fidelite stricte au LdB necessiterait un traitement en "groupe simultane" : les deux jets s'executent, les deux degats s'appliquent avant tout check d'incapacitation. C'est une **dette technique connue et acceptee**.

---
