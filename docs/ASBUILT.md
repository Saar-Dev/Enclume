# ASBUILT â€” Ce qui est codÃ© et stable
> DerniÃ¨re mise Ã  jour : 2026-06-04 Session 81
> Ce document est un snapshot de rÃ©fÃ©rence rapide.
> Pour les flux dÃ©taillÃ©s, ownership, piÃ¨ges : voir SYSTEME.md.
> Pour l'historique des dÃ©cisions : voir JOURNAL2.md.

---

## Structure du projet
```
Enclume/
â”œâ”€â”€ client/
â”‚   â”œâ”€â”€ public/
â”‚   â”‚   â”œâ”€â”€ fonts/
â”‚   â”‚   â”‚   â””â”€â”€ inter.woff              # Police locale pour labels 3D (drei Text)
â”‚   â”‚   â”œâ”€â”€ favicon.svg                 # âš  prÃ©sent mais non rÃ©fÃ©rencÃ© â€” Ã  brancher
â”‚   â”‚   â””â”€â”€ CHANGELOG.md               # ModifiÃ© 67 Sprint 7.6 â€” +v67 rechargement combat
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatOverlay.jsx        # ModifiÃ© 64 â€” +combatTargetMode. ModifiÃ© 66 â€” +shockResult. ModifiÃ© 67 Sprint 7.6 â€” +CombatResultReload. ModifiÃ© 67 Sprint CaC 1 â€” +CombatResultMelee (bottom-right), +modal dÃ©fense PJ. ModifiÃ© 71 â€” +actionTimerSec prop passÃ© Ã  CombatTimeline. ModifiÃ© 72 CaC 4a â€” alerte âš  encerclement dans defense prompt + props multiMalus* vers CombatResultMelee. ModifiÃ© 81 Sprint Annonce v2 â€” prop announcementMarker + mini-panneau bottom-left "vient d'annoncer" (nom, INI, dÃ©placement, cible), visible pour tous, pointerEvents:none
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatRosterWindow.jsx  # RÃ©Ã©criture complÃ¨te 65 Sprint GM-A. ModifiÃ© 66 â€” draggable (useDraggable, key combat-roster-pos) â€” dÃ©tection arme/armure, chips T/C/B/J (PjArmorChips/PnjArmorChips), quick-equip PNJ, banniÃ¨re alerte, fetches parallÃ¨les combat-ini+combat-equipment+refWeapons+refArmors. Modifié 83 Rework Design — const S migré vers classes CSS système (combat-win/combat-badge/combat-chip/combat-select/btn-tac-confirm)
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatTimeline.jsx      # RÃ©Ã©criture complÃ¨te 71 â€” BG3-style, Motion FLIP, ANNOUNCEMENT(roster ASC)/RESOLUTION(actions seq), TimelineCard, timer countdown, MAX_CARDS=12, phase indicator+flÃ¨che. ModifiÃ© 81 â€” isDimmed=hasAnnounced&&!isActive en phase ANNOUNCEMENT, passÃ© Ã  TimelineCard. Modifié 83 Rework Design — styles.bar() → .combat-timeline-bar
â”‚   â”‚   â”‚   â”œâ”€â”€ TimelineCard.jsx        # NOUVEAU 71 â€” carte portrait plein format, gradient overlay nom+INI, bordure SEVERITY_COLORS, taille active 72Ã—100/normal 54Ã—76, badges âœ“âš . ModifiÃ© 81 â€” prop isDimmed -> opacity 0.35. Modifié 83 Rework Design — 5 hex inline → CSS vars (--halo-active, --color-gold, --color-primary, --color-success-soft, --color-warning-soft)
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatActionWindow.jsx  # ModifiÃ© 66 â€” draggable v2, StateSelector, exclusion mutuelle EXCLUSIVE_ACTIONS. ModifiÃ© 67 Sprint 7.6 â€” +reload panneau. ModifiÃ© 67 Sprint CaC 1 â€” +melee panneau droit (liste armes contact + allonge + cible via target mode), Phase 2 myMeleeAction, reset has_announced, COMBAT_DECLARE_ERROR listener. ModifiÃ© 68 Sprint CaC 2 â€” +combatMode state (normal/offensif/charge), mode selector 3 chips, handleChargeFlow sÃ©quentiel (chargeAllures=lente uniquement), meleeValid Charge, payload state.combat_mode + move.ini_mod=0. ModifiÃ© 68 Sprint CaC 3 â€” meleeDefensif const ligne 330 (fix TDZ), modes DÃ©fensif+Retraite : chips vert uniforme, melee/cible masquÃ©s si meleeDefensif, handleRetraiteMove() toggle zone lente ini_mod=0, mapActionsObj.melee=null, server freeMove Ã©tendu Ã  retraite. ModifiÃ© 81 â€” isAmmoEmpty fix + setMeleePendingTokenIds fix + refactor multi-token (playerChars filter, playerTokensInRoster, activeStoreToken, useDraggable dÃ©placÃ© avant early returns, rosterSection collapsible localStorage). Modifié 83 Rework Design — const W migré (window/header/body/section/footer → combat-float-win) + const ss hex→CSS vars
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatDamageWindow.jsx  # NOUVEAU 64 Sprint 7.4 â€” fenÃªtre PJ lancer dÃ©s dÃ©gÃ¢ts : Phase 1 dÃ©s vides / Phase 2 animation / Phase 3 rÃ©sultats colorÃ©s. ModifiÃ© 66 Sprint Test de Choc : +bloc Test de Choc aprÃ¨s severityBanner (roll/seuil/outcome colorÃ©). Modifié 83 Rework Design — styles.window/header migré (combat-float-win, cursor:default overlay non-draggable)
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatModifiersWindow.jsx # NOUVEAU 64 Sprint 7.2. ModifiÃ© 65 Sprint 7.6. ModifiÃ© 66 â€” draggable (useDraggable, sticky retirÃ© du header) â€” is_rushed â†’ state_vitesse === 'rushed'. Modifié 83 Rework Design — const styles migré (window/header/sections/footer/btns → combat-float-win/btn btn-gold/btn-ghost)
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatResultPanels.jsx  # NOUVEAU 66 Sprint Test de Choc â€” CombatResultGM + CombatResultPlayer + ShockBlock. ModifiÃ© 67 Sprint 7.6 â€” +CombatResultReload. ModifiÃ© 67 Sprint CaC 1 â€” +CombatResultMelee (bottom-right, jets opposition attaque/dÃ©fense colorÃ©s). ModifiÃ© 72 CaC 4a â€” CombatResultMelee +bloc âš  orange encerclement si multiMalusAttaquant ou multiMalusDefenseur â‰  0
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatPnjPanel.jsx      # NOUVEAU 58 â€” modal GM PJs/PNJs read-only, isPnj via character.type
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatGmDeclareWindow.jsx # RÃ©Ã©criture complÃ¨te 81 Sprint Annonce v2 â€” batch supprimÃ©, queues supprimÃ©es, appels directs onEnterMoveMode/onEnterTargetMode, Ã©tats directs (pendingMove, assaultTarget, meleeTargets, chargeSelection), roster lecture seule, bouton "Passer [PJ]" quand slot actif = PJ. ~600 lignes vs 1128 avant. ModifiÃ© 81 S1 GM â€” rosterOpen localStorage('gm-roster-open'), toggle â–²â–¼ dans rosterHeader.. Modifié 83 Rework Design — const S partiel migré (window/header/sections/footer/btnDeclare → classes CSS)
â”‚   â”‚   â”‚   â”œâ”€â”€ CombatInitStateWindow.jsx # NOUVEAU 65 Sprint 7.6 â€” fenÃªtre joueur phase ROSTER : sÃ©lection Ã©tat initial (position/arme/mode de tir), StateChip click-to-cycle, draggable, emit COMBAT_INIT_STATE. AffichÃ© par CombatOverlay.
â”‚   â”‚   â”‚   â”œâ”€â”€ combatSections.js       # ModifiÃ© 65 Sprint 7.6 â€” STATE_DEFS, MAP_ACTIONS, QUICK_ACTIONS, MOVE_ZONE_DEFS. ModifiÃ© 67 Sprint 7.6 â€” +reload dans MAP_ACTIONS (span2, aprÃ¨s melee), +span2 sur move, EXCLUSIVE_ACTIONS dans CombatActionWindow
â”‚   â”‚   â”‚   â”œâ”€â”€ Canvas3D.jsx            # ModifiÃ© 64 â€” +combatTargetMode prop, combatTargetModeRef (P40), intercept dragâ†’target, ligne R3F attaquantâ†’cible (useMemo targetLinePoints). ModifiÃ© 65 Sprint Pathfinding â€” A* Chebyshev temps rÃ©el (cases colorÃ©es par allure, murs respectÃ©s). ModifiÃ© 65 Sprint Raycast â€” raycastVoxelColumn via fast-voxel-raycast (remplace plan y=0 fixe, prÃ©cis sur terrain Ã©levÃ©). ModifiÃ© 70 â€” TokenGlbBody + TokenFallbackBody + TokenGlbErrorBoundary, HARDCODED_DEFAULT_TOKEN_URL=/models/default.glb, prop defaultTokenGlbUrl, hiÃ©rarchie fallback 4 niveaux. ModifiÃ© 73 â€” Billboard drei sur Ã©tiquettes tokens (billboarding), color=user_color||token.color||'#4A90D9', drag snappedX/Z (snap case), raycastVoxelColumn +rawX/rawZ, drag utilise raycastVoxelColumn (prÃ©cision altitude). ModifiÃ© 76 â€” clic simple = ouvre TokenRadialMenu (handlePointerUp onTokenRotateâ†’onTokenDoubleClick, dep array mis Ã  jour), TokenMesh.onDoubleClick retirÃ©. ModifiÃ© 76 Sprint Voxels â€” boucle Voxel remplacÃ©e par <CulledVoxelScene>, import Voxel retirÃ©. ModifiÃ© 79 â€” getVoxelSurfaceTop() module-level (slab_bottomâ†’y+0.5), colTopSurface useMemo O(1) (remplace getColumnTopY O(N)), dragRef enrichi (snappedX/Z/surfaceY stockÃ©s pendant drag), handlePointerUp lit dragRef pas curseur, threeToDb(x, surfaceY-1.0, z), Math.floor (was Math.round), ghost overlay corrigÃ©. ModifiÃ© 81 Sprint Annonce v2 â€” prop announcementMarker (outer+inner Scene), ghost box bleue (PE14â†’Three.js) Ã  moveTarget, ligne ambre tokensRef dÃ©clarantâ†’cible (Float32Array, mÃªme pattern que targetLinePoints). ModifiÃ© 81 S2 â€” ghost dÃ©placement enrichi : ligne bleue (#7ab8f5) origineâ†’destination + Billboard+Text FONT_URL nom du token au-dessus destination
â”‚   â”‚   â”‚   â”œâ”€â”€ Editor3D.jsx            # ModifiÃ© 9C â€” EntityEditorScene, activeEditorTab
â”‚   â”‚   â”‚   â”œâ”€â”€ EntityMesh.jsx          # ModifiÃ© 43 â€” Lerp 300ms EntityMeshVoxel + EntityMeshGlb
â”‚   â”‚   â”‚   â”œâ”€â”€ EntityBuilderTab.jsx    # ModifiÃ© 40 â€” refonte formulaire interactions SkillCheck/DÃ©placement
â”‚   â”‚   â”‚   â”œâ”€â”€ VoxelBuilderTab.jsx     # Stable 33
â”‚   â”‚   â”‚   â”œâ”€â”€ RadialMenu.jsx          # ModifiÃ© 41 â€” tranche displacement, grisage portÃ©e, onMove
â”‚   â”‚   â”‚   â”œâ”€â”€ TokenRadialMenu.jsx     # NOUVEAU 76 â€” menu radial SVG 370Ã—370 sur tokens : 8 secteurs (Ficheâœ…+Retirerâœ…+6 placeholders), cÅ“ur disque worst_wound_severity, anneau blessures simplifiÃ© Sprint1, bloom+danger pulse, boussole directionnelle (zone 15â€“42px, atan2â†’r 0..7, TOKEN_SET_ROTATION)
â”‚   â”‚   â”‚   â”œâ”€â”€ EntityInstancePanel.jsx # ModifiÃ© 36 â€” sÃ©lecteur Ã©tat actuel
â”‚   â”‚   â”‚   â”œâ”€â”€ CulledVoxelScene.jsx    # NOUVEAU 76 â€” rendu voxels fusionnÃ© : buildCulledMesh + BufferGeometry par (texIdÃ—physIdx) + dispose useEffect. Non-cubes â†’ <Voxel> individuel. ModifiÃ© 77 Phase B â€” commentaire uniquement.
â”‚   â”‚   â”‚   â”œâ”€â”€ Voxel.jsx               # Stable 9A-5
â”‚   â”‚   â”‚   â”œâ”€â”€ Sidebar.jsx             # ModifiÃ© 64 Sprint 7.4 â€” +rendu interactionType='combat_damage' (dÃ©gÃ¢ts colorÃ©s par sÃ©vÃ©ritÃ©). ModifiÃ© 36 â€” entity_action structurÃ©. ModifiÃ© 65 Sprint DicePanel v3 â€” +ðŸ”’ dans diceHeader si msg.secret. ModifiÃ© 73 â€” messages depuis messagesByCampaign[activeCampaignId]
â”‚   â”‚   â”‚   â”œâ”€â”€ GeometryIcon.jsx        # Stable 9A-3
â”‚   â”‚   â”‚   â”œâ”€â”€ DicePanel.jsx           # RÃ©Ã©criture complÃ¨te 65 Sprint DicePanel v3. ModifiÃ© 66 â€” favoris inline form, section MACROS (chips â˜…, form crÃ©ation 3 dropdowns, preview seuil live, fix GM effectiveCharId) â€” roue radiale SVG (PCBBackground, DieShape, DieButton), formule mono-type {k,n,mod}, favoris localStorage, historique local socket, JET AU MJ fonctionnel, useAuthStore direct, drag conservÃ©
â”‚   â”‚   â”‚   â”œâ”€â”€ DiceMesh.jsx            # NOUVEAU 44 â€” gÃ©omÃ©tries, matÃ©riaux, animation, Html overlay D10. ModifiÃ© 65 â€” branche D20 dÃ©diÃ©e supprimÃ©e â†’ D20 passe par faceNormalâ†’D20_GLB_NORMALS (normales Blender exactes)
â”‚   â”‚   â”‚   â”œâ”€â”€ DiceRoller.jsx          # NOUVEAU 44 â€” orchestrateur R3F dans Canvas3D
â”‚   â”‚   â”‚   â”œâ”€â”€ ChangelogPanel.jsx      # NOUVEAU 66 â€” panneau latÃ©ral rÃ©tractable Dashboard : fetch+parse CHANGELOG.md, auto-open localStorage (changelog_last_seen), PCB SVG dÃ©co, 38px rail â†” 340px ouvert, tags AJOUT/CORRECTIF/CHANGEMENT
â”‚   â”‚   â”‚   â”œâ”€â”€ LibraryPanel.jsx        # NOUVEAU 75 â€” liste documents campagne, ShareIndicator (Å“il/punaise), canEdit, ouvre DocumentModal
â”‚   â”‚   â”‚   â””â”€â”€ DocumentModal.jsx       # NOUVEAU 75 â€” Ã©diteur Quill x2 (content+gmNotes), PermissionSelect (portal), save/delete. ModifiÃ© 80 â€” makeImageHandler base64â†’upload MinIO (POST /upload-image), useQuillEditor +campaignId/onError
â”‚   â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”‚   â”œâ”€â”€ LoginPage.jsx           # ModifiÃ© 69 â€” +useEffect import + document.title 'Enclume â€” Connexion'
â”‚   â”‚   â”‚   â”œâ”€â”€ RegisterPage.jsx        # ModifiÃ© 66 â€” +champ "Beta code". ModifiÃ© 69 â€” +useEffect import + document.title 'Enclume â€” Inscription'
â”‚   â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”‚   â””â”€â”€ useDraggable.js         # NOUVEAU 66 â€” hook partagÃ© drag+localStorage+clamp (storageKey, defaultPos, panelW)
â”‚   â”‚   â”‚   â”œâ”€â”€ RegisterPage.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ DashboardPage.jsx       # ModifiÃ© 45 â€” upload cover. ModifiÃ© 66 â€” layout flex+ChangelogPanel. ModifiÃ© 68 â€” formulaires inline. ModifiÃ© 69 â€” document.title 'Enclume â€” Tableau de bord'. ModifiÃ© 73 â€” deux cartes CrÃ©er/Rejoindre symÃ©triques (filigrane +/â†’, formulaires inline, refs focus, suppression actionsRow/showCreate/showJoin)
â”‚   â”‚   â”‚   â”œâ”€â”€ SessionPage.jsx         # ModifiÃ© 64-66 â€” combat, dÃ©s. ModifiÃ© 69 â€” document.title dynamique. ModifiÃ© 70 â€” defaultTokenGlbUrl. ModifiÃ© 71 â€” +updateCharacter destructure, +3 listeners wound (WOUND_ADDED/UPDATED/REMOVED â†’ updateCharacter({id,worst_wound_severity})), +actionTimerSec prop CombatOverlay. ModifiÃ© 73 â€” setActiveCampaign(campaignId) dÃ©but useEffect socket. ModifiÃ© 76 â€” dropdown token remplacÃ© par TokenRadialMenu, contextMenuRef+useEffect click-outside supprimÃ©s, handleRemoveContextToken (sans setContextMenu), handleSetContextTokenRotation (TOKEN_SET_ROTATION). ModifiÃ© 79 â€” fix TDZ : useState statusPanel dÃ©placÃ© avant useEffect qui l'utilise. ModifiÃ© 81 â€” state announcementMarker (null|{tokenId,moveTarget,attackTargetId}), set dans COMBAT_ACTION_DECLARED, reset dans COMBAT_PHASE_CHANGED, passÃ© Ã  Canvas3D + CombatOverlay
â”‚   â”‚   â”‚   â”œâ”€â”€ CampaignSettingsPage.jsx # ModifiÃ© 66 Sprint 7.5 â€” section RÃ¨gles de jeu. ModifiÃ© 68 Sprint Timer â€” +actionTimerSec. ModifiÃ© 69 â€” document.title. ModifiÃ© 70 â€” section Tokens 3D : upload/rÃ©initialiser default_token_glb_url, feedback succÃ¨s/erreur
â”‚   â”‚   â”‚   â”œâ”€â”€ WorkshopPage.jsx        # ModifiÃ© 69 â€” canDelete (isOwner || !created_by), Export/Supprimer sÃ©parÃ©s, document.title 'Enclume â€” Atelier'
â”‚   â”‚   â”‚   â””â”€â”€ TexturePacksPage.jsx    # CONSERVÃ‰ mais remplacÃ© par WorkshopPage
â”‚   â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â”‚   â”œâ”€â”€ authStore.js
â”‚   â”‚   â”‚   â”œâ”€â”€ tokenStore.js
â”‚   â”‚   â”‚   â”œâ”€â”€ characterStore.js       # ModifiÃ© 44 â€” upsertCharacter guard visible+isGm (Bug A)
â”‚   â”‚   â”‚   â”œâ”€â”€ combatStore.js          # ModifiÃ© 62 â€” phase/roster/actions/currentTurn/activeSlotIdx/markTokenAnnounced + setActions + advanceSlot
â”‚   â”‚   â”‚   â”œâ”€â”€ mapStore.js
â”‚   â”‚   â”‚   â”œâ”€â”€ sessionStore.js         # ModifiÃ© 73 â€” messages[]â†’messagesByCampaign{}, activeCampaignId, setActiveCampaign. resetSession mis Ã  jour (Ã©tait dead code)
â”‚   â”‚   â”‚   â”œâ”€â”€ libraryStore.js         # NOUVEAU 75 â€” documents[], addDocument (upsert), updateDocument, removeDocument
â”‚   â”‚   â”‚   â””â”€â”€ entityStore.js          # ModifiÃ© 34 â€” fetchBlueprints() ajoutÃ©
â”‚   â”‚   â”œâ”€â”€ character/
â”‚   â”‚   â”‚   â”œâ”€â”€ WeaponPanel.jsx         # NOUVEAU 55 â€” armes Ã©quipÃ©es MG/MD, stats, munitions chargÃ©es, rechargement, Ã©quipement. ModifiÃ© 66 Sprint 7.5 â€” affichage ammo_remaining/ammo_count (rouge si vide), picker variantes ammo, POST /reload
â”‚   â”‚   â”‚   â”œâ”€â”€ InventoryPanel.jsx      # ModifiÃ© 55 â€” VALID_SLOTS corrigÃ© (migration 51 â†’ codes BG/BD/JG/JD/MG/MD/2M/Tr)
â”‚   â”‚   â”‚   â”œâ”€â”€ ArmorWoundPanel.jsx     # NOUVEAU 54 â€” layout 3 colonnes : localisations armure + silhouette + conteneurs
â”‚   â”‚   â”‚   â”œâ”€â”€ LocationPanel.jsx       # ModifiÃ© 56 â€” import polarisRound shared, calcMillefeuille utilise polarisRound
â”‚   â”‚   â”‚   â”œâ”€â”€ ContainerPanel.jsx      # NOUVEAU 54 â€” Sac/Ceinture/Coffre â€” Ã©quipement conteneur
â”‚   â”‚   â”‚   â”œâ”€â”€ SilhouettePanel.jsx     # NOUVEAU 54 â€” SVG silhouette colorÃ©e par blessures, 50% width
â”‚   â”‚   â”‚   â”œâ”€â”€ AdvantagesPanel.jsx     # ModifiÃ© 50 â€” rework lift-state-up, props charSkills/refSkillsPolaris/onSkillLearnedChange
â”‚   â”‚   â”‚   â”œâ”€â”€ SkillsPanel.jsx         # ModifiÃ© 73 â€” bouton â“˜ par compÃ©tence (si description non nulle), panel position:fixed (description LdB complet, scrollable, click-outside via useEffect+ref)
â”‚   â”‚   â”‚   â”œâ”€â”€ CharacterSheet.jsx      # ModifiÃ© 61 â€” import calcAN/calcAllureMoy/calcAllures shared, dÃ©f locales supprimÃ©es
â”‚   â”‚   â”‚   â”œâ”€â”€ CharacterWindow.jsx     # ModifiÃ© 55 â€” WeaponPanel montÃ© entre ArmorWoundPanel et InventoryPanel
â”‚   â”‚   â”‚   â”œâ”€â”€ DroneWindow.jsx         # NOUVEAU 83 â€” fenÃªtre flottante drone (drag/resize), onglets Fiche/Armes/Notes/ParamÃ¨tres, WeaponsTab/NotesTab/SettingsTab
â”‚   â”‚   â”‚   â””â”€â”€ DroneSheet.jsx          # NOUVEAU 83 â€” fiche drone : StatField, IntegritySection (cases dommages + intÃ©gritÃ© actuelle GM), ProgramsSection (catalogue ref_equipment + DISPLAY_GROUPS optgroups + tooltip + mode custom)
â”‚   â”‚   â”œâ”€â”€ locales/
â”‚   â”‚   â”‚   â””â”€â”€ fr.json                 # ModifiÃ© 66 Sprint i18n â€” +20 sections : charSheet (~50 clÃ©s attrs/stats/bio/tooltips LdB), builder (~55 clÃ©s faces/gÃ©omÃ©tries/formulaires), advantages (24), skillsPanel (6), radialMenu, entityPanel, changelog + ajouts dans auth/dashboard/session/settings/sidebar/workshop/character. ModifiÃ© 73 â€” +dashboard.joinCard, dashboard.codePlaceholder
â”‚   â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”‚   â”œâ”€â”€ api.js                  # ModifiÃ© 69 â€” baseURL: `${VITE_API_URL}/api` (Ã©tait hardcodÃ© localhost:3001)
â”‚   â”‚   â”‚   â”œâ”€â”€ buildCulledMesh.js      # NOUVEAU 76 â€” fonction pure (pas de Three.js) : FACES array (threejs.org/manual), face culling cubes, groupement par (texIdÃ—physIdx P32). ModifiÃ© 77 Phase B â€” ROTATION_FACE_MAP[r][physIdx]â†’origPhysIdx, cubes râ‰ 0 textures multi-faces correctes.
â”‚   â”‚   â”‚   â”œâ”€â”€ voxelTextures.js
â”‚   â”‚   â”‚   â””â”€â”€ diceMath.js             # NOUVEAU 44 â€” PRNG, mappings, normales D4/D6/D8/D12/D20/D10. ModifiÃ© 65 â€” D20_GLB_NORMALS : 20 normales Blender exactes, clÃ©s = numÃ©ros rÃ©els du dÃ© (remapping par test visuel + validation antipodal)
â”‚   â”‚   â”œâ”€â”€ i18n.js
â”‚   â”‚   â”œâ”€â”€ App.jsx                     # ModifiÃ© 33 â€” route /workshop + redirect /texture-packs
â”‚   â”‚   â””â”€â”€ main.jsx
â”‚   â””â”€â”€ vite.config.js
â”œâ”€â”€ server/
â”‚   â”œâ”€â”€ public/
â”‚   â”‚   â””â”€â”€ equipment-admin.html        # NOUVEAU 47 â€” page admin saisie Ã©quipements (servie via express.static)
â”‚   â”œâ”€â”€ diff_equip.mjs                  # NOUVEAU 48 â€” outil diff BDD vs STEP1 champ par champ (post-seed)
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ db/
â”‚   â”‚   â”‚   â”œâ”€â”€ migrations/             # 73 migrations stables. Session 83 : 71_drone_sheet, 72_drone_sheet_fix, 73_drone_programs_catalog (ALTER drone_programs + seed 34 logiciels ref_equipment)
â”‚   â”‚   â”‚   â”œâ”€â”€ seeds/
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ 2_seed_equipment.js # NOUVEAU 48 â€” seed ref_equipment 636 items (KO-par-dÃ©faut, idempotent)
â”‚   â”‚   â”‚   â””â”€â”€ knex.js
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.js                 # ModifiÃ© 66 â€” /register : +inviteCode, timingSafeEqual, guard REGISTRATION_CODE
â”‚   â”‚   â”‚   â”œâ”€â”€ campaigns.js            # ModifiÃ© 45 â€” POST /:id/cover + cover_url dans GET /. ModifiÃ© 66 Sprint 7.5 â€” +pnj_unlimited_ammo. ModifiÃ© 67 Sprint 7.6 â€” +reload_mode (PUT validation + returning). ModifiÃ© 70 â€” import multerGlb, POST /:id/default-token (upload GLB MinIO), PUT accepte default_token_glb_url=null (rÃ©initialisation). ModifiÃ© 81 Sprint Test de Choc â€” +shock_auto_stun (CRUD + returning)
â”‚   â”‚   â”‚   â”œâ”€â”€ battlemaps.js           # ModifiÃ© 73 â€” GET /:id LEFT JOIN characters+users â†’ user_color dans SELECT tokens
â”‚   â”‚   â”‚   â”œâ”€â”€ tokens.js               # ModifiÃ© 39 â€” maintenance Redis collision map
â”‚   â”‚   â”‚   â”œâ”€â”€ characters.js           # ModifiÃ© 59 â€” type dans GET/POST/PUT/broadcastCharacterUpdate
â”‚   â”‚   â”‚   â”œâ”€â”€ textures.js
â”‚   â”‚   â”‚   â”œâ”€â”€ assets.js
â”‚   â”‚   â”‚   â”œâ”€â”€ users.js
â”‚   â”‚   â”‚   â”œâ”€â”€ dice.js
â”‚   â”‚   â”‚   â”œâ”€â”€ voxel-textures.js       # ModifiÃ© 33 â€” usage_hint exposÃ© GET+PUT
â”‚   â”‚   â”‚   â”œâ”€â”€ texture-packs.js        # ModifiÃ© 69 â€” DELETE guard null-safe : created_by NULL â†’ suppressible par tout user auth
â”‚   â”‚   â”‚   â”œâ”€â”€ entity-blueprints.js    # ModifiÃ© 33 â€” POST /:id/upload-glb
â”‚   â”‚   â”‚   â”œâ”€â”€ entities.js             # ModifiÃ© 39 â€” maintenance Redis collision map
â”‚   â”‚   â”‚   â”œâ”€â”€ equipment.js            # NOUVEAU 47 â€” CRUD ref_equipment + junction tables. ModifiÃ© 65 Sprint GM-A : +location dans GET /equipment SELECT
â”‚   â”‚   â”‚   â”œâ”€â”€ documents.js            # NOUVEAU 75 â€” GET/POST/PUT/DELETE /campaigns/:id/documents (mergeParams, broadcast filtrÃ© canView, gm_notes_html retirÃ© non-GM). ModifiÃ© 80 â€” +POST /upload-image (multerUpload, minio.putObject, GM only, campaigns/<id>/documents/<uuid>.<ext>, retourne {url:objectName})
â”‚   â”‚   â”‚   â””â”€â”€ character/
â”‚   â”‚   â”‚       â””â”€â”€ char-sheet.js       # ModifiÃ© 66 Sprint A+C2 â€” +6 routes /macros. ModifiÃ© 66 Sprint 7.5 â€” +ammo_remaining + POST /reload. ModifiÃ© 71 â€” +helper getWorstWoundSeverity(charSheetId) + worst_wound_severity dans payloads WOUND_ADDED/UPDATED/REMOVED. ModifiÃ© 81 â€” +helper resolveAmmoInit(equipmentId, slot) + auto-init ammo_remaining dans PUT /inventory/:itemId + POST /inventory + POST /quick-equip. ModifiÃ© 83 â€” routes drone : GET LEFT JOIN ref_equipment (program_name/description), PUT fix 5 champs + profondeur_max/disponibilite, POST programs catÃ©gorie rÃ©solue serveur + validation ordinateur, PUT programs/:id level+sort_order uniquement
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.js
â”‚   â”‚   â”‚   â”œâ”€â”€ role.js
â”‚   â”‚   â”‚   â”œâ”€â”€ upload.js
â”‚   â”‚   â”‚   â””â”€â”€ errorHandler.js
â”‚   â”‚   â”œâ”€â”€ socket/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.js
â”‚   â”‚   â”‚   â””â”€â”€ index.js                # ModifiÃ© 65 Sprint 7.6. ModifiÃ© 66 â€” +MACRO_ROLL, COMBAT_ACTION_DECLARE v2, COMBAT_DAMAGE_CONFIRM, resolveAssaultAction. ModifiÃ© 67 Sprint CaC 1 â€” +import getModDom, +pendingMeleeDefense Map, +resolveMeleeAction (skillTotal attaquant/dÃ©fenseur, roll D20, opposition PNJ auto / PJ bloque slot), +COMBAT_MELEE_DEFENSE_CONFIRM handler, COMBAT_ACTION_CONFIRM branche melee + needsDefenseWait, COMBAT_DAMAGE_CONFIRM branche type=melee (modDom vs MR table), COMBAT_DECLARE_ERROR si hors portÃ©e
â”‚   â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”‚   â”œâ”€â”€ AppError.js
â”‚   â”‚   â”‚   â”œâ”€â”€ minio.js
â”‚   â”‚   â”‚   â”œâ”€â”€ diceParser.js
â”‚   â”‚   â”‚   â”œâ”€â”€ charStats.js            # ModifiÃ© 60 â€” calcVitessesâ†’calcAllures (4 allures LdB p.221, lookup COO+AthlÃ©tisme)
â”‚   â”‚   â”‚   â””â”€â”€ redis.js                # NOUVEAU 39 â€” client ioredis + helpers collision map (PE14 voxels)
â”‚   â”‚   â””â”€â”€ index.js                    # ModifiÃ© 64-66 â€” resolveAssaultAction, Test de Choc, MACRO_ROLL. ModifiÃ© 67 Sprint 7.6 â€” resolveReloadAction. ModifiÃ© 67 Sprint CaC 1 â€” resolveMeleeAction, pendingMeleeDefense, COMBAT_MELEE_DEFENSE_CONFIRM. ModifiÃ© 68 Sprint CaC 2 â€” VALID_STATES +combat_mode, DECLARE melee sans validation distance (Phase 1 libre), chargeMove iniDelta=0, UPDATE +state_combat_mode, resolveMeleeAction +allonge +distance Phase2 +attackModeBonus +combatModeBonus, COMBAT_MELEE_DEFENSE_CONFIRM +mode dÃ©fenseur PJ, COMBAT_DAMAGE_CONFIRM +combatModeBonus, endTurn reset state_combat_mode='normal'. ModifiÃ© 70 â€” db.migrate.latest() dans startServer() (migrations auto au dÃ©marrage). ModifiÃ© 72 CaC 4a â€” multiAdversaryMalus()+countAdversaires() module-level, rosterTokens dans Promise.all resolveMeleeAction, multiMalusAttaquantâ†’chancesAttaque, multiMalusDefenseurâ†’chanceDefense (PNJ+commonPending), enrichissement COMBAT_MELEE_RESULT + COMBAT_MELEE_DEFENSE_PROMPT. ModifiÃ© 76 â€” handler TOKEN_SET_ROTATION (orientation absolue r 0..7, guard owner/GM, broadcast TOKEN_UPDATED). ModifiÃ© 81 Sprint Test de Choc â€” 4 blocs shock conditionnÃ©s shock_auto_stun + stun_applied dans payload, helper applyStunStatus (token_statuses + TOKEN_STATUS_UPDATED), handler COMBAT_APPLY_STUN (GM manuel + outcome), COMBAT_END cleanup stunned/unconscious token_statuses
â”œâ”€â”€ shared/
â”‚   â”œâ”€â”€ polarisUtils.js                 # ModifiÃ© 61 â€” +calcAN, calcAllureMoy, calcAllures (exports partagÃ©s PI11). ModifiÃ© 65 Sprint GM-B : +DEFAULT_PNJ_ALLURES { lente:4, moyenne:8, rapide:16, max:24 }
â”‚   â”œâ”€â”€ events.js                       # ModifiÃ© 64 â€” +COMBAT_DAMAGE_*/ATTACK_PLAYER_RESULT. ModifiÃ© 67 Sprint 7.6 â€” +COMBAT_RELOAD_RESULT. ModifiÃ© 67 Sprint CaC 1 â€” +COMBAT_MELEE_DEFENSE_PROMPT/CONFIRM/RESULT, +COMBAT_DECLARE_ERROR. ModifiÃ© 76 â€” +TOKEN_SET_ROTATION. ModifiÃ© 81 â€” +COMBAT_APPLY_STUN, +COMBAT_ANNOUNCE_PREVIEW
â”‚   â”œâ”€â”€ woundConstants.js               # NOUVEAU 49 â€” WOUND_LOCATIONS/SEVERITIES/MAX_COUNTS/PENALTIES/SEVERITY_COLORS
â”‚   â””â”€â”€ armorConstants.js               # NOUVEAU 54 â€” ARMOR_CATEGORY_MALUS/LOCATION_TO_SLOT/SLOT_TO_REF_LOCATION/LOCATION_TO_SVG/LOCATION_LABELS
â””â”€â”€ docs/
```

