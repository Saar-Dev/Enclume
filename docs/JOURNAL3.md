# JOURNAL3 — Projet Enclume
> Démarré : Session 64 (2026-05-25)
> JOURNAL1 et JOURNAL2 archivés dans `docs/Old/`

---

## Contexte de démarrage — Session 64 (2026-05-25)

État stable confirmé au démarrage de ce journal :

**Migrations stables : 1→57** (prochaine : 58)

**Derniers sprints confirmés :**
- Sprint 7.1 ✅ — Déclaration Assaut UI (CombatActionWindow Kiwi-style, armes, sélection cible, cadence CC/RC/RL, dual-wield, migration 57)
- Sprint 7.2 ✅ — CombatModifiersWindow (portée, situation, taille cible, fetch weapon-skill, guard ownership COMBAT_ACTION_CONFIRM)
- Sprint 7.3 ✅ — resolveAssaultAction serveur (jet attaque, DICE_RESULT broadcast, bifurcation PJ/PNJ, pendingDamageActions, bug fix skillAssoc)
- Sprint 7.4 ✅ — COMBAT_DAMAGE_CONFIRM handler (loc + armures PI8 + dégâts + blessures + shockTest) + CombatDamageWindow (3 phases)
- Sprint 7.4bis ✅ — Jet de toucher interactif côté joueur (COMBAT_ATTACK_PLAYER_RESULT, CombatModifiersWindow refactorisé, CombatOverlay PJ/GM séparés)

**Bugs résolus session 64 :**
- Bug skillAssoc : `weapon_inv_id` (char_inventory.id) utilisé à tort dans la lookup `ref_equipment_skill_assoc.item_id` (qui est FK → ref_equipment.id). Fix : ajout `char_inventory.equipment_id` au SELECT weapon, lookup via `weapon.equipment_id`.
- Bug architectural : CombatModifiersWindow visible uniquement par le GM (`isGm &&`). Fix : deux conditions séparées — PJ résout son propre assaut, GM résout PNJ uniquement.

**Prochains sprints planifiés :**
- Sprint 7.5 — Décompte munitions
- Sprint 7.6 — Actions d'état dynamiques (state_weapon / state_position)

**Dettes actives :**
- D10 UV texturing V2 — modèle Blender .glb (PE33)
- `useDiceAudio.js` — sons impact dés
- `.gitattributes:3` — attribut invalide
- Timer auto-skip — prévu Sprint 2, reporté
- Affichage carence FOR (rouge si FOR < min_str) — reporté après ArmorWoundPanel + forNA
- "Changer le mode de tir" (RC/RL sub-panel) — sprint dédié futur
- Bug surprise critique (roll=1 → initiative=1 dernier) — à analyser

**Bug ouvert non bloquant :**
- Surprise critique (roll=1) → initiative=1 (agit en dernier). Sémantique roll surpris à revoir.

---

## Session 64 — Chantier Documentation (suite de session)

Refonte architecture docs — voir ROADMAP.md § "Chantier Documentation".

**Réalisé :**
- JOURNAL2.md archivé dans `docs/Old/JOURNAL2.md`
- JOURNAL3.md créé (ce fichier)
- ROADMAP.md mis à jour avec le plan documentation complet
- SYSTEME.md → éclatement en 9 fichiers thématiques dans `docs/SYSTEME/` ✅
  - CORE.md (auth, ownership, stores, WS)
  - VOXELS.md (coordonnées, PE14)
  - ASSETS.md (MinIO, faces, Atelier GM)
  - DICE.md (flux dés, DICE_RESULT, animation)
  - REACT.md (dependency arrays, lock éditeur)
  - ENTITES.md (collision Redis, rotation, déplacement)
  - BLESSURES.md (wounds, armures, P51)
  - COMBAT.md (charStats, state_character, PC27)
  - CONVENTIONS.md (§18 règles immuables, §19 pièges indexés)
- GLOSSAIRE.md créé (termes RPG ↔ identifiants code, ambiguïtés documentées) ✅
- CLAUDE.md réécrit (pointeurs SYSTEME/, 6 pièges critiques uniquement) ✅
- SYSTEME.md original → archivé dans `docs/Old/SYSTEME.md` ✅

**Session 64 — Audit source code → documentation (7 fichiers) :**

*shared/events.js* — 11 événements WS manquants dans CORE.md : DOC_SHARED, ENTITY_ACTION_GM_DIRECT, COMBAT_START/END (client→serveur), COMBAT_ROSTER_UPDATED, COMBAT_SURPRISE_RESULT, COMBAT_ANNOUNCE_START, COMBAT_ACTION_DECLARED, COMBAT_SKIP_PLAYER, COMBAT_TURN_SKIPPED, COMBAT_ACTION_WINDOW. Ajoutés.

*server/src/lib/charStats.js* — Corrections critiques dans COMBAT.md : calcCarenceArmure retourne ≥0 (pas ≤0), calcResistanceArmure retourne {etq,prt} minuscules (pas {ETQ,PRT}), getShockMalus était "à créer" mais EXISTE DÉJÀ. Ajouts : table AN complète (LdB p.114), formule calcNA (plancher 3, TOTAL_MALUS=0), distinction calcAttributeNA/calcAttributeAN, 10 fonctions manquantes (getModDom, calcREA, calcAllures, calcResistanceNaturelle, calcSouffle, calcResistanceDroguesInput, getCoutAugmentation/Deblocage/Total), table coûts XP maîtrise.

*shared/woundConstants.js* — Ajout dans BLESSURES.md : valeurs WOUND_PENALTIES, SEVERITY_COLORS, table WOUND_MAX_COUNTS par localisation.

*shared/armorConstants.js* — Corrections BLESSURES.md : LOCATION_TO_SLOT avait 4 slots manquants (MG/MD/2M/Tr), SLOT_TO_REF_LOCATION incomplet, ARMOR_CATEGORY_MALUS {S:0,A:-2,B:-3,C:-4,D:-6} non documenté. Correction COMBAT.md : SLOT_TO_WOUND_LOCATION déjà implémenté (pas "à exporter").

*shared/polarisUtils.js* — Ajout formule exacte polarisRound dans REACT.md : Math.floor(x+0.4), 0.5 arrondit vers le BAS (≠ Math.round).

