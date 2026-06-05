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

---

## Session 66 — Sprint C2 Jets Favoris : formulaire création macro ✅ (2026-05-30)

**Objectif :** Formulaire inline dans DicePanel pour créer des macros liées aux stats vivantes du personnage.

**Bug résolu en cours de sprint :**
- Routes `/macros` et `/macro-options` retournaient 404 malgré le code correct : Express 5 requiert un `/` initial sur toutes les routes de sous-routeurs montés avec `app.use()`. Les anciennes routes sans `/` initial (wounds, etc.) fonctionnaient car héritées d'Express 4. Les 6 nouvelles routes corrigées avec `'/:characterId/...'`.
- Référence circulaire introduite par `replace_all` sur `playerChar?.id` → corrigée immédiatement.

**Fichiers modifiés :**

*`server/src/routes/character/char-sheet.js`*
- Import étendu : +`calcAttributeNA, calcREA, calcSeuils, calcSouffle, calcResistanceDroguesInput`
- `GET /:characterId/macro-options` : retourne `{ attributes[8], skills[char], secondary[5] }` (JOIN ref_skills pour labels)
- `POST /:characterId/macro-preview` : calcul threshold live depuis sources+modifier (même logique que WS handler), retourne `{ threshold }`
- **Correction** : toutes les nouvelles routes avec `/` initial (Express 5)

*`client/src/components/DicePanel.jsx`*
- +states : `showMacroForm`, `macroOptions`, `mfName`, `mfSources[]`, `mfModifier`, `mfTemplate`, `mfPreview`
- +ref : `previewTimerRef` (debounce 500ms live preview)
- `openMacroForm` : fetch macro-options + reset form + ferme saveForm + replie historique
- `closeMacroForm`, `submitMacroForm`, `updateSource`, `addSource`, `removeSource`
- useEffect live preview : `POST /macro-preview` debounced sur changement sources/modifier
- JSX : roue/mod/formule/favoris masqués quand form ouverte, form inline avec 3 dropdowns dynamiques (type→valeur), aperçu seuil live, variables template affichées
- Bouton `+ Créer une macro` caché si 10 macros atteintes

---

## Session 66 — Fix GM macros + Sprint C1 MACRO_ROLL_RESULT ✅ (2026-05-30)

**Sprint C1 :**
- `SessionPage.jsx` : +listener `WS.MACRO_ROLL_RESULT` → addMessage interactionType macro_result
- `Sidebar.jsx` : +branche macro_result (★ coloré, formattedMessage, résultat/seuil, badge Succès/Échec)
- `DicePanel.jsx` : chips ★ macros, fetch au panel open, exécution socket.emit MACRO_ROLL, suppression mode ÉDITER
- `socket/index.js` : +fetch color user dans MACRO_ROLL payload

**Fix GM :**
- `DicePanel.jsx` : `isGm` depuis useCharacterStore, `selectedCharId` state, `effectiveCharId` dérivé
- GM sans perso propre → dropdown `— Personnage cible —` (tous characters du store avec name)
- Changement de personnage GM → reset macros/macroOptions/form
- Joueur : comportement inchangé (effectiveCharId = playerChar?.id)

**Jets Favoris — Sprint A + B + C1 + C2 + Fix GM ✅ CONFIRMÉS FONCTIONNELS**


## Session 66 � Chantier Changelog Dashboard ? (2026-05-30)

**Objectif :** Fen�tre changelog int�gr�e au Dashboard � panneau lat�ral r�tractable, source .md, auto-ouverture � la nouveaut�.

