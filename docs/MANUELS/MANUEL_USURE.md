# MANUEL_USURE.md — Logique de jeu pour le matériel et l'usure

> Version : 1.2 — 2026-08-07 (révisée après analyse critique V2)
> Statut : Proposition validée pour implémentation
> Responsabilité unique : Traduire les règles RAW du Livre de Base Polaris (chapitre Équipement,
> sections Acquisition, Intégrité, Tests de panne, Réparation, Usure) en logique de jeu pour Enclume.
> Ce document ne contient pas de code, de schéma SQL ni d'architecture technique.
> Ces aspects seront détaillés dans `docs/PLANS/PLAN_USURE.md`.
>
> Sources : `docs/REGLES/REGLE_USURE&INTEGRITE.md` (RAW), `docs/VOCABULARY.md`, échanges Saar 2026-08-07.

---

## 1. Concepts de base

| Terme | Définition | Source |
|---|---|---|
| **Niveau Technologique (NT)** | Degré de maturité technologique d'un équipement, de I (dépassé) à VII (inconnu). Détermine la difficulté de production, de réparation et la rareté. | RAW Polaris [VÉRIFIÉ] |
| **Intégrité (ITG)** | Mesure de l'état général et de la fiabilité d'une pièce d'équipement, notée sur 25. Deux valeurs : **ITG courante** (état actuel) et **ITG max** (potentiel maximal, dépendant de la qualité de fabrication). | RAW Polaris [VÉRIFIÉ] |
| **Test de panne** | Jet de 1D20 sous l'ITG courante pour déterminer si un équipement tombe en panne lors d'une utilisation critique. | RAW Polaris [VÉRIFIÉ] |
| **Qualité** | Niveau de fabrication d'un modèle d'équipement : Bas coût, Bon marché, Standard, Bonne qualité, Excellente. Détermine l'ITG max et influence le prix et la disponibilité. | RAW Polaris [VÉRIFIÉ], second extrait [VÉRIFIÉ] |
| **Occasion** | Un équipement acheté sur le marché légal est considéré comme d'occasion. Son ITG courante est aléatoire, selon une formule dépendant de sa qualité. Un équipement acheté au marché noir est neuf et possède ITG courante = ITG max. | RAW Polaris [VÉRIFIÉ] |
| **Électronique (flag `is_electronic`)** | Propriété définie dans le catalogue (`ref_equipment`) indiquant qu'un objet est vulnérable aux impulsions électromagnétiques (IEM). Indépendant du NT. | [INFÉRÉ, décision Saar 2026-08-07] |
| **Panne (`malfunction_severity`)** | État de fonctionnement d'un objet après un test de panne. Trois valeurs : `NULL` (fonctionnel), `'simple'` (réparable normalement), `'critical'` (nécessite un atelier). | [INFÉRÉ, décision Saar 2026-08-07] |

---

## 2. Niveaux Technologiques (NT)

### 2.1 Définition des niveaux

Les NT sont définis dans `ref_equipment.tech_level` (colonne existante, migration 48) [VÉRIFIÉ].

| NT | Désignation | Exemples |
|---|---|---|
| I | Technologie dépassée | Outils primitifs, armes blanches simples |
| II | Technologie actuelle (notre monde) | Armes à feu simples, électronique basique |
| III | Technologie avancée (standard Polaris) | Armes à énergie, ordinateurs courants |
| IV | Technologie de pointe | Armes militaires, équipement de grande nation |
| V | Technologie azuréenne | Artéfacts de l'Alliance Azure |
| VI | Technologie généticienne connue | Artéfacts partiellement compréhensibles, non reproductibles |
| VII | Technologie inconnue | Artéfacts généticiens non compris |

### 2.2 Impact sur la réparation

Les tests de réparation (complète comme bricolage de fortune) sur des équipements de **NT V** subissent un **malus de -5**.  
Les tests de réparation sur des équipements de **NT VI** subissent un **malus de -7**.  
Les équipements de **NT VII** ne sont pas réparables avec les compétences actuelles. [VÉRIFIÉ, RAW]

### 2.3 Éligibilité à l'Intégrité

