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

