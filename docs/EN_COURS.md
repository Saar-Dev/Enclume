# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-05-26 Session 65

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Chantier 9A — Refonte voxel ✅
### Chantier 9B — Interface CRUD texture packs ✅
### Chantier 9C — Système entités interactables ✅
### Chantier 9D — Atelier du GM ✅
### Chantier 9E — Entités en session ✅ (session 36)
### Chantier 9F-0 — Calcul serveur Polaris ✅ (session 36)
### Chantier 9F-A — Fondations mouvement ✅ (session 39)
### Chantier 9F-B1 — Déplacement entités serveur + atelier ✅ (session 40)
### Chantier 9F-B2 — Mode visée client ✅ (session 41)
### Chantier 9F-C — Diagonal 45° + animation Lerp ✅ (session 43)
### Chantier Dice Rework ✅ (session 44)
### Chantier 10 sprint 1 — ref_equipment ✅ (sessions 46-47)

Travaux effectués en sessions 46-47 :
- Schéma `ref_equipment` défini champ par champ avec Saar ✅
- Migration 48 : `ref_equipment` + 3 junction tables + 6 CHECK constraints ✅
- Route API `/api/equipment` (CRUD complet + transaction) ✅
- Page admin standalone `localhost:3001/equipment-admin.html` ✅
  - Saisie rapide YAML (33 alias courts, js-yaml CDN)
  - Presets catégories (Arme / Protection / Munition / Conteneur / Divers)
  - Multi-select compétences groupées par famille

Travaux effectués en session 48 :
- Seed `2_seed_equipment.js` — 636 items injectés (KO-par-défaut, garde name idempotent) ✅
- `diff_equip.mjs` — outil diff BDD vs STEP1, réutilisable ✅
- Vérification post-seed : 23 divergences acceptées (corrections intentionnelles vs livre de règles) ✅
- Junction tables skills : enrichissement manuel en cours

### Chantier 11 sprint 1 — Module Blessures ✅ (session 49)
### PC22 — Fix 403 toggle is_learned MUTATION/POLARIS ✅ (session 50)

Travaux effectués en session 49 :
- `shared/woundConstants.js` — source de vérité partagée (LOCATIONS, SEVERITIES, MAX_COUNTS, PENALTIES) ✅
- Migration 49 : `character_wounds` (UUID PK, FK char_sheet CASCADE, CHECK constraints SQL) ✅
- `char-sheet.js` — refactorisé avec `router.param` + 4 routes blessures + broadcasts WS ✅
- `charStats.js` — `calcWoundPenalty()` ajoutée ✅
- `WoundManager.jsx` — composant autonome (grille fixe, clic POST/PUT/DELETE, promotion transparente) ✅
- Onglet "Matériel" dans CharacterWindow ✅

---

## Prochaines tâches

### Chantier 10 sprint 2 — char_inventory ✅ (session 51)

Travaux effectués en session 51 :
- Migration 50 : `char_inventory` + `char_sheet.sols` ✅
- `calcEncumbrancePenalty()` dans `charStats.js` ✅
- 5 routes inventaire + route sols dans `char-sheet.js` ✅
- `InventoryPanel.jsx` — affichage + edit GM (ajout depuis catalogue, équipement, suppression) ✅
- Montage dans `CharacterWindow.jsx` onglet Matériel sous WoundManager ✅

### Chantier 11 suite — Intégration malus blessures dans calculs Polaris ✅ (session 52)

Travaux effectués en session 52 :
- `GET /wounds` enrichi avec `wound_penalty` calculé côté serveur ✅
- `CharacterSheet.jsx` — Initiative effective avec tooltip `position:fixed` ✅
- `socket/index.js` — `effectiveMalus` dans `chancesDeReussite` (jets réels) ✅
- Règle documentée : malus santé non-cumulatif (pire seul) + encombrement cumulatif (règle maison)

### Chantier 10 sprint 3 — Armures multi-couches + codes slots indépendants ✅ (session 54)
### Chantier 10 sprint 4 — Module Armes équipées ✅ (session 55)

