# GLOSSAIRE.md — Termes RPG Polaris ↔ identifiants code Enclume
> Créé session 64 — source unique pour éviter les confusions identifiant/terme métier

---

## Termes RPG Polaris → code

| Terme Polaris (LdB) | Identifiant code | Où | Notes |
|---|---|---|---|
| Caractéristique / Attribut | `attr_id` (TEXT) | `char_attributes` | ex. `'FOR'`, `'CON'`, `'COO'`, `'ADA'`, `'PER'`, `'INT'`, `'VOL'`, `'PRE'` |
| Niveau Actuel (NA) | `naMap[attrId]` | charStats.js | `base_level + pc_modifier + mod_genotype` (plancher 3) |
| Attribut de Niveau (AN) | `anMap[attrId]` | charStats.js | `calcAN(na)` — table officielle Polaris |
| Compétence | `skill_id` (TEXT) | `ref_skills`, `char_skills` | ex. `'ARMES_POING'`, `'TIR_AUTOMATIQUE'` |
| Maîtrise | `mastery` (INT) | `char_skills` | bonus flat ajouté au total compétence |
| Compétence acquise | `is_learned` (BOOL) | `char_skills` | compétences coûtant XP non disponibles si false |
| Total Compétence | `skillTotal` | calcSkillTotal() | AN(attr_1) + AN(attr_2) + mastery |
| CDR (Chances De Réussite) | `chancesDeReussite` | socket/index.js | skillTotal + totalDiffMod + effectiveMalus |
| MR (Marge de Réussite) | `mr` | resolveEntityMove | `chancesDeReussite - diceRoll` (positif = réussite, négatif = échec) |
| Succès / isSuccess | `isSuccess` (BOOL) | partout | `diceRoll <= chancesDeReussite` — JAMAIS `>=` |
| Modificateur difficulté | `difficulty_dc` (INT) | `ref_entity_states`, combat | signé (-20 à +10), jamais valeur absolue (LdB p.404) |
| Malus blessures | `woundPenalty` | calcWoundPenalty() | ≤ 0 — pire blessure seule (non-cumulatif, LdB p.236) |
| Malus encombrement | `encumbrancePenalty` | calcEncumbrancePenalty() | ≥ 0 — règle maison (cumulatif) |
| Malus effectif | `effectiveMalus` | socket/index.js | `woundPenalty - encumbrancePenalty` — toujours ≤ 0 |
| Génotype | `genotype_id` (TEXT) | `char_archetype`, `ref_genotypes` | ex. `'HUMAIN'`, `'SERAPHIM'` — modificateurs d'attributs |
| ETQ | ETQ | charStats.js | Endurance Total quotidien (résistance armure) |
| PRT | PRT | charStats.js | Protection (réduction dommages armure) |
| RD (Résistance aux Dommages) | `rd` | calcResistanceDommages() | `calcResistanceDommages(forNA, conNA)` |
| Sévérité blessure | `severity` (TEXT) | `character_wounds` | `WOUND_SEVERITIES` dans woundConstants.js |
| Localisation blessure | `wound_location` (TEXT) | `character_wounds` | `'tete'`, `'corps'`, `'bras_gauche'`, etc. |
| Code slot armure | `slotCode` (TEXT) | armorConstants.js | `'T'`, `'C'`, `'BG'`, `'BD'`, `'JG'`, `'JD'` |
| Code localisation catalogue | `refCode` (TEXT) | armorConstants.js | `'T'`, `'C'`, `'B'`, `'J'` — pour lookup `ref_location` |
| Sols (monnaie) | `sols` | `char_sheet.sols`, route `/sols` | monnaie du jeu |
| CHC (Chance de base) | `chc` | `char_sheet.chc` | attribut spécial |
| Test de Choc | `shock_test_required` | `character_wounds` | test après blessure grave — BOOL sur la wound |
| Carence armure | `calcCarenceArmure()` | charStats.js | malus si FOR insuffisante pour porter l'armure |
| Seuil étourdissement | `etourdissement` | calcSeuils() | seuil en RD en dessous duquel le perso est étourdi |
| Seuil inconscience | `inconscience` | calcSeuils() | seuil en RD en dessous duquel le perso perd conscience |
| Mille-feuille | `calcMillefeuille()` | client uniquement | ETQ/PRT cumulés multi-couches : max + reste/2 |
| REA (Réactivité) | `base_ini` | combat_roster, calcREA() | `round((ADA + PER) / 2)` — initiative de base combat |
| Allure | `allures` | calcAllures() | `{ lente, moyenne, rapide, max }` — distances de déplacement en voxels |
| Mode de tir | `fire_mode` | `combat_actions.fire_mode` | `'CC'` (Coup par coup) / `'RC'` (Rafale courte) / `'RL'` (Rafale longue) |
| Initiative | `initiative` | `combat_roster.initiative` | `base_ini` + éventuellement `surprise_roll` pour PNJ surpris |

