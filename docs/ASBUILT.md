# ASBUILT — Ce qui est codé et stable
> Dernière mise à jour : 2026-05-27 Session 65
> Ce document est un snapshot de référence rapide.
> Pour les flux détaillés, ownership, pièges : voir SYSTEME.md.
> Pour l'historique des décisions : voir JOURNAL2.md.

---

## Structure du projet
```
Enclume/
├── client/
│   ├── public/
│   │   ├── fonts/
│   │   │   └── inter.woff              # Police locale pour labels 3D (drei Text)
│   │   └── favicon.svg                 # ⚠ présent mais non référencé — à brancher
│   ├── src/
│   │   ├── components/
│   │   │   ├── CombatOverlay.jsx        # Modifié 64 — Sprint 7.1 : +combatTargetMode. Sprint 7.4bis : refactoring PJ vs GM, deux CombatModifiersWindow séparés, CombatActionWindow masqué pendant assaut PJ. Modifié 65 Sprint GM-A : +characters prop passée à CombatRosterWindow. Modifié 65 Sprint GM-B : +onEnterMoveMode passé à CombatGmDeclareWindow
│   │   │   ├── CombatRosterWindow.jsx  # Réécriture complète 65 Sprint GM-A — détection arme/armure, chips T/C/B/J (PjArmorChips/PnjArmorChips), quick-equip PNJ, bannière alerte, fetches parallèles combat-ini+combat-equipment+refWeapons+refArmors
│   │   │   ├── CombatTimeline.jsx      # Modifié 62 — timeline INI, portraits cliquables GM, topOffset + curseur slot actif RÉSOLUTION (slotActive, activeSlotIdx)
│   │   │   ├── CombatActionWindow.jsx  # Modifié 65 Sprint 7.6 — réécriture v2 : StateSelector segmented control, blocs TACTIQUE/ARMEMENT/ACTION/RAPIDES, QB weapon auto-drawn, footer INI delta coloré, payload v2 {state,mapActions,quick}. Modifié 65 Sprint GM — title={a.tooltip} sur MAP_ACTIONS (3 branches) + QUICK_ACTIONS
│   │   │   ├── CombatDamageWindow.jsx  # NOUVEAU 64 Sprint 7.4 — fenêtre PJ lancer dés dégâts : Phase 1 dés vides / Phase 2 animation / Phase 3 résultats colorés
│   │   │   ├── CombatModifiersWindow.jsx # NOUVEAU 64 Sprint 7.2. Modifié 65 Sprint 7.6 — is_rushed → state_vitesse === 'rushed'
│   │   │   ├── CombatPnjPanel.jsx      # NOUVEAU 58 — modal GM PJs/PNJs read-only, isPnj via character.type
│   │   │   ├── CombatGmDeclareWindow.jsx # Réécriture complète 65 Sprint GM — InlineChip click-to-cycle, batch mode, STATE_DEFAULTS, aggregate/__mixed__, sections TACTIQUE/ARMEMENT/ACTION/RAPIDES, roster intégré, footer INI delta, emit v2 N×WS. title tooltips LdB. Modifié 65 Sprint GM-B : onEnterMoveMode, pendingGmMoves, moveTick, moveQueue refs, tokensRef, useEffect([moveTick]) AVANT early return, handleStartMoveQueue, 'move' retiré GM_DISABLED, bouton Passer, DEFAULT_PNJ_ALLURES
│   │   │   ├── combatSections.js       # Modifié 65 Sprint 7.6 — réécriture complète : STATE_DEFS (5 états + matrices coût), stateTransitionCost, calcIniDelta, MAP_ACTIONS multi-select, QUICK_ACTIONS incrémentaux, MOVE_ZONE_DEFS. Modifié 65 Sprint GM — tooltip LdB sur MAP_ACTIONS+QUICK_ACTIONS, label reperer corrigé
│   │   │   ├── Canvas3D.jsx            # Modifié 64 — +combatTargetMode prop, combatTargetModeRef (P40), intercept drag→target, ligne R3F attaquant→cible (useMemo targetLinePoints)
│   │   │   ├── Editor3D.jsx            # Modifié 9C — EntityEditorScene, activeEditorTab
│   │   │   ├── EntityMesh.jsx          # Modifié 43 — Lerp 300ms EntityMeshVoxel + EntityMeshGlb
│   │   │   ├── EntityBuilderTab.jsx    # Modifié 40 — refonte formulaire interactions SkillCheck/Déplacement
│   │   │   ├── VoxelBuilderTab.jsx     # Stable 33
│   │   │   ├── RadialMenu.jsx          # Modifié 41 — tranche displacement, grisage portée, onMove
│   │   │   ├── EntityInstancePanel.jsx # Modifié 36 — sélecteur état actuel
│   │   │   ├── Voxel.jsx               # Stable 9A-5
│   │   │   ├── Sidebar.jsx             # Modifié 64 Sprint 7.4 — +rendu interactionType='combat_damage' (dégâts colorés par sévérité). Modifié 36 — entity_action structuré. Modifié 65 Sprint DicePanel v3 — +🔒 dans diceHeader si msg.secret
│   │   │   ├── GeometryIcon.jsx        # Stable 9A-3
│   │   │   ├── DicePanel.jsx           # Réécriture complète 65 Sprint DicePanel v3 — roue radiale SVG (PCBBackground, DieShape, DieButton), formule mono-type {k,n,mod}, favoris localStorage, historique local socket, JET AU MJ fonctionnel, useAuthStore direct, drag conservé
│   │   │   ├── DiceMesh.jsx            # NOUVEAU 44 — géométries, matériaux, animation, Html overlay D10. Modifié 65 — branche D20 dédiée supprimée → D20 passe par faceNormal→D20_GLB_NORMALS (normales Blender exactes)
│   │   │   └── DiceRoller.jsx          # NOUVEAU 44 — orchestrateur R3F dans Canvas3D
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx       # Modifié 45 — upload cover campagne (pendingCoverIdRef pattern)
│   │   │   ├── SessionPage.jsx         # Modifié 64 — Sprint 7.1 : combatTargetMode. Sprint 7.4 : damageResults + COMBAT_DAMAGE_RESULT. Sprint 7.4bis : +attackResult state + COMBAT_ATTACK_PLAYER_RESULT handler + onAttackConfirmed prop, onDamageConfirmed nettoie aussi attackResult. Modifié 65 Sprint DicePanel v3 — DICE_RESULT +secret dans destructuring + addMessage
│   │   │   ├── CampaignSettingsPage.jsx
│   │   │   ├── WorkshopPage.jsx        # Stable 33
│   │   │   └── TexturePacksPage.jsx    # CONSERVÉ mais remplacé par WorkshopPage
│   │   ├── stores/
│   │   │   ├── authStore.js
│   │   │   ├── tokenStore.js
│   │   │   ├── characterStore.js       # Modifié 44 — upsertCharacter guard visible+isGm (Bug A)
│   │   │   ├── combatStore.js          # Modifié 62 — phase/roster/actions/currentTurn/activeSlotIdx/markTokenAnnounced + setActions + advanceSlot
│   │   │   ├── mapStore.js
│   │   │   ├── sessionStore.js
│   │   │   └── entityStore.js          # Modifié 34 — fetchBlueprints() ajouté
│   │   ├── character/
│   │   │   ├── WeaponPanel.jsx         # NOUVEAU 55 — armes équipées MG/MD, stats, munitions chargées, rechargement, équipement
│   │   │   ├── InventoryPanel.jsx      # Modifié 55 — VALID_SLOTS corrigé (migration 51 → codes BG/BD/JG/JD/MG/MD/2M/Tr)
│   │   │   ├── ArmorWoundPanel.jsx     # NOUVEAU 54 — layout 3 colonnes : localisations armure + silhouette + conteneurs
│   │   │   ├── LocationPanel.jsx       # Modifié 56 — import polarisRound shared, calcMillefeuille utilise polarisRound
│   │   │   ├── ContainerPanel.jsx      # NOUVEAU 54 — Sac/Ceinture/Coffre — équipement conteneur
│   │   │   ├── SilhouettePanel.jsx     # NOUVEAU 54 — SVG silhouette colorée par blessures, 50% width
│   │   │   ├── AdvantagesPanel.jsx     # Modifié 50 — rework lift-state-up, props charSkills/refSkillsPolaris/onSkillLearnedChange
│   │   │   ├── CharacterSheet.jsx      # Modifié 61 — import calcAN/calcAllureMoy/calcAllures shared, déf locales supprimées
│   │   │   └── CharacterWindow.jsx     # Modifié 55 — WeaponPanel monté entre ArmorWoundPanel et InventoryPanel
│   │   ├── locales/
│   │   │   └── fr.json                 # Modifié 49 — +tabMateriel
│   │   ├── lib/
│   │   │   ├── api.js
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
│   │   │   ├── migrations/             # migrations jusqu'à 58 (batch 29)
│   │   │   ├── seeds/
│   │   │   │   └── 2_seed_equipment.js # NOUVEAU 48 — seed ref_equipment 636 items (KO-par-défaut, idempotent)
│   │   │   └── knex.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js            # Modifié 45 — POST /:id/cover + cover_url dans GET /
│   │   │   ├── battlemaps.js
│   │   │   ├── tokens.js               # Modifié 39 — maintenance Redis collision map
│   │   │   ├── characters.js           # Modifié 59 — type dans GET/POST/PUT/broadcastCharacterUpdate
│   │   │   ├── textures.js
│   │   │   ├── assets.js
│   │   │   ├── users.js
│   │   │   ├── dice.js
│   │   │   ├── voxel-textures.js       # Modifié 33 — usage_hint exposé GET+PUT
│   │   │   ├── texture-packs.js
│   │   │   ├── entity-blueprints.js    # Modifié 33 — POST /:id/upload-glb
│   │   │   ├── entities.js             # Modifié 39 — maintenance Redis collision map
│   │   │   ├── equipment.js            # NOUVEAU 47 — CRUD ref_equipment + junction tables. Modifié 65 Sprint GM-A : +location dans GET /equipment SELECT
│   │   │   └── character/
│   │   │       └── char-sheet.js       # Modifié 56 — ref_min_str dans les 2 SELECT GET /inventory. Modifié 65 Sprint GM-A : +POST /:characterId/quick-equip (GM-only, bypass isContainerAvailable, broadcast INVENTORY_ADDED)
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── role.js
│   │   │   ├── upload.js
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   ├── auth.js
│   │   │   └── index.js                # Modifié 65 Sprint 7.6 — COMBAT_ACTION_DECLARE v2 (payload {state,mapActions,quick}, matrices STATE_COSTS, UPDATE state_*, iniDelta), endTurn reset colonnes per-tour, is_rushed → state_vitesse. Modifié 65 Sprint DicePanel v3 — DICE_ROLL +secret : broadcast ciblé lanceur+GM via fetchSockets (PE2)
│   │   ├── lib/
│   │   │   ├── AppError.js
│   │   │   ├── minio.js
│   │   │   ├── diceParser.js
│   │   │   ├── charStats.js            # Modifié 60 — calcVitesses→calcAllures (4 allures LdB p.221, lookup COO+Athlétisme)
│   │   │   └── redis.js                # NOUVEAU 39 — client ioredis + helpers collision map (PE14 voxels)
│   │   └── index.js                    # Modifié 64 Sprint 7.3/7.4/7.4bis — resolveAssaultAction (jet attaque + PJ/PNJ bifurcation + pendingDamageActions + COMBAT_ATTACK_PLAYER_RESULT hit/miss) + COMBAT_DAMAGE_CONFIRM handler + bug fix skillAssoc (weapon.equipment_id, non weapon_inv_id)
├── shared/
│   ├── polarisUtils.js                 # Modifié 61 — +calcAN, calcAllureMoy, calcAllures (exports partagés PI11). Modifié 65 Sprint GM-B : +DEFAULT_PNJ_ALLURES { lente:4, moyenne:8, rapide:16, max:24 }
│   ├── events.js                       # Modifié 64 Sprint 7.4/7.4bis — +COMBAT_DAMAGE_PROMPT/CONFIRM/RESULT + COMBAT_ATTACK_PLAYER_RESULT. Modifié 51 — +INVENTORY_ADDED/UPDATED/REMOVED/SOLS_UPDATED
│   ├── woundConstants.js               # NOUVEAU 49 — WOUND_LOCATIONS/SEVERITIES/MAX_COUNTS/PENALTIES/SEVERITY_COLORS
│   └── armorConstants.js               # NOUVEAU 54 — ARMOR_CATEGORY_MALUS/LOCATION_TO_SLOT/SLOT_TO_REF_LOCATION/LOCATION_TO_SVG/LOCATION_LABELS
└── docs/
```