Travaux effectués en session 54 :
- Problème : `LOCATION_TO_SLOT` mappait bras_gauche + bras_droit → 'B', jambe_gauche + jambe_droite → 'J' → équiper à l'un affichait partout
- Solution : codes distincts BG/BD/JG/JD (localisation indépendante)
- `shared/armorConstants.js` — LOCATION_TO_SLOT + nouveau SLOT_TO_REF_LOCATION (mapping compat ref_equipment) ✅
- `LocationPanel.jsx` — `refCode` pour lookup ref_location, equip/unequip indépendant par slotCode ✅
- `char-sheet.js` — VALID_SLOTS + BASE_ARMOR + POST/PUT LIKE queries (multi-slot) ✅
- Migration 51 — nullifie slots B/J stales via regex `(^|/)(B|J)(/|$)` ✅
- ref_equipment.location intouché — mapping client gère la compat
- Test : Pagan équipée indépendamment à Tête+Bras+Jambes ✅

Travaux effectués en session 55 :
- Migration 52 : `char_inventory.current_ammo UUID FK ref_equipment.id SET NULL` ✅
- Migration 53 : fusions doublons munitions (11 groupes) + renommages 89 entrées ✅
- `WeaponPanel.jsx` (NEW) : armes 1M équipées, stats DMG/CHC/PTÉ/TIR/CAL, munitions, rechargement, équipement ✅
- `char-sheet.js` : WEAPON_SLOTS, +6 SELECT champs arme/munition, POST/PUT weapon branch + current_ammo caliber validation ✅
- `InventoryPanel.jsx` : VALID_SLOTS bug fix (codes BG/BD/JG/JD/MG/MD/2M/Tr) ✅
- `WeaponPanel` monté dans `CharacterWindow` entre ArmorWoundPanel et InventoryPanel ✅
- Tri munitions "standard" en premier dans availableAmmoFor ✅

### Chantier 10 sprint 5 — Mille-feuille serveur + polarisRound unifié + ref_min_str ✅ (session 56)
### Chantier 11 Sprint 1 — Fondations + COMBAT_START/END ✅ (session 57)

Travaux effectués en session 56 :
- `shared/polarisUtils.js` (NOUVEAU) — source unique `polarisRound(x) = Math.floor(x + 0.4)` ✅
- `server/src/lib/charStats.js` — import depuis shared, def locale supprimée, + `calcResistanceArmure` + `calcCarenceArmure` ✅
- `client/src/character/CharacterSheet.jsx` — import depuis shared, const locale supprimée ✅
- `client/src/character/LocationPanel.jsx` — import depuis shared, `calcMillefeuille` utilise polarisRound ✅
- `server/src/routes/character/char-sheet.js` — `ref_min_str` dans les 2 SELECT GET /inventory ✅
- Affichage carence FOR (rouge si FOR < min_str) reporté Chantier 11 sprint 3 (nécessite forNA dans ArmorWoundPanel)

Travaux effectués en session 57 :
- Migration 54 : `combat_state` + `combat_roster` + `combat_actions` ✅
- `shared/events.js` : +17 constantes COMBAT_* ✅
- `client/src/stores/combatStore.js` (NOUVEAU) ✅
- `client/src/components/CombatOverlay.jsx` (NOUVEAU) ✅
- `client/src/components/CombatRosterWindow.jsx` (NOUVEAU) — INI preview + surpris + exclusion participants ✅
- `server/src/routes/battlemaps.js` : `GET /:id/combat-ini` ✅
- `server/src/socket/index.js` : combatTimers + calcREA import + COMBAT_START/END + SESSION_JOIN sync ✅
- `client/src/pages/SessionPage.jsx` : PC15 bypass + handleCombatToggle + bouton ⚔ gmBar + handlers COMBAT_* + CombatOverlay ✅

---

### Chantier 11 Sprint 2 — Surprise + Phase Annonce ✅ (sessions 58-59)

Travaux effectués en session 58 :
- `client/src/components/CombatTimeline.jsx` (NOUVEAU) — timeline INI, portraits cliquables GM, topOffset ✅
- `client/src/components/CombatActionWindow.jsx` (NOUVEAU) — déclaration PJ (grille 4 actions, précipité), états surprise ✅
- `client/src/components/CombatPnjPanel.jsx` (NOUVEAU) — modal GM PJs/PNJs read-only, bouton Passer ✅
- `client/src/components/CombatGmDeclareWindow.jsx` (NOUVEAU) — fenêtre GM bottom-right déclaration PNJs ✅
- `server/src/socket/index.js` : COMBAT_SURPRISE_RESULT + COMBAT_ACTION_DECLARE (PC26 ini_mod) + COMBAT_SKIP_PLAYER ✅
- Fix formule surprise : `isSuccess = roll ≤ base_ini`, initiative = roll (succès) ou 0 (échec) ✅