---

## Identifiants techniques — ambiguïtés documentées

| Identifiant | Quoi | À ne pas confondre avec |
|---|---|---|
| `char_inventory.id` | UUID de l'item dans l'inventaire du personnage | `ref_equipment.id` (ID du type d'équipement catalogue) |
| `weapon_inv_id` | = `char_inventory.id` — pointe vers un item de l'inventaire | Pas un FK vers `ref_equipment` |
| `ref_equipment_skill_assoc.item_id` | FK vers `ref_equipment.id` — type d'arme | PAS `char_inventory.id` — confusion = BUG skillTotal=0 |
| `char_inventory.equipment_id` | FK vers `ref_equipment.id` — permet le lien inventaire→catalogue | `char_inventory.id` |
| `token.character_id` | FK vers `characters.id` — ownership du token | `token.owner_id` (mort — ne jamais utiliser) |
| `pos_x / pos_y / pos_z` (DB) | PE14 : `pos_y`=profondeur (Z Three.js), `pos_z`=altitude (Y Three.js) | Three.js : Y=altitude, Z=profondeur — ordre inversé |
| `state_character` | JSONB flags booléens sur `combat_roster` (is_rushed, is_stunned…) | `state_position` (TEXT enum standing/crouching/prone) |
| `state_weapon` | TEXT enum holstered/ready/drawn sur `combat_roster` | `state_character` JSONB |
| `skill_id` | ID texte de la compétence dans `ref_skills` | `char_skills.id` (UUID de la ligne de compétence du perso) |
| `blueprint.id` | UUID du blueprint dans `entity_blueprints` | `entity.blueprint_id` (FK vers le blueprint) |
| `entity.id` | UUID de l'instance d'entité sur la carte | `blueprint.id` (le modèle) |
| `voxel_textures.id` | INTEGER (exception UUID — P22) | Tous les autres IDs = UUID |
| `battlemap_id` | UUID de la battlemap (carte) | `campaign_id` (UUID de la campagne — parent) |
| `combat_roster.token_id` | FK vers `tokens.id` — seule FK identité du roster | Pour obtenir le `character_id` : `roster.token_id → tokens.character_id` (pas de colonne directe) |
| `action.weapon_inv_id` | `char_inventory.id` de l'arme — stocké dans `combat_actions` | Ne pas utiliser directement pour `ref_equipment_skill_assoc` — passer par `char_inventory.equipment_id` |
| `combat_actions.fire_mode` | Mode de tir utilisé dans l'action déclarée — `'CC'`/`'RC'`/`'RL'` (majuscules) | `combat_roster.state_fire_mode` = mode courant du combattant — `'cc'`/`'rc'`/`'rl'` (minuscules, migration 58) |

---

## Termes projet / abréviations courantes

| Terme | Signification |
|---|---|
| VTT | Virtual Tabletop — logiciel de jeu de rôle en ligne |
| GM | Game Master — maître du jeu |
| PJ | Personnage Joueur (`character.type = 'pj'`) |
| PNJ | Personnage Non Joueur (`character.type = 'pnj'`) |
| Entité | Élément de décor interactif — porte, console, etc. (`!token.character_id`) |
| Token | Pion sur la carte — peut représenter un PJ, PNJ, ou entité |
| Blueprint | Modèle d'entité (apparence + comportement) dans `entity_blueprints` |
| SR | Serveur Redémarré (convention communication — indique que le serveur tourne sans erreur) |
| LdB | Livre de Base Polaris — référence des règles |
| PE14 | Inversion coordonnées DB/Three.js — convention fondamentale du projet |
| DICE_RESULT | Événement WS résultat de jet — payload enrichi (voir DICE.md) |
| COMBAT_DAMAGE_PROMPT | Événement WS — invite le tireur PJ à lancer ses dés de dégâts |
| COMBAT_DAMAGE_CONFIRM | Événement WS — le tireur PJ confirme le lancer |
| COMBAT_DAMAGE_RESULT | Événement WS — résultats complets pour affichage fenêtre |
| COMBAT_ATTACK_PLAYER_RESULT | Événement WS — résultat toucher/raté vers socket tireur PJ uniquement |
| CAMPAIGN_SETTINGS_UPDATED | Événement WS serveur→room — propagation live des paramètres campagne (action_timer_sec, shock_auto_stun, etc.) — Session 85 |
