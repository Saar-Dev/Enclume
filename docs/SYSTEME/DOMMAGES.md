# SYSTEME/DOMMAGES.md — Les deux types de dommages Polaris

> Responsabilité unique (Règle 7 `RegleDocumentaire.md`, SYSTEM — "Damage" y est cité en exemple) :
> le modèle des types de dommages et leur autorité de résolution. Ne décrit ni la FSM combat/sockets
> (`SYSTEME/COMBAT.md`), ni les blessures/armures UI (`SYSTEME/BLESSURES.md`), ni le vocabulaire
> détaillé des 3 catégories de Choc (`VOCABULARY.md`, entrée "Dommages de Choc") — référencés, jamais
> dupliqués (Règle 2).

---

## 1. Deux types de dommages, deux autorités, jamais confondus

Polaris distingue deux natures de dommages en combat, structurellement différentes — ne jamais les
traiter comme des variantes l'une de l'autre :

| | Physique | Choc |
|---|---|---|
| Nature | Dégât réel | Dégât "virtuel"/psy — ne blesse jamais physiquement |
| Effet | Crée une blessure (table de sévérité, localisation) | Déclenche un **Test de Choc** (Seuil Étourdissement/Inconscience) |
| Réduit par | Armure (`etq`) **et** RD — Résistance aux Dommages, attribut secondaire (`calcResistanceDommages`, FOR_na+CON_na, table RD_TABLE LdB p.114) | Armure Choc uniquement (`protection_shock`/`prt`) — **jamais** par RD (LdB p.243, litéral) |
| Autorité de calcul | `woundService` + pipeline physique de `damageService.resolveTargetHit` | `statusService.resolveShockTest` |
| Source RAW | LdB p.114 (sévérité), `docs/REGLES/REGLEBLESSURES.md` | LdB p.243 "Dommages étourdissants et assommants", `docs/REGLES/REGLEBLESSURES.md` |

Le point RAW le plus souvent source d'erreur : la Résistance aux Dommages (RD) **ne s'applique
jamais** au Choc, contrairement au réflexe de la traiter comme une résistance générique aux
dégâts. Seule l'armure Choc (`protection_shock`) le réduit, et seulement pour les sources où le
Livre de Base le prévoit (voir §3).

---

## 2. Sources de Choc — renvoi, ne pas dupliquer

3 catégories RAW existent (arme normale + Choc gaté Tête, arme à Choc pur sans gate, munition
spéciale sans gate) — détail complet, inventaire catalogue et décisions de scope :
`docs/VOCABULARY.md` entrée "Dommages de Choc". Câblage des catégories 1/2 (armes/mutation Corne,
`ref_equipment.shock_mechanism`, migration 190) **codé et vérifié par scripts isolés (2026-07-22)** —
`docs/PLAN_CHOC1.md`, détail Testé/Non testé `docs/JOURNALTEMP.md` Étape 11/12. En attente de
confirmation en jeu par Saar avant absorption complète ici et retrait de `PLAN_CHOC1.md` (Règle 10) —
tant que ce test n'est pas fait, ce plan reste la référence pour le détail catégories 1/2, pas encore
dupliqué ici.

---

## 3. Le point d'autorité unique — `resolveShockTest`, deux portes d'entrée

`statusService.resolveShockTest` est **l'unique** fonction qui décide si un personnage est étourdi
ou inconscient. Tout ce qui touche au Choc y converge, par deux chemins RAW distincts et confirmés
— ne pas les confondre, ne pas en construire un troisième :

1. **Via un pool de dégâts de Choc** (catégories 1/2/3, §2) : une formule de dés est lancée, réduite
   ou non par `protection_shock` selon la catégorie, combinée au total de dégât physique du même coup
   pour déterminer une sévérité, qui pilote ensuite le Test. Pipeline déjà construit et testé pour la
   catégorie 3 (`damageService.resolveTargetHit`, section Choc).
2. **Via un déclenchement direct, sans pool de dégâts** : le Test de Choc est appelé directement avec
   un malus, sans jet de dés de Choc ni combinaison avec du physique. Deux cas RAW confirmés :
   - Sonar d'attaque(s) : "Test de résistance au Choc avec un malus de -5" sur toutes les cibles de la
     zone (`docs/REGLES/REGLESYSCOMBAT.md`/catalogue, `shock` = "Spécial").
   - Fatigue à l'état "À bout de force" : toute action fatigante remplace le Test de Fatigue habituel
     par un Test de Résistance au Choc, malus selon le tableau (`docs/REGLES/FATIGUE&DOMMAGES.md`,
     "FATIGUE ET COMBAT").

Les deux portes appellent la même fonction finale — il n'y a jamais deux implémentations du Test de
Choc lui-même, seulement deux façons différentes de décider quand l'appeler et avec quel malus.

---

## 4. Ce que ce système n'est PAS — ne pas fusionner avec Maladies/Poisons/Drogues/Irradiations

`char_mutation_effects_view` place `mod_res_shock` à côté de `mod_res_damage`, `mod_res_poison`,
`mod_res_disease`, `mod_res_drugs`, `mod_res_radiation` — proximité de schéma qui peut suggérer une
famille de mécanismes partagée. **Vérifié faux** (analyse à charge, 2026-07-22, lecture complète de
`docs/REGLES/FATIGUE&DOMMAGES.md`) :

- Maladies, poisons, drogues et irradiations partagent tous **une seule et même mécanique**, décrite
  une fois dans le LdB et déclinée pour chacun : un **niveau qui s'accumule** (jets de dés à
  l'incubation/l'administration, puis évolutions supplémentaires à intervalles réguliers, sur des
  heures/jours/semaines réels), comparé à des seuils fixes (5/10/15/20/25/30) qui déclenchent des
  effets d'état cumulatifs, et qui **ne redescend qu'avec un traitement ou un repos étalé dans le
  temps**. La Résistance correspondante (aux poisons, aux maladies...) réduit les points gagnés à
  *chaque* évolution, pas une seule fois.
- Le Choc est résolu **entièrement dans le cadre d'un seul coup porté** : un jet, une combinaison
  immédiate avec le dégât physique du même coup, un seul Test, un résultat immédiat (échec/étourdi/
  inconscient) — aucune notion de niveau qui persiste ou évolue dans le temps.

Ce sont deux formes de mécaniques RAW incompatibles, pas deux variantes d'un même système. **Décision
d'architecture actée (2026-07-22)** : ne jamais tenter de faire porter le Choc et
Poison/Maladie/Drogue/Irradiation par un mécanisme générique commun — la proximité des colonnes
`mod_res_*` dans `char_mutation_effects_view` est un simple regroupement de données de mutation, pas
un signal d'architecture partagée. Un futur chantier sur Poison/Maladie/Drogue/Irradiation
(`docs/REGLES/FATIGUE&DOMMAGES.md`) sera un système séparé, avec sa propre autorité (une notion de
niveau persistant, absente aujourd'hui du schéma combat).