L'éligibilité d'un équipement aux règles d'Intégrité est déterminée par un flag **`has_integrity`** dans le catalogue de référence (`ref_equipment`).  
Par défaut, ce flag est activé pour les équipements de **NT II et supérieur**. Le MJ peut le modifier manuellement pour inclure ou exclure des objets spécifiques.  
Les objets sans `has_integrity` ne possèdent pas d'ITG : les colonnes correspondantes dans l'inventaire restent vides (NULL), et ces objets sont ignorés par tous les calculs d'usure et de panne. [INFÉRÉ, décision Saar 2026-08-07]

---

## 3. Intégrité et Qualité

### 3.1 Niveaux de qualité et ITG max

Chaque modèle d'équipement possède un niveau de **qualité** qui définit son **ITG max absolue** (la valeur maximale que peut atteindre l'objet, même neuf). Ce niveau est fixé par le MJ dans l'interface des Marchands, ou déterminé par le catalogue de référence. La qualité influence également le prix et la disponibilité.

| Qualité | ITG max absolue | Formule ITG occasion | Modificateur de prix | Modificateur de disponibilité |
|---|---|---|---|---|
| Bas coût | 5 | 1D4+1 | -70% | DIS +6 |
| Bon marché | 10 | 1D6+4 | -50% | DIS +4 |
| Standard | 15 | 2D6+3 | -20% | DIS +2 |
| Bonne qualité | 20 | 2D6+6 | 0% (référence) | — |
| Excellente qualité | 25 | 3D6+5 | +30% à +50% | DIS -3 |

[VÉRIFIÉ, RAW second extrait, clarification Saar 2026-08-07]

> **Note :** La colonne « Modificateur de disponibilité » reflète la règle RAW. En l'absence actuelle d'un système de disponibilité dans Enclume, ces valeurs sont indicatives pour le MJ et seront appliquées automatiquement lorsque la mécanique sera implémentée.

> **Note :** La formule « ITG occasion » détermine l'ITG courante lors d'un achat d'occasion (marché légal). Pour un achat neuf (marché noir), l'ITG courante est égale à l'ITG max absolue.

### 3.2 ITG courante à l'acquisition

- **Achat neuf (marché noir)** : ITG courante = **ITG max absolue** de la qualité.
- **Achat d'occasion (marché légal)** : ITG courante = résultat de la **formule d'occasion** de la qualité (cf. tableau ci-dessus), plafonnée à l'ITG max absolue.
- **Découverte sur le terrain / don du MJ** : l'ITG courante et l'ITG max sont fixées manuellement par le MJ (valeurs par défaut proposées : ITG max = 15, ITG courante = 15). Un bouton « Lancer ITG occasion » est disponible ; il utilise la formule associée à la qualité de l'objet (2D6+6 par défaut si aucune qualité n'est définie). Le MJ peut ajuster le résultat. [INFÉRÉ, décision Saar 2026-08-07]

### 3.3 Plages d'ITG et état général

L'ITG courante détermine l'état général de l'équipement et ses effets mécaniques :

| ITG courante | État | Bonus/Malus à l'utilisation | Risque de panne |
|---|---|---|---|
| 21-25 | Excellent état | **+2** | Seulement sur circonstances spéciales (attaque IEM…) |
| 16-20 | Bon état | Aucun | Seulement sur Catastrophe |
| 11-15 | État moyen | Aucun | Sur Catastrophe + utilisation intensive |
| 6-10 | Usagé | **-3** | Sur Catastrophe + utilisation intensive |
| 1-5 | Endommagé | **-5** | Sur tout échec simple |
| 0 | Hors d'usage | Inutilisable | — |

[VÉRIFIÉ, RAW]

### 3.4 Perte définitive d'ITG max

Certains événements réduisent définitivement l'**ITG max**, sans possibilité de récupération :
- Changement de palier d'état (ex. passer de « Bon état » à « État moyen ») → **-1 ITG max**.
- Perte de **5 points d'ITG ou plus en une seule fois** → **-1 ITG max**.
- Usure naturelle (fin de scénario, conditions rudes) → **-1 ITG max** pour les objets sensibles, à la discrétion du MJ.

