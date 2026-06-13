Manuel Technique de Référence : Système de Combat Polaris V1Ce document constitue l'unique source de vérité (SSOT) cartographiant les règles du livre de base (LdB) et leur implémentation technique sous protocole WebSockets pur, afin de figer les comportements et d'éliminer les régressions croisées.1. Modèle de Données Persistant (Schéma Relationnel PostgreSQL)Pour éviter les effets de bord lors des requêtes concurrentes, les trois tables centrales obéissent à des contraintes strictes.       +------------------+             +--------------------+
       |   COMBAT_STATE   |             |   COMBAT_ROSTER    |
       +------------------+             +--------------------+
       | campaign_id (PK) |             | id (PK)            |
       | round            | 1      0..* | campaign_id (FK)   |
       | current_phase    |<------------| token_id           |
       | active_slot_idx  |             | base_initiative    |
       +------------------+             | current_initiative |
                                        | state_position     |
                                        | state_weapon       |
                                        | state_character    |
                                        +--------------------+
                                                  | 1
                                                  |
                                                  | 0..*
                                        +--------------------+
                                        |   COMBAT_ACTIONS   |
                                        +--------------------+
                                        | id (PK)            |
                                        | roster_id (FK)     |
                                        | action_key         |
                                        | sequence (SMALLINT)|
                                        | payload (JSONB)    |
                                        +--------------------+