Travaux effectués en session 59 (architecture) :
- Migration 55 : `characters.type TEXT NOT NULL DEFAULT 'pnj'` + backfill `user_id IS NOT NULL → 'pj'` ✅
- `server/src/routes/characters.js` : `type` dans GET colonnes + POST insert/returning + PUT sync user_id + broadcastCharacterUpdate ✅
- `server/src/socket/index.js` : COMBAT_START filtre Entités (`!character_id → continue`), `is_pnj = character?.type === 'pnj'` ✅
- `server/src/socket/index.js` : COMBAT_ACTION_DECLARE — `character.type` pour guard PJ/PNJ, Entité exclue ✅
- `CombatGmDeclareWindow` + `CombatPnjPanel` : `isPnj` via `char?.type === 'pnj'`, props `user`/`gmUserId` supprimés ✅

Travaux effectués en session 59 (suite) — Rework Phase Annonce :
- `client/src/components/combatSections.js` (NOUVEAU) — source unique `SECTIONS` + `KEY_MOD` + `formatMod` partagés ✅
- `client/src/components/CombatActionWindow.jsx` — refonte : 4 sections, 21 items (8 actifs/13 grisés), multi-select, INI total, `selectedKeys[]` payload ✅
- `client/src/components/CombatGmDeclareWindow.jsx` — refonte : accordion always-one-open, auto-progression après déclaration, même liste complète que joueur ✅
- `server/src/socket/index.js` : COMBAT_ACTION_DECLARE — nouveau payload `selectedKeys[]`, `KEY_MOD` dict, `primaryType` dérivé, `modifiers JSONB` ✅

**Bug ouvert (non bloquant) :**
- Surprise critique (roll=1) → initiative=1 (agit en dernier). Sémantique roll surpris à revoir.

---

### Chantier 11 Sprint 2.5 — Centrage caméra combat ✅ (session 61)
### Chantier 11 Sprint 4 — UI Déplacement combat ✅ (session 61)

Travaux effectués en session 61 :
- `shared/polarisUtils.js` : calcAN + calcAllureMoy + calcAllures (exports partagés PI11) ✅
- `client/src/character/CharacterSheet.jsx` : import shared — déf locales supprimées ✅
- `client/src/components/combatSections.js` : move_short/move_long → isMove item unique ✅
- `client/src/components/CombatActionWindow.jsx` : fetch allures, mode déplacement, inMoveMode, moveSelection ✅
- `client/src/components/CombatOverlay.jsx` : légende allures + ZONE_DEFS + Valider/Changer/Annuler ✅
- `client/src/components/Canvas3D.jsx` : anneaux 4 zones PE34, cursor, combatMoveModeRef, onPendingMove ✅
- `client/src/pages/SessionPage.jsx` : combatMoveMode + pendingMoveSelection + handlers ✅
- Correction PE34 : altitude anneaux `pos_z + 1.0` (pieds token, pas centre voxel) ✅

**Validé joueur ✅ — GM/PNJ déplacement reporté Sprint 4.1**

---

### Chantier 11 Sprint 4.1 — Généralisation zones[] + micro_grab ✅ (session 61 suite)

Travaux effectués :
- `combatSections.js` : MOVE_ZONE_DEFS export, micro_grab_close+micro_grab_far fusionnés en micro_grab (3 zones statiques), isZoneSelect, KEY_MOD nettoyé ✅
- `CombatActionWindow.jsx` : handleZoneSelectClick(item), toggle-deselect, moveSelection.sourceKey ✅
- `SessionPage.jsx` : zones[] dans handleEnterMoveMode + combatMoveMode ✅
- `Canvas3D.jsx` : rings zones.map, zone-click zones.find, cursor altitude PE34 corrigée ✅
- `CombatOverlay.jsx` : ZONE_DEFS supprimé, iterate zones directement ✅

**Limitations acceptées v1 :**
- Zones euclidiennes (pas de pathfinding) — inexact en terrain obstrué, acceptable en zone dégagée
- GM/PNJ déplacement non implémenté (CombatGmDeclareWindow sans onEnterMoveMode)

---

### Chantier 11 Sprint 5 — Serveur COMBAT_ACTION_DECLARE ✅ (session 62)