L'ITG courante ne peut jamais dépasser l'ITG max. Si une perte définitive survient alors que l'ITG courante est supérieure au nouveau max, l'ITG courante est ramenée au nouveau max.

**En V1, le système ne détecte pas automatiquement ces événements. C'est au MJ d'appliquer les ajustements manuellement via l'interface d'inventaire.** [VÉRIFIÉ, RAW, décision Saar 2026-08-07]

---

## 4. Test de panne

### 4.1 Mécanisme du test

Le test de panne est un **jet simple de 1D20** comparé à l'**ITG courante** de l'objet.  
Aucun modificateur (compétence, attribut, bonus) ne s'applique — c'est un jet de fiabilité pure. [VÉRIFIÉ, RAW]

- **Réussite** : `1D20 ≤ ITG courante` → rien ne se passe.
- **Échec** : `1D20 > ITG courante` → l'objet **perd 1 point d'ITG courante** et **cesse de fonctionner** (panne simple). Il peut être réparé (voir §5.1).
- **Catastrophe** : `1D20 = 1` (naturel) → l'objet **perd 1D6 points d'ITG courante** et **cesse de fonctionner** (panne critique). Il nécessite une réparation en atelier (voir §5.3).

Si l'ITG courante atteint **0 ou moins**, l'objet est **hors d'usage** (inutilisable, `malfunction_severity = 'critical'`, ITG courante = 0). Pour les armes, une Catastrophe réduisant l'ITG à 0 ou moins provoque une **explosion** (voir §5.4).

> **Justification du 1 naturel comme Catastrophe :** Le système Polaris standard définit une Catastrophe par un échec avec une marge importante. Pour le test de panne, utiliser un seuil basé sur la marge d'échec (ex. échec de 10+) rendrait les objets à faible ITG **plus** susceptibles de subir une catastrophe, ce qui est contre-intuitif. Un 1 naturel donne une probabilité fixe de 5 %, indépendante de l'état de l'objet, et correspond à l'esprit « malchance extrême » du RAW. [INFÉRÉ, décision Saar 2026-08-07]

### 4.2 Déclencheurs du test de panne

#### Automatiques (résolus par le système sans intervention humaine)

- **Catastrophe (échec critique) lors d'un test utilisant l'objet** : chaque fois qu'un personnage subit une Catastrophe (résultat ≥ seuil de Catastrophe) sur un test de compétence employant un objet soumis à l'Intégrité, cet objet effectue immédiatement un test de panne. **En V1, ce déclencheur ne s'applique automatiquement qu'aux armes lors des actions de combat.** Pour les autres équipements, le MJ utilisera le bouton « Usage intensif » (voir ci-dessous). [INFÉRÉ, décision Saar 2026-08-07, limitation V1]
- **Attaque IEM (Impulsion Électromagnétique)** : si un personnage est la cible d'une attaque IEM, tous ses équipements **portés sur lui** (Sac, Ceinture, slots équipés) et portant le flag `is_electronic` effectuent un test de panne. Les objets dans le Coffre (stockage distant) ne sont pas affectés. [INFÉRÉ]
- **Échec simple avec ITG ≤ 5** : si un test utilisant l'objet échoue (sans être une Catastrophe) et que l'ITG courante de l'objet est entre 1 et 5, l'objet effectue un test de panne. **En V1, ce déclencheur ne s'applique automatiquement qu'aux armes en combat**, car le système ne référence pas encore l'objet utilisé pour les tests hors combat. Pour les autres équipements, le MJ utilisera le bouton « Usage intensif ». [VÉRIFIÉ, RAW, limitation V1 décidée 2026-08-07]

#### Manuel (sur intervention humaine)

- **Utilisation intensive ou non conventionnelle** : le MJ peut déclencher un test de panne via un bouton « Usage intensif » sur l'interface d'inventaire. Ce bouton peut être utilisé à tout moment, y compris en combat. [INFÉRÉ, décision Saar 2026-08-07]

### 4.3 Sélection de l'objet testé

