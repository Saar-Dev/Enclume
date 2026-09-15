# MANUEL_INFORMATIQUE.md — Ordinateurs, programmes et pannes électroniques

> Statut : Réécriture complète 2026-09-11 — conformité au gabarit (`GABARIT_MANUEL.md`), après
> constat que les versions 1.0-1.7 de ce document violaient les deux règles cardinales du gabarit
> (structure en 8 sections, absence de code/SQL/architecture). Tout le contenu technique
> (fichiers, migrations, colonnes, fonctions) accumulé dans ces versions est déplacé vers
> `docs/PLANS/PLAN_INFORMATIQUE.md`. Ce document ne décrit que le **quoi**, jamais le **comment**.
> **Analyse à charge du MANUEL seul, 2026-09-11 (deuxième passe, RAW revérifiée mot à mot)** : deux
> erreurs de traduction RAW corrigées — §4.5 (Champ IEM anti-torpille) attribuait à tort la
> réduction du malus au « Blindage IEM » alors que la RAW nomme « Blindage électronique », un
> concept distinct non couvert par ce document ; §4.7 (Survie I.E.M.) attribuait le doublement du
> malus (−2) à une réussite critique de l'attaquant, alors que la RAW le lie à un échec critique du
> **Test de panne du défenseur lui-même**. Ces deux erreurs existaient déjà (sous forme contaminée
> de code) dans les versions 1.5-1.7 sans avoir été détectées — la réécriture propre les a rendues
> visibles.
>
> **Audit complet RAW 2026-09-15 (« on veut être sûr »)** : chaque section de règle relue contre sa
> source RAW citée, y compris 5 fichiers jamais ouverts avant cette passe malgré leur présence dans
> la table §1 (`REGLE_ORDINATEUR.md`, `ORDINATEUR_GUIDETECH.md`, `REGLECOMPETENCE.md`,
> `REGLES_ARMES_SONIQUES.md`, `REGLE_SERRURE.md`). Résultat : §4.1 (capacités, exemple chiffré),
> §4.2 (Intégrité de départ), §4.3 (gabarits), §4.5 (les 5 sources de panne IEM/sonique), §4.6
> (Blindage IEM), §4.8 (les 19 programmes RAW de base + les 7 du Guide Technique) confirmés
> **[VÉRIFIÉ]** mot à mot, aucun écart. Deux corrections faites : §4.10 (Génie technique/Logiciels
> omettait le prérequis « Éducation culture générale 10 » de la compétence de base, ne gardait que
> celui de la spécialité) et §4.9 (le seuil « Intégrité ≤ 0 » du principal/secours est une convention
> déjà codée par Exo-armures, pas une citation RAW directe — attribution de source précisée). Omis
> volontairement, jugé non bloquant : la note RAW sur le stockage de données illimité par défaut
> (`REGLE_ORDINATEUR.md`), non mécanisée et sans conséquence sur ce chantier.
>
> **Correction 2026-09-15 (analyse à charge du Lot 3, en amont du PLAN)** : §4.7 (Survie I.E.M.)
> ne gardait que la toute dernière étape de la mécanique RAW (le jet de dégât résiduel au
> redémarrage) — relu mot à mot `docs/REGLES/REGLEDRONE.md`, la séquence complète comporte deux
> étapes intermédiaires disparues à la première rédaction : l'immobilisation de l'appareil pendant
> un nombre de Tours égal à sa marge d'échec, puis un jet de redémarrage tenté à chaque Tour sous le
> niveau de Survie I.E.M. Décision Saar (2026-09-15) : « le RAW a toujours raison » — le MANUEL est
> corrigé pour refléter la séquence complète (§4.7 ci-dessous), quitte à agrandir le PLAN en
> plusieurs lots pour l'implémenter (segmentation acceptée par avance). Une question RAW non résolue
> par cette correction est ajoutée en §6 : le texte source décrit le comportement d'un robot/
> androïde autonome, pas explicitement celui d'une exo-armure pilotée par un humain, alors que le
> dispositif peut pourtant équiper les deux.
>
> **Décision 2026-09-15 (suite, le jour même) — question du §6 tranchée par Saar.** Exo-armure
> portée : le pilote est entièrement gelé pendant l'immobilisation, seule option narrative « sortir
> de l'armure », sans effet mécanique. Drone téléopéré : l'opérateur n'est jamais gelé (jamais
> fusionné à la machine) ; décision de jeu associée, RAW-silencieuse, journalisée
> `docs/JOURNAL8.md` — piloter un drone consomme l'action du Tour de l'opérateur, qui peut quand
> même se déplacer lui-même contre le même malus qu'un Tireur en mouvement. Détail en §4.7, question
> retirée du §6 (résolue).
>
> **Tour de relecture 2026-09-15 (suite, le jour même)** : trois questions listées en §6/§8.1
> (portée d'un hit IEM, critère de hiérarchisation Gestion systèmes, propriétaire Survie
> I.E.M./Gestion systèmes) étaient déjà tranchées par le PLAN le même jour mais jamais rebouclées
> ici — §8.1 continuait de les lister comme bloquantes. Corrigé : les deux premières sont des
> règles de jeu, déplacées dans les sections qu'elles concernent (§4.5 ciblage IEM, §4.1 critère de
> déconnexion) plutôt que laissées uniquement dans le PLAN/JOURNAL8 (Règle 9/10,
> `docs/RegleDocumentaire.md`) ; la troisième (organisation du schéma) est actée en §3.2. §6/§8.1
> nettoyés en conséquence. Bug de structure corrigé au passage en §4.7 : le paragraphe sur le
> pilote référençait « étapes 1-2 ci-dessous » avant la séquence qu'il décrit — déplacé après.
>
> Principe fondateur : ce document décrit quoi faire, jamais comment (pas de SQL, pas de code,
> pas de choix d'implémentation). Il doit être compréhensible et validable par un expert règles
> sans connaissance technique.
>
> Cycle de vie prévu : Rédaction → Validation Saar → Passage au PLAN → Archivage. Ce document ne
> sera pas modifié après le démarrage effectif du PLAN. Toute évolution ultérieure fera l'objet
> d'un nouveau MANUEL (ex. `MANUEL_INFORMATIQUE_V2.md`).
>
> Périmètre : ce document couvre les couches 1 (capacités d'un ordinateur, pannes électroniques,
> IEM) et 2 (catalogue de programmes) du chantier Informatique, découpé en 5 couches (décision
> Saar, 2026-09-11). Les couches 3 (duels/Piratage), 4 (conception de programmes) et 5 (virus)
> feront chacune l'objet d'un MANUEL séparé, non rédigé à ce jour.

---

## 1. Sources RAW

| Fichier dépôt | Pages LdB | Contenu couvert |
|---|---|---|
| `docs/REGLES/REGLE_ORDINATEUR.md` | p.280-283 (numérotation PDF) | Capacités d'un ordinateur (Génération, Niveau Technologique, Potentiel, Gestion systèmes, Niveau max des programmes, coût), gabarits, Disponibilité, Intégrité de départ, Blindage IEM, catalogue de programmes de base |
| `docs/REGLES/ORDINATEUR_GUIDETECH.md` | Supplément Guide Technique | Programmes additionnels (Alerte, Bouclier, Masque, accès dispositifs Darter/Phalanx/SkyMarshall, Recherche) — **seule la liste de programmes est couverte par ce document** ; le reste du supplément (mécanique de duel, conception de programmes, virus) relève des couches 3-5 |
| `docs/REGLES/REGLESMUNITIONS.md` | Munitions spéciales | Balles IEM |
| `docs/REGLES/REGLEARMURE.md` | — (armures mécanisées) | Attaque IEM sur une armure mécanisée (élément touché, Test de panne), Champ IEM anti-torpille (dispositif défensif), Blindage IEM comme propriété d'un système embarqué |
| `docs/REGLES/REGLEDRONE.md` | p.280-282 (rappel de la même RAW ordinateur) | Survie I.E.M. (dispositif distinct du Blindage IEM), vulnérabilité générale des machines/robots/drones aux IEM |
| `docs/REGLES/REGLEPOLARIS.md` | — | Pouvoirs Force Polaris « Attaque IEM » et « Pulsion électromagnétique » |
| `docs/REGLES/REGLES_ARMES_SONIQUES.md` | — | Panne provoquée par une arme sonique (mécanique adjacente à l'IEM, pas identique) |
| `docs/REGLES/REGLE_SERRURE.md` | — | Option des serrures à reconnaissance — neutralisation nécessitant un ordinateur |
| `docs/REGLES/REGLECOMPETENCE.md` | — | Compétences Informatique, Génie technique (spécialité Logiciels), Piratage informatique |

*Limite connue (analyse à charge) : les pages LdB marquées « — » n'ont pas de numéro de page
physique confirmé dans cette session — seule la localisation par fichier/section est certaine.
Ces fichiers RAW (`REGLEARMURE.md`, `REGLEPOLARIS.md`, `REGLES_ARMES_SONIQUES.md`, `REGLE_SERRURE.md`,
`REGLECOMPETENCE.md`) restent une référence fiable, juste pas au niveau de précision « page »
attendu par le gabarit — à compléter si Saar a les numéros exacts.*

Sources connexes (règles qui s'appliquent sans être dans le chapitre Équipement informatique) :
- `docs/REGLES/REGLE_USURE&INTEGRITE.md` (p.273-274) — Test de panne, paliers d'Intégrité. Autorité
  déjà traduite dans `docs/MANUELS/MANUEL_USURE.md` ; ce document ne la redéfinit pas, il ajoute un
  déclencheur (l'IEM) et un mode de calcul d'Intégrité de départ propre aux ordinateurs (§4.2).
- Sous-système Exo-armures (RAW `REGLEARMURE.md`, MANUEL `MANUEL_EXOARMURE.md`) — un ordinateur
  peut être un système embarqué d'une armure mécanisée. Voir §3.2.

---

## 2. Entités et attributs

### 2.1 L'ordinateur

Un ordinateur est un appareil informatique, qu'il soit un objet personnel (mallette, ceinture,
bracelet…) ou un système embarqué dans une plateforme (armure mécanisée, drone).

**Attributs fixes** (définis à l'acquisition/à la fabrication) :

| Attribut | Description | Source RAW |
|---|---|---|
| **Génération** | Puissance de l'ordinateur, de Gén. I à Gén. X. Distincte du Niveau Technologique — détermine avec lui le coût et les capacités. | `REGLE_ORDINATEUR.md` |
| **Niveau Technologique (NT)** | Voir `MANUEL_USURE.md` §2 — même concept, même échelle I-VII. | `MANUEL_USURE.md` §2 |
| **Gabarit** | Terminal, mallette, ceinture, bracelet, assistant personnel, bloc de données rétinien, ou généticien (implanté). Détermine le poids, un multiplicateur de coût, et parfois un plafond de génération atteignable à un NT donné. | `REGLE_ORDINATEUR.md` |

**Attributs variables** (propres à chaque exemplaire) :

| Attribut | Description | Source RAW |
|---|---|---|
| **Intégrité courante / maximale** | État général et fiabilité de l'exemplaire — voir `MANUEL_USURE.md` §1 pour le concept, §4.2 ci-dessous pour la valeur de départ propre aux ordinateurs. | RAW + §4.2 |
| **Niveau de Blindage IEM** | Équipement optionnel, propre à cet exemplaire — voir §4.6. | `REGLE_ORDINATEUR.md` |
| **Niveau de Survie I.E.M.** | Dispositif optionnel distinct, propre à cet exemplaire, qui se dégrade à l'usage — voir §4.7. | `REGLEDRONE.md` |
| **Rôle (si la plateforme en porte plusieurs)** | Certaines plateformes peuvent embarquer deux ordinateurs redondants (un « principal », un « secours ») — voir §4.9. | `REGLEARMURE.md`/`SEEDEXO.md` |
| **Programmes installés** | Liste des programmes chargés sur cet ordinateur, chacun à un niveau donné — voir §2.2 et §4.9. | `REGLE_ORDINATEUR.md` |

### 2.2 Le programme

**Attributs fixes** (par type de programme, catalogue) : nom, famille (sécurité, offensif,
communication, spécialisé…), coût de base (souvent une formule dépendant du niveau).

**Attributs variables** (par installation) : niveau installé, ordinateur porteur.

### 2.3 L'objet électronique (générique)

Tout objet — pas seulement un ordinateur — peut être sensible aux impulsions électromagnétiques.

**Attribut fixe** : sensibilité aux IEM (oui/non), propriété du modèle catalogue.
**Attribut variable** : son Intégrité courante, comme n'importe quel objet suivi (`MANUEL_USURE.md`).

---

## 3. Relations et dépendances

### 3.1 Lien avec le Test de panne et l'Intégrité (sous-système Usure)

Ce document ne redéfinit ni le Test de panne ni les paliers d'Intégrité — autorité entière dans
`MANUEL_USURE.md`. La relation est à sens unique : ce chantier **déclenche** un Test de panne
existant (nouvelle circonstance : une attaque IEM), et fournit un **second mode de calcul de
l'Intégrité de départ**, propre aux ordinateurs et dérivé de leur génération plutôt que de la
qualité générique de fabrication (§4.2). Lien déjà existant côté Test de panne, à créer côté
déclencheur.

### 3.2 Lien avec les plateformes embarquant un ordinateur (Exo-armures, Drones)

Un ordinateur peut être le système informatique d'une armure mécanisée ou d'un drone. **La
matérialisation de cette relation (comment une plateforme porte concrètement son ordinateur)
relève des sous-systèmes Exo-armures et Drones, pas de ce document** — ce MANUEL décrit les
règles de l'ordinateur lui-même (capacités, panne, catalogue), consommées telles quelles par ces
plateformes. Relation déjà existante pour l'essentiel côté exo-armures et drones (les deux
sous-systèmes savent déjà représenter un ordinateur embarqué, y compris la redondance
principal/secours pour l'armure mécanisée, §4.9). **Propriété du schéma pour la Survie I.E.M.
(§4.7) et l'auto-désactivation de Gestion systèmes (§4.1) — tranchée (2026-09-15)** : ce chantier
ajoute la donnée/le comportement, Exo-armures reste seul propriétaire du schéma des tables
(`exo_computers`, `exo_systems`), aucun des deux ne duplique l'autre. Détail technique dans
`docs/PLANS/PLAN_INFORMATIQUE.md` §4 Lot 3a/Lot 4.

### 3.3 Lien avec le Combat

Une attaque (munition, dispositif défensif, pouvoir) peut infliger une impulsion électromagnétique
à une cible, ce qui déclenche un Test de panne sur son matériel électronique. Relation à sens
unique Combat → Informatique (le Combat déclenche, ce document ne modifie aucune règle de combat).
Lien à créer.

### 3.4 Lien avec le Catalogue d'équipement

Le catalogue de programmes (§2.2) et la propriété « sensible aux IEM » d'un objet (§2.3) sont des
extensions du catalogue d'équipement général, pas un catalogue séparé. Relation : ce document
étend le catalogue existant, il ne le redéfinit pas.

### 3.5 Lien avec Force Polaris et Armes soniques (futurs)

Deux chantiers non commencés (Force Polaris, mécanisation des Armes soniques) consommeront à terme
le même déclencheur de Test de panne par IEM (ou une mécanique adjacente pour le sonique, §4.5).
Aucune dépendance actuelle — signalé pour que le déclencheur construit par ce chantier reste
réutilisable sans modification quand ces chantiers démarreront.

### 3.6 Lien avec la Sécurité / les Serrures

L'option RAW des serrures à reconnaissance (optique, digitale, ADN, vocale) précise que leur
neutralisation nécessite systématiquement un ordinateur. Ce document se contente de le noter — le
rattachement mécanique (probablement couche 3, Piratage, puisqu'il s'agit de neutraliser un
système de sécurité) reste à trancher avec le sous-système Portes/Connecteurs.

---

## 4. Règles logiques

### 4.1 Capacités d'un ordinateur

À partir de sa Génération et de son Niveau Technologique, un ordinateur détermine quatre capacités :

- **Niveau maximum des programmes** = Génération + (2 × Niveau Technologique). C'est le niveau le
  plus élevé qu'un programme installé sur cet ordinateur peut atteindre.
- **Gestion systèmes** = 10 + (Génération × Niveau Technologique). C'est le nombre de systèmes
  (appareils, drones, capteurs…) que l'ordinateur peut piloter simultanément. Un système non géré
  par un ordinateur ne peut être activé que manuellement. **Si le nombre de systèmes rattachés
  dépasse cette capacité, les systèmes les moins importants sont automatiquement déconnectés** —
  la RAW ne fournit aucun critère chiffré de hiérarchisation entre systèmes. **Critère retenu
  (Saar, 2026-09-15, décision de jeu RAW-silencieuse)** : premier branché, premier débranché par
  défaut ; le joueur peut réordonner cette liste de priorité à la main.
- **Potentiel** = 10 + [(Génération × Niveau Technologique) × 2]. C'est la somme totale des
  niveaux de tous les programmes qu'un ordinateur peut porter simultanément — un programme ne peut
  être installé si la somme des niveaux déjà installés plus le sien dépasserait le Potentiel.
- **Coût** = 500 × (Génération × Niveau Technologique) sols.

*Exemple (RAW, chiffré) : un ordinateur de Génération V et de Niveau Technologique III coûte
7 500 sols. Il peut porter des programmes de niveau 11 maximum, gérer 25 systèmes simultanément,
et porter un total de 40 niveaux de programmes cumulés.*

### 4.2 Intégrité de départ d'un ordinateur

L'Intégrité de départ d'un ordinateur (courante = maximale, à l'état neuf) dépend uniquement de sa
génération — un jet unique, tiré une seule fois à l'acquisition, jamais recalculé :

| Génération | Intégrité de départ |
|---|---|
| I-II | 2D6+3 (15 en moyenne) |
| III-VIII | 2D6+8 (20 en moyenne) |
| IX-X | 3D6+7 (25 en moyenne) |

Cette formule s'applique à **tout** ordinateur, embarqué dans une plateforme ou possédé
individuellement par un personnage — un seul mode de calcul, dérivé de la génération (pas de la
qualité de fabrication générique du reste de l'équipement, `MANUEL_USURE.md` §3.1, qui ne
s'applique pas aux ordinateurs).

### 4.3 Gabarits, poids et coût

| Gabarit | Effet |
|---|---|
| Terminal | Référence — poids selon la table Génération×NT complète du RAW |
| Mallette | Coût ×1,5, poids −25 %, plafonné à Gén. IV au NT I |
| Ceinture | Coût ×2, poids −50 %, plafonné à Gén. II au NT I |
| Bracelet | Coût ×3, poids −75 %, plafonné à Gén. I au NT I |
| Assistant personnel | Coût ×2, poids −50 %, plafonné à Gén. III au NT I ; peut recevoir un nombre d'appareils adjoints égal à son NT (coût de ces appareils doublé) |
| Bloc de données rétinien | Coût ×20, poids négligeable ; Gén. I fixe, ne fait que stocker des données et exécuter des programmes de reconnaissance/analyse |
| Généticien / nano-moléculaire | Gén. X / NT VII fixe, implanté — hors périmètre V1 (§7) |

### 4.4 Disponibilité

Le RAW donne une table de Disponibilité par Génération×NT. Enclume ne possède aucun système de
Disponibilité (DIS) à ce jour — règle non mécanisée, hors périmètre V1 (§7), même réserve que
`MANUEL_USURE.md`.

### 4.5 Panne déclenchée par une impulsion électromagnétique (IEM)

Une attaque par IEM soumet automatiquement les appareils électroniques touchés à un Test de panne
(même mécanique que tout Test de panne, `MANUEL_USURE.md` §4). Sources RAW confirmées :

| Source | Effet |
|---|---|
| Balles IEM (munition) | Infligent moitié moins de dégâts que la munition normale, et imposent un Test de panne avec un malus de −3 aux équipements électroniques touchés. Coût ×2. |
| Champ IEM anti-torpille (dispositif d'armure mécanisée) | Inflige une IEM à tout appareil électronique qui le franchit, malus au Test de panne égal au niveau du champ moins le **Blindage électronique** de la cible — un concept distinct du Blindage IEM (§4.6), que ce document ne modélise pas (probablement lié à la détection/discrétion plutôt qu'à la panne). |
| Attaque IEM sur une armure mécanisée (incident d'Avarie) | Touche un ou plusieurs éléments de l'armure au hasard (Exosquelette, Générateur, Systèmes auxiliaires [plusieurs à la fois], Armement), chacun soumis à un Test de panne avec un modificateur dépendant de la puissance de l'attaque. |
| Pouvoir Force Polaris « Attaque IEM » | Cible unique, malus au Test de panne de −3 moins le modificateur de réussite du pouvoir. |
| Pouvoir Force Polaris « Pulsion électromagnétique » | Zone d'effet (100 mètres de diamètre ou plus), malus au Test de panne égal au modificateur de réussite du pouvoir. |
| Arme sonique (mécanique adjacente, pas une IEM au sens strict) | Peut provoquer une panne en brisant un dispositif abîmé ou mal fixé — n'importe quel équipement, pas seulement électronique. Malus au Test de panne égal au modificateur de réussite de l'attaque ; en cas d'échec, perte de points d'Intégrité au gré du MJ. |

**Ciblage d'un hit IEM — tranché (Saar, 2026-09-15, RAW revérifiée mot à mot)**, la RAW ne
précisant pas combien d'objets électroniques un seul hit peut tester simultanément lorsqu'une
cible en porte plusieurs :
- **Ordinateur seul** : c'est lui, sans ambiguïté (cas particulier à un seul élément).
- **Exo-armure** : le tableau RAW ci-dessus (tirage entre les 4 catégories) s'applique tel quel.
- **Personnage porteur de plusieurs objets électroniques distincts hors exo-armure** (accessoire
  d'arme inclus) : **aucune RAW ne couvre ce cas** (recherché : le mot « accessoire » dans toutes
  les règles disponibles, aucune occurrence pertinente). **Décision maison assumée** : tirage au
  hasard équipondéré parmi les objets sensibles aux IEM réellement portés au moment du hit —
  cohérent avec le principe « déterminé au hasard » que la RAW applique systématiquement dans les
  cas voisins, mais ce n'est pas une règle RAW retrouvée. Journalisé `docs/JOURNAL8.md`.

### 4.6 Blindage IEM

Équipement optionnel d'un ordinateur : donne un bonus au Test de panne égal à son niveau,
uniquement en cas d'attaque IEM (aucun effet sur les autres causes de panne). Coût : (niveau ×
niveau) × 200 sols.

### 4.7 Survie I.E.M.

Dispositif distinct du Blindage IEM. Le texte RAW (`REGLEDRONE.md`) le décrit pour un **robot ou un
androïde autonome** ; il note aussi que le dispositif « peut équiper des exo-armures ou les
systèmes d'un véhicule ». Rare sur les drones sauf à la surface.

Il n'intervient qu'**après un échec** au Test de panne contre une IEM (§4.5) — une réussite ne
change rien à ce qui suit. Séquence complète RAW, en 4 étapes (corrigée 2026-09-15 : la version
précédente de ce document n'en gardait que la dernière) :

1. **Immobilisation.** L'appareil coupe son alimentation et reste immobile pendant un nombre de
   Tours égal à sa **marge d'échec** au Test de panne d'origine.
2. **Tentative de redémarrage.** Une fois ce délai écoulé, l'appareil retente, **à chaque Tour**, un
   jet sous son niveau de Survie I.E.M. (même principe qu'un Test de panne : 1D20 sous le score),
   jusqu'à réussir.
3. **Séquelle éventuelle au redémarrage.** Un jet d'1 dé détermine si l'appareil repart abîmé :
   résultat pair, aucune séquelle ; résultat impair, toutes les actions de l'appareil subissent un
   malus cumulatif de −1, porté à −2 si **le Test de panne du défenseur lui-même (étape d'origine,
   pas une réussite critique de l'attaquant) a été un échec critique**.
4. **Usure du dispositif.** Chaque redémarrage réussi réduit le niveau de Survie I.E.M. de 1 — une
   ressource qui s'épuise avec l'usage, jamais un bonus permanent ; à 0, le dispositif ne protège
   plus.

**Application à un pilote humain pendant les étapes 1-2 — tranché (Saar, 2026-09-15)**, close la
question ouverte du §6 :
- **Exo-armure portée** : le pilote est fusionné au dispositif (pas d'« ailleurs » possible,
  contrairement à un opérateur de drone ci-dessous) — il est **entièrement gelé** pendant toute la
  fenêtre d'immobilisation, exactement comme le robot/androïde autonome du texte RAW. La seule
  option qui lui reste est de sortir de l'armure, un geste **purement narratif**, sans effet
  mécanique et sans action de jeu associée.
- **Drone téléopéré** : l'opérateur n'est jamais fusionné à la machine — il continue de jouer son
  propre Tour normalement pendant que le drone est immobilisé (son jet de Télépilotage ce Tour-là ne
  fait simplement rien avancer, le drone restant hors service quel qu'en soit le résultat). Décision
  de jeu associée, RAW-silencieuse (Télépilotage n'est mécanisée nulle part dans Enclume à ce jour,
  `docs/REGLES/REGLEDRONE.md` la pose seulement comme Compétence limitative) : piloter activement un
  drone consomme l'action du Tour de l'opérateur ; il peut néanmoins se déplacer lui-même ce
  Tour-là, au même malus qu'un Tireur en mouvement (`RANGED_SITUATION_MODS.tireur_allure_*`,
  extension par analogie — cette table est aujourd'hui strictement réservée au Tir). Décision hors
  périmètre de ce chantier (mécanisation de la Télépilotage elle-même, couche séparée non commencée)
  — notée ici uniquement pour clore la question de la Survie I.E.M., journalisée
  `docs/JOURNAL8.md`.

### 4.8 Catalogue de programmes

Un programme est un logiciel installé sur un ordinateur, à un niveau donné, avec un coût de base
qui dépend le plus souvent de ce niveau (souvent une formule « prix de base × niveau cumulé installé »).
Le niveau d'un programme sert de « Compétence » lorsque le programme agit par lui-même (mécanique
détaillée en couche 3, hors périmètre de ce document).

Le RAW de base couvre au moins : Sécurité, Ami/ennemi, Analyse senseurs/sonars/radars,
Topographique, Contrôle armement (un programme par arme, son niveau égale le niveau d'attaque),
Détection/réactif, Données, Gestion d'appareils, Spécialisé, Offensif, Contre-attaque, Cryptage,
Décryptage, Communication, Brise-code, Viral autonome, Espion, Anti-espion, Rempart.

Le supplément Guide Technique ajoute : Alerte (déclenche des dispositifs physiques — laser, gaz,
alarme —, indépendamment du programme Sécurité), Bouclier (un leurre sur lequel le programme de
Sécurité adverse s'acharne en priorité), Masque (infiltration discrète, inopérant dès que le
pirate attaque directement le programme de Sécurité), les programmes d'accès à un dispositif
(Darter, Phalanx, SkyMarshall — niveau 12 par défaut), et Recherche (recherche de données
précises).

*Ce document ne mécanise pas l'usage actif de ces programmes (duel, désactivation, infiltration…)
— c'est la couche 3 (Piratage). Il ne pose que leur existence en tant qu'entrées de catalogue.*

### 4.9 Installation d'un programme et contrainte de capacité

Installer un programme sur un ordinateur est soumis à deux contraintes, vérifiées à
l'installation (pas seulement affichées) :
1. Le niveau du programme ne peut pas dépasser le Niveau maximum des programmes de cet ordinateur
   (§4.1).
2. La somme des niveaux de tous les programmes déjà installés sur cet ordinateur, plus celui-ci,
   ne peut pas dépasser son Potentiel (§4.1).

**Redondance principal/secours** : une plateforme qui porte deux ordinateurs (certains modèles
d'armures mécanisées en portent un « principal » et un « secours », abondamment attestés dans les
gabarits d'exemple de `REGLEARMURE.md`) n'en a jamais deux actifs simultanément. Le secours reste
inactif tant que le principal fonctionne ; il ne prend le relais que lorsque le principal tombe hors
d'usage. **Précision de source (2026-09-15)** : le seuil exact (Intégrité courante à 0 ou moins)
n'est pas une phrase RAW retrouvée telle quelle — c'est une convention déjà décidée et codée par le
chantier Exo-armures (Saar, 2026-08-21, `shared/computerStats.js#resolveActiveComputer`), par
analogie avec le seuil déjà établi pour le Générateur d'une exo-armure. Ce document reprend cette
convention existante, il ne la déduit pas d'une citation RAW directe.

### 4.10 Compétences

Trois compétences RAW couvrent l'informatique : **Informatique** (utiliser un ordinateur
normalement, avec un accès autorisé — prérequis Éducation culture générale 10), **Génie
technique**, spécialité **Logiciels** (concevoir des programmes — prérequis **Éducation culture
générale 10 pour la compétence de base, plus Informatique 10 spécifiquement pour la spécialité
Logiciels**, corrigé 2026-09-15 : la version précédente de ce document ne gardait que le second
prérequis, `docs/REGLES/REGLECOMPETENCE.md` en liste bien deux), et **Piratage informatique**
(s'introduire dans un système sans y être autorisé — prérequis Informatique 10, ne peut pas
dépasser le niveau de la compétence Informatique). Ce document ne mécanise que l'usage normal
(Informatique) ; le Piratage informatique n'entre en jeu qu'en couche 3.

---

## 5. Règles optionnelles

Néant — aucune règle de ce chapitre RAW n'est marquée « optionnelle » dans le Livre de Base.

---

## 6. Questions ouvertes et ambiguïtés

*Trois questions listées jusqu'ici dans cette section ont été tranchées le 2026-09-15 (relecture
du 2026-09-15, suite) et sont retirées d'ici : la portée d'un hit IEM et le critère de
hiérarchisation de Gestion systèmes sont désormais des règles décidées (§4.5 et §4.1
respectivement) ; le propriétaire du complément Survie I.E.M./de l'auto-désactivation Gestion
systèmes est réglé par le PLAN (§4 Lot 3a/Lot 4) — aucune des trois ne reste une ambiguïté RAW ni
une question d'organisation ouverte.*

- **« Contrôle armement » (RAW de base) face au catalogue existant.** Le programme RAW « Contrôle
  armement » (un programme par arme, niveau = niveau d'attaque) ne semble pas nommé ainsi dans le
  catalogue déjà constitué pour les plateformes drone/exo — probablement déjà couvert par un
  équivalent au rôle similaire, à vérifier avant de conclure à une entrée RAW manquante.
- **Cas générique** (un personnage propriétaire d'un ordinateur personnel qui y installe des
  programmes, §4.9) : aucun besoin de jeu identifié à ce jour justifiant de le couvrir en V1 —
  confirmé hors périmètre par le PLAN (§6 « Hors-scope »).

---

## 7. Hors périmètre

- **Couches 3 (Duels d'ordinateurs/Piratage), 4 (Conception de programmes), 5 (Virus)** —
  chacune fera l'objet d'un MANUEL séparé. Un duel d'ordinateur n'existe **qu'en combat** (décision
  verrouillée, Saar 2026-09-11) — hors combat, le MJ arbitre un jet ponctuel sans gestion du temps.
- **Disponibilité (DIS)** — aucun système DIS n'existe dans Enclume à ce jour.
- **Ordinateurs généticiens/nano-moléculaires** (Gén. X/NT VII implantés) — aucun contenu de ce
  Niveau Technologique n'existe à ce jour.
- **Détail de l'incident d'Avarie IEM d'une armure mécanisée** (quel élément précis est touché) —
  relève du sous-système Exo-armures, ce document fournit seulement le Test de panne que cet
  incident déclenchera.
- **Champ IEM anti-torpille, pouvoirs Force Polaris IEM, arme sonique** en tant que contenu jouable
  — confirmés comme de futurs consommateurs de la mécanique décrite ici (§4.5), aucun n'est
  couvert en V1.
- **Cas générique d'un ordinateur personnel avec programmes installés** (§6) — proposé hors
  périmètre V1.
- **Option des serrures à reconnaissance** en tant que mécanique jouable — la RAW est notée (§3.6)
  mais son rattachement mécanique n'est pas de la responsabilité de ce document.

---

## 8. Passage au PLAN

### 8.1 Points bloquants

*Néant — les trois points listés jusqu'ici (critère de hiérarchisation Gestion systèmes, portée
d'un hit IEM, propriétaire Survie I.E.M./Gestion systèmes) ont tous été tranchés avec Saar le
2026-09-15 ; voir §4.1, §4.5 et §3.2 pour les décisions, `docs/PLANS/PLAN_INFORMATIQUE.md` pour
leur traduction technique.*

### 8.2 Dépendances externes

- Sous-système Usure/Intégrité — fournit le Test de panne lui-même (moteur déjà existant, ce
  chantier n'y ajoute qu'un déclencheur).
- Sous-systèmes Exo-armures et Drones — portent déjà la matérialisation d'un ordinateur embarqué,
  y compris la redondance principal/secours pour l'armure mécanisée. Coordination nécessaire avant
  toute évolution de leur schéma par ce chantier (§3.2).
- Sous-système Combat — point de déclenchement d'une attaque IEM.
- Catalogue d'équipement général — ce chantier l'étend (nouvelle propriété, nouvelles entrées de
  programmes), ne le redéfinit pas.

### 8.3 Termes à ajouter à VOCABULARY.md

Génération (ordinateur), Niveau Technologique (ordinateur — déjà couvert par Usure, vérifier),
Potentiel, Gestion systèmes, Niveau maximum des programmes, IEM (impulsion électromagnétique),
Blindage IEM, Survie I.E.M., ordinateur principal/secours, Programme (informatique).

### 8.4 Complexités majeures

- Le déclencheur de Test de panne par IEM est un effet de bord post-résolution d'une attaque
  (un second jet, pas un simple modificateur de dégâts) — attention particulière au point
  d'intégration dans le pipeline de combat existant.
- Coordination avec le sous-système Exo-armures déjà construit — toute évolution de schéma sur ce
  périmètre doit être vérifiée contre son état réel avant d'être écrite, pas seulement contre sa
  documentation.
- Curation de contenu (marquer les objets sensibles aux IEM, renseigner la génération des
  ordinateurs catalogue) — travail potentiellement conséquent, taille non estimée.
- **Survie I.E.M. (§4.7, corrigé 2026-09-15) est un état à suivre dans le temps, pas juste une
  ressource et un malus final.** La séquence complète a besoin d'un compteur de Tours d'immobilité
  et d'un jet tenté à chaque Tour jusqu'au redémarrage — plus proche d'une petite machine à états
  (immobile → tentatives de redémarrage → redémarré, éventuellement abîmé) que d'un simple calcul
  ponctuel. À anticiper dans le découpage en lots du PLAN, probablement un lot dédié séparé du
  reste de la Survie I.E.M. (niveau/usure, qui reste simple).

### 8.5 Ordre de priorité suggéré

1. Contenu catalogue à faible risque : marquer les objets sensibles aux IEM, ajouter les
   programmes du Guide Technique manquants, corriger l'écart RAW de la munition IEM existante.
2. Le déclencheur de Test de panne par IEM lui-même (§4.5) — le seul vrai morceau de mécanique
   neuve.
3. Blindage IEM — le lire dans le calcul une fois le déclencheur posé.
4. Survie I.E.M. (§4.7) — segmentée par le PLAN en 3a (ressource) et 3b (machine à états).
5. Auto-désactivation de Gestion systèmes (§4.1).