*server/src/socket/index.js* — Ajout dans COMBAT.md : payload complet COMBAT_ACTION_DECLARE (12 champs), table KEY_MOD complète (20 clés d'actions + modificateurs CDR). Distinction rush:+3 (action déclarée) vs is_rushed:-5 (état persistant).

*client/src/stores/combatStore.js* — Ajout dans CORE.md : shapes roster[] et actions[], currentTurn, toutes les actions du store.

**Session 64 — Analyse critique + itérations (suite chantier documentation) :**
- Corrections round 1 (pièges manquants dans les fichiers thématiques) :
  - VOXELS.md : ajout pièges P12, P17, P22, P26, P32
  - REACT.md : ajout P38 (e.code raccourcis) et PE16 (e.code Alt)
  - ENTITES.md : ajout PE24 (hdel/hset collisionMoveToken), PE11, PE12, PE13
  - ASSETS.md : ajout P43 (textures/<pack_uuid>/), P44 (name immuable)
  - CONVENTIONS.md §19 : ajout PI9 (format erreur serveur) et PI10 (seed equipment)
  - GLOSSAIRE.md : correction `combat_roster.character_id` → `token_id` uniquement (vérification migration)
- Corrections round 2 (qualité) :
  - CORE.md : pointeur combatStore → COMBAT.md pour state_character
  - COMBAT.md : ajout `calcAN` dans table charStats.js + définition PC28 inline
- Archivage `docs/` — docs actives restantes : ASBUILT, EN_COURS, ROADMAP, JOURNAL3, GLOSSAIRE, ReglePOLARIS
  - Archivé → Old/ : SYSTEME.md, CONVENTIONS.md(s14), ARCHITECTURE.md, COMBAT_GOAL.md, PLAN_11_SYSCOMBAT.md, SPRINT7_NOTES.md, DEV_ASSAULT_DROPDOWN_GM.md
  - Supprimé (temporaires) : SCRATCH_SESSION64.md, JOURNAL_SESSION64_SPRINT74.md, JOURNALTEMPORAIRE.md, JOURNAL2.md (doublon Old/)

**Session 64 — Audit source code suite (7 fichiers) :**

*client/src/pages/SessionPage.jsx* (lignes 640-1141) :
- Ajout COMBAT.md : shapes `combatMoveMode`, `combatTargetMode`, `damagePayload/Results`, props complètes `CombatOverlay`
- Ajout REACT.md : props `Canvas3D`, Guard Q4 (moveTarget actif → clic entité annule mode visée)

*client/src/components/CombatOverlay.jsx* :
- Ajout COMBAT.md : PC29 (sortedRoster = roster trié DESC initiative, activeSlotIdx indexe ce tri), table conditions de visibilité des sous-composants, props sous-composants
- Découverte : `tokens` prop passée mais IGNORÉE — CombatOverlay lit tokenStore directement

*client/src/components/CombatModifiersWindow.jsx* :
- Ajout COMBAT.md : payload complet `COMBAT_ACTION_CONFIRM` (confirmedModifiers), tables situationnelles complètes (PORTEES, ALLURES tireur/cible, COUVERTURES, OBSCURITES, TAILLES), shape `attackResult`, endpoint `weapon-skill`
- Confirmation PE14 dans calcul distance (pos_z DB = altitude, pos_y DB = profondeur)

*client/src/components/CombatDamageWindow.jsx* :
- Ajout COMBAT.md : shape précise `damageResults` (rollLoc, locLabel, degautsBruts, dmgRolls, degatsNets, severity, severityColor), payload `COMBAT_DAMAGE_CONFIRM`

*server/src/socket/index.js — resolveAssaultAction + COMBAT_DAMAGE_CONFIRM* :
- Ajout COMBAT.md : LOC_TABLE D20 (T:1-2, C:3-8, BD:9-11, BG:12-14, JD:15-17, JG:18-20), seuils sévérité (nets≥30→mortelle+lethal, ≥25→mortelle, ≥20→critique, ≥15→grave, ≥10→moyenne, ≥5→légère), formule dégâts nets, COMBAT_ATTACK_RESULT payload, pendingDamageActions (Map in-memory — risque perte si redémarrage serveur), fire_mode_bonus_dmg uniquement en portée courte/bout portant
- Mise à jour DICE.md : payload DICE_RESULT complet (mechanicalTotal, chancesDeReussite, diffLabel, isSuccess, mr, targetName, localisation, severity, severityColor)

*server/src/routes/character/char-sheet.js* :
- Mise à jour BLESSURES.md : shapes de réponse complètes pour toutes les routes wounds/inventory/sols + weapon-skill

**Session 64 — Audit source code (suite) — 8 fichiers supplémentaires :**

*client/src/components/CombatOverlay.jsx* :
- Ajout COMBAT.md : PC29 (sortedRoster = roster trié DESC initiative, activeSlotIdx indexe ce tri), table conditions de visibilité des 10 sous-composants, props sous-composants (CombatModifiersWindow, CombatDamageWindow, etc.)
- Découverte : tokens prop passée par SessionPage mais IGNORÉE — CombatOverlay lit tokenStore directement

*client/src/components/CombatActionWindow.jsx + combatSections.js* :
- Ajout COMBAT.md : FIRE_MODE_VARIANTS table complète (CC 8 variantes / RC unique / RL 5 variantes), MOVE_ZONE_DEFS (move_lente -3 / move_moyenne -5 / move_rapide -7 / move_max 0), dual wield bonus (+3 CC/RC, +5 RL), forceCC si 2 armes modes différents, actions inactives (micro_delay, multi_attack, change_fire_mode)

*client/src/components/CombatTimeline.jsx* :
- Confirme PC29 (sortedRoster), rien de nouveau à documenter

*client/src/components/CombatRosterWindow.jsx* :
- Ajout COMBAT.md : COMBAT_START payload ({battlemap_id, surprisedTokenIds, excludedTokenIds}), endpoint GET /battlemaps/:id/combat-ini

*client/src/components/CombatGmDeclareWindow.jsx* :
- Variante simplifiée de CombatActionWindow pour PNJs — rien de nouveau

*server/src/socket/index.js — COMBAT_START handler* :
- Ajout COMBAT.md : base_ini = calcREA(ada_na, per_na), PNJ surpris → jet auto serveur, PJ surpris → COMBAT_SURPRISE_ROLL, PC25 (surprise_roll exclu du broadcast COMBAT_STARTED), entités ignorées, combat_state shape insérée
- Vérification server/src/routes/battlemaps.js : combat-ini confirmed → {iniPreview: [{token_id, base_ini}]}

*docs/SYSTEME/CONVENTIONS.md §19* :
- Ajout PC28 (state_character → lire depuis combat_roster, jamais combat_actions)
- Ajout PC29 (activeSlotIdx → roster trié DESC)

*docs/GLOSSAIRE.md* :
- Correction critique : formule MR était inversée (`diceRoll - CDR` → correct : `CDR - diceRoll`, positif = réussite)
- Ajout : REA/base_ini, allures, fire_mode CC/RC/RL, initiative

**Session 64 — Audit source code (suite 2) — socket/index.js combat complet :**

*COMBAT_ANNOUNCE_START + startResolutionPhase + advanceSlot + endTurn* :
- Ajout COMBAT.md : COMBAT_PHASE_CHANGED payloads par transition (ROSTER→ANNONCE, ANNONCE→RÉSOLUTION, RÉSOLUTION→ANNONCE), COMBAT_SLOT_ADVANCED payload, comportement endTurn (reset roster bulk, delete combat_actions, increment current_turn)
- Ajout COMBAT.md : PC17 (timers auto-skip uniquement si action_timer_sec > 0)

*COMBAT_ACTION_CONFIRM handler* :
- Ajout COMBAT.md : slots = roster WHERE has_announced=true AND status='active' ORDER BY initiative DESC (PC29 confirmé côté serveur), ownership GM/PJ, résolution action par action (types move_short/move_long/assault/micro), advanceSlot après résolution complète du slot

*COMBAT_ACTION_DECLARE handler* :
- Ajout COMBAT.md : shape complète combat_actions (type, sequence, modifiers.ref_range), getType mapping (move_lente→move_short, autres move→move_long, reste→micro), getSequence (moves=1, micro=2, assault=3), guards PC22/PC23/PC33
- combat_actions.modifiers.ref_range = ref_equipment.range de l'arme → source pour CombatModifiersWindow parseRange

**Session 64 — Suite chantier documentation (session suivante) :**

*client/src/components/Canvas3D.jsx* (974 lignes — audit complet) :
- Confirmations : threeToDb inline confirmé, PE14 dans TokenMesh (baseY=token.pos_z, baseZ=token.pos_y), PE21 rotation.y sur group parent, P20 mat.clone() avant mutation, P40 refs miroir (tokensRef, ghostRef, combatMoveModeRef, combatTargetModeRef), Lerp exponentiel tau=0.1
- Ajout ENTITES.md : payload ENTITY_MOVE_REQUEST complet `{ entityId, tokenId, interactionId, moveType:'push'|'pull', destX, destZ }` — destZ = pos_y base (PE14) malgré le nom
- Ajout COMBAT.md : PC36 (combatCameraCenter `{ x, z }` → orbitRef.target.set(x+0.5, 0, z+0.5)), anneaux combat JSX (circleGeometry/ringGeometry, Y=pos_z+1.0+0.05, PE34), cursor wireframe case survolée, targetLinePoints (Float32Array[6], PE14+PE34, ligne rouge #e07070)
- Ajout REACT.md : justSelectedRef pattern (anti-deselect immédiat post-clic token), handlers Échap 3 useEffects distincts (moveTarget/combatMoveMode/combatTargetMode)
- handlePointerUp guards : combatMoveMode → onPendingMove `{ action_key, ini_mod, targetPosX:vx, targetPosY:vz, targetPosZ:0 }` (PE14 confirmé)
- Filtre layer GM : `tokens.filter(t => isGm || t.layer !== 'gm')` — joueurs ne voient pas layer GM
- Entity textures : fakeTexObjs `{ id:'bp.id__base', pack_id, faces }` + `{ id:'bp.id__state_X', ... }` → loadVoxelTextures → structured `{ base, states:{stateId: materials} }` — P26 confirmé (setBlocksReady(true) toujours en fin)

---

## Session 65 — Sprint 7.6 : Actions d'état dynamiques (fenêtre joueur v2)

**Objectif :** Remplacer le système clé plate (selectedKeys/KEY_MOD) par des sélecteurs d'état avec matrices de transition INI. Payload v2 : `{ tokenId, state:{}, mapActions:{}, quick:{} }`.

**Réalisé (session 65) :**

*Migration 58 (`server/src/db/migrations/58_combat_v4.js`)* ✅
- Ajout colonnes `state_cover`, `state_fire_mode`, `state_vitesse` sur `combat_roster`
- Contraintes CHECK + backfill `state_vitesse='rushed'` depuis `state_character->>'is_rushed'`
- (state_position + state_weapon déjà présents depuis migration 56)

*`client/src/components/combatSections.js`* ✅ — réécriture complète
- `STATE_DEFS` : 5 états (position/weapon/fire_mode/cover/vitesse) avec matrices coût asymétriques
- `stateTransitionCost(def, from, to)` + `calcIniDelta(prevStates, nextStates, mapActions, quick)`
- `MAP_ACTIONS` : multi-select (non exclusif), move/attack/melee/multi/interact
- `QUICK_ACTIONS` : observer/reperer incrémentaux (max 6), phrase fixe
- Suppression : KEY_MOD, SECTIONS, formatMod (remplacés par les nouvelles exports)

*`client/src/components/CombatActionWindow.jsx`* ✅ — réécriture complète (~600 lignes)
- `StateSelector` sub-composant (segmented control avec coût de transition affiché)
- Bloc TACTIQUE : position / couverture / vitesse
- Bloc ARMEMENT : weapon (verrouillé si attack/melee via QB) / fire_mode (grisé si modes indisponibles)
- Bloc ACTION : MAP_ACTIONS multi-select + cover_shot conditionnel
- Bloc ACTIONS RAPIDES : sliders observer/reperer + toggle phrase
- Footer : INI delta coloré + bouton "Déclarer l'action"
- QB (Quick Behavior) : attack/melee → weapon='drawn' automatique + revert sur désélection
- `initialStates` ref : synced depuis rosterEntry sur changement de token
- Emit v2 : `{ tokenId, state, mapActions, quick }`

*`server/src/socket/index.js`* ✅ — 3 changements
- COMBAT_ACTION_DECLARE v2 : handler réécrit pour payload `{ tokenId, state, mapActions, quick }`, matrices STATE_COSTS serveur-miroir de combatSections.js, calcul iniDelta serveur, UPDATE state_position/weapon/fire_mode/cover/vitesse + initiative, INSERT combat_actions par action (move/attack/melee/multi/interact/observer/reperer/phrase)
- endTurn : remplacement `state_character - 'is_rushed'` → reset `state_position='standing', state_cover='exposed', state_vitesse='normal'`
- resolveAssaultAction : `rosterTireur?.state_character?.is_rushed` → `rosterTireur?.state_vitesse === 'rushed'`

*`client/src/components/CombatModifiersWindow.jsx`* ✅ — 1 ligne
- `activeRosterEntry?.state_character?.is_rushed` → `activeRosterEntry?.state_vitesse === 'rushed'`

*`client/src/components/CombatGmDeclareWindow.jsx`* ✅ — adapté v2
- Suppression imports KEY_MOD/SECTIONS/formatMod (n'existent plus)
- Nouveau : sélection MAP_ACTIONS (melee/multi/interact) + QUICK_ACTIONS avec sliders
- Emit v2 avec états courants du roster (pas de changement d'état depuis la GM window)
- Note : attack et move non disponibles dans la GM window (nécessitent UI dédiée — sprint futur)

**Migration 58 lancée et validée ✅**
**Sprint 7.6 CONFIRMÉ FONCTIONNEL ✅**

Bug résolu : `if (next.has(key)) next.delete(key) else next.add(key)` → accolades obligatoires (OXC reject).

---

## Session 65 — Sprint GM : Refonte CombatGmDeclareWindow

**Objectif :** Réécriture complète de `CombatGmDeclareWindow.jsx` pour correspondre au prototype `Phase1-ActionPanel-GM.html`. Fenêtre unifiée avec chips inline click-to-cycle, roster intégré, mode batch multi-PNJ.

**Réalisé :**

*`client/src/components/CombatGmDeclareWindow.jsx`* ✅ — réécriture complète (~520 lignes)
- `STATE_DEFAULTS` : `{ position:'standing', weapon:'holstered', fire_mode:'cc', cover:'exposed', vitesse:'normal' }`
- `nextKey(stateKey, currentKey)` : cycle circulaire, fallback STATE_DEFAULTS si clé inconnue (mode mixte)
- `InlineChip` sub-composant : puce click-to-cycle compacte, coût de transition affiché, `'— mixte —'` en batch mixte
- Mode batch : `selectedIds.size >= 2` → header orange, chips agrégées, DÉCLARER émet N événements WS séparés
- `aggregate(stateKey)` / `aggregateInitial(stateKey)` : valeur unique ou `'__mixed__'`
- Sections : TACTIQUE (position/cover/vitesse) / ARMEMENT (weapon/fire_mode) / ACTION (melee/multi/interact) / ACTIONS RAPIDES (observer/reperer sliders + phrase)
- Roster intégré scrollable avec checkboxes, glyphes état (○/◉/✓), delta INI indicatif par PNJ
- Footer : INI total (1 cible), avertissement coûts individuels en batch, bouton DÉCLARER
- `canDeclare` : au moins 1 changement d'état OU 1 action sur au moins 1 PNJ non déclaré
- Auto-focus prochain PNJ todo après DÉCLARER
- `GM_DISABLED = new Set(['move', 'attack'])` — sprints dédiés

**Décisions de design documentées :**
- Clic sur chip mixte → reset à STATE_DEFAULTS (ex. vitesse mixte → 'normal')
- Batch mode : selectedIds réinitialisé après DÉCLARER, focusedId pointe le prochain todo
- attack grisé : nécessite fetch char_inventory + fallback ref_equipment dropdown + PC22 server bypass (Sprint GM-A)
- move grisé : nécessite connexion onEnterMoveMode depuis CombatOverlay (Sprint GM-B)

**Sprints restants :**
- Sprint GM-A — Assaut PNJ (char_inventory équipée, fallback dropdown ref_equipment, cross-turn persistence, PC22 bypass serveur)
- Sprint GM-B — Déplacement PNJ (passage onEnterMoveMode depuis CombatOverlay, moveSelection per-PNJ)

---

## Session 65 — Fix tooltips LdB + label reperer

**Objectif :** Ajouter les textes exacts du Livre de Base Polaris comme tooltips HTML natifs (`title=`) au survol des actions de combat. Corriger le label `reperer` tronqué.

**Réalisé :**

*`client/src/components/combatSections.js`* ✅
- Champ `tooltip` ajouté sur les 5 MAP_ACTIONS et les 3 QUICK_ACTIONS (texte LdB exact)
- Label `reperer` corrigé : `'Repérer / scanner'` → `'Repérer (obj., personne, lieu…)'`
- Tooltip reperer complet : "Tenter de repérer un objet, une arme, une personne, un endroit, etc. — 1 Test d'Observation par tranche de 5 pts d'Init."
- Tooltip observer : "Observer le combat — 1 information par tranche de 5 pts d'Init."

*`client/src/components/CombatGmDeclareWindow.jsx`* ✅
- `title={qa.tooltip}` sur les quickRows (incremental + fixed)
- `title={a.tooltip}` sur les actionBtns MAP_ACTIONS
- Slider observer/reperer : `{val * stepIni}` (ex. `-10`) au lieu du compte brut ; `'–'` quand inactif

*`client/src/components/CombatActionWindow.jsx`* ✅
- `title={a.tooltip}` sur les 3 branches MAP_ACTIONS (greyed, zoneSelect, normal)
- `title={a.tooltip}` sur le wrapper QUICK_ACTIONS

**Rappel mécanique :** Observer / Repérer = 1 résultat par tranche de 5 pts d'Init. Coût = N × (−5) INI. Le slider représente le nombre de tranches.

---

## Session 65 — Sprint GM-A : Détection équipement pré-combat + Quick-equip PNJ

**Objectif :** Rework `CombatRosterWindow` — colonnes ARME/ARMURE, détection lacunes, équipement d'urgence GM-only via dropdowns inline. Aucune fenêtre séparée.

**Réalisé :**

*`server/src/routes/equipment.js`* ✅
- `GET /api/equipment` : ajout colonne `location` dans le SELECT (nécessaire pour filtrage zones armure côté client)
- `GET /api/equipment?family=Armes` + `?family=Protections` : filtre par famille déjà présent (ajouté Sprint 7.6)

*`server/src/routes/battlemaps.js`* ✅ — nouvelle route
- `GET /api/battlemaps/:id/combat-equipment` : pour chaque token avec `character_id`, retourne `{ characterId, weapon, armorPieces }` — weapon = premier slot dans {'MG','MD','2M','Tr'}, armorPieces = `char_inventory JOIN ref_equipment` WHERE `family='Protections'` AND `slot NOT IN NON_ARMOR_SLOTS` AND `slot NOT NULL`
- `NON_ARMOR_SLOTS = {'MG','MD','2M','Tr','D','Ce'}` — filtre les slots hors zones de localisation

*`server/src/routes/character/char-sheet.js`* ✅ — nouvelle route
- `POST /api/char-sheet/:characterId/quick-equip` — GM uniquement (`req.isGm`)
- Body : `{ equipment_id, slot }` — VALID_SLOTS existant réutilisé
- Bypass `isContainerAvailable` : INSERT direct avec `container='Sac'`, `quantity:1`
- Guard conflit : slot déjà occupé → 409
- Broadcast `WS.INVENTORY_ADDED` vers la campagne après insertion

*`client/src/components/CombatOverlay.jsx`* ✅
- Passage de `characters={characters}` à `CombatRosterWindow` (prop manquante)

*`client/src/components/CombatRosterWindow.jsx`* ✅ — réécriture complète (~500 lignes)
- Props : `{ socket, battlemapId, characters }`
- Fetches parallèles au montage (pré-combat uniquement) : `combat-ini` + `combat-equipment` + `equipment?family=Armes` + `equipment?family=Protections`
- Helpers :
  - `getCoverage(location)` → `{ T, C, B, J }` booleans (split sur '/')
  - `mergeArmorPieces(pieces)` → union T/C/B/J + tips par zone (noms des pièces)
  - `chipToSlot(chip)` → `{ T:'T', C:'C', B:'BD', J:'JD' }`
  - `defaultArmorSlot(location)` → slot prioritaire (C > BD > JD > T)
- `WEAPON_FAMILIES_EXCLUDE = Set(['Accessoires pour armes','Grenade','Lanceur'])` — filtre client refWeapons
- Bannière alerte : compte PNJ sans arme + sans armure
- Colonne ARME :
  - PJ : lecture seule — nom + slot entre crochets (gris italique)
  - PNJ équipé : point vert + nom + slot
  - PNJ sans arme : `<select style danger>` → handleQuickEquip avec slot='MD'
- Colonne ARMURE — chips T C B J :
  - `PjArmorChips` : chips grises, filled = couvert, empty = découvert, tooltip = noms pièces (lecture seule)
  - `PnjArmorChips` : chips vertes filled, rouge border sur lacunes, clic ouvre dropdown filtré par zone
  - PNJ sans aucune armure : `<select style warn>` → handleQuickEquip via `defaultArmorSlot`
- Fermeture dropdown au clic extérieur via `windowRef` + `useEffect`
- Tokens sans `character_id` (entités de décor) : colonne arme/armure vide (PC27)

**Décisions de design :**
- `container='Sac'` sans Sac physique : WeaponPanel filtre `container !== 'Coffre'`, InventoryPanel groupe par container. Pas de crash, peut paraître dans l'inventaire.
- Munitions hors scope : Sprint 7.5 dédié
- Créatures hors scope : sprint futur — `character.type = 'creature'` ou équivalent
- PJ : lecture seule intentionnelle — le joueur gère son propre équipement
- Slot par défaut arme = 'MD' (main droite) — cas d'usage le plus courant pour un PNJ sans arme

**Post-confirmation — Run à vide — 3 bugs corrigés :**
- **Bug 1 — Overflow clipping** : `PnjArmorChips` dropdown custom `position:absolute` à l'intérieur de `tableWrap` (`overflow:auto`) → coupé par le scroll container (règle CSS déterministe). Fix : état local `openChip` dans `PnjArmorChips`, `<select>` natif (s'ouvre au niveau viewport, hors overflow), suppression `openDropdown` parent + `windowRef`/click-outside + styles `chipDropdown*` orphelins.
- **Bug 2 — Crash garanti** : `setOpenDropdown(null)` résiduel dans `handleQuickEquip` après suppression de l'état `openDropdown` → `ReferenceError` à chaque quick-equip. Supprimé.
- **Bug 3 — Dead code** : `WEAPON_SLOTS` déclaré mais jamais utilisé. Supprimé.

**Sprint GM-A CONFIRMÉ FONCTIONNEL ✅**



---

## Session 65 — D20 normales GLB ✅ (2026-05-27)

**Objectif :** Corriger la détection de face du D20 GLB — chaque résultat serveur devait animer le dé sur la face physique correspondante.

**Problème de départ :** `DiceMesh.jsx` avait une branche D20 dédiée qui utilisait `D20_FACE_NORMALS_LIST` (normales IcosahedronGeometry approximatives). Les normales Blender exactes stockées dans `D20_GLB_NORMALS` étaient ignorées.

**Méthode :**
1. Script Blender Python → 20 normales exactes depuis le mesh `D20_LP` (groupement par aire → top 20 faces plates)
2. `DiceMesh.jsx` : suppression branche D20 dédiée → D20 passe désormais par `else if (faceNormal)` → `getFaceNormal('d20', N)` → `D20_GLB_NORMALS[N]`
3. Import `D20_FACE_NORMALS_LIST` retiré (inutilisé)
4. Test visuel complet : 20 faces — résultat serveur X → face affichée Y → table de permutation
5. Formule inverse : `new[X] = current[inverse[X]]` — où `inverse[Y]` = serveur X qui produit face Y
6. Validation géométrique : toutes les paires antipodales (somme=21) ont dot=-1.000 ✓

**Fichiers modifiés :**
- `client/src/components/DiceMesh.jsx` : branche D20 supprimée, import `D20_FACE_NORMALS_LIST` retiré
- `client/src/lib/diceMath.js` : `D20_GLB_NORMALS` — 20 normales Blender exactes, clés = numéros réels du dé

**Outils créés (tools/) :**
- `procrustes-d20.js` — tentative Procrustes abandonnée (erreur jusqu'à 34°)
- `find-numbers.js` — détection blobs texture (non utilisé dans solution finale)
- `blender-uv-map.js` — UV centroïdes par face Blender (non utilisé dans solution finale)
- `sample-texture.js` — ajout support env `HALF` pour taille de fenêtre configurable

**Piège notable :** remapping de permutation — `new[X] = current[mapping[X]]` est la mauvaise direction. La bonne formule est `new[X] = current[inverse[X]]`.

**D20 normales ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 65 — Sprint DicePanel v3 : Roue radiale ✅ (2026-05-27)

**Objectif :** Rework complet de la fenêtre de lancer de dés — passage d'une grille tableau à une roue radiale SVG (design Dicev2.html).

**Réalisé :**

*`client/package.json`* — nouvelles dépendances
- `@fontsource/share-tech-mono` + `@fontsource/caveat` installés (offline-compatible, bundlés par Vite)

*`client/src/index.css`* ✅
- +3 `@import` fontsource : `share-tech-mono/400`, `caveat/400`, `caveat/600`

*`client/src/components/DicePanel.jsx`* ✅ — réécriture complète
- `PCBBackground` : fond SVG ambiance SF (grille de points + traces + vias), `opacity:0.28`
- `DieShape` : silhouette SVG par type de dé (hexagone D20, losange D10/D100, carré D6, triangle D4, losange D8, pentagone D12) — états vide/hover/actif avec fill graduel
- `DieButton` : wrapper hitbox + badge count + hover state + `onContextMenu` pour décrément
- Roue : D20 central 78px + 6 dés couronne 60px (RING_RADIUS=80, WHEEL_SIZE=240) — D10 en haut, sens horaire
- Formule `{ k, n, mod }` mono-type — clic même type → `n++`, clic nouveau type → switch (garde mod), clic droit → `n--`
- MOD : boutons −/+ + input numérique, clamp `[-99, 99]`, `borderRadius:0`
- RESET contextuel (non-vide uniquement)
- Barre formule : affichage `NdK.toUpperCase() ± mod` + bouton LANCER
- Enregistrer comme favori : contextuel (non-vide), `prompt()` pour label, persistence `localStorage('dice-presets')`
- FAVORIS : wrap flex, clic = lance, ⇧clic = charge, mode édition (✕ par preset)
- HISTORIQUE : section repliable (replié par défaut), max 10 entrées, écoute `WS.DICE_RESULT` filtrée `userId`, clic = rejouer, crit vert / fumble rouge, 🔒 si secret
- JET AU MJ : checkbox fonctionnelle (`secret` dans payload `WS.DICE_ROLL`)
- Drag conservé (même pattern `pointermove`/`pointerup`)
- Toggle button conservé (position sidebar), couleur `user?.color || '#3a8aaa'`
- `useAuthStore()` direct dans le composant (pas de prop `userColor`)
- P3 respecté : `socket` + `secret` dans deps `emitRoll`

*`server/src/socket/index.js`* ✅
- DICE_ROLL : destructure `{ formula, secret = false }`
- Si `secret=true` : `socket.emit()` (lanceur) + `fetchSockets()` → GM sockets uniquement (PE2 `s.data.role === 'gm'`)
- Si GM lanceur avec secret : pas de fetchSockets (déjà reçu)
- +champ `secret` dans payload DICE_RESULT
- Log : `[secret]` suffixe si applicable

*`client/src/pages/SessionPage.jsx`* ✅
- DICE_RESULT : +`secret` dans destructuring + `addMessage`

*`client/src/components/Sidebar.jsx`* ✅
- Jets normaux : +`{msg.secret && <span title="Jet au MJ — invisible aux autres joueurs">🔒</span>}` dans diceHeader

**Décisions de design :**
- Formule mono-type uniquement (compatible regex `parseDice` serveur `/^(\d+)?d(\d+)([+-]\d+)?$/i`)
- Fonts via `@fontsource` npm (offline Pi) — pas de CDN Google Fonts
- Favoris : `localStorage` seulement (pas de persistence serveur pour v1)
- Historique local : écoute socket dans composant (même si panel fermé → hooks toujours actifs)
- `borderRadius:0` sur input MOD pour éviter le `border-radius: var(--radius-md)` du CSS global

**Sprint DicePanel v3 ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 65 — Sprint GM-B Assault PNJ ✅ (2026-05-28)

**Objectif :** Permettre au GM de déclarer des actions d'assaut (tir) pour les PNJs en Phase Annonce, avec résolution automatique serveur et affichage résultat.

### Sprint GM-B Assault PNJ — Mode Minimal ✅

**Fichiers modifiés :**

*`CombatGmDeclareWindow.jsx`* ✅
- Queue séquentielle `attackTick` (même pattern que `moveTick`) : `attackQueueRef`, `attackQueueIdxRef`, `attackCancelRef`
- `useEffect([attackTick])` AVANT early return (règle des Hooks — piège résolu)
- `assaultSelections` state : `tokenId → { targetTokenId }`
- `handleStartAttackQueue` : remplit `attackQueueRef` avec `targetIds`, démarre la queue
- `handleDeclare` : construit le payload attack avec `weapon.inv_id` + `targetTokenId`
- Bouton "Assaut (tir)" → déclenche la queue cible séquentielle
- Bouton "Passer" (footer) pour sauter un PNJ dans la queue

*`CombatOverlay.jsx`* ✅
- Prop `onEnterTargetMode` propagée à `CombatGmDeclareWindow`

*`server/src/socket/index.js`* ✅
- Fix PC22 : slot check `!['MG','MD','2M','Tr'].includes(weapon.slot)` (était 'MG'/'MD' uniquement)
- Fix null guard `ref_fire_mode` : `weapon.ref_fire_mode && !...` (évite TypeError sur armes sans fire_mode)
- Fix "Inconnu" chat PNJ : query `users` conditionnelle sur `character.user_id`, fallback `character.name`
- PNJ touche → `isPnj: true` dans `COMBAT_ATTACK_RESULT` broadcast (hit ET miss)

### Sprint CombatResultPanels ✅

**Fichiers créés/modifiés :**

*`client/src/components/CombatResultPanels.jsx`* ✅ NOUVEAU
- Design Claude Design "VTT Enclume Combat Result" — deux variantes :
- `CombatResultGM` : bottom-left, 220px, ton neutre — "Résolution du tir", tireur→cible, Touché/Manqué, `RollSeuilLine` (Jet XX / Seuil XX coloré succès/échec), `DamageLine` (dégâts nets + loc + "X bruts − Y armure"), `SeverityBlock` coloré par sévérité + "Létal"
- `CombatResultPlayer` : bottom-center, 220px, 2e personne dramatique — "Vous êtes touché"/"Vous esquivez le tir", glow ambiant couleur sévérité
- Palette autonome `C {}`, `SEVERITY {}`, `LOC {}` — indépendant de `woundConstants.js`
- `pointerEvents: 'auto'` sur chaque panneau (overlay parent = none)

*`client/src/components/CombatOverlay.jsx`* ✅
- Import `CombatResultGM/Player` remplace `SEVERITY_COLORS`
- Panneau GM : `<CombatResultGM>` avec mapping payload → props (tireurId→label, `degautsBruts`→`degatsBruts`, `chancesDeReussite`→`seuil`)
- Panneau Joueur : `<CombatResultPlayer>` conditionnel : `!isGm && pnjAttackResult && pnjAttackResult.cibleId === playerToken?.id`
- Styles `gar*` supprimés (10 entrées)
- Props signature : +`pnjAttackResult`, +`onPnjAttackResultClose`

*`client/src/pages/SessionPage.jsx`* ✅
- +`pnjAttackResult` state, +`setPnjAttackResult`
- Handler `COMBAT_ATTACK_RESULT` : set les deux states (`gmAttackResult` + `pnjAttackResult`) simultanément
- Props `pnjAttackResult`/`onPnjAttackResultClose` passés à `<CombatOverlay>`

*`CombatGmDeclareWindow.jsx`* ✅ (fixes CSS)
- `borderLeftColor` + `borderLeft` → fusionné en `borderLeft: '3px solid #color'` (fix warning React)

### Sprint DST/CTC — Badges + Batch homogène ✅

**Problème :** "Assaut (tir)" actif même pour PNJs sans arme à distance ; batch pouvait mélanger DIST et CONTACT.

**Solution :**

*`server/src/routes/battlemaps.js`* ✅
- `combat-equipment` endpoint : +`'ref_equipment.fire_mode as ref_fire_mode'` au SELECT weapon
- **Piège évité :** colonne DB = `fire_mode`, alias = `ref_fire_mode` (copier l'alias → erreur SQL → roster vide)

*`client/src/components/CombatGmDeclareWindow.jsx`* ✅
- `isRanged(tokenId)` : `!!equipment[tokenId]?.weapon?.ref_fire_mode`
- `hasWeapon` → `hasAnyRanged` (détection arme à distance, pas juste "a une arme")
- `toggleSelect` : type guard DIST/CTC — si incompatible, remplace la sélection + met le focus
- `selectAll` : filtre par type du `activeFocusId` (ne sélectionne que les DIST OU que les CTC)
- Badge `DST` (cyan) / `CTC` (amber) / `···` (gris) dans chaque ligne roster
- Tag bouton désactivé : `'sans arme dist.'` au lieu de `'sprint dédié'`
- 4 nouveaux styles : `rosterBadge`, `rosterBadgeDst`, `rosterBadgeCct`, `rosterBadgeNone`

**Sprint GM-B Assault PNJ + CombatResultPanels + DST/CTC ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 65 — Sprint État Initial Joueur (phase ROSTER) ✅ (2026-05-29)

**Objectif :** Permettre aux joueurs de déclarer leur état initial (posture/arme/mode tir) pendant la phase ROSTER, et informer le GM de leur confirmation dans la fenêtre ROSTER COMBAT.

**Vérification persistance (COMBAT.md) :**
- `state_position` : par tour (reset → 'standing' à chaque endTurn). La déclaration ROSTER = état initial du tour 1.
- `state_weapon` : combat-persistant — inchangé entre les tours.
- `state_fire_mode` : combat-persistant — inchangé entre les tours.

**Fichiers créés/modifiés :**

*`shared/events.js`* ✅
- +`COMBAT_INIT_STATE: 'combat:init_state'` (entre COMBAT_ANNOUNCE_START et COMBAT_ACTION_DECLARE)

*`server/src/socket/index.js`* ✅
- Nouveau handler `COMBAT_INIT_STATE` (joueur uniquement, guard `phase === 'ROSTER'`)
- Guard ownership : `token → character.user_id === socket.user.id`
- Validation enum : `['standing','crouching','prone']`, `['holstered','ready','drawn']`, `['cc','rc','rl']`
- UPDATE `combat_roster` : `state_position + state_weapon + state_fire_mode`
- Merge JSONB PC39 : `state_character || '{"init_state_confirmed":true}'::jsonb` (détection confirmation sans migration)
- Broadcast `COMBAT_ROSTER_UPDATED` (même format que COMBAT_SURPRISE_RESULT : `surprise_roll` strippé)

*`client/src/components/CombatInitStateWindow.jsx`* ✅ NOUVEAU
- Lit `roster` via `useCombatStore()`, initialise chips sur `entry.state_*` ou fallbacks
- `StateChip` : click-to-cycle via `STATE_DEFS` de `combatSections.js` (réutilisation)
- 3 chips : POSTURE / ARME / MODE DE TIR
- Bouton "Confirmer" → `socket.emit(WS.COMBAT_INIT_STATE, { tokenId, position, weapon, fire_mode })`
- Post-confirmation : écran "État initial confirmé ✓" + résumé des 3 valeurs choisies
- Visible : `!isGm && phase === 'ROSTER' && playerToken && playerRosterEntry`
- Position : bottom-right (même zone que CombatGmDeclareWindow mais le joueur ne voit pas les fenêtres GM)

*`client/src/components/CombatOverlay.jsx`* ✅
- Import `CombatInitStateWindow`
- Condition ajoutée avant le bloc CombatRosterWindow (GM-only)

*`client/src/components/CombatRosterWindow.jsx`* ✅
- Colonne `ÉTAT INIT` entre INI et SURPRIS, conditionnelle `phase === 'ROSTER'`
- `rEntry` + `initConfirmed` dérivés dans le `.map()` depuis `roster` store
- `initConfirmed = rEntry?.state_character?.init_state_confirmed === true`
- Affichage : `✓` vert (PJ confirmé) / `·` gris (PJ non confirmé) / `—` (PNJ)
- La colonne disparaît automatiquement au passage en phase ANNONCE
- 3 nouveaux styles : `initConfirmed`, `initPending`, `initNA`

**Sprint État Initial Joueur ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 65 — Sprint Pathfinding : A* déplacement combat ✅ (2026-05-28)

**Objectif :** Remplacer les anneaux concentriques (invalidés par les murs) par un pathfinding A* Chebyshev en temps réel — cases colorées par allure sur le chemin vers le curseur.

**Décisions de conception (tout validé avant de coder) :**
- Chebyshev (8 directions, coût=1 par case) — pas de Manhattan ni Euclidien
- Double résolution ×2 : 1 Three.js unit = 2 gridY nodes → supporte `slab_bottom` nativement
- Allure auto-détectée par longueur du chemin (seuils calcAllures)
- Chute libre autorisée, unlimited (MAX_SCAN_DOWN=40 gridY)
- slope/wedge V1 = cube (non-implémenté)
- Tokens bloquants, entités V1 = [] (is_blocking incertain)
- Calcul client-side uniquement — aucun changement serveur

**Bugs identifiés et corrigés (3 rounds run à vide) :**
- Bug 1 (PE34) : `startFeetGY = posZ*2` → corrigé en `(posZ+1)*2` (pieds = pos_z+1.0 Three.js)
- Bug 2 : `targetPosZ` manquait `-1` dans conversion feetGridY→posZ DB
- Bug 3 : `Array.sort()` sur open set = O(n²) — remplacé par binary min-heap O(log n)
- Issue B : destination = départ → early return null (évite goal check immédiat)
- Issue C : stale heap entries → lazy deletion (`gScore.get(curKey) < cur.g → continue`)
- Issue A : `entity.state?.is_blocking` incertain → V1 pass `entities=[]`

**Fichiers créés :**

*`client/src/lib/pathfinder.js`* — NOUVEAU module pur (~170 lignes, zéro dépendance React/store)
- `MinHeap` : binary heap O(log n) avec comparateur
- `buildBlockedSet(voxels, tokens, entities, excludeTokenId)` : Set<"x:gy:z"> des nœuds bloqués
- `isValidFeet`, `isBodyClear` : helpers de validation nœud
- `getNeighbors` : scan de `feetGY+maxStepUp` vers `feetGY-maxScanDown`, premier `isValidFeet` = surface naturelle
- `reconstructPath` : backtrack parent map → `[{ x, z, feetGridY, distFromStart }]`
- `findPath(voxels, tokens, entities, from, to, allures, options)` : A* complet
- `getActionKey(steps, allures)` : steps → `{ action_key, ini_mod }`
- `getPathColor(distFromStart, allures)` : `#3b82f6/#22c55e/#f97316/#ef4444`

**Fichiers modifiés :**

*`client/src/components/Canvas3D.jsx`*
- Import `{ findPath, getPathColor, getActionKey }` depuis pathfinder.js
- Nouveaux refs/state : `currentPath`/`currentPathRef`, `voxelsRef`, `lastCellRef`
- useEffect cleanup : reset chemin + curseur quand combatMoveMode → null
- `handlePointerMove` : throttle par case, appel `findPath`, update `currentPathRef` synchrone
- `handlePointerUp` : lit `currentPathRef`, `getActionKey`, payload PE14 + `targetPosZ = Math.round(feetGridY/2)-1`
- JSX : anneaux → `currentPath.map(cell → mesh position=[x+0.5, feetGridY/2+0.05, z+0.5])`

*`client/src/pages/SessionPage.jsx`*
- `handleEnterMoveMode` : paramètre `zones` → `allures`, `combatMoveMode.zones` → `combatMoveMode.allures`

*`client/src/components/CombatActionWindow.jsx`*
- `handleZoneSelectClick` : construction `zones` supprimée, passe `allures` directement
- Import `MOVE_ZONE_DEFS` retiré (inutilisé)

*`client/src/components/CombatOverlay.jsx`*
- Import `MOVE_ZONE_DEFS` ajouté depuis combatSections.js
- Légende déplacement : `zones.map()` → `MOVE_ZONE_DEFS.map(def => allures[def.allureKey])`

**Faiblesses identifiées post-test (chantiers futurs) :**
- Raycast imprecis : `groundPlane` fixe à y=0 → X/Z erronés sur terrain élevé
- Waypoints : alt+clic pour forcer un point de passage sur chemins complexes

**Sprint Pathfinding ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 65 — Sprint Raycast : intersection voxel précise ✅ (2026-05-28)

**Objectif :** Remplacer le raycast contre plan fixe y=0 (X/Z décalés sur terrain élevé) par une intersection précise contre la géométrie voxel réelle.

**Problème résolu :** `raycastGround` castait contre `THREE.Plane(y=0)`. Sur terrain élevé, le rayon "passait derrière" le voxel depuis la caméra, donnant des coordonnées X/Z incorrectes (erreur pouvant dépasser plusieurs cases).

**Solution :** Algorithme Amanatides/Woo via `fast-voxel-raycast@0.1.1` (npm, fenomas/andyhall). Traverse mathématiquement la grille voxel sans passer par les meshes Three.js — fonctionne directement sur `voxelsRef.current`.

**Technique — décalage normale 0.5 :**
```js
x: Math.floor(hitPos[0] + hitNorm[0] * 0.5)
z: Math.floor(hitPos[2] + hitNorm[2] * 0.5)
```
`hitPos` = point d'entrée sur la face touchée (float). Décaler de 0.5 dans la direction de la normale donne la case adjacente ouverte (là où se tient le joueur), correctement pour toutes orientations de face.

**Fichiers modifiés :**

*`client/package.json`* — +`fast-voxel-raycast@0.1.1`

*`client/src/components/Canvas3D.jsx`*
- Import `raycastVoxels from 'fast-voxel-raycast'`
- Nouvelle fonction `raycastVoxelColumn(clientX, clientY)` :
  - Si voxel touché → `{ x, z, isVoid: false }` (coordonnées entières précises)
  - Si vide → fallback plan y=0 → `{ x, z, isVoid: true }`
- Bloc combat move mode `handlePointerMove` : remplace `raycastGround` par `raycastVoxelColumn`
- Guard `if (cell.isVoid && !isGm) return` — joueur interdit de marcher dans le vide
- `handlePointerMove` deps : +`raycastVoxelColumn`, +`isGm`

**Périmètre :** `raycastGround` (plan y=0) conservé pour drag token, visée entité — non affectés par le bug (terrain plat ou positions relatives). Seul le mode déplacement combat utilise `raycastVoxelColumn`.

**Sprint Raycast ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 65 — Sprint GM-B Move : Déplacement PNJ séquentiel ✅ (2026-05-28)

**Objectif :** Migrer la logique de déplacement combat des PJs vers les PNJs. Le GM peut choisir une destination pour chaque PNJ sélectionné, avec traitement séquentiel automatique (Option B + Passer).

**Décisions architecturales :**
- `DEFAULT_PNJ_ALLURES = { lente:4, moyenne:8, rapide:16, max:24 }` pour tous les PNJs sans stats (COO=10 équivalent) — option 2 validée.
- Pas de 6ème paramètre `customOnPendingMove` dans `handleEnterMoveMode` — le GM voit le panneau "Valider/Changer" standard, ce qui est correct.
- `moveTick` incrémental (au lieu de `moveQueueIdx`) pour éviter le bug "même valeur 0 → pas de re-render".
- `tokensRef` synced par useEffect séparé pour éviter stale closures dans l'effect queue.
- Rules of Hooks : `useEffect([moveTick])` déplacé avant `if (allPnjs.length === 0) return null` — piège identifié pendant l'écriture.

**Piège résolu — Rules of Hooks :** L'`useEffect([moveTick])` était initialement placé après l'early return. Détecté pendant la relecture du fichier produit. Déplacé avant l'early return.

**Aucun changement serveur :** `COMBAT_ACTION_DECLARE` v2 (Sprint 7.6) gère déjà `mapActions.move.ini_mod` et valide les coordonnées `targetPosX/Y/Z` (PC33) pour tout type de token (PJ ou PNJ avec guard GM).

**Fichiers modifiés :**

*`shared/polarisUtils.js`*
- +`export const DEFAULT_PNJ_ALLURES = { lente: 4, moyenne: 8, rapide: 16, max: 24 }`

*`client/src/components/CombatOverlay.jsx`*
- +`onEnterMoveMode={onEnterMoveMode}` sur `<CombatGmDeclareWindow>` (+1 ligne)

*`client/src/components/CombatGmDeclareWindow.jsx`*
- Imports : `useEffect, useRef` + `DEFAULT_PNJ_ALLURES`
- Prop `onEnterMoveMode` ajoutée
- State : `pendingGmMoves` ({}), `moveTick` (0)
- Refs : `moveQueueRef` ([]), `moveQueueIdxRef` (0), `moveCancelRef` (null), `tokensRef` (synced)
- `useEffect([tokens])` : sync `tokensRef.current` — AVANT early return
- `useEffect([moveTick])` : pour chaque tick, entre move mode pour le token courant de la queue ; `onMoveSelected` stocke dans `pendingGmMoves` + avance ; `onCancel` avance sans stocker — AVANT early return
- `GM_DISABLED` : `'move'` retiré → `new Set(['attack'])`
- Click 'move' : `handleStartMoveQueue()` au lieu de `setMapAction`
- `handleStartMoveQueue` : construit queue depuis `targetIds`, initialise refs, `setMoveTick(t=>t+1)`
- `calcDelta` : `move: pendingGmMoves[tokenId] ?? null` (calcIniDelta inclut `move.ini_mod`)
- `canDeclare` : `|| !!pendingGmMoves[id]`
- `handleDeclare` : `move: pendingGmMoves[tokenId] ?? null` dans mapActions
- Footer : bouton "Passer (label)" conditionnel (moveQueueRef + moveQueueIdxRef + moveTick)
- Style `btnPasser` ajouté

**Sprint GM-B Move ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — Code d'invitation beta (REGISTRATION_CODE) ✅ (2026-05-29)

**Objectif :** Bloquer la création de compte sans un code partagé à 8 chiffres — distribué manuellement aux beta-testeurs.

**Décisions architecturales :**
- Code unique partagé (invite code), pas OTP par utilisateur — adapté au contexte beta fermée 4-8 joueurs.
- Stocké dans `.env` sous `REGISTRATION_CODE` — non hardcodé, changeable sans toucher au code.
- Comparaison `crypto.timingSafeEqual()` sur buffers 8 bytes fixes — standard pro, pas de timing leak.
- Guard 500 si env var absente ou mal formée (`/^\d{8}$/`) — misconfiguration visible immédiatement, pas de faux positif.
- Filtre `/\D/g` côté client — chiffres uniquement, tronqué à 8, pas de soumission accidentelle.
- Aucune migration, aucune dépendance ajoutée.

**Fichiers modifiés :**

*`.env`*
- +`REGISTRATION_CODE=` (code réel à renseigner)

*`.env.example`*
- +`REGISTRATION_CODE=your_8_digit_beta_code`

*`server/src/routes/auth.js`*
- Import `crypto` (natif Node.js)
- `/register` : extraction `inviteCode` du body, guard champs requis (+inviteCode), guard env var (`!/^\d{8}$/`), `timingSafeEqual` buffers 8 bytes, 403 si échec — avant toute requête DB

*`client/src/pages/RegisterPage.jsx`*
- +state `inviteCode`
- +champ "Beta code" (type text, filtre chiffres, maxLength 8, required)
- `inviteCode` passé dans le body du POST `/auth/register`

**Code d'invitation beta ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — Fenêtres combat draggables (useDraggable) ✅ (2026-05-29)

**Objectif :** Rendre les 5 fenêtres flottantes du mode combat déplaçables par drag sur leur label/header, avec persistance localStorage et clamp écran.

**Décisions architecturales :**
- Hook partagé `useDraggable(storageKey, defaultPos, panelW)` — pattern extrait de `EntityInstancePanel` existant, enrichi de localStorage.
- Persistance à la fin du drag (`mouseup`) uniquement — pas sur chaque pixel de mouvement.
- `posRef` pour éviter la stale closure dans le handler `onUp` (sans ref, `pos` serait figé à la valeur de la première closure).
- Clamp horizontal : `[8, window.innerWidth - panelW - 8]`. Clamp vertical : `[8, window.innerHeight - 40]` (au moins 40px de header visible même si contenu long).
- `position: sticky` retiré du header de `CombatModifiersWindow` (inutile dans un flex column avec overflow:hidden sur le parent).
- Rules of Hooks : hook appelé AVANT les early returns dans `CombatGmDeclareWindow` (avant `if allPnjs.length === 0`) et `CombatInitStateWindow` (avant `if confirmed`).
- 4 branches `W.window` simples dans `CombatActionWindow` + 1 spread existant : tous couverts.

**Fenêtres exclues (non flottantes) :** CombatTimeline (barre HUD), CombatDamageWindow (inset:0), CombatPnjPanel (backdrop), CombatResultPanels (notifications brèves).

**Fichiers créés/modifiés :**

*`client/src/lib/useDraggable.js`* (NOUVEAU)
- `useDraggable(storageKey, defaultPos, panelW)` → `{ pos, onHeaderMouseDown }`
- `useState` init : lecture localStorage → clamp → fallback defaultPos
- `useEffect([])` : mousemove/mouseup sur window, écriture localStorage au mouseup
- `posRef` synchronisé dans `onMove` pour éviter stale closure dans `onUp`

*`CombatRosterWindow.jsx`* — key `combat-roster-pos`, default `{top:60, left:w-576}`, w:560
*`CombatActionWindow.jsx`* — key `combat-action-pos`, default centré bas, w:720, 5 branches
*`CombatGmDeclareWindow.jsx`* — key `combat-gm-declare-pos`, default bas-droite, w:440
*`CombatModifiersWindow.jsx`* — key `combat-modifiers-pos`, default centré bas, w:360
*`CombatInitStateWindow.jsx`* — key `combat-init-state-pos`, default bas-droite, w:260

**Fenêtres combat draggables ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — Sprint A Jets Favoris : fondations serveur ✅ (2026-05-29)

**Objectif :** Poser les fondations DB + routes + events pour le système de macros de compétences (PLAN 13).

**Fichiers créés/modifiés :**

*`server/src/db/migrations/59_character_macros.js`* (NOUVEAU)
- Table `character_macros` : UUID PK, FK characters CASCADE, label TEXT, sources JSONB, modifier INTEGER, template TEXT, sort_order SMALLINT
- CHECK constraints : `jsonb_array_length(sources) <= 3`, `modifier BETWEEN -99 AND 99`
- INDEX sur character_id

*`server/src/routes/character/char-sheet.js`*
- +4 routes sous `/:characterId/macros` : GET (liste triée), POST (limit 10 via COUNT), PUT (patch partiel), DELETE
- Ownership géré par `router.param('characterId')` existant — aucun middleware supplémentaire
- Limit 10 enforced applicativement (COUNT + AppError 400)

*`shared/events.js`*
- +`MACRO_ROLL: 'macro:roll'`
- +`MACRO_ROLL_RESULT: 'macro:roll_result'`

**Migration 59 — Batch 31 ✅ CONFIRMÉ**

---

## Session 66 — Sprint B Jets Favoris : handler WS MACRO_ROLL ✅ (2026-05-29)

**Objectif :** Exécuter une macro en un clic — lire les stats vivantes du perso, calculer le seuil, lancer 1d20, évaluer succès/critique, substituer le template, broadcaster.

**Décisions techniques :**
- `type: 'attribute'` → seuil = `calcAttributeNA` (NA = 3–25+, seuil réel Polaris)
- `type: 'skill'` → seuil = `calcSkillTotal` (AN1+AN2+maîtrise)
- `type: 'secondary'` → switch sur ref_id : rea/seuil_etourdi/seuil_incons/souffle/resistance_drogues
- Sources multiples : somme des valeurs + modificateur fixe
- Critiques Polaris absolus : roll=1 → Succès critique, roll=20 → Échec critique (indépendant du seuil)
- Template par défaut si absent : `{me} — {source} → {résultat}/{seuil} → {succès} {critique}`
- Broadcast secret : pattern identique DICE_ROLL (PE2 fetchSockets → gmSockets)

**Fichiers modifiés :**

*`server/src/socket/index.js`*
- Import : +`calcSouffle`, +`calcResistanceDroguesInput` depuis charStats.js
- Handler `WS.MACRO_ROLL` ajouté après DICE_ROLL :
  - Fetch macro + character (ownership guard) + sheet + attrs + archetype + genotypeRow
  - Boucle sur `macro.sources` : accumulation threshold par type
  - `parseDice('1d20')` → évaluation isSuccess/isCriticalSuccess/isCriticalFail
  - Substitution template 7 variables ({me}, {source}, {résultat}, {seuil}, {modificateur}, {succès}, {critique})
  - Broadcast `MACRO_ROLL_RESULT` (room ou secret joueur+GM)

**Sprint B Jets Favoris ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — Sprint C1 Jets Favoris : UI chips + chat ✅ (2026-05-29)

**Objectif :** Rendre les macros visibles et exécutables dans le DicePanel, afficher les résultats dans le chat.

**Fichiers modifiés :**

*`server/src/socket/index.js`*
- MACRO_ROLL handler : +fetch `color` depuis `users` (oubli Sprint B) — inclus dans payload

*`client/src/pages/SessionPage.jsx`*
- +listener `WS.MACRO_ROLL_RESULT` → `addMessage({ type: 'dice', interactionType: 'macro_result', ... })`

*`client/src/components/Sidebar.jsx`*
- +branche `interactionType === 'macro_result'` AVANT `if (msg.skillLabel !== undefined)` (piège : sinon tombe dans jet normal)
- Affichage : nom perso coloré ★, formattedMessage, résultat/seuil, badge Succès/Échec, 🔒 si secret

*`client/src/components/DicePanel.jsx`*
- +imports `useCharacterStore`, `api`
- +`playerChar = characters.find(c => c.user_id === user?.id)`
- +state `macros[]`, `editMacros`
- +useEffect fetch `GET /char-sheet/:characterId/macros` à l'ouverture du panel
- +section MACROS (chips dorés ★, clic → `socket.emit(WS.MACRO_ROLL, ...)`, mode ÉDITER → suppression via DELETE REST)
- +bouton placeholder `+ Créer une macro` (C2)
- +style `macroChip`

**Sprint C1 Jets Favoris ✅ CONFIRMÉ FONCTIONNEL**
