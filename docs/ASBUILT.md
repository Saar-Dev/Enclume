# ASBUILT — Ce qui est codé et stable
> Dernière mise à jour : 2026-07-08 Session 140
> Ce document est un snapshot de référence rapide.
> Pour les flux détaillés, ownership, pièges : voir SYSTEME.md.
> Pour l'historique des décisions : voir JOURNAL5.md (Sessions 109+), Old/JOURNAL4.md (Sessions 86–108).

---

## Structure du projet
```
Enclume/
├── client/
│   ├── public/
│   │   ├── fonts/
│   │   │   └── inter.woff              # Police locale pour labels 3D (drei Text)
│   │   ├── favicon.svg                 # ⚠ présent mais non référencé — à brancher
│   │   └── CHANGELOG.md               # Modifié 67 Sprint 7.6 — +v67 rechargement combat
│   ├── src/
│   │   ├── components/
│   │   │   ├── CombatOverlay.jsx        # Modifié 64 — +combatTargetMode. Modifié 66 — +shockResult. Modifié 67 Sprint 7.6 — +CombatResultReload. Modifié 67 Sprint CaC 1 — +CombatResultMelee (bottom-right), +modal défense PJ. Modifié 71 — +actionTimerSec prop passé à CombatTimeline. Modifié 72 CaC 4a — alerte ⚠ encerclement dans defense prompt + props multiMalus* vers CombatResultMelee. Modifié 81 Sprint Annonce v2 — prop announcementMarker + mini-panneau bottom-left "vient d'annoncer" (nom, INI, déplacement, cible), visible pour tous, pointerEvents:none. Modifié 85 Bugs A+B — fenêtres validation positionnées near-click (pendingTargetScreenPos / pendingMoveSelection.screenX). Modifié 87 — guard isGm sur <CombatDeclareLog /> (ANNOUNCEMENT/RESOLUTION)
│   │   │   ├── CombatRosterWindow.jsx  # Réécriture complète 65 Sprint GM-A. Modifié 66 — draggable (useDraggable, key combat-roster-pos) — détection arme/armure, chips T/C/B/J (PjArmorChips/PnjArmorChips), quick-equip PNJ, bannière alerte, fetches parallèles combat-ini+combat-equipment+refWeapons+refArmors. Modifié 83 Rework Design — const S migré vers classes CSS système (combat-win/combat-badge/combat-chip/combat-select/btn-tac-confirm)
│   │   │   ├── CombatTimeline.jsx      # Réécriture complète 71 — BG3-style, Motion FLIP, ANNOUNCEMENT(roster ASC)/RESOLUTION(actions seq), TimelineCard, timer countdown, MAX_CARDS=12, phase indicator+flèche. Modifié 81 — isDimmed=hasAnnounced&&!isActive en phase ANNOUNCEMENT, passé à TimelineCard. Modifié 83 Rework Design — styles.bar() → .combat-timeline-bar
│   │   │   ├── TimelineCard.jsx        # NOUVEAU 71 — carte portrait plein format, gradient overlay nom+INI, bordure SEVERITY_COLORS, taille active 72×100/normal 54×76, badges ✓⚠. Modifié 81 — prop isDimmed -> opacity 0.35. Modifié 83 Rework Design — 5 hex inline → CSS vars (--halo-active, --color-gold, --color-primary, --color-success-soft, --color-warning-soft)
│   │   │   ├── CombatActionWindow.jsx  # Modifié 66 — draggable v2, StateSelector, exclusion mutuelle EXCLUSIVE_ACTIONS. Modifié 67 Sprint 7.6 — +reload panneau. Modifié 67 Sprint CaC 1 — +melee panneau droit (liste armes contact + allonge + cible via target mode), Phase 2 myMeleeAction, reset has_announced, COMBAT_DECLARE_ERROR listener. Modifié 68 Sprint CaC 2 — +combatMode state (normal/offensif/charge), mode selector 3 chips, handleChargeFlow séquentiel (chargeAllures=lente uniquement), meleeValid Charge, payload state.combat_mode + move.ini_mod=0. Modifié 68 Sprint CaC 3 — meleeDefensif const ligne 330 (fix TDZ), modes Défensif+Retraite : chips vert uniforme, melee/cible masqués si meleeDefensif, handleRetraiteMove() toggle zone lente ini_mod=0, mapActionsObj.melee=null, server freeMove étendu à retraite. Modifié 81 — isAmmoEmpty fix + setMeleePendingTokenIds fix + refactor multi-token (playerChars filter, playerTokensInRoster, activeStoreToken, useDraggable déplacé avant early returns, rosterSection collapsible localStorage). Modifié 83 Rework Design — const W migré (window/header/body/section/footer → combat-float-win) + const ss hex→CSS vars. Modifié 85 Bug C — position:'fixed' sur 7 blocs .combat-float-win. Item 16 — Math.max(80, top). Modifié 87 — ACTION_LABELS + PURE_MOVE_TYPES module-level restaurés, declareLogSection remplace rosterSection (3 branches read-only). Modifié 98 REWORK-05 — ACTION_LABELS+PURE_MOVE_TYPES → import combatSections. declareLogSection → &lt;DeclareLogContent&gt; (fix CL2). Panneaux droits → DroneWeaponPanel + AssaultRangedPanel + MeleeCombatPanel.
│   │   │   ├── CombatDamageWindow.jsx  # NOUVEAU 64 Sprint 7.4 — fenêtre PJ lancer dés dégâts : Phase 1 dés vides / Phase 2 animation / Phase 3 résultats colorés. Modifié 66 Sprint Test de Choc : +bloc Test de Choc après severityBanner (roll/seuil/outcome coloré). Modifié 83 Rework Design — styles.window/header migré (combat-float-win, cursor:default overlay non-draggable)
│   │   │   ├── CombatModifiersWindow.jsx # NOUVEAU 64 Sprint 7.2. Modifié 65 Sprint 7.6. Modifié 66 — draggable (useDraggable, sticky retiré du header) — is_rushed → state_vitesse === 'rushed'. Modifié 83 Rework Design — const styles migré (window/header/sections/footer/btns → combat-float-win/btn btn-gold/btn-ghost. Modifié 85 Bug D — position:'fixed'. Bug#13 — +isRushed -5 dans totalModComp)
│   │   │   ├── CombatResultPanels.jsx  # NOUVEAU 66 Sprint Test de Choc — CombatResultGM + CombatResultPlayer + ShockBlock. Modifié 67 Sprint 7.6 — +CombatResultReload. Modifié 67 Sprint CaC 1 — +CombatResultMelee (bottom-right, jets opposition attaque/défense colorés). Modifié 72 CaC 4a — CombatResultMelee +bloc ⚠ orange encerclement si multiMalusAttaquant ou multiMalusDefenseur ≠ 0
│   │   │   ├── CombatPnjPanel.jsx      # NOUVEAU 58 — modal GM PJs/PNJs read-only, isPnj via character.type
│   │   │   ├── CombatGmDeclareWindow.jsx # Réécriture complète 81 Sprint Annonce v2 — batch supprimé, queues supprimées, appels directs onEnterMoveMode/onEnterTargetMode, états directs (pendingMove, assaultTarget, meleeTargets, chargeSelection), roster lecture seule, bouton "Passer [PJ]" quand slot actif = PJ. ~600 lignes vs 1128 avant. Modifié 81 S1 GM — rosterOpen localStorage('gm-roster-open'), toggle ▲▼ dans rosterHeader. Modifié 83 Rework Design — const S partiel migré (window/header/sections/footer/btnDeclare → classes CSS. Modifié 85 Bug#1 — isMeleeSetup nettoyé. Bug#8/#12 — initialStates remplace STATE_DEFAULTS dans useEffect([activeTokenId])). Modifié 98 REWORK-05 — panneaux droits → DroneWeaponPanel+AssaultRangedPanel+MeleeCombatPanel. Modifié 99 — BUG-W1 (init weapon : initialStates.weapon guard) + BUG-W2 (setTimeout fix batch race setCombatTargetMode) + ERG-W1 (auto-draw "Assaut tir") + ERG-W2 (auto-draw/holster CaC onWeaponChange)
│   │   │   ├── CombatInitStateWindow.jsx # NOUVEAU 65 Sprint 7.6 — fenêtre joueur phase ROSTER : sélection état initial (position/arme/mode de tir), StateChip click-to-cycle, draggable, emit COMBAT_INIT_STATE. Affiché par CombatOverlay.
│   │   │   ├── CombatStunWindow.jsx    # NOUVEAU 95-5b — fenêtre PJ interactive "Lancer 1D6" durée étourdissement. Reçoit COMBAT_STUN_PROMPT. Emit COMBAT_STUN_CONFIRM.
│   │   │   ├── combatSections.js       # Modifié 65 Sprint 7.6 — STATE_DEFS, MAP_ACTIONS, QUICK_ACTIONS, MOVE_ZONE_DEFS. Modifié 67 Sprint 7.6 — +reload dans MAP_ACTIONS (span2, après melee), +span2 sur move, EXCLUSIVE_ACTIONS dans CombatActionWindow. Modifié 98 REWORK-05 — +ACTION_LABELS, PURE_MOVE_TYPES, COMBAT_MODE_DEFS, FIRE_MODE_VARIANTS. Modifié 99 — +computeFireVariant (factorisation CC/RC/RL depuis GM+Joueur, defaultCcCount param)
│   │   │   ├── Canvas3D.jsx            # Modifié 64 — +combatTargetMode prop, combatTargetModeRef (P40), intercept drag→target, ligne R3F attaquant→cible (useMemo targetLinePoints). Modifié 65 Sprint Pathfinding — A* Chebyshev temps réel (cases colorées par allure, murs respectés). Modifié 65 Sprint Raycast — raycastVoxelColumn via fast-voxel-raycast (remplace plan y=0 fixe, précis sur terrain élevé). Modifié 70 — TokenGlbBody + TokenFallbackBody + TokenGlbErrorBoundary, HARDCODED_DEFAULT_TOKEN_URL=/models/default.glb, prop defaultTokenGlbUrl, hiérarchie fallback 4 niveaux. Modifié 73 — Billboard drei sur étiquettes tokens (billboarding), color=user_color||token.color||'#4A90D9', drag snappedX/Z (snap case), raycastVoxelColumn +rawX/rawZ, drag utilise raycastVoxelColumn (précision altitude). Modifié 76 — clic simple = ouvre TokenRadialMenu (handlePointerUp onTokenRotate→onTokenDoubleClick, dep array mis à jour), TokenMesh.onDoubleClick retiré. Modifié 76 Sprint Voxels — boucle Voxel remplacée par <CulledVoxelScene>, import Voxel retiré. Modifié 79 — getVoxelSurfaceTop() module-level (slab_bottom→y+0.5), colTopSurface useMemo O(1) (remplace getColumnTopY O(N)), dragRef enrichi (snappedX/Z/surfaceY stockés pendant drag), handlePointerUp lit dragRef pas curseur, threeToDb(x, surfaceY-1.0, z), Math.floor (was Math.round), ghost overlay corrigé. Modifié 81 Sprint Annonce v2 — prop announcementMarker (outer+inner Scene), ghost box bleue (PE14→Three.js) à moveTarget, ligne ambre tokensRef déclarant→cible (Float32Array, même pattern que targetLinePoints). Modifié 81 S2 — ghost déplacement enrichi : ligne bleue (#7ab8f5) origine→destination + Billboard+Text FONT_URL nom du token au-dessus destination
│   │   │   ├── Editor3D.jsx            # Modifié 9C — EntityEditorScene, activeEditorTab
│   │   │   ├── EntityMesh.jsx          # Modifié 43 — Lerp 300ms EntityMeshVoxel + EntityMeshGlb
│   │   │   ├── EntityBuilderTab.jsx    # Modifié 40 — refonte formulaire interactions SkillCheck/Déplacement
│   │   │   ├── VoxelBuilderTab.jsx     # Stable 33
│   │   │   ├── RadialMenu.jsx          # Modifié 41 — tranche displacement, grisage portée, onMove
│   │   │   ├── TokenRadialMenu.jsx     # NOUVEAU 76 — menu radial SVG 370×370 sur tokens : 8 secteurs (Fiche✅+Retirer✅+6 placeholders), cœur disque worst_wound_severity, anneau blessures simplifié Sprint1, bloom+danger pulse, boussole directionnelle (zone 15–42px, atan2→r 0..7, TOKEN_SET_ROTATION)
│   │   │   ├── EntityInstancePanel.jsx # Modifié 36 — sélecteur état actuel
│   │   │   ├── CulledVoxelScene.jsx    # NOUVEAU 76 — rendu voxels fusionné : buildCulledMesh + BufferGeometry par (texId×physIdx) + dispose useEffect. Non-cubes → <Voxel> individuel. Modifié 77 Phase B — commentaire uniquement.
│   │   │   ├── Voxel.jsx               # Stable 9A-5
│   │   │   ├── Sidebar.jsx             # Modifié 64 Sprint 7.4 — +rendu interactionType='combat_damage' (dégâts colorés par sévérité). Modifié 36 — entity_action structuré. Modifié 65 Sprint DicePanel v3 — +🔒 dans diceHeader si msg.secret. Modifié 73 — messages depuis messagesByCampaign[activeCampaignId]. Modifié 106c (REWORK-10) — +DeclareLogContent tab chat (haut zone messages, collapsible, GM+joueurs) ⚠️ scénarios 1–8 non testés
│   │   │   ├── GeometryIcon.jsx        # Stable 9A-3
│   │   │   ├── DicePanel.jsx           # Réécriture complète 65 Sprint DicePanel v3. Modifié 66 — favoris inline form, section MACROS (chips ★, form création 3 dropdowns, preview seuil live, fix GM effectiveCharId) — roue radiale SVG (PCBBackground, DieShape, DieButton), formule mono-type {k,n,mod}, favoris localStorage, historique local socket, JET AU MJ fonctionnel, useAuthStore direct, drag conservé
│   │   │   ├── DiceMesh.jsx            # NOUVEAU 44 — géométries, matériaux, animation, Html overlay D10. Modifié 65 — branche D20 dédiée supprimée → D20 passe par faceNormal→D20_GLB_NORMALS (normales Blender exactes)
│   │   │   ├── DiceRoller.jsx          # NOUVEAU 44 — orchestrateur R3F dans Canvas3D
│   │   │   ├── ChangelogPanel.jsx      # NOUVEAU 66 — panneau latéral rétractable Dashboard : fetch+parse CHANGELOG.md, auto-open localStorage (changelog_last_seen), PCB SVG déco, 38px rail ↔ 340px ouvert, tags AJOUT/CORRECTIF/CHANGEMENT
│   │   │   ├── LibraryPanel.jsx        # NOUVEAU 75 — liste documents campagne, ShareIndicator (œil/punaise), canEdit, ouvre DocumentModal
│   │   │   └── DocumentModal.jsx       # NOUVEAU 75 — éditeur Quill x2 (content+gmNotes), PermissionSelect (portal), save/delete. Modifié 80 — makeImageHandler base64→upload MinIO (POST /upload-image), useQuillEditor +campaignId/onError
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx           # Modifié 69 — +useEffect import + document.title 'Enclume — Connexion'
│   │   │   └── RegisterPage.jsx        # Modifié 66 — +champ "Beta code". Modifié 69 — +useEffect import + document.title 'Enclume — Inscription'
│   │   ├── lib/
│   │   │   ├── useDraggable.js         # NOUVEAU 66 — hook partagé drag+localStorage+clamp (storageKey, defaultPos, panelW)
│   │   │   ├── useTokenSocket.js       # NOUVEAU 103 (REWORK-09) — listeners TOKEN_MOVED/TOKEN_UPDATED/TOKEN_STATUS_*/TOKEN_SET_ROTATION
│   │   │   ├── useEntitySocket.js      # NOUVEAU 103 (REWORK-09) — listeners ENTITY_MOVE_RESULT/ENTITY_UPDATED/DICE_RESULT(entity_action). Modifié 108b — clear pendingEntityId sur DICE_RESULT échec
│   │   │   └── useCombatSocket.js      # NOUVEAU 103 (REWORK-09) — listeners COMBAT_*/DICE_RESULT(combat). 1509→1296 lignes SessionPage
│   │   │   ├── DashboardPage.jsx       # Modifié 45 — upload cover. Modifié 66 — layout flex+ChangelogPanel. Modifié 68 — formulaires inline. Modifié 69 — document.title 'Enclume — Tableau de bord'. Modifié 73 — deux cartes Créer/Rejoindre symétriques (filigrane +/↵, formulaires inline, refs focus, suppression actionsRow/showCreate/showJoin)
│   │   │   ├── SessionPage.jsx         # Modifié 64-66 — combat, dés. Modifié 69 — document.title dynamique. Modifié 70 — defaultTokenGlbUrl. Modifié 71 — +updateCharacter destructure, +3 listeners wound (WOUND_ADDED/UPDATED/REMOVED → updateCharacter({id,worst_wound_severity})), +actionTimerSec prop CombatOverlay. Modifié 73 — setActiveCampaign(campaignId) début useEffect socket. Modifié 76 — dropdown token remplacé par TokenRadialMenu, contextMenuRef+useEffect click-outside supprimés, handleRemoveContextToken (sans setContextMenu), handleSetContextTokenRotation (TOKEN_SET_ROTATION). Modifié 79 — fix TDZ : useState statusPanel déplacé avant useEffect qui l'utilise. Modifié 81 — state announcementMarker (null|{tokenId,moveTarget,attackTargetId}), set dans COMBAT_ACTION_DECLARED, reset dans COMBAT_PHASE_CHANGED, passé à Canvas3D + CombatOverlay. Modifié 85 M3 — CAMPAIGN_SETTINGS_UPDATED listener (setCampaign merge). Modifié 95-6 — reset setCombatMoveMode/setCombatTargetMode/setPendingMoveSelection dans COMBAT_ENDED + COMBAT_PHASE_CHANGED (CUR1). Modifié 103 (REWORK-09) — useTokenSocket+useEntitySocket+useCombatSocket extraits, useEffect socket 340→~100L, total 1509→1296 lignes
│   │   │   ├── CampaignSettingsPage.jsx # Modifié 66 Sprint 7.5 — section Règles de jeu. Modifié 68 Sprint Timer — +actionTimerSec. Modifié 69 — document.title. Modifié 70 — section Tokens 3D : upload/réinitialiser default_token_glb_url, feedback succès/erreur
│   │   │   ├── WorkshopPage.jsx        # Modifié 69 — canDelete (isOwner || !created_by), Export/Supprimer séparés, document.title 'Enclume — Atelier'
│   │   │   └── TexturePacksPage.jsx    # CONSERVÉ mais remplacé par WorkshopPage
│   │   ├── stores/
│   │   │   ├── authStore.js
│   │   │   ├── tokenStore.js
│   │   │   ├── characterStore.js       # Modifié 44 — upsertCharacter guard visible+isGm (Bug A)
│   │   │   ├── combatStore.js          # Modifié 62 — phase/roster/actions/currentTurn/activeSlotIdx/markTokenAnnounced + setActions + advanceSlot. Modifié 111 (REWORK-04) — +subPhase:null, +setCombatSubPhase, resetCombat inclut subPhase
│   │   │   ├── mapStore.js
│   │   │   ├── sessionStore.js         # Modifié 73 — messages[]→messagesByCampaign{}, activeCampaignId, setActiveCampaign. resetSession mis à jour (était dead code)
│   │   │   ├── libraryStore.js         # NOUVEAU 75 — documents[], addDocument (upsert), updateDocument, removeDocument
│   │   │   └── entityStore.js          # Modifié 34 — fetchBlueprints() ajouté
│   │   ├── character/
│   │   │   ├── WeaponPanel.jsx         # NOUVEAU 55 — armes équipées MG/MD, stats, munitions chargées, rechargement, équipement. Modifié 66 Sprint 7.5 — affichage ammo_remaining/ammo_count (rouge si vide), picker variantes ammo, POST /reload. Modifié 85 M4/Item11 — getSlotInfo, conflict resolution handleEquip, dropdown +armes équipées, slot picker 2M/Tr, warning Tr. Fix affichage munitions (current_ammo &&)
│   │   │   ├── InventoryPanel.jsx      # Modifié 55 — VALID_SLOTS corrigé (migration 51 → codes BG/BD/JG/JD/MG/MD/2M/Tr)
│   │   │   ├── ArmorWoundPanel.jsx     # NOUVEAU 54 — layout 3 colonnes : localisations armure + silhouette + conteneurs
│   │   │   ├── LocationPanel.jsx       # Modifié 56 — import polarisRound shared, calcMillefeuille utilise polarisRound
│   │   │   ├── ContainerPanel.jsx      # NOUVEAU 54 — Sac/Ceinture/Coffre — équipement conteneur
│   │   │   ├── SilhouettePanel.jsx     # NOUVEAU 54 — SVG silhouette colorée par blessures, 50% width
│   │   │   ├── AdvantagesPanel.jsx     # Modifié 50 — rework lift-state-up, props charSkills/refSkillsPolaris/onSkillLearnedChange
│   │   │   ├── SkillsPanel.jsx         # Modifié 73 — bouton ⓘ par compétence (si description non nulle), panel position:fixed (description LdB complet, scrollable, click-outside via useEffect+ref). Modifié 141 — +prop skillPrerequisitesEnabled (settings.skill_prerequisites, OPT-07) : gate le check SKILL_MIN dans isVisible (fermé par défaut) ; MUTATION/GENOTYPE toujours actifs, hors périmètre.
│   │   │   ├── CharacterSheet.jsx      # Modifié 61 — import calcAN/calcAllureMoy/calcAllures shared, déf locales supprimées. Modifié 141 — état campaignSettings (peuplé depuis GET /:characterId → settings), transmis à SkillsPanel via skillPrerequisitesEnabled.
│   │   │   ├── CharacterWindow.jsx     # Modifié 55 — WeaponPanel monté entre ArmorWoundPanel et InventoryPanel. Modifié 139 — prop `forceReadOnly` (défaut false) : `effectiveIsGm`/`effectiveIsOwner` remplacent `isGm`/`isOwner` dans tous les calculs de permission (nom, portrait, visibilité, onglets Matériel/Paramètres, `readOnly` textarea notes MJ) — utilisé par la fenêtre "peek" du Wizard (docs/STE6_FINAL.md), toujours lecture seule
│   │   │   ├── DroneWindow.jsx         # NOUVEAU 83 — fenêtre flottante drone (drag/resize), onglets Fiche/Armes/Notes/Paramètres, WeaponsTab/NotesTab/SettingsTab
│   │   │   └── DroneSheet.jsx          # NOUVEAU 83 — fiche drone : StatField, IntegritySection (cases dommages + intégrité actuelle GM), ProgramsSection (catalogue ref_equipment + DISPLAY_GROUPS optgroups + tooltip + mode custom)
│   │   ├── locales/
│   │   │   └── fr.json                 # Modifié 66 Sprint i18n — +20 sections : charSheet (~50 clés attrs/stats/bio/tooltips LdB), builder (~55 clés faces/géométries/formulaires), advantages (24), skillsPanel (6), radialMenu, entityPanel, changelog + ajouts dans auth/dashboard/session/settings/sidebar/workshop/character. Modifié 73 — +dashboard.joinCard, dashboard.codePlaceholder. Modifié 96 — +shockTestDetail (carte DICE_RESULT Test de Choc)
│   │   ├── lib/
│   │   │   ├── api.js                  # Modifié 69 — baseURL: `${VITE_API_URL}/api` (était hardcodé localhost:3001)
│   │   │   ├── buildCulledMesh.js      # NOUVEAU 76 — fonction pure (pas de Three.js) : FACES array (threejs.org/manual), face culling cubes, groupement par (texId×physIdx P32). Modifié 77 Phase B — ROTATION_FACE_MAP[r][physIdx]→origPhysIdx, cubes r≠0 textures multi-faces correctes.
│   │   │   ├── voxelTextures.js
│   │   │   └── diceMath.js             # NOUVEAU 44 — PRNG, mappings, normales D4/D6/D8/D12/D20/D10. Modifié 65 — D20_GLB_NORMALS : 20 normales Blender exactes, clés = numéros réels du dé (remapping par test visuel + validation antipodal)
│   │   ├── i18n.js
│   │   ├── App.jsx                     # Modifié 33 — route /workshop + redirect /texture-packs
│   │   └── main.jsx
│   └── vite.config.js
├── server/
│   ├── public/
│   │   └── equipment-admin.html        # NOUVEAU 47 — page admin saisie équipements (servie via express.static)
│   ├── diff_equip.mjs                  # NOUVEAU 48 — outil diff BDD vs STEP1 champ par champ (post-seed)
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/             # 79 migrations stables. Session 83 : 71–74 (drone_sheet, drone_sheet_fix, drone_programs_catalog, fix_ref_skills). Session 84 : 75_ammo_caliber_names_fix. Sessions 86–93 : 76–79.
│   │   │   ├── seeds/
│   │   │   │   └── 2_seed_equipment.js # NOUVEAU 48 — seed ref_equipment 636 items (KO-par-défaut, idempotent)
│   │   │   └── knex.js
│   │   ├── routes/
│   │   │   ├── auth.js                 # Modifié 66 — /register : +inviteCode, timingSafeEqual, guard REGISTRATION_CODE
│   │   │   ├── campaigns.js            # Modifié 45 — POST /:id/cover + cover_url dans GET /. Modifié 66 Sprint 7.5 — +pnj_unlimited_ammo. Modifié 67 Sprint 7.6 — +reload_mode (PUT validation + returning). Modifié 70 — import multerGlb, POST /:id/default-token (upload GLB MinIO), PUT accepte default_token_glb_url=null (réinitialisation). Modifié 81 Sprint Test de Choc — +shock_auto_stun (CRUD + returning). Modifié 85 M3 — +CAMPAIGN_SETTINGS_UPDATED broadcast après PUT /:id. Modifié 104 — PUT /:id réécrit : body `{ settings }` remplace les 5 champs plats supprimés, validation par clé contre SETTINGS_SCHEMA (import campaignSettingsService.js), merge JSONB atomique db.raw('settings || ?::jsonb'), returning() retourne `settings` au lieu des colonnes supprimées
│   │   │   ├── battlemaps.js           # Modifié 73 — GET /:id LEFT JOIN characters+users → user_color dans SELECT tokens
│   │   │   ├── tokens.js               # Modifié 39 — maintenance Redis collision map
│   │   │   ├── characters.js           # Modifié 59 — type dans GET/POST/PUT/broadcastCharacterUpdate. Modifié 139 — filtre brouillons wizard de GET / : gate sur `char_sheet.wizard_locked_at IS NULL` (au lieu de `creation_state != 'complete'`) — invariant documenté en commentaire (voir reconcileCreation)
│   │   │   ├── textures.js
│   │   │   ├── assets.js
│   │   │   ├── users.js
│   │   │   ├── dice.js
│   │   │   ├── voxel-textures.js       # Modifié 33 — usage_hint exposé GET+PUT
│   │   │   ├── texture-packs.js        # Modifié 69 — DELETE guard null-safe : created_by NULL → suppressible par tout user auth
│   │   │   ├── entity-blueprints.js    # Modifié 33 — POST /:id/upload-glb
│   │   │   ├── entities.js             # Modifié 39 — maintenance Redis collision map
│   │   │   ├── equipment.js            # NOUVEAU 47 — CRUD ref_equipment + junction tables. Modifié 65 Sprint GM-A : +location dans GET /equipment SELECT
│   │   │   ├── documents.js            # NOUVEAU 75 — GET/POST/PUT/DELETE /campaigns/:id/documents (mergeParams, broadcast filtré canView, gm_notes_html retiré non-GM). Modifié 80 — +POST /upload-image (multerUpload, minio.putObject, GM only, campaigns/<id>/documents/<uuid>.<ext>, retourne {url:objectName})
│   │   │   ├── creation.js             # NOUVEAU 129 — wizard COUCHE 3. Monté /api/creation. router.param('sheetId') ownership guard. GET/POST/DELETE /:sheetId/step4 + GET /step4/ref + GET/POST /:sheetId/step5 + GET /step5/ref. State machine draft_step3→step4→step5→complete (finalize non implémenté). Modifié 136 — +GET /:sheetId/step3/ref (getStep3RefData, mutations réelles PLAN_STEP4). Modifié 139 — `POST /:sheetId/finalize` (payload complet obligatoire) → `POST /:sheetId/reconcile` (payload partiel autorisé, garde sur `wizard_locked_at` au lieu de `creation_state`) ; +`GET /:sheetId/preview` (lecture brouillon, fenêtre fiche personnage pendant le Wizard) ; +`POST /:sheetId/lock` (verrouille après "Terminer"). Voir docs/STE6_FINAL.md.
│   │   │   └── character/
│   │   │       └── char-sheet.js       # Modifié 66 Sprint A+C2 — +6 routes /macros. Modifié 66 Sprint 7.5 — +ammo_remaining + POST /reload. Modifié 71 — +helper getWorstWoundSeverity(charSheetId) + worst_wound_severity dans payloads WOUND_ADDED/UPDATED/REMOVED. Modifié 81 — +helper resolveAmmoInit(equipmentId, slot) + auto-init ammo_remaining dans PUT /inventory/:itemId + POST /inventory + POST /quick-equip. Modifié 83 — routes drone : GET LEFT JOIN ref_equipment (program_name/description), PUT fix 5 champs + profondeur_max/disponibilite, POST programs catégorie résolue serveur + validation ordinateur, PUT programs/:id level+sort_order uniquement. Modifié 97 — import getWorstWoundSeverity depuis woundUtils.js, suppression de la fonction locale dupliquée. Modifié 129 — advantages V1 (L.515-563) → V2 utilisant advantageService (getAdvantages / addAdvantage / removeAdvantage). Modifié 141 — GET /:characterId +settings (getCampaignSettings(db, req.character.campaign_id), canal réutilisable pour les options de campagne restantes) ; POST /skills/buy +revalidation SKILL_MIN si settings.skill_prerequisites (réutilise calcSkillTotal, déjà éprouvée en combat/weapon-skill).
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── role.js
│   │   │   ├── upload.js
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   ├── auth.js
│   │   │   ├── socketToken.js          # NOUVEAU 108 (REWORK-08) — registerTokenHandlers (SESSION_JOIN + TOKEN_MOVE/ROTATE/SET_ROTATION + PLAYER_LOCATION_UPDATE)
│   │   │   ├── socketVoxel.js          # NOUVEAU 108 (REWORK-08) — registerVoxelHandlers (VOXEL_ADD/REMOVE/UPDATE + MAP_SWITCH ×3 occurrences)
│   │   │   ├── socketDice.js           # NOUVEAU 108 (REWORK-08) — registerDiceHandlers (DICE_ROLL + MACRO_ROLL)
│   │   │   ├── socketEntity.js         # NOUVEAU 108b (REWORK-08) — registerEntityHandlers (ENTITY_MOVE_REQUEST/INTERACT/UPDATED/DELETE + resolveEntityState helper)
│   │   │   ├── socketCombat.js         # NOUVEAU 108 (REWORK-08) — registerCombatHandlers (13 handlers + 13 helpers + 7 constantes, pendingMaps: pendingMeleeDefense/pendingDamageActions/pendingStunActions). Modifié 111 (REWORK-04) — guards canTransition (10 handlers), pendingMeleeDefense/pendingDamageActions/pendingStunActions Maps → DB combat_pending, setFSMSubPhase appelé aux transitions
│   │   │   └── index.js                # Modifié 65 Sprint 7.6. Modifié 66 — +MACRO_ROLL, COMBAT_ACTION_DECLARE v2, COMBAT_DAMAGE_CONFIRM, resolveAssaultAction. Modifié 67 Sprint CaC 1 — +import getModDom, +pendingMeleeDefense Map, +resolveMeleeAction, +COMBAT_MELEE_DEFENSE_CONFIRM handler, COMBAT_ACTION_CONFIRM branche melee + needsDefenseWait, COMBAT_DAMAGE_CONFIRM branche type=melee (modDom vs MR table), COMBAT_DECLARE_ERROR si hors portée. Modifié 68 Sprint CaC 2 — +VALID_STATES +combat_mode, chargeMove iniDelta=0, UPDATE +state_combat_mode, resolveMeleeAction +allonge +distance Phase2 +attackModeBonus +combatModeBonus, COMBAT_MELEE_DEFENSE_CONFIRM +mode défenseur PJ, COMBAT_DAMAGE_CONFIRM +combatModeBonus, endTurn reset state_combat_mode='normal'. Modifié 70 — db.migrate.latest() dans startServer(). Modifié 72 CaC 4a — multiAdversaryMalus()+countAdversaires() module-level, multiMalusAttaquant→chancesAttaque, multiMalusDefenseur→chanceDefense, enrichissement COMBAT_MELEE_RESULT + COMBAT_MELEE_DEFENSE_PROMPT. Modifié 76 — handler TOKEN_SET_ROTATION. Modifié 81 Sprint Test de Choc — 4 blocs shock conditionnés shock_auto_stun + stun_applied dans payload, helper applyStunStatus (token_statuses + TOKEN_STATUS_UPDATED), handler COMBAT_APPLY_STUN, COMBAT_END cleanup stunned/unconscious token_statuses. Modifié 96 (REWORK-01) — +import * as statusService. resolveShockBlock → statusService.resolveShockBlock (5 sites). Modifié 97 (REWORK-03) — +import * as woundService. resolveWoundInsertion blocks → woundService.applyWound (5 sites CS1–CS5). CS2 : meleeCampaignId pas campaignId (PIEGE-4). Modifié 100 (REWORK-07) — getUserColor+checkTokenOwnership→socketUtils. Modifié 108 (REWORK-08) — 5 modules registerXxxHandlers extraits, 4266→143 lignes. disconnect dans SESSION_JOIN. [R8-27] socket.campaignId+role dans SESSION_JOIN conservés (utilisés par socketCombat helpers).
│   │   ├── services/
│   │   │   ├── advantageConstraints.js # NOUVEAU 129 — registre CONSTRAINTS R1-R6 (exists/not_already_owned/unique_absolute/family_limit/max_desavantage_pc/sufficient_pc). validateAdvantage(advantageId, currentAdvantages, ledger, allRefAdvantages) → { valid, message }.
│   │   │   ├── advantageService.js     # NOUVEAU 129 — getAdvantages (JOIN+soft-delete filter) + addAdvantage (trx-or-db pattern, valide+insère+ledger) + removeAdvantage (soft-delete+décrement). Utilisé par creation.js (step5 batch) et char-sheet.js (campagne).
│   │   │   └── creationService.js      # NOUVEAU 129 — wizard steps 4+5. Snapshot-before rollback. Background skills additifs. Career skills SET via skillAllocations (ref_career_skills sans bonus). Validations carrière : prérequis/génotype/attributs/éducation. Salary depuis ref_career_titles. restoreSnapshot : upsert + purge orphans (whereNotIn). Modifié 136 — +getStep3RefData (ref_mutations + ref_mutation_subtypes/subtable + ref_mutation_skills imbriqués par mutation_id, pattern Map identique à getStep4RefData) ; startCreation +randomMutationsEnabled (settings.random_mutations). Modifié 139 — `finalizeCreation` → `reconcileCreation` (pattern reconciliation Kubernetes/Terraform, chaque bloc STEP1-5 conditionné à sa présence dans le payload, rejouable : reset `is_fertile`/`char_skills`/`char_careers`/`char_advantages`+ledger avant réapplication, effets d'âge en `update` absolu au lieu d'`increment`) ; +`lockWizard(sheetId)` (pose `char_sheet.wizard_locked_at`) ; +`getCharacterPreview(characterId, isGm)` (lecture brouillon, colonnes identiques à characters.js sans `worst_wound_severity`). Voir docs/STE6_FINAL.md. Modifié 141 — startCreation +randomProAdvantagesEnabled (settings.random_pro_advantages) : gate le bloc UI "Tirage 1D10" (CareersAllocator.jsx) via creationStore.js/Step4Experience.jsx, même pattern que randomMutationsEnabled — aucune revalidation serveur ajoutée dans reconcileCreation (identique au précédent). Modifié 141 (suite 2) — startCreation +skillMaxLevelEnabled (settings.skill_max_level) ; bloc STEP4 récupère désormais campaignId/settings (pattern identique STEP1) et transmet skillMaxLevelEnabled au ctx de computeSkillAllocation (shared/careerSkills.js) — revalidation serveur réelle, pas client-only (contrairement à randomProAdvantagesEnabled) car le plafond était déjà appliqué en dur côté serveur avant ce fix. Modifié 141 (suite 4) — startCreation +youngPenaltyEnabled (settings.young_penalty) ; bloc STEP4 requête char_attributes (FOR/PRE base_level) juste avant getAgeEffects(finalAge, ctx) (shared/polarisUtils.js) — réutilise le `settings` déjà chargé pour skill_max_level.
│   │   └── lib/
│   │       ├── AppError.js
│   │       ├── minio.js
│   │       ├── diceParser.js
│   │       ├── combatFSM.js            # NOUVEAU 111 (REWORK-04) — canTransition + nextState + setFSMSubPhase + allowedEvents. Table TRANSITIONS : 6 états FSM. Fonctions pures, zéro I/O sauf setFSMSubPhase (DB uniquement).
│   │       ├── charStats.js            # Modifié 60 — calcVitesses→calcAllures (4 allures LdB p.221, lookup COO+Athlétisme)
│   │       ├── redis.js                # NOUVEAU 39 — client ioredis + helpers collision map (PE14 voxels)
│   │       ├── socketUtils.js          # NOUVEAU 100 (REWORK-07) — getUserColor (6 call sites) + checkTokenOwnership (4 call sites, role==='gm'). LOC_TABLE_CONTACT supprimé.
│   │       ├── mrTable.js              # NOUVEAU 108 (REWORK-08) — singleton-promise polaris_mr. getMrTable()→Promise<row[]>. Remplace cache local MR_TABLE dans index.js + socketCombat.js.
│   │       ├── statusService.js        # NOUVEAU 96 (REWORK-01) — resolveShockBlock centralisé (5 sites → 1 call), applyStun, applyStunStatus, emitShockDiceResult, resolveShockTest. resolveShockTest retourne { rolls, seed } pour DICE_RESULT. Modifié 111 (REWORK-04) — applyStun : pendingStunActions param retiré, 2 Map.set() → db('combat_pending').insert(). Modifié 104 — shock_auto_stun lu via getCampaignSettings() (2 sites)
│   │       ├── campaignSettingsService.js # NOUVEAU 104 — SETTINGS_SCHEMA (16 clés : type/default/enum) + getCampaignSettings(db, campaignId) (SELECT settings + merge defaults). Source unique de vérité, réutilisée par routes/campaigns.js (validation PUT) et 5 consommateurs combat (losService, statusService, socketCombatAnnouncement, socketCombatHelpers, socketCombatState)
│   │       ├── woundUtils.js           # voir §woundUtils.js. Modifié 97 — +export getWorstWoundSeverity (utilise WOUND_SEVERITIES.slice().reverse() — PIEGE-7 évité). isShockTestRequired, nextSeverity, resolveWoundInsertion, getWorstWoundSeverity.
│   │       ├── woundService.js         # NOUVEAU 97 (REWORK-03) — applyWound(io, db, campaignId, { charSheetId, characterId, localisation, severity }) : transaction resolveWoundInsertion + getWorstWoundSeverity + WOUND_ADDED broadcast (worst_wound_severity inclus). Retourne { finalSeverity } ou null (P49 : severity post-promotion).
│   │       └── damageService.js        # NOUVEAU 101 (REWORK-02) — resolveTargetHit(io, db, campaignId, { degautsBruts, characterIdCible, cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible }) : loc D20 + armures + RD + sévérité + woundService.applyWound + statusService.resolveShockTest. Retourne null si cibleType='drone'.
│   └── index.js                        # Modifié 64-66 — resolveAssaultAction, Test de Choc, MACRO_ROLL. Modifié 67 Sprint 7.6 — resolveReloadAction. Modifié 67 Sprint CaC 1 — resolveMeleeAction, pendingMeleeDefense, COMBAT_MELEE_DEFENSE_CONFIRM. Modifié 70 — db.migrate.latest() dans startServer() (migrations auto au démarrage).
├── shared/
│   ├── polarisUtils.js                 # Modifié 61 — +calcAN, calcAllureMoy, calcAllures (exports partagés PI11). Modifié 65 Sprint GM-B : +DEFAULT_PNJ_ALLURES { lente:4, moyenne:8, rapide:16, max:24 }. Modifié 129 — +evaluateSalaryFormula(formula) pour calcul salaire wizard. calcSkillCost + getMaxMasteryByYears consommés depuis le rework Step4 Lot 1 (`shared/careerSkills.js`, chantier terminé Session 140, voir `docs/Old/PLAN_REWORKFINAL.md`) — ne sont plus du code mort. `estimateSalaryFormula` idem depuis le Lot 3 (`CareersAllocator.jsx`). Modifié 141 (suite 4) — `getAgeEffects(age, ctx)` : nouveau 2ᵉ paramètre optionnel, branche 16-19 ans (option young_penalty, OPT-10) gatée par `ctx.youngPenaltyEnabled`, malus FOR/PRE non applicable par attribut si `ctx.attributes` correspondant est déjà ≤7 ; malus de vieillesse (30+) inchangé et prioritaire. 2 points d'appel : `creationService.js` (calcul réel sur `finalAge`) et `AgeSelector.jsx` (aperçu client sur `baseAge`, désynchronisation assumée).
│   ├── careerEligibility.js            # NOUVEAU 139 (rework Step4 Lot 0) — evaluateCareerEligibility(career, context) pur : prérequis/génotype/attributs/études, raisons structurées (codes+params). Consommé serveur (checkCareerEligibility dans creationService) ; client au Lot 2.
│   ├── careerSkills.js                 # NOUVEAU 139 (rework Step4 Lot 1) — computeSkillAllocation(skillAllocations, ctx) pur : coût via calcSkillCost/getMaxMasteryByYears (polarisUtils, ex-code mort), pool global 10×années, plafond fixe +5 hors-pro. getSkillCap exporté séparément (plafond indépendant du coût). Modifié 139 (Lot 5) — +validateChoiceGroups(openedSkillIds, careerSkillRows) : exclusivité par ref_career_skills.choice_group (radio), ignore les lignes T1 sans groupe. Modifié 141 (suite 2) — getSkillCap gaté par ctx.skillMaxLevelEnabled (option skill_max_level, OPT-08) : plafond par années → Infinity si désactivé (conflit trouvé : REGLE_CREATION.txt:1250-1263 marque ce plafond "(OPTIONNEL)", jamais gaté depuis le rework Step4 — confirmé par Saar). Plafond fixe +5 origine inchangé, non concerné par ce toggle.
│   ├── careerAdvantages.js             # NOUVEAU 139 (rework Step4 Lot 4) — computeProAdvantageAllocation(allocations, ctx) pur : pool 5×années PAR MÉTIER (≠ compétences, globales), budget=0 si 0 catégorie (chasseur_primes).
│   ├── events.js                       # Modifié 64 — +COMBAT_DAMAGE_*/ATTACK_PLAYER_RESULT. Modifié 67 Sprint 7.6 — +COMBAT_RELOAD_RESULT. Modifié 67 Sprint CaC 1 — +COMBAT_MELEE_DEFENSE_PROMPT/CONFIRM/RESULT, +COMBAT_DECLARE_ERROR. Modifié 76 — +TOKEN_SET_ROTATION. Modifié 81 — +COMBAT_APPLY_STUN, +COMBAT_ANNOUNCE_PREVIEW. Modifié 85 — +CAMPAIGN_SETTINGS_UPDATED. Modifié 95-5b — +COMBAT_STUN_PROMPT/CONFIRM
│   ├── woundConstants.js               # NOUVEAU 49 — WOUND_LOCATIONS/SEVERITIES/MAX_COUNTS/PENALTIES/SEVERITY_COLORS
│   └── armorConstants.js               # NOUVEAU 54 — ARMOR_CATEGORY_MALUS/LOCATION_TO_SLOT/SLOT_TO_REF_LOCATION/LOCATION_TO_SVG/LOCATION_LABELS. Modifié 101 — +LOC_TABLE (déplacée depuis index.js inline)
└── docs/
```