---

## Infrastructure

| Composant | Tech | Notes |
|---|---|---|
| Frontend | React 19 + Vite | Port 5173 dev (8193 Kiwi) |
| Backend | Node.js + Express + Socket.io | Port 3001 dev (8194 Kiwi) |
| Serveur Alpha "Kiwi" | Debian 13, systemd, box Bouygues | `http://89.92.219.211:8193` â€” voir `docs/SERVEURDISTANTKIWI.md` |
| Base de donnÃ©es | PostgreSQL | Knex migrations |
| Cache/collisions | Redis + ioredis | Collision map par battlemap â€” branchÃ© session 39 |
| Stockage fichiers | MinIO | Bucket unique |
| Auth | JWT httpOnly cookie | 7 jours |
| Inscription | Code d'invitation `REGISTRATION_CODE` dans `.env` | 8 chiffres, `timingSafeEqual`, guard 500 si absent |
| Rechargement combat | `campaigns.reload_mode` | `'magazine'` (dÃ©faut) ou `'topup'` â€” configurable dans CampaignSettingsPage |

---

## Serveur

### Routes montÃ©es (index.js)
```
/api/health
/api/auth
/api/campaigns
/api/campaigns/:campaignId/characters    â† mergeParams
/api/characters                          â† actionsRouter (PUT/DELETE/upload)
/api/campaigns/:id/battlemaps
/api/battlemaps
/api/battlemaps/:id/tokens
/api/battlemaps/:id/entities
/api/tokens
/api/textures                            â† proxy MinIO textures pack
/api/assets                              â† proxy MinIO gÃ©nÃ©ral
/api/users
/api/dice
/api/voxel-textures
/api/texture-packs
/api/entity-blueprints
/api/entities
/api/char-sheet
/api/char-ref
/api/equipment                           â† CRUD ref_equipment + junction tables (session 47)
/api/campaigns/:campaignId/documents     â† mergeParams â€” GET/POST/PUT/DELETE + POST /upload-image (session 75-80)
```

