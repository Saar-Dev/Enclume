# COMPARATIF.md — Audit ponctuel : `docs/MANUELSYSCOMBAT.md` vs code réel

> **ARCHIVÉ 2026-07-19 — triage terminé.** Corrections de nomenclature reportées dans
> `docs/MANUELSYSCOMBAT.md` (§1/§2/§4/§5/§6.1/§6.5/§7.1/§7.7), dettes de code confirmées reportées dans
> `docs/BUGIDENTIFIE.md` (INI4/MELEE-MR/DEF5/TIRIMP/WNDMORT/CHOC1) et référencées dans `docs/EN_COURS.md`
> §Dettes actives, nouveaux chantiers issus de la lecture reportés dans `docs/ROADMAP.md` (Catastrophes,
> Saisie/Lutte, notes LOS/Kiwi Shrapnel/Tir de couverture/couverture géométrique). Conservé ici comme
> preuve du raisonnement de l'audit, ne plus le traiter comme registre vivant.
> **Note** : §6.5 (Retarder l'action) et §6.3 (intervalles INI) documentaient un état daté du
> 2026-07-17 — le chantier Timeline (Sessions 157-159, postérieur à cet audit) a depuis implanté
> Retarder l'action sans minuteur ; §6.3 (intervalles INI par attaque) reste vrai, non affecté par ce
> chantier. Voir `docs/MANUELSYSCOMBAT.md` §6.5 pour l'état à jour.
>
> Snapshot daté **2026-07-17** (branche `dev/Saar`), pas un document vivant. Responsabilité unique :
> comparer, section par section, les affirmations du manuel à l'état réel du code au moment de la
> lecture. Méthode : 4 audits indépendants (lecture de code, aucune modification), citations
> `fichier:ligne` systématiques. Statuts utilisés : **CONFORME** (le manuel décrit exactement le
> code), **DIVERGENT** (le code fait autre chose — nomenclature, mécanisme ou valeur différente),
> **ABSENT** (rien dans le code ne correspond), **OBSOLÈTE** (le manuel décrit un état antérieur au
> code actuel, dans un sens ou dans l'autre).
>
> **Devenir de ce document** (`docs/RegleDocumentaire.md` Règle 10, même logique qu'un PLAN) : une
> fois les corrections arbitrées avec Saar, les corrections de nomenclature vont dans
> `MANUELSYSCOMBAT.md` directement, les dettes de code confirmées vont dans `BUGIDENTIFIE.md`/
> `EN_COURS.md`, puis ce fichier est archivé vers `docs/Old/`. Il ne doit pas devenir une deuxième
> source de vérité durable.

---

## Synthèse exécutive — écarts majeurs

1. **§1 (modèle de données) est en grande partie obsolète dans sa nomenclature** : `round`→
   `current_turn`, `current_phase`→`phase` (+ une 4ᵉ dimension `sub_phase` non documentée),
   `base_initiative`→`base_ini`, `current_initiative`→`initiative`, `roster_id`→`token_id`,
   `payload`→colonnes typées + JSONB `modifiers`. Les 3 flags `state_character` (is_rushed/
   is_surprised/is_stunned) ont été refactorisés vers des colonnes/tables dédiées.
2. **§2 — plusieurs événements du tableau n'existent pas** : `COMBAT_SURPRISE_PROMPT` (réel :
   `COMBAT_SURPRISE_ROLL`), `COMBAT_NEXT_SLOT` (avancement interne, pas d'event dédié),
   `COMBAT_SLOT_ACTIVATED` (réel : `COMBAT_SLOT_ADVANCED`), `COMBAT_ROUND_INCREMENTED` (c'est
   `COMBAT_PHASE_CHANGED` qui est réémis).
3. **§3 — deux dettes documentées ailleurs (`STRUCTURE_SYSCOMBAT.md`, `BUGIDENTIFIE.md` INI3) sont
   confirmées toujours actives** : `endTurn` ne remet jamais `initiative = base_ini` (les deltas
   INI s'accumulent tour après tour), et `current_initiative ≤ 0` n'est toujours pas géré.
4. **§4 — le pipeline balistique du manuel est obsolète sur deux points structurants** : la LOS
   n'utilise pas Redis/DDA (contredit `CLAUDE.md` §8 — c'est le WorldSnapshot, correctement) ; le
   module DSL munitions (`shared/weaponAmmoDsl.js`, `getEffectiveWeaponDamage`, Choc combiné) n'est
   pas mentionné alors qu'il est au cœur du calcul de dégâts réel.
5. **§6.1 — déjà implémenté des deux côtés**, contrairement à la note "à intégrer" du manuel — mais
   avec un vrai trou : "Totale" (couverture/éclairage) et "allure maximale" sont des hacks `-99`
   bloqués côté client seulement, aucun garde serveur, et "tir en aveugle + Test Observation" n'existe
   nulle part.
6. **§6.2 — la dette Session 67 (dégâts CaC = `rawDice + ModDom(FOR)`, sans le MR) est toujours
   active**, alors que le tir à distance applique bien une table MR→ModDom. En revanche les
   modificateurs de situation CaC (§6.2, table complète) sont **tous câblés**, attaquant et
   défenseur — meilleur que ce que suggérait la formulation du manuel.
7. **§6.3 — les intervalles d'initiative par attaque (INI/INI-5/INI-10) n'existent pas** : toutes
   les attaques multiples CaC partagent la même `sequence` et se résolvent en cascade dans le même
   slot. `combat_actions.multi_attack_malus` n'existe pas comme colonne, contrairement à ce
   qu'affirme le manuel.
8. **§6.4/6.5/6.6/6.9 — inchangés depuis la rédaction du manuel** : Charge/Rafale longue toujours
   hors du registre d'exclusivité, Tir de suppression et Rafale longue multi-cibles toujours
   absents, Retarder l'action et Saisie toujours absents, Arts Martiaux toujours à 0%.
9. **§7 (drones) a réellement avancé sur 3 points** depuis la rédaction du manuel (INI 12 fixe,
   programmes-comme-compétences, drone-cible/intégrité×2→RD) mais **le reste de la matrice §7.7 est
   toujours "À implémenter"** comme annoncé — confirmé par les sprints futurs listés dans
   `EN_COURS.md`.
10. **§8 (blessures, `docs/REGLES/REGLEBLESSURES.md`)** — le système de blessures est un modèle
    **statique** (dégâts→gravité→malus), fidèle au RAW sur ce périmètre (y compris le débordement
    de ligne vers la gravité supérieure, `woundUtils.js:28` — texte RAW ambigu entre deux lectures,
    le code applique celle confirmée par Saar : la blessure qui remplirait la dernière case convertit
    directement, ex. 3ᵉ blessure légère sur une ligne à 3 cases = 1 moyenne), mais **sans aucun des
    mécanismes temporels du LdB** (guérison par Test, infection, suractivité, séquelles,
    plafonnement de vitesse selon la gravité).
11. **§8 — les 4 systèmes de statut à niveau cumulatif du LdB (Maladies/Poisons, Drogues,
    Irradiations, Fatigue) sont intégralement absents**, confirmé par recherche exhaustive. Seul
    vestige : les 4 Résistances naturelles statiques (poison/maladie/drogues/radiations) sont
    calculées sur la fiche, et `token_statuses` porte des icônes cosmétiques `poisoned`/`irradiated`
    sans compteur ni test — `docs/Old/PLAN14_StatusEffects.md` (Session 67) avait explicitement
    classé ça "Hors scope V1".

---

## §1 — Modèle de données

### `combat_state`
| Champ manuel | Statut | Réalité |
|---|---|---|
| `campaign_id` PK UUID | CONFORME | `54_combat.js:4` |
| `round` | DIVERGENT | Colonne réelle `current_turn`, incrémenté dans `endTurn` (`socketCombatHelpers.js:238`) |
| `current_phase` | DIVERGENT | Colonne réelle `phase`, CHECK `IN ('ROSTER','ANNOUNCEMENT','RESOLUTION')` (`54_combat.js:8,15-17`) — valeurs exactes, nom différent |
| *(non documenté)* `sub_phase` | OBSOLÈTE (manque au manuel) | `SLOT_ACTIVE`/`AWAITING_DEFENSE`/`AWAITING_DAMAGE` (`81_combat_state_subphase.js:2-8`), utilisé par `combatFSM.js:31-47` |
| `active_slot_idx` | CONFORME | `54_combat.js:10` |

### `combat_roster`
| Champ manuel | Statut | Réalité |
|---|---|---|
| `base_initiative` | DIVERGENT | Colonne réelle `base_ini` = `calcREA(ada_na, per_na, mod_advantage)` (`socketCombatState.js:82`) |
| « Armure méca = MIN(REA, Manœuvre_armure) » | ABSENT | Aucune trace de « manœuvre »/« armure méca » dans `server/src` ni `shared` |
| `current_initiative` | DIVERGENT | Colonne réelle `initiative` |
| `state_position` (standing/crouching/prone) | CONFORME | TEXT + CHECK, pas un ENUM SQL natif (`56_combat_v2.js:24,29`) |
| `state_weapon` (holstered/ready/drawn) | CONFORME | TEXT + CHECK (`56_combat_v2.js:25,30`) |
| `state_character` JSONB (is_rushed/is_surprised/is_stunned) | DIVERGENT | `is_surprised` = colonne booléenne dédiée (`54_combat.js:26`) ; `is_rushed` migré vers `state_vitesse` enum (`58_combat_v4.js:4-20`) ; `is_stunned` tracké par `token_statuses` (`socketCombatAnnouncement.js:120-125`) ; `state_character` ne contient plus que `init_state_confirmed` (`socketCombatState.js:283`) |
| Merge JSONB, jamais remplacement | CONFORME | `state_character || ?::jsonb` (concat Postgres, `socketCombatState.js:283`) |

### `combat_actions`
| Champ manuel | Statut | Réalité |
|---|---|---|
| `roster_id` FK | ABSENT | Colonne réelle `token_id` (+`campaign_id`), pas de FK directe vers `combat_roster` (`54_combat.js:47-48`) |
| `action_key` TEXT | CONFORME | `56_combat_v2.js:5,13` |
| `sequence` SMALLINT (1/2/3) | CONFORME sur le principe | Valeurs codées en dur côté serveur (mouvement=1, micro=2, assaut/CaC/reload=3 — `socketCombatAnnouncement.js:305,366,324` etc.) |
| Index composite `roster_id+sequence` | ABSENT | Index réels : `idx_actions_token(campaign_id, token_id)`, `idx_actions_key(campaign_id, action_key)` — aucun sur `sequence` (`56_combat_v2.js:19-20`) |
| `payload` JSONB | DIVERGENT | Pas de colonne `payload` — données réparties dans des colonnes typées (`weapon_inv_id`, `target_token_id`, `fire_mode`, `bullet_count`, `aimed_location`…) + un JSONB `modifiers` distinct pour les mods INI/contexte annexe |
| Contrainte DB « 1 < 2 < 3 » | ABSENT | Aucun CHECK constraint sur `sequence` — convention purement applicative |

---

## §2 — Automate d'état

Graphe ROSTER→ANNOUNCEMENT→RESOLUTION→ROSTER : **CONFORME** (`combatFSM.js:16-48`), avec en plus les
sous-phases RESOLUTION non documentées au manuel (voir §1).

| Transition manuel | Statut | Réalité |
|---|---|---|
| `ROSTER/COMBAT_START` → `COMBAT_STARTED`, `COMBAT_SURPRISE_PROMPT` | DIVERGENT | `COMBAT_STARTED` CONFORME (`socketCombatState.js:147`) ; `COMBAT_SURPRISE_PROMPT` introuvable — événement réel `COMBAT_SURPRISE_ROLL`, envoyé par socket ciblé (pas broadcast, `socketCombatState.js:131-143`) |
| `ANNOUNCEMENT/COMBAT_ACTION_DECLARE` → insert + mod INI + `COMBAT_ACTION_DECLARED` | CONFORME | `socketCombatAnnouncement.js:414-431,440` |
| `ANNOUNCEMENT`/dernier slot → `COMBAT_PHASE_CHANGED` | CONFORME | `socketCombatAnnouncement.js:473-474` → `startResolutionPhase` → `socketCombatHelpers.js:174` |
| `RESOLUTION/COMBAT_NEXT_SLOT` → consomme `ORDER BY sequence ASC`, `COMBAT_SLOT_ACTIVATED` | DIVERGENT | Aucun event `COMBAT_NEXT_SLOT`. Avancement interne (`advanceSlot`, `socketCombatHelpers.js:194-210`) déclenché par les confirmations (`COMBAT_ACTION_CONFIRM` etc.), émet `COMBAT_SLOT_ADVANCED` (`shared/events.js:89`) et non `COMBAT_SLOT_ACTIVATED`. Le tri `ORDER BY sequence ASC` existe bien (`socketCombatHelpers.js:164`) |
| Fin de file → +round, purge, `endTurn`, reset INI, `COMBAT_ROUND_INCREMENTED` | DIVERGENT/ABSENT | +round CONFORME (nommage `current_turn`) ; purge `combat_actions` CONFORME (`socketCombatHelpers.js:231`) ; **reset `initiative = base_ini` ABSENT** (voir §3) ; event réel = `COMBAT_PHASE_CHANGED`, `COMBAT_ROUND_INCREMENTED` introuvable |

**Alerte du manuel** (garde anti-déclaration désordonnée) — **CONFORME, le garde existe** :
`socketCombatAnnouncement.js:98-108` calcule le premier slot non-annoncé trié `base_ini ASC` et rejette
(`COMBAT_DECLARE_ERROR`) toute déclaration hors tour. L'inquiétude du manuel est donc levée.

---

## §3 — Initiative

| Affirmation manuel | Statut | Réalité |
|---|---|---|
| Ordre annonce croissant / résolution décroissant | CONFORME | `base_ini ASC` (`socketCombatAnnouncement.js:103,478`), `initiative DESC` (`socketCombatHelpers.js:161,167`) |
| Départage 1.REA nette 2.ADA 3.`Math.random()` | DIVERGENT | Le niveau ADA n'est pas implémenté : tri `base_ini DESC \|\| Math.random()-0.5`, aucune comparaison ADA intermédiaire (`socketCombatState.js:92`) |
| `current_initiative ≤ 0` non implémenté (alerte manuel) | CONFORME (dette confirmée active) | Toujours aucune vérification de seuil ≤0 (`socketCombatResolution.js`/`socketCombatHelpers.js`) — dette `BUGIDENTIFIE.md` INI3 toujours ouverte |
| Précipiter +3 / malus -5 différé | CONFORME | Mod INI ligne 230 STATE_COSTS, malus `isRushedMod=-5` si `state_vitesse==='rushed'` (`socketCombatHelpers.js:491,1459`) |
| Dégainer -5 (-3 main sur arme) | CONFORME | `socketCombatAnnouncement.js:227` |
| Déplacement court ≤3m -3 | CONFORME | `shared/combatMovement.js:4` |
| Changer mode de tir -3 | CONFORME | `socketCombatAnnouncement.js:228` |
| S'accroupir -3 / Se jeter à terre -5 | CONFORME | `socketCombatAnnouncement.js:226` |
| Se relever -10, gratuit si fin de déplacement long | DIVERGENT | Le coût -10 existe, **l'exception "gratuit" n'est implémentée nulle part** — le seul `freeMove` du fichier ne concerne que `combat_mode` charge/retraite, pas la posture |
| Reset `initiative=base_ini` en début de tour (§6.7) | ABSENT (dette confirmée active) | `endTurn` (`socketCombatHelpers.js:215-301`) ne touche jamais `initiative` — confirmé aussi par `docs/STRUCTURE_SYSCOMBAT.md:626` |
| Simultanéité = `Math.random()` (§6.8) | CONFORME | `socketCombatState.js:92`, dette VTT assumée telle quelle |

---

## §4 — Pipeline balistique (RESOLUTION, Assaut distance)

| Étape manuel | Statut | Réalité |
|---|---|---|
| LOS « DDA Raycast 3D sur Redis » | **DIVERGENT — manuel obsolète/contradictoire avec CLAUDE.md §8** | `checkCombatLOS` (`losService.js:21-46`) → `evaluateWorldVisibility` (`worldVisibilityService.js:70-122`) sur le **WorldSnapshot** compilé — pas Redis. Le code est correct au regard de l'autorité monde ; c'est le texte du manuel qui doit être corrigé |
| Distance / palier de portée | CONFORME | `resolveWeaponRangeBand(distanceM, ref_range)` (`socketCombatHelpers.js:1385-1397`) |
| Munitions `quantity ≥ bullet_count` sauf `is_infinite`, rejet immédiat | DIVERGENT | Champ réel `ammo_remaining` (pas `quantity`), pas de flag `is_infinite` (c'est `pnj_unlimited_ammo` côté settings campagne pour les PNJ). **Le contrôle a lieu en ANNONCE** (`socketCombatAnnouncement.js:207-220`), pas en RÉSOLUTION — en résolution, décrémentation sans second contrôle, clampée à 0 (`socketCombatHelpers.js:1524-1531`), aucun rejet à ce stade |
| Seuil = compétence ± portée − blessures − carence FOR − précipitation(−5) | CONFORME (extension) | `socketCombatHelpers.js:1405-1475` — formule de base exacte, plus des modificateurs non cités par ce paragraphe (couverture, taille, mode de tir, Tir visé, Viser localisation, mods d'arme, bouclier adverse) |
| Cible sans défense → test simple +5 | **ABSENT côté tir à distance** | `is_surprised` existe mais ne sert qu'à neutraliser l'initiative du surpris — aucun `+5` ni logique d'opposition supprimée trouvée dans `resolveAssaultAction` |
| Jet D20, MR = Seuil − jet | CONFORME | `socketCombatHelpers.js:1476-1478` |
| Localisation 1D20 → table | CONFORME (+ extension COM9) | `damageService.js:118-126`, bypass si `forcedSlotCode` (§6.10) |
| `calcResistanceArmure(localisation)` | CONFORME | `damageService.js:178` |
| Dommages_Bruts = dommages_arme + MR | **DIVERGENT — simplification excessive** | Réel : `rawDice` vient de `getEffectiveWeaponDamage` (DSL munitions, pas juste `damage_h`) + `modDomAttaque = getModifier(mrTable, mr)` (table, pas addition brute du MR) + `modDegatsMode` (bonus mode de tir) — `socketCombatHelpers.js:1615-1628` |
| Dommages_Nets = Bruts − (Protection + RD) | **DIVERGENT — signe** | Réel : `Bruts − etq + rd` (RD **ajouté**, peut être négatif — fidèle au LdB selon commentaire `damageService.js:183-185`, c'est le manuel qui est imprécis) |
| Gravité par tranche de 5 | CONFORME | `damageService.js:79-87` |
| Test de Choc Grave(Tête/Corps) ou Critique/Mortelle → `is_stunned` | CONFORME | `woundUtils.js:4-8`, `statusService.js:43-51`, appliqué `socketCombatHelpers.js:1678-1683` |
| `char_inventory.quantity -= bullet_count` → `INVENTORY_UPDATED` | DIVERGENT | Champ réel `ammo_remaining` ; **`INVENTORY_UPDATED` n'est pas émis** à cet endroit précis (`socketCombatHelpers.js:1524-1531`), contrairement au rechargement qui lui l'émet bien (lignes 929, 989) |

**Absent du manuel** : le module DSL munitions (`shared/weaponAmmoDsl.js`, `getEffectiveWeaponDamage`,
Choc combiné, `damageService.js:34-59,193-230`) est central au calcul réel et n'apparaît nulle part au
§4 — le pipeline documenté est une version antérieure au chantier Armes DSL (Session 141 suite 17+).

---

## §6.1 — Modificateurs de circonstances, Combat à Distance

Déjà implémenté des deux côtés (`socketCombatHelpers.js:26-70` + `CombatModifiersWindow.jsx`),
contrairement à la note « à intégrer » du manuel.

| Table manuel | Statut | Réalité |
|---|---|---|
| Déplacement cible (-3/-5/-7) | CONFORME | `socketCombatHelpers.js:31` |
| Déplacement tireur (-3/-5/-7, maximale=impossible) | DIVERGENT | Valeurs conformes mais « maximale » codée `-99`, bloquée **côté client uniquement** (`hasTirImpossible` désactive le bouton, `CombatModifiersWindow.jsx:195,407-411`) — aucun garde serveur |
| Couverture (-3/-5, totale=impossible sauf aveugle) | DIVERGENT | Partielle/importante conformes ; **aucun palier "Totale" nommé** (seulement 2 checkboxes). Un `coverageModifier` géométrique séparé existe (`shared/world/visibility.js:179-209`, -5/-3 par ratio) sans palier "impossible" non plus — l'effet passe indirectement par le statut LOS "blocked" |
| Éclairage (-3/-5, totale=impossible sauf aveugle+Observation) | DIVERGENT | Légère/importante conformes ; totale = `-99` + blocage client seul ; **aucune mécanique "tir en aveugle + Test Observation opposé"** trouvée |
| Taille cible (table complète) | CONFORME exact | `TAILLE_MODS` (`socketCombatHelpers.js:44-47`), pré-remplissage auto pour drones (`shared/droneConstants.js`) |

---

## §6.2 — Pipeline CaC (test d'opposition)

| Affirmation manuel | Statut | Réalité |
|---|---|---|
| Engage au contact ≤3m + allonge | CONFORME | `socketCombatHelpers.js:395` |
| Test d'opposition + lecture résultat | CONFORME (flux normal) | `hit = attackSuccess && (!defenseSuccess \|\| mrAttaque > mrDefense)` (`socketCombatHelpers.js:721-725`, identique PJ défenseur `socketCombatResolution.js:609-613`). Contre-attaque Arts martiaux si blocage : ABSENT (cohérent §6.9) |
| Dommages_Bruts = rawDice + ModDom(FOR) — **dette Session 67 notée par le manuel** | **DIVERGENT — dette toujours active** | `socketCombatHelpers.js:765,819`, `socketCombatResolution.js:370,695` — le MR n'est toujours pas intégré, contrairement au tir à distance qui utilise une vraie table MR→ModDom |
| Dommages_Nets = max(0, Bruts − etq + rd) | CONFORME | `damageService.js:191` |
| Localisation 1D20 → table (colonne Contact optionnelle) | DIVERGENT | Table unique générique `LOC_TABLE`, aucune distinction CaC/distance |
| Cible sans défense → test simple +5 | ABSENT | Aucun bonus +5 ni bypass trouvé dans `resolveMeleeAction` |
| Modificateurs de situation CaC (côté/sol/confiné/avantageuse/main non directrice/terrain) | **CONFORME, tous câblés** | `SITUATION_MODS` (`socketCombatHelpers.js:36-42`), appliqués attaquant (L.516-530) ET défenseur (L.702-720, `socketCombatResolution.js:589-606`), UI `CombatCacModifiersWindow.jsx:10-18` — meilleur que la lecture littérale du manuel ne le suggère |
| Deux armes CaC +3 attaquant | CONFORME | `socketCombatHelpers.js:506-507,552` |
| Arts martiaux : attaque supplémentaire gratuite -5 | ABSENT | Cohérent avec §6.9 non implémenté |
| Modes de combat (normal/offensif/charge/défensif/retraite) | CONFORME | Bonus/malus exacts (`socketCombatHelpers.js:492-494,727`), reset `endTurn` (`socketCombatHelpers.js:226`), contrainte charge >3m (L.487-490), déplacement gratuit (`socketCombatAnnouncement.js:259-260`) |
| Multi-adversaires (2=-5/3=-7/4+=-10, attaque ET défense) | CONFORME | `multiAdversaryMalus()`/`countAdversaires()` (`socketCombatHelpers.js:306-322`), appliqué des deux côtés (L.498-500, 590-592, `socketCombatResolution.js:583`) |
| Allonge, V1 = affichage client uniquement | CONFORME | Purement cosmétique côté client, aucun calcul de delta serveur |

---

## §6.3 — Attaques multiples par tour

| Affirmation manuel | Statut | Réalité |
|---|---|---|
| Max 3 attaques, malus -5/-7 à toutes | CONFORME (CaC) | `MeleeCombatPanel.jsx:268-270`, `socketCombatHelpers.js:503,530` |
| Intervalles INI (normal / INI-5 / INI-10) | **ABSENT** | Toutes les lignes melee insérées avec `sequence:3` identique (`socketCombatAnnouncement.js:349`) ; seul un coût forfaitaire -3 puis -5 est appliqué à la déclaration, sans étalement par attaque |
| Attaque décalée au-delà de phase 1 = supprimée | ABSENT | Pas de notion de phases séparées — résolution en cascade (`socketCombatHelpers.js:798-805`) |
| Précision (+3 INI) décale les attaques suivantes | ABSENT | Aucune logique trouvée |
| `combat_actions.multi_attack_malus` stocké | **ABSENT — le manuel affirme à tort que c'est fait** | Colonne inexistante dans toutes les migrations |
| Incompatibilité Charge/Tir visé/Rafale longue/Suppression | Partiel | Seul Tir visé bloque réellement le CaC (`combatExclusiveActions.js:106`) ; pas de garde symétrique pour Charge/Rafale longue |

---

## §6.4 — Actions exclusives

| Action | Statut manuel | Statut réel |
|---|---|---|
| Charge | Bonus/malus faits, exclusivité non enforced | **Inchangé** — toujours non enforced |
| Tir visé | ✅ Implémenté | **Inchangé, CONFORME** — seule entrée du registre `isExclusiveDeclaration` |
| Rafale longue | Bonus faits, exclusivité non enforced | **Inchangé** — toujours hors registre |
| Tir de suppression | Absent, à construire | **Inchangé, ABSENT confirmé** |
| Rafale longue multi-adversaires | Absent | **Inchangé, ABSENT** — bouton UI "Multi" présent (`combatSections.js:182`) mais `bonusComp:0/bonusDmg:0`, jamais branché à une mécanique multi-cible |

---

## §6.5 — Retarder son action

**ABSENT, inchangé.** Aucun `action_key:'delayed'` avec `target_initiative` trouvé. `state_vitesse`
connaît la valeur d'enum `'delayed'` mais sans coût ni logique de priorité de résolution associée.

## §6.6 — Saisie (Lutte)

**ABSENT, inchangé.** Pas de clé grapple/saisie dans `STATE_COSTS` ni `combatSections.js`. Le statut
`token_statuses.status_code='grappled'` existe mais est lu par un autre système (armes naturelles),
pas écrit par une mécanique de Saisie.

## §6.9 — Arts Martiaux

**ABSENT intégralement, inchangé.** Aucune des 6 techniques offensives ni des 6 défensives n'a de
trace de résolution serveur ou d'UI. Seul vestige : la compétence `ARTS_MARTIAUX` existe en seed de
fiche (catalogue de compétences), sans lien avec une mécanique de combat.

## §6.10 — Viser une localisation précise (COM9)

**CONFORME intégralement — le manuel est ici à jour.** ANNONCE (`AssaultRangedPanel.jsx:299-307`,
`AimedLocationPicker.jsx`, migration `164_combat_actions_aimed_location.js`), RÉSOLUTION
(`socketCombatHelpers.js:1470-1472,1654`, `damageService.js:118-125`), PJ différé
(`socketCombatResolution.js:357,431`). Table de malus `AIMED_LOCATION_MALUS`
(`shared/armorConstants.js:61-65`) exacte. Le dernier palier (zone très spécifique) est bien absent
du code, **comme le manuel le dit lui-même** — cohérence confirmée, pas un écart.

---

## §7 — Drones

Section pas un simple squelette : `character.type==='drone'` existe réellement
(`71_drone_sheet.js:5-7`). 3 points ont réellement avancé depuis la rédaction du manuel : INI 12 fixe
(§7.1), programmes-comme-compétences (§7.3), drone-cible/intégrité×2→RD (§7.6). Le reste de la
matrice §7.7 est toujours à l'état « à implémenter », conforme aux sprints futurs listés dans
`EN_COURS.md` (« Sprint Drones 2d/2e/3 »). **Liens du manuel obsolètes** : `docs/REGLEDRONE.md` et
`docs/PLAN_DRONE.md` ont été déplacés vers `docs/REGLES/REGLEDRONE.md` et `docs/Old/PLAN_DRONE.md`.

### §7.1 — Modes de contrôle
| Affirmation | Statut |
|---|---|
| `state_control_mode` sur `combat_roster` | **ABSENT** — colonne inexistante, aucune trace de "Télépiloter" hors la compétence catalogue `TELEPILOTAGE` jamais lue par le code drone |
| INI autonome = 12 fixe | **CONFORME** — `socketCombatState.js:62-66` (plus avancé que le manuel ne l'indique) |
| INI télépiloté = INI propriétaire | **ABSENT** — tous les drones traités en INI 12 fixe, aucune distinction de mode |
| `min(programme, TELEPILOTAGE_proprio)` | **ABSENT** |
| Auto-déclaration ANNOUNCEMENT drones autonomes | **ABSENT** — déclaration manuelle exigée comme un PNJ (`socketCombatAnnouncement.js:86-88`) |

### §7.2 — Séquence acquisition/attaque
**ABSENT dans son ensemble.** `resolveDroneAssaultAction` (`socketCombatHelpers.js:1004-1314`) part
d'une cible déjà fournie par la déclaration manuelle — ni Test Détection, ni retry INI 7/2, ni Test
Ami/Ennemi. `combat_roster.acquired_target_token_id` : colonne inexistante.

### §7.3 — Programmes comme compétences
**CONFORME.** `programme.level + totalModComp + coverageModifier`, D20≤niveau
(`socketCombatHelpers.js:1089-1120`). `armement_contact` exception portée=0 CONFORME (ligne 1110).
Pas de malus blessures/encombrement CONFORME. Mode télépiloté ABSENT (cf. §7.1).

### §7.4 — Actions conditionnées par programme
| Programme | Statut |
|---|---|
| `detection`, `ami_ennemi` | ABSENT — catalogue seed seulement, aucune résolution |
| `armement_distance`, `armement_contact` | CONFORME — câblés dans `resolveDroneAssaultAction` |
| `esquive` | DIVERGENT — le drone n'a **jamais** de défense CaC, sans même tester la présence du programme (`socketCombatHelpers.js:807-814`) ; résultat correct par coïncidence, mécanisme conditionnel absent |
| `interception` | ABSENT — et catalogué sous `category:'pilotage'`, pas `interception` (`73_drone_programs_catalog.js:74`) |
| `pilotage` | ABSENT — confirmé `EN_COURS.md:1871` (dette DR2) |
| `medical` | ABSENT côté mécanique (catalogue seul) |
| `reparation` | ABSENT — n'existe même pas comme catégorie distincte au catalogue |
| `gestion_systemes = 10+(gen×nt)` | ABSENT — colonnes `ordinateur_gen`/`ordinateur_nt` existent, aucun calcul trouvé |

### §7.5 — Programmes réactifs
**CONFORME** à l'affirmation « hors scope V1 » — rien n'a bougé.

### §7.6 — Drones comme cibles
CONFORME sur la mécanique de dégâts (localisation unique, blindage direct, RD=intégrité×2,
`drone_sheet.damages`, destruction si intégrité≤0, retrait roster). **DIVERGENT sur les effets de
destruction** : rien ne purge les `combat_actions` du token détruit, et rien n'empêche une attaque
ultérieure de continuer à cibler un drone détruit (`drone_sheet` non supprimée, seule la ligne
`combat_roster` l'est) — le manuel affirme un échec automatique qui n'est pas codé.

### §7.7 — Matrice d'adéquation (état réel vs manuel)
| Aspect | Manuel | Réel |
|---|---|---|
| INI autonome = 12 | À implémenter | **CONFORME** |
| INI télépiloté = INI pilote | À implémenter | ABSENT |
| Séquence Détection→Ami/Ennemi→Armement | À implémenter | ABSENT |
| Retry détection -5 INI | À implémenter | ABSENT |
| Cible acquise persistante | À implémenter | ABSENT |
| Programmes = compétences directes | À implémenter | **CONFORME** |
| Télépilotage `min()` | À implémenter | ABSENT |
| Télépilotage cible directe | À implémenter | ABSENT |
| Esquive programme | À implémenter | ABSENT (mécanisme conditionnel) |
| Interception programme | À implémenter | ABSENT (+ catalogue mal catégorisé) |
| Programmes réactifs | Hors scope V1 | **CONFORME (hors scope confirmé)** |
| Une seule localisation | Défini PLAN_DRONE | **CONFORME** |
| Blindage = armure directe | Défini PLAN_DRONE | **CONFORME** |
| Intégrité×2 → RD | Défini PLAN_DRONE | **CONFORME** |

---

## §5 — Matrice isolation risques de régression

Non ré-audité point par point (nature procédurale, pas factuelle). Une conséquence directe des
écarts ci-dessus mérite d'être signalée : la ligne « `endTurn` : `-'is_rushed'` ne supprime pas
`is_stunned` ni malus multi-rounds » suppose une architecture `state_character` que le §1 montre déjà
obsolète (`is_rushed`/`is_stunned` ne vivent plus dans ce JSONB) — cette ligne du manuel est donc à
réécrire en même temps que la correction de nomenclature du §1.

---

## §8 — État de santé (`docs/REGLES/REGLEBLESSURES.md`, LdB — pas un MANUEL, source de règle brute)

> Périmètre plus large que ce que couvrait `MANUELSYSCOMBAT.md` §4/§5 (qui ne traitait que le
> déclenchement du Test de Choc en combat). Ici : le système de blessures complet, les dommages
> environnementaux annexes, et les 4 systèmes de statut à niveau cumulatif (Maladies/Poisons,
> Drogues, Irradiations, Fatigue).

### 8.1 — Blessures physiques (cœur du système)

| Affirmation LdB | Statut | Réalité |
|---|---|---|
| Seuils 5/10/15/20/25/30 → légère/moyenne/grave/critique/mortelle/mort-membre | CONFORME (5 premiers paliers) | `damageService.js:79-87` (`_severityForDamage`) reproduit exactement 5/10/15/20/25/30 |
| 6ᵉ palier « Mort subite / Membre détruit » comme catégorie distincte | **ABSENT** | `shared/woundConstants.js:5` ne connaît que 5 sévérités ; `is_lethal` (≥30) est un booléen transitoire non persisté, utilisé seulement pour moduler le malus au Test de Choc — jamais pour stocker une blessure « Mort/Membre détruit » séparée ni déclencher la mort immédiate |
| Compteur de blessures : cases par Localisation×Gravité | CONFORME (structure) | `woundUtils.js:16-42`, `WOUND_MAX_COUNTS` fidèle au tableau LdB p.236 |
| Débordement : la blessure qui remplirait la dernière case convertit directement en 1 case du degré supérieur | **CONFORME — texte RAW ambigu, tranché par Saar** | `woundUtils.js:28` : `if (next && currentCount >= maxCount - 1)` — pour une ligne à N cases, les N-1 premières blessures cochent des cases, la Nᵉ convertit directement (ex. ligne à 3 cases : 2 cochées, la 3ᵉ blessure légère = 1 moyenne). Le texte LdB (« lorsque toutes les cases … sont cochées et que le personnage subit une nouvelle blessure ») admet aussi une lecture littérale différente (ligne déjà pleine + une (N+1)ᵉ blessure supplémentaire déclenche la conversion) ; Saar confirme que l'interprétation codée est la bonne — pas un bug |
| Malus aux Tests : -1/-3/-5/-10 (légère/moyenne/grave/critique) | CONFORME | `shared/woundConstants.js:16-18` |
| Malus « mortelle » = aucun Test possible (pas un chiffre) | **DIVERGENT** | Codé comme malus fixe **-20** (`WOUND_PENALTIES.mortelle`), pas comme blocage total des Tests — aucun garde-fou trouvé qui empêche un Test en cas de blessure mortelle |
| Malus non cumulatif (seul le pire est retenu) | CONFORME | `charStats.js:273-281` (`calcWoundPenalty`) garde le pire, ne somme jamais |
| Test de Choc — granularité Localisation×Gravité, malus variable | **CONFORME, plus complet que ne le suggérait §4/§5 du manuel combat** | `charStats.js:324-338` (`getShockMalus`) reproduit la table complète (grave tête -5/corps 0 ; critique tête -10/corps -5 ; mortelle tête -15/corps -10/bras-jambe -5 ; membre détruit bras-jambe -10) |
| Plafonnement de la vitesse de déplacement selon la gravité de blessure | **ABSENT** | `movementBudgetService.js:33-61` calcule les allures depuis COO/Athlétisme uniquement, aucune lecture de `character_wounds` |
| Stabilisation (Critiques à risque hémorragie/Mortelles/Membre détruit) — Test de Premiers soins requis | **DIVERGENT** | Le champ `is_stabilized` existe (migration 49) et une route dédiée aussi, mais c'est un **simple toggle manuel** sans Test, sans distinction de malus par gravité, sans notion de risque d'hémorragie (`char-sheet.js:871-895`, `LocationPanel.jsx:117-118`) |
| Complications si non stabilisé (critique→mortelle après délai CON, mortelle→mort après délai CON) | **ABSENT** | Aucun timer, aucun Test de Constitution périodique trouvé |
| Séquelles | **ABSENT** | Aucune colonne, aucune référence dans le schéma |
| Guérison temporelle (durée par gravité, Test Médecine/Premiers soins/Chirurgie, dégression progressive) | **ABSENT** | La seule « guérison » est un `DELETE` instantané sur clic (`char-sheet.js:898-908`, `LocationPanel.jsx:121`) — aucun Test, aucune durée, aucune dégression d'un niveau de gravité |
| Aggravation — Infection (Test CON périodique) | **ABSENT** | Aucun job, aucune route, rien trouvé |
| Aggravation — Suractivité (jugement MJ → case supplémentaire) | **ABSENT** | Aucune logique métier dédiée, seule voie = ajout manuel de case par un éditeur habilité |

**Synthèse 8.1** : le système codé est un **modèle statique** — dégâts → sévérité → case cochée →
malus au Test / Test de Choc — fidèle au RAW sur ce périmètre précis (hors le détail « mortelle »).
Tout ce qui est **temporel** dans le LdB (guérison, infection, suractivité, séquelles, timer de mort,
plafonnement de vitesse) est absent : les blessures ne s'aggravent ni ne guérissent jamais
automatiquement dans le temps, seule une action manuelle (ajouter/retirer une case) existe.

### 8.2 — Dommages étourdissants et assommants (Choc, LdB p.243)

**DIVERGENT — décalage structurel avec le RAW**, confirmé au-delà de ce qu'indiquait déjà
`MANUELSYSCOMBAT.md` §6.3/dette `[CHOC1]`.

- RAW : réservé aux **armes lourdes/contondantes de mêlée** touchant la **Tête** (ou armes
  purement électriques, sans restriction) — deux jets séparés (dégâts physiques normaux, PUIS jet
  additionnel de Choc ajouté au total pour la Difficulté du Test de Choc), Choc jamais transformé en
  blessure physique.
- Réel (`damageService.js:193-239`, `shared/weaponAmmoDsl.js:34-96`) : le Choc n'est déclenché que
  par la **DSL munitions à distance** (`chocDsl`) — jamais fourni par les chemins de résolution CaC
  (`socketCombatResolution.js:696-701`, `socketCombatHelpers.js:1230-1236` n'y ont pas accès). Un
  **total combiné unique** (`degatsNets + chocTotal`) pilote un seul Test de Choc, au lieu des deux
  jets séparés du RAW. La restriction « Tête uniquement » a été délibérément retirée pour les
  munitions (correctif Session 141, cohérent avec `PLAN_ARMES_DSL.md`).
- `ref_equipment.protection_shock` (colonne réelle en base, migration 48) est récupérée par
  `inventoryService.js` mais **jamais consommée** dans `damageService.js:178` (seul `.etq` est
  extrait, `.prt` est jeté) — champ mort, confirme que la distinction armes lourdes/contondantes vs
  armure anti-Choc (dette `[CHOC1]`) n'a aucun début d'implémentation.

### 8.3 — Autres sources de dommages physiques (environnement)

| Mécanique LdB | Statut |
|---|---|
| Chutes (table par hauteur, Localisations touchées, armure /2, Test Acrobatie) | **ABSENT** — aucune trace dans le moteur monde |
| Acide | **ABSENT** |
| Décompression | **ABSENT** |
| Hyperventilation | **ABSENT** |
| Faim / Soif | **ABSENT** |
| Feu (dégâts par tour, paliers d'intensité) | **ABSENT en pratique** — voir note ci-dessous |
| Froid (paliers de température, dégâts, amputation) | **ABSENT** |
| Noyade / Asphyxie | **ABSENT** — pas de système Souffle/apnée malgré le cadre sous-marin |

**Découverte annexe, hors périmètre LdB** : un système d'effets de terrain générique existe dans le
moteur monde (`shared/world/worldEffects.js:118-143`, hazards `fire`/`flooded`/`gas`/`oil`/
`unstable`), avec un hook `fire` déclarant `damageType:'fire', amountPerIntensity:1` par tour. **Ce
hook n'est jamais consommé pour appliquer un dégât réel** (`getBattlemapEffectHooks`/
`pathEffectEvents` ne renvoient que des événements d'entrée/sortie de zone, jamais d'appel à
`damageService`) — infrastructure GM prête à recevoir une résolution, mais aucune règle Feu/Acide/
Gaz du LdB n'y est branchée. À traiter comme ABSENT pour cet audit, mais à connaître si un futur
chantier veut implémenter les dommages environnementaux : le point d'accroche existe déjà.

### 8.4 — Maladies/Poisons, Drogues, Irradiations, Fatigue (règles avancées, niveau cumulatif 0-30+)

**Tous ABSENT comme mécanique de jeu**, confirmé par recherche exhaustive (contamination, niveau de
maladie/poison/intoxication/irradiation/fatigue, Narco-dommages, Accoutumance, Dépendance/manque —
aucune colonne, aucun service, aucune route).

Ce qui existe malgré tout, à ne pas confondre avec la mécanique elle-même :
- **Résistances naturelles statiques** (poison/maladie/drogues/radiations) — pleinement calculées et
  affichées sur la fiche (`char-sheet.js:1244-1287`, `CharacterSheet.jsx:109-117`), dérivées de
  CON/VOL + mutations + avantages. C'est le *modificateur de résistance* du LdB, pas le *compteur
  d'état* — la mécanique de test/accumulation elle-même n'a jamais été construite dessus.
- **`token_statuses`** (migration 68) porte des icônes `poisoned`/`irradiated` — cosmétiques,
  togglables manuellement, sans colonne de sévérité (0-30) ni test automatique.
- **`docs/Old/PLAN14_StatusEffects.md`** (Session 67) avait explicitement prévu une colonne
  `severity` pour ce cas et l'avait classée *« Hors scope V1 »* — décision de scope assumée à
  l'époque, pas un oubli.
- **Fatigue** : la compétence `Endurance` existe sur la fiche et sa description en catalogue
  mentionne la règle avancée de Fatigue, mais aucun compteur d'état (Normal→À bout de force),
  aucun malus -3/-5/-7/-10, aucun Test périodique en combat n'est câblé nulle part.

---

## Conclusion — actions à trancher avec Saar

**Corrections de manuel pures** (nomenclature/description, aucun changement de comportement) :
§1 entier, §2 (4 noms d'événements), §4 (LOS, mention DSL munitions, signe RD), §5 (référence
`state_character`), §6.1 (retirer la note "à intégrer"), §7.1/§7.7 (mettre à jour les 3 lignes
désormais CONFORME), liens `REGLEDRONE.md`/`PLAN_DRONE.md`.

**Dettes de code confirmées actives**, déjà connues ou nouvellement mises en lumière — à trier entre
`BUGIDENTIFIE.md` (bug/dette ponctuelle) et `EN_COURS.md`/futur PLAN (chantier) : reset
`initiative=base_ini` en fin de tour (§3, déjà documenté ailleurs), `current_initiative≤0` (§3, dette
INI3 déjà connue), dette Session 67 dégâts CaC sans MR (§6.2, déjà documentée mais jamais close),
intervalles INI attaques multiples (§6.3), exclusivité Charge/Rafale longue non enforced (§6.4,
déjà connu), cible sans défense +5 manquant à distance ET en CaC (§4/§6.2), garde serveur absent sur
"tir impossible" (allure/couverture/éclairage totale, §6.1), émission `INVENTORY_UPDATED` manquante
après tir (§4), effets de destruction drone non purgés (§7.6).

**Chantiers entiers non commencés**, déjà connus du manuel et confirmés inchangés : Retarder l'action
(§6.5), Saisie/Lutte (§6.6), Arts Martiaux (§6.9), Tir de suppression + Rafale longue multi-cibles
(§6.4), Séquence d'acquisition drone autonome + télépilotage (§7.1-7.2).

**Nouvelles dettes de code confirmées (§8)**, à trier vers `BUGIDENTIFIE.md`/`EN_COURS.md` comme
ci-dessus : malus « blessure mortelle » codé en -20 fixe au lieu de bloquer les Tests (§8.1),
absence de plafonnement de vitesse selon la gravité de blessure (§8.1), stabilisation sans Test
(§8.1), Choc étourdissant structurellement limité aux munitions à distance alors que le RAW le
réserve aux armes de mêlée lourdes/contondantes touchant la Tête — `ref_equipment.protection_shock`
existe en base mais n'est jamais consommé, champ mort (§8.2, confirme et détaille la dette
`[CHOC1]` déjà connue).

**Chantiers entiers non commencés, nouvellement confirmés (§8)**, décisions de scope à formaliser
plutôt que bugs : guérison/infection/suractivité/séquelles/timer de mort (§8.1), dommages
environnementaux (chute/acide/décompression/feu/froid/noyade — une infrastructure hazard existe
côté moteur monde mais n'applique aucun dégât réel, §8.3), les 4 systèmes de statut à niveau
cumulatif Maladies-Poisons/Drogues/Irradiations/Fatigue (§8.4, déjà classés "Hors scope V1" dans
`docs/Old/PLAN14_StatusEffects.md` Session 67 — décision à reconfirmer ou lever explicitement plutôt
qu'à laisser implicite).