---

## Infrastructure

| Composant | Tech | Notes |
|---|---|---|
| Frontend | React 19 + Vite | Port 5173 dev (8193 Kiwi) |
| Backend | Node.js + Express + Socket.io | Port 3001 dev (8194 Kiwi) |
| Serveur Alpha "Kiwi" | Debian 13, systemd, box Bouygues | `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md` |
| Base de données | PostgreSQL | Knex migrations |
| Cache/collisions | Redis + ioredis | Collision map par battlemap — branché session 39 |
| Stockage fichiers | MinIO | Bucket unique |
| Auth | JWT httpOnly cookie | 7 jours |
| Inscription | Code d'invitation `REGISTRATION_CODE` dans `.env` | 8 chiffres, `timingSafeEqual`, guard 500 si absent |
| Rechargement combat | `campaigns.settings.reload_mode` (JSONB, migration 104) | `'magazine'` (défaut) ou `'topup'` — configurable dans CampaignSettingsPage, lu via `campaignSettingsService.getCampaignSettings()` |

---

## Serveur

### Routes montées (index.js)
```
/api/health
/api/auth
/api/campaigns
/api/campaigns/:campaignId/characters    ← mergeParams
/api/characters                          ← actionsRouter (PUT/DELETE/upload)
/api/campaigns/:id/battlemaps
/api/battlemaps
/api/battlemaps/:id/tokens
/api/battlemaps/:id/entities
/api/tokens
/api/textures                            ← proxy MinIO textures pack
/api/assets                              ← proxy MinIO général
/api/users
/api/dice
/api/voxel-textures
/api/texture-packs
/api/entity-blueprints
/api/entities
/api/char-sheet
/api/char-ref
/api/equipment                           ← CRUD ref_equipment + junction tables (session 47)
/api/campaigns/:campaignId/documents     ← mergeParams — GET/POST/PUT/DELETE + POST /upload-image (session 75-80)
```