### Routes REST â€” Entities (/api/battlemaps/:id/entities + /api/entities)
| MÃ©thode | Route | Description |
|---|---|---|
| GET | /battlemaps/:id/entities | Instances carte â€” JOIN blueprint avec pack_id (P47) |
| POST | /battlemaps/:id/entities | Poser une instance â€” GM uniquement + collisionAddEntity |
| PUT | /entities/:entityId | Modifier position/rotation/state/overrides â€” GM uniquement + maintenance Redis |
| DELETE | /entities/:entityId | Supprimer instance â€” GM uniquement + collisionRemoveEntity AVANT delete |

---

## Base de donnÃ©es â€” Migrations

| Migration | Contenu |
|---|---|
| 01â†’39 | voir JOURNAL archive |
| 41_entity_blueprints | entity_blueprints (id UUID, geometry/states/interactions JSONB, glb_url, deprecated, created_by) |
| 42_entities | entities (id UUID, battlemap_id CASCADE, blueprint_id, pos_x/y/z, r, current_state_id, gm_only, label_override, interaction_overrides JSONB, state JSONB, notes_gm) |
| 43_entity_pack_hint | entity_blueprints.pack_id UUID nullable FK â†’ texture_packs.id + voxel_textures.usage_hint TEXT nullable |
| 44_tokens_rotation | tokens.r INTEGER NOT NULL DEFAULT 0 â€” 8 orientations 45Â° (PE21) |
| 45_polaris_mr_table | polaris_mr (mr_min PK, mr_max nullable, dmax) + seed 6 lignes |
| 46_polaris_mr_refonte | polaris_mr â€” colonne dmax â†’ modifier (LdB p.209) â€” 20 lignes officielles |
| 47_campaigns_cover_url | campaigns.cover_url TEXT nullable â€” illustration campagne |
| 48_ref_equipment | ref_equipment (35 colonnes, 6 CHECK) + ref_equipment_skills + ref_equipment_skill_assoc + ref_equipment_ammo_compat |
| 49_character_wounds | character_wounds (UUID PK, char_sheet_id FK CASCADE, location/severity CHECK, is_stabilized, idx) |
| 50_char_inventory | char_inventory (UUID PK, FK characters CASCADE, FK ref_equipment SET NULL, container/slot/quantity/custom_props JSONB) + char_sheet.sols INTEGER |
| 51_inventory_slot_codes | Nullifie slots stales B/J via regex `(^|/)(B|J)(/|$)` â€” passage codes T/C â†’ BG/BD/JG/JD |
| 52_add_current_ammo_to_inventory | char_inventory.current_ammo UUID nullable FK ref_equipment.id SET NULL â€” munition chargÃ©e dans une arme |
| 53_rename_ammo_unified | Phase 1 : 11 fusions doublons munitions (UPDATE FK + DELETE). Phase 2 : 89 renommages â€” "Balle"â†’"Munition", suppression qualificatif arme. Carreaux/FlÃ¨ches/Darts : "Projectile" conservÃ©. |
| 54_combat | combat_state + combat_roster + combat_actions â€” 3 tables, FK CASCADE, CHECK contraints |
| 55_character_type | characters.type TEXT NOT NULL DEFAULT 'pnj' CHECK ('pj','pnj') + backfill user_id IS NOT NULL â†’ 'pj' |
| 56_combat_v2 | combat_actions : +action_key TEXT NOT NULL, +sequence SMALLINT, +target_pos_x/y/z INT, âˆ’is_micro, âˆ’initiative_score, âˆ’target_pos, +idx_actions_token/key. combat_roster : +state_position TEXT CHECK ('standing'/'crouching'/'prone'), +state_weapon TEXT CHECK ('holstered'/'ready'/'drawn'). battlemaps : +voxel_scale FLOAT DEFAULT 1.0 |
| 57_combat_v3 | combat_actions : +fire_mode TEXT, +bullet_count SMALLINT, +fire_mode_bonus_comp SMALLINT, +fire_mode_bonus_dmg SMALLINT. combat_roster : +state_character JSONB NOT NULL DEFAULT '{}' (PC39 â€” merge obligatoire, jamais remplacement) |
| 58_combat_v4 | combat_roster : +state_cover TEXT CHECK ('exposed'/'partial'/'important'), +state_fire_mode TEXT CHECK ('cc'/'rc'/'rl'), +state_vitesse TEXT CHECK ('normal'/'delayed'/'rushed'). Backfill state_vitesse='rushed' si state_character->>'is_rushed'='true' |
| 59_character_macros | character_macros (UUID PK, char_sheet_id FK CASCADE, label, formula, skill_id, attr_id, gm_modifier, sort_order) |
| 60_ammo_remaining | char_inventory.ammo_remaining SMALLINT nullable + campaigns.pnj_unlimited_ammo BOOLEAN NOT NULL DEFAULT false |
| 61_combat_reload | combat_actions.type CHECK : ajout 'reload' |
| 62_campaign_reload_mode | campaigns.reload_mode TEXT NOT NULL DEFAULT 'magazine' CHECK ('magazine','topup') |
| 63_melee | combat_actions : ajout 'melee' au CHECK constraint `chk_action_type` |
| 64_combat_mode | combat_roster : +`state_combat_mode TEXT NOT NULL DEFAULT 'normal'` CHECK ('normal','offensif','charge','defensif','retraite') |
| 65_action_timer | campaigns : +`action_timer_sec INTEGER NOT NULL DEFAULT 0` â€” 0 = infini, timer auto-skip Phase Annonce |
| 66_campaign_default_token | campaigns : +`default_token_glb_url TEXT` nullable â€” URL GLB token par dÃ©faut de campagne |
| 67_campaign_documents | documents table (session 75) |
| 68_token_statuses | token_statuses (status_code per token, session 77) |
| 69_shock_auto_stun | campaigns : +`shock_auto_stun BOOLEAN NOT NULL DEFAULT true` |
| 70_ammo_init_on_equip | backfill ammo_remaining armes Ã©quipÃ©es sans chargeur initialisÃ© (session 81) |
| 71_drone_sheet | drone_sheet (character_id FK CASCADE, stats physiques + ordinateur_gen/nt, integrite_max/actuelle, localisation_ref, damages JSONB, notes_gm, equip_special) |
| 72_drone_sheet_fix | correctifs colonnes drone_sheet (ajout profondeur_max, disponibilite) |
| 73_drone_programs_catalog | drone_programs : DROP label, ADD equipment_id FK ref_equipment + label_override + category NOT NULL + CONSTRAINT chk_dp_source. Seed 34 programmes ref_equipment family='Logiciels' |