Travaux effectués :
- `server/src/socket/index.js` : COMBAT_ACTION_DECLARE rewrite — moveAction destructuré, KEY_MOD nettoyé, guard PC33, `getSequence`/`getType`, `actionRows[]` bulk insert (1 ligne/action), `modifiers:{ini_mod}` par ligne ✅
- `server/src/socket/index.js` : COMBAT_SURPRISE_RESULT fix — `is_micro`/`initiative_score` → `action_key:'skip', sequence:99` ✅
- `server/src/socket/index.js` : `skipPlayer()` fix — `initiative_score` → `action_key:'skip', sequence:99` ✅
- `server/src/socket/index.js` : `startResolutionPhase()` fix — `orderBy('initiative_score','desc')` → `orderBy('sequence','asc')` ✅

---

### Chantier 11 Sprint 6 — Phase Résolution ✅ (session 62)

Travaux effectués :
- `server/src/socket/index.js` : `startResolutionPhase()` complet — `active_slot_idx:0` + emit `COMBAT_SLOT_ADVANCED` slot 0 ✅
- `server/src/socket/index.js` : `COMBAT_ACTION_CONFIRM` — guards, move (PE29 Redis), assault stub Sprint 7, micro resolved direct ✅
- `server/src/socket/index.js` : `advanceSlot(io, campaignId, slots, nextIdx)` — nextIdx≥length → endTurn, sinon COMBAT_SLOT_ADVANCED ✅
- `server/src/socket/index.js` : `endTurn(io, campaignId)` — PC18 bulk UPDATE + PC28 DELETE + current_turn+1 + ANNOUNCEMENT ✅
- `client/src/stores/combatStore.js` : `setActions` ✅
- `client/src/pages/SessionPage.jsx` : COMBAT_SLOT_ADVANCED handler + COMBAT_PHASE_CHANGED stocke actions ✅
- `client/src/components/CombatTimeline.jsx` : curseur jaune `activeSlotIdx` (RESOLUTION uniquement) ✅
- `client/src/components/CombatActionWindow.jsx` : mode Résolution — recap + bouton Agir → COMBAT_ACTION_CONFIRM ✅
- `client/src/components/CombatOverlay.jsx` : condition RESOLUTION joueur + panneau GM résolution (nom+INI+Agir jaune) ✅

---

## Chantier 11 Sprint 7.1 — Déclaration Assaut UI ✅ (session 64)

Travaux effectués :
- `server/src/db/migrations/57_combat_v3.js` : +`fire_mode`/`bullet_count`/`fire_mode_bonus_comp`/`fire_mode_bonus_dmg` sur `combat_actions` + `state_character JSONB NOT NULL DEFAULT '{}'` sur `combat_roster` (PC39). Bug corrigé : `target_token_id` dupliqué retiré (existait déjà uuid en migration 54).
- `client/src/components/CombatActionWindow.jsx` : Kiwi-style Assaut — fenêtre 360→720px, armes auto MG/MD (PC22), sélection cible canvas (mode cible), FIRE_MODE_VARIANTS CC/RC/RL complet, cadence CC (radio tir simple/répétition + slider + A/B), RC (auto), RL (5 boutons), dual-wield toggle (+3/+5), forceCC, assaultValid
- `client/src/pages/SessionPage.jsx` : combatTargetMode state + handleEnterTargetMode + handleValidateTarget
- `client/src/components/Canvas3D.jsx` : combatTargetModeRef (P40), intercept drag pour target mode, ligne R3F native attaquant→cible (useMemo)
- `client/src/components/CombatOverlay.jsx` : bandeau "Assaut — Cliquez sur la cible" + Valider/Changer/Annuler la visée
- `server/src/socket/index.js` : COMBAT_ACTION_DECLARE enrichi (targetTokenId, fireMode, bulletCount, fireModeBonusComp, fireModeBonusDmg, isDualWield, dualWieldBonusComp)

**"Changer le mode de tir" — UI non implémentée.** L'action existe dans combatSections.js mais le sub-panel de sélection CC/RC/RL n'est pas codé. Sprint dédié futur.

---

## Chantier 11 Sprint 7 — Jets d'attaque + Dégâts + Blessures

Objectif : Attaques complètes. Blessures enregistrées. Carence FOR appliquée.