- **Pour une arme utilisée en combat** : l'arme active (identifiée par le slot d'arme ou l'action de combat en cours) est l'objet du test.
- **Pour un test de compétence hors combat** : l'objet utilisé est déterminé contextuellement. En V1, seul le cas des armes est automatisé. Pour les autres cas, le MJ peut déclencher manuellement un test de panne sur n'importe quel objet via le bouton « Usage intensif ». [INFÉRÉ, limitation V1]

### 4.4 État de panne

Un objet qui cesse de fonctionner à la suite d'un test de panne voit son champ `malfunction_severity` modifié automatiquement :
- Après un **échec simple** : `malfunction_severity = 'simple'`. L'objet est inutilisable mais peut être réparé normalement (cf. §5.1).
- Après une **Catastrophe** : `malfunction_severity = 'critical'`. L'objet est inutilisable et nécessite une réparation en atelier (cf. §5.3).

Le MJ peut également modifier manuellement ce champ via un bouton à bascule « Opérationnel / Réparation simple / Réparation en atelier » dans l'interface d'inventaire. **Ce bouton est un outil de dépannage pour le MJ ; il ne devrait pas être utilisé pour contourner la mécanique normale.** [INFÉRÉ, décision Saar 2026-08-07]

---

## 5. Réparation

### 5.1 Réparation hors combat (Réparation complète)

#### Interface

Depuis la Sidebar → Outils → Réparation, le joueur voit la liste de tous les objets **qu'il porte sur lui** (Sac, Ceinture, ou équipés via un slot) dont l'**ITG courante < ITG max** et dont le `malfunction_severity` n'est pas `'critical'`. [INFÉRÉ, décision Saar 2026-08-07]

Pour chaque objet, une compétence de réparation par défaut est suggérée (ex. Armurerie pour une arme, Électronique pour un gadget, Informatique pour un ordinateur). Le **MJ peut modifier cette compétence** dans l'interface de validation. [INFÉRÉ]

#### Flux

1. Le joueur sélectionne un objet et clique sur « Réparer ».
2. Le MJ reçoit une notification : « [Joueur] souhaite réparer [Objet] avec [Compétence] ».
3. Le MJ peut :
   - **Accepter** : un test de compétence est lancé (le joueur clique sur le dé). Le résultat est appliqué automatiquement.
   - **Modifier** : le MJ change la compétence proposée, puis accepte.
   - **Refuser** : si le personnage n'a pas l'outillage, les pièces ou le temps nécessaires, le MJ rejette la demande.