---

## charStats.js â€” Fonctions pures (server/src/lib/charStats.js)

| Fonction | Description |
|---|---|
| `calcNA` | Niveau Attribut net (base + pc + modGen, plancher 3) |
| `calcAN` | Aptitude Naturelle depuis table LdB |
| `calcAttributeAN/NA` | AN/NA pour un attr_id donnÃ© |
| `calcSkillTotal` | Total compÃ©tence (AN1+AN2+maÃ®trise) |
| `getModDom` | Modificateur de Dommages (FOR_na) |
| `calcREA` | RÃ©activitÃ© = polarisRound((ADA+PER)/2) |
| `calcSeuils` | Ã‰tourdissement + Inconscience |
| `calcAllures` | 4 allures LdB p.221 : lente/moyenne/rapide (COO_na) + max (AthlÃ©tisme total) |
| `calcResistanceDommages` | RD depuis table FOR+CON |
| `calcResistanceNaturelle` | RÃ©sNat depuis table |
| `calcResistanceDroguesInput` | (CON+VOL)/2 |
| `calcSouffle` | (CON+VOL)/2 |
| `calcWoundPenalty` | Malus blessures â€” pire gravitÃ© seule |
| `calcEncumbrancePenalty` | Malus encombrement kg > FORÃ—3 |
| `calcResistanceArmure` | Mille-feuille ETQ/PRT par slot (session 56) |
| `calcCarenceArmure` | Carence FOR = pire min_str âˆ’ forNA (session 56) |

