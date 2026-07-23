# Vocabulary.md

> Vocabulary — Contrat sémantique officiel d'Enclume
>
> Version : V2 — seed initial peuplé Session 141 (suite 18), 2026-07-11
>
> Statut : Source de vérité (non exhaustif — à enrichir à chaque ambiguïté rencontrée, jamais réécrit
> de zéro)

---

document_type: vocabulary

authority: semantic

used_by:

* Combat
* Character
* Inventory
* Wizard
* Trade

update_policy:
modify_here_first: true

---

# Mission

Vocabulary définit le langage officiel d'Enclume.

Ce document est la seule source de vérité concernant :

* les concepts métier Polaris ;
* les termes propres à Enclume ;
* les conventions de nommage ;
* les identifiants historiques ;
* les ambiguïtés connues.

Tous les autres documents utilisent ces termes mais ne les redéfinissent jamais.

---

# Règles

## Source de vérité

Lorsqu'un concept existe dans Vocabulary, sa définition fait autorité.

Les autres documents doivent référencer Vocabulary plutôt que recopier les définitions.

---

## Convention documentaire

Chaque concept documenté possède lorsque cela est pertinent :

* un nom métier ;
* un identifiant de code ;
* une implémentation de référence ;
* une source d'autorité.

---

# Concepts métier Polaris

