# PLAN_INFORMATIQUE.md — Plan technique : ordinateurs, programmes, pannes électroniques

> Créé 2026-09-09, réécrit intégralement 2026-09-11 (`METHODO_PLAN.md` — conformité au livrable
> type et au marquage [VÉRIFIÉ]/[INFÉRÉ], après constat que la version précédente était restée un
> stub narratif malgré une matière technique abondante mal rangée dans le MANUEL).
> **Analyse à charge du PLAN, 2026-09-11** : quatre corrections après vérification directe — le
> chiffre « 8/8 tests » de `computerStats.js` (repris sans être rejoué) était faux, 16/16 en
> relançant réellement la suite ; `runCombatWeaponPanne` (lu ligne à ligne) teste l'arme de
> l'attaquant sur un tir raté, forme inverse du besoin IEM (matériel du défenseur sur un coup
> réussi) — le Lot 2 doit écrire une fonction sœur, pas réutiliser celle-ci ; une citation « MANUEL
> note ce cas comme rare » ne correspondait plus au MANUEL réécrit ; une contradiction Lot 1/Lot 2
> sur qui touche `damageService.js` a été précisée (§4, Lot 1/Lot 2).
>
> **Mise à jour 2026-09-15 — tous les points bloquants du MANUEL §8.1 tranchés avec Saar, plan
> complet, exécution toujours non commencée (rien appliqué en base).** Quatre décisions arbitrées :
> ciblage d'un hit IEM par catégorie de porteur (§4 Lot 2), architecture du moteur de Test de panne
> partagé entre `char_inventory` et `exo_computers` (§4 Lot 2, Repository pattern — recherche externe
> faite, cf. sources), colonne `malfunction_severity` sur `exo_computers` (§4 Lot 2 — déjà tranché par
> le MANUEL lui-même, « même mécanique que tout Test de panne », pas un vrai choix), et le critère de
> hiérarchisation Gestion systèmes (§4 Lot 4 — premier branché/premier débranché, réordonnable par le
> joueur). Deux fichiers de migration écrits et vérifiés pendant l'analyse (344, 345) mais **non
> appliqués** — Saar a explicitement gelé toute exécution tant que l'intégralité du plan (4 lots)
> n'était pas close ; c'est désormais le cas. Une trouvaille de schéma non anticipée par la version
> précédente de ce document : `exo_systems` n'a aucun lien vers un `exo_computers` précis (§4 Lot 4).
> Décision RAW assumée (ciblage générique hors exo-armure) journalisée dans `docs/JOURNAL8.md`
> (session 2026-09-15).
>
> **Mise à jour 2026-09-15 (suite) — revue du plan après audit RAW complet du MANUEL (« on veut être
> sûr »).** Le MANUEL a corrigé sa description de la Survie I.E.M. (§4.7 : séquence complète en 4
> étapes — immobilisation, tentatives de redémarrage répétées, séquelle, usure — au lieu de la seule
> dernière étape) ; ce plan répercute cette correction dans le Lot 3, seul lot impacté. Trois
> trouvailles supplémentaires en cherchant le bon point d'ancrage technique (aucune n'a nécessité de
> nouvelle abstraction — patrons déjà existants dans le moteur de combat, jamais un second moteur) :
> (1) `runPanneTest` doit aussi renvoyer la marge du Test (`mr`), pas seulement l'issue simple/
> critique — champ ajouté au Lot 2 (§4), consommé par le Lot 3 pour la durée d'immobilisation ;
> (2) le mécanisme
> d'immobilisation + tentative de redémarrage répétée par Tour se construit sur `token_statuses` et
> le tick de début de Résolution déjà utilisé pour les dangers environnementaux
> (`resolveEnvironmentalHazardTicks`) — **pas** sur `combat_timeline_entries.resolve_on_turn`
> (mécanisme déjà utilisé pour le report d'Initiative/les grenades différées, mais câblé sur une
> action déclarée par un joueur, ce que la Survie I.E.M. n'a pas) ; un piège trouvé au passage :
> `token_statuses.expires_at_turn` est balayé sans condition par la purge de fin de Tour
> (`combatTurnEngine.js#endTurn`), donc impropre à porter le Tour de premier redémarrage éligible —
> cette donnée doit vivre dans `data` (JSON), jamais dans `expires_at_turn` ; (3) le malus cumulatif
> de séquelle (§4.7 étape 3) a un point d'accroche déjà existant et conçu pour cet usage exact —
> `server/src/lib/activeMalusRegistry.js` (`ACTIVE_MALUS_SOURCES`), mais son fil d'alimentation
> (`combatantContextService.js`) ne connaît aujourd'hui que le pilote (blessure/fatigue/encombrement),
> jamais l'exo-armure qu'il pilote — un nouveau paramètre doit être ajouté et propagé, sans changer le
> comportement des appelants existants. Lot 3 réécrit en conséquence, découpé en 3a (déjà fait :
> ressource `survie_iem_max/current`, migrations 344/345 inchangées) et 3b (nouveau : la machine à
> états). Aucun changement sur les Lots 1/2/4 hors l'ajout ponctuel (1) ci-dessus.
>
> **Analyse critique du Lot 3b, 2026-09-15 (même jour, sur demande explicite)** : citation de ligne
> corrigée (`integrityService.js:104-114`, pas `:118`) ; **bug de signe évité avant qu'il ne soit
> codé** — `mr` est négatif sur l'échec qui déclenche la Survie I.E.M., `rebootEligibleTurn` doit se
> calculer en `currentTurn - mr`, jamais `+ mr` ; garde manquante ajoutée (ne poser le statut que si
> `exo_computers.survie_iem_current` n'est pas `NULL`, dispositif optionnel) ; risque d'écrasement
> silencieux ajouté (deux échecs IEM successifs sur la même plateforme avant la fin du premier
> incident, même classe de bug que celle déjà corrigée pour les dangers environnementaux via
> `Math.max`) ; réutilisation explicite de `statusService.applyModStatus`/`clearModStatus` au lieu
> d'un accès direct à `token_statuses` ; ambiguïté RAW non résolue sur le Tour exact du premier
> redémarrage signalée en [À TRANCHER] plutôt que tranchée seule ; **gap fonctionnel signalé** —
> cette architecture ne bloque aucune action pendant l'immobilisation elle-même, cohérent avec le
> [INCONNU] déjà posé par le MANUEL §6 sur le cas d'un pilote humain, pas un oubli technique.
>
> **Mise à jour 2026-09-15 (suite, le jour même) — le gap fonctionnel ci-dessus et le [INCONNU] du
> MANUEL §6 sont tranchés par Saar.** Exo-armure portée : pilote entièrement gelé pendant
> l'immobilisation (seule option : sortir de l'armure, narratif, sans mécanique) — le Lot 3b gagne
> une garde de blocage de déclaration sur le token de l'exo, même famille que
> `isTestBlockingWound`. Drone téléopéré : l'opérateur n'est jamais gelé (jamais fusionné à la
> machine) — aucun travail supplémentaire dans ce lot, la Survie I.E.M. reste hors périmètre côté
> drone (§4 Lot 3, [À TRANCHER]) indépendamment de cette décision. Décisions journalisées
> `docs/JOURNAL8.md` (session 2026-09-15, entrée « Survie I.E.M. et pilote humain »).
>
> **Responsabilité unique** : architecture technique (fichiers, schéma, séquencement, tests). Ce
> document ne contient **aucune règle métier** — celles-ci sont entièrement dans
> `docs/MANUELS/MANUEL_INFORMATIQUE.md`. Toute question « pourquoi ce malus / ce seuil / cette
> formule » se répond dans le MANUEL, jamais ici (Règle 9/10, `docs/RegleDocumentaire.md`).
>
> Sources : `docs/MANUELS/MANUEL_INFORMATIQUE.md` (règles), `docs/PLANS/PLAN_EXOARMURE.md` §13.4
> (Lot C, architecture existante réutilisée), `shared/computerStats.js` (+ suite de tests relancée),
> `server/src/routes/character/char-sheet.js`, `server/src/socket/socketCombatHelpers.js`
> (`runCombatWeaponPanne`), `server/src/services/integrityService.js` (`runPanneTest`, lu en entier
> 2026-09-15), `shared/weaponAmmoDsl.js`, `server/src/lib/damageService.js`,
> `server/src/db/migrations/{42,43,45,65,69,139,140,166,236,237,303}*`, `docs/REGLES/REGLEARMURE.md`
> (« Attaque IEM », citée mot à mot), `client/package.json` (`@dnd-kit`, déjà utilisé dans
> `InventoryPanel.jsx`/`ContainerPanel.jsx`/`WeaponPanel.jsx`), requêtes directes sur `enclumeBD`
> (2026-09-11, 2026-09-15), recherche externe 2026-09-15 (Repository pattern vs. Rule Elements
> PF2e/Foundry — cf. §4 Lot 2 pour les sources). Pour la revue du 2026-09-15 (suite) : `shared/
> polarisTestResolution.js` (`resolveTestOutcome`, `mr` signé), `server/src/socket/
> combatTurnEngine.js` (lu en entier — `resolve_on_turn`, `endTurn`/purge universelle),
> `server/src/lib/environmentalHazardService.js` + `shared/environmentalHazardRegistry.js` (patron
> tick par Tour), `server/src/services/weaponModService.js` (`onTurnStart`, patron état par ligne),
> `server/src/lib/activeMalusRegistry.js` et `server/src/lib/combatantContextService.js` (lus en
> entier — chaîne pilote/exo du malus de Test). Pour l'analyse critique du même jour :
> `server/src/lib/statusService.js` (lu en entier — `applyModStatus`/`clearModStatus`), migrations
> `server/src/db/migrations/{83,180,266}_token_statuses*` (schéma exact de `token_statuses`),
> `shared/integrityRules.js` (`applyTemporaryLoss`, plancher à 0 vérifié).
>
> Statut : couches 1-2 seulement (couches 3-5 n'ont pas encore de MANUEL, donc pas de PLAN).
> **Plan complet, tous les points bloquants tranchés. Exécution non commencée — aucun code appliqué.**

---

## 1. Objectif

Combler l'écart entre les règles posées dans `MANUEL_INFORMATIQUE.md` et l'état réel du code.
**L'essentiel de l'infrastructure existe déjà** (§2) — ce plan ne construit pas un chantier depuis
zéro, il documente précisément ce qui manque (§3) et séquence son implémentation (§4).

---

## 2. État de l'existant — [VÉRIFIÉ] par lecture de code et requête directe (2026-09-11)

### 2.1 Sous-système Exo-armures (Lot C, `PLAN_EXOARMURE.md` §13.4, codé et clos le 2026-08-21)

- **`exo_computers`** (migrations 42/139/236) : `character_id`, `role` (CHECK `principal`/`secours`),
  `gen`/`nt` (smallint NOT NULL), `blindage_iem` (integer nullable), `integrite_max`/
  `integrite_current`, `sort_order`.
- **`ref_exo_template_computers`** : même forme côté catalogue de modèles, utilisée par
  `applyExoTemplate` pour pré-remplir `exo_computers` à la sélection d'un modèle.
- **`exo_programs`** (migrations 43/140/237) : `character_id`, `equipment_id` (FK `ref_equipment`,
  catalogue `family='Logiciels'`), `label_override`, `category`, `level` (CHECK 0-30),
  `sort_order`, `exo_computer_id`.
- **`shared/computerStats.js`** : `computeOrdinateurStats({gen, nt})` (les 4 formules RAW du
  MANUEL §4.1), `computeBlindageIemCost(niv)`, `resolveOrdinateurIntegrityFormula(gen)` (MANUEL
  §4.2), `resolveActiveComputer(computers)` (bascule principal/secours, MANUEL §4.9 dernier
  paragraphe). **[VÉRIFIÉ] — corrigé (analyse à charge) : `node --test shared/computerStats.test.mjs`
  relancé directement le 2026-09-11, 16/16 verts**, pas 8/8 comme l'affirmait la citation reprise
  telle quelle de `PLAN_EXOARMURE.md` sans être rejouée (la suite a grandi depuis cette citation).
- **Contrainte de capacité déjà appliquée en écriture**, pas seulement calculée :
  `server/src/routes/character/char-sheet.js:2760-2764` (création d'un `exo_programs`) et
  `:2822-2829` (modification) lèvent une `AppError(400)` si le niveau dépasse le Niveau maximum de
  l'ordinateur porteur, ou si la somme dépasse son Potentiel — couvre exactement MANUEL §4.9 points
  1-2.
- Côté **drone**, contrainte de Potentiel équivalente et indépendante :
  `char-sheet.js:1877-1883`, calculée directement depuis `drone_sheet.ordinateur_gen`/
  `ordinateur_nt` (colonnes scalaires — pas de table `drone_computers`, cohérent avec un seul
  ordinateur par drone).

### 2.2 Catalogue de programmes (couche 2)

`ref_equipment` porte **34 lignes `family='Logiciels'`** (requête directe, 2026-09-11), couvrant la
quasi-totalité du RAW de base (Sécurité, Ami/ennemi, Analyse senseurs/sonars/radars, Topographique,
Détection, Données, Gestion d'appareils, Cryptage, Décryptage, Communication, Brise-code, Viral
autonome, Espion, Anti-espion, Rempart, Offensif, Contre-attaque — avec leurs `price_modifier` RAW
exacts, ex. `"1200 × cumul"`, `"1000 × niv²"`) et des programmes drone/exo hors RAW de base
(Contact, Balistique, Bombardement, Esquive, Pilotage, Dissimulation, Interception, Chirurgie,
Analyse médicale, Premiers soins, Multi-langages, Mécanique-électronique-informatique, Extraction,
Science botanique/agriculture).

### 2.3 Occupation réelle en base (requête directe, 2026-09-11)

| Table | Lignes | Note |
|---|---|---|
| `exo_computers` | 4 | 2 personnages réels, cohérent avec un principal + un secours chacun |
| `exo_systems` | 54 | — |
| `exo_weapons` | 10 | — |
| `ref_exo_template_computers` | 21 | proche des ~20 attendus pour 16 modèles RAW dont 4 à deux ordinateurs (écart de 1, [À VÉRIFIER] non bloquant) |
| `exo_programs` | **0** | **la contrainte de capacité est câblée et testée, mais aucun programme n'a jamais été installé en usage réel** — flux existant, non éprouvé en jeu |
| `ref_equipment` (`category='Ordinateur'`) | 6 | toutes ont `generation: NULL`, `tech_level: 1` uniforme — aucune ne peut recevoir d'ITG par la formule du MANUEL §4.2 tant que sa génération n'est pas renseignée |

### 2.4 Point d'intégration IEM — vérifié absent, et le candidat évident ne convient pas

`shared/weaponAmmoDsl.js#AMMO_MECHANIC_ACTIONS`/`resolveAmmoMechanic` traite déjà le tag `FX=IEM`
comme non reconnu (retourne `null`, comportement inchangé). **Ce registre n'est cependant pas le
bon point d'accroche** : il n'est consommé que par `server/src/lib/damageService.js`
(`:102`, `:160`, `:419-421`), un module de calcul de dégâts pur (facteur d'armure, Choc fixe,
dropoff par portée) — aucun effet de bord n'y transite jamais. Câbler l'IEM à cet endroit
produirait au mieux un modificateur de dégâts inerte, jamais un second Test de panne.

Le patron à suivre est celui déjà utilisé par la « porte de panne » du chantier Usure en combat.
**[VÉRIFIÉ] — lu directement (analyse à charge, 2026-09-11)** : `runCombatWeaponPanne`
(`server/src/socket/socketCombatHelpers.js:874`, appelée aux lignes 1241 et 2751, une fois par
pipeline melee/assaut) est bien un effet de bord post-résolution — jet + `DICE_RESULT` + message
`COMBAT_SYSTEM_NOTICE` (`combat:integrityPanne.*`), autour de la primitive `runPanneTest` (services
du chantier Usure).

**Mais la fonction elle-même n'est pas directement réutilisable telle quelle, seulement son
patron** : `runCombatWeaponPanne` teste l'**arme de l'attaquant**, déclenchée quand **son propre**
jet d'attaque a **échoué** (`!outcome.isSuccess`, ITG de l'arme entre 1 et 5) — c'est la « porte de
panne » historique de l'Usure (arme qui s'enraye sur un tir raté). Le déclencheur IEM a la forme
inverse : il doit tester le matériel du **défenseur**, quand l'attaque **a touché** — deux
conditions de déclenchement opposées, une cible différente (inventaire/`exo_computers` du
défenseur, pas l'arme de l'attaquant). **Conséquence pour le Lot 2** : écrire une fonction sœur sur
le même patron (jet + `DICE_RESULT` + notice), pas appeler `runCombatWeaponPanne` — à nommer et
positionner au moment de l'implémentation, probablement juste après confirmation d'un coup porté
plutôt qu'après un coup manqué.

**[VÉRIFIÉ] 2026-09-15 — `runPanneTest` lue en entier (`server/src/services/integrityService.js:92`),
pas seulement son en-tête.** Sur les 4 étapes de la fonction (verrouiller/lire la ligne, lancer le
jet, interpréter le résultat, écrire la perte), 2 sont déjà 100 % génériques (`resolvePolarisTest`,
`interpretPanneOutcome` — ne prennent qu'un seuil, aucune dépendance de table) et 2 sont câblées en
dur sur `char_inventory` (`lockInventoryRow` et l'écriture dans `applyPanneLoss`). Écrire une
« fonction sœur » complète pour `exo_computers` (comme envisagé ci-dessus au premier passage)
dupliquerait ces 2 étapes déjà écrites une fois pour `char_inventory` — exactement le « second
moteur » qu'interdit `AGENTS.md` (invariant 2) dès qu'on reconnaît qu'une deuxième table a besoin du
même mécanisme. **Décision arbitrée avec Saar (2026-09-15), architecture pour le Lot 2** : extraire
les 2 étapes spécifiques à la table dans un petit adaptateur interchangeable (patron Repository —
confirmé par recherche externe, cf. sources ci-dessous), et garder le jet + l'interprétation + le
calcul de perte strictement communs aux deux tables. `runPanneTest` prend l'adaptateur en paramètre
au lieu d'avoir `char_inventory` écrit en dur ; les deux appelants existants
(`socketCombatHelpers.js:1022`/`:1244`) passent explicitement l'adaptateur `char_inventory`, sans
changement de comportement. Un deuxième adaptateur `exo_computers` sert le nouveau déclencheur IEM.
**Écarté** : le patron « chemins de données abstraits » des Rule Elements PF2e/Foundry
(`@actor.system.attributes...`, cf. [Quickstart guide PF2e](https://github.com/foundryvtt/pf2e/wiki/Quickstart-guide-for-rule-elements))
— disproportionné ici : ce patron résout un problème différent (règles écrites en JSON par des
créateurs de contenu, sur un nombre arbitraire de propriétés), alors que ce chantier a un besoin
borné et connu à l'avance (2 tables, peut-être 3 avec `drone_sheet`). Sources recherche externe :
[The Repository Pattern](https://medium.com/@muyiwa-dev/the-repository-pattern-ff87cde360ce),
[Understanding the Repository Pattern in Node.js](https://alberthernandez.dev/blog/understanding-the-repository-pattern-in-node-js).

**[VÉRIFIÉ] Gap de schéma trouvé en marge de cette lecture** : `exo_computers` n'a **aucune colonne
`malfunction_severity`**, contrairement à `char_inventory`. `MANUEL_INFORMATIQUE.md` §4.5 dit
explicitement que l'IEM soumet la cible « à un Test de panne (**même mécanique que tout Test de
panne**, MANUEL_USURE.md §4) » — si c'est la même mécanique, l'état de panne qui en fait partie
(simple/critique, persistant jusqu'à réparation) en fait partie aussi. **Ce n'est pas un choix
d'architecture à trancher, c'est déjà répondu par le MANUEL** : `malfunction_severity` doit être
ajoutée à `exo_computers` (migration additive, même forme que `char_inventory`), dans le Lot 2 (pas
le Lot 1/3, qui ne touchent pas au déclencheur combat).

### 2.5 Écart RAW confirmé sur le seed existant — [VÉRIFIÉ] corrigé et affiné 2026-09-15

Requête directe sur `enclumeBD` (2026-09-15, pas seulement relecture du PLAN) : **17 lignes**
`ref_equipment` portent une munition IEM, pas une seule comme la citation d'origine le laissait
entendre. 16 portent `DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-1/2D10_ARME)` — le mécanisme « moitié
moins de dégâts » est déjà correct, c'est le DSL existant (`shared/weaponAmmoDsl.js`,
`DMG_ACTIONS.MUL`), aucune primitive neuve nécessaire (le "À TRANCHER" de la version précédente de
ce document sur ce point est refermé). Seul le malus est faux : **−1** au lieu de **−3** (RAW vérifié
mot à mot, `docs/REGLES/REGLESMUNITIONS.md` p.26-29 : « imposant un Test de panne avec un malus de
-3 »). **1 ligne structurellement cassée, non documentée avant cette session** : « Carreau -
Projectile IEM » = `DMG=BASE;TXT=PEN=BASE`, sans `DMG=MUL` ni `FX=IEM` du tout. « Champ IEM
anti-torpille (champ sphère) » (`ammo_effects` NULL) n'est volontairement pas touché : dispositif
défensif, mécanique distincte (Blindage électronique, MANUEL §4.5), hors périmètre.

Migration écrite et vérifiée (`node --check` OK) : `server/src/db/migrations/344_fix_ammo_effects_iem.js`
— corrige les 16 malus et réaligne la ligne Carreau sur le patron des autres. **Non appliquée.**

**Corrigée une deuxième fois (analyse à charge Lot 2, 2026-09-15)** : le tag `FX=IEM(TEST_PANNE:-1/2D10_ARME)`
n'a pas la grammaire des 6 autres mécaniques FX (valeurs simples, sans paramètres). Simplifié en
`FX=IEM` — le malus RAW (-3) vivra comme une constante unique dans le futur module Lot 2, jamais
dupliqué dans 17 lignes de catalogue ni parsé par regex à l'exécution. Voir §4 Lot 2.

### 2.6 Gap confirmé — Gestion systèmes, aucune auto-désactivation codée

Recherche exhaustive (`grep` sur `server/`, 2026-09-11) : « gestionSystemes »/« Gestion systèmes »
n'apparaît que dans le texte descriptif d'un programme catalogue (`303_ref_equipment_seed.js`,
recopie du RAW) — **aucune occurrence dans un chemin d'exécution**. La formule existe
(`computeOrdinateurStats.gestionSystemes`) mais rien ne la compare au nombre de systèmes
réellement rattachés à un ordinateur, et aucune désactivation automatique n'existe. Distinct de la
contrainte Potentiel/Niveau max (§2.1), qui elle est confirmée codée.

---

## 3. Écart à combler — le périmètre technique réel restant

Neuf éléments, aucun autre, vérifiés par lecture directe (3 de plus que la version d'origine de ce
document, trouvés en creusant l'architecture des Lots 2/3/4 le 2026-09-15) :

1. Propriété catalogue `is_electronic` (n'existe pas) + curation des objets qui la portent.
2. Déclencheur de Test de panne sur attaque IEM (§2.4) — le seul vrai morceau de mécanique neuve du
   Lot 2.
3. Correction du seed Balles IEM (§2.5) — **fait, migration 344 écrite, non appliquée**.
4. Colonne de ressource Survie I.E.M. sur `exo_computers` (MANUEL §4.7 étape 4, Lot 3a) — **fait,
   migration 345 écrite, non appliquée**.
5. Colonne `malfunction_severity` manquante sur `exo_computers` (§2.4) — pas dans le périmètre
   original du document, trouvée en lisant `runPanneTest` en entier.
6. Moteur `runPanneTest` câblé en dur sur `char_inventory` (§2.4) — refactor Repository pattern
   nécessaire avant d'écrire le déclencheur IEM, pour ne pas dupliquer le mécanisme.
7. Auto-désactivation de Gestion systèmes (§2.6) — critère de hiérarchisation tranché par Saar
   (premier branché/premier débranché, réordonnable), **mais** `exo_systems` n'a aucun lien vers un
   `exo_computers` précis (trouvé 2026-09-15, absent de la version précédente de ce document) — voir
   §4 Lot 4 pour la résolution retenue.
8. Seed des 7 programmes Guide Technique manquants (MANUEL §4.8).
9. Machine à états Survie I.E.M. (MANUEL §4.7 étapes 1-3, Lot 3b) — **pas encore fait**, trouvée en
   corrigeant la lecture RAW du MANUEL le 2026-09-15 (la version d'origine de ce document ne
   couvrait que l'étape 4/usure, prise à tort pour toute la règle) : immobilisation, tentatives de
   redémarrage répétées par Tour, séquelle conditionnelle — architecture au §4 Lot 3b.

---

## 4. Architecture cible, par lot

### Lot 1 — Contenu catalogue (risque faible, aucune dépendance)

- **Correctif seed Balles IEM — fait** (§2.5) : `server/src/db/migrations/344_fix_ammo_effects_iem.js`
  écrite et vérifiée (`node --check` OK), **non appliquée**. Le "À TRANCHER" sur le mécanisme de
  dégâts réduits de moitié est refermé — `DMG=MUL(0.5)` du DSL existant suffisait déjà, aucune
  primitive neuve.
- **Application des migrations 344/345 — méthode précisée (analyse à charge 2026-09-15)** : pas
  d'appel manuel `up()` + insertion manuelle dans `knex_migrations` (fragile, aucune garantie
  transactionnelle automatique) — appeler `db.migrate.latest()` sur l'instance déjà configurée
  (`server/src/db/knex.js`, qui embarque `NaturalMigrationSource` précisément pour trier 344/345
  après 343 sans le piège lexical `9_`/`98_`/`100_`). Jamais la CLI `npx knex` brute
  (`.claude/rules/migrations.md`).
- **Migration restante de ce lot** : `ref_equipment.is_electronic boolean not null default false` —
  additive pure, patron identique à `has_integrity` (`MANUEL_USURE.md`/migration 329). Numéro de
  migration à vérifier au moment de l'écriture (`ls server/src/db/migrations/` +
  `knex_migrations` — 345 est la dernière écrite à ce jour, mais revérifier en base avant d'écrire
  la suivante, jamais supposé, `.claude/rules/migrations.md`).
- **Critère de curation `is_electronic` — tranché (analyse à charge 2026-09-15, recherche externe
  faite)**. Recherche menée : dans les compendiums pro (PF2e/Foundry), un trait d'objet n'est jamais
  déduit à l'exécution par heuristique — il est saisi une fois, à la main, par qui construit le
  catalogue, directement depuis le texte RAW de l'objet (aucune classification automatique en
  amont). Confirme la bonne méthode : **automatiser uniquement les familles/catégories sans
  ambiguïté possible, réviser à la main le reste** (comme migration 329 pour `has_integrity` :
  backfill par clé métier + garde qui `throw` si le catalogue a bougé, jamais un mot-clé deviné).
  Répartition vérifiée par requête directe (2026-09-15) :
  - **Automatisable** (`true` sans relecture individuelle) : `Equipement Général/Équipement
    électronique` (14), `Equipement Général/Communication` (8), `Équipement informatique et
    logiciels/Ordinateur` (6), `Exo-systeme/Systèmes électroniques et informatiques` (26).
  - **Révision manuelle ligne par ligne** (~60 lignes, catégories mixtes vérifiées par échantillon) :
    `Armes/Accessoires pour armes` (25 — mélange confirmé : lunettes/viseurs laser/calculateurs
    électroniques à côté de silencieux/trépieds non électroniques), `Equipement Général/Sécurité`
    (21 — mélange confirmé : serrures électroniques/détecteurs à côté de menottes/faux documents non
    électroniques), `Armes/Arme à énergie` + `Exo-arme/Arme à énergie` (14).
  - **Reste `false` par défaut** : tout le reste, y compris `family='Logiciels'` et
    `Équipement informatique et logiciels/Programmes` — un programme est un logiciel installé sur un
    ordinateur, pas un objet physique distinct exposé à l'IEM (MANUEL §2.3, « tout objet »).
- **Seed** : les 7 programmes Guide Technique (MANUEL §4.8) ajoutés à `ref_equipment`
  (`family='Logiciels'`), même forme que les 34 lignes existantes. Stats exactes (coût/niveau/
  description) pas encore lues dans `docs/REGLES/ORDINATEUR_GUIDETECH.md` — à faire avant d'écrire
  ce seed.
- **Trouvaille hors périmètre, signalée et non corrigée** (analyse à charge 2026-09-15) : 19 lignes
  `family='Équipement informatique et logiciels'/category='Programmes'` reprennent quasiment les
  mêmes noms que les 34 lignes `family='Logiciels'` déjà utilisées par `exo_programs` (« Programme
  ami/ennemi » vs « Ami/ennemi »). Vérifié par requête directe : **aucune** de ces 19 lignes n'est
  référencée par `char_inventory` ni `exo_programs` — catalogue legacy mort, jamais nettoyé après la
  construction de la famille `Logiciels`. Sans lien avec ce chantier, non touché ici — à ticketer
  séparément (`bug_tickets`) pour ne pas le perdre.
- **Tests** : `node --check` sur les migrations, script de vérification du nombre de lignes
  `family='Logiciels'` (41 attendu après seed : 34 + 7), non-régression du round-trip migration
  (`.claude/rules/migrations.md`).

### Lot 2 — Déclencheur de Test de panne par IEM

**Ciblage d'un hit IEM — arbitré avec Saar 2026-09-15, RAW revérifiée mot à mot avant validation**
(`docs/REGLES/REGLEARMURE.md`, `docs/REGLES/REGLEPOLARIS.md`) :

- **Ordinateur seul — simplifié (analyse à charge 2026-09-15)** : pas une branche de code séparée.
  Une fois `is_electronic` posé (Lot 1), c'est le cas particulier N=1 du tirage équipondéré
  générique décrit plus bas — un ensemble d'un seul objet électronique se tire toujours lui-même.
  RAW cohérente (le pouvoir Force Polaris « Attaque IEM » parle toujours d'« un appareil
  électronique » au singulier) sans avoir besoin d'un `if` dédié. Un seul chemin de code pour ce cas
  et le cas générique, deux seulement au total avec l'exo-armure (RAW à part, ci-dessous).
- **Exo-armure** : reprendre le tableau RAW **exact**, pas une liste plate de tout l'équipement à
  égalité — citation `REGLEARMURE.md`, incident Avarie IEM : « Chaque attaque touche habituellement
  l'un des éléments suivants (plusieurs parfois), déterminé au hasard : Exosquelette, Générateur,
  Systèmes auxiliaires (dans ce cas, 1D6+3 systèmes sont touchés), Armement (sauf les équipements ne
  comportant pas de composants électroniques). » Tirage entre ces **4 catégories**, pas entre les
  objets individuellement ; la catégorie Systèmes auxiliaires touche plusieurs objets d'un coup si
  elle sort ; la catégorie Armement n'en touche jamais qu'un seul (« un seul et unique système
  d'attaque ou de défense », même fichier, section Armement). Le détail fin de cet incident RAW reste
  le territoire d'Exo-armures (MANUEL §7) — ce chantier ne fait que router vers le Test de panne une
  fois la cible tirée.
- **Personnage porteur de plusieurs objets électroniques séparés hors exo-armure** (accessoire
  d'arme inclus) : **aucune RAW ne couvre ce cas** — cherché spécifiquement le mot « accessoire »
  dans toutes les règles (armure, munitions, drones, compétences), aucune trace. **Décision maison
  assumée** (Saar, 2026-09-15) : tirage au hasard équipondéré parmi les objets `is_electronic=true`
  réellement portés — cohérent avec le principe « au hasard » que la RAW applique systématiquement
  dans ce genre de cas, mais ce n'est pas une règle RAW retrouvée. **Journalisé `docs/JOURNAL8.md`**
  (session 2026-09-15), comme l'exige `AGENTS.md` invariant 5 (jamais un écart RAW silencieux).
- **Primitive d'énumération** (cas générique) : filtrer `char_inventory` (jointure `ref_equipment`)
  par `is_electronic = true`, même garde `container !== 'Coffre'` que le calcul de poids porté
  (`gmArbitratedTestService.js`).

**Architecture du moteur — arbitrée 2026-09-15 (§2.4, recherche externe faite)** :

- `runPanneTest` (`server/src/services/integrityService.js:92`) est refactorée en Repository
  pattern : l'interprétation (`interpretPanneOutcome`) et le calcul de perte
  (`applyTemporaryLoss`, dans `shared/integrityRules.js`) restent strictement communs et inchangés.
  Seules les 2 étapes spécifiques à une table (verrouiller/lire la ligne, écrire le résultat) sont
  extraites dans un petit adaptateur passé en paramètre. Un adaptateur `char_inventory`
  (comportement actuel, inchangé, les deux appelants existants
  `socketCombatHelpers.js:1022`/`char-sheet.js:1244` continuent de fonctionner à l'identique) et un
  adaptateur `exo_computers` (nouveau, pour ce lot) — jamais une fonction sœur qui recopie le
  verrouillage/l'écriture (second moteur interdit, `AGENTS.md` invariant 2).
- **[VÉRIFIÉ] Deuxième changement nécessaire dans `runPanneTest`, pas seulement l'adaptateur de
  stockage (analyse à charge 2026-09-15)** : `resolvePolarisTest(threshold, criticalSuccessBonus)`
  (`polarisTestService.js:18`) ne prend qu'un seuil brut — `runPanneTest` l'appelle aujourd'hui avec
  `row.integrity_current` tel quel, sans aucun moyen d'ajouter un modificateur. Le Test de panne IEM
  a besoin d'un modificateur net (malus RAW −3, contré par le Blindage IEM de la cible) — sans lui,
  le jet serait toujours non modifié, faux par rapport au RAW. `runPanneTest` doit donc gagner un
  paramètre `modifier` optionnel (défaut 0, aucun changement pour les deux appelants existants),
  appliqué comme `resolvePolarisTest(row.integrity_current + modifier)`. Le malus −3 lui-même est
  une constante RAW fixe (jamais variable par calibre) : elle vit dans le futur module du
  déclencheur IEM (pas encore écrit), jamais dans `shared/weaponAmmoDsl.js` (qui ne fait que
  signaler `FX=IEM`, cf. §2.5) ni dans le catalogue.
- **[VÉRIFIÉ] Troisième changement nécessaire dans `runPanneTest` — trouvé en préparant le Lot 3
  (analyse à charge 2026-09-15, citation corrigée lors de l'analyse critique du même jour :
  l'objet `common` va de `integrityService.js:104` à `:114`, pas `:118`)** : l'objet `common`
  retourné aujourd'hui porte `roll`, `threshold`, `isCriticalFail`, mais jamais `mr` — la marge
  signée que `resolveTestOutcome` calcule pourtant déjà (`shared/polarisTestResolution.js:77`,
  `mr = isSuccess ? roll : seuil - roll`). MANUEL §4.7 étape 1 fixe la durée d'immobilisation de la
  Survie I.E.M. à « sa marge d'échec au Test de panne d'origine » — sans `mr` dans le retour de
  `runPanneTest`, le Lot 3 n'a aucun moyen de connaître cette durée. Ajouter `mr: outcome.mr` à
  `common`, aucun changement pour les appelants existants (un champ de plus dans un objet qu'ils ne
  déstructurent que partiellement).
  **[À NE PAS RATER, trouvé à l'analyse critique] `mr` est NÉGATIF sur un échec** (`seuil - roll`
  avec `roll > seuil`) — la marge d'échec RAW (un nombre de Tours, positif) est donc `-mr` (ou
  `Math.abs(mr)`), jamais `mr` tel quel. Le Lot 3b (ci-dessous) calcule
  `rebootEligibleTurn = currentTurn - mr` : un appel naïf en `currentTurn + mr` retrancherait des
  Tours au lieu d'en ajouter — bug de signe à éviter explicitement à l'écriture, pas une évidence
  du nom du champ.
- **Migration additive requise dans ce lot** : `malfunction_severity` sur `exo_computers` (absente
  aujourd'hui, cf. §2.4/§3 point 5) — même forme que `char_inventory`, nécessaire pour que
  l'adaptateur `exo_computers` puisse écrire un résultat de panne complet, pas seulement une perte
  d'ITG.
- **Condition de déclenchement** : lire `parsed.tags.FX === 'IEM'` (résultat de
  `parseAmmoEffects(row.ammo_effects)`, §2.5) directement dans le nouveau site d'appel — **jamais**
  via `resolveAmmoMechanic` (registre de `damageService.js`, frontière déjà actée). **[À VÉRIFIER,
  pas encore fait]** : le site d'appel (résolution d'un tir, `socketCombatHelpers.js` ~ligne 3137)
  a-t-il déjà sous la main la munition réellement tirée (`ammo_effects`), ou faut-il une requête
  supplémentaire — pas encore lu à ce jour.
- **Site d'appel** : nouvelle fonction, patron de `runCombatWeaponPanne` mais branchée sur
  `runPanneTest` refactorée (avec son nouveau paramètre `modifier`) + l'adaptateur `exo_computers`,
  appelée au moment où un coup est confirmé porté sur le défenseur ET où la condition ci-dessus est
  vraie — à positionner précisément dans `socketCombatHelpers.js` au moment de l'implémentation
  (près des deux sites d'appel existants de `runCombatWeaponPanne`, lignes 1241/2751, sans en
  modifier le comportement). **Reste à vérifier avant de coder** : comment le personnage/
  l'inventaire de la **cible** (pas l'attaquant, déjà résolu à cet endroit du fichier) se résout
  depuis `targetTokenId` à ce point précis du pipeline — non lu à ce jour, [À VÉRIFIER] en ouvrant
  `socketCombatHelpers.js` au moment de l'implémentation.
- **Événement WS** : réutiliser le patron déjà en place pour la panne d'Usure (`DICE_RESULT` +
  `COMBAT_SYSTEM_NOTICE` côté combat, `INVENTORY_UPDATED` côté `char_inventory` — §2.4) ; équivalent
  côté `exo_computers` — pas d'événement `EXO_UPDATED`/équivalent confirmé à ce jour, [À VÉRIFIER].
- **Aucune modification de `shared/integrityRules.js`** : le déclenchement IEM est un nouvel
  appelant de `interpretPanneOutcome`/`runPanneTest` (refactorée), pas une nouvelle branche de calcul.
- **Frontière avec `damageService.js`/`weaponAmmoDsl.js` — précisée (analyse à charge)** : le Lot 1
  peut y toucher pour la réduction de dégâts des Balles IEM (moitié dégâts, un calcul de dégâts pur
  — sa place légitime). Le Lot 2 n'y touche **pas** : le déclenchement du Test de panne lui-même
  est un effet de bord de combat, jamais une entrée `AMMO_MECHANIC_ACTIONS`. Les deux lots peuvent
  toucher les mêmes munitions IEM, chacun sa moitié du problème, sans se chevaucher.
- **Tests** : scénario Balles IEM sur cible avec objet `is_electronic`, avec/sans Blindage IEM ;
  scénario exo-armure (tirage 4 catégories, bloc Systèmes auxiliaires) ; scénario personnage
  générique multi-objets (tirage équipondéré) ; non-régression des deux appelants existants de
  `runPanneTest` après refactor (mêmes résultats qu'avant, adaptateur `char_inventory` transparent) ;
  non-régression du pipeline de dégâts existant côté Lot 2 (cette fonction ne modifie aucun calcul
  de dégâts, seulement `damageService.js` du Lot 1 le fait, pour la réduction de moitié).

### Lot 3 — Blindage IEM (lecture) + Survie I.E.M.

- **Blindage IEM côté exo** : lire `exo_computers.blindage_iem` (colonne déjà présente) dans le
  calcul du Lot 2 — aucune migration.
- **Blindage IEM côté drone** : `drone_sheet` n'a pas de colonne équivalente ([VÉRIFIÉ],
  `38_drone_sheet.js` ne porte que `ordinateur_gen`/`ordinateur_nt`) — migration additive à
  prévoir si le cas drone est couvert en V1 ([À TRANCHER]).
- **Blindage IEM côté ordinateur générique** (`ref_equipment`) : aucune colonne — [À TRANCHER au
  Lot 3] si ce cas doit être couvert en V1. **Citation corrigée (analyse à charge)** : la version
  précédente de ce document attribuait au MANUEL la mention « cas rare » pour ce point précis — le
  MANUEL réécrit (§4.6) ne la fait plus ; le mot « rare » n'y qualifie que la Survie I.E.M. sur les
  drones (§4.7), pas le Blindage IEM générique. Question ouverte sans jugement de fréquence associé.

**Survie I.E.M. — reséquencée en 3a/3b après correction du MANUEL (§4.7, 2026-09-15) : la RAW décrit
une séquence complète de 4 étapes (immobilisation → tentatives de redémarrage répétées → séquelle →
usure), pas un simple calcul ponctuel. 3a couvre la ressource (déjà fait), 3b la machine à états
(nouveau, découpage MANUEL §8.4 anticipé).**

#### 3a — Ressource Survie I.E.M. (fait, inchangé par la correction MANUEL)

**Propriétaire tranché 2026-09-15** : nouvelle colonne sur `exo_computers` (cohérent avec
`blindage_iem`, même table, même granularité par ordinateur). La question de propriétaire (MANUEL
§3.2/§8.1) se résout par le précédent déjà posé par Exo-armures lui-même : `blindage_iem` vit sur
`exo_computers` depuis la création de la table (migration 42), jamais propagé au template
`ref_exo_template_computers` ni à `applyExoTemplate` (`server/src/lib/exoTemplateService.js:130-148`,
vérifié — un ordinateur généré depuis un modèle reçoit gen/nt/intégrité, jamais `blindage_iem`,
laissé `null`, réglable ensuite à la main via `PUT /:characterId/exo/computers/:computerId`). Survie
I.E.M. suit exactement le même chemin : colonnes nullables sur `exo_computers`, absentes du
template, réglables à la main. Le chantier Informatique ajoute la donnée, Exo-armures reste
propriétaire du schéma de la table — aucun des deux ne duplique l'autre. **Migration écrite et
vérifiée** (`node --check` OK) : `server/src/db/migrations/345_exo_computers_survie_iem.js`
(`survie_iem_max`/`survie_iem_current`, nullables, pas de CHECK current≤max — cohérence avec
`integrite_max`/`integrite_current` sur la même table, qui n'en a pas non plus).
`server/src/routes/character/char-sheet.js` (routes POST/PUT `/:characterId/exo/computers`) déjà
édité en miroir de `blindage_iem`. **Non appliquée.** Cette ressource représente l'étape 4 RAW
(usure) — sa valeur baisse d'1 à chaque redémarrage réussi (3b), rien de plus ; elle ne porte aucun
état de combat en cours, c'est pour ça qu'elle survit déjà telle quelle à la correction du MANUEL.

#### 3b — Machine à états (immobilisation, tentatives de redémarrage, séquelle) — nouveau

**Pourquoi pas les deux mécanismes différés déjà existants du moteur de combat** — les deux ont été
lus en entier avant de conclure (jamais un patron copié sans vérifier qu'il correspond) :
- `combat_timeline_entries.resolve_on_turn` (`combatTurnEngine.js`, déjà utilisé pour le report
  d'Initiative ≤ 0 et l'explosion différée des grenades, `resolution_snapshot.autoResolve`) —
  **écarté** : chaque entrée de cette échelle est rattachée à un `combat_action_id`, c'est-à-dire à
  une action **déclarée par un joueur** (le lanceur de la grenade, l'attaquant reporté). La Survie
  I.E.M. n'a aucune action à rattacher : elle doit tourner automatiquement, tour après tour,
  indépendamment de toute déclaration.
- `token_statuses.expires_at_turn` seul (déjà utilisé pour Acide/Décompression/Feu, stun) —
  **écarté tel quel** : ce champ est balayé sans condition par la purge universelle de fin de Tour
  (`combatTurnEngine.js#endTurn`, bloc « Purge universelle », `expires_at_turn <= newTurn` → ligne
  supprimée). Ce comportement convient à un effet qui *s'arrête* à échéance — pas à la Survie
  I.E.M., dont l'échéance ne fait que *déclencher* la première tentative de redémarrage, qui peut
  ensuite se répéter pendant plusieurs Tours de plus. Stocker le Tour de premier redémarrage
  éligible dans `expires_at_turn` ferait supprimer la ligne avant la première tentative.

**Patron retenu** : `token_statuses` reste la bonne table (générique, `data` JSONB déjà prévu pour
un état arbitraire par ligne, sans CHECK qui en limiterait la forme — vérifié sur les 3 migrations
de la table, 83/180/266 —, déjà interrogée une fois par Tour), mais le Tour de redémarrage éligible
vit dans `data`, jamais dans `expires_at_turn` (laissé `NULL`) — la ligne n'est donc jamais touchée
par la purge universelle, elle ne disparaît que lorsque le mécanisme ci-dessous la supprime
explicitement après un redémarrage réussi (**conséquence positive trouvée à l'analyse critique** :
ce choix évite aussi le « +1 » de compensation que `environmentalHazardService.js#turnsFromNow`
doit ajouter pour les dangers qui utilisent, eux, `expires_at_turn` — sans lien avec la purge, rien
à compenser ici). Un nouveau statut (`status_code` à choisir au moment de l'implémentation, ex.
`iem_survival` — à ajouter à `docs/VOCABULARY.md`, MANUEL §8.3), posé **via `statusService.applyModStatus`
(réutilisé tel quel, pas un `INSERT` direct — même fonction que `exposeToHazard`)** par le
déclencheur du Lot 2 quand son Test de panne échoue, avec
`data: { exoComputerId, rebootEligibleTurn, wasCritical }` :
- **Garde préalable, trouvée à l'analyse critique, absente de la version précédente de ce
  paragraphe** : ne poser ce statut que si la cible est un `exo_computers` **dont
  `survie_iem_current` n'est pas `NULL`** (dispositif optionnel, MANUEL §2.1 — un `char_inventory`
  ordinaire ou un `exo_computers` sans Survie I.E.M. installée n'a rien de plus à faire ici que le
  Test de panne déjà traité par le Lot 2).
- `exoComputerId` — quel `exo_computers` est concerné (une plateforme peut porter un principal et
  un secours ; seul l'actif au sens `resolveActiveComputer` peut être touché, mais autant fixer la
  cible sans ambiguïté dès la pose du statut plutôt que de la re-déduire à chaque tick).
- `rebootEligibleTurn` — `currentTurn - mr` (**pas `currentTurn + mr`, cf. correction de signe au
  Lot 2 ci-dessus** — `mr` du nouveau champ de `runPanneTest` est négatif sur l'échec qui déclenche
  ce statut).
- `wasCritical` — `outcome.isCriticalFail` du Test de panne d'origine (Lot 2), pour la branche −2
  de l'étape 3.
- **Second coup IEM avant la fin d'un incident en cours — trouvé à l'analyse critique, non traité
  par la version précédente de ce paragraphe** : `token_statuses` a une contrainte `UNIQUE(token_id,
  status_code)` (migration 180) et `applyModStatus` écrit en `.onConflict().merge()` — un second
  échec de Test de panne IEM sur la même plateforme avant la fin du premier incident **écraserait
  silencieusement** `rebootEligibleTurn`/`wasCritical` en cours, exactement la classe de bug que
  `exposeToHazard` évite déjà pour les dangers environnementaux (`Math.max(existing, candidate)`
  avant d'appeler `applyModStatus`, cf. son commentaire "decision G"). Le déclencheur du Lot 2 doit
  faire de même ici : ne jamais RACCOURCIR un `rebootEligibleTurn` déjà posé, et cumuler
  `wasCritical` en OR plutôt que de l'écraser.

**Nouvelle fonction de tick**, appelée depuis `startResolutionPhase` (`combatTurnEngine.js`) à côté
des deux boucles déjà là (mods `onTurnStart`, dangers environnementaux) — **pas un nouveau
registre** : contrairement aux dangers environnementaux (3 codes distincts, Acide/Décompression/Feu,
qui partagent une forme mais pas les mêmes paramètres, d'où `shared/environmentalHazardRegistry.js`),
la Survie I.E.M. n'a qu'un seul statut et une seule règle — un registre à une entrée serait une
abstraction sans second consommateur, contraire à la sobriété du projet. Une fonction dédiée
(nom à définir, ex. `resolveIemSurvivalTicks`, aux côtés de `resolveEnvironmentalHazardTicks` par
analogie de rôle, pas de code partagé) suffit :
1. Sélectionne les lignes `token_statuses` de statut `iem_survival` dont
   `data.rebootEligibleTurn <= currentTurn` (jointure `combat_roster` comme pour les dangers
   environnementaux, même bloc `startResolutionPhase` — requête sur un champ JSON, donc un cast
   explicite `(data->>'rebootEligibleTurn')::int`, pas une comparaison directe).
2. Pour chacune, tente `resolvePolarisTest(survie_iem_current)` (MANUEL §4.7 étape 2 : « même
   principe qu'un Test de panne », aucun modificateur).
3. Échec → rien : la ligne reste inchangée, `rebootEligibleTurn` reste ≤ `currentTurn`, donc elle
   sera retentée automatiquement au Tour suivant sans logique supplémentaire (pas de compteur de
   tentatives à gérer explicitement — la condition de sélection ci-dessus s'en charge seule).
4. Réussite → jet de séquelle (MANUEL §4.7 étape 3 : 1 dé, pair = rien, impair = malus −1, −2 si
   `wasCritical`) ; décrément de `exo_computers.survie_iem_current` de 1 (étape 4, usure — jamais en
   dessous de 0, au même titre que les autres compteurs de ressource du projet) ; suppression de la
   ligne `token_statuses` via **`statusService.clearModStatus`** (réutilisé, pas un `DELETE` direct
   — même discipline que la pose, ci-dessus).
5. Le malus de séquelle, s'il y a lieu, doit persister au-delà de ce seul Tour (RAW : « toutes les
   actions de l'appareil » — pas un modificateur ponctuel sur le jet de redémarrage lui-même) —
   voir point d'accroche du malus ci-dessous, distinct du mécanisme de tick.

**[À TRANCHER, trouvé à l'analyse critique — ambiguïté RAW non résolue par ce document]** : le Tour
exact du premier redémarrage n'est pas évident au mot près. « Reste immobile pendant un nombre de
Tours égal à sa marge d'échec, [puis] une fois ce délai écoulé, retente à chaque Tour » admet deux
lectures pour une panne survenue au Tour `T0` avec une marge de 3 : première tentative au Tour
`T0+3` (immobile pendant les Tours `T0+1`/`T0+2`, la tentative elle-même ouvrant le 3ᵉ), ou au Tour
`T0+4` (3 Tours pleinement immobiles, tentative seulement une fois les 3 entièrement écoulés). Le
même type d'ambiguïté existe déjà ailleurs dans le projet et a été tranché au cas par cas avec un
« +1 » explicite et commenté (`environmentalHazardService.js#turnsFromNow`) — pas une évidence
transposable automatiquement ici (les deux mécanismes ont une purge de fin de Tour différente, cf.
ci-dessus). `rebootEligibleTurn = currentTurn - mr` (première lecture, ci-dessus) est la valeur par
défaut retenue dans ce document faute de trancher seul une question de RAW, mais reste à confirmer
(ou corriger d'un Tour) au moment d'écrire ce lot — non bloquant pour le reste de l'architecture.

**Blocage d'action pendant l'immobilisation — tranché (Saar, 2026-09-15, cf. `docs/JOURNAL8.md`),
referme le [MANQUANT] de l'analyse critique et le [INCONNU] du MANUEL §6** : une exo-armure porte
son propre token (`MANUEL_EXOARMURE.md` §3.1) — pendant que ce token a une ligne `token_statuses`
`iem_survival` active (posée à l'échec du Test de panne, supprimée au redémarrage réussi, §
ci-dessus), **aucune déclaration d'action de combat sur ce token ne doit être acceptée**, quel que
soit le joueur qui la tente (le pilote, jamais quelqu'un d'autre — `isExoActorAuthorized` reste la
garde d'autorisation, celle-ci est une garde d'**état**, orthogonale). Point d'intégration : même
famille que `isTestBlockingWound`/`isMortalWoundImmobilized` (`shared/woundConstants.js`,
consommées par `socketCombatAnnouncement.js` pour refuser une déclaration) — une garde
`isImmobilizedByIemSurvival`-style à écrire sur le même patron (lecture `token_statuses` du token
concerné), à ajouter au même site de refus de déclaration, jamais un second chemin de blocage.
Aucune mécanique de sortie d'armure à câbler : décision Saar, geste purement narratif, sans action
de jeu associée.

**Drone téléopéré — même décision, aucun travail supplémentaire dans ce lot** : l'opérateur d'un
drone n'est jamais fusionné à la machine (centre de commande distant, `REGLEDRONE.md`) — son propre
token/personnage n'est jamais concerné par le blocage ci-dessus, qui ne s'applique qu'au token de la
plateforme immobilisée. Cohérent avec le fait que la Survie I.E.M. reste de toute façon hors
périmètre côté drone tant que le Blindage IEM drone ne l'est pas (§4 Lot 3, [À TRANCHER]) — cette
décision lève seulement l'ambiguïté qui aurait pu bloquer une extension future, elle ne déclenche
aucun code ici.

**Point d'accroche du malus de séquelle — trouvé, nécessite un fil d'alimentation nouveau mais
additif** : `server/src/lib/activeMalusRegistry.js` (`ACTIVE_MALUS_SOURCES`) est déjà le registre
générique conçu pour exactement ce cas (commentaire en tête du fichier : « Chaque lot futur ajoute
une entrée [...] — jamais besoin de retoucher `calcActiveMalus` ni les sites consommateurs »),
aujourd'hui alimenté par 3 sources qui portent toutes sur le PILOTE (blessure, encombrement,
fatigue). **Vérifié en lisant `combatantContextService.js` en entier** : pour un combattant de type
`exo` (`resolveExoTestContext`), `effectiveMalus` est calculé par `resolveHumanoidTestContext(db,
pilot, ...)` — c'est-à-dire avec le contexte du **pilote**, jamais celui de l'exo-armure qu'il
pilote. Ajouter une 4ᵉ source (`key: 'iemSurvival'`) au registre ne suffit donc pas seul : il faut
aussi que `resolveExoTestContext` sache lire l'état `iem_survival` en cours de la plateforme et
l'injecte dans le `ctx` passé à `calcActiveMalus` — un nouveau paramètre à faire descendre dans
`resolveHumanoidTestContext` (même discipline que `forNAOverride`, déjà un paramètre optionnel
additif sans effet sur les appelants qui ne le fournissent pas). **Complication non résolue à ce
stade, à trancher au moment d'écrire ce lot** : lire une ligne `token_statuses` suppose de connaître
le `token_id` de la plateforme, or `resolveCombatantTestContext`/`resolveHumanoidTestContext`/
`resolveExoTestContext` ne reçoivent aujourd'hui que `character`/`skillId`/`opts` — aucun `tokenId`.
Les sites d'appel réels (résolution CaC/Tir) connaissent déjà le tokenId à cet instant : il s'agit de
le faire transiter en plus, pas de le récupérer d'ailleurs — mais c'est un changement de signature
d'une fonction partagée par 6+ sites d'appel (cf. commentaire de `combatantContextService.js`), donc
à vérifier avec la même rigueur que le reste de ce fichier avant d'y toucher.
**Frontière confirmée, ne pas élargir sans nécessité** : les drones n'appellent jamais
`resolveCombatantTestContext` (`drone_programs.level` sert directement de Seuil, commentaire du
fichier) — si le Blindage/la Survie I.E.M. côté drone est un jour tranché « in scope » (§ ci-dessus,
[À TRANCHER]), le malus de séquelle drone n'emprunterait de toute façon pas ce chemin et devra être
câblé séparément, pas anticipé ici sans besoin réel.

**Tests** : fonction de tick testée unitairement (sélection par `rebootEligibleTurn`, jet
pair/impair, décrément de `survie_iem_current`, suppression de la ligne sur succès, non-sélection
tant que `rebootEligibleTurn > currentTurn`) ; non-régression de `calcActiveMalus`/
`activeMalusRegistry.test.mjs` après l'ajout de la 4ᵉ source (les 3 sources existantes inchangées à
`iemSurvival` absent du `ctx`) ; scénario d'intégration Test de panne IEM échoué (Lot 2) → pose du
statut avec la bonne `rebootEligibleTurn` (`mr` du Lot 2) → tentatives échouées plusieurs Tours de
suite → redémarrage réussi → malus appliqué au Test suivant du pilote de l'exo concernée ; scénario
de blocage — une déclaration d'action tentée sur le token de l'exo pendant que `iem_survival` est
active doit être refusée, acceptée de nouveau dès la ligne supprimée ; non-régression de
`isTestBlockingWound`/`socketCombatAnnouncement.js` (la nouvelle garde s'ajoute, ne remplace rien) ;
second échec IEM sur la même plateforme avant la fin d'un incident en cours (§ ci-dessus) ne doit
jamais raccourcir `rebootEligibleTurn` ni perdre un `wasCritical` déjà vrai.

### Lot 4 — Auto-désactivation Gestion systèmes

**Critère de hiérarchisation tranché (Saar, 2026-09-15)** : premier branché, premier débranché par
défaut ; le joueur peut réordonner la liste à la main (drag&drop) pour changer cet ordre.

**Gap de schéma trouvé en creusant l'implémentation (2026-09-15), absent de la version précédente de
ce document** : `exo_systems` (migration 45) n'a **aucune colonne `exo_computer_id`** —
contrairement à `exo_programs`, qui a bien un rattachement explicite à un ordinateur précis. Rien
dans le schéma actuel ne dit quel ordinateur pilote quel système.

**Résolution retenue (option A, pas de migration de rattachement)** — [VÉRIFIÉ] : ce chantier n'a
pas la main pour ajouter cette relation. `MANUEL_INFORMATIQUE.md` §3.2, texte exact : « la
matérialisation de cette relation (comment une plateforme porte concrètement son ordinateur) relève
des sous-systèmes Exo-armures et Drones, **pas de ce document** ». Exo-armures a déjà posé sa
réponse : `resolveActiveComputer` (`shared/computerStats.js`) établit qu'un seul ordinateur est actif
à la fois par plateforme (le secours ne prend le relais que si le principal est hors d'usage). La
capacité de Gestion systèmes de **l'ordinateur actif** s'applique donc à l'ensemble des `exo_systems`
du personnage — pas de nouvelle colonne, pas de nouvelle FK sur une table qui n'appartient pas à ce
chantier. Effet de bord RAW-cohérent et volontaire : un basculement principal→secours avec une
Génération plus faible peut d'un coup dépasser la nouvelle capacité et déclencher des déconnexions —
c'est le comportement attendu, pas un bug.

**Réordonnancement (drag&drop) — pas un nouveau choix technique** : `@dnd-kit/core` et
`@dnd-kit/utilities` sont déjà des dépendances du client (`client/package.json`), déjà utilisées pour
réordonner des listes dans `InventoryPanel.jsx`, `ContainerPanel.jsx` et `WeaponPanel.jsx`. `sort_order`
existe déjà sur `exo_systems` (migration 45) et `exo_programs`. Réutiliser ce patron pour la liste des
systèmes d'une exo-armure — aucune nouvelle librairie, aucun nouveau concept d'interface à inventer.
L'ordre par défaut (« premier branché ») se lit simplement dans l'ordre d'insertion / `sort_order`
initial ; le drag&drop du joueur réécrit `sort_order` via la route PUT existante (patron déjà
éprouvé sur les 3 fichiers ci-dessus).

- **Tests** : fonction pure de sélection des systèmes à déconnecter (capacité de l'ordinateur actif
  vs somme des systèmes attachés, tri par `sort_order`) ; scénario bascule principal→secours qui
  dépasse la capacité ; non-régression du drag&drop existant sur les 3 composants qui utilisent déjà
  `@dnd-kit` (aucune modification de leur code, seulement réutilisation du patron sur un nouveau
  composant).

---

## 5. Risques et dépendances de coordination

- **Propriété de `shared/computerStats.js`** — écrit par le chantier Exo-armures, référencé comme
  autorité par ce chantier (MANUEL §4.1/§4.2/§4.9). La décision Lot 3a (§4) ne le modifie pas : les
  colonnes Survie I.E.M. suivent le patron `blindage_iem` (donnée sur `exo_computers`, pas de
  formule dans `computerStats.js`).
- **Fil d'alimentation du malus de séquelle (Lot 3b, §4)** — `combatantContextService.js` et
  `activeMalusRegistry.js` sont des fichiers transverses (7+ sites d'appel du premier, listés dans
  son propre en-tête), pas propres au chantier Informatique ni à Exo-armures. Toute modification de
  signature (nouveau paramètre pour porter l'état `iem_survival` de la plateforme jusqu'au calcul du
  malus) doit rester strictement additive et être vérifiée contre l'ensemble des appelants existants
  avant d'être écrite — non-régression explicitement listée dans les tests du Lot 3b.
- **`exo_computers`** — toute migration dessus (Lot 3) doit être vérifiée contre l'état réel de la
  table en base au moment de l'écriture, pas seulement contre les migrations telles que lues dans
  ce document (le Lot C source a lui-même été corrigé plusieurs fois en cours de route d'après
  `PLAN_EXOARMURE.md` — aucune raison que ce chantier-ci y échappe). **Fait pour les migrations 344/
  345** (requête directe 2026-09-15 avant écriture) — à refaire si le temps passe avant application.
- **Ne pas toucher sans nécessité avérée** : `exo_programs`, `ref_exo_template_computers`, la
  contrainte de capacité déjà en place dans `char-sheet.js` — tout ça est construit et testé,
  référence pour ce chantier, pas cible de modification.
- **`exo_systems` (Lot 4)** — même principe : pas de nouvelle colonne/FK sur cette table (propriété
  Exo-armures, MANUEL §3.2). La résolution retenue (§4 Lot 4, option A) s'appuie sur
  `resolveActiveComputer` tel qu'il existe aujourd'hui — si ce chantier fait évoluer sa logique de
  bascule principal/secours entre-temps, revérifier avant d'implémenter le Lot 4.

---

## 6. Hors-scope

Reprend intégralement `MANUEL_INFORMATIQUE.md` §7, plus les précisions techniques suivantes :
- Couches 3-5 : aucun PLAN tant que leur MANUEL respectif n'existe pas.
- Cas générique d'un ordinateur personnel avec programmes installés : aucune table équivalente à
  `exo_programs`/`drone_programs` n'existe pour ce cas et ne sera pas créée en V1.
- Toute modification du pipeline `damageService.js`/`weaponAmmoDsl.js` au-delà de la correction de
  seed (§4, Lot 1) — le déclencheur IEM ne doit pas y transiter (§2.4).