---

## Infrastructure

| Composant | Tech | Notes |
|---|---|---|
| Frontend | React 19 + Vite | Port 5173 dev |
| Backend | Node.js + Express + Socket.io | Port 3001 |
| Base de données | PostgreSQL | Knex migrations |
| Cache/collisions | Redis + ioredis | Collision map par battlemap — branché session 39 |
| Stockage fichiers | MinIO | Bucket unique |
| Auth | JWT httpOnly cookie | 7 jours |

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
- Animation déclenchée uniquement si `!skillLabel` (jets normaux, pas jets entité)
- `seed` du payload initialise le PRNG déterministe de l'animation

### Dés supportés
| Dé | Géométrie | Chiffre | Statut |
|---|---|---|---|
| D6 | BoxGeometry | Texture CanvasTexture par face | ✅ stable |
| D4 | TetrahedronGeometry | Texture CanvasTexture par face | ✅ stable |
| D8 | OctahedronGeometry | Texture CanvasTexture par face | ✅ stable |
| D20 | GLB (D20_LP Blender) | Texture GLB albedo 4096×4096 | ✅ normales exactes session 65 |
| D12 | DodecahedronGeometry | Atlas 12 cases (fillText centroïde 0.397) | ✅ stable |
| D10/D100 | Trapezohedron custom | Html overlay V1 `position=[0,0,0]` | ✅ V1 stable |

### Pièges actifs Dice Rework
- `DiceMesh.useMemo` deps `[geoDef.type, color, dieType]` — dieType obligatoire (PE32)
- D10 Html overlay `position=[0,0,0]` — ne pas déplacer (PE33)
- D12 atlas `fillText` à `atlasSize * 0.397` — centroïde calculé, ne pas modifier

### V2 / todo
- D10 UV texturing — modèle Blender (.glb) avec UVs kite pré-calculés
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
Canvas3D : ghost wireframe snapé 8 axes, couleur bleu/orange/rouge selon dot(AE,AD)
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