Table combat_stateContrainte : Une seule ligne active par campaign_id.Champs clés : current_phase ('ROSTER', 'ANNOUNCEMENT', 'RESOLUTION'), round (INT), active_slot_idx (INT).Table combat_rosterbase_initiative : Fixée au calcul initial (calcREA = ADA + PER + altérations de santé). Armure mécanisée : MIN(Reaction, Manoeuvre_armure).current_initiative : Variable d'ajustement intra-tour d'action (modifiée par les annonces).Enums strictes :state_position : 'standing', 'crouching', 'prone'.state_weapon : 'holstered', 'ready', 'drawn'.state_character (JSONB) : Stocke les flags volatils (is_rushed, is_surprised, is_stunned).Table combat_actionsContrainte d'indexation : Index composite (roster_id, sequence).sequence (SMALLINT) : Déterminée par le serveur à l'insertion pour respecter l'ordre d'exécution physique obligatoire :Mouvement (sequence = 1)Micro-actions (sequence = 2)Assaut (sequence = 3)2. Automate d'État du Tour de Combat (State Machine)Le passage d'une phase à l'autre bloque l'accès à certaines commandes WS pour garantir l'atomicité. [Phase: ROSTER] ────(COMBAT_START)────> [Phase: ANNOUNCEMENT] ────(Tous validés)────> [Phase: RESOLUTION]
        ▲                                          │                                          │
        └─────────────────(COMBAT_END)─────────────┴───────────(Fin de la file d'actions)─────┘
Phase ActuelleÉvénement DéclencheurActions Serveur / Effets sur la DBSockets Émis (Broadcast)ROSTERCOMBAT_STARTCalcule base_initiative de chaque token via charStats.js. Résout la surprise via jet de Réaction. Passe la phase à 'ANNOUNCEMENT'.COMBAT_STARTED, COMBAT_SURPRISE_PROMPTANNOUNCEMENTCOMBAT_ACTION_DECLAREInsère l'action dans combat_actions. Calcule et applique immédiatement le modificateur d'initiative sur current_initiative en DB.COMBAT_ACTION_DECLARED (Mise à jour UI de la timeline)ANNOUNCEMENTValidation du dernier slotRequête de screening SQL vérifiant la complétion des déclarations. Tri final du roster et passage à 'RESOLUTION'.COMBAT_PHASE_CHANGEDRESOLUTIONCOMBAT_NEXT_SLOTSélectionne le roster_id de l'index d'initiative courant. Consomme séquentiellement ses lignes de combat_actions filtrées par sequence ASC.COMBAT_SLOT_ACTIVATEDRESOLUTIONFin de la file d'actionsSi active_slot_idx atteint le dernier élément du roster : incrémente round, purge combat_actions, exécute la routine endTurn (nettoyage sélectif du JSONB state_character), réinitialise current_initiative = base_initiative, bascule la phase à 'ANNOUNCEMENT'.COMBAT_ROUND_INCREMENTED3. Moteur d'Initiative et Modificateurs TransitoiresL'ordre d'annonce et de résolution est mathématiquement interdépendant. Toute modification de l'un impacte dynamiquement l'affichage de l'autre.Ordre d'Annonce (Croissant)Les entités ayant la plus basse initiative annoncent en premier. Les entités rapides connaissent les intentions des lentes et peuvent adapter leur déclaration.Ordre de Résolution (Décroissant)Les entités ayant la plus haute initiative résolvent en premier.Gestion des Égalités (Départage d'Initiative)Priorité 1 : Plus haut niveau de Réaction naturelle (Reaction calculée nette de blessures/fatigue).Priorité 2 : Plus haute valeur d'Adrénaline (ADA).Priorité 3 : Simultanat strict (règle LdB : les deux attaques se résolvent en parallèle sans préséance de dégâts, les deux entités pouvant s'entretuer). Le comportement V1 Math.random() - 0.5 doit être strictement encapsulé pour ne pas rompre cette simultanéité légale.Table de Mutation de l'Initiative Actuelle (current_initiative)Action Déclarée (Annonce)Modificateur d'InitiativeImpact sur la RésolutionRègle Métier AssociéePrécipiter son action$+3$Avance l'action de 3 phases.Applique un malus de $-5$ au test de compétence final.Dégainer une arme$-5$ (ou $-3$ si main sur l'arme)Retarde l'action finale.Préparation obligatoire si l'état initial de l'arme est 'holstered'.Déplacement court ($\le\text{3m}$)$-3$Retarde l'action d'assaut.Assimilé à une Préparation intégrée à l'assaut (interdit si déplacement long déclaré).Changer mode de tir$-3$Retarde l'action finale.Obligatoire pour commuter entre Coup par coup, Rafale courte, Rafale longue.Changement de posture (Hors déplacement)S'accroupir ($-3$), Se jeter à terre ($-5$), Se relever ($-10$).Retarde fortement la phase d'action active.Gratuit si le mouvement se termine à la fin d'un déplacement long.Note : Si current_initiative <= 0, l'action principale est basculée au début du tour suivant (current_initiative = max_init + 1).4. Pipeline Algorithmique de la Résolution BalistiqueLorsqu'une action de type Assaut (Combat à distance) est consommée en phase de Résolution, le serveur doit exécuter précisément les opérations suivantes sans interversion :[1. Vérifications Géospatiales & Stock]
   ├── Ligne de vue (DDA Raycast sur Redis)
   ├── Distance vs Chaîne de portée ("X/Y/Z/W (V)")
   └── Contrôle Munitions (char_inventory.quantity >= requis)
                 │
                 ▼
[2. Calcul des Seuils et Modificateurs]
   ├── Modificateurs contextuels (Postures, Couvertures, Blessures)
   └── Application malus Précipitation (-5) ou bonus visés
                 │
                 ▼
[3. Résolution des Dés]
   ├── Test d'opposition ou simple (Surprise/Sans défense: simple +5)
   └── Marge de réussite (MR = Seuil de réussite - Jet)
                 │
                 ▼
[4. Calcul des Dommages & Localisation]
   ├── Jet de Localisation (1d20 table Distance)
   ├── Dommages Bruts = Arme + MR
   └── Dommages Nets = Dommages Bruts - Résistance (Armure + Naturelle)
                 │
                 ▼
[5. Altérations de Santé & Contre-coups]
   ├── Enregistrement des blessures (Paliers de 5 points nets)
   ├── Test de Choc (Si Grave/Critique/Mortelle)
   └── Décrémentation Munitions (char_inventory)
Vérifications Spatiales & Stock :LOS : Raycasting 3D (algorithme DDA) sur la grille de voxels stockée dans Redis, calculé depuis source_pos_z + hauteur_posture vers target_pos_z + hauteur_posture.Portée : Extraction et parsing de ref_equipment.range. Identification du palier (Courte, Moyenne, Longue, Extrême) pour déterminer le modificateur de portée de base.Munitions : Invalidation immédiate de l'action si quantity < bullet_count (sauf flag is_infinite).Calcul des Modificateurs :Calcul de la Difficulté nette de l'attaque : Seuil = Compétence de Tir +/- Modificateurs de Portée - Malus de Blessures actuelles - Carence de Force - Malus Précipitation (-5).Si la cible est sans défense (issue d'une surprise totale réussie) : Test simple avec bonus automatique de $+5$ (pas de test d'opposition).Exécution du Jet de Combat :Calcul de la marge de réussite (MR = Seuil - Jet). Si Jet > Seuil, échec de l'action balistique $\rightarrow$ Branchement direct à l'étape de décrémentation des munitions.Détermination de la Localisation et Application de l'Armure :Jet de 1d20 sur la table de localisation à distance.Extraction de la valeur d'armure de la cible spécifiquement sur cette localisation via calcResistanceArmure.Calcul des Dégâts Nets et Gravité :Dommages_Bruts = Dommages_Arme + MR.Dommages_Nets = Dommages_Bruts - (Protection_Localisation + Modificateur_Resistance_Naturelle).La gravité de la blessure est incrémentée par tranche stricte de 5 points de dommages nets. Écriture immédiate en DB.Tests de Choc et Effets Secondaires :Si la blessure enregistrée est localisée à la Tête/Corps avec une gravité $\ge$ Grave, ou si elle est Critique/Mortelle : Déclenchement automatique d'un jet de Choc en DB. Si échec, injection du flag is_stunned dans state_character.Consommation des ressources :Mise à jour transactionnelle de char_inventory.quantity = quantity - bullet_count. Diffusion de l'événement INVENTORY_UPDATED.5. Matrice d'Isolation des Risques de RégressionPour stopper l'effet domino lors des modifications de code, respectez impérativement cette matrice de dépendance :Si vous modifiez ce fichier......cela impacte directement ces fonctionnalités......et vous devez valider ces composants via tests unitaires.charStats.jsCalcul de l'Initiative de base, de la Réactivité et des paliers de blessure.Vérifier qu'une modification des PV/Blessures recalcule immédiatement l'ordre des slots dans la timeline sans attendre le round suivant.combatStore.js (Zustand)L'affichage des anneaux de déplacement (Sprint 4) et l'activation des boutons de modale.Valider que l'état 'combat' fige les contrôles standards du canvas et que le masquage par opacité s'exécute correctement en mode édition géospatiale.Schéma combat_actions (Postgres)La file d'attente globale et l'ordre d'exécution physique en phase de Résolution.S'assurer qu'aucune insertion d'action ne peut violer la contrainte de sequence (Mouvement toujours exécuté avant l'Assaut au sein du même slot).Handler WS COMBAT_ACTION_DECLARELa mise à jour de la timeline et le calcul immédiat des malus/bonus d'initiative.Tester qu'une action "Précipitée" réordonne instantanément le roster en DB et pousse la modification à tous les clients connectés.Routine endTurn (Serveur)Le nettoyage des états de fin de round et l'incrémentation du temps.Garantir que l'opérateur de soustraction JSONB (- 'is_rushed') n'efface pas les états persistants sur plusieurs rounds comme is_stunned ou les malus de maladies.

1. Phase d'Initialisation (Roster & Surprise)Règle Polaris (LdB)L'entrée en combat fige l'ordre de préparation. L'Initiative de base dépend de la Réactivité naturelle ($\text{Réactivité} = \text{Adrénaline} + \text{Perception}$), diminuée par les malus de blessures existants. L'armure mécanisée sature cette valeur via la formule $\min(\text{Réactivité}, \text{Manoeuvre Armure})$. La surprise totale donne lieu à des tests simples avec un bonus de $+5$ pour les agresseurs face à des cibles sans défense. Les égalités d'initiative sont départagées par un jet masqué pour désigner l'acteur prioritaire.Implémentation Système (Plan / Store)Calcul de Base : Validé via calcREA dans charStats.js. L'état initial est correctement injecté dans roster: [] via l'événement COMBAT_START.Bris d'Égalité : Conforme. Le serveur génère un jet de dé caché qui fige l'ordonnancement de manière déterministe.Surprise : Traitée de manière asynchrone via COMBAT_SURPRISE_PROMPT. Le flag is_surprised est stocké dans le JSONB state_character pour conditionner les droits d'action.2. Phase d'Annonce (Cinétique Tactique)Règle Polaris (LdB)L'ordre des annonces est impérativement croissant. Les personnages ayant l'initiative la plus basse déclarent leurs intentions en premier. Cette mécanique est le pilier tactique de Polaris : les combattants les plus rapides (haute initiative) attendent de voir les mouvements et choix des plus lents pour adapter leur propre stratégie. L'annonce est globale et fige les choix pour le round (type d'action, cible, mode de tir).[ORDRE DES ANNONCES : CROISSANT]
Acteur Lent (INI: 7) Déclare ──> Acteur Rapide (INI: 15) Observe et S'adapte
Implémentation Système (Plan / Store)Structure de la File : L'état transitoire est matérialisé par has_announced: false/true dans le roster.Régression Systémique Potentielle : Pour être conforme à Polaris, le moteur de tour doit bloquer la possibilité d'émettre l'événement COMBAT_ACTION_DECLARE tant que l'index du slot actif (activeSlotIdx) n'a pas atteint le jeton du joueur concerné dans l'ordre croissant. Si le système permet une déclaration simultanée ou désordonnée (chaque joueur clique quand il veut), l'avantage tactique des hautes initiatives est détruit.3. Mutations d'Initiative (Modificateurs Intra-Tour)Règle Polaris (LdB)L'Initiative courante (current_initiative) n'est pas statique. La déclaration de certaines actions altère immédiatement le score d'action pour le round en cours :Précipiter son action (vitesse augmentée mais précision réduite) : $+3$ INI / Malus de $-5$ au jet de compétence.Dégainer ou préparer une arme : $-5$ ou $-3$ INI.Changement de mode de tir / Changement de posture : $-3$ à $-10$ INI.Règle de report : Si l'accumulation des malus fait descendre l'initiative courante à une valeur $\le 0$, l'action principale est annulée pour le round en cours et reportée au début du round suivant.Implémentation Système (Plan / Store)Calcul des Mutations : Le système intègre ces variations. L'événement COMBAT_ACTION_DECLARE recalcule instantanément current_initiative en DB et met à jour le store via updateRoster. Le flag is_rushed est correctement tracé.Écart Logique V1 : Le document de planification ne spécifie pas de structure de bascule pour le report des actions dont l'INI tombe sous le seuil de 0. Elles risquent d'être traitées en fin de boucle de résolution au lieu d'être migrées vers le round suivant.4. Phase de Résolution (Cinétique Physique)Règle Polaris (LdB)L'ordre de résolution est impérativement décroissant. L'acteur ayant la plus haute initiative résout ses actions en premier. L'ordre d'exécution physique interne à un personnage suit une séquence stricte : Déplacement court ($\le\text{3m}$) intégré à l'assaut, ou Déplacement long ($>\text{3m}$) coupant l'action principale. Les dégâts sont instantanés : si un acteur à haute initiative tue ou étourdit (is_stunned) une cible plus lente, les actions déclarées de cette cible sont modifiées ou annulées avant son slot de résolution.[ORDRE DE RÉSOLUTION : DÉCROISSANT]
Acteur Rapide (INI: 15) Résout ──> [Impact Physique / Mort] ──> Acteur Lent (INI: 7) Annulé
Implémentation Système (Plan / Store)Séquencement Interne : Conforme. La table combat_actions utilise la colonne sequence (SMALLINT) pour garantir l'ordre : Mouvement (1) $\rightarrow$ Micro-actions (2) $\rightarrow$ Assaut (3).Consommation des Slots : L'automate progresse via activeSlotIdx et advanceSlot dans le store. Le traitement est séquentiel.5. Clôture et Maintenance des États (Fin de Round)Règle Polaris (LdB)À la fin du round de combat (tous les slots résolus), les modifications transitoires de type comportemental (Précipitation) s'effacent. En revanche, les altérations physiques persistent sur des durées définies par des dés : l'état Étourdi (is_stunned) dure 1d6 rounds, tandis que l'Inconscience dure 1d6 minutes.Implémentation Système (Plan / Store)Routine endTurn : Le système effectue une purge. L'usage de l'opérateur JSONB (- 'is_rushed') isole correctement l'effacement de la précipitation.Conformité des Compteurs : L'introduction de variables de type 1d6 tours pour l'état is_stunned nécessite que le JSONB state_character ne stocke pas un simple booléen, mais un entier décrémenté par le serveur à chaque itération de round dans combat_state.Matrice Globale d'Adéquation Polaris (Synthèse)Étape du TourRègle Métier PolarisModélisation TechniqueStatut LogiqueInitialisationTri Réactivité + Bris d'égalité masqué.calcREA + Jet caché serveur.ConformeOrdre AnnonceTri Croissant strict (Éléments lents d'abord).Store roster, ordonnancement UI dépendant de la phase.Alerte : Risque d'inversion visuelle/applicativeMutation INIModificateurs immédiats. Report si INI $\le 0$.Événement DECLARE modifiant current_initiative.Partiel (Gestion du seuil $\le 0$ manquante)Ordre RésolutionTri Décroissant strict (Éléments rapides d'abord).Progression par activeSlotIdx décroissant en INI.ConformeSéquence d'ActionMouvement puis Action principale.Contrainte de tri sequence (1, 2, 3) en base de données.ConformeFin de RoundPurge des modes, maintien des états physiques ($X$ tours).Routine endTurn avec traitement JSONB sélectif.Conforme

---

## 6. RÃ¨gles Omises â€” ComplÃ©ments Obligatoires

Les sections suivantes complÃ¨tent le manuel avec les rÃ¨gles du LdB non couvertes dans la version initiale. Source : REGLESYSCOMBAT.md (LdB Polaris, source de vÃ©ritÃ© absolue).

---

### 6.1 Modificateurs de Circonstances â€” Combat Ã  Distance (LdB p.227)

Le pipeline balistique doit appliquer ces modificateurs AVANT le jet de tir :

#### DÃ©placement de la cible
| Allure cible | Modificateur |
|---|---|
| Allure moyenne | -3 |
| Allure rapide | -5 |
| Allure maximale | -7 |

#### DÃ©placement du tireur
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

### 6.2 Pipeline Combat au Contact (CaC) â€” Test d'Opposition (LdB p.222-225)

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
   Dommages_Bruts = rawDice + ModDom(FOR_attaquant)         ← impl V1 (règle LdB : Arme + MR + ModDom — dette Session 67)
   Dommages_Nets  = max(0, Dommages_Bruts - etq - rd)
     etq = calcResistanceArmure(armures équipées, localisation touchée).etq   [mille-feuille]
     rd  = calcResistanceDommages(FOR_na_cible, CON_na_cible)                 [table RD_TABLE, positif ou négatif]
   Gravité = par tranche de 5 points nets

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

**Regle avancee â€” doit etre annoncee lors de la declaration d'intention.**

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

### 6.6 Saisie (Lutte) â€” Preparation -3 INI (LdB p.226)

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

### 6.8 Simultaneite â€” Note d'Implementation (LdB p.214)

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

## §7 — DRONES EN COMBAT

> ⚠️ **SECTION DRONES UNIQUEMENT** (`character.type === 'drone'`). Si la tâche en cours ne concerne pas les drones, arrêter la lecture ici.

**Sources :** `docs/REGLEDRONE.md` (LdB p.319-320 + Guide Technique p.245-253)
**Voir aussi :** `shared/droneConstants.js`, `docs/PLAN_DRONE.md`

---

### 7.1 Modes de contrôle

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

**`armement_contact` — portée :** aucun modificateur de portée applicable (contact physique ≤ 3m satisfait par définition). Modificateurs légitimes : taille, obscurité, couverture uniquement. ⚠️ **Bug DC3 actif** : `PORTEE_MOD_COMP['bout_portant']` = +5 appliqué à tort dans `resolveDroneAssaultAction` — voir BUGIDENTIFIE.md.

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
| INI autonome = 12 | LdB p.320 "Armes automatisées" | À implémenter |
| INI télépiloté = INI pilote | LdB p.319 "Drones et Initiative" | À implémenter (télépilotage) |
| Séquence Détection → Ami/Ennemi → Armement | LdB p.320 | À implémenter |
| Retry détection à −5 INI (12→7→2) | LdB p.320 | À implémenter |
| Cible acquise persistante | LdB p.320 | À implémenter |
| Programmes = compétences directes (D20 ≤ niveau) | LdB p.281 | À implémenter |
| Télépilotage : `min(programme_armement_drone, TELEPILOTAGE_proprio)` | LdB p.319 | À implémenter (sprint télépilotage) |
| Télépilotage : pas de Détection/Ami-Ennemi — cible directe | LdB p.319 | À implémenter (sprint télépilotage) |
| Esquive programme (défense CaC) | LdB p.100 (drones de combat) | À implémenter |
| Interception programme — mode autonome uniquement, inutile au CaC | LdB p.247-248 | À implémenter |
| Programmes réactifs + interruption (INI = assaillant) | LdB p.281 + p.319 | Hors scope V1 — §7.5 |
| Une seule localisation | LdB p.319 | Défini dans `PLAN_DRONE.md` |
| Blindage = armure directe | LdB p.319 | Défini dans `PLAN_DRONE.md` |
| Intégrité × 2 → table RD | LdB p.319 | Défini dans `PLAN_DRONE.md` |