| Concept                       | Code                              | Implémentation                                         | Autorité            | Notes                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------- | ------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attributs primaires           | `FOR/CON/COO/ADA/PER/INT/VOL/PRE` | `char_attributes`                                      | LdB                 | Force, Constitution, Coordination, Adaptation, Perception, Intelligence, Volonté, Présence — les 8 seuls attributs réels. `attr_1='CHC'` était un sentinel technique legacy (retiré migration 105, voir `is_category`).                                                                                               |
| Attributs Naturels            | NA / AN                           | `calcNA`/`calcAN` (`shared/polarisUtils.js`)           | Manuel (dérive LdB) | NA = base + mutations/mods, calculé dynamiquement des deux côtés (jamais stocké) — voir P55 zone de risque `bigint`-as-string.                                                                                                                                                                                        |
| Points de Compétence          | PC                                | `char_pc_ledger`, `char_careers.years×points_per_year` | LdB                 | Deux pools distincts par carrière : 10×années (compétences), 5×années (avantages pro) — voir `shared/careerSkills.js`/`careerAdvantages.js`.                                                                                                                                                                          |
| Seuil                         | —                                 | `combat_actions` (D20 ≤ Seuil = réussite)              | Enclume (UI)        | Jamais "CDR" dans l'UI joueur — CDR = terme de calcul interne uniquement.                                                                                                                                                                                                                                             |
| Corps à corps / Coup par coup | CaC / CC                          | `resolveMeleeAction` / `resolveAssaultAction`          | Enclume             | CaC = mêlée. CC = mode de tir "un coup" à distance — ne pas confondre les deux sigles.                                                                                                                                                                                                                                |
| Tir visé                      | —                                 | `shared/combatExclusiveActions.js` (`isAimEligible`)   | LdB p.227-228       | Action exclusive : sacrifice d'Initiative pour bonus au tir. **Ne pas confondre** avec Localisation précise (`COM9`, malus pour choisir la zone touchée, LdB p.229-230, ✅ codée) ni "Changer le mode de tir" (dette non implémentée) — trois règles voisines, déjà confondues deux fois en session (141 suite 11 et suite 17). |
| Localisation précise           | `COM9`                             | `combat_actions.aimed_location` (migration 164), `damageService.resolveTargetHit` (`forcedSlotCode`) | LdB p.229-230       | Malus au Test (Corps −3/Jambes −5/Tête+Bras −7) pour choisir la zone touchée au lieu du 1D20 aléatoire. Déclarée en ANNONCE (même patron que Tir visé), aucun coût d'Initiative. Zone très spécifique (−7 à −10) non gérée — discrétion MJ. Cumulable avec Tir visé (additif). Détail : `docs/Old/PLAN_TIRVISE v2.md`. |
| Mutations / Avantages         | —                                 | `char_mutations`, `char_advantages` (V2, migration 99) | LdB                 | Deux catalogues distincts convergeant vers le même moteur d'effet (jamais pleinement appliqué — voir `docs/PLAN_MUTATION2.md`, dette pré-existante).                                                                                                                                                                  |
| Dommages de Choc               | —                                 | `ref_equipment.shock` (arme) / `ammo_effects` `CHOC=` (munition) | LdB p.243 (arme, `docs/Character/Statuts/REGLESTATUT.txt:90-121`) + `docs/REGLES/REGLESMUNITIONS.md` (munition) | **3 catégories distinctes, ne jamais les confondre (confusion réelle vécue en concevant Lot B, `docs/PLAN_ARMES_DSL.md`)** : (1) **arme normale à `shock`** (lourde/contondante) — Choc **uniquement** sur coup en Tête, en plus du dégât physique, gate de localisation ; (2) **arme à Choc pur** (électrique) — aucun dégât physique, Choc partout, aucun gate ; (3) **munition spéciale** (Assommante/Explosive, DSL `CHOC=`) — dégât Choc **partout**, aucun gate de localisation, valeurs fixes par `REGLESMUNITIONS.md`. Les catégories 1/2 relèvent de la colonne arme `shock` (mécanique non construite, ferme `CHOC1` partiellement pour la mutation Corne — catégorie 1) ; la catégorie 3 relève du DSL munitions (Lot B). **Catégorie 3, confirmé Saar 2026-07-16** : le Choc n'est réduit ni par l'armure (`etq`/`prt`) ni par RD — Test de Choc "pur", sévérité dérivée du Choc brut seul (`_severityForDamage`), jamais combinée à la sévérité physique. Un seul Test de Choc par coup (physique et Choc peuvent chacun en réclamer un ; seule la pire sévérité des deux déclenche l'unique test). Dans les trois catégories : jamais de blessure physique créée par le Choc seul (dégâts virtuels), Test de Choc contre les seuils `seuil_etourdissement`/`seuil_inconscience`. |
| Bouclier                       | —                                 | `ref_equipment.category = 'Bouclier'` (Petit/Moyen/Grand, migration 168), `shared/armorConstants.js` (`HAND_TO_ARM_SLOT`) | `docs/REGLES/REGLEBOUCLIER.md` | Un seul objet, à la fois arme (occupe `MG`/`MD`) et armure (couvre le bras porteur + localisations fixes selon le palier — Petit : bras seul ; Moyen : bras+Corps ; Grand : bras+Corps+Tête, colonne `shield_extra_locations`). **Deux effets distincts, ne pas confondre avec une armure ordinaire** : (1) au contact, `shield_atk_malus` (−3/−5/−7) est un **malus au Test d'attaque de l'ADVERSAIRE**, pas un bonus au porteur ; (2) à distance, `protection` (colonne réutilisée, 10/10/15) fonctionne comme n'importe quelle protection localisée, y compris le Test de Chance RAW du Petit bouclier (`1d20 ≤ char_sheet.chc`) pour étendre la couverture à Corps/Tête. Directionnalité (inefficace de dos) explicitement **non automatisée** — jugement narratif MJ. Composition du slot composite (main + bras + localisations) faite uniquement côté serveur (`updateItem`), jamais par le client ni par `addItem`/`quickEquip` (qui ne gèrent qu'un slot atomique — un bouclier n'y est donc équipable qu'en pose manuelle post-ajout). Détail complet : `docs/PLAN_BOUCLIER.md`. |
| Retarder son Action            | `state_vitesse='delayed'`         | `triggerActNow`/`triggerDelayedPass` (`socketCombatHelpers.js`), `COMBAT_ACT_NOW`/`COMBAT_DELAYED_PASS` | LdB p.218, `docs/REGLES/REGLESYSCOMBAT.md:554-567` | Le personnage agit plus tard dans le Tour, jamais plus tôt (RAW : « n'importe quelle phase d'Action », mais toujours après sa propre phase d'Initiative d'origine). **Aucun minuteur** — « Agir maintenant » valable en continu dès que la Résolution atteint cette phase, jusqu'au tour obligatoire de fin de Tour si personne ne l'a déclenché avant (réponse explicite requise, Agir maintenant ou Passer, jamais d'expiration silencieuse). Ne jamais reporter d'un Tour à l'autre malgré le RAW littéral (choix maison, `docs/Old/PLAN_COMBAT_TIMELINE.md` §6 point 2). |
| Précipiter son Action          | `state_vitesse='rushed'`          | `iniDelta` (+3 INI / −5 Action), `socketCombatAnnouncement.js`         | LdB p.218-219 (optionnel), `docs/REGLES/REGLESYSCOMBAT.md:568-575` | Bonus d'Initiative immédiat contre malus au Test. Une Action précipitée ne peut jamais être retardée ensuite (guard RAW explicite). |
| Échelle de phases               | `combat_timeline_entries`         | `pickNextTimelineStep`/`advanceTimeline` (`socketCombatHelpers.js`)   | Enclume (architecture, dérive LdB p.212-219) | Remplace l'ancien parcours `combat_roster` trié par `active_slot_idx` (retiré) — une entrée par action complexe (Tir/CaC) déclarée, entrelacées par position réelle plutôt qu'un personnage résolvant tout son Tour d'un bloc. Détail complet : `docs/SYSTEME/COMBAT.md` § « Échelle de phases (Résolution) ». |
| Attaques multiples             | —                                 | `computeMultiAttackMalus`/`computeSeriesPositions` (`socketCombatHelpers.js`), `declaration_group_id` (`combat_timeline_entries`) | LdB p.218-219, `docs/REGLES/REGLESYSCOMBAT.md:604-618` | Règle générique (« Effectuer plusieurs Attaques par Tour ») : jusqu'à 3 Attaques par Tour, malus -5 (2)/-7 (3) à toutes les Attaques du Tour, décalage de phase -5/-10 par attaque supplémentaire (seul coût RAW chiffré — pas de forfait Initiative de déclaration séparé). Cibles distinctes non exigées par le texte. **Deux implémentations distinctes de la même mécanique** : **CaC 4b** (déjà en production depuis la Session 74, jamais documenté avant ce jour — dette rétroactive comblée ici) et **Tir Multi** (✅ clos Session 165, Tir simple/Tir à répétition CC uniquement, PJ/PNJ humanoïde, jamais RC/RL ni tireur-drone — détail complet `docs/SYSTEME/COMBAT.md` § « Attaques multiples — CaC 4b et Tir Multi », historique `docs/Old/PLAN_TIRMULTI.md`). CaC et Tir sont mutuellement exclusifs à la déclaration (une seule Action de combat par Tour) — jamais cumulables entre eux ni avec Tir visé/Tir à deux armes/Viser une Localisation. **Ne pas confondre** avec « Rafale longue sur plusieurs adversaires » (p.228, mécanique de rafale distincte, formule de malus différente, stub `rl_mc` non câblé) ni « Combat à deux armes / dual-wield » (p.223, deux tirs simultanés d'armes différentes, déjà livré) — même risque de confusion que Tir visé/Localisation précise déjà rencontré deux fois en session. |
| Revers                         | —                                 | `ref_setbacks`, `shared/careerSetbacks.js`, `shared/setbackEffects.js` | LdB (`docs/Character/Creation/REGLE_CREATION.txt:1190-1199`) | Table de malus aléatoire (jet 1D100, 27 entrées partagées) pour un personnage expérimenté : tous les 3 ans au-delà de la 10e année d'expérience cumulée, toutes carrières confondues (obligatoire, pas de refus). **Nom interne du code toujours "setback" (anglais)** — `ref_setbacks`, `getSetbackBlockCount`, `resolveSetback`, `resolveSetbackEffects` — **nom joueur/UI toujours "Revers" (français)**, jamais l'inverse (voir Ambiguïtés connues). Mécanique distincte du Tirage 1D10 des Avantages professionnels aléatoires (par carrière, optionnel, table à valeur exacte et non à plages) — voisines mais jamais interchangeables, détail complet `docs/PLAN_WIZARD_AVANTAGES.md`. |