### Routes REST — Entities (/api/battlemaps/:id/entities + /api/entities)
| Méthode | Route | Description |
|---|---|---|
| GET | /battlemaps/:id/entities | Instances carte — JOIN blueprint avec pack_id (P47) |
| POST | /battlemaps/:id/entities | Poser une instance — GM uniquement + collisionAddEntity |
| PUT | /entities/:entityId | Modifier position/rotation/state/overrides — GM uniquement + maintenance Redis |
| DELETE | /entities/:entityId | Supprimer instance — GM uniquement + collisionRemoveEntity AVANT delete |

---

## Base de données — Migrations

| Migration | Contenu |
|---|---|
| 01→39 | voir JOURNAL archive |
| 41_entity_blueprints | entity_blueprints (id UUID, geometry/states/interactions JSONB, glb_url, deprecated, created_by) |
| 42_entities | entities (id UUID, battlemap_id CASCADE, blueprint_id, pos_x/y/z, r, current_state_id, gm_only, label_override, interaction_overrides JSONB, state JSONB, notes_gm) |
| 43_entity_pack_hint | entity_blueprints.pack_id UUID nullable FK → texture_packs.id + voxel_textures.usage_hint TEXT nullable |
| 44_tokens_rotation | tokens.r INTEGER NOT NULL DEFAULT 0 — 8 orientations 45° (PE21) |
| 45_polaris_mr_table | polaris_mr (mr_min PK, mr_max nullable, dmax) + seed 6 lignes |
| 46_polaris_mr_refonte | polaris_mr — colonne dmax → modifier (LdB p.209) — 20 lignes officielles |
| 47_campaigns_cover_url | campaigns.cover_url TEXT nullable — illustration campagne |
| 48_ref_equipment | ref_equipment (35 colonnes, 6 CHECK) + ref_equipment_skills + ref_equipment_skill_assoc + ref_equipment_ammo_compat |
| 49_character_wounds | character_wounds (UUID PK, char_sheet_id FK CASCADE, location/severity CHECK, is_stabilized, idx) |
| 50_char_inventory | char_inventory (UUID PK, FK characters CASCADE, FK ref_equipment SET NULL, container/slot/quantity/custom_props JSONB) + char_sheet.sols INTEGER |
| 51_inventory_slot_codes | Nullifie slots stales B/J via regex `(^|/)(B|J)(/|$)` — passage codes T/C → BG/BD/JG/JD |
| 52_add_current_ammo_to_inventory | char_inventory.current_ammo UUID nullable FK ref_equipment.id SET NULL — munition chargée dans une arme |
| 53_rename_ammo_unified | Phase 1 : 11 fusions doublons munitions (UPDATE FK + DELETE). Phase 2 : 89 renommages — "Balle"→"Munition", suppression qualificatif arme. Carreaux/Flèches/Darts : "Projectile" conservé. |
| 54_combat | combat_state + combat_roster + combat_actions — 3 tables, FK CASCADE, CHECK contraints |
| 55_character_type | characters.type TEXT NOT NULL DEFAULT 'pnj' CHECK ('pj','pnj') + backfill user_id IS NOT NULL → 'pj' |
| 56_combat_v2 | combat_actions : +action_key TEXT NOT NULL, +sequence SMALLINT, +target_pos_x/y/z INT, −is_micro, −initiative_score, −target_pos, +idx_actions_token/key. combat_roster : +state_position TEXT CHECK ('standing'/'crouching'/'prone'), +state_weapon TEXT CHECK ('holstered'/'ready'/'drawn'). battlemaps : +voxel_scale FLOAT DEFAULT 1.0 |
| 57_combat_v3 | combat_actions : +fire_mode TEXT, +bullet_count SMALLINT, +fire_mode_bonus_comp SMALLINT, +fire_mode_bonus_dmg SMALLINT. combat_roster : +state_character JSONB NOT NULL DEFAULT '{}' (PC39 — merge obligatoire, jamais remplacement) |
| 58_combat_v4 | combat_roster : +state_cover TEXT CHECK ('exposed'/'partial'/'important'), +state_fire_mode TEXT CHECK ('cc'/'rc'/'rl'), +state_vitesse TEXT CHECK ('normal'/'delayed'/'rushed'). Backfill state_vitesse='rushed' si state_character->>'is_rushed'='true' |
| 59_character_macros | character_macros (UUID PK, char_sheet_id FK CASCADE, label, formula, skill_id, attr_id, gm_modifier, sort_order) |
| 60_ammo_remaining | char_inventory.ammo_remaining SMALLINT nullable + campaigns.pnj_unlimited_ammo BOOLEAN NOT NULL DEFAULT false (colonne migrée vers campaigns.settings JSONB par la migration 104) |
| 61_combat_reload | combat_actions.type CHECK : ajout 'reload' |
| 62_campaign_reload_mode | campaigns.reload_mode TEXT NOT NULL DEFAULT 'magazine' CHECK ('magazine','topup') (colonne migrée vers campaigns.settings JSONB par la migration 104) |
| 63_melee | combat_actions : ajout 'melee' au CHECK constraint `chk_action_type` |
| 64_combat_mode | combat_roster : +`state_combat_mode TEXT NOT NULL DEFAULT 'normal'` CHECK ('normal','offensif','charge','defensif','retraite') |
| 65_action_timer | campaigns : +`action_timer_sec INTEGER NOT NULL DEFAULT 0` — 0 = infini, timer auto-skip Phase Annonce (colonne migrée vers campaigns.settings JSONB par la migration 104) |
| 66_campaign_default_token | campaigns : +`default_token_glb_url TEXT` nullable — URL GLB token par défaut de campagne |
| 67_campaign_documents | documents table (session 75) |
| 68_token_statuses | token_statuses (status_code per token, session 77) |
| 69_shock_auto_stun | campaigns : +`shock_auto_stun BOOLEAN NOT NULL DEFAULT true` (colonne migrée vers campaigns.settings JSONB par la migration 104) |
| 70_ammo_init_on_equip | backfill ammo_remaining armes équipées sans chargeur initialisé (session 81) |
| 71_drone_sheet | drone_sheet (character_id FK CASCADE, stats physiques + ordinateur_gen/nt, integrite_max/actuelle, localisation_ref, damages JSONB, notes_gm, equip_special) |
| 72_drone_sheet_fix | correctifs colonnes drone_sheet (ajout profondeur_max, disponibilite) |
| 73_drone_programs_catalog | drone_programs : DROP label, ADD equipment_id FK ref_equipment + label_override + category NOT NULL + CONSTRAINT chk_dp_source. Seed 34 programmes ref_equipment family='Logiciels' |
| 74_fix_ref_skills | ref_skills : 17 parents CHC créés, markers nettoyés, ACROBATIE renommé, prérequis corrigés (Session 83) |
| 75_ammo_caliber_names_fix | Caliber normalisé + doublons munitions fusionnés — table ref_equipment_ammo_compat nettoyée (Session 84) |
| 76–78 | À documenter — Sessions 86–92 |
| 79_token_statuses_expires_at_turn | token_statuses : +`expires_at_turn INTEGER` — déclencheur expiration stun par tour de combat (Session 93-3) |
| 80_combat_pending | combat_pending : PK (campaign_id, token_id, type), JSONB payload, FK CASCADE. type CHECK ('melee_defense','damage','stun'). Remplace 3 Maps in-memory REWORK-04 (Session 111) |
| 81_combat_state_subphase | combat_state : +`sub_phase TEXT` nullable CHECK ('SLOT_ACTIVE','AWAITING_DEFENSE','AWAITING_DAMAGE'). FSM sous-états persistés (Session 111) |
| 82→103b | À documenter — voir migrations correspondantes |
| 104_campaign_settings | Consolide `ambiance`, `pnj_unlimited_ammo`, `reload_mode`, `action_timer_sec`, `shock_auto_stun`, `allow_los_cancel` + 11 nouvelles options de campagne dans `campaigns.settings JSONB NOT NULL DEFAULT '{}'` (backfill puis DROP des 6 colonnes). DROP table morte `campaign_rules` (migration 97, jamais référencée). `dice_config` et `default_token_glb_url` restent des colonnes dédiées. Lecture centralisée via `server/src/lib/campaignSettingsService.js` (`SETTINGS_SCHEMA` + `getCampaignSettings(db, campaignId)`), écriture via `PUT /campaigns/:id` (merge JSONB atomique `db.raw('settings || ?::jsonb', …)`, pattern PC39) (Session 131) |
| 105_ref_skills_37bis | 3ᵉ révision consolidée de `ref_skills` (après 37/74/103/103b) — audit ligne par ligne complet dans `docs/Old/MIGRATION_37BIS.md`. `attr_1` devient nullable + nouvelle colonne `is_category BOOLEAN NOT NULL DEFAULT false` (remplace le sentinel `attr_1='CHC'` utilisé côté client pour le regroupement UI, cf. `SkillsPanel.jsx`). Suppression de `MUTATION` (catégorie fantôme) et `ARMES_SATELLITES` (hors LdB), re-parentage des 8 `MUTATION_*` vers `CONTROLE_DES_MUTATIONS`. 113 corrections de `marker` (legacy `'S'` → vraie valeur LdB), 11 labels, 4 attrs, 1 déplacement `ref_skill_requirements`. 249 lignes finales. `up`/`down` testés en base réelle (round-trip byte-identique) (Session 133) |
| 106_fix_ref_career_skills_lot1 | Corrige 9 `skill_id` erronés/manquants de `ref_career_skills` pour les 5 carrières du lot 1 (artisan_artiste, assassin, barman, chasseur_primes, contrebandier) vs `docs/Character/Creation/REGLE_PROFESSION.md`. Aucune suppression sur `ref_careers` (id stable). C3 barman ("armes au choix") volontairement hors scope — mécanisme `conditional` non implémenté. 93 lignes finales (89+4). `up`/`down` testés via appel direct des fonctions du module (round-trip byte-identique) (Session 134) |
| 107_seed_ref_careers_illustration_lot1 | Peuple `ref_careers.illustration` pour les 5 carrières du lot 1 (jamais rempli par la migration 100). Mapping vérifié contre MinIO réel (bucket `enclume-assets`) (Session 134 suite) |
| 108_seed_ref_careers_lot2 | Seed lot 2 : cultivateur_eleveur, diplomate, erudit_archeologue, espion, hybride_trident (+ toutes tables enfants : titres, education, point_categories, equipment, random_benefits). Bug `required_genotype` corrigé (`geno_hybride` inexistant → `GEN_HYB`). Migration 109 : illustrations des 5 carrières (Session 134 suite) |
| 111_ref_career_skills_fk | Ajoute `FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT` sur `ref_career_skills` (PIÈGE 1 corrigé pour cette table) + `DROP COLUMN skill_group` (texte libre jamais aligné avec `ref_skills.family`, source d'un bug de fragmentation UI). Backend `getStep4RefData` : JOIN `ref_skills` pour `family`. Frontend `CareersAllocator.jsx` : regroupement par `sk.family`. Détail : `docs/Old/PLAN_CAREER_SKILLS_FK.md` (Session 134 suite) |
| 112-116_seed_ref_careers_lot{3,4a,4b,5,6} | Seed lots 3-6 : 27 carrières (marchand → voleur_criminel), illustration incluse directement dans chaque migration. Bug `required_genotype` corrigé (`techno_hybride` : valeur inventée → `TEC_HYB`). Total 37/37 carrières, 0 orphelin FK. Détail : `docs/Old/PLAN_LOTS_3_6_CAREERS.md` (Session 134 suite) |
| 108_fix_ref_mutations_encoding | Corrige la corruption d'encodage (mojibake CP1252/UTF-8) sur `ref_mutations`/`ref_mutation_subtypes`/`ref_mutation_skills` insérée par le seed 95. Transformation déterministe et réversible (`decodeMojibake`/`encodeMojibake`, plage 0x80-0x9F). Coexiste avec `108_seed_ref_careers_lot2` (numéro dupliqué, tables disjointes, voir P53 dans `CLAUDE.md`) (Session 135) |
| 109_mutation_stacking | `ref_mutations.stack_deltas` (JSONB nullable) sur les 9 lignes à incrément non-linéaire (Peau renforcée, Purulence, Squelette renforcé, Résistance naturelle ×6). Réécriture `char_mutation_effects_view` (`SUM(base + (count-1) × COALESCE(stack_deltas->>col, base))`). Coexiste avec `109_seed_ref_careers_illustration_lot2` (numéro dupliqué, voir P53) (Session 135) |
| 117_ref_mutation_subtypes_description | Ajoute `ref_mutation_subtypes.description TEXT` (nullable) + backfill des 4 lignes CGA (texte déplacé depuis `creation.json`, aucune nouvelle rédaction). Débloque l'affichage réel de la sous-table CGA dans le wizard (`Step3Mutations.jsx`, voir `docs/Old/PLAN_STEP4.md`) (Session 136) |
| 118_fix_ref_mutations_organe_sensoriel_manquant | Corrige `cost_pc` sur 4 des 5 sous-types de "Organe sensoriel manquant" (smell/touch 0→1, hearing 1→2, sight 2→3 ; taste inchangé) — décalage d'indexation dans le seed `95_seed_ref_mutations.js:130-143` vs `docs/Character/Creation/REGLE_CREATION.txt:834-850`. `up`/`down` testés via appel direct des fonctions du module (round-trip byte-identique) (Session 138) |
| 119_char_sheet_wizard_lock | Ajoute `char_sheet.wizard_locked_at TIMESTAMPTZ` (nullable). Sépare la propriété "assistant" (rejouable, reconciliation à chaque ouverture de la fenêtre fiche personnage pendant le Wizard) de la propriété "runtime" (fiche éditable librement après verrouillage). `up`/`down` testés via appel direct des fonctions du module (round-trip confirmé) (Session 139) |
| 120_fix_ref_career_point_categories_lot1 | Insère les 26 lignes `ref_career_point_categories` manquantes pour 4 des 5 carrières du lot 1 (artisan_artiste, assassin, barman, contrebandier — même angle mort que la migration 106, jamais corrigé pour cette table). `chasseur_primes` a 0 ligne légitimement (absent LdB p.156). 30/30 sections restantes de `REGLE_PROFESSION.md` vérifiées conformes. Round-trip byte-identique (Session 139) |
| 121_ref_career_skills_choice_groups | Ajoute `ref_career_skills.choice_group TEXT` (nullable). Réécrit 24 des 44 lignes `conditional=true` (catégorie/enfant-proxy) en vrais enfants `ref_skills.parent` groupés par `choice_group` (scopé par `career_id`) ; supprime 4 doublons inertes (Diplomate ×3, Espion ×1) ; corrige 4 lignes Soldat d'élite `conditional=true`→`false` (flag erroné, texte source sans marqueur "(au choix)"). Audit exhaustif `PLAN_REWORKFINAL §7` + re-vérification directe de `REGLE_PROFESSION.md` et de la base réelle avant codage. Round-trip `down`/`up` testé en base réelle, byte-identique (Session 139) |
| 122_ref_career_random_benefits_lot1_and_points_alt | Ajoute `ref_career_random_benefits.points_alt INTEGER` (nullable) + backfill `points_alt=7` sur les 37 lignes `roll=10` déjà seedées (texte identique vérifié 37/37) + insert des 50 lignes manquantes (5 carrières du lot 1, jamais seedées à l'origine — même angle mort que les migrations 106/120, texte repris du fichier de référence pré-migration `docs/Character/Creation/migrations/93_seed_ref_careers_lot1.cjs`, cross-vérifié contre `REGLE_PROFESSION.md`). Débloque le Lot 6 (tirage 1D10) du chantier Redesign Step 4. Round-trip `down`/`up` testé en base réelle, byte-identique (320↔370 lignes) (Session 140) |

---

## charStats.js — Fonctions pures (server/src/lib/charStats.js)

| Fonction | Description |
|---|---|
| `calcNA` | Niveau Attribut net (base + pc + modGen, plancher 3) |
| `calcAN` | Aptitude Naturelle depuis table LdB |
| `calcAttributeAN/NA` | AN/NA pour un attr_id donné |
| `calcSkillTotal` | Total compétence (AN1+AN2+maîtrise) |
| `getModDom` | Modificateur de Dommages (FOR_na) |
| `calcREA` | Réactivité = polarisRound((ADA+PER)/2) |
| `calcSeuils` | Étourdissement + Inconscience |
| `calcAllures` | 4 allures LdB p.221 : lente/moyenne/rapide (COO_na) + max (Athlétisme total) |
| `calcResistanceDommages` | RD depuis table FOR+CON |
| `calcResistanceNaturelle` | RésNat depuis table |
| `calcResistanceDroguesInput` | (CON+VOL)/2 |
| `calcSouffle` | (CON+VOL)/2 |
| `calcWoundPenalty` | Malus blessures — pire gravité seule |
| `calcEncumbrancePenalty` | Malus encombrement kg > FOR×3 |
| `calcResistanceArmure` | Mille-feuille ETQ/PRT par slot (session 56) |
| `calcCarenceArmure` | Carence FOR = pire min_str − forNA (session 56) |

---

## woundUtils.js — Fonctions pures blessures (server/src/lib/woundUtils.js) — Session 97

| Fonction | Description |
|---|---|
| `isShockTestRequired(severity, location)` | bool — grave/critique/mortelle corps/tête |
| `nextSeverity(severity)` | Sévérité suivante en cascade (WOUND_SEVERITIES ascendant) |
| `resolveWoundInsertion(trx, char_sheet_id, location, severity)` | Transaction knex — insertion avec promotion en cascade. Throw AppError si ligne pleine. |
| `getWorstWoundSeverity(db, charSheetId)` | Sévérité la plus grave pour un char_sheet — WOUND_SEVERITIES.slice().reverse() |

## woundService.js — Service blessures WS (server/src/lib/woundService.js) — Session 97

| Fonction | Description |
|---|---|
| `applyWound(io, db, campaignId, {...})` | Transaction + WOUND_ADDED broadcast (avec worst_wound_severity). Retourne `{ finalSeverity }` ou null. |

---

## Collision map Redis — session 39

### Architecture
```
Redis Hash : "collision:{battlemap_id}"
  champ : "x:y:z"   (séparateur ":" — P17, coordonnées PE14 base)
  valeur : JSON { type: 'token'|'entity'|'voxel', id: string }
TTL : 24h — reconstruite à chaque SESSION_JOIN (PE23)
```

### Filtres
- Tokens `layer = 'gm'` : exclus (invisibles aux joueurs)
- Entités : incluses uniquement si `is_blocking = true` dans l'état courant
- Voxels : tous inclus — convertis Three.js→PE14 dans buildCollisionMap/add/remove (PE28)

### Reconstruction
`buildCollisionMap(battlemapId)` — pipeline Redis, appelée au SESSION_JOIN depuis `player_locations`.
Non bloquante si joueur sans `player_location` (première connexion).

### Maintenance temps réel
| Événement | Handler | Action Redis |
|---|---|---|
| Token créé | `POST /tokens` (REST) | `collisionAddToken` |
| Token déplacé | `PUT /tokens/:id` (REST) + `TOKEN_MOVE` (WS) | `collisionMoveToken` |
| Token supprimé | `DELETE /tokens/:id` (REST) | `collisionRemoveToken` AVANT delete |
| Token rotate | `TOKEN_ROTATE` (WS) | aucune — position inchangée |
| Entité créée | `POST /entities` (REST) | `collisionAddEntity` |
| Entité déplacée/état changé | `PUT /entities/:id` (REST) | `collisionMoveEntity` ou `collisionUpdateEntityState` |
| Entité supprimée | `DELETE /entities/:id` (REST) | `collisionRemoveEntity` AVANT delete |
| Entité état changé (interaction) | `resolveEntityState` (WS) | `collisionUpdateEntityState` |
| Voxel ajouté | `VOXEL_ADD` (WS) | `collisionAddVoxel` |
| Voxel supprimé | `VOXEL_REMOVE` (WS) | `collisionRemoveVoxel` |
| Voxel tourné | `VOXEL_UPDATE` (WS) | aucune — position inchangée |

---

## Déplacement entités — sessions 40-43 (9F-B1/B2/C)

### Events WS
- `ENTITY_MOVE_REQUEST` — joueur/GM → serveur : demande de déplacement
- `ENTITY_MOVE_RESULT` — serveur → joueur : résultat jet + positions finales

### Handler `ENTITY_MOVE_REQUEST` (socket/index.js)
- Guards : campaignId, double-soumission via pendingEntityActions
- Guard GM retiré en session 41 — GM passe par le même flux jet d'attribut
- Ownership : token.character_id → characters.user_id === socket.user.id
- Distance Tchebychev 3D acteur ↔ entité (inclut altitude pos_z)
- actualMoveType calculé par dot(AE, AD) — PE27
- Jet attribut via calcAttributeNA(attrs, attributeId, genotypeRow)
- MR = attributeNA + 1d20 - effectiveDifficulty → getModifier(mrTable, mr)
- dmax = isSuccess ? modifier + 1 : 0 — toute réussite = au moins 1 case
- stepsMax = Math.min(dmax, stepsTarget) — destination joueur respectée (PE30)
- dmax_override si défini dans l'interaction (plafonne push ET pull)
- Step-by-step : isCaseOccupied entity à pos_z, acteur à pos_z+1 (PE29), excludeIds=[tokenId,entityId] (PE22)
- Update DB + collisionMoveEntity + collisionMoveToken Redis
- Broadcast ENTITY_MOVED + TOKEN_MOVED → room
- ENTITY_MOVE_RESULT → socket.id uniquement

### Cache MR_TABLE
`let MR_TABLE = null` + `getMrTable()` + `getModifier(mrTable, mr)` — hors `initSocket`.
Chargée une seule fois depuis DB au premier jet.

### Mode visée client — session 41/43

#### Canvas3D.jsx
- Ghost : `PlaneGeometry(1,1)` wireframe au sommet de la colonne (`getColumnTopY + 1 + 0.05`)
- Snap 8 axes depuis l'entité (ratio 2:1) — session 43
- Couleurs : bleu=push (#2563eb), orange=pull (#f97316), rouge=impossible (#ef4444)
- Lerp 300ms TokenMesh — groupRef + lerpPos + targetRef + useFrame

#### EntityMesh.jsx
- Lerp 300ms dans `EntityMeshVoxel` et `EntityMeshGlb` — useFrame dans sous-composants
- tau=0.1 → 95% en ~300ms

---

## Dice Rework — session 44

### Architecture
- DiceRoller monté dans Canvas3D — un seul contexte WebGL (pas d'overlay HTML séparé)
- DICE_RESULT consommé deux fois en parallèle : chat + animation
- Animation déclenchée uniquement si `!skillLabel` (jets normaux, pas jets entités)
- `seed` du payload initialise le PRNG déterministe de l'animation
- **`dieType` absent du payload `DICE_RESULT` (P56, trouvé Session 140)** : `socketDice.js` le calcule
  mais ne l'émet jamais — `SessionPage` le reconstruit depuis `formula` (`useSessionSocket.js:62`).
  Tout nouveau montage de `<DiceRoller>` hors `SessionPage`/`Canvas3D.jsx` doit ajouter `dieType`
  lui-même (en dur si la formule émise est fixe). Consommateurs Wizard (Session 140) :
  `CareersAllocator.jsx` (`dieType:'d10'`, Lot 6 Tirage 1D10), `Step3Mutations.jsx` (`dieType:'d20'`,
  méthode Tirage aléatoire). `DiceLights.jsx` (`client/src/components/`, NOUVEAU) : rig lumière
  (`ambientLight 0.8` + 2 `directionalLight`, identique à `Canvas3D.jsx:889-892`) extrait en composant
  partagé pour ces overlays isolés — jamais consommé par `Canvas3D.jsx` lui-même (zéro modification).
- **Wizard de création connecté en socket pour la 1ʳᵉ fois (Session 140)** : `WizardCreation.jsx`
  enveloppe tout le `wiz-shell` dans `<SocketProvider campaignId={campaignId}>` (monté une seule fois,
  jamais démonté entre les steps — évite le spam `SESSION_JOIN`/`SESSION_USER_JOINED`). Les composants
  enfants consomment via `useSocket()`, aucun ne monte son propre `SocketProvider`.

### Dés supportés
> Table corrigée Session 141 (suite 5) — obsolète depuis la bascule complète vers `.glb` (Session 65,
> jamais mise à jour depuis). Les 8 dieType (`d4`/`d6`/`d8`/`d10`/`d10_units`/`d10_tens`/`d12`/`d20`)
> ont tous une entrée `GLB_PATHS` (`diceMath.js`) → `DiceMeshProcedural` (géométrie procédurale,
> CanvasTexture/atlas/overlay Html décrits ci-dessous) n'est plus jamais atteint en pratique, gardé
> en fallback pur.

| Dé | Géométrie réelle utilisée | Chiffre | Statut |
|---|---|---|---|
| D4 | GLB (D4_LP Blender) | Texture GLB baked | ✅ normales vérifiées |
| D6 | GLB (D6_LP Blender) | Texture GLB baked | ✅ normales vérifiées |
| D8 | GLB (D8_LP Blender) | Texture GLB baked | ✅ normales vérifiées |
| D10 | GLB (D10_LP Blender) | Texture GLB baked | ✅ recalibré Session 141 (PLAN_DICEREWORK3) |
| D10_units (moitié D100) | GLB — même fichier `D10.glb` que D10 | Texture GLB baked | ✅ recalibré Session 141 |
| D10_tens (moitié D100) | GLB (D100_LP Blender, fichier séparé, même géométrie) | Texture GLB baked | ✅ recalibré Session 141 |
| D12 | GLB (D12_LP Blender) | Texture GLB baked | ✅ confirmé fonctionnel Saar |
| D20 | GLB (D20_LP Blender) | Texture GLB albedo 4096×4096 | ✅ normales exactes session 65 |

### Pièges actifs Dice Rework
- `DiceMesh.useMemo` deps `[geoDef.type, color, dieType]` — `dieType` désormais inutilisé dans ce
  useMemo (warning ESLint connu, code procédural D10 retiré Session 141) — sans impact, chemin mort.
- D12 atlas `fillText` à `atlasSize * 0.397` — centroïde calculé, ne pas modifier (procédural, dead
  code désormais mais laissé en l'état)
- **PLAN_DICEREWORK3 (Session 141 suite 5)** : `D10_GLB_NORMALS`/`D10T_FACE_GLB` (`diceMath.js`)
  recalibrées via harnais temporaire `/dev/dice-calibration` (retiré) — les tables précédentes
  (introduites Session 65 en même temps que les fichiers `.glb`) ne correspondaient à aucune face
  réelle des fichiers. Code mort associé supprimé : `D10_KITE_NORMALS`/`D10_KITE_VALUES`/
  `createD10Geometry()`.

### V2 / todo
- Audio — `useDiceAudio.js` — sons d'impact au rebond

---

## Rotation tokens — session 39

- `tokens.r` : INTEGER 0-7 — `rotation.y = r * Math.PI / 4` (PE21)
- `TOKEN_ROTATE` WS : clic court sur token propriétaire → serveur incrémente `r = (r+1) % 8` → broadcast `TOKEN_UPDATED`
- Canvas3D : rotation appliquée sur `<group>` parent — tilt drag conservé sur `<primitive>` enfant

---

## Composants entités — session 34

### EntityMesh.jsx
- Branche voxel (`EntityMeshVoxel`) + branche GLB (`EntityMeshGlb`)
- Timer 400ms sur `onPointerLeave` via `leaveTimerRef`
- Hitbox invisible ×1.4 en X et Z
- `HoverIcon` : `<Html>` pointerEvents none, div interne auto
- PE14, PE11, PE4, P32 respectés

### RadialMenu.jsx
- Menu SVG fixed centré sur le clic
- Tranche GM "Modifier" en violet
- Tranche displacement → onMove (pas onAction)
- Grisage si acteur hors portée (distance Tchebychev 2D)
- Fermeture : clic extérieur, Échap, centre ✕, après action

### EntityInstancePanel.jsx
- Panneau flottant GM — modifie l'instance uniquement
- Champs : `label_override`, `gm_only`, `disabled_interactions`, `notes_gm`
- Header draggable, sauvegarde via PUT /entities/:id

---

## Flux interactions entités

### Flux joueur skillcheck ✅
```
Joueur clique ⚙ → handleEntityClick → filter interactions par current_state_id
  → si 1 seule interaction skillcheck : action directe sans radial
  → si 2+ interactions : RadialMenu
Joueur choisit → handleEntityAction → socket.emit(WS.ENTITY_ACTION_REQUEST)
Serveur → ENTITY_ACTION_PENDING → GM reçoit notification dans chat
GM arbitre → socket.emit(WS.ENTITY_ACTION_RESOLVE)
Serveur → resolveEntityState → update current_state_id → collisionUpdateEntityState → ENTITY_UPDATED broadcast
```

### Flux joueur déplacement ✅
```
Joueur clique ⚙ → handleEntityClick
  → si 1 seule interaction displacement : handleEntityMove direct
  → si 2+ interactions : RadialMenu → tranche Déplacer → handleEntityMove
handleEntityMove → trouve token acteur → setMoveTarget → mode visée Canvas3D
Canvas3D : ghost wireframe snappé 8 axes, couleur bleu/orange/rouge selon dot(AE,AD)
Joueur clique destination (dot≠0) → ENTITY_MOVE_REQUEST émis
Serveur → jet attribut → ENTITY_MOVED + TOKEN_MOVED broadcast → ENTITY_MOVE_RESULT → joueur
SessionPage listener → setMoveTarget(null) + badge MR dans chat
Canvas3D/EntityMesh → Lerp 300ms vers position finale
```

### Flux GM ✅
Action directe via ENTITY_ACTION_GM_DIRECT — sans arbitrage ni traçage.
GM peut aussi utiliser le flux déplacement — même flux jet attribut que joueur.

### Flux sans compétence ✅
skill_id et attribute_id null → resolveEntityState direct, sans notifier le GM, sans jet.

### Règles mécaniques Polaris (LdB p.404 + p.236)
```
effectiveMalus    = calcWoundPenalty(wounds) − calcEncumbrancePenalty(weight, FOR)
chancesDeReussite = skillTotal + difficulty_dc + gmModifier + effectiveMalus
isSuccess         = diceRoll <= chancesDeReussite
difficulty_dc     = modificateur signé (-20 à +10)
```
Malus santé (blessures) : non-cumulatif — pire blessure seule retenue (LdB p.236).
Malus encombrement : règle maison, s'additionne au malus santé.

---

## Pièges actifs — tous domaines

| Code | Description |
|---|---|
| P13 | updated_at après guard Object.keys |
| P14 | updated_at jamais dans JWT |
| P19 | glb_url avec ?v=timestamp |
| P20 | mat.clone() avant mutation Three.js |
| P22 | voxel_textures.id = integer |
| P26 | blocksReady = true même si 0 textures |
| P32 | Ordre faces BoxGeometry : east(0)…north(5) |
| P43 | MinIO textures par pack_uuid |
| P44 | name pack immuable |
| P46 | Route spécifique avant paramétrique |
| P47 | pack_id doit être dans le SELECT JOIN entities GET + ENTITY_CREATED socket |
| P48 | handleEntityMove déclaré avant handleEntityClick (session 41) |
| PE2 | socket.data.role pour fetchSockets() |
| PE4 | face null = invisible |
| PE7 | current_state_id = index entier dans states[] — jamais UUID |
| PE11 | fallback states[0] |
| PE12 | clearTimeout pendingEntityActions |
| PE14 | pos_y/pos_z inversés Three.js ↔ base |
| PE16 | e.code pour Alt |
| PE17 | usage_hint hint de tri, jamais exclusif |
| PE18 | blueprint.pack_id nullable — guard |
| PE19 | transparent={true} obligatoire sur meshLambertMaterial — opacity=0 ineffectif sans ça |
| PE20 | HoverIcon : toujours monté si hasInteractions, jamais conditionnel à hovered — visibilité CSS uniquement |
| PE21 | r tokens = 0-7 — rotation.y = r * Math.PI / 4 |
| PE22 | tunnel de swap excludeIds dans isCaseOccupied |
| PE23 | buildCollisionMap au SESSION_JOIN — pas au démarrage serveur |
| PE24 | collisionMoveToken : hdel systématique ancienne case, hset conditionnel layer |
| PE25 | maintenance Redis dans REST, pas dans handlers WS reliques |
| PE26 | resolveEntityState : returning doit inclure battlemap_id |
| PE27 | moveType calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux |
| PE28 | Voxels Redis : convertis Three.js→PE14 dans buildCollisionMap/add/remove |
| PE29 | Acteur step-by-step vérifié à pos_z+1 — espace de marche |
| PE30 | stepsMax = Math.min(dmax, stepsTarget) |
| PE31 | upsertCharacter : guard visible+isGm |
| PE32 | DiceMesh useMemo deps [geoDef.type, color, dieType] |
| PE33 | D10 Html overlay position=[0,0,0] — ne pas déplacer |
| P49 | Promotion blessures : si promoted===true → GET /wounds complet — ne jamais ajouter localement |
| P50 | toggle Polaris : ne jamais dupliquer charSkills dans un sous-composant — lift state up obligatoire |
| P51 | Malus non-cumulatifs santé : pire seul (LdB p.236). Encombrement (maison) : cumulatif. effectiveMalus = woundPenalty − encumbrancePenalty |
| PI11 | polarisRound source unique shared/polarisUtils.js — jamais redéfini localement |
| PC27 | `!token.character_id` = Entité de décor, jamais PNJ. PNJ = `character.type === 'pnj'`. Entité exclue du combat. |
| PEF1-PEF6 | voir SYSTEME.md section 6 |
