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
principal/secours pour l'armure mécanisée, §4.9) — **à l'exception de deux règles RAW de ce
document qui n'ont pas encore de propriétaire clair entre les deux chantiers** : la Survie I.E.M.
(§4.7) et la désactivation automatique en cas de dépassement de la Gestion systèmes (§4.1) — point
à trancher en Phase 4/Passage au PLAN (§8.1).

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
  la RAW ne fournit aucun critère chiffré de hiérarchisation entre systèmes (question ouverte,
  §6).
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

**Question ouverte** : la RAW ne précise pas combien d'objets électroniques un seul hit peut
tester simultanément lorsqu'une cible en porte plusieurs — voir §6.

### 4.6 Blindage IEM

Équipement optionnel d'un ordinateur : donne un bonus au Test de panne égal à son niveau,
uniquement en cas d'attaque IEM (aucun effet sur les autres causes de panne). Coût : (niveau ×
niveau) × 200 sols.

### 4.7 Survie I.E.M.

Dispositif distinct du Blindage IEM, qui équipe surtout les robots, androïdes et armures
mécanisées (rare sur les drones). Il n'intervient qu'**après un échec** au Test de panne contre
une IEM : un second jet d'1 dé est effectué — résultat pair, la panne est finalement évitée ;
résultat impair, toutes les actions de l'appareil subissent un malus cumulatif de −1, porté à −2
si **le Test de panne du défenseur lui-même (§4.5) a été un échec critique** (pas une réussite
critique de l'attaquant — deux jets distincts). **Chaque activation du dispositif réduit son
niveau de Survie I.E.M. de 1** — c'est une ressource qui s'épuise avec l'usage, pas un bonus
permanent.

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
d'armures mécanisées en portent un « principal » et un « secours ») n'en a jamais deux actifs
simultanément. Le secours reste inactif tant que le principal fonctionne ; il ne prend le relais
que lorsque le principal tombe hors d'usage (Intégrité courante à 0 ou moins).

### 4.10 Compétences

Trois compétences RAW couvrent l'informatique : **Informatique** (utiliser un ordinateur
normalement, avec un accès autorisé — prérequis Éducation culture générale 10), **Génie
technique**, spécialité **Logiciels** (concevoir des programmes — prérequis Informatique 10), et
**Piratage informatique** (s'introduire dans un système sans y être autorisé — prérequis
Informatique 10, ne peut pas dépasser le niveau de la compétence Informatique). Ce document ne
mécanise que l'usage normal (Informatique) ; le Piratage informatique n'entre en jeu qu'en couche 3.

---

## 5. Règles optionnelles

Néant — aucune règle de ce chapitre RAW n'est marquée « optionnelle » dans le Livre de Base.

---

## 6. Questions ouvertes et ambiguïtés

- **Portée d'un hit IEM.** La RAW dit qu'une attaque IEM soumet « les appareils électroniques »
  d'une cible à un Test de panne, sans préciser combien d'objets sont concernés simultanément
  lorsque la cible en porte plusieurs. Hypothèse de travail proposée (à confirmer) : tester
  l'objet le plus pertinent au contexte plutôt que tout l'inventaire électronique d'un coup, pour
  éviter une avalanche de jets sur un seul hit. Non bloquant pour le reste du document, ⚠️ à
  trancher avant l'implémentation du déclencheur.
- **Critère de hiérarchisation en cas de dépassement de Gestion systèmes.** Le RAW précise que les
  systèmes « les moins importants » se déconnectent automatiquement en cas de dépassement, sans
  fournir de barème d'importance. ⚠️ Bloquant pour mécaniser cette règle telle quelle — nécessite
  soit une convention (ordre de priorité déclaré), soit un arbitrage MJ systématique.
- **« Contrôle armement » (RAW de base) face au catalogue existant.** Le programme RAW « Contrôle
  armement » (un programme par arme, niveau = niveau d'attaque) ne semble pas nommé ainsi dans le
  catalogue déjà constitué pour les plateformes drone/exo — probablement déjà couvert par un
  équivalent au rôle similaire, à vérifier avant de conclure à une entrée RAW manquante.
- **Propriétaire du complément « Survie I.E.M. » et de l'auto-désactivation Gestion systèmes**
  entre ce chantier et les sous-systèmes Exo-armures/Drones (§3.2) — question d'organisation du
  travail, pas une ambiguïté RAW, à trancher en Phase 4/Passage au PLAN.
- **Cas générique** (un personnage propriétaire d'un ordinateur personnel qui y installe des
  programmes, §4.9) : aucun besoin de jeu identifié à ce jour justifiant de le couvrir en V1 —
  proposé hors périmètre (§7), à confirmer plutôt que décidé unilatéralement.

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

- Critère de hiérarchisation des systèmes pour l'auto-désactivation de Gestion systèmes (§6) —
  absent du RAW, nécessite une convention ou un arbitrage MJ avant de mécaniser cette règle.
- Portée d'un hit IEM non bornée par le RAW (§6) — une hypothèse de travail est proposée, à valider
  avant de coder le déclencheur.
- Propriétaire (ce chantier vs Exo-armures/Drones) pour la Survie I.E.M. et l'auto-désactivation
  Gestion systèmes (§3.2/§6) — question d'organisation, à trancher avant d'écrire une migration.

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

### 8.5 Ordre de priorité suggéré

1. Contenu catalogue à faible risque : marquer les objets sensibles aux IEM, ajouter les
   programmes du Guide Technique manquants, corriger l'écart RAW de la munition IEM existante.
2. Le déclencheur de Test de panne par IEM lui-même (§4.5) — le seul vrai morceau de mécanique
   neuve.
3. Blindage IEM — le lire dans le calcul une fois le déclencheur posé.
4. Survie I.E.M. (§4.7) — dépend de la question de propriétaire (§8.1).
5. Auto-désactivation de Gestion systèmes (§4.1) — dépend du critère de hiérarchisation (§8.1).
