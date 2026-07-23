# Manuel Technique de Référence — Système de Combat Polaris V1

> Source de vérité unique (SSOT) — règles LdB + implémentation WS. Fige les comportements, élimine les régressions croisées.
> Dernière mise à jour : 2026-07-19 (dev/Saar) — triage `docs/COMPARATIF.md` (audit 2026-07-17) :
> nomenclature §1/§2 corrigée, pipeline §4 aligné sur le DSL munitions/WorldSnapshot, §6.1 « à
> intégrer » retiré (déjà livré), §6.5 Retarder mis à jour (implémenté Sessions 157-159, remplace
> l'ancienne spec jamais construite), §7.1/§7.7 3 lignes drones passées à ✅, liens REGLEDRONE/PLAN_DRONE
> corrigés.

---

## 1. Modèle de Données (PostgreSQL)

> **Nomenclature vérifiée contre le code réel** (`docs/COMPARATIF.md`, audit 2026-07-17) — les noms
> ci-dessous sont les colonnes réelles, pas les noms de travail d'origine.

### combat_state — 1 ligne par campaign_id active
| Champ | Type | Valeurs |
|---|---|---|
| campaign_id | PK UUID | — |
| current_turn | INT | Nom réel de la colonne (anciennement documenté « round ») |
| phase | TEXT | `'ROSTER'` / `'ANNOUNCEMENT'` / `'RESOLUTION'` (nom réel de la colonne, anciennement documenté « current_phase ») |
| sub_phase | TEXT | Non documenté à l'origine : `'SLOT_ACTIVE'`/`'AWAITING_DEFENSE'`/`'AWAITING_DAMAGE'` (migration 81, consommé par `combatFSM.js`) |
| active_slot_idx | INT | Index slot courant (RESOLUTION) |

### combat_roster — 1 ligne par token inscrit
| Champ | Type | Note |
|---|---|---|
| base_ini | INT | Nom réel de la colonne (anciennement documenté « base_initiative »). Fixée au COMBAT_START via `calcREA`. **« Armure méca : MIN(REA, Manœuvre_armure) » n'a aucune trace dans le code — à traiter comme non implémenté, pas comme un fait.** |
| initiative | INT | Nom réel de la colonne (anciennement documenté « current_initiative »). Variable intra-tour — modifiée par les déclarations d'annonce. |
| state_position | TEXT + CHECK | `'standing'` / `'crouching'` / `'prone'` (pas un ENUM SQL natif) |
| state_weapon | TEXT + CHECK | `'holstered'` / `'ready'` / `'drawn'` (pas un ENUM SQL natif) |
| is_surprised | BOOLEAN | Colonne dédiée (plus dans `state_character`) |
| state_vitesse | ENUM | Porte désormais `is_rushed`/précipité/retardé (migration 58) — plus dans `state_character` |
| state_character | JSONB | Ne contient plus que `init_state_confirmed` — `is_rushed` a migré vers `state_vitesse`, `is_stunned` est tracké par `token_statuses`. **Merge obligatoire — jamais remplacement** (`state_character || ?::jsonb`). |

### combat_actions — actions séquencées pour la RESOLUTION
| Champ | Type | Note |
|---|---|---|
| token_id + campaign_id | FK | Nom réel (anciennement documenté « roster_id ») — **pas de FK directe vers `combat_roster`** |
| action_key | TEXT | Type d'action déclarée |
| sequence | SMALLINT | **1** = Mouvement / **2** = Micro-actions / **3** = Assaut/CaC/Reload, valeurs codées en dur côté serveur. **Aucune contrainte DB** sur l'ordre (1<2<3) — convention purement applicative. Index réels : `idx_actions_token(campaign_id, token_id)`, `idx_actions_key(campaign_id, action_key)` — aucun sur `sequence` |
| weapon_inv_id / target_token_id / fire_mode / bullet_count / aimed_location / modifiers (JSONB) | colonnes typées | Pas de colonne `payload` unique — les données sont réparties dans des colonnes typées + un JSONB `modifiers` distinct pour les mods INI/contexte annexe |

---

## 2. Automate d'État

```
ROSTER ──(COMBAT_START)──> ANNOUNCEMENT ──(tous validés)──> RESOLUTION
  ▲                                                               │
  └──────────────(COMBAT_END / fin file actions)─────────────────┘
```

| Phase | Déclencheur | Actions serveur | Émis réellement |
|---|---|---|---|
| ROSTER | `COMBAT_START` | `calcREA` chaque token, résout surprise | `COMBAT_STARTED` + `COMBAT_SURPRISE_ROLL` (nom réel, event ciblé socket par socket, pas broadcast — anciennement documenté « COMBAT_SURPRISE_PROMPT ») |
| ANNOUNCEMENT | `COMBAT_ACTION_DECLARE` | Insère `combat_actions`, applique mod INI sur `initiative` | `COMBAT_ACTION_DECLARED` |
| ANNOUNCEMENT | Dernier slot validé | Screening SQL complétion, tri final roster | `COMBAT_PHASE_CHANGED` |
| RESOLUTION | Avancement interne (`advanceSlot`, déclenché par les confirmations `COMBAT_ACTION_CONFIRM` etc.) | Consomme `combat_actions` ORDER BY sequence ASC — **aucun event `COMBAT_NEXT_SLOT` n'existe** | `COMBAT_SLOT_ADVANCED` (nom réel, anciennement documenté « COMBAT_SLOT_ACTIVATED ») |
| RESOLUTION | Fin file actions | +`current_turn`, purge `combat_actions`, `endTurn` → ANNOUNCEMENT. **Reset `initiative = base_ini` ABSENT — dette confirmée, voir `BUGIDENTIFIE.md` INI4** | `COMBAT_PHASE_CHANGED` réémis — **aucun event `COMBAT_ROUND_INCREMENTED` n'existe** |

> ⚠️ **Alerte conformité :** `COMBAT_ACTION_DECLARE` doit être bloqué tant que le slot actif (ordre croissant) n'a pas atteint le token du joueur. Déclaration désordonnée = destruction de l'avantage tactique des hautes initiatives. **Vérifié conforme** : le garde existe bien (`socketCombatAnnouncement.js:98-108`, rejet `COMBAT_DECLARE_ERROR` hors tour).

---

## 3. Initiative

**Ordre annonce :** croissant — lents déclarent en premier, rapides s'adaptent.
**Ordre résolution :** décroissant — rapides résolvent en premier.
**Départage :** 1. REA nette > 2. ADA > 3. Simultanat (`Math.random()` V1 — dette connue, acceptable VTT).
**Réalité du code** : le niveau ADA n'est pas implémenté — tri `base_ini DESC || Math.random()-0.5`, aucune comparaison ADA intermédiaire (`socketCombatState.js:92`).

> ⚠️ **Écart V1 :** `initiative ≤ 0` → action reportée tour suivant. Non implémenté — voir `BUGIDENTIFIE.md` INI3.

### Modificateurs current_initiative (appliqués immédiatement à l'annonce)

| Action déclarée | Mod INI | Effet secondaire |
|---|---|---|
| Précipiter | +3 | Malus −5 au jet de compétence final |
| Dégainer | −5 (−3 si main sur arme) | Obligatoire si arme `'holstered'` |
| Déplacement court (≤3m) | −3 | Préparation intégrée (interdit si déplacement long déclaré) |
| Changer mode de tir | −3 | — |
| S'accroupir | −3 | — |
| Se jeter à terre | −5 | — |
| Se relever | −10 | **Divergent** : coût -10 codé, mais l'exception « gratuit si fin de déplacement long » n'est implémentée nulle part (`socketCombatAnnouncement.js` — seul `freeMove` existant concerne `combat_mode` charge/retraite, pas la posture) |

---

## 4. Pipeline Balistique (RESOLUTION — type Assaut distance)

> **Corrigé contre le code réel** (`docs/COMPARATIF.md` §4) — trois écarts structurants avec la version
> d'origine de ce pipeline, au-delà des noms de champs.

```
[1] Vérifications
    LOS : WorldSnapshot (checkCombatLOS → evaluateWorldVisibility, losService.js/worldVisibilityService.js)
          — PAS de raycast Redis. Autorité = moteur monde (CLAUDE.md §8), conforme.
    Distance : palier portée depuis ref_equipment.range (Courte/Moyenne/Longue/Extrême)
    Munitions : ammo_remaining ≥ bullet_count (sauf pnj_unlimited_ammo, réglage de campagne).
          Contrôle en ANNONCE (rejet immédiat) — PAS en RÉSOLUTION (décrément sans second contrôle,
          clampé à 0)

[2] Seuil
    = compétence tir ± portée − malus blessures − carence FOR − précipitation(−5)
      + mods circonstances (§6.1) + Tir visé + Viser localisation + mods d'arme + bouclier adverse
    Cible sans défense (surprise totale) → test simple +5, pas d'opposition
      ⚠️ ABSENT du code réel côté tir à distance — voir BUGIDENTIFIE.md DEF5

[3] Jet D20
    MR = Seuil − jet. Si jet > Seuil → échec → step 5 (munitions)

[4] Localisation & Dommages
    1D20 → table localisation distance → calcResistanceArmure(localisation)
    rawDice = getEffectiveWeaponDamage(...) — DSL munitions (shared/weaponAmmoDsl.js), PAS juste damage_h
    modDomAttaque = getModifier(mrTable, mr) — lookup table MR→ModDom, PAS une simple addition du MR brut
    Dommages_Bruts = rawDice + modDomAttaque + modDegatsMode (bonus mode de tir)
    Dommages_Nets  = Bruts − Protection_localisation + RD_Naturelle (RD **ajouté**, peut être négatif —
                     fidèle au LdB ; l'ancienne formule « − (Protection + RD) » avait le signe faux)
    Gravité par tranche de 5

[5] Altérations & Ressources
    Test de Choc si Grave(Tête/Corps) ou Critique/Mortelle → is_stunned si échec
    ammo_remaining -= bullet_count — INVENTORY_UPDATED n'est PAS émis à cet endroit (contrairement au
    rechargement, qui lui l'émet bien)
```

Le module DSL munitions (`shared/weaponAmmoDsl.js`, `getEffectiveWeaponDamage`, Choc combiné) est
central au calcul réel de dégâts — voir `docs/SYSTEME/COMBAT.md` §Munitions pour le détail complet du
registre.

---

## 5. Matrice Isolation Risques de Régression

| Fichier modifié | Impact direct | Valider |
|---|---|---|
| `charStats.js` | Initiative base, REA, paliers blessure | Recalcul INI immédiat si blessure (sans attendre round suivant) |
| `combatStore.js` | Anneaux déplacement, boutons modale | État 'combat' fige canvas ; opacité correcte mode édition |
| Schéma `combat_actions` | File attente, ordre résolution | Aucune insertion ne viole la contrainte sequence (1 < 2 < 3) |
| Handler `COMBAT_ACTION_DECLARE` | Timeline, mod INI | Action précipitée reordonne roster DB + push tous clients |
| Routine `endTurn` | Nettoyage fin de round | **Nomenclature obsolète** : `is_rushed` ne vit plus dans `state_character` (migré vers `state_vitesse`, migration 58) et `is_stunned` vit dans `token_statuses`, pas dans ce JSONB — cette ligne visait une architecture qui n'existe plus telle quelle. Reste vrai sur le fond : vérifier que `endTurn` nettoie bien les 3 mécanismes réels (`state_vitesse`, `token_statuses`, `state_character.init_state_confirmed`) |

### Statut d'adéquation Polaris

| Étape | Statut | Note |
|---|---|---|
| Initialisation (calcREA + bris d'égalité masqué) | ✅ Conforme | Jet caché serveur, déterministe |
| Ordre annonce (croissant strict) | ⚠️ Alerte | Risque déclaration désordonnée si guard absent — voir §2 |
| Mutation INI (modificateurs immédiats) | ⚠️ Partiel | Gestion seuil ≤ 0 manquante — voir §3 |
| Ordre résolution (décroissant strict) | ✅ Conforme | `activeSlotIdx` décroissant en INI |
| Séquence interne (Mouvement → Assaut) | ✅ Conforme | Contrainte `sequence` (1,2,3) en DB |
| Fin de round (purge modes, états persistants) | ✅ Conforme | `endTurn` JSONB sélectif |

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

**Implémenté des deux côtés** (`socketCombatHelpers.js:26-70` + `CombatModifiersWindow.jsx`) — cette
section décrivait à tort un besoin « à intégrer ». Réserves confirmées :
- « Allure maximale » (tireur) et « Couverture/Éclairage Totale » sont codées en malus `-99`, mais
  **bloquées côté client uniquement** (`hasTirImpossible` désactive le bouton) — **aucun garde
  serveur**, contournable par un client modifié.
- Le mécanisme « tir en aveugle + Test Observation opposé » (exception couverture/éclairage Totale)
  **n'existe nulle part** dans le code.
- Un `coverageModifier` géométrique séparé existe (`shared/world/visibility.js:179-209`, -5/-3 par
  ratio de couverture) — l'effet du palier « Totale » passe indirectement par le statut LOS `blocked`,
  pas par une entrée dédiée de cette table.

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
   Dommages_Bruts = rawDice + ModDom(FOR_attaquant)         ← impl V1 (règle LdB : Arme + MR + ModDom — dette Session 67, toujours active, voir BUGIDENTIFIE.md MELEE-MR)
   Dommages_Nets  = max(0, Dommages_Bruts - etq + rd)
     etq = calcResistanceArmure(armures équipées, localisation touchée).etq   [mille-feuille]
     rd  = calcResistanceDommages(FOR_na_cible, CON_na_cible)                 [table RD_TABLE, positif ou négatif]
   Gravité = par tranche de 5 points nets

[5. Localisation]
   1D20 => table localisation (colonne "Contact" optionnelle du LdB)
```

#### Cible sans defense
Si la cible ne peut pas se defendre (surprise totale, inconsciente) : test simple avec **+5** au lieu du test d'opposition.
⚠️ **ABSENT du code réel** — aucun bonus +5 ni bypass trouvé dans `resolveMeleeAction` (même écart que
côté tir, voir BUGIDENTIFIE.md DEF5). Cette section décrit la règle LdB attendue, pas l'état codé.

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

#### Modes de combat

| Mode | Mod attaque | Mod défense | Contrainte |
|---|---|---|---|
| `normal` | ±0 | ±0 | — |
| `offensif` | +3 | −5 (jusqu'à prochaine action) | — |
| `charge` | +3 attaque, +3 dommages | −7 (jusqu'à prochaine action) | dist > 3m, déplacement court gratuit, action exclusive (→ §6.4) |
| `defensif` | pas d'attaque | +3 | action retardée obligatoire |
| `retraite` | pas d'attaque | +5 | action retardée + recul gratuit |

Stockage : `combat_roster.state_combat_mode` (TEXT). Reset à `'normal'` chaque `endTurn`. Déclaration en ANNOUNCEMENT uniquement.

#### Multi-adversaires

Malus appliqué à l'attaque ET à la défense du combattant qui fait face à plusieurs adversaires.

| Adversaires distincts en portée CaC | Malus |
|---|---|
| 2 | −5 |
| 3 | −7 |
| 4+ | −10 |

"En portée CaC" = distance ≤ 3m + allonge_max de l'adversaire. Maximum 4 adversaires simultanés (au-delà ils se gênent mutuellement, LdB p.224).

**Implémentation :** `countAdversaires()` — Session 72 — appliqué dans `resolveMeleeAction`, attaque ET défense.

#### Allonge

Quand les deux combattants ont une allonge, seul celui avec la **plus grande** allonge bénéficie d'un bonus = `allonge_lui − allonge_adversaire`. L'autre ne gagne rien.

Double tranchant : si le bénéficiaire perd le test, l'adversaire peut casser la distance (arme difficile à manœuvrer au corps à corps).

**Implémentation V1 :** affichage client uniquement — pas de calcul serveur.

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

| Action | Type | Regle | Statut |
|---|---|---|---|
| Charge | CaC | Exclusive. Necessite elan (deplacement court gratuit minimum). +3 attaque, +3 dommages, -7 defense jusqu'a prochaine action. | Bonus/malus implementes (`socketCombatHelpers.js`) — **exclusivite non enforced** (rien n'empeche de charger ET tirer le meme tour) |
| Tir vise | Distance | Exclusive. Immobile obligatoire. +1 test par tranche de 2 INI sacrifies (max +5). | ✅ Implemente — Session 141 (suite 17), `docs/PLAN_TIRVISE.md` |
| Rafale longue | Distance | Exclusive. 5 a 20 balles. +2 test et +2 dommages par groupe de 5 balles. | Bonus implementes (`FIRE_MODE_VARIANTS.RL`) — **exclusivite non enforced** |
| Tir de suppression | Distance | Exclusive. Zone 3m de base, +3m ou +2 test par groupe de 5 balles. Test de Chance pour chaque cible dans la zone. | Absent — fonctionnalite entiere a construire (ciblage de zone), pas juste un flag |
| Rafale longue multi-adversaires | Distance | Exclusive. Un groupe de 5 balles par cible. Ecart max 3m entre cibles. | Absent |

**Regle de coherence — CORRIGE (Session 141 suite 17) :** l'ancienne mention d'un `EXCLUSIVE_ACTIONS` dans
`combatSections.js` decrivait une architecture jamais construite. L'implementation reelle vit dans
`shared/combatExclusiveActions.js` (evaluateur pur, importe identique client + serveur — pattern
`shared/careerEligibility.js`) : `isExclusiveDeclaration({ mapActions })` est le registre extensible
(peuple pour Tir vise uniquement ; Charge/Rafale longue le rejoindront chacun dans sa propre session
future, leurs bonus mecaniques existant deja) ; `isAimEligible`/`getAimIneligibilityReasons` portent la
regle specifique a Tir vise ("aucune transition d'etat ni autre action ce tour", strictement plus stricte
que la seule notion d'exclusivite generique — voir Piege ci-dessous).

**Piege trouve en implementant Tir vise :** "exclusive" (au sens generique, LdB) ne signifie PAS
"immobile" — Charge *exige* un deplacement, donc un flag "exclusive ⇒ pas de move" casserait Charge.
Immobilite est une contrainte propre a Tir vise, geree separement de l'exclusivite generique.

---

### 6.5 Retarder son Action (LdB p.218) — ✅ Implémenté (Sessions 157-159, refonte sans minuteur)

> Cette section décrivait initialement une spec (`action_key: 'delayed'` + `target_initiative`) jamais
> construite ainsi. **Le mécanisme réel est différent et déjà livré** — détail complet et invariants
> dans `docs/SYSTEME/COMBAT.md` §« Échelle de phases (Résolution) — `combat_timeline_entries` ».

Un joueur peut ne pas agir a sa phase d'initiative et attendre.

- Peut agir a **n'importe quelle phase ulterieure** dans le meme tour (`state_vitesse='delayed'`,
  aucun minuteur — un premier design à sous-état FSM temporisé `AWAITING_REACTION_WINDOW` a été
  **entièrement retiré** en cours de chantier après avoir causé 3 bugs racines réels en une journée,
  remplacé par une règle unique conforme au RAW : « agir à n'importe quelle phase d'Action »).
- Si action retardee vs action normale a la meme phase => **action retardee prioritaire** (resolue en premier) — validé en navigateur sur plusieurs Tours/configurations.
- Si deux actions retardees a la meme phase => regles normales d'egalite d'initiative — **non testé en navigateur à ce jour**.
- Report d'un tour entier possible : agit **des la 1ere phase du tour suivant** quelle que soit son initiative — **non testé en navigateur à ce jour**.
- **Une action precipitee ne peut pas etre retardee.**

**Implémentation réelle** : `combat_timeline_entries` (une carte = une action, entrelacée entre tous
les combattants) porte l'échelle de phases ; l'affordance « Agir maintenant » (panneau dédié par
personnage en délai) permet d'interrompre au bon moment ; le tour obligatoire de fin de Tour force la
résolution d'un personnage encore en délai. `StateSelector` (3 boutons normal/précipité/retardé,
`CombatActionWindow.jsx`, réutilisé côté MJ dans `CombatGmDeclareWindow.jsx`).

**Non testé avant clôture complète** : le tour obligatoire de fin de Tour avec un personnage retardé
qui se retrouve dernier debout, Passer consciemment, deux personnages retardés simultanés (départage
Initiative égale), un CaC retardé (seul le Tir a été retesté après les derniers correctifs), Retarder
d'un Tour sur l'autre.

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

### 6.9 Arts Martiaux — Synthèse (Non implémenté V1)

**Compétence limitative** sur Combat à mains nues / Combat armé (limite le niveau utilisé). Une seule technique par Tour de combat.

#### Techniques offensives
*Condition : Initiative ≥ adversaire, mode Normal/Offensif/Charge.*

| Technique | Mécanique |
|---|---|
| Frappe puissante | +3 dommages (+6 si Charge) |
| Frappe incapacitante | Dommages normaux + Test Choc défenseur malus −5 (cumule si blessure déclenche aussi un Choc) |
| Frappe précise | Malus localisation ciblée réduits de 3 |
| Enchaînement | 2 attaques (+0/−3), 3 attaques (−3/−5/−7) — voir §6.3 |
| Combat à deux armes | +3 + attaque supplémentaire gratuite à −5 |
| Balayage | Succès → défenseur Test COO. Échec : perd (5 + MR) INI. Catastrophe : chute. |

#### Techniques défensives
*Condition : mode Normal/Défensif/Retraite.*

| Technique | Mécanique |
|---|---|
| Garde de combat | Adversaire −3 au test |
| Contre-attaque simultanée | Mode Défensif uniquement — Test −5 pour contre-attaquer dans le même mouvement |
| Esquive | Retraite sans obligation de reculer physiquement |
| Combat à deux armes | +3 en défense |
| Défense multi-adversaires | Malus multi-adversaires réduits de 3 |
| Dégagement/saisie | Test AM(Techniques déf.) pour se libérer d'une prise adverse |

#### Lutte
*Condition : modes Normal/Offensif/Défensif, corps à corps strict.*

Saisie = Préparation −3 INI (déclarée en ANNOUNCEMENT) — **→ voir §6.6.**
Si saisie réussie → choix : Clé/Immobilisation / Étranglement / Projection.

---

### 6.10 Viser une Localisation précise (LdB p.229-230, `COM9`) — ✅ Implémenté (2026-07-17, distance uniquement)

Un combattant peut choisir la zone touchée au lieu de la déterminer par 1D20 aléatoire, contre un
malus au Test. **Distincte** de Tir visé (§6.4, bonus au Test via sacrifice d'Initiative) et de
"Changer le mode de tir" (dette non implémentée) — trois mécaniques voisines mais différentes.

**Malus LdB** :
| Zone | Malus |
|---|---|
| Corps | −3 |
| Jambes (droite ou gauche) | −5 |
| Tête / Bras (droit ou gauche) | −7 |
| Zone très spécifique (épaule, ventre, main, genou…) | −7 à −10 |

Le dernier palier (zone très spécifique) **n'est pas géré** — le système de blessures ne connaît que
6 zones générales (`shared/armorConstants.js` `SLOT_TO_WOUND_LOCATION`), pas de sous-localisation par
membre. Reste à la discrétion narrative du MJ.

**Implémentation** — même patron que Tir visé (déclaration en phase 1, affinement en phase 2) :
1. **ANNONCE** (`AssaultRangedPanel.jsx`, picker silhouette interactif) : le joueur choisit une zone
   (ou aucune = comportement aléatoire inchangé), stockée sur `combat_actions.aimed_location`
   (migration 164, colonne texte nullable, même convention que `fire_mode`). **Aucun coût
   d'Initiative** (contrairement à Tir visé).
2. **RÉSOLUTION** (`resolveAssaultAction`, `socketCombatHelpers.js`) : le malus (`shared/
   armorConstants.js` `AIMED_LOCATION_MALUS`) est ajouté au Seuil, et le slot correspondant
   (`LOCATION_TO_SLOT`) est transmis à `damageService.resolveTargetHit` comme `forcedSlotCode` — qui
   bypasse alors le jet `1D20` de localisation (aucun jet gaspillé pour l'affichage).
3. **PJ différé** (`COMBAT_DAMAGE_CONFIRM`, `socketCombatResolution.js`) : la zone visée voyage dans
   le `payload` du `combat_pending` type `'damage'` (même mécanisme que `mr`/`portee`).

**Cumul avec Tir visé** : autorisé (additif, pas de garde d'exclusivité) — les deux modificateurs
tirent en sens opposé sur le même Test (bonus INI vs malus précision), pas un cumul de puissance.

**Hors scope** : corps-à-corps (`resolveMeleeAction`), drones tireurs (`resolveDroneAssaultAction` —
non listé dans les modificateurs standard §7.3). Détail complet et recherche externe :
`docs/Old/PLAN_TIRVISE v2.md`.

---

## §7 — DRONES EN COMBAT

> ⚠️ **SECTION DRONES UNIQUEMENT** (`character.type === 'drone'`). Si la tâche en cours ne concerne pas les drones, arrêter la lecture ici.

**Sources :** `docs/REGLES/REGLEDRONE.md` (LdB p.319-320 + Guide Technique p.245-253) — chemin corrigé,
déplacé depuis `docs/REGLEDRONE.md`.
**Voir aussi :** `shared/droneConstants.js`, `docs/Old/PLAN_DRONE.md` — chantier clos, déplacé depuis
`docs/PLAN_DRONE.md`.

---

### 7.1 Modes de contrôle

> ⚠️ **État réel** : seul le mode `autonome` à INI 12 fixe est implémenté (`socketCombatState.js:62-66`,
> ✅ CONFORME, plus avancé que cette section ne le suggère). Tout le reste de cette section (colonne
> `state_control_mode`, mode `télépiloté`, distinction INI pilote/drone) est une **spec non construite** :
> `state_control_mode` n'existe pas comme colonne, tous les drones sont traités en INI 12 fixe sans
> distinction de mode.

**`state_control_mode`** — état persistant stocké sur la ligne du drone dans `combat_roster`.
Défini en phase Roster (état initial). Modifiable en ANNOUNCEMENT via l'action **"Télépiloter"** du character propriétaire (toggle). Persiste d'un tour à l'autre jusqu'à toggle explicite.

Affiché uniquement pour les propriétaires de drone (conditionnel UI). Pour un drone non assigné : GM gère le toggle.

| Mode | INI | Compétence d'attaque | Déplacement CaC |
|---|---|---|---|
| **`autonome`** | 12 (fixe, immuable) | `min(programme_armement_drone, TELEPILOTAGE_proprio)` si télépiloté — `programme_armement_drone` si autonome | Joueur déplace le token drone (2e entité contrôlée) |
| **`télépiloté`** | INI du character propriétaire | `min(programme_armement_drone, TELEPILOTAGE_proprio)` | Character propriétaire déplace et attaque |

**Mode autonome — deux entités :** le joueur (user) contrôle son character ET le drone indépendamment. Le character agit à son propre INI. Le drone agit à INI 12. Le tour du character n'est pas consommé.

**Mode télépiloté — règle limitative (LdB p.319) :** le character propriétaire consomme son tour au profit du drone. La compétence d'attaque est le niveau du programme `armement` du drone, plafonné par `TELEPILOTAGE` du character.
Ex. : programme Armement drone niv. 15, pilote Télépilotage 10 → niveau effectif = 10. Programme 8, Télépilotage 12 → niveau effectif = 8.

**Mode télépiloté — acquisition :** désignation directe de la cible par le character. Pas de Détection, pas d'Ami/Ennemi.

**Interception — mode autonome uniquement :** en mode télépiloté, l'ordinateur n'exécute pas de comportements réactifs automatiques.

**Mode autonome — auto-déclaration ANNOUNCEMENT :** en fin de phase ANNOUNCEMENT, le serveur auto-valide (`has_announced = true`) les drones autonomes sans déclaration manuelle existante. La séquence (Détection → Ami/Ennemi → Armement) s'exécute en RESOLUTION. Si le GM déclare manuellement pour le drone avant la fin d'ANNOUNCEMENT, l'auto-déclaration n'a pas lieu.

**INI 12 — valeur immuable :** aucun modificateur d'état ne modifie l'initiative du drone autonome.

---

### 7.2 Mode autonome — séquence d'acquisition et d'attaque

**Règle fondamentale :** un drone autonome attaque **une fois par Tour**, à **INI 12**.

#### Cas A — Aucune cible acquise (début de combat ou cible perdue)

```
INI 12 → Test Détection (D20 ≤ niveau programme détection)
  Échec → INI 7 → re-Test Détection
    Échec → INI 2 → re-Test Détection
      Échec → action perdue ce tour
  Succès → Test Ami/Ennemi (si programme disponible)
    Succès → cible acquise → Test Armement → 1 tir (pas de retry)
    Échec  → cible non identifiable ce tour (pas de retry Ami/Ennemi)
  Sans programme Ami/Ennemi → cible acquise immédiatement
                               (1 cible au hasard parmi les tokens du roster actif, alliés compris)
```

**Tir après retry :** si la Détection réussit à INI 7 (ou INI 2), le tir s'effectue à ce même rang d'initiative dans le même tour.

#### Cas B — Cible déjà acquise

```
INI 12 → Test Armement (D20 ≤ niveau programme armement) → 1 tir
  Raté → pas de retry. Cible reste acquise pour le tour suivant.
```

**Persistence :** une cible acquise le reste jusqu'à ce qu'elle sorte de la zone de détection. Tant qu'elle y reste, la séquence Détection + Ami/Ennemi n'est pas relancée.

**Perte de cible :** si la cible acquise sort de la zone, le drone relance la séquence complète (Cas A) dès son prochain tour. La zone de détection n'étant pas calculée automatiquement, le GM dispose d'une fenêtre pour marquer manuellement une cible comme "perdue" (force le retour en Cas A au tour suivant).

**Zone de détection :** non définie par le LdB. Déterminée par le MJ selon les capteurs du drone (portée indiquée dans les programmes ou l'équipement spécial de la fiche).

**Stockage cible acquise :** `combat_roster.acquired_target_token_id UUID REFERENCES tokens(id) ON DELETE SET NULL`. La FK cascade automatiquement à NULL si le token cible est retiré du roster (mort, fin de combat) — désacquisition automatique sans code supplémentaire.

---

### 7.3 Programmes comme compétences — règle fondamentale

Pour tout Test de programme : **D20 ≤ niveau du programme = succès**.

Pas d'attributs. Pas de maîtrise. Pas de calcul AN/NA. Le niveau du programme est directement le seuil de réussite.

**Modificateurs situationnels standard applicables** au Test Armement : portée, taille cible, obscurité, couverture (mêmes tables que humanoïdes).

**Exception `armement_contact` :** portée = 0 — le contact physique ≤ 3m est satisfait par définition. Modificateurs légitimes : taille, obscurité, couverture uniquement.

**Pas de malus blessures ni d'encombrement** — les drones n'ont pas ces mécaniques.

**Mode télépiloté :** le programme du drone reste la base du Test — c'est `min(programme.level, TELEPILOTAGE_proprio)` qui s'applique. Le character propriétaire n'utilise pas sa propre compétence d'arme.

---

### 7.4 Actions conditionnées par programme

| Programme (`category`) | Action | Déclencheur | Mécanique |
|---|---|---|---|
| `detection` | Acquisition de cible | Début du tour sans cible / cible perdue | D20 ≤ niveau → cible détectée |
| `ami_ennemi` | Identification ami/ennemi | Après succès Détection | D20 ≤ niveau → cible identifiée. Échec = pas d'attaque ce tour |
| `armement_distance` | Attaque à distance | Cible acquise | D20 ≤ niveau → touché. Résolution dommages standard |
| `armement_contact` | Attaque au contact | Cible acquise + drone en portée CaC | D20 ≤ niveau → touché. Résolution dommages standard |
| `esquive` | Défense contre attaque CaC | Attaqué au contact | D20 ≤ niveau → esquive (test d'opposition). **Déclenché automatiquement** si le programme est présent. Mise à couvert = déplacement standard (pas de test `esquive`). |
| `interception` | S'interposer contre tir/explosion | Attaque ranged sur entité alliée dans la zone | D20 ≤ niveau interception ET MR(interception) > MR(attaque) → drone s'interpose (obstacle, absorbe tout). **Binaire : tout ou rien. Mode autonome uniquement. Inutile au CaC (LdB p.247).** |
| `pilotage` | Déplacement (mode autonome) | Tour du drone | Pas de test requis — déplacement selon `drone_sheet.vitesse` |
| `medical` | Premiers soins / Chirurgie | Personnage blessé à portée | D20 ≤ niveau → soin (hors combat principalement) |
| `reparation` | Restaurer intégrité d'un drone | Drone endommagé à portée | D20 ≤ niveau → restauration partielle |

**Sans programme `esquive` :** le drone ne peut pas se défendre contre les attaques CaC — aucun test d'opposition possible.

**Sans programme `interception` :** le drone bouclier ne peut pas s'interposer.

**Mode de tir (armement_distance) :** CC/RC/RL selon l'arme — `drone_weapons.fire_mode`. Configuré à l'avance dans la fiche drone.

**Interception et attaque dans le même tour :** possible si l'ordinateur embarqué a une capacité suffisante. Règle LdB p.279 : `gestion_systemes = 10 + (ordinateur_gen × ordinateur_nt)` — nombre de programmes gérés simultanément. Si le nombre de programmes actifs ce tour dépasse cette valeur, l'ordinateur déconnecte les moins prioritaires.

---

### 7.5 Programmes réactifs — HORS SCOPE V1

**Ancrage LdB :** programme réactif (p.281) — *"définit la manière dont un ordinateur va réagir en cas de détection. Un seul programme pour plusieurs équipements s'ils réagissent tous de la même manière."*

> ⚠️ **Non implémenté en V1.** Les programmes réactifs nécessitent un mécanisme d'interruption (INI = INI de l'assaillant, drone réagit hors de son slot INI 12) qui sera traité dans un sprint dédié.

**Ce que ça couvrira (sprint futur) :**
- `tir_si_ident_echec` : si Test Ami/Ennemi échoue → attaque quand même (comportement configurable)
- `intercepter_proprietaire` : s'interposer automatiquement si le propriétaire est attaqué
- Mécanique d'interruption : drone réagit à INI = assaillant, perd son slot INI 12 ce tour

---

### 7.6 Drones comme cibles

Les drones n'ont pas de système de blessures humanoïdes.

**Localisation :** une seule zone fixe (`drone_sheet.localisation_ref` — définie à la création). Pas de jet de localisation D20.

**Armure :** `drone_sheet.blindage` — valeur directe soustraite des dommages bruts (pas de `calcResistanceArmure`).

**Résistance aux dommages :**
```
rd = drone_sheet.integrite_actuelle × 2 → table RD LdB p.112
degats_nets = max(0, degats_bruts - blindage - rd)
```

**Enregistrement :** `drone_sheet.damages` JSONB + décrémentation `integrite_actuelle`. Pas de `character_wounds`. Pas de Test de Choc.

**Destruction :** `integrite_actuelle ≤ 0`.

**Effets de la destruction :**
- Retrait immédiat du roster
- Actions déclarées par le drone ce tour : annulées
- Toute action ciblant ce drone (`target_token_id`) : échec automatique
- Pas de Test de Choc. Pas de blessures résiduelles.

**Dommages bruts :** formule identique à un humanoïde — même arme, même table `ref_equipment`, même MR. La différence est uniquement côté cible (blindage + rd intégrité).

---

### 7.7 Matrice d'adéquation Polaris — Drones

| Aspect | Règle LdB | Statut |
|---|---|---|
| INI autonome = 12 | LdB p.320 "Armes automatisées" | ✅ Implémenté (`socketCombatState.js:62-66`) |
| INI télépiloté = INI pilote | LdB p.319 "Drones et Initiative" | À implémenter (télépilotage) |
| Séquence Détection → Ami/Ennemi → Armement | LdB p.320 | À implémenter |
| Retry détection à −5 INI (12→7→2) | LdB p.320 | À implémenter |
| Cible acquise persistante | LdB p.320 | À implémenter |
| Programmes = compétences directes (D20 ≤ niveau) | LdB p.281 | ✅ Implémenté (`programme.level + totalModComp + coverageModifier`, `socketCombatHelpers.js:1089-1120`) |
| Télépilotage : `min(programme_armement_drone, TELEPILOTAGE_proprio)` | LdB p.319 | À implémenter (sprint télépilotage) |
| Télépilotage : pas de Détection/Ami-Ennemi — cible directe | LdB p.319 | À implémenter (sprint télépilotage) |
| Esquive programme (défense CaC) | LdB p.100 (drones de combat) | À implémenter |
| Interception programme — mode autonome uniquement, inutile au CaC | LdB p.247-248 | À implémenter |
| Programmes réactifs + interruption (INI = assaillant) | LdB p.281 + p.319 | Hors scope V1 — §7.5 |
| Une seule localisation | LdB p.319 | Défini dans `PLAN_DRONE.md` |
| Blindage = armure directe | LdB p.319 | Défini dans `PLAN_DRONE.md` |
| Intégrité × 2 → table RD | LdB p.319 | Défini dans `PLAN_DRONE.md` |