**Sprint 7.1 ✅ CONFIRMÉ (session 64)**
**Sprint 7.2 ✅ CONFIRMÉ (session 64)**
**Sprint 7.3 ✅ CONFIRMÉ (session 64)** — resolveAssaultAction + COMBAT_DAMAGE_PROMPT + bug fix skillAssoc
**Sprint 7.4 ✅ CONFIRMÉ (session 64)** — CombatDamageWindow + COMBAT_DAMAGE_CONFIRM handler
**Sprint 7.4bis ✅ CONFIRMÉ (session 64)** — Jet de toucher interactif côté joueur (CombatModifiersWindow → COMBAT_ATTACK_PLAYER_RESULT)

**Corrections et ajouts session 63 (ne pas réintroduire les erreurs) :**
- Blessures : 1 par touche, gravité par seuils (≥5/10/15/20/25/30) — pas `Math.floor(nets/5)`
- Mode de tir (RC/RL) : sélection en ST1 (Annonce), stocké `fire_mode`/`bullet_count`/`fire_mode_bonus_comp`/`fire_mode_bonus_dmg` dans `combat_actions` (4 colonnes — migration 57)
- Tir instinctif : hors scope Sprint 7 (assaut classique uniquement)
- `confirmedModifiers` : `{ portee, situation[], taille }` — sans tirInstinctif, sans fireMode
- Broadcast : `severity + is_lethal` — pas `nbrBlessures`
- `target_token_id` : colonne existe déjà (migration 54), juste à stocker dans le handler
- `resolveWoundInsertion` + `isShockTestRequired` : locales dans `char-sheet.js`, à exporter (Sprint 7.3)
- LOS + portée : vérification pré-jet serveur (COMBAT_ACTION_CONFIRM) — LOS binaire V1, portée extrême → −99
- Portée auto-calc : parse `ref_equipment.range`, PC37 (espace millier), PC38 (arme contact), pré-remplissage CombatModifiersWindow
- SYSTEME.md §17 ajouté : pattern données personnage serveur (chaîne calcul, charStats.js, données par rôle)
- Sprint 7.5 ajouté : décompte munitions (sprint dédié)
- "Validation Sprint 4" → "Validation Sprint 7" (corrigé)
- `run à vide autocentré OBLIGATOIRE` ajouté dans CLAUDE.md (§ Pendant le développement)

**Corrections session 63 continuation — architecture state_character + bugs résiduels :**
- `combat_roster.state_character JSONB NOT NULL DEFAULT '{}'` ajouté au plan + SYSTEME.md (migration 57, bloc 2)
- `is_rushed` = STATE (pas action distincte), implémentation deux temps : INSERT combat_actions + UPDATE state_character (PC39)
- **BUG A résolu** : `ref_degats` → `parseDice(weapon.ref_damage_h)` — colonne réelle `damage_h`, alias `ref_damage_h` (PC40)
- **BUG B résolu** : `is_rushed` lu depuis `state_character.is_rushed`, jamais `SELECT combat_actions` (PC28)
- **BUG C résolu** : chaîne skill_id : `weapon_inv_id → item_id → ref_equipment_skill_assoc → skill_id`
- **L9 résolu** : fetch `char_inventory WHERE container != 'Coffre'` pour `calcEncumbrancePenalty`
- **L10 résolu** : `PORTEE_MOD_COMP = { bout_portant:5, courte:0, moyenne:-5, longue:-10, extreme:-15 }` documenté
- PC39 + PC40 ajoutés dans section 8 pièges
- Section 11 Sprint 3 endTurn : nettoyage state_character per-turn documenté
- PO1/PO2/PO3 marqués ✅ dans section 6 ET section 11

À lire avant de coder :
- `server/src/socket/index.js` — état après Sprint 6
- `server/src/lib/charStats.js` — calcResistanceArmure, calcCarenceArmure, calcResistanceDommages, calcSeuils
- `shared/woundConstants.js`, `shared/armorConstants.js`
- `server/src/routes/character/char-sheet.js` — resolveWoundInsertion, isShockTestRequired, POST /wounds

---

## Chantier reporté — Paramètre campagne GM entity move mode

Décision session 41 : reporté en chantier dédié.
3 options prévues :
- Option réaliste : tous les tokens GM font des jets
- Option à la carte : case à cocher par token non attribué à un joueur
- Option divine : GM ne fait jamais de jet