---

## Collision map Redis â€” session 39

### Architecture
```
Redis Hash : "collision:{battlemap_id}"
  champ : "x:y:z"   (sÃ©parateur ":" â€” P17, coordonnÃ©es PE14 base)
  valeur : JSON { type: 'token'|'entity'|'voxel', id: string }
TTL : 24h â€” reconstruite Ã  chaque SESSION_JOIN (PE23)
```

### Filtres
- Tokens `layer = 'gm'` : exclus (invisibles aux joueurs)
- EntitÃ©s : incluses uniquement si `is_blocking = true` dans l'Ã©tat courant
- Voxels : tous inclus â€” convertis Three.jsâ†’PE14 dans buildCollisionMap/add/remove (PE28)

### Reconstruction
`buildCollisionMap(battlemapId)` â€” pipeline Redis, appelÃ©e au SESSION_JOIN depuis `player_locations`.
Non bloquante si joueur sans `player_location` (premiÃ¨re connexion).

### Maintenance temps rÃ©el
| Ã‰vÃ©nement | Handler | Action Redis |
|---|---|---|
| Token crÃ©Ã© | `POST /tokens` (REST) | `collisionAddToken` |
| Token dÃ©placÃ© | `PUT /tokens/:id` (REST) + `TOKEN_MOVE` (WS) | `collisionMoveToken` |
| Token supprimÃ© | `DELETE /tokens/:id` (REST) | `collisionRemoveToken` AVANT delete |
| Token rotate | `TOKEN_ROTATE` (WS) | aucune â€” position inchangÃ©e |
| EntitÃ© crÃ©Ã©e | `POST /entities` (REST) | `collisionAddEntity` |
| EntitÃ© dÃ©placÃ©e/Ã©tat changÃ© | `PUT /entities/:id` (REST) | `collisionMoveEntity` ou `collisionUpdateEntityState` |
| EntitÃ© supprimÃ©e | `DELETE /entities/:id` (REST) | `collisionRemoveEntity` AVANT delete |
| EntitÃ© Ã©tat changÃ© (interaction) | `resolveEntityState` (WS) | `collisionUpdateEntityState` |
| Voxel ajoutÃ© | `VOXEL_ADD` (WS) | `collisionAddVoxel` |
| Voxel supprimÃ© | `VOXEL_REMOVE` (WS) | `collisionRemoveVoxel` |
| Voxel tournÃ© | `VOXEL_UPDATE` (WS) | aucune â€” position inchangÃ©e |