---

# Concepts Enclume

Concepts n'existant pas dans Polaris mais créés par le projet.

| Concept | Description | Implémentation |
| ------- | ----------- | -------------- |
| Coffre | Espace de stockage de personnages hors campagne, transfert = copie jamais déplacement. **Jamais "Vault" côté UI/texte joueur** — "Vault" reste le nom de code interne (`vaultService.js`, `vaults` table). | `server/src/services/vaultService.js`, `docs/Old/PLAN_VAULT.md` |
| `reconcileCreation` | Endpoint unique et idempotent du Wizard (remplace l'ancien `finalizeCreation`) — accepte un payload partiel `{step1..step5, finalize}`, rejouable à volonté tant que `wizard_locked_at` n'est pas posé. | `server/src/services/creationService.js`, `routes/creation.js` |
| `wizard_locked_at` | Marque la bascule "fiche assistant (rejouable)" → "fiche runtime (éditable librement en jeu)". | `char_sheet.wizard_locked_at` (migration 119) |
| Actions Exclusives (registre) | Pattern générique pour une action qui interdit toute autre action/transition d'état le même tour (ex. Tir visé). Extensible (Charge/Rafale longue à venir). | `shared/combatExclusiveActions.js` (`isExclusiveDeclaration`) |
| DSL effets munitions | Syntaxe `TYPE=ACTION(VALEUR)` stockée dans `ref_equipment.ammo_effects` (uniquement `family='Munitions'`), encode les variantes de dégâts/Choc/tags par type de munition transcrites du Livre de Base. Non encore parsée en combat — Chantier 11 Étape 2, voir `docs/PLAN_ARMES_DSL.md`. | `server/src/db/migrations/48_ref_equipment.js` (colonne) |
| Échange | **Terme déjà établi**, pas une invention de Session 151 — déplacement d'un item ou d'un montant de sols entre deux personnages appartenant à des joueurs différents, avec acceptation du destinataire (double validation). Système complet déjà livré Sessions 124-141 (`docs/Old/PLAN_TRADE.md`, archivé = chantier clos) : `server/src/services/tradeService.js`, `socketTrade.js`, table `trade_offers`, UI `ExchangeWindow.jsx` + secteur `echange` de `TokenRadialMenu.jsx`. **Erreur de Session 151** : un plan (`docs/PLAN_ECHANGE.md`) et un service (`echangeService.js`) ont été conçus en double avant de découvrir ce système — `docs/ROADMAP.md` listait encore Chantier 10 Sprint 6 comme 🔲 alors que l'échange PJ↔PJ était déjà fait sous un autre nom de chantier ("PLAN_TRADE"), non trouvé faute d'avoir cherché dans `docs/Old/` avant de concevoir. **Jamais "Transfert"** — ce mot désigne la copie Coffre→campagne (voir entrée Coffre). Un déplacement entre personnages du **même** joueur (ex. drone→PJ propriétaire, `trade:drone_transfer`) reste un déplacement direct, hors du circuit Échange à double validation. | `server/src/services/tradeService.js`, `docs/Old/PLAN_TRADE.md` |
| Accès vertical | Assemblage structurel posé depuis la bibliothèque 3D : une trémie et une échelle latérale, complétées facultativement par une trappe. La composition choisit seulement **Échelle seule** ou **Échelle + Trappe** ; la forme ronde/carrée et le mécanisme appartiennent au modèle de trappe. La trémie porte l'ouverture et le raccord aux passerelles ; la trappe ne conditionne donc ni l'existence du palier haut ni son raccordement. | `surface_data.connectors` (`ladder`, `hatch`) et `shared/world/worldCompiler.js` |
| Charge électrique | Munition générique (`family='Munitions'`, `category='Charges électriques'`, `caliber='Charge électrique'`) pour les armes à batterie sans calibre réel (armes de contact à charge + armes étourdissantes/soniques — Matraque Mao et 18 autres, `docs/PLAN_CAC_BATTERIE.md` Lot A). `caliber` reste le seul champ de liaison arme/munition du projet (`docs/Old/JARMES.md` §2.5) — aucune colonne/FK nouvelle, juste une valeur de plus. **Hors scope volontaire** (Lots B/C/D du même plan, non traités) : armes à durée ("1 heure"/"1h de gaz"), armes de trait (déjà liées à Flèche/Carreau), lanceurs (Capsule/disque/filet dédiés). **Ne pas confondre avec `GP-*`** (`GP-A1`…`GP-D4`) — classification des sources d'énergie de **drones** (`docs/REGLES/REGLEDRONE.md`), réutilisée séparément pour les 13 armes à énergie + Poing Kryss (déjà câblées, domaine distinct). | `server/src/db/migrations/178_ammo_charge_electrique.js`, `docs/PLAN_CAC_BATTERIE.md` |
| Vocabulaire d'effets (`effects[]`) | Taxonomie JSONB commune encodant les conséquences mécaniques d'un résultat de tirage : `attribute`/`celebrity`/`skill_points`/`category`/`income_percent`/`income_multiplier`/`income_multiplier_permanent`/`trait`/`celebrity_reward`/`money_reward`/`grant_mutation`/`grant_advantage`/`choice`/`manual_grant_choice`/`points_cap`/`narrative` (+ `chained_setback`/`subroll`/`apply_setback`/`reroll_table`, propres aux Revers). Partagée par les Avantages professionnels aléatoires ET les Revers — deux tables différentes, un seul vocabulaire d'effets. Avant d'inventer un nouveau type pour une future table à tirage (mutation, événement aléatoire...), vérifier si un type existant convient déjà. | `shared/careerAdvantages.js` (`resolveCareerRandomEffects`), `shared/setbackEffects.js` (`resolveSetbackEffects`) — liste complète et exemples réels : `docs/PLAN_WIZARD_AVANTAGES.md` §8.1. |
| Provenance des octrois (`acquired_during`/`source`) | Chaque table d'octroi porte une colonne qui distingue POURQUOI/QUAND l'entrée a été créée — indispensable pour qu'une réconciliation (wipe-and-reinsert, ex. `reconcileCreation`) sache quel sous-ensemble de lignes elle a le droit d'effacer sans toucher aux octrois d'un autre bloc/moment. Valeurs : `char_advantages.acquired_during` ∈ `creation_step5`/`campaign`/`revers`/`adjustment` ; `char_mutations.source` ∈ `chosen`/`random`/`campaign`/`revers` (migration 192). **Piège vécu** : `char_mutations.source` est verrouillé par une contrainte CHECK en base (migration 125) — `char_advantages.acquired_during` n'a AUCUNE contrainte équivalente (juste un commentaire de colonne, migration 99). Ne jamais supposer une symétrie entre deux colonnes jumelles sans vérifier le schéma réel de chacune. | `server/src/db/migrations/99_char_advantages_v2.js`, `125_char_mutations_source_campaign.js`, `192_*` |
| Transaction optionnelle (`trxOpt`) | Une fonction de service qui doit pouvoir soit ouvrir sa propre transaction (appel isolé) soit participer à une transaction déjà ouverte par l'appelant (ex. `reconcileCreation`) prend un dernier paramètre optionnel `trxOpt` : `return trxOpt ? run(trxOpt) : db.transaction(run)`. Sans ce patron, un rollback plus tard dans la transaction englobante ne défait pas un octroi déjà commité isolément par cette fonction. | `mutationService.addMutation`, `advantageService.grantAdvantage`, `lockWizard` (`creationService.js`) |

---

# Conventions de nommage

Détail complet → `.claude/rules/conventions.md` + `docs/SYSTEME/CONVENTIONS.md` (ne pas dupliquer ici).

## Database
Tables/colonnes en `snake_case`. Migrations numérotées séquentiellement (`server/src/db/migrations/`).

## Backend
Pattern `routes/*.js` (HTTP) → `services/*Service.js` (logique) → `db` (knex). Events WebSocket définis une seule fois dans `shared/events.js`.

## Frontend
Composants `PascalCase.jsx`. State inter-étapes/inter-composants → Zustand (jamais de state local dupliqué quand un store existe).

## WebSocket
Constantes `SCREAMING_SNAKE_CASE` dans `shared/events.js` — vérifier existence avant de créer un nouvel event.

---

# Pièges historiques

Anciennes conventions encore présentes dans le code.

| Ancien | Officiel | Pourquoi |
| ------ | -------- | -------- |
| `token.owner_id` | `token.character_id → characters.user_id` | `owner_id` n'a jamais été la bonne chaîne de résolution — voir P1 (`CLAUDE.md`). |
| `char_advantages` V1 (texte libre, pré-migration 99) | `char_advantages` V2 (FK catalogue `ref_advantages`) | Schéma strict depuis migration 99 — tout code lisant `adv.label`/`adv.level` lit des champs V1 inexistants en V2 (bug réel trouvé Session 141 suite 7). |
| `ref_equipment_skills` | `ref_equipment_skill_assoc` | Tables jumelles au schéma identique, rôles différents — voir Ambiguïtés connues ci-dessous. Ne jamais les confondre lors d'une requête combat. |
| `active_slot_idx` / `advanceSlot` / `COMBAT_SLOT_ADVANCED` en Résolution | `combat_timeline_entries` / `advanceTimeline` / `COMBAT_TIMELINE_UPDATED` | Colonne et fonction retirées (migration 174, Session 159) — la Résolution parcourt l'échelle de phases, plus une liste `combat_roster` triée. `COMBAT_SLOT_ADVANCED` reste émis, mais uniquement en phase ANNONCE. |
| Sous-état FSM `AWAITING_REACTION_WINDOW` (minuteur, Lot B) | Borne de position sur `SLOT_ACTIVE` (`triggerActNow`) | Ajouté puis retiré la même session (159) — RAW ne prévoit aucun minuteur pour Retarder ; source de 3 bugs réels en une journée avant son retrait. Voir `docs/Old/PLAN_COMBAT_TIMELINE.md` §6ter point 3 (trace historique, ne pas réimplémenter). |

---

# Ambiguïtés connues

| Nom | Ne pas confondre avec | Explication |
| --- | --------------------- | ----------- |
| `ref_equipment_skill_assoc` | `ref_equipment_skills` | `_assoc` = "compétence d'utilisation" pour résoudre un Test de combat (`resolveAssaultAction`/`resolveMeleeAction`, bien vivante). `ref_equipment_skills` = "compétences boostées/requises" par un accessoire (jamais consommée en jeu, dette `[EQSKILLS1]`). Confusion réelle vécue Session 141 (suite 16). |
| Tir visé | Localisation précise (`COM9`) / Changer le mode de tir | Voir entrée Concepts métier Polaris ci-dessus — trois mécaniques distinctes de `REGLESYSCOMBAT.md`, jamais la même règle malgré la proximité des pages. |
| "Seuil" (UI) | "CDR" (interne) | Même valeur, deux noms selon l'audience — ne jamais afficher "CDR" à un joueur. |
| Vault (nom de code) | Coffre (nom produit) | Le code/DB garde `vault*`, tout texte utilisateur dit "Coffre". |
| "Coma" (`docs/ROADMAP.md` Chantier 11 Étape 4) | "Inconscient" (statut réel) | Synonyme informel, pas un 3ᵉ état santé — `token_statuses.status_code` ne connaît que `stunned`/`unconscious` (`statusService.js`). Confirmé Saar 2026-07-16. |
| PLAN (dossier `docs/`) | DOMAIN/SYSTEM (`docs/SYSTEME/`) | Un PLAN est temporaire (`docs/RegleDocumentaire.md` Règle 10) : une fois le chantier clos, archiver vers `docs/Old/` — la doc durable vit dans `docs/SYSTEME/*.md`/`.claude/rules/`, pas dans le PLAN. |
| Échange (PJ↔PJ) | Transfert (Coffre→campagne) | Deux mots différents pour deux mécaniques différentes, déjà en place toutes les deux : Échange (`tradeService.js`, sessions 124-141) = déplacement réel entre personnages vivants, double validation, jamais de copie. Transfert (`vaultService.js`, session 110) = copie Coffre→campagne, jamais de déplacement, validation MJ seule. Ne jamais employer l'un pour l'autre dans le code ou l'UI. |
| `PLAN_ECHANGE.md` (Session 151) | `PLAN_TRADE.md` (`docs/Old/`, sessions 124-141) | **Doublon découvert en Session 151** : le système Échange PJ↔PJ existait déjà avant que `PLAN_ECHANGE.md` soit écrit — chercher dans `docs/Old/` avant de concevoir un nouveau plan, pas seulement dans `docs/ROADMAP.md`/`docs/EN_COURS.md`. |
| `ref_setbacks` / "setback" (code) | Revers (UI/joueur) | Même mécanique, deux noms selon l'audience — comme Vault/Coffre. Le code et la base gardent l'anglais "setback" (`ref_setbacks`, `getSetbackBlockCount`, `resolveSetback`), tout texte utilisateur dit "Revers". La valeur de provenance `acquired_during`/`source = 'revers'` (voir Concepts Enclume) suit la même convention que l'UI, pas que le code — décidé ainsi pour ne pas introduire un 3e synonyme interne (`trauma`), cf. chantier Avantages/Revers, 2026-07-22. |

---

# Acronymes

| Acronyme | Signification |
| -------- | -------------- |
| LdB | Livre de Base Polaris |
| PJ / PNJ | Personnage Joueur / Personnage Non-Joueur |
| MJ / GM | Meneur de Jeu / Game Master (synonymes dans ce projet) |
| CaC / CC | Corps à corps / Coup par coup |
| NA / AN | Niveau Actuel / Niveau de Base (attribut) |
| PC | Points de Compétence / Points de Carrière (contexte-dépendant, voir Concepts métier Polaris) |
| SR | Serveur Redémarré (sans erreur) |
| FEAT / COM / OPT / ADV / EQSKILLS / WIZ / DOC | Préfixes d'identifiants de dette/feature dans `docs/BUGIDENTIFIE.md` et `CLAUDE.md` |

---

# Sources

* Livre de Base Polaris
* FOUNDATION
* ADR