Implique : nouvelle colonne `campaigns.gm_entity_move_mode`, option par token `tokens.bypass_entity_move_roll`, interface paramètres campagne.

---

## Sprint GM — Refonte CombatGmDeclareWindow ✅ CONFIRMÉ (session 65)

Travaux effectués :
- `CombatGmDeclareWindow.jsx` : réécriture complète — InlineChip click-to-cycle, batch mode (selectedIds), STATE_DEFAULTS, aggregate/aggregateInitial, sections TACTIQUE/ARMEMENT/ACTION/RAPIDES, roster intégré, footer INI delta ✅
- `combatSections.js` : ajout `tooltip` sur MAP_ACTIONS + QUICK_ACTIONS (texte LdB exact), correction label `reperer`, slider GM affiche coût INI (val×stepIni) ✅
- `CombatActionWindow.jsx` : `title={a.tooltip}` sur les 3 branches MAP_ACTIONS + wrapper QUICK_ACTIONS ✅

**Sprints restants :**
- Sprint GM-A — Assaut PNJ (char_inventory équipée + fallback dropdown ref_equipment + cross-turn weapon persistence + PC22 bypass serveur)
- Sprint GM-B — Déplacement PNJ (onEnterMoveMode depuis CombatOverlay, moveSelection per-PNJ)

---

## Sprint 7.6 — Actions d'état dynamiques ✅ CONFIRMÉ (session 65)

Remplacement du système clé plate (selectedKeys/KEY_MOD) par des sélecteurs d'état avec matrices de transition INI. Payload v2 `{ tokenId, state, mapActions, quick }`.

Travaux effectués :
- `server/src/db/migrations/58_combat_v4.js` : +`state_cover`/`state_fire_mode`/`state_vitesse` sur `combat_roster`, CHECK constraints, backfill `state_vitesse='rushed'` depuis `state_character->>'is_rushed'` ✅
- `client/src/components/combatSections.js` : réécriture complète — STATE_DEFS (5 états + matrices asymétriques), stateTransitionCost, calcIniDelta, MAP_ACTIONS multi-select, QUICK_ACTIONS incrémentaux ✅
- `client/src/components/CombatActionWindow.jsx` : réécriture complète v2 (~600 lignes) — StateSelector segmented control, blocs TACTIQUE/ARMEMENT/ACTION/RAPIDES, QB weapon auto-drawn, footer INI delta coloré, emit v2 ✅
- `server/src/socket/index.js` : COMBAT_ACTION_DECLARE v2 (matrices STATE_COSTS serveur, calcul iniDelta, UPDATE états + initiative), endTurn reset colonnes per-tour, `is_rushed` → `state_vitesse` ✅
- `client/src/components/CombatModifiersWindow.jsx` : `state_character.is_rushed` → `state_vitesse === 'rushed'` ✅
- `client/src/components/CombatGmDeclareWindow.jsx` : adapté v2 (MAP_ACTIONS/QUICK_ACTIONS, emit v2 avec états courants) ✅

**Limitations acceptées v1 :**
- GM window : attack et move non disponibles (nécessitent UI dédiée — sprint futur)
- state_vitesse = 'delayed' : pas de logique de report en fin de round (V2 futur)

---

## Bugs connus toujours ouverts

### Bug WebGL — Context Lost au switch play/edit
Cause : Three.js r160+ + drivers GPU Windows. Non bloquant. Statut : documenté, abandonné.

### Bug B — Modification faces voxel existant non exposée dans l'UI
Statut : correction prévue si besoin.

---

## Points de vigilance permanents

- "La Forêt Maudite" — pas de default_battlemap_id → ne jamais utiliser pour les tests
- token.owner_id — mort → toujours character_id → characters.user_id
- socket dans dependency arrays — tout useCallback qui émet doit inclure socket (P3)
- ordre déclaration React — callback A qui appelle B doit être déclaré APRÈS B (P4)
- coordonnées voxel — données brutes en base, +0.5 uniquement dans le rendu visuel
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- redis.js — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- resolveEntityState — returning doit inclure battlemap_id (PE26)
- collisionMoveToken — hdel systématique ancienne case, hset conditionnel layer (PE24)
- PE27 moveType — calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux
- Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement — comportement documenté V1
- Lerp EntityMesh — useFrame dans sous-composants (pas EntityMesh parent) — règle des hooks
- Logs debug index.js — conservés volontairement, à retirer avant production
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