4. Une fois le test lancé :
   - **Réussite** : le **modificateur de réussite** (marge de succès positive) détermine le nombre de **points d'ITG récupérés**. L'ITG courante augmente, sans dépasser l'ITG max. Si l'objet était en panne (`malfunction_severity = 'simple'`), il redevient fonctionnel (`malfunction_severity = NULL`).
   - **Échec simple** : l'objet n'est pas réparé. Il reste dans son état actuel (en panne si applicable), sans perte supplémentaire d'ITG. Le temps et les ressources investis sont perdus.
   - **Catastrophe** : l'objet perd **définitivement 1 point d'ITG max**. L'ITG courante reste inchangée (ou diminue si elle dépasse le nouveau max). L'objet reste en panne. [VÉRIFIÉ, RAW pour la Catastrophe ; INFÉRÉ pour l'échec simple, décision Saar 2026-08-07]

#### Malus de réparation selon le NT

Les malus suivants s'appliquent **au test de compétence** de réparation (complète comme bricolage) :
- **NT V** : malus de **-5** au test.
- **NT VI** : malus de **-7** au test.
- **NT VII** : objet non réparable. [VÉRIFIÉ, RAW]

### 5.2 Bricolage de fortune (en combat)

En combat, un personnage peut tenter de **débloquer** un objet en panne simple (`malfunction_severity = 'simple'`) par un bricolage rapide, sans atelier. Le temps nécessaire est de **1D6 tours**. Ce mécanisme n'est pas automatisé en V1 — le MJ peut le résoudre manuellement en ajustant l'état de l'objet via l'interface d'inventaire. [VÉRIFIÉ, RAW, décision Saar 2026-08-07]

Une action de combat dédiée « Bricolage » pourra être implémentée ultérieurement (avec probablement un test de compétence assorti d'un malus, à définir).

### 5.3 Réparation en atelier (panne critique)

Si un objet est en panne critique (`malfunction_severity = 'critical'`), la réparation ordinaire est impossible. La remise en état nécessite :
- Un **technicien expert** possédant la compétence appropriée.
- Un **atelier ou laboratoire spécialisé**.
- Du **temps** (laissé à la discrétion du MJ).

Le flux de réparation en atelier n'est pas automatisé en V1 — le MJ ajuste manuellement l'ITG et le statut de panne après avoir déterminé les conditions remplies. [INFÉRÉ]

### 5.4 Explosion de l'arme

Si une **Catastrophe de test de panne** réduit l'ITG d'une arme à **0 ou moins**, l'arme **explose**. Les dégâts infligés à l'utilisateur sont laissés à la discrétion du MJ (le RAW ne fournit pas de règle précise). L'arme est détruite. [VÉRIFIÉ, RAW]

---

## 6. Usure et perte définitive (manuelle)

En V1, l'usure et les pertes définitives sont **entièrement manuelles**. Le MJ dispose des interfaces suivantes :

- **Ajustement de l'ITG courante** : un champ éditable sur chaque objet de l'inventaire permet au MJ (ou au propriétaire avec les droits appropriés) de modifier `integrity_current`.
- **Ajustement de l'ITG max** : idem pour `integrity_max`.
- **Perte définitive** : le MJ réduit manuellement `integrity_max` selon les règles RAW (changement de palier, perte massive, fin de scénario).
- **Affichage** : l'interface d'inventaire présente l'ITG sous forme de fraction (ex. « 12/15 ») et une pastille de couleur indiquant le palier d'état (vert pour Excellent, rouge pour Endommagé, etc.), avec le modificateur associé. [INFÉRÉ, décision Saar 2026-08-07]

Le système ne calcule pas automatiquement l'usure au fil du temps, ni les pertes définitives lors des transitions de palier. Ces règles RAW sont appliquées par le MJ avec l'assistance de l'interface. [INFÉRÉ, décision Saar 2026-08-07]

---

## 7. Application automatique des bonus/malus d'ITG

### 7.1 Armes en combat

Lors d'une action d'attaque (mêlée ou tir), le système lit automatiquement l'ITG de l'arme utilisée (`char_inventory.integrity_current`) et applique le bonus/malus correspondant au **test d'attaque**. En V1, ce bonus/malus s'applique uniquement aux jets d'attaque (les autres utilisations de l'arme, comme la parade, seront étudiées ultérieurement).

| ITG courante | Modificateur appliqué au test |
|---|---|
| 21-25 | **+2** |
| 16-20 | 0 |
| 11-15 | 0 |
| 6-10 | **-3** |
| 1-5 | **-5** |
| 0 | Attaque impossible (arme hors d'usage) |

Ce modificateur est cumulable avec tous les autres bonus/malus (compétence, attribut, portée, etc.). Il est affiché dans le récapitulatif de l'action avant le jet. [INFÉRÉ, décision Saar]

### 7.2 Autres équipements (hors combat)

En V1, les bonus/malus d'ITG ne sont **pas** appliqués automatiquement aux tests de compétence hors combat (ex. Informatique avec un ordinateur usagé). Le joueur peut ajouter manuellement le malus via le champ « Modificateur » de la macro ou du test, s'il le souhaite. Pour faciliter cela, **l'interface d'inventaire doit afficher clairement, pour chaque objet, une pastille de couleur ou une icône indiquant le palier d'ITG et le modificateur associé** (ex. « -3 précision » en rouge pour un objet usagé). L'automatisation pour les compétences non-combat sera étudiée dans une version ultérieure, lorsque le système de test pourra référencer l'objet utilisé. [INFÉRÉ, limitation V1]

---

## 8. Interaction avec les Catastrophes de combat

Le système d'Intégrité est un prérequis pour mécaniser certaines Catastrophes de combat. Les connexions suivantes sont prévues :

- **Catastrophe #2 « Arme inutilisable »** : l'arme subit une perte d'ITG (montant exact à définir) sans test de panne, et cesse de fonctionner.
- **Catastrophe #8 « Panne d'un système »** : un test de panne est déclenché sur un équipement du personnage (choisi par le MJ ou aléatoirement parmi les objets électroniques portés). La sélection du système sera précisée dans le PLAN.

Ces catastrophes ne sont pas encore implémentées ; elles dépendent de la disponibilité du système d'Intégrité. [INFÉRÉ]

---

## 9. Règles optionnelles et modularité

Les règles suivantes sont considérées comme **optionnelles** et peuvent être activées/désactivées au niveau de la campagne (option de campagne future) ou simplement ignorées par le MJ :

- **Usure automatique** (perte d'ITG courante par utilisation courante) : non implémentée en V1.
- **Perte définitive automatique** (changement de palier, perte massive) : non implémentée en V1.
- **Gestion des pièces détachées** : non implémentée en V1.

Le système permet au MJ de gérer manuellement tous ces aspects via les champs d'ITG éditables, offrant une flexibilité maximale sans imposer de complexité. [INFÉRÉ]

---

## 10. Décisions d'implémentation (écarts assumés)

| Décision | Justification |
|---|---|
| **Pas de pièces détachées** | Simplification V1 ; le MJ gère les conditions de réparation manuellement. |
| **Pas d'usure automatique** | Complexité d'implémentation ; le MJ dispose d'une interface manuelle complète. |
| **Bonus/malus automatique limité aux armes en combat** | Les tests hors combat ne référencent pas encore d'équipement. Extension future. |
| **Catastrophe de test de panne = 1 naturel** | Probabilité fixe de 5 %, indépendante de l'ITG, évite les effets contre-intuitifs d'un seuil de marge. |
| **Qualité fixe par item de catalogue marchand** | Simplicité d'interface ; le MJ peut créer plusieurs entrées pour simuler un choix. |
| **Flag `has_integrity` plutôt que règle rigide NT** | Flexibilité maximale pour le MJ. |
| **Flag `is_electronic` pour les attaques IEM** | Permet de cibler précisément les équipements sensibles sans se baser uniquement sur le NT. |
| **Réparation experte non automatisée en V1** | La logique d'atelier, de temps et de technicien expert est trop complexe à modéliser pour V1. |
| **Deux types de réparation : complète (test normal) et bricolage (en combat, manuel en V1, test avec malus à définir)** | Respect du RAW ; le bricolage sera automatisé ultérieurement. |
| **Validation MJ systématique pour les réparations** | Le MJ doit vérifier la disponibilité du temps, de l'outillage et des compétences. |

---

## 11. Hors-scope explicite

- **Exo-armures** : elles possèdent leurs propres règles d'Intégrité (Structure, Exosquelette, Générateur), documentées dans `docs/PLANS/PLAN_EXOARMURE.md` et `MANUELS/MANUEL_EXOARMURE.md`.
- **Drones** : idem, Intégrité propre gérée via `/drone/integrity`.
- **Véhicules** : règles RAW distinctes (chapitre Navires et véhicules), non couvertes.
- **Pièces détachées** : abandonnées en V1.
- **Usure automatique et perte définitive automatique** : non implémentées.
- **Réparation en combat automatisée (action « Bricolage »)** : manuelle en V1, pourra être automatisée ultérieurement.

---

## 12. Références et documents liés

| Document | Rôle |
|---|---|
| `docs/REGLES/REGLE_USURE&INTEGRITE.md` | Source RAW unique (NT, ITG, pannes, réparation, usure) |
| `docs/VOCABULARY.md` | Définitions canoniques des termes (à enrichir avec ITG, NT, Test de panne, Qualité, Panne) |
| `docs/SYSTEME/CHARACTER.md` | Autorité de l'inventaire (`char_inventory`) et du catalogue (`ref_equipment`) |
| `docs/SYSTEME/TRADE.md` | Système de marchands, flux d'achat (point d'entrée pour la génération d'ITG) |
| `docs/SYSTEME/COMBAT.md` | Architecture de combat (consommateur du bonus/malus d'ITG) |
| `docs/PLANS/PLAN_USURE.md` | (à créer) Plan technique détaillant les migrations, les services et les composants nécessaires |