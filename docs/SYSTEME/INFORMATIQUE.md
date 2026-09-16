# SYSTEME/INFORMATIQUE.md — Architecture ordinateurs, pannes électroniques, IEM (couches 1-2)

> Créé 2026-09-16, clôture du chantier `PLANS/PLAN_INFORMATIQUE.md` (Lots 1-4, couches 1-2). Règle
> documentaire 10 (`docs/RegleDocumentaire.md`) : un PLAN terminé est archivé, sa documentation
> définitive est intégrée au SYSTEM concerné — ce document est cette intégration. Le raisonnement,
> les corrections et l'historique des décisions restent dans `docs/Old/PLAN_INFORMATIQUE.md`
> (archivé, pas supprimé) ; ce document garde l'état construit.
> Règles RAW et intention de conception (capacités, formules, séquences) : `docs/MANUELS/
> MANUEL_INFORMATIQUE.md` — **ne pas dupliquer ici**, seulement référencer. Vocabulaire :
> `docs/VOCABULARY.md`.
> **Périmètre couvert** : couches 1 (capacités d'ordinateur, pannes/IEM) et 2 (catalogue de
> programmes) seulement. Couches 3-5 (piratage/duels, conception de programmes, virus) n'ont pas
> encore de MANUEL, donc pas de PLAN, donc pas d'état construit à documenter ici.

---

## Vue d'ensemble

Un ordinateur est soit une ligne dédiée `exo_computers` (exo-armures — une plateforme peut en
porter 1 ou 2, `principal`/`secours`), soit des colonnes scalaires `drone_sheet.ordinateur_gen/nt`
(un seul ordinateur par drone), soit un objet catalogue générique (`ref_equipment.category=
'Ordinateur'`, hors plateforme). Les 3 formes partagent les mêmes formules pures
(`shared/computerStats.js`) mais jamais le même schéma — pas de table unifiée, chaque plateforme
reste propriétaire de son schéma (Exo-armures pour `exo_computers`/`exo_systems`/`exo_weapons`/
`exo_sheet`, Drones pour `drone_sheet`).

La mécanique neuve construite par ce chantier est le **déclencheur de Test de panne** (générique et
IEM) et la **machine à états Survie I.E.M.** — le reste (schéma ordinateur, catalogue de
programmes, contrainte de capacité Potentiel/Niveau max) était déjà construit par le chantier
Exo-armures avant que ce chantier existe.

---

## 1. Schéma

### 1.1 Ordinateur (Exo-armures)

- **`exo_computers`** — `character_id`, `role` (CHECK `principal`/`secours`), `gen`/`nt`
  (smallint NOT NULL), `blindage_iem` (nullable), `integrite_max`/`integrite_current`,
  `malfunction_severity` (CHECK `simple`/`critical`, nullable), `survie_iem_max`/
  `survie_iem_current` (nullable — MANUEL §4.7 étape 4), `sequelle_malus` (integer NOT NULL
  DEFAULT 0, cumulatif, RAW ne prévoit aucun effacement), `sort_order`.
- **`ref_exo_template_computers`** — même forme côté catalogue de modèles ; `applyExoTemplate`
  copie gen/nt/intégrité vers l'instance, jamais `blindage_iem`/`survie_iem_*`/`sequelle_malus`
  (laissés `null`/`0`, réglables ensuite à la main).
- **`shared/computerStats.js`** (fonctions pures, aucun accès DB) :
  - `computeOrdinateurStats({gen, nt})` — Niveau max programmes, Gestion systèmes, Potentiel, Coût
    (MANUEL §4.1).
  - `computeBlindageIemCost(niv)`, `resolveOrdinateurIntegrityFormula(gen)` (MANUEL §4.2).
  - `resolveActiveComputer(computers)` — le secours ne prend le relais que si le principal est HS
    (`integrite_current ≤ 0`) ; jamais stocké, dérivé à la volée. Autorité unique de la bascule
    principal/secours, consommée par tout le reste de ce document.

### 1.2 Catalogue de programmes (couche 2)

