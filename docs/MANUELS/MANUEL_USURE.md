# MANUEL_USURE.md — Logique de jeu pour le matériel et l'usure

> Version : 1.5 — 2026-09-08 (3ᵉ analyse à charge — « ce qui va casser à l'implémentation ») :
> - **IEM découplé** : ce n'est plus un déclencheur d'Usure V1 → chantier séparé (ROADMAP §4). Le flag
>   `is_electronic` sort du périmètre V1 (aucun consommateur). Usure V1 ajoute **2 colonnes** à `ref_equipment`
>   (`has_integrity`, qualité) ;
> - **B1 tranché** : la décision « Catastrophe combat = narratif en permanence » est **périmée** (antérieure au
>   moteur de Catastrophe). §8 (entrées #2/#8) devient un **Lot 2 explicite** via `EFFECT_HANDLERS`, pas le cœur V1 ;
> - **stacks** : `has_integrity` ⇒ `quantity = 1` — extension de la garde `isEquippableLocation` (piège P57) ;
> - **porte de panne** (§7.1/§4.4) : `malfunction_severity` non NULL → objet inutilisable, distinct du modificateur d'ITG ;
> - §4.1 : on ne lit que `isSuccess` et `catastropheRisk` du résultat ;
> - nouvelle §13 « Dépendances et risques d'implémentation » (dispatch combat, flux de réparation, curation catalogue).
> Précédent : 1.4 — 2026-09-08 (2ᵉ analyse à charge : test de panne = moteur complet + retest sur 20 ;
> une Catastrophe = une résolution ; lot 2 = helper `resolveChanceTest` ; `has_integrity` OFF à l'acquisition ;
> perte définitive = max pas cumul ; ITG ≤ 5 + usage intensif = panne systématique).
> 1.3 — 2026-09-08 (1ʳᵉ analyse à charge : Catastrophe = Marge d'échec ≥ 15 ; `has_integrity` OFF).
> 1.2 — 2026-08-07 (analyse critique V2).
> Statut : Proposition validée pour implémentation
> Responsabilité unique : Traduire les règles RAW du Livre de Base Polaris (chapitre Équipement,
> sections Acquisition, Intégrité, Tests de panne, Réparation, Usure) en logique de jeu pour Enclume.
> Ce document ne contient pas de code, de schéma SQL ni d'architecture technique.
> Ces aspects seront détaillés dans `docs/PLANS/PLAN_USURE&INTEGRITE.md`.
>
> Sources : `docs/REGLES/REGLE_USURE&INTEGRITE.md` (RAW), `docs/VOCABULARY.md`,
> `shared/polarisTestResolution.js` (autorité marge / critique / Catastrophe),
> échanges Saar 2026-08-07 et 2026-09-08.

---

## 1. Concepts de base

| Terme | Définition | Source |
|---|---|---|
| **Niveau Technologique (NT)** | Degré de maturité technologique d'un équipement, de I (dépassé) à VII (inconnu). Détermine la difficulté de production, de réparation et la rareté. | RAW Polaris [VÉRIFIÉ] |
| **Intégrité (ITG)** | Mesure de l'état général et de la fiabilité d'une pièce d'équipement, notée sur 25. Deux valeurs : **ITG courante** (état actuel) et **ITG max** (potentiel maximal, dépendant de la qualité de fabrication). | RAW Polaris [VÉRIFIÉ] |
| **Test de panne** | Jet de 1D20 comparé à l'ITG courante, déclenché quand un équipement risque de tomber en panne (déclencheurs : voir §4.2). Résolu par le moteur de Test standard du projet. | RAW Polaris [VÉRIFIÉ] |
| **Qualité** | Niveau de fabrication d'un modèle d'équipement : Bas coût, Bon marché, Standard, Bonne qualité, Excellente. Détermine l'ITG max et influence le prix et la disponibilité. | RAW Polaris [VÉRIFIÉ], section « Intégrité et qualité » (intégrée au corps du RAW le 2026-09-08) |
| **Occasion** | Un équipement acheté sur le marché légal est considéré comme d'occasion. Son ITG courante est aléatoire, selon une formule dépendant de sa qualité. Un équipement acheté au marché noir est neuf et possède ITG courante = ITG max (résolution d'une contradiction RAW : voir §3.2). | RAW Polaris [VÉRIFIÉ] + résolution d'écart §3.2 |
| **Électronique (flag `is_electronic`)** | Propriété catalogue indiquant qu'un objet est vulnérable aux IEM. **Hors périmètre Usure V1** : aucun consommateur avant le chantier IEM (ROADMAP §4) et l'entrée #8 de la table Catastrophe (Lot 2). La colonne sera ajoutée par le chantier IEM, pas par Usure. | [INFÉRÉ] |
| **Panne (`malfunction_severity`)** | État de fonctionnement d'un objet. Trois valeurs : `NULL` (opérationnel), `'simple'` (réparable normalement), `'critical'` (atelier). **Non NULL ⇒ objet inutilisable** jusqu'à réparation (porte distincte du modificateur d'ITG, cf. §4.4). | [INFÉRÉ, décision Saar 2026-08-07] |

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

Les tests de réparation (complète comme bricolage de fortune) sur des équipements de **NT V** subissent un **malus de -5**. [VÉRIFIÉ, RAW]  
Les tests de réparation sur des équipements de **NT VI** subissent un **malus de -7**. [VÉRIFIÉ, RAW]  
Les équipements de **NT VII** : le RAW ne chiffre aucun malus. On les considère non réparables avec les compétences actuelles. [INFÉRÉ — le RAW dit seulement de la technologie généticienne / inconnue qu'on ne sait « pas la reproduire, et vaguement l'utiliser » ; il n'affirme pas explicitement qu'elle est irréparable]

### 2.3 Éligibilité à l'Intégrité

L'éligibilité d'un équipement aux règles d'Intégrité est déterminée par un flag **`has_integrity`** dans le catalogue de référence (`ref_equipment`).  
**Par défaut, ce flag est désactivé.** Le MJ — ou une entrée de catalogue — l'active explicitement sur les objets dont l'état mérite d'être suivi : matériel technologique important, armes, outils indispensables, navire, armures de plongée, etc. Le RAW cadre lourdement ce choix : suivre l'état de chaque objet serait « fastidieux, inutile et même impossible », et « dans la plupart des cas, il est totalement inutile de gérer l'état des objets les plus simples » (encadré « Quand faut-il vraiment se soucier de l'état du matériel ? »).  
Les objets sans `has_integrity` ne possèdent pas d'ITG : les colonnes correspondantes dans l'inventaire restent vides (NULL), et ces objets sont ignorés par tous les calculs d'usure et de panne. [décision Saar 2026-09-08 : défaut OFF + activation ciblée — conforme à l'encadré RAW]

**Un objet `has_integrity` ne se stacke jamais** : sa ligne d'inventaire a toujours `quantity = 1`, acheter 3 exemplaires identiques crée 3 lignes. L'ITG est la propriété d'un objet physique unique — une valeur unique sur une pile de N objets serait indéfinie. La règle existe déjà pour les objets équipables (`isEquippableLocation`, piège P57, `inventoryService.js`) ; il suffit d'étendre cette garde pour qu'elle se déclenche aussi sur `has_integrity` (couvre le cas d'un objet à ITG non équipable — ordinateur rangé dans le Sac, gadget non porté). [décision Saar 2026-09-08]