---

## DÃ©placement entitÃ©s â€” sessions 40-43 (9F-B1/B2/C)

### Events WS
- `ENTITY_MOVE_REQUEST` â€” joueur/GM â†’ serveur : demande de dÃ©placement
- `ENTITY_MOVE_RESULT` â€” serveur â†’ joueur : rÃ©sultat jet + positions finales

### Handler `ENTITY_MOVE_REQUEST` (socket/index.js)
- Guards : campaignId, double-soumission via pendingEntityActions
- Guard GM retirÃ© en session 41 â€” GM passe par le mÃªme flux jet d'attribut
- Ownership : token.character_id â†’ characters.user_id === socket.user.id
- Distance Tchebychev 3D acteur â†” entitÃ© (inclut altitude pos_z)
- actualMoveType calculÃ© par dot(AE, AD) â€” PE27
- Jet attribut via calcAttributeNA(attrs, attributeId, genotypeRow)
- MR = attributeNA + 1d20 - effectiveDifficulty â†’ getModifier(mrTable, mr)
- dmax = isSuccess ? modifier + 1 : 0 â€” toute rÃ©ussite = au moins 1 case
- stepsMax = Math.min(dmax, stepsTarget) â€” destination joueur respectÃ©e (PE30)
- dmax_override si dÃ©fini dans l'interaction (plafonne push ET pull)
- Step-by-step : isCaseOccupied entity Ã  pos_z, acteur Ã  pos_z+1 (PE29), excludeIds=[tokenId,entityId] (PE22)
- Update DB + collisionMoveEntity + collisionMoveToken Redis
- Broadcast ENTITY_MOVED + TOKEN_MOVED â†’ room
- ENTITY_MOVE_RESULT â†’ socket.id uniquement

