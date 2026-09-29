# GUIDE_TECHNIQUE_ARMURES.md — Nettoyage de l'import brut

> Source : `docs/REGLES/armureGUIDETECHNIQUE.txt` (export brut fourni par Saar, 2026-09-29) —
> supplément *Guide technique (des armures)*, distinct du catalogue du *Livre de Base* déjà
> transcrit dans [SEEDEXO.md](SEEDEXO.md). L'export brut initial s'est révélé tronqué à plusieurs
> endroits ; Saar a complété le même jour avec des extraits fournis directement (photo du tableau
> Autonomie, fin de fiche Assassin, liste complète des Hybrides, fiches Explora, Heimdall-Pyrelia,
> Impériale, Ouraken, Sylph 56, Typhon).
>
> **Méthode** : l'export brut vient d'une extraction PDF à colonnes qui recolle les mots
> (« decontrôleà » → « de contrôle à ») et mélange parfois l'ordre des blocs aux sauts de page
> (en-têtes courants, numéros de page, fragments dupliqués). Ce fichier restitue le texte
> nettoyé, fiche par fiche, sans changer aucune valeur numérique ni inventer de contenu absent
> de la source. Le fichier `.txt` original n'a pas été supprimé.

## 0. Points d'attention avant utilisation

### 0.1 Doublons avec le Livre de Base — sujet à part entière, non tranché ici

Ce Guide technique republie ses **propres fiches**, avec des valeurs différentes (parfois très
différentes), pour des armures qui existent déjà dans le catalogue RAW du Livre de Base
(`SEEDEXO.md`) : **Mentor, Moloch, Nymph 1-A, Odin, Orka, Condor, Cougar, Vauban, Vanguard,
Typhon, Heimdall-Pyrelia, Ouraken, Sylph 56**. Exemple : Nymph 1-A a un Exo-Force de 37 et un
Blindage de 21 dans le Livre de Base, contre Exo-Force 51 / Blindage 22 ici.

**Aucune fusion n'a été faite** — les deux jeux de stats sont conservés séparément (Livre de
Base dans `SEEDEXO.md`, Guide technique ici). Saar a indiqué (2026-09-29) que la question de
savoir laquelle des deux fiches fait autorité pour chaque armure est **un sujet à part entière**,
traité séparément de ce nettoyage — ce document se contente de transcrire fidèlement les deux
sources sans arbitrer.

### 0.2 Les trois armures en cours d'illustration ont maintenant toutes une fiche

Cougar, Série A et Explora — les trois armures pour lesquelles Saar génère une illustration —
ont chacune une fiche technique complète dans ce Guide :

- **Cougar** → §2.4 (Armures terrestres)
- **Série A** → §1.13 (Armures sous-marines)
- **Explora** → §3.2 (Armures hybrides)

Il ne reste donc plus d'armure sans fiche technique connue parmi ces trois.

### 0.3 Tableau « Autonomie des armures » — reconstruit à partir de la photo source

Le tableau à 3 colonnes (Vitesse / Autonomie / Condition), imprimé sur plusieurs colonnes dans le
PDF source, avait été laissé en texte brut faute de pouvoir fiabiliser l'appariement des trois
valeurs par ligne. Saar a fourni une capture propre du tableau original (2026-09-29) : il est
reconstruit ci-dessous en §1.4, sans ambiguïté restante.

### 0.4 Armure « Oméga » (Guide) vs « Exo-oméga » (Livre de Base)

Le Guide technique présente une armure nommée **Oméga**, prototype unique de l'Union
Méditerranéenne classé « Véhicule léger (V-) », distincte de la catégorie générique
*exo-oméga* utilisée dans `MANUEL_EXOARMURE.md` (§4.6) pour désigner le gabarit le plus lourd.
Ne pas confondre le nom propre et la catégorie.

### 0.5 Liste complète des Hybrides (confirmée par Saar, 2026-09-29)

Saar a fourni la liste complète, alphabétique, de la section « armures hybrides_ » : Assassin,
Explora, Heimdall-Pyrelia, Impériale, Ouraken, Overlord, Pirate (Classique), Pirate (Lourde),
Sylaco, Sylph 56, Typhon, Vanguard — ainsi que les fiches complètes d'Overlord, des deux Pirate
et de Sylaco, qui manquaient encore. Les 12 entrées de §3 sont maintenant toutes complètes.

### 0.6 Erreurs de classement corrigées — leçon retenue

Heimdall-Pyrelia, Impériale et Ouraken avaient été placées en Sous-marines par déduction à partir
de leurs valeurs de profondeur, faute d'en-tête de section dans les extraits fournis. Saar a
signalé l'erreur à deux reprises avant que la liste complète (§0.5) ne confirme que les trois
appartiennent en réalité aux Hybrides (§3.3, §3.4, §3.5). **Leçon retenue pour la suite de ce
document et pour tout classement futur sans en-tête explicite dans la source : marquer `[INCONNU]`
et demander confirmation, ne jamais déduire un classement de section à partir de valeurs
numériques.** Le fragment auparavant marqué `[HYPOTHÈSE]` (ex-§3.5) est résolu : c'est bien
**Typhon** (§3.11), confirmé par Saar avec son en-tête complet.

### 0.7 « Heimdall » seul n'existe pas — c'est Heimdall-Pyrelia

Aucune armure ne s'appelle simplement « Heimdall ». Le fichier
`docs/Illustration/exo-armure/exo_heimdall.png` est un doublon (ou un nom de fichier tronqué) de
`exo_heimdall-pyrelia.png` — les deux fichiers illustrent la même armure, Heimdall-Pyrelia (§3.3).

---

## 1. Armures sous-marines

### 1.1 Nouvelle classification des armures (introduction)