`ref_equipment.family='Logiciels'` — 41 lignes (34 RAW de base + 7 programmes Guide Technique,
migration 347). `exo_programs`/`drone_programs` (`character_id`, `equipment_id`/`label_override`,
`level`, `exo_computer_id` optionnel) rattachent un programme installé à un personnage et, côté exo,
optionnellement à un ordinateur précis (une exo pouvant en porter 2). Contrainte de capacité
(Potentiel/Niveau max) déjà appliquée en écriture, `char-sheet.js` (routes `/exo/programs` et
`/drone/programs`) — refuse un programme qui dépasse la capacité de l'ordinateur porteur.

### 1.3 Objet électronique générique

`ref_equipment.is_electronic` (boolean, migration 346) — 89 lignes, curées manuellement par famille/
catégorie (jamais déduites par heuristique à l'exécution). `has_integrity=true` étendu à tout
`is_electronic=true` (migration 349) : un objet électronique doit être suivi en Intégrité pour être
une cible valide de Test de panne.

### 1.4 État de panne sur les autres plateformes (Lot 2bis)

`malfunction_severity` (même forme que `char_inventory`/`exo_computers`) posée sur :
- `exo_systems` (migration 350), `exo_weapons` (migration 351).
- `exo_sheet.exosquelette_malfunction_severity`/`generator_malfunction_severity` (migration 352,
  sans préfixe `itg_` — état de panne, pas une valeur d'Intégrité).

`exo_systems.integrite_current`/`integrite_max` et `exo_weapons.integrite_current`/`integrite_max`
existaient déjà (migration 45) avant ce chantier, jamais consommées par un mécanisme — le manque
réel n'était pas un schéma absent, seulement un Test de panne jamais branché sur ces colonnes.

---

## 2. Services

### 2.1 `server/src/services/integrityService.js` — `runPanneTest`, patron Repository

Le Test de panne (1D20 sous l'Intégrité courante, RAW `MANUEL_USURE.md`) est **un seul moteur**,
jamais dupliqué par table (`AGENTS.md` invariant 2). `runPanneTest(rowId, {reason, characterId,
modifier, adapter})` factorise le jet + l'interprétation (succès/simple/critique, `mr` retourné) ;
seules la lecture/verrouillage de ligne et l'écriture de la perte sont spécifiques à chaque table,
extraites dans un adaptateur `{lockRow, applyLoss}` interchangeable. 6 adaptateurs exportés :

| Adaptateur | Table | Éligibilité |
|---|---|---|
| `CHAR_INVENTORY_ADAPTER` | `char_inventory` | `has_integrity` / `integrite_current` nullable → skip possible |
| `EXO_COMPUTER_ADAPTER` | `exo_computers` | idem, dispositif optionnel |
| `EXO_SYSTEM_ADAPTER` | `exo_systems` | idem |
| `EXO_WEAPON_ADAPTER` | `exo_weapons` | idem |
| `EXO_EXOSQUELETTE_ADAPTER` | `exo_sheet` (`itg_exosquelette_*`) | toujours éligible — colonnes `NOT NULL`, composant obligatoire de toute exo-armure |
| `EXO_GENERATOR_ADAPTER` | `exo_sheet` (`itg_generator_*`) | idem |

Les 2 derniers adaptateurs portent `id = character_id` (pas de ligne dédiée, une seule ligne
`exo_sheet` par personnage) — pas de branche `eligible:false`, contrairement aux 4 autres.

### 2.2 `server/src/lib/iemSurvivalService.js` — Survie I.E.M.

Séquence RAW complète (MANUEL §4.7) : immobilisation → tentative de redémarrage chaque Tour →
séquelle conditionnelle → usure. Deux fonctions, même patron que
`environmentalHazardService.js` :

- `exposeToIemSurvival(io, db, campaignId, tokenId, {computerId, mr, isCriticalFail})` — pose le
  statut `iem_survival` (`token_statuses`, `expires_at_turn: null` — jamais purgé par la purge
  universelle de fin de Tour, contrairement aux dangers environnementaux). Immobilisation pour un
  nombre de Tours = marge d'échec (`mr`) du Test de panne original. Garde anti-écrasement
  (`Math.max`/OR, même patron que `exposeToHazard`) si un second échec IEM survient avant la fin
  d'un incident en cours.
- `resolveIemSurvivalTicks(io, db, campaignId, currentTurn, rows)` — appelée depuis
  `combatTurnEngine.js#startResolutionPhase` à chaque Tour, pour chaque token portant le statut :
  tentative de redémarrage (1D20 sous `survie_iem_current`, sans modificateur) ; sur succès, jet de
  séquelle (1D6 — die-size non chiffrée par le RAW, décision maison journalisée
  `docs/JOURNAL8.md` — pair = rien, impair = -1 malus, -2 si l'échec original était critique) écrit
  sur `exo_computers.sequelle_malus` (cumulatif, jamais réinitialisé) ; puis usure,
  `survie_iem_current` décrémenté de 1 (plancher 0).

### 2.3 `shared/exoSystemsCapacity.js` — Gestion systèmes (Lot 4)

`selectDisconnectedSystems({gestionSystemes, systems})` — fonction pure. RAW (§4.1) : « Gestion
systèmes » est un **compte** de systèmes qu'un ordinateur peut gérer simultanément (10 + Gén.×NT),
jamais une somme pondérée (contrairement au Potentiel). Trie par `sort_order` croissant (« premier
branché, premier débranché » — décision Saar 2026-09-15, réordonnable à la main), partitionne
`active`/`disconnected` selon la capacité de l'ordinateur **actif** (`resolveActiveComputer`).
Calculé à la volée à chaque lecture, jamais stocké — un basculement principal/secours doit se
refléter immédiatement. `gestionSystemes: null` (aucun ordinateur actif) → tout est déconnecté (RAW :
« un système non géré par ordinateur ne peut être activé que manuellement »).

### 2.4 `server/src/lib/activeMalusRegistry.js` et `combatantContextService.js`

`ACTIVE_MALUS_SOURCES` porte une 4ᵉ source `iemSurvival` (`ctx.iemSurvivalMalus ?? 0`, le malus de
séquelle cumulatif). `combatantContextService.js#resolveExoTestContext` (interne) lit l'ordinateur
actif du pilote et lui passe son `sequelle_malus` — extension strictement additive (nouveau paramètre
optionnel `iemSurvivalMalus`), aucun des 7+ appelants existants de `resolveHumanoidTestContext`
modifié.

---

## 3. Flux combat

### 3.1 Déclenchement (générique PJ/PNJ)

`socketCombatHelpers.js#runIemPanneTrigger` — lit `ammoFx` déjà résolu (`.tags.FX`, jamais une
nouvelle lecture d'`ammo_effects`), déclenché après confirmation d'un coup **touché** (forme inverse
de la « porte de panne » historique de l'Usure, `runCombatWeaponPanne`, qui teste l'arme de
l'attaquant sur un tir **raté**). Cible : le matériel du défenseur, pas l'arme de l'attaquant.
Branché aux sites qui portent déjà `ammoFx` (tir différé PJ-tireur, tir immédiat PNJ-tireur).
`cibleType==='pj'|'pnj'` → tirage équipondéré parmi les objets `is_electronic` hors Coffre du
défenseur (`CHAR_INVENTORY_ADAPTER`).

### 3.2 Déclenchement (exo-armure, Lot 2bis) — `runIemPanneTriggerExo`

RAW (`REGLEARMURE.md:434-441`) : chaque attaque IEM touche une catégorie **déterminée au hasard**
parmi 4, **équipondérées** (1/4 chacune — RAW ne chiffre pas ce cas précis, contrairement à
l'incident générique de Dommages qui a sa propre table 1D10) :

| Catégorie | Adaptateur | Tirage |
|---|---|---|
| Exosquelette | `EXO_EXOSQUELETTE_ADAPTER` | 1 test |
| Générateur | `EXO_GENERATOR_ADAPTER` | 1 test |
| Systèmes auxiliaires | `EXO_SYSTEM_ADAPTER` + `EXO_COMPUTER_ADAPTER` (pool fusionné) | 1D6+3 tirés sans remise |
| Armement | `EXO_WEAPON_ADAPTER` | 1 test, parmi les armes `is_electronic` |

**Pool « Systèmes auxiliaires » fusionné avec l'ordinateur actif** (trouvaille Lot 3b) :
`REGLEARMURE.md` range les « Ordinateurs » sous la même rubrique que les autres systèmes
électroniques embarqués — l'ordinateur est un système comme un autre pour ce tirage. Seul
l'ordinateur **actif** (`resolveActiveComputer`) est candidat, jamais les deux : `token_statuses` a
`UNIQUE(token_id, status_code)`, deux immobilisations indépendantes sur le même token collisionneraient
silencieusement. Un système déjà auto-déconnecté (Lot 4, `selectDisconnectedSystems`) est exclu du
pool avant tirage — décision Saar : « hors service, rien à griller ». Un échec (simple ou critique)
du Test de panne de l'ordinateur, et uniquement lui, déclenche `exposeToIemSurvival` (§2.2).

Branché **avant** (pas à la place de) le routage `exoAvarieService.resolveExoDamage` existant
(incident générique de Dommages, mécanique RAW distincte — §2.4 du PLAN archivé) — une munition IEM
inflige la moitié des dégâts ET impose ce Test de panne.

### 3.3 Blocage pendant l'immobilisation

`socketCombatAnnouncement.js` — garde de blocage totale (même famille que `isTestBlockingWound`,
sans exception contrairement à elle) : si le token déclarant porte le statut `iem_survival`, toute
déclaration est refusée. Décision Saar : exo-armure portée → pilote entièrement gelé (seule sortie :
sortir de l'armure, narratif) ; drone téléopéré → l'opérateur n'est jamais gelé (hors périmètre
codé, [À TRANCHER] si besoin futur).

---

## 4. Routes REST touchées

- `GET/POST/PUT /:characterId/exo/computers[/:computerId]` — `blindage_iem`/`survie_iem_max`/
  `survie_iem_current` (client : `ExoComputerPanel.jsx`).
- `GET /:characterId/exo/systems` — enrichit chaque ligne avec `disconnected` (Lot 4), calculé à la
  volée, jamais stocké (client : `ExoSystemsPanel.jsx`, badge + boutons ↑/↓ de réordonnancement
  écrivant `sort_order` via le PUT existant).
- `POST/PUT /:characterId/exo/programs`, `/drone/programs` — contrainte Potentiel/Niveau max
  (antérieure à ce chantier, référencée, pas modifiée).

---

## 5. Hors périmètre confirmé (ne pas re-découvrir)

- **Couches 3-5** (piratage/duels d'ordinateurs, conception de programmes, virus) — aucun MANUEL
  écrit, donc aucun PLAN, donc rien de construit.
- **Exo-armure/drone tireur ne peut charger aucune munition typée** (IEM ou autre) —
  `exo_weapons.ammo_remaining` est un simple compteur, aucune résolution `ammo_effects`/`ammoFx`
  pour ces plateformes (`finalizeAssaultOutcome`/`socketCombatExo.js`). Gap d'infrastructure
  Exo-armures bien plus large que l'IEM seul, non traité par ce chantier.
- **Blindage IEM côté drone/ordinateur générique** — aucune colonne équivalente à
  `exo_computers.blindage_iem` ; [À TRANCHER] si besoin futur, jamais couvert en V1.
- **19 lignes catalogue `Équipement informatique et logiciels/Programmes`** — legacy mort, jamais
  référencé, ticket `bug_tickets` créé (`423fad76-35fa-4a97-8dd8-8694cb92cc78`), non nettoyé ici.
- **Activation manuelle d'un système déconnecté** (RAW la mentionne, MANUEL §4.1) — aucun
  consommateur combat n'existe pour ce geste ; Lot 4 reste informationnel (affichage + exclusion IEM),
  pas un nouveau geste de jeu.

---

## 6. Tests

`shared/computerStats.test.mjs`, `shared/exoSystemsCapacity.test.mjs` (8/8), `server/src/services/
integrityService.test.mjs` (34/34, 6 adaptateurs), `server/src/lib/iemSurvivalService.test.mjs`
(11/11), `server/src/lib/activeMalusRegistry.test.mjs` (9/9), `server/src/lib/
combatantContextService.test.mjs` (41/41). Non testé automatiquement, comme le reste de
`socketCombatHelpers.js`/`socketCombatAnnouncement.js` : le dispatch socket bout en bout (tirage de
catégorie, pool fusionné, garde de blocage) — validé en jeu réel par Saar, sauf le tirage précis
ordinateur+échec (~1 % par tir), vérifié par relecture de code plutôt qu'observé en direct
(coût d'un test RNG réel disproportionné, accepté par Saar).