**D�cisions techniques :**
- Source de donn�es : client/public/CHANGELOG.md (statique, servi par Vite, pas de route API)
- Format : ## v{x} � {date} � {titre} + entr�es - [add|fix|chg] texte
- Parser : 	ext.split(/^## /m) + regex - \[(\w+)\] (.+) � aucune lib externe
- �tat open interne au composant (pas de remont�e d'�tat vers DashboardPage)
- Auto-ouverture : localStorage.changelog_last_seen !== latestVersion ? open + save au mount
- Rechargements suivants : ferm� (version d�j� vue). Mise � jour CHANGELOG.md ? r�ouverture automatique
- Design fid�le au prototype Anthropic : fond PCB SVG (id=cl-pads), ACCENT #3aaa6a, Share Tech Mono, ? SYSTEM_LOG, badges AJOUT/CORRECTIF/CHANGEMENT
- Layout DashboardPage : height:100vh + flex-col, body lex-row flex:1 overflow:hidden, scroll wrapper lex:1 overflowY:auto

**Fichiers cr��s/modifi�s :**

*client/public/CHANGELOG.md*
- 6 versions seed�es (v0.6.0 ? v0.8.0) avec contenu r�el des sessions Enclume

*client/src/components/ChangelogPanel.jsx* (NOUVEAU)
- Fetch + parse CHANGELOG.md au mount
- Auto-open localStorage (changelog_last_seen vs latestVersion)
- Collaps� 38px : rail vertical ? SYSTEM_LOG, clic ? open
- Ouvert 340px : SVG PCB d�co + header ? SYSTEM_LOG + ? fermer + scroll entries + footer BUILD x.x.x � OK
- Tags AJOUT/CORRECTIF/CHANGEMENT avec couleurs distinctes

*client/src/pages/DashboardPage.jsx*
- +import ChangelogPanel
- styles.container : minHeight:100vh ? height:100vh + display:flex + flexDirection:column
- Body : wrapper flex-row + scroll wrapper autour du content existant + <ChangelogPanel />

**Chantier Changelog Dashboard ? CONFIRM� FONCTIONNEL**


## Session 66 � Sprint 7.5 : D�compte munitions ? (2026-05-30)

**Objectif :** D�compter les munitions lors du tir en Phase 2 R�solution. Option campagne pour PNJs illimit�s. Rechargement avec picker de type de munition.

**D�cisions techniques :**
- mmo_remaining = NULL ? arme non initialis�e ? affich�e comme pleine, pas de d�cr�ment en combat. Tracking commence apr�s premier rechargement explicite.
- mmo_remaining = 0 ? chargeur vide ? affich� en rouge dans WeaponPanel
- D�cr�ment : ullet_count balles consomm�es quel que soit le r�sultat (touch� OU rat�)
- PNJ + pnj_unlimited_ammo = true ? skip d�cr�ment (option campagne, d�faut = true)
- Route reload : POST /:characterId/inventory/:weaponId/reload avec body { ammo_item_id } ? transaction (UPDATE arme + DELETE/UPDATE munition + 2� broadcast WS)
- Picker ammo : s�lecteur <select> visible si = 2 variantes disponibles (hors Coffre)

**Fichiers modifi�s :**

*server/src/db/migrations/60_ammo_tracking.js* (NOUVEAU)
- char_inventory.ammo_remaining INTEGER DEFAULT NULL
- campaigns.pnj_unlimited_ammo BOOLEAN NOT NULL DEFAULT TRUE

*server/src/routes/campaigns.js*
- PUT : +pnj_unlimited_ammo (validation boolean, updates, returning)

*server/src/routes/character/char-sheet.js*
- getItemWithRef + GET /inventory : +char_inventory.ammo_remaining dans SELECT
- POST /:characterId/inventory/:itemId/reload (NOUVEAU) : validation arme+munition+calibre, transaction charge arme (current_ammo + ammo_remaining), d�cr�mente/supprime munition, broadcast INVENTORY_UPDATED/REMOVED

*server/src/socket/index.js*
- esolveAssaultAction : +mmo_remaining+mmo_count dans le fetch arme initial
- Apr�s DICE_RESULT : d�cr�ment mmo_remaining -= bullet_count (guard NULL + guard PNJ unlimited)

*client/src/pages/CampaignSettingsPage.jsx*
- +state pnjUnlimitedAmmo (charg� depuis campaign, inclus dans PUT)
- +section "R�gles de jeu" avec toggle "Munitions illimit�es pour les PNJs"

*client/src/character/WeaponPanel.jsx*
- +state mmoSelected (picker par arme)
- Affichage mmo_remaining/ef_ammo_count (rouge si vide, ?? fallback si NULL)
- handleReload : POST /reload avec mmo_item_id s�lectionn�
- UI picker <select> si = 2 variantes compatibles

**Sprint 7.5 ? CONFIRM� FONCTIONNEL**

---

## Session 66 — Sprint Test de Choc : affichage + application is_stunned ✅ (2026-05-30)

**Objectif :** Compléter le système de Test de Choc — il était calculé pour les PJ attaquants mais jamais affiché ni appliqué, et absent pour les PNJ attaquants.

**Audit préalable — découvertes :**
- `shockResult` calculé dans COMBAT_DAMAGE_CONFIRM (flux PJ) mais jamais consommé côté client
- `shockResult` absent du flux PNJ (resolveAssaultAction) — `shockResult: null` en dur
- `is_stunned` défini dans COMBAT.md mais jamais settés programmatiquement
- Bug secondaire P49 dans branche PNJ : `severity` pré-promotion diffusée dans COMBAT_ATTACK_RESULT (au lieu de `result.wound.severity`)

**Décisions techniques :**
- `shockResult` enrichi : `{ triggered, roll, outcome, shockMalus, seuilEtourdi, seuilIncons }` — les deux seuils calculés permettent l'affichage sans recalcul client
- `is_stunned` appliqué via pattern PC39 : `state_character || ?::jsonb` — jamais de remplacement complet
- Token cible identifié via `action.target_token_id` (PNJ) ou `targetTokenId` depuis `pendingDamageActions` (PJ)
- Affichage dans 3 endroits : `CombatResultGM` (GM voit attaque PNJ), `CombatResultPlayer` (PJ ciblé voit attaque PNJ), `CombatDamageWindow` (PJ voit résultat de sa propre attaque)
- Guard `shockResult?.triggered` sur les 3 : aucun affichage si pas de test déclenché

**Fichiers modifiés :**

*`server/src/socket/index.js` — branche PNJ (resolveAssaultAction)*
- `let finalSeverity = severity` + `let shockResult = null` avant le if
- Après wound insertion : `finalSeverity = result.wound.severity` (correction bug P49)
- Bloc shock test complet (pattern identique COMBAT_DAMAGE_CONFIRM) : `calcSeuils` + `getShockMalus` + `parseDice('1d20')` → outcome → shockResult enrichi
- Si `outcome !== 'ok'` : `db('combat_roster').where({campaign_id, token_id: action.target_token_id}).update({ state_character: db.raw(...) })`
- COMBAT_ATTACK_RESULT : `severity: finalSeverity` et `shockResult` (plus `null`)

*`server/src/socket/index.js` — COMBAT_DAMAGE_CONFIRM (flux PJ)*
- shockResult enrichi avec `seuilEtourdi`/`seuilIncons`
- Si `outcome !== 'ok'` : même pattern `is_stunned` avec `token_id: targetTokenId`
- `shockResult` ajouté au payload `COMBAT_DAMAGE_RESULT`

*`client/src/components/CombatResultPanels.jsx`*
- Nouveau composant interne `ShockBlock({ shockResult })` : 3 états colorés (vert Résistance / jaune Étourdi / rouge Inconscient), affiche roll + seuil + outcome
- `CombatResultGM` et `CombatResultPlayer` : +prop `shockResult`, `<ShockBlock>` après `<SeverityBlock>`

*`client/src/components/CombatOverlay.jsx`*
- `shockResult={gmAttackResult.shockResult}` sur `<CombatResultGM>`
- `shockResult={pnjAttackResult.shockResult}` sur `<CombatResultPlayer>`

*`client/src/components/CombatDamageWindow.jsx`*
- Bloc Test de Choc après severityBanner : IIFE inline, 3 outcomes colorés, roll/seuil/label

**Hors scope (sprint futur) :**
- Guard `is_stunned` dans COMBAT_ACTION_DECLARE (effets gameplay : −5 comp, max allure moyenne)
- Clear `is_stunned` programmatique (actuellement persistant jusqu'à fin combat)
- Problème B : manual wound additions (WOUND_ADDED shock_test_required ignoré client)
- Affichage GM pour attaques PJ-sur-PNJ (COMBAT_ATTACK_RESULT non écouté hors isPnj:true)

**Sprint Test de Choc ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — Audit i18n + Migration RegisterPage ✅ (2026-05-30)

**Objectif :** Audit du système i18n (react-i18next), correction des anomalies, préparation structurelle pour Option C (bilingue FR/EN) à terme.

**Audit — découvertes :**
- Setup i18next v26 + react-i18next v17 fonctionnel mais sous-utilisé : 13 fichiers sur ~45 wired
- `RegisterPage.jsx` entièrement en anglais hardcodé — seul fichier incohérent avec le reste (EN vs FR)
- Aucun `changeLanguage`, aucun sélecteur de langue, aucun locale EN — monolingue de facto
- Composants combat + équipement (~32 fichiers) sans i18n — hors scope pour l'instant
- `SilhouettePanel - Copie.jsx` — fichier orphelin (aucun import)
- `CombatInitStateWindow.jsx` — composant session 65 non documenté dans ASBUILT.md

**Décisions :**
- Option B : conserver la structure i18n, corriger les anomalies, ne pas wirer combat/équipement maintenant
- Option C (bilingue) : sprint dédié futur — ajouter `en.json` + sélecteur de langue quand nécessaire

**Fichiers modifiés :**

*`client/src/locales/fr.json`*
- Section `auth` : +8 clés pour RegisterPage (`registerSubtitle`, `betaCode`, `betaCodePlaceholder`, `usernamePlaceholder`, `passwordPlaceholder`, `passwordTooShort`, `registering`, `alreadyAccount`)

*`client/src/pages/RegisterPage.jsx`*
- +`useTranslation` wired, 15 strings EN hardcodées → `t('auth.xxx')`
- Styles inline conservés identiques, fonctionnel inchangé
- Email placeholder `"you@example.com"` conservé (format universel)

*`client/src/i18n.js`*
- +`supportedLngs: ['fr']` — extension point documenté pour EN futur

*`client/src/character/SilhouettePanel - Copie.jsx`*
- Supprimé (fichier orphelin, aucun import confirmé)

*`docs/ASBUILT.md`*
- +`CombatInitStateWindow.jsx` documenté (NOUVEAU 65 Sprint 7.6)

**RegisterPage i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : LoginPage + CLAUDE.md convention ✅ (2026-05-30)

**Fichiers modifiés :**

*`client/src/locales/fr.json`*
- +`auth.subtitle` : "Table de jeu virtuelle"

*`client/src/pages/LoginPage.jsx`*
- `"Virtual Tabletop"` → `t('auth.subtitle')`
- `"Email"` / `"Password"` (labels) → `t('auth.email')` / `t('auth.password')`
- LoginPage 100% wired ✅

*`CLAUDE.md`*
- Checkpoint table : +ligne i18n
- +Section `## Convention i18n` (règle, pattern, état session 66, chemin Option C)

**LoginPage i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : DashboardPage ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +4 clés dashboard (`workshop`, `copied`, `play`, `createCardLabel`)
*`client/src/pages/DashboardPage.jsx`* : 5 strings wirées, textes conservés ("Atelier", "Copié !", "Jouer", "Créer une campagne" ×2)

**DashboardPage i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : WorkshopPage ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +section `workshop` (11 clés)
*`client/src/pages/WorkshopPage.jsx`* : 11 strings wirées (titre, section Packs, 3 onglets avec compteurs dynamiques, bouton PNG, hint dimensions avec interpolation `{{size}}`, badge Utilisé, 2 placeholders + hint modal)

**WorkshopPage i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : CampaignSettingsPage ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +3 clés settings (`sectionRules`, `pnjAmmoLabel`, `pnjAmmoHint`)
*`client/src/pages/CampaignSettingsPage.jsx`* : 3 strings wirées (section Règles de jeu + toggle PNJ — ajoutées Sprint 7.5 non wired)

**CampaignSettingsPage i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : Sidebar ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +13 clés (`session.tools/toolRuler`, `character.tabNotes`, `sidebar.editorTabVoxels/editorTabEntities/paletteTextures/categoryFallback/paletteEntities/noBlueprints/macroSuccess/macroFail/macroCritical/macroFumble`)
*`client/src/components/Sidebar.jsx`* : 3 bugs corrigés (session.tools, session.toolRuler, character.tabNotes affichaient la clé brute) + 10 strings wirées (onglets éditeur, palettes, badge macro)
Hors scope : phrase combat dégâts (Trans component nécessaire, sprint i18n dédié)

**Sidebar i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : SessionPage ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +10 clés session (`userJoined`, `userLeft`, `actionExpired`, `noGm`, `actionRefused`, `tokenSkipped`, `combatEnd`, `combatMode`, `combat`, `openSidebar`)
*`client/src/pages/SessionPage.jsx`* : 11 strings wirées (messages WS join/leave, résultats action entité ×3, skip combat, bouton combat titre+texte, sidebar reopen, bouton erreur)

**SessionPage i18n ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 66 — i18n : CharacterWindow + CharacterSheet + EntityBuilderTab + VoxelBuilderTab ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +section `charSheet` (~50 clés : attributs FOR/CON/COO/ADA/PER/INT/VOL/PRE, stats secondaires Réaction/Initiative/Seuils/Allures/Mod.Dom, labels bio, tooltips allures LdB longs, tooltip initiative dynamique, titres sections, options Droitier/Gaucher/Ambidextre, Stérile/Fécond(e)) + section `builder` (~55 clés : noms faces/géométries, formulaire entité/voxel, états, interactions, attributs Polaris dans selects, modales)

*`client/src/character/CharacterWindow.jsx`* : title="Redimensionner" wired

*`client/src/character/CharacterSheet.jsx`* : réécriture complète — ATTR_LABELS + ALLURES_TOOLTIPS supprimés (remplacés par t()), iniTooltip useMemo avec t() + deps, ~40 strings wirées

*`client/src/components/EntityBuilderTab.jsx`* : réécriture complète — FACE_LABELS remplacé par t('builder.faces.*'), ~55 strings wirées, attributs Polaris dans selects → charSheet.attr.*, EntityPreview 'Aperçu' wired

*`client/src/components/VoxelBuilderTab.jsx`* : réécriture complète — GEOMETRY_LABELS + FACE_LABELS remplacés par t(), ~15 strings wirées

*`docs/ROADMAP.md`* : +Sprint SkillTooltips (tooltips descriptifs LdB, prérequis documentés)

**CharacterSheet + EntityBuilderTab + VoxelBuilderTab i18n ✅ CONFIRMÉS FONCTIONNELS**

---

## Session 66 — i18n : SkillsPanel + AdvantagesPanel ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +section `skillsPanel` (6 clés : colonnes tableau + état vide) + section `advantages` (24 clés : badges MUT/ATR, modale 3 étapes, mutations/Polaris/texte libre, erreurs)
*`client/src/character/SkillsPanel.jsx`* : 6 strings wirées (colonnes + état vide catalogue)
*`client/src/character/AdvantagesPanel.jsx`* : +useTranslation wired, 23 strings wirées (import ajouté)

**SkillsPanel + AdvantagesPanel i18n ✅ CONFIRMÉS FONCTIONNELS**

---

## Session 66 — i18n : RadialMenu + EntityInstancePanel + ChangelogPanel ✅ (2026-05-30)

*`client/src/locales/fr.json`* : +sections `radialMenu` (1 clé), `entityPanel` (4 clés), `changelog` (5 clés dont tags imbriqués)
*`client/src/components/RadialMenu.jsx`* : +useTranslation — tranche GM "Modifier" wired (détection `__gm_config__` à la render, GM_SLICE inchangé)
*`client/src/components/EntityInstancePanel.jsx`* : +useTranslation — 3 strings wirées (placeholders + bouton Sauvegarder → `common.save` = "Enregistrer")
*`client/src/components/ChangelogPanel.jsx`* : +useTranslation — 5 strings wirées (tags AJOUT/CORRECTIF/CHANGEMENT via lookup imbriqué `changelog.tags.*`, 2 title attributes)

**RadialMenu + EntityInstancePanel + ChangelogPanel i18n ✅ CONFIRMÉS FONCTIONNELS**

---

## Session 66 — Chantier i18n complet (bilan) ✅ (2026-05-30)

**Objectif atteint : Option B propre + structure prête pour Option C (bilingue futur)**

**17 fichiers wired en une session :**
RegisterPage, LoginPage, DashboardPage, WorkshopPage, CampaignSettingsPage, Sidebar, SessionPage, Canvas3D (clean), CharacterWindow, CharacterSheet, EntityBuilderTab, VoxelBuilderTab, SkillsPanel, AdvantagesPanel, RadialMenu, EntityInstancePanel, ChangelogPanel

**fr.json — sections ajoutées :**
`register` (8 clés), `charSheet` (~50 clés dont attrs Polaris + tooltips LdB), `builder` (~55 clés), `skillsPanel` (6), `advantages` (24), `radialMenu` (1), `entityPanel` (4), `changelog` (5), +ajouts dans sections existantes : `auth` (9), `dashboard` (4), `session` (10), `settings` (3), `sidebar` (13), `workshop` (11), `character.tabNotes` (1)

**Hors scope confirmé :**
- Combat components (12) — sprint i18n dédié futur
- Panels équipement (WeaponPanel, ArmorWoundPanel, InventoryPanel, LocationPanel, ContainerPanel, SilhouettePanel) — sprint dédié futur
- SkillTooltips (tooltips LdB) — roadmap documentée dans ROADMAP.md

**Nettoyage :**
- `SilhouettePanel - Copie.jsx` supprimé (orphelin)
- `CombatInitStateWindow.jsx` documenté dans ASBUILT.md

---

## Session 66 — Sprint 7.6 : Rechargement comme action de combat ✅ (2026-05-31)

**Migrations :**
*`server/src/db/migrations/61_combat_actions_reload.js`* : +`reload` au CHECK constraint `chk_action_type` de `combat_actions`
*`server/src/db/migrations/62_reload_mode.js`* : +`campaigns.reload_mode TEXT NOT NULL DEFAULT 'magazine' CHECK (IN 'magazine','topup')`

**Serveur :**
*`shared/events.js`* : +`COMBAT_RELOAD_RESULT`
*`server/src/routes/campaigns.js`* : PUT accepte/valide `reload_mode`, `.returning` mis à jour
*`server/src/socket/index.js`* :
- `COMBAT_ACTION_DECLARE` : payload `mapActions.reload` accepte objet `{weapon_inv_id, ammo_item_id}` (PJ) ou boolean (PNJ fallback) ; action row stocke `weapon_inv_id` + `ammo_item_id` dans `modifiers`
- `COMBAT_ACTION_CONFIRM` : passe `socket` + `action` à `resolveReloadAction`
- `resolveReloadAction` réécrit : arme par `weapon_inv_id` ou auto-détection MG/MD (PNJ), munition par `ammo_item_id` ou auto-sélection, formule magazine/topup selon `reload_mode`, émet `COMBAT_RELOAD_RESULT` ciblé sur le socket joueur (`io.fetchSockets` si GM a cliqué Agir), logs `[DBG]` complets

**Client :**
*`client/src/components/combatSections.js`* : `reload` dans MAP_ACTIONS (span2), `attack` grayed si vide, exclusion mutuelle EXCLUSIVE_ACTIONS
*`client/src/components/CombatActionWindow.jsx`* :
- Phase 1 : +`allInventoryItems` + `selectedAmmoId` states, fetch inventaire complet, dérivation `reloadAmmoItems` (calibre + hors Coffre + non équipée), panneau droit munitions (sélection radio), `reloadValid` dans `canDeclare`, payload `reload: {weapon_inv_id, ammo_item_id}`
- Phase 2 : `myReloadAction` détecté → "Rechargement — en attente du MJ…" (pas de bouton Agir)
*`client/src/components/CombatResultPanels.jsx`* : +export `CombatResultReload` (bottom-center, succès vert / échec rouge avec calibre)
*`client/src/components/CombatOverlay.jsx`* : +import `CombatResultReload`, +props `reloadResult`/`onReloadResultClose`, mount conditionnel joueur
*`client/src/pages/SessionPage.jsx`* : +`reloadResult` state, listener `COMBAT_RELOAD_RESULT`, clear sur `ANNOUNCEMENT`, props passées à `CombatOverlay`
*`client/src/pages/CampaignSettingsPage.jsx`* : +section "Mode de rechargement" (radio Chargeur/Complément + hint explicatif)
*`client/src/locales/fr.json`* : +4 clés `settings.reloadMode*`

**Pièges rencontrés et résolus :**
- PC — `type: 'reload'` violait le CHECK constraint PostgreSQL → migration 61
- PC — `CASE WHEN ? IS NOT NULL` dans `orderByRaw` : PostgreSQL ne peut pas inférer le type UUID → suppression de `orderByRaw`, préférence gérée en JS
- PC — `WHERE NOT container = 'Coffre'` exclut les NULL en PostgreSQL → remplacé par `WHERE (container IS NULL OR container != 'Coffre')`
- PC — `resolveReloadAction` ne transmettait pas le bon socket quand le GM clique "Agir" pour un slot joueur → `io.fetchSockets()` ciblé par `user_id`

**Sprint 7.6 ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 67 — Sprint CaC 1 — Bug fixes post-tests (2026-05-31)

**4 bugs fixes (phase 1 — déclaration/UI) :**
- P1 : Échec silencieux hors portée → `COMBAT_DECLARE_ERROR` émis + `return` (déclaration annulée, message 4s côté joueur et GM)
- P2 : Sélections non réinitialisées au nouveau tour → `useEffect([rosterEntry?.has_announced])` + `prevHasAnnouncedRef` : reset complet quand `true → false`
- P3 : Arme non "Au clair" utilisable → grisage + tooltip dans la liste melee si `states.weapon !== 'drawn'`
- P4 : Auto-ciblage possible → `onPendingTarget` filtre `id === tokenId` (couvre assaut + melee + GM en un seul endroit)

**3 bugs fixes (phase 2 — résolution/GM) :**
- P5 : PNJ — pas de panneau d'arme (GM) → ajout arme auto-affichée dans le feedback melee GM (⚔ label + "mains nues")
- P6 : Message PJ incorrect ("aucune arme équipée" vs "arme rangée") → `hasMeleeInInventory` distingue "en inventaire mais pas en main" vs "absente de l'inventaire"
- **P7 (critique) : Aucun jet de touche en 8 tentatives** → `COMBAT_CONTACT` n'existe pas dans `ref_skills`. Correct = `COMBAT_A_MAINS_NUES` (FOR/COO). Armes de contact → `COMBAT_ARME` (FOR/COO) via `ref_equipment_skill_assoc`. Remplacement global dans `resolveMeleeAction`.

**Sprint CaC 1 ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 67 — Documentation Sprint CaC 1 (2026-05-31)

**Fichiers mis à jour :**
- `CLAUDE.md` : session 67, migration 63, Sprint CaC 1 ✅ dans chantiers terminés
- `docs/ASBUILT.md` : 6 composants mis à jour, migration 63, events.js +4, index.js
- `docs/EN_COURS.md` : session 67 ✅, prochains chantiers (Sprint CaC 2 en tête)
- `docs/SYSTEME/COMBAT.md` : section Corps à Corps (flux, formules, filtrage armes, 5 pièges CaC, 4 nouveaux events)
- `client/public/CHANGELOG.md` : v67 enrichi avec section Corps à Corps complète

---

## Session 67 — Sprint CaC 1 — Corps à Corps fondations (2026-05-31)

**Migration 63 :** `'melee'` ajouté au CHECK constraint `chk_action_type` de `combat_actions`.

**`shared/events.js` :** +3 events — `COMBAT_MELEE_DEFENSE_PROMPT`, `COMBAT_MELEE_DEFENSE_CONFIRM`, `COMBAT_MELEE_RESULT`.

**`server/src/socket/index.js` :**
- `getModDom` ajouté aux imports `charStats.js`
- `pendingMeleeDefense` Map déclarée (key = defenderTokenId)
- `COMBAT_ACTION_DECLARE` — melee : payload object `{targetTokenId, weaponInvId}`, validation distance `√(dx²+dz²) ≤ 3 + allonge` (PE14), action stockée `type:'melee'` + colonnes `weapon_inv_id`/`target_token_id`
- `COMBAT_ACTION_CONFIRM` — branche `type==='melee'` → `resolveMeleeAction()` + flag `needsDefenseWait` : si vrai le slot ne progresse pas jusqu'à `COMBAT_MELEE_DEFENSE_CONFIRM`
- `COMBAT_DAMAGE_CONFIRM` — branche `pendingType==='melee'` : `degautsBruts = rawDice + modDom` (sans MR table ni fire_mode_bonus)
- `resolveMeleeAction()` : fetch attaquant (skill via ref_equipment_skill_assoc ou COMBAT_CONTACT), roll D20, fetch défenseur — si PNJ : auto-resolve complet (roll défense, dégâts, blessures, shockResult, COMBAT_ATTACK_RESULT) — si PJ : stocke pending + émet COMBAT_MELEE_DEFENSE_PROMPT ciblé, retourne true (slot bloqué)
- `COMBAT_MELEE_DEFENSE_CONFIRM` handler : roll D20 défense serveur, résolution opposition (Polaris : attaquant réussit ET défenseur rate → touche), COMBAT_MELEE_RESULT room, dégâts (PJ attaquant → COMBAT_DAMAGE_PROMPT / PNJ → auto), advanceSlot()

**`client/src/components/CombatActionWindow.jsx` :**
- États melee : `meleePendingTokenId`, `selectedMeleeWeaponId`, `inMeleeTargetMode`
- `meleeWeapons` dérivé de `allInventoryItems` : filtre `ref_category === 'Arme de contact'` + slots MG/MD/2M
- `meleeValid` dans `canDeclare`
- Payload melee : `{ targetTokenId, weaponInvId }` (null = mains nues)
- Panneau droit "Corps à corps" : liste armes (allonge visible), sélection cible via `onEnterTargetMode`
- Phase 2 RESOLUTION : `myMeleeAction` → message "Corps à corps — en attente du résultat…"

**`client/src/components/CombatResultPanels.jsx` :** +`CombatResultMelee` — bottom-right, jets attaque/défense en opposition, highlight vert/rouge.

**`client/src/components/CombatOverlay.jsx` :** +import `CombatResultMelee`, props `meleeDefensePrompt`/`onMeleeDefenseConfirm`/`meleeResult`/`onMeleeResultClose` — panneau défense modal centré (apparaît quand `defenderTokenId === playerToken.id`), bouton "Défendre" → émet `COMBAT_MELEE_DEFENSE_CONFIRM`.

**`client/src/pages/SessionPage.jsx` :** +états `meleeDefensePrompt`/`meleeResult`, listeners `COMBAT_MELEE_DEFENSE_PROMPT`/`COMBAT_MELEE_RESULT`, clear on ANNOUNCEMENT, props passées à CombatOverlay.

**Limitations V1 acceptées :**
- Mode Normal uniquement (Offensif/Défensif/Charge/Retraite → Sprint CaC 2)
- Défenseur PNJ : toujours COMBAT_CONTACT pour la défense (V1)
- Pas d'icône "Engagé au contact" dans CombatRosterWindow

**Pièges résolus :**
- Slot bloqué si défenseur PJ (sequentiel voulu par Saar) — advanceSlot appelé depuis COMBAT_MELEE_DEFENSE_CONFIRM uniquement
- `category = 'Arme de contact'` est le bon filtre (vs double filtre location + range IS NULL — confirmé par requête SQL)
- `range` pour "Arme de contact" = allonge en mètres (LdB), pas portée de tir — formule `≤ 3 + allonge`
- `getModDom` n'était pas importé dans socket/index.js → ajouté

---

## Session 68 — Sprint CaC 2 — Modes de combat (2026-05-31)

**Objectif :** Implémenter les modes de combat CaC du LdB Polaris (p.223) : Normal, Offensif, Charge. Défensif et Retraite en base de données (prêts pour CaC3 sans migration supplémentaire).

**Migration 64 :**
- `state_combat_mode TEXT NOT NULL DEFAULT 'normal'` sur `combat_roster`
- CHECK : `('normal','offensif','charge','defensif','retraite')` — les 5 modes inclus dès maintenant

**`server/src/socket/index.js` :**
- `COMBAT_ACTION_DECLARE` : `state.combat_mode` validé, stocké dans `combat_roster.state_combat_mode`. Bloc melee simplifié → **aucune validation distance Phase 1** (intention enregistrée sans vérification). INI override serveur pour Charge : `move.ini_mod = 0` (non trusté client).
- `resolveMeleeAction` : **validation distance Phase 2** (post-déplacement), après move_short de la même boucle `COMBAT_ACTION_CONFIRM`. Lecture `state_combat_mode` attaquant → `attackModeBonus` (+3 si offensif/charge) + `combatModeBonus` (+3 dégâts si charge). Lecture mode défenseur PNJ → modifie `chanceDefense` (-5 offensif, -7 charge, +3 défensif, +5 retraite).
- `COMBAT_MELEE_DEFENSE_CONFIRM` : lecture mode défenseur PJ → même application que PNJ. `combatModeBonus` transmis via `pendingDamageActions`.
- `COMBAT_DAMAGE_CONFIRM` : branche melee → `degautsBruts = rawDice + modDom + combatModeBonus`.
- `endTurn` : reset `state_combat_mode = 'normal'` (per-turn, comme state_vitesse).

**`client/src/components/CombatActionWindow.jsx` (PJ) :**
- Nouveau state `combatMode` ('normal'|'offensif'|'charge')
- Mode selector : 3 chips avec tooltips LdB dans le panneau melee droit
- **Charge flow séquentiel** : clic Charge → `handleChargeFlow()` → onEnterMoveMode (zone lente uniquement, `chargeAllures = {lente×4}`) → onMoveSelected → auto-enchaîne onEnterTargetMode CaC
- Bug A corrigé : chip 'move' inerte si `combatMode === 'charge'` (évite conflit de queue)
- Bug B corrigé : `handleChargeFlow` clear `moveSelection` + retire 'move' de `mapSelected` en entrée
- `meleeValid` : Charge requiert aussi `moveSelection != null`
- Payload : `state.combat_mode: combatMode`, `move.ini_mod: 0` pour Charge

**`client/src/components/CombatGmDeclareWindow.jsx` (GM) :**
- **Panneau droit étendu** : fenêtre 440→720px quand `isMeleeSetup`, panneau vert droit 280px avec mode selector + statut/feedback
- Clic CaC → `meleePendingMode = true` (chips visibles **immédiatement** avant queue)
- Chip Normal/Offensif → démarre `handleStartMeleeQueue()`. Chip Charge → démarre `handleStartChargeQueue()`
- **Queue Charge PNJ combinée** : `chargeQueueRef` + `chargePhaseRef` ('move'|'target') — pour chaque PNJ : onEnterMoveMode (lente seulement) puis onEnterTargetMode, `chargeSelections[tokenId] = { move, targetTokenId }`
- **Batch libre** : `toggleSelect` sans type guard, `selectAll` tous PNJs. Filtre ranged **uniquement** dans `handleStartAttackQueue.filter(isRanged)`
- Payload Charge : `state.combat_mode = 'charge'` + `move = chargeInfo.move (ini_mod=0)` + `melee = { targetTokenId: chargeInfo.targetTokenId }`
- Bug corrigé : `isAttackActive` ne s'active plus pendant la queue melee (`attackQueueRef.current.includes(...)` requis)
- Bug corrigé : `handleStartMeleeQueue`/`handleStartAttackQueue` reset la queue adverse (boutons "Passer" fantômes éliminés)

**Pièges identifiés :**
- **PC-CaC6** : distance melee validée **Phase 2 uniquement** (post-déplacement). Phase 1 = intention libre, aucun refus.
- **PC-CaC7** : seuil "engagé au contact" = 3m fixe. L'allonge ne s'applique qu'à la portée d'attaque (≤ 3+allonge), pas au seuil de Charge (> 3m).
- **PC-CaC8** : `chargeAllures = { lente × 4 }` côté UI — limite visuellement à move_short. Côté serveur, `chargeMove = state.combat_mode==='charge' && mapActions.move → ini_mod = 0` (toute zone free V1, documenté comme simplification).
- **PC-CaC9** : batch type guard supprimé de la sélection — uniquement appliqué au démarrage de la queue assault (`targetIds.filter(isRanged)`). Ne jamais réintroduire le guard à la sélection.

**Sprint CaC 2 ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 67 — D10 UV texturing V2 — Dette fermée (2026-05-31)

La dette "D10 UV texturing V2 — modèle Blender .glb (PE33)" est considérée résolue. La refonte DicePanel v3 (session 65) en objet 3D intégral a rendu superflue la création d'un modèle Blender dédié au D10. Le rendu Html overlay V1 (`position=[0,0,0]`) est satisfaisant dans le contexte 3D actuel.

**Modifications docs :**
- `CLAUDE.md` : retrait de la dette D10 UV texturing V2
- `ASBUILT.md` : retrait de la ligne D10 UV texturing dans "V2 / todo" (section Dice Rework)

---

## Session 68 — Correctif DashboardPage : formulaire "Rejoindre avec un code" restauré (2026-05-31)

**Régression identifiée :** Le formulaire pour rejoindre une campagne avec un code d'invitation (`#2b5140ba`) était absent depuis la refonte card-based UI (Session ~45). Les états `showJoin`/`inviteCode` et le handler `handleJoin` existaient dans le fichier, mais aucun bouton ni formulaire n'était rendu dans le JSX. Identiquement, cliquer sur la card "+" déclenchait `setShowCreate(true)` sans afficher de formulaire. Régression non détectée depuis plusieurs sessions.

**`client/src/pages/DashboardPage.jsx` :**
- Bouton "Rejoindre avec un code" ajouté en haut du content (aligné droite) — `setShowJoin(true)` + ferme `showCreate`
- `{showJoin && <form>}` : input `inviteCode` + Rejoindre + Annuler
- `{showCreate && <form>}` : input `newCampaignName` + Créer + Annuler
- `<div className="create-plus">+</div>` supprimé des deux occurrences (redondant avec le `::before` watermark CSS)
- onClick des cards create : `{ setShowCreate(true); setShowJoin(false) }` — ferme mutuellement les deux formulaires
- Styles ajoutés : `actionsRow`, `btnSecondary`, `inlineForm`, `input`, `btnGhost`

**`client/src/index.css` :**
- `.campaign-create` : ajout `display:flex`, `flex-direction:column`, `align-items:center`, `justify-content:center`, `min-height:180px`, `cursor:pointer` — label texte centré dans la card, hauteur minimale cohérente avec les campaign-cards

---

## Session 68 — Sprint CaC 3 — Défensif et Retraite (2026-05-31)

**Objectif :** Implémenter les modes Défensif (+3 défense) et Retraite (+5 défense + recul optionnel), déjà en DB depuis CaC2.

**`client/src/components/CombatActionWindow.jsx` (PJ) :**
- `meleeDefensif` déclaré ligne 330 — avant handleMapToggle et mapActionsObj (fix TDZ : temporal dead zone)
- Chips : tous 5 modes même couleur verte (`#70c070` actif / `#7a9a7a` inactif) — bug fix couleurs bleues résiduelles
- `mapActionsObj.melee = null` si `meleeDefensif` — pas de coût INI attaque
- Payload `melee = null` si `meleeDefensif` — serveur ne reçoit aucune cible
- Section cible masquée : `{!meleeDefensif && <div>Cible...}` — UI sans target en mode passif
- `meleeValid` : `meleeDefensif` suffit sans cible ni moveSelection
- `handleMapToggle` CaC : clear `moveSelection` si combatMode retraite/charge
- **`handleRetraiteMove()`** : toggle (annuler si déjà sélectionné), `retraiteAllures = {lente×4}`, appel `onEnterMoveMode`, stocke `moveSelection.ini_mod=0`
- Section "Recul (optionnel)" visible uniquement si `combatMode === 'retraite'`
- Fix bug : clic Défensif/Retraite ne revert plus l'arme QB — état arme inchangé (règle LdB)
- Resets `setCombatMode('normal')` dans les deux useEffects de changement de tour

**`server/src/socket/index.js` :**
- `freeMove` : `(state.combat_mode === 'charge' || state.combat_mode === 'retraite') && !!mapActions?.move`
- `iniDelta` override : `freeMove ? 0 : mapActions.move.ini_mod` — recul Retraite ne coûte pas d'INI
- `resolveMeleeAction` PNJ : `chanceDefense += 3` si défensif, `+= 5` si retraite
- `COMBAT_MELEE_DEFENSE_CONFIRM` PJ : même application sur `chanceDefense`

**Pièges identifiés :**
- **TDZ** : en JS `const` inaccessible avant sa ligne de déclaration dans la même fonction — placer toutes les constantes dérivées avant leurs usages dans mapActionsObj et handlers
- **Chip colors** : styles inline CSS sans classe → bug couleur difficile à détecter sans lire le JSX complet

**Sprint CaC 3 ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 68 — Timer auto-skip (2026-05-31)

**Objectif :** Activer la fonctionnalité timer auto-skip existante (code serveur déjà présent mais `action_timer_sec` toujours à 0) via une option de campagne.

**Migration 65 :**
- `campaigns.action_timer_sec INTEGER NOT NULL DEFAULT 0` — 0 = infini (backward compatible)

**`server/src/routes/campaigns.js` :**
- PUT `/:id` : destructure + valide `action_timer_sec` (entier ≥ 0, `Number.isInteger`) + `updates` + `returning`

**`server/src/socket/index.js` :**
- `COMBAT_START` : fetch `campaigns.action_timer_sec` → stocké dans `combat_state.action_timer_sec` (remplace le `0` hardcodé)
- Helper `startAnnouncementTimers(io, campaignId, timerSec, gmUserId)` : extrait le bloc timer de `COMBAT_ANNOUNCE_START`. Guard `timerSec > 0`. Filtre : `character.user_id === gmUserId` (exclut PNJs **et** PJ du GM). `combatTimers` Map initialisée si absente.
- `COMBAT_ANNOUNCE_START` : remplace le bloc timer inline par l'appel au helper
- `endTurn` : `.returning('action_timer_sec')` sur l'UPDATE `combat_state` + fetch `gmUserId` via `campaign_members WHERE role='gm'` + appel helper → **timers relancés à chaque tour, pas seulement le tour 1**

**`client/src/pages/CampaignSettingsPage.jsx` :**
- State `actionTimerSec` (default 0), init depuis `campaign.action_timer_sec ?? 0`
- Input numérique `min=0` dans section "Règles de jeu" (après reloadMode)
- PUT inclut `action_timer_sec: actionTimerSec`, ajouté aux deps `useCallback`

**`client/src/locales/fr.json` :**
- `settings.actionTimerLabel` + `settings.actionTimerHint`

**Pièges identifiés :**
- **DEFAULT 0 obligatoire** (pas 30) : `ALTER TABLE ADD COLUMN NOT NULL DEFAULT 30` s'applique aux lignes existantes → breaking change silencieuse
- **gmUserId dans helper** : `character.user_id === gmUserId` conservé (original correct) plutôt que `character.type === 'pnj'` — couvre aussi le cas PJ du GM
- **endTurn sans socket** : `gmUserId` récupéré via `db('campaign_members').where({ role: 'gm' })` — pas de dépendance au socket
- **Race condition** couverte : guard `has_announced` dans le helper + guard `skipPlayer`
- **Migration manuelle** : `npx knex migrate:latest` depuis `server/` — les migrations ne tournent pas au démarrage

**Timer auto-skip ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 68 — Pause Rework Timeline (2026-05-31)

Plan de rework `CombatTimeline.jsx` initié, mis en pause pour réflexion.
Plan complet dans `docs/PLAN_REWORK_TIMELINE.md`.

**Bug critique identifié :**
- Phase ANNONCE : ordre doit être **croissant** (lents d'abord) — actuellement trié DESC → affiché dans le mauvais ordre
- Phase RÉSOLUTION : ordre DESC correct
- Règle Polaris : les rapides voient les déclarations des lents (broadcast `COMBAT_ACTION_DECLARED` déjà correct serveur)

**Chantier à venir (sprint dédié) :**
- Enrichissement broadcast roster : `worst_wound_severity` par personnage
- Propagation `action_timer_sec` au client (SESSION_JOIN + COMBAT_STARTED + COMBAT_PHASE_CHANGED)
- `combatStore` : ajout `actionTimerSec`
- `CombatTimeline.jsx` : réécriture complète (tri dynamique par phase, cards BG3, countdown, bordure blessure)

## Session 68 — Annulation plan CombatTimeline (2026-05-31)

Le plan `docs/PLAN_REWORK_TIMELINE.md` est annulé et supprimé. Rework visuel Timeline = hors scope. Chantier réel = rework mécanique des tours (ordre annonce séquentiel ASC LdB p.212) — voir sprint dédié à venir.

---

## Session 69 — Déploiement serveur Alpha "Kiwi" + correctifs UI (2026-06-01)

Session démarrée avec l'ouverture du serveur Alpha "Kiwi" (serveur maison Linux derrière box Bouygues). Voir `docs/SERVEURDISTANTKIWI.md` pour la documentation complète du déploiement.

### Déploiement Kiwi ✅

**Nettoyage redis.js (serveur) :**
- Suppression log debug `[Redis] REDIS_PASSWORD lu: ...` et variable orpheline `const _rp`
- Correction commentaire header (approche REDIS_PASSWORD — pas parsing URL)

**skip-worktree ✅ — 3 fichiers protégés sur Kiwi :**
```bash
git update-index --skip-worktree docker-compose.yml
git update-index --skip-worktree server/src/lib/redis.js
git update-index --skip-worktree client/vite.config.js
```
Vérifié : `git ls-files -v | grep "^S"` retourne les 3 fichiers avec flag `S`.

**systemd — remplacement des terminaux ouverts :**
- `enclume-server.service` : `ExecStart=/usr/bin/node --env-file=../.env --es-module-specifier-resolution=node src/index.js`, `Restart=on-failure`, `enabled`
- `enclume-client.service` : `ExecStart=/home/didier/Enclume/client/node_modules/.bin/vite --host --port 8193`, `enabled`
- Les deux démarrent au boot, survivent aux déconnexions SSH, redémarrent en cas de crash
- `journalctl -u enclume-server -f` pour les logs temps réel

**SSH keepalive :**
- Serveur : `ClientAliveInterval 120` + `ClientAliveCountMax 10` dans `/etc/ssh/sshd_config` + `sudo systemctl restart ssh`
- Client local `~/.ssh/config` : `ServerAliveInterval 60` + `ServerAliveCountMax 5`

**Fix critique — `client/src/lib/api.js` :**
- `baseURL: 'http://localhost:3001/api'` → `baseURL: \`${import.meta.env.VITE_API_URL}/api\``
- Cause : depuis un navigateur distant, `localhost:3001` est l'adresse du client (pas du serveur) → 0 requêtes reçues par Express, nodemon silencieux
- Appliqué local + serveur (Kiwi)
- Piège documenté P-SRV-6 dans SERVEURDISTANTKIWI.md

**Pièges découverts et documentés :**
- P-SRV-6 : api.js baseURL hardcodée → inutilisable en distant
- P-SRV-7 : SSH timeout Kiwi → ClientAliveInterval côté serveur + ServerAliveInterval côté client
- P-SRV-8 : Claude Code SIGILL sur ce serveur (CPU sans x86-64-v2) — même cause que MinIO récent

**Test fonctionnel ✅ :**
- Création de compte + login ✅
- Dashboard + création campagne ✅
- Import pack de textures via Export/Import (pas ZIP fait-maison sans manifest) ✅

**Bug pack textures (résolu en cours) :**
- Pack migré sans `created_by` (NULL) → bouton Supprimer absent (`isOwner = false`)
- Fix SQL : `UPDATE texture_packs SET created_by = '<uuid>' WHERE id = '<pack_vide>'`
- Fix code : voir Fix WorkshopPage ci-dessous

---

### Fix WorkshopPage — canDelete ✅

*`client/src/pages/WorkshopPage.jsx`*
- `const canDelete = isOwner || !selectedPack?.created_by` — pack sans propriétaire (migré/NULL) supprimable
- Bouton Export conservé sous `{isOwner && ...}` (séparé du delete)
- Bouton Supprimer sous `{canDelete && ...}`

*`server/src/routes/texture-packs.js`* — DELETE `/:id`
- `if (pack.created_by !== req.user.id)` → `if (pack.created_by && pack.created_by !== req.user.id)`
- `created_by = NULL` → suppressible par tout utilisateur authentifié

**Bonne pratique retenue :** ne jamais faire de DELETE SQL direct sur un pack — la route gère le nettoyage MinIO (objets + `pack_archive.zip`). Passer toujours par l'UI.

---

### Fix titres onglets navigateur ✅

*`client/index.html`* : `<title>Enclume</title>` (fallback par défaut)

`document.title` via `useEffect` dans 6 pages :

| Page | Titre | Notes |
|---|---|---|
| LoginPage | `Enclume — Connexion` | +import useEffect |
| RegisterPage | `Enclume — Inscription` | +import useEffect |
| DashboardPage | `Enclume — Tableau de bord` | useEffect déjà importé |
| WorkshopPage | `Enclume — Atelier` | useEffect déjà importé |
| CampaignSettingsPage | `Enclume — Paramètres campagne` | useEffect déjà importé |
| SessionPage | `Enclume — ${campaign.name}` | dynamique, dépend de `[campaign]` |

**Dette ouverte :** WorkshopPage écran blanc lors d'un import invalide — `err.response?.data?.error` est un objet AppError `{message, code}`, pas une string → crash React au render. Fix : extraire `.message`. Sprint futur.

---

## Session 69 — Fix serveur local cassé après config Kiwi (2026-06-01)

**Cause :** `server/package.json` script `dev` modifié pour la config systemd du serveur distant Kiwi :
```
"dev": "nodemon --exec 'node --env-file=../.env --es-module-specifier-resolution=node' src/index.js"
```
Guillemets simples non supportés sous Windows (cmd.exe via npm) — nodemon tentait d'exécuter `'node` (apostrophe incluse) comme commande, échec immédiat au démarrage.

**Fix :** Revenu à `"dev": "nodemon src/index.js"` — `server/src/index.js` charge déjà le `.env` via `dotenv.config({ path: '../.env' })`.

**Impact serveur distant :** Aucun — systemd utilise `ExecStart=/usr/bin/node --env-file=../.env ...` directement, pas `npm run dev`.

**Fix ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 69 — Fix export pack de textures (2026-06-01)

**Symptôme :** "Erreur lors de l'export" sur tout pack dans l'Atelier GM. HTTP 500 côté serveur.

**Cause racine — bug SDK MinIO v8 + HTTP HEAD :**
- `statObject` utilise une requête HTTP HEAD (pas GET)
- HTTP HEAD n'a jamais de corps de réponse — le XML S3 `<Code>NoSuchKey</Code>` est impossible à envoyer
- Le SDK MinIO `parseResponseError` : si XML présent → extrait `<Code>` → `err.code = 'NoSuchKey'` ; si pas de XML (HEAD) → fallback HTTP status → pour 404 : `err.code = 'NotFound'`
- Le code vérifiait `err.code === 'NoSuchKey'` → jamais vrai pour `statObject` → branche `else { throw err }` → 500

**Fix :** `server/src/routes/texture-packs.js` ligne 300 :
```js
// AVANT
if (err.code === 'NoSuchKey') {
// APRÈS
if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
```

**Note :** même faille présente dans `assets.js:51` et `textures.js:28` — non symptomatique car les assets existent toujours avant d'être servis. À corriger en sprint dédié si besoin.

**Fix ✅ CONFIRMÉ FONCTIONNEL**


---

## Session 70 — Seed ref_equipment sur Kiwi (2026-06-01)

**Problème :** `ref_equipment` vide sur Kiwi — les migrations créent la structure, mais le seed `2_seed_equipment.js` n'avait jamais été lancé sur le serveur distant.

**Cause secondaire :** chemin hardcodé dans `2_seed_equipment.js` pointait vers `docs/Character/script Extraction Excel/equipement/STEP1_cleaned_data.js` alors que le fichier source est dans `docs/Old/`.

**Fix — `server/src/db/seeds/2_seed_equipment.js` ligne 30 :**
```js
// AVANT
'../../../../docs/Character/script Extraction Excel/equipement/STEP1_cleaned_data.js'
// APRÈS
'../../../../docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js'
```
Validé en dry run local avant push.

**Sur Kiwi :**
- Conflit `git pull` sur `client/src/lib/api.js` (fix VITE_API_URL appliqué manuellement en session 69, identique dans git) → `git checkout -- client/src/lib/api.js` puis `git pull`
- `git update-index --skip-worktree client/src/lib/api.js` — ajouté aux fichiers protégés
- Seed lancé : **715 items insérés**, 2 rejections non bloquantes (`Oxyma` + `Poing Kryss` — `init_mod` invalide dans la source), 207 NT=1 par défaut (comportement normal, corrigeable via admin)

**✅ CONFIRMÉ FONCTIONNEL**

---

## Session 70 — Sprint Token par défaut campagne (2026-06-01)

**Objectif :** Corriger le crash écran noir du playground lors de l'ajout d'un token sans modèle 3D, et permettre au GM de configurer un token de fallback par campagne.

### Diagnostic du crash

`Canvas3D.jsx` définissait `DEFAULT_TOKEN_URL = /api/assets/tokens/default.glb` comme fallback pour tout token sans `character.glb_url`. Ce fichier n'existe pas dans MinIO → `useGLTF` throw → crash R3F (écran noir). Aucun `ErrorBoundary` en place.

### Hiérarchie fallback token (finale)

| Priorité | Source | Rendu |
|---|---|---|
| 1 | `character.glb_url` | `TokenGlbBody` — modèle propre au personnage |
| 2 | `campaign.default_token_glb_url` | `TokenGlbBody` — token uploadé par le GM dans les options |
| 3 | `/models/default.glb` (bundle statique) | `TokenGlbBody` — toujours présent |
| 4 | `TokenFallbackBody` (capsule) | `TokenGlbErrorBoundary` — filet si useGLTF crash |

### Migration 66 — `campaigns.default_token_glb_url`

`server/src/db/migrations/66_campaign_default_token.js` : `ALTER TABLE campaigns ADD COLUMN default_token_glb_url TEXT`

**Piège découvert :** le serveur ne lance pas `db.migrate.latest()` au démarrage → la migration 66 non appliquée sur Kiwi faisait échouer le `PUT /campaigns/:id` (clause `.returning(['default_token_glb_url'])` → colonne inconnue → "Erreur lors de l'enregistrement"). Fix : ajout `await db.migrate.latest()` dans `startServer()` de `server/src/index.js`.

### Fichiers modifiés

**`client/src/components/Canvas3D.jsx` :**
- Import `Component` depuis react (pour ErrorBoundary class)
- `HARDCODED_DEFAULT_TOKEN_URL = '/models/default.glb'`
- Suppression `DEFAULT_TOKEN_URL` (pointait vers MinIO inexistant)
- `TokenGlbErrorBoundary` : class ErrorBoundary → `hasError` → rend `TokenFallbackBody` si `useGLTF` crash
- `TokenGlbBody` : extrait de `TokenMesh`, contient `useGLTF` + `useMemo clonedScene` + `<primitive>`
- `TokenFallbackBody` : capsule colorée (token.color, transparent si GM layer) — jamais appelée directement
- `TokenMesh` : ne contient plus `useGLTF`. Rend `<TokenGlbErrorBoundary> → <TokenGlbBody>` avec `glbUrl` toujours défini
- `Scene` : `glbUrl = character?.glb_url || defaultTokenGlbUrl || HARDCODED_DEFAULT_TOKEN_URL`
- Props : `defaultTokenGlbUrl` ajouté à `Scene` et `Canvas3D`

**`server/src/routes/campaigns.js` :**
- Import `multerGlb` ajouté
- Route `POST /:id/default-token` : upload GLB → MinIO `campaigns/<id>/default-token` → update `default_token_glb_url = "campaigns/<id>/default-token?v=<timestamp>"`
- `PUT /:id` : destructure + update `default_token_glb_url` (accepte `null` pour réinitialiser), ajouté au `.returning()`

**`server/src/index.js` :**
- `await db.migrate.latest()` ajouté dans `startServer()` entre la vérif DB et MinIO — migrations auto au boot

**`client/src/pages/SessionPage.jsx` :**
- Prop `defaultTokenGlbUrl` passée à `<Canvas3D>` : `campaign?.default_token_glb_url ? ${VITE_API_URL}/api/assets/... : null`

**`client/src/pages/CampaignSettingsPage.jsx` :**
- Import `useRef` ajouté
- States : `defaultTokenGlbUrl`, `uploadingToken`, `uploadTokenStatus`, `tokenFileInputRef`
- `load()` : `setDefaultTokenGlbUrl(campaign.default_token_glb_url ?? null)`
- `handleUploadDefaultToken` : FormData → `POST /:id/default-token` → update state + feedback
- `handleClearDefaultToken` : `PUT /:id { default_token_glb_url: null }` → reset state
- Section "Tokens 3D" : statut chargé/non chargé + bouton upload + bouton Réinitialiser (si token chargé) + feedback succès/erreur

**`client/src/locales/fr.json` + `en.json` :** +8 clés `settings.defaultToken*` + `actionTimerLabel/Hint` en en.json

**Sprint Token par défaut campagne ✅ CONFIRMÉ FONCTIONNEL**

## Session 71 — Sprint Timeline BG3-style (2026-06-01)

**Objectif :** Refonte complète de `CombatTimeline.jsx` — portraits illustrés plein format, bordure blessure, carte active agrandie, indicateur de phase + flèche directionnelle, timer de tour.

### Design et architecture

Phase de design longue avant toute ligne de code : références pros analysées, questions design tranchées une par une.

**Références :**
- [Foundry VTT SCS](https://github.com/arcanistzed/scs) — même architecture Annonce/Résolution que Polaris
- [Motion/framer-motion](https://motion.dev/docs/react-layout-animations) — FLIP animations liste triée dynamique

**Décisions architecturales :**
- ANNOUNCEMENT : 1 card/acteur depuis `roster[]`, tri ASC initiative (lents à gauche)
- RESOLUTION : 1 card/action depuis `actions[]`, tri ASC sequence (acteur multi-action = cartes adjacentes)
- Sens fixe gauche->droite. Curseur droite->gauche (ANNOUNCEMENT), gauche->droite (RESOLUTION)
- Les cartes ne se réordonnent PAS entre les phases — transition enter/exit via AnimatePresence
- Librairie `motion` v12 (anciennement framer-motion) — React 19 + Vite 8 compatible, 5 packages
- MAX_CARDS = 12, badge +N pour le surplus
- Plan documenté dans `docs/PLAN_TIMELINE.md`

### Données ajoutées

**`worst_wound_severity` par personnage :**
- `characters.js` GET /campaigns/:id/characters : subquery corrélée SQL (char_sheet -> character_wounds ORDER BY gravité LIMIT 1)
- `char-sheet.js` : helper `getWorstWoundSeverity(charSheetId)` + champ ajouté aux 3 payloads WS : WOUND_ADDED, WOUND_UPDATED, WOUND_REMOVED
- `SessionPage.jsx` : +`updateCharacter` au destructure useCharacterStore, patch WOUND_ADDED, +listeners WOUND_UPDATED/WOUND_REMOVED

**Piège identifié :** `upsertCharacter` = remplacement complet. Utiliser `updateCharacter` (merge partiel) pour les updates wound.

**Timer de tour :**
- `actionTimerSec` propagé : SessionPage -> CombatOverlay -> CombatTimeline
- Countdown dans CombatTimeline via useEffect dependant de activeTokenId
- Couleur : vert > 50% / orange 25-50% / rouge < 25%
- Visible uniquement en ANNOUNCEMENT si action_timer_sec > 0

### Fichiers livrés

- `client/package.json` : +motion
- `server/src/routes/characters.js` : +subquery worst_wound_severity
- `server/src/routes/character/char-sheet.js` : +helper getWorstWoundSeverity + 3 payloads WS
- `client/src/pages/SessionPage.jsx` : +updateCharacter, +3 listeners wound, +actionTimerSec CombatOverlay
- `client/src/components/TimelineCard.jsx` : NOUVEAU — portrait plein format, gradient overlay, bordure severite
- `client/src/components/CombatTimeline.jsx` : Reecriture — Motion FLIP, phases, timer, MAX 12
- `client/src/components/CombatOverlay.jsx` : +actionTimerSec prop
- `docs/PLAN_TIMELINE.md` : NOUVEAU — memoire externe du sprint

**Sprint Timeline CONFIRME FONCTIONNEL**

## Session 73 — Correctifs UX (2026-06-01)

### Correctif : Dashboard — Cartes Créer/Rejoindre symétriques

**Avant :** "Créer" = carte cliquable dans la grille, "Rejoindre" = bouton texte isolé en haut à droite. Asymétrie visuelle + mécanique "code invitation" non explicite.
**Après :** deux cartes identiques en fin de grille, chacune avec formulaire inline.

**Fichiers modifiés :**
- `client/src/locales/fr.json` : +`dashboard.joinCard` + `dashboard.codePlaceholder` (#code-invitation)
- `client/src/index.css` : +`.campaign-join` (filigrane `→`, miroir de `.campaign-create`) + `margin-bottom: 12px` harmonisé sur `.create-label`
- `client/src/pages/DashboardPage.jsx` :
  - Suppression états `showCreate`/`showJoin` et formulaires inline au-dessus de la grille
  - Suppression `actionsRow` (bouton "Rejoindre" isolé)
  - Deux cartes permanentes en fin de grille : "Rejoindre une campagne" (→) + "Créer une campagne" (+)
  - Chaque carte contient son formulaire inline (input + bouton submit)
  - Clic fond de carte → focus input via refs `createInputRef`/`joinInputRef`
  - Suppression styles orphelins : `actionsRow`, `btnSecondary`, `inlineForm`, `input`, `btnGhost`

**Dashboard Créer/Rejoindre CONFIRMÉ FONCTIONNEL**

### Correctif : Billboarding étiquettes de nom tokens

Les `<Text>` drei étaient enfants du `<group rotation={[0, rotationY, 0]}>` — ils héritaient la rotation du token et ne faisaient pas face à la caméra.

**Fix :** ajout de `<Billboard>` (drei) autour des deux `<Text>` (label + badge GM).

**Fichier modifié :**
- `client/src/components/Canvas3D.jsx` : +`Billboard` dans l'import drei, wrapping des deux `<Text>` dans `<Billboard>` (positions inchangées)

**Billboarding étiquettes CONFIRMÉ FONCTIONNEL**

### Correctif : Couleur des étiquettes de nom — user_color en temps réel

**Cause :** `tokens.color` est copié depuis `characters.color` à la création du token. Si l'utilisateur change sa couleur de profil après, le token reste à l'ancienne valeur. Le GET `/battlemaps/:id` ne faisait pas de JOIN → `users.color` jamais retourné.

**Fix :**
- `server/src/routes/battlemaps.js` GET `/:id` : LEFT JOIN `characters` + `users` via `characters.user_id`, `users.color as user_color` ajouté au SELECT. Clauses WHERE qualifiées `tokens.*` pour éviter l'ambiguïté SQL.
- `client/src/components/Canvas3D.jsx` `TokenMesh` : `const color = token.user_color || token.color || '#4A90D9'`

**Comportement confirmé :** PNJs (pas de `character_id` → pas de `user`) restent bleu par défaut — attendu et accepté.

**Couleur étiquettes CONFIRMÉ FONCTIONNEL**


---

## Session 72 � Sprint CaC 4a : Multi-adversaires (2026-06-01)

### R�gle impl�ment�e � LdB p.224

Malus CaC quand un personnage est entour� d'adversaires distincts :
- 2 adversaires ? -5
- 3 adversaires ? -7
- 4+ adversaires ? -10

**Crit�re :** tout token ennemi actif dans le roster � distance `dist2d = 3 + allonge_max_adversaire`, positions post-d�placement (Phase 2). Allonge = arme de contact �quip�e (slot MG/MD/2M, category='Arme de contact').

**Choix V1 :** `PNJ = ennemi du PJ` (et inversement) � proxy sur `character.type`. PNJ alli�s non distingu�s. Document� dans `docs/SYSTEME/COMBAT.md`.

### Fichiers modifi�s

**`server/src/socket/index.js` :**
- `multiAdversaryMalus(n)` � fonction module-level pure, table malus LdB
- `countAdversaires(tokenPos, rosterTokens, excludeId, enemyType)` � compte les tokens ennemis � port�e (avec allonge), `parseInt(t.max_allonge) || 0` pour s�curit� type DB
- `resolveMeleeAction` � `rosterTokens` ajout� au `Promise.all` (requ�te unique : `tokens ? combat_roster ? characters ? char_inventory ? ref_equipment`, group�e par token, `MAX(range::INTEGER)` avec regex guard `~ '^[0-9]+$'`)
- `multiMalusAttaquant` appliqu� � `chancesAttaque`
- `multiMalusDefenseur` calcul� apr�s fetch `defenderCharacter`, appliqu� � `chanceDefense` path PNJ et stock� dans `commonPending`
- `COMBAT_MELEE_DEFENSE_CONFIRM` : destructure `multiMalusDefenseur`, appliqu� � `chanceDefense` PJ (`?? 0` pour r�trocompat)
- `COMBAT_MELEE_RESULT` (les deux paths) : `multiMalusAttaquant` + `multiMalusDefenseur` ajout�s au payload
- `COMBAT_MELEE_DEFENSE_PROMPT` : `chanceDefenseBase` + `multiMalusDefenseur` ajout�s (info d�fenseur avant confirmation)
- `commonPending` : `multiMalusAttaquant` et `multiMalusDefenseur` ajout�s

**`client/src/components/CombatResultPanels.jsx` :**
- `CombatResultMelee` : props `multiMalusAttaquant` + `multiMalusDefenseur` ajout�s
- Bloc ? orange si l'un ou l'autre est non-nul : "? [nom] encercl� : -X"

**`client/src/components/CombatOverlay.jsx` :**
- Prompt d�fense PJ : alerte ? "Encercl� � malus -X � votre d�fense" si `multiMalusDefenseur` non nul (visible AVANT de cliquer D�fendre)
- `CombatResultMelee` : props `multiMalusAttaquant` + `multiMalusDefenseur` pass�es depuis `meleeResult`

**`docs/SYSTEME/COMBAT.md` :**
- Nouvelle section "Multi-adversaires Sprint CaC 4a" : r�gle, impl�mentation, limitation V1

**Sprint CaC 4a ? EN ATTENTE DE VALIDATION FONCTIONNELLE**

### Correctif : Drag & Drop token — précision sur terrain plat et en altitude

**Problème 1 — terrain plat :** `dragState.x/z = worldPos.x/z` (float brut, ex: 3.3). Token rendu à `3.3 + 0.5 = 3.8` au lieu du centre de case `3.5` → saut visible au début du drag.
**Fix :** `x: snappedX` / `z: snappedZ` (`Math.round(worldPos.x/z)`) — token ancré au centre de la case visée.

**Problème 2 — terrain élevé :** `raycastGround` caste contre `y=0`. Sur terrain surélevé le rayon intersecte le plan à un X/Z décalé → offset curseur/token.
**Fix :** remplacer `raycastGround` par `raycastVoxelColumn` dans le path drag. `raycastVoxelColumn` étendu avec `rawX`/`rawZ` (float avant floor) pour conserver un snap `Math.round` et un tilt continu. Le tilt utilise désormais le delta de `cell.rawX/rawZ`.

**Fichier modifié :** `client/src/components/Canvas3D.jsx` uniquement.

**Drag & Drop CONFIRMÉ FONCTIONNEL (terrain plat + altitude)**

### Note — Sprint Coût doublé compétences : SUSPENDU

Après relecture du LdB (SkillTooltips.md p.188), le "coût doublé" ne concerne que les compétences réservées (X) apprises hors profession — règle contextuelle par personnage, pas une propriété fixe par compétence. Implémenter correctement nécessiterait le suivi de la profession par personnage. Feature suspendue jusqu'à clarification du scope.

### Correctif : Panel description compétences (SkillsPanel)

`description` déjà en DB (`ref_skills.description`), seedée, servie par `select('*')`. Zéro travail serveur.

- `SkillsPanel.jsx` : state `detailPanel` + `detailPanelRef`, `useEffect` click-outside, bouton `ⓘ` dans cellule Nom (conditionnel sur `skill.description` truthy), panel `position: fixed` (échappe `overflow: hidden` de CharacterWindow), Fragment pour double racine JSX.

**Panel description compétences CONFIRMÉ FONCTIONNEL**

### Correctif : Chat par campagne — historique isolé

**Cause :** `sessionStore` gardait un tableau `messages` global — les messages d'une campagne s'accumulaient et restaient visibles dans une autre.

**Fix :**
- `sessionStore.js` : `messages[]` → `messagesByCampaign{}` (dict `[campaignId]: Message[]`) + `activeCampaignId` + `setActiveCampaign(id)`. `addMessage` route vers le bucket actif (no-op si `activeCampaignId` null). `resetSession` mis à jour.
- `SessionPage.jsx` : `setActiveCampaign(campaignId)` appelé en début de useEffect socket (avant création socket) — couvre navigation et reconnexion.
- `Sidebar.jsx` : `const messages = messagesByCampaign[activeCampaignId] || []` — reste de Sidebar inchangé.

**Note :** `resetSession` était dead code (jamais appelé nulle part). Conservé pour usage futur (logout).

**Chat par campagne CONFIRMÉ FONCTIONNEL**

### Correctif : Tooltips attributs primaires et secondaires (CharacterSheet)

- `CharacterSheet.jsx` : constante `ATTR_DESCRIPTIONS` (9 entrées LdB), state `attrTooltip`, hover `onMouseEnter/Leave` sur chaque `<th>` attribut → tooltip `position: fixed` identique à `SecondaryField`. Même pattern hover pour REA, seuilEtour, seuilIncons, modDom via prop `tooltip` existante.
- `fr.json` : +4 clés `charSheet.tooltip.reaction/seuilEtour/seuilIncons/modDom`

**Tooltips attributs CONFIRMÉ FONCTIONNEL**

### Feature : Notification "en attente du GM" — sablier entité + badge chat

**Joueur :** sablier ⏳ animé au-dessus de l'entité interactive après `ENTITY_ACTION_REQUEST`. Disparaît sur `ENTITY_ACTION_RESULT` (refus/timeout) ou `ENTITY_UPDATED` (approuvé).

**GM :** badge rouge numérique sur l'onglet "Chat" de la Sidebar — incrémente à chaque nouveau message `entity_action`, décrémente à chaque clic Accepter/Auto/Refuser.

**Architecture :**
- `sessionStore.js` : +`pendingEntityId`, `setPendingEntityId`, `clearPendingEntityId` (reset inclus dans `resetSession`)
- `SessionPage.jsx` : `setPendingEntityId(entity.id)` après émission REQUEST, `clearPendingEntityId()` dans listener ENTITY_ACTION_RESULT
- `Canvas3D.jsx` : import `useSessionStore`, `handleEntityUpdated` appelle `useSessionStore.getState().clearPendingEntityId()` si `pendingEntityId === entityId` (pattern Zustand event listener)
- `EntityMesh.jsx` : import `useSessionStore`, `isPending = pendingEntityId === entity.id` dans `EntityMeshGlb` + `EntityMeshVoxel`, nouveau composant `PendingWaitIcon` (`<Html>` drei, `className="entity-pending"`)
- `Sidebar.jsx` : state `pendingActionCount`, `useEffect([messages])` incrémente sur nouveaux `entity_action`, boutons Accepter/Auto/Refuser décrémentent, badge `styles.pendingBadge` sur onglet chat
- `index.css` : `@keyframes hourglass-flip` + `.entity-pending`

**Notification entité interactive CONFIRMÉ FONCTIONNEL**


## Session 74 — Sprint CaC 4b : Attaque multiple melee (2026-06-02)

### Sprint CaC 4b — Attaque multiple

**Règle LdB p.218 :** jusqu'à 3 attaques melee par tour, malus −5 (2 attaques) ou −7 (3 attaques) sur tous les jets d'attaque.

**Architecture :** `mapActions.melee` passe de `{ targetTokenId, weaponInvId }` (objet) à un array. Le serveur insère N lignes `type='melee'` dans `combat_actions`. Résolution séquentielle dans le même slot. Aucune migration DB.

**Pièges documentés :**
- P-4b-1 : `totalMeleeCount` passé en paramètre explicite dans `resolveMeleeAction` — appels récursifs conservent le malus
- P-4b-2 : `COMBAT_MELEE_DEFENSE_CONFIRM` chaîne les attaques restantes, `advanceSlot` seulement après la dernière
- Limitation V1 : PJ attaquant vs 2 PJ défenseurs tous touchés → dommages 1ère attaque perdus (cas impossible en coopératif)

**Fichiers modifiés :**
- `client/src/components/combatSections.js` : `calcIniDelta` melee array, INI −3 + (count > 1 ? −5 : 0), suppression ligne multi
- `server/src/socket/index.js` :
  - `COMBAT_ACTION_DECLARE` : INI delta melee array, insertion N rows, suppression bloc `mapActions?.multi`
  - `COMBAT_ACTION_CONFIRM` : séparation melee/non-melee, mark resolved upfront, appel avec remaining + totalCount
  - `resolveMeleeAction` : signature étendue, `multiAttackMalus` sur `chancesAttaque`, récursion PNJ, `remainingMeleeActions`+`totalMeleeCount` dans commonPending
  - `COMBAT_MELEE_DEFENSE_CONFIRM` : destructure remaining/totalCount, chaîne attaque suivante via fetchSockets, advanceSlot après la dernière
- `client/src/components/CombatActionWindow.jsx` :
  - `meleePendingTokenId` → `meleePendingTokenIds[]` + `meleeCount` state
  - `handleChooseMeleeTarget(idx)` — met à jour `meleePendingTokenIds[idx]`
  - Panel melee : chips nombre attaques, N lignes cible séquentielles
  - Payload : array melee, Charge = 1 cible toujours (exclusive LdB)
- `client/src/components/CombatGmDeclareWindow.jsx` :
  - `meleeAttackCount` state + chips dans panneau CaC
  - Queue étendue : `targetIds.flatMap(id => Array(meleeAttackCount).fill(id))`
  - `onTargetSelected` accumule dans `meleeSelections[id].targets[]`
  - `onCancel` saute toutes les sélections restantes pour le PNJ courant
  - Payload melee : array de cibles

**Sprint CaC 4b — EN ATTENTE VALIDATION FONCTIONNELLE**

---

## Session 75 — Sprint Bibliothèque 1 (2026-06-03)

### Objectif
Implémenter la Bibliothèque de documents de campagne : éditeur de texte riche (Quill 2.0), permissions par joueur, propagation socket temps réel.

### Migration 67 — `campaign_documents`
- Colonnes : `id UUID PK`, `campaign_id FK CASCADE`, `name VARCHAR(255)`, `content_html TEXT`, `gm_notes_html TEXT`, `viewer_ids JSONB`, `editor_ids JSONB`, `created_by FK SET NULL`, `timestamps`
- `viewer_ids` / `editor_ids` : `'none'` | `'all'` | `["user_id", ...]` — fourni explicitement à chaque INSERT (pas de default DB pour les strings JSON)

### Architecture
- **REST** : `GET/POST/PUT/DELETE /api/campaigns/:id/documents` — `Router({ mergeParams: true })`
- **Broadcast filtré** : `io.in(room).fetchSockets()` depuis la route REST, emit `DOC_CREATED/UPDATED/DELETED` uniquement aux sockets autorisés (`canView`), `gm_notes_html` retiré du payload pour les non-GM
- **Store** : `libraryStore.js` Zustand — `addDocument` upsert (évite le doublon ajout local + broadcast socket)
- **SessionPage** : fetch initial dans `loadSession`, listeners `DOC_CREATED/UPDATED/DELETED`

### Composants
- `LibraryPanel.jsx` : liste documents avec indicateurs de partage (oeil masqué / oeil ouvert / punaise colorée)
- `DocumentModal.jsx` : formulaire + 2 éditeurs Quill (description + notes GM), `PermissionSelect` dropdown multi-select avec `createPortal`

### Intégration Quill 2.0
- Pattern hook `useQuillEditor` : capture `containerRef.current` en variable locale au début de l'effect (fix React 19 — ref peut être null en cleanup)
- Cleanup : retire toolbar sibling (`previousElementSibling.ql-toolbar`), vide innerHTML et className du container
- Guard double-init : `classList.contains('ql-container')` (Quill ajoute la classe sur le container lui-même, pas dedans)
- `getHTML` : `querySelector('.ql-editor')?.innerHTML` — DOM direct, sans dépendance sur ref intermédiaire
- Handler image : file picker → base64 inline, `cleanup` flag pour éviter leak DOM si annulation

### Sidebar
- Fusion onglets "Joueurs" + "Config" → onglet "Profil" : réglages compte en haut, séparateur, liste connectés en bas
- Onglets résultants : Chat | Persos | Biblio | Profil (5 → 4)

### Pièges documentés
- **PL-Q1** : `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- **PL-Q2** : Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `querySelector('.ql-container')` incorrect, utiliser `classList.contains('ql-container')`
- **PL-Q3** : `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- **PL-Q4** : `editor.destroy()` n'existe pas en Quill 2.0 public API
- **PL-Q5** : Dropdown multi-select avec `position: absolute` coupé par `overflow: hidden` du modal → `createPortal` vers `document.body` + `getBoundingClientRect`

### Sprint Bibliothèque 1 — CONFIRMÉ FONCTIONNEL ✅

---

## Session 76 — Sprint Token Radial (2026-06-03)

### Objectif
Remplacer le menu contextuel dropdown (token clic) par un menu radial SVG hard-SF inspiré du design system Enclume (Claude Design). Cœur = boussole directionnelle pour l'orientation du token.

### Fichiers produits
- `client/src/components/TokenRadialMenu.jsx` (NOUVEAU)
- `client/src/locales/fr.json` (section `tokenRadial` +16 clés)
- `client/src/pages/SessionPage.jsx`
- `client/src/components/Canvas3D.jsx`
- `shared/events.js` (+TOKEN_SET_ROTATION)
- `server/src/socket/index.js` (+handler TOKEN_SET_ROTATION)

### Architecture — TokenRadialMenu
- SVG 370×370, centré sur le token cliqué (position:fixed, clamping écran)
- 8 secteurs égaux (45°, gap 5°) : Fiche ✅ + Retirer ✅ + 6 placeholders visuels désactivés
- Cœur disque : coloré par `character.worst_wound_severity` (bleu foncé si aucune blessure)
- Anneau de blessures Sprint 1 simplifié : piste grise 270° + 1 segment coloré à la pire sévérité
- Animation bloom entrée : scale+opacity staggeré par secteur (cubic-bezier)
- Danger pulse CSS (`trm-danger`) sur `critique`/`mortelle`
- Fermeture : clic extérieur (mousedown listener), Échap, clic cœur

### Boussole directionnelle (cœur)
- Flèche SVG permanente indiquant `token.r` courant (dim, ACCENT×55%)
- Zone direction : anneau 15–42 px du centre → flèche suit la souris snappée à 45°, ACCENT full + glow
- Zone morte : dist < 15 → clic = fermeture seule
- Calcul orientation : `r = round(atan2(dx, -dy) / (π/4)) % 8` (0=nord, 2=est, 4=sud, 6=ouest)
- Clic en zone direction → `onSetRotation(r)` + fermeture animée
- `handleCenterClick` calcule depuis `e.clientX/Y` + `getBoundingClientRect()` (pas d'état stale)

### EVENT TOKEN_SET_ROTATION (nouveau)
- Payload : `{ tokenId, r }` — r validé serveur (`Number.isInteger`, 0..7)
- Guard : même pattern que TOKEN_ROTATE (`socket.role === 'gm'` + `character.user_id === socket.data.userId`)
- Action serveur : SET absolu (vs incrément TOKEN_ROTATE)
- Broadcast : réutilise `TOKEN_UPDATED` existant

### Inversion clic Canvas3D
- `handlePointerUp` `!wasMoving` : `onTokenRotate` → `onTokenDoubleClick` (ouvre menu)
- `TokenMesh.onDoubleClick` : retiré (double-clic ne fait plus rien)
- Dep array `handlePointerUp` : retire `onTokenRotate`, ajoute `onTokenDoubleClick`
- `onTokenRotate` reste dans les signatures Canvas3D/Scene (dead code — nettoyage futur)

### Pièges documentés
- **P76-1** : `handleCenterClick` doit calculer la direction depuis `e.clientX/Y` (pas depuis l'état `mousePos`) — évite le stale closure sur double-clic rapide
- **P76-2** : `handleRemoveContextToken` sans `setContextMenu(null)` — la fermeture appartient à `doClose()` dans le composant ; appel double causerait démontage avant animation
- **P76-3** : Sur double-clic rapide, `handlePointerUp` fire deux fois (deux single-clicks) → `setContextMenu` appelé deux fois avec les mêmes valeurs, inoffensif

### Sprint Token Radial Sprint 1 — CONFIRMÉ FONCTIONNEL ✅

---

## Session 76 — Sprint Design System (2026-06-04)

### Objectif
Appliquer le design system généré par Claude Design (claude.ai/design) à partir du codebase Enclume : tokens CSS, polices, icônes de statut, et refactoring architecture CSS vers un système de classes cohérent.

### Analyse préalable
- Bundle design (`enclume-design-system`) extrait depuis l'API Claude Design — chat de 750+ lignes analysé, 20+ fichiers HTML/JSX/CSS de référence lus
- Inventaire complet de tous les boutons et badges dans les 6 composants cibles
- Architecture décidée : 3 couches (tokens `:root` / classes composants / layout inline)

### Fondations CSS — `client/src/index.css`

**Fix `@font-face`** : déclaration nichée dans `:root` (CSS invalide) — sortie au niveau top-level. Fichier `venus-rising.woff2` copié avec le bon nom (était `Venus Rising Rg.woff2`).

**36 tokens CSS ajoutés à `:root`** :
- Surfaces in-session : `--bg-session`, `--bg-session-raised`, `--bg-session-scrim`, `--border-session*`
- Couleurs soft : `--color-success-soft`, `--color-danger-soft`, `--color-warning-soft`, `--color-gold*`
- Texte session : `--text-session-hi/mid/lo`
- Blessures : `--wound-legere` → `--wound-mortelle` (5 tokens)
- Statuts HUD : `--status-dot/env/control/neuro/frame*`
- Élévation : `--shadow-window`, `--halo-active`
- `--radius-xs: 4px`
- Familles de polices : `--font-display/ui/mono/hand`

**Section 10 réécrite** — système de classes complet :
- `.btn` — bouton HUD chamfré bleu (base)
- `.btn.btn-ghost` — fantôme
- `.btn.btn-danger` — rouge
- `.btn.btn-gold` — or (bouton Agir GM)
- `.btn.btn-success` — vert
- `.btn-icon` — utilitaire sans chamfer (×, ?, ➤)
- `.btn-toggle` — sélecteur segmenté + `[data-active="true"]`
- `.btn-tool` — outil sidebar (column, icon+label)
- `.badge` + `.badge-gm/player/success/fail/mode/mode-off` — badges chamfrés
- `.btn.btn-ghost[data-active="true"]` — état actif pour sélecteurs topbar
- `.doc-row` — ligne liste document

### Assets

**15 SVG icônes HUD** copiés dans `client/public/assets/status/` : acid, asphyxia, blinded, burning, decompression, electrocuted, grappled, hypothermia, infected, irradiated, off_balance, poisoned, restrained, stunned, unconscious.

### Migration composants (7 fichiers)

Convention appliquée : `className="btn"` + supprimer props visuels des objets `styles` + garder uniquement layout en inline.

- **`DashboardPage.jsx`** : badges MJ/Joueur → `.badge-gm/player`, boutons Jouer/Créer/Rejoindre → `.btn`, Déconnexion → `.btn.btn-ghost`, Workshop → `.btn-icon`
- **`Sidebar.jsx`** : toolBtns → `.btn-tool` + `data-active`, sendBtns → `.btn-icon`, badges résultat → `.badge-success/fail`, badges rôle → `.badge-gm/player`, newCharBtn → `.btn` full-width, configSaveBtn → `.btn`, quitBtn → `.btn.btn-ghost`
- **`CombatOverlay.jsx`** : Agir → `.btn.btn-gold`, Valider → `.btn`, Changer → `.btn.btn-ghost`, Annuler → `.btn.btn-ghost`, Défendre → `.btn`
- **`CombatActionWindow.jsx`** : mode chips → `.badge-mode/mode-off`, btnDeclare → `.btn`, assaultToggleBtn/assaultVariantBtn → `.btn-toggle` + `data-active`
- **`SessionPage.jsx`** : bouton ⚔ Combat → `.btn.btn-danger` (danger en mode combat), battlemap buttons → `.btn.btn-ghost` + `data-active`, modales → `.btn/.btn-ghost`
- **`LibraryPanel.jsx`** : newBtn → `.btn` full-width, docRow → `.doc-row`

### Fix timeline — largeur

**Problème** : `CombatTimeline.styles.bar()` utilisait `right: 0` — chevauchait la sidebar en mode combat.

**Solution** : CSS custom property `--sidebar-w` posée sur `CombatOverlay` depuis `SessionPage` (`sidebarVisible ? sidebarWidth : 0`). `CombatTimeline` lit `right: 'var(--sidebar-w, 0px)'`.

Pattern identique à `DicePanel` qui recevait déjà `sidebarVisible/sidebarWidth`.

### i18n — `fr.json`
- `sidebar.quit` : `"Quitter la session"` (nouveau)
- `sidebar.newCharacter` : `"+ Nouveau personnage"` (était `"Nouveau personnage"`)
- `library.newDocument` : `"+ Nouveau document"` (était `"+ Document"`)

### Bouton Quitter la session
Ajout dans l'onglet Profil de la Sidebar (après liste connectés). `useNavigate('/dashboard')`. Fix layout : `configContent` n'a plus `flex: 1` pour laisser le bouton visible sans scroll.

### Pièges documentés
- **P76-4** : `@font-face` dans `:root {}` est CSS invalide (les at-rules de font ne peuvent pas être imbriquées dans des sélecteurs) — Chrome hisse silencieusement mais comportement non garanti → toujours déclarer `@font-face` au niveau top-level
- **P76-5** : style inline React a toujours spécificité supérieure aux classes CSS → pour qu'une classe CSS prenne effet, il faut SUPPRIMER les props visuels de l'inline style en même temps qu'on ajoute `className`
- **P76-6** : `data-active={boolean}` en React : `true` → `data-active="true"` (CSS `[data-active="true"]` match) / `false` → `data-active="false"` (pas de match) — utiliser sans workaround ✅

### Roadmap ajoutée
- **Persistance du chat** : à planifier (sprint dédié)


---

### Sprint Optimisation Voxels � Culled Mesh Phase A ? CONFIRM� FONCTIONNEL (session 76)

**Objectif** : r�duire les draw calls et polygones du playground (Canvas3D) sans toucher Editor3D ni le syst�me de raycasting fast-voxel-raycast.

**Recherche pr�alable** : Three.js manual (threejs.org/manual � voxel geometry with culled faces) = r�f�rence officielle. Aucun package npm professionnel maintenu pour ce besoin. Algorithme face culling copi� depuis la doc officielle, adapt� pour notre syst�me de mat�riaux multi-face (pas d'atlas).

**Fichiers cr��s / modifi�s :**
- `client/src/lib/buildCulledMesh.js` (NOUVEAU) : fonction pure, z�ro Three.js. FACES array = 6 face definitions (dir, physIdx P32, corners/UVs) copi�es du Three.js manual. Boucle : pour chaque cube, v�rifie 6 voisins, ajoute la face seulement si le voisin n'est pas un cube. Groupe par `${texId}_${physIdx}` ? arrays positions/normals/uvs/indices.
- `client/src/components/CulledVoxelScene.jsx` (NOUVEAU) : `useMemo([voxels])` ? buildCulledMesh ? BufferGeometry. `useEffect` dispose explicite (R3F n'auto-dispose pas quand geometry prop change sur mesh mont�). Non-cubes (slabs, slopes, wedges futurs) ? `<Voxel>` individuel inchang�.
- `client/src/components/Canvas3D.jsx` : boucle `Object.values(voxels).map(<Voxel>)` remplac�e par `<CulledVoxelScene voxels={voxels} textureMaterials={textureMaterials} />`. Import Voxel retir�.

**R�sultat** : am�lioration FPS visible sur carte complexe (confirm�). Textures correctes, �diteur voxels intact, VOXEL_ADDED/REMOVED temps r�el fonctionnels.

**Limite Phase A** : rotation r ? 0 ignor�e dans le mesher ? cubes avec textures multi-faces ET rotation non-identity peuvent afficher la mauvaise texture par face. Invisible en pratique (toutes textures actuelles utilisent `all`). Phase B : ROTATION_FACE_MAP d�riv�e et v�rifi�e par composition (appliquer r=1 deux fois = r=2 ?).

**Pi�ges d�couverts :**
- Faces order Three.js manual (left/right/bottom/top/back/front) ? P32 BoxGeometry (east(0)/west(1)/top(2)/bottom(3)/south(4)/north(5)) ? mapping `physIdx` obligatoire sur chaque face
- ROTATION_FACE_MAP : formule Three.js rotation.y=p/2 donne x'=z, z'=-x ? east(+X) va vers north(-Z), pas south. Erreur de signe facile si d�riv� informellement. V�rification par composition obligatoire.
- R3F ne dispose pas les BufferGeometry quand la prop `geometry` change sur un mesh mont� ? `useEffect` cleanup explicite obligatoire

---

## Session 77 — Sprint Optimisation Voxels Phase B : ROTATION_FACE_MAP (2026-06-04)

### Objectif
Implémenter la correction de texture des cubes voxels en rotation dans le culled mesh (dette Phase A).
Quand un cube a des textures différentes par face ET une rotation r≠0, la bonne texture doit apparaître sur chaque face du monde.

### Recherche préalable
- Three.js Manual (base de Phase A) : pas de rotation — extension documentée comme future.
- PrismarineJS/prismarine-viewer (viewer Minecraft JS professionnel) : rotation par multiplication de matrices 3×3 (`buildRotationMatrix`, `matmul3`). Valide mais surdimensionné pour notre cas (Y seul, 4 valeurs discrètes).
- Voxel-Tools (Godot) : variantes précompilées par rotation (voxel ID distinct par orientation). Inadapté.
- Minecraft Wiki (spec block model) : *"rotation amounts to permutation of the selected texture vertices"* — confirme l'approche lookup table.
- Décision : lookup table statique O(1) — plus approprié que matrices continues pour r=0..3 Y-only.

### Découverte critique
Voxel.jsx ligne 28 : `rotation * (Math.PI / 2)` → r=0..3 (quarts de tour), PAS r=0..7 comme les tokens.
Table = 4 lignes, pas 8.

### Dérivation ROTATION_FACE_MAP
Formule : pour un cube en rotation r, face monde-facing physIdx → original face = R(-θ)(physIdx).
Inverse rotation par −90°/tour : R(-90°)(+X) = +Z → east(0) ← south(4) pour r=1.

```
ROTATION_FACE_MAP[r][physIdx] → origPhysIdx (texture source)
r=0 : [0, 1, 2, 3, 4, 5]  — identité
r=1 : [4, 5, 2, 3, 1, 0]  — E←S  W←N  S←W  N←E
r=2 : [1, 0, 2, 3, 5, 4]  — E←W  W←E  S←N  N←S
r=3 : [5, 4, 2, 3, 0, 1]  — E←N  W←S  S←E  N←W
```

Vérifiée par composition (groupe cyclique d'ordre 4) : r=1×4 = identité ✓, r=1×2 = r=2 ✓, r=1×3 = r=3 ✓.

### Fichiers modifiés
- `client/src/lib/buildCulledMesh.js` : +ROTATION_FACE_MAP const, +origPhysIdx dans boucle faces, group key/physIdx utilisent origPhysIdx
- `client/src/components/CulledVoxelScene.jsx` : commentaire Phase A→B (zéro logique)

### Limite connue — testabilité
Le bug était invisible (toutes textures actuelles = `all`, même image 6 faces). La correction est aussi invisible sans texture multi-face. Validation fonctionnelle différée au premier cas d'usage réel (texture pack avec faces distinctes).

**Dette Phase B fermée.** Code correct, non régression sur r=0, non testable en pratique aujourd'hui.

---

## Session 77 — Sprint Statuts Phase 1 : badges tokens + TokenStatusPanel (2026-06-04)

### Objectif
Implanter un système de statuts visuels sur les tokens (15 statuts Polaris) sans effets mécaniques.
Accès via le secteur "Statuts" du TokenRadialMenu existant. Persistance hors combat via table dédiée.

### Décisions d'architecture
- **Interface** : bulle-grille 3×5 (sub-radial écarté — 24°/secteur illisible à 15 items)
- **Stockage** : table `token_statuses` (migration 68), pas `state_character` JSONB (scope combat uniquement)
- **Permissions** : GM ajoute+retire tout token / Propriétaire ajoute+retire son propre token
- **Transport WS** : event unique `TOKEN_STATUS_TOGGLE` (toggle) → broadcast `TOKEN_STATUS_UPDATED` tableau complet
- **SVGs** : déjà présents dans `client/public/assets/status/` — aucune copie

### Analyse préalable (run à vide)
- Pattern handler socket calqué sur TOKEN_ROTATE/TOKEN_SET_ROTATION : `socket.role`, `socket.data.userId`
- `tokenStore.updateToken(partial)` gère `statuses` sans modification — spread `{ ...t, ...partial }`
- `Html` drei utilisable dans `<Billboard>` — world position calculée indépendamment des rotations parent
- Snap stale résolu : `statusPanel` stocke `tokenId`, look-up live depuis `tokens` store au rendu
- Anti-pattern `setStatusPanel(null)` pendant render → corrigé en `useEffect`

### Fichiers créés
- `server/src/db/migrations/68_token_statuses.js` : table `token_statuses(id, token_id UUID FK CASCADE, status_code TEXT, applied_by UUID FK SET NULL, applied_at, UNIQUE(token_id, status_code))`
- `client/src/components/TokenStatusPanel.jsx` : grille 3×5, toggle, active/inactive, canToggle guard, fermeture click-dehors/Échap

### Fichiers modifiés
- `shared/events.js` : +`TOKEN_STATUS_TOGGLE` + `TOKEN_STATUS_UPDATED`
- `server/src/routes/battlemaps.js` : GET /:id enrichi — batch query `token_statuses`, `statuses[]` dans chaque token
- `server/src/socket/index.js` : handler `TOKEN_STATUS_TOGGLE` entre TOKEN_SET_ROTATION et TOKEN_CREATED
- `client/src/components/TokenRadialMenu.jsx` : secteur `statuts` activé (`enabled: true`), prop `onOpenStatusPanel`
- `client/src/pages/SessionPage.jsx` : import + state `statusPanel` + listener `TOKEN_STATUS_UPDATED` + useEffect guard + mount `TokenStatusPanel`
- `client/src/components/Canvas3D.jsx` : import `Html`, constantes `STATUS_CATEGORY` + `STATUS_CATEGORY_COLOR`, badges dans `<Billboard>` (overflow +N)
- `client/src/locales/fr.json` : section `"status"` 15 clés

### Dettes créées
- `TOKEN_CREATED` WS : nouveau token sans `statuses` → safe par `?? []` partout
- Sprint Statuts Phase 2 : option campagne `status_effects_mode` + flux choc PJ (`CombatShockWindow`) + enforcement `stunned`/`unconscious` — sprint futur
- PC42 (`is_stunned` dans COMBAT_ACTION_DECLARE) — toujours actif, non touché par ce sprint

**Sprint Statuts Phase 1 ✅ CONFIRMÉ FONCTIONNEL**

---

## Session 79 — Fix placement tokens : slab_bottom + terrain varié + TDZ crash (2026-06-04)

### Objectif
Corriger deux bugs de placement de tokens signalés en jeu :
1. Tokens qui "volent" au-dessus des demi-dalles (`slab_bottom`)
2. Précision catastrophique du drop sur terrain avec dénivelé

### Diagnostic

**Bug 1 — slab_bottom** : `getColumnTopY` retournait `v.y` (entier base), sans tenir compte de la géométrie. Une `slab_bottom` à y=2 a sa surface à y+0.5=2.5, mais le token était posé à pos_z=2 → pieds à 3.0 → flottait 0.5 au-dessus. `tokens.pos_z` est FLOAT — aucune migration nécessaire.

**Bug 2 — précision drop** : `handlePointerUp` raycatstait depuis la *position du curseur* au moment du relâchement, pas depuis la *position affichée du ghost*. Le curseur est souvent caché sous le token ou décalé en 3D perspective. Résultat : décalage 1–10 cases selon l'angle de vue.

**Correction fondamentale (confirmée par recherche FoundryVTT v12–v14, Three.js forum, XCOM/BG3)** : le drop doit confirmer la position déjà affichée par le ghost, jamais re-raycaster depuis le curseur. C'est le pattern universel dans tous les systèmes documentés.

### Fichiers modifiés
- `client/src/components/Canvas3D.jsx`
- `client/src/pages/SessionPage.jsx` (fix TDZ séparé)

### Architecture

**`getVoxelSurfaceTop(v)` — fonction module-level :**
```js
function getVoxelSurfaceTop(v) {
  if (v.geo === 'slab_bottom') return v.y + 0.5
  return v.y + 1.0
}
```

**`colTopSurface` useMemo (remplace `getColumnTopY` useCallback O(N)/frame) :**
```js
const colTopSurface = useMemo(() => {
  const map = {}
  for (const v of Object.values(voxels)) {
    const key = `${v.x}:${v.z}`
    const surf = getVoxelSurfaceTop(v)
    if (map[key] === undefined || surf > map[key]) map[key] = surf
  }
  return map
}, [voxels])
```
O(1) par lookup, reconstruit uniquement quand `voxels` change.

**`dragRef` enrichi** — `snappedX`, `snappedZ`, `surfaceY` stockés à chaque frame de drag (dans `handlePointerMove`).

**`handlePointerUp` drop** — lit `dragRef.current.snappedX/Z/surfaceY` directement. Aucun raycast. `threeToDb(snappedX, surfaceY - 1.0, snappedZ)`.

**Ghost overlay entité** — mis à jour : `(colTopSurface[x:z] ?? 0) + 0.05` (ancienne formule `getColumnTopY + 1 + 0.05` incorrecte pour slabs).

**Polissage** : `Math.round` → `Math.floor` dans `handlePointerMove` — un voxel occupe `[x, x+1)` donc `Math.floor` évite le ghost qui saute sur la case voisine en bord de voxel.

### Fix TDZ SessionPage
`const [statusPanel, setStatusPanel] = useState(null)` déclaré ligne 688 mais utilisé dans un `useEffect` ligne 256 → TDZ crash au démarrage. Déclaration déplacée avec les autres `useState` en tête du composant (ligne ~49).

### Pièges documentés
- **Drag-and-drop 3D** : ne jamais re-raycaster au drop — utiliser la position du ghost. Pattern universel (FoundryVTT, XCOM, BG3). Voir memory `feedback_dragdrop_ux.md`.
- **`Math.floor` vs `Math.round`** : un voxel occupe `[x, x+1)` en Three.js. `Math.floor` pour la colonne, pas `Math.round`.
- **`getVoxelSurfaceTop`** : dette future pour `slope`/`wedge` (géométries non implémentées, default `v.y+1.0` acceptable).
- **TDZ React** : `const` utilisé dans dep array d'un `useEffect` avant sa déclaration dans le corps du composant → crash. Toujours déclarer les `useState` avant les `useEffect` qui les utilisent.

**Session 79 ✅ CONFIRMÉ FONCTIONNEL**

## Session 80 — Sprint Bibliothèque 2 : upload image MinIO dans l'éditeur (2026-06-04)

### Objectif
Remplacer les images base64 inline dans l'éditeur Quill (Bibliothèque documents) par un vrai upload MinIO. L'image est stockée dans MinIO et une URL `/api/assets/` est insérée dans le contenu HTML du document.

### Décisions de périmètre
- **Images uniquement** (jpeg, png, webp, gif) — `multerUpload` existant gère déjà ces MIME types
- **PDF exclu** : le projet sera proposé sur les forums Polaris (GMs inconnus). `Content-Disposition: attachment` mitigue le vecteur JS inline mais ne protège pas contre les exploits lecteur PDF au téléchargement. Reporté avec analyse sécurité dédiée.
- **Pièce jointe séparée (`file_url`)** : non retenue — images directement dans le corps Quill. Pas de migration 69 nécessaire pour ce sprint.
- **GM uniquement** : seul le GM peut créer et éditer des documents (règle existante confirmée).

### Fichiers modifiés
- `server/src/routes/documents.js`
- `client/src/components/DocumentModal.jsx`

### Architecture

**Serveur — `documents.js`**
- Nouveaux imports : `randomUUID`, `path`, `multerUpload`, `getMinioClient`, `BUCKET`
- Route `POST /upload-image` ajoutée avant `GET /:docId` (P46 — route statique avant paramétrique)
- Chemin MinIO : `campaigns/<campaignId>/documents/<uuid>.<ext>`
- Pattern identique à `campaigns.js` cover : `multerUpload.single()` + `minio.putObject()` manuel (pas `uploadToMinio` — qui retourne une URL MinIO directe inutilisable derrière le proxy)
- Guards : membre campagne + rôle GM + `req.file` présent
- Retourne : `{ url: objectName }` — chemin relatif MinIO (P18)

**Client — `DocumentModal.jsx`**
- `makeImageHandler(quill, campaignId, onError)` : `FileReader` base64 → `api.post(FormData)` → insert URL dans Quill
- `useQuillEditor(containerRef, initialHtml, editable, campaignId, onError)` : signature étendue
- Aucun nouveau dep dans `useEffect []` — `campaignId` (route param) et `setError` (useState setter) sont stables par nature
- Les deux éditeurs (content + gmNotes) utilisent le même handler upload

### Pièges respectés
- **P18** : serveur retourne `objectName` (relatif), pas `getFileUrl(objectName)` (URL MinIO directe, inutilisable via proxy)
- **P25** : MinIO avant base — pas d'écriture en base dans ce sprint (URL stockée dans `content_html` via Quill)
- **P46** : route statique `/upload-image` déclarée avant paramétrique `/:docId`
- **PL-Q3** : `campaignId` et `onError` capturés dans `useEffect []` — stables, pas de stale closure

### Session 80 ✅ CONFIRMÉ FONCTIONNEL

---

## Session 81 — 2026-06-04

### Bug 1 — Auto-init ammo_remaining à l'équipement CONFIRME FONCTIONNEL

Cause racine : ammo_remaining (migration 60) n'était jamais initialisée à l'équipement d'une arme.
Seul POST /reload l'écrivait. Toute arme équipée sans rechargement restait à NULL
=> isAmmoEmpty = true cote client => bouton "Assaut (tir)" grise (non cliquable).

Fix — 4 composantes :
- 70_ammo_init_on_equip.js : backfill PostgreSQL armes equipees avec ammo_remaining IS NULL et caliber IS NOT NULL
- char-sheet.js : helper resolveAmmoInit(equipmentId, slot) + appel dans 3 routes (PUT /inventory/:itemId, POST /inventory, POST /quick-equip)
  Guard : slot dans WEAPON_SLOTS && caliber non null && ammo_count parseable > 0 && existing.ammo_remaining === null
- CombatActionWindow.jsx : isAmmoEmpty ne bloque plus sur null (arme jamais initialisee) — seulement sur === 0 (arme vraiment vide)

Pièges evites : ammo_count est une chaine ("30 coups"), parser avec /\d+/ identique au pattern resolveReload.
current_ammo inutile pour le decompte combat (guard NULL deja present ligne 3477 socket/index.js).
down migration non reversible.

### Bug 2 — Crash ecran noir joueur en mode combat CONFIRME FONCTIONNEL

Cause : etat meleePendingTokenIds (array, pluriel) reinitialise avec setMeleePendingTokenId(null) (sans s, inexistant)
en 3 endroits dans CombatActionWindow.jsx (lignes 174, 237, 394). ReferenceError au montage du composant.

Fix : 3 occurrences remplacees par setMeleePendingTokenIds([]).

### Sprint Annonce v2 CONFIRME FONCTIONNEL

Architecture : la phase ANNOUNCEMENT etait deja sequentielle cote serveur (guard base_ini ASC), mais le client GM
permettait un batch multi-PNJ incoherent avec cette contrainte. Sprint aligne le client sur le serveur.

7 composantes :
1. socket/index.js : COMBAT_ACTION_DECLARED enrichi — moveTarget:{x,y,z} (coords PE14) + attackTargetId:uuid
2. SessionPage.jsx : state announcementMarker, reset sur COMBAT_PHASE_CHANGED, passe a Canvas3D + CombatOverlay
3. Canvas3D.jsx : ghost box bleue semi-transparente a moveTarget + ligne ambre announcementToken -> attackTarget
4. CombatOverlay.jsx : mini-panneau bottom-left "vient d'annoncer" (nom, INI, deplacement, cible) — visible de tous
5. TimelineCard.jsx : prop isDimmed -> opacity 0.35
6. CombatTimeline.jsx : isDimmed = hasAnnounced && !isActive en phase ANNOUNCEMENT
7. CombatGmDeclareWindow.jsx : reecriture complete (~600 lignes vs 1128)
   — batch supprime, appels directs onEnterMoveMode/onEnterTargetMode, bouton "Passer" si PJ bloque le slot

Pièges : announcementMarker.moveTarget = {x:pos_x, y:pos_y(Three.js Z), z:pos_z(Three.js Y)} — PE14 applique au rendu.
tokensRef.current utilise dans la ligne d'annonce (ref miroir stable hors render).
handleStartMelee : N selections chainees via recursion de callbacks.

### Session 81 CONFIRME FONCTIONNEL

---

## Session 81 — suite (2026-06-05)

### S1 GM — Toggle roster localStorage CONFIRME FONCTIONNEL

CombatGmDeclareWindow.jsx : state rosterOpen initialisé depuis localStorage('gm-roster-open'),
bouton chevron dans le rosterHeader, rendu conditionnel {rosterOpen && <div>...</div>}.
Style S.rosterToggle ajouté.

### S2 — Ligne déplacement + label token CONFIRME FONCTIONNEL

Canvas3D.jsx : ghost box bleue remplacée par bloc enrichi :
- Ligne bleue (#7ab8f5) depuis position courante du token (tokensRef→tokens) vers destination
- Float32Array([src.pos_x+0.5, src.pos_z+1.5, src.pos_y+0.5, m.x+0.5, m.z+1.0, m.y+0.5]) — PE14
- Billboard+Text FONT_URL au-dessus destination avec nom du token déclarant

### S1 PJ — Roster multi-personnage CONFIRME FONCTIONNEL

CombatActionWindow.jsx — refactor architecture :
- playerChar (find) → playerChars (filter) + playerTokensInRoster (subset dans le roster)
- activeStoreToken : token du joueur dans le slot actif (activeTokenId du store)
- playerToken = activeStoreToken ?? playerTokensInRoster[0] — suit le tour du drone B quand c'est son tour
- useDraggable déplacé AVANT les early returns (correction violation règles des hooks existante)
- Fetch allures + inventaire : dep [playerToken?.id] au lieu de [playerChar?.id]
- Early return guard : playerTokensInRoster.length === 0 (et non plus playerToken || rosterEntry)
- rosterSection JSX : collapsible, localStorage('pj-roster-open'), affichée dans états attente/déclaré/formulaire
- Roster dans formulaire conditionnel : visible uniquement si playerTokensInRoster.length > 1
- isMyTurnInAnnouncement/Resolution : playerTokensInRoster.some() au lieu de playerToken.id ===

---

## Session 81 — Sprint Test de Choc : option shock_auto_stun + badges visuels (2026-06-05)

### Objectif
Option campagne pour contrôler l'application automatique de l'étourdissement après un Test de Choc raté. Connexion du Test de Choc au système de statuts visuels (`token_statuses`). Bouton d'application manuelle GM quand l'automatisme est désactivé.

### Migration 69 — shock_auto_stun
`campaigns.shock_auto_stun BOOLEAN NOT NULL DEFAULT true`
- `true` (défaut) : étourdissement appliqué automatiquement + badge visuel
- `false` : jet calculé et affiché, aucun effet appliqué — le GM décide via bouton dans le panneau résultat

### Nouvelle option campagne (CampaignSettingsPage + fr.json)
Checkbox "Appliquer l'étourdissement automatiquement" dans section "Règles de jeu". Initialisée depuis `campaign.shock_auto_stun ?? true`. Incluse dans PUT /campaigns/:id.

### Payload shockResult — nouveau champ stun_applied
`stun_applied: outcome !== 'ok' && shockAutoStun` — embarqué dans chaque `COMBAT_ATTACK_RESULT`. Permet au client de décider d'afficher le bouton sans accéder aux settings campagne.

### Panneau résultat GM — CombatResultPanels + CombatOverlay
- `ShockBlock` : prop `onApplyStun` + `useState applied` (init depuis `shockResult.stun_applied ?? true`). Bouton `btn-danger` "Appliquer l'étourdissement" si `outcome !== 'ok' && onApplyStun && !applied`. Après clic : `setApplied(true)` + "✓ Étourdissement appliqué".
- `CombatResultGM` : prop `onApplyStun`, `RollSeuilLine` conditionnel (`roll !== undefined`) car Block 1 n'a pas le roll d'attaque dans son payload.
- `CombatOverlay` : closure `() => socket.emit(WS.COMBAT_APPLY_STUN, { tokenId: cibleId, outcome })` si `stun_applied === false`.

### Fix GM voit les dégâts PJ→PNJ (SessionPage)
Pre-sprint : `COMBAT_ATTACK_RESULT` sans `isPnj` → GM ne voyait jamais le panneau pour les attaques PJ. Fix : `else if (isGm) { setGmAttackResult(data) }` dans le listener.

### Helper applyStunStatus + connexion token_statuses
Nouveau helper module-level `applyStunStatus(io, campaignId, tokenId, outcome)` :
- Détermine `statusCode = outcome === 'inconscient' ? 'unconscious' : 'stunned'`
- Delete-then-insert idempotent dans `token_statuses`
- Broadcast `TOKEN_STATUS_UPDATED`

Appelé dans les 4 blocs shock (si `shockAutoStun`) et dans le handler `COMBAT_APPLY_STUN`.

### Nettoyage COMBAT_END
Avant suppression du roster : récupère `token_id[]`, supprime `stunned`/`unconscious` de `token_statuses`, broadcast `TOKEN_STATUS_UPDATED` pour chaque token affecté.

### Nouveau event WS
`COMBAT_APPLY_STUN: 'combat:apply_stun'` — GM → serveur : `{ tokenId, outcome }`

### Piège — durée étourdissement (dette)
LdB p.237 : Étourdi = 1d6 tours, Inconscient = 1d6 minutes. **Non implémentée dans ce sprint** — `is_stunned` est un flag persistant jusqu'à `COMBAT_END`. Sprint dédié requis : `stunned_until_turn: current_turn + d6` + purge dans `endTurn` + retrait badge `token_statuses`.

### Fichiers modifiés
- `server/src/db/migrations/69_shock_auto_stun.js` (nouveau)
- `shared/events.js` : +COMBAT_APPLY_STUN
- `server/src/routes/campaigns.js` : +shock_auto_stun CRUD
- `server/src/socket/index.js` : 4 blocs shock conditionnés, applyStunStatus helper, COMBAT_APPLY_STUN handler, COMBAT_END cleanup
- `client/src/pages/CampaignSettingsPage.jsx` : +shockAutoStun state + checkbox
- `client/src/locales/fr.json` : +shockAutoStunLabel/Hint
- `client/src/components/CombatResultPanels.jsx` : ShockBlock bouton + CombatResultGM roll conditionnel
- `client/src/components/CombatOverlay.jsx` : wire onApplyStun + outcome
- `client/src/pages/SessionPage.jsx` : +else if isGm dans COMBAT_ATTACK_RESULT listener

**En attente de validation fonctionnelle**

---

## Session 81 — suite S3 (2026-06-05)

### S3 — Live Preview GM (COMBAT_ANNOUNCE_PREVIEW) CONFIRME FONCTIONNEL

Architecture : pattern presence ephemere Socket.io (in-memory Map, relay pur, sync reconnect).
Valide par recherche pro (Foundry VTT, Liveblocks, docs Socket.io officielles).

Composantes :
1. shared/events.js : +COMBAT_ANNOUNCE_PREVIEW ('combat:announce_preview')
2. socket/index.js :
   - combatPreviews = new Map() singleton (meme pattern que combatTimers)
   - handler relay : combatPreviews.set(campaignId, payload) + io.to(room).emit
   - SESSION_JOIN sync : socket.emit(COMBAT_ANNOUNCE_PREVIEW, preview) si preview courant existe
   - 3 clears : apres COMBAT_ACTION_DECLARED (declaration confirmee), startResolutionPhase, COMBAT_END
3. CombatActionWindow.jsx :
   - useEffect debounce 150ms sur [socket, phase, activeTokenId, mapSelected, assaultPendingTokenId,
     meleePendingTokenIds, moveSelection, combatMode]
   - guard : phase === ANNOUNCEMENT && playerTokensInRoster.some(t => t.id === activeTokenId)
   - payload : { tokenId, actions:[...mapSelected], assaultTargetId, meleeTargetIds, moveDestination{x,y}, combatMode }
4. SessionPage.jsx : state pjPreview, listener COMBAT_ANNOUNCE_PREVIEW→setPjPreview,
   clear sur COMBAT_ACTION_DECLARED + COMBAT_PHASE_CHANGED, passe a CombatOverlay
5. CombatOverlay.jsx : +pjPreview dans signature, passe a CombatGmDeclareWindow
6. CombatGmDeclareWindow.jsx : +pjPreview prop, panneau monitoring bleu quand
   pjPreview.tokenId === activeTokenId && !isActivePnj — actions/cible/destination/combatMode

Note bug futur noteé : harmonisation boutons d'attaque CaC vs Tir (fenetre, extension, cible, validation)
selon type d'acteur (PNJ/PJ) et type d'assaut — sprint dédié.

---

## Session 82 — Run à vide + correctifs sécurité (2026-06-05)

### Run à vide — analyse complète CONFIRMÉ FONCTIONNEL

Analyse transversale documentation / code / sécurité / architecture. 5 problèmes identifiés, 5 corrigés.

### Bug critique — COMBAT_APPLY_STUN : garde GM cassée CONFIRMÉ FONCTIONNEL

Fichier : `server/src/socket/index.js` ligne 2632.
`socket.user.role` utilisé au lieu de `socket.role`.
`socket.user` = payload JWT {id, email, username} — sans champ `role`.
Résultat : `undefined !== 'gm'` → `true` → return pour TOUS, GM compris.
Le bouton "Appliquer l'étourdissement" était silencieusement mort pour tout le monde.
Fix : `socket.role !== 'gm'`

Piège : Sprint Test de Choc (session 81) partiellement cassé. Le chemin auto (`shock_auto_stun = true`)
fonctionnait. Seul le chemin manuel GM était mort. Cette asymétrie explique pourquoi le sprint
était "EN ATTENTE VALIDATION" alors que les badges apparaissaient en mode auto.

### Sécurité — PDF retiré du filtre upload images CONFIRMÉ FONCTIONNEL

Fichier : `server/src/middleware/upload.js`
`application/pdf` était dans `ALLOWED_MIME_TYPES` utilisé par `multerUpload` (filtre images).
La route `POST /upload-image` des documents acceptait donc les PDFs.
Incohérence avec la décision session 80 ("PDF exclu du scope — analyse sécurité requise").
Fix : retrait de `application/pdf` de `ALLOWED_MIME_TYPES`.

### Sécurité — Ownership checks COMBAT_DAMAGE_CONFIRM + COMBAT_MELEE_DEFENSE_CONFIRM CONFIRMÉ FONCTIONNEL

Fichiers : `server/src/socket/index.js` lignes 2234, 2411, 3139.
Les deux handlers vérifiaient uniquement l'existence du pending, pas que l'émetteur
était bien le propriétaire du token. Tout joueur authentifié dans la campagne pouvait
déclencher la résolution pour le token d'un autre.

Corrections :
- `commonPending` (resolveMeleeAction) : ajout `defenderUserId: defenderCharacter.user_id`
- `COMBAT_DAMAGE_CONFIRM` : guard `pending.userId !== socket.user.id && socket.role !== 'gm'`
  placé AVANT le `.delete()` — si non autorisé, le pending reste intact
- `COMBAT_MELEE_DEFENSE_CONFIRM` : guard `pending.defenderUserId !== socket.user.id && socket.role !== 'gm'`
  placé AVANT le `.delete()`
- Le GM peut toujours agir via la branche `|| socket.role !== 'gm'`

Piège : `commonPending.userId` est l'userId de l'ATTAQUANT, pas du défenseur. Il fallait ajouter
un champ séparé `defenderUserId` pour le check defense confirm.

### Architecture — dette documentée

`socket/index.js` : 3750 lignes, monolithe de 40+ handlers.
Le bug COMBAT_APPLY_STUN est une illustration directe de ce risque (typo passée inaperçue).

Plan de refactoring progressif (strangler fig) :
- Sprint niveau 1 (2-3h, faible risque) : extraire fonctions module-level déjà isolées
  (resolveAssaultAction, resolveMeleeAction, endTurn, advanceSlot, applyStunStatus,
  resolveEntityState, startAnnouncementTimers) dans `server/src/lib/combatResolver.js`.
  Elles reçoivent déjà `io, campaignId` en params — zéro changement de comportement.
  Résultat : ~1000 lignes disparaissent de index.js.
- Sprint niveau 2 (après validation niveau 1) : split handlers par domaine via
  `registerCombatHandlers(io, socket)`, `registerTokenHandlers(io, socket)`, etc.
- Règle immédiate : tout nouveau handler s'écrit dans le bon module dès maintenant.

## Session 82 — suite : Run à vide Sprint Test de Choc (2026-06-05)

### Périmètre analysé

Analyse complète du Sprint Test de Choc (session 81 suite) : 4 chemins shock server, wiring client
ShockBlock/CombatResultPanels, COMBAT_APPLY_STUN, COMBAT_END cleanup, applyStunStatus.

### Résultat : architecture correcte ✅

Les 4 chemins shock sont tous branchés et fonctionnels :
- COMBAT_DAMAGE_CONFIRM (PJ tireur) → COMBAT_DAMAGE_RESULT socket + COMBAT_ATTACK_RESULT room ✅
- COMBAT_MELEE_DEFENSE_CONFIRM (PNJ auto-dégâts) → COMBAT_ATTACK_RESULT isPnj:true ✅
- resolveAssaultAction PNJ path → COMBAT_ATTACK_RESULT isPnj:true ✅
- COMBAT_APPLY_STUN (GM manuel) → guard role corrigé session 82 ✅

vol_na_cible présent dans les 3 paths. getShockMalus + isShockTestRequired correctement importés.
Idempotence applyStunStatus correcte. COMBAT_END nettoie stunned/unconscious. ✅

### 3 correctifs appliqués

**Fix 1 — COMBAT.md endTurn pseudocode stale (documentation)**
Le pseudocode référençait `state_character - 'is_rushed'` (n'a jamais existé dans endTurn — reliquat
avant migration 58 qui a migré is_rushed vers la colonne state_vitesse). Les colonnes per-turn réelles
(state_position/cover/vitesse/combat_mode) et les étapes 5-6 (COMBAT_SLOT_ADVANCED, timers) étaient absentes.
Corrigé : `docs/SYSTEME/COMBAT.md` section "endTurn — comportement serveur".

**Fix 2 — COMBAT_APPLY_STUN : outcome non validé (sécurité mineure)**
Guard `!outcome` (truthy) remplacé par `!['etourdi', 'inconscient'].includes(outcome)`.
Avant : tout string truthy accepté → applyStunStatus defaultait à 'stunned'.
Après : seuls les deux outcomes légitimes passent.
Fichier : `server/src/socket/index.js` ligne 2636.

**Fix 3 — COMBAT_APPLY_STUN : pas de feedback GM sur erreur serveur**
Ajout `socket.emit('error', ...)` dans le catch. L'optimistic update client (setStunApplied(true))
restait désynchronisé si le serveur échouait silencieusement.
Fichier : `server/src/socket/index.js` ligne 2645.

### Dettes confirmées (non nouvelles)

- PC42 : is_stunned non enforced dans COMBAT_ACTION_DECLARE — sprint dédié
- stunned_until_turn : durée réelle 1d6 tours non implémentée — sprint dédié
- shock_auto_stun : fetch DB répété dans chaque path (3×/hit) — acceptable V1

## Session 82 — Guards audit socket/index.js (2026-06-05)

### Périmètre analysé

Audit systématique des 32 handlers WS de socket/index.js : guards role, ownership checks,
validation payload. Focus sur les patterns du même type que les bugs trouvés en session 82
(socket.user.role, ownership manquant).

### Résultat socket.role — aucune régression ✅

Aucun autre usage de `socket.user.role` (typo corrigée session 82). Les 34 usages de
`socket.role` sont tous corrects. Pattern uniforme dans tout le fichier.

### 4 correctifs appliqués

**Fix 1&2 — TOKEN_CREATED / TOKEN_DELETED : dead code supprimé (sécurité)**
Ces deux handlers WS étaient des reliques Chantier 1, documentées "à nettoyer" mais jamais retirées.
La REST (POST/DELETE /tokens) est le seul émetteur légitime — elle broadcast ET maintient Redis.
Les handlers WS n'avaient aucun guard : tout joueur authentifié pouvait :
- TOKEN_DELETED → ghost-delete n'importe quel token pour toute la room (token intact en DB, invisible jusqu'au refresh)
- TOKEN_CREATED → force-broadcast n'importe quel token, y compris les tokens layer='gm'
Supprimés. Remplacés par un commentaire expliquant pourquoi.

**Fix 3 — TOKEN_STATUS_TOGGLE : statusCode non validé (intégrité DB)**
Ownership présent mais `statusCode` acceptait n'importe quelle chaîne.
Ajout whitelist VALID_STATUS_CODES (15 codes, miroir exact de STATUS_LIST dans TokenStatusPanel.jsx).
Pattern inline `new Set([...])` identique aux VALID_STATES de COMBAT_ACTION_DECLARE.

**Fix 4 — COMBAT_ANNOUNCE_PREVIEW : pas d'ownership check (intégrité données GM)**
Handler sync sans guard : tout joueur pouvait émettre des previews pour n'importe quel tokenId.
- Spoof : afficher les fausses intentions d'un autre joueur dans le panneau monitoring GM
- Override : écraser le preview légitime d'un autre joueur (stocké par campaignId, last write wins)
Converti en async + ownership check (character.user_id === socket.user.id) + try/catch.
Confirmé que seul CombatActionWindow émet cet event (jamais CombatGmDeclareWindow).