### Cache MR_TABLE
`let MR_TABLE = null` + `getMrTable()` + `getModifier(mrTable, mr)` â€” hors `initSocket`.
ChargÃ©e une seule fois depuis DB au premier jet.

### Mode visÃ©e client â€” session 41/43

#### Canvas3D.jsx
- Ghost : `PlaneGeometry(1,1)` wireframe au sommet de la colonne (`getColumnTopY + 1 + 0.05`)
- Snap 8 axes depuis l'entitÃ© (ratio 2:1) â€” session 43
- Couleurs : bleu=push (#2563eb), orange=pull (#f97316), rouge=impossible (#ef4444)
- Lerp 300ms TokenMesh â€” groupRef + lerpPos + targetRef + useFrame

#### EntityMesh.jsx
- Lerp 300ms dans `EntityMeshVoxel` et `EntityMeshGlb` â€” useFrame dans sous-composants
- tau=0.1 â†’ 95% en ~300ms

---

## Dice Rework â€” session 44

### Architecture
- DiceRoller montÃ© dans Canvas3D â€” un seul contexte WebGL (pas d'overlay HTML sÃ©parÃ©)
- DICE_RESULT consommÃ© deux fois en parallÃ¨le : chat + animation
- Animation dÃ©clenchÃ©e uniquement si `!skillLabel` (jets normaux, pas jets entitÃ©)
- `seed` du payload initialise le PRNG dÃ©terministe de l'animation

### DÃ©s supportÃ©s
| DÃ© | GÃ©omÃ©trie | Chiffre | Statut |
|---|---|---|---|
| D6 | BoxGeometry | Texture CanvasTexture par face | âœ… stable |
| D4 | TetrahedronGeometry | Texture CanvasTexture par face | âœ… stable |
| D8 | OctahedronGeometry | Texture CanvasTexture par face | âœ… stable |
| D20 | GLB (D20_LP Blender) | Texture GLB albedo 4096Ã—4096 | âœ… normales exactes session 65 |
| D12 | DodecahedronGeometry | Atlas 12 cases (fillText centroÃ¯de 0.397) | âœ… stable |
| D10/D100 | Trapezohedron custom | Html overlay V1 `position=[0,0,0]` | âœ… V1 stable |

### PiÃ¨ges actifs Dice Rework
- `DiceMesh.useMemo` deps `[geoDef.type, color, dieType]` â€” dieType obligatoire (PE32)
- D10 Html overlay `position=[0,0,0]` â€” ne pas dÃ©placer (PE33)
- D12 atlas `fillText` Ã  `atlasSize * 0.397` â€” centroÃ¯de calculÃ©, ne pas modifier

### V2 / todo
- Audio â€” `useDiceAudio.js` â€” sons d'impact au rebond

---

## Rotation tokens â€” session 39

- `tokens.r` : INTEGER 0-7 â€” `rotation.y = r * Math.PI / 4` (PE21)
- `TOKEN_ROTATE` WS : clic court sur token propriÃ©taire â†’ serveur incrÃ©mente `r = (r+1) % 8` â†’ broadcast `TOKEN_UPDATED`
- Canvas3D : rotation appliquÃ©e sur `<group>` parent â€” tilt drag conservÃ© sur `<primitive>` enfant

---

## Composants entitÃ©s â€” session 34

### EntityMesh.jsx
- Branche voxel (`EntityMeshVoxel`) + branche GLB (`EntityMeshGlb`)
- Timer 400ms sur `onPointerLeave` via `leaveTimerRef`
- Hitbox invisible Ã—1.4 en X et Z
- `HoverIcon` : `<Html>` pointerEvents none, div interne auto
- PE14, PE11, PE4, P32 respectÃ©s

### RadialMenu.jsx
- Menu SVG fixed centrÃ© sur le clic
- Tranche GM "Modifier" en violet
- Tranche displacement â†’ onMove (pas onAction)
- Grisage si acteur hors portÃ©e (distance Tchebychev 2D)
- Fermeture : clic extÃ©rieur, Ã‰chap, centre âœ•, aprÃ¨s action

### EntityInstancePanel.jsx
- Panneau flottant GM â€” modifie l'instance uniquement
- Champs : `label_override`, `gm_only`, `disabled_interactions`, `notes_gm`
- Header draggable, sauvegarde via PUT /entities/:id

---

## Flux interactions entitÃ©s

### Flux joueur skillcheck âœ…
```
Joueur clique âš™ â†’ handleEntityClick â†’ filter interactions par current_state_id
  â†’ si 1 seule interaction skillcheck : action directe sans radial
  â†’ si 2+ interactions : RadialMenu
Joueur choisit â†’ handleEntityAction â†’ socket.emit(WS.ENTITY_ACTION_REQUEST)
Serveur â†’ ENTITY_ACTION_PENDING â†’ GM reÃ§oit notification dans chat
GM arbitre â†’ socket.emit(WS.ENTITY_ACTION_RESOLVE)
Serveur â†’ resolveEntityState â†’ update current_state_id â†’ collisionUpdateEntityState â†’ ENTITY_UPDATED broadcast
```

### Flux joueur dÃ©placement âœ…
```
Joueur clique âš™ â†’ handleEntityClick
  â†’ si 1 seule interaction displacement : handleEntityMove direct
  â†’ si 2+ interactions : RadialMenu â†’ tranche DÃ©placer â†’ handleEntityMove
handleEntityMove â†’ trouve token acteur â†’ setMoveTarget â†’ mode visÃ©e Canvas3D
Canvas3D : ghost wireframe snapÃ© 8 axes, couleur bleu/orange/rouge selon dot(AE,AD)
Joueur clique destination (dotâ‰ 0) â†’ ENTITY_MOVE_REQUEST Ã©mis
Serveur â†’ jet attribut â†’ ENTITY_MOVED + TOKEN_MOVED broadcast â†’ ENTITY_MOVE_RESULT â†’ joueur
SessionPage listener â†’ setMoveTarget(null) + badge MR dans chat
Canvas3D/EntityMesh â†’ Lerp 300ms vers position finale
```

### Flux GM âœ…
Action directe via ENTITY_ACTION_GM_DIRECT â€” sans arbitrage ni traÃ§age.
GM peut aussi utiliser le flux dÃ©placement â€” mÃªme flux jet attribut que joueur.

### Flux sans compÃ©tence âœ…
skill_id et attribute_id null â†’ resolveEntityState direct, sans notifier le GM, sans jet.

### RÃ¨gles mÃ©caniques Polaris (LdB p.404 + p.236)
```
effectiveMalus    = calcWoundPenalty(wounds) âˆ’ calcEncumbrancePenalty(weight, FOR)
chancesDeReussite = skillTotal + difficulty_dc + gmModifier + effectiveMalus
isSuccess         = diceRoll <= chancesDeReussite
difficulty_dc     = modificateur signÃ© (-20 Ã  +10)
```
Malus santÃ© (blessures) : non-cumulatif â€” pire blessure seule retenue (LdB p.236).
Malus encombrement : rÃ¨gle maison, s'additionne au malus santÃ©.

---

## PiÃ¨ges actifs â€” tous domaines

| Code | Description |
|---|---|
| P13 | updated_at aprÃ¨s guard Object.keys |
| P14 | updated_at jamais dans JWT |
| P19 | glb_url avec ?v=timestamp |
| P20 | mat.clone() avant mutation Three.js |
| P22 | voxel_textures.id = integer |
| P26 | blocksReady = true mÃªme si 0 textures |
| P32 | Ordre faces BoxGeometry : east(0)â€¦north(5) |
| P43 | MinIO textures par pack_uuid |
| P44 | name pack immuable |
| P46 | Route spÃ©cifique avant paramÃ©trique |
| P47 | pack_id doit Ãªtre dans le SELECT JOIN entities GET + ENTITY_CREATED socket |
| P48 | handleEntityMove dÃ©clarÃ© avant handleEntityClick (session 41) |
| PE2 | socket.data.role pour fetchSockets() |
| PE4 | face null = invisible |
| PE7 | current_state_id = index entier dans states[] â€” jamais UUID |
| PE11 | fallback states[0] |
| PE12 | clearTimeout pendingEntityActions |
| PE14 | pos_y/pos_z inversÃ©s Three.js â†” base |
| PE16 | e.code pour Alt |
| PE17 | usage_hint hint de tri, jamais exclusif |
| PE18 | blueprint.pack_id nullable â€” guard |
| PE19 | transparent={true} obligatoire sur meshLambertMaterial â€” opacity=0 ineffectif sans Ã§a |
| PE20 | HoverIcon : toujours montÃ© si hasInteractions, jamais conditionnel Ã  hovered â€” visibilitÃ© CSS uniquement |
| PE21 | r tokens = 0-7 â€” rotation.y = r * Math.PI / 4 |
| PE22 | tunnel de swap excludeIds dans isCaseOccupied |
| PE23 | buildCollisionMap au SESSION_JOIN â€” pas au dÃ©marrage serveur |
| PE24 | collisionMoveToken : hdel systÃ©matique ancienne case, hset conditionnel layer |
| PE25 | maintenance Redis dans REST, pas dans handlers WS reliques |
| PE26 | resolveEntityState : returning doit inclure battlemap_id |
| PE27 | moveType calculÃ© client (feedback) ET recalculÃ© serveur (validation). Si discordance â†’ refus silencieux |
| PE28 | Voxels Redis : convertis Three.jsâ†’PE14 dans buildCollisionMap/add/remove |
| PE29 | Acteur step-by-step vÃ©rifiÃ© Ã  pos_z+1 â€” espace de marche |
| PE30 | stepsMax = Math.min(dmax, stepsTarget) |
| PE31 | upsertCharacter : guard visible+isGm |
| PE32 | DiceMesh useMemo deps [geoDef.type, color, dieType] |
| PE33 | D10 Html overlay position=[0,0,0] â€” ne pas dÃ©placer |
| P49 | Promotion blessures : si promoted===true â†’ GET /wounds complet â€” ne jamais ajouter localement |
| P50 | toggle Polaris : ne jamais dupliquer charSkills dans un sous-composant â€” lift state up obligatoire |
| P51 | Malus non-cumulatifs santÃ© : pire seul (LdB p.236). Encombrement (maison) : cumulatif. effectiveMalus = woundPenalty âˆ’ encumbrancePenalty |
| PI11 | polarisRound source unique shared/polarisUtils.js â€” jamais redÃ©fini localement |
| PC27 | `!token.character_id` = EntitÃ© de dÃ©cor, jamais PNJ. PNJ = `character.type === 'pnj'`. EntitÃ© exclue du combat. |
| PEF1-PEF6 | voir SYSTEME.md section 6 |