---

## 3. Intégrité et Qualité

### 3.1 Niveaux de qualité et ITG max

Chaque modèle d'équipement possède un niveau de **qualité** qui définit son **ITG max absolue** (la valeur maximale que peut atteindre l'objet, même neuf). Ce niveau est fixé par le MJ dans l'interface des Marchands, ou porté par l'entrée de catalogue de référence (au même titre que le flag `has_integrity`, cf. §2.3). La qualité influence également le prix et la disponibilité.

| Qualité | ITG max absolue | Formule ITG occasion | Modificateur de prix | Modificateur de disponibilité |
|---|---|---|---|---|
| Bas coût | 5 | 1D4+1 | -70% | DIS +6 |
| Bon marché | 10 | 1D6+4 | -50% | DIS +4 |
| Standard | 15 | 2D6+3 | -20% | DIS +2 |
| Bonne qualité | 20 | 2D6+6 | 0% (référence) | — |
| Excellente qualité | 25 | 3D6+5 | +30% à +50% | DIS -3 |

[VÉRIFIÉ, RAW — section « Intégrité et qualité » : formules Bas coût / Bon marché / Standard / Excellente et modificateurs DIS / coût. **La ligne « Bonne qualité : 2D6+6 » est [INFÉRÉE]** : le RAW écrit « Bonne qualité : pas de modif », et la règle générale d'achat d'occasion fixe le jet par défaut à 2D6+6 (RAW « Intégrité du matériel à l'achat »). Clarification Saar 2026-08-07.]

> **Note :** La colonne « Modificateur de disponibilité » reflète la règle RAW. En l'absence actuelle d'un système de disponibilité dans Enclume, ces valeurs sont indicatives pour le MJ et seront appliquées automatiquement lorsque la mécanique sera implémentée.

> **Note :** La formule « ITG occasion » détermine l'ITG courante lors d'un achat d'occasion (marché légal). Pour un achat neuf (marché noir), l'ITG courante est égale à l'ITG max absolue.

### 3.2 ITG courante à l'acquisition

> Ces règles ne concernent que les items portant `has_integrity` (§2.3, désactivé par défaut). Un objet non flaggé est acquis **sans ITG** ; si le MJ veut suivre son état, il active d'abord le flag, puis fixe l'ITG selon les règles ci-dessous.

- **Achat neuf (marché noir)** : ITG courante = **ITG max absolue** de la qualité (5 / 10 / 15 / 20 / 25).
  > **Écart RAW assumé.** Le RAW se contredit : « Intégrité du matériel à l'achat » dit que le marché noir donne du neuf « à son maximum, c'est-à-dire 20 (sauf indication contraire) », tandis que « Intégrité et qualité » liste un maximum par qualité (5 / 10 / 15 / 25 « au marché noir »). On retient le maximum par qualité — plus cohérent avec la notion d'ITG max, et le « 20 » n'est qu'une valeur par défaut « sauf indication contraire », la qualité étant précisément l'indication. [décision Saar 2026-09-08]
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
- **Changement de palier d'état** (ex. « Bon état » → « État moyen ») → **-1 ITG max par palier franchi**.
- **Perte de 5 points d'ITG ou plus en une seule fois** → **-1 ITG max** (un seul point, quel que soit le montant au-delà de 5 — le RAW dit « 5 points en une seule fois », le « ou plus → toujours -1 » est [INFÉRÉ]).
- Usure naturelle (fin de scénario, conditions rudes) → **-1 ITG max** pour les objets sensibles, à la discrétion du MJ.

Quand un même coup encaissé déclenche les **deux premières** règles à la fois, on retient **la plus grande des deux pénalités, jamais leur somme**. Exemple : un objet « Bon état » (18) qui perd 10 points d'un coup tombe à 8 (« Usagé ») — deux paliers franchis (-2) et perte ≥ 5 (-1) → **-2 ITG max** définitifs. [décision Saar 2026-09-08 ; le RAW ne précise pas le cumul, « le plus grand » retenu pour la cohérence]

L'ITG courante ne peut jamais dépasser l'ITG max. Si une perte définitive survient alors que l'ITG courante est supérieure au nouveau max, l'ITG courante est ramenée au nouveau max.

**En V1, le système ne détecte pas automatiquement ces événements. C'est au MJ d'appliquer les ajustements manuellement via l'interface d'inventaire.** [VÉRIFIÉ, RAW, décision Saar 2026-08-07]

---

## 4. Test de panne

### 4.1 Mécanisme du test

Le test de panne oppose **1D20** à l'**ITG courante** de l'objet, **sans aucun modificateur** (ni compétence, ni attribut, ni bonus d'état) — c'est un jet de fiabilité pure. [VÉRIFIÉ, RAW]
La résolution (réussite / échec / Catastrophe, y compris le retest sur 20 naturel) passe par le moteur de Test standard du projet, comme n'importe quel autre Test.

- **Réussite** : `1D20 ≤ ITG courante` → rien ne se passe.
- **Échec** : `1D20 > ITG courante` → l'objet **perd 1 point d'ITG courante** et **cesse de fonctionner** (panne simple). Il peut être réparé (voir §5.1).
- **Catastrophe** : le jet est résolu par le **moteur de Test standard du projet**, `shared/polarisTestResolution.js` — `resolveTestOutcome(1D20, ITG courante)` puis, sur un **20 naturel**, `applyCriticalFailReroll` (relance 1D20 ajoutée à la Marge d'échec), exactement comme tout autre Test. Il y a Catastrophe quand la **Marge d'échec finale ≥ 15** (`CATASTROPHE_MARGE_MIN`). Effet : l'objet **perd 1D6 points d'ITG courante** et **cesse de fonctionner** (panne critique) ; réparation en atelier (voir §5.3). Aucun calcul propre, aucune exception au moteur.

Du résultat de `resolveTestOutcome`/`resolvePolarisTest`, on ne lit que **`isSuccess`** (l'objet ne tombe pas en panne) et **`catastropheRisk`** (après retest). `isCriticalSuccess` et une Marge de réussite positive n'ont **pas de sens** pour un jet de fiabilité — ne pas les surfacer, ne pas appeler `applyCriticalSuccessBonus`.

Si l'ITG courante atteint **0 ou moins**, l'objet est **hors d'usage** (inutilisable, `malfunction_severity = 'critical'`, ITG courante = 0). Pour les armes, une Catastrophe réduisant l'ITG à 0 ou moins provoque une **explosion** (voir §5.4).

> **Distribution.** Sur un échec **sans 20 naturel**, la Marge d'échec vaut `1D20 − ITG` et plafonne à `20 − ITG` : une Catastrophe directe suppose alors une ITG basse (`ITG ≤ 5`). Sur un **20 naturel**, `resolveTestOutcome` marque l'échec critique et `applyCriticalFailReroll` ajoute une relance 1D20 à la marge — un objet même en bon état peut alors franchir le seuil de 15. C'est l'esprit « malchance extrême » du RAW, cohérent avec la table d'état : la plupart des échecs de test de panne ne sont que des enrayages (−1, panne simple), la défaillance sévère (−1D6, atelier) reste rare.
>
> La V2 retenait « 1 naturel = Catastrophe » — **erroné** : sur `D20 ≤ Seuil`, un 1 naturel réussit toujours (`1 ≤` toute ITG), c'est une **réussite**, jamais une Catastrophe. La V1.3 corrigeait en « Marge ≥ 15 » mais désactivait le retest sur 20 — carve-out injustifié, supprimé ici : le test de panne suit le moteur de Test **sans exception**. [corrigé 2026-09-08]

### 4.2 Déclencheurs du test de panne

Un objet à **ITG courante ≥ 21** (« Excellent état ») ne fait **jamais** de test de panne sur une Catastrophe — le RAW l'exempte explicitement (« Risque de panne : … jamais sur une Catastrophe »). Il ne reste vulnérable qu'aux circonstances spéciales (attaque IEM). [exemption VÉRIFIÉE RAW]

#### Automatiques (résolus par le système sans intervention humaine)

- **Échec simple d'attaque avec une arme à ITG ≤ 5** : en combat, si un jet d'attaque échoue (sans Catastrophe) et que l'ITG courante de l'arme est entre 1 et 5, l'arme effectue un test de panne. Limité aux armes en combat — seul cas où le système référence l'objet utilisé. [VÉRIFIÉ, RAW l.64]

> **Attaque IEM — hors périmètre Usure V1.** Le RAW prévoit qu'une attaque IEM soumet automatiquement les appareils électroniques portés à un Test de panne. C'est un **chantier séparé** (ROADMAP §4, découplé le 2026-09-08) : il faut mécaniser `FX=IEM` dans `weaponAmmoDsl.js` (aujourd'hui jeté), le flag `is_electronic`, la primitive « énumérer les objets `is_electronic` portés », et une source d'attaque IEM. Usure V1 fournit seulement la primitive de test de panne que ce chantier appellera.

#### Catastrophe — une seule résolution

- **Hors combat** : une Catastrophe sur un Test utilisant un objet `has_integrity` → cet objet fait un test de panne. **En V1, non automatique** (le système ne référence pas l'objet hors combat) : le MJ le déclenche via « Usage intensif ».
- **En combat** : la Catastrophe est résolue par la table **CATASTROPHES EN COMBAT** (1D10, `catastropheService.js`). Le test de panne d'arme n'est **pas** un déclencheur parallèle sur `catastropheRisk` — il est la **conséquence mécanique de l'entrée #8 « Panne d'un système »**, et l'entrée #2 « Arme inutilisable » une perte d'ITG directe (voir §8). Ces deux conséquences sont un **Lot 2** (via `EFFECT_HANDLERS` dans `catastropheService.js`, point d'extension prévu) — pas le cœur V1. En attendant, le MJ applique à la main en lisant l'entrée tirée.
- **Résultat V1 : aucun test de panne automatique sur Catastrophe.** [décision Saar 2026-09-08 — une Catastrophe = une résolution ; #2/#8 en Lot 2]

#### Manuel (sur intervention humaine)

- **Utilisation intensive ou non conventionnelle** : le MJ déclenche un test de panne via le bouton « Usage intensif » (interface d'inventaire), utilisable à tout moment. **Si l'ITG courante de l'objet est ≤ 5, la panne est systématique** — pas de jet : `malfunction_severity = 'simple'`, −1 ITG. Le RAW impose une panne automatique à ce palier en usage intensif. Au-dessus de 5, jet normal. [VÉRIFIÉ, RAW l.64-65]

### 4.3 Sélection de l'objet testé

- **Pour une arme utilisée en combat** : l'arme active (identifiée par le slot d'arme ou l'action de combat en cours) est l'objet du test.
- **Pour un test de compétence hors combat** : l'objet utilisé est déterminé contextuellement. En V1, seul le cas des armes est automatisé. Pour les autres cas, le MJ peut déclencher manuellement un test de panne sur n'importe quel objet via le bouton « Usage intensif ». [INFÉRÉ, limitation V1]

### 4.4 État de panne

Un objet qui cesse de fonctionner à la suite d'un test de panne voit son champ `malfunction_severity` modifié automatiquement :
- Après un **échec simple** : `malfunction_severity = 'simple'`. L'objet est inutilisable mais peut être réparé normalement (cf. §5.1).
- Après une **Catastrophe** : `malfunction_severity = 'critical'`. L'objet est inutilisable et nécessite une réparation en atelier (cf. §5.3).

**Porte de panne (distincte du modificateur d'ITG).** `malfunction_severity` non NULL ⇒ l'objet est **inutilisable** tant qu'il n'est pas réparé, **quelle que soit son ITG courante** : une arme à ITG 12 mais `'simple'` (enrayée) ne peut pas tirer. C'est une garde **binaire**, séparée du modificateur de la table §3.3/§7.1 — ce dernier module un objet *fonctionnel* selon son palier d'ITG. Ordre d'évaluation : d'abord la porte de panne (en panne → inutilisable, on s'arrête là) ; sinon on applique le modificateur du palier.

Le MJ peut également modifier manuellement ce champ via un bouton à bascule « Opérationnel / Réparation simple / Réparation en atelier » dans l'interface d'inventaire. **Ce bouton est un outil de dépannage pour le MJ ; il ne devrait pas être utilisé pour contourner la mécanique normale.** [INFÉRÉ, décision Saar 2026-08-07]

---

## 5. Réparation

### 5.1 Réparation hors combat (Réparation complète)

#### Interface

Une interface de réparation (emplacement à trancher dans le PLAN — il n'existe pas d'entrée « Outils » dans la Sidebar aujourd'hui) liste tous les objets que le joueur **porte sur lui** (Sac, Ceinture, ou équipés via un slot) dont l'**ITG courante < ITG max** et dont le `malfunction_severity` n'est pas `'critical'`. [INFÉRÉ, décision Saar 2026-08-07]

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
   - **Catastrophe** (Marge d'échec finale ≥ 15, moteur de Test complet — cf. §4.1) : l'objet perd **définitivement 1 point d'ITG max**. L'ITG courante reste inchangée (ou diminue si elle dépasse le nouveau max). L'objet reste en panne. [VÉRIFIÉ, RAW pour la Catastrophe ; INFÉRÉ pour l'échec simple, décision Saar 2026-08-07]

#### Malus de réparation selon le NT

Les malus suivants s'appliquent **au test de compétence** de réparation (complète comme bricolage) :
- **NT V** : malus de **-5** au test. [VÉRIFIÉ, RAW]
- **NT VI** : malus de **-7** au test. [VÉRIFIÉ, RAW]
- **NT VII** : le RAW ne chiffre aucun malus ; considéré non réparable avec les compétences actuelles. [INFÉRÉ — voir §2.2]

### 5.2 Réparation rapide en combat

Le RAW prévoit **deux** gestes distincts en situation de combat, **aucun automatisé en V1** :

**a) Débloquer une panne simple par un Test de compétence rapide.** Remettre en marche un objet en panne simple (`malfunction_severity = 'simple'`) sans atelier, avec la Compétence liée à l'usage. Temps indicatif RAW : **1D6 tours** pour une arme. [VÉRIFIÉ, RAW]

**b) « MAIS TU VAS MARCHER, OUI ??? » — taper sur l'appareil.** Geste désespéré : le MJ lance pour le joueur un **Test de Chance** avec un malus égal au nombre de points d'ITG déjà perdus. L'appareil perd **automatiquement 1 point d'ITG** (que le Test réussisse ou échoue). En cas de réussite, la **marge de réussite** donne le nombre de tours de combat pendant lesquels l'appareil fonctionne avant de retomber en panne. [VÉRIFIÉ, RAW]

**Périmètre.** (a) est un Test de compétence ordinaire, sans dépendance externe. (b) est un **Test de Chance avec modificateur, sans dépense de point de Chance** : il ne dépend donc **pas** de la mécanique de réserve/dépense de Chance, seulement d'un helper partagé `resolveChanceTest(chc, modificateur)` — que `docs/PLANS/PLAN_CHANCE.md` §2.1 prévoit d'extraire (le Test de Chance brut `1D20 ≤ chc` existe déjà, `damageService.js`) — plus la confirmation RAW de l'échelle du Test de Chance (`PLAN_CHANCE.md`, point ouvert #3).

**Découpage retenu** : le cœur (test de panne §4 + bonus/malus §7 + réparation complète §5.1) est le **livrable V1, sans dépendance Chance**. Le geste (b) et la récupération de pièces détachées (§9) forment un **lot 2**, activables dès que `resolveChanceTest` existe. [décision Saar 2026-09-08]

Une action de combat dédiée pour (a) pourra être implémentée ultérieurement (Test de compétence assorti d'un malus, à définir).

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

Lors d'une action d'attaque (mêlée ou tir) d'un personnage **humanoïde (PJ ou PNJ)**, le système lit l'ITG de l'arme utilisée (`char_inventory.integrity_current`) et applique au **jet d'attaque** le modificateur de la colonne « Bonus/Malus à l'utilisation » du tableau §3.3 (**+2** à 21-25 ; **0** de 11 à 20 ; **-3** à 6-10 ; **-5** à 1-5). Source unique de ce mapping : §3.3 — ne pas le redupliquer. Mécaniquement : une contribution `{label, value, type}` ajoutée à `combatAttackRoll` (le noyau somme et l'affiche dans le breakdown). En V1, seulement sur les jets d'attaque (parade et autres usages : ultérieurement). Les armes d'exo-armure et de drone sont **exclues** (Intégrité propre, §11) — l'intégration se fait site par site sur les seuls chemins humanoïdes (cf. §13).

**Deux gardes indépendantes, dans cet ordre :**
1. `malfunction_severity` non NULL (§4.4) ⇒ **attaque impossible**, l'arme est en panne.
2. Sinon, ITG courante = 0 ⇒ **attaque impossible** (arme hors d'usage) ; ITG ≥ 1 ⇒ le modificateur du palier s'applique.

Ce modificateur est cumulable avec tous les autres bonus/malus (compétence, attribut, portée, etc.). Il est affiché dans le récapitulatif de l'action avant le jet. [INFÉRÉ, décision Saar]

### 7.2 Autres équipements (hors combat)

En V1, les bonus/malus d'ITG ne sont **pas** appliqués automatiquement aux tests de compétence hors combat (ex. Informatique avec un ordinateur usagé). Le joueur peut ajouter manuellement le malus via le champ « Modificateur » de la macro ou du test, s'il le souhaite. Pour faciliter cela, **l'interface d'inventaire doit afficher clairement, pour chaque objet, une pastille de couleur ou une icône indiquant le palier d'ITG et le modificateur associé** (ex. « -3 précision » en rouge pour un objet usagé). L'automatisation pour les compétences non-combat sera étudiée dans une version ultérieure, lorsque le système de test pourra référencer l'objet utilisé. [INFÉRÉ, limitation V1]

---

## 8. Interaction avec les Catastrophes de combat

En combat, une Catastrophe (`catastropheRisk`, Marge d'échec ≥ 15) est résolue **uniquement** par la table CATASTROPHES EN COMBAT (1D10, `catastropheService.js`) — c'est **la seule voie** par laquelle une Catastrophe de combat affecte l'ITG (cf. §4.2, une Catastrophe = une résolution).

Le système d'Intégrité est le prérequis pour **mécaniser** les deux entrées de cette table qui touchent le matériel, en **Lot 2** (post-V1) :

- **Entrée #2 « Arme inutilisable »** : perte d'ITG directe (montant dans le PLAN), sans test de panne ; l'arme cesse de fonctionner.
- **Entrée #8 « Panne d'un système »** : déclenche un test de panne (§4.1) sur un équipement du personnage (sélection MJ ou aléatoire ; le ciblage « objets électroniques » attend le flag `is_electronic` du chantier IEM).

Implémentation Lot 2 : un handler dans `EFFECT_HANDLERS` (`catastropheService.js`), point d'extension déjà prévu (« peuplé lot par lot »). **Note :** `COMBAT.md` affirme encore « les conséquences restent narratives en permanence » — cette phrase est **périmée** (antérieure au moteur de Catastrophe, confirmé Saar 2026-09-08) ; à corriger, ainsi que `ROADMAP.md:98`. [décision Saar 2026-09-08]

---

## 9. Règles optionnelles et modularité

Les règles suivantes sont considérées comme **optionnelles** et peuvent être activées/désactivées au niveau de la campagne (option de campagne future) ou simplement ignorées par le MJ :

- **Usure automatique** (perte d'ITG courante par utilisation courante) : non implémentée en V1.
- **Perte définitive automatique** (changement de palier, perte massive) : non implémentée en V1.
- **Gestion des pièces détachées** : **lot 2**, non implémentée en V1. Le RAW la résout par un **Test de Chance avec malus** (récupération sur un objet hors d'usage, l'ITG négative sert de malus), **sans dépense de point** — même prérequis que « taper dessus » (§5.2b) : le helper `resolveChanceTest`. Pas abandonnée.

Le système permet au MJ de gérer manuellement tous ces aspects via les champs d'ITG éditables, offrant une flexibilité maximale sans imposer de complexité. [INFÉRÉ]

---

## 10. Décisions d'implémentation (écarts assumés)

| Décision | Justification |
|---|---|
| **Pièces détachées = lot 2** | Dépend du helper `resolveChanceTest` (Test de Chance avec malus, sans dépense de point). Manuel MJ en V1. Non abandonné. |
| **Pas d'usure automatique** | Complexité d'implémentation ; le MJ dispose d'une interface manuelle complète. |
| **Bonus/malus automatique limité aux armes en combat** | Les tests hors combat ne référencent pas encore d'équipement. Extension future. |
| **Test de panne = moteur de Test complet** (`resolveTestOutcome` + `applyCriticalFailReroll`, retest sur 20 inclus) | Aucune exception à l'autorité unique. Catastrophe = Marge d'échec **finale** ≥ 15. Corrige la V2 (« 1 naturel », erroné) et la V1.3 (carve-out « pas de retest », supprimé). |
| **Une Catastrophe = une résolution** | En combat, la Catastrophe passe par la table 1D10 ; le test de panne d'arme est la conséquence de l'entrée #8, jamais un déclencheur parallèle. Évite la double peine (arme cassée alors que la table a tiré autre chose). Effet V1 : aucun test de panne automatique sur Catastrophe. |
| **Perte définitive d'ITG max = la plus grande des deux pénalités, pas leur somme** | Quand un coup franchit un palier ET fait perdre ≥ 5 d'un coup. Cohérence ; le RAW ne précise pas le cumul. |
| **Qualité fixe par item de catalogue marchand** | Simplicité d'interface ; le MJ peut créer plusieurs entrées pour simuler un choix. |
| **Flag `has_integrity`, désactivé par défaut** | Le RAW réserve explicitement le suivi d'état au matériel important (« inutile de gérer l'état des objets les plus simples »). Défaut OFF + activation ciblée MJ/catalogue — plus fidèle qu'une règle rigide par NT. Propagé aux règles d'acquisition (§3.2). |
| **IEM et `is_electronic` hors périmètre Usure V1** | Découplé le 2026-09-08 (« pas en même temps, ça fait trop »). Chantier IEM séparé (ROADMAP §4) : il portera la colonne `is_electronic`, la mécanisation `FX=IEM`, la source d'attaque. Usure V1 = 2 colonnes `ref_equipment` seulement. |
| **`has_integrity` ⇒ non-stackable (`quantity = 1`)** | L'ITG est par objet physique. Extension de la garde `isEquippableLocation` (P57) existante. |
| **`malfunction_severity` non NULL ⇒ objet inutilisable** | Garde binaire distincte du modificateur d'ITG (§4.4/§7.1). Un objet enrayé à bonne ITG reste inutilisable. |
| **Réparation experte non automatisée en V1** | La logique d'atelier, de temps et de technicien expert est trop complexe à modéliser pour V1. |
| **Réparation rapide en combat = lot 2 partiel** | (a) Test de compétence : sans dépendance. (b) « taper dessus » : Test de Chance avec malus, sans dépense de point → dépend du seul helper `resolveChanceTest`. Manuel MJ en V1. |
| **Validation MJ systématique pour les réparations** | Le MJ doit vérifier la disponibilité du temps, de l'outillage et des compétences. |

---

## 11. Hors-scope explicite

- **Exo-armures** : elles possèdent leurs propres règles d'Intégrité (Structure, Exosquelette, Générateur), documentées dans `docs/PLANS/PLAN_EXOARMURE.md` et `MANUELS/MANUEL_EXOARMURE.md`.
- **Drones** : idem, Intégrité propre gérée via `/drone/integrity`.
- **Véhicules** : règles RAW distinctes (chapitre Navires et véhicules), non couvertes.
- **Attaques IEM** : chantier séparé (ROADMAP §4), découplé le 2026-09-08. Usure V1 fournit la primitive de test de panne ; le chantier IEM la consommera (mécanique DSL, `is_electronic`, source d'attaque).
- **Table Catastrophe combat — entrées #2/#8** : Lot 2 (post-V1) via `EFFECT_HANDLERS` (§8).
- **Pièces détachées** : lot 2 — dépend du helper `resolveChanceTest` (pas de la réserve de Chance). Manuel MJ en V1.
- **Usure automatique et perte définitive automatique** : non implémentées.
- **Réparation rapide en combat** (§5.2) : manuelle en V1. (a) automatisable sans dépendance ; (b) « taper dessus » dépend du helper `resolveChanceTest`.

---

## 12. Références et documents liés

| Document | Rôle |
|---|---|
| `docs/REGLES/REGLE_USURE&INTEGRITE.md` | Source RAW unique (NT, ITG, qualité, pannes, réparation, usure). Nettoyé le 2026-09-08 (section « Intégrité et qualité » intégrée au corps). |
| `docs/VOCABULARY.md` | Définitions canoniques des termes — **fait le 2026-09-08** (V2.7 : Intégrité du matériel, NT, Qualité, Test de panne, Panne). |
| `shared/polarisTestResolution.js` | Autorité unique marge / critique / Catastrophe — le test de panne s'y branche (§4.1), jamais un calcul propre. |
| `docs/SYSTEME/CHARACTER.md` | Autorité de l'inventaire (`char_inventory`) et du catalogue (`ref_equipment`) |
| `docs/SYSTEME/TRADE.md` | Système de marchands, flux d'achat (point d'entrée pour la génération d'ITG) |
| `docs/SYSTEME/COMBAT.md` | Architecture de combat (consommateur du bonus/malus d'ITG) |
| `docs/PLANS/PLAN_CHANCE.md` | Fournit le helper `resolveChanceTest` (Test de Chance avec modificateur) dont dépend le **lot 2** : « taper dessus » (§5.2b) et pièces détachées (§9). **Pas** la réserve/dépense de Chance. |
| `docs/PLANS/PLAN_USURE&INTEGRITE.md` | (à écrire) Plan technique : migrations, services, composants |

---

## 13. Dépendances et risques d'implémentation

À traiter dans le PLAN — identifiés par analyse du code (2026-09-08), non résolus ici.

### 13.1 Schéma — périmètre V1
- `ref_equipment` : **+2 colonnes** — `has_integrity` (bool, défaut `false`), `quality` (enum : bas_cout / bon_marche / standard / bonne_qualite / excellente, nullable). Migration + backfill du catalogue seedé **matché par clé métier `name`** (règle `core.md`, jamais par `id`), avec curation par item (quels objets ont une ITG, quelle qualité) — c'est un vrai travail de contenu, pas une simple migration.
- `char_inventory` : `integrity_current` / `integrity_max` (int, nullable). Éventuellement `malfunction_severity` (enum nullable) si non déjà prévu.
- `is_electronic` : **pas en V1** (chantier IEM).

### 13.2 Intégration combat (§7.1, §4.2) — dispatch incohérent
`combatAttackRoll.js` accepte proprement une contribution de modificateur. Mais l'accroche doit se faire dans **plusieurs résolveurs divergents** (`resolveMeleeAction` / `resolveAssaultAction` humanoïdes, + drone, + exo) — dette connue `ROADMAP.md` §5 (« Dispatch de résolution combat… architecture incohérente, trois styles pour la même décision »). L'intégration ITG :
- ne cible que les chemins **humanoïdes (PJ + PNJ)** — exo et drone ont leur Intégrité propre (§11) et doivent être explicitement sautés à chaque site ;
- `combatAttackRoll` est un noyau pur : le test de panne d'arme (§4.2) et son retest éventuel sont lancés par le résolveur appelant, pas par le noyau ;
- **recommandation** : soit séquencer après le rework dispatch (ROADMAP §5), soit documenter le skip exo/drone site par site dans le PLAN.

### 13.3 Flux de réparation (§5.1) — nouveau sous-système
- Pas d'entrée « Outils » dans la Sidebar aujourd'hui — l'emplacement UI est à trancher.
- Le flux « notification MJ → accepter / modifier la compétence / refuser → puis le joueur lance » n'est **pas** une réutilisation directe de `game_echeances` : les 2 `condition_type` existants (`wound_healing_check`, `wound_infection_check`) vont droit à `awaiting_player_roll`. Il faut un **nouveau `condition_type`**, un **état d'approbation avant le jet**, un **payload mutable par le MJ** (changement de compétence), et un **panneau de revue** (`BlessuresReviewPanel` est spécifique aux blessures).

### 13.4 Génération d'ITG à l'achat (§3.2) — intégration marchand
Le flux d'achat (`tradeService.js`) doit, quand un item `has_integrity` entre dans l'inventaire, tirer l'ITG selon marché légal / marché noir et la qualité. Nouveau point d'accroche dans `TRADE.md`.

### 13.5 Synchronisation documentaire
- `docs/SYSTEME/COMBAT.md` : la phrase « les conséquences [de Catastrophe] restent narratives en permanence » est périmée (cf. §8) — à corriger quand le Lot 2 sera cadré.
- `docs/ROADMAP.md:98` : reformuler la justification du chantier (« mécanise 3 entrées de la table Catastrophe ») → V1 ne mécanise rien de la table ; #2/#8 sont un Lot 2.