*Poids en kg (à l'équilibre) des armures sous-marines. Pour les armures terrestres, il faut
multiplier par 0,8.*

**Équilibrage des armures** — Toutes les armures emportent un mini-ballast pour gérer les
variations de poids. Elles peuvent aussi avoir un PIT additionnel (pour celles qui ont une
source d'énergie conséquente) pour la gestion de l'équilibre. Enfin, pour les armures plus
lourdes que leur déplacement, elles embarquent des sortes de conteneurs en mousse syntactique
(matériau expansé) qui permettent d'atteindre l'équilibre une fois dans l'eau.

**Modificateur d'intégrité des armures** — Le modificateur aux tests d'intégrité de l'armure.
Une valeur positive est un bonus, une valeur négative un malus.

### 1.2 Autonomie des armures

Il existe deux grandes familles de « moteurs » : celle dont les moteurs fonctionnent presque
indéfiniment (RTG, générateur azuréen et généticien, réacteur micro-fusion azuréen et
généticien), et celle dont les moteurs ne fonctionnent que durant une certaine période. Pour les
moteurs de la seconde famille, on peut décider de réduire sa vitesse de déplacement ou sa
consommation électrique pour économiser de l'énergie et, par conséquent, augmenter l'autonomie :

- **Vitesse** : coefficient multiplicateur à appliquer à la vitesse maximale prévue pour le GP.
  Ainsi, x0,6 signifie qu'une vitesse de 10 nœuds devient une vitesse de 6 nœuds.
- **Autonomie** : coefficient multiplicateur à appliquer à l'autonomie de base du GP. Ainsi un
  multiplicateur de 4 (vitesse divisée par deux) avec 1 heure d'autonomie initiale donne une
  nouvelle autonomie de 4 heures.
- **Condition** : plus une armure peut se déplacer rapidement, plus il est possible d'économiser
  de l'énergie. Ainsi, à partir d'une vitesse maximale de 5,5 nœuds, on peut multiplier par 10
  l'autonomie en restant quasiment immobile. En revanche, si la vitesse maximale de l'armure
  n'est par exemple que de 4 nœuds, le gain en autonomie ne peut être supérieur à 6.

### 1.3 Consommation électrique

| Consommation | Autonomie |
|---|---|
| 2/3 | x1,5 |
| 1/2 | x2 |
| 1/3 | x3 |
| 1/4 | x4 |

### 1.4 Autonomie des armures (tableau reconstruit)

| Vitesse | Autonomie | Condition |
|---|---|---|
| x 0,85 | x 1,5 | Vitesse maximale ≥ 1 nœud (1,8 km/h) |
| x 0,75 | x 2 | Vitesse maximale ≥ 2 nœuds (3,6 km/h) |
| x 0,60 | x 3 | Vitesse maximale ≥ 3 nœuds (5,6 km/h) |
| x 0,50 | x 4 | Vitesse maximale ≥ 3,5 nœuds (6,5 km/h) |
| x 0,45 | x 5 | — |
| x 0,40 | x 6 | Vitesse maximale ≥ 4 nœuds (7,4 km/h) |
| x 0,35 | x 7 | — |
| x 0,30 | x 8 | Vitesse maximale ≥ 4,5 nœuds (8,3 km/h) |
| x 0,20 | x 9 | Vitesse maximale ≥ 5 nœuds (9,3 km/h) |
| ~ Immobile (≤ ½ nœud) | x 10 | Vitesse maximale ≥ 5,5 nœuds (10,2 km/h) |

*Note sur le coût des armures : le prix indiqué ne comprend ni la propulsion, ni le GP, ni
l'armement.*

### 1.5 FAUST

**Échelle** : V- · **Catégorie** : Exo-4 · **Fabricant** : Meklar Industrie · **Nation** :
Hégémonie · **Coût indicatif** : 8 833 000 sols · **Disponibilité (marché noir)** : -5 (1) ·
**NT estimé** : IV
**Taille** : 3,30 m · **Poids** : 5 787 kg
**Profondeur** : Opérationnelle -17 500 m / Limite -21 000 m / Écrasement -26 250 m
**Autonomie** : RTGc (en années)

**Attributs :**
- Exo-Force : 91
- Modificateur de dommages : +40 (H) / +4 (V-)
- Ossature : ArmaTi
- Architecture : normale
- Intégrité : +7
- Résistance aux Dommages : -1
- Armure : nano-composite fc/epoxy de 124 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 6
- Visière : paroi en nano-alon de 24 mm d'épaisseur
- Volet de sécurité : 14 mm de Nano-comp. 133-cRHA
- Blindage visière (avec volet de sécurité) : 2 (5 ou 6 contre les armes à énergie et les
  charges creuses)
- Catégorie GP : GP-C1
- Vitesse/VIT (points de mouv.) : 4 nœuds/1(1) (PIT) / 3 km/h/<1(1) (surface)
- Malus d'initiative : sous l'eau : -5 ; à terre : -10

**Systèmes vitaux :**
- Ordinateur Hector VI (NT IV, Gén. 5)
- Sonscan actif Dauphin II
- Sonscan passif Kilian
- Analyseur Mk 18 Sea-Star
- Calculateur Nemrod VI
- Commandes vocales
- Système tactique Mc Clurr
- Comlink
- Communicateur Lénid II
- Système d'analyse tactique Cougar 60
- Pressurisateur
- Régulateur thermique 2
- Contrôle Class A
- Indicateur d'acquisition
- Réserve d'oxygène 24h
- Filtre 96h
- Stabilisateur
- Dispositif de diagnostic
- Système de navigation

**Armement :**
- 2x lance-torpilles taille 2 (2x2 torpilles)
- Lance-harpons (20 harpons)
- Chalumeau
- Faisceau anti-moléculaire léger (munitions illimitées)
- Lance-harpons A.V. (10 projectiles)
- Canon Manta (24 obus)

**Note :** c'est l'armure standard des troupes d'intervention sous-marine hégémoniennes. Il en
existe une identique pour des opérations de surface.

### 1.6 MENTOR *(⚠️ fiche distincte de Mentor/Livre de Base, cf. §0.1)*

**Échelle** : H · **Catégorie** : Exo-2 · **Fabricant** : Meklar Industrie · **Nation** :
Hégémonie · **Coût indicatif** : 1 750 000 sols · **Disponibilité (marché noir)** : 5 (10) ·
**NT estimé** : III
**Taille** : 2,40 m · **Poids** : 2 566 kg
**Profondeur** : Opérationnelle -12 000 m / Limite -14 400 m / Écrasement -18 000 m
**Autonomie** : RTGc (en années)

**Attributs :**
- Exo-Force : 68
- Modificateur de dommages : +29 (H) / -1 (V-)
- Ossature : Titane structurel
- Architecture : normale
- Intégrité : +2
- Résistance aux Dommages : -9
- Armure : plastitane de 85 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 37
- Visière : alon de 60 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 19
- Catégorie GP : GP-C2
- Vitesse/VIT (points de mouv.) : 6 nœuds/2(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  6 km/h/1(1) (marche)
- Malus d'Initiative : sous l'eau : -3 ; à terre : -6

**Systèmes auxiliaires :**
- Interface de contrôle à commandes vocales (principale)
- Panneau de contrôle manuel (secours, bras)
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'alimentation niv. 2
- Communicateur Lénid
- ComLink
- Système d'assistance et de contrôle
- Système d'assistance et de contrôle (secours)
- Contrôle de pression
- Ordinateur NT III, Gén. IV
- Générateur de lumière Feu follet
- Balise de détresse
- Verrouillage antivol niv. 7 (1 système au choix)

**Armement :**
- Canon à neutrons fantassin (épaule)
- Dague moléculaire rétractable (poing)
- Générateur défensif électrique
- Lance-harpon lourd, 10 charges (bras)

**Note :** pour quitter le milieu liquide, l'armure doit éjecter ses ballasts et ses conteneurs
pour ne pas être trop lourde.

### 1.7 MOLOCH *(⚠️ fiche distincte de Moloch/Livre de Base, cf. §0.1 — ici catégorie Exo-4B)*

**Échelle** : V- · **Catégorie** : Exo-4B · **Fabricant** : Odin Industrie · **Nation** :
Indépendante · **Coût indicatif** : 9 200 000 sols · **Disponibilité (marché noir)** : -5 (1) ·
**NT estimé** : III/IV
**Taille** : 3,30 m · **Poids** : 5 419 kg
**Profondeur** : Opérationnelle -19 000 m / Limite -22 800 m / Écrasement -28 500 m
**Autonomie** : RTGc (en années)

**Attributs :**
- Exo-Force : 91
- Modificateur de dommages : +40 (H) / +4 (V-)
- Ossature : Fivaltine
- Architecture : normale
- Intégrité : +5
- Résistance aux Dommages : +1
- Armure : nano-composite fc/epoxy de 136 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 6
- Visière : alon de 106 mm d'épaisseur
- Volet de sécurité : nano-acier RHA de 10 mm
- Blindage visière (avec volet de sécurité) : 3 (4)
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : 0,3 nœud/M(1/2) (marche) ou 3 nœuds/1(1) (PIT) ou
  0,5 km/h/M(1/2) (marche)
- Malus d'Initiative : sous l'eau : -5 ; à terre : -10

**Systèmes auxiliaires :**
- Interface de contrôle à commandes vocales
- Panneau de contrôle manuel de secours (bras)
- Ordinateur NT IV, Gén. III
- Ordinateur NT III, Gén. II (secours)
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscans
- Calculateur de tir
- Communicateur Lénid
- ComLink
- Détecteur d'acquisition
- Affichage tactique
- Mémoire de cibles Mémo
- Régulateur thermique
- Stabilisateur
- Système d'assistance et de contrôle
- Système d'assistance et de contrôle (secours)
- Contrôle de pression
- Système respiratoire (réserve d'oxygène de 72 heures)
- Dispositif de diagnostic
- Dispositif de réparation : Centrale d'auto-réparation niv. 12, Modules annexes pour 10 systèmes
- Dispositif d'assistance médicale niv. 5
- Système Dernière chance (Injection de drogues)
- Générateur de lumière Feu follet
- Atténuateur sonore niv. 4
- Lance-leurres, 6 leurres niv. 3
- Brouilleur sonscans actifs et passifs niv. 3
- Centre de commande de drones
- Balise de détresse
- Système hygiénique niv. 1
- Système d'alimentation niv. 2
- Système de navigation niv. 13

**Armement :**
- Dague moléculaire rétractable (poing)
- Canon à neutrons fantassin (épaule)
- Lance-harpon AV multiple, 3 charges (bras)
- Lance-torpilles Taille 2, 2 torpilles

**Note :** cette armure est difficilement utilisable hors de l'eau sans source d'énergie
supplémentaire.

### 1.8 NOELID

**Note :** c'est l'armure standard des commandos sous-marins hégémoniens.

**Échelle** : H · **Catégorie** : Exo-1 · **Fabricant** : Meklar Industrie · **Nation** :
Hégémonie · **Coût indicatif** : 2 860 000 sols · **Disponibilité (marché noir)** : -5 (1) ·
**NT estimé** : IV
**Taille** : 2,25 m · **Poids** : 1 854 kg
**Profondeur** : Opérationnelle -12 000 m / Limite -14 400 m / Écrasement -18 000 m
**Autonomie** : RTGc NT IV (plusieurs années)

**Attributs :**
- Exo-Force : 62
- Modificateur de dommages : +26 (H) / -2 (V-)
- Ossature : nano-titane structurel
- Architecture : normale
- Intégrité : +8
- Résistance aux Dommages : -14
- Armure : nano-alliage de titane de 22 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 44
- Visière : hyper-alon de 20 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 13
- Catégorie GP : GP-C2
- Vitesse/VIT (points de mouv.) : 6 nœuds/2(1) (PIT) ou 4 nœuds/1(1) (exo-palmes) ou
  12 km/h/2(1) en surface
- Malus d'initiative : sous l'eau : -2 ; à terre : -4

**Systèmes vitaux :**
- Ordinateur Callios XM NT IV niveau 4
- Sonscan actif Dauphin II
- Sonscan passif Kilian
- Analyseur Mk 12 Sea-Star
- Calculateur Nemrod
- Commandes vocales
- Système tactique Mc Clurr
- Comlink
- Communicateur Lénid II
- Système d'analyse tactique Cougar 60
- Pressurisateur
- Régulateur thermique 2
- Contrôle Class A
- Indicateur d'acquisition
- Réserve d'oxygène 24h
- Filtre 96h
- Stabilisateur
- Dispositif de diagnostic
- 2 porte-drone bêta (2 drones de réparation)
- Système Dernière chance (Guillotine)
- Système de navigation

**Armement :**
- Lance-torpilles taille 1 (6 torpilles)
- Lance-harpons (10 harpons) x2
- Dague moléculaire
- Arme à supercavitation
- Cougar 125 intégré

**Note :** tous les systèmes ont un Blindage IEM 6.

### 1.9 NYMPH 1-A *(⚠️ fiche distincte de Nymph 1-A/Livre de Base, cf. §0.1)*

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Gladius · **Nation** : Culte du
Trident/Veilleurs · **Coût indicatif** : 420 000 sols · **Disponibilité (marché noir)** : 10 (15)
· **NT estimé** : III
**Taille** : 1,85 m · **Poids** : 904 kg
**Profondeur** : Opérationnelle -8 000 m / Limite -9 600 m / Écrasement -12 000 m
**Autonomie** : THCc (13 heures)

**Attributs :**
- Exo-Force : 51
- Modificateur de dommages : +20 (H) / -6 (V-)
- Ossature : TiCal
- Architecture : normale
- Intégrité : +0
- Résistance aux Dommages : -5
- Armure : plastitane de 41 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 22
- Visière* : alon de 13 mm d'épaisseur (hublots de 5 cm de diamètre)
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 14
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : 4 nœuds/1(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  11 km/h/2(1) (marche)
- Malus d'initiative : sous l'eau : -2 ; à terre : -4

*\* le casque est un modèle quasi-intégral. Utilisez les valeurs de la coque si l'adversaire ne
vise pas un des deux petits hublots (test à -7).*

**Systèmes auxiliaires :**
- Panneau de contrôle manuel (avant-bras)
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Système d'assistance et de contrôle (principal)
- Système d'assistance et de contrôle (secours)
- Contrôle de pression
- Ordinateur NT III, Gén. V (principal)
- Ordinateur NT II, Gén. II (secours)
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan niv. 12
- Communicateur Lénid
- ComLink
- Verrouillage antivol niv. 5 (1 système au choix)
- Générateur de lumière Feu Follet

**Armement :**
- Dague moléculaire rétractable (poing)
- Générateur défensif électrique
- Lance-harpon lourd, 10 charges (bras)

### 1.10 ODIN *(⚠️ fiche distincte d'Odin/Livre de Base, cf. §0.1)*

**Échelle** : V- · **Catégorie** : Exo-3 · **Fabricant** : Odin Industrie · **Nation** :
Indépendant · **Coût indicatif** : 20 millions de sols · **Disponibilité (marché noir)** : 1 (5)
· **NT estimé** : III
**Taille** : 2,70 m · **Poids** : environ 3 500 kg
**Profondeur** : Opérationnelle -18 000 m / Limite -21 600 m / Écrasement -27 000 m
**Autonomie** : en années (RTGc)

**Attributs :**
- Exo-Force : 77
- Modificateur de dommages : +33 (H) / +1 (V-)
- Ossature : PlasTirAl
- Architecture : Normale
- Intégrité : +3
- Résistance aux Dommages : +3
- Armure : hyper-terranium de 13 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 4
- Visière : hyper-alon de 24 mm
- Volet de sécurité : super-acier de 6 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 2 (3)
- Catégorie GP : GP-C2
- Vitesse/VIT (points de mouv.) : 0,3 nœud/M(1/2) (marche) ou 5 nœuds/1(1) (PIT) ou
  5 km/h/1(1) (marche)
- Malus d'Initiative : sous l'eau : -4 ; à terre : -8

**Note :** cette armure évolue très difficilement hors de l'eau sans ajout d'une source d'énergie
supplémentaire et si elle ne largue pas ses gueuzes.

**Systèmes auxiliaires :**
- Interface de contrôle à commandes optiques (principale)
- Panneau de contrôle manuel (secours, bras)
- Ordinateur NT IV, Gén. II
- Ordinateur NT II, Gén. I (secours)
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Calculateur de tir
- Régulateur thermique
- Communicateur Lénid
- ComLink
- Système respiratoire (réserve d'oxygène de 72 heures)
- Système d'assistance et de contrôle
- Système d'assistance et de contrôle (secours)
- Contrôle de pression
- Balise de détresse
- Détecteur d'acquisition
- Dispositif d'assistance médicale niv. 4
- Générateur de lumière Feu follet
- Affichage tactique
- Champ IEM anti-torpille niv. 3
- Centre de commande de drones

**Armement :**
- Dague moléculaire rétractable (poing)
- Canon à neutrons fantassin (épaule)
- Générateur défensif à micro-ondes
- Lance-harpon AV multiple, 3 charges (épaule)

### 1.11 OMÉGA

**Note :** l'armure Oméga est un prototype développé par l'Union Méditerranéenne. C'est une
énorme armure massive ressemblant vaguement à une sorte de colosse à quatre pattes, deux repliées
à l'arrière et deux plus grandes à l'avant.

**Échelle** : V- · **Type** : Exo-Oméga · **Catégorie** : Véhicule léger (V-) · **Fabricant** :
Millénium · **Nation** : Union méditerranéenne · **Coût indicatif** : 5 255 000 sols ·
**Disponibilité (marché noir)** : Introuvable · **NT estimé** : IV
**Taille** : 4,75 m · **Poids** : environ 19 tonnes
**Profondeur** : Opérationnelle -12 000 m / Limite -15 600 m / Écrasement -18 000 m
**Autonomie** : 150 ans (micro-fusion pressurisé azuréen)

**Attributs :**
- Gabarit : 3
- Exo-Force : 128
- Modificateur de dommages : +59 (H) / +11 (V-) / +1 (V+)
- Ossature : Fivaltine
- Architecture : Lourde
- Intégrité : +8
- Résistance aux Dommages : -4
- Armure : nano-acier VHS de 28 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 7
- Visière : hyper-alon de 27 mm d'épaisseur
- Volet de sécurité : nano-acier RHA de 10 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 2 (3)
- Catégorie GP : GP-C3
- Vitesse/VIT (points de mouv.) : 4 nœuds/1(1) (PIT) ou 1 km/h/M(1/2) (marche)
- Malus d'initiative : sous l'eau : -6 ; à terre : -12

**Systèmes auxiliaires :**
- Réserve d'oxygène 48h
- Stabilisateur
- Régulateur thermique
- Sonscan actif omnidirectionnel
- Sonscan passif
- Analyseur
- Calculateur
- Communicateur Lénid
- Communication par câble Comlink
- Balise Rescue II
- Système hygiénique Hygéna 1
- Alimentation
- Navigation
- Indicateur d'acquisition
- Système assistance et contrôle classe A
- Contrôle de pression
- 2x Générateurs de lumière Feu Follet 4
- Tactique visière
- Autopilote Icare niveau 6 (réactif ; retour à la base en cas de perte de conscience du pilote)
- Ordinateur Fiséan Gén. VI, NT IV
- Atténuateur sonore 4
- Système de défense Écho+ 4
- Modificateur d'écho 5
- Lance-leurres Gardien
- Leurres Astyx niveau 6 x10
- Mini DCA Phalanx à supercavitation

**Armement :**
- Lanceur à barillet supercavitation taille 3 (6 torpilles taille 3)
- Lanceur à barillet taille 4 (6 torpilles taille 4)
- Canon Manta V (12 obus)
- 2x Cougar 125 (munitions : 30/30)

### 1.12 ORKA (Tenue grande profondeur) *(⚠️ fiche distincte d'Orka/Livre de Base, cf. §0.1)*

**Échelle** : V- · **Catégorie** : Exo-4C · **Fabricant** : Odin Industrie · **Coût indicatif** :
30 millions de sols (26 millions sans le RTGc) · **Disponibilité (marché noir)** : -5 (1) ·
**NT estimé** : III
**Taille** : 3,10 m · **Poids** : 5 100 kg
**Profondeur** : Opérationnelle -20 000 m / Limite -28 000 m / Écrasement -30 000 m
**Autonomie** : en années (RTGc) ou 13 heures (THCc)

**Attributs :**
- Exo-Force : 91
- Modificateur de dommages : +40 (H) / +4 (V-)
- Ossature : titane structurel
- Architecture : Ultra-lourde
- Intégrité : +8
- Résistance aux Dommages : -2
- Armure : hyper-terranium de 17 mm d'épaisseur
- Plaque d'armure supplémentaire : super-acier de 5 mm d'épaisseur
- Blindage : 7
- Visière : hyper-alon de 32 mm d'épaisseur
- Volet de sécurité : super-acier de 10 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 2 (4)
- Catégorie GP : GP-C2
- Vitesse/VIT (points de mouv.) : 0,3 nœud/M(1/2) (marche) ou 2 km/h/<1(1) (marche)
- Malus d'Initiative : sous l'eau : -5 ; à terre : -10

**Systèmes auxiliaires :**
- Interface de contrôle à commandes optiques
- Panneau de contrôle manuel de secours (bras)
- Communicateur Lénid
- ComLink
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscans
- Calculateur de tir
- Ordinateur NT IV, Gén. IV
- Régulateur thermique
- Contrôle de pression
- Système d'assistance et de contrôle
- Système d'assistance et de contrôle (secours)
- Stabilisateur
- Générateur de lumière Feu follet
- Système respiratoire (réserve d'oxygène de 72 heures)
- Dispositif de diagnostic
- Dispositif de réparation : Centrale d'auto-réparation niv. 12, Modules annexes pour 5 systèmes
- Système hygiénique niv. 1
- Système d'alimentation niv. 2
- Système de navigation niv. 13
- Caméra
- Affichage tactique
- Autopilote niveau 12 (réactif, retour à la base en cas de perte de conscience du pilote)

**Armement :**
- Pistolet lourd sous-marin à dards (main)
- Dague thermique rétractable (poing)
- Générateur défensif à décharges électriques
- Lance-harpon AV multiple, 5 charges (bras)

**Note :** cette armure est difficilement utilisable hors de l'eau sans source d'énergie
supplémentaire.

### 1.13 SÉRIE A

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Indus Conglomérat · **Nation** :
Royaume de l'Indus · **Coût indicatif** : 40 113 sols · **Disponibilité (marché noir)** : 10 (15)
· **NT estimé** : II
**Taille** : 1,85 m · **Poids** : 1 200 kg
**Profondeur** : Opérationnelle -2 000 m / Limite -2 400 m / Écrasement -3 000 m
**Autonomie** : 12 heures (THCc)

**Attributs :**
- Exo-Force : 51
- Modificateur de dommages : +20 (H) / -6 (V-)
- Ossature : aluminium structurel
- Architecture : normale
- Intégrité : -2
- Résistance aux Dommages : -3
- Armure : alliage d'aluminium de 27 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 16
- Visière : verre blindé de 49 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 7
- Catégorie GP : GP-B2
- Vitesse/VIT (points de mouv.) : 0,5 nœud/<1(1) (marche) ou 2 km/h/1(1) (marche)
- Malus d'initiative : sous l'eau : -2 ; à terre : -4

**Systèmes auxiliaires :**
- Panneau de contrôle manuel (avant-bras)
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'assistance et de contrôle
- Contrôle de pression
- Système de navigation niv. 10
- Ordinateur NT III, Gén. II
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan niv. 12
- ComLink

**Armement :**
- Dague rétractable (poing)
- Générateur défensif électrique
- Lance-harpon moyen, 10 charges (bras)

### 1.14 SIRYA IV *(texte source ; probable coquille pour « Syria IV » — illustration `exo_syria4.png`)*

**Note :** c'est l'armure légère de plongée la plus répandue en Ligue rouge. Son coût n'est donc
qu'indicatif car on peut en trouver pour dix fois moins cher. Elle est caractérisée par sa grosse
bonbonne d'oxygène située dans le dos. L'armure est dotée de très peu d'équipements car elle est
prévue pour être facilement modulable en fonction des besoins.

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Varan Technologie · **Nation** : Ligue
Rouge · **Coût indicatif** : 238 000 sols · **Disponibilité (marché noir)** : 5 (10) ·
**NT estimé** : III
**Taille** : 1,85 m · **Poids** : 1 200 kg
**Profondeur** : Opérationnelle -14 600 m / Limite -17 520 m / Écrasement -21 900 m
**Autonomie** : THCc pour 8 heures

**Attributs :**
- Exo-Force : 51
- Modificateur de dommages : +20 (H) / -6 (V-)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -8
- Armure : hyper-acier VHS de 17 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 37
- Visière : alon de 44 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 16
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : 4 nœuds/1(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  8 km/h/1(1) (marche)
- Malus d'initiative : -2

**Systèmes auxiliaires :**
- Ordinateur Pristar III (NT III/Gén. 2)
- Sonscan actif Dauphin II
- Sonscan passif Kilian
- Analyseur Mk 12 Sea-Star
- Calculateur Nemrod
- Commandes vocales
- Comlink
- Communicateur Lénid II
- Pressurisateur
- Régulateur thermique 2
- Contrôle Class A
- Réserve d'oxygène 48h
- Filtre 96h
- Stabilisateur
- Système de navigation

**Note :** tous les systèmes ont un Blindage IEM 4.

### 1.15 SYD

**Échelle** : H · **Catégorie** : Exo-2 · **Fabricant** : Varan Technologie · **Nation** : Ligue
Rouge · **Coût indicatif** : 2 435 000 sols · **Disponibilité (marché noir)** : 1 (5) ·
**NT estimé** : III
**Taille** : 2,50 m · **Poids** : 2 800 kg
**Profondeur** : Opérationnelle -14 000 m / Limite -16 800 m / Écrasement -21 000 m
**Autonomie** : RTGc (en années)

**Attributs :**
- Exo-Force : 68
- Modificateur de dommages : +29 (H) / -1 (V-)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -10
- Armure : hyper composite fc/epoxy de 87 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 42
- Visière : alon de 57 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 18
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : 3 nœuds/1(1) (PIT) ou 2 km/h/<1(1) (marche)
- Malus d'initiative : -3

**Systèmes auxiliaires :**
- Ordinateur Pristar III (NT III/Gén. II)
- Sonscan actif Dauphin II
- Sonscan passif Kilian
- Analyseur Mk 12 Sea-Star
- Calculateur Nemrod
- Commandes optiques
- Tactique visière
- Comlink
- Communicateur Lénid II
- Pressurisateur
- Régulateur thermique 2
- Contrôle Class A
- Réserve d'oxygène 24h
- Filtre 96h
- Stabilisateur
- Système de navigation
- Générateur de lumière
- Commandes manuelles de secours

**Armement et système défensif :**
- Lance-harpons (10 harpons)
- Faisceau anti-moléculaire léger
- Lance-leurres (6 leurres)
- Générateur micro-ondes niveau 4

**Note :** tous les systèmes ont un Blindage IEM 4.

### 1.16 VULCAIN (Armure de forage grande profondeur)

**Échelle** : V- · **Catégorie** : Exo-3 · **Fabricant** : Odin Industrie · **Nation** :
Indépendant · **Coût indicatif** : 2 450 000 sols · **Disponibilité (marché noir)** : 5 (10) ·
**NT estimé** : III
**Taille** : 2,60 m · **Poids** : 4 314 kg
**Profondeur** : Opérationnelle -12 000 m / Limite -16 800 m / Écrasement -18 000 m
**Autonomie** : en années (RTGc) ou 24 heures (THCc) ou câble

**Attributs :**
- Exo-Force : 77
- Modificateur de dommages : +33 (H) / +1 (V-)
- Ossature : Titane structurel
- Architecture : Ultra-lourde
- Intégrité : +8
- Résistance aux Dommages : -2
- Armure : hyper-alliage de titane de 33 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 6
- Visière : hyper-alon de 16 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 1
- Catégorie GP : GP-B2
- Vitesse/VIT (points de mouv.) : 1 nœud/M(1)
- Propulsion terrestre : impossible avec le moteur indiqué ci-dessus. Certaines peuvent donc
  être équipées de moteurs plus performants.
- Malus d'Initiative : sous l'eau : -5 ; à terre : -10

**Systèmes auxiliaires :**
- Interface de contrôle à commandes optiques
- Panneau de contrôle manuel de secours (avant-bras)
- Ordinateur NT III, Gén. III
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Contrôle de pression
- Communicateur Lénid
- Régulateur thermique
- Stabilisateur
- ComLink
- Système respiratoire (réserve d'oxygène de 72 heures)
- Système d'assistance et de contrôle
- Système d'assistance et de contrôle (secours)
- Générateur de lumière Feu follet
- Caméra
- Autopilote niv. 10 (si l'armure est reliée à une balise de communication, on peut lui ordonner
  de revenir à la base si le pilote est inconscient)
- Dispositif de diagnostic
- Balise de détresse
- Centrale d'auto-réparation niv. 12, Modules annexes pour 10 systèmes
- Système d'alerte
- Système hygiénique niv. 1
- Système d'alimentation niv. 1
- Système de navigation niv. 12

**Armement** *(ce sont des outils, mais ils peuvent être utilisés comme des armes si l'occasion
se présente)* :
- Excavateur mécanique (main et avant-bras droit)
- Griffe mécanique, Force utile 80 (main et avant-bras gauche)
- Torche de forage plasma Hydra

---

## 2. Armures terrestres

### 2.1 BULLDOG

**Note :** cette étrange armure a été découverte par un groupe d'exploration hégémonien dans les
ruines d'une ville fossilisée. Personne ne sait qui l'a construite et comment. Elle est des plus
primitives mais nécessite cependant une certaine technologie. Massive, elle est assez effrayante
à voir, surtout avec ses deux pots d'échappement recourbés à l'arrière et remontant dans le dos
jusqu'à hauteur de tête.

**Échelle** : H · **Catégorie** : Exo-1 · **Fabricant** : Inconnu · **Nation** : inconnue ·
**Coût indicatif** : — · **Disponibilité (marché noir)** : Introuvable · **NT estimé** : II
**Taille** : 2,15 m · **Poids** : environ 3,8 tonnes
**Profondeur** : NA
**Autonomie** : moteur diesel de type inconnu pour 12 heures

**Attributs :**
- Exo-Force : 79
- Modificateur de dommages : +34 (H) / +1 (V-)
- Ossature : difficile à déterminer
- Architecture : normale
- Intégrité : +0
- Résistance aux Dommages : -6
- Armure : fonte de 39 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 23
- Visière : paroi en Plexiglas de 42 mm d'épaisseur (estimation)
- Volet de sécurité : volet strié en fer forgé de 20 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 4 (16)
- Catégorie GP : inconnue (GP-C4 probablement)
- Vitesse/VIT (points de mouv.) : 20 km/h/4(1)
- Malus d'initiative : -2

**Systèmes auxiliaires :** inconnus.

**Armement :** on sait que l'armure était dotée d'une sorte de vieux canon chain gun de 20 mm et
de griffes de combat.

### 2.2 COBALT

**Note :** certains habitants de la surface racontent une étrange histoire concernant la
« Légion du Cobalt ». D'après cette légende, il s'agirait de mercenaires liés à l'Enclave de fer
et qui ont la particularité d'être insensibles aux radiations. Ils seraient dotés d'armures de
haute technologie composées d'un alliage hautement radioactif incorporant du Cobalt 60. Les
membres de la Légion, d'après les descriptions, sont de véritables fous furieux adorant
massacrer et piller. Le statut de « chef » dans ce groupe serait lié à la quantité de Cobalt 60
incorporée à l'armure et à sa radioactivité.

**Échelle** : H · **Catégorie** : Exo-alpha · **Fabricant** : Inconnu · **Nation** : Légion du
Cobalt · **Coût indicatif** : — · **Disponibilité (marché noir)** : Introuvable ·
**NT estimé** : II-III
**Taille** : 1,80 m · **Poids** : 620 kg
**Profondeur** : non
**Autonomie** : batterie THC (12h + capteurs solaires)

**Attributs :**
- Exo-Force : 43
- Modificateur de dommages : +16 (H)
- Ossature : titane structurel
- Architecture : lourde
- Intégrité : +5
- Résistance aux Dommages : -6
- Armure : 24 mm d'alliage de cobalt/cobalt-60
- Plaque d'armure supplémentaire : non
- Blindage : 25
- Visière : alon de 24 mm d'épaisseur
- Volet de sécurité : volet strié en super-acier de 6 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 10 (23)
- Catégorie GP : GP-B3
- Vitesse/VIT (points de mouv.) : 14 km/h/3(1)
- Malus d'initiative : -4

**Systèmes auxiliaires :** le plus souvent des systèmes de base.

**Armement et système défensif :** variés. Presque toujours des armes de contact et plus
rarement des armes à feu. Le plus souvent ces armures sont équipées de griffes de combat et d'un
lance-flammes. Les leaders ont souvent une électro-pince, un gant magma ou un système de ce
genre.

**Spécial — Irradiation :** l'irradiation dégagée par l'armure dépend de la quantité de Cobalt 60
qu'elle renferme. En général, elle sera de 1D6 par Tour, mais les armures des chefs peuvent
atteindre un niveau d'irradiation de 2D6 par Tour. Le rayonnement diminue avec la distance : à
2 m il est divisé par 2, à 3 m par 4. De plus, tous les 5 ans, le rayonnement est divisé par 2.

### 2.3 CONDOR *(⚠️ fiche distincte de Condor/Livre de Base, cf. §0.1 — ici catégorie Exo-1 Delta)*

**Échelle** : H · **Catégorie** : Exo-1 Delta · **Fabricant** : Gladius · **Nation** : Culte du
Trident/Veilleurs · **Coût indicatif** : 725 000 sols · **Disponibilité (marché noir)** : 1 (5) ·
**NT estimé** : III
**Taille** : 2,10 m · **Poids** : 829 kg
**Profondeur** : Opérationnelle -100 m si lestée / Limite -120 m / Écrasement -150 m
**Autonomie** : 100 ans (micro-moteur à fusion pressurisé azuréen)

**Attributs :**
- Exo-Force : 47
- Modificateur de dommages : +18 (H)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -9
- Armure : plastitane de 40 mm d'épaisseur
- Plaque d'armure supplémentaire : 10 mm de composite 133-cVHS
- Blindage : 40 (45 contre les armes à énergie et les charges creuses)
- Visière* : hyper-alon de 36 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 40
- Catégorie GP : GP-B3
- Vitesse/VIT (points de mouv.) : 1 nœud/<1(1) (marche) ou 10 km/h/2(1) (marche)
- Malus d'Initiative : à terre : -2

*\* le casque est un modèle quasi-intégral. Utilisez les valeurs de la coque si l'adversaire ne
vise pas (test à -7).*

**Systèmes auxiliaires :**
- Interface de contrôle à commande vocale (principale)
- Panneau de contrôle manuel (secours, avant-bras)
- Ordinateur NT IV, Gén. III
- Radar
- Analyseur radar
- Détecteur de mouvements niv. 13
- Dispositif d'isolation amphibie
- Système d'assistance et de contrôle
- Réserve d'oxygène (24 heures)
- Senseurs auditifs niv. 12 (+2 options au choix)
- Senseurs visuels niv. 15 (+2 options au choix)
- Haut-parleur
- Affichage tactique
- Analyseur environnemental
- Système antivol à reconnaissance neurale
- Dispositif de diagnostic
- Centrale d'auto-réparation niv. 12, Modules annexes pour 10 systèmes
- Dispositif d'assistance médicale niv. 5

**Note :** tous ces systèmes ont un Blindage IEM de niv. 3.

**Armement :**
- Dague neurale (poing)
- Dague moléculaire (poing)
- Fusil sonique incapacitant
- Mitrailleuse lourde, 30 rafales longues (pivot épaule)
- Lance-flammes, 12 tirs (pivot épaule)

### 2.4 COUGAR

**Échelle** : H · **Catégorie** : Exo-2 · **Fabricant** : Melian OP · **Nation** : Ligue rouge ·
**Coût indicatif** : 270 910 sols (640 678 avec RTG) · **Disponibilité (marché noir)** : 5 (10) ·
**NT estimé** : III
**Taille** : 2,40 m · **Poids** : 485 kg (612 kg avec RTG)
**Profondeur** : Opérationnelle -100 m si lestée / Limite -120 m / Écrasement -150 m
**Autonomie** : micro-réacteur à fusion azuréen pressurisé (95 ans) ou RTG NT III

**Attributs :**
- Exo-Force : 43
- Modificateur de dommages : +16 (H)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -10
- Armure : plastitane de 6 mm d'épaisseur
- Plaque d'armure supplémentaire : 2 mm d'hyper-acier RHA
- Blindage : 12
- Visière : alon de 6 mm d'épaisseur
- Volet de sécurité : 2 mm d'hyper-acier RHA
- Blindage visière (avec volet de sécurité) : 4 (9)
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : 0,5 nœud/<1(1) (marche) / 11 km/h/2(1) (marche) ou réacteur
  dorsal pour sauts d'une centaine de mètres
- Malus d'Initiative : 0

**Systèmes auxiliaires :**
- Interface de contrôle à commande vocale (principale)
- Panneau de contrôle manuel (secours, avant-bras)
- Réserve d'oxygène 24h
- Filtre à air x4 (48h)
- Dispositif d'isolation amphibie
- Stabilisateurs
- Amortisseurs de sauts
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'alimentation niv. 4
- Système d'assistance et de contrôle
- Ordinateur NT II, Gén. III
- Communicateur externe niv. 5
- ComLink
- Radar
- Analyseur radar
- Calculateur de tir Nemrod
- Indicateur d'acquisition
- Analyseur environnemental
- Revêtement anti-radiation niv. 13

**Armement :**
- Dague thermique (poing)
- Canon de 20 mm, 10 tirs (épaule)
- Deux tubes lance-missiles taille 2 (un de chaque côté du dos)
- Mitrailleuse lourde réactive sur pivot, 20 rafales longues (épaule)

### 2.5 ÉCLIPSE

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Gladius · **Nation** : Culte du
Trident · **Coût indicatif** : 2 300 000 sols · **Disponibilité (marché noir)** : -15 (-10) ·
**NT estimé** : IV
**Taille** : 1,80 m · **Poids** : 600 kg
**Profondeur** : Opérationnelle -200 m / Limite -240 m / Écrasement -300 m
**Autonomie** : PACAR (32 heures)

**Attributs :**
- Exo-Force : 40
- Modificateur de dommages : +15 (H)
- Ossature : nano-titane structurel
- Architecture : normale
- Intégrité : +8
- Résistance aux Dommages : -12
- Armure : hyper-terranium de 5 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 21
- Visière : hyper-alon de 12 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 10
- Catégorie GP : GP-C1
- Vitesse/VIT (points de mouv.) : 26 km/h/5(2) ou réacteur dorsal (autonomie : 1 heure)
- Malus d'initiative : -2

**Systèmes auxiliaires :**
- Bouclier anti-radiation 10
- Radar Vautour
- Analyseur Mrk XII Air-Strike
- Calculateur Nemrod
- Ordinateur Hector III (NT II/Mrk III)
- Indicateur d'acquisition Pycargue
- Isolation (amphibie)
- Commandes vocales
- Panneau commande manuelle
- Communicateur Hussard 2 (10 km)
- Comlink
- Borne relais personnelle 5
- Dispositif médical embarqué Cortex I
- Système de contrôle Hermès
- Stabilisateurs Haute Vitesse
- Régulateur thermique Polar system 2
- Analyseur environnemental
- Balise de détresse
- Réserve d'oxygène 36h
- Filtre à air x2 (36h)
- Filtre à gaz (96h)
- Système hygiénique niveau 1
- Système d'alimentation Pieston 2000 niveau 1 (12h)
- Senseurs visuels et auditifs
- Illuminateur

**Armement et système défensif :**
- Rayon choc RE 254 (non intégré)
- Oméga (non intégré)
- Lance-leurres
- Stockage leurres (6 leurres antimissiles)

### 2.6 ENDOVAL MRK II

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Varan Technologie · **Nation** : Ligue
Rouge · **Coût indicatif** : 750 000 sols · **Disponibilité (marché noir)** : 1 (5) ·
**NT estimé** : III
**Taille** : 1,80 m · **Poids** : 1 tonne
**Profondeur** : 100 m
**Autonomie** : THC/9 heures (batterie rechargeable par capteurs solaires)

**Attributs :**
- Exo-Force : 49
- Modificateur de dommages : +19 (H)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -7
- Armure : hyper-alliage Al+ (Ligue Rouge) de 4 mm d'épaisseur
- Plaque d'armure supplémentaire : 7 mm en hyper-composite 133-cVHS
- Blindage : 32 (38 contre les armes à énergie et les charges creuses)
- Visière : alon de 7 mm d'épaisseur
- Volet de sécurité : 7 mm en hyper-composite 133-cVHS
- Blindage visière (avec volet de sécurité) : 5 (28 ou 34 contre les armes à énergie et les
  charges creuses)
- Catégorie GP : GP-C2
- Vitesse/VIT (points de mouv.) : 27 km/h/5(2)
- Malus d'initiative : -2

**Systèmes auxiliaires :**
- Capteurs solaires
- Panneau de contrôle manuel de secours (détachable, avant-bras gauche ou droit)
- Commandes vocales
- Réserve d'oxygène de 72 heures
- Filtres à gaz carbonique (96h)
- Isolation Vangarm (amphibie)
- Stabilisateur Néo-tech piton
- Régulateur thermique Polar system 3
- Système hygiénique niveau 2
- Filtres Hygéna
- Système d'alimentation Pieston 2000 niveau 2
- Système d'assistance et de contrôle
- Système de navigation Opti 600V
- Ordinateur Méléar Oxy (NT III/Gén. III)
- Radar Vautour
- Illuminateur
- Analyseur Mk XII Air-Strike
- Calculateur Nemrod
- Borne relais 5
- Communication par câble Comlink et par SatAraid niveau 3
- Dispositif de diagnostic
- Analyseur environnemental
- Indicateur d'acquisition
- Autopilote 6 (réactif)
- Filtres à air

**Armement et système défensif :**
- Lance-leurres antimissiles (6 leurres)
- Bouclier anti-radiation 12
- Lance-grappin (30 mètres)
- Faisceau anti-moléculaire léger (48 charges)
- Dague rétractable
- Lance-flammes (12 charges)

**Note :** tous les systèmes ont un Blindage IEM 4.

### 2.7 ENIGMA

**Note :** on pense que cette armure, découverte à la surface, appartiendrait à la mystérieuse
Enclave de fer.

**Échelle** : H · **Catégorie** : Armure simple Oméga semi-mécanisée · **Fabricant** : Inconnu ·
**Nation** : Enclave de fer · **Coût indicatif** : — · **Disponibilité (marché noir)** :
Introuvable · **NT estimé** : IV
**Taille** : ajustée au pilote · **Poids** : 91 kg
**Profondeur** : NA
**Autonomie** : PE azuréen / 192 heures

**Attributs :**
- Exo-Force : Force du pilote +18
- Modificateur de dommages : variable
- Ossature : ArmaTi
- Architecture : NA
- Résistance aux Dommages : -4
- Intégrité : NA
- Blindage : 27 (10 contre les chocs)
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : (Athlétisme/COO) +9
- Malus d'initiative : —

**Systèmes auxiliaires** *(tous les systèmes de cette armure sont des équivalents aux systèmes
indiqués ci-dessous)* :
- Ordinateur NT IV Gén. IV
- Communicateur Lénid
- Communication par câble Comlink
- Commande vocale Harpie
- Filtres à gaz carbonique Oxydynamic (autonomie : 196h)
- Régulateur thermique Polar 2
- Système hygiénique Hygéna 1
- Filtre Hygéna
- Navigation Opti 600V
- Indicateur d'acquisition Pycargue
- Système assistance et contrôle classe A Hermès
- Stabilisateur Piton
- Système respiratoire (réserve d'oxygène de 98 heures)
- Générateur de lumière Feu Follet 1 (Artitech)
- Tactique Mac Clurr visière
- Analyseur environnemental
- Bouclier anti-radiation 10
- Radar Vautour
- Analyseur Mrk XII Air-Strike
- Illuminateur
- Revêtement anticorrosion 6
- Bottes de saut NT IV
- Champ de force réactif niveau 20

### 2.8 EXO-SOL (combinaison)

**Note :** cette combinaison révolutionnaire n'est pas véritablement une armure de combat.
Pourtant elle inclut de nombreux dispositifs que l'on ne trouve que dans les tenues plus lourdes.
La combinaison est faite d'une matière dont la composition est un véritable secret d'état.
L'Exo-Sol offre une excellente protection malgré sa légèreté. En cas d'attaque, les tissus se
contractent à l'endroit de l'impact. Elle est dotée d'un bouclier anti-radiation, d'un système de
chauffage grâce à un réseau de fibres spéciales intégré dans la combinaison. Il est rare que les
soldats de la République portent un casque avec cette combinaison. Ils disposeraient d'un autre
système leur permettant de rester pendant quelques heures en surface sans effets secondaires.
Personne ne sait s'il s'agit d'un champ de protection, d'un médicament ou d'un appareil inconnu
jusqu'à présent. Un appareil très léger se plaçant sur la tête est livré avec l'armure et relié à
des micro-batteries implantées dans la tenue. Cet appareil est un ordinateur régulant la
température de la combinaison (régulation thermique +/- 1 ou 2 crans). Il est équipé d'une
lunette infrarouge, d'un petit radar, d'un communicateur et d'un correcteur de tir relié à l'arme
portée par le fantassin (généralement un Licaï IV ; bonus : +2). Les bottes sont des bottes de
saut NT IV. Un exosquelette extrêmement discret permet d'augmenter sensiblement les performances
du fantassin.

**Échelle** : H · **Catégorie** : Exo-sol · **Fabricant** : Solaris · **Nation** : République du
Corail · **Coût indicatif** : — · **Disponibilité (marché noir)** : Introuvable ·
**NT estimé** : IV
**Taille** : ajustée au pilote · **Poids** : 12 kg
**Profondeur** : NA
**Autonomie** : PE azuréen (160 heures)

**Attributs :**
- Exo-Force : Force du personnage +4
- Modificateur de dommages : variable
- Ossature : ArmaTi
- Architecture : NA
- Résistance aux Dommages : -4
- Blindage : 11 (3 contre les chocs)
- Catégorie GP : GP-A1
- Vitesse/VIT (points de mouv.) : vitesse du personnage
- Malus d'initiative : —
- Bonus spécial : Coordination +2

**Systèmes auxiliaires :**
- Ordinateur Sector II NT IV Gén. 4
- Communicateur Lénid
- Système assistance et contrôle exo
- Régulateur thermique 2
- Système infrarouge
- Système d'assistance au tir
- Radar Hill (1 km) / Analyseur Montro (1 cible)

### 2.9 JAGUAR

**Note :** c'est l'armure standard des soldats de surface d'Hégémonie.

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Meklar Industrie · **Nation** :
Hégémonie · **Coût indicatif** : 408 000 sols · **Disponibilité (marché noir)** : -5 (1) ·
**NT estimé** : III
**Taille** : 1,80 m · **Poids** : 800 kg
**Profondeur** : Opérationnelle -500 m / Limite -600 m / Écrasement -750 m
**Autonomie** : PE Généticien / 24 heures (capteurs solaires régénèrent 1 minute en 10 minutes)

**Attributs :**
- Exo-Force : 47
- Modificateur de dommages : +18 (H)
- Ossature : Titane structurel
- Architecture : normale
- Intégrité : +2
- Résistance aux Dommages : -6
- Armure : hyper-alliage de titane de 2 mm d'épaisseur
- Plaque d'armure supplémentaire : 7 mm en hyper-composite 133-cRHA
- Blindage : 24 (28 contre les armes à énergie et les charges creuses)
- Visière : hyper-alon de 4 mm d'épaisseur
- Volet de sécurité : 7 mm en hyper-composite 133-cRHA
- Blindage visière (avec volet de sécurité) : 5 (22 ou 26 contre les armes à énergie et les
  charges creuses)
- Catégorie GP : GP-C2
- Vitesse/VIT (points de mouv.) : 1 nœud/M(1/2) (marche) ou 32 km/h/8(2) (surface)
- Malus d'initiative : —

**Systèmes auxiliaires :**
- Capteurs solaires
- Panneau de contrôle manuel de secours (détachable, avant-bras gauche ou droit)
- Contrôle optique
- Réserve d'oxygène de 48 heures
- Filtres à gaz carbonique (96h)
- Isolation Vangarm (amphibie)
- Stabilisateur Néo-tech piton
- Régulateur thermique Polar system 2
- Système hygiénique niveau 2
- Filtres Hygéna
- Système d'alimentation Pieston 2000 niveau 2
- Système d'assistance et de contrôle
- Système de navigation Opti 600V
- Ordinateur Hector III (NT II/Mrk III)
- Radar Vautour
- Illuminateur
- Analyseur Mk XII Air-Strike
- Calculateur Nemrod
- Borne relais 5
- Communication par câble Comlink et par SatAraid niveau 3
- Dispositif de diagnostic
- Analyseur environnemental
- Indicateur d'acquisition
- Bouclier anti-radiation 10
- Lance-leurres antimissiles (6 leurres)

**Armement :**
- Mitrailleuse lourde F67 (intégrée au bras droit, munitions 80)
- Lance-missiles anti-véhicules taille 4 (dos/épaules, 4 missiles)
- Pulseur palmaire TMP I (main gauche)
- Dague thermique (main droite)

**Note :** tous les systèmes ont un Blindage IEM 6.

### 2.10 SOLAR 1

**Note :** l'armure Solar 1 est utilisée pour de courtes missions en surface. Elle bénéficie d'un
équipement moderne mais sa principale fonction est la reconnaissance à faible distance.

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Meklar Industrie · **Nation** :
Hégémonie · **Coût indicatif** : 3 800 000 sols · **Disponibilité (marché noir)** : -10 (1) ·
**NT estimé** : III/IV
**Taille** : 1,80 m · **Poids** : 750 kg
**Profondeur** : 100 m si lestée
**Autonomie** : PE Généticien (9 heures)

**Attributs :**
- Exo-Force : 46
- Modificateur de dommages : +18 (H)
- Ossature : nano-titane structurel
- Architecture : normale
- Intégrité : +8
- Résistance aux Dommages : -12
- Armure : hyper-terranium de 9 mm d'épaisseur
- Plaque d'armure supplémentaire : nano-acier RHA de 2 mm
- Blindage : 36
- Visière : hyper-alon de 8 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 7
- Catégorie GP : GP-C3
- Vitesse/VIT (points de mouv.) : 50 km/h/8(2)
- Malus d'initiative : —

**Systèmes auxiliaires :**
- Bouclier anti-radiation 10
- Commandes vocales
- Projecteur Light
- Borne relais personnelle 5
- Caméra
- Dispositif médical embarqué Cortex I
- Diagnostic Scope system IV
- Balise de détresse
- Centrale de réparation Omni-vat 2, Modules annexes Uni-vat 2 (10 systèmes)
- Panneau commande manuelle
- Réserve d'oxygène 24h
- Filtre à air x2 (24h)
- Filtre à gaz (96h)
- Régulateur thermique Polar system 2
- Système hygiénique niveau 1
- Système d'alimentation Pieston 2000 niveau 1 (12h)
- Système de contrôle Hermès
- Ordinateur Hector III (NT II/Gén. III)
- Radar Vautour
- Analyseur Mrk XII Air-Strike
- Calculateur Nemrod
- Antichoc Hammerdale niv. 2
- Communicateur Hussard 2 (10 km)
- Comlink
- Analyseur environnemental
- Indicateur d'acquisition Pycargue
- Isolation (amphibie)
- Stabilisateurs Haute Vitesse
- Senseurs visuels et auditifs

**Armement et système défensif :**
- Champ de force 10
- Découpe-roche de poche (non intégré)
- Dague thermique RE 254 (non intégrée)

### 2.11 VARAN

**Échelle** : H · **Catégorie** : Exo-alpha · **Fabricant** : Melian OP · **Nation** : Ligue
rouge · **Coût indicatif** : 267 410 sols · **Disponibilité (marché noir)** : -10 (5) ·
**NT estimé** : III
**Taille** : 1,78 m · **Poids** : 219 kg
**Profondeur** : Opérationnelle -500 m / Limite -550 m / Écrasement -750 m
**Autonomie** : PACAR (6h à 41 km/h ou 16 heures à 26 km/h)

**Attributs :**
- Exo-Force : 34
- Modificateur de dommages : +12 (H)
- Ossature : PlasTirAl
- Architecture : légère
- Intégrité : +0
- Résistance aux Dommages : -1
- Armure : hyper-alliage de titane de 6 mm d'épaisseur
- Plaque d'armure supplémentaire : hyper-acier RHA de 2 mm d'épaisseur
- Blindage : 17
- Visière : alon de 12 mm d'épaisseur
- Volet de sécurité : strié en hyper-acier RHA de 6 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 7 (17)
- Catégorie GP : GP-B4
- Vitesse/VIT (points de mouv.) : 41 km/h/7(2)
- Modificateur d'initiative : +1

**Systèmes auxiliaires :**
- Bouclier anti-radiation 10
- Radar Vautour
- Analyseur Mrk XII Air-Strike
- Calculateur Nemrod
- Ordinateur Méléar Oxy (NT II/Gén. III)
- Indicateur d'acquisition Pycargue
- Isolation (amphibie)
- Commandes vocales
- Panneau commande manuelle
- Communicateur Hussard 2 (10 km)
- Comlink
- Borne relais personnelle 5
- Dispositif médical embarqué Cortex I
- Lance-grappin (30 mètres)
- Autopilote 6 (réactif)
- Système de contrôle Hermès
- Stabilisateurs Haute Vitesse
- Régulateur thermique Polar system 2
- Antichoc Hammerdale niv. 2
- Analyseur environnemental
- Néo-Tech Piton stab
- Balise de détresse
- Réserve d'oxygène 24h
- Filtre à air x2 (24h)
- Filtre à gaz (96h)
- Système hygiénique niveau 1
- Système d'alimentation Pieston 2000 niveau 1 (12h)
- Senseurs visuels et auditifs
- Illuminateur

**Armement et système défensif :**
- Canon sonique
- Griffes de combat
- Module Véga (non intégré)
- Générateur électrique Anguille IV

### 2.12 VAUBAN *(⚠️ fiche distincte de Vauban/Livre de Base, cf. §0.1)*

**Échelle** : H · **Catégorie** : Exo-1 · **Fabricant** : Empire des Généticiens · **Nation** :
Empire des Généticiens · **Coût indicatif** : 750 000 sols · **Disponibilité (marché noir)** :
10 (15) · **NT estimé** : IV
**Taille** : 2,10 m · **Poids** : 530 kg
**Profondeur** : Opérationnelle -100 m si lestée / Limite -120 m / Écrasement -150 m
**Autonomie** : 30 ans (micro-réacteur à fusion pressurisé généticien)

**Attributs :**
- Exo-Force : 41
- Modificateur de dommages : +15 (H)
- Ossature : PlasTirAl
- Architecture : Normale
- Intégrité : +3
- Résistance aux Dommages : -9
- Armure : nano-acier VHS de 3,8 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 17
- Visière : alon de 24 mm d'épaisseur
- Volet de sécurité : hyper-acier RHA de 2 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 10 (16)
- Catégorie GP : GP-D4
- Vitesse/VIT (points de mouv.) : 0,5 nœud/<1(1) (marche) ou 220 km/h/36(8) (marche)
- Malus d'initiative : à terre : -2

**Systèmes auxiliaires :**
- Interface de contrôle à visière optique (principal)
- Panneau de contrôle manuel (secours, avant-bras)
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'assistance et de contrôle
- Contrôle de pression
- Système de navigation niv. 13
- Ordinateur NT IV, Gén. III
- Dispositif d'isolation amphibie
- Radar
- Analyseur radar
- Communicateur externe niv. 3
- ComLink
- Système d'alimentation niv. 2
- Verrouillage antivol niv. 7 (2 systèmes au choix)
- Dispositif de diagnostic
- Analyseur environnemental
- Indicateur d'acquisition
- Revêtement anti-radiation niv. 15
- Stabilisateur haute vitesse

**Armement :**
- Dague rétractable (poing)
- Générateur défensif électrique
- Pistolet lourd (main)
- Lance-harpon (bras droit)
- Canon à neutrons (épaule gauche)

---

## 3. Armures hybrides

### 3.1 ASSASSIN

**Note :** ces armures sont utilisées par les Assassins au service des Patriarches.

**Échelle** : H · **Catégorie** : Exo-Alpha · **Fabricant** : Inconnu · **Nation** : Hégémonie ·
**Coût indicatif** : 3 100 000 sols · **Disponibilité (marché noir)** : -10 (-1) ·
**NT estimé** : VI
**Taille** : ajustée au pilote · **Poids** : 200 kg
**Profondeur** : Opérationnelle -17 000 m / Limite -17 000 m / Écrasement -25 500 m
**Autonomie** : PE Généticien (13,5 heures avec PIT)

**Attributs :**
- Exo-Force : 29
- Modificateur de dommages : +9 (H)
- Ossature : Fusion B
- Architecture : ultra-légère
- Intégrité : +4
- Résistance aux Dommages : -5
- Armure : ACS de 3 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 17
- Visière : ACS de 3 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 6
- Catégorie GP : GP-B3
- Vitesse/VIT (points de mouv.) : 6 nœuds/2(1) (PIT) ou 6 nœuds/1(1) (exo-palmes) ou
  53 km/h/9(2) (surface)
- Malus d'initiative : —

**Systèmes auxiliaires :**
- Revêtements anéchoïques
- Réseau à pulsion électrique
- Capteur d'énergie ambiante généticien
- Commandes télépathiques
- Membrane respiratoire
- Réserve oxygène de secours
- Filtres Dioxy
- Stabilisateur
- Régulateur thermique
- Contrôles
- Pressurisateur
- Ordinateur (Gen VI, NT VI)
- Communicateur (portée 4 000 m/5 km)
- Système d'analyse tactique
- Analyseur environnemental
- Indicateur d'acquisition
- Système de navigation
- Sonar actif Élinie Z (omni 10 NM)
- Sonar passif Sealag (16 NM)
- Analyseur DV4 (6 cibles)
- Calculateur Pélia (4 cibles)
- Radar Vautour (5 km)
- Diagnostic
- Dispositif médical embarqué Cortex I
- Bouclier de force 10

**Armement :**
- Lance-micro-torpilles (6x micro-torpilles Wasp)
- Dague thermique (main gauche)
- Dague neurale (main droite)
- Gant d'énergie (main droite)
- Canon sonique (bras droit)

### 3.2 EXPLORA *(fiche transmise par Saar, 2026-09-29 — placement en Hybrides confirmé par la
liste complète de la section, cf. §0.5)*

**Échelle** : H · **Catégorie** : Exo-Alpha (exo d'assistance) · **Fabricant** : Explora
Industrie · **Nation** : Tyr · **Coût indicatif** : 75 000 sols · **Disponibilité (marché noir)**
: 10 (15) · **NT estimé** : III
**Taille** : ajustée au pilote · **Poids** : 103 kg (15 kg supporté)
**Profondeur** : Opérationnelle -4 000 m / Limite -4 800 m / Écrasement -6 000 m
**Autonomie** : 10 heures (THCc)

**Attributs :**
- Exo-Force : Force du pilote +5
- Modificateur de dommages : variable
- Ossature : Fivaltine
- Architecture : NA
- Intégrité : +5
- Résistance aux Dommages : -6
- Armure : plastitane de 20 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 15
- Visière : alon de 10 mm d'épaisseur
- Volet de sécurité : volet strié en super-acier de 2 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 6 (12)
- Catégorie GP : GP-A4
- Vitesse/VIT (points de mouv.) : COO/Athlétisme +5 (exo-palmes/marche en surface)
- Malus d'Initiative : sous l'eau : +0 ; à terre : +0

**Systèmes auxiliaires :**
- Interface de contrôle à commande vocale
- Système respiratoire (réserve d'oxygène de 24 heures)
- Ordinateur NT III, Gén. III
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Radar
- Analyseur radar
- Communicateur Lénid
- ComLink
- Régulateur thermique
- Système hygiénique niv. 1
- Système de navigation niv. 10
- Détecteur d'acquisition
- Système d'assistance et de contrôle
- Contrôle de pression
- Générateur de lumière Feu follet
- Afficheur tactique
- Analyseur environnemental
- Revêtement anti-radiation niv. 10

**Armement :**
- Dague rétractable (poing)
- Générateur défensif électrique
- Lance-harpon moyen, 10 charges (bras)

**Note :** elle peut être équipée d'un module spécial placé sur ses épaules qui lui donne l'usage
de deux bras mécanisés supplémentaires.

### 3.3 HEIMDALL-PYRELIA *(⚠️ fiche distincte de Heimdall-Pyrelia/Livre de Base, cf. §0.1 —
reclassée ici depuis les Sous-marines, cf. §0.6)*

**Échelle** : H · **Catégorie** : Exo-2 · **Fabricant** : Pyrelia Industrie · **Nation** :
République du Corail · **Coût indicatif** : 1 600 000 sols · **Disponibilité (marché noir)** :
5 (10) · **NT estimé** : III
**Taille** : 2,40 m · **Poids** : 2 375 kg
**Profondeur** : Opérationnelle -10 000 m / Limite -12 000 m / Écrasement -15 000 m
**Autonomie** : 3 heures (batteries THCc)

**Attributs :**
- Exo-Force : 68
- Modificateur de dommages : +29 (H) / -1 (V-)
- Ossature : PlasTirAl
- Architecture : Normale
- Intégrité : +3
- Résistance aux Dommages : -10
- Armure : plastitane de 70 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 33
- Visière : alon de 40 mm d'épaisseur
- Volet de sécurité : hyper-acier RHA de 6 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 15 (25)
- Catégorie GP : GP-C4
- Vitesse/VIT (points de mouv.) : 9 nœuds/2(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  26 km/h/9(2) (surface)
- Malus d'Initiative : sous l'eau : -3 ; à terre : -6

**Systèmes auxiliaires :**
- Interface neuronale de contrôle à commandes télépathiques (principale)
- Interface de contrôle à commandes vocales (secours)
- Panneau de contrôle manuel (secours, bras)
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Communicateur Lénid
- ComLink
- Système d'assistance et de contrôle
- Système d'assistance et de contrôle (secours)
- Contrôle de pression
- Ordinateur NT IV, Gén. II
- Ordinateur NT II, Gén. I (secours)
- Générateur de lumière Feu follet
- Balise de détresse
- Verrouillage antivol niv. 7 (1 système au choix)
- Grappin magnétique
- Affichage tactique
- Détecteur d'acquisition
- Dispositif d'assistance médicale niv. 4
- Atténuateur sonore Masqueur Tri-Magma niv. 3

**Armement :**
- Dague moléculaire rétractable (poing)
- Lance-harpon lourd, 10 charges (bras)
- Lance-filet, 2 tirs

### 3.4 IMPÉRIALE *(armure inédite — cf. §0.5 ; confirmée en Hybrides par Saar, 2026-09-29,
déplacée depuis les Sous-marines où elle avait été placée par erreur)*

**Note :** il n'existe que 3 armures impériales. La première est la propriété du Haut-Amiral (sa
célèbre armure blanche), les deux autres sont jalousement gardées dans les centres de recherche
de l'amirauté. Personne ne sait, à l'heure actuelle, reproduire de telles merveilles. Elles ont
été produites sous l'Empire Généticien.

**Échelle** : H · **Catégorie** : Exo-0 · **Fabricant** : Empire Généticien · **Nation** :
Hégémonie · **Coût indicatif** : 8,7 millions de sols · **Disponibilité (marché noir)** :
Introuvable · **NT estimé** : VI
**Taille** : 1,85 m · **Poids** : 750 kg
**Profondeur** : Opérationnelle -20 000 m / Limite -24 000 m / Écrasement -30 000 m
**Autonomie** : générateur à fusion pressurisé généticien / 250 ans

**Attributs :**
- Exo-Force : 51
- Modificateur de dommages : +20 (H) / -6 (V-)
- Ossature : Fusion B
- Architecture : normale
- Intégrité : +10
- Résistance aux Dommages : -15
- Armure : Fusion B de 10 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 73
- Visière* : fine fente en ACS de 20 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 44
- Catégorie GP : GP-C4
- Vitesse/VIT (points de mouv.) : 10 nœuds/2(1) (PIT) ou 60 km/h/10(3) (surface) / réacteur
  dorsal (1 heure d'autonomie)
- Malus d'initiative : sous l'eau : -1 ; à terre : -2

*\* casque quasi-intégral généticien, il faut donc viser pour toucher la visière (test à -7).*

**Systèmes auxiliaires :**
- Commandes télépathiques
- Membrane respiratoire
- Réserve oxygène de secours
- Filtres Dioxy
- Stabilisateur
- Régulateur thermique 4
- Système Hygéna
- Filtres Hygéna
- Contrôles
- Pressurisateur
- Ordinateur (Gen VI, NT VI)
- Communicateur (portée 4 000 m/5 km)
- Système d'analyse tactique
- Analyseur environnemental
- Indicateur d'acquisition
- Système de navigation
- Auto-patch
- Sonar actif Élinie Z (omni 10 NM)
- Sonar passif Sealag (16 NM)
- Analyseur DV4 (6 cibles)
- Calculateur Pélia (4 cibles)
- Radar Vautour (5 km)
- Diagnostic
- Centrale de réparation Omni-Vat niveau 10, Annexes Uni-Vat (x10)
- Champ de force 12
- Dispositif médical embarqué Cortex I

**Armement :**
- Pulseur TMP II (32 charges)
- Lance-torpilles taille 1 (4 torpilles)
- Faisceau anti-moléculaire léger NT VI
- Pulseur palmaire TMP I (24 charges)
- Dague moléculaire
- Générateur micro-ondes 6

**Note :** tous les systèmes ont un Blindage IEM 12.

### 3.5 OURAKEN *(⚠️ fiche distincte d'Ouraken/Livre de Base, cf. §0.1 — confirmé en Hybrides
par Saar, 2026-09-29)*

**Échelle** : H · **Catégorie** : Exo-2 · **Fabricant** : Gladius · **Nation** : Culte du
Trident/Veilleurs · **Coût indicatif** : 6 millions de sols · **Disponibilité (marché noir)** :
1 (5) · **NT estimé** : III/IV
**Taille** : 2,40 m · **Poids** : 2 692 kg
**Profondeur** : Opérationnelle -12 080 m / Limite -14 500 m / Écrasement -18 120 m
**Autonomie** : en années (RTGc NT IV)

**Attributs :**
- Exo-Force : 71
- Modificateur de dommages : +30 (H) / +0 (V-)
- Ossature : ArmaTi
- Architecture : normale
- Intégrité : +7
- Résistance aux Dommages : -14
- Armure : plastitane de 86 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 39
- Visière : hyper-alon de 40 mm d'épaisseur
- Volet de sécurité : super-acier de 5 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 21 (32)
- Catégorie GP : GP-C3
- Vitesse/VIT (points de mouv.) : 7 nœuds/2(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  14 km/h/3(2) (surface)
- Malus d'Initiative : sous l'eau : -3 ; à terre : -6

**Systèmes auxiliaires :**
- Interface de contrôle à filet neuronal (principale)
- Interface de contrôle à commande vocale (secours)
- Système respiratoire (réserve d'oxygène de 72 heures)
- Ordinateur NT III, Gén. IV
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Calculateur de tir
- Communicateur Lénid
- ComLink
- Régulateur thermique
- Balise de détresse
- Système hygiénique niv. 1
- Système d'alimentation niv. 2
- Système de navigation niv. 13
- Détecteur d'acquisition
- Système d'assistance et de contrôle
- Contrôle de pression
- Générateur de lumière Feu follet
- Affichage tactique
- Champ IEM anti-torpille niv. 3
- Autopilote niveau 12 (réactif, retour à la base en cas de perte de conscience du pilote)
- Antivol à reconnaissance neuronale

**Armement :**
- Dague thermique rétractable (poing)
- Canon à neutrons fantassin (épaule)
- Lance-harpon lourd, 10 charges (bras)
- Lance-harpon AV multiple, 3 charges (bras)
- 2 lance-torpilles Taille 2, 1 torpille Taille 2 chacun

**Note :** tous ces systèmes ont un Blindage IEM 3.

### 3.6 OVERLORD

**Note :** on sait peu de chose sur cette armure découverte dans un dépôt et conservée
jalousement par l'Union Méditerranéenne. Il semblerait qu'elle était utilisée par les soldats de
l'Empire au moment de la révolte de l'Alliance Azure.

**Échelle** : H · **Catégorie** : Exo-1 · **Fabricant** : Empire des Généticiens · **Nation** :
Empire des Généticiens · **Coût indicatif** : — · **Disponibilité (marché noir)** : Introuvable ·
**NT estimé** : V/VI
**Taille** : 2,25 m · **Poids** : 1 640 kg
**Profondeur** : Opérationnelle -20 000 m / Limite -24 000 m / Écrasement -30 000 m
**Autonomie** : 300 ans (micro-moteur à fusion pressurisé généticien)

**Attributs :**
- Exo-Force : 62
- Modificateur de dommages : +26 (H) / -2 (V-)
- Ossature : Fusion B
- Architecture : normale
- Intégrité : +10
- Résistance aux Dommages : -16
- Armure : Fusion B de 5 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 46
- Visière : casque lisse généticien intégré à l'armure
- Catégorie GP : GP-D3
- Vitesse/VIT (points de mouv.) : 18 nœuds/6(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  110 km/h/19(4) (surface)
- Malus d'initiative : non

**Systèmes auxiliaires :** inconnus, mais comprennent une IA limitée généticienne et un détecteur
sous-marin généticien.

### 3.7 PIRATE — variante Classique

**Note (commune aux deux variantes Pirate) :** les pirates préfèrent largement les armures
légères et fonctionnelles. Ce sont généralement des armures Alpha mécanisées ou avec un
exosquelette d'assistance. La plupart sont constituées de pièces récupérées sur d'autres armures.
Les pirates intègrent très peu d'équipements à leurs armures.

**Échelle** : H · **Catégorie** : Exo-Alpha (exo d'assistance) · **Fabricant** : Pirates ·
**Nation** : Pirates · **Coût indicatif** : 74 000 sols · **Disponibilité (marché noir)** :
-5 (1) · **NT estimé** : III
**Taille** : ajustée au pilote · **Poids** : 150 kg (31 kg supporté)
**Profondeur** : Opérationnelle -6 150 m / Limite -7 380 m / Écrasement -9 225 m
**Autonomie** : 12 heures (THCc)

**Attributs :**
- Exo-Force : Force du personnage +4
- Modificateur de dommages : selon la Force du personnage
- Ossature : PlasTirAl
- Architecture : NA
- Intégrité : +3
- Résistance aux Dommages : -4
- Armure : plastitane de 18 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 13
- Visière : alon de 6,8 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 5
- Catégorie GP : GP-B1
- Vitesse/VIT (points de mouv.) : exo-palmes / vitesse du personnage augmentée
  (COO/Athlétisme +4)
- Malus d'initiative : sous l'eau : 0 ; à l'air libre : 0

**Systèmes vitaux :**
- Ordinateur Pristar III (NT III/Gén. II)
- Sonscan actif Dauphin II
- Sonscan passif Kilian
- Analyseur Mk 12 Sea-Star
- Calculateur Nemrod
- Commandes vocales
- Comlink
- Communicateur Lénid II
- Pressurisateur
- Régulateur thermique
- Contrôle Class A
- Réserve d'oxygène 24h
- Filtre 96h
- Stabilisateur
- Système de navigation

### 3.8 PIRATE — variante Lourde

**Échelle** : H · **Catégorie** : Exo-Alpha · **Fabricant** : Pirates · **Nation** : Pirates ·
**Coût indicatif** : 120 000 sols · **Disponibilité (marché noir)** : -5 (1) · **NT estimé** : III
**Taille** : 1,80 m · **Poids** : 200 kg
**Profondeur** : Opérationnelle -10 160 m / Limite -10 160 m / Écrasement -15 240 m
**Autonomie** : 12 heures (THCc) ou 3 heures avec un PIT

**Attributs :**
- Exo-Force : 29
- Modificateur de dommages : +9 (H)
- Ossature : PlasTirAl
- Architecture : ultra-légère
- Intégrité : -3
- Résistance aux Dommages : +2
- Armure : plastitane de 37 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 14
- Visière : alon de 30 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière : 13
- Catégorie GP : GP-B3
- Vitesse/VIT (points de mouv.) : 4 nœuds/1(1) (exo-palmes ou PIT) / 26 km/h/5(2) (surface)
- Malus d'initiative : sous l'eau : 0 ; à terre : 0

**Systèmes auxiliaires :**
- Ordinateur Pristar III (NT III/Gén. II)
- Sonscan actif Dauphin II
- Sonscan passif Kilian
- Analyseur Mk 12 Sea-Star
- Calculateur Nemrod
- Commandes vocales
- Comlink
- Communicateur Lénid II
- Pressurisateur
- Régulateur thermique
- Contrôle Class A
- Réserve d'oxygène 24h
- Filtre 96h
- Stabilisateur
- Système de navigation

**Note :** tous les systèmes ont un Blindage IEM 4.

### 3.9 SYLACO

**Note :** cette armure expérimentale équipe depuis peu les grands amiraux de la flotte
hégémonienne. C'est un prototype extrêmement léger et souple qui peut être porté aussi bien à
l'air libre que dans l'eau. L'armure est constituée d'une matière souple recouvrant un
exosquelette d'assistance extrêmement léger. Une fois activée, la matière souple polarisable se
durcit et les renforts incorporés se mettent en place en un Tour. Le casque se constitue à partir
de la collerette de l'armure dont la partie arrière recouvre tout l'arrière du crâne jusqu'à son
sommet. La visière est constituée de nano-alon dispersable. Les gants se constituent à partir du
dispositif sur les poignets de l'armure qui libèrent la matière dispersable. Les exo-palmes
peuvent être ou non déployées. Il faut un Tour pour activer l'armure et un Tour supplémentaire
pour qu'elle se pressurise. Une armure en parfait état n'impose aucun malus à celui qui la porte,
sauf si le système de contrôle de l'exosquelette est détruit — dans ce cas, c'est l'équivalent
d'une armure exo-Alpha. Une telle armure n'a pas de prix et il n'en existe qu'une dizaine au fond
des mers. Elle est basée sur un modèle Généticien.

**Échelle** : H · **Catégorie** : Exo-Alpha (exo d'assistance) · **Fabricant** : Inconnu ·
**Nation** : Hégémonie · **Coût indicatif** : 2 000 000 de sols · **Disponibilité (marché noir)**
: Introuvable · **NT estimé** : V-VI
**Taille** : ajustée au personnage · **Poids activé/désactivé (supporté)** : 80 kg (0 kg) /
65 kg (8 kg)
**Profondeur** : Opérationnelle -8 000 m / Limite -9 600 m / Écrasement -12 000 m
**Autonomie** : micro-fusion pressurisé azuréen / 50 ans

**Attributs :**
- Exo-Force : Force du personnage +6
- Modificateur de dommages : selon la Force du personnage
- Ossature : ArmaTi
- Architecture : NA
- Intégrité : +7
- Résistance aux Dommages : -8
- Armure : nano-terranium de 2 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 12
- Visière : nano-alon de 2,6 mm d'épaisseur
- Volet de sécurité : 2 mm de nano-terranium dispersable
- Blindage visière (avec volet de sécurité) : 4 (12)
- Catégorie GP : GP-B3
- Vitesse/VIT (points de mouv.) : vitesse du personnage augmentée (COO/Athlétisme +6)
- Malus d'initiative : —

*Tant que l'armure n'est pas activée, la tenue offre une protection de 5 contre les attaques
physiques et de 2 aux Tests contre les seuils d'inconscience.*

**Systèmes auxiliaires :**
- Ordinateur Ultia VI (NT V/Gén. 3)
- Sonscan actif Élinie Z
- Sonscan passif Sealag
- Analyseur DV4
- Calculateur Pélia
- Commandes télépathiques
- Réserve oxygène (12h)
- Filtres à gaz (96h)
- Système d'analyse tactique
- Comlink
- Communicateur Comdive 200
- Pressurisateur
- Système de navigation
- Régulateur thermique 2
- Contrôle exo
- Autopilote 8 (réactif)
- Champ de force azuréen 6

**Armement :**
- Dague moléculaire
- Pulseur palmaire TMP I

**Note :** tous les systèmes ont un Blindage IEM 8.

### 3.10 SYLPH 56 *(⚠️ fiche distincte de Sylph 56/Livre de Base — catégorie Exo-1E ici contre
Exo-1 dans le Livre de Base, cf. §0.1)*

**Échelle** : H · **Catégorie** : Exo-1E · **Fabricant** : Millénium · **Nation** : Union
Méditerranéenne · **Coût indicatif** : 2 000 000 sols · **Disponibilité (marché noir)** : 1 (5) ·
**NT estimé** : III
**Taille** : 2 m · **Poids** : 1 600 kg
**Profondeur** : Opérationnelle -15 000 m / Limite -18 000 m / Écrasement -22 500 m
**Autonomie** : micro-moteur à fusion pressurisé azuréen (100 ans)

**Attributs :**
- Exo-Force : 62
- Modificateur de dommages : +26 (H) / -2 (V-)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -9
- Armure : nano-composite fc/epoxy de 71 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 41
- Visière* : hyper-alon de 20 mm d'épaisseur
- Volet de sécurité : non
- Blindage visière (avec volet de sécurité) : 27
- Catégorie GP : GP-C4
- Vitesse/VIT (points de mouv.) : 10 nœuds/3(1) (PIT) ou 3 nœuds/1(1) (exo-palmes) ou
  35 km/h/6(2) (surface)
- Malus d'Initiative : sous l'eau : -2 ; à terre : -4

*\* le casque est un modèle quasi-intégral. Utilisez les valeurs de la coque si l'adversaire ne
vise pas la visière (test à -7).*

**Systèmes auxiliaires :**
- Interface de contrôle à visière optique (principal)
- Panneau de contrôle manuel (secours, avant-bras)
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'assistance et de contrôle
- Contrôle de pression
- Système de navigation niv. 13
- Ordinateur NT IV, Gén. II
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Communicateur Lénid
- ComLink
- Générateur de lumière Feu follet
- Caméra

**Armement :**
- Dague moléculaire rétractable (poing)
- Générateur défensif électrique
- Lance-harpon lourd, 10 charges (bras)

### 3.11 TYPHON

**Note :** fiche confirmée par Saar (2026-09-29) — comble l'en-tête manquant dans l'export brut
initial. La déduction provisoire précédente (Exo-Force 30, modificateur +10, armement identique
à Typhon/Livre de Base) s'est révélée exacte.

**Échelle** : H · **Catégorie** : Exo-Alpha · **Fabricant** : Melian OP · **Nation** : Ligue
rouge · **Coût indicatif** : 300 000 sols (500 000 avec RTG) · **Disponibilité (marché noir)** :
5 (10) · **NT estimé** : III
**Taille** : 1,80 m · **Poids** : 170 kg (210 kg avec RTG)
**Profondeur** : Opérationnelle -7 000 m / Limite -8 400 m / Écrasement -10 500 m
**Autonomie** : 100 ans (micro-réacteur à fusion pressurisé azuréen) ou RTGc

**Attributs :**
- Exo-Force : 30
- Modificateur de dommages : +10 (H)
- Ossature : PlasTirAl
- Architecture : normale
- Intégrité : +3
- Résistance aux Dommages : -4
- Armure : hyper-composite fibre de carbone et epoxy de 18 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 15
- Visière : alon de 12 mm d'épaisseur
- Volet de sécurité : 4 mm d'hyper-acier RHA
- Blindage visière (avec volet de sécurité) : 7 (15)
- Catégorie GP : GP-B2
- Vitesse/VIT (points de mouv.) : 3 nœuds/1(1) (exo-palmes) ou 3 nœuds/1(1) (PIT dorsal) ou
  16 km/h/3(1) (surface)
- Malus d'Initiative : sous l'eau : +0 ; à terre : +0

**Systèmes auxiliaires :**
- Interface de contrôle à visière optique (principal)
- Panneau de contrôle manuel (secours, avant-bras)
- Système respiratoire (réserve d'oxygène de 48 heures)
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'assistance et de contrôle
- Contrôle de pression
- Système de navigation niv. 10
- Ordinateur NT III, Gén. III
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan niv. 12
- Radar
- Analyseur radar niv. 12
- ComLink
- Communicateur Comdiv 200
- Communicateur externe niv. 1
- Système d'alimentation niv. 2
- Verrouillage antivol niv. 7 (1 système au choix)
- Dispositif de diagnostic
- Affichage tactique
- Dispositif de réparation : Centrale d'auto-réparation niv. 12, Modules annexes pour 5 systèmes

**Armement :**
- Dague rétractable (poing)
- Dague thermique (poing)
- Générateur défensif à champ micro-ondes
- Lance-harpon moyen, 10 charges (bras)

### 3.12 VANGUARD *(⚠️ fiche distincte de Vanguard/Livre de Base, cf. §0.1)*

**Catégorie** : Exo-1 · **Fabricant** : Alliance Azur · **Nation** : Alliance Azur ·
**Coût indicatif** : 3 400 000 sols · **Disponibilité (marché noir)** : 10 (15) ·
**NT estimé** : III-IV
**Taille** : 2,25 m · **Poids** : 1 700 kg
**Profondeur** : Opérationnelle -4 000 m / Limite -4 800 m / Écrasement -6 000 m
**Autonomie** : 150 ans (micro-réacteur à fusion pressurisé azuréen)

**Attributs :**
- Exo-Force : 62
- Modificateur de dommages : +26 (H) / -2 (V-)
- Ossature : PlasTirAl
- Architecture : Normale
- Intégrité : +3
- Résistance aux Dommages : -9
- Armure : plastitane de 24 mm d'épaisseur
- Plaque d'armure supplémentaire : non
- Blindage : 16
- Visière : alon de 24 mm d'épaisseur
- Volet de sécurité : hyper-acier RHA de 2 mm d'épaisseur
- Blindage visière (avec volet de sécurité) : 10 (16)
- Catégorie GP : GP-D4
- Vitesse/VIT (points de mouv.) : 4 nœuds/1(1) (exo-palmes) ou 20 nœuds/7(2) (PIT) ou
  150 km/h/27(6) (surface)
- Malus d'initiative : sous l'eau : -2 ; à terre : -4

**Systèmes auxiliaires :**
- Interface de contrôle à visière optique (principal)
- Panneau de contrôle manuel (secours, avant-bras)
- Système respiratoire (réserve d'oxygène de 24 heures)
- Régulateur thermique
- Système hygiénique niv. 2
- Système d'assistance et de contrôle
- Contrôle de pression
- Système de navigation niv. 13
- Ordinateur NT IV, Gén. III
- Sonscan actif directionnel
- Sonscan passif
- Analyseur sonscan
- Communicateur Comdiv 200
- ComLink
- Système d'alimentation niv. 2
- Verrouillage antivol niv. 7
- Dispositif de diagnostic

**Armement :**
- Pistolet lourd sous-marin à dards (main)
- Dague rétractable (poing)
- Générateur défensif électrique
- Lance-harpon lourd, 10 charges (bras)

---

## 4. Récapitulatif — correspondance avec les illustrations

| Armure (Guide technique) | Illustration dans `docs/Illustration/exo-armure/` |
|---|---|
| Cougar | absente (en cours de génération par Saar) |
| Série A | absente (en cours de génération par Saar) |
| Explora | absente (en cours de génération par Saar) |
| Mentor, Moloch, Nymph 1-A, Odin, Orka, Condor, Vauban, Vanguard, Heimdall-Pyrelia, Ouraken, Sylph 56 | présentes (attention : illustration probablement pensée pour une seule des deux fiches — Livre de Base ou Guide — à clarifier si besoin) |
| Impériale | probable `exo_imperiale.png` (cf. §0.5) |
| Faust, Noelid, Oméga, Sirya IV/Syria IV, Syd, Vulcain, Bulldog, Cobalt, Éclipse, Endoval Mrk II, Enigma, Exo-Sol, Jaguar, Solar 1, Varan, Assassin | présentes sous des noms de fichiers proches (`noelid`, `omega`, `syria4`, `syo`, `vulkain`, `bulldog`, `cobalt`, `eclipse`, `endovalmrkII`, `enigma`, `sol`, `jaguar`, `solar1`, `assassin`) — correspondance nom-fichier/nom-fiche à confirmer au cas par cas |
| Overlord, Pirate (Classique), Pirate (Lourde) | `exo_overload.png` (nom de fichier probable, à corriger en « overlord ») et `exo_pirate.png` (une seule image pour les deux variantes ?) sont les candidats probables |
| Sylaco | absente — aucune illustration identifiée |
| — | `exo_heimdall.png` est un doublon de `exo_heimdall-pyrelia.png` (§0.7), pas un fichier à part |

Les trois armures en cours de génération (Cougar, Série A, Explora) ont désormais toutes une
fiche technique complète — il ne manque plus que leurs illustrations. Les 12 fiches Hybrides
(§3) sont maintenant toutes complètes.
